import { describe, it, expect } from 'vitest';
import { 
  isPendingVideoTasks, 
  parsePendingVideoTasks, 
  PendingVideoTasks 
} from '../pending-video-tasks';

/**
 * REGRESSION TEST: Data Parsing for pending_video_tasks
 * 
 * The backend stores pending_video_tasks as a JSON object with properties like:
 * - stage, clipCount, clipDuration, progress, etc.
 * 
 * The frontend previously had a type mismatch where it expected an array of
 * PendingVideoTask objects (with taskId, clipIndex, prompt).
 * 
 * This test ensures the type guard correctly handles both formats.
 */

describe('isPendingVideoTasks Type Guard', () => {
  it('should return true for valid object with pipeline metadata', () => {
    const validTasks: PendingVideoTasks = {
      stage: 'production',
      clipCount: 6,
      clipDuration: 5,
      progress: 50,
      clipsCompleted: 3,
    };
    
    expect(isPendingVideoTasks(validTasks)).toBe(true);
  });

  it('should return true for empty object', () => {
    expect(isPendingVideoTasks({})).toBe(true);
  });

  it('should return false for array (legacy format)', () => {
    const legacyArray = [
      { taskId: 'task-1', clipIndex: 0, prompt: 'test', startedAt: Date.now() }
    ];
    
    expect(isPendingVideoTasks(legacyArray)).toBe(false);
  });

  it('should return false for empty array', () => {
    expect(isPendingVideoTasks([])).toBe(false);
  });

  it('should return false for null', () => {
    expect(isPendingVideoTasks(null)).toBe(false);
  });

  it('should return false for string', () => {
    expect(isPendingVideoTasks('some string')).toBe(false);
  });

  it('should return false for number', () => {
    expect(isPendingVideoTasks(42)).toBe(false);
  });
});

describe('parsePendingVideoTasks', () => {
  it('should parse valid pipeline metadata object', () => {
    const input = {
      stage: 'complete',
      clipCount: 6,
      clipDuration: 10,
      progress: 100,
      clipsCompleted: 6,
      finalVideoUrl: 'https://example.com/video.mp4',
    };
    
    const result = parsePendingVideoTasks(input);
    
    expect(result).not.toBeNull();
    expect(result?.stage).toBe('complete');
    expect(result?.clipCount).toBe(6);
    expect(result?.clipDuration).toBe(10);
  });

  it('should return null for array input', () => {
    const legacyArray = [{ taskId: 'task-1' }];
    
    const result = parsePendingVideoTasks(legacyArray);
    
    expect(result).toBeNull();
  });

  it('should return null for null input', () => {
    expect(parsePendingVideoTasks(null)).toBeNull();
  });

  it('should parse object with degradation flags', () => {
    const input = {
      stage: 'production',
      degradation: {
        identityBibleFailed: true,
        reducedConsistencyMode: true,
      },
    };
    
    const result = parsePendingVideoTasks(input);
    
    expect(result).not.toBeNull();
    expect(result?.degradation?.identityBibleFailed).toBe(true);
    expect(result?.degradation?.reducedConsistencyMode).toBe(true);
  });
});

describe('CRITICAL: clipDuration Propagation', () => {
  it('should preserve clipDuration from backend response', () => {
    // Simulates data returned from Supabase query
    const backendResponse = {
      stage: 'production',
      clipCount: 3,
      clipDuration: 10, // CRITICAL: This was always null before the fix
      progress: 33,
    };
    
    const parsed = parsePendingVideoTasks(backendResponse);
    
    // This test ensures clipDuration is NOT lost during parsing
    expect(parsed?.clipDuration).toBe(10);
    expect(parsed?.clipDuration).not.toBeNull();
    expect(parsed?.clipDuration).not.toBeUndefined();
  });

  it('should handle missing clipDuration gracefully', () => {
    const backendResponse = {
      stage: 'complete',
      clipCount: 6,
      // clipDuration intentionally omitted
    };
    
    const parsed = parsePendingVideoTasks(backendResponse);
    
    expect(parsed).not.toBeNull();
    expect(parsed?.clipDuration).toBeUndefined();
  });
});
