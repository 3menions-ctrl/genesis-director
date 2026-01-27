import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wand2, Image, User, Palette, Dices, Film, 
  Sparkles, Upload, Mic, ChevronRight, Play,
  Video, Shirt, Layers, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { CreationModeCard } from './CreationModeCard';
import { VideoGenerationMode, VIDEO_MODES, STYLE_PRESETS, VideoStylePreset, AVATAR_VOICES } from '@/types/video-modes';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Extended mode data with visuals
const CREATION_MODES = [
  {
    id: 'text-to-video' as VideoGenerationMode,
    name: 'Cinematic',
    description: 'Create stunning clips from text prompts',
    icon: Wand2,
    gradient: 'from-violet-500/30 to-fuchsia-500/30',
    popular: true,
  },
  {
    id: 'image-to-video' as VideoGenerationMode,
    name: 'Animate Image',
    description: 'Bring any photo or artwork to life',
    icon: Image,
    gradient: 'from-cyan-500/30 to-blue-500/30',
    popular: true,
  },
  {
    id: 'avatar' as VideoGenerationMode,
    name: 'AI Avatar',
    description: 'Talking heads with perfect lip sync',
    icon: User,
    gradient: 'from-emerald-500/30 to-teal-500/30',
    popular: true,
    isNew: true,
  },
  {
    id: 'video-to-video' as VideoGenerationMode,
    name: 'Style Transfer',
    description: 'Transform videos into any style',
    icon: Palette,
    gradient: 'from-orange-500/30 to-rose-500/30',
    isNew: true,
  },
  {
    id: 'motion-transfer' as VideoGenerationMode,
    name: 'Motion Transfer',
    description: 'Apply dance moves to any character',
    icon: Dices,
    gradient: 'from-pink-500/30 to-purple-500/30',
    isNew: true,
  },
  {
    id: 'b-roll' as VideoGenerationMode,
    name: 'B-Roll',
    description: 'Quick background footage from prompts',
    icon: Film,
    gradient: 'from-amber-500/30 to-yellow-500/30',
  },
];

interface CreationHubProps {
  onStartCreation: (config: {
    mode: VideoGenerationMode;
    prompt: string;
    style?: VideoStylePreset;
    voiceId?: string;
    imageUrl?: string;
    videoUrl?: string;
  }) => void;
  className?: string;
}

