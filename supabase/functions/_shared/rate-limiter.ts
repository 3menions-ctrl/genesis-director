/**
 * Rate Limiter & Circuit Breaker for High-Traffic Production Pipeline
 * 
 * Features:
 * - Token bucket rate limiting per user/project
 * - Circuit breaker pattern to prevent cascade failures
 * - Request queuing with priority levels
 * - Adaptive backoff based on API response times
 */

// =====================================================
// RATE LIMITER - Token Bucket Algorithm
// =====================================================

interface RateLimitConfig {
  maxTokens: number;       // Maximum burst capacity
  refillRate: number;      // Tokens per second
  windowMs: number;        // Time window in ms
}

interface RateLimitState {
  tokens: number;
  lastRefill: number;
}

// In-memory rate limit storage (per edge function instance)
const rateLimitStates = new Map<string, RateLimitState>();

// Tier-based rate limits
export const RATE_LIMIT_TIERS: Record<string, RateLimitConfig> = {
  free: { maxTokens: 3, refillRate: 0.1, windowMs: 60000 },      // 3 concurrent, 6/min
  pro: { maxTokens: 5, refillRate: 0.2, windowMs: 60000 },       // 5 concurrent, 12/min
  growth: { maxTokens: 10, refillRate: 0.5, windowMs: 60000 },   // 10 concurrent, 30/min
  agency: { maxTokens: 20, refillRate: 1.0, windowMs: 60000 },   // 20 concurrent, 60/min
};

export function checkRateLimit(
  key: string, 
  tier: string = 'free'
): { allowed: boolean; remainingTokens: number; retryAfterMs?: number } {
  const config = RATE_LIMIT_TIERS[tier] || RATE_LIMIT_TIERS.free;
  const now = Date.now();
  
  let state = rateLimitStates.get(key);
  
  if (!state) {
    state = { tokens: config.maxTokens, lastRefill: now };
    rateLimitStates.set(key, state);
  }
  
  // Refill tokens based on time elapsed
  const elapsed = now - state.lastRefill;
  const refillTokens = (elapsed / 1000) * config.refillRate;
  state.tokens = Math.min(config.maxTokens, state.tokens + refillTokens);
  state.lastRefill = now;
  
  // Check if we can consume a token
  if (state.tokens >= 1) {
    state.tokens -= 1;
    return { allowed: true, remainingTokens: Math.floor(state.tokens) };
  }
  
  // Calculate retry after time
  const tokensNeeded = 1 - state.tokens;
  const retryAfterMs = Math.ceil((tokensNeeded / config.refillRate) * 1000);
  
  return { 
    allowed: false, 
    remainingTokens: 0,
    retryAfterMs 
  };
}

export function releaseRateLimit(key: string): void {
  const state = rateLimitStates.get(key);
  if (state) {
    state.tokens = Math.min(
      RATE_LIMIT_TIERS.agency.maxTokens, // Max possible
      state.tokens + 1
    );
  }
}

// =====================================================
// CIRCUIT BREAKER - Prevent Cascade Failures
// =====================================================

type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitConfig {
  failureThreshold: number;      // Failures before opening
  successThreshold: number;      // Successes to close from half-open
  timeout: number;               // Time to wait before half-open (ms)
  monitoringWindow: number;      // Window to count failures (ms)
}

interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number;
  lastStateChange: number;
}

const circuitBreakers = new Map<string, CircuitBreakerState>();

const DEFAULT_CIRCUIT_CONFIG: CircuitConfig = {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 30000,        // 30 seconds
  monitoringWindow: 60000, // 1 minute
};

