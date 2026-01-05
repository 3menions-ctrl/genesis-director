import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { 
  Plus, MoreVertical, Trash2, Copy, Edit2, Film, Play, 
  ArrowRight, X, Download, ExternalLink, Loader2, Zap,
  Sparkles, Clock, CheckCircle2, Circle, ImageIcon, RefreshCw
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
  const [activeTab, setActiveTab] = useState<'all' | 'completed' | 'in-progress'>('all');

  // Filter projects based on active tab
  const filteredProjects = useMemo(() => {
    return projects.filter(project => {
      const hasVideo = Boolean(project.video_clips?.length || project.video_url);
      const isCompleted = project.status === 'completed' || hasVideo;
      
      switch (activeTab) {
        case 'completed':
          return isCompleted;
        case 'in-progress':
          return !isCompleted;
        default:
          return true;
      }
    });
  }, [projects, activeTab]);

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
    navigate('/script');
  };

  const handleCreateProject = () => {
    createProject();
    navigate('/create');
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
        // Refresh projects to show new thumbnails
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
    <div className="min-h-screen bg-[hsl(0_0%_4%)]">
      {/* Ambient background effects - hidden on mobile for performance */}
      <div className="hidden md:block fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-white/[0.015] rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-white/[0.01] rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/[0.06]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10">
          {/* Top row - stacks on mobile */}
          <div className="py-5 sm:py-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">Projects</h1>
              <p className="text-xs sm:text-sm text-white/40 mt-0.5 sm:mt-1">Create and manage your video productions</p>
            </div>
            
            {/* Action buttons - responsive layout */}
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
              {projectsWithoutThumbnails > 0 && (
                <Button 
                  variant="outline"
                  onClick={handleGenerateMissingThumbnails}
                  disabled={isGeneratingThumbnails}
                  size="sm"
                  className="h-9 sm:h-10 px-3 sm:px-5 rounded-xl bg-transparent border-white/10 text-white/70 hover:text-white hover:bg-white/[0.06] hover:border-white/20 transition-all text-xs sm:text-sm"
                >
                  {isGeneratingThumbnails ? (
                    <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" />
                  ) : (
                    <ImageIcon className="w-4 h-4 sm:mr-2 text-purple-400" />
                  )}
                  <span className="hidden sm:inline">Generate {projectsWithoutThumbnails} Thumbnails</span>
                </Button>
              )}
              <Button 
                variant="outline"
                onClick={() => navigate('/pipeline/scripting')}
                size="sm"
                className="h-9 sm:h-10 px-3 sm:px-5 rounded-xl bg-transparent border-white/10 text-white/70 hover:text-white hover:bg-white/[0.06] hover:border-white/20 transition-all text-xs sm:text-sm"
              >
                <Zap className="w-4 h-4 sm:mr-2 text-amber-400" />
                <span className="hidden sm:inline">Pipeline</span>
              </Button>
              <Button 
                onClick={handleCreateProject}
                size="sm"
                className="h-9 sm:h-10 px-3 sm:px-5 rounded-xl bg-white text-[hsl(0_0%_8%)] hover:bg-white/90 font-medium shadow-lg shadow-white/10 transition-all text-xs sm:text-sm"
              >
                <Plus className="w-4 h-4 sm:mr-2" />
                <span className="hidden xs:inline">New</span>
              </Button>
            </div>
          </div>

          {/* Tabs for filtering */}
          <div className="pb-4 sm:pb-6 flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-hide">
            {[
              { id: 'all' as const, label: 'All', count: projects.length },
              { id: 'completed' as const, label: 'Completed', count: completedCount + projects.filter(p => p.video_clips?.length || p.video_url).length - projects.filter(p => p.status === 'completed' && (p.video_clips?.length || p.video_url)).length },
              { id: 'in-progress' as const, label: 'In Progress', count: projects.filter(p => p.status !== 'completed' && !p.video_clips?.length && !p.video_url).length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all shrink-0",
                  activeTab === tab.id
                    ? "bg-white text-[hsl(0_0%_8%)]"
                    : "bg-white/[0.06] text-white/60 hover:bg-white/[0.1] hover:text-white/80"
                )}
              >
                {tab.label}
                <span className={cn(
                  "px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs tabular-nums",
                  activeTab === tab.id
                    ? "bg-black/10 text-[hsl(0_0%_20%)]"
                    : "bg-white/10 text-white/50"
                )}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-5 sm:py-8">
        {filteredProjects.length === 0 && projects.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-16 sm:py-32 px-4">
            <div className="relative mb-6 sm:mb-8">
              <div className="absolute inset-0 bg-white/5 rounded-3xl blur-xl" />
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                <Film className="w-6 h-6 sm:w-8 sm:h-8 text-white/20" strokeWidth={1.5} />
              </div>
            </div>
            <h2 className="text-lg sm:text-xl font-medium text-white mb-2 text-center">No projects yet</h2>
            <p className="text-white/40 text-xs sm:text-sm mb-6 sm:mb-8 text-center max-w-sm">
              Start by creating a quick clip or use the production pipeline for full-length videos.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <Button 
                onClick={() => navigate('/pipeline/scripting')}
                variant="outline"
                className="w-full sm:w-auto h-10 sm:h-11 px-5 sm:px-6 rounded-xl bg-transparent border-white/10 text-white/70 hover:text-white hover:bg-white/[0.06] hover:border-white/20"
              >
                <Zap className="w-4 h-4 mr-2 text-amber-400" />
                Production Pipeline
              </Button>
              <Button 
                onClick={handleCreateProject}
                className="w-full sm:w-auto h-10 sm:h-11 px-5 sm:px-6 rounded-xl bg-white text-[hsl(0_0%_8%)] hover:bg-white/90 font-medium"
              >
                <Plus className="w-4 h-4 mr-2" />
                Quick Clip
              </Button>
            </div>
          </div>
        ) : filteredProjects.length === 0 ? (
          /* Empty filtered state */
          <div className="flex flex-col items-center justify-center py-16 sm:py-24 px-4">
            <div className="relative mb-6">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                {activeTab === 'completed' ? (
                  <CheckCircle2 className="w-6 h-6 text-white/20" strokeWidth={1.5} />
                ) : (
                  <Circle className="w-6 h-6 text-white/20" strokeWidth={1.5} />
                )}
              </div>
            </div>
            <h2 className="text-lg font-medium text-white mb-2 text-center">
              No {activeTab === 'completed' ? 'completed' : 'in-progress'} projects
            </h2>
            <p className="text-white/40 text-sm mb-6 text-center max-w-sm">
              {activeTab === 'completed' 
                ? "Projects with generated videos will appear here."
                : "Projects still being worked on will appear here."}
            </p>
            <Button
              onClick={() => setActiveTab('all')}
              variant="outline"
              className="h-10 px-5 rounded-xl bg-transparent border-white/10 text-white/70 hover:text-white hover:bg-white/[0.06]"
            >
              View All Projects
            </Button>
          </div>
        ) : (
          /* Projects Grid - Responsive layout */
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
            {filteredProjects.map((project, index) => {
              const hasVideo = Boolean(project.video_clips?.length || project.video_url);
              const videoClips = getVideoClips(project);
              const isActive = activeProjectId === project.id;
              
              return (
                <div
                  key={project.id}
                  onClick={() => handleSelectProject(project.id)}
                  className={cn(
                    "group relative rounded-xl sm:rounded-2xl overflow-hidden cursor-pointer transition-all duration-300",
                    "bg-white/[0.03] hover:bg-white/[0.05]",
                    "border border-white/[0.06] hover:border-white/[0.12]",
                    "active:scale-[0.98] sm:active:scale-100",
                    isActive && "ring-2 ring-white/20 border-white/20",
                    "animate-fade-in"
                  )}
                  style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
                >
                  {/* Thumbnail */}
                  <div className="aspect-video relative overflow-hidden bg-[hsl(0_0%_6%)]">
                    {project.thumbnail_url ? (
                      <img
                        src={project.thumbnail_url}
                        alt={project.name}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : hasVideo && videoClips[0] ? (
                      <video
                        src={videoClips[0]}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                        muted
                        playsInline
                        preload="metadata"
                        onMouseEnter={(e) => e.currentTarget.play()}
                        onMouseLeave={(e) => {
                          e.currentTarget.pause();
                          e.currentTarget.currentTime = 0;
                        }}
                        onTouchStart={(e) => e.currentTarget.play()}
                        onTouchEnd={(e) => {
                          e.currentTarget.pause();
                          e.currentTarget.currentTime = 0;
                        }}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                          {project.status === 'generating' || project.status === 'rendering' ? (
                            <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 text-white/30 animate-spin" strokeWidth={1.5} />
                          ) : (
                            <Film className="w-5 h-5 sm:w-6 sm:h-6 text-white/20" strokeWidth={1.5} />
                          )}
                        </div>
                      </div>
                    )}

                    {/* Gradient overlay - always visible on mobile for touch */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300" />

                    {/* Status badge - smaller on mobile */}
                    <div className="absolute top-2 left-2 sm:top-3 sm:left-3">
                      {project.status === 'completed' ? (
                        <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-emerald-500/20 backdrop-blur-md border border-emerald-500/30">
                          <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-400" />
                          <span className="text-[10px] sm:text-[11px] font-medium text-emerald-300">Ready</span>
                        </div>
                      ) : project.status === 'generating' || project.status === 'rendering' ? (
                        <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-amber-500/20 backdrop-blur-md border border-amber-500/30">
                          <Loader2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-400 animate-spin" />
                          <span className="text-[10px] sm:text-[11px] font-medium text-amber-300">Processing</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10">
                          <Circle className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white/50" />
                          <span className="text-[10px] sm:text-[11px] font-medium text-white/50">Draft</span>
                        </div>
                      )}
                    </div>

                    {/* Clip count badge */}
                    {hasVideo && videoClips.length > 1 && (
                      <div className="absolute top-2 right-2 sm:top-3 sm:right-3">
                        <div className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10">
                          <span className="text-[10px] sm:text-[11px] font-medium text-white/80">{videoClips.length}</span>
                        </div>
                      </div>
                    )}

                    {/* Hover/Touch actions - visible on mobile */}
                    <div className="absolute inset-0 flex items-end sm:items-center justify-center pb-3 sm:pb-0 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-300">
                      <div className="flex items-center gap-2">
                        {hasVideo ? (
                          <>
                            <button 
                              onClick={(e) => handlePlayVideo(project, e)}
                              className="flex items-center gap-1.5 sm:gap-2 h-8 sm:h-9 px-3 sm:px-4 bg-white text-[hsl(0_0%_8%)] text-xs sm:text-sm font-medium rounded-full hover:bg-white/90 transition-all shadow-lg"
                            >
                              <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" />
                              <span className="hidden xs:inline">Play</span>
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenProject(project.id);
                              }}
                              className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 bg-white/20 backdrop-blur-md text-white rounded-full hover:bg-white/30 transition-all border border-white/20"
                            >
                              <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </button>
                          </>
                        ) : (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenProject(project.id);
                            }}
                            className="flex items-center gap-1.5 sm:gap-2 h-8 sm:h-9 px-4 sm:px-5 bg-white text-[hsl(0_0%_8%)] text-xs sm:text-sm font-medium rounded-full hover:bg-white/90 transition-all shadow-lg"
                          >
                            Open
                            <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Content - compact on mobile */}
                  <div className="p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-2 sm:gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-white truncate text-sm sm:text-base">
                          {project.name}
                        </h3>
                        <div className="flex items-center gap-1.5 sm:gap-2 mt-1 sm:mt-1.5">
                          <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white/30" />
                          <span className="text-[10px] sm:text-xs text-white/40">
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
                        <DropdownMenuContent align="end" className="w-44 rounded-xl bg-[hsl(0_0%_10%)] border-white/[0.1] shadow-2xl">
                          {hasVideo && (
                            <>
                              <DropdownMenuItem 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePlayVideo(project, e as any);
                                }}
                                className="gap-2.5 text-sm text-white/70 focus:text-white focus:bg-white/[0.08] rounded-lg mx-1"
                              >
                                <Play className="w-4 h-4" />
                                Play Video
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadAll(project);
                                }}
                                className="gap-2.5 text-sm text-white/70 focus:text-white focus:bg-white/[0.08] rounded-lg mx-1"
                              >
                                <Download className="w-4 h-4" />
                                Download All
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-white/[0.08] my-1" />
                            </>
                          )}
                          <DropdownMenuItem 
                            onClick={() => handleOpenProject(project.id)} 
                            className="gap-2.5 text-sm text-white/70 focus:text-white focus:bg-white/[0.08] rounded-lg mx-1"
                          >
                            <Edit2 className="w-4 h-4" />
                            Edit Project
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2.5 text-sm text-white/70 focus:text-white focus:bg-white/[0.08] rounded-lg mx-1">
                            <Copy className="w-4 h-4" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-white/[0.08] my-1" />
                          <DropdownMenuItem
                            className="gap-2.5 text-sm text-red-400 focus:text-red-300 focus:bg-red-500/10 rounded-lg mx-1"
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

            {/* New Project Card - Responsive */}
            <button
              onClick={handleCreateProject}
              className={cn(
                "group relative rounded-xl sm:rounded-2xl border-2 border-dashed transition-all duration-300",
                "border-white/[0.08] hover:border-white/20 active:border-white/30",
                "bg-transparent hover:bg-white/[0.02]",
                "flex flex-col items-center justify-center min-h-[180px] sm:min-h-[220px] lg:min-h-[280px]",
                "animate-fade-in"
              )}
              style={{ animationDelay: `${Math.min(projects.length * 30, 300)}ms` }}
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-xl sm:rounded-2xl bg-white/[0.04] group-hover:bg-white/[0.08] flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                <Plus className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-white/30 group-hover:text-white/60 transition-colors" strokeWidth={1.5} />
              </div>
              <span className="mt-2 sm:mt-3 lg:mt-4 text-xs sm:text-sm font-medium text-white/30 group-hover:text-white/60 transition-colors">
                Create New
              </span>
            </button>
          </div>
        )}
      </main>

      {/* Video Player Modal - Responsive */}
      <Dialog open={videoModalOpen} onOpenChange={setVideoModalOpen}>
        <DialogContent className="max-w-5xl w-[95vw] sm:w-[90vw] p-0 overflow-hidden bg-[hsl(0_0%_4%)] border border-white/[0.1] rounded-xl sm:rounded-2xl shadow-2xl">
          <div className="relative">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-50 p-3 sm:p-5 bg-gradient-to-b from-black/80 to-transparent">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-medium text-sm sm:text-base">{selectedProject?.name}</h3>
                  <p className="text-white/50 text-xs sm:text-sm mt-0.5">
                    {selectedProject?.video_clips?.length || 1} clip{(selectedProject?.video_clips?.length || 1) > 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all"
                  onClick={() => setVideoModalOpen(false)}
                >
                  <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
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

            {/* Footer actions - Responsive */}
            <div className="absolute bottom-0 left-0 right-0 z-50 p-3 sm:p-5 bg-gradient-to-t from-black/80 to-transparent">
              <div className="flex items-center justify-center gap-2 sm:gap-3">
                <button
                  className="flex items-center gap-1.5 sm:gap-2 h-8 sm:h-9 px-3 sm:px-4 bg-white/10 border border-white/10 text-white/80 text-xs sm:text-sm font-medium rounded-full hover:bg-white/20 transition-all backdrop-blur-sm"
                  onClick={() => {
                    if (selectedProject) {
                      const clips = getVideoClips(selectedProject);
                      if (clips[0]) window.open(clips[0], '_blank');
                    }
                  }}
                >
                  <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden xs:inline">Open</span>
                </button>
                <button
                  className="flex items-center gap-1.5 sm:gap-2 h-8 sm:h-9 px-3 sm:px-4 bg-white/10 border border-white/10 text-white/80 text-xs sm:text-sm font-medium rounded-full hover:bg-white/20 transition-all backdrop-blur-sm"
                  onClick={() => {
                    if (selectedProject) handleDownloadAll(selectedProject);
                  }}
                >
                  <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden xs:inline">Download</span>
                </button>
                <button
                  className="flex items-center gap-1.5 sm:gap-2 h-8 sm:h-9 px-4 sm:px-5 bg-white text-[hsl(0_0%_8%)] text-xs sm:text-sm font-medium rounded-full hover:bg-white/90 transition-all shadow-lg"
                  onClick={() => {
                    setVideoModalOpen(false);
                    if (selectedProject) {
                      setActiveProjectId(selectedProject.id);
                      navigate('/production');
                    }
                  }}
                >
                  <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
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
