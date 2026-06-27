// Aggregates captured tokens into report.md, builds contact-sheet.html, and
// renders contact-sheet.png by screenshotting the HTML grid.

import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { BASE_URL, STORAGE_STATE } from "./config.mjs";

const OUT = new URL(".", import.meta.url).pathname;
const TAG = process.env.AUDIT_TAG || "";
const records = JSON.parse(readFileSync(join(OUT, `capture${TAG}.json`), "utf8"));

// ── color helpers ────────────────────────────────────────────────────────────
function parseColor(c) {
  if (!c) return null;
  let m = c.match(/rgba?\((\d+),(\d+),(\d+)(?:,([\d.]+))?\)/);
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  m = c.match(/^#([0-9a-f]{6})$/i);
  if (m) { const n = parseInt(m[1], 16); return { r: (n>>16)&255, g: (n>>8)&255, b: n&255, a: 1 }; }
  m = c.match(/^#([0-9a-f]{3})$/i);
  if (m) { const s = m[1]; return { r: parseInt(s[0]+s[0],16), g: parseInt(s[1]+s[1],16), b: parseInt(s[2]+s[2],16), a: 1 }; }
  return null;
}
const toHex = (p) => p ? "#" + [p.r,p.g,p.b].map(x => x.toString(16).padStart(2,"0")).join("") : null;
const dist = (a, b) => Math.sqrt((a.r-b.r)**2 + (a.g-b.g)**2 + (a.b-b.b)**2);

// ── aggregate across desktop token passes ────────────────────────────────────
const tokenPages = records.filter(r => r.viewport === "desktop" && r.tokens);
const merge = (acc, obj) => { for (const [k,v] of Object.entries(obj || {})) acc[k] = (acc[k]||0)+v; return acc; };

const gColors = {};          // hex(opaque) -> count
const gColorRaw = {};        // raw string -> count (keeps alpha)
const gFonts = {}, gSizes = {}, gSpacing = {};
const headingByTag = {};     // tag -> Map(fontSize -> count)
const allButtons = [];
const radii = {}, btnPadding = {};

for (const r of tokenPages) {
  const t = r.tokens;
  for (const role of ["background","text","border"]) {
    for (const [c, n] of Object.entries(t.colors[role] || {})) {
      gColorRaw[c] = (gColorRaw[c]||0)+n;
      const p = parseColor(c);
      if (p && p.a >= 0.95) { const h = toHex(p); gColors[h] = (gColors[h]||0)+n; }
    }
  }
  merge(gFonts, t.fontFamilies);
  merge(gSizes, t.fontSizes);
  merge(gSpacing, t.spacing);
  for (const h of t.headings) {
    headingByTag[h.tag] ??= {};
    headingByTag[h.tag][h.fontSize] = (headingByTag[h.tag][h.fontSize]||0)+1;
  }
  for (const b of t.buttons) {
    allButtons.push({ ...b, route: r.path });
    radii[b.radius] = (radii[b.radius]||0)+1;
    btnPadding[b.padding] = (btnPadding[b.padding]||0)+1;
  }
}

// ── near-duplicate colors ────────────────────────────────────────────────────
const colorEntries = Object.entries(gColors).sort((a,b)=>b[1]-a[1]);
const THRESHOLD = 12; // euclidean RGB distance under which two colors are "near dup"
const nearDups = [];
for (let i = 0; i < colorEntries.length; i++) {
  for (let j = i+1; j < colorEntries.length; j++) {
    const pa = parseColor(colorEntries[i][0]), pb = parseColor(colorEntries[j][0]);
    const d = dist(pa, pb);
    if (d > 0 && d < THRESHOLD) {
      nearDups.push({ a: colorEntries[i][0], an: colorEntries[i][1], b: colorEntries[j][0], bn: colorEntries[j][1], d: +d.toFixed(1) });
    }
  }
}
nearDups.sort((x,y)=>x.d-y.d);

// ── font size scale analysis ─────────────────────────────────────────────────
const sizePx = Object.entries(gSizes)
  .map(([s,n]) => [parseFloat(s), n])
  .filter(([v]) => !isNaN(v))
  .sort((a,b)=>a[0]-b[0]);
const distinctSizes = sizePx.map(s=>s[0]);
// Off-grid font sizes: not a multiple of 1px is normal; flag fractional / odd ones
const fractionalSizes = distinctSizes.filter(v => Math.abs(v - Math.round(v)) > 0.01);

// ── spacing off the 4px grid ─────────────────────────────────────────────────
const spacingPx = Object.entries(gSpacing)
  .map(([s,n]) => [parseFloat(s), n])
  .filter(([v]) => !isNaN(v))
  .sort((a,b)=>b[1]-a[1]);
const offGridSpacing = spacingPx.filter(([v]) => Math.round(v) % 4 !== 0);

// ── per-page deviation ───────────────────────────────────────────────────────
const dominantFont = Object.entries(gFonts).sort((a,b)=>b[1]-a[1])[0]?.[0];
const perPage = tokenPages.map(r => {
  const t = r.tokens;
  const topFont = Object.entries(t.fontFamilies).sort((a,b)=>b[1]-a[1])[0]?.[0];
  const topBg = Object.entries(t.colors.background).sort((a,b)=>b[1]-a[1])[0]?.[0];
  return {
    path: r.path, label: r.label, title: t.title,
    elements: t.counts.elements,
    topFont, fontDeviates: topFont && dominantFont && topFont !== dominantFont,
    topBg,
    fontFamilyCount: Object.keys(t.fontFamilies).length,
    fontSizeCount: Object.keys(t.fontSizes).length,
    colorCount: Object.keys(t.colors.background).length + Object.keys(t.colors.text).length,
  };
});

// ── markdown report ──────────────────────────────────────────────────────────
const fmtTable = (rows) => rows.map(r => "| " + r.join(" | ") + " |").join("\n");
const swatch = (c) => `\`${c}\``;
const redirectedRoutes = [...new Set(records.filter(r=>r.redirected).map(r=>r.path))];
const renderedRoutes = [...new Set(records.filter(r=>!r.redirected && !r.error).map(r=>r.path))];
const errored = records.filter(r=>r.error);
const stubbed = [...new Map(records.filter(r=>r.stub).map(r=>[r.path, r.stub])).entries()];

let md = `# Genesis Director — Design Audit

_Generated against ${BASE_URL} · ${tokenPages.length} pages analysed (desktop pass) · ${records.length} total captures (desktop + mobile)._

## Summary

- **Routes discovered:** ${[...new Set(records.map(r=>r.path))].length} (from \`src/App.tsx\` React Router config + \`businessNav.ts\`)
- **Rendered unique content:** ${renderedRoutes.length} routes
- **Redirected (auth/gate):** ${redirectedRoutes.length} routes → captured at their redirect target
- **Capture errors:** ${errored.length}
- **Distinct opaque colors:** ${colorEntries.length}
- **Near-duplicate color pairs (RGB dist < ${THRESHOLD}):** ${nearDups.length}
- **Distinct font families:** ${Object.keys(gFonts).length}
- **Distinct font sizes:** ${distinctSizes.length}
- **Distinct button radii:** ${Object.keys(radii).length}
- **Distinct spacing values:** ${spacingPx.length}

${STORAGE_STATE
  ? `> ✅ This pass ran **authenticated** (session: \`${STORAGE_STATE}\`). Protected
> consumer routes render their real surfaces. Any routes still listed under
> "Redirected" are gated to a different account type (e.g. business/admin).
> Token stats below are from the ${renderedRoutes.length} routes that rendered real content.`
  : `> ⚠️ This pass ran **unauthenticated**. All protected, business, and admin routes
> redirect to \`/auth\`, so their screenshots show the sign-in page, not the real
> surface. To audit those, generate a logged-in session and re-run with
> \`AUDIT_STORAGE_STATE\` (see README). Token stats below are from the
> ${renderedRoutes.length} routes that render real content.`}

## 🚩 Flagged inconsistencies

### Near-duplicate colors (${nearDups.length})
Colors close enough that they're probably meant to be the same token but drifted:

${nearDups.length ? fmtTable([["Color A","uses","Color B","uses","RGB dist"], ...nearDups.slice(0,40).map(d=>[swatch(d.a),d.an,swatch(d.b),d.bn,d.d])]) : "_None found._"}

### Button radius inconsistency (${Object.keys(radii).length} distinct)
A consistent system usually has 2–4 radius tokens. Distinct values in use:

${fmtTable([["border-radius","occurrences"], ...Object.entries(radii).sort((a,b)=>b[1]-a[1]).map(([k,v])=>[swatch(k),v])])}

### Font sizes off a clean scale (${fractionalSizes.length} fractional)
${fractionalSizes.length ? "Fractional / odd sizes that don't sit on an integer-px scale: " + fractionalSizes.map(v=>swatch(v+"px")).join(", ") : "_All sizes land on integer pixels._"}

All distinct font sizes (px): ${distinctSizes.map(v=>swatch(v)).join(" ")}

### Spacing off the 4px grid (${offGridSpacing.length} values)
${offGridSpacing.length ? fmtTable([["spacing","occurrences"], ...offGridSpacing.sort((a,b)=>b[1]-a[1]).slice(0,30).map(([v,n])=>[swatch(v+"px"),n])]) : "_All spacing values are multiples of 4px._"}

### Multiple font families (${Object.keys(gFonts).length})
${fmtTable([["font-family (primary)","occurrences"], ...Object.entries(gFonts).sort((a,b)=>b[1]-a[1]).map(([k,v])=>[k||"(unset)",v])])}

## Heading scale (h1–h6)
Each tag should ideally map to one size. Multiple sizes per tag = drift.

${fmtTable([["tag","distinct sizes (count)","verdict"], ...["h1","h2","h3","h4","h5","h6"].map(tag => {
  const m = headingByTag[tag] || {};
  const entries = Object.entries(m).sort((a,b)=>b[1]-a[1]);
  const sizes = entries.map(([s,n])=>`${s}×${n}`).join(", ") || "—";
  const verdict = entries.length === 0 ? "—" : entries.length === 1 ? "✓ consistent" : `⚠️ ${entries.length} sizes`;
  return [tag, sizes, verdict];
})])}

## Top colors (opaque, by frequency)
${fmtTable([["color","uses"], ...colorEntries.slice(0,25).map(([c,n])=>[swatch(c),n])])}

## Button styles sampled (${allButtons.length})
${fmtTable([["radius","padding (T R B L)","bg","color","font","route"], ...allButtons.slice(0,30).map(b=>[swatch(b.radius),swatch(b.padding),swatch(b.bg),swatch(b.color),b.fontSize+"/"+b.fontWeight,b.route])])}

## Per-page profile
${fmtTable([["route","label","elements","fonts","sizes","colors","primary font","deviates?"], ...perPage.map(p=>[p.path,p.label,p.elements,p.fontFamilyCount,p.fontSizeCount,p.colorCount,p.topFont||"—",p.fontDeviates?"⚠️ yes":"no"])])}

## Routes & capture status
**Stubbed params used:**
${stubbed.length ? stubbed.map(([p,s])=>`- \`${p}\` — ${s}`).join("\n") : "_none_"}

**Redirected (gated, unauthenticated):**
${redirectedRoutes.map(p=>`\`${p}\``).join(", ")}

${errored.length ? "**Errors:**\n" + errored.map(e=>`- \`${e.path}\` (${e.viewport}): ${e.error.split("\n")[0]}`).join("\n") : ""}

---
_See \`contact-sheet.html\` / \`contact-sheet.png\` for the visual grid, and \`shots/\` for full-page + above-the-fold PNGs per route._
`;

writeFileSync(join(OUT, `report${TAG}.md`), md);
console.log("Wrote report.md");

// ── contact sheet HTML ───────────────────────────────────────────────────────
function sheet(viewport) {
  const recs = records.filter(r => r.viewport === viewport && (r.foldShot || r.error));
  const cards = recs.map(r => {
    const flag = r.error ? `<span class="bad">ERROR</span>`
      : r.redirected ? `<span class="warn">→ ${new URL(r.finalUrl).pathname}</span>`
      : `<span class="ok">${r.status||""}</span>`;
    const img = r.foldShot ? `<img loading="lazy" src="${r.foldShot}">` : `<div class="noimg">no capture</div>`;
    return `<figure>
      <div class="thumb">${img}</div>
      <figcaption><code>${r.path}</code> ${flag}<br><span class="lbl">${r.label}</span></figcaption>
    </figure>`;
  }).join("\n");
  return { count: recs.length, cards };
}
const dsk = sheet("desktop");
const mob = sheet("mobile");

const html = `<!doctype html><html><head><meta charset="utf-8">
<title>Genesis Director — Contact Sheet</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; background:#0b0b0d; color:#e7e7ea; font:13px/1.4 -apple-system,Segoe UI,Roboto,sans-serif; padding:28px; }
  h1 { font-size:22px; margin:0 0 4px; }
  h2 { font-size:16px; margin:34px 0 12px; color:#9aa; border-top:1px solid #222; padding-top:18px; }
  .meta { color:#888; margin-bottom:8px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:16px; }
  .grid.mobile { grid-template-columns:repeat(auto-fill,minmax(170px,1fr)); }
  figure { margin:0; background:#141417; border:1px solid #232327; border-radius:10px; overflow:hidden; }
  .thumb { background:#000; aspect-ratio:16/10; overflow:hidden; display:flex; align-items:flex-start; justify-content:center; }
  .grid.mobile .thumb { aspect-ratio:390/640; }
  .thumb img { width:100%; height:auto; display:block; }
  .noimg { color:#666; padding:40px; }
  figcaption { padding:8px 10px; font-size:12px; }
  figcaption code { color:#7db1ff; }
  .lbl { color:#999; font-size:11px; }
  .ok { color:#5fd07a; }
  .warn { color:#e0a83a; font-size:11px; }
  .bad { color:#ff6b6b; }
</style></head><body>
<h1>Genesis Director — Design Contact Sheet</h1>
<div class="meta">${BASE_URL} · above-the-fold thumbnails · ${dsk.count} desktop + ${mob.count} mobile · generated by design-audit</div>
<h2>Desktop · 1440×900 (${dsk.count})</h2>
<div class="grid desktop">${dsk.cards}</div>
<h2>Mobile · 390×844 (${mob.count})</h2>
<div class="grid mobile">${mob.cards}</div>
</body></html>`;

writeFileSync(join(OUT, `contact-sheet${TAG}.html`), html);
console.log("Wrote contact-sheet.html");

// ── render PNG ───────────────────────────────────────────────────────────────
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(join(OUT, `contact-sheet${TAG}.html`)).href, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.screenshot({ path: join(OUT, `contact-sheet${TAG}.png`), fullPage: true });
await browser.close();
console.log("Wrote contact-sheet.png");
