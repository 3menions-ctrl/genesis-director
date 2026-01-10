import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { 
  Plus, MoreVertical, Trash2, Copy, Edit2, Film, Play, 
  Download, Loader2, Zap, Clock, Sparkles,
  User, Coins, ChevronDown, LogOut, Settings, HelpCircle,
  Pencil, Star, TrendingUp, Grid3X3, LayoutGrid, ChevronRight,
  Eye, Heart, Share2, RefreshCw, AlertCircle, Layers
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useStudio } from '@/contexts/StudioContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Project } from '@/types/studio';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { FullscreenVideoPlayer } from '@/components/studio/FullscreenVideoPlayer';
import { motion, AnimatePresence } from 'framer-motion';

// Helper to check if URL is a manifest (not a real stitched video)
const isManifestUrl = (url: string): boolean => url?.endsWith('.json');

// Helper to check if URL is a real stitched MP4 from Google Cloud Run
const isStitchedMp4 = (url: string | undefined): boolean => {
  if (!url) return false;
  return url.includes('/final-videos/') && url.endsWith('.mp4');
};

// Helper to fetch clip URLs from manifest
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

// Cinematic Video Card Component
function CinematicVideoCard({ 
  project,
  index,
  onPlay,
  onEdit,
  onRename,
  onDelete,
  onDownload,
  onRetryStitch,
  isActive,
  isRetrying = false,
  size = 'normal'
}: {
  project: Project;
  index: number;
  onPlay: () => void;
  onEdit: () => void;
  onRename: () => void;
  onDelete: () => void;
  onDownload: () => void;
  onRetryStitch?: () => void;
  isActive: boolean;
  isRetrying?: boolean;
  size?: 'featured' | 'normal' | 'compact';
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  
  // Cast status to string to handle all possible database statuses
  const status = project.status as string;
  
  // Check if project has video - include both video_clips array and direct video_url
  // For manifest URLs, we still consider it as having video (playback will resolve clips)
  const hasVideo = Boolean(project.video_clips?.length || project.video_url);
  
  // For preview/thumbnail purposes, prefer video_clips array, but also use video_url if it's a direct MP4
  const isDirectVideo = project.video_url && !isManifestUrl(project.video_url);
  const videoClips = project.video_clips?.length ? project.video_clips : 
    (isDirectVideo ? [project.video_url] : []);
  
  // Use second clip for preview if available (often more interesting than the first)
  const videoSrc = videoClips.length > 1 ? videoClips[1] : videoClips[0];

  useEffect(() => {
    if (!videoRef.current) return;
    
    if (isHovered && hasVideo) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
      videoRef.current.currentTime = 1;
    }
  }, [isHovered, hasVideo]);

  const handleLoadedData = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 1;
      setIsVideoLoaded(true);
    }
  };

  const sizeClasses = {
    featured: 'col-span-2 row-span-2',
    normal: 'col-span-1 row-span-1',
    compact: 'col-span-1 row-span-1'
  };

  const aspectClasses = {
    featured: 'aspect-[16/10]',
    normal: 'aspect-video',
    compact: 'aspect-[4/3]'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        duration: 0.5, 
        delay: index * 0.08,
        ease: [0.16, 1, 0.3, 1]
      }}
      className={cn(
        "group relative cursor-pointer",
        sizeClasses[size]
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onPlay}
    >
      {/* Card Container with dramatic shadow on hover */}
      <div className={cn(
        "relative overflow-hidden rounded-2xl transition-all duration-700",
        aspectClasses[size],
        "bg-gradient-to-br from-white/[0.03] to-white/[0.01]",
        "border border-white/[0.06]",
        isHovered && "border-white/20 shadow-2xl shadow-white/5",
        isActive && "ring-2 ring-white/30"
      )}>
        
        {/* Video/Thumbnail */}
        {hasVideo && videoSrc ? (
          <>
            <video
              ref={videoRef}
              src={videoSrc}
              className={cn(
                "absolute inset-0 w-full h-full object-cover transition-transform duration-1000",
                isHovered && "scale-110"
              )}
              loop
              muted
              playsInline
              preload="auto"
              onLoadedData={handleLoadedData}
            />
            
            {/* Cinematic letterbox bars on hover */}
            <motion.div 
              className="absolute inset-x-0 top-0 bg-black pointer-events-none"
              initial={{ height: 0 }}
              animate={{ height: isHovered ? '8%' : 0 }}
              transition={{ duration: 0.5 }}
            />
            <motion.div 
              className="absolute inset-x-0 bottom-0 bg-black pointer-events-none"
              initial={{ height: 0 }}
              animate={{ height: isHovered ? '8%' : 0 }}
              transition={{ duration: 0.5 }}
            />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-white/[0.04] to-transparent">
            {status === 'generating' || status === 'rendering' || status === 'stitching' ? (
              <div className="relative">
                <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-2xl animate-pulse scale-150" />
                <Loader2 className="relative w-10 h-10 text-amber-400/70 animate-spin" strokeWidth={1} />
              </div>
            ) : status === 'stitching_failed' ? (
              <div className="relative flex flex-col items-center gap-2">
                <div className="absolute inset-0 bg-amber-500/10 rounded-full blur-2xl scale-150" />
                <Layers className="relative w-10 h-10 text-amber-400/70" strokeWidth={1} />
                <span className="text-[10px] text-amber-400/70 font-medium">Clips Ready</span>
              </div>
            ) : (
              <Film className="w-12 h-12 text-white/10" strokeWidth={1} />
            )}
          </div>
        )}

        {/* Gradient overlays */}
        <div className={cn(
          "absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent transition-opacity duration-500",
          isHovered ? "opacity-90" : "opacity-60"
        )} />
        
        {/* Spotlight effect on hover */}
        <motion.div 
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.5 }}
          style={{
            background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.08) 0%, transparent 60%)'
          }}
        />

        {/* Play button - cinematic style */}
        <AnimatePresence>
          {hasVideo && isHovered && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 flex items-center justify-center z-10"
            >
              <div className="relative">
                {/* Pulse rings */}
                <div className="absolute inset-0 rounded-full bg-white/10 animate-ping" style={{ animationDuration: '2s' }} />
                <div className="absolute inset-[-8px] rounded-full border border-white/20" />
                <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center border border-white/30 hover:bg-white/20 transition-colors">
                  <Play className="w-7 h-7 text-white ml-1" fill="currentColor" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 z-20">
          {/* Status badge */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: isHovered ? 1 : 0.8, y: 0 }}
            className="flex items-center gap-2 mb-2"
          >
            {hasVideo ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Ready</span>
              </span>
            ) : status === 'stitching_failed' ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30">
                <AlertCircle className="w-2.5 h-2.5 text-amber-400" />
                <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Stitch Failed</span>
              </span>
            ) : status === 'stitching' ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30">
                <Loader2 className="w-2.5 h-2.5 text-amber-400 animate-spin" />
                <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Stitching</span>
              </span>
            ) : status === 'generating' || status === 'rendering' ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30">
                <Loader2 className="w-2.5 h-2.5 text-amber-400 animate-spin" />
                <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Processing</span>
              </span>
            ) : null}
          </motion.div>

          {/* Retry Stitch button for failed stitches */}
          {status === 'stitching_failed' && onRetryStitch && (
            <motion.button
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: isHovered ? 1 : 0.8, y: 0 }}
              onClick={(e) => { e.stopPropagation(); onRetryStitch(); }}
              disabled={isRetrying}
              className={cn(
                "mb-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all",
                isRetrying 
                  ? "bg-white/10 text-white/50 cursor-not-allowed"
                  : "bg-amber-500 text-black hover:bg-amber-400"
              )}
            >
              {isRetrying ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              {isRetrying ? 'Stitching...' : 'Retry Stitch'}
            </motion.button>
          )}

          {/* Title with reveal animation */}
          <motion.h3
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={cn(
              "font-bold text-white tracking-tight line-clamp-2 transition-all duration-300",
              size === 'featured' ? 'text-2xl' : 'text-base',
              isHovered && "text-shadow-lg"
            )}
          >
            {project.name}
          </motion.h3>

          {/* Meta row - appears on hover */}
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ 
              opacity: isHovered ? 1 : 0.5, 
              height: 'auto' 
            }}
            className="flex items-center gap-3 mt-2 text-white/50 text-xs"
          >
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(project.updated_at).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
              })}
            </span>
            {videoClips.length > 0 && (
              <span className="flex items-center gap-1">
                <Film className="w-3 h-3" />
                {videoClips.length} clip{videoClips.length > 1 ? 's' : ''}
              </span>
            )}
          </motion.div>
        </div>

        {/* Quick actions - top right */}
        <div className={cn(
          "absolute top-3 right-3 z-30 flex items-center gap-1 transition-all duration-300",
          isHovered ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
        )}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="h-8 w-8 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-xl text-white/70 hover:text-white hover:bg-black/70 transition-all border border-white/10"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 rounded-xl bg-black/95 border-white/10 shadow-2xl backdrop-blur-2xl p-1.5">
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
              <DropdownMenuItem 
                className="gap-2.5 text-sm text-white/80 focus:text-white focus:bg-white/10 rounded-lg py-2.5 px-3"
                onClick={(e) => e.stopPropagation()}
              >
                <Copy className="w-4 h-4" />
                Duplicate
              </DropdownMenuItem>
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

        {/* Favorite indicator */}
        <div className={cn(
          "absolute top-3 left-3 z-30 transition-all duration-300",
          isHovered ? "opacity-100" : "opacity-0"
        )}>
          <button
            onClick={(e) => e.stopPropagation()}
            className="h-8 w-8 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-xl text-white/50 hover:text-rose-400 hover:bg-black/70 transition-all border border-white/10"
          >
            <Heart className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// Create Button with dramatic styling
