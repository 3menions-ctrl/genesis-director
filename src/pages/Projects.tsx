import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { 
  Plus, Clock, MoreVertical, Trash2, Copy, Edit2, Film, Play, 
  ArrowRight, Sparkles, Zap, X, Download, ExternalLink,
  Layers, Video, Wand2
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
    <div className="min-h-full">
      {/* Hero Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-foreground/5 via-transparent to-foreground/5" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-foreground/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative px-6 lg:px-8 py-8 max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            {/* Title Section */}
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-foreground/5 border border-foreground/10">
                <Video className="w-3.5 h-3.5 text-foreground" />
                <span className="text-xs font-medium text-foreground">AI Video Studio</span>
              </div>
              
              <div>
                <h1 className="text-4xl lg:text-5xl font-display font-bold text-foreground tracking-tight">
                  Your Projects
                </h1>
                <p className="text-muted-foreground mt-2 text-lg max-w-lg">
                  Create, manage, and export stunning AI-generated videos
                </p>
              </div>
            </div>
            
            {/* Create Button */}
            <Button 
              onClick={handleCreateProject}
              size="icon"
              className="h-11 w-11 rounded-xl bg-foreground hover:bg-foreground/90 text-background shadow-lg shadow-foreground/10 transition-all hover:shadow-xl hover:shadow-foreground/15 hover:scale-105"
            >
              <Plus className="w-5 h-5" />
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <div className="relative overflow-hidden rounded-2xl bg-card/70 backdrop-blur-sm border border-border p-5 transition-all hover:shadow-lg hover:border-foreground/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-foreground/5 flex items-center justify-center">
                  <Layers className="w-5 h-5 text-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{projects.length}</p>
                  <p className="text-xs text-muted-foreground">Total Projects</p>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl bg-card/70 backdrop-blur-sm border border-border p-5 transition-all hover:shadow-lg hover:border-foreground/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-foreground/5 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{completedCount}</p>
                  <p className="text-xs text-muted-foreground">Videos Ready</p>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl bg-card/70 backdrop-blur-sm border border-border p-5 transition-all hover:shadow-lg hover:border-foreground/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-foreground/5 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{inProgressCount}</p>
                  <p className="text-xs text-muted-foreground">Processing</p>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl bg-card/70 backdrop-blur-sm border border-border p-5 transition-all hover:shadow-lg hover:border-foreground/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-foreground/5 flex items-center justify-center">
                  <Video className="w-5 h-5 text-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{totalClips}</p>
                  <p className="text-xs text-muted-foreground">Total Clips</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 lg:px-8 pb-12 max-w-7xl mx-auto">
        {projects.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-foreground/10 rounded-3xl blur-2xl scale-150" />
              <div className="relative w-24 h-24 rounded-3xl bg-foreground flex items-center justify-center">
                <Film className="w-12 h-12 text-background" />
              </div>
            </div>
            
            <h2 className="text-3xl font-display font-bold text-foreground mb-3">
              Start Creating
            </h2>
            <p className="text-muted-foreground mb-8 max-w-md text-lg">
              Transform your ideas into stunning AI-powered videos in just a few clicks
            </p>
            
            <Button 
              onClick={handleCreateProject}
              className="gap-2 bg-foreground hover:bg-foreground/90 text-background shadow-lg shadow-foreground/10 rounded-xl"
            >
              <Plus className="w-4 h-4" />
              Create
            </Button>

            {/* Feature highlights */}
            <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-2xl">
              {[
                { icon: Wand2, title: 'AI Script Writing', desc: 'Generate scripts instantly' },
                { icon: Video, title: 'Video Generation', desc: 'Create stunning visuals' },
                { icon: Sparkles, title: 'One-Click Export', desc: 'Download in 4K quality' },
              ].map((feature, i) => (
                <div key={i} className="text-center p-4">
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
                    <feature.icon className="w-6 h-6 text-foreground" />
                  </div>
                  <h3 className="font-semibold text-foreground text-sm">{feature.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Projects Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pt-2">
            {projects.map((project, index) => {
              const hasVideo = project.status === 'completed' && (project.video_clips?.length || project.video_url);
              const videoClips = getVideoClips(project);
              const isActive = activeProjectId === project.id;
              
              return (
                <div
                  key={project.id}
                  onClick={() => handleSelectProject(project.id)}
                  className={cn(
                    "group relative rounded-2xl bg-card/70 backdrop-blur-sm border border-border overflow-hidden cursor-pointer transition-all duration-300",
                    "hover:border-foreground/20 hover:shadow-xl hover:shadow-foreground/5 hover:-translate-y-1",
                    isActive && "ring-2 ring-foreground border-foreground/30",
                    "animate-fade-in"
                  )}
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  {/* Thumbnail */}
                  <div className="aspect-[16/10] relative overflow-hidden bg-muted">
                    {project.thumbnail_url ? (
                      <img
                        src={project.thumbnail_url}
                        alt={project.name}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                    ) : hasVideo && videoClips[0] ? (
                      <video
                        src={videoClips[0]}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
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
                      <div className="absolute inset-0 bg-gradient-to-br from-foreground/10 via-muted to-foreground/5">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className={cn(
                            "w-16 h-16 rounded-2xl flex items-center justify-center backdrop-blur-sm transition-all",
                            project.status === 'generating' || project.status === 'rendering'
                              ? "bg-background/90"
                              : "bg-background/70 group-hover:bg-background/90 group-hover:scale-110"
                          )}>
                            {project.status === 'generating' || project.status === 'rendering' ? (
                              <div className="w-7 h-7 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
                            ) : (
                              <Film className="w-7 h-7 text-muted-foreground group-hover:text-foreground transition-colors" />
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Status Badge */}
                    <div className="absolute top-3 left-3 z-10">
                      <span className={cn(
                        "text-xs font-semibold px-2.5 py-1 rounded-full capitalize backdrop-blur-sm",
                        project.status === 'idle' && "bg-muted/90 text-muted-foreground",
                        project.status === 'generating' && "bg-foreground/90 text-background",
                        project.status === 'rendering' && "bg-foreground/80 text-background",
                        project.status === 'completed' && "bg-foreground text-background"
                      )}>
                        {project.status === 'completed' ? '✓ Ready' : project.status}
                      </span>
                    </div>

                    {/* Clip count */}
                    {hasVideo && videoClips.length > 1 && (
                      <div className="absolute top-3 right-3 z-10">
                        <span className="text-xs font-medium bg-foreground/80 text-background px-2 py-1 rounded-md backdrop-blur-sm">
                          {videoClips.length} clips
                        </span>
                      </div>
                    )}

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-end justify-center pb-6">
                      <div className="flex items-center gap-2">
                        {hasVideo ? (
                          <>
                            <Button 
                              onClick={(e) => handlePlayVideo(project, e)}
                              size="sm"
                              className="gap-1.5 bg-white text-foreground hover:bg-white/90 shadow-lg"
                            >
                              <Play className="w-4 h-4" fill="currentColor" />
                              Watch
                            </Button>
                            <Button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenProject(project.id);
                              }}
                              variant="outline"
                              size="sm"
                              className="gap-1.5 bg-transparent border-white/30 text-white hover:bg-white/10 hover:text-white"
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
                            className="gap-1.5 bg-white text-foreground hover:bg-white/90 shadow-lg"
                          >
                            Continue
                            <ArrowRight className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate group-hover:text-foreground transition-colors">
                          {project.name}
                        </h3>
                        <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{formatDate(project.updated_at)}</span>
                          </div>
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          {hasVideo && (
                            <>
                              <DropdownMenuItem 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePlayVideo(project, e as any);
                                }}
                                className="gap-2"
                              >
                                <Play className="w-4 h-4" />
                                Watch Video
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadAll(project);
                                }}
                                className="gap-2"
                              >
                                <Download className="w-4 h-4" />
                                Download
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </>
                          )}
                          <DropdownMenuItem 
                            onClick={() => handleOpenProject(project.id)} 
                            className="gap-2"
                          >
                            <Edit2 className="w-4 h-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2">
                            <Copy className="w-4 h-4" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="gap-2 text-destructive focus:text-destructive"
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
                "border-border hover:border-foreground/30",
                "bg-transparent hover:bg-foreground/5",
                "flex flex-col items-center justify-center min-h-[280px]",
                "animate-fade-in"
              )}
              style={{ animationDelay: `${projects.length * 60}ms` }}
            >
              <div className="w-12 h-12 rounded-xl bg-muted group-hover:bg-foreground/10 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                <Plus className="w-6 h-6 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Video Player Modal */}
      <Dialog open={videoModalOpen} onOpenChange={setVideoModalOpen}>
        <DialogContent className="max-w-5xl w-[95vw] p-0 overflow-hidden bg-black border-0">
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-50 text-white hover:bg-white/20 w-10 h-10"
              onClick={() => setVideoModalOpen(false)}
            >
              <X className="w-5 h-5" />
            </Button>

            <div className="absolute top-4 left-4 z-50">
              <h3 className="text-white font-semibold text-lg">{selectedProject?.name}</h3>
              <p className="text-white/60 text-sm">
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
                className="gap-2 bg-black/50 border-white/20 text-white hover:bg-black/70 hover:text-white backdrop-blur-sm"
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
                className="gap-2 bg-black/50 border-white/20 text-white hover:bg-black/70 hover:text-white backdrop-blur-sm"
                onClick={() => {
                  if (selectedProject) handleDownloadAll(selectedProject);
                }}
              >
                <Download className="w-4 h-4" />
                Download
              </Button>
              <Button
                size="sm"
                className="gap-2 bg-white text-foreground hover:bg-white/90"
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
