/**
 * Lobby — /lobby
 *
 * The Watch hub. Single Foundation-shelled surface that absorbs the
 * three legacy watch destinations:
 *   - /lobby   (community films + daily sketch)
 *   - /music   (parallel music surface)
 *   - /market  (entertainment marketplace)
 *
 * Tabs: Films · Music · Market · Worlds.
 *
 * Films, Music, and Market currently lazy-load their legacy page
 * components as tab bodies. That preserves the working data wiring
 * (channel worlds, daily prompt, drafts, music reels, market listings)
 * while the user gets the unified URL and Foundation chrome around
 * the whole surface. A follow-up pass will deep-port each body into
 * Foundation primitives and delete the legacy components.
 *
 * Worlds is a placeholder until the worlds index is wired in.
 */
import { lazy, Suspense, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Film as FilmIcon,
  Globe2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FoundationShell } from "@/components/foundation/FoundationShell";
import {
  EditorialCanvas,
  EditorialEyebrow,
  EditorialHeadline,
} from "@/components/foundation/EditorialCanvas";
import { useLiveRenderTimecode } from "@/hooks/useLiveRenderTimecode";
import { usePageMeta } from "@/hooks/usePageMeta";
import { EASE_PREMIUM, TYPE_META } from "@/lib/design-system";

// Music and Market un-merged back to standalone surfaces (/music, /market).
// Lobby is now the Watch destination — daily sketch + community films +
// worlds + universes browsing. Music/Market are linked from the cross-link
// strip in LobbyFilms (and from Cmd+K).
const FilmsBody = lazy(() => import("@/pages/lobby/LobbyFilms"));

type Tab = "films" | "worlds";

const TABS: ReadonlyArray<{ id: Tab; label: string; sub: string; Icon: typeof FilmIcon }> = [
  { id: "films",  label: "Films",  sub: "Community + Daily Sketch", Icon: FilmIcon },
  { id: "worlds", label: "Worlds", sub: "Canon · universes",         Icon: Globe2 },
];

export default function Lobby() {
  usePageMeta({
    title: "Lobby — Small Bridges",
    description:
      "Today's Daily Sketch, community films, music, market, and worlds — all in one room.",
  });

  const [params, setParams] = useSearchParams();
  const reducedMotion = useReducedMotion();
  const liveRenderTimecode = useLiveRenderTimecode();

  const tab = useMemo<Tab>(() => {
    const raw = params.get("tab");
    // Legacy ?tab=music / ?tab=market send the visitor to the standalone
    // Music / Market surfaces — handled at the route level via redirect.
    if (raw === "worlds") return "worlds";
    return "films";
  }, [params]);

  const setTab = (next: Tab) => {
    const p = new URLSearchParams(params);
    if (next === "films") p.delete("tab");
    else p.set("tab", next);
    setParams(p, { replace: true });
  };

  const activeMeta = TABS.find((t) => t.id === tab);

  return (
    <FoundationShell>
      <div className="relative mx-auto w-full max-w-[1440px] px-4 pb-24 pt-10 sm:px-6 lg:px-10">
        <EditorialCanvas
          maxWidth="100%"
          chrome={{
            crumbs: ["Small Bridges", "lobby"],
            timecode:
              liveRenderTimecode ??
              `${activeMeta?.label.toUpperCase() ?? "LOBBY"} · LIVE`,
          }}
        >
          {/* ── Header row ──────────────────────────────────────── */}
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0 max-w-2xl">
              <EditorialEyebrow>Lobby</EditorialEyebrow>
              <EditorialHeadline className="mt-5">
                Tonight&rsquo;s room.
              </EditorialHeadline>
              <p className="mt-5 max-w-xl text-[14px] font-light leading-relaxed text-muted-foreground/70">
                Today&rsquo;s Daily Sketch, community films, music, market,
                and worlds. Pick a door — every tab is its own audience.
              </p>
            </div>
          </div>

          {/* ── Hairline rule + tabs ─────────────────────────────── */}
          <div className="mt-10 h-px bg-gradient-to-r from-transparent via-border/60 to-transparent" />

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <LobbyTabs value={tab} onChange={setTab} />
            <div className={cn(TYPE_META, "text-muted-foreground/50")}>
              {activeMeta?.sub}
            </div>
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
                {tab === "films" && (
                  <Suspense fallback={<TabLoadingState />}>
                    <FilmsBody />
                  </Suspense>
                )}
                {tab === "worlds" && <WorldsTab />}
              </motion.div>
            </AnimatePresence>
          </div>
        </EditorialCanvas>
      </div>
    </FoundationShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Foundation-canon segmented tab control. Same vocabulary as Studio + Cast.
// ─────────────────────────────────────────────────────────────────────────────
function LobbyTabs({
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
                layoutId="lobby-tab-active"
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

function TabLoadingState() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="text-center">
        <Sparkles className="mx-auto h-5 w-5 animate-pulse text-accent/70" strokeWidth={1.5} />
        <p className={cn(TYPE_META, "mt-3 text-muted-foreground/60")}>
          Loading the room…
        </p>
      </div>
    </div>
  );
}

function WorldsTab() {
  return (
    <div className="rounded-2xl border border-border/30 bg-[hsl(var(--foreground)/0.02)] backdrop-blur-xl">
      <div className="p-12 text-center">
        <Globe2 className="mx-auto h-8 w-8 text-accent/60" strokeWidth={1.2} />
        <h3 className="mt-6 font-display italic text-2xl font-light text-foreground">
          Worlds — coming online.
        </h3>
        <p className="mt-4 max-w-xl mx-auto text-[13px] font-light leading-relaxed text-muted-foreground/65">
          Browse every universe, follow a canon, drop into a world where
          other directors are shooting. Index wires in next pass.
        </p>
      </div>
    </div>
  );
}
