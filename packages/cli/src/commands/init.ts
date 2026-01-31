import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import * as fs from 'node:fs';
import { saveGlobalConfig, getConfigPath, type GlobalConfig } from '../utils/config.js';
import { checkAllDependencies, checkGhAuth } from '../utils/dependencies.js';
import { execSync } from 'node:child_process';

export function createInitCommand(): Command {
  const cmd = new Command('init');
  cmd.description('Initialize GitHub Local Pilot configuration');
  cmd.action(async () => {
    console.log(chalk.cyan('\n🔧 GitHub Local Pilot - Setup\n'));

    // Check dependencies
    console.log('Checking requirements...');
    const deps = checkAllDependencies();
    let allInstalled = true;

    for (const dep of deps) {
      if (dep.installed) {
        console.log(chalk.green(`✓ ${dep.name}`));
      } else {
        console.log(chalk.red(`✗ ${dep.name} - not installed`));
        allInstalled = false;
      }
    }

    if (!allInstalled) {
      console.log(chalk.red('\nPlease install missing dependencies first.'));
      console.log('  Git: https://git-scm.com/');
      console.log('  GitHub CLI: https://cli.github.com/');
      process.exit(1);
    }

    // Check gh auth
    if (!checkGhAuth()) {
      console.log(chalk.yellow('\n  → GitHub CLI not authenticated'));
      console.log('  Running: gh auth login\n');
      try {
        execSync('gh auth login', { stdio: 'inherit' });
      } catch {
        console.log(chalk.red('GitHub authentication failed.'));
        process.exit(1);
      }
    } else {
      console.log(chalk.green('✓ GitHub CLI authenticated'));
    }

    console.log('');

    // Prompt for workspace only
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'workspace',
        message: 'Workspace directory:',
        validate: (input: string) => {
          if (!input.trim()) {
            return 'Workspace directory is required';
          }
          if (!fs.existsSync(input)) {
            return `Directory does not exist: ${input}`;
          }
          return true;
        },
      },
    ]);

    const config: GlobalConfig = {
      workspace: answers.workspace,
    };

    saveGlobalConfig(config);

    console.log(chalk.green('\n✅ Setup complete!\n'));
    console.log(`Configuration saved to: ${getConfigPath()}\n`);
    console.log('Next steps:');
    console.log(chalk.cyan('  ghlp register    # Enable browser integration'));
    console.log(chalk.gray(`  Create ${answers.workspace}/.ghlp/config.yaml for workspace settings\n`));
  });

  return cmd;
}
