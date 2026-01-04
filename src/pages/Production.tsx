import { useNavigate } from 'react-router-dom';
import { 
  Play, RotateCcw, ArrowLeft, Sparkles, 
  Download, Film, Clock, Layers, Wand2, ChevronRight,
  Video, Mic, CheckCircle2, Rocket, Zap, Settings2,
  MonitorPlay, Volume2, Pause, FileText, Timer, Share2,
  Maximize2, SkipBack, SkipForward, VolumeX, Repeat,
  Scissors, Image, Music, Subtitles, Palette, Clapperboard
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { useStudio } from '@/contexts/StudioContext';
import { VideoPlaylist } from '@/components/studio/VideoPlaylist';
import { GenerationLoader } from '@/components/studio/GenerationLoader';
import { cn } from '@/lib/utils';
import { useState, useRef } from 'react';
import { toast } from 'sonner';

// Production pipeline steps with enhanced info
const PIPELINE_STEPS = [
  { id: 'script', label: 'Script', icon: FileText, description: 'AI Screenplay', color: 'from-blue-500 to-blue-600' },
  { id: 'voice', label: 'Voice', icon: Volume2, description: 'Neural Audio', color: 'from-violet-500 to-purple-600' },
  { id: 'video', label: 'Generate', icon: Video, description: 'AI Visuals', color: 'from-amber-500 to-orange-600' },
  { id: 'render', label: 'Complete', icon: CheckCircle2, description: 'Final Cut', color: 'from-emerald-500 to-green-600' },
];

// Quick action tools
const QUICK_TOOLS = [
  { id: 'trim', label: 'Trim', icon: Scissors, description: 'Cut & trim clips' },
  { id: 'thumbnail', label: 'Thumbnail', icon: Image, description: 'Generate cover' },
  { id: 'music', label: 'Music', icon: Music, description: 'Add background' },
  { id: 'subtitles', label: 'Captions', icon: Subtitles, description: 'Auto subtitles' },
  { id: 'style', label: 'Style', icon: Palette, description: 'Color grade' },
  { id: 'scenes', label: 'Scenes', icon: Clapperboard, description: 'Scene editor' },
];

export default function Production() {
  const navigate = useNavigate();
  const { activeProject, generatePreview, cancelGeneration, isGenerating, generationProgress, credits, isLoading } = useStudio();
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  const status = activeProject?.status || 'idle';

  const handleFullscreen = () => {
    if (videoContainerRef.current) {
      if (!document.fullscreenElement) {
        videoContainerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  const handleShare = () => {
    toast.success('Share link copied to clipboard!');
  };

  const handleToolClick = (toolId: string) => {
    toast.info(`${toolId.charAt(0).toUpperCase() + toolId.slice(1)} feature coming soon!`);
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="text-center space-y-6">
          <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary to-accent opacity-20 animate-pulse" />
            <div className="absolute inset-3 rounded-xl bg-card flex items-center justify-center">
              <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          </div>
          <p className="text-muted-foreground font-medium">Loading studio...</p>
        </div>
      </div>
    );
  }

  // Get current pipeline step
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
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[900px] h-[450px] bg-gradient-to-br from-primary/8 to-accent/5 rounded-full blur-[150px]" />
        </div>
        
        <div className="relative z-10 text-center space-y-8 animate-fade-in max-w-xl">
          <div className="icon-box w-24 h-24 mx-auto">
            <MonitorPlay className="w-11 h-11 text-white" />
          </div>
          
          <div className="space-y-4">
            <h1 className="text-5xl font-display font-bold text-foreground">
              Production Studio
            </h1>
            <p className="text-xl text-muted-foreground">
              Transform your scripts into stunning AI-generated cinematic videos
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button variant="glow" size="xl" onClick={() => navigate('/create')} className="gap-3">
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

  // No script
  if (!activeProject.script_content?.trim()) {
    return (
      <div className="relative flex flex-col items-center justify-center min-h-[80vh] p-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-primary/6 rounded-full blur-[120px]" />
        </div>
        
        <div className="relative z-10 text-center space-y-8 animate-fade-in max-w-lg">
          <div className="icon-box-light w-24 h-24 mx-auto">
            <Wand2 className="w-11 h-11 text-primary" />
          </div>
          
          <div className="space-y-4">
            <h2 className="text-4xl font-display font-bold text-foreground">Script Required</h2>
            <p className="text-lg text-muted-foreground">
              Add a script to your project before generating video
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button variant="glow" size="xl" onClick={() => navigate('/script')} className="gap-3">
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

  const wordCount = activeProject.script_content?.split(/\s+/).filter(w => w.trim()).length || 0;
  const estimatedDuration = Math.ceil((wordCount / 150) * 60);

  return (
    <div className="min-h-[calc(100vh-4rem)] pb-8">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Header */}
        <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 animate-fade-in">
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg",
              status === 'completed' 
                ? "bg-gradient-to-br from-emerald-500 to-green-600 shadow-emerald-500/25" 
                : "bg-gradient-to-br from-primary to-accent shadow-primary/25"
            )}>
              {status === 'completed' ? (
                <CheckCircle2 className="w-7 h-7 text-white" />
              ) : (
                <Video className="w-7 h-7 text-white" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">{activeProject.name}</h1>
              <div className="flex items-center gap-3 mt-1">
                <div className="flex items-center gap-1.5">
                  <span className={cn(
                    "w-2 h-2 rounded-full",
                    status === 'completed' && "bg-emerald-500",
                    status === 'generating' && "bg-primary animate-pulse",
                    status === 'rendering' && "bg-amber-500 animate-pulse",
                    status === 'idle' && "bg-muted-foreground/50"
                  )} />
                  <span className="text-sm text-muted-foreground capitalize">
                    {status === 'idle' ? 'Ready to generate' : status}
                  </span>
                </div>
                <span className="text-muted-foreground/30">•</span>
                <span className="text-sm text-muted-foreground">{wordCount} words</span>
                <span className="text-muted-foreground/30">•</span>
                <span className="text-sm text-muted-foreground">~{estimatedDuration}s video</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/script')} className="gap-2">
              <FileText className="w-4 h-4" />
              Edit Script
            </Button>
            
            <Button variant="ghost" size="sm" onClick={handleShare} className="gap-2">
              <Share2 className="w-4 h-4" />
              Share
            </Button>
            
            <div className="w-px h-6 bg-border mx-1" />
            
            <Button
              variant={status === 'completed' ? 'outline' : 'glow'}
              size="lg"
              onClick={generatePreview}
              disabled={isGenerating}
              className="gap-2 min-w-[140px]"
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
                size="lg"
                onClick={() => navigate('/export')}
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Export
              </Button>
            )}
          </div>
        </header>

        {/* Pipeline Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in" style={{ animationDelay: '50ms' }}>
          {PIPELINE_STEPS.map((step, index) => {
            const isComplete = index < currentPipelineStep;
            const isCurrent = index === currentPipelineStep && isGenerating;
            const isFirst = index === 0;
            
            return (
              <div 
                key={step.id}
                className={cn(
                  "relative group rounded-2xl p-5 transition-all duration-500 overflow-hidden",
                  isComplete && "bg-gradient-to-br from-emerald-500/10 to-green-500/5 border border-emerald-500/20",
                  isCurrent && "bg-gradient-to-br from-primary/10 to-accent/5 border border-primary/30 shadow-lg shadow-primary/10",
                  !isComplete && !isCurrent && "bg-card border border-border/50 hover:border-border"
                )}
              >
                {/* Animated background for current step */}
                {isCurrent && (
                  <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-primary/20 to-transparent rounded-full blur-3xl animate-spin-slow" />
                  </div>
                )}
                
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300",
                      isComplete && "bg-gradient-to-br from-emerald-500 to-green-600 shadow-lg shadow-emerald-500/25",
                      isCurrent && `bg-gradient-to-br ${step.color} shadow-lg animate-pulse`,
                      !isComplete && !isCurrent && "bg-muted"
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
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-[10px] uppercase tracking-wider",
                        isComplete && "border-emerald-500/30 text-emerald-600 bg-emerald-500/10",
                        isCurrent && "border-primary/30 text-primary bg-primary/10",
                        !isComplete && !isCurrent && "text-muted-foreground"
                      )}
                    >
                      {isComplete ? 'Done' : isCurrent ? 'Active' : `Step ${index + 1}`}
                    </Badge>
                  </div>
                  
                  <h3 className={cn(
                    "text-lg font-semibold mb-1",
                    isComplete && "text-emerald-600 dark:text-emerald-400",
                    isCurrent && "text-primary",
                    !isComplete && !isCurrent && "text-foreground"
                  )}>
                    {step.label}
                  </h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                  
                  {/* Progress indicator for current step */}
                  {isCurrent && (
                    <div className="mt-4">
                      <Progress value={generationProgress.percent} className="h-1.5" />
                      <p className="text-xs text-muted-foreground mt-2">
                        {generationProgress.percent}% complete
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Main Video Player */}
        <div 
          ref={videoContainerRef}
          className="relative rounded-2xl overflow-hidden bg-slate-950 shadow-2xl shadow-black/40 animate-fade-in group"
          style={{ animationDelay: '100ms' }}
        >
          {/* Aspect ratio container - larger */}
          <div className="relative w-full" style={{ paddingBottom: '52%' }}>
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
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 flex items-center justify-center">
                      <div className="text-center space-y-4">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30">
                          <CheckCircle2 className="w-10 h-10 text-white" />
                        </div>
                        <p className="text-xl font-semibold text-white">Video Ready</p>
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
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
                  {/* Decorative elements */}
                  <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-[100px]" />
                    <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-accent/10 rounded-full blur-[80px]" />
                  </div>
                  
                  <div className="relative text-center space-y-8 px-8 max-w-lg">
                    <div className="relative mx-auto w-28 h-28 group cursor-pointer" onClick={generatePreview}>
                      <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/20 to-accent/20 border border-white/10 group-hover:border-primary/30 transition-all duration-300" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/30 group-hover:scale-110 transition-transform duration-300">
                          <Play className="w-8 h-8 text-white ml-1" />
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <h3 className="text-2xl font-display font-bold text-white">
                        Ready to Create
                      </h3>
                      <p className="text-white/50">
                        Your script will be transformed into a cinematic AI video
                      </p>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                      <Button
                        variant="glow"
                        size="xl"
                        onClick={generatePreview}
                        className="gap-2"
                      >
                        <Zap className="w-5 h-5" />
                        Start Generation
                      </Button>
                    </div>
                    
                    {/* Estimated info */}
                    <div className="flex items-center justify-center gap-6 text-white/40 text-sm">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>~{Math.ceil(estimatedDuration / 8 * 2)} min render</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Film className="w-4 h-4" />
                        <span>{Math.ceil(estimatedDuration / 8)} clips</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Video Controls Overlay */}
          {status === 'completed' && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 w-10 h-10">
                  <SkipBack className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 w-12 h-12 rounded-full bg-white/10">
                  {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                </Button>
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 w-10 h-10">
                  <SkipForward className="w-5 h-5" />
                </Button>
                
                <div className="flex-1 mx-4">
                  <Slider 
                    value={[progress]} 
                    max={100} 
                    step={0.1}
                    className="cursor-pointer"
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-white hover:bg-white/20 w-10 h-10"
                    onClick={() => setIsMuted(!isMuted)}
                  >
                    {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </Button>
                  <div className="w-20">
                    <Slider 
                      value={[isMuted ? 0 : volume]} 
                      max={100} 
                      step={1}
                      onValueChange={(v) => setVolume(v[0])}
                      className="cursor-pointer"
                    />
                  </div>
                </div>
                
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 w-10 h-10">
                  <Repeat className="w-5 h-5" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-white hover:bg-white/20 w-10 h-10"
                  onClick={handleFullscreen}
                >
                  <Maximize2 className="w-5 h-5" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Section: Tools & Script */}
        <div className="grid lg:grid-cols-3 gap-6 animate-fade-in" style={{ animationDelay: '150ms' }}>
          
          {/* Quick Tools */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-primary" />
                Quick Tools
              </h3>
              <Badge variant="outline" className="text-xs">Pro Features</Badge>
            </div>
            
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {QUICK_TOOLS.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => handleToolClick(tool.id)}
                  className="group card-clean p-4 text-center hover:border-primary/30 transition-all duration-300"
                >
                  <div className="icon-box-light w-10 h-10 mx-auto mb-3 group-hover:bg-primary/10 transition-colors">
                    <tool.icon className="w-5 h-5 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-0.5">{tool.label}</p>
                  <p className="text-[10px] text-muted-foreground">{tool.description}</p>
                </button>
              ))}
            </div>
          </div>
          
          {/* Script Preview */}
          <div className="card-clean p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="icon-box w-8 h-8">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">Script</h3>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/script')} className="gap-1 text-xs h-7 px-2">
                Edit
                <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
            
            <div className="bg-muted/30 rounded-xl p-4 max-h-[160px] overflow-y-auto">
              <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                {activeProject.script_content?.slice(0, 500)}
                {(activeProject.script_content?.length || 0) > 500 && '...'}
              </p>
            </div>
            
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
              <span className="text-xs text-muted-foreground">{wordCount} words</span>
              <span className="text-xs text-muted-foreground">~{estimatedDuration}s duration</span>
            </div>
          </div>
        </div>

        {/* Credits Bar */}
        <div className="card-grey p-4 flex items-center justify-between animate-fade-in" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Credits</span>
            </div>
            <div className="w-48">
              <Progress value={(credits.remaining / credits.total) * 100} className="h-2" />
            </div>
            <span className="text-sm font-bold text-primary">{credits.remaining.toLocaleString()} remaining</span>
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <Sparkles className="w-4 h-4" />
            Get More Credits
          </Button>
        </div>
      </div>
    </div>
  );
}
