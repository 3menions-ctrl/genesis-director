import { useNavigate } from 'react-router-dom';
import { Play, Pause, Maximize2, Volume2, VolumeX, RotateCcw, ArrowLeft, ArrowRight, Layers, Settings, AlertCircle, Sparkles } from 'lucide-react';
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

  const status = activeProject?.status || 'idle';

  const getStatusInfo = () => {
    const variants = {
      idle: { label: 'Ready to Create', description: 'Configure settings and generate your video' },
      generating: { label: 'Generating AI Assets...', description: 'Creating voice, presenter, and background' },
      rendering: { label: 'Rendering 4K...', description: 'Compositing layers and encoding' },
      completed: { label: 'Complete', description: 'Your video is ready for export' },
    };
    return variants[status];
  };

  const statusInfo = getStatusInfo();

  if (!activeProject) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <div className="w-20 h-20 rounded-2xl bg-muted/30 border border-border/50 flex items-center justify-center mb-6">
          <AlertCircle className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">No project selected</h2>
        <p className="text-muted-foreground mb-6">Select a project to start production</p>
        <Button variant="glow" onClick={() => navigate('/projects')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go to Projects
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] animate-fade-in">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 lg:p-6 border-b border-border/30 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Production Studio</h1>
            <p className="text-sm text-muted-foreground">{statusInfo.description}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => navigate('/script')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Script
            </Button>
            <Button
              variant="glow"
              size="lg"
              onClick={generatePreview}
              disabled={!activeProject.script_content?.trim() || isGenerating}
            >
              {isGenerating ? (
                <>
                  <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  <span className="ml-2">Generating...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Generate Video
                </>
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigate('/export')}
              disabled={status !== 'completed'}
            >
              Export
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>

        {/* Video Preview Area */}
        <div className="flex-1 p-4 lg:p-6 overflow-y-auto">
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Video Preview */}
            <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm overflow-hidden">
              {/* 16:9 Video Container */}
              <div className="relative aspect-video bg-gradient-to-br from-muted/30 via-background to-muted/50 overflow-hidden">
                {/* Completed State - Preview Image */}
                {status === 'completed' && (
                  <div className="absolute inset-0">
                    <div 
                      className="absolute inset-0 bg-cover bg-center"
                      style={{
                        backgroundImage: `linear-gradient(to bottom, transparent 60%, hsl(var(--background) / 0.9)),
                          url('https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1920&q=80')`,
                      }}
                    />
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="absolute inset-0 flex items-center justify-center group"
                    >
                      <div className={cn(
                        "relative w-24 h-24 rounded-2xl flex items-center justify-center",
                        "bg-primary/90 backdrop-blur-sm",
                        "group-hover:scale-110 group-hover:bg-primary transition-all duration-300",
                        "shadow-2xl shadow-primary/40"
                      )}>
                        <div className="absolute inset-0 rounded-2xl bg-primary blur-xl opacity-50 group-hover:opacity-75 transition-opacity" />
                        <div className="relative">
                          {isPlaying ? (
                            <Pause className="w-10 h-10 text-primary-foreground" />
                          ) : (
                            <Play className="w-10 h-10 text-primary-foreground ml-1" />
                          )}
                        </div>
                      </div>
                    </button>
                  </div>
                )}

                {/* Generating/Rendering State */}
                {(status === 'generating' || status === 'rendering') && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/90 backdrop-blur-md">
                    <div className="text-center space-y-6">
                      <div className="relative w-28 h-28 mx-auto">
                        <div className="absolute inset-0 rounded-full border-4 border-primary/10" />
                        <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                        <div className="absolute inset-3 rounded-full border-4 border-primary/20 border-b-transparent animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Layers className="w-10 h-10 text-primary animate-pulse" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xl font-semibold text-foreground">{statusInfo.label}</p>
                        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                          {status === 'generating' 
                            ? 'Creating AI voice, presenter, and background...'
                            : 'Compositing layers and encoding in 4K quality...'}
                        </p>
                      </div>
                      <div className="w-64 mx-auto space-y-2">
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full animate-shimmer"
                            style={{ width: status === 'generating' ? '45%' : '78%', backgroundSize: '200% 100%' }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground font-mono">
                          {status === 'generating' ? '3 of 4 assets' : '78% complete'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Idle State */}
                {status === 'idle' && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center space-y-4">
                      <div className="w-20 h-20 mx-auto rounded-2xl bg-muted/50 border border-border/50 flex items-center justify-center">
                        <Play className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-foreground font-medium">Ready to Create</p>
                        <p className="text-muted-foreground text-sm">Click "Generate Video" to start production</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Corner Badges */}
                <div className="absolute top-4 left-4 z-20">
                  <Badge variant={status as any} className="shadow-lg backdrop-blur-sm">
                    {statusInfo.label}
                  </Badge>
                </div>
                <div className="absolute top-4 right-4 z-20">
                  <Badge variant="outline" className="font-mono text-xs backdrop-blur-sm border-border/50 bg-background/50">
                    4K UHD
                  </Badge>
                </div>
              </div>

              {/* Video Controls */}
              <div className="p-4 border-t border-border/30 space-y-3 bg-card/50">
                <div className="space-y-2">
                  <Slider
                    value={[progress]}
                    onValueChange={(val) => setProgress(val[0])}
                    max={100}
                    step={0.1}
                    className="w-full"
                    disabled={status !== 'completed'}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground font-mono">
                    <span>00:42</span>
                    <span>02:04</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-9 w-9" disabled={status !== 'completed'} onClick={() => setIsPlaying(!isPlaying)}>
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9" disabled={status !== 'completed'}>
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                    <div className="flex items-center gap-2 ml-2">
                      <Button variant="ghost" size="icon" className="h-9 w-9" disabled={status !== 'completed'} onClick={() => setIsMuted(!isMuted)}>
                        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      </Button>
                      <Slider value={[isMuted ? 0 : 75]} max={100} className="w-20" disabled={status !== 'completed'} />
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-9 w-9" disabled={status !== 'completed'}>
                    <Maximize2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Asset Layers */}
            <AssetLayersPanel layers={activeProject.id === '1' ? layers : []} />
          </div>
        </div>
      </div>

      {/* Settings Sidebar */}
      <aside className="hidden xl:block w-80 border-l border-border/30 bg-sidebar/50 backdrop-blur-sm overflow-y-auto">
        <SettingsSidebar settings={settings} onSettingsChange={updateSettings} />
      </aside>
    </div>
  );
}
