// Authenticated screenshots for the Library + reg-user Account redesign.
// Logs in as an existing demo user (has real library content) via Supabase
// admin password reset → password grant → localStorage session injection,
// then screenshots the requested routes. Usage:
//   node scripts/redesign-shots.mjs <tag>      e.g. "before" | "after"
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

const tag = process.argv[2] || "shot";
const URL = env("VITE_SUPABASE_URL");
const ANON = env("VITE_SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_ANON_KEY");
const SR = env("SUPABASE_SERVICE_ROLE_KEY");
const REF = URL.replace("https://", "").split(".")[0];
const STORAGE_KEY = `sb-${REF}-auth-token`;

const DEMO_EMAIL = "demo-mira@smallbridges.test";
const DEMO_ID = "bb77364d-047b-4abb-a726-eca49d33e40d";
const NEWPASS = `Shot!${Date.now()}xZ`;

async function adminPut(path, body) {
  const r = await fetch(`${URL}${path}`, {
    method: "PUT",
    headers: { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: r.status, json: await r.json().catch(() => ({})) };
}

console.log("resetting demo password…");
const up = await adminPut(`/auth/v1/admin/users/${DEMO_ID}`, { password: NEWPASS });
console.log("  admin update:", up.status);

const tok = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ email: DEMO_EMAIL, password: NEWPASS }),
});
const session = await tok.json();
console.log("session token:", session.access_token ? "Y" : "N", session.error_description || "");

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 980 }, deviceScaleFactor: 2 });
await ctx.addInitScript(([k, v]) => { localStorage.setItem(k, v); }, [STORAGE_KEY, JSON.stringify(session)]);
const page = await ctx.newPage();

const shots = [
  { path: "/library", name: `library-${tag}` },
  { path: "/account", name: `account-profile-${tag}` },
  { path: "/account?tab=settings", name: `account-settings-${tag}` },
  { path: "/account?tab=credits", name: `account-credits-${tag}` },
  { path: "/account?tab=developers", name: `account-developers-${tag}` },
];

for (const s of shots) {
  try {
    await page.goto(`http://localhost:7788${s.path}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(2600);
    const out = `/tmp/${s.name}.png`;
    await page.screenshot({ path: out, fullPage: true });
    console.log("shot:", out, "→ url:", page.url());
  } catch (e) {
    console.log("FAIL", s.path, e.message);
  }
}

await browser.close();
console.log("done");
