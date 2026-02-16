import { Command } from "commander";
import chalk from "chalk";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";
import { execSync } from "node:child_process";

export function createRegisterCommand(): Command {
  const cmd = new Command("register");
  cmd.description("Register ghlp:// protocol handler");
  cmd.action(async () => {
    const platform = os.platform();

    console.log(chalk.cyan("\n🔗 Registering ghlp:// protocol handler\n"));

    switch (platform) {
      case "win32":
        registerWindows();
        break;
      case "darwin":
        registerMacOS();
        break;
      case "linux":
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
  const platform = os.platform();
  const whichCmd = platform === "win32" ? "where ghlp" : "which ghlp";

  try {
    const result = execSync(whichCmd, { encoding: "utf-8" }).trim();
    // `where` on Windows may return multiple lines, take the first
    return result.split("\n")[0].trim();
  } catch {
    // Fallback: guess from npm prefix
    const npmGlobalBin = execSync("npm config get prefix", {
      encoding: "utf-8",
    }).trim();
    if (platform === "win32") {
      return path.join(npmGlobalBin, "ghlp.cmd");
    }
    return path.join(npmGlobalBin, "bin", "ghlp");
  }
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
@="\\"${exePath.replace(/\\/g, "\\\\")}\\\" open \\"%1\\""
`;

  const regFile = path.join(os.tmpdir(), "ghlp-register.reg");
  // Write with UTF-16 LE BOM for Windows registry
  const BOM = "\uFEFF";
  fs.writeFileSync(regFile, BOM + regContent, "utf16le");

  console.log(chalk.yellow("  Creating registry entries..."));
  console.log(chalk.gray(`  Registry file: ${regFile}`));

  try {
    // Import registry file
    execSync(`reg import "${regFile}"`, { stdio: "pipe" });
    console.log(chalk.green("✓ Protocol registered successfully!\n"));
    console.log("You can now click ghlp:// links in your browser.");
  } catch (err: any) {
    console.log(
      chalk.yellow("\n  Manual registration required (needs admin):"),
    );
    console.log(`  1. Run: reg import "${regFile}"`);
    console.log("  2. Or double-click the .reg file");
  }
}

function registerMacOS(): void {
  const exePath = getExecutablePath();
  const appDir = path.join(os.homedir(), "Applications", "GHLocalPilot.app");

  // Remove old app bundle if exists
  if (fs.existsSync(appDir)) {
    fs.rmSync(appDir, { recursive: true, force: true });
  }

  // Compile AppleScript into a real .app bundle so it can receive Apple Events
  // Runs ghlp open in background — terminal handling is done by ghlp itself via config
  const script = `on open location theURL
  do shell script "export PATH=/opt/homebrew/bin:/usr/local/bin:$PATH && \\"${exePath}\\" open " & quoted form of theURL & " &> /dev/null &"
end open location`;

  const tmpScript = path.join(os.tmpdir(), "ghlp-handler.applescript");
  fs.writeFileSync(tmpScript, script, "utf-8");

  console.log(chalk.yellow("  Compiling AppleScript app bundle..."));
  try {
    execSync(`osacompile -o "${appDir}" "${tmpScript}"`, { stdio: "pipe" });
  } catch (err: any) {
    console.log(chalk.red(`  Failed to compile: ${err.message}`));
    process.exit(1);
  } finally {
    fs.unlinkSync(tmpScript);
  }

  // Patch Info.plist to add URL scheme and bundle identifier
  const plistPath = path.join(appDir, "Contents", "Info.plist");
  let plist = fs.readFileSync(plistPath, "utf-8");
  const urlTypes = `\t<key>CFBundleIdentifier</key>
\t<string>com.white-dragon-tools.github-local-pilot</string>
\t<key>CFBundleURLTypes</key>
\t<array>
\t\t<dict>
\t\t\t<key>CFBundleURLName</key>
\t\t\t<string>GitHub Local Pilot Protocol</string>
\t\t\t<key>CFBundleURLSchemes</key>
\t\t\t<array>
\t\t\t\t<string>ghlp</string>
\t\t\t</array>
\t\t</dict>
\t</array>`;

  // Insert before the final closing </dict></plist>
  plist = plist.replace(
    /\n<\/dict>\s*<\/plist>/,
    "\n" + urlTypes + "\n</dict>\n</plist>",
  );
  fs.writeFileSync(plistPath, plist, "utf-8");

  // Register with Launch Services
  try {
    execSync(
      `/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -R -f "${appDir}"`,
      { stdio: "pipe" },
    );
    console.log(chalk.green("✓ Protocol registered successfully!\n"));
    console.log(`App bundle created at: ${appDir}`);
    console.log("You can now click ghlp:// links in your browser.");
  } catch {
    console.log(
      chalk.yellow(
        "\n  App bundle created but registration may need manual step:",
      ),
    );
    console.log(chalk.cyan(`  open "${appDir}"\n`));
  }
}

function registerLinux(): void {
  const exePath = getExecutablePath();
  const desktopDir = path.join(os.homedir(), ".local", "share", "applications");
  const desktopFile = path.join(desktopDir, "github-local-pilot.desktop");

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

  fs.writeFileSync(desktopFile, desktopContent, "utf-8");

  try {
    execSync(
      `xdg-mime default github-local-pilot.desktop x-scheme-handler/ghlp`,
      {
        stdio: "pipe",
      },
    );
    console.log(chalk.green("✓ Protocol registered successfully!\n"));
  } catch {
    console.log(chalk.yellow("  Desktop file created. Run manually:"));
    console.log(
      chalk.cyan(
        `    xdg-mime default github-local-pilot.desktop x-scheme-handler/ghlp\n`,
      ),
    );
  }
}
