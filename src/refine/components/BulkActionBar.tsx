/**
 * BulkActionBar — sticky bottom action bar that appears whenever the
 * operator has multi-selected rows on a list.
 *
 * Premium glass + brand rail, slides up from bottom, holds the count + a
 * cluster of action buttons (grant credits, suspend, restore, export…).
 *
 * Pure UI primitive — the parent list owns the selection state and the
 * action handlers. Keep it dumb so any list (users, projects, orgs) can
 * plug in.
 */
import { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCENT_HSL, accent, ROSE } from "@/admin/ui/primitives";

interface BulkActionBarProps {
  count: number;
  /** Optional label noun ("user" / "project" / etc) — pluralized + suffixed
   *  with the count. Defaults to "item". */
  itemNoun?: string;
  onClear: () => void;
  /** Action buttons supplied by the parent. */
  children: ReactNode;
}

export function BulkActionBar({ count, itemNoun = "item", onClear, children }: BulkActionBarProps) {
  const visible = count > 0;
  return (
    <div
      aria-hidden={!visible}
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-[70]",
        "transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6 pointer-events-none",
      )}
    >
      <div
        className="relative overflow-hidden rounded-2xl backdrop-blur-2xl px-4 py-3 flex items-center gap-3 shadow-[0_30px_90px_-40px_rgba(0,0,0,0.95)]"
        style={{ background: "linear-gradient(165deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02) 60%, rgba(255,255,255,0.015))" }}
      >
        {/* Top specular highlight */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)" }}
        />
        {/* Brand rail */}
        <span
          aria-hidden
          className="absolute left-0 top-3 bottom-3 w-px"
          style={{ background: `linear-gradient(to bottom, transparent, ${accent(0.6)}, transparent)` }}
        />

        <button
          type="button"
          onClick={onClear}
          className="w-7 h-7 rounded-full bg-white/[0.06] text-white/55 hover:bg-white/[0.12] hover:text-white flex items-center justify-center transition-colors shrink-0"
          aria-label="Clear selection"
          title="Clear selection"
        >
          <X className="w-3 h-3" />
        </button>

        <div className="flex items-baseline gap-2">
          <span className="font-display text-[15px] text-white font-semibold tracking-[-0.02em] tabular-nums">{count}</span>
          <span className="text-[10px] font-mono uppercase tracking-[0.32em] text-white/45">
            {count === 1 ? itemNoun : `${itemNoun}s`} selected
          </span>
        </div>

        <span aria-hidden className="h-5 w-px bg-white/10 mx-1" />

        <div className="flex items-center gap-1.5">
          {children}
        </div>
      </div>
    </div>
  );
}

/** A premium button styled to fit the BulkActionBar. Compose actions with these. */
export function BulkActionButton({
  icon: Icon, label, tone = "neutral", onClick, disabled,
}: {
  icon: React.ElementType;
  label: string;
  tone?: "neutral" | "rose" | "blue";
  onClick: () => void;
  disabled?: boolean;
}) {
  const toneStyle =
    tone === "rose"
      ? { color: ROSE, background: "hsl(350 90% 70% / 0.12)" }
      : tone === "blue"
      ? { color: ACCENT_HSL, background: accent(0.14) }
      : { color: "rgba(255,255,255,0.75)", background: "rgba(255,255,255,0.06)" };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={toneStyle}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-[11px] font-mono uppercase tracking-[0.22em] transition-all hover:brightness-125",
        disabled && "opacity-40 cursor-not-allowed",
      )}
    >
      <Icon className="w-3 h-3" />
      {label}
    </button>
  );
}
