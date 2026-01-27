import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wand2, Image, User, Palette, Dices, Film, 
  Sparkles, Upload, Mic, ChevronRight, Play,
  Video, Layers, ArrowRight, RectangleHorizontal,
  Square, RectangleVertical, Clock, Hash, Music,
  Volume2, Settings2, X, CheckCircle2, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { CreationModeCard } from './CreationModeCard';
import { VideoGenerationMode, VIDEO_MODES, STYLE_PRESETS, VideoStylePreset, AVATAR_VOICES } from '@/types/video-modes';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useFileUpload } from '@/hooks/useFileUpload';
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

const ASPECT_RATIOS = [
  { id: '16:9', name: 'Landscape', icon: RectangleHorizontal, description: 'YouTube, TV' },
  { id: '9:16', name: 'Portrait', icon: RectangleVertical, description: 'TikTok, Reels' },
  { id: '1:1', name: 'Square', icon: Square, description: 'Instagram' },
];

const CLIP_DURATIONS = [
  { id: 5, name: '5 sec', description: 'Quick & punchy' },
  { id: 10, name: '10 sec', description: 'Standard length' },
];

interface CreationHubProps {
  onStartCreation: (config: {
    mode: VideoGenerationMode;
    prompt: string;
    style?: VideoStylePreset;
    voiceId?: string;
    imageUrl?: string;
    videoUrl?: string;
    aspectRatio: string;
    clipCount: number;
    clipDuration: number;
    enableNarration: boolean;
    enableMusic: boolean;
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
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  
  // File upload hooks
  const imageUpload = useFileUpload({ maxSizeMB: 10, allowedTypes: ['image/*'] });
  const videoUpload = useFileUpload({ maxSizeMB: 100, allowedTypes: ['video/*'] });
  
  // File input refs
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  
  // Production controls
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [clipCount, setClipCount] = useState(6);
  const [clipDuration, setClipDuration] = useState(5);
  const [enableNarration, setEnableNarration] = useState(true);
  const [enableMusic, setEnableMusic] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const currentMode = CREATION_MODES.find(m => m.id === selectedMode);
  const modeConfig = VIDEO_MODES.find(m => m.id === selectedMode);
  
  // Calculate estimated duration
  const estimatedDuration = clipCount * clipDuration;
  const estimatedMinutes = Math.floor(estimatedDuration / 60);
  const estimatedSeconds = estimatedDuration % 60;
  const estimatedCredits = clipCount * 10;

  // Handle file selection
  const handleImageSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const result = await imageUpload.uploadFile(file);
    if (result) {
      setUploadedImage(result.url);
      setUploadedFileName(file.name);
    }
  }, [imageUpload]);

