import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStudio } from '@/contexts/StudioContext';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, User, Mic, Image, Play, Loader2, Check,
  Sparkles, ArrowRight, RefreshCw, Download,
  Video, AlertCircle, Trash2, Coins, Zap, Wand2,
  ChevronRight, CircleDot, Pause, Film
} from 'lucide-react';
import { CreditsDisplay } from '@/components/studio/CreditsDisplay';
import TrainingBackground from '@/components/training/TrainingBackground';

// Import learning-themed environment presets
import corporateBoardroomImg from '@/assets/environments/corporate-boardroom.jpg';
import lectureHallImg from '@/assets/environments/lecture-hall.jpg';
import startupOfficeImg from '@/assets/environments/startup-office.jpg';
import homeStudioImg from '@/assets/environments/home-studio.jpg';
import newsStudioImg from '@/assets/environments/news-studio.jpg';
import scienceLabImg from '@/assets/environments/science-lab.jpg';
import executiveLibraryImg from '@/assets/environments/executive-library.jpg';
import podcastStudioImg from '@/assets/environments/podcast-studio.jpg';
import medicalTrainingImg from '@/assets/environments/medical-training.jpg';
import greenScreenImg from '@/assets/environments/green-screen.jpg';
import workshopTrainingImg from '@/assets/environments/workshop-training.jpg';
import modernClassroomImg from '@/assets/environments/modern-classroom.jpg';
import webinarStageImg from '@/assets/environments/webinar-stage.jpg';
import coffeeShopImg from '@/assets/environments/coffee-shop.jpg';

// Voice options from OpenAI TTS with sample text for preview
const VOICE_OPTIONS = [
  { id: 'nova', name: 'Nova', gender: 'female', description: 'Warm, professional', sample: 'Welcome to our training program. Today we will explore best practices for success.' },
  { id: 'alloy', name: 'Alloy', gender: 'neutral', description: 'Versatile, clear', sample: 'This module covers the essential skills you need to excel in your role.' },
  { id: 'echo', name: 'Echo', gender: 'male', description: 'Friendly, warm', sample: 'Hey there! Ready to learn something new? Let me walk you through it step by step.' },
  { id: 'fable', name: 'Fable', gender: 'male', description: 'Expressive, storyteller', sample: 'Picture this: a world where every challenge becomes an opportunity for growth.' },
  { id: 'onyx', name: 'Onyx', gender: 'male', description: 'Deep, authoritative', sample: 'The following information is critical to your understanding of company protocols.' },
  { id: 'shimmer', name: 'Shimmer', gender: 'female', description: 'Soft, gentle', sample: 'Take a moment to reflect on what you have learned. Every step forward matters.' },
];

// Background presets - Learning/Training themed
const BACKGROUND_PRESETS = [
  { id: 'home_studio', name: 'Home Studio', image: homeStudioImg },
  { id: 'corporate_boardroom', name: 'Corporate Boardroom', image: corporateBoardroomImg },
  { id: 'lecture_hall', name: 'Lecture Hall', image: lectureHallImg },
  { id: 'modern_classroom', name: 'Modern Classroom', image: modernClassroomImg },
  { id: 'startup_office', name: 'Startup Office', image: startupOfficeImg },
  { id: 'news_studio', name: 'News Studio', image: newsStudioImg },
  { id: 'webinar_stage', name: 'Webinar Stage', image: webinarStageImg },
  { id: 'science_lab', name: 'Science Lab', image: scienceLabImg },
  { id: 'medical_training', name: 'Medical Training', image: medicalTrainingImg },
  { id: 'executive_library', name: 'Executive Library', image: executiveLibraryImg },
  { id: 'podcast_studio', name: 'Podcast Studio', image: podcastStudioImg },
  { id: 'workshop_training', name: 'Workshop Training', image: workshopTrainingImg },
  { id: 'coffee_shop', name: 'Coffee Shop', image: coffeeShopImg },
  { id: 'green_screen', name: 'Green Screen', image: greenScreenImg },
];

type GenerationStep = 'idle' | 'generating_audio' | 'generating_video' | 'applying_lipsync' | 'complete' | 'error';

