/**
 * AdminPageShell — Editorial Noir page primitive.
 * Premium hero header + atmospheric backdrop for every admin sub-page.
 * Compose: <AdminPageShell eyebrow="03 // PEOPLE" code="IDN" title="Identity" description="...">{children}</AdminPageShell>
 */
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

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
}

export function AdminPageShell({
  eyebrow, code, title, italic, description, actions, meta, stats, children, className, contained = true,
}: Props) {
  return (
    <div className={cn("p-8 lg:p-12 space-y-10 animate-fade-in", contained && "max-w-[1480px] mx-auto", className)}>
      {/* Hero */}
      <section className="relative rounded-3xl border border-white/[0.06] bg-gradient-to-br from-white/[0.03] to-transparent overflow-hidden shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)]">
        {/* aurora */}
        <div
          aria-hidden
          className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(10,132,255,0.18), transparent 65%)", filter: "blur(60px)" }}
        />
        <div
          aria-hidden
          className="absolute -bottom-40 -left-20 w-[380px] h-[380px] rounded-full pointer-events-none opacity-50"
          style={{ background: "radial-gradient(circle, rgba(10,132,255,0.06), transparent 70%)", filter: "blur(80px)" }}
        />
        {/* hairline grid */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.025] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        <div className="relative p-8 lg:p-12 flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 mb-5">
              <span className="px-3 py-1 rounded-full border border-[#0A84FF]/40 bg-[#0A84FF]/5 text-[#0A84FF] text-[9px] font-bold tracking-[0.28em] uppercase font-mono">
                {eyebrow}
              </span>
              <span className="h-px w-10 bg-white/15" />
              <span className="text-white/30 text-[10px] tracking-[0.28em] uppercase font-mono">
                MOD // {code}
              </span>
            </div>
            <h1
              className="text-4xl lg:text-6xl text-white font-light tracking-tight leading-[0.95]"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              {title}
              {italic && (
                <>
                  {" "}
                  <span className="italic text-[#0A84FF] font-light">{italic}</span>
                </>
              )}
            </h1>
            {description && (
              <p className="mt-5 text-[14px] text-white/45 max-w-xl leading-relaxed font-light">
                {description}
              </p>
            )}
          </div>
          {(actions || meta) && (
            <div className="flex flex-col items-end gap-4 shrink-0">
              {actions && <div className="flex items-center gap-3">{actions}</div>}
              {meta && <div className="flex items-center gap-3">{meta}</div>}
            </div>
          )}
        </div>

        {stats && stats.length > 0 && (
          <div className="relative border-t border-white/[0.05] grid grid-cols-2 md:grid-cols-4 divide-x divide-white/[0.05]">
            {stats.map((s, i) => {
              const toneMap: Record<string, string> = {
                blue: "text-[#6FB6FF]", amber: "text-amber-300", emerald: "text-emerald-300",
                rose: "text-rose-300", neutral: "text-white",
              };
              return (
                <div key={i} className="px-6 py-5 relative group">
                  <div className="text-[9px] text-white/35 font-mono uppercase tracking-[0.32em] mb-2">{s.label}</div>
                  <div className={cn("text-3xl font-light tabular-nums", toneMap[s.tone || "neutral"])}
                       style={{ fontFamily: "'Fraunces', serif" }}>
                    {s.value}
                  </div>
                  {s.sub && <div className="text-[10px] text-white/30 mt-1 font-mono uppercase tracking-[0.18em]">{s.sub}</div>}
                  <div aria-hidden className="absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-[#0A84FF]/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Body */}
      <div>{children}</div>
    </div>
  );
}

/** Section heading for use inside shell body */
export function AdminSectionLabel({ label, meta }: { label: string; meta?: string }) {
  return (
    <div className="flex items-center gap-4 mb-6">
      <span className="text-[11px] text-white/40 font-bold uppercase tracking-[0.4em]">{label}</span>
      <div className="h-px flex-1 bg-white/5" />
      {meta && <span className="text-[10px] text-white/20 font-mono uppercase tracking-widest">{meta}</span>}
    </div>
  );
}

/** Glass surface card matching Editorial Noir */
export function AdminSurface({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn(
      "rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-md p-6",
      className,
    )}>
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
        <div className="absolute w-[420px] h-[420px] rounded-full border border-white/[0.04]" />
        <div className="absolute w-[300px] h-[300px] rounded-full border border-white/[0.05]" />
        <div className="absolute w-[180px] h-[180px] rounded-full border border-[#0A84FF]/15" />
        <div className="absolute w-[180px] h-[180px] rounded-full"
             style={{ background: "radial-gradient(circle, rgba(10,132,255,0.10), transparent 65%)", filter: "blur(20px)" }} />
      </div>
      <div className="relative z-10 flex flex-col items-center">
        {Icon && (
          <div className="w-14 h-14 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md flex items-center justify-center mb-5 shadow-[0_8px_24px_-12px_rgba(10,132,255,0.4)]">
            <Icon className="w-5 h-5 text-[#6FB6FF]" />
          </div>
        )}
        <span className="text-[9px] text-[#0A84FF]/70 font-mono uppercase tracking-[0.4em] mb-3">
          {code} // STANDBY
        </span>
        <h3 className="text-2xl text-white font-light mb-2" style={{ fontFamily: "'Fraunces', serif" }}>
          {title}
        </h3>
        {hint && <p className="text-[13px] text-white/40 max-w-md leading-relaxed">{hint}</p>}
        {action && <div className="mt-6">{action}</div>}
      </div>
    </div>
  );
}
