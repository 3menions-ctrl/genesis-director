/**
 * StudioIntro — "THE CROSSING"
 *
 * A narrative title sequence that plays before the user enters the
 * Studio. Locked to the EnterStudio palette (deep navy void + #0A84FF
 * cobalt + champagne gold).
 *
 * The piece is structured as a STORY with a clear arc — slow open,
 * follow-along build, peak chaos, exhale, exit — rather than a wall
 * of simultaneous effects. The viewer's eye is led by a single thread
 * from the first frame to the last.
 *
 * ─────────────────────────────────────────────────────────────────────
 *                      THE STORY (7.5 seconds)
 * ─────────────────────────────────────────────────────────────────────
 *
 *   ACT I · THE HORIZON                            0.00s – 1.20s
 *     The void breathes. A single point of light ignites at the far
 *     left of the horizon and slowly TRACES a line all the way to the
 *     right. The viewer's eye follows one element. Nothing else moves.
 *
 *   ACT II · THE TOWERS                            1.20s – 2.00s
 *     Two small dots ignite on the horizon line. The left tower begins
 *     to rise, deliberate and slow. The right tower follows. Two
 *     filaments of light grow vertically out of the dark.
 *
 *   ACT III · THE ARCH                             2.00s – 2.50s
 *     Twin arches sweep in beneath the towers. The left arch first,
 *     then the right. The bridge's silhouette is now whole.
 *
 *   ACT IV · THE SKELETON                          2.50s – 3.40s
 *     Pace begins to pick up. The catenary cable arcs between the
 *     towers. The deck connects. Eighteen suspension cables cascade
 *     down. Shimmer particles race their length. The first stars begin
 *     to fill in the sky behind the bridge.
 *
 *   ACT V · THE LANTERNS                           3.40s – 3.90s
 *     Six deck lamps ignite in a quickening cascade, left to right.
 *     The pace is accelerating now. The bridge is alive.
 *
 *   ACT VI · THE PULSE                             3.90s – 4.80s   ← FAST
 *     A champagne sphere bursts from the left tower and races the
 *     deck. An anamorphic streak rides with it. The camera shakes at
 *     the impact. A warm-color grade washes the frame. This is the
 *     visual peak — the fastest movement in the entire piece.
 *
 *   ACT VII · THE WORDMARK                         4.80s – 6.80s   ← SLOW AGAIN
 *     The keystone bursts. Particles eject outward. Light beams
 *     radiate. The SMALL BRIDGES wordmark assembles letter by letter
 *     — slow, deliberate, each character takes a beat. A shine sweep
 *     passes across the finished wordmark. A hairline rule draws
 *     beneath, led by a comet sparkle. The tagline types out one
 *     character at a time.
 *
 *   ACT VIII · THE CROSSING                        6.80s – 7.50s
 *     The bridge dollies forward. An iris-out opens from the central
 *     arch. The frame washes warm-white, then deep cobalt, then hands
 *     off to the studio underneath.
 *
 * ─────────────────────────────────────────────────────────────────────
 */

import { memo, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface StudioIntroProps {
  isPlaying: boolean;
  onComplete?: () => void;
  /** Total duration in ms. Default 7500. */
  duration?: number;
}

const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];
const EASE_OUT_QUART: [number, number, number, number] = [0.25, 1, 0.5, 1];
const EASE_IN_OUT_QUART: [number, number, number, number] = [0.76, 0, 0.24, 1];

// EnterStudio palette
const C = {
  void: "hsl(220, 60%, 4%)",
  cobalt: "#0A84FF",
  cobaltSoft: "hsla(212, 100%, 60%, 0.85)",
  ice: "hsla(195, 100%, 80%, 0.92)",
  champagne: "hsl(40, 100%, 78%)",
  champagneCore: "hsl(48, 100%, 92%)",
};

