/**
 * safe-error — sanitize unexpected errors before they leave an edge function.
 *
 * Raw `error.message` in a 500 response leaks internals: SQL errors, storage
 * paths, provider payloads, internal URLs. But this codebase ALSO throws
 * deliberate machine-readable codes (`auth_required`, `replicate_submit_402`,
 * `project_not_found: …`) that clients match on — those must survive.
 *
 * Contract:
 *   • The FULL error is logged server-side (function logs are private).
 *   • The response gets either (a) the error's leading snake_case/kebab-case
 *     CODE token when the message starts with one, or (b) a generic fallback.
 *   • Deliberate user-facing validation messages (4xx paths the function
 *     authored on purpose) should NOT be routed through this — keep those
 *     as-is; this is for catch-blocks and unexpected failures.
 */

const CODE_RE = /^[a-z][a-z0-9_:-]{2,63}/;

export function publicErrorMessage(
  e: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  const raw = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  // Preserve a leading machine code (no spaces before the first delimiter):
  // "replicate_submit_402: {...}" → "replicate_submit_402".
  const firstToken = raw.split(/[\s]/)[0] ?? "";
  if (CODE_RE.test(firstToken) && firstToken === firstToken.toLowerCase()) {
    return firstToken.replace(/[:,;]+$/, "");
  }
  return fallback;
}

/** Log the full error privately + return the sanitized public message. */
export function logAndSanitize(
  tag: string,
  e: unknown,
  fallback?: string,
): string {
  console.error(`[${tag}]`, e);
  return publicErrorMessage(e, fallback);
}
