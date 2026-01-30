import { useState, useCallback, useRef, useEffect } from 'react';
import { AvatarTemplate } from '@/types/avatar-templates';

interface VoiceCacheEntry {
  audioUrl: string;
  timestamp: number;
  preloaded?: boolean;
}

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes cache
const PRELOAD_BATCH_SIZE = 5;
const PRELOAD_DELAY_MS = 500;

/**
 * Hook for managing avatar voice samples with smart caching and preloading.
 * 
 * Features:
 * - Uses pre-generated sample_audio_url when available (instant playback)
 * - Falls back to on-demand generation
 * - Caches generated samples in memory
 * - Preloads voices for visible avatars in the background
 */
export function useAvatarVoices() {
  const [voiceCache, setVoiceCache] = useState<Record<string, VoiceCacheEntry>>({});
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [preloadingQueue, setPreloadingQueue] = useState<string[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const preloadControllerRef = useRef<AbortController | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (preloadControllerRef.current) {
        preloadControllerRef.current.abort();
      }
    };
  }, []);

  // Check if cache entry is still valid
  const isCacheValid = useCallback((entry: VoiceCacheEntry | undefined): entry is VoiceCacheEntry => {
    if (!entry) return false;
    return Date.now() - entry.timestamp < CACHE_TTL_MS;
  }, []);

  // Get cached audio URL or sample_audio_url
  const getCachedAudio = useCallback((avatar: AvatarTemplate): string | null => {
    // Priority 1: Pre-generated sample audio (instant)
    if (avatar.sample_audio_url) {
      return avatar.sample_audio_url;
    }
    
    // Priority 2: Cached generated audio
    const cached = voiceCache[avatar.id];
    if (isCacheValid(cached)) {
      return cached.audioUrl;
    }
    
    return null;
  }, [voiceCache, isCacheValid]);

  // Generate voice sample
  const generateVoiceSample = useCallback(async (
    avatar: AvatarTemplate,
    signal?: AbortSignal
  ): Promise<string | null> => {
    const sampleText = `Hello, I'm ${avatar.name}. ${avatar.description || "I'm ready to help you create amazing videos."}`;
    
    try {
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
          signal,
        }
      );
      
      if (!response.ok) {
        throw new Error('Voice generation failed');
      }
      
      const data = await response.json();
      
      if (data.success && data.audioUrl) {
        return data.audioUrl;
      }
      
      return null;
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        console.log('[Voice] Request aborted');
        return null;
      }
      console.error('[Voice] Generation error:', err);
      return null;
    }
  }, []);

  // Play voice preview
  const playVoicePreview = useCallback(async (avatar: AvatarTemplate): Promise<boolean> => {
    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    setPreviewingVoice(avatar.id);
    
    try {
      // Check cache first
      let audioUrl = getCachedAudio(avatar);
      
      // If not cached, generate
      if (!audioUrl) {
        audioUrl = await generateVoiceSample(avatar);
        
        if (audioUrl) {
          // Cache the result
          setVoiceCache(prev => ({
            ...prev,
            [avatar.id]: {
              audioUrl,
              timestamp: Date.now(),
            },
          }));
        }
      }
      
      if (!audioUrl) {
        throw new Error('Failed to get audio');
      }
      
      // Play the audio
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      // Wait for audio to be ready
      await new Promise<void>((resolve, reject) => {
        audio.oncanplaythrough = () => resolve();
        audio.onerror = () => reject(new Error('Audio load failed'));
        audio.load();
      });
      
      await audio.play();
      
      // Clear previewing state when done
      audio.onended = () => {
        setPreviewingVoice(null);
        audioRef.current = null;
      };
      
      return true;
    } catch (err) {
      console.error('[Voice] Playback error:', err);
      setPreviewingVoice(null);
      return false;
    }
  }, [getCachedAudio, generateVoiceSample]);

  // Preload voices for visible avatars
  const preloadVoices = useCallback(async (avatars: AvatarTemplate[]) => {
    // Cancel any existing preload operation
    if (preloadControllerRef.current) {
      preloadControllerRef.current.abort();
    }
    
    const controller = new AbortController();
    preloadControllerRef.current = controller;
    
    // Filter to avatars that need preloading
    const toPreload = avatars.filter(avatar => {
      // Skip if already has sample_audio_url
      if (avatar.sample_audio_url) return false;
      // Skip if already cached
      if (isCacheValid(voiceCache[avatar.id])) return false;
      // Skip if already in queue
      if (preloadingQueue.includes(avatar.id)) return false;
      return true;
    }).slice(0, PRELOAD_BATCH_SIZE);
    
    if (toPreload.length === 0) return;
    
    setPreloadingQueue(prev => [...prev, ...toPreload.map(a => a.id)]);
    
    // Stagger preloading to avoid overwhelming the API
    for (const avatar of toPreload) {
      if (controller.signal.aborted) break;
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, PRELOAD_DELAY_MS));
      
      if (controller.signal.aborted) break;
      
      const audioUrl = await generateVoiceSample(avatar, controller.signal);
      
      if (audioUrl && !controller.signal.aborted) {
        setVoiceCache(prev => ({
          ...prev,
          [avatar.id]: {
            audioUrl,
            timestamp: Date.now(),
            preloaded: true,
          },
        }));
      }
      
      // Remove from queue
      setPreloadingQueue(prev => prev.filter(id => id !== avatar.id));
    }
  }, [voiceCache, preloadingQueue, isCacheValid, generateVoiceSample]);

  // Check if voice is ready (cached or has sample_audio_url)
  const isVoiceReady = useCallback((avatar: AvatarTemplate): boolean => {
    if (avatar.sample_audio_url) return true;
    return isCacheValid(voiceCache[avatar.id]);
  }, [voiceCache, isCacheValid]);

  // Stop current playback
  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPreviewingVoice(null);
  }, []);

  return {
    playVoicePreview,
    preloadVoices,
    isVoiceReady,
    stopPlayback,
    previewingVoice,
    isPreloading: preloadingQueue.length > 0,
    cacheSize: Object.keys(voiceCache).length,
  };
}