// ─────────────────────────────────────────────────────────────────────
// CENTRALIZED TIMING — every animation in the piece references these.
// Edit one number, the entire sequence re-times around it.
// All values in seconds, absolute from t=0.
// ─────────────────────────────────────────────────────────────────────
const T = {
  TOTAL: 7.5,

  // ACT I — slow open
  HORIZON_START:       0.30,
  HORIZON_DUR:         0.90,   // slow, deliberate single-line trace
  AMBIENCE_FADE_START: 0.10,   // mountains/aurora fade up subtly

  // ACT II — towers
  TOWER1_START:        1.20,
  TOWER1_DUR:          0.55,
  TOWER2_START:        1.40,
  TOWER2_DUR:          0.55,
  TOWER_CAPS:          1.90,

  // ACT III — arches
  ARCH1_START:         2.00,
  ARCH1_DUR:           0.42,
  ARCH2_START:         2.15,
  ARCH2_DUR:           0.42,

  // ACT IV — skeleton (pace picks up)
  CATENARY_START:      2.55,
  CATENARY_DUR:        0.35,
  DECK_START:          2.65,
  DECK_DUR:            0.32,
  CABLE_START:         2.95,
  CABLE_DUR:           0.50,
  CABLE_STAGGER:       0.022,
  CABLE_SHIMMER_START: 3.20,
  CABLE_SHIMMER_DUR:   0.55,
  CABLE_SHIMMER_STAGGER: 0.025,
  STARS_START:         3.00,
  STARS_BASE_DUR:      1.10,
  STARS_DELAY_RANGE:   1.10,  // jitter window for star reveal stagger

  // ACT V — lanterns (faster cascade)
  LAMP_START:          3.40,
  LAMP_STAGGER:        0.075,
  LAMP_DUR:            0.40,

  // ACT VI — THE PULSE (climax / peak speed)
  PULSE_START:         3.90,
  PULSE_DUR:           0.85,
  ANAMORPHIC_START:    3.95,
  ANAMORPHIC_DUR:      1.00,
  WARM_GRADE_START:    4.05,
  WARM_GRADE_DUR:      0.95,
  CAMERA_SHAKE_START_T: 0.575,  // as % of TOTAL — shake hits at pulse impact
  CAMERA_SHAKE_END_T:   0.665,
  BOKEH_START:         4.20,
  BOKEH_DUR:           3.00,

  // ACT VII — WORDMARK (slow back down)
  KEYSTONE_BURST_START: 4.60,
  KEYSTONE_BURST_DUR:   1.30,
  LETTER_START:         4.80,
  LETTER_DUR:           0.95,
  LETTER_STAGGER:       0.105,  // deliberate cascade, ~1.37s span for "Small Bridges"
  LIGHT_BEAMS_START:    5.30,
  LIGHT_BEAMS_DUR:      2.20,
  LIGHT_BEAMS_STAGGER:  0.07,
  SHINE_START:          6.20,
  SHINE_DUR:            1.35,
  HAIRLINE_START:       6.30,
  HAIRLINE_DUR:         0.85,
  SPARKLE_START:        6.25,
  SPARKLE_DUR:          0.95,
  TAGLINE_START:        6.45,
  TAGLINE_STAGGER:      0.034,
  TAGLINE_CHAR_DUR:     0.06,

  // ACT VIII — crossing / exit
  IRIS_START:           6.80,
  IRIS_DUR:             0.55,
  WASH_START:           7.05,
  WASH_DUR:             0.40,
  BRIDGE_DOLLY_END:     0.91,   // as % of TOTAL — bridge starts dollying out
};

// Bridge geometry (SVG viewBox)
const VB_W = 1200;
const VB_H = 700;
const TOWER1 = { x: 240, topY: 130, baseY: 430 };
const TOWER2 = { x: 960, topY: 130, baseY: 430 };
const DECK_Y = 380;
const KEYSTONE_X = 600;
const ARCH_PEAK_Y = 305;
const HORIZON_Y = DECK_Y + 50;

const CABLES = (() => {
  const out: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    out.push({ x1: TOWER1.x, y1: TOWER1.topY, x2: TOWER1.x + (KEYSTONE_X - TOWER1.x) * t, y2: DECK_Y });
  }
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    out.push({ x1: TOWER2.x, y1: TOWER2.topY, x2: TOWER2.x - (TOWER2.x - KEYSTONE_X) * t, y2: DECK_Y });
  }
  return out;
})();

const LAMPS = [290, 430, 570, 630, 770, 910];

const WORDMARK = "Small Bridges".split("");

// ─────────────────────────────────────────────────────────────────────

