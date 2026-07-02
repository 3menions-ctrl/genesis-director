/**
 * production-request contract — pure resolver unit tests.
 *
 * The unified pipeline expresses every legacy behavior fork as DATA
 * (engine → dispatchStrategy → audioStrategy). These tests pin the pure
 * resolvers so the normalizer (mode-router) and orchestrator (hollywood-pipeline)
 * agree on the contract without a live edge function.
 */
import { describe, it, expect } from 'vitest';
import {
  resolveEngine,
  EngineRequiredError,
  resolveDispatchStrategy,
  resolveAudioStrategy,
  resolveOperation,
  resolveShotOperation,
  normalizeMode,
  buildProductionRequest,
  HANDLER_COLLAPSE,
  type ProductionRequest,
} from '../../../supabase/functions/_shared/production-request.ts';

function base(partial: Partial<ProductionRequest> = {}): ProductionRequest {
  return {
    mode: 'text',
    engine: 'auto',
    inputs: {},
    script: { generate: true },
    continuity: {},
    format: {},
    audio: {},
    breakout: { isBreakout: false },
    gate: { requireApproval: true },
    ...partial,
  };
}

describe('resolveEngine', () => {
  it('breakout forces seedance regardless of requested engine', () => {
    expect(resolveEngine(base({ engine: 'kling', breakout: { isBreakout: true } }))).toBe('seedance');
  });
  it('explicit engine wins', () => {
    expect(resolveEngine(base({ engine: 'veo' }))).toBe('veo');
  });
  it('auto throws ENGINE_REQUIRED — there is no default model', () => {
    expect(() => resolveEngine(base({ engine: 'auto' }))).toThrowError(EngineRequiredError);
  });
  it('missing engine throws ENGINE_REQUIRED — there is no default model', () => {
    expect(() => resolveEngine(base({ engine: undefined as never }))).toThrowError(EngineRequiredError);
  });
});

describe('resolveDispatchStrategy', () => {
  it('seedance → parallel', () => {
    expect(resolveDispatchStrategy('seedance')).toBe('parallel');
  });
  it.each(['kling', 'wan', 'veo', 'runway', 'sora'] as const)('%s → sequential', (e) => {
    expect(resolveDispatchStrategy(e)).toBe('sequential');
  });
});

describe('resolveAudioStrategy', () => {
  it('native-audio engines → native', () => {
    expect(resolveAudioStrategy(base({ engine: 'kling' }))).toBe('native');
  });
  it('seedance narrative → post-mux', () => {
    expect(resolveAudioStrategy(base({ engine: 'seedance' }))).toBe('post-mux');
  });
  it('seedance avatar → overlay', () => {
    expect(resolveAudioStrategy(base({ engine: 'seedance', isAvatarMode: true }))).toBe('overlay');
  });
});

describe('resolveOperation — execution lane', () => {
  it('text/broll → t2v clip-loop', () => {
    expect(resolveOperation(base({ mode: 'text' }))).toMatchObject({ operation: 't2v', executionLane: 'clip-loop' });
  });
  it('image → i2v clip-loop', () => {
    expect(resolveOperation(base({ mode: 'image' }))).toMatchObject({ operation: 'i2v', executionLane: 'clip-loop' });
  });
  it('avatar + script → avatar clip-loop', () => {
    expect(resolveOperation(base({ mode: 'avatar', script: { generate: true } }))).toMatchObject({ operation: 'avatar', executionLane: 'clip-loop' });
  });
  it('avatar scriptless → generate-avatar-direct leaf', () => {
    expect(resolveOperation(base({ mode: 'avatar', script: { generate: false } }))).toMatchObject({ executionLane: 'single-pass-effect', effectFn: 'generate-avatar-direct' });
  });
  it('video2video → stylize-video leaf', () => {
    expect(resolveOperation(base({ mode: 'video2video', script: { generate: false } }))).toMatchObject({ effectFn: 'stylize-video', executionLane: 'single-pass-effect' });
  });
  it('motion-transfer → motion-transfer leaf', () => {
    expect(resolveOperation(base({ mode: 'motion-transfer', script: { generate: false } }))).toMatchObject({ effectFn: 'motion-transfer', executionLane: 'single-pass-effect' });
  });
});

