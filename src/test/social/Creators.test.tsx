import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * The standalone Creators discovery page was removed in the social-graph
 * simplification. The /creators route now redirects to the People tab of the
 * unified Search hub (/search?tab=people), and creator-discovery data still
 * flows through the useCreatorDiscovery hook.
 *
 * These tests guard that consolidation instead of the deleted page component.
 */
describe('Creators route consolidation', () => {
  it('redirects /creators to the Search People tab', () => {
    const appSrc = fs.readFileSync(path.join(process.cwd(), 'src/App.tsx'), 'utf-8');
    expect(appSrc).toMatch(/path="\/creators"\s+element=\{<Navigate to="\/search\?tab=people"/);
  });

  it('the redirect destination (SearchHub) exports a default component', async () => {
    const mod = await import('@/pages/SearchHub');
    expect(typeof mod.default).toBe('function');
  });

  it('still exposes the creator discovery hook', async () => {
    const mod = await import('@/hooks/usePublicProfile');
    expect(typeof mod.useCreatorDiscovery).toBe('function');
  });
});
