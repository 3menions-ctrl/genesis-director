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
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={cn("w-full max-w-3xl mx-auto", className)}
    >
      {/* Outer glow container */}
      <div className="relative">
        {/* Animated background glow */}
        <motion.div 
          className="absolute -inset-4 rounded-[2.5rem] opacity-60 blur-2xl"
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

        {/* Main card */}
        <div className="relative rounded-[2rem] overflow-hidden shadow-2xl">
          {/* Heavenly white and violet spotted gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-white via-violet-50 to-white" />
          <div className="absolute inset-0 bg-gradient-to-tl from-violet-100/80 via-white/60 to-violet-50/40" />
          
          {/* Spotted violet orbs - heavenly effect */}
          <div className="absolute inset-0">
            {/* Large primary orbs */}
            <div className="absolute top-0 left-0 w-80 h-80 bg-violet-400/30 rounded-full blur-3xl" />
            <div className="absolute top-1/4 right-0 w-96 h-96 bg-violet-500/25 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-1/3 w-72 h-72 bg-violet-300/35 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-violet-600/20 rounded-full blur-3xl" />
            
            {/* Medium accent orbs */}
            <div className="absolute top-1/3 left-1/4 w-48 h-48 bg-purple-400/40 rounded-full blur-2xl animate-pulse" />
            <div className="absolute top-1/2 right-1/3 w-40 h-40 bg-violet-500/35 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '1s' }} />
            <div className="absolute bottom-1/3 left-1/2 w-36 h-36 bg-purple-300/45 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '2s' }} />
            
            {/* Small sparkle orbs */}
            <div className="absolute top-20 right-1/4 w-24 h-24 bg-violet-400/50 rounded-full blur-xl animate-pulse" style={{ animationDelay: '0.5s' }} />
            <div className="absolute bottom-20 left-20 w-20 h-20 bg-purple-500/40 rounded-full blur-xl animate-pulse" style={{ animationDelay: '1.5s' }} />
            <div className="absolute top-1/2 left-10 w-16 h-16 bg-violet-300/55 rounded-full blur-lg animate-pulse" style={{ animationDelay: '2.5s' }} />
            <div className="absolute bottom-1/2 right-10 w-28 h-28 bg-purple-400/35 rounded-full blur-xl animate-pulse" style={{ animationDelay: '0.8s' }} />
          </div>
          
          {/* White overlay for ethereal effect */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-transparent to-white/30" />

          {/* Premium border */}
          <div className="absolute inset-0 rounded-[2rem] border border-foreground/10" />
          <motion.div 
            className="absolute inset-0 rounded-[2rem]"
            animate={{
              boxShadow: isFocused 
                ? 'inset 0 0 0 2px hsl(var(--primary) / 0.5), 0 0 60px 0 hsl(var(--primary) / 0.2)'
                : 'inset 0 0 0 1px hsl(var(--foreground) / 0.1)'
            }}
            transition={{ duration: 0.4 }}
          />
          
          <div className="relative p-8 sm:p-10 lg:p-12">
            {/* Floating sparkles */}
            <div className="absolute top-6 right-8 opacity-40">
              <Stars className="w-5 h-5 text-primary animate-pulse" />
            </div>
            <div className="absolute bottom-20 left-6 opacity-30">
              <Sparkles className="w-4 h-4 text-accent animate-pulse" style={{ animationDelay: '0.5s' }} />
            </div>

            {/* Header */}
            <div className="text-center mb-8">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
                className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 shadow-lg shadow-violet-500/30 mb-5"
              >
                <Wand2 className="w-8 h-8 text-white" />
              </motion.div>
              <h3 className="text-2xl sm:text-3xl font-bold text-violet-900 mb-2">
                Bring Your Vision to Life
              </h3>
              <p className="text-violet-700/80 text-base sm:text-lg max-w-md mx-auto">
                Describe your story and watch AI transform it into stunning video
              </p>
            </div>

            {/* Concept Input - Hero element */}
            <div className="mb-8">
              <div className="relative group">
                {/* Glow effect on focus */}
                <motion.div 
                  className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-primary/50 via-accent/50 to-primary/50 opacity-0 blur-lg transition-opacity duration-500"
                  animate={{ opacity: isFocused ? 0.5 : 0 }}
                />
                
                <div className="relative">
                  <Textarea
                    value={concept}
                    onChange={(e) => setConcept(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder="Describe your video... e.g., 'A lone astronaut discovers ancient ruins on Mars, walking through towering stone pillars as dust swirls in the crimson sky'"
                    className={cn(
                      "min-h-[140px] resize-none text-base sm:text-lg leading-relaxed",
                      "bg-muted/50 border-2 border-foreground/10 rounded-2xl",
                      "focus:border-primary/50 focus:bg-muted/70 transition-all duration-300",
                      "placeholder:text-muted-foreground/50 placeholder:leading-relaxed",
                      "p-5"
                    )}
                  />
                  
                  {/* Character counter */}
                  <div className="absolute bottom-4 right-4 flex items-center gap-3">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: concept.length > 10 ? 1 : 0 }}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="text-xs font-medium text-emerald-600">Ready</span>
                    </motion.div>
                    <span className={cn(
                      "text-xs font-medium transition-colors",
                      concept.length > 10 ? "text-muted-foreground" : "text-muted-foreground/50"
                    )}>
                      {concept.length}/500
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Options Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Aspect Ratio Selection */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <MonitorPlay className="w-4 h-4 text-muted-foreground" />
                  Aspect Ratio
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {ASPECT_RATIOS.map((ratio) => {
                    const Icon = ratio.icon;
                    const isSelected = aspectRatio === ratio.value;
                    return (
                      <motion.button
                        key={ratio.value}
                        onClick={() => setAspectRatio(ratio.value)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={cn(
                          "relative flex flex-col items-center gap-2 p-4 rounded-xl transition-all duration-300",
                          isSelected
                            ? "bg-foreground text-background shadow-lg"
                            : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border border-foreground/5"
                        )}
                      >
                        {isSelected && (
                          <motion.div
                            layoutId="aspectRatio"
                            className="absolute inset-0 bg-foreground rounded-xl"
                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                          />
                        )}
                        <div className="relative z-10 flex flex-col items-center gap-1.5">
                          <Icon className="w-5 h-5" />
                          <span className="text-sm font-semibold">{ratio.label}</span>
                          <span className={cn(
                            "text-[10px]",
                            isSelected ? "text-background/70" : "text-muted-foreground/70"
                          )}>{ratio.description}</span>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Video Type Selection */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Film className="w-4 h-4 text-muted-foreground" />
                  Style
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {VIDEO_TYPES.map((type) => {
                    const isSelected = videoType === type.value;
                    return (
                      <motion.button
                        key={type.value}
                        onClick={() => setVideoType(type.value)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={cn(
                          "relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300",
                          isSelected
                            ? "bg-foreground text-background shadow-lg"
                            : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border border-foreground/5"
                        )}
                      >
                        {isSelected && (
                          <motion.div
                            layoutId="videoType"
                            className="absolute inset-0 bg-foreground rounded-xl"
                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                          />
                        )}
                        <span className="relative z-10 text-lg">{type.emoji}</span>
                        <span className="relative z-10 font-medium text-sm">{type.label}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Reference Image Upload */}
            <div className="mb-8">
              <label className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                <ImageIcon className="w-4 h-4 text-muted-foreground" />
                Reference Image
                <span className="text-xs font-normal text-muted-foreground ml-1">(optional)</span>
              </label>
              
              <AnimatePresence mode="wait">
                {referenceImage ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="relative group"
                  >
                    <div className="relative h-40 rounded-2xl overflow-hidden bg-muted border-2 border-foreground/10">
                      <img 
                        src={referenceImage} 
                        alt="Reference" 
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={clearImage}
                        className="absolute top-3 right-3 w-9 h-9 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background flex items-center justify-center text-foreground shadow-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </motion.button>
                      <div className="absolute bottom-3 left-3 right-14 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-sm text-foreground font-medium truncate">{referenceFileName}</p>
                      </div>
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
                      whileHover={{ scale: 1.01 }}
                      className={cn(
                        "w-full h-28 rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center gap-2",
                        isDragging
                          ? "border-primary bg-primary/10 scale-[1.02]"
                          : "border-foreground/20 hover:border-foreground/40 bg-muted/30 hover:bg-muted/50"
                      )}
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                        isDragging ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                      )}>
                        <Upload className="w-5 h-5" />
                      </div>
                      <span className={cn(
                        "text-sm font-medium transition-colors",
                        isDragging ? "text-primary" : "text-muted-foreground"
                      )}>
                        {isDragging ? "Drop your image here" : "Drop image or click to upload"}
                      </span>
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Progress Indicator + Create Button */}
            <div className="space-y-4">
              {/* Step indicator */}
              <div className="flex items-center justify-center gap-2 text-sm">
                <div className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all",
                  concept.length >= 20 
                    ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30" 
                    : "bg-muted text-muted-foreground"
                )}>
                  <span className="font-medium">1</span>
                  <span>Describe</span>
                  {concept.length >= 20 && <span>✓</span>}
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground/50" />
                <div className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full",
                  "bg-muted/50 text-muted-foreground/70"
                )}>
                  <span className="font-medium">2</span>
                  <span>Sign up (10 sec)</span>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground/50" />
                <div className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full",
                  "bg-muted/50 text-muted-foreground/70"
                )}>
                  <span className="font-medium">3</span>
                  <span>Create!</span>
                </div>
              </div>

              <motion.div
                whileHover={{ scale: isReady ? 1.02 : 1 }}
                whileTap={{ scale: isReady ? 0.98 : 1 }}
              >
                <Button
                  onClick={handleCreate}
                  disabled={!isReady}
                  size="lg"
                  className={cn(
                    "w-full h-16 text-lg font-bold rounded-2xl transition-all duration-500",
                    isReady 
                      ? "bg-gradient-to-r from-foreground via-foreground to-foreground hover:shadow-2xl hover:shadow-primary/20" 
                      : "opacity-40 cursor-not-allowed"
                  )}
                >
                  <motion.div 
                    className="flex items-center gap-3"
                    animate={{ x: isReady ? 0 : 0 }}
                  >
                    <Sparkles className="w-5 h-5" />
                    <span>Start Creating Free</span>
                    <ArrowRight className={cn(
                      "w-5 h-5 transition-transform duration-300",
                      isReady ? "group-hover:translate-x-1" : ""
                    )} />
                  </motion.div>
                </Button>
              </motion.div>

              {/* Urgency message */}
              {isReady && (
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center text-sm text-muted-foreground"
                >
                  🎉 Your video concept is saved. Complete signup to generate it!
                </motion.p>
              )}
            </div>

            {/* Bottom info */}
            <div className="flex items-center justify-center gap-6 mt-6 pt-6 border-t border-foreground/5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                </div>
                <span>Free to start</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">60</span>
                <span>credits included</span>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
                <span>No credit card</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default CreationTeaser;
