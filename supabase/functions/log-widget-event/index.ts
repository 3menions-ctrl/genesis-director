import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Rate limiter per session
const sessionLimits = new Map<string, { count: number; resetAt: number }>()
const SESSION_RATE_LIMIT = 100
const SESSION_RATE_WINDOW = 60_000

function checkSessionRate(session: string): boolean {
  const now = Date.now()
  const entry = sessionLimits.get(session)
  if (!entry || now > entry.resetAt) {
    sessionLimits.set(session, { count: 1, resetAt: now + SESSION_RATE_WINDOW })
    return true
  }
  if (entry.count >= SESSION_RATE_LIMIT) return false
  entry.count++
  return true
}

const VALID_EVENTS = [
  'view', 'scene_play', 'scene_complete', 'cta_click', 'secondary_cta_click',
  'dismiss', 'minimize', 'reopen', 'exit_intent_fired', 'idle_triggered',
  'scroll_triggered', 'hover_triggered'
]

const VALID_DEVICES = ['desktop', 'mobile', 'tablet']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const body = await req.json()
    const { widget_id, event_type, scene_id, visitor_session, page_url, referrer, device_type, metadata } = body

    // Validate required fields
    if (!widget_id || !event_type) {
      return new Response(
        JSON.stringify({ error: 'widget_id and event_type required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate event type
    if (!VALID_EVENTS.includes(event_type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid event_type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate device type if provided
    if (device_type && !VALID_DEVICES.includes(device_type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid device_type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Rate limit per session
    const sessionKey = visitor_session || 'anon'
    if (!checkSessionRate(sessionKey)) {
      return new Response(
        JSON.stringify({ error: 'Too many events' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Verify widget exists and is published
    const { data: widget, error: widgetError } = await supabase
      .from('widget_configs')
      .select('id, status, user_id')
      .eq('id', widget_id)
      .single()

    if (widgetError || !widget || widget.status === 'archived') {
      return new Response(
        JSON.stringify({ error: 'Widget not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Sanitize page_url and referrer (strip query params with sensitive data)
    const sanitizedUrl = page_url ? page_url.split('?')[0] : null
    const sanitizedReferrer = referrer ? referrer.split('?')[0] : null

    // Insert event (using service role to bypass RLS)
    const { error: insertError } = await supabase
      .from('widget_events')
      .insert({
        widget_id,
        event_type,
        scene_id: scene_id || null,
        visitor_session: visitor_session || null,
        page_url: sanitizedUrl,
        referrer: sanitizedReferrer,
        device_type: device_type || null,
        metadata: metadata || {},
      })

    if (insertError) {
      console.error('Event insert error:', insertError)
      return new Response(
        JSON.stringify({ error: 'Failed to log event' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Increment analytics counters
    await supabase.rpc('increment_widget_analytics', {
      p_widget_id: widget_id,
      p_event_type: event_type,
    })

    // Check view credit metering (every 1K views)
    if (event_type === 'view') {
      await supabase.rpc('check_widget_view_credits', {
        p_widget_id: widget_id,
      })
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('log-widget-event error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
