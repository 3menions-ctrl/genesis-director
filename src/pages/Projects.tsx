import React, { useState, useEffect, useRef, useMemo, useCallback, memo, forwardRef } from 'react';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { withSafePageRef } from '@/lib/withSafeRef';
import { useSafeNavigation, useRouteCleanup, useNavigationAbort } from '@/lib/navigation';
import { debounce } from '@/lib/concurrency/debounce';
import { 
  Plus, Film, Play, Download, Trash2, Edit2,
  Loader2, Clock, Zap, Eye, Star, Heart, TrendingUp,
  Pencil, Calendar, Grid3X3, LayoutList,
  AlertCircle, Layers, Sparkles, Activity,
  X, Check, Search, SortAsc, SortDesc,
  Command, GraduationCap, MonitorPlay, Pin, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PausedFrameVideo } from '@/components/ui/PausedFrameVideo';
import { safePlay, safePause, safeSeek } from '@/lib/video/safeVideoOperations';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useStudio } from '@/contexts/StudioContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Project } from '@/types/studio';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { UniversalVideoPlayer } from '@/components/player';
import { AppHeader } from '@/components/layout/AppHeader';
import { useProjectThumbnails } from '@/hooks/useProjectThumbnails';
import { usePaginatedProjects } from '@/hooks/usePaginatedProjects';

// Extracted components
import { 
  ProjectCard, 
  ProjectsBackground, 
  ProjectsHero,
  MergeDownloadDialog,
} from '@/components/projects';

// STABILITY: motion/AnimatePresence disabled - replaced with CSS-only shims
const MotionDiv = forwardRef<HTMLDivElement, any>(({ children, className, style, onClick, onMouseEnter, onMouseLeave, ...rest }, ref) => (
  <div ref={ref} className={className} style={style} onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>{children}</div>
));
MotionDiv.displayName = 'MotionDiv';

const MotionSection = forwardRef<HTMLElement, any>(({ children, className, style, ...rest }, ref) => (
  <section ref={ref} className={className} style={style}>{children}</section>
));
MotionSection.displayName = 'MotionSection';

const MotionH2 = forwardRef<HTMLHeadingElement, any>(({ children, className, style, ...rest }, ref) => (
  <h2 ref={ref} className={className} style={style}>{children}</h2>
));
MotionH2.displayName = 'MotionH2';

const MotionP = forwardRef<HTMLParagraphElement, any>(({ children, className, style, ...rest }, ref) => (
  <p ref={ref} className={className} style={style}>{children}</p>
));
MotionP.displayName = 'MotionP';

const motion = {
  div: MotionDiv,
  section: MotionSection,
  h2: MotionH2,
  p: MotionP,
};

const AnimatePresence = ({ children }: { children: React.ReactNode }) => <>{children}</>;

// ============= HELPERS =============

const isManifestUrl = (url: string): boolean => url?.endsWith('.json');

const isStitchedMp4 = (url: string | undefined): boolean => {
  if (!url) return false;
  return url.includes('/final-videos/') && url.endsWith('.mp4');
};

const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// ============= MAIN COMPONENT =============

