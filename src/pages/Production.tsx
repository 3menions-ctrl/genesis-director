import { useNavigate } from 'react-router-dom';
import { 
  Play, Pause, Maximize2, Volume2, VolumeX, RotateCcw, 
  ArrowLeft, ArrowRight, AlertCircle, Sparkles, Zap,
  SkipBack, SkipForward, Settings2, Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { useStudio } from '@/contexts/StudioContext';
import { SettingsSidebar } from '@/components/studio/SettingsSidebar';
import { AssetLayersPanel } from '@/components/studio/AssetLayersPanel';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export default function Production() {
  const navigate = useNavigate();
  const { activeProject, layers, settings, updateSettings, generatePreview, isGenerating } = useStudio();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(35);
  const [volume, setVolume] = useState(75);

  const status = activeProject?.status || 'idle';

  const getStatusInfo = () => {
    const variants = {
      idle: { label: 'Ready', description: 'Configure settings and generate your video', icon: Zap },
      generating: { label: 'Generating...', description: 'Creating AI assets', icon: Sparkles },
      rendering: { label: 'Rendering', description: 'Compositing in 4K', icon: Sparkles },
      completed: { label: 'Complete', description: 'Ready for export', icon: Download },
    };
    return variants[status];
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  if (!activeProject) {
    return (
      <div className="relative flex flex-col items-center justify-center min-h-[80vh] p-6">
        {/* Ambient background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl orb-1" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/10 rounded-full blur-3xl orb-2" />
        </div>
        
        <div className="relative z-10 text-center space-y-6">
          <div className="w-24 h-24 mx-auto rounded-3xl bg-gradient-to-br from-muted/50 to-muted/30 border border-border/50 flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground">No Project Selected</h2>
            <p className="text-muted-foreground max-w-md">Select or create a project to begin production</p>
          </div>
          <Button variant="glow" size="lg" onClick={() => navigate('/projects')}>
            <ArrowLeft className="w-4 h-4" />
            Go to Projects
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-[calc(100vh-3.5rem)]">
      {/* Ambient Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-primary/[0.03] rounded-full blur-3xl orb-1" />
        <div className="absolute top-1/2 -left-40 w-[500px] h-[500px] bg-accent/[0.05] rounded-full blur-3xl orb-2" />
        <div className="absolute -bottom-40 right-1/3 w-[400px] h-[400px] bg-warning/[0.02] rounded-full blur-3xl orb-3" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex flex-col overflow-hidden">
        {/* Streamlined Header */}
        <header className="px-6 py-4 border-b border-border/20 backdrop-blur-sm bg-background/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/script')} className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Script
              </Button>
              <div className="h-6 w-px bg-border/50" />
              <div>
                <h1 className="text-lg font-semibold text-foreground">Production Studio</h1>
                <p className="text-xs text-muted-foreground">{statusInfo.description}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Badge 
                variant={status as 'idle' | 'generating' | 'rendering' | 'completed'} 
                className="gap-1.5 px-3 py-1"
              >
                <StatusIcon className="w-3 h-3" />
                {statusInfo.label}
              </Badge>
              
              <Button
                variant="glow"
                onClick={generatePreview}
                disabled={!activeProject.script_content?.trim() || isGenerating}
                className="gap-2"
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate
                  </>
                )}
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => navigate('/export')}
                disabled={status !== 'completed'}
                className="gap-2"
              >
                Export
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </header>

        {/* Video Preview Area */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
            
            {/* Cinematic Video Container */}
            <div className="video-container">
              {/* Aspect Ratio Container */}
              <div className="relative aspect-video bg-gradient-to-br from-muted/20 via-background to-muted/30">
                
                {/* Grid Overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(hsl(var(--border)/0.03)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border)/0.03)_1px,transparent_1px)] bg-[size:40px_40px]" />
                
                {/* Completed State */}
                {status === 'completed' && (
                  <div className="absolute inset-0">
                    <div 
                      className="absolute inset-0 bg-cover bg-center"
                      style={{
                        backgroundImage: `linear-gradient(to bottom, transparent 50%, hsl(var(--background) / 0.95)),
                          url('https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1920&q=80')`,
                      }}
                    />
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="absolute inset-0 flex items-center justify-center group cursor-pointer"
                    >
                      <div className={cn(
                        "relative flex items-center justify-center",
                        "w-20 h-20 rounded-full",
                        "bg-primary/90 backdrop-blur-md",
                        "group-hover:scale-110 transition-transform duration-300",
                      )}>
                        <div className="absolute inset-0 rounded-full bg-primary blur-2xl opacity-40 group-hover:opacity-60 transition-opacity" />
                        <div className="absolute inset-0 rounded-full pulse-ring border-2 border-primary/50" />
                        {isPlaying ? (
                          <Pause className="relative w-8 h-8 text-primary-foreground" />
                        ) : (
                          <Play className="relative w-8 h-8 text-primary-foreground ml-1" />
                        )}
                      </div>
                    </button>
                  </div>
                )}

                {/* Generating/Rendering State */}
                {(status === 'generating' || status === 'rendering') && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-xl">
                    <div className="text-center space-y-8">
                      {/* Animated Loader */}
                      <div className="relative w-32 h-32 mx-auto">
                        <div className="absolute inset-0 rounded-full border-2 border-border/30" />
                        <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                        <div className="absolute inset-3 rounded-full border-2 border-primary/40 border-b-transparent animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
                        <div className="absolute inset-6 rounded-full border-2 border-primary/20 border-t-transparent animate-spin" style={{ animationDuration: '2s' }} />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                            <Sparkles className="w-6 h-6 text-primary" />
                          </div>
                        </div>
                      </div>
                      
                      {/* Status Text */}
                      <div className="space-y-3">
                        <p className="text-xl font-semibold text-foreground">{statusInfo.label}</p>
                        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                          {status === 'generating' 
                            ? 'Creating voice, presenter & background...'
                            : 'Compositing layers in 4K quality...'}
                        </p>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="w-72 mx-auto space-y-3">
                        <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full progress-glow transition-all duration-500"
                            style={{ width: status === 'generating' ? '45%' : '78%' }}
                          />
                        </div>
                        <div className="flex justify-between text-xs font-mono text-muted-foreground">
                          <span>{status === 'generating' ? 'Step 3 of 4' : '78%'}</span>
                          <span>~2 min remaining</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Idle State */}
                {status === 'idle' && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center space-y-6">
                      <div className="relative w-24 h-24 mx-auto">
                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-muted/40 to-muted/20 border border-border/30" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Play className="w-10 h-10 text-muted-foreground/70" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-foreground font-medium">Ready to Create</p>
                        <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                          Configure your settings and click Generate
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Corner Badges */}
                <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                  <Badge 
                    variant="outline" 
                    className="font-mono text-[10px] backdrop-blur-md border-border/50 bg-background/60"
                  >
                    16:9
                  </Badge>
                </div>
                <div className="absolute top-4 right-4 z-20">
                  <Badge 
                    variant="outline" 
                    className="font-mono text-[10px] backdrop-blur-md border-border/50 bg-background/60"
                  >
                    4K UHD
                  </Badge>
                </div>
              </div>

              {/* Video Controls */}
              <div className="relative px-4 py-3 border-t border-border/20 bg-card/60 backdrop-blur-sm">
                {/* Timeline */}
                <div className="mb-3">
                  <Slider
                    value={[progress]}
                    onValueChange={(val) => setProgress(val[0])}
                    max={100}
                    step={0.1}
                    className="w-full"
                    disabled={status !== 'completed'}
                  />
                </div>

                {/* Controls Row */}
                <div className="flex items-center justify-between">
                  {/* Left Controls */}
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 control-btn" 
                      disabled={status !== 'completed'}
                    >
                      <SkipBack className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-9 w-9 control-btn" 
                      disabled={status !== 'completed'} 
                      onClick={() => setIsPlaying(!isPlaying)}
                    >
                      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 control-btn" 
                      disabled={status !== 'completed'}
                    >
                      <SkipForward className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 control-btn" 
                      disabled={status !== 'completed'}
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                    
                    {/* Volume Control */}
                    <div className="flex items-center gap-2 ml-2 pl-2 border-l border-border/30">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 control-btn" 
                        disabled={status !== 'completed'} 
                        onClick={() => setIsMuted(!isMuted)}
                      >
                        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      </Button>
                      <Slider 
                        value={[isMuted ? 0 : volume]} 
                        onValueChange={(val) => setVolume(val[0])}
                        max={100} 
                        className="w-20" 
                        disabled={status !== 'completed'} 
                      />
                    </div>
                  </div>

                  {/* Center - Time Display */}
                  <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                    <span>00:42</span>
                    <span className="text-border">/</span>
                    <span>02:04</span>
                  </div>

                  {/* Right Controls */}
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 control-btn" 
                      disabled={status !== 'completed'}
                    >
                      <Settings2 className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 control-btn" 
                      disabled={status !== 'completed'}
                    >
                      <Maximize2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Asset Layers */}
            <AssetLayersPanel layers={activeProject.id === '1' ? layers : []} />
          </div>
        </div>
      </div>

      {/* Settings Sidebar */}
      <aside className="hidden xl:flex w-80 border-l border-border/20 bg-sidebar/30 backdrop-blur-sm overflow-y-auto">
        <SettingsSidebar settings={settings} onSettingsChange={updateSettings} />
      </aside>
    </div>
  );
}