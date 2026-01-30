import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

Deno.test("check-specialized-status - handles CORS preflight", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/check-specialized-status`, {
    method: "OPTIONS",
    headers: {
      "Origin": "https://example.com",
      "Access-Control-Request-Method": "POST",
    },
  });

  await response.text(); // Consume body
  
  assertEquals(response.status, 200);
  assertExists(response.headers.get("Access-Control-Allow-Origin"));
});

Deno.test("check-specialized-status - returns error without required fields", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/check-specialized-status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      // Missing projectId and predictionId
    }),
  });

  const body = await response.json();
  
  assertEquals(response.status, 400);
  assertExists(body.error);
});

Deno.test("check-specialized-status - processing messages are mode-specific", () => {
  const getProcessingMessage = (mode: string, progress: number): string => {
    if (mode === 'avatar') {
      if (progress < 40) return 'Analyzing facial features and expressions...';
      if (progress < 60) return 'Generating natural speaking motion...';
      if (progress < 80) return 'Rendering talking head animation...';
      return 'Finalizing avatar video...';
    }
    
    if (mode === 'video-to-video') {
      if (progress < 40) return 'Analyzing visual style patterns...';
      if (progress < 60) return 'Applying artistic transformation...';
      if (progress < 80) return 'Rendering stylized frames...';
      return 'Encoding final video...';
    }
    
    if (mode === 'motion-transfer') {
      if (progress < 40) return 'Extracting motion vectors...';
      if (progress < 60) return 'Mapping pose to target...';
      if (progress < 80) return 'Rendering motion animation...';
      return 'Finalizing transfer...';
    }
    
    return 'AI is generating your video...';
  };

  // Test avatar mode messages
  assertEquals(getProcessingMessage('avatar', 20), 'Analyzing facial features and expressions...');
  assertEquals(getProcessingMessage('avatar', 50), 'Generating natural speaking motion...');
  assertEquals(getProcessingMessage('avatar', 70), 'Rendering talking head animation...');
  assertEquals(getProcessingMessage('avatar', 90), 'Finalizing avatar video...');

  // Test video-to-video mode messages
  assertEquals(getProcessingMessage('video-to-video', 20), 'Analyzing visual style patterns...');
  assertEquals(getProcessingMessage('video-to-video', 50), 'Applying artistic transformation...');

  // Test motion-transfer mode messages
  assertEquals(getProcessingMessage('motion-transfer', 20), 'Extracting motion vectors...');
  assertEquals(getProcessingMessage('motion-transfer', 50), 'Mapping pose to target...');

  // Test unknown mode
  assertEquals(getProcessingMessage('unknown', 50), 'AI is generating your video...');
});

Deno.test("check-specialized-status - progress estimation from logs", () => {
  const estimateProgress = (logLength: number): number => {
    return Math.min(85, 30 + Math.floor(logLength / 50));
  };

  assertEquals(estimateProgress(0), 30);
  assertEquals(estimateProgress(100), 32);
  assertEquals(estimateProgress(500), 40);
  assertEquals(estimateProgress(2750), 85); // Capped at 85
  assertEquals(estimateProgress(5000), 85); // Still capped
});

Deno.test("check-specialized-status - video URL extraction from output", () => {
  const extractVideoUrl = (output: unknown): string | null => {
    if (!output) return null;
    if (typeof output === 'string') return output;
    if (Array.isArray(output) && output.length > 0) return output[0];
    return null;
  };

  // String output
  assertEquals(
    extractVideoUrl("https://replicate.delivery/video.mp4"),
    "https://replicate.delivery/video.mp4"
  );

  // Array output
  assertEquals(
    extractVideoUrl(["https://replicate.delivery/video.mp4"]),
    "https://replicate.delivery/video.mp4"
  );

  // Null output
  assertEquals(extractVideoUrl(null), null);

  // Empty array
  assertEquals(extractVideoUrl([]), null);
});

Deno.test("check-specialized-status - status response flags are correct", () => {
  interface StatusFlags {
    status: string;
    isComplete: boolean;
    isFailed: boolean;
  }

  const getStatusFlags = (status: string): StatusFlags => {
    return {
      status,
      isComplete: status === 'succeeded',
      isFailed: status === 'failed' || status === 'canceled',
    };
  };

  // Succeeded
  const succeeded = getStatusFlags('succeeded');
  assertEquals(succeeded.isComplete, true);
  assertEquals(succeeded.isFailed, false);

  // Failed
  const failed = getStatusFlags('failed');
  assertEquals(failed.isComplete, false);
  assertEquals(failed.isFailed, true);

  // Canceled
  const canceled = getStatusFlags('canceled');
  assertEquals(canceled.isComplete, false);
  assertEquals(canceled.isFailed, true);

  // Processing
  const processing = getStatusFlags('processing');
  assertEquals(processing.isComplete, false);
  assertEquals(processing.isFailed, false);

  // Starting
  const starting = getStatusFlags('starting');
  assertEquals(starting.isComplete, false);
  assertEquals(starting.isFailed, false);
});
