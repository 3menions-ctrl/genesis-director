// Replicate catalog proxy — search models, fetch schemas, return featured list.
// Read-only: only proxies GET requests to Replicate's public API using the
// project's REPLICATE_API_KEY. Auth required.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2.45.0';

const REPLICATE_API_KEY = Deno.env.get('REPLICATE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

// Curated featured list — first paint of the model picker.
const FEATURED = [
  { owner: 'wan-ai', name: 'wan-2.5-t2v', label: 'Wan 2.5 — Free', category: 'video', tier: 'standard' },
  { owner: 'kwaivgi', name: 'kling-v2.1-master', label: 'Kling V3', category: 'video', tier: 'standard' },
  { owner: 'bytedance', name: 'seedance-1-pro', label: 'Seedance 2.0', category: 'video', tier: 'pro' },
  { owner: 'google', name: 'veo-3-fast', label: 'Veo 3 Fast', category: 'video', tier: 'cinema' },
  { owner: 'runwayml', name: 'gen4-turbo', label: 'Runway Gen-4', category: 'video', tier: 'cinema' },
  { owner: 'openai', name: 'sora-2', label: 'Sora 2', category: 'video', tier: 'cinema' },
  { owner: 'black-forest-labs', name: 'flux-1.1-pro-ultra', label: 'FLUX 1.1 Pro Ultra', category: 'image', tier: 'pro' },
  { owner: 'black-forest-labs', name: 'flux-fill-pro', label: 'FLUX Fill (outpaint)', category: 'image', tier: 'pro' },
  { owner: 'google', name: 'nano-banana', label: 'Nano Banana', category: 'image', tier: 'standard' },
  { owner: 'meta', name: 'musicgen', label: 'MusicGen', category: 'audio', tier: 'standard' },
  { owner: 'lucataco', name: 'xtts-v2', label: 'XTTS v2 (voice)', category: 'audio', tier: 'standard' },
];

async function replicate(path: string): Promise<Response> {
  if (!REPLICATE_API_KEY) {
    return new Response(JSON.stringify({ error: 'REPLICATE_API_KEY missing' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const r = await fetch(`https://api.replicate.com${path}`, {
    headers: { Authorization: `Bearer ${REPLICATE_API_KEY}` },
  });
  const body = await r.text();
  return new Response(body, {
    status: r.status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Validate caller session.
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action') ?? 'featured';

  try {
    if (action === 'featured') {
      return new Response(JSON.stringify({ models: FEATURED }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (action === 'search') {
      const q = url.searchParams.get('q') ?? '';
      return await replicate(`/v1/models?query=${encodeURIComponent(q)}`);
    }
    if (action === 'schema') {
      const owner = url.searchParams.get('owner');
      const name = url.searchParams.get('name');
      if (!owner || !name) {
        return new Response(JSON.stringify({ error: 'owner+name required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return await replicate(`/v1/models/${owner}/${name}`);
    }
    return new Response(JSON.stringify({ error: 'unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});