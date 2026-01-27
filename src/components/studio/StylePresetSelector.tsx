import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STYLE_PRESETS, VideoStylePreset } from '@/types/video-modes';

interface StylePresetSelectorProps {
  selectedStyle: VideoStylePreset | null;
  onStyleChange: (style: VideoStylePreset) => void;
  className?: string;
}

export function StylePresetSelector({
  selectedStyle,
  onStyleChange,
  className
}: StylePresetSelectorProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <Palette className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-medium text-foreground">Style Preset</h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        {STYLE_PRESETS.map((style, index) => {
          const isSelected = selectedStyle === style.id;

          return (
            <motion.button
              key={style.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.03 }}
              onClick={() => onStyleChange(style.id)}
              className={cn(
                "relative p-3 rounded-xl border transition-all text-center group",
                isSelected
                  ? "bg-primary/10 border-primary/30 shadow-md"
                  : "bg-card/50 border-border hover:bg-card hover:border-border/80"
              )}
            >
              {/* Selected indicator */}
              {isSelected && (
                <motion.div
                  layoutId="selected-style"
                  className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center"
                >
                  <Check className="w-2.5 h-2.5 text-primary-foreground" />
                </motion.div>
              )}

              {/* Style preview gradient based on style */}
              <div className={cn(
                "w-full aspect-video rounded-lg mb-2 overflow-hidden",
                getStyleGradient(style.id)
              )} />

              <p className={cn(
                "text-xs font-medium",
                isSelected ? "text-foreground" : "text-foreground/80"
              )}>
                {style.name}
              </p>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function getStyleGradient(style: VideoStylePreset): string {
  const gradients: Record<VideoStylePreset, string> = {
    'anime': 'bg-gradient-to-br from-pink-400 via-purple-400 to-blue-400',
    '3d-animation': 'bg-gradient-to-br from-amber-300 via-orange-400 to-red-400',
    'cyberpunk': 'bg-gradient-to-br from-cyan-500 via-purple-500 to-pink-500',
    'oil-painting': 'bg-gradient-to-br from-amber-600 via-orange-500 to-yellow-400',
    'watercolor': 'bg-gradient-to-br from-blue-300 via-teal-300 to-green-300',
    'claymation': 'bg-gradient-to-br from-amber-400 via-orange-300 to-rose-300',
    'noir': 'bg-gradient-to-br from-gray-900 via-gray-700 to-gray-500',
    'vintage-film': 'bg-gradient-to-br from-amber-200 via-orange-200 to-yellow-100',
    'comic-book': 'bg-gradient-to-br from-red-500 via-yellow-400 to-blue-500',
    'fantasy': 'bg-gradient-to-br from-violet-400 via-purple-500 to-fuchsia-400',
  };
  
  return gradients[style] || 'bg-gradient-to-br from-gray-400 to-gray-600';
}
