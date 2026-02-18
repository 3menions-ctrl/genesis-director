/**
 * CONTENT SAFETY MODULE
 * 
 * Comprehensive protection against NSFW, pornographic, and harmful content.
 * This module is the SINGLE SOURCE OF TRUTH for content moderation across the entire platform.
 * 
 * ZERO TOLERANCE POLICY:
 * - Any attempt to generate pornographic, sexually explicit, or NSFW content is BLOCKED
 * - No workarounds, no exceptions, no "artistic" exemptions
 */

// =====================================================
// BLOCKED CONTENT CATEGORIES
// =====================================================

/**
 * EXPLICIT SEXUAL TERMS - Immediate block, no processing
 * These terms have NO legitimate use case in video generation
 */
const EXPLICIT_SEXUAL_TERMS = [
  // Core explicit terms
  'porn', 'pornography', 'pornographic', 'xxx', 'nsfw',
  'nude', 'nudes', 'nudity', 'naked', 'nakedness',
  'sex', 'sexual', 'sexually', 'sexualized', 'sexuality',
  'erotic', 'erotica', 'eroticism',
  'hentai', 'ecchi', 'lewd', 'lewdness',
  
  // Body parts in explicit context
  'genitals', 'genital', 'genitalia',
  'breasts', 'boobs', 'tits', 'nipples', 'nipple',
  'penis', 'dick', 'cock', 'phallus',
  'vagina', 'pussy', 'vulva', 'clitoris',
  'buttocks', 'butt', 'ass', 'anus', 'anal',
  'testicles', 'balls', 'scrotum',
  
  // Sexual acts
  'intercourse', 'copulation', 'copulating',
  'masturbate', 'masturbation', 'masturbating',
  'orgasm', 'orgasmic', 'climax',
  'ejaculate', 'ejaculation', 'cumshot', 'cumming',
  'blowjob', 'handjob', 'footjob',
  'penetration', 'penetrate', 'penetrating',
  'fornicate', 'fornication',
  
  // Fetish and BDSM (non-educational context)
  'fetish', 'fetishize', 'fetishism',
  'bondage', 'bdsm', 'dominatrix',
  'sadomasochism', 'sadist', 'masochist',
  
  // Adult industry
  'stripper', 'stripping', 'striptease',
  'escort', 'prostitute', 'prostitution',
  'onlyfans', 'camgirl', 'camboy',
  'adult film', 'adult video', 'adult content',
  'x-rated', 'r-rated explicit',
  
  // Sexualized descriptions
  'topless', 'bottomless',
  'undressing', 'disrobing',
  'seductive', 'seduction', 'seduce',
  // NOTE: 'sensual' removed - false positives in cinematic prompts (e.g. "sensual lighting")
  // NOTE: 'provocative' removed - false positives in cinematic/political contexts
  'titillating',
  'aroused', 'arousing', 'arousal',
  'turned on', 'horny',
  // NOTE: 'sexy', 'hottest' removed - too broad, caught by phrase-level checks instead
  
  // Clothing that implies nudity
  'lingerie', 'panties',
  // NOTE: 'underwear', 'bra', 'bikini', 'swimsuit' removed - legitimate fashion/sports contexts
  // NOTE: 'revealing' removed - cinematic false positive (revealing lighting, revealing camera angle)
  
  // Age-related (CRITICAL - child safety)
  'underage', 'minor', 'child porn', 'cp',
  'jailbait', 'loli', 'lolita', 'shota',
  'pedophile', 'pedophilia', 'pedo',
];

/**
 * SUGGESTIVE PHRASES - Context-aware blocking
 * These phrases suggest sexual content even without explicit terms
 */
const SUGGESTIVE_PHRASES = [
  // Requests for nudity - includes variants with pronouns
  'take off clothes', 'remove clothes', 'without clothes',
  'take off her clothes', 'take off his clothes', 'take off their clothes',
  'taking off clothes', 'taking off her clothes', 'taking off his clothes',
  'take off shirt', 'take off pants', 'take off dress',
  'strip down', 'getting naked', 'getting undressed',
  'clothes off', 'shirt off', 'pants off',
  'undress her', 'undress him', 'undressing her', 'undressing him',
  
  // Sexual scenarios
  'in bed together', 'sleeping together', 'intimate moment',
  'making love', 'make love', 'having sex',
  'getting intimate', 'being intimate',
  'sexual encounter', 'sexual scene', 'love scene',
  'bedroom scene', 'adult scene',
  
  // Body-focused requests
  'show body', 'show skin', 'show flesh',
  'expose body', 'exposed body',
  'body close-up', 'curvy body',
  
  // Suggestive poses
  'seductive pose', 'sexy pose', 'provocative pose',
  'lying in bed', 'spread legs', 'bending over',
  
  // Romantic escalation
  'passionate kiss', 'french kiss', 'making out',
  'heavy petting', 'foreplay',
  
  // Contextual catches for removed broad terms
  'revealing outfit', 'revealing clothing', 'revealing dress',
  'sexy outfit', 'sexy clothing', 'sexy body',
  'sensual dancing', 'sensual touch', 'sensual pleasure',
  'provocative outfit', 'provocative clothing',
  'bikini model', 'swimsuit model', 'underwear model',
];

