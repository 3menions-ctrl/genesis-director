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
import { ACCENT_HSL, accent, ROSE } from "@/admin/ui/primitives";

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
          "absolute right-0 top-0 bottom-0 flex flex-col overflow-hidden backdrop-blur-2xl",
          "shadow-[-40px_0_120px_-40px_rgba(0,0,0,0.95)]",
          "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "outline-none",
          WIDTH[width],
          open ? "translate-x-0" : "translate-x-full",
        )}
        style={{
          background:
            "linear-gradient(200deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02) 45%, rgba(6,7,10,0.96))",
        }}
      >
        {/* Leading-edge specular highlight */}
        <span
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 bottom-0 w-px"
          style={{
            background: `linear-gradient(to bottom, transparent, ${accent(0.45)}, transparent)`,
          }}
        />
        {/* Accent bloom in the top-leading corner */}
        <span
          aria-hidden
          className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full blur-3xl"
          style={{ background: `radial-gradient(closest-side, ${accent(0.18)}, transparent 70%)` }}
        />

        {/* Header */}
        <header className="relative shrink-0 px-6 py-5 flex items-start gap-4">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)" }}
          />
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <div
                className="text-[9px] uppercase tracking-[0.32em] font-mono mb-2"
                style={{ color: ACCENT_HSL }}
              >
                {eyebrow}
              </div>
            )}
            {title && (
              <h2
                id="inspect-panel-title"
                className="font-display text-[20px] text-white font-semibold tracking-[-0.02em] leading-tight truncate"
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
                className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/55 hover:text-white flex items-center justify-center transition-colors"
                title="Open full page"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            )}
            <button
              type="button"
              onClick={onClose}
              className="group/close w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/55 flex items-center justify-center transition-colors"
              title="Close (Esc)"
              aria-label="Close inspector"
            >
              <X
                className="w-3.5 h-3.5 transition-colors group-hover/close:[color:var(--close-rose)]"
                style={{ ["--close-rose" as string]: ROSE }}
              />
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="relative flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {/* Footer */}
        {footer && (
          <footer className="relative shrink-0 px-6 py-4 bg-white/[0.03]">
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px"
              style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)" }}
            />
            {footer}
          </footer>
        )}
      </aside>
    </div>
  );
}
