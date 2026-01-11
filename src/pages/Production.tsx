import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { motion, AnimatePresence, useSpring, useTransform, useMotionValue } from 'framer-motion';
import { 
  Film, Loader2, CheckCircle2, XCircle, Play, Download, Clock, ArrowLeft,
  RotateCcw, Layers, Sparkles, AlertCircle, RefreshCw,
  ChevronRight, Zap, X, FileText, Users, Shield, Wand2,
  Activity, Cpu, Terminal, Eye, Pause
} from 'lucide-react';
import { ManifestVideoPlayer } from '@/components/studio/ManifestVideoPlayer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  { name: 'Quality Audit', shortName: 'Audit', icon: Shield },
  { name: 'Asset Creation', shortName: 'Assets', icon: Wand2 },
  { name: 'Video Production', shortName: 'Render', icon: Film },
  { name: 'Final Assembly', shortName: 'Stitch', icon: Sparkles },
];

// ============= ANIMATED PIPELINE =============

function CinematicPipeline({ 
  stages, 
  currentStageIndex 
}: { 
  stages: StageStatus[]; 
  currentStageIndex: number;
}) {
  const progressValue = useMotionValue(0);
  const smoothProgress = useSpring(progressValue, { stiffness: 50, damping: 20 });
  
  useEffect(() => {
    const newProgress = currentStageIndex >= 0 ? ((currentStageIndex + 1) / stages.length) * 100 : 0;
    progressValue.set(newProgress);
  }, [currentStageIndex, stages.length, progressValue]);

  return (
    <div className="relative py-8">
      {/* Connection Track */}
      <div className="absolute top-1/2 left-8 right-8 h-0.5 -translate-y-1/2 hidden sm:block">
        <div className="absolute inset-0 bg-gradient-to-r from-white/[0.02] via-white/[0.08] to-white/[0.02]" />
        <motion.div 
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500/80 via-white to-emerald-500/80"
          style={{ width: useTransform(smoothProgress, v => `${v}%`) }}
        />
        {/* Flowing particles */}
        {currentStageIndex >= 0 && stages[currentStageIndex]?.status === 'active' && (
          <>
            <motion.div
              className="absolute top-1/2 w-2 h-2 -translate-y-1/2 rounded-full bg-white shadow-lg shadow-white/50"
              animate={{ 
                left: ['0%', '100%'],
                opacity: [0, 1, 1, 0]
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            />
            <motion.div
              className="absolute top-1/2 w-1.5 h-1.5 -translate-y-1/2 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50"
              animate={{ 
                left: ['0%', '100%'],
                opacity: [0, 1, 1, 0]
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear", delay: 1.5 }}
            />
          </>
        )}
      </div>

      {/* Stage Nodes */}
      <div className="relative grid grid-cols-3 sm:grid-cols-6 gap-3 sm:gap-4">
        {stages.map((stage, index) => {
          const isActive = stage.status === 'active';
          const isComplete = stage.status === 'complete';
          const isPending = stage.status === 'pending';
          const isError = stage.status === 'error';
          const Icon = stage.icon;

          return (
            <motion.div
              key={stage.name}
              initial={{ opacity: 0, y: 30, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ 
                delay: index * 0.1, 
                duration: 0.6, 
                ease: [0.16, 1, 0.3, 1] 
              }}
              className="relative flex flex-col items-center"
            >
              {/* Node */}
              <motion.div
                className={cn(
                  "relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center transition-all duration-500",
                  isComplete && "bg-gradient-to-br from-emerald-500/30 to-emerald-600/10 shadow-lg shadow-emerald-500/20",
                  isActive && "bg-gradient-to-br from-white/20 to-white/5 shadow-xl shadow-white/20",
                  isPending && "bg-white/[0.03]",
                  isError && "bg-gradient-to-br from-red-500/30 to-red-600/10 shadow-lg shadow-red-500/20"
                )}
                whileHover={{ scale: 1.05 }}
              >
                {/* Glow rings for active */}
                {isActive && (
                  <>
                    <motion.div 
                      className="absolute inset-0 rounded-2xl border border-white/40"
                      animate={{ scale: [1, 1.15, 1], opacity: [0.8, 0, 0.8] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                    <motion.div 
                      className="absolute inset-0 rounded-2xl border border-white/20"
                      animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
                    />
                  </>
                )}
                
                {/* Border */}
                <div className={cn(
                  "absolute inset-0 rounded-2xl border transition-colors duration-500",
                  isComplete && "border-emerald-500/50",
                  isActive && "border-white/50",
                  isPending && "border-white/[0.08]",
                  isError && "border-red-500/50"
                )} />

                {/* Icon */}
                {isActive ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    <Loader2 className="w-6 h-6 text-white" />
                  </motion.div>
                ) : isComplete ? (
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 15 }}
                  >
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  </motion.div>
                ) : isError ? (
                  <XCircle className="w-6 h-6 text-red-400" />
                ) : (
                  <Icon className={cn("w-5 h-5 transition-colors", isPending ? "text-white/20" : "text-white/60")} />
                )}
              </motion.div>

              {/* Label */}
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.1 + 0.3 }}
                className={cn(
                  "mt-3 text-[11px] sm:text-xs font-semibold tracking-wide transition-colors duration-300",
                  isComplete && "text-emerald-400",
                  isActive && "text-white",
                  isPending && "text-white/30",
                  isError && "text-red-400"
                )}
              >
                {stage.shortName}
              </motion.span>

              {/* Details badge */}
              {stage.details && (
                <motion.span
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "mt-1 px-2 py-0.5 rounded-full text-[9px] font-medium",
                    isComplete && "bg-emerald-500/20 text-emerald-400",
                    isActive && "bg-white/10 text-white/80"
                  )}
                >
                  {stage.details}
                </motion.span>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ============= LIVE ACTIVITY FEED =============

function LiveActivityFeed({ logs, isLive }: { logs: PipelineLog[]; isLive: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getTypeStyles = (type: PipelineLog['type']) => {
    switch (type) {
      case 'success': return 'bg-emerald-500 shadow-emerald-500/50';
      case 'error': return 'bg-red-500 shadow-red-500/50';
      case 'warning': return 'bg-amber-500 shadow-amber-500/50';
      default: return 'bg-white/40 shadow-white/20';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="relative h-full flex flex-col rounded-2xl bg-black/40 backdrop-blur-xl border border-white/[0.08] overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Terminal className={cn("w-4 h-4", isLive ? "text-emerald-400" : "text-white/40")} />
            {isLive && (
              <motion.div
                className="absolute -inset-1 bg-emerald-500/30 rounded-full blur-sm"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
          </div>
          <span className="text-xs font-semibold text-white">Activity</span>
          {isLive && (
            <motion.span 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400"
            >
              <motion.div 
                className="w-1 h-1 rounded-full bg-emerald-400"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
              <span className="text-[9px] font-bold uppercase tracking-wider">Live</span>
            </motion.span>
          )}
        </div>
        <span className="text-[10px] text-white/30 font-mono">{logs.length}</span>
      </div>

      {/* Logs */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-1">
        <AnimatePresence mode="popLayout">
          {logs.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-white/20 text-xs">Awaiting events...</p>
            </div>
          ) : (
            logs.slice(-50).map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -10, height: 0 }}
                animate={{ opacity: 1, x: 0, height: 'auto' }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="flex items-start gap-2 py-1"
              >
                <span className="text-[9px] font-mono text-white/25 shrink-0 mt-0.5 w-12">{log.time.split(':').slice(1).join(':')}</span>
                <div className={cn("w-1.5 h-1.5 rounded-full mt-1 shrink-0 shadow-sm", getTypeStyles(log.type))} />
                <span className={cn(
                  "text-[11px] leading-relaxed",
                  log.type === 'success' && "text-emerald-400/90",
                  log.type === 'error' && "text-red-400/90",
                  log.type === 'warning' && "text-amber-400/90",
                  log.type === 'info' && "text-white/50"
                )}>
                  {log.message}
                </span>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Live indicator bar */}
      {isLive && (
        <motion.div
          className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-500 to-transparent"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
    </motion.div>
  );
}

// ============= CLIP MOSAIC =============

function ClipMosaic({ 
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
    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5 sm:gap-2">
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
              "relative aspect-video rounded-lg overflow-hidden cursor-pointer group",
              "border transition-all duration-300",
              isCompleted && "border-emerald-500/40 hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-500/10 hover:scale-105",
              isGenerating && "border-white/20",
              isFailed && "border-red-500/40 hover:border-red-400",
              isPending && "border-white/[0.04]"
            )}
            onClick={() => {
              if (isCompleted && clip.videoUrl) onPlay(clip.videoUrl);
              else if (isFailed) onRetry(index);
            }}
          >
            {isCompleted && clip.videoUrl ? (
              <>
                <video
                  src={clip.videoUrl}
                  className="absolute inset-0 w-full h-full object-cover"
                  muted
                  preload="metadata"
                  onLoadedData={(e) => { (e.target as HTMLVideoElement).currentTime = 1; }}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileHover={{ opacity: 1, scale: 1 }}
                    className="opacity-0 group-hover:opacity-100"
                  >
                    <Play className="w-4 h-4 text-white" fill="currentColor" />
                  </motion.div>
                </div>
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-0.5 right-0.5"
                >
                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 drop-shadow" />
                </motion.div>
              </>
            ) : isGenerating ? (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-white/[0.06] to-transparent">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                >
                  <Loader2 className="w-3 h-3 text-white/50" />
                </motion.div>
              </div>
            ) : isFailed ? (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-red-500/10 to-transparent">
                {isRetrying ? (
                  <Loader2 className="w-3 h-3 text-red-400 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3 text-red-400 group-hover:scale-110 transition-transform" />
                )}
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-white/[0.01]">
                <span className="text-xs font-bold text-white/10">{index + 1}</span>
              </div>
            )}
            
            <div className="absolute bottom-0.5 left-0.5 px-1 py-0.5 rounded bg-black/60 backdrop-blur-sm">
              <span className="text-[8px] font-bold text-white/80">{index + 1}</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ============= PRODUCTION SIDEBAR =============

function ProductionSidebar({ 
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
      className="rounded-2xl bg-black/40 backdrop-blur-xl border border-white/[0.08] p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-3.5 h-3.5 text-white/40" />
        <span className="text-xs font-semibold text-white">Active</span>
        <Badge variant="outline" className="text-amber-400 border-amber-500/30 text-[9px] px-1.5 py-0">
          {projects.length}
        </Badge>
      </div>

      <div className="space-y-1.5">
        {projects.map((project, index) => (
          <motion.button
            key={project.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => onSelect(project.id)}
            className={cn(
              "w-full flex items-center gap-2 p-2 rounded-xl transition-all duration-200 text-left",
              activeProjectId === project.id 
                ? "bg-white/[0.08] border border-white/20" 
                : "hover:bg-white/[0.04] border border-transparent"
            )}
          >
            <div className="relative w-8 h-5 rounded bg-white/5 shrink-0 overflow-hidden">
              {project.thumbnail ? (
                <img src={project.thumbnail} className="w-full h-full object-cover" alt="" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Film className="w-2.5 h-2.5 text-white/20" />
                </div>
              )}
              {['generating', 'producing', 'stitching'].includes(project.status) && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Loader2 className="w-2 h-2 text-white animate-spin" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-white truncate">{project.title}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="flex-1 h-0.5 rounded-full bg-white/10 overflow-hidden">
                  <motion.div 
                    className="h-full bg-white/50"
                    initial={{ width: 0 }}
                    animate={{ width: `${project.progress}%` }}
                  />
                </div>
                <span className="text-[9px] text-white/40">{project.progress}%</span>
              </div>
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
  const displayProgress = useTransform(springProgress, v => Math.round(v));

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

  // Handlers
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
      <div className="min-h-screen bg-[#030303] flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }} 
          animate={{ opacity: 1, scale: 1 }} 
          className="flex flex-col items-center gap-6"
        >
          <div className="relative w-20 h-20">
            <motion.div 
              className="absolute inset-0 rounded-full border-2 border-white/10"
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            />
            <motion.div 
              className="absolute inset-2 rounded-full border-2 border-t-white border-r-transparent border-b-transparent border-l-transparent"
              animate={{ rotate: -360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <Film className="w-6 h-6 text-white/60" />
            </div>
          </div>
          <p className="text-white/40 text-sm font-medium">Initializing Studio</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030303] relative">
      {/* Ambient Gradients */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <motion.div 
          className="absolute top-0 left-1/4 w-[800px] h-[800px] rounded-full"
          style={{
            background: isComplete 
              ? 'radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, transparent 70%)'
              : isError
              ? 'radial-gradient(circle, rgba(239, 68, 68, 0.08) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(255, 255, 255, 0.04) 0%, transparent 70%)'
          }}
          animate={{ 
            x: [0, 50, 0],
            y: [0, 30, 0],
            scale: [1, 1.1, 1]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          className="absolute bottom-0 right-0 w-[600px] h-[600px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(255, 255, 255, 0.02) 0%, transparent 70%)'
          }}
          animate={{ 
            x: [0, -30, 0],
            y: [0, -40, 0],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-2xl bg-black/40 border-b border-white/[0.04]">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-14 flex items-center justify-between gap-4">
            {/* Left */}
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon" 
                className="w-8 h-8 text-white/50 hover:text-white hover:bg-white/5" 
                onClick={() => navigate('/projects')}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              
              <div className="flex items-center gap-3">
                <motion.div
                  className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center",
                    isComplete ? "bg-emerald-500/20" : isError ? "bg-red-500/20" : "bg-white/[0.06]"
                  )}
                  animate={isRunning ? { scale: [1, 1.05, 1] } : {}}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  {isRunning && <Loader2 className="w-4 h-4 text-white animate-spin" />}
                  {isComplete && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  {isError && <XCircle className="w-4 h-4 text-red-400" />}
                  {!isRunning && !isComplete && !isError && <Film className="w-4 h-4 text-white/50" />}
                </motion.div>
                <div className="hidden sm:block">
                  <h1 className="text-sm font-semibold text-white leading-none">Production</h1>
                  <p className="text-xs text-white/40 truncate max-w-[200px] mt-0.5">{projectTitle}</p>
                </div>
              </div>
            </div>

            {/* Center - Progress */}
            <div className="flex-1 max-w-md hidden md:block">
              <div className="relative h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <motion.div
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full",
                    isComplete ? "bg-gradient-to-r from-emerald-600 to-emerald-400" 
                      : isError ? "bg-gradient-to-r from-red-600 to-red-400"
                      : "bg-gradient-to-r from-white/40 to-white"
                  )}
                  style={{ width: `${progress}%` }}
                />
                {isRunning && (
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  />
                )}
              </div>
            </div>

            {/* Right */}
            <div className="flex items-center gap-2">
              {isRunning && (
                <motion.div 
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20"
                >
                  <motion.div 
                    className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                  <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Live</span>
                </motion.div>
              )}
              
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06]">
                <Clock className="w-3 h-3 text-white/40" />
                <span className="text-xs font-mono text-white/70">{formatTime(elapsedTime)}</span>
              </div>

              <motion.div 
                className={cn(
                  "px-3 py-1 rounded-full font-bold text-sm",
                  isComplete ? "text-emerald-400" : isError ? "text-red-400" : "text-white"
                )}
                key={Math.round(progress)}
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
              >
                {Math.round(progress)}%
              </motion.div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Main Area */}
          <div className="lg:col-span-9 space-y-6">
            
            {/* Pipeline */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 sm:p-6 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/[0.06]"
            >
              <div className="flex items-center gap-2 mb-2">
                <Layers className="w-4 h-4 text-white/40" />
                <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">Pipeline</span>
              </div>
              <CinematicPipeline stages={stages} currentStageIndex={currentStageIndex} />
            </motion.section>

            {/* Clips */}
            {clipResults.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="p-4 sm:p-6 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/[0.06]"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Film className="w-4 h-4 text-white/40" />
                    <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">Clips</span>
                    <span className="text-xs text-white/40">
                      <span className="text-white font-semibold">{completedClips}</span>/{clipResults.length}
                    </span>
                  </div>
                  {completedClips > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-white/40 hover:text-white text-xs h-7 px-2"
                      onClick={() => navigate(`/clips?projectId=${projectId}`)}
                    >
                      View All <ChevronRight className="w-3 h-3 ml-1" />
                    </Button>
                  )}
                </div>
                <ClipMosaic 
                  clips={clipResults}
                  onPlay={setSelectedClipUrl}
                  onRetry={handleRetryClip}
                  retryingIndex={retryingClipIndex}
                />
              </motion.section>
            )}

            {/* Status Cards */}
            <AnimatePresence mode="wait">
              {projectStatus === 'stitching' && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }} 
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-5 rounded-2xl bg-gradient-to-br from-white/[0.04] to-transparent border border-white/[0.08]"
                >
                  <div className="flex items-center gap-3">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    >
                      <Cpu className="w-5 h-5 text-white" />
                    </motion.div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">Assembling Final Video</p>
                      <p className="text-xs text-white/40 mt-0.5">Cloud processing in progress...</p>
                    </div>
                  </div>
                  <div className="mt-4 h-1 rounded-full bg-white/10 overflow-hidden">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-white/30 via-white to-white/30"
                      animate={{ x: ['-100%', '100%'] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                      style={{ width: '50%' }}
                    />
                  </div>
                </motion.div>
              )}

              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }} 
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-5 rounded-2xl bg-gradient-to-br from-red-500/10 to-transparent border border-red-500/20"
                >
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-red-400">Pipeline Error</p>
                      <p className="text-xs text-white/50 mt-1">{error}</p>
                      <div className="flex gap-2 mt-3">
                        {completedClips > 0 && (
                          <Button 
                            size="sm" 
                            className="bg-white text-black hover:bg-white/90 rounded-full h-8" 
                            onClick={handleResume} 
                            disabled={isResuming}
                          >
                            {isResuming ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RotateCcw className="w-3 h-3 mr-1" />}
                            Resume
                          </Button>
                        )}
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="rounded-full h-8 border-white/10 text-white/60" 
                          onClick={() => navigate('/create')}
                        >
                          Start New
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {projectStatus === 'stitching_failed' && completedClips > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }} 
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/20"
                >
                  <div className="flex items-start gap-3">
                    <Layers className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-amber-400">Assembly Failed</p>
                      <p className="text-xs text-white/50 mt-1">All clips ready. Try simple stitch.</p>
                      <Button 
                        size="sm" 
                        className="mt-3 bg-amber-500 hover:bg-amber-400 text-black rounded-full h-8" 
                        onClick={handleSimpleStitch} 
                        disabled={isSimpleStitching}
                      >
                        {isSimpleStitching ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Zap className="w-3 h-3 mr-1" />}
                        Quick Stitch
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Completed Video */}
            {finalVideoUrl && (
              <motion.section 
                initial={{ opacity: 0, y: 20, scale: 0.98 }} 
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="p-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20"
              >
                <div className="flex items-center gap-3 mb-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 15 }}
                  >
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  </motion.div>
                  <h2 className="text-lg font-bold text-white">Your Video is Ready!</h2>
                </div>
                
                <div className="aspect-video rounded-xl overflow-hidden border border-emerald-500/20 mb-4 bg-black">
                  {finalVideoUrl.endsWith('.json') ? (
                    <ManifestVideoPlayer manifestUrl={finalVideoUrl} className="w-full h-full" />
                  ) : (
                    <video src={finalVideoUrl} controls className="w-full h-full object-contain" />
                  )}
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {!finalVideoUrl.endsWith('.json') && (
                    <Button className="bg-emerald-500 hover:bg-emerald-400 text-white rounded-full" asChild>
                      <a href={finalVideoUrl} download><Download className="w-4 h-4 mr-2" />Download</a>
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    className="rounded-full border-white/10 text-white/60 hover:text-white" 
                    onClick={() => navigate('/projects')}
                  >
                    All Projects
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

          {/* Sidebar */}
          <div className="lg:col-span-3 space-y-4">
            {/* Activity Feed */}
            <div className="h-[300px]">
              <LiveActivityFeed logs={pipelineLogs} isLive={isRunning} />
            </div>

            {/* Active Productions */}
            <ProductionSidebar 
              projects={allProductionProjects}
              activeProjectId={projectId}
              onSelect={(id) => navigate(`/production?projectId=${id}`)}
            />

            {/* Quality Score */}
            {auditScore !== null && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "p-4 rounded-2xl border backdrop-blur-xl",
                  auditScore >= 80 ? "bg-emerald-500/10 border-emerald-500/20" 
                    : auditScore >= 60 ? "bg-amber-500/10 border-amber-500/20"
                    : "bg-red-500/10 border-red-500/20"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className={cn(
                      "w-4 h-4",
                      auditScore >= 80 ? "text-emerald-400" : auditScore >= 60 ? "text-amber-400" : "text-red-400"
                    )} />
                    <span className="text-xs font-semibold text-white">Quality</span>
                  </div>
                  <span className={cn(
                    "text-xl font-bold",
                    auditScore >= 80 ? "text-emerald-400" : auditScore >= 60 ? "text-amber-400" : "text-red-400"
                  )}>
                    {auditScore}%
                  </span>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </main>

      {/* Clip Preview Modal */}
      <AnimatePresence>
        {selectedClipUrl && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex items-center justify-center p-4"
            onClick={() => setSelectedClipUrl(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-4xl w-full aspect-video"
              onClick={(e) => e.stopPropagation()}
            >
              <video 
                src={selectedClipUrl} 
                controls 
                autoPlay 
                className="w-full h-full rounded-2xl shadow-2xl shadow-black/50" 
              />
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white rounded-full w-10 h-10" 
                onClick={() => setSelectedClipUrl(null)}
              >
                <X className="w-5 h-5" />
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
