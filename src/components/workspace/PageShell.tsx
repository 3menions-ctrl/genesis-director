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
        <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 pb-6 border-b border-[hsl(220,14%,12%)]">
          <div className="flex items-start gap-4 min-w-0">
            {Icon && (
              <div className="w-11 h-11 border border-[hsl(220,14%,16%)] bg-[hsl(220,14%,6%)] flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-[hsl(215,100%,62%)]" strokeWidth={1.5} />
              </div>
            )}
            <div className="min-w-0">
              <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-[hsl(220,8%,45%)]">
                {eyebrow}
              </div>
              <h1 className="font-display text-[28px] sm:text-[34px] leading-tight font-light text-[hsl(220,14%,96%)] mt-1 tracking-tight">
                {title}
              </h1>
              {description && (
                <p className="text-[13px] text-[hsl(220,8%,55%)] mt-1.5 font-light max-w-2xl">
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
    <div className="border border-dashed border-[hsl(220,14%,14%)] bg-[hsl(220,14%,4%)] p-12 text-center">
      {Icon && (
        <div className="w-12 h-12 mx-auto mb-4 border border-[hsl(220,14%,16%)] bg-[hsl(220,14%,6%)] flex items-center justify-center">
          <Icon className="w-4 h-4 text-[hsl(215,100%,62%)]" strokeWidth={1.5} />
        </div>
      )}
      <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-[hsl(220,14%,90%)]">
        {title}
      </div>
      {body && (
        <p className="text-[13px] text-[hsl(220,8%,55%)] mt-2 max-w-md mx-auto font-light">
          {body}
        </p>
      )}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}