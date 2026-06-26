#!/usr/bin/env node
// Compute the SAFE delete set: the 289 dead files MINUS the 28 test-coupled files
// MINUS anything those kept files import (transitively), so nothing we keep ends up
// with a broken import. Output the final delete list.
import fs from "node:fs";

const results = JSON.parse(fs.readFileSync("/tmp/verify-results.json", "utf8"));
const deadSet = new Set(results.map(r => r.f));

// Files we MUST keep because a test reads them.
const keep = new Set(results.filter(r => r.testRefs.length && !r.liveRefs.length).map(r => r.f));

// Build forward import graph within the dead set: f -> [files f imports that are dead]
// We stored deadRefs as "who imports f". Invert: importer -> imported.
const imports = new Map();           // importer -> Set(imported dead files)
for (const r of results) {
  for (const importer of r.deadRefs) {
    if (!imports.has(importer)) imports.set(importer, new Set());
    imports.get(importer).add(r.f);   // importer imports r.f
  }
}

// Grow keep-set by following imports OUT of kept files (transitive closure).
let changed = true;
while (changed) {
  changed = false;
  for (const k of [...keep]) {
    const out = imports.get(k);
    if (!out) continue;
    for (const dep of out) {
      if (deadSet.has(dep) && !keep.has(dep)) { keep.add(dep); changed = true; }
    }
  }
}

const del = results.map(r => r.f).filter(f => !keep.has(f));
fs.writeFileSync("/tmp/delete-set.txt", del.join("\n") + "\n");
fs.writeFileSync("/tmp/keep-set.txt", [...keep].sort().join("\n") + "\n");
console.log(`dead total:        ${deadSet.size}`);
console.log(`KEEP (test-coupled + their dead imports): ${keep.size}`);
console.log(`DELETE (safe set): ${del.length}`);
