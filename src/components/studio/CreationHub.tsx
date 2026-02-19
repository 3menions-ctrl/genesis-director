import { useState, useRef, useCallback, useEffect, memo, useMemo } from 'react';

import { saveDraft, loadDraft, clearDraft } from '@/lib/sessionPersistence';
import { useNavigationWithLoading } from '@/components/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wand2, Image, User, Palette, Dices, Film, Coins, 
  Sparkles, Upload, Mic, ChevronRight, Play,
  Video, Layers, ArrowRight, RectangleHorizontal,
  Square, RectangleVertical, Clock, Hash, Music,
  Volume2, Settings2, X, CheckCircle2, Loader2,
  Clapperboard, ChevronDown, Zap, Crown
} from 'lucide-react';
import { ActiveProjectBanner } from './ActiveProjectBanner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { checkMultipleContent } from '@/lib/contentSafety';
import { toast } from 'sonner';
import { CreationModeCard } from './CreationModeCard';
import { VideoGenerationMode, VIDEO_MODES, STYLE_PRESETS, VideoStylePreset } from '@/types/video-modes';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useAuth } from '@/contexts/AuthContext';
import { useTemplateEnvironment } from '@/hooks/useTemplateEnvironment';
import { useTierLimits } from '@/hooks/useTierLimits';
import { SafeComponent } from '@/components/ui/error-boundary';
import { SimpleVideoPlayer } from '@/components/player';
import { TemplateAvatarSelector } from './TemplateAvatarSelector';
import { AvatarTemplate } from '@/types/avatar-templates';
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
import { BuyCreditsModal } from '@/components/credits/BuyCreditsModal';

// Extended mode data with visuals - core creation modes only
const CREATION_MODES = [
  {
    id: 'text-to-video' as VideoGenerationMode,
    name: 'Cinematic',
    description: 'Create stunning clips from text prompts',
    icon: Wand2,
    popular: true,
  },
  {
    id: 'image-to-video' as VideoGenerationMode,
    name: 'Animate Image',
    description: 'Bring any photo or artwork to life',
    icon: Image,
    popular: true,
  },
  {
    id: 'avatar' as VideoGenerationMode,
    name: 'AI Avatar',
    description: 'Talking heads with perfect lip sync',
    icon: User,
    popular: true,
    isNew: true,
  },
];

// Quick access navigation cards - Templates & Training Videos
const QUICK_ACCESS_CARDS = [
  {
    id: 'templates',
    name: 'Templates',
    description: 'Start from curated presets',
    icon: Layers,
    href: '/templates',
    color: 'violet',
  },
  {
    id: 'training',
    name: 'Training Video',
    description: 'Professional presenter videos',
    icon: Video,
    href: '/training-video',
    color: 'emerald',
  },
];

const ASPECT_RATIOS = [
  { id: '16:9', name: 'Landscape', icon: RectangleHorizontal, description: 'YouTube, TV' },
  { id: '9:16', name: 'Portrait', icon: RectangleVertical, description: 'TikTok, Reels' },
  { id: '1:1', name: 'Square', icon: Square, description: 'Instagram' },
];

const CLIP_DURATIONS = [
  { id: 5, name: '5 sec', description: 'Quick & punchy' },
  { id: 10, name: '10 sec', description: 'Standard length' },
];

const GENRE_OPTIONS = [
  { value: 'cinematic', label: 'Cinematic', icon: '🎬' },
  { value: 'documentary', label: 'Documentary', icon: '📽️' },
  { value: 'ad', label: 'Commercial', icon: '📺' },
  { value: 'educational', label: 'Educational', icon: '📚' },
  { value: 'explainer', label: 'Explainer', icon: '💡' },
  { value: 'storytelling', label: 'Narrative', icon: '📖' },
  { value: 'motivational', label: 'Motivational', icon: '✨' },
];

const MOOD_OPTIONS = [
  { value: 'epic', label: 'Epic', icon: '⚔️' },
  { value: 'tension', label: 'Suspense', icon: '🎭' },
  { value: 'emotional', label: 'Emotional', icon: '💫' },
  { value: 'action', label: 'Action', icon: '⚡' },
  { value: 'mysterious', label: 'Mystery', icon: '🌙' },
  { value: 'uplifting', label: 'Uplifting', icon: '🌅' },
  { value: 'dark', label: 'Dark', icon: '🖤' },
  { value: 'romantic', label: 'Romantic', icon: '❤️' },
];

interface CreationHubProps {
  onStartCreation: (config: {
    mode: VideoGenerationMode;
    prompt: string;
    style?: VideoStylePreset;
    voiceId?: string;
    imageUrl?: string;
    videoUrl?: string;
    aspectRatio: string;
    clipCount: number;
    clipDuration: number;
    enableNarration: boolean;
    enableMusic: boolean;
    genre?: string;
    mood?: string;
    /** Which AI engine to use: 'veo' for text/image-to-video, 'kling' for avatar */
    videoEngine?: 'kling' | 'veo';
    // Breakout template parameters
    isBreakout?: boolean;
    breakoutStartImageUrl?: string;
    breakoutPlatform?: string;
    // Avatar parameters for breakout templates
    avatarImageUrl?: string;
    avatarVoiceId?: string;
    avatarTemplateId?: string;
    avatarName?: string;
  }) => void;
  /** Called when the hub's data dependencies are loaded and UI is ready */
  onReady?: () => void;
  className?: string;
}

