import { useState, useRef, useCallback, useEffect, memo, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import {
  Wand2, Image as ImageIcon, User, Film, Coins, Sparkles, Upload,
  ChevronRight, RectangleHorizontal, Square, RectangleVertical,
  Clock, Hash, Mic, ChevronDown, X, CheckCircle2, Loader2,
  ArrowRight, Layers, Settings2,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { saveDraft, loadDraft } from '@/lib/sessionPersistence';
import { calculateCreditsRequired } from '@/lib/creditSystem';
import { useNavigationWithLoading } from '@/components/navigation';
import { ActiveProjectBanner } from './ActiveProjectBanner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { checkMultipleContent } from '@/lib/contentSafety';
import { toast } from 'sonner';
import { VideoGenerationMode, VIDEO_MODES, VideoStylePreset } from '@/types/video-modes';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useAuth } from '@/contexts/AuthContext';
import { useTemplateEnvironment } from '@/hooks/useTemplateEnvironment';
import { useTierLimits } from '@/hooks/useTierLimits';
import { SimpleVideoPlayer } from '@/components/player';
import { TemplateAvatarSelector } from './TemplateAvatarSelector';
import { AvatarTemplate } from '@/types/avatar-templates';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { BuyCreditsModal } from '@/components/credits/BuyCreditsModal';

// ─── Mode catalog ─────────────────────────────────────────────────────────────
const CREATION_MODES = [
  { id: 'text-to-video' as VideoGenerationMode, name: 'Cinematic',     icon: Wand2,     hint: 'Generate from text' },
  { id: 'image-to-video' as VideoGenerationMode, name: 'Animate',      icon: ImageIcon, hint: 'Bring an image to life' },
  { id: 'avatar' as VideoGenerationMode,         name: 'Avatar',       icon: User,      hint: 'Talking presenter' },
];

const ASPECT_RATIOS = [
  { id: '16:9', icon: RectangleHorizontal, label: 'Wide' },
  { id: '9:16', icon: RectangleVertical,   label: 'Tall' },
  { id: '1:1',  icon: Square,              label: 'Square' },
];

const CLIP_DURATIONS = [5, 10, 15];

const GENRE_OPTIONS = [
  { value: 'cinematic',     label: 'Cinematic' },
  { value: 'documentary',   label: 'Documentary' },
  { value: 'ad',            label: 'Commercial' },
  { value: 'educational',   label: 'Educational' },
  { value: 'storytelling',  label: 'Narrative' },
  { value: 'motivational',  label: 'Motivational' },
];

const MOOD_OPTIONS = [
  { value: 'epic',       label: 'Epic' },
  { value: 'tension',    label: 'Suspense' },
  { value: 'emotional',  label: 'Emotional' },
  { value: 'action',     label: 'Action' },
  { value: 'mysterious', label: 'Mystery' },
  { value: 'uplifting',  label: 'Uplifting' },
  { value: 'dark',       label: 'Dark' },
  { value: 'romantic',   label: 'Romantic' },
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
    genre?: string;
    mood?: string;
    videoEngine?: 'kling' | 'veo';
    isBreakout?: boolean;
    breakoutStartImageUrl?: string;
    breakoutPlatform?: string;
    avatarImageUrl?: string;
    avatarVoiceId?: string;
    avatarTemplateId?: string;
    avatarName?: string;
  }) => void;
  onReady?: () => void;
  className?: string;
}

