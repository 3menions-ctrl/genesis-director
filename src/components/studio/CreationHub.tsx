import { useState, useRef, useCallback, useEffect, memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wand2, Image as ImageIcon, User, Film, Coins, Sparkles, Upload,
  ChevronRight, RectangleHorizontal, Square, RectangleVertical,
  Clock, Hash, Mic, ChevronDown, X, CheckCircle2, Loader2,
  ArrowRight, Layers, Settings2, Zap, Cpu, Lock, Info, Minus, Plus, Timer,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { saveDraft, loadDraft } from '@/lib/sessionPersistence';
import { calculateCreditsForDurations } from '@/lib/creditSystem';
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
import { BrandedVideoPlayer } from '@/components/intro/BrandedVideoPlayer';
import { TemplateAvatarSelector } from './TemplateAvatarSelector';
import { AvatarTemplate } from '@/types/avatar-templates';
import { supabase } from '@/integrations/supabase/client';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { BuyCreditsModal } from '@/components/credits/BuyCreditsModal';
import { useCredits } from '@/contexts/CreditsContext';

type CreditState = { balance: number; held: number; available: number };

// ─── Creation modes ───────────────────────────────────────────────────────────
// A "mode" is the *intent* (text→video, image→video, avatar). The "engine" is
// the *render model*. We model them separately and use a capability matrix so
// invalid combinations (e.g. "Avatar with Sora 2") are physically impossible
// to choose in the UI.
type CreationModeId = 'text-to-video' | 'image-to-video' | 'avatar';
type CreationModeDef = {
  id: CreationModeId;
  name: string;
  icon: any;
  hint: string;
  requiresImage?: boolean;
  requiresLipSync?: boolean;
};
const CREATION_MODES: CreationModeDef[] = [
  { id: 'text-to-video',  name: 'Cinematic', icon: Wand2,     hint: 'Generate from text' },
  { id: 'image-to-video', name: 'Animate',   icon: ImageIcon, hint: 'Bring an image to life', requiresImage: true },
  { id: 'avatar',         name: 'Avatar',    icon: User,      hint: 'Talking presenter (lip-sync)', requiresLipSync: true },
];

// ─── Engine capability matrix ─────────────────────────────────────────────────
// Single source of truth for what each render model can/can't do. The UI reads
// this to dim invalid engines, snap aspect ratio + duration into legal range,
// and prevent incoherent submissions before they reach the pipeline.
type EngineKey = 'wan' | 'kling' | 'seedance' | 'veo' | 'sora';
type EngineCapabilities = {
  label: string;
  model: string;
  tagline: string;
  badge?: string;
  supportsT2V: boolean;
  supportsI2V: boolean;
  supportsLipSync: boolean;          // Talking-head with native dialogue audio
  supportsNativeAudio: boolean;
  aspectRatios: Array<'16:9' | '9:16' | '1:1'>;
  durations: number[];
};
const ENGINE_CAPS: Record<EngineKey, EngineCapabilities> = {
  // Alibaba's Wan 2.5 — the free-tier engine. Always shown first.
  wan: {
    label: 'Wan 2.5', model: 'wan-ai/wan-2.5-t2v',
    tagline: 'Free tier · Alibaba Wan', badge: 'FREE',
    supportsT2V: true, supportsI2V: true, supportsLipSync: false, supportsNativeAudio: false,
    aspectRatios: ['16:9', '9:16', '1:1'], durations: [5, 10],
  },
  kling: {
    label: 'Kling V3', model: 'kwaivgi/kling-v3-video',
    tagline: 'Cinematic · Native lip-sync',
    supportsT2V: true, supportsI2V: true, supportsLipSync: true, supportsNativeAudio: true,
    aspectRatios: ['16:9', '9:16', '1:1'], durations: [5, 10],
  },
  seedance: {
    label: 'Seedance 1 Pro', model: 'bytedance/seedance-1-pro',
    tagline: 'Premium hyperreal motion', badge: 'NEW',
    supportsT2V: true, supportsI2V: true, supportsLipSync: false, supportsNativeAudio: false,
    aspectRatios: ['16:9', '9:16', '1:1'], durations: [5, 10],
  },
  veo: {
    label: 'Veo 3 Fast', model: 'google/veo-3-fast',
    tagline: 'Native audio · 1080p · 8s',
    supportsT2V: true, supportsI2V: true, supportsLipSync: false, supportsNativeAudio: true,
    aspectRatios: ['16:9', '9:16'], durations: [8],
  },
  sora: {
    label: 'Sora 2', model: 'openai/sora-2',
    tagline: 'Narrative coherence · Long shots',
    supportsT2V: true, supportsI2V: true, supportsLipSync: false, supportsNativeAudio: true,
    aspectRatios: ['16:9', '9:16'], durations: [8, 12],
  },
};

// Is this engine compatible with the selected mode?
function engineSupportsMode(engine: EngineKey, mode: CreationModeId): boolean {
  const caps = ENGINE_CAPS[engine];
  if (mode === 'avatar') return caps.supportsLipSync;
  if (mode === 'image-to-video') return caps.supportsI2V;
  return caps.supportsT2V;
}

// Snap a value to the nearest legal entry (used for duration + aspect ratio
// when the user changes engine).
function snapToAllowed<T>(value: T, allowed: T[]): T {
  return allowed.includes(value) ? value : allowed[0];
}
function snapDuration(value: number, allowed: number[]): number {
  return [...allowed].sort((a, b) => Math.abs(a - value) - Math.abs(b - value))[0] ?? allowed[0];
}

const ASPECT_RATIOS: Array<{ id: '16:9' | '9:16' | '1:1'; icon: any; label: string }> = [
  { id: '16:9', icon: RectangleHorizontal, label: 'Wide' },
  { id: '9:16', icon: RectangleVertical,   label: 'Tall' },
  { id: '1:1',  icon: Square,              label: 'Square' },
];

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
    /**
     * Per-scene durations. Length === clipCount. Each value is one of
     * the engine's supported durations. Backend may use this to render
     * each scene at its own length; legacy `clipDuration` is kept as
     * the dominant value for older code paths.
     */
    clipDurations?: number[];
    enableNarration: boolean;
    enableMusic: boolean;
    genre?: string;
    mood?: string;
    videoEngine?: 'wan' | 'kling' | 'veo' | 'seedance' | 'sora';
    isBreakout?: boolean;
    breakoutStartImageUrl?: string;
    breakoutPlatform?: string;
    avatarImageUrl?: string;
    avatarVoiceId?: string;
    avatarTemplateId?: string;
    avatarName?: string;
    identityBible?: unknown;
    characterLock?: unknown;
    useTemplateShots?: boolean;
    templateShotSequence?: unknown[];
    templateName?: string;
    templateStyleAnchor?: unknown;
    templateCharacters?: unknown[];
    templateEnvironmentLock?: unknown;
  }) => void;
  onReady?: () => void;
  className?: string;
}

