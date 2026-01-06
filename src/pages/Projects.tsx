import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Plus, MoreVertical, Trash2, Copy, Edit2, Film, Play, 
  ArrowRight, X, Download, ExternalLink, Loader2, Zap,
  Clock, CheckCircle2, Circle, ImageIcon, Sparkles,
  User, Coins, ChevronDown, LogOut, Settings, HelpCircle
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
} from '@/components/ui/dialog';
import { useStudio } from '@/contexts/StudioContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Project } from '@/types/studio';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// Smart video component that auto-corrects rotation
function SmartVideoPlayer({ 
  src, 
  className,
  autoPlay = false,
  loop = true,
  muted = true,
  previewPercent = 30,
  playOnHover = false,
  onVideoClick,
}: {
  src: string;
  className?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  previewPercent?: number;
  playOnHover?: boolean;
  onVideoClick?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [needsRotation, setNeedsRotation] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const { videoWidth, videoHeight } = video;
    
    // Detect portrait videos (taller than wide)
    const isPortraitVideo = videoHeight > videoWidth;
    setIsPortrait(isPortraitVideo);
    
    // Detect potentially sideways videos
    // If aspect ratio is very extreme, it might be rotated incorrectly
    const aspectRatio = videoWidth / videoHeight;
    
    // Videos with very unusual aspect ratios might need rotation
    // Normal range: 0.4 (9:16 portrait) to 2.4 (21:9 ultrawide)
    if (aspectRatio < 0.35 || aspectRatio > 2.8) {
      // This might be a sideways video
      setNeedsRotation(true);
      console.log('Unusual aspect ratio detected, may need rotation:', aspectRatio);
    }

    // Seek to preview position
    if (previewPercent !== undefined && video.duration && !autoPlay) {
      video.currentTime = video.duration * (previewPercent / 100);
    }
  }, [previewPercent, autoPlay]);

  const handleMouseEnter = () => {
    if (playOnHover && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  };

  const handleMouseLeave = () => {
    if (playOnHover && videoRef.current) {
      videoRef.current.pause();
      if (previewPercent !== undefined && videoRef.current.duration) {
        videoRef.current.currentTime = videoRef.current.duration * (previewPercent / 100);
      }
    }
  };

  const handleClick = () => {
    if (onVideoClick) {
      onVideoClick();
    } else if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  };

  return (
    <video
      ref={videoRef}
      src={src}
      className={cn(
        "transition-transform duration-500",
        isPortrait ? "object-contain" : "object-cover",
        needsRotation && "rotate-90 scale-[1.78]", // Rotate and scale to fill container
        className
      )}
      autoPlay={autoPlay}
      loop={loop}
      muted={muted}
      playsInline
      preload="metadata"
      onLoadedMetadata={handleLoadedMetadata}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    />
  );
}


