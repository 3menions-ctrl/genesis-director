/**
 * IconFilterTile — a beautiful filter control rendered as a big icon over a
 * small label. Shared across the browse pages (Templates, Worlds, Crossover,
 * Avatars, Training) so every filter rail reads the same way: icon tiles in a
 * row, each row prefixed by a small title boundary.
 */
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

export function IconFilterTile({
  active,
  onClick,
  Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  Icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group/ft relative flex flex-col items-center justify-center gap-1.5 w-[68px] py-2.5 transition-all"
    >
      {/* Borderless selection — a quiet dark-blue bloom behind the icon (no
          ring, no box), matching the rail + page backdrop. */}
      {active && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1.5 h-9 w-9 -translate-x-1/2 rounded-2xl"
          style={{
            background: "radial-gradient(closest-side, hsl(218 70% 38% / 0.55), hsl(218 70% 38% / 0) 78%)",
            boxShadow: "0 0 14px -6px hsl(216 80% 50% / 0.35)",
          }}
        />
      )}
      <span className="relative flex h-9 w-9 items-center justify-center transition-transform duration-200 group-hover/ft:scale-105">
        <Icon
          className={cn(
            "h-[18px] w-[18px] transition-colors",
            active ? "text-[hsl(213_100%_88%)]" : "text-foreground/50 group-hover/ft:text-foreground/85",
          )}
          strokeWidth={1.7}
        />
      </span>
      <span
        className={cn(
          "relative text-[9.5px] font-mono uppercase tracking-[0.14em] transition-colors leading-none text-center",
          active ? "" : "text-foreground/50 group-hover/ft:text-foreground/75",
        )}
        style={active ? { color: "hsl(213 90% 84%)" } : undefined}
      >
        {label}
      </span>
    </button>
  );
}

/**
 * IconFilterRow — a labelled row of IconFilterTiles. The `title` sits to the
 * left as the boundary; the tiles wrap on small screens.
 */
export function IconFilterRow({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="hidden sm:inline-block font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/45 w-16 shrink-0">
        {title}
      </span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
