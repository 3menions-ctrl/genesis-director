import { useState } from 'react';
import { motion } from 'framer-motion';
import { Type, Download, Sparkles, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface TextOverlayGeneratorProps {
  videoUrl: string;
  onClose?: () => void;
}

/**
 * AI Video Text Limitation Notice
 * 
 * AI video models (Kling, Sora, Runway, etc.) CANNOT reliably render specific text.
 * They often hallucinate random letters when asked to display logos or text.
 * 
 * SOLUTIONS:
 * 1. Use image-to-video with a pre-made logo image as the starting frame
 * 2. Add text overlays in post-production (video editing software)
 * 3. Describe the visual style without specific text, then overlay later
 */
export function TextOverlayGenerator({ videoUrl, onClose }: TextOverlayGeneratorProps) {
  const [overlayText, setOverlayText] = useState('APEX-STUDIO');
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
      <div className="relative max-w-2xl w-full bg-zinc-900 rounded-2xl border border-amber-500/30 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">AI Text Rendering Limitation</h3>
              <p className="text-sm text-amber-400/80">Video AI models cannot render specific text reliably</p>
            </div>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-6">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
            <h4 className="text-sm font-medium text-amber-300 mb-2">Why did my logo look wrong?</h4>
            <p className="text-sm text-zinc-400">
              AI video models (Kling, Sora, Runway, etc.) <strong className="text-white">cannot reliably render specific text or logos</strong>. 
              They understand "a logo should appear" but hallucinate random letters like "PAKGASTS" instead of "APEX-STUDIO".
            </p>
          </div>
          
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              Solutions
            </h4>
            
            <div className="grid gap-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs text-emerald-400 font-medium">1</div>
                <div>
                  <p className="text-sm font-medium text-white">Use Image-to-Video</p>
                  <p className="text-xs text-zinc-400">Upload an image with your logo as the starting frame. The AI will animate from it.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs text-emerald-400 font-medium">2</div>
                <div>
                  <p className="text-sm font-medium text-white">Post-Production Overlay</p>
                  <p className="text-xs text-zinc-400">Download the video and add your logo/text using video editing software (CapCut, Premiere, etc.)</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs text-emerald-400 font-medium">3</div>
                <div>
                  <p className="text-sm font-medium text-white">Describe Style, Not Text</p>
                  <p className="text-xs text-zinc-400">Prompt for "cinematic logo reveal with geometric shapes" without specifying the exact text, then overlay later.</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Quick Download */}
          <div className="pt-4 border-t border-white/10">
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-400">Download your video to add the correct logo:</p>
              <Button 
                size="sm" 
                className="gap-2 bg-emerald-600 hover:bg-emerald-500"
                asChild
              >
                <a href={videoUrl} download>
                  <Download className="w-4 h-4" />
                  Download Video
                </a>
              </Button>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-black/20">
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button 
              onClick={() => window.open('/create?mode=image-to-video', '_blank')}
              className="gap-2"
            >
              <Type className="w-4 h-4" />
              Try Image-to-Video Mode
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
