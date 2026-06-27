// One-shot runner: capture, then build the report + contact sheet.
//   node audit.mjs
// Config (base URL, viewports, routes) lives in ./config.mjs.
import { execFileSync } from "node:child_process";
const run = (f) => execFileSync(process.execPath, [new URL(f, import.meta.url).pathname], { stdio: "inherit" });
run("./capture.mjs");
run("./report.mjs");
console.log("\n✅ Done. See design-audit/contact-sheet.png, contact-sheet.html, report.md, shots/");
