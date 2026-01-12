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
  
  // Step 2: Try direct parse
  try {
    const data = JSON.parse(jsonStr) as T;
    return { success: true, data };
  } catch (e) {
    console.log('[JSON Recovery] Direct parse failed, attempting recovery...');
  }
  
  // Step 3: Try to find JSON object/array in the content
  const jsonObjectMatch = jsonStr.match(/(\{[\s\S]*\})/);
  const jsonArrayMatch = jsonStr.match(/(\[[\s\S]*\])/);
  
  const potentialJson = jsonObjectMatch?.[1] || jsonArrayMatch?.[1];
  if (potentialJson) {
    try {
      const data = JSON.parse(potentialJson) as T;
      console.log('[JSON Recovery] Extracted JSON from content');
      return { success: true, data };
    } catch (e) {
      console.log('[JSON Recovery] Extracted content still invalid');
    }
  }
  
  // Step 4: Try common fixes
  let fixedJson = jsonStr
    // Fix trailing commas
    .replace(/,\s*([}\]])/g, '$1')
    // Fix unquoted keys
    .replace(/(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
    // Fix single quotes to double quotes
    .replace(/'/g, '"')
    // Fix newlines in strings
    .replace(/[\n\r]+/g, ' ');
  
  try {
    const data = JSON.parse(fixedJson) as T;
    console.log('[JSON Recovery] Fixed common issues and parsed');
    return { success: true, data };
  } catch (e) {
    console.log('[JSON Recovery] Common fixes failed');
  }
  
  // Step 5: Try fallback extractor if provided
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

/**
 * Detect dialogue and narration from user input
 * Patterns detected:
 * - Quoted text: "Hello world"
 * - Character dialogue: CHARACTER: "Line" or CHARACTER says "Line"
 * - Narration markers: [NARRATION], (voiceover), VO:
 * - Script format: INT./EXT. scenes
 */
export function detectUserContent(text: string): DetectedContent {
  if (!text || typeof text !== 'string') {
    return {
      hasDialogue: false,
      hasNarration: false,
      dialogueLines: [],
      narrationText: '',
      estimatedDurationSeconds: 36,
      recommendedClipCount: 6,
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
  // Each clip is 6 seconds = 15 words per clip comfortable pace
  const WORDS_PER_SECOND = 2.5;
  const CLIP_DURATION = 6;
  const WORDS_PER_CLIP = WORDS_PER_SECOND * CLIP_DURATION;
  
  const estimatedDurationSeconds = Math.max(36, Math.ceil(wordCount / WORDS_PER_SECOND));
  let recommendedClipCount = Math.max(6, Math.ceil(wordCount / WORDS_PER_CLIP));
  
  // Cap at reasonable maximum
  recommendedClipCount = Math.min(recommendedClipCount, 30);
  
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
 */
export function calculateMaxTokens(
  clipCount: number,
  baseTokensPerClip: number = 150,
  minTokens: number = 800,
  maxTokens: number = 4000
): number {
  const calculated = clipCount * baseTokensPerClip;
  return Math.max(minTokens, Math.min(calculated, maxTokens));
}
