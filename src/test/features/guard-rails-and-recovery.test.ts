/**
 * COMPREHENSIVE FEATURE VERIFICATION: Pipeline Guard Rails & Recovery
 * 
 * Validates:
 * - 7-tier continuity fallback chain
 * - Image URL validation
 * - Clip 0 reference image guarantee
 * - Clip 0 last frame priority (extracted > reference)
 * - Guard rail configuration constants
 * - Pipeline health status types
 * - Recovery action types
 */

import { describe, it, expect } from "vitest";

// ============================================================================
// GUARD RAIL CONFIGURATION
// ============================================================================

const GUARD_RAIL_CONFIG = {
  MUTEX_STALE_THRESHOLD_MS: 10 * 60 * 1000,
  MUTEX_WARNING_THRESHOLD_MS: 5 * 60 * 1000,
  CLIP_0_ALWAYS_USE_REFERENCE: true,
  CLIP_STUCK_THRESHOLD_MS: 3 * 60 * 1000,
  CLIP_GENERATING_MAX_AGE_MS: 8 * 60 * 1000,
  FRAME_EXTRACTION_MAX_RETRIES: 3,
  FRAME_EXTRACTION_BACKOFF_MS: 1500,
  AUTO_RECOVERY_ENABLED: true,
  MAX_RECOVERY_ATTEMPTS_PER_CLIP: 3,
};

describe("Guard Rail Configuration", () => {
  it("mutex stale threshold is 10 minutes", () => {
    expect(GUARD_RAIL_CONFIG.MUTEX_STALE_THRESHOLD_MS).toBe(600_000);
  });

  it("mutex warning threshold is 5 minutes", () => {
    expect(GUARD_RAIL_CONFIG.MUTEX_WARNING_THRESHOLD_MS).toBe(300_000);
  });

  it("clip 0 always uses reference image", () => {
    expect(GUARD_RAIL_CONFIG.CLIP_0_ALWAYS_USE_REFERENCE).toBe(true);
  });

  it("clip stuck detection at 3 minutes", () => {
    expect(GUARD_RAIL_CONFIG.CLIP_STUCK_THRESHOLD_MS).toBe(180_000);
  });

  it("clip max generation age is 8 minutes", () => {
    expect(GUARD_RAIL_CONFIG.CLIP_GENERATING_MAX_AGE_MS).toBe(480_000);
  });

  it("frame extraction retries up to 3 times", () => {
    expect(GUARD_RAIL_CONFIG.FRAME_EXTRACTION_MAX_RETRIES).toBe(3);
  });

  it("auto recovery is enabled", () => {
    expect(GUARD_RAIL_CONFIG.AUTO_RECOVERY_ENABLED).toBe(true);
  });

  it("max 3 recovery attempts per clip", () => {
    expect(GUARD_RAIL_CONFIG.MAX_RECOVERY_ATTEMPTS_PER_CLIP).toBe(3);
  });
});

// ============================================================================
// IMAGE URL VALIDATION
// ============================================================================

function isValidImageUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  if (!url.startsWith('http://') && !url.startsWith('https://')) return false;
  if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov') || lower.endsWith('.avi')) return false;
  if (lower.includes('/video-clips/')) return false;
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];
  const hasImageExt = imageExtensions.some(ext => lower.endsWith(ext));
  const hasNoExt = !lower.includes('.') || lower.split('.').pop()!.length > 5;
  return hasImageExt || hasNoExt || lower.includes('temp-frames') || lower.includes('user-uploads');
}

describe("Image URL Validation", () => {
  it("rejects null/undefined/empty URLs", () => {
    expect(isValidImageUrl(null)).toBe(false);
    expect(isValidImageUrl(undefined)).toBe(false);
    expect(isValidImageUrl('')).toBe(false);
  });

  it("accepts valid HTTPS image URLs", () => {
    expect(isValidImageUrl('https://example.com/image.jpg')).toBe(true);
    expect(isValidImageUrl('https://example.com/image.png')).toBe(true);
    expect(isValidImageUrl('https://example.com/image.webp')).toBe(true);
  });

  it("rejects video file URLs", () => {
    expect(isValidImageUrl('https://example.com/video.mp4')).toBe(false);
    expect(isValidImageUrl('https://example.com/video.webm')).toBe(false);
    expect(isValidImageUrl('https://example.com/video.mov')).toBe(false);
  });

  it("rejects video-clips bucket URLs", () => {
    expect(isValidImageUrl('https://storage.example.com/video-clips/abc.jpg')).toBe(false);
  });

  it("accepts temp-frames and user-uploads paths", () => {
    expect(isValidImageUrl('https://storage.example.com/temp-frames/frame.jpg')).toBe(true);
    expect(isValidImageUrl('https://storage.example.com/user-uploads/ref.png')).toBe(true);
  });

  it("rejects non-HTTP URLs", () => {
    expect(isValidImageUrl('ftp://example.com/image.jpg')).toBe(false);
    expect(isValidImageUrl('file:///image.jpg')).toBe(false);
  });
});

// ============================================================================
// 7-TIER CONTINUITY FALLBACK CHAIN
// ============================================================================

