/**
 * Batch Processor for Parallel Video Clip Generation
 * 
 * Features:
 * - Configurable concurrency per tier
 * - Automatic retry with exponential backoff
 * - Progress tracking and partial completion handling
 * - Resource-efficient batch processing
 */

import { 
  checkRateLimit, 
  releaseRateLimit,
  canExecute, 
  recordSuccess, 
  recordFailure,
  recordLatency,
  getBackoffDelay,
  recordBackoffSuccess,
  recordBackoffFailure,
  initConcurrencyLimiter,
  acquireConcurrencySlot,
  releaseConcurrencySlot,
} from './rate-limiter.ts';

// =====================================================
// TYPES
// =====================================================

export interface BatchItem<T> {
  id: string;
  data: T;
  priority?: number;
}

export interface BatchResult<T, R> {
  id: string;
  success: boolean;
  result?: R;
  error?: string;
  retryCount: number;
  durationMs: number;
}

export interface BatchConfig {
  maxConcurrency: number;
  maxRetries: number;
  retryDelayMs: number;
  timeoutMs: number;
  serviceName: string;
  onProgress?: (completed: number, total: number, results: BatchResult<unknown, unknown>[]) => void;
}

// Tier-based concurrency limits
export const TIER_CONCURRENCY: Record<string, number> = {
  free: 2,      // 2 parallel clips
  pro: 3,       // 3 parallel clips
  growth: 5,    // 5 parallel clips
  agency: 8,    // 8 parallel clips
};

// =====================================================
// BATCH PROCESSOR
// =====================================================