export const StudioIntro = memo(function StudioIntro({
  isPlaying,
  onComplete,
  duration = 7500,
}: StudioIntroProps) {
  const [mounted, setMounted] = useState(isPlaying);

  const stars = useMemo(() => makeStars(220), []);
  const bokeh = useMemo(() => makeBokeh(20), []);
  const burstParticles = useMemo(() => makeBurstParticles(140), []);
  const lightBeams = useMemo(() => makeLightBeams(7), []);

  useEffect(() => {
    if (isPlaying) {
      setMounted(true);
      const t = window.setTimeout(() => {
        onComplete?.();
        window.setTimeout(() => setMounted(false), 700);
      }, duration);
      return () => window.clearTimeout(t);
    }
  }, [isPlaying, duration, onComplete]);

  // ── Camera shake timeline — only active around the pulse impact ──
  // We compute the exact times as a fraction of T.TOTAL so they remain
  // strictly monotonic when the constants are tuned.
  const shakeWindow = {
    start: T.CAMERA_SHAKE_START_T,
    p1: T.CAMERA_SHAKE_START_T + 0.012,
    p2: T.CAMERA_SHAKE_START_T + 0.025,
    p3: T.CAMERA_SHAKE_START_T + 0.038,
    p4: T.CAMERA_SHAKE_START_T + 0.054,
    p5: T.CAMERA_SHAKE_START_T + 0.072,
    end: T.CAMERA_SHAKE_END_T,
  };

  return (
    <AnimatePresence>
      {mounted && isPlaying && (
        <motion.div
          key="studio-intro"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.65, ease: EASE_OUT_EXPO } }}
          className="fixed inset-0 z-[10000] overflow-hidden select-none"
          style={{ backgroundColor: C.void }}
          aria-hidden
        >
          {/* ═══ Camera shake wrapper ═══
              Holds still through Acts I–V, jitters briefly at the pulse
              impact, then settles for the wordmark act. */}
          <motion.div
            className="absolute inset-0"
            initial={{ x: 0, y: 0 }}
            animate={{
              x: [0, 0, -3, 2, -2, 1, 0, 0],
              y: [0, 0,  2, -1, 2, -1, 0, 0],
            }}
            transition={{
              duration: T.TOTAL,
              times: [
                0,
                shakeWindow.start,
                shakeWindow.p1,
                shakeWindow.p2,
                shakeWindow.p3,
                shakeWindow.p4,
                shakeWindow.end,
                1,
              ],
            }}
          >
            {/* ═══════════════════════════════════════════════════════
                ACT I — THE VOID + THE HORIZON
                Slow open. One line traces across the screen.
                ═══════════════════════════════════════════════════════ */}

            {/* Base navy gradient — always on */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(80% 90% at 50% 50%, hsl(220, 50%, 8%) 0%, hsl(220, 60%, 4%) 50%, hsl(220, 70%, 2%) 100%)",
              }}
            />

            {/* Slow aurora — fades up subtly from t=0, never dominates */}
            <motion.div
              className="absolute -inset-[15%] pointer-events-none"
              style={{
                background:
                  "conic-gradient(from 0deg at 50% 50%, transparent 0deg, hsla(212,100%,55%,0.18) 70deg, transparent 150deg, hsla(195,100%,55%,0.12) 240deg, transparent 320deg, hsla(230,100%,60%,0.15) 360deg)",
                filter: "blur(120px)",
                mixBlendMode: "screen",
              }}
              initial={{ rotate: -25, opacity: 0 }}
              animate={{ rotate: 25, opacity: 0.65 }}
              transition={{ duration: T.TOTAL, ease: "linear" }}
            />

            {/* Mountain silhouettes — subtle depth, gradual reveal */}
            <Mountains totalDuration={T.TOTAL} />

            {/* ── THE HORIZON LINE — THE FIRST ELEMENT ─────────────
                Lit point at the far-left horizon ignites first, then
                pulls a single luminous filament all the way to the far
                right. Nothing else moves in the viewport during this
                beat. The viewer's eye is captive. */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <svg
                viewBox={`0 0 ${VB_W} ${VB_H}`}
                preserveAspectRatio="xMidYMid meet"
                style={{ width: "min(98vw, 1300px)", height: "auto", overflow: "visible" }}
              >
                {/* The seed point — appears first, glowing */}
                <motion.circle
                  cx={0} cy={HORIZON_Y} r={6}
                  fill="white"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: [0, 1, 1, 0], scale: [0, 1, 1, 0] }}
                  transition={{
                    duration: T.HORIZON_DUR + 0.15,
                    delay: T.HORIZON_START,
                    times: [0, 0.15, 0.85, 1],
                    ease: EASE_OUT_EXPO,
                  }}
                  style={{ filter: `drop-shadow(0 0 8px white) drop-shadow(0 0 24px ${C.cobalt})` }}
                />
                {/* The horizon line itself — drawn left → right */}
                <motion.line
                  x1={0} y1={HORIZON_Y} x2={VB_W} y2={HORIZON_Y}
                  stroke={C.ice}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  style={{ filter: `drop-shadow(0 0 4px ${C.cobalt}) drop-shadow(0 0 12px hsla(212, 100%, 55%, 0.6))` }}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: T.HORIZON_DUR, delay: T.HORIZON_START, ease: [0.45, 0, 0.55, 1] }}
                />
                {/* A bright dot rides the leading edge of the line */}
                <motion.circle
                  cx={0} cy={HORIZON_Y} r={4}
                  fill="white"
                  initial={{ cx: 0, opacity: 0 }}
                  animate={{ cx: VB_W, opacity: [0, 1, 1, 0] }}
                  transition={{
                    duration: T.HORIZON_DUR,
                    delay: T.HORIZON_START,
                    times: [0, 0.05, 0.92, 1],
                    ease: [0.45, 0, 0.55, 1],
                  }}
                  style={{ filter: `drop-shadow(0 0 6px white) drop-shadow(0 0 18px ${C.cobalt})` }}
                />
              </svg>
            </div>

            {/* ═══════════════════════════════════════════════════════
                ACT II – V — THE BRIDGE BUILD
                One element at a time, accelerating into the climax.
                ═══════════════════════════════════════════════════════ */}
            <motion.div
              className="absolute inset-0 pointer-events-none flex items-center justify-center"
              initial={{ scale: 0.88, opacity: 0 }}
              animate={{
                scale:   [0.88, 0.93, 0.97, 1.00, 1.00, 1.65],
                opacity: [0,    1,    1,    1,    1,    0],
              }}
              transition={{
                duration: T.TOTAL,
                times: [
                  0,
                  T.TOWER1_START / T.TOTAL,
                  T.CABLE_START  / T.TOTAL,
                  T.LAMP_START   / T.TOTAL,
                  T.BRIDGE_DOLLY_END,
                  1,
                ],
                ease: EASE_OUT_QUART,
              }}
            >
              <svg
                viewBox={`0 0 ${VB_W} ${VB_H}`}
                preserveAspectRatio="xMidYMid meet"
                style={{ width: "min(98vw, 1300px)", height: "auto", overflow: "visible" }}
              >
                <defs>
                  <linearGradient id="bg-tower" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={C.ice} />
                    <stop offset="0.55" stopColor={C.cobalt} />
                    <stop offset="1" stopColor="hsla(212, 100%, 35%, 0.7)" />
                  </linearGradient>
                  <linearGradient id="bg-deck" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stopColor="hsla(212, 100%, 60%, 0.3)" />
                    <stop offset="0.5" stopColor="hsla(195, 100%, 80%, 0.95)" />
                    <stop offset="1" stopColor="hsla(212, 100%, 60%, 0.3)" />
                  </linearGradient>
                  <linearGradient id="bg-arch" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0" stopColor="hsla(212, 100%, 55%, 0.9)" />
                    <stop offset="1" stopColor="hsla(195, 100%, 75%, 0.95)" />
                  </linearGradient>
                  <linearGradient id="bg-cable" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="hsla(195, 100%, 80%, 0.9)" />
                    <stop offset="1" stopColor="hsla(212, 100%, 60%, 0.35)" />
                  </linearGradient>
                  <radialGradient id="bg-godray" cx="0.5" cy="0" r="1">
                    <stop offset="0" stopColor="hsla(195, 100%, 80%, 0.7)" />
                    <stop offset="0.5" stopColor="hsla(212, 100%, 60%, 0.25)" />
                    <stop offset="1" stopColor="transparent" />
                  </radialGradient>
                  <filter id="bg-glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="2.5" result="b" />
                    <feMerge>
                      <feMergeNode in="b" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <filter id="bg-glow-strong" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="6" result="b" />
                    <feMerge>
                      <feMergeNode in="b" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* God-ray light shafts from each tower top (Act V) */}
                <motion.ellipse
                  cx={TOWER1.x} cy={0} rx={70} ry={400}
                  fill="url(#bg-godray)" opacity={0.7}
                  initial={{ opacity: 0, scaleY: 0 }}
                  animate={{ opacity: 0.55, scaleY: 1 }}
                  transition={{ duration: 0.9, delay: T.LAMP_START, ease: EASE_OUT_EXPO }}
                  style={{ transformOrigin: `${TOWER1.x}px 0px` }}
                />
                <motion.ellipse
                  cx={TOWER2.x} cy={0} rx={70} ry={400}
                  fill="url(#bg-godray)" opacity={0.7}
                  initial={{ opacity: 0, scaleY: 0 }}
                  animate={{ opacity: 0.55, scaleY: 1 }}
                  transition={{ duration: 0.9, delay: T.LAMP_START + 0.05, ease: EASE_OUT_EXPO }}
                  style={{ transformOrigin: `${TOWER2.x}px 0px` }}
                />

                {/* ── ACT II · TOWERS — small base sparks, then rising filaments ── */}
                <motion.circle
                  cx={TOWER1.x} cy={TOWER1.baseY} r={4} fill="white"
                  filter="url(#bg-glow-strong)"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: [0, 1, 1, 0.3], scale: [0, 1.2, 1, 1] }}
                  transition={{ duration: 0.5, delay: T.TOWER1_START - 0.15, times: [0, 0.25, 0.6, 1], ease: EASE_OUT_EXPO }}
                />
                <motion.circle
                  cx={TOWER2.x} cy={TOWER2.baseY} r={4} fill="white"
                  filter="url(#bg-glow-strong)"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: [0, 1, 1, 0.3], scale: [0, 1.2, 1, 1] }}
                  transition={{ duration: 0.5, delay: T.TOWER2_START - 0.15, times: [0, 0.25, 0.6, 1], ease: EASE_OUT_EXPO }}
                />
                <motion.line
                  x1={TOWER1.x} y1={TOWER1.baseY} x2={TOWER1.x} y2={TOWER1.topY}
                  stroke="url(#bg-tower)" strokeWidth="4.5" strokeLinecap="round"
                  fill="none" filter="url(#bg-glow)"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: T.TOWER1_DUR, delay: T.TOWER1_START, ease: EASE_OUT_EXPO }}
                />
                <motion.line
                  x1={TOWER2.x} y1={TOWER2.baseY} x2={TOWER2.x} y2={TOWER2.topY}
                  stroke="url(#bg-tower)" strokeWidth="4.5" strokeLinecap="round"
                  fill="none" filter="url(#bg-glow)"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: T.TOWER2_DUR, delay: T.TOWER2_START, ease: EASE_OUT_EXPO }}
                />
                <motion.circle
                  cx={TOWER1.x} cy={TOWER1.topY} r={5} fill="white"
                  filter="url(#bg-glow-strong)"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: T.TOWER_CAPS }}
                />
                <motion.circle
                  cx={TOWER2.x} cy={TOWER2.topY} r={5} fill="white"
                  filter="url(#bg-glow-strong)"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: T.TOWER_CAPS + 0.05 }}
                />

                {/* ── ACT III · ARCHES ── */}
                <motion.path
                  d={`M ${TOWER1.x} ${HORIZON_Y} Q ${(TOWER1.x + KEYSTONE_X) / 2} ${ARCH_PEAK_Y} ${KEYSTONE_X} ${HORIZON_Y}`}
                  stroke="url(#bg-arch)" strokeWidth="3.5" strokeLinecap="round"
                  fill="none" filter="url(#bg-glow)"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: T.ARCH1_DUR, delay: T.ARCH1_START, ease: EASE_OUT_EXPO }}
                />
                <motion.path
                  d={`M ${KEYSTONE_X} ${HORIZON_Y} Q ${(KEYSTONE_X + TOWER2.x) / 2} ${ARCH_PEAK_Y} ${TOWER2.x} ${HORIZON_Y}`}
                  stroke="url(#bg-arch)" strokeWidth="3.5" strokeLinecap="round"
                  fill="none" filter="url(#bg-glow)"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: T.ARCH2_DUR, delay: T.ARCH2_START, ease: EASE_OUT_EXPO }}
                />

                {/* ── ACT IV · CATENARY + DECK + CABLES ── */}
                <motion.path
                  d={`M ${TOWER1.x} ${TOWER1.topY} Q ${KEYSTONE_X} ${TOWER1.topY + 75} ${TOWER2.x} ${TOWER2.topY}`}
                  stroke="url(#bg-cable)" strokeWidth="2.5" fill="none" filter="url(#bg-glow)"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: T.CATENARY_DUR, delay: T.CATENARY_START, ease: EASE_OUT_EXPO }}
                />
                <motion.line
                  x1={TOWER1.x} y1={DECK_Y} x2={TOWER2.x} y2={DECK_Y}
                  stroke="url(#bg-deck)" strokeWidth="4" strokeLinecap="round"
                  filter="url(#bg-glow)"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: T.DECK_DUR, delay: T.DECK_START, ease: EASE_OUT_EXPO }}
                />
                {CABLES.map((c, i) => (
                  <motion.line
                    key={`cab-${i}`}
                    x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2}
                    stroke="url(#bg-cable)" strokeWidth="1.2" strokeLinecap="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 0.85 }}
                    transition={{
                      duration: T.CABLE_DUR,
                      delay: T.CABLE_START + (i % 9) * T.CABLE_STAGGER,
                      ease: EASE_OUT_EXPO,
                    }}
                  />
                ))}
                {CABLES.map((c, i) => (
                  <motion.circle
                    key={`shim-${i}`}
                    cx={c.x1} cy={c.y1} r={2.2}
                    fill="white" filter="url(#bg-glow-strong)"
                    initial={{ cx: c.x1, cy: c.y1, opacity: 0 }}
                    animate={{ cx: c.x2, cy: c.y2, opacity: [0, 1, 1, 0] }}
                    transition={{
                      duration: T.CABLE_SHIMMER_DUR,
                      delay: T.CABLE_SHIMMER_START + (i % 9) * T.CABLE_SHIMMER_STAGGER,
                      times: [0, 0.15, 0.85, 1],
                      ease: EASE_OUT_QUART,
                    }}
                  />
                ))}

                {/* ── ACT V · LANTERNS ── */}
                {LAMPS.map((x, i) => (
                  <g key={`lamp-${i}`}>
                    <motion.circle
                      cx={x} cy={DECK_Y - 6} r={22}
                      fill="hsla(48, 100%, 75%, 0.55)" filter="url(#bg-glow-strong)"
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 0.85, scale: 1 }}
                      transition={{ duration: T.LAMP_DUR, delay: T.LAMP_START + i * T.LAMP_STAGGER, ease: EASE_OUT_EXPO }}
                    />
                    <motion.circle
                      cx={x} cy={DECK_Y - 6} r={3} fill={C.champagneCore}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ duration: 0.25, delay: T.LAMP_START + i * T.LAMP_STAGGER + 0.05 }}
                    />
                  </g>
                ))}

                {/* ── ACT VI · THE PULSE — champagne sphere + comet tail ── */}
                <motion.circle
                  cx={TOWER1.x} cy={DECK_Y} r={20}
                  fill={C.champagneCore} filter="url(#bg-glow-strong)"
                  initial={{ opacity: 0, cx: TOWER1.x }}
                  animate={{ opacity: [0, 1, 1, 0], cx: [TOWER1.x, TOWER1.x, TOWER2.x, TOWER2.x] }}
                  transition={{ duration: T.PULSE_DUR, delay: T.PULSE_START, times: [0, 0.05, 0.85, 1], ease: EASE_OUT_QUART }}
                />
                <motion.circle
                  cx={TOWER1.x - 50} cy={DECK_Y} r={11}
                  fill="hsla(40, 100%, 80%, 0.75)" filter="url(#bg-glow)"
                  initial={{ opacity: 0, cx: TOWER1.x - 50 }}
                  animate={{ opacity: [0, 0.7, 0.7, 0], cx: [TOWER1.x - 50, TOWER1.x - 50, TOWER2.x - 50, TOWER2.x - 50] }}
                  transition={{ duration: T.PULSE_DUR, delay: T.PULSE_START, times: [0, 0.05, 0.85, 1], ease: EASE_OUT_QUART }}
                />
                <motion.circle
                  cx={TOWER1.x - 95} cy={DECK_Y} r={6}
                  fill="hsla(40, 100%, 80%, 0.4)" filter="url(#bg-glow)"
                  initial={{ opacity: 0, cx: TOWER1.x - 95 }}
                  animate={{ opacity: [0, 0.5, 0.5, 0], cx: [TOWER1.x - 95, TOWER1.x - 95, TOWER2.x - 95, TOWER2.x - 95] }}
                  transition={{ duration: T.PULSE_DUR, delay: T.PULSE_START, times: [0, 0.05, 0.85, 1], ease: EASE_OUT_QUART }}
                />
              </svg>
            </motion.div>

            {/* ─── STARS · fill the sky during the cable + lamp acts ─── */}
            <div className="absolute inset-0 pointer-events-none">
              {stars.map((s, i) => (
                <motion.span
                  key={`star-${i}`}
                  className="absolute rounded-full"
                  style={{
                    left: `${s.x}%`,
                    top: `${s.y}%`,
                    width: s.size,
                    height: s.size,
                    background: s.warm ? C.champagneCore : C.ice,
                    boxShadow: `0 0 ${s.size * 3}px ${s.warm ? C.champagne : C.cobaltSoft}`,
                  }}
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={{ opacity: s.brightness, scale: 1 }}
                  transition={{
                    duration: T.STARS_BASE_DUR,
                    delay: T.STARS_START + s.delay * T.STARS_DELAY_RANGE,
                    ease: EASE_OUT_EXPO,
                  }}
                />
              ))}
            </div>

            {/* ─── BOKEH DUST — drifts in only at the climax ─── */}
            <div className="absolute inset-0 pointer-events-none">
              {bokeh.map((b, i) => (
                <motion.span
                  key={`bokeh-${i}`}
                  className="absolute rounded-full"
                  style={{
                    left: `${b.x}%`,
                    top: `${b.y}%`,
                    width: b.size,
                    height: b.size,
                    background: "hsla(195, 100%, 80%, 0.55)",
                    boxShadow: `0 0 ${b.size * 1.5}px hsla(212, 100%, 70%, 0.7)`,
                    filter: "blur(3px)",
                    mixBlendMode: "screen",
                  }}
                  initial={{ opacity: 0, x: 0 }}
                  animate={{ opacity: [0, 0.5, 0.55, 0], x: [0, b.drift, b.drift * 1.6, b.drift * 2.2] }}
                  transition={{
                    duration: T.BOKEH_DUR,
                    delay: T.BOKEH_START + b.delay,
                    times: [0, 0.2, 0.7, 1],
                    ease: "easeOut",
                  }}
                />
              ))}
            </div>

            {/* ─── ANAMORPHIC LENS STREAK — rides with the pulse ─── */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              initial={{ opacity: 0, x: "-120%" }}
              animate={{ opacity: [0, 0.95, 0.95, 0], x: ["-120%", "0%", "120%", "120%"] }}
              transition={{
                duration: T.ANAMORPHIC_DUR,
                delay: T.ANAMORPHIC_START,
                times: [0, 0.3, 0.85, 1],
                ease: EASE_OUT_QUART,
              }}
            >
              <div
                className="absolute"
                style={{
                  top: "53%",
                  left: 0, right: 0, height: 5,
                  background: `linear-gradient(90deg, transparent 0%, ${C.champagneCore} 40%, white 50%, ${C.champagneCore} 60%, transparent 100%)`,
                  filter: "blur(1.4px)",
                  boxShadow: `0 0 24px 6px ${C.champagne}, 0 0 80px 18px hsla(40, 100%, 65%, 0.6)`,
                }}
              />
              <div
                className="absolute"
                style={{
                  left: "50%", top: 0, bottom: 0, width: 40, marginLeft: -20,
                  background: "linear-gradient(180deg, transparent 0%, hsla(40, 100%, 65%, 0.18) 40%, hsla(40, 100%, 75%, 0.32) 53%, hsla(40, 100%, 65%, 0.18) 60%, transparent 100%)",
                  filter: "blur(8px)",
                }}
              />
            </motion.div>

            {/* ─── WARM COLOR GRADING — washes during pulse ─── */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "radial-gradient(60% 50% at 50% 55%, hsla(40, 100%, 60%, 0.16) 0%, transparent 70%)",
                mixBlendMode: "screen",
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.9, 0] }}
              transition={{ duration: T.WARM_GRADE_DUR, delay: T.WARM_GRADE_START, times: [0, 0.45, 1], ease: EASE_IN_OUT_QUART }}
            />

            {/* ═══════════════════════════════════════════════════════
                ACT VII — THE WORDMARK
                Slow back down. Letter-by-letter assembly with halo,
                shine, hairline, sparkle, tagline.
                ═══════════════════════════════════════════════════════ */}

            {/* Keystone burst particles */}
            <div className="absolute inset-0 pointer-events-none">
              {burstParticles.map((p, i) => (
                <motion.span
                  key={`burst-${i}`}
                  className="absolute rounded-full"
                  style={{
                    left: "50%",
                    top: "55%",
                    width: p.size,
                    height: p.size,
                    background: C.champagneCore,
                    boxShadow: `0 0 ${p.size * 4}px ${C.champagne}`,
                    marginLeft: -p.size / 2,
                    marginTop: -p.size / 2,
                    mixBlendMode: "screen",
                  }}
                  initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
                  animate={{ opacity: [0, 1, 0], x: [0, p.toX], y: [0, p.toY], scale: [0, 1, 0.4] }}
                  transition={{ duration: T.KEYSTONE_BURST_DUR, delay: T.KEYSTONE_BURST_START + p.delay, ease: EASE_OUT_QUART }}
                />
              ))}
            </div>

            {/* Radiant light beams from wordmark center */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center" style={{ marginTop: "-5%" }}>
              {lightBeams.map((angle, i) => (
                <motion.div
                  key={`beam-${i}`}
                  className="absolute"
                  style={{
                    width: 2,
                    height: "120vh",
                    background: "linear-gradient(180deg, transparent 0%, hsla(195, 100%, 80%, 0.45) 50%, transparent 100%)",
                    filter: "blur(2px)",
                    transformOrigin: "center center",
                    transform: `rotate(${angle}deg)`,
                  }}
                  initial={{ opacity: 0, scaleY: 0 }}
                  animate={{ opacity: [0, 0.7, 0.5, 0], scaleY: [0, 1, 1, 1] }}
                  transition={{
                    duration: T.LIGHT_BEAMS_DUR,
                    delay: T.LIGHT_BEAMS_START + i * T.LIGHT_BEAMS_STAGGER,
                    times: [0, 0.25, 0.7, 1],
                    ease: EASE_OUT_QUART,
                  }}
                />
              ))}
            </div>

            {/* Wordmark + hairline + tagline */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="relative" style={{ marginTop: "5%" }}>
                <span
                  aria-hidden
                  className="absolute inset-0 -m-16 pointer-events-none"
                  style={{
                    background:
                      "radial-gradient(ellipse at center, hsla(212,100%,60%,0.35) 0%, transparent 60%)",
                    filter: "blur(28px)",
                  }}
                />
                <div
                  className="relative leading-none tracking-[-0.025em] text-center"
                  style={{
                    fontFamily: "'Fraunces', 'Times New Roman', serif",
                    fontWeight: 300,
                    fontStyle: "italic",
                    fontSize: "clamp(56px, 9.5vw, 140px)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {WORDMARK.map((ch, i) => (
                    <motion.span
                      key={`ch-${i}`}
                      style={{
                        display: "inline-block",
                        background: `linear-gradient(180deg, ${C.champagneCore} 0%, ${C.champagne} 30%, ${C.ice} 65%, ${C.cobalt} 100%)`,
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                        color: "transparent",
                        textShadow: "0 0 60px hsla(212, 100%, 60%, 0.35), 0 0 120px hsla(40, 100%, 65%, 0.20)",
                      }}
                      initial={{ opacity: 0, y: 30, filter: "blur(14px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      transition={{ duration: T.LETTER_DUR, delay: T.LETTER_START + i * T.LETTER_STAGGER, ease: EASE_OUT_QUART }}
                    >
                      {ch === " " ? " " : ch}
                    </motion.span>
                  ))}
                  <motion.span
                    aria-hidden
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background:
                        "linear-gradient(105deg, transparent 35%, hsla(0,0%,100%,0.85) 50%, transparent 65%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                      color: "transparent",
                      mixBlendMode: "screen",
                    }}
                    initial={{ x: "-110%" }}
                    animate={{ x: "110%" }}
                    transition={{ duration: T.SHINE_DUR, delay: T.SHINE_START, ease: EASE_OUT_QUART }}
                  >
                    {WORDMARK.join("")}
                  </motion.span>
                </div>
              </div>

              {/* Hairline rule + leading sparkle */}
              <div className="relative mt-7" style={{ width: "min(38vw, 380px)" }}>
                <motion.div
                  style={{
                    height: 1,
                    background: `linear-gradient(90deg, transparent 0%, ${C.ice} 50%, transparent 100%)`,
                    boxShadow: `0 0 12px ${C.cobaltSoft}`,
                  }}
                  initial={{ scaleX: 0, opacity: 0 }}
                  animate={{ scaleX: 1, opacity: 1 }}
                  transition={{ duration: T.HAIRLINE_DUR, delay: T.HAIRLINE_START, ease: EASE_OUT_EXPO }}
                />
                <motion.span
                  className="absolute top-1/2 -translate-y-1/2"
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "white",
                    boxShadow: `0 0 14px white, 0 0 32px ${C.champagne}`,
                  }}
                  initial={{ opacity: 0, left: "0%" }}
                  animate={{ opacity: [0, 1, 1, 0], left: ["0%", "0%", "100%", "100%"] }}
                  transition={{ duration: T.SPARKLE_DUR, delay: T.SPARKLE_START, times: [0, 0.1, 0.85, 1], ease: EASE_OUT_QUART }}
                />
              </div>

              <Tagline taglineStart={T.TAGLINE_START} stagger={T.TAGLINE_STAGGER} charDur={T.TAGLINE_CHAR_DUR} />
            </div>

            {/* ═══════════════════════════════════════════════════════
                ACT VIII — THE CROSSING + EXHALE
                Iris-out + final wash. Hand off to /studio.
                ═══════════════════════════════════════════════════════ */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  `radial-gradient(circle at 50% 55%, transparent 0%, transparent 25%, hsla(212, 100%, 65%, 0.85) 50%, ${C.void} 110%)`,
                mixBlendMode: "screen",
              }}
              initial={{ opacity: 0, scale: 0.55 }}
              animate={{ opacity: 0.95, scale: 2.6 }}
              transition={{ duration: T.IRIS_DUR, delay: T.IRIS_START, ease: EASE_OUT_QUART }}
            />
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  `radial-gradient(circle at 50% 55%, hsla(212, 100%, 70%, 0.95) 0%, hsla(212, 100%, 50%, 0.6) 40%, ${C.void} 100%)`,
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: T.WASH_DUR, delay: T.WASH_START, ease: EASE_OUT_QUART }}
            />

            {/* Grain + scanlines + vignette */}
            <div
              className="absolute inset-0 pointer-events-none opacity-[0.05] mix-blend-overlay"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.9'/></svg>\")",
              }}
            />
            <div
              className="absolute inset-0 pointer-events-none opacity-[0.035]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, transparent 0px, transparent 2px, hsla(215,100%,80%,0.6) 2px, hsla(215,100%,80%,0.6) 3px)",
              }}
            />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse at center, transparent 35%, hsla(220, 60%, 0.5%, 0.55) 75%, hsla(220, 70%, 0.5%, 0.95) 100%)",
              }}
            />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse at 49% 50%, transparent 70%, hsla(15, 100%, 50%, 0.07) 100%)," +
                  "radial-gradient(ellipse at 51% 50%, transparent 70%, hsla(195, 100%, 60%, 0.07) 100%)",
                mixBlendMode: "screen",
              }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

