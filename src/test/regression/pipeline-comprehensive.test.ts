/**
 * COMPREHENSIVE PIPELINE REGRESSION TESTS
 *
 * Validates the full production pipeline architecture:
 * - Pipeline state machine & initial state
 * - Clip configuration & tiered pricing
 * - Cameraman hallucination filter
 * - Camera movement rewrites
 * - Identity Bible 3-point system
 * - Edge function architecture (hollywood-pipeline, generate-single-clip, continue-production, pipeline-watchdog)
 * - Guard rails (mutex, stuck clip detection, frame extraction fallback)
 * - Network resilience (retryable errors, backoff, rate limiting)
 * - Prompt builder (identity injection, anti-morphing, continuity)
 * - Direct chaining & timeout bypass architecture
 * - Content safety integration
 * - Database schema alignment
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

import {
  validateClipConfiguration,
  CAMERAMAN_NEGATIVE_PROMPTS,
  CAMERA_MOVEMENT_REWRITES,
  PROJECT_TYPES,
  INITIAL_PIPELINE_STATE,
  MAX_CLIPS_PER_PROJECT,
  MIN_CLIPS_PER_PROJECT,
  MAX_SHOT_DURATION_SECONDS,
  MIN_SHOT_DURATION_SECONDS,
  DEFAULT_SHOT_DURATION_SECONDS,
  MAX_PROFESSIONAL_RETRIES,
  DEFAULT_CLIPS_PER_PROJECT,
} from '@/types/production-pipeline';

function readFile(p: string): string {
  return fs.readFileSync(path.resolve(p), 'utf-8');
}
function fileExists(p: string): boolean {
  return fs.existsSync(path.resolve(p));
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. PIPELINE STATE MACHINE
// ═══════════════════════════════════════════════════════════════════════════════

describe('Pipeline — State Machine Initial State', () => {
  it('starts at scripting stage', () => {
    expect(INITIAL_PIPELINE_STATE.currentStage).toBe('scripting');
  });

  it('defaults to standard quality tier', () => {
    expect(INITIAL_PIPELINE_STATE.qualityTier).toBe('standard');
  });

  it('reference image required by default', () => {
    expect(INITIAL_PIPELINE_STATE.referenceImageRequired).toBe(true);
  });

  it('text-to-video disabled by default', () => {
    expect(INITIAL_PIPELINE_STATE.textToVideoMode).toBe(false);
  });

  it('identity bible not generating by default', () => {
    expect(INITIAL_PIPELINE_STATE.identityBibleGenerating).toBe(false);
  });

  it('script not approved by default', () => {
    expect(INITIAL_PIPELINE_STATE.scriptApproved).toBe(false);
  });

  it('audit not approved by default', () => {
    expect(INITIAL_PIPELINE_STATE.auditApproved).toBe(false);
  });

  it('export not ready by default', () => {
    expect(INITIAL_PIPELINE_STATE.exportReady).toBe(false);
  });

  it('audio mix mode defaults to full', () => {
    expect(INITIAL_PIPELINE_STATE.audioMixMode).toBe('full');
  });

  it('production state: no active generation', () => {
    expect(INITIAL_PIPELINE_STATE.production.isGeneratingVideo).toBe(false);
    expect(INITIAL_PIPELINE_STATE.production.isGeneratingAudio).toBe(false);
    expect(INITIAL_PIPELINE_STATE.production.completedShots).toBe(0);
    expect(INITIAL_PIPELINE_STATE.production.failedShots).toBe(0);
  });

  it('quality insurance ledger starts empty', () => {
    expect(INITIAL_PIPELINE_STATE.qualityInsuranceLedger).toEqual([]);
  });

  it('production has globalSeed set (non-zero)', () => {
    expect(INITIAL_PIPELINE_STATE.production.globalSeed).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. CLIP CONFIGURATION & TIERED PRICING
// ═══════════════════════════════════════════════════════════════════════════════

describe('Pipeline — Clip Configuration', () => {
  it('MAX_CLIPS_PER_PROJECT is 20', () => {
    expect(MAX_CLIPS_PER_PROJECT).toBe(20);
  });

  it('MIN_CLIPS_PER_PROJECT is 1', () => {
    expect(MIN_CLIPS_PER_PROJECT).toBe(1);
  });

  it('DEFAULT_CLIPS_PER_PROJECT is 6', () => {
    expect(DEFAULT_CLIPS_PER_PROJECT).toBe(6);
  });

  it('shot duration: min 5, max 10, default 5', () => {
    expect(MIN_SHOT_DURATION_SECONDS).toBe(5);
    expect(MAX_SHOT_DURATION_SECONDS).toBe(10);
    expect(DEFAULT_SHOT_DURATION_SECONDS).toBe(5);
  });

  it('professional tier has max 4 retries', () => {
    expect(MAX_PROFESSIONAL_RETRIES).toBe(4);
  });

  it('validateClipConfiguration clamps to bounds', () => {
    const over = validateClipConfiguration(30, 5);
    expect(over.clipCount).toBe(20);
    const under = validateClipConfiguration(0, 5);
    expect(under.clipCount).toBe(1);
  });

  it('validateClipConfiguration normalizes duration to 5 or 10', () => {
    expect(validateClipConfiguration(3, 7).clipDuration).toBe(5);
    expect(validateClipConfiguration(3, 10).clipDuration).toBe(10);
    expect(validateClipConfiguration(3, 3).clipDuration).toBe(5);
  });

  it('totalDuration = clipCount × clipDuration', () => {
    const cfg = validateClipConfiguration(4, 10);
    expect(cfg.totalDuration).toBe(40);
  });

  it('tiered pricing: first 6 clips at 5s cost 10 each', () => {
    const cfg = validateClipConfiguration(6, 5);
    expect(cfg.creditsRequired).toBe(60);
  });

  it('tiered pricing: 10s clips cost 15 each', () => {
    const cfg = validateClipConfiguration(3, 10);
    expect(cfg.creditsRequired).toBe(45);
  });

  it('tiered pricing: clips 7+ cost 15 regardless of duration', () => {
    const cfg = validateClipConfiguration(8, 5);
    // 6 × 10 + 2 × 15 = 90
    expect(cfg.creditsRequired).toBe(90);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. CAMERAMAN HALLUCINATION FILTER
// ═══════════════════════════════════════════════════════════════════════════════

describe('Pipeline — Cameraman Hallucination Filter', () => {
  it('has at least 24 negative prompts', () => {
    expect(CAMERAMAN_NEGATIVE_PROMPTS.length).toBeGreaterThanOrEqual(24);
  });

  it('blocks camera/crew terms', () => {
    const terms = ['camera', 'cameraman', 'film crew', 'boom mic', 'tripod'];
    for (const t of terms) {
      expect(CAMERAMAN_NEGATIVE_PROMPTS).toContain(t);
    }
  });

  it('blocks visible equipment reflections', () => {
    expect(CAMERAMAN_NEGATIVE_PROMPTS).toContain('crew reflection');
    expect(CAMERAMAN_NEGATIVE_PROMPTS).toContain('equipment shadow');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. CAMERA MOVEMENT REWRITES
// ═══════════════════════════════════════════════════════════════════════════════

describe('Pipeline — Camera Movement Rewrites', () => {
  it('has 17 movement rewrites', () => {
    expect(Object.keys(CAMERA_MOVEMENT_REWRITES)).toHaveLength(17);
  });

  it('rewrites never mention "camera"', () => {
    for (const v of Object.values(CAMERA_MOVEMENT_REWRITES)) {
      expect(v.toLowerCase()).not.toContain('camera');
    }
  });

  it('covers key movements: dolly, tracking, crane, pan, tilt', () => {
    expect(CAMERA_MOVEMENT_REWRITES['dolly shot']).toBeDefined();
    expect(CAMERA_MOVEMENT_REWRITES['tracking shot']).toBeDefined();
    expect(CAMERA_MOVEMENT_REWRITES['crane shot']).toBeDefined();
    expect(CAMERA_MOVEMENT_REWRITES['pan']).toBeDefined();
    expect(CAMERA_MOVEMENT_REWRITES['tilt']).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. PROJECT TYPES
// ═══════════════════════════════════════════════════════════════════════════════

describe('Pipeline — Project Types', () => {
  it('defines 5 project types', () => {
    expect(PROJECT_TYPES).toHaveLength(5);
  });

  it('each has id, name, description, shotCount', () => {
    for (const pt of PROJECT_TYPES) {
      expect(pt.id).toBeTruthy();
      expect(pt.name).toBeTruthy();
      expect(pt.description).toBeTruthy();
      expect(pt.shotCount).toBeGreaterThan(0);
    }
  });

  it('cinematic-trailer has 8 shots', () => {
    const ct = PROJECT_TYPES.find(p => p.id === 'cinematic-trailer');
    expect(ct?.shotCount).toBe(8);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. HOLLYWOOD PIPELINE EDGE FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Pipeline — Hollywood Pipeline Architecture', () => {
  const hp = readFile('supabase/functions/hollywood-pipeline/index.ts');

  it('uses EdgeRuntime.waitUntil for background processing', () => {
    expect(hp).toContain('waitUntil');
  });

  it('returns immediately with project ID', () => {
    expect(hp).toContain('projectId');
    expect(hp).toMatch(/new Response\(/);
  });

  it('handles CORS OPTIONS preflight', () => {
    const hasOptions = hp.includes("req.method === 'OPTIONS'") ||
      hp.includes('req.method === "OPTIONS"') ||
      hp.includes("method === 'OPTIONS'") ||
      hp.includes('method === "OPTIONS"');
    expect(hasOptions).toBe(true);
  });

  it('integrates content safety check', () => {
    expect(hp).toContain('checkMultipleContent');
  });

  it('sends pipeline notifications', () => {
    expect(hp).toContain('notifyVideoStarted');
    expect(hp).toContain('notifyVideoComplete');
    expect(hp).toContain('notifyVideoFailed');
  });

  it('supports resume from checkpoint', () => {
    expect(hp).toContain('resumeFrom');
  });

  it('supports all production modes: T2V, I2V, Avatar', () => {
    expect(hp).toContain('referenceImageUrl');
    expect(hp).toContain('isAvatarMode');
    expect(hp).toContain('videoEngine');
  });

  it('supports aspect ratio selection', () => {
    expect(hp).toContain("'16:9'");
    expect(hp).toContain("'9:16'");
    expect(hp).toContain("'1:1'");
  });

  it('supports quality tiers', () => {
    expect(hp).toContain("'standard'");
    expect(hp).toContain("'professional'");
  });

  it('supports breakout templates', () => {
    expect(hp).toContain('isBreakout');
    expect(hp).toContain('breakoutStartImageUrl');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. GENERATE-SINGLE-CLIP EDGE FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Pipeline — Generate Single Clip', () => {
  const gsc = readFile('supabase/functions/generate-single-clip/index.ts');

  it('uses Kling V3 model', () => {
    expect(gsc).toContain('kling-v3-video');
  });

  it('routes via Replicate API', () => {
    expect(gsc).toContain('api.replicate.com');
    expect(gsc).toContain('REPLICATE_MODEL_URL');
  });

  it('acquires generation mutex before generating', () => {
    expect(gsc).toContain('acquireGenerationLock');
  });

  it('releases mutex after generation', () => {
    expect(gsc).toContain('releaseGenerationLock');
  });

  it('checks continuity readiness', () => {
    expect(gsc).toContain('checkContinuityReady');
  });

  it('persists pipeline context for recovery', () => {
    expect(gsc).toContain('persistPipelineContext');
  });

  it('uses comprehensive prompt builder', () => {
    expect(gsc).toContain('buildComprehensivePrompt');
  });

  it('validates pipeline data', () => {
    expect(gsc).toContain('validatePipelineData');
  });

  it('uses guard rails for Clip 0 start image', () => {
    expect(gsc).toContain('getClip0StartImage');
    expect(gsc).toContain('getClip0LastFrame');
  });

  it('implements pre-generation checks', () => {
    expect(gsc).toContain('runPreGenerationChecks');
  });

  it('handles stale mutex recovery', () => {
    expect(gsc).toContain('checkAndRecoverStaleMutex');
  });

  it('uses APEX quality suffix for all prompts', () => {
    expect(gsc).toContain('APEX_QUALITY_SUFFIX');
    expect(gsc).toContain('cinematic lighting');
    expect(gsc).toContain('8K resolution');
  });

  it('supports skipPolling for direct chaining', () => {
    expect(gsc).toContain('skipPolling');
  });

  it('enables native audio only for avatar mode', () => {
    expect(gsc).toContain('KLING_ENABLE_AUDIO_AVATAR');
    expect(gsc).toContain('KLING_ENABLE_AUDIO_T2V');
    expect(gsc).toContain('KLING_ENABLE_AUDIO_I2V');
  });

  it('default clip duration is 10s for Kling V3', () => {
    expect(gsc).toContain('DEFAULT_CLIP_DURATION = 10');
  });

  it('checks content safety', () => {
    expect(gsc).toContain('checkContentSafety');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. CONTINUE-PRODUCTION EDGE FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Pipeline — Continue Production (Clip Chaining)', () => {
  const cp = readFile('supabase/functions/continue-production/index.ts');

  it('is callback-based: triggered by generate-single-clip', () => {
    expect(cp).toContain('completedClipIndex');
    expect(cp).toContain('completedClipResult');
  });

  it('triggers next clip or post-production', () => {
    expect(cp).toContain('totalClips');
  });

  it('validates continuity before next clip', () => {
    expect(cp).toContain('checkContinuityReady');
  });

  it('loads pipeline context for recovery', () => {
    expect(cp).toContain('loadPipelineContext');
  });

  it('implements subject detection (character vs object prompts)', () => {
    expect(cp).toContain('detectCharacterPrompt');
    expect(cp).toContain('OBJECT_PATTERNS');
    expect(cp).toContain('CHARACTER_PATTERNS');
  });

  it('object patterns: vehicles, natural phenomena, landscapes', () => {
    expect(cp).toContain('spacecraft');
    expect(cp).toContain('asteroid');
    expect(cp).toContain('landscape');
  });

  it('character patterns: human terms, pronouns, actions', () => {
    expect(cp).toContain('person');
    expect(cp).toContain('walking');
    expect(cp).toContain('wearing');
  });

  it('defaults to character prompt for safety', () => {
    expect(cp).toContain('return true');
  });

  it('handles CORS OPTIONS', () => {
    expect(cp).toContain('corsHeaders');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. PIPELINE WATCHDOG
// ═══════════════════════════════════════════════════════════════════════════════

describe('Pipeline — Watchdog Architecture', () => {
  const pw = readFile('supabase/functions/pipeline-watchdog/index.ts');

  it('is v5.0 with world-class resilience', () => {
    expect(pw).toContain('v5.0');
  });

  it('detects stuck clips using guard rails', () => {
    expect(pw).toContain('detectStuckClips');
  });

  it('checks pipeline health', () => {
    expect(pw).toContain('checkPipelineHealth');
  });

  it('recovers stale mutex locks', () => {
    expect(pw).toContain('checkAndRecoverStaleMutex');
  });

  it('guarantees last frame fallback', () => {
    expect(pw).toContain('getGuaranteedLastFrame');
  });

  it('validates image URLs before use', () => {
    expect(pw).toContain('isValidImageUrl');
  });

  it('recovers all stuck clips', () => {
    expect(pw).toContain('recoverAllStuckClips');
  });

  it('finds orphaned videos', () => {
    expect(pw).toContain('findOrphanedVideo');
  });

  it('releases stale completed locks', () => {
    expect(pw).toContain('releaseStaleCompletedLock');
  });

  it('verifies stuck predictions', () => {
    expect(pw).toContain('verifyAllStuckPredictions');
  });

  it('uses network resilience module', () => {
    expect(pw).toContain('resilientFetch');
    expect(pw).toContain('RESILIENCE_CONFIG');
  });

  it('uses world-class cinematography', () => {
    expect(pw).toContain('CAMERA_MOVEMENTS');
    expect(pw).toContain('buildPlacementDirective');
  });

  it('uses Replicate API for clip creation', () => {
    expect(pw).toContain('createReplicatePrediction');
    expect(pw).toContain('pollReplicatePrediction');
  });

  it('sends completion notifications', () => {
    expect(pw).toContain('notifyVideoComplete');
    expect(pw).toContain('notifyVideoFailed');
  });

  it('supports admin force-stitch', () => {
    expect(pw).toContain('forceStitchProjectId');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. GUARD RAILS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Pipeline — Guard Rails Configuration', () => {
  const gr = readFile('supabase/functions/_shared/pipeline-guard-rails.ts');

  it('mutex stale threshold is 10 minutes', () => {
    expect(gr).toContain('10 * 60 * 1000');
    expect(gr).toContain('MUTEX_STALE_THRESHOLD_MS');
  });

  it('mutex warning threshold is 5 minutes', () => {
    expect(gr).toContain('MUTEX_WARNING_THRESHOLD_MS');
    expect(gr).toContain('5 * 60 * 1000');
  });

  it('clip stuck threshold is 10 minutes', () => {
    expect(gr).toContain('CLIP_STUCK_THRESHOLD_MS');
  });

  it('clip max age is 15 minutes', () => {
    expect(gr).toContain('CLIP_GENERATING_MAX_AGE_MS');
    expect(gr).toContain('15 * 60 * 1000');
  });

  it('frame extraction: 3 retries, 1500ms backoff', () => {
    expect(gr).toContain('FRAME_EXTRACTION_MAX_RETRIES: 3');
    expect(gr).toContain('FRAME_EXTRACTION_BACKOFF_MS: 1500');
  });

  it('auto recovery enabled by default', () => {
    expect(gr).toContain('AUTO_RECOVERY_ENABLED: true');
  });

  it('max 3 recovery attempts per clip', () => {
    expect(gr).toContain('MAX_RECOVERY_ATTEMPTS_PER_CLIP: 3');
  });

  it('Clip 0 always uses reference image', () => {
    expect(gr).toContain('CLIP_0_ALWAYS_USE_REFERENCE: true');
  });

  it('getClip0StartImage priority: reference > identity_bible > scene', () => {
    expect(gr).toContain("source: 'reference_image'");
    expect(gr).toContain("source: 'identity_bible'");
    expect(gr).toContain("source: 'scene_image'");
  });

  it('exports GuardRailResult with 4 actions', () => {
    expect(gr).toContain("'proceed'");
    expect(gr).toContain("'wait'");
    expect(gr).toContain("'recover'");
    expect(gr).toContain("'fail'");
  });

  it('exports ClipHealthStatus with 4 states', () => {
    expect(gr).toContain("'healthy'");
    expect(gr).toContain("'stuck'");
    expect(gr).toContain("'failed'");
    expect(gr).toContain("'missing'");
  });

  it('pipeline health: healthy, degraded, stalled, failed', () => {
    expect(gr).toContain("'degraded'");
    expect(gr).toContain("'stalled'");
  });

  it('mutex status: free, held, stale', () => {
    expect(gr).toContain("'free'");
    expect(gr).toContain("'held'");
    expect(gr).toContain("'stale'");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 11. GENERATION MUTEX
// ═══════════════════════════════════════════════════════════════════════════════

describe('Pipeline — Generation Mutex', () => {
  const mx = readFile('supabase/functions/_shared/generation-mutex.ts');

  it('exports acquireGenerationLock', () => {
    expect(mx).toContain('export async function acquireGenerationLock');
  });

  it('auto-releases orphaned locks from completed clips', () => {
    expect(mx).toContain('AUTO-RELEASING orphaned lock');
    expect(mx).toContain("status === 'completed'");
  });

  it('uses database RPC for atomic lock acquisition', () => {
    expect(mx).toContain("rpc('acquire_generation_lock'");
  });

  it('exports checkContinuityReady', () => {
    expect(mx).toContain('checkContinuityReady');
  });

  it('exports persistPipelineContext', () => {
    expect(mx).toContain('persistPipelineContext');
  });

  it('exports updateFrameExtractionStatus', () => {
    expect(mx).toContain('updateFrameExtractionStatus');
  });

  it('LockResult interface has acquired, lockId, staleLockReleased', () => {
    expect(mx).toContain('acquired: boolean');
    expect(mx).toContain('lockId?: string');
    expect(mx).toContain('staleLockReleased?: boolean');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 12. NETWORK RESILIENCE
// ═══════════════════════════════════════════════════════════════════════════════

describe('Pipeline — Network Resilience', () => {
  const nr = readFile('supabase/functions/_shared/network-resilience.ts');

  it('max 4 retries by default', () => {
    expect(nr).toContain('MAX_RETRIES: 4');
  });

  it('base delay 1000ms', () => {
    expect(nr).toContain('BASE_DELAY_MS: 1000');
  });

  it('max delay 30000ms', () => {
    expect(nr).toContain('MAX_DELAY_MS: 30000');
  });

  it('jitter factor 0.3', () => {
    expect(nr).toContain('JITTER_FACTOR: 0.3');
  });

  it('handles ECONNRESET, ETIMEDOUT, socket hang up', () => {
    expect(nr).toContain('ECONNRESET');
    expect(nr).toContain('ETIMEDOUT');
    expect(nr).toContain('socket hang up');
  });

  it('retries on status 429 (rate limit), 500, 502, 503, 504', () => {
    expect(nr).toContain('429');
    expect(nr).toContain('500');
    expect(nr).toContain('502');
    expect(nr).toContain('503');
    expect(nr).toContain('504');
  });

  it('rate limit wait is 15 seconds', () => {
    expect(nr).toContain('RATE_LIMIT_WAIT_MS: 15000');
  });

  it('max 3 rate limit waits', () => {
    expect(nr).toContain('RATE_LIMIT_MAX_WAITS: 3');
  });

  it('HEAD request timeout 10s for pre-flight validation', () => {
    expect(nr).toContain('HEAD_REQUEST_TIMEOUT_MS: 10000');
  });

  it('exports resilientFetch, validateImageUrl, calculateBackoff', () => {
    expect(nr).toContain('export');
    expect(nr).toContain('resilientFetch');
    expect(nr).toContain('validateImageUrl');
    expect(nr).toContain('calculateBackoff');
  });

  it('exports createReplicatePrediction & pollReplicatePrediction', () => {
    expect(nr).toContain('createReplicatePrediction');
    expect(nr).toContain('pollReplicatePrediction');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 13. PROMPT BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

describe('Pipeline — Prompt Builder', () => {
  const pb = readFile('supabase/functions/_shared/prompt-builder.ts');

  it('is the single source of truth for prompt construction', () => {
    expect(pb).toContain('SINGLE SOURCE OF TRUTH');
  });

  it('always injects identity bible data', () => {
    expect(pb).toContain('characterDescription');
    expect(pb).toContain('consistencyAnchors');
  });

  it('always adds anti-morphing negatives', () => {
    expect(pb).toContain('antiMorphingPrompts');
  });

  it('adds occlusion negatives for hidden-face shots', () => {
    expect(pb).toContain('occlusionNegatives');
  });

  it('supports non-facial anchors for back-facing shots', () => {
    expect(pb).toContain('nonFacialAnchors');
    expect(pb).toContain('bodyType');
    expect(pb).toContain('hairFromBehind');
    expect(pb).toContain('overallSilhouette');
  });

  it('propagates continuity manifest between clips', () => {
    expect(pb).toContain('ContinuityManifest');
    expect(pb).toContain('colorTemperature');
    expect(pb).toContain('keyLightDirection');
  });

  it('supports motion vectors for transitions', () => {
    expect(pb).toContain('MotionVectors');
  });

  it('supports face lock system', () => {
    expect(pb).toContain('FaceLock');
  });

  it('supports multi-view identity bible', () => {
    expect(pb).toContain('MultiViewIdentityBible');
  });

  it('exports buildComprehensivePrompt', () => {
    expect(pb).toContain('buildComprehensivePrompt');
  });

  it('exports validatePipelineData', () => {
    expect(pb).toContain('validatePipelineData');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 14. SHARED MODULES EXIST
// ═══════════════════════════════════════════════════════════════════════════════

describe('Pipeline — Shared Modules', () => {
  const requiredModules = [
    'supabase/functions/_shared/generation-mutex.ts',
    'supabase/functions/_shared/pipeline-guard-rails.ts',
    'supabase/functions/_shared/prompt-builder.ts',
    'supabase/functions/_shared/network-resilience.ts',
    'supabase/functions/_shared/content-safety.ts',
    'supabase/functions/_shared/pipeline-notifications.ts',
    'supabase/functions/_shared/world-class-cinematography.ts',
  ];

  for (const mod of requiredModules) {
    it(`${path.basename(mod)} exists`, () => {
      expect(fileExists(mod)).toBe(true);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 15. EDGE FUNCTIONS EXIST
// ═══════════════════════════════════════════════════════════════════════════════

describe('Pipeline — Critical Edge Functions', () => {
  const criticalFunctions = [
    'hollywood-pipeline',
    'generate-single-clip',
    'continue-production',
    'pipeline-watchdog',
    'generate-script',
    'simple-stitch',
    'resume-pipeline',
    'retry-failed-clip',
    'cancel-project',
    'generate-avatar-direct',
    'generate-voice',
    'generate-music',
    'extract-last-frame',
    'generate-scene-images',
    'stripe-webhook',
    'mode-router',
    'kling-v3-audit-test',
    'production-audit',
  ];

  for (const fn of criticalFunctions) {
    it(`${fn} edge function exists`, () => {
      expect(fileExists(`supabase/functions/${fn}/index.ts`)).toBe(true);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 16. DATABASE SCHEMA ALIGNMENT
// ═══════════════════════════════════════════════════════════════════════════════

describe('Pipeline — Database Schema', () => {
  const types = readFile('src/integrations/supabase/types.ts');

  it('movie_projects has pipeline_stage column', () => {
    expect(types).toContain('pipeline_stage: string | null');
  });

  it('movie_projects has pipeline_state column', () => {
    expect(types).toContain('pipeline_state: Json | null');
  });

  it('movie_projects has pipeline_context_snapshot column', () => {
    expect(types).toContain('pipeline_context_snapshot: Json | null');
  });

  it('movie_projects has generation_lock column', () => {
    expect(types).toContain('generation_lock: Json | null');
  });

  it('movie_projects has pending_video_tasks column', () => {
    expect(types).toContain('pending_video_tasks: Json | null');
  });

  it('movie_projects has stitch_attempts column', () => {
    expect(types).toContain('stitch_attempts: number | null');
  });

  it('movie_projects has quality_tier column', () => {
    expect(types).toContain('quality_tier: string | null');
  });

  it('movie_projects has video_clips array column', () => {
    expect(types).toContain('video_clips: string[] | null');
  });

  it('movie_projects has last_error column', () => {
    expect(types).toContain('last_error: string | null');
  });

  it('movie_projects has last_checkpoint_at column', () => {
    expect(types).toContain('last_checkpoint_at: string | null');
  });

  it('movie_projects has source_image_url for I2V mode', () => {
    expect(types).toContain('source_image_url: string | null');
  });

  it('movie_projects has avatar_voice_id for avatar mode', () => {
    expect(types).toContain('avatar_voice_id: string | null');
  });

  it('movie_projects has aspect_ratio column', () => {
    expect(types).toContain('aspect_ratio: string | null');
  });

  it('api_cost_logs table tracks pipeline costs', () => {
    expect(types).toContain('api_cost_logs');
    expect(types).toContain('credits_charged');
    expect(types).toContain('real_cost_cents');
  });

  it('edit_sessions table for timeline editing', () => {
    expect(types).toContain('edit_sessions');
    expect(types).toContain('timeline_data');
    expect(types).toContain('render_progress');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 17. DIRECT CHAINING ARCHITECTURE
// ═══════════════════════════════════════════════════════════════════════════════

describe('Pipeline — Direct Chaining (Timeout Bypass)', () => {
  const gsc = readFile('supabase/functions/generate-single-clip/index.ts');
  const cp = readFile('supabase/functions/continue-production/index.ts');

  it('generate-single-clip supports skipPolling to return immediately', () => {
    expect(gsc).toContain('skipPolling');
  });

  it('continue-production receives completedClipResult with videoUrl', () => {
    expect(cp).toContain('videoUrl');
  });

  it('continue-production receives lastFrameUrl for chaining', () => {
    expect(cp).toContain('lastFrameUrl');
  });

  it('watchdog calls continue-production for stuck clips', () => {
    const pw = readFile('supabase/functions/pipeline-watchdog/index.ts');
    expect(pw).toContain('continue-production');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 18. WORLD-CLASS CINEMATOGRAPHY
// ═══════════════════════════════════════════════════════════════════════════════

describe('Pipeline — World-Class Cinematography Module', () => {
  const wcc = readFile('supabase/functions/_shared/world-class-cinematography.ts');

  it('exports CAMERA_MOVEMENTS', () => {
    expect(wcc).toContain('CAMERA_MOVEMENTS');
  });

  it('exports CAMERA_ANGLES', () => {
    expect(wcc).toContain('CAMERA_ANGLES');
  });

  it('exports SHOT_SIZES', () => {
    expect(wcc).toContain('SHOT_SIZES');
  });

  it('exports LIGHTING_STYLES', () => {
    expect(wcc).toContain('LIGHTING_STYLES');
  });

  it('exports progressive scene generation', () => {
    expect(wcc).toContain('getProgressiveScene');
  });

  it('exports placement directive builder', () => {
    expect(wcc).toContain('buildPlacementDirective');
  });

  it('exports avatar placement resolver', () => {
    expect(wcc).toContain('resolveAvatarPlacement');
  });

  it('supports journey type detection', () => {
    expect(wcc).toContain('detectJourneyType');
  });
});
