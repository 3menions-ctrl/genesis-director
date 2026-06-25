/**
 * safeErrorMessage — the one function every user-facing surface should use to
 * turn an unknown thrown value into a message that is SAFE to show a user.
 *
 * The problem it solves: hundreds of call sites do `toast.error(error.message)`
 * or `setError(error.message)`. When `error` comes from the Supabase client, a
 * Postgres/PostgREST failure, an auth API, or a raw third-party SDK, that
 * `.message` leaks internals — SQL, table/column names, constraint names,
 * stack traces, internal IDs, file paths, env var names, JWT fragments, or raw
 * Polar/Stripe/Replicate errors.
 *
 * Contract:
 *   • If the message looks like a known TECHNICAL/INTERNAL leak, return a safe,
 *     friendly fallback instead.
 *   • Otherwise return the original message (so intentionally friendly messages
 *     coming back from our own APIs still reach the user).
 *   • The FULL original is never discarded silently — callers should still log
 *     it (see `logTechnicalError`) for debugging.
 *
 * This is intentionally conservative: when in doubt, prefer the safe fallback.
 */

const DEFAULT_FALLBACK = 'Something went wrong. Please try again.';

/**
 * Markers that indicate the string contains internal/technical detail that must
 * never be shown to a user. If any match, we suppress the raw message.
 */
const LEAK_MARKERS: RegExp[] = [
  // Postgres / PostgREST / Supabase internals
  /PGRST\d*/i,
  /\bSQLSTATE\b/i,
  /\bpostgres(ql)?\b/i,
  /duplicate key value/i,
  /violates (unique|foreign key|check|not-null) constraint/i,
  /violates row-level security/i,
  /row-level security policy/i,
  /\brelation ".*" does not exist/i,
  /\bcolumn ".*" does not exist/i,
  /\bschema "public"/i,
  /permission denied for (table|relation|schema|function|sequence)/i,
  /\bnull value in column\b/i,
  /\bunexpected token\b.*\bjson\b/i,
  // Common Postgres error code shapes (5-char SQLSTATE) when surfaced verbatim
  /\b23505\b|\b23503\b|\b23502\b|\b42501\b|\b42P01\b|\b42703\b/,

  // Stack traces / source locations / internals
  /\bat\s+\w+.*\(.*:\d+:\d+\)/, // "at fn (file.ts:12:5)"
  /\.(ts|tsx|js|jsx|mjs|cjs):\d+/, // file:line
  /\/(home|users|var|usr|root|opt|tmp|app|src)\//i, // absolute-ish paths
  /[A-Za-z]:\\/, // windows paths
  /\bnode_modules\b/,
  /\bDeno\.\w+/,
  /\bTypeError\b|\bReferenceError\b|\bSyntaxError\b|\bRangeError\b/,
  /Cannot read propert(y|ies) of (undefined|null)/i,
  /is not a function\b/i,
  /is not defined\b/i,

  // Secrets / config / env
  /\b[A-Z0-9]{2,}_(KEY|SECRET|TOKEN|URL|ID)\b/, // SUPABASE_SERVICE_ROLE_KEY etc.
  /service[_-]?role/i,
  /\bbearer\s+[A-Za-z0-9._-]{10,}/i,
  /eyJ[A-Za-z0-9._-]{10,}/, // JWT fragment
  /sk_(live|test)_[A-Za-z0-9]+/, // stripe-style secret keys
  /\bwhsec_[A-Za-z0-9]+/,
  /https?:\/\/[a-z0-9-]+\.supabase\.co/i,

  // Raw third-party SDK shapes
  /Stripe\w*Error/i,
  /\bPolar\w*Error\b/i,
  /replicate.*\b(401|403|422|500)\b/i,

  // Generic-but-useless internals
  /Edge Function returned a non-2xx status code/i,
  /FunctionsHttpError|FunctionsRelayError|FunctionsFetchError/,
  /\[object Object\]/,
];

/** Messages that are entirely useless to a user — always replace. */
const USELESS_EXACT: RegExp[] = [
  /^undefined$/i,
  /^null$/i,
  /^\s*$/,
  /^error$/i,
  /^\{.*\}$/, // serialized object
  /^\[.*\]$/, // serialized array
];

function rawMessageOf(error: unknown): string {
  if (error === null || error === undefined) return '';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message ?? '';
  if (typeof error === 'object') {
    const o = error as Record<string, unknown>;
    // Supabase PostgrestError: { message, details, hint, code }
    const candidate = o.message ?? o.error_description ?? o.error ?? o.msg;
    if (typeof candidate === 'string') return candidate;
  }
  return '';
}

/** True when the message is safe to show a user as-is. */
export function isUserSafeMessage(message: string): boolean {
  const m = (message ?? '').trim();
  if (!m) return false;
  if (USELESS_EXACT.some((re) => re.test(m))) return false;
  if (m.length > 300) return false; // long strings are almost always dumps
  return !LEAK_MARKERS.some((re) => re.test(m));
}

/**
 * Convert any thrown value into a user-safe message.
 * @param error    the unknown thrown value / error object
 * @param fallback friendly message to use when the raw message is unsafe
 */
export function safeErrorMessage(error: unknown, fallback: string = DEFAULT_FALLBACK): string {
  const raw = rawMessageOf(error).trim();
  if (isUserSafeMessage(raw)) return raw;
  return fallback;
}

/**
 * Log the FULL technical detail for debugging without showing it to the user.
 * Use alongside `safeErrorMessage` at every catch site.
 */
export function logTechnicalError(context: string, error: unknown): void {
  console.error(`[${context}]`, error);
}