describe('resolveShotOperation', () => {
  it('avatar mode → avatar for every shot', () => {
    expect(resolveShotOperation(base({ isAvatarMode: true }), 3, false)).toBe('avatar');
  });
  it('image mode shot 0 → i2v', () => {
    expect(resolveShotOperation(base({ mode: 'image' }), 0, true)).toBe('i2v');
  });
  it('text mode chained shot (has start frame) → i2v', () => {
    expect(resolveShotOperation(base({ mode: 'text' }), 2, true)).toBe('i2v');
  });
  it('text mode shot 0 no frame → t2v', () => {
    expect(resolveShotOperation(base({ mode: 'text' }), 0, false)).toBe('t2v');
  });
});

describe('normalizeMode', () => {
  it.each([
    ['text-to-video', 'text'],
    ['image-to-video', 'image'],
    ['b-roll', 'broll'],
    ['avatar-cinematic', 'avatar'],
    ['video-to-video', 'video2video'],
    ['pose-transfer', 'motion-transfer'],
  ])('%s → %s', (ui, expected) => {
    expect(normalizeMode(ui)).toBe(expected);
  });
});

describe('buildProductionRequest — normalizer parity with the legacy mode-router switch', () => {
  it('text-to-video without an engine → ENGINE_REQUIRED (no default model)', () => {
    const pr = buildProductionRequest({ mode: 'text-to-video', prompt: 'a city at dawn' });
    expect(pr.mode).toBe('text');
    expect(pr.script.generate).toBe(true);
    expect(() => resolveEngine(pr)).toThrowError(EngineRequiredError);
    expect(resolveOperation(pr)).toMatchObject({ operation: 't2v', executionLane: 'clip-loop' });
  });

  it('image-to-video → i2v with imageRef seed', () => {
    const pr = buildProductionRequest({ mode: 'image-to-video', imageUrl: 'https://x/img.png', prompt: 'pan' });
    expect(pr.mode).toBe('image');
    expect(pr.inputs.imageRef).toBe('https://x/img.png');
    expect(resolveOperation(pr)).toMatchObject({ operation: 'i2v', executionLane: 'clip-loop' });
  });

  it('avatar + seedance → CINEMATIC (script-generating, overlay audio, clip-loop)', () => {
    const pr = buildProductionRequest({ mode: 'avatar', videoEngine: 'seedance', imageUrl: 'https://x/face.png' });
    expect(pr.isAvatarMode).toBe(true);
    expect(pr.script.generate).toBe(true);
    expect(pr.cinematicMode).toBe(true);
    expect(resolveAudioStrategy(pr)).toBe('overlay');
    expect(resolveOperation(pr)).toMatchObject({ operation: 'avatar', executionLane: 'clip-loop' });
  });

  it('avatar (no seedance) → DIRECT (scriptless, verbatim TTS, single-pass leaf)', () => {
    const pr = buildProductionRequest({ mode: 'avatar', imageUrl: 'https://x/face.png', prompt: 'hello world' });
    expect(pr.script.generate).toBe(false);
    expect(pr.script.preserveUserContent).toBe(true);
    expect(pr.inputs.avatarRef).toBe('https://x/face.png');
    expect(resolveOperation(pr)).toMatchObject({ executionLane: 'single-pass-effect', effectFn: 'generate-avatar-direct' });
  });

  it('video-to-video → scriptless stylize leaf with sourceVideo', () => {
    const pr = buildProductionRequest({ mode: 'video-to-video', videoUrl: 'https://x/v.mp4', stylePreset: 'noir' });
    expect(pr.script.generate).toBe(false);
    expect(pr.inputs.sourceVideo).toBe('https://x/v.mp4');
    expect(resolveOperation(pr)).toMatchObject({ effectFn: 'stylize-video', executionLane: 'single-pass-effect' });
  });

  it('motion-transfer → scriptless pose-transfer leaf with source + target', () => {
    const pr = buildProductionRequest({ mode: 'motion-transfer', videoUrl: 'https://x/v.mp4', imageUrl: 'https://x/t.png' });
    expect(pr.script.generate).toBe(false);
    expect(pr.inputs.sourceVideo).toBe('https://x/v.mp4');
    expect(pr.inputs.targetImage).toBe('https://x/t.png');
    expect(resolveOperation(pr)).toMatchObject({ effectFn: 'motion-transfer', executionLane: 'single-pass-effect' });
  });

  it('breakout forces seedance regardless of requested engine', () => {
    const pr = buildProductionRequest({ mode: 'text-to-video', isBreakout: true, videoEngine: 'kling' });
    expect(pr.breakout.isBreakout).toBe(true);
    expect(resolveEngine(pr)).toBe('seedance');
  });

  it('gate is FAIL-CLOSED: requireApproval always true; autoApprove only when explicitly true', () => {
    expect(buildProductionRequest({ mode: 'text' }).gate).toEqual({ requireApproval: true, autoApprove: undefined });
    expect(buildProductionRequest({ mode: 'text', autoApprove: true }).gate.autoApprove).toBe(true);
    expect(buildProductionRequest({ mode: 'text', autoApprove: false }).gate.autoApprove).toBeUndefined();
  });

  it('format + audio carry through with safe defaults', () => {
    const pr = buildProductionRequest({ mode: 'text', aspectRatio: '9:16', clipCount: 4, clipDuration: 10,
      enableMusic: true, voiceId: 'bella', qualityOptions: { upscale4k: true, fps60: false } });
    expect(pr.format).toMatchObject({ aspect: '9:16', clips: 4, duration: 10, quality: { upscale4k: true, fps60: false } });
    expect(pr.audio).toMatchObject({ narration: true, music: true, voiceId: 'bella' });
  });
});

