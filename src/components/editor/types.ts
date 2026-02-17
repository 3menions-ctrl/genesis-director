export interface ClipEffect {
  type: "transition" | "filter" | "text";
  name: string;
  duration: number;
  params?: Record<string, unknown>;
}

export interface TextStyle {
  fontSize: number;
  color: string;
  fontWeight?: string;
  fontFamily?: string;
  textAlign?: "left" | "center" | "right";
  backgroundColor?: string;
  position?: { x: number; y: number };
}

export interface ColorGrading {
  brightness: number; // 0-200, default 100
  contrast: number;   // 0-200, default 100
  saturation: number; // 0-200, default 100
  hue: number;        // 0-360, default 0
  opacity: number;    // 0-100, default 100
}

export interface Keyframe {
  time: number; // seconds relative to clip start
  properties: {
    x?: number;
    y?: number;
    scale?: number;
    rotation?: number;
    opacity?: number;
  };
  easing?: "linear" | "ease-in" | "ease-out" | "ease-in-out";
}

export interface ClipTransform {
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  cropAspect: number | null;
}

export interface AudioFade {
  fadeIn: number;  // seconds
  fadeOut: number; // seconds
}

export interface PipSettings {
  enabled: boolean;
  x: number;       // 0-100 percentage
  y: number;       // 0-100 percentage
  width: number;   // 0-100 percentage
  height: number;  // 0-100 percentage
}

export interface ChromaKey {
  enabled: boolean;
  color: string;       // hex color to key out
  similarity: number;  // 0-100
  smoothness: number;  // 0-100
}

export interface TimelineClip {
  id: string;
  trackId: string;
  start: number;
  end: number;
  type: "video" | "audio" | "text" | "image";
  sourceUrl: string;
  label: string;
  effects: ClipEffect[];
  textContent?: string;
  textStyle?: TextStyle;
  trimStart?: number;
  trimEnd?: number;
  colorGrading?: ColorGrading;
  keyframes?: Keyframe[];
  volume?: number;
  speed?: number;
  transform?: ClipTransform;
  audioFade?: AudioFade;
  pip?: PipSettings;
  chromaKey?: ChromaKey;
  filter?: string;         // preset filter name
  noiseSuppression?: boolean;
  captions?: Caption[];
}

export interface TimelineTrack {
  id: string;
  name: string;
  type: "video" | "audio" | "text";
  clips: TimelineClip[];
  muted: boolean;
  locked: boolean;
}

export interface EditorState {
  sessionId: string | null;
  projectId: string | null;
  title: string;
  tracks: TimelineTrack[];
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  selectedClipId: string | null;
  zoom: number;
  renderStatus: "idle" | "rendering" | "completed" | "failed";
  renderProgress: number;
}

export const DEFAULT_COLOR_GRADING: ColorGrading = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hue: 0,
  opacity: 100,
};

export interface Caption {
  start: number; // seconds relative to clip
  end: number;
  text: string;
}

export const TRANSITION_TYPES = [
  { id: "crossfade", name: "Crossfade", icon: "Blend" },
  { id: "dissolve", name: "Dissolve", icon: "Sparkles" },
  { id: "wipe-left", name: "Wipe Left", icon: "ArrowLeft" },
  { id: "wipe-right", name: "Wipe Right", icon: "ArrowRight" },
  { id: "fade-black", name: "Fade to Black", icon: "Moon" },
  { id: "fade-white", name: "Fade to White", icon: "Sun" },
  { id: "zoom-in", name: "Zoom In", icon: "ZoomIn" },
  { id: "zoom-out", name: "Zoom Out", icon: "ZoomOut" },
  { id: "spin", name: "Spin", icon: "RotateCw" },
  { id: "glitch", name: "Glitch", icon: "Zap" },
  { id: "slide-up", name: "Slide Up", icon: "ArrowUp" },
  { id: "slide-down", name: "Slide Down", icon: "ArrowDown" },
] as const;

