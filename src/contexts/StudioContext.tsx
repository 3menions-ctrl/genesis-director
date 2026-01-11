import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Project, StudioSettings, UserCredits, AssetLayer, ProjectStatus } from '@/types/studio';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { TIER_CREDIT_COSTS } from '@/hooks/useCreditBilling';
import type { QualityTier } from '@/types/quality-tiers';
const DEFAULT_CREDITS: UserCredits = {
  total: 50,
  used: 0,
  remaining: 50,
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
  isLoading: boolean;
  hasLoadedOnce: boolean; // True after first successful load attempt
  setActiveProjectId: (id: string) => void;
  createProject: () => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
  updateSettings: (settings: Partial<StudioSettings>) => void;
  refreshCredits: () => Promise<void>;
  refreshProjects: () => Promise<void>;
  canAffordShots: (shotCount: number) => boolean;
}

const StudioContext = createContext<StudioContextType | null>(null);

// Map database status to app status
function mapDbStatus(dbStatus: string): ProjectStatus {
  switch (dbStatus) {
    case 'completed': return 'completed';
    case 'generating': return 'generating';
    case 'rendering': return 'rendering';
    case 'producing': return 'generating'; // Active production maps to generating
    case 'stitching': return 'stitching';
    case 'stitching_failed': return 'stitching_failed';
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
    include_narration: dbProject.include_narration ?? true,
    target_duration_minutes: dbProject.target_duration_minutes,
    thumbnail_url: dbProject.thumbnail_url,
    pending_video_tasks: dbProject.pending_video_tasks || [],
  };
}

