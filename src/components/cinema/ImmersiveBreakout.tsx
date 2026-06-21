/**
 * ImmersiveBreakout — tour-page-only effect.
 *
 * Detective Rook takes over the whole page as a fixed, full-bleed background, as
 * if he has burst out of the post and is now behind the entire app. It sits
 * ABOVE the static PageBackdrop (-z-10) and BEHIND the transparent content
 * (-z-[5]) and crossfades with `active`.
 *
 * PERFECT SYNC, NO GLITCH: it does NOT play a second video. There is ONE playing
 * video — the gallery tile (tileRef). This component mirrors that tile onto a
 * <canvas>, drawing the tile's CURRENT frame every animation frame. Because it
 * paints the exact frame the tile is showing, the big background and the small
 * tile are the same frame by construction — zero drift, no seeking, no stutter.
 *
 * BLIND: the page's own sound-stage image (studio-bg.jpg) is laid over the
 * footage as a translucent veil + the same tints as PageBackdrop, so he reads as
 * part of the room. BREAKOUT ONLY: revealed only while he's breaking out
 * (tile time >= BREAKOUT_AT); the contained/cracking half stays veiled.
 */
import { useEffect, useRef, useState, type RefObject } from "react";
import { motion } from "framer-motion";
import { ACCENT } from "./ui";

const PAGE_BG = "/cinema-assets/studio-bg.jpg";
const BREAKOUT_AT = 5; // clip is contained/cracking 0–5s, breakout/emerge 5–10s

export function ImmersiveBreakout({
  active,
  reduced = false,
  tileRef,
}: {
  active: boolean;
  reduced?: boolean;
  tileRef?: RefObject<HTMLVideoElement>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [inBreakout, setInBreakout] = useState(false);

  // Paint the gallery tile's CURRENT frame onto the canvas every frame — same
  // frame as the tile, always, with no second playback to drift or glitch.
  useEffect(() => {
    if (reduced) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { alpha: false });
    if (!canvas || !ctx) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    const draw = () => {
      const tile = tileRef?.current;
      const cw = canvas.width, ch = canvas.height;
      if (tile && tile.readyState >= 2 && tile.videoWidth) {
        const vw = tile.videoWidth, vh = tile.videoHeight;
        // object-cover, anchored at "center 40%"
        const scale = Math.max(cw / vw, ch / vh);
        const dw = vw * scale, dh = vh * scale;
        const dx = (cw - dw) / 2, dy = (ch - dh) * 0.4;
        try { ctx.drawImage(tile, dx, dy, dw, dh); } catch { /* not yet decodable */ }
        setInBreakout(tile.currentTime >= BREAKOUT_AT);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [reduced, tileRef]);

  const visible = active && !reduced && inBreakout;

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-[5] overflow-hidden"
      initial={false}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
    >
      {!reduced && (
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={{ filter: "saturate(1.05)" }} />
      )}
      {/* BLIND — the page's own sound-stage image as a translucent veil over him */}
      <img src={PAGE_BG} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ opacity: 0.5, mixBlendMode: "soft-light" }} />
      <img src={PAGE_BG} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ opacity: 0.34 }} />
      {/* same tint + accent as PageBackdrop, so the seam disappears */}
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(4,5,10,0.5) 0%, rgba(4,5,10,0.3) 38%, rgba(4,5,10,0.8) 100%)" }} />
      <div className="absolute inset-0" style={{ background: `radial-gradient(95% 60% at 50% 120%, hsl(${ACCENT} / 0.18), transparent 60%)` }} />
    </motion.div>
  );
}
