/**
 * seed-demo-script.ts — one-shot demo screenplay.
 *
 * Writes a hand-authored screenplay onto the "Public · Studio Sampler"
 * project (or any project the user passes via --project=<uuid>) so
 * the editor's Script tab has real, formatted content to render
 * against the existing three sampler clips.
 *
 * The screenplay is industry-format:
 *   - Three INT./EXT. slug-lines that anchor to the three clips
 *   - Action paragraphs in proper case
 *   - Character cues in ALL CAPS
 *   - Dialogue indented under the cue
 *   - Parenthetical (whispered) under one cue
 *   - CUT TO: + FADE IN/OUT transitions
 *
 * Run:
 *   bunx tsx scripts/seed-demo-script.ts             # dry run
 *   bunx tsx scripts/seed-demo-script.ts --apply     # actually write
 *   bunx tsx scripts/seed-demo-script.ts --apply --project=<uuid>
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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
    projectId:
      args.find((a) => a.startsWith("--project="))?.slice("--project=".length) ??
      null,
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
  if (!res.ok) throw new Error(`REST ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// The screenplay — written to map 1:1 to the Studio Sampler's three
// clips: harbour-town establishing wide / lighthouse beam through fog
// / final pull-back at golden hour.
// ─────────────────────────────────────────────────────────────────────────────
const SCREENPLAY = `FADE IN:

EXT. HARBOUR TOWN - DAWN

A wide aerial drift over slate roofs and stone quays. Dawn light catches the water. The town is quiet — boats motionless against the moorings, gulls just beginning their first calls. A church bell strikes once, far off.

                    MARA (V.O.)
          They said I'd come back here. They
          said the sea would remember me.

CUT TO:

EXT. LIGHTHOUSE - NIGHT

A massive beam of white light sweeps through dense fog. The rhythm is metronomic. Each pass illuminates the rocky shoreline for one held second, then the dark returns. Up at the lantern room, a silhouette: the KEEPER, watching.

                    KEEPER
          She's out there. She always was.

                    KEEPER (CONT'D)
                    (to himself)
          I should have called her in.

CUT TO:

EXT. CLIFF EDGE - GOLDEN HOUR

The camera pulls back from a woman standing at the cliff's edge — MARA, late thirties, the same gravity as the lighthouse keeper but kinder. The town is below, gilt in late sunlight. Slowly, the frame widens until she's a single silhouette against the horizon. The sea is a sheet of beaten copper.

                    MARA (CONT'D)
                    (whispered)
          I remember.

FADE OUT.

THE END.
`;

interface ProjectRow {
  id: string;
  title: string;
  script_content: string | null;
}

async function pickProject(): Promise<ProjectRow | null> {
  if (CLI.projectId) {
    const rows = (await rest(
      `movie_projects?select=id,title,script_content&id=eq.${CLI.projectId}&limit=1`,
    )) as ProjectRow[];
    return rows[0] ?? null;
  }
  // Try the sampler first; fall back to any public project the user
  // might have set up.
  const sampler = (await rest(
    `movie_projects?select=id,title,script_content&title=eq.${encodeURIComponent('"Public · Studio Sampler"')}&limit=1`,
  )) as ProjectRow[];
  if (sampler[0]) return sampler[0];
  const anyPublic = (await rest(
    `movie_projects?select=id,title,script_content&title=like.*Public*&limit=1&order=created_at.asc`,
  )) as ProjectRow[];
  return anyPublic[0] ?? null;
}

async function main(): Promise<void> {
  console.log("─── Demo screenplay seed ───");
  console.log(`Mode: ${CLI.apply ? "APPLY" : "DRY RUN"}`);
  console.log("");

  const project = await pickProject();
  if (!project) {
    console.error("No project found. Pass --project=<uuid> to target one explicitly.");
    process.exit(1);
  }

  console.log(`Target  : ${project.title}  (${project.id.slice(0, 8)})`);
  console.log(`Existing: ${project.script_content ? `${project.script_content.length} chars` : "(empty)"}`);
  console.log(`New     : ${SCREENPLAY.length} chars  /  ${SCREENPLAY.split(/\r?\n/).length} lines`);
  console.log("");

  if (!CLI.apply) {
    console.log("──── Preview ────");
    console.log(SCREENPLAY);
    console.log("──────────────────");
    console.log("");
    console.log("Re-run with --apply to actually write.");
    return;
  }

  await rest(`movie_projects?id=eq.${project.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      script_content: SCREENPLAY,
      generated_script: null,
    }),
  });
  console.log("✓ Wrote screenplay to script_content + cleared generated_script.");
  console.log("");
  console.log(`Open /editor/${project.id}?tab=script in the app to see it.`);
}

void main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
