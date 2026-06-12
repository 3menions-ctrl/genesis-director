/**
 * InspectPanel — right-side slide-over for inline entity inspection.
 *
 * The premium pattern that replaces full-page nav for triage flows. Open it
 * from any list row, get a rich detail view without losing your filters,
 * Esc / click backdrop to close. Deep-linkable via the `route` prop (the
 * caller can mirror the open state into a query param if it wants).
 *
 * Visual: 480px glass panel hard-pinned right, brand-tinted rail on the
 * leading edge, frosted backdrop. Matches Editorial Noir surfaces.
 */
import { ReactNode, useEffect, useRef } from "react";
import { X, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface InspectPanelProps {
  open: boolean;
  onClose: () => void;
  /** Optional deep-link target. When provided, renders an "Open full page"
   *  affordance in the header so the operator can promote the inline view. */
  deepLinkTo?: string;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  /** Right-aligned header actions (buttons, etc) before the close X. */
  headerActions?: ReactNode;
  /** Sticky footer (e.g. action bar). Has its own glass treatment. */
  footer?: ReactNode;
  /** Optional width preset. */
  width?: "sm" | "md" | "lg";
  children: ReactNode;
}

const WIDTH = { sm: "w-[420px]", md: "w-[520px]", lg: "w-[640px]" } as const;

export function InspectPanel({
  open,
  onClose,
  deepLinkTo,
  eyebrow,
  title,
  subtitle,
  headerActions,
  footer,
  width = "md",
  children,
}: InspectPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // ESC to close + focus return.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Move focus into the panel so screen readers + keyboard users land there.
    requestAnimationFrame(() => panelRef.current?.focus());
    return () => {
      document.removeEventListener("keydown", onKey);
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  return (
    <div
      aria-hidden={!open}
      className={cn(
        "fixed inset-0 z-[80] pointer-events-none",
        open && "pointer-events-auto",
      )}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0",
        )}
      />

      {/* Panel */}
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "inspect-panel-title" : undefined}
        tabIndex={-1}
        className={cn(
          "absolute right-0 top-0 bottom-0 flex flex-col",
          "bg-[#070809]/95 backdrop-blur-2xl border-l border-white/[0.06]",
          "shadow-[-40px_0_80px_-40px_rgba(0,0,0,0.9)]",
          "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "outline-none",
          WIDTH[width],
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Brand rail */}
        <span
          aria-hidden
          className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-[#0A84FF]/40 to-transparent"
        />

        {/* Header */}
        <header className="shrink-0 px-6 py-5 border-b border-white/[0.05] flex items-start gap-4">
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <div className="text-[9px] uppercase tracking-[0.32em] text-[#0A84FF]/80 font-mono mb-2">
                {eyebrow}
              </div>
            )}
            {title && (
              <h2
                id="inspect-panel-title"
                className="font-display text-[20px] text-white font-light leading-tight truncate"
              >
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-[12px] text-white/45 mt-1 truncate">{subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {headerActions}
            {deepLinkTo && (
              <Link
                to={deepLinkTo}
                className="w-8 h-8 rounded-full border border-white/[0.08] hover:border-[#0A84FF]/40 hover:text-[#0A84FF] text-white/55 flex items-center justify-center transition-colors"
                title="Open full page"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full border border-white/[0.08] hover:border-rose-400/40 hover:text-rose-300 text-white/55 flex items-center justify-center transition-colors"
              title="Close (Esc)"
              aria-label="Close inspector"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {/* Footer */}
        {footer && (
          <footer className="shrink-0 px-6 py-4 border-t border-white/[0.05] bg-white/[0.015]">
            {footer}
          </footer>
        )}
      </aside>
    </div>
  );
}
