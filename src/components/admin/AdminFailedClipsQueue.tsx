import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertTriangle,
  RefreshCw,
  Loader2,
  Search,
  Trash2,
  CheckCircle,
  Video,
  User,
  Calendar,
  XCircle,
  Filter,
  BarChart3,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format, subDays, subHours } from 'date-fns';

interface FailedClip {
  id: string;
  shot_index: number;
  prompt: string;
  error_message: string | null;
  last_error_category: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
  project_id: string;
  project_title?: string;
  user_id: string;
  user_email?: string;
}

interface ErrorPattern {
  category: string;
  count: number;
  percentage: number;
}

export function AdminFailedClipsQueue() {
  const [loading, setLoading] = useState(true);
  const [clips, setClips] = useState<FailedClip[]>([]);
  const [selectedClips, setSelectedClips] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [timeFilter, setTimeFilter] = useState('all');
  const [errorPatterns, setErrorPatterns] = useState<ErrorPattern[]>([]);
  const [processing, setProcessing] = useState(false);

  const fetchFailedClips = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('video_clips')
        .select('*')
        .eq('status', 'failed')
        .order('updated_at', { ascending: false })
        .limit(200);

      // Apply time filter
      if (timeFilter !== 'all') {
        const hours = timeFilter === '1h' ? 1 : timeFilter === '24h' ? 24 : timeFilter === '7d' ? 168 : 0;
        if (hours > 0) {
          const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
          query = query.gte('updated_at', cutoff);
        }
      }

      const { data: clipsData, error } = await query;
      if (error) throw error;

      // Get project info
      const projectIds = [...new Set((clipsData || []).map(c => c.project_id))];
      const { data: projectsData } = await supabase
        .from('movie_projects')
        .select('id, title, user_id')
        .in('id', projectIds);

      const projectsMap = new Map((projectsData || []).map(p => [p.id, p]));

      // Get user info
      const userIds = [...new Set((projectsData || []).map(p => p.user_id))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', userIds);

      const profilesMap = new Map((profilesData || []).map(p => [p.id, p]));

      // Enrich clips
      const enrichedClips: FailedClip[] = (clipsData || []).map(clip => {
        const project = projectsMap.get(clip.project_id);
        const profile = project ? profilesMap.get(project.user_id) : null;
        return {
          ...clip,
          project_title: project?.title || 'Unknown Project',
          user_email: profile?.email || 'Unknown',
        };
      });

      // Apply search filter
      let filtered = enrichedClips;
      if (search) {
        const searchLower = search.toLowerCase();
        filtered = enrichedClips.filter(c =>
          c.prompt.toLowerCase().includes(searchLower) ||
          c.error_message?.toLowerCase().includes(searchLower) ||
          c.project_title?.toLowerCase().includes(searchLower) ||
          c.user_email?.toLowerCase().includes(searchLower)
        );
      }

      setClips(filtered);

      // Calculate error patterns
      const patternMap = new Map<string, number>();
      (clipsData || []).forEach(clip => {
        const category = clip.last_error_category || categorizeError(clip.error_message || '');
        patternMap.set(category, (patternMap.get(category) || 0) + 1);
      });

      const total = clipsData?.length || 1;
      const patterns: ErrorPattern[] = Array.from(patternMap.entries())
        .map(([category, count]) => ({
          category,
          count,
          percentage: (count / total) * 100,
        }))
        .sort((a, b) => b.count - a.count);

      setErrorPatterns(patterns);
    } catch (err) {
      console.error('Failed to fetch failed clips:', err);
      toast.error('Failed to load failed clips');
    } finally {
      setLoading(false);
    }
  };

  const categorizeError = (error: string): string => {
    const lowerError = error.toLowerCase();
    if (lowerError.includes('timeout') || lowerError.includes('timed out')) return 'Timeout';
    if (lowerError.includes('rate limit') || lowerError.includes('quota')) return 'Rate Limit';
    if (lowerError.includes('content policy') || lowerError.includes('safety')) return 'Content Policy';
    if (lowerError.includes('network') || lowerError.includes('connection')) return 'Network';
    if (lowerError.includes('invalid') || lowerError.includes('format')) return 'Invalid Input';
    if (lowerError.includes('memory') || lowerError.includes('resource')) return 'Resource';
    return 'Other';
  };

  useEffect(() => {
    fetchFailedClips();
  }, [timeFilter]);

  const handleSearch = () => {
    fetchFailedClips();
  };

  const handleSelectAll = () => {
    if (selectedClips.size === clips.length) {
      setSelectedClips(new Set());
    } else {
      setSelectedClips(new Set(clips.map(c => c.id)));
    }
  };

  const handleSelectClip = (clipId: string) => {
    const newSelected = new Set(selectedClips);
    if (newSelected.has(clipId)) {
      newSelected.delete(clipId);
    } else {
      newSelected.add(clipId);
    }
    setSelectedClips(newSelected);
  };

  const handleRetrySelected = async () => {
    if (selectedClips.size === 0) {
      toast.error('No clips selected');
      return;
    }

    setProcessing(true);
    try {
      const { error } = await supabase
        .from('video_clips')
        .update({ status: 'pending', error_message: null })
        .in('id', Array.from(selectedClips));

      if (error) throw error;

      toast.success(`${selectedClips.size} clips queued for retry`);
      setSelectedClips(new Set());
      fetchFailedClips();
    } catch (err) {
      console.error('Failed to retry clips:', err);
      toast.error('Failed to retry clips');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedClips.size === 0) {
      toast.error('No clips selected');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedClips.size} clips? This cannot be undone.`)) {
      return;
    }

    setProcessing(true);
    try {
      const { error } = await supabase
        .from('video_clips')
        .delete()
        .in('id', Array.from(selectedClips));

      if (error) throw error;

      toast.success(`${selectedClips.size} clips deleted`);
      setSelectedClips(new Set());
      fetchFailedClips();
    } catch (err) {
      console.error('Failed to delete clips:', err);
      toast.error('Failed to delete clips');
    } finally {
      setProcessing(false);
    }
  };

  const handleRetrySingle = async (clipId: string) => {
    try {
      const { error } = await supabase
        .from('video_clips')
        .update({ status: 'pending', error_message: null })
        .eq('id', clipId);

      if (error) throw error;

      toast.success('Clip queued for retry');
      fetchFailedClips();
    } catch (err) {
      console.error('Failed to retry clip:', err);
      toast.error('Failed to retry clip');
    }
  };

  const getErrorCategoryColor = (category: string): string => {
    switch (category) {
      case 'Timeout': return 'text-amber-500 bg-amber-500/10 border-amber-500/30';
      case 'Rate Limit': return 'text-blue-500 bg-blue-500/10 border-blue-500/30';
      case 'Content Policy': return 'text-purple-500 bg-purple-500/10 border-purple-500/30';
      case 'Network': return 'text-cyan-500 bg-cyan-500/10 border-cyan-500/30';
      case 'Invalid Input': return 'text-orange-500 bg-orange-500/10 border-orange-500/30';
      case 'Resource': return 'text-red-500 bg-red-500/10 border-red-500/30';
      default: return 'text-muted-foreground bg-muted border-border';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats & Patterns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1 border-destructive/30 bg-destructive/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-destructive/20">
                <XCircle className="w-8 h-8 text-destructive" />
              </div>
              <div>
                <p className="text-4xl font-bold">{clips.length}</p>
                <p className="text-sm text-muted-foreground">Failed Clips</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Error Pattern Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {errorPatterns.map((pattern) => (
                <div
                  key={pattern.category}
                  className={cn("px-3 py-1.5 rounded-full border text-xs font-medium", getErrorCategoryColor(pattern.category))}
                >
                  {pattern.category}: {pattern.count} ({pattern.percentage.toFixed(0)}%)
                </div>
              ))}
              {errorPatterns.length === 0 && (
                <span className="text-muted-foreground text-sm">No patterns detected</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by prompt, error, project, or user..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-9"
                />
              </div>
            </div>

            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger className="w-[150px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="1h">Last Hour</SelectItem>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={fetchFailedClips}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>

            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant="outline"
                onClick={handleRetrySelected}
                disabled={selectedClips.size === 0 || processing}
              >
                {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Retry Selected ({selectedClips.size})
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteSelected}
                disabled={selectedClips.size === 0 || processing}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Selected
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Failed Clips List */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Failed Clips Queue
            </CardTitle>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedClips.size === clips.length && clips.length > 0}
                onCheckedChange={handleSelectAll}
                id="select-all"
              />
              <label htmlFor="select-all" className="text-sm text-muted-foreground">
                Select All
              </label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <div className="space-y-3">
              {clips.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle className="w-16 h-16 mx-auto mb-4 text-success opacity-50" />
                  <p className="text-lg font-medium">No Failed Clips</p>
                  <p className="text-sm">All clips are processing successfully</p>
                </div>
              ) : (
                clips.map((clip) => {
                  const errorCategory = clip.last_error_category || categorizeError(clip.error_message || '');
                  return (
                    <Card
                      key={clip.id}
                      className={cn(
                        "border-destructive/30 transition-colors",
                        selectedClips.has(clip.id) && "bg-destructive/10"
                      )}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <Checkbox
                            checked={selectedClips.has(clip.id)}
                            onCheckedChange={() => handleSelectClip(clip.id)}
                          />

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className="font-mono">
                                Shot {clip.shot_index + 1}
                              </Badge>
                              <Badge className={cn("text-xs", getErrorCategoryColor(errorCategory))}>
                                {errorCategory}
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                {clip.retry_count} retries
                              </Badge>
                            </div>

                            <p className="text-sm text-foreground mb-2 line-clamp-2">
                              {clip.prompt}
                            </p>

                            <div className="p-2 rounded bg-destructive/10 border border-destructive/20 mb-2">
                              <p className="text-xs text-destructive font-medium">Error:</p>
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {clip.error_message || 'Unknown error'}
                              </p>
                            </div>

                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Video className="w-3 h-3" />
                                {clip.project_title}
                              </span>
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {clip.user_email}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {format(new Date(clip.updated_at), 'MMM d, HH:mm')}
                              </span>
                            </div>
                          </div>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRetrySingle(clip.id)}
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
