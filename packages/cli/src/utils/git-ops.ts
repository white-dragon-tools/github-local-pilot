import { execSync, exec } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface GitResult {
  success: boolean;
  message?: string;
  error?: string;
}

function runCommand(cmd: string, cwd?: string): GitResult {
  try {
    const output = execSync(cmd, {
      encoding: 'utf-8',
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { success: true, message: output.trim() };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

export function isGitRepo(dir: string): boolean {
  const gitPath = path.join(dir, '.git');
  return fs.existsSync(gitPath);
}

export function isMainRepo(dir: string): boolean {
  const gitPath = path.join(dir, '.git');
  if (!fs.existsSync(gitPath)) return false;
  return fs.statSync(gitPath).isDirectory();
}

export function isWorktree(dir: string): boolean {
  const gitPath = path.join(dir, '.git');
  if (!fs.existsSync(gitPath)) return false;
  return fs.statSync(gitPath).isFile();
}

export function findMainRepo(baseDir: string): string | null {
  if (!fs.existsSync(baseDir)) return null;

  const entries = fs.readdirSync(baseDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const fullPath = path.join(baseDir, entry.name);
      if (isMainRepo(fullPath)) {
        return fullPath;
      }
    }
  }
  return null;
}

export function cloneRepo(
  org: string,
  repo: string,
  targetDir: string
): GitResult {
  const repoUrl = `https://github.com/${org}/${repo}.git`;
  const parentDir = path.dirname(targetDir);

  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  return runCommand(`git clone "${repoUrl}" "${targetDir}"`);
}

export function fetchRepo(repoDir: string): GitResult {
  return runCommand('git fetch --all', repoDir);
}

export function getDefaultBranch(repoDir: string): string {
  // First, ensure origin/HEAD is set
  runCommand('git remote set-head origin --auto', repoDir);
  
  const result = runCommand(
    'git symbolic-ref refs/remotes/origin/HEAD --short',
    repoDir
  );
  if (result.success && result.message) {
    return result.message.replace('origin/', '');
  }
  return 'main';
}

export function createWorktree(
  mainRepoDir: string,
  targetDir: string,
  branch: string,
  createBranch: boolean = false,
  baseBranch?: string
): GitResult {
  const parentDir = path.dirname(targetDir);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  let cmd: string;
  if (branch === 'HEAD') {
    // Create detached worktree
    cmd = `git worktree add --detach "${targetDir}"`;
  } else if (createBranch) {
    // Create new branch based on origin/baseBranch or origin/main
    const base = baseBranch ? `origin/${baseBranch}` : `origin/${getDefaultBranch(mainRepoDir)}`;
    cmd = `git worktree add -b "${branch}" "${targetDir}" "${base}"`;
  } else {
    cmd = `git worktree add "${targetDir}" "${branch}"`;
  }
  return runCommand(cmd, mainRepoDir);
}

export function checkoutBranch(repoDir: string, branch: string): GitResult {
  return runCommand(`git checkout "${branch}"`, repoDir);
}

export function checkoutPR(repoDir: string, prNumber: string): GitResult {
  return runCommand(`gh pr checkout ${prNumber}`, repoDir);
}

export function getPRBranchName(org: string, repo: string, prNumber: string): string | null {
  const result = runCommand(
    `gh pr view ${prNumber} --repo ${org}/${repo} --json headRefName --jq .headRefName`
  );
  if (result.success && result.message) {
    return result.message.trim();
  }
  return null;
}

export function remoteBranchExists(
  repoDir: string,
  branch: string
): boolean {
  const result = runCommand(
    `git ls-remote --heads origin "${branch}"`,
    repoDir
  );
  return result.success && !!result.message;
}

export function localBranchExists(
  repoDir: string,
  branch: string
): boolean {
  const result = runCommand(
    `git show-ref --verify --quiet "refs/heads/${branch}"`,
    repoDir
  );
  return result.success;
}

export function openInIde(dir: string, ideCommand: string): void {
  try {
    let cmd: string;
    if (ideCommand.includes('{dir}')) {
      cmd = ideCommand.replace('{dir}', dir);
    } else {
      cmd = `${ideCommand} "${dir}"`;
    }
    exec(cmd);
  } catch {
    // Ignore errors
  }
}
