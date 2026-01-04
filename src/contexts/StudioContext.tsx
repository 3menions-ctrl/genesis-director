import { createContext, useContext, useState, useRef, useEffect, ReactNode } from 'react';
import { Project, StudioSettings, UserCredits, AssetLayer, ProjectStatus, VISUAL_STYLE_PRESETS, VisualStylePreset } from '@/types/studio';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// Cinematic camera movements for professional movie feel
const CAMERA_MOVEMENTS = [
  'smooth dolly forward',
  'elegant crane shot rising',
  'steady tracking shot',
  'subtle push-in',
  'graceful pan right',
  'cinematic dolly out',
  'slow sweeping arc',
  'gentle floating camera',
];

// Professional cinematography lighting setups
const LIGHTING_STYLES = {
  dramatic: 'high contrast chiaroscuro lighting, deep shadows, volumetric light rays',
  natural: 'soft golden hour light, natural ambient illumination, subtle lens flare',
  moody: 'atmospheric blue hour tones, diffused backlighting, cinematic haze',
  documentary: 'realistic natural lighting, authentic exposure, candid quality',
  epic: 'dramatic god rays, sweeping light beams, majestic illumination',
};

// Film grain and color grade presets
const COLOR_GRADES = [
  'teal and orange color grade',
  'desaturated cinematic palette',
  'warm golden tones',
  'cool blue undertones',
  'rich saturated colors',
];

// Helper to detect content type from script
function detectContentType(script: string): 'documentary' | 'dramatic' | 'epic' | 'intimate' | 'action' | 'scifi' {
  const lower = script.toLowerCase();
  // Detect sci-fi first - allows physics-bending content
  if (lower.includes('sci-fi') || lower.includes('science fiction') || lower.includes('futuristic') || 
      lower.includes('spaceship') || lower.includes('alien') || lower.includes('robot') ||
      lower.includes('cyberpunk') || lower.includes('dystopia') || lower.includes('teleport') ||
      lower.includes('time travel') || lower.includes('laser') || lower.includes('hologram')) {
    return 'scifi';
  }
  if (lower.includes('documentary') || lower.includes('real') || lower.includes('true story')) return 'documentary';
  if (lower.includes('action') || lower.includes('chase') || lower.includes('fight')) return 'action';
  if (lower.includes('epic') || lower.includes('grand') || lower.includes('vast')) return 'epic';
  if (lower.includes('personal') || lower.includes('intimate') || lower.includes('quiet')) return 'intimate';
  return 'dramatic';
}

// Helper function to build a cinematic scene description
function buildSceneConsistencyPrompt(script: string, project: Project): string {
  const scriptLower = script.toLowerCase();
  const contentType = detectContentType(script);
  
  // Detect environment with rich detail
  let environment = 'cinematic interior';
  if (scriptLower.includes('jungle') || scriptLower.includes('forest') || scriptLower.includes('rainforest')) {
    environment = 'lush dense jungle with dappled sunlight through canopy';
  } else if (scriptLower.includes('ocean') || scriptLower.includes('sea') || scriptLower.includes('beach')) {
    environment = 'vast ocean expanse with dramatic waves and horizon';
  } else if (scriptLower.includes('mountain') || scriptLower.includes('peak')) {
    environment = 'majestic mountain landscape with atmospheric depth';
  } else if (scriptLower.includes('city') || scriptLower.includes('urban') || scriptLower.includes('street')) {
    environment = 'atmospheric urban cityscape with depth and scale';
  } else if (scriptLower.includes('desert') || scriptLower.includes('sand')) {
    environment = 'sweeping desert dunes with heat haze';
  } else if (scriptLower.includes('space') || scriptLower.includes('galaxy') || scriptLower.includes('star')) {
    environment = 'vast cosmic nebula with stellar phenomena';
  } else if (scriptLower.includes('underwater') || scriptLower.includes('deep sea')) {
    environment = 'ethereal underwater realm with caustic light';
  }
  
  // Select lighting based on content type
  const lighting = contentType === 'documentary' ? LIGHTING_STYLES.documentary 
    : contentType === 'epic' ? LIGHTING_STYLES.epic 
    : contentType === 'intimate' ? LIGHTING_STYLES.moody 
    : LIGHTING_STYLES.dramatic;
  
  return `${environment}, ${lighting}, shot on ARRI Alexa, anamorphic lens, 2.39:1 aspect ratio feel`;
}

