/**
 * Templates — the editorial gallery surface.
 *
 * Architectural intent: matches ProfileDashboard's "everything floats"
 * language. No heavy containers, no boxed cards. Gradient text titles,
 * floating filter pills, glassmorphic tiles. Hero band is a full-bleed
 * editorial header with stats living as floating numbers.
 *
 * Source of truth: TEMPLATE_BLUEPRINTS from lib/templates/registry —
 * one unified rich schema (engine, aspect, clips[], transitions[],
 * VFX presets, color grade, music mood). The legacy three-silo split
 * (BUILT_IN_TEMPLATES / BREAKOUT_TEMPLATES / vfx_templates) is unified.
 *
 * Clicking a card opens the TemplateDetailDrawer with the full
 * storyboard preview. "Use this template" navigates to /create.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSafeNavigation, useRouteCleanup } from "@/lib/navigation";
import {
  Search,
  Play,
  Clock,
  Users,
  Sparkles,
  Film,
  Megaphone,
  BookOpen,
  Smile,
  Briefcase,
  TrendingUp,
  Layers,
  Zap,
  Cpu,
  Wand2,
  ArrowRight,
  Gift,
  Gem,
  Clapperboard,
  Gauge,
  Smartphone,
  Monitor,
  Square,
  RectangleHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { FoundationShell } from "@/components/foundation/FoundationShell";
import { EditorialCanvas, EditorialEyebrow, EditorialHeadline } from "@/components/foundation/EditorialCanvas";
import { AutoGallery } from "@/components/foundation/AutoGallery";
import { HeroGalleryBackdrop } from "@/components/foundation/HeroGalleryBackdrop";
import { useLiveRenderTimecode } from "@/hooks/useLiveRenderTimecode";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TemplateDetailDrawer } from "@/components/templates/TemplateDetailDrawer";

import {
  getAllTemplateBlueprints,
  getTemplateBlueprint,
} from "@/lib/templates/registry";
import {
  type TemplateBlueprint,
  type TemplateCategory,
  totalClipDuration,
  totalVfxPresetCount,
} from "@/lib/templates/blueprint";
import { ENGINES } from "@/lib/video/engines";
import { ASPECT_RATIOS } from "@/lib/editor/types";
import { usePageTone, TONE_PRESETS } from "@/lib/page-tone";

// ─────────────────────────────────────────────────────────────────────────────
// Filter constants
// ─────────────────────────────────────────────────────────────────────────────
const CATEGORIES: { id: TemplateCategory | "all"; label: string; icon: typeof Film }[] = [
  { id: "all",           label: "All",           icon: Layers },
  { id: "trending",      label: "Trending",      icon: TrendingUp },
  { id: "cinematic",     label: "Cinematic",     icon: Film },
  { id: "commercial",    label: "Commercial",    icon: Megaphone },
  { id: "educational",   label: "Educational",   icon: BookOpen },
  { id: "entertainment", label: "Entertainment", icon: Smile },
  { id: "corporate",     label: "Corporate",     icon: Briefcase },
];

type EngineFilter = "all" | "free" | "standard" | "pro" | "cinema";
const ENGINE_FILTERS: { id: EngineFilter; label: string; icon: typeof Film }[] = [
  { id: "all",      label: "Any",      icon: Layers },
  { id: "free",     label: "Free",     icon: Gift },
  { id: "standard", label: "Standard", icon: Gauge },
  { id: "pro",      label: "Pro",      icon: Gem },
  { id: "cinema",   label: "Cinema",   icon: Clapperboard },
];

type AspectFilter = "all" | "vertical" | "wide" | "square" | "cinema";
const ASPECT_FILTERS: { id: AspectFilter; label: string; icon: typeof Film }[] = [
  { id: "all",      label: "Any",      icon: Layers },
  { id: "vertical", label: "Vertical", icon: Smartphone },
  { id: "wide",     label: "Wide",     icon: Monitor },
  { id: "square",   label: "Square",   icon: Square },
  { id: "cinema",   label: "21:9",     icon: RectangleHorizontal },
];

const TIER_HUE: Record<string, string> = {
  standard: "hsl(195 90% 70%)",
  pro:      "hsl(48 90% 70%)",
  cinema:   "hsl(330 90% 72%)",
};

// Halo color the hero AutoGallery uses to tint its ambient glow as the
// active blueprint changes — matches the editorial tone of each category.
function templateCategoryGlow(cat: TemplateBlueprint["category"]): string {
  const map: Record<string, string> = {
    trending:      "hsl(0 85% 65% / 0.45)",
    cinematic:     "hsl(45 95% 65% / 0.50)",
    commercial:    "hsl(215 100% 70% / 0.45)",
    educational:   "hsl(180 70% 60% / 0.45)",
    entertainment: "hsl(285 90% 70% / 0.45)",
    corporate:     "hsl(220 30% 65% / 0.40)",
    vfx:           "hsl(215 100% 60% / 0.55)",
  };
  return map[cat] ?? "hsl(45 95% 65% / 0.45)";
}

function compactNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ─────────────────────────────────────────────────────────────────────────────
// Aspect-fit helper for filter
// ─────────────────────────────────────────────────────────────────────────────
function aspectMatchesFilter(asp: string, f: AspectFilter): boolean {
  if (f === "all") return true;
  if (f === "vertical") return asp === "9:16" || asp === "4:5";
  if (f === "wide")     return asp === "16:9" || asp === "4:3";
  if (f === "square")   return asp === "1:1";
  if (f === "cinema")   return asp === "21:9";
  return true;
}

function engineMatchesFilter(engineId: string, f: EngineFilter): boolean {
  if (f === "all") return true;
  const tier = ENGINES[engineId as keyof typeof ENGINES]?.tier;
  if (f === "free")     return engineId === "wan-25";
  if (f === "standard") return tier === "standard" && engineId !== "wan-25";
  if (f === "pro")      return tier === "pro";
  if (f === "cinema")   return tier === "cinema";
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Card — glassmorphic floating tile with rich badges
// ─────────────────────────────────────────────────────────────────────────────
const TemplateCard = memo(function TemplateCard({
  bp, onOpen, index,
}: {
  bp: TemplateBlueprint;
  onOpen: () => void;
  index: number;
}) {
  const [hover, setHover] = useState(false);
  const engine = ENGINES[bp.engine];
  const aspectDims = ASPECT_RATIOS[bp.aspectRatio];
  const totalSec = totalClipDuration(bp);
  const vfxCount = totalVfxPresetCount(bp);

  return (
    <button
      type="button"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onOpen}
      className="group relative block text-left cursor-pointer animate-fade-in w-full"
      style={{ animationDelay: `${Math.min(index * 25, 300)}ms` }}
    >
      <div
        className={cn(
          "relative aspect-[3/4] rounded-2xl overflow-hidden",
          "ring-1 ring-inset ring-white/[0.06] bg-white/[0.015] backdrop-blur",
          "transition-all duration-500",
          hover && "ring-white/[0.12] -translate-y-0.5 shadow-[0_30px_80px_-20px_hsla(215,100%,60%,0.45)]",
        )}
      >
        {/* Thumbnail */}
        {bp.thumbnailUrl && (
          <img
            src={bp.thumbnailUrl}
            alt={bp.name}
            loading="lazy"
            className={cn(
              "absolute inset-0 w-full h-full object-cover transition-transform duration-700",
              hover ? "scale-[1.06]" : "scale-100",
            )}
          />
        )}

        {/* Gradient overlay */}
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-500 pointer-events-none",
            hover
              ? "bg-gradient-to-t from-[hsl(220_30%_2%)] via-[hsl(220_30%_2%)]/55 to-[hsla(215,100%,60%,0.10)]"
              : "bg-gradient-to-t from-[hsl(220_30%_3%)] via-[hsl(220_30%_3%)]/30 to-transparent",
          )}
        />

        {/* Soft cursor halo on hover */}
        {hover && (
          <div
            aria-hidden
            className="absolute -inset-px rounded-2xl pointer-events-none"
            style={{
              background: "radial-gradient(circle at 50% 0%, hsla(215,100%,60%,0.30), transparent 65%)",
              mixBlendMode: "screen",
            }}
          />
        )}

        {/* ── TOP BADGES ────────────────────────────────────── */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between z-10 gap-2">
          <div className="flex flex-wrap gap-1.5">
            {bp.isBreakout && (
              <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-md bg-[hsl(215,100%,60%)] text-foreground text-[9px] font-mono uppercase tracking-[0.18em] shadow-[0_8px_20px_-8px_hsla(215,100%,60%,0.8)]">
                <Zap className="w-2.5 h-2.5" />
                4th Wall
              </span>
            )}
            {bp.isTrending && !bp.isBreakout && (
              <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-md bg-rose-500/25 ring-1 ring-inset ring-rose-300/40 text-rose-100 text-[9px] font-mono uppercase tracking-[0.18em] backdrop-blur">
                <Sparkles className="w-2.5 h-2.5" />
                Hot
              </span>
            )}
            {bp.isPro && !bp.isBreakout && (
              <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-md bg-amber-500/25 ring-1 ring-inset ring-amber-300/40 text-amber-100 text-[9px] font-mono uppercase tracking-[0.18em] backdrop-blur">
                Pro
              </span>
            )}
            {bp.isFeatured && !bp.isTrending && !bp.isBreakout && !bp.isPro && (
              <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-md bg-white/10 ring-1 ring-inset ring-white/15 text-foreground/85 text-[9px] font-mono uppercase tracking-[0.18em] backdrop-blur">
                Featured
              </span>
            )}
          </div>

          {/* Aspect chip — top right */}
          <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-md bg-black/55 ring-1 ring-inset ring-white/15 text-foreground/85 text-[9px] font-mono uppercase tracking-[0.18em] backdrop-blur">
            <span
              className="inline-block ring-1 ring-inset ring-white/40 rounded-[2px]"
              style={{ width: 12, height: Math.max((12 * aspectDims.h) / aspectDims.w, 6), background: "hsl(48 80% 88% / 0.20)" }}
            />
            {bp.aspectRatio}
          </span>
        </div>

        {/* ── BOTTOM CONTENT ────────────────────────────────── */}
        <div className="absolute left-0 right-0 bottom-0 p-3 z-10">
          {/* Title */}
          <h3 className="text-[14px] sm:text-[15px] font-display italic font-light leading-tight text-foreground/95 line-clamp-2">
            {bp.name}
          </h3>

          {/* Engine + clips meta row */}
          <div className="mt-1.5 flex items-center gap-2 text-[9px] font-mono uppercase tracking-[0.18em]">
            <span
              className="inline-flex items-center gap-1 h-4 px-1.5 rounded-md ring-1 ring-inset"
              style={{
                color: TIER_HUE[engine.tier],
                background: `${TIER_HUE[engine.tier].replace(")", " / 0.08)").replace("hsl(", "hsla(")}`,
                borderColor: `${TIER_HUE[engine.tier].replace(")", " / 0.25)").replace("hsl(", "hsla(")}`,
              }}
            >
              <Cpu className="w-2.5 h-2.5" />
              {engine.shortLabel}
            </span>
            <span className="text-foreground/55 tabular-nums">{bp.clips.length}c · {totalSec}s</span>
          </div>

          {/* Bottom info row — only visible on hover or always (compact) */}
          <div className="mt-1.5 flex items-center justify-between gap-2 text-[9px] font-mono uppercase tracking-[0.18em] text-foreground/50">
            <div className="flex items-center gap-2">
              {(bp.transitions?.length ?? 0) > 0 && (
                <span className="inline-flex items-center gap-0.5">
                  <Film className="w-2.5 h-2.5" />
                  {bp.transitions!.length}
                </span>
              )}
              {vfxCount > 0 && (
                <span className="inline-flex items-center gap-0.5">
                  <Wand2 className="w-2.5 h-2.5" />
                  {vfxCount}
                </span>
              )}
            </div>
            {bp.useCount > 1000 && (
              <span className="inline-flex items-center gap-0.5">
                <Users className="w-2.5 h-2.5" />
                {compactNum(bp.useCount)}
              </span>
            )}
          </div>
        </div>

        {/* Hover CTA */}
        {hover && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <span className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-foreground/95 text-background text-[11px] font-medium tracking-wide shadow-[0_15px_45px_-12px_hsla(0,0%,100%,0.45)] animate-fade-in">
              <Play className="w-3.5 h-3.5" />
              Preview blueprint
            </span>
          </div>
        )}
      </div>
    </button>
  );
});

