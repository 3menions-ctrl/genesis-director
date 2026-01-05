import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { 
  Plus, MoreVertical, Trash2, Copy, Edit2, Film, Play, 
  ArrowRight, X, Download, ExternalLink, Loader2, Zap,
  Clock, CheckCircle2, Circle, ImageIcon, Sparkles
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
import { cn } from '@/lib/utils';
import { VideoPlaylist } from '@/components/studio/VideoPlaylist';
import { Project } from '@/types/studio';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function Projects() {
  const navigate = useNavigate();
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

  return (
    <div className="h-screen bg-[hsl(0_0%_3%)] relative overflow-hidden flex flex-col">
      {/* Premium Dark Ambient Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Animated gradient orbs */}
        <div className="absolute top-[-30%] left-[-15%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-br from-white/[0.02] to-transparent blur-[120px] animate-float-slow" />
        <div className="absolute bottom-[-30%] right-[-15%] w-[70vw] h-[70vw] rounded-full bg-gradient-to-tl from-white/[0.015] to-transparent blur-[150px] animate-float" style={{ animationDelay: '3s' }} />
        <div className="absolute top-[40%] right-[10%] w-[40vw] h-[40vw] rounded-full bg-gradient-to-bl from-white/[0.01] to-transparent blur-[100px] animate-pulse-soft" />
        
        {/* Subtle grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
            backgroundSize: '80px 80px'
          }}
        />
        
        {/* Noise texture */}
        <div className="absolute inset-0 opacity-[0.015] pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      {/* Premium Header */}
      <header className="relative z-10 shrink-0">
        {/* Top accent line */}
        <div className="h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        
        {/* Glassmorphism header background */}
        <div className="relative bg-white/[0.03] backdrop-blur-2xl border-b border-white/[0.08]">
          {/* Shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent animate-shimmer" />
          
          <div className="relative max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
            {/* Main header content */}
            <div className="py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="animate-fade-in flex items-center gap-4">
                {/* Premium logo container */}
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-white/5 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-white/15 to-white/5 border border-white/20 flex items-center justify-center shadow-lg shadow-black/20 group-hover:border-white/30 transition-all">
                    <Film className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Projects</h1>
                  <p className="text-xs sm:text-sm text-white/40 hidden sm:block">Manage your video productions</p>
                </div>
              </div>
              
              {/* Action buttons */}
              <div className="flex items-center gap-2 sm:gap-3 animate-fade-in" style={{ animationDelay: '100ms' }}>
                {projectsWithoutThumbnails > 0 && (
                  <Button 
                    variant="outline"
                    onClick={handleGenerateMissingThumbnails}
                    disabled={isGeneratingThumbnails}
                    size="sm"
                    className="h-9 px-3 sm:px-4 rounded-lg bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all backdrop-blur-sm"
                  >
                    {isGeneratingThumbnails ? (
                      <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" />
                    ) : (
                      <ImageIcon className="w-4 h-4 sm:mr-2 text-purple-400" />
                    )}
                    <span className="hidden sm:inline text-sm">Thumbnails</span>
                  </Button>
                )}
                <Button 
                  variant="outline"
                  onClick={() => navigate('/pipeline/scripting')}
                  size="sm"
                  className="h-9 px-3 sm:px-4 rounded-lg bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all backdrop-blur-sm"
                >
                  <Zap className="w-4 h-4 sm:mr-2 text-amber-400" />
                  <span className="hidden sm:inline text-sm">Pipeline</span>
                </Button>
                <Button 
                  onClick={handleCreateProject}
                  size="sm"
                  className="h-9 px-4 sm:px-5 rounded-lg bg-white text-black hover:bg-white/90 font-semibold shadow-lg shadow-white/10 transition-all hover:-translate-y-0.5 text-sm"
                >
                  <Plus className="w-4 h-4 sm:mr-1.5" />
                  <span className="hidden sm:inline">New</span>
                </Button>
              </div>
            </div>

            {/* Stats bar - horizontal scroll on mobile */}
            <div className="pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 flex items-center gap-2 sm:gap-3 overflow-x-auto scrollbar-hide animate-fade-in" style={{ animationDelay: '150ms' }}>
              {[
                { value: projects.length, label: 'Total', icon: Film },
                { value: completedCount, label: 'Done', icon: CheckCircle2, color: 'text-emerald-400' },
                { value: inProgressCount, label: 'Active', icon: Loader2, color: 'text-amber-400', animate: inProgressCount > 0 },
                { value: draftCount, label: 'Drafts', icon: Circle, color: 'text-white/40' },
              ].map((stat, i) => (
                <div 
                  key={i} 
                  className="flex items-center gap-2 shrink-0 px-3 py-2 rounded-lg bg-white/10 border border-white/15 backdrop-blur-xl hover:bg-white/15 hover:border-white/25 transition-all group cursor-default"
                >
                  <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center group-hover:bg-white/25 transition-colors">
                    <stat.icon className={cn(
                      "w-3.5 h-3.5",
                      stat.color || "text-white/70",
                      stat.animate && "animate-spin"
                    )} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-white font-semibold text-sm tabular-nums">{stat.value}</span>
                    <span className="text-white/40 text-xs hidden sm:inline">{stat.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Content - scrollable area */}
      <main className="relative z-10 flex-1 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
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
          /* Projects Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 lg:gap-6">
            {projects.map((project, index) => {
              const hasVideo = Boolean(project.video_clips?.length || project.video_url);
              const videoClips = getVideoClips(project);
              const isActive = activeProjectId === project.id;
              
              return (
                <div
                  key={project.id}
                  onClick={() => handleSelectProject(project.id)}
                  className={cn(
                    "group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-500",
                    "bg-white/[0.02] hover:bg-white/[0.04]",
                    "border border-white/[0.06] hover:border-white/[0.12]",
                    "hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/50",
                    isActive && "ring-2 ring-white/20 border-white/20",
                    "animate-fade-in"
                  )}
                  style={{ animationDelay: `${Math.min(index * 50, 400)}ms` }}
                >
                  {/* Thumbnail */}
                  <div className="aspect-video relative overflow-hidden bg-[hsl(0_0%_5%)]">
                    {project.thumbnail_url ? (
                      <img
                        src={project.thumbnail_url}
                        alt={project.name}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                        loading="lazy"
                      />
                    ) : hasVideo && videoClips[0] ? (
                      <video
                        src={videoClips[0]}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                        muted
                        playsInline
                        preload="metadata"
                        onMouseEnter={(e) => e.currentTarget.play()}
                        onMouseLeave={(e) => {
                          e.currentTarget.pause();
                          e.currentTarget.currentTime = 0;
                        }}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                          {project.status === 'generating' || project.status === 'rendering' ? (
                            <Loader2 className="w-7 h-7 text-white/30 animate-spin" strokeWidth={1.5} />
                          ) : (
                            <Film className="w-7 h-7 text-white/20" strokeWidth={1.5} />
                          )}
                        </div>
                      </div>
                    )}

                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                    {/* Status badge */}
                    <div className="absolute top-3 left-3">
                      {project.status === 'completed' ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 backdrop-blur-md border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span className="text-[11px] font-medium text-emerald-300">Ready</span>
                        </div>
                      ) : project.status === 'generating' || project.status === 'rendering' ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 backdrop-blur-md border border-amber-500/30">
                          <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
                          <span className="text-[11px] font-medium text-amber-300">Processing</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10">
                          <Circle className="w-3 h-3 text-white/50" />
                          <span className="text-[11px] font-medium text-white/50">Draft</span>
                        </div>
                      )}
                    </div>

                    {/* Clip count badge */}
                    {hasVideo && videoClips.length > 1 && (
                      <div className="absolute top-3 right-3">
                        <div className="px-2 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10">
                          <span className="text-[11px] font-medium text-white/80">{videoClips.length} clips</span>
                        </div>
                      </div>
                    )}

                    {/* Hover actions */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                      <div className="flex items-center gap-3">
                        {hasVideo ? (
                          <>
                            <button 
                              onClick={(e) => handlePlayVideo(project, e)}
                              className="flex items-center gap-2 h-10 px-5 bg-white text-black text-sm font-semibold rounded-full hover:bg-white/90 transition-all shadow-xl hover:scale-105"
                            >
                              <Play className="w-4 h-4" fill="currentColor" />
                              Play
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenProject(project.id);
                              }}
                              className="flex items-center justify-center w-10 h-10 bg-white/20 backdrop-blur-md text-white rounded-full hover:bg-white/30 transition-all border border-white/20 hover:scale-105"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenProject(project.id);
                            }}
                            className="flex items-center gap-2 h-10 px-6 bg-white text-black text-sm font-semibold rounded-full hover:bg-white/90 transition-all shadow-xl hover:scale-105"
                          >
                            Open
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white truncate text-base group-hover:text-white/90 transition-colors">
                          {project.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Clock className="w-3 h-3 text-white/30" />
                          <span className="text-xs text-white/40">
                            {formatDate(project.updated_at)}
                          </span>
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.08] transition-all"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 rounded-xl bg-[hsl(0_0%_8%)] border-white/[0.1] shadow-2xl backdrop-blur-xl">
                          {hasVideo && (
                            <>
                              <DropdownMenuItem 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePlayVideo(project, e as any);
                                }}
                                className="gap-3 text-sm text-white/70 focus:text-white focus:bg-white/[0.08] rounded-lg mx-1 py-2.5"
                              >
                                <Play className="w-4 h-4" />
                                Play Video
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadAll(project);
                                }}
                                className="gap-3 text-sm text-white/70 focus:text-white focus:bg-white/[0.08] rounded-lg mx-1 py-2.5"
                              >
                                <Download className="w-4 h-4" />
                                Download All
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-white/[0.08] my-1" />
                            </>
                          )}
                          <DropdownMenuItem 
                            onClick={() => handleOpenProject(project.id)} 
                            className="gap-3 text-sm text-white/70 focus:text-white focus:bg-white/[0.08] rounded-lg mx-1 py-2.5"
                          >
                            <Edit2 className="w-4 h-4" />
                            Edit Project
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-3 text-sm text-white/70 focus:text-white focus:bg-white/[0.08] rounded-lg mx-1 py-2.5">
                            <Copy className="w-4 h-4" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-white/[0.08] my-1" />
                          <DropdownMenuItem
                            className="gap-3 text-sm text-red-400 focus:text-red-300 focus:bg-red-500/10 rounded-lg mx-1 py-2.5"
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
              );
            })}

            {/* New Project Card */}
            <button
              onClick={handleCreateProject}
              className={cn(
                "group relative rounded-2xl border-2 border-dashed transition-all duration-500",
                "border-white/[0.08] hover:border-white/20",
                "bg-transparent hover:bg-white/[0.02]",
                "flex flex-col items-center justify-center min-h-[280px]",
                "hover:-translate-y-1",
                "animate-fade-in"
              )}
              style={{ animationDelay: `${Math.min(projects.length * 50, 400)}ms` }}
            >
              <div className="w-16 h-16 rounded-2xl bg-white/[0.03] group-hover:bg-white/[0.08] border border-white/[0.06] group-hover:border-white/[0.12] flex items-center justify-center transition-all duration-500 group-hover:scale-110">
                <Plus className="w-7 h-7 text-white/30 group-hover:text-white/60 transition-colors" strokeWidth={1.5} />
              </div>
              <span className="mt-4 text-sm font-medium text-white/30 group-hover:text-white/60 transition-colors">
                Create New Project
              </span>
            </button>
          </div>
        )}
        </div>
      </main>

      {/* Video Player Modal */}
      <Dialog open={videoModalOpen} onOpenChange={setVideoModalOpen}>
        <DialogContent className="max-w-5xl w-[95vw] p-0 overflow-hidden bg-black border border-white/[0.1] rounded-2xl shadow-2xl left-0 top-0 translate-x-0 translate-y-0 sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] [&>button]:hidden">
          <div className="relative">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-50 p-5 bg-gradient-to-b from-black/80 to-transparent">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-semibold text-lg">{selectedProject?.name}</h3>
                  <p className="text-white/50 text-sm mt-0.5">
                    {selectedProject?.video_clips?.length || 1} clip{(selectedProject?.video_clips?.length || 1) > 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all"
                  onClick={() => setVideoModalOpen(false)}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Video */}
            <div className="aspect-video bg-black">
              {selectedProject && (
                <VideoPlaylist
                  clips={getVideoClips(selectedProject)}
                  showControls={true}
                />
              )}
            </div>

            {/* Footer actions */}
            <div className="absolute bottom-0 left-0 right-0 z-50 p-5 bg-gradient-to-t from-black/80 to-transparent">
              <div className="flex items-center justify-center gap-3">
                <button
                  className="flex items-center gap-2 h-10 px-5 bg-white/10 border border-white/10 text-white/80 text-sm font-medium rounded-full hover:bg-white/20 transition-all backdrop-blur-sm"
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
                  className="flex items-center gap-2 h-10 px-5 bg-white/10 border border-white/10 text-white/80 text-sm font-medium rounded-full hover:bg-white/20 transition-all backdrop-blur-sm"
                  onClick={() => {
                    if (selectedProject) handleDownloadAll(selectedProject);
                  }}
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button
                  className="flex items-center gap-2 h-10 px-6 bg-white text-black text-sm font-semibold rounded-full hover:bg-white/90 transition-all shadow-lg"
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
