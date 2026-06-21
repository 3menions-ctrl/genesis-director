/**
 * Cast — /cast
 *
 * The talent browse + brand identity surface. People tab links to the
 * standalone Avatars studio (/avatars) for creation workflows; Mascots
 * is the curated brand mascot pack; Brand is the personal identity kit.
 *
 * Built on Foundation canon: FoundationShell + EditorialCanvas +
 * SpineBackdrop, same vocabulary as Studio · Library · Account · Reel.
 *
 * Tabs:
 *   - People  — entry point that links into /avatars (the studio)
 *   - Mascots — brand mascot pack (inlined from the legacy /mascots)
 *   - Brand   — palette / fonts / logos / voice profile (placeholder
 *               for personal brand identity)
 */
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useSearchParams, Link } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Users,
  Smile,
  Palette,
  Plus,
  Download,
  Film as FilmIcon,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FoundationShell } from "@/components/foundation/FoundationShell";
import {
  EditorialCanvas,
  EditorialEyebrow,
  EditorialHeadline,
} from "@/components/foundation/EditorialCanvas";
import { Button } from "@/components/ui/button";
import { SeedanceAnimateDialog } from "@/components/mascots/SeedanceAnimateDialog";
import { LazyAutoVideo } from "@/components/video/LazyAutoVideo";
import { useLiveRenderTimecode } from "@/hooks/useLiveRenderTimecode";
import { usePageMeta } from "@/hooks/usePageMeta";
import { EASE_PREMIUM, TYPE_META } from "@/lib/design-system";

// Mascot assets — inlined so the Mascots tab doesn't need a sibling
// page to live. The data set is small and stable.
import foodTaco from "@/assets/mascots/food-truck-taco.png";
import foodBurger from "@/assets/mascots/food-truck-burger.png";
import foodIce from "@/assets/mascots/food-truck-icecream.png";
import cerealTiger from "@/assets/mascots/cereal-tiger.png";
import cerealRabbit from "@/assets/mascots/cereal-wizard-rabbit.png";
import cerealBear from "@/assets/mascots/cereal-astronaut-bear.png";
import indieKnight from "@/assets/mascots/indie-knight.png";
import indieFox from "@/assets/mascots/indie-fox-rogue.png";
import indieRobot from "@/assets/mascots/indie-robot.png";

type Tab = "people" | "mascots" | "brand";

const TABS: ReadonlyArray<{ id: Tab; label: string; Icon: typeof Users }> = [
  { id: "people",  label: "People",  Icon: Users },
  { id: "mascots", label: "Mascots", Icon: Smile },
  { id: "brand",   label: "Brand",   Icon: Palette },
];

// ─────────────────────────────────────────────────────────────────────────────
// Mascot data — three packs, nine characters
// ─────────────────────────────────────────────────────────────────────────────
type Pack = "all" | "food-truck" | "cereal-box" | "indie-game";

interface Mascot {
  id: string;
  name: string;
  pack: Exclude<Pack, "all">;
  packLabel: string;
  tagline: string;
  palette: [string, string];
  src: string;
  loop: string;
}

const MASCOT_LOOP =
  "https://videos.pexels.com/video-files/2715411/2715411-uhd_2560_1440_30fps.mp4";

