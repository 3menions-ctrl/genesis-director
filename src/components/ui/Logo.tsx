import { memo, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import logoImage from '@/assets/apex-studio-logo.png';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  textClassName?: string;
}

const sizeMap = {
  sm: 'w-7 h-7',
  md: 'w-8 h-8',
  lg: 'w-10 h-10',
  xl: 'w-14 h-14',
};

export const Logo = memo(forwardRef<HTMLDivElement, LogoProps>(
  function Logo({ className, size = 'md', showText = false, textClassName }, ref) {
    return (
      <div ref={ref} className={cn("flex items-center gap-2", className)}>
        <img 
          src={logoImage} 
          alt="Apex Studio" 
          className={cn(sizeMap[size], "object-contain")}
        />
        {showText && (
          <span className={cn("font-semibold text-white tracking-tight", textClassName)}>
            Apex-Studio
          </span>
        )}
      </div>
    );
  }
));

Logo.displayName = 'Logo';
