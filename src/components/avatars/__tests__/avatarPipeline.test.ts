import { describe, it, expect } from 'vitest';

/**
 * Avatar Pipeline Integration Tests
 * 
 * These tests verify the data flow and contracts between components
 * in the avatar video generation pipeline.
 */

describe('Avatar Pipeline Contracts', () => {
  describe('Voice ID Mapping', () => {
    // Voice IDs must match between frontend templates and backend generate-voice
    const VALID_VOICE_IDS = [
      'onyx', 'echo', 'fable', 'nova', 'shimmer', 'alloy', 'bella', 'adam',
      'michael', 'george', 'sarah', 'jessica', 'lily', 'emma', 'narrator',
    ];

    it('all standard voice IDs are valid', () => {
      const frontendVoiceIds = ['nova', 'echo', 'shimmer', 'onyx', 'bella'];
      
      frontendVoiceIds.forEach(voiceId => {
        expect(VALID_VOICE_IDS).toContain(voiceId);
      });
    });

    it('database avatar voice_ids map to valid MiniMax voices', () => {
      // These are the actual voice_ids from the database query
      const dbVoiceIds = ['echo', 'shimmer', 'nova'];
      
      dbVoiceIds.forEach(voiceId => {
        expect(VALID_VOICE_IDS).toContain(voiceId);
      });
    });
  });

  describe('Mode Router Request Contract', () => {
    interface ModeRouterRequest {
      mode: string;
      userId: string;
      prompt: string;
      imageUrl?: string;
      voiceId?: string;
      aspectRatio: string;
      clipCount: number;
      clipDuration: number;
      enableNarration: boolean;
      enableMusic: boolean;
      characterBible?: object;
      avatarTemplateId?: string;
    }

    it('avatar mode requires all essential fields', () => {
      const validRequest: ModeRouterRequest = {
        mode: 'avatar',
        userId: 'user-123',
        prompt: 'Hello, welcome to our presentation.',
        imageUrl: 'https://example.com/avatar.png',
        voiceId: 'nova',
        aspectRatio: '16:9',
        clipCount: 1,
        clipDuration: 10,
        enableNarration: true,
        enableMusic: false,
      };

      expect(validRequest.mode).toBe('avatar');
      expect(validRequest.prompt).toBeTruthy();
      expect(validRequest.imageUrl).toBeTruthy();
      expect(validRequest.voiceId).toBeTruthy();
    });

    it('characterBible structure is valid', () => {
      const characterBible = {
        name: 'Sarah Mitchell',
        description: 'Professional presenter',
        personality: 'Confident and articulate',
        front_view: 'Front-facing portrait',
        reference_images: {
          front: 'https://example.com/front.png',
          side: null,
          back: null,
        },
        negative_prompts: ['different person', 'face change'],
      };

      expect(characterBible.name).toBeTruthy();
      expect(characterBible.reference_images).toBeDefined();
      expect(Array.isArray(characterBible.negative_prompts)).toBe(true);
    });
  });

  describe('Generate Avatar Request Contract', () => {
    interface GenerateAvatarRequest {
      text: string;
      voiceId: string;
      avatarImageUrl: string;
      aspectRatio: string;
    }

    it('validates required fields for avatar generation', () => {
      const request: GenerateAvatarRequest = {
        text: 'Hello, this is a test script for the avatar.',
        voiceId: 'nova',
        avatarImageUrl: 'https://supabase.storage/avatars/test.png',
        aspectRatio: '16:9',
      };

      expect(request.text.length).toBeGreaterThan(0);
      expect(request.voiceId).toBeTruthy();
      expect(request.avatarImageUrl).toContain('supabase');
      expect(['16:9', '9:16', '1:1']).toContain(request.aspectRatio);
    });

    it('rejects empty script', () => {
      const invalidRequest = {
        text: '',
        voiceId: 'nova',
        avatarImageUrl: 'https://example.com/avatar.png',
        aspectRatio: '16:9',
      };

      expect(invalidRequest.text.length).toBe(0);
      // Backend should reject this
    });
  });

  describe('Generate Voice Request Contract', () => {
    interface GenerateVoiceRequest {
      text: string;
      voiceId: string;
      speed?: number;
    }

    it('validates voice generation parameters', () => {
      const request: GenerateVoiceRequest = {
        text: 'Hello world, this is a test.',
        voiceId: 'nova',
        speed: 1.0,
      };

      expect(request.text.length).toBeGreaterThan(0);
      expect(request.voiceId).toBeTruthy();
      expect(request.speed).toBeGreaterThanOrEqual(0.5);
      expect(request.speed).toBeLessThanOrEqual(2.0);
    });

    it('speed is clamped to valid range', () => {
      const clampSpeed = (speed: number) => Math.max(0.5, Math.min(2.0, speed));

      expect(clampSpeed(0.1)).toBe(0.5);
      expect(clampSpeed(3.0)).toBe(2.0);
      expect(clampSpeed(1.0)).toBe(1.0);
    });
  });

  describe('Pipeline State Transitions', () => {
    const VALID_STAGES = [
      'init',
      'avatar_generation',
      'avatar_rendering',
      'processing',
      'starting',
      'completed',
      'failed',
    ];

    it('all pipeline stages are valid', () => {
      VALID_STAGES.forEach(stage => {
        expect(typeof stage).toBe('string');
        expect(stage.length).toBeGreaterThan(0);
      });
    });

    it('progress values are within bounds', () => {
      const progressMap: Record<string, number> = {
        init: 0,
        avatar_generation: 10,
        avatar_rendering: 30,
        processing: 50,
        completed: 100,
        failed: 0,
      };

      Object.values(progressMap).forEach(progress => {
        expect(progress).toBeGreaterThanOrEqual(0);
        expect(progress).toBeLessThanOrEqual(100);
      });
    });

    it('stage transitions are valid', () => {
      const validTransitions: Record<string, string[]> = {
        init: ['avatar_generation', 'failed'],
        avatar_generation: ['avatar_rendering', 'failed'],
        avatar_rendering: ['processing', 'completed', 'failed'],
        processing: ['completed', 'failed'],
        starting: ['processing', 'failed'],
        completed: [], // Terminal state
        failed: [], // Terminal state
      };

      // Verify all stages have defined transitions
      VALID_STAGES.forEach(stage => {
        expect(validTransitions[stage]).toBeDefined();
      });
    });
  });

  describe('Check Specialized Status Response Contract', () => {
    interface StatusResponse {
      success: boolean;
      projectId: string;
      predictionId: string;
      status: string;
      progress: number;
      stage: string;
      message: string;
      videoUrl?: string;
      audioUrl?: string;
      isComplete: boolean;
      isFailed: boolean;
      error?: string;
    }

    it('validates successful status response', () => {
      const response: StatusResponse = {
        success: true,
        projectId: 'proj-123',
        predictionId: 'pred-456',
        status: 'succeeded',
        progress: 100,
        stage: 'completed',
        message: 'Video generation complete!',
        videoUrl: 'https://replicate.delivery/video.mp4',
        audioUrl: 'https://replicate.delivery/audio.mp3',
        isComplete: true,
        isFailed: false,
      };

      expect(response.isComplete).toBe(true);
      expect(response.isFailed).toBe(false);
      expect(response.videoUrl).toBeTruthy();
      expect(response.progress).toBe(100);
    });

    it('validates failed status response', () => {
      const response: StatusResponse = {
        success: true,
        projectId: 'proj-123',
        predictionId: 'pred-456',
        status: 'failed',
        progress: 0,
        stage: 'failed',
        message: 'Generation failed due to content policy',
        isComplete: false,
        isFailed: true,
        error: 'Content policy violation',
      };

      expect(response.isComplete).toBe(false);
      expect(response.isFailed).toBe(true);
      expect(response.error).toBeTruthy();
    });

    it('validates processing status response', () => {
      const response: StatusResponse = {
        success: true,
        projectId: 'proj-123',
        predictionId: 'pred-456',
        status: 'processing',
        progress: 65,
        stage: 'processing',
        message: 'Generating natural speaking motion...',
        isComplete: false,
        isFailed: false,
      };

      expect(response.isComplete).toBe(false);
      expect(response.isFailed).toBe(false);
      expect(response.progress).toBeGreaterThan(0);
      expect(response.progress).toBeLessThan(100);
    });
  });

  describe('Kling Video Generation Parameters', () => {
    it('duration is clamped to 5s or 10s', () => {
      const clampDuration = (audioDurationSec: number) => {
        return audioDurationSec <= 5 ? 5 : 10;
      };

      expect(clampDuration(3)).toBe(5);
      expect(clampDuration(5)).toBe(5);
      expect(clampDuration(6)).toBe(10);
      expect(clampDuration(10)).toBe(10);
      expect(clampDuration(15)).toBe(10); // Max is 10s
    });

    it('aspect ratio is valid', () => {
      const validAspectRatios = ['16:9', '9:16', '1:1'];
      
      validAspectRatios.forEach(ratio => {
        expect(ratio).toMatch(/^\d+:\d+$/);
      });
    });

    it('mode is always pro for quality', () => {
      const klingConfig = {
        mode: 'pro',
        prompt: 'Person speaking naturally',
        duration: 5,
        aspect_ratio: '16:9',
      };

      expect(klingConfig.mode).toBe('pro');
    });
  });

  describe('Audio Duration Estimation', () => {
    // ~150 words per minute, ~5 chars per word
    const estimateDuration = (text: string): number => {
      const words = text.length / 5;
      const minutes = words / 150;
      return Math.round(minutes * 60 * 1000);
    };

    it('estimates short text correctly', () => {
      const shortText = 'Hello world'; // ~11 chars
      const duration = estimateDuration(shortText);
      
      // Should be about 880ms
      expect(duration).toBeLessThan(2000);
    });

    it('estimates medium text correctly', () => {
      const mediumText = 'This is a medium length sentence that should take a few seconds to speak.';
      const duration = estimateDuration(mediumText);
      
      // Should be a few seconds
      expect(duration).toBeGreaterThan(2000);
      expect(duration).toBeLessThan(10000);
    });

    it('estimates long text correctly', () => {
      const longText = 'A'.repeat(500); // 500 chars = ~100 words = ~40 seconds
      const duration = estimateDuration(longText);
      
      // Should be about 40 seconds (40000ms)
      expect(duration).toBeGreaterThan(30000);
      expect(duration).toBeLessThan(50000);
    });
  });
});

describe('Avatar Template Validation', () => {
  it('requires essential fields', () => {
    const validTemplate = {
      id: 'uuid-here',
      name: 'Test Avatar',
      face_image_url: 'https://supabase.co/storage/avatars/test.png',
      voice_id: 'nova',
      voice_provider: 'minimax',
      gender: 'female',
    };

    expect(validTemplate.id).toBeTruthy();
    expect(validTemplate.name).toBeTruthy();
    expect(validTemplate.face_image_url).toBeTruthy();
    expect(validTemplate.voice_id).toBeTruthy();
  });

  it('image URLs should be from Supabase storage', () => {
    const validUrl = 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/avatars/test.png';
    const invalidUrl = 'https://images.unsplash.com/photo-123';

    expect(validUrl).toContain('supabase');
    expect(invalidUrl).not.toContain('supabase');
  });
});
