import { useNavigate } from 'react-router-dom';
import { 
  Play, RotateCcw, ArrowLeft, Sparkles, 
  Download, Film, Clock, Layers, Wand2, ChevronRight,
  Video, Mic, CheckCircle2, Rocket, Zap, Settings2,
  MonitorPlay, Volume2, Pause, FileText, Timer
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useStudio } from '@/contexts/StudioContext';
import { VideoPlaylist } from '@/components/studio/VideoPlaylist';
import { GenerationLoader } from '@/components/studio/GenerationLoader';
import { cn } from '@/lib/utils';
import { useState } from 'react';

// Production pipeline steps
const PIPELINE_STEPS = [
  { id: 'script', label: 'Script', icon: FileText, description: 'Ready' },
  { id: 'voice', label: 'Voice', icon: Volume2, description: 'Synthesis' },
  { id: 'video', label: 'Generate', icon: Video, description: 'AI Video' },
  { id: 'render', label: 'Complete', icon: CheckCircle2, description: 'Final' },
];

export default function Production() {
  const navigate = useNavigate();
  const { activeProject, generatePreview, cancelGeneration, isGenerating, generationProgress, credits, isLoading } = useStudio();
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const status = activeProject?.status || 'idle';

  // Show loading state while fetching projects
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="text-center space-y-6">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary to-accent opacity-20 animate-pulse" />
            <div className="absolute inset-2 rounded-xl bg-card flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          </div>
          <p className="text-muted-foreground font-medium">Loading your studio...</p>
        </div>
      </div>
    );
  }

  // Get current pipeline step based on generation progress
  const getCurrentPipelineStep = () => {
    if (status === 'completed') return 4;
    if (!isGenerating) return 0;
    
    switch (generationProgress.step) {
      case 'voice': return 1;
      case 'video': return 2;
      case 'polling': return 3;
      default: return 0;
    }
  };

  const currentPipelineStep = getCurrentPipelineStep();

  // No project selected
  if (!activeProject) {
    return (
      <div className="relative flex flex-col items-center justify-center min-h-[80vh] p-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-br from-primary/10 to-accent/5 rounded-full blur-[120px]" />
        </div>
        
        <div className="relative z-10 text-center space-y-8 animate-fade-in max-w-lg">
          <div className="icon-box w-20 h-20 mx-auto">
            <MonitorPlay className="w-9 h-9 text-white" />
          </div>
          
          <div className="space-y-3">
            <h1 className="text-4xl font-display font-bold text-foreground">
              Production Studio
            </h1>
            <p className="text-lg text-muted-foreground">
              Transform your scripts into stunning AI-generated videos
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button variant="glow" size="xl" onClick={() => navigate('/create')} className="gap-2.5">
              <Rocket className="w-5 h-5" />
              Create New Movie
            </Button>
            <Button variant="outline" size="lg" onClick={() => navigate('/projects')} className="gap-2">
              Browse Projects
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Project has no script
  if (!activeProject.script_content?.trim()) {
    return (
      <div className="relative flex flex-col items-center justify-center min-h-[80vh] p-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/8 rounded-full blur-[100px]" />
        </div>
        
        <div className="relative z-10 text-center space-y-8 animate-fade-in max-w-lg">
          <div className="icon-box-light w-20 h-20 mx-auto">
            <Wand2 className="w-9 h-9 text-primary" />
          </div>
          
          <div className="space-y-3">
            <h2 className="text-3xl font-display font-bold text-foreground">Script Required</h2>
            <p className="text-lg text-muted-foreground">
              Add a script to your project before generating video
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button variant="glow" size="xl" onClick={() => navigate('/script')} className="gap-2.5">
              <Sparkles className="w-5 h-5" />
              Write Script
            </Button>
            <Button variant="outline" size="lg" onClick={() => navigate('/create')} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Story Wizard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Header */}
        <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 animate-fade-in">
          <div className="flex items-center gap-4">
            <div className={cn(
              "icon-box w-12 h-12",
              status === 'completed' && "icon-box-success"
            )}>
              {status === 'completed' ? (
                <CheckCircle2 className="w-6 h-6 text-white" />
              ) : (
                <Video className="w-6 h-6 text-white" />
              )}
            </div>
            <div>
              <h1 className="text-xl font-display font-bold text-foreground">{activeProject.name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={cn(
                  "status-dot",
                  status === 'completed' && "status-completed",
                  status === 'generating' && "status-generating",
                  status === 'rendering' && "status-rendering",
                  status === 'idle' && "status-idle"
                )} />
                <span className="text-sm text-muted-foreground capitalize">{status === 'idle' ? 'Ready' : status}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/script')} className="gap-1.5">
              <FileText className="w-4 h-4" />
              Script
            </Button>
            
            <Button
              variant={status === 'completed' ? 'outline' : 'glow'}
              size="default"
              onClick={generatePreview}
              disabled={isGenerating}
              className="gap-2"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating...
                </>
              ) : status === 'completed' ? (
                <>
                  <RotateCcw className="w-4 h-4" />
                  Regenerate
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Generate
                </>
              )}
            </Button>
            
            {status === 'completed' && (
              <Button 
                variant="default" 
                size="default"
                onClick={() => navigate('/export')}
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Export
              </Button>
            )}
          </div>
        </header>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-4 gap-6">
          
          {/* Left Sidebar - Project Info */}
          <div className="lg:col-span-1 space-y-4 animate-fade-in" style={{ animationDelay: '50ms' }}>
            
            {/* Pipeline Status */}
            <div className="card-clean p-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Pipeline</h3>
              <div className="space-y-1">
                {PIPELINE_STEPS.map((step, index) => {
                  const isComplete = index < currentPipelineStep;
                  const isCurrent = index === currentPipelineStep && isGenerating;
                  const isFirst = index === 0;
                  
                  return (
                    <div 
                      key={step.id} 
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300",
                        isCurrent && "bg-primary/5 border border-primary/20",
                        isComplete && "bg-success/5",
                        isFirst && !isGenerating && status !== 'completed' && "bg-muted/50"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300",
                        isComplete && "bg-success text-white",
                        isCurrent && "bg-primary text-white animate-pulse",
                        !isComplete && !isCurrent && "bg-muted text-muted-foreground"
                      )}>
                        {isComplete ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <step.icon className="w-4 h-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm font-medium truncate",
                          isComplete && "text-success",
                          isCurrent && "text-primary",
                          !isComplete && !isCurrent && "text-muted-foreground"
                        )}>
                          {step.label}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Project Details */}
            <div className="card-clean p-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Details</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Timer className="w-4 h-4" />
                    <span className="text-sm">Duration</span>
                  </div>
                  <span className="text-sm font-semibold">{activeProject.target_duration_minutes || 1} min</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MonitorPlay className="w-4 h-4" />
                    <span className="text-sm">Resolution</span>
                  </div>
                  <span className="text-sm font-semibold">1080p HD</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Layers className="w-4 h-4" />
                    <span className="text-sm">Aspect</span>
                  </div>
                  <span className="text-sm font-semibold">16:9</span>
                </div>
              </div>
            </div>

            {/* Credits */}
            <div className="card-grey p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Credits</span>
                <span className="text-sm font-bold text-primary">{credits.remaining.toLocaleString()}</span>
              </div>
              <Progress value={(credits.remaining / credits.total) * 100} className="h-1.5" />
            </div>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3 space-y-4">
            
            {/* Video Preview - Primary Focus */}
            <div 
              className="relative rounded-2xl overflow-hidden bg-slate-900 shadow-xl animate-fade-in"
              style={{ animationDelay: '100ms' }}
            >
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <div className="absolute inset-0">
                  
                  {/* Completed State */}
                  {status === 'completed' && (
                    <div className="absolute inset-0">
                      {activeProject.video_clips && activeProject.video_clips.length > 0 ? (
                        <VideoPlaylist 
                          clips={activeProject.video_clips} 
                          onPlayStateChange={setIsPlaying}
                          onProgressChange={(current, total) => {
                            setProgress((current / total) * 100);
                          }}
                          showControls={true}
                        />
                      ) : activeProject.video_url ? (
                        <VideoPlaylist 
                          clips={[activeProject.video_url]} 
                          onPlayStateChange={setIsPlaying}
                          onProgressChange={(current, total) => {
                            setProgress((current / total) * 100);
                          }}
                          showControls={true}
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-success/20 to-success/5 flex items-center justify-center">
                          <div className="text-center space-y-4">
                            <div className="icon-box-success w-16 h-16 mx-auto">
                              <CheckCircle2 className="w-8 h-8 text-white" />
                            </div>
                            <p className="text-lg font-semibold text-white">Video Ready</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Generating State */}
                  {(status === 'generating' || status === 'rendering' || isGenerating) && (
                    <GenerationLoader 
                      step={generationProgress.step}
                      percent={generationProgress.percent}
                      estimatedSecondsRemaining={generationProgress.estimatedSecondsRemaining}
                      currentClip={generationProgress.currentClip}
                      totalClips={generationProgress.totalClips}
                      onCancel={cancelGeneration}
                    />
                  )}

                  {/* Idle State */}
                  {status === 'idle' && !isGenerating && (
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                      <div className="text-center space-y-6 px-8 max-w-md">
                        <div className="relative mx-auto w-20 h-20">
                          <div className="absolute inset-0 rounded-2xl bg-white/5 border border-white/10" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Play className="w-8 h-8 text-white/40" />
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <h3 className="text-xl font-display font-bold text-white">
                            Ready to Generate
                          </h3>
                          <p className="text-white/50 text-sm">
                            Click the generate button to create your AI video
                          </p>
                        </div>
                        
                        <Button
                          variant="glow"
                          size="lg"
                          onClick={generatePreview}
                          className="gap-2"
                        >
                          <Zap className="w-5 h-5" />
                          Generate Video
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Script Preview */}
            <div className="card-clean p-5 animate-fade-in" style={{ animationDelay: '150ms' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="icon-box-light w-8 h-8">
                    <FileText className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">Script</h3>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate('/script')} className="gap-1.5 text-xs h-8">
                  Edit
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </div>
              <div className="bg-muted/30 rounded-xl p-4 max-h-32 overflow-y-auto">
                <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                  {activeProject.script_content?.slice(0, 400)}
                  {(activeProject.script_content?.length || 0) > 400 && '...'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
