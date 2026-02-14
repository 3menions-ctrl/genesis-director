import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode, useRef } from 'react';
import { Project, StudioSettings, UserCredits, AssetLayer, ProjectStatus, parsePendingVideoTasks } from '@/types/studio';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { TIER_CREDIT_COSTS } from '@/hooks/useCreditBilling';
import type { QualityTier } from '@/types/quality-tiers';
// Default credits for unauthenticated state
const DEFAULT_CREDITS: UserCredits = {
  total: 0,
  used: 0,
  remaining: 0,
};

// PRODUCTION-READY: No mock layers - real data only from database

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
  createProject: () => Promise<string | null>;
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
  // Parse pending_video_tasks as object (backend format) with safe fallback
  const parsedTasks = parsePendingVideoTasks(dbProject.pending_video_tasks);
  
  // Legacy array format fallback for backward compatibility
  const legacyTasks = Array.isArray(dbProject.pending_video_tasks) 
    ? dbProject.pending_video_tasks 
    : [];

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
    include_narration: dbProject.include_narration ?? false,
    target_duration_minutes: dbProject.target_duration_minutes,
    thumbnail_url: dbProject.thumbnail_url,
    // Properly typed pipeline metadata object (contains clipDuration, clipCount, stage, etc.)
    pending_video_tasks_obj: parsedTasks,
    // Legacy array format for backward compatibility
    pending_video_tasks: legacyTasks,
    is_public: dbProject.is_public ?? false,
    genre: dbProject.genre || 'cinematic',
  };
}

