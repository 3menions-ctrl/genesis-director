/**
 * Floating — the borderless / floating / translucent-premium design primitives.
 *
 * The house style (see the Profile page for the reference implementation):
 *   • Content CONTAINERS have NO borders and (almost) no fill — text and media
 *     appear to float directly on the Aurora backdrop. Group with spacing and a
 *     soft colour aura, never a boxed card.
 *   • BUTTONS may carry a translucent container, but it must read as premium:
 *     a faint top-light gradient, a hair of inner highlight, a soft lift on
 *     hover — never a flat grey box with a hard border.
 *   • Icons lead. Labels sit underneath or beside, quiet and monospaced.
 *
 * Import these instead of re-deriving the look per page so every surface stays
 * consistent as we roll the system across the app.
 */
import { forwardRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// FloatingSection — a borderless content group. No box. Optional colour aura
// blooming behind the content so it feels lit, not contained.
// ─────────────────────────────────────────────────────────────────────────────
export const FloatingSection = forwardRef<
  HTMLDivElement,
  { children: ReactNode; className?: string; aura?: string; aside?: "left" | "center" | "right" }
>(function FloatingSection({ children, className, aura, aside = "left" }, ref) {
  return (
    <div ref={ref} className={cn("relative", className)}>
      {aura && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute -top-10 h-56 w-56 rounded-full blur-[80px] opacity-[0.16]",
            aside === "left" && "-left-10",
            aside === "center" && "left-1/2 -translate-x-1/2",
            aside === "right" && "-right-10",
          )}
          style={{ background: aura }}
        />
      )}
      <div className="relative">{children}</div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// GlassPanel — the ONLY allowed translucent container, reserved for things that
// truly need a surface (composer, sticky bar, a chat well). Borderless: depth
// comes from a top-light gradient + soft drop shadow + a 1px inner highlight,
// never a drawn border.
// ─────────────────────────────────────────────────────────────────────────────
export const GlassPanel = forwardRef<
  HTMLDivElement,
  { children: ReactNode; className?: string; tone?: "neutral" | "accent" }
>(function GlassPanel({ children, className, tone = "neutral" }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        "relative rounded-[22px] backdrop-blur-2xl",
        "shadow-[0_30px_80px_-40px_hsl(0_0%_0%/0.75),inset_0_1px_0_hsl(0_0%_100%/0.07)]",
        className,
      )}
      style={{
        background:
          tone === "accent"
            ? "linear-gradient(180deg, hsl(var(--accent)/0.10), hsl(0 0% 100%/0.012))"
            : "linear-gradient(180deg, hsl(0 0% 100%/0.05), hsl(0 0% 100%/0.012))",
      }}
    >
      {children}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// GlassButton — premium translucent button. Top-light gradient, inner hairline
// highlight, accent bloom + lift on hover. No hard border.
// ─────────────────────────────────────────────────────────────────────────────
type GlassButtonProps = {
  children: ReactNode;
  className?: string;
  to?: string;
  onClick?: () => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  tone?: "neutral" | "accent" | "solid";
  type?: "button" | "submit";
  ariaLabel?: string;
};

export function GlassButton({
  children,
  className,
  to,
  onClick,
  disabled,
  size = "md",
  tone = "neutral",
  type = "button",
  ariaLabel,
}: GlassButtonProps) {
  const cls = cn(
    "group/gb relative inline-flex items-center justify-center gap-2 rounded-full font-medium",
    "transition-all duration-300 will-change-transform",
    "hover:-translate-y-0.5 active:translate-y-0",
    "shadow-[inset_0_1px_0_hsl(0_0%_100%/0.10),0_10px_30px_-16px_hsl(0_0%_0%/0.8)]",
    "hover:shadow-[inset_0_1px_0_hsl(0_0%_100%/0.14),0_18px_44px_-18px_hsl(var(--accent)/0.45)]",
    size === "sm" && "h-9 px-4 text-[12.5px]",
    size === "md" && "h-11 px-5 text-[13.5px]",
    size === "lg" && "h-12 px-6 text-[14px]",
    tone === "solid"
      ? "bg-foreground text-background hover:bg-foreground/90"
      : "text-foreground/90 hover:text-foreground backdrop-blur-xl",
    disabled && "pointer-events-none opacity-45",
    className,
  );
  const style =
    tone === "solid"
      ? undefined
      : {
          background:
            tone === "accent"
              ? "linear-gradient(180deg, hsl(var(--accent)/0.22), hsl(var(--accent)/0.06))"
              : "linear-gradient(180deg, hsl(0 0% 100%/0.08), hsl(0 0% 100%/0.02))",
        };
  const inner = (
    <>
      {/* accent bloom on hover */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full opacity-0 transition-opacity duration-300 group-hover/gb:opacity-100"
        style={{ background: "radial-gradient(120% 100% at 50% 0%, hsl(var(--accent)/0.18), transparent 70%)" }}
      />
      <span className="relative inline-flex items-center gap-2">{children}</span>
    </>
  );
  if (to) {
    return (
      <Link to={to} aria-label={ariaLabel} className={cls} style={style}>
        {inner}
      </Link>
    );
  }
  return (
    <button type={type} aria-label={ariaLabel} onClick={onClick} disabled={disabled} className={cls} style={style}>
      {inner}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ToolTile — icon on top, quiet label beneath, no box. The canonical "tool"
// affordance for floating action clusters. (Mirrors the Profile pattern; shared
// here so every page uses the same one.)
// ─────────────────────────────────────────────────────────────────────────────
export function ToolTile({
  icon,
  label,
  to,
  onClick,
  active = false,
  disabled = false,
}: {
  icon: ReactNode;
  label: string;
  to?: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  const inner = (
    <>
      <span
        className={cn(
          "relative grid h-12 w-12 place-items-center transition-all duration-300 group-hover/tool:-translate-y-0.5",
          active ? "text-accent" : "text-foreground/85 group-hover/tool:text-accent",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 rounded-full blur-xl transition-all duration-300",
            active ? "bg-accent/20" : "bg-accent/0 group-hover/tool:bg-accent/15",
          )}
        />
        {icon}
      </span>
      <span
        className={cn(
          "text-[10px] font-mono uppercase tracking-[0.22em] transition-colors",
          active ? "text-accent" : "text-muted-foreground/70 group-hover/tool:text-foreground",
        )}
      >
        {label}
      </span>
    </>
  );
  const cls = cn(
    "group/tool relative inline-flex flex-col items-center gap-2 text-center select-none",
    disabled ? "pointer-events-none opacity-50" : "cursor-pointer",
  );
  if (to) return <Link to={to} className={cls}>{inner}</Link>;
  return <button type="button" onClick={onClick} disabled={disabled} className={cls}>{inner}</button>;
}

// ─────────────────────────────────────────────────────────────────────────────
// SectionLabel — the quiet monospaced eyebrow that titles a floating section
// without drawing a header bar.
// ─────────────────────────────────────────────────────────────────────────────
export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground/55", className)}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FloatingStat — a KPI that floats: big number, quiet label, soft aura. No box.
// ─────────────────────────────────────────────────────────────────────────────
export function FloatingStat({
  value,
  label,
  aura = "hsl(214 90% 62%)",
  hint,
}: {
  value: ReactNode;
  label: string;
  aura?: string;
  hint?: ReactNode;
}) {
  return (
    <div className="group/fs relative">
      <span
        aria-hidden
        className="pointer-events-none absolute -left-2 top-0 h-20 w-20 rounded-full blur-[44px] opacity-20 transition-opacity duration-500 group-hover/fs:opacity-40"
        style={{ background: aura }}
      />
      <div
        className="relative font-display text-[30px] font-semibold leading-none tabular-nums text-foreground"
        style={{ textShadow: `0 0 30px ${aura}44` }}
      >
        {value}
      </div>
      <div className="relative mt-2 font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground/55">
        {label}
      </div>
      {hint && <div className="relative mt-0.5 text-[11px] text-muted-foreground/45">{hint}</div>}
    </div>
  );
}
