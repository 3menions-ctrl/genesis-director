import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  ArrowRight, 
  Upload, 
  X, 
  Film, 
  Sparkles,
  Image as ImageIcon,
  MonitorPlay,
  Smartphone,
  Square,
  Wand2
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ASPECT_RATIOS = [
  { value: '16:9', label: '16:9', icon: MonitorPlay, description: 'YouTube / TV' },
  { value: '9:16', label: '9:16', icon: Smartphone, description: 'TikTok / Reels' },
  { value: '1:1', label: '1:1', icon: Square, description: 'Instagram' },
] as const;

const VIDEO_TYPES = [
  { value: 'cinematic', label: 'Cinematic', emoji: '🎬' },
  { value: 'documentary', label: 'Documentary', emoji: '📹' },
  { value: 'ad', label: 'Commercial', emoji: '📺' },
  { value: 'storytelling', label: 'Narrative', emoji: '📖' },
] as const;

interface CreationTeaserProps {
  className?: string;
}

export function CreationTeaser({ className }: CreationTeaserProps) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [concept, setConcept] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9');
  const [videoType, setVideoType] = useState('cinematic');
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referenceFileName, setReferenceFileName] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      setReferenceImage(e.target?.result as string);
      setReferenceFileName(file.name);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const clearImage = useCallback(() => {
    setReferenceImage(null);
    setReferenceFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleCreate = () => {
    const creationData = {
      concept,
      aspectRatio,
      videoType,
      referenceImage,
      referenceFileName,
      timestamp: Date.now(),
    };
    sessionStorage.setItem('pendingCreation', JSON.stringify(creationData));
    navigate('/auth?mode=signup&from=create');
  };

  const isReady = concept.trim().length > 10;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 30, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, delay: 0.15 }}
      className={cn("w-full max-w-2xl mx-auto", className)}
    >
      <div className="relative rounded-2xl bg-white/[0.03] border border-white/[0.08] p-6 sm:p-8 lg:p-10">
        {/* Subtle glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-white/[0.02] rounded-full blur-[80px] pointer-events-none" />
        
        <div className="relative">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white mb-3">
              <Wand2 className="w-6 h-6 text-black" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-white mb-1">
              What's your video about?
            </h3>
            <p className="text-white/50 text-sm">
              Describe your idea in a few sentences
            </p>
          </div>

          {/* Concept Input */}
          <div className="mb-5">
            <Textarea
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="e.g., 'An astronaut discovers ancient ruins on Mars as dust swirls in the crimson sky'"
              className={cn(
                "min-h-[100px] resize-none text-sm leading-relaxed",
                "bg-white/[0.03] border-white/[0.1] text-white rounded-xl",
                "focus:border-white/[0.2] focus:bg-white/[0.05] transition-all",
                "placeholder:text-white/30 p-4"
              )}
            />
            {concept.length > 10 && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-400">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Ready to create
              </div>
            )}
          </div>

          {/* Options */}
          <div className="mb-5 space-y-4">
            {/* Aspect Ratio */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-white/50 flex items-center gap-1.5">
                <MonitorPlay className="w-3.5 h-3.5" />
                Format
              </label>
              <div className="flex gap-2">
                {ASPECT_RATIOS.map((ratio) => {
                  const Icon = ratio.icon;
                  const isSelected = aspectRatio === ratio.value;
                  return (
                    <button
                      key={ratio.value}
                      onClick={() => setAspectRatio(ratio.value)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all",
                        isSelected
                          ? "bg-white text-black"
                          : "bg-white/[0.05] text-white/60 hover:bg-white/[0.1] border border-white/[0.08]"
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {ratio.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Video Type */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-white/50 flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5" />
                Style
              </label>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                {VIDEO_TYPES.map((type) => {
                  const isSelected = videoType === type.value;
                  return (
                    <button
                      key={type.value}
                      onClick={() => setVideoType(type.value)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap",
                        isSelected
                          ? "bg-white text-black"
                          : "bg-white/[0.05] text-white/60 hover:bg-white/[0.1] border border-white/[0.08]"
                      )}
                    >
                      <span>{type.emoji}</span>
                      {type.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Reference Image */}
          <details className="mb-5 group">
            <summary className="text-xs font-medium text-white/40 flex items-center gap-1.5 cursor-pointer list-none">
              <ImageIcon className="w-3.5 h-3.5" />
              Add reference image
              <span className="text-xs font-normal ml-1">(optional)</span>
              <ArrowRight className="w-3 h-3 ml-auto transition-transform group-open:rotate-90" />
            </summary>
            
            <div className="mt-3">
              <AnimatePresence mode="wait">
                {referenceImage ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="relative"
                  >
                    <div className="relative h-28 rounded-xl overflow-hidden bg-white/[0.05] border border-white/[0.1]">
                      <img 
                        src={referenceImage} 
                        alt="Reference" 
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={clearImage}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 flex items-center justify-center text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      className={cn(
                        "w-full h-20 rounded-xl border-2 border-dashed transition-all flex items-center justify-center gap-2",
                        isDragging
                          ? "border-white/30 bg-white/[0.05]"
                          : "border-white/[0.1] bg-white/[0.02]"
                      )}
                    >
                      <Upload className="w-4 h-4 text-white/40" />
                      <span className="text-xs text-white/40">
                        {isDragging ? "Drop here" : "Upload image"}
                      </span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </details>

          {/* CTA */}
          <Button
            onClick={handleCreate}
            disabled={!isReady}
            className={cn(
              "w-full h-12 sm:h-14 text-base font-semibold rounded-xl transition-all",
              isReady 
                ? "bg-white text-black hover:bg-white/90" 
                : "bg-white/10 text-white/40 cursor-not-allowed"
            )}
          >
            <Sparkles className="w-5 h-5 mr-2" />
            Create My Video Free
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>

          <p className="text-center text-xs text-white/30 mt-3">
            60 free credits • No credit card required
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export default CreationTeaser;
