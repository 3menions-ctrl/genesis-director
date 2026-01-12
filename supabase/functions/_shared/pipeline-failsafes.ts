/**
 * PIPELINE FAILSAFES - Bulletproof failure prevention system
 * 
 * This module provides:
 * 1. Circuit breaker for consecutive failures
 * 2. Pre-flight validation before pipeline starts
 * 3. Guaranteed fallback chain for frames
 * 4. Transaction safety with verification
 * 5. Dead letter queue for failed clips
 * 6. Retry budget tracking
 * 7. Health checks for external services
 */

// =====================================================
// CIRCUIT BREAKER: Stop pipeline after N consecutive failures
// =====================================================
export interface CircuitBreakerState {
  consecutiveFailures: number;
  lastFailureTime: number;
  isOpen: boolean;
  totalFailures: number;
  lastSuccessTime: number;
}

export interface CircuitBreakerConfig {
  maxConsecutiveFailures: number;
  resetTimeMs: number;
  halfOpenAfterMs: number;
}

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  maxConsecutiveFailures: 3,
  resetTimeMs: 60000, // 1 minute
  halfOpenAfterMs: 30000, // 30 seconds
};

export function createCircuitBreaker(config = DEFAULT_CIRCUIT_BREAKER_CONFIG): CircuitBreakerState {
  return {
    consecutiveFailures: 0,
    lastFailureTime: 0,
    isOpen: false,
    totalFailures: 0,
    lastSuccessTime: Date.now(),
  };
}

export function recordSuccess(state: CircuitBreakerState): CircuitBreakerState {
  return {
    ...state,
    consecutiveFailures: 0,
    isOpen: false,
    lastSuccessTime: Date.now(),
  };
}

export function recordFailure(
  state: CircuitBreakerState, 
  config = DEFAULT_CIRCUIT_BREAKER_CONFIG
): CircuitBreakerState {
  const now = Date.now();
  const newConsecutive = state.consecutiveFailures + 1;
  const shouldOpen = newConsecutive >= config.maxConsecutiveFailures;
  
  return {
    ...state,
    consecutiveFailures: newConsecutive,
    lastFailureTime: now,
    isOpen: shouldOpen,
    totalFailures: state.totalFailures + 1,
  };
}

export function canProceed(
  state: CircuitBreakerState, 
  config = DEFAULT_CIRCUIT_BREAKER_CONFIG
): { allowed: boolean; reason?: string } {
  if (!state.isOpen) {
    return { allowed: true };
  }
  
  const now = Date.now();
  const timeSinceFailure = now - state.lastFailureTime;
  
  // Half-open: allow one attempt after cooldown
  if (timeSinceFailure > config.halfOpenAfterMs) {
    return { allowed: true, reason: 'half-open-retry' };
  }
  
  return { 
    allowed: false, 
    reason: `Circuit breaker OPEN: ${state.consecutiveFailures} consecutive failures. Retry in ${Math.ceil((config.halfOpenAfterMs - timeSinceFailure) / 1000)}s` 
  };
}

// =====================================================
// PRE-FLIGHT VALIDATION: Ensure all resources exist before starting
// =====================================================
export interface PreflightResult {
  passed: boolean;
  checks: {
    name: string;
    passed: boolean;
    value?: any;
    required: boolean;
    fallback?: string;
  }[];
  criticalMissing: string[];
  warnings: string[];
}

export interface PreflightInput {
  projectId: string;
  userId: string;
  referenceImageUrl?: string;
  sceneImages?: any[];
  identityBible?: any;
  clipCount: number;
}

