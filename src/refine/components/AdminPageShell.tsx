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
  children: ReactNode;
  className?: string;
  contained?: boolean;      // wrap children in max-w container (default true)
}

export function AdminPageShell({
  eyebrow, code, title, italic, description, actions, children, className, contained = true,
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
          {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
        </div>
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
