import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// @public-endpoint
// Widget telemetry sink. Public by design — embedded widgets POST analytics
// events from third-party sites. Protected by a DB-backed atomic rate limit
// keyed on client IP (NOT the attacker-controlled visitor_session) and a strict
// event-type allowlist; widget_id must exist. The credit-bearing `view` event
// has an additional per-(widget, IP) cap so it can't be inflated to drain the
// widget owner's credits.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // RATE LIMIT (audit fix): the previous limiter was in-memory (lost across
    // edge isolates) and keyed on the attacker-controlled `visitor_session`, so
    // an attacker could rotate the session per request to send unlimited events.
    // Use the DB-backed atomic limiter keyed on client IP instead.
    const clientIp = (
      req.headers.get('cf-connecting-ip') ||
      req.headers.get('x-forwarded-for')?.split(',')[0] ||
      'unknown'
    ).trim()
    const { data: underGlobalLimit } = await supabase.rpc('rate_limit_hit', {
      p_key: `widget_evt:${clientIp}`,
      p_limit: 240,
      p_window_seconds: 60,
    })
    if (underGlobalLimit === false) {
      return new Response(
        JSON.stringify({ error: 'Too many events' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify widget exists and is published
    const { data: widget, error: widgetError } = await supabase
      .from('widget_configs')
      .select('id, status, user_id')
      .eq('id', widget_id)
      .maybeSingle()

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

    // Check view credit metering (every 1K views). A per-(widget, IP) cap
    // ensures an attacker can't inflate `view` events to drain the owner's
    // credits — excess views are still recorded as analytics above but do NOT
    // drive owner-credit deduction.
    if (event_type === 'view') {
      const { data: underViewLimit } = await supabase.rpc('rate_limit_hit', {
        p_key: `widget_view:${widget_id}:${clientIp}`,
        p_limit: 60,
        p_window_seconds: 60,
      })
      if (underViewLimit !== false) {
        await supabase.rpc('check_widget_view_credits', {
          p_widget_id: widget_id,
        })
      }
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
