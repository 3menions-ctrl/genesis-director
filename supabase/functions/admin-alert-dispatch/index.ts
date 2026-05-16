/**
 * admin-alert-dispatch
 * Internal fan-out called by Postgres triggers (via pg_net) when an
 * admin-worthy event occurs (signup / purchase / support / inquiry).
 * Forwards to send-transactional-email with the right template + payload.
 * verify_jwt=false — only invoked from DB (no public surface).
 */
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ADMIN_EMAIL = 'admincole@apex-studio.ai'

type Kind =
  | 'signup' | 'purchase' | 'support' | 'inquiry'
  | 'payment_failed' | 'refund' | 'dispute' | 'high_value_purchase'
  | 'stuck_job' | 'first_video' | 'account_deleted' | 'abuse_signal' | 'error_spike'

const TEMPLATE_BY_KIND: Record<Kind, string> = {
  signup: 'admin_new_signup',
  purchase: 'admin_credit_purchase',
  support: 'admin_contact_message',
  inquiry: 'admin_sales_inquiry',
  payment_failed: 'admin_payment_failed',
  refund: 'admin_refund',
  dispute: 'admin_dispute',
  high_value_purchase: 'admin_credit_purchase',
  stuck_job: 'admin_stuck_job',
  first_video: 'admin_first_video',
  account_deleted: 'admin_account_deleted',
  abuse_signal: 'admin_abuse_signal',
  error_spike: 'admin_error_spike',
}

const SEVERITY_BY_KIND: Record<Kind, 'info' | 'warn' | 'critical'> = {
  signup: 'info', purchase: 'info', support: 'info', inquiry: 'info',
  payment_failed: 'warn', refund: 'warn', dispute: 'critical',
  high_value_purchase: 'warn', stuck_job: 'warn', first_video: 'info',
  account_deleted: 'warn', abuse_signal: 'critical', error_spike: 'critical',
}

const EMOJI_BY_KIND: Record<Kind, string> = {
  signup: '🟢', purchase: '💸', support: '💬', inquiry: '🏢',
  payment_failed: '⚠️', refund: '↩️', dispute: '🚨',
  high_value_purchase: '🔥', stuck_job: '⏱️', first_video: '🎬',
  account_deleted: '👋', abuse_signal: '🛑', error_spike: '💥',
}

async function forwardToWebhooks(kind: Kind, data: Record<string, any>) {
  const slack = Deno.env.get('ADMIN_SLACK_WEBHOOK_URL')
  const discord = Deno.env.get('ADMIN_DISCORD_WEBHOOK_URL')
  if (!slack && !discord) return

  const sev = SEVERITY_BY_KIND[kind]
  const emoji = EMOJI_BY_KIND[kind] || '🔔'
  const title = (data.title as string) || `${kind} event`
  const body = (data.body as string) || JSON.stringify(data).slice(0, 280)
  const text = `${emoji} *${title}* _(severity: ${sev})_\n${body}`

  const sends: Promise<unknown>[] = []
  if (slack) {
    sends.push(
      fetch(slack, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      }).catch((e) => console.error('[slack] send failed', e)),
    )
  }
  if (discord) {
    sends.push(
      fetch(discord, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      }).catch((e) => console.error('[discord] send failed', e)),
    )
  }
  await Promise.allSettled(sends)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  try {
    const body = await req.json()
    const kind = body?.kind as Kind
    const data = body?.data || {}
    const eventId = body?.eventId || crypto.randomUUID()

    const templateName = TEMPLATE_BY_KIND[kind]
    if (!templateName) {
      return new Response(JSON.stringify({ error: 'unknown kind' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    const { data: res, error } = await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName,
        recipientEmail: ADMIN_EMAIL,
        idempotencyKey: `admin-${kind}-${eventId}`,
        templateData: data,
        purpose: 'transactional',
      },
    })

    if (error) {
      console.error('[admin-alert-dispatch] forward failed', error)
    }

    // Fire-and-forget webhook fan-out (non-blocking on email outcome)
    await forwardToWebhooks(kind, data)

    return new Response(JSON.stringify({ ok: true, emailed: !error, result: res }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('[admin-alert-dispatch] exception', e)
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})