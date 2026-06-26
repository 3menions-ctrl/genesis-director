/**
 * Wanted Poster Peel.
 *
 *    container: wanted-poster · violation: peel · destination: off-screen
 *
 * The outlaw printed on a weathered Old-West WANTED poster peels themselves off
 * the paper like a sticker and steps off-frame into the saloon street.
 */
import type { TemplateDefinition } from "../schema";
import thumb from "@/assets/templates/breakthrough/bt-wanted-poster-peel.svg";

const wantedPosterPeel: TemplateDefinition = {
  id: "bt-wanted-poster-peel",
  name: "Wanted Poster Peel",
  description:
    "The outlaw printed on a weathered WANTED poster peels off the paper from a curling corner like a living sticker, then strides off-frame into the dusty street.",
  thumbnailUrl: thumb,

  container: {
    kind: "wanted-poster",
    aspectRatio: "4:5",
    // The portrait illustration occupies the upper-middle of the poster.
    mediaWindow: { x: 0.22, y: 0.2, width: 0.56, height: 0.44 },
    outerSpace:
      "the weathered saloon wall the poster is nailed to — wood grain, other tattered notices, a hitching post and dusty street beyond the frame edge",
  },
  boundaryViolation: "peel",
  destination: "off-screen",

  prompts: {
    chrome:
      "A weathered Old-West WANTED poster nailed to a saloon's wooden wall: aged cream paper, bold letterpress 'WANTED DEAD OR ALIVE', a sepia ink-illustrated portrait panel in the middle, a reward sum below, torn edges and rusty nails. NO movement.",
    innerVideo:
      "The sepia portrait on the poster: a stern outlaw in a duster coat and hat, rendered in halftone ink, eyes slowly shifting to lock on the viewer, the flat illustration subtly gaining depth and breathing.",
    breakthrough:
      "From the curling top-left corner the outlaw PEELS off the poster like a sticker — the paper portrait lifting into a real three-dimensional figure, sepia ink resolving into full colour and texture as the body separates from the page, then striding sideways off the right edge of frame into the street.",
    aftermath:
      "The poster left with a blank person-shaped void where the portrait was, the curled paper corner flapping, ink smudges trailing off the edge toward where they walked, dust motes in a shaft of light, the reward text now reading as unclaimed.",
    negative: "modern clothing, clean paper, watermark, warped face",
  },

  boundaryMask: {
    shape: "peel",
    // peel originates at the top-left corner of the portrait panel
    origin: { x: 0.24, y: 0.22 },
    featherPx: 6,
    easing: "ease-in-out",
  },

  timeline: {
    durationSec: 12,
    breakBeatId: "break",
    beats: [
      { id: "establish", role: "establish", label: "Nailed to the wall", atSec: 0, sfx: "wind, creaking wood, distant spurs" },
      { id: "tension", role: "tension", label: "Corner curls", atSec: 3, sfx: "paper crackle, peeling adhesive" },
      { id: "break", role: "break", label: "Peel off", atSec: 6, syncToAudioCue: true, sfx: "long sticky paper peel, a low western guitar sting" },
      { id: "cross", role: "cross", label: "Stride off-frame", atSec: 7.5, sfx: "boots on a wooden porch, jingling spurs" },
      { id: "aftermath", role: "aftermath", label: "Empty poster", atSec: 9, sfx: "lone paper corner flapping in wind" },
      { id: "settle", role: "settle", label: "Dust drifts", atSec: 11, sfx: "settling dust, faint saloon piano" },
    ],
  },

  aspectRatio: "4:5",
  colorGrade: { primary: "#2A1C0E", secondary: "#C29B5B", accent: "#F2E2C2", label: "Sepia frontier" },
  engine: "veo-3",
  qualityTier: "4k-cinema",
  musicMood: "vintage-vinyl",

  breakTransition: "dissolve",
  breakTransitionSec: 0.6,

  identity: {
    subject: "stern outlaw in a long duster coat and wide-brim hat",
    anchors: ["brown duster coat", "wide-brim hat", "stubble and scar", "leather gun belt"],
  },
  render: {
    startFrame: "flux-text",
    matting: "chromakey",
    chromaColor: "#1F8A4C",
    engines: { inner: "veo-3", subject: "runway-gen4", aftermath: "kling-v3" },
  },

  tags: ["western", "peel", "paper"],
  useCount: 64800,
};

export default wantedPosterPeel;
