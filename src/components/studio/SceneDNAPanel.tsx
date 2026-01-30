import { memo, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Palette, Eye, Focus, Layers, Sparkles } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface SceneAnchor {
  dominantColors?: string[];
  lighting?: string;
  environment?: string;
  cameraStyle?: string;
  objectAnchors?: string[];
  styleSignature?: string;
}

interface SceneDNAPanelProps {
  masterAnchor?: SceneAnchor | null;
  isEstablished?: boolean;
  className?: string;
}

// Demo data to show when no real data is available
const DEMO_ANCHOR: SceneAnchor = {
  dominantColors: ['#1a365d', '#2d3748', '#4a5568', '#718096'],
  lighting: 'Golden hour, soft directional',
  environment: 'Urban exterior, dusk',
  cameraStyle: 'Cinematic wide angle',
  objectAnchors: ['Street lamps', 'Concrete walls', 'Distant skyline'],
  styleSignature: 'Neo-noir aesthetic'
};

export const SceneDNAPanel = memo(forwardRef<HTMLDivElement, SceneDNAPanelProps>(function SceneDNAPanel({ masterAnchor, isEstablished = false, className }, ref) {
  // Use demo data if no real data is available
  const activeAnchor = masterAnchor || DEMO_ANCHOR;
  const isDemo = !masterAnchor;

  const dnaElements = [
    { 
      icon: Palette, 
      label: 'Palette', 
      value: activeAnchor.dominantColors?.slice(0, 4) || [],
      type: 'colors' as const
    },
    { 
      icon: Eye, 
      label: 'Lighting', 
      value: activeAnchor.lighting || 'Natural ambient',
      type: 'text' as const
    },
    { 
      icon: Focus, 
      label: 'Camera', 
      value: activeAnchor.cameraStyle || 'Standard framing',
      type: 'text' as const
    },
    { 
      icon: Layers, 
      label: 'Environment', 
      value: activeAnchor.environment || 'Interior scene',
      type: 'text' as const
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "p-4 rounded-xl bg-white/[0.03] border border-white/10",
        className
      )}
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-violet-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Scene DNA</h3>
          <p className="text-xs text-white/50">Master visual anchor for consistency</p>
        </div>
        {isEstablished ? (
          <span className="ml-auto px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
            Locked
          </span>
        ) : isDemo ? (
          <span className="ml-auto px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs">
            Demo
          </span>
        ) : (
          <span className="ml-auto px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 text-xs">
            Active
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {dnaElements.map((element) => (
          <TooltipProvider key={element.label}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors cursor-default">
                    <div className="flex items-center gap-2 mb-2">
                      <element.icon className="w-3.5 h-3.5 text-white/40" />
                      <span className="text-xs text-white/50">{element.label}</span>
                    </div>
                    {element.type === 'colors' && Array.isArray(element.value) ? (
                      <div className="flex gap-1">
                        {element.value.length > 0 ? (
                          element.value.map((color, i) => (
                            <div
                              key={i}
                              className="w-5 h-5 rounded-md border border-white/10"
                              style={{ backgroundColor: color }}
                            />
                          ))
                        ) : (
                          <span className="text-xs text-white/30">No colors</span>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-white/70 truncate">
                        {typeof element.value === 'string' ? element.value : 'N/A'}
                      </p>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="text-xs">
                    {element.type === 'colors' && Array.isArray(element.value)
                      ? `Colors: ${element.value.join(', ') || 'Not extracted'}`
                      : element.value}
                  </p>
                </TooltipContent>
              </Tooltip>
          </TooltipProvider>
        ))}
      </div>

      {activeAnchor.objectAnchors && activeAnchor.objectAnchors.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <p className="text-xs text-white/40 mb-2">Scene Anchors</p>
          <div className="flex flex-wrap gap-1.5">
            {activeAnchor.objectAnchors.slice(0, 5).map((anchor, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded-md bg-white/5 text-xs text-white/60"
              >
                {anchor}
              </span>
            ))}
            {activeAnchor.objectAnchors.length > 5 && (
              <span className="px-2 py-0.5 text-xs text-white/40">
                +{activeAnchor.objectAnchors.length - 5} more
              </span>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}));