describe('engine-parity canary — normalizer engine == mode-router persisted-engine formula', () => {
  // Mirrors mode-router post-NO-DEFAULT-MODEL: breakout forces seedance; an
  // explicit engine wins; a missing engine is REJECTED at the gate (there is
  // no kling fallback anymore).
  const persisted = (videoEngine: string | undefined, isBreakout: boolean) =>
    isBreakout ? 'seedance' : videoEngine;

  it.each([
    ['kling', false],
    ['veo', false],
    ['seedance', false],
    ['runway', false],
    ['sora', false],
    ['wan', false],
    ['kling', true],   // breakout overrides → seedance
    [undefined, true], // breakout needs no user pick
  ] as const)('videoEngine=%s breakout=%s → engines agree', (videoEngine, isBreakout) => {
    const pr = buildProductionRequest({ mode: 'text-to-video', videoEngine: videoEngine ?? null, isBreakout });
    expect(resolveEngine(pr)).toBe(persisted(videoEngine ?? undefined, isBreakout));
  });

  it('videoEngine=undefined breakout=false → ENGINE_REQUIRED (mode-router 400s it)', () => {
    const pr = buildProductionRequest({ mode: 'text-to-video', videoEngine: null, isBreakout: false });
    expect(() => resolveEngine(pr)).toThrowError(EngineRequiredError);
  });
});

describe('HANDLER_COLLAPSE table', () => {
  it('covers all 5 legacy handlers', () => {
    expect(Object.keys(HANDLER_COLLAPSE).sort()).toEqual([
      'handleAvatarCinematicMode',
      'handleAvatarDirectMode',
      'handleCinematicMode',
      'handleMotionTransferMode',
      'handleStyleTransferMode',
    ]);
  });
  it('avatar-direct + effects are single-pass leaves; cinematic + avatar-cinematic are clip-loop', () => {
    expect(HANDLER_COLLAPSE['handleCinematicMode'].executionLane).toBe('clip-loop');
    expect(HANDLER_COLLAPSE['handleAvatarCinematicMode'].executionLane).toBe('clip-loop');
    expect(HANDLER_COLLAPSE['handleAvatarDirectMode'].executionLane).toBe('single-pass-effect');
    expect(HANDLER_COLLAPSE['handleStyleTransferMode'].executionLane).toBe('single-pass-effect');
    expect(HANDLER_COLLAPSE['handleMotionTransferMode'].executionLane).toBe('single-pass-effect');
  });
});
