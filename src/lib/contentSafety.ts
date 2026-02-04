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
  'nude', 'nudes', 'nudity', 'naked',
  'sex', 'sexual', 'sexually', 'sexualized',
  'erotic', 'erotica', 'hentai', 'lewd',
  'genitals', 'genital', 'breasts', 'boobs', 'nipples',
  'penis', 'dick', 'vagina', 'pussy',
  'intercourse', 'masturbate', 'orgasm',
  'blowjob', 'handjob', 'fetish', 'bondage',
  'stripper', 'striptease', 'escort', 'prostitute',
  'topless', 'bottomless', 'undressing',
  'seductive', 'provocative', 'aroused', 'horny',
  'sexy', 'sexier', 'sexiest', 'hottest',
  'lingerie', 'underwear', 'panties',
  'seductive', 'provocative', 'aroused', 'horny',
  'lingerie', 'underwear', 'panties',
  // Child safety - CRITICAL
  'underage', 'child porn', 'loli', 'shota', 'pedo',
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
];

/**
 * Violence terms
 */
const VIOLENCE_TERMS = new Set([
  'gore', 'gory', 'gruesome', 'dismember', 'decapitate',
  'torture', 'mutilate', 'eviscerate', 'disembowel',
  'suicide', 'self-harm',
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