// Extract key visual elements for scene consistency
function extractSceneElements(fullScript: string): string {
  const lower = fullScript.toLowerCase();
  const elements: string[] = [];
  
  // Extract setting/location
  const locationPatterns = ['forest', 'city', 'beach', 'mountain', 'office', 'house', 'street', 'room', 'space', 'desert'];
  locationPatterns.forEach(loc => {
    if (lower.includes(loc)) elements.push(loc);
  });
  
  // Extract time of day
  if (lower.includes('night')) elements.push('nighttime');
  else if (lower.includes('dawn') || lower.includes('sunrise')) elements.push('dawn lighting');
  else if (lower.includes('dusk') || lower.includes('sunset')) elements.push('golden hour');
  else if (lower.includes('day') || lower.includes('morning')) elements.push('daylight');
  
  // Extract weather/atmosphere
  const weatherPatterns = ['rain', 'snow', 'fog', 'storm', 'sunny', 'cloudy'];
  weatherPatterns.forEach(w => {
    if (lower.includes(w)) elements.push(w);
  });
  
  return elements.length > 0 ? elements.slice(0, 4).join(', ') : 'consistent environment';
}

// Helper function to build cinematic clip prompts with seamless transitions and scene consistency
function buildClipPrompt(
  clipText: string, 
  sceneDescription: string, 
  clipIndex: number, 
  totalClips: number,
  fullScript?: string,
  visualStyle?: VisualStylePreset
): string {
  const contentType = detectContentType(clipText);
  
  // Get the visual style prompt
  const stylePreset = VISUAL_STYLE_PRESETS.find(s => s.id === visualStyle);
  const stylePrompt = stylePreset?.prompt || VISUAL_STYLE_PRESETS[0].prompt;
  
  // Adjust camera movements based on style
  const cameraMove = visualStyle === 'documentary' 
    ? 'handheld naturalistic movement'
    : visualStyle === 'anime'
    ? 'dynamic anime-style camera sweep'
    : CAMERA_MOVEMENTS[clipIndex % CAMERA_MOVEMENTS.length];
  
  // Select color grade based on style
  let colorGrade: string;
  if (visualStyle === 'vintage') {
    colorGrade = 'warm faded film colors, sepia undertones, nostalgic palette';
  } else if (visualStyle === 'anime') {
    colorGrade = 'vibrant saturated anime colors, bold contrast';
  } else if (visualStyle === 'documentary') {
    colorGrade = 'natural authentic colors, realistic tones';
  } else {
    colorGrade = COLOR_GRADES[Math.floor(totalClips / 2) % COLOR_GRADES.length];
  }
  
  // Extract consistent scene elements from full script
  const sceneConsistency = fullScript ? extractSceneElements(fullScript) : 'maintain visual continuity';
  
  // Build transition hints for seamless flow
  let transitionHint = '';
  if (clipIndex === 0) {
    transitionHint = 'fade in from black, establishing shot, set the visual tone';
  } else if (clipIndex === totalClips - 1) {
    transitionHint = 'seamless continuation from previous, conclusive framing, lingering final moment';
  } else {
    transitionHint = 'seamless continuation, match previous scene lighting and color, continuous motion flow';
  }
  
  // Scene continuity instructions
  const continuityInstructions = [
    'maintain exact same visual style throughout',
    'consistent lighting direction and intensity',
    'same color temperature and grading',
    'matching environment and atmosphere',
    'smooth motion that flows naturally',
    sceneConsistency
  ].join(', ');
  
  // Extract key visual elements from clip text (reduced to 200 chars to fit style)
  const visualContent = clipText.slice(0, 200);
  
  // Detect if sci-fi to allow physics-bending
  const isSciFi = detectContentType(clipText) === 'scifi';
  
  // Physics and realism constraints (except for sci-fi and anime)
  const physicsConstraints = isSciFi || visualStyle === 'anime'
    ? 'stylized physics allowed' 
    : 'strict real-world physics, natural gravity and motion, realistic weight and momentum, authentic material behavior, no impossible movements, believable human anatomy and motion';
  
  // Build the cinematic prompt with style emphasis
  const prompt = [
    stylePrompt,
    `${cameraMove}`,
    visualContent,
    sceneDescription,
    colorGrade,
    transitionHint,
    continuityInstructions,
    physicsConstraints,
    'seamless scene matching'
  ].join('. ');
  
  // Runway has 1000 char limit
  return prompt.slice(0, 990);
}