// Content component - wrapped with withSafePageRef for bulletproof ref handling
// Absorbs refs injected by Radix Dialog components, preventing crashes
function ProjectsContentInner() {
  // Mount tracking for async safety
  const isMountedRef = useRef(true);
  
  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // Unified navigation - safe navigation with locking
  const { navigate } = useSafeNavigation();
  const { abort: abortRequests } = useNavigationAbort();
  
  // Register cleanup when leaving this page
  useRouteCleanup(() => {
    abortRequests();
  }, [abortRequests]);
  
  let authData: { user: any };
  try {
    authData = useAuth();
  } catch {
    authData = { user: null };
  }
  const { user } = authData;
  
  let studioData: any;
  try {
    studioData = useStudio();
  } catch {
    studioData = {
      activeProjectId: null,
      setActiveProjectId: () => {},
      createProject: () => Promise.resolve(),
      deleteProject: () => Promise.resolve(),
      updateProject: () => Promise.resolve(),
    };
  }
  const { 
    activeProjectId, 
    setActiveProjectId, 
    deleteProject, 
    updateProject, 
  } = studioData;
  
  // View & Filter State - declared BEFORE usePaginatedProjects so we can pass them
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'name'>('updated');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'processing' | 'failed'>('all');
  
  // SERVER-SIDE PAGINATED PROJECTS - replaces loading all projects into memory
  const {
    projects,
    isLoading: isLoadingProjects,
    isLoadingMore,
    hasMore,
    totalCount,
    loadMore,
    refresh: refreshProjects,
  } = usePaginatedProjects(sortBy, sortOrder, statusFilter, searchQuery);
  
  const hasLoadedOnce = !isLoadingProjects;
  
  // Thumbnail generation hook
  const { generateMissingThumbnails } = useProjectThumbnails();
  
  // UI State
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [projectToRename, setProjectToRename] = useState<Project | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [resolvedClips, setResolvedClips] = useState<string[]>([]);
  const [isLoadingClips, setIsLoadingClips] = useState(false);
  const [retryingProjectId, setRetryingProjectId] = useState<string | null>(null);
  const [browserStitchingProjectId, setBrowserStitchingProjectId] = useState<string | null>(null);
  const [showBrowserStitcher, setShowBrowserStitcher] = useState<string | null>(null);
  
  // Merge download dialog state
  const [mergeDownloadOpen, setMergeDownloadOpen] = useState(false);
  const [mergeDownloadProject, setMergeDownloadProject] = useState<Project | null>(null);
  const [mergeDownloadClips, setMergeDownloadClips] = useState<string[]>([]);
  const [mergeDownloadAudioUrl, setMergeDownloadAudioUrl] = useState<string | null>(null);
  
  // Additional UI state (view/filter state already declared above for usePaginatedProjects)
  const [pinnedProjects, setPinnedProjects] = useState<Set<string>>(new Set());
  const [showKeyboardHints, setShowKeyboardHints] = useState(false);
  
  // Batch-resolved clip URLs to avoid N+1 queries in ProjectCard
  const [resolvedClipUrls, setResolvedClipUrls] = useState<Map<string, string>>(new Map());
  
  // RACE CONDITION FIX: Track clip resolution calls to prevent stale state updates
  const clipResolutionIdRef = useRef(0);
  
  // Training videos state
  interface TrainingVideo {
    id: string;
    title: string;
    description: string | null;
    video_url: string;
    thumbnail_url: string | null;
    voice_id: string | null;
    environment: string | null;
    created_at: string;
    updated_at: string;
  }
  const [trainingVideos, setTrainingVideos] = useState<TrainingVideo[]>([]);
  const [isLoadingTrainingVideos, setIsLoadingTrainingVideos] = useState(true);
  const [selectedTrainingVideo, setSelectedTrainingVideo] = useState<TrainingVideo | null>(null);
  const [trainingVideoModalOpen, setTrainingVideoModalOpen] = useState(false);
  
  // BATCH RESOLVE: Fetch all clip URLs for projects that need them in ONE query
  useEffect(() => {
    // Guard: Wait for user, hasLoadedOnce, and projects before resolving
    if (!user || !hasLoadedOnce || !Array.isArray(projects) || projects.length === 0) return;
    
    // RACE CONDITION FIX: Track this call to prevent stale updates
    const callId = ++clipResolutionIdRef.current;
    
    const resolveClipUrls = async () => {
      // ALWAYS check video_clips for ALL completed projects to avoid expired Replicate URLs
      // Replicate delivery URLs are temporary - we must use permanent Supabase storage URLs
      const projectsNeedingResolution = projects.filter(p => {
        const isCompleted = p.status === 'completed';
        const hasClipsArray = p.video_clips && p.video_clips.length > 0;
        // Also resolve for projects with Replicate URLs (they expire!)
        const hasReplicateUrl = p.video_url?.includes('replicate.delivery');
        const hasManifest = isManifestUrl(p.video_url);
        // Need resolution if: completed, has manifest, has Replicate URL, or missing clips array
        return isCompleted || hasManifest || hasReplicateUrl || !hasClipsArray;
      });
      
      if (projectsNeedingResolution.length === 0) return;
      
      // Batch query: get first clip for all projects at once
      const projectIds = projectsNeedingResolution.map(p => p.id);
      
      try {
        const { data: clips } = await supabase
          .from('video_clips')
          .select('project_id, video_url, shot_index')
          .in('project_id', projectIds)
          .eq('status', 'completed')
          .not('video_url', 'is', null)
          .order('shot_index', { ascending: true });
        
        // RACE CONDITION FIX: Abort if a newer call has started
        if (clipResolutionIdRef.current !== callId) {
          console.debug('[Projects] Clip resolution aborted - newer call in progress');
          return;
        }
        
        if (clips && clips.length > 0) {
          console.log('[Projects] Batch resolved clips:', clips.length, 'clips for', projectIds.length, 'projects');
          
          // Group by project_id and take first clip for each
          const clipsByProject = new Map<string, string>();
          for (const clip of clips) {
            // Skip Replicate delivery URLs (they expire) - use Supabase storage URLs
            const isReplicateUrl = clip.video_url?.includes('replicate.delivery');
            if (!clipsByProject.has(clip.project_id) && clip.video_url && !isReplicateUrl) {
              clipsByProject.set(clip.project_id, clip.video_url);
              console.log('[Projects] Resolved clip for project:', clip.project_id.substring(0, 8), '→', clip.video_url.substring(0, 60));
            }
          }
          setResolvedClipUrls(clipsByProject);
        }
      } catch (err) {
        console.debug('[Projects] Batch clip resolution failed:', err);
      }
    };
    
    resolveClipUrls();
  }, [user, hasLoadedOnce, projects]);
  
  // Auto-generate missing thumbnails when projects load
  useEffect(() => {
    // Guard: Wait for user and valid projects array
    if (!user || !hasLoadedOnce || !Array.isArray(projects) || projects.length === 0) return;
    
    try {
      const projectsNeedingThumbnails = projects.map(p => ({
        id: p.id,
        video_url: p.video_url,
        thumbnail_url: p.thumbnail_url
      }));
      generateMissingThumbnails(projectsNeedingThumbnails);
    } catch (err) {
      console.debug('[Projects] Thumbnail generation skipped:', err);
    }
  }, [user, hasLoadedOnce, projects, generateMissingThumbnails]);


  // Fetch training videos
  useEffect(() => {
    const fetchTrainingVideos = async () => {
      if (!user) return;
      
      setIsLoadingTrainingVideos(true);
      try {
        const { data, error } = await supabase
          .from('training_videos')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        setTrainingVideos(data || []);
      } catch (err) {
        console.error('Failed to fetch training videos:', err);
      } finally {
        setIsLoadingTrainingVideos(false);
      }
    };
    
    fetchTrainingVideos();
  }, [user]);

  // Delete training video handler
  const handleDeleteTrainingVideo = useCallback(async (videoId: string) => {
    try {
      const { error } = await supabase
        .from('training_videos')
        .delete()
        .eq('id', videoId);
      
      if (error) throw error;
      
      setTrainingVideos(prev => prev.filter(v => v.id !== videoId));
      toast.success('Training video deleted');
    } catch (err) {
      console.error('Failed to delete training video:', err);
      toast.error('Failed to delete video');
    }
  }, []);

  // Load pinned projects from localStorage with defensive parsing
  useEffect(() => {
    try {
      const saved = localStorage.getItem('pinnedProjects');
      if (saved) {
        const parsed = JSON.parse(saved);
        // GUARD: Ensure parsed value is an array before creating Set
        if (Array.isArray(parsed)) {
          setPinnedProjects(new Set(parsed));
        } else {
          // Corrupted data - clear it
          console.warn('[Projects] Corrupted pinnedProjects data, clearing');
          localStorage.removeItem('pinnedProjects');
        }
      }
    } catch (error) {
      // JSON.parse failed - clear corrupted data
      console.warn('[Projects] Failed to parse pinnedProjects:', error);
      localStorage.removeItem('pinnedProjects');
    }
  }, []);

  // Save pinned projects to localStorage
  const togglePin = useCallback((projectId: string) => {
    setPinnedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
        toast.success('Project unpinned');
      } else {
        next.add(projectId);
        toast.success('Project pinned');
      }
      localStorage.setItem('pinnedProjects', JSON.stringify([...next]));
      return next;
    });
  }, []);

  // Toggle public visibility
  const handleTogglePublic = useCallback(async (project: Project) => {
    const newIsPublic = !project.is_public;
    try {
      const { error } = await supabase
        .from('movie_projects')
        .update({ is_public: newIsPublic })
        .eq('id', project.id);
      
      if (error) throw error;
      
      await refreshProjects();
      toast.success(newIsPublic ? 'Video shared to Discover!' : 'Video removed from Discover');
    } catch (err: any) {
      console.error('Failed to toggle public:', err);
      toast.error('Failed to update sharing settings');
    }
  }, [refreshProjects]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        document.getElementById('project-search')?.focus();
      }
      if (e.key === 'n' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleCreateProject();
      }
      if (e.key === '?' && e.shiftKey) {
        setShowKeyboardHints(prev => !prev);
      }
      if (e.key === 'g') {
        setViewMode('grid');
      }
      if (e.key === 'l') {
        setViewMode('list');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Realtime subscription for project updates
  useEffect(() => {
    if (!user) return;
    
    // DEBOUNCED: Prevent rapid-fire refreshes from bursting realtime updates
    const debouncedRefresh = debounce(() => {
      console.debug('[Projects] Debounced realtime refresh triggered');
      refreshProjects();
    }, 500);
    
    const channel = supabase
      .channel('projects_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'movie_projects',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          debouncedRefresh();
        }
      )
      .subscribe();

    return () => {
      debouncedRefresh.cancel();
      supabase.removeChannel(channel);
    };
  }, [user, refreshProjects]);

  // Helper functions
  const status = (p: Project) => p.status as string;
  
  const hasVideoContent = (p: Project): boolean => {
    // Project has video content if it has a final video URL, manifest, or clips array
    if (isStitchedMp4(p.video_url)) return true;
    if (p.video_url && isManifestUrl(p.video_url)) return true;
    if (p.video_clips && p.video_clips.length > 0) return true;
    // Also check if status indicates production happened (clips may be in table, not array)
    if (p.status === 'completed' || p.status === 'stitching' || p.status === 'stitching_failed') return true;
    // Check if video_url exists (even non-manifest) - indicates completed video
    if (p.video_url) return true;
    return false;
  };
  
  const isPlayableProject = (p: Project): boolean => {
    // A project is playable if it has a final video or completed clips
    if (isStitchedMp4(p.video_url)) return true;
    if (p.video_url && isManifestUrl(p.video_url) && status(p) === 'completed') return true;
    // Completed projects should always be playable (UniversalVideoPlayer will fetch clips from DB)
    if (p.status === 'completed') return true;
    return false;
  };

  // Filtered and sorted projects - now handled server-side by usePaginatedProjects
  // Only client-side: pinned projects first
  const filteredProjects = useMemo(() => {
    // SHOW ALL PROJECTS - don't filter by hasVideoContent
    // This ensures draft projects are visible in the library
    const result = projects;
    
    // Put pinned projects first (only client-side operation needed)
    const pinned = result.filter(p => pinnedProjects.has(p.id));
    const unpinned = result.filter(p => !pinnedProjects.has(p.id));
    return [...pinned, ...unpinned];
  }, [projects, pinnedProjects]);
  
  // Projects to display - directly use filteredProjects (pagination is server-side now)
  const displayedProjects = filteredProjects;
  
  // Load more handler - uses server-side pagination
  const handleLoadMore = useCallback(() => {
    loadMore();
  }, [loadMore]);
  
  const hasMoreToLoad = hasMore;

  // Stats - count ALL projects, not just those with video content
  const stats = useMemo(() => {
    const allProjects = projects; // Show all projects in stats
    const completed = allProjects.filter(isPlayableProject).length;
    const processing = allProjects.filter(p => ['generating', 'rendering', 'stitching'].includes(status(p))).length;
    const totalClips = allProjects.reduce((acc, p) => acc + (p.video_clips?.length || 0), 0);
    
    return { total: allProjects.length, completed, processing, totalClips };
  }, [projects]);

  // Genre categories config
  const GENRE_CONFIG: Record<string, { label: string; icon: typeof Film; color: string }> = {
    cinematic: { label: 'Cinematic', icon: Film, color: 'text-purple-400' },
    ad: { label: 'Advertisement', icon: Zap, color: 'text-amber-400' },
    documentary: { label: 'Documentary', icon: Eye, color: 'text-blue-400' },
    educational: { label: 'Educational', icon: Sparkles, color: 'text-emerald-400' },
    funny: { label: 'Comedy', icon: Star, color: 'text-pink-400' },
    religious: { label: 'Religious', icon: Heart, color: 'text-rose-400' },
    motivational: { label: 'Motivational', icon: TrendingUp, color: 'text-orange-400' },
    storytelling: { label: 'Storytelling', icon: Layers, color: 'text-cyan-400' },
  };

  // Group projects by genre - now using displayedProjects from server-side pagination
  const groupedProjects = useMemo(() => {
    const unpinnedProjects = displayedProjects.filter(p => !pinnedProjects.has(p.id));
    const groups: Record<string, Project[]> = {};
    
    unpinnedProjects.forEach(project => {
      const genre = project.genre || 'cinematic';
      if (!groups[genre]) {
        groups[genre] = [];
      }
      groups[genre].push(project);
    });
    
    // Sort genres by count (most projects first)
    const sortedGenres = Object.keys(groups).sort((a, b) => groups[b].length - groups[a].length);
    
    return { groups, sortedGenres };
  }, [displayedProjects, pinnedProjects]);

  // Handlers
  const handleCreateProject = () => {
    // Just navigate to Create page - project creation is handled there
    // when user actually submits their creation (no premature draft creation)
    navigate('/create');
  };

  const handlePlayVideo = async (project: Project) => {
    // Store selected project for video modal - needed to determine video source type
    setSelectedProject(project);
    setShowBrowserStitcher(project.id);
  };

  const handleRenameProject = (project: Project) => {
    setProjectToRename(project);
    setNewProjectName(project.name);
    setRenameDialogOpen(true);
  };

  const handleConfirmRename = async () => {
    if (!projectToRename || !newProjectName.trim()) return;
    await updateProject(projectToRename.id, { name: newProjectName.trim() });
    toast.success('Project renamed');
    setRenameDialogOpen(false);
    setProjectToRename(null);
    setNewProjectName('');
  };

  const handleDownloadAll = async (project: Project) => {
    // Single video file (not manifest) - download directly
    if (project.video_url && !isManifestUrl(project.video_url)) {
      toast.info('Downloading video...');
      try {
        const response = await fetch(project.video_url);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${project.name}-final.mp4`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Download complete!');
      } catch (error) {
        window.open(project.video_url, '_blank');
      }
      return;
    }
    
    // Multi-clip project - fetch clips and open merge dialog
    let clipUrls = project.video_clips || [];
    let masterAudioUrl: string | null = null;
    
    // If no clips array, try to fetch from database
    if (clipUrls.length === 0) {
      try {
        const { data: clips } = await supabase
          .from('video_clips')
          .select('video_url, shot_index')
          .eq('project_id', project.id)
          .eq('status', 'completed')
          .not('video_url', 'is', null)
          .order('shot_index');
        
        if (clips && clips.length > 0) {
          clipUrls = clips.map(c => c.video_url).filter(Boolean) as string[];
        }
      } catch (error) {
        console.error('Failed to fetch clips:', error);
      }
    }
    
    if (clipUrls.length === 0) {
      toast.error('No clips to download');
      return;
    }
    
    // Check for master audio (avatar projects)
    if (project.voice_audio_url) {
      masterAudioUrl = project.voice_audio_url;
    }
    
    // Single clip - download directly
    if (clipUrls.length === 1) {
      toast.info('Downloading video...');
      try {
        const response = await fetch(clipUrls[0]);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${project.name}-video.mp4`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Download complete!');
      } catch (error) {
        window.open(clipUrls[0], '_blank');
      }
      return;
    }
    
    // Multiple clips - open merge dialog
    setMergeDownloadProject(project);
    setMergeDownloadClips(clipUrls);
    setMergeDownloadAudioUrl(masterAudioUrl);
    setMergeDownloadOpen(true);
  };

  const handleGoogleStitch = async (projectId: string) => {
    if (retryingProjectId) return;
    
    setRetryingProjectId(projectId);
    toast.info('Starting Google Cloud stitch...', { description: 'Processing with FFmpeg - this may take 2-3 minutes' });
    
    try {
      const { data: clips, error: clipsError } = await supabase
        .from('video_clips')
        .select('id, shot_index, video_url, duration_seconds')
        .eq('project_id', projectId)
        .eq('status', 'completed')
        .order('shot_index');
      
      if (clipsError) throw clipsError;
      if (!clips || clips.length === 0) throw new Error('No completed clips found');
      
      const { data: project } = await supabase
        .from('movie_projects')
        .select('title')
        .eq('id', projectId)
        .single();
      
      const { data, error: stitchError } = await supabase.functions.invoke('stitch-video', {
        body: {
          projectId,
          projectTitle: project?.title || 'Video',
          clips: clips.map(clip => ({
            shotId: clip.id,
            videoUrl: clip.video_url,
            durationSeconds: clip.duration_seconds || 6,
            transitionOut: 'cut',
          })),
          audioMixMode: 'mute',
        },
      });
      
      if (stitchError) throw stitchError;
      
      if (data?.success && data?.mode === 'cloud-run') {
        toast.success('Stitching started!', { description: 'Video will appear when ready (2-3 min)' });
      } else if (data?.success && data?.finalVideoUrl) {
        toast.success('Video stitched successfully!');
        await refreshProjects();
      } else {
        throw new Error(data?.error || 'Stitch failed to start');
      }
    } catch (err: any) {
      console.error('Google stitch failed:', err);
      toast.error('Stitch failed', { description: err.message });
    } finally {
      setRetryingProjectId(null);
    }
  };

  const handleBrowserStitch = (projectId: string) => {
    setShowBrowserStitcher(projectId);
  };

  const needsStitching = projects.filter(p => {
    const hasClips = hasVideoContent(p);
    const isPlayable = isPlayableProject(p);
    const isProcessing = status(p) === 'stitching';
    const isStitchFailed = status(p) === 'stitching_failed';
    return (hasClips && !isPlayable && !isProcessing) || isStitchFailed;
  });
  
  const stitchingProjects = projects.filter(p => status(p) === 'stitching');

  return (
    <div className="min-h-screen bg-[#030303] relative overflow-x-hidden">
      {/* Premium Orange-Themed Animated Background */}
      <ProjectsBackground />

      {/* Navigation */}
      <AppHeader onCreateClick={handleCreateProject} />

      {/* Main Content - MOBILE FIX: Reduced padding on mobile */}
      <main className="relative z-10 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4 pt-16 sm:pt-20">
        
        {/* Loading state */}
        {(isLoadingProjects && !hasLoadedOnce) ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-32"
          >
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-white/5 rounded-full blur-2xl scale-150 animate-pulse" />
              <Loader2 className="relative w-10 h-10 text-zinc-500 animate-spin" />
            </div>
            <p className="text-zinc-500">Loading your projects...</p>
          </motion.div>
        ) : stats.total === 0 && stitchingProjects.length === 0 ? (
          /* Cinematic Empty State */
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
            className="relative flex flex-col items-center justify-center py-24 sm:py-32 px-4"
          >
            {/* Dramatic spotlight */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <motion.div 
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] rounded-full"
                style={{
                  background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.03) 0%, transparent 70%)',
                }}
                animate={{ 
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 0.8, 0.5]
                }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>

            {/* Film reel icon with animation */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="relative mb-10"
            >
              {/* Outer glow ring */}
              <motion.div
                className="absolute inset-[-20px] rounded-full border border-white/10"
                animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
                transition={{ duration: 3, repeat: Infinity }}
              />
              <motion.div
                className="absolute inset-[-40px] rounded-full border border-white/5"
                animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.4, 0.2] }}
                transition={{ duration: 4, repeat: Infinity, delay: 0.5 }}
              />
              
              <motion.div
                animate={{ 
                  rotate: [0, 360],
                }}
                transition={{ 
                  duration: 20, 
                  repeat: Infinity, 
                  ease: "linear"
                }}
                className="relative w-32 h-32 rounded-full bg-zinc-900 border border-white/[0.06] flex items-center justify-center shadow-2xl"
              >
                {/* Inner details to look like film reel */}
                <div className="absolute inset-4 rounded-full border border-white/[0.06]" />
                <div className="absolute inset-8 rounded-full border border-white/[0.04]" />
                {[...Array(8)].map((_, i) => (
                  <div 
                    key={i}
                    className="absolute w-2 h-2 rounded-full bg-white/20"
                    style={{
                      transform: `rotate(${i * 45}deg) translateY(-40px)`
                    }}
                  />
                ))}
                <Film className="w-10 h-10 text-zinc-600" strokeWidth={1} />
              </motion.div>
            </motion.div>
            
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-4 text-center tracking-tight"
            >
              The Stage is Set
            </motion.h2>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="text-zinc-400 text-lg sm:text-xl mb-4 text-center max-w-lg"
            >
              Your creative journey begins here. Every great director started with their first scene.
            </motion.p>
            
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.6 }}
              className="text-zinc-600 text-sm mb-10 text-center italic"
            >
              "Every frame is a chance to tell a story"
            </motion.p>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.6 }}
            >
              <Button 
                onClick={handleCreateProject}
                className="group relative h-14 px-10 rounded-full bg-white text-black hover:bg-white/90 font-bold text-lg overflow-hidden shadow-xl"
              >
                {/* Shimmer effect */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-black/10 to-transparent"
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", repeatDelay: 1 }}
                />
                <span className="relative flex items-center gap-2">
                  <Plus className="w-5 h-5 transition-transform group-hover:rotate-90 duration-300" />
                  Create Your First Film
                </span>
              </Button>
            </motion.div>

            {/* Decorative film strips */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              transition={{ delay: 1, duration: 1 }}
              className="absolute bottom-10 left-0 right-0 flex justify-center gap-2 pointer-events-none"
            >
              {[...Array(7)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 0.3 + i * 0.1, y: 0 }}
                  transition={{ delay: 1 + i * 0.1, duration: 0.5 }}
                  className="w-16 h-12 rounded bg-zinc-900 border border-white/[0.06]"
                  style={{ transform: `rotate(${(i - 3) * 3}deg)` }}
                />
              ))}
            </motion.div>
          </motion.div>
        ) : (
          <>
            {/* Premium Hero Header with Orange Theme */}
            <ProjectsHero stats={stats} />

            {/* Premium Search & Filter Toolbar with Orange Accents */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="mb-6"
            >
              <div className="relative p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-2xl overflow-hidden">
                {/* Subtle orange glow in corner */}
                <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-orange-500/5 blur-3xl pointer-events-none" />
                
                <div className="relative flex flex-col lg:flex-row items-stretch lg:items-center gap-4">
                  {/* Search Bar - Premium with orange focus */}
                  <div className="relative flex-1 group">
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-orange-500/10 to-amber-500/5 opacity-0 group-focus-within:opacity-100 blur-xl transition-opacity duration-500" />
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30 group-focus-within:text-orange-400 transition-colors" />
                    <Input
                      id="project-search"
                      placeholder="Search your projects..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="relative h-12 pl-12 pr-12 bg-white/[0.03] border border-white/[0.08] text-white placeholder:text-white/30 rounded-xl focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/50 text-base backdrop-blur-xl transition-all"
                    />
                    {searchQuery ? (
                      <button 
                        onClick={() => setSearchQuery('')}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    ) : (
                      <kbd className="absolute right-4 top-1/2 -translate-y-1/2 hidden sm:inline-flex text-xs font-mono text-white/30 bg-white/5 px-2.5 py-1 rounded-lg border border-white/[0.08]">/</kbd>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="hidden lg:block w-px h-10 bg-white/[0.08]" />

                  {/* Filter Controls */}
                  {/* MOBILE FIX: Wrap filters in scrollable container on mobile */}
                  <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
                    {/* Status Filter Tabs - Orange themed, scrollable on mobile */}
                    <div className="flex items-center gap-0.5 sm:gap-1 p-0.5 sm:p-1 rounded-lg sm:rounded-xl bg-white/[0.03] border border-white/[0.06] flex-shrink-0">
                      {[
                        { value: 'all', label: 'All', icon: Layers },
                        { value: 'completed', label: 'Ready', icon: Check },
                        { value: 'processing', label: 'Active', icon: Activity },
                        { value: 'failed', label: 'Failed', icon: AlertCircle },
                      ].map((filter) => (
                        <button
                          key={filter.value}
                          onClick={() => setStatusFilter(filter.value as any)}
                          className={cn(
                            "flex items-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-md sm:rounded-lg text-xs sm:text-sm font-medium transition-all flex-shrink-0",
                            statusFilter === filter.value 
                              ? "bg-gradient-to-r from-orange-500/20 to-amber-500/20 text-orange-400 border border-orange-500/30" 
                              : "text-white/40 hover:text-white/70 hover:bg-white/[0.05]"
                          )}
                        >
                          <filter.icon className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                          <span className="hidden xs:inline sm:inline">{filter.label}</span>
                        </button>
                      ))}
                    </div>

                    {/* Sort Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-10 px-3 rounded-xl text-zinc-500 hover:text-white hover:bg-white/10 gap-2">
                          {sortOrder === 'desc' ? <SortDesc className="w-4 h-4" /> : <SortAsc className="w-4 h-4" />}
                          <span className="hidden sm:inline text-sm">Sort</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 bg-zinc-900 backdrop-blur-xl border-white/10">
                        <DropdownMenuLabel className="text-zinc-500 text-xs uppercase tracking-wider">Sort by</DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-white/10" />
                        <DropdownMenuCheckboxItem 
                          checked={sortBy === 'updated'} 
                          onCheckedChange={() => setSortBy('updated')}
                          className="gap-2 text-zinc-300 focus:text-white focus:bg-white/10"
                        >
                          <Clock className="w-4 h-4" />
                          Last Updated
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem 
                          checked={sortBy === 'created'} 
                          onCheckedChange={() => setSortBy('created')}
                          className="gap-2 text-zinc-300 focus:text-white focus:bg-white/10"
                        >
                          <Calendar className="w-4 h-4" />
                          Date Created
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem 
                          checked={sortBy === 'name'} 
                          onCheckedChange={() => setSortBy('name')}
                          className="gap-2 text-zinc-300 focus:text-white focus:bg-white/10"
                        >
                          <Edit2 className="w-4 h-4" />
                          Name
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuSeparator className="bg-white/10" />
                        <DropdownMenuItem 
                          onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                          className="gap-2 text-zinc-300 focus:text-white focus:bg-white/10"
                        >
                          {sortOrder === 'desc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
                          {sortOrder === 'desc' ? 'Ascending' : 'Descending'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* View Mode Toggle - Orange themed, smaller on mobile */}
                    <div className="flex items-center gap-0.5 p-0.5 sm:p-1 rounded-lg sm:rounded-xl bg-white/[0.03] border border-white/[0.06] flex-shrink-0">
                      <button
                        onClick={() => setViewMode('grid')}
                        className={cn(
                          "p-1.5 sm:p-2.5 rounded-md sm:rounded-lg transition-all",
                          viewMode === 'grid' ? "bg-orange-500/20 text-orange-400" : "text-white/40 hover:text-white/70"
                        )}
                        title="Grid view"
                      >
                        <Grid3X3 className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                      </button>
                      <button
                        onClick={() => setViewMode('list')}
                        className={cn(
                          "p-1.5 sm:p-2.5 rounded-md sm:rounded-lg transition-all",
                          viewMode === 'list' ? "bg-orange-500/20 text-orange-400" : "text-white/40 hover:text-white/70"
                        )}
                        title="List view"
                      >
                        <LayoutList className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Active filters indicator - Orange themed */}
                {(searchQuery || statusFilter !== 'all') && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="flex items-center gap-2 mt-4 pt-4 border-t border-white/[0.06]"
                  >
                    <span className="text-xs text-white/40">Showing:</span>
                    {searchQuery && (
                      <Badge className="gap-1 text-xs bg-orange-500/10 text-orange-300 border-orange-500/20 hover:bg-orange-500/20">
                        "{searchQuery}"
                        <button onClick={() => setSearchQuery('')} className="ml-1 hover:text-white">
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    )}
                    {statusFilter !== 'all' && (
                      <Badge className="gap-1 text-xs capitalize bg-orange-500/10 text-orange-300 border-orange-500/20 hover:bg-orange-500/20">
                        {statusFilter}
                        <button onClick={() => setStatusFilter('all')} className="ml-1 hover:text-white">
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    )}
                    <span className="text-xs text-white/40 ml-auto">
                      {filteredProjects.length} {filteredProjects.length === 1 ? 'project' : 'projects'}
                    </span>
                  </motion.div>
                )}
              </div>
            </motion.div>

            {/* Categorized Projects Grid */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="space-y-6"
            >
              {/* Training Videos Section - Always show if there are training videos */}
              {trainingVideos.length > 0 && (
                <motion.section 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="relative"
                >
                  <div className="relative flex items-center gap-2 mb-4">
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg">
                      <GraduationCap className="w-3 h-3 text-black" />
                    </div>
                    <h2 className="text-sm font-semibold text-foreground">Training Videos</h2>
                    <Badge className="ml-auto bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30 text-[10px] px-1.5">
                      {trainingVideos.length}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate('/training-video')}
                      className="h-7 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      New
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {trainingVideos.map((video, index) => (
                      <motion.div
                        key={video.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="group relative cursor-pointer"
                        onClick={() => {
                          setSelectedTrainingVideo(video);
                          setTrainingVideoModalOpen(true);
                        }}
                      >
                        <div className={cn(
                          "relative aspect-video rounded-xl overflow-hidden",
                          "bg-zinc-900 border border-white/[0.06]",
                          "group-hover:border-emerald-500/30 transition-all duration-300"
                        )}>
                          <PausedFrameVideo
                            src={video.video_url}
                            className="w-full h-full object-cover"
                            showLoader={false}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center">
                              <Play className="w-5 h-5 text-black ml-0.5" />
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTrainingVideo(video.id);
                            }}
                            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-white" />
                          </button>
                          <div className="absolute bottom-0 left-0 right-0 p-3">
                            <h3 className="text-xs font-medium text-white truncate">{video.title}</h3>
                            <p className="text-[10px] text-white/50 mt-0.5">{formatTimeAgo(video.created_at)}</p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.section>
              )}

              {filteredProjects.length === 0 && trainingVideos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 rounded-xl bg-zinc-800/60 flex items-center justify-center mb-4">
                    <Search className="w-6 h-6 text-zinc-500" />
                  </div>
                  <p className="text-base font-medium text-white mb-1">No projects found</p>
                  <p className="text-zinc-500 text-sm max-w-sm">Try adjusting your search or filters</p>
                  <Button variant="outline" size="sm" onClick={() => { setSearchQuery(''); setStatusFilter('all'); }} className="mt-4 gap-2 border-white/10 text-zinc-300 hover:bg-white/10 hover:text-white">
                    <X className="w-3 h-3" />
                    Clear filters
                  </Button>
                </div>
              ) : filteredProjects.length > 0 ? (
                <>
                  {/* Pinned Projects Section - Premium */}
                  {pinnedProjects.size > 0 && filteredProjects.some(p => pinnedProjects.has(p.id)) && (
                    <motion.section 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="relative"
                    >
                      
                      <div className="relative flex items-center gap-2 mb-4">
                        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg">
                          <Pin className="w-3 h-3 text-black" />
                        </div>
                        <h2 className="text-sm font-semibold text-foreground">Pinned</h2>
                        <Badge className="ml-auto bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30 text-[10px] px-1.5">
                          {filteredProjects.filter(p => pinnedProjects.has(p.id)).length}
                        </Badge>
                      </div>
                      {viewMode === 'list' ? (
                        <div className="space-y-2">
                          {filteredProjects.filter(p => pinnedProjects.has(p.id)).map((project, index) => (
                            <ProjectCard
                              key={project.id}
                              project={project}
                              index={index}
                              viewMode="list"
                              preResolvedClipUrl={resolvedClipUrls.get(project.id)}
                              onPlay={() => handlePlayVideo(project)}
                              onEdit={() => { setActiveProjectId(project.id); navigate('/create'); }}
                              onRename={() => handleRenameProject(project)}
                              onDelete={() => deleteProject(project.id)}
                              onDownload={() => handleDownloadAll(project)}
                              onRetryStitch={() => handleGoogleStitch(project.id)}
                              onBrowserStitch={() => handleBrowserStitch(project.id)}
                              onTogglePin={() => togglePin(project.id)}
                              onTogglePublic={() => handleTogglePublic(project)}
                              isActive={activeProjectId === project.id}
                              isRetrying={retryingProjectId === project.id}
                              isBrowserStitching={browserStitchingProjectId === project.id}
                              isPinned={true}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                          {filteredProjects.filter(p => pinnedProjects.has(p.id)).map((project, index) => (
                            <ProjectCard
                              key={project.id}
                              project={project}
                              index={index}
                              viewMode="grid"
                              preResolvedClipUrl={resolvedClipUrls.get(project.id)}
                              onPlay={() => handlePlayVideo(project)}
                              onEdit={() => { setActiveProjectId(project.id); navigate('/create'); }}
                              onRename={() => handleRenameProject(project)}
                              onDelete={() => deleteProject(project.id)}
                              onDownload={() => handleDownloadAll(project)}
                              onRetryStitch={() => handleGoogleStitch(project.id)}
                              onBrowserStitch={() => handleBrowserStitch(project.id)}
                              onTogglePin={() => togglePin(project.id)}
                              onTogglePublic={() => handleTogglePublic(project)}
                              isActive={activeProjectId === project.id}
                              isRetrying={retryingProjectId === project.id}
                              isBrowserStitching={browserStitchingProjectId === project.id}
                              isPinned={true}
                            />
                          ))}
                        </div>
                      )}
                    </motion.section>
                  )}
                  {/* Genre-based Project Sections - Premium */}
                  {groupedProjects.sortedGenres.map((genre, genreIndex) => {
                    const genreProjects = groupedProjects.groups[genre];
                    const config = GENRE_CONFIG[genre] || { label: genre.charAt(0).toUpperCase() + genre.slice(1), icon: Film, color: 'text-primary' };
                    const GenreIcon = config.icon;
                    
                    return (
                      <motion.section 
                        key={genre} 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 + genreIndex * 0.05 }}
                        className="relative"
                      >
                        <div className="relative flex items-center gap-2 mb-4">
                          <div className="w-6 h-6 rounded-lg flex items-center justify-center shadow-lg border border-border/40 bg-gradient-to-br from-muted/80 to-muted/40">
                            <GenreIcon className={cn("w-3 h-3", config.color)} />
                          </div>
                          <h2 className="text-sm font-semibold text-foreground">{config.label}</h2>
                          <Badge variant="outline" className="ml-auto text-[10px] border-border/40 bg-muted/30 px-1.5">
                            {genreProjects.length}
                          </Badge>
                        </div>
                        {viewMode === 'list' ? (
                          <div className="space-y-2">
                            {genreProjects.map((project, index) => (
                              <ProjectCard
                                key={project.id}
                                project={project}
                                index={index}
                                viewMode="list"
                                preResolvedClipUrl={resolvedClipUrls.get(project.id)}
                                onPlay={() => handlePlayVideo(project)}
                                onEdit={() => { setActiveProjectId(project.id); navigate('/create'); }}
                                onRename={() => handleRenameProject(project)}
                                onDelete={() => deleteProject(project.id)}
                                onDownload={() => handleDownloadAll(project)}
                                onRetryStitch={() => handleGoogleStitch(project.id)}
                                onTogglePin={() => togglePin(project.id)}
                                onTogglePublic={() => handleTogglePublic(project)}
                                isActive={activeProjectId === project.id}
                                isRetrying={retryingProjectId === project.id}
                                isPinned={pinnedProjects.has(project.id)}
                              />
                            ))}
                          </div>
                        ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            {genreProjects.map((project, index) => (
                              <ProjectCard
                                key={project.id}
                                project={project}
                                index={index}
                                viewMode="grid"
                                preResolvedClipUrl={resolvedClipUrls.get(project.id)}
                                onPlay={() => handlePlayVideo(project)}
                                onEdit={() => { setActiveProjectId(project.id); navigate('/create'); }}
                                onRename={() => handleRenameProject(project)}
                                onDelete={() => deleteProject(project.id)}
                                onDownload={() => handleDownloadAll(project)}
                                onRetryStitch={() => handleGoogleStitch(project.id)}
                                onTogglePin={() => togglePin(project.id)}
                                onTogglePublic={() => handleTogglePublic(project)}
                                isActive={activeProjectId === project.id}
                                isRetrying={retryingProjectId === project.id}
                                isPinned={pinnedProjects.has(project.id)}
                              />
                            ))}
                          </div>
                        )}
                      </motion.section>
                    );
                  })}
                  
                  {/* iOS Safari Load More Button */}
                  {hasMoreToLoad && (
                    <div className="flex justify-center py-8">
                      <Button
                        onClick={handleLoadMore}
                        variant="outline"
                        disabled={isLoadingMore}
                        className="gap-2 border-orange-500/30 text-orange-400 hover:bg-orange-500/10 hover:border-orange-500/50"
                      >
                        {isLoadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : <Loader2 className="w-4 h-4" />}
                        {isLoadingMore ? 'Loading...' : `Load More (${totalCount - displayedProjects.length} remaining)`}
                      </Button>
                    </div>
                  )}
                </>
              ) : null}
            </motion.div>
          </>
        )}
      </main>

      {/* Video Player Modal - UniversalVideoPlayer for seamless transitions */}
      {videoModalOpen && selectedProject && !isLoadingClips && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          {/* Header controls */}
          <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
            <div className="flex items-center gap-3">
              <h2 className="text-white font-medium text-lg truncate max-w-md">{selectedProject.name}</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDownloadAll(selectedProject)}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                title="Download"
              >
                <Download className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={() => {
                  if (resolvedClips[0]) window.open(resolvedClips[0], '_blank');
                }}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                title="Open in new tab"
              >
                <ExternalLink className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={() => {
                  setVideoModalOpen(false);
                  setResolvedClips([]);
                  setActiveProjectId(selectedProject.id);
                  navigate('/create');
                }}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                title="Edit project"
              >
                <Edit2 className="w-5 h-5 text-white" />
              </button>
              <button 
                onClick={() => {
                  setVideoModalOpen(false);
                  setResolvedClips([]);
                }}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                title="Close"
              >
                <X className="w-6 h-6 text-white" />
              </button>
            </div>
          </div>
          
          {/* Universal Video Player - seamless transitions */}
          <UniversalVideoPlayer
            source={isManifestUrl(resolvedClips[0]) 
              ? { manifestUrl: resolvedClips[0] } 
              : { urls: resolvedClips }
            }
            mode="fullscreen"
            autoPlay
            onClose={() => {
              setVideoModalOpen(false);
              setResolvedClips([]);
            }}
            className="w-full h-full"
          />
        </div>
      )}

      {/* Training Video Player Modal */}
      {trainingVideoModalOpen && selectedTrainingVideo && (
        <UniversalVideoPlayer
          source={{ urls: [selectedTrainingVideo.video_url] }}
          mode="fullscreen"
          title={selectedTrainingVideo.title}
          onClose={() => {
            setTrainingVideoModalOpen(false);
            setSelectedTrainingVideo(null);
          }}
          onDownload={() => {
            if (selectedTrainingVideo.video_url) {
              window.open(selectedTrainingVideo.video_url, '_blank');
            }
          }}
        />
      )}

      {/* Loading clips overlay */}
      <AnimatePresence>
        {isLoadingClips && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
          >
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-white" />
              <p className="text-white/60 text-sm">Loading your video...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-md bg-zinc-900/95 backdrop-blur-2xl border-white/10 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white text-lg">
              <Pencil className="w-5 h-5" />
              Rename Project
            </DialogTitle>
            <DialogDescription className="text-white/50">
              Give your project a new name
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-6">
            <Input
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Enter project name"
              className="h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl focus:border-white/30 focus:ring-0"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newProjectName.trim()) {
                  handleConfirmRename();
                }
              }}
            />
          </div>

          <DialogFooter className="gap-3">
            <Button 
              variant="outline" 
              onClick={() => setRenameDialogOpen(false)}
              className="border-white/10 text-white/70 hover:bg-white/5 rounded-xl"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmRename}
              disabled={!newProjectName.trim()}
              className="bg-white text-black hover:bg-white/90 rounded-xl font-semibold"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Keyboard Shortcuts Modal */}
      <Dialog open={showKeyboardHints} onOpenChange={setShowKeyboardHints}>
        <DialogContent className="sm:max-w-sm bg-zinc-900/95 backdrop-blur-2xl border-white/10 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Command className="w-5 h-5" />
              Keyboard Shortcuts
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4 space-y-3">
            {[
              { keys: ['/', ''], action: 'Search projects' },
              { keys: ['⌘', 'N'], action: 'New project' },
              { keys: ['G'], action: 'Grid view' },
              { keys: ['L'], action: 'List view' },
              { keys: ['?'], action: 'Show shortcuts' },
            ].map((shortcut, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm text-white/60">{shortcut.action}</span>
                <div className="flex items-center gap-1">
                  {shortcut.keys.map((key, j) => (
                    key && <kbd key={j} className="px-2 py-1 text-xs font-mono text-white/80 bg-white/10 rounded">{key}</kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Smart Video Player Modal - MOBILE OPTIMIZED: Full-screen on mobile */}
      {/* ALL projects now use projectId source - UniversalVideoPlayer fetches clips from video_clips table */}
      {/* This ensures permanent Supabase URLs are used, not expired Replicate delivery URLs */}
      <Dialog open={!!showBrowserStitcher} onOpenChange={(open) => {
        if (!open) {
          setShowBrowserStitcher(null);
          setSelectedProject(null);
        }
      }}>
        <DialogContent className="!left-[50%] !top-[50%] !-translate-x-1/2 !-translate-y-1/2 !transform bg-zinc-950 border-zinc-800 w-[92vw] sm:w-[95vw] max-w-5xl h-auto max-h-[85vh] sm:max-h-[90vh] p-0 overflow-hidden rounded-xl sm:rounded-2xl flex flex-col">
          <DialogHeader className="p-3 sm:p-4 pb-2 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-white text-sm sm:text-base pr-8">
              <MonitorPlay className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
              <span className="truncate">{selectedProject?.name || 'Video Player'}</span>
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs sm:text-sm">
              {selectedProject?.mode === 'avatar' ? 'AI Avatar Video' : 'Play all clips seamlessly'}
            </DialogDescription>
          </DialogHeader>
          {showBrowserStitcher && (
            <div className="p-2 sm:p-4 pt-0 flex-1 min-h-0 flex items-center justify-center w-full">
              {/* UNIFIED: All projects use projectId source for reliable playback */}
              {/* UniversalVideoPlayer fetches clips from video_clips table with permanent URLs */}
              {/* For avatar projects, it also fetches masterAudioUrl from pipeline_state */}
              <UniversalVideoPlayer
                source={{ projectId: showBrowserStitcher }}
                mode="inline"
                autoPlay
                className="w-full h-auto max-h-[calc(85vh-100px)] sm:max-h-[calc(90vh-100px)] aspect-video rounded-lg sm:rounded-xl object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Merge Download Dialog - combines multiple clips into single video */}
      <MergeDownloadDialog
        open={mergeDownloadOpen}
        onOpenChange={setMergeDownloadOpen}
        projectName={mergeDownloadProject?.name || 'Video'}
        clipUrls={mergeDownloadClips}
        masterAudioUrl={mergeDownloadAudioUrl}
      />
    </div>
  );
}

// Apply universal SafePageRef wrapper - absorbs Radix ref injections safely
const ProjectsContent = withSafePageRef(ProjectsContentInner, 'ProjectsContent');

// Wrapper with error boundary
export default function Projects() {
  return (
    <ErrorBoundary>
      <ProjectsContent />
    </ErrorBoundary>
  );
}
