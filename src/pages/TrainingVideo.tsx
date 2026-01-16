import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, User, Mic, Image, Play, Loader2, Check,
  Volume2, Sparkles, ArrowRight, RefreshCw, Download,
  Video, AlertCircle, Trash2, Pause, Square
} from 'lucide-react';

// Import environment presets
import goldenHourStudioImg from '@/assets/environments/golden-hour-studio.jpg';
import neonNoirCityImg from '@/assets/environments/neon-noir-city.jpg';
import coastalSerenityImg from '@/assets/environments/coastal-serenity.jpg';
import forestMystiqueImg from '@/assets/environments/forest-mystique.jpg';
import modernMinimalistImg from '@/assets/environments/modern-minimalist.jpg';
import alpineDawnImg from '@/assets/environments/alpine-dawn.jpg';
import cozyFirelightImg from '@/assets/environments/cozy-firelight.jpg';
import overcastDramaImg from '@/assets/environments/overcast-drama.jpg';

// Voice options from OpenAI TTS
const VOICE_OPTIONS = [
  { id: 'nova', name: 'Nova', gender: 'female', description: 'Warm, professional' },
  { id: 'alloy', name: 'Alloy', gender: 'neutral', description: 'Versatile, clear' },
  { id: 'echo', name: 'Echo', gender: 'male', description: 'Friendly, warm' },
  { id: 'fable', name: 'Fable', gender: 'male', description: 'Expressive, storyteller' },
  { id: 'onyx', name: 'Onyx', gender: 'male', description: 'Deep, authoritative' },
  { id: 'shimmer', name: 'Shimmer', gender: 'female', description: 'Soft, gentle' },
];

// Background presets
const BACKGROUND_PRESETS = [
  { id: 'golden_hour_studio', name: 'Golden Hour Studio', image: goldenHourStudioImg },
  { id: 'modern_minimalist', name: 'Modern Minimalist', image: modernMinimalistImg },
  { id: 'neon_noir_city', name: 'Neon Noir', image: neonNoirCityImg },
  { id: 'coastal_serenity', name: 'Coastal Serenity', image: coastalSerenityImg },
  { id: 'forest_mystique', name: 'Forest Mystique', image: forestMystiqueImg },
  { id: 'alpine_dawn', name: 'Alpine Dawn', image: alpineDawnImg },
  { id: 'cozy_firelight', name: 'Cozy Firelight', image: cozyFirelightImg },
  { id: 'overcast_drama', name: 'Overcast Drama', image: overcastDramaImg },
];

type GenerationStep = 'idle' | 'generating_audio' | 'generating_video' | 'applying_lipsync' | 'complete' | 'error';

