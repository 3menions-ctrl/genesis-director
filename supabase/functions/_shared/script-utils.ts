// Shared utilities for script generation functions
// Includes: retry logic, input validation, JSON recovery, content detection

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============= INPUT VALIDATION =============

export interface ValidationResult {
  valid: boolean;
  sanitized: string;
  errors: string[];
}

const MAX_PROMPT_LENGTH = 10000;
const MAX_SCRIPT_LENGTH = 50000;
const MIN_PROMPT_LENGTH = 3;

/**
 * Sanitize and validate user input text
 * Prevents prompt injection and ensures reasonable limits
 */
export function validateInput(
  input: string | undefined | null,
  options: {
    maxLength?: number;
    minLength?: number;
    fieldName?: string;
    required?: boolean;
  } = {}
): ValidationResult {
  const {
    maxLength = MAX_PROMPT_LENGTH,
    minLength = 0,
    fieldName = 'input',
    required = false,
  } = options;

  const errors: string[] = [];
  
  if (!input || typeof input !== 'string') {
    if (required) {
      errors.push(`${fieldName} is required`);
    }
    return { valid: !required, sanitized: '', errors };
  }

  // Trim and normalize whitespace
  let sanitized = input.trim().replace(/\s+/g, ' ');
  
  // Check length limits
  if (sanitized.length < minLength) {
    errors.push(`${fieldName} must be at least ${minLength} characters`);
  }
  
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
    console.warn(`[Validation] ${fieldName} truncated from ${input.length} to ${maxLength} chars`);
  }

  // Remove potential prompt injection patterns
  // These patterns could manipulate AI behavior
  const injectionPatterns = [
    /ignore previous instructions/gi,
    /disregard all prior/gi,
    /forget everything/gi,
    /you are now/gi,
    /new instructions:/gi,
    /system:/gi,
    /\[SYSTEM\]/gi,
  ];

  for (const pattern of injectionPatterns) {
    if (pattern.test(sanitized)) {
      sanitized = sanitized.replace(pattern, '[FILTERED]');
      console.warn(`[Validation] Potential injection pattern filtered in ${fieldName}`);
    }
  }

  return {
    valid: errors.length === 0,
    sanitized,
    errors,
  };
}

/**
 * Validate array of strings (e.g., dialogue lines)
 */
export function validateStringArray(
  arr: string[] | undefined | null,
  maxItems: number = 50,
  maxItemLength: number = 500
): string[] {
  if (!Array.isArray(arr)) return [];
  
  return arr
    .slice(0, maxItems)
    .map(item => {
      if (typeof item !== 'string') return '';
      return item.trim().substring(0, maxItemLength);
    })
    .filter(item => item.length > 0);
}

// ============= API RETRY WITH BACKOFF =============

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryOn?: number[];
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  retryOn: [429, 500, 502, 503, 504],
};

/**
 * Fetch with exponential backoff retry
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retryOptions: RetryOptions = {}
): Promise<Response> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...retryOptions };
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // If response is OK or not a retryable status, return it
      if (response.ok || !config.retryOn.includes(response.status)) {
        return response;
      }
      
      // Log retry attempt
      console.warn(
        `[Retry] Attempt ${attempt + 1}/${config.maxRetries + 1} failed with status ${response.status}`
      );
      
      // If this was the last attempt, return the response anyway
      if (attempt === config.maxRetries) {
        return response;
      }
      
      // Calculate delay with exponential backoff + jitter
      const delay = Math.min(
        config.baseDelayMs * Math.pow(2, attempt) + Math.random() * 500,
        config.maxDelayMs
      );
      
      console.log(`[Retry] Waiting ${Math.round(delay)}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[Retry] Network error on attempt ${attempt + 1}:`, lastError.message);
      
      if (attempt === config.maxRetries) {
        throw lastError;
      }
      
      // Wait before retrying on network errors
      const delay = config.baseDelayMs * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

// ============= JSON PARSE RECOVERY =============

/**
 * Attempt to parse JSON with recovery for common AI output issues
 */
