#!/usr/bin/env node

import { Command } from 'commander';
import { createInitCommand } from './commands/init.js';
import { createUrlHandler } from './commands/open.js';
import { createRegisterCommand } from './commands/register.js';
import { createCleanCommand } from './commands/clean.js';

const program = new Command();

program
  .name('ghlp')
  .description('GitHub Local Pilot - One-click open GitHub Issue/PR/Branch in local workspace with Git worktree')
  .version('1.0.0');

// Add subcommands
program.addCommand(createInitCommand());
program.addCommand(createUrlHandler());
program.addCommand(createRegisterCommand());
program.addCommand(createCleanCommand());

// Handle direct URL argument (for protocol handler and direct usage)
// ghlp ghlp://github.com/org/repo/issues/123
// ghlp https://github.com/org/repo/issues/123
const args = process.argv.slice(2);
if (args.length === 1 && (args[0].startsWith('ghlp://github.com/') || args[0].startsWith('https://github.com/'))) {
  // Redirect to open command
  process.argv.splice(2, 0, 'open');
}

program.parse();
