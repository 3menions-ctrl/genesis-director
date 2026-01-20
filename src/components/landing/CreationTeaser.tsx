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
  Square
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ASPECT_RATIOS = [
  { value: '16:9', label: '16:9', icon: MonitorPlay, description: 'Landscape' },
  { value: '9:16', label: '9:16', icon: Smartphone, description: 'Portrait' },
  { value: '1:1', label: '1:1', icon: Square, description: 'Square' },
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
  const [isHovered, setIsHovered] = useState(false);

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
    // Store creation data in sessionStorage for retrieval after signup
    const creationData = {
      concept,
      aspectRatio,
      videoType,
      referenceImage,
      referenceFileName,
      timestamp: Date.now(),
    };
    sessionStorage.setItem('pendingCreation', JSON.stringify(creationData));
    
    // Navigate to auth with signup mode
    navigate('/auth?mode=signup&from=create');
  };

  const isReady = concept.trim().length > 10;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.2 }}
      className={cn("w-full max-w-2xl mx-auto", className)}
    >
      <div 
        className="relative rounded-3xl overflow-hidden"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Glass morphism container */}
        <div className="absolute inset-0 bg-white/70 dark:bg-black/50 backdrop-blur-xl" />
        <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-transparent dark:from-white/10" />
        
        {/* Animated border glow on hover */}
        <motion.div 
          className="absolute inset-0 rounded-3xl"
          animate={{
            boxShadow: isHovered 
              ? '0 0 40px 2px hsl(var(--primary) / 0.3), inset 0 0 0 1px hsl(var(--primary) / 0.3)'
              : '0 0 0 0 transparent, inset 0 0 0 1px hsl(var(--foreground) / 0.1)'
          }}
          transition={{ duration: 0.3 }}
        />
        
        <div className="relative p-6 sm:p-8 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Start Creating</h3>
              <p className="text-sm text-muted-foreground">Describe your vision</p>
            </div>
          </div>

          {/* Concept Input */}
          <div className="space-y-2">
            <Textarea
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="Describe your video... e.g., 'A lone astronaut discovers ancient ruins on Mars, walking through towering stone pillars as dust swirls in the crimson sky'"
              className="min-h-[100px] resize-none bg-white/50 dark:bg-white/10 border-foreground/10 focus:border-primary/50 rounded-xl text-base placeholder:text-muted-foreground/60"
            />
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>{concept.length} characters</span>
              <span className={cn(
                "transition-colors",
                concept.length > 10 ? "text-emerald-500" : "text-muted-foreground"
              )}>
                {concept.length > 10 ? "✓ Ready" : "Min 10 characters"}
              </span>
            </div>
          </div>

          {/* Options Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Aspect Ratio Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Aspect Ratio</label>
              <div className="flex gap-2">
                {ASPECT_RATIOS.map((ratio) => {
                  const Icon = ratio.icon;
                  return (
                    <button
                      key={ratio.value}
                      onClick={() => setAspectRatio(ratio.value)}
                      className={cn(
                        "flex-1 flex flex-col items-center gap-1 p-3 rounded-xl transition-all",
                        aspectRatio === ratio.value
                          ? "bg-foreground text-background shadow-lg scale-105"
                          : "bg-white/50 dark:bg-white/10 text-muted-foreground hover:bg-white/80 dark:hover:bg-white/20"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-xs font-medium">{ratio.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Video Type Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Type</label>
              <div className="grid grid-cols-2 gap-2">
                {VIDEO_TYPES.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setVideoType(type.value)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all",
                      videoType === type.value
                        ? "bg-foreground text-background shadow-lg"
                        : "bg-white/50 dark:bg-white/10 text-muted-foreground hover:bg-white/80 dark:hover:bg-white/20"
                    )}
                  >
                    <span>{type.emoji}</span>
                    <span className="font-medium">{type.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Reference Image Upload */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              Reference Image
              <span className="text-xs text-muted-foreground font-normal">(optional)</span>
            </label>
            
            <AnimatePresence mode="wait">
              {referenceImage ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="relative group"
                >
                  <div className="relative h-32 rounded-xl overflow-hidden bg-muted">
                    <img 
                      src={referenceImage} 
                      alt="Reference" 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <button
                      onClick={clearImage}
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-2 left-2 right-10 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-xs text-white truncate">{referenceFileName}</p>
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
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    className={cn(
                      "w-full h-24 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2",
                      isDragging
                        ? "border-primary bg-primary/10"
                        : "border-foreground/20 hover:border-foreground/40 bg-white/30 dark:bg-white/5"
                    )}
                  >
                    <Upload className={cn(
                      "w-5 h-5 transition-colors",
                      isDragging ? "text-primary" : "text-muted-foreground"
                    )} />
                    <span className="text-sm text-muted-foreground">
                      {isDragging ? "Drop image here" : "Drop or click to upload"}
                    </span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Create Button */}
          <Button
            onClick={handleCreate}
            disabled={!isReady}
            size="lg"
            className={cn(
              "w-full h-14 text-base font-semibold rounded-xl transition-all",
              isReady 
                ? "shadow-obsidian hover:shadow-obsidian-lg hover:-translate-y-0.5" 
                : "opacity-50 cursor-not-allowed"
            )}
          >
            <Film className="w-5 h-5 mr-2" />
            Create Video
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>

          {/* Subtle hint */}
          <p className="text-center text-xs text-muted-foreground">
            Free account required • No credit card needed • 60 free credits
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export default CreationTeaser;
