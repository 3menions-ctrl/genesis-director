import { ReactNode, HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  hover?: boolean;
  padded?: boolean;
}

/**
 * Surface — unified glass card for in-app pages.
 * Use everywhere instead of inline border/bg/blur combinations.
 */
export function Surface({
  children,
  hover = false,
  padded = true,
  className,
  ...rest
}: SurfaceProps) {
  return (
    <div
      className={cn(
        'surface-card',
        hover && 'surface-card-hover',
        padded && 'p-6 sm:p-8',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export default Surface;