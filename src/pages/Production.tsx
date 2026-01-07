import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { 
  Film, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Play,
  Download,
  Clock,
  ArrowLeft,
  RotateCcw,
  Layers,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface StageStatus {
  name: string;
  shortName: string;
  status: 'pending' | 'active' | 'complete' | 'error' | 'skipped';
  details?: string;
}

interface ClipResult {
  index: number;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
}

interface PipelineLog {
  time: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

const INITIAL_STAGES: StageStatus[] = [
  { name: 'Script Generation', shortName: 'Script', status: 'pending' },
  { name: 'Identity Analysis', shortName: 'Identity', status: 'pending' },
  { name: 'Quality Audit', shortName: 'QA', status: 'pending' },
  { name: 'Asset Creation', shortName: 'Assets', status: 'pending' },
  { name: 'Video Production', shortName: 'Production', status: 'pending' },
  { name: 'Final Assembly', shortName: 'Assembly', status: 'pending' },
];

export default function Production() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const { user } = useAuth();
  
  const [isLoading, setIsLoading] = useState(true);
  const [projectTitle, setProjectTitle] = useState('');
  const [projectStatus, setProjectStatus] = useState('');
  const [stages, setStages] = useState<StageStatus[]>(INITIAL_STAGES);
  const [progress, setProgress] = useState(0);
  const [clipResults, setClipResults] = useState<ClipResult[]>([]);
  const [pipelineLogs, setPipelineLogs] = useState<PipelineLog[]>([]);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [auditScore, setAuditScore] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startTime] = useState<number>(Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);

  // Add log entry helper
  const addLog = useCallback((message: string, type: PipelineLog['type'] = 'info') => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setPipelineLogs(prev => [...prev, { time, message, type }].slice(-50));
  }, []);

  // Update stage status helper
  const updateStageStatus = useCallback((stageIndex: number, status: StageStatus['status'], details?: string) => {
    setStages(prev => {
      const updated = [...prev];
      updated[stageIndex] = { ...updated[stageIndex], status, details };
      return updated;
    });
  }, []);

  // Elapsed time tracker
  useEffect(() => {
    if (projectStatus === 'completed' || projectStatus === 'failed' || !projectId) {
      return;
    }
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, projectStatus, projectId]);

  // Load initial project data
  useEffect(() => {
    const loadProject = async () => {
      if (!projectId || !user) {
        toast.error('No project specified');
        navigate('/create');
        return;
      }

      try {
        const { data: project, error: fetchError } = await supabase
          .from('movie_projects')
          .select('*')
          .eq('id', projectId)
          .eq('user_id', user.id)
          .single();

        if (fetchError || !project) {
          toast.error('Project not found');
          navigate('/create');
          return;
        }

        setProjectTitle(project.title);
        setProjectStatus(project.status);
        
        if (project.video_url) {
          setFinalVideoUrl(project.video_url);
        }

        // Parse pending_video_tasks for current state
        const tasks = project.pending_video_tasks as any;
        if (tasks) {
          if (tasks.progress) setProgress(tasks.progress);
          if (tasks.auditScore) setAuditScore(tasks.auditScore);
          
          // Restore clip results
          const clipCount = tasks.clipCount || 6;
          if (tasks.clipsCompleted !== undefined) {
            setClipResults(Array(clipCount).fill(null).map((_, i) => ({
              index: i,
              status: i < tasks.clipsCompleted ? 'completed' : (i === tasks.clipsCompleted ? 'generating' : 'pending'),
            })));
          } else {
            setClipResults(Array(clipCount).fill(null).map((_, i) => ({
              index: i,
              status: 'pending',
            })));
          }

          // Restore stage statuses based on current stage
          const stageMap: Record<string, number> = {
            'preproduction': 0,
            'qualitygate': 2,
            'assets': 3,
            'production': 4,
            'postproduction': 5,
          };
          
          if (tasks.stage && stageMap[tasks.stage] !== undefined) {
            const currentIdx = stageMap[tasks.stage];
            setStages(prev => prev.map((s, i) => ({
              ...s,
              status: i < currentIdx ? 'complete' : (i === currentIdx ? 'active' : 'pending')
            })));
          }

          // Add initial log
          addLog(`Connected to pipeline: ${project.title}`, 'info');
        }

        // Handle completed or failed status
        if (project.status === 'completed') {
          setProgress(100);
          setStages(prev => prev.map(s => ({ ...s, status: 'complete' })));
          addLog('Pipeline completed!', 'success');
        } else if (project.status === 'failed') {
          setError('Pipeline failed');
          addLog('Pipeline failed', 'error');
        }

      } catch (err) {
        console.error('Error loading project:', err);
        toast.error('Failed to load project');
        navigate('/create');
      } finally {
        setIsLoading(false);
      }
    };

    loadProject();
  }, [projectId, user, navigate, addLog]);

  // Real-time subscription for pipeline updates
  useEffect(() => {
    if (!projectId || projectStatus === 'completed' || projectStatus === 'failed') {
      return;
    }

    const channel = supabase
      .channel(`production_${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'movie_projects',
          filter: `id=eq.${projectId}`,
        },
        (payload) => {
          const project = payload.new as any;
          if (!project) return;

          setProjectStatus(project.status);
          
          const tasks = project.pending_video_tasks;
          if (!tasks) return;

          // Update progress
          if (tasks.progress) {
            setProgress(tasks.progress);
          }

          // Map stage names to indices
          const stageMap: Record<string, number> = {
            'preproduction': 0,
            'qualitygate': 2,
            'assets': 3,
            'production': 4,
            'postproduction': 5,
          };

          // Update stages based on current stage
          if (tasks.stage && stageMap[tasks.stage] !== undefined) {
            const currentIdx = stageMap[tasks.stage];
            for (let i = 0; i < currentIdx; i++) {
              if (stages[i].status !== 'complete') {
                updateStageStatus(i, 'complete');
              }
            }
            updateStageStatus(currentIdx, 'active');
          }

          // Log and update specific details
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

          if (tasks.hasVoice && !pipelineLogs.some(l => l.message.includes('Voice narration'))) {
            addLog('Voice narration generated', 'success');
          }

          if (tasks.hasMusic && !pipelineLogs.some(l => l.message.includes('Background music'))) {
            addLog('Background music generated', 'success');
          }

          if (tasks.clipsCompleted !== undefined) {
            const clipCount = tasks.clipCount || clipResults.length || 6;
            setClipResults(prev => {
              const updated = [...prev];
              for (let i = 0; i < clipCount; i++) {
                if (i < tasks.clipsCompleted) {
                  updated[i] = { ...updated[i], status: 'completed' };
                } else if (i === tasks.clipsCompleted) {
                  updated[i] = { ...updated[i], status: 'generating' };
                }
              }
              return updated;
            });
            updateStageStatus(4, 'active', `${tasks.clipsCompleted}/${clipCount} clips`);
            addLog(`Video clips: ${tasks.clipsCompleted}/${clipCount} completed`, 'info');
          }

          // Handle completion
          if (tasks.stage === 'complete' && tasks.finalVideoUrl) {
            setFinalVideoUrl(tasks.finalVideoUrl);
            setProgress(100);
            stages.forEach((_, i) => updateStageStatus(i, 'complete'));
            addLog('Pipeline completed successfully!', 'success');
            toast.success('Video generated successfully!');
          }

          // Handle error
          if (tasks.stage === 'error') {
            setError(tasks.error || 'Pipeline failed');
            addLog(`Error: ${tasks.error || 'Pipeline failed'}`, 'error');
            toast.error(tasks.error || 'Pipeline failed');
          }

          // Handle status changes
          if (project.status === 'completed' && project.video_url) {
            setFinalVideoUrl(project.video_url);
            setProgress(100);
          }

          if (project.status === 'failed') {
            setError('Pipeline failed');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, projectStatus, stages, pipelineLogs, auditScore, clipResults.length, updateStageStatus, addLog]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isRunning = !['completed', 'failed', 'draft'].includes(projectStatus);
  const isComplete = projectStatus === 'completed';
  const isError = projectStatus === 'failed';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading pipeline...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/create')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="w-12 h-12 rounded-2xl bg-foreground flex items-center justify-center">
                <Film className="w-6 h-6 text-background" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Production Pipeline</h1>
                <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                  {projectTitle}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {isRunning && (
                <Badge variant="outline" className="gap-1.5 animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Processing
                </Badge>
              )}
              {isComplete && (
                <Badge className="bg-green-500/20 text-green-500 border-green-500/30 gap-1.5">
                  <CheckCircle2 className="w-3 h-3" />
                  Complete
                </Badge>
              )}
              {isError && (
                <Badge variant="destructive" className="gap-1.5">
                  <XCircle className="w-3 h-3" />
                  Failed
                </Badge>
              )}
              <Badge variant="outline" className="gap-1.5">
                <Clock className="w-3 h-3" />
                {formatTime(elapsedTime)}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Overall Progress */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Overall Progress</h2>
              <span className="text-2xl font-bold">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-3" />
          </CardContent>
        </Card>

        {/* Stages */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Layers className="w-5 h-5" />
              Pipeline Stages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {stages.map((stage, index) => (
                <motion.div
                  key={stage.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "p-3 rounded-xl border text-center transition-all",
                    stage.status === 'complete' && "bg-green-500/10 border-green-500/30",
                    stage.status === 'active' && "bg-primary/10 border-primary/30 ring-2 ring-primary/20",
                    stage.status === 'error' && "bg-destructive/10 border-destructive/30",
                    stage.status === 'pending' && "bg-muted/30 border-border/50"
                  )}
                >
                  <div className="flex justify-center mb-2">
                    {stage.status === 'complete' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                    {stage.status === 'active' && <Loader2 className="w-5 h-5 text-primary animate-spin" />}
                    {stage.status === 'error' && <XCircle className="w-5 h-5 text-destructive" />}
                    {stage.status === 'pending' && <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />}
                  </div>
                  <p className="text-xs font-medium truncate">{stage.shortName}</p>
                  {stage.details && (
                    <p className="text-[10px] text-muted-foreground truncate mt-1">{stage.details}</p>
                  )}
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Clip Progress */}
        {clipResults.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Film className="w-5 h-5" />
                Video Clips ({clipResults.filter(c => c.status === 'completed').length}/{clipResults.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {clipResults.map((clip, index) => (
                  <motion.div
                    key={index}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: index * 0.02 }}
                    className={cn(
                      "aspect-video rounded-lg border-2 flex items-center justify-center text-xs font-bold transition-all",
                      clip.status === 'completed' && "bg-green-500/20 border-green-500 text-green-600",
                      clip.status === 'generating' && "bg-primary/20 border-primary text-primary animate-pulse",
                      clip.status === 'failed' && "bg-destructive/20 border-destructive text-destructive",
                      clip.status === 'pending' && "bg-muted/30 border-border text-muted-foreground"
                    )}
                  >
                    {clip.status === 'generating' ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : clip.status === 'completed' ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : clip.status === 'failed' ? (
                      <XCircle className="w-3 h-3" />
                    ) : (
                      index + 1
                    )}
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Audit Score */}
        {auditScore !== null && (
          <Card className={cn(
            "border-2",
            auditScore >= 80 ? "border-green-500/30 bg-green-500/5" :
            auditScore >= 60 ? "border-yellow-500/30 bg-yellow-500/5" :
            "border-red-500/30 bg-red-500/5"
          )}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Sparkles className={cn(
                    "w-6 h-6",
                    auditScore >= 80 ? "text-green-500" :
                    auditScore >= 60 ? "text-yellow-500" :
                    "text-red-500"
                  )} />
                  <div>
                    <p className="font-semibold">Quality Audit Score</p>
                    <p className="text-sm text-muted-foreground">Script coherence and visual consistency</p>
                  </div>
                </div>
                <div className={cn(
                  "text-4xl font-bold",
                  auditScore >= 80 ? "text-green-500" :
                  auditScore >= 60 ? "text-yellow-500" :
                  "text-red-500"
                )}>
                  {auditScore}%
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pipeline Logs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Pipeline Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-1 font-mono text-xs">
                {pipelineLogs.length === 0 ? (
                  <p className="text-muted-foreground">Waiting for pipeline events...</p>
                ) : (
                  pipelineLogs.map((log, index) => (
                    <div key={index} className="flex gap-2">
                      <span className="text-muted-foreground shrink-0">[{log.time}]</span>
                      <span className={cn(
                        log.type === 'success' && "text-green-500",
                        log.type === 'error' && "text-destructive",
                        log.type === 'warning' && "text-yellow-500",
                        log.type === 'info' && "text-foreground"
                      )}>
                        {log.message}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Card className="border-destructive/50 bg-destructive/10">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <AlertCircle className="w-6 h-6 text-destructive shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-destructive">Pipeline Error</h3>
                  <p className="text-sm text-muted-foreground mt-1">{error}</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-4"
                    onClick={() => navigate('/create')}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Start New Project
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Completed Video */}
        {finalVideoUrl && (
          <Card className="border-green-500/50 bg-green-500/5">
            <CardContent className="p-6">
              <div className="flex flex-col items-center gap-6">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                  <h2 className="text-2xl font-bold text-green-600">Video Complete!</h2>
                </div>
                
                <div className="w-full max-w-2xl aspect-video rounded-xl overflow-hidden border border-green-500/30">
                  <video
                    src={finalVideoUrl}
                    controls
                    className="w-full h-full object-contain bg-black"
                  />
                </div>
                
                <div className="flex items-center gap-3">
                  <Button asChild className="bg-green-600 hover:bg-green-700">
                    <a href={finalVideoUrl} download target="_blank" rel="noopener noreferrer">
                      <Download className="w-4 h-4 mr-2" />
                      Download Video
                    </a>
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/projects')}>
                    View All Projects
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/create')}>
                    Create Another
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
