/**
 * AvatarGalleryBackdrop — full-bleed rotating avatar showcase that
 * sits behind the Avatars page content.
 *
 * Three positions on screen:
 *   • LEFT   — the avatar that's about to be in focus (entering)
 *   • CENTER — the in-focus avatar, sharp + large
 *   • RIGHT  — the avatar that was just in focus (exiting)
 *
 * Every cycle:
 *   • a new avatar slides in from off-screen left → LEFT position
 *   • the LEFT avatar slides to CENTER (scale up, blur off)
 *   • the CENTER avatar slides to RIGHT (scale down, blur on)
 *   • the RIGHT avatar slides off-screen right → unmounts
 *
 * The component is purely decorative — pointer-events-none — so the
 * Avatars browse grid sits in front of it and stays interactive.
 */
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface BackdropAvatar {
  id: string;
  name: string;
  imageUrl: string;
  /** One-line description shown in the side info panel. */
  description?: string | null;
}

interface Props {
  /** Source pool — only those with a real https image are used. */
  avatars: BackdropAvatar[];
  /** ms between rotations (default 4500). */
  intervalMs?: number;
  /** Opacity scrim over the whole backdrop (0..1, default 0.35). */
  scrimOpacity?: number;
  /** CSS height of the stage. Default: clamp(360px, 56vh, 620px). */
  height?: string;
  /** Optional className passthrough for layout tuning at the call site. */
  className?: string;
  /** Fires whenever the centered avatar changes — used by the host
   *  page to drive a side panel showing name + description. */
  onFocusChange?: (avatar: BackdropAvatar) => void;
}

type Slot = "left" | "center" | "right";

const SLOT_TRANSFORMS: Record<Slot, { x: string; scale: number; blur: number; opacity: number }> = {
  // Slight Y nudge centers the face roughly on the page horizon line.
  left:   { x: "-32%", scale: 0.70, blur: 10, opacity: 0.55 },
  center: { x: "0%",   scale: 1.00, blur: 0,  opacity: 1.00 },
  right:  { x: "32%",  scale: 0.70, blur: 10, opacity: 0.55 },
};

