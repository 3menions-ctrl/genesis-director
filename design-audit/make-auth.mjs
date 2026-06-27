// Mints a Playwright storageState for a PERSONAL test account, so the audit can
// capture the real (authenticated) consumer surfaces. Read-only w.r.t. app
// source; it only creates a throwaway test user in Supabase.
//
//   node make-auth.mjs           → writes ./auth-personal.json
//
// Reads Supabase creds from the running app's env file (genesis-director).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// Public VITE_ vars live in .env; the service-role key lives in .env.local.
// Look in this worktree and the sibling genesis-director checkout (the app the
// dev server actually runs). Merge every file found.
const ENV_DIRS = [
  join(process.cwd(), ".."),
  "/Users/briancole/Developer/genesis-director",
];
const ENV_FILES = [".env", ".env.local", ".env.development"];
function loadEnv() {
  const env = {};
  const loaded = [];
  for (const dir of ENV_DIRS) {
    for (const name of ENV_FILES) {
      const file = join(dir, name);
      if (!existsSync(file)) continue;
      for (const line of readFileSync(file, "utf8").split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
      loaded.push(file);
    }
  }
  if (!loaded.length) throw new Error("No env files found in: " + ENV_DIRS.join(", "));
  console.log("Loaded env from:\n  " + loaded.join("\n  "));
  return env;
}

const env = loadEnv();
const URL = env.VITE_SUPABASE_URL;
const ANON = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !ANON || !SERVICE) throw new Error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY / SUPABASE_SERVICE_ROLE_KEY");

const projectRef = new global.URL(URL).host.split(".")[0];
const storageKey = `sb-${projectRef}-auth-token`;
// AUDIT_ACCOUNT_TYPE=personal|business|enterprise|admin (default personal).
// Each type gets its own throwaway user + its own auth-<type>.json.
const ACCOUNT_TYPE = process.env.AUDIT_ACCOUNT_TYPE || "personal";
const EMAIL = process.env.AUDIT_TEST_EMAIL || `design-audit-${ACCOUNT_TYPE}@example.com`;
const PASSWORD = process.env.AUDIT_TEST_PASSWORD || "Audit!Pass-2026xyz";

const admin = (path, init = {}) => fetch(`${URL}${path}`, {
  ...init,
  headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", ...(init.headers || {}) },
});

// 1) Create the user (idempotent — ignore "already registered").
let userId;
{
  const r = await admin("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, email_confirm: true }),
  });
  const body = await r.json();
  if (r.ok) { userId = body.id; console.log("Created user", EMAIL); }
  else {
    // already exists → look it up
    const lr = await admin(`/auth/v1/admin/users?per_page=200`);
    const list = await lr.json();
    const found = (list.users || list).find((u) => u.email === EMAIL);
    if (!found) throw new Error("User exists but could not be found: " + JSON.stringify(body));
    userId = found.id;
    console.log("Reusing existing user", EMAIL);
  }
}

// 2) Ensure a personal profile row exists (ProtectedRoute needs profile.id).
//    Upsert via PostgREST with the service role (bypasses RLS).
{
  const r = await admin(`/rest/v1/profiles?on_conflict=id`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ id: userId, account_type: ACCOUNT_TYPE }),
  });
  if (!r.ok && r.status !== 409) {
    console.warn("profiles upsert returned", r.status, await r.text(), "(continuing — a DB trigger may already create it)");
  } else {
    console.log(`Ensured ${ACCOUNT_TYPE} profile row`);
  }
}

// 3) Password sign-in to mint a real session (access + refresh tokens).
const tr = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
const session = await tr.json();
if (!tr.ok || !session.access_token) throw new Error("Sign-in failed: " + JSON.stringify(session));
console.log("Signed in; session expires_at", session.expires_at);

// 4) supabase-js v2 stores the whole session object under sb-<ref>-auth-token.
const storageValue = JSON.stringify(session);
const BASE = process.env.AUDIT_BASE_URL || "http://localhost:7777";
const storageState = {
  cookies: [],
  origins: [{ origin: BASE, localStorage: [{ name: storageKey, value: storageValue }] }],
};
const outPath = join(process.cwd(), `auth-${ACCOUNT_TYPE}.json`);
writeFileSync(outPath, JSON.stringify(storageState, null, 2));
console.log(`Wrote ${outPath}  (account_type=${ACCOUNT_TYPE})\nstorageKey: ${storageKey}`);
