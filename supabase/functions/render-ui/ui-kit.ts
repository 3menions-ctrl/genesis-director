// ═══════════════════════════════════════════════════════════════════════════
// ui-kit.ts — shared primitives for the v3 platform templates.
//
// Icons are inline SVG data-URIs (feather-style 24×24 paths) — text fonts
// carry no emoji/symbol glyphs in the edge runtime, so every icon is drawn
// as real vector art. Layout helpers build satori object trees.
// ═══════════════════════════════════════════════════════════════════════════

export type El = { type: string; props: Record<string, unknown> };

export function h(type: string, style: Record<string, unknown>, ...children: (El | string | null)[]): El {
  const kids = children.filter(Boolean);
  return { type, props: { style, children: kids.length === 1 ? kids[0] : kids } };
}
export const row = (style: Record<string, unknown>, ...c: (El | string | null)[]) => h('div', { display: 'flex', flexDirection: 'row', ...style }, ...c);
export const col = (style: Record<string, unknown>, ...c: (El | string | null)[]) => h('div', { display: 'flex', flexDirection: 'column', ...style }, ...c);
export const txt = (text: string, style: Record<string, unknown>) => h('div', { display: 'flex', ...style }, text);
export const img = (src: string, w: number, hh: number, style: Record<string, unknown> = {}): El =>
  ({ type: 'img', props: { src, width: w, height: hh, style: { objectFit: 'cover', ...style } } });
export const box = (w: number | string, hh: number | string, bg: string, style: Record<string, unknown> = {}, ...c: (El | string | null)[]) =>
  h('div', { display: 'flex', width: w, height: hh, backgroundColor: bg, ...style }, ...c);

// ── asset pack (downscaled via storage transforms) ──────────────────────────
const A = (slug: string, w: number) =>
  `https://ywcwaumozoejierlfkgj.supabase.co/storage/v1/render/image/public/video-clips/effects/ui-assets/${slug}.jpg?width=${w}&quality=75`;
export const AV = ['av1', 'av2', 'av3', 'av4', 'av5', 'av6', 'av7', 'av8'].map((x) => A(x, 192));
export const TH = ['th1', 'th2', 'th3', 'th4', 'th5'].map((x) => A(x, 512));
export const ST = ['st1', 'st2'].map((x) => A(x, 384));

