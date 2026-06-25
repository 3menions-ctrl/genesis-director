import { useState, useEffect, useCallback, useRef } from 'react';
import Hls from 'hls.js';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Search,
  Loader2,
  Video,
  Film,
  AlertTriangle,
  CheckCircle,
  Clock,
  Play,
  Trash2,
  RefreshCw,
  Eye,
  ExternalLink,
  User,
  Calendar,
  Clapperboard,
  XCircle,
  MoreVertical,
  Filter,
  Download,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ListPagination, usePagination } from '@/components/ui/list-pagination';
import { FloatSection, FloatStat, FloatTable, StatusPill, DeckButton } from '@/admin/ui/primitives';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface ProjectRecord {
  id: string;
  title: string;
  user_id: string;
  user_email?: string;
  user_name?: string;
  status: string;
  pipeline_stage: string | null;
  genre: string;
  quality_tier: string | null;
  target_duration_minutes: number;
  video_url: string | null;
  thumbnail_url: string | null;
  last_error: string | null;
  stitch_attempts: number | null;
  created_at: string;
  updated_at: string;
  clips_total: number;
  clips_completed: number;
  clips_failed: number;
  clips_pending: number;
  hls_playlist_url: string | null;
  pending_video_tasks: any;
}

/** Resolve the best playable video URL from a project record */
function resolvePlayableUrl(project: ProjectRecord): string | null {
  // Prefer HLS playlist
  if (project.hls_playlist_url) return project.hls_playlist_url;

  // Check pending_video_tasks for HLS or manifest
  const tasks = project.pending_video_tasks;
  if (tasks?.hlsPlaylistUrl) return tasks.hlsPlaylistUrl;

  // Check if video_url is a direct playable file
  if (project.video_url) {
    const lower = project.video_url.toLowerCase();
    if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.m3u8')) {
      return project.video_url;
    }
    // If it's a manifest JSON, try to extract clip URLs from pending_video_tasks
    if (lower.endsWith('.json') && tasks?.predictions) {
      const completed = (tasks.predictions as any[])
        .filter((p: any) => p.videoUrl && p.status === 'completed')
        .map((p: any) => p.videoUrl as string);
      if (completed.length > 0) return completed[0]; // Return first clip as preview
    }
  }

  return project.video_url; // Fallback
}
/** Simple HLS-capable video player for admin detail dialog */
function AdminVideoPlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    const isHls = src.toLowerCase().includes('.m3u8');

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({ maxBufferLength: 30 });
      hls.loadSource(src);
      hls.attachMedia(video);
      return () => { hls.destroy(); };
    } else if (isHls && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
    } else {
      video.src = src;
    }
  }, [src]);

  return (
    <video
      ref={videoRef}
      controls
      className="w-full rounded-lg"
      crossOrigin="anonymous"
    />
  );
}

interface ClipRecord {
  id: string;
  shot_index: number;
  status: string;
  prompt: string;
  video_url: string | null;
  error_message: string | null;
  retry_count: number | null;
  created_at: string;
}

type PillTone = 'accent' | 'positive' | 'warn' | 'danger' | 'neutral';

/** Status → Horizon StatusPill (borderless) */
function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <StatusPill tone="positive"><CheckCircle className="w-3 h-3" />Completed</StatusPill>;
    case 'generating':
      return <StatusPill tone="accent"><Loader2 className="w-3 h-3 animate-spin" />Generating</StatusPill>;
    case 'failed':
      return <StatusPill tone="danger"><XCircle className="w-3 h-3" />Failed</StatusPill>;
    case 'stitching':
      return <StatusPill tone="warn"><Film className="w-3 h-3" />Stitching</StatusPill>;
    default:
      return <StatusPill tone="neutral"><Clock className="w-3 h-3" />{status}</StatusPill>;
  }
}

