import { describe, it, expect } from 'vitest';
import { safeErrorMessage, isUserSafeMessage } from '@/lib/safeErrorMessage';

describe('safeErrorMessage — leak suppression', () => {
  const FALLBACK = 'Could not complete that. Please try again.';

  it('suppresses raw Postgres / PostgREST errors', () => {
    const cases = [
      'duplicate key value violates unique constraint "profiles_email_key"',
      'new row violates row-level security policy for table "credit_holds"',
      'relation "public.org_seats" does not exist',
      'column "polar_customer_id" does not exist',
      'PGRST116: JSON object requested, multiple (or no) rows returned',
      'permission denied for table profiles',
      'null value in column "user_id" violates not-null constraint',
    ];
    for (const c of cases) {
      expect(safeErrorMessage(new Error(c), FALLBACK)).toBe(FALLBACK);
      expect(isUserSafeMessage(c)).toBe(false);
    }
  });

  it('suppresses stack traces and file/path internals', () => {
    expect(safeErrorMessage(new Error('TypeError: x is not a function'), FALLBACK)).toBe(FALLBACK);
    expect(safeErrorMessage('at handler (/var/task/index.ts:42:9)', FALLBACK)).toBe(FALLBACK);
    expect(safeErrorMessage('Cannot read properties of undefined (reading "id")', FALLBACK)).toBe(FALLBACK);
    expect(safeErrorMessage('failed at src/lib/credits/creditSystem.ts:88', FALLBACK)).toBe(FALLBACK);
  });

  it('suppresses secrets, tokens, env var names and supabase URLs', () => {
    expect(safeErrorMessage('SUPABASE_SERVICE_ROLE_KEY not configured', FALLBACK)).toBe(FALLBACK);
    expect(safeErrorMessage('Invalid token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', FALLBACK)).toBe(FALLBACK);
    expect(safeErrorMessage('using service_role to bypass RLS', FALLBACK)).toBe(FALLBACK);
    expect(safeErrorMessage('GET https://abcdefg.supabase.co/rest/v1 500', FALLBACK)).toBe(FALLBACK);
    expect(safeErrorMessage('stripe key sk_live_abc123DEF456 rejected', FALLBACK)).toBe(FALLBACK);
  });

  it('suppresses raw third-party SDK and useless generic shapes', () => {
    expect(safeErrorMessage('Edge Function returned a non-2xx status code', FALLBACK)).toBe(FALLBACK);
    expect(safeErrorMessage('StripeInvalidRequestError: No such customer', FALLBACK)).toBe(FALLBACK);
    expect(safeErrorMessage('[object Object]', FALLBACK)).toBe(FALLBACK);
    expect(safeErrorMessage('', FALLBACK)).toBe(FALLBACK);
    expect(safeErrorMessage('undefined', FALLBACK)).toBe(FALLBACK);
    expect(safeErrorMessage(null, FALLBACK)).toBe(FALLBACK);
    expect(safeErrorMessage(undefined, FALLBACK)).toBe(FALLBACK);
  });

  it('suppresses over-long dumps', () => {
    expect(safeErrorMessage('x'.repeat(400), FALLBACK)).toBe(FALLBACK);
  });

  it('passes through intentionally friendly messages', () => {
    const friendly = [
      "You don't have enough credits for this action.",
      'That email is already registered — try signing in instead.',
      'Your video is still generating. Please wait a moment.',
      'Please enter a valid email address.',
    ];
    for (const f of friendly) {
      expect(safeErrorMessage(new Error(f), FALLBACK)).toBe(f);
      expect(isUserSafeMessage(f)).toBe(true);
    }
  });

  it('reads message from Supabase-style error objects', () => {
    expect(safeErrorMessage({ message: 'PGRST301: row not found', code: 'PGRST301' }, FALLBACK)).toBe(FALLBACK);
    expect(safeErrorMessage({ error_description: 'Invalid login credentials' }, FALLBACK)).toBe('Invalid login credentials');
  });

  it('uses the default fallback when none is supplied', () => {
    expect(safeErrorMessage(new Error('PGRST116: no rows'))).toBe('Something went wrong. Please try again.');
  });
});
