/**
 * Crossover — /crossover
 *
 * Editorial scene library for the 50 "fourth wall break" VFX templates.
 * Matches the Templates + Environments page system:
 *   - Editorial glassmorphic hero (gradient italic title, floating stats)
 *   - Search + secondary filter rails (engine tier, aspect, accepts-subject)
 *   - When "All": 5 editorial rails (one per category) + Featured rail
 *   - When a single category: dense grid + back link
 *   - Cards open CrossoverDetailDrawer with the full blueprint
 *   - "Customize & generate" in the drawer opens the legacy TemplateComposer
 *
 * All 50 DB rows preserved. crossover_browse RPC preserved. Generation
 * path through mode-router preserved.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSafeNavigation } from "@/lib/navigation";
import { supabase } from "@/integrations/supabase/client";
import {
  Search,
  Star,
  Sparkles,
  ArrowRight,
  Cpu,
  Film,
  Wand2,
  User as UserIcon,
  Loader2,
  Layers,
  Gift,
  Gauge,
  Gem,
  Clapperboard,
  Smartphone,
  Monitor,
  Square,
  RectangleHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { safeErrorMessage } from "@/lib/safeErrorMessage";
import { IconFilterTile, IconFilterRow } from "@/components/ui/IconFilterTile";
import { toast } from "sonner";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { FoundationShell } from "@/components/foundation/FoundationShell";
import { EditorialCanvas, EditorialEyebrow, EditorialHeadline } from "@/components/foundation/EditorialCanvas";
import { useLiveRenderTimecode } from "@/hooks/useLiveRenderTimecode";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AnimatePresence } from "framer-motion";

import {
  useAllCrossoverBlueprints,
  findCrossoverBlueprint,
} from "@/lib/crossovers/registry";
import {
  type CrossoverBlueprint,
  type CrossoverCategory,
  type CrossoverMood,
  CROSSOVER_CATEGORY_LABELS,
  CROSSOVER_CATEGORY_SHORT,
  composeCrossoverPrompt,
} from "@/lib/crossovers/blueprint";
import { CrossoverDetailDrawer } from "@/components/crossover/CrossoverDetailDrawer";
import { ChromePreview } from "@/components/crossover/ChromePreview";
import { TemplateComposer, type CrossoverTemplate } from "@/components/crossover/TemplateComposer";
import { ENGINES } from "@/lib/video/engines";
import { ASPECT_RATIOS } from "@/lib/editor/types";
import { usePageTone, TONE_PRESETS } from "@/lib/page-tone";

// ─────────────────────────────────────────────────────────────────────────────
// Filter constants
// ─────────────────────────────────────────────────────────────────────────────
type CategoryFilter = CrossoverCategory | "all" | "favorites";

const CATEGORY_ORDER_FOR_RAILS: CrossoverCategory[] = [
  "vertical_ui", "desktop_ui", "social_feed", "retro_holo", "surreal",
];

type EngineFilter = "all" | "free" | "standard" | "pro" | "cinema";
const ENGINE_FILTERS: { id: EngineFilter; label: string; Icon: typeof Film }[] = [
  { id: "all",      label: "Any",      Icon: Layers },
  { id: "free",     label: "Free",     Icon: Gift },
  { id: "standard", label: "Standard", Icon: Gauge },
  { id: "pro",      label: "Pro",      Icon: Gem },
  { id: "cinema",   label: "Cinema",   Icon: Clapperboard },
];

type AspectFilter = "all" | "vertical" | "wide" | "square" | "cinema";
const ASPECT_FILTERS: { id: AspectFilter; label: string; Icon: typeof Film }[] = [
  { id: "all",      label: "Any",      Icon: Layers },
  { id: "vertical", label: "Vertical", Icon: Smartphone },
  { id: "wide",     label: "Wide",     Icon: Monitor },
  { id: "square",   label: "Square",   Icon: Square },
  { id: "cinema",   label: "21:9",     Icon: RectangleHorizontal },
];

const TIER_HUE: Record<string, string> = {
  standard: "hsl(195 90% 70%)",
  pro:      "hsl(48 90% 70%)",
  cinema:   "hsl(330 90% 72%)",
};

function compactNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

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
// Favorites — localStorage with cross-tab sync (mirrors Environments pattern)
// ─────────────────────────────────────────────────────────────────────────────
const FAVORITES_KEY = "sb:crossover:favorites";
function readFavorites(): Set<string> {
  try {
    const raw = typeof window === "undefined" ? null : window.localStorage.getItem(FAVORITES_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.filter(s => typeof s === "string") : []);
  } catch { return new Set(); }
}
function writeFavorites(ids: Set<string>) {
  try { window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(ids))); } catch { /* noop */ }
}
function useFavorites(): [Set<string>, (id: string) => void] {
  const [favs, setFavs] = useState<Set<string>>(() => readFavorites());
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === FAVORITES_KEY) setFavs(readFavorites());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  const toggle = useCallback((id: string) => {
    setFavs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      writeFavorites(next);
      return next;
    });
  }, []);
  return [favs, toggle];
}