const MOCK_CREDITS: UserCredits = {
  total: 50000,
  used: 12400,
  remaining: 37600,
};

const MOCK_LAYERS: AssetLayer[] = [
  { id: 'layer-1', project_id: '1', layer_type: 'background_video', status: 'completed', z_index: 0, created_at: new Date().toISOString() },
  { id: 'layer-2', project_id: '1', layer_type: 'character_video', status: 'completed', z_index: 1, created_at: new Date().toISOString() },
  { id: 'layer-3', project_id: '1', layer_type: 'audio_narration', status: 'completed', z_index: 2, created_at: new Date().toISOString() },
  { id: 'layer-4', project_id: '1', layer_type: 'overlay_metadata', status: 'idle', z_index: 3, created_at: new Date().toISOString() },
];

interface GenerationProgress {
  step: 'idle' | 'voice' | 'video' | 'polling';
  percent: number;
  estimatedSecondsRemaining: number | null;
  currentClip?: number;
  totalClips?: number;
}

// Credit costs for each duration
export const DURATION_CREDIT_COSTS = {
  8: 1000,
  30: 3500,
  60: 7000,
} as const;

interface StudioContextType {
  projects: Project[];
  activeProjectId: string | null;
  activeProject: Project | null;
  credits: UserCredits;
  layers: AssetLayer[];
  settings: StudioSettings;
  isGenerating: boolean;
  generationProgress: GenerationProgress;
  selectedDurationSeconds: number;
  isLoading: boolean;
  setActiveProjectId: (id: string) => void;
  setSelectedDurationSeconds: (seconds: number) => void;
  createProject: () => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
  updateSettings: (settings: Partial<StudioSettings>) => void;
  generatePreview: () => Promise<void>;
  cancelGeneration: () => void;
  exportVideo: () => void;
  buyCredits: () => void;
  deductCredits: (durationSeconds: number) => boolean;
  canAffordDuration: (durationSeconds: number) => boolean;
  refreshProjects: () => Promise<void>;
}

const StudioContext = createContext<StudioContextType | null>(null);

// Map database status to app status
function mapDbStatus(dbStatus: string): ProjectStatus {
  switch (dbStatus) {
    case 'completed': return 'completed';
    case 'generating': return 'generating';
    case 'rendering': return 'rendering';
    default: return 'idle';
  }
}

// Map database project to app Project type
function mapDbProject(dbProject: any): Project {
  return {
    id: dbProject.id,
    studio_id: 'studio-1',
    name: dbProject.title,
    status: mapDbStatus(dbProject.status),
    script_content: dbProject.script_content || dbProject.generated_script,
    environment_prompt: dbProject.setting,
    voice_id: undefined,
    character_id: undefined,
    created_at: dbProject.created_at,
    updated_at: dbProject.updated_at,
    duration_seconds: dbProject.target_duration_minutes * 60,
    credits_used: 0,
    voice_audio_url: dbProject.voice_audio_url,
    video_url: dbProject.video_url,
    video_clips: dbProject.video_clips || [],
    include_narration: true,
    target_duration_minutes: dbProject.target_duration_minutes,
    thumbnail_url: dbProject.thumbnail_url,
  };
}

