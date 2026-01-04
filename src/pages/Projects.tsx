import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { 
  Plus, MoreVertical, Trash2, Copy, Edit2, Film, Play, 
  ArrowRight, X, Download, ExternalLink, Loader2
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
    <div className="min-h-full bg-[hsl(0_0%_4%)]">
      {/* Minimal Top Bar */}
      <div className="relative border-b border-white/[0.06]">
        <div className="px-6 lg:px-10 py-6 max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            {/* Stats Row */}
            <div className="flex items-center gap-6">
              {[
                { value: projects.length, label: 'Projects' },
                { value: completedCount, label: 'Complete' },
                { value: inProgressCount, label: 'Active', pulse: inProgressCount > 0 },
              ].map((stat, i) => (
                <div key={i} className="flex items-center gap-2">
                  {stat.pulse && <div className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse" />}
                  <span className="text-white/90 font-medium tabular-nums">{stat.value}</span>
                  <span className="text-white/40 text-sm">{stat.label}</span>
                </div>
              ))}
            </div>
            
            {/* Create */}
            <button 
              onClick={handleCreateProject}
              className="flex items-center gap-2 h-8 px-4 rounded-full bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.08] text-white/80 hover:text-white text-sm font-medium transition-all"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2} />
              <span>New</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 lg:px-10 py-8 max-w-7xl mx-auto">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-6">
              <Film className="w-5 h-5 text-white/30" strokeWidth={1.5} />
            </div>
            <p className="text-white/40 text-sm mb-6">No projects yet</p>
            <button 
              onClick={handleCreateProject}
              className="flex items-center gap-2 h-8 px-4 rounded-full bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.08] text-white/70 hover:text-white text-sm font-medium transition-all"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2} />
              Create project
            </button>
          </div>
        ) : (
          /* Projects Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {projects.map((project, index) => {
              const hasVideo = project.status === 'completed' && (project.video_clips?.length || project.video_url);
              const videoClips = getVideoClips(project);
              const isActive = activeProjectId === project.id;
              
              return (
                <div
                  key={project.id}
                  onClick={() => handleSelectProject(project.id)}
                  className={cn(
                    "group relative rounded-xl overflow-hidden cursor-pointer transition-all duration-300",
                    "bg-white/[0.03] backdrop-blur-md",
                    "border border-white/[0.06]",
                    "hover:bg-white/[0.05] hover:border-white/[0.1]",
                    isActive && "ring-1 ring-white/20 border-white/15",
                    "animate-fade-in"
                  )}
                  style={{ animationDelay: `${index * 40}ms` }}
                >
                  {/* Thumbnail */}
                  <div className="aspect-[16/9] relative overflow-hidden bg-[hsl(0_0%_8%)]">
                    {project.thumbnail_url ? (
                      <img
                        src={project.thumbnail_url}
                        alt={project.name}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                      />
                    ) : hasVideo && videoClips[0] ? (
                      <video
                        src={videoClips[0]}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
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
                      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent">
                        <div className="absolute inset-0 flex items-center justify-center">
                          {project.status === 'generating' || project.status === 'rendering' ? (
                            <Loader2 className="w-5 h-5 text-white/20 animate-spin" strokeWidth={1.5} />
                          ) : (
                            <Film className="w-5 h-5 text-white/15" strokeWidth={1.5} />
                          )}
                        </div>
                      </div>
                    )}

                    {/* Status indicator */}
                    <div className="absolute top-3 left-3 z-10">
                      {project.status === 'completed' ? (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[hsl(145_40%_25%/0.9)] backdrop-blur-sm">
                          <div className="w-1.5 h-1.5 rounded-full bg-[hsl(145_50%_55%)]" />
                          <span className="text-[10px] font-medium text-[hsl(145_30%_80%)] uppercase tracking-wide">Ready</span>
                        </div>
                      ) : project.status === 'generating' || project.status === 'rendering' ? (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.08] backdrop-blur-sm">
                          <div className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse" />
                          <span className="text-[10px] font-medium text-white/60 uppercase tracking-wide">Processing</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.06] backdrop-blur-sm">
                          <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
                          <span className="text-[10px] font-medium text-white/40 uppercase tracking-wide">Draft</span>
                        </div>
                      )}
                    </div>

                    {/* Clip count */}
                    {hasVideo && videoClips.length > 1 && (
                      <div className="absolute top-3 right-3 z-10">
                        <span className="text-[10px] font-medium bg-black/60 text-white/80 px-2 py-1 rounded-md backdrop-blur-sm">
                          {videoClips.length}
                        </span>
                      </div>
                    )}

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-end justify-center pb-4">
                      <div className="flex items-center gap-2">
                        {hasVideo ? (
                          <>
                            <button 
                              onClick={(e) => handlePlayVideo(project, e)}
                              className="flex items-center gap-1.5 h-7 px-3 bg-white text-black text-xs font-medium rounded-md hover:bg-white/90 transition-colors"
                            >
                              <Play className="w-3 h-3" fill="currentColor" />
                              Play
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenProject(project.id);
                              }}
                              className="flex items-center gap-1.5 h-7 px-3 bg-white/15 text-white text-xs font-medium rounded-md hover:bg-white/25 transition-colors backdrop-blur-sm"
                            >
                              <Edit2 className="w-3 h-3" />
                              Edit
                            </button>
                          </>
                        ) : (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenProject(project.id);
                            }}
                            className="flex items-center gap-1.5 h-7 px-3 bg-white text-black text-xs font-medium rounded-md hover:bg-white/90 transition-colors"
                          >
                            Open
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-white/90 truncate text-sm">
                          {project.name}
                        </h3>
                        <p className="text-xs text-white/30 mt-1">
                          {formatDate(project.updated_at)}
                        </p>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="h-6 w-6 shrink-0 flex items-center justify-center rounded-md text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40 rounded-lg bg-[hsl(0_0%_10%)] border-white/[0.08]">
                          {hasVideo && (
                            <>
                              <DropdownMenuItem 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePlayVideo(project, e as any);
                                }}
                                className="gap-2 text-xs text-white/70 focus:text-white focus:bg-white/[0.06]"
                              >
                                <Play className="w-3.5 h-3.5" />
                                Play
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadAll(project);
                                }}
                                className="gap-2 text-xs text-white/70 focus:text-white focus:bg-white/[0.06]"
                              >
                                <Download className="w-3.5 h-3.5" />
                                Download
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-white/[0.06]" />
                            </>
                          )}
                          <DropdownMenuItem 
                            onClick={() => handleOpenProject(project.id)} 
                            className="gap-2 text-xs text-white/70 focus:text-white focus:bg-white/[0.06]"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 text-xs text-white/70 focus:text-white focus:bg-white/[0.06]">
                            <Copy className="w-3.5 h-3.5" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-white/[0.06]" />
                          <DropdownMenuItem
                            className="gap-2 text-xs text-[hsl(0_50%_60%)] focus:text-[hsl(0_50%_65%)] focus:bg-[hsl(0_50%_50%/0.1)]"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteProject(project.id);
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
                "group rounded-xl border border-dashed transition-all duration-300",
                "border-white/[0.08] hover:border-white/[0.15]",
                "bg-transparent hover:bg-white/[0.02]",
                "flex flex-col items-center justify-center min-h-[200px]",
                "animate-fade-in"
              )}
              style={{ animationDelay: `${projects.length * 40}ms` }}
            >
              <div className="w-10 h-10 rounded-lg bg-white/[0.04] group-hover:bg-white/[0.06] flex items-center justify-center transition-all duration-300">
                <Plus className="w-4 h-4 text-white/25 group-hover:text-white/50 transition-colors" strokeWidth={1.5} />
              </div>
              <span className="mt-3 text-xs font-medium text-white/25 group-hover:text-white/50 transition-colors">
                New
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Video Player Modal */}
      <Dialog open={videoModalOpen} onOpenChange={setVideoModalOpen}>
        <DialogContent className="max-w-4xl w-[90vw] p-0 overflow-hidden bg-[hsl(0_0%_6%)] border border-white/[0.08] rounded-xl">
          <div className="relative">
            <button
              className="absolute top-4 right-4 z-50 text-white/50 hover:text-white/80 transition-colors"
              onClick={() => setVideoModalOpen(false)}
            >
              <X className="w-4 h-4" />
            </button>

            <div className="absolute top-4 left-5 z-50">
              <h3 className="text-white/90 font-medium text-sm">{selectedProject?.name}</h3>
              <p className="text-white/40 text-xs mt-0.5">
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

            <div className="absolute bottom-16 left-0 right-0 flex items-center justify-center gap-2 z-50">
              <button
                className="flex items-center gap-1.5 h-7 px-3 bg-white/10 border border-white/10 text-white/80 text-xs font-medium rounded-md hover:bg-white/15 transition-colors backdrop-blur-sm"
                onClick={() => {
                  if (selectedProject) {
                    const clips = getVideoClips(selectedProject);
                    if (clips[0]) window.open(clips[0], '_blank');
                  }
                }}
              >
                <ExternalLink className="w-3 h-3" />
                Open
              </button>
              <button
                className="flex items-center gap-1.5 h-7 px-3 bg-white/10 border border-white/10 text-white/80 text-xs font-medium rounded-md hover:bg-white/15 transition-colors backdrop-blur-sm"
                onClick={() => {
                  if (selectedProject) handleDownloadAll(selectedProject);
                }}
              >
                <Download className="w-3 h-3" />
                Download
              </button>
              <button
                className="flex items-center gap-1.5 h-7 px-3 bg-white text-black text-xs font-medium rounded-md hover:bg-white/90 transition-colors"
                onClick={() => {
                  setVideoModalOpen(false);
                  if (selectedProject) {
                    setActiveProjectId(selectedProject.id);
                    navigate('/production');
                  }
                }}
              >
                <Edit2 className="w-3 h-3" />
                Edit
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