const MASCOTS: Mascot[] = [
  { id: "taco",   name: "El Capitán",       pack: "food-truck", packLabel: "Food Truck", tagline: "Sunbaked. Spatula-armed. Sells out by noon.",       palette: ["hsl(38,95%,55%)", "hsl(8,85%,55%)"],   src: foodTaco,    loop: MASCOT_LOOP },
  { id: "burger", name: "Patty Knox",       pack: "food-truck", packLabel: "Food Truck", tagline: "Wears the bandana. Rings the bell. Always running.", palette: ["hsl(20,90%,55%)", "hsl(0,75%,50%)"],   src: foodBurger,  loop: MASCOT_LOOP },
  { id: "cone",   name: "Mintsy",           pack: "food-truck", packLabel: "Food Truck", tagline: "Pastel diplomat of the Sunday queue.",               palette: ["hsl(150,55%,75%)","hsl(340,75%,80%)"], src: foodIce,     loop: MASCOT_LOOP },
  { id: "tiger",  name: "Coach Striker",    pack: "cereal-box", packLabel: "Cereal Box", tagline: "Saturday-morning energy in a track jacket.",        palette: ["hsl(48,100%,55%)","hsl(0,80%,55%)"],   src: cerealTiger,  loop: MASCOT_LOOP },
  { id: "rabbit", name: "Hexley the Wise",  pack: "cereal-box", packLabel: "Cereal Box", tagline: "Star wand. Cape. Endless bowl of magic.",            palette: ["hsl(285,55%,65%)","hsl(330,75%,80%)"], src: cerealRabbit, loop: MASCOT_LOOP },
  { id: "bear",   name: "Captain Astro Bear", pack: "cereal-box", packLabel: "Cereal Box", tagline: "Helmet on. Thumb up. Cereal in zero-G.",           palette: ["hsl(22,95%,55%)", "hsl(180,40%,75%)"], src: cerealBear,   loop: MASCOT_LOOP },
  { id: "knight", name: "Aralt the Bold",   pack: "indie-game", packLabel: "Indie Hero", tagline: "Gilded helm. Glacier blade. Tutorial-boss energy.",  palette: ["hsl(180,40%,30%)","hsl(45,90%,55%)"],  src: indieKnight, loop: MASCOT_LOOP },
  { id: "fox",    name: "Vesper Six",       pack: "indie-game", packLabel: "Indie Hero", tagline: "Hooded. Twin daggers. Glows in the dark.",            palette: ["hsl(280,55%,30%)","hsl(320,95%,65%)"], src: indieFox,    loop: MASCOT_LOOP },
  { id: "robot",  name: "Ko-12",             pack: "indie-game", packLabel: "Indie Hero", tagline: "One blue eye. Three thrusters. Best companion AI.",  palette: ["hsl(215,15%,40%)","hsl(195,95%,60%)"], src: indieRobot,  loop: MASCOT_LOOP },
];

