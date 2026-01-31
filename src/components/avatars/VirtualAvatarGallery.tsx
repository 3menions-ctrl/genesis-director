/**
 * VirtualAvatarGallery - Memory-Optimized Avatar Gallery
 * 
 * Uses virtual scrolling to limit DOM nodes and reduce memory pressure
 * from high-resolution textures. Only renders visible avatars.
 */

import React, { useState, useRef, useEffect, useCallback, memo, useMemo, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Crown, Volume2, Loader2, Check, Sparkles, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AvatarTemplate } from '@/types/avatar-templates';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useIsMobile } from '@/hooks/use-mobile';
import { useVirtualScroll } from '@/hooks/useVirtualScroll';
import { useSafeArray } from '@/components/stability/GlobalStabilityBoundary';
import { ShimmerSkeleton } from './OptimizedAvatarImage';

interface VirtualAvatarGalleryProps {
  avatars: AvatarTemplate[];
  selectedAvatar: AvatarTemplate | null;
  onAvatarClick: (avatar: AvatarTemplate) => void;
  onVoicePreview: (avatar: AvatarTemplate) => void;
  previewingVoice: string | null;
  isLoading?: boolean;
  isVoiceReady?: (avatar: AvatarTemplate) => boolean;
  /** Callback when an avatar image finishes loading */
  onImageLoad?: (avatarId: string) => void;
}

// Avatar card with strict onLoad-based opacity
// VirtualAvatarCard - forwardRef for AnimatePresence compatibility
interface VirtualAvatarCardProps {
  avatar: AvatarTemplate;
  isSelected: boolean;
  isHovered: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onClick: () => void;
  onVoicePreview: () => void;
  isPreviewingVoice: boolean;
  isVoiceReady: boolean;
  cardWidth: number;
  isMobile: boolean;
  onImageLoad?: () => void;
}

// forwardRef required for AnimatePresence to pass refs during exit animations
const VirtualAvatarCard = memo(forwardRef<HTMLDivElement, VirtualAvatarCardProps>(function VirtualAvatarCard({
  avatar,
  isSelected,
  isHovered,
  onHoverStart,
  onHoverEnd,
  onClick,
  onVoicePreview,
  isPreviewingVoice,
  isVoiceReady,
  cardWidth,
  isMobile,
  onImageLoad,
}, ref) {
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);

    // Handle image load - CRITICAL: opacity tied to this event
    const handleImageLoad = useCallback(() => {
      setImageLoaded(true);
      onImageLoad?.();
    }, [onImageLoad]);

    const handleImageError = useCallback(() => {
      setImageError(true);
      setImageLoaded(true); // Treat as "loaded" to show fallback
      onImageLoad?.();
    }, [onImageLoad]);

    const imageSrc = avatar.front_image_url || avatar.face_image_url;

    return (
      <motion.div
        ref={ref}
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ 
          opacity: imageLoaded ? 1 : 0.3, // Faint until image loads
          scale: imageLoaded ? 1 : 0.98 
        }}
        transition={{ duration: 0.3 }}
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
      {/* Card Background */}
      <div className={cn(
        "absolute inset-0 transition-all duration-300",
        isSelected 
          ? "bg-gradient-to-b from-violet-500/20 to-violet-900/30" 
          : "bg-gradient-to-b from-white/[0.03] to-black/50",
        "backdrop-blur-sm"
      )} />
      
      {/* Avatar Image Container */}
      <div className="relative aspect-[2/3] overflow-hidden bg-gradient-to-b from-black/30 to-black/80">
        {/* Shimmer skeleton - visible until image loads */}
        {!imageLoaded && (
          <div className="absolute inset-0">
            <ShimmerSkeleton aspectRatio="portrait" className="w-full h-full" />
          </div>
        )}
        
        {/* Actual image - only visible after onLoad */}
        {imageSrc && !imageError && (
          <motion.div
            className="w-full h-full"
            animate={{
              scale: isHovered ? 1.05 : 1,
              opacity: imageLoaded ? 1 : 0, // CRITICAL: opacity tied to onLoad
            }}
            transition={{ duration: 0.4 }}
          >
            <img
              ref={imgRef}
              src={imageSrc}
              alt={avatar.name}
              loading="lazy"
              decoding="async"
              onLoad={handleImageLoad}
              onError={handleImageError}
              className="w-full h-full object-cover object-top"
            />
          </motion.div>
        )}
        
        {/* Fallback for failed images */}
        {imageError && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
            <div className="text-center">
              <User className="w-12 h-12 text-zinc-600 mx-auto mb-2" />
              <span className="text-xs text-zinc-500">{avatar.name}</span>
            </div>
          </div>
        )}
        
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent opacity-80" />
        
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
            "absolute bottom-16 md:bottom-20 left-3 md:left-4 px-2 py-1 rounded-full text-[10px] md:text-xs font-medium",
            avatar.avatar_type === 'realistic' 
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
              : "bg-violet-500/20 text-violet-300 border border-violet-500/30"
          )}>
            {avatar.avatar_type === 'realistic' ? 'Realistic' : 'Animated'}
          </div>
        )}
        
        {/* Voice preview button */}
        {(isMobile || isHovered) && imageLoaded && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            onClick={(e) => {
              e.stopPropagation();
              onVoicePreview();
            }}
            className={cn(
              "absolute bottom-20 md:bottom-24 right-3 md:right-4 w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-colors shadow-lg",
              isVoiceReady 
                ? "bg-emerald-500/90 hover:bg-emerald-400 shadow-emerald-500/30" 
                : "bg-violet-500/90 hover:bg-violet-400 shadow-violet-500/30"
            )}
            title={isVoiceReady ? "Voice ready - instant playback" : "Preview voice"}
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
        
        {/* Tags */}
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
      
        {/* Hover shine effect */}
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
}));