// Service-specific circuit configs
export const CIRCUIT_CONFIGS: Record<string, CircuitConfig> = {
  'veo-api': { 
    failureThreshold: 3, 
    successThreshold: 2, 
    timeout: 60000,  // Veo needs longer recovery
    monitoringWindow: 120000 
  },
  'cloud-run-stitch': { 
    failureThreshold: 5, 
    successThreshold: 3, 
    timeout: 30000, 
    monitoringWindow: 60000 
  },
  'openai-api': { 
    failureThreshold: 5, 
    successThreshold: 2, 
    timeout: 15000, 
    monitoringWindow: 60000 
  },
  'elevenlabs-api': { 
    failureThreshold: 4, 
    successThreshold: 2, 
    timeout: 20000, 
    monitoringWindow: 60000 
  },
};

export function getCircuitBreaker(serviceName: string): CircuitBreakerState {
  let breaker = circuitBreakers.get(serviceName);
  
  if (!breaker) {
    breaker = {
      state: 'closed',
      failures: 0,
      successes: 0,
      lastFailureTime: 0,
      lastStateChange: Date.now(),
    };
    circuitBreakers.set(serviceName, breaker);
  }
  
  return breaker;
}

export function canExecute(serviceName: string): { 
  allowed: boolean; 
  state: CircuitState;
  retryAfterMs?: number;
} {
  const breaker = getCircuitBreaker(serviceName);
  const config = CIRCUIT_CONFIGS[serviceName] || DEFAULT_CIRCUIT_CONFIG;
  const now = Date.now();
  
  switch (breaker.state) {
    case 'closed':
      return { allowed: true, state: 'closed' };
      
    case 'open': {
      const timeSinceLastFailure = now - breaker.lastStateChange;
      
      if (timeSinceLastFailure >= config.timeout) {
        // Transition to half-open
        breaker.state = 'half-open';
        breaker.successes = 0;
        breaker.lastStateChange = now;
        console.log(`[CircuitBreaker] ${serviceName}: OPEN -> HALF-OPEN (testing)`);
        return { allowed: true, state: 'half-open' };
      }
      
      return { 
        allowed: false, 
        state: 'open',
        retryAfterMs: config.timeout - timeSinceLastFailure
      };
    }
      
    case 'half-open':
      // Allow limited requests to test recovery
      return { allowed: true, state: 'half-open' };
      
    default:
      return { allowed: true, state: 'closed' };
  }
}

export function recordSuccess(serviceName: string): void {
  const breaker = getCircuitBreaker(serviceName);
  const config = CIRCUIT_CONFIGS[serviceName] || DEFAULT_CIRCUIT_CONFIG;
  
  if (breaker.state === 'half-open') {
    breaker.successes++;
    
    if (breaker.successes >= config.successThreshold) {
      breaker.state = 'closed';
      breaker.failures = 0;
      breaker.successes = 0;
      breaker.lastStateChange = Date.now();
      console.log(`[CircuitBreaker] ${serviceName}: HALF-OPEN -> CLOSED (recovered)`);
    }
  } else if (breaker.state === 'closed') {
    // Reset failure count on success
    breaker.failures = Math.max(0, breaker.failures - 1);
  }
}

export function recordFailure(serviceName: string, error?: string): void {
  const breaker = getCircuitBreaker(serviceName);
  const config = CIRCUIT_CONFIGS[serviceName] || DEFAULT_CIRCUIT_CONFIG;
  const now = Date.now();
  
  // Check if we should reset the failure count (outside monitoring window)
  if (now - breaker.lastFailureTime > config.monitoringWindow) {
    breaker.failures = 0;
  }
  
  breaker.failures++;
  breaker.lastFailureTime = now;
  
  console.log(`[CircuitBreaker] ${serviceName}: Failure ${breaker.failures}/${config.failureThreshold} - ${error?.substring(0, 50) || 'Unknown'}`);
  
  if (breaker.state === 'half-open') {
    // Immediate trip back to open
    breaker.state = 'open';
    breaker.lastStateChange = now;
    console.log(`[CircuitBreaker] ${serviceName}: HALF-OPEN -> OPEN (test failed)`);
  } else if (breaker.state === 'closed' && breaker.failures >= config.failureThreshold) {
    breaker.state = 'open';
    breaker.lastStateChange = now;
    console.log(`[CircuitBreaker] ${serviceName}: CLOSED -> OPEN (threshold reached)`);
  }
}

