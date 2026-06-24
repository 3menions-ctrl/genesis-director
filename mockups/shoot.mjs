// Screenshot each direction section (#A/#B/#C) of every page mockup.
// Usage: node mockups/shoot.mjs [page1 page2 ...]  (default: all .html in pages/)
import { chromium } from 'playwright';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const pagesDir = join(here, 'pages');
const shotsDir = join(here, 'shots');

const argPages = process.argv.slice(2);
const files = (argPages.length
  ? argPages.map((p) => (p.endsWith('.html') ? p : `${p}.html`))
  : readdirSync(pagesDir).filter((f) => f.endsWith('.html'))
).sort();

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1680, height: 1000 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

for (const file of files) {
  const url = 'file://' + resolve(pagesDir, file);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(450); // let fonts settle
  const base = file.replace(/\.html$/, '');
  for (const id of ['A', 'B', 'C']) {
    const el = await page.$(`#${id}`);
    if (!el) { console.log(`  ! ${base} #${id} missing`); continue; }
    const out = join(shotsDir, `${base}-${id}.png`);
    await el.screenshot({ path: out });
    console.log(`  ✓ ${base}-${id}.png`);
  }
}

await browser.close();
console.log('done');
