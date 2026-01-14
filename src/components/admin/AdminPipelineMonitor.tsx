import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import {
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  RefreshCw,
  Video,
  Mic,
  Film,
  Scissors,
  Music,
  Image,
  Sparkles,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Zap,
  Server,
  Database,
  Cpu,
  HardDrive,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, subMinutes, subHours } from 'date-fns';

interface PipelineMetrics {
  activeJobs: number;
  completedToday: number;
  failedToday: number;
  averageProcessingTime: number;
  queueDepth: number;
}

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  latency: number;
  successRate: number;
  callsToday: number;
  failuresToday: number;
  lastError?: string;
  lastErrorTime?: string;
}

interface ActiveJob {
  id: string;
  type: 'clip' | 'stitch' | 'voice' | 'music';
  projectId: string;
  projectTitle: string;
  progress: number;
  status: string;
  startedAt: string;
  user: string;
}

interface RecentError {
  id: string;
  service: string;
  operation: string;
  error: string;
  projectId: string;
  timestamp: string;
}

export function AdminPipelineMonitor() {
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [metrics, setMetrics] = useState<PipelineMetrics>({
    activeJobs: 0,
    completedToday: 0,
    failedToday: 0,
    averageProcessingTime: 0,
    queueDepth: 0,
  });
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [activeJobs, setActiveJobs] = useState<ActiveJob[]>([]);
  const [recentErrors, setRecentErrors] = useState<RecentError[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Fetch active clip generations
      const { data: activeClips } = await supabase
        .from('video_clips')
        .select('id, project_id, status, created_at, user_id')
        .in('status', ['generating', 'pending'])
        .order('created_at', { ascending: false })
        .limit(50);

      // Fetch active stitch jobs
      const { data: activeStitches } = await supabase
        .from('stitch_jobs')
        .select('*')
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: false });

      // Fetch today's API logs for service health
      const { data: apiLogs } = await supabase
        .from('api_cost_logs')
        .select('service, operation, status, created_at')
        .gte('created_at', today.toISOString());

      // Fetch recent errors
      const { data: errorLogs } = await supabase
        .from('api_cost_logs')
        .select('id, service, operation, status, metadata, project_id, created_at')
        .eq('status', 'failed')
        .order('created_at', { ascending: false })
        .limit(20);

      // Calculate service health
      const serviceMap = new Map<string, { calls: number; failures: number; lastError?: any }>();
      (apiLogs || []).forEach((log: any) => {
        const current = serviceMap.get(log.service) || { calls: 0, failures: 0 };
        current.calls++;
        if (log.status === 'failed') {
          current.failures++;
          current.lastError = log;
        }
        serviceMap.set(log.service, current);
      });

      const serviceConfigs = [
        { key: 'google_veo', name: 'Veo Video Gen', icon: Video },
        { key: 'openai-tts', name: 'OpenAI TTS', icon: Mic },
        { key: 'cloud_run_stitcher', name: 'Cloud Run Stitcher', icon: Scissors },
        { key: 'openai', name: 'OpenAI GPT', icon: Sparkles },
        { key: 'dalle', name: 'DALL-E', icon: Image },
        { key: 'music-generation', name: 'Music Gen', icon: Music },
      ];

      const healthData: ServiceHealth[] = serviceConfigs.map(config => {
        const data = serviceMap.get(config.key) || { calls: 0, failures: 0 };
        const successRate = data.calls > 0 ? ((data.calls - data.failures) / data.calls) * 100 : 100;
        let status: 'healthy' | 'degraded' | 'down' = 'healthy';
        if (successRate < 50) status = 'down';
        else if (successRate < 90) status = 'degraded';

        return {
          name: config.name,
          status,
          latency: Math.floor(Math.random() * 500) + 100, // Mock latency
          successRate,
          callsToday: data.calls,
          failuresToday: data.failures,
          lastError: data.lastError?.metadata?.error,
          lastErrorTime: data.lastError?.created_at,
        };
      });

      // Calculate metrics
      const completedToday = (apiLogs || []).filter((l: any) => l.status === 'completed').length;
      const failedToday = (apiLogs || []).filter((l: any) => l.status === 'failed').length;

      setMetrics({
        activeJobs: (activeClips?.length || 0) + (activeStitches?.length || 0),
        completedToday,
        failedToday,
        averageProcessingTime: 45, // Mock
        queueDepth: activeClips?.filter((c: any) => c.status === 'pending').length || 0,
      });

      setServices(healthData);

      // Transform active jobs
      const jobs: ActiveJob[] = [
        ...(activeClips || []).slice(0, 10).map((clip: any) => ({
          id: clip.id,
          type: 'clip' as const,
          projectId: clip.project_id,
          projectTitle: 'Loading...',
          progress: clip.status === 'generating' ? 50 : 0,
          status: clip.status,
          startedAt: clip.created_at,
          user: 'Loading...',
        })),
        ...(activeStitches || []).slice(0, 5).map((stitch: any) => ({
          id: stitch.id,
          type: 'stitch' as const,
          projectId: stitch.project_id,
          projectTitle: 'Loading...',
          progress: stitch.progress || 0,
          status: stitch.status,
          startedAt: stitch.created_at,
          user: 'Loading...',
        })),
      ];

      setActiveJobs(jobs);

      // Transform errors
      const errors: RecentError[] = (errorLogs || []).map((log: any) => ({
        id: log.id,
        service: log.service,
        operation: log.operation,
        error: (log.metadata as any)?.error || 'Unknown error',
        projectId: log.project_id,
        timestamp: log.created_at,
      }));

      setRecentErrors(errors);
    } catch (err) {
      console.error('Failed to fetch pipeline data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  const getServiceIcon = (name: string) => {
    const icons: Record<string, any> = {
      'Veo Video Gen': Video,
      'OpenAI TTS': Mic,
      'Cloud Run Stitcher': Scissors,
      'OpenAI GPT': Sparkles,
      'DALL-E': Image,
      'Music Gen': Music,
    };
    const Icon = icons[name] || Activity;
    return <Icon className="w-4 h-4" />;
  };

  const getStatusColor = (status: 'healthy' | 'degraded' | 'down') => {
    switch (status) {
      case 'healthy': return 'text-success';
      case 'degraded': return 'text-amber-500';
      case 'down': return 'text-destructive';
    }
  };

  const getStatusBg = (status: 'healthy' | 'degraded' | 'down') => {
    switch (status) {
      case 'healthy': return 'bg-success/10 border-success/30';
      case 'degraded': return 'bg-amber-500/10 border-amber-500/30';
      case 'down': return 'bg-destructive/10 border-destructive/30';
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
      {/* Control Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
              id="auto-refresh"
            />
            <label htmlFor="auto-refresh" className="text-sm text-muted-foreground">
              Auto-refresh (10s)
            </label>
          </div>
          {autoRefresh && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Activity className="w-3 h-3 animate-pulse text-success" />
              Live
            </div>
          )}
        </div>
        <Button variant="outline" onClick={fetchData} disabled={loading}>
          <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
          Refresh Now
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metrics.activeJobs}</p>
                <p className="text-xs text-muted-foreground">Active Jobs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Clock className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metrics.queueDepth}</p>
                <p className="text-xs text-muted-foreground">Queue Depth</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/20">
                <CheckCircle className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metrics.completedToday}</p>
                <p className="text-xs text-muted-foreground">Completed Today</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(
          metrics.failedToday > 0 && "bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20"
        )}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-lg", metrics.failedToday > 0 ? "bg-destructive/20" : "bg-muted")}>
                <XCircle className={cn("w-5 h-5", metrics.failedToday > 0 ? "text-destructive" : "text-muted-foreground")} />
              </div>
              <div>
                <p className="text-2xl font-bold">{metrics.failedToday}</p>
                <p className="text-xs text-muted-foreground">Failed Today</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <TrendingUp className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metrics.averageProcessingTime}s</p>
                <p className="text-xs text-muted-foreground">Avg Process Time</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Service Health Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            Service Health
          </CardTitle>
          <CardDescription>Real-time status of all pipeline services</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((service) => (
              <Card key={service.name} className={cn("border", getStatusBg(service.status))}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {getServiceIcon(service.name)}
                      <span className="font-medium text-sm">{service.name}</span>
                    </div>
                    <Badge variant="outline" className={getStatusColor(service.status)}>
                      {service.status === 'healthy' && <CheckCircle className="w-3 h-3 mr-1" />}
                      {service.status === 'degraded' && <AlertTriangle className="w-3 h-3 mr-1" />}
                      {service.status === 'down' && <XCircle className="w-3 h-3 mr-1" />}
                      {service.status}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Success Rate</span>
                      <span className={cn(
                        "font-mono",
                        service.successRate >= 90 ? "text-success" :
                        service.successRate >= 50 ? "text-amber-500" : "text-destructive"
                      )}>
                        {service.successRate.toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={service.successRate} className="h-1.5" />

                    <div className="flex justify-between text-xs mt-2">
                      <span className="text-muted-foreground">Calls Today</span>
                      <span>{service.callsToday}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Failures</span>
                      <span className={service.failuresToday > 0 ? "text-destructive" : ""}>
                        {service.failuresToday}
                      </span>
                    </div>
                  </div>

                  {service.lastError && (
                    <div className="mt-3 p-2 rounded bg-destructive/10 text-xs">
                      <p className="text-destructive font-medium">Last Error:</p>
                      <p className="text-muted-foreground truncate">{service.lastError}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Jobs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Active Jobs
            </CardTitle>
            <CardDescription>Currently processing jobs</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {activeJobs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="w-12 h-12 mx-auto mb-4 text-success opacity-50" />
                    <p>No active jobs</p>
                  </div>
                ) : (
                  activeJobs.map((job) => (
                    <div key={job.id} className="p-3 rounded-lg border bg-card">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {job.type === 'clip' && <Video className="w-4 h-4 text-primary" />}
                          {job.type === 'stitch' && <Scissors className="w-4 h-4 text-amber-500" />}
                          {job.type === 'voice' && <Mic className="w-4 h-4 text-success" />}
                          <span className="text-sm font-medium capitalize">{job.type}</span>
                        </div>
                        <Badge variant="secondary">{job.status}</Badge>
                      </div>
                      <Progress value={job.progress} className="h-1.5 mb-2" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span className="font-mono">{job.projectId.slice(0, 8)}...</span>
                        <span>{format(new Date(job.startedAt), 'HH:mm:ss')}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Recent Errors */}
        <Card className={cn(recentErrors.length > 0 && "border-destructive/30")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className={cn("w-5 h-5", recentErrors.length > 0 && "text-destructive")} />
              Recent Errors
            </CardTitle>
            <CardDescription>Last 20 pipeline errors</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {recentErrors.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="w-12 h-12 mx-auto mb-4 text-success opacity-50" />
                    <p>No recent errors</p>
                  </div>
                ) : (
                  recentErrors.map((error) => (
                    <div key={error.id} className="p-3 rounded-lg border border-destructive/30 bg-destructive/5">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="outline" className="text-destructive border-destructive/30">
                          {error.service}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(error.timestamp), 'HH:mm:ss')}
                        </span>
                      </div>
                      <p className="text-sm text-destructive truncate">{error.error}</p>
                      <p className="text-xs text-muted-foreground mt-1 font-mono">
                        {error.projectId?.slice(0, 8)}... • {error.operation}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
