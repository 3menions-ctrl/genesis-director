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