export const FILTER_PRESETS = [
  { id: "none", name: "None", css: "" },
  { id: "vintage", name: "Vintage", css: "sepia(40%) contrast(110%) brightness(90%)" },
  { id: "noir", name: "Noir", css: "grayscale(100%) contrast(130%) brightness(90%)" },
  { id: "warm", name: "Warm", css: "sepia(20%) saturate(140%) brightness(105%)" },
  { id: "cool", name: "Cool", css: "saturate(80%) hue-rotate(20deg) brightness(105%)" },
  { id: "vivid", name: "Vivid", css: "saturate(180%) contrast(110%)" },
  { id: "muted", name: "Muted", css: "saturate(50%) brightness(105%)" },
  { id: "cinematic", name: "Cinematic", css: "contrast(120%) saturate(85%) brightness(95%)" },
  { id: "dreamy", name: "Dreamy", css: "brightness(110%) contrast(90%) saturate(120%) blur(0.5px)" },
  { id: "retro", name: "Retro", css: "sepia(60%) hue-rotate(-10deg) saturate(120%)" },
  { id: "hdr", name: "HDR", css: "contrast(140%) saturate(130%) brightness(105%)" },
  { id: "bleach", name: "Bleach", css: "contrast(130%) saturate(60%) brightness(110%)" },
  { id: "lomo", name: "Lomo", css: "contrast(150%) saturate(130%) brightness(90%)" },
] as const;

export const EFFECT_PRESETS = [
  { id: "glitch", name: "Glitch", category: "trending", description: "Digital distortion effect", css: "hue-rotate(90deg) contrast(200%) saturate(300%)" },
  { id: "vhs", name: "VHS", category: "trending", description: "Retro tape look", css: "contrast(120%) saturate(80%) brightness(110%)" },
  { id: "zoom-pulse", name: "Zoom Pulse", category: "trending", description: "Rhythmic zoom beats", animation: "zoom-pulse" },
  { id: "shake", name: "Shake", category: "trending", description: "Camera shake effect", animation: "shake" },
  { id: "blur-reveal", name: "Blur Reveal", category: "trending", description: "Focus pull transition", animation: "blur-reveal" },
  { id: "rgb-split", name: "RGB Split", category: "trending", description: "Chromatic aberration", css: "drop-shadow(2px 0 0 rgba(255,0,0,0.5)) drop-shadow(-2px 0 0 rgba(0,0,255,0.5))" },
  { id: "film-grain", name: "Film Grain", category: "cinematic", description: "Analog film texture", animation: "grain" },
  { id: "flash", name: "Flash", category: "trending", description: "White flash beat sync", animation: "flash" },
  { id: "mirror", name: "Mirror", category: "creative", description: "Mirror reflection", css: "scaleX(-1)" },
  { id: "slow-zoom", name: "Ken Burns", category: "cinematic", description: "Slow cinematic zoom", animation: "ken-burns" },
  { id: "duotone", name: "Duotone", category: "creative", description: "Two-color grading", css: "grayscale(100%) sepia(100%) hue-rotate(180deg) saturate(200%)" },
  { id: "neon-glow", name: "Neon Glow", category: "creative", description: "Neon edge lighting", css: "contrast(150%) brightness(120%) saturate(200%)" },
] as const;

export const STICKER_PRESETS = [
  // Emoji reactions
  { id: "fire", name: "🔥", category: "emoji", label: "Fire" },
  { id: "heart", name: "❤️", category: "emoji", label: "Heart" },
  { id: "star", name: "⭐", category: "emoji", label: "Star" },
  { id: "laugh", name: "😂", category: "emoji", label: "Laugh" },
  { id: "shocked", name: "😱", category: "emoji", label: "Shocked" },
  { id: "clap", name: "👏", category: "emoji", label: "Clap" },
  { id: "eyes", name: "👀", category: "emoji", label: "Eyes" },
  { id: "rocket", name: "🚀", category: "emoji", label: "Rocket" },
  { id: "crown", name: "👑", category: "emoji", label: "Crown" },
  { id: "diamond", name: "💎", category: "emoji", label: "Diamond" },
  { id: "sparkles-emoji", name: "✨", category: "emoji", label: "Sparkles" },
  { id: "skull", name: "💀", category: "emoji", label: "Skull" },
  // Shapes
  { id: "arrow-right", name: "→", category: "shape", label: "Arrow Right" },
  { id: "arrow-down", name: "↓", category: "shape", label: "Arrow Down" },
  { id: "circle", name: "●", category: "shape", label: "Circle" },
  { id: "square", name: "■", category: "shape", label: "Square" },
  { id: "star-shape", name: "★", category: "shape", label: "Star" },
  { id: "triangle", name: "▲", category: "shape", label: "Triangle" },
  // Animated text
  { id: "subscribe", name: "SUBSCRIBE", category: "cta", label: "Subscribe" },
  { id: "follow", name: "FOLLOW", category: "cta", label: "Follow" },
  { id: "like", name: "LIKE & SHARE", category: "cta", label: "Like & Share" },
  { id: "swipe-up", name: "SWIPE UP ↑", category: "cta", label: "Swipe Up" },
  { id: "link-bio", name: "LINK IN BIO", category: "cta", label: "Link in Bio" },
  { id: "new", name: "NEW", category: "cta", label: "New Badge" },
] as const;

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  duration: number; // seconds
  category: "cinematic" | "electronic" | "ambient" | "hip-hop" | "pop" | "orchestral" | "lo-fi" | "rock";
  mood: string;
  bpm: number;
  previewUrl?: string; // For future integration
}

