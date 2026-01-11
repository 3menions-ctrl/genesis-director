import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { motion, AnimatePresence, useSpring, useTransform, useMotionValue } from 'framer-motion';
import { 
  Film, Loader2, CheckCircle2, XCircle, Play, Download, Clock, 
  RotateCcw, Sparkles, AlertCircle, RefreshCw,
  ChevronRight, Zap, X, FileText, Users, Shield, Wand2,
  Activity, Cpu, Terminal, FolderOpen, ChevronLeft, Layers
} from 'lucide-react';
import { ManifestVideoPlayer } from '@/components/studio/ManifestVideoPlayer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { parsePendingVideoTasks } from '@/types/pending-video-tasks';
import { StitchingTroubleshooter } from '@/components/studio/StitchingTroubleshooter';
import { AppHeader } from '@/components/layout/AppHeader';

// ============= TYPES =============

interface StageStatus {
  name: string;
  shortName: string;
  icon: React.ElementType;
  status: 'pending' | 'active' | 'complete' | 'error' | 'skipped';
  details?: string;
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

// ============= MINI PIPELINE =============

function MiniPipeline({ stages, currentStageIndex }: { stages: StageStatus[]; currentStageIndex: number }) {
  return (
    <div className="flex items-center gap-1">
      {stages.map((stage, i) => {
        const isActive = stage.status === 'active';
        const isComplete = stage.status === 'complete';
        const isError = stage.status === 'error';
        
        return (
          <motion.div
            key={i}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.05 }}
            className="relative group"
          >
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300",
              isComplete && "bg-emerald-500/20 text-emerald-400",
              isActive && "bg-white/15 text-white",
              !isComplete && !isActive && !isError && "bg-white/[0.03] text-white/20",
              isError && "bg-red-500/20 text-red-400"
            )}>
              {isActive ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : isComplete ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : isError ? (
                <XCircle className="w-3.5 h-3.5" />
              ) : (
                <stage.icon className="w-3.5 h-3.5" />
              )}
            </div>
            
            {/* Connector */}
            {i < stages.length - 1 && (
              <div className={cn(
                "absolute top-1/2 -right-1 w-2 h-0.5 -translate-y-1/2",
                isComplete ? "bg-emerald-500/50" : "bg-white/10"
              )} />
            )}
            
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded bg-black/90 text-[10px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              {stage.shortName}
              {stage.details && <span className="text-white/50 ml-1">({stage.details})</span>}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ============= CLIP GRID =============

function ClipGrid({ 
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
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
      {clips.map((clip, index) => {
        const isCompleted = clip.status === 'completed';
        const isGenerating = clip.status === 'generating';
        const isFailed = clip.status === 'failed';
        const isRetrying = retryingIndex === index;

        return (
          <motion.div
            key={index}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.02 }}
            className={cn(
              "relative aspect-video rounded-lg overflow-hidden cursor-pointer group transition-all duration-200",
              isCompleted && "ring-1 ring-emerald-500/30 hover:ring-emerald-400/50 hover:scale-[1.02]",
              isGenerating && "ring-1 ring-white/10",
              isFailed && "ring-1 ring-red-500/30 hover:ring-red-400/50",
              !isCompleted && !isGenerating && !isFailed && "ring-1 ring-white/[0.04]"
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
                  className="w-full h-full object-cover"
                  muted
                  preload="metadata"
                  onLoadedData={(e) => { (e.target as HTMLVideoElement).currentTime = 1; }}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                  <Play className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="currentColor" />
                </div>
                <CheckCircle2 className="absolute top-1 right-1 w-3 h-3 text-emerald-400" />
              </>
            ) : isGenerating ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white/[0.02]">
                <Loader2 className="w-4 h-4 text-white/40 animate-spin" />
              </div>
            ) : isFailed ? (
              <div className="absolute inset-0 flex items-center justify-center bg-red-500/5">
                {isRetrying ? (
                  <Loader2 className="w-4 h-4 text-red-400 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 text-red-400" />
                )}
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-white/[0.01]">
                <span className="text-xs font-medium text-white/10">{index + 1}</span>
              </div>
            )}
            
            <div className="absolute bottom-0.5 left-0.5 px-1 py-0.5 rounded bg-black/70 text-[9px] font-bold text-white/70">
              {index + 1}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ============= ACTIVITY LOG =============

function ActivityLog({ logs, isLive }: { logs: PipelineLog[]; isLive: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.04]">
        <Terminal className={cn("w-3 h-3", isLive ? "text-emerald-400" : "text-white/30")} />
        <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Log</span>
        {isLive && (
          <motion.div 
            className="w-1.5 h-1.5 rounded-full bg-emerald-400"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}
      </div>
      
      <ScrollArea ref={scrollRef} className="flex-1 px-3 py-2">
        <AnimatePresence mode="popLayout">
          {logs.slice(-30).map((log) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-start gap-2 py-0.5"
            >
              <span className="text-[9px] font-mono text-white/20 shrink-0">{log.time.split(':').slice(1).join(':')}</span>
              <div className={cn(
                "w-1 h-1 rounded-full mt-1.5 shrink-0",
                log.type === 'success' && "bg-emerald-400",
                log.type === 'error' && "bg-red-400",
                log.type === 'warning' && "bg-amber-400",
                log.type === 'info' && "bg-white/30"
              )} />
              <span className={cn(
                "text-[10px] leading-relaxed",
                log.type === 'success' && "text-emerald-400/80",
                log.type === 'error' && "text-red-400/80",
                log.type === 'warning' && "text-amber-400/80",
                log.type === 'info' && "text-white/40"
              )}>
                {log.message}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </ScrollArea>
    </div>
  );
}

// ============= PROJECT SIDEBAR =============

function ProjectSidebar({ 
  projects, 
  activeProjectId, 
  isCollapsed,
  onToggle
}: { 
  projects: ProductionProject[];
  activeProjectId: string | null;
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  const navigate = useNavigate();
  
  const handleSelectProject = (id: string) => {
    navigate(`/production?projectId=${id}`);
  };

  const getStatusColor = (status: string, progress: number) => {
    if (progress >= 100) return 'emerald';
    if (status === 'failed' || status === 'stitching_failed') return 'red';
    if (['generating', 'producing', 'stitching'].includes(status)) return 'blue';
    return 'amber';
  };

  const getStatusLabel = (status: string, progress: number) => {
    if (progress >= 100) return 'Complete';
    if (status === 'failed') return 'Failed';
    if (status === 'stitching_failed') return 'Stitch Failed';
    if (status === 'stitching') return 'Stitching';
    if (status === 'generating') return 'Generating';
    if (status === 'producing') return 'Rendering';
    return 'Paused';
  };
  
  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 56 : 220 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="h-full bg-[#0a0a0a] border-r border-white/[0.06] flex flex-col shrink-0"
    >
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-white/[0.06]">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-white/10 to-white/[0.02] flex items-center justify-center">
              <Layers className="w-3.5 h-3.5 text-white/60" />
            </div>
            <span className="text-xs font-semibold text-white/70">Productions</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "w-8 h-8 text-white/40 hover:text-white hover:bg-white/[0.06] rounded-lg shrink-0", 
            isCollapsed && "mx-auto"
          )}
          onClick={onToggle}
        >
          <ChevronLeft className={cn("w-4 h-4 transition-transform duration-200", isCollapsed && "rotate-180")} />
        </Button>
      </div>

      {/* Projects List */}
      <ScrollArea className="flex-1">
        <div className={cn("py-3", isCollapsed ? "px-2" : "px-3")}>
          {!isCollapsed && projects.length > 0 && (
            <p className="text-[10px] font-medium text-white/30 uppercase tracking-wider mb-3 px-1">
              {projects.length} Project{projects.length !== 1 ? 's' : ''}
            </p>
          )}
          
          <div className="space-y-1.5">
            {projects.map((project, index) => {
              const isActive = project.id === activeProjectId;
              const isProcessing = ['generating', 'producing', 'stitching'].includes(project.status);
              const statusColor = getStatusColor(project.status, project.progress);
              const statusLabel = getStatusLabel(project.status, project.progress);
              
              return (
                <motion.button
                  key={project.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  onClick={() => handleSelectProject(project.id)}
                  className={cn(
                    "w-full rounded-lg transition-all duration-200 group relative overflow-hidden",
                    isCollapsed ? "p-1.5 flex justify-center" : "p-2",
                    isActive 
                      ? "bg-gradient-to-r from-white/[0.08] to-white/[0.04] ring-1 ring-white/[0.12] shadow-lg shadow-black/20" 
                      : "hover:bg-white/[0.04]"
                  )}
                >
                  {/* Active indicator */}
                  {isActive && (
                    <motion.div 
                      layoutId="activeSidebarIndicator"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-8 rounded-r-full bg-white"
                    />
                  )}

                  {isCollapsed ? (
                    /* Collapsed View - Just thumbnail */
                    <div className="relative">
                      <div className={cn(
                        "w-10 h-10 rounded-lg overflow-hidden bg-gradient-to-br from-white/[0.06] to-white/[0.02] flex items-center justify-center",
                        isActive && "ring-1 ring-white/20"
                      )}>
                        {project.thumbnail ? (
                          <img src={project.thumbnail} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <Film className="w-4 h-4 text-white/20" />
                        )}
                      </div>
                      {isProcessing && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-blue-500 flex items-center justify-center ring-2 ring-[#0c0c0c]">
                          <Loader2 className="w-2 h-2 text-white animate-spin" />
                        </div>
                      )}
                      {project.progress >= 100 && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 flex items-center justify-center ring-2 ring-[#0c0c0c]">
                          <CheckCircle2 className="w-2 h-2 text-white" />
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Expanded View */
                    <div className="flex gap-2.5 items-center">
                      {/* Thumbnail */}
                      <div className="relative shrink-0">
                        <div className={cn(
                          "w-9 h-9 rounded-md overflow-hidden bg-white/[0.04] flex items-center justify-center",
                          isActive && "ring-1 ring-white/20"
                        )}>
                          {project.thumbnail ? (
                            <img src={project.thumbnail} className="w-full h-full object-cover" alt="" />
                          ) : (
                            <Film className="w-3.5 h-3.5 text-white/20" />
                          )}
                        </div>
                        {isProcessing && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-blue-500 flex items-center justify-center ring-2 ring-[#0a0a0a]">
                            <Loader2 className="w-2 h-2 text-white animate-spin" />
                          </div>
                        )}
                        {project.progress >= 100 && !isProcessing && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 flex items-center justify-center ring-2 ring-[#0a0a0a]">
                            <CheckCircle2 className="w-2 h-2 text-white" />
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 text-left">
                        <p className={cn(
                          "text-xs font-medium truncate transition-colors leading-tight",
                          isActive ? "text-white" : "text-white/60 group-hover:text-white"
                        )}>
                          {project.title}
                        </p>
                        
                        <span className={cn(
                          "text-[10px] mt-0.5 inline-block",
                          statusColor === 'emerald' && "text-emerald-400/70",
                          statusColor === 'blue' && "text-blue-400/70",
                          statusColor === 'red' && "text-red-400/70",
                          statusColor === 'amber' && "text-amber-400/70"
                        )}>
                          {statusLabel} · {project.progress}%
                        </span>
                      </div>
                    </div>
                  )}
                </motion.button>
              );
            })}

            {projects.length === 0 && !isCollapsed && (
              <div className="text-center py-8 px-4">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto mb-3">
                  <Film className="w-5 h-5 text-white/20" />
                </div>
                <p className="text-xs text-white/40">No productions yet</p>
                <p className="text-[10px] text-white/25 mt-1">Start a project in Studio</p>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className={cn("border-t border-white/[0.06] p-3", isCollapsed && "p-2")}>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "w-full text-white/50 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors",
            isCollapsed ? "p-2.5" : "justify-start gap-2.5 h-9"
          )}
          onClick={() => navigate('/projects')}
        >
          <FolderOpen className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span className="text-xs font-medium">All Projects</span>}
        </Button>
      </div>
    </motion.aside>
  );
}

// ============= MAIN COMPONENT =============

export default function Production() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const { user } = useAuth();
  
  // UI State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
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

  const springProgress = useSpring(progress, { stiffness: 100, damping: 30 });
  const logIdRef = useRef(0);

  const addLog = useCallback((message: string, type: PipelineLog['type'] = 'info') => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const id = `log-${logIdRef.current++}`;
    setPipelineLogs(prev => [...prev, { id, time, message, type }].slice(-100));
  }, []);

  const updateStageStatus = useCallback((stageIndex: number, status: StageStatus['status'], details?: string) => {
    setStages(prev => {
      const updated = [...prev];
      if (updated[stageIndex]) {
        updated[stageIndex] = { ...updated[stageIndex], status, details };
      }
      return updated;
    });
  }, []);

  const loadVideoClips = useCallback(async () => {
    if (!projectId) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    
    const { data: clips } = await supabase
      .from('video_clips')
      .select('id, shot_index, status, video_url, error_message')
      .eq('project_id', projectId)
      .eq('user_id', session.user.id)
      .order('shot_index');
    
    if (clips) {
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

  const loadAllProductionProjects = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { data: projects } = await supabase
      .from('movie_projects')
      .select('id, title, status, pending_video_tasks, thumbnail_url, updated_at')
      .eq('user_id', session.user.id)
      .in('status', ['generating', 'producing', 'rendering', 'stitching', 'completed'])
      .order('updated_at', { ascending: false })
      .limit(20);

    if (projects) {
      setAllProductionProjects(projects.map(p => {
        const tasks = parsePendingVideoTasks(p.pending_video_tasks);
        return {
          id: p.id,
          title: p.title,
          status: p.status,
          progress: p.status === 'completed' ? 100 : (tasks?.progress || 0),
          clipsCompleted: tasks?.clipsCompleted || 0,
          totalClips: tasks?.clipCount || 6,
          thumbnail: p.thumbnail_url || undefined,
          updatedAt: p.updated_at,
        };
      }));
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  useEffect(() => {
    const loadProject = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate('/auth');
        return;
      }

      // If no projectId, auto-select the most recently active project
      if (!projectId) {
        const { data: recentProject } = await supabase
          .from('movie_projects')
          .select('id')
          .eq('user_id', session.user.id)
          .in('status', ['generating', 'producing', 'rendering', 'stitching', 'completed'])
          .order('updated_at', { ascending: false })
          .limit(1)
          .single();

        if (recentProject) {
          navigate(`/production?projectId=${recentProject.id}`, { replace: true });
          return;
        }
        
        // No production projects found, just load sidebar
        await loadAllProductionProjects();
        setIsLoading(false);
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
      if (project.video_url) setFinalVideoUrl(project.video_url);

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
      addLog('Connected to pipeline', 'info');
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

          if (tasks.scriptGenerated && !pipelineLogs.some(l => l.message.includes('Script'))) {
            addLog('Script ready', 'success');
            updateStageStatus(0, 'complete', `${tasks.shotCount || '?'} shots`);
          }

          if (tasks.auditScore && auditScore !== tasks.auditScore) {
            setAuditScore(tasks.auditScore);
            updateStageStatus(2, 'complete', `${tasks.auditScore}%`);
            addLog(`QA: ${tasks.auditScore}/100`, 'success');
          }

          if (tasks.charactersExtracted) {
            updateStageStatus(1, 'complete', `${tasks.charactersExtracted}`);
          }

          if (tasks.clipsCompleted !== undefined) {
            setCompletedClips(tasks.clipsCompleted);
            setExpectedClipCount(tasks.clipCount || expectedClipCount);
            updateStageStatus(4, 'active', `${tasks.clipsCompleted}/${tasks.clipCount || expectedClipCount}`);
          }

          if (tasks.stage === 'complete' && tasks.finalVideoUrl) {
            setFinalVideoUrl(tasks.finalVideoUrl);
            setProgress(100);
            stages.forEach((_, i) => updateStageStatus(i, 'complete'));
            addLog('Complete!', 'success');
            toast.success('Video ready!');
          }

          if (tasks.stage === 'error') {
            setError(tasks.error || 'Failed');
            addLog(tasks.error || 'Error', 'error');
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
            addLog(`Clip ${(clip.shot_index as number) + 1} done`, 'success');
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(projectChannel);
      supabase.removeChannel(clipsChannel);
    };
  }, [projectId, user, stages, pipelineLogs, auditScore, expectedClipCount, updateStageStatus, addLog, loadVideoClips, springProgress]);

  // Auto-stitch
  useEffect(() => {
    const allComplete = completedClips >= expectedClipCount && expectedClipCount > 0;
    const shouldTrigger = allComplete && 
      !['completed', 'stitching', 'failed'].includes(projectStatus) &&
      !autoStitchAttempted && !isSimpleStitching;

    if (shouldTrigger) {
      const timer = setTimeout(async () => {
        setAutoStitchAttempted(true);
        addLog('Stitching...', 'info');
        updateStageStatus(5, 'active');
        setProgress(85);

        try {
          const { data, error } = await supabase.functions.invoke('auto-stitch-trigger', {
            body: { projectId, userId: user?.id, forceStitch: false },
          });

          if (error) throw error;
          if (data?.success && (data.stitchResult?.finalVideoUrl || data.finalVideoUrl)) {
            setFinalVideoUrl(data.stitchResult?.finalVideoUrl || data.finalVideoUrl);
            setProjectStatus('completed');
            setProgress(100);
            updateStageStatus(5, 'complete');
            addLog('Done!', 'success');
            toast.success('Video ready!');
          }
        } catch (err: any) {
          addLog(`Stitch failed: ${err.message}`, 'error');
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [completedClips, expectedClipCount, projectStatus, autoStitchAttempted, isSimpleStitching, projectId, user, addLog, updateStageStatus]);

  const handleRetryClip = async (clipIndex: number) => {
    if (!projectId || !user) return;
    setRetryingClipIndex(clipIndex);
    
    try {
      const { data, error } = await supabase.functions.invoke('retry-failed-clip', {
        body: { userId: user.id, projectId, clipIndex },
      });
      
      if (error) throw error;
      if (data?.success) {
        toast.success(`Clip ${clipIndex + 1} retrying`);
        await loadVideoClips();
      }
    } catch {
      toast.error(`Retry failed`);
    } finally {
      setRetryingClipIndex(null);
    }
  };

  const handleSimpleStitch = async () => {
    if (!projectId || !user || isSimpleStitching) return;
    setIsSimpleStitching(true);
    
    try {
      const { data: clips } = await supabase
        .from('video_clips')
        .select('id, shot_index, video_url, duration_seconds')
        .eq('project_id', projectId)
        .eq('status', 'completed')
        .order('shot_index');

      if (!clips?.length) throw new Error('No clips');

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
        toast.success('Stitched!');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSimpleStitching(false);
    }
  };

  const handleResume = async () => {
    if (!projectId || !user || isResuming) return;
    setIsResuming(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('resume-pipeline', {
        body: { userId: user.id, projectId, resumeFrom: 'production' },
      });
      
      if (error) throw error;
      if (data?.success) {
        toast.success('Resumed');
        setProjectStatus('generating');
      }
    } catch {
      toast.error('Resume failed');
    } finally {
      setIsResuming(false);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const isRunning = !['completed', 'failed', 'draft'].includes(projectStatus);
  const isComplete = projectStatus === 'completed';
  const isError = projectStatus === 'failed';
  const currentStageIndex = stages.findIndex(s => s.status === 'active');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          className="flex flex-col items-center gap-4"
        >
          <div className="relative w-12 h-12">
            <motion.div 
              className="absolute inset-0 rounded-full border border-white/10"
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            />
            <motion.div 
              className="absolute inset-1 rounded-full border border-t-white/50 border-r-transparent border-b-transparent border-l-transparent"
              animate={{ rotate: -360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          </div>
          <p className="text-white/30 text-xs">Loading</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030303] flex flex-col">
      {/* App Header */}
      <AppHeader showCreate={false} />

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <ProjectSidebar
          projects={allProductionProjects}
          activeProjectId={projectId}
          isCollapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Sub Header */}
          <div className="h-12 px-4 flex items-center justify-between border-b border-white/[0.04] bg-black/20 shrink-0">
            <div className="flex items-center gap-3">
              <motion.div
                className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center",
                  isComplete ? "bg-emerald-500/20" : isError ? "bg-red-500/20" : "bg-white/[0.04]"
                )}
              >
                {isRunning && <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />}
                {isComplete && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                {isError && <XCircle className="w-3.5 h-3.5 text-red-400" />}
                {!isRunning && !isComplete && !isError && <Film className="w-3.5 h-3.5 text-white/40" />}
              </motion.div>
              <div>
                <h1 className="text-sm font-semibold text-white leading-none truncate max-w-[200px]">{projectTitle}</h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <MiniPipeline stages={stages} currentStageIndex={currentStageIndex} />
              
              <div className="h-5 w-px bg-white/[0.06]" />
              
              {/* Resume Button - show when there are clips and pipeline might be stalled */}
              {clipResults.length > 0 && !isComplete && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10 rounded-full"
                  onClick={handleResume}
                  disabled={isResuming}
                >
                  {isResuming ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RotateCcw className="w-3 h-3 mr-1" />}
                  Resume
                </Button>
              )}
              
              {isRunning && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10">
                  <motion.div 
                    className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                  <span className="text-[10px] font-semibold text-emerald-400">LIVE</span>
                </div>
              )}
              
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/[0.03]">
                <Clock className="w-3 h-3 text-white/30" />
                <span className="text-[10px] font-mono text-white/50">{formatTime(elapsedTime)}</span>
              </div>

              <span className={cn(
                "text-lg font-bold tabular-nums",
                isComplete ? "text-emerald-400" : isError ? "text-red-400" : "text-white"
              )}>
                {Math.round(progress)}%
              </span>
            </div>
          </div>

          {/* Content Grid */}
          <div className="flex-1 overflow-auto p-4">
            <div className="max-w-7xl mx-auto grid grid-cols-12 gap-4">
              
              {/* Main Column */}
              <div className="col-span-12 lg:col-span-8 space-y-4">
                
                {/* Progress Card */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-xl bg-gradient-to-br from-white/[0.03] to-transparent border border-white/[0.06]"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-white/40">Progress</span>
                    <span className="text-xs text-white/30">{completedClips}/{clipResults.length || expectedClipCount} clips</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <motion.div
                      className={cn(
                        "h-full rounded-full",
                        isComplete ? "bg-emerald-500" : isError ? "bg-red-500" : "bg-white"
                      )}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </motion.div>

                {/* Clips Grid */}
                {clipResults.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="p-4 rounded-xl bg-gradient-to-br from-white/[0.03] to-transparent border border-white/[0.06]"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Film className="w-3.5 h-3.5 text-white/30" />
                        <span className="text-xs font-medium text-white/40">Clips</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Stitch Button - show when clips are ready */}
                        {completedClips > 0 && !finalVideoUrl && (
                          <Button 
                            size="sm" 
                            className="h-7 text-xs bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white rounded-full font-medium"
                            onClick={handleSimpleStitch}
                            disabled={isSimpleStitching}
                          >
                            {isSimpleStitching ? (
                              <Loader2 className="w-3 h-3 animate-spin mr-1" />
                            ) : (
                              <Sparkles className="w-3 h-3 mr-1" />
                            )}
                            Stitch Video
                          </Button>
                        )}
                        {completedClips > 0 && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 px-2 text-[10px] text-white/40 hover:text-white"
                            onClick={() => navigate(`/clips?projectId=${projectId}`)}
                          >
                            View All <ChevronRight className="w-3 h-3 ml-0.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <ClipGrid 
                      clips={clipResults}
                      onPlay={setSelectedClipUrl}
                      onRetry={handleRetryClip}
                      retryingIndex={retryingClipIndex}
                    />
                  </motion.div>
                )}

                {/* Status Cards */}
                <AnimatePresence mode="wait">
                  {/* Stalled/Paused Pipeline - Always show resume option */}
                  {!isRunning && !isComplete && projectId && clipResults.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/20"
                    >
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-amber-400">Pipeline Paused</p>
                          <p className="text-xs text-white/50 mt-0.5">
                            {completedClips} of {expectedClipCount} clips completed
                          </p>
                          <div className="flex gap-2 mt-3">
                            <Button 
                              size="sm" 
                              className="h-8 text-xs bg-amber-500 hover:bg-amber-400 text-black rounded-full font-medium" 
                              onClick={handleResume} 
                              disabled={isResuming}
                            >
                              {isResuming ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RotateCcw className="w-3 h-3 mr-1" />}
                              Resume Pipeline
                            </Button>
                            {completedClips === expectedClipCount && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="h-8 text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10 rounded-full" 
                                onClick={handleSimpleStitch} 
                                disabled={isSimpleStitching}
                              >
                                {isSimpleStitching ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Sparkles className="w-3 h-3 mr-1" />}
                                Quick Stitch
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {projectStatus === 'stitching' && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="p-4 rounded-xl bg-gradient-to-br from-white/[0.04] to-transparent border border-white/[0.08] flex items-center gap-3"
                    >
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                        <Cpu className="w-5 h-5 text-white" />
                      </motion.div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white">Assembling</p>
                        <p className="text-xs text-white/40">Cloud processing...</p>
                      </div>
                    </motion.div>
                  )}

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="p-4 rounded-xl bg-gradient-to-br from-red-500/10 to-transparent border border-red-500/20"
                    >
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-red-400">Error</p>
                          <p className="text-xs text-white/50 mt-0.5">{error}</p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {projectStatus === 'stitching_failed' && completedClips > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/20"
                    >
                      <div className="flex items-start gap-3">
                        <Layers className="w-5 h-5 text-amber-400 shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-amber-400">Stitch Failed</p>
                          <p className="text-xs text-white/50 mt-0.5">Try quick stitch</p>
                          <Button 
                            size="sm" 
                            className="mt-2 h-7 text-xs bg-amber-500 text-black rounded-full" 
                            onClick={handleSimpleStitch} 
                            disabled={isSimpleStitching}
                          >
                            {isSimpleStitching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                            <span className="ml-1">Quick Stitch</span>
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Final Video */}
                {finalVideoUrl && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm font-semibold text-white">Ready!</span>
                    </div>
                    
                    <div className="aspect-video rounded-lg overflow-hidden bg-black mb-3">
                      {finalVideoUrl.endsWith('.json') ? (
                        <ManifestVideoPlayer manifestUrl={finalVideoUrl} className="w-full h-full" />
                      ) : (
                        <video src={finalVideoUrl} controls className="w-full h-full object-contain" />
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      {!finalVideoUrl.endsWith('.json') && (
                        <Button size="sm" className="bg-emerald-500 hover:bg-emerald-400 text-white rounded-full" asChild>
                          <a href={finalVideoUrl} download><Download className="w-3.5 h-3.5 mr-1" />Download</a>
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="rounded-full border-white/10 text-white/60" onClick={() => navigate('/projects')}>
                        Projects
                      </Button>
                    </div>
                  </motion.div>
                )}

                {/* Troubleshooter */}
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
                    }}
                    onStatusChange={(status) => {
                      setProjectStatus(status);
                      if (status === 'stitching') updateStageStatus(5, 'active');
                      else if (status === 'completed') updateStageStatus(5, 'complete');
                    }}
                  />
                )}
              </div>

              {/* Right Column */}
              <div className="col-span-12 lg:col-span-4 space-y-4">
                
                {/* Activity Log */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="h-64 rounded-xl bg-gradient-to-br from-white/[0.03] to-transparent border border-white/[0.06] overflow-hidden"
                >
                  <ActivityLog logs={pipelineLogs} isLive={isRunning} />
                </motion.div>

                {/* Quality Score */}
                {auditScore !== null && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className={cn(
                      "p-4 rounded-xl border",
                      auditScore >= 80 ? "bg-emerald-500/5 border-emerald-500/20" 
                        : auditScore >= 60 ? "bg-amber-500/5 border-amber-500/20"
                        : "bg-red-500/5 border-red-500/20"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className={cn(
                          "w-4 h-4",
                          auditScore >= 80 ? "text-emerald-400" : auditScore >= 60 ? "text-amber-400" : "text-red-400"
                        )} />
                        <span className="text-xs font-medium text-white/50">Quality</span>
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

                {/* Stats */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="grid grid-cols-2 gap-2"
                >
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <span className="text-[10px] text-white/30 uppercase tracking-wider">Clips</span>
                    <p className="text-lg font-bold text-white mt-0.5">{completedClips}/{clipResults.length || expectedClipCount}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <span className="text-[10px] text-white/30 uppercase tracking-wider">Time</span>
                    <p className="text-lg font-bold text-white mt-0.5">{formatTime(elapsedTime)}</p>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </div>

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
              initial={{ scale: 0.9 }} 
              animate={{ scale: 1 }} 
              exit={{ scale: 0.9 }}
              className="relative max-w-4xl w-full aspect-video"
              onClick={(e) => e.stopPropagation()}
            >
              <video src={selectedClipUrl} controls autoPlay className="w-full h-full rounded-xl" />
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute top-3 right-3 bg-black/50 text-white rounded-full" 
                onClick={() => setSelectedClipUrl(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
