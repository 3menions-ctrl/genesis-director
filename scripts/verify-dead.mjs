#!/usr/bin/env node
// Adversarial verification of the 289 "dead" files.
// For each dead file, find EVERY textual reference across the whole repo,
// classify the referencing file as dead / test / live, and flag dynamic-import risk.
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const dead = fs.readFileSync("/tmp/dead.txt", "utf8").split("\n").map(s => s.trim()).filter(Boolean);
const deadSet = new Set(dead);

// Collect every text file in the repo we care about (exclude build/vendor/output).
const EXCLUDE = /(^|\/)(node_modules|dist|dist-admin|dist-desktop|\.git|\.claude|\.vercel|\.lovable|build|coverage|playwright-report|test-results|preserved|mem|docs|reports)(\/|$)/;
const EXT = /\.(ts|tsx|js|jsx|cjs|mjs|html|json|toml|css)$/;
function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = path.relative(ROOT, full);
    if (EXCLUDE.test(rel)) continue;
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (EXT.test(name)) out.push(rel);
  }
}
const allFiles = [];
walk(ROOT, allFiles);

const isTest = f => /(^|\/)(e2e)\//.test(f) || /\/test\//.test(f) || /\.(test|spec)\.[tj]sx?$/.test(f) || /(^|\/)__tests__\//.test(f);

// Build, for each dead file, the set of search "keys" that an importer/referencer would use.
function keysFor(f) {
  const noExt = f.replace(/\.(tsx?|jsx?)$/, "");        // src/components/foo/Bar
  const alias = "@/" + noExt.replace(/^src\//, "");      // @/components/foo/Bar
  const base = path.basename(noExt);                      // Bar
  const keys = new Set([f, noExt, alias]);
  // index files are referenced by their directory
  if (base === "index") {
    keys.add(path.dirname(noExt));                         // src/components/foo
    keys.add("@/" + path.dirname(noExt).replace(/^src\//, ""));
  }
  return { keys: [...keys], base, noExt, alias };
}

// Read all files once.
const content = new Map();
for (const f of allFiles) {
  try { content.set(f, fs.readFileSync(path.join(ROOT, f), "utf8")); } catch {}
}

// Resolve a module specifier (from file g) to a normalized repo-relative path WITHOUT extension.
// Returns array of candidate target paths (the module itself, and its /index).
function resolveSpec(g, spec) {
  let basePath;
  if (spec.startsWith("@/")) basePath = "src/" + spec.slice(2);
  else if (spec.startsWith(".")) basePath = path.normalize(path.join(path.dirname(g), spec));
  else return [];                       // bare package import — not a local file
  basePath = basePath.replace(/\\/g, "/");
  return [basePath, basePath + "/index"];
}

// Extract every local module specifier referenced by a file: static import/export-from,
// dynamic import(), require(), AND vi.importActual / readFile('src/...') style string refs.
const SPEC_RE = /(?:from|import|require|importActual|readFileSync|readFile)\s*\(?\s*['"]([^'"]+)['"]/g;
// also catch bare `import 'x'` and string literals that are clearly src paths
const SRCPATH_RE = /['"](?:\.{1,2}\/[^'"]+|@\/[^'"]+|src\/[^'"]+)['"]/g;

function targetsOf(g, text) {
  const out = new Set();
  for (const m of text.matchAll(SPEC_RE)) {
    for (const t of resolveSpec(g, m[1])) out.add(t);
  }
  // string literals referencing src/ files directly (e.g. readFile('src/hooks/x.ts'))
  for (const m of text.matchAll(SRCPATH_RE)) {
    const lit = m[0].slice(1, -1);
    if (lit.startsWith("src/")) out.add(lit.replace(/\.(tsx?|jsx?)$/, ""));
    else for (const t of resolveSpec(g, lit)) out.add(t);
  }
  return out;
}

// Precompute targets per file once.
const fileTargets = new Map();
for (const [g, text] of content) fileTargets.set(g, targetsOf(g, text));

const results = [];
for (const f of dead) {
  const noExt = f.replace(/\.(tsx?|jsx?)$/, "");
  const liveRefs = [], testRefs = [], deadRefs = [];
  for (const [g, targets] of fileTargets) {
    if (g === f) continue;
    if (!targets.has(noExt)) continue;   // exact specifier match only
    if (deadSet.has(g)) deadRefs.push(g);
    else if (isTest(g)) testRefs.push(g);
    else liveRefs.push(g);
  }
  results.push({ f, liveRefs, testRefs, deadRefs });
}

const liveReferenced = results.filter(r => r.liveRefs.length);
const testOnly = results.filter(r => !r.liveRefs.length && r.testRefs.length);
const cleanlyDead = results.filter(r => !r.liveRefs.length && !r.testRefs.length);

console.log(`TOTAL dead candidates: ${results.length}`);
console.log(`  LIVE-referenced (FALSE POSITIVE — NOT safe): ${liveReferenced.length}`);
console.log(`  test-referenced only (safe for app, breaks tests): ${testOnly.length}`);
console.log(`  cleanly dead (no live, no test ref): ${cleanlyDead.length}`);

console.log("\n===== LIVE-REFERENCED (must investigate) =====");
for (const r of liveReferenced) console.log(`${r.f}\n    <- ${r.liveRefs.join("\n    <- ")}`);

console.log("\n===== TEST-REFERENCED ONLY =====");
for (const r of testOnly) console.log(`${r.f}  <-  ${[...new Set(r.testRefs)].join(", ")}`);

fs.writeFileSync("/tmp/verify-results.json", JSON.stringify(results, null, 2));
console.log("\n(full results -> /tmp/verify-results.json)");