// CreationHub - no forwardRef needed, prevents React ref warnings
export const CreationHub = memo(function CreationHub({ onStartCreation, onReady, className }: CreationHubProps) {
  const { navigateTo: navigate } = useNavigationWithLoading();
  const { profile } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedMode, setSelectedMode] = useState<VideoGenerationMode>('text-to-video');
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<VideoStylePreset>('anime');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedVideo, setUploadedVideo] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [showBuyCredits, setShowBuyCredits] = useState(false);

  // Template/Environment hook - loads settings from URL params
  const { appliedSettings, isLoading: templateLoading, templateId } = useTemplateEnvironment();
  
  // File upload hooks
  const imageUpload = useFileUpload({ maxSizeMB: 10, allowedTypes: ['image/*'] });
  const videoUpload = useFileUpload({ maxSizeMB: 100, allowedTypes: ['video/*'] });
  
  // File input refs
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  
  // Production controls
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [clipDuration, setClipDuration] = useState(5);
  const [enableNarration, setEnableNarration] = useState(true);
  const [enableMusic] = useState(false); // Music disabled globally - low quality
  
  // Avatar selection for breakout templates
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarTemplate | null>(null);
  
  // Advanced options (for cinematic modes) - must be declared before effects that use them
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [genre, setGenre] = useState('cinematic');
  const [mood, setMood] = useState('epic');
  
  // Check if this is a breakout template that requires avatar selection
  const isBreakoutTemplate = appliedSettings?.isBreakout === true;
  
  // Get tier limits to enforce clip count restrictions
  const { tierLimits, maxClips, isLoading: tierLoading } = useTierLimits();
  
  // Initialize clip count based on tier limits (default to max allowed or 5)
  const [clipCount, setClipCount] = useState(5);
  
  // Track if we've signaled ready to prevent multiple calls
  const hasSignaledReady = useRef(false);
  
  // Signal ready when data dependencies are loaded
  // This prevents premature dismissal of GlobalLoadingOverlay
  useEffect(() => {
    if (!templateLoading && !tierLoading && !hasSignaledReady.current) {
      hasSignaledReady.current = true;
      onReady?.();
    }
  }, [templateLoading, tierLoading, onReady]);
  
  // Update clip count when tier limits load
  useEffect(() => {
    if (maxClips && clipCount > maxClips) {
      setClipCount(maxClips);
    }
  }, [maxClips, clipCount]);
  
  // Apply template settings when loaded from URL params (?template=xxx)
  useEffect(() => {
    if (appliedSettings) {
      // Apply prompt/concept from template
      if (appliedSettings.concept) {
        setPrompt(appliedSettings.concept);
      }
      // Apply clip count (capped by tier limits)
      if (appliedSettings.clipCount) {
        setClipCount(Math.min(appliedSettings.clipCount, maxClips));
      }
      // Apply mood
      if (appliedSettings.mood) {
        setMood(appliedSettings.mood);
      }
      // Apply genre
      if (appliedSettings.genre) {
        setGenre(appliedSettings.genre);
      }
      // If template has a style anchor with color grading, open advanced options
      if (appliedSettings.colorGrading || appliedSettings.environmentPrompt) {
        setShowAdvanced(true);
      }
    }
  }, [appliedSettings, maxClips]);

  // Restore draft on mount (only if no template is being applied)
  const hasRestoredDraft = useRef(false);
  useEffect(() => {
    if (hasRestoredDraft.current || templateId) return;
    hasRestoredDraft.current = true;
    const draft = loadDraft();
    if (draft) {
      if (draft.prompt) setPrompt(draft.prompt);
      if (draft.mode) setSelectedMode(draft.mode as VideoGenerationMode);
      if (draft.aspectRatio) setAspectRatio(draft.aspectRatio);
      if (draft.clipCount) setClipCount(Math.min(draft.clipCount, maxClips));
      if (draft.clipDuration) setClipDuration(draft.clipDuration);
      if (draft.genre) setGenre(draft.genre);
      if (draft.mood) setMood(draft.mood);
      if (draft.enableNarration !== undefined) setEnableNarration(draft.enableNarration);
      if (draft.imageUrl) setUploadedImage(draft.imageUrl);
    }
  }, [templateId, maxClips]);

  // Pick up image from photo editor pipeline
  useEffect(() => {
    const imageFromEditor = sessionStorage.getItem('imageToVideoUrl');
    if (imageFromEditor) {
      sessionStorage.removeItem('imageToVideoUrl');
      setSelectedMode('image-to-video');
      setUploadedImage(imageFromEditor);
      setUploadedFileName('Edited Photo');
    }
  }, []);

  // Autosave draft as user makes changes (debounced)
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      saveDraft({
        mode: selectedMode,
        prompt,
        aspectRatio,
        clipCount,
        clipDuration,
        genre,
        mood,
        enableNarration,
        enableMusic: false,
        imageUrl: uploadedImage || undefined,
      });
    }, 1500);
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
  }, [selectedMode, prompt, aspectRatio, clipCount, clipDuration, genre, mood, enableNarration, uploadedImage]);

  const currentMode = CREATION_MODES.find(m => m.id === selectedMode);
  const modeConfig = VIDEO_MODES.find(m => m.id === selectedMode);
  
  // Check if mode supports advanced options
  const supportsAdvancedOptions = selectedMode === 'text-to-video' || selectedMode === 'b-roll';
  
  // Veo 3 powers text-to-video and image-to-video; Kling powers avatar
  const isVeoMode = selectedMode === 'text-to-video' || selectedMode === 'image-to-video';
  // Veo clips are fixed 8s; Kling allows 5s or 10s
  const effectiveDuration = isVeoMode ? 8 : clipDuration;
  const videoEngine: 'kling' | 'veo' = isVeoMode ? 'veo' : 'kling';

  // Calculate estimated duration
  const estimatedDuration = clipCount * effectiveDuration;
  const estimatedMinutes = Math.floor(estimatedDuration / 60);
  const estimatedSeconds = estimatedDuration % 60;
  // Veo: 20 credits/clip (base), 30 (extended). Kling: 10/15.
  const estimatedCredits = useMemo(() => {
    const baseRate = isVeoMode ? 20 : 10;
    const extRate = isVeoMode ? 30 : 15;
    let total = 0;
    for (let i = 0; i < clipCount; i++) {
      total += i >= 6 ? extRate : baseRate;
    }
    return total;
  }, [clipCount, isVeoMode]);
  
  // User credits
  const userCredits = profile?.credits_balance ?? 0;
  const hasInsufficientCredits = userCredits < estimatedCredits;

  // Handle file selection
  const handleImageSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const result = await imageUpload.uploadFile(file);
    if (result) {
      setUploadedImage(result.url);
      setUploadedFileName(file.name);
    }
  }, [imageUpload]);

  const handleVideoSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const result = await videoUpload.uploadFile(file);
    if (result) {
      setUploadedVideo(result.url);
      setUploadedFileName(file.name);
    }
  }, [videoUpload]);

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>, type: 'image' | 'video') => {
    e.preventDefault();
    e.stopPropagation();
    
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    
    if (type === 'image') {
      const result = await imageUpload.uploadFile(file);
      if (result) {
        setUploadedImage(result.url);
        setUploadedFileName(file.name);
      }
    } else {
      const result = await videoUpload.uploadFile(file);
      if (result) {
        setUploadedVideo(result.url);
        setUploadedFileName(file.name);
      }
    }
  }, [imageUpload, videoUpload]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const clearUpload = useCallback(() => {
    setUploadedImage(null);
    setUploadedVideo(null);
    setUploadedFileName(null);
  }, []);

  const handleCreate = () => {
    // Block creation if insufficient credits - show buy modal
    if (hasInsufficientCredits) {
      setShowBuyCredits(true);
      return;
    }
    if (!prompt.trim() && modeConfig?.requiresText) return;
    
    // CLIENT-SIDE CONTENT SAFETY CHECK - First defense layer
    const safetyResult = checkMultipleContent(prompt);
    if (!safetyResult.isSafe) {
      toast.error(safetyResult.message || 'This content violates our community guidelines. Please revise your prompt.');
      return;
    }
    
    // For breakout templates, require avatar selection
    if (isBreakoutTemplate && !selectedAvatar) return;
    
    // Build creation config with breakout settings if applicable
    // CRITICAL FIX: Breakout templates must use 'text-to-video' mode to route through
    // handleCinematicMode which handles the isBreakout parameters correctly.
    // Using 'avatar' mode routes to generate-avatar-direct which ignores breakout.
    const creationConfig: Parameters<typeof onStartCreation>[0] = {
      mode: isBreakoutTemplate ? 'text-to-video' : selectedMode, // Breakout routes through cinematic pipeline
      prompt,
      style: selectedMode === 'video-to-video' ? selectedStyle : undefined,
      imageUrl: uploadedImage || undefined,
      videoUrl: uploadedVideo || undefined,
      aspectRatio,
      clipCount: isBreakoutTemplate ? 3 : clipCount, // Breakout always 3 clips
      clipDuration: isBreakoutTemplate ? 10 : effectiveDuration, // Veo=8s fixed, Breakout=10s, else user choice
      enableNarration: true,
      enableMusic,
      genre: supportsAdvancedOptions || isBreakoutTemplate ? genre : undefined,
      mood: supportsAdvancedOptions || isBreakoutTemplate ? mood : undefined,
      videoEngine, // 'veo' for text/image-to-video, 'kling' for avatar
    };
    
    // If breakout template is applied, pass the start image, avatar, and breakout flag
    if (isBreakoutTemplate && appliedSettings?.startImageUrl && selectedAvatar) {
      // For breakout templates, the start image is the platform interface
      // The avatar will appear to be inside this interface in clip 1
      (creationConfig as any).isBreakout = true;
      (creationConfig as any).breakoutStartImageUrl = appliedSettings.startImageUrl;
      (creationConfig as any).breakoutPlatform = appliedSettings.breakoutPlatform;
      // Pass avatar data for the generation - use as the reference image
      (creationConfig as any).imageUrl = selectedAvatar.front_image_url || selectedAvatar.face_image_url;
      (creationConfig as any).avatarImageUrl = selectedAvatar.front_image_url || selectedAvatar.face_image_url;
      (creationConfig as any).avatarVoiceId = selectedAvatar.voice_id;
      (creationConfig as any).avatarTemplateId = selectedAvatar.id;
      (creationConfig as any).avatarName = selectedAvatar.name;
    }
    
    onStartCreation(creationConfig);
  };

  const isReadyToCreate = () => {
    // Don't disable button for insufficient credits - let handleCreate show the buy modal
    if (modeConfig?.requiresText && !prompt.trim()) return false;
    if (modeConfig?.requiresImage && !uploadedImage) return false;
    if (modeConfig?.requiresVideo && !uploadedVideo) return false;
    // For breakout templates, require avatar selection
    if (isBreakoutTemplate && !selectedAvatar) return false;
    return true;
  };

  // Track if initialization has completed to prevent permanent invisible state
  // Use a fallback timeout to ensure content shows even if hooks stall
  const [forceVisible, setForceVisible] = useState(false);
  
  useEffect(() => {
    // Force visibility after 2s as a failsafe
    const timeout = setTimeout(() => setForceVisible(true), 2000);
    return () => clearTimeout(timeout);
  }, []);
  
  // Show content once data loads OR after failsafe timeout
  const isInitializing = (templateLoading || tierLoading) && !forceVisible;

  return (
    <div ref={containerRef} className={cn("min-h-screen pt-8 pb-24", isInitializing && "opacity-0", className)}>
      <div className="max-w-6xl mx-auto px-6">
        {/* Active Project Banner - Shows when user has an ongoing project */}
        <ActiveProjectBanner className="mb-8" />
        
        {/* Template Applied Banner */}
        {appliedSettings?.templateName && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                <Layers className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-violet-300">
                  Template: {appliedSettings.templateName}
                </p>
                <p className="text-xs text-violet-400/60">
                  {appliedSettings.clipCount} clips • {appliedSettings.genre} • {appliedSettings.mood} mood
                </p>
              </div>
            </div>
            <CheckCircle2 className="w-5 h-5 text-violet-400" />
          </motion.div>
        )}

        {/* Header - Cinematic studio */}
        <div className="text-center mb-16 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] border border-white/[0.06] mb-6">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <span className="text-sm text-white/50 font-medium tracking-wide">AI Video Studio</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-display font-bold text-white mb-5 tracking-tight">
            What will you <span className="bg-gradient-to-r from-violet-400 via-purple-300 to-fuchsia-400 bg-clip-text text-transparent">create</span>?
          </h1>
          <p className="text-lg text-white/35 max-w-xl mx-auto leading-relaxed">
            Choose your creation mode and bring your vision to life
          </p>
          
          {/* Credits display */}
          <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.06] animate-fade-in" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-white/60 tabular-nums">{userCredits.toLocaleString()} credits available</span>
          </div>
        </div>

        {/* Mode Selection Grid - Cinematic studio cards */}
        <div className="mb-10 animate-fade-in" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
          <p className="text-xs text-white/30 uppercase tracking-[0.2em] font-medium mb-4 flex items-center gap-2">
            <Film className="w-3.5 h-3.5" />
            Choose your creation mode
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {CREATION_MODES.map((mode, index) => (
              <CreationModeCard
                key={mode.id}
                id={mode.id}
                name={mode.name}
                description={mode.description}
                icon={mode.icon}
                isSelected={selectedMode === mode.id}
                isPopular={mode.popular}
                isNew={mode.isNew}
                onClick={() => {
                  if (mode.id === 'avatar') {
                    navigate('/avatars');
                  } else {
                    setSelectedMode(mode.id);
                  }
                }}
                delay={index}
              />
            ))}
          </div>
        </div>

        {/* Quick Access Cards - Templates & Training Videos */}
        <div className="mb-10 animate-fade-in" style={{ animationDelay: '350ms', animationFillMode: 'both' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
            <p className="text-xs text-white/30 uppercase tracking-[0.15em] font-medium">Or explore</p>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
          </div>
          <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto">
            {QUICK_ACCESS_CARDS.map((card) => {
              const Icon = card.icon;
              const isViolet = card.color === 'violet';
              return (
                <a
                  key={card.id}
                  href={card.href}
                  className={cn(
                    "group relative flex items-center gap-4 p-4 rounded-2xl border text-left transition-all duration-300",
                    isViolet 
                      ? 'bg-violet-500/[0.06] border-violet-500/15 hover:bg-violet-500/[0.1] hover:border-violet-500/25'
                      : 'bg-emerald-500/[0.06] border-emerald-500/15 hover:bg-emerald-500/[0.1] hover:border-emerald-500/25'
                  )}
                >
                  <div className={cn(
                    "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300",
                    isViolet ? "bg-violet-500/20 group-hover:bg-violet-500/30" : "bg-emerald-500/20 group-hover:bg-emerald-500/30"
                  )}>
                    <Icon className={cn("w-5 h-5", isViolet ? 'text-violet-400' : 'text-emerald-400')} />
                  </div>
                  <div className="min-w-0">
                    <h3 className={cn("text-sm font-semibold", isViolet ? 'text-violet-300' : 'text-emerald-300')}>
                      {card.name}
                    </h3>
                    <p className={cn("text-xs mt-0.5", isViolet ? 'text-violet-400/50' : 'text-emerald-400/50')}>
                      {card.description}
                    </p>
                  </div>
                </a>
              );
            })}
          </div>
        </div>

        {/* Configuration Panel - Premium glass */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          layout
          className="relative p-8 md:p-10 rounded-3xl bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] overflow-hidden"
        >
          {/* Subtle inner glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] via-transparent to-transparent pointer-events-none" />
          
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedMode}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="relative space-y-8"
            >
              {/* Mode header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 rounded-2xl bg-white/[0.08] border border-white/[0.1] flex items-center justify-center">
                    {currentMode && <currentMode.icon className="w-8 h-8 text-white" />}
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold text-white">{currentMode?.name}</h2>
                    <p className="text-sm text-white/40">{currentMode?.description}</p>
                  </div>
                </div>
                
                {/* Quick stats */}
                <div className="hidden md:flex items-center gap-6 text-sm">
                  <div className="text-center">
                    <p className="text-white/30 text-xs mb-1">Duration</p>
                    <p className="text-white font-medium">
                      {estimatedMinutes > 0 ? `${estimatedMinutes}m ${estimatedSeconds}s` : `${estimatedSeconds}s`}
                    </p>
                  </div>
                  <div className="w-px h-8 bg-white/10" />
                  <div className="text-center">
                    <p className="text-white/30 text-xs mb-1">Credits</p>
                    <p className={cn(
                      "font-medium",
                      hasInsufficientCredits ? "text-red-400" : "text-white"
                    )}>{estimatedCredits}</p>
                  </div>
                </div>
              </div>

              {/* Production Controls Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Aspect Ratio */}
                <div className="space-y-3 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                  <Label className="text-xs text-white/50 font-medium uppercase tracking-wider flex items-center gap-2">
                    <RectangleHorizontal className="w-3.5 h-3.5" />
                    Aspect Ratio
                  </Label>
                  <div className="flex gap-2">
                    {ASPECT_RATIOS.map((ratio) => (
                      <button
                        key={ratio.id}
                        onClick={() => setAspectRatio(ratio.id)}
                        className={cn(
                          "flex-1 flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all",
                          aspectRatio === ratio.id
                            ? "bg-white/[0.1] border-white/30"
                            : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05]"
                        )}
                      >
                        <ratio.icon className={cn(
                          "w-5 h-5",
                          aspectRatio === ratio.id ? "text-white" : "text-white/40"
                        )} />
                        <span className={cn(
                          "text-xs font-medium",
                          aspectRatio === ratio.id ? "text-white" : "text-white/50"
                        )}>{ratio.id}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Number of Clips */}
                <div className="space-y-3 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-white/50 font-medium uppercase tracking-wider flex items-center gap-2">
                      <Hash className="w-3.5 h-3.5" />
                      Clips
                    </Label>
                    <span className="text-lg font-semibold text-white">{clipCount}</span>
                  </div>
                  <Slider
                    value={[clipCount]}
                    onValueChange={([value]) => setClipCount(Math.min(value, maxClips))}
                    min={1}
                    max={maxClips}
                    step={1}
                    className="py-2"
                    disabled={tierLoading}
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-white/30">
                      {tierLoading ? 'Loading limits...' : `1-${maxClips} clips (${tierLimits?.tier || 'free'} tier)`}
                    </p>
                    {maxClips < 20 && (
                      <button 
                        onClick={() => window.location.href = '/settings?tab=billing'}
                        className="flex items-center gap-1 text-xs text-amber-400/80 hover:text-amber-400 transition-colors"
                      >
                        <Crown className="w-3 h-3" />
                        <span>Upgrade for more</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Clip Duration */}
                <div className="space-y-3 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                  <Label className="text-xs text-white/50 font-medium uppercase tracking-wider flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" />
                    Clip Duration
                    {isVeoMode && (
                      <span className="ml-auto text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        Veo 3 · Fixed 8s
                      </span>
                    )}
                  </Label>
                  {isVeoMode ? (
                    // Veo 3 clips are always 8 seconds — not user-configurable
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                      <span className="text-sm font-semibold text-blue-300">8 sec</span>
                      <span className="text-xs text-white/30">Google Veo 3 native clip length</span>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      {CLIP_DURATIONS.map((duration) => (
                        <button
                          key={duration.id}
                          onClick={() => setClipDuration(duration.id)}
                          className={cn(
                            "flex-1 flex flex-col items-center gap-1 p-3 rounded-xl border transition-all",
                            clipDuration === duration.id
                              ? "bg-white/[0.1] border-white/30"
                              : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05]"
                          )}
                        >
                          <span className={cn(
                            "text-sm font-semibold",
                            clipDuration === duration.id ? "text-white" : "text-white/50"
                          )}>{duration.name}</span>
                          <span className="text-xs text-white/30">{duration.description}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Audio Options */}
                <div className="space-y-4 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                  <Label className="text-xs text-white/50 font-medium uppercase tracking-wider flex items-center gap-2">
                    <Volume2 className="w-3.5 h-3.5" />
                    Audio
                  </Label>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Mic className="w-4 h-4 text-white/40" />
                        <span className="text-sm text-white/70">Narration</span>
                      </div>
                      <Switch
                        checked={enableNarration}
                        onCheckedChange={setEnableNarration}
                      />
                    </div>
                    {/* Music toggle removed - music disabled globally */}
                  </div>
                </div>
              </div>

              {/* Advanced Options for Cinematic modes */}
              {supportsAdvancedOptions && (
                <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center gap-2 text-sm text-white/50 hover:text-white/70 transition-colors">
                      <Settings2 className="w-4 h-4" />
                      <span>Advanced Options</span>
                      <ChevronDown className={cn(
                        "w-4 h-4 transition-transform",
                        showAdvanced && "rotate-180"
                      )} />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Genre Selection */}
                      <div className="space-y-3 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                        <Label className="text-xs text-white/50 font-medium uppercase tracking-wider flex items-center gap-2">
                          <Clapperboard className="w-3.5 h-3.5" />
                          Genre
                        </Label>
                        <Select value={genre} onValueChange={setGenre}>
                          <SelectTrigger className="bg-white/[0.03] border-white/[0.08] text-white h-11 rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-zinc-900 border-white/10">
                            {GENRE_OPTIONS.map((g) => (
                              <SelectItem 
                                key={g.value} 
                                value={g.value}
                                className="text-white focus:bg-white/10 focus:text-white"
                              >
                                <span className="flex items-center gap-2">
                                  <span>{g.icon}</span>
                                  <span>{g.label}</span>
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Mood Selection */}
                      <div className="space-y-3 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                        <Label className="text-xs text-white/50 font-medium uppercase tracking-wider">
                          Mood
                        </Label>
                        <ScrollArea className="w-full">
                          <div className="flex gap-2 pb-2">
                            {MOOD_OPTIONS.map((m) => (
                              <button
                                key={m.value}
                                onClick={() => setMood(m.value)}
                                className={cn(
                                  "flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg border transition-all text-sm",
                                  mood === m.value
                                    ? "bg-white/[0.1] border-white/30 text-white"
                                    : "bg-white/[0.02] border-white/[0.06] text-white/50 hover:bg-white/[0.05]"
                                )}
                              >
                                <span>{m.icon}</span>
                                <span>{m.label}</span>
                              </button>
                            ))}
                          </div>
                          <ScrollBar orientation="horizontal" />
                        </ScrollArea>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Input Section based on mode */}
              <div className="space-y-6">
                {/* Avatar Selection for breakout templates */}
                {isBreakoutTemplate && (
                  <div className="space-y-4 p-5 rounded-2xl bg-violet-500/5 border border-violet-500/20">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                        <User className="w-5 h-5 text-violet-400" />
                      </div>
                      <div>
                        <h4 className="text-base font-semibold text-white">Select Your Avatar</h4>
                        <p className="text-sm text-white/50">
                          Choose who will break through the {appliedSettings?.breakoutPlatform || 'screen'}
                        </p>
                      </div>
                    </div>
                    
                    <TemplateAvatarSelector
                      selectedAvatar={selectedAvatar}
                      onSelect={setSelectedAvatar}
                      compact
                    />
                    
                    {/* Template preview image */}
                    {appliedSettings?.startImageUrl && (
                      <div className="mt-4">
                        <Label className="text-xs text-white/40 mb-2 block">Template Start Frame</Label>
                        <div className="relative rounded-xl overflow-hidden border border-white/10">
                          <img 
                            src={appliedSettings.startImageUrl} 
                            alt="Template start frame" 
                            className="w-full h-32 object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                          <div className="absolute bottom-2 left-2 text-xs text-white/70">
                            {appliedSettings.templateName} template
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Image/Video Upload for modes that require it */}
                {(modeConfig?.requiresImage || modeConfig?.requiresVideo) && !isBreakoutTemplate && (
                  <div className="space-y-3">
                    <Label className="text-sm text-white/60 font-medium">
                      {modeConfig.requiresVideo ? 'Upload Video' : 'Upload Image'}
                    </Label>
                    
                    {/* Hidden file inputs */}
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                    <input
                      ref={videoInputRef}
                      type="file"
                      accept="video/*"
                      onChange={handleVideoSelect}
                      className="hidden"
                    />
                    
                    {/* Upload area or preview */}
                    {(uploadedImage || uploadedVideo) ? (
                      <div className="relative rounded-2xl overflow-hidden border border-white/[0.1] bg-white/[0.02]">
                        {uploadedImage && (
                          <img 
                            src={uploadedImage} 
                            alt="Uploaded" 
                            className="w-full h-48 object-cover"
                          />
                        )}
                        {uploadedVideo && (
                          <SimpleVideoPlayer 
                            src={uploadedVideo} 
                            className="w-full h-48 object-cover"
                            showControls
                          />
                        )}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-green-400" />
                              <span className="text-sm text-white/80 truncate max-w-[200px]">
                                {uploadedFileName}
                              </span>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={clearUpload}
                              className="text-white/60 hover:text-white hover:bg-white/10"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div 
                        onClick={() => modeConfig?.requiresVideo ? videoInputRef.current?.click() : imageInputRef.current?.click()}
                        onDrop={(e) => handleDrop(e, modeConfig?.requiresVideo ? 'video' : 'image')}
                        onDragOver={handleDragOver}
                        className={cn(
                          "border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer group",
                          (imageUpload.isUploading || videoUpload.isUploading)
                            ? "border-white/30 bg-white/[0.05]"
                            : "border-white/[0.1] hover:border-white/20 hover:bg-white/[0.02]"
                        )}
                      >
                        <div className="flex flex-col items-center gap-4">
                          <div className="w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/[0.1] flex items-center justify-center group-hover:bg-white/[0.1] transition-colors">
                            {(imageUpload.isUploading || videoUpload.isUploading) ? (
                              <Loader2 className="w-6 h-6 text-white/70 animate-spin" />
                            ) : (
                              <Upload className="w-6 h-6 text-white/50 group-hover:text-white/70 transition-colors" />
                            )}
                          </div>
                          <div>
                            {(imageUpload.isUploading || videoUpload.isUploading) ? (
                              <>
                                <p className="text-sm text-white/70 font-medium">
                                  Uploading... {imageUpload.progress || videoUpload.progress}%
                                </p>
                                <div className="w-48 h-1.5 bg-white/10 rounded-full mt-3 mx-auto overflow-hidden">
                                  <div 
                                    className="h-full bg-white/60 rounded-full transition-all"
                                    style={{ width: `${imageUpload.progress || videoUpload.progress}%` }}
                                  />
                                </div>
                              </>
                            ) : (
                              <>
                                <p className="text-sm text-white/70 font-medium">
                                  Drag & drop or click to upload
                                </p>
                                <p className="text-xs text-white/30 mt-1">
                                  {modeConfig?.requiresVideo ? 'MP4, MOV up to 100MB' : 'PNG, JPG up to 10MB'}
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Text prompt - For breakout templates, this is the DIALOGUE the avatar speaks */}
                {(modeConfig?.requiresText || isBreakoutTemplate) && (
                  <div className="space-y-3">
                    <Label className="text-sm text-white/60 font-medium">
                      {isBreakoutTemplate 
                        ? '💬 What should the avatar say?' 
                        : selectedMode === 'avatar' 
                          ? 'What should the avatar say?' 
                          : 'Describe your vision'}
                    </Label>
                    {isBreakoutTemplate && (
                      <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
                        <p className="text-sm text-violet-300 font-medium mb-1">
                          ✨ Enter your avatar's dialogue only
                        </p>
                        <p className="text-xs text-violet-400/70">
                          The 3-clip breakout sequence (inside UI → shattering → emerged) is automatically generated. Just write what {selectedAvatar?.name || 'the avatar'} should SAY in the final clip.
                        </p>
                      </div>
                    )}
                    <Textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder={
                        isBreakoutTemplate
                          ? `Hey! I just broke through your screen to tell you about something amazing! Check out our new product...`
                          : selectedMode === 'text-to-video' 
                            ? "A cinematic drone shot over misty mountains at sunrise, golden light filtering through clouds..."
                            : selectedMode === 'avatar'
                              ? "Welcome to our product demo. Today I'll show you..."
                              : selectedMode === 'image-to-video'
                                ? "The character slowly turns to face the camera, wind blowing through their hair..."
                                : "Describe the motion or style you want..."
                      }
                      className="min-h-[140px] bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/25 resize-none rounded-xl focus:border-white/20 focus:ring-white/10 text-base"
                    />
                    <p className="text-xs text-white/30 text-right">
                      {prompt.length} characters
                    </p>
                  </div>
                )}

                {/* Style Presets for video-to-video */}
                {selectedMode === 'video-to-video' && (
                  <div className="space-y-3">
                    <Label className="text-sm text-white/60 font-medium">Style Preset</Label>
                    <ScrollArea className="w-full">
                      <div className="flex gap-3 pb-2">
                        {STYLE_PRESETS.map((style) => (
                          <button
                            key={style.id}
                            onClick={() => setSelectedStyle(style.id)}
                            className={cn(
                              "flex-shrink-0 p-4 rounded-xl border transition-all text-left min-w-[140px]",
                              selectedStyle === style.id
                                ? "bg-white/[0.08] border-white/30"
                                : "bg-white/[0.02] border-white/[0.08] hover:bg-white/[0.05]"
                            )}
                          >
                            <div className={cn(
                              "w-full aspect-video rounded-lg mb-3",
                              getStyleGradient(style.id)
                            )} />
                            <p className="text-sm font-medium text-white">{style.name}</p>
                            <p className="text-xs text-white/40 mt-0.5">{style.description}</p>
                          </button>
                        ))}
                      </div>
                      <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                  </div>
                )}
              </div>

              {/* Summary & Action */}
              <div className="pt-4 space-y-4">
                {/* Summary bar */}
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08]">
                    <RectangleHorizontal className="w-3.5 h-3.5 text-white/50" />
                    <span className="text-white/70">{aspectRatio}</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08]">
                    <Hash className="w-3.5 h-3.5 text-white/50" />
                    <span className="text-white/70">{clipCount} clips</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08]">
                    <Clock className="w-3.5 h-3.5 text-white/50" />
                    <span className="text-white/70">{effectiveDuration}s each</span>
                  </div>
                  {isVeoMode && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20">
                      <span className="text-blue-300 text-xs font-semibold">Google Veo 3</span>
                    </div>
                  )}
                  {supportsAdvancedOptions && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08]">
                      <Clapperboard className="w-3.5 h-3.5 text-white/50" />
                      <span className="text-white/70 capitalize">{genre}</span>
                    </div>
                  )}
                  {enableNarration && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08]">
                      <Mic className="w-3.5 h-3.5 text-white/50" />
                      <span className="text-white/70">Narration</span>
                    </div>
                  )}
                  {/* Music badge removed - music disabled globally */}
                </div>
                
                {/* Insufficient credits warning */}
                {hasInsufficientCredits && (
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                    <Zap className="w-5 h-5 text-red-400" />
                    <p className="text-sm text-red-300">
                      You need {estimatedCredits - userCredits} more credits for this video.{' '}
                      <button onClick={() => setShowBuyCredits(true)} className="underline hover:text-red-200">Get credits</button>
                    </p>
                  </div>
                )}
                
                {/* Create Button */}
                <Button
                  size="lg"
                  onClick={handleCreate}
                  disabled={!isReadyToCreate()}
                  className={cn(
                    "w-full h-14 text-base font-semibold rounded-2xl transition-all duration-300 group",
                    hasInsufficientCredits
                      ? "bg-amber-500 text-black hover:bg-amber-400"
                      : "bg-white text-black hover:bg-white/90",
                    "shadow-[0_0_40px_rgba(255,255,255,0.1)]",
                    "hover:shadow-[0_0_60px_rgba(255,255,255,0.15)]",
                    "disabled:opacity-40 disabled:shadow-none"
                  )}
                >
                  <span className="flex items-center gap-3">
                    {hasInsufficientCredits ? (
                      <>
                        <Coins className="w-5 h-5" />
                        Get Credits to Create
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        Create {currentMode?.name} • {estimatedCredits} credits
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </span>
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Inspiration prompts - Subtle */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-10"
        >
          <h3 className="text-sm font-medium text-white/30 mb-4 flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Need inspiration? Try these prompts
          </h3>
          <div className="flex flex-wrap gap-2">
            {getExamplePrompts(selectedMode).map((example, i) => (
              <button
                key={i}
                onClick={() => setPrompt(example)}
                className="px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.08] text-xs text-white/50 hover:bg-white/[0.06] hover:text-white/70 hover:border-white/15 transition-all"
              >
                {example.slice(0, 50)}...
              </button>
            ))}
          </div>
        </motion.div>
      </div>
      
      {/* Buy Credits Modal */}
      <BuyCreditsModal 
        open={showBuyCredits} 
        onOpenChange={setShowBuyCredits} 
      />
    </div>
  );
});

// Helper function outside the component
function getStyleGradient(style: VideoStylePreset): string {
  const gradients: Record<VideoStylePreset, string> = {
    'anime': 'bg-gradient-to-br from-pink-400 via-purple-400 to-blue-400',
    '3d-animation': 'bg-gradient-to-br from-amber-300 via-orange-400 to-red-400',
    'cyberpunk': 'bg-gradient-to-br from-cyan-500 via-purple-500 to-pink-500',
    'oil-painting': 'bg-gradient-to-br from-amber-600 via-orange-500 to-yellow-400',
    'watercolor': 'bg-gradient-to-br from-blue-300 via-teal-300 to-green-300',
    'claymation': 'bg-gradient-to-br from-amber-400 via-orange-300 to-rose-300',
    'noir': 'bg-gradient-to-br from-zinc-900 via-zinc-700 to-zinc-500',
    'vintage-film': 'bg-gradient-to-br from-amber-200 via-orange-200 to-yellow-100',
    'comic-book': 'bg-gradient-to-br from-red-500 via-yellow-400 to-blue-500',
    'fantasy': 'bg-gradient-to-br from-violet-400 via-purple-500 to-fuchsia-400',
    'hyperreal': 'bg-gradient-to-br from-slate-600 via-blue-600 to-teal-500',
    'surrealist': 'bg-gradient-to-br from-amber-300 via-sky-400 to-amber-200',
    'ukiyo-e': 'bg-gradient-to-br from-blue-800 via-red-700 to-slate-200',
    'art-deco': 'bg-gradient-to-br from-yellow-500 via-zinc-900 to-teal-600',
    'gothic': 'bg-gradient-to-br from-zinc-900 via-purple-900 to-red-900',
    'solarpunk': 'bg-gradient-to-br from-green-400 via-yellow-400 to-sky-400',
    'baroque': 'bg-gradient-to-br from-red-900 via-amber-600 to-yellow-700',
    'synthwave': 'bg-gradient-to-br from-pink-500 via-purple-600 to-cyan-500',
    'impressionist': 'bg-gradient-to-br from-sky-300 via-green-300 to-pink-300',
    'cel-shaded': 'bg-gradient-to-br from-orange-500 via-cyan-500 to-pink-500',
  };
  return gradients[style] || 'bg-gradient-to-br from-zinc-400 to-zinc-600';
}

function getExamplePrompts(mode: VideoGenerationMode): string[] {
  const prompts: Record<VideoGenerationMode, string[]> = {
    'text-to-video': [
      'A cinematic drone shot over misty mountains at golden hour, dramatic clouds and light rays',
      'A lone astronaut walking on Mars, red dust swirling in the wind, Earth visible in the sky',
      'An ancient library with floating books, magical particles of light, mystical atmosphere',
    ],
    'image-to-video': [
      'The portrait slowly comes to life, the subject blinking and looking around curiously',
      'Gentle wind blows through the scene, leaves rustling and light dappling',
      'The camera slowly pushes in while subtle movement brings the scene to life',
    ],
    'avatar': [
      'Hello and welcome! In this video, I will walk you through our amazing new product features',
      'Today we are going to learn about the fundamentals of machine learning in just 5 minutes',
      'Breaking news: Scientists have discovered something remarkable about the universe',
    ],
    'video-to-video': [
      'Transform into Studio Ghibli anime style with soft watercolor backgrounds',
      'Apply cyberpunk neon aesthetic with rain and holographic advertisements',
      'Convert to dramatic noir cinematography with high contrast shadows',
    ],
    'motion-transfer': [
      'Apply this dance routine to my character while maintaining their appearance',
      'Transfer the walking motion while preserving the original outfit and identity',
      'Apply professional presentation gestures to the avatar',
    ],
    'b-roll': [
      'Aerial view of ocean waves crashing on rocky coastline at sunset',
      'Time-lapse of city traffic at night with light trails',
      'Close-up of coffee being poured with steam rising, warm lighting',
    ],
  };
  return prompts[mode] || [];
}
