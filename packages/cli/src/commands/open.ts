import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { parseProtocolUrl, getTargetDirectory } from '../utils/url-parser.js';
import { loadGlobalConfig } from '../utils/config.js';
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
  openInIde,
  isGitRepo,
} from '../utils/git-ops.js';
import { detectAndRunInit } from '../utils/auto-init.js';
import { loadWorkspaceConfig, applyMappings } from '../utils/mappings.js';
import { writeMetadata, inferOriginType, type GhlpMetadata } from '../utils/metadata.js';

export function createUrlHandler(): Command {
  const cmd = new Command('open');
  cmd.argument('<url>', 'Protocol URL (ghlp://org/repo/...)');
  cmd.option('-w, --workspace <path>', 'Override default workspace directory');
  cmd.description('Open a GitHub URL in local workspace');
  cmd.action(async (inputUrl: string, options: { workspace?: string }) => {
    let workspace: string;

    if (options.workspace) {
      workspace = options.workspace;
    } else {
      const globalConfig = loadGlobalConfig();
      if (!globalConfig) {
        console.log(chalk.red('Configuration not found. Run `ghlp init` first or use -w <workspace>.'));
        process.exit(1);
      }
      workspace = globalConfig.workspace;
    }

    // Load workspace config
    const wsConfig = loadWorkspaceConfig(workspace);

    // Apply URL mappings if configured
    let url = inputUrl;
    let customBranch: string | undefined;
    
    const result = applyMappings(inputUrl, wsConfig.mappings);
    const isMapped = result.url !== inputUrl;
    
    // Determine originType: from mapping config, or infer from original URL
    const originType = isMapped 
      ? (result.originType || 'external')
      : inferOriginType(inputUrl);
    
    if (isMapped) {
      console.log(chalk.gray(`  Mapped: ${inputUrl}`));
      console.log(chalk.gray(`       → ${result.url}`));
      url = result.url;
      customBranch = result.branch;
    }

    const parsed = parseProtocolUrl(url);
    if (!parsed) {
      console.log(chalk.red(`Invalid URL: ${url}`));
      process.exit(1);
    }

    console.log(chalk.cyan(`\n📂 Opening ${parsed.type}: ${parsed.org}/${parsed.repo}`));
    if (parsed.identifier) {
      const typeLabel = parsed.type === 'branch' ? 'Branch' : parsed.type === 'pr' ? 'PR' : parsed.type === 'tag' ? 'Tag' : 'Issue';
      console.log(chalk.gray(`   ${typeLabel}: ${parsed.identifier}`));
    }
    if (customBranch) {
      console.log(chalk.gray(`   Custom branch: ${customBranch}`));
    }
    console.log('');

    const repoBaseDir = path.join(workspace, parsed.org, parsed.repo);

    // Find or create main repo first to get default branch
    let mainRepoDir = findMainRepo(repoBaseDir);
    let defaultBranch = 'main';

    if (!mainRepoDir) {
      console.log(chalk.yellow('  Cloning repository...'));
      const tempMainDir = path.join(repoBaseDir, '__temp_clone__');
      const cloneResult = cloneRepo(parsed.org, parsed.repo, tempMainDir);
      if (!cloneResult.success) {
        console.log(chalk.red(`  Failed to clone: ${cloneResult.error}`));
        process.exit(1);
      }
      // Get default branch and rename directory
      defaultBranch = getDefaultBranch(tempMainDir);
      const actualMainDir = path.join(repoBaseDir, defaultBranch);
      fs.renameSync(tempMainDir, actualMainDir);
      mainRepoDir = actualMainDir;
      console.log(chalk.green('  ✓ Repository cloned'));
    } else {
      defaultBranch = getDefaultBranch(mainRepoDir);
      console.log(chalk.gray('  Fetching latest changes...'));
      fetchRepo(mainRepoDir);
    }

    const targetDir = getTargetDirectory(workspace, parsed, customBranch, defaultBranch);

    // Check if target already exists
    if (fs.existsSync(targetDir) && isGitRepo(targetDir)) {
      console.log(chalk.green(`✓ Directory already exists: ${targetDir}`));
      if (wsConfig.autoOpenIde) {
        console.log(chalk.cyan(`  Opening in ${wsConfig.autoOpenIde}...`));
        openInIde(targetDir, wsConfig.autoOpenIde);
      }
      return;
    }

    // Handle based on type
    switch (parsed.type) {
      case 'repo': {
        // Main repo already exists at mainRepoDir
        detectAndRunInit(mainRepoDir);
        writeMetadata(mainRepoDir, {
          originalUrl: inputUrl,
          originType,
          mapped: isMapped,
          mappedUrl: isMapped ? url : undefined,
          type: 'repo',
          org: parsed.org,
          repo: parsed.repo,
          branch: getDefaultBranch(mainRepoDir),
          createdAt: new Date().toISOString(),
        });
        console.log(chalk.green(`✓ Ready: ${mainRepoDir}`));
        if (wsConfig.autoOpenIde) {
          openInIde(mainRepoDir, wsConfig.autoOpenIde);
        }
        break;
      }

      case 'branch': {
        if (targetDir === mainRepoDir) {
          // Same as main
          console.log(chalk.green(`✓ Ready: ${mainRepoDir}`));
        } else {
          console.log(chalk.yellow(`  Creating worktree for branch: ${parsed.identifier}`));
          const result = createWorktree(mainRepoDir, targetDir, parsed.identifier!, false);
          if (!result.success) {
            console.log(chalk.red(`  Failed: ${result.error}`));
            process.exit(1);
          }
          detectAndRunInit(targetDir);
          writeMetadata(targetDir, {
            originalUrl: inputUrl,
            originType,
            mapped: isMapped,
            mappedUrl: isMapped ? url : undefined,
            type: 'branch',
            org: parsed.org,
            repo: parsed.repo,
            identifier: parsed.identifier,
            branch: parsed.identifier!,
            createdAt: new Date().toISOString(),
          });
          console.log(chalk.green(`✓ Ready: ${targetDir}`));
        }
        if (wsConfig.autoOpenIde) {
          openInIde(targetDir, wsConfig.autoOpenIde);
        }
        break;
      }

      case 'pr': {
        // Get PR branch name first
        console.log(chalk.yellow(`  Getting PR #${parsed.identifier} info...`));
        const prBranchName = getPRBranchName(parsed.org, parsed.repo, parsed.identifier!);
        
        // Recalculate target directory with PR branch name
        const prTargetDir = prBranchName 
          ? getTargetDirectory(workspace, parsed, prBranchName, defaultBranch)
          : targetDir;
        
        // Check if target already exists (with new path)
        if (fs.existsSync(prTargetDir) && isGitRepo(prTargetDir)) {
          console.log(chalk.green(`✓ Directory already exists: ${prTargetDir}`));
          if (wsConfig.autoOpenIde) {
            openInIde(prTargetDir, wsConfig.autoOpenIde);
          }
          return;
        }
        
        console.log(chalk.yellow(`  Creating worktree for PR #${parsed.identifier}${prBranchName ? ` (${prBranchName})` : ''}...`));
        
        // Create a detached worktree first, then checkout PR
        const result = createWorktree(mainRepoDir, prTargetDir, 'HEAD', false);
        if (!result.success) {
          console.log(chalk.red(`  Failed to create worktree: ${result.error}`));
          process.exit(1);
        }

        // Checkout PR in the worktree
        console.log(chalk.yellow(`  Checking out PR #${parsed.identifier}...`));
        const prResult = checkoutPR(prTargetDir, parsed.identifier!);
        if (!prResult.success) {
          console.log(chalk.red(`  Failed to checkout PR: ${prResult.error}`));
          process.exit(1);
        }
        detectAndRunInit(prTargetDir);
        writeMetadata(prTargetDir, {
          originalUrl: inputUrl,
          originType,
          mapped: isMapped,
          mappedUrl: isMapped ? url : undefined,
          type: 'pr',
          org: parsed.org,
          repo: parsed.repo,
          identifier: parsed.identifier,
          branch: prBranchName || `pr-${parsed.identifier}`,
          createdAt: new Date().toISOString(),
        });
        console.log(chalk.green(`✓ Ready: ${prTargetDir}`));
        if (wsConfig.autoOpenIde) {
          openInIde(prTargetDir, wsConfig.autoOpenIde);
        }
        break;
      }

      case 'issue': {
        // Use custom branch name from mapping, or default to issue-{number}
        const issueBranch = customBranch || `issue-${parsed.identifier}`;
        const remoteExists = remoteBranchExists(mainRepoDir, issueBranch);
        const localExists = localBranchExists(mainRepoDir, issueBranch);

        console.log(chalk.yellow(`  Creating worktree for Issue #${parsed.identifier}`));
        
        if (remoteExists || localExists) {
          // Branch exists, create worktree using it
          const branchRef = remoteExists ? `origin/${issueBranch}` : issueBranch;
          const result = createWorktree(mainRepoDir, targetDir, branchRef, false);
          if (!result.success) {
            // Check if branch is already used by another worktree
            if (result.error?.includes('already used by worktree')) {
              const match = result.error.match(/already used by worktree at '([^']+)'/);
              if (match) {
                const existingDir = match[1];
                console.log(chalk.yellow(`  Branch already in use at: ${existingDir}`));
                console.log(chalk.green(`✓ Opening existing worktree`));
                if (wsConfig.autoOpenIde) {
                  openInIde(existingDir, wsConfig.autoOpenIde);
                }
                return;
              }
            }
            console.log(chalk.red(`  Failed: ${result.error}`));
            process.exit(1);
          }
        } else {
          // Create new branch based on default branch
          const defaultBranch = getDefaultBranch(mainRepoDir);
          const result = createWorktree(mainRepoDir, targetDir, issueBranch, true, defaultBranch);
          if (!result.success) {
            console.log(chalk.red(`  Failed: ${result.error}`));
            process.exit(1);
          }
        }
        detectAndRunInit(targetDir);
        writeMetadata(targetDir, {
          originalUrl: inputUrl,
          originType,
          mapped: isMapped,
          mappedUrl: isMapped ? url : undefined,
          type: 'issue',
          org: parsed.org,
          repo: parsed.repo,
          identifier: parsed.identifier,
          branch: issueBranch,
          createdAt: new Date().toISOString(),
        });
        console.log(chalk.green(`✓ Ready: ${targetDir}`));
        if (wsConfig.autoOpenIde) {
          openInIde(targetDir, wsConfig.autoOpenIde);
        }
        break;
      }

      case 'tag': {
        console.log(chalk.yellow(`  Creating worktree for tag: ${parsed.identifier}`));
        
        // Tags are like branches but read-only, checkout the tag
        const result = createWorktree(mainRepoDir, targetDir, parsed.identifier!, false);
        if (!result.success) {
          console.log(chalk.red(`  Failed: ${result.error}`));
          process.exit(1);
        }
        detectAndRunInit(targetDir);
        writeMetadata(targetDir, {
          originalUrl: inputUrl,
          originType,
          mapped: isMapped,
          mappedUrl: isMapped ? url : undefined,
          type: 'tag',
          org: parsed.org,
          repo: parsed.repo,
          identifier: parsed.identifier,
          branch: parsed.identifier!,
          createdAt: new Date().toISOString(),
        });
        console.log(chalk.green(`✓ Ready: ${targetDir}`));
        if (wsConfig.autoOpenIde) {
          openInIde(targetDir, wsConfig.autoOpenIde);
        }
        break;
      }
    }

    console.log('');
  });

  return cmd;
}
