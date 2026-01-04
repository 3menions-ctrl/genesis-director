import { createContext, useContext, useState, useRef, useEffect, ReactNode } from 'react';
import { Project, StudioSettings, UserCredits, AssetLayer, ProjectStatus } from '@/types/studio';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// Mock data for demonstration
const MOCK_PROJECTS: Project[] = [
  {
    id: '1',
    studio_id: 'studio-1',
    name: 'Jungle Product Demo',
    status: 'completed',
    script_content: 'Welcome to our revolutionary product that will change the way you think about AI-powered video creation. In this demonstration, we will showcase the incredible capabilities of Apex Studio...',
    environment_prompt: 'jungle_studio',
    voice_id: 'EXAVITQu4vr4xnSDxMaL',
    character_id: 'avatar_001',
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 3600000).toISOString(),
    duration_seconds: 124,
    credits_used: 1240,
  },
  {
    id: '2',
    studio_id: 'studio-1',
    name: 'Tech Tutorial Series',
    status: 'rendering',
    script_content: 'In this tutorial, we will explore the fundamentals of modern web development...',
    environment_prompt: 'modern_office',
    voice_id: 'JBFqnCBsd6RMkjVDRZzb',
    character_id: 'avatar_002',
    created_at: new Date(Date.now() - 172800000).toISOString(),
    updated_at: new Date().toISOString(),
    duration_seconds: 0,
    credits_used: 0,
  },
  {
    id: '3',
    studio_id: 'studio-1',
    name: 'Meditation Guide',
    status: 'idle',
    created_at: new Date(Date.now() - 604800000).toISOString(),
    updated_at: new Date(Date.now() - 604800000).toISOString(),
  },
];

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
  setActiveProjectId: (id: string) => void;
  setSelectedDurationSeconds: (seconds: number) => void;
  createProject: () => void;
  deleteProject: (id: string) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  updateSettings: (settings: Partial<StudioSettings>) => void;
  generatePreview: () => Promise<void>;
  exportVideo: () => void;
  buyCredits: () => void;
  deductCredits: (durationSeconds: number) => boolean;
  canAffordDuration: (durationSeconds: number) => boolean;
}

const StudioContext = createContext<StudioContextType | null>(null);

