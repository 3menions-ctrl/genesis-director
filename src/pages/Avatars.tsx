import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { 
  User, Search, ArrowLeft, Sparkles, Check,
  Loader2, Crown, Volume2, RectangleHorizontal,
  RectangleVertical, Square, Clock, Music, Mic,
  Play, Zap, ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAvatarTemplates } from '@/hooks/useAvatarTemplates';
import { AvatarTemplate, AVATAR_STYLES, AVATAR_GENDERS } from '@/types/avatar-templates';
import { AvatarPreviewModal } from '@/components/avatars/AvatarPreviewModal';
import { AppHeader } from '@/components/layout/AppHeader';
import PipelineBackground from '@/components/production/PipelineBackground';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  const [showAdvanced, setShowAdvanced] = useState(false);

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
    setCreationStatus('Initializing avatar pipeline...');

    try {
      const { data, error } = await supabase.functions.invoke('mode-router', {
        body: {
          mode: 'avatar',
          userId: user.id,
          prompt: prompt,
          imageUrl: selectedAvatar.face_image_url,
          voiceId: selectedAvatar.voice_id,
          aspectRatio,
          clipCount,
          clipDuration,
          enableNarration: true,
          enableMusic,
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
    <div className="relative min-h-screen flex flex-col">
      <PipelineBackground />
      <AppHeader />
      
      <div className="relative z-10 flex-1 pt-8 pb-24">
        <div className="max-w-7xl mx-auto px-6">
          {/* Back Button & Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
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
            
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-violet-500/20 flex items-center justify-center border border-violet-500/30">
                <User className="w-7 h-7 text-violet-400" />
              </div>
              <div>
                <h1 className="text-3xl font-display font-bold text-white">AI Avatars</h1>
                <p className="text-white/50">Choose a presenter and create your video</p>
              </div>
            </div>
          </motion.div>

          <div className="grid lg:grid-cols-[1fr,400px] gap-8">
            {/* Left: Avatar Gallery */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-6"
            >
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
                  <SelectContent className="bg-zinc-900 border-white/10">
                    {AVATAR_GENDERS.map((g) => (
                      <SelectItem key={g.id} value={g.id} className="text-white focus:bg-white/10 focus:text-white">
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={styleFilter} onValueChange={setStyleFilter}>
                  <SelectTrigger className="w-[150px] bg-white/[0.03] border-white/[0.08] text-white">
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

              {/* Loading State */}
              {isLoading && (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
                </div>
              )}

              {/* Error State */}
              {error && (
                <div className="text-center py-12 text-red-400">
                  <p>{error}</p>
                </div>
              )}

              {/* Avatar Grid */}
              {!isLoading && !error && (
                <ScrollArea className="h-[calc(100vh-350px)]">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pr-4">
                    <AnimatePresence mode="popLayout">
                      {templates.map((avatar, index) => (
                        <motion.div
                          key={avatar.id}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ delay: index * 0.02 }}
                          className={cn(
                            "group relative rounded-xl overflow-hidden cursor-pointer transition-all duration-200",
                            "border",
                            selectedAvatar?.id === avatar.id
                              ? "border-violet-500 ring-2 ring-violet-500/30 bg-violet-500/10"
                              : "border-white/[0.08] hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.05]"
                          )}
                          onClick={() => handleAvatarClick(avatar)}
                        >
                          {/* Avatar Image */}
                          <div className="aspect-square relative overflow-hidden">
                            <img
                              src={avatar.face_image_url}
                              alt={avatar.name}
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                              loading="lazy"
                            />
                            
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                            
                            {selectedAvatar?.id === avatar.id && (
                              <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center">
                                <Check className="w-4 h-4 text-white" />
                              </div>
                            )}

                            {avatar.is_premium && (
                              <div className="absolute top-2 left-2">
                                <Badge className="bg-amber-500/90 text-black text-[10px] px-1.5 py-0.5">
                                  <Crown className="w-3 h-3 mr-0.5" />
                                  PRO
                                </Badge>
                              </div>
                            )}

                            {/* Quick voice preview button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleVoicePreview(avatar);
                              }}
                              className={cn(
                                "absolute bottom-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all",
                                "bg-black/50 hover:bg-black/70 backdrop-blur-sm opacity-0 group-hover:opacity-100"
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
                          <div className="p-3">
                            <h4 className="font-medium text-white text-sm truncate">{avatar.name}</h4>
                            <p className="text-xs text-white/40 truncate">
                              {avatar.voice_description || avatar.style}
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  {templates.length === 0 && (
                    <div className="text-center py-16">
                      <User className="w-12 h-12 text-white/20 mx-auto mb-4" />
                      <p className="text-white/50 mb-2">No avatars found</p>
                      <p className="text-sm text-white/30">Try adjusting your filters</p>
                    </div>
                  )}
                </ScrollArea>
              )}
            </motion.div>

            {/* Right: Configuration Panel */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-6"
            >
              {/* Selected Avatar Preview */}
              <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm">
                {selectedAvatar ? (
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <img
                        src={selectedAvatar.face_image_url}
                        alt={selectedAvatar.name}
                        className="w-16 h-16 rounded-xl object-cover border border-white/10"
                      />
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-white">{selectedAvatar.name}</h4>
                        <Sparkles className="w-4 h-4 text-violet-400" />
                      </div>
                      <p className="text-sm text-white/50 truncate">{selectedAvatar.voice_name}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedAvatar(null)}
                      className="text-white/50 hover:text-white"
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-4 py-2">
                    <div className="w-16 h-16 rounded-xl bg-white/[0.05] border border-dashed border-white/20 flex items-center justify-center">
                      <User className="w-6 h-6 text-white/30" />
                    </div>
                    <div>
                      <p className="text-white/50 font-medium">No avatar selected</p>
                      <p className="text-sm text-white/30">Click an avatar to preview</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Script Input */}
              <div className="space-y-3">
                <Label className="text-white/70 flex items-center gap-2">
                  <Mic className="w-4 h-4" />
                  What should they say?
                </Label>
                <Textarea
                  placeholder="Enter the script for your avatar... e.g., 'Welcome to our channel! Today we're going to explore...'"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-[120px] bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/30 resize-none"
                />
                <p className="text-xs text-white/40">{prompt.length} characters</p>
              </div>

              {/* Aspect Ratio */}
              <div className="space-y-3">
                <Label className="text-white/70">Aspect Ratio</Label>
                <div className="flex gap-2">
                  {ASPECT_RATIOS.map((ratio) => (
                    <button
                      key={ratio.id}
                      onClick={() => setAspectRatio(ratio.id)}
                      className={cn(
                        "flex-1 p-3 rounded-xl border transition-all flex flex-col items-center gap-2",
                        aspectRatio === ratio.id
                          ? "border-violet-500 bg-violet-500/10 text-violet-300"
                          : "border-white/[0.08] bg-white/[0.02] text-white/50 hover:border-white/20"
                      )}
                    >
                      <ratio.icon className="w-5 h-5" />
                      <span className="text-xs font-medium">{ratio.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Clip Settings */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <Label className="text-white/70 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Duration
                  </Label>
                  <Select value={String(clipDuration)} onValueChange={(v) => setClipDuration(Number(v))}>
                    <SelectTrigger className="bg-white/[0.03] border-white/[0.08] text-white">
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

                <div className="space-y-3">
                  <Label className="text-white/70">Clips ({clipCount})</Label>
                  <Slider
                    value={[clipCount]}
                    onValueChange={([v]) => setClipCount(v)}
                    min={1}
                    max={maxClips}
                    step={1}
                    className="py-2"
                  />
                </div>
              </div>

              {/* Music Toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                <div className="flex items-center gap-3">
                  <Music className="w-5 h-5 text-white/50" />
                  <div>
                    <p className="text-sm font-medium text-white/80">Background Music</p>
                    <p className="text-xs text-white/40">AI-generated soundtrack</p>
                  </div>
                </div>
                <Switch checked={enableMusic} onCheckedChange={setEnableMusic} />
              </div>

              {/* Cost Summary */}
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/50">Estimated duration</span>
                  <span className="text-white font-medium">{estimatedDuration} seconds</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/50">Credits required</span>
                  <span className={cn("font-medium", hasInsufficientCredits ? "text-red-400" : "text-amber-400")}>
                    {estimatedCredits} credits
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm pt-2 border-t border-white/[0.08]">
                  <span className="text-white/50">Your balance</span>
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span className="text-white font-medium">{userCredits.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Create Button */}
              <Button
                onClick={handleCreate}
                disabled={!isReadyToCreate || isCreating}
                className={cn(
                  "w-full h-14 text-lg font-medium transition-all",
                  isReadyToCreate
                    ? "bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white"
                    : "bg-white/[0.05] text-white/30 cursor-not-allowed"
                )}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    {creationStatus || 'Creating...'}
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 mr-2" />
                    Create Avatar Video
                  </>
                )}
              </Button>

              {hasInsufficientCredits && (
                <p className="text-center text-sm text-red-400">
                  Insufficient credits. <button onClick={() => navigate('/settings?tab=billing')} className="underline">Buy more</button>
                </p>
              )}
            </motion.div>
          </div>
        </div>
      </div>

      {/* Avatar Preview Modal */}
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
            <p className="text-white/40 text-sm">This may take a moment</p>
          </div>
        </div>
      )}
    </div>
  );
}
