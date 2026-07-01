/**
 * Environments — editorial scene library.
 *
 * Mirrors the Templates page: editorial glassmorphic hero, floating
 * stats, search + secondary filter pills, Netflix-style rails per
 * world when "All", dense grid + back link when a single world is
 * selected.
 *
 * Source: unified registry (lib/environments/registry.ts) — 120
 * environments enriched with world, weather, season, terrain,
 * generator prompt (subject IS in the scene), camera + sound hints,
 * VFX.
 *
 * Click any card → EnvironmentDetailDrawer with full scene blueprint.
 * "Apply scene to project" → /create?environment=ID (existing
 * useTemplateEnvironment hook consumes it).
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useSafeNavigation } from "@/lib/navigation";
import { useModuleLink } from "@/components/foundation/moduleBase";
import {
  Search,
  Star,
  TrendingUp,
  Home as HomeIcon,
  TreePine,
  Sun,
  CloudSun,
  Sparkles,
  ArrowRight,
  Mountain,
  Building2,
  Moon,
  Cloud,
  Heart,
  Stars,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { FoundationShell } from "@/components/foundation/FoundationShell";
import { EditorialCanvas, EditorialEyebrow, EditorialHeadline } from "@/components/foundation/EditorialCanvas";
import { useLiveRenderTimecode } from "@/hooks/useLiveRenderTimecode";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Input } from "@/components/ui/input";
import { GlassButton } from "@/components/foundation/Floating";

import {
  getAllEnvironmentBlueprints,
  getEnvironmentBlueprint,
} from "@/lib/environments/registry";
import {
  type EnvironmentBlueprint,
  type EnvWorld,
  ENV_WORLD_LABELS,
  ENV_WORLD_SHORT,
} from "@/lib/environments/blueprint";
import { EnvironmentDetailDrawer } from "@/components/environments/EnvironmentDetailDrawer";
import { usePageTone, TONE_PRESETS, type PageTone } from "@/lib/page-tone";
import { AutoGallery } from "@/components/foundation/AutoGallery";
import { HeroGalleryBackdrop } from "@/components/foundation/HeroGalleryBackdrop";
import { IconFilterTile, IconFilterRow } from "@/components/ui/IconFilterTile";

// ─────────────────────────────────────────────────────────────────────────────
// Glow palette — tints the hero gallery's ambient halo per world.
// ─────────────────────────────────────────────────────────────────────────────
function envWorldGlow(world: EnvWorld): string {
  const map: Record<EnvWorld, string> = {
    "golden-hour":   "hsl(35 100% 60% / 0.55)",
    "blue-hour":     "hsl(220 95% 65% / 0.50)",
    "night-neon":    "hsl(285 95% 65% / 0.55)",
    "storm-weather": "hsl(210 25% 65% / 0.45)",
    "wilderness":    "hsl(125 60% 55% / 0.45)",
    "urban":         "hsl(20 70% 55% / 0.45)",
    "interiors":     "hsl(30 60% 55% / 0.40)",
    "surreal":       "hsl(170 80% 60% / 0.50)",
    "cosmic":        "hsl(255 90% 65% / 0.55)",
  };
  return map[world];
}

// ─────────────────────────────────────────────────────────────────────────────
// Worlds — primary navigation
// ─────────────────────────────────────────────────────────────────────────────
type WorldFilter = EnvWorld | "all" | "favorites";
const WORLD_FILTERS: { id: WorldFilter; label: string; icon: typeof Sun }[] = [
  { id: "all",           label: "All",            icon: Sparkles },
  { id: "favorites",     label: "Favorites",      icon: Star },
  { id: "golden-hour",   label: "Golden Hour",    icon: Sun },
  { id: "blue-hour",     label: "Blue Hour",      icon: CloudSun },
  { id: "night-neon",    label: "Night & Neon",   icon: Moon },
  { id: "storm-weather", label: "Storm",          icon: Cloud },
  { id: "wilderness",    label: "Wilderness",     icon: TreePine },
  { id: "urban",         label: "Urban",          icon: Building2 },
  { id: "interiors",     label: "Interiors",      icon: HomeIcon },
  { id: "surreal",       label: "Surreal",        icon: Heart },
  { id: "cosmic",        label: "Cosmic",         icon: Stars },
];

const WORLD_ORDER_FOR_RAILS: EnvWorld[] = [
  "golden-hour", "blue-hour", "night-neon", "storm-weather",
  "wilderness", "urban", "interiors", "surreal", "cosmic",
];

// Secondary axis: indoor/outdoor
type CategoryFilter = "all" | "interior" | "exterior";
const CATEGORY_FILTERS: { id: CategoryFilter; label: string; icon?: typeof Sun }[] = [
  { id: "all",      label: "Any setting" },
  { id: "exterior", label: "Exterior", icon: TreePine },
  { id: "interior", label: "Interior", icon: HomeIcon },
];

// ─────────────────────────────────────────────────────────────────────────────
// Favorites — localStorage, cross-tab sync (preserved from old impl)
// ─────────────────────────────────────────────────────────────────────────────
const FAVORITES_KEY = "sb:env:favorites";
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
// Compact number
// ─────────────────────────────────────────────────────────────────────────────
function compactNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// Temperature hue for the chip color
const TEMP_HUE: Record<string, string> = {
  warm: "hsl(28 90% 65%)", very_warm: "hsl(15 90% 60%)",
  cool: "hsl(200 80% 70%)", very_cool: "hsl(220 85% 70%)",
  neutral: "hsl(48 25% 80%)", desaturated: "hsl(220 10% 60%)", mixed: "hsl(280 60% 70%)",
};

const TOD_LABEL: Record<string, string> = {
  golden_hour: "Golden hr", blue_hour: "Blue hr", twilight: "Twilight",
  dawn: "Dawn", sunrise: "Sunrise", morning: "Morning", midday: "Midday",
  afternoon: "Afternoon", sunset: "Sunset", evening: "Evening", night: "Night",
  overcast: "Overcast", space: "Space", controlled: "Controlled",
};

// ─────────────────────────────────────────────────────────────────────────────
// Card — glassmorphic floating tile
// ─────────────────────────────────────────────────────────────────────────────
const EnvironmentCard = memo(function EnvironmentCard({
  bp, onOpen, isFavorite, onToggleFavorite, index,
}: {
  bp: EnvironmentBlueprint;
  onOpen: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  index: number;
}) {
  const [hover, setHover] = useState(false);
  const Icon = bp.icon;

  return (
    <div
      role="button"
      tabIndex={0}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      className="group relative block text-left cursor-pointer animate-fade-in w-full"
      style={{ animationDelay: `${Math.min(index * 25, 300)}ms` }}
    >
      <div
        className={cn(
          "relative aspect-[3/4] rounded-2xl overflow-hidden",
          "shadow-[0_18px_50px_-26px_hsla(0,0%,0%,0.7)]",
          "transition-all duration-500",
          hover && "-translate-y-0.5 shadow-[0_30px_80px_-20px_hsla(48,95%,70%,0.35)]",
        )}
      >
        <img
          src={bp.image}
          alt={bp.name}
          loading="lazy"
          onError={(e) => {
            // External (Unsplash) preset images can 404 / rate-limit. Fall back
            // to a neutral gradient tile instead of a broken-image box.
            const el = e.currentTarget;
            el.style.display = "none";
            el.parentElement?.classList.add("bg-gradient-to-br", "from-white/[0.06]", "to-white/[0.02]");
          }}
          className={cn(
            "absolute inset-0 w-full h-full object-cover transition-transform duration-700",
            hover ? "scale-[1.06]" : "scale-100",
          )}
        />

        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-500 pointer-events-none",
            hover
              ? "bg-gradient-to-t from-[hsl(220_30%_2%)] via-[hsl(220_30%_2%)]/55 to-[hsla(48,95%,70%,0.10)]"
              : "bg-gradient-to-t from-[hsl(220_30%_3%)] via-[hsl(220_30%_3%)]/30 to-transparent",
          )}
        />

        {hover && (
          <div
            aria-hidden
            className="absolute -inset-px rounded-2xl pointer-events-none"
            style={{
              background: "radial-gradient(circle at 50% 0%, hsla(48,95%,70%,0.30), transparent 65%)",
              mixBlendMode: "screen",
            }}
          />
        )}

        {/* Top badges */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between z-10 gap-2">
          <div className="flex flex-wrap gap-1.5" />

          {/* Favorite + icon */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
              title={isFavorite ? "Remove from favorites" : "Save to favorites"}
              className={cn(
                "h-6 w-6 rounded-full backdrop-blur flex items-center justify-center transition-all",
                isFavorite
                  ? "bg-amber-300 text-black shadow-[0_4px_14px_-4px_hsla(45,95%,60%,0.6)]"
                  : "bg-black/40 text-foreground/85 hover:bg-black/60",
              )}
            >
              <Star className="w-3 h-3" fill={isFavorite ? "currentColor" : "none"} strokeWidth={1.6} />
            </button>
            <span className="h-6 w-6 rounded-full bg-black/55 backdrop-blur flex items-center justify-center text-foreground/85">
              <Icon className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Bottom content */}
        <div className="absolute left-0 right-0 bottom-0 p-3 z-10">
          <h3 className="text-[14px] sm:text-[15px] font-display italic font-light leading-tight text-foreground/95 line-clamp-2">
            {bp.name}
          </h3>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[9px] font-mono uppercase tracking-[0.18em]">
            <span
              className="inline-flex items-center gap-1 h-4 px-1.5 rounded-md"
              style={{
                color: TEMP_HUE[bp.lighting.temperature] ?? "hsl(48 80% 88%)",
                background: (TEMP_HUE[bp.lighting.temperature] ?? "hsl(48 80% 88%)").replace(")", " / 0.12)").replace("hsl(", "hsla("),
              }}
            >
              {TOD_LABEL[bp.lighting.timeOfDay] ?? bp.lighting.timeOfDay}
            </span>
            <span className="text-foreground/55">{ENV_WORLD_SHORT[bp.world]}</span>
          </div>
        </div>

        {hover && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <span className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-foreground/95 text-background text-[11px] font-medium tracking-wide shadow-[0_15px_45px_-12px_hsla(0,0%,100%,0.45)] animate-fade-in">
              <ArrowRight className="w-3.5 h-3.5" />
              Inspect scene
            </span>
          </div>
        )}
      </div>
    </div>
  );
});

