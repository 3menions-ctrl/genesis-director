import { useState, useRef, useCallback, useEffect, memo, forwardRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useStudio } from '@/contexts/StudioContext';
import { useSafeNavigation, useRouteCleanup, useNavigationAbort } from '@/lib/navigation';
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
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { handleError } from '@/lib/errorHandler';
import { SimpleVideoPlayer } from '@/components/player';

// Import environment presets - Diverse variety for training videos
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
// Additional diverse environments
import whiteStudioImg from '@/assets/environments/white-studio.jpg';
import goldenHourStudioImg from '@/assets/environments/golden-hour-studio.jpg';
import modernMinimalistImg from '@/assets/environments/modern-minimalist.jpg';
import urbanLuxuryImg from '@/assets/environments/urban-luxury.jpg';
import cozyFirelightImg from '@/assets/environments/cozy-firelight.jpg';
import zenGardenImg from '@/assets/environments/zen-garden.jpg';
import neonNightsImg from '@/assets/environments/neon-nights.jpg';
import tropicalParadiseImg from '@/assets/environments/tropical-paradise.jpg';
import mountainSummitImg from '@/assets/environments/mountain-summit.jpg';
import spaceStationImg from '@/assets/environments/space-station.jpg';
import cherryBlossomImg from '@/assets/environments/cherry-blossom.jpg';
import cozyCabinImg from '@/assets/environments/cozy-cabin.jpg';

// Voice options from OpenAI TTS with sample text for preview
const VOICE_OPTIONS = [
  { id: 'nova', name: 'Nova', gender: 'female', description: 'Warm, professional', sample: 'Welcome to our training program. Today we will explore best practices for success.' },
  { id: 'alloy', name: 'Alloy', gender: 'neutral', description: 'Versatile, clear', sample: 'This module covers the essential skills you need to excel in your role.' },
  { id: 'echo', name: 'Echo', gender: 'male', description: 'Friendly, warm', sample: 'Hey there! Ready to learn something new? Let me walk you through it step by step.' },
  { id: 'fable', name: 'Fable', gender: 'male', description: 'Expressive, storyteller', sample: 'Picture this: a world where every challenge becomes an opportunity for growth.' },
  { id: 'onyx', name: 'Onyx', gender: 'male', description: 'Deep, authoritative', sample: 'The following information is critical to your understanding of company protocols.' },
  { id: 'shimmer', name: 'Shimmer', gender: 'female', description: 'Soft, gentle', sample: 'Take a moment to reflect on what you have learned. Every step forward matters.' },
];