export function AvatarGalleryBackdrop({
  avatars,
  intervalMs = 4500,
  scrimOpacity = 0.35,
  height = "clamp(360px, 56vh, 620px)",
  className,
  onFocusChange,
}: Props) {
  const reduced = useReducedMotion();

  // Filter to only real https images — defensive; the parent query
  // already drops placeholders, but a bad row here would crash the
  // backdrop.
  const pool = useMemo(
    () => avatars.filter((a) => a.imageUrl && a.imageUrl.startsWith("http")),
    [avatars],
  );

  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (pool.length < 2) return;
    if (reduced) return;
    const id = window.setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [pool.length, intervalMs, reduced]);

  // Pick the three currently-visible avatars by slot. Modular index
  // means we wrap forever without ever running out. Defined BEFORE
  // the early-return so the focus-change effect below has a stable
  // dependency list (hooks must run unconditionally).
  const pick = (offset: number): BackdropAvatar | null =>
    pool.length === 0
      ? null
      : pool[((tick + offset) % pool.length + pool.length) % pool.length];

  // Emit the centered avatar to the parent whenever it changes, so
  // the host page (Avatars) can render a name + description card
  // off to the side that tracks the rotation.
  const focused = pick(0);
  useEffect(() => {
    if (focused && onFocusChange) onFocusChange(focused);
  }, [focused?.id, onFocusChange]);

  if (pool.length === 0) return null;

  // Render order: sides FIRST, center LAST. Critical for layering —
  // the user said "no other picture can sip through" the focused one.
  // DOM order = paint order, so center must come last to sit on top.
  const slots: { slot: Slot; avatar: BackdropAvatar }[] = (
    [
      { slot: "left"   as const, avatar: pick(1) },
      { slot: "right"  as const, avatar: pick(-1) },
      { slot: "center" as const, avatar: pick(0) },
    ].filter((s): s is { slot: Slot; avatar: BackdropAvatar } => s.avatar !== null)
  );

  return (
    <div
      aria-hidden
      className={cn(
        // Block-flow stage. Sits in the page between the filter row
        // and the grid; pointer-events-none keeps clicks passing
        // through if anything floats on top of it.
        "pointer-events-none relative w-full overflow-hidden",
        // Subtle bottom fade so the grid below can poke up into the
        // gallery without a hard seam.
        "[mask-image:linear-gradient(to_bottom,black_0%,black_82%,transparent_100%)]",
        className,
      )}
      style={{ height }}
    >
      {/* Backdrop avatars — each slot has its own AnimatePresence so
          changing the avatar in that slot animates an enter + exit. */}
      {slots.map(({ slot, avatar }) => {
        const t = SLOT_TRANSFORMS[slot];
        return (
          <div
            key={slot}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{
              // Slot size derives from the stage height — keeps
              // portraits filling vertically regardless of viewport.
              // Width tracks an aspect-ish ratio (4:5 portrait).
              width:  "min(560px, 44vw)",
              height: "92%",
              transform: `translate(calc(-50% + ${t.x}), -50%)`,
              // Center sits ABOVE sides so its transparent "contain"
              // bars stay clean. Sides explicitly under it.
              zIndex: slot === "center" ? 30 : 10,
            }}
          >
            <AnimatePresence mode="popLayout">
              <motion.div
                key={`${slot}-${avatar.id}`}
                initial={{
                  // Entering avatars come in from the LEFT
                  x: slot === "left" ? "-40%" : 0,
                  scale: t.scale * 0.95,
                  opacity: 0,
                  filter: `blur(${t.blur + 6}px)`,
                }}
                animate={{
                  x: 0,
                  scale: t.scale,
                  opacity: t.opacity,
                  filter: `blur(${t.blur}px)`,
                }}
                exit={{
                  // Exiting avatars drift further RIGHT and fade
                  x: slot === "right" ? "40%" : 0,
                  scale: t.scale * 0.95,
                  opacity: 0,
                  filter: `blur(${t.blur + 6}px)`,
                }}
                transition={{
                  duration: 1.4,
                  ease: [0.22, 0.61, 0.36, 1],
                }}
                className="absolute inset-0 rounded-[36px] overflow-hidden ring-1 ring-inset ring-white/[0.04]"
                style={{
                  willChange: "transform, opacity, filter",
                  // Solid backdrop behind the image. With object-contain
                  // on the center slot, the "bars" above/below the
                  // portrait would otherwise reveal whatever is behind
                  // (side avatars, page bg). Force opaque so nothing
                  // sips through.
                  backgroundColor: "hsl(220 30% 4%)",
                }}
              >
                <img
                  src={avatar.imageUrl}
                  alt=""
                  loading="lazy"
                  draggable={false}
                  className={cn(
                    // object-cover everywhere: the focused portrait
                    // must be "completely immersive of the container",
                    // i.e. no letterbox bars; same treatment for the
                    // side slots so the whole stage feels uniform.
                    "h-full w-full select-none object-cover object-center",
                  )}
                />
                {/* Per-tile vignette — ONLY on side slots so the focused
                    avatar stays sharp + uncovered. The user explicitly
                    asked for the in-focus picture to be "really really
                    clear", so we skip every overlay on slot === "center". */}
                {slot !== "center" && (
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "radial-gradient(120% 100% at 50% 35%, transparent 35%, hsl(220 30% 3% / 0.55) 75%, hsl(220 30% 2% / 0.92) 100%)",
                    }}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        );
      })}

      {/* Side scrims — left and right gutters only, so the side
          portraits feather into the page edges without covering the
          focused center portrait. The center column (~36% wide) gets
          NO overlay; the user wants the focused avatar fully clear. */}
      <div
        className="absolute inset-y-0 left-0 w-[32%]"
        style={{
          background: `linear-gradient(90deg, hsl(220 30% 3% / ${scrimOpacity}) 0%, transparent 100%)`,
        }}
      />
      <div
        className="absolute inset-y-0 right-0 w-[32%]"
        style={{
          background: `linear-gradient(270deg, hsl(220 30% 3% / ${scrimOpacity}) 0%, transparent 100%)`,
        }}
      />
    </div>
  );
}
