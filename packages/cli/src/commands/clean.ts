import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync, exec } from 'node:child_process';
import { promisify } from 'node:util';
import { rm } from 'node:fs/promises';

const execAsync = promisify(exec);
import { loadGlobalConfig } from '../utils/config.js';
import { isMainRepo } from '../utils/git-ops.js';

interface WorktreeInfo {
  path: string;
  branch: string;
  isMain: boolean;
}

function getWorktreeList(mainRepoDir: string): WorktreeInfo[] {
  try {
    const output = execSync('git worktree list --porcelain', {
      cwd: mainRepoDir,
      encoding: 'utf-8',
    });

    const worktrees: WorktreeInfo[] = [];
    const blocks = output.trim().split('\n\n');

    for (const block of blocks) {
      const lines = block.split('\n');
      let wtPath = '';
      let branch = '';

      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          wtPath = line.replace('worktree ', '');
        } else if (line.startsWith('branch ')) {
          branch = line.replace('branch refs/heads/', '');
        } else if (line === 'detached') {
          branch = 'HEAD (detached)';
        }
      }

      if (wtPath) {
        worktrees.push({
          path: wtPath,
          branch,
          isMain: isMainRepo(wtPath),
        });
      }
    }

    return worktrees;
  } catch {
    return [];
  }
}

