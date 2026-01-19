import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Film, Download, Loader2, Play, X, Sparkles, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { generateTrailer, downloadTrailer, TrailerProgress } from '@/utils/trailerGenerator';
import { toast } from 'sonner';

export function TrailerGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<TrailerProgress | null>(null);
  const [trailerBlob, setTrailerBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setTrailerBlob(null);
    setPreviewUrl(null);

    toast.info('Generating trailer...', {
      description: 'This may take 30-60 seconds',
    });

    try {
      const blob = await generateTrailer({
        snippetDuration: 2,
        partsPerVideo: 2,
        onProgress: setProgress,
      });

      setTrailerBlob(blob);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setShowPreview(true);

      toast.success('Trailer generated!', {
        description: 'Click download to save your trailer',
      });
    } catch (error) {
      console.error('Trailer generation failed:', error);
      toast.error('Failed to generate trailer', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const handleDownload = useCallback(() => {
    if (trailerBlob) {
      const filename = `community-trailer-${Date.now()}.webm`;
      downloadTrailer(trailerBlob, filename);
      toast.success('Download started!');
    }
  }, [trailerBlob]);

  const closePreview = useCallback(() => {
    setShowPreview(false);
  }, []);

  return (
    <>
      <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
              <Film className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Trailer Generator</h3>
              <p className="text-sm text-white/60">
                Create a highlight reel from community videos
              </p>
            </div>
          </div>

          {isGenerating && progress ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-white/70">
                {progress.phase === 'music' ? (
                  <Music className="w-4 h-4 animate-pulse text-primary" />
                ) : (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                <span>{progress.message}</span>
              </div>
              <Progress value={progress.percentComplete} className="h-2" />
              <p className="text-xs text-white/50 text-right">
                {progress.percentComplete}% complete
              </p>
            </div>
          ) : trailerBlob ? (
            <div className="flex gap-2">
              <Button
                onClick={() => setShowPreview(true)}
                variant="outline"
                className="flex-1 gap-2"
              >
                <Play className="w-4 h-4" />
                Preview
              </Button>
              <Button
                onClick={handleDownload}
                className="flex-1 gap-2 bg-primary hover:bg-primary/90"
              >
                <Download className="w-4 h-4" />
                Download
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            >
              <Sparkles className="w-4 h-4" />
              Generate Trailer
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Preview Modal */}
      <AnimatePresence>
        {showPreview && previewUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
            onClick={closePreview}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-4xl bg-zinc-900 rounded-2xl overflow-hidden border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="aspect-video bg-black">
                <video
                  src={previewUrl}
                  controls
                  autoPlay
                  className="w-full h-full"
                />
              </div>

              <div className="p-4 flex items-center justify-between">
                <h3 className="font-semibold text-white">Community Trailer Preview</h3>
                <div className="flex gap-2">
                  <Button
                    onClick={handleDownload}
                    className="gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download Trailer
                  </Button>
                </div>
              </div>

              <button
                onClick={closePreview}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/70"
              >
                <X className="w-5 h-5" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