  const handleVideoSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const result = await videoUpload.uploadFile(file);
    if (result) {
      setUploadedVideo(result.url);
      setUploadedFileName(file.name);
    }
  }, [videoUpload]);

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>, type: 'image' | 'video') => {
    e.preventDefault();
    e.stopPropagation();
    
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    
    if (type === 'image') {
      const result = await imageUpload.uploadFile(file);
      if (result) {
        setUploadedImage(result.url);
        setUploadedFileName(file.name);
      }
    } else {
      const result = await videoUpload.uploadFile(file);
      if (result) {
        setUploadedVideo(result.url);
        setUploadedFileName(file.name);
      }
    }
  }, [imageUpload, videoUpload]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const clearUpload = useCallback(() => {
    setUploadedImage(null);
    setUploadedVideo(null);
    setUploadedFileName(null);
  }, []);

  const handleCreate = () => {
    if (!prompt.trim() && modeConfig?.requiresText) return;
    
    onStartCreation({
      mode: selectedMode,
      prompt,
      style: selectedMode === 'video-to-video' ? selectedStyle : undefined,
      voiceId: selectedMode === 'avatar' ? selectedVoice : undefined,
      imageUrl: uploadedImage || undefined,
      videoUrl: uploadedVideo || undefined,
      aspectRatio,
      clipCount,
      clipDuration,
      enableNarration,
      enableMusic,
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 rounded-2xl bg-white/[0.08] border border-white/[0.1] flex items-center justify-center">
                    {currentMode && <currentMode.icon className="w-8 h-8 text-white" />}
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold text-white">{currentMode?.name}</h2>
                    <p className="text-sm text-white/40">{currentMode?.description}</p>
                  </div>
                </div>
                
                {/* Quick stats */}
                <div className="hidden md:flex items-center gap-6 text-sm">
                  <div className="text-center">
                    <p className="text-white/30 text-xs mb-1">Duration</p>
                    <p className="text-white font-medium">
                      {estimatedMinutes > 0 ? `${estimatedMinutes}m ${estimatedSeconds}s` : `${estimatedSeconds}s`}
                    </p>
                  </div>
                  <div className="w-px h-8 bg-white/10" />
                  <div className="text-center">
                    <p className="text-white/30 text-xs mb-1">Credits</p>
                    <p className="text-white font-medium">{estimatedCredits}</p>
                  </div>
                </div>
              </div>

              {/* Production Controls Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Aspect Ratio */}
                <div className="space-y-3 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                  <Label className="text-xs text-white/50 font-medium uppercase tracking-wider flex items-center gap-2">
                    <RectangleHorizontal className="w-3.5 h-3.5" />
                    Aspect Ratio
                  </Label>
                  <div className="flex gap-2">
                    {ASPECT_RATIOS.map((ratio) => (
                      <button
                        key={ratio.id}
                        onClick={() => setAspectRatio(ratio.id)}
                        className={cn(
                          "flex-1 flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all",
                          aspectRatio === ratio.id
                            ? "bg-white/[0.1] border-white/30"
                            : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05]"
                        )}
                      >
                        <ratio.icon className={cn(
                          "w-5 h-5",
                          aspectRatio === ratio.id ? "text-white" : "text-white/40"
                        )} />
                        <span className={cn(
                          "text-xs font-medium",
                          aspectRatio === ratio.id ? "text-white" : "text-white/50"
                        )}>{ratio.id}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Number of Clips */}
                <div className="space-y-3 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-white/50 font-medium uppercase tracking-wider flex items-center gap-2">
                      <Hash className="w-3.5 h-3.5" />
                      Clips
                    </Label>
                    <span className="text-lg font-semibold text-white">{clipCount}</span>
                  </div>
                  <Slider
                    value={[clipCount]}
                    onValueChange={([value]) => setClipCount(value)}
                    min={1}
                    max={20}
                    step={1}
                    className="py-2"
                  />
                  <p className="text-xs text-white/30">1-20 clips per video</p>
                </div>

                {/* Clip Duration */}
                <div className="space-y-3 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                  <Label className="text-xs text-white/50 font-medium uppercase tracking-wider flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" />
                    Clip Duration
                  </Label>
                  <div className="flex gap-2">
                    {CLIP_DURATIONS.map((duration) => (
                      <button
                        key={duration.id}
                        onClick={() => setClipDuration(duration.id)}
                        className={cn(
                          "flex-1 flex flex-col items-center gap-1 p-3 rounded-xl border transition-all",
                          clipDuration === duration.id
                            ? "bg-white/[0.1] border-white/30"
                            : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05]"
                        )}
                      >
                        <span className={cn(
                          "text-sm font-semibold",
                          clipDuration === duration.id ? "text-white" : "text-white/50"
                        )}>{duration.name}</span>
                        <span className="text-xs text-white/30">{duration.description}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Audio Options */}
                <div className="space-y-4 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                  <Label className="text-xs text-white/50 font-medium uppercase tracking-wider flex items-center gap-2">
                    <Volume2 className="w-3.5 h-3.5" />
                    Audio
                  </Label>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Mic className="w-4 h-4 text-white/40" />
                        <span className="text-sm text-white/70">Narration</span>
                      </div>
                      <Switch
                        checked={enableNarration}
                        onCheckedChange={setEnableNarration}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Music className="w-4 h-4 text-white/40" />
                        <span className="text-sm text-white/70">Music</span>
                      </div>
                      <Switch
                        checked={enableMusic}
                        onCheckedChange={setEnableMusic}
                      />
                    </div>
                  </div>
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
                    
                    {/* Hidden file inputs */}
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                    <input
                      ref={videoInputRef}
                      type="file"
                      accept="video/*"
                      onChange={handleVideoSelect}
                      className="hidden"
                    />
                    
                    {/* Upload area or preview */}
                    {(uploadedImage || uploadedVideo) ? (
                      <div className="relative rounded-2xl overflow-hidden border border-white/[0.1] bg-white/[0.02]">
                        {uploadedImage && (
                          <img 
                            src={uploadedImage} 
                            alt="Uploaded" 
                            className="w-full h-48 object-cover"
                          />
                        )}
                        {uploadedVideo && (
                          <video 
                            src={uploadedVideo} 
                            className="w-full h-48 object-cover"
                            controls
                          />
                        )}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-green-400" />
                              <span className="text-sm text-white/80 truncate max-w-[200px]">
                                {uploadedFileName}
                              </span>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={clearUpload}
                              className="text-white/60 hover:text-white hover:bg-white/10"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div 
                        onClick={() => modeConfig?.requiresVideo ? videoInputRef.current?.click() : imageInputRef.current?.click()}
                        onDrop={(e) => handleDrop(e, modeConfig?.requiresVideo ? 'video' : 'image')}
                        onDragOver={handleDragOver}
                        className={cn(
                          "border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer group",
                          (imageUpload.isUploading || videoUpload.isUploading)
                            ? "border-white/30 bg-white/[0.05]"
                            : "border-white/[0.1] hover:border-white/20 hover:bg-white/[0.02]"
                        )}
                      >
                        <div className="flex flex-col items-center gap-4">
                          <div className="w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/[0.1] flex items-center justify-center group-hover:bg-white/[0.1] transition-colors">
                            {(imageUpload.isUploading || videoUpload.isUploading) ? (
                              <Loader2 className="w-6 h-6 text-white/70 animate-spin" />
                            ) : (
                              <Upload className="w-6 h-6 text-white/50 group-hover:text-white/70 transition-colors" />
                            )}
                          </div>
                          <div>
                            {(imageUpload.isUploading || videoUpload.isUploading) ? (
                              <>
                                <p className="text-sm text-white/70 font-medium">
                                  Uploading... {imageUpload.progress || videoUpload.progress}%
                                </p>
                                <div className="w-48 h-1.5 bg-white/10 rounded-full mt-3 mx-auto overflow-hidden">
                                  <div 
                                    className="h-full bg-white/60 rounded-full transition-all"
                                    style={{ width: `${imageUpload.progress || videoUpload.progress}%` }}
                                  />
                                </div>
                              </>
                            ) : (
                              <>
                                <p className="text-sm text-white/70 font-medium">
                                  Drag & drop or click to upload
                                </p>
                                <p className="text-xs text-white/30 mt-1">
                                  {modeConfig?.requiresVideo ? 'MP4, MOV up to 100MB' : 'PNG, JPG up to 10MB'}
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
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

              {/* Summary & Action */}
              <div className="pt-4 space-y-4">
                {/* Summary bar */}
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08]">
                    <RectangleHorizontal className="w-3.5 h-3.5 text-white/50" />
                    <span className="text-white/70">{aspectRatio}</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08]">
                    <Hash className="w-3.5 h-3.5 text-white/50" />
                    <span className="text-white/70">{clipCount} clips</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08]">
                    <Clock className="w-3.5 h-3.5 text-white/50" />
                    <span className="text-white/70">{clipDuration}s each</span>
                  </div>
                  {enableNarration && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08]">
                      <Mic className="w-3.5 h-3.5 text-white/50" />
                      <span className="text-white/70">Narration</span>
                    </div>
                  )}
                  {enableMusic && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08]">
                      <Music className="w-3.5 h-3.5 text-white/50" />
                      <span className="text-white/70">Music</span>
                    </div>
                  )}
                </div>
                
                {/* Create Button */}
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
                    Create {currentMode?.name} • {estimatedCredits} credits
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
    'hyperreal': 'bg-gradient-to-br from-slate-600 via-blue-600 to-teal-500',
    'surrealist': 'bg-gradient-to-br from-amber-300 via-sky-400 to-amber-200',
    'ukiyo-e': 'bg-gradient-to-br from-blue-800 via-red-700 to-slate-200',
    'art-deco': 'bg-gradient-to-br from-yellow-500 via-zinc-900 to-teal-600',
    'gothic': 'bg-gradient-to-br from-zinc-900 via-purple-900 to-red-900',
    'solarpunk': 'bg-gradient-to-br from-green-400 via-yellow-400 to-sky-400',
    'baroque': 'bg-gradient-to-br from-red-900 via-amber-600 to-yellow-700',
    'synthwave': 'bg-gradient-to-br from-pink-500 via-purple-600 to-cyan-500',
    'impressionist': 'bg-gradient-to-br from-sky-300 via-green-300 to-pink-300',
    'cel-shaded': 'bg-gradient-to-br from-orange-500 via-cyan-500 to-pink-500',
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
