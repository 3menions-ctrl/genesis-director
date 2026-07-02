// ═══════════════════════════════════════════════════════════════════════════
// render-ui — DETERMINISTIC platform UI renderer (satori → resvg → PNG).
//
// The Effect Compiler's rigid layer, upgraded: instead of asking an image
// model to hallucinate a "realistic feed" (approximate, unrepeatable, rect
// unknown), platform UIs are AUTHORED AS LAYOUT CODE and rendered to exact
// pixels — real typography, real spacing, exact aspect ratio, and the video
// slot rect exact BY CONSTRUCTION. Free (no model call), instant, reusable.
//
// POST { template: 'feed'|'youtube'|'netflix'|'tiktok'|'instagram',
//        props?: {...}, persistKey? }
// → { url, width, height, slotRect: [x,y,w,h] }
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import satori from 'https://esm.sh/satori@0.10.13';
import { initWasm, Resvg } from 'https://esm.sh/@resvg/resvg-wasm@2.6.2';
import { publicErrorMessage } from '../_shared/safe-error.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// ── one-time wasm + font init (cached across warm invocations) ─────────────
let ready: Promise<{ regular: ArrayBuffer; bold: ArrayBuffer }> | null = null;
function init() {
  if (!ready) {
    ready = (async () => {
      await initWasm(fetch('https://esm.sh/@resvg/resvg-wasm@2.6.2/index_bg.wasm'));
      const [regular, bold] = await Promise.all([
        fetch('https://unpkg.com/@fontsource/inter@5.0.16/files/inter-latin-400-normal.woff').then((r) => r.arrayBuffer()),
        fetch('https://unpkg.com/@fontsource/inter@5.0.16/files/inter-latin-700-normal.woff').then((r) => r.arrayBuffer()),
      ]);
      return { regular, bold };
    })();
  }
  return ready;
}

import { TEMPLATES } from './templates.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const { validateAuth, unauthorizedResponse } = await import('../_shared/auth-guard.ts');
    const auth = await validateAuth(req);
    if (!auth.authenticated) return unauthorizedResponse(corsHeaders, auth.error);

    const { template, props = {}, persistKey } = await req.json();
    const tpl = TEMPLATES[String(template)];
    if (!tpl) return json(400, { error: `unknown template — have: ${Object.keys(TEMPLATES).join(', ')}` });

    const fonts = await init();
    const svg = await satori(tpl.tree(props) as never, {
      width: tpl.width,
      height: tpl.height,
      fonts: [
        { name: 'Inter', data: fonts.regular, weight: 400 as const, style: 'normal' as const },
        { name: 'Inter', data: fonts.bold, weight: 700 as const, style: 'normal' as const },
      ],
    });
    const png = new Resvg(svg, { fitTo: { mode: 'width', value: tpl.width } }).render().asPng();

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const path = persistKey || `effects/ui/${template}-${Date.now()}.png`;
    const { error } = await supabase.storage.from('video-clips').upload(path, png, { contentType: 'image/png', upsert: true });
    if (error) throw new Error(`persist failed: ${error.message}`);
    const url = supabase.storage.from('video-clips').getPublicUrl(path).data.publicUrl;

    return json(200, { url, width: tpl.width, height: tpl.height, slotRect: tpl.slotRect });
  } catch (e) {
    console.error('[render-ui] error:', e);
    return json(500, { error: publicErrorMessage(e) });
  }
});
