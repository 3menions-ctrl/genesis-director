/**
 * Deterministic shuffle utility for avatar galleries
 * Uses a seeded random algorithm for consistent ordering within a session
 */

/**
 * Seeded random number generator (Mulberry32)
 * Produces same sequence for same seed
 */
function seededRandom(seed: number): () => number {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * Fisher-Yates shuffle with seeded random
 * Ensures deterministic shuffling for the same seed
 */
export function shuffleWithSeed<T>(array: T[], seed: number): T[] {
  const result = [...array];
  const random = seededRandom(seed);
  
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  
  return result;
}

/**
 * Generate a daily seed based on current date
 * Same seed for entire day, changes at midnight
 */
export function getDailySeed(): number {
  const now = new Date();
  return now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
}

/**
 * Generate a session seed using timestamp
 * Same seed for entire browser session
 */
let sessionSeed: number | null = null;
export function getSessionSeed(): number {
  if (sessionSeed === null) {
    sessionSeed = Date.now();
  }
  return sessionSeed;
}

/**
 * Shuffle avatar IDs for gallery display
 * Uses session seed for consistent ordering during navigation
 */
export function shuffleAvatarIds(ids: string[]): string[] {
  return shuffleWithSeed(ids, getSessionSeed());
}

/**
 * Shuffle avatar templates for gallery display
 * Uses session seed for consistent ordering during navigation
 */
export function shuffleAvatars<T extends { id: string }>(avatars: T[]): T[] {
  return shuffleWithSeed(avatars, getSessionSeed());
}
