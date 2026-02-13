import { useSearchParams } from 'react-router-dom';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSafeNavigation, useRouteCleanup, useNavigationAbort } from '@/lib/navigation';
import { 
  Film, Play, Download, Trash2, 
  Loader2, CheckCircle2, XCircle, Clock, ArrowLeft,
  ChevronDown, ChevronRight, Grid3X3, List, Search,
  Filter, RefreshCw, Sparkles, Eye, Video, LayoutGrid,
  Calendar, Timer, FolderOpen, MoreHorizontal, ExternalLink,
  Zap, TrendingUp, Layers, Clapperboard, MonitorPlay
} from 'lucide-react';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/button';
import { PausedFrameVideo } from '@/components/ui/PausedFrameVideo';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { UniversalVideoPlayer } from '@/components/player';
import { motion, AnimatePresence } from 'framer-motion';
import { useRetryStitch } from '@/hooks/useRetryStitch';
import { ConsistencyDashboard } from '@/components/studio/ConsistencyDashboard';
import { parsePendingVideoTasks, type PendingVideoTasks } from '@/types/pending-video-tasks';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ClipsPageSkeleton } from '@/components/ui/page-skeleton';
import ClipsBackground from '@/components/clips/ClipsBackground';
import { ClipsHero } from '@/components/clips/ClipsHero';

interface VideoClip {
  id: string;
  prompt: string;
  status: string;
  video_url: string | null;
  shot_index: number;
  duration_seconds: number | null;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
  project_id: string;
  project_title?: string;
  motion_vectors?: any;
  // For avatar clips - indicates the clip came from pending_video_tasks
  is_avatar_clip?: boolean;
}

interface ProjectProFeatures {
  masterSceneAnchor?: any;
  characters?: any[];
  identityBible?: any;
  consistencyScore?: number;
  qualityTier?: string;
}

interface ProjectGroup {
  id: string;
  title: string;
  clips: VideoClip[];
  completedCount: number;
  pendingCount: number;
  failedCount: number;
  totalDuration: number;
  latestUpdate: string;
}

