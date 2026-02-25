import React, { useState, useEffect, useRef, useMemo, useCallback, memo, forwardRef } from 'react';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { withSafePageRef } from '@/lib/withSafeRef';
import { useSafeNavigation, useRouteCleanup, useNavigationAbort } from '@/lib/navigation';
import { CinemaLoader } from '@/components/ui/CinemaLoader';
import { useGatekeeperLoading, GATEKEEPER_PRESETS, getGatekeeperMessage } from '@/hooks/useGatekeeperLoading';
// debounce removed - realtime subscription uses inline setTimeout for stability
import { 
  Plus, Film, Play, Download, Trash2,
  Loader2, Clock,
  Pencil,
  X, Search,
  Command, MonitorPlay, Pin,
  Image, Sparkles, Clapperboard,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LazyVideoThumbnail } from '@/components/ui/LazyVideoThumbnail';
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
  ProjectsCategoryTabs,
} from '@/components/projects';
import type { ProjectTab } from '@/components/projects';

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

// ============= MASONRY + HERO SPOTLIGHT =============

/**
 * GalleryGrid — Masonry-inspired layout with hero spotlight
 * First project = large cinematic hero, rest flow in a dynamic masonry pattern
 * with staggered reveal animations
 */
function MagazineGrid({
  projects,
  resolvedClipUrls,
  activeProjectId,
  retryingProjectId,
  browserStitchingProjectId,
  onPlay,
  onEdit,
  onRename,
  onDelete,
  onDownload,
  onRetryStitch,
  onBrowserStitch,
  onTogglePin,
  onTogglePublic,
}: {
  projects: Project[];
  resolvedClipUrls: Map<string, string>;
  activeProjectId: string | null;
  retryingProjectId: string | null;
  browserStitchingProjectId: string | null;
  onPlay: (p: Project) => void;
  onEdit: (p: Project) => void;
  onRename: (p: Project) => void;
  onDelete: (id: string) => void;
  onDownload: (p: Project) => void;
  onRetryStitch: (id: string) => void;
  onBrowserStitch: (id: string) => void;
  onTogglePin: (id: string) => void;
  onTogglePublic: (p: Project) => void;
}) {
  if (projects.length === 0) return null;

  const [hero, ...rest] = projects;

  const cardProps = (project: Project, index: number) => ({
    key: project.id,
    project,
    index,
    viewMode: 'grid' as const,
    preResolvedClipUrl: resolvedClipUrls.get(project.id),
    onPlay: () => onPlay(project),
    onEdit: () => onEdit(project),
    onRename: () => onRename(project),
    onDelete: () => onDelete(project.id),
    onDownload: () => onDownload(project),
    onRetryStitch: () => onRetryStitch(project.id),
    onBrowserStitch: () => onBrowserStitch(project.id),
    onTogglePin: () => onTogglePin(project.id),
    onTogglePublic: () => onTogglePublic(project),
    isActive: activeProjectId === project.id,
    isRetrying: retryingProjectId === project.id,
    isBrowserStitching: browserStitchingProjectId === project.id,
    isPinned: false,
  });

  return (
    <div className="space-y-6">
      {/* Hero Spotlight — full-width cinematic card */}
      <div
        className="opacity-0"
        style={{
          animation: 'gallery-reveal 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
      >
        <ProjectCard {...cardProps(hero, 0)} />
      </div>

      {/* Masonry grid — alternating 2/3 col rows for visual rhythm */}
      {rest.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {rest.map((project, i) => {
            const isWide = i % 5 === 0 && rest.length > 3;
            return (
              <div
                key={project.id}
                className={cn("opacity-0", isWide && "sm:col-span-2")}
                style={{
                  animation: 'gallery-reveal 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                  animationDelay: `${0.15 + i * 0.08}s`,
                }}
              >
                <ProjectCard {...cardProps(project, i + 1)} />
              </div>
            );
          })}
        </div>
      )}

      {/* Inline keyframes for staggered reveals */}
      <style>{`
        @keyframes gallery-reveal {
          0% {
            opacity: 0;
            transform: translateY(30px) scale(0.97);
            filter: blur(4px);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0px);
          }
        }
      `}</style>
    </div>
  );
}

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
  
  // FIX: useAuth and useStudio now return safe fallbacks if context is missing
  // No try-catch needed - that violated React's hook rules
  const { user, loading: authLoading } = useAuth();
  
  const { 
    activeProjectId, 
    setActiveProjectId, 
    deleteProject, 
    updateProject, 
  } = useStudio();
  
  // View & Filter State - declared BEFORE usePaginatedProjects so we can pass them
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'name'>('updated');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'processing' | 'failed'>('all');
  const [activeTab, setActiveTab] = useState<ProjectTab>('all');
  
  // SERVER-SIDE PAGINATED PROJECTS - replaces loading all projects into memory
  const {
    projects,
    isLoading: isLoadingProjects,
    isLoadingMore,
    hasMore,
    totalCount,
    loadMore,
    refresh: refreshProjects,
    optimisticRemove,
  } = usePaginatedProjects(sortBy, sortOrder, statusFilter, searchQuery);
  
  // STABILITY: Track whether data has loaded at least once — never resets to false
  const hasLoadedOnceRef2 = useRef(false);
  if (!isLoadingProjects) hasLoadedOnceRef2.current = true;
  const hasLoadedOnce = hasLoadedOnceRef2.current;

  // CENTRALIZED GATEKEEPER - connected to real loading states
  // Must be AFTER usePaginatedProjects so we can pass dataLoading
  const gatekeeper = useGatekeeperLoading({
    ...GATEKEEPER_PRESETS.projects,
    authLoading: authLoading,
    dataLoading: isLoadingProjects,
    dataSuccess: hasLoadedOnce,
  });
  
  // EXCLUSIVE GATING: Track when gatekeeper has released — heavy components wait for this
  const gatekeeperReleasedRef = useRef(false);
  const [contentReady, setContentReady] = useState(false);
  
  useEffect(() => {
    if (!gatekeeper.isLoading && !gatekeeperReleasedRef.current) {
      gatekeeperReleasedRef.current = true;
      // Stagger content mount: let the main UI paint first, then mount heavy stuff
      const timer = setTimeout(() => {
        if (isMountedRef.current) setContentReady(true);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [gatekeeper.isLoading]);
  
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

  // Photo edits state
  interface PhotoEdit {
    id: string;
    original_url: string;
    edited_url: string | null;
    edit_type: string;
    custom_instruction: string | null;
    status: string;
    created_at: string;
    credits_charged: number | null;
  }
  const [photoEdits, setPhotoEdits] = useState<PhotoEdit[]>([]);
  const [isLoadingPhotoEdits, setIsLoadingPhotoEdits] = useState(true);
  const [selectedPhotoEdit, setSelectedPhotoEdit] = useState<PhotoEdit | null>(null);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);

  const handleDeletePhoto = useCallback(async (editId: string) => {
    if (!user) return;
    setDeletingPhotoId(editId);
    try {
      const { error } = await supabase
        .from('photo_edits')
        .delete()
        .eq('id', editId)
        .eq('user_id', user.id);
      if (error) throw error;
      setPhotoEdits(prev => prev.filter(p => p.id !== editId));
      if (selectedPhotoEdit?.id === editId) setSelectedPhotoEdit(null);
      toast.success('Photo deleted');
    } catch (err) {
      console.error('Delete photo failed:', err);
      toast.error('Failed to delete photo');
    } finally {
      setDeletingPhotoId(null);
    }
  }, [user, selectedPhotoEdit]);
  
  // BATCH RESOLVE: Fetch all clip URLs for projects that need them in ONE query
  // STABILITY FIX: Use project IDs string as dep key instead of projects array reference
  const projectIdsKey = useMemo(() => projects.map(p => p.id).join(','), [projects]);
  const clipResolutionDoneRef = useRef(false);
  
  useEffect(() => {
    if (!user || !hasLoadedOnce || !contentReady || !Array.isArray(projects) || projects.length === 0) return;
    
    const callId = ++clipResolutionIdRef.current;
    clipResolutionDoneRef.current = false;
    
    const resolveClipUrls = async () => {
      const projectsNeedingResolution = projects.filter(p => {
        const isCompleted = p.status === 'completed';
        const hasReplicateUrl = p.video_url?.includes('replicate.delivery');
        const hasManifest = isManifestUrl(p.video_url);
        return isCompleted || hasManifest || hasReplicateUrl;
      });
      
      if (projectsNeedingResolution.length === 0) {
        clipResolutionDoneRef.current = true;
        return;
      }
      
      const projectIds = projectsNeedingResolution.map(p => p.id);
      
      try {
        const { data: clips } = await supabase
          .from('video_clips')
          .select('project_id, video_url, shot_index')
          .in('project_id', projectIds)
          .eq('status', 'completed')
          .not('video_url', 'is', null)
          .order('shot_index', { ascending: true });
        
        if (clipResolutionIdRef.current !== callId) return;
        
        if (clips && clips.length > 0) {
          const clipsByProject = new Map<string, string>();
          for (const clip of clips) {
            if (!clipsByProject.has(clip.project_id) && clip.video_url && !clip.video_url.includes('replicate.delivery')) {
              clipsByProject.set(clip.project_id, clip.video_url);
            }
          }
          
          for (const p of projectsNeedingResolution) {
            if (!clipsByProject.has(p.id) && p.video_clips && p.video_clips.length > 0) {
              const firstMp4 = p.video_clips.find((u: string) => u?.includes('.mp4') && !u.includes('replicate.delivery'));
              if (firstMp4) clipsByProject.set(p.id, firstMp4);
            }
          }
          
          setResolvedClipUrls(prev => {
            const merged = new Map(prev);
            clipsByProject.forEach((url, id) => merged.set(id, url));
            return merged;
          });
        }
        clipResolutionDoneRef.current = true;
      } catch (err) {
        console.debug('[Projects] Batch clip resolution failed:', err);
        clipResolutionDoneRef.current = true;
      }
    };
    
    resolveClipUrls();
  }, [user, hasLoadedOnce, projectIdsKey]); // Stable string key, not array reference
  
  // Auto-generate missing thumbnails - runs ONCE after clip resolution completes
  const thumbnailsGeneratedRef = useRef(false);
  useEffect(() => {
    if (!user || !hasLoadedOnce || !contentReady || projects.length === 0) return;
    if (resolvedClipUrls.size === 0) return;
    if (thumbnailsGeneratedRef.current) return;
    
    thumbnailsGeneratedRef.current = true;
    
    try {
      const projectsNeedingThumbnails = projects.map(p => ({
        id: p.id,
        video_url: p.video_url,
        thumbnail_url: p.thumbnail_url,
        resolvedClipUrl: resolvedClipUrls.get(p.id) || null,
      }));
      generateMissingThumbnails(projectsNeedingThumbnails);
    } catch (err) {
      console.debug('[Projects] Thumbnail generation skipped:', err);
    }
  }, [user, hasLoadedOnce, projects.length, resolvedClipUrls.size, generateMissingThumbnails]);


  // Fetch training videos
  useEffect(() => {
    const fetchTrainingVideos = async () => {
      if (!user || !contentReady) return;
      
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
        console.debug('Failed to fetch training videos:', err);
      } finally {
        setIsLoadingTrainingVideos(false);
      }
    };
    
    fetchTrainingVideos();
  }, [user, contentReady]);

  // Fetch completed photo edits
  useEffect(() => {
    const fetchPhotoEdits = async () => {
      if (!user || !contentReady) return;
      setIsLoadingPhotoEdits(true);
      try {
        const { data, error } = await supabase
          .from('photo_edits')
          .select('id, original_url, edited_url, edit_type, custom_instruction, status, created_at, credits_charged')
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .not('edited_url', 'is', null)
          .order('created_at', { ascending: false })
          .limit(50);
        
        if (error) throw error;
        setPhotoEdits(data || []);
      } catch (err) {
        console.debug('Failed to fetch photo edits:', err);
      } finally {
        setIsLoadingPhotoEdits(false);
      }
    };
    fetchPhotoEdits();
  }, [user, contentReady]);

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
  // STABILITY FIX: Use ref for refresh to keep subscription stable
  const refreshRef = useRef(refreshProjects);
  refreshRef.current = refreshProjects;
  
  useEffect(() => {
    if (!user || !contentReady) return;
    
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    
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
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            refreshRef.current();
          }, 3000); // 3s debounce - projects page is NOT time-critical
        }
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [user?.id, contentReady]); // Only subscribe after content is ready

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

  // Wrapped delete: optimistically remove from UI IMMEDIATELY, then hard-delete on backend
  const handleDeleteProject = useCallback(async (projectId: string) => {
    // Instant UI removal - don't wait for backend
    optimisticRemove(projectId);
    // Fire backend delete (permanent hard delete)
    await deleteProject(projectId);
  }, [deleteProject, optimisticRemove]);
  
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
  
  // Load more handler - directly use loadMore (now has stable identity)
  const handleLoadMore = loadMore;
  
  const hasMoreToLoad = hasMore;

  // Stats - count ALL projects, not just those with video content
  const stats = useMemo(() => {
    const allProjects = projects; // Show all projects in stats
    const completed = allProjects.filter(isPlayableProject).length;
    const processing = allProjects.filter(p => ['generating', 'rendering', 'stitching'].includes(status(p))).length;
    const totalClips = allProjects.reduce((acc, p) => acc + (p.video_clips?.length || 0), 0);
    
    return { total: allProjects.length, completed, processing, totalClips };
  }, [projects]);

  // Tab counts for category tabs
  const tabCounts = useMemo(() => ({
    all: filteredProjects.length + trainingVideos.length + photoEdits.length,
    films: filteredProjects.length,
    training: trainingVideos.length,
    photos: photoEdits.length,
  }), [filteredProjects.length, trainingVideos.length, photoEdits.length]);

  // Infinite scroll observer ref - STABILITY FIX: Use ref for loadMore to avoid observer churn
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const loadMoreFnRef = useRef(loadMore);
  loadMoreFnRef.current = loadMore;
  
  // STABILITY: contentReadyRef tracks contentReady without causing observer re-creation
  const contentReadyRef = useRef(false);
  contentReadyRef.current = contentReady;
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Only fire loadMore AFTER content is fully ready — prevents premature fetches during gatekeeper
        if (entries[0]?.isIntersecting && contentReadyRef.current) {
          loadMoreFnRef.current();
        }
      },
      { rootMargin: '400px' }
    );
    const el = loadMoreRef.current;
    if (el) observer.observe(el);
    return () => { if (el) observer.unobserve(el); };
  }, []); // Mount once - reads from refs internally

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
    
    // If still no clips, check pending_video_tasks.predictions (avatar projects)
    if (clipUrls.length === 0) {
      try {
        const { data: projectData } = await supabase
          .from('movie_projects')
          .select('pending_video_tasks, voice_audio_url')
          .eq('id', project.id)
          .maybeSingle();
        
        if (projectData?.pending_video_tasks) {
          const tasks = projectData.pending_video_tasks as Record<string, unknown>;
          const predictions = tasks.predictions as Array<{ videoUrl?: string; status?: string; clipIndex?: number }> | undefined;
          
          if (predictions && Array.isArray(predictions)) {
            // Extract completed clips, sorted by clipIndex
            const completedPreds = predictions
              .filter(p => p.videoUrl && p.status === 'completed')
              .sort((a, b) => (a.clipIndex ?? 0) - (b.clipIndex ?? 0));
            
            clipUrls = completedPreds.map(p => p.videoUrl!).filter(Boolean);
            
            // Also grab master audio from tasks if available
            if (tasks.masterAudioUrl) {
              masterAudioUrl = tasks.masterAudioUrl as string;
            }
          }
        }
        
        // Fallback to voice_audio_url if not set yet
        if (!masterAudioUrl && projectData?.voice_audio_url) {
          masterAudioUrl = projectData.voice_audio_url;
        }
      } catch (error) {
        console.error('Failed to fetch avatar clips:', error);
      }
    }
    
    if (clipUrls.length === 0) {
      toast.error('No clips to download');
      return;
    }
    
    // Check for master audio (avatar projects) - may already be set above
    if (!masterAudioUrl && project.voice_audio_url) {
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

  const handleServerStitch = async (projectId: string) => {
    if (retryingProjectId) return;
    
    setRetryingProjectId(projectId);
    toast.info('Starting server-side stitch...', { description: 'Processing — this may take 2-3 minutes' });
    
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
        .maybeSingle();
      
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
      console.error('Server stitch failed:', err);
      toast.error('Video stitching failed. Please try again.', {
        action: { label: 'Retry', onClick: () => {} },
      });
    } finally {
      setRetryingProjectId(null);
    }
  };

  const handleBrowserStitch = (projectId: string) => {
    setShowBrowserStitcher(projectId);
  };

  const needsStitching = useMemo(() => projects.filter(p => {
    const hasClips = hasVideoContent(p);
    const isPlayable = isPlayableProject(p);
    const isProcessing = status(p) === 'stitching';
    const isStitchFailed = status(p) === 'stitching_failed';
    return (hasClips && !isPlayable && !isProcessing) || isStitchFailed;
  }), [projects]);
  
  const stitchingProjects = useMemo(() => projects.filter(p => status(p) === 'stitching'), [projects]);

  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden">
      {/* Gatekeeper loading screen - renders EXCLUSIVELY, no background or content behind it */}
      {gatekeeper.isLoading ? (
        <CinemaLoader
          isVisible={true}
          message={getGatekeeperMessage(gatekeeper.phase, GATEKEEPER_PRESETS.projects.messages)}
          showProgress={true}
          progress={gatekeeper.progress}
        />
      ) : (
        <>
      {/* Premium Animated Background - only mounts AFTER loading completes */}
      <ProjectsBackground />

      {/* Navigation */}
      <AppHeader onCreateClick={handleCreateProject} />

      {/* Floating Create CTA — high-conversion, always visible */}
      {stats.total > 0 && (
        <button
          onClick={handleCreateProject}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 h-12 px-6 rounded-full bg-primary text-primary-foreground font-semibold text-sm shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-105 transition-all duration-200"
        >
          <Plus className="w-4 h-4" />
          Create New
        </button>
      )}

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 pt-16 sm:pt-20">
        
        {/* Loading skeleton */}
        {(isLoadingProjects && !hasLoadedOnce) ? (
          <div className="pt-8">
            {/* Skeleton hero */}
            <div className="mb-8">
              <div className="h-3 w-16 rounded bg-white/[0.04] mb-2" />
              <div className="h-10 w-48 rounded bg-white/[0.06] mb-6" />
              <div className="h-px bg-white/[0.04]" />
            </div>
            {/* Skeleton grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-video rounded-xl bg-white/[0.03] border border-white/[0.04] animate-pulse" />
              ))}
            </div>
          </div>
        ) : stats.total === 0 && stitchingProjects.length === 0 ? (
          /* Minimal Empty State */
          <div className="flex flex-col items-center justify-center py-24 sm:py-32 px-4 animate-fade-in">
            <div className="w-16 h-16 rounded-full border border-white/[0.08] flex items-center justify-center mb-8">
              <Film className="w-7 h-7 text-white/15" strokeWidth={1} />
            </div>
            
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3 text-center tracking-tight">
              No projects yet
            </h2>
            
            <p className="text-white/30 text-sm sm:text-base mb-8 text-center max-w-sm">
              Create your first AI-generated film and it will appear here.
            </p>
            
            <button 
              onClick={handleCreateProject}
              className="group h-11 px-8 rounded-lg bg-white text-black hover:bg-white/90 font-medium text-sm transition-all"
            >
              <span className="flex items-center gap-2">
                <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-300" />
                Create Project
              </span>
            </button>
          </div>
        ) : (
          <>
            {/* Ambient atmospheric glow */}
            <div className="pointer-events-none">
              <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[400px] bg-primary/[0.03] rounded-full blur-[200px]" />
              <div className="absolute -top-20 left-1/4 w-[500px] h-[250px] bg-accent/[0.02] rounded-full blur-[150px]" />
            </div>

            {/* ===== PURE GALLERY ===== */}
            <div className="pt-4 sm:pt-8 animate-fade-in">

              {/* Training Videos */}
              {trainingVideos.length > 0 && (
                <section className="mb-10">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {trainingVideos.map((video, index) => (
                      <div
                        key={video.id}
                        className="group relative cursor-pointer animate-fade-in"
                        style={{ animationDelay: `${index * 0.05}s` }}
                        onClick={() => {
                          setSelectedTrainingVideo(video);
                          setTrainingVideoModalOpen(true);
                        }}
                      >
                        <div className={cn(
                          "relative aspect-video rounded-2xl overflow-hidden",
                          "bg-white/[0.02] border border-white/[0.04]",
                          "hover:border-primary/20 hover:-translate-y-2 hover:shadow-[0_30px_80px_-20px_rgba(124,58,237,0.15)] transition-all duration-700"
                        )}>
                          <LazyVideoThumbnail src={video.video_url} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500">
                            <div className="w-14 h-14 rounded-full bg-white/[0.12] backdrop-blur-2xl flex items-center justify-center border border-white/[0.18] shadow-[0_8px_32px_rgba(0,0,0,0.4)] hover:scale-110 transition-transform">
                              <Play className="w-6 h-6 text-white ml-0.5" fill="currentColor" />
                            </div>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteTrainingVideo(video.id); }}
                            className="absolute top-3 right-3 w-8 h-8 rounded-xl bg-black/40 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/60 border border-white/10"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-white" />
                          </button>
                          <div className="absolute bottom-0 left-0 right-0 p-4">
                            <h3 className="text-sm font-medium text-white truncate">{video.title}</h3>
                            <p className="text-[10px] text-white/30 mt-0.5">{formatTimeAgo(video.created_at)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Photo Edits */}
              {photoEdits.length > 0 && (
                <section className="mb-10">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {photoEdits.map((edit, index) => (
                      <div
                        key={edit.id}
                        className="group relative cursor-pointer animate-fade-in"
                        style={{ animationDelay: `${index * 0.03}s` }}
                        onClick={() => setSelectedPhotoEdit(selectedPhotoEdit?.id === edit.id ? null : edit)}
                      >
                        <div className={cn(
                          "relative aspect-square rounded-2xl overflow-hidden",
                          "bg-white/[0.02] border transition-all duration-700",
                          selectedPhotoEdit?.id === edit.id
                            ? "border-cyan-500/50 ring-2 ring-cyan-500/20"
                            : "border-white/[0.04] hover:border-cyan-500/20 hover:-translate-y-2 hover:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]"
                        )}>
                          <img src={edit.edited_url || edit.original_url} alt="Photo edit" className="w-full h-full object-cover" loading="lazy" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => { e.stopPropagation(); if (edit.edited_url) { const a = document.createElement('a'); a.href = edit.edited_url; a.download = `photo-edit-${edit.id.slice(0, 8)}.png`; a.target = '_blank'; a.click(); } }} className="w-7 h-7 rounded-lg bg-black/40 backdrop-blur-md flex items-center justify-center hover:bg-white/20 border border-white/10" title="Download">
                              <Download className="w-3 h-3 text-white" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); if (edit.edited_url) { sessionStorage.setItem('imageToVideoUrl', edit.edited_url); navigate('/create?mode=image-to-video'); toast.success('Photo loaded into video creator'); } }} className="w-7 h-7 rounded-lg bg-black/40 backdrop-blur-md flex items-center justify-center hover:bg-cyan-500/40 border border-white/10" title="Use in Video">
                              <Film className="w-3 h-3 text-white" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleDeletePhoto(edit.id); }} disabled={deletingPhotoId === edit.id} className="w-7 h-7 rounded-lg bg-black/40 backdrop-blur-md flex items-center justify-center hover:bg-red-500/40 border border-white/10" title="Delete">
                              {deletingPhotoId === edit.id ? <Loader2 className="w-3 h-3 text-white animate-spin" /> : <Trash2 className="w-3 h-3 text-white" />}
                            </button>
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 p-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-[10px] text-white/50 truncate">{edit.custom_instruction || edit.edit_type}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {selectedPhotoEdit && (
                    <div className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-4 animate-fade-in">
                      <div className="flex items-start gap-4">
                        <div className="flex gap-3 flex-1 min-w-0">
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] uppercase tracking-wider text-white/30 mb-2">Original</p>
                            <div className="aspect-square rounded-xl overflow-hidden border border-white/[0.06]">
                              <img src={selectedPhotoEdit.original_url} alt="Original" className="w-full h-full object-cover" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] uppercase tracking-wider text-cyan-400/60 mb-2">Enhanced</p>
                            <div className="aspect-square rounded-xl overflow-hidden border border-cyan-500/20">
                              <img src={selectedPhotoEdit.edited_url || ''} alt="Enhanced" className="w-full h-full object-cover" />
                            </div>
                          </div>
                        </div>
                        <button onClick={() => setSelectedPhotoEdit(null)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/30 hover:text-white/60 transition-colors flex-shrink-0">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      {selectedPhotoEdit.custom_instruction && (
                        <p className="text-xs text-white/40 mt-3 italic">"{selectedPhotoEdit.custom_instruction}"</p>
                      )}
                    </div>
                  )}
                </section>
              )}

              {/* Films — Magazine Gallery */}
              {filteredProjects.length > 0 && (
                <>
                  <MagazineGrid
                    projects={filteredProjects}
                    resolvedClipUrls={resolvedClipUrls}
                    activeProjectId={activeProjectId}
                    retryingProjectId={retryingProjectId}
                    browserStitchingProjectId={browserStitchingProjectId}
                    onPlay={handlePlayVideo}
                    onEdit={(project) => { setActiveProjectId(project.id); navigate('/create'); }}
                    onRename={handleRenameProject}
                    onDelete={(id) => handleDeleteProject(id)}
                    onDownload={handleDownloadAll}
                    onRetryStitch={handleServerStitch}
                    onBrowserStitch={handleBrowserStitch}
                    onTogglePin={togglePin}
                    onTogglePublic={handleTogglePublic}
                  />

                  {/* Infinite scroll sentinel */}
                  <div ref={loadMoreRef} className="py-6">
                    {isLoadingMore && (
                      <div className="flex justify-center">
                        <div className="flex items-center gap-3 text-white/15 text-xs">
                          <Loader2 className="w-4 h-4 animate-spin" />
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
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
        <DialogContent className="!left-[50%] !top-[50%] !-translate-x-1/2 !-translate-y-1/2 !transform bg-black border-none w-[96vw] sm:w-[95vw] max-w-5xl h-auto max-h-[90vh] p-0 overflow-hidden rounded-xl sm:rounded-2xl flex flex-col">
          {/* Hidden header for accessibility - title floats over video via player controls */}
          <DialogHeader className="sr-only">
            <DialogTitle>{selectedProject?.name || 'Video Player'}</DialogTitle>
            <DialogDescription>
              {selectedProject?.mode === 'avatar' ? 'AI Avatar Video' : 'Play all clips seamlessly'}
            </DialogDescription>
          </DialogHeader>
          {showBrowserStitcher && (
            <div className="relative w-full flex-1 min-h-0 flex items-center justify-center">
              <UniversalVideoPlayer
                source={{ projectId: showBrowserStitcher }}
                mode="inline"
                autoPlay
                className="w-full h-auto max-h-[90vh] aspect-video object-contain"
              />
              {/* Floating title overlay */}
              <div className="absolute top-0 left-0 right-0 p-3 sm:p-4 bg-gradient-to-b from-black/60 to-transparent pointer-events-none z-10">
                <div className="flex items-center gap-2">
                  <MonitorPlay className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-white text-sm sm:text-base font-medium truncate drop-shadow-lg">
                    {selectedProject?.name || 'Video Player'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Merge Download Dialog - downloads clips as ZIP or single MP4 */}
      <MergeDownloadDialog
        open={mergeDownloadOpen}
        onOpenChange={setMergeDownloadOpen}
        projectId={mergeDownloadProject?.id || ''}
        projectName={mergeDownloadProject?.name || 'Video'}
        clipUrls={mergeDownloadClips}
        masterAudioUrl={mergeDownloadAudioUrl}
      />
        </>
      )}
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
