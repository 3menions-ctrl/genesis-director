/**
 * Regression: the studio's first-run experience is the LOGO ANIMATION once —
 * not the old card tour. (Per product: no tour, no video; just the landing
 * animation, one time.)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

describe('studio entrance intro', () => {
  it('the old FirstTakeTour is gone', () => {
    expect(existsSync(resolve(process.cwd(), 'src/components/onboarding/FirstTakeTour.tsx'))).toBe(false);
    const studio = read('src/pages/Studio.tsx');
    expect(studio).not.toMatch(/FirstTakeTour/);
  });
  it('studio renders the one-time logo intro', () => {
    const studio = read('src/pages/Studio.tsx');
    expect(studio).toMatch(/StudioEntranceIntro/);
    const intro = read('src/components/intro/StudioEntranceIntro.tsx');
    expect(intro).toMatch(/IntroOverlay/);
    expect(intro).toMatch(/studio_intro_seen/); // plays once
  });
});
