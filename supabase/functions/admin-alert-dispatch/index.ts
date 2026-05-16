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

type Kind = 'signup' | 'purchase' | 'support' | 'inquiry'

const TEMPLATE_BY_KIND: Record<Kind, string> = {
  signup: 'admin_new_signup',
  purchase: 'admin_credit_purchase',
  support: 'admin_contact_message',
  inquiry: 'admin_sales_inquiry',
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
      return new Response(JSON.stringify({ ok: false, error: String(error) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ ok: true, result: res }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('[admin-alert-dispatch] exception', e)
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})