TemplateCard.displayName = "TemplateCard";

// ─────────────────────────────────────────────────────────────────────────────
// Filter pill — shared style
// ─────────────────────────────────────────────────────────────────────────────
// Top-bar filter as a beautiful icon tile with a small label underneath —
// repeated for every engine tier and aspect option.
function IconFilterTile({
  active, onClick, Icon, label,
}: {
  active: boolean;
  onClick: () => void;
  Icon: typeof Film;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group/ft flex flex-col items-center justify-center gap-1.5 w-[68px] py-2.5 rounded-2xl backdrop-blur-md transition-all",
        active
          ? "bg-foreground/[0.10] ring-1 ring-inset ring-white/[0.18] shadow-[0_10px_28px_-14px_hsla(0,0%,100%,0.4)]"
          : "bg-white/[0.02] hover:bg-white/[0.05]",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
          active
            ? "bg-foreground/[0.14] text-foreground"
            : "bg-white/[0.04] text-foreground/50 group-hover/ft:text-foreground/85",
        )}
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.7} />
      </span>
      <span
        className={cn(
          "text-[9.5px] font-mono uppercase tracking-[0.14em] transition-colors",
          active ? "text-foreground" : "text-foreground/50 group-hover/ft:text-foreground/75",
        )}
      >
        {label}
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page body
// ─────────────────────────────────────────────────────────────────────────────
function TemplatesContent() {
  usePageTone(TONE_PRESETS.templates);
  const { navigate } = useSafeNavigation();

  // Persist filters across reloads — URL params win over localStorage.
  const [searchParams, setSearchParams] = useSearchParams();
  const FILTERS_KEY = "sb_templates_filters_v2";
  type PersistedFilters = {
    search: string;
    category: TemplateCategory | "all";
    engine: EngineFilter;
    aspect: AspectFilter;
  };
  const loadLocal = (): PersistedFilters => {
    try {
      const raw = localStorage.getItem(FILTERS_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        return {
          search:   typeof p.search === "string" ? p.search : "",
          category: typeof p.category === "string" ? p.category : "all",
          engine:   ENGINE_FILTERS.some(e => e.id === p.engine) ? p.engine : "all",
          aspect:   ASPECT_FILTERS.some(a => a.id === p.aspect) ? p.aspect : "all",
        };
      }
    } catch { /* noop */ }
    return { search: "", category: "all", engine: "all", aspect: "all" };
  };
  const initial = useMemo(() => {
    const local = loadLocal();
    return {
      search:   searchParams.get("search")   ?? local.search,
      category: (searchParams.get("category") as TemplateCategory | "all") ?? local.category,
      engine:   (searchParams.get("engine")   as EngineFilter)             ?? local.engine,
      aspect:   (searchParams.get("aspect")   as AspectFilter)             ?? local.aspect,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [searchQuery, setSearchQuery] = useState(initial.search);
  const [activeCategory, setActiveCategory] = useState<TemplateCategory | "all">(initial.category);
  const [engineFilter, setEngineFilter] = useState<EngineFilter>(initial.engine);
  const [aspectFilter, setAspectFilter] = useState<AspectFilter>(initial.aspect);
  const [drawerOpenId, setDrawerOpenId] = useState<string | null>(null);

  // Sync to URL + localStorage
  useEffect(() => {
    const p = new URLSearchParams();
    if (searchQuery.trim()) p.set("search", searchQuery.trim());
    if (activeCategory !== "all") p.set("category", activeCategory);
    if (engineFilter !== "all")   p.set("engine", engineFilter);
    if (aspectFilter !== "all")   p.set("aspect", aspectFilter);
    setSearchParams(p, { replace: true });
    try {
      localStorage.setItem(FILTERS_KEY, JSON.stringify({ search: searchQuery, category: activeCategory, engine: engineFilter, aspect: aspectFilter }));
    } catch { /* noop */ }
  }, [searchQuery, activeCategory, engineFilter, aspectFilter, setSearchParams]);

  useRouteCleanup(() => { /* noop */ }, []);

  // Source: unified registry
  const allBlueprints = useMemo(() => getAllTemplateBlueprints(), []);

  // Filter
  const filtered = useMemo(() => {
    return allBlueprints.filter((bp) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hit = bp.name.toLowerCase().includes(q)
          || bp.description.toLowerCase().includes(q)
          || bp.mood.toLowerCase().includes(q)
          || bp.genre.toLowerCase().includes(q)
          || (bp.tags?.some(t => t.toLowerCase().includes(q)) ?? false);
        if (!hit) return false;
      }
      // Category
      if (activeCategory === "trending") {
        if (!bp.isTrending) return false;
      } else if (activeCategory !== "all") {
        if (bp.category !== activeCategory) return false;
      }
      // Engine
      if (!engineMatchesFilter(bp.engine, engineFilter)) return false;
      // Aspect
      if (!aspectMatchesFilter(bp.aspectRatio, aspectFilter)) return false;
      return true;
    });
  }, [allBlueprints, searchQuery, activeCategory, engineFilter, aspectFilter]);

  // Sort: trending first → featured → useCount desc
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (a.isTrending && !b.isTrending) return -1;
      if (!a.isTrending && b.isTrending) return 1;
      if (a.isFeatured && !b.isFeatured) return -1;
      if (!a.isFeatured && b.isFeatured) return 1;
      return b.useCount - a.useCount;
    });
  }, [filtered]);

  // Hero stats from filtered set
  const stats = useMemo(() => ({
    total:     sorted.length,
    featured:  sorted.filter(t => t.isFeatured).length,
    trending:  sorted.filter(t => t.isTrending).length,
    breakout:  sorted.filter(t => t.isBreakout).length,
  }), [sorted]);

  const openTemplate = useTemplateOpener(navigate);
  const handleUse = useCallback((bp: TemplateBlueprint) => {
    openTemplate(bp);
    setDrawerOpenId(null);
  }, [openTemplate]);

  const activeBlueprint = drawerOpenId ? getTemplateBlueprint(drawerOpenId) ?? null : null;

  return (
    <div className="relative">
      {/* ── HERO + FILTERS — one cinematic top section with the
            auto-gallery cycling behind the title, search, and filter
            pills. The image bed is full-bleed: it breaks out of the
            page's max-w-[1440px] wrapper AND extends 320px further
            left to slide behind the LeftRail, so the kinetic backdrop
            reads as a single uninterrupted band across the viewport. */}
      <section className="relative mb-8">
        <HeroGalleryBackdrop>
          <AutoGallery
            items={allBlueprints.map((bp) => ({
              id: bp.id,
              name: bp.name,
              imageUrl: bp.thumbnailUrl,
              caption: bp.category,
              glow: templateCategoryGlow(bp.category),
            }))}
            variant="hero"
          />
        </HeroGalleryBackdrop>

        {/* Foreground — title block, search, and filter pills */}
        <div className="relative z-10 pt-8 sm:pt-12 pb-7">
          <EditorialEyebrow>Templates</EditorialEyebrow>
          <EditorialHeadline className="mt-5" size="md">
            Blueprints.
          </EditorialHeadline>
          <p className="mt-5 max-w-xl text-[14px] font-light leading-relaxed text-foreground/75">
            Pick a blueprint, swap your story, ship in minutes.
          </p>

          {/* Search */}
          <div className="mt-7 max-w-md">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/65" />
              <Input
                placeholder="Search by name, mood, genre, tag…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11 h-12 bg-white/[0.06] ring-1 ring-inset ring-white/[0.12] focus:ring-white/[0.25] border-0 text-foreground placeholder:text-foreground/45 rounded-full text-[13px] backdrop-blur-xl"
              />
            </div>
          </div>

          {/* Filter tiles — engine + aspect rows, icon over a small label */}
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-block font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/45 w-16 shrink-0">
                Engine
              </span>
              <div className="flex flex-wrap gap-2">
                {ENGINE_FILTERS.map((opt) => (
                  <IconFilterTile
                    key={opt.id}
                    active={engineFilter === opt.id}
                    onClick={() => setEngineFilter(opt.id)}
                    Icon={opt.icon}
                    label={opt.label}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-block font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/45 w-16 shrink-0">
                Aspect
              </span>
              <div className="flex flex-wrap gap-2">
                {ASPECT_FILTERS.map((opt) => (
                  <IconFilterTile
                    key={opt.id}
                    active={aspectFilter === opt.id}
                    onClick={() => setAspectFilter(opt.id)}
                    Icon={opt.icon}
                    label={opt.label}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CATEGORY PRESENTATION ──────────────────────────────── */}
      {activeCategory === "all" ? (
        // Editorial rails — one per category (skip empties)
        <section className="pb-16 space-y-12">
          {(searchQuery.trim() || engineFilter !== "all" || aspectFilter !== "all") && (
            <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/40 -mt-2">
              {sorted.length} match{sorted.length === 1 ? "" : "es"} across filters
            </div>
          )}
          {CATEGORIES.filter(c => c.id !== "all").map((cat) => {
            const inRail = sorted.filter(bp =>
              cat.id === "trending" ? bp.isTrending : bp.category === cat.id,
            );
            if (inRail.length === 0) return null;
            return (
              <CategoryRail
                key={cat.id}
                category={cat}
                items={inRail}
                onOpenCard={(id) => setDrawerOpenId(id)}
                onSeeAll={() => {
                  setActiveCategory(cat.id);
                  // Scroll to top of grid
                  window.requestAnimationFrame(() => {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  });
                }}
              />
            );
          })}
          {sorted.length === 0 && (
            <EmptyState
              onReset={() => {
                setSearchQuery("");
                setActiveCategory("all");
                setEngineFilter("all");
                setAspectFilter("all");
              }}
            />
          )}
        </section>
      ) : (
        // Dense grid for a single category, with a back link
        <section className="pb-16">
          <div className="flex items-baseline justify-between mb-5 gap-4 flex-wrap">
            <div className="flex items-baseline gap-4">
              <button
                onClick={() => setActiveCategory("all")}
                className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/45 hover:text-foreground/85 transition-colors inline-flex items-center gap-1.5"
              >
                ← All categories
              </button>
              <h2 className="text-[clamp(1.6rem,3.5vw,2.4rem)] font-display italic font-light leading-tight">
                <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/60 bg-clip-text text-transparent">
                  {CATEGORIES.find(c => c.id === activeCategory)?.label}
                </span>
                <span className="ml-3 font-mono text-[12px] font-normal not-italic uppercase tracking-[0.22em] text-foreground/40 tabular-nums">
                  {sorted.length}
                </span>
              </h2>
            </div>
            <span className="hidden sm:inline-block font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/40">
              tap any card to preview the storyboard
            </span>
          </div>

          {sorted.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
              {sorted.map((bp, i) => (
                <TemplateCard
                  key={bp.id}
                  bp={bp}
                  index={i}
                  onOpen={() => setDrawerOpenId(bp.id)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              onReset={() => {
                setSearchQuery("");
                setActiveCategory("all");
                setEngineFilter("all");
                setAspectFilter("all");
              }}
            />
          )}
        </section>
      )}

      {/* ── DETAIL DRAWER ──────────────────────────────────────── */}
      <TemplateDetailDrawer
        template={activeBlueprint}
        open={!!activeBlueprint}
        onClose={() => setDrawerOpenId(null)}
        onUse={handleUse}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Floating stat — like ProfileDashboard's StatsGrid items
// ─────────────────────────────────────────────────────────────────────────────
function FloatingStat({
  label, value, hue,
}: {
  label: string;
  value: number;
  hue?: string;
}) {
  return (
    <div className="inline-block">
      <div className={cn("text-[clamp(1.5rem,3vw,2rem)] font-display italic font-light leading-none tabular-nums", hue ?? "text-foreground/95")}>
        {value}
      </div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-foreground/40">
        {label}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CategoryRail — editorial header + horizontal-scroll strip of cards
// ─────────────────────────────────────────────────────────────────────────────
function CategoryRail({
  category, items, onOpenCard, onSeeAll,
}: {
  category: { id: TemplateCategory | "all"; label: string; icon: typeof Film };
  items: TemplateBlueprint[];
  onOpenCard: (id: string) => void;
  onSeeAll: () => void;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const Icon = category.icon;

  const scrollBy = (delta: number) => {
    railRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  };

  return (
    <div className="relative">
      {/* Editorial header */}
      <div className="flex items-baseline justify-between gap-4 mb-4">
        <div className="flex items-baseline gap-3 min-w-0">
          <Icon className="w-4 h-4 text-foreground/45 self-center" />
          <h3 className="text-[clamp(1.4rem,3vw,2rem)] font-display italic font-light leading-tight truncate">
            <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/60 bg-clip-text text-transparent">
              {category.label}
            </span>
            <span className="ml-3 font-mono text-[11px] font-normal not-italic uppercase tracking-[0.22em] text-foreground/40 tabular-nums">
              {items.length}
            </span>
          </h3>
        </div>

        <div className="flex items-center gap-1">
          {/* scroll arrows — desktop only */}
          <button
            onClick={() => scrollBy(-560)}
            className="hidden sm:inline-flex h-8 w-8 items-center justify-center rounded-full ring-1 ring-inset ring-white/[0.06] hover:ring-white/[0.16] bg-white/[0.015] hover:bg-white/[0.04] backdrop-blur text-foreground/55 hover:text-foreground/85 transition-colors"
            aria-label="Scroll left"
          >
            ‹
          </button>
          <button
            onClick={() => scrollBy(560)}
            className="hidden sm:inline-flex h-8 w-8 items-center justify-center rounded-full ring-1 ring-inset ring-white/[0.06] hover:ring-white/[0.16] bg-white/[0.015] hover:bg-white/[0.04] backdrop-blur text-foreground/55 hover:text-foreground/85 transition-colors"
            aria-label="Scroll right"
          >
            ›
          </button>
          <button
            onClick={onSeeAll}
            className="ml-1 inline-flex items-center gap-1.5 h-8 px-3 rounded-full ring-1 ring-inset ring-white/[0.06] hover:ring-white/[0.16] bg-white/[0.015] hover:bg-white/[0.04] backdrop-blur text-[10px] font-mono uppercase tracking-[0.20em] text-foreground/70 hover:text-foreground/95 transition-colors whitespace-nowrap"
          >
            See all {items.length}
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Horizontal rail */}
      <div className="relative -mx-1">
        {/* Edge fades */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 bottom-0 left-0 w-12 z-10"
          style={{ background: "linear-gradient(90deg, hsl(220 30% 3% / 0.85), transparent)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 bottom-0 right-0 w-12 z-10"
          style={{ background: "linear-gradient(270deg, hsl(220 30% 3% / 0.85), transparent)" }}
        />
        <div
          ref={railRef}
          className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2 px-1"
          style={{ scrollbarWidth: "none" }}
        >
          {items.map((bp, i) => (
            <div
              key={bp.id}
              className="snap-start flex-shrink-0 w-[42vw] sm:w-[260px] md:w-[240px] lg:w-[220px]"
            >
              <TemplateCard bp={bp} index={i} onOpen={() => onOpenCard(bp.id)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="text-center py-20">
      <div className="mx-auto mb-5 inline-flex items-center justify-center w-14 h-14 rounded-full ring-1 ring-inset ring-white/[0.08] bg-white/[0.02] backdrop-blur">
        <Search className="w-6 h-6 text-foreground/55" />
      </div>
      <h3 className="text-xl font-display italic text-foreground/95 mb-2">No blueprints matched</h3>
      <p className="text-[13px] text-foreground/55 mb-5 max-w-sm mx-auto">
        Try clearing a filter or two — your category + engine + aspect combination might be too narrow.
      </p>
      <Button
        variant="outline"
        className="border-white/[0.12] bg-white/[0.02] backdrop-blur text-foreground hover:bg-white/[0.05] rounded-full"
        onClick={onReset}
      >
        Clear filters
        <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Use template — best-effort use_count increment + navigate
// ─────────────────────────────────────────────────────────────────────────────
function useTemplateOpener(navigate: ReturnType<typeof useSafeNavigation>["navigate"]) {
  // Stable callback that nudges use_count for DB-backed templates only,
  // then navigates to /create.
  return useRef((bp: TemplateBlueprint) => {
    navigate(`/create?template=${bp.id}`);
    toast.success(`Using "${bp.name}"`);
    if (/^[0-9a-f-]{36}$/i.test(bp.id)) {
      void supabase
        .rpc("increment_template_use_count" as never, { p_template_id: bp.id } as never)
        .then(({ error }) => {
          if (error) {
            void supabase
              .from("project_templates")
              .update({ use_count: (bp.useCount ?? 0) + 1 })
              .eq("id", bp.id);
          }
        });
    }
  }).current;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public page
// ─────────────────────────────────────────────────────────────────────────────
export default function Templates() {
  usePageMeta({
    title: "Templates — Small Bridges",
    description: "Production-ready blueprints. Engine, aspect, clips, transitions, VFX, color grade — all declared, ready to ship.",
  });
  const liveRenderTimecode = useLiveRenderTimecode();

  return (
    <ErrorBoundary>
      <FoundationShell>
        <div className="relative mx-auto w-full max-w-[1440px] px-4 pb-24 pt-10 sm:px-6 lg:px-10">
          <EditorialCanvas
            maxWidth="100%"
            chrome={{
              crumbs: ["Small Bridges", "templates"],
              timecode: liveRenderTimecode ?? "TEMPLATES · LIVE",
            }}
          >
            <TemplatesContent />
          </EditorialCanvas>
        </div>
      </FoundationShell>
    </ErrorBoundary>
  );
}
