/**
 * CCTV Grid Walk-Across.
 *
 *    container: cctv-grid · violation: reach-through · destination: into-adjacent-ui
 *
 * A subject in one tile of a security-camera multiplex reaches through the
 * boundary of their cell and walks ACROSS into the adjacent CCTV tile.
 */
import type { TemplateDefinition } from "../schema";
import thumb from "@/assets/templates/breakthrough/bt-cctv-grid-walk-across.svg";

const cctvGridWalkAcross: TemplateDefinition = {
  id: "bt-cctv-grid-walk-across",
  name: "CCTV Grid Walk-Across",
  description:
    "A subject in one cell of a security-camera multiplex reaches through the tile boundary and walks across the divider into the adjacent CCTV feed.",
  thumbnailUrl: thumb,

  container: {
    kind: "cctv-grid",
    aspectRatio: "16:9",
    // The active tile: top-left cell of a 3x2 multiplex.
    mediaWindow: { x: 0.02, y: 0.04, width: 0.31, height: 0.44 },
    outerSpace:
      "the rest of the 3x2 security multiplex — five other greyscale camera feeds (corridor, lobby, stairwell, parking, server room) with timestamp overlays and a green REC dot",
  },
  boundaryViolation: "reach-through",
  destination: "into-adjacent-ui",

  prompts: {
    chrome:
      "A 3x2 CCTV security multiplex on a black control-room monitor: six greyscale camera tiles divided by thin cyan grid lines, each with a timestamp + camera-ID overlay and a small green REC dot, slight scanline and VHS noise. Empty feeds. NO person.",
    innerVideo:
      "In the top-left CCTV tile: a person standing in a corridor under harsh overhead light, greyscale low-frame-rate surveillance look, looking up slowly toward the camera, faint scanline flicker.",
    breakthrough:
      "The person REACHES THROUGH the cyan divider line of their tile — the grid line bending and tearing like a seam — and steps sideways across the boundary, their body crossing ABOVE the divider chrome and entering the adjacent tile, picking up that camera's lighting and timestamp as they go. Glitch tearing along the seam.",
    aftermath:
      "The original tile left empty with a torn, flickering grid seam where they crossed; the adjacent tile now shows the figure standing in it, both tiles' timestamps glitching, a cascade of scanline noise rippling across the whole multiplex.",
    negative: "color-accurate skin in source tile, watermark, warped face",
  },

  boundaryMask: {
    // a torn seam along the right edge of the active tile
    shape: "torn",
    region: { x: 0.31, y: 0.04, width: 0.04, height: 0.44 },
    origin: { x: 0.33, y: 0.26 },
    featherPx: 6,
    easing: "ease-out",
  },

  timeline: {
    durationSec: 12,
    breakBeatId: "break",
    beats: [
      { id: "establish", role: "establish", label: "On camera 1", atSec: 0, sfx: "CRT hum, faint room tone" },
      { id: "tension", role: "tension", label: "Reach for the seam", atSec: 3, sfx: "digital glitch stutter rising" },
      { id: "break", role: "break", label: "Tear the divider", atSec: 6, syncToAudioCue: true, sfx: "harsh datamosh tear, signal-corruption burst" },
      { id: "cross", role: "cross", label: "Walk across", atSec: 7.5, sfx: "footsteps with a phase-shifted echo" },
      { id: "aftermath", role: "aftermath", label: "Appears in cam 2", atSec: 9, sfx: "feed re-sync blip" },
      { id: "settle", role: "settle", label: "Noise ripple", atSec: 11, sfx: "scanline wash across all tiles" },
    ],
  },

  aspectRatio: "16:9",
  colorGrade: { primary: "#05080A", secondary: "#19E0C0", accent: "#9AF7E6", label: "Surveillance green" },
  engine: "sora-2",
  qualityTier: "4k-cinema",
  musicMood: "tense-thriller",

  breakTransition: "wipeleft",
  breakTransitionSec: 0.4,

  identity: {
    subject: "person in a dark coat under harsh overhead surveillance light",
    anchors: ["dark trench coat", "messenger bag", "low-frame-rate greyscale look"],
  },
  render: {
    startFrame: "flux-text",
    matting: "birefnet-frames",
    engines: { inner: "sora-2", subject: "runway-gen4", aftermath: "sora-2" },
  },

  tags: ["surveillance", "glitch"],
  useCount: 96400,
};

export default cctvGridWalkAcross;
