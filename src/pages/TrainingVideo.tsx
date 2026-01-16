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
  Video, AlertCircle, Trash2, Coins, Zap, Wand2,
  ChevronRight, CircleDot, Square, Pause, Settings2
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

// Wizard steps
const WIZARD_STEPS = [
  { id: 'character', label: 'Character', icon: User },
  { id: 'voice', label: 'Voice', icon: Mic },
  { id: 'scene', label: 'Scene', icon: Image },
  { id: 'script', label: 'Script', icon: Sparkles },
];

export default function TrainingVideo() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { credits } = useStudio();
  
  // Wizard state
  const [activeStep, setActiveStep] = useState(0);
  
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
        const weekInMs = 7 * 24 * 60 * 60 * 1000;
        if (Date.now() - timestamp < weekInMs) {
          return audioUrl;
        }
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

  // Preview a specific voice
  const handleVoicePreview = async (voiceId: string, sampleText?: string) => {
    if (previewingVoiceId === voiceId && currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setPreviewingVoiceId(null);
      setCurrentAudio(null);
      return;
    }
    
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    
    setPreviewingVoiceId(voiceId);
    
    try {
      const cachedAudioUrl = getCachedVoicePreview(voiceId);
      
      if (cachedAudioUrl) {
        const audio = new Audio(cachedAudioUrl);
        setCurrentAudio(audio);
        
        audio.onended = () => {
          setPreviewingVoiceId(null);
          setCurrentAudio(null);
        };
        audio.onerror = () => {
          localStorage.removeItem(`${VOICE_CACHE_KEY}${VOICE_CACHE_VERSION}_${voiceId}`);
          toast.error('Cached audio failed, regenerating...');
          handleVoicePreview(voiceId, sampleText);
        };
        await audio.play();
        return;
      }
      
      const voice = VOICE_OPTIONS.find(v => v.id === voiceId);
      const previewText = sampleText || voice?.sample || 'Hello, this is a voice preview for your training video.';
      
      const { data, error } = await supabase.functions.invoke('generate-voice', {
        body: {
          text: previewText,
          voiceId: voiceId,
        },
      });

      if (error) throw error;
      
      let audioUrl: string;
      if (data.audioUrl) {
        audioUrl = data.audioUrl;
      } else if (data.audioBase64) {
        audioUrl = `data:audio/mpeg;base64,${data.audioBase64}`;
      } else {
        throw new Error('No audio data received');
      }
      
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

  useEffect(() => {
    checkCachedVoices();
    
    const autoPreloadTimeout = setTimeout(() => {
      const voicesToPreload = VOICE_OPTIONS.filter(v => !getCachedVoicePreview(v.id));
      if (voicesToPreload.length > 0) {
        handlePreloadAllVoices();
      }
    }, 1000);
    
    return () => clearTimeout(autoPreloadTimeout);
  }, []);

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
      
      const backgroundUrl = customBackground || 
        BACKGROUND_PRESETS.find(b => b.id === selectedBackground)?.image || 
        modernMinimalistImg;

      const imageBase64 = characterImage.split(',')[1];
      
      const { data: videoData, error: videoError } = await supabase.functions.invoke('generate-video', {
        body: {
          prompt: `Professional talking head video. A person speaking directly to camera in a ${selectedBackground || 'professional studio'} setting. Natural head movements, professional presentation style, corporate training video aesthetic. The person is delivering an educational presentation with confident body language.`,
          imageUrl: characterImage,
          imageBase64,
          aspectRatio: '16:9',
          duration: Math.min(Math.ceil(scriptText.length / 15), 10),
          userId: user.id,
        },
      });

      if (videoError) throw videoError;
      if (!videoData?.videoUrl) throw new Error('No video URL received');
      
      setProgress(60);

      // Step 3: Apply lip sync (90%)
      setGenerationStep('applying_lipsync');
      toast.info('Applying lip synchronization...');

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
    setActiveStep(0);
  };

  const isGenerating = ['generating_audio', 'generating_video', 'applying_lipsync'].includes(generationStep);
  const canGenerate = characterImage && scriptText.trim() && !isGenerating;
  const ESTIMATED_CREDITS = 12;

  // Check step completion
  const isStepComplete = (stepIndex: number) => {
    switch (stepIndex) {
      case 0: return !!characterImage;
      case 1: return !!selectedVoice;
      case 2: return !!(selectedBackground || customBackground);
      case 3: return scriptText.trim().length > 0;
      default: return false;
    }
  };

  const getBackgroundImage = () => {
    return customBackground || BACKGROUND_PRESETS.find(b => b.id === selectedBackground)?.image || modernMinimalistImg;
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader showCreate={false} />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border/50">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
            {/* Left: Title & Description */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex-1"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center shadow-lg shadow-primary/20">
                  <Wand2 className="w-7 h-7 text-primary-foreground" />
                </div>
                <div>
                  <Badge variant="outline" className="mb-1 text-xs">AI-Powered</Badge>
                  <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
                    Training Video Studio
                  </h1>
                </div>
              </div>
              <p className="text-muted-foreground max-w-xl text-lg">
                Create professional AI-powered training videos with realistic talking heads. 
                Upload your avatar, choose a voice, and let AI do the magic.
              </p>
              
              {/* Quick stats */}
              <div className="flex items-center gap-6 mt-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Coins className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Est. Cost</p>
                    <p className="font-semibold">{ESTIMATED_CREDITS} credits</p>
                  </div>
                </div>
                <div className="w-px h-8 bg-border" />
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Generation Time</p>
                    <p className="font-semibold">~2 min</p>
                  </div>
                </div>
              </div>
            </motion.div>
            
            {/* Right: Credits Display */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <CreditsDisplay credits={credits} />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-5 gap-8">
          {/* Left: Configuration Panel */}
          <div className="lg:col-span-3 space-y-6">
            {/* Wizard Steps Indicator */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  {WIZARD_STEPS.map((step, index) => {
                    const isActive = activeStep === index;
                    const isComplete = isStepComplete(index);
                    const StepIcon = step.icon;
                    
                    return (
                      <div key={step.id} className="flex items-center">
                        <button
                          onClick={() => setActiveStep(index)}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-lg transition-all",
                            isActive ? "bg-primary text-primary-foreground" : 
                            isComplete ? "bg-primary/10 text-primary hover:bg-primary/20" :
                            "text-muted-foreground hover:bg-muted"
                          )}
                        >
                          <div className={cn(
                            "w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium",
                            isActive ? "bg-primary-foreground/20" :
                            isComplete ? "bg-primary/20" : "bg-muted"
                          )}>
                            {isComplete && !isActive ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <StepIcon className="w-4 h-4" />
                            )}
                          </div>
                          <span className="text-sm font-medium hidden sm:inline">{step.label}</span>
                        </button>
                        {index < WIZARD_STEPS.length - 1 && (
                          <ChevronRight className="w-5 h-5 text-muted-foreground/30 mx-1" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            </motion.div>

            {/* Step Content */}
            <AnimatePresence mode="wait">
              {/* Step 0: Character */}
              {activeStep === 0 && (
                <motion.div
                  key="character"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  <Card className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold">Upload Your Character</h3>
                        <p className="text-sm text-muted-foreground">Choose a front-facing image for best results</p>
                      </div>
                      <Badge variant="outline">Step 1 of 4</Badge>
                    </div>
                    
                    <div 
                      className={cn(
                        "border-2 border-dashed rounded-2xl p-8 cursor-pointer transition-all text-center",
                        characterImage ? "border-primary/30 bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50"
                      )}
                      onClick={() => characterInputRef.current?.click()}
                    >
                      {characterImage ? (
                        <div className="flex flex-col items-center">
                          <div className="w-40 h-40 rounded-2xl overflow-hidden bg-muted mb-4 ring-4 ring-primary/20">
                            <img src={characterImage} alt="Character" className="w-full h-full object-cover" />
                          </div>
                          <div className="flex items-center gap-2 text-primary mb-2">
                            <Check className="w-5 h-5" />
                            <span className="font-medium">Character Uploaded</span>
                          </div>
                          <p className="text-sm text-muted-foreground">Click to replace</p>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="mt-3"
                            onClick={(e) => { e.stopPropagation(); setCharacterImage(null); setCharacterImageFile(null); }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <div className="py-8">
                          <div className="w-20 h-20 rounded-2xl bg-muted mx-auto mb-4 flex items-center justify-center">
                            <Upload className="w-10 h-10 text-muted-foreground" />
                          </div>
                          <p className="font-medium text-lg mb-1">Drop your character image here</p>
                          <p className="text-sm text-muted-foreground mb-4">or click to browse</p>
                          <Badge variant="secondary">PNG, JPG up to 10MB</Badge>
                        </div>
                      )}
                    </div>
                    <input
                      ref={characterInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleCharacterUpload}
                      className="hidden"
                    />
                    
                    <div className="flex justify-end mt-6">
                      <Button onClick={() => setActiveStep(1)} disabled={!characterImage}>
                        Continue
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              )}

              {/* Step 1: Voice */}
              {activeStep === 1 && (
                <motion.div
                  key="voice"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  <Card className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold">Select a Voice</h3>
                        <p className="text-sm text-muted-foreground">Choose the perfect voice for your character</p>
                      </div>
                      <Badge variant="outline">Step 2 of 4</Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {VOICE_OPTIONS.map((voice) => {
                        const isPlaying = previewingVoiceId === voice.id;
                        const isSelected = selectedVoice === voice.id;
                        const isCached = preloadedVoices.has(voice.id);
                        
                        return (
                          <div
                            key={voice.id}
                            onClick={() => setSelectedVoice(voice.id)}
                            className={cn(
                              "relative p-4 rounded-xl border-2 cursor-pointer transition-all group",
                              isSelected
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/50 hover:bg-muted/50"
                            )}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-semibold text-base">{voice.name}</span>
                                  {isCached && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger>
                                          <Zap className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500" />
                                        </TooltipTrigger>
                                        <TooltipContent>Instant playback</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                  {isSelected && (
                                    <Badge variant="default" className="text-xs">Selected</Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground mb-2">{voice.description}</p>
                                <Badge variant="outline" className="text-xs capitalize">{voice.gender}</Badge>
                              </div>
                              
                              <Button
                                variant={isPlaying ? "default" : "outline"}
                                size="icon"
                                className="h-10 w-10 rounded-full shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleVoicePreview(voice.id);
                                }}
                              >
                                {isPlaying ? (
                                  <Pause className="w-4 h-4" />
                                ) : (
                                  <Play className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                            
                            {/* Waveform visualization when playing */}
                            {isPlaying && (
                              <div className="flex items-center gap-1 mt-3">
                                {[...Array(20)].map((_, i) => (
                                  <motion.div
                                    key={i}
                                    className="w-1 bg-primary rounded-full"
                                    animate={{
                                      height: [4, Math.random() * 20 + 4, 4],
                                    }}
                                    transition={{
                                      duration: 0.4,
                                      repeat: Infinity,
                                      delay: i * 0.05,
                                    }}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    
                    <div className="flex justify-between mt-6">
                      <Button variant="outline" onClick={() => setActiveStep(0)}>
                        Back
                      </Button>
                      <Button onClick={() => setActiveStep(2)}>
                        Continue
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              )}

              {/* Step 2: Scene/Background */}
              {activeStep === 2 && (
                <motion.div
                  key="scene"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  <Card className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold">Choose Your Scene</h3>
                        <p className="text-sm text-muted-foreground">Select a background environment</p>
                      </div>
                      <Badge variant="outline">Step 3 of 4</Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {/* Custom upload */}
                      <button
                        onClick={() => backgroundInputRef.current?.click()}
                        className={cn(
                          "aspect-video rounded-xl border-2 border-dashed flex items-center justify-center transition-all",
                          customBackground ? "border-primary" : "border-muted-foreground/30 hover:border-primary/50"
                        )}
                      >
                        {customBackground ? (
                          <img src={customBackground} alt="Custom" className="w-full h-full object-cover rounded-lg" />
                        ) : (
                          <div className="text-center p-2">
                            <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                            <span className="text-xs text-muted-foreground">Custom</span>
                          </div>
                        )}
                      </button>
                      
                      {BACKGROUND_PRESETS.map((bg) => (
                        <button
                          key={bg.id}
                          onClick={() => { setSelectedBackground(bg.id); setCustomBackground(null); }}
                          className={cn(
                            "aspect-video rounded-xl overflow-hidden border-2 transition-all relative group",
                            selectedBackground === bg.id && !customBackground
                              ? "border-primary ring-2 ring-primary/20"
                              : "border-transparent hover:border-primary/50"
                          )}
                        >
                          <img src={bg.image} alt={bg.name} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-2">
                            <span className="text-white text-xs font-medium">{bg.name}</span>
                          </div>
                          {selectedBackground === bg.id && !customBackground && (
                            <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                              <Check className="w-4 h-4 text-primary-foreground" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                    <input
                      ref={backgroundInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleBackgroundUpload}
                      className="hidden"
                    />
                    
                    <div className="flex justify-between mt-6">
                      <Button variant="outline" onClick={() => setActiveStep(1)}>
                        Back
                      </Button>
                      <Button onClick={() => setActiveStep(3)}>
                        Continue
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              )}

              {/* Step 3: Script */}
              {activeStep === 3 && (
                <motion.div
                  key="script"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  <Card className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold">Write Your Script</h3>
                        <p className="text-sm text-muted-foreground">What should your character say?</p>
                      </div>
                      <Badge variant="outline">Step 4 of 4</Badge>
                    </div>
                    
                    <div className="relative">
                      <Textarea
                        placeholder="Enter the text your character will speak...

Example: 'Welcome to today's training session! In this video, we'll cover the essential skills you need to succeed. Let's get started!'"
                        value={scriptText}
                        onChange={(e) => setScriptText(e.target.value)}
                        className="min-h-[200px] resize-none text-base"
                      />
                      <div className="absolute bottom-3 right-3">
                        <Badge 
                          variant={scriptText.length > 500 ? "destructive" : scriptText.length > 0 ? "secondary" : "outline"}
                        >
                          {scriptText.length} / 500
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-3 p-3 rounded-lg bg-muted/50">
                      <Sparkles className="w-4 h-4 text-primary shrink-0" />
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Pro tip:</span> Keep your script between 50-500 characters for optimal quality and natural pacing.
                      </p>
                    </div>
                    
                    <div className="flex justify-between mt-6">
                      <Button variant="outline" onClick={() => setActiveStep(2)}>
                        Back
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right: Live Preview */}
          <div className="lg:col-span-2 space-y-4">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="overflow-hidden">
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Video className="w-4 h-4 text-primary" />
                    <span className="font-medium">Live Preview</span>
                  </div>
                  <Badge variant="outline" className="text-xs">16:9</Badge>
                </div>
                
                <div className="aspect-video bg-muted/50 relative">
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
                    ) : (
                      <motion.div
                        key="preview"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="relative w-full h-full"
                      >
                        {/* Background */}
                        <img 
                          src={getBackgroundImage()}
                          alt="Background"
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/30" />
                        
                        {/* Character overlay */}
                        {characterImage ? (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <motion.div 
                              className="w-32 h-32 sm:w-40 sm:h-40 rounded-full overflow-hidden border-4 border-white/30 shadow-2xl"
                              animate={{ scale: [1, 1.02, 1] }}
                              transition={{ duration: 3, repeat: Infinity }}
                            >
                              <img src={characterImage} alt="Character" className="w-full h-full object-cover" />
                            </motion.div>
                          </div>
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70">
                            <User className="w-16 h-16 mb-2" />
                            <p className="text-sm">Upload a character</p>
                          </div>
                        )}
                        
                        {/* Generation overlay */}
                        {isGenerating && (
                          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center backdrop-blur-sm">
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                              className="w-16 h-16 rounded-full border-4 border-primary border-t-transparent mb-4"
                            />
                            <p className="text-white font-medium mb-1">
                              {generationStep === 'generating_audio' && 'Generating voice...'}
                              {generationStep === 'generating_video' && 'Creating video...'}
                              {generationStep === 'applying_lipsync' && 'Syncing lips...'}
                            </p>
                            <Progress value={progress} className="w-48 h-2" />
                            <p className="text-white/60 text-sm mt-2">{progress}%</p>
                          </div>
                        )}
                        
                        {/* Error state */}
                        {generationStep === 'error' && (
                          <div className="absolute inset-0 bg-destructive/20 flex flex-col items-center justify-center backdrop-blur-sm">
                            <AlertCircle className="w-12 h-12 text-destructive mb-3" />
                            <p className="text-destructive font-medium mb-2">Generation Failed</p>
                            <p className="text-sm text-muted-foreground mb-4 text-center px-4">{error}</p>
                            <Button variant="outline" size="sm" onClick={() => setGenerationStep('idle')}>
                              Try Again
                            </Button>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                
                {/* Voice indicator */}
                <div className="p-4 border-t border-border bg-muted/30">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Mic className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Voice:</span>
                      <span className="font-medium">{VOICE_OPTIONS.find(v => v.id === selectedVoice)?.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Settings2 className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Scene:</span>
                      <span className="font-medium">
                        {customBackground ? 'Custom' : BACKGROUND_PRESETS.find(b => b.id === selectedBackground)?.name}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Generate Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              {generationStep === 'complete' ? (
                <div className="space-y-3">
                  <Button className="w-full h-14 text-lg" asChild>
                    <a href={generatedVideoUrl || '#'} download="training-video.mp4">
                      <Download className="w-5 h-5 mr-2" />
                      Download Video
                    </a>
                  </Button>
                  <Button variant="outline" className="w-full" onClick={handleReset}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Create Another Video
                  </Button>
                </div>
              ) : (
                <Button 
                  className="w-full h-14 text-lg"
                  variant={canGenerate ? "default" : "secondary"}
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
                      <Wand2 className="w-5 h-5 mr-2" />
                      Generate Video
                      <Badge variant="secondary" className="ml-3">
                        {ESTIMATED_CREDITS} credits
                      </Badge>
                    </>
                  )}
                </Button>
              )}
            </motion.div>

            {/* Checklist */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="p-4">
                <h4 className="font-medium text-sm mb-3">Ready to generate?</h4>
                <div className="space-y-2">
                  {[
                    { label: 'Character uploaded', complete: !!characterImage },
                    { label: 'Voice selected', complete: !!selectedVoice },
                    { label: 'Background chosen', complete: !!(selectedBackground || customBackground) },
                    { label: 'Script written', complete: scriptText.trim().length > 0 },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <div className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center",
                        item.complete ? "bg-primary text-primary-foreground" : "bg-muted"
                      )}>
                        {item.complete ? <Check className="w-3 h-3" /> : <CircleDot className="w-3 h-3 text-muted-foreground" />}
                      </div>
                      <span className={item.complete ? "text-foreground" : "text-muted-foreground"}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}