/**
 * VIOLENCE & GORE - Separate category but still blocked
 */
const VIOLENCE_TERMS = [
  'gore', 'gory', 'gruesome',
  'dismember', 'dismemberment', 'decapitate', 'decapitation',
  'torture', 'torturing', 'tortured',
  'mutilate', 'mutilation', 'mutilated',
  'eviscerate', 'disembowel',
  'suicide', 'self-harm', 'cutting',
];

/**
 * HATE & DISCRIMINATION
 */
const HATE_TERMS = [
  'nazi', 'hitler', 'swastika',
  'kkk', 'ku klux klan', 'white supremacy', 'white power',
  'racial slur', 'ethnic cleansing', 'genocide',
];

// =====================================================
// CONTENT SAFETY CHECK RESULT
// =====================================================

export interface ContentSafetyResult {
  isSafe: boolean;
  isBlocked: boolean;
  category: 'safe' | 'explicit_sexual' | 'suggestive' | 'violence' | 'hate' | 'unknown';
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  matchedTerms: string[];
  message: string;
  shouldLog: boolean;
}

// =====================================================
// MAIN CONTENT SAFETY CHECK
// =====================================================

/**
 * Check content for safety violations
 * This is the MAIN entry point for all content moderation
 */
export function checkContentSafety(content: string): ContentSafetyResult {
  if (!content || typeof content !== 'string') {
    return {
      isSafe: true,
      isBlocked: false,
      category: 'safe',
      severity: 'none',
      matchedTerms: [],
      message: 'Content is empty or invalid',
      shouldLog: false,
    };
  }
  
  // Normalize content for matching
  const normalizedContent = content.toLowerCase().trim();
  
  // Remove common obfuscation attempts
  const deobfuscated = deobfuscateContent(normalizedContent);
  
  const matchedTerms: string[] = [];
  
  // === CHECK 1: Explicit sexual terms (CRITICAL - immediate block) ===
  for (const term of EXPLICIT_SEXUAL_TERMS) {
    if (containsTerm(deobfuscated, term)) {
      matchedTerms.push(term);
    }
  }
  
  if (matchedTerms.length > 0) {
    console.log(`[ContentSafety] 🚫 BLOCKED - Explicit sexual content detected: ${matchedTerms.slice(0, 3).join(', ')}`);
    return {
      isSafe: false,
      isBlocked: true,
      category: 'explicit_sexual',
      severity: 'critical',
      matchedTerms,
      message: 'This content violates our community guidelines. Explicit, sexual, or NSFW content is not allowed.',
      shouldLog: true,
    };
  }
  
  // === CHECK 2: Suggestive phrases ===
  for (const phrase of SUGGESTIVE_PHRASES) {
    if (deobfuscated.includes(phrase)) {
      matchedTerms.push(phrase);
    }
  }
  
  if (matchedTerms.length > 0) {
    console.log(`[ContentSafety] 🚫 BLOCKED - Suggestive content detected: ${matchedTerms.slice(0, 3).join(', ')}`);
    return {
      isSafe: false,
      isBlocked: true,
      category: 'suggestive',
      severity: 'high',
      matchedTerms,
      message: 'This content appears to request inappropriate material. Please revise your prompt.',
      shouldLog: true,
    };
  }
  
  // === CHECK 3: Violence & Gore ===
  for (const term of VIOLENCE_TERMS) {
    if (containsTerm(deobfuscated, term)) {
      matchedTerms.push(term);
    }
  }
  
  if (matchedTerms.length > 0) {
    console.log(`[ContentSafety] ⚠️ BLOCKED - Violent content detected: ${matchedTerms.slice(0, 3).join(', ')}`);
    return {
      isSafe: false,
      isBlocked: true,
      category: 'violence',
      severity: 'high',
      matchedTerms,
      message: 'Graphic violence and gore are not permitted. Please create family-friendly content.',
      shouldLog: true,
    };
  }
  
  // === CHECK 4: Hate speech ===
  for (const term of HATE_TERMS) {
    if (containsTerm(deobfuscated, term)) {
      matchedTerms.push(term);
    }
  }
  
  if (matchedTerms.length > 0) {
    console.log(`[ContentSafety] 🚫 BLOCKED - Hate content detected: ${matchedTerms.slice(0, 3).join(', ')}`);
    return {
      isSafe: false,
      isBlocked: true,
      category: 'hate',
      severity: 'critical',
      matchedTerms,
      message: 'Hateful, discriminatory, or extremist content is strictly prohibited.',
      shouldLog: true,
    };
  }
  
  // Content passed all checks
  return {
    isSafe: true,
    isBlocked: false,
    category: 'safe',
    severity: 'none',
    matchedTerms: [],
    message: 'Content is safe',
    shouldLog: false,
  };
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Check if content contains a term (word boundary aware + substring check)
 */
function containsTerm(content: string, term: string): boolean {
  // For multi-word terms, simple substring check is sufficient
  if (term.includes(' ')) {
    return content.includes(term);
  }
  
  // For single words, ALWAYS use word boundary matching to avoid false positives
  // e.g. "butt" should NOT match "button", "ass" should NOT match "class"
  const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, 'i');
  return regex.test(content);
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Remove common obfuscation techniques
 * People try to bypass filters with spaces, numbers, symbols
 */
function deobfuscateContent(content: string): string {
  let result = content;
  
  // Replace common letter substitutions
  const substitutions: Record<string, string> = {
    '0': 'o',
    '1': 'i',
    '3': 'e',
    '4': 'a',
    '5': 's',
    '7': 't',
    '8': 'b',
    '@': 'a',
    '$': 's',
    '!': 'i',
    '*': '',
    '_': '',
    '-': '',
    '.': '',
  };
  
  for (const [char, replacement] of Object.entries(substitutions)) {
    result = result.split(char).join(replacement);
  }
  
  // Remove zero-width characters
  result = result.replace(/[\u200B-\u200D\uFEFF]/g, '');
  
  // CRITICAL: Detect spaced-out words like "n u d e" → "nude"
  // Also catch patterns like "s.e.x.y" or "n_u_d_e"
  // First create a spaceless version for catching these tricks
  const spacelessVersion = result.replace(/\s+/g, '');
  
  // Check explicit terms against the spaceless version too
  // We'll return both versions concatenated so the matcher can check both
  const normalizedWithSpaces = result.replace(/\s+/g, ' ').trim();
  
  return `${normalizedWithSpaces} ${spacelessVersion}`;
}

// =====================================================
// BATCH CONTENT CHECK
// =====================================================

/**
 * Check multiple content strings at once
 * Returns blocked if ANY content is unsafe
 */
export function checkMultipleContent(contents: (string | undefined | null)[]): ContentSafetyResult {
  const validContents = contents.filter((c): c is string => typeof c === 'string' && c.length > 0);
  
  for (const content of validContents) {
    const result = checkContentSafety(content);
    if (!result.isSafe) {
      return result;
    }
  }
  
  return {
    isSafe: true,
    isBlocked: false,
    category: 'safe',
    severity: 'none',
    matchedTerms: [],
    message: 'All content is safe',
    shouldLog: false,
  };
}

// =====================================================
// SAFE CONTENT ENFORCEMENT FOR AI PROMPTS
// =====================================================

/**
 * Add safety instructions to AI generation prompts
 * This is a SECONDARY defense layer - primary blocking should prevent reaching this
 */
export function getSafetyInstructions(): string {
  return `
═══════════════════════════════════════════════════════════════════════════════
CONTENT SAFETY POLICY - MANDATORY COMPLIANCE
═══════════════════════════════════════════════════════════════════════════════

You MUST NOT generate content that includes:
- Nudity, partial nudity, or sexually suggestive content
- Sexual acts, innuendo, or romantic physical intimacy beyond a brief kiss
- Explicit or implicit sexual scenarios
- Revealing clothing, lingerie, or swimwear in sexualized context
- Violence, gore, torture, or graphic injury
- Hate speech, discrimination, or extremist content
- Content sexualizing minors in ANY way

If the user's request violates these guidelines:
1. DO NOT generate the content
2. Generate a safe, family-friendly alternative instead
3. Focus on action, adventure, drama, comedy, or educational content

This is NON-NEGOTIABLE. Platform integrity depends on strict compliance.
═══════════════════════════════════════════════════════════════════════════════
`;
}

/**
 * Get negative prompt additions for image/video generation
 */
export function getSafetyNegativePrompts(): string[] {
  return [
    'nsfw',
    'nude',
    'naked',
    'explicit',
    'sexual',
    'pornographic',
    'erotic',
    'revealing clothing',
    'lingerie',
    'underwear',
    'gore',
    'violence',
    'blood',
    'injury',
  ];
}

export default {
  checkContentSafety,
  checkMultipleContent,
  getSafetyInstructions,
  getSafetyNegativePrompts,
};
