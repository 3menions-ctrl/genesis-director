import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
  /** Optional sub-row rendered below the divider (toolbar, tabs, filters) */
  toolbar?: ReactNode;
}

/**
 * PageHeader — editorial page header with eyebrow, display title,
 * subtitle, optional actions, hairline divider and optional toolbar row.
 */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
  toolbar,
}: PageHeaderProps) {
  return (
    <header className={cn('mb-10 sm:mb-14 animate-fade-in', className)}>
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div className="min-w-0">
          {eyebrow && <div className="text-eyebrow mb-3">{eyebrow}</div>}
          <h1 className="text-display">{title}</h1>
          {subtitle && (
            <p className="text-body-muted mt-3 max-w-xl">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0">{actions}</div>
        )}
      </div>
      <div className="hairline mt-8" />
      {toolbar && <div className="mt-6">{toolbar}</div>}
    </header>
  );
}

export default PageHeader;