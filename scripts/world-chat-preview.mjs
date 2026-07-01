/**
 * Throwaway preview: seed a couple of World Chat messages (one with an image)
 * from temp users, screenshot the signed-in redesign, then DELETE everything
 * so prod chat is left exactly as it was.
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const URL = process.env.VITE_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const REF = "ywcwaumozoejierlfkgj";
const STORAGE_KEY = `sb-${REF}-auth-token`;

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const made = []; // {id, client, session, name}
const postedIds = [];
const storagePaths = [];

async function makeUser(name) {
  const email = `wc-preview-${Date.now()}-${Math.round(Math.random() * 1e6)}@example.com`;
  const password = "Preview!" + Math.random().toString(36).slice(2, 10);
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const id = data.user.id;
  await admin.from("profiles").update({ display_name: name }).eq("id", id);
  const client = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data: s, error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  made.push({ id, client, session: s.session, name });
  return made[made.length - 1];
}

try {
  const alice = await makeUser("Ava Directs");
  const bob = await makeUser("Marco Reels");

  // Upload a sample image as Ava → public URL.
  const buf = fs.readFileSync("src/assets/landing-immersive-hero.jpg");
  const path = `${alice.id}/${Date.now()}-preview.jpg`;
  storagePaths.push(path);
  const up = await alice.client.storage.from("world-chat").upload(path, buf, { contentType: "image/jpeg" });
  if (up.error) throw up.error;
  const imgUrl = alice.client.storage.from("world-chat").getPublicUrl(path).data.publicUrl;

  const post = async (u, body, image) => {
    const { data, error } = await u.client.rpc("post_world_chat", { p_body: body, p_image_url: image ?? null });
    if (error) throw error;
    if (data?.id) postedIds.push(data.id);
    await new Promise((r) => setTimeout(r, 1300)); // respect the 1.2s flood guard
  };

  await post(bob, "yo, the lobby looks unreal tonight 🔥");
  await post(alice, "right?? just wrapped a noir short — peek:");
  await post(alice, "", imgUrl);
  await post(bob, "okay that lighting is insane. drop the preset 🙏");

  // Screenshot signed in as Bob (so Ava's name shows colored, Bob's as "you").
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  const sess = bob.session;
  await page.addInitScript(
    ([k, v]) => window.localStorage.setItem(k, v),
    [STORAGE_KEY, JSON.stringify(sess)]
  );
  await page.goto("http://localhost:7777/lobby", { waitUntil: "networkidle", timeout: 60000 });
  const wc = page.locator('[data-testid="world-chat"]');
  await wc.waitFor({ state: "visible", timeout: 20000 });
  await page.waitForTimeout(2500);
  await wc.screenshot({ path: "/tmp/wc2-signedin.png" });
  console.log("screenshot saved");
  await browser.close();
} catch (e) {
  console.log("ERROR:", e.message);
} finally {
  // Cleanup: posted rows, storage objects, users.
  for (const id of postedIds) await admin.from("world_chat").delete().eq("id", id);
  if (storagePaths.length) await admin.storage.from("world-chat").remove(storagePaths);
  for (const u of made) await admin.auth.admin.deleteUser(u.id);
  console.log("cleanup done:", postedIds.length, "msgs,", storagePaths.length, "files,", made.length, "users removed");
}
