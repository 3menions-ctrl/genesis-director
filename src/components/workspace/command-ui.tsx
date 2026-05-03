/**
 * Operations Command Center primitives.
 * Used by every page under src/pages/workspace/* to maintain a coherent,
 * dense, telemetry-driven aesthetic distinct from the personal Pro-Dark shell.
 *
 * Design tokens (inline; do NOT promote to global CSS):
 *   ground hsl(35,10%,4%) · surface hsl(35,12%,5-7%) · border hsl(35,12%,12-16%)
 *   text 92/72/55/40% · accent hsl(28,90%,60%) amber/copper · nominal hsl(140,70%,50%)
 *   square edges (rounded-sm max), JetBrains Mono uppercase labels.
 */
import { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─────────── Surface: square graphite panel ─────────── */
export function Surface({
  children, className, padded = true,
}: { children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <div className={cn(
      'border border-[hsl(35,12%,12%)] bg-[hsl(35,12%,5%)]',
      padded && 'p-6',
      className,
    )}>
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
      <header className="flex items-start justify-between gap-4 mb-5 pb-4 border-b border-[hsl(35,12%,12%)]">
        <div className="flex items-start gap-3 min-w-0">
          {Icon && (
            <div className="w-7 h-7 border border-[hsl(35,12%,16%)] bg-[hsl(35,12%,7%)] flex items-center justify-center mt-0.5">
              <Icon className="w-3.5 h-3.5 text-[hsl(28,90%,62%)]" strokeWidth={1.5} />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="font-mono text-[11px] uppercase tracking-[0.24em] text-[hsl(35,12%,92%)]">
              {label}
            </h3>
            {sublabel && (
              <p className="text-[12px] text-[hsl(35,8%,55%)] mt-1 font-light">
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
    <div className="border border-[hsl(35,12%,12%)] bg-[hsl(35,12%,5%)] p-5 relative group hover:border-[hsl(35,12%,18%)] transition-colors">
      {/* corner registration mark */}
      <span className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[hsl(28,90%,60%)] opacity-60" />
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-[hsl(35,8%,55%)]">
          {label}
        </div>
        {Icon && (
          <Icon
            className={cn(
              'w-3.5 h-3.5',
              warn ? 'text-[hsl(35,90%,60%)]' :
              accent ? 'text-[hsl(28,90%,62%)]' : 'text-[hsl(35,8%,45%)]',
            )}
            strokeWidth={1.5}
          />
        )}
      </div>
      <div className={cn(
        'mt-3 font-display font-light text-[28px] leading-none tabular-nums',
        warn ? 'text-[hsl(35,90%,60%)]' :
        accent ? 'text-[hsl(28,90%,62%)]' : 'text-[hsl(35,12%,98%)]',
      )}>
        {loading ? <span className="text-[hsl(35,8%,40%)]">—</span> : (typeof value === 'number' ? value.toLocaleString() : value)}
      </div>
      {sub && (
        <div className="text-[11px] text-[hsl(35,8%,55%)] mt-2 font-mono">
          {sub}
        </div>
      )}
      {cta && (
        <button
          onClick={cta.onClick}
          className="mt-3 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[hsl(28,90%,62%)] hover:text-[hsl(28,90%,72%)] transition"
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
      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[hsl(35,8%,55%)]">
        {label}
      </span>
      <div className="mt-2">{children}</div>
      {hint && (
        <span className="block text-[11px] text-[hsl(35,8%,45%)] mt-1.5 font-light">
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
    primary: 'bg-[hsl(28,90%,55%)] text-[hsl(35,12%,4%)] hover:bg-[hsl(28,90%,62%)] disabled:bg-[hsl(35,12%,10%)] disabled:text-[hsl(35,8%,45%)]',
    ghost:   'border border-[hsl(35,12%,16%)] bg-[hsl(35,12%,7%)] text-[hsl(35,12%,82%)] hover:bg-[hsl(35,12%,10%)] hover:border-[hsl(35,12%,22%)]',
    danger:  'border border-[hsl(0,70%,40%)]/40 bg-[hsl(0,70%,40%)]/10 text-[hsl(0,80%,70%)] hover:bg-[hsl(0,70%,40%)]/20',
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.20em] transition-colors disabled:cursor-not-allowed',
        styles,
        className,
      )}
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
        'w-full px-3 py-2 bg-[hsl(35,12%,4%)] border border-[hsl(35,12%,16%)] text-[13px] text-[hsl(35,12%,92%)] font-mono',
        'placeholder:text-[hsl(35,8%,40%)]',
        'focus:outline-none focus:border-[hsl(28,90%,55%)] focus:ring-1 focus:ring-[hsl(28,90%,55%)]/30',
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
        'w-full px-3 py-2 bg-[hsl(35,12%,4%)] border border-[hsl(35,12%,16%)] text-[13px] text-[hsl(35,12%,92%)] font-mono',
        'placeholder:text-[hsl(35,8%,40%)]',
        'focus:outline-none focus:border-[hsl(28,90%,55%)] focus:ring-1 focus:ring-[hsl(28,90%,55%)]/30',
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
    neutral: 'border-[hsl(35,12%,16%)] bg-[hsl(35,12%,7%)] text-[hsl(35,12%,72%)]',
    amber:   'border-[hsl(28,90%,40%)]/40 bg-[hsl(28,90%,40%)]/10 text-[hsl(28,90%,72%)]',
    good:    'border-[hsl(140,70%,40%)]/40 bg-[hsl(140,70%,40%)]/10 text-[hsl(140,70%,70%)]',
    warn:    'border-[hsl(45,90%,40%)]/40 bg-[hsl(45,90%,40%)]/10 text-[hsl(45,90%,72%)]',
    bad:     'border-[hsl(0,70%,40%)]/40 bg-[hsl(0,70%,40%)]/10 text-[hsl(0,80%,70%)]',
  }[tone];
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2 py-0.5 border font-mono text-[10px] uppercase tracking-[0.18em]',
      tones, className,
    )}>
      {children}
    </span>
  );
}
