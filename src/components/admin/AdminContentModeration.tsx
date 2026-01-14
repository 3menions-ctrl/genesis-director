import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, display_name')
        .in('id', userIds);
      
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
      if (actionDialog.action === 'hide') {
        const { error } = await supabase
          .from('movie_projects')
          .update({ is_public: false })
          .eq('id', actionDialog.video.id);
        
        if (error) throw error;
        toast.success('Video hidden from public');
      } else if (actionDialog.action === 'delete') {
        const { error } = await supabase
          .from('movie_projects')
          .delete()
          .eq('id', actionDialog.video.id);
        
        if (error) throw error;
        toast.success('Video deleted');
      } else if (actionDialog.action === 'approve') {
        // Just mark as reviewed (could add a reviewed_at column)
        toast.success('Video approved');
      }
      
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
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Content Moderation
          </h2>
          <p className="text-sm text-muted-foreground">
            Review and manage public video content
          </p>
        </div>
        <Button onClick={fetchVideos} variant="outline" size="sm" disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Public Videos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPublic}</div>
            <p className="text-xs text-muted-foreground">Visible to all users</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-success" />
              Total Likes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalLikes}</div>
            <p className="text-xs text-muted-foreground">Community engagement</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-warning" />
              New Today
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.recentPublic}</div>
            <p className="text-xs text-muted-foreground">Published in last 24h</p>
          </CardContent>
        </Card>
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
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
  if (videos.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Film className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No videos found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {videos.map((video) => (
        <Card key={video.id} className="overflow-hidden hover:shadow-lg transition-shadow">
          {/* Thumbnail */}
          <div className="aspect-video bg-muted relative group">
            {video.thumbnail_url ? (
              <img 
                src={video.thumbnail_url} 
                alt={video.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Film className="w-12 h-12 text-muted-foreground/50" />
              </div>
            )}
            
            {/* Overlay on hover */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              {video.video_url && (
                <Button size="sm" variant="secondary" asChild>
                  <a href={video.video_url} target="_blank" rel="noopener noreferrer">
                    <Play className="w-4 h-4 mr-1" />
                    Play
                  </a>
                </Button>
              )}
            </div>
            
            {/* Status badges */}
            <div className="absolute top-2 right-2 flex gap-1">
              {video.is_public ? (
                <Badge className="bg-success/90 text-white">
                  <Globe className="w-3 h-3 mr-1" />
                  Public
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <Lock className="w-3 h-3 mr-1" />
                  Private
                </Badge>
              )}
            </div>
          </div>
          
          <CardContent className="p-4 space-y-3">
            {/* Title & Genre */}
            <div>
              <h3 className="font-medium text-foreground line-clamp-1">{video.title}</h3>
              <Badge variant="outline" className="mt-1 capitalize">{video.genre}</Badge>
            </div>
            
            {/* Synopsis */}
            {video.synopsis && (
              <p className="text-sm text-muted-foreground line-clamp-2">{video.synopsis}</p>
            )}
            
            {/* Meta */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
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
            <div className="flex items-center gap-2 pt-2 border-t border-border/50">
              <Button 
                size="sm" 
                variant="outline" 
                className="flex-1"
                onClick={() => onAction(video, 'approve')}
                disabled={processing === video.id}
              >
                <CheckCircle className="w-3 h-3 mr-1" />
                Approve
              </Button>
              {video.is_public && (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => onAction(video, 'hide')}
                  disabled={processing === video.id}
                >
                  <EyeOff className="w-3 h-3" />
                </Button>
              )}
              <Button 
                size="sm" 
                variant="destructive"
                onClick={() => onAction(video, 'delete')}
                disabled={processing === video.id}
              >
                {processing === video.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Trash2 className="w-3 h-3" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
