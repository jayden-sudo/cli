import { Command } from "commander";
import { execSync } from "node:child_process";
import { VERSION } from "../version";
import { outputResult, outputError } from "../utils/display";
import ora from "ora";
import chalk from "chalk";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PACKAGE_NAME = "@elytro/cli";
const NPM_REGISTRY_URL = `https://registry.npmjs.org/${PACKAGE_NAME}/latest`;

interface NpmPackageInfo {
  version: string;
  name: string;
}

/**
 * Fetch the latest published version from the npm registry.
 */
async function fetchLatestVersion(): Promise<string> {
  const res = await fetch(NPM_REGISTRY_URL);
  if (!res.ok) {
    throw new Error(`npm registry returned ${res.status}`);
  }
  const data = (await res.json()) as NpmPackageInfo;
  return data.version;
}

/**
 * Compare two semver strings.  Returns:
 *   -1  if a < b
 *    0  if a === b
 *    1  if a > b
 */
function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return -1;
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return 1;
  }
  return 0;
}

/**
 * Detect which package manager installed this CLI.
 *
 * Strategy:
 *   1. Resolve the real filesystem path of the running script (follows symlinks).
 *   2. Match against known global-install directory patterns for each manager.
 *   3. Fall back to `npm_config_user_agent` if the path is ambiguous.
 *   4. Default to 'npm' as the safest last resort.
 */
function detectPackageManager(): "npm" | "yarn" | "pnpm" | "bun" {
  // Resolve the real path of the running script (follows symlinks)
  try {
    const scriptPath = realpathSync(fileURLToPath(import.meta.url));
    if (scriptPath.includes("/.bun/")) return "bun";
    if (scriptPath.includes("/pnpm/") || scriptPath.includes("/pnpm-global/"))
      return "pnpm";
    if (scriptPath.includes("/yarn/global/")) return "yarn";
  } catch {
    // If path resolution fails, fall through to env-based detection
  }

  // Fallback: check npm_config_user_agent (set when run via package manager scripts)
  const ua = process.env.npm_config_user_agent ?? "";
  if (ua.startsWith("bun")) return "bun";
  if (ua.startsWith("pnpm")) return "pnpm";
  if (ua.startsWith("yarn")) return "yarn";

  return "npm";
}
/**
 * Build the install command for the detected package manager.
 */
function buildInstallCommand(pm: string, version: string): string {
  const pkg = `${PACKAGE_NAME}@${version}`;
  switch (pm) {
    case "yarn":
      return `yarn global add ${pkg}`;
    case "pnpm":
      return `pnpm add -g ${pkg}`;
    case "bun":
      return `bun add -g ${pkg}`;
    default:
      return `npm install -g ${pkg}`;
  }
}

/**
 * `elytro update` — Check for updates and optionally upgrade.
 *
 * Subcommands:
 *   check   — Check if a newer version is available (JSON output, no side effects)
 *   (none)  — Check and upgrade to latest if available
 */
export function registerUpdateCommand(program: Command): void {
  const updateCmd = program
    .command("update")
    .alias("upgrade")
    .description("Check for updates and upgrade to the latest version");

  // ── check ─────────────────────────────────────────────────────
  updateCmd
    .command("check")
    .description("Check if a newer version is available (no install)")
    .action(async () => {
      try {
        const latest = await fetchLatestVersion();
        const cmp = compareSemver(VERSION, latest);

        outputResult({
          currentVersion: VERSION,
          latestVersion: latest,
          updateAvailable: cmp < 0,
          ...(cmp < 0
            ? {
                upgradeCommand: buildInstallCommand(
                  detectPackageManager(),
                  latest,
                ),
              }
            : {}),
        });
      } catch (err) {
        outputError(
          -32000,
          `Failed to check for updates: ${(err as Error).message}`,
        );
      }
    });

  // ── default (upgrade) ─────────────────────────────────────────
  updateCmd.action(async () => {
    const spinner = ora("Checking for updates…").start();

    try {
      const latest = await fetchLatestVersion();
      const cmp = compareSemver(VERSION, latest);

      if (cmp >= 0) {
        spinner.succeed(chalk.green(`Already up to date (v${VERSION})`));
        outputResult({
          currentVersion: VERSION,
          latestVersion: latest,
          updateAvailable: false,
        });
        return;
      }

      spinner.text = `Updating ${chalk.gray(`v${VERSION}`)} → ${chalk.green(`v${latest}`)}…`;

      const pm = detectPackageManager();
      const cmd = buildInstallCommand(pm, latest);

      execSync(cmd, { stdio: "pipe" });

      spinner.succeed(chalk.green(`Updated to v${latest}`));
      outputResult({
        previousVersion: VERSION,
        currentVersion: latest,
        updateAvailable: false,
        packageManager: pm,
      });
    } catch (err) {
      spinner.fail("Update failed");
      outputError(-32000, `Update failed: ${(err as Error).message}`);
    }
  });
}
