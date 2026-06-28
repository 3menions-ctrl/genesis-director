/**
 * Engine-slug FE↔BE parity guard (docs/PIPELINE.md §6 Stage 4).
 *
 * The live Replicate slugs are the single source of truth and were the source of
 * a real prod bug (the `wan-ai/...` → 404 on the free tier). This test locks the
 * canonical slugs and asserts the FE engine taxonomy reconciles onto the same 6
 * backend engines, so the FE and BE can't silently drift apart again.
 *
 * Canonical slugs are the live-audited values (PIPELINE.md §1, 2026-06-27).
 *
 * KNOWN, TRACKED DRIFT (intentionally NOT asserted here — they require a
 * deliberate owner migration, not a blind slug swap):
 *   • `src/lib/editor/model-catalog.ts` — editor-only taxonomy still names
 *     seedance-1-pro / kling-2-master (old lineup).
 *   • `supabase/functions/editor-generate-clip` — still targets
 *     `bytedance/seedance-1-pro` (Seedance 2.0 has a different input shape, so
 *     the URL can't be swapped without migrating the input builder).
 * Surfacing them here so they don't become silent "why does this exist?" debt.
 */
import { describe, it, expect } from 'vitest';
import {
  ENGINE_ROUTE_LABEL,
  type BackendEngine as BeBackendEngine,
} from '../../../supabase/functions/_shared/production-request.ts';
import { engineToBackend, type EngineId, type BackendEngine as FeBackendEngine } from '../../lib/video/engines.ts';

// The live, audited Replicate route labels (PIPELINE.md §1). If a value changes
// upstream, this test must be updated DELIBERATELY — that's the guard.
const CANONICAL_SLUGS: Record<BeBackendEngine, string> = {
  wan: 'wan-video/wan-2.5-t2v',
  kling: 'kwaivgi/kling-v3-video',
  seedance: 'bytedance/seedance-2.0',
  veo: 'google/veo-3-fast',
  runway: 'runwayml/gen4-turbo',
  sora: 'openai/sora-2',
};

const FE_ENGINE_IDS: EngineId[] = ['wan-25', 'kling-v3', 'seedance-2', 'veo-3', 'runway-gen4', 'sora-2'];

describe('BE canonical slugs (ENGINE_ROUTE_LABEL) are locked to the live-audited values', () => {
  it.each(Object.keys(CANONICAL_SLUGS) as BeBackendEngine[])('%s → correct live slug', (engine) => {
    expect(ENGINE_ROUTE_LABEL[engine]).toBe(CANONICAL_SLUGS[engine]);
  });

  it('exposes exactly the 6 canonical backend engines (no missing/extra)', () => {
    expect(Object.keys(ENGINE_ROUTE_LABEL).sort()).toEqual(Object.keys(CANONICAL_SLUGS).sort());
  });

  it('contains NO stale slug fragments (regression guard for the wan-ai/seedance-1/kling-2 class)', () => {
    const forbidden = ['wan-ai/', 'seedance-1', 'kling-2-', 'kling-1', 'veo-2', 'gen3', 'gen-3'];
    for (const slug of Object.values(ENGINE_ROUTE_LABEL)) {
      for (const bad of forbidden) {
        expect(slug.includes(bad), `slug "${slug}" must not contain stale "${bad}"`).toBe(false);
      }
    }
  });
});

describe('FE↔BE engine-set parity', () => {
  it('FE and BE agree on the 6 backend engine keys', () => {
    const beKeys = (Object.keys(ENGINE_ROUTE_LABEL) as BeBackendEngine[]).sort();
    // The FE BackendEngine union, materialized via the values engineToBackend can return.
    const feKeys = [...new Set(FE_ENGINE_IDS.map(engineToBackend))].sort() as FeBackendEngine[];
    expect(feKeys).toEqual(beKeys);
  });

  it('every FE EngineId reconciles onto a canonical backend engine (no orphan FE engine)', () => {
    for (const id of FE_ENGINE_IDS) {
      const be = engineToBackend(id);
      expect(ENGINE_ROUTE_LABEL[be as BeBackendEngine], `FE engine "${id}" → "${be}" must be a canonical BE engine`).toBeDefined();
    }
  });
});
