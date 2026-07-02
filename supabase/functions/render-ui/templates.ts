// ═══════════════════════════════════════════════════════════════════════════
// templates.ts — v2 platform layouts for render-ui.
//
// v1 was wireframes (gray pills). Real feeds are full of OTHER PEOPLE'S
// CONTENT: faces, thumbnails, story rings, badges, counts, timestamps. v2
// composes a one-time generated asset pack (effects/ui-assets/*) into dense,
// production-realistic chrome. All logo-free recreations.
// ═══════════════════════════════════════════════════════════════════════════

export type El = { type: string; props: Record<string, unknown> };

function h(type: string, style: Record<string, unknown>, ...children: (El | string | null)[]): El {
  const kids = children.filter(Boolean);
  return { type, props: { style, children: kids.length === 1 ? kids[0] : kids } };
}
const row = (style: Record<string, unknown>, ...c: (El | string | null)[]) => h('div', { display: 'flex', flexDirection: 'row', ...style }, ...c);
const col = (style: Record<string, unknown>, ...c: (El | string | null)[]) => h('div', { display: 'flex', flexDirection: 'column', ...style }, ...c);
const txt = (text: string, style: Record<string, unknown>) => h('div', { display: 'flex', ...style }, text);
const img = (src: string, w: number, hh: number, style: Record<string, unknown> = {}): El =>
  ({ type: 'img', props: { src, width: w, height: hh, style: { objectFit: 'cover', ...style } } });
const box = (w: number | string, hh: number | string, bg: string, style: Record<string, unknown> = {}, ...c: (El | string | null)[]) =>
  h('div', { display: 'flex', width: w, height: hh, backgroundColor: bg, ...style }, ...c);

// Downscaled via Supabase image transforms — full-res sources blow the
// edge worker's memory when satori rasterizes a dozen of them per layout.
const A = (slug: string, w: number) =>
  `https://ywcwaumozoejierlfkgj.supabase.co/storage/v1/render/image/public/video-clips/effects/ui-assets/${slug}.jpg?width=${w}&quality=75`;
const AV = ['av1', 'av2', 'av3', 'av4', 'av5', 'av6', 'av7', 'av8'].map((x) => A(x, 192));
const TH = ['th1', 'th2', 'th3', 'th4', 'th5'].map((x) => A(x, 512));
const ST = ['st1', 'st2'].map((x) => A(x, 384));

const IG_RING = 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)';
const SLOT_BG = '#0a0a0c';
const check = (s: number) => box(s, s, '#1d9bf0', { borderRadius: s / 2, alignItems: 'center', justifyContent: 'center' }, txt('✓', { fontSize: s * 0.6, color: '#fff', fontWeight: 700 }));
const avatar = (src: string, size: number, ring = false): El =>
  ring
    ? h('div', { display: 'flex', padding: 3, borderRadius: (size + 10) / 2, backgroundImage: IG_RING }, h('div', { display: 'flex', padding: 3, borderRadius: (size + 4) / 2, backgroundColor: '#18191a' }, img(src, size, size, { borderRadius: size / 2 })))
    : img(src, size, size, { borderRadius: size / 2 });

export interface Tpl { width: number; height: number; slotRect: [number, number, number, number]; tree: (p: Record<string, string>) => El }

