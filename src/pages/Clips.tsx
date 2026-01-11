import { useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Film, Play, Download, MoreVertical, Trash2, 
  Loader2, CheckCircle2, XCircle, Clock, ExternalLink, ArrowLeft,
  ChevronDown, ChevronRight, Folder, Grid3X3, List, Search,
  Filter, SortDesc, Sparkles, Eye, Layers
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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending' | 'failed'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'duration'>('recent');

  useEffect(() => {
    const loadClips = async () => {
      if (!user) return;
      
      let query = supabase
        .from('video_clips')
        .select(`
          id, prompt, status, video_url, shot_index, duration_seconds, 
          created_at, completed_at, error_message, project_id,
          movie_projects!inner(title)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(500);
      
      if (projectIdFilter) {
        query = query.eq('project_id', projectIdFilter);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading clips:', error);
        toast.error('Failed to load clips');
      } else {
        const clipsWithTitles = (data || []).map((clip: any) => ({
          ...clip,
          project_title: clip.movie_projects?.title || 'Unknown Project'
        }));
        setClips(clipsWithTitles);
        
        if (projectIdFilter && clipsWithTitles.length > 0) {
          setProjectTitle(clipsWithTitles[0].project_title);
        }
        
        // Auto-expand all projects initially
        const projectIds = new Set(clipsWithTitles.map((c: VideoClip) => c.project_id));
        setExpandedProjects(projectIds);
      }
      setIsLoading(false);
    };

    loadClips();
  }, [user, projectIdFilter]);

  // Filter and sort clips
  const filteredClips = useMemo(() => {
    let result = [...clips];
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(clip => 
        clip.prompt.toLowerCase().includes(query) ||
        clip.project_title?.toLowerCase().includes(query)
      );
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'pending') {
        result = result.filter(c => c.status === 'pending' || c.status === 'generating');
      } else {
        result = result.filter(c => c.status === statusFilter);
      }
    }
    
    // Sort
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

  // Group clips by project
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
          title: clip.project_title || 'Unknown Project',
          clips: [clip],
          completedCount: clip.status === 'completed' ? 1 : 0,
          pendingCount: clip.status === 'pending' || clip.status === 'generating' ? 1 : 0,
          failedCount: clip.status === 'failed' ? 1 : 0,
          totalDuration: clip.duration_seconds || 0,
          latestUpdate: clip.created_at,
        });
      }
    });
    
    // Sort groups by latest update
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
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

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed':
        return { 
          label: 'Ready', 
          icon: CheckCircle2, 
          color: 'text-emerald-400', 
          bgColor: 'bg-emerald-500/20',
          borderColor: 'border-emerald-500/30'
        };
      case 'generating':
      case 'pending':
        return { 
          label: status === 'generating' ? 'Generating' : 'Queued', 
          icon: Loader2, 
          color: 'text-amber-400', 
          bgColor: 'bg-amber-500/20',
          borderColor: 'border-amber-500/30',
          animate: status === 'generating'
        };
      case 'failed':
        return { 
          label: 'Failed', 
          icon: XCircle, 
          color: 'text-red-400', 
          bgColor: 'bg-red-500/20',
          borderColor: 'border-red-500/30'
        };
      default:
        return { 
          label: status, 
          icon: Clock, 
          color: 'text-white/50', 
          bgColor: 'bg-white/10',
          borderColor: 'border-white/20'
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
    <div className="min-h-screen bg-[#030303] relative overflow-x-hidden">
      {/* Dramatic background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-30%] left-[-20%] w-[70vw] h-[70vw] rounded-full bg-gradient-to-br from-purple-500/[0.02] to-transparent blur-[150px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-tl from-emerald-500/[0.02] to-transparent blur-[150px]" />
        
        {/* Film grain */}
        <div 
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      <AppHeader />
      
      {/* Hero Section */}
      <div className="relative z-10 border-b border-white/[0.04]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            {/* Title & Stats */}
            <div>
              {projectIdFilter && (
                <button 
                  onClick={() => navigate('/clips')}
                  className="flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors mb-3"
                >
                  <ArrowLeft className="w-4 h-4" />
                  All Clips
                </button>
              )}
              
              <motion.h1 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-4xl md:text-5xl font-bold text-white tracking-tight"
              >
                {projectIdFilter ? projectTitle : 'Clip Library'}
              </motion.h1>
              
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex items-center gap-4 mt-4"
              >
                <div className="flex items-center gap-2 text-white/40">
                  <Layers className="w-4 h-4" />
                  <span className="text-sm">{clips.length} clips</span>
                </div>
                <div className="w-px h-4 bg-white/10" />
                <div className="flex items-center gap-2 text-white/40">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">{Math.round(totalDuration / 60)}m {totalDuration % 60}s total</span>
                </div>
                <div className="w-px h-4 bg-white/10" />
                <div className="flex items-center gap-2 text-white/40">
                  <Folder className="w-4 h-4" />
                  <span className="text-sm">{projectGroups.length} projects</span>
                </div>
              </motion.div>
            </div>

            {/* Quick Stats */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="flex items-center gap-2"
            >
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-semibold text-white">{completedCount}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <Loader2 className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-semibold text-white">{pendingCount}</span>
              </div>
              {failedCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
                  <XCircle className="w-4 h-4 text-red-400" />
                  <span className="text-sm font-semibold text-white">{failedCount}</span>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="sticky top-16 z-40 bg-[#030303]/80 backdrop-blur-xl border-b border-white/[0.04]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <Input
                placeholder="Search clips..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/30 focus:border-white/20 h-9"
              />
            </div>

            {/* Status Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 bg-white/[0.03] border-white/[0.08] text-white/70 hover:text-white hover:bg-white/[0.06]">
                  <Filter className="w-4 h-4" />
                  {statusFilter === 'all' ? 'All Status' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-black/95 border-white/10">
                <DropdownMenuItem onClick={() => setStatusFilter('all')} className="text-white/70 hover:text-white">
                  All Status
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('completed')} className="text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Completed
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('pending')} className="text-amber-400">
                  <Loader2 className="w-4 h-4 mr-2" /> Pending
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('failed')} className="text-red-400">
                  <XCircle className="w-4 h-4 mr-2" /> Failed
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Sort */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 bg-white/[0.03] border-white/[0.08] text-white/70 hover:text-white hover:bg-white/[0.06]">
                  <SortDesc className="w-4 h-4" />
                  {sortBy === 'recent' ? 'Recent' : sortBy === 'oldest' ? 'Oldest' : 'Duration'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-black/95 border-white/10">
                <DropdownMenuItem onClick={() => setSortBy('recent')} className="text-white/70 hover:text-white">
                  Most Recent
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('oldest')} className="text-white/70 hover:text-white">
                  Oldest First
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('duration')} className="text-white/70 hover:text-white">
                  Longest Duration
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex-1" />

            {/* View Toggle */}
            <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-1 border border-white/[0.06]">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  "p-1.5 rounded-md transition-all",
                  viewMode === 'grid' ? "bg-white/10 text-white" : "text-white/40 hover:text-white"
                )}
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  "p-1.5 rounded-md transition-all",
                  viewMode === 'list' ? "bg-white/10 text-white" : "text-white/40 hover:text-white"
                )}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-32">
            <div className="relative">
              <div className="absolute inset-0 bg-white/5 rounded-full blur-2xl scale-150 animate-pulse" />
              <Loader2 className="relative w-10 h-10 animate-spin text-white/50" />
            </div>
          </div>
        ) : clips.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-32 px-4"
          >
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-emerald-500/20 rounded-3xl blur-2xl scale-125" />
              <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/[0.1] flex items-center justify-center">
                <Film className="w-10 h-10 text-white/30" />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-white mb-3">No clips yet</h2>
            <p className="text-white/40 text-lg mb-8 text-center max-w-md">
              Create your first video and clips will appear here automatically
            </p>
            <Button 
              onClick={() => navigate('/production')} 
              size="lg"
              className="bg-white text-black hover:bg-white/90 font-semibold px-8"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Create Video
            </Button>
          </motion.div>
        ) : filteredClips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <Search className="w-12 h-12 text-white/20 mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No matching clips</h3>
            <p className="text-white/40 text-center">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="space-y-6">
            <AnimatePresence>
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
                    <CollapsibleTrigger className="w-full">
                      <div className={cn(
                        "flex items-center gap-4 p-4 rounded-2xl transition-all",
                        "bg-gradient-to-r from-white/[0.03] to-transparent",
                        "border border-white/[0.06] hover:border-white/[0.1]",
                        expandedProjects.has(group.id) && "border-white/[0.1] bg-white/[0.02]"
                      )}>
                        {/* Expand Icon */}
                        <div className={cn(
                          "w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center transition-transform",
                          expandedProjects.has(group.id) && "rotate-0"
                        )}>
                          {expandedProjects.has(group.id) ? (
                            <ChevronDown className="w-4 h-4 text-white/60" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-white/60" />
                          )}
                        </div>

                        {/* Project Thumbnail */}
                        <div className="w-16 h-10 rounded-lg overflow-hidden bg-black/50 flex-shrink-0">
                          {group.clips[0]?.video_url ? (
                            <video 
                              src={group.clips[0].video_url}
                              className="w-full h-full object-cover"
                              muted
                              preload="metadata"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Film className="w-5 h-5 text-white/20" />
                            </div>
                          )}
                        </div>

                        {/* Project Info */}
                        <div className="flex-1 text-left min-w-0">
                          <h3 className="font-semibold text-white truncate">{group.title}</h3>
                          <div className="flex items-center gap-3 text-xs text-white/40 mt-0.5">
                            <span>{group.clips.length} clips</span>
                            <span>•</span>
                            <span>{group.totalDuration}s</span>
                            <span>•</span>
                            <span>{formatRelativeDate(group.latestUpdate)}</span>
                          </div>
                        </div>

                        {/* Status Pills */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {group.completedCount > 0 && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span className="text-xs font-medium text-emerald-400">{group.completedCount}</span>
                            </div>
                          )}
                          {group.pendingCount > 0 && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
                              <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
                              <span className="text-xs font-medium text-amber-400">{group.pendingCount}</span>
                            </div>
                          )}
                          {group.failedCount > 0 && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20">
                              <XCircle className="w-3 h-3 text-red-400" />
                              <span className="text-xs font-medium text-red-400">{group.failedCount}</span>
                            </div>
                          )}
                        </div>

                        {/* View Project */}
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
                    </CollapsibleTrigger>

                    {/* Clips Grid */}
                    <CollapsibleContent>
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className={cn(
                          "mt-3 ml-12 p-4 rounded-2xl bg-white/[0.01] border border-white/[0.04]",
                          viewMode === 'grid' 
                            ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3"
                            : "space-y-2"
                        )}
                      >
                        {group.clips.map((clip, clipIndex) => {
                          const statusConfig = getStatusConfig(clip.status);
                          const StatusIcon = statusConfig.icon;

                          if (viewMode === 'list') {
                            return (
                              <div
                                key={clip.id}
                                className="flex items-center gap-4 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-all group"
                              >
                                {/* Thumbnail */}
                                <div 
                                  className="w-24 h-14 rounded-lg overflow-hidden bg-black/50 flex-shrink-0 cursor-pointer relative"
                                  onClick={() => clip.video_url && handlePlayClip(clip)}
                                >
                                  {clip.video_url ? (
                                    <>
                                      <video 
                                        src={clip.video_url}
                                        className="w-full h-full object-cover"
                                        muted
                                        preload="metadata"
                                      />
                                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Play className="w-5 h-5 text-white" fill="white" />
                                      </div>
                                    </>
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <Film className="w-5 h-5 text-white/20" />
                                    </div>
                                  )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-white/[0.03] border-white/10">
                                      Shot {clip.shot_index + 1}
                                    </Badge>
                                    <Badge className={cn("text-[10px] px-1.5 py-0 h-5 gap-1 border", statusConfig.bgColor, statusConfig.color, statusConfig.borderColor)}>
                                      <StatusIcon className={cn("w-2.5 h-2.5", statusConfig.animate && "animate-spin")} />
                                      {statusConfig.label}
                                    </Badge>
                                    {clip.duration_seconds && (
                                      <span className="text-[10px] text-white/30">{clip.duration_seconds}s</span>
                                    )}
                                  </div>
                                  <p className="text-xs text-white/50 truncate">{clip.prompt}</p>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {clip.video_url && (
                                    <>
                                      <Button variant="ghost" size="icon" className="w-8 h-8 text-white/40 hover:text-white" onClick={() => handlePlayClip(clip)}>
                                        <Play className="w-4 h-4" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="w-8 h-8 text-white/40 hover:text-white" onClick={() => handleDownload(clip)}>
                                        <Download className="w-4 h-4" />
                                      </Button>
                                    </>
                                  )}
                                  <Button variant="ghost" size="icon" className="w-8 h-8 text-red-400/60 hover:text-red-400" onClick={() => handleDelete(clip.id)}>
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <motion.div
                              key={clip.id}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: clipIndex * 0.02 }}
                              className="group relative bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden hover:border-white/[0.12] transition-all"
                            >
                              {/* Video Thumbnail */}
                              <div 
                                className="aspect-video bg-black/50 relative cursor-pointer"
                                onClick={() => clip.video_url && handlePlayClip(clip)}
                              >
                                {clip.video_url ? (
                                  <video 
                                    src={clip.video_url} 
                                    className="w-full h-full object-cover"
                                    muted
                                    preload="metadata"
                                    onLoadedData={(e) => {
                                      (e.target as HTMLVideoElement).currentTime = 1;
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    {clip.status === 'generating' ? (
                                      <Loader2 className="w-6 h-6 text-amber-400/50 animate-spin" />
                                    ) : (
                                      <Film className="w-6 h-6 text-white/10" />
                                    )}
                                  </div>
                                )}
                                
                                {/* Play overlay */}
                                {clip.video_url && (
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                                      <Play className="w-4 h-4 text-white fill-white" />
                                    </div>
                                  </div>
                                )}
                                
                                {/* Status Badge */}
                                <div className="absolute top-2 left-2">
                                  <Badge className={cn("gap-1 text-[9px] px-1.5 py-0.5 border", statusConfig.bgColor, statusConfig.color, statusConfig.borderColor)}>
                                    <StatusIcon className={cn("w-2.5 h-2.5", statusConfig.animate && "animate-spin")} />
                                    {statusConfig.label}
                                  </Badge>
                                </div>

                                {/* Shot number */}
                                <div className="absolute top-2 right-2">
                                  <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 bg-black/60 border-white/20 text-white/80">
                                    #{clip.shot_index + 1}
                                  </Badge>
                                </div>

                                {/* Duration */}
                                {clip.duration_seconds && (
                                  <div className="absolute bottom-2 right-2">
                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 bg-black/60 border-white/20 text-white/80">
                                      {clip.duration_seconds}s
                                    </Badge>
                                  </div>
                                )}
                              </div>

                              {/* Info */}
                              <div className="p-2.5">
                                <p className="text-[11px] text-white/50 line-clamp-2 leading-relaxed">{clip.prompt.substring(0, 60)}...</p>
                                
                                <div className="flex items-center justify-between mt-2">
                                  <span className="text-[10px] text-white/25">{formatRelativeDate(clip.created_at)}</span>
                                  
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="w-6 h-6 text-white/30 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                        <MoreVertical className="w-3.5 h-3.5" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="bg-black/95 border-white/10 min-w-[140px]">
                                      {clip.video_url && (
                                        <>
                                          <DropdownMenuItem 
                                            onClick={() => handlePlayClip(clip)}
                                            className="text-white/70 hover:text-white text-xs gap-2"
                                          >
                                            <Play className="w-3.5 h-3.5" />
                                            Play
                                          </DropdownMenuItem>
                                          <DropdownMenuItem 
                                            onClick={() => handleDownload(clip)}
                                            className="text-white/70 hover:text-white text-xs gap-2"
                                          >
                                            <Download className="w-3.5 h-3.5" />
                                            Download
                                          </DropdownMenuItem>
                                          <DropdownMenuItem 
                                            onClick={() => window.open(clip.video_url!, '_blank')}
                                            className="text-white/70 hover:text-white text-xs gap-2"
                                          >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                            Open in Tab
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator className="bg-white/10" />
                                        </>
                                      )}
                                      <DropdownMenuItem 
                                        onClick={() => handleDelete(clip.id)}
                                        className="text-red-400 hover:text-red-300 text-xs gap-2"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
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
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Video Player Modal */}
      {selectedClip?.video_url && videoModalOpen && (
        <FullscreenVideoPlayer
          clips={[selectedClip.video_url]}
          title={`${selectedClip.project_title} - Shot ${selectedClip.shot_index + 1}`}
          onClose={() => setVideoModalOpen(false)}
        />
      )}
    </div>
  );
}
