/**
 * Crossover — /crossover
 *
 * The "next-gen clip" surface. Curated VFX template library where every
 * card is one of the screen-breakout effects (character / object steps
 * out of a digital UI into the physical world). Tap a card → composer
 * modal → tweak → Generate → goes through mode-router → ends up in
 * /production for status.
 *
 * Five categories of 10 templates each (50 total seeded in migration
 * 20260615000000_crossover_templates.sql).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Wand2, Search as SearchIcon, X, Wand, Tv, Monitor, Layers,
  Cpu, Palette, ArrowRight, Flame,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSafeNavigation } from "@/lib/navigation";
import { PageShell } from "@/components/shell";
import { StudioAurora } from "@/components/studio/StudioAurora";
import { StudioHero } from "@/components/studio/StudioHero";
import { StudioTabs } from "@/components/studio/StudioTabs";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Spinner } from "@/components/ui/Spinner";
import {
  ChromePreview, type ChromeKind,
} from "@/components/crossover/ChromePreview";
import {
  TemplateComposer, type CrossoverTemplate,
} from "@/components/crossover/TemplateComposer";
import { cn } from "@/lib/utils";

type CategoryKey = "all" | "vertical_ui" | "desktop_ui" | "social_feed" | "retro_holo" | "surreal";

const CATEGORIES: { key: CategoryKey; label: string; icon: React.ElementType }[] = [
  { key: "all",          label: "All",          icon: Sparkles },
  { key: "vertical_ui",  label: "Vertical UI",  icon: Wand },
  { key: "desktop_ui",   label: "Desktop · TV", icon: Monitor },
  { key: "social_feed",  label: "Social feeds", icon: Layers },
  { key: "retro_holo",   label: "Retro · Holo", icon: Cpu },
  { key: "surreal",      label: "Surreal",      icon: Palette },
];

export default function Crossover() {
  usePageMeta({
    title: "Crossover — Small Bridges",
    description: "Break through the screen. 50 next-gen VFX templates that cross from digital to physical.",
  });

  const { user } = useAuth();
  const { navigate } = useSafeNavigation();

  const [category, setCategory] = useState<CategoryKey>("all");
  const [search, setSearch] = useState("");
  const [templates, setTemplates] = useState<CrossoverTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CrossoverTemplate | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("crossover_browse" as never, {
        p_category: category === "all" ? null : category,
        p_query: search.trim() || null,
      } as never);
      if (error) throw error;
      setTemplates((data as unknown as CrossoverTemplate[]) ?? []);
    } catch (e) {
      console.warn("[Crossover] load failed", e);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [category, search]);

  useEffect(() => {
    const t = setTimeout(() => { void load(); }, search ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  // Group by category when showing "all" so the page reads like a department store.
  const grouped = useMemo(() => {
    if (category !== "all") return null;
    const map: Record<string, CrossoverTemplate[]> = {};
    for (const t of templates) {
      (map[t.category] ??= []).push(t);
    }
    return map;
  }, [templates, category]);

  const featured = useMemo(() => templates.find((t) => t.is_featured) ?? templates[0], [templates]);

  const startFeatured = () => {
    if (!featured) return;
    if (!user) { navigate("/auth"); return; }
    setSelected(featured);
  };

  return (
    <div className="relative min-h-screen flex flex-col">
      <StudioAurora intensity="subtle" />
      <PageShell width="wide" pad>
        <StudioHero
          eyebrow="Small Bridges · Crossover"
          title="Break"
          accent="the screen."
          subtitle="50 next-gen clip templates. Dancers leap out of TikTok. Tigers pounce through TVs. Code rains onto people who walk out of monitors. Pick a template, tweak, render."
          status={["50 templates", "Live", "AI-powered"]}
          subhead={loading ? "Loading…" : `${templates.length} live · ${CATEGORIES.length - 1} categories`}
        >
          <StudioTabs<CategoryKey>
            items={CATEGORIES}
            value={category}
            onChange={(k) => setCategory(k)}
            layoutId="crossover-cat"
          />
        </StudioHero>

        {/* SEARCH */}
        <div className="mb-8 relative max-w-xl mx-auto">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/35" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search effects — dancer, tiger, code, oil painting…"
            className="w-full h-12 pl-11 pr-12 rounded-2xl bg-glass border border-white/[0.06] focus:border-primary/40 outline-none text-[13px] text-white placeholder:text-white/30 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full border border-white/[0.08] hover:border-white/30 flex items-center justify-center text-white/55 hover:text-white"
              aria-label="Clear"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* FEATURED HERO RAIL */}
        {featured && category === "all" && search.length === 0 && (
          <FeaturedRail template={featured} onOpen={startFeatured} />
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24 gap-3 text-muted-foreground">
            <Spinner size="md" tone="muted" />
            <span className="text-[12px] font-mono uppercase tracking-[0.22em]">Loading templates…</span>
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-20 max-w-md mx-auto">
            <Sparkles className="w-7 h-7 mx-auto mb-4 text-white/45" />
            <h3 className="font-display font-medium text-[22px] text-white mb-2">No matches.</h3>
            <p className="text-[12px] text-white/45 leading-relaxed">
              Try a different category or clear the search.
            </p>
          </div>
        ) : grouped ? (
          // ── ALL VIEW — section per category ──
          Object.entries(grouped).map(([cat, list]) => (
            <section key={cat} className="mb-14">
              <SectionLabel
                label={CATEGORIES.find((c) => c.key === cat as CategoryKey)?.label ?? cat}
                meta={`${list.length} templates`}
                icon={CATEGORIES.find((c) => c.key === cat as CategoryKey)?.icon ?? Sparkles}
              />
              <Grid templates={list} onPick={setSelected} />
            </section>
          ))
        ) : (
          // ── FILTERED VIEW ──
          <AnimatePresence mode="wait">
            <motion.div
              key={`${category}-${search}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="mb-16"
            >
              <Grid templates={templates} onPick={setSelected} />
            </motion.div>
          </AnimatePresence>
        )}
      </PageShell>

      <AnimatePresence>
        {selected && (
          <TemplateComposer template={selected} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────

function Grid({ templates, onPick }: { templates: CrossoverTemplate[]; onPick: (t: CrossoverTemplate) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {templates.map((t) => (
        <TemplateCard key={t.id} template={t} onPick={() => onPick(t)} />
      ))}
    </div>
  );
}

function TemplateCard({ template, onPick }: { template: CrossoverTemplate; onPick: () => void }) {
  return (
    <button
      onClick={onPick}
      className="group relative text-left rounded-3xl overflow-hidden border border-white/[0.06] bg-white/[0.015] hover:border-white/20 transition-colors focus:outline-none focus:ring-1 focus:ring-primary/40"
    >
      {/* Chrome preview slot */}
      <div className="relative">
        <ChromePreview
          kind={template.chrome_kind as ChromeKind}
          aspectRatio={template.aspect_ratio}
          posterUrl={template.thumbnail_url}
          className="rounded-none"
        />
        {/* Hover gradient + featured badge */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
        {template.is_featured && (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-[0.28em] bg-primary/15 backdrop-blur-md border border-primary/30 text-primary">
            <Flame className="w-2.5 h-2.5" /> Featured
          </span>
        )}
        {/* Aspect badge */}
        <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[9px] font-mono bg-black/55 backdrop-blur-md border border-white/[0.10] text-white/85">
          {template.aspect_ratio}
        </span>

        {/* Title overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="text-[10px] font-mono uppercase tracking-[0.28em] text-primary/80 mb-1">
            {prettyCategory(template.category)}
          </div>
          <h3 className="text-[16px] lg:text-[18px] font-display font-light leading-tight text-white tracking-tight">
            {template.name}
          </h3>
          {template.hook && (
            <p className="mt-1.5 text-[11px] text-white/65 leading-snug line-clamp-2">{template.hook}</p>
          )}
        </div>
      </div>

      {/* Footer CTA */}
      <div className="flex items-center justify-between p-3 border-t border-white/[0.04]">
        <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/45">
          Tap to compose
        </span>
        <div className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.22em] text-white/65 group-hover:text-white transition-colors">
          <Wand2 className="w-3 h-3" />
          Build
          <ArrowRight className="w-3 h-3" />
        </div>
      </div>
    </button>
  );
}

function SectionLabel({ label, meta, icon: Icon }: { label: string; meta?: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <Icon className="w-3.5 h-3.5 text-primary/80" />
      <span className="text-[11px] font-mono uppercase tracking-[0.32em] text-foreground/65">{label}</span>
      <div className="h-px flex-1 bg-gradient-to-r from-white/[0.07] to-transparent" />
      {meta && <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/50">{meta}</span>}
    </div>
  );
}

function FeaturedRail({ template, onOpen }: { template: CrossoverTemplate; onOpen: () => void }) {
  return (
    <section className="mb-12">
      <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6 rounded-3xl border border-white/[0.08] overflow-hidden bg-white/[0.015]">
        <div className="p-8 lg:p-10 relative">
          <div aria-hidden className="absolute -top-24 -left-20 w-[360px] h-[360px] rounded-full opacity-50"
            style={{ background: "radial-gradient(circle, hsla(215,100%,60%,0.30), transparent 60%)", filter: "blur(60px)" }} />
          <div className="relative">
            <div className="text-[10px] font-mono uppercase tracking-[0.32em] text-primary/80 mb-3 flex items-center gap-2">
              <Flame className="w-3 h-3" /> Featured tonight · {prettyCategory(template.category)}
            </div>
            <h2 className="font-display font-light text-[36px] lg:text-[48px] leading-[1.0] tracking-[-0.02em] text-white">
              {template.name}
            </h2>
            {template.hook && (
              <p className="mt-4 text-[14px] text-white/65 leading-relaxed max-w-md">{template.hook}</p>
            )}
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                onClick={onOpen}
                className="inline-flex items-center gap-2 h-11 px-6 rounded-full text-[11px] font-mono uppercase tracking-[0.22em] text-foreground"
                style={{
                  background: "linear-gradient(180deg, hsla(215,100%,60%,0.32) 0%, hsla(215,100%,55%,0.14) 100%)",
                  boxShadow: "0 0 28px hsla(215,100%,60%,0.45), inset 0 1px 0 hsla(0,0%,100%,0.14)",
                }}
              >
                <Wand2 className="w-3.5 h-3.5" /> Build this crossover <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
        <div className="relative bg-black/40 p-6 lg:p-10 flex items-center justify-center">
          <div className="w-full max-w-[280px]">
            <ChromePreview
              kind={template.chrome_kind as ChromeKind}
              aspectRatio={template.aspect_ratio}
              posterUrl={template.thumbnail_url}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function prettyCategory(c: string): string {
  return c === "vertical_ui" ? "Vertical UI"
       : c === "desktop_ui"  ? "Desktop · TV"
       : c === "social_feed" ? "Social feed"
       : c === "retro_holo"  ? "Retro · Holo"
       : c === "surreal"     ? "Surreal"
       : c;
}