export function StudioProvider({ children }: { children: ReactNode }) {
  // FIX: useAuth now returns a safe fallback if context is missing
  // No try-catch needed - that violated React's hook rules
  const { user, profile, refreshProfile, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [credits, setCredits] = useState<UserCredits>(DEFAULT_CREDITS);
  const [layers] = useState<AssetLayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const isMountedRef = useRef(true);
  
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

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const activeProject = projects.find((p) => p.id === activeProjectId) || null;

  // Internal function that loads and returns projects - ALWAYS verify session first
  // CRITICAL: Uses isMountedRef for safe state updates during async operations
  // FIX: Removed projects and activeProjectId from dependencies to prevent stale closure race
  const loadProjects = useCallback(async (): Promise<Project[]> => {
    // CRITICAL: Always get fresh session from Supabase client, not React state
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    
    console.log('[StudioContext] loadProjects called, session:', currentSession ? 'VALID' : 'NULL', 
                'userId:', currentSession?.user?.id?.slice(0, 8) + '...');
    
    if (!currentSession?.user) {
      console.log('[StudioContext] No valid session, clearing projects');
      if (isMountedRef.current) {
        setProjects([]);
        setIsLoading(false);
      }
      return [];
    }

    try {
      if (isMountedRef.current) {
        setIsLoading(true);
      }
      console.log('[StudioContext] Fetching projects for user:', currentSession.user.id.slice(0, 8) + '...');
      
      // Use the session's user ID directly, not React state
      const { data, error } = await supabase
        .from('movie_projects')
        .select('*')
        .eq('user_id', currentSession.user.id) // Explicit user_id filter
        .order('updated_at', { ascending: false })
        .limit(5); // Only load last 5 projects to prevent memory exhaustion

      // Check mount status after async operation
      if (!isMountedRef.current) return [];

      if (error) {
        console.error('[StudioContext] Error loading projects:', error);
        // Don't clear projects on error - might be transient
        return [];
      }

      console.log('[StudioContext] Loaded', data?.length || 0, 'projects');
      
      if (!data || data.length === 0) {
        console.log('[StudioContext] No projects found for user');
        if (isMountedRef.current) {
          setProjects([]);
          setIsLoading(false);
          setHasLoadedOnce(true);
        }
        return [];
      }
      
      // FAILSAFE: Enrich projects with clips from video_clips table
      // This ensures video_clips array is always populated even if the column is null
      const projectIds = data.map(p => p.id);
      const { data: allClips } = await supabase
        .from('video_clips')
        .select('project_id, video_url, shot_index, status')
        .in('project_id', projectIds)
        .eq('status', 'completed')
        .not('video_url', 'is', null)
        .order('shot_index', { ascending: true });
      
      // Check mount status after second async operation
      if (!isMountedRef.current) return [];
      
      // Group clips by project_id
      const clipsByProject: Record<string, string[]> = {};
      if (allClips) {
        for (const clip of allClips) {
          if (!clipsByProject[clip.project_id]) {
            clipsByProject[clip.project_id] = [];
          }
          clipsByProject[clip.project_id].push(clip.video_url);
        }
      }
      
      const mappedProjects = data.map(dbProject => {
        const mapped = mapDbProject(dbProject);
        // If project doesn't have video_clips but we found clips in the table, use those
        if ((!mapped.video_clips || mapped.video_clips.length === 0) && clipsByProject[dbProject.id]) {
          mapped.video_clips = clipsByProject[dbProject.id];
        }
        return mapped;
      });
      
      if (isMountedRef.current) {
        setProjects(mappedProjects);
        setHasLoadedOnce(true);
        
        // FIX: Use functional update to get current activeProjectId without depending on it
        setActiveProjectId(currentActiveId => {
          if (mappedProjects.length > 0) {
            const currentProjectExists = currentActiveId && mappedProjects.some(p => p.id === currentActiveId);
            if (!currentProjectExists) {
              return mappedProjects[0].id;
            }
          }
          return currentActiveId;
        });
      }
      
      return mappedProjects;
    } catch (err) {
      console.error('[StudioContext] Error loading projects:', err);
      return [];
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []); // FIX: Empty deps - function uses refs and functional updates instead

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
        total: profile.total_credits_purchased,
        used: profile.total_credits_used,
        remaining: profile.credits_balance,
      });
    } else {
      setCredits(DEFAULT_CREDITS);
    }
  }, [profile]);

  const createProject = async (): Promise<string | null> => {
    // Verify we have a valid session before creating
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    
    if (!currentSession?.user) {
      toast.error('Please sign in to create a project');
      return null;
    }
    
    try {
      // Generate a timestamped draft name - will be replaced with AI-generated title during video creation
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const draftTitle = `Draft ${dateStr} ${timeStr}`;
      
      const { data, error } = await supabase
        .from('movie_projects')
        .insert({
          title: draftTitle,
          status: 'draft',
          target_duration_minutes: 1,
          user_id: currentSession.user.id,
        })
        .select()
        .single();

      if (error) throw error;

      const newProject = mapDbProject(data);
      setProjects((prev) => [newProject, ...prev]);
      setActiveProjectId(newProject.id);
      toast.success('New project created');
      return newProject.id;
    } catch (err) {
      console.error('Error creating project:', err);
      toast.error('Failed to create project');
      return null;
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
      // Use edge function for complete deletion (storage + clips + project)
      const { data, error } = await supabase.functions.invoke('delete-project', {
        body: { projectId, userId: currentSession.user.id },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Deletion failed');
      }

      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      if (activeProjectId === projectId && projects.length > 1) {
        const remaining = projects.filter(p => p.id !== projectId);
        setActiveProjectId(remaining[0]?.id || null);
      }
      
      console.log('[StudioContext] Project fully deleted:', data.summary);
      toast.success('Project and all files permanently deleted');
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
  // Returns detailed info for better UI feedback
  const canAffordShots = useCallback((shotCount: number, tier: QualityTier = 'standard'): boolean => {
    const required = shotCount * TIER_CREDIT_COSTS[tier].TOTAL_PER_SHOT;
    const canAfford = credits.remaining >= required;
    
    if (!canAfford) {
      console.log(`[StudioContext] Cannot afford ${shotCount} shots at ${tier} tier: need ${required}, have ${credits.remaining}`);
    }
    
    return canAfford;
  }, [credits.remaining]);

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
    // FIX: Return safe fallback instead of throwing to prevent crash cascade
    console.warn('[useStudio] Context not available, returning fallback');
    return {
      projects: [],
      activeProjectId: null,
      activeProject: null,
      credits: { total: 0, used: 0, remaining: 0 },
      layers: [],
      settings: {} as StudioSettings,
      isLoading: true,
      hasLoadedOnce: false,
      setActiveProjectId: () => {},
      createProject: async () => null,
      deleteProject: async () => {},
      updateProject: async () => {},
      updateSettings: () => {},
      refreshCredits: async () => {},
      refreshProjects: async () => {},
      canAffordShots: () => false,
    } as StudioContextType;
  }
  return context;
}
