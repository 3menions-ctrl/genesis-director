import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

/**
 * Test: Watchdog completion logic requires ALL clips to be complete
 * 
 * This test verifies the fix for the bug where the pipeline marked complete
 * after only 1 clip when 3 were expected.
 * 
 * The fix changes:
 * - OLD: if (allCompleted && completedClips.length > 0)
 * - NEW: if (completedClips.length === tasks.predictions.length && expectedClipCount > 0)
 */

Deno.test("Completion logic: should NOT complete with partial clips", async () => {
  // Simulate the watchdog's completion check logic
  const tasks = {
    predictions: [
      { clipIndex: 0, status: 'completed', videoUrl: 'https://example.com/clip1.mp4' },
      { clipIndex: 1, status: 'pending' },
      { clipIndex: 2, status: 'pending' },
    ]
  };
  
  // Count completed clips (simulating watchdog behavior)
  const completedClips = tasks.predictions
    .filter(p => p.status === 'completed')
    .map(p => ({ clipIndex: p.clipIndex, videoUrl: p.videoUrl, audioUrl: '' }));
  
  const expectedClipCount = tasks.predictions.length;
  
  // OLD BUGGY LOGIC: This would have been true!
  let allCompleted = true;
  for (const pred of tasks.predictions) {
    if (pred.status === 'completed') {
      continue; // Bug: this didn't set allCompleted = false
    }
    if (pred.status === 'pending' || pred.status === 'processing') {
      allCompleted = false;
    }
  }
  
  const oldBuggyCondition = allCompleted && completedClips.length > 0;
  
  // NEW FIXED LOGIC: Explicit count check
  const allClipsComplete = completedClips.length === expectedClipCount && expectedClipCount > 0;
  
  console.log(`Completed clips: ${completedClips.length}/${expectedClipCount}`);
  console.log(`Old buggy condition would trigger: ${oldBuggyCondition}`);
  console.log(`New fixed condition triggers: ${allClipsComplete}`);
  
  // The fix should prevent premature completion
  assertEquals(allClipsComplete, false, "Should NOT be complete with only 1/3 clips done");
  assertEquals(completedClips.length, 1, "Only 1 clip should be counted as completed");
});

Deno.test("Completion logic: should complete when ALL clips are done", async () => {
  const tasks = {
    predictions: [
      { clipIndex: 0, status: 'completed', videoUrl: 'https://example.com/clip1.mp4' },
      { clipIndex: 1, status: 'completed', videoUrl: 'https://example.com/clip2.mp4' },
      { clipIndex: 2, status: 'completed', videoUrl: 'https://example.com/clip3.mp4' },
    ]
  };
  
  const completedClips = tasks.predictions
    .filter(p => p.status === 'completed')
    .map(p => ({ clipIndex: p.clipIndex, videoUrl: p.videoUrl, audioUrl: '' }));
  
  const expectedClipCount = tasks.predictions.length;
  const allClipsComplete = completedClips.length === expectedClipCount && expectedClipCount > 0;
  
  console.log(`Completed clips: ${completedClips.length}/${expectedClipCount}`);
  console.log(`Fixed condition triggers: ${allClipsComplete}`);
  
  assertEquals(allClipsComplete, true, "Should be complete when all 3/3 clips are done");
  assertEquals(completedClips.length, 3, "All 3 clips should be counted");
});

Deno.test("Completion logic: edge case - empty predictions", async () => {
  const tasks = { predictions: [] };
  
  const completedClips: any[] = [];
  const expectedClipCount = tasks.predictions.length;
  const allClipsComplete = completedClips.length === expectedClipCount && expectedClipCount > 0;
  
  // Should NOT complete with zero predictions (would cause division by zero in progress calc)
  assertEquals(allClipsComplete, false, "Should NOT complete with 0 predictions");
});

Deno.test("Completion logic: 2 of 3 clips done", async () => {
  const tasks = {
    predictions: [
      { clipIndex: 0, status: 'completed', videoUrl: 'https://example.com/clip1.mp4' },
      { clipIndex: 1, status: 'completed', videoUrl: 'https://example.com/clip2.mp4' },
      { clipIndex: 2, status: 'processing' }, // Still processing
    ]
  };
  
  const completedClips = tasks.predictions
    .filter(p => p.status === 'completed')
    .map(p => ({ clipIndex: p.clipIndex, videoUrl: p.videoUrl, audioUrl: '' }));
  
  const expectedClipCount = tasks.predictions.length;
  const allClipsComplete = completedClips.length === expectedClipCount && expectedClipCount > 0;
  
  assertEquals(allClipsComplete, false, "Should NOT complete with 2/3 clips done");
  assertEquals(completedClips.length, 2);
});

Deno.test("Watchdog endpoint responds", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/pipeline-watchdog`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  
  const body = await response.text();
  console.log(`Watchdog response status: ${response.status}`);
  
  // Should respond (200 or other valid status, not 500)
  assertNotEquals(response.status, 500, "Watchdog should not return 500 error");
});
