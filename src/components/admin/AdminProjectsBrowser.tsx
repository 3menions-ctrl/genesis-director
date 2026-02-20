import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
      // Delete clips first
      await supabase.from('video_clips').delete().eq('project_id', projectId);
      // Delete project
      const { error } = await supabase.from('movie_projects').delete().eq('id', projectId);
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
      const { error } = await supabase
        .from('video_clips')
        .update({ status: 'pending', error_message: null })
        .eq('project_id', projectId)
        .eq('status', 'failed');

      if (error) throw error;
      toast.success('Failed clips queued for retry');
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-success/20 text-success border-success/30"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'generating':
        return <Badge className="bg-primary/20 text-primary border-primary/30"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Generating</Badge>;
      case 'failed':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case 'stitching':
        return <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30"><Film className="w-3 h-3 mr-1" />Stitching</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />{status}</Badge>;
    }
  };

  const totalStats = {
    total: projects.length,
    completed: projects.filter(p => p.status === 'completed').length,
    generating: projects.filter(p => p.status === 'generating').length,
    failed: projects.filter(p => p.status === 'failed' || p.clips_failed > 0).length,
  };

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Film className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalStats.total}</p>
                <p className="text-xs text-muted-foreground">Total Projects</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <CheckCircle className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalStats.completed}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalStats.generating}</p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalStats.failed}</p>
                <p className="text-xs text-muted-foreground">With Errors</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
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
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            >
              {sortOrder === 'desc' ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </Button>
            <Button onClick={handleSearch} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
            <Button variant="outline" onClick={fetchProjects}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Projects Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">Project</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">User</th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-muted-foreground">Clips</th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-muted-foreground">Quality</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground">Updated</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr
                    key={project.id}
                    className={cn(
                      "border-b border-border/50 hover:bg-muted/30 transition-colors",
                      project.clips_failed > 0 && "bg-destructive/5"
                    )}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {project.thumbnail_url ? (
                          <img
                            src={project.thumbnail_url}
                            alt=""
                            className="w-12 h-8 rounded object-cover"
                          />
                        ) : (
                          <div className="w-12 h-8 rounded bg-muted flex items-center justify-center">
                            <Film className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-sm">{project.title}</p>
                          <p className="text-xs text-muted-foreground font-mono">{project.id.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="text-sm">{project.user_name}</p>
                        <p className="text-xs text-muted-foreground">{project.user_email}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {getStatusBadge(project.status)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-success text-sm">{project.clips_completed}</span>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-sm">{project.clips_total}</span>
                        {project.clips_failed > 0 && (
                          <Badge variant="destructive" className="ml-1 text-xs">
                            {project.clips_failed} failed
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant="outline">{project.quality_tier || 'standard'}</Badge>
                    </td>
                    <td className="py-3 px-4 text-right text-xs text-muted-foreground">
                      {format(new Date(project.updated_at), 'MMM d, HH:mm')}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewProject(project)}>
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          {project.video_url && (
                            <DropdownMenuItem onClick={() => window.open(project.video_url!, '_blank')}>
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {projects.length === 0 && !loading && (
              <div className="text-center py-12 text-muted-foreground">
                <Film className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No projects found</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

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
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">User:</span>
                        <span>{selectedProject?.user_name} ({selectedProject?.user_email})</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clapperboard className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Genre:</span>
                        <Badge variant="outline">{selectedProject?.genre}</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Duration:</span>
                        <span>{selectedProject?.target_duration_minutes} min</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Created:</span>
                        <span>{selectedProject && format(new Date(selectedProject.created_at), 'PPpp')}</span>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Status</span>
                        {selectedProject && getStatusBadge(selectedProject.status)}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Pipeline Stage</span>
                        <Badge variant="secondary">{selectedProject?.pipeline_stage || 'draft'}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Stitch Attempts</span>
                        <span>{selectedProject?.stitch_attempts || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Quality Tier</span>
                        <Badge>{selectedProject?.quality_tier || 'standard'}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {selectedProject?.video_url && (
                  <Card>
                    <CardContent className="p-4">
                      <video
                        src={selectedProject.video_url}
                        controls
                        className="w-full rounded-lg"
                      />
                    </CardContent>
                  </Card>
                )}

                {selectedProject?.last_error && (
                  <Card className="border-destructive/50 bg-destructive/5">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
                        <div>
                          <p className="font-medium text-destructive">Last Error</p>
                          <p className="text-sm text-muted-foreground mt-1">{selectedProject.last_error}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
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
                      <Card key={clip.id} className={cn(
                        clip.status === 'failed' && "border-destructive/50 bg-destructive/5"
                      )}>
                        <CardContent className="p-3">
                          <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-mono text-sm">
                              {clip.shot_index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">{clip.prompt}</p>
                              <p className="text-xs text-muted-foreground">
                                Retries: {clip.retry_count || 0}
                              </p>
                            </div>
                            {getStatusBadge(clip.status)}
                            {clip.video_url && (
                              <Button size="sm" variant="ghost" onClick={() => window.open(clip.video_url!, '_blank')}>
                                <Play className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                          {clip.error_message && (
                            <p className="text-xs text-destructive mt-2 ml-12">{clip.error_message}</p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="errors" className="mt-0">
                <div className="space-y-2">
                  {projectClips.filter(c => c.status === 'failed').map((clip) => (
                    <Card key={clip.id} className="border-destructive/50 bg-destructive/5">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-destructive/20 flex items-center justify-center font-mono text-sm text-destructive">
                            {clip.shot_index + 1}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-destructive">Shot {clip.shot_index + 1} Failed</p>
                            <p className="text-sm text-muted-foreground mt-1">{clip.error_message}</p>
                            <p className="text-xs text-muted-foreground mt-2">Retry count: {clip.retry_count || 0}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {projectClips.filter(c => c.status === 'failed').length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <CheckCircle className="w-12 h-12 mx-auto mb-4 text-success opacity-50" />
                      <p>No errors found</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>

          <DialogFooter className="mt-4">
            {selectedProject?.clips_failed > 0 && (
              <Button variant="outline" onClick={() => handleRetryFailedClips(selectedProject.id)}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry Failed Clips
              </Button>
            )}
            <Button variant="destructive" onClick={() => handleDeleteProject(selectedProject!.id)}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
