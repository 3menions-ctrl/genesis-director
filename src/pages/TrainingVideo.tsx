import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStudio } from '@/contexts/StudioContext';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, User, Mic, Image, Play, Loader2, Check,
  Volume2, Sparkles, ArrowRight, RefreshCw, Download,
  Video, AlertCircle, Trash2, Coins, Zap
} from 'lucide-react';
import { CreditsDisplay } from '@/components/studio/CreditsDisplay';

// Import environment presets
import goldenHourStudioImg from '@/assets/environments/golden-hour-studio.jpg';
import neonNoirCityImg from '@/assets/environments/neon-noir-city.jpg';
import coastalSerenityImg from '@/assets/environments/coastal-serenity.jpg';
import forestMystiqueImg from '@/assets/environments/forest-mystique.jpg';
import modernMinimalistImg from '@/assets/environments/modern-minimalist.jpg';
import alpineDawnImg from '@/assets/environments/alpine-dawn.jpg';
import cozyFirelightImg from '@/assets/environments/cozy-firelight.jpg';
import overcastDramaImg from '@/assets/environments/overcast-drama.jpg';

// Voice options from OpenAI TTS with sample text for preview
const VOICE_OPTIONS = [
  { id: 'nova', name: 'Nova', gender: 'female', description: 'Warm, professional', sample: 'Welcome to our training program. Today we will explore best practices for success.' },
  { id: 'alloy', name: 'Alloy', gender: 'neutral', description: 'Versatile, clear', sample: 'This module covers the essential skills you need to excel in your role.' },
  { id: 'echo', name: 'Echo', gender: 'male', description: 'Friendly, warm', sample: 'Hey there! Ready to learn something new? Let me walk you through it step by step.' },
  { id: 'fable', name: 'Fable', gender: 'male', description: 'Expressive, storyteller', sample: 'Picture this: a world where every challenge becomes an opportunity for growth.' },
  { id: 'onyx', name: 'Onyx', gender: 'male', description: 'Deep, authoritative', sample: 'The following information is critical to your understanding of company protocols.' },
  { id: 'shimmer', name: 'Shimmer', gender: 'female', description: 'Soft, gentle', sample: 'Take a moment to reflect on what you have learned. Every step forward matters.' },
];

// Background presets
const BACKGROUND_PRESETS = [
  { id: 'golden_hour_studio', name: 'Golden Hour Studio', image: goldenHourStudioImg },
  { id: 'modern_minimalist', name: 'Modern Minimalist', image: modernMinimalistImg },
  { id: 'neon_noir_city', name: 'Neon Noir', image: neonNoirCityImg },
  { id: 'coastal_serenity', name: 'Coastal Serenity', image: coastalSerenityImg },
  { id: 'forest_mystique', name: 'Forest Mystique', image: forestMystiqueImg },
  { id: 'alpine_dawn', name: 'Alpine Dawn', image: alpineDawnImg },
  { id: 'cozy_firelight', name: 'Cozy Firelight', image: cozyFirelightImg },
  { id: 'overcast_drama', name: 'Overcast Drama', image: overcastDramaImg },
];

type GenerationStep = 'idle' | 'generating_audio' | 'generating_video' | 'applying_lipsync' | 'complete' | 'error';

