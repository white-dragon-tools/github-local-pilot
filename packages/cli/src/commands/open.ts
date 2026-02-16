import { Command } from "commander";
import chalk from "chalk";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import { spawn } from "node:child_process";
import { parseProtocolUrl, getTargetDirectory } from "../utils/url-parser.js";
import { loadGlobalConfig } from "../utils/config.js";
import {
  cloneRepo,
  fetchRepo,
  findMainRepo,
  createWorktree,
  checkoutPR,
  getPRBranchName,
  remoteBranchExists,
  localBranchExists,
  getDefaultBranch,
  isGitRepo,
} from "../utils/git-ops.js";
import { detectAndRunInit } from "../utils/auto-init.js";
import {
  loadWorkspaceConfig,
  applyMappings,
  type WorkspaceConfig,
} from "../utils/mappings.js";
import { writeMetadata, inferOriginType } from "../utils/metadata.js";

/** Log to stderr (progress/diagnostics) */
const log = (...args: unknown[]) => console.error(...args);

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}

function buildIdeCommand(autoOpenIde: string): string {
  if (autoOpenIde.includes("{dir}")) {
    return autoOpenIde.replace("{dir}", '"$TARGET_DIR"');
  }
  return `${autoOpenIde} "$TARGET_DIR"`;
}

