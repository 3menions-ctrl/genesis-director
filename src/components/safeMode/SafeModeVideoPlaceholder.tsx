/**
 * SafeModeVideoPlaceholder - Shown instead of video players in safe mode
 * 
 * Provides a visual placeholder that explains why video is disabled
 */

import { memo } from 'react';
import { VideoOff, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SafeModeVideoPlaceholderProps {
  className?: string;
  aspectRatio?: '16/9' | '9/16' | '1/1';
}

export const SafeModeVideoPlaceholder = memo(function SafeModeVideoPlaceholder({
  className,
  aspectRatio = '16/9',
}: SafeModeVideoPlaceholderProps) {
  return (
    <div 
      className={cn(
        "relative w-full bg-muted rounded-lg overflow-hidden flex items-center justify-center",
        aspectRatio === '16/9' && "aspect-video",
        aspectRatio === '9/16' && "aspect-[9/16]",
        aspectRatio === '1/1' && "aspect-square",
        className
      )}
    >
      <div className="flex flex-col items-center gap-2 text-muted-foreground p-4 text-center">
        <div className="relative">
          <VideoOff className="w-8 h-8 opacity-50" />
          <Shield className="w-4 h-4 absolute -bottom-1 -right-1 text-warning" />
        </div>
        <p className="text-xs font-medium">Video disabled</p>
        <p className="text-[10px] opacity-70">Safe mode active</p>
      </div>
    </div>
  );
});

export default SafeModeVideoPlaceholder;
