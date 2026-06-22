/**
 * Post-build prerenderer (SEO).
 *
 * Snapshots the fully-rendered HTML of the PUBLIC marketing/blog/legal routes
 * into the build output (dist/<route>/index.html). Vercel serves those static
 * files before the SPA rewrite, so crawlers + social scrapers that don't run
 * JS get real per-page <title>/meta/content; the built <script> tags are still
 * present, so React hydrates normally for users.
 *
 * SAFETY: this is BEST-EFFORT. Any failure (no Chromium in the build image,
 * timeout, etc.) is caught and the script exits 0 — it must never fail the
 * build. Worst case the site stays a pure SPA (the current, working behavior).
 *
 * Only PUBLIC, non-auth routes are prerendered.
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';

const DIST = join(process.cwd(), 'dist');
const PORT = 4178;

function discoverRoutes() {
  const base = ['/', '/blog', '/pricing', '/terms', '/privacy', '/press', '/contact', '/developers'];
  // Blog post routes from the markdown frontmatter slugs.
  try {
    const dir = join(process.cwd(), 'src/content/blog');
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.md')) continue;
      const m = /^slug:\s*"?([^"\n]+)"?/m.exec(readFileSync(join(dir, f), 'utf8'));
      if (m) base.push(`/blog/${m[1].trim()}`);
    }
  } catch { /* ignore */ }
  return [...new Set(base)];
}

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.txt': 'text/plain',
};

// Static server with SPA fallback (serve index.html for routes without a file).
function startServer() {
  const index = readFileSync(join(DIST, 'index.html'));
  return new Promise((resolve) => {
    const srv = createServer((req, res) => {
      try {
        const url = decodeURIComponent((req.url || '/').split('?')[0]);
        const ext = extname(url);
        if (ext) {
          const fp = join(DIST, url);
          if (existsSync(fp)) {
            res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
            res.end(readFileSync(fp));
            return;
          }
          res.writeHead(404); res.end(); return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(index);
      } catch {
        res.writeHead(500); res.end();
      }
    });
    srv.listen(PORT, () => resolve(srv));
  });
}

async function main() {
  if (!existsSync(join(DIST, 'index.html'))) {
    console.log('[prerender] no dist/index.html — skipping');
    return;
  }
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.log('[prerender] playwright unavailable — skipping (site stays SPA)');
    return;
  }

  const routes = discoverRoutes();
  const server = await startServer();
  let browser;
  let ok = 0;
  try {
    browser = await chromium.launch({ headless: true });
    for (const route of routes) {
      try {
        const page = await browser.newContext().then((c) => c.newPage());
        await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'networkidle', timeout: 30000 });
        // Wait until the app has replaced the initial loader and set a real title.
        await page.waitForFunction(() => !document.querySelector('.page-loader') && document.title.length > 0, { timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(1200);
        const html = '<!doctype html>\n' + (await page.evaluate(() => document.documentElement.outerHTML));
        const outDir = route === '/' ? DIST : join(DIST, route);
        mkdirSync(outDir, { recursive: true });
        writeFileSync(join(outDir, 'index.html'), html);
        await page.context().close();
        ok++;
        console.log(`[prerender] ${route}`);
      } catch (e) {
        console.log(`[prerender] skip ${route}: ${String(e).slice(0, 80)}`);
      }
    }
  } catch (e) {
    console.log(`[prerender] browser unavailable — skipping: ${String(e).slice(0, 100)}`);
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.close();
  }
  console.log(`[prerender] done — ${ok}/${routes.length} routes`);
}

// Never throw — best-effort only.
main().catch((e) => { console.log('[prerender] error (ignored):', String(e).slice(0, 120)); process.exit(0); });
