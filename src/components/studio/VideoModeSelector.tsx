import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Wand2, Image, User, Palette, Dices, Film, 
  ChevronRight, Sparkles, Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { VIDEO_MODES, VideoGenerationMode } from '@/types/video-modes';

const ICON_MAP = {
  Wand2,
  Image,
  User,
  Palette,
  Dices,
  Film,
};

interface VideoModeSelectorProps {
  selectedMode: VideoGenerationMode;
  onModeChange: (mode: VideoGenerationMode) => void;
  className?: string;
}

export function VideoModeSelector({ 
  selectedMode, 
  onModeChange,
  className 
}: VideoModeSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Video Mode</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {isExpanded ? 'Collapse' : 'See all'}
          <ChevronRight className={cn(
            "w-3 h-3 ml-1 transition-transform",
            isExpanded && "rotate-90"
          )} />
        </Button>
      </div>

      {/* Mode Grid */}
      <div className={cn(
        "grid gap-2 transition-all",
        isExpanded ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-3"
      )}>
        {VIDEO_MODES.filter(mode => isExpanded || mode.popular).map((mode, index) => {
          const Icon = ICON_MAP[mode.icon as keyof typeof ICON_MAP] || Wand2;
          const isSelected = selectedMode === mode.id;

          return (
            <motion.button
              key={mode.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => onModeChange(mode.id)}
              className={cn(
                "relative p-3 rounded-xl border transition-all text-left group",
                isSelected 
                  ? "bg-primary/10 border-primary/30 shadow-lg shadow-primary/10" 
                  : "bg-card/50 border-border hover:bg-card hover:border-border/80"
              )}
            >
              {/* Selected indicator */}
              {isSelected && (
                <motion.div 
                  layoutId="selected-mode"
                  className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center"
                >
                  <Check className="w-2.5 h-2.5 text-primary-foreground" />
                </motion.div>
              )}

              {/* Icon */}
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center mb-2 transition-colors",
                isSelected 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted text-muted-foreground group-hover:bg-muted/80"
              )}>
                <Icon className="w-4 h-4" />
              </div>

              {/* Text */}
              <p className={cn(
                "text-xs font-medium truncate",
                isSelected ? "text-foreground" : "text-foreground/80"
              )}>
                {mode.name}
              </p>
              
              {isExpanded && (
                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                  {mode.description}
                </p>
              )}

              {/* Popular badge */}
              {mode.popular && !isExpanded && (
                <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-500 flex items-center justify-center">
                  <Sparkles className="w-2 h-2 text-white" />
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Current mode description */}
      <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {VIDEO_MODES.find(m => m.id === selectedMode)?.name}:
          </span>{' '}
          {VIDEO_MODES.find(m => m.id === selectedMode)?.description}
        </p>
      </div>
    </div>
  );
}
