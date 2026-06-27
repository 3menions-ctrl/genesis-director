// Provisions an organization + owner membership for the business test account so
// the /business/* cockpit pages render real content instead of the
// "No workspace selected" empty state. Idempotent. Service-role only.
//
//   node provision-org.mjs
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ENV_DIRS = [join(process.cwd(), ".."), "/Users/briancole/Developer/genesis-director"];
const ENV_FILES = [".env", ".env.local", ".env.development"];
const env = {};
for (const dir of ENV_DIRS) for (const name of ENV_FILES) {
  const f = join(dir, name);
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const URL = env.VITE_SUPABASE_URL, SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL = process.env.AUDIT_TEST_EMAIL || "design-audit-business@example.com";
const admin = (path, init = {}) => fetch(`${URL}${path}`, {
  ...init,
  headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", ...(init.headers || {}) },
});

// Find the business user.
const lr = await admin(`/auth/v1/admin/users?per_page=200`);
const list = await lr.json();
const user = (list.users || list).find((u) => u.email === EMAIL);
if (!user) throw new Error(`User ${EMAIL} not found — run make-auth.mjs first.`);
console.log("Business user:", user.id);

// 1) Organization (idempotent on slug). Insert minimal columns + sensible
//    extras; if a column/enum rejects, retry with the bare minimum.
const slug = "design-audit-co";
let org;
{
  const tryInsert = async (body) => {
    const r = await admin(`/rest/v1/organizations?on_conflict=slug`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(body),
    });
    return { ok: r.ok, status: r.status, text: await r.text() };
  };
  let res = await tryInsert({ name: "Design Audit Co", slug, created_by: user.id, credits_balance: 100000 });
  if (!res.ok) {
    console.warn("Full org insert rejected (", res.status, res.text.slice(0, 160), ") — retrying minimal");
    res = await tryInsert({ name: "Design Audit Co", slug, created_by: user.id });
  }
  if (!res.ok) {
    // Maybe it already exists — fetch it.
    const g = await admin(`/rest/v1/organizations?slug=eq.${slug}&select=*`);
    const rows = await g.json();
    if (!rows.length) throw new Error("Org insert failed: " + res.text);
    org = rows[0];
  } else {
    org = JSON.parse(res.text)[0] || JSON.parse(res.text);
  }
}
console.log("Organization:", org.id, `(${org.name})`);

// 2) Owner membership (idempotent on user_id+organization_id).
{
  const r = await admin(`/rest/v1/organization_members?on_conflict=organization_id,user_id`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ organization_id: org.id, user_id: user.id, role: "owner" }),
  });
  if (!r.ok && r.status !== 409) {
    // Try without on_conflict (composite may differ) then ignore dup.
    const r2 = await admin(`/rest/v1/organization_members`, {
      method: "POST", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ organization_id: org.id, user_id: user.id, role: "owner" }),
    });
    if (!r2.ok && r2.status !== 409) throw new Error("Membership insert failed: " + await r2.text());
  }
  console.log("Owner membership ensured for", EMAIL);
}
console.log("\n✅ Provisioned. /business/* should now render real content.");
