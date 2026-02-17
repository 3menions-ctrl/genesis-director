/**
 * Pipeline State Machine v1.0
 * 
 * Step-State Machine for checkpoint recovery during production.
 * Provides:
 * - Persisted checkpoint states
 * - Graceful recovery from interruptions
 * - Exponential backoff integration
 * - Progress tracking with persistence
 */

import { supabase } from '@/integrations/supabase/client';
import { calculateDelay, isRetryableError } from './networkResilience';

// ============= State Machine Types =============

export type PipelineStage = 
  | 'idle'
  | 'script_generation'
  | 'identity_analysis'
  | 'quality_audit'
  | 'scene_preparation'
  | 'clip_generation'
  | 'voice_synthesis'
  | 'music_generation'
  | 'stitching'
  | 'completed'
  | 'failed';

export interface PipelineCheckpoint {
  stage: PipelineStage;
  stageIndex: number;
  stageProgress: number; // 0-100 within current stage
  totalProgress: number; // 0-100 overall
  clipIndex: number;
  completedClips: number[];
  failedClips: number[];
  lastSuccessfulStep: string;
  timestamp: number;
  recoverable: boolean;
  metadata: Record<string, unknown>;
}

export interface StageConfig {
  name: PipelineStage;
  weight: number; // Percentage of total progress (0-100)
  canResume: boolean;
  maxRetries: number;
  timeoutMs: number;
}

// ============= Stage Configuration =============

export const PIPELINE_STAGES: StageConfig[] = [
  { name: 'script_generation', weight: 10, canResume: false, maxRetries: 2, timeoutMs: 30000 },
  { name: 'identity_analysis', weight: 10, canResume: false, maxRetries: 2, timeoutMs: 60000 },
  { name: 'quality_audit', weight: 5, canResume: false, maxRetries: 1, timeoutMs: 30000 },
  { name: 'scene_preparation', weight: 10, canResume: true, maxRetries: 2, timeoutMs: 60000 },
  { name: 'clip_generation', weight: 50, canResume: true, maxRetries: 3, timeoutMs: 180000 },
  { name: 'voice_synthesis', weight: 5, canResume: true, maxRetries: 2, timeoutMs: 60000 },
  { name: 'music_generation', weight: 5, canResume: true, maxRetries: 1, timeoutMs: 120000 },
  { name: 'stitching', weight: 5, canResume: true, maxRetries: 3, timeoutMs: 60000 },
];

// ============= State Machine Class =============

export class PipelineStateMachine {
  private projectId: string;
  private checkpoint: PipelineCheckpoint;
  private listeners: Set<(checkpoint: PipelineCheckpoint) => void> = new Set();
  private saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  
  constructor(projectId: string, initialCheckpoint?: Partial<PipelineCheckpoint>) {
    this.projectId = projectId;
    this.checkpoint = {
      stage: 'idle',
      stageIndex: 0,
      stageProgress: 0,
      totalProgress: 0,
      clipIndex: 0,
      completedClips: [],
      failedClips: [],
      lastSuccessfulStep: '',
      timestamp: Date.now(),
      recoverable: true,
      metadata: {},
      ...initialCheckpoint,
    };
  }
  
  /**
   * Get current checkpoint state
   */
  getCheckpoint(): PipelineCheckpoint {
    return { ...this.checkpoint };
  }
  