export async function processBatch<T, R>(
  items: BatchItem<T>[],
  processor: (item: T, index: number) => Promise<R>,
  config: BatchConfig
): Promise<{
  results: BatchResult<T, R>[];
  successCount: number;
  failureCount: number;
  totalDurationMs: number;
}> {
  const startTime = Date.now();
  const results: BatchResult<T, R>[] = [];
  let successCount = 0;
  let failureCount = 0;
  
  // Sort by priority (higher first)
  const sortedItems = [...items].sort((a, b) => (b.priority || 0) - (a.priority || 0));
  
  // Initialize concurrency limiter
  const concurrencyKey = `batch_${config.serviceName}`;
  initConcurrencyLimiter(concurrencyKey, config.maxConcurrency);
  
  // Check circuit breaker
  const circuitCheck = canExecute(config.serviceName);
  if (!circuitCheck.allowed) {
    console.log(`[BatchProcessor] Circuit OPEN for ${config.serviceName}, waiting ${circuitCheck.retryAfterMs}ms`);
    
    // Return all items as failed with circuit open error
    return {
      results: sortedItems.map(item => ({
        id: item.id,
        success: false,
        error: `Circuit breaker OPEN - retry after ${circuitCheck.retryAfterMs}ms`,
        retryCount: 0,
        durationMs: 0,
      })),
      successCount: 0,
      failureCount: sortedItems.length,
      totalDurationMs: Date.now() - startTime,
    };
  }
  
  // Process items with controlled concurrency
  const processItem = async (item: BatchItem<T>, index: number): Promise<BatchResult<T, R>> => {
    const itemStartTime = Date.now();
    let retryCount = 0;
    let lastError = '';
    
    // Wait for concurrency slot
    const gotSlot = await acquireConcurrencySlot(concurrencyKey, config.timeoutMs);
    if (!gotSlot) {
      return {
        id: item.id,
        success: false,
        error: 'Timeout waiting for concurrency slot',
        retryCount: 0,
        durationMs: Date.now() - itemStartTime,
      };
    }
    
    try {
      while (retryCount <= config.maxRetries) {
        // Check backoff
        const backoffDelay = getBackoffDelay(`${config.serviceName}_${item.id}`);
        if (backoffDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }
        
        // Re-check circuit breaker
        const recheck = canExecute(config.serviceName);
        if (!recheck.allowed) {
          lastError = 'Circuit breaker opened during processing';
          break;
        }
        
        try {
          const attemptStart = Date.now();
          const result = await Promise.race([
            processor(item.data, index),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), config.timeoutMs)
            ),
          ]);
          
          const latency = Date.now() - attemptStart;
          recordLatency(config.serviceName, latency, false);
          recordSuccess(config.serviceName);
          recordBackoffSuccess(`${config.serviceName}_${item.id}`);
          
          return {
            id: item.id,
            success: true,
            result,
            retryCount,
            durationMs: Date.now() - itemStartTime,
          };
          
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          lastError = errorMsg;
          
          recordLatency(config.serviceName, Date.now() - itemStartTime, true);
          recordFailure(config.serviceName, errorMsg);
          recordBackoffFailure(`${config.serviceName}_${item.id}`);
          
          retryCount++;
          
          if (retryCount <= config.maxRetries) {
            const delay = config.retryDelayMs * Math.pow(2, retryCount - 1);
            console.log(`[BatchProcessor] Retry ${retryCount}/${config.maxRetries} for ${item.id}, waiting ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      return {
        id: item.id,
        success: false,
        error: lastError,
        retryCount,
        durationMs: Date.now() - itemStartTime,
      };
      
    } finally {
      releaseConcurrencySlot(concurrencyKey);
    }
  };
  
  // Process in batches respecting concurrency
  const batchSize = config.maxConcurrency;
  
  for (let i = 0; i < sortedItems.length; i += batchSize) {
    const batch = sortedItems.slice(i, i + batchSize);
    
    const batchResults = await Promise.all(
      batch.map((item, batchIdx) => processItem(item, i + batchIdx))
    );
    
    for (const result of batchResults) {
      results.push(result);
      if (result.success) {
        successCount++;
      } else {
        failureCount++;
      }
    }
    
    // Progress callback
    if (config.onProgress) {
      config.onProgress(results.length, sortedItems.length, results as BatchResult<unknown, unknown>[]);
    }
  }
  
  return {
    results,
    successCount,
    failureCount,
    totalDurationMs: Date.now() - startTime,
  };
}

// =====================================================
// SPECIALIZED VIDEO CLIP BATCH PROCESSOR
// =====================================================

export interface ClipGenerationItem {
  shotIndex: number;
  prompt: string;
  projectId: string;
  userId: string;
  sceneContext?: unknown;
  identityBible?: unknown;
  startImageUrl?: string;
  duration?: number;
}

export interface ClipGenerationResult {
  shotIndex: number;
  taskId?: string;
  videoUrl?: string;
  status: 'started' | 'completed' | 'failed';
  error?: string;
}

export async function processClipBatch(
  clips: ClipGenerationItem[],
  tier: string,
  generateFn: (clip: ClipGenerationItem) => Promise<ClipGenerationResult>,
  onProgress?: (completed: number, total: number) => void
): Promise<{
  results: ClipGenerationResult[];
  successCount: number;
  failureCount: number;
  durationMs: number;
}> {
  const concurrency = TIER_CONCURRENCY[tier] || TIER_CONCURRENCY.free;
  
  const batchItems: BatchItem<ClipGenerationItem>[] = clips.map((clip, idx) => ({
    id: `clip_${clip.shotIndex}`,
    data: clip,
    priority: clips.length - idx, // Earlier clips have higher priority
  }));
  
  const result = await processBatch(
    batchItems,
    async (clip) => generateFn(clip),
    {
      maxConcurrency: concurrency,
      maxRetries: 2,
      retryDelayMs: 2000,
      timeoutMs: 180000, // 3 minutes per clip
      serviceName: 'veo-api',
      onProgress: (completed, total) => {
        if (onProgress) onProgress(completed, total);
      },
    }
  );
  
  return {
    results: result.results.map(r => ({
      shotIndex: parseInt(r.id.split('_')[1]),
      ...r.result,
      status: r.success ? 'started' : 'failed',
      error: r.error,
    } as ClipGenerationResult)),
    successCount: result.successCount,
    failureCount: result.failureCount,
    durationMs: result.totalDurationMs,
  };
}

// =====================================================
// CHUNKED PROCESSING FOR LARGE BATCHES
// =====================================================

export interface ChunkConfig {
  chunkSize: number;
  delayBetweenChunksMs: number;
  onChunkComplete?: (chunkIndex: number, totalChunks: number, results: unknown[]) => void;
}

export async function processInChunks<T, R>(
  items: T[],
  processor: (chunk: T[], chunkIndex: number) => Promise<R[]>,
  config: ChunkConfig
): Promise<{
  results: R[];
  chunksProcessed: number;
  totalDurationMs: number;
}> {
  const startTime = Date.now();
  const results: R[] = [];
  const totalChunks = Math.ceil(items.length / config.chunkSize);
  
  for (let i = 0; i < items.length; i += config.chunkSize) {
    const chunkIndex = Math.floor(i / config.chunkSize);
    const chunk = items.slice(i, i + config.chunkSize);
    
    console.log(`[ChunkProcessor] Processing chunk ${chunkIndex + 1}/${totalChunks} (${chunk.length} items)`);
    
    const chunkResults = await processor(chunk, chunkIndex);
    results.push(...chunkResults);
    
    if (config.onChunkComplete) {
      config.onChunkComplete(chunkIndex, totalChunks, chunkResults);
    }
    
    // Delay between chunks (except for last chunk)
    if (i + config.chunkSize < items.length && config.delayBetweenChunksMs > 0) {
      await new Promise(resolve => setTimeout(resolve, config.delayBetweenChunksMs));
    }
  }
  
  return {
    results,
    chunksProcessed: totalChunks,
    totalDurationMs: Date.now() - startTime,
  };
}

// =====================================================
// STREAMING RESULTS HANDLER
// =====================================================

export class StreamingBatchProcessor<T, R> {
  private results: Map<string, R> = new Map();
  private errors: Map<string, string> = new Map();
  private pending: Set<string> = new Set();
  private onUpdate?: (status: { completed: number; failed: number; pending: number }) => void;
  
  constructor(onUpdate?: (status: { completed: number; failed: number; pending: number }) => void) {
    this.onUpdate = onUpdate;
  }
  
  addPending(id: string): void {
    this.pending.add(id);
    this.notifyUpdate();
  }
  
  recordResult(id: string, result: R): void {
    this.pending.delete(id);
    this.results.set(id, result);
    this.notifyUpdate();
  }
  
  recordError(id: string, error: string): void {
    this.pending.delete(id);
    this.errors.set(id, error);
    this.notifyUpdate();
  }
  
  getStatus(): { completed: number; failed: number; pending: number; total: number } {
    return {
      completed: this.results.size,
      failed: this.errors.size,
      pending: this.pending.size,
      total: this.results.size + this.errors.size + this.pending.size,
    };
  }
  
  getResults(): Map<string, R> {
    return new Map(this.results);
  }
  
  getErrors(): Map<string, string> {
    return new Map(this.errors);
  }
  
  isComplete(): boolean {
    return this.pending.size === 0;
  }
  
  private notifyUpdate(): void {
    if (this.onUpdate) {
      const { completed, failed, pending } = this.getStatus();
      this.onUpdate({ completed, failed, pending });
    }
  }
}
