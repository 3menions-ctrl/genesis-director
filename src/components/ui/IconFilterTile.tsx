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
      className={cn(
        "group/ft flex flex-col items-center justify-center gap-1.5 w-[68px] py-2.5 rounded-2xl backdrop-blur-md transition-all",
        active
          ? "bg-white/[0.20] ring-1 ring-inset ring-white/[0.45] shadow-[0_10px_30px_-12px_rgba(255,255,255,0.55)]"
          : "bg-white/[0.02] hover:bg-white/[0.06]",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
          active
            ? "bg-white/[0.30] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]"
            : "bg-white/[0.04] text-foreground/50 group-hover/ft:text-foreground/85",
        )}
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.7} />
      </span>
      <span
        className={cn(
          "text-[9.5px] font-mono uppercase tracking-[0.14em] transition-colors leading-none text-center",
          active ? "text-foreground" : "text-foreground/50 group-hover/ft:text-foreground/75",
        )}
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