export default function Projects() {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { projects, activeProjectId, setActiveProjectId, createProject, deleteProject, refreshProjects } = useStudio();
  const [isGeneratingThumbnails, setIsGeneratingThumbnails] = useState(false);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [hasTriedAutoThumbnails, setHasTriedAutoThumbnails] = useState(false);

  // Auto-generate thumbnails for projects that need them
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

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

  const handlePlayVideo = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    if (project.video_clips?.length || project.video_url) {
      setSelectedProject(project);
      setVideoModalOpen(true);
    }
  };

  const handleDownloadAll = async (project: Project) => {
    const clips = project.video_clips || (project.video_url ? [project.video_url] : []);
    if (clips.length === 0) return;

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

  const getVideoClips = (project: Project): string[] => {
    if (project.video_clips?.length) return project.video_clips;
    if (project.video_url) return [project.video_url];
    return [];
  };

  const completedCount = projects.filter(p => p.status === 'completed').length;
  const inProgressCount = projects.filter(p => p.status === 'generating' || p.status === 'rendering').length;
  const draftCount = projects.filter(p => p.status === 'idle').length;
  const projectsWithoutThumbnails = projects.filter(p => !p.thumbnail_url && (p.video_clips?.length || p.video_url)).length;

  const handleGenerateMissingThumbnails = async () => {
    if (projectsWithoutThumbnails === 0) {
      toast.info('All projects already have thumbnails');
      return;
    }

    setIsGeneratingThumbnails(true);
    toast.info('Generating thumbnails...', { description: `Processing ${projectsWithoutThumbnails} projects` });

    try {
      const { data, error } = await supabase.functions.invoke('generate-missing-thumbnails');

      if (error) {
        console.error('Thumbnail generation error:', error);
        toast.error('Failed to generate thumbnails');
        return;
      }

      if (data?.success) {
        toast.success(data.message || 'Thumbnails generated!');
        await refreshProjects();
      } else {
        toast.error(data?.error || 'Failed to generate thumbnails');
      }
    } catch (err) {
      console.error('Error generating thumbnails:', err);
      toast.error('Something went wrong');
    } finally {
      setIsGeneratingThumbnails(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
    toast.success('Signed out successfully');
  };

  return (
    <div className="min-h-screen bg-black relative">
      {/* Subtle ambient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/3 w-[600px] h-[300px] bg-gradient-to-b from-white/[0.02] to-transparent blur-[100px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-gradient-to-tl from-white/[0.015] to-transparent blur-[80px]" />
      </div>

      {/* Premium Top Navigation Bar */}
      <nav className="sticky top-0 z-50">
        <div className="h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        <div className="bg-black/80 backdrop-blur-2xl border-b border-white/[0.05]">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
            {/* Logo / Brand */}
            <button 
              onClick={() => navigate('/projects')}
              className="flex items-center gap-2.5 group"
            >
              <div className="w-8 h-8 rounded-lg bg-white/[0.08] border border-white/[0.1] flex items-center justify-center group-hover:bg-white/[0.12] transition-colors">
                <Film className="w-4 h-4 text-white/70" />
              </div>
              <span className="text-sm font-semibold text-white/90">apex</span>
            </button>

            {/* Center Nav */}
            <div className="hidden sm:flex items-center gap-1">
              {[
                { label: 'Projects', path: '/projects', active: true },
                { label: 'Create', path: '/pipeline/scripting' },
              ].map((item) => (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-lg transition-all",
                    item.active 
                      ? "text-white bg-white/[0.08]" 
                      : "text-white/50 hover:text-white/90 hover:bg-white/[0.05]"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
              {/* New Project Button */}
              <Button 
                onClick={handleCreateProject}
                size="sm"
                className="h-8 px-3 text-xs bg-white text-black hover:bg-white/90 font-semibold"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                New
              </Button>

              {/* Credits */}
              <button
                onClick={() => navigate('/profile')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] transition-colors"
              >
                <Coins className="w-3.5 h-3.5 text-white/50" />
                <span className="text-xs font-semibold text-white">{profile?.credits_balance?.toLocaleString() || 0}</span>
              </button>

              {/* User Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.05] transition-colors">
                    <div className="w-7 h-7 rounded-lg bg-white/[0.08] border border-white/[0.1] flex items-center justify-center overflow-hidden">
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-3.5 h-3.5 text-white/60" />
                      )}
                    </div>
                    <ChevronDown className="w-3 h-3 text-white/40" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-black/95 backdrop-blur-xl border-white/10">
                  <div className="px-3 py-2 border-b border-white/[0.06]">
                    <p className="text-xs font-medium text-white truncate">{profile?.display_name || profile?.full_name || 'Creator'}</p>
                    <p className="text-[10px] text-white/40 truncate">{profile?.email}</p>
                  </div>
                  <DropdownMenuItem onClick={() => navigate('/profile')} className="text-xs text-white/70 hover:text-white focus:text-white focus:bg-white/[0.08]">
                    <User className="w-3.5 h-3.5 mr-2" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-xs text-white/70 hover:text-white focus:text-white focus:bg-white/[0.08]">
                    <Settings className="w-3.5 h-3.5 mr-2" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-xs text-white/70 hover:text-white focus:text-white focus:bg-white/[0.08]">
                    <HelpCircle className="w-3.5 h-3.5 mr-2" />
                    Help
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/[0.06]" />
                  <DropdownMenuItem onClick={handleSignOut} className="text-xs text-rose-400 hover:text-rose-300 focus:text-rose-300 focus:bg-white/[0.08]">
                    <LogOut className="w-3.5 h-3.5 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </nav>

      {/* Stats Bar */}
      <div className="sticky top-14 z-40 bg-black/60 backdrop-blur-xl border-b border-white/[0.04]">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3 overflow-x-auto scrollbar-hide">
          {[
            { value: projects.length, label: 'Total', icon: Film },
            { value: completedCount, label: 'Done', icon: CheckCircle2, color: 'text-emerald-400' },
            { value: inProgressCount, label: 'Active', icon: Loader2, color: 'text-amber-400', animate: inProgressCount > 0 },
            { value: draftCount, label: 'Drafts', icon: Circle, color: 'text-white/40' },
          ].map((stat, i) => (
            <div 
              key={i} 
              className="flex items-center gap-2 shrink-0 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-all"
            >
              <stat.icon className={cn(
                "w-3 h-3",
                stat.color || "text-white/50",
                stat.animate && "animate-spin"
              )} />
              <span className="text-xs font-medium text-white">{stat.value}</span>
              <span className="text-[10px] text-white/30">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 py-6">
        {projects.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-24 sm:py-40 px-4 animate-fade-in-up">
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-white/5 rounded-3xl blur-2xl scale-150" />
              <div className="relative w-24 h-24 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center">
                <Sparkles className="w-10 h-10 text-white/20" strokeWidth={1.5} />
              </div>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3 text-center">No projects yet</h2>
            <p className="text-white/40 text-base sm:text-lg mb-10 text-center max-w-md">
              Start creating stunning AI-generated videos with our production pipeline.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Button 
                onClick={() => navigate('/pipeline/scripting')}
                variant="outline"
                className="h-12 px-8 rounded-xl bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20 font-medium"
              >
                <Zap className="w-5 h-5 mr-2 text-amber-400" />
                Open Pipeline
              </Button>
              <Button 
                onClick={handleCreateProject}
                className="h-12 px-8 rounded-xl bg-white text-black hover:bg-white/90 font-semibold shadow-lg shadow-white/10"
              >
                <Plus className="w-5 h-5 mr-2" />
                Create Project
              </Button>
            </div>
          </div>
        ) : (
          /* Projects Masonry Gallery */
          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
            {projects.map((project, index) => {
              const hasVideo = Boolean(project.video_clips?.length || project.video_url);
              const videoClips = getVideoClips(project);
              const isActive = activeProjectId === project.id;
              
              // Dynamic aspect ratios for visual variety
              const aspectVariants = [
                'aspect-video',           // 16:9
                'aspect-[4/5]',           // Portrait
                'aspect-square',          // 1:1
                'aspect-[3/4]',           // Tall portrait
                'aspect-[16/10]',         // Wide
                'aspect-[5/4]',           // Slightly square
              ];
              const aspectClass = aspectVariants[index % aspectVariants.length];
              
              return (
                <div
                  key={project.id}
                  className="break-inside-avoid mb-4"
                >
                  <div
                    onClick={() => hasVideo ? handlePlayVideo(project, { stopPropagation: () => {} } as React.MouseEvent) : handleOpenProject(project.id)}
                    className={cn(
                      "group relative overflow-hidden cursor-pointer transition-all duration-700",
                      "rounded-[2rem] sm:rounded-[2.5rem]",
                      "hover:scale-[1.02] hover:shadow-2xl hover:shadow-white/5",
                      isActive && "ring-2 ring-white/30",
                      "animate-fade-in"
                    )}
                    style={{ animationDelay: `${Math.min(index * 80, 500)}ms` }}
                  >
                    {/* Video/Placeholder Container */}
                    <div className={cn(aspectClass, "relative overflow-hidden bg-black/40")}>
                      {hasVideo && videoClips.length > 0 ? (
                        <SmartVideoPlayer
                          src={videoClips.length > 1 ? videoClips[1] : videoClips[0]}
                          className="absolute inset-0 w-full h-full transition-transform duration-1000 ease-out group-hover:scale-110"
                          previewPercent={30}
                          playOnHover={true}
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-white/[0.03] to-transparent">
                          <div className="relative">
                            <div className="absolute inset-0 bg-white/5 rounded-full blur-2xl scale-150" />
                            {project.status === 'generating' || project.status === 'rendering' ? (
                              <Loader2 className="relative w-10 h-10 text-white/20 animate-spin" strokeWidth={1} />
                            ) : (
                              <Film className="relative w-10 h-10 text-white/15" strokeWidth={1} />
                            )}
                          </div>
                        </div>
                      )}

                      {/* Elegant gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-500" />
                      
                      {/* Shimmer effect on hover */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-out" />

                      {/* Floating status indicator */}
                      <div className="absolute top-4 left-4 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                        {project.status === 'completed' ? (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 backdrop-blur-xl">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span className="text-[10px] font-medium text-emerald-300 uppercase tracking-wider">Ready</span>
                          </div>
                        ) : project.status === 'generating' || project.status === 'rendering' ? (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/20 backdrop-blur-xl">
                            <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
                            <span className="text-[10px] font-medium text-amber-300 uppercase tracking-wider">Processing</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-xl">
                            <Circle className="w-3 h-3 text-white/50" />
                            <span className="text-[10px] font-medium text-white/50 uppercase tracking-wider">Draft</span>
                          </div>
                        )}
                      </div>

                      {/* Clip count - top right */}
                      {hasVideo && videoClips.length > 1 && (
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                          <div className="px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-xl">
                            <span className="text-[10px] font-medium text-white/70">{videoClips.length} clips</span>
                          </div>
                        </div>
                      )}

                      {/* Bottom content overlay */}
                      <div className="absolute bottom-0 left-0 right-0 p-5 translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
                        <h3 className="font-semibold text-white text-lg truncate mb-1 drop-shadow-lg">
                          {project.name}
                        </h3>
                        <div className="flex items-center gap-3 text-white/50 text-xs">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(project.updated_at)}
                          </span>
                          {hasVideo && (
                            <span className="flex items-center gap-1">
                              <Play className="w-3 h-3" fill="currentColor" />
                              {videoClips.length} video{videoClips.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Center play icon on hover */}
                      {hasVideo && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                          <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center border border-white/20 group-hover:scale-110 transition-transform duration-500">
                            <Play className="w-7 h-7 text-white ml-1" fill="currentColor" />
                          </div>
                        </div>
                      )}

                      {/* Floating action menu */}
                      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300" style={{ top: hasVideo && videoClips.length > 1 ? '3rem' : '1rem' }}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              onClick={(e) => e.stopPropagation()}
                              className="h-8 w-8 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-xl text-white/70 hover:text-white hover:bg-black/60 transition-all"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44 rounded-2xl bg-black/90 border-white/10 shadow-2xl backdrop-blur-2xl p-1">
                            {hasVideo && (
                              <>
                                <DropdownMenuItem 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePlayVideo(project, e as any);
                                  }}
                                  className="gap-2.5 text-sm text-white/70 focus:text-white focus:bg-white/10 rounded-xl py-2.5 px-3"
                                >
                                  <Play className="w-4 h-4" />
                                  Play
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownloadAll(project);
                                  }}
                                  className="gap-2.5 text-sm text-white/70 focus:text-white focus:bg-white/10 rounded-xl py-2.5 px-3"
                                >
                                  <Download className="w-4 h-4" />
                                  Download
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-white/10 my-1" />
                              </>
                            )}
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenProject(project.id);
                              }} 
                              className="gap-2.5 text-sm text-white/70 focus:text-white focus:bg-white/10 rounded-xl py-2.5 px-3"
                            >
                              <Edit2 className="w-4 h-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="gap-2.5 text-sm text-white/70 focus:text-white focus:bg-white/10 rounded-xl py-2.5 px-3"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Copy className="w-4 h-4" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-white/10 my-1" />
                            <DropdownMenuItem
                              className="gap-2.5 text-sm text-red-400 focus:text-red-300 focus:bg-red-500/10 rounded-xl py-2.5 px-3"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteProject(project.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* New Project Card */}
            <div className="break-inside-avoid mb-4">
              <button
                onClick={handleCreateProject}
                className={cn(
                  "group relative w-full overflow-hidden transition-all duration-700",
                  "rounded-[2rem] sm:rounded-[2.5rem]",
                  "border border-dashed border-white/10 hover:border-white/20",
                  "bg-white/[0.02] hover:bg-white/[0.04]",
                  "aspect-[4/3] flex flex-col items-center justify-center",
                  "hover:scale-[1.02]",
                  "animate-fade-in"
                )}
                style={{ animationDelay: `${Math.min(projects.length * 80, 500)}ms` }}
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-white/5 rounded-full blur-2xl scale-150 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative w-14 h-14 rounded-2xl bg-white/5 group-hover:bg-white/10 border border-white/10 group-hover:border-white/20 flex items-center justify-center transition-all duration-500 group-hover:scale-110">
                    <Plus className="w-6 h-6 text-white/30 group-hover:text-white/60 transition-colors" strokeWidth={1.5} />
                  </div>
                </div>
                <span className="mt-4 text-sm font-medium text-white/30 group-hover:text-white/60 transition-colors">
                  New Project
                </span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Fullscreen Video Player Modal */}
      <Dialog open={videoModalOpen} onOpenChange={setVideoModalOpen}>
        <DialogContent className="max-w-none w-screen h-screen p-0 border-0 bg-black overflow-hidden rounded-none left-0 top-0 translate-x-0 translate-y-0 [&>button]:hidden">
          {/* Fullscreen Video Container */}
          <div className="absolute inset-0">
            {selectedProject && (
              <SmartVideoPlayer
                src={getVideoClips(selectedProject)[0]}
                className="absolute inset-0 w-full h-full"
                autoPlay={true}
                loop={true}
                muted={false}
                onVideoClick={() => {
                  // Toggle play/pause is handled inside SmartVideoPlayer
                }}
              />
            )}
            
            {/* Transparent overlay controls */}
            <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300">
              {/* Top gradient with title and close */}
              <div className="absolute top-0 left-0 right-0 p-6 bg-gradient-to-b from-black/60 to-transparent">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-medium text-lg drop-shadow-lg">{selectedProject?.name}</h3>
                    <p className="text-white/60 text-sm">
                      {selectedProject?.video_clips?.length || 1} clip{(selectedProject?.video_clips?.length || 1) > 1 ? 's' : ''}
                    </p>
                  </div>
                  <button
                    className="w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all"
                    onClick={() => setVideoModalOpen(false)}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Bottom gradient with actions */}
              <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/60 to-transparent">
                <div className="flex items-center justify-center gap-4">
                  <button
                    className="flex items-center gap-2 h-11 px-5 bg-white/10 text-white text-sm font-medium rounded-full hover:bg-white/20 transition-all backdrop-blur-sm"
                    onClick={() => {
                      if (selectedProject) {
                        const clips = getVideoClips(selectedProject);
                        if (clips[0]) window.open(clips[0], '_blank');
                      }
                    }}
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open
                  </button>
                  <button
                    className="flex items-center gap-2 h-11 px-5 bg-white/10 text-white text-sm font-medium rounded-full hover:bg-white/20 transition-all backdrop-blur-sm"
                    onClick={() => {
                      if (selectedProject) handleDownloadAll(selectedProject);
                    }}
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                  <button
                    className="flex items-center gap-2 h-11 px-6 bg-white text-black text-sm font-semibold rounded-full hover:bg-white/90 transition-all shadow-lg"
                    onClick={() => {
                      setVideoModalOpen(false);
                      if (selectedProject) {
                        setActiveProjectId(selectedProject.id);
                        navigate('/pipeline/production');
                      }
                    }}
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
