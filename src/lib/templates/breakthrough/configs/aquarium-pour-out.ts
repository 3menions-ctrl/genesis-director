/**
 * Aquarium Pour-Out.
 *
 *    container: aquarium · violation: pour-liquefy · destination: toward-viewer
 *
 * The glass of a fish tank gives way and the water — and what swims in it —
 * pours liquidly out of the tank toward the viewer.
 */
import type { TemplateDefinition } from "../schema";
import thumb from "@/assets/templates/breakthrough/bt-aquarium-pour-out.svg";

const aquariumPourOut: TemplateDefinition = {
  id: "bt-aquarium-pour-out",
  name: "Aquarium Pour-Out",
  description:
    "The front glass of an aquarium liquefies and the water pours out of the tank toward the viewer, fish and light spilling across the desk into the room.",
  thumbnailUrl: thumb,

  container: {
    kind: "aquarium",
    aspectRatio: "1:1",
    // The water volume behind the front glass — most of the tank face.
    mediaWindow: { x: 0.1, y: 0.12, width: 0.8, height: 0.66 },
    outerSpace:
      "the desk and room beyond the tank — books, a lamp, a wooden surface that the spilled water floods across, dripping over the front edge toward camera",
  },
  boundaryViolation: "pour-liquefy",
  destination: "toward-viewer",

  prompts: {
    chrome:
      "A pristine rectangular glass aquarium on a wooden desk in a softly lit room, chrome rim and silicone seams, gravel and a few plants at the base, front glass clean and dry. Caustic light dancing on the desk. NO visible water leak.",
    innerVideo:
      "Inside the tank: clear blue-green water with a couple of bright fish drifting, bubbles rising, caustic light rippling, gentle current — viewed through the front glass.",
    breakthrough:
      "The front glass LIQUEFIES and bulges, then a wall of water POURS OUT of the tank toward the viewer — a glassy meniscus front advancing over the desk edge, fish carried on the surge, droplets flinging toward camera in slow motion, caustic light scattering across the lens.",
    aftermath:
      "The drained tank stands half-empty with a rippling waterline, water sheeting off the desk and pooling on the floor toward the viewer, a fish flopping on the wet wood, plants and gravel strewn across the spill, light caustics shimmering in the puddle.",
    negative: "dry glass, cartoon water, watermark, harsh CGI splash",
  },

  boundaryMask: {
    shape: "liquid",
    // the spill front advances from the bottom of the glass outward/down
    origin: { x: 0.5, y: 0.78 },
    featherPx: 14,
    easing: "ease-in-out",
  },

  timeline: {
    durationSec: 12,
    breakBeatId: "break",
    beats: [
      { id: "establish", role: "establish", label: "Calm tank", atSec: 0, sfx: "gentle aquarium filter bubbling" },
      { id: "tension", role: "tension", label: "Glass bulges", atSec: 3, sfx: "glass groaning under pressure, creak" },
      { id: "break", role: "break", label: "Pour-out", atSec: 6, syncToAudioCue: true, sfx: "glass cracking then a heavy gush of water, splash impact" },
      { id: "cross", role: "cross", label: "Surge to viewer", atSec: 7.5, sfx: "water rushing toward the lens" },
      { id: "aftermath", role: "aftermath", label: "Flooding the desk", atSec: 9, sfx: "water sheeting and dripping off the desk edge" },
      { id: "settle", role: "settle", label: "Pooling", atSec: 11, sfx: "dripping, a fish flopping on wet wood" },
    ],
  },

  aspectRatio: "1:1",
  colorGrade: { primary: "#06303A", secondary: "#34D3C5", accent: "#EAF7FF", label: "Aquarium teal" },
  engine: "kling-v3",
  qualityTier: "4k-cinema",
  musicMood: "ambient-textural",

  breakTransition: "dissolve",
  breakTransitionSec: 0.6,

  // No character — the "subject" IS the water surge, so matte it from the
  // generated pour clip rather than chroma-keying a person.
  identity: {
    subject: "a translucent wall of aquarium water with two bright fish carried in the surge",
    anchors: ["clownfish orange-and-white", "blue tang", "caustic light"],
  },
  render: {
    startFrame: "flux-text",
    matting: "video-matte",
    engines: { inner: "kling-v3", subject: "kling-v3", aftermath: "kling-v3" },
  },

  tags: ["liquid", "satisfying"],
  useCount: 81200,
};

export default aquariumPourOut;