export function StudioProvider({ children }: { children: ReactNode }) {
  const { user, session, profile, refreshProfile, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [credits, setCredits] = useState<UserCredits>(DEFAULT_CREDITS);
  const [layers] = useState<AssetLayer[]>(MOCK_LAYERS);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  
  const [settings, setSettings] = useState<StudioSettings>({
    lighting: 'natural',
    lightingIntensity: 75,
    wildlifeDensity: 40,
    bookshelfItems: ['Books', 'Plants'],
    environment: 'jungle_studio',
    resolution: '4K',
    visualStyle: 'cinematic',
    characters: [],
    scenes: [],
    sceneImages: [],
    useImageToVideo: true,
    useFrameChaining: true,
    useMasterImage: true,
    usePersistentSeed: true,
    rewriteCameraPrompts: true,
  });

  const activeProject = projects.find((p) => p.id === activeProjectId) || null;

  // Internal function that loads and returns projects - ALWAYS verify session first
  const loadProjects = useCallback(async (): Promise<Project[]> => {
    // CRITICAL: Always get fresh session from Supabase client, not React state
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    
    console.log('[StudioContext] loadProjects called, session:', currentSession ? 'VALID' : 'NULL', 
                'userId:', currentSession?.user?.id?.slice(0, 8) + '...');
    
    if (!currentSession?.user) {
      console.log('[StudioContext] No valid session, clearing projects');
      setProjects([]);
      setIsLoading(false);
      return [];
    }

    try {
      setIsLoading(true);
      console.log('[StudioContext] Fetching projects for user:', currentSession.user.id.slice(0, 8) + '...');
      
      // Use the session's user ID directly, not React state
      const { data, error } = await supabase
        .from('movie_projects')
        .select('*')
        .eq('user_id', currentSession.user.id) // Explicit user_id filter
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('[StudioContext] Error loading projects:', error);
        // Don't clear projects on error - might be transient
        return projects;
      }

      console.log('[StudioContext] Loaded', data?.length || 0, 'projects');
      
      if (!data || data.length === 0) {
        console.log('[StudioContext] No projects found for user');
        setProjects([]);
        setIsLoading(false);
        setHasLoadedOnce(true);
        return [];
      }
      
      const mappedProjects = data.map(mapDbProject);
      setProjects(mappedProjects);
      setHasLoadedOnce(true);
      
      // Set active project to first one if not set or if current doesn't exist
      if (mappedProjects.length > 0) {
        const currentProjectExists = activeProjectId && mappedProjects.some(p => p.id === activeProjectId);
        if (!currentProjectExists) {
          setActiveProjectId(mappedProjects[0].id);
        }
      }
      
      return mappedProjects;
    } catch (err) {
      console.error('[StudioContext] Error loading projects:', err);
      return projects;
    } finally {
      setIsLoading(false);
    }
  }, [activeProjectId, projects]);

  // Public function that doesn't return projects
  const refreshProjects = async (): Promise<void> => {
    await loadProjects();
  };

  // Load projects when auth finishes loading
  useEffect(() => {
    // Don't load while auth is still checking session
    if (authLoading) {
      console.log('[StudioContext] Auth still loading, waiting...');
      return;
    }
    
    // If we have a user, load projects
    if (user) {
      console.log('[StudioContext] User authenticated, loading projects');
      loadProjects();
    } else {
      // Clear state when logged out
      console.log('[StudioContext] No user, clearing projects');
      setProjects([]);
      setActiveProjectId(null);
      setIsLoading(false);
      setHasLoadedOnce(false);
    }
  }, [authLoading, user?.id]); // Only depend on authLoading and user?.id, not session

  // Sync credits from auth profile
  useEffect(() => {
    if (profile) {
      setCredits({
        total: profile.total_credits_purchased + 50, // Include welcome bonus
        used: profile.total_credits_used,
        remaining: profile.credits_balance,
      });
    } else {
      setCredits(DEFAULT_CREDITS);
    }
  }, [profile]);

  const createProject = async () => {
    // Verify we have a valid session before creating
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    
    if (!currentSession?.user) {
      toast.error('Please sign in to create a project');
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('movie_projects')
        .insert({
          title: `Untitled Project ${projects.length + 1}`,
          status: 'draft',
          target_duration_minutes: 1,
          user_id: currentSession.user.id, // Use session user ID directly
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
    // Verify session before deleting
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession) {
      toast.error('Session expired. Please sign in again.');
      return;
    }
    
    try {
      // Find the project to get its video URLs before deletion
      const projectToDelete = projects.find(p => p.id === projectId);
      
      // Delete the project from database first
      const { error } = await supabase
        .from('movie_projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;

      // Clean up video files from storage if they exist
      if (projectToDelete) {
        const videosToDelete: string[] = [];
        
        // Collect all video URLs
        if (projectToDelete.video_clips?.length) {
          videosToDelete.push(...projectToDelete.video_clips);
        }
        if (projectToDelete.video_url) {
          videosToDelete.push(projectToDelete.video_url);
        }
        if (projectToDelete.voice_audio_url) {
          videosToDelete.push(projectToDelete.voice_audio_url);
        }
        if (projectToDelete.thumbnail_url) {
          videosToDelete.push(projectToDelete.thumbnail_url);
        }
        
        // Extract storage paths and delete files (only for Supabase storage URLs)
        for (const url of videosToDelete) {
          if (!url) continue;
          
          try {
            // Only process Supabase storage URLs
            if (!url.includes('supabase.co/storage/v1/object/public/')) {
              continue;
            }
            
            // Parse the URL to get bucket and path
            const urlObj = new URL(url);
            const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
            
            if (pathMatch) {
              const bucket = pathMatch[1];
              const path = decodeURIComponent(pathMatch[2]);
              
              if (bucket && path) {
                await supabase.storage.from(bucket).remove([path]);
              }
            }
          } catch {
            // Silently fail if storage cleanup fails - non-critical
          }
        }
      }

      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      if (activeProjectId === projectId && projects.length > 1) {
        const remaining = projects.filter(p => p.id !== projectId);
        setActiveProjectId(remaining[0]?.id || null);
      }
      toast.success('Project and all videos permanently deleted');
    } catch (err) {
      console.error('Error deleting project:', err);
      toast.error('Failed to delete project');
    }
  };

  const updateProject = async (id: string, updates: Partial<Project>) => {
    // Update local state immediately for responsive UI
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates, updated_at: new Date().toISOString() } : p))
    );

    // Verify session before updating
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession) {
      console.error('No valid session for update');
      await refreshProjects(); // Revert local state
      return;
    }

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
    if (updates.include_narration !== undefined) dbUpdates.include_narration = updates.include_narration;

    // Only proceed if there are actual updates beyond timestamp
    if (Object.keys(dbUpdates).length <= 1) return;

    try {
      const { error } = await supabase
        .from('movie_projects')
        .update(dbUpdates)
        .eq('id', id);

      if (error) {
        console.error('Error updating project:', error);
        if (updates.script_content !== undefined) {
          toast.error('Failed to save script. Please try again.');
        }
        await refreshProjects();
      } else if (updates.script_content !== undefined) {
        toast.success('Script saved');
      }
    } catch (err) {
      console.error('Error updating project:', err);
      toast.error('Failed to save changes');
    }
  };

  const updateSettings = (newSettings: Partial<StudioSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  // Refresh credits from profile - used after billing operations
  const refreshCredits = async () => {
    await refreshProfile();
  };

  // Check if user can afford a number of shots with tier-aware pricing
  const canAffordShots = (shotCount: number, tier: QualityTier = 'standard'): boolean => {
    const required = shotCount * TIER_CREDIT_COSTS[tier].TOTAL_PER_SHOT;
    return credits.remaining >= required;
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
        isLoading,
        hasLoadedOnce,
        setActiveProjectId,
        createProject,
        deleteProject,
        updateProject,
        updateSettings,
        refreshCredits,
        refreshProjects,
        canAffordShots,
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
