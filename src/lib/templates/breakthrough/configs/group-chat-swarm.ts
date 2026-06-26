/**
 * Group-Chat Swarm.
 *
 *    container: group-chat · violation: swarm · destination: into-adjacent-ui
 *
 * The message bubbles + avatars of a group chat detach, swarm out of the
 * conversation, and pour into an adjacent app's UI element.
 */
import type { TemplateDefinition } from "../schema";
import thumb from "@/assets/templates/breakthrough/bt-group-chat-swarm.svg";

const groupChatSwarm: TemplateDefinition = {
  id: "bt-group-chat-swarm",
  name: "Group Chat Swarm",
  description:
    "The bubbles and avatars of a buzzing group chat tear loose and swarm like a flock out of the thread, pouring into the navigation bar of the app beside it.",
  thumbnailUrl: thumb,

  container: {
    kind: "group-chat",
    aspectRatio: "9:16",
    mediaWindow: { x: 0.06, y: 0.16, width: 0.88, height: 0.6 },
    outerSpace:
      "the rest of the phone OS — a status bar, a home indicator, and an adjacent app's tab bar that the swarm dives into",
  },
  boundaryViolation: "swarm",
  destination: "into-adjacent-ui",

  prompts: {
    chrome:
      "A clean mobile group-chat UI: header with group name + member avatars, a column of speech bubbles (left grey, right blue), reactions, a text input bar with send button. Crisp iOS style, soft shadows. NO bubbles detached.",
    innerVideo:
      "Inside the chat thread: bubbles rapidly appearing, typing indicators pulsing, little avatar circles bouncing, reactions popping — an escalating, buzzing conversation, screen vibrating slightly.",
    breakthrough:
      "The speech bubbles and round avatars DETACH from the thread and SWARM out of the chat like a flock of starlings — hundreds of small UI elements streaming in a coordinated murmuration above the chat chrome, banking sideways toward the adjacent app's tab bar at the bottom of the screen.",
    aftermath:
      "The emptied chat thread left as blank bubble-outlines, the swarm now clustered and settling into the neighbouring app's tab bar making it bulge and glow, a few stray bubbles still drifting, the input bar blinking.",
    negative: "warped text, unreadable glyphs, watermark",
  },

  boundaryMask: {
    shape: "ellipse",
    origin: { x: 0.5, y: 0.4 },
    featherPx: 16,
    easing: "ease-out",
  },

  timeline: {
    durationSec: 12,
    breakBeatId: "break",
    beats: [
      { id: "establish", role: "establish", label: "Buzzing chat", atSec: 0, sfx: "rapid message pops, haptic buzzes" },
      { id: "tension", role: "tension", label: "Bubbles tremble", atSec: 3, sfx: "rising swarm flutter" },
      { id: "break", role: "break", label: "Swarm out", atSec: 6, syncToAudioCue: true, sfx: "whoosh of a flock taking off, layered notification chimes" },
      { id: "cross", role: "cross", label: "Murmuration", atSec: 7.5, sfx: "fluttering UI elements banking" },
      { id: "aftermath", role: "aftermath", label: "Into the tab bar", atSec: 9, sfx: "soft pile-in thuds, tab bar chime" },
      { id: "settle", role: "settle", label: "Settling", atSec: 11, sfx: "last stray bubble blip" },
    ],
  },

  aspectRatio: "9:16",
  colorGrade: { primary: "#0A1830", secondary: "#3B82F6", accent: "#E5EEFF", label: "Messenger blue" },
  engine: "seedance-2",
  qualityTier: "hd-1080",
  musicMood: "edm-drop",

  breakTransition: "dissolve",
  breakTransitionSec: 0.5,

  identity: {
    subject: "a swarm of chat bubbles and circular avatars moving as one flock",
    anchors: ["blue + grey speech bubbles", "round avatar tokens", "emoji reactions"],
  },
  render: {
    startFrame: "flux-text",
    matting: "video-matte",
    engines: { inner: "seedance-2", subject: "seedance-2", aftermath: "kling-v3" },
  },

  tags: ["ui", "swarm", "phone"],
  useCount: 73100,
};

export default groupChatSwarm;
