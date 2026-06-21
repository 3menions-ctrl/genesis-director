#!/usr/bin/env bun
/**
 * check-edge-function-orphans — detect mismatches between
 * `supabase.functions.invoke(name, ...)` call sites in the frontend
 * and the edge functions on disk under `supabase/functions/`.
 *
 * Two failure modes the script catches:
 *
 *   1. INVOKED-BUT-MISSING — code calls `invoke("foo")` but no
 *      `supabase/functions/foo/index.ts` exists. At runtime that
 *      call returns a 404 the moment a user hits the code path —
 *      these are always production bugs.
 *
 *   2. ON-DISK-BUT-NEVER-INVOKED — an edge function exists on disk
 *      and is presumably deployed, but no frontend code calls it.
 *      These are either (a) dead deploys eating cold-start cost and
 *      attack surface, (b) edge functions invoked from other edge
 *      functions (legitimate), or (c) webhooks called from outside.
 *      The script lists them as informational so an owner can
 *      classify.
 *
 * Output:
 *   • Exits 0 with a clean report when every invocation resolves
 *     and the "dead" list is empty or expected.
 *   • Exits 1 on category-1 failures (always blocking).
 *   • Logs but doesn't fail on category-2 (informational).
 */

import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { resolve, join, dirname } from "path";
import { fileURLToPath } from "url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const SRC = resolve(REPO_ROOT, "src");
const FUNCTIONS_DIR = resolve(REPO_ROOT, "supabase/functions");

// Edge functions on disk that are LEGITIMATELY not invoked from the
// frontend. Keep this list small; every entry is a known intentional
// orphan (webhook, cron, fn-to-fn caller) with a one-line reason.
const KNOWN_BACKEND_ONLY = new Set<string>([
  // Stripe webhook — called by Stripe POSTs, not the frontend.
  "stripe-webhook",
  // BTCPay webhook — called by BTCPay server, not the frontend.
  "btcpay-webhook",
  // Replicate webhook — called by Replicate predictions completing.
  "replicate-webhook",
  // Cron-style jobs invoked by Supabase pg_cron, not the frontend.
  "pipeline-watchdog",
  "queue-watchdog",
  "credit-grant-cron",
  // Email / transactional callbacks.
  "auth-email-redirect",
  // Edge-to-edge: invoked by other edge functions.
  "seamless-stitcher",       // called by hollywood-pipeline + others
  "poll-replicate-prediction",
  "generate-single-clip",    // dispatched per shot from pipelines
  "upscale-video",           // post-bake step
  "_shared",                 // not a function — shared lib dir
]);

function* walkFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      yield* walkFiles(full);
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry) && !/\.(test|spec)\./.test(entry)) {
      yield full;
    }
  }
}

function listEdgeFunctions(): string[] {
  if (!existsSync(FUNCTIONS_DIR)) return [];
  return readdirSync(FUNCTIONS_DIR)
    .filter((name) => {
      if (name.startsWith(".") || name.startsWith("_")) return false;
      try {
        return statSync(join(FUNCTIONS_DIR, name)).isDirectory();
      } catch {
        return false;
      }
    });
}

function findInvocations(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  // Matches:  .functions.invoke("name", …)
  // Matches:  .functions.invoke('name', …)
  // Matches:  .functions.invoke(`name`, …) — template literal w/o interpolation
  // Skips dynamic names (variables) — they're caught by code review.
  const re = /\.functions\.invoke\(\s*['"`]([a-zA-Z0-9-]+)['"`]/g;
  for (const file of walkFiles(SRC)) {
    let src: string;
    try { src = readFileSync(file, "utf-8"); } catch { continue; }
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      const name = m[1];
      const arr = found.get(name) ?? [];
      arr.push(file.replace(REPO_ROOT + "/", ""));
      found.set(name, arr);
    }
  }
  return found;
}

export type OrphanReport = {
  invokedButMissing: Array<{ name: string; callSites: string[] }>;
  onDiskButUnused: string[];
  ok: boolean;
};

export function computeOrphans(): OrphanReport {
  const invocations = findInvocations();
  const onDisk = new Set(listEdgeFunctions());

  const invokedButMissing: Array<{ name: string; callSites: string[] }> = [];
  for (const [name, callSites] of invocations) {
    if (!onDisk.has(name)) {
      invokedButMissing.push({ name, callSites });
    }
  }

  const onDiskButUnused: string[] = [];
  for (const name of onDisk) {
    if (KNOWN_BACKEND_ONLY.has(name)) continue;
    if (!invocations.has(name)) onDiskButUnused.push(name);
  }
  onDiskButUnused.sort();

  return {
    invokedButMissing,
    onDiskButUnused,
    ok: invokedButMissing.length === 0,
  };
}

// CLI entry — only runs when this file is executed directly, not when
// imported by the test suite. `import.meta.main` is Bun-only; the
// `process.argv[1]` fallback works under Node + Vitest too.
const isCli = (() => {
  try {
    const m = (import.meta as { main?: boolean }).main;
    if (typeof m === "boolean") return m;
  } catch { /* not Bun */ }
  return fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? "");
})();
if (isCli) {
  const report = computeOrphans();
  if (report.invokedButMissing.length > 0) {
    console.error("\n❌ INVOKED BUT MISSING (404 risk):");
    for (const { name, callSites } of report.invokedButMissing) {
      console.error(`  • ${name}`);
      for (const site of callSites) console.error(`      ${site}`);
    }
  } else {
    console.log("\n✓ Every invoked function exists on disk.");
  }

  if (report.onDiskButUnused.length > 0) {
    console.log(`\n⚠ ON-DISK BUT NEVER INVOKED FROM FRONTEND (${report.onDiskButUnused.length}):`);
    console.log("  (informational — may be edge-to-edge or webhook callers)");
    for (const name of report.onDiskButUnused) console.log(`  • ${name}`);
  }

  process.exit(report.ok ? 0 : 1);
}
