import { motion } from 'framer-motion';
import { CheckCircle2, Download } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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
      <Card className="glass-card ring-1 ring-success/30 overflow-hidden">
        <CardContent className="p-0">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-success" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Video Ready!</h3>
                <p className="text-xs text-muted-foreground">Your video has been assembled</p>
              </div>
            </div>
            <div className="flex gap-2">
              {!isManifest && (
                <Button size="sm" className="bg-success hover:bg-success/90 text-success-foreground gap-1.5" asChild>
                  <a href={videoUrl} download>
                    <Download className="w-4 h-4" />
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
        </CardContent>
      </Card>
    </motion.div>
  );
}