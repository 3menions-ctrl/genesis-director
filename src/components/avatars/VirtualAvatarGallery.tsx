/**
 * VirtualAvatarGallery - Memory-Optimized Avatar Gallery
 * 
 * Uses CHUNKED LOADING to prevent browser crashes from loading 120+ 
 * high-resolution images simultaneously. Avatars load progressively
 * in small batches to reduce memory pressure.
 */

import React, { useState, useRef, useEffect, useCallback, memo, useMemo, forwardRef } from 'react';
// STABILITY: Removed framer-motion entirely to prevent ref-injection conflicts
import { ChevronLeft, ChevronRight, Crown, Volume2, Loader2, Check, Sparkles, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AvatarTemplate } from '@/types/avatar-templates';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSafeArray } from '@/components/stability/GlobalStabilityBoundary';
import { ShimmerSkeleton } from './OptimizedAvatarImage';
import { useChunkedAvatars } from '@/hooks/useChunkedAvatars';

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
      <div
        ref={ref}
        onClick={onClick}
        onMouseEnter={onHoverStart}
        onMouseLeave={onHoverEnd}
        className={cn(
          "relative flex-shrink-0 cursor-pointer transition-all duration-300",
          "rounded-2xl md:rounded-3xl overflow-hidden",
          isSelected && "ring-2 ring-violet-500 ring-offset-2 ring-offset-black",
          isHovered && !isSelected && "scale-[1.02]",
          imageLoaded ? "opacity-100 scale-100" : "opacity-30 scale-[0.98]",
          "animate-fade-in"
        )}
        style={{
          width: cardWidth,
          scrollSnapAlign: 'center',
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
        {/* Fixed aspect ratio container - ensures all cards have identical height */}
        {/* Background uses subtle gradient to fill any empty space around contained images */}
        <div className="relative aspect-[2/3] overflow-hidden bg-gradient-to-b from-zinc-900/80 via-zinc-900 to-black" style={{ minHeight: 0 }}>
          {/* Shimmer skeleton - visible until image loads */}
          {!imageLoaded && (
            <div className="absolute inset-0">
              <ShimmerSkeleton aspectRatio="portrait" className="w-full h-full" />
            </div>
          )}
          
          {/* Actual image - object-contain ensures FULL visibility, no cropping */}
          {/* Images are centered and scaled to fit within container while preserving aspect ratio */}
          {imageSrc && !imageError && (
            <div
              className={cn(
                "absolute inset-0 flex items-center justify-center transition-all duration-400",
                isHovered && "scale-105",
                imageLoaded ? "opacity-100" : "opacity-0"
              )}
            >
              <img
                ref={imgRef}
                src={imageSrc}
                alt={avatar.name}
                loading="lazy"
                decoding="async"
                onLoad={handleImageLoad}
                onError={handleImageError}
                className="w-full h-full object-cover object-center"
              />
            </div>
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
            <div className="absolute top-3 md:top-4 right-3 md:right-4 w-7 h-7 md:w-8 md:h-8 rounded-full bg-violet-500 flex items-center justify-center shadow-lg shadow-violet-500/50 animate-scale-in">
              <Check className="w-4 h-4 md:w-5 md:h-5 text-white" />
            </div>
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
          
          {/* Voice preview button - CSS transition instead of framer-motion */}
          {(isMobile || isHovered) && imageLoaded && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onVoicePreview();
              }}
              className={cn(
                "absolute bottom-20 md:bottom-24 right-3 md:right-4 w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all shadow-lg animate-fade-in",
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
            </button>
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
        
        {/* Hover shine effect - CSS instead of motion */}
        <div 
          className={cn(
            "absolute inset-0 pointer-events-none transition-opacity duration-300",
            isHovered ? "opacity-100" : "opacity-0"
          )}
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 50%, transparent 100%)'
          }}
        />
      </div>
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
  
  // CRITICAL: Chunked loading to prevent browser crashes
  // Loads avatars progressively instead of all 120+ at once
  const { 
    visibleAvatars, 
    isFullyLoaded, 
    loadProgress,
    totalCount 
  } = useChunkedAvatars(safeAvatars, {
    enabled: true,
    initialSize: 12, // Start with 12 avatars
    chunkSize: 8,    // Load 8 more at a time
    chunkDelay: 150, // 150ms between chunks
  });
  
  const isMobile = useIsMobile();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [viewportWidth, setViewportWidth] = useState(0);
  
  // CRITICAL: Track if content overflows viewport for conditional centering
  const [contentOverflows, setContentOverflows] = useState(true);
  
  // Dynamic centering padding - calculates left offset to center visible avatars
  const [centeringPadding, setCenteringPadding] = useState(0);
  
  // Responsive dimensions
  const CARD_WIDTH = isMobile ? 200 : 280;
  const CARD_GAP = isMobile ? 16 : 24;
  const ITEM_WIDTH = CARD_WIDTH + CARD_GAP;
  const MIN_EDGE_PADDING = isMobile ? 16 : 48; // Minimum padding at edges
  
  // Measure viewport and calculate dynamic centering padding
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const measure = () => {
      const containerWidth = container.clientWidth;
      setViewportWidth(containerWidth);
      
      // Calculate total content width (cards + gaps only, no padding yet)
      const contentWidth = (visibleAvatars.length * CARD_WIDTH) + 
        ((visibleAvatars.length - 1) * CARD_GAP);
      
      // Content overflows if it's wider than container (accounting for minimum padding)
      const availableWidth = containerWidth - (MIN_EDGE_PADDING * 2);
      const overflows = contentWidth > availableWidth;
      setContentOverflows(overflows);
      
      if (overflows) {
        // When overflowing: calculate how many cards fit fully in the viewport
        const visibleCardsCount = Math.floor(availableWidth / ITEM_WIDTH);
        // Calculate the width of those cards
        const visibleContentWidth = (visibleCardsCount * CARD_WIDTH) + 
          Math.max(0, (visibleCardsCount - 1) * CARD_GAP);
        // Calculate padding to center those visible cards
        const centerOffset = Math.max(MIN_EDGE_PADDING, (containerWidth - visibleContentWidth) / 2);
        setCenteringPadding(centerOffset);
      } else {
        // When not overflowing: center the content naturally
        const centerOffset = Math.max(MIN_EDGE_PADDING, (containerWidth - contentWidth) / 2);
        setCenteringPadding(centerOffset);
      }
    };
    measure();
    
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [visibleAvatars.length, CARD_WIDTH, CARD_GAP, ITEM_WIDTH, MIN_EDGE_PADDING]);
  
  // Cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  
  // Track scroll position for virtual scroll recalculation
  const [scrollPosition, setScrollPosition] = useState(0);
  
  // Check scroll state
  const checkScrollState = useCallback(() => {
    if (!mountedRef.current || !scrollContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    setScrollPosition(scrollLeft); // Trigger re-render for virtual scroll
  }, []);
  
  // Initial centering ref - tracks if we've already centered on mount
  const hasInitialCentered = useRef(false);
  
  useEffect(() => {
    checkScrollState();
    window.addEventListener('resize', checkScrollState);
    return () => window.removeEventListener('resize', checkScrollState);
  }, [checkScrollState, safeAvatars]);
  
  // Scroll handlers
  const handleScroll = useCallback(() => {
    checkScrollState();
  }, [checkScrollState]);
  
  const scroll = useCallback((direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = ITEM_WIDTH * 2;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  }, [ITEM_WIDTH]);

  // Use chunked avatars for progressive loading (prevents browser crashes)
  const displayAvatars = visibleAvatars;
  
  // Edge padding uses dynamically calculated centering - moved before early returns
  const edgePadding = centeringPadding || MIN_EDGE_PADDING;

  // CENTERING FIX: Scroll selected avatar to center of viewport
  useEffect(() => {
    if (!selectedAvatar || !scrollContainerRef.current || !mountedRef.current) return;
    
    const container = scrollContainerRef.current;
    const selectedIndex = displayAvatars.findIndex(a => a.id === selectedAvatar.id);
    
    if (selectedIndex === -1) return;
    
    // Calculate position to center the selected avatar
    const itemTotalWidth = ITEM_WIDTH;
    const selectedPosition = (selectedIndex * itemTotalWidth) + edgePadding;
    const containerCenter = container.clientWidth / 2;
    const cardCenter = CARD_WIDTH / 2;
    const targetScroll = selectedPosition - containerCenter + cardCenter;
    
    // Smoothly scroll to center the selected avatar
    container.scrollTo({
      left: Math.max(0, targetScroll),
      behavior: 'smooth'
    });
  }, [selectedAvatar?.id, displayAvatars, ITEM_WIDTH, CARD_WIDTH, edgePadding]);
  
  // INITIAL CENTERING: On mount, scroll to center the visible cards for tablet viewports
  useEffect(() => {
    if (hasInitialCentered.current || !scrollContainerRef.current || !mountedRef.current) return;
    if (displayAvatars.length === 0 || !contentOverflows) return;
    
    const container = scrollContainerRef.current;
    const containerWidth = container.clientWidth;
    
    // Calculate how many cards fit fully in the viewport
    const availableWidth = containerWidth - (MIN_EDGE_PADDING * 2);
    const visibleCardsCount = Math.floor(availableWidth / ITEM_WIDTH);
    
    // Don't center if many cards fit (desktop) - only center for 2-3 visible cards (tablet)
    if (visibleCardsCount > 3) return;
    
    // Calculate the width of visible cards
    const visibleContentWidth = (visibleCardsCount * CARD_WIDTH) + 
      Math.max(0, (visibleCardsCount - 1) * CARD_GAP);
    
    // Calculate scroll position to center visible cards
    const idealVisibleStart = (containerWidth - visibleContentWidth) / 2;
    const scrollOffset = edgePadding - idealVisibleStart;
    
    if (scrollOffset > 5) {
      // Scroll to center the first N visible cards
      container.scrollLeft = scrollOffset;
      hasInitialCentered.current = true;
    }
  }, [displayAvatars.length, contentOverflows, ITEM_WIDTH, CARD_WIDTH, CARD_GAP, MIN_EDGE_PADDING, edgePadding]);

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
    <div className="relative group/gallery w-full">
      {/* Gradient fade edges - uses #030303 to match AvatarsBackground */}
      <div 
        className="absolute left-0 top-0 bottom-0 w-8 md:w-24 z-10 pointer-events-none" 
        style={{ background: 'linear-gradient(to right, #030303, transparent)' }}
      />
      <div 
        className="absolute right-0 top-0 bottom-0 w-8 md:w-24 z-10 pointer-events-none" 
        style={{ background: 'linear-gradient(to left, #030303, transparent)' }}
      />
      
      {/* Navigation Arrows */}
      {!isMobile && canScrollLeft && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20 opacity-0 group-hover/gallery:opacity-100 transition-opacity">
          <Button
            variant="outline"
            size="icon"
            onClick={() => scroll('left')}
            className="w-12 h-12 rounded-full bg-background/80 border-border text-foreground hover:bg-background hover:border-border/80 backdrop-blur-sm shadow-xl"
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
            className="w-12 h-12 rounded-full bg-background/80 border-border text-foreground hover:bg-background hover:border-border/80 backdrop-blur-sm shadow-xl"
          >
            <ChevronRight className="w-6 h-6" />
          </Button>
        </div>
      )}
      
      {/* Horizontal Scroll Container - full width */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="overflow-x-auto scrollbar-hide py-4 md:py-8"
        style={{
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          // CSS scroll-padding helps center snap points
          scrollPaddingLeft: edgePadding,
          scrollPaddingRight: edgePadding,
        }}
      >
        {/* Inner flex container */}
        <div 
          className="flex"
          style={{ 
            gap: CARD_GAP,
            width: 'max-content',
            paddingLeft: edgePadding,
            paddingRight: edgePadding,
          }}
        >
          {displayAvatars.map((avatar) => (
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
        </div>
      </div>
      
      {/* Loading progress indicator - shows while avatars are still loading */}
      {!isFullyLoaded && (
        <div className="flex items-center justify-center gap-3 mt-4 animate-fade-in">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.08]">
            <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
            <span className="text-xs text-white/50">
              Loading avatars... {visibleAvatars.length}/{totalCount}
            </span>
            <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-violet-500 rounded-full transition-all duration-300"
                style={{ width: `${loadProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}
      
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
