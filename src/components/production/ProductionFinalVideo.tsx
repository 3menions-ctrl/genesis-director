import { motion } from 'framer-motion';
import { CheckCircle2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ManifestVideoPlayer } from '@/components/studio/ManifestVideoPlayer';

interface ProductionFinalVideoProps {
  videoUrl: string;
}

export function ProductionFinalVideo({ videoUrl }: ProductionFinalVideoProps) {
  const isManifest = videoUrl.endsWith('.json');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
    >
      <div className="bg-zinc-800/50 rounded-lg border border-emerald-500/30 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700/30">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-zinc-100">Video Ready</h3>
              <p className="text-[11px] text-zinc-500">Assembled and ready to download</p>
            </div>
          </div>
          <div className="flex gap-2">
            {!isManifest && (
              <Button 
                size="sm" 
                className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white" 
                asChild
              >
                <a href={videoUrl} download>
                  <Download className="w-3.5 h-3.5" />
                  Download
                </a>
              </Button>
            )}
          </div>
        </div>
        
        {/* Video Player */}
        <div className="aspect-video bg-black">
          {isManifest ? (
            <ManifestVideoPlayer manifestUrl={videoUrl} className="w-full h-full" />
          ) : (
            <video 
              src={videoUrl} 
              controls 
              className="w-full h-full object-contain" 
              poster=""
            />
          )}
        </div>
      </div>
    </motion.div>
  );
}