export default function TrainingVideo() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { credits } = useStudio();
  // State
  const [characterImage, setCharacterImage] = useState<string | null>(null);
  const [characterImageFile, setCharacterImageFile] = useState<File | null>(null);
  const [customBackground, setCustomBackground] = useState<string | null>(null);
  const [selectedBackground, setSelectedBackground] = useState<string | null>('modern_minimalist');
  const [selectedVoice, setSelectedVoice] = useState<string>('nova');
  const [scriptText, setScriptText] = useState('');
  const [generationStep, setGenerationStep] = useState<GenerationStep>('idle');
  const [progress, setProgress] = useState(0);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [isPreloadingVoices, setIsPreloadingVoices] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState(0);
  const [preloadedVoices, setPreloadedVoices] = useState<Set<string>>(new Set());
  const characterInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Handle character image upload
  const handleCharacterUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be less than 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setCharacterImage(e.target?.result as string);
      setCharacterImageFile(file);
    };
    reader.readAsDataURL(file);
    toast.success('Character image uploaded');
  }, []);

  // Handle background image upload
  const handleBackgroundUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setCustomBackground(e.target?.result as string);
      setSelectedBackground(null);
    };
    reader.readAsDataURL(file);
    toast.success('Custom background uploaded');
  }, []);

  // Voice preview cache key prefix
  const VOICE_CACHE_KEY = 'apex_voice_preview_';
  const VOICE_CACHE_VERSION = 'v1';
  
  // Get cached voice preview from localStorage
  const getCachedVoicePreview = (voiceId: string): string | null => {
    try {
      const cacheKey = `${VOICE_CACHE_KEY}${VOICE_CACHE_VERSION}_${voiceId}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { audioUrl, timestamp } = JSON.parse(cached);
        // Cache expires after 7 days
        const weekInMs = 7 * 24 * 60 * 60 * 1000;
        if (Date.now() - timestamp < weekInMs) {
          return audioUrl;
        }
        // Expired, remove it
        localStorage.removeItem(cacheKey);
      }
    } catch (e) {
      console.warn('Failed to read voice cache:', e);
    }
    return null;
  };
  
  // Save voice preview to localStorage
  const cacheVoicePreview = (voiceId: string, audioUrl: string) => {
    try {
      const cacheKey = `${VOICE_CACHE_KEY}${VOICE_CACHE_VERSION}_${voiceId}`;
      localStorage.setItem(cacheKey, JSON.stringify({
        audioUrl,
        timestamp: Date.now(),
      }));
    } catch (e) {
      console.warn('Failed to cache voice preview:', e);
    }
  };

  // Preview a specific voice with its sample text (with caching)
  const handleVoicePreview = async (voiceId: string, sampleText?: string) => {
    // If already playing this voice, stop it
    if (previewingVoiceId === voiceId && currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setPreviewingVoiceId(null);
      setCurrentAudio(null);
      return;
    }
    
    // Stop any currently playing audio
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    
    setPreviewingVoiceId(voiceId);
    
    try {
      // Check cache first
      const cachedAudioUrl = getCachedVoicePreview(voiceId);
      
      if (cachedAudioUrl) {
        // Use cached audio - instant playback!
        const audio = new Audio(cachedAudioUrl);
        setCurrentAudio(audio);
        
        audio.onended = () => {
          setPreviewingVoiceId(null);
          setCurrentAudio(null);
        };
        audio.onerror = () => {
          // Cache might be corrupted, clear it and try fresh
          localStorage.removeItem(`${VOICE_CACHE_KEY}${VOICE_CACHE_VERSION}_${voiceId}`);
          toast.error('Cached audio failed, regenerating...');
          handleVoicePreview(voiceId, sampleText);
        };
        await audio.play();
        return;
      }
      
      // Not in cache, generate fresh
      const voice = VOICE_OPTIONS.find(v => v.id === voiceId);
      const previewText = sampleText || voice?.sample || 'Hello, this is a voice preview for your training video.';
      
      const { data, error } = await supabase.functions.invoke('generate-voice', {
        body: {
          text: previewText,
          voiceId: voiceId,
        },
      });

      if (error) throw error;
      
      // Handle both audioUrl (from storage) and audioBase64 (fallback) responses
      let audioUrl: string;
      if (data.audioUrl) {
        audioUrl = data.audioUrl;
      } else if (data.audioBase64) {
        audioUrl = `data:audio/mpeg;base64,${data.audioBase64}`;
      } else {
        throw new Error('No audio data received');
      }
      
      // Cache for future use
      cacheVoicePreview(voiceId, audioUrl);
      
      const audio = new Audio(audioUrl);
      setCurrentAudio(audio);
      
      audio.onended = () => {
        setPreviewingVoiceId(null);
        setCurrentAudio(null);
      };
      audio.onerror = () => {
        toast.error('Failed to play audio');
        setPreviewingVoiceId(null);
        setCurrentAudio(null);
      };
      await audio.play();
    } catch (err) {
      console.error('Voice preview error:', err);
      toast.error('Failed to preview voice');
      setPreviewingVoiceId(null);
      setCurrentAudio(null);
    }
  };

  // Stop voice preview
  const stopVoicePreview = useCallback(() => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    setPreviewingVoiceId(null);
    setCurrentAudio(null);
  }, [currentAudio]);

  // Check which voices are already cached on mount
  const checkCachedVoices = useCallback(() => {
    const cached = new Set<string>();
    VOICE_OPTIONS.forEach(voice => {
      if (getCachedVoicePreview(voice.id)) {
        cached.add(voice.id);
      }
    });
    setPreloadedVoices(cached);
  }, []);

  // Preload all voices in the background
  const handlePreloadAllVoices = async () => {
    if (isPreloadingVoices) return;
    
    setIsPreloadingVoices(true);
    setPreloadProgress(0);
    
    const voicesToPreload = VOICE_OPTIONS.filter(v => !getCachedVoicePreview(v.id));
    
    if (voicesToPreload.length === 0) {
      toast.success('All voices already cached!');
      setIsPreloadingVoices(false);
      setPreloadProgress(100);
      return;
    }
    
    toast.info(`Preloading ${voicesToPreload.length} voice samples...`);
    
    let completed = 0;
    const alreadyCached = VOICE_OPTIONS.length - voicesToPreload.length;
    
    for (const voice of voicesToPreload) {
      try {
        const { data, error } = await supabase.functions.invoke('generate-voice', {
          body: {
            text: voice.sample,
            voiceId: voice.id,
          },
        });

        if (!error && data) {
          let audioUrl: string;
          if (data.audioUrl) {
            audioUrl = data.audioUrl;
          } else if (data.audioBase64) {
            audioUrl = `data:audio/mpeg;base64,${data.audioBase64}`;
          } else {
            throw new Error('No audio data');
          }
          
          cacheVoicePreview(voice.id, audioUrl);
          setPreloadedVoices(prev => new Set([...prev, voice.id]));
        }
      } catch (err) {
        console.warn(`Failed to preload voice ${voice.id}:`, err);
      }
      
      completed++;
      setPreloadProgress(Math.round(((alreadyCached + completed) / VOICE_OPTIONS.length) * 100));
    }
    
    setIsPreloadingVoices(false);
    toast.success('All voice samples preloaded!');
  };

  // Check cached voices and auto-preload on mount
  useEffect(() => {
    checkCachedVoices();
    
    // Auto-preload all voices in the background after a short delay
    const autoPreloadTimeout = setTimeout(() => {
      const voicesToPreload = VOICE_OPTIONS.filter(v => !getCachedVoicePreview(v.id));
      if (voicesToPreload.length > 0) {
        handlePreloadAllVoices();
      }
    }, 1000); // Small delay to let the page render first
    
    return () => clearTimeout(autoPreloadTimeout);
  }, []); // Run only once on mount

  // Generate training video
  const handleGenerate = async () => {
    if (!characterImage || !scriptText.trim()) {
      toast.error('Please upload a character image and enter script text');
      return;
    }

    if (!user) {
      toast.error('Please sign in to generate videos');
      return;
    }

    setGenerationStep('generating_audio');
    setProgress(0);
    setError(null);
    setGeneratedVideoUrl(null);

    try {
      // Step 1: Generate audio from text (30%)
      toast.info('Generating voice audio...');
      setProgress(10);
      
      const { data: audioData, error: audioError } = await supabase.functions.invoke('generate-voice', {
        body: {
          text: scriptText,
          voiceId: selectedVoice,
        },
      });

      if (audioError) throw audioError;
      if (!audioData.success) throw new Error(audioData.error || 'Failed to generate audio');
      
      // Get audio URL - prefer storage URL, fallback to base64
      let audioUrl: string;
      let audioStorageUrl: string | undefined;
      
      if (audioData.audioUrl) {
        audioUrl = audioData.audioUrl;
        audioStorageUrl = audioData.audioUrl;
      } else if (audioData.audioBase64) {
        audioUrl = `data:audio/mpeg;base64,${audioData.audioBase64}`;
      } else {
        throw new Error('No audio content received');
      }
      
      setGeneratedAudioUrl(audioUrl);
      setProgress(30);

      // Step 2: Generate video with character image (60%)
      setGenerationStep('generating_video');
      toast.info('Generating character video...');
      
      // Get background image URL
      const backgroundUrl = customBackground || 
        BACKGROUND_PRESETS.find(b => b.id === selectedBackground)?.image || 
        modernMinimalistImg;

      // Upload character image to get a URL for video generation
      const imageBase64 = characterImage.split(',')[1];
      
      const { data: videoData, error: videoError } = await supabase.functions.invoke('generate-video', {
        body: {
          prompt: `Professional talking head video. A person speaking directly to camera in a ${selectedBackground || 'professional studio'} setting. Natural head movements, professional presentation style, corporate training video aesthetic. The person is delivering an educational presentation with confident body language.`,
          imageUrl: characterImage,
          imageBase64,
          aspectRatio: '16:9',
          duration: Math.min(Math.ceil(scriptText.length / 15), 10), // Estimate duration based on text length
          userId: user.id,
        },
      });

      if (videoError) throw videoError;
      if (!videoData?.videoUrl) throw new Error('No video URL received');
      
      setProgress(60);

      // Step 3: Apply lip sync (90%)
      setGenerationStep('applying_lipsync');
      toast.info('Applying lip synchronization...');

      // Note: Lip sync requires the self-hosted service to be configured
      // For now, we'll use the video without lip sync if the service isn't available
      try {
        const { data: lipSyncData, error: lipSyncError } = await supabase.functions.invoke('lip-sync-service', {
          body: {
            projectId: `training_${user.id}_${Date.now()}`,
            videoUrl: videoData.videoUrl,
            audioUrl: audioStorageUrl || audioUrl,
            userId: user.id,
            quality: 'balanced',
            faceEnhance: true,
          },
        });

        if (!lipSyncError && lipSyncData?.success && lipSyncData?.outputVideoUrl) {
          setGeneratedVideoUrl(lipSyncData.outputVideoUrl);
          toast.success('Lip sync applied successfully!');
        } else {
          // Fallback: use video without lip sync
          console.warn('Lip sync not available:', lipSyncData?.error || 'Service unavailable');
          setGeneratedVideoUrl(videoData.videoUrl);
          if (lipSyncData?.error?.includes('not configured')) {
            toast.info('Video generated without lip sync (service not configured)');
          }
        }
      } catch (lipSyncErr) {
        console.warn('Lip sync service not available:', lipSyncErr);
        setGeneratedVideoUrl(videoData.videoUrl);
        toast.info('Video generated without lip sync');
      }

      setProgress(100);
      setGenerationStep('complete');
      toast.success('Training video generated successfully!');

    } catch (err) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate video');
      setGenerationStep('error');
      toast.error('Failed to generate training video');
    }
  };

  // Reset form
  const handleReset = () => {
    setCharacterImage(null);
    setCharacterImageFile(null);
    setCustomBackground(null);
    setSelectedBackground('modern_minimalist');
    setSelectedVoice('nova');
    setScriptText('');
    setGenerationStep('idle');
    setProgress(0);
    setGeneratedVideoUrl(null);
    setGeneratedAudioUrl(null);
    setError(null);
  };

  const isGenerating = ['generating_audio', 'generating_video', 'applying_lipsync'].includes(generationStep);
  const canGenerate = characterImage && scriptText.trim() && !isGenerating;

  // Estimated cost: ~12 credits (2 voice + 10 video)
  const ESTIMATED_CREDITS = 12;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader showCreate={false} />
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with Credits */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Video className="w-5 h-5 text-primary" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Training Video Studio
              </h1>
            </div>
            <p className="text-muted-foreground text-sm max-w-lg">
              Create professional training videos with AI-powered talking heads. Upload your character, choose a voice, and generate engaging presentations.
            </p>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <CreditsDisplay credits={credits} />
          </motion.div>
        </div>

        {/* Cost estimate banner */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-6"
        >
          <Card className="p-3 bg-primary/5 border-primary/20">
            <div className="flex items-center gap-2 text-sm">
              <Coins className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">Estimated cost:</span>
              <span className="font-semibold text-foreground">{ESTIMATED_CREDITS} credits</span>
              <span className="text-muted-foreground">per training video</span>
            </div>
          </Card>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column: Inputs */}
          <div className="space-y-6">
            {/* Character Image Upload */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Label className="text-sm font-medium mb-3 flex items-center gap-2">
                <User className="w-4 h-4" />
                Character Image
              </Label>
              <Card 
                className={cn(
                  "p-6 border-2 border-dashed cursor-pointer transition-all hover:border-primary/50",
                  characterImage ? "border-primary/30 bg-primary/5" : "border-muted-foreground/30"
                )}
                onClick={() => characterInputRef.current?.click()}
              >
                {characterImage ? (
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-24 rounded-xl overflow-hidden bg-muted">
                      <img src={characterImage} alt="Character" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Check className="w-4 h-4 text-primary" />
                        <span className="font-medium text-sm">Character Uploaded</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Click to replace</p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); setCharacterImage(null); }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="font-medium text-sm mb-1">Upload Character Image</p>
                    <p className="text-xs text-muted-foreground">PNG, JPG up to 10MB</p>
                  </div>
                )}
              </Card>
              <input
                ref={characterInputRef}
                type="file"
                accept="image/*"
                onChange={handleCharacterUpload}
                className="hidden"
              />
            </motion.div>

            {/* Voice Selection */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Mic className="w-4 h-4" />
                  Voice Selection
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreloadAllVoices}
                  disabled={isPreloadingVoices || preloadedVoices.size === VOICE_OPTIONS.length}
                  className="h-7 text-xs gap-1.5"
                >
                  {isPreloadingVoices ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {preloadProgress}%
                    </>
                  ) : preloadedVoices.size === VOICE_OPTIONS.length ? (
                    <>
                      <Check className="w-3 h-3" />
                      All Cached
                    </>
                  ) : (
                    <>
                      <Download className="w-3 h-3" />
                      Preload All ({preloadedVoices.size}/{VOICE_OPTIONS.length})
                    </>
                  )}
                </Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {VOICE_OPTIONS.map((voice) => {
                  const isPlaying = previewingVoiceId === voice.id;
                  const isSelected = selectedVoice === voice.id;
                  const isCached = preloadedVoices.has(voice.id);
                  
                  return (
                    <div
                      key={voice.id}
                      className={cn(
                        "relative p-3 rounded-xl border transition-all",
                        isSelected
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      {/* Selection overlay - click to select */}
                      <button
                        onClick={() => setSelectedVoice(voice.id)}
                        className="absolute inset-0 w-full h-full z-0"
                        aria-label={`Select ${voice.name} voice`}
                      />
                      
                      <div className="relative z-10 pointer-events-none">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-sm">{voice.name}</span>
                            {isCached && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Zap className="w-3 h-3 text-emerald-500 fill-emerald-500 pointer-events-auto cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Cached - Instant playback</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                          {isSelected && (
                            <Check className="w-4 h-4 text-primary" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1">{voice.description}</p>
                        <div className="flex items-center justify-between mt-2">
                          <Badge variant="outline" className="text-xs">
                            {voice.gender}
                          </Badge>
                          
                          {/* Preview button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                              "h-7 w-7 p-0 pointer-events-auto",
                              isPlaying && "text-primary"
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleVoicePreview(voice.id);
                            }}
                          >
                            {isPlaying ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Volume2 className="w-3.5 h-3.5" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Playing indicator */}
              <AnimatePresence>
                {previewingVoiceId && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3"
                  >
                    <Card className="p-3 bg-primary/5 border-primary/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-0.5">
                            {[0, 1, 2, 3].map((i) => (
                              <motion.div
                                key={i}
                                className="w-1 bg-primary rounded-full"
                                animate={{
                                  height: [8, 16, 8],
                                }}
                                transition={{
                                  duration: 0.5,
                                  repeat: Infinity,
                                  delay: i * 0.1,
                                }}
                              />
                            ))}
                          </div>
                          <span className="text-sm text-muted-foreground">
                            Playing <span className="font-medium text-foreground">{VOICE_OPTIONS.find(v => v.id === previewingVoiceId)?.name}</span>
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={stopVoicePreview}
                          className="h-7 px-2"
                        >
                          Stop
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Background Selection */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Label className="text-sm font-medium mb-3 flex items-center gap-2">
                <Image className="w-4 h-4" />
                Background
              </Label>
              <ScrollArea className="w-full">
                <div className="flex gap-2 pb-2">
                  {/* Custom upload option */}
                  <button
                    onClick={() => backgroundInputRef.current?.click()}
                    className={cn(
                      "w-20 h-20 rounded-xl border-2 border-dashed flex-shrink-0 flex items-center justify-center transition-all",
                      customBackground ? "border-primary" : "border-muted-foreground/30 hover:border-primary/50"
                    )}
                  >
                    {customBackground ? (
                      <img src={customBackground} alt="Custom" className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <Upload className="w-5 h-5 text-muted-foreground" />
                    )}
                  </button>
                  
                  {BACKGROUND_PRESETS.map((bg) => (
                    <button
                      key={bg.id}
                      onClick={() => { setSelectedBackground(bg.id); setCustomBackground(null); }}
                      className={cn(
                        "w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all",
                        selectedBackground === bg.id && !customBackground
                          ? "border-primary ring-2 ring-primary/20"
                          : "border-transparent hover:border-primary/50"
                      )}
                    >
                      <img src={bg.image} alt={bg.name} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </ScrollArea>
              <input
                ref={backgroundInputRef}
                type="file"
                accept="image/*"
                onChange={handleBackgroundUpload}
                className="hidden"
              />
            </motion.div>

            {/* Script Text */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Label className="text-sm font-medium mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Script Text
                </span>
                <span className="text-xs text-muted-foreground">{scriptText.length} characters</span>
              </Label>
              <Textarea
                placeholder="Enter the text your character will speak..."
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                className="min-h-[150px] resize-none"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Recommended: 50-500 characters for best results
              </p>
            </motion.div>
          </div>

          {/* Right Column: Preview & Generation */}
          <div className="space-y-6">
            {/* Preview Area */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Label className="text-sm font-medium mb-3">Preview</Label>
              <Card className="aspect-video bg-muted/50 overflow-hidden relative">
                <AnimatePresence mode="wait">
                  {generatedVideoUrl ? (
                    <motion.video
                      key="video"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      src={generatedVideoUrl}
                      controls
                      className="w-full h-full object-cover"
                    />
                  ) : characterImage ? (
                    <motion.div
                      key="preview"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="relative w-full h-full"
                    >
                      {/* Background */}
                      <img 
                        src={customBackground || BACKGROUND_PRESETS.find(b => b.id === selectedBackground)?.image || modernMinimalistImg}
                        alt="Background"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/20" />
                      
                      {/* Character overlay (centered) */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-48 h-48 rounded-full overflow-hidden border-4 border-white/20 shadow-2xl">
                          <img src={characterImage} alt="Character" className="w-full h-full object-cover" />
                        </div>
                      </div>
                      
                      {/* Generation overlay */}
                      {isGenerating && (
                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                          <Loader2 className="w-12 h-12 text-white animate-spin mb-4" />
                          <p className="text-white font-medium mb-2">
                            {generationStep === 'generating_audio' && 'Generating voice audio...'}
                            {generationStep === 'generating_video' && 'Creating character video...'}
                            {generationStep === 'applying_lipsync' && 'Applying lip sync...'}
                          </p>
                          <Progress value={progress} className="w-48 h-2" />
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center justify-center h-full text-muted-foreground"
                    >
                      <Video className="w-16 h-16 mb-3 opacity-30" />
                      <p className="text-sm">Upload a character to preview</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Error state */}
                {generationStep === 'error' && (
                  <div className="absolute inset-0 bg-destructive/10 flex flex-col items-center justify-center">
                    <AlertCircle className="w-12 h-12 text-destructive mb-3" />
                    <p className="text-destructive font-medium mb-2">Generation Failed</p>
                    <p className="text-sm text-muted-foreground mb-4">{error}</p>
                    <Button variant="outline" size="sm" onClick={() => setGenerationStep('idle')}>
                      Try Again
                    </Button>
                  </div>
                )}
              </Card>
            </motion.div>

            {/* Action Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-3"
            >
              {generationStep === 'complete' ? (
                <>
                  <Button className="w-full h-12" asChild>
                    <a href={generatedVideoUrl || '#'} download="training-video.mp4">
                      <Download className="w-5 h-5 mr-2" />
                      Download Video
                    </a>
                  </Button>
                  <Button variant="outline" className="w-full" onClick={handleReset}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Create Another Video
                  </Button>
                </>
              ) : (
                <Button 
                  className="w-full h-12"
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5 mr-2" />
                      Generate Training Video
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              )}
            </motion.div>

            {/* Tips */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <Card className="p-4 bg-muted/30">
                <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Tips for Best Results
                </h4>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Use a front-facing character image with visible face</li>
                  <li>• Keep script between 50-500 characters for optimal quality</li>
                  <li>• Choose a voice that matches your character's appearance</li>
                  <li>• High-resolution character images produce better results</li>
                </ul>
              </Card>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}
