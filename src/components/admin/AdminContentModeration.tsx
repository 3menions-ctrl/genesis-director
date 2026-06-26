import { useState, useEffect } from 'react';
import { safeHref } from '@/lib/safeHref';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FloatStat, StatusPill, DeckButton } from '@/admin/ui/primitives';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Eye,
  EyeOff,
  Flag,
  Search,
  RefreshCw,
  Loader2,
  Play,
  Heart,
  Calendar,
  User,
  Globe,
  Lock,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Film,
  Shield,
  ExternalLink,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface PublicVideo {
  id: string;
  title: string;
  synopsis: string | null;
  thumbnail_url: string | null;
  video_url: string | null;
  genre: string;
  is_public: boolean;
  likes_count: number;
  created_at: string;
  user_id: string;
  status: string;
  user_email?: string;
  user_name?: string;
}

interface ModerationAction {
  videoId: string;
  action: 'hide' | 'delete' | 'approve';
}

export function AdminContentModeration() {
  const [publicVideos, setPublicVideos] = useState<PublicVideo[]>([]);
  const [allVideos, setAllVideos] = useState<PublicVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('public');
  
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    video: PublicVideo | null;
    action: ModerationAction['action'] | null;
  }>({ open: false, video: null, action: null });
  
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    fetchVideos();
  }, [activeTab]);

  const fetchVideos = async () => {
    setLoading(true);
    try {
      // Fetch videos based on tab
      let query = supabase
        .from('movie_projects')
        .select('id, title, synopsis, thumbnail_url, video_url, genre, is_public, likes_count, created_at, user_id, status')
        .not('video_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (activeTab === 'public') {
        query = query.eq('is_public', true);
      }
      
      const { data: videos, error } = await query;
      if (error) throw error;
      
      // Fetch user info for each video
      const userIds = [...new Set((videos || []).map(v => v.user_id))];
      const { data: profiles } = await (
        supabase.rpc as unknown as (
          fn: string,
          args: Record<string, unknown>,
        ) => Promise<{ data: Array<Record<string, unknown>> | null }>
      )("admin_profiles_by_ids", { p_ids: userIds });
      
      const profileMap = new Map((profiles || []).map(p => [p.id, p]));
      
      const enrichedVideos = (videos || []).map(v => ({
        ...v,
        user_email: profileMap.get(v.user_id)?.email || 'Unknown',
        user_name: profileMap.get(v.user_id)?.display_name || 'Unknown',
      }));
      
      if (activeTab === 'public') {
        setPublicVideos(enrichedVideos);
      } else {
        setAllVideos(enrichedVideos);
      }
    } catch (err) {
      console.error('Failed to fetch videos:', err);
      toast.error('Failed to load videos');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async () => {
    if (!actionDialog.video || !actionDialog.action) return;
    
    setProcessing(actionDialog.video.id);
    try {
      const { data, error } = await supabase.rpc('admin_moderate_content', {
        p_project_id: actionDialog.video.id,
        p_action: actionDialog.action,
      });
      
      if (error) throw error;
      
      const messages = {
        hide: 'Video hidden from public',
        delete: 'Video deleted',
        approve: 'Video approved',
      };
      toast.success(messages[actionDialog.action]);
      fetchVideos();
    } catch (err) {
      console.error('Failed to perform action:', err);
      toast.error('Failed to perform action');
    } finally {
      setProcessing(null);
      setActionDialog({ open: false, video: null, action: null });
    }
  };

  const filteredVideos = (activeTab === 'public' ? publicVideos : allVideos).filter(v => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      v.title.toLowerCase().includes(searchLower) ||
      v.user_email?.toLowerCase().includes(searchLower) ||
      v.synopsis?.toLowerCase().includes(searchLower)
    );
  });

  const stats = {
    totalPublic: publicVideos.length,
    totalLikes: publicVideos.reduce((sum, v) => sum + (v.likes_count || 0), 0),
    recentPublic: publicVideos.filter(v => {
      const created = new Date(v.created_at);
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return created > dayAgo;
    }).length,
  };

  if (loading && filteredVideos.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-white/60" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Shield className="w-5 h-5" style={{ color: 'hsl(214 90% 62%)' }} />
            Content Moderation
          </h2>
          <p className="text-sm text-white/60">
            Review and manage public video content
          </p>
        </div>
        <DeckButton onClick={fetchVideos} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Refresh
        </DeckButton>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-10 gap-y-8">
        <FloatStat label="Public Videos" value={stats.totalPublic} icon={Globe} sub="Visible to all users" index={0} />
        <FloatStat label="Total Likes" value={stats.totalLikes} icon={Heart} accentNumber sub="Community engagement" index={1} />
        <FloatStat label="New Today" value={stats.recentPublic} icon={Calendar} sub="Published in last 24h" index={2} />
      </div>

      {/* Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="public" className="gap-2">
              <Globe className="w-4 h-4" />
              Public Videos
            </TabsTrigger>
            <TabsTrigger value="all" className="gap-2">
              <Film className="w-4 h-4" />
              All Completed
            </TabsTrigger>
          </TabsList>
          
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <Input
              placeholder="Search videos, users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <TabsContent value="public" className="mt-4">
          <VideoGrid 
            videos={filteredVideos} 
            onAction={(video, action) => setActionDialog({ open: true, video, action })}
            processing={processing}
          />
        </TabsContent>
        
        <TabsContent value="all" className="mt-4">
          <VideoGrid 
            videos={filteredVideos} 
            onAction={(video, action) => setActionDialog({ open: true, video, action })}
            processing={processing}
          />
        </TabsContent>
      </Tabs>

      {/* Action Dialog */}
      <AlertDialog open={actionDialog.open} onOpenChange={(open) => !open && setActionDialog({ open: false, video: null, action: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionDialog.action === 'hide' && 'Hide Video from Public?'}
              {actionDialog.action === 'delete' && 'Delete Video?'}
              {actionDialog.action === 'approve' && 'Approve Video?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionDialog.action === 'hide' && (
                <>This will remove "{actionDialog.video?.title}" from the public gallery. The owner can still access it.</>
              )}
              {actionDialog.action === 'delete' && (
                <>This will permanently delete "{actionDialog.video?.title}". This action cannot be undone.</>
              )}
              {actionDialog.action === 'approve' && (
                <>Mark "{actionDialog.video?.title}" as reviewed and approved.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleAction}
              className={cn(
                actionDialog.action === 'delete' && 'bg-destructive hover:bg-destructive/90'
              )}
            >
              {actionDialog.action === 'hide' && 'Hide Video'}
              {actionDialog.action === 'delete' && 'Delete Video'}
              {actionDialog.action === 'approve' && 'Approve'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface VideoGridProps {
  videos: PublicVideo[];
  onAction: (video: PublicVideo, action: ModerationAction['action']) => void;
  processing: string | null;
}

function VideoGrid({ videos, onAction, processing }: VideoGridProps) {
  const [downloading, setDownloading] = useState<string | null>(null);

  const toStorageDownloadUrl = (rawUrl: string, filename: string) => {
    const sep = rawUrl.includes('?') ? '&' : '?';
    return `${rawUrl}${sep}download=${encodeURIComponent(filename)}`;
  };

  const saveBlob = async (rawUrl: string, filename: string) => {
    const response = await fetch(rawUrl, { mode: 'cors', cache: 'no-store' });
    if (!response.ok) throw new Error(`Download failed (${response.status})`);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
  };

  const handleDownload = async (video: PublicVideo) => {
    if (!video.video_url) return;
    setDownloading(video.id);
    const url = video.video_url;
    const safeName = (video.title || 'video').replace(/[^a-z0-9-_]+/gi, '_').slice(0, 60);
    const downloadWindow = window.open('about:blank', '_blank');
    if (downloadWindow) downloadWindow.opener = null;
    try {
      if (url.endsWith('.json')) {
        const res = await fetch(url, { mode: 'cors', cache: 'no-store' });
        if (!res.ok) throw new Error('manifest fetch failed');
        const manifest = await res.json();
        const clips: string[] = (manifest.clips || [])
          .map((c: { videoUrl?: string }) => c.videoUrl)
          .filter(Boolean);
        if (!clips.length) throw new Error('no clips in manifest');
        downloadWindow?.close();
        toast.info(`Downloading ${clips.length} clip(s)…`);
        for (let i = 0; i < clips.length; i++) {
          const filename = clips.length === 1 ? `${safeName}.mp4` : `${safeName}_clip${i + 1}.mp4`;
          await saveBlob(clips[i], filename);
          if (i < clips.length - 1) await new Promise((r) => setTimeout(r, 400));
        }
        toast.success(`Started ${clips.length} download(s)`);
      } else {
        downloadWindow?.close();
        await saveBlob(url, `${safeName}.mp4`);
        toast.success('Download started');
      }
    } catch (err) {
      console.error('[AdminModeration] download error:', err);
      if (downloadWindow) {
        downloadWindow.location.href = toStorageDownloadUrl(url, `${safeName}.mp4`);
      } else {
        window.open(toStorageDownloadUrl(url, `${safeName}.mp4`), '_blank');
      }
      toast.info('Opened video in a new tab');
    } finally {
      setDownloading(null);
    }
  };

  if (videos.length === 0) {
    return (
      <div className="py-12 text-center text-white/40">
        <Film className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No videos found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {videos.map((video) => (
        <div
          key={video.id}
          className="overflow-hidden rounded-2xl backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5"
          style={{ background: 'linear-gradient(165deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02) 60%, rgba(255,255,255,0.015))' }}
        >
          {/* Thumbnail */}
          <div className="aspect-video bg-white/[0.04] relative group">
            {video.thumbnail_url ? (
              <img 
                src={video.thumbnail_url} 
                alt={video.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Film className="w-12 h-12 text-white/30" />
              </div>
            )}

            {/* Overlay on hover */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              {video.video_url && (
                <>
                  <Button size="sm" variant="secondary" asChild>
                    <a href={safeHref(video.video_url)} target="_blank" rel="noopener noreferrer">
                      <Play className="w-4 h-4 mr-1" />
                      Play
                    </a>
                  </Button>
                  <DeckButton
                    onClick={() => handleDownload(video)}
                    disabled={downloading === video.id}
                  >
                    {downloading === video.id ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-1" />
                    )}
                    Download
                  </DeckButton>
                </>
              )}
            </div>

            {/* Status badges */}
            <div className="absolute top-2 right-2 flex gap-1">
              {video.is_public ? (
                <StatusPill tone="positive">
                  <Globe className="w-3 h-3" />
                  Public
                </StatusPill>
              ) : (
                <StatusPill tone="neutral">
                  <Lock className="w-3 h-3" />
                  Private
                </StatusPill>
              )}
            </div>
          </div>

          <div className="p-4 space-y-3">
            {/* Title & Genre */}
            <div>
              <h3 className="font-medium text-white line-clamp-1">{video.title}</h3>
              <div className="mt-1 capitalize"><StatusPill tone="neutral">{video.genre}</StatusPill></div>
            </div>

            {/* Synopsis */}
            {video.synopsis && (
              <p className="text-sm text-white/60 line-clamp-2">{video.synopsis}</p>
            )}

            {/* Meta */}
            <div className="flex items-center justify-between text-xs text-white/60">
              <div className="flex items-center gap-1">
                <User className="w-3 h-3" />
                <span className="truncate max-w-24">{video.user_name || video.user_email}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <Heart className="w-3 h-3" />
                  {video.likes_count || 0}
                </span>
                <span>{format(new Date(video.created_at), 'MMM d')}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="flex-1">
                <DeckButton
                  onClick={() => onAction(video, 'approve')}
                  disabled={processing === video.id}
                >
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Approve
                </DeckButton>
              </span>
              {video.is_public && (
                <DeckButton
                  onClick={() => onAction(video, 'hide')}
                  disabled={processing === video.id}
                >
                  <EyeOff className="w-3 h-3" />
                </DeckButton>
              )}
              {video.video_url && (
                <DeckButton
                  onClick={() => handleDownload(video)}
                  disabled={downloading === video.id}
                >
                  {downloading === video.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Download className="w-3 h-3" />
                  )}
                </DeckButton>
              )}
              <DeckButton
                onClick={() => onAction(video, 'delete')}
                disabled={processing === video.id}
              >
                {processing === video.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Trash2 className="w-3 h-3" />
                )}
              </DeckButton>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
