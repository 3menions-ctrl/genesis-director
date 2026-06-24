import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FloatSection,
  FloatStat,
  DeckButton,
  StatusPill,
  CYAN,
  ROSE,
  AMBER,
  ACCENT_HSL,
} from '@/admin/ui/primitives';
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

/** Thin borderless gradient progress bar (replaces shadcn Progress). */
function ThinBar({ value, tone = ACCENT_HSL }: { value: number; tone?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: `linear-gradient(90deg, ${tone}, ${CYAN})` }}
      />
    </div>
  );
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

      // LOGIC FIX AD-7: keys must match the service names actually logged to
      // api_cost_logs. The primary clip path logs 'replicate-kling-v3' (plus a
      // legacy 'replicate-kling'); TTS logs 'replicate_minimax' — there is no
      // 'openai-tts' service, so that row was permanently 0/healthy and the main
      // video service under-reported. Aggregate the real keys per row.
      const serviceConfigs: { keys: string[]; name: string; icon: typeof Video }[] = [
        { keys: ['replicate-kling-v3', 'replicate-kling'], name: 'Replicate Kling', icon: Video },
        { keys: ['replicate_minimax'], name: 'Minimax TTS', icon: Mic },
        { keys: ['replicate-musicgen-stereo', 'musicgen'], name: 'MusicGen', icon: Music },
      ];

      const healthData: ServiceHealth[] = serviceConfigs.map(config => {
        const data = config.keys.reduce(
          (acc, k) => {
            const d = serviceMap.get(k);
            if (d) { acc.calls += d.calls; acc.failures += d.failures; if (d.lastError) acc.lastError = d.lastError; }
            return acc;
          },
          { calls: 0, failures: 0, lastError: undefined as any },
        );
        const successRate = data.calls > 0 ? ((data.calls - data.failures) / data.calls) * 100 : 100;
        let status: 'healthy' | 'degraded' | 'down' = 'healthy';
        if (successRate < 50) status = 'down';
        else if (successRate < 90) status = 'degraded';

        return {
          name: config.name,
          status,
          latency: 0, // Not tracked — shown as N/A in UI
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

      // Calculate real average processing time from completed clips today
      const { data: completedClipsToday } = await supabase
        .from('video_clips')
        .select('created_at, updated_at')
        .eq('status', 'completed')
        .gte('updated_at', today.toISOString())
        .limit(100);

      let avgTime = 0;
      if (completedClipsToday && completedClipsToday.length > 0) {
        const totalSeconds = completedClipsToday.reduce((sum, clip) => {
          const created = new Date(clip.created_at).getTime();
          const updated = new Date(clip.updated_at).getTime();
          return sum + (updated - created) / 1000;
        }, 0);
        avgTime = Math.round(totalSeconds / completedClipsToday.length);
      }

      setMetrics({
        activeJobs: (activeClips?.length || 0) + (activeStitches?.length || 0),
        completedToday,
        failedToday,
        averageProcessingTime: avgTime,
        queueDepth: activeClips?.filter((c: any) => c.status === 'pending').length || 0,
      });

      setServices(healthData);

      // Transform active jobs
      const jobs: ActiveJob[] = [
        ...(activeClips || []).slice(0, 10).map((clip: any) => ({
          id: clip.id,
          type: 'clip' as const,
          projectId: clip.project_id,
          projectTitle: 'Loading…',
          progress: 0, // clips expose no real progress signal — rendered as an indeterminate bar, not a fabricated 50%
          status: clip.status,
          startedAt: clip.created_at,
          user: 'Loading…',
        })),
        ...(activeStitches || []).slice(0, 5).map((stitch: any) => ({
          id: stitch.id,
          type: 'stitch' as const,
          projectId: stitch.project_id,
          projectTitle: 'Loading…',
          progress: stitch.progress || 0,
          status: stitch.status,
          startedAt: stitch.created_at,
          user: 'Loading…',
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
      'Kling 2.6 Video': Video,
      'OpenAI TTS': Mic,
      'Cloud Run Stitcher': Scissors,
      'OpenAI GPT': Sparkles,
      'DALL-E': Image,
      'Music Gen': Music,
    };
    const Icon = icons[name] || Activity;
    return <Icon className="w-4 h-4 text-white/60" />;
  };

  const statusTone = (status: 'healthy' | 'degraded' | 'down') =>
    status === 'healthy' ? 'positive' : status === 'degraded' ? 'warn' : 'danger';

  const rateColor = (rate: number) =>
    rate >= 90 ? CYAN : rate >= 50 ? AMBER : ROSE;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: ACCENT_HSL }} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Control Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
              id="auto-refresh"
            />
            <label htmlFor="auto-refresh" className="text-sm text-white/50">
              Auto-refresh (10s)
            </label>
          </div>
          {autoRefresh && (
            <div className="flex items-center gap-1 text-xs text-white/50">
              <Activity className="w-3 h-3 animate-pulse" style={{ color: CYAN }} />
              Live
            </div>
          )}
        </div>
        <DeckButton onClick={fetchData} disabled={loading}>
          <RefreshCw className={cn('w-3.5 h-3.5 mr-2', loading && 'animate-spin')} />
          Refresh Now
        </DeckButton>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-x-6 gap-y-8">
        <FloatStat label="Active Jobs" value={metrics.activeJobs} icon={Zap} accentNumber index={0} />
        <FloatStat label="Queue Depth" value={metrics.queueDepth} icon={Clock} index={1} />
        <FloatStat label="Completed Today" value={metrics.completedToday} icon={CheckCircle} index={2} />
        <FloatStat label="Failed Today" value={metrics.failedToday} icon={XCircle} index={3} />
        <FloatStat label="Avg Process Time" value={`${metrics.averageProcessingTime}s`} icon={TrendingUp} index={4} />
      </div>

      {/* Service Health Grid */}
      <FloatSection title="Service Health" meta="real-time pipeline services">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((service) => (
            <div
              key={service.name}
              className="rounded-xl p-4"
              style={{ border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {getServiceIcon(service.name)}
                  <span className="font-medium text-sm text-white/85">{service.name}</span>
                </div>
                <StatusPill tone={statusTone(service.status)}>
                  {service.status === 'healthy' && <CheckCircle className="w-3 h-3" />}
                  {service.status === 'degraded' && <AlertTriangle className="w-3 h-3" />}
                  {service.status === 'down' && <XCircle className="w-3 h-3" />}
                  {service.status}
                </StatusPill>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-white/45">Success Rate</span>
                  <span className="font-mono" style={{ color: rateColor(service.successRate) }}>
                    {service.successRate.toFixed(1)}%
                  </span>
                </div>
                <ThinBar value={service.successRate} tone={rateColor(service.successRate)} />

                <div className="flex justify-between text-xs mt-2">
                  <span className="text-white/45">Calls Today</span>
                  <span className="text-white/80">{service.callsToday}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/45">Failures</span>
                  <span style={service.failuresToday > 0 ? { color: ROSE } : undefined} className={service.failuresToday > 0 ? '' : 'text-white/80'}>
                    {service.failuresToday}
                  </span>
                </div>
              </div>

              {service.lastError && (
                <div className="mt-3 p-2 rounded" style={{ background: 'hsl(350 90% 70% / 0.08)' }}>
                  <p className="text-xs font-medium" style={{ color: ROSE }}>Last Error:</p>
                  <p className="text-xs text-white/45 truncate">{service.lastError}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </FloatSection>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Active Jobs */}
        <FloatSection title="Active Jobs" meta="currently processing">
          <ScrollArea className="h-[300px]">
            <div className="space-y-3">
              {activeJobs.length === 0 ? (
                <div className="text-center py-8 text-white/45">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" style={{ color: CYAN }} />
                  <p>No active jobs</p>
                </div>
              ) : (
                activeJobs.map((job) => (
                  <div key={job.id} className="p-3 rounded-lg" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {job.type === 'clip' && <Video className="w-4 h-4" style={{ color: ACCENT_HSL }} />}
                        {job.type === 'stitch' && <Scissors className="w-4 h-4" style={{ color: AMBER }} />}
                        {job.type === 'voice' && <Mic className="w-4 h-4" style={{ color: CYAN }} />}
                        <span className="text-sm font-medium capitalize text-white/85">{job.type}</span>
                      </div>
                      <StatusPill tone="neutral">{job.status}</StatusPill>
                    </div>
                    {job.type === 'clip' ? (
                      // Clips report no real progress — show an honest
                      // indeterminate bar instead of a fixed fake percentage.
                      <div className="h-1.5 mb-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <div className="h-full w-2/3 rounded-full animate-pulse" style={{ background: `linear-gradient(90deg, ${ACCENT_HSL}, ${CYAN})` }} />
                      </div>
                    ) : (
                      <div className="mb-2">
                        <ThinBar value={job.progress} />
                      </div>
                    )}
                    <div className="flex justify-between text-xs text-white/45">
                      <span className="font-mono">{job.projectId.slice(0, 8)}...</span>
                      <span>{format(new Date(job.startedAt), 'HH:mm:ss')}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </FloatSection>

        {/* Recent Errors */}
        <FloatSection title="Recent Errors" meta="last 20 pipeline errors">
          <ScrollArea className="h-[300px]">
            <div className="space-y-2">
              {recentErrors.length === 0 ? (
                <div className="text-center py-8 text-white/45">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" style={{ color: CYAN }} />
                  <p>No recent errors</p>
                </div>
              ) : (
                recentErrors.map((error) => (
                  <div key={error.id} className="p-3 rounded-lg" style={{ border: '1px solid hsl(350 90% 70% / 0.22)', background: 'hsl(350 90% 70% / 0.04)' }}>
                    <div className="flex items-center justify-between mb-1">
                      <StatusPill tone="danger">{error.service}</StatusPill>
                      <span className="text-xs text-white/45">
                        {format(new Date(error.timestamp), 'HH:mm:ss')}
                      </span>
                    </div>
                    <p className="text-sm truncate" style={{ color: ROSE }}>{error.error}</p>
                    <p className="text-xs text-white/45 mt-1 font-mono">
                      {error.projectId?.slice(0, 8)}... • {error.operation}
                    </p>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </FloatSection>
      </div>
    </div>
  );
}
