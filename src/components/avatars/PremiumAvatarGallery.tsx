import React, { useState, useRef, useEffect, useCallback, forwardRef, memo } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Crown, Volume2, Loader2, Check, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AvatarTemplate } from '@/types/avatar-templates';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AppLoader } from '@/components/ui/app-loader';
import { useIsMobile } from '@/hooks/use-mobile';

interface PremiumAvatarGalleryProps {
  avatars: AvatarTemplate[];
  selectedAvatar: AvatarTemplate | null;
  onAvatarClick: (avatar: AvatarTemplate) => void;
  onVoicePreview: (avatar: AvatarTemplate) => void;
  previewingVoice: string | null;
  isLoading?: boolean;
}

// Avatar card component with forwardRef for Framer Motion compatibility
const AvatarCard = forwardRef<HTMLDivElement, {
  avatar: AvatarTemplate;
  isSelected: boolean;
  isHovered: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onClick: () => void;
  onVoicePreview: () => void;
  isPreviewingVoice: boolean;
  cardWidth: number;
  index: number;
  isMobile: boolean;
}>(({ 
  avatar, 
  isSelected, 
  isHovered, 
  onHoverStart, 
  onHoverEnd, 
  onClick, 
  onVoicePreview,
  isPreviewingVoice,
  cardWidth,
  index,
  isMobile
}, ref) => {
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.03, duration: 0.3 }}
      onHoverStart={onHoverStart}
      onHoverEnd={onHoverEnd}
      onClick={onClick}
      className={cn(
        "relative flex-shrink-0 cursor-pointer transition-all duration-300",
        "rounded-2xl md:rounded-3xl overflow-hidden",
        isSelected && "ring-2 ring-violet-500 ring-offset-2 ring-offset-black"
      )}
      style={{
        width: cardWidth,
        scrollSnapAlign: 'center',
        transform: isHovered && !isSelected ? 'scale(1.02)' : 'scale(1)',
      }}
    >
      {/* Card Background with Glassmorphism */}
      <div className={cn(
        "absolute inset-0 transition-all duration-300",
        isSelected 
          ? "bg-gradient-to-b from-violet-500/20 to-violet-900/30" 
          : "bg-gradient-to-b from-white/[0.03] to-black/50",
        "backdrop-blur-sm"
      )} />
      
      {/* Full-Body Avatar Image */}
      <div className="relative aspect-[3/4] overflow-hidden">
        <motion.img
          src={avatar.front_image_url || avatar.face_image_url}
          alt={avatar.name}
          className="w-full h-full object-cover object-top"
          loading="lazy"
          animate={{
            scale: isHovered ? 1.05 : 1,
          }}
          transition={{ duration: 0.4 }}
        />
        
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-90" />
        
        {/* Selection indicator */}
        {isSelected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-3 md:top-4 right-3 md:right-4 w-7 h-7 md:w-8 md:h-8 rounded-full bg-violet-500 flex items-center justify-center shadow-lg shadow-violet-500/50"
          >
            <Check className="w-4 h-4 md:w-5 md:h-5 text-white" />
          </motion.div>
        )}
        
        {/* Premium badge */}
        {avatar.is_premium && (
          <Badge className="absolute top-3 md:top-4 left-3 md:left-4 bg-gradient-to-r from-amber-500 to-amber-400 text-black text-[10px] md:text-xs px-2 py-0.5 md:py-1 shadow-lg">
            <Crown className="w-2.5 h-2.5 md:w-3 md:h-3 mr-1" />
            PRO
          </Badge>
        )}
        
        {/* Avatar type badge */}
        {avatar.avatar_type && (
          <div className={cn(
            "absolute bottom-14 md:bottom-20 left-3 md:left-4 px-2 py-1 rounded-full text-[10px] md:text-xs font-medium",
            avatar.avatar_type === 'realistic' 
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
              : "bg-violet-500/20 text-violet-300 border border-violet-500/30"
          )}>
            {avatar.avatar_type === 'realistic' ? 'Realistic' : 'Animated'}
          </div>
        )}
        
        {/* Voice preview button - always visible on mobile, hover on desktop */}
        {(isMobile || isHovered) && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            onClick={(e) => {
              e.stopPropagation();
              onVoicePreview();
            }}
            className="absolute bottom-16 md:bottom-24 right-3 md:right-4 w-9 h-9 md:w-10 md:h-10 rounded-full bg-violet-500/90 hover:bg-violet-400 flex items-center justify-center transition-colors shadow-lg shadow-violet-500/30"
          >
            {isPreviewingVoice ? (
              <Loader2 className="w-4 h-4 md:w-5 md:h-5 text-white animate-spin" />
            ) : (
              <Volume2 className="w-4 h-4 md:w-5 md:h-5 text-white" />
            )}
          </motion.button>
        )}
      </div>
      
      {/* Info Panel */}
      <div className="relative p-3 md:p-5 space-y-1.5 md:space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-white text-sm md:text-lg truncate pr-2">{avatar.name}</h4>
          {avatar.style && (
            <span className="text-[10px] md:text-xs text-white/40 capitalize shrink-0">{avatar.style}</span>
          )}
        </div>
        <p className="text-xs md:text-sm text-white/50 line-clamp-2">
          {avatar.description || avatar.personality || 'Professional AI presenter'}
        </p>
        
        {/* Tags - Hidden on small mobile */}
        {avatar.tags && avatar.tags.length > 0 && (
          <div className="hidden sm:flex flex-wrap gap-1 pt-1 md:pt-2">
            {avatar.tags.slice(0, 3).map((tag) => (
              <span
                key={`${avatar.id}-${tag}`}
                className="text-[9px] md:text-[10px] px-1.5 md:px-2 py-0.5 rounded-full bg-white/[0.05] text-white/40 border border-white/[0.08]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      
      {/* Shine effect on hover */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{
          background: isHovered
            ? 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 50%, transparent 100%)'
            : 'transparent'
        }}
        transition={{ duration: 0.3 }}
      />
    </motion.div>
  );
});

AvatarCard.displayName = 'AvatarCard';

export const PremiumAvatarGallery = memo(function PremiumAvatarGallery({
  avatars,
  selectedAvatar,
  onAvatarClick,
  onVoicePreview,
  previewingVoice,
  isLoading
}: PremiumAvatarGalleryProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const isMobile = useIsMobile();
  
  // Responsive card dimensions
  const CARD_WIDTH = isMobile ? 200 : 280;
  const CARD_GAP = isMobile ? 16 : 24;
  
  // Check scroll state
  const checkScrollState = useCallback(() => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  }, []);
  
  useEffect(() => {
    checkScrollState();
    window.addEventListener('resize', checkScrollState);
    return () => window.removeEventListener('resize', checkScrollState);
  }, [checkScrollState, avatars]);
  
  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = CARD_WIDTH + CARD_GAP;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount * 2 : scrollAmount * 2,
        behavior: 'smooth'
      });
    }
  };

  if (isLoading) {
    return (
      <div className="py-16">
        <AppLoader message="Loading avatars..." />
      </div>
    );
  }

  if (avatars.length === 0) {
    return (
      <div className="text-center py-16 px-4">
        <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-white/[0.03] flex items-center justify-center mx-auto mb-4 border border-white/[0.06]">
          <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-white/20" />
        </div>
        <p className="text-white/50 mb-2 text-sm md:text-base">No avatars found</p>
        <p className="text-xs md:text-sm text-white/30">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <div className="relative group/gallery">
      {/* Gradient fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-8 md:w-24 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-8 md:w-24 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none" />
      
      {/* Navigation Arrows - Hidden on mobile */}
      {!isMobile && canScrollLeft && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20 opacity-0 group-hover/gallery:opacity-100 transition-opacity">
          <Button
            variant="outline"
            size="icon"
            onClick={() => scroll('left')}
            className="w-12 h-12 rounded-full bg-black/80 border-white/20 text-white hover:bg-black hover:border-white/40 backdrop-blur-sm shadow-xl"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </div>
      )}
      
      {!isMobile && canScrollRight && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 opacity-0 group-hover/gallery:opacity-100 transition-opacity">
          <Button
            variant="outline"
            size="icon"
            onClick={() => scroll('right')}
            className="w-12 h-12 rounded-full bg-black/80 border-white/20 text-white hover:bg-black hover:border-white/40 backdrop-blur-sm shadow-xl"
          >
            <ChevronRight className="w-6 h-6" />
          </Button>
        </div>
      )}
      
      {/* Scrollable Container */}
      <div
        ref={scrollContainerRef}
        onScroll={checkScrollState}
        className={cn(
          "flex overflow-x-auto scrollbar-hide py-4 md:py-8",
          isMobile ? "gap-4 px-4" : "gap-6 px-12"
        )}
        style={{
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {avatars.map((avatar, index) => (
          <AvatarCard
            key={avatar.id}
            avatar={avatar}
            isSelected={selectedAvatar?.id === avatar.id}
            isHovered={hoveredId === avatar.id}
            onHoverStart={() => setHoveredId(avatar.id)}
            onHoverEnd={() => setHoveredId(null)}
            onClick={() => onAvatarClick(avatar)}
            onVoicePreview={() => onVoicePreview(avatar)}
            isPreviewingVoice={previewingVoice === avatar.id}
            cardWidth={CARD_WIDTH}
            index={index}
            isMobile={isMobile}
          />
        ))}
      </div>
      
      {/* Scroll indicator - Mobile only */}
      {isMobile && avatars.length > 2 && (
        <div className="flex justify-center gap-1.5 mt-4">
          {Array.from({ length: Math.min(5, Math.ceil(avatars.length / 2)) }).map((_, i) => (
            <div
              key={`indicator-${i}`}
              className="w-6 h-1 rounded-full bg-white/10"
            />
          ))}
        </div>
      )}
    </div>
  );
});

export default PremiumAvatarGallery;
