import { useState } from 'react';
import { Header } from '@/components/studio/Header';
import { VideoPreview } from '@/components/studio/VideoPreview';
import { ScriptPanel } from '@/components/studio/ScriptPanel';
import { SettingsSidebar } from '@/components/studio/SettingsSidebar';
import { CreditsDisplay } from '@/components/studio/CreditsDisplay';
import { AssetLayersPanel } from '@/components/studio/AssetLayersPanel';
import { ProjectList } from '@/components/studio/ProjectList';
import { 
  Project, 
  StudioSettings, 
  UserCredits, 
  AssetLayer,
  ProjectStatus 
} from '@/types/studio';
import { toast } from 'sonner';

// Mock data for demonstration
const MOCK_PROJECTS: Project[] = [
  {
    id: '1',
    studio_id: 'studio-1',
    name: 'Jungle Product Demo',
    status: 'completed',
    script_content: 'Welcome to our revolutionary product...',
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
    script_content: 'In this tutorial, we will explore...',
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
  {
    id: 'layer-1',
    project_id: '1',
    layer_type: 'background_video',
    status: 'completed',
    z_index: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: 'layer-2',
    project_id: '1',
    layer_type: 'character_video',
    status: 'completed',
    z_index: 1,
    created_at: new Date().toISOString(),
  },
  {
    id: 'layer-3',
    project_id: '1',
    layer_type: 'audio_narration',
    status: 'completed',
    z_index: 2,
    created_at: new Date().toISOString(),
  },
  {
    id: 'layer-4',
    project_id: '1',
    layer_type: 'overlay_metadata',
    status: 'idle',
    z_index: 3,
    created_at: new Date().toISOString(),
  },
];

export function DirectorDashboard() {
  const [projects, setProjects] = useState<Project[]>(MOCK_PROJECTS);
  const [activeProjectId, setActiveProjectId] = useState<string>(MOCK_PROJECTS[0].id);
  const [credits] = useState<UserCredits>(MOCK_CREDITS);
  const [layers] = useState<AssetLayer[]>(MOCK_LAYERS);

  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0];

  const [script, setScript] = useState(activeProject?.script_content || '');
  const [voiceId, setVoiceId] = useState(activeProject?.voice_id || 'EXAVITQu4vr4xnSDxMaL');
  const [characterId, setCharacterId] = useState(activeProject?.character_id || 'avatar_001');
  const [isGenerating, setIsGenerating] = useState(false);

  const [settings, setSettings] = useState<StudioSettings>({
    lighting: 'natural',
    lightingIntensity: 75,
    wildlifeDensity: 40,
    bookshelfItems: ['Books', 'Plants'],
    environment: 'jungle_studio',
    resolution: '4K',
  });

  const handleSettingsChange = (newSettings: Partial<StudioSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const handleCreateProject = () => {
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
    setScript('');
    toast.success('New project created');
  };

  const handleDeleteProject = (projectId: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    if (activeProjectId === projectId && projects.length > 1) {
      setActiveProjectId(projects[0].id === projectId ? projects[1].id : projects[0].id);
    }
    toast.success('Project deleted');
  };

  const handleGeneratePreview = async () => {
    if (!script.trim()) {
      toast.error('Please add a script first');
      return;
    }

    setIsGenerating(true);

    // Update project status
    setProjects((prev) =>
      prev.map((p) =>
        p.id === activeProjectId
          ? { ...p, status: 'generating' as ProjectStatus, updated_at: new Date().toISOString() }
          : p
      )
    );

    // Simulate API calls
    toast.info('Generating AI narration with ElevenLabs...');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    toast.info('Creating AI presenter with HeyGen...');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    toast.info('Generating living background with Runway...');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    setProjects((prev) =>
      prev.map((p) =>
        p.id === activeProjectId
          ? { ...p, status: 'rendering' as ProjectStatus, updated_at: new Date().toISOString() }
          : p
      )
    );

    toast.info('Compositing layers in 4K...');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    setProjects((prev) =>
      prev.map((p) =>
        p.id === activeProjectId
          ? { 
              ...p, 
              status: 'completed' as ProjectStatus, 
              updated_at: new Date().toISOString(),
              duration_seconds: Math.ceil(script.split(/\s+/).length / 2.5),
              credits_used: Math.ceil(script.split(/\s+/).length / 2.5) * 10,
            }
          : p
      )
    );

    setIsGenerating(false);
    toast.success('Video generated successfully!');
  };

  const handleExport = () => {
    toast.success('Exporting 4K MP4 with commercial license metadata...');
  };

  const handleBuyCredits = () => {
    toast.info('Opening Stripe checkout...');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header
        projectName={activeProject?.name || 'Untitled Project'}
        status={activeProject?.status || 'idle'}
        onExport={handleExport}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Projects */}
        <aside className="hidden lg:flex w-72 border-r border-border/50 flex-col">
          <div className="flex-1 overflow-hidden">
            <ProjectList
              projects={projects}
              activeProjectId={activeProjectId}
              onSelectProject={setActiveProjectId}
              onCreateProject={handleCreateProject}
              onDeleteProject={handleDeleteProject}
            />
          </div>
          <div className="p-4 border-t border-border/50">
            <CreditsDisplay credits={credits} onBuyCredits={handleBuyCredits} />
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Video Preview & Layers */}
          <div className="flex-1 p-4 lg:p-6 space-y-4 overflow-y-auto">
            <VideoPreview
              status={activeProject?.status || 'idle'}
            />
            <AssetLayersPanel layers={activeProject?.id === '1' ? layers : []} />
          </div>

          {/* Script Panel */}
          <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-border/50">
            <ScriptPanel
              script={script}
              voiceId={voiceId}
              characterId={characterId}
              onScriptChange={setScript}
              onVoiceChange={setVoiceId}
              onCharacterChange={setCharacterId}
              onGeneratePreview={handleGeneratePreview}
              isGenerating={isGenerating}
            />
          </div>
        </main>

        {/* Right Sidebar - Settings */}
        <aside className="hidden xl:block w-80 border-l border-border/50">
          <SettingsSidebar settings={settings} onSettingsChange={handleSettingsChange} />
        </aside>
      </div>
    </div>
  );
}
