/**
 * Template registry — the unified, rich source of truth.
 *
 * Built from three legacy sources, merged into one rich `TemplateBlueprint[]`:
 *   • 10 Breakout configs (BREAKOUT_TEMPLATES) — already rich, mapped 1:1.
 *   • 40 hardcoded built-ins (was BUILT_IN_TEMPLATES in pages/Templates.tsx)
 *     — enriched with engine + aspect + clips + transitions + grade per mood.
 *   • Crossover VFX rows (in `vfx_templates`) — fetched separately by the
 *     registry's DB enricher (Phase 2). For now this module exports only
 *     the in-memory blueprints.
 *
 * Consumers:
 *   • Templates page card grid
 *   • Template Detail Drawer
 *   • Phase 2: `/create?template=` consumer that pre-populates a project
 */

import type {
  TemplateBlueprint,
  ClipBlueprint,
  TemplateColorGrade,
  PacingStyle,
  MusicMood,
  TemplateCategory,
  VfxPreset,
} from "./blueprint";
import type { TransitionKind, AspectRatio } from "@/lib/editor/types";
import type { EngineId } from "@/lib/video/engines";
import { BREAKOUT_TEMPLATES } from "./breakout-templates";
import { getBreakthroughBlueprints } from "./breakthrough";

// ─── Thumbnails (re-imported here so registry is single source of truth) ────
import viralHookImg from "@/assets/templates/viral-hook.jpg";
import aestheticVlogImg from "@/assets/templates/aesthetic-vlog.jpg";
import transformationImg from "@/assets/templates/transformation.jpg";
import asmrSatisfyingImg from "@/assets/templates/asmr-satisfying.jpg";
import storytimeImg from "@/assets/templates/storytime.jpg";
import documentaryImg from "@/assets/templates/documentary.jpg";
import neoNoirImg from "@/assets/templates/neo-noir.jpg";
import actionMontageImg from "@/assets/templates/action-montage.jpg";
import animeStyleImg from "@/assets/templates/anime-style.jpg";
import productRevealImg from "@/assets/templates/product-reveal.jpg";
import foodLifestyleImg from "@/assets/templates/food-lifestyle.jpg";
import techShowcaseImg from "@/assets/templates/tech-showcase.jpg";
import ugcTestimonialImg from "@/assets/templates/ugc-testimonial.jpg";
import educationalImg from "@/assets/templates/educational.jpg";
import tutorialImg from "@/assets/templates/tutorial.jpg";
import viralSocialImg from "@/assets/templates/viral-social.jpg";
import travelVlogImg from "@/assets/templates/travel-vlog.jpg";
import musicVideoImg from "@/assets/templates/music-video.jpg";
import podcastClipsImg from "@/assets/templates/podcast-clips.jpg";
import brandStoryImg from "@/assets/templates/brand-story.jpg";
import teamIntroImg from "@/assets/templates/team-intro.jpg";
import lectureRecapImg from "@/assets/templates/lecture-recap.jpg";
import microLessonImg from "@/assets/templates/micro-lesson.jpg";
import whiteboardExplainerImg from "@/assets/templates/whiteboard-explainer.jpg";
import languageDrillImg from "@/assets/templates/language-drill.jpg";
import scienceDemoImg from "@/assets/templates/science-demo.jpg";
import courseTrailerImg from "@/assets/templates/course-trailer.jpg";
import examCramImg from "@/assets/templates/exam-cram.jpg";
import postEscapeImg from "@/assets/templates/post-escape.jpg";
import scrollGrabImg from "@/assets/templates/scroll-grab.jpg";
import freezeWalkImg from "@/assets/templates/freeze-walk.jpg";
import realityRipImg from "@/assets/templates/reality-rip.jpg";
import aspectEscapeImg from "@/assets/templates/aspect-escape.jpg";
import mirrorShatterImg from "@/assets/templates/mirror-shatter.jpg";
import canvasEmergeImg from "@/assets/templates/canvas-emerge.jpg";
import billboardLeapImg from "@/assets/templates/billboard-leap.jpg";
import pageBurstImg from "@/assets/templates/page-burst.jpg";
import hologramMaterializeImg from "@/assets/templates/hologram-materialize.jpg";

// ─────────────────────────────────────────────────────────────────────────────
// BREAKOUT MAPPER — maps the 10 BreakoutTemplateConfig rows to blueprints.
// All breakouts share: 3 clips, 4K cinema quality, veo-3 engine (cinematic
// VFX-heavy), `vfx` category, fade→dissolve transitions, trap-banger music.
// ─────────────────────────────────────────────────────────────────────────────
type BreakoutMeta = {
  thumbnail: string;
  useCount: number;
  description: string;
  mood: string;
  category: TemplateCategory;
};
const BREAKOUT_META: Record<string, BreakoutMeta> = {
  "post-escape":          { thumbnail: postEscapeImg,          useCount: 184200, mood: "epic",      category: "trending", description: "Flagship 4th-wall VFX. Avatar trapped inside a social post smashes the glass UI into volumetric shards and steps into reality." },
  "scroll-grab":          { thumbnail: scrollGrabImg,          useCount: 167500, mood: "action",    category: "trending", description: "Most-shared 4th-wall effect. Avatar bulges the screen, grabs the bezel, and pulls themselves out of a vertical feed." },
  "freeze-walk":          { thumbnail: freezeWalkImg,          useCount: 152800, mood: "mysterious",category: "trending", description: "Advanced 2D→3D 4th-wall step-out. Avatar freezes in a live call grid while everyone else keeps moving, then walks into the room." },
  "reality-rip":          { thumbnail: realityRipImg,          useCount: 141300, mood: "epic",      category: "trending", description: "Cinema-grade 4th-wall rupture. Reality tears like fabric and the avatar emerges through a glowing supernova rift." },
  "aspect-escape":        { thumbnail: aspectEscapeImg,        useCount: 128900, mood: "action",    category: "trending", description: "Format-bending 4th-wall move. Avatar shatters the vertical frame and steps into widescreen with cinema lighting." },
  "mirror-shatter":       { thumbnail: mirrorShatterImg,       useCount: 119200, mood: "epic",      category: "trending", description: "Baroque 4th-wall break. Avatar SHATTERS a gilded silvered mirror in a candlelit ballroom and steps onto marble." },
  "canvas-emerge":        { thumbnail: canvasEmergeImg,        useCount: 108700, mood: "mysterious",category: "trending", description: "Museum-grade 4th-wall step-out. Avatar walks out of a Renaissance oil painting with wet pigment dripping off them." },
  "billboard-leap":       { thumbnail: billboardLeapImg,       useCount: 134500, mood: "action",    category: "trending", description: "Blockbuster 4th-wall jump. Avatar LEAPS from a Times Square LED billboard onto a neon-soaked rainy street." },
  "page-burst":           { thumbnail: pageBurstImg,           useCount: 97300,  mood: "epic",      category: "trending", description: "Literary 4th-wall blast. Avatar BURSTS through the page of a giant book in a candlelit library, ink and paper flying." },
  "hologram-materialize": { thumbnail: hologramMaterializeImg, useCount: 112600, mood: "mysterious",category: "trending", description: "Sci-fi 4th-wall arrival. Avatar compressed in a glitching hologram MATERIALIZES into reality on an obsidian plinth." },
};

