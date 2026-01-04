import { useNavigate } from 'react-router-dom';
import { 
  Play, Pause, Maximize2, Volume2, VolumeX, RotateCcw, 
  ArrowLeft, ArrowRight, Sparkles, Zap,
  SkipBack, SkipForward, Settings2, Download,
  Film, Wand2, Clock, Layers, Music,
  Video, Mic, CheckCircle2,
  ChevronRight, Rocket, Star, Share2, Heart,
  Clapperboard, Camera, Lightbulb, Timer
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useStudio } from '@/contexts/StudioContext';
import { VideoPlaylist } from '@/components/studio/VideoPlaylist';
import { cn } from '@/lib/utils';
import { useState, useEffect, useRef } from 'react';

// Production pipeline with cinematic icons
const PIPELINE_STAGES = [
  { id: 'script', label: 'Script', icon: Film, color: 'from-violet-500 to-purple-600', glowColor: 'violet' },
  { id: 'voice', label: 'Voice', icon: Mic, color: 'from-blue-500 to-cyan-500', glowColor: 'blue' },
  { id: 'video', label: 'Video', icon: Camera, color: 'from-amber-500 to-orange-500', glowColor: 'amber' },
  { id: 'render', label: 'Export', icon: Clapperboard, color: 'from-emerald-500 to-green-500', glowColor: 'emerald' },
];

// Cinematic loading messages
const STAGE_MESSAGES = {
  voice: ['Analyzing emotional tone...', 'Synthesizing neural voice...', 'Adding cinematic depth...'],
  video: ['Composing visual scenes...', 'Generating cinematic frames...', 'Applying film grain...'],
  polling: ['Rendering final cut...', 'Color grading...', 'Mastering audio...'],
  idle: ['Preparing production...', 'Loading assets...', 'Warming up GPUs...'],
};

// Fun facts with better variety
const CINEMA_FACTS = [
  { icon: '🎬', text: 'The first movie ever made was just 2 seconds long' },
  { icon: '🎭', text: 'Each AI-generated voice is unique, like a fingerprint' },
  { icon: '✨', text: 'We process millions of visual patterns per frame' },
  { icon: '🚀', text: "You're witnessing the future of filmmaking" },
  { icon: '🎪', text: 'Our AI has learned from over 100,000 films' },
  { icon: '🌟', text: 'Every frame is crafted with cinematic precision' },
];