async function findAndKillProcessesInDir(dirPath: string): Promise<string[]> {
  const killed: string[] = [];
  if (process.platform !== 'win32') return killed;
  
  try {
    // Use wmic to find processes with executables in the directory
    const { stdout } = await execAsync('wmic process get ProcessId,Name,ExecutablePath /format:csv', { shell: 'cmd.exe' });
    const lines = stdout.split('\n').filter(line => line.toLowerCase().includes(dirPath.toLowerCase().replace(/\\/g, '\\\\')));
    
    for (const line of lines) {
      const parts = line.split(',');
      if (parts.length >= 3) {
        const pid = parts[parts.length - 2];
        const name = parts[parts.length - 3];
        if (pid && /^\d+$/.test(pid.trim())) {
          try {
            await execAsync(`taskkill /F /PID ${pid.trim()}`, { shell: 'cmd.exe' });
            killed.push(`${name} (PID: ${pid.trim()})`);
          } catch {
            // Process might have already exited
          }
        }
      }
    }
    
    if (killed.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  } catch {
    // Ignore errors
  }
  
  return killed;
}

async function removeDirectory(dirPath: string): Promise<{ success: boolean; error?: string }> {
  try {
    await rm(dirPath, { recursive: true, force: true, maxRetries: 3 });
    return { success: true };
  } catch (e) {
    if (e instanceof Error && e.message.includes('EBUSY')) {
      // Find and kill processes using this directory
      const killed = await findAndKillProcessesInDir(dirPath);
      if (killed.length > 0) {
        console.log(chalk.yellow(`    Killed processes: ${killed.join(', ')}`));
      }
      // Retry
      try {
        await rm(dirPath, { recursive: true, force: true, maxRetries: 3 });
        return { success: true };
      } catch (e2) {
        const error = e2 instanceof Error ? e2.message : String(e2);
        return { success: false, error: `Still locked after killing processes. ${error}` };
      }
    }
    const error = e instanceof Error ? e.message : String(e);
    return { success: false, error };
  }
}

async function removeWorktree(mainRepoDir: string, wtPath: string): Promise<{ success: boolean; error?: string }> {
  try {
    // First try git worktree remove
    await execAsync(`git worktree remove "${wtPath}" --force`, { cwd: mainRepoDir });
    return { success: true };
  } catch {
    // If git worktree remove fails, manually delete directory and prune
    const dirResult = await removeDirectory(wtPath);
    if (!dirResult.success) {
      return dirResult;
    }
    try {
      await execAsync('git worktree prune', { cwd: mainRepoDir });
      return { success: true };
    } catch (e) {
      const error = e instanceof Error ? (e as Error & { stderr?: string }).stderr || e.message : String(e);
      return { success: false, error: error.trim() };
    }
  }
}

export function createCleanCommand(): Command {
  const cmd = new Command('clean');
  cmd.description('Clean up worktrees without remote branches');
  cmd.option('-a, --all', 'Clean all repos in workspace');
  cmd.option('-f, --force', 'Delete entire repo folder');
  cmd.option('--dry-run', 'Show what would be cleaned without actually cleaning');
  cmd.argument('[repo]', 'Repository path or org/repo format');

  cmd.action(async (repo: string | undefined, options: { all?: boolean; force?: boolean; dryRun?: boolean }) => {
    const config = loadGlobalConfig();
    if (!config) {
      console.log(chalk.red('Configuration not found. Run `ghlp init` first.'));
      process.exit(1);
    }

    const reposToClean: string[] = [];

    if (options.all) {
      // Find all repos in workspace
      const orgs = fs.readdirSync(config.workspace, { withFileTypes: true });
      for (const org of orgs) {
        if (!org.isDirectory()) continue;
        const orgPath = path.join(config.workspace, org.name);
        const repos = fs.readdirSync(orgPath, { withFileTypes: true });
        for (const r of repos) {
          if (!r.isDirectory()) continue;
          reposToClean.push(path.join(orgPath, r.name));
        }
      }
    } else if (repo) {
      // Single repo
      if (repo.includes('/') && !path.isAbsolute(repo)) {
        // org/repo format
        reposToClean.push(path.join(config.workspace, repo));
      } else {
        reposToClean.push(repo);
      }
    } else {
      console.log(chalk.red('Please specify a repo or use --all'));
      process.exit(1);
    }

    let totalCleaned = 0;

    for (const repoPath of reposToClean) {
      if (!fs.existsSync(repoPath)) {
        continue;
      }

      console.log(chalk.cyan(`\n📂 ${repoPath}`));

      // Force mode: delete entire repo folder
      if (options.force) {
        if (!options.dryRun) {
          const result = await removeDirectory(repoPath);
          if (result.success) {
            console.log(chalk.green(`  ✓ Removed entire folder`));
            totalCleaned++;
          } else {
            console.log(chalk.red(`  ✗ Failed to remove: ${result.error}`));
          }
        } else {
          console.log(chalk.gray(`  → Would remove entire folder`));
          totalCleaned++;
        }
        continue;
      }

      // Find main repo
      const entries = fs.readdirSync(repoPath, { withFileTypes: true });
      let mainRepoDir: string | null = null;
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const fullPath = path.join(repoPath, entry.name);
          if (isMainRepo(fullPath)) {
            mainRepoDir = fullPath;
            break;
          }
        }
      }

      if (!mainRepoDir) {
        continue;
      }

      console.log(chalk.cyan(`\n📂 ${repoPath}`));

      // Get worktree list for reference
      const worktrees = getWorktreeList(mainRepoDir);

      // Build list of directories to check
      interface DirInfo {
        name: string;
        fullPath: string;
        worktree?: WorktreeInfo;
        isMain: boolean;
      }
      
      const dirs: DirInfo[] = [];
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const fullPath = path.join(repoPath, entry.name);
        const normalizedPath = path.normalize(fullPath).toLowerCase();
        const isMain = isMainRepo(fullPath);
        const worktree = worktrees.find(wt => path.normalize(wt.path).toLowerCase() === normalizedPath);
        dirs.push({ name: entry.name, fullPath, worktree, isMain });
      }

      // Check remote branches in parallel
      const mainRepoDirFinal = mainRepoDir;
      const checkResults = await Promise.all(dirs.map(async (dir) => {
        if (dir.isMain) {
          return { dir, status: 'main' as const, hasRemote: true };
        }
        if (!dir.worktree) {
          return { dir, status: 'orphan' as const, hasRemote: false };
        }
        if (dir.worktree.branch === 'HEAD (detached)') {
          return { dir, status: 'detached' as const, hasRemote: false };
        }
        // Check remote in parallel
        const hasRemote = await new Promise<boolean>((resolve) => {
          exec(`git ls-remote --heads origin "${dir.worktree!.branch}"`, { cwd: mainRepoDirFinal }, (err, stdout) => {
            resolve(!err && stdout.trim().length > 0);
          });
        });
        return { dir, status: hasRemote ? 'remote' as const : 'local' as const, hasRemote };
      }));

      // Process results and delete in parallel
      const toDelete: { dir: DirInfo; status: string }[] = [];
      for (const { dir, status, hasRemote } of checkResults) {
        if (status === 'main') {
          console.log(chalk.gray(`  [main] ${dir.fullPath}`));
        } else if (status === 'remote') {
          console.log(chalk.gray(`  [remote] ${dir.worktree!.branch} → ${dir.name}`));
        } else if (status === 'local') {
          console.log(chalk.yellow(`  [local only] ${dir.worktree!.branch} → ${dir.name}`));
          toDelete.push({ dir, status });
        } else if (status === 'detached') {
          console.log(chalk.yellow(`  [detached] ${dir.fullPath}`));
          toDelete.push({ dir, status });
        } else if (status === 'orphan') {
          console.log(chalk.yellow(`  [orphan] ${dir.name}`));
          toDelete.push({ dir, status });
        }
      }

      // Delete in parallel
      if (!options.dryRun && toDelete.length > 0) {
        const deleteResults = await Promise.all(toDelete.map(async ({ dir, status }) => {
          const result = status === 'orphan' 
            ? await removeDirectory(dir.fullPath)
            : await removeWorktree(mainRepoDirFinal, dir.fullPath);
          return { dir, result };
        }));
        
        for (const { dir, result } of deleteResults) {
          if (result.success) {
            console.log(chalk.green(`    ✓ Removed ${dir.name}`));
            totalCleaned++;
          } else {
            console.log(chalk.red(`    ✗ Failed to remove ${dir.name}: ${result.error}`));
          }
        }
      } else if (options.dryRun) {
        totalCleaned += toDelete.length;
        for (const { dir } of toDelete) {
          console.log(chalk.gray(`    → Would remove ${dir.name}`));
        }
      }
    }

    console.log('');
    if (options.dryRun) {
      console.log(chalk.cyan(`Would clean ${totalCleaned} worktree(s)`));
    } else {
      console.log(chalk.green(`Cleaned ${totalCleaned} worktree(s)`));
    }
  });

  return cmd;
}
