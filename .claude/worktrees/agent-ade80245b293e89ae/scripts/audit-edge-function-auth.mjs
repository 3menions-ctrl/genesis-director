#!/usr/bin/env node
/**
 * audit-edge-function-auth.mjs
 *
 * Enforces the Vertical 1 trust-boundary contract:
 *
 *   For every function in supabase/config.toml that ships with
 *   `verify_jwt = false`, the function source MUST contain at least
 *   one of the following auth/signature gates, OR be explicitly marked
 *   as intentionally public via a `// @public-endpoint` comment that
 *   documents the rationale on the next line.
 *
 * Recognised gates:
 *   - validateAuth(            // shared auth-guard.ts helper (preferred)
 *   - resolveEffectiveUserId(  // same helper, end-user contract
 *   - getClaims(               // native Supabase JWT validation
 *   - getUser(                 // native Supabase user fetch
 *   - verifyWebhookSignature(  // custom webhook signature
 *   - constructEvent(          // Stripe webhook signature
 *   - LOVABLE_API_KEY          // server-to-server gateway key
 *   - SUPABASE_SERVICE_ROLE_KEY// service-role gate (with surrounding check)
 *
 * Exits 1 with a per-file report if any function violates the contract,
 * which fails CI before a vulnerable function can land.
 *
 * Run:    node scripts/audit-edge-function-auth.mjs
 * CI:     wired via the `audit:edge-auth` npm script.
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const configPath = join(repoRoot, "supabase", "config.toml");
const functionsDir = join(repoRoot, "supabase", "functions");

if (!existsSync(configPath)) {
  console.error(`[audit-edge-auth] supabase/config.toml not found at ${configPath}`);
  process.exit(2);
}

const GATE_PATTERNS = [
  /validateAuth\s*\(/,
  /resolveEffectiveUserId\s*\(/,
  /\.auth\.getClaims\s*\(/,
  /\.auth\.getUser\s*\(/,
  /verifyWebhookSignature\s*\(/,
  /constructEvent\s*\(/,                  // Stripe webhook signature verify
  /LOVABLE_API_KEY/,                      // gateway-key gated server-to-server
  /verifyStripeWebhook\s*\(/,             // shared Stripe webhook helper
  /handleStripeWebhookRequest\s*\(/,      // shared Stripe webhook entrypoint
  /verifyReplicateSignature\s*\(/,        // shared Replicate webhook helper
  /requireCronSecret\s*\(/,               // cron trust boundary
  /requireServiceRole\s*\(/,              // internal-only trust boundary
  /extractApiKey\s*\(/,                   // public API gateway uses hashed api keys
];

// A function source that contains this exact magic comment is treated as
// intentionally public. The line immediately after MUST contain a non-empty
// rationale comment so the choice is auditable.
const PUBLIC_MARKER = /^\s*\/\/\s*@public-endpoint\b/m;
const PUBLIC_RATIONALE = /^\s*\/\/\s*@public-endpoint\b[^\n]*\n\s*\/\/\s*\S/m;

function parseVerifyJwtSections(toml) {
  // Walk every [functions.<name>] section and classify each one as
  // verify_jwt=false, verify_jwt=true, or unspecified. Unspecified defaults
  // to false per Lovable docs.
  const falseSet = new Set();
  const trueSet = new Set();
  const sectionRe = /\[functions\.([A-Za-z0-9_-]+)\]([^\[]*)/g;
  let m;
  while ((m = sectionRe.exec(toml)) !== null) {
    const name = m[1];
    const body = m[2];
    if (/verify_jwt\s*=\s*false/.test(body)) falseSet.add(name);
    else if (/verify_jwt\s*=\s*true/.test(body)) trueSet.add(name);
    else falseSet.add(name); // explicit block without verify_jwt still defaults to false
  }
  return { falseSet, trueSet };
}

function listEdgeFunctions() {
  if (!existsSync(functionsDir)) return [];
  return readdirSync(functionsDir).filter((entry) => {
    const p = join(functionsDir, entry);
    if (entry.startsWith("_")) return false;          // _shared, etc.
    try { return statSync(p).isDirectory() && existsSync(join(p, "index.ts")); }
    catch { return false; }
  });
}

function auditFunction(name) {
  const indexPath = join(functionsDir, name, "index.ts");
  if (!existsSync(indexPath)) {
    return { name, status: "missing-index", indexPath };
  }
  const src = readFileSync(indexPath, "utf8");

  if (PUBLIC_MARKER.test(src)) {
    if (!PUBLIC_RATIONALE.test(src)) {
      return {
        name,
        status: "fail",
        reason: "marked @public-endpoint but missing rationale comment on the next line",
      };
    }
    return { name, status: "public-ok" };
  }

  const matched = GATE_PATTERNS.find((re) => re.test(src));
  if (!matched) {
    return {
      name,
      status: "fail",
      reason:
        "verify_jwt=false AND no in-code auth gate found " +
        "(expected one of: validateAuth, resolveEffectiveUserId, " +
        "getClaims, getUser, verifyWebhookSignature, constructEvent, " +
        "LOVABLE_API_KEY) — or explicitly mark with `// @public-endpoint` " +
        "followed by a rationale comment.",
    };
  }
  return { name, status: "ok", matched: matched.source };
}

const toml = readFileSync(configPath, "utf8");
const { falseSet: verifyJwtFalse, trueSet: verifyJwtTrue } = parseVerifyJwtSections(toml);
const allFunctions = listEdgeFunctions();

const auditTargets = allFunctions.filter((n) => verifyJwtFalse.has(n));

const results = auditTargets.map(auditFunction);
const failures = results.filter((r) => r.status === "fail" || r.status === "missing-index");
const ok = results.filter((r) => r.status === "ok").length;
const publicOk = results.filter((r) => r.status === "public-ok").length;

// Surface functions that are deployed but have NO config block (default verify_jwt=false).
// Anything NOT in a verify_jwt=false block AND NOT in a verify_jwt=true block
// defaults to verify_jwt=false and must also pass the audit. Functions that
// explicitly set verify_jwt=true are gateway-validated and exempt.
const unconfigured = allFunctions.filter(
  (n) => !verifyJwtFalse.has(n) && !verifyJwtTrue.has(n),
);
const unconfiguredFailures = [];
for (const name of unconfigured) {
  // Anything not in config defaults to verify_jwt=false (per Lovable docs).
  // Audit the same way.
  const result = auditFunction(name);
  if (result.status === "fail" || result.status === "missing-index") {
    unconfiguredFailures.push({ ...result, note: "no [functions.<name>] block in config.toml (defaults to verify_jwt=false)" });
  }
}

console.log(`\n[audit-edge-auth] Functions audited: ${results.length + unconfigured.length}`);
console.log(`  with explicit verify_jwt=false in config.toml: ${verifyJwtFalse.size}`);
console.log(`  passing (in-code auth gate):                   ${ok}`);
console.log(`  passing (marked @public-endpoint w/ rationale): ${publicOk}`);
console.log(`  failing:                                       ${failures.length + unconfiguredFailures.length}`);

const allFailures = [...failures, ...unconfiguredFailures];
if (allFailures.length > 0) {
  console.error("\n[audit-edge-auth] FAILURES:");
  for (const f of allFailures) {
    console.error(`  ✗ ${f.name}`);
    if (f.reason) console.error(`      reason: ${f.reason}`);
    if (f.note)   console.error(`      note:   ${f.note}`);
  }
  console.error(
    "\nFix by either calling validateAuth() / resolveEffectiveUserId() in the " +
    "function (recommended), verifying a webhook signature, or — if the " +
    "endpoint is genuinely public — adding `// @public-endpoint` followed " +
    "by a comment explaining why on the next line.\n"
  );
  process.exit(1);
}

console.log("[audit-edge-auth] OK — every verify_jwt=false function has an in-code auth gate.\n");
process.exit(0);
