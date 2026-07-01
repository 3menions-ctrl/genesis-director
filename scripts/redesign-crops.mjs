// Tight crops of the two changed regions for close visual audit.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

function env(k) {
  for (const f of [".env", ".env.local"]) {
    try {
      const l = readFileSync(f, "utf8").split("\n").find((x) => x.startsWith(k + "="));
      if (l) return l.slice(k.length + 1).trim().replace(/^["']|["']$/g, "");
    } catch {}
  }
  return "";
}
const URL = env("VITE_SUPABASE_URL");
const ANON = env("VITE_SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_ANON_KEY");
const SR = env("SUPABASE_SERVICE_ROLE_KEY");
const REF = URL.replace("https://", "").split(".")[0];
const STORAGE_KEY = `sb-${REF}-auth-token`;
const DEMO_EMAIL = "demo-mira@smallbridges.test";
const DEMO_ID = "bb77364d-047b-4abb-a726-eca49d33e40d";
const NEWPASS = `Crop!${Date.now()}xZ`;

await fetch(`${URL}/auth/v1/admin/users/${DEMO_ID}`, {
  method: "PUT",
  headers: { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" },
  body: JSON.stringify({ password: NEWPASS }),
});
const session = await (await fetch(`${URL}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ email: DEMO_EMAIL, password: NEWPASS }),
})).json();

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await ctx.addInitScript(([k, v]) => { localStorage.setItem(k, v); }, [STORAGE_KEY, JSON.stringify(session)]);
const page = await ctx.newPage();

// Library stat rail — clip the band beneath the heading.
await page.goto("http://localhost:7788/library", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: "/tmp/crop-library-stats.png", clip: { x: 0, y: 120, width: 1440, height: 320 } });
console.log("crop-library-stats");

// Profile header toolbar — top-right action cluster.
await page.goto("http://localhost:7788/account", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(2800);
await page.screenshot({ path: "/tmp/crop-account-toolbar.png", clip: { x: 700, y: 40, width: 740, height: 240 } });
console.log("crop-account-toolbar");

// Profile left identity column quick-tools (Inbox/Credits/Settings).
await page.screenshot({ path: "/tmp/crop-account-quicktools.png", clip: { x: 0, y: 280, width: 520, height: 360 } });
console.log("crop-account-quicktools");

await browser.close();
console.log("done");
