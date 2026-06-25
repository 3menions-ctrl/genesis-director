// ============================================================================
// _shared/error-response.ts — canonical sanitized error responses
//
// Edge functions must NEVER return raw exception text, Postgres/Supabase
// errors, SQL, table/column names, internal IDs, file paths, env var names,
// secrets, or raw third-party (Polar / Stripe / Replicate / OpenAI …) errors
// to the client. The frontend renders `body.error` / `body.message` straight
// to users, so anything in those fields is user-visible.
//
// Pattern enforced by this module:
//   • LOG the full technical detail server-side (console.error) for debugging.
//   • RETURN only a stable machine `code` + a safe, friendly `message`.
//   • ATTACH a short `errorId` so support can correlate a user report with the
//     server log line without exposing internals.
//
// Usage:
//   import { corsHeaders, safeErrorResponse } from "../_shared/error-response.ts";
//   return safeErrorResponse({
//     status: 500, code: "rpc_failed", detail: error, fn: "reserve-credits",
//     userMessage: "We couldn't reserve credits. Please try again.",
//   });
// ============================================================================

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Short, non-guessable correlation id for support/debugging. */
export function newErrorId(): string {
  try {
    return crypto.randomUUID().slice(0, 8);
  } catch {
    // Fallback if crypto is somehow unavailable.
    return Math.abs(Date.now() ^ (performance?.now?.() ?? 0)).toString(36).slice(0, 8);
  }
}

/** Best-effort extraction of FULL technical detail — for SERVER LOGS ONLY. */
export function extractDetail(detail: unknown): string {
  if (detail == null) return "(no detail)";
  if (typeof detail === "string") return detail;
  if (detail instanceof Error) return `${detail.name}: ${detail.message}\n${detail.stack ?? ""}`;
  if (typeof detail === "object") {
    const o = detail as Record<string, unknown>;
    if (typeof o.message === "string") return o.message;
    try { return JSON.stringify(detail); } catch { return String(detail); }
  }
  return String(detail);
}

const DEFAULT_MESSAGE_FOR_STATUS: Record<number, string> = {
  400: "That request couldn't be processed. Please check your input and try again.",
  401: "Your session has expired. Please sign in again.",
  402: "You don't have enough credits for this action.",
  403: "You don't have permission to do that.",
  404: "We couldn't find what you were looking for.",
  405: "That action isn't allowed here.",
  409: "That action conflicts with something already in progress. Please refresh and try again.",
  422: "Some of the details provided weren't valid. Please review and try again.",
  429: "You're going a little fast — please wait a moment and try again.",
  500: "Something went wrong on our end. Please try again in a moment.",
  502: "Our service is briefly unavailable. Please try again shortly.",
  503: "Our service is briefly unavailable. Please try again shortly.",
  504: "That took too long to respond. Please try again.",
};

export function defaultMessageForStatus(status: number): string {
  return DEFAULT_MESSAGE_FOR_STATUS[status] ?? "Something went wrong. Please try again.";
}

export interface SafeErrorOptions {
  /** HTTP status to return. */
  status: number;
  /** Stable, machine-readable code, e.g. "rpc_failed". Safe to expose. */
  code: string;
  /** Safe, friendly message shown to the user. Defaults from status. */
  userMessage?: string;
  /** FULL technical detail. Logged server-side, NEVER returned to the client. */
  detail?: unknown;
  /** Function name, for log correlation. */
  fn?: string;
  /** Additional SAFE fields to include in the response body (no raw errors!). */
  extra?: Record<string, unknown>;
  /** Override CORS / content headers. */
  headers?: Record<string, string>;
}

/**
 * Build a sanitized error Response: logs full detail server-side, returns only
 * { error: code, message, errorId, ...extra } to the client.
 */
export function safeErrorResponse(opts: SafeErrorOptions): Response {
  const errorId = newErrorId();
  const detailText = extractDetail(opts.detail);
  console.error(`[${opts.fn ?? "edge"}] ${opts.code} status=${opts.status} errorId=${errorId} :: ${detailText}`);

  const body: Record<string, unknown> = {
    error: opts.code,
    message: opts.userMessage ?? defaultMessageForStatus(opts.status),
    errorId,
    ...(opts.extra ?? {}),
  };

  return new Response(JSON.stringify(body), {
    status: opts.status,
    headers: { ...(opts.headers ?? corsHeaders), "Content-Type": "application/json" },
  });
}
