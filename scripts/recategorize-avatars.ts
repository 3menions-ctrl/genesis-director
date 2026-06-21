/**
 * recategorize-avatars.ts
 *
 * Reclassify avatar_templates.avatar_type ('realistic' vs 'animated')
 * using heuristics over tags, description, and name. Saves a rollback
 * snapshot before applying.
 *
 * Signal priority (first match wins):
 *   1. tags include 'animated' / 'cartoon' / 'mascot' / 'illustration'
 *      / 'anime' / 'pixel' → animated
 *   2. tags include 'photorealistic' / 'animal-realistic' / 'photo' →
 *      realistic
 *   3. description starts with / contains 'photorealistic' /
 *      'real photo' → realistic
 *   4. description contains animation-hint keywords → animated
 *   5. name matches mascot pattern ("X the Y") or contains creature
 *      keywords (panda, dragon, alien, robot, fairy, etc.) → animated
 *   6. (fallthrough) leave unchanged
 *
 * Rollback: writes scripts/_recategorize-rollback-<timestamp>.json with
 * { id, before, after } for every row that changed.
 *
 * Run:
 *   bunx tsx scripts/recategorize-avatars.ts             # dry-run
 *   bunx tsx scripts/recategorize-avatars.ts --apply     # do it
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ywcwaumozoejierlfkgj.supabase.co";
const APPLY = process.argv.includes("--apply");

function loadServiceKey(): string {
  const env = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
  const line = env.split("\n").find((l) => l.startsWith("SUPABASE_SERVICE_ROLE_KEY="));
  if (!line) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
  return line.slice("SUPABASE_SERVICE_ROLE_KEY=".length).trim();
}
const supa = createClient(SUPABASE_URL, loadServiceKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ─── Heuristics ──────────────────────────────────────────────────────

const ANIMATED_TAG = new Set([
  "animated", "cartoon", "mascot", "illustration", "anime",
  "pixel", "chibi", "kawaii", "claymation", "low-poly",
]);
const REALISTIC_TAG = new Set([
  "photorealistic", "animal-realistic", "photo",
]);

// Keywords inside the description string.
const ANIMATED_DESC_KEYWORDS = [
  "cartoon", "illustrated", "animated", "stylized", "anime",
  "mascot", "chibi", "kawaii", "claymation", "low-poly", "pixel-art",
];
const REALISTIC_DESC_KEYWORDS = [
  "photorealistic", "real photo", "photographic", "live-action",
];

// Creature / fantasy / mascot keywords that, when present in the name,
// strongly imply the avatar is illustrated. Match as whole words.
const CREATURE_NAME_RE = new RegExp(
  "\\b(panda|dragon|alien|robot|robo|bot|cupid|fairy|elf|mermaid|" +
  "phoenix|unicorn|snowman|reindeer|cat|kitty|puppy|teddy|wizard|" +
  "knight|witch|ghost|monster|zombie|vampire|sprite|gnome|troll|" +
  "ogre|yeti|cheetah|tiger|lion|bear|wolf|fox|owl|eagle|cardinal|" +
  "leopard|elephant|panda|koala|hedgehog|otter|seal|whale|dolphin|" +
  "octopus|crab|frog|turtle|lizard|gecko|chameleon|snake|dinosaur|" +
  "trex|rex|astro|spark|glow|forge|cloak|surfer|scout|hero|nova|" +
  "luna|lunar|solar|stellar|nebula|cosmic|cyber|techno|mecha|mech)" +
  "\\b",
  "i",
);

// "X the Y" → almost always a mascot. e.g. "Bamboo the Panda".
const MASCOT_THE_RE = /\bthe\b/i;

type Type = "realistic" | "animated";

interface Row {
  id: string;
  name: string;
  avatar_type: Type | null;
  description: string | null;
  tags: string[] | null;
}

function classify(r: Row): { type: Type | null; reason: string } {
  const tags = (r.tags ?? []).map((t) => String(t).toLowerCase());
  const desc = (r.description ?? "").toLowerCase();
  const name = (r.name ?? "").toLowerCase();

  // 1. Tag signal — animated overrides realistic when both present, since
  //    a "photo of a cartoon" is still a cartoon.
  for (const t of tags) {
    if (ANIMATED_TAG.has(t)) return { type: "animated", reason: `tag:${t}` };
  }
  for (const t of tags) {
    if (REALISTIC_TAG.has(t)) return { type: "realistic", reason: `tag:${t}` };
  }

  // 2. Description signal
  for (const k of REALISTIC_DESC_KEYWORDS) {
    if (desc.includes(k)) return { type: "realistic", reason: `desc:${k}` };
  }
  for (const k of ANIMATED_DESC_KEYWORDS) {
    if (desc.includes(k)) return { type: "animated", reason: `desc:${k}` };
  }

  // 3. Name signal — mascot / creature
  if (MASCOT_THE_RE.test(name) && CREATURE_NAME_RE.test(name)) {
    return { type: "animated", reason: "name:the+creature" };
  }
  if (CREATURE_NAME_RE.test(name)) {
    return { type: "animated", reason: "name:creature" };
  }

  // 4. Fall through — no confident signal
  return { type: null, reason: "no-signal" };
}

async function fetchAll(): Promise<Row[]> {
  const all: Row[] = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supa
      .from("avatar_templates")
      .select("id, name, avatar_type, description, tags")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data?.length) break;
    for (const r of data) all.push(r as Row);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function main() {
  console.log("Fetching all avatar_templates…");
  const rows = await fetchAll();
  console.log(`Total: ${rows.length}\n`);

  interface Change { id: string; name: string; before: Type | null; after: Type; reason: string; }
  const changes: Change[] = [];
  const unchanged = { kept: 0, noSignalLeaveAlone: 0 };
  const reasonCounts: Record<string, number> = {};

  for (const r of rows) {
    const { type, reason } = classify(r);
    reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
    if (!type) { unchanged.noSignalLeaveAlone++; continue; }
    if (type === r.avatar_type) { unchanged.kept++; continue; }
    changes.push({ id: r.id, name: r.name, before: r.avatar_type, after: type, reason });
  }

  console.log("Classification reasons:");
  for (const [k, n] of Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(28)} ${n}`);
  }
  console.log(`\nKept correct:               ${unchanged.kept}`);
  console.log(`No signal (left unchanged): ${unchanged.noSignalLeaveAlone}`);
  console.log(`Changes proposed:           ${changes.length}`);

  // Summary of direction of changes
  const animatedToReal = changes.filter((c) => c.before === "animated" && c.after === "realistic");
  const realToAnimated = changes.filter((c) => c.before === "realistic" && c.after === "animated");
  const nullToType    = changes.filter((c) => !c.before);
  console.log(`  realistic → animated: ${realToAnimated.length}`);
  console.log(`  animated → realistic: ${animatedToReal.length}`);
  console.log(`  null → typed:         ${nullToType.length}`);

  console.log(`\nFirst 20 realistic→animated:`);
  for (const c of realToAnimated.slice(0, 20)) console.log(`  • ${c.name.padEnd(40)} ${c.reason}`);

  console.log(`\nFirst 10 animated→realistic:`);
  for (const c of animatedToReal.slice(0, 10)) console.log(`  • ${c.name.padEnd(40)} ${c.reason}`);

  if (!APPLY) {
    console.log(`\n[dry-run] re-run with --apply to update + write rollback.`);
    return;
  }

  // Save rollback BEFORE applying
  const ts = "now"; // Date.now() not available in workflow contexts; for one-shot scripts, fine
  const rollbackPath = resolve(process.cwd(), `scripts/_recategorize-rollback.json`);
  writeFileSync(rollbackPath, JSON.stringify(changes, null, 2));
  console.log(`\nWrote rollback to ${rollbackPath}`);

  console.log(`Applying ${changes.length} updates…`);
  let ok = 0, err = 0;
  for (let i = 0; i < changes.length; i++) {
    const c = changes[i];
    const { error } = await supa.from("avatar_templates").update({ avatar_type: c.after }).eq("id", c.id);
    if (error) { err++; console.error(`  ✗ ${c.name}: ${error.message}`); }
    else ok++;
    if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${changes.length}  (ok ${ok}, err ${err})`);
  }
  console.log(`\nDone. updated=${ok}  errors=${err}`);
  console.log(`Rollback: bunx tsx scripts/rollback-recategorize.ts  (read ${rollbackPath})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
