import { memo, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Download, Sparkles, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UniversalVideoPlayer } from '@/components/player';
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
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative group"
    >
      {/* Premium glow */}
      <div className="absolute -inset-2 rounded-3xl opacity-40 group-hover:opacity-60 transition-opacity duration-700 blur-2xl"
        style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.3), rgba(139,92,246,0.2), rgba(20,184,166,0.3))' }}
      />
      
      <div className={cn(
        "relative overflow-hidden rounded-2xl",
        "bg-white/[0.03] border border-white/[0.1]",
        "backdrop-blur-2xl shadow-2xl shadow-black/30"
      )}>
        {/* Gradient accent at top */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
        
        {/* Header */}
        <div className="relative flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/[0.03] via-transparent to-violet-500/[0.03]" />
          
          <div className="relative flex items-center gap-4">
            <motion.div 
              className={cn(
                "w-14 h-14 rounded-xl flex items-center justify-center border",
                "bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border-emerald-500/30",
                "shadow-lg shadow-emerald-500/10"
              )}
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <CheckCircle2 className="w-7 h-7 text-emerald-400" />
            </motion.div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-lg font-bold text-white">Video Complete</h3>
                <Sparkles className="w-4.5 h-4.5 text-emerald-400" />
              </div>
              <p className="text-xs text-emerald-400/50 mt-0.5 font-medium">Assembled and ready for export</p>
            </div>
          </div>
          
          <div className="relative flex gap-2.5">
            {!isManifest && (
              <>
                <Button 
                  size="sm"
                  variant="ghost"
                  className="h-10 px-4 text-xs gap-2 text-white/50 hover:text-white hover:bg-white/[0.06] rounded-xl font-semibold"
                  onClick={() => window.open(videoUrl, '_blank')}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open
                </Button>
                <Button 
                  size="sm" 
                  className={cn(
                    "h-10 px-5 text-xs gap-2 rounded-xl",
                    "bg-gradient-to-r from-emerald-500 to-teal-500",
                    "hover:from-emerald-400 hover:to-teal-400",
                    "text-white font-bold",
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
        <div className="relative aspect-video bg-black/80">
          <UniversalVideoPlayer
            source={isManifest ? { manifestUrl: videoUrl } : { urls: [videoUrl] }}
            mode="inline"
            controls={{ showDownload: !isManifest }}
            className="w-full h-full"
          />
        </div>
        
        {/* Bottom gradient */}
        <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
      </div>
    </motion.div>
  );
}));
