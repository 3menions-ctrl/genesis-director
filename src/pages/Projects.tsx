import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Plus, MoreVertical, Trash2, Copy, Edit2, Film, Play, 
  Download, Loader2, Zap, Clock, Sparkles,
  Pencil, Star, TrendingUp, Grid3X3, LayoutGrid, ChevronRight,
  Eye, Heart, Share2, RefreshCw, AlertCircle, Layers,
  Search, Filter, SortAsc, SortDesc, Calendar, FolderOpen,
  BarChart3, Activity, Settings2, ChevronDown, X, Check,
  Pin, PinOff, Archive, List, LayoutList, Command
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuGroup,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStudio } from '@/contexts/StudioContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Project } from '@/types/studio';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { FullscreenVideoPlayer } from '@/components/studio/FullscreenVideoPlayer';
import { VideoThumbnail } from '@/components/studio/VideoThumbnail';
import { AppHeader } from '@/components/layout/AppHeader';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';

// ============= HELPERS =============

const isManifestUrl = (url: string): boolean => url?.endsWith('.json');

const isStitchedMp4 = (url: string | undefined): boolean => {
  if (!url) return false;
  return url.includes('/final-videos/') && url.endsWith('.mp4');
};

const fetchClipsFromManifest = async (manifestUrl: string): Promise<string[]> => {
  try {
    const response = await fetch(manifestUrl);
    if (!response.ok) throw new Error('Failed to fetch manifest');
    const manifest = await response.json();
    return manifest.clips?.map((clip: { videoUrl: string }) => clip.videoUrl) || [];
  } catch (err) {
    return [];
  }
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

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  });
};

// ============= STAT CARD COMPONENT =============

function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  trend,
  color = 'white',
  delay = 0 
}: { 
  icon: React.ElementType;
  label: string;
  value: string | number;
  trend?: { value: number; isPositive: boolean };
  color?: 'white' | 'amber' | 'emerald' | 'blue';
  delay?: number;
}) {
  const colorClasses = {
    white: 'bg-white/5 text-white/70',
    amber: 'bg-amber-500/10 text-amber-400',
    emerald: 'bg-emerald-500/10 text-emerald-400',
    blue: 'bg-blue-500/10 text-blue-400',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, delay, ease: [0.16, 1, 0.3, 1] }}
      className="group relative p-2 rounded-lg bg-gradient-to-br from-white/[0.03] to-transparent border border-white/[0.05] hover:border-white/[0.1] transition-all duration-300"
    >
      <div className="relative flex items-center gap-2">
        <div className={cn("w-6 h-6 rounded-md flex items-center justify-center shrink-0", colorClasses[color])}>
          <Icon className="w-3 h-3" />
        </div>
        <div className="min-w-0">
          <p className="text-[9px] font-medium text-white/40 uppercase tracking-wider leading-none">{label}</p>
          <p className="text-sm font-bold text-white tracking-tight">{value}</p>
        </div>
      </div>
    </motion.div>
  );
}

// ============= PROJECT CARD COMPONENT =============

