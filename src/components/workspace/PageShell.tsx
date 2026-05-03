/**
 * Workspace page shell — used by every /workspace/* page so each
 * route gets the Operations Command Center chrome (sidebar, masthead,
 * top utility strip) plus a consistent in-page heading + body slot.
 */
import { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { WorkspaceLayout } from './WorkspaceLayout';
import { cn } from '@/lib/utils';

export function WorkspacePage({
  icon: Icon,
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
}: {
  icon?: LucideIcon;
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <WorkspaceLayout>
      <div className={cn('space-y-8', className)}>
        <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 pb-6 border-b border-white/[0.06]">
          <div className="flex items-start gap-4 min-w-0">
            {Icon && (
              <div className="relative w-12 h-12 rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.07] to-white/[0.015] flex items-center justify-center shrink-0 shadow-[inset_0_1px_0_hsla(0,0%,100%,0.06),0_8px_20px_-10px_rgba(0,0,0,0.5)]">
                <Icon className="w-4 h-4 text-[hsl(215,100%,72%)] drop-shadow-[0_0_10px_hsl(215,100%,55%,0.55)]" strokeWidth={1.5} />
              </div>
            )}
            <div className="min-w-0">
              <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-[hsl(215,100%,72%)]/70">
                {eyebrow}
              </div>
              <h1 className="font-display text-[30px] sm:text-[38px] leading-[1.05] font-light text-white/95 mt-1.5 tracking-[-0.02em]">
                {title}
              </h1>
              {description && (
                <p className="text-[13.5px] text-white/50 mt-2 font-light max-w-2xl leading-[1.55]">
                  {description}
                </p>
              )}
            </div>
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </header>
        {children}
      </div>
    </WorkspaceLayout>
  );
}

/** Empty state used when a feature has no data yet. */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.015] p-14 text-center backdrop-blur-sm">
      {Icon && (
        <div className="w-12 h-12 mx-auto mb-4 rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.07] to-white/[0.015] flex items-center justify-center shadow-[inset_0_1px_0_hsla(0,0%,100%,0.06)]">
          <Icon className="w-4 h-4 text-[hsl(215,100%,72%)]" strokeWidth={1.5} />
        </div>
      )}
      <div className="font-display text-[16px] tracking-[-0.01em] text-white/90 font-light">
        {title}
      </div>
      {body && (
        <p className="text-[13px] text-white/45 mt-2 max-w-md mx-auto font-light leading-[1.55]">
          {body}
        </p>
      )}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}