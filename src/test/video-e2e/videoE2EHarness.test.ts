/**
 * VIDEO E2E TEST HARNESS
 * 
 * Complete end-to-end verification of the video pipeline:
 * - CHECKPOINT A: Job created (project ID)
 * - CHECKPOINT B: Generation started
 * - CHECKPOINT C: Segments produced (count)
 * - CHECKPOINT D: Stitching started
 * - CHECKPOINT E: Final video produced (path, bytes, duration)
 * - CHECKPOINT F: Playback validation passed
 * 
 * Run with: npm run test -- src/test/video-e2e/videoE2EHarness.test.ts
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

// Test configuration
const TEST_CONFIG = {
  prompt: 'A serene sunrise over calm ocean waters, gentle waves lapping at golden sand beach',
  clipCount: 2, // Minimum for E2E verification
  clipDuration: 5,
  aspectRatio: '16:9',
  mode: 'text-to-video',
  timeout: 600000, // 10 minutes max for generation
  pollInterval: 5000, // 5 second polling
};

interface Checkpoint {
  id: string;
  timestamp: number;
  data: Record<string, unknown>;
}

interface E2EResult {
  checkpoints: Record<string, Checkpoint>;
  success: boolean;
  error?: string;
  artifacts: {
    projectId?: string;
    manifestUrl?: string;
    clipCount?: number;
    totalDuration?: number;
  };
}

// Checkpoint logger
function logCheckpoint(id: string, message: string, data?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  console.log(`\n=== CHECKPOINT ${id} [${timestamp}] ===`);
  console.log(message);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
  console.log('='.repeat(50));
}

// Poll until condition is met or timeout
async function pollUntil<T>(
  fn: () => Promise<T>,
  condition: (result: T) => boolean,
  options: { timeout: number; interval: number; description: string }
): Promise<T> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < options.timeout) {
    const result = await fn();
    if (condition(result)) {
      return result;
    }
    console.log(`[Poll] ${options.description} - waiting ${options.interval}ms...`);
    await new Promise(resolve => setTimeout(resolve, options.interval));
  }
  
  throw new Error(`Timeout waiting for: ${options.description}`);
}

describe('Video Pipeline E2E Verification', () => {
  let testProjectId: string | null = null;
  let testUserId: string | null = null;
  const result: E2EResult = {
    checkpoints: {},
    success: false,
    artifacts: {},
  };
  
  beforeAll(async () => {
    // Get current user session
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      testUserId = session.user.id;
      console.log(`[Setup] Using authenticated user: ${testUserId}`);
    } else {
      console.warn('[Setup] No authenticated user - tests may fail on RLS');
    }
  });
  
  afterAll(async () => {
    // Cleanup: mark test project as test artifact
    if (testProjectId) {
      console.log(`\n[Cleanup] Test project ID: ${testProjectId}`);
      console.log('[Cleanup] Project preserved for manual inspection');
    }
    
    // Output final result
    console.log('\n=== E2E TEST RESULT ===');
    console.log(JSON.stringify(result, null, 2));
  });
  
  it('CHECKPOINT A: Should create video project', async () => {
    // Trigger the pipeline via mode-router
    const { data, error } = await supabase.functions.invoke('mode-router', {
      body: {
        mode: TEST_CONFIG.mode,
        userId: testUserId,
        prompt: TEST_CONFIG.prompt,
        clipCount: TEST_CONFIG.clipCount,
        clipDuration: TEST_CONFIG.clipDuration,
        aspectRatio: TEST_CONFIG.aspectRatio,
        enableNarration: false,
        enableMusic: false,
      },
    });
    
    if (error) {
      // Check for active project conflict
      if (error.message?.includes('409') || data?.error === 'active_project_exists') {
        console.warn('[CHECKPOINT A] Active project exists - using existing project');
        testProjectId = data?.existingProjectId;
      } else {
        throw new Error(`mode-router failed: ${error.message}`);
      }
    } else {
      testProjectId = data?.projectId;
    }
    
    expect(testProjectId).toBeTruthy();
    
    logCheckpoint('A', 'Job Created', {
      projectId: testProjectId,
      mode: TEST_CONFIG.mode,
      clipCount: TEST_CONFIG.clipCount,
    });
    
    result.checkpoints.A = {
      id: 'job_created',
      timestamp: Date.now(),
      data: { projectId: testProjectId },
    };
    result.artifacts.projectId = testProjectId!;
  }, 30000);
  
  it('CHECKPOINT B: Should start generation', async () => {
    expect(testProjectId).toBeTruthy();
    
    // Poll for generation started
    const project = await pollUntil(
      async () => {
        const { data } = await supabase
          .from('movie_projects')
          .select('status, pipeline_stage, pending_video_tasks')
          .eq('id', testProjectId!)
          .single();
        return data;
      },
      (data) => {
        const status = data?.status;
        const stage = data?.pipeline_stage;
        return status === 'generating' || stage === 'generation' || stage === 'generating';
      },
      {
        timeout: 120000, // 2 minutes to start
        interval: 3000,
        description: 'generation to start',
      }
    );
    
    logCheckpoint('B', 'Generation Started', {
      status: project?.status,
      stage: project?.pipeline_stage,
      tasks: project?.pending_video_tasks,
    });
    
    result.checkpoints.B = {
      id: 'generation_started',
      timestamp: Date.now(),
      data: { status: project?.status, stage: project?.pipeline_stage },
    };
  }, 150000);
  
  it('CHECKPOINT C: Should produce video segments', async () => {
    expect(testProjectId).toBeTruthy();
    
    // Poll for clips to be completed
    const clips = await pollUntil(
      async () => {
        const { data } = await supabase
          .from('video_clips')
          .select('id, shot_index, status, video_url, duration_seconds')
          .eq('project_id', testProjectId!)
          .order('shot_index');
        return data || [];
      },
      (data) => {
        const completed = data.filter(c => c.status === 'completed');
        console.log(`[Poll] Clips: ${completed.length}/${TEST_CONFIG.clipCount} completed`);
        return completed.length >= TEST_CONFIG.clipCount;
      },
      {
        timeout: TEST_CONFIG.timeout,
        interval: TEST_CONFIG.pollInterval,
        description: `${TEST_CONFIG.clipCount} clips to complete`,
      }
    );
    
    const completedClips = clips.filter(c => c.status === 'completed');
    
    logCheckpoint('C', 'Segments Produced', {
      totalClips: clips.length,
      completedClips: completedClips.length,
      clips: completedClips.map(c => ({
        index: c.shot_index,
        duration: c.duration_seconds,
        hasUrl: !!c.video_url,
      })),
    });
    
    result.checkpoints.C = {
      id: 'segments_produced',
      timestamp: Date.now(),
      data: { count: completedClips.length },
    };
    result.artifacts.clipCount = completedClips.length;
    
    expect(completedClips.length).toBeGreaterThanOrEqual(TEST_CONFIG.clipCount);
  }, TEST_CONFIG.timeout + 30000);
  
  it('CHECKPOINT D & E: Should stitch into final video', async () => {
    expect(testProjectId).toBeTruthy();
    
    // Poll for stitching/completion
    const project = await pollUntil(
      async () => {
        const { data } = await supabase
          .from('movie_projects')
          .select('status, video_url, pending_video_tasks')
          .eq('id', testProjectId!)
          .single();
        return data;
      },
      (data) => {
        const status = data?.status;
        const tasks = data?.pending_video_tasks as Record<string, unknown> | null;
        console.log(`[Poll] Status: ${status}, Stage: ${tasks?.stage}`);
        return status === 'completed' || tasks?.stage === 'complete';
      },
      {
        timeout: 180000, // 3 minutes for stitching
        interval: 5000,
        description: 'stitching to complete',
      }
    );
    
    const tasks = project?.pending_video_tasks as Record<string, unknown> | null;
    const manifestUrl = tasks?.manifestUrl as string || project?.video_url;
    const totalDuration = tasks?.totalDuration as number || 0;
    
    logCheckpoint('D', 'Stitching Started', { status: 'completed' });
    
    logCheckpoint('E', 'Final Video Produced', {
      manifestUrl,
      totalDuration,
      mode: tasks?.mode,
    });
    
    result.checkpoints.D = {
      id: 'stitching_started',
      timestamp: Date.now(),
      data: {},
    };
    
    result.checkpoints.E = {
      id: 'final_video_produced',
      timestamp: Date.now(),
      data: {
        manifestUrl,
        totalDuration,
      },
    };
    result.artifacts.manifestUrl = manifestUrl || undefined;
    result.artifacts.totalDuration = totalDuration;
    
    expect(manifestUrl).toBeTruthy();
  }, 210000);
  
  it('CHECKPOINT F: Should validate playback readiness', async () => {
    expect(testProjectId).toBeTruthy();
    expect(result.artifacts.manifestUrl).toBeTruthy();
    
    // Fetch and validate manifest
    const manifestUrl = result.artifacts.manifestUrl!;
    
    // Validate manifest is accessible
    const manifestResponse = await fetch(manifestUrl);
    expect(manifestResponse.ok).toBe(true);
    
    const manifest = await manifestResponse.json();
    
    // Validate manifest structure
    expect(manifest.version).toBeDefined();
    expect(manifest.projectId).toBe(testProjectId);
    expect(manifest.clips).toBeInstanceOf(Array);
    expect(manifest.clips.length).toBeGreaterThanOrEqual(TEST_CONFIG.clipCount);
    expect(manifest.totalDuration).toBeGreaterThan(0);
    
    // Validate each clip URL is accessible
    for (const clip of manifest.clips) {
      expect(clip.videoUrl).toBeTruthy();
      expect(clip.duration).toBeGreaterThan(0);
      
      // HEAD request to validate video exists
      const videoResponse = await fetch(clip.videoUrl, { method: 'HEAD' });
      expect(videoResponse.ok).toBe(true);
      
      const contentLength = videoResponse.headers.get('content-length');
      expect(parseInt(contentLength || '0')).toBeGreaterThan(0);
    }
    
    // Calculate expected duration range
    const expectedMinDuration = TEST_CONFIG.clipCount * TEST_CONFIG.clipDuration * 0.8; // 20% tolerance
    const expectedMaxDuration = TEST_CONFIG.clipCount * TEST_CONFIG.clipDuration * 1.5;
    
    logCheckpoint('F', 'Playback Validation Passed', {
      manifestVersion: manifest.version,
      clipCount: manifest.clips.length,
      totalDuration: manifest.totalDuration,
      expectedRange: `${expectedMinDuration}s - ${expectedMaxDuration}s`,
      allClipsAccessible: true,
    });
    
    result.checkpoints.F = {
      id: 'playback_validation_passed',
      timestamp: Date.now(),
      data: {
        manifestValid: true,
        clipsAccessible: manifest.clips.length,
        durationValid: manifest.totalDuration >= expectedMinDuration,
      },
    };
    
    result.success = true;
    
    expect(manifest.totalDuration).toBeGreaterThanOrEqual(expectedMinDuration);
  }, 60000);
});