function ProjectCard({ 
  project,
  index,
  onPlay,
  onEdit,
  onRename,
  onDelete,
  onDownload,
  onRetryStitch,
  onTogglePin,
  isActive,
  isRetrying = false,
  isPinned = false,
  viewMode = 'grid'
}: {
  project: Project;
  index: number;
  onPlay: () => void;
  onEdit: () => void;
  onRename: () => void;
  onDelete: () => void;
  onDownload: () => void;
  onRetryStitch?: () => void;
  onTogglePin?: () => void;
  isActive: boolean;
  isRetrying?: boolean;
  isPinned?: boolean;
  viewMode?: 'grid' | 'list';
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  
  const status = project.status as string;
  // For direct stitched MP4s, use video_url; for manifests/clips, use video_clips array
  const isDirectVideo = project.video_url && !isManifestUrl(project.video_url);
  const hasVideo = Boolean(project.video_clips?.length || isDirectVideo);
  
  // Determine video source - prioritize direct video_url for completed projects
  const videoSrc = useMemo(() => {
    if (isDirectVideo && project.video_url) {
      return project.video_url;
    }
    if (project.video_clips?.length) {
      // Use second clip if available (more representative), else first
      return project.video_clips.length > 1 ? project.video_clips[1] : project.video_clips[0];
    }
    return null;
  }, [project.video_url, project.video_clips, isDirectVideo]);

  // Handle hover play/pause - videos are always visible, no loading state needed
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    const video = videoRef.current;
    if (video && hasVideo) {
      video.currentTime = 0;
      video.play().catch(() => {});
    }
  }, [hasVideo]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    const video = videoRef.current;
    if (video) {
      video.pause();
      // Seek to a position for thumbnail frame
      if (video.duration && video.duration > 0) {
        video.currentTime = Math.min(video.duration * 0.25, 1);
      }
    }
  }, []);

  const getStatusBadge = () => {
    if (hasVideo) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Ready</span>
        </span>
      );
    }
    if (status === 'stitching_failed') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30">
          <AlertCircle className="w-2.5 h-2.5 text-amber-400" />
          <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Stitch Failed</span>
        </span>
      );
    }
    if (status === 'stitching') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30">
          <Loader2 className="w-2.5 h-2.5 text-amber-400 animate-spin" />
          <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Stitching</span>
        </span>
      );
    }
    if (status === 'generating' || status === 'rendering') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/30">
          <Loader2 className="w-2.5 h-2.5 text-blue-400 animate-spin" />
          <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider">Processing</span>
        </span>
      );
    }
    return null;
  };

  if (viewMode === 'list') {
    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: index * 0.03, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          "group flex items-center gap-4 p-3 rounded-xl transition-all duration-300 cursor-pointer",
          "bg-white/[0.02] border border-white/[0.04]",
          "hover:bg-white/[0.05] hover:border-white/[0.08]",
          isActive && "ring-1 ring-white/20"
        )}
        onClick={onPlay}
      >
        {/* Thumbnail */}
        <div className="relative w-20 h-12 rounded-lg overflow-hidden bg-white/5 shrink-0">
          {hasVideo && videoSrc ? (
            <img 
              src={project.thumbnail_url || undefined}
              alt={project.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Film className="w-5 h-5 text-white/20" />
            </div>
          )}
          {isPinned && (
            <div className="absolute top-1 left-1 w-4 h-4 rounded bg-amber-500/80 flex items-center justify-center">
              <Pin className="w-2.5 h-2.5 text-black" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-white truncate">{project.name}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-white/40">{formatTimeAgo(project.updated_at)}</span>
            {(project.video_clips?.length ?? 0) > 0 && (
              <>
                <span className="text-white/20">•</span>
                <span className="text-xs text-white/40">{project.video_clips?.length} clips</span>
              </>
            )}
          </div>
        </div>

        {/* Status */}
        <div className="shrink-0">
          {getStatusBadge()}
        </div>

        {/* Actions */}
        <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white/50 hover:text-white"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 bg-zinc-900/95 border-white/10 backdrop-blur-xl">
              {hasVideo && (
                <>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onPlay(); }} className="text-white/80 focus:text-white focus:bg-white/10">
                    <Play className="w-4 h-4 mr-2" />
                    Watch
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDownload(); }} className="text-white/80 focus:text-white focus:bg-white/10">
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10" />
                </>
              )}
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onTogglePin?.(); }} className="text-white/80 focus:text-white focus:bg-white/10">
                {isPinned ? <PinOff className="w-4 h-4 mr-2" /> : <Pin className="w-4 h-4 mr-2" />}
                {isPinned ? 'Unpin' : 'Pin'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRename(); }} className="text-white/80 focus:text-white focus:bg-white/10">
                <Pencil className="w-4 h-4 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-red-400 focus:text-red-300 focus:bg-red-500/10">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </motion.div>
    );
  }

  // Grid view
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        duration: 0.5, 
        delay: index * 0.05,
        ease: [0.16, 1, 0.3, 1]
      }}
      className="group relative cursor-pointer"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onPlay}
    >
      <div className={cn(
        "relative overflow-hidden rounded-2xl transition-all duration-500 aspect-video",
        "bg-gradient-to-br from-white/[0.03] to-white/[0.01]",
        "border border-white/[0.06]",
        isHovered && "border-white/20 shadow-2xl shadow-white/5 scale-[1.02]",
        isActive && "ring-2 ring-white/30"
      )}>
        
        {/* Video/Thumbnail - always visible, no loading state */}
        {hasVideo && videoSrc ? (
          <>
            <video
              ref={videoRef}
              src={videoSrc}
              className={cn(
                "absolute inset-0 w-full h-full object-cover transition-transform duration-700",
                isHovered && "scale-105"
              )}
              loop
              muted
              playsInline
              preload="metadata"
            />
            
            {/* Cinematic bars on hover */}
            <motion.div 
              className="absolute inset-x-0 top-0 bg-black pointer-events-none"
              initial={{ height: 0 }}
              animate={{ height: isHovered ? '6%' : 0 }}
              transition={{ duration: 0.4 }}
            />
            <motion.div 
              className="absolute inset-x-0 bottom-0 bg-black pointer-events-none"
              initial={{ height: 0 }}
              animate={{ height: isHovered ? '6%' : 0 }}
              transition={{ duration: 0.4 }}
            />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-white/[0.04] to-transparent">
            {status === 'generating' || status === 'rendering' || status === 'stitching' ? (
              <div className="relative">
                <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-2xl animate-pulse scale-150" />
                <Loader2 className="relative w-10 h-10 text-amber-400/70 animate-spin" strokeWidth={1} />
              </div>
            ) : (
              <Film className="w-12 h-12 text-white/10" strokeWidth={1} />
            )}
          </div>
        )}

        {/* Gradient overlays */}
        <div className={cn(
          "absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent transition-opacity duration-500",
          isHovered ? "opacity-90" : "opacity-70"
        )} />
        
        {/* Play button */}
        <AnimatePresence>
          {hasVideo && isHovered && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 flex items-center justify-center z-10"
            >
              <div className="relative">
                <div className="absolute inset-[-4px] rounded-full border border-white/20 animate-ping" style={{ animationDuration: '1.5s' }} />
                <div className="w-14 h-14 rounded-full bg-white/15 backdrop-blur-xl flex items-center justify-center border border-white/30">
                  <Play className="w-6 h-6 text-white ml-0.5" fill="currentColor" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pin indicator */}
        {isPinned && (
          <div className="absolute top-3 left-3 z-20">
            <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center shadow-lg">
              <Pin className="w-3.5 h-3.5 text-black" />
            </div>
          </div>
        )}

        {/* Content overlay - hidden until hover for premium feel */}
        <AnimatePresence>
          {isHovered && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.25 }}
              className="absolute bottom-0 left-0 right-0 p-4 z-20"
            >
              <div className="flex items-center gap-2 mb-2">
                {getStatusBadge()}
              </div>

              <h3 className="font-bold text-white tracking-tight line-clamp-1 text-base drop-shadow-lg">
                {project.name}
              </h3>

              <div className="flex items-center gap-3 mt-1.5 text-white/70 text-xs">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatTimeAgo(project.updated_at)}
                </span>
                {(project.video_clips?.length ?? 0) > 0 && (
                  <span className="flex items-center gap-1">
                    <Film className="w-3 h-3" />
                    {project.video_clips?.length} clips
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick actions - top right */}
        <div className={cn(
          "absolute top-3 right-3 z-30 flex items-center gap-1 transition-all duration-300",
          isHovered ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
        )}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="h-8 w-8 flex items-center justify-center rounded-full bg-black/60 backdrop-blur-xl text-white/70 hover:text-white hover:bg-black/80 transition-all border border-white/10"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 rounded-xl bg-zinc-900/95 border-white/10 shadow-2xl backdrop-blur-2xl p-1.5">
              {hasVideo && (
                <>
                  <DropdownMenuItem 
                    onClick={(e) => { e.stopPropagation(); onPlay(); }}
                    className="gap-2.5 text-sm text-white/80 focus:text-white focus:bg-white/10 rounded-lg py-2.5 px-3"
                  >
                    <Play className="w-4 h-4" />
                    Watch Now
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={(e) => { e.stopPropagation(); onDownload(); }}
                    className="gap-2.5 text-sm text-white/80 focus:text-white focus:bg-white/10 rounded-lg py-2.5 px-3"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10 my-1" />
                </>
              )}
              <DropdownMenuItem 
                onClick={(e) => { e.stopPropagation(); onTogglePin?.(); }}
                className="gap-2.5 text-sm text-white/80 focus:text-white focus:bg-white/10 rounded-lg py-2.5 px-3"
              >
                {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                {isPinned ? 'Unpin' : 'Pin to Top'}
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={(e) => { e.stopPropagation(); onRename(); }} 
                className="gap-2.5 text-sm text-white/80 focus:text-white focus:bg-white/10 rounded-lg py-2.5 px-3"
              >
                <Pencil className="w-4 h-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={(e) => { e.stopPropagation(); onEdit(); }} 
                className="gap-2.5 text-sm text-white/80 focus:text-white focus:bg-white/10 rounded-lg py-2.5 px-3"
              >
                <Edit2 className="w-4 h-4" />
                Edit Project
              </DropdownMenuItem>
              {status === 'stitching_failed' && onRetryStitch && (
                <>
                  <DropdownMenuSeparator className="bg-white/10 my-1" />
                  <DropdownMenuItem
                    onClick={(e) => { e.stopPropagation(); onRetryStitch(); }}
                    disabled={isRetrying}
                    className="gap-2.5 text-sm text-amber-400 focus:text-amber-300 focus:bg-amber-500/10 rounded-lg py-2.5 px-3"
                  >
                    <RefreshCw className={cn("w-4 h-4", isRetrying && "animate-spin")} />
                    Retry Stitch
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator className="bg-white/10 my-1" />
              <DropdownMenuItem
                className="gap-2.5 text-sm text-red-400 focus:text-red-300 focus:bg-red-500/10 rounded-lg py-2.5 px-3"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </motion.div>
  );
}

// ============= ACTIVITY ITEM =============

function ActivityItem({ project, action, time }: { project: string; action: string; time: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-start gap-3 py-2.5"
    >
      <div className="w-2 h-2 rounded-full bg-white/30 mt-1.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white/70">
          <span className="font-medium text-white">{project}</span>
          {' '}{action}
        </p>
        <p className="text-[10px] text-white/40 mt-0.5">{time}</p>
      </div>
    </motion.div>
  );
}

// ============= MAIN COMPONENT =============

export default function Projects() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { 
    projects, 
    activeProjectId, 
    setActiveProjectId, 
    createProject, 
    deleteProject, 
    updateProject, 
    refreshProjects, 
    isLoading: isLoadingProjects, 
    hasLoadedOnce 
  } = useStudio();
  
  // UI State
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [projectToRename, setProjectToRename] = useState<Project | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [resolvedClips, setResolvedClips] = useState<string[]>([]);
  const [isLoadingClips, setIsLoadingClips] = useState(false);
  const [retryingProjectId, setRetryingProjectId] = useState<string | null>(null);
  const [isStitchingAll, setIsStitchingAll] = useState(false);
  const [stitchQueue, setStitchQueue] = useState<string[]>([]);
  
  // View & Filter State
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'name'>('updated');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'processing' | 'failed'>('all');
  const [pinnedProjects, setPinnedProjects] = useState<Set<string>>(new Set());
  const [showKeyboardHints, setShowKeyboardHints] = useState(false);

  // Scroll animation
  const { scrollY } = useScroll();
  const headerOpacity = useTransform(scrollY, [0, 100], [1, 0.8]);

  // Load pinned projects from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('pinnedProjects');
    if (saved) {
      try {
        setPinnedProjects(new Set(JSON.parse(saved)));
      } catch {}
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
          refreshProjects();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refreshProjects]);

  // Helper functions
  const status = (p: Project) => p.status as string;
  
  const hasVideoContent = (p: Project): boolean => {
    if (isStitchedMp4(p.video_url)) return true;
    if (p.video_url && isManifestUrl(p.video_url)) return true;
    if (p.video_clips && p.video_clips.length > 0) return true;
    return false;
  };
  
  const isPlayableProject = (p: Project): boolean => {
    if (isStitchedMp4(p.video_url)) return true;
    if (p.video_url && isManifestUrl(p.video_url) && status(p) === 'completed') return true;
    return false;
  };

  // Filtered and sorted projects
  const filteredProjects = useMemo(() => {
    let result = projects.filter(hasVideoContent);
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(query));
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(p => {
        const s = status(p);
        switch (statusFilter) {
          case 'completed': return isPlayableProject(p);
          case 'processing': return ['generating', 'rendering', 'stitching'].includes(s);
          case 'failed': return s === 'stitching_failed' || s === 'failed';
          default: return true;
        }
      });
    }
    
    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'updated':
          comparison = new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
          break;
        case 'created':
          comparison = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
      }
      return sortOrder === 'desc' ? comparison : -comparison;
    });
    
    // Put pinned projects first
    const pinned = result.filter(p => pinnedProjects.has(p.id));
    const unpinned = result.filter(p => !pinnedProjects.has(p.id));
    return [...pinned, ...unpinned];
  }, [projects, searchQuery, statusFilter, sortBy, sortOrder, pinnedProjects]);

  // Stats
  const stats = useMemo(() => {
    const allProjects = projects.filter(hasVideoContent);
    const completed = allProjects.filter(isPlayableProject).length;
    const processing = allProjects.filter(p => ['generating', 'rendering', 'stitching'].includes(status(p))).length;
    const totalClips = allProjects.reduce((acc, p) => acc + (p.video_clips?.length || 0), 0);
    
    return { total: allProjects.length, completed, processing, totalClips };
  }, [projects]);

  // Recent activity (mock for now - could be real from API)
  const recentActivity = useMemo(() => {
    return filteredProjects.slice(0, 5).map(p => ({
      project: p.name,
      action: isPlayableProject(p) ? 'was completed' : 'was updated',
      time: formatTimeAgo(p.updated_at)
    }));
  }, [filteredProjects]);

  // Handlers
  const handleCreateProject = () => {
    createProject();
    navigate('/create');
  };

  const handlePlayVideo = async (project: Project) => {
    if (project.video_clips?.length || project.video_url) {
      setSelectedProject(project);
      setIsLoadingClips(true);
      
      let clips: string[] = [];
      if (project.video_clips?.length) {
        clips = project.video_clips;
      } else if (project.video_url) {
        if (isManifestUrl(project.video_url)) {
          clips = await fetchClipsFromManifest(project.video_url);
        } else {
          clips = [project.video_url];
        }
      }
      
      setResolvedClips(clips);
      setIsLoadingClips(false);
      setVideoModalOpen(true);
    }
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
    
    const clips = project.video_clips || [];
    if (clips.length === 0) {
      toast.error('No clips to download');
      return;
    }

    toast.info('Starting downloads...');
    for (let i = 0; i < clips.length; i++) {
      try {
        const response = await fetch(clips[i]);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${project.name}-clip-${i + 1}.mp4`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        await new Promise(r => setTimeout(r, 500));
      } catch (error) {
        window.open(clips[i], '_blank');
      }
    }
    toast.success('Downloads complete!');
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

  // Needs stitching & processing projects
  const needsStitching = projects.filter(p => {
    const hasClips = hasVideoContent(p);
    const isPlayable = isPlayableProject(p);
    const isProcessing = status(p) === 'stitching';
    const isStitchFailed = status(p) === 'stitching_failed';
    return (hasClips && !isPlayable && !isProcessing) || isStitchFailed;
  });
  
  const stitchingProjects = projects.filter(p => status(p) === 'stitching');

  return (
    <div className="min-h-screen bg-[#050505] relative overflow-x-hidden">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-30%] left-[-20%] w-[80vw] h-[80vw] rounded-full bg-gradient-to-br from-white/[0.015] to-transparent blur-[150px]" />
        <div className="absolute bottom-[-40%] right-[-20%] w-[90vw] h-[90vw] rounded-full bg-gradient-to-tl from-white/[0.01] to-transparent blur-[180px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
      </div>

      {/* Navigation */}
      <AppHeader onCreateClick={handleCreateProject} />

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Loading state */}
        {(isLoadingProjects && !hasLoadedOnce) ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-32"
          >
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-white/5 rounded-full blur-2xl scale-150 animate-pulse" />
              <Loader2 className="relative w-10 h-10 text-white/50 animate-spin" />
            </div>
            <p className="text-white/40">Loading your projects...</p>
          </motion.div>
        ) : stats.total === 0 && stitchingProjects.length === 0 ? (
          /* Empty state */
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center justify-center py-32 px-4"
          >
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/[0.1] flex items-center justify-center mb-8"
            >
              <Sparkles className="w-10 h-10 text-white/30" strokeWidth={1} />
            </motion.div>
            
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3 text-center tracking-tight">
              Your Creative Space
            </h2>
            <p className="text-white/40 text-lg mb-10 text-center max-w-lg">
              Your completed masterpieces will appear here. Ready to create something extraordinary?
            </p>
            
            <Button 
              onClick={handleCreateProject}
              className="h-12 px-8 rounded-full bg-white text-black hover:bg-white/90 font-bold shadow-xl shadow-white/10"
            >
              <Plus className="w-5 h-5 mr-2" />
              Start Creating
            </Button>
          </motion.div>
        ) : (
          <>
            {/* Stats Dashboard */}
            <motion.div 
              style={{ opacity: headerOpacity }}
              className="grid grid-cols-4 gap-2 mb-6"
            >
              <StatCard icon={FolderOpen} label="Projects" value={stats.total} color="white" delay={0} />
              <StatCard icon={Check} label="Done" value={stats.completed} color="emerald" delay={0.03} />
              <StatCard icon={Activity} label="Active" value={stats.processing} color="amber" delay={0.06} />
              <StatCard icon={Film} label="Clips" value={stats.totalClips} color="blue" delay={0.09} />
            </motion.div>

            {/* Search, Filter & View Controls */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-8"
            >
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <Input
                  id="project-search"
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10 pl-10 pr-10 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/30 rounded-xl focus:border-white/20 focus:ring-0"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex text-[10px] font-mono text-white/30 bg-white/5 px-1.5 py-0.5 rounded">/</kbd>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2">
                {/* Status Filter */}
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                  <SelectTrigger className="w-[130px] h-10 bg-white/[0.03] border-white/[0.08] text-white rounded-xl">
                    <Filter className="w-3.5 h-3.5 mr-2 text-white/50" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-white/10">
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>

                {/* Sort */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-10 px-3 bg-white/[0.03] border-white/[0.08] text-white hover:bg-white/[0.06] rounded-xl">
                      {sortOrder === 'desc' ? <SortDesc className="w-4 h-4" /> : <SortAsc className="w-4 h-4" />}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-zinc-900 border-white/10">
                    <DropdownMenuLabel className="text-white/50 text-xs">Sort by</DropdownMenuLabel>
                    <DropdownMenuCheckboxItem 
                      checked={sortBy === 'updated'} 
                      onCheckedChange={() => setSortBy('updated')}
                      className="text-white/80"
                    >
                      Last Updated
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem 
                      checked={sortBy === 'created'} 
                      onCheckedChange={() => setSortBy('created')}
                      className="text-white/80"
                    >
                      Date Created
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem 
                      checked={sortBy === 'name'} 
                      onCheckedChange={() => setSortBy('name')}
                      className="text-white/80"
                    >
                      Name
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuItem 
                      onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                      className="text-white/80"
                    >
                      {sortOrder === 'desc' ? 'Ascending' : 'Descending'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* View Mode Toggle */}
                <div className="flex items-center gap-0.5 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={cn(
                      "p-2 rounded-lg transition-all",
                      viewMode === 'grid' ? "bg-white/10 text-white" : "text-white/40 hover:text-white"
                    )}
                  >
                    <Grid3X3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={cn(
                      "p-2 rounded-lg transition-all",
                      viewMode === 'list' ? "bg-white/10 text-white" : "text-white/40 hover:text-white"
                    )}
                  >
                    <LayoutList className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Needs Stitching Section */}
            {(needsStitching.length > 0 || stitchingProjects.length > 0) && (
              <motion.section 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="mb-8 p-4 rounded-2xl bg-gradient-to-r from-amber-500/5 to-transparent border border-amber-500/10"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-amber-400" />
                    <h2 className="text-sm font-semibold text-white">Ready to Stitch</h2>
                    <Badge variant="outline" className="text-amber-400 border-amber-500/30 text-[10px]">
                      {needsStitching.length + stitchingProjects.length}
                    </Badge>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {stitchingProjects.map(project => (
                    <div key={project.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
                      <span className="text-xs text-white/80 truncate max-w-[120px]">{project.name}</span>
                    </div>
                  ))}
                  {needsStitching.slice(0, 5).map(project => (
                    <button
                      key={project.id}
                      onClick={() => handleGoogleStitch(project.id)}
                      disabled={retryingProjectId === project.id}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                    >
                      <Zap className="w-3 h-3 text-amber-400" />
                      <span className="text-xs text-white/80 truncate max-w-[120px]">{project.name}</span>
                    </button>
                  ))}
                  {needsStitching.length > 5 && (
                    <span className="px-3 py-1.5 text-xs text-white/40">+{needsStitching.length - 5} more</span>
                  )}
                </div>
              </motion.section>
            )}

            {/* Main Grid/List */}
            <div className="flex gap-6 xl:gap-8">
              {/* Projects Grid */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex-1"
              >
                {filteredProjects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Search className="w-10 h-10 text-white/20 mb-4" />
                    <p className="text-white/50 mb-2">No projects found</p>
                    <p className="text-white/30 text-sm">Try adjusting your search or filters</p>
                  </div>
                ) : viewMode === 'list' ? (
                  <div className="space-y-2">
                    {filteredProjects.map((project, index) => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        index={index}
                        viewMode="list"
                        onPlay={() => handlePlayVideo(project)}
                        onEdit={() => { setActiveProjectId(project.id); navigate('/create'); }}
                        onRename={() => handleRenameProject(project)}
                        onDelete={() => deleteProject(project.id)}
                        onDownload={() => handleDownloadAll(project)}
                        onRetryStitch={() => handleGoogleStitch(project.id)}
                        onTogglePin={() => togglePin(project.id)}
                        isActive={activeProjectId === project.id}
                        isRetrying={retryingProjectId === project.id}
                        isPinned={pinnedProjects.has(project.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-5">
                    {filteredProjects.map((project, index) => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        index={index}
                        viewMode="grid"
                        onPlay={() => handlePlayVideo(project)}
                        onEdit={() => { setActiveProjectId(project.id); navigate('/create'); }}
                        onRename={() => handleRenameProject(project)}
                        onDelete={() => deleteProject(project.id)}
                        onDownload={() => handleDownloadAll(project)}
                        onRetryStitch={() => handleGoogleStitch(project.id)}
                        onTogglePin={() => togglePin(project.id)}
                        isActive={activeProjectId === project.id}
                        isRetrying={retryingProjectId === project.id}
                        isPinned={pinnedProjects.has(project.id)}
                      />
                    ))}
                    
                  </div>
                )}
              </motion.div>

              {/* Activity Sidebar - Desktop only */}
              <motion.aside
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="hidden 2xl:block w-60 shrink-0"
              >
                <div className="sticky top-24 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                  <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5" />
                    Recent Activity
                  </h3>
                  
                  <div className="space-y-1">
                    {recentActivity.map((item, i) => (
                      <ActivityItem key={i} {...item} />
                    ))}
                  </div>

                  {/* Keyboard shortcuts hint */}
                  <div className="mt-6 pt-4 border-t border-white/[0.06]">
                    <button 
                      onClick={() => setShowKeyboardHints(prev => !prev)}
                      className="flex items-center gap-2 text-xs text-white/40 hover:text-white/60 transition-colors"
                    >
                      <Command className="w-3.5 h-3.5" />
                      Keyboard shortcuts
                    </button>
                  </div>
                </div>
              </motion.aside>
            </div>
          </>
        )}
      </main>

      {/* Video Player Modal */}
      {videoModalOpen && selectedProject && !isLoadingClips && resolvedClips.length > 0 && (
        <FullscreenVideoPlayer
          clips={resolvedClips}
          title={selectedProject.name}
          onClose={() => {
            setVideoModalOpen(false);
            setResolvedClips([]);
          }}
          onDownload={() => handleDownloadAll(selectedProject)}
          onOpenExternal={() => {
            if (resolvedClips[0]) window.open(resolvedClips[0], '_blank');
          }}
          onEdit={() => {
            setVideoModalOpen(false);
            setResolvedClips([]);
            setActiveProjectId(selectedProject.id);
            navigate('/create');
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
    </div>
  );
}