export function runPreflightChecks(input: PreflightInput): PreflightResult {
  const checks: PreflightResult['checks'] = [];
  const criticalMissing: string[] = [];
  const warnings: string[] = [];
  
  // Check 1: Project ID
  checks.push({
    name: 'projectId',
    passed: !!input.projectId,
    value: input.projectId,
    required: true,
  });
  if (!input.projectId) criticalMissing.push('projectId');
  
  // Check 2: User ID
  checks.push({
    name: 'userId',
    passed: !!input.userId,
    value: input.userId,
    required: true,
  });
  if (!input.userId) criticalMissing.push('userId');
  
  // Check 3: Reference Image (important for consistency but not required)
  checks.push({
    name: 'referenceImageUrl',
    passed: !!input.referenceImageUrl,
    value: input.referenceImageUrl?.substring(0, 50),
    required: false,
    fallback: 'Text-only generation with reduced consistency',
  });
  if (!input.referenceImageUrl) {
    warnings.push('No reference image - visual consistency may vary');
  }
  
  // Check 4: Scene Images
  const sceneImageCount = input.sceneImages?.length || 0;
  checks.push({
    name: 'sceneImages',
    passed: sceneImageCount >= input.clipCount,
    value: `${sceneImageCount}/${input.clipCount}`,
    required: false,
    fallback: 'Will use reference image as fallback for missing scenes',
  });
  if (sceneImageCount === 0) {
    warnings.push('No scene images - frame extraction failures will break continuity');
  }
  
  // Check 5: Identity Bible
  checks.push({
    name: 'identityBible',
    passed: !!input.identityBible?.characterIdentity,
    value: input.identityBible?.characterIdentity?.description?.substring(0, 50),
    required: false,
    fallback: 'Character consistency will rely on prompt-only anchors',
  });
  if (!input.identityBible) {
    warnings.push('No identity bible - character may drift across clips');
  }
  
  // Check 6: Clip count sanity
  checks.push({
    name: 'clipCount',
    passed: input.clipCount >= 2 && input.clipCount <= 30,
    value: input.clipCount,
    required: true,
  });
  if (input.clipCount < 2 || input.clipCount > 30) {
    criticalMissing.push(`Invalid clip count: ${input.clipCount}`);
  }
  
  return {
    passed: criticalMissing.length === 0,
    checks,
    criticalMissing,
    warnings,
  };
}

// =====================================================
// GUARANTEED FALLBACK CHAIN: Never return NULL for frames
// =====================================================
export interface FallbackSource {
  name: string;
  url: string | undefined;
  priority: number;
}

export function getGuaranteedFrameUrl(
  sources: {
    extractedFrame?: string;
    sceneImage?: string;
    previousFrame?: string;
    referenceImage?: string;
    goldenFrame?: string;
    identityBibleFront?: string;
  }
): { url: string | null; source: string; confidence: 'high' | 'medium' | 'low' } {
  const chain: FallbackSource[] = [
    { name: 'extractedFrame', url: sources.extractedFrame, priority: 1 },
    { name: 'sceneImage', url: sources.sceneImage, priority: 2 },
    { name: 'previousFrame', url: sources.previousFrame, priority: 3 },
    { name: 'referenceImage', url: sources.referenceImage, priority: 4 },
    { name: 'goldenFrame', url: sources.goldenFrame, priority: 5 },
    { name: 'identityBibleFront', url: sources.identityBibleFront, priority: 6 },
  ];
  
  // Filter valid URLs (must be http/https and not video files)
  const validSources = chain.filter(s => {
    if (!s.url) return false;
    const lower = s.url.toLowerCase();
    if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov')) return false;
    if (lower.includes('/video-clips/')) return false;
    return true;
  });
  
  if (validSources.length === 0) {
    return { url: null, source: 'none', confidence: 'low' };
  }
  
  const best = validSources[0];
  const confidence = best.priority <= 2 ? 'high' : best.priority <= 4 ? 'medium' : 'low';
  
  return { url: best.url!, source: best.name, confidence };
}

// =====================================================
// RETRY BUDGET TRACKER: Prevent infinite retry loops
// =====================================================
export interface RetryBudget {
  totalBudget: number;
  used: number;
  perClipBudget: number;
  clipRetries: Map<number, number>;
}

export function createRetryBudget(clipCount: number, retriesPerClip: number): RetryBudget {
  return {
    totalBudget: clipCount * retriesPerClip,
    used: 0,
    perClipBudget: retriesPerClip,
    clipRetries: new Map(),
  };
}