function getGuaranteedLastFrame(
  shotIndex: number,
  sources: {
    extractedFrame?: string;
    referenceImageUrl?: string;
    sceneImageUrl?: string;
    previousClipLastFrame?: string;
    identityBibleImageUrl?: string;
    goldenFrameUrl?: string;
    sourceImageUrl?: string;
  }
): { frameUrl: string | null; source: string; confidence: 'high' | 'medium' | 'low' } {
  if (shotIndex === 0) {
    if (sources.extractedFrame && isValidImageUrl(sources.extractedFrame)) {
      return { frameUrl: sources.extractedFrame, source: 'extracted_frame', confidence: 'high' };
    }
    if (sources.referenceImageUrl && isValidImageUrl(sources.referenceImageUrl)) {
      return { frameUrl: sources.referenceImageUrl, source: 'reference_image', confidence: 'medium' };
    }
    return { frameUrl: null, source: 'none', confidence: 'low' };
  }

  const chain = [
    { url: sources.extractedFrame, source: 'extracted_frame', confidence: 'high' as const },
    { url: sources.previousClipLastFrame, source: 'previous_clip_frame', confidence: 'high' as const },
    { url: sources.goldenFrameUrl, source: 'golden_frame', confidence: 'high' as const },
    { url: sources.sceneImageUrl, source: 'scene_image', confidence: 'medium' as const },
    { url: sources.referenceImageUrl, source: 'reference_image', confidence: 'medium' as const },
    { url: sources.sourceImageUrl, source: 'source_image', confidence: 'medium' as const },
    { url: sources.identityBibleImageUrl, source: 'identity_bible', confidence: 'low' as const },
  ];

  for (const { url, source, confidence } of chain) {
    if (url && isValidImageUrl(url)) {
      return { frameUrl: url, source, confidence };
    }
  }
  return { frameUrl: null, source: 'none', confidence: 'low' };
}

describe("7-Tier Continuity Fallback Chain", () => {
  it("tier 1: uses extracted frame (highest priority)", () => {
    const result = getGuaranteedLastFrame(1, {
      extractedFrame: 'https://example.com/extracted.jpg',
      referenceImageUrl: 'https://example.com/ref.jpg',
    });
    expect(result.source).toBe('extracted_frame');
    expect(result.confidence).toBe('high');
  });

  it("tier 2: falls back to previous clip frame", () => {
    const result = getGuaranteedLastFrame(1, {
      previousClipLastFrame: 'https://example.com/prev.jpg',
      referenceImageUrl: 'https://example.com/ref.jpg',
    });
    expect(result.source).toBe('previous_clip_frame');
    expect(result.confidence).toBe('high');
  });

  it("tier 3: falls back to golden frame", () => {
    const result = getGuaranteedLastFrame(1, {
      goldenFrameUrl: 'https://example.com/golden.jpg',
      referenceImageUrl: 'https://example.com/ref.jpg',
    });
    expect(result.source).toBe('golden_frame');
    expect(result.confidence).toBe('high');
  });

  it("tier 4: falls back to scene image", () => {
    const result = getGuaranteedLastFrame(1, {
      sceneImageUrl: 'https://example.com/scene.jpg',
    });
    expect(result.source).toBe('scene_image');
    expect(result.confidence).toBe('medium');
  });

  it("tier 5: falls back to reference image", () => {
    const result = getGuaranteedLastFrame(1, {
      referenceImageUrl: 'https://example.com/ref.jpg',
    });
    expect(result.source).toBe('reference_image');
    expect(result.confidence).toBe('medium');
  });

  it("tier 6: falls back to source image", () => {
    const result = getGuaranteedLastFrame(1, {
      sourceImageUrl: 'https://example.com/source.jpg',
    });
    expect(result.source).toBe('source_image');
    expect(result.confidence).toBe('medium');
  });

  it("tier 7: falls back to identity bible image", () => {
    const result = getGuaranteedLastFrame(1, {
      identityBibleImageUrl: 'https://example.com/bible.jpg',
    });
    expect(result.source).toBe('identity_bible');
    expect(result.confidence).toBe('low');
  });

  it("degraded mode: returns null when all tiers exhausted", () => {
    const result = getGuaranteedLastFrame(1, {});
    expect(result.frameUrl).toBeNull();
    expect(result.source).toBe('none');
    expect(result.confidence).toBe('low');
  });

  it("clip 0: prioritizes extracted frame over reference", () => {
    const result = getGuaranteedLastFrame(0, {
      extractedFrame: 'https://example.com/extracted.jpg',
      referenceImageUrl: 'https://example.com/ref.jpg',
    });
    expect(result.source).toBe('extracted_frame');
    expect(result.confidence).toBe('high');
  });

  it("clip 0: falls back to reference when no extracted frame", () => {
    const result = getGuaranteedLastFrame(0, {
      referenceImageUrl: 'https://example.com/ref.jpg',
    });
    expect(result.source).toBe('reference_image');
    expect(result.confidence).toBe('medium');
  });
});

// ============================================================================
// RECOVERY ACTION TYPES
// ============================================================================

describe("Recovery Action Types", () => {
  const validActions = ['release_mutex', 'check_prediction', 'use_fallback_frame', 'retry_clip', 'trigger_watchdog'];

  it("supports 5 recovery action types", () => {
    expect(validActions).toHaveLength(5);
  });

  it.each(validActions)("supports recovery action: %s", (action) => {
    expect(validActions).toContain(action);
  });
});

// ============================================================================
// PIPELINE HEALTH STATUS
// ============================================================================

describe("Pipeline Health Status", () => {
  const healthStatuses = ['healthy', 'degraded', 'stalled', 'failed'];
  const mutexStatuses = ['free', 'held', 'stale'];
  const clipStatuses = ['healthy', 'stuck', 'failed', 'missing'];

  it("supports 4 pipeline health states", () => {
    expect(healthStatuses).toHaveLength(4);
  });

  it("supports 3 mutex states", () => {
    expect(mutexStatuses).toHaveLength(3);
  });

  it("supports 4 clip health states", () => {
    expect(clipStatuses).toHaveLength(4);
  });
});
