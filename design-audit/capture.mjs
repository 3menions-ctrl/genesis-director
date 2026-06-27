// Capture engine: visits every route at every viewport, saves full-page +
// above-the-fold screenshots, and extracts design tokens from computed styles.
// Read-only against the running dev server — never touches app source.

import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BASE_URL, STORAGE_STATE, VIEWPORTS, SETTLE_MS, NAV_TIMEOUT_MS, ROUTES } from "./config.mjs";

const OUT = new URL(".", import.meta.url).pathname;
// AUDIT_TAG suffixes output so an authenticated pass won't clobber the baseline.
const TAG = process.env.AUDIT_TAG || "";
const SHOTS = join(OUT, `shots${TAG}`);
mkdirSync(SHOTS, { recursive: true });

// Optional group filtering. AUDIT_GROUPS=App (protected),Discover  (include only)
// AUDIT_EXCLUDE_GROUPS=Business,Admin  (exclude these groups)
const onlyGroups = (process.env.AUDIT_GROUPS || "").split(",").map(s=>s.trim()).filter(Boolean);
const exclGroups = (process.env.AUDIT_EXCLUDE_GROUPS || "").split(",").map(s=>s.trim()).filter(Boolean);
const routeList = ROUTES.filter(r =>
  (onlyGroups.length === 0 || onlyGroups.includes(r.group)) &&
  !exclGroups.includes(r.group));

// AUDIT_VIEWPORTS=desktop  → capture only that viewport (faster token-only runs).
const wantVps = (process.env.AUDIT_VIEWPORTS || "").split(",").map(s=>s.trim()).filter(Boolean);
const viewportList = wantVps.length ? VIEWPORTS.filter(v => wantVps.includes(v.name)) : VIEWPORTS;

// AUDIT_FREEZE_THEME=1 → pin the app's DYNAMIC theming so color measurement
// reflects STATIC design tokens, not the runtime tint. The app writes
// --sb-tod-hue/-opacity (TimeOfDayAura, by clock) and --page-tone-* (PageTone,
// deterministic per-user/per-page) onto <html> via non-important inline props,
// so an !important stylesheet overrides them. Also kills animations/transitions.
const FREEZE = process.env.AUDIT_FREEZE_THEME === "1";
const FREEZE_SCRIPT = `(() => {
  const css = ':root{' +
    '--sb-tod-hue:200!important;--sb-tod-opacity:0!important;' +
    '--page-tone-primary:hsl(220 60% 9%)!important;' +
    '--page-tone-secondary:hsl(212 92% 50%)!important;' +
    '--page-tone-accent:hsl(195 95% 55%)!important;' +
    '--page-tone-label:"default"!important;}' +
    '*{animation-duration:0s!important;animation-delay:0s!important;transition:none!important;caret-color:transparent!important;}';
  const inject = () => {
    if (document.getElementById('audit-freeze')) return;
    const s = document.createElement('style');
    s.id = 'audit-freeze'; s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
    document.documentElement.dataset.tod = 'day';
    document.documentElement.dataset.todIntensity = '0';
  };
  inject();
  document.addEventListener('DOMContentLoaded', inject);
  // TimeOfDayAura re-stamps data-tod on mount; keep it pinned.
  try {
    new MutationObserver(() => {
      if (document.documentElement.dataset.tod !== 'day') document.documentElement.dataset.tod = 'day';
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-tod'] });
  } catch {}
})();`;

// A filesystem-safe slug for a route path.
const slugify = (p) => p.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || "root";

