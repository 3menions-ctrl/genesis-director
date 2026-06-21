/**
 * Phase 4: Creator Spotlight Card
 * 
 * Futuristic glassmorphic card with holographic border,
 * hover shine effect, and cinematic styling.
 */

import { memo, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Heart, Video, Eye } from 'lucide-react';

interface CreatorSpotlightCardProps {
  displayName: string;
  avatarUrl?: string;
  videoCount: number;
  likesCount: number;
  thumbnailUrl?: string;
  onView?: () => void;
  className?: string;
  featured?: boolean;
}

export const CreatorSpotlightCard = memo(forwardRef<HTMLDivElement, CreatorSpotlightCardProps>(
  function CreatorSpotlightCard({
    displayName,
    avatarUrl,
    videoCount,
    likesCount,
    thumbnailUrl,
    onView,
    className,
    featured = false,
  }, ref) {
    return (
      <div
        ref={ref}
        onClick={onView}
        className={cn(
          "group relative cursor-pointer holo-shine",
          "rounded-2xl overflow-hidden transition-all duration-500",
          "hover:-translate-y-1.5 hover:shadow-[0_20px_60px_-15px_hsl(263_70%_58%/0.2)]",
          className
        )}
      >
        {/* Holographic border */}
        <div className={cn(
          "absolute -inset-px rounded-2xl",
          featured 
            ? "holo-border-gradient" 
            : "bg-gradient-to-br from-white/[0.08] via-white/[0.04] to-white/[0.08] group-hover:from-primary/30 group-hover:via-accent/20 group-hover:to-primary/30 transition-all duration-700"
        )} />

        {/* Inner surface */}
        <div className="absolute inset-px rounded-[calc(1rem-1px)] bg-gradient-to-br from-[#0c0e18] via-[#080a14] to-[#060810]" />

        {/* Content */}
        <div className="relative p-5">
          {/* Thumbnail preview */}
          {thumbnailUrl && (
            <div className="relative aspect-video rounded-xl overflow-hidden mb-4 bg-white/[0.03]">
              <img 
                src={thumbnailUrl} 
                alt={displayName}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              
              {/* View overlay */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
                  <Eye className="w-5 h-5 text-white" />
                </div>
              </div>

              {featured && (
                <div className="absolute top-2 left-2 px-2.5 py-1 rounded-full bg-primary/20 border border-primary/30 backdrop-blur-md">
                  <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-primary-foreground/80">Featured</span>
                </div>
              )}
            </div>
          )}

          {/* Creator info */}
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/[0.06] border border-white/[0.1] flex-shrink-0 group-hover:border-primary/30 transition-colors duration-500">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/30 text-sm font-bold">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white/90 truncate group-hover:text-white transition-colors">
                {displayName}
              </h3>
              <p className="text-[10px] text-white/30 uppercase tracking-[0.1em]">Creator</p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 pt-3 border-t border-white/[0.06]">
            <div className="flex items-center gap-1.5">
              <Video className="w-3.5 h-3.5 text-white/25" />
              <span className="text-xs text-white/40 tabular-nums">{videoCount}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 text-white/25" />
              <span className="text-xs text-white/40 tabular-nums">{likesCount}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }
));

CreatorSpotlightCard.displayName = 'CreatorSpotlightCard';
