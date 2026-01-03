import { useNavigate } from 'react-router-dom';
import { 
  Play, Pause, Maximize2, Volume2, VolumeX, RotateCcw, 
  ArrowLeft, ArrowRight, AlertCircle, Sparkles, Zap,
  SkipBack, SkipForward, Settings2, Download, Layers
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { useStudio } from '@/contexts/StudioContext';
import { SettingsSidebar } from '@/components/studio/SettingsSidebar';
import { AssetLayersPanel } from '@/components/studio/AssetLayersPanel';
import { VideoGenerationPanel } from '@/components/studio/VideoGenerationPanel';
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
      idle: { label: 'Ready', description: 'Configure settings and generate', icon: Zap, color: 'muted' },
      generating: { label: 'Generating...', description: 'Creating AI assets', icon: Sparkles, color: 'primary' },
      rendering: { label: 'Rendering', description: 'Compositing in 4K', icon: Sparkles, color: 'warning' },
      completed: { label: 'Complete', description: 'Ready for export', icon: Download, color: 'success' },
    };
    return variants[status];
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  if (!activeProject) {
    return (
      <div className="relative flex flex-col items-center justify-center min-h-[80vh] p-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-accent/[0.06] rounded-full blur-[150px] orb-float-2" />
        </div>
        
        <div className="relative z-10 text-center space-y-8 animate-fade-in-up">
          <div className="w-24 h-24 mx-auto icon-box-accent p-6">
            <AlertCircle className="w-10 h-10 text-accent" />
          </div>
          <div className="space-y-3">
            <h2 className="text-3xl font-display text-foreground">No Project Selected</h2>
            <p className="text-lg text-muted-foreground">Select a project to begin production</p>
          </div>
          <Button variant="glow" size="xl" onClick={() => navigate('/projects')} className="gap-3">
            <ArrowLeft className="w-5 h-5" />
            Go to Projects
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-[calc(100vh-4rem)]">
      {/* Main Content */}
      <div className="relative z-10 flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="px-6 py-4 border-b border-border/10 bg-background/40 backdrop-blur-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-5">
              <Button variant="ghost" size="sm" onClick={() => navigate('/script')} className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Script
              </Button>
              <div className="w-px h-6 bg-border/30" />
              <div className="flex items-center gap-3">
                <div className="icon-box-accent p-2.5">
                  <Play className="w-4 h-4 text-accent" />
                </div>
                <div>
                  <h1 className="text-base font-display text-foreground">Production Studio</h1>
                  <p className="text-xs text-muted-foreground">{statusInfo.description}</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Badge variant={status as 'idle' | 'generating' | 'rendering' | 'completed'} className="gap-1.5 px-3 py-1.5">
                <StatusIcon className="w-3.5 h-3.5" />
                {statusInfo.label}
              </Badge>
              
              <Button
                variant="aurora"
                onClick={generatePreview}
                disabled={!activeProject.script_content?.trim() || isGenerating}
                className="gap-2"
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
          <div className="max-w-5xl mx-auto space-y-8 animate-fade-in-up">
            
            {/* Video Container */}
            <div className="video-container">
              <div className="relative aspect-video bg-gradient-to-br from-muted/10 via-background to-muted/20">
                {/* Subtle grid */}
                <div className="absolute inset-0 bg-[linear-gradient(hsl(var(--border)/0.02)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border)/0.02)_1px,transparent_1px)] bg-[size:40px_40px]" />
                
                {/* Completed State */}
                {status === 'completed' && (
                  <div className="absolute inset-0">
                    <div 
                      className="absolute inset-0 bg-cover bg-center"
                      style={{
                        backgroundImage: `linear-gradient(to bottom, transparent 40%, hsl(var(--background))),
                          url('https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1920&q=80')`,
                      }}
                    />
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="absolute inset-0 flex items-center justify-center group cursor-pointer"
                    >
                      <div className={cn(
                        "relative flex items-center justify-center",
                        "w-24 h-24 rounded-3xl",
                        "bg-gradient-to-r from-primary via-[hsl(280,85%,60%)] to-accent",
                        "group-hover:scale-110 transition-all duration-400",
                        "shadow-2xl"
                      )}>
                        <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-primary via-[hsl(280,85%,60%)] to-accent blur-2xl opacity-50 group-hover:opacity-80 transition-opacity" />
                        {isPlaying ? (
                          <Pause className="relative w-10 h-10 text-white" />
                        ) : (
                          <Play className="relative w-10 h-10 text-white ml-1" />
                        )}
                      </div>
                    </button>
                  </div>
                )}

                {/* Generating/Rendering State */}
                {(status === 'generating' || status === 'rendering') && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/90 backdrop-blur-2xl">
                    <div className="text-center space-y-10">
                      {/* Animated spinner */}
                      <div className="relative w-32 h-32 mx-auto">
                        <div className="absolute inset-0 rounded-full border-2 border-border/20" />
                        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
                        <div className="absolute inset-3 rounded-full border-2 border-transparent border-b-accent animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
                        <div className="absolute inset-6 rounded-full border-2 border-transparent border-t-[hsl(280,85%,60%)] animate-spin" style={{ animationDuration: '2s' }} />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="icon-box p-4 animate-breathe">
                            <Sparkles className="w-7 h-7 text-primary" />
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <p className="text-2xl font-display text-foreground">{statusInfo.label}</p>
                        <p className="text-muted-foreground max-w-xs mx-auto">
                          {status === 'generating' 
                            ? 'Creating voice, presenter & background...'
                            : 'Compositing layers in 4K quality...'}
                        </p>
                      </div>
                      
                      {/* Progress bar */}
                      <div className="w-72 mx-auto space-y-4">
                        <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-primary via-[hsl(280,85%,60%)] to-accent rounded-full transition-all duration-700"
                            style={{ width: status === 'generating' ? '45%' : '78%' }}
                          />
                        </div>
                        <div className="flex justify-between text-xs font-mono text-muted-foreground">
                          <span>{status === 'generating' ? 'Step 3/4' : '78%'}</span>
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
                      <div className="w-24 h-24 mx-auto rounded-3xl bg-muted/30 border border-border/20 flex items-center justify-center">
                        <Play className="w-10 h-10 text-muted-foreground" />
                      </div>
                      <div className="space-y-2">
                        <p className="text-xl font-semibold text-foreground">Ready to Create</p>
                        <p className="text-muted-foreground">Click Generate to start the magic</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Corner Badges */}
                <div className="absolute top-4 left-4 z-20">
                  <Badge variant="outline" className="font-mono text-[10px] backdrop-blur-xl bg-background/60">16:9</Badge>
                </div>
                <div className="absolute top-4 right-4 z-20">
                  <Badge variant="outline" className="font-mono text-[10px] backdrop-blur-xl bg-background/60">4K UHD</Badge>
                </div>
              </div>

              {/* Controls */}
              <div className="relative px-5 py-4 border-t border-border/10 bg-card/60 backdrop-blur-xl">
                <div className="mb-4">
                  <Slider
                    value={[progress]}
                    onValueChange={(val) => setProgress(val[0])}
                    max={100}
                    step={0.1}
                    className="w-full"
                    disabled={status !== 'completed'}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-9 w-9 control-btn" disabled={status !== 'completed'}>
                      <SkipBack className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-10 w-10 control-btn-primary" disabled={status !== 'completed'} onClick={() => setIsPlaying(!isPlaying)}>
                      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 control-btn" disabled={status !== 'completed'}>
                      <SkipForward className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 control-btn" disabled={status !== 'completed'}>
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                    
                    <div className="flex items-center gap-2 ml-3 pl-3 border-l border-border/20">
                      <Button variant="ghost" size="icon" className="h-9 w-9 control-btn" disabled={status !== 'completed'} onClick={() => setIsMuted(!isMuted)}>
                        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      </Button>
                      <Slider value={[isMuted ? 0 : volume]} onValueChange={(val) => setVolume(val[0])} max={100} className="w-24" disabled={status !== 'completed'} />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground">
                    <span>00:42</span>
                    <span className="text-border/60">/</span>
                    <span>02:04</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-9 w-9 control-btn" disabled={status !== 'completed'}>
                      <Settings2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 control-btn" disabled={status !== 'completed'}>
                      <Maximize2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Video Generation Panel */}
            <div className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
              <VideoGenerationPanel />
            </div>

            {/* Layers Panel */}
            <div className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
              <AssetLayersPanel layers={activeProject.id === '1' ? layers : []} />
            </div>
          </div>
        </div>
      </div>

      {/* Settings Sidebar */}
      <aside className="hidden xl:flex w-[340px] border-l border-border/10 bg-sidebar/50 backdrop-blur-2xl overflow-y-auto">
        <SettingsSidebar settings={settings} onSettingsChange={updateSettings} />
      </aside>
    </div>
  );
}