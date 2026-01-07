import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, 
  Users, 
  Shield, 
  Wand2, 
  Film, 
  Sparkles,
  CheckCircle2,
  Loader2,
  XCircle,
  Play,
  Clock,
  Zap,
  ChevronRight,
  X,
  Eye,
  Download,
  Volume2,
  Music,
  Palette,
  Layers,
  Video,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FullscreenVideoPlayer } from './FullscreenVideoPlayer';
import { ProFeaturesPanel } from './ProFeaturesPanel';
import { supabase } from '@/integrations/supabase/client';

interface StageStatus {
  name: string;
  shortName: string;
  status: 'pending' | 'active' | 'complete' | 'error' | 'skipped';
  details?: string;
  data?: Record<string, any>;
}

interface ProFeaturesData {
  musicSync?: { enabled: boolean; score?: number; count?: number };
  colorGrading?: { enabled: boolean; score?: number; details?: string };
  sfx?: { enabled: boolean; count?: number };
  visualDebugger?: { enabled: boolean; retriesUsed?: number; avgScore?: number };
  multiCharacterBible?: { enabled: boolean; count?: number };
  depthConsistency?: { enabled: boolean; score?: number };
}

interface ProductionPipelineProps {
  stages: StageStatus[];
  progress: number;
  elapsedTime: number;
  isRunning: boolean;
  finalVideoUrl?: string | null;
  pipelineLogs?: Array<{ time: string; message: string; type: 'info' | 'success' | 'warning' | 'error' }>;
  clipResults?: Array<{ index: number; status: string; videoUrl?: string; error?: string }>;
  auditScore?: number | null;
  sceneImages?: Array<{ sceneNumber: number; imageUrl: string }>;
  identityBibleViews?: { front?: string; side?: string; threeQuarter?: string } | null;
  onCancel?: () => void;
  className?: string;
  projectId?: string;
  qualityTier?: 'standard' | 'professional';
  proFeaturesData?: ProFeaturesData;
}

interface DatabaseClip {
  id: string;
  shot_index: number;
  prompt: string;
  status: string;
  video_url: string | null;
  error_message: string | null;
  created_at: string;
}

const STAGE_ICONS = [FileText, Users, Shield, Wand2, Film, Sparkles];

