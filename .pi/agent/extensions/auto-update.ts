import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { exec } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

// ── Config ──────────────────────────────────────────────────────────
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // once per day
const STATE_FILE = join(homedir(), ".pi", "agent", "auto-update-state.json");
// ─────────────────────────────────────────────────────────────────────

interface State {
  lastCheck: number; // epoch ms
  skippedVersion?: string;
}

async function loadState(): Promise<State> {
  try {
    return JSON.parse(await readFile(STATE_FILE, "utf-8"));
  } catch {
    return { lastCheck: 0 };
  }
}

async function saveState(state: State): Promise<void> {
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

/**
 * Spawn a detached `pi update --self` so it runs in the background
 * without blocking the current pi process.
 */
function runUpdateInBackground(): void {
  // Find the node binary and pi script path
  const nodeBin = process.execPath;
  const piScript = process.argv[1]; // e.g. /opt/homebrew/bin/pi

  const child = exec(
    `"${nodeBin}" "${piScript}" update --self`,
    {
      detached: true,
      stdio: "ignore",
      env: { ...process.env, PI_SKIP_VERSION_CHECK: "1" },
    },
    (err, _stdout, stderr) => {
      if (err && !err.killed) {
        console.error("[auto-update] pi update failed:", err.message);
        if (stderr) console.error("[auto-update] stderr:", stderr);
      }
    },
  );

  // Detach so the parent can exit independently
  child.unref();
}

/**
 * Fetch current version from npm (lightweight, no auth needed).
 */
async function fetchLatestVersion(): Promise<string | null> {
  try {
    const res = await fetch(
      "https://registry.npmjs.org/@earendil-works/pi-coding-agent/latest",
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { version: string };
    return data.version;
  } catch {
    return null;
  }
}

/**
 * Compare two semver strings. Returns 1 if a > b, -1 if a < b, 0 if equal.
 */
function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    // Only check when a real session starts (not on reload)
    if (_event.reason !== "startup" && _event.reason !== "new") return;

    const state = await loadState();
    const now = Date.now();

    // Respect check interval
    if (now - state.lastCheck < CHECK_INTERVAL_MS) return;

    // Update last-check timestamp immediately to avoid re-checks
    state.lastCheck = now;
    await saveState(state);

    // Fetch latest version
    const latest = await fetchLatestVersion();
    if (!latest) return; // network unavailable, try again next time

    const current = process.env.PI_CODING_AGENT_VERSION ?? "0.0.0";
    const cmp = compareVersions(latest, current);

    if (cmp <= 0) {
      // Already up-to-date or same version
      return;
    }

    // If we already skipped this version, don't auto-update
    if (state.skippedVersion === latest) return;

    // Notify user
    ctx.ui.notify(
      `Auto-updating pi: ${current} → ${latest} (next startup)`,
      "info",
    );

    // Run update in background
    runUpdateInBackground();

    // Save that we attempted this version
    state.skippedVersion = latest;
    await saveState(state);
  });
}
