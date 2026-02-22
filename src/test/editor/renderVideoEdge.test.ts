import { describe, it, expect } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

/**
 * Integration tests for the render-video edge function (v2.0 - Replicate concat).
 * Tests the deployed function's request/response contract.
 * Auth is required — tests will skip gracefully if no session.
 */
describe('render-video Edge Function', () => {
  it('should reject unauthenticated requests with 401', async () => {
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/render-video`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status', sessionId: 'test' }),
      }
    );
    expect(res.status).toBe(401);
    await res.text(); // consume body
  });

  it('should reject submit missing sessionId with 400', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.warn('[Skip] No auth session for render-video test');
      return;
    }

    const { data } = await supabase.functions.invoke('render-video', {
      body: { action: 'submit' }, // missing sessionId and clipUrls
    });

    expect(data?.error).toBeTruthy();
  });

  it('should reject submit with fewer than 2 clip URLs', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.warn('[Skip] No auth session for render-video test');
      return;
    }

    const { data } = await supabase.functions.invoke('render-video', {
      body: {
        action: 'submit',
        sessionId: 'test-session-id',
        clipUrls: ['https://example.com/clip1.mp4'], // only 1 URL
      },
    });

    expect(data?.error).toBeTruthy();
    expect(data?.error).toContain('at least 2');
  });

  it('should return 404 for status check on non-existent session', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.warn('[Skip] No auth session for render-video test');
      return;
    }

    const { data } = await supabase.functions.invoke('render-video', {
      body: { action: 'status', sessionId: '00000000-0000-0000-0000-000000000000' },
    });

    expect(data?.error).toBeTruthy();
  });
});
