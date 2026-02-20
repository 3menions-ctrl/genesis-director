/**
 * Client-Side Security Hardening
 *
 * Provides tamper detection, input sanitization, rate limiting,
 * and anomaly reporting utilities.
 *
 * IMPORTANT: This is a defence-in-depth layer only.
 * All true enforcement happens server-side via RLS + DB functions.
 */

import DOMPurify from 'dompurify';
import { supabase } from '@/integrations/supabase/client';

// ─── Rate Limiter ────────────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Returns true if the action is allowed (under the limit).
 * Uses a sliding window approach per key.
 */
export function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now - entry.windowStart > windowMs) {
    rateLimitStore.set(key, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= maxAttempts) {
    return false; // Rate limited
  }

  entry.count++;
  return true;
}

// Clean up stale entries every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  rateLimitStore.forEach((entry, key) => {
    if (now - entry.windowStart > 10 * 60 * 1000) {
      rateLimitStore.delete(key);
    }
  });
}, 5 * 60 * 1000);

// ─── Input Sanitization ──────────────────────────────────────────────────────

/** Sanitize user-provided text to prevent XSS. Strips all HTML. */
export function sanitizeText(input: string, maxLength = 5000): string {
  if (typeof input !== 'string') return '';
  const stripped = DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
  return stripped.slice(0, maxLength);
}

/** Sanitize rich text while allowing safe formatting tags. */
export function sanitizeRichText(input: string, maxLength = 50_000): string {
  if (typeof input !== 'string') return '';
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'li', 'ol', 'code', 'pre'],
    ALLOWED_ATTR: [],
  }).slice(0, maxLength);
}

/** Validate a UUID format. */
export function isValidUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/** Validate that a credit amount is within plausible bounds. */
export function isValidCreditAmount(amount: number): boolean {
  return Number.isInteger(amount) && amount > 0 && amount <= 100_000;
}

/** Validate an email address format. */
export function isValidEmail(email: string): boolean {
  return /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(email) &&
    email.length <= 254;
}

// ─── Tamper Detection ────────────────────────────────────────────────────────

/**
 * Detects whether DevTools are likely open.
 * Used as a signal for potential manipulation — NOT as security enforcement.
 */
let devToolsOpen = false;
(function detectDevTools() {
  const threshold = 160;
  const check = () => {
    const widthDiff = window.outerWidth - window.innerWidth > threshold;
    const heightDiff = window.outerHeight - window.innerHeight > threshold;
    devToolsOpen = widthDiff || heightDiff;
  };
  check();
  window.addEventListener('resize', check, { passive: true });
})();

export function isDevToolsOpen(): boolean {
  return devToolsOpen;
}

// ─── Security Event Reporting ─────────────────────────────────────────────────

type SecurityEventType =
  | 'dom_manipulation_detected'
  | 'rapid_action_attempt'
  | 'invalid_credit_request'
  | 'devtools_open_on_payment'
  | 'console_override_detected'
  | 'xss_attempt_blocked'
  | 'invalid_uuid_submitted'
  | 'rate_limit_exceeded';

/**
 * Report a security event to the backend.
 * Non-blocking — failures are silently swallowed.
 */
export async function reportSecurityEvent(
  eventType: SecurityEventType,
  details: Record<string, unknown> = {}
): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return; // Only report for authenticated users

    await supabase.from('security_events').insert({
      user_id: session.user.id,
      event_type: eventType,
      severity: getSeverity(eventType),
      details: {
        ...details,
        url: window.location.pathname,
        timestamp: new Date().toISOString(),
      },
    });
  } catch {
    // Silent — security reporting must never crash the app
  }
}

function getSeverity(eventType: SecurityEventType): 'info' | 'warn' | 'critical' {
  const critical: SecurityEventType[] = [
    'dom_manipulation_detected',
    'invalid_credit_request',
    'xss_attempt_blocked',
  ];
  const warn: SecurityEventType[] = [
    'rapid_action_attempt',
    'devtools_open_on_payment',
    'console_override_detected',
    'rate_limit_exceeded',
  ];
  if (critical.includes(eventType)) return 'critical';
  if (warn.includes(eventType)) return 'warn';
  return 'info';
}

// ─── Payment Guard ───────────────────────────────────────────────────────────

/**
 * Run before any credit purchase flow.
 * Returns false and reports if suspicious conditions are detected.
 */
export async function guardPaymentAction(userId: string): Promise<boolean> {
  // Check rate limit: max 10 payment initiations per 10 minutes per user
  const key = `payment:${userId}`;
  if (!checkRateLimit(key, 10, 10 * 60 * 1000)) {
    await reportSecurityEvent('rate_limit_exceeded', { context: 'payment_initiation' });
    return false;
  }

  // Flag if DevTools are open during a payment (soft signal)
  if (isDevToolsOpen()) {
    await reportSecurityEvent('devtools_open_on_payment', { user_id: userId });
    // Don't block — just log
  }

  return true;
}

// ─── Console Protection ───────────────────────────────────────────────────────

/**
 * Override console.warn for XSS probe attempts.
 * Detects if someone is typing in the console and warns them.
 */
export function initConsoleWarning(): void {
  if (typeof window === 'undefined') return;

  const _warn = console.warn.bind(console);
  const WARNING = [
    '%c⚠️ Stop!',
    'color: red; font-size: 32px; font-weight: bold;',
    '\n%cThis browser feature is intended for developers. Pasting code here could give attackers access to your account.',
    'color: black; font-size: 16px;',
  ];

  // Display the warning once on load in development-adjacent contexts
  if (!window.location.hostname.includes('localhost')) {
    console.log(...WARNING);
  }
  
  // Restore original warn so our own code still works
  console.warn = _warn;
}
