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

    const onMove = (e: MouseEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
    };

    const tick = () => {
      // Light damping so the spotlight follows but with a tiny lag.
      currentX += (targetX - currentX) * 0.15;
      currentY += (targetY - currentY) * 0.15;
      if (ref.current) {
        ref.current.style.transform = `translate3d(${currentX - SPOTLIGHT_RADIUS}px, ${currentY - SPOTLIGHT_RADIUS}px, 0)`;
      }
      rafId = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    rafId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(rafId);
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
