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
      <span className="relative flex h-9 w-9 items-center justify-center transition-transform duration-200 group-hover/ft:scale-105">
        <Icon
          className={cn(
            "h-[18px] w-[18px] transition-colors",
            active ? "text-white" : "text-foreground/50 group-hover/ft:text-foreground/85",
          )}
          style={active ? { filter: "drop-shadow(0 0 6px rgba(255,255,255,0.4))" } : undefined}
          strokeWidth={1.7}
        />
      </span>
      <span
        className={cn(
          "relative text-[9.5px] font-mono uppercase tracking-[0.14em] transition-colors leading-none text-center",
          active ? "text-foreground" : "text-foreground/50 group-hover/ft:text-foreground/75",
        )}
      >
        {label}
      </span>
      {/* Selection — a clean underline beneath the tile (no bloom). */}
      {active && (
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-1/2 h-[2px] w-7 -translate-x-1/2 rounded-full bg-white"
          style={{ boxShadow: "0 0 8px -1px rgba(255,255,255,0.45)" }}
        />
      )}
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
