/**
 * AdminPageShell — premium cinema page primitive.
 * Borderless gradient-glass hero + atmospheric backdrop for every admin sub-page.
 * Compose: <AdminPageShell eyebrow="03 // PEOPLE" code="IDN" title="Identity" description="...">{children}</AdminPageShell>
 */
import { ReactNode, createContext, useContext } from "react";
import { cn } from "@/lib/utils";
import { ACCENT_HSL, accent, CYAN, AMBER, ROSE, StatOrb } from "@/admin/ui/primitives";

/**
 * AdminEmbeddedContext — set to true by AdminHubShell when it renders a
 * child page inside one of its tabs. Lets AdminPageShell auto-suppress its
 * own hero so we never render two stacked headers.
 */
const AdminEmbeddedContext = createContext<boolean>(false);
export const AdminEmbeddedProvider = AdminEmbeddedContext.Provider;
export const useAdminEmbedded = () => useContext(AdminEmbeddedContext);

interface Props {
  eyebrow: string;          // e.g. "02 // PEOPLE"
  code: string;             // e.g. "IDN"
  title: string;            // hero title
  italic?: string;          // optional italicized accent fragment after title
  description?: string;
  actions?: ReactNode;      // right-aligned hero actions
  meta?: ReactNode;         // right rail KPI tiles inside hero
  stats?: { label: string; value: ReactNode; tone?: "blue" | "amber" | "emerald" | "rose" | "neutral"; sub?: string }[];
  children: ReactNode;
  className?: string;
  contained?: boolean;      // wrap children in max-w container (default true)
  /** When true the hero is suppressed — used when the page is embedded as a tab
   *  inside an AdminHubShell so we don't render two heroes stacked. */
  embedded?: boolean;
}

export function AdminPageShell({
  eyebrow, code, title, italic, description, actions, meta, stats, children, className, contained = true, embedded = false,
}: Props) {
  const inHub = useAdminEmbedded();
  if (embedded || inHub) {
    // When rendered inside a hub tab, suppress the hero + outer padding
    // so the page composes cleanly under the hub shell.
    return <div className={cn("animate-fade-in", className)}>{children}</div>;
  }
  return (
    <div className={cn("p-8 lg:p-12 space-y-12 animate-fade-in", contained && "max-w-[1480px] mx-auto", className)}>
      {/* Floating page header — no container; the title sits directly on the
          aurora. Eyebrow chip · giant Fraunces title · description. */}
      <header className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="mb-6 flex items-center gap-3">
            <span
              className="rounded-full px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.28em]"
              style={{ color: ACCENT_HSL, background: accent(0.14) }}
            >
              {eyebrow}
            </span>
            <span className="h-px w-10 bg-white/15" />
            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/45">MOD // {code}</span>
          </div>
          <h1 className="font-display font-semibold leading-[0.9] tracking-[-0.035em] text-white" style={{ fontSize: "clamp(2.8rem, 5.4vw, 4.4rem)" }}>
            {title}
            {italic && (
              <> <span className="italic font-light" style={{ color: ACCENT_HSL, textShadow: `0 0 36px ${accent(0.5)}` }}>{italic}</span></>
            )}
          </h1>
          {description && (
            <p className="mt-6 max-w-xl text-[14.5px] font-light leading-relaxed text-white/55">{description}</p>
          )}
        </div>
        {(actions || meta) && (
          <div className="flex shrink-0 flex-col items-end gap-4">
            {actions && <div className="flex items-center gap-3">{actions}</div>}
            {meta && <div className="flex items-center gap-3">{meta}</div>}
          </div>
        )}
      </header>

      {/* Floating stat orbs — borderless figures over coloured auras. */}
      {stats && stats.length > 0 && (
        <div className="grid grid-cols-2 gap-x-10 gap-y-12 md:grid-cols-4">
          {stats.map((s, i) => {
            const toneAura: Record<string, string> = { blue: ACCENT_HSL, amber: AMBER, emerald: CYAN, rose: ROSE, neutral: ACCENT_HSL };
            return (
              <StatOrb
                key={i}
                index={i}
                aura={toneAura[s.tone || "neutral"]}
                label={String(s.label)}
                value={s.value as string | number}
                sub={s.sub ? String(s.sub) : undefined}
                accentNumber={s.tone === "blue"}
              />
            );
          })}
        </div>
      )}

      {/* Body */}
      <div>{children}</div>
    </div>
  );
}

/** Section heading for use inside shell body */
export function AdminSectionLabel({ label, meta }: { label: string; meta?: string }) {
  return (
    <div className="flex items-center gap-4 mb-6">
      <span className="text-[11px] text-white/55 font-mono font-medium uppercase tracking-[0.3em]">{label}</span>
      <div className="h-px flex-1 bg-white/[0.06]" />
      {meta && <span className="text-[10px] text-white/30 font-mono uppercase tracking-widest">{meta}</span>}
    </div>
  );
}

/** Borderless gradient-glass surface */
export function AdminSurface({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl backdrop-blur-xl p-6 shadow-[0_30px_90px_-50px_rgba(0,0,0,0.95)]",
        className,
      )}
      style={{ background: "linear-gradient(165deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02) 60%, rgba(255,255,255,0.015))" }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)" }}
      />
      {children}
    </div>
  );
}

/** Cinematic empty state — concentric rings, eyebrow code, suggested action */
export function AdminEmptyState({
  code, title, hint, icon: Icon, action,
}: {
  code: string;
  title: string;
  hint?: string;
  icon?: React.ElementType;
  action?: ReactNode;
}) {
  return (
    <div className="relative flex flex-col items-center justify-center py-20 px-6 text-center overflow-hidden">
      {/* concentric rings */}
      <div aria-hidden className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="absolute w-[420px] h-[420px] rounded-full" style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)" }} />
        <div className="absolute w-[300px] h-[300px] rounded-full" style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.05)" }} />
        <div className="absolute w-[180px] h-[180px] rounded-full" style={{ boxShadow: `inset 0 0 0 1px ${accent(0.15)}` }} />
        <div className="absolute w-[180px] h-[180px] rounded-full"
             style={{ background: `radial-gradient(circle, ${accent(0.10)}, transparent 65%)`, filter: "blur(20px)" }} />
      </div>
      <div className="relative z-10 flex flex-col items-center">
        {Icon && (
          <div
            className="w-14 h-14 rounded-2xl backdrop-blur-md flex items-center justify-center mb-5"
            style={{ background: `linear-gradient(135deg, ${accent(0.2)}, ${accent(0.06)})`, boxShadow: `0 8px 24px -12px ${accent(0.4)}`, color: ACCENT_HSL }}
          >
            <Icon className="w-5 h-5" />
          </div>
        )}
        <span className="text-[9px] font-mono uppercase tracking-[0.4em] mb-3" style={{ color: ACCENT_HSL }}>
          {code} // STANDBY
        </span>
        <h3 className="font-display text-2xl text-white font-semibold tracking-[-0.02em] mb-2">
          {title}
        </h3>
        {hint && <p className="text-[13px] text-white/45 max-w-md leading-relaxed font-light">{hint}</p>}
        {action && <div className="mt-6">{action}</div>}
      </div>
    </div>
  );
}
