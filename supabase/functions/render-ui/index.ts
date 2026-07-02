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

// ── tiny element helper (satori consumes React-ish object trees) ───────────
type El = { type: string; props: Record<string, unknown> };
function h(type: string, style: Record<string, unknown>, ...children: (El | string | null)[]): El {
  return { type, props: { style, children: children.filter(Boolean).length === 1 ? children.filter(Boolean)[0] : children.filter(Boolean) } };
}
const row = (style: Record<string, unknown>, ...c: (El | string | null)[]) => h('div', { display: 'flex', flexDirection: 'row', ...style }, ...c);
const col = (style: Record<string, unknown>, ...c: (El | string | null)[]) => h('div', { display: 'flex', flexDirection: 'column', ...style }, ...c);
const txt = (text: string, style: Record<string, unknown>) => h('div', { display: 'flex', ...style }, text);
const circle = (size: number, bg: string, extra: Record<string, unknown> = {}) => h('div', { display: 'flex', width: size, height: size, borderRadius: size / 2, backgroundColor: bg, ...extra });
const pill = (w: number, hgt: number, bg: string, extra: Record<string, unknown> = {}) => h('div', { display: 'flex', width: w, height: hgt, borderRadius: hgt / 2, backgroundColor: bg, ...extra });
const box = (w: number | string, hgt: number | string, bg: string, extra: Record<string, unknown> = {}) => h('div', { display: 'flex', width: w, height: hgt, backgroundColor: bg, ...extra });

interface Tpl { width: number; height: number; slotRect: [number, number, number, number]; tree: (p: Record<string, string>) => El }

// ── icon approximations (pure shapes — crisp at UI scale) ──────────────────
const heart = (s: number, color: string) => txt('♥', { fontSize: s, color, lineHeight: 1 });
const bubble = (s: number, color: string) => txt('💬', { fontSize: s, color, lineHeight: 1 });
const share = (s: number, color: string) => txt('➦', { fontSize: s, color, lineHeight: 1 });
const bookmark = (s: number, color: string) => txt('⚑', { fontSize: s, color, lineHeight: 1 });
const play = (s: number, color: string) => txt('▶', { fontSize: s, color, lineHeight: 1 });

const SLOT_BG = '#0a0a0c';

