import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { 
  User, Search, ArrowLeft, Sparkles, Check,
  Loader2, RectangleHorizontal,
  RectangleVertical, Square, Clock, Music, Mic,
  Play, Zap, Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAvatarTemplates } from '@/hooks/useAvatarTemplates';
import { AvatarTemplate, AVATAR_STYLES, AVATAR_GENDERS } from '@/types/avatar-templates';
import { AvatarPreviewModal } from '@/components/avatars/AvatarPreviewModal';
import { PremiumAvatarGallery } from '@/components/avatars/PremiumAvatarGallery';
import { AppHeader } from '@/components/layout/AppHeader';
import PipelineBackground from '@/components/production/PipelineBackground';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from '@/contexts/AuthContext';
import { useTierLimits } from '@/hooks/useTierLimits';
import { supabase } from '@/integrations/supabase/client';
import { handleError } from '@/lib/errorHandler';

const ASPECT_RATIOS = [
  { id: '16:9', name: 'Landscape', icon: RectangleHorizontal, description: 'YouTube, TV' },
  { id: '9:16', name: 'Portrait', icon: RectangleVertical, description: 'TikTok, Reels' },
  { id: '1:1', name: 'Square', icon: Square, description: 'Instagram' },
];

const CLIP_DURATIONS = [
  { id: 5, name: '5 sec', description: 'Quick clip' },
  { id: 10, name: '10 sec', description: 'Standard' },
];

