/**
 * Regression: a successful purchase MUST create a bell notification.
 *
 * A real customer bought credits via the sandbox and got no notification — the
 * polar-webhook granted credits but never wrote a `notifications` row. These
 * source-level assertions lock the wiring so it can't silently regress.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

describe('purchase → notification wiring', () => {
  const webhook = read('supabase/functions/polar-webhook/index.ts');

  it('webhook defines a notifyUser helper that writes to notifications with a dedupe key', () => {
    expect(webhook).toMatch(/async function notifyUser/);
    expect(webhook).toMatch(/from\(["']notifications["']\)/);
    expect(webhook).toMatch(/dedupe_key/);
    // idempotent upsert so a retry can't double-notify
    expect(webhook).toMatch(/onConflict:\s*["']dedupe_key["']/);
  });

  it('grantCredits notifies the user after add_credits succeeds', () => {
    const grant = webhook.slice(webhook.indexOf('async function grantCredits'));
    expect(grant).toMatch(/add_credits/);
    expect(grant).toMatch(/notifyUser\(/);
    expect(grant).toMatch(/credits_purchased|subscription_renewed/);
  });

  it('a migration adds the user-facing money notification enum values', () => {
    const mig = read('supabase/migrations/20260702000000_purchase_notifications.sql');
    expect(mig).toMatch(/ADD VALUE IF NOT EXISTS 'credits_purchased'/);
    expect(mig).toMatch(/ADD VALUE IF NOT EXISTS 'subscription_renewed'/);
  });

  it('the client notification types + bell know the new types', () => {
    const hook = read('src/hooks/useNotifications.ts');
    expect(hook).toMatch(/'credits_purchased'/);
    expect(hook).toMatch(/'subscription_renewed'/);
    // they should toast (urgent) so the buyer gets immediate feedback
    const urgent = hook.slice(hook.indexOf('URGENT_TYPES'));
    expect(urgent.slice(0, 200)).toMatch(/credits_purchased/);

    const bell = read('src/components/social/NotificationBell.tsx');
    expect(bell).toMatch(/credits_purchased:/);
    expect(bell).toMatch(/subscription_renewed:/);
  });
});