export function AdminProjectsBrowser() {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('updated_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedProject, setSelectedProject] = useState<ProjectRecord | null>(null);
  const [projectClips, setProjectClips] = useState<ClipRecord[]>([]);
  const [clipsLoading, setClipsLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const { slice: pagedProjects, page, setPage, totalPages, total, pageSize } = usePagination(projects, 25);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('admin_list_projects', {
        p_limit: 200,
        p_offset: 0,
        p_status: statusFilter !== 'all' ? statusFilter : null,
        p_search: search.trim() || null,
        p_sort_by: sortBy,
        p_sort_order: sortOrder,
      });

      if (error) throw error;

      const enrichedProjects: ProjectRecord[] = (data || []).map((p: any) => ({
        ...p,
        clips_total: Number(p.clips_total ?? 0),
        clips_completed: Number(p.clips_completed ?? 0),
        clips_failed: Number(p.clips_failed ?? 0),
        clips_pending: Number(p.clips_pending ?? 0),
      }));

      setProjects(enrichedProjects);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, sortBy, sortOrder]);

  const fetchProjectClips = async (projectId: string) => {
    setClipsLoading(true);
    try {
      const { data, error } = await supabase
        .from('video_clips')
        .select('*')
        .eq('project_id', projectId)
        .order('shot_index', { ascending: true });

      if (error) throw error;
      setProjectClips(data || []);
    } catch (err) {
      console.error('Failed to fetch clips:', err);
      toast.error('Failed to load clips');
    } finally {
      setClipsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleSearch = () => {
    fetchProjects();
  };

  const handleViewProject = (project: ProjectRecord) => {
    setSelectedProject(project);
    fetchProjectClips(project.id);
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('Are you sure you want to delete this project? This cannot be undone.')) return;

    try {
      const { data, error } = await supabase.rpc('admin_moderate_content', {
        p_project_id: projectId,
        p_action: 'delete',
        p_reason: 'Admin manual deletion',
      });
      if (error) throw error;

      toast.success('Project deleted');
      setSelectedProject(null);
      fetchProjects();
    } catch (err) {
      console.error('Failed to delete project:', err);
      toast.error('Failed to delete project');
    }
  };

  const handleRetryFailedClips = async (projectId: string) => {
    try {
      // Retry through the REAL generation path (retry-failed-clip →
      // generate-single-clip). PREVIOUSLY this raw-flipped video_clips.status
      // to 'pending' and fired a success toast — but that re-renders nothing:
      // the pipeline watchdog only acts on 'generating' projects and is
      // disabled by default. Fetch the failed clips and re-queue each.
      const { data: failedClips, error: fetchErr } = await supabase
        .from('video_clips')
        .select('id, shot_index')
        .eq('project_id', projectId)
        .eq('status', 'failed')
        .order('shot_index', { ascending: true });
      if (fetchErr) throw fetchErr;
      if (!failedClips || failedClips.length === 0) {
        toast.info('No failed clips to retry');
        return;
      }

      // Sequential by shot order: retry-failed-clip holds a per-project
      // generation lock (concurrent retries 409) and continuity needs order.
      let ok = 0;
      for (const clip of failedClips) {
        const { data, error } = await supabase.functions.invoke('retry-failed-clip', {
          body: { projectId, clipIndex: (clip as { shot_index: number }).shot_index },
        });
        if (error || data?.success === false) {
          console.warn('[AdminProjects] retry failed for', (clip as { id: string }).id, error?.message ?? data?.message);
        } else {
          ok++;
        }
      }

      if (ok > 0) {
        toast.success(`Re-queued ${ok} of ${failedClips.length} failed clip${failedClips.length === 1 ? '' : 's'}`);
      } else {
        toast.error('Failed to re-queue clips');
      }
      if (selectedProject) fetchProjectClips(projectId);
      fetchProjects();
    } catch (err) {
      console.error('Failed to retry clips:', err);
      toast.error('Failed to retry clips');
    }
  };

  const toggleRowExpand = (projectId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
    }
    setExpandedRows(newExpanded);
  };

  const totalStats = {
    total: projects.length,
    completed: projects.filter(p => p.status === 'completed').length,
    generating: projects.filter(p => p.status === 'generating').length,
    failed: projects.filter(p => p.status === 'failed' || p.clips_failed > 0).length,
  };

  return (
    <div className="space-y-12">
      {/* Stats Overview — floating figures */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-8">
        <FloatStat index={0} label="Total Projects" value={totalStats.total} icon={Film} accentNumber />
        <FloatStat index={1} label="Completed" value={totalStats.completed} icon={CheckCircle} />
        <FloatStat index={2} label="In Progress" value={totalStats.generating} icon={Loader2} />
        <FloatStat index={3} label="With Errors" value={totalStats.failed} icon={AlertTriangle} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <Input
              placeholder="Search by title, user, or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-9"
            />
          </div>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="generating">Generating</SelectItem>
            <SelectItem value="stitching">Stitching</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updated_at">Last Updated</SelectItem>
            <SelectItem value="created_at">Created</SelectItem>
            <SelectItem value="title">Title</SelectItem>
          </SelectContent>
        </Select>
        <DeckButton onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
          {sortOrder === 'desc' ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </DeckButton>
        <DeckButton primary onClick={handleSearch} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Search
        </DeckButton>
        <DeckButton onClick={fetchProjects}>
          <RefreshCw className="w-4 h-4" />
        </DeckButton>
      </div>

      {/* Projects Table */}
      <FloatSection title="Projects" meta={`${total} total`}>
        <div className="overflow-x-auto">
          <FloatTable
            columns={[
              { key: 'project', label: 'Project' },
              { key: 'user', label: 'User' },
              { key: 'status', label: 'Status' },
              { key: 'clips', label: 'Clips' },
              { key: 'quality', label: 'Quality' },
              { key: 'updated', label: 'Updated', align: 'right' },
              { key: 'actions', label: 'Actions', align: 'right' },
            ]}
            rows={pagedProjects.map((project) => ({
              _key: project.id,
              project: (
                <div className="flex items-center gap-3">
                  {project.thumbnail_url ? (
                    <img src={project.thumbnail_url} alt="" className="w-12 h-8 rounded object-cover" />
                  ) : (
                    <div className="w-12 h-8 rounded bg-white/[0.04] flex items-center justify-center">
                      <Film className="w-4 h-4 text-white/40" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-sm text-white">{project.title}</p>
                    <p className="text-xs text-white/40 font-mono">{project.id.slice(0, 8)}...</p>
                  </div>
                </div>
              ),
              user: (
                <div>
                  <p className="text-sm text-white/80">{project.user_name}</p>
                  <p className="text-xs text-white/40">{project.user_email}</p>
                </div>
              ),
              status: <StatusBadge status={project.status} />,
              clips: (
                <div className="flex items-center gap-1">
                  <span className="text-emerald-300 text-sm">{project.clips_completed}</span>
                  <span className="text-white/40">/</span>
                  <span className="text-sm text-white/80">{project.clips_total}</span>
                  {project.clips_failed > 0 && (
                    <span className="ml-1"><StatusPill tone="danger">{project.clips_failed} failed</StatusPill></span>
                  )}
                </div>
              ),
              quality: <StatusPill>{project.quality_tier || 'standard'}</StatusPill>,
              updated: <span className="text-xs text-white/40">{format(new Date(project.updated_at), 'MMM d, HH:mm')}</span>,
              actions: (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-white/40 hover:text-white">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleViewProject(project)}>
                      <Eye className="w-4 h-4 mr-2" />
                      View Details
                    </DropdownMenuItem>
                    {resolvePlayableUrl(project) && (
                      <DropdownMenuItem onClick={() => window.open(resolvePlayableUrl(project)!, '_blank')}>
                        <Play className="w-4 h-4 mr-2" />
                        Watch Video
                      </DropdownMenuItem>
                    )}
                    {project.clips_failed > 0 && (
                      <DropdownMenuItem onClick={() => handleRetryFailedClips(project.id)}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Retry Failed Clips
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => handleDeleteProject(project.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Project
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ),
            }))}
            empty="No projects found"
          />
          <ListPagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} className="pt-4" />
        </div>
      </FloatSection>

      {/* Project Detail Dialog */}
      <Dialog open={!!selectedProject} onOpenChange={() => setSelectedProject(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Film className="w-5 h-5" />
              {selectedProject?.title}
            </DialogTitle>
            <DialogDescription>
              Project ID: {selectedProject?.id}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="overview" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="clips">Clips ({projectClips.length})</TabsTrigger>
              <TabsTrigger value="errors">Errors</TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 mt-4">
              <TabsContent value="overview" className="space-y-4 mt-0">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl bg-white/[0.02] p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="w-4 h-4 text-white/40" />
                      <span className="text-white/40">User:</span>
                      <span className="text-white/80">{selectedProject?.user_name} ({selectedProject?.user_email})</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clapperboard className="w-4 h-4 text-white/40" />
                      <span className="text-white/40">Genre:</span>
                      <StatusPill>{selectedProject?.genre}</StatusPill>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-white/40" />
                      <span className="text-white/40">Duration:</span>
                      <span className="text-white/80">{selectedProject?.target_duration_minutes} min</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-white/40" />
                      <span className="text-white/40">Created:</span>
                      <span className="text-white/80">{selectedProject && format(new Date(selectedProject.created_at), 'PPpp')}</span>
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/[0.02] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-white/40">Status</span>
                      {selectedProject && <StatusBadge status={selectedProject.status} />}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/40">Pipeline Stage</span>
                      <StatusPill>{selectedProject?.pipeline_stage || 'draft'}</StatusPill>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/40">Stitch Attempts</span>
                      <span className="text-white/80">{selectedProject?.stitch_attempts || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/40">Quality Tier</span>
                      <StatusPill tone="accent">{selectedProject?.quality_tier || 'standard'}</StatusPill>
                    </div>
                  </div>
                </div>

                {selectedProject && (() => {
                  const playUrl = resolvePlayableUrl(selectedProject);
                  if (!playUrl) return null;
                  return (
                    <div className="rounded-xl bg-white/[0.02] p-4">
                      <AdminVideoPlayer src={playUrl} />
                    </div>
                  );
                })()}

                {selectedProject?.last_error && (
                  <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
                      <div>
                        <p className="font-medium text-destructive">Last Error</p>
                        <p className="text-sm text-white/40 mt-1">{selectedProject.last_error}</p>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="clips" className="mt-0">
                {clipsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {projectClips.map((clip) => (
                      <div key={clip.id} className={cn(
                        "rounded-xl bg-white/[0.02] p-3",
                        clip.status === 'failed' && "border border-destructive/50 bg-destructive/5"
                      )}>
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-full bg-white/[0.04] flex items-center justify-center font-mono text-sm text-white/80">
                            {clip.shot_index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate text-white/80">{clip.prompt}</p>
                            <p className="text-xs text-white/40">
                              Retries: {clip.retry_count || 0}
                            </p>
                          </div>
                          <StatusBadge status={clip.status} />
                          {clip.video_url && (
                            <DeckButton onClick={() => window.open(clip.video_url!, '_blank')}>
                              <Play className="w-4 h-4" />
                            </DeckButton>
                          )}
                        </div>
                        {clip.error_message && (
                          <p className="text-xs text-destructive mt-2 ml-12">{clip.error_message}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="errors" className="mt-0">
                <div className="space-y-2">
                  {projectClips.filter(c => c.status === 'failed').map((clip) => (
                    <div key={clip.id} className="rounded-xl border border-destructive/50 bg-destructive/5 p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-destructive/20 flex items-center justify-center font-mono text-sm text-destructive">
                          {clip.shot_index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-destructive">Shot {clip.shot_index + 1} Failed</p>
                          <p className="text-sm text-white/40 mt-1">{clip.error_message}</p>
                          <p className="text-xs text-white/40 mt-2">Retry count: {clip.retry_count || 0}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {projectClips.filter(c => c.status === 'failed').length === 0 && (
                    <div className="text-center py-12 text-white/40">
                      <CheckCircle className="w-12 h-12 mx-auto mb-4 text-emerald-300 opacity-50" />
                      <p>No errors found</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>

          <DialogFooter className="mt-4">
            {selectedProject?.clips_failed > 0 && (
              <DeckButton onClick={() => handleRetryFailedClips(selectedProject.id)}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry Failed Clips
              </DeckButton>
            )}
            <DeckButton onClick={() => handleDeleteProject(selectedProject!.id)}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Project
            </DeckButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
