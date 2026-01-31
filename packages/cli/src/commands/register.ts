import { Command } from 'commander';
import chalk from 'chalk';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { execSync } from 'node:child_process';

export function createRegisterCommand(): Command {
  const cmd = new Command('register');
  cmd.description('Register ghlp:// protocol handler');
  cmd.action(async () => {
    const platform = os.platform();

    console.log(chalk.cyan('\n🔗 Registering ghlp:// protocol handler\n'));

    switch (platform) {
      case 'win32':
        registerWindows();
        break;
      case 'darwin':
        registerMacOS();
        break;
      case 'linux':
        registerLinux();
        break;
      default:
        console.log(chalk.red(`Unsupported platform: ${platform}`));
        process.exit(1);
    }
  });

  return cmd;
}

function getExecutablePath(): string {
  // Get the path to the ghlp executable
  const npmGlobalBin = execSync('npm config get prefix', { encoding: 'utf-8' }).trim();
  const platform = os.platform();
  
  if (platform === 'win32') {
    return path.join(npmGlobalBin, 'ghlp.cmd');
  }
  return path.join(npmGlobalBin, 'bin', 'ghlp');
}

function registerWindows(): void {
  const exePath = getExecutablePath();
  
  // Create .reg file content
  const regContent = `Windows Registry Editor Version 5.00

[HKEY_CURRENT_USER\\Software\\Classes\\ghlp]
@="URL:GitHub Local Pilot Protocol"
"URL Protocol"=""

[HKEY_CURRENT_USER\\Software\\Classes\\ghlp\\shell]

[HKEY_CURRENT_USER\\Software\\Classes\\ghlp\\shell\\open]

[HKEY_CURRENT_USER\\Software\\Classes\\ghlp\\shell\\open\\command]
@="\\"${exePath.replace(/\\/g, '\\\\')}\\\" open \\"%1\\""
`;

  const regFile = path.join(os.tmpdir(), 'ghlp-register.reg');
  // Write with UTF-16 LE BOM for Windows registry
  const BOM = '\uFEFF';
  fs.writeFileSync(regFile, BOM + regContent, 'utf16le');

  console.log(chalk.yellow('  Creating registry entries...'));
  console.log(chalk.gray(`  Registry file: ${regFile}`));
  
  try {
    // Import registry file
    execSync(`reg import "${regFile}"`, { stdio: 'pipe' });
    console.log(chalk.green('✓ Protocol registered successfully!\n'));
    console.log('You can now click ghlp:// links in your browser.');
  } catch (err: any) {
    console.log(chalk.yellow('\n  Manual registration required (needs admin):'));
    console.log(`  1. Run: reg import "${regFile}"`);
    console.log('  2. Or double-click the .reg file');
  }
}

function registerMacOS(): void {
  console.log(chalk.yellow('  macOS protocol registration requires app bundle.'));
  console.log(chalk.gray('\n  For now, please use the CLI directly:'));
  console.log(chalk.cyan('    ghlp open ghlp://org/repo/issues/123\n'));
}

function registerLinux(): void {
  const exePath = getExecutablePath();
  const desktopDir = path.join(os.homedir(), '.local', 'share', 'applications');
  const desktopFile = path.join(desktopDir, 'github-local-pilot.desktop');

  if (!fs.existsSync(desktopDir)) {
    fs.mkdirSync(desktopDir, { recursive: true });
  }

  const desktopContent = `[Desktop Entry]
Name=GitHub Local Pilot
Exec=${exePath} open %u
Type=Application
NoDisplay=true
MimeType=x-scheme-handler/ghlp;
`;

  fs.writeFileSync(desktopFile, desktopContent, 'utf-8');

  try {
    execSync(`xdg-mime default github-local-pilot.desktop x-scheme-handler/ghlp`, {
      stdio: 'pipe',
    });
    console.log(chalk.green('✓ Protocol registered successfully!\n'));
  } catch {
    console.log(chalk.yellow('  Desktop file created. Run manually:'));
    console.log(chalk.cyan(`    xdg-mime default github-local-pilot.desktop x-scheme-handler/ghlp\n`));
  }
}
