import { useState, useCallback, memo, forwardRef, useRef, useEffect, useMemo } from 'react';
import { 
  User, Search, Volume2, Play, Check, 
  Loader2, X, Sparkles, Crown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAvatarTemplatesQuery } from '@/hooks/useAvatarTemplatesQuery';
import { AvatarTemplate, AVATAR_STYLES, AVATAR_GENDERS } from '@/types/avatar-templates';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useChunkedAvatars } from '@/hooks/useChunkedAvatars';
import { shuffleAvatars } from '@/lib/utils/shuffleAvatars';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AvatarTemplateSelectorProps {
  selectedAvatar: AvatarTemplate | null;
  onSelect: (avatar: AvatarTemplate) => void;
  className?: string;
}

export const AvatarTemplateSelector = memo(forwardRef<HTMLDivElement, AvatarTemplateSelectorProps>(function AvatarTemplateSelector({
  selectedAvatar, 
  onSelect,
  className 
}: AvatarTemplateSelectorProps, ref) {
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState('all');
  const [styleFilter, setStyleFilter] = useState('all');
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [voicePreviewCache, setVoicePreviewCache] = useState<Record<string, string>>({});
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const { templates, isLoading, error } = useAvatarTemplatesQuery({
    gender: genderFilter,
    style: styleFilter,
    search: searchQuery,
  });
  
  // WORLD-CLASS CHUNKED LOADING: Stable shuffle + progressive loading
  const shuffledTemplates = useMemo(() => {
    if (!templates || templates.length === 0) return [];
    return shuffleAvatars(templates);
  }, [templates]);
  
  const {
    visibleAvatars: displayTemplates,
    isFullyLoaded,
    loadProgress,
  } = useChunkedAvatars(shuffledTemplates, {
    enabled: true,
    initialSize: 12,  // Start with 12 avatars
    chunkSize: 8,     // Load 8 more at a time
    chunkDelay: 150,  // 150ms between chunks (faster for small grid)
  });

  // Voice preview handler
  const handleVoicePreview = useCallback(async (avatar: AvatarTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Check cache first
    if (voicePreviewCache[avatar.id]) {
      const audio = new Audio(voicePreviewCache[avatar.id]);
      audio.play().catch(console.error);
      return;
    }
    
    setPreviewingVoice(avatar.id);
    
    try {
      // Generate a short voice sample
      const sampleText = `Hello, I'm ${avatar.name}. ${avatar.description || 'I\'m ready to help you create amazing videos.'}`;
      
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
      
      if (!response.ok) {
        throw new Error('Voice generation failed');
      }
      
      const data = await response.json();
      
      if (data.success && data.audioUrl && mountedRef.current) {
        // Cache the result
        setVoicePreviewCache(prev => ({ ...prev, [avatar.id]: data.audioUrl }));
        
        // Play the audio
        const audio = new Audio(data.audioUrl);
        audio.play().catch(console.error);
      }
    } catch (err) {
      console.error('Voice preview error:', err);
    } finally {
      if (mountedRef.current) {
        setPreviewingVoice(null);
      }
    }
  }, [voicePreviewCache]);

  const clearFilters = () => {
    setSearchQuery('');
    setGenderFilter('all');
    setStyleFilter('all');
  };

  const hasActiveFilters = searchQuery || genderFilter !== 'all' || styleFilter !== 'all';

  return (
    <div ref={ref} className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
            <User className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Choose Your Avatar</h3>
            <p className="text-sm text-white/50">Select from {templates.length} professional avatars</p>
          </div>
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-white/50 hover:text-white"
          >
            <X className="w-4 h-4 mr-1" />
            Clear filters
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <Input
            placeholder="Search avatars..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/30"
          />
        </div>
        
        <Select value={genderFilter} onValueChange={setGenderFilter}>
          <SelectTrigger className="w-[130px] bg-white/[0.03] border-white/[0.08] text-white">
            <SelectValue placeholder="Gender" />
          </SelectTrigger>
          <SelectContent className="bg-background border-border">
            {AVATAR_GENDERS.map((g) => (
              <SelectItem 
                key={g.id} 
                value={g.id}
                className="text-foreground focus:bg-accent focus:text-accent-foreground"
              >
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={styleFilter} onValueChange={setStyleFilter}>
          <SelectTrigger className="w-[150px] bg-white/[0.03] border-white/[0.08] text-white">
            <SelectValue placeholder="Style" />
          </SelectTrigger>
          <SelectContent className="bg-background border-border">
            {AVATAR_STYLES.map((s) => (
              <SelectItem 
                key={s.id} 
                value={s.id}
                className="text-foreground focus:bg-accent focus:text-accent-foreground"
              >
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="text-center py-8 text-destructive">
          <p>{error}</p>
        </div>
      )}

      {/* Avatar Grid - CSS animations + CHUNKED LOADING */}
      {!isLoading && !error && (
        <ScrollArea className="h-[400px] pr-4">
          {/* Loading progress indicator */}
          {!isFullyLoaded && loadProgress > 0 && loadProgress < 100 && (
            <div className="flex items-center justify-center gap-2 mb-3 text-white/50 text-xs">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Loading avatars... {loadProgress}%</span>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {displayTemplates.map((avatar, index) => (
              <div
                key={avatar.id}
                className={cn(
                  "group relative rounded-xl overflow-hidden cursor-pointer transition-all duration-200 animate-fade-in",
                  "border",
                  selectedAvatar?.id === avatar.id
                    ? "border-violet-500 ring-2 ring-violet-500/30 bg-violet-500/10"
                    : "border-white/[0.08] hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.05]"
                )}
                style={{ animationDelay: `${index * 30}ms` }}
                onClick={() => onSelect(avatar)}
              >
                {/* Avatar Image */}
                <div className="aspect-square relative overflow-hidden">
                  <img
                    src={avatar.face_image_url}
                    alt={avatar.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                  
                  {/* Overlay gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  
                  {/* Selected indicator */}
                  {selectedAvatar?.id === avatar.id && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center animate-scale-in">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}

                  {/* Premium badge */}
                  {avatar.is_premium && (
                    <div className="absolute top-2 left-2">
                      <Badge className="bg-amber-500/90 text-black text-[10px] px-1.5 py-0.5">
                        <Crown className="w-3 h-3 mr-0.5" />
                        PRO
                      </Badge>
                    </div>
                  )}

                  {/* Voice preview button */}
                  <button
                    onClick={(e) => handleVoicePreview(avatar, e)}
                    className={cn(
                      "absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all",
                      "bg-black/50 hover:bg-black/70 backdrop-blur-sm",
                      selectedAvatar?.id === avatar.id && "hidden"
                    )}
                  >
                    {previewingVoice === avatar.id ? (
                      <Loader2 className="w-4 h-4 text-white animate-spin" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-white" />
                    )}
                  </button>
                </div>

                {/* Info */}
                <div className="p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-white text-sm truncate">{avatar.name}</h4>
                  </div>
                  <p className="text-xs text-white/40 line-clamp-1">
                    {avatar.voice_description || avatar.style}
                  </p>
                  {avatar.tags && avatar.tags.length > 0 && (
                    <div className="flex gap-1 flex-wrap mt-1.5">
                      {avatar.tags.slice(0, 2).map((tag) => (
                        <span 
                          key={tag} 
                          className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.05] text-white/40"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Empty state */}
          {templates.length === 0 && !isLoading && (
            <div className="text-center py-12">
              <User className="w-12 h-12 text-white/20 mx-auto mb-4" />
              <p className="text-white/50 mb-2">No avatars found</p>
              <p className="text-sm text-white/30">Try adjusting your filters</p>
            </div>
          )}
        </ScrollArea>
      )}

      {/* Selected Avatar Preview */}
      {selectedAvatar && (
        <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center gap-4 animate-fade-in">
          <img
            src={selectedAvatar.face_image_url}
            alt={selectedAvatar.name}
            className="w-14 h-14 rounded-xl object-cover"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-white">{selectedAvatar.name}</h4>
              <Sparkles className="w-4 h-4 text-violet-400" />
            </div>
            <p className="text-sm text-violet-300/70 truncate">
              {selectedAvatar.personality || selectedAvatar.description}
            </p>
            <p className="text-xs text-violet-400/50 mt-0.5">
              Voice: {selectedAvatar.voice_name} • {selectedAvatar.voice_description}
            </p>
          </div>
          <button
            onClick={(e) => handleVoicePreview(selectedAvatar, e)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 transition-colors"
          >
            {previewingVoice === selectedAvatar.id ? (
              <Loader2 className="w-4 h-4 text-violet-300 animate-spin" />
            ) : (
              <Play className="w-4 h-4 text-violet-300" />
            )}
            <span className="text-sm text-violet-300">Preview</span>
          </button>
        </div>
      )}
    </div>
  );
}));

export default AvatarTemplateSelector;