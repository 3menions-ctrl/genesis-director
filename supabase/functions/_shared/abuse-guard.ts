/**
 * Runtime enforcement of admin-configured abuse_rules (ip_block / email_block).
 *
 * The /admin/abuse UI writes rules into public.abuse_rules; this is the
 * request-time layer that actually reads them. Call early in an edge function
 * (after you have a service-role client and, optionally, the caller's email).
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

/** Best-effort client IP from common proxy headers. */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('cf-connecting-ip')
    ?? req.headers.get('x-real-ip')
    ?? '';
}

export interface AbuseVerdict {
  blocked: boolean;
  reason?: string;
  kind?: string;
}

/**
 * Returns the abuse verdict for this request. Fail-OPEN on any RPC error so a
 * checker outage never takes down legitimate traffic.
 */
export async function checkAbuse(
  admin: SupabaseClient,
  req: Request,
  email?: string | null,
): Promise<AbuseVerdict> {
  try {
    const { data, error } = await admin.rpc('check_abuse_block', {
      p_ip: clientIp(req),
      p_email: email ?? '',
    });
    if (error || !data) return { blocked: false };
    return data as AbuseVerdict;
  } catch {
    return { blocked: false };
  }
}

/** 403 response for a blocked request. */
export function abuseBlockedResponse(
  corsHeaders: Record<string, string>,
  verdict: AbuseVerdict,
): Response {
  return new Response(
    JSON.stringify({ error: 'forbidden', reason: verdict.reason ?? 'Request blocked' }),
    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}
