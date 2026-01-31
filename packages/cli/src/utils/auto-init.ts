import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import chalk from 'chalk';

interface InitCommand {
  file: string;
  command: string;
  name: string;
}

const INIT_COMMANDS: InitCommand[] = [
  { file: 'pnpm-lock.yaml', command: 'pnpm i', name: 'pnpm' },
  { file: 'yarn.lock', command: 'yarn', name: 'yarn' },
  { file: 'package-lock.json', command: 'npm i', name: 'npm' },
  { file: 'bun.lockb', command: 'bun i', name: 'bun' },
  { file: 'Cargo.toml', command: 'cargo build', name: 'cargo' },
  { file: 'go.mod', command: 'go mod download', name: 'go' },
  { file: 'requirements.txt', command: 'pip install -r requirements.txt', name: 'pip' },
  { file: 'Makefile', command: 'make', name: 'make' },
];

export function detectAndRunInit(dir: string): void {
  for (const init of INIT_COMMANDS) {
    const filePath = path.join(dir, init.file);
    if (fs.existsSync(filePath)) {
      console.log(chalk.yellow(`  Detected ${init.name} project, running: ${init.command}`));
      try {
        execSync(init.command, { cwd: dir, stdio: 'inherit' });
        console.log(chalk.green(`  ✓ ${init.name} initialization complete`));
      } catch (err) {
        console.log(chalk.red(`  ✗ ${init.name} initialization failed`));
      }
      return;
    }
  }
}