const TEMPLATES: Record<string, Tpl> = {
  // ── Facebook-style desktop feed, 16:9, slot centered ────────────────────
  feed: {
    width: 1920, height: 1080, slotRect: [460, 250, 1000, 562],
    tree: (p) => col({ width: 1920, height: 1080, backgroundColor: '#18191a', color: '#e4e6eb', fontFamily: 'Inter' },
      // top nav
      row({ height: 56, backgroundColor: '#242526', alignItems: 'center', paddingLeft: 16, paddingRight: 16, justifyContent: 'space-between', borderBottom: '1px solid #3a3b3c' },
        row({ alignItems: 'center', gap: 10 }, circle(40, '#2d88ff'), pill(240, 40, '#3a3b3c')),
        row({ gap: 8 }, ...[0, 1, 2].map(() => circle(40, '#3a3b3c'))),
      ),
      row({ flexGrow: 1 },
        // left sidebar
        col({ width: 360, paddingTop: 16, paddingLeft: 16, gap: 14 },
          ...['', '', '', '', '', ''].map(() => row({ alignItems: 'center', gap: 12 }, circle(36, '#3a3b3c'), pill(180, 16, '#3a3b3c')))),
        // center post
        col({ width: 1080, alignItems: 'center', paddingTop: 16 },
          col({ width: 1040, backgroundColor: '#242526', borderRadius: 12, overflow: 'hidden' },
            row({ alignItems: 'center', gap: 10, padding: 14 },
              circle(42, '#5a5b5c'),
              col({ gap: 4 }, txt(p.username ?? 'daily.wander', { fontSize: 16, fontWeight: 700, color: '#e4e6eb' }), txt('3h · 🌐', { fontSize: 12, color: '#b0b3b8' }))),
            txt(p.caption ?? "you ever feel like she's looking AT you…", { fontSize: 16, paddingLeft: 14, paddingBottom: 12, color: '#e4e6eb' }),
            box(1040, 562, SLOT_BG, { marginLeft: 20 }), // ← the video slot (slotRect)
            row({ justifyContent: 'space-between', padding: 12, paddingLeft: 20, paddingRight: 20 },
              row({ gap: 6, alignItems: 'center' }, txt('👍❤️😮', { fontSize: 16 }), txt('12K', { fontSize: 14, color: '#b0b3b8' })),
              txt('842 comments · 3.1K shares', { fontSize: 14, color: '#b0b3b8' })),
            row({ borderTop: '1px solid #3a3b3c', padding: 8, justifyContent: 'space-around' },
              txt('👍 Like', { fontSize: 15, color: '#b0b3b8' }), txt('💬 Comment', { fontSize: 15, color: '#b0b3b8' }), txt('➦ Share', { fontSize: 15, color: '#b0b3b8' })))),
        // right rail
        col({ width: 480, paddingTop: 16, paddingLeft: 24, gap: 16 },
          txt('Sponsored', { fontSize: 15, color: '#b0b3b8', fontWeight: 700 }),
          ...[0, 1].map(() => row({ gap: 12, alignItems: 'center' }, box(120, 120, '#3a3b3c', { borderRadius: 8 }), col({ gap: 8 }, pill(200, 14, '#3a3b3c'), pill(140, 12, '#303132')))),
          txt('Contacts', { fontSize: 15, color: '#b0b3b8', fontWeight: 700 }),
          ...[0, 1, 2, 3].map(() => row({ alignItems: 'center', gap: 12 }, circle(36, '#3a3b3c'), pill(160, 14, '#3a3b3c')))))),
  },

  // ── YouTube-style watch page, 16:9 ───────────────────────────────────────
  youtube: {
    width: 1920, height: 1080, slotRect: [128, 96, 1280, 720],
    tree: (p) => col({ width: 1920, height: 1080, backgroundColor: '#0f0f0f', color: '#f1f1f1', fontFamily: 'Inter' },
      row({ height: 64, alignItems: 'center', paddingLeft: 24, paddingRight: 24, justifyContent: 'space-between' },
        row({ alignItems: 'center', gap: 8 }, box(34, 24, '#ff0000', { borderRadius: 6, alignItems: 'center', justifyContent: 'center' }, play(12, '#fff')), txt('StreamTube', { fontSize: 20, fontWeight: 700 })),
        pill(540, 40, '#121212', { border: '1px solid #303030' }),
        row({ gap: 12, alignItems: 'center' }, circle(34, '#303030'), circle(34, '#8e24aa'))),
      row({ paddingLeft: 128, gap: 24 },
        col({ width: 1280 },
          box(1280, 720, SLOT_BG, { borderRadius: 12 }), // ← slot
          txt(p.title ?? "he knows you're watching…", { fontSize: 22, fontWeight: 700, marginTop: 14 }),
          row({ marginTop: 12, justifyContent: 'space-between', alignItems: 'center' },
            row({ gap: 12, alignItems: 'center' }, circle(44, '#5a5b5c'), col({ gap: 2 }, txt(p.username ?? 'daily.wander', { fontSize: 16, fontWeight: 700 }), txt('1.24M subscribers', { fontSize: 12, color: '#aaaaaa' })), pill(110, 36, '#f1f1f1', { alignItems: 'center', justifyContent: 'center' }, txt('Subscribe', { fontSize: 14, color: '#0f0f0f', fontWeight: 700 }))),
            row({ gap: 8 }, pill(140, 36, '#272727', { alignItems: 'center', justifyContent: 'center' }, txt('👍 128K  |  👎', { fontSize: 13 })), pill(100, 36, '#272727', { alignItems: 'center', justifyContent: 'center' }, txt('➦ Share', { fontSize: 13 })), pill(120, 36, '#272727', { alignItems: 'center', justifyContent: 'center' }, txt('⤓ Download', { fontSize: 13 }))))),
        col({ width: 420, gap: 12, paddingTop: 4 },
          ...[0, 1, 2, 3, 4].map((i) => row({ gap: 8 }, box(168, 94, '#272727', { borderRadius: 8 }), col({ gap: 6, paddingTop: 2 }, pill(200, 14, '#3f3f3f'), pill(150, 12, '#2c2c2c'), txt(['12:41', '8:03', '22:17', '4:56', '17:22'][i], { fontSize: 11, color: '#aaaaaa' }))))))),
  },

  // ── Netflix-style immersive player, 16:9, near-fullscreen slot ──────────
  netflix: {
    width: 1920, height: 1080, slotRect: [0, 0, 1920, 940],
    tree: (p) => col({ width: 1920, height: 1080, backgroundColor: '#000000', color: '#ffffff', fontFamily: 'Inter' },
      box(1920, 940, SLOT_BG), // ← slot (immersive)
      col({ height: 140, paddingLeft: 48, paddingRight: 48, paddingTop: 16, gap: 14, backgroundColor: '#000000' },
        row({ alignItems: 'center', gap: 12 },
          box(1560, 6, '#4d4d4d', { borderRadius: 3 }, box(624, 6, '#e50914', { borderRadius: 3 })),
          circle(14, '#e50914'),
          txt('12:34 / 47:02', { fontSize: 16, color: '#d2d2d2' })),
        row({ justifyContent: 'space-between', alignItems: 'center' },
          row({ gap: 28, alignItems: 'center' }, txt('⏸', { fontSize: 30 }), txt('↺10', { fontSize: 20, color: '#d2d2d2' }), txt('10↻', { fontSize: 20, color: '#d2d2d2' }), txt('🔊', { fontSize: 24 })),
          txt(p.title ?? 'S2:E4 — The Window', { fontSize: 20, fontWeight: 700, color: '#e5e5e5' }),
          row({ gap: 28, alignItems: 'center' }, txt('💬', { fontSize: 22, color: '#d2d2d2' }), txt('1.0×', { fontSize: 18, color: '#d2d2d2' }), txt('🗗', { fontSize: 22, color: '#d2d2d2' }))))),
  },

  // ── TikTok-style vertical, 9:16, full-bleed slot with overlay chrome ─────
  tiktok: {
    width: 1080, height: 1920, slotRect: [0, 120, 1080, 1560],
    tree: (p) => col({ width: 1080, height: 1920, backgroundColor: '#000000', color: '#ffffff', fontFamily: 'Inter' },
      row({ height: 120, alignItems: 'flex-end', justifyContent: 'center', gap: 32, paddingBottom: 12 },
        txt('Following', { fontSize: 26, color: '#bbbbbb' }),
        col({ alignItems: 'center', gap: 6 }, txt('For You', { fontSize: 26, fontWeight: 700 }), box(44, 4, '#ffffff', { borderRadius: 2 }))),
      box(1080, 1560, SLOT_BG), // ← slot
      row({ height: 240, paddingLeft: 28, paddingRight: 20, justifyContent: 'space-between', backgroundColor: '#000000' },
        col({ justifyContent: 'flex-start', paddingTop: 14, gap: 12, width: 800 },
          txt('@' + (p.username ?? 'wanderdaily'), { fontSize: 26, fontWeight: 700 }),
          txt(p.caption ?? 'wait for it… #real #fyp', { fontSize: 22, color: '#e8e8e8' }),
          row({ gap: 8, alignItems: 'center' }, txt('♫', { fontSize: 20 }), txt('original sound — wanderdaily', { fontSize: 20, color: '#dddddd' }))),
        col({ alignItems: 'center', gap: 26, paddingTop: 0, marginTop: -700 },
          col({ alignItems: 'center' }, circle(88, '#5a5b5c', { border: '3px solid #fff' }), circle(36, '#fe2c55', { marginTop: -18, alignItems: 'center', justifyContent: 'center' }, txt('+', { fontSize: 26, fontWeight: 700 }))),
          col({ alignItems: 'center', gap: 4 }, heart(56, '#ffffff'), txt('1.2M', { fontSize: 20, fontWeight: 700 })),
          col({ alignItems: 'center', gap: 4 }, bubble(50, '#ffffff'), txt('24.3K', { fontSize: 20, fontWeight: 700 })),
          col({ alignItems: 'center', gap: 4 }, bookmark(50, '#ffffff'), txt('98K', { fontSize: 20, fontWeight: 700 })),
          col({ alignItems: 'center', gap: 4 }, share(50, '#ffffff'), txt('56K', { fontSize: 20, fontWeight: 700 })),
          circle(80, '#222222', { border: '14px solid #111', marginTop: 6 })))),
  },

  // ── Instagram-style reels, 9:16 ──────────────────────────────────────────
  instagram: {
    width: 1080, height: 1920, slotRect: [0, 100, 1080, 1620],
    tree: (p) => col({ width: 1080, height: 1920, backgroundColor: '#000000', color: '#ffffff', fontFamily: 'Inter' },
      row({ height: 100, alignItems: 'center', justifyContent: 'space-between', paddingLeft: 28, paddingRight: 28 },
        txt('Reels', { fontSize: 30, fontWeight: 700 }), txt('📷', { fontSize: 28 })),
      box(1080, 1620, SLOT_BG), // ← slot
      row({ height: 200, paddingLeft: 28, paddingRight: 20, justifyContent: 'space-between', backgroundColor: '#000000' },
        col({ justifyContent: 'flex-start', paddingTop: 12, gap: 12, width: 800 },
          row({ alignItems: 'center', gap: 12 }, circle(64, '#5a5b5c'), txt(p.username ?? 'city.frames', { fontSize: 24, fontWeight: 700 }), pill(110, 44, 'transparent', { border: '1.5px solid #fff', alignItems: 'center', justifyContent: 'center' }, txt('Follow', { fontSize: 18 }))),
          txt(p.caption ?? 'this felt too real', { fontSize: 22, color: '#e8e8e8' }),
          row({ gap: 8, alignItems: 'center' }, txt('♫', { fontSize: 18 }), txt('city.frames · Original audio', { fontSize: 18, color: '#dddddd' }))),
        col({ alignItems: 'center', gap: 30, marginTop: -560 },
          col({ alignItems: 'center', gap: 4 }, heart(52, '#ffffff'), txt('842K', { fontSize: 18 })),
          col({ alignItems: 'center', gap: 4 }, bubble(46, '#ffffff'), txt('12.1K', { fontSize: 18 })),
          share(46, '#ffffff'),
          txt('⋯', { fontSize: 40 }),
          box(56, 56, '#333333', { borderRadius: 10, border: '2px solid #777' })))),
  },
};

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
