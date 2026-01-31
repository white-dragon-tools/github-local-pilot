import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { loadGlobalConfig } from '../utils/config.js';
import { isMainRepo, remoteBranchExists } from '../utils/git-ops.js';

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

function removeWorktree(mainRepoDir: string, wtPath: string): boolean {
  try {
    execSync(`git worktree remove "${wtPath}" --force`, {
      cwd: mainRepoDir,
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    return true;
  } catch {
    return false;
  }
}

export function createCleanCommand(): Command {
  const cmd = new Command('clean');
  cmd.description('Clean up worktrees without remote branches');
  cmd.option('-a, --all', 'Clean all repos in workspace');
  cmd.option('--dry-run', 'Show what would be cleaned without actually cleaning');
  cmd.argument('[repo]', 'Repository path or org/repo format');

  cmd.action(async (repo: string | undefined, options: { all?: boolean; dryRun?: boolean }) => {
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

      const worktrees = getWorktreeList(mainRepoDir);
      
      for (const wt of worktrees) {
        if (wt.isMain) {
          console.log(chalk.gray(`  [main] ${wt.path}`));
          continue;
        }

        if (wt.branch === 'HEAD (detached)') {
          // Detached HEAD - check if directory name matches a pattern
          console.log(chalk.yellow(`  [detached] ${wt.path}`));
          if (!options.dryRun) {
            if (removeWorktree(mainRepoDir, wt.path)) {
              console.log(chalk.green(`    ✓ Removed`));
              totalCleaned++;
            } else {
              console.log(chalk.red(`    ✗ Failed to remove`));
            }
          } else {
            console.log(chalk.gray(`    → Would remove`));
            totalCleaned++;
          }
          continue;
        }

        // Check if branch exists on remote
        const hasRemote = remoteBranchExists(mainRepoDir, wt.branch);
        
        if (hasRemote) {
          console.log(chalk.gray(`  [remote] ${wt.branch} → ${path.basename(wt.path)}`));
        } else {
          console.log(chalk.yellow(`  [local only] ${wt.branch} → ${path.basename(wt.path)}`));
          if (!options.dryRun) {
            if (removeWorktree(mainRepoDir, wt.path)) {
              console.log(chalk.green(`    ✓ Removed`));
              totalCleaned++;
            } else {
              console.log(chalk.red(`    ✗ Failed to remove`));
            }
          } else {
            console.log(chalk.gray(`    → Would remove`));
            totalCleaned++;
          }
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
