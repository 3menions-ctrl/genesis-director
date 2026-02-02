import { memo, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Download, Play, Sparkles, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ManifestVideoPlayer } from '@/components/studio/ManifestVideoPlayer';
import { cn } from '@/lib/utils';

interface ProductionFinalVideoProps {
  videoUrl: string;
}

export const ProductionFinalVideo = memo(forwardRef<HTMLDivElement, ProductionFinalVideoProps>(function ProductionFinalVideo({ videoUrl }, ref) {
  const isManifest = videoUrl.endsWith('.json');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative group"
    >
      {/* Success glow effect */}
      <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-emerald-500/20 rounded-3xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity duration-500" />
      
      <div className={cn(
        "relative overflow-hidden rounded-2xl",
        "bg-gradient-to-br from-emerald-500/10 via-zinc-900/90 to-teal-500/10",
        "border border-emerald-500/30",
        "backdrop-blur-xl"
      )}>
        {/* Header */}
        <div className="relative flex items-center justify-between px-5 py-4 border-b border-emerald-500/20">
          {/* Background shine */}
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-teal-500/5" />
          
          <div className="relative flex items-center gap-4">
            <motion.div 
              className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </motion.div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-white">Video Complete</h3>
                <Sparkles className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-xs text-emerald-400/60 mt-0.5">Assembled and ready for export</p>
            </div>
          </div>
          
          <div className="relative flex gap-2">
            {!isManifest && (
              <>
                <Button 
                  size="sm"
                  variant="ghost"
                  className="h-9 px-3 text-xs gap-2 text-zinc-400 hover:text-white hover:bg-white/[0.06] rounded-lg"
                  onClick={() => window.open(videoUrl, '_blank')}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open
                </Button>
                <Button 
                  size="sm" 
                  className={cn(
                    "h-9 px-4 text-xs gap-2 rounded-lg",
                    "bg-gradient-to-r from-emerald-500 to-teal-500",
                    "hover:from-emerald-400 hover:to-teal-400",
                    "text-white font-semibold",
                    "shadow-lg shadow-emerald-500/25",
                    "transition-all duration-200"
                  )}
                  asChild
                >
                  <a href={videoUrl} download>
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </a>
                </Button>
              </>
            )}
          </div>
        </div>
        
        {/* Video Player */}
        <div className="relative aspect-video bg-black/50">
          {isManifest ? (
            <ManifestVideoPlayer manifestUrl={videoUrl} className="w-full h-full" />
          ) : (
            <video 
              src={videoUrl} 
              controls 
              className="w-full h-full object-contain" 
              poster=""
              muted
              playsInline
              crossOrigin="anonymous"
              preload="auto"
            />
          )}
        </div>
        
        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 inset-x-0 h-20 bg-gradient-to-t from-zinc-900 to-transparent pointer-events-none" />
      </div>
    </motion.div>
  );
}));