// ── vector icon set ──────────────────────────────────────────────────────────
const PATHS: Record<string, string> = {
  heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
  comment: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
  send: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>',
  bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  shareArrow: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>',
  home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  play: '<path d="M8 5v14l11-7z"/>',
  thumbUp: '<path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>',
  thumbDown: '<path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>',
  more: '<circle cx="12" cy="12" r="1.6" fill="currentcolor"/><circle cx="19" cy="12" r="1.6" fill="currentcolor"/><circle cx="5" cy="12" r="1.6" fill="currentcolor"/>',
  volume: '<path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>',
  maximize: '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/>',
  cast: '<path d="M2 16.1A5 5 0 0 1 5.9 20"/><path d="M2 12.05A9 9 0 0 1 9.95 20"/><path d="M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-7"/><circle cx="2" cy="20" r="1" fill="currentcolor"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  sun: '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>',
  back10: '<path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
  fwd10: '<path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  menu: '<path d="M3 12h18M3 6h18M3 18h18"/>',
  grid: '<circle cx="5" cy="5" r="1.8" fill="currentcolor"/><circle cx="12" cy="5" r="1.8" fill="currentcolor"/><circle cx="19" cy="5" r="1.8" fill="currentcolor"/><circle cx="5" cy="12" r="1.8" fill="currentcolor"/><circle cx="12" cy="12" r="1.8" fill="currentcolor"/><circle cx="19" cy="12" r="1.8" fill="currentcolor"/><circle cx="5" cy="19" r="1.8" fill="currentcolor"/><circle cx="12" cy="19" r="1.8" fill="currentcolor"/><circle cx="19" cy="19" r="1.8" fill="currentcolor"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
  shop: '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  compass: '<circle cx="12" cy="12" r="10"/><path d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z"/>',
  repost: '<path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  mic: '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v4"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  film: '<rect x="2" y="2" width="20" height="20" rx="2.18"/><path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5"/>',
  chevronDown: '<path d="M6 9l6 6 6-6"/>',
  chevronUp: '<path d="M18 15l-6-6-6 6"/>',
  arrowLeft: '<path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1" fill="currentcolor" stroke="none"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentcolor" stroke="none"/>',
  skip: '<path d="M5 4l10 8-10 8z" fill="currentcolor" stroke="none"/><rect x="17" y="4" width="3" height="16" rx="1" fill="currentcolor" stroke="none"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
  subtitles: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M7 9h4M13 9h4M7 13h2M11 13h6"/>',
  gauge: '<circle cx="12" cy="12" r="10"/><path d="M12 12l4-4"/>',
  wifi: '<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="19" r="1.5" fill="currentcolor" stroke="none"/>',
  battery: '<rect x="1" y="7" width="18" height="10" rx="2"/><rect x="3" y="9" width="12" height="6" rx="1" fill="currentcolor" stroke="none"/><path d="M23 11v2"/>',
  signal: '<rect x="2" y="14" width="3" height="6" rx="0.8" fill="currentcolor" stroke="none"/><rect x="7" y="11" width="3" height="9" rx="0.8" fill="currentcolor" stroke="none"/><rect x="12" y="8" width="3" height="12" rx="0.8" fill="currentcolor" stroke="none"/><rect x="17" y="5" width="3" height="15" rx="0.8" fill="currentcolor" stroke="none"/>',
  messenger: '<path d="M12 2C6.5 2 2 6.14 2 11.25c0 2.88 1.42 5.45 3.65 7.15V22l3.34-1.84c.95.27 1.96.41 3.01.41 5.5 0 10-4.14 10-9.25S17.5 2 12 2z"/><path d="M6.5 14l3.5-4 2.5 2 4.5-4-3.5 4-2.5-2z" fill="currentcolor" stroke="none"/>',
  bolt: '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  tv: '<rect x="2" y="7" width="20" height="15" rx="2"/><path d="M17 2l-5 5-5-5"/>',
};

/** Vector icon as an <img> data-URI. mode 'stroke' (default) or 'fill'. */
export function icon(name: keyof typeof PATHS | string, size: number, color: string, opts: { fill?: boolean; strokeWidth?: number } = {}): El {
  const body = PATHS[name as string] ?? PATHS.more;
  const sw = opts.strokeWidth ?? 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${opts.fill ? color : 'none'}" stroke="${opts.fill ? 'none' : color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" color="${color}">${body.replaceAll('currentcolor', color)}</svg>`;
  return { type: 'img', props: { src: `data:image/svg+xml,${encodeURIComponent(svg)}`, width: size, height: size, style: {} } };
}

/** iOS-style status bar (h=66 at 1080-wide scale). */
export function statusBar(dark: boolean, w = 1080): El {
  const c = dark ? '#ffffff' : '#050505';
  return row({ width: w, height: 66, alignItems: 'center', justifyContent: 'space-between', paddingLeft: 54, paddingRight: 40 },
    txt('9:41', { fontSize: 30, fontWeight: 700, color: c }),
    row({ gap: 12, alignItems: 'center' }, icon('signal', 30, c), icon('wifi', 30, c), icon('battery', 34, c)));
}

export const IG_RING = 'linear-gradient(45deg, #FEDA75 0%, #FA7E1E 25%, #D62976 50%, #962FBF 75%, #4F5BD5 100%)';

export function ringAvatar(src: string, size: number, ringWidth = 5, gap = 4, bg = '#ffffff', ring = IG_RING): El {
  return h('div', { display: 'flex', padding: ringWidth, borderRadius: (size + 2 * (ringWidth + gap)) / 2, backgroundImage: ring },
    h('div', { display: 'flex', padding: gap, borderRadius: (size + 2 * gap) / 2, backgroundColor: bg },
      img(src, size, size, { borderRadius: size / 2 })));
}
