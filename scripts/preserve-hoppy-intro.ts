/**
 * preserve-hoppy-intro.ts
 *
 * Upload the preserved, stitched landing Hoppy intro to the user's storage +
 * Media Library so it can never be lost with the remote asset host.
 *
 * Mirrors upload-downloads-to-media-library.ts exactly: service-role key from
 * .env.local, resolve user by email, upload to the `video-clips` bucket under
 * the user's namespace, register via the `record_user_media` RPC (shows in the
 * editor Media Library "Mine" tab). Idempotent — storage upsert + RPC upsert on
 * (user_id, asset_url). Safe to re-run.
 *
 * Run:
 *   npx tsx scripts/preserve-hoppy-intro.ts          # dry-run
 *   npx tsx scripts/preserve-hoppy-intro.ts --apply  # upload
 */
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ywcwaumozoejierlfkgj.supabase.co";
const USER_EMAIL = "3menions@gmail.com";
const LOCAL_FILE = resolve(process.cwd(), "preserved/landing-hoppy-intro-stitched.mp4");
const TITLE = "Landing Hoppy Intro (Stitched)";
const SOURCE_URL =
  "https://apex-studio.ai/__l5e/assets-v1/4b8810b3-4a03-4ffb-9b67-c79a9bb59ecd/landing-hoppy-intro.mp4";
const SHA256 = "de86cf23f963b8f71a163f630f95db4b17040eeada3a5eb7c6893444066f801a";

function loadServiceKey(): string {
  const env = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
  const line = env.split("\n").find((l) => l.startsWith("SUPABASE_SERVICE_ROLE_KEY="));
  if (!line) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing from .env.local");
  return line.slice("SUPABASE_SERVICE_ROLE_KEY=".length).trim();
}

const APPLY = process.argv.includes("--apply");
const supa = createClient(SUPABASE_URL, loadServiceKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserId(): Promise<string> {
  const { data, error } = await supa.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  const match = data.users.find((u) => (u.email ?? "").toLowerCase() === USER_EMAIL.toLowerCase());
  if (!match) throw new Error(`No auth user found for ${USER_EMAIL}`);
  return match.id;
}

async function main(): Promise<void> {
  const size = statSync(LOCAL_FILE).size;
  const userId = await findUserId();
  const storagePath = `${userId}/preserved/landing-hoppy-intro-stitched.mp4`;

  console.log(`User:    ${USER_EMAIL} → ${userId}`);
  console.log(`File:    ${LOCAL_FILE} (${(size / 1048576).toFixed(2)} MB)`);
  console.log(`Bucket:  video-clips/${storagePath}`);
  console.log(`Media:   user_media_assets via record_user_media (type=video)`);

  if (!APPLY) {
    console.log("\n[dry-run] re-run with --apply to upload.");
    return;
  }

  const bytes = readFileSync(LOCAL_FILE);
  const up = await supa.storage.from("video-clips").upload(storagePath, bytes, {
    contentType: "video/mp4",
    upsert: true,
  });
  if (up.error) throw new Error(`storage upload failed: ${up.error.message}`);

  const assetUrl = supa.storage.from("video-clips").getPublicUrl(storagePath).data.publicUrl;

  const { data: id, error: rpcErr } = await supa.rpc("record_user_media", {
    p_user_id: userId,
    p_media_type: "video",
    p_asset_url: assetUrl,
    p_source: "manual-upload",
    p_title: TITLE,
    p_file_size_bytes: size,
    p_mime_type: "video/mp4",
    p_metadata: { origin: "preserved-landing-asset", source_url: SOURCE_URL, sha256: SHA256 },
  });
  if (rpcErr) throw new Error(`record_user_media failed: ${rpcErr.message}`);

  console.log(`\n✓ Uploaded → ${assetUrl}`);
  console.log(`✓ Media Library asset id: ${id}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