export const CreationHub = memo(function CreationHub({ onStartCreation, onReady, className }: CreationHubProps) {
  const { navigateTo: navigate } = useNavigationWithLoading();
  const { profile } = useAuth();

  const [selectedMode, setSelectedMode] = useState<VideoGenerationMode>('text-to-video');
  const [prompt, setPrompt] = useState('');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedVideo, setUploadedVideo] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [showBuyCredits, setShowBuyCredits] = useState(false);

  const { appliedSettings, isLoading: templateLoading, templateId } = useTemplateEnvironment();

  const imageUpload = useFileUpload({ maxSizeMB: 10, allowedTypes: ['image/*'] });
  const videoUpload = useFileUpload({ maxSizeMB: 100, allowedTypes: ['video/*'] });
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [clipDuration, setClipDuration] = useState(5);
  const [enableNarration, setEnableNarration] = useState(true);
  const [enableMusic] = useState(false);

  const [selectedAvatar, setSelectedAvatar] = useState<AvatarTemplate | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [genre, setGenre] = useState('cinematic');
  const [mood, setMood] = useState('epic');

  const isBreakoutTemplate = appliedSettings?.isBreakout === true;
  const { maxClips, isLoading: tierLoading } = useTierLimits();
  const [clipCount, setClipCount] = useState(5);

  const hasSignaledReady = useRef(false);
  useEffect(() => {
    if (!templateLoading && !tierLoading && !hasSignaledReady.current) {
      hasSignaledReady.current = true;
      onReady?.();
    }
  }, [templateLoading, tierLoading, onReady]);

  useEffect(() => {
    if (maxClips && clipCount > maxClips) setClipCount(maxClips);
  }, [maxClips, clipCount]);

  // Apply template settings
  useEffect(() => {
    if (appliedSettings) {
      if (appliedSettings.concept) setPrompt(appliedSettings.concept);
      if (appliedSettings.clipCount) setClipCount(Math.min(appliedSettings.clipCount, maxClips));
      if (appliedSettings.mood) setMood(appliedSettings.mood);
      if (appliedSettings.genre) setGenre(appliedSettings.genre);
      if (appliedSettings.colorGrading || appliedSettings.environmentPrompt) setShowAdvanced(true);
    }
  }, [appliedSettings, maxClips]);

  // Restore draft
  const hasRestoredDraft = useRef(false);
  useEffect(() => {
    if (hasRestoredDraft.current || templateId) return;
    hasRestoredDraft.current = true;
    const draft = loadDraft();
    if (draft) {
      if (draft.prompt) setPrompt(draft.prompt);
      if (draft.mode) setSelectedMode(draft.mode as VideoGenerationMode);
      if (draft.aspectRatio) setAspectRatio(draft.aspectRatio);
      if (draft.clipCount) setClipCount(Math.min(draft.clipCount, maxClips));
      if (draft.clipDuration) setClipDuration(draft.clipDuration);
      if (draft.genre) setGenre(draft.genre);
      if (draft.mood) setMood(draft.mood);
      if (draft.enableNarration !== undefined) setEnableNarration(draft.enableNarration);
      if (draft.imageUrl) setUploadedImage(draft.imageUrl);
    }
  }, [templateId, maxClips]);

  // Picked-up image from photo editor
  useEffect(() => {
    const imageFromEditor = sessionStorage.getItem('imageToVideoUrl');
    if (imageFromEditor) {
      sessionStorage.removeItem('imageToVideoUrl');
      setSelectedMode('image-to-video');
      setUploadedImage(imageFromEditor);
      setUploadedFileName('Edited Photo');
    }
  }, []);

  // Autosave draft
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      saveDraft({
        mode: selectedMode, prompt, aspectRatio, clipCount, clipDuration, genre, mood,
        enableNarration, enableMusic: false, imageUrl: uploadedImage || undefined,
      });
    }, 1500);
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
  }, [selectedMode, prompt, aspectRatio, clipCount, clipDuration, genre, mood, enableNarration, uploadedImage]);

  const modeConfig = VIDEO_MODES.find((m) => m.id === selectedMode);
  const supportsAdvancedOptions = selectedMode === 'text-to-video' || selectedMode === 'b-roll';
  const effectiveDuration = clipDuration;
  const videoEngine: 'kling' | 'veo' = selectedMode === 'avatar' ? 'kling' : 'veo';

  const estimatedDuration = clipCount * effectiveDuration;
  const estMin = Math.floor(estimatedDuration / 60);
  const estSec = estimatedDuration % 60;
  const estimatedCredits = useMemo(
    () => calculateCreditsRequired(clipCount, effectiveDuration, videoEngine),
    [clipCount, effectiveDuration, videoEngine]
  );

  const userCredits = profile?.credits_balance ?? 0;
  const hasInsufficientCredits = userCredits < estimatedCredits;

  // Upload handlers
  const handleImageSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await imageUpload.uploadFile(file);
    if (result) { setUploadedImage(result.url); setUploadedFileName(file.name); }
  }, [imageUpload]);

  const handleVideoSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await videoUpload.uploadFile(file);
    if (result) { setUploadedVideo(result.url); setUploadedFileName(file.name); }
  }, [videoUpload]);

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>, type: 'image' | 'video') => {
    e.preventDefault(); e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (type === 'image') {
      const r = await imageUpload.uploadFile(file);
      if (r) { setUploadedImage(r.url); setUploadedFileName(file.name); }
    } else {
      const r = await videoUpload.uploadFile(file);
      if (r) { setUploadedVideo(r.url); setUploadedFileName(file.name); }
    }
  }, [imageUpload, videoUpload]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
  }, []);

  const clearUpload = useCallback(() => {
    setUploadedImage(null); setUploadedVideo(null); setUploadedFileName(null);
  }, []);

  const handleCreate = () => {
    if (hasInsufficientCredits) { setShowBuyCredits(true); return; }
    if (!prompt.trim() && modeConfig?.requiresText) return;
    const safetyResult = checkMultipleContent(prompt);
    if (!safetyResult.isSafe) {
      toast.error(safetyResult.message || 'This content violates our community guidelines. Please revise your prompt.');
      return;
    }
    if (isBreakoutTemplate && !selectedAvatar) return;

    const creationConfig: Parameters<typeof onStartCreation>[0] = {
      mode: isBreakoutTemplate ? 'text-to-video' : selectedMode,
      prompt,
      imageUrl: uploadedImage || undefined,
      videoUrl: uploadedVideo || undefined,
      aspectRatio,
      clipCount: isBreakoutTemplate ? 3 : clipCount,
      clipDuration: effectiveDuration,
      enableNarration: true,
      enableMusic,
      genre: supportsAdvancedOptions || isBreakoutTemplate ? genre : undefined,
      mood: supportsAdvancedOptions || isBreakoutTemplate ? mood : undefined,
      videoEngine,
    };

    if (isBreakoutTemplate && appliedSettings?.startImageUrl && selectedAvatar) {
      (creationConfig as any).isBreakout = true;
      (creationConfig as any).breakoutStartImageUrl = appliedSettings.startImageUrl;
      (creationConfig as any).breakoutPlatform = appliedSettings.breakoutPlatform;
      (creationConfig as any).imageUrl = selectedAvatar.front_image_url || selectedAvatar.face_image_url;
      (creationConfig as any).avatarImageUrl = selectedAvatar.front_image_url || selectedAvatar.face_image_url;
      (creationConfig as any).avatarVoiceId = selectedAvatar.voice_id;
      (creationConfig as any).avatarTemplateId = selectedAvatar.id;
      (creationConfig as any).avatarName = selectedAvatar.name;
    }

    onStartCreation(creationConfig);
  };

  const isReadyToCreate = () => {
    if (modeConfig?.requiresText && !prompt.trim()) return false;
    if (modeConfig?.requiresImage && !uploadedImage) return false;
    if (modeConfig?.requiresVideo && !uploadedVideo) return false;
    if (isBreakoutTemplate && !selectedAvatar) return false;
    return true;
  };

  const [forceVisible, setForceVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setForceVisible(true), 2000);
    return () => clearTimeout(t);
  }, []);
  const isInitializing = (templateLoading || tierLoading) && !forceVisible;

  return (
    <div className={cn('relative pb-24', isInitializing && 'opacity-0', className)}>
      <div className="max-w-3xl mx-auto">
        <ActiveProjectBanner className="mb-6" />

        {/* Template applied — minimal chip */}
        {appliedSettings?.templateName && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs text-primary/90"
          >
            <Layers className="w-3.5 h-3.5" />
            Template · {appliedSettings.templateName}
            <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
          </motion.div>
        )}

        {/* ─── Mode rail with sliding spotlight ─────────────────────────── */}
        <div className="mb-7 flex items-center justify-between gap-4 flex-wrap">
          <div className="relative inline-flex items-center gap-1 p-1 rounded-2xl bg-white/[0.025] border border-white/[0.06] backdrop-blur-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_8px_30px_-12px_rgba(0,0,0,0.6)]">
            {CREATION_MODES.map((m) => {
              const Icon = m.icon;
              const active = selectedMode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    if (m.id === 'avatar') navigate('/avatars');
                    else setSelectedMode(m.id);
                  }}
                  className={cn(
                    'relative z-10 flex items-center gap-2 px-4 sm:px-5 h-10 rounded-xl text-sm font-medium transition-colors duration-300',
                    active ? 'text-white' : 'text-white/45 hover:text-white/80'
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="creation-mode-pill"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      className="absolute inset-0 -z-10 rounded-xl"
                      style={{
                        background:
                          'linear-gradient(180deg, hsl(212 100% 56% / 0.22) 0%, hsl(212 100% 50% / 0.10) 100%)',
                        border: '1px solid hsl(212 100% 60% / 0.35)',
                        boxShadow:
                          '0 8px 30px -8px hsl(212 100% 50% / 0.45), inset 0 1px 0 hsl(212 100% 75% / 0.25)',
                      }}
                    />
                  )}
                  <Icon className={cn('w-4 h-4 transition-colors', active ? 'text-primary' : 'opacity-70')} />
                  <span className="tracking-tight">{m.name}</span>
                </button>
              );
            })}
          </div>

          {/* Credit orb */}
          <div className="relative inline-flex items-center gap-2.5 pl-2 pr-4 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl">
            <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-amber-300/30 to-amber-600/20 border border-amber-300/30">
              <Coins className="w-3.5 h-3.5 text-amber-200" />
              <span className="absolute inset-0 rounded-full ring-1 ring-amber-200/20 animate-pulse" />
            </span>
            <div className="leading-tight">
              <div className="text-[9px] uppercase tracking-[0.22em] text-white/35">Credits</div>
              <div className="text-sm font-semibold text-white tabular-nums">{userCredits.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* ─── Stage: prompt + (optional upload) ───────────────────────── */}
        <motion.div
          layout
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="group/stage relative rounded-[32px] overflow-hidden border border-white/[0.08] bg-[linear-gradient(180deg,hsla(0,0%,100%,0.045)_0%,hsla(0,0%,100%,0.012)_50%,hsla(0,0%,100%,0.02)_100%)] backdrop-blur-2xl shadow-[0_50px_120px_-30px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-1px_0_rgba(255,255,255,0.02)]"
        >
          {/* Top-edge aurora rim */}
          <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
          <div className="pointer-events-none absolute inset-x-24 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent blur-[1px]" />

          {/* Corner ambient lights */}
          <div className="pointer-events-none absolute -top-40 -left-32 h-80 w-80 rounded-full opacity-40 blur-3xl"
               style={{ background: 'radial-gradient(circle, hsl(212 100% 55% / 0.45), transparent 65%)' }} />
          <div className="pointer-events-none absolute -bottom-40 -right-32 h-80 w-80 rounded-full opacity-25 blur-3xl"
               style={{ background: 'radial-gradient(circle, hsl(190 100% 60% / 0.35), transparent 65%)' }} />

          {/* Film grain */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-overlay"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
            }}
          />

          <AnimatePresence mode="wait">
            <motion.div
              key={selectedMode}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
              className="relative p-5 sm:p-7"
            >
              {/* Avatar selection (breakout template) */}
              {isBreakoutTemplate && (
                <div className="mb-5 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                  <div className="flex items-center gap-2 mb-3 text-xs text-white/55 uppercase tracking-wider">
                    <User className="w-3.5 h-3.5" /> Select avatar
                  </div>
                  <TemplateAvatarSelector
                    selectedAvatar={selectedAvatar}
                    onSelect={setSelectedAvatar}
                    compact
                  />
                </div>
              )}

              {/* Image / Video upload */}
              {(modeConfig?.requiresImage || modeConfig?.requiresVideo) && !isBreakoutTemplate && (
                <div className="mb-5">
                  <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                  <input ref={videoInputRef} type="file" accept="video/*" onChange={handleVideoSelect} className="hidden" />

                  {(uploadedImage || uploadedVideo) ? (
                    <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] bg-black/30">
                      {uploadedImage && (
                        <img src={uploadedImage} alt="Uploaded" className="w-full h-44 object-cover" />
                      )}
                      {uploadedVideo && (
                        <SimpleVideoPlayer src={uploadedVideo} className="w-full h-44 object-cover" showControls />
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span className="text-xs text-white/85 truncate">{uploadedFileName}</span>
                        </div>
                        <button onClick={clearUpload} className="text-white/60 hover:text-white p-1 rounded-md hover:bg-white/10">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => modeConfig?.requiresVideo ? videoInputRef.current?.click() : imageInputRef.current?.click()}
                      onDrop={(e) => handleDrop(e, modeConfig?.requiresVideo ? 'video' : 'image')}
                      onDragOver={handleDragOver}
                      className="cursor-pointer rounded-2xl border border-dashed border-white/10 hover:border-white/20 hover:bg-white/[0.02] transition-all duration-300 p-6 flex items-center gap-4"
                    >
                      <div className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                        {(imageUpload.isUploading || videoUpload.isUploading) ? (
                          <Loader2 className="w-5 h-5 text-white/70 animate-spin" />
                        ) : (
                          <Upload className="w-5 h-5 text-white/55" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-white/80 font-medium">
                          {(imageUpload.isUploading || videoUpload.isUploading)
                            ? `Uploading… ${imageUpload.progress || videoUpload.progress}%`
                            : `Drop ${modeConfig?.requiresVideo ? 'a video' : 'an image'} or click to upload`}
                        </p>
                        <p className="text-xs text-white/35 mt-0.5">
                          {modeConfig?.requiresVideo ? 'MP4, MOV up to 100MB' : 'PNG, JPG up to 10MB'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Prompt */}
              <div className="relative">
                {/* Soft prompt frame */}
                <div className="relative rounded-2xl bg-gradient-to-b from-white/[0.025] to-transparent border border-white/[0.05] p-5 sm:p-6 transition-colors duration-500 focus-within:border-primary/30 focus-within:bg-primary/[0.025]">
                  <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={
                    selectedMode === 'image-to-video'
                      ? 'Describe how the image should move…'
                      : selectedMode === 'avatar'
                      ? 'What should the presenter say?'
                      : 'A lone astronaut watching twin suns set over a glass desert…'
                  }
                  rows={5}
                  className="w-full resize-none border-0 bg-transparent text-white placeholder:text-white/25 text-lg sm:text-xl leading-[1.45] focus-visible:ring-0 focus-visible:ring-offset-0 px-0 py-0 font-light tracking-[-0.01em]"
                />
                  {/* Character counter */}
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-[0.22em] text-white/25">
                      Prompt
                    </span>
                    <span className="text-[10px] tabular-nums text-white/30">
                      {prompt.length} / 1000
                    </span>
                  </div>
                </div>

                {/* Inline footer rail (controls + advanced trigger + CTA) */}
                <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
                  {/* Compact icon controls */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Aspect popover-less inline cycle */}
                    <ControlPill
                      icon={ASPECT_RATIOS.find(a => a.id === aspectRatio)?.icon || RectangleHorizontal}
                      label={aspectRatio}
                      onClick={() => {
                        const idx = ASPECT_RATIOS.findIndex(a => a.id === aspectRatio);
                        setAspectRatio(ASPECT_RATIOS[(idx + 1) % ASPECT_RATIOS.length].id);
                      }}
                      title="Aspect ratio"
                    />
                    <ControlPill
                      icon={Hash}
                      label={`${clipCount} clip${clipCount > 1 ? 's' : ''}`}
                      onClick={() => {
                        const next = clipCount >= maxClips ? 1 : clipCount + 1;
                        setClipCount(next);
                      }}
                      title={`Clips (max ${maxClips})`}
                    />
                    <ControlPill
                      icon={Clock}
                      label={`${clipDuration}s`}
                      onClick={() => {
                        const idx = CLIP_DURATIONS.indexOf(clipDuration);
                        setClipDuration(CLIP_DURATIONS[(idx + 1) % CLIP_DURATIONS.length]);
                      }}
                      title="Per-clip duration"
                    />
                    <button
                      onClick={() => setEnableNarration(v => !v)}
                      className={cn(
                        'h-9 w-9 inline-flex items-center justify-center rounded-full border transition-all',
                        enableNarration
                          ? 'bg-primary/15 border-primary/40 text-primary'
                          : 'bg-white/[0.03] border-white/10 text-white/40 hover:text-white/70'
                      )}
                      title={enableNarration ? 'Narration on' : 'Narration off'}
                    >
                      <Mic className="w-4 h-4" />
                    </button>
                    {supportsAdvancedOptions && (
                      <button
                        onClick={() => setShowAdvanced(v => !v)}
                        className={cn(
                          'h-9 inline-flex items-center gap-1.5 px-3 rounded-full border text-xs font-medium transition-all',
                          showAdvanced
                            ? 'bg-white/[0.06] border-white/15 text-white'
                            : 'bg-white/[0.03] border-white/10 text-white/45 hover:text-white/80'
                        )}
                        title="Advanced"
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                        <ChevronDown className={cn('w-3 h-3 transition-transform', showAdvanced && 'rotate-180')} />
                      </button>
                    )}
                  </div>

                  {/* Premium CTA with halo */}
                  <div className="relative">
                    {/* Halo glow */}
                    {!hasInsufficientCredits && isReadyToCreate() && (
                      <span className="pointer-events-none absolute -inset-1 rounded-full bg-primary/40 blur-xl opacity-60 animate-pulse" />
                    )}
                    <Button
                      onClick={handleCreate}
                      disabled={!isReadyToCreate()}
                      className={cn(
                        'group/cta relative h-12 px-6 rounded-full text-sm font-semibold transition-all overflow-hidden',
                        hasInsufficientCredits
                          ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-black'
                          : 'bg-gradient-to-b from-primary/95 to-primary text-primary-foreground',
                        'shadow-[0_10px_40px_-10px_hsl(212_100%_50%/0.7),inset_0_1px_0_hsl(212_100%_85%/0.45),inset_0_-1px_0_hsl(212_100%_25%/0.4)]',
                        'hover:brightness-110 hover:scale-[1.02] active:scale-[0.98]',
                        'disabled:opacity-30 disabled:shadow-none disabled:scale-100'
                      )}
                    >
                      <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover/cta:translate-x-full transition-transform duration-[1100ms] ease-in-out" />
                      <span className="relative flex items-center gap-2.5">
                        {hasInsufficientCredits ? (
                          <>
                            <Coins className="w-4 h-4" /> Get credits <ArrowRight className="w-4 h-4" />
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            <span className="tracking-tight">Create</span>
                            <span className="h-3.5 w-px bg-white/30" />
                            <span className="opacity-90 tabular-nums text-[13px]">{estimatedCredits}</span>
                            <ArrowRight className="w-4 h-4 transition-transform group-hover/cta:translate-x-0.5" />
                          </>
                        )}
                      </span>
                    </Button>
                  </div>
                </div>

                {/* Advanced options drawer */}
                <AnimatePresence initial={false}>
                  {supportsAdvancedOptions && showAdvanced && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <FieldShell label="Genre">
                          <Select value={genre} onValueChange={setGenre}>
                            <SelectTrigger className="bg-transparent border-white/10 text-white h-10">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {GENRE_OPTIONS.map(g => (
                                <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FieldShell>
                        <FieldShell label="Mood">
                          <Select value={mood} onValueChange={setMood}>
                            <SelectTrigger className="bg-transparent border-white/10 text-white h-10">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {MOOD_OPTIONS.map(m => (
                                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FieldShell>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {hasInsufficientCredits && (
                  <p className="mt-3 text-xs text-amber-300/80">
                    Need {estimatedCredits - userCredits} more credits ·{' '}
                    <button onClick={() => setShowBuyCredits(true)} className="underline">Top up</button>
                  </p>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* ─── Tiny meta strip (estimated runtime) ─────────────────────── */}
        <div className="mt-5 flex items-center justify-center gap-4 text-[11px] text-white/35 uppercase tracking-[0.18em]">
          <span>≈ {estMin > 0 ? `${estMin}m ${estSec}s` : `${estSec}s`} runtime</span>
          <span className="opacity-40">·</span>
          <span>{estimatedCredits} credits</span>
          <span className="opacity-40">·</span>
          <span>{aspectRatio}</span>
        </div>

        {/* ─── Quiet links — Templates & Training ─────────────────────── */}
        <div className="mt-10 flex items-center justify-center gap-6 text-sm text-white/45">
          <a href="/templates" className="group inline-flex items-center gap-1.5 hover:text-white transition-colors">
            <Layers className="w-3.5 h-3.5 opacity-70" /> Templates
            <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>
          <span className="w-px h-3 bg-white/10" />
          <a href="/training-video" className="group inline-flex items-center gap-1.5 hover:text-white transition-colors">
            <Film className="w-3.5 h-3.5 opacity-70" /> Training
            <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>
        </div>
      </div>

      <BuyCreditsModal open={showBuyCredits} onOpenChange={setShowBuyCredits} />
    </div>
  );
});

// ─── Small helpers ────────────────────────────────────────────────────────────
function ControlPill({
  icon: Icon, label, onClick, title,
}: { icon: any; label: string; onClick: () => void; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="h-9 inline-flex items-center gap-1.5 px-3 rounded-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 text-white/70 hover:text-white text-xs font-medium tabular-nums transition-all"
    >
      <Icon className="w-3.5 h-3.5 opacity-80" />
      {label}
    </button>
  );
}

function FieldShell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] uppercase tracking-[0.18em] text-white/40">{label}</Label>
      {children}
    </div>
  );
}
