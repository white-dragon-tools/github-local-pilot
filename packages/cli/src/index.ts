#!/usr/bin/env node

import { Command } from "commander";
import { createInitCommand } from "./commands/init.js";
import { createUrlHandler } from "./commands/open.js";
import { createRegisterCommand } from "./commands/register.js";
import { createCleanCommand } from "./commands/clean.js";
import { loadGlobalConfig } from "./utils/config.js";

const program = new Command();

program
  .name("ghlp")
  .description(
    "GitHub Local Pilot - One-click open GitHub Issue/PR/Branch in local workspace with Git worktree",
  )
  .version("1.0.0")
  .option("-w, --workspace", "Print workspace path");

// Add subcommands
program.addCommand(createInitCommand());
program.addCommand(createUrlHandler());
program.addCommand(createRegisterCommand());
program.addCommand(createCleanCommand());

// Handle -w option before parsing (only when it's a standalone flag, not a subcommand option)
const args = process.argv.slice(2);
if (args.length === 1 && (args[0] === "-w" || args[0] === "--workspace")) {
  const config = loadGlobalConfig();
  if (config?.workspace) {
    console.log(config.workspace);
  } else {
    console.error('Workspace not configured. Run "ghlp init" first.');
    process.exit(1);
  }
  process.exit(0);
}

// Handle direct URL argument (for protocol handler and direct usage)
// ghlp ghlp://github.com/org/repo/issues/123
// ghlp https://github.com/org/repo/issues/123
if (
  args.length === 1 &&
  (args[0].startsWith("ghlp://github.com/") ||
    args[0].startsWith("https://github.com/"))
) {
  // Redirect to open command
  process.argv.splice(2, 0, "open");
}

program.parse();
