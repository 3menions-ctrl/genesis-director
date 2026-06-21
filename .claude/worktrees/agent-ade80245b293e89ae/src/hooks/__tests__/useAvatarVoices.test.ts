import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAvatarVoices } from '../useAvatarVoices';
import { AvatarTemplate } from '@/types/avatar-templates';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock Audio
const mockAudioPlay = vi.fn().mockResolvedValue(undefined);
const mockAudioPause = vi.fn();

class MockAudio {
  src = '';
  onended: (() => void) | null = null;
  oncanplaythrough: (() => void) | null = null;
  onerror: (() => void) | null = null;
  
  play = mockAudioPlay;
  pause = mockAudioPause;
  load = () => {
    // Immediately trigger canplaythrough
    setTimeout(() => this.oncanplaythrough?.(), 0);
  };
}

global.Audio = MockAudio as any;

// Helper to create a complete mock avatar
const createMockAvatar = (overrides: Partial<AvatarTemplate> = {}): AvatarTemplate => ({
  id: 'test-avatar-1',
  name: 'Test Avatar',
  description: 'A test avatar for unit testing',
  personality: 'Professional and friendly',
  gender: 'female',
  age_range: '25-35',
  ethnicity: null,
  style: 'corporate',
  avatar_type: 'realistic',
  face_image_url: 'https://example.com/face.png',
  thumbnail_url: null,
  front_image_url: 'https://example.com/front.png',
  side_image_url: null,
  back_image_url: null,
  character_bible: null,
  voice_id: 'nova',
  voice_provider: 'minimax',
  voice_name: 'Nova',
  voice_description: 'Confident female voice',
  sample_audio_url: null,
  tags: ['corporate', 'professional'],
  use_count: 0,
  is_active: true,
  is_premium: false,
  sort_order: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

// Sample avatars for testing
const mockAvatar = createMockAvatar();

const mockAvatarWithSample = createMockAvatar({
  id: 'test-avatar-2',
  name: 'Avatar With Sample',
  sample_audio_url: 'https://example.com/sample.mp3',
});

describe('useAvatarVoices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('isVoiceReady', () => {
    it('returns true for avatars with sample_audio_url', () => {
      const { result } = renderHook(() => useAvatarVoices());
      expect(result.current.isVoiceReady(mockAvatarWithSample)).toBe(true);
    });

    it('returns false for avatars without sample_audio_url and no cache', () => {
      const { result } = renderHook(() => useAvatarVoices());
      expect(result.current.isVoiceReady(mockAvatar)).toBe(false);
    });
  });

  describe('playVoicePreview', () => {
    it('uses sample_audio_url when available (no fetch call)', async () => {
      const { result } = renderHook(() => useAvatarVoices());
      
      await act(async () => {
        await result.current.playVoicePreview(mockAvatarWithSample);
      });
      
      // Should not call fetch since sample_audio_url is available
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('calls generate-voice API when no sample_audio_url exists', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          audioUrl: 'https://generated.audio/voice.mp3',
        }),
      });

      const { result } = renderHook(() => useAvatarVoices());
      
      await act(async () => {
        await result.current.playVoicePreview(mockAvatar);
      });
      
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/functions/v1/generate-voice'),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('includes correct voice_id in API request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          audioUrl: 'https://generated.audio/voice.mp3',
        }),
      });

      const { result } = renderHook(() => useAvatarVoices());
      
      await act(async () => {
        await result.current.playVoicePreview(mockAvatar);
      });
      
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.voiceId).toBe('nova');
    });

    it('returns false when voice generation fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const { result } = renderHook(() => useAvatarVoices());
      
      let success = true;
      await act(async () => {
        success = await result.current.playVoicePreview(mockAvatar);
      });
      
      expect(success).toBe(false);
    });
  });

  describe('stopPlayback', () => {
    it('is a callable function', () => {
      const { result } = renderHook(() => useAvatarVoices());
      expect(typeof result.current.stopPlayback).toBe('function');
    });
  });

  describe('preloadVoices', () => {
    it('is a callable function', () => {
      const { result } = renderHook(() => useAvatarVoices());
      expect(typeof result.current.preloadVoices).toBe('function');
    });

    it('does not call API for avatars with sample_audio_url', async () => {
      const { result } = renderHook(() => useAvatarVoices());
      
      await act(async () => {
        result.current.preloadVoices([mockAvatarWithSample]);
      });
      
      // Should not make any immediate fetch calls
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('caching behavior', () => {
    it('caches generated audio URLs for reuse', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          audioUrl: 'https://generated.audio/voice.mp3',
        }),
      });

      const { result } = renderHook(() => useAvatarVoices());
      
      // First call - should generate
      await act(async () => {
        await result.current.playVoicePreview(mockAvatar);
      });
      
      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      // Second call - should use cache
      await act(async () => {
        await result.current.playVoicePreview(mockAvatar);
      });
      
      // Should still be 1 call (cached)
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('hook return values', () => {
    it('returns all expected properties', () => {
      const { result } = renderHook(() => useAvatarVoices());
      
      expect(result.current).toHaveProperty('playVoicePreview');
      expect(result.current).toHaveProperty('preloadVoices');
      expect(result.current).toHaveProperty('isVoiceReady');
      expect(result.current).toHaveProperty('stopPlayback');
      expect(result.current).toHaveProperty('previewingVoice');
      expect(result.current).toHaveProperty('isPreloading');
      expect(result.current).toHaveProperty('cacheSize');
    });

    it('initializes with correct default values', () => {
      const { result } = renderHook(() => useAvatarVoices());
      
      expect(result.current.previewingVoice).toBeNull();
      expect(result.current.isPreloading).toBe(false);
      expect(result.current.cacheSize).toBe(0);
    });
  });
});