export default function TrainingVideo() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // State
  const [characterImage, setCharacterImage] = useState<string | null>(null);
  const [characterImageFile, setCharacterImageFile] = useState<File | null>(null);
  const [customBackground, setCustomBackground] = useState<string | null>(null);
  const [selectedBackground, setSelectedBackground] = useState<string | null>('modern_minimalist');
  const [selectedVoice, setSelectedVoice] = useState<string>('nova');
  const [scriptText, setScriptText] = useState('');
  const [generationStep, setGenerationStep] = useState<GenerationStep>('idle');
  const [progress, setProgress] = useState(0);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPreviewingVoice, setIsPreviewingVoice] = useState(false);
  
  const characterInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Handle character image upload
  const handleCharacterUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be less than 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setCharacterImage(e.target?.result as string);
      setCharacterImageFile(file);
    };
    reader.readAsDataURL(file);
    toast.success('Character image uploaded');
  }, []);

  // Handle background image upload
  const handleBackgroundUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setCustomBackground(e.target?.result as string);
      setSelectedBackground(null);
    };
    reader.readAsDataURL(file);
    toast.success('Custom background uploaded');
  }, []);

  // Preview voice
  const handleVoicePreview = async () => {
    if (isPreviewingVoice) return;
    
    setIsPreviewingVoice(true);
    try {
      const previewText = scriptText.slice(0, 100) || 'Hello, this is a voice preview for your training video.';
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-voice`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            text: previewText,
            voiceId: selectedVoice,
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to generate voice preview');
      
      const data = await response.json();
      if (data.audioContent) {
        const audioUrl = `data:audio/mpeg;base64,${data.audioContent}`;
        const audio = new Audio(audioUrl);
        audio.onended = () => setIsPreviewingVoice(false);
        await audio.play();
      }
    } catch (err) {
      console.error('Voice preview error:', err);
      toast.error('Failed to preview voice');
      setIsPreviewingVoice(false);
    }
  };

  // Generate training video
  const handleGenerate = async () => {
    if (!characterImage || !scriptText.trim()) {
      toast.error('Please upload a character image and enter script text');
      return;
    }

    if (!user) {
      toast.error('Please sign in to generate videos');
      return;
    }

    setGenerationStep('generating_audio');
    setProgress(0);
    setError(null);
    setGeneratedVideoUrl(null);

    try {
      // Step 1: Generate audio from text (30%)
      toast.info('Generating voice audio...');
      setProgress(10);
      
      const audioResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-voice`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            text: scriptText,
            voiceId: selectedVoice,
          }),
        }
      );

      if (!audioResponse.ok) throw new Error('Failed to generate audio');
      
      const audioData = await audioResponse.json();
      if (!audioData.audioContent) throw new Error('No audio content received');
      
      const audioUrl = `data:audio/mpeg;base64,${audioData.audioContent}`;
      setGeneratedAudioUrl(audioUrl);
      setProgress(30);

      // Step 2: Generate video with character image (60%)
      setGenerationStep('generating_video');
      toast.info('Generating character video...');
      
      // Get background image URL
      const backgroundUrl = customBackground || 
        BACKGROUND_PRESETS.find(b => b.id === selectedBackground)?.image || 
        modernMinimalistImg;

      // Upload character image to get a URL for video generation
      const imageBase64 = characterImage.split(',')[1];
      
      const { data: videoData, error: videoError } = await supabase.functions.invoke('generate-video', {
        body: {
          prompt: `Professional talking head video. A person speaking directly to camera in a ${selectedBackground || 'professional studio'} setting. Natural head movements, professional presentation style, corporate training video aesthetic. The person is delivering an educational presentation with confident body language.`,
          imageUrl: characterImage,
          imageBase64,
          aspectRatio: '16:9',
          duration: Math.min(Math.ceil(scriptText.length / 15), 10), // Estimate duration based on text length
          userId: user.id,
        },
      });

      if (videoError) throw videoError;
      if (!videoData?.videoUrl) throw new Error('No video URL received');
      
      setProgress(60);

      // Step 3: Apply lip sync (90%)
      setGenerationStep('applying_lipsync');
      toast.info('Applying lip synchronization...');

      // Note: Lip sync requires the self-hosted service to be configured
      // For now, we'll use the video without lip sync if the service isn't available
      try {
        const { data: lipSyncData, error: lipSyncError } = await supabase.functions.invoke('lip-sync-service', {
          body: {
            videoUrl: videoData.videoUrl,
            audioUrl: audioData.storageUrl || audioUrl,
            userId: user.id,
            quality: 'balanced',
          },
        });

        if (!lipSyncError && lipSyncData?.outputVideoUrl) {
          setGeneratedVideoUrl(lipSyncData.outputVideoUrl);
        } else {
          // Fallback: use video without lip sync
          console.warn('Lip sync not available, using original video');
          setGeneratedVideoUrl(videoData.videoUrl);
        }
      } catch (lipSyncErr) {
        console.warn('Lip sync service not available:', lipSyncErr);
        setGeneratedVideoUrl(videoData.videoUrl);
      }

      setProgress(100);
      setGenerationStep('complete');
      toast.success('Training video generated successfully!');

    } catch (err) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate video');
      setGenerationStep('error');
      toast.error('Failed to generate training video');
    }
  };

  // Reset form
  const handleReset = () => {
    setCharacterImage(null);
    setCharacterImageFile(null);
    setCustomBackground(null);
    setSelectedBackground('modern_minimalist');
    setSelectedVoice('nova');
    setScriptText('');
    setGenerationStep('idle');
    setProgress(0);
    setGeneratedVideoUrl(null);
    setGeneratedAudioUrl(null);
    setError(null);
  };

  const isGenerating = ['generating_audio', 'generating_video', 'applying_lipsync'].includes(generationStep);
  const canGenerate = characterImage && scriptText.trim() && !isGenerating;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader showCreate={false} />
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div 
          className="text-center mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
            <Video className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-2">
            Training Video Studio
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Create professional training videos with AI-powered lip sync. Upload your character, choose a voice, and let AI do the rest.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column: Inputs */}
          <div className="space-y-6">
            {/* Character Image Upload */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Label className="text-sm font-medium mb-3 flex items-center gap-2">
                <User className="w-4 h-4" />
                Character Image
              </Label>
              <Card 
                className={cn(
                  "p-6 border-2 border-dashed cursor-pointer transition-all hover:border-primary/50",
                  characterImage ? "border-primary/30 bg-primary/5" : "border-muted-foreground/30"
                )}
                onClick={() => characterInputRef.current?.click()}
              >
                {characterImage ? (
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-24 rounded-xl overflow-hidden bg-muted">
                      <img src={characterImage} alt="Character" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Check className="w-4 h-4 text-primary" />
                        <span className="font-medium text-sm">Character Uploaded</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Click to replace</p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); setCharacterImage(null); }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="font-medium text-sm mb-1">Upload Character Image</p>
                    <p className="text-xs text-muted-foreground">PNG, JPG up to 10MB</p>
                  </div>
                )}
              </Card>
              <input
                ref={characterInputRef}
                type="file"
                accept="image/*"
                onChange={handleCharacterUpload}
                className="hidden"
              />
            </motion.div>

            {/* Voice Selection */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Label className="text-sm font-medium mb-3 flex items-center gap-2">
                <Mic className="w-4 h-4" />
                Voice Selection
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {VOICE_OPTIONS.map((voice) => (
                  <button
                    key={voice.id}
                    onClick={() => setSelectedVoice(voice.id)}
                    className={cn(
                      "p-3 rounded-xl border text-left transition-all",
                      selectedVoice === voice.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{voice.name}</span>
                      {selectedVoice === voice.id && (
                        <Check className="w-4 h-4 text-primary" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{voice.description}</p>
                    <Badge variant="outline" className="mt-1 text-xs">
                      {voice.gender}
                    </Badge>
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={handleVoicePreview}
                disabled={isPreviewingVoice}
              >
                {isPreviewingVoice ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Volume2 className="w-4 h-4 mr-2" />
                )}
                Preview Voice
              </Button>
            </motion.div>

            {/* Background Selection */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Label className="text-sm font-medium mb-3 flex items-center gap-2">
                <Image className="w-4 h-4" />
                Background
              </Label>
              <ScrollArea className="w-full">
                <div className="flex gap-2 pb-2">
                  {/* Custom upload option */}
                  <button
                    onClick={() => backgroundInputRef.current?.click()}
                    className={cn(
                      "w-20 h-20 rounded-xl border-2 border-dashed flex-shrink-0 flex items-center justify-center transition-all",
                      customBackground ? "border-primary" : "border-muted-foreground/30 hover:border-primary/50"
                    )}
                  >
                    {customBackground ? (
                      <img src={customBackground} alt="Custom" className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <Upload className="w-5 h-5 text-muted-foreground" />
                    )}
                  </button>
                  
                  {BACKGROUND_PRESETS.map((bg) => (
                    <button
                      key={bg.id}
                      onClick={() => { setSelectedBackground(bg.id); setCustomBackground(null); }}
                      className={cn(
                        "w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all",
                        selectedBackground === bg.id && !customBackground
                          ? "border-primary ring-2 ring-primary/20"
                          : "border-transparent hover:border-primary/50"
                      )}
                    >
                      <img src={bg.image} alt={bg.name} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </ScrollArea>
              <input
                ref={backgroundInputRef}
                type="file"
                accept="image/*"
                onChange={handleBackgroundUpload}
                className="hidden"
              />
            </motion.div>

            {/* Script Text */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Label className="text-sm font-medium mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Script Text
                </span>
                <span className="text-xs text-muted-foreground">{scriptText.length} characters</span>
              </Label>
              <Textarea
                placeholder="Enter the text your character will speak..."
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                className="min-h-[150px] resize-none"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Recommended: 50-500 characters for best results
              </p>
            </motion.div>
          </div>

          {/* Right Column: Preview & Generation */}
          <div className="space-y-6">
            {/* Preview Area */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Label className="text-sm font-medium mb-3">Preview</Label>
              <Card className="aspect-video bg-muted/50 overflow-hidden relative">
                <AnimatePresence mode="wait">
                  {generatedVideoUrl ? (
                    <motion.video
                      key="video"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      src={generatedVideoUrl}
                      controls
                      className="w-full h-full object-cover"
                    />
                  ) : characterImage ? (
                    <motion.div
                      key="preview"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="relative w-full h-full"
                    >
                      {/* Background */}
                      <img 
                        src={customBackground || BACKGROUND_PRESETS.find(b => b.id === selectedBackground)?.image || modernMinimalistImg}
                        alt="Background"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/20" />
                      
                      {/* Character overlay (centered) */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-48 h-48 rounded-full overflow-hidden border-4 border-white/20 shadow-2xl">
                          <img src={characterImage} alt="Character" className="w-full h-full object-cover" />
                        </div>
                      </div>
                      
                      {/* Generation overlay */}
                      {isGenerating && (
                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                          <Loader2 className="w-12 h-12 text-white animate-spin mb-4" />
                          <p className="text-white font-medium mb-2">
                            {generationStep === 'generating_audio' && 'Generating voice audio...'}
                            {generationStep === 'generating_video' && 'Creating character video...'}
                            {generationStep === 'applying_lipsync' && 'Applying lip sync...'}
                          </p>
                          <Progress value={progress} className="w-48 h-2" />
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center justify-center h-full text-muted-foreground"
                    >
                      <Video className="w-16 h-16 mb-3 opacity-30" />
                      <p className="text-sm">Upload a character to preview</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Error state */}
                {generationStep === 'error' && (
                  <div className="absolute inset-0 bg-destructive/10 flex flex-col items-center justify-center">
                    <AlertCircle className="w-12 h-12 text-destructive mb-3" />
                    <p className="text-destructive font-medium mb-2">Generation Failed</p>
                    <p className="text-sm text-muted-foreground mb-4">{error}</p>
                    <Button variant="outline" size="sm" onClick={() => setGenerationStep('idle')}>
                      Try Again
                    </Button>
                  </div>
                )}
              </Card>
            </motion.div>

            {/* Action Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-3"
            >
              {generationStep === 'complete' ? (
                <>
                  <Button className="w-full h-12" asChild>
                    <a href={generatedVideoUrl || '#'} download="training-video.mp4">
                      <Download className="w-5 h-5 mr-2" />
                      Download Video
                    </a>
                  </Button>
                  <Button variant="outline" className="w-full" onClick={handleReset}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Create Another Video
                  </Button>
                </>
              ) : (
                <Button 
                  className="w-full h-12"
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5 mr-2" />
                      Generate Training Video
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              )}
            </motion.div>

            {/* Tips */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <Card className="p-4 bg-muted/30">
                <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Tips for Best Results
                </h4>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Use a front-facing character image with visible face</li>
                  <li>• Keep script between 50-500 characters for optimal quality</li>
                  <li>• Choose a voice that matches your character's appearance</li>
                  <li>• High-resolution character images produce better results</li>
                </ul>
              </Card>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}