// Curated royalty-free music library
export const MUSIC_LIBRARY: MusicTrack[] = [
  // Cinematic
  { id: "epic-rise", title: "Epic Rise", artist: "Studio Library", duration: 120, category: "cinematic", mood: "Epic & Powerful", bpm: 130 },
  { id: "dark-tension", title: "Dark Tension", artist: "Studio Library", duration: 90, category: "cinematic", mood: "Suspenseful", bpm: 85 },
  { id: "emotional-strings", title: "Emotional Strings", artist: "Studio Library", duration: 150, category: "cinematic", mood: "Emotional & Moving", bpm: 72 },
  { id: "hero-theme", title: "Hero Theme", artist: "Studio Library", duration: 180, category: "cinematic", mood: "Heroic & Triumphant", bpm: 140 },
  { id: "mystery-noir", title: "Mystery Noir", artist: "Studio Library", duration: 110, category: "cinematic", mood: "Dark & Mysterious", bpm: 95 },
  // Orchestral
  { id: "grand-finale", title: "Grand Finale", artist: "Studio Library", duration: 200, category: "orchestral", mood: "Majestic", bpm: 120 },
  { id: "gentle-waltz", title: "Gentle Waltz", artist: "Studio Library", duration: 160, category: "orchestral", mood: "Elegant", bpm: 88 },
  { id: "battle-cry", title: "Battle Cry", artist: "Studio Library", duration: 140, category: "orchestral", mood: "Intense", bpm: 160 },
  // Electronic
  { id: "neon-drive", title: "Neon Drive", artist: "Studio Library", duration: 180, category: "electronic", mood: "Energetic & Futuristic", bpm: 128 },
  { id: "cyber-pulse", title: "Cyber Pulse", artist: "Studio Library", duration: 120, category: "electronic", mood: "Tech & Modern", bpm: 140 },
  { id: "synth-wave", title: "Synth Wave", artist: "Studio Library", duration: 200, category: "electronic", mood: "Retro Futuristic", bpm: 110 },
  { id: "bass-drop", title: "Bass Drop", artist: "Studio Library", duration: 90, category: "electronic", mood: "Heavy & Intense", bpm: 150 },
  // Ambient
  { id: "peaceful-dawn", title: "Peaceful Dawn", artist: "Studio Library", duration: 240, category: "ambient", mood: "Calm & Serene", bpm: 60 },
  { id: "ocean-breeze", title: "Ocean Breeze", artist: "Studio Library", duration: 180, category: "ambient", mood: "Relaxing", bpm: 70 },
  { id: "starlight", title: "Starlight", artist: "Studio Library", duration: 200, category: "ambient", mood: "Dreamy & Ethereal", bpm: 65 },
  { id: "forest-rain", title: "Forest Rain", artist: "Studio Library", duration: 300, category: "ambient", mood: "Nature & Peace", bpm: 55 },
  // Hip-Hop
  { id: "street-flow", title: "Street Flow", artist: "Studio Library", duration: 120, category: "hip-hop", mood: "Urban & Cool", bpm: 90 },
  { id: "trap-anthem", title: "Trap Anthem", artist: "Studio Library", duration: 150, category: "hip-hop", mood: "Hard & Gritty", bpm: 140 },
  { id: "chill-beats", title: "Chill Beats", artist: "Studio Library", duration: 180, category: "hip-hop", mood: "Laid Back", bpm: 85 },
  // Pop
  { id: "feel-good", title: "Feel Good", artist: "Studio Library", duration: 180, category: "pop", mood: "Happy & Upbeat", bpm: 120 },
  { id: "summer-vibes", title: "Summer Vibes", artist: "Studio Library", duration: 200, category: "pop", mood: "Fun & Bright", bpm: 115 },
  { id: "heartbeat", title: "Heartbeat", artist: "Studio Library", duration: 160, category: "pop", mood: "Romantic", bpm: 100 },
  // Lo-Fi
  { id: "late-night-study", title: "Late Night Study", artist: "Studio Library", duration: 240, category: "lo-fi", mood: "Chill & Focused", bpm: 75 },
  { id: "vinyl-coffee", title: "Vinyl & Coffee", artist: "Studio Library", duration: 200, category: "lo-fi", mood: "Warm & Nostalgic", bpm: 80 },
  { id: "rainy-window", title: "Rainy Window", artist: "Studio Library", duration: 180, category: "lo-fi", mood: "Melancholic", bpm: 70 },
  // Rock
  { id: "power-riff", title: "Power Riff", artist: "Studio Library", duration: 120, category: "rock", mood: "Energetic & Bold", bpm: 135 },
  { id: "indie-sunset", title: "Indie Sunset", artist: "Studio Library", duration: 180, category: "rock", mood: "Warm & Indie", bpm: 105 },
  { id: "garage-band", title: "Garage Band", artist: "Studio Library", duration: 150, category: "rock", mood: "Raw & Gritty", bpm: 145 },
];

