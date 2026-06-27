/**
 * Billboard Walkout.
 *
 *    container: billboard · violation: shatter-step · destination: off-screen
 *
 * A figure inside a colossal Times-Square LED billboard shatter-steps through
 * the panel and drops OFF-SCREEN onto the street below.
 */
import type { TemplateDefinition } from "../schema";
import thumb from "@/assets/templates/breakthrough/bt-billboard-walkout.svg";

const billboardWalkout: TemplateDefinition = {
  id: "bt-billboard-walkout",
  name: "Billboard Walkout",
  description:
    "A figure trapped inside a colossal Times-Square LED billboard shatter-steps through the screen and leaps off-frame onto the neon-soaked street below.",
  thumbnailUrl: thumb,

  container: {
    kind: "billboard",
    aspectRatio: "16:9",
    // The billboard occupies the upper portion of the cityscape frame.
    mediaWindow: { x: 0.18, y: 0.06, width: 0.64, height: 0.5 },
    outerSpace:
      "the neon-soaked rainy street below the billboard — yellow taxis, umbrella crowds, steam from manholes, wet asphalt reflections",
  },
  boundaryViolation: "shatter-step",
  destination: "off-screen",

  prompts: {
    chrome:
      "A colossal Times-Square LED billboard mounted on a building facade at night, dark inert screen with faint RGB pixel grid, surrounded by smaller signage. Below: a wet, neon-lit street. Blade-Runner magenta/cyan grade. NO people.",
    innerVideo:
      "Inside the billboard panel: a person rendered in faint RGB scanlines and pixel grid, pressing a hand against the inside of the LED screen, looking down at the street, slow crane-up framing.",
    breakthrough:
      "The person SHATTER-STEPS forward through the LED panel — the screen bursting into a cascade of pixel sparks and shattered LED tiles — then leaps off the billboard, body crossing above the cityscape chrome and exiting the bottom-right of frame toward the street. Magenta/cyan glow, rain refracting in slow motion.",
    aftermath:
      "The billboard left dark with a person-shaped hole punched through it, loose LED tiles and pixel sparks raining down past the signage, steam rising, neon reflections rippling on the wet street where they landed off-frame.",
    negative: "warped face, extra limbs, watermark, jpeg artifacts",
  },

  boundaryMask: {
    shape: "shatter",
    origin: { x: 0.5, y: 0.55 },
    featherPx: 12,
    easing: "ease-in",
  },

  timeline: {
    durationSec: 12,
    breakBeatId: "break",
    beats: [
      { id: "establish", role: "establish", label: "Trapped on the billboard", atSec: 0 },
      { id: "tension", role: "tension", label: "Hand on the screen", atSec: 3, sfx: "electric LED buzz, rising synth drone" },
      { id: "break", role: "break", label: "Shatter-step out", atSec: 6, syncToAudioCue: true, sfx: "LED panels exploding, electric crackle, sub-bass hit" },
      { id: "cross", role: "cross", label: "Leap off-frame", atSec: 7.5, sfx: "body whoosh, rain swell" },
      { id: "aftermath", role: "aftermath", label: "Panels rain down", atSec: 9, sfx: "LED tiles clattering onto wet asphalt" },
      { id: "settle", role: "settle", label: "Street landing", atSec: 11, sfx: "heavy boot landing in a puddle, taxi horns" },
    ],
  },

  aspectRatio: "16:9",
  colorGrade: { primary: "#0B0B14", secondary: "#FF2EA6", accent: "#22D3EE", label: "Times-Square neon" },
  engine: "veo-3",
  qualityTier: "4k-cinema",
  musicMood: "neon-synthwave",

  breakTransition: "fade",
  breakTransitionSec: 0.5,

  identity: {
    subject: "athletic figure in a cropped jacket, neon-lit, confident stance",
    anchors: ["cropped reflective jacket", "cargo trousers", "high-top sneakers"],
  },
  render: {
    startFrame: "flux-text",
    matting: "chromakey",
    chromaColor: "#00B140",
    engines: { inner: "veo-3", subject: "runway-gen4", aftermath: "seedance-2" },
  },

  tags: ["cityscape", "neon"],
  useCount: 134500,
};

export default billboardWalkout;
