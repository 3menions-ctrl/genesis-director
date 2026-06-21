/**
 * readEdgeError — extract the REAL error message from a failed
 * `supabase.functions.invoke` call.
 *
 * When an edge function returns a non-2xx status, supabase-js throws a
 * `FunctionsHttpError` whose `.message` is the useless generic
 * "Edge Function returned a non-2xx status code". The actual reason the
 * function reported (e.g. `no_clips_with_video_url_for_project`,
 * `replicate_submit_401`, `REPLICATE_API_KEY not configured`) lives in
 * `.context`, which is the raw `Response`. We read its JSON/text body so
 * the user — and the logs — see what actually went wrong.
 */
export async function readEdgeError(error: unknown, fallback = "Request failed"): Promise<string> {
  const e = error as { message?: string; context?: unknown } | null | undefined;
  if (!e) return fallback;

  const ctx = e.context as Response | undefined;
  if (ctx && typeof (ctx as Response).clone === "function") {
    try {
      const body = await (ctx as Response).clone().json();
      const detail = (body && (body.error || body.message)) as string | undefined;
      if (detail) return `${e.message ?? "Edge error"}: ${detail}`;
    } catch {
      try {
        const text = await (ctx as Response).clone().text();
        if (text && text.trim()) return `${e.message ?? "Edge error"}: ${text.trim().slice(0, 300)}`;
      } catch {
        /* body already consumed or not readable */
      }
    }
  }
  return e.message ?? fallback;
}