const PACK_FILTERS: { key: Pack; label: string }[] = [
  { key: "all",         label: "All" },
  { key: "food-truck",  label: "Food Truck" },
  { key: "cereal-box",  label: "Cereal Box" },
  { key: "indie-game",  label: "Indie Hero" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Cast page
// ─────────────────────────────────────────────────────────────────────────────
export default function Cast() {
  usePageMeta({
    title: "Cast — Small Bridges",
    description:
      "Your talent locker. Avatars, mascots, and brand identity in one place.",
  });

  const [params, setParams] = useSearchParams();
  const reducedMotion = useReducedMotion();
  const liveRenderTimecode = useLiveRenderTimecode();

  const tab = useMemo<Tab>(() => {
    const raw = params.get("tab");
    if (raw === "mascots" || raw === "brand") return raw;
    return "people";
  }, [params]);

  const setTab = (next: Tab) => {
    const p = new URLSearchParams(params);
    if (next === "people") p.delete("tab");
    else p.set("tab", next);
    setParams(p, { replace: true });
  };

  return (
    <FoundationShell>
      <div className="relative mx-auto w-full max-w-[1440px] px-4 pb-24 pt-10 sm:px-6 lg:px-10">
        <EditorialCanvas
          maxWidth="100%"
          chrome={{
            crumbs: ["Small Bridges", "cast"],
            timecode: liveRenderTimecode ?? `${MASCOTS.length} MASCOTS · LIVE`,
          }}
        >
          {/* ── Header row ──────────────────────────────────────── */}
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0 max-w-2xl">
              <EditorialEyebrow>Cast</EditorialEyebrow>
              <EditorialHeadline className="mt-5">
                Your talent.
              </EditorialHeadline>
              <p className="mt-5 max-w-xl text-[14px] font-light leading-relaxed text-muted-foreground/70">
                Cast members you direct, mascots you ship, and the brand
                identity behind every film. One locker, three doors.
              </p>
            </div>

            <button
              onClick={() => setTab("people")}
              className={cn(
                "group inline-flex items-center gap-2 px-5 py-3 rounded-full",
                "border border-accent/40 bg-gradient-to-br from-accent/15 to-accent/5",
                "text-foreground transition-all hover:border-accent/60 hover:from-accent/25",
              )}
            >
              <Plus className="h-4 w-4 text-accent" strokeWidth={1.5} />
              <span className="text-[13px]">Cast new</span>
              <span className={cn(TYPE_META, "text-muted-foreground/45 group-hover:text-accent/80")}>
                ⌘ N
              </span>
            </button>
          </div>

          {/* ── Hairline rule + tabs ─────────────────────────────── */}
          <div className="mt-10 h-px bg-gradient-to-r from-transparent via-border/60 to-transparent" />

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <CastTabs value={tab} onChange={setTab} />
          </div>

          {/* ── Tab content ─────────────────────────────────────── */}
          <div className="mt-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={
                  reducedMotion
                    ? { opacity: 1 }
                    : { opacity: 0, y: 16, filter: "blur(6px)" }
                }
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={
                  reducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, y: -8, filter: "blur(4px)" }
                }
                transition={{ duration: 0.45, ease: EASE_PREMIUM }}
              >
                {tab === "people" && <PeopleTab />}
                {tab === "mascots" && <MascotsTab />}
                {tab === "brand" && <BrandTab />}
              </motion.div>
            </AnimatePresence>
          </div>
        </EditorialCanvas>
      </div>
    </FoundationShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Foundation-canon segmented tab control. Matches Studio's tab vocabulary.
// ─────────────────────────────────────────────────────────────────────────────
function CastTabs({
  value,
  onChange,
}: {
  value: Tab;
  onChange: (v: Tab) => void;
}) {
  return (
    <div
      role="tablist"
      className="relative inline-flex flex-wrap items-center gap-1 rounded-full p-1 border border-border/30 bg-[hsl(var(--foreground)/0.02)] backdrop-blur-xl"
    >
      {TABS.map((t) => {
        const active = value === t.id;
        const Icon = t.Icon;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cn(
              "relative z-10 inline-flex items-center gap-2 px-4 h-9 rounded-full text-[12.5px] tracking-tight transition-colors",
              active
                ? "text-foreground"
                : "text-muted-foreground/70 hover:text-foreground/90",
            )}
          >
            {active && (
              <motion.span
                layoutId="cast-tab-active"
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
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PeopleTab — entry point into the Avatars studio (now standalone). Keeps
// Cast lightweight; the actual creation workflow opens at /avatars where
// it has the full editor canvas. This tab is the door, not the room.
// ─────────────────────────────────────────────────────────────────────────────
function PeopleTab() {
  return (
    <div className="rounded-2xl border border-border/30 bg-[hsl(var(--foreground)/0.02)] backdrop-blur-xl">
      <div className="p-12 text-center">
        <Users className="mx-auto h-8 w-8 text-accent/70" strokeWidth={1.2} />
        <h3 className="mt-6 font-display italic text-2xl font-light text-foreground">
          Your people.
        </h3>
        <p className="mt-4 max-w-xl mx-auto text-[13px] font-light leading-relaxed text-muted-foreground/65">
          Cast cinematic AI avatars — customize, save, and direct them in
          any scene. The studio lives at its own surface so the canvas
          has room to breathe.
        </p>
        <Link
          to="/avatars"
          className={cn(
            "mt-8 group inline-flex items-center gap-2 px-5 py-3 rounded-full",
            "border border-accent/40 bg-gradient-to-br from-accent/15 to-accent/5",
            "text-foreground transition-all hover:border-accent/60 hover:from-accent/25",
          )}
        >
          <span className="text-[13px]">Open Avatar Studio</span>
          <ArrowRight className="h-3.5 w-3.5 text-accent transition-transform group-hover:translate-x-0.5" strokeWidth={1.5} />
        </Link>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MascotsTab — inline gallery of the brand mascot pack. Was a standalone
// page (/mascots) before; now lives here so the locker is one door.
// ─────────────────────────────────────────────────────────────────────────────
function MascotsTab() {
  const [filter, setFilter] = useState<Pack>("all");
  const [animateOpen, setAnimateOpen] = useState(false);
  const [animateTarget, setAnimateTarget] = useState<Mascot | null>(null);

  const visible = useMemo(
    () => (filter === "all" ? MASCOTS : MASCOTS.filter((m) => m.pack === filter)),
    [filter],
  );

  return (
    <div className="space-y-8">
      {/* Filter chips — same vocabulary as Library's mode tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {PACK_FILTERS.map(({ key, label }) => {
          const active = filter === key;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                "inline-flex items-center rounded-full px-3.5 h-8 text-[12px] tracking-tight transition-colors",
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

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {visible.map((m, i) => (
          <motion.article
            key={m.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.04, 0.4), duration: 0.45, ease: EASE_PREMIUM }}
            className="group relative overflow-hidden rounded-2xl border border-border/30 bg-[hsl(var(--foreground)/0.02)] backdrop-blur-xl"
          >
            {/* Palette aurora */}
            <div
              aria-hidden
              className="pointer-events-none absolute -top-20 -left-20 w-[420px] h-[300px] rounded-full opacity-50 blur-[80px] transition-opacity duration-500 group-hover:opacity-80"
              style={{ background: `radial-gradient(closest-side, ${m.palette[0]}, transparent 70%)` }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-24 -right-16 w-[360px] h-[260px] rounded-full opacity-40 blur-[80px] transition-opacity duration-500 group-hover:opacity-70"
              style={{ background: `radial-gradient(closest-side, ${m.palette[1]}, transparent 70%)` }}
            />

            {/* Stage */}
            <div className="relative aspect-square overflow-hidden">
              <div className="absolute inset-4 rounded-2xl border border-foreground/[0.06]" />
              <LazyAutoVideo
                src={m.loop}
                poster={m.src}
                aria-label={`${m.name}, ${m.packLabel} mascot animated loop`}
                className="relative z-10 w-full h-full object-contain p-8 transition-transform duration-700 ease-out group-hover:scale-[1.04] group-hover:-translate-y-1"
              />
            </div>

            {/* Caption rail */}
            <div className="relative px-5 py-4 border-t border-border/30">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className={cn(TYPE_META, "text-muted-foreground/60")}>
                    {String(i + 1).padStart(2, "0")} · {m.packLabel}
                  </div>
                  <h3 className="mt-1.5 font-display text-[18px] font-light tracking-tight text-foreground truncate">
                    {m.name}
                  </h3>
                  <p className="mt-1 text-[12.5px] font-light leading-relaxed text-muted-foreground/70 line-clamp-2">
                    {m.tagline}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    asChild
                    aria-label={`Download ${m.name}`}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <a href={m.src} download>
                      <Download className="w-4 h-4" strokeWidth={1.5} />
                    </a>
                  </Button>
                  <Button
                    variant="pill"
                    size="pill"
                    onClick={() => {
                      setAnimateTarget(m);
                      setAnimateOpen(true);
                    }}
                    aria-label={`Animate ${m.name} with Seedance`}
                  >
                    <FilmIcon className="w-4 h-4" strokeWidth={1.5} /> Animate
                  </Button>
                </div>
              </div>
            </div>
          </motion.article>
        ))}
      </section>

      {visible.length === 0 && (
        <div className="text-center py-20 rounded-2xl border border-border/30 bg-[hsl(var(--foreground)/0.02)]">
          <p className={cn(TYPE_META, "text-muted-foreground/60")}>
            No mascots in this pack yet.
          </p>
        </div>
      )}

      <SeedanceAnimateDialog
        open={animateOpen}
        onOpenChange={setAnimateOpen}
        mascot={animateTarget}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BrandTab — placeholder until the personal brand-identity system lands.
// Workspace already has its own brand surface for business accounts; this
// one is the personal-account equivalent and ships in a follow-up commit.
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// BrandTab — personal brand identity kit.
//
// Stores a simple identity manifest in localStorage scoped to the user id.
// (Workspace-scoped brand_kits already exist for orgs; this is the personal
// equivalent and intentionally does not require a DB migration.)
// ─────────────────────────────────────────────────────────────────────────────
type BrandProfile = {
  name: string;
  tagline: string;
  palette: string[]; // hex strings
  headingFont: string;
  bodyFont: string;
  voiceProfile: string;
};

const BRAND_FONTS = [
  "Fraunces",
  "Inter",
  "Playfair Display",
  "Space Grotesk",
  "DM Sans",
  "JetBrains Mono",
];

const DEFAULT_BRAND: BrandProfile = {
  name: "",
  tagline: "",
  palette: ["#0F172A", "#E11D48", "#FCD34D"],
  headingFont: "Fraunces",
  bodyFont: "Inter",
  voiceProfile: "",
};

function brandKey(userId: string | undefined) {
  return userId ? `sb:brand:${userId}` : "sb:brand:anonymous";
}
function loadBrand(userId: string | undefined): BrandProfile {
  try {
    const raw = window.localStorage.getItem(brandKey(userId));
    if (!raw) return DEFAULT_BRAND;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_BRAND, ...parsed };
  } catch {
    return DEFAULT_BRAND;
  }
}
function saveBrand(userId: string | undefined, b: BrandProfile) {
  try {
    window.localStorage.setItem(brandKey(userId), JSON.stringify(b));
  } catch {
    /* ignore */
  }
}

function BrandTab() {
  const { user } = useAuth();
  const [brand, setBrand] = useState<BrandProfile>(() => loadBrand(user?.id));
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setBrand(loadBrand(user?.id));
    setDirty(false);
  }, [user?.id]);

  const update = <K extends keyof BrandProfile>(field: K, value: BrandProfile[K]) => {
    setBrand((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
  };

  const setPaletteAt = (i: number, color: string) => {
    setBrand((prev) => {
      const next = [...prev.palette];
      next[i] = color;
      return { ...prev, palette: next };
    });
    setDirty(true);
  };

  const handleSave = () => {
    saveBrand(user?.id, brand);
    setDirty(false);
    toast.success("Brand profile saved");
  };

  return (
    <div className="rounded-2xl border border-border/30 bg-[hsl(var(--foreground)/0.02)] backdrop-blur-xl p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.32em] text-accent/85">
            <Palette className="h-3 w-3" />Brand identity
          </div>
          <h3 className="mt-3 font-display italic text-[28px] text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
            Your visual + verbal kit.
          </h3>
          <p className="mt-2 text-[13px] text-muted-foreground/75 max-w-xl">
            Save your palette, type pair, and tone. Studio will use these defaults whenever you generate.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty}
          className="shrink-0 inline-flex items-center gap-2 h-10 px-5 rounded-full bg-accent/90 hover:bg-accent text-black text-[11px] font-mono uppercase tracking-[0.22em] disabled:opacity-40"
        >
          {dirty ? "Save brand" : "Saved"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Identity strings */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-5 space-y-4">
          <Field label="Brand name">
            <input
              type="text"
              value={brand.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g. Slow Cinema Co."
              maxLength={60}
              className="w-full h-10 px-3 rounded-md bg-white/[0.04] border border-white/[0.06] text-foreground text-[14px] focus:outline-none focus:border-accent/55"
            />
          </Field>
          <Field label="Tagline">
            <input
              type="text"
              value={brand.tagline}
              onChange={(e) => update("tagline", e.target.value)}
              placeholder="e.g. Quiet stories, deeply filmed."
              maxLength={120}
              className="w-full h-10 px-3 rounded-md bg-white/[0.04] border border-white/[0.06] text-foreground text-[14px] focus:outline-none focus:border-accent/55"
            />
          </Field>
          <Field label="Voice / tone notes">
            <textarea
              value={brand.voiceProfile}
              onChange={(e) => update("voiceProfile", e.target.value)}
              rows={4}
              maxLength={600}
              placeholder="Narration style, vocabulary, what to avoid…"
              className="w-full px-3 py-2 rounded-md bg-white/[0.04] border border-white/[0.06] text-foreground text-[13px] leading-relaxed resize-none focus:outline-none focus:border-accent/55"
            />
          </Field>
        </div>

        {/* Visual identity */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-5 space-y-5">
          <Field label="Palette">
            <div className="grid grid-cols-3 gap-3">
              {brand.palette.map((color, i) => (
                <div key={i} className="rounded-lg border border-white/[0.06] bg-black/30 overflow-hidden">
                  <div className="h-16" style={{ backgroundColor: color }} />
                  <div className="p-2">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setPaletteAt(i, e.target.value)}
                      className="w-full h-6 rounded cursor-pointer bg-transparent border-0"
                    />
                    <input
                      type="text"
                      value={color}
                      onChange={(e) => setPaletteAt(i, e.target.value)}
                      maxLength={9}
                      className="w-full mt-1 h-7 px-2 rounded bg-white/[0.04] text-[11px] font-mono text-foreground/85 text-center focus:outline-none focus:bg-white/[0.07]"
                    />
                  </div>
                </div>
              ))}
            </div>
          </Field>
          <Field label="Heading font">
            <FontPicker value={brand.headingFont} onChange={(v) => update("headingFont", v)} />
          </Field>
          <Field label="Body font">
            <FontPicker value={brand.bodyFont} onChange={(v) => update("bodyFont", v)} />
          </Field>
        </div>
      </div>

      {/* Live preview */}
      <div
        className="mt-6 rounded-xl p-8"
        style={{
          background: `linear-gradient(135deg, ${brand.palette[0] ?? "#0F172A"} 0%, ${brand.palette[0] ?? "#0F172A"}cc 100%)`,
          color: "#fafafa",
        }}
      >
        <div
          className="text-[12px] uppercase tracking-[0.32em]"
          style={{ color: brand.palette[2] ?? "#FCD34D", fontFamily: brand.bodyFont }}
        >
          Preview
        </div>
        <div
          className="mt-3 text-[34px] font-light leading-tight"
          style={{ fontFamily: brand.headingFont, color: "#fafafa" }}
        >
          {brand.name || "Your brand name"}
        </div>
        <div className="mt-2 text-[16px] opacity-85" style={{ fontFamily: brand.bodyFont }}>
          {brand.tagline || "Your tagline appears here."}
        </div>
        <div className="mt-5 inline-flex items-center gap-2">
          <span
            className="inline-block h-9 px-4 rounded-full text-[11px] font-mono uppercase tracking-[0.22em] flex items-center"
            style={{ backgroundColor: brand.palette[1] ?? "#E11D48", color: "#0a0a0a", fontFamily: brand.bodyFont }}
          >
            Primary action
          </span>
          <span
            className="inline-block h-9 px-4 rounded-full text-[11px] font-mono uppercase tracking-[0.22em] flex items-center border"
            style={{ borderColor: brand.palette[2] ?? "#FCD34D", color: brand.palette[2] ?? "#FCD34D", fontFamily: brand.bodyFont }}
          >
            Secondary
          </span>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/70 mb-2">
        {label}
      </label>
      {children}
    </div>
  );
}

function FontPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {BRAND_FONTS.map((f) => (
        <button
          key={f}
          type="button"
          onClick={() => onChange(f)}
          className={cn(
            "h-9 px-3 rounded-md text-[12px] transition-colors",
            value === f
              ? "bg-accent/85 text-black"
              : "bg-white/[0.03] text-foreground/80 hover:bg-white/[0.08]",
          )}
          style={{ fontFamily: f }}
        >
          {f}
        </button>
      ))}
    </div>
  );
}