  /**
   * Subscribe to checkpoint changes
   */
  subscribe(listener: (checkpoint: PipelineCheckpoint) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  /**
   * Transition to a new stage
   */
  async transitionTo(
    stage: PipelineStage, 
    options?: { 
      progress?: number; 
      metadata?: Record<string, unknown>;
      persist?: boolean;
    }
  ): Promise<void> {
    const stageIndex = PIPELINE_STAGES.findIndex(s => s.name === stage);
    const stageConfig = PIPELINE_STAGES[stageIndex];
    
    // Calculate total progress based on stage weights
    let totalProgress = 0;
    for (let i = 0; i < stageIndex; i++) {
      totalProgress += PIPELINE_STAGES[i].weight;
    }
    if (stageConfig && options?.progress) {
      totalProgress += (stageConfig.weight * options.progress) / 100;
    }
    
    this.checkpoint = {
      ...this.checkpoint,
      stage,
      stageIndex,
      stageProgress: options?.progress ?? 0,
      totalProgress: Math.min(totalProgress, 100),
      timestamp: Date.now(),
      lastSuccessfulStep: stage,
      metadata: { ...this.checkpoint.metadata, ...options?.metadata },
    };
    
    this.notifyListeners();
    
    if (options?.persist !== false) {
      await this.persistCheckpoint();
    }
  }
  
  /**
   * Update progress within current stage
   */
  async updateProgress(
    progress: number, 
    options?: { 
      clipIndex?: number; 
      metadata?: Record<string, unknown>;
      debounce?: boolean;
    }
  ): Promise<void> {
    const stageConfig = PIPELINE_STAGES[this.checkpoint.stageIndex];
    
    // Calculate total progress
    let totalProgress = 0;
    for (let i = 0; i < this.checkpoint.stageIndex; i++) {
      totalProgress += PIPELINE_STAGES[i].weight;
    }
    totalProgress += (stageConfig?.weight ?? 0) * (progress / 100);
    
    this.checkpoint = {
      ...this.checkpoint,
      stageProgress: progress,
      totalProgress: Math.min(totalProgress, 100),
      clipIndex: options?.clipIndex ?? this.checkpoint.clipIndex,
      timestamp: Date.now(),
      metadata: { ...this.checkpoint.metadata, ...options?.metadata },
    };
    
    this.notifyListeners();
    
    // Debounced persistence to reduce DB writes
    if (options?.debounce !== false) {
      this.debouncedPersist();
    } else {
      await this.persistCheckpoint();
    }
  }
  
  /**
   * Mark a clip as completed
   */
  async markClipCompleted(clipIndex: number): Promise<void> {
    if (!this.checkpoint.completedClips.includes(clipIndex)) {
      this.checkpoint.completedClips = [...this.checkpoint.completedClips, clipIndex].sort((a, b) => a - b);
      // Remove from failed if it was there
      this.checkpoint.failedClips = this.checkpoint.failedClips.filter(i => i !== clipIndex);
      this.checkpoint.timestamp = Date.now();
      
      this.notifyListeners();
      await this.persistCheckpoint();
    }
  }
  
  /**
   * Mark a clip as failed
   */
  async markClipFailed(clipIndex: number): Promise<void> {
    if (!this.checkpoint.failedClips.includes(clipIndex)) {
      this.checkpoint.failedClips = [...this.checkpoint.failedClips, clipIndex].sort((a, b) => a - b);
      this.checkpoint.timestamp = Date.now();
      
      this.notifyListeners();
      await this.persistCheckpoint();
    }
  }
  
  /**
   * Mark entire pipeline as completed
   */
  async complete(): Promise<void> {
    this.checkpoint = {
      ...this.checkpoint,
      stage: 'completed',
      stageProgress: 100,
      totalProgress: 100,
      timestamp: Date.now(),
    };
    
    this.notifyListeners();
    await this.persistCheckpoint();
  }
  
  /**
   * Mark pipeline as failed
   */
  async fail(error?: string): Promise<void> {
    this.checkpoint = {
      ...this.checkpoint,
      stage: 'failed',
      recoverable: this.isRecoverable(),
      timestamp: Date.now(),
      metadata: { ...this.checkpoint.metadata, lastError: error },
    };
    
    this.notifyListeners();
    await this.persistCheckpoint();
  }
  
  /**
   * Check if current state is recoverable
   */
  isRecoverable(): boolean {
    const stageConfig = PIPELINE_STAGES[this.checkpoint.stageIndex];
    return stageConfig?.canResume ?? false;
  }
  
  /**
   * Get recovery point for resuming
   */
  getRecoveryPoint(): { stage: PipelineStage; clipIndex: number } | null {
    if (!this.isRecoverable()) return null;
    
    // For clip generation, resume from next unfinished clip
    if (this.checkpoint.stage === 'clip_generation') {
      const nextClip = this.getNextUnfinishedClip();
      if (nextClip !== null) {
        return { stage: 'clip_generation', clipIndex: nextClip };
      }
    }
    
    return { stage: this.checkpoint.stage, clipIndex: this.checkpoint.clipIndex };
  }
  
  /**
   * Get next clip that hasn't been completed
   */
  getNextUnfinishedClip(): number | null {
    const totalClips = (this.checkpoint.metadata.totalClips as number) ?? 6;
    for (let i = 0; i < totalClips; i++) {
      if (!this.checkpoint.completedClips.includes(i)) {
        return i;
      }
    }
    return null;
  }
  
  /**
   * Load checkpoint from database
   */
  static async loadFromDB(projectId: string): Promise<PipelineStateMachine | null> {
    try {
      const { data, error } = await supabase
        .from('movie_projects')
        .select('pipeline_context_snapshot, pending_video_tasks')
        .eq('id', projectId)
        .maybeSingle();
      
      if (error || !data) return null;
      
      // Parse checkpoint from pipeline_context_snapshot or pending_video_tasks
      let checkpoint: Partial<PipelineCheckpoint> = {};
      
      if (data.pipeline_context_snapshot) {
        const snapshot = typeof data.pipeline_context_snapshot === 'string'
          ? JSON.parse(data.pipeline_context_snapshot)
          : data.pipeline_context_snapshot;
        checkpoint = snapshot.checkpoint ?? {};
      }
      
      if (data.pending_video_tasks) {
        const tasks = typeof data.pending_video_tasks === 'string'
          ? JSON.parse(data.pending_video_tasks)
          : data.pending_video_tasks;
        
        // Merge with pending_video_tasks data
        checkpoint.completedClips = checkpoint.completedClips ?? tasks.completedClips ?? [];
        checkpoint.metadata = { ...checkpoint.metadata, totalClips: tasks.clipCount };
      }
      
      return new PipelineStateMachine(projectId, checkpoint);
    } catch {
      return null;
    }
  }
  
  // ============= Private Methods =============
  
  private notifyListeners(): void {
    const snapshot = this.getCheckpoint();
    this.listeners.forEach(listener => listener(snapshot));
  }
  
  private debouncedPersist(): void {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }
    this.saveDebounceTimer = setTimeout(() => {
      this.persistCheckpoint();
    }, 500);
  }
  
