import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Loader2, ArrowLeftRight, ZoomIn, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PhotoEditCanvasProps {
  originalUrl: string | null;
  editedUrl: string | null;
  isProcessing: boolean;
  onDownload: () => void;
}

export function PhotoEditCanvas({ originalUrl, editedUrl, isProcessing, onDownload }: PhotoEditCanvasProps) {
  const [showOriginal, setShowOriginal] = useState(false);
  const displayUrl = showOriginal ? originalUrl : (editedUrl || originalUrl);

  if (!originalUrl) {
    return (
      <div className="aspect-[4/3] bg-white/[0.02] border border-white/[0.06] rounded-xl flex items-center justify-center">
        <p className="text-white/20 text-sm">Select a photo to edit</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/3] bg-black/40 border border-white/[0.06] rounded-xl overflow-hidden group">
        <AnimatePresence mode="wait">
          <motion.img
            key={displayUrl}
            src={displayUrl || ''}
            alt="Photo"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full h-full object-contain"
          />
        </AnimatePresence>

        {/* Processing overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-10">
            <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mb-3" />
            <p className="text-white font-medium">Processing edit...</p>
            <p className="text-white/40 text-sm mt-1">This may take a few seconds</p>
          </div>
        )}

        {/* Compare toggle */}
        {editedUrl && !isProcessing && (
          <button
            onMouseDown={() => setShowOriginal(true)}
            onMouseUp={() => setShowOriginal(false)}
            onMouseLeave={() => setShowOriginal(false)}
            onTouchStart={() => setShowOriginal(true)}
            onTouchEnd={() => setShowOriginal(false)}
            className="absolute bottom-3 left-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-sm text-white/70 hover:text-white text-xs font-medium transition-colors z-10"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            {showOriginal ? 'Original' : 'Hold to compare'}
          </button>
        )}
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2">
        {editedUrl && (
          <Button
            onClick={onDownload}
            className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white"
          >
            <Download className="w-4 h-4 mr-2" />
            Download Edited
          </Button>
        )}
        {!editedUrl && originalUrl && (
          <Button
            onClick={onDownload}
            variant="outline"
            className="flex-1 border-white/10 text-white/60"
          >
            <Download className="w-4 h-4 mr-2" />
            Download Original
          </Button>
        )}
      </div>
    </div>
  );
}