function spawnInTerminal(
  wsConfig: WorkspaceConfig,
  inputUrl: string,
  workspace: string,
): void {
  const lines = [
    "#!/bin/bash",
    "export PATH=/opt/homebrew/bin:/usr/local/bin:$PATH",
    "export GHLP_IN_TERMINAL=1",
    `TARGET_DIR=$(ghlp open ${shellQuote(inputUrl)} -w ${shellQuote(workspace)})`,
    'if [ -n "$TARGET_DIR" ] && [ -d "$TARGET_DIR" ]; then',
    '  cd "$TARGET_DIR"',
  ];
  if (wsConfig.autoOpenIde) {
    lines.push(`  ${buildIdeCommand(wsConfig.autoOpenIde)}`);
  }
  lines.push("fi", 'rm -f "$0"', "exec $SHELL");

  const scriptPath = path.join(
    os.tmpdir(),
    `ghlp-${process.pid}-${Date.now()}.sh`,
  );
  fs.writeFileSync(scriptPath, lines.join("\n") + "\n", { mode: 0o755 });

  let terminalCmd: string;
  if (wsConfig.terminal!.includes("{dir}")) {
    terminalCmd = wsConfig.terminal!.replace("{dir}", shellQuote(scriptPath));
  } else {
    terminalCmd = `${wsConfig.terminal} ${shellQuote(scriptPath)}`;
  }

  const child = spawn("bash", ["-c", terminalCmd], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

export function createUrlHandler(): Command {
  const cmd = new Command("open");
  cmd.argument("<url>", "Protocol URL (ghlp://org/repo/...)");
  cmd.option("-w, --workspace <path>", "Override default workspace directory");
  cmd.description("Open a GitHub URL in local workspace");
  cmd.action(async (inputUrl: string, options: { workspace?: string }) => {
    let workspace: string;

    if (options.workspace) {
      workspace = options.workspace;
    } else {
      const globalConfig = loadGlobalConfig();
      if (!globalConfig) {
        log(
          chalk.red(
            "Configuration not found. Run `ghlp init` first or use -w <workspace>.",
          ),
        );
        process.exit(1);
      }
      workspace = globalConfig.workspace;
    }

    // Load workspace config
    const wsConfig = loadWorkspaceConfig(workspace);

    // Non-TTY protocol handler (ghlp://): spawn configured terminal and exit
    // Only trigger for ghlp:// URLs, not for https:// direct CLI usage
    if (
      !process.stdout.isTTY &&
      !process.env.GHLP_IN_TERMINAL &&
      wsConfig.terminal &&
      inputUrl.startsWith("ghlp://")
    ) {
      spawnInTerminal(wsConfig, inputUrl, workspace);
      return;
    }

    // Apply URL mappings if configured
    let url = inputUrl;
    let customBranch: string | undefined;

    const result = applyMappings(inputUrl, wsConfig.mappings);
    const isMapped = result.url !== inputUrl;

    // Determine originType: from mapping config, or infer from original URL
    const originType = isMapped
      ? result.originType || "external"
      : inferOriginType(inputUrl);

    if (isMapped) {
      log(chalk.gray(`  Mapped: ${inputUrl}`));
      log(chalk.gray(`       → ${result.url}`));
      url = result.url;
      customBranch = result.branch;
    }

    const parsed = parseProtocolUrl(url);
    if (!parsed) {
      log(chalk.red(`Invalid URL: ${url}`));
      process.exit(1);
    }

    log(
      chalk.cyan(`\n📂 Opening ${parsed.type}: ${parsed.org}/${parsed.repo}`),
    );
    if (parsed.identifier) {
      const typeLabel =
        parsed.type === "branch"
          ? "Branch"
          : parsed.type === "pr"
            ? "PR"
            : parsed.type === "tag"
              ? "Tag"
              : "Issue";
      log(chalk.gray(`   ${typeLabel}: ${parsed.identifier}`));
    }
    if (customBranch) {
      log(chalk.gray(`   Custom branch: ${customBranch}`));
    }
    log("");

    const repoBaseDir = path.join(workspace, parsed.org, parsed.repo);

    // Find or create main repo first to get default branch
    let mainRepoDir = findMainRepo(repoBaseDir);
    let defaultBranch = "main";

    if (!mainRepoDir) {
      log(chalk.yellow("  Cloning repository..."));
      const tempMainDir = path.join(repoBaseDir, "__temp_clone__");
      const cloneResult = cloneRepo(parsed.org, parsed.repo, tempMainDir);
      if (!cloneResult.success) {
        log(chalk.red(`  Failed to clone: ${cloneResult.error}`));
        process.exit(1);
      }
      // Get default branch and rename directory
      defaultBranch = getDefaultBranch(tempMainDir);
      const actualMainDir = path.join(
        repoBaseDir,
        `${defaultBranch}-${parsed.repo}`,
      );
      fs.renameSync(tempMainDir, actualMainDir);
      mainRepoDir = actualMainDir;
      log(chalk.green("  ✓ Repository cloned"));

      // Write metadata for newly cloned repo
      if (parsed.type === "repo") {
        detectAndRunInit(mainRepoDir);
        writeMetadata(mainRepoDir, {
          originalUrl: inputUrl,
          originType,
          mapped: isMapped,
          mappedUrl: isMapped ? url : undefined,
          type: "repo",
          org: parsed.org,
          repo: parsed.repo,
          branch: defaultBranch,
          createdAt: new Date().toISOString(),
        });
      }
    } else {
      defaultBranch = getDefaultBranch(mainRepoDir);

      // Migrate old directory naming (e.g., "main" → "main-repo")
      const expectedMainDir = path.join(
        repoBaseDir,
        `${defaultBranch}-${parsed.repo}`,
      );
      if (mainRepoDir !== expectedMainDir && !fs.existsSync(expectedMainDir)) {
        // Update .git files in sibling worktrees to point to new main repo path
        const entries = fs.readdirSync(repoBaseDir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const gitFilePath = path.join(repoBaseDir, entry.name, ".git");
          if (fs.existsSync(gitFilePath) && fs.statSync(gitFilePath).isFile()) {
            const content = fs.readFileSync(gitFilePath, "utf-8");
            if (content.includes(mainRepoDir)) {
              fs.writeFileSync(
                gitFilePath,
                content.replaceAll(mainRepoDir, expectedMainDir),
              );
            }
          }
        }
        fs.renameSync(mainRepoDir, expectedMainDir);
        mainRepoDir = expectedMainDir;
        log(chalk.gray(`  Migrated: ${path.basename(expectedMainDir)}`));
      }

      log(chalk.gray("  Fetching latest changes..."));
      fetchRepo(mainRepoDir);
    }

    const targetDir = getTargetDirectory(
      workspace,
      parsed,
      customBranch,
      defaultBranch,
    );

    // Check if target already exists
    if (fs.existsSync(targetDir) && isGitRepo(targetDir)) {
      log(chalk.green(`✓ Directory already exists: ${targetDir}`));
      console.log(targetDir);
      return;
    }

    // Handle based on type
    let finalDir: string | undefined;

    switch (parsed.type) {
      case "repo": {
        detectAndRunInit(mainRepoDir);
        writeMetadata(mainRepoDir, {
          originalUrl: inputUrl,
          originType,
          mapped: isMapped,
          mappedUrl: isMapped ? url : undefined,
          type: "repo",
          org: parsed.org,
          repo: parsed.repo,
          branch: getDefaultBranch(mainRepoDir),
          createdAt: new Date().toISOString(),
        });
        log(chalk.green(`✓ Ready: ${mainRepoDir}`));
        finalDir = mainRepoDir;
        break;
      }

      case "branch": {
        if (targetDir === mainRepoDir) {
          log(chalk.green(`✓ Ready: ${mainRepoDir}`));
        } else {
          log(
            chalk.yellow(
              `  Creating worktree for branch: ${parsed.identifier}`,
            ),
          );
          const result = createWorktree(
            mainRepoDir,
            targetDir,
            parsed.identifier!,
            false,
          );
          if (!result.success) {
            log(chalk.red(`  Failed: ${result.error}`));
            process.exit(1);
          }
          detectAndRunInit(targetDir);
          writeMetadata(targetDir, {
            originalUrl: inputUrl,
            originType,
            mapped: isMapped,
            mappedUrl: isMapped ? url : undefined,
            type: "branch",
            org: parsed.org,
            repo: parsed.repo,
            identifier: parsed.identifier,
            branch: parsed.identifier!,
            createdAt: new Date().toISOString(),
          });
          log(chalk.green(`✓ Ready: ${targetDir}`));
        }
        finalDir = targetDir;
        break;
      }

      case "pr": {
        log(chalk.yellow(`  Getting PR #${parsed.identifier} info...`));
        const prBranchName = getPRBranchName(
          parsed.org,
          parsed.repo,
          parsed.identifier!,
        );

        // Recalculate target directory with PR branch name
        const prTargetDir = prBranchName
          ? getTargetDirectory(workspace, parsed, prBranchName, defaultBranch)
          : targetDir;

        // Check if target already exists (with new path)
        if (fs.existsSync(prTargetDir) && isGitRepo(prTargetDir)) {
          log(chalk.green(`✓ Directory already exists: ${prTargetDir}`));
          console.log(prTargetDir);
          return;
        }

        log(
          chalk.yellow(
            `  Creating worktree for PR #${parsed.identifier}${prBranchName ? ` (${prBranchName})` : ""}...`,
          ),
        );

        // Create a detached worktree first, then checkout PR
        const result = createWorktree(mainRepoDir, prTargetDir, "HEAD", false);
        if (!result.success) {
          log(chalk.red(`  Failed to create worktree: ${result.error}`));
          process.exit(1);
        }

        log(chalk.yellow(`  Checking out PR #${parsed.identifier}...`));
        const prResult = checkoutPR(prTargetDir, parsed.identifier!);
        if (!prResult.success) {
          log(chalk.red(`  Failed to checkout PR: ${prResult.error}`));
          process.exit(1);
        }
        detectAndRunInit(prTargetDir);
        writeMetadata(prTargetDir, {
          originalUrl: inputUrl,
          originType,
          mapped: isMapped,
          mappedUrl: isMapped ? url : undefined,
          type: "pr",
          org: parsed.org,
          repo: parsed.repo,
          identifier: parsed.identifier,
          branch: prBranchName || `pr-${parsed.identifier}`,
          createdAt: new Date().toISOString(),
        });
        log(chalk.green(`✓ Ready: ${prTargetDir}`));
        finalDir = prTargetDir;
        break;
      }

      case "issue": {
        const issueBranch = customBranch || `issue-${parsed.identifier}`;
        const remoteExists = remoteBranchExists(mainRepoDir, issueBranch);
        const localExists = localBranchExists(mainRepoDir, issueBranch);

        log(
          chalk.yellow(`  Creating worktree for Issue #${parsed.identifier}`),
        );

        if (remoteExists || localExists) {
          const branchRef = remoteExists
            ? `origin/${issueBranch}`
            : issueBranch;
          const result = createWorktree(
            mainRepoDir,
            targetDir,
            branchRef,
            false,
          );
          if (!result.success) {
            if (result.error?.includes("already used by worktree")) {
              const match = result.error.match(
                /already used by worktree at '([^']+)'/,
              );
              if (match) {
                const existingDir = match[1];
                log(chalk.yellow(`  Branch already in use at: ${existingDir}`));
                log(chalk.green("✓ Opening existing worktree"));
                console.log(existingDir);
                return;
              }
            }
            log(chalk.red(`  Failed: ${result.error}`));
            process.exit(1);
          }
        } else {
          const defaultBranch = getDefaultBranch(mainRepoDir);
          const result = createWorktree(
            mainRepoDir,
            targetDir,
            issueBranch,
            true,
            defaultBranch,
          );
          if (!result.success) {
            log(chalk.red(`  Failed: ${result.error}`));
            process.exit(1);
          }
        }
        detectAndRunInit(targetDir);
        writeMetadata(targetDir, {
          originalUrl: inputUrl,
          originType,
          mapped: isMapped,
          mappedUrl: isMapped ? url : undefined,
          type: "issue",
          org: parsed.org,
          repo: parsed.repo,
          identifier: parsed.identifier,
          branch: issueBranch,
          createdAt: new Date().toISOString(),
        });
        log(chalk.green(`✓ Ready: ${targetDir}`));
        finalDir = targetDir;
        break;
      }

      case "tag": {
        log(chalk.yellow(`  Creating worktree for tag: ${parsed.identifier}`));

        const result = createWorktree(
          mainRepoDir,
          targetDir,
          parsed.identifier!,
          false,
        );
        if (!result.success) {
          log(chalk.red(`  Failed: ${result.error}`));
          process.exit(1);
        }
        detectAndRunInit(targetDir);
        writeMetadata(targetDir, {
          originalUrl: inputUrl,
          originType,
          mapped: isMapped,
          mappedUrl: isMapped ? url : undefined,
          type: "tag",
          org: parsed.org,
          repo: parsed.repo,
          identifier: parsed.identifier,
          branch: parsed.identifier!,
          createdAt: new Date().toISOString(),
        });
        log(chalk.green(`✓ Ready: ${targetDir}`));
        finalDir = targetDir;
        break;
      }
    }

    // Output target directory to stdout (captured by wrapper script)
    if (finalDir) {
      console.log(finalDir);
    }
  });

  return cmd;
}
