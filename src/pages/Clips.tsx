import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { 
  Film, Play, Download, MoreVertical, Trash2, 
  Loader2, CheckCircle2, XCircle, Clock, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { FullscreenVideoPlayer } from '@/components/studio/FullscreenVideoPlayer';

interface VideoClip {
  id: string;
  prompt: string;
  status: string;
  video_url: string | null;
  shot_index: number;
  duration_seconds: number | null;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
  project_id: string;
  project_title?: string;
}

export default function Clips() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [clips, setClips] = useState<VideoClip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedClip, setSelectedClip] = useState<VideoClip | null>(null);
  const [videoModalOpen, setVideoModalOpen] = useState(false);

  useEffect(() => {
    const loadClips = async () => {
      if (!user) return;
      
      // Get clips with project titles
      const { data, error } = await supabase
        .from('video_clips')
        .select(`
          id, prompt, status, video_url, shot_index, duration_seconds, 
          created_at, completed_at, error_message, project_id,
          movie_projects!inner(title)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error loading clips:', error);
        toast.error('Failed to load clips');
      } else {
        const clipsWithTitles = (data || []).map((clip: any) => ({
          ...clip,
          project_title: clip.movie_projects?.title || 'Unknown Project'
        }));
        setClips(clipsWithTitles);
      }
      setIsLoading(false);
    };

    loadClips();
  }, [user]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed':
        return { 
          label: 'Completed', 
          icon: CheckCircle2, 
          color: 'text-emerald-400', 
          bgColor: 'bg-emerald-500/20'
        };
      case 'generating':
      case 'pending':
        return { 
          label: status === 'generating' ? 'Generating' : 'Pending', 
          icon: Loader2, 
          color: 'text-amber-400', 
          bgColor: 'bg-amber-500/20',
          animate: status === 'generating'
        };
      case 'failed':
        return { 
          label: 'Failed', 
          icon: XCircle, 
          color: 'text-red-400', 
          bgColor: 'bg-red-500/20'
        };
      default:
        return { 
          label: status, 
          icon: Clock, 
          color: 'text-white/50', 
          bgColor: 'bg-white/10'
        };
    }
  };

  const handlePlayClip = (clip: VideoClip) => {
    if (clip.video_url) {
      setSelectedClip(clip);
      setVideoModalOpen(true);
    }
  };

  const handleDownload = async (clip: VideoClip) => {
    if (!clip.video_url) return;
    
    try {
      const response = await fetch(clip.video_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `clip-${clip.shot_index + 1}-${clip.id.substring(0, 8)}.mp4`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Download started');
    } catch (error) {
      window.open(clip.video_url, '_blank');
    }
  };

  const handleDelete = async (clipId: string) => {
    const { error } = await supabase
      .from('video_clips')
      .delete()
      .eq('id', clipId);

    if (error) {
      toast.error('Failed to delete clip');
    } else {
      setClips(prev => prev.filter(c => c.id !== clipId));
      toast.success('Clip deleted');
    }
  };

  const completedCount = clips.filter(c => c.status === 'completed').length;
  const pendingCount = clips.filter(c => c.status === 'pending' || c.status === 'generating').length;
  const failedCount = clips.filter(c => c.status === 'failed').length;

  return (
    <div className="min-h-screen bg-[#0a0a0a] relative overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-gradient-to-bl from-emerald-500/[0.03] to-transparent blur-[120px]" />
      </div>

      {/* Header */}
      <nav className="sticky top-0 z-50 bg-black/80 backdrop-blur-2xl border-b border-white/[0.05]">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <Film className="w-4.5 h-4.5 text-emerald-400" />
            </div>
            <span className="text-base font-semibold text-white/90">Clips Gallery</span>
          </div>

          <div className="flex items-center gap-1">
            {[
              { label: 'Projects', path: '/projects' },
              { label: 'Studio', path: '/studio' },
              { label: 'Clips', path: '/clips', active: true },
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
        </div>
      </nav>

      {/* Stats */}
      <div className="sticky top-14 z-40 bg-black/60 backdrop-blur-xl border-b border-white/[0.04]">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-medium text-white">{completedCount}</span>
            <span className="text-xs text-white/30">Completed</span>
          </div>
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Loader2 className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-white">{pendingCount}</span>
            <span className="text-xs text-white/30">Pending</span>
          </div>
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <XCircle className="w-4 h-4 text-red-400" />
            <span className="text-sm font-medium text-white">{failedCount}</span>
            <span className="text-xs text-white/30">Failed</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-white/50" />
          </div>
        ) : clips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-4">
            <div className="w-20 h-20 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center mb-6">
              <Film className="w-8 h-8 text-white/20" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">No clips yet</h2>
            <p className="text-white/40 text-base mb-8 text-center max-w-md">
              Generated video clips will appear here.
            </p>
            <Button onClick={() => navigate('/create')} className="bg-white text-black hover:bg-white/90">
              Create Videos
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {clips.map((clip) => {
              const statusConfig = getStatusConfig(clip.status);
              const StatusIcon = statusConfig.icon;

              return (
                <div
                  key={clip.id}
                  className="group relative bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden hover:border-white/[0.12] transition-all"
                >
                  {/* Video Thumbnail */}
                  <div 
                    className="aspect-video bg-black/50 relative cursor-pointer"
                    onClick={() => clip.video_url && handlePlayClip(clip)}
                  >
                    {clip.video_url ? (
                      <video 
                        src={clip.video_url} 
                        className="w-full h-full object-cover"
                        muted
                        preload="metadata"
                        onLoadedData={(e) => {
                          (e.target as HTMLVideoElement).currentTime = 1;
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Film className="w-8 h-8 text-white/10" />
                      </div>
                    )}
                    
                    {/* Play overlay */}
                    {clip.video_url && (
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                          <Play className="w-5 h-5 text-white fill-white" />
                        </div>
                      </div>
                    )}
                    
                    {/* Status Badge */}
                    <div className="absolute top-2 left-2">
                      <Badge className={cn("gap-1 text-[10px] px-1.5 py-0.5", statusConfig.bgColor, statusConfig.color, "border-0")}>
                        <StatusIcon className={cn("w-2.5 h-2.5", statusConfig.animate && "animate-spin")} />
                        {statusConfig.label}
                      </Badge>
                    </div>

                    {/* Shot number */}
                    <div className="absolute top-2 right-2">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 bg-black/50 border-white/20">
                        Shot {clip.shot_index + 1}
                      </Badge>
                    </div>

                    {/* Duration */}
                    {clip.duration_seconds && (
                      <div className="absolute bottom-2 right-2">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 bg-black/50 border-white/20">
                          {clip.duration_seconds}s
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <p className="text-xs text-white/40 truncate mb-1">{clip.project_title}</p>
                    <p className="text-xs text-white/60 line-clamp-2 h-8">{clip.prompt.substring(0, 80)}...</p>
                    
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-white/30">{formatDate(clip.created_at)}</span>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="w-6 h-6 text-white/40 hover:text-white">
                            <MoreVertical className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-black/95 border-white/10">
                          {clip.video_url && (
                            <>
                              <DropdownMenuItem 
                                onClick={() => handlePlayClip(clip)}
                                className="text-white/70 hover:text-white text-xs"
                              >
                                <Play className="w-3 h-3 mr-2" />
                                Play
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDownload(clip)}
                                className="text-white/70 hover:text-white text-xs"
                              >
                                <Download className="w-3 h-3 mr-2" />
                                Download
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => window.open(clip.video_url!, '_blank')}
                                className="text-white/70 hover:text-white text-xs"
                              >
                                <ExternalLink className="w-3 h-3 mr-2" />
                                Open
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuItem 
                            onClick={() => handleDelete(clip.id)}
                            className="text-red-400 hover:text-red-300 text-xs"
                          >
                            <Trash2 className="w-3 h-3 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Video Player Modal */}
      {selectedClip?.video_url && videoModalOpen && (
        <FullscreenVideoPlayer
          clips={[selectedClip.video_url]}
          title={`Clip ${selectedClip.shot_index + 1}`}
          onClose={() => setVideoModalOpen(false)}
        />
      )}
    </div>
  );
}