// ─────────────────────────────────────────────────────────────────────
// SUBCOMPONENTS
// ─────────────────────────────────────────────────────────────────────

function Mountains({ totalDuration }: { totalDuration: number }) {
  return (
    <div className="absolute inset-x-0 pointer-events-none" style={{ top: "40%", bottom: 0 }}>
      <motion.svg
        viewBox="0 0 1600 400"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
        initial={{ opacity: 0, x: 0 }}
        animate={{ opacity: 0.4, x: -12 }}
        transition={{ duration: totalDuration, ease: "linear" }}
      >
        <path
          d="M 0 280 L 100 240 L 220 260 L 340 200 L 480 240 L 620 190 L 760 230 L 900 195 L 1040 235 L 1180 210 L 1320 250 L 1460 215 L 1600 245 L 1600 400 L 0 400 Z"
          fill="hsla(220, 55%, 10%, 1)"
        />
      </motion.svg>
      <motion.svg
        viewBox="0 0 1600 400"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
        initial={{ opacity: 0, x: 0 }}
        animate={{ opacity: 0.6, x: -22 }}
        transition={{ duration: totalDuration, ease: "linear" }}
      >
        <path
          d="M 0 320 L 120 290 L 260 310 L 380 260 L 520 300 L 660 250 L 800 290 L 940 255 L 1080 295 L 1220 265 L 1360 305 L 1500 270 L 1600 295 L 1600 400 L 0 400 Z"
          fill="hsla(220, 60%, 6%, 1)"
        />
      </motion.svg>
      <motion.svg
        viewBox="0 0 1600 400"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
        initial={{ opacity: 0, x: 0 }}
        animate={{ opacity: 0.75, x: -32 }}
        transition={{ duration: totalDuration, ease: "linear" }}
      >
        <path
          d="M 0 360 L 140 340 L 300 355 L 440 320 L 580 350 L 720 315 L 880 345 L 1040 320 L 1200 350 L 1340 325 L 1480 350 L 1600 340 L 1600 400 L 0 400 Z"
          fill="hsla(220, 70%, 3%, 1)"
        />
      </motion.svg>
    </div>
  );
}

