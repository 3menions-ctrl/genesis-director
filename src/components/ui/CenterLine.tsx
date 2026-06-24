import { cn } from "@/lib/utils";

/**
 * CenterLine — the single, app-wide active/selected indicator.
 *
 * A short white line centred below an icon or label. The ONE indicator used
 * everywhere (rail, filter tiles, chips, tabs, toggles) so selection never
 * looks "all over the place". Margin-centred (never a transform — framer-motion
 * would override that), borderless, with a soft glow.
 *
 * Usage: drop inside a `relative` active element.
 *   {active && <CenterLine />}
 */
export function CenterLine({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute -bottom-0.5 left-1/2 -ml-3 h-[2px] w-6 rounded-full bg-white",
        className,
      )}
      style={{ boxShadow: "0 0 8px -1px rgba(255,255,255,0.45)" }}
    />
  );
}
