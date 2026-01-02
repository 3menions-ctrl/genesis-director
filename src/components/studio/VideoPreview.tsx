import { useState } from 'react';
import { Play, Pause, Maximize2, Volume2, VolumeX, RotateCcw } from 'lucide-react';
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
  const [progress, setProgress] = useState(0);

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
      idle: { variant: 'idle', label: 'Ready' },
      generating: { variant: 'generating', label: 'Generating AI Assets...' },
      rendering: { variant: 'rendering', label: 'Rendering 4K...' },
      completed: { variant: 'completed', label: 'Complete' },
    };
    return variants[status];
  };

  const statusInfo = getStatusBadge();

  return (
    <div className="glass-panel overflow-hidden">
      {/* 16:9 Video Container */}
      <div className="relative aspect-video bg-gradient-to-br from-muted/50 to-background overflow-hidden">
        {/* Status Overlay */}
        {status !== 'completed' && status !== 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10">
            <div className="text-center space-y-4">
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
              </div>
              <div className="space-y-1">
                <p className="text-foreground font-medium">{statusInfo.label}</p>
                <p className="text-muted-foreground text-sm">This may take a few minutes...</p>
              </div>
            </div>
          </div>
        )}

        {/* Placeholder Grid Pattern */}
        {!videoUrl && (
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: `
                linear-gradient(to right, hsl(var(--primary) / 0.1) 1px, transparent 1px),
                linear-gradient(to bottom, hsl(var(--primary) / 0.1) 1px, transparent 1px)
              `,
              backgroundSize: '40px 40px'
            }} />
          </div>
        )}

        {/* Center Play Button */}
        {status === 'completed' && (
          <button
            onClick={handlePlayPause}
            className={cn(
              "absolute inset-0 flex items-center justify-center group",
              "transition-all duration-300"
            )}
          >
            <div className={cn(
              "w-20 h-20 rounded-full flex items-center justify-center",
              "bg-primary/90 backdrop-blur-sm",
              "group-hover:scale-110 group-hover:bg-primary transition-all duration-300",
              "shadow-lg shadow-primary/30"
            )}>
              {isPlaying ? (
                <Pause className="w-8 h-8 text-primary-foreground" />
              ) : (
                <Play className="w-8 h-8 text-primary-foreground ml-1" />
              )}
            </div>
          </button>
        )}

        {/* Corner Status Badge */}
        <div className="absolute top-4 left-4 z-20">
          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
        </div>

        {/* Resolution Badge */}
        <div className="absolute top-4 right-4 z-20">
          <Badge variant="outline" className="font-mono text-xs">4K UHD</Badge>
        </div>

        {/* Idle State Content */}
        {status === 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 mx-auto rounded-full bg-muted/50 flex items-center justify-center">
                <Play className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-sm">Add a script to begin production</p>
            </div>
          </div>
        )}
      </div>

      {/* Video Controls */}
      <div className="p-4 border-t border-border/50 space-y-3">
        {/* Progress Bar */}
        <div className="space-y-2">
          <Slider
            value={[progress]}
            onValueChange={(val) => setProgress(val[0])}
            max={100}
            step={0.1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground font-mono">
            <span>00:00</span>
            <span>03:24</span>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePlayPause}
              disabled={status !== 'completed'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="icon" disabled={status !== 'completed'}>
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMuted(!isMuted)}
              disabled={status !== 'completed'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </Button>
          </div>

          <Button variant="ghost" size="icon" disabled={status !== 'completed'}>
            <Maximize2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
