// ═══════════════════════════════════════════════════════════════════════════
// breakout-plan-builder.ts — compiles USER STORY PARAMS into an EffectPlan.
//
// The Studio UI collects: platform template, what happens IN the feed video
// (pre-story), the breakout moment, the story AFTER (continued via frame
// chaining, 0–3 extra clips, optional new background), an optional user
// avatar (identity reference), username + caption. This builder turns that
// into a full DAG the effect-executor runs. Pricing scales with clip count.
//
// IDENTITY RULES (Seedance schema, verified live):
//  • inner_video is frame-free → avatar goes in as reference_images [Image1].
//  • breakout + continuations are frame-conditioned (i2v) → identity carries
//    through the frame chain itself; reference_images are ILLEGAL there.
// ═══════════════════════════════════════════════════════════════════════════

import type { EffectPlan, EffectStage } from './effect-plan.ts';

export interface BreakoutParams {
  template: string;
  username?: string;
  caption?: string;
  /** The story playing in the feed BEFORE the break. */
  preStory: string;
  /** How the break itself plays (optional flavor). */
  breakoutStory?: string;
  /** The story AFTER the break — drives continuation clips. */
  afterStory?: string;
  /** 0–3 extra 10s clips chained from the breakout's last frame. */
  afterClips?: number;
  /** New environment for the after-story ("a neon rooftop party at night"). */
  afterBackground?: string;
  /** Public URL of the user's reference photo — they become the star. */
  avatarUrl?: string;
}

interface TemplateMeta {
  mode: 'slot' | 'chrome';
  W: number; H: number;
  rect: [number, number, number, number];
  canvasAspect: '16:9' | '9:16';
  innerAspect: '16:9' | '9:16' | '1:1';
  displayName: string;
}

// Mirrors render-ui/templates-2 registry — keep in sync when templates move.
export const BREAKOUT_TEMPLATES_META: Record<string, TemplateMeta> = {
  'facebook-mobile':         { mode: 'slot',   W: 1080, H: 1920, rect: [0, 908, 1080, 560],  canvasAspect: '9:16', innerAspect: '16:9', displayName: 'Facebook — top of feed' },
  'facebook-mobile-scroll':  { mode: 'slot',   W: 1080, H: 1920, rect: [0, 710, 1080, 560],  canvasAspect: '9:16', innerAspect: '16:9', displayName: 'Facebook — mid-scroll' },
  'instagram-mobile':        { mode: 'slot',   W: 1080, H: 1920, rect: [0, 492, 1080, 1080], canvasAspect: '9:16', innerAspect: '1:1',  displayName: 'Instagram — feed' },
  'instagram-mobile-scroll': { mode: 'slot',   W: 1080, H: 1920, rect: [0, 539, 1080, 1080], canvasAspect: '9:16', innerAspect: '1:1',  displayName: 'Instagram — mid-scroll' },
  'instagram-reels':         { mode: 'chrome', W: 1080, H: 1920, rect: [0, 0, 1080, 1920],   canvasAspect: '9:16', innerAspect: '9:16', displayName: 'Instagram — Reels' },
  'tiktok-mobile':           { mode: 'chrome', W: 1080, H: 1920, rect: [0, 0, 1080, 1920],   canvasAspect: '9:16', innerAspect: '9:16', displayName: 'TikTok — For You' },
  'tiktok-desktop':          { mode: 'slot',   W: 1920, H: 1080, rect: [750, 24, 580, 1032], canvasAspect: '16:9', innerAspect: '9:16', displayName: 'TikTok — desktop' },
  'youtube-mobile':          { mode: 'slot',   W: 1080, H: 1920, rect: [0, 66, 1080, 608],   canvasAspect: '9:16', innerAspect: '16:9', displayName: 'YouTube — watch page' },
  'youtube-desktop':         { mode: 'slot',   W: 1920, H: 1080, rect: [24, 64, 1280, 720],  canvasAspect: '16:9', innerAspect: '16:9', displayName: 'YouTube — desktop' },
  'netflix-desktop':         { mode: 'chrome', W: 1920, H: 1080, rect: [0, 0, 1920, 1080],   canvasAspect: '16:9', innerAspect: '16:9', displayName: 'Netflix — player' },
  'netflix-mobile':          { mode: 'chrome', W: 1920, H: 1080, rect: [0, 0, 1920, 1080],   canvasAspect: '16:9', innerAspect: '16:9', displayName: 'Netflix — phone player' },
};

/** Base run (2 video gens + images + QC + worst-case retry) + per extra clip. */
export const BREAKOUT_BASE_CREDITS = 150;
export const BREAKOUT_AFTER_CLIP_CREDITS = 70;

