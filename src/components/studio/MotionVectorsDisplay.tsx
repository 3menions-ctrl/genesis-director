import { motion } from 'framer-motion';
import { Move, ArrowRight, Camera, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface MotionVectors {
  subjectVelocity?: { x: number; y: number; magnitude: number };
  cameraMovement?: { type: string; direction: string; speed: number };
  motionBlur?: number;
  dominantDirection?: string;
  // Alternative format from database
  endVelocity?: string;
  endDirection?: string;
  cameraMomentum?: string;
}

interface MotionVectorsDisplayProps {
  motionVectors?: MotionVectors | null;
  shotIndex?: number;
  className?: string;
}

export function MotionVectorsDisplay({ motionVectors, shotIndex, className }: MotionVectorsDisplayProps) {
  if (!motionVectors) return null;

  const velocity = motionVectors.subjectVelocity;
  const camera = motionVectors.cameraMovement;
  
  // Check for alternative database format
  const hasAltFormat = motionVectors.endVelocity || motionVectors.endDirection || motionVectors.cameraMomentum;
  
  const getDirectionArrow = (direction?: string) => {
    const arrows: Record<string, string> = {
      'left': '←',
      'right': '→',
      'up': '↑',
      'down': '↓',
      'forward': '↗',
      'backward': '↙',
      'static': '•',
      'continuous': '→',
      'lateral': '↔',
      'steady': '―',
      'slow': '·',
    };
    return arrows[direction?.toLowerCase() || ''] || '→';
  };

  const getSpeedLabel = (speed?: number | string) => {
    if (typeof speed === 'string') return speed;
    if (!speed) return 'Static';
    if (speed < 0.3) return 'Slow';
    if (speed < 0.6) return 'Medium';
    return 'Fast';
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/10",
        className
      )}
    >
      <TooltipProvider>
        {/* Alternative format: endVelocity/endDirection */}
        {hasAltFormat && (
          <>
            {motionVectors.endVelocity && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5">
                    <Move className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-xs text-white/70">
                      {getDirectionArrow(motionVectors.endDirection)}
                    </span>
                    <span className="text-xs text-white/50 capitalize">
                      {motionVectors.endVelocity}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">End velocity: {motionVectors.endVelocity}</p>
                  <p className="text-xs text-muted-foreground">Direction: {motionVectors.endDirection || 'Unknown'}</p>
                </TooltipContent>
              </Tooltip>
            )}
            
            {motionVectors.cameraMomentum && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs text-white/70 capitalize">
                      {motionVectors.cameraMomentum}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Camera momentum: {motionVectors.cameraMomentum}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </>
        )}

        {/* Subject Motion - original format */}
        {!hasAltFormat && velocity && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5">
                <Move className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-xs text-white/70">
                  {getDirectionArrow(motionVectors.dominantDirection)}
                </span>
                <span className="text-xs text-white/50">
                  {velocity.magnitude?.toFixed(1) || '0'}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Subject velocity: {velocity.magnitude?.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Direction: {motionVectors.dominantDirection || 'Unknown'}</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Camera Movement - original format */}
        {!hasAltFormat && camera && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs text-white/70 capitalize">
                  {camera.type || 'Static'}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Camera: {camera.type}</p>
              <p className="text-xs text-muted-foreground">Direction: {camera.direction}</p>
              <p className="text-xs text-muted-foreground">Speed: {getSpeedLabel(camera.speed)}</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Motion Blur */}
        {motionVectors.motionBlur !== undefined && motionVectors.motionBlur > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-xs text-white/50">
                  {(motionVectors.motionBlur * 100).toFixed(0)}%
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Motion blur intensity: {(motionVectors.motionBlur * 100).toFixed(0)}%</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Shot indicator */}
        {shotIndex !== undefined && (
          <span className="ml-auto text-xs text-white/30">
            Shot {shotIndex + 1}
          </span>
        )}
      </TooltipProvider>
    </motion.div>
  );
}
