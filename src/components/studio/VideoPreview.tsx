import { useState } from 'react';
import { Play, Pause, Maximize2, Volume2, VolumeX, RotateCcw, Settings, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { ProjectStatus } from '@/types/studio';
import { cn } from '@/lib/utils';

interface VideoPreviewProps {
  status: ProjectStatus;
  videoUrl?: string;
  thumbnailUrl?: string;
  onPlay?: () => void;
  onPause?: () => void;
}

export function VideoPreview({ status, videoUrl, thumbnailUrl, onPlay, onPause }: VideoPreviewProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(35);

  const handlePlayPause = () => {
    if (isPlaying) {
      onPause?.();
    } else {
      onPlay?.();
    }
    setIsPlaying(!isPlaying);
  };

  const getStatusBadge = () => {
    const variants: Record<ProjectStatus, { variant: 'idle' | 'generating' | 'rendering' | 'completed'; label: string }> = {
      idle: { variant: 'idle', label: 'Ready to Create' },
      generating: { variant: 'generating', label: 'Generating AI Assets...' },
      rendering: { variant: 'rendering', label: 'Rendering 4K...' },
      completed: { variant: 'completed', label: 'Complete' },
    };
    return variants[status];
  };

  const statusInfo = getStatusBadge();

  return (
    <div className="glass-panel overflow-hidden group">
      {/* 16:9 Video Container */}
      <div className="relative aspect-video bg-gradient-to-br from-muted/30 via-background to-muted/50 overflow-hidden">
        {/* Cinematic Preview Image for completed/idle states */}
        {(status === 'completed' || status === 'idle') && (
          <div className="absolute inset-0">
            {/* Jungle Studio Background */}
            <div 
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `linear-gradient(to bottom, transparent 60%, hsl(var(--background) / 0.9)),
                  url('https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1920&q=80')`,
              }}
            />
            
            {/* AI Presenter Silhouette */}
            {status === 'completed' && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[300px] h-[400px]">
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[200px] h-[300px] bg-gradient-to-t from-muted/80 to-transparent rounded-t-full blur-sm" />
              </div>
            )}

            {/* Animated particles for jungle feel */}
            <div className="absolute inset-0 overflow-hidden">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-1 h-1 bg-primary/30 rounded-full animate-float"
                  style={{
                    left: `${20 + i * 15}%`,
                    top: `${30 + (i % 3) * 20}%`,
                    animationDelay: `${i * 0.5}s`,
                    animationDuration: `${4 + i}s`,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Status Overlay - Generating/Rendering */}
        {(status === 'generating' || status === 'rendering') && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/90 backdrop-blur-md z-10">
            <div className="text-center space-y-6">
              {/* Animated loader */}
              <div className="relative w-24 h-24 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-primary/10" />
                <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                <div className="absolute inset-2 rounded-full border-4 border-primary/20 border-b-transparent animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Layers className="w-8 h-8 text-primary animate-pulse" />
                </div>
              </div>
              
              {/* Status text */}
              <div className="space-y-2">
                <p className="text-lg font-semibold text-foreground">{statusInfo.label}</p>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  {status === 'generating' 
                    ? 'Creating AI voice, presenter, and background...'
                    : 'Compositing layers and encoding in 4K quality...'}
                </p>
              </div>

              {/* Progress indicator */}
              <div className="w-48 mx-auto space-y-2">
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full animate-shimmer"
                    style={{ 
                      width: status === 'generating' ? '45%' : '78%',
                      backgroundSize: '200% 100%'
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground font-mono">
                  {status === 'generating' ? '3 of 4 assets' : '78% complete'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Idle State Content */}
        {status === 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-muted/50 border border-border/50 flex items-center justify-center group-hover:border-primary/30 transition-colors">
                <Play className="w-8 h-8 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="text-foreground font-medium">Ready to Create</p>
                <p className="text-muted-foreground text-sm">Add a script to begin AI production</p>
              </div>
            </div>
          </div>
        )}

        {/* Center Play Button - Completed */}
        {status === 'completed' && (
          <button
            onClick={handlePlayPause}
            className={cn(
              "absolute inset-0 flex items-center justify-center group/play",
              "transition-all duration-300"
            )}
          >
            <div className={cn(
              "relative w-20 h-20 rounded-2xl flex items-center justify-center",
              "bg-primary/90 backdrop-blur-sm",
              "group-hover/play:scale-110 group-hover/play:bg-primary transition-all duration-300",
              "shadow-2xl shadow-primary/40"
            )}>
              {/* Glow effect */}
              <div className="absolute inset-0 rounded-2xl bg-primary blur-xl opacity-50 group-hover/play:opacity-75 transition-opacity" />
              
              <div className="relative">
                {isPlaying ? (
                  <Pause className="w-8 h-8 text-primary-foreground" />
                ) : (
                  <Play className="w-8 h-8 text-primary-foreground ml-1" />
                )}
              </div>
            </div>
          </button>
        )}

        {/* Corner Status Badge */}
        <div className="absolute top-4 left-4 z-20">
          <Badge variant={statusInfo.variant} className="shadow-lg backdrop-blur-sm">
            {statusInfo.label}
          </Badge>
        </div>

        {/* Resolution & Settings Badges */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs backdrop-blur-sm border-border/50 bg-background/50">
            4K UHD
          </Badge>
          <Button variant="ghost" size="icon" className="h-7 w-7 bg-background/50 backdrop-blur-sm hover:bg-background/80">
            <Settings className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Duration overlay - bottom left */}
        {status === 'completed' && (
          <div className="absolute bottom-4 left-4 z-20">
            <Badge variant="outline" className="font-mono text-xs backdrop-blur-sm border-border/50 bg-background/50">
              02:04
            </Badge>
          </div>
        )}
      </div>

      {/* Video Controls */}
      <div className="p-4 border-t border-border/30 space-y-3 bg-card/50">
        {/* Progress Bar */}
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

        {/* Control Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={handlePlayPause}
              disabled={status !== 'completed'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" disabled={status !== 'completed'}>
              <RotateCcw className="w-4 h-4" />
            </Button>
            
            <div className="flex items-center gap-2 ml-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => setIsMuted(!isMuted)}
                disabled={status !== 'completed'}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </Button>
              <Slider
                value={[isMuted ? 0 : 75]}
                max={100}
                className="w-20"
                disabled={status !== 'completed'}
              />
            </div>
          </div>

          <Button variant="ghost" size="icon" className="h-9 w-9" disabled={status !== 'completed'}>
            <Maximize2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
