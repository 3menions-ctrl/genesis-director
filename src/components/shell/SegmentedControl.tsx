import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

export interface SegmentItem<T extends string> {
  key: T;
  label: string;
  icon?: LucideIcon;
  count?: number;
}

interface SegmentedControlProps<T extends string> {
  items: SegmentItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/**
 * SegmentedControl — minimal blue-underline tabs used across in-app pages.
 * Replaces violet/cyan filled pills.
 */
export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-1 border-b border-white/[0.06]',
        className
      )}
    >
      {items.map((item) => {
        const isActive = item.key === value;
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.key)}
            className={cn(
              'relative -mb-px flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors duration-200',
              isActive ? 'text-white' : 'text-white/40 hover:text-white/70'
            )}
          >
            {Icon && <Icon className={cn('w-4 h-4', isActive ? 'text-primary' : 'opacity-60')} />}
            <span>{item.label}</span>
            {typeof item.count === 'number' && item.count > 0 && (
              <span
                className={cn(
                  'text-[10px] tabular-nums px-1.5 py-0.5 rounded-md font-medium',
                  isActive ? 'bg-primary/15 text-primary' : 'bg-white/[0.04] text-white/40'
                )}
              >
                {item.count}
              </span>
            )}
            <span
              className={cn(
                'pointer-events-none absolute inset-x-2 -bottom-px h-0.5 rounded-full transition-all duration-300',
                isActive ? 'bg-primary opacity-100' : 'bg-primary opacity-0'
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;