// Effect-type → VFX presets per clip slot (trap → break → emerge)
const BREAKOUT_VFX: Record<string, [VfxPreset[], VfxPreset[], VfxPreset[]]> = {
  "post-escape":          [["dolly-push-in","depth-blur"],         ["glass-break","volumetric-shatter","dutch-angle","particle-burst"], ["crane-up","low-angle-hero","god-rays"]],
  "scroll-grab":          [["dolly-push-in","neon-rim"],           ["whip-pan","glass-break","particle-burst","chromatic-aberration"],   ["orbit-360","neon-rim"]],
  "freeze-walk":          [["dolly-push-in","desaturate-isolate"], ["tracking-shot","aspect-shift","god-rays"],                          ["dolly-back","warm-grade"]],
  "reality-rip":          [["crane-down","depth-blur"],            ["volumetric-shatter","particle-burst","lens-flare","energy-crackle"], ["low-angle-hero","god-rays","high-contrast"]],
  "aspect-escape":        [["handheld","depth-blur"],              ["whip-pan","glass-break","aspect-shift"],                            ["tracking-shot","teal-orange"]],
  "mirror-shatter":       [["dolly-push-in","warm-grade"],         ["tracking-shot","glass-break","slow-mo-50","god-rays"],              ["crane-up","warm-grade","bokeh"]],
  "canvas-emerge":        [["dolly-push-in","warm-grade"],         ["tracking-shot","ink-bloom","slow-mo-50"],                           ["dolly-back","warm-grade","bokeh"]],
  "billboard-leap":       [["crane-up","neon-cyberpunk"],          ["whip-pan","glass-break","particle-burst","slow-mo-50"],             ["tracking-shot","low-angle-hero","neon-cyberpunk"]],
  "page-burst":           [["dolly-push-in","god-rays","warm-grade"], ["tracking-shot","whip-pan","ink-bloom","god-rays"],               ["dolly-back","warm-grade","bokeh"]],
  "hologram-materialize": [["dolly-push-in","scanline-glitch","cool-grade"], ["volumetric-shatter","particle-burst","lens-flare","chromatic-aberration"], ["tracking-shot","low-angle-hero","cool-grade","neon-rim"]],
};