export const TEMPLATE_PRESETS = [
  // Social
  { id: "tiktok-vertical", name: "TikTok Vertical", description: "9:16 fast-paced vertical edit", tracks: 2, category: "social" as const, icon: "📱" },
  { id: "ig-reel", name: "Instagram Reel", description: "15-60s reel with music sync", tracks: 2, category: "social" as const, icon: "📸" },
  { id: "yt-shorts", name: "YouTube Shorts", description: "60s vertical short with hook", tracks: 2, category: "social" as const, icon: "▶️" },
  { id: "story-slides", name: "Stories", description: "Multi-slide story format", tracks: 3, category: "social" as const, icon: "📖" },
  { id: "reaction", name: "Reaction", description: "PiP reaction format", tracks: 3, category: "social" as const, icon: "😲" },
  // Cinematic
  { id: "movie-trailer", name: "Movie Trailer", description: "Dramatic 60-90s trailer", tracks: 4, category: "cinematic" as const, icon: "🎬" },
  { id: "documentary", name: "Documentary", description: "Interview + B-roll structure", tracks: 3, category: "cinematic" as const, icon: "📽️" },
  { id: "music-video", name: "Music Video", description: "Beat-synced visual cuts", tracks: 3, category: "cinematic" as const, icon: "🎵" },
  { id: "short-film", name: "Short Film", description: "3-act narrative structure", tracks: 4, category: "cinematic" as const, icon: "🎞️" },
  { id: "intro-outro", name: "Intro + Outro", description: "Title card, content, end card", tracks: 3, category: "cinematic" as const, icon: "🎭" },
  // Commercial
  { id: "product-showcase", name: "Product Showcase", description: "Hero shots with text overlays", tracks: 3, category: "commercial" as const, icon: "🛍️" },
  { id: "testimonial", name: "Testimonial", description: "Speaker + brand graphics", tracks: 3, category: "commercial" as const, icon: "💬" },
  { id: "before-after", name: "Before / After", description: "Split comparison reveal", tracks: 2, category: "commercial" as const, icon: "🔄" },
  { id: "countdown", name: "Countdown", description: "Top 5/10 list with transitions", tracks: 3, category: "commercial" as const, icon: "🔢" },
  { id: "promo", name: "Promo", description: "Fast cuts with music", tracks: 3, category: "commercial" as const, icon: "📣" },
  // Utility
  { id: "slideshow", name: "Slideshow", description: "Clips with crossfades", tracks: 1, category: "utility" as const, icon: "🖼️" },
  { id: "vlog", name: "Vlog", description: "Jump cuts with text overlays", tracks: 2, category: "utility" as const, icon: "📹" },
  { id: "tutorial", name: "Tutorial", description: "Screen + PiP + captions", tracks: 3, category: "utility" as const, icon: "📚" },
  { id: "podcast", name: "Podcast", description: "Audio waveform + talking head", tracks: 2, category: "utility" as const, icon: "🎙️" },
  { id: "montage", name: "Montage", description: "Fast-paced highlight reel", tracks: 2, category: "utility" as const, icon: "⚡" },
] as const;
