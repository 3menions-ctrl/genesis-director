import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimitDb, extractClientIp } from '../_shared/rate-limiter.ts'

// @public-endpoint
// Embeddable widget config fetch. Public by design — third-party sites
// load this from a <script> tag with no Supabase JWT available. Protected
// by per-IP rate limit (60 req/min) and an opaque widget key/slug lookup.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'public, max-age=60', // Cache for 60s
}

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 60 // requests per window
const RATE_WINDOW = 60_000 // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW })
    return true
  }
  
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const key = url.searchParams.get('key')
    const slug = url.searchParams.get('slug')

    if (!key && !slug) {
      return new Response(
        JSON.stringify({ error: 'Missing key or slug parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Rate limit check. Trust cf-connecting-ip first (not client-spoofable);
    // fall back to the leftmost x-forwarded-for hop only alongside the
    // global cap below.
    const clientIp = extractClientIp(req.headers, 'unknown')
    if (!checkRateLimit(clientIp)) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Spoof-proof global cap (DB-backed, cross-isolate): a spoofed
    // x-forwarded-for can rotate per-IP buckets but cannot exceed this
    // single platform-wide counter. Fail OPEN on RPC error so a transient
    // DB hiccup doesn't blank out every embedded widget (read-only path).
    const globalAllowed = await checkRateLimitDb(
      supabase,
      'get-widget-config:global',
      50000,
      86400,
      true,
    )
    if (!globalAllowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch widget config
    let query = supabase
      .from('widget_configs')
      .select('id, name, slug, widget_type, status, primary_color, logo_url, background_color, font_family, position, z_index, widget_width, widget_height, cta_text, cta_url, cta_color, secondary_cta_text, secondary_cta_url, headline, subheadline, scenes, triggers, rules, sensitivity, allowed_domains, tone')

    if (key) {
      query = query.eq('public_key', key)
    } else if (slug) {
      query = query.eq('slug', slug)
    }

    const { data, error } = await query.eq('status', 'published').maybeSingle()

    if (error || !data) {
      return new Response(
        JSON.stringify({ error: 'Widget not found or not published' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Domain allowlist check for embeds
    const origin = req.headers.get('origin') || req.headers.get('referer') || ''
    if (data.allowed_domains && data.allowed_domains.length > 0 && data.widget_type !== 'landing_page') {
      try {
        const originHost = new URL(origin).hostname
        const allowed = data.allowed_domains.some((d: string) => 
          originHost === d || originHost.endsWith('.' + d)
        )
        if (!allowed) {
          return new Response(
            JSON.stringify({ error: 'Domain not authorized' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      } catch {
        // FAIL CLOSED: an allowlist is configured but the origin/referer is
        // missing or unparseable. Previously this allowed the request (a
        // fail-open bug) — anyone could bypass the domain allowlist by
        // stripping the Origin header. Deny instead.
        return new Response(
          JSON.stringify({ error: 'Domain not authorized' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Return safe config (no secret keys, no internal IDs beyond widget)
    return new Response(
      JSON.stringify({ config: data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('get-widget-config error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
