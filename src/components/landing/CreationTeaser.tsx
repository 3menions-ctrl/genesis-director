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
  Wand2,
  Stars
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ASPECT_RATIOS = [
  { value: '16:9', label: '16:9', icon: MonitorPlay, description: 'YouTube / TV' },
  { value: '9:16', label: '9:16', icon: Smartphone, description: 'TikTok / Reels' },
  { value: '1:1', label: '1:1', icon: Square, description: 'Instagram' },
] as const;

const VIDEO_TYPES = [
  { value: 'cinematic', label: 'Cinematic', emoji: '🎬', gradient: 'from-amber-500 to-orange-600' },
  { value: 'documentary', label: 'Documentary', emoji: '📹', gradient: 'from-blue-500 to-cyan-600' },
  { value: 'ad', label: 'Commercial', emoji: '📺', gradient: 'from-pink-500 to-rose-600' },
  { value: 'storytelling', label: 'Narrative', emoji: '📖', gradient: 'from-violet-500 to-purple-600' },
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
  const [isFocused, setIsFocused] = useState(false);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      return;
    }
    
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
  const selectedType = VIDEO_TYPES.find(t => t.value === videoType);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 30, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
      className={cn("w-full max-w-2xl mx-auto px-2 sm:px-0", className)}
    >
      {/* Outer glow container */}
      <div className="relative">
        {/* Animated background glow - subtle on mobile */}
        <motion.div 
          className="absolute -inset-2 sm:-inset-4 rounded-2xl sm:rounded-[2.5rem] opacity-40 sm:opacity-60 blur-xl sm:blur-2xl"
          animate={{
            background: isFocused 
              ? [
                  'radial-gradient(ellipse at 30% 20%, hsl(var(--primary) / 0.4) 0%, transparent 50%)',
                  'radial-gradient(ellipse at 70% 80%, hsl(var(--primary) / 0.4) 0%, transparent 50%)',
                  'radial-gradient(ellipse at 30% 20%, hsl(var(--primary) / 0.4) 0%, transparent 50%)',
                ]
              : 'radial-gradient(ellipse at 50% 50%, hsl(var(--primary) / 0.15) 0%, transparent 70%)'
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Main card - tighter padding on mobile */}
        <div className="relative rounded-2xl sm:rounded-[2rem] overflow-hidden shadow-xl sm:shadow-2xl">
          {/* Warm gradient background matching new theme */}
          <div className="absolute inset-0 bg-gradient-to-br from-white via-orange-50/30 to-white" />
          <div className="absolute inset-0 bg-gradient-to-tl from-primary/10 via-white/60 to-accent/10" />
          
          {/* Simplified orbs - fewer on mobile for performance */}
          <div className="absolute inset-0 hidden sm:block">
            <div className="absolute top-0 left-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-0 w-80 h-80 bg-accent/15 rounded-full blur-3xl" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-primary/10 rounded-full blur-2xl" />
          </div>
          
          {/* Mobile: simpler background */}
          <div className="absolute inset-0 sm:hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5" />
          </div>
          
          {/* White overlay for ethereal effect */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/50 via-transparent to-white/40" />

          {/* Premium border */}
          <div className="absolute inset-0 rounded-2xl sm:rounded-[2rem] border border-foreground/10" />
          <motion.div 
            className="absolute inset-0 rounded-2xl sm:rounded-[2rem]"
            animate={{
              boxShadow: isFocused 
                ? 'inset 0 0 0 2px hsl(var(--primary) / 0.5), 0 0 40px 0 hsl(var(--primary) / 0.15)'
                : 'inset 0 0 0 1px hsl(var(--foreground) / 0.1)'
            }}
            transition={{ duration: 0.4 }}
          />
          
          <div className="relative p-5 sm:p-8 lg:p-10">
            {/* Floating sparkles - hidden on mobile */}
            <div className="absolute top-4 right-6 opacity-40 hidden sm:block">
              <Stars className="w-5 h-5 text-primary animate-pulse" />
            </div>

            {/* Compact Header - mobile first */}
            <div className="text-center mb-5 sm:mb-8">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/20 mb-3 sm:mb-4"
              >
                <Wand2 className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </motion.div>
              <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-1.5 sm:mb-2">
                What's your video about?
              </h3>
              <p className="text-muted-foreground text-sm sm:text-base max-w-sm mx-auto">
                Describe your idea in a few sentences
              </p>
            </div>

            {/* Concept Input - Hero element - Smaller on mobile */}
            <div className="mb-5 sm:mb-8">
              <div className="relative group">
                {/* Glow effect on focus - subtle */}
                <motion.div 
                  className="absolute -inset-0.5 sm:-inset-1 rounded-xl sm:rounded-2xl bg-gradient-to-r from-primary/40 via-accent/40 to-primary/40 opacity-0 blur-md sm:blur-lg transition-opacity duration-500"
                  animate={{ opacity: isFocused ? 0.4 : 0 }}
                />
                
                <div className="relative">
                  <Textarea
                    value={concept}
                    onChange={(e) => setConcept(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder="e.g., 'An astronaut discovers ancient ruins on Mars as dust swirls in the crimson sky'"
                    className={cn(
                      "min-h-[100px] sm:min-h-[120px] resize-none text-sm sm:text-base leading-relaxed",
                      "bg-white/80 border-2 border-foreground/10 rounded-xl sm:rounded-2xl",
                      "focus:border-primary/50 focus:bg-white transition-all duration-300",
                      "placeholder:text-muted-foreground/50 placeholder:leading-relaxed",
                      "p-4 sm:p-5"
                    )}
                  />
                  
                  {/* Character counter - compact */}
                  <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 flex items-center gap-2">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: concept.length > 10 ? 1 : 0 }}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="text-[10px] sm:text-xs font-medium text-emerald-600">Ready</span>
                    </motion.div>
                    <span className="text-[10px] sm:text-xs font-medium text-muted-foreground/60">
                      {concept.length}/500
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Options Grid - Horizontal scroll on mobile */}
            <div className="mb-5 sm:mb-8 space-y-4 sm:space-y-5">
              {/* Aspect Ratio - Compact horizontal */}
              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <MonitorPlay className="w-3.5 h-3.5 text-muted-foreground" />
                  Format
                </label>
                <div className="flex gap-2">
                  {ASPECT_RATIOS.map((ratio) => {
                    const Icon = ratio.icon;
                    const isSelected = aspectRatio === ratio.value;
                    return (
                      <motion.button
                        key={ratio.value}
                        onClick={() => setAspectRatio(ratio.value)}
                        whileTap={{ scale: 0.95 }}
                        className={cn(
                          "relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl transition-all duration-200",
                          isSelected
                            ? "bg-foreground text-background shadow-md"
                            : "bg-white/60 text-muted-foreground hover:bg-white border border-foreground/5"
                        )}
                      >
                        <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span className="text-xs sm:text-sm font-medium">{ratio.label}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Video Type - Horizontal scroll on mobile */}
              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5 text-muted-foreground" />
                  Style
                </label>
                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
                  {VIDEO_TYPES.map((type) => {
                    const isSelected = videoType === type.value;
                    return (
                      <motion.button
                        key={type.value}
                        onClick={() => setVideoType(type.value)}
                        whileTap={{ scale: 0.95 }}
                        className={cn(
                          "flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl transition-all duration-200 whitespace-nowrap shrink-0",
                          isSelected
                            ? "bg-foreground text-background shadow-md"
                            : "bg-white/60 text-muted-foreground hover:bg-white border border-foreground/5"
                        )}
                      >
                        <span className="text-sm sm:text-base">{type.emoji}</span>
                        <span className="text-xs sm:text-sm font-medium">{type.label}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Reference Image Upload - Collapsible on mobile */}
            <details className="mb-5 sm:mb-6 group">
              <summary className="text-xs sm:text-sm font-semibold text-muted-foreground flex items-center gap-1.5 cursor-pointer list-none">
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
                      className="relative group/img"
                    >
                      <div className="relative h-28 sm:h-36 rounded-xl overflow-hidden bg-muted border border-foreground/10">
                        <img 
                          src={referenceImage} 
                          alt="Reference" 
                          className="w-full h-full object-cover"
                        />
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={clearImage}
                          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center text-foreground shadow-md"
                        >
                          <X className="w-3.5 h-3.5" />
                        </motion.button>
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
                      <motion.button
                        onClick={() => fileInputRef.current?.click()}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        whileTap={{ scale: 0.98 }}
                        className={cn(
                          "w-full h-20 sm:h-24 rounded-xl border-2 border-dashed transition-all duration-200 flex items-center justify-center gap-2",
                          isDragging
                            ? "border-primary bg-primary/10"
                            : "border-foreground/15 bg-white/50"
                        )}
                      >
                        <Upload className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs sm:text-sm text-muted-foreground">
                          {isDragging ? "Drop here" : "Upload image"}
                        </span>
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </details>

            {/* CTA Button - Prominent, mobile-optimized */}
            <div className="space-y-3">
              <motion.div
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  onClick={handleCreate}
                  disabled={!isReady}
                  size="lg"
                  className={cn(
                    "w-full h-12 sm:h-14 text-base sm:text-lg font-bold rounded-xl sm:rounded-2xl transition-all duration-300",
                    isReady 
                      ? "bg-foreground hover:bg-foreground/90 shadow-lg" 
                      : "opacity-40 cursor-not-allowed"
                  )}
                >
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  <span>Create My Video Free</span>
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />
                </Button>
              </motion.div>

              {/* Compact step indicator */}
              <div className="flex items-center justify-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground">
                <span className={cn(
                  "px-2 py-0.5 rounded-full",
                  concept.length >= 10 ? "bg-emerald-500/10 text-emerald-600" : "bg-muted"
                )}>
                  1. Describe {concept.length >= 10 && "✓"}
                </span>
                <ArrowRight className="w-3 h-3" />
                <span className="px-2 py-0.5 rounded-full bg-muted">2. Quick signup</span>
                <ArrowRight className="w-3 h-3" />
                <span className="px-2 py-0.5 rounded-full bg-muted">3. Generate!</span>
              </div>
            </div>

            {/* Bottom info - Compact */}
            <div className="flex items-center justify-center gap-3 sm:gap-5 mt-4 sm:mt-6 pt-4 sm:pt-5 border-t border-foreground/5">
              <div className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground">
                <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                </div>
                <span>Free</span>
              </div>
              <div className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">60</span>
                <span>credits</span>
              </div>
              <div className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground">
                <span>No card</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default CreationTeaser;
