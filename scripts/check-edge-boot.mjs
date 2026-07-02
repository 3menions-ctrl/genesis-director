#!/usr/bin/env node
/**
 * check-edge-boot — catch the class of edge-function bug that crashes the Deno
 * isolate ON BOOT, before it ships.
 *
 * WHY THIS EXISTS: on 2026-07-02 `mode-router` — the Studio create/render entry
 * point — 503'd in production with
 *   "Uncaught SyntaxError: Identifier 'buildProductionRequest' has already been
 *    declared"
 * (the same symbol imported twice). Every create request failed; no user could
 * make a video. The repo's CI "typecheck" is `tsc` on the FRONTEND only — the
 * edge functions (Deno) were never checked at all, so this had zero coverage.
 * `deno check` DOES catch it (TS2300 Duplicate identifier), so this script runs
 * `deno check` on every function entrypoint and FAILS the build on the
 * boot-fatal error classes.
 *
 * It deliberately does NOT fail on the whole `deno check` output — the functions
 * carry a large pre-existing baseline of harmless SupabaseClient-generic noise
 * (the `@supabase/supabase-js` types resolve to `never` under the pinned Deno
 * std). Requiring a fully-clean check would be perpetually red and useless.
 * Instead it fails ONLY on errors that actually crash the isolate on boot:
 * duplicate/redeclared identifiers, missing names, and syntax errors.
 *
 * Usage:  node scripts/check-edge-boot.mjs
 * Requires the `deno` binary on PATH (CI installs it).
 */
import { readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const FUNCTIONS_DIR = "supabase/functions";

// Error signatures that mean the isolate CRASHES ON BOOT — the module fails to
// parse/eval, so EVERY request 503s (like the 2026-07-02 mode-router outage).
// Deliberately NARROW: these are parse/binding-level, not "this name might be
// undefined at runtime" (TS2304 Cannot-find-name is excluded — it's a scoping/
// type-resolution class that's prone to deno-check false positives and only
// errors when the code path actually runs, not on boot).
const BOOT_FATAL = [
  /Duplicate identifier/i,           // TS2300 — the exact outage (double import)
  /Cannot redeclare/i,               // TS2451 — block-scoped redeclaration
  /has already been declared/i,      // isolate SyntaxError text
  /Cannot find module/i,             // TS2307 — bad import path → boot fails
  /Expression expected/i,            // syntax
  /';' expected/i,                   // syntax
  /Declaration or statement expected/i, // syntax
  /is not a module/i,
];

function denoAvailable() {
  try { execSync("deno --version", { stdio: "ignore" }); return true; }
  catch { return false; }
}

if (!denoAvailable()) {
  console.error("[check-edge-boot] `deno` not found on PATH — skipping (install deno in CI).");
  process.exit(0); // don't block if the tool is genuinely absent; CI installs it
}

const dirs = readdirSync(FUNCTIONS_DIR).filter((d) => {
  const p = join(FUNCTIONS_DIR, d);
  return d !== "_shared" && statSync(p).isDirectory() && existsSync(join(p, "index.ts"));
});

let failed = 0;
const failures = [];
for (const d of dirs) {
  const entry = join(FUNCTIONS_DIR, d, "index.ts");
  let out = "";
  try {
    execSync(`deno check ${entry}`, { stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    out = `${e.stdout ?? ""}${e.stderr ?? ""}`;
  }
  if (!out) continue;
  const fatal = out
    .split("\n")
    .filter((line) => BOOT_FATAL.some((re) => re.test(line)));
  if (fatal.length) {
    failed++;
    failures.push({ fn: d, lines: [...new Set(fatal)].slice(0, 5) });
  }
}

if (failed) {
  console.error(`\n[check-edge-boot] ❌ ${failed} function(s) have BOOT-FATAL errors:\n`);
  for (const f of failures) {
    console.error(`  ${f.fn}/index.ts`);
    for (const l of f.lines) console.error(`      ${l.trim()}`);
  }
  console.error(`\nThese crash the Deno isolate on boot (503 for every request). Fix before deploy.`);
  process.exit(1);
}

console.log(`[check-edge-boot] ✓ ${dirs.length} edge functions — no boot-fatal errors.`);
