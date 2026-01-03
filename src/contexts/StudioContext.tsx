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

interface StudioContextType {
  projects: Project[];
  activeProjectId: string | null;
  activeProject: Project | null;
  credits: UserCredits;
  layers: AssetLayer[];
  settings: StudioSettings;
  isGenerating: boolean;
  setActiveProjectId: (id: string) => void;
  createProject: () => void;
  deleteProject: (id: string) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  updateSettings: (settings: Partial<StudioSettings>) => void;
  generatePreview: () => Promise<void>;
  exportVideo: () => void;
  buyCredits: () => void;
}

const StudioContext = createContext<StudioContextType | null>(null);

export function StudioProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(MOCK_PROJECTS);
  const [activeProjectId, setActiveProjectId] = useState<string>(MOCK_PROJECTS[0].id);
  const [credits] = useState<UserCredits>(MOCK_CREDITS);
  const [layers] = useState<AssetLayer[]>(MOCK_LAYERS);
  const [isGenerating, setIsGenerating] = useState(false);
  
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

    try {
      // Step 1: Generate Voice Narration
      updateProject(projectId, { status: 'generating' as ProjectStatus });
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

      // Step 2: Generate Video
      toast.info('Starting AI video generation with Runway...');
      
      const videoPrompt = `Cinematic video visualizing: ${script.slice(0, 500)}. 
        Create professional, engaging visuals that match this narration. 
        High quality, modern cinematography, smooth transitions.`;
      
      const { data: videoData, error: videoError } = await supabase.functions.invoke('generate-video', {
        body: { 
          prompt: videoPrompt,
          duration: 8
        },
      });

      if (videoError || !videoData?.success) {
        throw new Error(videoData?.error || videoError?.message || 'Failed to start video generation');
      }

      toast.success('Video generation started! This may take a few minutes...');
      updateProject(projectId, { status: 'rendering' as ProjectStatus });

      // Step 3: Poll for video completion
      const taskId = videoData.taskId;
      
      pollingRef.current = window.setInterval(async () => {
        try {
          const { data: statusData, error: statusError } = await supabase.functions.invoke('check-video-status', {
            body: { taskId },
          });

          if (statusError) {
            console.error('Status check error:', statusError);
            return;
          }

          if (statusData?.status === 'SUCCEEDED' && statusData?.videoUrl) {
            if (pollingRef.current) clearInterval(pollingRef.current);
            
            updateProject(projectId, {
              status: 'completed' as ProjectStatus,
              video_url: statusData.videoUrl,
              duration_seconds: Math.ceil(script.split(/\s+/).length / 2.5),
              credits_used: Math.ceil(script.split(/\s+/).length / 2.5) * 10,
            });
            
            setIsGenerating(false);
            toast.success('Video generation complete!');
          } else if (statusData?.status === 'FAILED') {
            if (pollingRef.current) clearInterval(pollingRef.current);
            setIsGenerating(false);
            updateProject(projectId, { status: 'idle' as ProjectStatus });
            toast.error(statusData.error || 'Video generation failed');
          }
        } catch (pollErr) {
          console.error('Polling error:', pollErr);
        }
      }, 5000);

    } catch (error) {
      console.error('Generation error:', error);
      const message = error instanceof Error ? error.message : 'Generation failed';
      toast.error(message);
      updateProject(projectId, { status: 'idle' as ProjectStatus });
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
        setActiveProjectId,
        createProject,
        deleteProject,
        updateProject,
        updateSettings,
        generatePreview,
        exportVideo,
        buyCredits,
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
