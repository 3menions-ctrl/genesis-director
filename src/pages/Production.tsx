import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { 
  Film, Loader2, CheckCircle2, XCircle, Play, Download, Clock, ArrowLeft,
  RotateCcw, Layers, Sparkles, AlertCircle, ExternalLink, RefreshCw,
  ChevronRight, Zap, Eye, X, FileText, Users, Shield, Wand2, Volume2,
  Music, Activity, Radio, Cpu, Server, Box, GitBranch, Terminal
} from 'lucide-react';
import { ManifestVideoPlayer } from '@/components/studio/ManifestVideoPlayer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { parsePendingVideoTasks } from '@/types/pending-video-tasks';
import { StitchingTroubleshooter } from '@/components/studio/StitchingTroubleshooter';

// ============= TYPES =============

interface StageStatus {
  name: string;
  shortName: string;
  icon: React.ElementType;
  status: 'pending' | 'active' | 'complete' | 'error' | 'skipped';
  details?: string;
  progress?: number;
}

interface ClipResult {
  index: number;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
  id?: string;
}

interface PipelineLog {
  id: string;
  time: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  stage?: string;
}

interface ProductionProject {
  id: string;
  title: string;
  status: string;
  progress: number;
  clipsCompleted: number;
  totalClips: number;
  thumbnail?: string;
  updatedAt: string;
}

// ============= CONSTANTS =============

const STAGE_CONFIG: Array<{ name: string; shortName: string; icon: React.ElementType }> = [
  { name: 'Script Generation', shortName: 'Script', icon: FileText },
  { name: 'Identity Analysis', shortName: 'Identity', icon: Users },
  { name: 'Quality Audit', shortName: 'QA', icon: Shield },
  { name: 'Asset Creation', shortName: 'Assets', icon: Wand2 },
  { name: 'Video Production', shortName: 'Production', icon: Film },
  { name: 'Final Assembly', shortName: 'Assembly', icon: Sparkles },
];

// ============= ANIMATED PIPELINE COMPONENT =============