export function CreationHub({ onStartCreation, className }: CreationHubProps) {
  const [selectedMode, setSelectedMode] = useState<VideoGenerationMode>('text-to-video');
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<VideoStylePreset>('anime');
  const [selectedVoice, setSelectedVoice] = useState('onwK4e9ZLuTAKqWW03F9');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedVideo, setUploadedVideo] = useState<string | null>(null);

  const currentMode = CREATION_MODES.find(m => m.id === selectedMode);
  const modeConfig = VIDEO_MODES.find(m => m.id === selectedMode);

  const handleCreate = () => {
    if (!prompt.trim() && modeConfig?.requiresText) return;
    
    onStartCreation({
      mode: selectedMode,
      prompt,
      style: selectedMode === 'video-to-video' ? selectedStyle : undefined,
      voiceId: selectedMode === 'avatar' ? selectedVoice : undefined,
      imageUrl: uploadedImage || undefined,
      videoUrl: uploadedVideo || undefined,
    });
  };

  const isReadyToCreate = () => {
    if (modeConfig?.requiresText && !prompt.trim()) return false;
    if (modeConfig?.requiresImage && !uploadedImage) return false;
    if (modeConfig?.requiresVideo && !uploadedVideo) return false;
    return true;
  };

  return (
    <div className={cn("min-h-screen pt-8 pb-24", className)}>
      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-4">
            What will you create?
          </h1>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            Choose your creation mode and bring your vision to life with AI
          </p>
        </motion.div>

        {/* Mode Selection Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-10">
          {CREATION_MODES.map((mode, index) => (
            <CreationModeCard
              key={mode.id}
              id={mode.id}
              name={mode.name}
              description={mode.description}
              icon={mode.icon}
              isSelected={selectedMode === mode.id}
              isPopular={mode.popular}
              isNew={mode.isNew}
              onClick={() => setSelectedMode(mode.id)}
              gradient={mode.gradient}
              delay={index}
            />
          ))}
        </div>

        {/* Configuration Panel */}
        <motion.div
          layout
          className="glass-card-dark p-6 md:p-8 rounded-3xl border border-white/10"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedMode}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Mode-specific header */}
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br",
                  currentMode?.gradient
                )}>
                  {currentMode && <currentMode.icon className="w-7 h-7 text-white" />}
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">{currentMode?.name}</h2>
                  <p className="text-sm text-white/50">{currentMode?.description}</p>
                </div>
              </div>

              {/* Input Section based on mode */}
              <div className="space-y-4">
                {/* Image/Video Upload for modes that require it */}
                {(modeConfig?.requiresImage || modeConfig?.requiresVideo) && (
                  <div className="space-y-2">
                    <Label className="text-white/70">
                      {modeConfig.requiresVideo ? 'Upload Video' : 'Upload Image'}
                    </Label>
                    <div className="border-2 border-dashed border-white/20 rounded-2xl p-8 text-center hover:border-white/30 transition-colors cursor-pointer">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                          <Upload className="w-6 h-6 text-white/60" />
                        </div>
                        <div>
                          <p className="text-sm text-white/80">
                            Drag & drop or click to upload
                          </p>
                          <p className="text-xs text-white/40 mt-1">
                            {modeConfig.requiresVideo ? 'MP4, MOV up to 100MB' : 'PNG, JPG up to 10MB'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Text prompt */}
                {modeConfig?.requiresText && (
                  <div className="space-y-2">
                    <Label className="text-white/70">
                      {selectedMode === 'avatar' ? 'What should the avatar say?' : 'Describe your vision'}
                    </Label>
                    <Textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder={
                        selectedMode === 'text-to-video' 
                          ? "A cinematic drone shot over misty mountains at sunrise, golden light filtering through clouds..."
                          : selectedMode === 'avatar'
                          ? "Welcome to our product demo. Today I'll show you..."
                          : selectedMode === 'image-to-video'
                          ? "The character slowly turns to face the camera, wind blowing through their hair..."
                          : "Describe the motion or style you want..."
                      }
                      className="min-h-[120px] bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none rounded-xl"
                    />
                    <p className="text-xs text-white/40 text-right">
                      {prompt.length} characters
                    </p>
                  </div>
                )}

                {/* Style Presets for video-to-video */}
                {selectedMode === 'video-to-video' && (
                  <div className="space-y-3">
                    <Label className="text-white/70">Style Preset</Label>
                    <ScrollArea className="w-full">
                      <div className="flex gap-3 pb-2">
                        {STYLE_PRESETS.map((style) => (
                          <button
                            key={style.id}
                            onClick={() => setSelectedStyle(style.id)}
                            className={cn(
                              "flex-shrink-0 p-3 rounded-xl border transition-all text-left min-w-[120px]",
                              selectedStyle === style.id
                                ? "bg-white/15 border-white/30"
                                : "bg-white/5 border-white/10 hover:bg-white/10"
                            )}
                          >
                            <div className={cn(
                              "w-full aspect-video rounded-lg mb-2",
                              getStyleGradient(style.id)
                            )} />
                            <p className="text-xs font-medium text-white">{style.name}</p>
                          </button>
                        ))}
                      </div>
                      <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                  </div>
                )}

                {/* Voice Selection for avatar */}
                {selectedMode === 'avatar' && (
                  <div className="space-y-2">
                    <Label className="text-white/70">Voice</Label>
                    <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white">
                        <SelectValue placeholder="Select a voice" />
                      </SelectTrigger>
                      <SelectContent>
                        {AVATAR_VOICES.map((voice) => (
                          <SelectItem key={voice.id} value={voice.id}>
                            <div className="flex items-center gap-2">
                              <Mic className="w-3 h-3" />
                              <span>{voice.name}</span>
                              <span className="text-muted-foreground text-xs">• {voice.style}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="pt-4">
                <Button
                  size="xl"
                  variant="premium"
                  onClick={handleCreate}
                  disabled={!isReadyToCreate()}
                  className="w-full group relative overflow-hidden"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    Create {currentMode?.name}
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                  
                  {/* Animated gradient background */}
                  <div className="absolute inset-0 bg-gradient-to-r from-primary via-secondary to-primary bg-[length:200%_100%] animate-gradient-shift opacity-0 group-hover:opacity-100 transition-opacity" />
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Quick examples / inspiration */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8"
        >
          <h3 className="text-sm font-medium text-white/50 mb-4 flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Need inspiration? Try these prompts
          </h3>
          <div className="flex flex-wrap gap-2">
            {getExamplePrompts(selectedMode).map((example, i) => (
              <button
                key={i}
                onClick={() => setPrompt(example)}
                className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors"
              >
                {example.slice(0, 50)}...
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function getStyleGradient(style: VideoStylePreset): string {
  const gradients: Record<VideoStylePreset, string> = {
    'anime': 'bg-gradient-to-br from-pink-400 via-purple-400 to-blue-400',
    '3d-animation': 'bg-gradient-to-br from-amber-300 via-orange-400 to-red-400',
    'cyberpunk': 'bg-gradient-to-br from-cyan-500 via-purple-500 to-pink-500',
    'oil-painting': 'bg-gradient-to-br from-amber-600 via-orange-500 to-yellow-400',
    'watercolor': 'bg-gradient-to-br from-blue-300 via-teal-300 to-green-300',
    'claymation': 'bg-gradient-to-br from-amber-400 via-orange-300 to-rose-300',
    'noir': 'bg-gradient-to-br from-gray-900 via-gray-700 to-gray-500',
    'vintage-film': 'bg-gradient-to-br from-amber-200 via-orange-200 to-yellow-100',
    'comic-book': 'bg-gradient-to-br from-red-500 via-yellow-400 to-blue-500',
    'fantasy': 'bg-gradient-to-br from-violet-400 via-purple-500 to-fuchsia-400',
  };
  return gradients[style] || 'bg-gradient-to-br from-gray-400 to-gray-600';
}

function getExamplePrompts(mode: VideoGenerationMode): string[] {
  const prompts: Record<VideoGenerationMode, string[]> = {
    'text-to-video': [
      'A cinematic drone shot over misty mountains at golden hour, dramatic clouds and light rays',
      'A lone astronaut walking on Mars, red dust swirling in the wind, Earth visible in the sky',
      'An ancient library with floating books, magical particles of light, mystical atmosphere',
    ],
    'image-to-video': [
      'The portrait slowly comes to life, the subject blinking and looking around curiously',
      'Gentle wind blows through the scene, leaves rustling and light dappling',
      'The camera slowly pushes in while subtle movement brings the scene to life',
    ],
    'avatar': [
      'Hello and welcome! In this video, I will walk you through our amazing new product features',
      'Today we are going to learn about the fundamentals of machine learning in just 5 minutes',
      'Breaking news: Scientists have discovered something remarkable about the universe',
    ],
    'video-to-video': [
      'Transform into Studio Ghibli anime style with soft watercolor backgrounds',
      'Apply cyberpunk neon aesthetic with rain and holographic advertisements',
      'Convert to dramatic noir cinematography with high contrast shadows',
    ],
    'motion-transfer': [
      'Apply this dance routine to my character while maintaining their appearance',
      'Transfer the walking motion while preserving the original outfit and identity',
      'Apply professional presentation gestures to the avatar',
    ],
    'b-roll': [
      'Aerial view of ocean waves crashing on rocky coastline at sunset',
      'Time-lapse of city traffic at night with light trails',
      'Close-up of coffee being poured with steam rising, warm lighting',
    ],
  };
  return prompts[mode] || [];
}