export function parseJsonWithRecovery<T>(
  rawContent: string,
  fallbackExtractor?: (content: string) => T | null
): { success: boolean; data: T | null; error?: string } {
  if (!rawContent || typeof rawContent !== 'string') {
    return { success: false, data: null, error: 'Empty or invalid content' };
  }

  let jsonStr = rawContent.trim();
  
  // Step 1: Try to extract JSON from markdown code blocks
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }
  
  // Step 2: Try direct parse first
  try {
    const data = JSON.parse(jsonStr) as T;
    return { success: true, data };
  } catch (e) {
    console.log('[JSON Recovery] Direct parse failed, attempting recovery...');
  }
  
  // Step 3: Try to find and extract JSON object/array
  // Look for the outermost { } or [ ]
  let braceStart = jsonStr.indexOf('{');
  let bracketStart = jsonStr.indexOf('[');
  
  let startChar = '{';
  let endChar = '}';
  let startPos = braceStart;
  
  if (bracketStart !== -1 && (braceStart === -1 || bracketStart < braceStart)) {
    startChar = '[';
    endChar = ']';
    startPos = bracketStart;
  }
  
  if (startPos !== -1) {
    // Find matching closing bracket by counting
    let depth = 0;
    let endPos = -1;
    let inString = false;
    let escapeNext = false;
    
    for (let i = startPos; i < jsonStr.length; i++) {
      const char = jsonStr[i];
      
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      
      if (char === '\\') {
        escapeNext = true;
        continue;
      }
      
      if (char === '"') {
        inString = !inString;
        continue;
      }
      
      if (!inString) {
        if (char === startChar) depth++;
        if (char === endChar) {
          depth--;
          if (depth === 0) {
            endPos = i;
            break;
          }
        }
      }
    }
    
    if (endPos !== -1) {
      const extracted = jsonStr.substring(startPos, endPos + 1);
      try {
        const data = JSON.parse(extracted) as T;
        console.log('[JSON Recovery] Extracted and parsed JSON successfully');
        return { success: true, data };
      } catch (e) {
        console.log('[JSON Recovery] Extracted content still invalid, trying fixes...');
        
        // Try common fixes on extracted content
        let fixedJson = extracted
          // Fix trailing commas before closing brackets
          .replace(/,\s*([}\]])/g, '$1')
          // Fix unescaped newlines in strings (replace with space)
          .replace(/([^\\])[\n\r]+/g, '$1 ')
          // Remove control characters
          .replace(/[\x00-\x1F\x7F]/g, ' ');
        
        try {
          const data = JSON.parse(fixedJson) as T;
          console.log('[JSON Recovery] Fixed common issues and parsed');
          return { success: true, data };
        } catch (e2) {
          console.log('[JSON Recovery] Common fixes failed');
        }
      }
    }
  }
  
  // Step 4: Try fallback extractor if provided
  if (fallbackExtractor) {
    try {
      const data = fallbackExtractor(rawContent);
      if (data) {
        console.log('[JSON Recovery] Fallback extractor succeeded');
        return { success: true, data };
      }
    } catch (e) {
      console.log('[JSON Recovery] Fallback extractor failed');
    }
  }
  
  return { 
    success: false, 
    data: null, 
    error: 'Failed to parse JSON after all recovery attempts' 
  };
}

// ============= CONTENT DETECTION =============

export interface DetectedContent {
  hasDialogue: boolean;
  hasNarration: boolean;
  dialogueLines: string[];
  narrationText: string;
  estimatedDurationSeconds: number;
  recommendedClipCount: number;
}

// ============= USER INTENT EXTRACTION =============

export interface UserIntent {
  coreAction: string;        // The primary action/event the user wants to see
  keyElements: string[];     // Critical visual elements that MUST appear
  forbiddenElements: string[]; // Things the user explicitly does NOT want
  contextualDetails: string; // Supporting details (setting, mood, etc.)
  preservationPriority: 'action' | 'character' | 'environment' | 'balanced';
}

/**
 * Extract user's core intent from their input
 * This is used to validate that generated scripts actually contain what the user asked for
 */