const STAGE_DESCRIPTIONS = [
  { 
    title: 'Script Generation',
    description: 'AI crafts your cinematic narrative, breaking it into professional shot-by-shot sequences.',
    details: 'Using advanced language models to create compelling visual storytelling with proper pacing and shot variety.'
  },
  {
    title: 'Identity Analysis', 
    description: 'Characters and visual elements are extracted and catalogued for consistency.',
    details: 'Building a visual identity bible to ensure character consistency across all generated scenes.'
  },
  {
    title: 'Quality Audit',
    description: 'Every shot is analyzed for cinematic excellence before production begins.',
    details: 'Professional-grade quality checks ensure proper composition, lighting descriptions, and camera movements.'
  },
  {
    title: 'Asset Creation',
    description: 'Voice narration, music, and visual references are generated.',
    details: 'Creating the audio-visual assets that will bring your story to life with professional polish.'
  },
  {
    title: 'Video Production',
    description: 'Each scene is rendered using state-of-the-art AI video generation.',
    details: 'Generating high-quality video clips with cinematic camera movements and visual effects.'
  },
  {
    title: 'Final Assembly',
    description: 'All elements are stitched together into your finished masterpiece.',
    details: 'Professional post-production including color grading, audio mixing, and seamless transitions.'
  }
];

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function ProductionPipeline({
  stages,
  progress,
  elapsedTime,
  isRunning,
  finalVideoUrl,
  pipelineLogs = [],
  clipResults = [],
  auditScore,
  sceneImages = [],
  identityBibleViews,
  onCancel,
  className,
  projectId,
  qualityTier = 'standard',
  proFeaturesData
}: ProductionPipelineProps) {
  const [selectedStage, setSelectedStage] = useState<number | null>(null);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [pulseIndex, setPulseIndex] = useState(0);
  const [showClipsDialog, setShowClipsDialog] = useState(false);
  const [databaseClips, setDatabaseClips] = useState<DatabaseClip[]>([]);
  const [loadingClips, setLoadingClips] = useState(false);
  const [playingClipUrl, setPlayingClipUrl] = useState<string | null>(null);
  const [liveProFeaturesData, setLiveProFeaturesData] = useState<ProFeaturesData>({});

  // Fetch clips from database when dialog opens
  const fetchClipsFromDatabase = useCallback(async () => {
    if (!projectId) return;
    
    setLoadingClips(true);
    try {
      const { data, error } = await supabase
        .from('video_clips')
        .select('id, shot_index, prompt, status, video_url, error_message, created_at')
        .eq('project_id', projectId)
        .order('shot_index', { ascending: true });
      
      if (error) throw error;
      setDatabaseClips(data || []);
    } catch (err) {
      console.error('Failed to fetch clips:', err);
    } finally {
      setLoadingClips(false);
    }
  }, [projectId]);

  // Fetch pro features data from project's pending_video_tasks
  useEffect(() => {
    if (!projectId || qualityTier !== 'professional') return;
    
    const fetchProFeatures = async () => {
      try {
        const { data, error } = await supabase
          .from('movie_projects')
          .select('pending_video_tasks, pro_features_data')
          .eq('id', projectId)
          .single();
        
        if (error) throw error;
        
        // Extract pro features from pending_video_tasks or pro_features_data
        const tasks = data?.pending_video_tasks as Record<string, unknown> | null;
        const proData = data?.pro_features_data as ProFeaturesData | null;
        
        if (proData) {
          setLiveProFeaturesData(proData);
        } else if (tasks?.proFeaturesUsed) {
          const pfu = tasks.proFeaturesUsed as Record<string, unknown>;
          setLiveProFeaturesData({
            musicSync: { enabled: !!pfu.musicSync, count: typeof pfu.musicSync === 'number' ? pfu.musicSync : undefined },
            colorGrading: { enabled: !!pfu.colorGrading, details: typeof pfu.colorGrading === 'string' ? pfu.colorGrading : undefined },
            sfx: { enabled: !!pfu.sfxCues, count: typeof pfu.sfxCues === 'number' ? pfu.sfxCues : undefined },
            visualDebugger: { enabled: true },
            multiCharacterBible: { enabled: !!pfu.multiCharacterBible },
            depthConsistency: { enabled: !!pfu.depthConsistency, score: typeof pfu.depthConsistency === 'number' ? pfu.depthConsistency : undefined },
          });
        }
      } catch (err) {
        console.error('Failed to fetch pro features:', err);
      }
    };
    
    fetchProFeatures();
    
    // Subscribe to realtime updates for pro features
    const channel = supabase
      .channel(`pro_features_${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'movie_projects',
          filter: `id=eq.${projectId}`,
        },
        (payload) => {
          const project = payload.new as Record<string, unknown>;
          const tasks = project?.pending_video_tasks as Record<string, unknown> | null;
          const proData = project?.pro_features_data as ProFeaturesData | null;
          
          if (proData) {
            setLiveProFeaturesData(proData);
          } else if (tasks?.proFeaturesUsed) {
            const pfu = tasks.proFeaturesUsed as Record<string, unknown>;
            setLiveProFeaturesData({
              musicSync: { enabled: !!pfu.musicSync, count: typeof pfu.musicSync === 'number' ? pfu.musicSync : undefined },
              colorGrading: { enabled: !!pfu.colorGrading, details: typeof pfu.colorGrading === 'string' ? pfu.colorGrading : undefined },
              sfx: { enabled: !!pfu.sfxCues, count: typeof pfu.sfxCues === 'number' ? pfu.sfxCues : undefined },
              visualDebugger: { enabled: true },
              multiCharacterBible: { enabled: !!pfu.multiCharacterBible },
              depthConsistency: { enabled: !!pfu.depthConsistency, score: typeof pfu.depthConsistency === 'number' ? pfu.depthConsistency : undefined },
            });
          }
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, qualityTier]);

  useEffect(() => {
    if (showClipsDialog) {
      fetchClipsFromDatabase();
    }
  }, [showClipsDialog, fetchClipsFromDatabase]);

  // Animated pulse effect for active stages
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setPulseIndex(prev => (prev + 1) % 3);
    }, 800);
    return () => clearInterval(interval);
  }, [isRunning]);

  // Find active stage index
  const activeStageIndex = stages.findIndex(s => s.status === 'active');
  const completedCount = stages.filter(s => s.status === 'complete').length;

  // Calculate connection line progress
  const lineProgress = completedCount > 0 
    ? ((completedCount - 0.5) / (stages.length - 1)) * 100
    : 0;
  
  // Merge passed proFeaturesData with live data
  const mergedProFeaturesData = { ...proFeaturesData, ...liveProFeaturesData };

  return (
    <div className={cn("w-full", className)}>
      {/* Header Stats */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-8"
      >
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span className="font-mono text-sm">{formatTime(elapsedTime)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">{progress}%</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {projectId && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowClipsDialog(true)}
              className="text-muted-foreground hover:text-foreground"
            >
              <Video className="w-4 h-4 mr-2" />
              View Clips
            </Button>
          )}
          
          {/* Always show cancel/reset button when pipeline is visible */}
          {onCancel && (
            <Button 
              variant={isRunning ? "ghost" : "destructive"} 
              size="sm" 
              onClick={onCancel} 
              className={cn(
                isRunning 
                  ? "text-muted-foreground hover:text-destructive hover:bg-destructive/10" 
                  : ""
              )}
            >
              <X className="w-4 h-4 mr-2" />
              {isRunning ? 'Cancel' : 'Reset'}
            </Button>
          )}
        </div>
      </motion.div>

      {/* Main Pipeline Visualization */}
      <div className="relative">
        {/* Background glow effect */}
        {isRunning && (
          <div className="absolute inset-0 -z-10">
            <div 
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[200px] rounded-full opacity-20 blur-3xl"
              style={{
                background: 'radial-gradient(ellipse, hsl(var(--primary)) 0%, transparent 70%)',
              }}
            />
          </div>
        )}

        {/* Connection Lines */}
        <div className="absolute top-[72px] left-[60px] right-[60px] h-[2px] hidden md:block">
          {/* Base line */}
          <div className="absolute inset-0 bg-border/50 rounded-full" />
          
          {/* Progress line */}
          <motion.div 
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-primary via-primary to-primary/50 rounded-full"
            initial={{ width: '0%' }}
            animate={{ width: `${lineProgress}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            {/* Glowing tip */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary animate-pulse-ring" />
          </motion.div>
        </div>

        {/* Stage Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {stages.map((stage, index) => {
            const Icon = STAGE_ICONS[index];
            const isActive = stage.status === 'active';
            const isComplete = stage.status === 'complete';
            const isError = stage.status === 'error';
            const isPending = stage.status === 'pending';
            const isClickable = isComplete || isActive || isError;
            
            return (
              <motion.div
                key={stage.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  "relative group",
                  isClickable && "cursor-pointer"
                )}
                onClick={() => isClickable && setSelectedStage(index)}
              >
                {/* Card */}
                <motion.div
                  className={cn(
                    "relative flex flex-col items-center p-6 rounded-2xl transition-all duration-500",
                    "border bg-card/50 backdrop-blur-sm",
                    isPending && "border-border/50 opacity-50",
                    isActive && "border-primary/50 bg-primary/5 shadow-lg shadow-primary/10",
                    isComplete && "border-success/30 bg-success/5",
                    isError && "border-destructive/30 bg-destructive/5",
                    isClickable && "hover:scale-[1.02] hover:shadow-xl"
                  )}
                  animate={isActive ? {
                    boxShadow: [
                      '0 0 0 0 rgba(var(--primary), 0)',
                      '0 0 30px 5px rgba(var(--primary), 0.1)',
                      '0 0 0 0 rgba(var(--primary), 0)'
                    ]
                  } : {}}
                  transition={{ duration: 2, repeat: isActive ? Infinity : 0 }}
                >
                  {/* Breathing indicator for active */}
                  {isActive && (
                    <div className="absolute inset-0 rounded-2xl overflow-hidden">
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-t from-primary/10 to-transparent"
                        animate={{ opacity: [0.3, 0.6, 0.3] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    </div>
                  )}

                  {/* Icon Container */}
                  <div className={cn(
                    "relative w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all duration-500",
                    isPending && "bg-muted text-muted-foreground",
                    isActive && "bg-primary/10 text-primary",
                    isComplete && "bg-success/10 text-success",
                    isError && "bg-destructive/10 text-destructive"
                  )}>
                    {isActive ? (
                      <div className="relative">
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <motion.div
                          className="absolute inset-0 rounded-full border-2 border-primary/30"
                          animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        />
                      </div>
                    ) : isComplete ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 200 }}
                      >
                        <CheckCircle2 className="w-6 h-6" />
                      </motion.div>
                    ) : isError ? (
                      <XCircle className="w-6 h-6" />
                    ) : (
                      <Icon className="w-6 h-6" />
                    )}
                  </div>

                  {/* Label */}
                  <h3 className={cn(
                    "text-sm font-medium text-center transition-colors",
                    isPending && "text-muted-foreground",
                    isActive && "text-primary",
                    isComplete && "text-success",
                    isError && "text-destructive"
                  )}>
                    {stage.shortName}
                  </h3>

                  {/* Details badge */}
                  {stage.details && (
                    <Badge 
                      variant="secondary" 
                      className={cn(
                        "mt-2 text-[10px] px-2 py-0.5",
                        isComplete && "bg-success/10 text-success border-success/20"
                      )}
                    >
                      {stage.details}
                    </Badge>
                  )}

                  {/* Click hint */}
                  {isClickable && (
                    <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Eye className="w-3 h-3 text-muted-foreground" />
                    </div>
                  )}
                </motion.div>

                {/* Step number */}
                <div className={cn(
                  "absolute -top-2 -left-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                  isPending && "bg-muted text-muted-foreground",
                  isActive && "bg-primary text-primary-foreground",
                  isComplete && "bg-success text-success-foreground",
                  isError && "bg-destructive text-destructive-foreground"
                )}>
                  {index + 1}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Live Logs Section */}
      {isRunning && pipelineLogs.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-8"
        >
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                Live Progress
              </h4>
            </div>
            <ScrollArea className="h-32">
              <div className="space-y-1 font-mono text-xs">
                {pipelineLogs.slice(-10).map((log, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={cn(
                      "flex items-start gap-2 py-1",
                      log.type === 'success' && "text-success",
                      log.type === 'error' && "text-destructive",
                      log.type === 'warning' && "text-warning",
                      log.type === 'info' && "text-muted-foreground"
                    )}
                  >
                    <span className="text-muted-foreground/60">{log.time}</span>
                    <span>{log.message}</span>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </motion.div>
      )}

      {/* Pro Features Panel - Show for professional tier */}
      {qualityTier === 'professional' && (
        <ProFeaturesPanel
          qualityTier={qualityTier}
          proFeaturesData={mergedProFeaturesData}
          isRunning={isRunning}
          className="mt-6"
        />
      )}

      {/* Final Video Card */}
      <AnimatePresence>
        {finalVideoUrl && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className="mt-10"
          >
            <div 
              className="relative group cursor-pointer overflow-hidden rounded-3xl"
              onClick={() => setShowVideoPlayer(true)}
            >
              {/* Video thumbnail / preview */}
              <div className="relative aspect-video bg-gradient-to-br from-primary/10 via-background to-primary/5 flex items-center justify-center">
                <video 
                  src={finalVideoUrl} 
                  className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                  muted
                  playsInline
                  onMouseEnter={(e) => e.currentTarget.play()}
                  onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                />
                
                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 group-hover:from-black/40 transition-all" />
                
                {/* Play button */}
                <motion.div
                  className="relative z-10 w-20 h-20 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-2xl"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Play className="w-8 h-8 text-primary fill-primary ml-1" />
                </motion.div>

                {/* Badge */}
                <div className="absolute top-4 left-4 z-10">
                  <Badge className="bg-success text-success-foreground border-0 px-3 py-1">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Production Complete
                  </Badge>
                </div>

                {/* Duration & actions */}
                <div className="absolute bottom-4 left-4 right-4 z-10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="bg-black/50 text-white border-0">
                      <Clock className="w-3 h-3 mr-1" />
                      {formatTime(elapsedTime)} production time
                    </Badge>
                  </div>
                  <Button size="sm" variant="secondary" className="bg-white/90 hover:bg-white" onClick={(e) => { e.stopPropagation(); }}>
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stage Detail Modal */}
      <Dialog open={selectedStage !== null} onOpenChange={() => setSelectedStage(null)}>
        <DialogContent className="max-w-2xl">
          {selectedStage !== null && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  {(() => {
                    const Icon = STAGE_ICONS[selectedStage];
                    const stage = stages[selectedStage];
                    return (
                      <>
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center",
                          stage.status === 'complete' && "bg-success/10 text-success",
                          stage.status === 'active' && "bg-primary/10 text-primary",
                          stage.status === 'error' && "bg-destructive/10 text-destructive"
                        )}>
                          {stage.status === 'complete' ? (
                            <CheckCircle2 className="w-6 h-6" />
                          ) : stage.status === 'active' ? (
                            <Loader2 className="w-6 h-6 animate-spin" />
                          ) : stage.status === 'error' ? (
                            <XCircle className="w-6 h-6" />
                          ) : (
                            <Icon className="w-6 h-6" />
                          )}
                        </div>
                        <div>
                          <DialogTitle>{STAGE_DESCRIPTIONS[selectedStage].title}</DialogTitle>
                          <DialogDescription>{STAGE_DESCRIPTIONS[selectedStage].description}</DialogDescription>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Stage-specific content */}
                {selectedStage === 0 && stages[0].status === 'complete' && (
                  <div className="space-y-4">
                    <div className="glass-card p-4">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Script Generated
                      </h4>
                      <p className="text-sm text-muted-foreground">{STAGE_DESCRIPTIONS[0].details}</p>
                    </div>
                  </div>
                )}

                {selectedStage === 1 && identityBibleViews && (
                  <div className="space-y-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Identity Bible
                    </h4>
                    <div className="grid grid-cols-3 gap-3">
                      {identityBibleViews.front && (
                        <img src={identityBibleViews.front} alt="Front view" className="rounded-lg aspect-square object-cover" />
                      )}
                      {identityBibleViews.side && (
                        <img src={identityBibleViews.side} alt="Side view" className="rounded-lg aspect-square object-cover" />
                      )}
                      {identityBibleViews.threeQuarter && (
                        <img src={identityBibleViews.threeQuarter} alt="3/4 view" className="rounded-lg aspect-square object-cover" />
                      )}
                    </div>
                  </div>
                )}

                {selectedStage === 2 && auditScore !== null && (
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-success/20 to-success/5 mb-4">
                        <span className="text-3xl font-bold text-success">{auditScore}</span>
                      </div>
                      <h4 className="font-medium">Quality Score</h4>
                      <p className="text-sm text-muted-foreground">Cinematic excellence rating</p>
                    </div>
                    <Progress value={auditScore} className="h-2" />
                  </div>
                )}

                {selectedStage === 3 && (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="glass-card p-4 text-center">
                      <Volume2 className="w-6 h-6 mx-auto mb-2 text-primary" />
                      <p className="text-sm font-medium">Voice</p>
                    </div>
                    <div className="glass-card p-4 text-center">
                      <Music className="w-6 h-6 mx-auto mb-2 text-primary" />
                      <p className="text-sm font-medium">Music</p>
                    </div>
                    <div className="glass-card p-4 text-center">
                      <Palette className="w-6 h-6 mx-auto mb-2 text-primary" />
                      <p className="text-sm font-medium">Color</p>
                    </div>
                  </div>
                )}

                {selectedStage === 4 && clipResults.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <Layers className="w-4 h-4" />
                      Video Clips ({clipResults.filter(c => c.status === 'completed').length}/{clipResults.length})
                    </h4>
                    <div className="grid grid-cols-3 gap-2">
                      {clipResults.map((clip, i) => (
                        <div 
                          key={i}
                          className={cn(
                            "aspect-video rounded-lg flex items-center justify-center text-xs",
                            clip.status === 'completed' && "bg-success/10 text-success",
                            clip.status === 'generating' && "bg-primary/10 text-primary",
                            clip.status === 'pending' && "bg-muted text-muted-foreground",
                            clip.status === 'failed' && "bg-destructive/10 text-destructive"
                          )}
                        >
                          {clip.status === 'generating' ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : clip.status === 'completed' ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : clip.status === 'failed' ? (
                            <XCircle className="w-4 h-4" />
                          ) : (
                            <span>Clip {i + 1}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedStage === 5 && sceneImages.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Scene Previews
                    </h4>
                    <div className="grid grid-cols-3 gap-2">
                      {sceneImages.slice(0, 6).map((scene, i) => (
                        <img 
                          key={i}
                          src={scene.imageUrl} 
                          alt={`Scene ${scene.sceneNumber}`}
                          className="rounded-lg aspect-video object-cover"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Stage logs */}
                {pipelineLogs.length > 0 && (
                  <div className="glass-card p-4">
                    <h4 className="text-sm font-medium mb-3">Activity Log</h4>
                    <ScrollArea className="h-32">
                      <div className="space-y-1 font-mono text-xs">
                        {pipelineLogs
                          .filter(log => log.message.toLowerCase().includes(stages[selectedStage].shortName.toLowerCase()))
                          .slice(-5)
                          .map((log, i) => (
                            <div 
                              key={i}
                              className={cn(
                                "flex items-start gap-2 py-1",
                                log.type === 'success' && "text-success",
                                log.type === 'error' && "text-destructive"
                              )}
                            >
                              <span className="text-muted-foreground/60">{log.time}</span>
                              <span>{log.message}</span>
                            </div>
                          ))
                        }
                        {pipelineLogs.filter(log => log.message.toLowerCase().includes(stages[selectedStage].shortName.toLowerCase())).length === 0 && (
                          <p className="text-muted-foreground">No specific logs for this stage yet.</p>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Fullscreen Video Player */}
      {showVideoPlayer && finalVideoUrl && (
        <div className="fixed inset-0 z-50">
          <FullscreenVideoPlayer
            clips={[finalVideoUrl]}
            title="Production Complete"
            onClose={() => setShowVideoPlayer(false)}
          />
        </div>
      )}

      {/* Playing individual clip */}
      {playingClipUrl && (
        <div className="fixed inset-0 z-50">
          <FullscreenVideoPlayer
            clips={[playingClipUrl]}
            title="Clip Preview"
            onClose={() => setPlayingClipUrl(null)}
          />
        </div>
      )}

      {/* View Clips Dialog */}
      <Dialog open={showClipsDialog} onOpenChange={setShowClipsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="w-5 h-5" />
              Generated Clips
            </DialogTitle>
            <DialogDescription>
              {databaseClips.length > 0 
                ? `${databaseClips.filter(c => c.video_url).length} of ${databaseClips.length} clips generated`
                : 'No clips found for this project'}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[60vh] pr-4">
            {loadingClips ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : databaseClips.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Video className="w-12 h-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No clips have been generated yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {databaseClips.map((clip) => (
                  <motion.div
                    key={clip.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "rounded-xl border overflow-hidden",
                      clip.status === 'completed' && clip.video_url && "border-success/30 bg-success/5",
                      clip.status === 'generating' && "border-primary/30 bg-primary/5",
                      clip.status === 'pending' && "border-border bg-muted/30",
                      clip.status === 'failed' && "border-destructive/30 bg-destructive/5"
                    )}
                  >
                    {/* Video preview or placeholder */}
                    <div className="relative aspect-video bg-black/20">
                      {clip.video_url ? (
                        <>
                          <video
                            src={clip.video_url}
                            className="absolute inset-0 w-full h-full object-cover"
                            muted
                            playsInline
                            onMouseEnter={(e) => e.currentTarget.play()}
                            onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                          
                          {/* Play button overlay */}
                          <button
                            onClick={() => setPlayingClipUrl(clip.video_url!)}
                            className="absolute inset-0 flex items-center justify-center group"
                          >
                            <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                              <Play className="w-5 h-5 text-primary fill-primary ml-0.5" />
                            </div>
                          </button>
                        </>
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          {clip.status === 'generating' ? (
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                          ) : clip.status === 'failed' ? (
                            <XCircle className="w-8 h-8 text-destructive" />
                          ) : (
                            <Film className="w-8 h-8 text-muted-foreground/50" />
                          )}
                        </div>
                      )}

                      {/* Shot number badge */}
                      <Badge 
                        className="absolute top-2 left-2"
                        variant={clip.status === 'completed' ? 'default' : 'secondary'}
                      >
                        Shot {clip.shot_index + 1}
                      </Badge>

                      {/* Status badge */}
                      <Badge 
                        className={cn(
                          "absolute top-2 right-2",
                          clip.status === 'completed' && "bg-success text-success-foreground",
                          clip.status === 'generating' && "bg-primary text-primary-foreground",
                          clip.status === 'failed' && "bg-destructive text-destructive-foreground"
                        )}
                        variant="secondary"
                      >
                        {clip.status === 'completed' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                        {clip.status === 'generating' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                        {clip.status === 'failed' && <XCircle className="w-3 h-3 mr-1" />}
                        {clip.status}
                      </Badge>
                    </div>

                    {/* Clip info */}
                    <div className="p-3 space-y-2">
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {clip.prompt}
                      </p>
                      
                      {clip.error_message && (
                        <p className="text-xs text-destructive line-clamp-2">
                          Error: {clip.error_message}
                        </p>
                      )}

                      {clip.video_url && (
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="secondary" 
                            className="flex-1"
                            onClick={() => setPlayingClipUrl(clip.video_url!)}
                          >
                            <Play className="w-3 h-3 mr-1" />
                            Play
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => window.open(clip.video_url!, '_blank')}
                          >
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              {databaseClips.filter(c => c.video_url).length} completed clips
            </div>
            <Button variant="outline" onClick={() => fetchClipsFromDatabase()}>
              <Loader2 className={cn("w-4 h-4 mr-2", loadingClips && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
