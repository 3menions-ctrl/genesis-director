/**
 * Surface — the shared modal shell for the editor.
 *
 * Every floating panel in the editor renders through these primitives
 * so they all read as the same family of objects: centered,
 * glassmorphic, premium-shadowed, esc-dismissible, with a specular
 * highlight along the top edge that catches the eye the way a real
 * piece of polished glass would.
 *
 * Compose, don't wrap:
 *
 *   <Surface open={open} onClose={onClose} size="lg" labelledBy="x-t">
 *     <SurfaceHeader
 *       title="The Studio Library"
 *       eyebrow="◆ Library"
 *       description="…"
 *       onClose={onClose}
 *     />
 *     <SurfaceBody>...</SurfaceBody>
 *     <SurfaceFooter>
 *       <SurfaceKbdHint keys="Shift L" label="library" />
 *       …
 *     </SurfaceFooter>
 *   </Surface>
 *
 * The Surface handles the backdrop, the centering, the motion, the
 * Esc-to-close and click-outside-to-close behavior, and the glass.
 * Everything inside is yours.
 */
import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_PREMIUM, TYPE_META } from "@/lib/design-system";

// ─────────────────────────────────────────────────────────────────────────────
// Sizes
// ─────────────────────────────────────────────────────────────────────────────
export type SurfaceSize = "sm" | "md" | "lg" | "xl" | "full";

const SIZE_CLASS: Record<SurfaceSize, string> = {
  sm: "w-[min(420px,94vw)] max-h-[80vh]",
  md: "w-[min(560px,94vw)] max-h-[86vh]",
  lg: "w-[min(720px,94vw)] max-h-[88vh]",
  xl: "w-[min(1100px,94vw)] max-h-[88vh]",
  full: "w-[min(1320px,96vw)] max-h-[92vh]",
};

// ─────────────────────────────────────────────────────────────────────────────
// Surface — the centered glass shell
// ─────────────────────────────────────────────────────────────────────────────
interface SurfaceProps {
  open: boolean;
  onClose: () => void;
  /**
   * The id of the element that names this Surface for screen readers.
   * Pair with SurfaceHeader's `id` prop so the surface and its title
   * are correctly linked.
   */
  labelledBy?: string;
  size?: SurfaceSize;
  /**
   * When true the backdrop click is suppressed — used for surfaces
   * that contain unsaved input or that the user must explicitly
   * dismiss via a button. Defaults to false (click-out closes).
   */
  blockBackdropClose?: boolean;
  /**
   * When true the Esc key DOES NOT close the surface. Use for
   * surfaces that own their own Esc handling (text editors,
   * composers). Defaults to false (Esc closes).
   */
  blockEscClose?: boolean;
  /**
   * Optional className merged into the shell. Use for tweaking
   * specific surfaces (e.g. adding `overflow-visible` for ones
   * with menus that should escape clipping).
   */
  className?: string;
  children: ReactNode;
}

export function Surface({
  open,
  onClose,
  labelledBy,
  size = "md",
  blockBackdropClose,
  blockEscClose,
  className,
  children,
}: SurfaceProps) {
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!open || blockEscClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || t?.isContentEditable) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, blockEscClose, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop — deep tint + heavy blur. The whole editor
              chrome dims so the surface reads as the present
              context. */}
          <motion.div
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={blockBackdropClose ? undefined : onClose}
            className={cn(
              "fixed inset-0 z-40",
              "bg-[hsl(220_30%_2%/0.62)] backdrop-blur-md",
            )}
          />

          {/* Centering wrapper — owns position:fixed + flex centering
              via the viewport. CRITICAL: framer-motion writes inline
              `transform` to motion elements; if we put the
              `-translate-x-1/2 -translate-y-1/2` Tailwind classes on
              the SAME element framer animates, the inline transform
              wins and the centering classes are silently overwritten.
              So we put fixed/flex on the wrapper, animation on the
              inner motion.div. */}
          <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center p-4">
            <motion.div
              role="dialog"
              aria-labelledby={labelledBy}
              aria-modal="true"
              initial={
                reducedMotion ? { opacity: 1 } : { opacity: 0, y: 12, scale: 0.985 }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={
                reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.985 }
              }
              transition={{ duration: 0.34, ease: EASE_PREMIUM }}
              className={cn(
                "pointer-events-auto relative",
                // Layout
                "flex flex-col overflow-hidden",
                SIZE_CLASS[size],
                // Glass — the look. Stacked transluscence + heavy blur
                "rounded-3xl",
                "bg-[hsl(220_30%_5%/0.62)] backdrop-blur-3xl backdrop-saturate-150",
                // Inset borders + double specular highlight (the gloss)
                "ring-1 ring-inset ring-white/[0.10]",
                // Premium ambient + contact shadow
                "shadow-[0_60px_180px_-20px_hsl(0_0%_0%/0.92),0_0_0_1px_hsl(0_0%_100%/0.04),inset_0_1px_0_0_hsl(0_0%_100%/0.06)]",
                className,
              )}
            >
              {/* Top specular sheen — sits above content, ignored by
                  pointer events, gives the surface its "this is glass"
                  read. */}
              <div
                aria-hidden
                className={cn(
                  "pointer-events-none absolute inset-x-0 top-0 h-px",
                  "bg-gradient-to-r from-transparent via-white/[0.18] to-transparent",
                )}
              />
              {/* Soft inner highlight at the top — the diffused light
                  from the spec line. Pure decoration. */}
              <div
                aria-hidden
                className={cn(
                  "pointer-events-none absolute inset-x-6 top-0 h-24 rounded-3xl",
                  "bg-gradient-to-b from-white/[0.06] to-transparent",
                  "blur-2xl opacity-80",
                )}
              />
              {children}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SurfaceHeader — eyebrow + title + (optional description) + close
