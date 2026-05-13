/**
 * AdminConsoleScaffold — premium "operator console" body for surfaces that
 * are still being commissioned or whose primary content is administrative.
 * Renders capability grid, live activity rail, and a cinematic CTA panel.
 */
import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Activity, Sparkles, ArrowUpRight, Lock, Zap, ShieldCheck } from "lucide-react";

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

const toneText: Record<string, string> = {
  blue: "text-[#6FB6FF]", amber: "text-amber-300",
  emerald: "text-emerald-300", rose: "text-rose-300", neutral: "text-white",
};

const statusBadge: Record<string, { color: string; label: string }> = {
  online:        { color: "text-emerald-300 border-emerald-400/40 bg-emerald-500/[0.06]", label: "ONLINE" },
  commissioning: { color: "text-amber-300 border-amber-400/40 bg-amber-500/[0.06]",       label: "COMMISSIONING" },
  scoped:        { color: "text-[#6FB6FF] border-[#0A84FF]/40 bg-[#0A84FF]/[0.06]",       label: "SCOPED" },
};

export function AdminConsoleScaffold({
  intro, capabilities, signals, primaryCta, secondaryCta, manifest, status = "scoped", children,
}: Props) {
  const s = statusBadge[status];
  return (
    <div className="space-y-10">
      {/* Intro band */}
      <div className="relative rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.025] to-transparent p-8 lg:p-10 overflow-hidden">
        <div aria-hidden className="absolute -top-24 right-0 w-[420px] h-[420px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(10,132,255,0.12), transparent 65%)", filter: "blur(60px)" }} />
        <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 mb-4">
              <span className={cn("px-2.5 py-1 rounded-full border text-[9px] font-mono font-bold tracking-[0.32em] uppercase", s.color)}>
                {s.label}
              </span>
              <span className="h-px w-8 bg-white/10" />
              <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/30">Operator Console</span>
            </div>
            <p className="text-[15px] text-white/65 leading-relaxed font-light max-w-xl"
              style={{ fontFamily: "'Fraunces', serif" }}>
              {intro}
            </p>
          </div>
          {(primaryCta || secondaryCta) && (
            <div className="flex items-center gap-3 shrink-0">
              {secondaryCta && (
                <a href={secondaryCta.href} onClick={secondaryCta.onClick}
                  className="text-[11px] uppercase tracking-[0.22em] text-white/45 hover:text-white px-4 py-2.5 rounded-lg border border-white/[0.06] hover:border-white/20 transition-colors">
                  {secondaryCta.label}
                </a>
              )}
              {primaryCta && (
                <a href={primaryCta.href} onClick={primaryCta.onClick}
                  className="group inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] font-semibold text-white px-5 py-2.5 rounded-lg border border-[#0A84FF]/50 bg-gradient-to-b from-[#0A84FF] to-[#0A6CCC] shadow-[0_8px_24px_-10px_rgba(10,132,255,0.6)] hover:shadow-[0_12px_32px_-10px_rgba(10,132,255,0.8)] transition-shadow">
                  {primaryCta.label}
                  <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </a>
              )}
            </div>
          )}
        </div>

        {signals && signals.length > 0 && (
          <div className="relative mt-8 pt-6 border-t border-white/[0.05] grid grid-cols-2 md:grid-cols-4 gap-6">
            {signals.map((s, i) => (
              <div key={i}>
                <div className="text-[9px] text-white/35 font-mono uppercase tracking-[0.32em] mb-2">{s.label}</div>
                <div className={cn("text-2xl font-light tabular-nums", toneText[s.tone || "neutral"])}
                  style={{ fontFamily: "'Fraunces', serif" }}>{s.value}</div>
                {s.trend && <div className="text-[10px] text-white/30 mt-1 font-mono uppercase tracking-[0.2em]">{s.trend}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Capabilities grid */}
      <section>
        <div className="flex items-center gap-4 mb-6">
          <span className="text-[11px] text-white/40 font-bold uppercase tracking-[0.4em]">Surface Capabilities</span>
          <div className="h-px flex-1 bg-white/5" />
          <span className="text-[10px] text-white/20 font-mono uppercase tracking-widest">{capabilities.length} modules</span>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {capabilities.map((c, i) => {
            const Icon = c.icon;
            const statusDot = c.status === "live" ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]"
                            : c.status === "queued" ? "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]"
                            : c.status === "wired" ? "bg-[#0A84FF] shadow-[0_0_6px_rgba(10,132,255,0.6)]"
                            : "bg-white/30";
            return (
              <div key={i} className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-md p-5 hover:border-[#0A84FF]/30 hover:bg-white/[0.035] transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl border border-white/10 bg-white/[0.03] flex items-center justify-center">
                    <Icon className="w-4 h-4 text-[#6FB6FF]" />
                  </div>
                  <span className={cn("w-1.5 h-1.5 rounded-full", statusDot)} title={c.status} />
                </div>
                <h3 className="text-[15px] text-white font-light mb-1.5" style={{ fontFamily: "'Fraunces', serif" }}>
                  {c.title}
                </h3>
                <p className="text-[12px] text-white/45 leading-relaxed">{c.description}</p>
                <div aria-hidden className="absolute inset-x-5 bottom-0 h-px bg-gradient-to-r from-transparent via-[#0A84FF]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            );
          })}
        </div>
      </section>

      {manifest && (
        <section className="rounded-2xl border border-white/[0.06] bg-[radial-gradient(circle_at_top_right,rgba(10,132,255,0.08),transparent_60%)] p-8">
          <div className="flex items-center gap-3 mb-5">
            <Lock className="w-3.5 h-3.5 text-[#6FB6FF]" />
            <span className="text-[10px] font-mono uppercase tracking-[0.32em] text-white/45">{manifest.title}</span>
          </div>
          <ul className="space-y-2.5">
            {manifest.lines.map((l, i) => (
              <li key={i} className="flex items-start gap-3 text-[13px] text-white/60 leading-relaxed">
                <span className="text-[#0A84FF] mt-[7px] w-1 h-1 rounded-full bg-[#0A84FF] shrink-0" />
                {l}
              </li>
            ))}
          </ul>
        </section>
      )}

      {children}
    </div>
  );
}

export const ConsoleIcons = { Activity, Sparkles, Zap, ShieldCheck };
