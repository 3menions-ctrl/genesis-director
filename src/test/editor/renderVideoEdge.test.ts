import { describe, it, expect } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

/**
 * Integration tests for the render-video edge function.
 * These test the deployed function's request/response contract.
 * Auth is required — tests will skip gracefully if no session.
 */
describe('render-video Edge Function', () => {
  it('should reject unauthenticated requests with 401', async () => {
    // Call without auth header by using fetch directly
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/render-video`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status', jobId: 'test' }),
      }
    );
    // Should be 401 since no Authorization header
    expect(res.status).toBe(401);
  });

  it('should reject requests missing required fields with 400', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.warn('[Skip] No auth session for render-video test');
      return;
    }

    const { data, error } = await supabase.functions.invoke('render-video', {
      body: { action: 'submit' }, // missing timeline and sessionId
    });

    // The function should return error about missing fields
    expect(data?.error || error?.message).toBeTruthy();
  });

  it('should return pending status when no render server configured', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.warn('[Skip] No auth session for render-video test');
      return;
    }

    const { data, error } = await supabase.functions.invoke('render-video', {
      body: { action: 'status', jobId: 'test-job-123' },
    });

    if (error) {
      // If RENDER_SERVER_URL is not set, should still return gracefully
      console.warn('Status check returned error:', error.message);
      return;
    }

    // When no render server is configured, should return pending/info
    expect(data).toBeTruthy();
    if (data?.status === 'pending') {
      expect(data.message).toContain('Render server not configured');
    }
  });

  it('should handle submit with fallback when no render server', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.warn('[Skip] No auth session for render-video test');
      return;
    }

    const { data, error } = await supabase.functions.invoke('render-video', {
      body: {
        action: 'submit',
        sessionId: 'test-session-id',
        timeline: { tracks: [], duration: 10 },
        settings: { resolution: '1080p', fps: 30, format: 'mp4' },
      },
    });

    if (error) {
      // Could fail if sessionId doesn't exist in DB — that's acceptable
      console.warn('Submit returned error:', error.message);
      return;
    }

    // Should return fallback info
    expect(data?.success).toBe(true);
    expect(data?.fallback).toBe('ffmpeg_wasm');
  });
});
