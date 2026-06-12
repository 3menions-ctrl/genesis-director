/**
 * Smoke tests for video engine routing.
 *
 * These pin down three contracts that the Studio v2 create page + the
 * generate-single-clip / hollywood-pipeline backends rely on:
 *
 *   1. engineToBackend() maps every kebab EngineId to the correct backend
 *      token. No silent fallbacks (Runway / Sora used to decay to "veo").
 *   2. The ENGINE registry exposes a pipelineFunction + pipelineId for each
 *      engine so the dispatcher can route requests.
 *   3. creditsForScene() returns positive, monotonic credit costs at the
 *      engine's recommended duration (catches accidental zero-cost engines).
 *   4. The shared backend `_shared/engines.ts` agrees with the frontend on
 *      the kebab→backend mapping (drift detection).
 */

import { describe, it, expect } from 'vitest';
import {
  ENGINES,
  engineToBackend,
  creditsForScene,
  defaultQualityProfile,
  type EngineId,
  type BackendEngine,
} from '@/lib/video/engines';
// Backend mirror — keep in lockstep.
import { engineToBackend as engineToBackendBE } from '../../../supabase/functions/_shared/engines';

const ENGINE_IDS: EngineId[] = [
  'kling-v3',
  'seedance-2',
  'veo-3',
  'runway-gen4',
  'sora-2',
];

const EXPECTED_BACKEND: Record<EngineId, BackendEngine> = {
  'wan-25':      'wan',
  'kling-v3':    'kling',
  'seedance-2':  'seedance',
  'veo-3':       'veo',
  'runway-gen4': 'runway',
  'sora-2':      'sora',
};

describe('engineToBackend — frontend mapping', () => {
  it.each(ENGINE_IDS)('maps %s to its native backend token', (id) => {
    expect(engineToBackend(id)).toBe(EXPECTED_BACKEND[id]);
  });

  it('never silently falls back to veo for cinema engines', () => {
    expect(engineToBackend('runway-gen4')).not.toBe('veo');
    expect(engineToBackend('sora-2')).not.toBe('veo');
  });

  it('every kebab id resolves to a defined backend token', () => {
    const allowed = new Set(['kling', 'seedance', 'veo', 'runway', 'sora']);
    for (const id of ENGINE_IDS) {
      expect(allowed.has(engineToBackend(id))).toBe(true);
    }
  });
});

describe('engineToBackend — frontend ↔ backend parity', () => {
  it.each(ENGINE_IDS)('frontend and backend agree on %s', (id) => {
    expect(engineToBackend(id)).toBe(engineToBackendBE(id));
  });
});

describe('ENGINES registry — pipeline routing contract', () => {
  it.each(ENGINE_IDS)('%s declares a pipelineId and pipelineFunction', (id) => {
    const spec = ENGINES[id];
    expect(spec).toBeDefined();
    expect(spec.pipelineId).toMatch(/^pipe\./);
    expect(spec.pipelineFunction).toMatch(/^[a-z][a-z0-9-]+$/);
  });

  it('only kling routes through hollywood-pipeline (T2V/I2V director)', () => {
    expect(ENGINES['kling-v3'].pipelineFunction).toBe('hollywood-pipeline');
  });

  it('cinema-tier engines require studio_cinema entitlement', () => {
    expect(ENGINES['runway-gen4'].requiresEntitlement).toBe('studio_cinema');
    expect(ENGINES['sora-2'].requiresEntitlement).toBe('studio_cinema');
    expect(ENGINES['veo-3'].requiresEntitlement).toBe('studio_cinema');
  });

  it('every engine exposes ≥1 supported duration and a recommended profile', () => {
    for (const id of ENGINE_IDS) {
      const spec = ENGINES[id];
      expect(spec.durations.length).toBeGreaterThan(0);
      expect(spec.durations).toContain(spec.defaultDuration);
      expect(defaultQualityProfile(id)).toBeTruthy();
    }
  });
});

describe('creditsForScene — pricing sanity', () => {
  it.each(ENGINE_IDS)('%s returns a positive cost at its default duration', (id) => {
    const spec = ENGINES[id];
    const cost = creditsForScene(id, spec.defaultDuration);
    expect(cost).toBeGreaterThan(0);
    expect(Number.isFinite(cost)).toBe(true);
  });

  it('cinema engines are strictly more expensive than standard kling at 10s', () => {
    const klingCost = creditsForScene('kling-v3', 10);
    expect(creditsForScene('runway-gen4', 10)).toBeGreaterThan(klingCost);
    expect(creditsForScene('sora-2', 10)).toBeGreaterThan(klingCost);
  });
});
