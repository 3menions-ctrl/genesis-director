/**
 * AdminConsoleScaffold — premium "operator console" body for surfaces that
 * are still being commissioned or whose primary content is administrative.
 * Renders capability grid, live activity rail, and a cinematic CTA panel.
 */
import { ReactNode } from "react";
import { Activity, Sparkles, ArrowUpRight, Lock, Zap, ShieldCheck } from "lucide-react";
import { AdminCard, ACCENT_HSL, accent, CYAN, AMBER, ROSE } from "@/admin/ui/primitives";

export interface ConsoleCapability {
  title: string;
  description: string;
  icon: React.ElementType;
  status?: "live" | "queued" | "wired" | "manual";
}

export interface ConsoleSignal {
  label: string;
  value: ReactNode;
  trend?: string;
  tone?: "blue" | "amber" | "emerald" | "rose" | "neutral";
}

interface Props {
  intro: string;
  capabilities: ConsoleCapability[];
  signals?: ConsoleSignal[];
  primaryCta?: { label: string; onClick?: () => void; href?: string };
  secondaryCta?: { label: string; onClick?: () => void; href?: string };
  manifest?: { title: string; lines: string[] };
  status?: "online" | "commissioning" | "scoped";
  children?: ReactNode;
}

const toneColor: Record<string, string> = {
  blue: ACCENT_HSL, amber: AMBER, emerald: CYAN, rose: ROSE, neutral: "#fff",
};

const statusBadge: Record<string, { fg: string; bg: string; label: string }> = {
  online:        { fg: CYAN, bg: "hsl(188 92% 58% / 0.12)", label: "ONLINE" },
  commissioning: { fg: AMBER, bg: "hsl(38 96% 62% / 0.12)", label: "COMMISSIONING" },
  scoped:        { fg: ACCENT_HSL, bg: accent(0.14),        label: "SCOPED" },
};

export function AdminConsoleScaffold({
  intro, capabilities, signals, primaryCta, secondaryCta, manifest, status = "scoped", children,
}: Props) {
  const s = statusBadge[status];
  return (
    <div className="space-y-10">
      {/* Intro band */}
      <AdminCard className="p-8 lg:p-10">
        <div aria-hidden className="absolute -top-24 right-0 w-[420px] h-[420px] rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, ${accent(0.16)}, transparent 65%)`, filter: "blur(60px)" }} />
        <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 mb-4">
              <span className="px-2.5 py-1 rounded-full text-[9px] font-mono font-bold tracking-[0.32em] uppercase"
                style={{ color: s.fg, background: s.bg }}>
                {s.label}
              </span>
              <span className="h-px w-8 bg-[#f6f8fc]" />
              <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-[#9aa4b8]">Operator Console</span>
            </div>
            <p className="text-[15px] text-[#0c1426] leading-relaxed font-light max-w-xl">
              {intro}
            </p>
          </div>
          {(primaryCta || secondaryCta) && (
            <div className="flex items-center gap-3 shrink-0">
              {secondaryCta && (
                <a href={secondaryCta.href} onClick={secondaryCta.onClick}
                  className="text-[11px] uppercase tracking-[0.22em] text-[#5d6a82] hover:text-[#0c1426] px-4 py-2.5 rounded-full bg-[#f6f8fc] hover:bg-[#f4f7ff] transition-colors">
                  {secondaryCta.label}
                </a>
              )}
              {primaryCta && (
                <a href={primaryCta.href} onClick={primaryCta.onClick}
                  className="group inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] font-semibold text-[#0a0b0e] px-5 py-2.5 rounded-full bg-white hover:bg-white/90 transition-colors">
                  {primaryCta.label}
                  <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </a>
              )}
            </div>
          )}
        </div>

        {signals && signals.length > 0 && (
          <div className="relative mt-8 pt-6 grid grid-cols-2 md:grid-cols-4 gap-6">
            <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)" }} />
            {signals.map((sig, i) => (
              <div key={i}>
                <div className="text-[9px] text-[#5d6a82] font-mono uppercase tracking-[0.32em] mb-2">{sig.label}</div>
                <div className="text-2xl font-display font-semibold tracking-[-0.02em] tabular-nums" style={{ color: toneColor[sig.tone || "neutral"] }}>{sig.value}</div>
                {sig.trend && <div className="text-[10px] text-[#9aa4b8] mt-1 font-mono uppercase tracking-[0.2em]">{sig.trend}</div>}
              </div>
            ))}
          </div>
        )}
      </AdminCard>

      {/* Capabilities grid */}
      <section>
        <div className="flex items-center gap-4 mb-6">
          <span className="text-[11px] text-[#5d6a82] font-mono font-bold uppercase tracking-[0.2em]">Surface Capabilities</span>
          <div className="h-px flex-1 bg-[#f6f8fc]" />
          <span className="text-[10px] text-[#9aa4b8] font-mono uppercase tracking-widest">{capabilities.length} modules</span>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {capabilities.map((c, i) => {
            const Icon = c.icon;
            const dotColor = c.status === "live" ? CYAN
                            : c.status === "queued" ? AMBER
                            : c.status === "wired" ? ACCENT_HSL
                            : "rgba(255,255,255,0.3)";
            return (
              <AdminCard key={i} lift className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${accent(0.2)}, ${accent(0.06)})`, color: ACCENT_HSL }}>
                    <Icon className="w-4 h-4" strokeWidth={1.8} />
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: dotColor, boxShadow: `0 0 8px ${dotColor}` }} title={c.status} />
                </div>
                <h3 className="font-display text-[15px] text-[#0c1426] font-semibold tracking-[-0.02em] mb-1.5">
                  {c.title}
                </h3>
                <p className="text-[12px] text-[#5d6a82] leading-relaxed">{c.description}</p>
              </AdminCard>
            );
          })}
        </div>
      </section>

      {manifest && (
        <AdminCard className="p-8">
          <span aria-hidden className="pointer-events-none absolute -top-24 -right-16 w-[360px] h-[360px] rounded-full" style={{ background: `radial-gradient(circle, ${accent(0.1)}, transparent 60%)`, filter: "blur(50px)" }} />
          <div className="relative flex items-center gap-3 mb-5">
            <Lock className="w-3.5 h-3.5" style={{ color: ACCENT_HSL }} />
            <span className="text-[10px] font-mono uppercase tracking-[0.32em] text-[#5d6a82]">{manifest.title}</span>
          </div>
          <ul className="relative space-y-2.5">
            {manifest.lines.map((l, i) => (
              <li key={i} className="flex items-start gap-3 text-[13px] text-[#5d6a82] leading-relaxed">
                <span className="mt-[7px] w-1 h-1 rounded-full shrink-0" style={{ background: ACCENT_HSL, boxShadow: `0 0 6px ${accent(0.7)}` }} />
                {l}
              </li>
            ))}
          </ul>
        </AdminCard>
      )}

      {children}
    </div>
  );
}

export const ConsoleIcons = { Activity, Sparkles, Zap, ShieldCheck };