export default function Production() {
  const navigate = useNavigate();
  const { activeProject, generatePreview, isGenerating, generationProgress, credits } = useStudio();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(75);
  const [factIndex, setFactIndex] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const status = activeProject?.status || 'idle';

  // Cycle through facts and messages
  useEffect(() => {
    if (isGenerating) {
      const factInterval = setInterval(() => setFactIndex(i => (i + 1) % CINEMA_FACTS.length), 6000);
      const msgInterval = setInterval(() => setMessageIndex(i => (i + 1) % 3), 3000);
      return () => {
        clearInterval(factInterval);
        clearInterval(msgInterval);
      };
    }
  }, [isGenerating]);

  // Get current stage
  const getCurrentStage = () => {
    if (status === 'completed') return 4;
    if (!isGenerating) return 0;
    switch (generationProgress.step) {
      case 'voice': return 1;
      case 'video': return 2;
      case 'polling': return 3;
      default: return 0;
    }
  };

  const currentStage = getCurrentStage();
  const currentMessages = STAGE_MESSAGES[generationProgress.step as keyof typeof STAGE_MESSAGES] || STAGE_MESSAGES.idle;

  // Handle play/pause
  const togglePlayback = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
    setIsPlaying(!isPlaying);
  };

  // Empty state - No project
  if (!activeProject) {
    return (
      <div className="relative flex flex-col items-center justify-center min-h-[85vh] p-6 overflow-hidden">
        {/* Cinematic background */}
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-muted/20">
          {/* Film strip decoration */}
          <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-foreground/[0.02] to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-muted/30 to-transparent" />
          
          {/* Floating orbs */}
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-primary/[0.06] blur-[120px] animate-pulse" />
          <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] rounded-full bg-accent/[0.05] blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
        </div>
        
        <div className="relative z-10 text-center space-y-10 animate-fade-in max-w-2xl mx-auto">
          {/* Cinematic icon */}
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-primary/20 rounded-3xl blur-2xl scale-150 animate-pulse" />
            <div className="relative w-32 h-32 rounded-3xl bg-gradient-to-br from-primary via-accent to-primary flex items-center justify-center shadow-2xl shadow-primary/30">
              <Clapperboard className="w-14 h-14 text-white" />
            </div>
            <div className="absolute -top-3 -right-3 w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg animate-bounce">
              <Star className="w-5 h-5 text-white" fill="currentColor" />
            </div>
          </div>
          
          <div className="space-y-4">
            <h1 className="text-5xl font-display font-bold">
              <span className="text-gradient">Production Studio</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-lg mx-auto leading-relaxed">
              Transform your ideas into stunning AI-generated cinema with just a few clicks
            </p>
          </div>
          
          {/* Feature pills */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {['4K Ultra HD', 'Neural Voices', 'Cinematic AI', 'Instant Export'].map((feature, i) => (
              <Badge key={feature} variant="secondary" className="px-4 py-2 text-sm animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
                <Sparkles className="w-3 h-3 mr-1.5 text-primary" />
                {feature}
              </Badge>
            ))}
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Button variant="aurora" size="xl" onClick={() => navigate('/create')} className="gap-3 group min-w-[200px]">
              <Rocket className="w-5 h-5 group-hover:rotate-12 transition-transform" />
              Start Creating
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

  // Script required state
  if (!activeProject.script_content?.trim()) {
    return (
      <div className="relative flex flex-col items-center justify-center min-h-[85vh] p-6 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/3 left-1/3 w-[500px] h-[500px] bg-amber-500/[0.06] rounded-full blur-[120px] animate-pulse" />
        </div>
        
        <div className="relative z-10 text-center space-y-8 animate-fade-in max-w-xl mx-auto">
          <div className="relative inline-block">
            <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-2xl shadow-amber-500/30">
              <Lightbulb className="w-12 h-12 text-white" />
            </div>
          </div>
          
          <div className="space-y-3">
            <h2 className="text-3xl font-display font-bold text-foreground">Your Story Awaits</h2>
            <p className="text-lg text-muted-foreground max-w-md mx-auto">
              Every great film starts with a script. Let's bring your vision to life.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button variant="aurora" size="xl" onClick={() => navigate('/script')} className="gap-3">
              <Wand2 className="w-5 h-5" />
              Write Your Script
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
    <div className="relative min-h-[calc(100vh-4rem)]">
      {/* Cinematic ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-muted/10" />
        <div className="absolute top-0 left-1/3 w-[800px] h-[400px] bg-primary/[0.03] rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[300px] bg-accent/[0.04] rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Cinematic Header */}
        <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 animate-fade-in">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="absolute inset-0 bg-primary/30 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
                <Video className="w-7 h-7 text-white" />
              </div>
              {status === 'completed' && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-success flex items-center justify-center border-2 border-background">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">{activeProject.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs gap-1">
                  <Timer className="w-3 h-3" />
                  {activeProject.target_duration_minutes || 8}s
                </Badge>
                <Badge variant="outline" className="text-xs">4K</Badge>
                <Badge variant="outline" className="text-xs">Cinematic</Badge>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/script')} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Script
            </Button>
            
            <Button
              variant="aurora"
              size="lg"
              onClick={generatePreview}
              disabled={isGenerating}
              className="gap-2 min-w-[160px] shadow-lg shadow-primary/20"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating...
                </>
              ) : status === 'completed' ? (
                <>
                  <RotateCcw className="w-4 h-4" />
                  Recreate
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate
                </>
              )}
            </Button>
            
            {status === 'completed' && (
              <Button variant="outline" size="lg" onClick={() => navigate('/export')} className="gap-2">
                <Download className="w-4 h-4" />
                Export
              </Button>
            )}
          </div>
        </header>

        {/* Production Pipeline - Cinematic Style */}
        <div className="card-clean p-5 animate-fade-in" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                <Layers className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Production Pipeline</h3>
                <p className="text-xs text-muted-foreground">AI-powered cinematic creation</p>
              </div>
            </div>
            {isGenerating && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-xs font-medium text-primary">Processing</span>
              </div>
            )}
          </div>
          
          <div className="relative">
            {/* Progress line */}
            <div className="absolute top-8 left-0 right-0 h-1 bg-muted/50 rounded-full mx-16">
              <div 
                className="h-full bg-gradient-to-r from-primary via-accent to-success rounded-full transition-all duration-700 ease-out"
                style={{ width: `${(currentStage / 4) * 100}%` }}
              />
            </div>
            
            <div className="relative grid grid-cols-4 gap-4">
              {PIPELINE_STAGES.map((stage, index) => {
                const isComplete = index < currentStage;
                const isCurrent = index === currentStage && isGenerating;
                const isPending = index > currentStage || (!isGenerating && status !== 'completed');
                
                return (
                  <div key={stage.id} className="relative flex flex-col items-center text-center">
                    <div className={cn(
                      "relative w-16 h-16 rounded-2xl flex items-center justify-center mb-3 transition-all duration-500",
                      isComplete && `bg-gradient-to-br ${stage.color} shadow-lg`,
                      isCurrent && `bg-gradient-to-br ${stage.color} shadow-xl animate-pulse`,
                      isPending && "bg-muted/50 border border-border/50"
                    )}>
                      {isComplete ? (
                        <CheckCircle2 className="w-7 h-7 text-white" />
                      ) : (
                        <stage.icon className={cn(
                          "w-7 h-7 transition-colors",
                          isCurrent ? "text-white" : "text-muted-foreground"
                        )} />
                      )}
                      
                      {/* Glow effect for current stage */}
                      {isCurrent && (
                        <div className={cn(
                          "absolute inset-0 rounded-2xl blur-xl opacity-50",
                          `bg-gradient-to-br ${stage.color}`
                        )} />
                      )}
                    </div>
                    
                    <span className={cn(
                      "text-sm font-semibold transition-colors",
                      isComplete && "text-success",
                      isCurrent && "text-primary",
                      isPending && "text-muted-foreground"
                    )}>
                      {stage.label}
                    </span>
                    
                    {isCurrent && (
                      <span className="text-[10px] text-muted-foreground mt-1 animate-pulse">
                        In progress...
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main Theater - Video Preview */}
        <div 
          className="relative rounded-3xl overflow-hidden bg-black shadow-2xl shadow-black/40 animate-fade-in group"
          style={{ animationDelay: '200ms' }}
          onMouseEnter={() => setShowControls(true)}
          onMouseLeave={() => status === 'completed' && isPlaying && setShowControls(false)}
        >
          {/* Film grain overlay */}
          <div className="absolute inset-0 pointer-events-none z-20 opacity-[0.03] mix-blend-overlay noise-overlay" />
          
          <div className="aspect-[21/9] relative">
            
            {/* COMPLETED STATE */}
            {status === 'completed' && (
              <div className="absolute inset-0">
                {activeProject.video_clips && activeProject.video_clips.length > 0 ? (
                  <VideoPlaylist 
                    clips={activeProject.video_clips} 
                    onPlayStateChange={setIsPlaying}
                  />
                ) : activeProject.video_url ? (
                  <>
                    <video
                      ref={videoRef}
                      src={activeProject.video_url}
                      className="w-full h-full object-cover"
                      controls={false}
                      muted={isMuted}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onTimeUpdate={(e) => {
                        const video = e.target as HTMLVideoElement;
                        setProgress((video.currentTime / video.duration) * 100);
                      }}
                    />
                    {/* Cinematic play button */}
                    {!isPlaying && (
                      <button
                        onClick={togglePlayback}
                        className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm group/play cursor-pointer"
                      >
                        <div className="relative">
                          {/* Ripple effect */}
                          <div className="absolute inset-0 rounded-full bg-white/10 scale-100 group-hover/play:scale-150 opacity-100 group-hover/play:opacity-0 transition-all duration-700" />
                          <div className="absolute inset-0 rounded-full bg-white/5 scale-125 group-hover/play:scale-175 transition-transform duration-500" />
                          
                          <div className="relative w-28 h-28 rounded-full bg-white/95 flex items-center justify-center group-hover/play:scale-110 transition-all duration-300 shadow-2xl">
                            <Play className="w-12 h-12 text-foreground ml-1.5" fill="currentColor" />
                          </div>
                        </div>
                        
                        {/* "Press to play" hint */}
                        <div className="absolute bottom-20 left-1/2 -translate-x-1/2">
                          <span className="text-white/60 text-sm font-medium tracking-wide">Press to play</span>
                        </div>
                      </button>
                    )}
                  </>
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-success/20 to-emerald-600/10 flex items-center justify-center">
                    <div className="text-center space-y-4">
                      <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-10 h-10 text-success" />
                      </div>
                      <p className="text-xl font-semibold text-white">Your masterpiece is ready!</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* GENERATING STATE - Immersive Experience */}
            {(status === 'generating' || status === 'rendering' || isGenerating) && (
              <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden">
                {/* Dynamic particle field */}
                <div className="absolute inset-0">
                  {[...Array(40)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute w-1 h-1 rounded-full bg-primary/40"
                      style={{
                        left: `${Math.random() * 100}%`,
                        top: `${Math.random() * 100}%`,
                        animation: `float ${3 + Math.random() * 4}s ease-in-out infinite`,
                        animationDelay: `${Math.random() * 2}s`,
                      }}
                    />
                  ))}
                </div>
                
                {/* Central animation */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative">
                    {/* Outer spinning rings */}
                    <div className="absolute inset-0 w-48 h-48 -m-24 rounded-full border border-primary/20 animate-spin" style={{ animationDuration: '12s' }} />
                    <div className="absolute inset-0 w-40 h-40 -m-20 rounded-full border border-accent/30 animate-spin" style={{ animationDuration: '8s', animationDirection: 'reverse' }} />
                    <div className="absolute inset-0 w-32 h-32 -m-16 rounded-full border-2 border-primary/40 animate-spin" style={{ animationDuration: '4s' }} />
                    
                    {/* Glowing orb */}
                    <div className="absolute inset-0 w-24 h-24 -m-12 rounded-full bg-gradient-to-br from-primary/40 to-accent/40 blur-2xl animate-pulse" />
                    
                    {/* Center icon */}
                    <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-2xl shadow-primary/40">
                      {generationProgress.step === 'voice' && <Mic className="w-10 h-10 text-white" />}
                      {generationProgress.step === 'video' && <Camera className="w-10 h-10 text-white" />}
                      {generationProgress.step === 'polling' && <Clapperboard className="w-10 h-10 text-white" />}
                      {(!generationProgress.step || generationProgress.step === 'idle') && <Sparkles className="w-10 h-10 text-white" />}
                    </div>
                  </div>
                </div>
                
                {/* Status info overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-8">
                  <div className="max-w-xl mx-auto text-center space-y-5">
                    {/* Dynamic status message */}
                    <div className="space-y-2">
                      <h3 className="text-2xl font-display font-bold text-white">
                        {currentMessages[messageIndex]}
                      </h3>
                      {generationProgress.currentClip && generationProgress.totalClips && (
                        <p className="text-white/50 text-sm">
                          Scene {generationProgress.currentClip} of {generationProgress.totalClips}
                        </p>
                      )}
                    </div>
                    
                    {/* Progress visualization */}
                    <div className="space-y-2">
                      <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary via-accent to-primary rounded-full transition-all duration-500 ease-out"
                          style={{ 
                            width: `${generationProgress.percent}%`,
                            backgroundSize: '200% 100%',
                            animation: 'shimmer 2s linear infinite'
                          }}
                        />
                        {/* Glow effect */}
                        <div 
                          className="absolute inset-y-0 left-0 bg-primary/50 blur-sm rounded-full"
                          style={{ width: `${generationProgress.percent}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-white/40 font-mono">
                        <span className="text-primary font-semibold">{generationProgress.percent}%</span>
                        <span>
                          {generationProgress.estimatedSecondsRemaining !== null 
                            ? `~${Math.ceil(generationProgress.estimatedSecondsRemaining / 60)} min remaining`
                            : 'Calculating...'}
                        </span>
                      </div>
                    </div>
                    
                    {/* Fun fact card */}
                    <div className="inline-flex items-center gap-3 px-5 py-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                      <span className="text-2xl">{CINEMA_FACTS[factIndex].icon}</span>
                      <p className="text-sm text-white/70 text-left">
                        {CINEMA_FACTS[factIndex].text}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* IDLE STATE - Call to action */}
            {status === 'idle' && !isGenerating && (
              <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
                {/* Subtle grid pattern */}
                <div className="absolute inset-0 opacity-[0.03]" style={{
                  backgroundImage: 'linear-gradient(hsl(262 83% 58%) 1px, transparent 1px), linear-gradient(90deg, hsl(262 83% 58%) 1px, transparent 1px)',
                  backgroundSize: '50px 50px'
                }} />
                
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center space-y-8 max-w-lg px-8">
                    <div className="relative inline-block">
                      <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-muted/30 to-muted/10 border border-white/10 flex items-center justify-center">
                        <Clapperboard className="w-12 h-12 text-white/30" />
                      </div>
                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                        <Badge className="bg-primary text-white border-0 shadow-lg shadow-primary/30">
                          Ready
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <h3 className="text-3xl font-display font-bold text-white">
                        Ready for Action 🎬
                      </h3>
                      <p className="text-white/50 text-lg">
                        Your script is loaded. Hit generate and watch the magic unfold.
                      </p>
                    </div>
                    
                    <Button
                      variant="aurora"
                      size="xl"
                      onClick={generatePreview}
                      className="gap-3 shadow-2xl shadow-primary/30"
                    >
                      <Sparkles className="w-5 h-5" />
                      Start Generation
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Video Controls - Floating Cinema Style */}
          {status === 'completed' && (
            <div className={cn(
              "absolute bottom-0 left-0 right-0 p-6 transition-all duration-500",
              "bg-gradient-to-t from-black via-black/80 to-transparent",
              showControls ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            )}>
              {/* Progress scrubber */}
              <div className="mb-4">
                <Slider
                  value={[progress]}
                  onValueChange={(val) => {
                    setProgress(val[0]);
                    if (videoRef.current) {
                      videoRef.current.currentTime = (val[0] / 100) * videoRef.current.duration;
                    }
                  }}
                  max={100}
                  step={0.1}
                  className="w-full cursor-pointer"
                />
              </div>
              
              <div className="flex items-center justify-between">
                {/* Left controls */}
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-11 w-11 text-white hover:bg-white/20 rounded-xl"
                    onClick={togglePlayback}
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-white/60 hover:text-white hover:bg-white/20 rounded-lg">
                    <SkipBack className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-white/60 hover:text-white hover:bg-white/20 rounded-lg">
                    <SkipForward className="w-4 h-4" />
                  </Button>
                  
                  <div className="flex items-center gap-2 ml-3 pl-3 border-l border-white/20">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-9 w-9 text-white/60 hover:text-white hover:bg-white/20 rounded-lg"
                      onClick={() => setIsMuted(!isMuted)}
                    >
                      {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </Button>
                    <Slider 
                      value={[isMuted ? 0 : volume]} 
                      onValueChange={(val) => {
                        setVolume(val[0]);
                        if (videoRef.current) videoRef.current.volume = val[0] / 100;
                      }} 
                      max={100} 
                      className="w-24" 
                    />
                  </div>
                </div>
                
                {/* Time display */}
                <div className="flex items-center gap-2 text-sm font-mono text-white/60">
                  <span className="text-white">00:{String(Math.floor(progress * 0.6)).padStart(2, '0')}</span>
                  <span>/</span>
                  <span>01:00</span>
                </div>
                
                {/* Right controls */}
                <div className="flex items-center gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={cn(
                      "h-9 w-9 hover:bg-white/20 rounded-lg transition-colors",
                      isLiked ? "text-red-500" : "text-white/60 hover:text-white"
                    )}
                    onClick={() => setIsLiked(!isLiked)}
                  >
                    <Heart className="w-4 h-4" fill={isLiked ? "currentColor" : "none"} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-white/60 hover:text-white hover:bg-white/20 rounded-lg">
                    <Share2 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-white/60 hover:text-white hover:bg-white/20 rounded-lg">
                    <Settings2 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-white/60 hover:text-white hover:bg-white/20 rounded-lg">
                    <Maximize2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Grid - Script & Stats */}
        <div className="grid lg:grid-cols-3 gap-5 animate-fade-in" style={{ animationDelay: '300ms' }}>
          {/* Script Preview Card */}
          <div className="lg:col-span-2 card-clean p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                  <Film className="w-4 h-4 text-amber-600" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">Script Preview</h3>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/script')} className="gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                Edit Script
                <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
            <div className="bg-muted/30 rounded-xl p-4 max-h-32 overflow-y-auto">
              <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed font-mono">
                {activeProject.script_content?.slice(0, 600)}
                {(activeProject.script_content?.length || 0) > 600 && '...'}
              </p>
            </div>
          </div>
          
          {/* Stats Card */}
          <div className="card-clean p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                <Zap className="w-4 h-4 text-primary" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Quick Stats</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Duration</span>
                <span className="text-sm font-semibold">{activeProject.target_duration_minutes || 8}s</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Quality</span>
                <Badge variant="secondary" className="text-xs">4K Ultra HD</Badge>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge 
                  className={cn(
                    "text-xs",
                    status === 'completed' && "bg-success/10 text-success border-success/20",
                    status === 'idle' && "bg-muted text-muted-foreground",
                    (status === 'generating' || status === 'rendering') && "bg-primary/10 text-primary border-primary/20"
                  )}
                >
                  {status === 'completed' ? 'Complete' : status === 'idle' ? 'Draft' : 'Processing'}
                </Badge>
              </div>
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Credits</span>
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