// ─────────────────────────────────────────────────────────────────────────────
function feedTemplate(p: Record<string, string>): El {
  const names = ['mia.torres', 'jshoots', 'sunny.b', 'noahwrites', 'leila.k', 'gregmakes'];
  const nav = row({ height: 58, backgroundColor: '#242526', alignItems: 'center', paddingLeft: 18, paddingRight: 18, justifyContent: 'space-between', borderBottom: '1px solid #3a3b3c' },
    row({ alignItems: 'center', gap: 10 },
      box(42, 42, '#2d88ff', { borderRadius: 21, alignItems: 'center', justifyContent: 'center' }, txt('f', { fontSize: 28, color: '#fff', fontWeight: 700 })),
      h('div', { display: 'flex', width: 260, height: 40, borderRadius: 20, backgroundColor: '#3a3b3c', alignItems: 'center', paddingLeft: 14 }, txt('🔍  Search', { fontSize: 14, color: '#8a8d91' }))),
    row({ gap: 10, alignItems: 'center' },
      ...['🏠', '📺', '🛍', '👥'].map((i) => box(90, 42, 'transparent', { alignItems: 'center', justifyContent: 'center' }, txt(i, { fontSize: 22 }))),
      h('div', { display: 'flex' },
        box(42, 42, '#3a3b3c', { borderRadius: 21, alignItems: 'center', justifyContent: 'center' }, txt('🔔', { fontSize: 18 }))),
      box(24, 24, '#e41e3f', { borderRadius: 12, marginLeft: -16, marginTop: -8, alignItems: 'center', justifyContent: 'center' }, txt('3', { fontSize: 13, color: '#fff', fontWeight: 700 })),
      avatar(AV[1], 42)));

  const sidebarItems: [string, string][] = [['👤', 'Your profile'], ['👥', 'Friends'], ['🕐', 'Memories'], ['🔖', 'Saved'], ['👨‍👩‍👧', 'Groups'], ['🎬', 'Video'], ['🏪', 'Marketplace'], ['📅', 'Events']];
  const sidebar = col({ width: 340, paddingTop: 14, paddingLeft: 14, gap: 4 },
    ...sidebarItems.map(([icon, label]) => row({ alignItems: 'center', gap: 12, padding: 8, borderRadius: 8 }, txt(icon, { fontSize: 20 }), txt(label, { fontSize: 15, color: '#e4e6eb' }))));

  const stories = row({ gap: 10, paddingBottom: 12 },
    col({ width: 118, height: 190, borderRadius: 12, overflow: 'hidden', backgroundColor: '#242526', alignItems: 'center' },
      img(AV[1], 118, 130), box(36, 36, '#2d88ff', { borderRadius: 18, marginTop: -18, border: '4px solid #242526', alignItems: 'center', justifyContent: 'center' }, txt('+', { fontSize: 20, color: '#fff', fontWeight: 700 })), txt('Create story', { fontSize: 12, color: '#e4e6eb', marginTop: 4 })),
    ...[0, 1].map((i) => h('div', { display: 'flex', width: 118, height: 190, borderRadius: 12, overflow: 'hidden', position: 'relative' },
      img(ST[i], 118, 190),
      h('div', { display: 'flex', position: 'absolute', top: 8, left: 8, padding: 3, borderRadius: 22, backgroundImage: IG_RING }, img(AV[i + 2], 34, 34, { borderRadius: 17, border: '2px solid #242526' })))),
    ...[0, 1].map((i) => h('div', { display: 'flex', width: 118, height: 190, borderRadius: 12, overflow: 'hidden', position: 'relative' },
      img(TH[i], 118, 190),
      h('div', { display: 'flex', position: 'absolute', top: 8, left: 8, padding: 3, borderRadius: 22, backgroundImage: IG_RING }, img(AV[i + 4], 34, 34, { borderRadius: 17, border: '2px solid #242526' })))));

  const post = col({ width: 1000, backgroundColor: '#242526', borderRadius: 12, overflow: 'hidden' },
    row({ alignItems: 'center', gap: 10, padding: 14 },
      avatar(AV[0], 44),
      col({ gap: 3 },
        row({ gap: 6, alignItems: 'center' }, txt(p.username ?? 'daily.wander', { fontSize: 16, fontWeight: 700, color: '#e4e6eb' }), check(16)),
        txt('3h · 🌐', { fontSize: 12, color: '#b0b3b8' })),
      txt('⋯', { fontSize: 22, color: '#b0b3b8', marginLeft: 'auto' })),
    txt(p.caption ?? "you ever feel like she's looking AT you… 👁️ wait for the end", { fontSize: 16, paddingLeft: 14, paddingRight: 14, paddingBottom: 12, color: '#e4e6eb' }),
    box(1000, 562, SLOT_BG), // ← slot
    row({ justifyContent: 'space-between', padding: 12, paddingLeft: 16, paddingRight: 16, alignItems: 'center' },
      row({ gap: 6, alignItems: 'center' },
        box(22, 22, '#2d88ff', { borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, txt('👍', { fontSize: 12 })),
        box(22, 22, '#e41e3f', { borderRadius: 11, marginLeft: -8, alignItems: 'center', justifyContent: 'center' }, txt('❤️', { fontSize: 12 })),
        txt('12K', { fontSize: 14, color: '#b0b3b8', marginLeft: 4 })),
      txt('842 comments · 3.1K shares', { fontSize: 14, color: '#b0b3b8' })),
    row({ borderTop: '1px solid #3a3b3c', borderBottom: '1px solid #3a3b3c', padding: 6, justifyContent: 'space-around' },
      txt('👍 Like', { fontSize: 15, color: '#b0b3b8', padding: 6 }), txt('💬 Comment', { fontSize: 15, color: '#b0b3b8', padding: 6 }), txt('↗ Share', { fontSize: 15, color: '#b0b3b8', padding: 6 })),
    col({ padding: 12, gap: 10 },
      row({ gap: 10 }, avatar(AV[3], 32), col({ backgroundColor: '#3a3b3c', borderRadius: 16, padding: 10, gap: 2 }, txt('noahwrites', { fontSize: 13, fontWeight: 700, color: '#e4e6eb' }), txt('nah this is wild 😭😭', { fontSize: 14, color: '#e4e6eb' }))),
      row({ gap: 10 }, avatar(AV[6], 32), col({ backgroundColor: '#3a3b3c', borderRadius: 16, padding: 10, gap: 2 }, txt('pink.pixel', { fontSize: 13, fontWeight: 700, color: '#e4e6eb' }), txt('the way she LOOKS at 0:04 💀', { fontSize: 14, color: '#e4e6eb' })))));

  const rail = col({ width: 380, paddingTop: 14, paddingLeft: 20, gap: 14 },
    txt('Sponsored', { fontSize: 15, color: '#b0b3b8', fontWeight: 700 }),
    row({ gap: 12, alignItems: 'center' }, img(TH[3], 110, 110, { borderRadius: 8 }), col({ gap: 4 }, txt('Build your dream board', { fontSize: 14, color: '#e4e6eb', fontWeight: 700 }), txt('keebshop.co', { fontSize: 12, color: '#b0b3b8' }))),
    row({ gap: 12, alignItems: 'center' }, img(TH[4], 110, 110, { borderRadius: 8 }), col({ gap: 4 }, txt('City photo walks — join us', { fontSize: 14, color: '#e4e6eb', fontWeight: 700 }), txt('walkswith.us', { fontSize: 12, color: '#b0b3b8' }))),
    box(340, 1, '#3a3b3c', {}),
    txt('Contacts', { fontSize: 15, color: '#b0b3b8', fontWeight: 700 }),
    ...[2, 3, 4, 5, 6].map((i) => row({ alignItems: 'center', gap: 12 },
      h('div', { display: 'flex' }, avatar(AV[i], 36)),
      box(10, 10, '#31a24c', { borderRadius: 5, marginLeft: -14, marginTop: 26 }),
      txt(names[i - 2] ?? 'friend', { fontSize: 14, color: '#e4e6eb' }))));

  return col({ width: 1920, height: 1080, backgroundColor: '#18191a', color: '#e4e6eb', fontFamily: 'Inter' },
    nav,
    row({ flexGrow: 1 },
      sidebar,
      col({ width: 1200 - 180, alignItems: 'center', paddingTop: 14, gap: 0 },
        col({ width: 1000 }, stories),
        post),
      rail));
}

// ─────────────────────────────────────────────────────────────────────────────
function youtubeTemplate(p: Record<string, string>): El {
  const recs: [string, string, string, string][] = [
    [TH[0], 'We found the bluest water on earth', 'Wander Duo · 2.1M views · 3 days ago', '12:41'],
    [TH[1], 'Night market noodles at 2am', 'Street Eats · 890K views · 1 week ago', '8:03'],
    [TH[2], 'I slept above the clouds', 'Peak Season · 4.7M views · 2 months ago', '22:17'],
    [TH[3], 'This keyboard costs more than my rent', 'DeskThings · 1.3M views · 5 days ago', '14:56'],
    [TH[4], 'Blue hour hits different', 'CityFrames · 640K views · 2 weeks ago', '7:22'],
  ];
  const chips = row({ gap: 10, marginTop: 14 },
    ...['All', 'Music', 'Live', 'Gaming', 'Podcasts', 'News', 'Comedy'].map((c, i) =>
      h('div', { display: 'flex', paddingLeft: 14, paddingRight: 14, height: 34, borderRadius: 10, backgroundColor: i === 0 ? '#f1f1f1' : '#272727', alignItems: 'center' }, txt(c, { fontSize: 14, color: i === 0 ? '#0f0f0f' : '#f1f1f1', fontWeight: i === 0 ? 700 : 400 }))));

  return col({ width: 1920, height: 1080, backgroundColor: '#0f0f0f', color: '#f1f1f1', fontFamily: 'Inter' },
    row({ height: 60, alignItems: 'center', paddingLeft: 24, paddingRight: 24, justifyContent: 'space-between' },
      row({ alignItems: 'center', gap: 16 }, txt('☰', { fontSize: 22 }), row({ alignItems: 'center', gap: 6 }, box(34, 24, '#ff0000', { borderRadius: 6, alignItems: 'center', justifyContent: 'center' }, txt('▶', { fontSize: 12, color: '#fff' })), txt('StreamTube', { fontSize: 20, fontWeight: 700 }))),
      row({ alignItems: 'center' },
        h('div', { display: 'flex', width: 480, height: 38, borderRadius: '19px 0 0 19px', backgroundColor: '#121212', border: '1px solid #303030', alignItems: 'center', paddingLeft: 16 }, txt('what did she see', { fontSize: 15, color: '#8a8d91' })),
        box(64, 40, '#222222', { borderRadius: '0 19px 19px 0', border: '1px solid #303030', alignItems: 'center', justifyContent: 'center' }, txt('🔍', { fontSize: 16 })),
        box(40, 40, '#181818', { borderRadius: 20, marginLeft: 12, alignItems: 'center', justifyContent: 'center' }, txt('🎤', { fontSize: 16 }))),
      row({ gap: 14, alignItems: 'center' }, txt('📹', { fontSize: 20 }), txt('🔔', { fontSize: 20 }), avatar(AV[1], 34))),
    row({ paddingLeft: 96, gap: 24 },
      col({ width: 1280 },
        box(1280, 720, SLOT_BG, { borderRadius: 12 }), // ← slot
        txt(p.title ?? "he knows you're watching… (don't blink)", { fontSize: 22, fontWeight: 700, marginTop: 14 }),
        row({ marginTop: 10, justifyContent: 'space-between', alignItems: 'center' },
          row({ gap: 12, alignItems: 'center' },
            avatar(AV[1], 44),
            col({ gap: 2 }, row({ gap: 6, alignItems: 'center' }, txt(p.username ?? 'daily.wander', { fontSize: 16, fontWeight: 700 }), check(14)), txt('1.24M subscribers', { fontSize: 12, color: '#aaaaaa' })),
            h('div', { display: 'flex', width: 110, height: 36, borderRadius: 18, backgroundColor: '#f1f1f1', alignItems: 'center', justifyContent: 'center', marginLeft: 12 }, txt('Subscribe', { fontSize: 14, color: '#0f0f0f', fontWeight: 700 }))),
          row({ gap: 8 },
            h('div', { display: 'flex', height: 36, borderRadius: 18, backgroundColor: '#272727', alignItems: 'center', paddingLeft: 16, paddingRight: 16, gap: 8 }, txt('👍 128K', { fontSize: 13 }), box(1, 20, '#3f3f3f', {}), txt('👎', { fontSize: 13 })),
            h('div', { display: 'flex', height: 36, borderRadius: 18, backgroundColor: '#272727', alignItems: 'center', paddingLeft: 16, paddingRight: 16 }, txt('↗ Share', { fontSize: 13 })),
            h('div', { display: 'flex', height: 36, borderRadius: 18, backgroundColor: '#272727', alignItems: 'center', paddingLeft: 16, paddingRight: 16 }, txt('✂ Clip', { fontSize: 13 })),
            h('div', { display: 'flex', height: 36, borderRadius: 18, backgroundColor: '#272727', alignItems: 'center', paddingLeft: 16, paddingRight: 16 }, txt('⋯', { fontSize: 13 })))),
        h('div', { display: 'flex', flexDirection: 'column', backgroundColor: '#272727', borderRadius: 12, padding: 12, marginTop: 12, gap: 4 },
          txt('412,392 views · Jul 1, 2026 · #shortfilm #pov', { fontSize: 13, fontWeight: 700 }),
          txt('filmed this in one take. she was never supposed to notice the camera. turn the sound on.', { fontSize: 13, color: '#d0d0d0' }))),
      col({ width: 460, gap: 12, paddingTop: 2 },
        chips,
        ...recs.map(([t, title, meta, dur]) => row({ gap: 10 },
          h('div', { display: 'flex', position: 'relative' },
            img(t, 190, 106, { borderRadius: 10 }),
            h('div', { display: 'flex', position: 'absolute', right: 6, bottom: 6, backgroundColor: 'rgba(0,0,0,0.85)', borderRadius: 4, paddingLeft: 5, paddingRight: 5 }, txt(dur, { fontSize: 11, color: '#fff', fontWeight: 700 }))),
          col({ gap: 4, width: 250 }, txt(title, { fontSize: 14, fontWeight: 700 }), txt(meta, { fontSize: 12, color: '#aaaaaa' })))))));
}

// ─────────────────────────────────────────────────────────────────────────────
function netflixTemplate(p: Record<string, string>): El {
  return col({ width: 1920, height: 1080, backgroundColor: '#000000', color: '#ffffff', fontFamily: 'Inter' },
    box(1920, 920, SLOT_BG), // ← slot
    col({ height: 160, paddingLeft: 48, paddingRight: 48, paddingTop: 10, gap: 12, backgroundImage: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.95) 40%)' },
      row({ alignItems: 'center', gap: 14 },
        h('div', { display: 'flex', width: 1520, height: 5, borderRadius: 3, backgroundColor: '#4d4d4d' },
          box(608, 5, '#e50914', { borderRadius: 3 })),
        box(16, 16, '#e50914', { borderRadius: 8, marginLeft: -12 }),
        txt('32:11', { fontSize: 15, color: '#d2d2d2' }),
        h('div', { display: 'flex', position: 'absolute', marginLeft: 500, marginTop: -120, flexDirection: 'column', alignItems: 'center', gap: 4 },
          img(TH[2], 224, 126, { borderRadius: 6, border: '2px solid #ffffff' }),
          txt('32:11', { fontSize: 13, color: '#fff', fontWeight: 700 }))),
      row({ justifyContent: 'space-between', alignItems: 'center' },
        row({ gap: 30, alignItems: 'center' }, txt('⏸', { fontSize: 32 }), txt('↺10', { fontSize: 19, color: '#d2d2d2' }), txt('10↻', { fontSize: 19, color: '#d2d2d2' }), txt('🔊', { fontSize: 24 })),
        col({ alignItems: 'center', gap: 2 }, txt(p.title ?? 'The Window', { fontSize: 21, fontWeight: 700, color: '#ffffff' }), txt('S2:E4 — "She Sees You"', { fontSize: 15, color: '#bbbbbb' })),
        row({ gap: 26, alignItems: 'center' }, txt('Next Ep. ⏭', { fontSize: 17, color: '#d2d2d2' }), txt('≡ Episodes', { fontSize: 17, color: '#d2d2d2' }), txt('💬', { fontSize: 20, color: '#d2d2d2' }), txt('1.0×', { fontSize: 17, color: '#d2d2d2' }), txt('⛶', { fontSize: 22, color: '#d2d2d2' })))));
}