// Background presets - Diverse variety organized by category
const BACKGROUND_PRESETS = [
  // Professional Studios (Most Popular)
  { id: 'white_studio', name: 'White Studio', image: whiteStudioImg, category: 'studio' },
  { id: 'home_studio', name: 'Home Studio', image: homeStudioImg, category: 'studio' },
  { id: 'golden_hour_studio', name: 'Golden Hour Studio', image: goldenHourStudioImg, category: 'studio' },
  { id: 'podcast_studio', name: 'Podcast Studio', image: podcastStudioImg, category: 'studio' },
  { id: 'news_studio', name: 'News Studio', image: newsStudioImg, category: 'studio' },
  { id: 'green_screen', name: 'Green Screen', image: greenScreenImg, category: 'studio' },
  
  // Corporate & Business
  { id: 'corporate_boardroom', name: 'Corporate Boardroom', image: corporateBoardroomImg, category: 'corporate' },
  { id: 'startup_office', name: 'Startup Office', image: startupOfficeImg, category: 'corporate' },
  { id: 'executive_library', name: 'Executive Library', image: executiveLibraryImg, category: 'corporate' },
  { id: 'modern_minimalist', name: 'Modern Minimalist', image: modernMinimalistImg, category: 'corporate' },
  { id: 'urban_luxury', name: 'Urban Luxury', image: urbanLuxuryImg, category: 'corporate' },
  
  // Education & Training
  { id: 'lecture_hall', name: 'Lecture Hall', image: lectureHallImg, category: 'education' },
  { id: 'modern_classroom', name: 'Modern Classroom', image: modernClassroomImg, category: 'education' },
  { id: 'webinar_stage', name: 'Webinar Stage', image: webinarStageImg, category: 'education' },
  { id: 'science_lab', name: 'Science Lab', image: scienceLabImg, category: 'education' },
  { id: 'medical_training', name: 'Medical Training', image: medicalTrainingImg, category: 'education' },
  { id: 'workshop_training', name: 'Workshop Training', image: workshopTrainingImg, category: 'education' },
  
  // Lifestyle & Creative
  { id: 'coffee_shop', name: 'Coffee Shop', image: coffeeShopImg, category: 'lifestyle' },
  { id: 'cozy_firelight', name: 'Cozy Firelight', image: cozyFirelightImg, category: 'lifestyle' },
  { id: 'cozy_cabin', name: 'Cozy Cabin', image: cozyCabinImg, category: 'lifestyle' },
  { id: 'zen_garden', name: 'Zen Garden', image: zenGardenImg, category: 'lifestyle' },
  { id: 'neon_nights', name: 'Neon Nights', image: neonNightsImg, category: 'lifestyle' },
  
  // Nature & Outdoor
  { id: 'tropical_paradise', name: 'Tropical Paradise', image: tropicalParadiseImg, category: 'nature' },
  { id: 'mountain_summit', name: 'Mountain Summit', image: mountainSummitImg, category: 'nature' },
  { id: 'cherry_blossom', name: 'Cherry Blossom', image: cherryBlossomImg, category: 'nature' },
  
  // Sci-Fi & Fantasy
  { id: 'space_station', name: 'Space Station', image: spaceStationImg, category: 'scifi' },
];

// Background descriptions for richer video prompts
function getBackgroundDescription(backgroundId: string): string {
  const descriptions: Record<string, string> = {
    white_studio: 'Clean white cyclorama studio with soft diffused lighting, minimalist professional backdrop.',
    home_studio: 'Modern home office studio setup with ring light, acoustic panels, professional yet approachable atmosphere.',
    golden_hour_studio: 'Warm golden hour lighting streaming through windows, cinematic amber tones, romantic studio ambiance.',
    podcast_studio: 'Professional podcast studio with foam panels, boom microphone visible, intimate broadcast setting.',
    news_studio: 'Broadcast news desk setup with multiple monitors, professional lighting grid, authoritative media environment.',
    green_screen: 'Chroma key green screen setup for compositing, evenly lit green backdrop.',
    corporate_boardroom: 'Executive boardroom with mahogany table, city skyline through windows, premium corporate setting.',
    startup_office: 'Modern open-plan startup office with exposed brick, standing desks, energetic tech company vibe.',
    executive_library: 'Traditional executive library with leather chairs, book-lined walls, prestigious academic atmosphere.',
    modern_minimalist: 'Ultra-clean minimalist space with concrete walls, designer furniture, architectural lighting.',
    urban_luxury: 'High-rise penthouse with floor-to-ceiling windows, city lights, sophisticated urban luxury.',
    lecture_hall: 'University lecture hall with tiered seating, projection screen, academic teaching environment.',
    modern_classroom: 'Contemporary classroom with interactive whiteboard, collaborative seating, educational setting.',
    webinar_stage: 'Professional webinar stage with branded backdrop, presentation screen, virtual event setup.',
    science_lab: 'Research laboratory with equipment, monitors, scientific instruments, high-tech research environment.',
    medical_training: 'Medical training facility with anatomical models, clinical setting, healthcare education environment.',
    workshop_training: 'Hands-on workshop space with tools, workbenches, practical skills training environment.',
    coffee_shop: 'Cozy coffee shop corner with warm lighting, exposed brick, casual comfortable atmosphere.',
    cozy_firelight: 'Intimate fireside setting with warm flickering light, comfortable seating, relaxed ambiance.',
    cozy_cabin: 'Rustic cabin interior with wooden beams, fireplace, mountain lodge comfort.',
    zen_garden: 'Tranquil zen garden with raked sand, bonsai, bamboo, peaceful meditation space.',
    neon_nights: 'Cyberpunk neon-lit environment with colorful LED strips, futuristic urban nightlife aesthetic.',
    tropical_paradise: 'Beachside tropical setting with palm trees, ocean view, paradise vacation backdrop.',
    mountain_summit: 'Mountain peak overlook with panoramic views, alpine scenery, inspiring summit location.',
    cherry_blossom: 'Japanese cherry blossom garden in spring, pink petals, serene traditional garden.',
    space_station: 'Futuristic space station interior with curved walls, holographic displays, sci-fi environment.',
  };
  return descriptions[backgroundId] || 'Professional studio environment with balanced lighting.';
}

