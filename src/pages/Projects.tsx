import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Plus, MoreVertical, Trash2, Copy, Edit2, Film, Play, 
  ArrowRight, X, Download, ExternalLink, Loader2, Zap,
  Clock, CheckCircle2, ImageIcon, Sparkles,
  User, Coins, ChevronDown, LogOut, Settings, HelpCircle,
  Pencil
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

// Helper to check if URL is a manifest
const isManifestUrl = (url: string): boolean => url?.endsWith('.json');

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

// Simple paused video component - shows video frame instead of thumbnail
function SmartVideoPlayer({ 
  src, 
  className,
  playOnHover = false,
  onVideoClick,
}: {
  src: string;
  className?: string;
  playOnHover?: boolean;
  onVideoClick?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Seek to 1 second to show a frame as the "saver"
  const handleLoadedData = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 1;
    }
  };

  const handleMouseEnter = () => {
    if (!playOnHover || !videoRef.current) return;
    videoRef.current.currentTime = 0;
    videoRef.current.play().catch(() => {});
  };

  const handleMouseLeave = () => {
    if (!playOnHover || !videoRef.current) return;
    videoRef.current.pause();
    videoRef.current.currentTime = 1;
  };

  const handleClick = () => {
    if (onVideoClick) {
      onVideoClick();
    }
  };

  return (
    <div 
      className="relative w-full aspect-video overflow-hidden bg-black cursor-pointer"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      <video
        ref={videoRef}
        src={src}
        className={cn(
          "absolute inset-0 w-full h-full object-cover",
          className
        )}
        loop
        muted
        playsInline
        preload="auto"
        onLoadedData={handleLoadedData}
      />
    </div>
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

  const handlePlayVideo = async (project: Project, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (project.video_clips?.length || project.video_url) {
      setSelectedProject(project);
      setIsLoadingClips(true);
      
      // Resolve clips - check if video_url is a manifest
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

  // Only show completed projects on this page
  const completedProjects = projects.filter(p => p.status === 'completed');
  const completedCount = completedProjects.length;
  const projectsWithoutThumbnails = completedProjects.filter(p => !p.thumbnail_url && (p.video_clips?.length || p.video_url)).length;

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
    <div className="min-h-screen bg-[#0a0a0a] relative overflow-hidden">
      {/* Premium ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Animated gradient orbs */}
        <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-gradient-to-br from-white/[0.03] to-transparent blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-tl from-white/[0.02] to-transparent blur-[150px] animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }} />
        <div className="absolute top-[30%] right-[20%] w-[30vw] h-[30vw] rounded-full bg-gradient-to-bl from-white/[0.015] to-transparent blur-[80px] animate-pulse" style={{ animationDuration: '10s', animationDelay: '4s' }} />
        
        {/* Subtle grid overlay */}
        <div 
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }}
        />
        
        {/* Top edge glow */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
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
              <div className="w-9 h-9 rounded-xl bg-white/[0.08] border border-white/[0.1] flex items-center justify-center group-hover:bg-white/[0.12] transition-colors">
                <Film className="w-4.5 h-4.5 text-white/70" />
              </div>
              <span className="text-base font-semibold text-white/90">Apex-Studio</span>
            </button>

            {/* Center Nav */}
            <div className="hidden sm:flex items-center gap-1">
              {[
                { label: 'Projects', path: '/projects', active: true },
                { label: 'Studio', path: '/studio' },
                { label: 'Clips', path: '/clips' },
                { label: 'Create', path: '/create' },
              ].map((item) => (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-lg transition-all",
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
                className="h-9 px-4 text-sm bg-white text-black hover:bg-white/90 font-semibold"
              >
                <Plus className="w-4 h-4 mr-2" />
                New
              </Button>

              {/* Credits */}
              <button
                onClick={() => navigate('/profile')}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] transition-colors"
              >
                <Coins className="w-4 h-4 text-white/50" />
                <span className="text-sm font-semibold text-white">{profile?.credits_balance?.toLocaleString() || 0}</span>
              </button>

              {/* User Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.05] transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-white/[0.08] border border-white/[0.1] flex items-center justify-center overflow-hidden">
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-4 h-4 text-white/60" />
                      )}
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-white/40" />
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
          <div className="flex items-center gap-2.5 shrink-0 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-medium text-white">{completedCount}</span>
            <span className="text-xs text-white/30">Completed</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 py-6">
        {completedProjects.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-24 sm:py-40 px-4 animate-fade-in-up">
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-white/5 rounded-3xl blur-2xl scale-150" />
              <div className="relative w-24 h-24 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center">
                <Sparkles className="w-10 h-10 text-white/20" strokeWidth={1.5} />
              </div>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3 text-center">No completed projects</h2>
            <p className="text-white/40 text-base sm:text-lg mb-10 text-center max-w-md">
              Completed videos will appear here. Check Studio for in-progress projects.
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
            {completedProjects.map((project, index) => {
              const hasVideo = Boolean(project.video_clips?.length || project.video_url);
              const videoClips = getVideoClips(project);
              const isActive = activeProjectId === project.id;
              
              return (
                <div
                  key={project.id}
                  onClick={() => hasVideo ? handlePlayVideo(project, { stopPropagation: () => {} } as React.MouseEvent) : handleOpenProject(project.id)}
                  className={cn(
                    "group relative cursor-pointer transition-all duration-500 break-inside-avoid mb-4",
                    "rounded-xl overflow-hidden",
                    "hover:-translate-y-1",
                    isActive && "ring-1 ring-white/30",
                    "animate-fade-in"
                  )}
                  style={{ animationDelay: `${Math.min(index * 50, 400)}ms` }}
                >
                  {/* Video/Thumbnail Container - transparent */}
                  <div className="relative overflow-hidden rounded-xl">
                    {hasVideo && videoClips.length > 0 ? (
                      <SmartVideoPlayer
                        src={videoClips.length > 1 ? videoClips[1] : videoClips[0]}
                        className="group-hover:scale-105 transition-transform duration-700"
                        playOnHover={true}
                      />
                    ) : (
                      <div className="aspect-video flex items-center justify-center bg-white/[0.02] rounded-xl border border-white/[0.04]">
                        {project.status === 'generating' || project.status === 'rendering' ? (
                          <div className="relative">
                            <div className="absolute inset-0 bg-amber-500/10 rounded-full blur-xl animate-pulse" />
                            <Loader2 className="relative w-8 h-8 text-amber-400/60 animate-spin" strokeWidth={1.5} />
                          </div>
                        ) : (
                          <Film className="w-8 h-8 text-white/10" strokeWidth={1.5} />
                        )}
                      </div>
                    )}

                    {/* Subtle gradient overlay on hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                    
                    {/* Center play button */}
                    {hasVideo && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                        <div className="w-14 h-14 rounded-full bg-black/40 backdrop-blur-xl flex items-center justify-center border border-white/20 transform scale-90 group-hover:scale-100 transition-transform duration-300">
                          <Play className="w-6 h-6 text-white ml-0.5" fill="currentColor" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Content section - floating below video */}
                  <div className="pt-3 pb-1 relative">
                    {/* Status and action row */}
                    <div className="flex items-center justify-between mb-1.5">
                      {/* Show "Ready" if project has videos, regardless of status */}
                      {hasVideo ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span className="text-[11px] font-medium text-emerald-400/80">Ready</span>
                        </div>
                      ) : project.status === 'completed' ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span className="text-[11px] font-medium text-emerald-400/80">Ready</span>
                        </div>
                      ) : project.status === 'generating' || project.status === 'rendering' ? (
                        <div className="flex items-center gap-1.5">
                          <Loader2 className="w-2.5 h-2.5 text-amber-400 animate-spin" />
                          <span className="text-[11px] font-medium text-amber-400/80">Processing</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
                          <span className="text-[11px] font-medium text-white/40">Draft</span>
                        </div>
                      )}
                      
                      {/* Action menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="h-6 w-6 flex items-center justify-center rounded-md text-white/30 hover:text-white/70 hover:bg-white/5 transition-all"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40 rounded-xl bg-black/95 border-white/10 shadow-2xl backdrop-blur-2xl p-1">
                          {hasVideo && (
                            <>
                              <DropdownMenuItem 
                                onClick={(e) => { e.stopPropagation(); handlePlayVideo(project); }}
                                className="gap-2 text-sm text-white/70 focus:text-white focus:bg-white/10 rounded-lg py-2 px-3"
                              >
                                <Play className="w-3.5 h-3.5" />
                                Play
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={(e) => { e.stopPropagation(); handleDownloadAll(project); }}
                                className="gap-2 text-sm text-white/70 focus:text-white focus:bg-white/10 rounded-lg py-2 px-3"
                              >
                                <Download className="w-3.5 h-3.5" />
                                Download
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-white/10 my-1" />
                            </>
                          )}
                          <DropdownMenuItem 
                            onClick={(e) => { e.stopPropagation(); handleRenameProject(project); }} 
                            className="gap-2 text-sm text-white/70 focus:text-white focus:bg-white/10 rounded-lg py-2 px-3"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => { e.stopPropagation(); handleOpenProject(project.id); }} 
                            className="gap-2 text-sm text-white/70 focus:text-white focus:bg-white/10 rounded-lg py-2 px-3"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="gap-2 text-sm text-white/70 focus:text-white focus:bg-white/10 rounded-lg py-2 px-3"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Copy className="w-3.5 h-3.5" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-white/10 my-1" />
                          <DropdownMenuItem
                            className="gap-2 text-sm text-red-400 focus:text-red-300 focus:bg-red-500/10 rounded-lg py-2 px-3"
                            onClick={(e) => { e.stopPropagation(); deleteProject(project.id); }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    
                    {/* Title */}
                    <h3 className="font-medium text-white/90 text-sm truncate group-hover:text-white transition-colors">
                      {project.name}
                    </h3>
                    
                    {/* Meta info */}
                    <div className="flex items-center gap-2 text-white/30 text-[11px] mt-1">
                      <span>{formatDate(project.updated_at)}</span>
                      {hasVideo && (
                        <>
                          <span>•</span>
                          <span>{videoClips.length} clip{videoClips.length > 1 ? 's' : ''}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* New Project Card */}
            <div
              onClick={handleCreateProject}
              className={cn(
                "group relative cursor-pointer transition-all duration-500",
                "rounded-2xl overflow-hidden",
                "border border-dashed border-white/[0.08] hover:border-white/20",
                "bg-gradient-to-b from-white/[0.02] to-transparent",
                "hover:shadow-lg hover:shadow-white/[0.02]",
                "hover:-translate-y-1",
                "animate-fade-in"
              )}
              style={{ animationDelay: `${Math.min(projects.length * 50, 400)}ms` }}
            >
              <div className="aspect-video flex flex-col items-center justify-center p-6">
                <div className="relative mb-3">
                  <div className="absolute inset-0 bg-white/5 rounded-full blur-xl scale-150 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative w-12 h-12 rounded-xl bg-white/[0.04] group-hover:bg-white/[0.08] border border-white/[0.08] group-hover:border-white/20 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                    <Plus className="w-5 h-5 text-white/25 group-hover:text-white/60 transition-colors" strokeWidth={1.5} />
                  </div>
                </div>
                <span className="text-sm font-medium text-white/25 group-hover:text-white/60 transition-colors">
                  New Project
                </span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Fullscreen Video Player */}
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
      {isLoadingClips && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-white" />
            <p className="text-white/70">Loading video...</p>
          </div>
        </div>
      )}

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-md bg-black/95 border-white/10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Pencil className="w-4 h-4" />
              Rename Project
            </DialogTitle>
            <DialogDescription className="text-white/60">
              Enter a new name for your project
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="project-name" className="text-white/80">Project Name</Label>
              <Input
                id="project-name"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Enter project name"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newProjectName.trim()) {
                    handleConfirmRename();
                  }
                }}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setRenameDialogOpen(false)}
              className="border-white/10 text-white/70 hover:bg-white/5"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmRename}
              disabled={!newProjectName.trim()}
              className="bg-white text-black hover:bg-white/90"
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