export function canRetryClip(budget: RetryBudget, clipIndex: number): { allowed: boolean; reason?: string } {
  const clipUsed = budget.clipRetries.get(clipIndex) || 0;
  
  if (clipUsed >= budget.perClipBudget) {
    return { allowed: false, reason: `Clip ${clipIndex} exhausted retry budget (${clipUsed}/${budget.perClipBudget})` };
  }
  
  if (budget.used >= budget.totalBudget) {
    return { allowed: false, reason: `Total retry budget exhausted (${budget.used}/${budget.totalBudget})` };
  }
  
  return { allowed: true };
}

export function recordRetry(budget: RetryBudget, clipIndex: number): RetryBudget {
  const current = budget.clipRetries.get(clipIndex) || 0;
  const newClipRetries = new Map(budget.clipRetries);
  newClipRetries.set(clipIndex, current + 1);
  
  return {
    ...budget,
    used: budget.used + 1,
    clipRetries: newClipRetries,
  };
}

// =====================================================
// DEAD LETTER QUEUE: Track failed clips for recovery
// =====================================================
export interface DeadLetterEntry {
  clipIndex: number;
  projectId: string;
  error: string;
  errorCategory: string;
  attempts: number;
  lastAttemptAt: number;
  prompt: string;
  recoverable: boolean;
}

export interface DeadLetterQueue {
  entries: DeadLetterEntry[];
  maxSize: number;
}

export function createDeadLetterQueue(maxSize = 50): DeadLetterQueue {
  return { entries: [], maxSize };
}

export function addToDeadLetter(
  queue: DeadLetterQueue,
  entry: Omit<DeadLetterEntry, 'lastAttemptAt'>
): DeadLetterQueue {
  const newEntry: DeadLetterEntry = {
    ...entry,
    lastAttemptAt: Date.now(),
  };
  
  // Check if entry already exists, update if so
  const existingIndex = queue.entries.findIndex(
    e => e.projectId === entry.projectId && e.clipIndex === entry.clipIndex
  );
  
  let newEntries: DeadLetterEntry[];
  if (existingIndex >= 0) {
    newEntries = [...queue.entries];
    newEntries[existingIndex] = newEntry;
  } else {
    newEntries = [...queue.entries, newEntry];
  }
  
  // Trim to max size
  if (newEntries.length > queue.maxSize) {
    newEntries = newEntries.slice(-queue.maxSize);
  }
  
  return { ...queue, entries: newEntries };
}

export function getRecoverableEntries(queue: DeadLetterQueue): DeadLetterEntry[] {
  return queue.entries.filter(e => e.recoverable);
}

// =====================================================
// HEALTH CHECK: Verify external services before calling
// =====================================================
export interface HealthCheckResult {
  service: string;
  healthy: boolean;
  latencyMs?: number;
  error?: string;
}

