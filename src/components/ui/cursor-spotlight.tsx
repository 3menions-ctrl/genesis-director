/**
 * CursorSpotlight — subtle radial glow that follows the cursor.
 *
 * Mounted globally (in AppShell or App). Adds a "the room is lit by my
 * attention" feel without any heavyweight WebGL. Disabled on touch
 * devices (no cursor) and on `prefers-reduced-motion`. Uses passive
 * mousemove listening + RAF throttling so it never blocks input.
 *
 * The spotlight is `position: fixed; z-index: 60; pointer-events: none`
 * so it sits above content but below modals and toasts.
 */
import { useEffect, useRef } from "react";

const SPOTLIGHT_RADIUS = 320; // px

export function CursorSpotlight() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Skip on touch primary devices.
    const isCoarse = window.matchMedia("(pointer: coarse)").matches;
    if (isCoarse) return;

    // Honor reduced motion preference.
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let currentX = targetX;
    let currentY = targetY;
    let rafId = 0;
    let running = false;

    const startLoop = () => {
      if (running) return;
      if (document.visibilityState === "hidden") return;
      running = true;
      rafId = requestAnimationFrame(tick);
    };

    const tick = () => {
      const dx = targetX - currentX;
      const dy = targetY - currentY;
      // Snap when close enough to stop the loop entirely. The unconditional
      // rAF + style-write was writing 60 transforms/sec for the entire
      // app lifetime — primary cause of cursor lag + nav slowdowns,
      // especially with mix-blend-mode: screen on a fixed full-viewport
      // layer forcing GPU composite every frame.
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
        currentX = targetX;
        currentY = targetY;
        if (ref.current) {
          ref.current.style.transform = `translate3d(${currentX - SPOTLIGHT_RADIUS}px, ${currentY - SPOTLIGHT_RADIUS}px, 0)`;
        }
        running = false;
        return;
      }
      currentX += dx * 0.15;
      currentY += dy * 0.15;
      if (ref.current) {
        ref.current.style.transform = `translate3d(${currentX - SPOTLIGHT_RADIUS}px, ${currentY - SPOTLIGHT_RADIUS}px, 0)`;
      }
      rafId = requestAnimationFrame(tick);
    };

    const onMove = (e: MouseEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      startLoop();
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        cancelAnimationFrame(rafId);
        running = false;
      } else {
        startLoop();
      }
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    // Render the initial position, then idle until the cursor moves.
    if (ref.current) {
      ref.current.style.transform = `translate3d(${currentX - SPOTLIGHT_RADIUS}px, ${currentY - SPOTLIGHT_RADIUS}px, 0)`;
    }

    return () => {
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("visibilitychange", onVisibility);
      cancelAnimationFrame(rafId);
      running = false;
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed z-[60] -z-0"
      style={{
        width: `${SPOTLIGHT_RADIUS * 2}px`,
        height: `${SPOTLIGHT_RADIUS * 2}px`,
        background: "radial-gradient(closest-side, hsla(215, 100%, 70%, 0.06), transparent 70%)",
        mixBlendMode: "screen",
        left: 0,
        top: 0,
        willChange: "transform",
      }}
    />
  );
}
