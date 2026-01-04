import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { 
  Plus, Clock, MoreVertical, Trash2, Copy, Edit2, Film, Play, 
  ArrowRight, Sparkles, Zap, X, Download, ExternalLink,
  Layers, Video, Wand2, CheckCircle2, Loader2
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

export default function Projects() {
  const navigate = useNavigate();
  const { projects, activeProjectId, setActiveProjectId, createProject, deleteProject } = useStudio();
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
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
  const totalClips = projects.reduce((acc, p) => acc + (p.video_clips?.length || (p.video_url ? 1 : 0)), 0);

  return (
    <div className="min-h-full bg-background">
      {/* Premium Header */}
      <div className="relative overflow-hidden border-b border-border/40">
        {/* Subtle gradient mesh background */}
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-[600px] h-[400px] bg-gradient-to-bl from-foreground/[0.02] via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[300px] bg-gradient-to-tr from-foreground/[0.015] via-transparent to-transparent" />
        </div>
        
        <div className="relative px-8 lg:px-12 py-12 max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
            {/* Title Section */}
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-foreground/[0.03] border border-foreground/[0.06] backdrop-blur-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-foreground/60" />
                <span className="text-xs font-medium tracking-wide text-foreground/70 uppercase">Studio</span>
              </div>
              
              <div>
                <h1 className="text-5xl lg:text-6xl font-display font-semibold text-foreground tracking-[-0.02em]">
                  Projects
                </h1>
                <p className="text-muted-foreground/80 mt-3 text-lg font-light max-w-md">
                  Create and manage your AI-powered video productions
                </p>
              </div>
            </div>
            
            {/* Create Button */}
            <Button 
              onClick={handleCreateProject}
              className="h-12 px-6 gap-2.5 rounded-full bg-foreground hover:bg-foreground/90 text-background font-medium shadow-[0_2px_20px_-4px] shadow-foreground/20 transition-all hover:shadow-[0_4px_30px_-4px] hover:shadow-foreground/30 hover:-translate-y-0.5"
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              New Project
            </Button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
            {[
              { icon: Layers, value: projects.length, label: 'Total Projects', delay: 0 },
              { icon: CheckCircle2, value: completedCount, label: 'Completed', delay: 1 },
              { icon: Loader2, value: inProgressCount, label: 'Processing', delay: 2, spin: inProgressCount > 0 },
              { icon: Video, value: totalClips, label: 'Video Clips', delay: 3 },
            ].map((stat, i) => (
              <div 
                key={i}
                className="group relative rounded-2xl bg-white/50 dark:bg-white/[0.02] backdrop-blur-xl border border-white/60 dark:border-white/[0.06] p-6 transition-all duration-300 hover:bg-white/70 dark:hover:bg-white/[0.04] hover:shadow-[0_8px_40px_-12px] hover:shadow-foreground/[0.08] hover:-translate-y-0.5 animate-fade-in"
                style={{ animationDelay: `${stat.delay * 75}ms` }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-3xl font-semibold text-foreground tracking-tight">{stat.value}</p>
                    <p className="text-sm text-muted-foreground/70 mt-1 font-medium">{stat.label}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-foreground/[0.04] flex items-center justify-center">
                    <stat.icon className={cn("w-5 h-5 text-foreground/50", stat.spin && "animate-spin")} strokeWidth={1.5} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-8 lg:px-12 py-12 max-w-7xl mx-auto">
        {projects.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="relative mb-10">
              <div className="absolute inset-0 bg-foreground/5 rounded-[32px] blur-3xl scale-150" />
              <div className="relative w-28 h-28 rounded-[28px] bg-gradient-to-br from-foreground/90 to-foreground flex items-center justify-center shadow-[0_20px_60px_-15px] shadow-foreground/30">
                <Film className="w-14 h-14 text-background" strokeWidth={1.5} />
              </div>
            </div>
            
            <h2 className="text-4xl font-display font-semibold text-foreground tracking-tight mb-4">
              Start Creating
            </h2>
            <p className="text-muted-foreground/70 mb-10 max-w-md text-lg font-light">
              Transform your ideas into stunning AI-powered videos
            </p>
            
            <Button 
              onClick={handleCreateProject}
              className="h-12 px-8 gap-2.5 bg-foreground hover:bg-foreground/90 text-background rounded-full font-medium shadow-[0_2px_20px_-4px] shadow-foreground/20 transition-all hover:shadow-[0_4px_30px_-4px] hover:shadow-foreground/30 hover:-translate-y-0.5"
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              Create First Project
            </Button>

            {/* Feature highlights */}
            <div className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-3xl">
              {[
                { icon: Wand2, title: 'AI Script Writing', desc: 'Generate scripts from simple prompts' },
                { icon: Video, title: 'Video Generation', desc: 'Create stunning visual content' },
                { icon: Sparkles, title: 'One-Click Export', desc: 'Download in high quality' },
              ].map((feature, i) => (
                <div key={i} className="text-center group">
                  <div className="w-14 h-14 rounded-2xl bg-foreground/[0.04] border border-foreground/[0.06] flex items-center justify-center mx-auto mb-4 transition-all group-hover:bg-foreground/[0.06] group-hover:scale-105">
                    <feature.icon className="w-6 h-6 text-foreground/60" strokeWidth={1.5} />
                  </div>
                  <h3 className="font-semibold text-foreground text-sm">{feature.title}</h3>
                  <p className="text-xs text-muted-foreground/60 mt-1.5">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Projects Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {projects.map((project, index) => {
              const hasVideo = project.status === 'completed' && (project.video_clips?.length || project.video_url);
              const videoClips = getVideoClips(project);
              const isActive = activeProjectId === project.id;
              
              return (
                <div
                  key={project.id}
                  onClick={() => handleSelectProject(project.id)}
                  className={cn(
                    "group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-500",
                    "bg-white/60 dark:bg-white/[0.03] backdrop-blur-xl",
                    "border border-white/70 dark:border-white/[0.08]",
                    "shadow-[0_2px_20px_-8px] shadow-foreground/[0.06]",
                    "hover:bg-white/80 dark:hover:bg-white/[0.05]",
                    "hover:shadow-[0_12px_50px_-12px] hover:shadow-foreground/[0.12]",
                    "hover:-translate-y-1 hover:border-foreground/10",
                    isActive && "ring-2 ring-foreground/20 border-foreground/20",
                    "animate-fade-in"
                  )}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* Thumbnail */}
                  <div className="aspect-[16/10] relative overflow-hidden bg-gradient-to-br from-muted/50 to-muted">
                    {project.thumbnail_url ? (
                      <img
                        src={project.thumbnail_url}
                        alt={project.name}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : hasVideo && videoClips[0] ? (
                      <video
                        src={videoClips[0]}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
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
                      <div className="absolute inset-0 bg-gradient-to-br from-foreground/[0.03] via-transparent to-foreground/[0.02]">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className={cn(
                            "w-16 h-16 rounded-2xl flex items-center justify-center backdrop-blur-sm transition-all duration-300",
                            "bg-white/70 dark:bg-white/10",
                            project.status === 'generating' || project.status === 'rendering'
                              ? ""
                              : "group-hover:scale-110 group-hover:bg-white/90 dark:group-hover:bg-white/15"
                          )}>
                            {project.status === 'generating' || project.status === 'rendering' ? (
                              <Loader2 className="w-7 h-7 text-foreground/50 animate-spin" strokeWidth={1.5} />
                            ) : (
                              <Film className="w-7 h-7 text-foreground/40 group-hover:text-foreground/60 transition-colors" strokeWidth={1.5} />
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Status Badge */}
                    <div className="absolute top-4 left-4 z-10">
                      <span className={cn(
                        "text-[11px] font-semibold px-3 py-1.5 rounded-full capitalize backdrop-blur-xl tracking-wide",
                        project.status === 'idle' && "bg-white/80 dark:bg-white/10 text-foreground/60 border border-foreground/[0.08]",
                        project.status === 'generating' && "bg-foreground/90 text-background",
                        project.status === 'rendering' && "bg-foreground/80 text-background",
                        project.status === 'completed' && "bg-[hsl(145_50%_40%)] text-white"
                      )}>
                        {project.status === 'completed' ? 'Ready' : project.status === 'generating' ? 'Generating...' : project.status === 'rendering' ? 'Rendering...' : 'Draft'}
                      </span>
                    </div>

                    {/* Clip count */}
                    {hasVideo && videoClips.length > 1 && (
                      <div className="absolute top-4 right-4 z-10">
                        <span className="text-[11px] font-semibold bg-foreground/80 text-background px-2.5 py-1.5 rounded-full backdrop-blur-xl">
                          {videoClips.length} clips
                        </span>
                      </div>
                    )}

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-end justify-center pb-6">
                      <div className="flex items-center gap-2.5">
                        {hasVideo ? (
                          <>
                            <Button 
                              onClick={(e) => handlePlayVideo(project, e)}
                              size="sm"
                              className="gap-2 h-9 px-4 bg-white text-foreground hover:bg-white/95 rounded-full font-medium shadow-xl"
                            >
                              <Play className="w-3.5 h-3.5" fill="currentColor" />
                              Watch
                            </Button>
                            <Button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenProject(project.id);
                              }}
                              variant="outline"
                              size="sm"
                              className="gap-2 h-9 px-4 bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white rounded-full font-medium backdrop-blur-sm"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              Edit
                            </Button>
                          </>
                        ) : (
                          <Button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenProject(project.id);
                            }}
                            size="sm"
                            className="gap-2 h-9 px-5 bg-white text-foreground hover:bg-white/95 rounded-full font-medium shadow-xl"
                          >
                            Continue
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate text-[15px]">
                          {project.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground/60">
                          <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
                          <span className="font-medium">{formatDate(project.updated_at)}</span>
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-muted-foreground/50 hover:text-foreground hover:bg-foreground/5 rounded-xl"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 rounded-xl">
                          {hasVideo && (
                            <>
                              <DropdownMenuItem 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePlayVideo(project, e as any);
                                }}
                                className="gap-2.5 rounded-lg"
                              >
                                <Play className="w-4 h-4" />
                                Watch Video
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadAll(project);
                                }}
                                className="gap-2.5 rounded-lg"
                              >
                                <Download className="w-4 h-4" />
                                Download
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </>
                          )}
                          <DropdownMenuItem 
                            onClick={() => handleOpenProject(project.id)} 
                            className="gap-2.5 rounded-lg"
                          >
                            <Edit2 className="w-4 h-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2.5 rounded-lg">
                            <Copy className="w-4 h-4" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="gap-2.5 rounded-lg text-[hsl(0_55%_50%)] focus:text-[hsl(0_55%_50%)] focus:bg-[hsl(0_50%_97%)]"
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
                "group rounded-2xl border-2 border-dashed transition-all duration-300",
                "border-foreground/[0.08] hover:border-foreground/20",
                "bg-transparent hover:bg-foreground/[0.02]",
                "flex flex-col items-center justify-center min-h-[280px]",
                "animate-fade-in"
              )}
              style={{ animationDelay: `${projects.length * 50}ms` }}
            >
              <div className="w-14 h-14 rounded-2xl bg-foreground/[0.04] group-hover:bg-foreground/[0.08] flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                <Plus className="w-6 h-6 text-foreground/30 group-hover:text-foreground/60 transition-colors" strokeWidth={1.5} />
              </div>
              <span className="mt-4 text-sm font-medium text-foreground/30 group-hover:text-foreground/60 transition-colors">
                New Project
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Video Player Modal */}
      <Dialog open={videoModalOpen} onOpenChange={setVideoModalOpen}>
        <DialogContent className="max-w-5xl w-[95vw] p-0 overflow-hidden bg-black/95 backdrop-blur-2xl border-0 rounded-3xl">
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-5 right-5 z-50 text-white/70 hover:text-white hover:bg-white/10 w-10 h-10 rounded-xl"
              onClick={() => setVideoModalOpen(false)}
            >
              <X className="w-5 h-5" />
            </Button>

            <div className="absolute top-5 left-6 z-50">
              <h3 className="text-white font-semibold text-lg">{selectedProject?.name}</h3>
              <p className="text-white/50 text-sm mt-0.5">
                {selectedProject?.video_clips?.length || 1} clip{(selectedProject?.video_clips?.length || 1) > 1 ? 's' : ''}
              </p>
            </div>

            <div className="aspect-video">
              {selectedProject && (
                <VideoPlaylist
                  clips={getVideoClips(selectedProject)}
                  showControls={true}
                />
              )}
            </div>

            <div className="absolute bottom-20 left-0 right-0 flex items-center justify-center gap-3 z-50">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 h-9 px-4 bg-white/10 border-white/15 text-white hover:bg-white/20 hover:text-white rounded-full backdrop-blur-xl font-medium"
                onClick={() => {
                  if (selectedProject) {
                    const clips = getVideoClips(selectedProject);
                    if (clips[0]) window.open(clips[0], '_blank');
                  }
                }}
              >
                <ExternalLink className="w-4 h-4" />
                Open in Tab
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 h-9 px-4 bg-white/10 border-white/15 text-white hover:bg-white/20 hover:text-white rounded-full backdrop-blur-xl font-medium"
                onClick={() => {
                  if (selectedProject) handleDownloadAll(selectedProject);
                }}
              >
                <Download className="w-4 h-4" />
                Download
              </Button>
              <Button
                size="sm"
                className="gap-2 h-9 px-5 bg-white text-foreground hover:bg-white/95 rounded-full font-medium shadow-xl"
                onClick={() => {
                  setVideoModalOpen(false);
                  if (selectedProject) {
                    setActiveProjectId(selectedProject.id);
                    navigate('/production');
                  }
                }}
              >
                <Edit2 className="w-4 h-4" />
                Edit Project
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