function CreateProjectCard({ onClick, delay }: { onClick: () => void; delay: number }) {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      className="group relative cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      <div className={cn(
        "relative overflow-hidden rounded-2xl aspect-video transition-all duration-500",
        "border-2 border-dashed",
        isHovered 
          ? "border-white/30 bg-white/[0.04]" 
          : "border-white/[0.08] bg-white/[0.02]"
      )}>
        {/* Animated gradient background */}
        <motion.div
          className="absolute inset-0"
          animate={{
            background: isHovered 
              ? 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.06) 0%, transparent 70%)'
              : 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.02) 0%, transparent 70%)'
          }}
        />

        {/* Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.div
            animate={{ 
              scale: isHovered ? 1.1 : 1,
              rotate: isHovered ? 90 : 0
            }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-colors duration-300",
              isHovered 
                ? "bg-white text-black" 
                : "bg-white/10 text-white/40 border border-white/10"
            )}
          >
            <Plus className="w-7 h-7" strokeWidth={1.5} />
          </motion.div>
          
          <motion.span
            animate={{ opacity: isHovered ? 1 : 0.5 }}
            className="text-sm font-semibold text-white/70"
          >
            Create New Project
          </motion.span>
          
          <motion.span
            initial={{ opacity: 0, y: 5 }}
            animate={{ 
              opacity: isHovered ? 0.5 : 0,
              y: isHovered ? 0 : 5
            }}
            className="text-xs text-white/40 mt-1"
          >
            Start from scratch or use a template
          </motion.span>
        </div>

        {/* Corner accents on hover */}
        <motion.div
          className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white/30 rounded-tl-2xl"
          animate={{ opacity: isHovered ? 1 : 0, scale: isHovered ? 1 : 0.8 }}
        />
        <motion.div
          className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white/30 rounded-br-2xl"
          animate={{ opacity: isHovered ? 1 : 0, scale: isHovered ? 1 : 0.8 }}
        />
      </div>
    </motion.div>
  );
}