export function StudioProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [credits, setCredits] = useState<UserCredits>(MOCK_CREDITS);
  const [layers] = useState<AssetLayer[]>(MOCK_LAYERS);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDurationSeconds, setSelectedDurationSeconds] = useState(8);
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress>({
    step: 'idle',
    percent: 0,
    estimatedSecondsRemaining: null,
  });
  
  // Cancel flag ref
  const cancelRef = useRef(false);
  
  const [settings, setSettings] = useState<StudioSettings>({
    lighting: 'natural',
    lightingIntensity: 75,
    wildlifeDensity: 40,
    bookshelfItems: ['Books', 'Plants'],
    environment: 'jungle_studio',
    resolution: '4K',
    visualStyle: 'cinematic',
  });

  const activeProject = projects.find((p) => p.id === activeProjectId) || null;

  // Load projects from database on mount
  const refreshProjects = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('movie_projects')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error loading projects:', error);
        toast.error('Failed to load projects');
        return;
      }

      const mappedProjects = (data || []).map(mapDbProject);
      setProjects(mappedProjects);
      
      // Set active project to first one if not set
      if (mappedProjects.length > 0 && !activeProjectId) {
        setActiveProjectId(mappedProjects[0].id);
      }
    } catch (err) {
      console.error('Error loading projects:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshProjects();
  }, []);

  const createProject = async () => {
    try {
      const { data, error } = await supabase
        .from('movie_projects')
        .insert({
          title: `Untitled Project ${projects.length + 1}`,
          status: 'draft',
          target_duration_minutes: 1,
        })
        .select()
        .single();

      if (error) throw error;

      const newProject = mapDbProject(data);
      setProjects((prev) => [newProject, ...prev]);
      setActiveProjectId(newProject.id);
      toast.success('New project created');
    } catch (err) {
      console.error('Error creating project:', err);
      toast.error('Failed to create project');
    }
  };

  const deleteProject = async (projectId: string) => {
    try {
      const { error } = await supabase
        .from('movie_projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;

      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      if (activeProjectId === projectId && projects.length > 1) {
        const remaining = projects.filter(p => p.id !== projectId);
        setActiveProjectId(remaining[0]?.id || null);
      }
      toast.success('Project deleted');
    } catch (err) {
      console.error('Error deleting project:', err);
      toast.error('Failed to delete project');
    }
  };

  const updateProject = async (id: string, updates: Partial<Project>) => {
    // Update local state immediately
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates, updated_at: new Date().toISOString() } : p))
    );

    // Prepare database update
    const dbUpdates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    
    if (updates.name !== undefined) dbUpdates.title = updates.name;
    if (updates.script_content !== undefined) dbUpdates.script_content = updates.script_content;
    if (updates.status !== undefined) dbUpdates.status = updates.status === 'idle' ? 'draft' : updates.status;
    if (updates.video_url !== undefined) dbUpdates.video_url = updates.video_url;
    if (updates.video_clips !== undefined) dbUpdates.video_clips = updates.video_clips;
    if (updates.voice_audio_url !== undefined) dbUpdates.voice_audio_url = updates.voice_audio_url;
    if (updates.target_duration_minutes !== undefined) dbUpdates.target_duration_minutes = updates.target_duration_minutes;

    try {
      const { error } = await supabase
        .from('movie_projects')
        .update(dbUpdates)
        .eq('id', id);

      if (error) {
        console.error('Error updating project:', error);
      }
    } catch (err) {
      console.error('Error updating project:', err);
    }
  };

  const updateSettings = (newSettings: Partial<StudioSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  // Cancel generation
  const cancelGeneration = async () => {
    cancelRef.current = true;
    setIsGenerating(false);
    setGenerationProgress({ step: 'idle', percent: 0, estimatedSecondsRemaining: null });
    
    if (activeProjectId) {
      await updateProject(activeProjectId, { status: 'idle' as ProjectStatus });
    }
    
    toast.info('Video generation cancelled');
  };

  const pollingRef = useRef<number | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const generatePreview = async () => {
    if (!activeProject?.script_content?.trim()) {
      toast.error('Please add a script first');
      return;
    }

    cancelRef.current = false; // Reset cancel flag
    setIsGenerating(true);
    const script = activeProject.script_content;
    const projectId = activeProjectId!;
    const includeNarration = activeProject.include_narration !== false;
    
    // Calculate clips based on script word count (avg speaking rate: 150 words/min)
    const words = script.split(/\s+/).filter(w => w.trim());
    const wordCount = words.length;
    const estimatedNarrationSeconds = Math.ceil((wordCount / 150) * 60);
    
    // Use the longer of: estimated narration time or target duration
    const targetDuration = activeProject.target_duration_minutes || 1;
    const targetSeconds = Math.max(estimatedNarrationSeconds, targetDuration * 60);
    
    const clipDuration = 8;
    const numClips = Math.max(1, Math.ceil(targetSeconds / clipDuration));
    const wordsPerClip = Math.ceil(wordCount / numClips);
    
    // More accurate time estimates: ~90-180 seconds per clip for Runway
    const estimatedSecondsPerClip = 120; // 2 minutes avg per clip
    const voiceGenerationTime = includeNarration ? 30 : 0;
    const totalEstimatedSeconds = voiceGenerationTime + (numClips * estimatedSecondsPerClip);
    let generationStartTime = Date.now();

    try {
      await updateProject(projectId, { status: 'generating' as ProjectStatus, video_clips: [] });
      
      // Step 1: Generate Voice Narration (if enabled)
      if (includeNarration) {
        setGenerationProgress({ 
          step: 'voice', 
          percent: 5, 
          estimatedSecondsRemaining: totalEstimatedSeconds 
        });
        toast.info('Generating AI narration with ElevenLabs...');
        
        const voiceResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-voice`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ text: script }),
          }
        );

        if (!voiceResponse.ok) {
          const errData = await voiceResponse.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to generate voice');
        }

        const audioBlob = await voiceResponse.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        await updateProject(projectId, { voice_audio_url: audioUrl });
        toast.success('Voice narration generated!');
      }
      
      // Step 2: Generate video clips sequentially
      const completedClips: string[] = [];
      const baseProgress = includeNarration ? 15 : 5;
      const progressPerClip = (85 - baseProgress) / numClips;
      
      toast.info(`Generating ${numClips} video clip${numClips > 1 ? 's' : ''} (${clipDuration}s each) - Est. ${Math.ceil(numClips * estimatedSecondsPerClip / 60)} min`);
      await updateProject(projectId, { status: 'rendering' as ProjectStatus });

      // Build comprehensive scene consistency description from script
      const sceneDescription = buildSceneConsistencyPrompt(script, activeProject);
      
      // Track actual generation times for better estimates
      let clipTimesMs: number[] = [];

      for (let i = 0; i < numClips; i++) {
        // Check for cancellation
        if (cancelRef.current) {
          throw new Error('Generation cancelled');
        }
        
        const clipStartTime = Date.now();
        const clipStartWord = i * wordsPerClip;
        const clipEndWord = Math.min((i + 1) * wordsPerClip, words.length);
        const clipText = words.slice(clipStartWord, clipEndWord).join(' ');
        
        // Calculate remaining time based on actual clip times or estimates
        const avgClipTime = clipTimesMs.length > 0 
          ? clipTimesMs.reduce((a, b) => a + b, 0) / clipTimesMs.length / 1000
          : estimatedSecondsPerClip;
        const remainingClips = numClips - i;
        const estimatedRemaining = Math.round(remainingClips * avgClipTime);
        
        setGenerationProgress({ 
          step: 'video', 
          percent: Math.round(baseProgress + i * progressPerClip), 
          estimatedSecondsRemaining: estimatedRemaining,
          currentClip: i + 1,
          totalClips: numClips
        });

        // Create extensive prompt with scene/character consistency, full script context, and visual style
        const videoPrompt = buildClipPrompt(clipText, sceneDescription, i, numClips, script, settings.visualStyle);
        
        // Start video generation
        const { data: videoData, error: videoError } = await supabase.functions.invoke('generate-video', {
          body: { prompt: videoPrompt, duration: clipDuration },
        });

        if (videoError || !videoData?.success) {
          throw new Error(videoData?.error || videoError?.message || `Failed to start clip ${i + 1}`);
        }

        toast.info(`Clip ${i + 1}/${numClips} generating...`);
        
        // Poll for this clip's completion
        const taskId = videoData.taskId;
        let clipUrl: string | null = null;
        let pollAttempts = 0;
        const maxPolls = 60; // 5 minutes max per clip

        while (!clipUrl && pollAttempts < maxPolls) {
          // Check for cancellation
          if (cancelRef.current) {
            throw new Error('Generation cancelled');
          }
          
          await new Promise(resolve => setTimeout(resolve, 5000));
          pollAttempts++;
          
          // Calculate time estimates based on actual elapsed time and averages
          const elapsedClipTime = (Date.now() - clipStartTime) / 1000;
          const avgClipTime = clipTimesMs.length > 0 
            ? clipTimesMs.reduce((a, b) => a + b, 0) / clipTimesMs.length / 1000
            : estimatedSecondsPerClip;
          const remainingClips = numClips - i - 1;
          const estimatedRemainingForCurrentClip = Math.max(0, avgClipTime - elapsedClipTime);
          const estimatedRemaining = Math.round(estimatedRemainingForCurrentClip + remainingClips * avgClipTime);
          
          const pollProgress = baseProgress + i * progressPerClip + (progressPerClip * 0.8 * pollAttempts / maxPolls);
          setGenerationProgress({ 
            step: 'polling', 
            percent: Math.round(pollProgress), 
            estimatedSecondsRemaining: Math.max(10, estimatedRemaining),
            currentClip: i + 1,
            totalClips: numClips
          });

          const { data: statusData, error: statusError } = await supabase.functions.invoke('check-video-status', {
            body: { taskId },
          });

          if (statusError) {
            console.error('Status check error:', statusError);
            continue;
          }

          if (statusData?.status === 'SUCCEEDED' && statusData?.videoUrl) {
            clipUrl = statusData.videoUrl;
            completedClips.push(clipUrl);
            // Track actual clip generation time
            clipTimesMs.push(Date.now() - clipStartTime);
            // Save to database after each clip completes
            await updateProject(projectId, { video_clips: [...completedClips] });
            toast.success(`Clip ${i + 1}/${numClips} complete!`);
          } else if (statusData?.status === 'FAILED') {
            throw new Error(statusData.error || `Clip ${i + 1} generation failed`);
          }
        }

        if (!clipUrl) {
          throw new Error(`Clip ${i + 1} timed out`);
        }
      }

      // All clips complete - save final state to database
      await updateProject(projectId, {
        status: 'completed' as ProjectStatus,
        video_url: completedClips[0], // First clip as primary
        video_clips: completedClips,
        duration_seconds: numClips * clipDuration,
        credits_used: numClips * clipDuration * 10,
      });
      
      setGenerationProgress({ step: 'idle', percent: 100, estimatedSecondsRemaining: null });
      setIsGenerating(false);
      toast.success(`All ${numClips} clips generated! Total: ${numClips * clipDuration}s`);

      // Auto-generate thumbnail in background
      toast.info('Generating cinematic thumbnail...');
      try {
        const thumbnailPrompt = buildSceneConsistencyPrompt(script, activeProject);
        const { data: thumbData, error: thumbError } = await supabase.functions.invoke('generate-thumbnail', {
          body: { 
            prompt: thumbnailPrompt,
            projectId,
            projectName: activeProject.name,
          },
        });
        
        if (thumbError) {
          console.error('Thumbnail generation error:', thumbError);
        } else if (thumbData?.thumbnailUrl) {
          // Update local state with thumbnail
          setProjects(prev => prev.map(p => 
            p.id === projectId ? { ...p, thumbnail_url: thumbData.thumbnailUrl } : p
          ));
          toast.success('Thumbnail generated!');
        }
      } catch (thumbErr) {
        console.error('Failed to generate thumbnail:', thumbErr);
        // Don't fail the whole process for thumbnail
      }

    } catch (error) {
      console.error('Generation error:', error);
      const message = error instanceof Error ? error.message : 'Generation failed';
      toast.error(message);
      await updateProject(projectId, { status: 'idle' as ProjectStatus });
      setGenerationProgress({ step: 'idle', percent: 0, estimatedSecondsRemaining: null });
      setIsGenerating(false);
      if (pollingRef.current) clearInterval(pollingRef.current);
    }
  };

  const exportVideo = () => {
    toast.success('Exporting 4K MP4 with commercial license metadata...');
  };

  const buyCredits = () => {
    toast.info('Opening Stripe checkout...');
  };

  const getCreditsForDuration = (durationSeconds: number): number => {
    if (durationSeconds <= 8) return DURATION_CREDIT_COSTS[8];
    if (durationSeconds <= 30) return DURATION_CREDIT_COSTS[30];
    return DURATION_CREDIT_COSTS[60];
  };

  const canAffordDuration = (durationSeconds: number): boolean => {
    const required = getCreditsForDuration(durationSeconds);
    return credits.remaining >= required;
  };

  const deductCredits = (durationSeconds: number): boolean => {
    const required = getCreditsForDuration(durationSeconds);
    
    if (credits.remaining < required) {
      toast.error(`Insufficient credits! You need ${required.toLocaleString()} credits but only have ${credits.remaining.toLocaleString()}.`);
      return false;
    }
    
    setCredits(prev => ({
      ...prev,
      used: prev.used + required,
      remaining: prev.remaining - required,
    }));
    
    toast.success(`${required.toLocaleString()} credits deducted for ${durationSeconds}s video`);
    return true;
  };

  return (
    <StudioContext.Provider
      value={{
        projects,
        activeProjectId,
        activeProject,
        credits,
        layers,
        settings,
        isGenerating,
        generationProgress,
        selectedDurationSeconds,
        isLoading,
        setActiveProjectId,
        setSelectedDurationSeconds,
        createProject,
        deleteProject,
        updateProject,
        updateSettings,
        generatePreview,
        cancelGeneration,
        exportVideo,
        buyCredits,
        deductCredits,
        canAffordDuration,
        refreshProjects,
      }}
    >
      {children}
    </StudioContext.Provider>
  );
}

export function useStudio() {
  const context = useContext(StudioContext);
  if (!context) {
    throw new Error('useStudio must be used within a StudioProvider');
  }
  return context;
}
