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
      <div className="relative rounded-2xl border border-white/[0.08] bg-[#0a0b0d]/95 backdrop-blur-2xl px-4 py-3 flex items-center gap-3 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.9)]">
        {/* Brand rail */}
        <span
          aria-hidden
          className="absolute left-0 top-3 bottom-3 w-px bg-gradient-to-b from-transparent via-[#0A84FF]/60 to-transparent"
        />

        <button
          type="button"
          onClick={onClear}
          className="w-7 h-7 rounded-full border border-white/[0.08] hover:border-rose-400/40 hover:text-rose-300 text-white/55 flex items-center justify-center transition-colors shrink-0"
          aria-label="Clear selection"
          title="Clear selection"
        >
          <X className="w-3 h-3" />
        </button>

        <div className="flex items-baseline gap-2">
          <span className="text-[14px] text-white font-light tabular-nums">{count}</span>
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
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 h-8 rounded-lg border text-[11px] font-mono uppercase tracking-[0.22em] transition-colors",
        tone === "rose"
          ? "border-rose-400/30 text-rose-200 hover:bg-rose-400/[0.10] hover:border-rose-300/50"
          : tone === "blue"
          ? "border-[#0A84FF]/30 text-[#6FB6FF] hover:bg-[#0A84FF]/[0.10] hover:border-[#0A84FF]/50"
          : "border-white/[0.08] text-white/75 hover:bg-white/[0.04] hover:border-white/20 hover:text-white",
        disabled && "opacity-40 cursor-not-allowed",
      )}
    >
      <Icon className="w-3 h-3" />
      {label}
    </button>
  );
}
