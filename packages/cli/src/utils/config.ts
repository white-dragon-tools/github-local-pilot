import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// Global config (workspace location only)
export interface GlobalConfig {
  workspace: string;
}

const CONFIG_DIR = path.join(os.homedir(), '.github-local-pilot');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export function getConfigPath(): string {
  return CONFIG_FILE;
}

export function configExists(): boolean {
  return fs.existsSync(CONFIG_FILE);
}

export function loadGlobalConfig(): GlobalConfig | null {
  if (!configExists()) {
    return null;
  }

  try {
    const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(content) as GlobalConfig;
  } catch {
    return null;
  }
}

export function saveGlobalConfig(config: GlobalConfig): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

export function validateGlobalConfig(config: GlobalConfig): string[] {
  const errors: string[] = [];

  if (!config.workspace) {
    errors.push('workspace is required');
  } else if (!fs.existsSync(config.workspace)) {
    errors.push(`workspace directory does not exist: ${config.workspace}`);
  }

  return errors;
}