function buildBreakoutBlueprint(id: string): TemplateBlueprint {
  const cfg  = BREAKOUT_TEMPLATES[id];
  const meta = BREAKOUT_META[id];
  const vfx  = BREAKOUT_VFX[id];

  const clips: ClipBlueprint[] = [
    {
      id: `${id}-clip-1`,
      label: "The Trap",
      prompt: cfg.clip1Prompt,
      durationSec: 5,
      vfxPresets: vfx[0],
      visualElements: cfg.visualElements.slice(0, 2),
      properties: { fadeInSec: 0.4 },
    },
    {
      id: `${id}-clip-2`,
      label: "The Break",
      prompt: cfg.clip2Prompt,
      durationSec: 5,
      vfxPresets: vfx[1],
      visualElements: cfg.visualElements.slice(2, 4),
      properties: { speed: 0.85 }, // slight slow-mo on the break
    },
    {
      id: `${id}-clip-3`,
      label: "The Emergence",
      prompt: cfg.clip3Prompt,
      durationSec: 5,
      vfxPresets: vfx[2],
      visualElements: cfg.visualElements.slice(4),
      properties: { fadeOutSec: 0.6 },
    },
  ];

  const grade: TemplateColorGrade = {
    primary:   cfg.colorPalette.primary,
    secondary: cfg.colorPalette.secondary,
    accent:    cfg.colorPalette.accent,
    label:     `${cfg.name} grade`,
  };

  return {
    id: cfg.id,
    name: cfg.name,
    description: meta.description,
    thumbnailUrl: meta.thumbnail,
    category: meta.category,
    mood: meta.mood,
    genre: "ad",
    tags: ["breakout", "4th-wall", cfg.effectType],
    isFeatured: true,
    isTrending: true,
    isBreakout: true,
    isPro: true,
    useCount: meta.useCount,
    engine: "veo-3",
    qualityTier: "4k-cinema",
    aspectRatio: cfg.aspectRatio,
    clips,
    transitions: ["fade", "dissolve"],
    transitionDurationSec: 0.5,
    colorGrade: grade,
    pacing: "fast",
    playbackSpeed: 1.0,
    musicMood: "trap-banger",
    includeSfx: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ENRICHED BUILT-INS — the 40 non-breakout templates with full blueprints
// ─────────────────────────────────────────────────────────────────────────────

// Compact helper so the per-template definitions stay readable
function clip(
  id: string,
  label: string,
  prompt: string,
  durationSec: number,
  vfxPresets: VfxPreset[] = [],
  extra: Partial<ClipBlueprint> = {},
): ClipBlueprint {
  return { id, label, prompt, durationSec, vfxPresets, ...extra };
}

function grade(primary: string, secondary: string, accent: string, label: string, filter?: string): TemplateColorGrade {
  return { primary, secondary, accent, label, ...(filter ? { filter } : {}) };
}

interface BuiltInArgs {
  id: string;
  name: string;
  description: string;
  thumbnailUrl: string;
  category: TemplateCategory;
  mood: string;
  genre: string;
  useCount: number;
  engine: EngineId;
  aspectRatio: AspectRatio;
  qualityTier?: TemplateBlueprint["qualityTier"];
  pacing: PacingStyle;
  musicMood: MusicMood;
  includeSfx?: boolean;
  clips: ClipBlueprint[];
  transitions?: TransitionKind[];
  transitionDurationSec?: number;
  colorGrade: TemplateColorGrade;
  isFeatured?: boolean;
  isTrending?: boolean;
  isPro?: boolean;
  tags?: string[];
  playbackSpeed?: number;
}
function builtIn(a: BuiltInArgs): TemplateBlueprint {
  return {
    id: a.id,
    name: a.name,
    description: a.description,
    thumbnailUrl: a.thumbnailUrl,
    category: a.category,
    mood: a.mood,
    genre: a.genre,
    tags: a.tags,
    isFeatured: a.isFeatured,
    isTrending: a.isTrending,
    isPro: a.isPro,
    useCount: a.useCount,
    engine: a.engine,
    qualityTier: a.qualityTier ?? "hd-1080",
    aspectRatio: a.aspectRatio,
    clips: a.clips,
    transitions: a.transitions ?? Array(Math.max(0, a.clips.length - 1)).fill("dissolve") as TransitionKind[],
    transitionDurationSec: a.transitionDurationSec ?? 0.4,
    colorGrade: a.colorGrade,
    pacing: a.pacing,
    playbackSpeed: a.playbackSpeed ?? 1.0,
    musicMood: a.musicMood,
    includeSfx: a.includeSfx ?? true,
  };
}

const BUILT_INS: TemplateBlueprint[] = [
  // ── 🔥 TRENDING — Viral & Social ──────────────────────────────
  builtIn({
    id: "viral-hook", name: "Viral Hook Opener",
    description: "Stop-the-scroll hooks that capture attention in 0.5 seconds — three-beat punch with a question, a payoff, a callout.",
    thumbnailUrl: viralHookImg, category: "trending", mood: "action", genre: "vlog",
    useCount: 96400, engine: "seedance-2", aspectRatio: "9:16",
    pacing: "manic", musicMood: "trap-banger", isFeatured: true, isTrending: true,
    colorGrade: grade("#FF2E63", "#08D9D6", "#EAEAEA", "Hot pink + cyan zap"),
    clips: [
      clip("vh-1", "The Hook (0.5s)", "ULTRA-FAST whip-pan onto subject mid-action, eyes locked on camera with question energy. Pure white flash punch-in. Heavy bass drop visual.", 3, ["whip-pan","speed-ramp","particle-burst"], { properties:{ fadeInSec:0.1 } }),
      clip("vh-2", "The Pattern Break", "JUMP-CUT to flipped angle, subject smirking, finger pointing. Sub-frame freeze + Dutch angle. Hot pink + cyan color rim. Captions blasting in.", 5, ["dutch-angle","freeze-frame","chromatic-aberration","neon-rim"]),
      clip("vh-3", "The Payoff CTA", "PUSH-IN tight on subject's eyes locking with viewer, mouthing the punchline, then snap-zoom out to product/CTA card. Confetti burst.", 4, ["dolly-push-in","speed-ramp","particle-burst"], { properties:{ fadeOutSec:0.3 } }),
      clip("vh-4", "The Echo Bumper", "WHIP-PAN exit with a tagline frame and watermark. Wide vignette. Bass-drop echo.", 3, ["whip-pan","high-contrast"], { properties:{ fadeOutSec:0.5 } }),
    ],
    transitions: ["fade", "dissolve", "fade"], transitionDurationSec: 0.25,
  }),
  builtIn({
    id: "aesthetic-vlog", name: "Aesthetic Day-in-Life",
    description: "Dreamy, soft-lit vlogs with that perfect cozy aesthetic. Six gentle beats from morning light to golden hour.",
    thumbnailUrl: aestheticVlogImg, category: "trending", mood: "peaceful", genre: "vlog",
    useCount: 74500, engine: "kling-v3", aspectRatio: "9:16",
    pacing: "slow", musicMood: "lofi-chill", isFeatured: true, isTrending: true,
    colorGrade: grade("#F5E6D8", "#C9A37C", "#8B6F47", "Soft warm vintage"),
    clips: [
      clip("av-1", "Morning light", "Slow DOLLY across sun-streaked bedsheets, dust motes drifting in golden window light. Hand reaching for the curtain.", 6, ["dolly-push-in","warm-grade","bokeh","god-rays"]),
      clip("av-2", "Ritual close-up", "MACRO on coffee being poured, steam curling, light catching the rim of the ceramic cup.", 5, ["depth-blur","warm-grade","slow-mo-50"]),
      clip("av-3", "Street walk", "TRACKING SHOT alongside subject in linen, walking through dappled tree shadows. Soft handheld energy.", 7, ["tracking-shot","handheld","warm-grade","bokeh"]),
      clip("av-4", "Workspace beat", "STATIC overhead on hands typing on a typewriter / journal page, pen scratch, plant casting shadow.", 6, ["depth-blur","warm-grade","vintage-fade"]),
      clip("av-5", "Afternoon stillness", "WIDE on the subject reading near a window, cat curled on the sill, late afternoon haze.", 7, ["bokeh","warm-grade","vintage-fade"]),
      clip("av-6", "Golden hour close", "SLOW PUSH-IN on subject silhouetted against orange sky, hair lit by setting sun.", 7, ["dolly-push-in","warm-grade","god-rays","bokeh"]),
    ],
    transitions: ["dissolve","dissolve","dissolve","dissolve","fade"], transitionDurationSec: 0.6,
  }),
  builtIn({
    id: "transformation", name: "Glow-Up Transformation",
    description: "Dramatic before/after reveal with cinematic transitions. Five beats from raw to radiant with a slow-mo reveal.",
    thumbnailUrl: transformationImg, category: "trending", mood: "uplifting", genre: "vlog",
    useCount: 88700, engine: "seedance-2", aspectRatio: "9:16",
    pacing: "fast", musicMood: "edm-drop", isFeatured: true, isTrending: true,
    colorGrade: grade("#1A1A2E", "#E94560", "#F5F5F5", "Before/after high contrast"),
    clips: [
      clip("tr-1", "The Before", "DESATURATED handheld on subject in raw state, looking down, neutral light, no makeup or styling.", 4, ["handheld","desaturate-isolate","depth-blur"]),
      clip("tr-2", "The Catalyst", "WHIP-PAN through products / preparation montage. Quick cuts on hands, brushes, fabrics catching key light.", 4, ["whip-pan","speed-ramp","particle-burst"]),
      clip("tr-3", "The Build", "TIME-LAPSE / SPEED-RAMP through the styling sequence. Color saturating progressively as the look comes together.", 5, ["speed-ramp","warm-grade"]),
      clip("tr-4", "The Slow-Mo Reveal", "SLOW-MO 25% — subject turns to camera, hair flip catches volumetric light, full glam reveal.", 5, ["slow-mo-25","particle-burst","god-rays","warm-grade"], { properties:{ speed:0.4 } }),
      clip("tr-5", "The Confidence Walk", "TRACKING SHOT, subject walking away with confidence, sunglasses on, frame freeze on final pose.", 5, ["tracking-shot","freeze-frame","high-contrast"]),
    ],
    transitions: ["fade","wipeleft","slideup","circleopen"], transitionDurationSec: 0.35,
  }),
  builtIn({
    id: "asmr-satisfying", name: "Satisfying ASMR",
    description: "Oddly satisfying visuals with calming, hypnotic sequences. Six macro beats of pure tactile pleasure.",
    thumbnailUrl: asmrSatisfyingImg, category: "trending", mood: "peaceful", genre: "ad",
    useCount: 81200, engine: "kling-v3", aspectRatio: "9:16",
    pacing: "slow", musicMood: "ambient-textural", isFeatured: true, isTrending: true,
    colorGrade: grade("#FFE5B4", "#FF9F80", "#FFB6C1", "Pastel candy"),
    clips: [
      clip("as-1", "First touch", "EXTREME MACRO of fingertip pressing into soft surface. Slow-mo deformation, light catching texture.", 4, ["slow-mo-25","depth-blur","bokeh"]),
      clip("as-2", "The cut", "MACRO on a perfect clean cut through soap / kinetic sand / cake. Cross-section reveal.", 4, ["slow-mo-50","depth-blur"]),
      clip("as-3", "The pour", "SLOW-MO of viscous liquid pouring, catching light at the apex, splashing into satisfying circles.", 5, ["slow-mo-25","depth-blur","bokeh"]),
      clip("as-4", "The crush", "OVERHEAD of object being crushed satisfyingly — chalk, foam, glass beads — particle spread.", 4, ["slow-mo-50","particle-burst"]),
      clip("as-5", "The sort", "TIME-LAPSE of objects being perfectly sorted by color / size, hypnotic geometric pattern emerging.", 5, ["speed-ramp","depth-blur"]),
      clip("as-6", "The closing peel", "SLOW-MO peel of a film off a smooth surface, light streaming through translucent layer.", 4, ["slow-mo-25","god-rays","depth-blur"]),
    ],
    transitions: ["dissolve","dissolve","dissolve","dissolve","dissolve"], transitionDurationSec: 0.5,
  }),
  builtIn({
    id: "storytime", name: "Storytime Drama",
    description: "Captivating personal stories with dramatic pauses and reveals. Six beats from setup to twist to closing line.",
    thumbnailUrl: storytimeImg, category: "trending", mood: "emotional", genre: "storytelling",
    useCount: 67300, engine: "kling-v3", aspectRatio: "9:16",
    pacing: "medium", musicMood: "documentary-piano", isFeatured: true, isTrending: true,
    colorGrade: grade("#2D2D2D", "#FFD700", "#F5F5F5", "Intimate amber"),
    clips: [
      clip("st-1", "The Setup", "TIGHT on subject's eyes locking with camera, soft window light. Voice-over: \"So this happened…\"", 6, ["depth-blur","warm-grade","bokeh"]),
      clip("st-2", "The Context", "B-ROLL CUTAWAY — hands fidgeting, coffee cup, framed photo. Soft over-the-shoulder.", 5, ["depth-blur","warm-grade"]),
      clip("st-3", "The Inciting Moment", "JUMP-CUT to slightly tighter angle, subject leans in. Eyes widen on the reveal.", 5, ["depth-blur","high-contrast"]),
      clip("st-4", "The Twist", "DRAMATIC PAUSE — silent close-up, music swells, subject pulls back from camera.", 4, ["freeze-frame","depth-blur","desaturate-isolate"], { properties:{ speed:0.7 } }),
      clip("st-5", "The Reaction", "WIDE PULL-BACK revealing the room. Subject runs hand through hair, exhales.", 5, ["dolly-back","warm-grade","bokeh"]),
      clip("st-6", "The Closing Line", "RACK FOCUS to subject's hands on the table. Final mic-drop line. Slow fade.", 5, ["depth-blur","warm-grade"], { properties:{ fadeOutSec:0.8 } }),
    ],
    transitions: ["dissolve","dissolve","fadeblack","dissolve","fade"], transitionDurationSec: 0.5,
  }),

  // ── 🎬 CINEMATIC ──────────────────────────────────────────────
  builtIn({
    id: "featured-2", name: "Documentary Story",
    description: "Authentic storytelling with intimate interviews and cinematic B-roll. 12 beats, broadcast-grade.",
    thumbnailUrl: documentaryImg, category: "cinematic", mood: "emotional", genre: "documentary",
    useCount: 8200, engine: "veo-3", aspectRatio: "16:9", qualityTier: "4k-cinema",
    pacing: "slow", musicMood: "documentary-piano", isFeatured: true, isPro: true,
    colorGrade: grade("#1E2D3B", "#D4A24C", "#F4E9D8", "Broadcast warm earth"),
    clips: [
      clip("doc-1", "Cold open", "WIDE establishing shot of the subject's environment — landscape, town, factory floor. Natural light, no music.", 7, ["depth-blur","warm-grade","god-rays"]),
      clip("doc-2", "Title beat", "SLOW PUSH-IN on subject's hands working their craft. Title card overlays beneath.", 6, ["dolly-push-in","depth-blur","warm-grade"]),
      clip("doc-3", "Interview A", "MEDIUM TIGHT on subject seated, soft key from left, looking off-camera. Authentic emotion, eyes glistening.", 8, ["depth-blur","warm-grade","bokeh"]),
      clip("doc-4", "B-roll cutaway", "INSERTS — close-ups of hands, tools, photographs on the wall, family heirloom.", 6, ["depth-blur","warm-grade"]),
      clip("doc-5", "Archival photo", "SLOW PUSH on an old photograph, paper texture visible, soft chromatic aberration around frame.", 5, ["dolly-push-in","vintage-fade","chromatic-aberration"]),
      clip("doc-6", "Verite scene", "HANDHELD vérité, subject in the middle of their day, real reactions, no setup lighting.", 7, ["handheld","warm-grade"]),
    ],
    transitions: ["dissolve","dissolve","fade","dissolve","dissolve"], transitionDurationSec: 0.7,
  }),
  builtIn({
    id: "template-noir-1", name: "Neo-Noir Thriller",
    description: "Moody atmospherics with neon-lit shadows and tension. Eight noir-grade beats.",
    thumbnailUrl: neoNoirImg, category: "cinematic", mood: "mysterious", genre: "cinematic",
    useCount: 6400, engine: "sora-2", aspectRatio: "21:9", qualityTier: "4k-cinema",
    pacing: "slow", musicMood: "noir-jazz", isPro: true,
    colorGrade: grade("#0A0F1F", "#FF2E63", "#08D9D6", "Bladerunner neon"),
    clips: [
      clip("nn-1", "Rain on neon", "LOW ANGLE on wet asphalt reflecting neon signs. Slow tilt up to a silhouette under an umbrella.", 6, ["low-angle-hero","neon-cyberpunk","bokeh","depth-blur"]),
      clip("nn-2", "The phone call", "TIGHT on subject's eyes in a phone booth, magenta + cyan rim, smoke curling past lens.", 6, ["depth-blur","neon-rim","chromatic-aberration"]),
      clip("nn-3", "Alley pursuit", "HANDHELD chase down a wet alley, neon flicker, footsteps echoing.", 6, ["handheld","neon-cyberpunk","whip-pan"]),
      clip("nn-4", "The reveal", "SLOW DOLLY-IN on antagonist's face stepping into key light. Dutch angle slight.", 6, ["dolly-push-in","dutch-angle","noir-grade"]),
      clip("nn-5", "Stand-off", "WIDE TWO-SHOT at the end of a neon-lit street, both figures backlit by sodium glow.", 7, ["low-angle-hero","noir-grade","god-rays"]),
      clip("nn-6", "Walk-away close", "TRACKING SHOT, protagonist walking away, neon fades, only silhouette remains.", 6, ["tracking-shot","noir-grade","depth-blur"]),
    ],
    transitions: ["fadeblack","dissolve","fadeblack","dissolve","fadeblack"], transitionDurationSec: 0.8,
  }),
  builtIn({
    id: "template-action-1", name: "Action Montage",
    description: "High-octane sequences with adrenaline-pumping cuts. Six beats of pure motion.",
    thumbnailUrl: actionMontageImg, category: "cinematic", mood: "action", genre: "cinematic",
    useCount: 7800, engine: "seedance-2", aspectRatio: "21:9", qualityTier: "4k-cinema",
    pacing: "manic", musicMood: "edm-drop",
    colorGrade: grade("#0A0A0A", "#FF6B35", "#F7C59F", "Teal & orange"),
    clips: [
      clip("am-1", "The trigger", "FREEZE-FRAME on subject mid-leap, then snap into motion. Cymbal-crash visual.", 4, ["freeze-frame","speed-ramp","particle-burst"]),
      clip("am-2", "The chase", "WHIP-PAN across rooftops, parkour, blur trails behind subject.", 5, ["whip-pan","speed-ramp","chromatic-aberration"]),
      clip("am-3", "The impact", "SLOW-MO 25% on impact moment — debris, particles, expression of effort.", 5, ["slow-mo-25","particle-burst","high-contrast"], { properties:{ speed:0.35 } }),
      clip("am-4", "The recovery", "TRACKING SHOT, subject rising from impact, dust around shoulders. Teal-orange grade.", 5, ["tracking-shot","teal-orange","god-rays"]),
      clip("am-5", "The next threat", "QUICK CUT to incoming threat, Dutch angle. Lens flare across frame.", 4, ["dutch-angle","lens-flare","chromatic-aberration"]),
      clip("am-6", "The hero pose", "LOW ANGLE on subject standing tall, wind, music drop, frame freeze.", 5, ["low-angle-hero","freeze-frame","god-rays","teal-orange"]),
    ],
    transitions: ["fade","wipeleft","fade","wiperight","fade"], transitionDurationSec: 0.25,
  }),
  builtIn({
    id: "anime-style", name: "Anime-Inspired",
    description: "Dynamic anime-style cuts with bold visuals and energy. Eight high-contrast beats.",
    thumbnailUrl: animeStyleImg, category: "cinematic", mood: "epic", genre: "cinematic",
    useCount: 11200, engine: "seedance-2", aspectRatio: "16:9", isTrending: true,
    pacing: "fast", musicMood: "epic-cinematic",
    colorGrade: grade("#FF5E5B", "#FFD93D", "#6BCB77", "Anime cel"),
    clips: [
      clip("an-1", "Wind-up", "DRAMATIC LOW ANGLE on protagonist, hair whipping in wind, eyes glowing. Speed lines.", 5, ["low-angle-hero","speed-ramp","high-contrast"]),
      clip("an-2", "The charge", "WHIP-PAN sprint across landscape, motion blur cels, particle wake.", 5, ["whip-pan","speed-ramp","particle-burst"]),
      clip("an-3", "Power burst", "RADIAL EXPANSION from subject, aura flames, ground shockwave.", 4, ["particle-burst","lens-flare","energy-crackle","high-contrast"]),
      clip("an-4", "Aerial clash", "BIRD'S EYE on two figures clashing mid-air, slow-mo on contact, sparks.", 5, ["slow-mo-25","particle-burst","high-contrast"]),
      clip("an-5", "Ground impact", "WIDE crater impact, dust column, slow-mo debris.", 5, ["slow-mo-50","particle-burst","high-contrast"]),
      clip("an-6", "Final pose", "FREEZE-FRAME on hero pose, cel-shaded outline, title overlay.", 5, ["freeze-frame","high-contrast"]),
    ],
    transitions: ["fade","wipeleft","circleopen","fade","fadewhite"], transitionDurationSec: 0.3,
  }),

  // ── 📺 COMMERCIAL ─────────────────────────────────────────────
  builtIn({
    id: "featured-1", name: "Product Reveal",
    description: "Stunning product showcase with dramatic lighting. Eight beats from tease to hero shot.",
    thumbnailUrl: productRevealImg, category: "commercial", mood: "epic", genre: "ad",
    useCount: 9500, engine: "veo-3", aspectRatio: "16:9", qualityTier: "4k-cinema",
    pacing: "medium", musicMood: "epic-cinematic", isFeatured: true, isPro: true,
    colorGrade: grade("#0F0F0F", "#E8B259", "#FFFFFF", "Premium gold + black"),
    clips: [
      clip("pr-1", "Black void tease", "EXTREME CLOSE on product silhouette emerging from black void. Rim light only.", 5, ["depth-blur","high-contrast","god-rays"]),
      clip("pr-2", "Orbit reveal", "ORBIT 360° around product, key light sweeping, lens flare across logo.", 6, ["orbit-360","lens-flare","high-contrast"]),
      clip("pr-3", "Feature macro", "MACRO close-ups of three signature features — surface texture, button, signature mark.", 6, ["depth-blur","slow-mo-50","bokeh"]),
      clip("pr-4", "Lifestyle context", "TRACKING SHOT of product in real-world hands, soft natural light, intimate.", 6, ["tracking-shot","warm-grade","depth-blur"]),
      clip("pr-5", "Hero stillness", "STATIC perfect frame, dramatic key light, product centered, logo bottom.", 5, ["depth-blur","high-contrast","god-rays"]),
      clip("pr-6", "Call to action", "FADE TO CLEAN BACKDROP with product, CTA + tagline appearing word by word.", 4, ["depth-blur","high-contrast"], { properties:{ fadeOutSec:0.6 } }),
    ],
    transitions: ["fadeblack","dissolve","dissolve","fade","dissolve"], transitionDurationSec: 0.5,
  }),
  builtIn({
    id: "template-food-1", name: "Food & Lifestyle",
    description: "Mouthwatering food cinematography. Six lush beats from prep to plating.",
    thumbnailUrl: foodLifestyleImg, category: "commercial", mood: "uplifting", genre: "ad",
    useCount: 8900, engine: "seedance-2", aspectRatio: "1:1",
    pacing: "medium", musicMood: "warm-uplifting",
    colorGrade: grade("#F4E2C4", "#D97757", "#5A8F3E", "Trattoria warm"),
    clips: [
      clip("ft-1", "Ingredient hero", "OVERHEAD macro on fresh ingredients on marble — herbs, oil drizzle, sea salt scatter.", 5, ["depth-blur","warm-grade","bokeh","slow-mo-50"]),
      clip("ft-2", "Hands at work", "MACRO of hands cutting, kneading, drizzling. Soft directional window light.", 5, ["depth-blur","warm-grade"]),
      clip("ft-3", "The sizzle", "MACRO on pan sizzle, steam rising, golden sear forming. Slow-mo.", 5, ["slow-mo-25","depth-blur","warm-grade"]),
      clip("ft-4", "The plate", "ORBIT around the finished dish, sauce being drizzled, garnish placed.", 5, ["orbit-360","depth-blur","warm-grade"]),
      clip("ft-5", "The first bite", "TIGHT on subject taking the first bite, satisfied eye-close, slow chew.", 5, ["depth-blur","slow-mo-50","warm-grade"]),
      clip("ft-6", "Table wide", "WIDE PULL-BACK revealing full table setting, candles, friends sharing.", 5, ["dolly-back","warm-grade","bokeh"]),
    ],
    transitions: ["dissolve","dissolve","dissolve","dissolve","fade"], transitionDurationSec: 0.5,
  }),
  builtIn({
    id: "template-tech-1", name: "Tech Showcase",
    description: "Sleek product demos with futuristic visuals. Six beats from boot to user flow.",
    thumbnailUrl: techShowcaseImg, category: "commercial", mood: "epic", genre: "ad",
    useCount: 7200, engine: "veo-3", aspectRatio: "16:9", qualityTier: "4k-cinema",
    pacing: "fast", musicMood: "neon-synthwave", isPro: true,
    colorGrade: grade("#0F1024", "#22D3EE", "#FFFFFF", "Sci-fi cyan + ink"),
    clips: [
      clip("tt-1", "Power on", "EXTREME CLOSE on device boot — pixel cascade, scanline reveal, HUD elements coming online.", 4, ["scanline-glitch","neon-rim","particle-burst"]),
      clip("tt-2", "Interface tour", "ORBIT around device, UI elements floating off-screen in 3D space, holographic.", 5, ["orbit-360","scanline-glitch","cool-grade"]),
      clip("tt-3", "Feature 1 demo", "TIGHT on hands using key gesture, particle UI follows touch, slow-mo.", 5, ["slow-mo-50","scanline-glitch","neon-rim"]),
      clip("tt-4", "Speed showcase", "TIME-LAPSE / speed-ramp of multi-step workflow happening in seconds.", 5, ["speed-ramp","scanline-glitch"]),
      clip("tt-5", "Cinematic hero", "WIDE on device in dramatic environment, key light sweeping, signature glow.", 5, ["dolly-push-in","god-rays","cool-grade"]),
      clip("tt-6", "Logo lock-up", "FADE to clean backdrop with device + logo + tagline. Subtle HUD lines fading in.", 4, ["scanline-glitch","cool-grade"]),
    ],
    transitions: ["wipeleft","dissolve","slideup","wiperight","fade"], transitionDurationSec: 0.3,
  }),
  builtIn({
    id: "ugc-testimonial", name: "UGC Testimonial",
    description: "Authentic user-generated style testimonials. Four casual phone-shot beats.",
    thumbnailUrl: ugcTestimonialImg, category: "commercial", mood: "uplifting", genre: "ad",
    useCount: 13400, engine: "kling-v3", aspectRatio: "9:16", isTrending: true,
    pacing: "fast", musicMood: "warm-uplifting",
    colorGrade: grade("#F5F5F5", "#FF6B6B", "#4ECDC4", "Bright friendly"),
    clips: [
      clip("ug-1", "Selfie hook", "HANDHELD selfie angle, subject excited, casual room background.", 4, ["handheld","warm-grade","bokeh"]),
      clip("ug-2", "Product reveal", "PHONE-STYLE quick pan to product in hand, real-world context.", 5, ["handheld","warm-grade"]),
      clip("ug-3", "Reaction story", "SLIGHT ZOOM-IN, subject telling story, natural laughter, eye contact with camera.", 6, ["handheld","warm-grade","depth-blur"]),
      clip("ug-4", "Recommendation", "TIGHT on subject pointing at camera, smiling, recommendation line, then waving off.", 4, ["handheld","warm-grade"]),
    ],
    transitions: ["fade","fade","fade"], transitionDurationSec: 0.2,
  }),

  // ── 📚 EDUCATIONAL ────────────────────────────────────────────
  builtIn({
    id: "template-edu-1", name: "Educational Breakdown",
    description: "Visual explainers that make complex topics simple. Eight didactic beats.",
    thumbnailUrl: educationalImg, category: "educational", mood: "uplifting", genre: "educational",
    useCount: 5600, engine: "wan-25", aspectRatio: "16:9",
    pacing: "medium", musicMood: "lofi-chill",
    colorGrade: grade("#1E3A5F", "#FFB627", "#F5F5F5", "Classroom blue + ochre"),
    clips: [
      clip("ed-1", "Big question hook", "STATIC on instructor framed by chalkboard, asking the question to camera.", 6, ["depth-blur","warm-grade"]),
      clip("ed-2", "Concept intro", "GRAPHIC OVERLAY animation introducing the core concept with labelled diagram.", 6, ["ui-overlay","depth-blur"]),
      clip("ed-3", "Real-world example", "B-ROLL of real example illustrating the concept, instructor voice-over.", 6, ["warm-grade","bokeh"]),
      clip("ed-4", "Mechanism demo", "WHITEBOARD-STYLE animation showing how/why the concept works step by step.", 7, ["ui-overlay"]),
      clip("ed-5", "Common mistake", "INSTRUCTOR shake of head with overlay of wrong approach crossed out.", 5, ["depth-blur","ui-overlay"]),
      clip("ed-6", "Application + recap", "INSTRUCTOR with summary card overlay, three bullets fading in.", 6, ["depth-blur","ui-overlay"]),
    ],
    transitions: ["fade","dissolve","fade","dissolve","fade"], transitionDurationSec: 0.4,
  }),
  builtIn({
    id: "how-to-tutorial", name: "Step-by-Step Tutorial",
    description: "Clear, engaging how-to guides with visual steps. Six demo beats.",
    thumbnailUrl: tutorialImg, category: "educational", mood: "uplifting", genre: "educational",
    useCount: 8100, engine: "kling-v3", aspectRatio: "16:9",
    pacing: "medium", musicMood: "lofi-chill",
    colorGrade: grade("#FFFFFF", "#FF6B6B", "#4ECDC4", "Clean tutorial"),
    clips: [
      clip("ht-1", "What you'll make", "WIDE on the finished result, satisfying reveal. Instructor voice-over preview.", 5, ["depth-blur","warm-grade"]),
      clip("ht-2", "Tools + ingredients", "OVERHEAD layout of all tools/ingredients labelled, satisfying arrangement.", 6, ["depth-blur"]),
      clip("ht-3", "Step 1 — Setup", "INSTRUCTOR demonstrating first step, hands in frame, clear angle.", 6, ["depth-blur"]),
      clip("ht-4", "Step 2 — Build", "TRACKING SHOT through building / assembling, time-lapse if appropriate.", 6, ["tracking-shot","speed-ramp"]),
      clip("ht-5", "Step 3 — Refine", "MACRO on the finishing touches, careful detail work.", 5, ["depth-blur","bokeh"]),
      clip("ht-6", "Final reveal + CTA", "WIDE on the finished result again, satisfying close, like/sub overlay.", 5, ["warm-grade","ui-overlay"]),
    ],
    transitions: ["fade","wipeleft","wiperight","dissolve","fade"], transitionDurationSec: 0.35,
  }),
  builtIn({
    id: "lecture-recap", name: "Lecture Recap",
    description: "2-minute recap of a long lecture: hook, four chapter beats, takeaway payoff.",
    thumbnailUrl: lectureRecapImg, category: "educational", mood: "uplifting", genre: "educational",
    useCount: 4720, engine: "wan-25", aspectRatio: "16:9",
    pacing: "fast", musicMood: "documentary-piano",
    colorGrade: grade("#22272E", "#F7C59F", "#FFFFFF", "Library lamp"),
    clips: [
      clip("lr-1", "Hook", "STATIC tight on instructor with hook question, eye contact.", 5, ["depth-blur","warm-grade"]),
      clip("lr-2", "Chapter 1", "SPLIT-SCREEN title + B-roll illustrating chapter 1's key point.", 5, ["split-screen","warm-grade"]),
      clip("lr-3", "Chapter 2", "SPLIT-SCREEN title + B-roll illustrating chapter 2.", 5, ["split-screen","warm-grade"]),
      clip("lr-4", "Chapter 3", "SPLIT-SCREEN title + B-roll illustrating chapter 3.", 5, ["split-screen","warm-grade"]),
      clip("lr-5", "Chapter 4", "SPLIT-SCREEN title + B-roll illustrating chapter 4.", 5, ["split-screen","warm-grade"]),
      clip("lr-6", "Takeaway payoff", "INSTRUCTOR back to tight, single takeaway line, lock-up card.", 5, ["depth-blur","warm-grade"]),
    ],
    transitions: ["fade","wiperight","wiperight","wiperight","fade"], transitionDurationSec: 0.3,
  }),
  builtIn({
    id: "micro-lesson", name: "Micro-Lesson",
    description: "60-second single-concept lesson in 4 beats: hook, teach, example, payoff.",
    thumbnailUrl: microLessonImg, category: "educational", mood: "uplifting", genre: "educational",
    useCount: 6310, engine: "wan-25", aspectRatio: "9:16",
    pacing: "fast", musicMood: "lofi-chill",
    colorGrade: grade("#F2F2F2", "#FF6B6B", "#4ECDC4", "Bright pop"),
    clips: [
      clip("ml-1", "Hook question", "TIGHT on instructor, single bold question to camera.", 4, ["depth-blur","warm-grade"]),
      clip("ml-2", "The teach", "WHITEBOARD animation of the concept being built live.", 5, ["ui-overlay"]),
      clip("ml-3", "Example", "B-ROLL of the concept applied in the real world.", 4, ["depth-blur","warm-grade"]),
      clip("ml-4", "Payoff CTA", "INSTRUCTOR back, summary card, save-this prompt.", 4, ["depth-blur","ui-overlay"]),
    ],
    transitions: ["wipeleft","wipeleft","fade"], transitionDurationSec: 0.25,
  }),
  builtIn({
    id: "whiteboard-explainer", name: "Whiteboard Explainer",
    description: "2-minute hand-drawn breakdown: hook, four diagram beats, summary payoff.",
    thumbnailUrl: whiteboardExplainerImg, category: "educational", mood: "uplifting", genre: "educational",
    useCount: 3980, engine: "wan-25", aspectRatio: "16:9",
    pacing: "medium", musicMood: "lofi-chill",
    colorGrade: grade("#FFFFFF", "#1A1A1A", "#FF6B35", "Whiteboard ink"),
    clips: [
      clip("wb-1", "Title draw", "HAND-DRAWN title appears on whiteboard, marker squeak.", 4, ["ui-overlay"]),
      clip("wb-2", "Diagram 1", "FIRST diagram being drawn live with labels.", 6, ["ui-overlay","speed-ramp"]),
      clip("wb-3", "Diagram 2", "SECOND diagram building on the first.", 6, ["ui-overlay","speed-ramp"]),
      clip("wb-4", "Diagram 3", "THIRD diagram with arrows + connections.", 6, ["ui-overlay","speed-ramp"]),
      clip("wb-5", "Diagram 4", "FOURTH diagram completes the model.", 6, ["ui-overlay","speed-ramp"]),
      clip("wb-6", "Summary box", "BOX drawn around the key takeaway in red marker.", 4, ["ui-overlay"]),
    ],
    transitions: ["dissolve","dissolve","dissolve","dissolve","fade"], transitionDurationSec: 0.35,
  }),
  builtIn({
    id: "language-drill", name: "Language Drill",
    description: "60-second vocab drill in 5 beats: hook word, three reps, recall payoff.",
    thumbnailUrl: languageDrillImg, category: "educational", mood: "uplifting", genre: "educational",
    useCount: 5210, engine: "wan-25", aspectRatio: "9:16",
    pacing: "fast", musicMood: "lofi-chill",
    colorGrade: grade("#1A1A40", "#FFD93D", "#FF6B6B", "Drill notebook"),
    clips: [
      clip("ld-1", "Hook word", "BIG TEXT overlay of the target word with phonetic, voiceover pronunciation.", 4, ["ui-overlay","particle-burst"]),
      clip("ld-2", "Rep 1 — context", "B-ROLL example using the word in context.", 5, ["warm-grade","depth-blur"]),
      clip("ld-3", "Rep 2 — repeat", "REPEAT prompt with subtitle, viewer says aloud.", 4, ["ui-overlay"]),
      clip("ld-4", "Rep 3 — translate", "FLASH-CARD reveal animation, word translated.", 4, ["ui-overlay","speed-ramp"]),
      clip("ld-5", "Recall payoff", "FINAL prompt: recall the word, count-down timer, then reveal.", 5, ["ui-overlay","particle-burst"]),
    ],
    transitions: ["wipeleft","fade","wipeleft","fade"], transitionDurationSec: 0.25,
  }),
  builtIn({
    id: "science-demo", name: "Science Demo",
    description: "3-minute cinematic experiment in 8 beats: setup, six macro reactions, slow-mo payoff.",
    thumbnailUrl: scienceDemoImg, category: "educational", mood: "epic", genre: "educational",
    useCount: 4640, engine: "kling-v3", aspectRatio: "16:9", qualityTier: "4k-cinema",
    pacing: "medium", musicMood: "epic-cinematic",
    colorGrade: grade("#0E1E2A", "#22D3EE", "#FFD93D", "Lab cyan + warning"),
    clips: [
      clip("sd-1", "Apparatus setup", "WIDE on the lab bench, all apparatus labelled, instructor adjusting.", 6, ["depth-blur","cool-grade"]),
      clip("sd-2", "Reaction 1", "MACRO of the first reaction beginning, color change.", 6, ["slow-mo-50","depth-blur","bokeh"]),
      clip("sd-3", "Reaction 2", "MACRO of bubbles / smoke / glow from second reaction.", 6, ["slow-mo-50","depth-blur","cool-grade"]),
      clip("sd-4", "Reaction 3", "MACRO of crystal / precipitate forming.", 6, ["slow-mo-25","depth-blur"]),
      clip("sd-5", "Reaction 4", "MACRO of explosion / sudden burst at high speed.", 6, ["slow-mo-25","particle-burst","high-contrast"]),
      clip("sd-6", "Slow-mo payoff", "EXTREME SLOW-MO 25% of the climax reaction. Drops, particles, motion.", 6, ["slow-mo-25","particle-burst","god-rays"], { properties:{ speed:0.3 } }),
    ],
    transitions: ["dissolve","dissolve","dissolve","dissolve","fadewhite"], transitionDurationSec: 0.5,
  }),
  builtIn({
    id: "course-trailer", name: "Course Trailer",
    description: "60-second sales trailer in 5 beats: hook promise, three module previews, CTA payoff.",
    thumbnailUrl: courseTrailerImg, category: "educational", mood: "epic", genre: "educational",
    useCount: 3870, engine: "seedance-2", aspectRatio: "16:9",
    pacing: "fast", musicMood: "epic-cinematic",
    colorGrade: grade("#0F0F23", "#7C3AED", "#F59E0B", "Sales premium"),
    clips: [
      clip("ct-1", "Hook promise", "EPIC PUSH-IN on instructor with bold promise to camera, music drop.", 4, ["dolly-push-in","particle-burst","high-contrast"]),
      clip("ct-2", "Module 1 preview", "QUICK CUT through module 1 highlights with overlay.", 5, ["whip-pan","ui-overlay","speed-ramp"]),
      clip("ct-3", "Module 2 preview", "QUICK CUT through module 2 highlights.", 5, ["whip-pan","ui-overlay","speed-ramp"]),
      clip("ct-4", "Module 3 preview", "QUICK CUT through module 3 highlights, building energy.", 5, ["whip-pan","ui-overlay","speed-ramp"]),
      clip("ct-5", "CTA payoff", "INSTRUCTOR back, calm, single CTA line + price / enroll card.", 5, ["depth-blur","ui-overlay"]),
    ],
    transitions: ["fade","wipeleft","wipeleft","wipeleft","fade"], transitionDurationSec: 0.25,
  }),
  builtIn({
    id: "exam-cram", name: "Exam Cram Sheet",
    description: "2-minute rapid review in 7 beats: hook, five must-know facts, recall payoff.",
    thumbnailUrl: examCramImg, category: "educational", mood: "uplifting", genre: "educational",
    useCount: 7090, engine: "wan-25", aspectRatio: "9:16", isTrending: true,
    pacing: "fast", musicMood: "edm-drop",
    colorGrade: grade("#0F172A", "#F59E0B", "#FFFFFF", "Highlighter focus"),
    clips: [
      clip("ec-1", "Hook stakes", "TIGHT on instructor: \"Five things you MUST know.\" Timer overlay 2:00.", 4, ["depth-blur","ui-overlay"]),
      clip("ec-2", "Fact 1", "BIG OVERLAY of fact 1 with quick B-roll, voice-over delivers it.", 5, ["ui-overlay","speed-ramp"]),
      clip("ec-3", "Fact 2", "BIG OVERLAY of fact 2 with quick B-roll.", 5, ["ui-overlay","speed-ramp"]),
      clip("ec-4", "Fact 3", "BIG OVERLAY of fact 3.", 5, ["ui-overlay","speed-ramp"]),
      clip("ec-5", "Fact 4", "BIG OVERLAY of fact 4.", 5, ["ui-overlay","speed-ramp"]),
      clip("ec-6", "Fact 5", "BIG OVERLAY of fact 5.", 5, ["ui-overlay","speed-ramp"]),
      clip("ec-7", "Recall test", "TIMER countdown, recall prompt, then reveal of all 5 facts as a card.", 5, ["ui-overlay","particle-burst"]),
    ],
    transitions: ["wipeleft","wipeleft","wipeleft","wipeleft","wipeleft","fade"], transitionDurationSec: 0.2,
  }),

  // ── 🎉 ENTERTAINMENT ──────────────────────────────────────────
  builtIn({
    id: "featured-3", name: "Viral Social Content",
    description: "Hook-driven content for TikTok & Reels. Five fast beats designed to retain to the last frame.",
    thumbnailUrl: viralSocialImg, category: "entertainment", mood: "uplifting", genre: "vlog",
    useCount: 16800, engine: "seedance-2", aspectRatio: "9:16", isFeatured: true,
    pacing: "manic", musicMood: "trap-banger",
    colorGrade: grade("#FF006E", "#FFBE0B", "#3A86FF", "Pop candy"),
    clips: [
      clip("vs-1", "0.5s hook", "INSTANT punch-in on subject, eyes wide, question/setup in 1 line.", 3, ["whip-pan","speed-ramp","particle-burst"]),
      clip("vs-2", "The tease", "QUICK CUT to action that hints at the payoff, fast motion.", 4, ["whip-pan","chromatic-aberration","speed-ramp"]),
      clip("vs-3", "The buildup", "MONTAGE of preparation, music building, anticipation.", 5, ["speed-ramp","particle-burst","high-contrast"]),
      clip("vs-4", "The payoff", "SLOW-MO 25% on the punchline moment, satisfying reveal.", 5, ["slow-mo-25","particle-burst","high-contrast"]),
      clip("vs-5", "The CTA loop", "FREEZE-FRAME on subject's smug expression, watch-again prompt.", 3, ["freeze-frame","high-contrast"]),
    ],
    transitions: ["fade","wipeleft","fade","fade"], transitionDurationSec: 0.2,
  }),
  builtIn({
    id: "template-travel-1", name: "Travel Vlog",
    description: "Wanderlust-inducing journeys with stunning landscapes. Eight beats from arrival to departure.",
    thumbnailUrl: travelVlogImg, category: "entertainment", mood: "uplifting", genre: "vlog",
    useCount: 11200, engine: "veo-3", aspectRatio: "16:9", qualityTier: "4k-cinema",
    pacing: "medium", musicMood: "warm-uplifting", isPro: true,
    colorGrade: grade("#0EA5E9", "#F59E0B", "#FFFFFF", "Wanderlust sky"),
    clips: [
      clip("tv-1", "Arrival cold open", "AERIAL DRONE flyover of the destination at golden hour.", 7, ["dolly-push-in","warm-grade","god-rays"]),
      clip("tv-2", "First impression", "HANDHELD POV stepping into a market / street / lobby. Real ambient sound.", 6, ["handheld","warm-grade","bokeh"]),
      clip("tv-3", "Hero location 1", "WIDE on iconic landmark with subject silhouette in foreground.", 6, ["dolly-back","warm-grade"]),
      clip("tv-4", "Food / culture beat", "MACRO on local food being prepared, hands, steam, color.", 6, ["depth-blur","warm-grade","bokeh"]),
      clip("tv-5", "Hero location 2", "TRACKING SHOT through a unique environment — temple, alley, dune.", 6, ["tracking-shot","warm-grade"]),
      clip("tv-6", "Golden hour reflection", "WIDE on subject watching sunset, voice-over reflection.", 6, ["dolly-back","warm-grade","god-rays","bokeh"]),
    ],
    transitions: ["dissolve","fade","dissolve","fade","fade"], transitionDurationSec: 0.6,
  }),
  builtIn({
    id: "template-music-1", name: "Music Video",
    description: "Rhythm-synced visuals with artistic flair. Ten beats cut to a 4-on-the-floor BPM grid.",
    thumbnailUrl: musicVideoImg, category: "entertainment", mood: "epic", genre: "cinematic",
    useCount: 9400, engine: "sora-2", aspectRatio: "21:9", qualityTier: "4k-cinema",
    pacing: "fast", musicMood: "edm-drop", isPro: true,
    colorGrade: grade("#0F0F1E", "#E11D48", "#22D3EE", "Rave magenta + cyan"),
    clips: [
      clip("mv-1", "Intro mood", "WIDE on artist silhouette against haze, beat hinted.", 5, ["depth-blur","neon-cyberpunk","god-rays"]),
      clip("mv-2", "First verse — performance", "TIGHT on lips/eyes performing first lines. Color rim.", 5, ["depth-blur","neon-rim"]),
      clip("mv-3", "B-roll metaphor 1", "ABSTRACT b-roll matching lyric — water, fire, neon.", 5, ["slow-mo-50","neon-cyberpunk"]),
      clip("mv-4", "Pre-chorus build", "QUICK CUTS escalating energy, light tempo flicker.", 5, ["whip-pan","speed-ramp","particle-burst"]),
      clip("mv-5", "Chorus drop", "EXPLOSIVE wide of full performance, particles, lens flares.", 6, ["particle-burst","lens-flare","high-contrast","neon-cyberpunk"]),
      clip("mv-6", "Second verse — texture", "B-ROLL textures + tighter performance cuts.", 5, ["slow-mo-50","neon-rim"]),
      clip("mv-7", "Breakdown", "SLOW-MO on artist mid-movement, suspended.", 5, ["slow-mo-25","depth-blur","god-rays"]),
      clip("mv-8", "Final drop", "ALL-OUT performance + crowd / lights / motion.", 6, ["whip-pan","particle-burst","lens-flare"]),
      clip("mv-9", "Closing image", "WIDE on artist walking away into the light, lens flare.", 5, ["dolly-back","god-rays","lens-flare"]),
    ],
    transitions: ["dissolve","wipeleft","fade","fadewhite","dissolve","slideleft","fade","fade"], transitionDurationSec: 0.3,
  }),
  builtIn({
    id: "podcast-clips", name: "Podcast Clips",
    description: "Engaging podcast highlights with captions. Three tight beats with subtitle pop.",
    thumbnailUrl: podcastClipsImg, category: "entertainment", mood: "uplifting", genre: "educational",
    useCount: 7600, engine: "wan-25", aspectRatio: "9:16",
    pacing: "fast", musicMood: "lofi-chill",
    colorGrade: grade("#1F2937", "#FBBF24", "#FFFFFF", "Podcast lamp"),
    clips: [
      clip("pc-1", "The setup", "MEDIUM 2-SHOT of host + guest, subtitle pops in word by word.", 8, ["depth-blur","ui-overlay","warm-grade"]),
      clip("pc-2", "The punchline", "TIGHT ZOOM on guest mid-laugh, subtitle highlights the punch.", 6, ["dolly-push-in","ui-overlay","warm-grade"]),
      clip("pc-3", "The button", "BACK to 2-shot, host nods, freeze-frame on \"Catch the full ep ↓\".", 6, ["freeze-frame","ui-overlay","warm-grade"]),
    ],
    transitions: ["fade","fade"], transitionDurationSec: 0.25,
  }),

  // ── 💼 CORPORATE ──────────────────────────────────────────────
  builtIn({
    id: "template-corp-1", name: "Brand Story",
    description: "Premium corporate narratives that humanize brands. Eight beats from origin to vision.",
    thumbnailUrl: brandStoryImg, category: "corporate", mood: "uplifting", genre: "corporate",
    useCount: 6800, engine: "veo-3", aspectRatio: "16:9", qualityTier: "4k-cinema",
    pacing: "slow", musicMood: "orchestral-emotional", isPro: true,
    colorGrade: grade("#1E293B", "#F59E0B", "#F5F5F5", "Premium brand earth"),
    clips: [
      clip("bs-1", "Origin shot", "ARCHIVAL-feel macro on the founder's hands / first product / first office.", 6, ["depth-blur","vintage-fade","warm-grade"]),
      clip("bs-2", "Founder interview", "MEDIUM CLOSE on founder seated, soft natural light, looking off-camera.", 7, ["depth-blur","warm-grade","bokeh"]),
      clip("bs-3", "Team in motion", "TRACKING SHOT through the office, team working, hands collaborating.", 6, ["tracking-shot","warm-grade","depth-blur"]),
      clip("bs-4", "Customer impact", "TIGHT on a real customer using the product / service, candid joy.", 7, ["depth-blur","warm-grade"]),
      clip("bs-5", "Craft macro", "MACRO on the product being made — hands, tools, signature detail.", 6, ["depth-blur","slow-mo-50","warm-grade"]),
      clip("bs-6", "Vision close", "WIDE on the team, then push-in on the founder. Brand logo lock-up.", 6, ["dolly-push-in","warm-grade","god-rays"]),
    ],
    transitions: ["dissolve","fade","dissolve","dissolve","fadewhite"], transitionDurationSec: 0.7,
  }),
  builtIn({
    id: "team-intro", name: "Team Introduction",
    description: "Professional team showcases with personality. Six beats — one per role with a group close.",
    thumbnailUrl: teamIntroImg, category: "corporate", mood: "uplifting", genre: "corporate",
    useCount: 4200, engine: "kling-v3", aspectRatio: "16:9",
    pacing: "medium", musicMood: "warm-uplifting",
    colorGrade: grade("#F5F5F5", "#3B82F6", "#F59E0B", "Modern team blue"),
    clips: [
      clip("ti-1", "Welcome wide", "WIDE on the full team in office space, then push-in.", 5, ["dolly-push-in","warm-grade","depth-blur"]),
      clip("ti-2", "Role 1", "MEDIUM on team member 1 at their desk, name + role caption.", 5, ["depth-blur","ui-overlay","warm-grade"]),
      clip("ti-3", "Role 2", "MEDIUM on team member 2 in their flow, caption.", 5, ["depth-blur","ui-overlay","warm-grade"]),
      clip("ti-4", "Role 3", "MEDIUM on team member 3, candid expression.", 5, ["depth-blur","ui-overlay","warm-grade"]),
      clip("ti-5", "Role 4", "MEDIUM on team member 4 collaborating.", 5, ["depth-blur","ui-overlay","warm-grade"]),
      clip("ti-6", "Group close", "WIDE on team together, laughter, then close-up on team logo lock-up.", 5, ["dolly-back","warm-grade","bokeh"]),
    ],
    transitions: ["wipeleft","wipeleft","wipeleft","wipeleft","fade"], transitionDurationSec: 0.35,
  }),
];

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────
const BREAKOUT_IDS = [
  "post-escape","scroll-grab","freeze-walk","reality-rip","aspect-escape",
  "mirror-shatter","canvas-emerge","billboard-leap","page-burst","hologram-materialize",
] as const;

const BREAKOUT_BLUEPRINTS: TemplateBlueprint[] = BREAKOUT_IDS.map(buildBreakoutBlueprint);

/** Data-driven Breakthrough Effects (container × violation × destination),
 *  resolved into blueprints so they render through the same clips pipeline. */
const BREAKTHROUGH_BLUEPRINTS: TemplateBlueprint[] = getBreakthroughBlueprints();

export const TEMPLATE_BLUEPRINTS: TemplateBlueprint[] = [
  ...BREAKOUT_BLUEPRINTS,
  ...BREAKTHROUGH_BLUEPRINTS,
  ...BUILT_INS,
];

export function getAllTemplateBlueprints(): TemplateBlueprint[] {
  return TEMPLATE_BLUEPRINTS;
}

export function getTemplateBlueprint(id: string): TemplateBlueprint | undefined {
  return TEMPLATE_BLUEPRINTS.find((b) => b.id === id);
}

/** All breakout blueprints — useful when a surface wants the VFX row only. */
export function getBreakoutBlueprints(): TemplateBlueprint[] {
  return BREAKOUT_BLUEPRINTS;
}