export const CreationHub = memo(function CreationHub({ onStartCreation, onReady, className }: CreationHubProps) {
  const { navigateTo: navigate } = useNavigationWithLoading();
  const { profile } = useAuth();
  const credits = useCredits();
  // Free-tier rule: users who have never purchased credits can only use the
  // baseline engine (Alibaba's Wan 2.5). The premium engines (kling /
  // seedance / veo / sora) remain visible but locked, with a clear
  // "upgrade to unlock" hint. The admin role bypasses this lock so
  // internal testing isn't hampered.
  const FREE_TIER_ENGINE: EngineKey = 'wan';
  const isFreeTier = !!profile
    && profile.account_type !== 'admin'
    && (profile.total_credits_purchased ?? 0) === 0;

  const [selectedMode, setSelectedMode] = useState<VideoGenerationMode>('text-to-video');
  // Engine is now an INDEPENDENT axis from mode. The capability matrix
  // (ENGINE_CAPS) decides which engines are valid for the chosen mode.
  // Default engine: 'wan' for everyone — purchased users will see Wan as the
  // free option but can flip to Kling for richer features. New free-tier
  // users land directly on the engine that won't blow through their grant.
  const [videoEngine, setVideoEngine] = useState<EngineKey>('wan');
  const [prompt, setPrompt] = useState('');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedVideo, setUploadedVideo] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [showBuyCredits, setShowBuyCredits] = useState(false);
  const [isVerifyingCredits, setIsVerifyingCredits] = useState(false);

  const { appliedSettings, isLoading: templateLoading, templateId } = useTemplateEnvironment();

  const imageUpload = useFileUpload({ maxSizeMB: 10, allowedTypes: ['image/*'] });
  const videoUpload = useFileUpload({ maxSizeMB: 100, allowedTypes: ['video/*'] });
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [clipDuration, setClipDuration] = useState(5);
  // Per-scene durations. Always kept in lockstep with `clipCount` and the
  // active engine — every entry must be one of `engineCaps.durations`.
  const [clipDurations, setClipDurations] = useState<number[]>(() =>
    Array.from({ length: 5 }, () => 5),
  );
  // Banner shown after the active engine changes the legal duration set and
  // we had to auto-snap the user's previous picks. Cleared on dismiss or
  // after the next engine switch that produces no clamps.
  const [clampNotice, setClampNotice] = useState<{
    engineLabel: string;
    allowed: number[];
    changes: Array<{ label: string; from: number; to: number }>;
  } | null>(null);
  const [enableNarration, setEnableNarration] = useState(true);
  const [enableMusic] = useState(false);

  const [selectedAvatar, setSelectedAvatar] = useState<AvatarTemplate | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [genre, setGenre] = useState('cinematic');
  const [mood, setMood] = useState('epic');

  const isBreakoutTemplate = appliedSettings?.isBreakout === true;
  // Allow optional avatar attachment whenever a template is applied
  // (educational/learning templates and any environment-driven template),
  // not just breakout. Avatar stays REQUIRED only for breakout flows.
  const supportsTemplateAvatar = !!appliedSettings && (
    isBreakoutTemplate ||
    appliedSettings.genre === 'educational' ||
    !!appliedSettings.environmentPrompt
  );
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
      if (appliedSettings.isBreakout) setVideoEngine('seedance');
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
  const engineCaps = ENGINE_CAPS[videoEngine];
  const engineInfo = engineCaps;
  const clipDurationOptions = engineCaps.durations;
  const aspectOptions = ASPECT_RATIOS.filter(a => engineCaps.aspectRatios.includes(a.id));

  // ── GUARDRAIL: if the chosen engine doesn't support the chosen mode, snap
  //               the engine back to the canonical engine for that mode.
  //               (Avatar = Kling lip-sync only; everything else falls back to Kling.)
  useEffect(() => {
    if (!engineSupportsMode(videoEngine, selectedMode as CreationModeId)) {
      // Prefer wan as the fallback so free-tier users don't get bumped to
      // a locked engine just because they touched a mode the wan engine
      // also supports. Only fall through to kling for modes wan can't
      // serve (avatar / lip-sync).
      const fallback: EngineKey = engineSupportsMode('wan', selectedMode as CreationModeId) ? 'wan' : 'kling';
      setVideoEngine(fallback);
    }
    // Free-tier guardrail: if a free user somehow ends up on a paid engine
    // (e.g. via a template that auto-picks seedance) AND wan supports the
    // selected mode, snap them back to wan instead of failing at
    // generation time. If wan can't do the mode (avatar), let them stay on
    // the locked engine so the existing "purchase to unlock" toast fires
    // when they hit Generate.
    if (isFreeTier && videoEngine !== FREE_TIER_ENGINE
        && engineSupportsMode(FREE_TIER_ENGINE, selectedMode as CreationModeId)) {
      setVideoEngine(FREE_TIER_ENGINE);
    }
  }, [selectedMode, videoEngine, isFreeTier]);

  // ── GUARDRAIL: snap default duration AND every per-scene duration into
  //               the new engine's legal range.
  useEffect(() => {
    const changes: Array<{ label: string; from: number; to: number }> = [];
    if (!clipDurationOptions.includes(clipDuration)) {
      const snapped = snapDuration(clipDuration, clipDurationOptions);
      changes.push({ label: 'Default', from: clipDuration, to: snapped });
      setClipDuration(snapped);
    }
    setClipDurations((prev) =>
      prev.map((d, i) => {
        const snapped = snapDuration(d, clipDurationOptions);
        if (snapped !== d) changes.push({ label: `S${i + 1}`, from: d, to: snapped });
        return snapped;
      }),
    );
    setClampNotice(
      changes.length
        ? { engineLabel: engineCaps.label, allowed: clipDurationOptions, changes }
        : null,
    );
  }, [videoEngine]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keep per-scene durations sized to clipCount. New scenes inherit the
  //    current default duration; trimmed scenes drop off the end.
  useEffect(() => {
    setClipDurations((prev) => {
      if (prev.length === clipCount) return prev;
      if (prev.length > clipCount) return prev.slice(0, clipCount);
      const fill = snapDuration(clipDuration, clipDurationOptions);
      return [...prev, ...Array.from({ length: clipCount - prev.length }, () => fill)];
    });
  }, [clipCount, clipDuration, clipDurationOptions]);

  // ── GUARDRAIL: snap aspect ratio into the engine's legal set
  //               (Veo + Sora don't support 1:1).
  useEffect(() => {
    if (!engineCaps.aspectRatios.includes(aspectRatio as any)) {
      setAspectRatio(engineCaps.aspectRatios[0]);
    }
  }, [videoEngine]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── GUARDRAIL: a template environment with a baked-in start image (e.g.
  //               breakout 4th-wall) implicitly OWNS the start frame. Block
  //               manual image upload so we don't double-source the first
  //               frame and confuse the pipeline.
  const templateProvidesStartImage = !!appliedSettings?.startImageUrl;

  // ── GUARDRAIL: avatar mode requires lip-sync, which only Kling supports.
  //               If the user is in Avatar mode they cannot also upload a
  //               separate scene image — the avatar's face IS the start frame.
  useEffect(() => {
    if (selectedMode === 'avatar' && uploadedImage) {
      setUploadedImage(null);
      setUploadedFileName(null);
    }
    if (selectedMode === 'image-to-video' && selectedAvatar && !supportsTemplateAvatar) {
      setSelectedAvatar(null);
    }
  }, [selectedMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Aligned per-scene durations (always reflects the current clipCount
  // even before the sync effect runs, so totals never flicker).
  const alignedDurations = useMemo(() => {
    const fill = snapDuration(clipDuration, clipDurationOptions);
    if (clipDurations.length === clipCount) {
      return clipDurations.map((d) => snapDuration(d, clipDurationOptions));
    }
    if (clipDurations.length > clipCount) return clipDurations.slice(0, clipCount);
    return [
      ...clipDurations.map((d) => snapDuration(d, clipDurationOptions)),
      ...Array.from({ length: clipCount - clipDurations.length }, () => fill),
    ];
  }, [clipDurations, clipCount, clipDuration, clipDurationOptions]);
  const estimatedDuration = alignedDurations.reduce((a, b) => a + b, 0);
  const estMin = Math.floor(estimatedDuration / 60);
  const estSec = estimatedDuration % 60;
  const estimatedCredits = useMemo(
    () => calculateCreditsForDurations(alignedDurations, videoEngine as any),
    [alignedDurations, videoEngine]
  );

  const displayedCredits = credits.available;
  const hasKnownInsufficientCredits = !credits.loading && credits.available < estimatedCredits;
  const refreshCreditState = useCallback(async (): Promise<CreditState> => {
    // Force-reconcile so the displayed balance always matches the ledger
    // before we gate-check a generation submission.
    const s = await credits.reconcile();
    return { balance: s.balance, held: s.held, available: s.available };
  }, [credits]);

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

  const handleCreate = async () => {
    if (!prompt.trim() && modeConfig?.requiresText) return;
    const safetyResult = checkMultipleContent(prompt);
    if (!safetyResult.isSafe) {
      toast.error(safetyResult.message || 'This content violates our community guidelines. Please revise your prompt.');
      return;
    }
    if (isBreakoutTemplate && !selectedAvatar) return;

    // ── Final guardrail wall: refuse incoherent submissions even if the UI
    //    state somehow drifted. These mirror ENGINE_CAPS rules.
    if (selectedMode === 'avatar' && !engineCaps.supportsLipSync) {
      toast.error(`${engineCaps.label} can't render talking-head avatars. Switch engine to Kling V3.`);
      return;
    }
    if (selectedMode === 'image-to-video' && !engineCaps.supportsI2V) {
      toast.error(`${engineCaps.label} doesn't support image-to-video.`);
      return;
    }
    if (!engineCaps.aspectRatios.includes(aspectRatio as any)) {
      toast.error(`${engineCaps.label} doesn't support ${aspectRatio} — pick ${engineCaps.aspectRatios.join(' or ')}.`);
      return;
    }
    const invalid = alignedDurations.find((d) => !engineCaps.durations.includes(d));
    if (invalid !== undefined) {
      toast.error(`${engineCaps.label} only supports ${engineCaps.durations.join('/')}s clips.`);
      return;
    }
    // Avatar mode + manually uploaded scene image is incoherent: the avatar
    // face IS the start frame. We cleared this in an effect, but double-block
    // here in case something raced.
    if (selectedMode === 'avatar' && uploadedImage) {
      toast.error('Avatar mode uses the avatar face as the start frame — please remove the uploaded image.');
      return;
    }

    let liveCredits: CreditState;
    try {
      setIsVerifyingCredits(true);
      liveCredits = await refreshCreditState();
    } catch (error) {
      toast.error('Could not verify your live credit balance. Please try again.');
      return;
    } finally {
      setIsVerifyingCredits(false);
    }

    if (liveCredits.available < estimatedCredits) {
      setShowBuyCredits(true);
      toast.error(`Insufficient credits. Need ${estimatedCredits}, available ${liveCredits.available}.`);
      return;
    }

    // Dominant duration for legacy `clipDuration` field — most-frequent, ties favor max.
    const counts = new Map<number, number>();
    alignedDurations.forEach((d) => counts.set(d, (counts.get(d) ?? 0) + 1));
    const dominantDuration = [...counts.entries()].sort((a, b) =>
      b[1] - a[1] || b[0] - a[0],
    )[0]?.[0] ?? clipDuration;

    const finalDurations = isBreakoutTemplate
      ? Array.from({ length: 3 }, () => dominantDuration)
      : alignedDurations;

    const creationConfig: Parameters<typeof onStartCreation>[0] = {
      mode: isBreakoutTemplate ? 'text-to-video' : selectedMode,
      prompt,
      imageUrl: uploadedImage || undefined,
      videoUrl: uploadedVideo || undefined,
      aspectRatio,
      clipCount: isBreakoutTemplate ? 3 : clipCount,
      clipDuration: dominantDuration,
      clipDurations: finalDurations,
      enableNarration: true,
      enableMusic,
      genre: supportsAdvancedOptions || isBreakoutTemplate ? genre : undefined,
      mood: supportsAdvancedOptions || isBreakoutTemplate ? mood : undefined,
      videoEngine: videoEngine as any,
      useTemplateShots: !!appliedSettings?.shotSequence?.length,
      templateShotSequence: appliedSettings?.shotSequence,
      templateName: appliedSettings?.templateName,
      templateStyleAnchor: appliedSettings?.styleAnchor,
      templateCharacters: appliedSettings?.characterTemplates,
      templateEnvironmentLock: appliedSettings?.environmentLock,
    };

    if (isBreakoutTemplate && appliedSettings?.startImageUrl && selectedAvatar) {
      const avatarRef = selectedAvatar.front_image_url || selectedAvatar.face_image_url;
      creationConfig.isBreakout = true;
      creationConfig.breakoutStartImageUrl = appliedSettings.startImageUrl;
      creationConfig.breakoutPlatform = appliedSettings.breakoutPlatform;
      creationConfig.imageUrl = avatarRef;
      creationConfig.avatarImageUrl = avatarRef;
      creationConfig.avatarVoiceId = selectedAvatar.voice_id;
      creationConfig.avatarTemplateId = selectedAvatar.id;
      creationConfig.avatarName = selectedAvatar.name;
      creationConfig.identityBible = selectedAvatar.character_bible;
      creationConfig.characterLock = {
        name: selectedAvatar.name,
        description: [
          selectedAvatar.description,
          selectedAvatar.personality ? `Personality: ${selectedAvatar.personality}` : null,
          selectedAvatar.style ? `Style: ${selectedAvatar.style}` : null,
          selectedAvatar.character_bible?.hair_description ? `Hair: ${selectedAvatar.character_bible.hair_description}` : null,
          selectedAvatar.character_bible?.clothing_description ? `Wardrobe: ${selectedAvatar.character_bible.clothing_description}` : null,
          selectedAvatar.character_bible?.body_type ? `Body: ${selectedAvatar.character_bible.body_type}` : null,
          selectedAvatar.character_bible?.distinguishing_features?.length ? `Distinctive features: ${selectedAvatar.character_bible.distinguishing_features.join(', ')}` : null,
        ].filter(Boolean).join(' | '),
        referenceImageUrl: avatarRef,
      };
    } else if (selectedAvatar && supportsTemplateAvatar) {
      // Optional avatar attached to a learning / environment-driven template.
      // Use avatar face as the start image so Kling locks identity for every clip.
      (creationConfig as any).imageUrl = selectedAvatar.front_image_url || selectedAvatar.face_image_url;
      (creationConfig as any).avatarImageUrl = selectedAvatar.front_image_url || selectedAvatar.face_image_url;
      (creationConfig as any).avatarVoiceId = selectedAvatar.voice_id;
      (creationConfig as any).avatarTemplateId = selectedAvatar.id;
      (creationConfig as any).avatarName = selectedAvatar.name;
    }

    // Visible audit trail: log the engine the user actually launched with.
    console.log(`[CreationHub] 🎬 Launching generation with engine=${videoEngine} (mode=${creationConfig.mode}, model=${engineInfo.model})`);

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
          <div
            className="relative inline-flex items-center gap-1 p-1 rounded-full"
            style={{
              background: 'hsla(0,0%,100%,0.025)',
              backdropFilter: 'blur(48px) saturate(180%)',
              WebkitBackdropFilter: 'blur(48px) saturate(180%)',
              boxShadow: '0 8px 30px -12px rgba(0,0,0,0.6), inset 0 1px 0 hsla(0,0%,100%,0.04)',
            }}
          >
            {CREATION_MODES.map((m, idx) => {
              const Icon = m.icon;
              const active = selectedMode === m.id;
              return (
                <button
                  key={`${m.id}-${idx}`}
                  onClick={() => {
                    if (m.id === 'avatar') navigate('/avatars');
                    else { setSelectedMode(m.id); }
                  }}
                  className={cn(
                    'relative z-10 flex items-center gap-2 px-4 sm:px-4 h-10 rounded-full text-[13px] font-light tracking-[-0.005em] transition-colors duration-500',
                    active ? 'text-white' : 'text-white/45 hover:text-white/80'
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="creation-mode-pill"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      className="absolute inset-0 -z-10 rounded-full"
                      style={{
                        background: 'linear-gradient(180deg, hsla(215,100%,60%,0.22) 0%, hsla(215,100%,55%,0.10) 100%)',
                        boxShadow: '0 0 24px hsla(215,100%,60%,0.35), 0 0 48px hsla(215,100%,60%,0.18), inset 0 1px 0 hsla(0,0%,100%,0.10)',
                      }}
                    />
                  )}
                  <Icon
                    className={cn(
                      'w-4 h-4 transition-all duration-500',
                      active ? 'text-[hsl(215,100%,75%)] drop-shadow-[0_0_8px_hsla(215,100%,60%,0.6)]' : 'opacity-60'
                    )}
                    strokeWidth={1.5}
                  />
                  <span>{m.name}</span>
                </button>
              );
            })}
          </div>

          {/* Credit orb */}
          <div
            className="relative inline-flex items-center gap-2.5 pl-2 pr-4 py-1.5 rounded-full"
            style={{
              background: 'hsla(0,0%,100%,0.03)',
              backdropFilter: 'blur(40px) saturate(180%)',
              WebkitBackdropFilter: 'blur(40px) saturate(180%)',
              boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.04)',
            }}
          >
            <span
              className="relative flex h-7 w-7 items-center justify-center rounded-full"
              style={{
                background: 'linear-gradient(180deg, hsla(215,100%,68%,0.30) 0%, hsla(215,100%,55%,0.12) 100%)',
                boxShadow: '0 0 16px hsla(215,100%,60%,0.45), inset 0 1px 0 hsla(0,0%,100%,0.10)',
              }}
            >
              <Coins className="w-3.5 h-3.5 text-[hsl(215,100%,82%)]" strokeWidth={1.5} />
              <span className="absolute inset-0 rounded-full animate-pulse" style={{ boxShadow: '0 0 0 1px hsla(215,100%,60%,0.25)' }} />
            </span>
            <div className="leading-tight">
              <div className="text-[9px] uppercase tracking-[0.24em] text-white/35 font-light">Credits</div>
              <div className="text-sm font-light text-white tabular-nums tracking-[-0.01em]">{displayedCredits.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* ─── Engine rail — interactive, capability-gated ──────────────── */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2.5 text-[10px] uppercase tracking-[0.24em] text-white/40 font-light">
            <Cpu className="w-3 h-3" strokeWidth={1.5} />
            Render engine
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {(Object.keys(ENGINE_CAPS) as EngineKey[]).map((k) => {
              const caps = ENGINE_CAPS[k];
              const compatible = engineSupportsMode(k, selectedMode as CreationModeId);
              const freeLocked = isFreeTier && k !== FREE_TIER_ENGINE;
              const available = compatible && !freeLocked;
              const active = videoEngine === k && available;
              return (
                <button
                  key={k}
                  onClick={() => {
                    if (freeLocked) {
                      toast.error(`${caps.label} unlocks once you've purchased credits. Free credits run on Kling V3.`);
                      return;
                    }
                    if (compatible) setVideoEngine(k);
                  }}
                  disabled={!available}
                  title={
                    freeLocked
                      ? `${caps.label} requires purchased credits. Free credits use Kling V3.`
                      : !compatible
                        ? selectedMode === 'avatar'
                          ? `${caps.label} doesn't support lip-sync — Avatar mode requires Kling V3.`
                          : `${caps.label} isn't compatible with this mode.`
                        : caps.tagline
                  }
                  className={cn(
                    'group relative inline-flex items-center gap-2 pl-2 pr-3.5 py-1.5 rounded-full transition-all duration-400',
                    active && 'scale-[1.02]',
                    !available && 'opacity-35 cursor-not-allowed',
                  )}
                  style={{
                    background: active
                      ? 'linear-gradient(180deg, hsla(215,100%,60%,0.22), hsla(215,100%,55%,0.08))'
                      : 'hsla(0,0%,100%,0.025)',
                    boxShadow: active
                      ? '0 0 24px -6px hsla(215,100%,60%,0.55), inset 0 1px 0 hsla(0,0%,100%,0.08)'
                      : 'inset 0 1px 0 hsla(0,0%,100%,0.04)',
                  }}
                >
                  <span
                    className="relative flex h-5 w-5 items-center justify-center rounded-full"
                    style={{
                      background: active ? 'hsla(215,100%,60%,0.30)' : 'hsla(0,0%,100%,0.06)',
                    }}
                  >
                    {available ? (
                      <Cpu className={cn('w-2.5 h-2.5', active ? 'text-[hsl(215,100%,82%)]' : 'text-white/55')} strokeWidth={1.5} />
                    ) : (
                      <Lock className="w-2.5 h-2.5 text-white/40" strokeWidth={1.5} />
                    )}
                  </span>
                  <span className={cn('text-[12px] font-light tracking-[-0.005em]', active ? 'text-white' : 'text-white/65')}>
                    {caps.label}
                  </span>
                  {caps.badge && compatible && (
                    <span
                      className="px-1.5 py-0.5 rounded-full text-[9px] font-light tracking-[0.14em] leading-none"
                      style={{ background: 'hsla(215,100%,60%,0.15)', color: 'hsl(215,100%,78%)' }}
                    >
                      {caps.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-white/45 font-light">
            <Info className="w-3 h-3 opacity-60" strokeWidth={1.5} />
            <span>{engineInfo.tagline}</span>
            <span className="text-white/25">·</span>
            <span className="font-mono text-white/35">{engineInfo.model}</span>
            <span className="text-white/25">·</span>
            <span className="text-white/35">{engineCaps.aspectRatios.join(' / ')}</span>
            <span className="text-white/25">·</span>
            <span className="text-white/35">{engineCaps.durations.join(' / ')}s</span>
          </div>
        </div>

        {/* ─── Stage: prompt + (optional upload) ───────────────────────── */}
        <motion.div
          layout
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="group/stage relative rounded-[32px] overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, hsla(0,0%,100%,0.04) 0%, hsla(0,0%,100%,0.01) 50%, hsla(0,0%,100%,0.02) 100%)',
            backdropFilter: 'blur(56px) saturate(180%)',
            WebkitBackdropFilter: 'blur(56px) saturate(180%)',
            boxShadow: '0 50px 120px -30px rgba(0,0,0,0.75), inset 0 1px 0 hsla(0,0%,100%,0.05), inset 0 -1px 0 hsla(0,0%,100%,0.02)',
          }}
        >
          {/* Top-edge aurora rim */}
          <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-[hsla(215,100%,60%,0.6)] to-transparent" />
          <div className="pointer-events-none absolute inset-x-24 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent blur-[1px]" />

          {/* Corner ambient lights */}
          <div className="pointer-events-none absolute -top-40 -left-32 h-80 w-80 rounded-full opacity-40 blur-3xl"
               style={{ background: 'radial-gradient(circle, hsla(215,100%,55%,0.45), transparent 65%)' }} />
          <div className="pointer-events-none absolute -bottom-40 -right-32 h-80 w-80 rounded-full opacity-25 blur-3xl"
               style={{ background: 'radial-gradient(circle, hsla(215,100%,70%,0.30), transparent 65%)' }} />

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
              {supportsTemplateAvatar && (
                <div
                  className="mb-5 p-5 rounded-3xl"
                  style={{
                    background: 'hsla(0,0%,100%,0.022)',
                    backdropFilter: 'blur(40px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(40px) saturate(180%)',
                    boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.04)',
                  }}
                >
                  <div className="flex items-center gap-2 mb-3 text-[10px] text-white/55 uppercase tracking-[0.22em] font-light">
                    <User className="w-3.5 h-3.5" strokeWidth={1.5} />
                    {isBreakoutTemplate ? 'Select avatar' : 'Add a presenter (optional)'}
                  </div>
                  <TemplateAvatarSelector
                    selectedAvatar={selectedAvatar}
                    onSelect={setSelectedAvatar}
                    compact
                  />
                </div>
              )}

              {/* Image / Video upload — hidden if template owns the start frame
                  (e.g. 4th-wall breakout) or the user picked Avatar mode (avatar
                  face IS the start frame). */}
              {(modeConfig?.requiresImage || modeConfig?.requiresVideo) && !isBreakoutTemplate && !templateProvidesStartImage && selectedMode !== 'avatar' && (
                <div className="mb-5">
                  <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                  <input ref={videoInputRef} type="file" accept="video/*" onChange={handleVideoSelect} className="hidden" />

                  {(uploadedImage || uploadedVideo) ? (
                    <div
                      className="relative rounded-3xl overflow-hidden"
                      style={{
                        background: 'hsla(0,0%,0%,0.3)',
                        boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.05)',
                      }}
                    >
                      {uploadedImage && (
                        <img src={uploadedImage} alt="Uploaded" className="w-full h-44 object-cover" />
                      )}
                      {uploadedVideo && (
                        <BrandedVideoPlayer src={uploadedVideo} className="w-full h-44 object-cover" showControls />
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" strokeWidth={1.5} />
                          <span className="text-xs text-white/85 truncate font-light tracking-[-0.005em]">{uploadedFileName}</span>
                        </div>
                        <button onClick={clearUpload} className="text-white/60 hover:text-white p-1.5 rounded-full hover:bg-glass-active transition-all duration-300">
                          <X className="w-4 h-4" strokeWidth={1.5} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => modeConfig?.requiresVideo ? videoInputRef.current?.click() : imageInputRef.current?.click()}
                      onDrop={(e) => handleDrop(e, modeConfig?.requiresVideo ? 'video' : 'image')}
                      onDragOver={handleDragOver}
                      className="group/upload cursor-pointer rounded-3xl hover:bg-white/[0.025] transition-all duration-500 p-6 flex items-center gap-4"
                      style={{
                        background: 'hsla(0,0%,100%,0.012)',
                        backdropFilter: 'blur(32px) saturate(180%)',
                        WebkitBackdropFilter: 'blur(32px) saturate(180%)',
                        boxShadow: 'inset 0 0 0 1px hsla(0,0%,100%,0.04)',
                      }}
                    >
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover/upload:scale-105"
                        style={{
                          background: 'linear-gradient(180deg, hsla(215,100%,60%,0.12) 0%, hsla(215,100%,55%,0.04) 100%)',
                          boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.06)',
                        }}
                      >
                        {(imageUpload.isUploading || videoUpload.isUploading) ? (
                          <Loader2 className="w-5 h-5 text-[hsl(215,100%,75%)] animate-spin" strokeWidth={1.5} />
                        ) : (
                          <Upload className="w-5 h-5 text-[hsl(215,100%,75%)]" strokeWidth={1.5} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] text-white/85 font-light tracking-[-0.005em]">
                          {(imageUpload.isUploading || videoUpload.isUploading)
                            ? `Uploading… ${imageUpload.progress || videoUpload.progress}%`
                            : `Drop ${modeConfig?.requiresVideo ? 'a video' : 'an image'} or click to upload`}
                        </p>
                        <p className="text-[11px] text-white/40 mt-1 font-light tracking-[0.005em]">
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
                <div
                  className="relative rounded-3xl p-6 sm:p-7 transition-all duration-700 focus-within:bg-glass-hover"
                  style={{
                    background: 'linear-gradient(180deg, hsla(0,0%,100%,0.025) 0%, hsla(0,0%,100%,0.005) 100%)',
                    boxShadow: 'inset 0 0 0 1px hsla(0,0%,100%,0.04), inset 0 1px 0 hsla(0,0%,100%,0.05)',
                  }}
                >
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
                  className="w-full resize-none border-0 bg-transparent text-white placeholder:text-white/22 text-lg sm:text-xl leading-[1.45] focus-visible:ring-0 focus-visible:ring-offset-0 px-0 py-0 font-light tracking-[-0.015em]"
                />
                  {/* Character counter */}
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-[0.24em] text-white/30 font-light">
                      Prompt
                    </span>
                    <span className="text-[10px] tabular-nums text-white/30 font-light">
                      {prompt.length} / 1000
                    </span>
                  </div>
                </div>

                {/* Inline footer rail (controls + advanced trigger + CTA) */}
                <div className="mt-5 flex items-center justify-center sm:justify-between gap-3 flex-wrap">
                  {/* Compact icon controls */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Aspect popover-less inline cycle */}
                    <ControlPill
                      icon={ASPECT_RATIOS.find(a => a.id === aspectRatio)?.icon || RectangleHorizontal}
                      label={aspectRatio}
                      onClick={() => {
                        // Cycle ONLY through aspect ratios the engine actually supports.
                        const legal = aspectOptions;
                        if (legal.length === 0) return;
                        const idx = legal.findIndex(a => a.id === aspectRatio);
                        setAspectRatio(legal[(idx + 1) % legal.length].id);
                      }}
                      title={`Aspect ratio (${engineCaps.label} supports ${engineCaps.aspectRatios.join(', ')})`}
                    />
                    {/* Scenes stepper — explicit, no cycling */}
                    <div
                      className="h-10 inline-flex items-center gap-1 rounded-full bg-glass hover:bg-glass-hover transition-colors duration-300 pl-2 pr-1"
                      title={`Number of scenes (1 – ${maxClips})`}
                    >
                      <Hash className="w-3.5 h-3.5 text-white/45" strokeWidth={1.5} />
                      <button
                        type="button"
                        onClick={() => setClipCount(Math.max(1, clipCount - 1))}
                        disabled={clipCount <= 1}
                        className="h-7 w-7 inline-flex items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/[0.07] disabled:opacity-30 disabled:hover:bg-transparent transition"
                        aria-label="Fewer scenes"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="min-w-[3.25rem] text-center text-[12px] font-light tracking-[-0.005em] text-white/85 tabular-nums">
                        {clipCount} <span className="text-white/35">scene{clipCount > 1 ? 's' : ''}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setClipCount(Math.min(maxClips, clipCount + 1))}
                        disabled={clipCount >= maxClips}
                        className="h-7 w-7 inline-flex items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/[0.07] disabled:opacity-30 disabled:hover:bg-transparent transition"
                        aria-label="More scenes"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <span className="pr-2 text-[10px] tabular-nums text-white/30 font-light">/ {maxClips}</span>
                    </div>

                    {/* Default duration — applied to every NEW scene and to
                        all scenes when clicked (apply-to-all). Shows only
                        engine-supported values. */}
                    <div
                      className="h-10 inline-flex items-center gap-0.5 rounded-full bg-glass pl-2 pr-1"
                      title={`Default scene duration · ${engineCaps.label} supports ${clipDurationOptions.join('/')}s`}
                    >
                      <Clock className="w-3.5 h-3.5 text-white/45 mr-1" strokeWidth={1.5} />
                      {clipDurationOptions.map((d) => {
                        const active = d === clipDuration;
                        return (
                          <button
                            key={d}
                            type="button"
                            onClick={() => {
                              setClipDuration(d);
                              setClipDurations((prev) => prev.map(() => d));
                            }}
                            className={cn(
                              'h-8 px-3 inline-flex items-center justify-center rounded-full text-[11.5px] font-light tracking-[-0.005em] transition-all duration-300 tabular-nums',
                              active
                                ? 'text-[hsl(215,100%,82%)] shadow-[inset_0_1px_0_hsla(0,0%,100%,0.08)]'
                                : 'text-white/55 hover:text-white/90 hover:bg-glass-hover'
                            )}
                            style={active ? {
                              background: 'linear-gradient(180deg, hsla(215,100%,60%,0.22) 0%, hsla(215,100%,55%,0.10) 100%)',
                              boxShadow: '0 0 14px hsla(215,100%,60%,0.28), inset 0 1px 0 hsla(0,0%,100%,0.08)',
                            } : undefined}
                            aria-pressed={active}
                            aria-label={`Set every scene to ${d} seconds`}
                          >
                            {d}s
                          </button>
                        );
                      })}
                    </div>

                    {/* Live total runtime readout */}
                    <div
                      className="h-10 hidden sm:inline-flex items-center gap-1.5 px-3.5 rounded-full bg-glass text-[11.5px] font-light tracking-[-0.005em] text-white/55"
                      title="Total runtime (scenes × per-scene duration)"
                    >
                      <Timer className="w-3.5 h-3.5 text-white/40" strokeWidth={1.5} />
                      <span className="tabular-nums text-white/80">
                        {estimatedDuration}s
                      </span>
                      <span className="text-white/30">total</span>
                    </div>
                    <button
                      onClick={() => setEnableNarration(v => !v)}
                      className={cn(
                        'h-10 w-10 inline-flex items-center justify-center rounded-full border-0 transition-all duration-500 hover:scale-105',
                        enableNarration
                          ? 'text-[hsl(215,100%,80%)]'
                          : 'bg-glass text-white/40 hover:text-white/80 hover:bg-glass-active'
                      )}
                      style={enableNarration ? {
                        background: 'linear-gradient(180deg, hsla(215,100%,60%,0.20) 0%, hsla(215,100%,55%,0.08) 100%)',
                        boxShadow: '0 0 16px hsla(215,100%,60%,0.30), inset 0 1px 0 hsla(0,0%,100%,0.08)',
                      } : undefined}
                      title={enableNarration ? 'Narration on' : 'Narration off'}
                    >
                      <Mic className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                    {supportsAdvancedOptions && (
                      <button
                        onClick={() => setShowAdvanced(v => !v)}
                        className={cn(
                          'h-10 inline-flex items-center gap-1.5 px-4 rounded-full border-0 text-[12px] font-light tracking-[-0.005em] transition-all duration-500 hover:scale-[1.02]',
                          showAdvanced
                            ? 'bg-white/[0.07] text-white shadow-[inset_0_1px_0_hsla(0,0%,100%,0.06)]'
                            : 'bg-glass text-white/55 hover:text-white/90 hover:bg-glass-active'
                        )}
                        title="Advanced"
                      >
                        <Settings2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                        <ChevronDown className={cn('w-3 h-3 transition-transform duration-500', showAdvanced && 'rotate-180')} strokeWidth={1.5} />
                      </button>
                    )}
                  </div>

                  {/* Premium CTA with halo */}
                  <div className="relative w-full sm:w-auto flex justify-center sm:block">
                    {/* Halo glow */}
                    {!hasKnownInsufficientCredits && isReadyToCreate() && !isVerifyingCredits && (
                      <span
                        className="pointer-events-none absolute -inset-2 rounded-full opacity-70 animate-pulse"
                        style={{
                          background: 'radial-gradient(ellipse at center, hsla(215,100%,60%,0.55) 0%, transparent 70%)',
                          filter: 'blur(20px)',
                        }}
                      />
                    )}
                    <Button
                      onClick={handleCreate}
                      disabled={!isReadyToCreate() || isVerifyingCredits}
                      className={cn(
                        'group/cta relative h-12 px-6 rounded-full text-[13px] font-light tracking-[-0.005em] transition-all duration-500 overflow-hidden border-0',
                        hasKnownInsufficientCredits
                          ? 'text-black'
                          : 'text-white',
                        'hover:brightness-110 hover:scale-[1.03] active:scale-[0.98]',
                        'disabled:opacity-30 disabled:shadow-none disabled:scale-100'
                      )}
                      style={hasKnownInsufficientCredits ? {
                        background: 'linear-gradient(180deg, hsl(40,95%,68%) 0%, hsl(35,90%,55%) 100%)',
                        boxShadow: '0 16px 40px -12px hsla(40,90%,55%,0.55), inset 0 1px 0 hsla(0,0%,100%,0.4)',
                      } : {
                        background: 'linear-gradient(180deg, hsl(215,100%,62%) 0%, hsl(215,100%,48%) 100%)',
                        boxShadow: '0 16px 48px -12px hsla(215,100%,55%,0.7), 0 0 24px hsla(215,100%,60%,0.25), inset 0 1px 0 hsla(215,100%,85%,0.45), inset 0 -1px 0 hsla(215,100%,25%,0.4)',
                      }}
                    >
                      <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover/cta:translate-x-full transition-transform duration-[1100ms] ease-in-out" />
                      <span className="relative flex items-center gap-2.5">
                        {isVerifyingCredits ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} /> Verifying
                          </>
                        ) : hasKnownInsufficientCredits ? (
                          <>
                            <Coins className="w-4 h-4" strokeWidth={1.5} /> Get credits <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" strokeWidth={1.5} />
                            <span>Create</span>
                            <span className="h-3.5 w-px bg-white/25" />
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-light tracking-[0.10em]"
                              style={{
                                background: 'hsla(0,0%,100%,0.18)',
                                color: '#fff',
                                boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.20)',
                              }}
                            >
                              <Cpu className="w-2.5 h-2.5" strokeWidth={1.5} />
                              {engineInfo.label}
                            </span>
                            <span className="h-3.5 w-px bg-white/25" />
                            <span className="opacity-90 tabular-nums text-[13px] font-light">{estimatedCredits}</span>
                            <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover/cta:translate-x-0.5" strokeWidth={1.5} />
                          </>
                        )}
                      </span>
                    </Button>
                  </div>
                </div>

                {/* ── Per-scene durations ──────────────────────────────────
                    One compact dropdown per scene, scrollable horizontally
                    on narrow viewports. Options are constrained to the
                    chosen engine's supported durations and update live
                    when the user switches engines. */}
                {!isBreakoutTemplate && clipCount > 1 && (
                  <div className="mt-4 -mx-1 px-1">
                    {clampNotice && (
                      <div
                        role="status"
                        aria-live="polite"
                        className="mb-3 mx-1 flex items-start gap-3 rounded-2xl border border-[hsla(38,92%,60%,0.22)] bg-[hsla(38,92%,55%,0.06)] px-4 py-3 text-[11.5px] font-light text-white/80"
                      >
                        <span className="mt-[2px] inline-block h-1.5 w-1.5 rounded-full bg-[hsl(38,92%,60%)] shrink-0" />
                        <div className="flex-1 leading-relaxed">
                          <div className="text-white/90">
                            <span className="font-normal">{clampNotice.engineLabel}</span>
                            <span className="text-white/50"> only supports </span>
                            <span className="tabular-nums">{clampNotice.allowed.join(' / ')}s</span>
                            <span className="text-white/50">. Auto-adjusted:</span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-white/55 tabular-nums">
                            {clampNotice.changes.map((c, i) => (
                              <span key={i}>
                                <span className="text-white/40">{c.label}</span>{' '}
                                {c.from}s <span className="text-white/30">→</span>{' '}
                                <span className="text-white/85">{c.to}s</span>
                              </span>
                            ))}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setClampNotice(null)}
                          className="text-white/40 hover:text-white/80 text-[11px] px-1 py-0.5 rounded transition-colors"
                          aria-label="Dismiss notice"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <span className="text-[10.5px] uppercase tracking-[0.14em] text-white/35 font-light">
                        Per-scene length
                      </span>
                      <span className="text-[10.5px] text-white/25 font-light">
                        · {engineCaps.label} · {clipDurationOptions.join(' / ')}s
                      </span>
                    </div>
                    <div
                      className="flex flex-wrap gap-1.5"
                      role="group"
                      aria-label="Per-scene durations"
                    >
                      {alignedDurations.map((sceneDuration, idx) => (
                        <Select
                          key={idx}
                          value={String(sceneDuration)}
                          onValueChange={(v) => {
                            const next = Number(v);
                            setClipDurations((prev) => {
                              const arr = [...prev];
                              while (arr.length < clipCount) arr.push(clipDuration);
                              arr[idx] = next;
                              return arr.slice(0, clipCount);
                            });
                          }}
                        >
                          <SelectTrigger
                            className="h-8 w-[88px] bg-white/[0.025] hover:bg-glass-hover border-0 rounded-full pl-3 pr-2 text-[11px] font-light tabular-nums text-white/80 focus:ring-1 focus:ring-[hsla(215,100%,60%,0.35)] transition-colors"
                            aria-label={`Scene ${idx + 1} duration`}
                            title={`Scene ${idx + 1} · ${engineCaps.label}`}
                          >
                            <span className="text-white/40 mr-1">S{idx + 1}</span>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {clipDurationOptions.map((d) => (
                              <SelectItem key={d} value={String(d)}>{d}s</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ))}
                    </div>
                  </div>
                )}

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
                            <SelectTrigger className="bg-glass border-0 text-white h-11 rounded-full px-4 font-light text-[13px] hover:bg-glass-hover focus:ring-1 focus:ring-[hsla(215,100%,60%,0.35)] transition-all duration-400">
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
                            <SelectTrigger className="bg-glass border-0 text-white h-11 rounded-full px-4 font-light text-[13px] hover:bg-glass-hover focus:ring-1 focus:ring-[hsla(215,100%,60%,0.35)] transition-all duration-400">
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

                {hasKnownInsufficientCredits && (
                  <p className="mt-3 text-[12px] text-amber-300/85 font-light tracking-[-0.005em]">
                    Need {estimatedCredits - displayedCredits} more credits ·{' '}
                    <button onClick={() => setShowBuyCredits(true)} className="underline underline-offset-2 hover:text-amber-200 transition-colors">Top up</button>
                  </p>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* ─── Tiny meta strip (estimated runtime) ─────────────────────── */}
        <div className="mt-6 flex items-center justify-center gap-4 text-[10px] text-white/40 uppercase tracking-[0.22em] font-light">
          <span>≈ {estMin > 0 ? `${estMin}m ${estSec}s` : `${estSec}s`} runtime</span>
          <span className="opacity-40">·</span>
          <span>{estimatedCredits} credits</span>
          <span className="opacity-40">·</span>
          <span>{aspectRatio}</span>
          <span className="opacity-40">·</span>
          <span className="text-[hsl(215,100%,75%)]">{engineInfo.label}</span>
        </div>

        {/* ─── Quiet links — Templates & Training ─────────────────────── */}
        <div className="mt-12 flex items-center justify-center gap-6 text-[13px] text-white/45 font-light tracking-[-0.005em]">
          <a href="/templates" className="group inline-flex items-center gap-1.5 hover:text-white transition-colors duration-400">
            <Layers className="w-3.5 h-3.5 opacity-70" strokeWidth={1.5} /> Templates
            <ChevronRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-400" strokeWidth={1.5} />
          </a>
          <span className="w-px h-3 bg-glass-active" />
          <a href="/training-video" className="group inline-flex items-center gap-1.5 hover:text-white transition-colors duration-400">
            <Film className="w-3.5 h-3.5 opacity-70" strokeWidth={1.5} /> Training
            <ChevronRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-400" strokeWidth={1.5} />
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
      className="group/pill h-10 inline-flex items-center gap-2 px-4 rounded-full border-0 bg-white/[0.035] hover:bg-white/[0.07] text-white/75 hover:text-white text-[12px] font-light tabular-nums tracking-[-0.005em] transition-all duration-500 hover:-translate-y-px hover:scale-[1.03]"
      style={{
        boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.04)',
      }}
    >
      <Icon className="w-3.5 h-3.5 opacity-70 group-hover/pill:opacity-100 group-hover/pill:text-[hsl(215,100%,75%)] transition-all duration-500" strokeWidth={1.5} />
      <span>{label}</span>
    </button>
  );
}

function FieldShell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] uppercase tracking-[0.22em] text-white/40 font-light">{label}</Label>
      {children}
    </div>
  );
}
