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
        className="relative overflow-hidden rounded-2xl px-4 py-3 flex items-center gap-3"
        style={{
          background: "#ffffff",
          boxShadow:
            "0 1px 2px rgba(16,24,40,.04), 0 18px 40px -18px rgba(16,24,40,.18)",
        }}
      >
        <button
          type="button"
          onClick={onClear}
          className="w-7 h-7 rounded-full bg-[#f6f8fc] text-[#5d6a82] hover:bg-[#f4f7ff] hover:text-[#0c1426] flex items-center justify-center transition-colors shrink-0"
          aria-label="Clear selection"
          title="Clear selection"
        >
          <X className="w-3 h-3" />
        </button>

        <div className="flex items-baseline gap-2">
          <span className="font-display text-[15px] text-[#0c1426] font-semibold tracking-[-0.02em] tabular-nums">{count}</span>
          <span className="text-[10px] font-mono uppercase tracking-[0.32em] text-[#5d6a82]">
            {count === 1 ? itemNoun : `${itemNoun}s`} selected
          </span>
        </div>

        <span aria-hidden className="h-5 w-px bg-[#f6f8fc] mx-1" />

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
      : { color: "#5d6a82", background: "#f6f8fc" };
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
