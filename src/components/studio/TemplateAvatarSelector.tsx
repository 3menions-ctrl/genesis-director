/**
 * TemplateAvatarSelector - Inline avatar picker for template-based creation
 * 
 * Used when a breakout template is selected to allow users to pick
 * which avatar will appear in the template video.
 */

import { useState, useCallback, memo, useMemo, useRef, useEffect } from 'react';
import { User, Search, Volume2, Check, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAvatarTemplatesQuery } from '@/hooks/useAvatarTemplatesQuery';
import { AvatarTemplate } from '@/types/avatar-templates';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { shuffleAvatars } from '@/lib/utils/shuffleAvatars';

interface TemplateAvatarSelectorProps {
  selectedAvatar: AvatarTemplate | null;
  onSelect: (avatar: AvatarTemplate) => void;
  className?: string;
  /** Compact mode shows fewer avatars in a horizontal strip */
  compact?: boolean;
}

export const TemplateAvatarSelector = memo(function TemplateAvatarSelector({
  selectedAvatar,
  onSelect,
  className,
  compact = false,
}: TemplateAvatarSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Fetch ALL templates first, then filter client-side to avoid reference instability
  const { allTemplates, isLoading } = useAvatarTemplatesQuery();
  
  // Stable shuffle - only recompute when allTemplates array identity changes
  // allTemplates identity is stable from React Query cache
  const shuffledTemplates = useMemo(() => {
    if (!allTemplates || allTemplates.length === 0) return [];
    return shuffleAvatars(allTemplates);
  }, [allTemplates]);
  
  // Client-side filtering on the already-shuffled list
  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return shuffledTemplates;
    const query = searchQuery.toLowerCase();
    return shuffledTemplates.filter(avatar => 
      avatar.name.toLowerCase().includes(query) ||
      avatar.description?.toLowerCase().includes(query) ||
      avatar.tags?.some(tag => tag.toLowerCase().includes(query))
    );
  }, [shuffledTemplates, searchQuery]);

  // Compact mode used to hard-cap at 20 — that made the picker feel like it
  // "stopped loading" and was the source of the user-reported glitch. Now we
  // surface progressive loading: render the first window immediately so the
  // strip paints fast, then expand to the full catalogue after first paint.
  const [compactWindow, setCompactWindow] = useState(40);
  useEffect(() => {
    if (!compact) return;
    if (compactWindow >= filteredTemplates.length) return;
    const onIdle = () => setCompactWindow((w) => Math.min(filteredTemplates.length, w + 60));
    const handle = (typeof window !== 'undefined' && 'requestIdleCallback' in window)
      ? (window as Window & { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(onIdle)
      : setTimeout(onIdle, 250);
    return () => {
      if (typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        (window as Window & { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(handle as number);
      } else {
        clearTimeout(handle as ReturnType<typeof setTimeout>);
      }
    };
  }, [compact, filteredTemplates.length, compactWindow]);

  const displayTemplates = compact
    ? filteredTemplates.slice(0, compactWindow)
    : filteredTemplates;

  const handleVoicePreview = useCallback(async (avatar: AvatarTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewingVoice(avatar.id);
    
    try {
      const sampleText = `Hello, I'm ${avatar.name}. Let me show you something amazing!`;
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-voice`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            text: sampleText,
            voiceId: avatar.voice_id,
          }),
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.audioUrl && mountedRef.current) {
          const audio = new Audio(data.audioUrl);
          audio.play().catch(console.error);
        }
      }
    } catch (err) {
      console.error('Voice preview error:', err);
    } finally {
      if (mountedRef.current) {
        setPreviewingVoice(null);
      }
    }
  }, []);

  const scrollLeft = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -300, behavior: 'smooth' });
    }
  }, []);

  const scrollRight = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 300, behavior: 'smooth' });
    }
  }, []);

  // Compact mode: when the user scrolls near the right edge of the strip,
  // bump the window so they see more avatars. Removes the "stops loading"
  // glitch the user reported.
  useEffect(() => {
    if (!compact) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    const onScroll = () => {
      const remaining = el.scrollWidth - el.scrollLeft - el.clientWidth;
      if (remaining < 400) {
        setCompactWindow((w) => Math.min(filteredTemplates.length, w + 40));
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [compact, filteredTemplates.length]);

  if (compact) {
    // Horizontal strip view for inline use in CreationHub
    return (
      <div className={cn("space-y-3", className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-medium text-white">Select Avatar</span>
            {selectedAvatar && (
              <span className="text-xs text-violet-400">• {selectedAvatar.name}</span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 text-white/50 hover:text-white"
              onClick={scrollLeft}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 text-white/50 hover:text-white"
              onClick={scrollRight}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
          </div>
        ) : (
          <div
            ref={scrollContainerRef}
            className="flex gap-3 overflow-x-auto overflow-y-hidden pb-2 scrollbar-hide"
            style={{
              // `proximity` snap is gentler than `mandatory`. Combined with
              // `overscroll-behavior: contain` it prevents the horizontal
              // scroll from leaking into the parent vertical scroll, which
              // was the source of the on-scroll judder.
              scrollSnapType: 'x proximity',
              overscrollBehaviorX: 'contain',
              overscrollBehaviorY: 'auto',
              WebkitOverflowScrolling: 'touch',
              // Reserve scroll-padding so a snapped item sits cleanly at the
              // start of the visible area (no half-card peek-clip on snap).
              scrollPaddingLeft: '12px',
            }}
          >
            {displayTemplates.map((avatar) => (
              <div
                key={avatar.id}
                onClick={() => onSelect(avatar)}
                className={cn(
                  "relative flex-shrink-0 w-20 cursor-pointer transition-colors duration-200",
                  "scroll-snap-align-start"
                )}
                style={{
                  scrollSnapAlign: 'start',
                  // Tell the browser layout/paint stays local to this card —
                  // no thrashing the rest of the row during scroll.
                  contain: 'layout paint style',
                }}
              >
                <div className={cn(
                  "aspect-[2/3] rounded-xl overflow-hidden border-2 transition-all",
                  selectedAvatar?.id === avatar.id
                    ? "border-violet-500 ring-2 ring-violet-500/30"
                    : "border-white/10 hover:border-white/30"
                )}>
                  <img
                    src={avatar.front_image_url || avatar.face_image_url}
                    alt={avatar.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  
                  {/* Selected indicator */}
                  {selectedAvatar?.id === avatar.id && (
                    <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                  
                  {/* Voice preview */}
                  <button
                    onClick={(e) => handleVoicePreview(avatar, e)}
                    className={cn(
                      "absolute bottom-1 right-1 w-6 h-6 rounded-full flex items-center justify-center",
                      "bg-black/60 hover:bg-black/80 backdrop-blur-sm transition-all",
                      selectedAvatar?.id === avatar.id && "hidden"
                    )}
                  >
                    {previewingVoice === avatar.id ? (
                      <Loader2 className="w-3 h-3 text-white animate-spin" />
                    ) : (
                      <Volume2 className="w-3 h-3 text-white" />
                    )}
                  </button>
                </div>
                
                <p className="text-[10px] text-white/60 text-center mt-1 truncate">
                  {avatar.name}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Full grid view (for standalone use)
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
            <User className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Choose Your Avatar</h3>
            <p className="text-sm text-white/50">
              {selectedAvatar ? `Selected: ${selectedAvatar.name}` : 'Select an avatar for your video'}
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <Input
          placeholder="Search avatars..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/30"
        />
      </div>

      {/* Avatar Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
        </div>
      ) : (
        <ScrollArea className="h-[300px]">
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3 pr-4">
            {displayTemplates.map((avatar) => (
              <div
                key={avatar.id}
                onClick={() => onSelect(avatar)}
                className={cn(
                  "relative cursor-pointer transition-colors duration-200 rounded-xl overflow-hidden",
                  "border-2",
                  selectedAvatar?.id === avatar.id
                    ? "border-violet-500 ring-2 ring-violet-500/30"
                    : "border-white/10 hover:border-white/30"
                )}
                style={{ contain: "layout paint style" }}
              >
                <div className="aspect-[2/3]">
                  <img
                    src={avatar.front_image_url || avatar.face_image_url}
                    alt={avatar.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                
                {/* Selected indicator */}
                {selectedAvatar?.id === avatar.id && (
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
                
                {/* Voice preview */}
                <button
                  onClick={(e) => handleVoicePreview(avatar, e)}
                  className={cn(
                    "absolute top-2 left-2 w-7 h-7 rounded-full flex items-center justify-center",
                    "bg-black/50 hover:bg-black/70 backdrop-blur-sm transition-all",
                    selectedAvatar?.id === avatar.id && "hidden"
                  )}
                >
                  {previewingVoice === avatar.id ? (
                    <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 text-white" />
                  )}
                </button>
                
                {/* Name */}
                <div className="absolute bottom-0 left-0 right-0 p-2">
                  <p className="text-xs font-medium text-white truncate">{avatar.name}</p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
});

export default TemplateAvatarSelector;
