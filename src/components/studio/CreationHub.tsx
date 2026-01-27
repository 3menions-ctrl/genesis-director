import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wand2, Image, User, Palette, Dices, Film, 
  Sparkles, Upload, Mic, ChevronRight, Play,
  Video, Layers, ArrowRight
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
    popular: true,
  },
  {
    id: 'image-to-video' as VideoGenerationMode,
    name: 'Animate Image',
    description: 'Bring any photo or artwork to life',
    icon: Image,
    popular: true,
  },
  {
    id: 'avatar' as VideoGenerationMode,
    name: 'AI Avatar',
    description: 'Talking heads with perfect lip sync',
    icon: User,
    popular: true,
    isNew: true,
  },
  {
    id: 'video-to-video' as VideoGenerationMode,
    name: 'Style Transfer',
    description: 'Transform videos into any style',
    icon: Palette,
    isNew: true,
  },
  {
    id: 'motion-transfer' as VideoGenerationMode,
    name: 'Motion Transfer',
    description: 'Apply dance moves to any character',
    icon: Dices,
    isNew: true,
  },
  {
    id: 'b-roll' as VideoGenerationMode,
    name: 'B-Roll',
    description: 'Quick background footage from prompts',
    icon: Film,
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
        {/* Header - Premium minimal */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.05] border border-white/[0.08] mb-6"
          >
            <Sparkles className="w-4 h-4 text-white/60" />
            <span className="text-sm text-white/60 font-medium">AI Video Creation</span>
          </motion.div>
          
          <h1 className="text-4xl md:text-6xl font-display font-bold text-white mb-5 tracking-tight">
            What will you create?
          </h1>
          <p className="text-lg text-white/40 max-w-xl mx-auto">
            Choose your creation mode and bring your vision to life
          </p>
        </motion.div>

        {/* Mode Selection Grid - Clean minimal cards */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-12"
        >
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
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
                delay={index}
              />
            ))}
          </div>
        </motion.div>

        {/* Configuration Panel - Premium glass */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          layout
          className="relative p-8 md:p-10 rounded-3xl bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] overflow-hidden"
        >
          {/* Subtle inner glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] via-transparent to-transparent pointer-events-none" />
          
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedMode}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="relative space-y-8"
            >
              {/* Mode header */}
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 rounded-2xl bg-white/[0.08] border border-white/[0.1] flex items-center justify-center">
                  {currentMode && <currentMode.icon className="w-8 h-8 text-white" />}
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-white">{currentMode?.name}</h2>
                  <p className="text-sm text-white/40">{currentMode?.description}</p>
                </div>
              </div>

              {/* Input Section based on mode */}
              <div className="space-y-6">
                {/* Image/Video Upload for modes that require it */}
                {(modeConfig?.requiresImage || modeConfig?.requiresVideo) && (
                  <div className="space-y-3">
                    <Label className="text-sm text-white/60 font-medium">
                      {modeConfig.requiresVideo ? 'Upload Video' : 'Upload Image'}
                    </Label>
                    <div className="border-2 border-dashed border-white/[0.1] rounded-2xl p-10 text-center hover:border-white/20 hover:bg-white/[0.02] transition-all cursor-pointer group">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/[0.1] flex items-center justify-center group-hover:bg-white/[0.1] transition-colors">
                          <Upload className="w-6 h-6 text-white/50 group-hover:text-white/70 transition-colors" />
                        </div>
                        <div>
                          <p className="text-sm text-white/70 font-medium">
                            Drag & drop or click to upload
                          </p>
                          <p className="text-xs text-white/30 mt-1">
                            {modeConfig.requiresVideo ? 'MP4, MOV up to 100MB' : 'PNG, JPG up to 10MB'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Text prompt */}
                {modeConfig?.requiresText && (
                  <div className="space-y-3">
                    <Label className="text-sm text-white/60 font-medium">
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
                      className="min-h-[140px] bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/25 resize-none rounded-xl focus:border-white/20 focus:ring-white/10 text-base"
                    />
                    <p className="text-xs text-white/30 text-right">
                      {prompt.length} characters
                    </p>
                  </div>
                )}

                {/* Style Presets for video-to-video */}
                {selectedMode === 'video-to-video' && (
                  <div className="space-y-3">
                    <Label className="text-sm text-white/60 font-medium">Style Preset</Label>
                    <ScrollArea className="w-full">
                      <div className="flex gap-3 pb-2">
                        {STYLE_PRESETS.map((style) => (
                          <button
                            key={style.id}
                            onClick={() => setSelectedStyle(style.id)}
                            className={cn(
                              "flex-shrink-0 p-4 rounded-xl border transition-all text-left min-w-[140px]",
                              selectedStyle === style.id
                                ? "bg-white/[0.08] border-white/30"
                                : "bg-white/[0.02] border-white/[0.08] hover:bg-white/[0.05]"
                            )}
                          >
                            <div className={cn(
                              "w-full aspect-video rounded-lg mb-3",
                              getStyleGradient(style.id)
                            )} />
                            <p className="text-sm font-medium text-white">{style.name}</p>
                            <p className="text-xs text-white/40 mt-0.5">{style.description}</p>
                          </button>
                        ))}
                      </div>
                      <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                  </div>
                )}

                {/* Voice Selection for avatar */}
                {selectedMode === 'avatar' && (
                  <div className="space-y-3">
                    <Label className="text-sm text-white/60 font-medium">Voice</Label>
                    <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                      <SelectTrigger className="bg-white/[0.03] border-white/[0.08] text-white h-12 rounded-xl">
                        <SelectValue placeholder="Select a voice" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-white/10">
                        {AVATAR_VOICES.map((voice) => (
                          <SelectItem key={voice.id} value={voice.id} className="text-white focus:bg-white/10 focus:text-white">
                            <div className="flex items-center gap-3">
                              <Mic className="w-4 h-4 text-white/50" />
                              <span className="font-medium">{voice.name}</span>
                              <span className="text-white/40 text-sm">• {voice.style}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Action Button - Premium white */}
              <div className="pt-4">
                <Button
                  size="xl"
                  onClick={handleCreate}
                  disabled={!isReadyToCreate()}
                  className={cn(
                    "w-full h-14 text-base font-semibold rounded-2xl transition-all duration-300 group",
                    "bg-white text-black hover:bg-white/90",
                    "shadow-[0_0_40px_rgba(255,255,255,0.1)]",
                    "hover:shadow-[0_0_60px_rgba(255,255,255,0.15)]",
                    "disabled:opacity-40 disabled:shadow-none"
                  )}
                >
                  <span className="flex items-center gap-3">
                    <Sparkles className="w-5 h-5" />
                    Create {currentMode?.name}
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Inspiration prompts - Subtle */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-10"
        >
          <h3 className="text-sm font-medium text-white/30 mb-4 flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Need inspiration? Try these prompts
          </h3>
          <div className="flex flex-wrap gap-2">
            {getExamplePrompts(selectedMode).map((example, i) => (
              <button
                key={i}
                onClick={() => setPrompt(example)}
                className="px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.08] text-xs text-white/50 hover:bg-white/[0.06] hover:text-white/70 hover:border-white/15 transition-all"
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
    'noir': 'bg-gradient-to-br from-zinc-900 via-zinc-700 to-zinc-500',
    'vintage-film': 'bg-gradient-to-br from-amber-200 via-orange-200 to-yellow-100',
    'comic-book': 'bg-gradient-to-br from-red-500 via-yellow-400 to-blue-500',
    'fantasy': 'bg-gradient-to-br from-violet-400 via-purple-500 to-fuchsia-400',
  };
  return gradients[style] || 'bg-gradient-to-br from-zinc-400 to-zinc-600';
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
