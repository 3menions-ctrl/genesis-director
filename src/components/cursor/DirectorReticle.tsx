/**
 * DirectorReticle — film-director cursor for the Studio surface.
 *
 * Replaces the OS cursor with a precision reticle that:
 *   - Reads context from the element under the pointer:
 *       data-cursor="viewfinder" → camera framing crosshair
 *       data-cursor="scissors"   → edit cursor over the timeline
 *       data-cursor="hand"       → draggable affordance
 *       data-cursor="link"       → arrow + underline for hyperlinks
 *     Default: a small precision dot.
 *   - Hides on touch primaries + reduced-motion (where the OS cursor is
 *     the right answer).
 *   - Sits in a fixed-position SVG layer; mouse never blocks pointer
 *     events.
 *
 * Drop this once at the root of any "creative surface" page (Studio,
 * Production, Editor). Will inherit the default cursor outside that
 * surface unless propagated globally.
 */
import { useEffect, useState } from "react";

type Variant = "default" | "viewfinder" | "scissors" | "hand" | "link";

export function DirectorReticle({ scope }: { scope?: string }) {
  const [pos, setPos] = useState({ x: -100, y: -100 });
  const [variant, setVariant] = useState<Variant>("default");
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const root: HTMLElement | Document = scope
      ? document.querySelector(scope) as HTMLElement
      : document;
    if (!root) return;

    setActive(true);
    // Hide native cursor over the scope.
    if (scope) (root as HTMLElement).style.cursor = "none";

    const onMove = (e: MouseEvent) => {
      setPos({ x: e.clientX, y: e.clientY });
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const ctx = t.closest("[data-cursor]") as HTMLElement | null;
      const want = (ctx?.getAttribute("data-cursor") as Variant | null) ?? "default";
      const linky = !ctx && t.closest("a,button");
      setVariant(want !== "default" ? want : (linky ? "link" : "default"));
    };

    const onLeave = () => setActive(false);
    const onEnter = () => setActive(true);

    root.addEventListener("mousemove", onMove as EventListener, { passive: true });
    root.addEventListener("mouseleave", onLeave as EventListener);
    root.addEventListener("mouseenter", onEnter as EventListener);
    return () => {
      root.removeEventListener("mousemove", onMove as EventListener);
      root.removeEventListener("mouseleave", onLeave as EventListener);
      root.removeEventListener("mouseenter", onEnter as EventListener);
      if (scope) (root as HTMLElement).style.cursor = "";
    };
  }, [scope]);

  if (!active) return null;

  return (
    <svg
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 z-[80] -translate-x-1/2 -translate-y-1/2 transition-transform duration-75 ease-linear"
      style={{ transform: `translate3d(${pos.x}px, ${pos.y}px, 0) translate(-50%, -50%)` }}
      width="40"
      height="40"
      viewBox="0 0 40 40"
    >
      {variant === "viewfinder" && (
        <g stroke="white" strokeWidth="1.4" fill="none" opacity="0.9">
          <line x1="20" y1="2" x2="20" y2="14" />
          <line x1="20" y1="26" x2="20" y2="38" />
          <line x1="2" y1="20" x2="14" y2="20" />
          <line x1="26" y1="20" x2="38" y2="20" />
          <circle cx="20" cy="20" r="3" fill="white" opacity="0.85" />
        </g>
      )}
      {variant === "scissors" && (
        <g stroke="white" strokeWidth="1.4" fill="none" opacity="0.9">
          <circle cx="14" cy="14" r="3" />
          <circle cx="14" cy="26" r="3" />
          <line x1="17" y1="15" x2="36" y2="20" strokeLinecap="round" />
          <line x1="17" y1="25" x2="36" y2="20" strokeLinecap="round" />
        </g>
      )}
      {variant === "hand" && (
        <g stroke="white" strokeWidth="1.4" fill="rgba(255,255,255,0.15)" opacity="0.95">
          <path d="M12 22 V14 a2 2 0 0 1 4 0 V20 V12 a2 2 0 0 1 4 0 V20 V11 a2 2 0 0 1 4 0 V20 V14 a2 2 0 0 1 4 0 V26 a8 8 0 0 1-16 0 Z" strokeLinejoin="round" />
        </g>
      )}
      {variant === "link" && (
        <g stroke="white" strokeWidth="1.4" fill="white" opacity="0.95">
          <polygon points="6,4 6,30 14,22 21,22 11,32 16,38 26,28 26,22 32,28" />
        </g>
      )}
      {variant === "default" && (
        <circle cx="20" cy="20" r="3" fill="white" opacity="0.85" />
      )}
    </svg>
  );
}