export function StudioProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(MOCK_PROJECTS);
  const [activeProjectId, setActiveProjectId] = useState<string>(MOCK_PROJECTS[0].id);
  const [credits, setCredits] = useState<UserCredits>(MOCK_CREDITS);
  const [layers] = useState<AssetLayer[]>(MOCK_LAYERS);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedDurationSeconds, setSelectedDurationSeconds] = useState(8); // Default to 8 seconds
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress>({
    step: 'idle',
    percent: 0,
    estimatedSecondsRemaining: null,
  });
  
  const [settings, setSettings] = useState<StudioSettings>({
    lighting: 'natural',
    lightingIntensity: 75,
    wildlifeDensity: 40,
    bookshelfItems: ['Books', 'Plants'],
    environment: 'jungle_studio',
    resolution: '4K',
  });

  const activeProject = projects.find((p) => p.id === activeProjectId) || null;

  const createProject = () => {
    const newProject: Project = {
      id: `project-${Date.now()}`,
      studio_id: 'studio-1',
      name: `Untitled Project ${projects.length + 1}`,
      status: 'idle',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setProjects((prev) => [newProject, ...prev]);
    setActiveProjectId(newProject.id);
    toast.success('New project created');
  };

  const deleteProject = (projectId: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    if (activeProjectId === projectId && projects.length > 1) {
      setActiveProjectId(projects[0].id === projectId ? projects[1].id : projects[0].id);
    }
    toast.success('Project deleted');
  };

  const updateProject = (id: string, updates: Partial<Project>) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates, updated_at: new Date().toISOString() } : p))
    );
  };

  const updateSettings = (newSettings: Partial<StudioSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
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

    setIsGenerating(true);
    const script = activeProject.script_content;
    const projectId = activeProjectId;
    const includeNarration = activeProject.include_narration !== false;
    const targetDuration = activeProject.target_duration_minutes || 1;
    
    // Calculate number of 8-second clips needed (target is in minutes)
    const targetSeconds = targetDuration * 60;
    const clipDuration = 8;
    const numClips = Math.max(1, Math.ceil(targetSeconds / clipDuration));
    
    // Split script into segments for each clip
    const words = script.split(/\s+/);
    const wordsPerClip = Math.ceil(words.length / numClips);

    try {
      updateProject(projectId, { status: 'generating' as ProjectStatus, video_clips: [] });
      
      // Step 1: Generate Voice Narration (if enabled)
      if (includeNarration) {
        setGenerationProgress({ step: 'voice', percent: 5, estimatedSecondsRemaining: 120 + numClips * 60 });
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
        updateProject(projectId, { voice_audio_url: audioUrl });
        toast.success('Voice narration generated!');
      }
      
      // Step 2: Generate video clips sequentially
      const completedClips: string[] = [];
      const baseProgress = includeNarration ? 15 : 5;
      const progressPerClip = (85 - baseProgress) / numClips;
      
      toast.info(`Generating ${numClips} video clip${numClips > 1 ? 's' : ''} (${clipDuration}s each)...`);
      updateProject(projectId, { status: 'rendering' as ProjectStatus });

      for (let i = 0; i < numClips; i++) {
        const clipStartWord = i * wordsPerClip;
        const clipEndWord = Math.min((i + 1) * wordsPerClip, words.length);
        const clipText = words.slice(clipStartWord, clipEndWord).join(' ');
        
        setGenerationProgress({ 
          step: 'video', 
          percent: Math.round(baseProgress + i * progressPerClip), 
          estimatedSecondsRemaining: (numClips - i) * 60,
          currentClip: i + 1,
          totalClips: numClips
        });

        const videoPrompt = `Cinematic video visualizing: ${clipText.slice(0, 400)}. 
          Create professional, engaging visuals. High quality cinematography.
          ${i > 0 ? 'Continue the visual style from previous scene.' : ''}`;
        
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
          await new Promise(resolve => setTimeout(resolve, 5000));
          pollAttempts++;
          
          const pollProgress = baseProgress + i * progressPerClip + (progressPerClip * 0.8 * pollAttempts / maxPolls);
          setGenerationProgress({ 
            step: 'polling', 
            percent: Math.round(pollProgress), 
            estimatedSecondsRemaining: Math.max(10, (numClips - i) * 60 - pollAttempts * 5),
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
            updateProject(projectId, { video_clips: [...completedClips] });
            toast.success(`Clip ${i + 1}/${numClips} complete!`);
          } else if (statusData?.status === 'FAILED') {
            throw new Error(statusData.error || `Clip ${i + 1} generation failed`);
          }
        }

        if (!clipUrl) {
          throw new Error(`Clip ${i + 1} timed out`);
        }
      }

      // All clips complete
      updateProject(projectId, {
        status: 'completed' as ProjectStatus,
        video_url: completedClips[0], // First clip as primary
        video_clips: completedClips,
        duration_seconds: numClips * clipDuration,
        credits_used: numClips * clipDuration * 10,
      });
      
      setGenerationProgress({ step: 'idle', percent: 100, estimatedSecondsRemaining: null });
      setIsGenerating(false);
      toast.success(`All ${numClips} clips generated! Total: ${numClips * clipDuration}s`);

    } catch (error) {
      console.error('Generation error:', error);
      const message = error instanceof Error ? error.message : 'Generation failed';
      toast.error(message);
      updateProject(projectId, { status: 'idle' as ProjectStatus });
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
        setActiveProjectId,
        setSelectedDurationSeconds,
        createProject,
        deleteProject,
        updateProject,
        updateSettings,
        generatePreview,
        exportVideo,
        buyCredits,
        deductCredits,
        canAffordDuration,
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
