/**
 * Regression: the studio has NO entrance animation. Per product, entering the
 * studio must not play the "THE CROSSING" logo intro (or any prior tour/video).
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
  it('studio plays no entrance animation', () => {
    const studio = read('src/pages/Studio.tsx');
    expect(studio).not.toMatch(/StudioEntranceIntro/);
    expect(existsSync(resolve(process.cwd(), 'src/components/intro/StudioEntranceIntro.tsx'))).toBe(false);
  });
});
