// ═══════════════════════════════════════════════════════════════════════════
// templates.ts — v3 platform layouts, designed from researched anatomy
// (5 parallel research agents, 2026-07-02: exact hexes, element order, px).
//
// mode 'slot'   → UI still with a dark video slot; compositor scales the video
//                 INTO slotRect (feed-style players).
// mode 'chrome' → transparent-background UI rendered OVER the full-bleed
//                 video (TikTok / Reels / Netflix players).
// All layouts are logo-free recreations. Icons = vector SVG (ui-kit).
// ═══════════════════════════════════════════════════════════════════════════

import { h, row, col, txt, img, box, icon, statusBar, ringAvatar, AV, TH, ST, FUN, type El } from './ui-kit.ts';

const SLOT = '#0a0a0c';

export interface Tpl {
  width: number; height: number;
  slotRect: [number, number, number, number];
  mode: 'slot' | 'chrome';
  tree: (p: Record<string, string>) => El;
}

// ═════════════════════════════ FACEBOOK ═════════════════════════════════════
// Light default; brand blue #0866FF (2023+ rebrand); white cards on #F0F2F5.

function facebookMobile(p: Record<string, string>): El {
  const BLUE = '#0866FF', SEC = '#65676B', TXTC = '#050505';
  const chip = (name: string) => box(76, 76, '#E4E6EB', { borderRadius: 38, alignItems: 'center', justifyContent: 'center' }, icon(name, 40, TXTC));

  const header = row({ height: 104, alignItems: 'center', justifyContent: 'space-between', paddingLeft: 28, paddingRight: 24, backgroundColor: '#fff' },
    txt('facebook', { fontSize: 54, fontWeight: 700, color: BLUE, letterSpacing: -2 }),
    row({ gap: 16 }, chip('plus'), chip('search'), chip('messenger')));

  const composer = row({ height: 108, alignItems: 'center', gap: 18, paddingLeft: 24, paddingRight: 24, backgroundColor: '#fff', borderBottom: '1px solid #CED0D4' },
    img(AV[1], 68, 68, { borderRadius: 34 }),
    txt("What's on your mind?", { fontSize: 30, color: SEC, flexGrow: 1 }),
    icon('camera', 44, '#45BD62'));

  const storyCard = (image: string, av: string, name: string) =>
    h('div', { display: 'flex', width: 218, height: 372, borderRadius: 24, overflow: 'hidden', position: 'relative', backgroundColor: '#ddd' },
      img(image, 218, 372),
      h('div', { display: 'flex', position: 'absolute', top: 14, left: 14, padding: 5, borderRadius: 40, backgroundColor: BLUE }, img(av, 58, 58, { borderRadius: 29, border: '3px solid #fff' })),
      h('div', { display: 'flex', position: 'absolute', left: 12, bottom: 10 }, txt(name, { fontSize: 24, fontWeight: 700, color: '#fff' })));
  const createCard = col({ width: 218, height: 372, borderRadius: 24, overflow: 'hidden', backgroundColor: '#fff', alignItems: 'center' },
    img(AV[1], 218, 252),
    box(64, 64, BLUE, { borderRadius: 32, marginTop: -32, border: '6px solid #fff', alignItems: 'center', justifyContent: 'center' }, icon('plus', 34, '#fff')),
    txt('Create story', { fontSize: 24, fontWeight: 700, color: TXTC, marginTop: 8 }));
  const stories = row({ gap: 14, padding: 18, backgroundColor: '#fff' },
    createCard, storyCard(FUN[3], AV[2], 'mia.torres'), storyCard(FUN[5], AV[4], 'leila.k'), storyCard(FUN[6], AV[3], 'noah'), storyCard(FUN[7], AV[6], 'pink.pixel'));

  const postHeader = row({ alignItems: 'center', gap: 16, padding: 20 },
    img(AV[1], 78, 78, { borderRadius: 39 }),
    col({ gap: 4 },
      row({ gap: 8, alignItems: 'center' },
        txt(p.username ?? 'jay.makes', { fontSize: 30, fontWeight: 700, color: TXTC }),
        box(26, 26, BLUE, { borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, icon('play', 12, '#fff', { fill: true }))),
      row({ gap: 8, alignItems: 'center' }, txt('3h ·', { fontSize: 24, color: SEC }), icon('globe', 22, SEC))),
    row({ gap: 20, marginLeft: 'auto', alignItems: 'center' }, icon('more', 40, SEC), icon('x', 34, SEC)));

  const caption = txt(p.caption ?? "tried the invisible box challenge and the box said NO", { fontSize: 29, color: TXTC, paddingLeft: 24, paddingRight: 24, paddingBottom: 16 });

  const social = row({ height: 60, alignItems: 'center', justifyContent: 'space-between', paddingLeft: 24, paddingRight: 24 },
    row({ alignItems: 'center' },
      box(38, 38, BLUE, { borderRadius: 19, alignItems: 'center', justifyContent: 'center', border: '3px solid #fff' }, icon('thumbUp', 20, '#fff', { fill: true })),
      box(38, 38, '#F3425F', { borderRadius: 19, marginLeft: -10, alignItems: 'center', justifyContent: 'center', border: '3px solid #fff' }, icon('heart', 20, '#fff', { fill: true })),
      txt('12K', { fontSize: 25, color: SEC, marginLeft: 10 })),
    txt('842 comments · 3.1K shares', { fontSize: 25, color: SEC }));

  const actionBtn = (ic: string, label: string) => row({ gap: 10, alignItems: 'center', justifyContent: 'center', flexGrow: 1, height: 84 }, icon(ic, 36, SEC), txt(label, { fontSize: 26, fontWeight: 700, color: SEC }));
  const actions = row({ borderTop: '1px solid #CED0D4', marginLeft: 24, marginRight: 24 },
    actionBtn('thumbUp', 'Like'), actionBtn('comment', 'Comment'), actionBtn('send', 'Send'), actionBtn('shareArrow', 'Share'));

  const commentBubble = (av: string, name: string, text: string) => row({ gap: 14, paddingLeft: 24, paddingRight: 24, alignItems: 'flex-start' },
    img(av, 56, 56, { borderRadius: 28 }),
    col({ backgroundColor: '#F0F2F5', borderRadius: 28, paddingLeft: 22, paddingRight: 22, paddingTop: 12, paddingBottom: 12, gap: 4 },
      txt(name, { fontSize: 24, fontWeight: 700, color: TXTC }),
      txt(text, { fontSize: 25, color: TXTC })));
  const comments = col({ gap: 12, paddingTop: 8, paddingBottom: 12 },
    commentBubble(AV[3], 'noahwrites', 'I have watched this 12 times and it gets funnier'),
    txt('View 841 more comments', { fontSize: 24, fontWeight: 600, color: SEC, paddingLeft: 94 }));
  const tabBar = row({ height: 128, backgroundColor: '#fff', borderTop: '1px solid #CED0D4', alignItems: 'center', justifyContent: 'space-around', paddingLeft: 10, paddingRight: 10 },
    icon('home', 46, BLUE, { fill: true }),
    icon('film', 46, SEC),
    icon('users', 46, SEC),
    icon('shop', 46, SEC),
    icon('bell', 46, SEC),
    img(AV[1], 52, 52, { borderRadius: 26 }));

  return col({ width: 1080, height: 1920, backgroundColor: '#F0F2F5', fontFamily: 'Inter' },
    box(1080, 66, '#fff', {}, statusBar(false)),
    header, composer, stories,
    box(1080, 14, '#F0F2F5', {}),
    col({ backgroundColor: '#fff', flexGrow: 1 },
      postHeader, caption,
      box(1080, 560, SLOT), // ← slot: y = 66+104+108+408+14+118+90 ≈ 908
      social, actions, comments),
    tabBar);
}

function facebookDesktop(p: Record<string, string>): El {
  const BLUE = '#0866FF', SEC = '#65676B', TXTC = '#050505';
  const navChip = (name: string) => box(40, 40, '#E4E6EB', { borderRadius: 20, alignItems: 'center', justifyContent: 'center' }, icon(name, 20, TXTC));
  const centerTab = (name: string, active: boolean) => col({ width: 112, height: 56, alignItems: 'center', justifyContent: 'center', borderBottom: active ? '3px solid #0866FF' : '3px solid transparent' }, icon(name, 26, active ? BLUE : SEC));

  const nav = row({ height: 56, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 16, paddingRight: 16, boxShadow: '0 1px 2px rgba(0,0,0,0.1)' },
    row({ gap: 10, alignItems: 'center' },
      box(40, 40, BLUE, { borderRadius: 20, alignItems: 'center', justifyContent: 'center' }, txt('f', { fontSize: 28, color: '#fff', fontWeight: 700 })),
      h('div', { display: 'flex', width: 240, height: 40, borderRadius: 20, backgroundColor: '#F0F2F5', alignItems: 'center', paddingLeft: 12, gap: 8 }, icon('search', 16, SEC), txt('Search Facebook', { fontSize: 14, color: SEC }))),
    row({}, centerTab('home', true), centerTab('film', false), centerTab('shop', false), centerTab('users', false), centerTab('tv', false)),
    row({ gap: 8, alignItems: 'center' }, navChip('grid'), navChip('messenger'), navChip('bell'), img(AV[1], 40, 40, { borderRadius: 20 })));

  const railRow = (ic: string, label: string) => row({ alignItems: 'center', gap: 12, padding: 10, borderRadius: 8 }, icon(ic, 26, TXTC), txt(label, { fontSize: 15, fontWeight: 600, color: TXTC }));
  const leftRail = col({ width: 360, paddingTop: 12, paddingLeft: 12, gap: 2 },
    row({ alignItems: 'center', gap: 12, padding: 10 }, img(AV[1], 36, 36, { borderRadius: 18 }), txt('Jordan Cole', { fontSize: 15, fontWeight: 600, color: TXTC })),
    railRow('users', 'Friends'), railRow('clock', 'Memories'), railRow('bookmark', 'Saved'), railRow('users', 'Groups'), railRow('film', 'Video'), railRow('shop', 'Marketplace'), railRow('tv', 'Feeds'), railRow('bell', 'Events'),
    row({ alignItems: 'center', gap: 12, padding: 10 }, box(26, 26, '#E4E6EB', { borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, icon('chevronDown', 16, TXTC)), txt('See more', { fontSize: 15, fontWeight: 600, color: TXTC })));

  const story = (image: string, av: string, name: string) =>
    h('div', { display: 'flex', width: 112, height: 200, borderRadius: 12, overflow: 'hidden', position: 'relative' },
      img(image, 112, 200),
      h('div', { display: 'flex', position: 'absolute', top: 8, left: 8, padding: 3, borderRadius: 24, backgroundColor: BLUE }, img(av, 32, 32, { borderRadius: 16, border: '2px solid #fff' })),
      h('div', { display: 'flex', position: 'absolute', left: 8, bottom: 6 }, txt(name, { fontSize: 12, fontWeight: 700, color: '#fff' })));
  const createStory = col({ width: 112, height: 200, borderRadius: 12, overflow: 'hidden', backgroundColor: '#fff', alignItems: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.2)' },
    img(AV[1], 112, 140),
    box(36, 36, BLUE, { borderRadius: 18, marginTop: -18, border: '4px solid #fff', alignItems: 'center', justifyContent: 'center' }, icon('plus', 18, '#fff')),
    txt('Create story', { fontSize: 12, fontWeight: 700, color: TXTC, marginTop: 4 }));
  const storiesTray = row({ gap: 8, marginBottom: 16 },
    createStory, story(ST[0], AV[2], 'mia'), story(TH[0], AV[3], 'sunny'), story(ST[1], AV[4], 'leila'));

  const composerBtn = (ic: string, color: string, label: string) => row({ gap: 8, alignItems: 'center', justifyContent: 'center', flexGrow: 1, height: 40 }, icon(ic, 22, color), txt(label, { fontSize: 15, fontWeight: 600, color: SEC }));
  const composer = col({ width: 500, backgroundColor: '#fff', borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.2)', padding: 12, marginBottom: 16 },
    row({ gap: 10, alignItems: 'center', paddingBottom: 10, borderBottom: '1px solid #CED0D4' },
      img(AV[1], 40, 40, { borderRadius: 20 }),
      h('div', { display: 'flex', flexGrow: 1, height: 40, borderRadius: 20, backgroundColor: '#F0F2F5', alignItems: 'center', paddingLeft: 12 }, txt("What's on your mind, Jordan?", { fontSize: 15, color: SEC }))),
    row({ paddingTop: 6 }, composerBtn('film', '#F02849', 'Live video'), composerBtn('camera', '#45BD62', 'Photo/video'), composerBtn('heart', '#F7B928', 'Feeling/activity')));

  const postAction = (ic: string, lb: string) => row({ gap: 8, alignItems: 'center', justifyContent: 'center', flexGrow: 1 }, icon(ic, 20, SEC), txt(lb, { fontSize: 14, fontWeight: 600, color: SEC }));
  const post = col({ width: 500, backgroundColor: '#fff', borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.2)', overflow: 'hidden' },
    row({ alignItems: 'center', gap: 10, padding: 12 },
      img(AV[0], 40, 40, { borderRadius: 20 }),
      col({ gap: 2 },
        txt(p.username ?? 'daily.wander', { fontSize: 15, fontWeight: 700, color: TXTC }),
        row({ gap: 5, alignItems: 'center' }, txt('3h ·', { fontSize: 13, color: SEC }), icon('globe', 13, SEC))),
      row({ gap: 12, marginLeft: 'auto' }, icon('more', 22, SEC), icon('x', 20, SEC))),
    txt(p.caption ?? "you ever feel like she's looking AT you…", { fontSize: 15, color: TXTC, paddingLeft: 14, paddingRight: 14, paddingBottom: 10 }),
    box(500, 281, SLOT), // ← slot
    row({ height: 36, alignItems: 'center', justifyContent: 'space-between', paddingLeft: 14, paddingRight: 14 },
      row({ alignItems: 'center' },
        box(20, 20, BLUE, { borderRadius: 10, alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }, icon('thumbUp', 11, '#fff', { fill: true })),
        box(20, 20, '#F3425F', { borderRadius: 10, marginLeft: -6, alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }, icon('heart', 11, '#fff', { fill: true })),
        txt('12K', { fontSize: 14, color: SEC, marginLeft: 6 })),
      txt('842 comments · 3.1K shares', { fontSize: 14, color: SEC })),
    row({ borderTop: '1px solid #CED0D4', marginLeft: 14, marginRight: 14, height: 44 },
      postAction('thumbUp', 'Like'), postAction('comment', 'Comment'), postAction('shareArrow', 'Share')),
    row({ gap: 8, alignItems: 'center', padding: 12 },
      img(AV[1], 32, 32, { borderRadius: 16 }),
      h('div', { display: 'flex', flexGrow: 1, height: 36, borderRadius: 18, backgroundColor: '#F0F2F5', alignItems: 'center', paddingLeft: 12 }, txt('Write a comment…', { fontSize: 14, color: SEC }))));

  const sponsored = (image: string, title: string, domain: string) => row({ gap: 10, alignItems: 'center' }, img(image, 110, 110, { borderRadius: 8 }), col({ gap: 4 }, txt(title, { fontSize: 14, fontWeight: 600, color: TXTC }), txt(domain, { fontSize: 12, color: SEC })));
  const contact = (av: string, name: string) => row({ alignItems: 'center', gap: 10 },
    h('div', { display: 'flex', position: 'relative' }, img(av, 36, 36, { borderRadius: 18 }), h('div', { display: 'flex', position: 'absolute', right: 0, bottom: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: '#31A24C', border: '2px solid #fff' })),
    txt(name, { fontSize: 15, color: TXTC }));
  const rightRail = col({ width: 360, paddingTop: 12, paddingLeft: 20, gap: 14 },
    txt('Sponsored', { fontSize: 14, fontWeight: 700, color: SEC }),
    sponsored(TH[3], 'Build your dream board', 'keebshop.co'),
    sponsored(TH[4], 'City photo walks — join us', 'walkswith.us'),
    box(320, 1, '#CED0D4', {}),
    txt('Contacts', { fontSize: 14, fontWeight: 700, color: SEC }),
    contact(AV[2], 'Mia Torres'), contact(AV[3], 'Noah Alvarez'), contact(AV[4], 'Leila Karim'), contact(AV[5], 'Greg Mathis'), contact(AV[6], 'Priya N.'));

  return col({ width: 1920, height: 1080, backgroundColor: '#F0F2F5', fontFamily: 'Inter' },
    nav,
    row({ flexGrow: 1, justifyContent: 'space-between' },
      leftRail,
      col({ width: 500, paddingTop: 16 }, storiesTray, composer, post),
      rightRail));
}

// ═════════════════════════════ INSTAGRAM ════════════════════════════════════
// Light default feed; Reels dark full-bleed. Blue #0095F6, red #FF3040.

function instagramMobile(p: Record<string, string>): El {
  const SEC = '#737373', TXTC = '#000';
  const header = row({ height: 100, alignItems: 'center', justifyContent: 'space-between', paddingLeft: 28, paddingRight: 28, backgroundColor: '#fff' },
    row({ gap: 8, alignItems: 'center' }, txt('Instagram', { fontSize: 50, fontWeight: 700, color: TXTC, letterSpacing: -1 }), icon('chevronDown', 26, TXTC)),
    row({ gap: 30, alignItems: 'center' },
      icon('heart', 44, TXTC),
      h('div', { display: 'flex', position: 'relative' },
        icon('send', 44, TXTC),
        box(30, 30, '#FF3040', { position: 'absolute', top: -8, right: -12, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, txt('3', { fontSize: 18, color: '#fff', fontWeight: 700 })))));

  const storyItem = (av: string, name: string, seen: boolean) => col({ alignItems: 'center', gap: 8 },
    seen
      ? h('div', { display: 'flex', padding: 5, borderRadius: 70, border: '3px solid #DBDBDB' }, img(av, 116, 116, { borderRadius: 58 }))
      : ringAvatar(av, 116, 6, 5),
    txt(name.length > 10 ? name.slice(0, 9) + '…' : name, { fontSize: 22, color: TXTC }));
  const yourStory = col({ alignItems: 'center', gap: 8 },
    h('div', { display: 'flex', position: 'relative' },
      img(AV[1], 128, 128, { borderRadius: 64 }),
      box(40, 40, '#0095F6', { position: 'absolute', right: 0, bottom: 0, borderRadius: 20, border: '4px solid #fff', alignItems: 'center', justifyContent: 'center' }, icon('plus', 22, '#fff'))),
    txt('Your story', { fontSize: 22, color: SEC }));
  const stories = row({ gap: 24, paddingLeft: 28, paddingTop: 8, paddingBottom: 16, backgroundColor: '#fff' },
    yourStory, storyItem(AV[0], 'daily.wander', false), storyItem(AV[2], 'mia.torres', false), storyItem(AV[4], 'leila.k', false), storyItem(AV[6], 'pink.pixel', false), storyItem(AV[5], 'greg', true), storyItem(AV[7], 'marcusfit', false));

  const postHeader = row({ alignItems: 'center', gap: 14, paddingLeft: 24, paddingRight: 24, height: 96, backgroundColor: '#fff' },
    ringAvatar(AV[1], 60, 4, 3),
    col({ gap: 2 },
      row({ gap: 8, alignItems: 'center' },
        txt(p.username ?? 'jay.makes', { fontSize: 28, fontWeight: 700, color: TXTC }),
        box(24, 24, '#0095F6', { borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, icon('play', 11, '#fff', { fill: true }))),
      row({ gap: 6, alignItems: 'center' }, icon('music', 18, TXTC), txt('Original audio', { fontSize: 20, color: TXTC }))),
    h('div', { display: 'flex', marginLeft: 'auto' }, icon('more', 40, TXTC)));

  const actions = row({ height: 92, alignItems: 'center', paddingLeft: 24, paddingRight: 24, gap: 24, backgroundColor: '#fff' },
    row({ gap: 10, alignItems: 'center' }, icon('heart', 48, TXTC), txt('842K', { fontSize: 26, fontWeight: 700, color: TXTC })),
    row({ gap: 10, alignItems: 'center' }, icon('comment', 46, TXTC), txt('12.1K', { fontSize: 26, fontWeight: 700, color: TXTC })),
    row({ gap: 10, alignItems: 'center' }, icon('repost', 44, TXTC), txt('9,412', { fontSize: 26, fontWeight: 700, color: TXTC })),
    icon('send', 46, TXTC),
    h('div', { display: 'flex', marginLeft: 'auto' }, icon('bookmark', 46, TXTC)));

  const below = col({ paddingLeft: 24, paddingRight: 24, gap: 10, backgroundColor: '#fff', paddingBottom: 10 },
    row({ gap: 8, alignItems: 'center' },
      img(AV[2], 28, 28, { borderRadius: 14 }), img(AV[3], 28, 28, { borderRadius: 14, marginLeft: -14 }),
      txt('Liked by mia.torres and 842,117 others', { fontSize: 24, color: TXTC })),
    row({ gap: 6 }, txt(p.username ?? 'jay.makes', { fontSize: 24, fontWeight: 700, color: TXTC }), txt(p.caption ?? 'day 3 of learning magic. it is going GREAT… more', { fontSize: 24, color: TXTC })),
    row({ gap: 6 }, txt('noahwrites', { fontSize: 23, fontWeight: 700, color: TXTC }), txt('the confidence before it went wrong LOL', { fontSize: 23, color: TXTC }), h('div', { display: 'flex', marginLeft: 'auto' }, icon('heart', 22, SEC))),
    row({ gap: 6 }, txt('pink.pixel', { fontSize: 23, fontWeight: 700, color: TXTC }), txt('this is the best thing on the internet today', { fontSize: 23, color: TXTC }), h('div', { display: 'flex', marginLeft: 'auto' }, icon('heart', 22, SEC))),
    txt('View all 2,391 comments', { fontSize: 23, color: SEC }),
    row({ gap: 10, alignItems: 'center' },
      img(AV[1], 40, 40, { borderRadius: 20 }),
      txt('Add a comment…', { fontSize: 22, color: SEC }),
      h('div', { display: 'flex', marginLeft: 'auto', gap: 12, flexDirection: 'row' }, txt('2h', { fontSize: 20, color: SEC }))));

  const tabBar = row({ height: 118, backgroundColor: '#fff', borderTop: '1px solid #DBDBDB', alignItems: 'center', justifyContent: 'space-around' },
    icon('home', 46, TXTC, { fill: true }),
    icon('search', 46, TXTC),
    box(52, 52, 'transparent', { borderRadius: 14, border: '3px solid #000', alignItems: 'center', justifyContent: 'center' }, icon('plus', 28, TXTC)),
    icon('film', 46, TXTC),
    img(AV[1], 48, 48, { borderRadius: 24 }));

  return col({ width: 1080, height: 1920, backgroundColor: '#fff', fontFamily: 'Inter' },
    box(1080, 66, '#fff', {}, statusBar(false)),
    header, stories,
    box(1080, 1, '#DBDBDB', {}),
    postHeader,
    box(1080, 1080, SLOT), // ← slot (1:1) y = 66+100+229+1+96 = 492
    actions, below,
    h('div', { display: 'flex', flexGrow: 1, backgroundColor: '#fff' }),
    tabBar);
}

function instagramReels(p: Record<string, string>): El {
  // CHROME — transparent, drawn OVER the full-bleed video.
  const railItem = (ic: string, label: string | null) => col({ alignItems: 'center', gap: 8 },
    icon(ic, 54, '#fff'),
    label ? txt(label, { fontSize: 24, fontWeight: 700, color: '#fff' }) : null);
  const topScrim = h('div', { display: 'flex', width: 1080, height: 280, backgroundImage: 'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 100%)', flexDirection: 'column' },
    statusBar(true),
    row({ alignItems: 'center', justifyContent: 'space-between', paddingLeft: 30, paddingRight: 30, paddingTop: 6 },
      txt('Reels', { fontSize: 44, fontWeight: 700, color: '#fff' }),
      icon('camera', 44, '#fff')));
  const bottomScrim = h('div', { display: 'flex', width: 1080, height: 560, backgroundImage: 'linear-gradient(0deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 100%)', position: 'relative' },
    col({ position: 'absolute', right: 22, bottom: 60, alignItems: 'center', gap: 44 },
      railItem('heart', '842K'), railItem('comment', '12.1K'), railItem('send', '56K'), railItem('repost', '9,412'), railItem('more', null),
      img(ST[1], 58, 58, { borderRadius: 12, border: '3px solid rgba(255,255,255,0.85)' })),
    col({ position: 'absolute', left: 28, bottom: 44, gap: 18, width: 820 },
      row({ alignItems: 'center', gap: 16 },
        img(AV[1], 62, 62, { borderRadius: 31, border: '2px solid #fff' }),
        txt(p.username ?? 'jay.makes', { fontSize: 27, fontWeight: 700, color: '#fff' }),
        h('div', { display: 'flex', paddingLeft: 20, paddingRight: 20, height: 52, borderRadius: 14, border: '2px solid rgba(255,255,255,0.9)', alignItems: 'center' }, txt('Follow', { fontSize: 24, fontWeight: 700, color: '#fff' }))),
      txt(p.caption ?? 'POV: you finally nail the trick on camera… more', { fontSize: 25, color: '#f2f2f2' }),
      row({ gap: 12, alignItems: 'center' },
        icon('music', 24, '#fff'),
        h('div', { display: 'flex', paddingLeft: 14, paddingRight: 14, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center' }, txt('jay.makes · Original audio', { fontSize: 22, color: '#fff' })))));
  return col({ width: 1080, height: 1920, fontFamily: 'Inter' },
    topScrim,
    h('div', { display: 'flex', flexGrow: 1 }),
    bottomScrim);
}

// ═════════════════════════════ TIKTOK ═══════════════════════════════════════
// Cyan #25F4EE / red #FE2C55. Mobile = chrome over full-bleed + opaque tab bar.

function tiktokMobile(p: Record<string, string>): El {
  const count = (v: string) => txt(v, { fontSize: 24, fontWeight: 700, color: '#fff' });
  const topTabs = h('div', { display: 'flex', width: 1080, height: 240, flexDirection: 'column' },
    statusBar(true),
    row({ alignItems: 'flex-end', justifyContent: 'center', gap: 44, paddingTop: 12, position: 'relative' },
      h('div', { display: 'flex', position: 'absolute', left: 30, top: 14 }, icon('tv', 40, '#fff')),
      txt('Following', { fontSize: 30, color: 'rgba(255,255,255,0.7)' }),
      txt('Shop', { fontSize: 30, color: 'rgba(255,255,255,0.7)' }),
      col({ alignItems: 'center', gap: 8 }, txt('For You', { fontSize: 30, fontWeight: 700, color: '#fff' }), box(52, 5, '#fff', { borderRadius: 3 })),
      h('div', { display: 'flex', position: 'absolute', right: 30, top: 14 }, icon('search', 40, '#fff'))));
  const rail = col({ position: 'absolute', right: 16, bottom: 70, alignItems: 'center', gap: 38 },
    h('div', { display: 'flex', flexDirection: 'column', alignItems: 'center' },
      img(AV[1], 94, 94, { borderRadius: 47, border: '3px solid #fff' }),
      box(42, 42, '#FE2C55', { borderRadius: 21, marginTop: -21, alignItems: 'center', justifyContent: 'center' }, icon('plus', 26, '#fff'))),
    col({ alignItems: 'center', gap: 6 }, icon('heart', 62, '#fff', { fill: true }), count('328.7K')),
    col({ alignItems: 'center', gap: 6 }, icon('comment', 56, '#fff', { fill: true }), count('4,882')),
    col({ alignItems: 'center', gap: 6 }, icon('bookmark', 54, '#fff', { fill: true }), count('45.2K')),
    col({ alignItems: 'center', gap: 6 }, icon('shareArrow', 54, '#fff', { fill: true }), count('12.1K')),
    h('div', { display: 'flex', padding: 14, borderRadius: 50, backgroundColor: '#161616', border: '12px solid #0a0a0a' }, img(ST[1], 52, 52, { borderRadius: 26 })));
  const meta = col({ position: 'absolute', left: 26, bottom: 50, gap: 16, width: 760 },
    txt('@' + (p.username ?? 'jay.makes'), { fontSize: 30, fontWeight: 700, color: '#fff' }),
    txt(p.caption ?? 'told him the camera adds confidence. he believed me #funny #fyp', { fontSize: 26, color: '#f2f2f2' }),
    row({ gap: 12, alignItems: 'center' }, icon('music', 24, '#fff'), txt('original sound - jay.makes', { fontSize: 24, color: '#eee' })));
  const tabItem = (ic: string, label: string, active: boolean) => col({ alignItems: 'center', gap: 6 },
    icon(ic, 40, active ? '#fff' : 'rgba(255,255,255,0.6)', { fill: active }),
    txt(label, { fontSize: 20, color: active ? '#fff' : 'rgba(255,255,255,0.6)' }));
  const createBtn = h('div', { display: 'flex', position: 'relative', width: 130, height: 78, alignItems: 'center', justifyContent: 'center' },
    box(104, 66, '#25F4EE', { borderRadius: 16, position: 'absolute', left: 6 }),
    box(104, 66, '#FE2C55', { borderRadius: 16, position: 'absolute', right: 6 }),
    box(104, 66, '#fff', { borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, icon('plus', 38, '#000')));
  const tabBar = row({ height: 132, backgroundColor: '#000', alignItems: 'center', justifyContent: 'space-around', paddingLeft: 16, paddingRight: 16 },
    tabItem('home', 'Home', true), tabItem('shop', 'Shop', false), createBtn, tabItem('inbox', 'Inbox', false), tabItem('user', 'Profile', false));
  return col({ width: 1080, height: 1920, fontFamily: 'Inter' },
    topTabs,
    h('div', { display: 'flex', flexGrow: 1, position: 'relative' },
      h('div', { display: 'flex', width: 1080, height: 600, backgroundImage: 'linear-gradient(0deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 100%)', position: 'absolute', bottom: 0 }),
      rail, meta),
    row({ width: 1080, height: 4 }, box(300, 4, '#fff', {}), box(780, 4, 'rgba(255,255,255,0.3)', {})),
    tabBar);
}

function tiktokDesktop(p: Record<string, string>): El {
  const sideItem = (ic: string, label: string, active: boolean) => row({ alignItems: 'center', gap: 14, padding: 10, borderRadius: 8 },
    icon(ic, 26, active ? '#FE2C55' : '#fff'),
    txt(label, { fontSize: 17, fontWeight: active ? 700 : 400, color: active ? '#FE2C55' : '#fff' }));
  const sidebar = col({ width: 240, height: 1080, paddingTop: 20, paddingLeft: 16, gap: 6, borderRight: '1px solid rgba(255,255,255,0.08)' },
    row({ gap: 8, alignItems: 'center', paddingBottom: 14 }, icon('music', 34, '#fff', { fill: true }), txt('toktik', { fontSize: 28, fontWeight: 700, color: '#fff' })),
    h('div', { display: 'flex', width: 200, height: 42, borderRadius: 21, backgroundColor: '#2f2f2f', alignItems: 'center', paddingLeft: 14, gap: 8, marginBottom: 10 }, icon('search', 18, '#888'), txt('Search', { fontSize: 15, color: '#888' })),
    sideItem('home', 'For You', true), sideItem('compass', 'Explore', false), sideItem('users', 'Following', false), sideItem('tv', 'LIVE', false), sideItem('user', 'Profile', false), sideItem('more', 'More', false),
    h('div', { display: 'flex', width: 200, height: 46, borderRadius: 6, backgroundColor: '#FE2C55', alignItems: 'center', justifyContent: 'center', marginTop: 14 }, txt('Log in', { fontSize: 16, fontWeight: 700, color: '#fff' })));
  const railBtn = (ic: string, cnt: string | null) => col({ alignItems: 'center', gap: 6 },
    box(56, 56, 'rgba(255,255,255,0.09)', { borderRadius: 28, alignItems: 'center', justifyContent: 'center' }, icon(ic, 28, '#fff', { fill: true })),
    cnt ? txt(cnt, { fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }) : null);
  const rail = col({ position: 'absolute', left: 1352, bottom: 40, alignItems: 'center', gap: 22 },
    h('div', { display: 'flex', flexDirection: 'column', alignItems: 'center' },
      img(AV[1], 56, 56, { borderRadius: 28, border: '2px solid #fff' }),
      box(24, 24, '#FE2C55', { borderRadius: 12, marginTop: -12, alignItems: 'center', justifyContent: 'center' }, icon('plus', 14, '#fff'))),
    railBtn('heart', '328.7K'), railBtn('comment', '4,882'), railBtn('bookmark', '45.2K'), railBtn('shareArrow', '12.1K'));
  const pager = col({ position: 'absolute', right: 24, top: 440, gap: 16 },
    box(52, 52, 'rgba(255,255,255,0.09)', { borderRadius: 26, alignItems: 'center', justifyContent: 'center' }, icon('chevronUp', 26, '#fff')),
    box(52, 52, 'rgba(255,255,255,0.09)', { borderRadius: 26, alignItems: 'center', justifyContent: 'center' }, icon('chevronDown', 26, '#fff')));
  const metaOverlay = col({ position: 'absolute', left: 776, bottom: 56, gap: 12, width: 500 },
    txt('@' + (p.username ?? 'jay.makes'), { fontSize: 20, fontWeight: 700, color: '#fff' }),
    txt(p.caption ?? 'told him the camera adds confidence #funny #fyp', { fontSize: 17, color: '#eee' }),
    row({ gap: 8, alignItems: 'center' }, icon('music', 16, '#fff'), txt('original sound - jay.makes', { fontSize: 16, color: '#ddd' })));
  return h('div', { display: 'flex', flexDirection: 'row', width: 1920, height: 1080, backgroundColor: '#000', fontFamily: 'Inter', position: 'relative' },
    sidebar,
    box(580, 1032, SLOT, { position: 'absolute', left: 750, top: 24, borderRadius: 14 }), // ← slot
    metaOverlay, rail, pager);
}

// ═══════════ MID-SCROLL VARIANTS (caught scrolling — for ads) ═══════════════

function facebookMobileScroll(p: Record<string, string>): El {
  const BLUE = '#0866FF', SEC = '#65676B', TXTC = '#050505';
  const prevPost = col({ backgroundColor: '#fff' },
    img(FUN[0], 1080, 300),
    row({ height: 60, alignItems: 'center', justifyContent: 'space-between', paddingLeft: 24, paddingRight: 24 },
      row({ alignItems: 'center' },
        box(38, 38, BLUE, { borderRadius: 19, alignItems: 'center', justifyContent: 'center', border: '3px solid #fff' }, icon('thumbUp', 20, '#fff', { fill: true })),
        box(38, 38, '#F7B928', { borderRadius: 19, marginLeft: -10, alignItems: 'center', justifyContent: 'center', border: '3px solid #fff' }, icon('heart', 20, '#fff', { fill: true })),
        txt('48K', { fontSize: 25, color: SEC, marginLeft: 10 })),
      txt('2.1K comments', { fontSize: 25, color: SEC })),
    row({ borderTop: '1px solid #CED0D4', marginLeft: 24, marginRight: 24, height: 70, alignItems: 'center' },
      row({ gap: 10, alignItems: 'center', justifyContent: 'center', flexGrow: 1 }, icon('thumbUp', 32, SEC), txt('Like', { fontSize: 24, fontWeight: 700, color: SEC })),
      row({ gap: 10, alignItems: 'center', justifyContent: 'center', flexGrow: 1 }, icon('comment', 32, SEC), txt('Comment', { fontSize: 24, fontWeight: 700, color: SEC })),
      row({ gap: 10, alignItems: 'center', justifyContent: 'center', flexGrow: 1 }, icon('shareArrow', 32, SEC), txt('Share', { fontSize: 24, fontWeight: 700, color: SEC }))));
  const videoHeader = row({ alignItems: 'center', gap: 16, padding: 20, backgroundColor: '#fff' },
    img(AV[1], 78, 78, { borderRadius: 39 }),
    col({ gap: 4 },
      row({ gap: 8, alignItems: 'center' },
        txt(p.username ?? 'jay.makes', { fontSize: 30, fontWeight: 700, color: TXTC }),
        box(26, 26, BLUE, { borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, icon('play', 12, '#fff', { fill: true }))),
      row({ gap: 8, alignItems: 'center' }, txt('1h ·', { fontSize: 24, color: SEC }), icon('globe', 22, SEC))),
    row({ gap: 20, marginLeft: 'auto', alignItems: 'center' }, icon('more', 40, SEC), icon('x', 34, SEC)));
  const caption = txt(p.caption ?? 'tried the invisible box challenge and the box said NO', { fontSize: 28, color: TXTC, paddingLeft: 24, paddingRight: 24, paddingBottom: 14, backgroundColor: '#fff' });
  const social = row({ height: 58, alignItems: 'center', justifyContent: 'space-between', paddingLeft: 24, paddingRight: 24, backgroundColor: '#fff' },
    row({ alignItems: 'center' },
      box(38, 38, BLUE, { borderRadius: 19, alignItems: 'center', justifyContent: 'center', border: '3px solid #fff' }, icon('thumbUp', 20, '#fff', { fill: true })),
      box(38, 38, '#F3425F', { borderRadius: 19, marginLeft: -10, alignItems: 'center', justifyContent: 'center', border: '3px solid #fff' }, icon('heart', 20, '#fff', { fill: true })),
      txt('26K', { fontSize: 25, color: SEC, marginLeft: 10 })),
    txt('1.4K comments · 8.8K shares', { fontSize: 25, color: SEC }));
  const actions = row({ borderTop: '1px solid #CED0D4', marginLeft: 24, marginRight: 24, height: 80, backgroundColor: '#fff', alignItems: 'center' },
    row({ gap: 10, alignItems: 'center', justifyContent: 'center', flexGrow: 1 }, icon('thumbUp', 34, SEC), txt('Like', { fontSize: 25, fontWeight: 700, color: SEC })),
    row({ gap: 10, alignItems: 'center', justifyContent: 'center', flexGrow: 1 }, icon('comment', 34, SEC), txt('Comment', { fontSize: 25, fontWeight: 700, color: SEC })),
    row({ gap: 10, alignItems: 'center', justifyContent: 'center', flexGrow: 1 }, icon('send', 34, SEC), txt('Send', { fontSize: 25, fontWeight: 700, color: SEC })),
    row({ gap: 10, alignItems: 'center', justifyContent: 'center', flexGrow: 1 }, icon('shareArrow', 34, SEC), txt('Share', { fontSize: 25, fontWeight: 700, color: SEC })));
  const comment = row({ gap: 14, paddingLeft: 24, paddingRight: 24, paddingTop: 10, paddingBottom: 14, backgroundColor: '#fff' },
    img(AV[4], 56, 56, { borderRadius: 28 }),
    col({ backgroundColor: '#F0F2F5', borderRadius: 28, paddingLeft: 22, paddingRight: 22, paddingTop: 12, paddingBottom: 12, gap: 4 },
      txt('leila.k', { fontSize: 24, fontWeight: 700, color: TXTC }),
      txt('the commitment to the bit is incredible', { fontSize: 25, color: TXTC })));
  const nextPost = col({ backgroundColor: '#fff', flexGrow: 1 },
    row({ alignItems: 'center', gap: 16, padding: 18 },
      img(AV[6], 70, 70, { borderRadius: 35 }),
      col({ gap: 4 },
        txt('pink.pixel', { fontSize: 28, fontWeight: 700, color: TXTC }),
        row({ gap: 8, alignItems: 'center' }, txt('4h ·', { fontSize: 22, color: SEC }), icon('globe', 20, SEC))),
      h('div', { display: 'flex', marginLeft: 'auto' }, icon('more', 38, SEC))),
    img(FUN[9], 1080, 140));
  return col({ width: 1080, height: 1920, backgroundColor: '#F0F2F5', fontFamily: 'Inter' },
    box(1080, 66, '#fff', {}, statusBar(false)),
    prevPost,
    box(1080, 14, '#F0F2F5', {}),
    videoHeader, caption,
    box(1080, 560, SLOT), // ← slot y = 66+430+14+118+82 = 710
    social, actions, comment,
    box(1080, 14, '#F0F2F5', {}),
    nextPost,
    row({ height: 128, backgroundColor: '#fff', borderTop: '1px solid #CED0D4', alignItems: 'center', justifyContent: 'space-around', paddingLeft: 10, paddingRight: 10 },
      icon('home', 46, BLUE, { fill: true }), icon('film', 46, SEC), icon('users', 46, SEC), icon('shop', 46, SEC), icon('bell', 46, SEC), img(AV[1], 52, 52, { borderRadius: 26 })));
}

function instagramMobileScroll(p: Record<string, string>): El {
  const SEC = '#737373', TXTC = '#000';
  const prevTail = col({ backgroundColor: '#fff' },
    img(FUN[1], 1080, 300),
    row({ height: 76, alignItems: 'center', paddingLeft: 24, paddingRight: 24, gap: 24 },
      row({ gap: 10, alignItems: 'center' }, icon('heart', 44, '#FF3040', { fill: true }), txt('231K', { fontSize: 25, fontWeight: 700, color: TXTC })),
      row({ gap: 10, alignItems: 'center' }, icon('comment', 42, TXTC), txt('4,102', { fontSize: 25, fontWeight: 700, color: TXTC })),
      icon('send', 42, TXTC),
      h('div', { display: 'flex', marginLeft: 'auto' }, icon('bookmark', 42, TXTC))));
  const videoHeader = row({ alignItems: 'center', gap: 14, paddingLeft: 24, paddingRight: 24, height: 96, backgroundColor: '#fff' },
    ringAvatar(AV[1], 60, 4, 3),
    col({ gap: 2 },
      row({ gap: 8, alignItems: 'center' },
        txt(p.username ?? 'jay.makes', { fontSize: 28, fontWeight: 700, color: TXTC }),
        box(24, 24, '#0095F6', { borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, icon('play', 11, '#fff', { fill: true }))),
      row({ gap: 6, alignItems: 'center' }, icon('music', 18, TXTC), txt('Original audio', { fontSize: 20, color: TXTC }))),
    h('div', { display: 'flex', marginLeft: 'auto' }, icon('more', 40, TXTC)));
  const actions = row({ height: 90, alignItems: 'center', paddingLeft: 24, paddingRight: 24, gap: 24, backgroundColor: '#fff' },
    row({ gap: 10, alignItems: 'center' }, icon('heart', 48, TXTC), txt('98K', { fontSize: 26, fontWeight: 700, color: TXTC })),
    row({ gap: 10, alignItems: 'center' }, icon('comment', 46, TXTC), txt('3,209', { fontSize: 26, fontWeight: 700, color: TXTC })),
    row({ gap: 10, alignItems: 'center' }, icon('repost', 44, TXTC), txt('12K', { fontSize: 26, fontWeight: 700, color: TXTC })),
    icon('send', 46, TXTC),
    h('div', { display: 'flex', marginLeft: 'auto' }, icon('bookmark', 46, TXTC)));
  const below = col({ paddingLeft: 24, paddingRight: 24, gap: 10, backgroundColor: '#fff', paddingBottom: 10 },
    row({ gap: 6 }, txt(p.username ?? 'jay.makes', { fontSize: 24, fontWeight: 700, color: TXTC }), txt(p.caption ?? 'day 3 of learning magic. it is going GREAT', { fontSize: 24, color: TXTC })),
    txt('View all 1,024 comments', { fontSize: 23, color: SEC }));
  const nextHead = row({ alignItems: 'center', gap: 14, paddingLeft: 24, paddingRight: 24, height: 90, backgroundColor: '#fff' },
    ringAvatar(AV[7], 56, 4, 3),
    txt('marcusfit', { fontSize: 27, fontWeight: 700, color: TXTC }),
    h('div', { display: 'flex', marginLeft: 'auto' }, icon('more', 38, TXTC)));
  return col({ width: 1080, height: 1920, backgroundColor: '#fff', fontFamily: 'Inter' },
    box(1080, 66, '#fff', {}, statusBar(false)),
    prevTail,
    box(1080, 1, '#DBDBDB', {}),
    videoHeader,
    box(1080, 1080, SLOT), // ← slot y = 66+376+1+96 = 539
    actions, below,
    box(1080, 1, '#DBDBDB', {}),
    nextHead,
    h('div', { display: 'flex', flexGrow: 1, backgroundColor: '#fff' }),
    row({ height: 118, backgroundColor: '#fff', borderTop: '1px solid #DBDBDB', alignItems: 'center', justifyContent: 'space-around' },
      icon('home', 46, TXTC, { fill: true }), icon('search', 46, TXTC),
      box(52, 52, 'transparent', { borderRadius: 14, border: '3px solid #000', alignItems: 'center', justifyContent: 'center' }, icon('plus', 28, TXTC)),
      icon('film', 46, TXTC), img(AV[1], 48, 48, { borderRadius: 24 })));
}

export { facebookMobile, facebookDesktop, instagramMobile, instagramReels, tiktokMobile, tiktokDesktop, facebookMobileScroll, instagramMobileScroll };
export const SLOT_BG = SLOT;
