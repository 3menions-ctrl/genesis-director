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
import { shuffleAvatars } from '@/lib/utils/shuffleAvatars';

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
          isHovered && !isSelected && "scale-[1.015]",
          imageLoaded ? "opacity-100 scale-100" : "opacity-30 scale-[0.98]",
          "animate-fade-in"
        )}
        style={{
          width: cardWidth,
          scrollSnapAlign: 'center',
          boxShadow: isSelected
            ? 'inset 0 1px 0 hsla(215,100%,80%,0.18), inset 0 0 0 1.5px hsla(215,100%,55%,0.55), 0 0 0 4px hsla(215,100%,55%,0.12), 0 24px 60px -20px hsla(215,100%,55%,0.45), 0 0 80px hsla(215,100%,55%,0.18)'
            : isHovered
              ? 'inset 0 1px 0 hsla(0,0%,100%,0.05), inset 0 0 0 1px hsla(0,0%,100%,0.06), 0 20px 50px -18px hsla(0,0%,0%,0.65)'
              : 'inset 0 1px 0 hsla(0,0%,100%,0.03), inset 0 0 0 1px hsla(0,0%,100%,0.035)',
        }}
      >
        {/* Card Background */}
        <div
          className="absolute inset-0 transition-all duration-500"
          style={{
            background: isSelected
              ? 'linear-gradient(180deg, hsla(215,100%,55%,0.10) 0%, hsla(220,14%,2%,0.55) 100%)'
              : 'linear-gradient(180deg, hsla(0,0%,100%,0.018) 0%, hsla(220,14%,2%,0.55) 100%)',
            backdropFilter: 'blur(24px) saturate(160%)',
          }}
        />
        
        {/* Avatar Image Container */}
        {/* Fixed aspect ratio container - ensures all cards have identical height */}
        {/* Background uses subtle gradient to fill any empty space around contained images */}
        <div className="relative aspect-[2/3] overflow-hidden" style={{ minHeight: 0, background: 'linear-gradient(180deg, hsl(220,14%,5%) 0%, hsl(220,14%,2%) 100%)' }}>
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
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'hsl(220,14%,4%)' }}>
              <div className="text-center">
                <User className="w-10 h-10 text-white/15 mx-auto mb-2" strokeWidth={1.5} />
                <span className="text-[10px] font-light tracking-[0.16em] uppercase text-white/30">{avatar.name}</span>
              </div>
            </div>
          )}
          
          {/* Gradient overlay — luminous bottom for text */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(180deg, transparent 30%, hsla(220,14%,1%,0.4) 65%, hsla(220,14%,1%,0.92) 100%)',
            }}
          />
          
          {/* Selection indicator */}
          {isSelected && (
            <div
              className="absolute top-3 md:top-4 right-3 md:right-4 w-8 h-8 rounded-full flex items-center justify-center animate-scale-in"
              style={{
                background: 'linear-gradient(135deg, hsla(215,100%,62%,0.98) 0%, hsla(215,100%,52%,0.98) 100%)',
                boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.3), 0 0 24px hsla(215,100%,55%,0.55), 0 0 48px hsla(215,100%,55%,0.25)',
              }}
            >
              <Check className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
          )}
          
          {/* Premium badge */}
          {avatar.is_premium && (
            <div
              className="absolute top-3 md:top-4 left-3 md:left-4 flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-light tracking-[0.2em] uppercase"
              style={{
                background: 'linear-gradient(135deg, hsla(45,100%,68%,0.95) 0%, hsla(38,100%,55%,0.95) 100%)',
                color: 'hsl(220, 14%, 4%)',
                boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.35), 0 4px 16px hsla(45,100%,55%,0.35)',
              }}
            >
              <Crown className="w-2.5 h-2.5" strokeWidth={2} />
              <span>Pro</span>
            </div>
          )}
          
          {/* Avatar type badge */}
          {avatar.avatar_type && (
            <div
              className="absolute bottom-16 md:bottom-20 left-3 md:left-4 px-2.5 py-1 rounded-full text-[9px] font-light tracking-[0.18em] uppercase"
              style={{
                background: 'hsla(0,0%,100%,0.04)',
                backdropFilter: 'blur(20px) saturate(160%)',
                color: 'hsla(0,0%,100%,0.75)',
                boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.05), inset 0 0 0 1px hsla(0,0%,100%,0.06)',
              }}
            >
              {avatar.avatar_type === 'realistic' ? 'Photoreal' : 'Animated'}
            </div>
          )}
          
          {/* Voice preview button - CSS transition instead of framer-motion */}
          {(isMobile || isHovered) && imageLoaded && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onVoicePreview();
              }}
              className="absolute bottom-20 md:bottom-24 right-3 md:right-4 w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-105 animate-fade-in"
              style={{
                background: isVoiceReady
                  ? 'linear-gradient(135deg, hsla(215,100%,62%,0.95) 0%, hsla(215,100%,52%,0.95) 100%)'
                  : 'hsla(0,0%,100%,0.06)',
                backdropFilter: 'blur(24px) saturate(160%)',
                boxShadow: isVoiceReady
                  ? 'inset 0 1px 0 hsla(0,0%,100%,0.25), 0 0 24px hsla(215,100%,55%,0.5), 0 8px 24px -6px hsla(0,0%,0%,0.5)'
                  : 'inset 0 1px 0 hsla(0,0%,100%,0.06), inset 0 0 0 1px hsla(0,0%,100%,0.08), 0 8px 24px -6px hsla(0,0%,0%,0.5)',
                color: 'hsl(0,0%,100%)',
              }}
              title={isVoiceReady ? "Voice ready - instant playback" : "Preview voice"}
            >
              {isPreviewingVoice ? (
                <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.8} />
              ) : (
                <Volume2 className="w-4 h-4" strokeWidth={1.8} />
              )}
            </button>
          )}
        </div>
        
        {/* Info Panel */}
        <div
          className="relative p-4 md:p-5 space-y-2"
          style={{
            background: 'linear-gradient(180deg, hsla(220,14%,3%,0.85) 0%, hsla(220,14%,2%,0.95) 100%)',
            backdropFilter: 'blur(24px) saturate(160%)',
          }}
        >
          <div className="flex items-center justify-between">
            <h4 className="font-light text-white/95 text-sm md:text-base truncate pr-2 tracking-wide font-display">{avatar.name}</h4>
            {avatar.style && (
              <span className="text-[9px] font-light tracking-[0.18em] uppercase text-white/35 capitalize shrink-0">{avatar.style}</span>
            )}
          </div>
          <p className="text-[11px] md:text-xs text-white/45 line-clamp-2 leading-relaxed font-light">
            {avatar.description || avatar.personality || 'Professional AI presenter'}
          </p>
          
          {/* Tags */}
          {avatar.tags && avatar.tags.length > 0 && (
            <div className="hidden sm:flex flex-wrap gap-1 pt-1.5">
              {avatar.tags.slice(0, 3).map((tag) => (
                <span
                  key={`${avatar.id}-${tag}`}
                  className="text-[9px] font-light tracking-[0.14em] uppercase px-2 py-0.5 rounded-full text-white/40"
                  style={{
                    background: 'hsla(0,0%,100%,0.025)',
                    boxShadow: 'inset 0 0 0 1px hsla(0,0%,100%,0.04)',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        
        {/* Hover shine effect — luminous blue sweep */}
        <div 
          className={cn(
            "absolute inset-0 pointer-events-none transition-opacity duration-300",
            isHovered ? "opacity-100" : "opacity-0"
          )}
          style={{
            background: 'linear-gradient(135deg, hsla(215,100%,70%,0.06) 0%, transparent 45%, transparent 100%)'
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
  
  // CRITICAL: Stable shuffle using useMemo to prevent re-shuffle on every render
  // Uses session seed for consistent ordering during navigation
  const shuffledAvatars = useMemo(() => {
    if (safeAvatars.length === 0) return [];
    return shuffleAvatars(safeAvatars);
  }, [safeAvatars]);
  
  // WORLD-CLASS CHUNKED LOADING: Progressive loading to prevent crashes
  // Loads avatars in small batches to reduce memory pressure
  const { 
    visibleAvatars, 
    isFullyLoaded, 
    loadProgress,
    totalCount 
  } = useChunkedAvatars(shuffledAvatars, {
    enabled: true,
    initialSize: 60, // Show plenty upfront
    chunkSize: 30,   // Load remaining in large batches
    chunkDelay: 100, // Fast loading
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
    // The card's left edge position within the scroll content:
    // edgePadding + (cardIndex * (CARD_WIDTH + CARD_GAP))
    const cardLeftPosition = edgePadding + (selectedIndex * ITEM_WIDTH);
    // Card center position
    const cardCenterPosition = cardLeftPosition + (CARD_WIDTH / 2);
    // Viewport center
    const viewportCenter = container.clientWidth / 2;
    // Scroll needed to center the card
    const targetScroll = cardCenterPosition - viewportCenter;
    
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
            className="flex-shrink-0 rounded-2xl md:rounded-3xl overflow-hidden"
            style={{
              width: CARD_WIDTH,
              background: 'hsla(220,14%,4%,0.5)',
              boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.03), inset 0 0 0 1px hsla(0,0%,100%,0.035)',
            }}
          >
            <ShimmerSkeleton aspectRatio="portrait" />
            <div className="p-4 md:p-5 space-y-2">
              <div className="h-4 rounded-full animate-pulse w-3/4" style={{ background: 'hsla(0,0%,100%,0.04)' }} />
              <div className="h-3 rounded-full animate-pulse w-full" style={{ background: 'hsla(0,0%,100%,0.025)' }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (safeAvatars.length === 0) {
    return (
      <div className="text-center py-20 px-4">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
          style={{
            background: 'hsla(0,0%,100%,0.025)',
            boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.05), inset 0 0 0 1px hsla(0,0%,100%,0.05)',
          }}
        >
          <Sparkles className="w-6 h-6 text-[hsl(215,100%,72%)]/45" strokeWidth={1.5} />
        </div>
        <p className="text-white/55 mb-2 text-sm font-light tracking-wide">No avatars found</p>
        <p className="text-[10px] font-light tracking-[0.18em] uppercase text-white/30">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <div className="relative group/gallery w-full">
      {/* Gradient fade edges — Pro-Dark */}
      <div 
        className="absolute left-0 top-0 bottom-0 w-8 md:w-24 z-10 pointer-events-none" 
        style={{ background: 'linear-gradient(to right, hsl(220,14%,2%) 0%, transparent 100%)' }}
      />
      <div 
        className="absolute right-0 top-0 bottom-0 w-8 md:w-24 z-10 pointer-events-none" 
        style={{ background: 'linear-gradient(to left, hsl(220,14%,2%) 0%, transparent 100%)' }}
      />
      
      {/* Navigation Arrows */}
      {!isMobile && canScrollLeft && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20 opacity-0 group-hover/gallery:opacity-100 transition-opacity duration-300">
          <button
            onClick={() => scroll('left')}
            className="w-11 h-11 rounded-full flex items-center justify-center text-white/75 hover:text-white transition-all duration-300 hover:scale-105"
            style={{
              background: 'linear-gradient(180deg, hsla(220,14%,6%,0.85) 0%, hsla(220,14%,3%,0.92) 100%)',
              backdropFilter: 'blur(32px) saturate(180%)',
              boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.06), inset 0 0 0 1px hsla(0,0%,100%,0.05), 0 12px 32px -8px hsla(0,0%,0%,0.65)',
            }}
          >
            <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>
      )}
      
      {!isMobile && canScrollRight && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 opacity-0 group-hover/gallery:opacity-100 transition-opacity duration-300">
          <button
            onClick={() => scroll('right')}
            className="w-11 h-11 rounded-full flex items-center justify-center text-white/75 hover:text-white transition-all duration-300 hover:scale-105"
            style={{
              background: 'linear-gradient(180deg, hsla(220,14%,6%,0.85) 0%, hsla(220,14%,3%,0.92) 100%)',
              backdropFilter: 'blur(32px) saturate(180%)',
              boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.06), inset 0 0 0 1px hsla(0,0%,100%,0.05), 0 12px 32px -8px hsla(0,0%,0%,0.65)',
            }}
          >
            <ChevronRight className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>
      )}
      
      {/* Horizontal Scroll Container - full width */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="overflow-x-auto overflow-y-hidden scrollbar-hide py-4 md:py-8 max-h-[60vh] md:max-h-[65vh] lg:max-h-[70vh]"
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
          <div
            className="flex items-center gap-3 px-4 py-2 rounded-full"
            style={{
              background: 'hsla(0,0%,100%,0.025)',
              backdropFilter: 'blur(24px) saturate(160%)',
              boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.04), inset 0 0 0 1px hsla(0,0%,100%,0.05)',
            }}
          >
            <Loader2 className="w-3.5 h-3.5 text-[hsl(215,100%,72%)] animate-spin" strokeWidth={1.5} />
            <span className="text-[10px] font-light tracking-[0.16em] uppercase text-white/55">
              Loading avatars... {visibleAvatars.length}/{totalCount}
            </span>
            <div className="w-16 h-1 rounded-full overflow-hidden" style={{ background: 'hsla(0,0%,100%,0.06)' }}>
              <div 
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${loadProgress}%`,
                  background: 'linear-gradient(90deg, hsla(215,100%,55%,0.85) 0%, hsla(215,100%,72%,0.95) 100%)',
                  boxShadow: '0 0 12px hsla(215,100%,55%,0.5)',
                }}
              />
            </div>
          </div>
        </div>
      )}
      
      {/* Mobile scroll indicators */}
      {isMobile && safeAvatars.length > 2 && (
        <div className="flex justify-center gap-1.5 mt-5">
          {Array.from({ length: Math.min(5, Math.ceil(safeAvatars.length / 2)) }).map((_, i) => (
            <div
              key={`indicator-${i}`}
              className="w-5 h-0.5 rounded-full"
              style={{ background: 'hsla(0,0%,100%,0.08)' }}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export default VirtualAvatarGallery;
