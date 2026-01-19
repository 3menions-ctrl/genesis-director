import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Film, 
  Download, 
  Upload, 
  Play, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  MonitorPlay,
  Cpu,
  HardDrive
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useBrowserStitcher } from '@/hooks/useBrowserStitcher';
import { StitchProgress } from '@/utils/browserVideoStitcher';

interface BrowserStitcherPanelProps {
  projectId: string;
  clipUrls: string[];
  audioUrl?: string;
  onComplete?: (videoUrl: string) => void;
  className?: string;
}

const phaseIcons: Record<StitchProgress['phase'], React.ReactNode> = {
  loading: <HardDrive className="w-4 h-4 animate-pulse" />,
  processing: <Cpu className="w-4 h-4 animate-spin" />,
  encoding: <Film className="w-4 h-4 animate-pulse" />,
  finalizing: <Loader2 className="w-4 h-4 animate-spin" />,
  complete: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
  error: <AlertCircle className="w-4 h-4 text-red-400" />,
};

const phaseColors: Record<StitchProgress['phase'], string> = {
  loading: 'text-blue-400',
  processing: 'text-amber-400',
  encoding: 'text-purple-400',
  finalizing: 'text-cyan-400',
  complete: 'text-emerald-400',
  error: 'text-red-400',
};

export function BrowserStitcherPanel({
  projectId,
  clipUrls,
  audioUrl,
  onComplete,
  className = '',
}: BrowserStitcherPanelProps) {
  const [showPreview, setShowPreview] = useState(false);
  
  const {
    isStitching,
    progress,
    stitchedBlob,
    stitchedUrl,
    startStitching,
    downloadVideo,
    uploadVideo,
    reset,
  } = useBrowserStitcher({
    projectId,
    onComplete,
  });

  const handleStartStitch = () => {
    startStitching(clipUrls, { audioUrl });
  };

  const formatTime = (seconds?: number) => {
    if (!seconds || seconds <= 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '--';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Card className={`bg-zinc-900/50 border-zinc-800 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
              <MonitorPlay className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <CardTitle className="text-base">Browser Stitcher</CardTitle>
              <CardDescription className="text-xs">
                Combine clips locally in your browser
              </CardDescription>
            </div>
          </div>
          {stitchedBlob && (
            <div className="text-xs text-zinc-500">
              {formatSize(stitchedBlob.size)}
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Clip count */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-400">Clips to stitch:</span>
          <span className="font-medium text-zinc-200">{clipUrls.length} clips</span>
        </div>

        {/* Progress Section */}
        <AnimatePresence mode="wait">
          {progress && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              {/* Phase indicator */}
              <div className="flex items-center gap-2">
                <span className={phaseColors[progress.phase]}>
                  {phaseIcons[progress.phase]}
                </span>
                <span className={`text-sm font-medium ${phaseColors[progress.phase]}`}>
                  {progress.phase.charAt(0).toUpperCase() + progress.phase.slice(1)}
                </span>
                {progress.estimatedTimeRemaining && progress.phase === 'encoding' && (
                  <span className="text-xs text-zinc-500 ml-auto">
                    ~{formatTime(progress.estimatedTimeRemaining)} remaining
                  </span>
                )}
              </div>

              {/* Progress bar */}
              <div className="space-y-1">
                <Progress 
                  value={progress.percentComplete} 
                  className="h-2 bg-zinc-800"
                />
                <div className="flex justify-between text-xs text-zinc-500">
                  <span>{progress.message}</span>
                  <span>{progress.percentComplete}%</span>
                </div>
              </div>

              {/* Clip progress */}
              {progress.phase === 'encoding' && (
                <div className="flex gap-1">
                  {Array.from({ length: clipUrls.length }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        i < progress.currentClip
                          ? 'bg-emerald-500'
                          : i === progress.currentClip - 1
                          ? 'bg-purple-500 animate-pulse'
                          : 'bg-zinc-700'
                      }`}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Preview */}
        {stitchedUrl && showPreview && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="rounded-lg overflow-hidden bg-black"
          >
            <video
              src={stitchedUrl}
              controls
              className="w-full aspect-video"
            />
          </motion.div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {!stitchedUrl ? (
            <Button
              onClick={handleStartStitch}
              disabled={isStitching || clipUrls.length === 0}
              className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500"
            >
              {isStitching ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Stitching...
                </>
              ) : (
                <>
                  <Film className="w-4 h-4 mr-2" />
                  Start Browser Stitch
                </>
              )}
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
                className="flex-1"
              >
                <Play className="w-4 h-4 mr-2" />
                {showPreview ? 'Hide' : 'Preview'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadVideo}
                className="flex-1"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
              <Button
                size="sm"
                onClick={uploadVideo}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500"
              >
                <Upload className="w-4 h-4 mr-2" />
                Save
              </Button>
            </>
          )}
        </div>

        {/* Reset button */}
        {stitchedUrl && (
          <Button
            variant="ghost"
            size="sm"
            onClick={reset}
            className="w-full text-zinc-500 hover:text-zinc-300"
          >
            Start Over
          </Button>
        )}

        {/* Info text */}
        {!isStitching && !stitchedUrl && (
          <p className="text-xs text-zinc-500 text-center">
            Stitches video locally using your browser. No server required.
            <br />
            Expect ~30-90 seconds processing time.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