export const VirtualAvatarGallery = memo(function VirtualAvatarGallery({
  avatars,
  selectedAvatar,
  onAvatarClick,
  onVoicePreview,
  previewingVoice,
  isLoading,
  isVoiceReady = () => false,
  onImageLoad,
}: VirtualAvatarGalleryProps) {
  // Data guardrail
  const safeAvatars = useSafeArray(avatars);
  
  const isMobile = useIsMobile();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  
  // Responsive dimensions
  const CARD_WIDTH = isMobile ? 200 : 280;
  const CARD_GAP = isMobile ? 16 : 24;
  const ITEM_WIDTH = CARD_WIDTH + CARD_GAP;
  
  // Virtual scroll configuration
  const {
    visibleRange,
    containerRef: virtualContainerRef,
    onScroll: virtualOnScroll,
    totalSize,
    offsetBefore,
  } = useVirtualScroll({
    totalItems: safeAvatars.length,
    itemHeight: CARD_WIDTH, // Using width since it's horizontal
    itemWidth: ITEM_WIDTH,
    direction: 'horizontal',
    overscan: 3, // Render 3 extra items on each side
    gap: CARD_GAP,
  });
  
  // Cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  
  // Check scroll state
  const checkScrollState = useCallback(() => {
    if (!mountedRef.current || !scrollContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  }, []);
  
  useEffect(() => {
    checkScrollState();
    window.addEventListener('resize', checkScrollState);
    return () => window.removeEventListener('resize', checkScrollState);
  }, [checkScrollState, safeAvatars]);
  
  // Scroll handlers
  const handleScroll = useCallback(() => {
    checkScrollState();
    virtualOnScroll();
  }, [checkScrollState, virtualOnScroll]);
  
  const scroll = useCallback((direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = ITEM_WIDTH * 2;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  }, [ITEM_WIDTH]);

  // Get visible avatars from virtual scroll
  const visibleAvatars = useMemo(() => {
    return visibleRange.map(index => safeAvatars[index]).filter(Boolean);
  }, [visibleRange, safeAvatars]);

  if (isLoading) {
    return (
      <div className="flex gap-4 md:gap-6 px-4 md:px-12 py-4 md:py-8 overflow-hidden">
        {Array.from({ length: isMobile ? 2 : 4 }).map((_, i) => (
          <div 
            key={`skeleton-${i}`}
            className="flex-shrink-0 rounded-2xl md:rounded-3xl overflow-hidden bg-zinc-900/50 border border-white/5"
            style={{ width: CARD_WIDTH }}
          >
            <ShimmerSkeleton aspectRatio="portrait" />
            <div className="p-3 md:p-5 space-y-2">
              <div className="h-5 bg-zinc-800/50 rounded animate-pulse w-3/4" />
              <div className="h-4 bg-zinc-800/30 rounded animate-pulse w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (safeAvatars.length === 0) {
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
      
      {/* Navigation Arrows */}
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
      
      {/* Virtual Scroll Container */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className={cn(
          "flex overflow-x-auto scrollbar-hide py-4 md:py-8",
          isMobile ? "px-4" : "px-12"
        )}
        style={{
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Spacer for virtual scroll offset */}
        <div style={{ minWidth: offsetBefore, flexShrink: 0 }} />
        
        {/* Render only visible avatars */}
        <div 
          className="flex"
          style={{ gap: CARD_GAP }}
        >
          <AnimatePresence mode="sync">
            {visibleAvatars.map((avatar) => (
              <VirtualAvatarCard
                key={avatar.id}
                avatar={avatar}
                isSelected={selectedAvatar?.id === avatar.id}
                isHovered={hoveredId === avatar.id}
                onHoverStart={() => setHoveredId(avatar.id)}
                onHoverEnd={() => setHoveredId(null)}
                onClick={() => onAvatarClick(avatar)}
                onVoicePreview={() => onVoicePreview(avatar)}
                isPreviewingVoice={previewingVoice === avatar.id}
                isVoiceReady={isVoiceReady(avatar)}
                cardWidth={CARD_WIDTH}
                isMobile={isMobile}
                onImageLoad={onImageLoad ? () => onImageLoad(avatar.id) : undefined}
              />
            ))}
          </AnimatePresence>
        </div>
        
        {/* End spacer */}
        <div style={{ minWidth: Math.max(0, totalSize - offsetBefore - (visibleAvatars.length * ITEM_WIDTH)), flexShrink: 0 }} />
      </div>
      
      {/* Mobile scroll indicators */}
      {isMobile && safeAvatars.length > 2 && (
        <div className="flex justify-center gap-1.5 mt-4">
          {Array.from({ length: Math.min(5, Math.ceil(safeAvatars.length / 2)) }).map((_, i) => (
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

export default VirtualAvatarGallery;