// =====================================================
// ADAPTIVE BACKOFF
// =====================================================

interface BackoffState {
  currentDelay: number;
  consecutiveFailures: number;
  lastAttempt: number;
}

const backoffStates = new Map<string, BackoffState>();

const BACKOFF_CONFIG = {
  initialDelay: 1000,        // 1 second
  maxDelay: 60000,           // 1 minute max
  multiplier: 2,
  jitterFactor: 0.2,         // 20% jitter
};

export function getBackoffDelay(key: string): number {
  const state = backoffStates.get(key);
  
  if (!state) {
    return 0; // No backoff needed for first attempt
  }
  
  const now = Date.now();
  const timeSinceLastAttempt = now - state.lastAttempt;
  
  // If enough time has passed, reset backoff
  if (timeSinceLastAttempt > state.currentDelay * 3) {
    backoffStates.delete(key);
    return 0;
  }
  
  // Add jitter to prevent thundering herd
  const jitter = state.currentDelay * BACKOFF_CONFIG.jitterFactor * (Math.random() - 0.5);
  return Math.floor(state.currentDelay + jitter);
}

export function recordBackoffSuccess(key: string): void {
  backoffStates.delete(key);
}

export function recordBackoffFailure(key: string): number {
  const now = Date.now();
  let state = backoffStates.get(key);
  
  if (!state) {
    state = {
      currentDelay: BACKOFF_CONFIG.initialDelay,
      consecutiveFailures: 1,
      lastAttempt: now,
    };
  } else {
    state.consecutiveFailures++;
    state.currentDelay = Math.min(
      BACKOFF_CONFIG.maxDelay,
      state.currentDelay * BACKOFF_CONFIG.multiplier
    );
    state.lastAttempt = now;
  }
  
  backoffStates.set(key, state);
  return state.currentDelay;
}

// =====================================================
// PRIORITY QUEUE
// =====================================================

type Priority = 'critical' | 'high' | 'normal' | 'low';

interface QueuedRequest {
  id: string;
  priority: Priority;
  timestamp: number;
  data: unknown;
  callback?: (result: unknown) => void;
}

const requestQueues = new Map<string, QueuedRequest[]>();

const PRIORITY_WEIGHTS: Record<Priority, number> = {
  critical: 1000,
  high: 100,
  normal: 10,
  low: 1,
};

export function enqueueRequest(
  queueName: string,
  request: Omit<QueuedRequest, 'timestamp'>
): void {
  let queue = requestQueues.get(queueName);
  
  if (!queue) {
    queue = [];
    requestQueues.set(queueName, queue);
  }
  
  queue.push({
    ...request,
    timestamp: Date.now(),
  });
  
  // Sort by priority (higher first), then by timestamp (older first)
  queue.sort((a, b) => {
    const priorityDiff = PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return a.timestamp - b.timestamp;
  });
}

export function dequeueRequest(queueName: string): QueuedRequest | null {
  const queue = requestQueues.get(queueName);
  
  if (!queue || queue.length === 0) {
    return null;
  }
  
  return queue.shift() || null;
}

export function getQueueLength(queueName: string): number {
  return requestQueues.get(queueName)?.length || 0;
}

export function getQueueStats(queueName: string): {
  total: number;
  byPriority: Record<Priority, number>;
  oldestAge: number | null;
} {
  const queue = requestQueues.get(queueName) || [];
  const now = Date.now();
  
  const byPriority: Record<Priority, number> = {
    critical: 0,
    high: 0,
    normal: 0,
    low: 0,
  };
  
  let oldestTimestamp: number | null = null;
  
  for (const req of queue) {
    byPriority[req.priority]++;
    if (oldestTimestamp === null || req.timestamp < oldestTimestamp) {
      oldestTimestamp = req.timestamp;
    }
  }
  
  return {
    total: queue.length,
    byPriority,
    oldestAge: oldestTimestamp ? now - oldestTimestamp : null,
  };
}