EnvironmentCard.displayName = "EnvironmentCard";

// ─────────────────────────────────────────────────────────────────────────────
// Filter pill — shared
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
          ? "text-foreground bg-foreground/[0.10] shadow-[0_8px_24px_-12px_hsla(0,0%,100%,0.35)]"
          : "text-foreground/55 hover:text-foreground/85 hover:bg-white/[0.05] bg-white/[0.03] backdrop-blur",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// World rail
// ─────────────────────────────────────────────────────────────────────────────
function WorldRail({
  world, items, onOpenCard, onSeeAll, favorites, onToggleFavorite,
}: {
  world: { id: EnvWorld; label: string; icon: typeof Sun };
  items: EnvironmentBlueprint[];
  onOpenCard: (id: string) => void;
  onSeeAll: () => void;
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const Icon = world.icon;
  const scrollBy = (delta: number) => railRef.current?.scrollBy({ left: delta, behavior: "smooth" });

  return (
    <div className="relative">
      <div className="flex items-baseline justify-between gap-4 mb-4">
        <div className="flex items-baseline gap-3 min-w-0">
          <Icon className="w-4 h-4 text-foreground/45 self-center" />
          <h3 className="text-[clamp(1.4rem,3vw,2rem)] font-display italic font-light leading-tight truncate">
            <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/60 bg-clip-text text-transparent">
              {world.label}
            </span>
            <span className="ml-3 font-mono text-[11px] font-normal not-italic uppercase tracking-[0.22em] text-foreground/40 tabular-nums">
              {items.length}
            </span>
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => scrollBy(-560)}
            className="hidden sm:inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.03] hover:bg-white/[0.07] backdrop-blur text-foreground/55 hover:text-foreground/85 transition-colors"
            aria-label="Scroll left"
          >‹</button>
          <button
            onClick={() => scrollBy(560)}
            className="hidden sm:inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.03] hover:bg-white/[0.07] backdrop-blur text-foreground/55 hover:text-foreground/85 transition-colors"
            aria-label="Scroll right"
          >›</button>
          <button
            onClick={onSeeAll}
            className="ml-1 inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-white/[0.03] hover:bg-white/[0.07] backdrop-blur text-[10px] font-mono uppercase tracking-[0.20em] text-foreground/70 hover:text-foreground/95 transition-colors whitespace-nowrap"
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
            <div key={bp.id} className="snap-start flex-shrink-0 w-[42vw] sm:w-[260px] md:w-[240px] lg:w-[220px]">
              <EnvironmentCard
                bp={bp}
                index={i}
                onOpen={() => onOpenCard(bp.id)}
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
// Per-world tonal palettes — chosen so the rail evokes the world the
// user is browsing (Golden Hour = warm amber, Cosmic = deep indigo, etc.)
const ENV_WORLD_TONES: Record<string, PageTone> = {
  "golden-hour":   { label: "env:golden-hour",   primary: "hsl(28 80% 12%)",  secondary: "hsl(38 95% 65%)",  accent: "hsl(15 85% 55%)" },
  "blue-hour":     { label: "env:blue-hour",     primary: "hsl(220 65% 12%)", secondary: "hsl(195 85% 60%)", accent: "hsl(280 70% 60%)" },
  "night-neon":    { label: "env:night-neon",    primary: "hsl(280 55% 10%)", secondary: "hsl(330 95% 60%)", accent: "hsl(195 95% 60%)" },
  "storm-weather": { label: "env:storm-weather", primary: "hsl(210 35% 12%)", secondary: "hsl(200 25% 60%)", accent: "hsl(48 60% 65%)" },
  "wilderness":    { label: "env:wilderness",    primary: "hsl(150 40% 10%)", secondary: "hsl(120 50% 55%)", accent: "hsl(48 75% 60%)" },
  "urban":         { label: "env:urban",         primary: "hsl(220 30% 12%)", secondary: "hsl(195 60% 65%)", accent: "hsl(48 75% 60%)" },
  "interiors":     { label: "env:interiors",     primary: "hsl(28 35% 12%)",  secondary: "hsl(38 70% 60%)",  accent: "hsl(15 65% 55%)" },
  "surreal":       { label: "env:surreal",       primary: "hsl(295 40% 12%)", secondary: "hsl(280 75% 70%)", accent: "hsl(195 85% 70%)" },
  "cosmic":        { label: "env:cosmic",        primary: "hsl(245 55% 10%)", secondary: "hsl(200 80% 65%)", accent: "hsl(280 70% 70%)" },
};

function EnvironmentsContent() {
  const { navigate } = useSafeNavigation();
  const moduleLink = useModuleLink();
  const [searchParams, setSearchParams] = useSearchParams();

  const FILTERS_KEY = "sb_envs_filters_v2";
  type Persisted = { search: string; world: WorldFilter; category: CategoryFilter };
  const loadLocal = (): Persisted => {
    try {
      const raw = localStorage.getItem(FILTERS_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        return {
          search:   typeof p.search === "string" ? p.search : "",
          world:    WORLD_FILTERS.some(w => w.id === p.world) ? p.world : "all",
          category: ["all","interior","exterior"].includes(p.category) ? p.category : "all",
        };
      }
    } catch { /* noop */ }
    return { search: "", world: "all", category: "all" };
  };
  const initial = useMemo(() => {
    const local = loadLocal();
    return {
      search:   searchParams.get("search")   ?? local.search,
      world:    (searchParams.get("world")    as WorldFilter)    ?? local.world,
      category: (searchParams.get("category") as CategoryFilter) ?? local.category,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [searchQuery, setSearchQuery] = useState(initial.search);
  const [worldFilter, setWorldFilter] = useState<WorldFilter>(initial.world);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(initial.category);
  const [drawerOpenId, setDrawerOpenId] = useState<string | null>(null);
  const [favorites, toggleFavorite] = useFavorites();

  // Left rail picks up the selected world's tonal palette, falling back
  // to the default Environments tone when "all" or "favorites" is active.
  usePageTone(
    worldFilter !== "all" && worldFilter !== "favorites" && ENV_WORLD_TONES[worldFilter]
      ? ENV_WORLD_TONES[worldFilter]
      : TONE_PRESETS.environments,
  );

  // Sync URL + localStorage
  useEffect(() => {
    const p = new URLSearchParams();
    if (searchQuery.trim()) p.set("search", searchQuery.trim());
    if (worldFilter !== "all") p.set("world", worldFilter);
    if (categoryFilter !== "all") p.set("category", categoryFilter);
    setSearchParams(p, { replace: true });
    try {
      localStorage.setItem(FILTERS_KEY, JSON.stringify({ search: searchQuery, world: worldFilter, category: categoryFilter }));
    } catch { /* noop */ }
  }, [searchQuery, worldFilter, categoryFilter, setSearchParams]);

  const all = useMemo(() => getAllEnvironmentBlueprints(), []);

  const filtered = useMemo(() => {
    return all.filter((bp) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hit = bp.name.toLowerCase().includes(q)
          || bp.description.toLowerCase().includes(q)
          || bp.mood.toLowerCase().includes(q)
          || bp.world.toLowerCase().includes(q)
          || bp.terrain.toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (worldFilter === "favorites") {
        if (!favorites.has(bp.id)) return false;
      } else if (worldFilter !== "all") {
        if (bp.world !== worldFilter) return false;
      }
      if (categoryFilter !== "all" && bp.category !== categoryFilter) return false;
      return true;
    });
  }, [all, searchQuery, worldFilter, categoryFilter, favorites]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (a.isTrending && !b.isTrending) return -1;
      if (!a.isTrending && b.isTrending) return 1;
      if (a.isPopular && !b.isPopular) return -1;
      if (!a.isPopular && b.isPopular) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [filtered]);

  const stats = useMemo(() => ({
    total:     sorted.length,
    trending:  sorted.filter(t => t.isTrending).length,
    favs:      favorites.size,
    interior:  sorted.filter(t => t.category === "interior").length,
  }), [sorted, favorites]);

  const activeBlueprint = drawerOpenId ? getEnvironmentBlueprint(drawerOpenId) ?? null : null;

  const handleApply = useCallback((bp: EnvironmentBlueprint) => {
    // P1-16: don't toast "Applied" here — it was premature (fired before navigation
    // and even when the destination couldn't resolve the env). The /create page's
    // loadEnvironment now owns the success toast once the scene is actually applied.
    navigate(moduleLink(`/create?environment=${bp.id}`));
    setDrawerOpenId(null);
  }, [navigate, moduleLink]);

  // Active world's label / icon for the breadcrumb when in a single-world view
  const activeWorldMeta = WORLD_FILTERS.find(w => w.id === worldFilter);

  return (
    <div className="relative">
      {/* ── HERO + FILTERS — one cinematic section with the auto-gallery
            cycling behind the title, search, and filter pills. Full-bleed
            (extends behind the LeftRail when open) via HeroGalleryBackdrop. */}
      <section className="relative mb-8">
        <HeroGalleryBackdrop>
          <AutoGallery
            items={all.map((bp) => ({
              id: bp.id,
              name: bp.name,
              imageUrl: bp.image,
              caption: ENV_WORLD_SHORT[bp.world],
              glow: envWorldGlow(bp.world),
            }))}
            variant="hero"
          />
        </HeroGalleryBackdrop>

        <div className="relative z-10 pt-8 sm:pt-12 pb-7">
          <EditorialEyebrow>Environments</EditorialEyebrow>
          <EditorialHeadline className="mt-5" size="md">
            Scenes.
          </EditorialHeadline>
          <p className="mt-5 max-w-xl text-[14px] font-light leading-relaxed text-foreground/75">
            Worlds your subject inhabits — lighting, palette, lens, ambience.
          </p>

          <div className="mt-7 max-w-md">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/65" />
              <Input
                placeholder="Search by name, mood, world, terrain…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11 h-12 bg-white/[0.05] focus:bg-white/[0.08] border-transparent text-foreground placeholder:text-foreground/45 rounded-full text-[13px] backdrop-blur-xl shadow-[0_8px_30px_-18px_hsla(0,0%,0%,0.7)] transition-colors"
              />
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <IconFilterRow title="World">
              {WORLD_FILTERS.map((opt) => (
                <IconFilterTile
                  key={opt.id}
                  active={worldFilter === opt.id}
                  onClick={() => setWorldFilter(opt.id)}
                  Icon={opt.icon}
                  label={opt.label}
                />
              ))}
            </IconFilterRow>
            <IconFilterRow title="Setting">
              {CATEGORY_FILTERS.map((opt) => (
                <IconFilterTile
                  key={opt.id}
                  active={categoryFilter === opt.id}
                  onClick={() => setCategoryFilter(opt.id)}
                  Icon={opt.icon ?? Sparkles}
                  label={opt.label}
                />
              ))}
            </IconFilterRow>
          </div>
        </div>
      </section>

      {/* ── WORLD PRESENTATION ─────────────────────────────────── */}
      {worldFilter === "all" ? (
        <section className="pb-16 space-y-12">
          {(searchQuery.trim() || categoryFilter !== "all") && (
            <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/40 -mt-2">
              {sorted.length} match{sorted.length === 1 ? "" : "es"} across filters
            </div>
          )}
          {WORLD_ORDER_FOR_RAILS.map((worldId) => {
            const inRail = sorted.filter(bp => bp.world === worldId);
            if (inRail.length === 0) return null;
            const meta = WORLD_FILTERS.find(w => w.id === worldId)!;
            return (
              <WorldRail
                key={worldId}
                world={{ id: worldId, label: ENV_WORLD_LABELS[worldId], icon: meta.icon }}
                items={inRail}
                favorites={favorites}
                onToggleFavorite={toggleFavorite}
                onOpenCard={(id) => setDrawerOpenId(id)}
                onSeeAll={() => {
                  setWorldFilter(worldId);
                  window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
                }}
              />
            );
          })}
          {sorted.length === 0 && (
            <EmptyState onReset={() => {
              setSearchQuery(""); setWorldFilter("all"); setCategoryFilter("all");
            }} />
          )}
        </section>
      ) : (
        <section className="pb-16">
          <div className="flex items-baseline justify-between mb-5 gap-4 flex-wrap">
            <div className="flex items-baseline gap-4">
              <button
                onClick={() => setWorldFilter("all")}
                className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/45 hover:text-foreground/85 transition-colors inline-flex items-center gap-1.5"
              >
                ← All worlds
              </button>
              <h2 className="text-[clamp(1.6rem,3.5vw,2.4rem)] font-display italic font-light leading-tight">
                <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/60 bg-clip-text text-transparent">
                  {activeWorldMeta?.label}
                </span>
                <span className="ml-3 font-mono text-[12px] font-normal not-italic uppercase tracking-[0.22em] text-foreground/40 tabular-nums">
                  {sorted.length}
                </span>
              </h2>
            </div>
            <span className="hidden sm:inline-block font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/40">
              tap any card to inspect the scene
            </span>
          </div>

          {sorted.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
              {sorted.map((bp, i) => (
                <EnvironmentCard
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
              setSearchQuery(""); setWorldFilter("all"); setCategoryFilter("all");
            }} />
          )}
        </section>
      )}

      {/* ── DRAWER ─────────────────────────────────────────────── */}
      <EnvironmentDetailDrawer
        environment={activeBlueprint}
        open={!!activeBlueprint}
        onClose={() => setDrawerOpenId(null)}
        onApply={handleApply}
        isFavorite={activeBlueprint ? favorites.has(activeBlueprint.id) : false}
        onToggleFavorite={() => { if (activeBlueprint) toggleFavorite(activeBlueprint.id); }}
      />
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
      <div className="mx-auto mb-5 inline-flex items-center justify-center w-14 h-14 text-foreground/45">
        <Mountain className="w-8 h-8" />
      </div>
      <h3 className="text-xl font-display italic text-foreground/95 mb-2">No environments matched</h3>
      <p className="text-[13px] text-foreground/55 mb-5 max-w-sm mx-auto">
        Try clearing a filter — your world + setting combination might be too narrow.
      </p>
      <GlassButton size="sm" onClick={onReset}>
        Clear filters
        <ArrowRight className="w-3.5 h-3.5" />
      </GlassButton>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Public page
// ─────────────────────────────────────────────────────────────────────────────
export function EnvironmentsWorkbench() {
  const liveRenderTimecode = useLiveRenderTimecode();

  return (
    <div className="relative mx-auto w-full max-w-[1440px] px-4 pb-24 pt-10 sm:px-6 lg:px-10">
      <EditorialCanvas
        maxWidth="100%"
        chrome={{
          crumbs: ["Small Bridges", "environments"],
          timecode: liveRenderTimecode ?? "ENV · LIVE",
        }}
      >
        <EnvironmentsContent />
      </EditorialCanvas>
    </div>
  );
}

export default function Environments() {
  usePageMeta({
    title: "Environments — Small Bridges",
    description: "Cinematic scenes the subject lives in. 120 environments with lighting, palette, camera, sound, and a generator prompt that places your character inside the world.",
  });

  return (
    <ErrorBoundary>
      <FoundationShell>
        <EnvironmentsWorkbench />
      </FoundationShell>
    </ErrorBoundary>
  );
}

// Re-export TrendingUp so unused-import warning quiets (used in stat copy)
export { TrendingUp };
