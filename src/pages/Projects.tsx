import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Plus, MoreVertical, Trash2, Copy, Edit2, Film, Play, 
  Download, Loader2, Zap, Clock, Sparkles, ArrowRight,
  Pencil, Star, TrendingUp, Grid3X3, LayoutGrid, ChevronRight,
  Eye, Heart, Share2, RefreshCw, AlertCircle, Layers,
  Search, Filter, SortAsc, SortDesc, Calendar, FolderOpen,
  BarChart3, Activity, Settings2, ChevronDown, X, Check,
  Pin, PinOff, Archive, List, LayoutList, Command, Globe, Lock,
  GraduationCap, Video, MonitorPlay, Palette, Wand2, Image, ExternalLink
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
import { ManifestVideoPlayer } from '@/components/studio/ManifestVideoPlayer';
import { VideoThumbnail } from '@/components/studio/VideoThumbnail';
import { AppHeader } from '@/components/layout/AppHeader';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { useProjectThumbnails } from '@/hooks/useProjectThumbnails';
import { SmartStitcherPlayer } from '@/components/studio/SmartStitcherPlayer';
import ProjectsBackground from '@/components/projects/ProjectsBackground';
import { ProjectsHero } from '@/components/projects/ProjectsHero';

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

// The StatCard and HeroHeader components are now imported from ProjectsHero

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
  onBrowserStitch,
  onTogglePin,
  onTogglePublic,
  isActive,
  isRetrying = false,
  isBrowserStitching = false,
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
  onBrowserStitch?: () => void;
  onTogglePin?: () => void;
  onTogglePublic?: () => void;
  isActive: boolean;
  isRetrying?: boolean;
  isBrowserStitching?: boolean;
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

  // Force video to show a frame when loaded - browsers need this to display video thumbnail
  const handleVideoLoaded = useCallback(() => {
    const video = videoRef.current;
    if (video && video.duration > 0) {
      // Seek to 10% of video to get a good thumbnail frame (skip potential black intro)
      video.currentTime = Math.min(video.duration * 0.1, 1);
    }
  }, []);

  // Handle hover play/pause
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
      // Seek back to thumbnail frame
      if (video.duration && video.duration > 0) {
        video.currentTime = Math.min(video.duration * 0.1, 1);
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
          "bg-zinc-900/60 border border-white/[0.06]",
          "hover:bg-zinc-800/60 hover:border-white/[0.1]",
          isActive && "ring-1 ring-white/20"
        )}
        onClick={onPlay}
      >
        {/* Thumbnail */}
        <div className="relative w-20 h-12 rounded-lg overflow-hidden bg-zinc-800 shrink-0">
          {hasVideo && videoSrc ? (
            project.thumbnail_url ? (
              <img 
                src={project.thumbnail_url}
                alt={project.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />
              </div>
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Film className="w-5 h-5 text-zinc-600" />
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
            <span className="text-xs text-zinc-500">{formatTimeAgo(project.updated_at)}</span>
            {(project.video_clips?.length ?? 0) > 0 && (
              <>
                <span className="text-zinc-700">•</span>
                <span className="text-xs text-zinc-500">{project.video_clips?.length} clips</span>
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
                className="h-8 w-8 text-zinc-500 hover:text-white"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 bg-zinc-900 border-white/10 backdrop-blur-xl">
              {hasVideo && (
                <>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onPlay(); }} className="text-zinc-300 focus:text-white focus:bg-white/10">
                    <Play className="w-4 h-4 mr-2" />
                    Watch
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDownload(); }} className="text-zinc-300 focus:text-white focus:bg-white/10">
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10" />
                </>
              )}
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onTogglePin?.(); }} className="text-zinc-300 focus:text-white focus:bg-white/10">
                {isPinned ? <PinOff className="w-4 h-4 mr-2" /> : <Pin className="w-4 h-4 mr-2" />}
                {isPinned ? 'Unpin' : 'Pin'}
              </DropdownMenuItem>
              {hasVideo && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onTogglePublic?.(); }} className={cn(
                  "text-zinc-300 focus:text-white focus:bg-white/10",
                  project.is_public && "text-emerald-400"
                )}>
                  {project.is_public ? <Globe className="w-4 h-4 mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
                  {project.is_public ? 'Public' : 'Share to Feed'}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRename(); }} className="text-zinc-300 focus:text-white focus:bg-white/10">
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

  // Cinematic Grid view
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        duration: 0.6, 
        delay: index * 0.06,
        ease: [0.16, 1, 0.3, 1]
      }}
      whileHover={{ y: -8 }}
      className="group relative cursor-pointer"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onPlay}
    >
      {/* Dramatic glow effect on hover */}
      <motion.div
        className="absolute -inset-2 rounded-3xl bg-gradient-to-b from-foreground/10 via-foreground/5 to-transparent opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-700 pointer-events-none"
      />
      
      <div className={cn(
        "relative overflow-hidden rounded-2xl transition-all duration-700",
        "bg-zinc-900 border border-white/[0.06]",
        hasVideo ? "aspect-video" : index % 3 === 0 ? "aspect-[4/5]" : index % 3 === 1 ? "aspect-square" : "aspect-video",
        isHovered && "border-white/20 shadow-2xl shadow-black/50",
        isActive && "ring-2 ring-white/30"
      )}>
        
        {/* Video/Thumbnail - use actual video frame, never AI-generated images */}
        {hasVideo && videoSrc ? (
          <>
            {/* Video element - ALWAYS visible as base layer (paused at thumbnail frame) */}
            <video
              ref={videoRef}
              src={videoSrc}
              className={cn(
                "absolute inset-0 w-full h-full object-cover transition-all duration-700",
                isHovered && "scale-105"
              )}
              loop
              muted
              playsInline
              preload="auto"
              onLoadedData={handleVideoLoaded}
              crossOrigin="anonymous"
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
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
            {status === 'generating' || status === 'rendering' || status === 'stitching' ? (
              <div className="relative">
                <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-2xl animate-pulse scale-150" />
                <Loader2 className="relative w-10 h-10 text-amber-500/70 animate-spin" strokeWidth={1} />
              </div>
            ) : (
              <Film className="w-12 h-12 text-zinc-700" strokeWidth={1} />
            )}
          </div>
        )}

        {/* Gradient overlays */}
        <div className={cn(
          "absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent transition-opacity duration-500",
          isHovered ? "opacity-90" : "opacity-70"
        )} />
        
        {/* Cinematic Play button */}
        <AnimatePresence>
          {hasVideo && isHovered && (
            <motion.div
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 flex items-center justify-center z-10"
            >
              <div className="relative">
                {/* Multiple expanding rings */}
                <motion.div 
                  className="absolute inset-[-8px] rounded-full border border-white/10"
                  animate={{ scale: [1, 1.3], opacity: [0.5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <motion.div 
                  className="absolute inset-[-4px] rounded-full border border-white/20"
                  animate={{ scale: [1, 1.2], opacity: [0.6, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
                />
                
                {/* Main play button with glow */}
                <motion.div 
                  className="relative w-16 h-16 rounded-full bg-white/20 backdrop-blur-2xl flex items-center justify-center border border-white/40 shadow-lg"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Play className="w-7 h-7 text-white ml-1" fill="currentColor" />
                </motion.div>
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
            <DropdownMenuContent align="end" className="w-44 rounded-xl bg-zinc-900 border-zinc-700 shadow-2xl backdrop-blur-2xl p-1.5">
              {hasVideo && (
                <>
                  <DropdownMenuItem 
                    onClick={(e) => { e.stopPropagation(); onPlay(); }}
                    className="gap-2.5 text-sm text-zinc-300 focus:text-white focus:bg-zinc-800 rounded-lg py-2.5 px-3"
                  >
                    <Play className="w-4 h-4" />
                    Watch Now
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={(e) => { e.stopPropagation(); onDownload(); }}
                    className="gap-2.5 text-sm text-zinc-300 focus:text-white focus:bg-zinc-800 rounded-lg py-2.5 px-3"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-zinc-700 my-1" />
                </>
              )}
              <DropdownMenuItem 
                onClick={(e) => { e.stopPropagation(); onTogglePin?.(); }}
                className="gap-2.5 text-sm text-zinc-300 focus:text-white focus:bg-zinc-800 rounded-lg py-2.5 px-3"
              >
                {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                {isPinned ? 'Unpin' : 'Pin to Top'}
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={(e) => { e.stopPropagation(); onRename(); }} 
                className="gap-2.5 text-sm text-zinc-300 focus:text-white focus:bg-zinc-800 rounded-lg py-2.5 px-3"
              >
                <Pencil className="w-4 h-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={(e) => { e.stopPropagation(); onEdit(); }} 
                className="gap-2.5 text-sm text-zinc-300 focus:text-white focus:bg-zinc-800 rounded-lg py-2.5 px-3"
              >
                <Edit2 className="w-4 h-4" />
                Edit Project
              </DropdownMenuItem>
              {hasVideo && (
                <>
                  <DropdownMenuSeparator className="bg-zinc-700 my-1" />
                  <DropdownMenuItem 
                    onClick={(e) => { e.stopPropagation(); onTogglePublic?.(); }}
                    className={cn(
                      "gap-2.5 text-sm rounded-lg py-2.5 px-3",
                      project.is_public 
                        ? "text-emerald-400 focus:text-emerald-300 focus:bg-emerald-500/10" 
                        : "text-zinc-300 focus:text-white focus:bg-zinc-800"
                    )}
                  >
                    {project.is_public ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                    {project.is_public ? 'Public on Feed' : 'Share to Feed'}
                  </DropdownMenuItem>
                </>
              )}
              {status === 'stitching_failed' && onRetryStitch && (
                <>
                  <DropdownMenuSeparator className="bg-zinc-700 my-1" />
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
              {onBrowserStitch && (
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); onBrowserStitch(); }}
                  disabled={isBrowserStitching}
                  className="gap-2.5 text-sm text-purple-400 focus:text-purple-300 focus:bg-purple-500/10 rounded-lg py-2.5 px-3"
                >
                  <MonitorPlay className={cn("w-4 h-4", isBrowserStitching && "animate-pulse")} />
                  Browser Stitch
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator className="bg-zinc-700 my-1" />
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
  
  // Thumbnail generation hook
  const { generateMissingThumbnails, isGenerating } = useProjectThumbnails();
  
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
  
  // Auto-generate missing thumbnails when projects load
  useEffect(() => {
    if (hasLoadedOnce && projects.length > 0) {
      const projectsNeedingThumbnails = projects.map(p => ({
        id: p.id,
        video_url: p.video_url,
        thumbnail_url: p.thumbnail_url
      }));
      generateMissingThumbnails(projectsNeedingThumbnails);
    }
  }, [hasLoadedOnce, projects, generateMissingThumbnails]);

  // Scroll animation
  const { scrollY } = useScroll();
  const headerOpacity = useTransform(scrollY, [0, 100], [1, 0.8]);

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
    // Project has video content if it has a final video URL, manifest, or clips array
    if (isStitchedMp4(p.video_url)) return true;
    if (p.video_url && isManifestUrl(p.video_url)) return true;
    if (p.video_clips && p.video_clips.length > 0) return true;
    // Also check if status indicates production happened (clips may be in table, not array)
    if (p.status === 'completed' || p.status === 'stitching' || p.status === 'stitching_failed') return true;
    return false;
  };
  
  const isPlayableProject = (p: Project): boolean => {
    // A project is playable if it has a final video or completed clips
    if (isStitchedMp4(p.video_url)) return true;
    if (p.video_url && isManifestUrl(p.video_url) && status(p) === 'completed') return true;
    // Completed projects should always be playable (SmartStitcherPlayer will fetch clips from DB)
    if (p.status === 'completed') return true;
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

  // Group projects by genre
  const groupedProjects = useMemo(() => {
    const unpinnedProjects = filteredProjects.filter(p => !pinnedProjects.has(p.id));
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
  }, [filteredProjects, pinnedProjects]);

  // Handlers
  const handleCreateProject = () => {
    createProject();
    navigate('/create');
  };

  const handlePlayVideo = async (project: Project) => {
    // Always open SmartStitcherPlayer for any project that might have video content
    // The player will fetch clips from the database if not available in the project object
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

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 pt-20">
        
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
                  <div className="flex items-center gap-3">
                    {/* Status Filter Tabs - Orange themed */}
                    <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      {[
                        { value: 'all', label: 'All', icon: Layers },
                        { value: 'completed', label: 'Ready', icon: Check },
                        { value: 'processing', label: 'Processing', icon: Activity },
                        { value: 'failed', label: 'Failed', icon: AlertCircle },
                      ].map((filter) => (
                        <button
                          key={filter.value}
                          onClick={() => setStatusFilter(filter.value as any)}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                            statusFilter === filter.value 
                              ? "bg-gradient-to-r from-orange-500/20 to-amber-500/20 text-orange-400 border border-orange-500/30" 
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

                    {/* View Mode Toggle - Orange themed */}
                    <div className="flex items-center gap-0.5 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <button
                        onClick={() => setViewMode('grid')}
                        className={cn(
                          "p-2.5 rounded-lg transition-all",
                          viewMode === 'grid' ? "bg-orange-500/20 text-orange-400" : "text-white/40 hover:text-white/70"
                        )}
                        title="Grid view"
                      >
                        <Grid3X3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setViewMode('list')}
                        className={cn(
                          "p-2.5 rounded-lg transition-all",
                          viewMode === 'list' ? "bg-orange-500/20 text-orange-400" : "text-white/40 hover:text-white/70"
                        )}
                        title="List view"
                      >
                        <LayoutList className="w-4 h-4" />
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
              {filteredProjects.length === 0 ? (
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
              ) : (
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

                  {/* Training Videos Section */}
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
                              {/* Video preview */}
                              <video
                                src={video.video_url}
                                className="w-full h-full object-cover"
                                muted
                                playsInline
                                preload="metadata"
                                onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                                onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                              />
                              
                              {/* Overlay */}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                              
                              {/* Play button on hover */}
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center">
                                  <Play className="w-5 h-5 text-black ml-0.5" />
                                </div>
                              </div>
                              
                              {/* Delete button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteTrainingVideo(video.id);
                                }}
                                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-white" />
                              </button>
                              
                              {/* Info */}
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
                </>
              )}
            </motion.div>
          </>
        )}
      </main>

      {/* Video Player Modal - Use SmartStitcherPlayer for seamless transitions */}
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
          
          {/* Smart Stitcher Player - seamless transitions */}
          {isManifestUrl(resolvedClips[0]) ? (
            <ManifestVideoPlayer 
              manifestUrl={resolvedClips[0]} 
              className="w-full h-full" 
            />
          ) : (
            <SmartStitcherPlayer
              projectId={selectedProject.id}
              clipUrls={resolvedClips}
              className="w-full h-full"
              autoPlay={true}
            />
          )}
        </div>
      )}

      {/* Training Video Player Modal */}
      {trainingVideoModalOpen && selectedTrainingVideo && (
        <FullscreenVideoPlayer
          clips={[selectedTrainingVideo.video_url]}
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
          onOpenExternal={() => {
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

      {/* Smart Stitcher Player Modal */}
      <Dialog open={!!showBrowserStitcher} onOpenChange={() => setShowBrowserStitcher(null)}>
        <DialogContent className="bg-zinc-950 border-zinc-800 max-w-5xl p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center gap-2 text-white">
              <MonitorPlay className="w-5 h-5 text-primary" />
              Smart Video Player
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Play all clips seamlessly • Export to single video
            </DialogDescription>
          </DialogHeader>
          {showBrowserStitcher && (
            <div className="p-4 pt-2">
              <SmartStitcherPlayer
                projectId={showBrowserStitcher}
                className="aspect-video rounded-xl"
                autoPlay={true}
                onExportComplete={(url) => {
                  setShowBrowserStitcher(null);
                  refreshProjects();
                  toast.success('Video exported and saved!');
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
