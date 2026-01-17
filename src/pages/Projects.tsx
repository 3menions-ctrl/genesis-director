import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Plus, MoreVertical, Trash2, Copy, Edit2, Film, Play, 
  Download, Loader2, Zap, Clock, Sparkles, ArrowRight,
  Pencil, Star, TrendingUp, Grid3X3, LayoutGrid, ChevronRight,
  Eye, Heart, Share2, RefreshCw, AlertCircle, Layers,
  Search, Filter, SortAsc, SortDesc, Calendar, FolderOpen,
  BarChart3, Activity, Settings2, ChevronDown, X, Check,
  Pin, PinOff, Archive, List, LayoutList, Command, Globe, Lock
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

// ============= CINEMATIC STAT CARD COMPONENT =============

function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  trend,
  color = 'default',
  delay = 0 
}: { 
  icon: React.ElementType;
  label: string;
  value: string | number;
  trend?: { value: number; isPositive: boolean };
  color?: 'default' | 'amber' | 'emerald' | 'blue';
  delay?: number;
}) {
  const colorConfig = {
    default: { 
      bg: 'bg-muted/50', 
      border: 'border-border',
      icon: 'bg-foreground text-background',
      glow: 'from-foreground/5 via-transparent to-transparent'
    },
    amber: { 
      bg: 'bg-amber-500/5', 
      border: 'border-amber-500/20',
      icon: 'bg-amber-500/20 text-amber-500',
      glow: 'from-amber-500/10 via-transparent to-transparent'
    },
    emerald: { 
      bg: 'bg-emerald-500/5', 
      border: 'border-emerald-500/20',
      icon: 'bg-emerald-500/20 text-emerald-500',
      glow: 'from-emerald-500/10 via-transparent to-transparent'
    },
    blue: { 
      bg: 'bg-blue-500/5', 
      border: 'border-blue-500/20',
      icon: 'bg-blue-500/20 text-blue-500',
      glow: 'from-blue-500/10 via-transparent to-transparent'
    },
  };

  const config = colorConfig[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ scale: 1.02, y: -2 }}
      className={cn(
        "group relative p-4 rounded-2xl overflow-hidden cursor-default glass-card",
        config.bg,
        "border",
        config.border,
        "hover:border-foreground/20 transition-all duration-500"
      )}
    >
      {/* Cinematic glow on hover */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-700",
        config.glow
      )} />
      
      {/* Film grain texture */}
      <div className="absolute inset-0 opacity-[0.02] bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 256 256%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noise%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noise)%22/%3E%3C/svg%3E')]" />
      
      <div className="relative flex items-center gap-3">
        <motion.div 
          className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", config.icon)}
          whileHover={{ rotate: [0, -5, 5, 0] }}
          transition={{ duration: 0.5 }}
        >
          <Icon className="w-5 h-5" />
        </motion.div>
        <div className="min-w-0">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest leading-none mb-1">{label}</p>
          <p className="text-xl font-bold hero-text tracking-tight">{value}</p>
        </div>
        {trend && (
          <div className={cn(
            "ml-auto flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold",
            trend.isPositive ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
          )}>
            <TrendingUp className={cn("w-3 h-3", !trend.isPositive && "rotate-180")} />
            {trend.value}%
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ============= HERO HEADER COMPONENT =============

function HeroHeader({ 
  stats, 
  onCreateClick 
}: { 
  stats: { total: number; completed: number; processing: number; totalClips: number };
  onCreateClick: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="relative mb-10"
    >
      {/* Cinematic spotlight effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-primary/[0.03] to-transparent rounded-full blur-3xl"
          animate={{ 
            opacity: [0.3, 0.5, 0.3],
            scale: [1, 1.1, 1]
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="relative py-8 sm:py-12">
        {/* Title Section */}
        <div className="text-center mb-10">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 border border-primary/10 mb-6"
          >
            <Film className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Your Creative Studio</span>
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-4"
          >
            <span className="hero-text">Your </span>
            <span className="bg-gradient-to-r from-primary via-primary/80 to-accent bg-clip-text text-transparent">
              Projects
            </span>
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-muted-foreground max-w-xl mx-auto mb-8"
          >
            Manage, organize, and bring your video creations to life
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.25 }}
          >
            <Button 
              onClick={onCreateClick}
              size="lg"
              className="h-12 px-8 rounded-full shadow-obsidian font-semibold text-base gap-2 group"
            >
              <Plus className="w-5 h-5 transition-transform group-hover:rotate-90 duration-300" />
              Create New Video
              <ArrowRight className="w-4 h-4 opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all duration-300" />
            </Button>
          </motion.div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 max-w-3xl mx-auto">
          <StatCard icon={FolderOpen} label="Total Projects" value={stats.total} color="default" delay={0.3} />
          <StatCard icon={Check} label="Completed" value={stats.completed} color="emerald" delay={0.4} />
          <StatCard icon={Activity} label="In Progress" value={stats.processing} color="amber" delay={0.5} />
          <StatCard icon={Film} label="Total Clips" value={stats.totalClips} color="blue" delay={0.6} />
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
  onTogglePublic,
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
  onTogglePublic?: () => void;
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
          "group flex items-center gap-4 p-3 rounded-xl transition-all duration-300 cursor-pointer glass-card",
          "hover:bg-muted/50 hover:border-border",
          isActive && "ring-1 ring-foreground/20"
        )}
        onClick={onPlay}
      >
        {/* Thumbnail */}
        <div className="relative w-20 h-12 rounded-lg overflow-hidden bg-muted shrink-0">
          {hasVideo && videoSrc ? (
            <img 
              src={project.thumbnail_url || undefined}
              alt={project.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Film className="w-5 h-5 text-muted-foreground" />
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
          <h3 className="text-sm font-medium hero-text truncate">{project.name}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground">{formatTimeAgo(project.updated_at)}</span>
            {(project.video_clips?.length ?? 0) > 0 && (
              <>
                <span className="text-muted-foreground/50">•</span>
                <span className="text-xs text-muted-foreground">{project.video_clips?.length} clips</span>
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
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 bg-card border-border backdrop-blur-xl">
              {hasVideo && (
                <>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onPlay(); }}>
                    <Play className="w-4 h-4 mr-2" />
                    Watch
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDownload(); }}>
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onTogglePin?.(); }}>
                {isPinned ? <PinOff className="w-4 h-4 mr-2" /> : <Pin className="w-4 h-4 mr-2" />}
                {isPinned ? 'Unpin' : 'Pin'}
              </DropdownMenuItem>
              {hasVideo && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onTogglePublic?.(); }} className={cn(
                  project.is_public && "text-emerald-500"
                )}>
                  {project.is_public ? <Globe className="w-4 h-4 mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
                  {project.is_public ? 'Public' : 'Share to Feed'}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRename(); }}>
                <Pencil className="w-4 h-4 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-destructive">
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
        "relative overflow-hidden rounded-2xl transition-all duration-700 glass-card",
        hasVideo ? "aspect-video" : index % 3 === 0 ? "aspect-[4/5]" : index % 3 === 1 ? "aspect-square" : "aspect-video",
        "border border-border",
        isHovered && "border-foreground/25 shadow-2xl",
        isActive && "ring-2 ring-foreground/40"
      )}>
        
        {/* Video/Thumbnail - always visible, no loading state */}
        {hasVideo && videoSrc ? (
          <>
            <video
              ref={videoRef}
              src={videoSrc}
              poster={project.thumbnail_url || undefined}
              className={cn(
                "absolute inset-0 w-full h-full object-cover transition-transform duration-700",
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
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            {status === 'generating' || status === 'rendering' || status === 'stitching' ? (
              <div className="relative">
                <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-2xl animate-pulse scale-150" />
                <Loader2 className="relative w-10 h-10 text-amber-500/70 animate-spin" strokeWidth={1} />
              </div>
            ) : (
              <Film className="w-12 h-12 text-muted-foreground/30" strokeWidth={1} />
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
                  className="absolute inset-[-8px] rounded-full border border-foreground/10"
                  animate={{ scale: [1, 1.3], opacity: [0.5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <motion.div 
                  className="absolute inset-[-4px] rounded-full border border-foreground/20"
                  animate={{ scale: [1, 1.2], opacity: [0.6, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
                />
                
                {/* Main play button with glow */}
                <motion.div 
                  className="relative w-16 h-16 rounded-full bg-foreground/20 backdrop-blur-2xl flex items-center justify-center border border-foreground/40 shadow-lg"
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
            <DropdownMenuContent align="end" className="w-44 rounded-xl bg-card border-border shadow-2xl backdrop-blur-2xl p-1.5">
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
              {hasVideo && (
                <>
                  <DropdownMenuSeparator className="bg-white/10 my-1" />
                  <DropdownMenuItem 
                    onClick={(e) => { e.stopPropagation(); onTogglePublic?.(); }}
                    className={cn(
                      "gap-2.5 text-sm rounded-lg py-2.5 px-3",
                      project.is_public 
                        ? "text-emerald-400 focus:text-emerald-300 focus:bg-emerald-500/10" 
                        : "text-white/80 focus:text-white focus:bg-white/10"
                    )}
                  >
                    {project.is_public ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                    {project.is_public ? 'Public on Feed' : 'Share to Feed'}
                  </DropdownMenuItem>
                </>
              )}
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
    <div className="min-h-screen bg-background relative overflow-x-hidden">
      {/* Premium ambient background with multiple layers */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Primary gradient orb */}
        <motion.div 
          className="absolute top-[-20%] left-[10%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-br from-primary/[0.03] via-primary/[0.015] to-transparent blur-[120px]"
          animate={{ 
            x: [0, 50, 0],
            y: [0, 30, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Secondary gradient orb */}
        <motion.div 
          className="absolute bottom-[-30%] right-[-10%] w-[70vw] h-[70vw] rounded-full bg-gradient-to-tl from-accent/[0.02] via-accent/[0.01] to-transparent blur-[150px]"
          animate={{ 
            x: [0, -30, 0],
            y: [0, -40, 0],
            scale: [1, 1.05, 1],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Subtle grid pattern overlay */}
        <div 
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: 'linear-gradient(to right, hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--foreground)) 1px, transparent 1px)',
            backgroundSize: '60px 60px'
          }}
        />
        {/* Top vignette */}
        <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-background to-transparent" />
      </div>

      {/* Navigation */}
      <AppHeader onCreateClick={handleCreateProject} />

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pt-24">
        
        {/* Loading state */}
        {(isLoadingProjects && !hasLoadedOnce) ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-32"
          >
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-foreground/5 rounded-full blur-2xl scale-150 animate-pulse" />
              <Loader2 className="relative w-10 h-10 text-muted-foreground animate-spin" />
            </div>
            <p className="text-muted-foreground">Loading your projects...</p>
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
                  background: 'radial-gradient(ellipse at center, hsl(var(--foreground) / 0.03) 0%, transparent 70%)',
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
                className="absolute inset-[-20px] rounded-full border border-foreground/10"
                animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
                transition={{ duration: 3, repeat: Infinity }}
              />
              <motion.div
                className="absolute inset-[-40px] rounded-full border border-foreground/5"
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
                className="relative w-32 h-32 rounded-full glass-card border border-border flex items-center justify-center shadow-2xl"
              >
                {/* Inner details to look like film reel */}
                <div className="absolute inset-4 rounded-full border border-border/50" />
                <div className="absolute inset-8 rounded-full border border-border/30" />
                {[...Array(8)].map((_, i) => (
                  <div 
                    key={i}
                    className="absolute w-2 h-2 rounded-full bg-foreground/20"
                    style={{
                      transform: `rotate(${i * 45}deg) translateY(-40px)`
                    }}
                  />
                ))}
                <Film className="w-10 h-10 text-muted-foreground" strokeWidth={1} />
              </motion.div>
            </motion.div>
            
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold hero-text mb-4 text-center tracking-tight"
            >
              The Stage is Set
            </motion.h2>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="hero-text-secondary text-lg sm:text-xl mb-4 text-center max-w-lg"
            >
              Your creative journey begins here. Every great director started with their first scene.
            </motion.p>
            
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.6 }}
              className="text-muted-foreground/50 text-sm mb-10 text-center italic"
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
                className="group relative h-14 px-10 rounded-full shadow-obsidian font-bold text-lg overflow-hidden"
              >
                {/* Shimmer effect */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-background/10 to-transparent"
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
                  className="w-16 h-12 rounded glass-card border border-border/30"
                  style={{ transform: `rotate(${(i - 3) * 3}deg)` }}
                />
              ))}
            </motion.div>
          </motion.div>
        ) : (
          <>
            {/* Cinematic Hero Header with Stats */}
            <HeroHeader stats={stats} onCreateClick={handleCreateProject} />

            {/* Search, Filter & View Controls */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-8"
            >
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="project-search"
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10 pl-10 pr-10 glass-card border-border text-foreground placeholder:text-muted-foreground rounded-xl focus:border-foreground/20 focus:ring-0"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">/</kbd>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2">
                {/* Status Filter */}
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                  <SelectTrigger className="w-[130px] h-10 glass-card border-border text-foreground rounded-xl">
                    <Filter className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>

                {/* Sort */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-10 px-3 glass-card border-border text-foreground hover:bg-muted rounded-xl">
                      {sortOrder === 'desc' ? <SortDesc className="w-4 h-4" /> : <SortAsc className="w-4 h-4" />}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-card border-border">
                    <DropdownMenuLabel className="text-muted-foreground text-xs">Sort by</DropdownMenuLabel>
                    <DropdownMenuCheckboxItem 
                      checked={sortBy === 'updated'} 
                      onCheckedChange={() => setSortBy('updated')}
                    >
                      Last Updated
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem 
                      checked={sortBy === 'created'} 
                      onCheckedChange={() => setSortBy('created')}
                    >
                      Date Created
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem 
                      checked={sortBy === 'name'} 
                      onCheckedChange={() => setSortBy('name')}
                    >
                      Name
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuSeparator className="bg-border" />
                    <DropdownMenuItem 
                      onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    >
                      {sortOrder === 'desc' ? 'Ascending' : 'Descending'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* View Mode Toggle */}
                <div className="flex items-center gap-0.5 p-1 rounded-xl glass-card border border-border">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={cn(
                      "p-2 rounded-lg transition-all",
                      viewMode === 'grid' ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Grid3X3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={cn(
                      "p-2 rounded-lg transition-all",
                      viewMode === 'list' ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
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
                        onTogglePublic={() => handleTogglePublic(project)}
                        isActive={activeProjectId === project.id}
                        isRetrying={retryingProjectId === project.id}
                        isPinned={pinnedProjects.has(project.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 [column-gap:1.25rem]">
                    {filteredProjects.map((project, index) => (
                      <div key={project.id} className="break-inside-avoid mb-5 inline-block w-full">
                        <ProjectCard
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
                      </div>
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