type GenerationStep = 'idle' | 'generating_audio' | 'generating_video' | 'applying_lipsync' | 'complete' | 'error';

// Wizard steps - logical order: Script first (content), Voice (how it sounds), Character (who speaks), Scene (backdrop)
const WIZARD_STEPS = [
  { id: 'script', label: 'Script', icon: Sparkles },
  { id: 'voice', label: 'Voice', icon: Mic },
  { id: 'character', label: 'Character', icon: User },
  { id: 'scene', label: 'Scene', icon: Image },
];

// Main content component with forwardRef for ref compatibility
const TrainingVideoContent = memo(forwardRef<HTMLDivElement, Record<string, never>>(function TrainingVideoContent(_, ref) {
  // Unified navigation - safe navigation with locking
  const { navigate } = useSafeNavigation();
  const { abort: abortRequests } = useNavigationAbort();
  
  // Register cleanup when leaving this page
  useRouteCleanup(() => {
    abortRequests();
  }, [abortRequests]);
  
  // FIX: useAuth and useStudio now return safe fallbacks if context is missing
  // No try-catch needed - that violated React's hook rules
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

  // Generate training video - Character compositing + Kling animation pipeline
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
      // Get the selected background for compositing
      const selectedBg = BACKGROUND_PRESETS.find(b => b.id === selectedBackground);
      const backgroundImage = customBackground || selectedBg?.image;
      
      if (!backgroundImage) {
        throw new Error('No background selected');
      }
      
      // Step 1: Generate audio from script (10%)
      toast.info('Generating voice audio...');
      setProgress(5);
      
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
      setProgress(15);

      // Step 2: Composite character onto background (15-40%)
      setGenerationStep('generating_video');
      toast.info('Extracting character and compositing onto scene...');
      
      // Convert background to base64 if it's an imported module
      let backgroundBase64: string | undefined;
      let backgroundUrl: string | undefined;
      
      if (backgroundImage.startsWith('data:')) {
        backgroundBase64 = backgroundImage.split(',')[1];
      } else if (backgroundImage.startsWith('http')) {
        backgroundUrl = backgroundImage;
      } else {
        // It's an imported asset, need to fetch and convert
        try {
          const bgResponse = await fetch(backgroundImage);
          const bgBlob = await bgResponse.blob();
          const reader = new FileReader();
          backgroundBase64 = await new Promise<string>((resolve) => {
            reader.onload = () => {
              const result = reader.result as string;
              resolve(result.split(',')[1]);
            };
            reader.readAsDataURL(bgBlob);
          });
        } catch (e) {
          console.warn('Failed to load background, using URL:', e);
          backgroundUrl = backgroundImage;
        }
      }
      
      setProgress(20);
      
      // Call the compositing service
      const { data: compositeData, error: compositeError } = await supabase.functions.invoke('composite-character', {
        body: {
          characterBase64: characterImage.split(',')[1],
          backgroundBase64,
          backgroundImageUrl: backgroundUrl,
          placement: 'center',
          scale: 0.7,
          aspectRatio: '16:9',
        },
      });

      if (compositeError) {
        console.warn('Compositing service error, falling back to direct generation:', compositeError);
      }
      
      setProgress(40);
      
      // Use composited image if available, otherwise fall back to character image
      let startImageUrl: string;
      
      if (compositeData?.success && compositeData?.compositedImageUrl) {
        startImageUrl = compositeData.compositedImageUrl;
        toast.success(`Character composited onto scene (${compositeData.method})`);
      } else {
        // Fallback: Upload character image directly
        toast.info('Using character image directly for generation...');
        const imageBlob = await fetch(characterImage).then(r => r.blob());
        const imageFileName = `training-avatar-${user.id}-${Date.now()}.jpg`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('character-references')
          .upload(imageFileName, imageBlob, {
            contentType: 'image/jpeg',
            upsert: true,
          });
        
        if (uploadError) {
          console.warn('Image upload failed:', uploadError);
          startImageUrl = characterImage; // Use base64 as last resort
        } else {
          const { data: publicUrl } = supabase.storage
            .from('character-references')
            .getPublicUrl(imageFileName);
          startImageUrl = publicUrl.publicUrl;
        }
      }

      // Step 3: Generate animated video with Kling (40-75%)
      toast.info('Animating speaking presenter...');
      setProgress(45);
      
      // Build prompt for natural speaking animation
      const animationPrompt = `The person in the image is speaking naturally to camera with confident body language. Direct eye contact, subtle natural head movements, professional presenter demeanor. The presenter is delivering educational content with engaging expressions. No scene change, consistent lighting and environment.`;

      const { data: videoData, error: videoError } = await supabase.functions.invoke('generate-video', {
        body: {
          prompt: animationPrompt,
          imageUrl: startImageUrl,
          aspectRatio: '16:9',
          duration: Math.min(Math.ceil(scriptText.length / 15), 10),
          userId: user.id,
          mode: 'training_avatar',
        },
      });

      if (videoError) throw videoError;
      
      // Handle async video generation
      let finalVideoUrl: string;
      
      if (videoData?.videoUrl) {
        finalVideoUrl = videoData.videoUrl;
      } else if (videoData?.taskId) {
        toast.info('Video processing... This may take 1-3 minutes');
        const taskId = videoData.taskId;
        const provider = videoData.provider || 'replicate';
        
        const maxAttempts = 60;
        const pollInterval = 5000;
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          setProgress(45 + Math.min(30, attempt)); // 45% to 75%
          
          const { data: statusData, error: statusError } = await supabase.functions.invoke('check-video-status', {
            body: { taskId, provider }
          });
          
          if (statusError) {
            console.warn('Status check error:', statusError);
            continue;
          }
          
          const isCompleted = statusData?.status === 'completed' || 
                              statusData?.status === 'SUCCEEDED' || 
                              statusData?.status === 'succeeded';
          
          if (isCompleted && statusData?.videoUrl) {
            finalVideoUrl = statusData.videoUrl;
            break;
          } else if (statusData?.status === 'failed' || statusData?.status === 'FAILED') {
            throw new Error(statusData?.error || 'Video generation failed');
          }
          
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
      
      setProgress(80);
      setGeneratedVideoUrl(finalVideoUrl);

      // Step 4: Skip lip sync per user preference (Kling animation only)
      // The video already has speaking motion from Kling
      setGenerationStep('complete');
      setProgress(100);
      
      // Save training video to database
      if (finalVideoUrl && user) {
        try {
          const { error: saveError } = await supabase.from('training_videos').insert({
            user_id: user.id,
            title: `Training Video - ${new Date().toLocaleDateString()}`,
            description: scriptText.slice(0, 200),
            video_url: finalVideoUrl,
            voice_id: selectedVoice,
            environment: selectedBackground,
          });
          
          if (saveError) {
            console.error('Failed to save training video:', saveError);
          }
        } catch (saveErr) {
          console.error('Error saving training video:', saveErr);
        }
      }
      
      toast.success('Training video generated successfully!');

    } catch (err) {
      console.error('Generation error:', err);
      setError('Failed to generate video. Please try again.');
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
    <div ref={ref} className="min-h-screen bg-[#030303] text-white overflow-x-hidden">
      <TrainingBackground />
      <AppHeader />
      
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
              className="p-4 rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                    scriptText.trim() ? "bg-emerald-500 text-white" : "bg-white/10 text-white/50"
                  )}>
                    {scriptText.trim() ? <Check className="w-3.5 h-3.5" /> : "1"}
                  </div>
                  <h3 className="font-semibold text-sm text-white">Script</h3>
                </div>
                <Badge variant="outline" className="text-[10px] border-white/20 text-white/60">{scriptText.length}/500</Badge>
              </div>
              <Textarea
                placeholder="Enter what your character will say..."
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value.slice(0, 500))}
                className="min-h-[80px] resize-none text-sm bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/30 focus:border-emerald-500/50"
              />
            </motion.div>

            {/* Step 2: Voice - Compact Grid */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="p-4 rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                  selectedVoice ? "bg-emerald-500 text-white" : "bg-white/10 text-white/50"
                )}>
                  {selectedVoice ? <Check className="w-3.5 h-3.5" /> : "2"}
                </div>
                <h3 className="font-semibold text-sm text-white">Voice</h3>
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
                        isSelected 
                          ? "border-emerald-500/50 bg-emerald-500/10" 
                          : "border-white/[0.08] bg-white/[0.02] hover:border-emerald-500/30"
                      )}
                    >
                      <div className="text-xs font-medium truncate text-white">{voice.name}</div>
                      <div className="text-[10px] text-white/50 truncate">{voice.gender}</div>
                      {isSelected && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleVoicePreview(voice.id); }}
                        className={cn(
                          "absolute bottom-1 right-1 w-5 h-5 rounded-full flex items-center justify-center transition-all",
                          isPlaying ? "bg-emerald-500 text-white" : "bg-white/10 text-white/50 opacity-0 group-hover:opacity-100"
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
                className="p-4 rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                    characterImage ? "bg-emerald-500 text-white" : "bg-white/10 text-white/50"
                  )}>
                    {characterImage ? <Check className="w-3.5 h-3.5" /> : "3"}
                  </div>
                  <h3 className="font-semibold text-sm text-white">Character</h3>
                </div>
                <div 
                  className={cn(
                    "aspect-square rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer transition-all overflow-hidden",
                    characterImage ? "border-emerald-500/50" : "border-white/20 hover:border-emerald-500/50"
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
                      <Upload className="w-8 h-8 text-white/40 mx-auto mb-2" />
                      <p className="text-xs text-white/40">Upload image</p>
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
                className="p-4 rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                    (selectedBackground || customBackground) ? "bg-emerald-500 text-white" : "bg-white/10 text-white/50"
                  )}>
                    {(selectedBackground || customBackground) ? <Check className="w-3.5 h-3.5" /> : "4"}
                  </div>
                  <h3 className="font-semibold text-sm text-white">Scene</h3>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {/* Custom upload */}
                  <button
                    onClick={() => backgroundInputRef.current?.click()}
                    className={cn(
                      "aspect-video rounded-md border-2 border-dashed flex items-center justify-center transition-all overflow-hidden",
                      customBackground ? "border-emerald-500" : "border-white/20 hover:border-emerald-500/50"
                    )}
                  >
                    {customBackground ? (
                      <img src={customBackground} alt="Custom" className="w-full h-full object-cover" />
                    ) : (
                      <Upload className="w-3.5 h-3.5 text-white/40" />
                    )}
                  </button>
                  {BACKGROUND_PRESETS.slice(0, 8).map((bg) => (
                    <button
                      key={bg.id}
                      onClick={() => { setSelectedBackground(bg.id); setCustomBackground(null); }}
                      className={cn(
                        "aspect-video rounded-md overflow-hidden border-2 transition-all relative",
                        selectedBackground === bg.id && !customBackground ? "border-emerald-500" : "border-transparent hover:border-emerald-500/50"
                      )}
                    >
                      <img src={bg.image} alt={bg.name} className="w-full h-full object-cover" />
                      {selectedBackground === bg.id && !customBackground && (
                        <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 flex items-center justify-center">
                          <Check className="w-2 h-2 text-white" />
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
              className="rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl overflow-hidden"
            >
              <div className="p-2.5 border-b border-white/[0.08] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Video className="w-4 h-4 text-white/50" />
                  <span className="text-sm font-medium text-white">Preview</span>
                </div>
                <Badge variant="outline" className="text-[10px] border-white/20 text-white/60">16:9</Badge>
              </div>
              
              <div className="aspect-video bg-black/50 relative">
                <AnimatePresence mode="wait">
                  {generatedVideoUrl ? (
                    <motion.div
                      key="video"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="w-full h-full"
                    >
                      <SimpleVideoPlayer
                        src={generatedVideoUrl}
                        showControls
                        className="w-full h-full object-cover"
                      />
                    </motion.div>
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
                          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                            <User className="w-6 h-6 text-white/40" />
                          </div>
                        </div>
                      )}
                      
                      {isGenerating && (
                        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm">
                          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mb-2" />
                          <p className="text-sm font-medium text-white mb-2">
                            {generationStep === 'generating_audio' && 'Generating voice...'}
                            {generationStep === 'generating_video' && 'Creating video...'}
                            {generationStep === 'applying_lipsync' && 'Syncing lips...'}
                          </p>
                          <Progress value={progress} className="w-24 h-1.5" />
                        </div>
                      )}
                      
                      {generationStep === 'error' && (
                        <div className="absolute inset-0 bg-red-500/10 flex flex-col items-center justify-center backdrop-blur-sm p-4">
                          <AlertCircle className="w-6 h-6 text-red-400 mb-2" />
                          <p className="text-xs text-red-400 text-center line-clamp-2">{error}</p>
                          <Button variant="outline" size="sm" className="mt-2 border-white/20 text-white hover:bg-white/10" onClick={() => setGenerationStep('idle')}>Retry</Button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              {/* Quick Summary */}
              <div className="p-2.5 border-t border-white/[0.08] bg-white/[0.02] flex items-center justify-between text-[10px] text-white/50">
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
                  <Button className="w-full h-10 bg-emerald-500 hover:bg-emerald-600 text-white" asChild>
                    <a href={generatedVideoUrl || '#'} download="training-video.mp4">
                      <Download className="w-4 h-4 mr-2" />
                      Download Video
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" className="w-full border-white/20 text-white hover:bg-white/10" onClick={handleReset}>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    Create Another
                  </Button>
                </div>
              ) : (
                <Button 
                  className="w-full h-10 bg-emerald-500 hover:bg-emerald-600 text-white disabled:bg-white/10 disabled:text-white/30"
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                >
                  {isGenerating ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</>
                  ) : (
                    <><Wand2 className="w-4 h-4 mr-2" />Generate Video<Badge className="ml-2 text-xs bg-white/20 text-white border-0">{ESTIMATED_CREDITS} cr</Badge></>
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
                  item.ok ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-white/40"
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
}));

// Wrapper with error boundary for fault isolation
export default function TrainingVideo() {
  return (
    <ErrorBoundary>
      <TrainingVideoContent />
    </ErrorBoundary>
  );
}