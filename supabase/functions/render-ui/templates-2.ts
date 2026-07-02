// ═══════════════════════════════════════════════════════════════════════════
// templates-2.ts — v3 layouts: YouTube (post-Oct-2025 mobile redesign +
// desktop watch page) and Netflix (desktop web player + mobile landscape),
// plus the assembled TEMPLATES registry with back-compat aliases.
// ═══════════════════════════════════════════════════════════════════════════

import { h, row, col, txt, img, box, icon, statusBar, AV, TH, type El } from './ui-kit.ts';
import { facebookMobile, facebookDesktop, instagramMobile, instagramReels, tiktokMobile, tiktokDesktop, type Tpl } from './templates.ts';

const SLOT = '#0a0a0c';

// ═════════════════════════════ YOUTUBE ══════════════════════════════════════
// Dark theme (#0F0F0F). Oct-2025 mobile: avatar left of title, icon-only pills.

function youtubeMobile(p: Record<string, string>): El {
  const SEC = '#AAAAAA', CHIP = 'rgba(255,255,255,0.1)';
  const pill = (c: (El | string | null)[], extra: Record<string, unknown> = {}) =>
    h('div', { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 12, height: 72, borderRadius: 36, backgroundColor: CHIP, paddingLeft: 26, paddingRight: 26, ...extra }, ...c);

  const titleRow = row({ gap: 18, padding: 20, alignItems: 'flex-start' },
    img(AV[1], 72, 72, { borderRadius: 36 }),
    col({ gap: 8 },
      txt(p.title ?? "he knows you're watching… (don't blink)", { fontSize: 32, fontWeight: 700, color: '#F1F1F1' }),
      txt('412K views · 2 days ago · ...more', { fontSize: 24, color: SEC })));

  const actionRow = row({ gap: 16, paddingLeft: 24, paddingRight: 24, alignItems: 'center' },
    pill([icon('thumbUp', 34, '#F1F1F1'), txt('128K', { fontSize: 26, fontWeight: 600, color: '#F1F1F1' }), box(2, 40, 'rgba(255,255,255,0.2)', { marginLeft: 8, marginRight: 8 }), icon('thumbDown', 34, '#F1F1F1')]),
    pill([icon('shareArrow', 34, '#F1F1F1')]),
    pill([icon('repost', 34, '#F1F1F1')]),
    pill([icon('download', 34, '#F1F1F1')]),
    pill([icon('more', 34, '#F1F1F1')]));

  const channelRow = row({ gap: 16, paddingLeft: 24, paddingRight: 24, paddingTop: 14, paddingBottom: 14, alignItems: 'center' },
    txt(p.username ?? '@daily.wander', { fontSize: 28, fontWeight: 700, color: '#F1F1F1' }),
    txt('1.24M', { fontSize: 24, color: SEC }),
    h('div', { display: 'flex', marginLeft: 'auto', height: 66, borderRadius: 33, backgroundColor: '#F1F1F1', alignItems: 'center', paddingLeft: 30, paddingRight: 30 },
      txt('Subscribe', { fontSize: 26, fontWeight: 700, color: '#0F0F0F' })));

  const comments = col({ marginLeft: 24, marginRight: 24, borderRadius: 24, backgroundColor: CHIP, padding: 22, gap: 14 },
    row({ gap: 14, alignItems: 'center' }, txt('Comments', { fontSize: 26, fontWeight: 700, color: '#F1F1F1' }), txt('4.1K', { fontSize: 24, color: SEC })),
    row({ gap: 14, alignItems: 'flex-start' },
      img(AV[3], 48, 48, { borderRadius: 24 }),
      txt('the way she looks at the camera at 0:04 is genuinely unsettling', { fontSize: 24, color: '#F1F1F1' })));

  const chip = (label: string, active: boolean) => h('div', { display: 'flex', height: 60, borderRadius: 16, backgroundColor: active ? '#F1F1F1' : CHIP, alignItems: 'center', paddingLeft: 22, paddingRight: 22 },
    txt(label, { fontSize: 24, fontWeight: active ? 700 : 400, color: active ? '#0F0F0F' : '#F1F1F1' }));
  const chips = row({ gap: 14, paddingLeft: 24, paddingTop: 14, paddingBottom: 4 }, chip('All', true), chip('Related', false), chip('From daily.wander', false));

  const rec = (image: string, dur: string, title: string, meta: string) => row({ gap: 16, paddingLeft: 24, paddingRight: 24, paddingTop: 14 },
    h('div', { display: 'flex', position: 'relative' },
      img(image, 320, 180, { borderRadius: 20 }),
      h('div', { display: 'flex', position: 'absolute', right: 10, bottom: 10, backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: 8, paddingLeft: 10, paddingRight: 10, paddingTop: 3, paddingBottom: 3 }, txt(dur, { fontSize: 20, fontWeight: 700, color: '#fff' }))),
    col({ gap: 8, width: 640, paddingTop: 4 },
      txt(title, { fontSize: 26, fontWeight: 600, color: '#F1F1F1' }),
      txt(meta, { fontSize: 22, color: SEC })));

  const navItem = (ic: string, label: string, active: boolean) => col({ alignItems: 'center', gap: 6 },
    icon(ic, 42, active ? '#F1F1F1' : SEC, { fill: active }),
    txt(label, { fontSize: 19, color: active ? '#F1F1F1' : SEC }));
  const bottomNav = row({ height: 126, backgroundColor: '#0F0F0F', borderTop: '1px solid rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'space-around' },
    navItem('home', 'Home', true), navItem('bolt', 'Shorts', false),
    box(70, 70, 'transparent', { borderRadius: 35, border: '2px solid rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' }, icon('plus', 36, '#F1F1F1')),
    navItem('film', 'Subscriptions', false), navItem('user', 'You', false));

  return col({ width: 1080, height: 1920, backgroundColor: '#0F0F0F', fontFamily: 'Inter' },
    box(1080, 66, '#000', {}, statusBar(true)),
    box(1080, 608, SLOT), // ← slot y=66
    titleRow, actionRow, channelRow,
    h('div', { display: 'flex', paddingTop: 20 }, comments),
    chips,
    rec(TH[0], '12:41', 'We found the bluest water on earth', 'Wander Duo · 2.1M views · 3 days ago'),
    rec(TH[2], '22:17', 'I slept above the clouds', 'Peak Season · 4.7M views · 2 months ago'),
    rec(TH[1], '8:03', 'Night market noodles at 2am', 'Street Eats · 890K views · 1 week ago'),
    h('div', { display: 'flex', flexGrow: 1 }),
    bottomNav);
}

function youtubeDesktop(p: Record<string, string>): El {
  const SEC = '#AAAAAA', CHIP = 'rgba(255,255,255,0.1)';
  const mast = row({ height: 56, alignItems: 'center', justifyContent: 'space-between', paddingLeft: 24, paddingRight: 24 },
    row({ gap: 18, alignItems: 'center' },
      icon('menu', 24, '#F1F1F1'),
      row({ gap: 6, alignItems: 'center' },
        box(34, 24, '#FF0000', { borderRadius: 7, alignItems: 'center', justifyContent: 'center' }, icon('play', 13, '#fff', { fill: true })),
        txt('StreamTube', { fontSize: 20, fontWeight: 700, color: '#F1F1F1', letterSpacing: -1 }))),
    row({ alignItems: 'center' },
      h('div', { display: 'flex', width: 480, height: 40, borderRadius: '20px 0 0 20px', backgroundColor: '#121212', border: '1px solid #303030', alignItems: 'center', paddingLeft: 16 }, txt('what did she see', { fontSize: 15, color: '#888' })),
      box(64, 42, '#222', { borderRadius: '0 20px 20px 0', border: '1px solid #303030', alignItems: 'center', justifyContent: 'center' }, icon('search', 18, '#F1F1F1')),
      box(40, 40, CHIP, { borderRadius: 20, marginLeft: 12, alignItems: 'center', justifyContent: 'center' }, icon('mic', 18, '#F1F1F1'))),
    row({ gap: 12, alignItems: 'center' },
      h('div', { display: 'flex', height: 36, borderRadius: 18, backgroundColor: CHIP, alignItems: 'center', paddingLeft: 14, paddingRight: 14, gap: 6 }, icon('plus', 18, '#F1F1F1'), txt('Create', { fontSize: 14, fontWeight: 600, color: '#F1F1F1' })),
      h('div', { display: 'flex', position: 'relative' },
        icon('bell', 24, '#F1F1F1'),
        box(18, 18, '#F03', { position: 'absolute', top: -6, right: -8, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }, txt('9+', { fontSize: 10, color: '#fff', fontWeight: 700 }))),
      img(AV[1], 32, 32, { borderRadius: 16 })));

  const actionPill = (c: (El | string | null)[]) => h('div', { display: 'flex', flexDirection: 'row', height: 36, borderRadius: 18, backgroundColor: CHIP, alignItems: 'center', paddingLeft: 16, paddingRight: 16, gap: 8 }, ...c);
  const channelRow = row({ marginTop: 12, justifyContent: 'space-between', alignItems: 'center' },
    row({ gap: 12, alignItems: 'center' },
      img(AV[1], 40, 40, { borderRadius: 20 }),
      col({ gap: 2 },
        row({ gap: 6, alignItems: 'center' }, txt(p.username ?? 'daily.wander', { fontSize: 16, fontWeight: 700, color: '#F1F1F1' }), box(14, 14, SEC, { borderRadius: 7, alignItems: 'center', justifyContent: 'center' }, icon('play', 7, '#0F0F0F', { fill: true }))),
        txt('1.24M subscribers', { fontSize: 12, color: SEC })),
      h('div', { display: 'flex', height: 36, borderRadius: 18, backgroundColor: '#F1F1F1', alignItems: 'center', paddingLeft: 18, paddingRight: 18, marginLeft: 14 }, txt('Subscribe', { fontSize: 14, fontWeight: 700, color: '#0F0F0F' }))),
    row({ gap: 8 },
      actionPill([icon('thumbUp', 20, '#F1F1F1'), txt('128K', { fontSize: 14, fontWeight: 600, color: '#F1F1F1' }), box(1, 22, 'rgba(255,255,255,0.2)', { marginLeft: 6, marginRight: 2 }), icon('thumbDown', 20, '#F1F1F1')]),
      actionPill([icon('shareArrow', 20, '#F1F1F1'), txt('Share', { fontSize: 14, fontWeight: 600, color: '#F1F1F1' })]),
      actionPill([icon('download', 20, '#F1F1F1'), txt('Download', { fontSize: 14, fontWeight: 600, color: '#F1F1F1' })]),
      actionPill([icon('more', 20, '#F1F1F1')])));

  const description = col({ marginTop: 14, borderRadius: 12, backgroundColor: CHIP, padding: 12, gap: 6 },
    txt('412,392 views  Jul 1, 2026  #shortfilm #pov', { fontSize: 14, fontWeight: 700, color: '#F1F1F1' }),
    txt('filmed in one take. she was never supposed to notice the camera. turn the sound on. ...more', { fontSize: 14, color: '#D0D0D0' }));

  const chip = (label: string, active: boolean) => h('div', { display: 'flex', height: 32, borderRadius: 8, backgroundColor: active ? '#F1F1F1' : CHIP, alignItems: 'center', paddingLeft: 12, paddingRight: 12 },
    txt(label, { fontSize: 13, fontWeight: active ? 700 : 400, color: active ? '#0F0F0F' : '#F1F1F1' }));
  const rec = (image: string, dur: string, title: string, ch: string, meta: string) => row({ gap: 8 },
    h('div', { display: 'flex', position: 'relative' },
      img(image, 168, 94, { borderRadius: 8 }),
      h('div', { display: 'flex', position: 'absolute', right: 5, bottom: 5, backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: 4, paddingLeft: 5, paddingRight: 5 }, txt(dur, { fontSize: 11, fontWeight: 700, color: '#fff' }))),
    col({ gap: 4, width: 216, paddingTop: 2 },
      txt(title, { fontSize: 14, fontWeight: 600, color: '#F1F1F1' }),
      txt(ch, { fontSize: 12, color: SEC }),
      txt(meta, { fontSize: 12, color: SEC })));
  const rail = col({ width: 402, gap: 12 },
    row({ gap: 8 }, chip('All', true), chip('Related', false), chip('From daily.wander', false), chip('Recently uploaded', false)),
    rec(TH[0], '12:41', 'We found the bluest water on earth', 'Wander Duo', '2.1M views · 3 days ago'),
    rec(TH[1], '8:03', 'Night market noodles at 2am', 'Street Eats', '890K views · 1 week ago'),
    rec(TH[2], '22:17', 'I slept above the clouds', 'Peak Season', '4.7M views · 2 months ago'),
    rec(TH[3], '14:56', 'This keyboard costs more than my rent', 'DeskThings', '1.3M views · 5 days ago'),
    rec(TH[4], '7:22', 'Blue hour hits different', 'CityFrames', '640K views · 2 weeks ago'));

  return col({ width: 1920, height: 1080, backgroundColor: '#0F0F0F', fontFamily: 'Inter' },
    mast,
    row({ paddingLeft: 24, gap: 24, paddingTop: 8 },
      col({ width: 1280 },
        box(1280, 720, SLOT, { borderRadius: 12 }), // ← slot
        txt(p.title ?? "he knows you're watching… (don't blink)", { fontSize: 20, fontWeight: 700, color: '#F1F1F1', marginTop: 14 }),
        channelRow, description),
      rail));
}

// ═════════════════════════════ NETFLIX ══════════════════════════════════════
// CHROME over full-frame video. Red #E50914; thin-stroke white icons; no title
// at top — title centered IN the control row; time remaining at scrub right.

function netflixDesktop(p: Record<string, string>): El {
  const scrub = row({ alignItems: 'center', gap: 16, paddingLeft: 28, paddingRight: 28 },
    h('div', { display: 'flex', flexDirection: 'row', flexGrow: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center' },
      box('40%', 6, '#E50914', { borderRadius: 3 }),
      box(20, 20, '#E50914', { borderRadius: 10, marginLeft: -10 }),
      box('12%', 6, 'rgba(255,255,255,0.5)', { borderRadius: 3 })),
    txt('32:11', { fontSize: 24, color: '#fff' }));
  const controls = row({ alignItems: 'center', justifyContent: 'space-between', paddingLeft: 28, paddingRight: 28, paddingTop: 22 },
    row({ gap: 38, alignItems: 'center' },
      icon('pause', 44, '#fff'),
      icon('back10', 38, '#fff'),
      icon('fwd10', 38, '#fff'),
      icon('volume', 38, '#fff')),
    row({ gap: 10, alignItems: 'center' },
      txt(p.title ?? 'The Window', { fontSize: 26, fontWeight: 700, color: '#fff' }),
      txt('E4  "She Sees You"', { fontSize: 24, color: '#d2d2d2' })),
    row({ gap: 38, alignItems: 'center' },
      icon('skip', 38, '#fff'),
      icon('list', 38, '#fff'),
      icon('subtitles', 38, '#fff'),
      icon('gauge', 38, '#fff'),
      icon('maximize', 38, '#fff')));
  return col({ width: 1920, height: 1080, fontFamily: 'Inter' },
    h('div', { display: 'flex', width: 1920, height: 170, backgroundImage: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)', alignItems: 'flex-start', justifyContent: 'space-between', paddingLeft: 28, paddingRight: 28, paddingTop: 24 },
      icon('arrowLeft', 44, '#fff'),
      icon('flag', 38, '#fff')),
    h('div', { display: 'flex', flexGrow: 1 }),
    col({ width: 1920, height: 220, backgroundImage: 'linear-gradient(0deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)', justifyContent: 'flex-end', paddingBottom: 30 },
      scrub, controls));
}

function netflixMobile(p: Record<string, string>): El {
  // Landscape phone player (16:9) — chrome over video.
  const bottomBtn = (ic: string, label: string) => row({ gap: 10, alignItems: 'center' }, icon(ic, 30, '#fff'), txt(label, { fontSize: 22, fontWeight: 600, color: '#fff' }));
  const scrub = row({ alignItems: 'center', gap: 16, paddingLeft: 40, paddingRight: 40 },
    h('div', { display: 'flex', flexDirection: 'row', flexGrow: 1, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center' },
      box('35%', 5, '#E50914', { borderRadius: 3 }),
      box(18, 18, '#E50914', { borderRadius: 9, marginLeft: -9 })),
    txt('47:12', { fontSize: 22, color: '#fff' }));
  return col({ width: 1920, height: 1080, fontFamily: 'Inter' },
    h('div', { display: 'flex', width: 1920, height: 150, backgroundImage: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 40, paddingRight: 40, paddingTop: 18 },
      icon('arrowLeft', 40, '#fff'),
      row({ gap: 8, alignItems: 'center' },
        txt(p.title ?? 'The Window', { fontSize: 24, fontWeight: 700, color: '#fff' }),
        txt('E4  "She Sees You"', { fontSize: 22, color: '#d2d2d2' })),
      row({ gap: 28, alignItems: 'center' }, icon('cast', 34, '#fff'), icon('lock', 34, '#fff'))),
    h('div', { display: 'flex', flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 200, position: 'relative' },
      col({ position: 'absolute', left: 40, alignItems: 'center', gap: 10 },
        icon('sun', 30, '#fff'),
        box(6, 200, 'rgba(255,255,255,0.35)', { borderRadius: 3 }, box(6, 120, '#fff', { borderRadius: 3, marginTop: 80 }))),
      icon('back10', 68, '#fff'),
      icon('play', 96, '#fff', { fill: true }),
      icon('fwd10', 68, '#fff')),
    col({ width: 1920, height: 190, backgroundImage: 'linear-gradient(0deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)', justifyContent: 'flex-end', paddingBottom: 26, gap: 24 },
      scrub,
      row({ justifyContent: 'space-between', paddingLeft: 40, paddingRight: 40 },
        bottomBtn('gauge', 'Speed (1x)'),
        bottomBtn('list', 'Episodes'),
        bottomBtn('subtitles', 'Audio & Subtitles'),
        bottomBtn('skip', 'Next Ep.'))));
}

// ═════════════════════════════ REGISTRY ═════════════════════════════════════

export const TEMPLATES: Record<string, Tpl> = {
  'facebook-mobile':  { width: 1080, height: 1920, slotRect: [0, 908, 1080, 560], mode: 'slot', tree: facebookMobile },
  'facebook-desktop': { width: 1920, height: 1080, slotRect: [710, 462, 500, 281], mode: 'slot', tree: facebookDesktop },
  'instagram-mobile': { width: 1080, height: 1920, slotRect: [0, 492, 1080, 1080], mode: 'slot', tree: instagramMobile },
  'instagram-reels':  { width: 1080, height: 1920, slotRect: [0, 0, 1080, 1920], mode: 'chrome', tree: instagramReels },
  'tiktok-mobile':    { width: 1080, height: 1920, slotRect: [0, 0, 1080, 1920], mode: 'chrome', tree: tiktokMobile },
  'tiktok-desktop':   { width: 1920, height: 1080, slotRect: [750, 24, 580, 1032], mode: 'slot', tree: tiktokDesktop },
  'youtube-mobile':   { width: 1080, height: 1920, slotRect: [0, 66, 1080, 608], mode: 'slot', tree: youtubeMobile },
  'youtube-desktop':  { width: 1920, height: 1080, slotRect: [24, 64, 1280, 720], mode: 'slot', tree: youtubeDesktop },
  'netflix-desktop':  { width: 1920, height: 1080, slotRect: [0, 0, 1920, 1080], mode: 'chrome', tree: netflixDesktop },
  'netflix-mobile':   { width: 1920, height: 1080, slotRect: [0, 0, 1920, 1080], mode: 'chrome', tree: netflixMobile },
  // Back-compat aliases (v2 recipe plans reference these)
  'feed':      { width: 1920, height: 1080, slotRect: [710, 462, 500, 281], mode: 'slot', tree: facebookDesktop },
  'youtube':   { width: 1920, height: 1080, slotRect: [24, 64, 1280, 720], mode: 'slot', tree: youtubeDesktop },
  'netflix':   { width: 1920, height: 1080, slotRect: [0, 0, 1920, 1080], mode: 'chrome', tree: netflixDesktop },
  'tiktok':    { width: 1080, height: 1920, slotRect: [0, 0, 1080, 1920], mode: 'chrome', tree: tiktokMobile },
  'instagram': { width: 1080, height: 1920, slotRect: [0, 0, 1080, 1920], mode: 'chrome', tree: instagramReels },
};