export default function Avatars() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { maxClips } = useTierLimits();

  // Avatar selection state
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState('all');
  const [styleFilter, setStyleFilter] = useState('all');
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarTemplate | null>(null);
  const [previewAvatar, setPreviewAvatar] = useState<AvatarTemplate | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [voicePreviewCache, setVoicePreviewCache] = useState<Record<string, string>>({});

  // Project configuration state
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [clipCount, setClipCount] = useState(3);
  const [clipDuration, setClipDuration] = useState(5);
  const [enableMusic, setEnableMusic] = useState(true);

  // Generation state
  const [isCreating, setIsCreating] = useState(false);
  const [creationStatus, setCreationStatus] = useState('');

  const { templates, isLoading, error } = useAvatarTemplates({
    gender: genderFilter,
    style: styleFilter,
    search: searchQuery,
  });

  const userCredits = profile?.credits_balance ?? 0;
  const estimatedCredits = clipCount * 10;
  const hasInsufficientCredits = userCredits < estimatedCredits;
  const estimatedDuration = clipCount * clipDuration;
  const hasActiveFilters = genderFilter !== 'all' || styleFilter !== 'all' || searchQuery.trim().length > 0;

  // Voice preview handler
  const handleVoicePreview = useCallback(async (avatar: AvatarTemplate) => {
    if (voicePreviewCache[avatar.id]) {
      const audio = new Audio(voicePreviewCache[avatar.id]);
      audio.play().catch(console.error);
      return;
    }
    
    setPreviewingVoice(avatar.id);
    
    try {
      const sampleText = `Hello, I'm ${avatar.name}. ${avatar.description || "I'm ready to help you create amazing videos."}`;
      
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
      
      if (!response.ok) throw new Error('Voice generation failed');
      
      const data = await response.json();
      
      if (data.success && data.audioUrl) {
        setVoicePreviewCache(prev => ({ ...prev, [avatar.id]: data.audioUrl }));
        const audio = new Audio(data.audioUrl);
        audio.play().catch(console.error);
      }
    } catch (err) {
      console.error('Voice preview error:', err);
      toast.error('Failed to preview voice');
    } finally {
      setPreviewingVoice(null);
    }
  }, [voicePreviewCache]);

  // Handle avatar card click - open preview modal
  const handleAvatarClick = (avatar: AvatarTemplate) => {
    setPreviewAvatar(avatar);
    setPreviewModalOpen(true);
  };

  // Handle avatar selection from modal
  const handleSelectAvatar = (avatar: AvatarTemplate) => {
    setSelectedAvatar(avatar);
    toast.success(`Selected ${avatar.name}`);
  };

  // Build character bible for production consistency
  const buildCharacterBible = (avatar: AvatarTemplate) => {
    const bible = avatar.character_bible || {};
    
    return {
      name: avatar.name,
      description: avatar.description,
      personality: avatar.personality,
      // Multi-view identity descriptions
      front_view: bible.front_view || `${avatar.name}, professional presenter, facing camera directly, neutral confident expression`,
      side_view: bible.side_view || `${avatar.name}, professional presenter, side profile view, same outfit and styling`,
      back_view: bible.back_view || `${avatar.name}, professional presenter, back view showing hair and outfit from behind`,
      silhouette: bible.silhouette || `${avatar.name}, distinctive silhouette shape, recognizable posture`,
      // Non-facial identity anchors
      hair_description: bible.hair_description || 'consistent hairstyle throughout',
      clothing_description: bible.clothing_description || 'professional attire, consistent outfit',
      body_type: bible.body_type || 'average build',
      distinguishing_features: bible.distinguishing_features || [],
      // Reference images for multi-angle consistency
      reference_images: {
        front: avatar.front_image_url || avatar.face_image_url,
        side: avatar.side_image_url,
        back: avatar.back_image_url,
      },
      // Negative prompts to prevent morphing
      negative_prompts: bible.negative_prompts || [
        'different person',
        'face change',
        'different hairstyle',
        'different outfit',
        'morphing',
        'inconsistent appearance'
      ],
    };
  };

  // Handle project creation
  const handleCreate = async () => {
    if (!user) {
      toast.error('Please sign in to create videos');
      navigate('/auth');
      return;
    }

    if (!selectedAvatar) {
      toast.error('Please select an avatar first');
      return;
    }

    if (!prompt.trim()) {
      toast.error('Please enter what you want the avatar to say');
      return;
    }

    setIsCreating(true);
    setCreationStatus('Building character identity...');

    try {
      // Build comprehensive character bible for consistency
      const characterBible = buildCharacterBible(selectedAvatar);
      
      setCreationStatus('Initializing avatar pipeline...');

      const { data, error } = await supabase.functions.invoke('mode-router', {
        body: {
          mode: 'avatar',
          userId: user.id,
          prompt: prompt,
          imageUrl: selectedAvatar.front_image_url || selectedAvatar.face_image_url,
          voiceId: selectedAvatar.voice_id,
          aspectRatio,
          clipCount,
          clipDuration,
          enableNarration: true,
          enableMusic,
          // Pass character bible for production consistency
          characterBible,
          avatarTemplateId: selectedAvatar.id,
        },
      });

      if (error) {
        if (error.message?.includes('402') || error.message?.includes('credits')) {
          toast.error('Insufficient credits. Please purchase more credits.');
          navigate('/settings?tab=billing');
          return;
        }
        throw error;
      }

      if (data?.error === 'active_project_exists') {
        toast.error(data.message, {
          duration: 8000,
          action: {
            label: 'View Project',
            onClick: () => navigate(`/production/${data.existingProjectId}`),
          },
        });
        return;
      }

      if (!data?.projectId) {
        throw new Error('Failed to create project');
      }

      toast.success('Avatar video creation started!');
      navigate(`/production/${data.projectId}`);
    } catch (error) {
      console.error('Creation error:', error);
      handleError(error, 'Avatar video creation', { showToast: true });
    } finally {
      setIsCreating(false);
      setCreationStatus('');
    }
  };

  const isReadyToCreate = selectedAvatar && prompt.trim() && !hasInsufficientCredits;

  return (
    <div className="relative min-h-screen flex flex-col bg-black">
      <PipelineBackground />
      <AppHeader />
      
      <div className="relative z-10 flex-1 pt-6 pb-24">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-7xl mx-auto px-6 mb-6"
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/create')}
            className="mb-4 text-white/50 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Create
          </Button>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-violet-500/20 flex items-center justify-center border border-violet-500/30">
                <User className="w-7 h-7 text-violet-400" />
              </div>
              <div>
                <h1 className="text-3xl font-display font-bold text-white">Choose Your Avatar</h1>
                <p className="text-white/50">Select a presenter for your video</p>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-48 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/30"
                />
              </div>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className={cn(
                      "border-white/[0.08] text-white/70 hover:text-white hover:bg-white/[0.05]",
                      hasActiveFilters && "border-violet-500/50 text-violet-400"
                    )}
                  >
                    <Filter className="w-4 h-4 mr-2" />
                    Filters
                    {hasActiveFilters && (
                      <span className="ml-2 w-2 h-2 rounded-full bg-violet-500" />
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 bg-zinc-900 border-white/10 p-4 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-white/50">Gender</Label>
                    <Select value={genderFilter} onValueChange={setGenderFilter}>
                      <SelectTrigger className="bg-white/[0.03] border-white/[0.08] text-white">
                        <SelectValue placeholder="Gender" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-white/10">
                        {AVATAR_GENDERS.map((g) => (
                          <SelectItem key={g.id} value={g.id} className="text-white focus:bg-white/10 focus:text-white">
                            {g.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-white/50">Style</Label>
                    <Select value={styleFilter} onValueChange={setStyleFilter}>
                      <SelectTrigger className="bg-white/[0.03] border-white/[0.08] text-white">
                        <SelectValue placeholder="Style" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-white/10">
                        {AVATAR_STYLES.map((s) => (
                          <SelectItem key={s.id} value={s.id} className="text-white focus:bg-white/10 focus:text-white">
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setGenderFilter('all');
                        setStyleFilter('all');
                        setSearchQuery('');
                      }}
                      className="w-full text-white/50 hover:text-white"
                    >
                      Clear Filters
                    </Button>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </motion.div>

        {/* Premium Horizontal Gallery */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          {error ? (
            <div className="text-center py-12 text-red-400 max-w-7xl mx-auto px-6">
              <p>{error}</p>
            </div>
          ) : (
            <PremiumAvatarGallery
              avatars={templates}
              selectedAvatar={selectedAvatar}
              onAvatarClick={handleAvatarClick}
              onVoicePreview={handleVoicePreview}
              previewingVoice={previewingVoice}
              isLoading={isLoading}
            />
          )}
        </motion.div>

        {/* Configuration Panel - Sticky Bottom */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="max-w-5xl mx-auto px-6"
        >
          <div className="p-6 rounded-2xl bg-zinc-900/80 border border-white/[0.08] backdrop-blur-xl">
            <div className="grid md:grid-cols-[1fr,auto,auto] gap-6 items-end">
              {/* Script Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-white/70 flex items-center gap-2">
                    <Mic className="w-4 h-4" />
                    Script
                  </Label>
                  {selectedAvatar && (
                    <div className="flex items-center gap-2 text-sm">
                      <img 
                        src={selectedAvatar.front_image_url || selectedAvatar.face_image_url} 
                        alt={selectedAvatar.name}
                        className="w-6 h-6 rounded-full object-cover border border-white/20"
                      />
                      <span className="text-white/70">{selectedAvatar.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedAvatar(null)}
                        className="h-6 px-2 text-xs text-white/40 hover:text-white"
                      >
                        Change
                      </Button>
                    </div>
                  )}
                </div>
                <Textarea
                  placeholder={selectedAvatar 
                    ? `What should ${selectedAvatar.name} say? Enter your script here...`
                    : "First, select an avatar above..."
                  }
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-[80px] bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/30 resize-none"
                  disabled={!selectedAvatar}
                />
              </div>

              {/* Quick Settings */}
              <div className="flex items-center gap-4">
                {/* Aspect Ratio */}
                <div className="space-y-2">
                  <Label className="text-xs text-white/50">Format</Label>
                  <div className="flex gap-1">
                    {ASPECT_RATIOS.map((ratio) => (
                      <button
                        key={ratio.id}
                        onClick={() => setAspectRatio(ratio.id)}
                        className={cn(
                          "p-2 rounded-lg border transition-all",
                          aspectRatio === ratio.id
                            ? "border-violet-500 bg-violet-500/10 text-violet-300"
                            : "border-white/[0.08] text-white/40 hover:border-white/20 hover:text-white/60"
                        )}
                        title={ratio.description}
                      >
                        <ratio.icon className="w-4 h-4" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Duration */}
                <div className="space-y-2">
                  <Label className="text-xs text-white/50">Duration</Label>
                  <Select value={String(clipDuration)} onValueChange={(v) => setClipDuration(Number(v))}>
                    <SelectTrigger className="w-24 h-9 bg-white/[0.03] border-white/[0.08] text-white text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-white/10">
                      {CLIP_DURATIONS.map((d) => (
                        <SelectItem key={d.id} value={String(d.id)} className="text-white focus:bg-white/10 focus:text-white">
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Clips */}
                <div className="space-y-2">
                  <Label className="text-xs text-white/50">Clips: {clipCount}</Label>
                  <Slider
                    value={[clipCount]}
                    onValueChange={([v]) => setClipCount(v)}
                    min={1}
                    max={maxClips}
                    step={1}
                    className="w-24"
                  />
                </div>

                {/* Music Toggle */}
                <div className="flex items-center gap-2">
                  <Music className={cn("w-4 h-4", enableMusic ? "text-violet-400" : "text-white/30")} />
                  <Switch checked={enableMusic} onCheckedChange={setEnableMusic} />
                </div>
              </div>

              {/* Create Button & Cost */}
              <div className="flex flex-col items-end gap-2">
                <Button
                  onClick={handleCreate}
                  disabled={!isReadyToCreate || isCreating}
                  className={cn(
                    "h-12 px-8 text-base font-medium transition-all",
                    isReadyToCreate
                      ? "bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white"
                      : "bg-white/[0.05] text-white/30 cursor-not-allowed"
                  )}
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5 mr-2" />
                      Create Video
                    </>
                  )}
                </Button>
                
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-white/40">{estimatedDuration}s</span>
                  <span className="text-white/20">•</span>
                  <span className={cn("flex items-center gap-1", hasInsufficientCredits ? "text-red-400" : "text-amber-400")}>
                    <Zap className="w-3 h-3" />
                    {estimatedCredits} credits
                  </span>
                  <span className="text-white/20">•</span>
                  <span className="text-white/40">Balance: {userCredits}</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Avatar Preview Modal with 3D Viewer */}
      <AvatarPreviewModal
        avatar={previewAvatar}
        open={previewModalOpen}
        onOpenChange={setPreviewModalOpen}
        onSelect={handleSelectAvatar}
        onPreviewVoice={handleVoicePreview}
        isPreviewingVoice={previewingVoice === previewAvatar?.id}
      />

      {/* Loading Overlay */}
      {isCreating && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto" />
            <p className="text-white/70 text-lg">{creationStatus || 'Starting creation...'}</p>
            <p className="text-white/40 text-sm">Building character consistency profile...</p>
          </div>
        </div>
      )}
    </div>
  );
}
