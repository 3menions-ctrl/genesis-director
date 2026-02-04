/**
 * Merge Download Dialog
 * 
 * Dialog that allows users to download multi-clip projects as a single merged video.
 * Uses browser-based FFmpeg.wasm for video concatenation.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Download, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Film,
  Music,
  Layers
} from 'lucide-react';
import { 
  mergeVideoClips, 
  downloadBlob, 
  cleanupFFmpeg,
  canMergeVideos,
  type MergeProgress 
} from '@/lib/video/browserVideoMerger';
import { cn } from '@/lib/utils';

interface MergeDownloadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  clipUrls: string[];
  masterAudioUrl?: string | null;
}

export function MergeDownloadDialog({
  open,
  onOpenChange,
  projectName,
  clipUrls,
  masterAudioUrl,
}: MergeDownloadDialogProps) {
  const [mergeProgress, setMergeProgress] = useState<MergeProgress | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canMerge, setCanMerge] = useState(true);

  // Check if merging is supported on this device
  useEffect(() => {
    setCanMerge(canMergeVideos());
  }, []);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setMergeProgress(null);
      setIsMerging(false);
      setError(null);
    }
  }, [open]);

  // Cleanup FFmpeg on unmount
  useEffect(() => {
    return () => {
      cleanupFFmpeg();
    };
  }, []);

  const handleMergeAndDownload = useCallback(async () => {
    if (clipUrls.length === 0) {
      setError('No clips available to merge');
      return;
    }

    setIsMerging(true);
    setError(null);

    const sanitizedName = projectName
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase()
      .slice(0, 50);

    try {
      const result = await mergeVideoClips({
        clipUrls,
        outputFilename: `${sanitizedName}-complete.mp4`,
        masterAudioUrl,
        onProgress: setMergeProgress,
      });

      setIsMerging(false);

      if (result.success && result.blob) {
        downloadBlob(result.blob, result.filename || `${sanitizedName}-complete.mp4`);
        
        // Close dialog after short delay to show success state
        setTimeout(() => {
          onOpenChange(false);
        }, 1500);
      } else {
        setError(result.error || 'Failed to download video');
      }
    } catch (err) {
      console.error('[MergeDownload] Error:', err);
      setIsMerging(false);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    }
  }, [clipUrls, projectName, masterAudioUrl, onOpenChange]);

  // Download individual clips (for iOS/unsupported browsers)
  const handleDownloadIndividual = useCallback(async (index: number) => {
    const url = clipUrls[index];
    const sanitizedName = projectName
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase()
      .slice(0, 50);

    try {
      const response = await fetch(url);
      const blob = await response.blob();
      downloadBlob(blob, `${sanitizedName}-clip${index + 1}.mp4`);
    } catch (err) {
      setError(`Failed to download clip ${index + 1}`);
    }
  }, [clipUrls, projectName]);

  const getProgressIcon = () => {
    if (!mergeProgress) return <Film className="w-5 h-5" />;
    
    switch (mergeProgress.stage) {
      case 'loading':
        return <Loader2 className="w-5 h-5 animate-spin" />;
      case 'downloading':
        return <Download className="w-5 h-5 animate-pulse" />;
      case 'processing':
        return <Layers className="w-5 h-5 animate-pulse" />;
      case 'encoding':
        return <Film className="w-5 h-5 animate-pulse" />;
      case 'complete':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Film className="w-5 h-5" />;
    }
  };

  const getStageLabel = () => {
    if (!mergeProgress) return 'Ready to merge';
    
    switch (mergeProgress.stage) {
      case 'loading':
        return 'Loading video processor...';
      case 'downloading':
        return mergeProgress.message;
      case 'processing':
        return 'Preparing video segments...';
      case 'encoding':
        return mergeProgress.message;
      case 'complete':
        return 'Download starting...';
      case 'error':
        return 'Merge failed';
      default:
        return mergeProgress.message;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-950 border-zinc-800 max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Film className="w-5 h-5 text-violet-400" />
            Download Complete Video
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Merge {clipUrls.length} clips into a single video file
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Project Info */}
          <div className="bg-zinc-900/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">Project</span>
              <span className="text-white font-medium truncate max-w-[200px]">
                {projectName}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">Clips</span>
              <span className="text-white">{clipUrls.length}</span>
            </div>
            {masterAudioUrl && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">Audio</span>
                <span className="text-green-400 flex items-center gap-1">
                  <Music className="w-3 h-3" />
                  Master track included
                </span>
              </div>
            )}
          </div>

          {/* Progress Section */}
          {isMerging && mergeProgress && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {getProgressIcon()}
                <span className="text-sm text-zinc-300">{getStageLabel()}</span>
              </div>
              <Progress 
                value={mergeProgress.progress} 
                className="h-2 bg-zinc-800"
              />
              {mergeProgress.currentClip && mergeProgress.totalClips && (
                <p className="text-xs text-zinc-500 text-center">
                  Clip {mergeProgress.currentClip} of {mergeProgress.totalClips}
                </p>
              )}
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Success State */}
          {mergeProgress?.stage === 'complete' && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
              <p className="text-sm text-green-300">Video merged successfully! Download starting...</p>
            </div>
          )}

          {/* Info Notice - iOS/Unsupported Browser Warning */}
          {!isMerging && !error && mergeProgress?.stage !== 'complete' && !canMerge && clipUrls.length > 1 && (
            <div className="space-y-3">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                <p className="text-xs text-amber-300">
                  Video merging is not supported on this device. 
                  You can download each clip individually below.
                </p>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {clipUrls.map((_, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadIndividual(index)}
                    className="w-full justify-start gap-2 text-zinc-300 border-zinc-700 hover:bg-zinc-800"
                  >
                    <Download className="w-3 h-3" />
                    Download Clip {index + 1}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Standard Info Notice */}
          {!isMerging && !error && mergeProgress?.stage !== 'complete' && canMerge && (
            <div className="bg-violet-500/10 border border-violet-500/20 rounded-lg p-3">
              <p className="text-xs text-violet-300">
                This will download and merge all clips in your browser. 
                Processing time depends on the number and size of clips.
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isMerging}
            className="text-zinc-400 hover:text-white"
          >
            Cancel
          </Button>
          {canMerge && (
            <Button
              onClick={handleMergeAndDownload}
              disabled={isMerging || clipUrls.length === 0 || mergeProgress?.stage === 'complete'}
              className={cn(
                "bg-gradient-to-r from-violet-600 to-purple-600",
                "hover:from-violet-500 hover:to-purple-500",
                "text-white gap-2"
              )}
            >
              {isMerging ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Merging...
                </>
              ) : mergeProgress?.stage === 'complete' ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Complete
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Merge & Download
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
