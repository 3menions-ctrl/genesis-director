import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendResendEmail } from '../_shared/resend.ts'

// @public-endpoint
// Public newsletter sign-up form on the landing page (no account
// required). Writes only an email to the subscribers list; no privileged
// data is read or returned.

// Public newsletter / email-subscribe endpoint. Stores the email and sends a
// Resend welcome. verify_jwt is false (config.toml) — it's a public form — so
// we do our own light validation + per-email idempotency.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const FROM = 'Small Bridges <noreply@smallbridges.co>'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!supabaseUrl || !serviceKey) return json({ error: 'Server configuration error' }, 500)

  let email = ''
  let source = 'website'
  try {
    const body = await req.json()
    email = String(body?.email ?? '').trim().toLowerCase()
    if (typeof body?.source === 'string') source = body.source.slice(0, 60)
  } catch {
    return json({ error: 'Invalid request body' }, 400)
  }

  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return json({ error: 'Please enter a valid email address.' }, 400)
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  // RATE LIMIT (audit fix): this public endpoint sends a Resend welcome to any
  // submitted address. Without a limit it can be abused to email-bomb third
  // parties and burn Resend spend. Cap per client IP via the DB-backed atomic
  // limiter (5 / 5 min — generous for a legitimate one-time signup form).
  const clientIp = (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0] ||
    'unknown'
  ).trim()
  const { data: underLimit } = await supabase.rpc('rate_limit_hit', {
    p_key: `newsletter:${clientIp}`,
    p_limit: 5,
    p_window_seconds: 300,
  })
  if (underLimit === false) {
    return json({ error: 'Too many requests. Please try again later.' }, 429)
  }

  // Is this a brand-new subscriber? (drives whether we send the welcome)
  const { data: existing } = await supabase
    .from('newsletter_subscribers')
    .select('id, status')
    .eq('email', email)
    .maybeSingle()

  const { error: upsertError } = await supabase
    .from('newsletter_subscribers')
    .upsert(
      { email, status: 'subscribed', source, confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { onConflict: 'email' },
    )
  if (upsertError) {
    console.error('newsletter upsert failed', upsertError)
    return json({ error: 'Could not subscribe. Please try again.' }, 500)
  }

  // Already an active subscriber → idempotent success, no duplicate welcome.
  if (existing && existing.status === 'subscribed') {
    return json({ ok: true, already: true })
  }

  // Send the welcome (best-effort — subscription is already saved).
  if (resendKey) {
    const html = `<!doctype html><html><body style="margin:0;background:#0b0e14;padding:32px 0;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#11141c;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden">
      <tr><td style="padding:32px 32px 8px"><div style="font-size:20px;font-weight:600;color:#fff;letter-spacing:-0.01em">Small Bridges</div></td></tr>
      <tr><td style="padding:8px 32px 4px"><div style="font-size:22px;color:#fff;font-weight:600">You're on the list. 🎬</div></td></tr>
      <tr><td style="padding:8px 32px 24px">
        <p style="color:#aab;line-height:1.6;font-size:15px;margin:0 0 16px">Thanks for subscribing. We'll send you the best of AI filmmaking — new models, cinematic techniques, product drops, and creator stories. No spam, unsubscribe anytime.</p>
        <a href="https://smallbridges.co/studio" style="display:inline-block;background:#fff;color:#000;text-decoration:none;font-weight:600;font-size:14px;padding:11px 22px;border-radius:999px">Start creating →</a>
      </td></tr>
      <tr><td style="padding:16px 32px 28px;border-top:1px solid rgba(255,255,255,0.06)">
        <p style="color:#667;font-size:12px;line-height:1.5;margin:0">Small Bridges · cinematic video, generated. <a href="https://smallbridges.co/unsubscribe" style="color:#889">Unsubscribe</a></p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`
    try {
      await sendResendEmail(
        {
          to: email,
          from: FROM,
          subject: "You're subscribed to Small Bridges",
          html,
          text: "You're on the list. Thanks for subscribing to Small Bridges — the best of AI filmmaking, no spam. Start creating: https://smallbridges.co/studio",
          label: 'newsletter_welcome',
        },
        { apiKey: resendKey },
      )
    } catch (e) {
      console.error('newsletter welcome send failed', e instanceof Error ? e.message : e)
      // non-fatal — they're subscribed
    }
  }

  return json({ ok: true })
})