// ─────────────────────────────────────────────────────────────────────────────
// Card — chrome preview + rich badges
// ─────────────────────────────────────────────────────────────────────────────
const CrossoverCard = memo(function CrossoverCard({
  bp, onOpen, isFavorite, onToggleFavorite, index,
}: {
  bp: CrossoverBlueprint;
  onOpen: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  index: number;
}) {
  const [hover, setHover] = useState(false);
  const engine = ENGINES[bp.engine];
  const aspectDims = ASPECT_RATIOS[bp.aspectRatio];
  // Guard against a blueprint referencing an engine/tier not in the maps
  // (e.g. a renamed/removed engine) — an unguarded TIER_HUE[engine.tier].replace
  // or engine.tier deref would crash the whole card (audit S35).
  const tierHue = TIER_HUE[engine?.tier] ?? "hsl(0 0% 65%)";

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
          "relative rounded-2xl overflow-hidden",
          "bg-white/[0.03] backdrop-blur shadow-[0_12px_44px_-22px_hsla(220,45%,2%,0.85)]",
          "transition-all duration-500",
          hover && "-translate-y-0.5 shadow-[0_30px_80px_-20px_hsla(215,100%,60%,0.45)]",
        )}
      >
        {/* Chrome preview is the hero — its own aspect ratio determines tile height */}
        <ChromePreview
          kind={bp.chrome.kind}
          aspectRatio={bp.aspectRatio}
          posterUrl={bp.thumbnailUrl}
          className="rounded-none"
        />

        {/* Gradient overlay */}
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-500 pointer-events-none",
            hover
              ? "bg-gradient-to-t from-[hsl(220_30%_2%)] via-[hsl(220_30%_2%)]/50 to-[hsla(215,100%,60%,0.10)]"
              : "bg-gradient-to-t from-[hsl(220_30%_3%)] via-[hsl(220_30%_3%)]/30 to-transparent",
          )}
        />

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

        {/* Top badges */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between z-10 gap-2">
          <div className="flex flex-wrap gap-1.5">
            {bp.acceptsSubject && (
              <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-md bg-emerald-500/30 text-emerald-100 text-[9px] font-mono uppercase tracking-[0.18em] backdrop-blur">
                <UserIcon className="w-2.5 h-2.5" />
                Subject
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
              title={isFavorite ? "Remove from favorites" : "Save to favorites"}
              className={cn(
                "h-6 w-6 rounded-full backdrop-blur flex items-center justify-center transition-all",
                isFavorite
                  ? "bg-amber-300 text-black shadow-[0_6px_18px_-8px_hsla(45,95%,55%,0.8)]"
                  : "bg-black/45 text-foreground/85 hover:bg-black/65",
              )}
            >
              <Star className="w-3 h-3" fill={isFavorite ? "currentColor" : "none"} strokeWidth={1.6} />
            </button>

            <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-md bg-black/55 text-foreground/85 text-[9px] font-mono uppercase tracking-[0.18em] backdrop-blur">
              <span
                className="inline-block rounded-[2px]"
                style={{ width: 10, height: Math.max((10 * aspectDims.h) / aspectDims.w, 6), background: "hsl(48 80% 88% / 0.45)" }}
              />
              {bp.aspectRatio}
            </span>
          </div>
        </div>

        {/* Bottom content */}
        <div className="absolute left-0 right-0 bottom-0 p-3 z-10">
          <div className="text-[9px] font-mono uppercase tracking-[0.22em] text-foreground/55 mb-1">
            {CROSSOVER_CATEGORY_SHORT[bp.category]}
          </div>
          <h3 className="text-[14px] sm:text-[15px] font-display italic font-light leading-tight text-foreground/95 line-clamp-2">
            {bp.name}
          </h3>
          {bp.hook && (
            <p className="mt-1 text-[10.5px] text-foreground/55 italic line-clamp-2">{bp.hook}</p>
          )}

          {/* Engine + cost meta */}
          <div className="mt-2 flex items-center gap-2 text-[9px] font-mono uppercase tracking-[0.18em]">
            <span
              className="inline-flex items-center gap-1 h-4 px-1.5 rounded-md"
              style={{
                color: tierHue,
                background: `${tierHue.replace(")", " / 0.12)").replace("hsl(", "hsla(")}`,
              }}
            >
              <Cpu className="w-2.5 h-2.5" />
              {engine?.shortLabel ?? bp.engine}
            </span>
            <span className="text-foreground/55 tabular-nums">{bp.estimatedDurationSec}s · {bp.estimatedCreditCost === 0 ? "free" : `${bp.estimatedCreditCost}c`}</span>
          </div>
        </div>

        {/* Hover CTA */}
        {hover && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <span className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-foreground/95 text-background text-[11px] font-medium tracking-wide shadow-[0_15px_45px_-12px_hsla(0,0%,100%,0.45)] animate-fade-in">
              <Wand2 className="w-3.5 h-3.5" />
              Build crossover
            </span>
          </div>
        )}
      </div>
    </button>
  );
});
CrossoverCard.displayName = "CrossoverCard";

