/**
 * CrackOverlay — the screen-shatter moment. A white impact flash, then jagged
 * cracks draw outward from the centre (where Hoppy leans in), with a few
 * secondary fractures and an impact darkening. Plays once when mounted.
 */
import { motion } from "framer-motion";

// radial fractures from the impact point (50,50) in a 0..100 viewBox
const CRACKS = [
  "M50 50 L57 39 L54 27 L61 13 L59 0",
  "M50 50 L66 51 L80 45 L91 51 L100 47",
  "M50 50 L59 61 L57 75 L65 87 L61 100",
  "M50 50 L45 62 L35 71 L39 87 L33 100",
  "M50 50 L39 53 L23 49 L11 57 L0 53",
  "M50 50 L41 41 L29 31 L21 17 L25 2",
  "M50 50 L53 45 L71 31 L83 21 L97 9",
  "M50 50 L37 45 L19 31 L7 23 L0 13",
  // secondary branches
  "M54 27 L46 22 L40 14",
  "M80 45 L84 33 L94 28",
  "M57 75 L70 78 L78 90",
  "M35 71 L24 76 L18 88",
  "M23 49 L17 38 L6 35",
  "M71 31 L78 24 L90 22",
];

export function CrackOverlay() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-20">
      {/* impact flash */}
      <motion.div className="absolute inset-0 bg-white" initial={{ opacity: 0 }} animate={{ opacity: [0, 0.75, 0] }} transition={{ duration: 0.45, times: [0, 0.18, 1] }} />

      {/* cracks */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {CRACKS.map((d, i) => (
          <motion.path
            key={i}
            d={d}
            fill="none"
            stroke="rgba(255,255,255,0.92)"
            strokeWidth={1.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            style={{ filter: "drop-shadow(0 0 3px rgba(255,255,255,0.95)) drop-shadow(0 0 7px rgba(150,200,255,0.6))" }}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: [0, 1, 0.9] }}
            transition={{ duration: 0.4, ease: "easeOut", delay: 0.06 + i * 0.012 }}
          />
        ))}
        {/* impact core */}
        <motion.circle cx="50" cy="50" r="1.6" fill="#fff" initial={{ scale: 0, opacity: 0 }} animate={{ scale: [0, 6, 3], opacity: [1, 0.8, 0] }} transition={{ duration: 0.5 }} style={{ transformOrigin: "50px 50px" }} />
      </svg>

      {/* impact darkening */}
      <motion.div className="absolute inset-0" style={{ background: "radial-gradient(circle at 50% 50%, transparent 26%, rgba(0,0,0,0.5))" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.1 }} />
    </div>
  );
}
