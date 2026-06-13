/**
 * backfill-script-documents.ts — hydrate every project's ScriptDocument.
 *
 * For each row in movie_projects:
 *   1. If script_document is already a valid versioned document, skip.
 *   2. Otherwise, fetch the project's genesis_scenes, video_clips,
 *      shot_takes, and project_characters rows.
 *   3. Pass everything to hydrateScriptDocument from
 *      src/lib/editor/hydrate-document — get a typed ScriptDocument.
 *   4. UPDATE movie_projects SET script_document = <doc>.
 *
 * Idempotency:
 *   The "already-hydrated" check uses schemaVersion on the existing
 *   document. Re-running the script touches only projects that
 *   haven't been backfilled yet, or projects whose schemaVersion is
 *   below the current one (forward migrations land here).
 *
 * Run:
 *   bunx tsx scripts/backfill-script-documents.ts             # dry run
 *   bunx tsx scripts/backfill-script-documents.ts --apply     # write
 *   bunx tsx scripts/backfill-script-documents.ts --apply \
 *       --project=<uuid>                                      # one project
 *
 * Why this matters:
 *   The legacy editor surfaces still read from the five-table model.
 *   The document is wave-2 forward compatibility — wave 3 (the
 *   single generate-from-document edge function) and wave 4
 *   (cost preview + approval gate) BOTH read from the document.
 *   Backfilling early means those waves can ship without a chicken-
 *   and-egg "I need a document before I can write one" problem.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  hydrateScriptDocument,
  type MovieProjectRow,
  type SceneRow,
  type ClipRow,
  type TakeRow,
  type CharacterRow,
} from "../src/lib/editor/hydrate-document";
import { SCRIPT_DOCUMENT_VERSION } from "../src/lib/editor/script-document";

const SUPABASE_URL = "https://ywcwaumozoejierlfkgj.supabase.co";

function loadServiceKey(): string {
  const env = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
  const line = env
    .split("\n")
    .find((l) => l.startsWith("SUPABASE_SERVICE_ROLE_KEY="));
  if (!line) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing from .env.local");
  return line.slice("SUPABASE_SERVICE_ROLE_KEY=".length).trim();
}

const KEY = loadServiceKey();

interface CliArgs {
  apply: boolean;
  projectId: string | null;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  return {
    apply: args.includes("--apply"),
    projectId: args.find((a) => a.startsWith("--project="))?.slice("--project=".length) ?? null,
  };
}

const CLI = parseArgs();

async function rest(
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`REST ${path} → ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

interface Report {
  scanned: number;
  alreadyDone: number;
  hydrated: number;
  written: number;
  failed: number;
}

const report: Report = {
  scanned: 0,
  alreadyDone: 0,
  hydrated: 0,
  written: 0,
  failed: 0,
};

function hasCurrentDocument(maybeDoc: unknown): boolean {
  if (!maybeDoc || typeof maybeDoc !== "object") return false;
  const t = maybeDoc as Record<string, unknown>;
  if (typeof t.schemaVersion !== "number") return false;
  return t.schemaVersion >= SCRIPT_DOCUMENT_VERSION;
}

async function backfillOne(project: MovieProjectRow): Promise<void> {
  report.scanned += 1;
  const id = project.id;

  if (hasCurrentDocument(project.script_document)) {
    report.alreadyDone += 1;
    console.log(`  ↺  ${id.slice(0, 8)}  already hydrated`);
    return;
  }

  // Fetch the project's related rows in parallel — same pattern the
  // editor's useProject hook uses, but service-role authenticated.
  const [scenes, clips, takes, characters] = await Promise.all([
    rest(
      `genesis_scenes?select=id,scene_number,title,description,duration_seconds,mood,time_of_day,act_number,is_key_scene,visual_prompt,camera_directions&order=scene_number.asc&limit=0`,
    ).catch(() => []) as Promise<SceneRow[]>,
    rest(
      `video_clips?select=id,prompt,duration_seconds,video_url,start_image_url,last_frame_url,created_at,project_id,status&project_id=eq.${id}&order=created_at.asc`,
    ) as Promise<ClipRow[]>,
    rest(
      `shot_takes?select=id,shot_index,take_number,video_url,thumbnail_url,prompt_used,status,created_at&project_id=eq.${id}&order=shot_index.asc&order=take_number.desc`,
    ).catch(() => []) as Promise<TakeRow[]>,
    rest(
      `project_characters?select=id,name,role,description,identity_dna,wardrobe,physical_description,reference_image_url,avatar_id,voice_profile_id&project_id=eq.${id}`,
    ).catch(() => []) as Promise<CharacterRow[]>,
  ]);

  const doc = hydrateScriptDocument({
    project,
    scenes: Array.isArray(scenes) ? scenes : [],
    clips: Array.isArray(clips) ? clips : [],
    takes: Array.isArray(takes) ? takes : [],
    characters: Array.isArray(characters) ? characters : [],
  });
  report.hydrated += 1;

  const summary = `scenes:${doc.scenes.length} shots:${doc.scenes.reduce((s, sc) => s + sc.shots.length, 0)} cast:${doc.cast.length} template:${doc.template.id}`;

  if (!CLI.apply) {
    console.log(`  ↻  ${id.slice(0, 8)}  WOULD-WRITE  ${summary}`);
    return;
  }

  try {
    await rest(`movie_projects?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify({ script_document: doc }),
    });
    report.written += 1;
    console.log(`  ✓  ${id.slice(0, 8)}  WROTE       ${summary}`);
  } catch (e) {
    report.failed += 1;
    console.warn(`  ⚠  ${id.slice(0, 8)}  WRITE-FAIL  ${e}`);
  }
}

async function main(): Promise<void> {
  console.log("─── ScriptDocument backfill ───");
  console.log(`Mode: ${CLI.apply ? "APPLY (will write)" : "DRY RUN"}`);
  if (CLI.projectId) console.log(`Scope: project ${CLI.projectId}`);
  else console.log("Scope: all projects");
  console.log(`Schema version: ${SCRIPT_DOCUMENT_VERSION}`);
  console.log("");

  const projectFilter = CLI.projectId ? `id=eq.${CLI.projectId}` : "";
  const projectQuery = projectFilter
    ? `movie_projects?select=*&${projectFilter}`
    : `movie_projects?select=*&order=updated_at.desc`;

  console.log("Fetching projects…");
  const projects = (await rest(projectQuery)) as MovieProjectRow[];
  console.log(`  ${projects.length} projects`);
  console.log("");

  for (let i = 0; i < projects.length; i++) {
    const p = projects[i];
    process.stdout.write(`  [${i + 1}/${projects.length}] `);
    try {
      await backfillOne(p);
    } catch (e) {
      report.failed += 1;
      console.warn(`  ⚠  ${p.id.slice(0, 8)}  HYDRATE-FAIL  ${e}`);
    }
  }

  console.log("");
  console.log("─── Done ───");
  console.log(`Scanned       : ${report.scanned}`);
  console.log(`Already done  : ${report.alreadyDone}`);
  console.log(`Hydrated      : ${report.hydrated}`);
  console.log(`Written       : ${report.written}`);
  console.log(`Failed        : ${report.failed}`);
  console.log("");
  if (!CLI.apply) {
    console.log("This was a DRY RUN. Re-run with --apply to actually write.");
  }
}

void main().catch((e) => {
  console.error("Backfill failed:", e);
  process.exit(1);
});
