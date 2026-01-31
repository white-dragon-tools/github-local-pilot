import { execSync } from 'node:child_process';

export interface DependencyCheck {
  name: string;
  installed: boolean;
  version?: string;
}

export function checkGit(): DependencyCheck {
  try {
    const version = execSync('git --version', { encoding: 'utf-8' }).trim();
    return { name: 'Git', installed: true, version };
  } catch {
    return { name: 'Git', installed: false };
  }
}

export function checkGhCli(): DependencyCheck {
  try {
    const version = execSync('gh --version', { encoding: 'utf-8' }).split('\n')[0].trim();
    return { name: 'GitHub CLI', installed: true, version };
  } catch {
    return { name: 'GitHub CLI', installed: false };
  }
}

export function checkGhAuth(): boolean {
  try {
    execSync('gh auth status', { encoding: 'utf-8', stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export function checkAllDependencies(): DependencyCheck[] {
  return [checkGit(), checkGhCli()];
}
