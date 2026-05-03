/**
 * Operations Command Center primitives.
 * Used by every page under src/pages/workspace/* to maintain a coherent,
 * dense, telemetry-driven aesthetic distinct from the personal Pro-Dark shell.
 *
 * Design tokens align with canonical Pro-Dark + blue (hue 215). All surfaces
 * use rounded-2xl glass gradients; mono labels are JetBrains Mono uppercase.
 * No amber/copper/graphite residue — this set was migrated to canonical blue.
 */
import { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─────────── Surface: square graphite panel ─────────── */
export function Surface({
  children, className, padded = true,
}: { children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <div
      className={cn(
        'relative rounded-2xl border border-white/[0.06] shadow-[inset_0_1px_0_hsla(0,0%,100%,0.05),0_10px_28px_-14px_rgba(0,0,0,0.55)]',
        padded && 'p-6',
        className,
      )}
      style={{
        background:
          'linear-gradient(180deg, hsla(220,18%,7%,0.62) 0%, hsla(220,16%,4%,0.62) 100%)',
        backdropFilter: 'blur(18px) saturate(160%)',
        WebkitBackdropFilter: 'blur(18px) saturate(160%)',
      }}
    >
      {children}
    </div>
  );
}

/* ─────────── Section: header + body inside a Surface ─────────── */
export function Section({
  icon: Icon, label, sublabel, action, children, className,
}: {
  icon?: LucideIcon;
  label: string;
  sublabel?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Surface className={className}>
      <header className="flex items-start justify-between gap-4 mb-5 pb-4 border-b border-white/[0.06]">
        <div className="flex items-start gap-3 min-w-0">
          {Icon && (
            <div className="w-8 h-8 rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.06] to-white/[0.015] flex items-center justify-center mt-0.5 shadow-[inset_0_1px_0_hsla(0,0%,100%,0.06)]">
              <Icon className="w-3.5 h-3.5 text-[hsl(215,100%,72%)] drop-shadow-[0_0_8px_hsl(215,100%,55%,0.45)]" strokeWidth={1.5} />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="font-display text-[15px] tracking-[-0.01em] text-white/95 font-light">
              {label}
            </h3>
            {sublabel && (
              <p className="text-[12px] text-white/45 mt-0.5 font-light">
                {sublabel}
              </p>
            )}
          </div>
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </header>
      {children}
    </Surface>
  );
}

/* ─────────── MetricCard: KPI tile with mono label + display value ─────────── */
export function MetricCard({
  label, value, sub, icon: Icon, accent = false, warn = false,
  cta, loading = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  accent?: boolean;
  warn?: boolean;
  cta?: { label: string; onClick: () => void };
  loading?: boolean;
}) {
  return (
    <div
      className="relative group rounded-2xl border border-white/[0.06] hover:border-white/[0.12] transition-all duration-300 p-5 overflow-hidden shadow-[inset_0_1px_0_hsla(0,0%,100%,0.05),0_10px_28px_-14px_rgba(0,0,0,0.55)] hover:shadow-[inset_0_1px_0_hsla(0,0%,100%,0.07),0_18px_44px_-18px_hsla(215,100%,55%,0.30)]"
      style={{
        background:
          'linear-gradient(180deg, hsla(220,18%,7%,0.62) 0%, hsla(220,16%,4%,0.62) 100%)',
        backdropFilter: 'blur(18px) saturate(160%)',
        WebkitBackdropFilter: 'blur(18px) saturate(160%)',
      }}
    >
      {/* Subtle accent glow on hover */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-2xl"
        style={{ background: 'radial-gradient(circle, hsla(215,100%,60%,0.30), transparent 70%)' }}
      />
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/40">
          {label}
        </div>
        {Icon && (
          <Icon
            className={cn(
              'w-3.5 h-3.5',
              warn ? 'text-[hsl(35,90%,68%)]' :
              accent ? 'text-[hsl(215,100%,72%)] drop-shadow-[0_0_8px_hsl(215,100%,55%,0.5)]' : 'text-white/35',
            )}
            strokeWidth={1.5}
          />
        )}
      </div>
      <div className={cn(
        'mt-3 font-display font-light text-[30px] leading-none tabular-nums tracking-[-0.02em]',
        warn ? 'text-[hsl(35,90%,68%)]' :
        accent ? 'text-[hsl(215,100%,78%)]' : 'text-white/95',
      )}>
        {loading ? <span className="text-white/25">—</span> : (typeof value === 'number' ? value.toLocaleString() : value)}
      </div>
      {sub && (
        <div className="text-[11px] text-white/45 mt-2 font-mono">
          {sub}
        </div>
      )}
      {cta && (
        <button
          onClick={cta.onClick}
          className="mt-4 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[hsl(215,100%,72%)] hover:text-[hsl(215,100%,82%)] transition"
        >
          {cta.label} <span className="text-[8px]">→</span>
        </button>
      )}
    </div>
  );
}

/* ─────────── Field: form label + control wrapper ─────────── */
export function Field({
  label, hint, children,
}: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">
        {label}
      </span>
      <div className="mt-2">{children}</div>
      {hint && (
        <span className="block text-[11px] text-white/35 mt-1.5 font-light">
          {hint}
        </span>
      )}
    </label>
  );
}

/* ─────────── PrimaryButton: amber CTA ─────────── */
export function CmdButton({
  children, onClick, disabled, variant = 'primary', type = 'button', className,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'ghost' | 'danger';
  type?: 'button' | 'submit';
  className?: string;
}) {
  const styles = {
    primary: 'rounded-full text-white shadow-[0_10px_28px_-10px_hsla(215,100%,55%,0.55),inset_0_1px_0_hsla(0,0%,100%,0.18)] hover:shadow-[0_16px_40px_-12px_hsla(215,100%,55%,0.7),inset_0_1px_0_hsla(0,0%,100%,0.22)] hover:scale-[1.015] active:scale-[0.985] disabled:opacity-50 disabled:hover:scale-100',
    ghost:   'rounded-full border border-white/[0.08] bg-white/[0.03] text-white/85 hover:bg-white/[0.07] hover:border-white/[0.14] hover:text-white',
    danger:  'rounded-full border border-[hsl(0,70%,55%)]/30 bg-[hsl(0,70%,40%)]/10 text-[hsl(0,80%,76%)] hover:bg-[hsl(0,70%,40%)]/20',
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 px-5 h-10 text-[12px] font-light tracking-[-0.005em] transition-all duration-300 disabled:cursor-not-allowed',
        styles,
        className,
      )}
      style={
        variant === 'primary'
          ? { background: 'linear-gradient(180deg, hsl(215,100%,60%), hsl(215,100%,46%))' }
          : undefined
      }
    >
      {children}
    </button>
  );
}

/* ─────────── DataInput: square graphite text input ─────────── */
export function DataInput({
  className, ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'w-full px-3.5 h-10 rounded-xl bg-white/[0.03] border border-white/[0.08] text-[13px] text-white/90 font-light',
        'placeholder:text-white/30',
        'focus:outline-none focus:border-[hsl(215,100%,55%)]/60 focus:ring-2 focus:ring-[hsl(215,100%,55%)]/25 focus:bg-white/[0.05]',
        'disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
        className,
      )}
    />
  );
}

