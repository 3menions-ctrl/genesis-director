/**
 * Home Screen Fold-Out.
 *
 *    container: app-icon-home · violation: fold-to-3d · destination: into-outer-space
 *
 * A single app icon on a phone home screen unfolds origami-style into a 3D
 * object that lifts off the grid and recedes up into a starfield.
 */
import type { TemplateDefinition } from "../schema";
import thumb from "@/assets/templates/breakthrough/bt-home-screen-fold-out.svg";

const homeScreenFoldOut: TemplateDefinition = {
  id: "bt-home-screen-fold-out",
  name: "Home Screen Fold-Out",
  description:
    "One app icon on the home screen unfolds origami-style into a glowing 3D craft that lifts off the icon grid and recedes up into outer space.",
  thumbnailUrl: thumb,

  container: {
    kind: "app-icon-home",
    aspectRatio: "9:16",
    // The single hero icon — second row, centre of the grid.
    mediaWindow: { x: 0.38, y: 0.34, width: 0.24, height: 0.135 },
    outerSpace:
      "the rest of the home screen — wallpaper, the icon grid, the dock — and, once the camera tilts up, a deep starfield the object flies into",
  },
  boundaryViolation: "fold-to-3d",
  destination: "into-outer-space",

  prompts: {
    chrome:
      "A phone home screen: a soft gradient wallpaper, a tidy grid of rounded-square app icons with labels, a dock of four icons at the bottom, status bar with clock and battery. One hero icon in the centre glows faintly. NO 3D objects.",
    innerVideo:
      "Close on the single hero app icon: its rounded-square face subtly rippling, its glyph pulsing with light, edges catching a rim glow, as if pressurised from within and about to unfold.",
    breakthrough:
      "The hero icon FOLDS OUT of its flat square — panels unfolding origami-style into a glowing three-dimensional craft that rises off the icon grid, the camera tilting up to follow as it accelerates away from the phone surface and shrinks into a deep starfield.",
    aftermath:
      "An empty rounded-square hole left in the icon grid where the app was, neighbouring icons sliding to fill the gap, a faint vapour trail and shrinking point of light receding into the stars, the wallpaper rippling once and going still.",
    negative: "flat 2D only, watermark, distorted UI text",
  },

  boundaryMask: {
    shape: "polygon",
    // the icon's rounded-square footprint as a simple quad (normalized)
    points: [
      { x: 0.38, y: 0.34 },
      { x: 0.62, y: 0.34 },
      { x: 0.62, y: 0.475 },
      { x: 0.38, y: 0.475 },
    ],
    origin: { x: 0.5, y: 0.4 },
    featherPx: 4,
    easing: "ease-in",
  },

  timeline: {
    durationSec: 12,
    breakBeatId: "break",
    beats: [
      { id: "establish", role: "establish", label: "Home screen", atSec: 0, sfx: "soft UI ambience, single icon chime" },
      { id: "tension", role: "tension", label: "Icon pressurises", atSec: 3, sfx: "rising power-up whine" },
      { id: "break", role: "break", label: "Fold out", atSec: 6, syncToAudioCue: true, sfx: "origami unfolding clicks into a thruster ignition" },
      { id: "cross", role: "cross", label: "Lift off", atSec: 7.5, sfx: "rocket whoosh dopplering away" },
      { id: "aftermath", role: "aftermath", label: "Into the stars", atSec: 9, sfx: "fading engine, cosmic shimmer" },
      { id: "settle", role: "settle", label: "Grid heals", atSec: 11, sfx: "icons sliding, soft settle tick" },
    ],
  },

  aspectRatio: "9:16",
  colorGrade: { primary: "#05010F", secondary: "#7C3AED", accent: "#E9D5FF", label: "Cosmic violet" },
  engine: "veo-3",
  qualityTier: "4k-cinema",
  musicMood: "neon-synthwave",

  breakTransition: "fade",
  breakTransitionSec: 0.5,

  identity: {
    subject: "a glowing origami-folded craft formed from an app icon",
    anchors: ["rounded-square origin panels", "violet rim glow", "vapour trail"],
  },
  render: {
    startFrame: "flux-text",
    matting: "video-matte",
    engines: { inner: "veo-3", subject: "veo-3", aftermath: "kling-v3" },
  },

  tags: ["ui", "space", "fold"],
  useCount: 58200,
};

export default homeScreenFoldOut;