  private async persistCheckpoint(): Promise<void> {
    try {
      // Convert checkpoint to JSON-safe format
      const checkpointData = {
        stage: this.checkpoint.stage,
        stageIndex: this.checkpoint.stageIndex,
        stageProgress: this.checkpoint.stageProgress,
        totalProgress: this.checkpoint.totalProgress,
        clipIndex: this.checkpoint.clipIndex,
        completedClips: this.checkpoint.completedClips,
        failedClips: this.checkpoint.failedClips,
        lastSuccessfulStep: this.checkpoint.lastSuccessfulStep,
        timestamp: this.checkpoint.timestamp,
        recoverable: this.checkpoint.recoverable,
        metadata: this.checkpoint.metadata as Record<string, unknown>,
        savedAt: new Date().toISOString(),
      };
      
      const { error } = await supabase
        .from('movie_projects')
        .update({
          pipeline_context_snapshot: checkpointData as unknown as null, // Type cast for JSON column
        })
        .eq('id', this.projectId);
      
      if (error) {
        console.warn('[PipelineStateMachine] Failed to persist checkpoint:', error);
      }
    } catch (err) {
      console.warn('[PipelineStateMachine] Persist error:', err);
    }
  }
}

// ============= Recovery Utilities =============

/**
 * Execute function with exponential backoff retry
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: {
    maxRetries?: number;
    baseDelay?: number;
    signal?: AbortSignal;
    onRetry?: (attempt: number, error: unknown) => void;
  }
): Promise<T> {
  const { maxRetries = 3, baseDelay = 1000, signal, onRetry } = options ?? {};
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (!isRetryableError(error) || attempt === maxRetries) {
        throw lastError;
      }
      
      const delay = calculateDelay(attempt, baseDelay);
      console.log(`[withRetry] Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${delay}ms`);
      onRetry?.(attempt + 1, error);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Create a resumable operation wrapper
 */
export function createResumableOperation<T>(
  stateMachine: PipelineStateMachine,
  stage: PipelineStage,
  operation: (progressCallback: (progress: number) => void) => Promise<T>
): () => Promise<T> {
  return async () => {
    await stateMachine.transitionTo(stage);
    
    try {
      const result = await operation((progress) => {
        stateMachine.updateProgress(progress, { debounce: true });
      });
      
      return result;
    } catch (error) {
      await stateMachine.fail((error as Error).message);
      throw error;
    }
  };
}
