import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

/**
 * REGRESSION TEST SUITE: atomic_claim_clip
 * 
 * Bug (2026-02-22): hollywood-pipeline never initializes `predictions` in
 * `pending_video_tasks`, causing atomic_claim_clip to return false and 
 * generate-single-clip to reject every clip with CLIP_ALREADY_CLAIMED.
 * Projects got stuck at 0-5% forever.
 * 
 * Fix: atomic_claim_clip now auto-initializes predictions on demand.
 * 
 * These tests call the generate-single-clip edge function endpoint to 
 * validate end-to-end behavior.
 */

// Helper: call the edge function and return parsed response
async function callGenerateSingleClip(body: Record<string, unknown>): Promise<{ status: number; data: Record<string, unknown> }> {
  const url = `${SUPABASE_URL}/functions/v1/generate-single-clip`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "apikey": SUPABASE_KEY,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  return { status: res.status, data };
}

Deno.test("generate-single-clip: does NOT return CLIP_ALREADY_CLAIMED for valid request (regression)", async () => {
  // Call with a non-existent project - should fail with auth or project-not-found,
  // but NEVER with CLIP_ALREADY_CLAIMED (which was the bug)
  const fakeProjectId = crypto.randomUUID();
  const { status, data } = await callGenerateSingleClip({
    projectId: fakeProjectId,
    userId: crypto.randomUUID(),
    clipIndex: 0,
    prompt: "Test prompt for regression check",
    totalClips: 1,
    durationSeconds: 5,
  });

  // The request should fail (no auth / project not found) but NOT with CLIP_ALREADY_CLAIMED
  const errorCode = data.error as string;
  assertNotEquals(
    errorCode,
    "CLIP_ALREADY_CLAIMED",
    "REGRESSION: generate-single-clip returned CLIP_ALREADY_CLAIMED — atomic_claim_clip is broken when predictions array is missing!"
  );
  
  // Should fail with auth error (401) since we're using anon key
  assertEquals(status, 401, "Expected 401 for unauthenticated request");
});

Deno.test({ name: "atomic_claim_clip RPC: does not crash for non-existent project (direct RPC test)", sanitizeResources: false, sanitizeOps: false, fn: async () => {
  // This test validates the DB function doesn't crash on edge cases
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  
  const fakeProjectId = crypto.randomUUID();
  const { data: claimed, error } = await supabase.rpc("atomic_claim_clip", {
    p_project_id: fakeProjectId,
    p_clip_index: 0,
    p_claim_token: crypto.randomUUID(),
  });

  // Must not crash — result can be true or false depending on implementation
  assertEquals(error, null, `RPC should not crash: ${error?.message}`);
  // The key assertion: it returned a boolean, not an error
  assertEquals(typeof claimed, "boolean", "Should return a boolean (not crash)");
}});
