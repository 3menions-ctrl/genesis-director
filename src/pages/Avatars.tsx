/**
 * Avatars — /avatars
 *
 * The talent vault. Comprehensive browse over every avatar template in
 * the Supabase library. Foundation-shelled (FoundationShell +
 * EditorialCanvas + SpineBackdrop), search-first, filterable across
 * Type · Gender · Category, with a slide-in detail drawer that opens
 * the full identity bible and a "Cast in Studio" CTA that hands off to
 * the workshop with the avatar pre-selected.
 *
 * Avatars is the BROWSE surface. Scene generation, voice scripting,
 * and shooting happen in the Studio — this page just curates and
 * casts. Cast() writes the avatar id into sessionStorage and navigates
 * to /studio, where the existing Studio composer picks it up.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Search,
  Filter,
  Sparkles,
  Crown,
  Play,
  Pause,
  X,
  ArrowRight,
  TrendingUp,
  Clock,
  ArrowUpAZ,
  Loader2,
  User as UserIcon,
  Check,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { FoundationShell } from "@/components/foundation/FoundationShell";
import {
  EditorialCanvas,
  EditorialEyebrow,
  EditorialHeadline,
} from "@/components/foundation/EditorialCanvas";
import { useLiveRenderTimecode } from "@/hooks/useLiveRenderTimecode";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAvatarTemplatesQuery } from "@/hooks/useAvatarTemplatesQuery";
import { useCast } from "@/hooks/useCast";
import { OptimizedAvatarImage } from "@/components/avatars/OptimizedAvatarImage";
import { useSafeNavigation } from "@/lib/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { CastMember } from "@/lib/cast-store";
import {
  AvatarTemplate,
  AVATAR_CATEGORIES,
  AvatarCategory,
} from "@/types/avatar-templates";
import { EASE_PREMIUM, TYPE_META } from "@/lib/design-system";

// ─────────────────────────────────────────────────────────────────────────────
// Filter model
// ─────────────────────────────────────────────────────────────────────────────
type TypeFilter = "all" | "realistic" | "animated" | "premium";
type GenderFilter = "all" | "female" | "male" | "neutral";
type SortKey = "popular" | "newest" | "name";

const TYPE_TABS: { id: TypeFilter; label: string; Icon: typeof Sparkles }[] = [
  { id: "all",       label: "All",       Icon: Sparkles },
  { id: "realistic", label: "Realistic", Icon: UserIcon },
  { id: "animated",  label: "Animated",  Icon: Sparkles },
  { id: "premium",   label: "Premium",   Icon: Crown },
];

const GENDER_FILTERS: { id: GenderFilter; label: string }[] = [
  { id: "all",     label: "Any" },
  { id: "female",  label: "Female" },
  { id: "male",    label: "Male" },
  { id: "neutral", label: "Neutral" },
];

const SORT_OPTIONS: { id: SortKey; label: string; Icon: typeof TrendingUp }[] = [
  { id: "popular", label: "Popular", Icon: TrendingUp },
  { id: "newest",  label: "Newest",  Icon: Clock },
  { id: "name",    label: "A → Z",   Icon: ArrowUpAZ },
];

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
function AvatarsContent() {
  const liveRenderTimecode = useLiveRenderTimecode();
  const reducedMotion = useReducedMotion();
  const { navigate } = useSafeNavigation();
  const { user } = useAuth();

  // useAvatarTemplatesQuery returns isLoading (not loading) + error as string.
  // Pass includePlaceholders so the browse vault shows every active row —
  // OptimizedAvatarImage handles missing image URLs with a shimmer fallback,
  // so rows mid-processing still surface their name + metadata.
  const { templates, isLoading, error } = useAvatarTemplatesQuery(
    undefined,
    { includePlaceholders: true },
  );

  // ── Filter state ──────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("all");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("popular");
  const [selected, setSelected] = useState<AvatarTemplate | null>(null);

  // ── Filter + sort pipeline ────────────────────────────────────────────
  const filtered = useMemo(() => {
    const safe = Array.isArray(templates) ? templates : [];
    const q = search.trim().toLowerCase();
    const cat: AvatarCategory | undefined = AVATAR_CATEGORIES.find(
      (c) => c.id === categoryId,
    );

    const list = safe.filter((a) => {
      if (typeFilter === "premium" && !a.is_premium) return false;
      if (typeFilter === "realistic" && a.avatar_type !== "realistic") return false;
      if (typeFilter === "animated" && a.avatar_type !== "animated") return false;

      if (genderFilter !== "all" && a.gender !== genderFilter) return false;

      if (cat && cat.tags.length > 0) {
        const tags = a.tags ?? [];
        const hit = cat.tags.some((t) =>
          tags.map((x) => x.toLowerCase()).includes(t.toLowerCase()),
        );
        if (!hit) return false;
      }

      if (q) {
        const hay = `${a.name} ${a.personality ?? ""} ${a.style ?? ""} ${(a.tags ?? []).join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (sort === "popular") {
      list.sort((a, b) => (b.use_count ?? 0) - (a.use_count ?? 0));
    } else if (sort === "newest") {
      list.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    } else {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  }, [templates, search, typeFilter, genderFilter, categoryId, sort]);

  const counts = useMemo(() => {
    const safe = Array.isArray(templates) ? templates : [];
    return {
      total: safe.length,
      realistic: safe.filter((a) => a.avatar_type === "realistic").length,
      animated: safe.filter((a) => a.avatar_type === "animated").length,
      premium: safe.filter((a) => a.is_premium).length,
    };
  }, [templates]);

  // Convert an AvatarTemplate row into the lighter CastMember shape that
  // travels through localStorage and the Studio CastPanel. Re-fetched
  // by id when the Studio needs the full identity bible.
  const toCastMember = (a: AvatarTemplate): CastMember => ({
    id: a.id,
    name: a.name,
    imageUrl:
      a.front_image_url ?? a.thumbnail_url ?? a.face_image_url,
    voiceId: a.voice_id,
    voiceName: a.voice_name,
    style: a.style,
    avatarType: a.avatar_type,
  });

  const toggleCast = (avatar: AvatarTemplate) => {
    if (isInCast(avatar.id)) {
      removeFromCast(avatar.id);
    } else {
      addToCast(toCastMember(avatar));
    }
  };

  // Click "Cast in Studio" from a card / popup: add the avatar to the
  // cast if it isn't already, then open Studio. Multi-character casting
  // happens via the Cast Bar's "Open in Studio" CTA which preserves the
  // full roster.
  const handleCast = (avatar: AvatarTemplate) => {
    if (!user) {
      navigate("/auth");
      return;
    }
    if (!isInCast(avatar.id)) {
      addToCast(toCastMember(avatar));
    }
    navigate("/studio");
  };

  const handleOpenStudioWithCast = () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    if (cast.length === 0) return;
    navigate("/studio");
  };

  // ── Chrome timecode ───────────────────────────────────────────────────
  const chromeTimecode =
    liveRenderTimecode ?? `${counts.total} TALENTS · LIVE`;

  return (
    <FoundationShell>
      <div className="relative mx-auto w-full max-w-[1440px] px-4 pb-24 pt-10 sm:px-6 lg:px-10">
        <EditorialCanvas
          maxWidth="100%"
          chrome={{
            crumbs: ["Small Bridges", "avatars"],
            timecode: chromeTimecode,
          }}
        >
          {/* ── Header row ──────────────────────────────────────── */}
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0 max-w-2xl">
              <EditorialEyebrow>Cast</EditorialEyebrow>
              <EditorialHeadline className="mt-5">
                Cast a character.
              </EditorialHeadline>
              <p className="mt-5 max-w-xl text-[14px] font-light leading-relaxed text-muted-foreground/70">
                Browse every cinematic AI talent in the vault. Audition the
                voice, read the identity bible, then send them to the Studio.
              </p>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.32em] font-mono text-muted-foreground/60">
                <span className="tabular-nums text-foreground/85">
                  {counts.total}
                </span>
                <span>talents</span>
                <span className="text-muted-foreground/30">·</span>
                <span className="tabular-nums">{counts.realistic}</span>
                <span>realistic</span>
                <span className="text-muted-foreground/30">·</span>
                <span className="tabular-nums">{counts.animated}</span>
                <span>animated</span>
                {counts.premium > 0 && (
                  <>
                    <span className="text-muted-foreground/30">·</span>
                    <span className="tabular-nums text-accent">
                      {counts.premium}
                    </span>
                    <span className="text-accent">premium</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ── Search ─────────────────────────────────────────── */}
          <div className="mt-10">
            <SearchBar value={search} onChange={setSearch} />
          </div>

          {/* ── Type tabs ──────────────────────────────────────── */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <TypeTabs value={typeFilter} onChange={setTypeFilter} counts={counts} />
            <SortPicker value={sort} onChange={setSort} />
          </div>

          {/* ── Category chips ─────────────────────────────────── */}
          <div className="mt-5">
            <CategoryChips value={categoryId} onChange={setCategoryId} />
          </div>

          {/* ── Gender row ────────────────────────────────────── */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className={cn(TYPE_META, "text-muted-foreground/60 mr-1")}>
              Gender
            </span>
            {GENDER_FILTERS.map(({ id, label }) => {
              const active = genderFilter === id;
              return (
                <button
                  key={id}
                  onClick={() => setGenderFilter(id)}
                  className={cn(
                    "h-7 px-3 rounded-full text-[12px] tracking-tight transition-colors",
                    active
                      ? "border border-accent/40 bg-[hsl(var(--accent)/0.08)] text-foreground"
                      : "border border-border/30 bg-[hsl(var(--foreground)/0.02)] text-muted-foreground/70 hover:border-accent/30 hover:text-foreground/90",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* ── Hairline + result count ───────────────────────── */}
          <div className="mt-8 flex items-center gap-3">
            <span className={cn(TYPE_META, "text-muted-foreground/60")}>
              {filtered.length} {filtered.length === 1 ? "result" : "results"}
            </span>
            <div className="h-px flex-1 bg-gradient-to-r from-border/60 via-border/30 to-transparent" />
            {(search ||
              typeFilter !== "all" ||
              genderFilter !== "all" ||
              categoryId !== "all") && (
              <button
                onClick={() => {
                  setSearch("");
                  setTypeFilter("all");
                  setGenderFilter("all");
                  setCategoryId("all");
                }}
                className={cn(
                  TYPE_META,
                  "text-muted-foreground/55 hover:text-foreground transition-colors",
                )}
              >
                Reset
              </button>
            )}
          </div>

          {/* ── Grid ──────────────────────────────────────────── */}
          <div className="mt-8">
            {isLoading ? (
              <GridSkeleton />
            ) : error ? (
              <ErrorState onRetry={() => window.location.reload()} />
            ) : filtered.length === 0 ? (
              <EmptyState
                onReset={() => {
                  setSearch("");
                  setTypeFilter("all");
                  setGenderFilter("all");
                  setCategoryId("all");
                }}
              />
            ) : (
              <GlassGallery
                items={filtered}
                onOpen={setSelected}
                onCast={handleCast}
                onToggle={toggleCast}
                isInCast={isInCast}
                reducedMotion={reducedMotion ?? false}
              />
            )}
          </div>
        </EditorialCanvas>
      </div>

      {/* Centered detail popup */}
      <AnimatePresence>
        {selected && (
          <DetailPopup
            avatar={selected}
            inCast={isInCast(selected.id)}
            onClose={() => setSelected(null)}
            onToggleCast={() => toggleCast(selected)}
            onCast={() => {
              handleCast(selected);
              setSelected(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Cast Bar — fixed bottom roster of selected avatars */}
      <AnimatePresence>
        {cast.length > 0 && (
          <CastBar
            cast={cast}
            onRemove={removeFromCast}
            onClear={clearCast}
            onOpen={handleOpenStudioWithCast}
          />
        )}
      </AnimatePresence>
    </FoundationShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SearchBar — Foundation pill input
// ─────────────────────────────────────────────────────────────────────────────
function SearchBar({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative max-w-2xl">
      <Search
        className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/55"
        strokeWidth={1.5}
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search by name, vibe, archetype, or tag…"
        className="w-full h-12 rounded-full bg-[hsl(var(--foreground)/0.02)] border border-border/30 pl-11 pr-11 text-[14px] text-foreground placeholder:text-muted-foreground/45 outline-none focus:border-accent/40 transition-colors backdrop-blur-xl"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TypeTabs — Foundation segmented control
// ─────────────────────────────────────────────────────────────────────────────
function TypeTabs({
  value,
  onChange,
  counts,
}: {
  value: TypeFilter;
  onChange: (v: TypeFilter) => void;
  counts: { total: number; realistic: number; animated: number; premium: number };
}) {
  return (
    <div
      role="tablist"
      className="inline-flex items-center gap-1 rounded-full p-1 border border-border/30 bg-[hsl(var(--foreground)/0.02)] backdrop-blur-xl"
    >
      {TYPE_TABS.map((t) => {
        const active = value === t.id;
        const Icon = t.Icon;
        const count =
          t.id === "all"
            ? counts.total
            : t.id === "realistic"
              ? counts.realistic
              : t.id === "animated"
                ? counts.animated
                : counts.premium;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cn(
              "relative inline-flex items-center gap-2 px-4 h-9 rounded-full text-[12.5px] tracking-tight transition-colors",
              active
                ? "text-foreground"
                : "text-muted-foreground/70 hover:text-foreground/90",
            )}
          >
            {active && (
              <motion.span
                layoutId="avatar-type-active"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
                className="absolute inset-0 -z-10 rounded-full bg-[hsl(var(--accent)/0.10)] ring-1 ring-inset ring-[hsl(var(--accent)/0.30)]"
              />
            )}
            <Icon
              className={cn(
                "h-3.5 w-3.5 shrink-0",
                active ? "text-accent" : "opacity-60",
              )}
              strokeWidth={1.5}
            />
            <span className="font-light">{t.label}</span>
            <span
              className={cn(
                "font-mono text-[10px] tabular-nums",
                active ? "text-accent/80" : "text-muted-foreground/40",
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SortPicker({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (v: SortKey) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn(TYPE_META, "text-muted-foreground/55 mr-1")}>
        Sort
      </span>
      {SORT_OPTIONS.map(({ id, label, Icon }) => {
        const active = value === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={cn(
              "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] tracking-tight transition-colors",
              active
                ? "border border-accent/40 bg-[hsl(var(--accent)/0.08)] text-foreground"
                : "border border-border/30 bg-[hsl(var(--foreground)/0.02)] text-muted-foreground/70 hover:text-foreground/90",
            )}
          >
            <Icon className="h-3 w-3" strokeWidth={1.5} />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CategoryChips — horizontally scrollable chip rail with emoji icons
// ─────────────────────────────────────────────────────────────────────────────
function CategoryChips({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
      {AVATAR_CATEGORIES.map((c) => {
        const active = value === c.id;
        return (
          <button
            key={c.id}
            onClick={() => onChange(c.id)}
            className={cn(
              "shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] tracking-tight transition-colors",
              active
                ? "border border-accent/40 bg-[hsl(var(--accent)/0.08)] text-foreground"
                : "border border-border/30 bg-[hsl(var(--foreground)/0.02)] text-muted-foreground/70 hover:border-accent/30 hover:text-foreground/90",
            )}
          >
            <span>{c.icon}</span>
            <span>{c.name}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GlassGallery — horizontal museum-style picture-frame gallery.
//
// Cards live in a horizontally scrollable row, each one a thick glass
// "picture frame" with the portrait inside. Names + style captions
// stay invisible by default — they fade in only while the user is
// actively scrolling (and on hover of an individual frame). The user
// can wheel-scroll, swipe, or click a card to open the detail drawer.
// ─────────────────────────────────────────────────────────────────────────────
function GlassGallery({
  items,
  onOpen,
  onCast,
  onToggle,
  isInCast,
  reducedMotion,
}: {
  items: AvatarTemplate[];
  onOpen: (a: AvatarTemplate) => void;
  onCast: (a: AvatarTemplate) => void;
  onToggle: (a: AvatarTemplate) => void;
  isInCast: (id: string) => boolean;
  reducedMotion: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reveal captions while the user is actively scrolling; fade them
  // back out 900ms after the last scroll event. Reduced-motion users
  // get permanent captions to avoid a hidden-text trap.
  const handleScroll = () => {
    if (reducedMotion) return;
    if (!isScrolling) setIsScrolling(true);
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => setIsScrolling(false), 900);
  };

  useEffect(() => {
    return () => {
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
    };
  }, []);

  // Convert vertical wheel into horizontal scroll so a trackpad/mouse
  // wheel feels natural in this layout. Shift+wheel still pages
  // horizontally too. Touch swipe just works.
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY;
    }
  };

  return (
    <div className="relative">
      {/* Edge fades — let the gallery dissolve into the room atmosphere */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[hsl(220_30%_4%)] via-[hsl(220_30%_4%/0.6)] to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[hsl(220_30%_4%)] via-[hsl(220_30%_4%/0.6)] to-transparent"
      />

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onWheel={handleWheel}
        className={cn(
          "flex gap-6 overflow-x-auto overflow-y-hidden",
          "snap-x snap-mandatory scroll-smooth scrollbar-hide",
          "px-10 py-6 -mx-1",
        )}
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {items.map((a, i) => (
          <GlassFrame
            key={a.id}
            avatar={a}
            index={i}
            inCast={isInCast(a.id)}
            onOpen={() => onOpen(a)}
            onCast={() => onCast(a)}
            onToggleCast={() => onToggle(a)}
            reducedMotion={reducedMotion}
            captionVisible={isScrolling || reducedMotion}
          />
        ))}
      </div>

      {/* Scroll hint — gentle keyboard prompt at the bottom */}
      <div
        className={cn(
          "mt-2 flex items-center justify-center gap-2 text-[10px] font-mono uppercase tracking-[0.32em] text-muted-foreground/35 transition-opacity",
          isScrolling ? "opacity-0" : "opacity-100",
        )}
      >
        <span>Scroll the gallery to read the names</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GlassFrame — a single portrait in a thick glass "picture frame."
// ─────────────────────────────────────────────────────────────────────────────
function GlassFrame({
  avatar,
  index,
  inCast,
  onOpen,
  onCast,
  onToggleCast,
  reducedMotion,
  captionVisible,
}: {
  avatar: AvatarTemplate;
  index: number;
  inCast: boolean;
  onOpen: () => void;
  onCast: () => void;
  onToggleCast: () => void;
  reducedMotion: boolean;
  captionVisible: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const [hovered, setHovered] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasAudio = !!avatar.sample_audio_url;

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasAudio) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(avatar.sample_audio_url!);
      audioRef.current.addEventListener("ended", () => setPlaying(false));
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      void audioRef.current.play().catch(() => setPlaying(false));
      setPlaying(true);
    }
  };

  const imageUrl =
    avatar.front_image_url ?? avatar.thumbnail_url ?? avatar.face_image_url;
  const showCaption = captionVisible || hovered;

  return (
    <motion.button
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: Math.min(index * 0.02, 0.4),
        ease: EASE_PREMIUM,
      }}
      whileHover={reducedMotion ? undefined : { y: -6, scale: 1.015 }}
      className={cn(
        "group relative snap-center shrink-0",
        "w-[240px] sm:w-[280px] lg:w-[300px]",
        "focus:outline-none",
      )}
      aria-label={`${avatar.name}, ${avatar.style ?? "avatar"}`}
    >
      {/* Outer accent glow — appears on hover, sells the cinematic spotlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-3 rounded-[28px] opacity-0 group-hover:opacity-100 transition-opacity duration-700"
        style={{
          background:
            "radial-gradient(60% 70% at 50% 50%, hsl(var(--accent) / 0.22), transparent 70%)",
          filter: "blur(36px)",
        }}
      />

      {/* The glass frame itself — multi-layer, museum-grade */}
      <div
        className={cn(
          "relative overflow-hidden rounded-[22px]",
          "border border-white/[0.09]",
          "bg-gradient-to-br from-white/[0.06] via-white/[0.02] to-white/[0.01]",
          "backdrop-blur-2xl",
          "shadow-[0_30px_80px_-24px_hsl(220_40%_2%/0.85),0_0_0_1px_hsl(var(--accent)/0.06),inset_0_1px_0_hsl(0_0%_100%/0.10)]",
          "transition-shadow duration-500",
          "group-hover:shadow-[0_40px_120px_-24px_hsl(220_40%_2%/0.92),0_0_0_1px_hsl(var(--accent)/0.18),inset_0_1px_0_hsl(0_0%_100%/0.14),0_0_60px_-12px_hsl(var(--accent)/0.45)]",
        )}
      >
        {/* Picture-frame mat — a thin glass border around the portrait */}
        <div className="p-[10px]">
          <div className="relative aspect-[3/4] overflow-hidden rounded-[14px] ring-1 ring-inset ring-white/[0.06]">
            <OptimizedAvatarImage
              src={imageUrl}
              alt={avatar.name}
              fallbackText={avatar.name}
              aspectRatio="portrait"
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.05]"
            />

            {/* Diagonal glass reflection — moves the eye top-left to bottom-right */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-50 mix-blend-overlay"
              style={{
                background:
                  "linear-gradient(135deg, hsl(0 0% 100% / 0.18) 0%, transparent 35%, transparent 65%, hsl(0 0% 100% / 0.06) 100%)",
              }}
            />

            {/* Top hairline highlight — like a glass edge catching light */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
            />

            {/* Soft bottom vignette so any caption reads clean */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[hsl(220_30%_4%/0.92)] via-[hsl(220_30%_4%/0.35)] to-transparent"
            />

            {/* Top-right small badges — type + premium */}
            <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2">
              {avatar.is_premium && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(45_95%_55%/0.15)] backdrop-blur-md ring-1 ring-inset ring-[hsl(45_95%_55%/0.4)] px-2 py-0.5 text-[9px] font-mono uppercase tracking-[0.22em] text-[hsl(45_95%_75%)]">
                  <Crown className="h-2.5 w-2.5" strokeWidth={1.5} />
                  Premium
                </span>
              )}
              <span
                className={cn(
                  "ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-mono uppercase tracking-[0.22em] backdrop-blur-md ring-1 ring-inset",
                  avatar.avatar_type === "realistic"
                    ? "bg-[hsl(var(--accent)/0.10)] ring-[hsl(var(--accent)/0.30)] text-accent"
                    : "bg-[hsl(280_55%_65%/0.10)] ring-[hsl(280_55%_65%/0.30)] text-[hsl(280_55%_85%)]",
                )}
              >
                {avatar.avatar_type === "realistic" ? "Real" : "Animated"}
              </span>
            </div>

            {/* Voice play button — bottom-left, only when audio exists */}
            {hasAudio && (
              <button
                onClick={togglePlay}
                aria-label={playing ? "Pause voice sample" : "Play voice sample"}
                className={cn(
                  "absolute bottom-3 left-3 inline-flex items-center justify-center h-9 w-9 rounded-full z-10",
                  "bg-black/60 backdrop-blur-md ring-1 ring-inset ring-white/20",
                  "opacity-0 group-hover:opacity-100 transition-opacity",
                  playing && "opacity-100",
                )}
              >
                {playing ? (
                  <Pause className="h-3.5 w-3.5 text-white fill-current" />
                ) : (
                  <Play className="h-3.5 w-3.5 text-white fill-current" />
                )}
              </button>
            )}

            {/* Add/Remove from cast — bottom-right corner, always visible when in cast */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleCast();
              }}
              aria-label={inCast ? "Remove from cast" : "Add to cast"}
              className={cn(
                "absolute bottom-3 right-3 inline-flex items-center justify-center h-9 w-9 rounded-full z-10 transition-all",
                inCast
                  ? "bg-[hsl(var(--accent)/0.92)] ring-1 ring-inset ring-accent text-foreground opacity-100"
                  : "bg-black/60 backdrop-blur-md ring-1 ring-inset ring-white/20 text-white opacity-0 group-hover:opacity-100",
              )}
            >
              {inCast ? (
                <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
              ) : (
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              )}
            </button>

            {/* In-cast accent ring around the whole picture */}
            {inCast && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-[hsl(var(--accent)/0.6)]"
                style={{
                  boxShadow:
                    "inset 0 0 24px hsl(var(--accent) / 0.25), 0 0 0 1px hsl(var(--accent) / 0.4)",
                }}
              />
            )}

            {/* Caption — fades in only while scrolling or on hover */}
            <AnimatePresence>
              {showCaption && (
                <motion.div
                  key="caption"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.35, ease: EASE_PREMIUM }}
                  className="absolute inset-x-0 bottom-0 p-4 pointer-events-none"
                >
                  <h3
                    className="font-display italic text-[19px] font-light leading-tight tracking-tight text-white"
                    style={{
                      fontFamily: "'Fraunces', serif",
                      textShadow: "0 2px 12px hsl(220 40% 2% / 0.85)",
                    }}
                  >
                    {avatar.name}
                  </h3>
                  <div className="mt-1.5 flex items-center gap-2">
                    {avatar.style && (
                      <span className="font-mono text-[9.5px] uppercase tracking-[0.28em] text-white/70">
                        {avatar.style}
                      </span>
                    )}
                    {avatar.use_count != null && avatar.use_count > 0 && (
                      <>
                        <span className="text-white/30">·</span>
                        <span className="font-mono text-[9.5px] tabular-nums text-white/55">
                          {avatar.use_count.toLocaleString()} cast
                        </span>
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Cast CTA — subtle ribbon at the very bottom, visible only on hover */}
        <AnimatePresence>
          {hovered && (
            <motion.div
              key="cast-cta"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-x-[10px] bottom-[10px] flex justify-center"
            >
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onCast();
                }}
                className={cn(
                  "pointer-events-auto inline-flex items-center gap-1.5 h-8 px-3 rounded-full",
                  "bg-[hsl(220_30%_4%/0.7)] backdrop-blur-xl ring-1 ring-inset ring-accent/30",
                  "text-[10.5px] font-mono uppercase tracking-[0.22em] text-accent",
                  "hover:text-foreground hover:ring-accent/60 transition-colors cursor-pointer",
                )}
              >
                Cast in Studio
                <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DetailPopup — centered glass modal with the full identity bible.
//
// Two-column on >= md (head-to-toe portrait left, info right), single
// column on mobile (portrait top, info below). Scroll only inside the
// modal so the page underneath stays locked. Closes on backdrop click,
// Esc key, or the close pill in the top-right.
// ─────────────────────────────────────────────────────────────────────────────
function DetailPopup({
  avatar,
  inCast,
  onClose,
  onCast,
  onToggleCast,
}: {
  avatar: AvatarTemplate;
  inCast: boolean;
  onClose: () => void;
  onCast: () => void;
  onToggleCast: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasAudio = !!avatar.sample_audio_url;

  // The popup prefers the full-body head-to-toe view when available.
  // front_image_url is the canonical full-body shot from the
  // generate-avatar-image pipeline; falls back to thumbnail / face
  // crop while rows are still being processed.
  const imageUrl =
    avatar.front_image_url ?? avatar.thumbnail_url ?? avatar.face_image_url;

  const togglePlay = () => {
    if (!hasAudio) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(avatar.sample_audio_url!);
      audioRef.current.addEventListener("ended", () => setPlaying(false));
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      void audioRef.current.play().catch(() => setPlaying(false));
      setPlaying(true);
    }
  };

  // Esc closes the popup; lock body scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 lg:p-10"
      role="dialog"
      aria-modal="true"
      aria-label={`${avatar.name} — full profile`}
    >
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22 }}
        onClick={onClose}
        className="absolute inset-0 bg-[hsl(220_30%_2%/0.78)] backdrop-blur-md"
      />

      {/* Popup card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.35, ease: EASE_PREMIUM }}
        className={cn(
          "relative w-full max-w-[1100px] max-h-[92dvh]",
          "overflow-hidden rounded-[28px]",
          "border border-white/[0.09]",
          "bg-gradient-to-br from-[hsl(220_30%_6%/0.95)] via-[hsl(220_30%_4%/0.96)] to-[hsl(220_30%_3%/0.98)]",
          "backdrop-blur-2xl",
          "shadow-[0_80px_200px_-50px_hsl(0_0%_0%/0.85),0_30px_80px_-30px_hsl(var(--accent)/0.22),inset_0_1px_0_hsl(0_0%_100%/0.06)]",
        )}
      >
        {/* Foundation corner brackets — picture-frame registration marks */}
        <div aria-hidden className="pointer-events-none absolute left-4 top-4 h-3 w-3 border-l border-t border-accent/40 z-30" />
        <div aria-hidden className="pointer-events-none absolute right-4 top-4 h-3 w-3 border-r border-t border-accent/40 z-30" />
        <div aria-hidden className="pointer-events-none absolute left-4 bottom-4 h-3 w-3 border-l border-b border-accent/40 z-30" />
        <div aria-hidden className="pointer-events-none absolute right-4 bottom-4 h-3 w-3 border-r border-b border-accent/40 z-30" />

        {/* Close — top right, above everything */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 z-40 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-[hsl(220_30%_4%/0.55)] backdrop-blur-xl text-foreground/80 hover:text-foreground hover:border-accent/50 transition-colors"
        >
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>

        {/* Body — grid on desktop, stack on mobile */}
        <div className="grid h-[92dvh] max-h-[92dvh] grid-rows-[minmax(0,1fr)_auto] md:h-auto md:max-h-[92dvh] md:grid-rows-1 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          {/* Portrait pane (head-to-toe) */}
          <div className="relative overflow-hidden bg-[hsl(220_40%_4%)] md:border-r md:border-white/[0.05]">
            <div className="relative h-full w-full">
              <OptimizedAvatarImage
                src={imageUrl}
                alt={avatar.name}
                fallbackText={avatar.name}
                aspectRatio="portrait"
                className="h-full w-full object-cover"
              />

              {/* Top hairline catch-light */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
              />

              {/* Soft accent halo behind the portrait */}
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-1/3 opacity-50"
                style={{
                  background:
                    "radial-gradient(50% 50% at 50% 40%, hsl(var(--accent) / 0.18) 0%, transparent 70%)",
                  filter: "blur(40px)",
                }}
              />

              {/* Diagonal glass reflection */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-40 mix-blend-overlay"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(0 0% 100% / 0.12) 0%, transparent 30%, transparent 70%, hsl(0 0% 100% / 0.04) 100%)",
                }}
              />

              {/* Bottom-anchored badges */}
              <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center gap-2 z-10">
                {avatar.is_premium && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(45_95%_55%/0.15)] backdrop-blur-md ring-1 ring-inset ring-[hsl(45_95%_55%/0.4)] px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.22em] text-[hsl(45_95%_75%)]">
                    <Crown className="h-3 w-3" strokeWidth={1.5} />
                    Premium
                  </span>
                )}
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.22em] backdrop-blur-md ring-1 ring-inset",
                    avatar.avatar_type === "realistic"
                      ? "bg-[hsl(var(--accent)/0.10)] ring-[hsl(var(--accent)/0.30)] text-accent"
                      : "bg-[hsl(280_55%_65%/0.10)] ring-[hsl(280_55%_65%/0.30)] text-[hsl(280_55%_85%)]",
                  )}
                >
                  {avatar.avatar_type === "realistic" ? "Realistic" : "Animated"}
                </span>
              </div>
            </div>
          </div>

          {/* Info pane */}
          <div className="flex min-h-0 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-7 sm:px-8 sm:py-8 lg:px-10 lg:py-10 space-y-7">
              {/* Identity */}
              <div>
                <span className={cn(TYPE_META, "text-muted-foreground/60")}>
                  ◆ Identity
                </span>
                <h2
                  className="mt-3 font-display italic font-light text-foreground tracking-tight leading-[1.05] text-[clamp(1.6rem,3.5vw,2.4rem)]"
                  style={{ fontFamily: "'Fraunces', serif" }}
                >
                  {avatar.name}
                </h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {avatar.style && <Pill label={avatar.style} />}
                  {avatar.age_range && <Pill label={avatar.age_range} />}
                  {avatar.gender && <Pill label={avatar.gender} />}
                  {avatar.ethnicity && <Pill label={avatar.ethnicity} />}
                </div>
              </div>

              {/* Personality */}
              {avatar.personality && (
                <Section eyebrow="Personality">
                  <p className="text-[13.5px] font-light leading-relaxed text-foreground/85">
                    {avatar.personality}
                  </p>
                </Section>
              )}

              {/* Description */}
              {avatar.description && (
                <Section eyebrow="Description">
                  <p className="text-[13px] font-light leading-relaxed text-muted-foreground/80">
                    {avatar.description}
                  </p>
                </Section>
              )}

              {/* Voice */}
              <Section eyebrow="Voice">
                <div className="flex items-center gap-3 rounded-2xl border border-border/30 bg-[hsl(var(--foreground)/0.02)] p-3.5">
                  <button
                    onClick={togglePlay}
                    disabled={!hasAudio}
                    aria-label={playing ? "Pause" : "Play voice sample"}
                    className={cn(
                      "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                      "border border-accent/40 bg-[hsl(var(--accent)/0.10)] text-accent",
                      "hover:bg-[hsl(var(--accent)/0.15)] transition-colors",
                      "disabled:opacity-40 disabled:cursor-not-allowed",
                    )}
                  >
                    {playing ? (
                      <Pause className="h-4 w-4 fill-current" />
                    ) : (
                      <Play className="h-4 w-4 fill-current" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] text-foreground/90 truncate">
                      {avatar.voice_name ?? "Default voice"}
                    </div>
                    {avatar.voice_description && (
                      <div className="text-[11px] text-muted-foreground/60 line-clamp-2 mt-0.5">
                        {avatar.voice_description}
                      </div>
                    )}
                    <div className={cn(TYPE_META, "text-muted-foreground/40 mt-1")}>
                      {avatar.voice_provider}
                    </div>
                  </div>
                </div>
              </Section>

              {/* Tags */}
              {avatar.tags && avatar.tags.length > 0 && (
                <Section eyebrow="Tags">
                  <div className="flex flex-wrap gap-1.5">
                    {avatar.tags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center rounded-full border border-border/30 bg-[hsl(var(--foreground)/0.02)] px-2.5 py-1 text-[11px] tracking-tight text-muted-foreground/75"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </Section>
              )}

              {/* Stats */}
              {avatar.use_count != null && avatar.use_count > 0 && (
                <Section eyebrow="Filmography">
                  <div className="rounded-2xl border border-border/30 bg-[hsl(var(--foreground)/0.02)] p-4">
                    <div className="flex items-baseline gap-2">
                      <span className="font-display text-3xl font-light text-foreground tabular-nums">
                        {avatar.use_count.toLocaleString()}
                      </span>
                      <span className={cn(TYPE_META, "text-muted-foreground/60")}>
                        scenes directed
                      </span>
                    </div>
                  </div>
                </Section>
              )}
            </div>

            {/* Footer — Add-to-cast toggle + Cast-in-Studio primary CTA */}
            <div className="shrink-0 border-t border-border/30 bg-[hsl(220_30%_4%/0.6)] backdrop-blur-2xl px-6 py-4 sm:px-8 lg:px-10 flex flex-col sm:flex-row gap-3">
              <button
                onClick={onToggleCast}
                className={cn(
                  "shrink-0 inline-flex items-center justify-center gap-2 h-12 px-5 rounded-full text-[12.5px] font-mono uppercase tracking-[0.22em] transition-all",
                  inCast
                    ? "border border-accent bg-[hsl(var(--accent)/0.18)] text-accent hover:bg-[hsl(var(--accent)/0.25)]"
                    : "border border-border/40 bg-[hsl(var(--foreground)/0.02)] text-foreground/85 hover:border-accent/40",
                )}
              >
                {inCast ? (
                  <>
                    <Check className="h-3.5 w-3.5" strokeWidth={2} />
                    <span>In Cast</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                    <span>Add to Cast</span>
                  </>
                )}
              </button>
              <button
                onClick={onCast}
                className={cn(
                  "group flex-1 inline-flex items-center justify-center gap-2 h-12 rounded-full",
                  "border border-accent/40 bg-gradient-to-br from-accent/15 to-accent/5",
                  "text-foreground transition-all hover:border-accent/60 hover:from-accent/25",
                )}
              >
                <Sparkles className="h-4 w-4 text-accent" strokeWidth={1.5} />
                <span className="text-[13.5px]">Cast {avatar.name} in Studio</span>
                <ArrowRight className="h-4 w-4 text-accent transition-transform group-hover:translate-x-0.5" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Section({
  eyebrow,
  children,
}: {
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className={cn(TYPE_META, "text-muted-foreground/60")}>
        ◆ {eyebrow}
      </span>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Pill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border/30 bg-[hsl(var(--foreground)/0.02)] px-2.5 py-1 text-[11px] tracking-tight text-foreground/85 capitalize">
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading / Empty / Error states
// ─────────────────────────────────────────────────────────────────────────────
function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-border/30 bg-[hsl(var(--foreground)/0.02)] overflow-hidden"
        >
          <div className="aspect-[3/4] w-full bg-[hsl(220_30%_8%)] animate-pulse" />
          <div className="p-3.5 space-y-2">
            <div className="h-3 w-3/4 rounded bg-[hsl(var(--foreground)/0.05)] animate-pulse" />
            <div className="h-2 w-1/2 rounded bg-[hsl(var(--foreground)/0.04)] animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="rounded-2xl border border-border/30 bg-[hsl(var(--foreground)/0.02)] backdrop-blur-xl">
      <div className="p-12 text-center">
        <Filter
          className="mx-auto h-8 w-8 text-accent/60"
          strokeWidth={1.2}
        />
        <h3 className="mt-6 font-display italic text-2xl font-light text-foreground">
          No matches.
        </h3>
        <p className="mt-4 max-w-md mx-auto text-[13px] font-light leading-relaxed text-muted-foreground/65">
          Nothing in the vault fits those filters. Reset and try again.
        </p>
        <button
          onClick={onReset}
          className={cn(
            "mt-8 inline-flex items-center gap-2 px-5 py-2.5 rounded-full",
            "border border-accent/40 bg-[hsl(var(--accent)/0.08)] text-foreground",
            "transition-colors hover:border-accent/60 hover:bg-[hsl(var(--accent)/0.12)]",
          )}
        >
          <span className="text-[13px]">Reset filters</span>
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CastBar — fixed bottom roster of currently-cast avatars.
//
// Appears the moment cast.length > 0. Shows a horizontal scroll of
// thumbnails (the cast), name + count summary, "Open in Studio" CTA,
// and a Clear affordance. Sits above the gallery, below the popup
// modal (z-30 so the popup at z-50 overlays it).
// ─────────────────────────────────────────────────────────────────────────────
function CastBar({
  cast,
  onRemove,
  onClear,
  onOpen,
}: {
  cast: CastMember[];
  onRemove: (id: string) => void;
  onClear: () => void;
  onOpen: () => void;
}) {
  const leadName = cast[0]?.name ?? "";
  const extras = cast.length - 1;
  const summary = cast.length === 1 ? leadName : `${leadName} +${extras}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.45, ease: EASE_PREMIUM }}
      className="fixed bottom-4 left-4 right-4 sm:left-6 sm:right-6 z-30 flex justify-center pointer-events-none"
      aria-label="Selected cast"
    >
      <div
        className={cn(
          "pointer-events-auto w-full max-w-[1100px]",
          "rounded-2xl border border-white/[0.09]",
          "bg-gradient-to-br from-[hsl(220_30%_6%/0.92)] via-[hsl(220_30%_4%/0.96)] to-[hsl(220_30%_3%/0.97)]",
          "backdrop-blur-2xl",
          "shadow-[0_40px_120px_-30px_hsl(0_0%_0%/0.85),0_0_0_1px_hsl(var(--accent)/0.10),inset_0_1px_0_hsl(0_0%_100%/0.06)]",
          "px-4 py-3 sm:px-5 sm:py-3.5",
          "flex items-center gap-4",
        )}
      >
        {/* Eyebrow + summary */}
        <div className="min-w-0 hidden sm:flex flex-col leading-tight shrink-0">
          <span className={cn(TYPE_META, "text-muted-foreground/60")}>
            ◆ Cast
          </span>
          <span
            className="mt-1 font-display italic text-[15px] font-light text-foreground truncate max-w-[180px]"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            {summary}
          </span>
          <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/55 mt-0.5">
            {cast.length} {cast.length === 1 ? "talent" : "talents"} · max 8
          </span>
        </div>

        {/* Vertical hairline (desktop only) */}
        <div className="hidden sm:block w-px h-12 bg-white/[0.06] shrink-0" />

        {/* Thumbnail strip */}
        <ul className="flex items-center gap-2 overflow-x-auto scrollbar-hide flex-1 min-w-0">
          {cast.map((m) => (
            <li key={m.id} className="relative shrink-0 group/cast">
              <div
                className={cn(
                  "h-12 w-10 sm:h-14 sm:w-11 overflow-hidden rounded-md",
                  "border border-white/[0.10] bg-[hsl(220_40%_4%)]",
                  "ring-1 ring-inset ring-white/[0.04]",
                )}
              >
                <OptimizedAvatarImage
                  src={m.imageUrl}
                  alt={m.name}
                  fallbackText={m.name}
                  aspectRatio="portrait"
                  className="h-full w-full object-cover"
                />
              </div>
              {/* Remove */}
              <button
                onClick={() => onRemove(m.id)}
                aria-label={`Remove ${m.name}`}
                className={cn(
                  "absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full",
                  "bg-[hsl(220_30%_4%)] ring-1 ring-inset ring-white/30",
                  "text-foreground/85 hover:text-foreground hover:ring-accent/60",
                  "inline-flex items-center justify-center transition-colors",
                  "opacity-0 group-hover/cast:opacity-100 focus:opacity-100",
                )}
              >
                <X className="h-2.5 w-2.5" strokeWidth={2.5} />
              </button>
              {/* Name tooltip on hover (desktop) */}
              <span
                className={cn(
                  "hidden sm:block absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap",
                  "px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-[0.22em] text-white",
                  "bg-[hsl(220_30%_4%)] ring-1 ring-inset ring-white/20",
                  "opacity-0 group-hover/cast:opacity-100 transition-opacity pointer-events-none",
                )}
              >
                {m.name}
              </span>
            </li>
          ))}
        </ul>

        {/* Actions */}
        <div className="shrink-0 flex items-center gap-2">
          <button
            onClick={onClear}
            aria-label="Clear cast"
            className={cn(
              "inline-flex items-center justify-center h-9 w-9 rounded-full",
              "border border-border/40 bg-[hsl(var(--foreground)/0.02)] text-muted-foreground/70",
              "hover:text-foreground hover:border-destructive/40 transition-colors",
            )}
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
          <button
            onClick={onOpen}
            className={cn(
              "group inline-flex items-center justify-center gap-2 h-9 px-4 rounded-full",
              "border border-accent/40 bg-gradient-to-br from-accent/15 to-accent/5 text-foreground",
              "transition-all hover:border-accent/60 hover:from-accent/25",
            )}
          >
            <Sparkles className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
            <span className="text-[12.5px] hidden sm:inline">Open in Studio</span>
            <span className="text-[12.5px] sm:hidden">Studio</span>
            <ArrowRight
              className="h-3.5 w-3.5 text-accent transition-transform group-hover:translate-x-0.5"
              strokeWidth={1.5}
            />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-destructive/30 bg-[hsl(0_60%_30%/0.05)] p-12 text-center">
      <p className="font-display italic text-2xl font-light text-foreground">
        Couldn&rsquo;t reach the vault.
      </p>
      <p className="mt-4 text-[13px] font-light text-muted-foreground/70">
        The avatar library failed to load. Try again — usually a transient
        network blip.
      </p>
      <button
        onClick={onRetry}
        className={cn(
          "mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-full",
          "border border-border/40 bg-[hsl(var(--foreground)/0.02)] text-foreground",
          "transition-colors hover:border-accent/40",
        )}
      >
        <Loader2 className="h-4 w-4" strokeWidth={1.5} />
        <span className="text-[13px]">Retry</span>
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Default export — wrapped in ErrorBoundary
// ─────────────────────────────────────────────────────────────────────────────
export default function Avatars() {
  usePageMeta({
    title: "Avatars — Small Bridges",
    description:
      "Browse and cast cinematic AI talent — every avatar in the Small Bridges vault.",
  });
  return (
    <ErrorBoundary>
      <AvatarsContent />
    </ErrorBoundary>
  );
}
