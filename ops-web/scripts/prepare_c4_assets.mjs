#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const opsRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(opsRoot, "..");

const requiredViews = ["oap_context", "oap_containers", "db_rpc_boundary", "security_access"];
const c4OutDir = path.join(opsRoot, "public", "c4");
const statusFile = path.join(opsRoot, "src", "generated", "c4-export-status.json");

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function clearPng(dir) {
  await fs.rm(dir, { recursive: true, force: true });
  await ensureDir(dir);
}

function commandOutput(error) {
  const stdout = Buffer.isBuffer(error?.stdout) ? error.stdout.toString("utf8") : String(error?.stdout || "");
  const stderr = Buffer.isBuffer(error?.stderr) ? error.stderr.toString("utf8") : String(error?.stderr || "");
  return `${stdout}\n${stderr}`.trim();
}

async function writeStatus(status) {
  await ensureDir(path.dirname(statusFile));
  await fs.writeFile(statusFile, `${JSON.stringify(status, null, 2)}\n`, "utf8");
}

async function main() {
  const status = {
    validatedAt: null,
    exportedAt: null,
    exportError: null,
    requiredViews,
  };

  try {
    execFileSync("npx", ["-y", "likec4@latest", "validate", "--ignore-layout", "docs"], {
      cwd: repoRoot,
      stdio: "pipe",
    });
    status.validatedAt = new Date().toISOString();
  } catch (error) {
    status.exportError = `validate_failed: ${commandOutput(error)}`;
    await writeStatus(status);
    throw new Error(status.exportError);
  }

  await clearPng(c4OutDir);

  try {
    const args = ["-y", "likec4@latest", "export", "png", "--flat", "-o", c4OutDir];
    for (const viewId of requiredViews) {
      args.push("-f", viewId);
    }
    args.push("docs");

    execFileSync("npx", args, {
      cwd: repoRoot,
      stdio: "pipe",
    });
    status.exportedAt = new Date().toISOString();
  } catch (error) {
    status.exportError = `export_failed: ${commandOutput(error)}`;
  }

  await writeStatus(status);
  process.stdout.write("[ops-web] prepared C4 assets\n");
}

main().catch((error) => {
  process.stderr.write(`[ops-web] C4 prepare failed: ${String(error)}\n`);
  process.exit(1);
});
