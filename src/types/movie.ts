export type MovieGenre = 'action' | 'drama' | 'comedy' | 'thriller' | 'scifi' | 'fantasy' | 'romance' | 'horror' | 'documentary' | 'adventure';

export type StoryStructure = 'three_act' | 'hero_journey' | 'circular' | 'in_medias_res' | 'episodic';

export interface Universe {
  id: string;
  user_id?: string;
  name: string;
  description?: string;
  setting?: string;
  time_period?: string;
  rules?: string;
  created_at: string;
  updated_at: string;
}

export interface Character {
  id: string;
  universe_id?: string;
  user_id?: string;
  name: string;
  description?: string;
  backstory?: string;
  personality?: string;
  appearance?: string;
  voice_id?: string;
  created_at: string;
}

export interface MovieProject {
  id: string;
  user_id?: string;
  universe_id?: string;
  parent_project_id?: string;
  title: string;
  genre: MovieGenre;
  story_structure: StoryStructure;
  target_duration_minutes: number;
  setting?: string;
  time_period?: string;
  mood?: string;
  movie_intro_style?: string;
  synopsis?: string;
  script_content?: string;
  generated_script?: string;
  voice_audio_url?: string;
  video_url?: string;
  thumbnail_url?: string;
  status: string;
  is_template: boolean;
  created_at: string;
  updated_at: string;
  characters?: Character[];
}

export interface ProjectCharacter {
  id: string;
  project_id: string;
  character_id: string;
  role?: string;
  created_at: string;
}

export interface ScriptTemplate {
  id: string;
  user_id?: string;
  name: string;
  description?: string;
  genre?: MovieGenre;
  story_structure?: StoryStructure;
  sample_script?: string;
  created_at: string;
}

export interface StoryWizardData {
  title: string;
  genre: MovieGenre;
  storyStructure: StoryStructure;
  targetDurationMinutes: number;
  setting: string;
  timePeriod: string;
  mood: string;
  movieIntroStyle: 'cinematic' | 'documentary' | 'dramatic' | 'mystery' | 'none';
  characters: CharacterInput[];
  universeId?: string;
  parentProjectId?: string;
  synopsis: string;
}

export interface CharacterInput {
  name: string;
  role: 'protagonist' | 'antagonist' | 'supporting' | 'narrator';
  description: string;
  personality: string;
}

export const GENRE_OPTIONS: { value: MovieGenre; label: string; emoji: string; description: string }[] = [
  { value: 'action', label: 'Action', emoji: '💥', description: 'High-energy, thrilling sequences' },
  { value: 'drama', label: 'Drama', emoji: '🎭', description: 'Emotional, character-driven stories' },
  { value: 'comedy', label: 'Comedy', emoji: '😂', description: 'Humor and light-hearted fun' },
  { value: 'thriller', label: 'Thriller', emoji: '😰', description: 'Suspense and tension' },
  { value: 'scifi', label: 'Sci-Fi', emoji: '🚀', description: 'Futuristic and speculative' },
  { value: 'fantasy', label: 'Fantasy', emoji: '🧙', description: 'Magic and mythical worlds' },
  { value: 'romance', label: 'Romance', emoji: '💕', description: 'Love and relationships' },
  { value: 'horror', label: 'Horror', emoji: '👻', description: 'Fear and suspense' },
  { value: 'documentary', label: 'Documentary', emoji: '📹', description: 'Informative and factual' },
  { value: 'adventure', label: 'Adventure', emoji: '🗺️', description: 'Exploration and discovery' },
];

export const STRUCTURE_OPTIONS: { value: StoryStructure; label: string; description: string }[] = [
  { value: 'three_act', label: 'Three-Act Structure', description: 'Setup → Confrontation → Resolution' },
  { value: 'hero_journey', label: "Hero's Journey", description: 'Call to adventure → Trials → Transformation' },
  { value: 'circular', label: 'Circular', description: 'Story ends where it began' },
  { value: 'in_medias_res', label: 'In Medias Res', description: 'Start in the middle of action' },
  { value: 'episodic', label: 'Episodic', description: 'Connected scenes or vignettes' },
];

export const INTRO_STYLE_OPTIONS = [
  { value: 'cinematic', label: 'Cinematic', description: 'Epic movie-style opening with dramatic music cues' },
  { value: 'documentary', label: 'Documentary', description: 'Factual introduction with context setting' },
  { value: 'dramatic', label: 'Dramatic Monologue', description: 'Character narration setting the scene' },
  { value: 'mystery', label: 'Mystery Hook', description: 'Intriguing opening that poses questions' },
  { value: 'none', label: 'No Intro', description: 'Jump straight into the story' },
] as const;

export const TIME_PERIOD_OPTIONS = [
  'Present Day',
  'Near Future (2050+)',
  'Distant Future',
  'Medieval Era',
  '1920s',
  '1950s',
  '1980s',
  'Ancient Times',
  'Post-Apocalyptic',
  'Fantasy Realm',
];

export const MOOD_OPTIONS = [
  'Hopeful & Inspiring',
  'Dark & Gritty',
  'Lighthearted & Fun',
  'Mysterious & Suspenseful',
  'Epic & Grand',
  'Intimate & Personal',
  'Melancholic & Reflective',
  'Tense & Thrilling',
];