// =====================================================
// CONCURRENCY LIMITER
// =====================================================

interface ConcurrencyState {
  current: number;
  max: number;
  waiting: Array<() => void>;
}

const concurrencyLimiters = new Map<string, ConcurrencyState>();

export function initConcurrencyLimiter(key: string, maxConcurrent: number): void {
  if (!concurrencyLimiters.has(key)) {
    concurrencyLimiters.set(key, {
      current: 0,
      max: maxConcurrent,
      waiting: [],
    });
  }
}

export async function acquireConcurrencySlot(key: string, timeoutMs: number = 30000): Promise<boolean> {
  const limiter = concurrencyLimiters.get(key);
  
  if (!limiter) {
    return true; // No limiter configured
  }
  
  if (limiter.current < limiter.max) {
    limiter.current++;
    return true;
  }
  
  // Wait for a slot
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      const idx = limiter.waiting.indexOf(release);
      if (idx !== -1) limiter.waiting.splice(idx, 1);
      resolve(false);
    }, timeoutMs);
    
    const release = () => {
      clearTimeout(timeoutId);
      limiter.current++;
      resolve(true);
    };
    
    limiter.waiting.push(release);
  });
}

export function releaseConcurrencySlot(key: string): void {
  const limiter = concurrencyLimiters.get(key);
  
  if (!limiter) return;
  
  limiter.current = Math.max(0, limiter.current - 1);
  
  // Wake up next waiting request
  if (limiter.waiting.length > 0 && limiter.current < limiter.max) {
    const next = limiter.waiting.shift();
    if (next) next();
  }
}

export function getConcurrencyStats(key: string): { current: number; max: number; waiting: number } | null {
  const limiter = concurrencyLimiters.get(key);
  if (!limiter) return null;
  
  return {
    current: limiter.current,
    max: limiter.max,
    waiting: limiter.waiting.length,
  };
}

// =====================================================
// HEALTH CHECK AGGREGATOR
// =====================================================

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  circuitState: CircuitState;
  latencyMs: number;
  errorRate: number;
  lastChecked: number;
}

const healthStats = new Map<string, { latencies: number[]; errors: number; total: number }>();

export function recordLatency(serviceName: string, latencyMs: number, isError: boolean): void {
  let stats = healthStats.get(serviceName);
  
  if (!stats) {
    stats = { latencies: [], errors: 0, total: 0 };
    healthStats.set(serviceName, stats);
  }
  
  stats.latencies.push(latencyMs);
  stats.total++;
  if (isError) stats.errors++;
  
  // Keep last 100 samples
  if (stats.latencies.length > 100) {
    stats.latencies.shift();
  }
}

export function getServiceHealth(serviceName: string): ServiceHealth {
  const stats = healthStats.get(serviceName);
  const breaker = getCircuitBreaker(serviceName);
  
  const avgLatency = stats?.latencies.length 
    ? stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length 
    : 0;
    
  const errorRate = stats?.total 
    ? stats.errors / stats.total 
    : 0;
  
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  
  if (breaker.state === 'open') {
    status = 'unhealthy';
  } else if (breaker.state === 'half-open' || errorRate > 0.1) {
    status = 'degraded';
  }
  
  return {
    name: serviceName,
    status,
    circuitState: breaker.state,
    latencyMs: Math.round(avgLatency),
    errorRate: Math.round(errorRate * 100) / 100,
    lastChecked: Date.now(),
  };
}

export function getAllServicesHealth(): ServiceHealth[] {
  const services = ['veo-api', 'cloud-run-stitch', 'openai-api', 'elevenlabs-api'];
  return services.map(getServiceHealth);
}
