import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import chalk from "chalk";

/** Log to stderr so stdout stays clean for directory output */
const log = (...args: unknown[]) => console.error(...args);

interface InitCommand {
  file: string;
  command: string;
  name: string;
}

const INIT_COMMANDS: InitCommand[] = [
  { file: "pnpm-lock.yaml", command: "pnpm i", name: "pnpm" },
  { file: "yarn.lock", command: "yarn", name: "yarn" },
  { file: "package-lock.json", command: "npm i", name: "npm" },
  { file: "bun.lockb", command: "bun i", name: "bun" },
  { file: "Cargo.toml", command: "cargo build", name: "cargo" },
  { file: "go.mod", command: "go mod download", name: "go" },
  {
    file: "requirements.txt",
    command: "pip install -r requirements.txt",
    name: "pip",
  },
  { file: "Makefile", command: "make", name: "make" },
];

export function detectAndRunInit(dir: string): void {
  for (const init of INIT_COMMANDS) {
    const filePath = path.join(dir, init.file);
    if (fs.existsSync(filePath)) {
      log(
        chalk.yellow(
          `  Detected ${init.name} project, running: ${init.command}`,
        ),
      );
      try {
        // Redirect child stdout to stderr so it doesn't pollute captured output
        execSync(init.command, { cwd: dir, stdio: [0, 2, 2] });
        log(chalk.green(`  ✓ ${init.name} initialization complete`));
      } catch (err) {
        log(chalk.red(`  ✗ ${init.name} initialization failed`));
      }
      return;
    }
  }
}