export default function Projects() {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { projects, activeProjectId, setActiveProjectId, createProject, deleteProject, updateProject, refreshProjects } = useStudio();
  const [isGeneratingThumbnails, setIsGeneratingThumbnails] = useState(false);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [hasTriedAutoThumbnails, setHasTriedAutoThumbnails] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [projectToRename, setProjectToRename] = useState<Project | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [resolvedClips, setResolvedClips] = useState<string[]>([]);
  const [isLoadingClips, setIsLoadingClips] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'gallery'>('grid');
  const [retryingProjectId, setRetryingProjectId] = useState<string | null>(null);

  // Handle Google Cloud Run stitch (real video stitching, not manifest)
  const handleGoogleStitch = async (projectId: string) => {
    if (retryingProjectId) return;
    
    setRetryingProjectId(projectId);
    toast.info('Starting Google Cloud stitch...', { description: 'Processing with FFmpeg - this may take 2-3 minutes' });
    
    try {
      // Get all completed clips from database
      const { data: clips, error: clipsError } = await supabase
        .from('video_clips')
        .select('id, shot_index, video_url, duration_seconds')
        .eq('project_id', projectId)
        .eq('status', 'completed')
        .order('shot_index');
      
      if (clipsError) throw clipsError;
      if (!clips || clips.length === 0) throw new Error('No completed clips found');
      
      // Get project title
      const { data: project } = await supabase
        .from('movie_projects')
        .select('title')
        .eq('id', projectId)
        .single();
      
      // Call stitch-video WITHOUT forceMvpMode to use Cloud Run
      const { data, error: stitchError } = await supabase.functions.invoke('stitch-video', {
        body: {
          projectId,
          projectTitle: project?.title || 'Video',
          clips: clips.map(clip => ({
            shotId: clip.id,
            videoUrl: clip.video_url,
            durationSeconds: clip.duration_seconds || 4,
            transitionOut: 'cut',
          })),
          audioMixMode: 'mute',
          // NO forceMvpMode - use Google Cloud Run stitcher
        },
      });
      
      if (stitchError) throw stitchError;
      
      if (data?.success && data?.mode === 'cloud-run') {
        toast.success('Stitching started!', { description: 'Video will appear when ready (2-3 min)' });
        // Poll for completion
        const pollInterval = setInterval(async () => {
          await refreshProjects();
        }, 10000);
        // Stop polling after 5 minutes
        setTimeout(() => clearInterval(pollInterval), 300000);
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

  // Auto-generate thumbnails
  useEffect(() => {
    const autoGenerateThumbnails = async () => {
      const projectsNeedingThumbnails = projects.filter(p => !p.thumbnail_url && (p.video_clips?.length || p.video_url));
      
      if (projectsNeedingThumbnails.length > 0 && !hasTriedAutoThumbnails && !isGeneratingThumbnails) {
        setHasTriedAutoThumbnails(true);
        setIsGeneratingThumbnails(true);
        
        try {
          const { data, error } = await supabase.functions.invoke('generate-missing-thumbnails');
          if (data?.success) {
            await refreshProjects();
          }
        } catch (err) {
          console.error('Auto-thumbnail generation failed:', err);
        } finally {
          setIsGeneratingThumbnails(false);
        }
      }
    };

    if (projects.length > 0) {
      autoGenerateThumbnails();
    }
  }, [projects.length, hasTriedAutoThumbnails, isGeneratingThumbnails, refreshProjects]);

  const handleSelectProject = (id: string) => {
    setActiveProjectId(id);
  };

  const handleOpenProject = (id: string) => {
    setActiveProjectId(id);
    navigate('/pipeline/scripting');
  };

  const handleCreateProject = () => {
    createProject();
    navigate('/pipeline/scripting');
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

  const handleDownloadAll = async (project: Project) => {
    // If video_url is a direct MP4, download that
    if (project.video_url && !isManifestUrl(project.video_url)) {
      toast.info('Downloading final video...');
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
    
    // Otherwise download individual clips
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

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
    toast.success('Signed out successfully');
  };

  // Only show projects with real Google-stitched MP4s (not manifests)
  const status = (p: Project) => p.status as string;
  
  // Projects with real stitched videos (from Google Cloud Run)
  const stitchedProjects = projects.filter(p => 
    isStitchedMp4(p.video_url)
  );
  
  // Projects that need stitching (have clips but no stitched video or manifest-only)
  const needsStitching = projects.filter(p => {
    const hasClips = (p.video_clips?.length ?? 0) > 0 || 
      (p.video_url && isManifestUrl(p.video_url));
    const hasStitchedVideo = isStitchedMp4(p.video_url);
    const isProcessing = status(p) === 'stitching';
    return hasClips && !hasStitchedVideo && !isProcessing;
  });
  
  // Projects currently being stitched
  const stitchingProjects = projects.filter(p => status(p) === 'stitching');
  
  const recentStitchedProjects = [...stitchedProjects].sort((a, b) => 
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
  const featuredProject = recentStitchedProjects[0];
  const otherProjects = recentStitchedProjects.slice(1);

  return (
    <div className="min-h-screen bg-[#050505] relative overflow-x-hidden">
      {/* Dramatic ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Large gradient orbs */}
        <div className="absolute top-[-30%] left-[-20%] w-[80vw] h-[80vw] rounded-full bg-gradient-to-br from-white/[0.02] to-transparent blur-[150px] animate-pulse" style={{ animationDuration: '10s' }} />
        <div className="absolute bottom-[-40%] right-[-20%] w-[90vw] h-[90vw] rounded-full bg-gradient-to-tl from-white/[0.015] to-transparent blur-[180px] animate-pulse" style={{ animationDuration: '14s', animationDelay: '3s' }} />
        
        {/* Film grain overlay */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Subtle vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
      </div>

      {/* Premium Navigation */}
      <nav className="sticky top-0 z-50">
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="bg-black/60 backdrop-blur-2xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="h-16 flex items-center justify-between">
              {/* Logo */}
              <button 
                onClick={() => navigate('/projects')}
                className="flex items-center gap-3 group"
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-white/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative w-10 h-10 rounded-xl bg-white/[0.08] border border-white/[0.1] flex items-center justify-center group-hover:border-white/20 transition-all">
                    <Film className="w-5 h-5 text-white/80" />
                  </div>
                </div>
                <span className="text-lg font-bold text-white tracking-tight hidden sm:block">Apex Studio</span>
              </button>

              {/* Center Navigation */}
              <div className="hidden md:flex items-center gap-1 bg-white/[0.03] rounded-full p-1 border border-white/[0.05]">
                {[
                  { label: 'Library', path: '/projects', active: true },
                  { label: 'Studio', path: '/studio' },
                  { label: 'Clips', path: '/clips' },
                ].map((item) => (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={cn(
                      "px-5 py-2 text-sm font-medium rounded-full transition-all duration-300",
                      item.active 
                        ? "text-white bg-white/[0.1]" 
                        : "text-white/50 hover:text-white hover:bg-white/[0.05]"
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Right Actions */}
              <div className="flex items-center gap-3">
                <Button 
                  onClick={handleCreateProject}
                  size="sm"
                  className="h-10 px-5 text-sm bg-white text-black hover:bg-white/90 font-semibold rounded-full shadow-lg shadow-white/10"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Create</span>
                </Button>

                {/* Credits pill */}
                <button
                  onClick={() => navigate('/profile')}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/15 transition-all"
                >
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                    <Coins className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-sm font-bold text-white">{profile?.credits_balance?.toLocaleString() || 0}</span>
                </button>

                {/* User Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 p-1.5 rounded-full hover:bg-white/[0.05] transition-colors">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-white/20 to-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                        {profile?.avatar_url ? (
                          <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-4 h-4 text-white/60" />
                        )}
                      </div>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52 bg-black/95 backdrop-blur-2xl border-white/10 rounded-xl p-1.5">
                    <div className="px-3 py-3 border-b border-white/[0.06]">
                      <p className="text-sm font-semibold text-white truncate">{profile?.display_name || profile?.full_name || 'Creator'}</p>
                      <p className="text-xs text-white/40 truncate">{profile?.email}</p>
                    </div>
                    <div className="py-1.5">
                      <DropdownMenuItem onClick={() => navigate('/profile')} className="text-sm text-white/70 hover:text-white focus:text-white focus:bg-white/[0.08] rounded-lg py-2.5 px-3 gap-2.5">
                        <User className="w-4 h-4" />
                        Profile
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-sm text-white/70 hover:text-white focus:text-white focus:bg-white/[0.08] rounded-lg py-2.5 px-3 gap-2.5">
                        <Settings className="w-4 h-4" />
                        Settings
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-sm text-white/70 hover:text-white focus:text-white focus:bg-white/[0.08] rounded-lg py-2.5 px-3 gap-2.5">
                        <HelpCircle className="w-4 h-4" />
                        Help Center
                      </DropdownMenuItem>
                    </div>
                    <DropdownMenuSeparator className="bg-white/[0.06]" />
                    <DropdownMenuItem onClick={handleSignOut} className="text-sm text-rose-400 hover:text-rose-300 focus:text-rose-300 focus:bg-rose-500/10 rounded-lg py-2.5 px-3 gap-2.5">
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {stitchedProjects.length === 0 && needsStitching.length === 0 ? (
          /* ========== EMPTY STATE ========== */
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center justify-center py-32 sm:py-48 px-4"
          >
            {/* Animated icon */}
            <div className="relative mb-10">
              <div className="absolute inset-0 bg-white/5 rounded-full blur-3xl scale-150 animate-pulse" />
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="relative w-28 h-28 rounded-3xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/[0.1] flex items-center justify-center"
              >
                <Sparkles className="w-12 h-12 text-white/30" strokeWidth={1} />
              </motion.div>
              
              {/* Orbiting elements */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0"
              >
                <div className="absolute -top-2 left-1/2 w-3 h-3 rounded-full bg-white/20" />
              </motion.div>
            </div>
            
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 text-center tracking-tight">
              Your Creative Space
            </h2>
            <p className="text-white/40 text-lg sm:text-xl mb-12 text-center max-w-lg leading-relaxed">
              Your completed masterpieces will appear here. Ready to create something extraordinary?
            </p>
            
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Button 
                onClick={() => navigate('/studio')}
                variant="outline"
                className="h-14 px-8 rounded-full bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20 font-medium text-base"
              >
                <Zap className="w-5 h-5 mr-2 text-amber-400" />
                Open Studio
              </Button>
              <Button 
                onClick={handleCreateProject}
                className="h-14 px-10 rounded-full bg-white text-black hover:bg-white/90 font-bold text-base shadow-2xl shadow-white/20"
              >
                <Plus className="w-5 h-5 mr-2" />
                Start Creating
              </Button>
            </div>
          </motion.div>
        ) : (
          <>
            {/* ========== HEADER SECTION ========== */}
            <div className="flex items-end justify-between mb-10">
              <div>
                <motion.h1 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight mb-2"
                >
                  Library
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-white/40 text-lg"
                >
                  {stitchedProjects.length} {stitchedProjects.length === 1 ? 'video' : 'videos'}
                </motion.p>
              </div>
              
              {/* View toggle */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-1 border border-white/[0.05]"
              >
                <button
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    "p-2 rounded-md transition-all",
                    viewMode === 'grid' ? "bg-white/10 text-white" : "text-white/40 hover:text-white"
                  )}
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('gallery')}
                  className={cn(
                    "p-2 rounded-md transition-all",
                    viewMode === 'gallery' ? "bg-white/10 text-white" : "text-white/40 hover:text-white"
                  )}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </motion.div>
            </div>

            {/* ========== NEEDS STITCHING SECTION ========== */}
            {(needsStitching.length > 0 || stitchingProjects.length > 0) && (
              <motion.section 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mb-12"
              >
                <div className="flex items-center gap-3 mb-5">
                  <Layers className="w-5 h-5 text-amber-400" />
                  <h2 className="text-xl font-bold text-white">Ready to Stitch</h2>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-semibold">
                    {needsStitching.length + stitchingProjects.length}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {/* Processing projects */}
                  {stitchingProjects.map((project, index) => (
                    <div 
                      key={project.id}
                      className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/20"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                        <span className="text-sm font-medium text-white truncate">{project.name}</span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-amber-500"
                          initial={{ width: '10%' }}
                          animate={{ width: '60%' }}
                          transition={{ duration: 60, ease: 'linear' }}
                        />
                      </div>
                      <p className="text-xs text-white/40 mt-2">Processing with Google FFmpeg...</p>
                    </div>
                  ))}
                  
                  {/* Projects needing stitching */}
                  {needsStitching.map((project, index) => (
                    <div 
                      key={project.id}
                      className="p-4 rounded-xl bg-gradient-to-br from-white/[0.04] to-transparent border border-white/[0.08] hover:border-white/15 transition-all"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-white truncate flex-1 mr-2">{project.name}</span>
                        <span className="text-xs text-white/40 shrink-0">
                          {project.video_clips?.length || '?'} clips
                        </span>
                      </div>
                      <Button
                        onClick={() => handleGoogleStitch(project.id)}
                        disabled={retryingProjectId === project.id}
                        size="sm"
                        className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold"
                      >
                        {retryingProjectId === project.id ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                            Stitching...
                          </>
                        ) : (
                          <>
                            <Zap className="w-3 h-3 mr-2" />
                            Stitch with Google
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </motion.section>
            )}

            {/* ========== FEATURED PROJECT ========== */}
            {featuredProject && viewMode === 'gallery' && (
              <motion.section 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="mb-12"
              >
                <div className="flex items-center gap-3 mb-5">
                  <Star className="w-5 h-5 text-amber-400" />
                  <h2 className="text-xl font-bold text-white">Latest Creation</h2>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <CinematicVideoCard
                      project={featuredProject}
                      index={0}
                      size="featured"
                      onPlay={() => handlePlayVideo(featuredProject)}
                      onEdit={() => handleOpenProject(featuredProject.id)}
                      onRename={() => handleRenameProject(featuredProject)}
                      onDelete={() => deleteProject(featuredProject.id)}
                      onDownload={() => handleDownloadAll(featuredProject)}
                      onRetryStitch={() => handleGoogleStitch(featuredProject.id)}
                      isActive={activeProjectId === featuredProject.id}
                      isRetrying={retryingProjectId === featuredProject.id}
                    />
                  </div>
                  
                  {/* Quick stats */}
                  <div className="flex flex-col gap-4">
                    <div className="flex-1 p-6 rounded-2xl bg-gradient-to-br from-white/[0.04] to-transparent border border-white/[0.06]">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                          <TrendingUp className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-white">{stitchedProjects.length}</p>
                          <p className="text-xs text-white/40">Completed</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex-1 p-6 rounded-2xl bg-gradient-to-br from-white/[0.04] to-transparent border border-white/[0.06]">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                          <Film className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-white">
                            {stitchedProjects.reduce((acc, p) => acc + (p.video_clips?.length || (p.video_url ? 1 : 0)), 0)}
                          </p>
                          <p className="text-xs text-white/40">Total Clips</p>
                        </div>
                      </div>
                    </div>

                    <Button 
                      onClick={handleCreateProject}
                      className="h-14 rounded-xl bg-white text-black hover:bg-white/90 font-bold text-base shadow-xl"
                    >
                      <Plus className="w-5 h-5 mr-2" />
                      New Project
                    </Button>
                  </div>
                </div>
              </motion.section>
            )}

            {/* ========== PROJECTS GRID ========== */}
            <motion.section
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
            >
              {viewMode === 'gallery' && otherProjects.length > 0 && (
                <div className="flex items-center gap-3 mb-5">
                  <Clock className="w-5 h-5 text-white/40" />
                  <h2 className="text-xl font-bold text-white">All Projects</h2>
                </div>
              )}
              
              <div className={cn(
                "grid gap-5",
                viewMode === 'grid' 
                  ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                  : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
              )}>
                {(viewMode === 'gallery' ? otherProjects : recentStitchedProjects).map((project, index) => (
                  <CinematicVideoCard
                    key={project.id}
                    project={project}
                    index={index}
                    size={viewMode === 'gallery' ? 'normal' : 'normal'}
                    onPlay={() => handlePlayVideo(project)}
                    onEdit={() => handleOpenProject(project.id)}
                    onRename={() => handleRenameProject(project)}
                    onDelete={() => deleteProject(project.id)}
                    onDownload={() => handleDownloadAll(project)}
                    onRetryStitch={() => handleGoogleStitch(project.id)}
                    isActive={activeProjectId === project.id}
                    isRetrying={retryingProjectId === project.id}
                  />
                ))}
                
                {/* Create new project card */}
                <CreateProjectCard 
                  onClick={handleCreateProject} 
                  delay={Math.min((viewMode === 'gallery' ? otherProjects : recentStitchedProjects).length * 0.08, 0.5)} 
                />
              </div>
            </motion.section>
          </>
        )}
      </main>

      {/* ========== VIDEO PLAYER MODAL ========== */}
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
            navigate('/pipeline/production');
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
              <div className="relative">
                <div className="absolute inset-0 bg-white/10 rounded-full blur-xl animate-pulse" />
                <Loader2 className="relative w-10 h-10 animate-spin text-white" />
              </div>
              <p className="text-white/60 font-medium">Loading your video...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========== RENAME DIALOG ========== */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-md bg-black/95 backdrop-blur-2xl border-white/10 rounded-2xl">
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
    </div>
  );
}
