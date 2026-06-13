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
  ChevronRight, CircleDot, Pause, Film,
  Settings2, Lock, Sun, Camera, Timer, Ratio
} from 'lucide-react';
import { CreditsDisplay } from '@/components/studio/CreditsDisplay';
import { CreditLowInline } from '@/components/credits/CreditLowInline';
import { CinematicAtmosphere, DiagnosticTicker } from '@/components/premium/CinematicAtmosphere';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { handleError } from '@/lib/errorHandler';
import { BrandedVideoPlayer } from '@/components/intro/BrandedVideoPlayer';
import { PremiumPageHero, type HeroStat } from '@/components/premium/PremiumPageHero';

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

import { usePageMeta } from '@/hooks/usePageMeta';
import { FoundationShell } from '@/components/foundation/FoundationShell';
import { EditorialCanvas } from '@/components/foundation/EditorialCanvas';
import { useLiveRenderTimecode } from '@/hooks/useLiveRenderTimecode';
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
  const [videoEngine, setVideoEngine] = useState<'kling' | 'seedance'>('kling');
  // Training settings panel
  const [targetDuration, setTargetDuration] = useState<number | null>(null); // null = auto (length-based)
  const [characterLockStrict, setCharacterLockStrict] = useState<boolean>(true);
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9');
  const [cameraFixed, setCameraFixed] = useState<boolean>(true);
  const [lightingMood, setLightingMood] = useState<'soft' | 'cinematic' | 'high-key' | 'moody'>('soft');
  const [clipCount, setClipCount] = useState<number>(1);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
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
  const VOICE_CACHE_KEY = 'sb_voice_preview_';
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
      
      // Step 1: Voice is generated inside the pipeline (mux for Seedance, native for Kling)
      setProgress(8);

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
        // SECURITY: store under user folder so private-bucket RLS
        // (`(storage.foldername(name))[1] = auth.uid()`) authorizes the owner.
        const imageFileName = `${user.id}/training-avatar-${Date.now()}.jpg`;
        
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
          // character-references is a private bucket — face biometrics must
          // not be reachable via public URL. Sign for 1h so downstream
          // generation services (Replicate/Kling) can still fetch.
          const { data: signed, error: signErr } = await supabase.storage
            .from('character-references')
            .createSignedUrl(imageFileName, 3600);
          if (signErr || !signed?.signedUrl) {
            console.warn('Signed URL failed, falling back to base64:', signErr);
            startImageUrl = characterImage;
          } else {
            startImageUrl = signed.signedUrl;
          }
        }
      }

      // Step 3: Route through mode-router for full continuity pipeline (Kling/Seedance)
      toast.info(`Dispatching to ${videoEngine === 'seedance' ? 'Seedance 2' : 'Kling V3'} pipeline...`);
      setProgress(45);
      
      // Build prompt for natural speaking animation (settings-aware)
      const lightingPhrase = {
        soft: 'soft diffused key light, gentle fill, flattering presenter lighting',
        cinematic: 'cinematic chiaroscuro lighting, controlled shadows, filmic contrast',
        'high-key': 'bright high-key broadcast lighting, evenly lit, low contrast',
        moody: 'moody low-key lighting, deep shadows, dramatic single source',
      }[lightingMood];
      const cameraPhrase = cameraFixed
        ? 'locked-off static camera, no camera movement, subject motion only'
        : 'subtle handheld presenter framing, gentle parallax, no zoom';
      const lockPhrase = characterLockStrict
        ? 'identity locked: preserve exact facial features, hairstyle, clothing, and skin tone of the reference person without drift'
        : 'preserve general likeness of the reference person';
      const animationPrompt = `The person in the image is speaking naturally to camera with confident body language. Direct eye contact, subtle natural head movements, professional presenter demeanor. The presenter is delivering educational content with engaging expressions. No scene change, consistent environment. ${lightingPhrase}. ${cameraPhrase}. ${lockPhrase}.`;

      const finalDuration = targetDuration ?? Math.min(Math.ceil(scriptText.length / 15), 10);

      // Director-grade continuity manifest — gives both pipelines a shared
      // identityBible + environment DNA so chained clips stay locked.
      const envName = customBackground
        ? 'custom background'
        : (BACKGROUND_PRESETS.find((b) => b.id === selectedBackground)?.name || 'studio');
      const characterDescription = 'The reference presenter — preserve exact face, hairstyle, wardrobe, skin tone, and proportions across every clip.';
      const trainingIdentityBible = {
        version: 'training-v1',
        characterIdentity: {
          description: characterDescription,
          strict: characterLockStrict,
        },
        masterSceneAnchor: {
          environmentDNA: `${envName} — locked environment, identical framing, identical lighting (${lightingMood}) across all clips`,
          aspectRatio,
        },
        consistencyPrompt: `${characterDescription} ${envName}. ${lightingPhrase}. ${cameraPhrase}.`,
        cameraGrammar: cameraFixed ? 'locked-off static' : 'subtle handheld',
        continuityRules: [
          'Identical character identity in every clip',
          'Identical wardrobe and accessories',
          'Identical environment and lighting',
          'No scene change between clips',
          'Maintain presenter eyeline and framing',
        ],
      };

      // Dispatch to mode-router (avatar mode → engine-aware pipeline w/ continuity, audio mux, stitching)
      const { data: routerData, error: routerError } = await supabase.functions.invoke('mode-router', {
        body: {
          mode: 'avatar',
          prompt: `${scriptText}\n\nDirection: ${animationPrompt}`,
          referenceImageUrl: startImageUrl,
          imageUrl: startImageUrl,
          voiceId: selectedVoice,
          aspectRatio,
          clipCount,
          clipDuration: finalDuration,
          enableNarration: true,
          enableMusic: false,
          videoEngine,
          characterLock: {
            strict: characterLockStrict,
            source: 'training_video',
            description: characterDescription,
          },
          identityBible: trainingIdentityBible,
        },
      });

      if (routerError) throw routerError;
      if (!routerData?.projectId) throw new Error(routerData?.error || 'Pipeline did not return a project id');

      const projectId = routerData.projectId as string;
      toast.info('Pipeline running — multi-clip continuity, voice mux, and stitching in progress...');

      // Poll movie_projects for completion (handles multi-clip + stitching)
      const maxAttempts = 90;       // up to ~7.5 minutes
      const pollInterval = 5000;
      let finalVideoUrl: string | null = null;
      let stitchedUrl: string | null = null;
      let manifestUrl: string | null = null;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
        setProgress(45 + Math.min(40, Math.floor((attempt / maxAttempts) * 40)));

        const { data: proj, error: projErr } = await supabase
          .from('movie_projects')
          .select('status, video_url, last_error, pipeline_state, pro_features_data, video_clips')
          .eq('id', projectId)
          .maybeSingle();

        if (projErr) {
          console.warn('Project poll error:', projErr);
          continue;
        }

        if (proj?.status === 'completed' && proj.video_url) {
          finalVideoUrl = proj.video_url;
          const pf = (proj.pro_features_data as any) || {};
          stitchedUrl = pf.stitchedVideoUrl || pf.stitched_video_url || (clipCount > 1 ? proj.video_url : null);
          manifestUrl = pf.manifestUrl || pf.stitchManifestUrl || null;
          break;
        }
        if (proj?.status === 'failed') {
          throw new Error(proj.last_error || 'Pipeline failed');
        }

        if (attempt > 0 && attempt % 6 === 0) {
          const stage = (proj?.pipeline_state as any)?.stage || 'processing';
          toast.info(`Still rendering (${stage})...`);
        }
      }

      if (!finalVideoUrl) {
        throw new Error('Video generation timed out after 7 minutes');
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
            project_id: projectId,
            video_engine: videoEngine,
            clip_count: clipCount,
            aspect_ratio: aspectRatio,
            stitched_video_url: stitchedUrl,
            manifest_url: manifestUrl,
            duration_seconds: finalDuration * clipCount,
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
    <div ref={ref} className="min-h-screen text-foreground overflow-x-hidden relative">
      <CinematicAtmosphere ns="train" stars={22} />
      <AppHeader />
      
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Diagnostic ticker */}
        <div className="flex justify-center pt-12">
          <DiagnosticTicker
            ns="train"
            items={[
              { code: 'TRN', label: 'Studio' },
              { code: 'LIP', label: 'Sync Engine' },
              { code: 'LIVE', label: 'Render' },
            ]}
          />
        </div>
        {/* Premium editorial header */}
        <div className="pt-6 sm:pt-8">
          <PremiumPageHero
            eyebrow="Studio · Lip-Sync Engine"
            titlePrefix="Training"
            titleHighlight="video"
            titleSuffix="studio."
            description="Pick a presenter, write a script, ship a polished training clip with synced voice and lip movement."
            stats={[
              { label: 'Voices', value: VOICE_OPTIONS.length, icon: Mic, accent: 'text-foreground' },
              { label: 'Backgrounds', value: BACKGROUND_PRESETS.length, icon: Image, accent: 'text-[hsl(var(--primary))]' },
              { label: 'Cost / Clip', value: `${ESTIMATED_CREDITS} cr`, icon: Coins, accent: 'text-foreground/90' },
              { label: 'Render Time', value: '~2 min', icon: Zap, accent: 'text-foreground/90' },
            ] as HeroStat[]}
          />
        </div>

        {/* Main Grid - More condensed */}
        <div className="grid lg:grid-cols-5 gap-4">
          {/* Left: All Steps Stacked Compact */}
          <div className="lg:col-span-3 space-y-3">
            {/* Step 1: Script - Compact */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="p-4 rounded-xl border border-white/[0.08] bg-glass backdrop-blur-xl"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                    scriptText.trim() ? "bg-emerald-500 text-foreground" : "bg-white/10 text-muted-foreground"
                  )}>
                    {scriptText.trim() ? <Check className="w-3.5 h-3.5" /> : "1"}
                  </div>
                  <h3 className="font-semibold text-sm text-foreground">Script</h3>
                </div>
                <Badge variant="outline" className="text-[10px] border-white/20 text-muted-foreground">{scriptText.length}/500</Badge>
              </div>
              <Textarea
                placeholder="Enter what your character will say..."
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value.slice(0, 500))}
                className="min-h-[80px] resize-none text-sm bg-glass border-white/[0.08] text-foreground placeholder:text-muted-foreground focus:border-emerald-500/50"
              />
            </motion.div>

            {/* Step 2: Voice - Compact Grid */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="p-4 rounded-xl border border-white/[0.08] bg-glass backdrop-blur-xl"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                  selectedVoice ? "bg-emerald-500 text-foreground" : "bg-white/10 text-muted-foreground"
                )}>
                  {selectedVoice ? <Check className="w-3.5 h-3.5" /> : "2"}
                </div>
                <h3 className="font-semibold text-sm text-foreground">Voice</h3>
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
                          : "border-white/[0.08] bg-glass hover:border-emerald-500/30"
                      )}
                    >
                      <div className="text-xs font-medium truncate text-foreground">{voice.name}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{voice.gender}</div>
                      {isSelected && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-foreground" />
                        </div>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleVoicePreview(voice.id); }}
                        className={cn(
                          "absolute bottom-1 right-1 w-5 h-5 rounded-full flex items-center justify-center transition-all",
                          isPlaying ? "bg-emerald-500 text-foreground" : "bg-white/10 text-muted-foreground opacity-0 group-hover:opacity-100"
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
                className="p-4 rounded-xl border border-white/[0.08] bg-glass backdrop-blur-xl"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                    characterImage ? "bg-emerald-500 text-foreground" : "bg-white/10 text-muted-foreground"
                  )}>
                    {characterImage ? <Check className="w-3.5 h-3.5" /> : "3"}
                  </div>
                  <h3 className="font-semibold text-sm text-foreground">Character</h3>
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
                      <div className="absolute inset-0 bg-background/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Upload className="w-6 h-6 text-foreground" />
                      </div>
                    </div>
                  ) : (
                    <div className="text-center p-4">
                      <Upload className="w-8 h-8 text-foreground/80 mx-auto mb-2" />
                      <p className="text-xs text-foreground/80">Upload image</p>
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
                className="p-4 rounded-xl border border-white/[0.08] bg-glass backdrop-blur-xl"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                    (selectedBackground || customBackground) ? "bg-emerald-500 text-foreground" : "bg-white/10 text-muted-foreground"
                  )}>
                    {(selectedBackground || customBackground) ? <Check className="w-3.5 h-3.5" /> : "4"}
                  </div>
                  <h3 className="font-semibold text-sm text-foreground">Scene</h3>
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
                      <Upload className="w-3.5 h-3.5 text-foreground/80" />
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
                          <Check className="w-2 h-2 text-foreground" />
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
              className="rounded-xl border border-white/[0.08] bg-glass backdrop-blur-xl overflow-hidden"
            >
              <div className="p-2.5 border-b border-white/[0.08] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Video className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Preview</span>
                </div>
                <Badge variant="outline" className="text-[10px] border-white/20 text-muted-foreground">16:9</Badge>
              </div>
              
              <div className="aspect-video bg-background/50 relative">
                <AnimatePresence mode="wait">
                  {generatedVideoUrl ? (
                    <motion.div
                      key="video"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="w-full h-full"
                    >
                      <BrandedVideoPlayer
                        src={generatedVideoUrl}
                        showControls
                        className="w-full h-full object-cover"
                      />
                    </motion.div>
                  ) : (
                    <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative w-full h-full">
                      <img src={getBackgroundImage()} alt="Background" className="absolute inset-0 w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-background/40" />
                      
                      {characterImage ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-white/30 shadow-lg">
                            <img src={characterImage} alt="Character" className="w-full h-full object-cover" />
                          </div>
                        </div>
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                            <User className="w-6 h-6 text-foreground/80" />
                          </div>
                        </div>
                      )}
                      
                      {isGenerating && (
                        <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center backdrop-blur-sm">
                          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mb-2" />
                          <p className="text-sm font-medium text-foreground mb-2">
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
                          <Button variant="outline" size="sm" className="mt-2 border-white/20 text-foreground hover:bg-white/10" onClick={() => setGenerationStep('idle')}>Retry</Button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              {/* Quick Summary */}
              <div className="p-2.5 border-t border-white/[0.08] bg-glass flex items-center justify-between text-[10px] text-muted-foreground">
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

            {/* Engine Toggle — Kling V3 (native audio) vs Seedance 2 (motion-first) */}
            {generationStep !== 'complete' && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="rounded-xl border border-white/10 bg-glass p-1 grid grid-cols-2 gap-1"
                role="radiogroup"
                aria-label="Video engine"
              >
                {([
                  { id: 'kling' as const, label: 'Kling V3', sub: 'Single clip · fallback' },
                  { id: 'seedance' as const, label: 'Seedance 2', sub: 'Multi-clip · alternate' },
                ]).map((opt) => {
                  const active = videoEngine === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={isGenerating}
                      onClick={() => {
                        setVideoEngine(opt.id);
                        // Kling = safe single-clip fallback; Seedance unlocks multi-clip continuity
                        if (opt.id === 'kling') setClipCount(1);
                      }}
                      className={cn(
                        'flex flex-col items-start px-3 py-2 rounded-lg transition-all text-left',
                        active
                          ? 'bg-primary/15 ring-1 ring-primary/40 shadow-[0_0_24px_-8px_hsl(var(--primary)/0.5)]'
                          : 'hover:bg-glass-hover text-muted-foreground',
                        isGenerating && 'opacity-50 cursor-not-allowed',
                      )}
                    >
                      <span className={cn('text-xs font-medium', active ? 'text-foreground' : 'text-foreground/80')}>
                        {opt.label}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80">
                        {opt.sub}
                      </span>
                    </button>
                  );
                })}
              </motion.div>
            )}

            {/* Training Settings Panel — duration · voice · character lock · environment */}
            {generationStep !== 'complete' && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.17 }}
                className="rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setSettingsOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-glass transition-colors"
                  aria-expanded={settingsOpen}
                >
                  <span className="flex items-center gap-2">
                    <Settings2 className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-medium text-foreground tracking-wide">Training Settings</span>
                    <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80">
                      {targetDuration ?? 'auto'}s · {aspectRatio} · {lightingMood}
                    </span>
                  </span>
                  <ChevronRight
                    className={cn(
                      'w-3.5 h-3.5 text-muted-foreground transition-transform',
                      settingsOpen && 'rotate-90',
                    )}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {settingsOpen && (
                    <motion.div
                      key="settings-body"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: 'easeOut' }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 pb-3 pt-1 space-y-3 border-t border-white/[0.06]">
                        {/* Script Duration */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground uppercase tracking-wider">
                              <Timer className="w-3 h-3" /> Clip Duration
                            </span>
                            <span className="text-[11px] font-mono text-foreground">
                              {targetDuration ? `${targetDuration}s` : 'Auto'}
                            </span>
                          </div>
                          <div className="grid grid-cols-5 gap-1">
                            {[null, 4, 6, 8, 10].map((d) => {
                              const active = targetDuration === d;
                              return (
                                <button
                                  key={d ?? 'auto'}
                                  type="button"
                                  onClick={() => setTargetDuration(d)}
                                  className={cn(
                                    'h-7 rounded-md text-[10px] font-mono transition-all',
                                    active
                                      ? 'bg-primary/20 ring-1 ring-primary/50 text-foreground'
                                      : 'bg-glass hover:bg-glass-active text-muted-foreground',
                                  )}
                                >
                                  {d ? `${d}s` : 'Auto'}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Clip Count — multi-clip continuity (mode-router stitches output) */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground uppercase tracking-wider">
                              <Film className="w-3 h-3" /> Clips
                            </span>
                            <span className="text-[11px] font-mono text-foreground">
                              {clipCount} × {targetDuration ?? 'auto'}s
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-1">
                            {[1, 2, 3].map((c) => {
                              const active = clipCount === c;
                              const locked = videoEngine === 'kling' && c > 1;
                              return (
                                <button
                                  key={c}
                                  type="button"
                                  onClick={() => !locked && setClipCount(c)}
                                  disabled={locked}
                                  title={locked ? 'Kling V3 runs single-clip only (fallback). Switch to Seedance 2 for multi-clip.' : undefined}
                                  className={cn(
                                    'h-7 rounded-md text-[10px] font-mono transition-all',
                                    active
                                      ? 'bg-primary/20 ring-1 ring-primary/50 text-foreground'
                                      : 'bg-glass hover:bg-glass-active text-muted-foreground',
                                    locked && 'opacity-40 cursor-not-allowed',
                                  )}
                                >
                                  {c === 1 ? 'Single' : `${c} stitched`}
                                </button>
                              );
                            })}
                          </div>
                          {videoEngine === 'kling' && (
                            <p className="text-[10px] text-muted-foreground/70 leading-tight">
                              Kling V3 fallback locks to a single clip with native audio. Pick Seedance 2 for stitched continuity.
                            </p>
                          )}
                        </div>

                        {/* Aspect Ratio */}
                        <div className="space-y-1.5">
                          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground uppercase tracking-wider">
                            <Ratio className="w-3 h-3" /> Aspect
                          </span>
                          <div className="grid grid-cols-3 gap-1">
                            {(['16:9', '9:16', '1:1'] as const).map((ar) => {
                              const active = aspectRatio === ar;
                              return (
                                <button
                                  key={ar}
                                  type="button"
                                  onClick={() => setAspectRatio(ar)}
                                  className={cn(
                                    'h-7 rounded-md text-[10px] font-mono transition-all',
                                    active
                                      ? 'bg-primary/20 ring-1 ring-primary/50 text-foreground'
                                      : 'bg-glass hover:bg-glass-active text-muted-foreground',
                                  )}
                                >
                                  {ar}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Environment: Lighting Mood */}
                        <div className="space-y-1.5">
                          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground uppercase tracking-wider">
                            <Sun className="w-3 h-3" /> Lighting
                          </span>
                          <div className="grid grid-cols-4 gap-1">
                            {(['soft', 'cinematic', 'high-key', 'moody'] as const).map((m) => {
                              const active = lightingMood === m;
                              return (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() => setLightingMood(m)}
                                  className={cn(
                                    'h-7 rounded-md text-[10px] capitalize transition-all',
                                    active
                                      ? 'bg-primary/20 ring-1 ring-primary/50 text-foreground'
                                      : 'bg-glass hover:bg-glass-active text-muted-foreground',
                                  )}
                                >
                                  {m}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Toggles: Character Lock + Camera Fixed */}
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setCharacterLockStrict((v) => !v)}
                            className={cn(
                              'flex items-center gap-2 px-2.5 py-2 rounded-md text-left transition-all',
                              characterLockStrict
                                ? 'bg-primary/15 ring-1 ring-primary/40'
                                : 'bg-glass hover:bg-glass-active',
                            )}
                          >
                            <Lock className={cn('w-3.5 h-3.5', characterLockStrict ? 'text-primary' : 'text-muted-foreground')} />
                            <span className="flex-1">
                              <span className="block text-[11px] font-medium text-foreground">Character Lock</span>
                              <span className="block text-[9px] uppercase tracking-wider text-muted-foreground">
                                {characterLockStrict ? 'Strict identity' : 'Loose likeness'}
                              </span>
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setCameraFixed((v) => !v)}
                            className={cn(
                              'flex items-center gap-2 px-2.5 py-2 rounded-md text-left transition-all',
                              cameraFixed
                                ? 'bg-primary/15 ring-1 ring-primary/40'
                                : 'bg-glass hover:bg-glass-active',
                            )}
                          >
                            <Camera className={cn('w-3.5 h-3.5', cameraFixed ? 'text-primary' : 'text-muted-foreground')} />
                            <span className="flex-1">
                              <span className="block text-[11px] font-medium text-foreground">Camera</span>
                              <span className="block text-[9px] uppercase tracking-wider text-muted-foreground">
                                {cameraFixed ? 'Locked off' : 'Subtle motion'}
                              </span>
                            </span>
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* Generate Button */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              {generationStep !== 'complete' && (
                <div className="mb-2">
                  <CreditLowInline
                    balance={credits.remaining}
                    required={ESTIMATED_CREDITS * clipCount}
                    context="this training video"
                  />
                </div>
              )}
              {generationStep === 'complete' ? (
                <div className="space-y-2">
                  <Button className="w-full h-10 bg-emerald-500 hover:bg-emerald-600 text-foreground" asChild>
                    <a href={generatedVideoUrl || '#'} download="training-video.mp4">
                      <Download className="w-4 h-4 mr-2" />
                      Download Video
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" className="w-full border-white/20 text-foreground hover:bg-white/10" onClick={handleReset}>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    Create Another
                  </Button>
                </div>
              ) : (
                <Button 
                  className="w-full h-10 bg-emerald-500 hover:bg-emerald-600 text-foreground disabled:bg-white/10 disabled:text-muted-foreground"
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                >
                  {isGenerating ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating…</>
                  ) : (
                    <><Wand2 className="w-4 h-4 mr-2" />Generate Video<Badge className="ml-2 text-xs bg-white/20 text-foreground border-0">{ESTIMATED_CREDITS} cr</Badge></>
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
                  item.ok ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-foreground/80"
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
  usePageMeta({ title: "Training — Small Bridges", description: "Watch in-depth tutorials and creator masterclasses for Small Bridges." });
  const liveRenderTimecode = useLiveRenderTimecode();

  return (
    <ErrorBoundary>
      <FoundationShell>
        <div className="relative mx-auto w-full max-w-[1440px] px-4 pb-24 pt-10 sm:px-6 lg:px-10">
          <EditorialCanvas
            maxWidth="100%"
            chrome={{
              crumbs: ["Small Bridges", "training"],
              timecode: liveRenderTimecode ?? "TRAINING · LIVE",
            }}
          >
            <TrainingVideoContent />
          </EditorialCanvas>
        </div>
      </FoundationShell>
    </ErrorBoundary>
  );
}