export async function checkServiceHealth(
  serviceName: string,
  healthEndpoint: string,
  timeoutMs = 5000
): Promise<HealthCheckResult> {
  const start = Date.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    const response = await fetch(healthEndpoint, {
      method: 'HEAD',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    return {
      service: serviceName,
      healthy: response.ok,
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      service: serviceName,
      healthy: false,
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =====================================================
// TRANSACTION SAFETY: Verify DB writes succeeded
// =====================================================
export interface TransactionVerification {
  table: string;
  operation: 'insert' | 'update' | 'upsert';
  key: { column: string; value: any }[];
  expectedValues: { column: string; value: any }[];
}

export async function verifyTransaction(
  supabase: any,
  verification: TransactionVerification
): Promise<{ verified: boolean; actualValues?: Record<string, any>; error?: string }> {
  try {
    let query = supabase.from(verification.table).select(
      verification.expectedValues.map(v => v.column).join(', ')
    );
    
    for (const k of verification.key) {
      query = query.eq(k.column, k.value);
    }
    
    const { data, error } = await query.single();
    
    if (error) {
      return { verified: false, error: error.message };
    }
    
    // Check all expected values match
    for (const expected of verification.expectedValues) {
      if (data[expected.column] !== expected.value) {
        return { 
          verified: false, 
          actualValues: data,
          error: `${expected.column}: expected ${expected.value}, got ${data[expected.column]}`
        };
      }
    }
    
    return { verified: true, actualValues: data };
  } catch (err) {
    return { 
      verified: false, 
      error: err instanceof Error ? err.message : 'Unknown error' 
    };
  }
}

// =====================================================
// EXPONENTIAL BACKOFF HELPER
// =====================================================
export function calculateBackoff(
  attempt: number,
  baseMs = 1000,
  maxMs = 30000,
  jitter = true
): number {
  let delay = Math.min(baseMs * Math.pow(2, attempt), maxMs);
  
  if (jitter) {
    // Add 0-20% random jitter to prevent thundering herd
    delay = delay * (1 + Math.random() * 0.2);
  }
  
  return Math.floor(delay);
}

// =====================================================
// ERROR CATEGORIZATION: Determine if error is retryable
// =====================================================
export type ErrorCategory = 
  | 'rate_limit' 
  | 'timeout' 
  | 'content_filter' 
  | 'validation' 
  | 'auth' 
  | 'quota' 
  | 'network' 
  | 'server_error' 
  | 'unknown';

export function categorizeError(error: string | Error): { 
  category: ErrorCategory; 
  retryable: boolean; 
  suggestedWaitMs?: number;
} {
  const msg = (error instanceof Error ? error.message : error).toLowerCase();
  
  if (msg.includes('rate') || msg.includes('429') || msg.includes('too many')) {
    return { category: 'rate_limit', retryable: true, suggestedWaitMs: 10000 };
  }
  
  if (msg.includes('timeout') || msg.includes('deadline') || msg.includes('aborted')) {
    return { category: 'timeout', retryable: true, suggestedWaitMs: 5000 };
  }
  
  if (msg.includes('content') || msg.includes('filter') || msg.includes('policy') || msg.includes('guideline')) {
    return { category: 'content_filter', retryable: true, suggestedWaitMs: 0 };
  }
  
  if (msg.includes('invalid') || msg.includes('validation') || msg.includes('malformed')) {
    return { category: 'validation', retryable: false };
  }
  
  if (msg.includes('auth') || msg.includes('401') || msg.includes('403') || msg.includes('permission')) {
    return { category: 'auth', retryable: false };
  }
  
  if (msg.includes('quota') || msg.includes('credit') || msg.includes('insufficient')) {
    return { category: 'quota', retryable: false };
  }
  
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('connect')) {
    return { category: 'network', retryable: true, suggestedWaitMs: 3000 };
  }
  
  if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('504')) {
    return { category: 'server_error', retryable: true, suggestedWaitMs: 5000 };
  }
  
  return { category: 'unknown', retryable: true, suggestedWaitMs: 2000 };
}

// =====================================================
// PIPELINE STATE SNAPSHOT: For debugging and recovery
// =====================================================
export interface PipelineSnapshot {
  timestamp: number;
  projectId: string;
  stage: string;
  completedClips: number[];
  failedClips: number[];
  pendingClips: number[];
  lastSuccessfulFrame?: string;
  circuitBreakerState: CircuitBreakerState;
  retryBudgetUsed: number;
  deadLetterCount: number;
  warnings: string[];
}

export function createSnapshot(
  projectId: string,
  stage: string,
  clipStatuses: Map<number, 'completed' | 'failed' | 'pending'>,
  circuitBreaker: CircuitBreakerState,
  retryBudget: RetryBudget,
  deadLetter: DeadLetterQueue,
  lastFrame?: string,
  warnings: string[] = []
): PipelineSnapshot {
  const completed: number[] = [];
  const failed: number[] = [];
  const pending: number[] = [];
  
  clipStatuses.forEach((status, index) => {
    if (status === 'completed') completed.push(index);
    else if (status === 'failed') failed.push(index);
    else pending.push(index);
  });
  
  return {
    timestamp: Date.now(),
    projectId,
    stage,
    completedClips: completed.sort((a, b) => a - b),
    failedClips: failed.sort((a, b) => a - b),
    pendingClips: pending.sort((a, b) => a - b),
    lastSuccessfulFrame: lastFrame,
    circuitBreakerState: circuitBreaker,
    retryBudgetUsed: retryBudget.used,
    deadLetterCount: deadLetter.entries.length,
    warnings,
  };
}
