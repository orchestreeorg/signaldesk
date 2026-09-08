import { spawn } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { isVercel } from "./env";

function repoRoot(): string {
  return process.cwd().endsWith("dashboard") ? resolve(process.cwd(), "..") : process.cwd();
}

function pidPath(): string {
  return resolve(repoRoot(), ".worker.pid");
}

export function canSpawnWorker(): boolean {
  return !isVercel();
}

export function startLocalWorker(): { pid?: number; already?: boolean } {
  if (!canSpawnWorker()) {
    throw new Error("Vercel cannot run the worker. Start pnpm worker on a host that shares REDIS_URL.");
  }
  const existing = readPid();
  if (existing && isAlive(existing)) {
    return { pid: existing, already: true };
  }
  const child = spawn("pnpm", ["worker"], {
    cwd: repoRoot(),
    env: process.env,
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  if (child.pid) {
    writeFileSync(pidPath(), String(child.pid));
  }
  return { pid: child.pid };
}

export function stopLocalWorker(): { stopped: boolean } {
  const pid = readPid();
  if (!pid) {
    return { stopped: false };
  }
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    // already gone
  }
  try {
    unlinkSync(pidPath());
  } catch {
    // ignore
  }
  return { stopped: true };
}

function readPid(): number | undefined {
  if (!existsSync(pidPath())) {
    return undefined;
  }
  const value = Number(readFileSync(pidPath(), "utf8").trim());
  return Number.isFinite(value) ? value : undefined;
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
