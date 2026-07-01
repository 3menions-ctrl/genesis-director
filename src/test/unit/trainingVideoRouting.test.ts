/**
 * Training Video smoke — end-to-end engine routing contract.
 *
 * Pins the wiring that the Training Video page relies on:
 *
 *   1. The page invokes `mode-router` with `mode: 'avatar'` and an
 *      explicit `videoEngine` of either 'kling' or 'seedance'.
 *   2. Inside `mode-router`, an avatar request with `videoEngine: 'seedance'`
 *      MUST route through `seedance-pipeline` (Seedance Lock). It must NOT
 *      silently fall back to the Kling-only `generate-avatar-direct` path.
 *   3. An avatar request with `videoEngine: 'kling'` (or unset) routes
 *      through the direct Kling path.
 *
 * These are source-text assertions — they catch the silent-fallback class of
 * regression without needing a live edge function.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const trainingPage = readFileSync(
  resolve(__dirname, '../../pages/TrainingVideo.tsx'),
  'utf8',
);
const modeRouter = readFileSync(
  resolve(__dirname, '../../../supabase/functions/mode-router/index.ts'),
  'utf8',
);

describe('TrainingVideo — engine dispatch wiring', () => {
  it('invokes mode-router with avatar mode + an explicit videoEngine', () => {
    expect(trainingPage).toMatch(/functions\.invoke\(['"]mode-router['"]/);
    expect(trainingPage).toMatch(/mode:\s*['"]avatar['"]/);
    expect(trainingPage).toMatch(/videoEngine/);
  });

  it('UI exposes both kling and seedance as engine options', () => {
    expect(trainingPage).toMatch(/['"]kling['"]/);
    expect(trainingPage).toMatch(/['"]seedance['"]/);
  });

  it('forwards a continuity identityBible (multi-clip chain context)', () => {
    expect(trainingPage).toMatch(/identityBible/);
    expect(trainingPage).toMatch(/clipCount/);
  });
});

describe('mode-router — avatar engine routing (Seedance Lock)', () => {
  it('avatar + seedance branches BEFORE calling generate-avatar-direct', () => {
    const seedanceBranchIdx = modeRouter.indexOf("videoEngine === 'seedance'");
    const directCallIdx = modeRouter.indexOf('handleAvatarDirectMode(');
    expect(seedanceBranchIdx).toBeGreaterThan(-1);
    expect(directCallIdx).toBeGreaterThan(-1);
    expect(seedanceBranchIdx).toBeLessThan(directCallIdx);
  });

  it('routes avatar+seedance through the cinematic avatar dispatcher (now unified → hollywood-pipeline)', () => {
    // UNIFIED PIPELINE: seedance avatars still branch into the cinematic avatar
    // path, but that path now targets the single universal orchestrator
    // `hollywood-pipeline` (which selects the PARALLEL dispatch strategy for
    // seedance). The legacy seedance-pipeline is dormant.
    expect(modeRouter).toMatch(/handleAvatarCinematicMode\(/);
    expect(modeRouter).toMatch(/const targetPipeline = 'hollywood-pipeline'/);
  });

  it('handleAvatarCinematicMode accepts videoEngine for engine-aware dispatch', () => {
    // The videoEngine param is a union ('wan' | 'kling' | 'veo' | …); assert
    // the optional field is declared and that 'kling' is one of its members.
    expect(modeRouter).toMatch(
      /handleAvatarCinematicMode[\s\S]{0,2000}videoEngine\?:[\s\S]{0,120}['"]kling['"]/,
    );
  });

  it('kling path still uses generate-avatar-direct (native audio fast path)', () => {
    expect(modeRouter).toMatch(/generate-avatar-direct/);
  });
});