/**
 * Social-Feed Breakout — the ORIGINAL effect, refactored into the generator.
 *
 * Was: a hardcoded chrome image + `BREAKOUT_AT = 5` constant + implicit mask in
 * ImmersiveBreakout.tsx. Now: a config object selecting one of each axis.
 *
 *    container: social-feed · violation: climb-out · destination: toward-viewer
 */
import type { TemplateDefinition } from "../schema";
import thumb from "@/assets/templates/breakthrough/bt-social-feed-breakout.svg";

const socialFeedBreakout: TemplateDefinition = {
  id: "bt-social-feed-breakout",
  name: "Social Feed Breakout",
  description:
    "The flagship 4th-wall break, now data-driven. A character trapped inside a social post climbs out through the shattering media window and lunges toward the viewer.",
  thumbnailUrl: thumb,

  container: {
    kind: "social-feed",
    aspectRatio: "9:16",
    // The post's media region — centered, occupying the middle of the feed card.
    mediaWindow: { x: 0.08, y: 0.22, width: 0.84, height: 0.46 },
    outerSpace:
      "the surrounding feed UI — avatar, handle, like/comment/share rail, caption text and the next post peeking below",
  },
  boundaryViolation: "climb-out",
  destination: "toward-viewer",

  prompts: {
    chrome:
      "A pristine vertical social-media feed UI, single post card centered: rounded avatar + handle top-left, three-dot menu top-right, a clean empty media window in the middle, like/comment/share icon rail and caption below. Soft app-grey background, crisp SF-Pro typography, subtle drop shadow. NO people in the chrome.",
    innerVideo:
      "Inside the post's media window: a person in a hoodie, mid-shot, pressing both palms against the glass of the screen from the inside, breath fogging it, eyes locking onto the viewer. Cyan UI rim light. Claustrophobic, slow dolly push-in.",
    breakthrough:
      "The same person SMASHES a hand and shoulder through the media window, glass and UI pixels shattering outward, then climbs fully out of the post card, body crossing ABOVE the feed chrome, lunging toward camera with full-body force. Volumetric dust, cyan-to-white rim light.",
    aftermath:
      "The emptied post card sits cracked with a jagged hole where the media window was; like/comment icons knocked loose and drifting, pixel shards settling onto the caption text, the feed scroll subtly disturbed.",
    negative: "extra limbs, warped face, watermark, text artifacts",
  },

  boundaryMask: {
    shape: "shatter",
    // mask covers the media window; opens from where the hand strikes
    origin: { x: 0.5, y: 0.45 },
    featherPx: 10,
    easing: "ease-in",
  },

  timeline: {
    durationSec: 12,
    breakBeatId: "break",
    beats: [
      { id: "establish", role: "establish", label: "Trapped in the post", atSec: 0 },
      { id: "tension", role: "tension", label: "Pressing the glass", atSec: 3, sfx: "low glass creak, muffled UI hum building" },
      { id: "break", role: "break", label: "Smash through", atSec: 6, syncToAudioCue: true, sfx: "explosive glass shatter, bass impact, pixel-shard tinkle" },
      { id: "cross", role: "cross", label: "Climbing out", atSec: 7, sfx: "whoosh of body lunging past the lens" },
      { id: "aftermath", role: "aftermath", label: "Lunge to viewer", atSec: 9 },
      { id: "settle", role: "settle", label: "Debris settles", atSec: 11, sfx: "glass shards settling, soft UI chime de-tuning" },
    ],
  },

  aspectRatio: "9:16",
  colorGrade: { primary: "#0066FF", secondary: "#FFFFFF", accent: "#00D4FF", label: "Social cyan" },
  engine: "veo-3",
  qualityTier: "4k-cinema",
  musicMood: "trap-banger",

  breakTransition: "dissolve",
  breakTransitionSec: 0.5,

  identity: {
    subject: "young person in a grey hoodie, short dark hair, determined expression",
    anchors: ["grey hoodie with drawstrings", "short dark hair", "silver ring on right hand"],
  },
  render: {
    startFrame: "flux-text",
    matting: "chromakey",
    chromaColor: "#00B140",
    engines: { inner: "veo-3", subject: "runway-gen4", aftermath: "kling-v3" },
  },

  tags: ["flagship", "refactor"],
  useCount: 184200,
};

export default socialFeedBreakout;