function Tagline({ taglineStart, stagger, charDur }: { taglineStart: number; stagger: number; charDur: number }) {
  const text = "Est. MMXXVI · Built to cross";
  const chars = text.split("");
  return (
    <div
      className="mt-5 font-mono uppercase"
      style={{
        fontSize: "clamp(10px, 1vw, 13px)",
        letterSpacing: "0.48em",
        color: "hsla(212,80%,82%,0.92)",
        textShadow: "0 0 8px hsla(212, 100%, 60%, 0.5)",
      }}
    >
      {chars.map((ch, i) => (
        <motion.span
          key={`tg-${i}`}
          style={{ display: "inline-block" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: charDur, delay: taglineStart + i * stagger, ease: "linear" }}
        >
          {ch === " " ? " " : ch}
        </motion.span>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// SEED HELPERS
// ─────────────────────────────────────────────────────────────────────

interface Star { x: number; y: number; size: number; delay: number; brightness: number; warm: boolean; }
function makeStars(count: number): Star[] {
  const out: Star[] = [];
  for (let i = 0; i < count; i++) {
    const seed = (i * 9301 + 49297) % 233280;
    const r = seed / 233280;
    const r2 = ((seed * 0.137) % 1);
    const r3 = ((seed * 0.293) % 1);
    out.push({
      x: r * 100,
      y: r2 * 65,
      size: 0.6 + r3 * 1.8,
      delay: r3,
      brightness: 0.45 + r3 * 0.55,
      warm: r3 < 0.2,
    });
  }
  return out;
}

interface Bokeh { x: number; y: number; size: number; drift: number; delay: number; }
function makeBokeh(count: number): Bokeh[] {
  const out: Bokeh[] = [];
  for (let i = 0; i < count; i++) {
    const seed = (i * 7741 + 91) % 233280;
    const r = seed / 233280;
    const r2 = ((seed * 0.617) % 1);
    out.push({
      x: r * 100,
      y: 40 + r2 * 50,
      size: 6 + r2 * 14,
      drift: (r - 0.5) * 240,
      delay: r2 * 0.7,
    });
  }
  return out;
}

interface Burst { toX: number; toY: number; size: number; delay: number; }
function makeBurstParticles(count: number): Burst[] {
  const out: Burst[] = [];
  const w = typeof window !== "undefined" ? window.innerWidth : 1200;
  for (let i = 0; i < count; i++) {
    const seed = (i * 4513 + 19) % 233280;
    const r = seed / 233280;
    const r2 = ((seed * 0.531) % 1);
    out.push({
      toX: (r - 0.5) * w * 0.6,
      toY: -(40 + r2 * 100),
      size: 1.2 + r2 * 2.4,
      delay: r2 * 0.2,
    });
  }
  return out;
}

function makeLightBeams(count: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    out.push((i * 180) / count - 90);
  }
  return out;
}
