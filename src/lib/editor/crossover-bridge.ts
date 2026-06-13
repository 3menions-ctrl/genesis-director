/**
 * crossover-bridge — turn a Crossover VFX template into a Scene
 * pre-fill on the ScriptDocument.
 *
 * Crossover lives at /crossover and renders 50 curated screen-
 * breakout templates from the `vfx_templates` supabase table. Each
 * template carries:
 *   - pure_prompt    The cinematic prompt the VFX pipeline ingests
 *   - recipe_slug    Selects the Python VFX branch on the backend
 *   - chrome_kind    UI shell to overlay (instagram, tiktok, etc)
 *   - lens_hint      Camera lens directive
 *   - aspect_ratio   Native aspect the recipe expects
 *   - duration_sec   Engineered for the recipe
 *
 * When the user picks a template inside the editor (via the
 * Storyboard's "+ Add scene" or a future Crossover composer that
 * lives inside the editor), the bridge produces a fully-populated
 * Scene with one VFX Shot. The orchestrator + approval gate +
 * status bus treat that shot identically to a regular generation —
 * the only difference is the pipeline routes it through
 * `mode-router` instead of `editor-generate-clip` so the Python
 * recipe runs.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  addScene,
  addShot,
} from "./document-store";
import {
  newScriptId,
  type Scene,
  type Shot,
  type ScriptDocument,
} from "./script-document";

// ─────────────────────────────────────────────────────────────────────────────
// Template row from the supabase vfx_templates table
// ─────────────────────────────────────────────────────────────────────────────

export interface VfxTemplateRow {
  id: string;
  slug: string;
  category: string;
  title: string;
  pure_prompt: string;
  recipe_slug: string | null;
  chrome_kind: string | null;
  lens_hint: string | null;
  aspect_ratio: string | null;
  duration_sec: number | null;
  thumbnail_url: string | null;
  description: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Load + materialise
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchTemplate(slug: string): Promise<VfxTemplateRow | null> {
  const { data, error } = await supabase
    .from("vfx_templates")
    .select(
      "id, slug, category, title, pure_prompt, recipe_slug, chrome_kind, lens_hint, aspect_ratio, duration_sec, thumbnail_url, description",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  return data as VfxTemplateRow;
}

/**
 * Materialise a VFX template as a Scene + Shot on the active
 * document. The shot lands in `draft` approval state so the user
 * goes through the standard "Approve & Render" gate — no surprise
 * spending.
 *
 * Returns the new Scene id + Shot id.
 */
export function instantiateTemplate(
  template: VfxTemplateRow,
  doc: ScriptDocument,
): { sceneId: string; shotId: string } {
  const sceneId = addScene(
    {
      slug: `VFX · ${template.title.toUpperCase()}`,
      description: template.description ?? template.title,
      mood: template.category,
      number: doc.scenes.length + 1,
      isKeyScene: true,
    },
    { by: "user" },
  );

  const durationSec = template.duration_sec ?? 5;
  const shotId = addShot(
    sceneId,
    {
      modelPrompt: template.pure_prompt,
      cameraDirection: template.lens_hint ?? "",
      lensIntent: template.lens_hint ?? undefined,
      framing: "medium",
      durationSec,
      // Route through the ComfyUI / mode-router VFX path. The
      // pipeline submitter sees `comfy-local` + a recipe slug and
      // does the right thing.
      engineOverride: "comfy-local",
      modelInput: {
        vfxRecipeSlug: template.recipe_slug ?? template.slug,
        chromeKind: template.chrome_kind,
        templateId: template.id,
        templateSlug: template.slug,
      },
    },
    { by: "user" },
  );
  if (!shotId) {
    throw new Error("Failed to add VFX shot to document");
  }

  return { sceneId, shotId };
}

// ─────────────────────────────────────────────────────────────────────────────
// Selectors — used by the editor inspector to surface VFX context
// ─────────────────────────────────────────────────────────────────────────────

/**
 * True when a shot was instantiated from a VFX template. Used by
 * the inspector to surface "VFX · <template name>" instead of
 * "Shot N" + to render the recipe-specific overlay preview.
 */
export function isVfxShot(shot: Shot): boolean {
  const slug = (shot.modelInput as { vfxRecipeSlug?: string } | undefined)?.vfxRecipeSlug;
  return !!slug;
}

/** Get the recipe slug from a shot, or null. */
export function vfxRecipeSlugForShot(shot: Shot): string | null {
  return (
    (shot.modelInput as { vfxRecipeSlug?: string } | undefined)?.vfxRecipeSlug ??
    null
  );
}

/** Get the chrome (UI overlay kind) for a shot if any. */
export function vfxChromeKindForShot(shot: Shot): string | null {
  return (
    (shot.modelInput as { chromeKind?: string } | undefined)?.chromeKind ?? null
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Scene-level helpers — used by the Storyboard when surfacing VFX
// scenes as distinct cards.
// ─────────────────────────────────────────────────────────────────────────────

export function isVfxScene(scene: Scene): boolean {
  return scene.shots.some(isVfxShot);
}

void newScriptId; // re-export hook for tests
