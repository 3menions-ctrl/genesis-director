import { useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { 
  Film, Play, Download, Trash2, 
  Loader2, CheckCircle2, XCircle, Clock, ArrowLeft,
  ChevronDown, ChevronRight, Grid3X3, List, Search,
  Filter, RefreshCw, Sparkles, Eye, Video, LayoutGrid,
  Calendar, Timer, FolderOpen, MoreHorizontal, ExternalLink
} from 'lucide-react';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/button';
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
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { FullscreenVideoPlayer } from '@/components/studio/FullscreenVideoPlayer';
import { motion, AnimatePresence } from 'framer-motion';
import { useRetryStitch } from '@/hooks/useRetryStitch';
import { ConsistencyDashboard } from '@/components/studio/ConsistencyDashboard';
import { MotionVectorsDisplay } from '@/components/studio/MotionVectorsDisplay';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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

export default function Clips() {
  const navigate = useNavigate();
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
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'duration'>('recent');
  const [projectStatus, setProjectStatus] = useState<string | null>(null);
  const [proFeatures, setProFeatures] = useState<ProjectProFeatures | null>(null);

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
        
        // Fetch project data including pro_features_data
        const { data: projectData } = await supabase
          .from('movie_projects')
          .select('status, pro_features_data, quality_tier')
          .eq('id', projectIdFilter)
          .maybeSingle();
        
        if (projectData) {
          setProjectStatus(projectData.status);
          const proData = projectData.pro_features_data as any;
          if (proData) {
            // Extract from continuityPlan if available (standard tier structure)
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
      } else {
        const clipsWithTitles = (data || []).map((clip: any) => ({
          ...clip,
          project_title: clip.movie_projects?.title || 'Untitled Project'
        }));
        setClips(clipsWithTitles);
        
        if (projectIdFilter && clipsWithTitles.length > 0) {
          setProjectTitle(clipsWithTitles[0].project_title);
        }
      }
      setIsLoading(false);
    };

    loadClips();
  }, [user, projectIdFilter]);

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
          title: clip.project_title || 'Untitled Project',
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
          className: 'bg-success/10 text-success border-success/20'
        };
      case 'generating':
        return { 
          label: 'Generating', 
          icon: Loader2, 
          className: 'bg-warning/10 text-warning border-warning/20',
          animate: true
        };
      case 'pending':
        return { 
          label: 'Queued', 
          icon: Clock, 
          className: 'bg-info/10 text-info border-info/20'
        };
      case 'failed':
        return { 
          label: 'Failed', 
          icon: XCircle, 
          className: 'bg-destructive/10 text-destructive border-destructive/20'
        };
      default:
        return { 
          label: status, 
          icon: Clock, 
          className: 'bg-muted text-muted-foreground'
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
    const { error } = await supabase
      .from('video_clips')
      .delete()
      .eq('id', clipId);

    if (error) {
      toast.error('Failed to delete clip');
    } else {
      setClips(prev => prev.filter(c => c.id !== clipId));
      toast.success('Clip deleted');
    }
  };

  const completedCount = clips.filter(c => c.status === 'completed').length;
  const pendingCount = clips.filter(c => c.status === 'pending' || c.status === 'generating').length;
  const failedCount = clips.filter(c => c.status === 'failed').length;
  const totalDuration = clips.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-gradient-to-br from-purple-500/[0.03] to-transparent blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-gradient-to-tl from-emerald-500/[0.02] to-transparent blur-[120px]" />
      </div>

      <AppHeader />
      
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          {projectIdFilter && (
            <button 
              onClick={() => navigate('/clips')}
              className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to all clips
            </button>
          )}
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">
                {projectIdFilter ? projectTitle : 'Clip Library'}
              </h1>
              <p className="text-white/50 mt-1">
                Manage and preview your generated video clips
              </p>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-3">
              {projectIdFilter && projectStatus === 'stitching_failed' && completedCount > 0 && (
                <Button
                  onClick={retryStitch}
                  disabled={isRetryingStitch}
                  variant="outline"
                  className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                >
                  {isRetryingStitch ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Retry Stitch
                </Button>
              )}
              
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm">
                <Video className="w-4 h-4 text-white/50" />
                <span className="font-medium text-white">{clips.length}</span>
                <span className="text-white/50">clips</span>
              </div>
              
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm">
                <Timer className="w-4 h-4 text-white/50" />
                <span className="font-medium text-white">{formatDuration(totalDuration)}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Quick Stats Cards */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"
        >
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{completedCount}</p>
                <p className="text-sm text-white/50">Completed</p>
              </div>
            </div>
          </div>
          
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{pendingCount}</p>
                <p className="text-sm text-white/50">Processing</p>
              </div>
            </div>
          </div>
          
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{failedCount}</p>
                <p className="text-sm text-white/50">Failed</p>
              </div>
            </div>
          </div>
          
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                <FolderOpen className="w-5 h-5 text-white/70" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{projectGroups.length}</p>
                <p className="text-sm text-white/50">Projects</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Consistency Dashboard - Shows for project-specific view */}
        {projectIdFilter && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-6"
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

        {/* Toolbar */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6"
        >
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <Input
              placeholder="Search clips by prompt or project..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-white/20"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Status Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10">
                  <Filter className="w-4 h-4" />
                  {statusFilter === 'all' ? 'All' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-black/95 border-white/10">
                <DropdownMenuItem onClick={() => setStatusFilter('all')} className="text-white/70 hover:text-white focus:text-white focus:bg-white/10">
                  All Status
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem onClick={() => setStatusFilter('completed')} className="text-white/70 hover:text-white focus:text-white focus:bg-white/10">
                  <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-400" /> Completed
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('pending')} className="text-white/70 hover:text-white focus:text-white focus:bg-white/10">
                  <Loader2 className="w-4 h-4 mr-2 text-amber-400" /> Processing
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('failed')} className="text-white/70 hover:text-white focus:text-white focus:bg-white/10">
                  <XCircle className="w-4 h-4 mr-2 text-red-400" /> Failed
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Sort */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10">
                  <Calendar className="w-4 h-4" />
                  {sortBy === 'recent' ? 'Recent' : sortBy === 'oldest' ? 'Oldest' : 'Duration'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-black/95 border-white/10">
                <DropdownMenuItem onClick={() => setSortBy('recent')} className="text-white/70 hover:text-white focus:text-white focus:bg-white/10">
                  Most Recent
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('oldest')} className="text-white/70 hover:text-white focus:text-white focus:bg-white/10">
                  Oldest First
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('duration')} className="text-white/70 hover:text-white focus:text-white focus:bg-white/10">
                  Longest Duration
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* View Toggle */}
            <div className="flex items-center rounded-lg border border-white/10 bg-white/5 p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  "p-1.5 rounded-md transition-all",
                  viewMode === 'grid' 
                    ? "bg-white text-black" 
                    : "text-white/50 hover:text-white"
                )}
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={cn(
                  "p-1.5 rounded-md transition-all",
                  viewMode === 'table' 
                    ? "bg-white text-black" 
                    : "text-white/50 hover:text-white"
                )}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-8 h-8 animate-spin text-white/50" />
          </div>
        ) : clips.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-24 px-4"
          >
            <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center mb-6">
              <Film className="w-10 h-10 text-white/30" />
            </div>
            <h2 className="text-2xl font-semibold text-white mb-2">No clips yet</h2>
            <p className="text-white/50 mb-6 text-center max-w-md">
              Create your first video and clips will appear here automatically
            </p>
            <Button onClick={() => navigate('/production')} size="lg" className="bg-white text-black hover:bg-white/90">
              <Sparkles className="w-4 h-4 mr-2" />
              Create Video
            </Button>
          </motion.div>
        ) : filteredClips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <Search className="w-12 h-12 text-white/30 mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No matching clips</h3>
            <p className="text-white/50 text-center">Try adjusting your search or filters</p>
          </div>
        ) : viewMode === 'table' ? (
          /* Table View */
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden"
          >
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-white/5">
                  <TableHead className="w-24 text-white/50">Preview</TableHead>
                  <TableHead className="text-white/50">Prompt</TableHead>
                  <TableHead className="w-32 text-white/50">Project</TableHead>
                  <TableHead className="w-24 text-white/50">Status</TableHead>
                  <TableHead className="w-20 text-white/50">Duration</TableHead>
                  <TableHead className="w-28 text-white/50">Created</TableHead>
                  <TableHead className="w-16 text-right text-white/50">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClips.map((clip) => {
                  const statusConfig = getStatusConfig(clip.status);
                  const StatusIcon = statusConfig.icon;
                  
                  return (
                    <TableRow key={clip.id} className="group border-white/5 hover:bg-white/5">
                      <TableCell>
                        <div 
                          className="w-20 h-12 rounded-lg overflow-hidden bg-black/50 cursor-pointer relative group/thumb"
                          onClick={() => clip.video_url && handlePlayClip(clip)}
                        >
                          {clip.video_url ? (
                            <>
                              <video 
                                src={clip.video_url}
                                className="w-full h-full object-cover"
                                muted
                                playsInline
                                preload="metadata"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                                <Play className="w-5 h-5 text-white" fill="white" />
                              </div>
                            </>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Film className="w-5 h-5 text-white/20" />
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-white/80 line-clamp-2">{clip.prompt}</p>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-white/50 truncate block max-w-[120px]">
                          {clip.project_title}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("gap-1 text-xs", statusConfig.className)}>
                          <StatusIcon className={cn("w-3 h-3", statusConfig.animate && "animate-spin")} />
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-white/50">
                          {clip.duration_seconds ? `${clip.duration_seconds}s` : '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-white/50">
                          {formatRelativeDate(clip.created_at)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-white/50 hover:text-white">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-black/95 border-white/10">
                            {clip.video_url && (
                              <>
                                <DropdownMenuItem onClick={() => handlePlayClip(clip)} className="text-white/70 hover:text-white focus:text-white focus:bg-white/10">
                                  <Play className="w-4 h-4 mr-2" /> Play
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDownload(clip)} className="text-white/70 hover:text-white focus:text-white focus:bg-white/10">
                                  <Download className="w-4 h-4 mr-2" /> Download
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => window.open(clip.video_url!, '_blank')} className="text-white/70 hover:text-white focus:text-white focus:bg-white/10">
                                  <ExternalLink className="w-4 h-4 mr-2" /> Open in new tab
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-white/10" />
                              </>
                            )}
                            <DropdownMenuItem onClick={() => handleDelete(clip.id)} className="text-red-400 focus:text-red-400 focus:bg-red-500/10">
                              <Trash2 className="w-4 h-4 mr-2" /> Delete
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
          <div className="space-y-4">
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
                      "flex items-center gap-4 p-4 rounded-xl transition-all",
                      "bg-white/[0.02] border border-white/10 hover:border-white/20",
                      expandedProjects.has(group.id) && "border-white/20 bg-white/[0.04]"
                    )}>
                      <CollapsibleTrigger asChild>
                        <button className="flex items-center gap-4 flex-1 text-left min-w-0">
                          <div className={cn(
                            "w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center transition-transform flex-shrink-0",
                            expandedProjects.has(group.id) && "bg-white/10"
                          )}>
                            {expandedProjects.has(group.id) ? (
                              <ChevronDown className="w-4 h-4 text-white" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-white/50" />
                            )}
                          </div>

                          {/* Thumbnail */}
                          <div className="w-14 h-9 rounded-lg overflow-hidden bg-black/50 flex-shrink-0">
                            {group.clips[0]?.video_url ? (
                              <video 
                                src={group.clips[0].video_url}
                                className="w-full h-full object-cover"
                                muted
                                playsInline
                                preload="metadata"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Film className="w-4 h-4 text-white/20" />
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-white truncate">{group.title}</h3>
                            <div className="flex items-center gap-3 text-xs text-white/40 mt-0.5">
                              <span>{group.clips.length} clips</span>
                              <span>•</span>
                              <span>{formatDuration(group.totalDuration)}</span>
                              <span>•</span>
                              <span>{formatRelativeDate(group.latestUpdate)}</span>
                            </div>
                          </div>
                        </button>
                      </CollapsibleTrigger>

                      {/* Status Pills */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {group.completedCount > 0 && (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            {group.completedCount}
                          </Badge>
                        )}
                        {group.pendingCount > 0 && (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            {group.pendingCount}
                          </Badge>
                        )}
                        {group.failedCount > 0 && (
                          <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 gap-1">
                            <XCircle className="w-3 h-3" />
                            {group.failedCount}
                          </Badge>
                        )}
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/projects`);
                        }}
                        className="text-white/40 hover:text-white"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Clips Grid */}
                    <CollapsibleContent>
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mt-3 ml-12 p-4 rounded-xl bg-white/[0.01] border border-white/5 border-dashed grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3"
                      >
                        {group.clips.map((clip, clipIndex) => {
                          const statusConfig = getStatusConfig(clip.status);
                          const StatusIcon = statusConfig.icon;

                          return (
                            <motion.div
                              key={clip.id}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: clipIndex * 0.02 }}
                              className="group rounded-xl bg-white/[0.02] border border-white/10 overflow-hidden hover:border-white/20 transition-all hover:shadow-lg"
                            >
                              {/* Video Thumbnail */}
                              <div 
                                className="aspect-video relative cursor-pointer bg-black/50"
                                onClick={() => clip.video_url && handlePlayClip(clip)}
                              >
                                {clip.video_url ? (
                                  <>
                                    <video 
                                      src={clip.video_url}
                                      className="w-full h-full object-cover"
                                      muted
                                      playsInline
                                      preload="metadata"
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                                      <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                        <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Film className="w-8 h-8 text-white/20" />
                                  </div>
                                )}
                                
                                {/* Status Badge */}
                                <div className="absolute top-2 left-2">
                                  <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0.5 gap-1 backdrop-blur-sm bg-black/60", statusConfig.className)}>
                                    <StatusIcon className={cn("w-2.5 h-2.5", statusConfig.animate && "animate-spin")} />
                                    {statusConfig.label}
                                  </Badge>
                                </div>

                                {/* Duration */}
                                {clip.duration_seconds && (
                                  <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm">
                                    <span className="text-[10px] font-medium text-white">{clip.duration_seconds}s</span>
                                  </div>
                                )}
                              </div>

                              {/* Info */}
                              <div className="p-3">
                                <div className="flex items-center justify-between mb-1.5">
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-white/5 border-white/10 text-white/60">
                                    Shot {clip.shot_index + 1}
                                  </Badge>
                                  <span className="text-[10px] text-white/40">
                                    {formatRelativeDate(clip.created_at)}
                                  </span>
                                </div>
                                <p className="text-xs text-white/50 line-clamp-2 leading-relaxed">
                                  {clip.prompt}
                                </p>
                                
                                {/* Actions */}
                                <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {clip.video_url && (
                                    <>
                                      <Button variant="ghost" size="icon" className="h-7 w-7 text-white/50 hover:text-white" onClick={() => handlePlayClip(clip)}>
                                        <Play className="w-3.5 h-3.5" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-7 w-7 text-white/50 hover:text-white" onClick={() => handleDownload(clip)}>
                                        <Download className="w-3.5 h-3.5" />
                                      </Button>
                                    </>
                                  )}
                                  <div className="flex-1" />
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400/60 hover:text-red-400" onClick={() => handleDelete(clip.id)}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </motion.div>
                    </CollapsibleContent>
                  </Collapsible>
                </motion.div>
              ))}
          </div>
        )}
      </main>

      {/* Fullscreen Video Player */}
      {selectedClip && videoModalOpen && selectedClip.video_url && (
        <FullscreenVideoPlayer
          clips={[selectedClip.video_url]}
          onClose={() => setVideoModalOpen(false)}
          title={`Shot ${selectedClip.shot_index + 1}`}
        />
      )}
    </div>
  );
}
