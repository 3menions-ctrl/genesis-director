/**
 * demoProject — a fully-formed synthetic EditorProject used by the
 * /editor/demo route. Loads instantly (no supabase round-trip), so
 * the user can see every view of the editor populated with content
 * before they have a real project of their own.
 *
 * - 3 scenes with mood + time-of-day + act numbers (so the Storyboard
 *   beat-sheet grouping has something real to render)
 * - 9 clips with picsum.photos thumbnails (deterministic seeds for
 *   stable colour) and public sample-video URLs for playback
 * - Multiple takes on a couple of clips so the TakesDrawer A/B/C
 *   panel has content to compare
 * - A full script so the Script view doesn't read as empty
 */
import type {
  EditorClip,
  EditorProject,
  EditorScene,
  EditorTake,
} from "./types";

// Public sample MP4s that actually return 200 (the previous Google
// commondatastorage bucket started 403-ing — confirmed via curl in
// June 2026). Each clip in the demo cycles through these so the
// player has a real video to play. media.w3.org URLs are stable and
// support range requests for scrub.
const PUBLIC_SAMPLES = [
  "https://media.w3.org/2010/05/bunny/trailer.mp4",
  "https://media.w3.org/2010/05/sintel/trailer.mp4",
  "https://media.w3.org/2010/05/video/movie_300.mp4",
  "https://www.w3schools.com/html/mov_bbb.mp4",
  "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4",
  "https://media.w3.org/2010/05/bunny/trailer.mp4",
  "https://media.w3.org/2010/05/sintel/trailer.mp4",
  "https://media.w3.org/2010/05/video/movie_300.mp4",
  "https://www.w3schools.com/html/mov_bbb.mp4",
];

interface ClipSeed {
  prompt: string;
  durationSec: number;
  seed: string;
  takes?: number;
}

const SCENE_SEEDS: Array<{
  title: string;
  description: string;
  mood: string;
  timeOfDay: string;
  actNumber: 1 | 2 | 3;
  isKey: boolean;
  clips: ClipSeed[];
}> = [
  {
    title: "Dawn over the small bridges",
    description: "A wide aerial drift across a quiet harbour at first light.",
    mood: "Quiet, anticipatory",
    timeOfDay: "Dawn",
    actNumber: 1,
    isKey: true,
    clips: [
      { prompt: "Wide aerial drift over the harbour, soft fog, gold-pink sky", durationSec: 4, seed: "bridge-dawn", takes: 3 },
      { prompt: "Close-up: water lapping against a wooden pier, gold reflection", durationSec: 3, seed: "pier-gold" },
      { prompt: "Push-in on a lighthouse beam swinging through the mist", durationSec: 5, seed: "lighthouse" },
    ],
  },
  {
    title: "Crossing the threshold",
    description: "She steps onto the bridge — the moment that changes the story.",
    mood: "Tense, charged",
    timeOfDay: "Midday",
    actNumber: 2,
    isKey: true,
    clips: [
      { prompt: "Medium shot of her boots stepping onto wet planks", durationSec: 3, seed: "boots-planks" },
      { prompt: "Slow-mo whip pan from her face to the far shore", durationSec: 4, seed: "whip-pan", takes: 2 },
      { prompt: "POV crossing the bridge, ropes creaking, wind in mic", durationSec: 5, seed: "pov-cross" },
    ],
  },
  {
    title: "The far shore",
    description: "She arrives. The light shifts. The film exhales.",
    mood: "Cathartic, golden",
    timeOfDay: "Golden hour",
    actNumber: 3,
    isKey: true,
    clips: [
      { prompt: "Wide pull-back as she reaches the shore, warm rim light", durationSec: 5, seed: "shore-pull" },
      { prompt: "Low-angle hero shot, sun behind, lens flares", durationSec: 3, seed: "hero-flare" },
      { prompt: "Final wide of the harbour at sunset, scale and silence", durationSec: 6, seed: "harbour-sunset", takes: 4 },
    ],
  },
];