export function extractUserIntent(userInput: string): UserIntent {
  if (!userInput || typeof userInput !== 'string') {
    return {
      coreAction: '',
      keyElements: [],
      forbiddenElements: [],
      contextualDetails: '',
      preservationPriority: 'balanced',
    };
  }

  const normalizedInput = userInput.toLowerCase();
  
  // Extract action verbs and dramatic events
  const actionPatterns = [
    // Dramatic events
    /(?:an?\s+)?(asteroid|meteor|comet)\s+(?:impact|crash|strike|hit|collid)/gi,
    /(?:an?\s+)?(explosion|blast|eruption|detonation)/gi,
    /(?:an?\s+)?(battle|fight|war|conflict|combat)/gi,
    /(?:an?\s+)?(storm|hurricane|tornado|tsunami|earthquake)/gi,
    /(?:an?\s+)?(chase|pursuit|escape|race)/gi,
    /(?:an?\s+)?(transformation|metamorphosis|change|evolution)/gi,
    /(?:an?\s+)?(attack|assault|invasion|raid)/gi,
    /(?:an?\s+)?(rescue|save|liberation|escape)/gi,
    /(?:an?\s+)?(discovery|revelation|finding)/gi,
    // Character actions
    /(running|walking|flying|swimming|climbing|falling|jumping|dancing)/gi,
    /(fighting|battling|defending|attacking|shooting)/gi,
    /(speaking|singing|crying|laughing|screaming)/gi,
    /(building|creating|destroying|breaking)/gi,
    // Camera/cinematographic intentions
    /(close-?up|wide shot|pan|zoom|tracking shot)/gi,
  ];
  
  const keyElements: string[] = [];
  let coreAction = '';
  
  for (const pattern of actionPatterns) {
    let match;
    while ((match = pattern.exec(userInput)) !== null) {
      const element = match[0].trim();
      if (!keyElements.includes(element.toLowerCase())) {
        keyElements.push(element.toLowerCase());
        if (!coreAction && element.length > 3) {
          coreAction = element;
        }
      }
    }
  }
  
  // Extract "not" or "no" constraints
  const forbiddenPatterns = [
    /\b(?:no|not|without|don'?t|avoid|exclude)\s+(\w+(?:\s+\w+)?)/gi,
    /\b(?:never|shouldn'?t)\s+(\w+(?:\s+\w+)?)/gi,
  ];
  
  const forbiddenElements: string[] = [];
  for (const pattern of forbiddenPatterns) {
    let match;
    while ((match = pattern.exec(userInput)) !== null) {
      forbiddenElements.push(match[1].toLowerCase());
    }
  }
  
  // Determine preservation priority based on input
  let preservationPriority: UserIntent['preservationPriority'] = 'balanced';
  
  // Action-heavy content
  if (/impact|crash|explosion|attack|battle|chase/i.test(userInput)) {
    preservationPriority = 'action';
  } 
  // Character-focused content
  else if (/character|person|protagonist|hero|villain|face|expression/i.test(userInput)) {
    preservationPriority = 'character';
  }
  // Environment-focused content
  else if (/landscape|setting|environment|scenery|location/i.test(userInput)) {
    preservationPriority = 'environment';
  }
  
  // Extract contextual details (everything not captured above)
  const contextualDetails = userInput
    .replace(/\b(?:no|not|without|don'?t|avoid|exclude|never|shouldn'?t)\s+\w+(?:\s+\w+)?/gi, '')
    .trim();
  
  console.log(`[UserIntent] Extracted - Core: "${coreAction}", Elements: [${keyElements.join(', ')}], Priority: ${preservationPriority}`);
  
  return {
    coreAction,
    keyElements,
    forbiddenElements,
    contextualDetails,
    preservationPriority,
  };
}

/**
 * Validate that a generated script contains the user's core intent
 * Returns a score from 0-100 and specific issues found
 */
export function validateScriptAgainstIntent(
  script: string,
  userIntent: UserIntent
): { score: number; issues: string[]; passed: boolean } {
  const issues: string[] = [];
  let score = 100;
  
  const normalizedScript = script.toLowerCase();
  
  // Check for core action presence (MOST CRITICAL)
  if (userIntent.coreAction) {
    const coreActionVariants = [
      userIntent.coreAction.toLowerCase(),
      // Handle common word variations
      userIntent.coreAction.toLowerCase().replace('impact', 'crash'),
      userIntent.coreAction.toLowerCase().replace('crash', 'impact'),
      userIntent.coreAction.toLowerCase().replace('explosion', 'blast'),
    ];
    
    const hasCore = coreActionVariants.some(variant => 
      normalizedScript.includes(variant)
    );
    
    if (!hasCore) {
      issues.push(`CRITICAL: Script missing core action "${userIntent.coreAction}"`);
      score -= 40;
    }
  }
  
  // Check for key elements
  let elementsFound = 0;
  for (const element of userIntent.keyElements) {
    if (normalizedScript.includes(element.toLowerCase())) {
      elementsFound++;
    } else {
      issues.push(`Missing key element: "${element}"`);
      score -= 10;
    }
  }
  
  // Check forbidden elements aren't present
  for (const forbidden of userIntent.forbiddenElements) {
    if (normalizedScript.includes(forbidden.toLowerCase())) {
      issues.push(`Script contains forbidden element: "${forbidden}"`);
      score -= 15;
    }
  }
  
  // Clamp score
  score = Math.max(0, Math.min(100, score));
  
  return {
    score,
    issues,
    passed: score >= 60 && !issues.some(i => i.startsWith('CRITICAL')),
  };
}

// ============= NON-CHARACTER SUBJECT DETECTION =============

const NON_CHARACTER_PATTERNS: RegExp[] = [
  /\b(space\s*shuttle|rocket|spacecraft|spaceship|satellite|probe)\b/i,
  /\b(airplane|aircraft|jet|helicopter|drone|plane)\b/i,
  /\b(car|truck|bus|motorcycle|vehicle|train|ship|boat|submarine)\b/i,
  /\b(asteroid|meteor|comet|meteorite)\s*(impact|crash|strike|hit|collid|fall)/i,
  /\b(explosion|blast|eruption|nuclear|atomic)\b/i,
  /\b(volcano|earthquake|tsunami|hurricane|tornado|storm)\b/i,
  /\b(landscape|scenery|vista|panorama|cityscape|skyline)\b/i,
];

const CHARACTER_INDICATORS: RegExp[] = [
  /\b(person|man|woman|boy|girl|child|adult|human|people|character)\b/i,
  /\b(he|she|they)\b/i,
  /\b(protagonist|hero|villain|narrator|actor)\b/i,
];

export function detectNonCharacterSubject(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const hasNonCharacterPatterns = NON_CHARACTER_PATTERNS.some(p => p.test(text));
  const hasCharacterIndicators = CHARACTER_INDICATORS.some(p => p.test(text));
  return hasNonCharacterPatterns && !hasCharacterIndicators;
}

/**
 * Detect dialogue and narration from user input
 * Patterns detected:
 * - Quoted text: "Hello world"
 * - Character dialogue: CHARACTER: "Line" or CHARACTER says "Line"
 * - Narration markers: [NARRATION], (voiceover), VO:
 * - Script format: INT./EXT. scenes
 */
/**
 * Detect dialogue and narration from user input
 * @param text - User input text to analyze
 * @param explicitClipCount - If provided, this OVERRIDES any calculated clip count
 */
export function detectUserContent(text: string, explicitClipCount?: number): DetectedContent {
  // If explicit clip count provided, use it - this is the user's selection
  const defaultClipCount = explicitClipCount && explicitClipCount > 0 ? explicitClipCount : 6;
  
  if (!text || typeof text !== 'string') {
    return {
      hasDialogue: false,
      hasNarration: false,
      dialogueLines: [],
      narrationText: '',
      estimatedDurationSeconds: defaultClipCount * 5, // Match clip count
      recommendedClipCount: defaultClipCount,
    };
  }

  const dialogueLines: string[] = [];
  let narrationText = '';
  
  // Detect quoted dialogue
  const quotedRegex = /"([^"]+)"/g;
  let match;
  while ((match = quotedRegex.exec(text)) !== null) {
    if (match[1].length > 2) { // Ignore very short quotes
      dialogueLines.push(match[1]);
    }
  }
  
  // Detect character dialogue patterns: NAME: "text" or NAME says "text"
  const characterDialogueRegex = /([A-Z][A-Z\s]+):\s*["']?([^"'\n]+)["']?/g;
  while ((match = characterDialogueRegex.exec(text)) !== null) {
    const line = match[2].trim();
    if (line.length > 2 && !dialogueLines.includes(line)) {
      dialogueLines.push(line);
    }
  }
  
  // Detect "says" pattern
  const saysRegex = /([A-Z][a-z]+)\s+says?\s*[,:]\s*["']([^"']+)["']/gi;
  while ((match = saysRegex.exec(text)) !== null) {
    const line = match[2].trim();
    if (!dialogueLines.includes(line)) {
      dialogueLines.push(line);
    }
  }
  
  // Detect narration patterns
  const narrationPatterns = [
    /\[NARRATION\]:?\s*([^\[\]]+)/gi,
    /\(voiceover\):?\s*([^\(\)]+)/gi,
    /\(V\.?O\.?\):?\s*([^\(\)]+)/gi,
    /VO:?\s*["']?([^"'\n]+)["']?/gi,
    /NARRATOR:?\s*["']?([^"'\n]+)["']?/gi,
  ];
  
  for (const pattern of narrationPatterns) {
    while ((match = pattern.exec(text)) !== null) {
      narrationText += (narrationText ? ' ' : '') + match[1].trim();
    }
  }
  
  // If no explicit narration found but text has prose-like structure, treat as narration
  if (!narrationText && dialogueLines.length === 0) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    if (sentences.length >= 2) {
      narrationText = text;
    }
  }
  
  // Calculate duration based on content
  const allText = [...dialogueLines, narrationText].join(' ');
  const wordCount = allText.split(/\s+/).filter(w => w.length > 0).length;
  
  // Average speaking rate: 150 words per minute = 2.5 words per second
  // Default clip duration: 5s for standard video, 10s for avatar mode (passed via explicitClipCount logic)
  // Avatar mode should pre-calculate with 10s clips before calling this function
  const WORDS_PER_SECOND = 2.5;
  const CLIP_DURATION = 10; // Updated: 10-second clips for avatar (Kling v2.6 max), adjust externally for other modes
  const WORDS_PER_CLIP = WORDS_PER_SECOND * CLIP_DURATION;
  
  const estimatedDurationSeconds = Math.max(30, Math.ceil(wordCount / WORDS_PER_SECOND));
  
  // If explicit clip count was provided, use it; otherwise calculate from content
  let recommendedClipCount: number;
  if (explicitClipCount && explicitClipCount > 0) {
    recommendedClipCount = explicitClipCount;
    console.log(`[ContentDetection] Using EXPLICIT clip count: ${explicitClipCount}`);
  } else {
    // Allow dynamic clip counts - minimum 1 shot, max 30
    recommendedClipCount = Math.max(1, Math.ceil(wordCount / WORDS_PER_CLIP));
    // Cap at reasonable maximum for long-form content
    recommendedClipCount = Math.min(recommendedClipCount, 30);
  }
  
  console.log(`[ContentDetection] Words: ${wordCount}, Duration: ${estimatedDurationSeconds}s, Clips: ${recommendedClipCount}`);
  
  return {
    hasDialogue: dialogueLines.length > 0,
    hasNarration: narrationText.length > 0,
    dialogueLines,
    narrationText,
    estimatedDurationSeconds,
    recommendedClipCount,
  };
}

// ============= RESPONSE HELPERS =============

export function errorResponse(
  message: string,
  status: number = 500
): Response {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

export function successResponse<T>(data: T): Response {
  return new Response(
    JSON.stringify({ success: true, ...data }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ============= TOKEN CALCULATION =============

/**
 * Calculate appropriate max_tokens for OpenAI based on content
 * For JSON output (like smart-script-generator), use higher tokensPerClip (400+)
 * For text output (like generate-script), use lower tokensPerClip (120-150)
 */
export function calculateMaxTokens(
  clipCount: number,
  baseTokensPerClip: number = 150,
  minTokens: number = 1000,
  maxTokens: number = 4096
): number {
  const calculated = clipCount * baseTokensPerClip;
  return Math.max(minTokens, Math.min(calculated, maxTokens));
}
