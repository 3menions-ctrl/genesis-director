/**
 * Verify World Chat delete: owner can delete own; RLS blocks deleting others'.
 * Also screenshots the trash affordance on an own message. Cleans up after.
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.VITE_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const REF = "ywcwaumozoejierlfkgj";
const STORAGE_KEY = `sb-${REF}-auth-token`;

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const made = [];
const leftoverIds = [];

async function makeUser(name) {
  const email = `wc-del-${Date.now()}-${Math.round(Math.random() * 1e6)}@example.com`;
  const password = "Del!" + Math.random().toString(36).slice(2, 10);
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  await admin.from("profiles").update({ display_name: name }).eq("id", data.user.id);
  const client = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data: s, error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  const u = { id: data.user.id, client, session: s.session, name };
  made.push(u);
  return u;
}
const post = async (u, body) => {
  const { data, error } = await u.client.rpc("post_world_chat", { p_body: body, p_image_url: null });
  if (error) throw error;
  await new Promise((r) => setTimeout(r, 1300));
  return data.id;
};
const exists = async (id) => {
  const { data } = await admin.from("world_chat").select("id").eq("id", id).maybeSingle();
  return !!data;
};

try {
  const alice = await makeUser("Ava Directs");
  const bob = await makeUser("Marco Reels");

  const idA = await post(alice, "Ava's message — she should be able to delete this");
  const idB = await post(bob, "Marco's message — Ava must NOT be able to delete this");
  leftoverIds.push(idA, idB);

  // 1) Ava tries to delete Bob's message → RLS blocks (no error, row remains).
  await alice.client.from("world_chat").delete().eq("id", idB);
  const bobSurvives = await exists(idB);

  // 2) Ava deletes her own → succeeds.
  await alice.client.from("world_chat").delete().eq("id", idA);
  const avaGone = !(await exists(idA));

  console.log(`RESULT cross-user-delete-blocked: ${bobSurvives}  (expect true)`);
  console.log(`RESULT own-delete-works:          ${avaGone}     (expect true)`);

  // Screenshot: sign in as Bob, hover his own message to reveal the trash.
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), [STORAGE_KEY, JSON.stringify(bob.session)]);
  await page.goto("http://localhost:7777/lobby", { waitUntil: "networkidle", timeout: 60000 });
  const wc = page.locator('[data-testid="world-chat"]');
  await wc.waitFor({ state: "visible", timeout: 20000 });
  await page.waitForTimeout(1500);
  // hover Bob's message row to reveal the delete button
  const ownMsg = page.getByText("Marco's message", { exact: false }).first();
  try { await ownMsg.hover({ timeout: 4000 }); } catch { /* ok */ }
  await page.waitForTimeout(400);
  await wc.screenshot({ path: "/tmp/wc-delete.png" });
  console.log("screenshot saved");
  await browser.close();
} catch (e) {
  console.log("ERROR:", e.message);
} finally {
  for (const id of leftoverIds) await admin.from("world_chat").delete().eq("id", id);
  for (const u of made) await admin.auth.admin.deleteUser(u.id);
  console.log("cleanup done");
}