// The in-page token extractor. Runs in the browser, returns plain JSON.
// Defined as a string-free function passed to page.evaluate.
function extractTokens() {
  const norm = (c) => (c || "").replace(/\s+/g, "");
  const seenColor = {};   // color -> count, split by role below
  const bg = {}, fg = {}, bd = {};
  const fonts = {}, sizes = {};
  const spacing = {};
  const headings = [];
  const buttons = [];

  const bump = (obj, k) => { if (!k) return; obj[k] = (obj[k] || 0) + 1; };
  const isTransparent = (c) =>
    !c || c === "transparent" || /rgba\(\s*0,\s*0,\s*0,\s*0\s*\)/.test(c.replace(/\s/g, m => m));

  const all = document.querySelectorAll("*");
  const N = Math.min(all.length, 6000); // cap for very large DOMs
  for (let i = 0; i < N; i++) {
    const el = all[i];
    const cs = getComputedStyle(el);
    // colors
    if (!isTransparent(cs.backgroundColor)) bump(bg, norm(cs.backgroundColor));
    bump(fg, norm(cs.color));
    const bw = parseFloat(cs.borderTopWidth) || parseFloat(cs.borderWidth) || 0;
    if (bw > 0 && !isTransparent(cs.borderTopColor)) bump(bd, norm(cs.borderTopColor));
    // typography
    bump(fonts, (cs.fontFamily || "").split(",")[0].replace(/['"]/g, "").trim());
    bump(sizes, cs.fontSize);
    // spacing — collect every non-zero px margin/padding edge
    for (const prop of ["marginTop","marginRight","marginBottom","marginLeft",
                         "paddingTop","paddingRight","paddingBottom","paddingLeft"]) {
      const v = cs[prop];
      if (v && v !== "0px" && v.endsWith("px")) bump(spacing, v);
    }
  }

  for (const tag of ["h1","h2","h3","h4","h5","h6"]) {
    for (const el of document.querySelectorAll(tag)) {
      const cs = getComputedStyle(el);
      headings.push({
        tag,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        lineHeight: cs.lineHeight,
        fontFamily: (cs.fontFamily || "").split(",")[0].replace(/['"]/g, "").trim(),
      });
      if (headings.length > 200) break;
    }
  }

  const btnEls = document.querySelectorAll('button, [role="button"], a[class*="btn"], input[type="submit"]');
  let bi = 0;
  for (const el of btnEls) {
    if (bi++ > 300) break;
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) continue; // skip invisible
    buttons.push({
      radius: cs.borderRadius,
      padding: `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`,
      bg: norm(cs.backgroundColor),
      color: norm(cs.color),
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      border: `${cs.borderTopWidth} ${norm(cs.borderTopColor)}`,
    });
  }

  return {
    title: document.title,
    url: location.href,
    counts: { elements: all.length },
    colors: { background: bg, text: fg, border: bd },
    fontFamilies: fonts,
    fontSizes: sizes,
    spacing,
    headings,
    buttons,
  };
}

// Reject after `ms` so one hung route can't stall the whole run. The underlying
// Playwright op isn't cancelled, but the loop recreates the page and moves on.
const withTimeout = (p, ms, label) => Promise.race([
  Promise.resolve(p),
  new Promise((_, rej) => setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms)),
]);

async function settle(page) {
  try { await page.waitForLoadState("networkidle", { timeout: 8000 }); } catch {}
  // document.fonts.ready never resolves if a webfont request hangs pending — the
  // exact stall that froze the first freeze-mode run. Cap it.
  try { await withTimeout(page.evaluate(() => document.fonts && document.fonts.ready), 5000, "fonts.ready"); } catch {}
  await page.waitForTimeout(SETTLE_MS);
}

// Per-route wall-clock budget. On overrun the route is logged as an error and
// the page is recreated so the next route starts from a clean slate.
const ROUTE_BUDGET_MS = Number(process.env.AUDIT_ROUTE_BUDGET_MS || 35000);

async function run() {
  const browser = await chromium.launch();
  const results = [];

  if (FREEZE) console.log("❄️  Freeze mode: pinning TimeOfDayAura + PageTone, disabling motion.\n");
  for (const vp of viewportList) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      storageState: STORAGE_STATE,
      reducedMotion: FREEZE ? "reduce" : undefined,
      colorScheme: "dark",
    });
    if (FREEZE) await context.addInitScript(FREEZE_SCRIPT);
    context.setDefaultTimeout(NAV_TIMEOUT_MS);
    let page = await context.newPage();
    page.on("dialog", (d) => d.dismiss().catch(() => {})); // never block on alert/confirm/beforeunload

    // One route's worth of work, wrapped so the outer budget can time it out.
    const captureRoute = async (route, rec) => {
      const resp = await page.goto(rec.target, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
      await settle(page);
      rec.status = resp ? resp.status() : null;
      rec.finalUrl = page.url();
      rec.redirected = new URL(page.url()).pathname !== route.path;

      const foldPath = join(SHOTS, `${rec.id}.fold.png`);
      const fullPath = join(SHOTS, `${rec.id}.full.png`);
      await page.screenshot({ path: foldPath, timeout: 15000, animations: "disabled" });
      await page.screenshot({ path: fullPath, fullPage: true, timeout: 15000, animations: "disabled" });
      rec.foldShot = `shots${TAG}/${rec.id}.fold.png`;
      rec.fullShot = `shots${TAG}/${rec.id}.full.png`;

      // tokens only once per route (desktop pass) to keep the report focused
      if (vp.name === "desktop") rec.tokens = await page.evaluate(extractTokens);
    };

    for (const route of routeList) {
      const id = `${slugify(route.path)}__${vp.name}`;
      const target = BASE_URL + route.path;
      const rec = { ...route, viewport: vp.name, id, target };
      try {
        await withTimeout(captureRoute(route, rec), ROUTE_BUDGET_MS, `route ${route.path}`);
        console.log(`✓ ${vp.name.padEnd(7)} ${route.path}  →  ${rec.finalUrl.replace(BASE_URL, "")}${rec.redirected ? "  (redirected)" : ""}`);
      } catch (err) {
        rec.error = String(err && err.message || err);
        console.log(`✗ ${vp.name.padEnd(7)} ${route.path}  —  ${rec.error.split("\n")[0]}`);
        // A hung page won't recover — replace it so the next route is clean.
        try { await page.close({ runBeforeUnload: false }); } catch {}
        page = await context.newPage();
        page.on("dialog", (d) => d.dismiss().catch(() => {}));
      }
      results.push(rec);
    }
    await context.close();
  }

  await browser.close();
  writeFileSync(join(OUT, `capture${TAG}.json`), JSON.stringify(results, null, 2));
  console.log(`\nCaptured ${results.length} (route × viewport) records → design-audit/capture${TAG}.json`);
  return results;
}

run().catch((e) => { console.error(e); process.exit(1); });
