import { useNavigate } from 'react-router-dom';
import { 
  Plus, Clock, MoreVertical, Trash2, Copy, Edit2, Film, Play, 
  ArrowRight, Sparkles, TrendingUp, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useStudio } from '@/contexts/StudioContext';
import { cn } from '@/lib/utils';

export default function Projects() {
  const navigate = useNavigate();
  const { projects, activeProjectId, setActiveProjectId, createProject, deleteProject } = useStudio();

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

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-10 animate-fade-in-up">
        <div className="flex items-start justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="icon-box p-2.5">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-violet-600 bg-violet-50 px-3 py-1 rounded-full flex items-center gap-1.5">
                <TrendingUp className="w-3 h-3" />
                3 videos this week
              </span>
            </div>
            <div>
              <h1 className="text-3xl lg:text-4xl font-display font-bold text-gray-900">
                Your <span className="text-gradient">Projects</span>
              </h1>
              <p className="text-gray-500 mt-1 max-w-xl">
                Create stunning AI-powered videos in minutes with our next-gen studio
              </p>
            </div>
          </div>
          
          <Button 
            onClick={handleCreateProject} 
            className="gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-lg shadow-violet-500/25 shrink-0"
          >
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        </div>
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in-up">
          <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center mb-6">
            <Film className="w-10 h-10 text-gray-400" />
          </div>
          <h2 className="text-2xl font-display font-bold text-gray-900 mb-2">No projects yet</h2>
          <p className="text-gray-500 mb-8 max-w-md">
            Create your first AI video project and bring your ideas to life
          </p>
          <Button 
            onClick={handleCreateProject} 
            className="gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-lg shadow-violet-500/25"
          >
            <Zap className="w-4 h-4" />
            Create Your First Project
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {projects.map((project, index) => (
            <div
              key={project.id}
              onClick={() => handleSelectProject(project.id)}
              className={cn(
                "group relative card-clean cursor-pointer animate-fade-in-up",
                activeProjectId === project.id && "ring-2 ring-violet-500/40 border-violet-200"
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Thumbnail */}
              <div className="aspect-video relative overflow-hidden bg-gradient-to-br from-gray-100 to-gray-50 rounded-t-2xl">
                {project.status === 'completed' ? (
                  <div 
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                    style={{
                      backgroundImage: `linear-gradient(to bottom, transparent 50%, white),
                        url('https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=60')`,
                    }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className={cn(
                      "w-14 h-14 rounded-xl flex items-center justify-center transition-all",
                      project.status === 'generating' || project.status === 'rendering'
                        ? "bg-violet-100"
                        : "bg-gray-200/80 group-hover:bg-violet-100"
                    )}>
                      {project.status === 'generating' || project.status === 'rendering' ? (
                        <div className="w-6 h-6 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
                      ) : (
                        <Play className="w-6 h-6 text-gray-400 group-hover:text-violet-600 transition-colors" />
                      )}
                    </div>
                  </div>
                )}

                {/* Status Badge */}
                <div className="absolute top-3 left-3 z-10">
                  <span className={cn(
                    "text-xs font-medium px-2.5 py-1 rounded-full capitalize",
                    project.status === 'idle' && "bg-gray-100 text-gray-600",
                    project.status === 'generating' && "bg-violet-100 text-violet-700",
                    project.status === 'rendering' && "bg-amber-100 text-amber-700",
                    project.status === 'completed' && "bg-emerald-100 text-emerald-700"
                  )}>
                    {project.status}
                  </span>
                </div>

                {/* Duration */}
                {project.duration_seconds && (
                  <div className="absolute bottom-3 right-3 z-10">
                    <span className="text-xs font-mono bg-black/60 text-white px-2 py-1 rounded-md backdrop-blur-sm">
                      {Math.floor(project.duration_seconds / 60)}:{String(project.duration_seconds % 60).padStart(2, '0')}
                    </span>
                  </div>
                )}

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-white/95 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
                  <Button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenProject(project.id);
                    }}
                    className="gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-lg"
                  >
                    Open Project
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate mb-1.5 group-hover:text-violet-700 transition-colors">
                      {project.name}
                    </h3>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatDate(project.updated_at)}</span>
                      </div>
                      {project.credits_used && (
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>{project.credits_used.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-white border-gray-200 shadow-xl p-1.5 z-50">
                      <DropdownMenuItem 
                        onClick={() => handleOpenProject(project.id)} 
                        className="gap-2 py-2 rounded-lg cursor-pointer text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2 py-2 rounded-lg cursor-pointer text-gray-700 hover:text-gray-900 hover:bg-gray-50">
                        <Copy className="w-4 h-4" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-gray-100" />
                      <DropdownMenuItem
                        className="gap-2 py-2 rounded-lg cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-50"
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

              {/* Active indicator */}
              {activeProjectId === project.id && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 to-purple-500 rounded-b-2xl" />
              )}
            </div>
          ))}

          {/* New Project Card */}
          <button
            onClick={handleCreateProject}
            className={cn(
              "group rounded-2xl border-2 border-dashed transition-all duration-300",
              "border-gray-200 hover:border-violet-300",
              "bg-transparent hover:bg-violet-50/50",
              "flex flex-col items-center justify-center p-10 min-h-[280px]",
              "animate-fade-in-up"
            )}
            style={{ animationDelay: `${projects.length * 50}ms` }}
          >
            <div className="w-14 h-14 rounded-xl bg-gray-100 group-hover:bg-violet-100 flex items-center justify-center transition-all mb-4 group-hover:scale-110">
              <Plus className="w-7 h-7 text-gray-400 group-hover:text-violet-600 transition-all" />
            </div>
            <p className="font-semibold text-gray-600 group-hover:text-gray-900 transition-colors">
              Create New Project
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Start from scratch
            </p>
          </button>
        </div>
      )}
    </div>
  );
}
