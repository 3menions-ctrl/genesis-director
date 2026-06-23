import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * The standalone public UserProfile page was removed in the social-graph
 * simplification. Public profiles are now served by the comprehensive Profile
 * page (reachable at /c/:id), and the legacy /user/:userId route redirects back
 * into the app. The usePublicProfile hook still backs public profile data.
 *
 * These tests guard that consolidation instead of the deleted page component.
 */
describe('User profile route consolidation', () => {
  it('redirects the legacy /user/:userId route', () => {
    const appSrc = fs.readFileSync(path.join(process.cwd(), 'src/App.tsx'), 'utf-8');
    expect(appSrc).toMatch(/path="\/user\/:userId"\s+element=\{<Navigate to="\/projects"/);
  });

  it('serves public profiles via the Profile page default export', async () => {
    const mod = await import('@/pages/Profile');
    expect(typeof mod.default).toBe('function');
  });

  it('still exposes the public profile hook', async () => {
    const mod = await import('@/hooks/usePublicProfile');
    expect(typeof mod.usePublicProfile).toBe('function');
  });
});
