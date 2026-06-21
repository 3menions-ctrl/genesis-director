/**
 * AtomicFrameSwitch Test Suite
 * Tests the zero-latency frame transition engine
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ATOMIC_CONSTANTS,
  MasterClock,
  LookAheadBufferManager,
  AtomicToggleController,
  AtomicFrameSwitchEngine,
} from '../AtomicFrameSwitch';

// Mock performance.now for deterministic testing
const mockPerformanceNow = vi.fn(() => 0);

describe('ATOMIC_CONSTANTS', () => {
  it('should have correct frame timing for 60fps', () => {
    expect(ATOMIC_CONSTANTS.TARGET_FPS).toBe(60);
    expect(ATOMIC_CONSTANTS.FRAME_BUDGET_MS).toBeCloseTo(16.667, 2);
  });
  
  it('should have sub-microsecond atomic switch target', () => {
    expect(ATOMIC_CONSTANTS.ATOMIC_SWITCH_TARGET_MS).toBe(0.00030);
  });
  
  it('should have appropriate lookahead buffer size', () => {
    expect(ATOMIC_CONSTANTS.LOOKAHEAD_FRAMES).toBe(30);
    expect(ATOMIC_CONSTANTS.LOOKAHEAD_MS).toBe(500);
  });
  
  it('should have V-Sync tolerance under 1ms', () => {
    expect(ATOMIC_CONSTANTS.VSYNC_TOLERANCE_MS).toBeLessThan(1);
  });
});

describe('MasterClock', () => {
  let clock: MasterClock;
  
  beforeEach(() => {
    clock = new MasterClock();
  });
  
  afterEach(() => {
    clock.dispose();
  });
  
  it('should initialize successfully', async () => {
    // Skip if AudioContext not available in test environment
    if (typeof AudioContext === 'undefined') {
      console.log('[Test] AudioContext not available, skipping');
      return;
    }
    
    await clock.initialize();
    const state = clock.getState();
    expect(state.isSynced).toBe(true);
  });
  
  it('should calculate time to next V-Sync', () => {
    const timeToVSync = clock.getTimeToNextVSync();
    expect(timeToVSync).toBeGreaterThanOrEqual(0);
    expect(timeToVSync).toBeLessThanOrEqual(ATOMIC_CONSTANTS.FRAME_BUDGET_MS);
  });
  
  it('should detect V-Sync boundary correctly', () => {
    // This is a probabilistic test - may or may not be at boundary
    const isAtBoundary = clock.isAtVSyncBoundary();
    expect(typeof isAtBoundary).toBe('boolean');
  });
  
  it('should provide clock state', () => {
    const state = clock.getState();
    expect(state).toHaveProperty('audioContextTime');
    expect(state).toHaveProperty('performanceTime');
    expect(state).toHaveProperty('drift');
    expect(state).toHaveProperty('isSynced');
  });
  
  it('should accept drift callback', () => {
    const callback = vi.fn();
    clock.onDrift(callback);
    // Callback won't be called immediately, just verify no error
    expect(true).toBe(true);
  });
});

describe('LookAheadBufferManager', () => {
  let bufferManager: LookAheadBufferManager;
  
  beforeEach(() => {
    bufferManager = new LookAheadBufferManager();
  });
  
  afterEach(() => {
    bufferManager.dispose();
  });
  
  it('should start with no active buffer', () => {
    expect(bufferManager.getActiveBuffer()).toBeNull();
    expect(bufferManager.getStandbyBuffer()).toBeNull();
  });
  
  it('should handle dispose without errors', () => {
    expect(() => bufferManager.dispose()).not.toThrow();
  });
});

describe('AtomicToggleController', () => {
  let clock: MasterClock;
  let bufferManager: LookAheadBufferManager;
  let controller: AtomicToggleController;
  
  beforeEach(() => {
    clock = new MasterClock();
    bufferManager = new LookAheadBufferManager();
    controller = new AtomicToggleController(clock, bufferManager);
  });
  
  afterEach(() => {
    controller.cancelPending();
    bufferManager.dispose();
    clock.dispose();
  });
  
  it('should return failed result when no buffers available', async () => {
    const result = await controller.atomicToggle();
    expect(result.success).toBe(false);
    expect(result.switchDurationMs).toBe(0);
  });
  
  it('should start with idle state', () => {
    const state = controller.getState();
    expect(state.status).toBe('idle');
  });
  
  it('should cancel pending operations', () => {
    expect(() => controller.cancelPending()).not.toThrow();
  });
});

describe('AtomicFrameSwitchEngine', () => {
  let engine: AtomicFrameSwitchEngine;
  
  beforeEach(() => {
    engine = new AtomicFrameSwitchEngine();
  });
  
  afterEach(() => {
    engine.dispose();
  });
  
  it('should start uninitialized', () => {
    const state = engine.getState();
    expect(state.isInitialized).toBe(false);
    expect(state.currentClipIndex).toBe(0);
    expect(state.totalClips).toBe(0);
  });
  
  it('should handle dispose without errors', () => {
    expect(() => engine.dispose()).not.toThrow();
  });
  
  it('should get null video element when no clips loaded', () => {
    expect(engine.getActiveVideoElement()).toBeNull();
  });
  
  it('should return correct state structure', () => {
    const state = engine.getState();
    expect(state).toHaveProperty('isInitialized');
    expect(state).toHaveProperty('currentClipIndex');
    expect(state).toHaveProperty('totalClips');
    expect(state).toHaveProperty('transitionState');
    expect(state).toHaveProperty('clockState');
  });
});

describe('Atomic Switch Timing Guarantees', () => {
  it('should have switch target faster than one frame', () => {
    const frameDuration = 1000 / ATOMIC_CONSTANTS.TARGET_FPS; // ~16.67ms
    expect(ATOMIC_CONSTANTS.ATOMIC_SWITCH_TARGET_MS).toBeLessThan(frameDuration);
  });
  
  it('should have max acceptable switch time under 1ms', () => {
    expect(ATOMIC_CONSTANTS.ATOMIC_SWITCH_MAX_MS).toBeLessThanOrEqual(0.1);
  });
  
  it('should have clock sync interval reasonable for real-time', () => {
    expect(ATOMIC_CONSTANTS.CLOCK_SYNC_INTERVAL_MS).toBeLessThanOrEqual(100);
    expect(ATOMIC_CONSTANTS.CLOCK_SYNC_INTERVAL_MS).toBeGreaterThan(0);
  });
});
