import { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Loader2, ArrowLeftRight, Video, Eraser, Undo2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface PhotoEditCanvasHandle {
  /** Returns the painted mask as a PNG data URL sized to the source image
   *  (white = remove, black = keep), or null if nothing has been painted. */
  exportMask: () => string | null;
  /** True when the user has painted at least one stroke. */
  hasMask: () => boolean;
  /** Clears all painted strokes. */
  clearMask: () => void;
}

interface PhotoEditCanvasProps {
  originalUrl: string | null;
  editedUrl: string | null;
  isProcessing: boolean;
  onDownload: () => void;
  onUseInVideo?: (imageUrl: string) => void;
  /** When 'remove', shows the brush-mask painter over the source image. */
  maskMode?: boolean;
}

export const PhotoEditCanvas = forwardRef<PhotoEditCanvasHandle, PhotoEditCanvasProps>(function PhotoEditCanvas(
  { originalUrl, editedUrl, isProcessing, onDownload, onUseInVideo, maskMode = false },
  ref,
) {
  const [showOriginal, setShowOriginal] = useState(false);
  const [brushSize, setBrushSize] = useState(48);
  const [hasStrokes, setHasStrokes] = useState(false);

  // Natural pixel dimensions of the loaded source image. The mask canvas is
  // sized to these so the exported PNG matches the source 1:1.
  const naturalSize = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  // Off-screen canvas holding the mask at the source's natural resolution.
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // On-screen overlay canvas, scaled to the displayed image box.
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const drawing = useRef(false);
  // Undo stack of mask snapshots (ImageData), one per completed stroke.
  const undoStack = useRef<ImageData[]>([]);

  const displayUrl = showOriginal ? originalUrl : (editedUrl || originalUrl);

  // (Re)initialise the mask canvas whenever the source image changes.
  useEffect(() => {
    if (!maskMode || !originalUrl) return;
    setHasStrokes(false);
    undoStack.current = [];
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      naturalSize.current = { w: img.naturalWidth, h: img.naturalHeight };
      let mask = maskCanvasRef.current;
      if (!mask) {
        mask = document.createElement('canvas');
        maskCanvasRef.current = mask;
      }
      mask.width = img.naturalWidth;
      mask.height = img.naturalHeight;
      const mctx = mask.getContext('2d');
      if (mctx) {
        // Mask starts fully black = keep everything.
        mctx.fillStyle = '#000000';
        mctx.fillRect(0, 0, mask.width, mask.height);
      }
      syncOverlaySize();
    };
    img.src = originalUrl;
  }, [originalUrl, maskMode]);

  // Match the on-screen overlay canvas to the rendered image box.
  const syncOverlaySize = useCallback(() => {
    const overlay = overlayRef.current;
    const imgEl = imgRef.current;
    if (!overlay || !imgEl) return;
    const rect = imgEl.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    overlay.width = Math.round(rect.width);
    overlay.height = Math.round(rect.height);
    redrawOverlay();
  }, []);

  // Redraw the magenta visualization of the current mask onto the overlay.
  const redrawOverlay = useCallback(() => {
    const overlay = overlayRef.current;
    const mask = maskCanvasRef.current;
    if (!overlay || !mask) return;
    const octx = overlay.getContext('2d');
    if (!octx) return;
    octx.clearRect(0, 0, overlay.width, overlay.height);
    octx.save();
    octx.globalAlpha = 0.5;
    octx.drawImage(mask, 0, 0, overlay.width, overlay.height);
    octx.restore();
    // Tint the drawn (white) areas magenta so black stays invisible.
    octx.save();
    octx.globalCompositeOperation = 'source-in';
    octx.fillStyle = 'rgba(236, 72, 153, 0.55)';
    octx.fillRect(0, 0, overlay.width, overlay.height);
    octx.restore();
  }, []);

  useEffect(() => {
    if (!maskMode) return;
    const onResize = () => syncOverlaySize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [maskMode, syncOverlaySize]);

  // Map a pointer event to natural-image pixel coordinates.
  const toNatural = useCallback((e: React.PointerEvent) => {
    const overlay = overlayRef.current;
    if (!overlay) return null;
    const rect = overlay.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    return {
      x: x * naturalSize.current.w,
      y: y * naturalSize.current.h,
      // Scale the brush from display space into natural space.
      r: (brushSize / 2) * (naturalSize.current.w / rect.width),
    };
  }, [brushSize]);

  const paintAt = useCallback((e: React.PointerEvent) => {
    const mask = maskCanvasRef.current;
    const pt = toNatural(e);
    if (!mask || !pt) return;
    const mctx = mask.getContext('2d');
    if (!mctx) return;
    mctx.fillStyle = '#ffffff';
    mctx.beginPath();
    mctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
    mctx.fill();
    redrawOverlay();
  }, [toNatural, redrawOverlay]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!maskMode || isProcessing) return;
    const mask = maskCanvasRef.current;
    if (!mask) return;
    const mctx = mask.getContext('2d');
    if (mctx) {
      // Snapshot before this stroke so it can be undone.
      undoStack.current.push(mctx.getImageData(0, 0, mask.width, mask.height));
      if (undoStack.current.length > 30) undoStack.current.shift();
    }
    drawing.current = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    paintAt(e);
    setHasStrokes(true);
  }, [maskMode, isProcessing, paintAt]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!drawing.current) return;
    paintAt(e);
  }, [paintAt]);

  const handlePointerUp = useCallback(() => {
    drawing.current = false;
  }, []);

  const handleUndo = useCallback(() => {
    const mask = maskCanvasRef.current;
    if (!mask) return;
    const prev = undoStack.current.pop();
    const mctx = mask.getContext('2d');
    if (!mctx) return;
    if (prev) {
      mctx.putImageData(prev, 0, 0);
    } else {
      mctx.fillStyle = '#000000';
      mctx.fillRect(0, 0, mask.width, mask.height);
    }
    setHasStrokes(undoStack.current.length > 0);
    redrawOverlay();
  }, [redrawOverlay]);

  const handleClear = useCallback(() => {
    const mask = maskCanvasRef.current;
    if (!mask) return;
    const mctx = mask.getContext('2d');
    if (!mctx) return;
    mctx.fillStyle = '#000000';
    mctx.fillRect(0, 0, mask.width, mask.height);
    undoStack.current = [];
    setHasStrokes(false);
    redrawOverlay();
  }, [redrawOverlay]);

  useImperativeHandle(ref, () => ({
    exportMask: () => {
      const mask = maskCanvasRef.current;
      if (!mask || !hasStrokes) return null;
      return mask.toDataURL('image/png');
    },
    hasMask: () => hasStrokes,
    clearMask: () => handleClear(),
  }), [hasStrokes, handleClear]);

  if (!originalUrl) {
    return (
      <div className="aspect-square sm:aspect-[4/3] bg-glass border border-white/[0.06] rounded-xl flex items-center justify-center">
        <p className="text-white/20 text-sm">Select a photo to edit</p>
      </div>
    );
  }

  // In mask mode (object removal) we always paint over the ORIGINAL so the
  // user marks objects on the source. The before/after viewer is only used
  // once an edited result exists and we're not actively painting.
  const showMaskPainter = maskMode && !editedUrl;

  return (
    <div className="space-y-3">
      <div className="relative aspect-square sm:aspect-[4/3] bg-black/40 border border-white/[0.06] rounded-xl overflow-hidden group">
        <AnimatePresence mode="wait">
          <motion.img
            key={showMaskPainter ? originalUrl : displayUrl}
            ref={imgRef}
            src={(showMaskPainter ? originalUrl : displayUrl) || ''}
            alt="Photo"
            crossOrigin="anonymous"
            onLoad={maskMode ? syncOverlaySize : undefined}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full h-full object-contain"
          />
        </AnimatePresence>

        {/* Mask painting overlay */}
        {showMaskPainter && (
          <canvas
            ref={overlayRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 touch-none cursor-crosshair z-[5]"
            style={{
              width: overlayRef.current?.width ? `${overlayRef.current.width}px` : '100%',
              height: overlayRef.current?.height ? `${overlayRef.current.height}px` : '100%',
            }}
          />
        )}

        {/* Processing overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-10">
            <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 text-cyan-400 animate-spin mb-3" />
            <p className="text-white font-medium text-sm sm:text-base">
              {maskMode ? 'Removing object…' : 'Processing edit...'}
            </p>
            <p className="text-white/40 text-xs sm:text-sm mt-1">This may take a few seconds</p>
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
            className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-black/60 backdrop-blur-sm text-white/70 hover:text-white text-[10px] sm:text-xs font-medium transition-colors z-10"
          >
            <ArrowLeftRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            {showOriginal ? 'Original' : 'Hold to compare'}
          </button>
        )}
      </div>

      {/* Brush controls — only while painting a removal mask */}
      {showMaskPainter && !isProcessing && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-glass border border-white/[0.06] px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-white/50 text-xs">
            <Eraser className="w-3.5 h-3.5 text-pink-400" />
            <span className="hidden sm:inline">Brush</span>
          </div>
          <input
            type="range"
            min={8}
            max={140}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="flex-1 min-w-[100px] accent-pink-500 h-1.5"
            aria-label="Brush size"
          />
          <span className="text-[11px] text-white/40 w-8 text-right tabular-nums">{brushSize}px</span>
          <div className="flex items-center gap-1.5 ml-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleUndo}
              disabled={!hasStrokes}
              className="h-8 border-white/10 text-white/60 hover:text-white text-xs px-2"
            >
              <Undo2 className="w-3.5 h-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Undo</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClear}
              disabled={!hasStrokes}
              className="h-8 border-white/10 text-white/60 hover:text-white text-xs px-2"
            >
              <Trash2 className="w-3.5 h-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Clear</span>
            </Button>
          </div>
          <p className="w-full text-[11px] text-white/30">
            Paint over the object you want to remove, then run the removal.
          </p>
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center gap-2">
        {editedUrl && (
          <>
            <Button
              onClick={onDownload}
              className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white text-sm"
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
            {onUseInVideo && (
              <Button
                onClick={() => onUseInVideo(editedUrl)}
                variant="outline"
                className="flex-1 border-violet-500/30 text-violet-300 hover:bg-violet-500/10 text-sm"
              >
                <Video className="w-4 h-4 mr-2" />
                Use in Video
              </Button>
            )}
          </>
        )}
        {!editedUrl && originalUrl && (
          <Button
            onClick={onDownload}
            variant="outline"
            className="flex-1 border-white/10 text-white/60 text-sm"
          >
            <Download className="w-4 h-4 mr-2" />
            Download Original
          </Button>
        )}
      </div>
    </div>
  );
});
