// Screenshots of every native iOS-app screen, rendered in a headless iPhone
// viewport against the ios-app worktree dev server (port 7799). Forces the
// mobile shell (localStorage sb_shell=mobile) and injects a demo user session
// so authenticated screens render.
import { chromium, devices } from "playwright";
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
const NEWPASS = `Ios!${Date.now()}xZ`;
const BASE = "http://localhost:7799";

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
console.log("session:", session.access_token ? "Y" : "N", session.error_description || "");

const iphone = devices["iPhone 14 Pro"];
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ ...iphone });
// Force mobile shell + inject auth before any app script runs.
await ctx.addInitScript(([k, v]) => {
  localStorage.setItem("sb_shell", "mobile");
  localStorage.setItem(k, v);
}, [STORAGE_KEY, JSON.stringify(session)]);
const page = await ctx.newPage();

const screens = [
  { path: "/feed", name: "01-feed" },
  { path: "/discover", name: "02-discover" },
  { path: "/create", name: "03-create" },
  { path: "/presets", name: "04-editor-presets" },
  { path: "/you", name: "05-profile-you" },
  { path: "/me/library", name: "06-library" },
  { path: "/me/plans", name: "07-plans-credits" },
  { path: "/messages", name: "08-messages" },
  { path: "/activity", name: "09-activity" },
  { path: "/leaderboard", name: "10-leaderboard" },
  { path: "/me/recap", name: "11-year-recap" },
  { path: "/avatars", name: "12-avatars" },
  { path: "/me/settings", name: "13-settings" },
  { path: "/me/settings/notifications", name: "14-settings-notifications" },
  { path: "/me/settings/privacy", name: "15-settings-privacy" },
  { path: "/me/settings/account", name: "16-settings-account" },
  { path: "/welcome", name: "17-welcome" },
  { path: `/u/${DEMO_ID}`, name: "18-public-profile" },
  { path: "/", name: "19-root" },
];

const results = [];
for (const s of screens) {
  try {
    await page.goto(`${BASE}${s.path}?shell=mobile`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(2800);
    const out = `/tmp/ios-${s.name}.png`;
    await page.screenshot({ path: out });
    results.push({ name: s.name, url: page.url(), out });
    console.log("shot:", out, "→", page.url());
  } catch (e) {
    console.log("FAIL", s.path, e.message.split("\n")[0]);
    results.push({ name: s.name, error: e.message.split("\n")[0] });
  }
}
await browser.close();
console.log("DONE", results.length, "screens");
