/**
 * CLIENT-SIDE CONTENT SAFETY MODULE
 * 
 * Pre-validation layer before content reaches the server.
 * This provides immediate feedback to users and reduces server load.
 * 
 * IMPORTANT: This is a FIRST LINE defense only.
 * Server-side validation in edge functions is the authoritative check.
 */

// =====================================================
// BLOCKED CONTENT - SYNCHRONIZED WITH SERVER
// =====================================================

/**
 * Explicit sexual terms - immediate rejection
 */
const EXPLICIT_TERMS = new Set([
  'porn', 'pornography', 'pornographic', 'xxx', 'nsfw',
  'nude', 'nudes', 'nudity', 'naked', 'nakedness',
  'sex', 'sexual', 'sexually', 'sexualized',
  'erotic', 'erotica', 'hentai', 'lewd',
  'genitals', 'genital', 'genitalia',
  'breasts', 'boobs', 'tits', 'nipples',
  'penis', 'dick', 'cock', 'vagina', 'pussy',
  'buttocks', 'anus', 'anal', 'testicles',
  'intercourse', 'masturbate', 'masturbation', 'masturbating', 'orgasm',
  'ejaculate', 'ejaculation', 'cumshot',
  'blowjob', 'handjob', 'footjob', 'fetish', 'bondage', 'bdsm',
  'stripper', 'striptease', 'escort', 'prostitute', 'prostitution',
  'onlyfans', 'camgirl', 'camboy',
  'topless', 'bottomless', 'undressing', 'disrobing',
  'seductive', 'seduction', 'seduce', 'titillating',
  'aroused', 'arousing', 'arousal', 'horny',
  'lingerie', 'panties',
  // Child safety - CRITICAL
  'underage', 'child porn', 'loli', 'lolita', 'shota',
  'pedo', 'pedophile', 'pedophilia', 'jailbait',
]);

/**
 * Suggestive phrases
 */
const SUGGESTIVE_PHRASES = [
  'take off clothes', 'remove clothes', 'without clothes',
  'take off her clothes', 'take off his clothes', 'taking off clothes',
  'taking off her clothes', 'taking off his clothes',
  'getting naked', 'getting undressed', 'strip down',
  'undress her', 'undress him', 'undressing her', 'undressing him',
  'in bed together', 'sleeping together', 'intimate moment',
  'making love', 'having sex', 'sexual scene',
  'seductive pose', 'sexy pose', 'provocative pose',
  'show body', 'expose body', 'body shot',
  'revealing outfit', 'revealing clothing', 'revealing dress',
  'sexy outfit', 'sexy clothing', 'sexy body',
  'sensual dancing', 'sensual touch', 'sensual pleasure',
  'provocative outfit', 'provocative clothing',
  'bikini model', 'swimsuit model', 'underwear model',
  'spread legs', 'bending over',
  'passionate kiss', 'french kiss', 'making out',
  'heavy petting', 'foreplay',
];

/**
 * Violence terms
 */
const VIOLENCE_TERMS = new Set([
  'gore', 'gory', 'gruesome', 'dismember', 'dismemberment', 'decapitate', 'decapitation',
  'torture', 'torturing', 'tortured',
  'mutilate', 'mutilation', 'mutilated',
  'eviscerate', 'disembowel',
  'suicide', 'self-harm', 'self harm', 'selfharm', 'cutting',
]);

/**
 * Hate terms
 */
const HATE_TERMS = new Set([
  'nazi', 'swastika', 'kkk', 'white supremacy',
  'ethnic cleansing', 'genocide',
]);

// =====================================================
// CONTENT SAFETY CHECK
// =====================================================

export interface ContentSafetyResult {
  isSafe: boolean;
  category: 'safe' | 'explicit' | 'suggestive' | 'violence' | 'hate';
  message: string;
  matchedTerm?: string;
}

/**
 * Check if content is safe for submission
 * Returns immediately on first violation for performance
 */
export function checkContentSafety(content: string): ContentSafetyResult {
  if (!content || typeof content !== 'string') {
    return { isSafe: true, category: 'safe', message: '' };
  }
  
  const normalized = normalizeContent(content);
  
  // Check explicit terms
  for (const term of EXPLICIT_TERMS) {
    if (containsWord(normalized, term)) {
      return {
        isSafe: false,
        category: 'explicit',
        message: 'This content violates our community guidelines. Explicit or NSFW content is not allowed.',
        matchedTerm: term,
      };
    }
  }
  
  // Check suggestive phrases
  for (const phrase of SUGGESTIVE_PHRASES) {
    if (normalized.includes(phrase)) {
      return {
        isSafe: false,
        category: 'suggestive',
        message: 'This content appears to request inappropriate material. Please revise your prompt.',
        matchedTerm: phrase,
      };
    }
  }
  
  // Check violence
  for (const term of VIOLENCE_TERMS) {
    if (containsWord(normalized, term)) {
      return {
        isSafe: false,
        category: 'violence',
        message: 'Graphic violence and gore are not permitted.',
        matchedTerm: term,
      };
    }
  }
  
  // Check hate terms
  for (const term of HATE_TERMS) {
    if (containsWord(normalized, term)) {
      return {
        isSafe: false,
        category: 'hate',
        message: 'Hateful or discriminatory content is strictly prohibited.',
        matchedTerm: term,
      };
    }
  }
  
  return { isSafe: true, category: 'safe', message: '' };
}

/**
 * Check multiple content fields at once
 */
export function checkMultipleContent(...contents: (string | undefined | null)[]): ContentSafetyResult {
  for (const content of contents) {
    if (content) {
      const result = checkContentSafety(content);
      if (!result.isSafe) {
        return result;
      }
    }
  }
  return { isSafe: true, category: 'safe', message: '' };
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Normalize content for matching
 */
function normalizeContent(content: string): string {
  let result = content.toLowerCase().trim();
  
  // Common obfuscation replacements
  const replacements: Record<string, string> = {
    '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's',
    '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 'i',
  };
  
  for (const [char, replacement] of Object.entries(replacements)) {
    result = result.split(char).join(replacement);
  }
  
  // Remove special characters used to evade
  result = result.replace(/[*_\-./]/g, '');
  
  return result;
}

/**
 * Check if content contains a word (word boundary aware)
 */
function containsWord(content: string, word: string): boolean {
  if (word.includes(' ')) {
    return content.includes(word);
  }
  const regex = new RegExp(`\\b${word}\\b`, 'i');
  return regex.test(content);
}

// =====================================================
// REACT HOOK FOR CONTENT VALIDATION
// =====================================================

import { useState, useCallback } from 'react';

export function useContentSafety() {
  const [lastResult, setLastResult] = useState<ContentSafetyResult | null>(null);
  
  const validate = useCallback((content: string): ContentSafetyResult => {
    const result = checkContentSafety(content);
    setLastResult(result);
    return result;
  }, []);
  
  const validateMultiple = useCallback((...contents: (string | undefined | null)[]): ContentSafetyResult => {
    const result = checkMultipleContent(...contents);
    setLastResult(result);
    return result;
  }, []);
  
  const reset = useCallback(() => {
    setLastResult(null);
  }, []);
  
  return {
    validate,
    validateMultiple,
    reset,
    lastResult,
    isBlocked: lastResult?.isSafe === false,
  };
}

export default {
  checkContentSafety,
  checkMultipleContent,
  useContentSafety,
};