// Wizard steps - logical order: Script first (content), Voice (how it sounds), Character (who speaks), Scene (backdrop)
const WIZARD_STEPS = [
  { id: 'script', label: 'Script', icon: Sparkles },
  { id: 'voice', label: 'Voice', icon: Mic },
  { id: 'character', label: 'Character', icon: User },
  { id: 'scene', label: 'Scene', icon: Image },
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
  const [selectedBackground, setSelectedBackground] = useState<string | null>('home_studio');
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
        homeStudioImg;

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
      
      // Handle async video generation (Kling returns taskId, need to poll)
      let finalVideoUrl: string;
      
      if (videoData?.videoUrl) {
        // Direct video URL returned
        finalVideoUrl = videoData.videoUrl;
      } else if (videoData?.taskId) {
        // Async generation - poll for completion
        toast.info('Video processing... This may take 1-3 minutes');
        const taskId = videoData.taskId;
        const provider = videoData.provider || 'kling';
        
        // Poll for video completion (max 5 minutes)
        const maxAttempts = 60;
        const pollInterval = 5000; // 5 seconds
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          setProgress(30 + Math.min(25, attempt)); // Progress from 30% to 55%
          
          const { data: statusData, error: statusError } = await supabase.functions.invoke('check-video-status', {
            body: { taskId, provider }
          });
          
          if (statusError) {
            console.warn('Status check error:', statusError);
            continue;
          }
          
          // Check for completion - Kling returns 'SUCCEEDED', normalize to handle both
          const isCompleted = statusData?.status === 'completed' || 
                              statusData?.status === 'SUCCEEDED' || 
                              statusData?.status === 'succeeded';
          
          if (isCompleted && statusData?.videoUrl) {
            finalVideoUrl = statusData.videoUrl;
            break;
          } else if (statusData?.status === 'failed' || statusData?.status === 'FAILED') {
            throw new Error(statusData?.error || 'Video generation failed');
          }
          
          // Update progress message
          if (attempt % 6 === 0 && attempt > 0) {
            toast.info(`Still processing... ${Math.ceil((maxAttempts - attempt) * pollInterval / 60000)} min remaining`);
          }
        }
        
        if (!finalVideoUrl!) {
          throw new Error('Video generation timed out after 5 minutes');
        }
      } else {
        throw new Error('No video URL or task ID received');
      }
      
      setProgress(60);

      // Step 3: Apply lip sync (90%)
      setGenerationStep('applying_lipsync');
      toast.info('Applying lip synchronization...');

      let videoToSave = finalVideoUrl;
      
      try {
        const { data: lipSyncData, error: lipSyncError } = await supabase.functions.invoke('lip-sync-service', {
          body: {
            projectId: `training_${user.id}_${Date.now()}`,
            videoUrl: finalVideoUrl,
            audioUrl: audioStorageUrl || audioUrl,
            userId: user.id,
            quality: 'balanced',
            faceEnhance: true,
          },
        });

        if (!lipSyncError && lipSyncData?.success && lipSyncData?.outputVideoUrl) {
          videoToSave = lipSyncData.outputVideoUrl;
          setGeneratedVideoUrl(lipSyncData.outputVideoUrl);
          toast.success('Lip sync applied successfully!');
        } else {
          console.warn('Lip sync not available:', lipSyncData?.error || 'Service unavailable');
          setGeneratedVideoUrl(finalVideoUrl);
          if (lipSyncData?.error?.includes('not configured')) {
            toast.info('Video generated without lip sync (service not configured)');
          }
        }
      } catch (lipSyncErr) {
        console.warn('Lip sync service not available:', lipSyncErr);
        setGeneratedVideoUrl(finalVideoUrl);
        toast.info('Video generated without lip sync');
      }

      setProgress(100);
      setGenerationStep('complete');
      
      // Save training video to database with the correct URL
      if (videoToSave && user) {
        try {
          const { error: saveError } = await supabase.from('training_videos').insert({
            user_id: user.id,
            title: `Training Video - ${new Date().toLocaleDateString()}`,
            description: scriptText.slice(0, 200),
            video_url: videoToSave,
            voice_id: selectedVoice,
            environment: selectedBackground,
          });
          
          if (saveError) {
            console.error('Failed to save training video:', saveError);
          } else {
            console.log('Training video saved successfully');
          }
        } catch (saveErr) {
          console.error('Error saving training video:', saveErr);
        }
      }
      
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
    setSelectedBackground('home_studio');
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

  // Check step completion - matches new order: Script, Voice, Character, Scene
  const isStepComplete = (stepIndex: number) => {
    switch (stepIndex) {
      case 0: return scriptText.trim().length > 0;
      case 1: return !!selectedVoice;
      case 2: return !!characterImage;
      case 3: return !!(selectedBackground || customBackground);
      default: return false;
    }
  };

  const getBackgroundImage = () => {
    return customBackground || BACKGROUND_PRESETS.find(b => b.id === selectedBackground)?.image || homeStudioImg;
  };

  return (
    <div className="min-h-screen bg-[#030303] text-white overflow-x-hidden">
      <TrainingBackground />
      <AppHeader showCreate={false} />
      
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Compact Header */}
        <motion.div 
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Film className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">Training Video Studio</h1>
              <p className="text-xs text-white/50">Create AI presenter videos with lip-sync</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs border-white/20 text-white/70">
              <Coins className="w-3 h-3 mr-1" />
              {ESTIMATED_CREDITS} credits
            </Badge>
            <Badge variant="outline" className="text-xs border-white/20 text-white/70">
              <Zap className="w-3 h-3 mr-1" />
              ~2 min
            </Badge>
          </div>
        </motion.div>

        {/* Main Grid - More condensed */}
        <div className="grid lg:grid-cols-5 gap-4">
          {/* Left: All Steps Stacked Compact */}
          <div className="lg:col-span-3 space-y-3">
            {/* Step 1: Script - Compact */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="p-4 rounded-xl border bg-card"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                    scriptText.trim() ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    {scriptText.trim() ? <Check className="w-3.5 h-3.5" /> : "1"}
                  </div>
                  <h3 className="font-semibold text-sm">Script</h3>
                </div>
                <Badge variant="outline" className="text-[10px]">{scriptText.length}/500</Badge>
              </div>
              <Textarea
                placeholder="Enter what your character will say..."
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value.slice(0, 500))}
                className="min-h-[80px] resize-none text-sm"
              />
            </motion.div>

            {/* Step 2: Voice - Compact Grid */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="p-4 rounded-xl border bg-card"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                  selectedVoice ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  {selectedVoice ? <Check className="w-3.5 h-3.5" /> : "2"}
                </div>
                <h3 className="font-semibold text-sm">Voice</h3>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {VOICE_OPTIONS.map((voice) => {
                  const isPlaying = previewingVoiceId === voice.id;
                  const isSelected = selectedVoice === voice.id;
                  
                  return (
                    <button
                      key={voice.id}
                      onClick={() => setSelectedVoice(voice.id)}
                      className={cn(
                        "relative p-2 rounded-lg border text-center transition-all group",
                        isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className="text-xs font-medium truncate">{voice.name}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{voice.gender}</div>
                      {isSelected && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-primary-foreground" />
                        </div>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleVoicePreview(voice.id); }}
                        className={cn(
                          "absolute bottom-1 right-1 w-5 h-5 rounded-full flex items-center justify-center transition-all",
                          isPlaying ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground opacity-0 group-hover:opacity-100"
                        )}
                      >
                        {isPlaying ? <Pause className="w-2.5 h-2.5" /> : <Play className="w-2.5 h-2.5" />}
                      </button>
                    </button>
                  );
                })}
              </div>
            </motion.div>

            {/* Step 3 & 4: Character + Scene - Side by Side */}
            <div className="grid sm:grid-cols-2 gap-3">
              {/* Character Upload */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="p-4 rounded-xl border bg-card"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                    characterImage ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    {characterImage ? <Check className="w-3.5 h-3.5" /> : "3"}
                  </div>
                  <h3 className="font-semibold text-sm">Character</h3>
                </div>
                <div 
                  className={cn(
                    "aspect-square rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer transition-all overflow-hidden",
                    characterImage ? "border-primary/50" : "border-muted-foreground/30 hover:border-primary/50"
                  )}
                  onClick={() => characterInputRef.current?.click()}
                >
                  {characterImage ? (
                    <div className="relative w-full h-full group">
                      <img src={characterImage} alt="Character" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Upload className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  ) : (
                    <div className="text-center p-4">
                      <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">Upload image</p>
                    </div>
                  )}
                </div>
                <input ref={characterInputRef} type="file" accept="image/*" onChange={handleCharacterUpload} className="hidden" />
              </motion.div>

              {/* Scene Selection */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="p-4 rounded-xl border bg-card"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                    (selectedBackground || customBackground) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    {(selectedBackground || customBackground) ? <Check className="w-3.5 h-3.5" /> : "4"}
                  </div>
                  <h3 className="font-semibold text-sm">Scene</h3>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {/* Custom upload */}
                  <button
                    onClick={() => backgroundInputRef.current?.click()}
                    className={cn(
                      "aspect-video rounded-md border-2 border-dashed flex items-center justify-center transition-all overflow-hidden",
                      customBackground ? "border-primary" : "border-muted-foreground/30 hover:border-primary/50"
                    )}
                  >
                    {customBackground ? (
                      <img src={customBackground} alt="Custom" className="w-full h-full object-cover" />
                    ) : (
                      <Upload className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </button>
                  {BACKGROUND_PRESETS.slice(0, 8).map((bg) => (
                    <button
                      key={bg.id}
                      onClick={() => { setSelectedBackground(bg.id); setCustomBackground(null); }}
                      className={cn(
                        "aspect-video rounded-md overflow-hidden border-2 transition-all relative",
                        selectedBackground === bg.id && !customBackground ? "border-primary" : "border-transparent hover:border-primary/50"
                      )}
                    >
                      <img src={bg.image} alt={bg.name} className="w-full h-full object-cover" />
                      {selectedBackground === bg.id && !customBackground && (
                        <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-2 h-2 text-primary-foreground" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                <input ref={backgroundInputRef} type="file" accept="image/*" onChange={handleBackgroundUpload} className="hidden" />
              </motion.div>
            </div>
          </div>

          {/* Right: Preview + Generate */}
          <div className="lg:col-span-2 space-y-3 lg:sticky lg:top-20 lg:self-start">
            {/* Preview */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
              className="rounded-xl border bg-card overflow-hidden"
            >
              <div className="p-2.5 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Video className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Preview</span>
                </div>
                <Badge variant="outline" className="text-[10px]">16:9</Badge>
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
                    <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative w-full h-full">
                      <img src={getBackgroundImage()} alt="Background" className="absolute inset-0 w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40" />
                      
                      {characterImage ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-white/30 shadow-lg">
                            <img src={characterImage} alt="Character" className="w-full h-full object-cover" />
                          </div>
                        </div>
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <div className="w-12 h-12 rounded-full bg-muted/80 flex items-center justify-center">
                            <User className="w-6 h-6 text-muted-foreground" />
                          </div>
                        </div>
                      )}
                      
                      {isGenerating && (
                        <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center backdrop-blur-sm">
                          <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
                          <p className="text-sm font-medium mb-2">
                            {generationStep === 'generating_audio' && 'Generating voice...'}
                            {generationStep === 'generating_video' && 'Creating video...'}
                            {generationStep === 'applying_lipsync' && 'Syncing lips...'}
                          </p>
                          <Progress value={progress} className="w-24 h-1.5" />
                        </div>
                      )}
                      
                      {generationStep === 'error' && (
                        <div className="absolute inset-0 bg-destructive/10 flex flex-col items-center justify-center backdrop-blur-sm p-4">
                          <AlertCircle className="w-6 h-6 text-destructive mb-2" />
                          <p className="text-xs text-destructive text-center line-clamp-2">{error}</p>
                          <Button variant="outline" size="sm" className="mt-2" onClick={() => setGenerationStep('idle')}>Retry</Button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              {/* Quick Summary */}
              <div className="p-2.5 border-t bg-muted/30 flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-1">
                  <Mic className="w-3 h-3" />
                  <span>{VOICE_OPTIONS.find(v => v.id === selectedVoice)?.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Image className="w-3 h-3" />
                  <span className="truncate max-w-[60px]">{customBackground ? 'Custom' : BACKGROUND_PRESETS.find(b => b.id === selectedBackground)?.name}</span>
                </div>
              </div>
            </motion.div>

            {/* Generate Button */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              {generationStep === 'complete' ? (
                <div className="space-y-2">
                  <Button className="w-full h-10" asChild>
                    <a href={generatedVideoUrl || '#'} download="training-video.mp4">
                      <Download className="w-4 h-4 mr-2" />
                      Download Video
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" className="w-full" onClick={handleReset}>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    Create Another
                  </Button>
                </div>
              ) : (
                <Button 
                  className="w-full h-10"
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                >
                  {isGenerating ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</>
                  ) : (
                    <><Wand2 className="w-4 h-4 mr-2" />Generate Video<Badge variant="secondary" className="ml-2 text-xs">{ESTIMATED_CREDITS} cr</Badge></>
                  )}
                </Button>
              )}
            </motion.div>

            {/* Checklist Pills */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="flex flex-wrap gap-1.5">
              {[
                { label: 'Script', ok: scriptText.trim().length > 0 },
                { label: 'Voice', ok: !!selectedVoice },
                { label: 'Character', ok: !!characterImage },
                { label: 'Scene', ok: !!(selectedBackground || customBackground) },
              ].map((item, i) => (
                <div key={i} className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-full text-[10px]",
                  item.ok ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                )}>
                  {item.ok ? <Check className="w-2.5 h-2.5" /> : <CircleDot className="w-2.5 h-2.5" />}
                  {item.label}
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}