// ─────────────────────────────────────────────────────────────────────────────
// Filter pill — shared style
// ─────────────────────────────────────────────────────────────────────────────
function FilterPill({
  active, onClick, children, icon,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[11px] font-mono uppercase tracking-[0.18em] whitespace-nowrap transition-all",
        active
          ? "relative text-foreground after:absolute after:-bottom-0.5 after:left-1/2 after:h-[2px] after:w-6 after:-ml-3 after:rounded-full after:bg-white after:shadow-[0_0_8px_-1px_rgba(255,255,255,0.45)] after:content-['']"
          : "text-foreground/55 hover:text-foreground/85",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Category rail
// ─────────────────────────────────────────────────────────────────────────────
function CategoryRail({
  category, items, onOpenCard, onSeeAll, favorites, onToggleFavorite,
}: {
  category: { id: CrossoverCategory; label: string };
  items: CrossoverBlueprint[];
  onOpenCard: (bp: CrossoverBlueprint) => void;
  onSeeAll: () => void;
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const scrollBy = (delta: number) => railRef.current?.scrollBy({ left: delta, behavior: "smooth" });

  return (
    <div className="relative">
      <div className="flex items-baseline justify-between gap-4 mb-4">
        <div className="flex items-baseline gap-3 min-w-0">
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
          <button
            onClick={() => scrollBy(-560)}
            className="hidden sm:inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.03] hover:bg-white/[0.06] backdrop-blur text-foreground/55 hover:text-foreground/85 transition-colors"
            aria-label="Scroll left"
          >‹</button>
          <button
            onClick={() => scrollBy(560)}
            className="hidden sm:inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.03] hover:bg-white/[0.06] backdrop-blur text-foreground/55 hover:text-foreground/85 transition-colors"
            aria-label="Scroll right"
          >›</button>
          <button
            onClick={onSeeAll}
            className="ml-1 inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-white/[0.03] hover:bg-white/[0.06] backdrop-blur text-[10px] font-mono uppercase tracking-[0.20em] text-foreground/70 hover:text-foreground/95 transition-colors whitespace-nowrap"
          >
            See all {items.length}
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="relative -mx-1">
        <div
          aria-hidden className="pointer-events-none absolute top-0 bottom-0 left-0 w-12 z-10"
          style={{ background: "linear-gradient(90deg, hsl(220 30% 3% / 0.85), transparent)" }}
        />
        <div
          aria-hidden className="pointer-events-none absolute top-0 bottom-0 right-0 w-12 z-10"
          style={{ background: "linear-gradient(270deg, hsl(220 30% 3% / 0.85), transparent)" }}
        />
        <div
          ref={railRef}
          className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2 px-1"
          style={{ scrollbarWidth: "none" }}
        >
          {items.map((bp, i) => (
            <div key={bp.id} className="snap-start flex-shrink-0 w-[58vw] sm:w-[300px] md:w-[280px] lg:w-[260px]">
              <CrossoverCard
                bp={bp}
                index={i}
                onOpen={() => onOpenCard(bp)}
                isFavorite={favorites.has(bp.id)}
                onToggleFavorite={() => onToggleFavorite(bp.id)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page body
// ─────────────────────────────────────────────────────────────────────────────
function CrossoverContent() {
  usePageTone(TONE_PRESETS.crossover);
  const { user } = useAuth();
  const { navigate } = useSafeNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { blueprints, loading, error } = useAllCrossoverBlueprints();
  const [favorites, toggleFavorite] = useFavorites();

  // Persisted filters
  const FILTERS_KEY = "sb_crossover_filters_v2";
  type Persisted = {
    search: string;
    category: CategoryFilter;
    engine: EngineFilter;
    aspect: AspectFilter;
    subjectOnly: boolean;
  };
  const loadLocal = (): Persisted => {
    try {
      const raw = localStorage.getItem(FILTERS_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        return {
          search:      typeof p.search === "string" ? p.search : "",
          category:    typeof p.category === "string" ? p.category : "all",
          engine:      ENGINE_FILTERS.some(e => e.id === p.engine) ? p.engine : "all",
          aspect:      ASPECT_FILTERS.some(a => a.id === p.aspect) ? p.aspect : "all",
          subjectOnly: !!p.subjectOnly,
        };
      }
    } catch { /* noop */ }
    return { search: "", category: "all", engine: "all", aspect: "all", subjectOnly: false };
  };
  const initial = useMemo(() => {
    const local = loadLocal();
    return {
      search:      searchParams.get("search")   ?? local.search,
      category:    (searchParams.get("category") as CategoryFilter)    ?? local.category,
      engine:      (searchParams.get("engine")   as EngineFilter)      ?? local.engine,
      aspect:      (searchParams.get("aspect")   as AspectFilter)      ?? local.aspect,
      subjectOnly: searchParams.get("subject") === "1" || local.subjectOnly,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [searchQuery, setSearchQuery] = useState(initial.search);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(initial.category);
  const [engineFilter, setEngineFilter] = useState<EngineFilter>(initial.engine);
  const [aspectFilter, setAspectFilter] = useState<AspectFilter>(initial.aspect);
  const [subjectOnly, setSubjectOnly] = useState(initial.subjectOnly);
  const [drawerOpenId, setDrawerOpenId] = useState<string | null>(null);
  const [composerTemplate, setComposerTemplate] = useState<CrossoverTemplate | null>(null);
  const [quickSubmitting, setQuickSubmitting] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams();
    if (searchQuery.trim()) p.set("search", searchQuery.trim());
    if (categoryFilter !== "all") p.set("category", categoryFilter);
    if (engineFilter !== "all")   p.set("engine", engineFilter);
    if (aspectFilter !== "all")   p.set("aspect", aspectFilter);
    if (subjectOnly)              p.set("subject", "1");
    setSearchParams(p, { replace: true });
    try {
      localStorage.setItem(FILTERS_KEY, JSON.stringify({
        search: searchQuery, category: categoryFilter, engine: engineFilter, aspect: aspectFilter, subjectOnly,
      }));
    } catch { /* noop */ }
  }, [searchQuery, categoryFilter, engineFilter, aspectFilter, subjectOnly, setSearchParams]);

  const filtered = useMemo(() => {
    return blueprints.filter((bp) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hit = bp.name.toLowerCase().includes(q)
          || bp.hook.toLowerCase().includes(q)
          || bp.purePrompt.toLowerCase().includes(q)
          || (bp.tags?.some(t => t.toLowerCase().includes(q)) ?? false);
        if (!hit) return false;
      }
      if (categoryFilter === "favorites") {
        if (!favorites.has(bp.id)) return false;
      } else if (categoryFilter !== "all") {
        if (bp.category !== categoryFilter) return false;
      }
      if (!engineMatchesFilter(bp.engine, engineFilter)) return false;
      if (!aspectMatchesFilter(bp.aspectRatio, aspectFilter)) return false;
      if (subjectOnly && !bp.acceptsSubject) return false;
      return true;
    });
  }, [blueprints, searchQuery, categoryFilter, engineFilter, aspectFilter, subjectOnly, favorites]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (a.isFeatured && !b.isFeatured) return -1;
      if (!a.isFeatured && b.isFeatured) return 1;
      const so = (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999);
      if (so !== 0) return so;
      return (b.useCount ?? 0) - (a.useCount ?? 0);
    });
  }, [filtered]);

  const featured = useMemo(() => sorted.filter(t => t.isFeatured), [sorted]);

  const stats = useMemo(() => ({
    total:    sorted.length,
    featured: sorted.filter(t => t.isFeatured).length,
    favs:     favorites.size,
    subject:  sorted.filter(t => t.acceptsSubject).length,
  }), [sorted, favorites]);

  const activeBlueprint = drawerOpenId ? findCrossoverBlueprint(blueprints, drawerOpenId) ?? null : null;

  // Convert a blueprint back into the legacy CrossoverTemplate shape that
  // TemplateComposer expects (we still use that as the customisation flow).
  const toLegacyTemplate = (bp: CrossoverBlueprint): CrossoverTemplate => ({
    id: bp.id,
    slug: bp.slug,
    name: bp.name,
    category: bp.category,
    pure_prompt: bp.purePrompt,
    hook: bp.hook,
    chrome_kind: bp.chrome.kind,
    aspect_ratio: bp.aspectRatio as CrossoverTemplate["aspect_ratio"],
    accepts_subject: bp.acceptsSubject,
    accepts_source_video: bp.acceptsSourceVideo,
    thumbnail_url: bp.thumbnailUrl,
    is_featured: !!bp.isFeatured,
  });

  const onCustomize = (bp: CrossoverBlueprint) => {
    if (!user) { navigate("/auth"); return; }
    setDrawerOpenId(null);
    setComposerTemplate(toLegacyTemplate(bp));
  };

  const onQuickGenerate = async (bp: CrossoverBlueprint, mood: CrossoverMood) => {
    if (!user) { navigate("/auth"); return; }
    setQuickSubmitting(true);
    try {
      const composed = composeCrossoverPrompt(bp, "", mood);
      const { data, error } = await supabase.functions.invoke("mode-router", {
        body: {
          mode: "text-to-video",
          prompt: composed,
          stylePreset: "cinematic",
          crossoverTemplateSlug: bp.slug,
          aspectRatio: bp.aspectRatio,
        },
      });
      if (error || data?.error) throw error || new Error(data?.error || "Generation failed to start");
      if (!data?.projectId) throw new Error("No project id returned");
      toast.success("Crossover generation started");
      navigate(`/production/${data.projectId}`);
      setDrawerOpenId(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Generation failed";
      toast.error(msg);
    } finally {
      setQuickSubmitting(false);
    }
  };

  return (
    <div className="relative">
      {/* ── HEADER ─────────────────────────────────────────────── */}
      <header className="relative pb-8 pt-8 sm:pt-10">
        <EditorialEyebrow>Crossover</EditorialEyebrow>
        <EditorialHeadline className="mt-5" size="md">
          Break the screen.
        </EditorialHeadline>
        <p className="mt-5 max-w-xl text-[14px] font-light leading-relaxed text-muted-foreground/70">
          VFX crossovers — pick a recipe, drop your subject, render.
        </p>

        <div className="mt-7 max-w-md">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/55" />
            <Input
              placeholder="Search — dancer, tiger, code, oil painting…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11 h-12 bg-white/[0.04] border-transparent text-foreground placeholder:text-foreground/35 rounded-full text-[13px] backdrop-blur"
            />
          </div>
        </div>
      </header>

      {/* ── SECONDARY FILTERS ──────────────────────────────────── */}
      <section className="space-y-4 pb-6">
        <IconFilterRow title="Engine">
          {ENGINE_FILTERS.map((opt) => (
            <IconFilterTile
              key={opt.id}
              active={engineFilter === opt.id}
              onClick={() => setEngineFilter(opt.id)}
              Icon={opt.Icon}
              label={opt.label}
            />
          ))}
        </IconFilterRow>

        <IconFilterRow title="Aspect">
          {ASPECT_FILTERS.map((opt) => (
            <IconFilterTile
              key={opt.id}
              active={aspectFilter === opt.id}
              onClick={() => setAspectFilter(opt.id)}
              Icon={opt.Icon}
              label={opt.label}
            />
          ))}
        </IconFilterRow>

        <div className="flex flex-wrap items-center gap-2">
          <span className="hidden sm:inline-block font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/40 mr-2 w-16">
            Extras
          </span>
          <FilterPill active={subjectOnly} onClick={() => setSubjectOnly(!subjectOnly)} icon={<UserIcon className="w-3.5 h-3.5" />}>
            Accepts subject
          </FilterPill>
          <FilterPill
            active={categoryFilter === "favorites"}
            onClick={() => setCategoryFilter(categoryFilter === "favorites" ? "all" : "favorites")}
            icon={<Star className="w-3.5 h-3.5" fill={categoryFilter === "favorites" ? "currentColor" : "none"} />}
          >
            Favorites {favorites.size > 0 ? `(${favorites.size})` : ""}
          </FilterPill>
        </div>
      </section>

      <div aria-hidden className="my-9" />

      {/* ── BODY ──────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-24 gap-3 text-foreground/55">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-[12px] font-mono uppercase tracking-[0.22em]">Loading crossovers…</span>
        </div>
      ) : error ? (
        <div className="text-center py-20 max-w-md mx-auto">
          <Sparkles className="w-8 h-8 mx-auto mb-4 text-rose-300/60" />
          <h3 className="font-display italic text-[22px] text-foreground/95 mb-2">Couldn't load crossovers</h3>
          <p className="text-[12px] text-foreground/55">{safeErrorMessage(error, "Please try again in a moment.")}</p>
        </div>
      ) : categoryFilter === "all" ? (
        <section className="pb-16 space-y-12">
          {(searchQuery.trim() || engineFilter !== "all" || aspectFilter !== "all" || subjectOnly) && (
            <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/40 -mt-2">
              {sorted.length} match{sorted.length === 1 ? "" : "es"} across filters
            </div>
          )}

          {/* Featured rail (only when there are featured items and no other filters narrow the set) */}
          {featured.length > 0 && (
            <CategoryRail
              category={{ id: "vertical_ui", label: "◆ Featured tonight" }}
              items={featured}
              favorites={favorites}
              onToggleFavorite={toggleFavorite}
              onOpenCard={(bp) => setDrawerOpenId(bp.id)}
              onSeeAll={() => { /* no-op for featured */ }}
            />
          )}

          {CATEGORY_ORDER_FOR_RAILS.map((catId) => {
            const inRail = sorted.filter(bp => bp.category === catId);
            if (inRail.length === 0) return null;
            return (
              <CategoryRail
                key={catId}
                category={{ id: catId, label: CROSSOVER_CATEGORY_LABELS[catId] }}
                items={inRail}
                favorites={favorites}
                onToggleFavorite={toggleFavorite}
                onOpenCard={(bp) => setDrawerOpenId(bp.id)}
                onSeeAll={() => {
                  setCategoryFilter(catId);
                  window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
                }}
              />
            );
          })}

          {sorted.length === 0 && (
            <EmptyState onReset={() => {
              setSearchQuery(""); setCategoryFilter("all"); setEngineFilter("all"); setAspectFilter("all"); setSubjectOnly(false);
            }} />
          )}
        </section>
      ) : (
        <section className="pb-16">
          <div className="flex items-baseline justify-between mb-5 gap-4 flex-wrap">
            <div className="flex items-baseline gap-4">
              <button
                onClick={() => setCategoryFilter("all")}
                className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/45 hover:text-foreground/85 transition-colors inline-flex items-center gap-1.5"
              >
                ← All crossovers
              </button>
              <h2 className="text-[clamp(1.6rem,3.5vw,2.4rem)] font-display italic font-light leading-tight">
                <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/60 bg-clip-text text-transparent">
                  {categoryFilter === "favorites" ? "Favorites" : CROSSOVER_CATEGORY_LABELS[categoryFilter as CrossoverCategory]}
                </span>
                <span className="ml-3 font-mono text-[12px] font-normal not-italic uppercase tracking-[0.22em] text-foreground/40 tabular-nums">
                  {sorted.length}
                </span>
              </h2>
            </div>
            <span className="hidden sm:inline-block font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/40">
              tap any card to inspect the blueprint
            </span>
          </div>

          {sorted.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {sorted.map((bp, i) => (
                <CrossoverCard
                  key={bp.id}
                  bp={bp}
                  index={i}
                  onOpen={() => setDrawerOpenId(bp.id)}
                  isFavorite={favorites.has(bp.id)}
                  onToggleFavorite={() => toggleFavorite(bp.id)}
                />
              ))}
            </div>
          ) : (
            <EmptyState onReset={() => {
              setSearchQuery(""); setCategoryFilter("all"); setEngineFilter("all"); setAspectFilter("all"); setSubjectOnly(false);
            }} />
          )}
        </section>
      )}

      {/* ── DETAIL DRAWER ──────────────────────────────────────── */}
      <CrossoverDetailDrawer
        crossover={activeBlueprint}
        open={!!activeBlueprint}
        onClose={() => setDrawerOpenId(null)}
        onCustomize={onCustomize}
        onQuickGenerate={(bp, mood) => { if (!quickSubmitting) void onQuickGenerate(bp, mood); }}
        isFavorite={activeBlueprint ? favorites.has(activeBlueprint.id) : false}
        onToggleFavorite={() => { if (activeBlueprint) toggleFavorite(activeBlueprint.id); }}
      />

      {/* ── LEGACY COMPOSER MODAL (Customize CTA) ──────────────── */}
      <AnimatePresence>
        {composerTemplate && (
          <TemplateComposer template={composerTemplate} onClose={() => setComposerTemplate(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function FloatingStat({
  label, value, hue,
}: { label: string; value: number; hue?: string; }) {
  return (
    <div className="inline-block">
      <div className={cn("text-[clamp(1.5rem,3vw,2rem)] font-display italic font-light leading-none tabular-nums", hue ?? "text-foreground/95")}>
        {value}
      </div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-foreground/40">{label}</div>
    </div>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="text-center py-20">
      <div className="mx-auto mb-5 inline-flex items-center justify-center w-14 h-14 rounded-full bg-white/[0.04] backdrop-blur shadow-[0_10px_34px_-14px_hsla(220,45%,2%,0.85)]">
        <Sparkles className="w-6 h-6 text-foreground/55" />
      </div>
      <h3 className="text-xl font-display italic text-foreground/95 mb-2">No crossovers matched</h3>
      <p className="text-[13px] text-foreground/55 mb-5 max-w-sm mx-auto">
        Try clearing a filter — your category + engine + aspect combination might be too narrow.
      </p>
      <Button
        variant="ghost"
        className="border-transparent bg-white/[0.04] backdrop-blur text-foreground hover:bg-white/[0.08] rounded-full"
        onClick={onReset}
      >
        Clear filters
        <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Public page
// ─────────────────────────────────────────────────────────────────────────────
export default function Crossover() {
  usePageMeta({
    title: "Crossover — Small Bridges",
    description: "Fifty VFX crossovers that break the fourth wall. Engine + aspect + chrome + recipe + 10 moods, ready to render.",
  });
  const liveRenderTimecode = useLiveRenderTimecode();

  return (
    <ErrorBoundary>
      <FoundationShell>
        <div className="relative mx-auto w-full max-w-[1440px] px-4 pb-24 pt-10 sm:px-6 lg:px-10">
          <EditorialCanvas
            maxWidth="100%"
            chrome={{
              crumbs: ["Small Bridges", "crossover"],
              timecode: liveRenderTimecode ?? "CROSSOVER · LIVE",
            }}
          >
            <CrossoverContent />
          </EditorialCanvas>
        </div>
      </FoundationShell>
    </ErrorBoundary>
  );
}