// Circular progress component
function CircularProgress({ value, size = 48, strokeWidth = 4, className }: { 
  value: number; 
  size?: number; 
  strokeWidth?: number;
  className?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;
  
  return (
    <svg width={size} height={size} className={cn("transform -rotate-90", className)}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="opacity-10"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-700 ease-out"
      />
    </svg>
  );
}

export default function Clips() {
  // Unified navigation - safe navigation with locking
  const { navigate } = useSafeNavigation();
  const { getSignal, isMounted, abort: abortRequests } = useNavigationAbort();
  
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const projectIdFilter = searchParams.get('projectId');
  const [clips, setClips] = useState<VideoClip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedClip, setSelectedClip] = useState<VideoClip | null>(null);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [projectTitle, setProjectTitle] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending' | 'failed'>('all');
  
  // Register cleanup when leaving this page
  useRouteCleanup(() => {
    abortRequests();
    setSelectedClip(null);
    setVideoModalOpen(false);
  }, [abortRequests]);
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'duration'>('recent');
  const [projectStatus, setProjectStatus] = useState<string | null>(null);
  const [proFeatures, setProFeatures] = useState<ProjectProFeatures | null>(null);
  const [hoveredClip, setHoveredClip] = useState<string | null>(null);
  const [showBrowserStitcher, setShowBrowserStitcher] = useState<string | null>(null);
  const [projectsNeedingStitch, setProjectsNeedingStitch] = useState<Array<{id: string, title: string, clipCount: number}>>([]);

  const { retryStitch, isRetrying: isRetryingStitch } = useRetryStitch({
    projectId: projectIdFilter,
    userId: user?.id,
    onSuccess: () => {
      toast.success('Video stitched successfully!');
      setProjectStatus('completed');
    },
    onStatusChange: (status) => setProjectStatus(status),
  });

  useEffect(() => {
    const loadClips = async () => {
      if (!user) return;
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      // 1. Load clips from video_clips table (standard projects)
      let query = supabase
        .from('video_clips')
        .select(`
          id, prompt, status, video_url, shot_index, duration_seconds, 
          created_at, completed_at, error_message, project_id, motion_vectors,
          movie_projects!inner(title)
        `)
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(500);
      
      if (projectIdFilter) {
        query = query.eq('project_id', projectIdFilter);
        
        const { data: projectData } = await supabase
          .from('movie_projects')
          .select('status, pro_features_data, quality_tier')
          .eq('id', projectIdFilter)
          .maybeSingle();
        
        if (projectData) {
          setProjectStatus(projectData.status);
          const proData = projectData.pro_features_data as any;
          if (proData) {
            const continuityPlan = proData.continuityPlan;
            const envLock = continuityPlan?.environmentLock;
            
            setProFeatures({
              masterSceneAnchor: proData.masterSceneAnchor || (envLock ? {
                lighting: envLock.lighting,
                environment: `${envLock.weather || ''} ${envLock.timeOfDay || ''}`.trim(),
                dominantColors: envLock.colorPalette ? [envLock.colorPalette] : [],
              } : null),
              characters: proData.characters || [],
              identityBible: proData.identityBible,
              consistencyScore: proData.consistencyScore || (continuityPlan?.overallContinuityScore ? continuityPlan.overallContinuityScore / 100 : undefined),
              qualityTier: projectData.quality_tier,
            });
          }
        }
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading clips:', error);
        toast.error('Failed to load clips');
        setIsLoading(false);
        return;
      }
      
      const clipsWithTitles: VideoClip[] = (data || []).map((clip: any) => ({
        ...clip,
        project_title: clip.movie_projects?.title || 'Video Creation',
        is_avatar_clip: false,
      }));
      
      // 2. Load avatar project clips from pending_video_tasks.predictions
      // Avatar projects store clips differently - in the JSONB field, not video_clips table
      let avatarQuery = supabase
        .from('movie_projects')
        .select('id, title, pending_video_tasks, created_at, updated_at')
        .eq('user_id', session.user.id)
        .eq('mode', 'avatar')
        .in('status', ['completed', 'generating', 'producing'])
        .order('updated_at', { ascending: false })
        .limit(50);
      
      if (projectIdFilter) {
        avatarQuery = avatarQuery.eq('id', projectIdFilter);
      }
      
      const { data: avatarProjects, error: avatarError } = await avatarQuery;
      
      if (!avatarError && avatarProjects) {
        const avatarClips: VideoClip[] = [];
        
        for (const project of avatarProjects) {
          // Parse pending_video_tasks to extract predictions
          const rawTasks = project.pending_video_tasks as any;
          const predictions = rawTasks?.predictions as Array<{
            clipIndex: number;
            videoUrl?: string;
            status?: string;
            segmentText?: string;
            audioDurationMs?: number;
          }> | undefined;
          
          if (predictions && predictions.length > 0) {
            for (const pred of predictions) {
              if (pred.videoUrl) {
                avatarClips.push({
                  id: `avatar-${project.id}-${pred.clipIndex}`,
                  prompt: pred.segmentText || `Avatar Clip ${pred.clipIndex + 1}`,
                  status: pred.status === 'completed' ? 'completed' : (pred.status || 'pending'),
                  video_url: pred.videoUrl,
                  shot_index: pred.clipIndex,
                  duration_seconds: pred.audioDurationMs ? Math.ceil(pred.audioDurationMs / 1000) : 10,
                  created_at: project.created_at,
                  completed_at: rawTasks?.completedAt || project.updated_at,
                  error_message: null,
                  project_id: project.id,
                  project_title: project.title || 'Avatar Video',
                  is_avatar_clip: true,
                });
              }
            }
          }
        }
        
        // Merge avatar clips with standard clips, avoiding duplicates
        const existingProjectIds = new Set(clipsWithTitles.map(c => c.project_id));
        const newAvatarClips = avatarClips.filter(ac => {
          // Only add if no clips from this project exist in video_clips table
          const hasVideoClips = clipsWithTitles.some(c => c.project_id === ac.project_id);
          return !hasVideoClips;
        });
        
        clipsWithTitles.push(...newAvatarClips);
      }
      
      setClips(clipsWithTitles);
      
      if (projectIdFilter && clipsWithTitles.length > 0) {
        setProjectTitle(clipsWithTitles[0].project_title);
      }
      
      setIsLoading(false);
    };

    loadClips();
  }, [user, projectIdFilter]);

  // Fetch projects that need stitching (have completed clips but no final video)
  useEffect(() => {
    const loadProjectsNeedingStitch = async () => {
      if (!user) return;
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Get projects with status indicating they need stitching
      const { data: projects, error } = await supabase
        .from('movie_projects')
        .select('id, title')
        .eq('user_id', session.user.id)
        .in('status', ['stitching_failed', 'stitching', 'generating', 'pending_stitch'])
        .is('video_url', null)
        .order('updated_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error loading projects needing stitch:', error);
        return;
      }

      // For each project, count completed clips
      const projectsWithCounts = await Promise.all(
        (projects || []).map(async (project) => {
          const { count } = await supabase
            .from('video_clips')
            .select('id', { count: 'exact', head: true })
            .eq('project_id', project.id)
            .eq('status', 'completed')
            .not('video_url', 'is', null);

          return {
            id: project.id,
            title: project.title,
            clipCount: count || 0,
          };
        })
      );

      // Only show projects with at least 1 completed clip
      setProjectsNeedingStitch(projectsWithCounts.filter(p => p.clipCount > 0));
    };

    loadProjectsNeedingStitch();
  }, [user]);

  const filteredClips = useMemo(() => {
    let result = [...clips];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(clip => 
        clip.prompt.toLowerCase().includes(query) ||
        clip.project_title?.toLowerCase().includes(query)
      );
    }
    
    if (statusFilter !== 'all') {
      if (statusFilter === 'pending') {
        result = result.filter(c => c.status === 'pending' || c.status === 'generating');
      } else {
        result = result.filter(c => c.status === statusFilter);
      }
    }
    
    result.sort((a, b) => {
      if (sortBy === 'recent') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      } else if (sortBy === 'oldest') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else {
        return (b.duration_seconds || 0) - (a.duration_seconds || 0);
      }
    });
    
    return result;
  }, [clips, searchQuery, statusFilter, sortBy]);

  const projectGroups = useMemo(() => {
    const groups: Map<string, ProjectGroup> = new Map();
    
    filteredClips.forEach(clip => {
      const existing = groups.get(clip.project_id);
      if (existing) {
        existing.clips.push(clip);
        if (clip.status === 'completed') existing.completedCount++;
        else if (clip.status === 'pending' || clip.status === 'generating') existing.pendingCount++;
        else if (clip.status === 'failed') existing.failedCount++;
        existing.totalDuration += clip.duration_seconds || 0;
        if (new Date(clip.created_at) > new Date(existing.latestUpdate)) {
          existing.latestUpdate = clip.created_at;
        }
      } else {
        groups.set(clip.project_id, {
          id: clip.project_id,
          title: clip.project_title || 'Video Creation',
          clips: [clip],
          completedCount: clip.status === 'completed' ? 1 : 0,
          pendingCount: clip.status === 'pending' || clip.status === 'generating' ? 1 : 0,
          failedCount: clip.status === 'failed' ? 1 : 0,
          totalDuration: clip.duration_seconds || 0,
          latestUpdate: clip.created_at,
        });
      }
    });
    
    return Array.from(groups.values()).sort((a, b) => 
      new Date(b.latestUpdate).getTime() - new Date(a.latestUpdate).getTime()
    );
  }, [filteredClips]);

  const toggleProject = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const formatRelativeDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed':
        return { 
          label: 'Ready', 
          icon: CheckCircle2, 
          className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
          dotColor: 'bg-emerald-400'
        };
      case 'generating':
        return { 
          label: 'Generating', 
          icon: Loader2, 
          className: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
          dotColor: 'bg-amber-400',
          animate: true
        };
      case 'pending':
        return { 
          label: 'Queued', 
          icon: Clock, 
          className: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
          dotColor: 'bg-sky-400'
        };
      case 'failed':
        return { 
          label: 'Failed', 
          icon: XCircle, 
          className: 'bg-red-500/15 text-red-400 border-red-500/30',
          dotColor: 'bg-red-400'
        };
      default:
        return { 
          label: status, 
          icon: Clock, 
          className: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
          dotColor: 'bg-zinc-400'
        };
    }
  };

  const handlePlayClip = (clip: VideoClip) => {
    if (clip.video_url) {
      setSelectedClip(clip);
      setVideoModalOpen(true);
    }
  };

  const handleDownload = async (clip: VideoClip) => {
    if (!clip.video_url) return;
    
    try {
      const response = await fetch(clip.video_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `clip-${clip.shot_index + 1}-${clip.id.substring(0, 8)}.mp4`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Download started');
    } catch (error) {
      window.open(clip.video_url, '_blank');
    }
  };

  const handleDelete = async (clipId: string) => {
    // Use edge function for complete deletion (storage + database)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Please sign in to delete clips');
      return;
    }

    const { data, error } = await supabase.functions.invoke('delete-clip', {
      body: { clipId, userId: user.id },
    });

    if (error || !data?.success) {
      console.error('Delete clip error:', error || data?.error);
      toast.error('Failed to delete clip');
    } else {
      setClips(prev => prev.filter(c => c.id !== clipId));
      toast.success('Clip permanently deleted');
    }
  };

  const handleDeleteAllFailed = async () => {
    const failedClipIds = clips.filter(c => c.status === 'failed').map(c => c.id);
    if (failedClipIds.length === 0) return;

    const confirmed = window.confirm(`Delete ${failedClipIds.length} failed clip(s)? This cannot be undone.`);
    if (!confirmed) return;

    const { error } = await supabase
      .from('video_clips')
      .delete()
      .in('id', failedClipIds);

    if (error) {
      toast.error('Failed to delete clips');
    } else {
      setClips(prev => prev.filter(c => c.status !== 'failed'));
      toast.success(`Deleted ${failedClipIds.length} failed clips`);
    }
  };

  const completedCount = clips.filter(c => c.status === 'completed').length;
  const pendingCount = clips.filter(c => c.status === 'pending' || c.status === 'generating').length;
  const failedCount = clips.filter(c => c.status === 'failed').length;
  const totalDuration = clips.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);
  const successRate = clips.length > 0 ? Math.round((completedCount / clips.length) * 100) : 0;

  // Show skeleton while loading
  if (isLoading) {
    return <ClipsPageSkeleton />;
  }

  const formatDurationStr = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  return (
    <div className="min-h-screen bg-[#030303] text-white overflow-x-hidden">
      {/* Premium Purple Animated Background */}
      <ClipsBackground />

      <AppHeader />
      
      <main className="relative z-10 max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Back button for project-specific view */}
        {projectIdFilter && (
          <motion.button 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => navigate('/clips')}
            className="flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors mb-6 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Back to library</span>
          </motion.button>
        )}

        {/* Premium Hero Header with Purple Theme */}
        <ClipsHero 
          stats={{
            total: clips.length,
            completed: completedCount,
            processing: pendingCount,
            totalDuration: formatDurationStr(totalDuration)
          }}
          title={projectIdFilter && projectTitle ? projectTitle : "Clip Library"}
          subtitle={projectIdFilter ? "All generated clips for this project" : "Browse, preview, and manage all your AI-generated video clips"}
        />

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-wrap items-center gap-3 mb-8"
        >
          {/* Play All / Smart Player button for project view */}
          {projectIdFilter && completedCount > 0 && (
            <Button
              onClick={() => setShowBrowserStitcher(projectIdFilter)}
              className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 shadow-lg shadow-violet-500/25"
            >
              <Play className="w-4 h-4 mr-2" />
              Play All ({completedCount})
            </Button>
          )}
          
          {failedCount > 0 && (
            <Button
              onClick={handleDeleteAllFailed}
              variant="outline"
              size="sm"
              className="border-red-500/30 bg-red-500/5 text-red-400 hover:bg-red-500/15 hover:border-red-500/50"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear {failedCount} Failed
            </Button>
          )}
          
          {projectIdFilter && projectStatus === 'stitching_failed' && completedCount > 0 && (
            <Button
              onClick={retryStitch}
              disabled={isRetryingStitch}
              className="bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:from-amber-400 hover:to-orange-400"
            >
              {isRetryingStitch ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Retry Stitch
            </Button>
          )}

          {/* Open Editor */}
          {completedCount > 0 && (
            <Button
              onClick={() => navigate(projectIdFilter ? `/editor?projectId=${projectIdFilter}` : '/editor')}
              variant="outline"
              className="border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.08] hover:text-white hover:border-white/20"
            >
              <MonitorPlay className="w-4 h-4 mr-2" />
              Open Editor
            </Button>
          )}
          
        </motion.div>

        {/* Consistency Dashboard - Shows for project-specific view */}
        {projectIdFilter && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <ConsistencyDashboard
              masterAnchor={proFeatures?.masterSceneAnchor}
              characters={proFeatures?.characters?.map((c: any) => ({
                name: c.name || 'Unknown',
                appearance: c.appearance,
                verified: c.verified,
                consistencyScore: c.consistencyScore,
              })) || []}
              identityBibleActive={!!proFeatures?.identityBible}
              nonFacialAnchors={proFeatures?.identityBible?.nonFacialAnchors || []}
              consistencyScore={proFeatures?.consistencyScore || (completedCount > 0 ? completedCount / clips.length : 0)}
              consistencyMetrics={{
                color: proFeatures?.masterSceneAnchor?.dominantColors?.length ? 0.85 : undefined,
                scene: proFeatures?.masterSceneAnchor ? 0.9 : undefined,
              }}
              isProTier={proFeatures?.qualityTier === 'professional'}
            />
          </motion.div>
        )}


        {/* Premium Toolbar with Purple Accents */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <div className="relative p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-2xl overflow-hidden">
            {/* Subtle purple glow in corner */}
            <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-violet-500/5 blur-3xl pointer-events-none" />
            
            <div className="relative flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              {/* Search Bar - Premium with purple focus */}
              <div className="relative flex-1 max-w-md group">
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-violet-500/10 to-purple-500/5 opacity-0 group-focus-within:opacity-100 blur-xl transition-opacity duration-500" />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-violet-400 transition-colors" />
                <Input
                  placeholder="Search by prompt or project..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="relative h-11 pl-11 pr-4 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/25 focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 rounded-xl transition-all"
                />
              </div>

              {/* Divider */}
              <div className="hidden sm:block w-px h-10 bg-white/[0.08]" />

              <div className="flex items-center gap-2">
                {/* Status Filter - Purple themed */}
                <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  {[
                    { value: 'all', label: 'All', icon: Layers },
                    { value: 'completed', label: 'Ready', icon: CheckCircle2 },
                    { value: 'pending', label: 'Active', icon: Loader2 },
                    { value: 'failed', label: 'Failed', icon: XCircle },
                  ].map((filter) => (
                    <button
                      key={filter.value}
                      onClick={() => setStatusFilter(filter.value as any)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                        statusFilter === filter.value 
                          ? "bg-gradient-to-r from-violet-500/20 to-purple-500/20 text-violet-400 border border-violet-500/30" 
                          : "text-white/40 hover:text-white/70 hover:bg-white/[0.05]"
                      )}
                    >
                      <filter.icon className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{filter.label}</span>
                    </button>
                  ))}
                </div>

                {/* Sort Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-10 px-3 rounded-xl text-white/50 hover:text-white hover:bg-white/10 gap-2">
                      <Calendar className="w-4 h-4" />
                      <span className="hidden sm:inline text-sm">
                        {sortBy === 'recent' ? 'Recent' : sortBy === 'oldest' ? 'Oldest' : 'Duration'}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-zinc-900/95 backdrop-blur-xl border-white/10 rounded-xl shadow-2xl">
                    <DropdownMenuItem onClick={() => setSortBy('recent')} className="text-white/70 hover:text-white focus:text-white focus:bg-white/10 rounded-lg">
                      Most Recent
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortBy('oldest')} className="text-white/70 hover:text-white focus:text-white focus:bg-white/10 rounded-lg">
                      Oldest First
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortBy('duration')} className="text-white/70 hover:text-white focus:text-white focus:bg-white/10 rounded-lg">
                      Longest Duration
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* View Toggle - Purple themed */}
                <div className="flex items-center rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={cn(
                      "p-2 rounded-lg transition-all duration-200",
                      viewMode === 'grid' 
                        ? "bg-violet-500/20 text-violet-400" 
                        : "text-white/40 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <Grid3X3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    className={cn(
                      "p-2 rounded-lg transition-all duration-200",
                      viewMode === 'table' 
                        ? "bg-violet-500/20 text-violet-400" 
                        : "text-white/40 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-32"
            >
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-white/50" />
                </div>
                <div className="absolute inset-0 w-16 h-16 rounded-2xl bg-gradient-to-r from-violet-500/20 to-emerald-500/20 blur-xl animate-pulse" />
              </div>
              <p className="text-white/40 mt-4">Loading your clips...</p>
            </motion.div>
          ) : clips.length === 0 ? (
            <motion.div 
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center justify-center py-24 px-4"
            >
              <div className="relative mb-6">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] flex items-center justify-center">
                  <Film className="w-12 h-12 text-white/20" />
                </div>
                <div className="absolute inset-0 w-24 h-24 rounded-3xl bg-gradient-to-r from-violet-500/10 to-emerald-500/10 blur-2xl" />
              </div>
              <h2 className="text-2xl font-semibold text-white mb-2">No clips yet</h2>
              <p className="text-white/40 mb-8 text-center max-w-md">
                Start creating videos and your clips will appear here automatically
              </p>
              <Button 
                onClick={() => navigate('/production')} 
                size="lg" 
                className="bg-white text-black hover:bg-white/90 shadow-xl shadow-white/10"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Create Your First Video
              </Button>
            </motion.div>
          ) : filteredClips.length === 0 ? (
            <motion.div 
              key="no-results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20 px-4"
            >
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-white/30" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">No matching clips</h3>
              <p className="text-white/40 text-center">Try adjusting your search or filters</p>
            </motion.div>
          ) : viewMode === 'table' ? (
            /* Table View */
            <motion.div 
              key="table"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden backdrop-blur-sm"
            >
              <Table>
                <TableHeader>
                  <TableRow className="border-white/[0.06] hover:bg-white/[0.02]">
                    <TableHead className="w-28 text-white/50 font-medium">Preview</TableHead>
                    <TableHead className="text-white/50 font-medium">Prompt</TableHead>
                    <TableHead className="w-36 text-white/50 font-medium">Project</TableHead>
                    <TableHead className="w-28 text-white/50 font-medium">Status</TableHead>
                    <TableHead className="w-24 text-white/50 font-medium">Duration</TableHead>
                    <TableHead className="w-28 text-white/50 font-medium">Created</TableHead>
                    <TableHead className="w-16 text-right text-white/50 font-medium">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClips.map((clip, index) => {
                    const statusConfig = getStatusConfig(clip.status);
                    const StatusIcon = statusConfig.icon;
                    
                    return (
                      <TableRow 
                        key={clip.id} 
                        className="group border-white/[0.04] hover:bg-white/[0.03] transition-colors animate-in fade-in-0 slide-in-from-bottom-2"
                        style={{ animationDelay: `${index * 20}ms` }}
                      >
                        <TableCell className="py-3">
                          <div className="relative">
                            <UniversalVideoPlayer
                              source={{ urls: clip.video_url ? [clip.video_url] : [] }}
                              mode="thumbnail"
                              onClick={() => clip.video_url && handlePlayClip(clip)}
                              className="w-24 h-14 rounded-lg overflow-hidden"
                              aspectRatio="video"
                            />
                            <div className="absolute inset-0 rounded-lg ring-1 ring-inset ring-white/10" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1.5">
                            <p className="text-sm text-white/80 line-clamp-2 leading-relaxed">{clip.prompt}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-white/40 truncate block max-w-[130px]">
                            {clip.project_title}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("gap-1.5 text-xs font-medium", statusConfig.className)}>
                            <StatusIcon className={cn("w-3 h-3", statusConfig.animate && "animate-spin")} />
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-white/50 font-mono">
                            {clip.duration_seconds ? `${clip.duration_seconds}s` : '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-white/40">
                            {formatRelativeDate(clip.created_at)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-all text-white/40 hover:text-white hover:bg-white/10 rounded-lg">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-zinc-900/95 backdrop-blur-xl border-white/10 rounded-xl shadow-2xl">
                              {clip.video_url && (
                                <>
                                  <DropdownMenuItem onClick={() => handlePlayClip(clip)} className="text-white/70 hover:text-white focus:text-white focus:bg-white/10 rounded-lg gap-2">
                                    <Play className="w-4 h-4" /> Play
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleDownload(clip)} className="text-white/70 hover:text-white focus:text-white focus:bg-white/10 rounded-lg gap-2">
                                    <Download className="w-4 h-4" /> Download
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => window.open(clip.video_url!, '_blank')} className="text-white/70 hover:text-white focus:text-white focus:bg-white/10 rounded-lg gap-2">
                                    <ExternalLink className="w-4 h-4" /> Open in tab
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator className="bg-white/10" />
                                </>
                              )}
                              <DropdownMenuItem onClick={() => handleDelete(clip.id)} className="text-red-400 focus:text-red-400 focus:bg-red-500/10 rounded-lg gap-2">
                                <Trash2 className="w-4 h-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </motion.div>
          ) : (
            /* Grid View - Grouped by Project */
            <motion.div 
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {projectGroups.map((group, groupIndex) => (
                <motion.div
                  key={group.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: groupIndex * 0.05 }}
                >
                  <Collapsible 
                    open={expandedProjects.has(group.id)}
                    onOpenChange={() => toggleProject(group.id)}
                  >
                    {/* Project Header */}
                    <div className={cn(
                      "flex items-center gap-4 p-4 rounded-2xl transition-all duration-300",
                      "bg-gradient-to-r from-white/[0.03] to-white/[0.01] border border-white/[0.08]",
                      "hover:border-white/[0.15] hover:from-white/[0.05] hover:to-white/[0.02]",
                      expandedProjects.has(group.id) && "border-white/[0.15] from-white/[0.05] to-white/[0.02] shadow-lg shadow-black/20"
                    )}>
                      <CollapsibleTrigger asChild>
                        <button className="flex items-center gap-4 flex-1 text-left min-w-0">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                            "bg-white/[0.05] border border-white/[0.08]",
                            expandedProjects.has(group.id) && "bg-white/10 border-white/20"
                          )}>
                            <motion.div
                              animate={{ rotate: expandedProjects.has(group.id) ? 90 : 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <ChevronRight className="w-5 h-5 text-white/70" />
                            </motion.div>
                          </div>

                          {/* Thumbnail */}
                          <div className="relative w-16 h-10 rounded-lg overflow-hidden bg-black/50 flex-shrink-0 ring-1 ring-white/10">
                            {group.clips[0]?.video_url ? (
                              <PausedFrameVideo 
                                src={group.clips[0].video_url}
                                className="w-full h-full object-cover"
                                showLoader={false}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/5 to-transparent">
                                <Film className="w-4 h-4 text-white/20" />
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-white truncate">{group.title}</h3>
                            <div className="flex items-center gap-3 text-xs text-white/40 mt-0.5">
                              <span className="flex items-center gap-1">
                                <Layers className="w-3 h-3" />
                                {group.clips.length} clips
                              </span>
                              <span className="text-white/20">•</span>
                              <span className="flex items-center gap-1">
                                <Timer className="w-3 h-3" />
                                {formatDuration(group.totalDuration)}
                              </span>
                              <span className="text-white/20">•</span>
                              <span>{formatRelativeDate(group.latestUpdate)}</span>
                            </div>
                          </div>
                        </button>
                      </CollapsibleTrigger>

                      {/* Status Pills */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {group.completedCount > 0 && (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/25 gap-1 font-medium">
                            <CheckCircle2 className="w-3 h-3" />
                            {group.completedCount}
                          </Badge>
                        )}
                        {group.pendingCount > 0 && (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/25 gap-1 font-medium">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            {group.pendingCount}
                          </Badge>
                        )}
                        {group.failedCount > 0 && (
                          <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/25 gap-1 font-medium">
                            <XCircle className="w-3 h-3" />
                            {group.failedCount}
                          </Badge>
                        )}
                      </div>

                      {/* Browser Stitch Button - show when there are completed clips */}
                      {group.completedCount >= 2 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowBrowserStitcher(group.id);
                          }}
                          className="gap-2 text-purple-400 border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 hover:text-purple-300 hover:border-purple-500/50"
                        >
                          <MonitorPlay className="w-4 h-4" />
                          Stitch
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/projects`);
                        }}
                        className="text-white/30 hover:text-white hover:bg-white/10 rounded-xl"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Clips Grid */}
                    <CollapsibleContent>
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3 ml-14 p-5 rounded-2xl bg-gradient-to-b from-white/[0.02] to-transparent border border-white/[0.05] border-dashed"
                      >
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                          {group.clips.map((clip, clipIndex) => {
                            const statusConfig = getStatusConfig(clip.status);
                            const StatusIcon = statusConfig.icon;
                            const isHovered = hoveredClip === clip.id;

                            return (
                              <motion.div
                                key={clip.id}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: clipIndex * 0.025 }}
                                onHoverStart={() => setHoveredClip(clip.id)}
                                onHoverEnd={() => setHoveredClip(null)}
                                className="group relative rounded-xl overflow-hidden bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] hover:border-white/[0.2] transition-all duration-300 hover:shadow-xl hover:shadow-black/30"
                              >
                                {/* Video Thumbnail */}
                                <div className="relative">
                                  <UniversalVideoPlayer
                                    source={{ urls: clip.video_url ? [clip.video_url] : [] }}
                                    mode="thumbnail"
                                    hoverPreview
                                    onClick={() => clip.video_url && handlePlayClip(clip)}
                                  />
                                  
                                  {/* Status Badge */}
                                  <div className="absolute top-2 left-2 z-20">
                                    <Badge variant="outline" className={cn(
                                      "text-[10px] px-2 py-0.5 gap-1.5 backdrop-blur-md bg-black/50 border-white/20 font-medium",
                                      statusConfig.className
                                    )}>
                                      <StatusIcon className={cn("w-2.5 h-2.5", statusConfig.animate && "animate-spin")} />
                                      {statusConfig.label}
                                    </Badge>
                                  </div>
                                  
                                  {/* Play overlay */}
                                  <motion.div 
                                    className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                                    initial={false}
                                    animate={{ opacity: isHovered ? 1 : 0 }}
                                  >
                                    {clip.video_url && (
                                      <motion.div
                                        initial={{ scale: 0.8 }}
                                        animate={{ scale: isHovered ? 1 : 0.8 }}
                                        className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center"
                                      >
                                        <Play className="w-5 h-5 text-white ml-0.5" fill="currentColor" />
                                      </motion.div>
                                    )}
                                  </motion.div>
                                </div>

                                {/* Info */}
                                <div className="p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-white/5 border-white/10 text-white/60 font-mono">
                                      Shot {clip.shot_index + 1}
                                    </Badge>
                                    <span className="text-[10px] text-white/30">
                                      {formatRelativeDate(clip.created_at)}
                                    </span>
                                  </div>
                                  <p className="text-xs text-white/50 line-clamp-2 leading-relaxed min-h-[32px]">
                                    {clip.prompt}
                                  </p>
                                  
                                  {/* Actions */}
                                  <motion.div 
                                    className="flex items-center gap-1 mt-3 pt-3 border-t border-white/[0.06]"
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 5 }}
                                  >
                                    {clip.video_url && (
                                      <>
                                        <Button 
                                          variant="ghost" 
                                          size="icon" 
                                          className="h-7 w-7 text-white/40 hover:text-white hover:bg-white/10 rounded-lg" 
                                          onClick={() => handlePlayClip(clip)}
                                        >
                                          <Play className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button 
                                          variant="ghost" 
                                          size="icon" 
                                          className="h-7 w-7 text-white/40 hover:text-white hover:bg-white/10 rounded-lg" 
                                          onClick={() => handleDownload(clip)}
                                        >
                                          <Download className="w-3.5 h-3.5" />
                                        </Button>
                                      </>
                                    )}
                                    <div className="flex-1" />
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-7 w-7 text-red-400/50 hover:text-red-400 hover:bg-red-500/10 rounded-lg" 
                                      onClick={() => handleDelete(clip.id)}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </motion.div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </motion.div>
                    </CollapsibleContent>
                  </Collapsible>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Fullscreen Video Player */}
      {selectedClip && videoModalOpen && selectedClip.video_url && (
        <UniversalVideoPlayer
          source={{ urls: [selectedClip.video_url] }}
          mode="fullscreen"
          onClose={() => setVideoModalOpen(false)}
          title={`Shot ${selectedClip.shot_index + 1}`}
        />
      )}

      {/* Smart Stitcher Player Modal */}
      <Dialog open={!!showBrowserStitcher} onOpenChange={(open) => {
        if (!open) setShowBrowserStitcher(null);
      }}>
        <DialogContent className="bg-zinc-950 border-zinc-800 max-w-4xl p-0 overflow-hidden" hideCloseButton={false}>
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <MonitorPlay className="w-5 h-5 text-primary" />
              Smart Player & Stitcher
            </DialogTitle>
            <DialogDescription>
              Play clips seamlessly. Click "Export Video" to stitch into a single file.
            </DialogDescription>
          </DialogHeader>
          {showBrowserStitcher && (
            <div className="p-4 pt-2">
              <UniversalVideoPlayer
                source={{ projectId: showBrowserStitcher }}
                mode="inline"
                autoPlay
                className="aspect-video rounded-lg"
              />
            </div>
          )}
          <div className="flex justify-end p-4 pt-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowBrowserStitcher(null)}
              className="text-zinc-400 hover:text-white"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
