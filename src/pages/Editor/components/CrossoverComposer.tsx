/**
 * CrossoverComposer — pick a VFX template inside the editor.
 *
 * Fetches every vfx_templates row from supabase. Renders a grouped
 * gallery (by category) where each card shows the template's
 * thumbnail + title + recipe slug. Click a card → instantiateTemplate
 * adds a Scene + Shot to the document with engineOverride=comfy-local
 * + modelInput.vfxRecipeSlug. The user lands on the inspector's
 * approval CTA exactly like a regular shot — the only difference is
 * the pipeline submitter sees comfy-local + a recipe and routes
 * through the VFX path.
 *
 * Surface: Shift+V opens (V for VFX).
 */
import { useEffect, useState } from "react";
import { Loader2, Sparkles, Wand2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE_META } from "@/lib/design-system";
import {
  Surface,
  SurfaceHeader,
  SurfaceBody,
  SurfaceFooter,
  SurfaceKbdHint,
} from "./Surface";
import { supabase } from "@/integrations/supabase/client";
import {
  instantiateTemplate,
  type VfxTemplateRow,
} from "@/lib/editor/crossover-bridge";
import { getDocumentState } from "@/lib/editor/document-store";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CrossoverComposer({ open, onClose }: Props) {
  const [templates, setTemplates] = useState<VfxTemplateRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || templates) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const { data, error } = await supabase
          .from("vfx_templates")
          .select(
            "id, slug, category, title, pure_prompt, recipe_slug, chrome_kind, lens_hint, aspect_ratio, duration_sec, thumbnail_url, description",
          )
          .order("category", { ascending: true })
          .order("title", { ascending: true });
        if (cancelled) return;
        if (error) throw error;
        setTemplates((data ?? []) as VfxTemplateRow[]);
      } catch (e) {
        if (cancelled) return;
        toast.error("Couldn't load VFX templates", {
          description: e instanceof Error ? e.message : "Unknown error",
        });
        setTemplates([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, templates]);

  const handlePick = (t: VfxTemplateRow) => {
    const doc = getDocumentState().doc;
    if (!doc) {
      toast.error("Document not loaded yet — try again in a moment.");
      return;
    }
    try {
      const { sceneId, shotId } = instantiateTemplate(t, doc);
      toast.success(`Added VFX scene: ${t.title}`, {
        description: "Open the inspector to approve & render.",
      });
      void sceneId;
      void shotId;
      onClose();
    } catch (e) {
      toast.error("Couldn't instantiate the template", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    }
  };

  // Group templates by category for the grid sections.
  const byCategory = (templates ?? []).reduce<
    Record<string, VfxTemplateRow[]>
  >((acc, t) => {
    const key = t.category || "uncategorised";
    acc[key] = acc[key] ?? [];
    acc[key].push(t);
    return acc;
  }, {});

  return (
    <Surface open={open} onClose={onClose} size="xl" labelledBy="vfx-title">
      <SurfaceHeader
        id="vfx-title"
        eyebrow="◆ Crossover VFX"
        title="Screen-breakout effects."
        description="Curated VFX templates. Pick a card → adds a new scene with the recipe pre-wired. Approve to render."
        onClose={onClose}
      />
      <SurfaceBody>
        {loading ? (
          <div className="py-12 text-center">
            <Loader2 className="h-5 w-5 text-accent animate-spin mx-auto" strokeWidth={1.5} />
            <p className={cn(TYPE_META, "mt-3 text-muted-foreground/55")}>
              Loading recipes…
            </p>
          </div>
        ) : !templates || templates.length === 0 ? (
          <div className="py-16 text-center">
            <Wand2 className="h-7 w-7 text-muted-foreground/45 mx-auto" strokeWidth={1.4} />
            <p
              className="mt-4 font-display italic text-[16px] text-foreground/75"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              No VFX templates available.
            </p>
            <p className={cn(TYPE_META, "mt-2 text-muted-foreground/55")}>
              The vfx_templates table is empty.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(byCategory).map(([cat, list]) => (
              <section key={cat}>
                <header className="mb-3 flex items-baseline justify-between">
                  <h3 className={cn(TYPE_META, "text-foreground/85 tracking-[0.32em]")}>
                    ◆ {prettyCategory(cat)}
                  </h3>
                  <span className={cn(TYPE_META, "text-muted-foreground/45 font-mono tabular-nums")}>
                    {list.length}
                  </span>
                </header>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {list.map((t) => (
                    <TemplateCard key={t.id} template={t} onPick={() => handlePick(t)} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </SurfaceBody>
      <SurfaceFooter>
        <span className="flex items-center gap-2">
          <SurfaceKbdHint keys="⇧V" label="open" />
          <span aria-hidden>·</span>
          <SurfaceKbdHint keys="Esc" label="close" />
        </span>
        {templates && <span>{templates.length} VFX recipes</span>}
      </SurfaceFooter>
    </Surface>
  );
}

function TemplateCard({
  template,
  onPick,
}: {
  template: VfxTemplateRow;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        "group/vfx relative text-left rounded-xl overflow-hidden",
        "ring-1 ring-inset ring-amber-300/15 hover:ring-amber-300/45",
        "bg-[hsl(220_30%_4%/0.4)]",
        "transition-all hover:-translate-y-0.5",
      )}
    >
      {template.thumbnail_url ? (
        <div className="relative aspect-[16/9] overflow-hidden">
          <img
            src={template.thumbnail_url}
            alt=""
            className="w-full h-full object-cover transition-transform duration-700 group-hover/vfx:scale-105"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-[hsl(220_30%_4%/0.92)] via-transparent to-transparent"
          />
        </div>
      ) : (
        <div className="relative aspect-[16/9] bg-gradient-to-br from-amber-500/[0.10] via-rose-500/[0.06] to-[hsl(220_30%_8%)] flex items-center justify-center">
          <Wand2 className="h-7 w-7 text-amber-300/45" strokeWidth={1.5} />
        </div>
      )}
      <div className="p-3">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={cn(
              "inline-flex items-center px-1.5 h-4 rounded text-[9.5px]",
              "font-mono uppercase tracking-[0.14em]",
              "bg-amber-500/[0.18] text-amber-200 ring-1 ring-inset ring-amber-400/35",
            )}
          >
            VFX
          </span>
          {template.recipe_slug && (
            <span className={cn(TYPE_META, "font-mono tabular-nums text-muted-foreground/55")}>
              {template.recipe_slug}
            </span>
          )}
        </div>
        <h4
          className="font-display italic text-[14.5px] leading-tight text-foreground/95"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          {template.title}
        </h4>
        {template.description && (
          <p className="mt-1 text-[11.5px] text-muted-foreground/65 line-clamp-2">
            {template.description}
          </p>
        )}
        <div className="mt-2 inline-flex items-center gap-1 text-[10.5px] font-mono uppercase tracking-[0.18em] text-amber-200 group-hover/vfx:text-foreground transition-colors">
          <span>Add to project</span>
          <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
        </div>
      </div>
    </button>
  );
}

function prettyCategory(cat: string): string {
  switch (cat) {
    case "vertical_ui": return "Vertical UI";
    case "desktop_ui": return "Desktop · TV";
    case "social_feed": return "Social feeds";
    case "retro_holo": return "Retro · Holo";
    case "surreal": return "Surreal";
    default:
      return cat
        .split("_")
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(" ");
  }
}
// Suppress unused — used by the sanity check engine when extending
void Sparkles;