export function breakoutCostCredits(afterClips: number): number {
  return BREAKOUT_BASE_CREDITS + Math.max(0, Math.min(3, afterClips)) * BREAKOUT_AFTER_CLIP_CREDITS;
}

const clean = (s: unknown, max = 600) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export function buildBreakoutPlan(params: BreakoutParams): { plan: EffectPlan; costCredits: number } {
  const meta = BREAKOUT_TEMPLATES_META[params.template];
  if (!meta) throw new Error(`unknown breakout template: ${params.template}`);
  const preStory = clean(params.preStory);
  if (preStory.length < 8) throw new Error('preStory required — describe what happens in the feed video');
  const afterClips = Math.max(0, Math.min(3, Number(params.afterClips ?? 0)));
  const afterStory = clean(params.afterStory);
  const afterBackground = clean(params.afterBackground, 200);
  const breakoutStory = clean(params.breakoutStory, 400);
  // S4: only accept avatar URLs from OUR storage domain — an arbitrary URL
  // would be fetched server-side by Replicate (SSRF / exfil surface).
  const avatarOk = typeof params.avatarUrl === 'string' &&
    /^https:\/\/ywcwaumozoejierlfkgj\.supabase\.co\/storage\/v1\//.test(params.avatarUrl);
  const hasAvatar = avatarOk;

  const SUBJECT = hasAvatar
    ? 'the person from reference image [Image1] (match their face, hair, and build exactly)'
    : 'a charismatic young man with short black hair, light stubble, and a dark green hoodie';

  const stages: EffectStage[] = [];

  stages.push({
    id: 'ui_still', layer: 'rigid', tool: 'ui.render',
    purpose: 'Deterministic platform UI — code, not generation.',
    inputs: { template: params.template, props: { username: clean(params.username, 40) || 'jay.makes', caption: clean(params.caption, 120) || preStory.slice(0, 90) } },
  });

  const innerInputs: Record<string, unknown> = {
    prompt:
      `Locked-off static camera. ${SUBJECT} in this scene: ${preStory}. ` +
      `Then a delightful turn: they suddenly notice someone is WATCHING through the screen — eyes widen with delight, a slow mischievous grin spreads. They lean in close, knock twice on the inside of the glass like a friend's window, and press a palm flat against it, grinning. ` +
      `Warm, playful, wholesome energy. Photoreal, subtle film grain. AUDIO: the scene's natural sound, a warm laugh, two soft knocks on glass.`,
    duration: 5, aspect_ratio: meta.innerAspect, camera_fixed: true, generate_audio: true, seed: 1313,
  };
  if (hasAvatar) innerInputs.reference_images = [params.avatarUrl];
  stages.push({
    id: 'inner_video', layer: 'alive', tool: 'video.seedance',
    purpose: 'THE STORY IN THE FEED: the user’s pre-break scene, ending on the delighted realization.',
    inputs: innerInputs,
    assertions: [{ kind: 'no_artifacts', contract: 'One person; correct five-fingered hand pressing the palm; no morphing or duplicated limbs.' }],
    maxRetries: 1,
  });

  stages.push({
    id: 'ui_composite', layer: 'rigid', tool: 'composite.overlay',
    purpose: 'Pixel-lock the interface with the playing video.',
    inputs: meta.mode === 'chrome'
      ? { base: '{{inner_video}}', overlay: '{{ui_still}}', mode: 'chrome', width: meta.W, height: meta.H, durationSec: 5 }
      : { base: '{{ui_still}}', overlay: '{{inner_video}}', rect: meta.rect, width: meta.W, height: meta.H, durationSec: 5 },
    assertions: [{ kind: 'region_rigid', contract: 'All interface elements (text, icons, buttons, bars) must be pixel-identical between the two frames — zero movement or redraw. Only the video content may change.' }],
    maxRetries: 1,
  });

  stages.push({
    id: 'handoff_frame', layer: 'bridge', tool: 'frame.extract',
    purpose: 'Exact frame the break continues from.',
    inputs: { video: '{{ui_composite}}', position: 'last' },
  });

  stages.push({
    id: 'crack_frame', layer: 'bridge', tool: 'image.kontext',
    purpose: 'Playful cracks appear ON the exact composited frame.',
    inputs: {
      input_image: '{{handoff_frame}}',
      prompt: 'Add a delicate spiderweb of glass cracks radiating outward from the pressed palm, catching the light like a sunburst — sparkly and bright, not menacing. Tiny glints along the crack lines. CHANGE ABSOLUTELY NOTHING ELSE: every interface element, all text and icons, the person’s delighted grin and pose, colors and lighting stay exactly identical.',
      aspect_ratio: meta.canvasAspect,
    },
    assertions: [{ kind: 'identity_hold', referenceKey: 'handoff_frame', contract: 'Identical to the reference except a sparkling glass crack pattern radiating from the palm. Same person, same grin, same interface, same text.' }],
    maxRetries: 2,
  });

  const afterOpening = afterStory
    ? ` As they land, the after-story begins: ${afterStory.slice(0, 220)}.`
    : ' They spread their arms in a big TA-DA grin and brush glittering glass dust off, laughing.';
  stages.push({
    id: 'breakout', layer: 'alive', tool: 'video.seedance',
    purpose: 'THE BREAK: joyful, triumphant emergence.',
    inputs: {
      image: '{{crack_frame}}',
      prompt:
        `Locked-off static camera, zero camera movement — the interface filling the frame stays frozen and rigid. A beat of gleeful anticipation: eyebrows raised at the viewer, cracks spreading with bright little ticks. ` +
        `Then the screen glass bursts outward in a SPARKLING shower — translucent shards catching light like confetti, tumbling with real weight and gravity, glittering as they clatter down. ` +
        `${breakoutStory ? breakoutStory + ' ' : ''}` +
        `They swing a leg over the broken edge like climbing through a friend's window and hop out toward the camera, landing lightly.${afterOpening} ` +
        `Behind them the dead interface stays perfectly still. Bright, joyful, wholesome. AUDIO: bright crystalline pop then cascading glass chimes, a delighted laugh.`,
      duration: 10, aspect_ratio: meta.canvasAspect, camera_fixed: true, generate_audio: true, seed: 991,
    },
    assertions: [
      { kind: 'identity_hold', referenceKey: 'crack_frame', contract: 'Same person climbing out, grinning; surrounding interface matches the reference frame.' },
      { kind: 'physics_plausible', contract: 'Shards behave like glass with mass: directional burst, catching light, falling under gravity.', severity: 'advisory' },
      { kind: 'no_artifacts', contract: 'No morphing face, no malformed limbs during the climb, interface text not turning to gibberish before the break.' },
    ],
    maxRetries: 1,
  });

  // ── Continuation chain: frame-chained after-story clips ────────────────────
  let prev = 'breakout';
  for (let i = 1; i <= afterClips; i++) {
    const frameId = `after_frame_${i}`;
    const clipId = `after_${i}`;
    stages.push({
      id: frameId, layer: 'bridge', tool: 'frame.extract',
      purpose: `Chain frame for after-story clip ${i}.`,
      inputs: { video: `{{${prev}}}`, position: 'last' },
    });
    const beat = afterStory || 'they explore the real world with playful wonder';
    const envLine = i === 1 && afterBackground
      ? `The scene TRANSITIONS: they step forward into a new environment — ${afterBackground} — the camera following naturally as the world changes around them. `
      : '';
    stages.push({
      id: clipId, layer: 'alive', tool: 'video.seedance',
      purpose: `AFTER-STORY clip ${i}/${afterClips}: the story continues via frame chaining.`,
      inputs: {
        image: `{{${frameId}}}`,
        prompt:
          `Continue this exact scene and this exact person seamlessly — same face, same clothes, same lighting at the first frame. ` +
          envLine +
          `Story beat ${i} of ${afterClips}: ${beat}. ` +
          `Joyful, fun, natural motion; cinematic but warm. Photoreal. AUDIO: natural scene sound continuing the moment.`,
        duration: 10, aspect_ratio: meta.canvasAspect, generate_audio: true, seed: 991 + i,
      },
      assertions: [
        { kind: 'identity_hold', referenceKey: frameId, contract: 'Same person, same outfit as the reference frame — this is a direct continuation.' },
        { kind: 'no_artifacts', contract: 'No morphing face or malformed limbs.' },
      ],
      maxRetries: 1,
    });
    prev = clipId;
  }

  // ── Final assembly when there is more than one clip ────────────────────────
  let finalStage = 'breakout';
  if (afterClips > 0) {
    const clipRefs = ['{{breakout}}', ...Array.from({ length: afterClips }, (_, i) => `{{after_${i + 1}}}`)];
    stages.push({
      id: 'final_film', layer: 'rigid', tool: 'composite.concat',
      purpose: 'Stitch the breakout + after-story chain into one film.',
      inputs: { clips: clipRefs, width: meta.W, height: meta.H },
    });
    finalStage = 'final_film';
  }

  const plan: EffectPlan = {
    id: `custom-${params.template}`,
    name: `${BREAKOUT_TEMPLATES_META[params.template].displayName} Breakout`,
    intent: `USER STORY — before: ${preStory.slice(0, 160)} | after: ${(afterStory || 'ta-da ending').slice(0, 160)}`,
    family: 'breakout',
    version: 1,
    stages,
    finalStage,
    timing: { impactStage: 'breakout', impactAtSec: 1.5, sfxOnImpact: 'bright glass pop then chimes' },
  };
  return { plan, costCredits: breakoutCostCredits(afterClips) };
}