function AnimatedPipeline({ 
  stages, 
  currentStageIndex, 
  progress 
}: { 
  stages: StageStatus[]; 
  currentStageIndex: number;
  progress: number;
}) {
  return (
    <div className="relative">
      {/* Connection line */}
      <div className="absolute top-1/2 left-0 right-0 h-1 -translate-y-1/2 hidden lg:block">
        <div className="absolute inset-0 bg-white/[0.05] rounded-full" />
        <motion.div 
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 via-white to-emerald-500 rounded-full"
          style={{ width: `${Math.min((currentStageIndex / (stages.length - 1)) * 100 + (progress / stages.length), 100)}%` }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min((currentStageIndex / (stages.length - 1)) * 100 + (progress / stages.length / 100) * (100 / stages.length), 100)}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
        {/* Animated pulse on the line */}
        {currentStageIndex >= 0 && currentStageIndex < stages.length && stages[currentStageIndex]?.status === 'active' && (
          <motion.div
            className="absolute top-1/2 w-4 h-4 -translate-y-1/2 rounded-full bg-white shadow-lg shadow-white/50"
            style={{ left: `${(currentStageIndex / (stages.length - 1)) * 100}%` }}
            animate={{ 
              scale: [1, 1.5, 1],
              opacity: [1, 0.5, 1]
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
      </div>

      {/* Stage nodes */}
      <div className="relative grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {stages.map((stage, index) => {
          const isActive = stage.status === 'active';
          const isComplete = stage.status === 'complete';
          const isPending = stage.status === 'pending';
          const isError = stage.status === 'error';
          const Icon = stage.icon;

          return (
            <motion.div
              key={stage.name}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: index * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="relative"
            >
              <div className={cn(
                "relative p-4 rounded-2xl border transition-all duration-500",
                isComplete && "bg-emerald-500/10 border-emerald-500/30 shadow-lg shadow-emerald-500/5",
                isActive && "bg-white/[0.08] border-white/30 shadow-xl shadow-white/10",
                isPending && "bg-white/[0.02] border-white/[0.06]",
                isError && "bg-red-500/10 border-red-500/30"
              )}>
                {/* Active glow ring */}
                {isActive && (
                  <>
                    <motion.div 
                      className="absolute inset-0 rounded-2xl border-2 border-white/30"
                      animate={{ scale: [1, 1.05, 1], opacity: [0.5, 0, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                    <motion.div
                      className="absolute inset-0 rounded-2xl bg-gradient-to-r from-white/5 via-white/10 to-white/5"
                      animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
                      transition={{ duration: 3, repeat: Infinity }}
                    />
                  </>
                )}

                <div className="relative flex flex-col items-center text-center">
                  {/* Icon container */}
                  <div className={cn(
                    "relative w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-all duration-300",
                    isComplete && "bg-emerald-500/20",
                    isActive && "bg-white/10",
                    isPending && "bg-white/[0.04]",
                    isError && "bg-red-500/20"
                  )}>
                    {isActive ? (
                      <div className="relative">
                        <motion.div
                          className="absolute inset-0 bg-white/20 rounded-full"
                          animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        />
                        <Loader2 className="relative w-5 h-5 text-white animate-spin" />
                      </div>
                    ) : isComplete ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 15 }}
                      >
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      </motion.div>
                    ) : isError ? (
                      <XCircle className="w-5 h-5 text-red-400" />
                    ) : (
                      <Icon className={cn("w-5 h-5 transition-colors", isPending ? "text-white/30" : "text-white/70")} />
                    )}
                  </div>
                  
                  <h3 className={cn(
                    "text-xs font-semibold transition-colors mb-1",
                    isComplete && "text-emerald-400",
                    isActive && "text-white",
                    isPending && "text-white/40",
                    isError && "text-red-400"
                  )}>
                    {stage.shortName}
                  </h3>
                  
                  {stage.details && (
                    <motion.span 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "text-[10px] font-medium px-2 py-0.5 rounded-full",
                        isComplete && "bg-emerald-500/20 text-emerald-400",
                        isActive && "bg-white/10 text-white/70"
                      )}
                    >
                      {stage.details}
                    </motion.span>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ============= UNIFIED ACTIVITY LOG =============

function UnifiedActivityLog({ logs, isLive }: { logs: PipelineLog[]; isLive: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl bg-[#0a0a0a] border border-white/[0.08]"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <div className="relative">
            {isLive && (
              <motion.div
                className="absolute inset-0 bg-emerald-500 rounded-full"
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
            <Terminal className={cn("relative w-4 h-4", isLive ? "text-emerald-400" : "text-white/50")} />
          </div>
          <span className="text-sm font-semibold text-white">Activity Log</span>
          {isLive && (
            <motion.span 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider"
            >
              Live
            </motion.span>
          )}
        </div>
        <span className="text-xs text-white/30">{logs.length} events</span>
      </div>

      {/* Logs */}
      <div ref={scrollRef} className="h-[240px] overflow-y-auto p-4 space-y-1.5">
        <AnimatePresence mode="popLayout">
          {logs.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-white/30 text-sm">Waiting for pipeline events...</p>
            </div>
          ) : (
            logs.map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -20, height: 0 }}
                animate={{ opacity: 1, x: 0, height: 'auto' }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="flex items-start gap-3 py-1.5 group"
              >
                <span className="text-[10px] font-mono text-white/30 shrink-0 mt-0.5">{log.time}</span>
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full mt-1.5 shrink-0",
                  log.type === 'success' && "bg-emerald-400",
                  log.type === 'error' && "bg-red-400",
                  log.type === 'warning' && "bg-amber-400",
                  log.type === 'info' && "bg-white/40"
                )} />
                <span className={cn(
                  "text-xs leading-relaxed",
                  log.type === 'success' && "text-emerald-400",
                  log.type === 'error' && "text-red-400",
                  log.type === 'warning' && "text-amber-400",
                  log.type === 'info' && "text-white/60"
                )}>
                  {log.message}
                </span>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Animated gradient line at bottom when live */}
      {isLive && (
        <motion.div
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500/0 via-emerald-500 to-emerald-500/0"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
    </motion.div>
  );
}

// ============= CLIP PROGRESS GRID =============

function ClipProgressGrid({ 
  clips, 
  onPlay, 
  onRetry, 
  retryingIndex 
}: { 
  clips: ClipResult[];
  onPlay: (url: string) => void;
  onRetry: (index: number) => void;
  retryingIndex: number | null;
}) {
  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
      {clips.map((clip, index) => {
        const isCompleted = clip.status === 'completed';
        const isGenerating = clip.status === 'generating';
        const isFailed = clip.status === 'failed';
        const isPending = clip.status === 'pending';
        const isRetrying = retryingIndex === index;

        return (
          <motion.div
            key={index}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.02, duration: 0.3 }}
            className={cn(
              "relative aspect-video rounded-lg overflow-hidden cursor-pointer transition-all duration-300 group",
              "border",
              isCompleted && "border-emerald-500/50 hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-500/10",
              isGenerating && "border-white/30",
              isFailed && "border-red-500/50 hover:border-red-400",
              isPending && "border-white/[0.06]"
            )}
            onClick={() => {
              if (isCompleted && clip.videoUrl) onPlay(clip.videoUrl);
              else if (isFailed) onRetry(index);
            }}
          >
            {/* Content */}
            {isCompleted && clip.videoUrl ? (
              <>
                <video
                  src={clip.videoUrl}
                  className="absolute inset-0 w-full h-full object-cover"
                  muted
                  preload="metadata"
                  onLoadedData={(e) => { (e.target as HTMLVideoElement).currentTime = 1; }}
                />
                <motion.div
                  initial={{ opacity: 0 }}
                  whileHover={{ opacity: 1 }}
                  className="absolute inset-0 bg-black/60 flex items-center justify-center"
                >
                  <Play className="w-4 h-4 text-white" fill="currentColor" />
                </motion.div>
              </>
            ) : isGenerating ? (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-white/[0.06] to-transparent">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <Loader2 className="w-4 h-4 text-white/60" />
                </motion.div>
              </div>
            ) : isFailed ? (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-red-500/10 to-transparent">
                {isRetrying ? (
                  <Loader2 className="w-4 h-4 text-red-400 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 text-red-400" />
                )}
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-white/[0.02] to-transparent">
                <span className="text-sm font-bold text-white/15">{index + 1}</span>
              </div>
            )}

            {/* Index badge */}
            <div className="absolute bottom-1 left-1 px-1 py-0.5 rounded bg-black/60 backdrop-blur-sm">
              <span className="text-[9px] font-bold text-white">{index + 1}</span>
            </div>

            {/* Status indicator */}
            {isCompleted && (
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-1 right-1"
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-400 drop-shadow-lg" />
              </motion.div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

// ============= PRODUCTION PROJECTS LIST =============

function ProductionProjectsList({ 
  projects, 
  activeProjectId, 
  onSelect 
}: { 
  projects: ProductionProject[];
  activeProjectId: string | null;
  onSelect: (id: string) => void;
}) {
  if (projects.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]"
    >
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-4 h-4 text-white/50" />
        <span className="text-sm font-semibold text-white">Active Productions</span>
        <Badge variant="outline" className="text-amber-400 border-amber-500/30 text-[10px]">
          {projects.length}
        </Badge>
      </div>

      <div className="space-y-2">
        {projects.map((project, index) => (
          <motion.button
            key={project.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => onSelect(project.id)}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-300 text-left group",
              activeProjectId === project.id 
                ? "bg-white/[0.08] border border-white/20" 
                : "bg-white/[0.02] border border-transparent hover:bg-white/[0.05] hover:border-white/10"
            )}
          >
            {/* Thumbnail/Status */}
            <div className="relative w-12 h-8 rounded-lg overflow-hidden bg-white/5 shrink-0">
              {project.thumbnail ? (
                <img src={project.thumbnail} className="w-full h-full object-cover" alt="" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Film className="w-4 h-4 text-white/20" />
                </div>
              )}
              {['generating', 'producing', 'stitching'].includes(project.status) && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Loader2 className="w-3 h-3 text-white animate-spin" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{project.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-white/50 to-white"
                    initial={{ width: 0 }}
                    animate={{ width: `${project.progress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <span className="text-[10px] text-white/40 shrink-0">{project.progress}%</span>
              </div>
            </div>

            {/* Clips count */}
            <div className="text-right shrink-0">
              <span className="text-xs text-white/60">{project.clipsCompleted}/{project.totalClips}</span>
              <p className="text-[10px] text-white/30">clips</p>
            </div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

// ============= MAIN COMPONENT =============

export default function Production() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const { user } = useAuth();
  
  // Core state
  const [isLoading, setIsLoading] = useState(true);
  const [isResuming, setIsResuming] = useState(false);
  const [projectTitle, setProjectTitle] = useState('');
  const [projectStatus, setProjectStatus] = useState('');
  const [stages, setStages] = useState<StageStatus[]>(
    STAGE_CONFIG.map(s => ({ ...s, status: 'pending' as const }))
  );
  const [progress, setProgress] = useState(0);
  const [clipResults, setClipResults] = useState<ClipResult[]>([]);
  const [pipelineLogs, setPipelineLogs] = useState<PipelineLog[]>([]);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [auditScore, setAuditScore] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startTime] = useState<number>(Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);
  const [completedClips, setCompletedClips] = useState(0);
  const [selectedClipUrl, setSelectedClipUrl] = useState<string | null>(null);
  const [retryingClipIndex, setRetryingClipIndex] = useState<number | null>(null);
  const [expectedClipCount, setExpectedClipCount] = useState(6);
  const [isSimpleStitching, setIsSimpleStitching] = useState(false);
  const [autoStitchAttempted, setAutoStitchAttempted] = useState(false);
  const [allProductionProjects, setAllProductionProjects] = useState<ProductionProject[]>([]);

  // Animation values
  const springProgress = useSpring(progress, { stiffness: 100, damping: 30 });

  // Log ID counter
  const logIdRef = useRef(0);

  // Add log helper
  const addLog = useCallback((message: string, type: PipelineLog['type'] = 'info', stage?: string) => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const id = `log-${logIdRef.current++}`;
    setPipelineLogs(prev => [...prev, { id, time, message, type, stage }].slice(-100));
  }, []);

  // Update stage status
  const updateStageStatus = useCallback((stageIndex: number, status: StageStatus['status'], details?: string) => {
    setStages(prev => {
      const updated = [...prev];
      if (updated[stageIndex]) {
        updated[stageIndex] = { ...updated[stageIndex], status, details };
      }
      return updated;
    });
  }, []);

  // Load video clips
  const loadVideoClips = useCallback(async () => {
    if (!projectId) return;
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    
    const { data: clips, error: clipsError } = await supabase
      .from('video_clips')
      .select('id, shot_index, status, video_url, error_message')
      .eq('project_id', projectId)
      .eq('user_id', session.user.id)
      .order('shot_index');
    
    if (!clipsError && clips) {
      setClipResults(clips.map(clip => ({
        index: clip.shot_index,
        status: clip.status as ClipResult['status'],
        videoUrl: clip.video_url || undefined,
        error: clip.error_message || undefined,
        id: clip.id,
      })));
      setCompletedClips(clips.filter(c => c.status === 'completed').length);
    }
  }, [projectId]);

  // Load all production projects
  const loadAllProductionProjects = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { data: projects } = await supabase
      .from('movie_projects')
      .select('id, title, status, pending_video_tasks, thumbnail_url, updated_at')
      .eq('user_id', session.user.id)
      .in('status', ['generating', 'producing', 'rendering', 'stitching'])
      .order('updated_at', { ascending: false });

    if (projects) {
      setAllProductionProjects(projects.map(p => {
        const tasks = parsePendingVideoTasks(p.pending_video_tasks);
        return {
          id: p.id,
          title: p.title,
          status: p.status,
          progress: tasks?.progress || 0,
          clipsCompleted: tasks?.clipsCompleted || 0,
          totalClips: tasks?.clipCount || 6,
          thumbnail: p.thumbnail_url || undefined,
          updatedAt: p.updated_at,
        };
      }));
    }
  }, []);

  // Timer effect
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  // Initial load
  useEffect(() => {
    const loadProject = async () => {
      if (!projectId) {
        setIsLoading(false);
        return;
      }
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate('/auth');
        return;
      }

      const { data: project, error: projectError } = await supabase
        .from('movie_projects')
        .select('*')
        .eq('id', projectId)
        .eq('user_id', session.user.id)
        .single();

      if (projectError || !project) {
        toast.error('Project not found');
        navigate('/projects');
        return;
      }

      setProjectTitle(project.title);
      setProjectStatus(project.status);
      
      if (project.video_url) {
        setFinalVideoUrl(project.video_url);
      }

      const tasks = parsePendingVideoTasks(project.pending_video_tasks);
      if (tasks) {
        if (tasks.progress) setProgress(tasks.progress);
        if (tasks.clipCount) setExpectedClipCount(tasks.clipCount);
        if (tasks.auditScore) setAuditScore(tasks.auditScore);
        
        // Set stage statuses based on tasks
        if (tasks.stage) {
          const stageMap: Record<string, number> = {
            'preproduction': 0, 'qualitygate': 2, 'assets': 3,
            'production': 4, 'postproduction': 5, 'complete': 5,
          };
          const idx = stageMap[tasks.stage];
          if (idx !== undefined) {
            for (let i = 0; i < idx; i++) updateStageStatus(i, 'complete');
            if (tasks.stage !== 'complete') updateStageStatus(idx, 'active');
            else updateStageStatus(idx, 'complete');
          }
        }
      }

      await loadVideoClips();
      await loadAllProductionProjects();
      
      addLog('Connected to production pipeline', 'info');
      setIsLoading(false);
    };

    loadProject();
  }, [projectId, navigate, updateStageStatus, loadVideoClips, loadAllProductionProjects, addLog]);

  // Realtime subscriptions
  useEffect(() => {
    if (!projectId || !user) return;

    const projectChannel = supabase
      .channel(`production_${projectId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'movie_projects',
        filter: `id=eq.${projectId}`,
      }, (payload) => {
        const project = payload.new as Record<string, unknown>;
        if (!project) return;

        setProjectStatus(project.status as string);
        if (project.video_url) setFinalVideoUrl(project.video_url as string);

        const tasks = parsePendingVideoTasks(project.pending_video_tasks);
        if (tasks) {
          if (tasks.progress) {
            setProgress(tasks.progress);
            springProgress.set(tasks.progress);
          }

          const stageMap: Record<string, number> = {
            'preproduction': 0, 'qualitygate': 2, 'assets': 3,
            'production': 4, 'postproduction': 5,
          };

          if (tasks.stage && stageMap[tasks.stage] !== undefined) {
            const idx = stageMap[tasks.stage];
            for (let i = 0; i < idx; i++) {
              if (stages[i]?.status !== 'complete') updateStageStatus(i, 'complete');
            }
            updateStageStatus(idx, 'active');
          }

          if (tasks.scriptGenerated && !pipelineLogs.some(l => l.message.includes('Script generated'))) {
            addLog('Script generated successfully', 'success');
            updateStageStatus(0, 'complete', `${tasks.shotCount || '?'} shots`);
          }

          if (tasks.auditScore && auditScore !== tasks.auditScore) {
            setAuditScore(tasks.auditScore);
            updateStageStatus(2, 'complete', `${tasks.auditScore}%`);
            addLog(`Quality score: ${tasks.auditScore}/100`, 'success');
          }

          if (tasks.charactersExtracted) {
            updateStageStatus(1, 'complete', `${tasks.charactersExtracted} chars`);
          }

          if (tasks.clipsCompleted !== undefined) {
            const clipCount = tasks.clipCount || expectedClipCount;
            setCompletedClips(tasks.clipsCompleted);
            setExpectedClipCount(clipCount);
            updateStageStatus(4, 'active', `${tasks.clipsCompleted}/${clipCount}`);
            addLog(`Clips: ${tasks.clipsCompleted}/${clipCount} completed`, 'info');
          }

          if (tasks.stage === 'complete' && tasks.finalVideoUrl) {
            setFinalVideoUrl(tasks.finalVideoUrl);
            setProgress(100);
            stages.forEach((_, i) => updateStageStatus(i, 'complete'));
            addLog('Pipeline completed successfully!', 'success');
            toast.success('Video generated successfully!');
          }

          if (tasks.stage === 'error') {
            setError(tasks.error || 'Pipeline failed');
            addLog(`Error: ${tasks.error || 'Pipeline failed'}`, 'error');
          }
        }
      })
      .subscribe();

    const clipsChannel = supabase
      .channel(`clips_${projectId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'video_clips',
        filter: `project_id=eq.${projectId}`,
      }, (payload) => {
        if (payload.new) {
          const clip = payload.new as Record<string, unknown>;
          if (clip.status === 'completed') {
            loadVideoClips();
            addLog(`Clip ${(clip.shot_index as number) + 1} completed`, 'success');
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(projectChannel);
      supabase.removeChannel(clipsChannel);
    };
  }, [projectId, user, stages, pipelineLogs, auditScore, expectedClipCount, updateStageStatus, addLog, loadVideoClips, springProgress]);

  // Auto-stitch when all clips complete
  useEffect(() => {
    const allComplete = completedClips >= expectedClipCount && expectedClipCount > 0;
    const shouldTrigger = allComplete && 
      !['completed', 'stitching', 'failed'].includes(projectStatus) &&
      !autoStitchAttempted && !isSimpleStitching;

    if (shouldTrigger) {
      const timer = setTimeout(async () => {
        setAutoStitchAttempted(true);
        addLog('All clips complete! Starting final assembly...', 'info');
        updateStageStatus(5, 'active', 'Stitching...');
        setProgress(85);

        try {
          const { data, error } = await supabase.functions.invoke('auto-stitch-trigger', {
            body: { projectId, userId: user?.id, forceStitch: false },
          });

          if (error) throw error;

          if (data?.success) {
            if (data.stitchResult?.finalVideoUrl || data.finalVideoUrl) {
              setFinalVideoUrl(data.stitchResult?.finalVideoUrl || data.finalVideoUrl);
              setProjectStatus('completed');
              setProgress(100);
              updateStageStatus(5, 'complete');
              addLog('Video assembly complete!', 'success');
              toast.success('Video generated successfully!');
            } else {
              addLog('Stitching in progress via Cloud Run...', 'info');
            }
          }
        } catch (err: any) {
          addLog(`Auto-stitch failed: ${err.message}`, 'error');
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [completedClips, expectedClipCount, projectStatus, autoStitchAttempted, isSimpleStitching, projectId, user, addLog, updateStageStatus]);

  // Handle retry clip
  const handleRetryClip = async (clipIndex: number) => {
    if (!projectId || !user) return;
    setRetryingClipIndex(clipIndex);
    addLog(`Retrying clip ${clipIndex + 1}...`, 'info');
    
    try {
      const { data, error } = await supabase.functions.invoke('retry-failed-clip', {
        body: { userId: user.id, projectId, clipIndex },
      });
      
      if (error) throw error;
      if (data?.success) {
        toast.success(`Clip ${clipIndex + 1} regenerated!`);
        addLog(`Clip ${clipIndex + 1} succeeded`, 'success');
        await loadVideoClips();
      }
    } catch (err: any) {
      toast.error(`Failed to retry clip ${clipIndex + 1}`);
      addLog(`Clip ${clipIndex + 1} retry failed`, 'error');
    } finally {
      setRetryingClipIndex(null);
    }
  };

  // Handle simple stitch
  const handleSimpleStitch = async () => {
    if (!projectId || !user || isSimpleStitching) return;
    setIsSimpleStitching(true);
    addLog('Starting simple stitch...', 'info');
    
    try {
      const { data: clips } = await supabase
        .from('video_clips')
        .select('id, shot_index, video_url, duration_seconds')
        .eq('project_id', projectId)
        .eq('status', 'completed')
        .order('shot_index');

      if (!clips?.length) throw new Error('No clips found');

      const { data, error } = await supabase.functions.invoke('simple-stitch', {
        body: {
          projectId,
          clips: clips.map(c => ({ shotId: c.id, videoUrl: c.video_url, durationSeconds: c.duration_seconds || 4 })),
        },
      });

      if (error) throw error;
      if (data?.success && data?.finalVideoUrl) {
        setFinalVideoUrl(data.finalVideoUrl);
        setProjectStatus('completed');
        setProgress(100);
        updateStageStatus(5, 'complete');
        addLog('Simple stitch complete!', 'success');
        toast.success('Video assembled successfully!');
      }
    } catch (err: any) {
      addLog(`Simple stitch failed: ${err.message}`, 'error');
      toast.error('Stitch failed', { description: err.message });
    } finally {
      setIsSimpleStitching(false);
    }
  };

  // Handle resume
  const handleResume = async () => {
    if (!projectId || !user || isResuming) return;
    setIsResuming(true);
    addLog('Resuming pipeline...', 'info');
    
    try {
      const { data, error } = await supabase.functions.invoke('resume-pipeline', {
        body: { userId: user.id, projectId, resumeFrom: 'production' },
      });
      
      if (error) throw error;
      if (data?.success) {
        addLog('Pipeline resumed', 'success');
        toast.success('Pipeline resumed');
        setProjectStatus('generating');
      }
    } catch (err: any) {
      addLog(`Resume failed: ${err.message}`, 'error');
      toast.error('Failed to resume');
    } finally {
      setIsResuming(false);
    }
  };

  // Helpers
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isRunning = !['completed', 'failed', 'draft'].includes(projectStatus);
  const isComplete = projectStatus === 'completed';
  const isError = projectStatus === 'failed';
  const currentStageIndex = stages.findIndex(s => s.status === 'active');

  // Loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4">
          <div className="relative">
            <motion.div className="absolute inset-0 bg-white/10 rounded-full blur-xl" animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }} />
            <Loader2 className="relative w-10 h-10 animate-spin text-white" />
          </div>
          <p className="text-white/50 text-sm">Loading production studio...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] relative overflow-hidden">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none">
        <motion.div 
          className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-br from-white/[0.02] to-transparent blur-[100px]"
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div 
          className="absolute bottom-[-30%] right-[-10%] w-[70vw] h-[70vw] rounded-full bg-gradient-to-tl from-white/[0.015] to-transparent blur-[120px]"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 10, repeat: Infinity, delay: 2 }}
        />
      </div>

      {/* Header */}
      <nav className="sticky top-0 z-50 backdrop-blur-2xl bg-black/60 border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-14 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="text-white/60 hover:text-white" onClick={() => navigate('/projects')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center",
                  isComplete ? "bg-emerald-500/20" : isError ? "bg-red-500/20" : "bg-white/10"
                )}>
                  {isRunning && <Loader2 className="w-4 h-4 text-white animate-spin" />}
                  {isComplete && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  {isError && <XCircle className="w-4 h-4 text-red-400" />}
                  {!isRunning && !isComplete && !isError && <Film className="w-4 h-4 text-white/70" />}
                </div>
                <div>
                  <h1 className="text-sm font-semibold text-white">Production Studio</h1>
                  <p className="text-xs text-white/40 truncate max-w-[150px] sm:max-w-none">{projectTitle}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {isRunning && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10">
                  <motion.div className="w-2 h-2 rounded-full bg-emerald-400" animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1, repeat: Infinity }} />
                  <span className="text-xs font-medium text-white">Live</span>
                </motion.div>
              )}
              
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06]">
                <Clock className="w-3.5 h-3.5 text-white/50" />
                <span className="text-xs font-mono text-white">{formatTime(elapsedTime)}</span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Progress Hero */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-6 rounded-3xl bg-gradient-to-br from-white/[0.04] to-transparent border border-white/[0.08]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-white mb-1">
                {isComplete ? 'Production Complete!' : isError ? 'Production Failed' : 'Production in Progress'}
              </h2>
              <p className="text-sm text-white/40">
                {isComplete ? 'Your video is ready' : isError ? 'An error occurred' : `Stage ${Math.max(currentStageIndex + 1, 1)} of ${stages.length}`}
              </p>
            </div>
            <motion.span 
              className={cn("text-4xl font-bold", isComplete ? "text-emerald-400" : isError ? "text-red-400" : "text-white")}
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              key={Math.round(progress)}
            >
              {Math.round(progress)}%
            </motion.span>
          </div>
          
          <div className="relative h-2 rounded-full bg-white/[0.06] overflow-hidden">
            <motion.div
              className={cn(
                "absolute inset-y-0 left-0 rounded-full",
                isComplete ? "bg-gradient-to-r from-emerald-500 to-emerald-400" 
                  : isError ? "bg-gradient-to-r from-red-500 to-red-400"
                  : "bg-gradient-to-r from-white/60 to-white"
              )}
              style={{ width: `${progress}%` }}
            />
            {isRunning && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              />
            )}
          </div>
        </motion.section>

        {/* Pipeline Stages */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-4 h-4 text-white/50" />
            <span className="text-sm font-semibold text-white">Pipeline Stages</span>
          </div>
          <AnimatedPipeline stages={stages} currentStageIndex={currentStageIndex} progress={progress} />
        </motion.section>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Clips + Status */}
          <div className="lg:col-span-2 space-y-6">
            {/* Clips Grid */}
            {clipResults.length > 0 && (
              <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Film className="w-4 h-4 text-white/50" />
                    <span className="text-sm font-semibold text-white">Video Clips</span>
                    <span className="text-xs text-white/40">{completedClips}/{clipResults.length}</span>
                  </div>
                  {completedClips > 0 && (
                    <Button variant="ghost" size="sm" className="text-white/50 hover:text-white text-xs" onClick={() => navigate(`/clips?projectId=${projectId}`)}>
                      View All <ChevronRight className="w-3 h-3 ml-1" />
                    </Button>
                  )}
                </div>
                <ClipProgressGrid 
                  clips={clipResults}
                  onPlay={setSelectedClipUrl}
                  onRetry={handleRetryClip}
                  retryingIndex={retryingClipIndex}
                />
              </motion.section>
            )}

            {/* Status Cards */}
            {projectStatus === 'stitching' && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-5 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
                <div className="flex items-center gap-3 mb-3">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }}>
                    <Cpu className="w-5 h-5 text-white" />
                  </motion.div>
                  <span className="text-sm font-semibold text-white">Final Assembly</span>
                </div>
                <p className="text-xs text-white/50 mb-3">Cloud Run is processing your video...</p>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-white/40 to-white"
                    animate={{ width: ['20%', '80%', '40%', '90%'] }}
                    transition={{ duration: 4, repeat: Infinity }}
                  />
                </div>
              </motion.div>
            )}

            {error && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-5 rounded-2xl bg-red-500/10 border border-red-500/30">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-400 mb-1">Pipeline Error</p>
                    <p className="text-xs text-white/50 mb-3">{error}</p>
                    <div className="flex gap-2">
                      {completedClips > 0 && (
                        <Button size="sm" className="bg-white text-black hover:bg-white/90 rounded-full" onClick={handleResume} disabled={isResuming}>
                          {isResuming ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RotateCcw className="w-3 h-3 mr-1" />}
                          Resume
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="rounded-full border-white/10 text-white/70" onClick={() => navigate('/create')}>
                        Start New
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {projectStatus === 'stitching_failed' && completedClips > 0 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30">
                <div className="flex items-start gap-3">
                  <Layers className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-400 mb-1">Stitch Failed</p>
                    <p className="text-xs text-white/50 mb-3">All clips generated but assembly failed. Try simple stitch.</p>
                    <Button size="sm" className="bg-amber-500 text-black hover:bg-amber-400 rounded-full" onClick={handleSimpleStitch} disabled={isSimpleStitching}>
                      {isSimpleStitching ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Zap className="w-3 h-3 mr-1" />}
                      Simple Stitch
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Completed Video */}
            {finalVideoUrl && (
              <motion.section initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="p-6 rounded-3xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/30">
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  <h2 className="text-lg font-bold text-white">Your Video is Ready!</h2>
                </div>
                
                <div className="aspect-video rounded-2xl overflow-hidden border border-emerald-500/20 mb-4">
                  {finalVideoUrl.endsWith('.json') ? (
                    <ManifestVideoPlayer manifestUrl={finalVideoUrl} className="w-full h-full" />
                  ) : (
                    <video src={finalVideoUrl} controls className="w-full h-full object-contain bg-black" />
                  )}
                </div>
                
                <div className="flex flex-wrap gap-3">
                  {!finalVideoUrl.endsWith('.json') && (
                    <Button className="bg-emerald-500 hover:bg-emerald-400 text-white rounded-full" asChild>
                      <a href={finalVideoUrl} download><Download className="w-4 h-4 mr-2" />Download</a>
                    </Button>
                  )}
                  <Button variant="outline" className="rounded-full border-white/10 text-white/70 hover:text-white" onClick={() => navigate('/projects')}>
                    View All Projects
                  </Button>
                </div>
              </motion.section>
            )}

            {/* Stitching Tools */}
            {completedClips > 0 && projectId && !finalVideoUrl && (
              <StitchingTroubleshooter
                projectId={projectId}
                projectStatus={projectStatus}
                completedClips={completedClips}
                totalClips={expectedClipCount}
                onStitchComplete={(url) => {
                  setFinalVideoUrl(url);
                  setProjectStatus('completed');
                  setProgress(100);
                  addLog('Final video ready!', 'success');
                }}
                onStatusChange={(status) => {
                  setProjectStatus(status);
                  if (status === 'stitching') updateStageStatus(5, 'active', 'Stitching...');
                  else if (status === 'completed') updateStageStatus(5, 'complete');
                }}
              />
            )}
          </div>

          {/* Right: Activity Log + Projects */}
          <div className="space-y-6">
            <UnifiedActivityLog logs={pipelineLogs} isLive={isRunning} />
            
            <ProductionProjectsList 
              projects={allProductionProjects}
              activeProjectId={projectId}
              onSelect={(id) => navigate(`/production?projectId=${id}`)}
            />

            {/* Quality Score */}
            {auditScore !== null && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={cn(
                "p-4 rounded-2xl border",
                auditScore >= 80 ? "bg-emerald-500/10 border-emerald-500/30" 
                  : auditScore >= 60 ? "bg-amber-500/10 border-amber-500/30"
                  : "bg-red-500/10 border-red-500/30"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Sparkles className={cn("w-5 h-5", auditScore >= 80 ? "text-emerald-400" : auditScore >= 60 ? "text-amber-400" : "text-red-400")} />
                    <span className="text-sm font-semibold text-white">Quality Score</span>
                  </div>
                  <span className={cn("text-2xl font-bold", auditScore >= 80 ? "text-emerald-400" : auditScore >= 60 ? "text-amber-400" : "text-red-400")}>
                    {auditScore}%
                  </span>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </main>

      {/* Clip Video Modal */}
      <AnimatePresence>
        {selectedClipUrl && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
            onClick={() => setSelectedClipUrl(null)}
          >
            <motion.div 
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="relative max-w-4xl w-full aspect-video"
              onClick={(e) => e.stopPropagation()}
            >
              <video src={selectedClipUrl} controls autoPlay className="w-full h-full rounded-2xl" />
              <Button variant="ghost" size="icon" className="absolute top-4 right-4 bg-black/50 text-white rounded-full" onClick={() => setSelectedClipUrl(null)}>
                <X className="w-5 h-5" />
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