// ─────────────────────────────────────────────────────────────────────────────
export function SurfaceHeader({
  id,
  eyebrow,
  title,
  description,
  onClose,
  iconColorClassName,
  divider = true,
}: {
  id?: string;
  /** Mono-uppercase eyebrow — e.g. "◆ Library". Optional. */
  eyebrow?: string;
  /** Fraunces italic title — required. */
  title: string;
  /** Soft 12.5px copy below the title. Optional. */
  description?: ReactNode;
  /** When provided, the X button is rendered top-right. */
  onClose?: () => void;
  /** Tints the sparkle icon in the eyebrow. Defaults to accent. */
  iconColorClassName?: string;
  /** Hairline divider below the header. Defaults true. */
  divider?: boolean;
}) {
  return (
    <header className="relative shrink-0 px-7 pt-6 pb-4 flex items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <div
            className={cn(
              TYPE_META,
              "text-muted-foreground/55 tracking-[0.34em] flex items-center gap-2",
            )}
          >
            <Sparkles
              className={cn("h-3 w-3", iconColorClassName ?? "text-accent")}
              strokeWidth={1.5}
            />
            <span>{eyebrow}</span>
          </div>
        )}
        <h2
          id={id}
          className="mt-1 font-display italic text-[24px] font-light tracking-tight text-foreground/95 leading-[1.1]"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          {title}
        </h2>
        {description && (
          <p className="mt-1.5 text-[12.5px] text-muted-foreground/70 max-w-[640px] leading-snug">
            {description}
          </p>
        )}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className={cn(
            "shrink-0 mt-1 h-7 w-7 rounded-full",
            "inline-flex items-center justify-center",
            "text-muted-foreground/55 hover:text-foreground",
            "bg-white/[0.02] hover:bg-white/[0.06] ring-1 ring-inset ring-white/[0.06]",
            "transition-colors",
          )}
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
      )}
      {divider && (
        <span
          aria-hidden
          className="absolute left-7 right-7 bottom-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent"
        />
      )}
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SurfaceBody — the scrollable main content region
// ─────────────────────────────────────────────────────────────────────────────
export function SurfaceBody({
  children,
  className,
  noPadding,
}: {
  children: ReactNode;
  className?: string;
  /** Bypass the default px-7 py-6 — use for grids or dense lists that
   *  manage their own gutter. */
  noPadding?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex-1 min-h-0 overflow-y-auto scrollbar-hide",
        !noPadding && "px-7 py-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SurfaceFooter — pinned at the bottom with consistent hairline
// ─────────────────────────────────────────────────────────────────────────────
export function SurfaceFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <footer
      className={cn(
        "relative shrink-0 px-7 py-3.5",
        "flex items-center justify-between",
        "text-[11px] font-mono uppercase tracking-[0.20em] text-muted-foreground/55",
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute left-7 right-7 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent"
      />
      {children}
    </footer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SurfaceKbdHint — the keyboard-shortcut chip used in headers/footers
// ─────────────────────────────────────────────────────────────────────────────
export function SurfaceKbdHint({
  keys,
  label,
}: {
  keys: string;
  label?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <kbd
        className={cn(
          "inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded",
          "bg-white/[0.04] ring-1 ring-inset ring-white/[0.10]",
          "text-[10px] font-mono text-foreground/85",
        )}
      >
        {keys}
      </kbd>
      {label && <span>{label}</span>}
    </span>
  );
}