// ─────────────────────────────────────────────────────────────────────────────
function tiktokTemplate(p: Record<string, string>): El {
  const railItem = (icon: El, label: string) => col({ alignItems: 'center', gap: 6 }, icon, txt(label, { fontSize: 20, fontWeight: 700, color: '#fff' }));
  return col({ width: 1080, height: 1920, backgroundColor: '#000', color: '#fff', fontFamily: 'Inter' },
    row({ height: 116, alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 12, gap: 34 },
      txt('📡 LIVE', { fontSize: 22, color: '#bbbbbb' }),
      txt('Following', { fontSize: 26, color: '#bbbbbb' }),
      col({ alignItems: 'center', gap: 6 }, txt('For You', { fontSize: 26, fontWeight: 700 }), box(46, 4, '#fff', { borderRadius: 2 })),
      txt('🔍', { fontSize: 26, marginLeft: 60 })),
    h('div', { display: 'flex', position: 'relative', width: 1080, height: 1560 },
      box(1080, 1560, SLOT_BG), // ← slot
      // overlay chrome INSIDE the slot region is drawn over the video later by
      // real apps; here it sits on the still so the composite keeps it visible
      col({ position: 'absolute', right: 18, bottom: 40, alignItems: 'center', gap: 34 },
        col({ alignItems: 'center' },
          avatar(AV[1], 92),
          box(38, 38, '#fe2c55', { borderRadius: 19, marginTop: -19, alignItems: 'center', justifyContent: 'center', border: '3px solid #000' }, txt('+', { fontSize: 26, fontWeight: 700, color: '#fff' }))),
        railItem(txt('♥', { fontSize: 58, color: '#fff' }), '1.2M'),
        railItem(txt('💬', { fontSize: 52 }), '24.3K'),
        railItem(txt('⚑', { fontSize: 50 }), '98K'),
        railItem(txt('➦', { fontSize: 50 }), '56K'),
        h('div', { display: 'flex', padding: 12, borderRadius: 40, backgroundColor: '#1a1a1a', border: '10px solid #111' }, img(ST[1], 56, 56, { borderRadius: 28 }))),
      col({ position: 'absolute', left: 24, bottom: 44, gap: 12, width: 780 },
        row({ gap: 10, alignItems: 'center' }, txt('@' + (p.username ?? 'wanderdaily'), { fontSize: 27, fontWeight: 700 }), check(20)),
        txt(p.caption ?? 'she wasn’t supposed to see the camera… #real #fyp #wait', { fontSize: 22, color: '#f0f0f0' }),
        row({ gap: 10, alignItems: 'center' }, txt('♫', { fontSize: 20 }), txt('original sound — wanderdaily', { fontSize: 20, color: '#e0e0e0' }))),
    ),
    row({ height: 128, alignItems: 'center', justifyContent: 'space-around', paddingLeft: 30, paddingRight: 30, borderTop: '1px solid #1f1f1f' },
      col({ alignItems: 'center', gap: 4 }, txt('⌂', { fontSize: 34 }), txt('Home', { fontSize: 16 })),
      col({ alignItems: 'center', gap: 4 }, txt('🧭', { fontSize: 30, color: '#bbbbbb' }), txt('Discover', { fontSize: 16, color: '#bbbbbb' })),
      h('div', { display: 'flex', width: 84, height: 52, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
        box(30, 30, '#25f4ee', { borderRadius: 6, marginRight: -22 }), box(30, 30, '#fe2c55', { borderRadius: 6, marginLeft: -8 }), txt('+', { fontSize: 30, color: '#000', fontWeight: 700, marginLeft: -26 })),
      col({ alignItems: 'center', gap: 4 }, txt('✉', { fontSize: 30, color: '#bbbbbb' }), txt('Inbox', { fontSize: 16, color: '#bbbbbb' })),
      col({ alignItems: 'center', gap: 4 }, txt('👤', { fontSize: 30, color: '#bbbbbb' }), txt('Profile', { fontSize: 16, color: '#bbbbbb' }))));
}

// ─────────────────────────────────────────────────────────────────────────────
function instagramTemplate(p: Record<string, string>): El {
  return col({ width: 1080, height: 1920, backgroundColor: '#000', color: '#fff', fontFamily: 'Inter' },
    row({ height: 96, alignItems: 'center', justifyContent: 'space-between', paddingLeft: 28, paddingRight: 28 },
      txt('Reels', { fontSize: 30, fontWeight: 700 }), txt('📷', { fontSize: 28 })),
    h('div', { display: 'flex', position: 'relative', width: 1080, height: 1640 },
      box(1080, 1640, SLOT_BG), // ← slot
      col({ position: 'absolute', right: 18, bottom: 36, alignItems: 'center', gap: 34 },
        col({ alignItems: 'center', gap: 4 }, txt('♥', { fontSize: 54 }), txt('842K', { fontSize: 19, fontWeight: 700 })),
        col({ alignItems: 'center', gap: 4 }, txt('💬', { fontSize: 48 }), txt('12.1K', { fontSize: 19, fontWeight: 700 })),
        txt('➦', { fontSize: 48 }),
        txt('⋯', { fontSize: 42 }),
        img(ST[1], 58, 58, { borderRadius: 12, border: '2px solid #888' })),
      col({ position: 'absolute', left: 26, bottom: 40, gap: 14, width: 800 },
        row({ alignItems: 'center', gap: 12 },
          avatar(AV[6], 64, true),
          row({ gap: 6, alignItems: 'center' }, txt(p.username ?? 'city.frames', { fontSize: 24, fontWeight: 700 }), check(18)),
          h('div', { display: 'flex', paddingLeft: 18, paddingRight: 18, height: 46, borderRadius: 10, border: '1.5px solid #fff', alignItems: 'center' }, txt('Follow', { fontSize: 19 }))),
        txt(p.caption ?? 'this felt too real 😳 tag someone who watches like this', { fontSize: 22, color: '#eeeeee' }),
        row({ gap: 10, alignItems: 'center' },
          txt('♫', { fontSize: 18 }),
          txt('city.frames · Original audio', { fontSize: 18, color: '#dddddd' }),
          h('div', { display: 'flex', paddingLeft: 10, paddingRight: 10, height: 32, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', gap: 6 }, avatar(AV[0], 20), txt('👀 2,481 watching', { fontSize: 15 })))),
    ),
    row({ height: 118, alignItems: 'center', justifyContent: 'space-around', borderTop: '1px solid #1f1f1f' },
      txt('⌂', { fontSize: 34 }), txt('🔍', { fontSize: 30, color: '#bbb' }),
      h('div', { display: 'flex', width: 52, height: 52, borderRadius: 14, border: '2.5px solid #fff', alignItems: 'center', justifyContent: 'center' }, txt('+', { fontSize: 30 })),
      txt('▶', { fontSize: 28, color: '#bbb' }), avatar(AV[1], 40)));
}

export const TEMPLATES: Record<string, Tpl> = {
  feed:      { width: 1920, height: 1080, slotRect: [530, 372, 1000, 562], tree: feedTemplate },
  youtube:   { width: 1920, height: 1080, slotRect: [96, 60, 1280, 720], tree: youtubeTemplate },
  netflix:   { width: 1920, height: 1080, slotRect: [0, 0, 1920, 920], tree: netflixTemplate },
  tiktok:    { width: 1080, height: 1920, slotRect: [0, 116, 1080, 1560], tree: tiktokTemplate },
  instagram: { width: 1080, height: 1920, slotRect: [0, 96, 1080, 1640], tree: instagramTemplate },
};
