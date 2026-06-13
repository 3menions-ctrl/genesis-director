/**
 * scripts/refresh-avatar-placeholders.ts
 *
 * Finds every row in avatar_templates whose face_image_url is still a
 * placehold.co URL and replaces it with the same head-to-toe silhouette
 * SVG that seed-avatars-from-presets.ts uses. Idempotent — safe to
 * re-run.
 *
 *   bunx tsx scripts/refresh-avatar-placeholders.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  const env: Record<string, string> = { ...process.env };
  for (const file of [".env", ".env.local"]) {
    try {
      const text = readFileSync(resolve(file), "utf8");
      for (const line of text.split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (!m) continue;
        const k = m[1];
        let v = m[2];
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        if (!env[k]) env[k] = v;
      }
    } catch {
      // ignore
    }
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.VITE_SUPABASE_URL ?? env.SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

function placeholderUrl(name: string, gender: string): string {
  const palette: Record<string, string> = {
    male: "#60a5fa",
    female: "#f472b6",
    neutral: "#a78bfa",
    "non-binary": "#a78bfa",
  };
  const accent = palette[gender] ?? "#9ca3af";
  const initial = name.charAt(0).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 1024" preserveAspectRatio="xMidYMid slice">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
<stop offset="0%" stop-color="#1a1a2e"/><stop offset="100%" stop-color="#0d0d1a"/>
</linearGradient></defs>
<rect width="512" height="1024" fill="url(#g)"/>
<text x="256" y="120" text-anchor="middle" font-family="Fraunces,serif" font-size="56" font-style="italic" fill="${accent}" fill-opacity="0.55">${initial}</text>
<circle cx="256" cy="290" r="78" fill="${accent}" fill-opacity="0.10" stroke="${accent}" stroke-opacity="0.20" stroke-width="2"/>
<path d="M 256 378 Q 196 410 176 500 L 168 700 Q 168 800 200 920 L 226 1024 L 286 1024 L 312 920 Q 344 800 344 700 L 336 500 Q 316 410 256 378 Z" fill="${accent}" fill-opacity="0.07" stroke="${accent}" stroke-opacity="0.16" stroke-width="2"/>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.replace(/\s+/g, " ").trim())}`;
}

interface Row {
  id: string;
  name: string;
  gender: string;
  face_image_url: string;
}

async function main() {
  // Find every row whose face_image_url is still the old placehold.co text URL.
  const listRes = await fetch(
    `${SUPABASE_URL}/rest/v1/avatar_templates?select=id,name,gender,face_image_url&face_image_url=like.*placehold.co*`,
    {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    },
  );
  if (!listRes.ok) {
    console.error("Failed to list:", await listRes.text());
    process.exit(1);
  }
  const rows = (await listRes.json()) as Row[];
  console.log(`Rows to refresh: ${rows.length}`);

  for (const r of rows) {
    const url = placeholderUrl(r.name, r.gender);
    const patchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/avatar_templates?id=eq.${r.id}`,
      {
        method: "PATCH",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          face_image_url: url,
          thumbnail_url: url,
          front_image_url: url,
        }),
      },
    );
    if (!patchRes.ok) {
      console.error(`  ${r.name}: FAILED — ${await patchRes.text()}`);
    } else {
      console.log(`  ${r.name}: ok`);
    }
  }

  // Confirm
  const countRes = await fetch(
    `${SUPABASE_URL}/rest/v1/avatar_templates?select=count&face_image_url=like.*placehold.co*`,
    {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: "count=exact",
        Range: "0-0",
      },
    },
  );
  console.log(
    `\nRemaining placehold.co rows: ${countRes.headers.get("content-range") ?? "?"}`,
  );
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