const SCRIPT = `FADE IN:

EXT. SMALL-BRIDGES HARBOUR — DAWN

A drone glides over still water. Fog clings to the pilings of an
old wooden bridge. Somewhere a lighthouse beam sweeps through the
mist, soft as breath.

ACT TWO — CROSSING THE THRESHOLD

MIRA, 27, stands at the bridge's foot. Boots. Coat. Notebook in her
hand, half a sentence still to be finished.

The first plank takes her weight. Then another. The rope rails
creak the way old rope rails always creak — like something patient.

ACT THREE — THE FAR SHORE

She steps off. The mist thins. The light, somehow, has shifted —
gone gold while she wasn't looking.

She doesn't turn back to the bridge. She doesn't need to. The film
exhales.

FADE TO BLACK.`;

export function isDemoId(id: string | undefined): boolean {
  return id === "demo";
}

export function buildDemoProject(): EditorProject {
  let clipCursor = 0;
  let timeCursor = 0;
  let sampleCursor = 0;

  const scenes: EditorScene[] = SCENE_SEEDS.map((seed, sceneIdx) => {
    const clips: EditorClip[] = seed.clips.map((cSeed) => {
      const id = `demo-clip-${clipCursor}`;
      const videoUrl = PUBLIC_SAMPLES[sampleCursor % PUBLIC_SAMPLES.length];
      sampleCursor++;

      const takeCount = cSeed.takes ?? 1;
      const takes: EditorTake[] = Array.from({ length: takeCount }, (_, ti) => {
        const takeNumber = takeCount - ti; // newest first
        return {
          id: `${id}-take-${takeNumber}`,
          takeNumber,
          videoUrl,
          thumbnailUrl: `https://picsum.photos/seed/${cSeed.seed}-t${takeNumber}/640/360`,
          promptUsed:
            takeNumber === takeCount
              ? cSeed.prompt
              : `${cSeed.prompt} (alternate: take ${takeNumber})`,
          status: "ready",
          createdAt: new Date(Date.now() - takeNumber * 60_000).toISOString(),
        };
      });

      const clip: EditorClip = {
        id,
        index: clipCursor,
        timelineStartSec: timeCursor,
        durationSec: cSeed.durationSec,
        videoUrl,
        thumbnailUrl: `https://picsum.photos/seed/${cSeed.seed}/640/360`,
        prompt: cSeed.prompt,
        takes,
      };
      clipCursor++;
      timeCursor += cSeed.durationSec;
      return clip;
    });

    const sceneDuration = clips.reduce((s, c) => s + c.durationSec, 0);
    return {
      id: `demo-scene-${sceneIdx}`,
      number: sceneIdx + 1,
      title: seed.title,
      description: seed.description,
      durationSec: sceneDuration,
      mood: seed.mood,
      timeOfDay: seed.timeOfDay,
      actNumber: seed.actNumber,
      isKeyScene: seed.isKey,
      visualPrompt: null,
      cameraDirections: null,
      clips,
    };
  });

  // For v1 the editor's mutators put all clips on scene[0]; flatten
  // here so the Timeline + Stage see the full sequence. The
  // Storyboard still reads from scenes individually so it shows the
  // 3-scene layout.
  const allClips = scenes.flatMap((s) => s.clips);
  const flattened: EditorScene[] = scenes.map((s, i) => ({
    ...s,
    clips: i === 0 ? allClips : [],
  }));

  return {
    id: "demo",
    title: "Small Bridges — Demo Reel",
    aspectRatio: "16:9",
    status: "demo",
    thumbnailUrl: `https://picsum.photos/seed/small-bridges-demo-cover/1280/720`,
    durationSec: timeCursor,
    scriptContent: SCRIPT,
    mood: "Quiet, cinematic, hopeful",
    genre: "Drama",
    setting: "A small harbour town",
    scenes: flattened,
  };
}