/* ─────────── DataTextarea ─────────── */
export function DataTextarea({
  className, ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        'w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-[13px] text-white/90 font-light',
        'placeholder:text-white/30',
        'focus:outline-none focus:border-[hsl(215,100%,55%)]/60 focus:ring-2 focus:ring-[hsl(215,100%,55%)]/25 focus:bg-white/[0.05]',
        'disabled:opacity-50 disabled:cursor-not-allowed transition-colors resize-y',
        className,
      )}
    />
  );
}

/* ─────────── Pill: status / role chip ─────────── */
export function Pill({
  children, tone = 'neutral', className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'amber' | 'good' | 'warn' | 'bad';
  className?: string;
}) {
  const tones = {
    neutral: 'border-white/[0.08] bg-white/[0.04] text-white/75',
    amber:   'border-[hsl(215,100%,60%)]/30 bg-[hsl(215,100%,55%)]/10 text-[hsl(215,100%,80%)]',
    good:    'border-[hsl(140,70%,50%)]/30 bg-[hsl(140,70%,40%)]/10 text-[hsl(140,70%,75%)]',
    warn:    'border-[hsl(45,90%,55%)]/30 bg-[hsl(45,90%,40%)]/10 text-[hsl(45,90%,76%)]',
    bad:     'border-[hsl(0,70%,55%)]/30 bg-[hsl(0,70%,40%)]/10 text-[hsl(0,80%,76%)]',
  }[tone];
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-mono text-[10px] uppercase tracking-[0.18em]',
      tones, className,
    )}>
      {children}
    </span>
  );
}
