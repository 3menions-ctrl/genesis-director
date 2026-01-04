import { useNavigate } from 'react-router-dom';
import { 
  Play, RotateCcw, ArrowLeft, ArrowRight, Sparkles, 
  Download, Film, Clock, Layers, Wand2, ChevronRight, Star,
  Video, Mic, CheckCircle2, Rocket
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useStudio } from '@/contexts/StudioContext';
import { VideoPlaylist } from '@/components/studio/VideoPlaylist';
import { GenerationLoader } from '@/components/studio/GenerationLoader';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

// Production pipeline steps
const PIPELINE_STEPS = [
  { id: 'script', label: 'Script', icon: Film, description: 'AI-generated screenplay' },
  { id: 'voice', label: 'Voice', icon: Mic, description: 'Neural voice synthesis' },
  { id: 'video', label: 'Video', icon: Video, description: 'Cinematic generation' },
  { id: 'render', label: 'Render', icon: Layers, description: 'Final composition' },
];

export default function Production() {
  const navigate = useNavigate();
  const { activeProject, generatePreview, isGenerating, generationProgress, credits, isLoading } = useStudio();
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const status = activeProject?.status || 'idle';

  // Show loading state while fetching projects
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading projects...</p>
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
        {/* Animated background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-accent/[0.08] rounded-full blur-[150px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-primary/[0.06] rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
        </div>
        
        <div className="relative z-10 text-center space-y-8 animate-fade-in">
          <div className="relative">
            <div className="w-28 h-28 mx-auto rounded-3xl bg-gradient-to-br from-accent/20 to-primary/20 border border-accent/30 flex items-center justify-center">
              <Film className="w-12 h-12 text-accent" />
            </div>
            <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary flex items-center justify-center animate-bounce">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
          </div>
          
          <div className="space-y-3">
            <h2 className="text-4xl font-display font-bold bg-gradient-to-r from-foreground via-primary to-accent bg-clip-text text-transparent">
              Production Studio
            </h2>
            <p className="text-lg text-muted-foreground max-w-md mx-auto">
              Create stunning AI-generated videos from your scripts
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button variant="glow" size="xl" onClick={() => navigate('/create')} className="gap-3 group">
              <Rocket className="w-5 h-5 group-hover:animate-bounce" />
              Create New Movie
            </Button>
            <Button variant="outline" size="lg" onClick={() => navigate('/projects')} className="gap-2">
              Browse Projects
              <ArrowRight className="w-4 h-4" />
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
          <div className="absolute top-1/3 left-1/3 w-[500px] h-[500px] bg-primary/[0.08] rounded-full blur-[150px]" />
        </div>
        
        <div className="relative z-10 text-center space-y-8 animate-fade-in">
          <div className="w-24 h-24 mx-auto rounded-3xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30 flex items-center justify-center">
            <Wand2 className="w-10 h-10 text-primary" />
          </div>
          
          <div className="space-y-3">
            <h2 className="text-3xl font-display font-bold text-foreground">Script Required</h2>
            <p className="text-lg text-muted-foreground max-w-md mx-auto">
              Your movie needs a script before we can bring it to life
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button variant="glow" size="xl" onClick={() => navigate('/script')} className="gap-3">
              <Sparkles className="w-5 h-5" />
              Write Script
            </Button>
            <Button variant="outline" size="lg" onClick={() => navigate('/create')} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Use Story Wizard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-gradient-to-b from-background via-background to-muted/10">
      {/* Ambient background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[800px] h-[400px] bg-primary/[0.03] rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[300px] bg-accent/[0.04] rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Header Section */}
        <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 animate-fade-in">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
                <Video className="w-7 h-7 text-white" />
              </div>
              {status === 'completed' && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-background flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">{activeProject.name}</h1>
              <div className="flex items-center gap-3 mt-1">
                <Badge variant="outline" className="text-xs">
                  <Clock className="w-3 h-3 mr-1" />
                  {activeProject.target_duration_minutes || 8}s
                </Badge>
                <Badge variant="outline" className="text-xs">4K UHD</Badge>
                <Badge variant="outline" className="text-xs">16:9</Badge>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/script')} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Edit Script
            </Button>
            
            <Button
              variant="aurora"
              size="lg"
              onClick={generatePreview}
              disabled={isGenerating}
              className="gap-2 min-w-[160px]"
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
                  <Sparkles className="w-4 h-4" />
                  Generate Video
                </>
              )}
            </Button>
            
            <Button 
              variant="outline" 
              size="lg"
              onClick={() => navigate('/export')}
              disabled={status !== 'completed'}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </Button>
          </div>
        </header>

        {/* Production Pipeline Tracker */}
        <div className="bg-card/50 backdrop-blur-xl rounded-2xl border border-border/50 p-6 animate-fade-in" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              Production Pipeline
            </h3>
            {isGenerating && (
              <Badge className="bg-primary/10 text-primary border-primary/20 gap-1.5">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                Processing
              </Badge>
            )}
          </div>
          
          <div className="grid grid-cols-4 gap-4">
            {PIPELINE_STEPS.map((step, index) => {
              const isComplete = index < currentPipelineStep;
              const isCurrent = index === currentPipelineStep && isGenerating;
              const isPending = index > currentPipelineStep || (!isGenerating && status !== 'completed');
              
              return (
                <div key={step.id} className="relative">
                  {/* Connector line */}
                  {index < PIPELINE_STEPS.length - 1 && (
                    <div className="absolute top-6 left-[calc(50%+24px)] right-0 h-0.5 -translate-y-1/2">
                      <div className={cn(
                        "h-full rounded-full transition-all duration-500",
                        isComplete ? "bg-gradient-to-r from-primary to-accent" : "bg-border/30"
                      )} />
                    </div>
                  )}
                  
                  <div className={cn(
                    "relative flex flex-col items-center p-4 rounded-xl transition-all duration-300",
                    isCurrent && "bg-primary/5 border border-primary/20",
                    isComplete && "bg-emerald-500/5",
                  )}>
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-all duration-300",
                      isComplete && "bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20",
                      isCurrent && "bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/20 animate-pulse",
                      isPending && "bg-muted/50 border border-border/50"
                    )}>
                      {isComplete ? (
                        <CheckCircle2 className="w-6 h-6 text-white" />
                      ) : (
                        <step.icon className={cn(
                          "w-6 h-6",
                          isCurrent ? "text-white" : "text-muted-foreground"
                        )} />
                      )}
                    </div>
                    
                    <span className={cn(
                      "text-sm font-semibold mb-0.5",
                      isComplete && "text-emerald-600 dark:text-emerald-400",
                      isCurrent && "text-primary",
                      isPending && "text-muted-foreground"
                    )}>
                      {step.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground text-center">
                      {step.description}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Main Video Preview - Larger and more prominent */}
        <div 
          className="relative rounded-2xl overflow-hidden bg-black shadow-2xl shadow-black/60 animate-fade-in"
          style={{ animationDelay: '200ms' }}
        >
          {/* 16:9 Aspect Ratio Container - Made larger */}
          <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
            <div className="absolute inset-0">
              
              {/* Completed State - Video Player */}
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
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                      <div className="text-center space-y-4">
                        <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
                        <p className="text-xl font-semibold text-white">Video Ready!</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Generating State - New Animated Loader */}
              {(status === 'generating' || status === 'rendering' || isGenerating) && (
                <GenerationLoader 
                  step={generationProgress.step}
                  percent={generationProgress.percent}
                  estimatedSecondsRemaining={generationProgress.estimatedSecondsRemaining}
                  currentClip={generationProgress.currentClip}
                  totalClips={generationProgress.totalClips}
                />
              )}

              {/* Idle State - Ready to Generate */}
              {status === 'idle' && !isGenerating && (
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
                  <div className="text-center space-y-6 md:space-y-8 px-8">
                    <div className="relative">
                      <div className="w-24 h-24 md:w-32 md:h-32 mx-auto rounded-3xl bg-gradient-to-br from-muted/30 to-muted/10 border border-white/10 flex items-center justify-center">
                        <Play className="w-10 h-10 md:w-14 md:h-14 text-white/40" />
                      </div>
                      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-primary text-primary-foreground shadow-lg">
                          Ready to create
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <h3 className="text-xl md:text-2xl font-display font-bold text-white">
                        Lights, Camera, AI!
                      </h3>
                      <p className="text-white/60 max-w-md mx-auto text-sm md:text-base">
                        Your script is ready. Click "Generate Video" to bring your story to life.
                      </p>
                    </div>
                    
                    <Button
                      variant="aurora"
                      size="xl"
                      onClick={generatePreview}
                      className="gap-3"
                    >
                      <Sparkles className="w-5 h-5" />
                      Generate Video
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Script Preview & Stats Grid */}
        <div className="grid lg:grid-cols-3 gap-6 animate-fade-in" style={{ animationDelay: '300ms' }}>
          {/* Script Preview */}
          <div className="lg:col-span-2 bg-card/50 backdrop-blur-xl rounded-2xl border border-border/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Film className="w-4 h-4 text-primary" />
                Script Preview
              </h3>
              <Button variant="ghost" size="sm" onClick={() => navigate('/script')} className="gap-1.5 text-xs">
                Edit
                <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
            <div className="bg-muted/30 rounded-xl p-4 max-h-40 overflow-y-auto">
              <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                {activeProject.script_content?.slice(0, 500)}
                {(activeProject.script_content?.length || 0) > 500 && '...'}
              </p>
            </div>
          </div>
          
          {/* Quick Stats */}
          <div className="bg-card/50 backdrop-blur-xl rounded-2xl border border-border/50 p-6">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
              <Star className="w-4 h-4 text-warning" />
              Project Stats
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Duration</span>
                <span className="text-sm font-semibold">{activeProject.target_duration_minutes || 8}s</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Resolution</span>
                <span className="text-sm font-semibold">4K UHD</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Aspect Ratio</span>
                <span className="text-sm font-semibold">16:9</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant={status as any} className="text-xs">
                  {status === 'completed' ? 'Ready' : status === 'idle' ? 'Draft' : 'Processing'}
                </Badge>
              </div>
              <div className="pt-3 border-t border-border/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Credits Available</span>
                  <span className="text-sm font-bold text-primary">{credits.remaining.toLocaleString()}</span>
                </div>
                <Progress value={(credits.remaining / credits.total) * 100} className="h-1.5" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
