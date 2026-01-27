import { motion } from 'framer-motion';
import { Check, Palette, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STYLE_PRESETS, VideoStylePreset } from '@/types/video-modes';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface StylePresetSelectorProps {
  selectedStyle: VideoStylePreset | null;
  onStyleChange: (style: VideoStylePreset) => void;
  className?: string;
  compact?: boolean;
}

export function StylePresetSelector({
  selectedStyle,
  onStyleChange,
  className,
  compact = false
}: StylePresetSelectorProps) {
  if (compact) {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center gap-2">
          <Palette className="w-3.5 h-3.5 text-white/40" />
          <span className="text-xs font-medium text-white/60">Style</span>
        </div>
        <ScrollArea className="w-full">
          <div className="flex gap-2 pb-2">
            {STYLE_PRESETS.map((style, index) => {
              const isSelected = selectedStyle === style.id;
              return (
                <TooltipProvider key={style.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <motion.button
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.02 }}
                        onClick={() => onStyleChange(style.id)}
                        className={cn(
                          "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap",
                          isSelected
                            ? "bg-white text-black"
                            : "bg-white/[0.06] text-white/70 hover:bg-white/[0.1] hover:text-white"
                        )}
                      >
                        {style.name}
                      </motion.button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[200px]">
                      <p className="font-medium">{style.name}</p>
                      <p className="text-xs text-muted-foreground">{style.description}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center gap-2">
        <Palette className="w-4 h-4 text-white/50" />
        <h3 className="text-sm font-medium text-white/80">Cinema-Grade Style Presets</h3>
        <Sparkles className="w-3.5 h-3.5 text-amber-400/60" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
        {STYLE_PRESETS.map((style, index) => {
          const isSelected = selectedStyle === style.id;

          return (
            <TooltipProvider key={style.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.button
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.02 }}
                    onClick={() => onStyleChange(style.id)}
                    className={cn(
                      "relative p-2.5 rounded-xl border transition-all text-center group overflow-hidden",
                      isSelected
                        ? "bg-white/[0.08] border-white/20 shadow-lg shadow-white/5"
                        : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.1]"
                    )}
                  >
                    {/* Selected indicator */}
                    {isSelected && (
                      <motion.div
                        layoutId="selected-style"
                        className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-white flex items-center justify-center z-10"
                      >
                        <Check className="w-2.5 h-2.5 text-black" />
                      </motion.div>
                    )}

                    {/* Style preview with color palette */}
                    <div className={cn(
                      "w-full aspect-[16/9] rounded-lg mb-2 overflow-hidden relative",
                      getStyleGradient(style.id)
                    )}>
                      {/* Overlay pattern for visual interest */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                      {/* Color chips from palette */}
                      {style.colorPalette && (
                        <div className="absolute bottom-1 left-1 right-1 flex gap-0.5">
                          {style.colorPalette.slice(0, 5).map((color, i) => (
                            <div
                              key={i}
                              className="flex-1 h-1 rounded-full"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    <p className={cn(
                      "text-[10px] font-medium truncate",
                      isSelected ? "text-white" : "text-white/70"
                    )}>
                      {style.name}
                    </p>
                  </motion.button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[280px] p-3">
                  <p className="font-semibold text-sm">{style.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{style.description}</p>
                  <div className="flex gap-1 mt-2">
                    {style.colorPalette?.map((color, i) => (
                      <div
                        key={i}
                        className="w-4 h-4 rounded-full border border-white/10"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
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
    'hyperreal': 'bg-gradient-to-br from-slate-600 via-blue-600 to-teal-500',
    'surrealist': 'bg-gradient-to-br from-amber-300 via-sky-400 to-amber-200',
    'ukiyo-e': 'bg-gradient-to-br from-blue-800 via-red-700 to-slate-200',
    'art-deco': 'bg-gradient-to-br from-yellow-500 via-black to-teal-600',
    'gothic': 'bg-gradient-to-br from-gray-900 via-purple-900 to-red-900',
    'solarpunk': 'bg-gradient-to-br from-green-400 via-yellow-400 to-sky-400',
    'baroque': 'bg-gradient-to-br from-red-900 via-amber-600 to-yellow-700',
    'synthwave': 'bg-gradient-to-br from-pink-500 via-purple-600 to-cyan-500',
    'impressionist': 'bg-gradient-to-br from-sky-300 via-green-300 to-pink-300',
    'cel-shaded': 'bg-gradient-to-br from-orange-500 via-cyan-500 to-pink-500',
  };
  
  return gradients[style] || 'bg-gradient-to-br from-gray-400 to-gray-600';
}
