/**
 * /training-video — editorial 4-step wizard.
 *
 * STEP 1 — Script   :  textarea + tone picker + word/time counter + starter templates
 * STEP 2 — Voice    :  5 editorial rails by persona group (27 voices, MiniMax)
 * STEP 3 — Character:  tabs · Upload / Stock library (10 archetypes) / Webcam
 * STEP 4 — Scene    :  6 editorial rails by world (52 scenes, all from /assets/environments)
 *
 * Right rail: live composite preview, cost + ETA preview, settings, Generate CTA.
 *
 * Visual language matches Templates / Environments / Crossover: floating
 * glassmorphic panels, gradient italic titles, mono labels, editorial typography.
 *
 * Generation pipeline preserved exactly:
 *   character image → composite-character → mode-router (avatar) →
 *   Kling V3 or Seedance 2 → polling movie_projects →
 *   insert into training_videos.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useStudio } from "@/contexts/StudioContext";
import { useSafeNavigation, useRouteCleanup, useNavigationAbort } from "@/lib/navigation";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Mic, User as UserIcon, Image as ImageIcon, Upload,
  Play, Pause, Loader2, Check, ArrowRight, ArrowLeft, X,
  Settings as SettingsIcon, ChevronDown, ChevronUp, RotateCcw,
  Download, Cpu, Clock, Camera, Sun, Moon, Wand2, Star,
  AlertCircle, Layers, Film,
} from "lucide-react";
import { IconFilterTile, IconFilterRow } from "@/components/ui/IconFilterTile";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { BrandedVideoPlayer } from "@/components/intro/BrandedVideoPlayer";
import { FoundationShell } from "@/components/foundation/FoundationShell";
import { EditorialCanvas, EditorialEyebrow, EditorialHeadline } from "@/components/foundation/EditorialCanvas";
import { AutoGallery } from "@/components/foundation/AutoGallery";
import { HeroGalleryBackdrop } from "@/components/foundation/HeroGalleryBackdrop";
import { useLiveRenderTimecode } from "@/hooks/useLiveRenderTimecode";
import { usePageMeta } from "@/hooks/usePageMeta";
import { CreditsDisplay } from "@/components/studio/CreditsDisplay";
import homeStudioImg from "@/assets/environments/home-studio.jpg";

import { VOICE_BLUEPRINTS, getVoiceBlueprint } from "@/lib/voices/registry";
import {
  type VoiceBlueprint, type VoicePersonaGroup,
  VOICE_PERSONA_LABELS, VOICE_PERSONA_SHORT,
  VOICE_ACCENT_LABELS, VOICE_PACING_LABELS,
  VOICE_USECASE_LABELS, estimateSpeechSec,
  groupVoicesByPersona,
} from "@/lib/voices/blueprint";

import {
  TRAINING_SCENE_BLUEPRINTS, getTrainingScene,
} from "@/lib/training/scene-registry";
import {
  type TrainingSceneBlueprint, type SceneWorld,
  SCENE_WORLD_LABELS, SCENE_WORLD_SHORT,
  SCENE_LIGHTING_LABELS, PRODUCTION_TIER_LABELS,
} from "@/lib/training/scene-blueprint";

import {
  CHARACTER_BLUEPRINTS, groupCharactersByArchetype, getCharacter,
} from "@/lib/training/character-blueprint";
import {
  type CharacterBlueprint, type CharacterArchetype,
  CHARACTER_ARCHETYPE_LABELS,
} from "@/lib/training/character-blueprint";
import { useAvatarTemplatesQuery } from "@/hooks/useAvatarTemplatesQuery";
import type { AvatarTemplate } from "@/types/avatar-templates";
import { usePageTone, TONE_PRESETS } from "@/lib/page-tone";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
type GenerationStep = "idle" | "generating_audio" | "generating_video" | "applying_lipsync" | "complete" | "error";
type ScriptTone = "professional" | "conversational" | "energetic" | "authoritative" | "narrative";

const TONE_LABELS: Record<ScriptTone, string> = {
  professional: "Professional",
  conversational: "Conversational",
  energetic: "Energetic",
  authoritative: "Authoritative",
  narrative: "Narrative",
};

// Tone → recommended voice persona (drives "Suggested voice" hint)
const TONE_TO_VOICE_GROUP: Record<ScriptTone, VoicePersonaGroup> = {
  professional:   "professional",
  conversational: "conversational",
  energetic:      "energetic",
  authoritative:  "authoritative",
  narrative:      "narrative",
};

const SCRIPT_STARTERS: { id: string; label: string; text: string; tone: ScriptTone }[] = [
  { id: "welcome", label: "Welcome / onboarding", tone: "professional",
    text: "Welcome to today's session. By the end of this video, you'll know exactly how to get started — and more importantly, why it matters for your day-to-day work." },
  { id: "product",  label: "Product reveal", tone: "energetic",
    text: "Okay, I'm going to show you something that's about to change how you work. Three seconds. That's all I need." },
  { id: "course",   label: "Course intro", tone: "narrative",
    text: "Today's lesson is one of those things that sounds simple until you try it. So let's walk through it together, step by step, until it clicks." },
  { id: "executive", label: "Executive update", tone: "authoritative",
    text: "Here's where we are. Here's where we're going. And here's what we're going to do differently starting Monday morning." },
];

const WIZARD_STEPS = [
  { id: "script",    label: "Script",    icon: Sparkles },
  { id: "voice",     label: "Voice",     icon: Mic },
  { id: "character", label: "Character", icon: UserIcon },
  { id: "scene",     label: "Scene",     icon: ImageIcon },
];

// Engine credit cost approximations — used for the live cost preview
const ENGINE_CREDITS_PER_CLIP: Record<string, number> = {
  kling:    25,  // ~5s
  seedance: 35,  // ~5s
};
const ENGINE_ETA_SEC_PER_CLIP: Record<string, number> = {
  kling:    90,
  seedance: 100,
};

// ─────────────────────────────────────────────────────────────────────────────
// Voice preview cache (preserved verbatim from old impl)
// ─────────────────────────────────────────────────────────────────────────────
const VOICE_CACHE_KEY = "sb_voice_preview_";
const VOICE_CACHE_VERSION = "v1";
function getCachedVoicePreview(voiceId: string): string | null {
  try {
    const cacheKey = `${VOICE_CACHE_KEY}${VOICE_CACHE_VERSION}_${voiceId}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const { audioUrl, timestamp } = JSON.parse(cached);
      const weekInMs = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - timestamp < weekInMs) return audioUrl;
      localStorage.removeItem(cacheKey);
    }
  } catch (e) { console.warn("Failed to read voice cache:", e); }
  return null;
}
function cacheVoicePreview(voiceId: string, audioUrl: string) {
  try {
    const cacheKey = `${VOICE_CACHE_KEY}${VOICE_CACHE_VERSION}_${voiceId}`;
    localStorage.setItem(cacheKey, JSON.stringify({ audioUrl, timestamp: Date.now() }));
  } catch (e) { console.warn("Failed to cache voice preview:", e); }
}

// Word counter helper
function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

// ─────────────────────────────────────────────────────────────────────────────
// Page body
// ─────────────────────────────────────────────────────────────────────────────
const TrainingContent = memo(function TrainingContent() {
  usePageTone(TONE_PRESETS.training);
  const { navigate } = useSafeNavigation();
  const { abort: abortRequests } = useNavigationAbort();
  useRouteCleanup(() => abortRequests(), [abortRequests]);

  const { user } = useAuth();
  const { credits } = useStudio();

  // ── Wizard state ────────────────────────────────────────────────
  const [activeStep, setActiveStep] = useState(0);

  // ── Script ──────────────────────────────────────────────────────
  const [scriptText, setScriptText] = useState("");
  const [scriptTone, setScriptTone] = useState<ScriptTone>("professional");

  // ── Voice ────────────────────────────────────────────────────────
  const [selectedVoice, setSelectedVoice] = useState<string>("nova");
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);

  // ── Character ────────────────────────────────────────────────────
  type CharacterSource = "stock" | "upload" | "webcam";
  const [characterSource, setCharacterSource] = useState<CharacterSource>("stock");
  const [selectedStockCharacter, setSelectedStockCharacter] = useState<string | null>("elena-chen");
  const [uploadedCharacterImage, setUploadedCharacterImage] = useState<string | null>(null);

  // ── Scene ────────────────────────────────────────────────────────
  const [selectedScene, setSelectedScene] = useState<string>("home_studio");

  // ── Settings ─────────────────────────────────────────────────────
  const [videoEngine, setVideoEngine] = useState<"kling" | "seedance">("kling");
  const [targetDuration, setTargetDuration] = useState<number | null>(null);
  const [characterLockStrict, setCharacterLockStrict] = useState(true);
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [cameraFixed, setCameraFixed] = useState(true);
  const [lightingMood, setLightingMood] = useState<"soft" | "cinematic" | "high-key" | "moody">("soft");
  const [clipCount, setClipCount] = useState(1);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ── Generation state ─────────────────────────────────────────────
  const [generationStep, setGenerationStep] = useState<GenerationStep>("idle");
  const [progress, setProgress] = useState(0);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const characterInputRef = useRef<HTMLInputElement>(null);

  // ── Derived ──────────────────────────────────────────────────────
  const activeVoice = useMemo(() => getVoiceBlueprint(selectedVoice), [selectedVoice]);
  const activeScene = useMemo(() => getTrainingScene(selectedScene), [selectedScene]);
  const activeStockCharacter = useMemo(
    () => selectedStockCharacter ? getCharacter(selectedStockCharacter) : null,
    [selectedStockCharacter],
  );

  // Effective character image — either stock URL or uploaded data URL
  const effectiveCharacterImage = useMemo(() => {
    if (characterSource === "upload") return uploadedCharacterImage;
    if (characterSource === "stock")  return activeStockCharacter?.image ?? null;
    return null; // webcam not implemented
  }, [characterSource, uploadedCharacterImage, activeStockCharacter]);

  const wordCount = countWords(scriptText);
  const speechEstimateSec = activeVoice ? estimateSpeechSec(wordCount, activeVoice.pacing) : 0;
  const finalDuration = targetDuration ?? Math.min(Math.ceil(scriptText.length / 15), 10);

  // Cost + ETA preview
  const estimatedCredits = ENGINE_CREDITS_PER_CLIP[videoEngine] * clipCount;
  const estimatedEtaSec = ENGINE_ETA_SEC_PER_CLIP[videoEngine] * clipCount;

  const isStepComplete = (i: number) => {
    if (i === 0) return scriptText.trim().length > 0;
    if (i === 1) return !!selectedVoice;
    if (i === 2) return !!effectiveCharacterImage;
    if (i === 3) return !!selectedScene;
    return false;
  };
  const isGenerating = ["generating_audio", "generating_video", "applying_lipsync"].includes(generationStep);
  const canGenerate = effectiveCharacterImage && scriptText.trim() && !isGenerating;

  // ── Voice preview playback (preserves existing logic) ───────────
  const handleVoicePreview = useCallback(async (voiceId: string) => {
    if (previewingVoiceId === voiceId && currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setPreviewingVoiceId(null);
      setCurrentAudio(null);
      return;
    }
    if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0; }

    setPreviewingVoiceId(voiceId);
    try {
      const cached = getCachedVoicePreview(voiceId);
      const voice = getVoiceBlueprint(voiceId);
      const previewText = voice?.sampleShort || "Hello, this is a voice preview.";

      let audioUrl: string | null = cached;
      if (!audioUrl) {
        const { data, error } = await supabase.functions.invoke("generate-voice", {
          body: { text: previewText, voiceId },
        });
        if (error) throw error;
        if (data?.audioUrl) audioUrl = data.audioUrl;
        else if (data?.audioBase64) audioUrl = `data:audio/mpeg;base64,${data.audioBase64}`;
        else throw new Error("No audio data");
        cacheVoicePreview(voiceId, audioUrl);
      }

      const audio = new Audio(audioUrl);
      setCurrentAudio(audio);
      audio.onended = () => { setPreviewingVoiceId(null); setCurrentAudio(null); };
      audio.onerror = () => {
        toast.error("Failed to play audio");
        setPreviewingVoiceId(null); setCurrentAudio(null);
      };
      await audio.play();
    } catch (err) {
      console.error("Voice preview error:", err);
      toast.error("Failed to preview voice");
      setPreviewingVoiceId(null); setCurrentAudio(null);
    }
  }, [previewingVoiceId, currentAudio]);

  // ── Auto-preload uncached voices on mount ───────────────────────
  useEffect(() => {
    const timeout = setTimeout(async () => {
      const uncached = VOICE_BLUEPRINTS.filter(v => !getCachedVoicePreview(v.id));
      if (uncached.length === 0) return;
      for (const voice of uncached) {
        try {
          const { data, error } = await supabase.functions.invoke("generate-voice", {
            body: { text: voice.sampleShort, voiceId: voice.id },
          });
          if (!error && data) {
            const url = data.audioUrl ?? (data.audioBase64 ? `data:audio/mpeg;base64,${data.audioBase64}` : null);
            if (url) cacheVoicePreview(voice.id, url);
          }
        } catch { /* silent — best-effort */ }
      }
    }, 1500);
    return () => clearTimeout(timeout);
  }, []);

  // ── Character upload handler ─────────────────────────────────────
  const handleCharacterUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image file"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Image must be less than 10MB"); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadedCharacterImage(e.target?.result as string);
      setCharacterSource("upload");
      setSelectedStockCharacter(null);
    };
    reader.readAsDataURL(file);
    toast.success("Character image uploaded");
  }, []);

  // ── Tone change → suggest a voice in that persona group ────────
  const onToneChange = (t: ScriptTone) => {
    setScriptTone(t);
    // If the user hasn't engaged with voices much, swap to a suggested voice
    const targetGroup = TONE_TO_VOICE_GROUP[t];
    if (activeVoice && activeVoice.group !== targetGroup) {
      const suggested = VOICE_BLUEPRINTS.find(v => v.group === targetGroup && v.isFeatured)
                     ?? VOICE_BLUEPRINTS.find(v => v.group === targetGroup);
      if (suggested) setSelectedVoice(suggested.id);
    }
  };

  // ── GENERATION (preserved verbatim from old TrainingVideo.tsx) ─
  const handleGenerate = async () => {
    if (!effectiveCharacterImage || !scriptText.trim()) {
      toast.error("Please select a character and enter script text");
      return;
    }
    if (!user) { toast.error("Please sign in to generate videos"); return; }

    setGenerationStep("generating_audio");
    setProgress(0);
    setError(null);
    setGeneratedVideoUrl(null);

    try {
      const backgroundImage = activeScene?.image ?? homeStudioImg;
      setProgress(8);

      // Step 2: Composite character onto background
      setGenerationStep("generating_video");
      toast.info("Extracting character and compositing onto scene...");

      let backgroundBase64: string | undefined;
      let backgroundUrl: string | undefined;
      if (backgroundImage.startsWith("data:")) backgroundBase64 = backgroundImage.split(",")[1];
      else if (backgroundImage.startsWith("http")) backgroundUrl = backgroundImage;
      else {
        try {
          const bgResponse = await fetch(backgroundImage);
          const bgBlob = await bgResponse.blob();
          const reader = new FileReader();
          backgroundBase64 = await new Promise<string>((resolve) => {
            reader.onload = () => {
              const result = reader.result as string;
              resolve(result.split(",")[1]);
            };
            reader.readAsDataURL(bgBlob);
          });
        } catch (e) {
          console.warn("Failed to load background, using URL:", e);
          backgroundUrl = backgroundImage;
        }
      }
      setProgress(20);

      // Resolve character into a base64 the compositor can ingest
      let characterBase64: string;
      if (effectiveCharacterImage.startsWith("data:")) {
        characterBase64 = effectiveCharacterImage.split(",")[1];
      } else {
        const cRes = await fetch(effectiveCharacterImage);
        const cBlob = await cRes.blob();
        const reader = new FileReader();
        characterBase64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.readAsDataURL(cBlob);
        });
      }

      const { data: compositeData, error: compositeError } = await supabase.functions.invoke("composite-character", {
        body: {
          characterBase64,
          backgroundBase64,
          backgroundImageUrl: backgroundUrl,
          placement: "center",
          scale: 0.7,
          aspectRatio,
        },
      });
      if (compositeError) console.warn("Compositing service error, falling back:", compositeError);
      setProgress(40);

      let startImageUrl: string;
      if (compositeData?.success && compositeData?.compositedImageUrl) {
        startImageUrl = compositeData.compositedImageUrl;
        toast.success(`Character composited onto scene (${compositeData.method})`);
      } else {
        toast.info("Using character image directly for generation...");
        // Upload the character (either uploaded data URL or stock URL fetched into a Blob)
        let imageBlob: Blob;
        if (effectiveCharacterImage.startsWith("data:")) {
          imageBlob = await fetch(effectiveCharacterImage).then(r => r.blob());
        } else {
          imageBlob = await fetch(effectiveCharacterImage).then(r => r.blob());
        }
        const imageFileName = `${user.id}/training-avatar-${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("character-references")
          .upload(imageFileName, imageBlob, { contentType: "image/jpeg", upsert: true });
        if (uploadError) {
          console.warn("Image upload failed:", uploadError);
          startImageUrl = effectiveCharacterImage;
        } else {
          const { data: signed, error: signErr } = await supabase.storage
            // 10-minute TTL — this URL is consumed by the generation
            // call within seconds, so a 1-hour window only widened the
            // post-logout exposure of a private reference image for no
            // functional gain.
            .createSignedUrl(imageFileName, 600);
          if (signErr || !signed?.signedUrl) startImageUrl = effectiveCharacterImage;
          else startImageUrl = signed.signedUrl;
        }
      }

      // Mode router dispatch
      toast.info(`Dispatching to ${videoEngine === "seedance" ? "Seedance 2" : "Kling V3"} pipeline...`);
      setProgress(45);

      const lightingPhrase = {
        soft: "soft diffused key light, gentle fill, flattering presenter lighting",
        cinematic: "cinematic chiaroscuro lighting, controlled shadows, filmic contrast",
        "high-key": "bright high-key broadcast lighting, evenly lit, low contrast",
        moody: "moody low-key lighting, deep shadows, dramatic single source",
      }[lightingMood];
      const cameraPhrase = cameraFixed
        ? "locked-off static camera, no camera movement, subject motion only"
        : "subtle handheld presenter framing, gentle parallax, no zoom";
      const lockPhrase = characterLockStrict
        ? "identity locked: preserve exact facial features, hairstyle, clothing, and skin tone of the reference person without drift"
        : "preserve general likeness of the reference person";
      const tonePhrase = `Tone: ${scriptTone}.`;
      const animationPrompt = `The person in the image is speaking naturally to camera with confident body language. Direct eye contact, subtle natural head movements, professional presenter demeanor. ${tonePhrase} No scene change, consistent environment. ${lightingPhrase}. ${cameraPhrase}. ${lockPhrase}.`;

      const envName = activeScene?.name ?? "studio";
      const characterDescription = activeStockCharacter
        ? `Reference presenter: ${activeStockCharacter.persona}. ${activeStockCharacter.styleNote}`
        : "The reference presenter — preserve exact face, hairstyle, wardrobe, skin tone, and proportions across every clip.";
      const trainingIdentityBible = {
        version: "training-v1",
        characterIdentity: { description: characterDescription, strict: characterLockStrict },
        masterSceneAnchor: {
          environmentDNA: `${envName} — locked environment, identical framing, identical lighting (${lightingMood}) across all clips`,
          aspectRatio,
        },
        consistencyPrompt: `${characterDescription} ${envName}. ${lightingPhrase}. ${cameraPhrase}.`,
        cameraGrammar: cameraFixed ? "locked-off static" : "subtle handheld",
        continuityRules: [
          "Identical character identity in every clip",
          "Identical wardrobe and accessories",
          "Identical environment and lighting",
          "No scene change between clips",
          "Maintain presenter eyeline and framing",
        ],
      };

      const { data: routerData, error: routerError } = await supabase.functions.invoke("mode-router", {
        body: {
          mode: "avatar",
          prompt: `${scriptText}\n\nDirection: ${animationPrompt}`,
          referenceImageUrl: startImageUrl,
          imageUrl: startImageUrl,
          voiceId: selectedVoice,
          aspectRatio,
          clipCount,
          clipDuration: finalDuration,
          enableNarration: true,
          enableMusic: false,
          videoEngine,
          characterLock: {
            strict: characterLockStrict,
            source: "training_video",
            description: characterDescription,
          },
          identityBible: trainingIdentityBible,
        },
      });

      if (routerError) throw routerError;
      if (!routerData?.projectId) throw new Error(routerData?.error || "Pipeline did not return a project id");

      const projectId = routerData.projectId as string;
      toast.info("Pipeline running — multi-clip continuity, voice mux, and stitching in progress...");

      const maxAttempts = 90, pollInterval = 5000;
      let finalVideoUrl: string | null = null;
      let stitchedUrl: string | null = null;
      let manifestUrl: string | null = null;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise(r => setTimeout(r, pollInterval));
        setProgress(45 + Math.min(40, Math.floor((attempt / maxAttempts) * 40)));
        const { data: proj, error: projErr } = await supabase
          .from("movie_projects")
          .select("status, video_url, last_error, pipeline_state, pro_features_data")
          .eq("id", projectId)
          .maybeSingle();
        if (projErr) { console.warn("Project poll error:", projErr); continue; }
        if (proj?.status === "completed" && proj.video_url) {
          finalVideoUrl = proj.video_url;
          const pf = (proj.pro_features_data as Record<string, unknown>) || {};
          stitchedUrl = (pf.stitchedVideoUrl as string) || (pf.stitched_video_url as string) || (clipCount > 1 ? proj.video_url : null);
          manifestUrl = (pf.manifestUrl as string) || (pf.stitchManifestUrl as string) || null;
          break;
        }
        if (proj?.status === "failed") throw new Error(proj.last_error || "Pipeline failed");
        if (attempt > 0 && attempt % 6 === 0) {
          const stage = (proj?.pipeline_state as Record<string, unknown> | null)?.stage || "processing";
          toast.info(`Still rendering (${stage})...`);
        }
      }
      if (!finalVideoUrl) throw new Error("Video generation timed out after 7 minutes");

      setProgress(80);
      setGeneratedVideoUrl(finalVideoUrl);
      setGenerationStep("complete");
      setProgress(100);

      // Save to training_videos
      if (finalVideoUrl && user) {
        try {
          await supabase.from("training_videos").insert({
            user_id: user.id,
            title: `Training Video - ${new Date().toLocaleDateString()}`,
            description: scriptText.slice(0, 200),
            video_url: finalVideoUrl,
            voice_id: selectedVoice,
            environment: selectedScene,
            project_id: projectId,
            video_engine: videoEngine,
            clip_count: clipCount,
            aspect_ratio: aspectRatio,
            stitched_video_url: stitchedUrl,
            manifest_url: manifestUrl,
            duration_seconds: finalDuration * clipCount,
          });
        } catch (saveErr) { console.error("Error saving training video:", saveErr); }
      }
      toast.success("Training video generated successfully!");
    } catch (err) {
      console.error("Generation error:", err);
      setError("Failed to generate video. Please try again.");
      setGenerationStep("error");
      toast.error("Failed to generate training video");
    }
  };

  const handleReset = () => {
    setScriptText("");
    setSelectedVoice("nova");
    setCharacterSource("stock");
    setSelectedStockCharacter("elena-chen");
    setUploadedCharacterImage(null);
    setSelectedScene("home_studio");
    setGenerationStep("idle");
    setProgress(0);
    setGeneratedVideoUrl(null);
    setError(null);
    setActiveStep(0);
  };

  // ─── RENDER ──────────────────────────────────────────────────────
  return (
    <div className="relative">
      {/* ── HERO + WIZARD — one cinematic section with the auto-gallery
            cycling behind the title, description, and wizard breadcrumb.
            Full-bleed (extends behind the LeftRail when open) via
            HeroGalleryBackdrop. */}
      <section className="relative mb-8">
        <HeroGalleryBackdrop>
          <AutoGallery
            items={TRAINING_SCENE_BLUEPRINTS.map((s) => ({
              id: s.id,
              name: s.name,
              imageUrl: s.image,
              caption: SCENE_WORLD_SHORT[s.world],
              glow: sceneWorldGlow(s.world),
            }))}
            variant="hero"
          />
        </HeroGalleryBackdrop>

        <div className="relative z-10 pt-8 sm:pt-12 pb-7">
          <EditorialEyebrow>Training</EditorialEyebrow>
          <EditorialHeadline className="mt-5" size="md">
            Talking heads.
          </EditorialHeadline>
          <p className="mt-5 max-w-xl text-[14px] font-light leading-relaxed text-foreground/75">
            Script + voice + presenter + scene — composited, lip-synced, stitched.
          </p>

          <nav className="mt-7 flex flex-wrap items-center gap-2">
            {WIZARD_STEPS.map((step, i) => {
              const Icon = step.icon;
              const done = isStepComplete(i);
              const active = activeStep === i;
              return (
                <button
                  key={step.id}
                  onClick={() => setActiveStep(i)}
                  className={cn(
                    "inline-flex items-center gap-2 h-10 px-4 rounded-full text-[11px] font-mono uppercase tracking-[0.18em] transition-all backdrop-blur-xl",
                    active
                      ? "text-foreground bg-foreground/[0.12] ring-1 ring-inset ring-white/[0.25] shadow-[0_8px_24px_-12px_hsla(0,0%,100%,0.45)]"
                      : done
                      ? "text-emerald-200/90 ring-1 ring-inset ring-emerald-300/30 bg-emerald-500/[0.06]"
                      : "text-foreground/65 hover:text-foreground/95 ring-1 ring-inset ring-white/[0.10] hover:ring-white/[0.20] bg-white/[0.04]",
                  )}
                >
                  <span className={cn(
                    "inline-flex items-center justify-center h-5 w-5 rounded-full font-mono text-[10px]",
                    active ? "bg-foreground text-background" : done ? "bg-emerald-400/85 text-background" : "bg-white/[0.10] text-foreground/75"
                  )}>
                    {done ? <Check className="w-3 h-3" /> : i + 1}
                  </span>
                  <Icon className="w-3.5 h-3.5" />
                  {step.label}
                </button>
              );
            })}
          </nav>
        </div>
      </section>

      {/* ── BODY GRID ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 pb-16">
        {/* LEFT: ACTIVE STEP */}
        <main className="min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              {activeStep === 0 && (
                <ScriptStep
                  scriptText={scriptText}
                  onChange={setScriptText}
                  tone={scriptTone}
                  onToneChange={onToneChange}
                  wordCount={wordCount}
                  speechEstimateSec={speechEstimateSec}
                  activeVoice={activeVoice}
                />
              )}
              {activeStep === 1 && (
                <VoiceStep
                  selected={selectedVoice}
                  onSelect={setSelectedVoice}
                  previewingId={previewingVoiceId}
                  onPreview={handleVoicePreview}
                  suggestedGroup={TONE_TO_VOICE_GROUP[scriptTone]}
                />
              )}
              {activeStep === 2 && (
                <CharacterStep
                  source={characterSource}
                  onSourceChange={setCharacterSource}
                  selectedStock={selectedStockCharacter}
                  onSelectStock={setSelectedStockCharacter}
                  uploadedImage={uploadedCharacterImage}
                  onUploadClick={() => characterInputRef.current?.click()}
                  inputRef={characterInputRef}
                  onUploadChange={handleCharacterUpload}
                />
              )}
              {activeStep === 3 && (
                <SceneStep
                  selected={selectedScene}
                  onSelect={setSelectedScene}
                  activeVoice={activeVoice}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Step navigation footer */}
          <div className="mt-8 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              disabled={activeStep === 0}
              onClick={() => setActiveStep(s => Math.max(0, s - 1))}
              className="rounded-full border-white/[0.10] bg-white/[0.02] backdrop-blur"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              Back
            </Button>
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-foreground/40">
              Step {activeStep + 1} of {WIZARD_STEPS.length}
            </span>
            <Button
              size="sm"
              disabled={activeStep === WIZARD_STEPS.length - 1 || !isStepComplete(activeStep)}
              onClick={() => setActiveStep(s => Math.min(WIZARD_STEPS.length - 1, s + 1))}
              className="rounded-full bg-foreground text-background hover:bg-foreground/90"
            >
              Next
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </div>
        </main>

        {/* RIGHT: STICKY PREVIEW + GENERATE */}
        <aside className="lg:sticky lg:top-6 lg:self-start space-y-4">
          {generatedVideoUrl ? (
            <div className="rounded-2xl ring-1 ring-inset ring-white/[0.06] bg-white/[0.015] backdrop-blur overflow-hidden">
              <BrandedVideoPlayer src={generatedVideoUrl} className="w-full aspect-video" />
              <div className="p-3 flex items-center justify-between gap-2">
                <a href={generatedVideoUrl} download="training-video.mp4">
                  <Button size="sm" variant="outline" className="rounded-full border-white/[0.10] bg-white/[0.02]">
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Download
                  </Button>
                </a>
                <Button size="sm" variant="ghost" onClick={handleReset} className="rounded-full">
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  New video
                </Button>
              </div>
            </div>
          ) : (
            <CompositePreview
              characterImage={effectiveCharacterImage}
              sceneImage={activeScene?.image ?? null}
              aspectRatio={aspectRatio}
            />
          )}

          {/* Cost + ETA */}
          <div className="rounded-2xl ring-1 ring-inset ring-white/[0.06] bg-white/[0.015] backdrop-blur p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-foreground/40 mb-3">
              Render plan
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-foreground/40">Engine</div>
                <div className="text-[14px] font-medium text-foreground/95 mt-0.5">
                  {videoEngine === "kling" ? "Kling V3" : "Seedance 2"}
                </div>
              </div>
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-foreground/40">Aspect</div>
                <div className="text-[14px] font-medium text-foreground/95 mt-0.5">{aspectRatio}</div>
              </div>
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-foreground/40">ETA</div>
                <div className="text-[14px] font-medium text-foreground/95 mt-0.5">
                  ~{Math.floor(estimatedEtaSec / 60)}m {estimatedEtaSec % 60}s
                </div>
              </div>
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-foreground/40">Cost</div>
                <div className="text-[14px] font-medium text-amber-200 mt-0.5">{estimatedCredits} credits</div>
              </div>
            </div>

            {/* Engine toggle */}
            <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-white/[0.05]">
              <button
                onClick={() => { setVideoEngine("kling"); setClipCount(1); }}
                className={cn(
                  "h-9 rounded-full text-[10px] font-mono uppercase tracking-[0.18em] transition-all",
                  videoEngine === "kling"
                    ? "bg-foreground/[0.10] ring-1 ring-inset ring-white/[0.20] text-foreground"
                    : "ring-1 ring-inset ring-white/[0.05] text-foreground/55 hover:text-foreground/85",
                )}
              >Kling V3</button>
              <button
                onClick={() => setVideoEngine("seedance")}
                className={cn(
                  "h-9 rounded-full text-[10px] font-mono uppercase tracking-[0.18em] transition-all",
                  videoEngine === "seedance"
                    ? "bg-foreground/[0.10] ring-1 ring-inset ring-white/[0.20] text-foreground"
                    : "ring-1 ring-inset ring-white/[0.05] text-foreground/55 hover:text-foreground/85",
                )}
              >Seedance 2</button>
            </div>

            {/* Settings collapsible */}
            <button
              onClick={() => setSettingsOpen(s => !s)}
              className="mt-3 w-full inline-flex items-center justify-between gap-1.5 text-[10px] font-mono uppercase tracking-[0.18em] text-foreground/55 hover:text-foreground/85 transition-colors"
            >
              <span className="inline-flex items-center gap-1.5">
                <SettingsIcon className="w-3 h-3" />
                Advanced settings
              </span>
              {settingsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            <AnimatePresence>
              {settingsOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 pt-3 border-t border-white/[0.05] space-y-3 overflow-hidden"
                >
                  <SettingRow label="Aspect ratio">
                    <div className="flex gap-1">
                      {(["16:9","9:16","1:1"] as const).map(a => (
                        <button key={a} onClick={() => setAspectRatio(a)}
                          className={cn(
                            "h-7 px-2 rounded-full text-[10px] font-mono",
                            aspectRatio === a ? "bg-foreground text-background" : "bg-white/[0.04] text-foreground/65 hover:bg-white/[0.08]"
                          )}>{a}</button>
                      ))}
                    </div>
                  </SettingRow>
                  <SettingRow label="Lighting">
                    <div className="flex flex-wrap gap-1">
                      {(["soft","cinematic","high-key","moody"] as const).map(l => (
                        <button key={l} onClick={() => setLightingMood(l)}
                          className={cn(
                            "h-7 px-2 rounded-full text-[10px] font-mono",
                            lightingMood === l ? "bg-foreground text-background" : "bg-white/[0.04] text-foreground/65 hover:bg-white/[0.08]"
                          )}>{l}</button>
                      ))}
                    </div>
                  </SettingRow>
                  <SettingRow label="Camera">
                    <button onClick={() => setCameraFixed(!cameraFixed)}
                      className="h-7 px-3 rounded-full text-[10px] font-mono bg-white/[0.04] text-foreground/85 hover:bg-white/[0.08]"
                    >{cameraFixed ? "Locked off" : "Subtle motion"}</button>
                  </SettingRow>
                  <SettingRow label="Identity lock">
                    <button onClick={() => setCharacterLockStrict(!characterLockStrict)}
                      className="h-7 px-3 rounded-full text-[10px] font-mono bg-white/[0.04] text-foreground/85 hover:bg-white/[0.08]"
                    >{characterLockStrict ? "Strict" : "Loose"}</button>
                  </SettingRow>
                  {videoEngine === "seedance" && (
                    <SettingRow label="Clips">
                      <div className="flex gap-1">
                        {[1,2,3].map(n => (
                          <button key={n} onClick={() => setClipCount(n)}
                            className={cn(
                              "h-7 w-8 rounded-full text-[10px] font-mono",
                              clipCount === n ? "bg-foreground text-background" : "bg-white/[0.04] text-foreground/65 hover:bg-white/[0.08]"
                            )}>{n}</button>
                        ))}
                      </div>
                    </SettingRow>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Generate CTA */}
          <Button
            size="lg"
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="w-full h-12 rounded-xl bg-foreground text-background hover:bg-foreground/90 font-medium"
          >
            {isGenerating ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating…</>
            ) : (
              <><Wand2 className="w-4 h-4 mr-2" />Generate training video<ArrowRight className="w-4 h-4 ml-2" /></>
            )}
          </Button>

          {/* Progress */}
          {isGenerating && (
            <div className="rounded-2xl ring-1 ring-inset ring-white/[0.06] bg-white/[0.015] backdrop-blur p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-foreground/40">{generationStep.replace(/_/g, " ")}</span>
                <span className="font-mono text-[10px] tabular-nums text-foreground/65">{progress}%</span>
              </div>
              <Progress value={progress} className="h-1" />
            </div>
          )}
          {error && (
            <div className="rounded-2xl ring-1 ring-inset ring-rose-300/15 bg-rose-500/[0.04] p-4 text-[12px] text-rose-200/85 inline-flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {!user && (
            <div className="rounded-2xl ring-1 ring-inset ring-amber-300/15 bg-amber-500/[0.04] p-4 text-[12px] text-amber-100/90">
              <strong>Sign in</strong> to generate videos. <button onClick={() => navigate("/auth")} className="underline">Go to sign in →</button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
});

TrainingContent.displayName = "TrainingContent";

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — Script
// ─────────────────────────────────────────────────────────────────────────────
function ScriptStep({
  scriptText, onChange, tone, onToneChange, wordCount, speechEstimateSec, activeVoice,
}: {
  scriptText: string;
  onChange: (s: string) => void;
  tone: ScriptTone;
  onToneChange: (t: ScriptTone) => void;
  wordCount: number;
  speechEstimateSec: number;
  activeVoice: VoiceBlueprint | undefined;
}) {
  return (
    <section>
      <header className="mb-6">
        <h2 className="text-[clamp(1.6rem,3.5vw,2.4rem)] font-display italic font-light leading-tight">
          <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/60 bg-clip-text text-transparent">
            What do they say?
          </span>
        </h2>
        <p className="mt-2 text-[13px] text-foreground/55">Write up to 500 characters. Pick a tone — we'll suggest a voice that fits.</p>
      </header>

      {/* Tone picker */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-foreground/40 mr-1">Tone</span>
        {(Object.keys(TONE_LABELS) as ScriptTone[]).map(t => (
          <button key={t} onClick={() => onToneChange(t)}
            className={cn(
              "inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[10px] font-mono uppercase tracking-[0.18em] transition-all",
              tone === t
                ? "bg-foreground/[0.10] ring-1 ring-inset ring-white/[0.16] text-foreground"
                : "ring-1 ring-inset ring-white/[0.06] text-foreground/55 hover:text-foreground/85 hover:ring-white/[0.12] bg-white/[0.015] backdrop-blur",
            )}
          >{TONE_LABELS[t]}</button>
        ))}
      </div>

      {/* Textarea */}
      <div className="rounded-2xl ring-1 ring-inset ring-white/[0.08] bg-white/[0.02] backdrop-blur p-4">
        <Textarea
          value={scriptText}
          onChange={(e) => onChange(e.target.value.slice(0, 500))}
          rows={7}
          placeholder="Today's training is one of those things that sounds simple — until you try it. So let's walk through it together…"
          className="resize-none bg-transparent border-0 p-0 text-[14.5px] leading-relaxed text-foreground placeholder:text-foreground/35 focus-visible:ring-0"
        />
        <div className="mt-3 pt-3 border-t border-white/[0.05] flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.18em] text-foreground/45">
          <span>{wordCount} words · ~{speechEstimateSec}s spoken {activeVoice ? `@ ${activeVoice.name}'s pace` : ""}</span>
          <span className="tabular-nums">{scriptText.length}/500</span>
        </div>
      </div>

      {/* Starter templates */}
      <div className="mt-6">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] text-foreground/40 mb-3">Or start with a template</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SCRIPT_STARTERS.map(s => (
            <button key={s.id}
              onClick={() => { onChange(s.text); onToneChange(s.tone); }}
              className="text-left rounded-2xl ring-1 ring-inset ring-white/[0.06] hover:ring-white/[0.16] bg-white/[0.015] hover:bg-white/[0.03] backdrop-blur p-4 transition-all"
            >
              <div className="flex items-baseline justify-between mb-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-foreground/55">{s.label}</span>
                <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-foreground/40">{TONE_LABELS[s.tone]}</span>
              </div>
              <p className="text-[12.5px] text-foreground/75 italic line-clamp-3">"{s.text}"</p>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — Voice (5 rails by persona group)
// ─────────────────────────────────────────────────────────────────────────────
const VOICE_ORDER: VoicePersonaGroup[] = [
  "professional", "conversational", "energetic", "authoritative", "narrative",
];

function VoiceStep({
  selected, onSelect, previewingId, onPreview, suggestedGroup,
}: {
  selected: string;
  onSelect: (id: string) => void;
  previewingId: string | null;
  onPreview: (id: string) => void;
  suggestedGroup: VoicePersonaGroup;
}) {
  const grouped = useMemo(() => groupVoicesByPersona(VOICE_BLUEPRINTS), []);
  return (
    <section>
      <header className="mb-6">
        <h2 className="text-[clamp(1.6rem,3.5vw,2.4rem)] font-display italic font-light leading-tight">
          <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/60 bg-clip-text text-transparent">
            Who delivers it?
          </span>
        </h2>
        <p className="mt-2 text-[13px] text-foreground/55">
          27 MiniMax voices grouped by persona. Suggested for your tone: <span className="text-foreground/85 font-medium">{VOICE_PERSONA_LABELS[suggestedGroup]}</span>.
        </p>
      </header>

      <div className="space-y-10">
        {VOICE_ORDER.map(group => (
          <VoiceRail
            key={group}
            group={group}
            voices={grouped[group]}
            selected={selected}
            onSelect={onSelect}
            previewingId={previewingId}
            onPreview={onPreview}
            highlighted={group === suggestedGroup}
          />
        ))}
      </div>
    </section>
  );
}

function VoiceRail({
  group, voices, selected, onSelect, previewingId, onPreview, highlighted,
}: {
  group: VoicePersonaGroup;
  voices: VoiceBlueprint[];
  selected: string;
  onSelect: (id: string) => void;
  previewingId: string | null;
  onPreview: (id: string) => void;
  highlighted: boolean;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const scrollBy = (delta: number) => railRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <h3 className="text-[clamp(1.2rem,2.4vw,1.6rem)] font-display italic font-light leading-tight truncate">
          <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/60 bg-clip-text text-transparent">
            {VOICE_PERSONA_LABELS[group]}
          </span>
          <span className="ml-3 font-mono text-[11px] font-normal not-italic uppercase tracking-[0.22em] text-foreground/40 tabular-nums">
            {voices.length}
          </span>
          {highlighted && (
            <span className="ml-2 inline-flex items-center gap-1 px-2 h-5 rounded-full bg-emerald-500/15 ring-1 ring-inset ring-emerald-300/30 text-[9px] font-mono uppercase tracking-[0.18em] text-emerald-200 not-italic">
              <Star className="w-2.5 h-2.5" />Suggested
            </span>
          )}
        </h3>
        <div className="flex items-center gap-1">
          <button onClick={() => scrollBy(-440)} className="hidden sm:inline-flex h-8 w-8 items-center justify-center rounded-full ring-1 ring-inset ring-white/[0.06] hover:ring-white/[0.16] bg-white/[0.015] hover:bg-white/[0.04] text-foreground/55 hover:text-foreground/85 transition-colors">‹</button>
          <button onClick={() => scrollBy(440)} className="hidden sm:inline-flex h-8 w-8 items-center justify-center rounded-full ring-1 ring-inset ring-white/[0.06] hover:ring-white/[0.16] bg-white/[0.015] hover:bg-white/[0.04] text-foreground/55 hover:text-foreground/85 transition-colors">›</button>
        </div>
      </div>
      <div className="relative -mx-1">
        <div aria-hidden className="pointer-events-none absolute top-0 bottom-0 left-0 w-12 z-10" style={{ background: "linear-gradient(90deg, hsl(220 30% 3% / 0.85), transparent)" }} />
        <div aria-hidden className="pointer-events-none absolute top-0 bottom-0 right-0 w-12 z-10" style={{ background: "linear-gradient(270deg, hsl(220 30% 3% / 0.85), transparent)" }} />
        <div
          ref={railRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2 px-1"
          style={{ scrollbarWidth: "none" }}
        >
          {voices.map(v => (
            <div key={v.id} className="snap-start flex-shrink-0 w-[280px]">
              <VoiceCard
                voice={v}
                isSelected={selected === v.id}
                isPreviewing={previewingId === v.id}
                onSelect={() => onSelect(v.id)}
                onPreview={() => onPreview(v.id)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function VoiceCard({
  voice, isSelected, isPreviewing, onSelect, onPreview,
}: {
  voice: VoiceBlueprint;
  isSelected: boolean;
  isPreviewing: boolean;
  onSelect: () => void;
  onPreview: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        "group relative rounded-2xl ring-1 ring-inset p-4 cursor-pointer transition-all",
        isSelected
          ? "ring-amber-300/45 bg-amber-500/[0.05] shadow-[0_15px_45px_-12px_hsla(45,95%,60%,0.35)]"
          : "ring-white/[0.06] hover:ring-white/[0.18] bg-white/[0.015] hover:bg-white/[0.03] backdrop-blur",
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-baseline gap-2">
          <h4 className="text-[16px] font-display italic font-medium text-foreground/95">{voice.name}</h4>
          {voice.isFeatured && (
            <span className="font-mono text-[8.5px] uppercase tracking-[0.18em] text-amber-200">★</span>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onPreview(); }}
          className={cn(
            "inline-flex items-center justify-center h-8 w-8 rounded-full ring-1 ring-inset transition-all",
            isPreviewing
              ? "bg-foreground text-background ring-foreground"
              : "bg-white/[0.04] ring-white/[0.10] text-foreground/85 hover:bg-white/[0.08]",
          )}
        >
          {isPreviewing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>
      </div>
      <p className="text-[12px] text-foreground/65 italic line-clamp-2 mb-3">{voice.persona}</p>

      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className="inline-flex items-center h-5 px-1.5 rounded-md bg-white/[0.04] ring-1 ring-inset ring-white/[0.08] text-[9px] font-mono uppercase tracking-[0.16em] text-foreground/75">
          {VOICE_PERSONA_SHORT[voice.group]}
        </span>
        <span className="inline-flex items-center h-5 px-1.5 rounded-md bg-white/[0.04] ring-1 ring-inset ring-white/[0.08] text-[9px] font-mono uppercase tracking-[0.16em] text-foreground/65">
          {VOICE_ACCENT_LABELS[voice.accent].split(" · ")[0]}
        </span>
        <span className="inline-flex items-center h-5 px-1.5 rounded-md bg-white/[0.04] ring-1 ring-inset ring-white/[0.08] text-[9px] font-mono uppercase tracking-[0.16em] text-foreground/65">
          {VOICE_PACING_LABELS[voice.pacing].split(" &")[0]}
        </span>
      </div>

      <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-foreground/40 line-clamp-1">
        {voice.useCases.slice(0, 2).map(u => VOICE_USECASE_LABELS[u]).join(" · ")}
      </div>

      {isSelected && (
        <div className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-amber-300 text-background ring-2 ring-[hsl(220_30%_3%)] inline-flex items-center justify-center">
          <Check className="w-3 h-3" strokeWidth={2.5} />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3 — Character
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map AvatarTemplate rows into CharacterBlueprint-shaped tiles, bucketed
 * by archetype. The training-video flow renders CharacterBlueprint
 * cards (id/name/persona/image/archetype), so this adapter lets us
 * swap the data source from hardcoded stock photos to the live
 * avatar_templates catalog without rewriting the UI.
 *
 * Archetype heuristic — style first, then tags, then default to
 * "presenter" so every avatar is at least visible somewhere.
 */
function groupAvatarsAsCharacters(
  avatars: AvatarTemplate[],
): Record<CharacterArchetype, CharacterBlueprint[]> {
  const groups: Record<CharacterArchetype, CharacterBlueprint[]> = {
    executive: [], trainer: [], creator: [], presenter: [], educator: [],
  };
  const archetypeOf = (a: AvatarTemplate): CharacterArchetype => {
    const style = (a.style ?? "").toLowerCase();
    const tags = (a.tags ?? []).map((t) => String(t).toLowerCase());
    if (style === "corporate" || style === "professional" || style === "executive") return "executive";
    if (style === "academic" || tags.includes("educator") || tags.includes("teacher")) return "educator";
    if (style === "creative" || tags.includes("creator") || tags.includes("artist")) return "creator";
    if (tags.includes("trainer") || tags.includes("coach") || tags.includes("fitness")) return "trainer";
    return "presenter";
  };
  for (const a of avatars) {
    // Skip rows whose face image isn't a real https URL — the hook
    // already filters most of these, but belt + braces here so the
    // training page never renders a broken tile.
    const img = a.face_image_url ?? a.front_image_url ?? "";
    if (!img || img.startsWith("data:") || !img.startsWith("http")) continue;
    const arch = archetypeOf(a);
    groups[arch].push({
      id: a.id,
      name: a.name,
      persona: a.description ?? a.personality ?? "—",
      bio: a.description ?? a.personality ?? "",
      image: img,
      archetype: arch,
      styleNote: a.personality ?? "",
      pairsWithVoiceGroups: [] as CharacterBlueprint["pairsWithVoiceGroups"],
      pairsWithSceneWorlds: [] as CharacterBlueprint["pairsWithSceneWorlds"],
      useCases: [] as CharacterBlueprint["useCases"],
    });
  }
  return groups;
}

function CharacterStep({
  source, onSourceChange, selectedStock, onSelectStock,
  uploadedImage, onUploadClick, inputRef, onUploadChange,
}: {
  source: "stock" | "upload" | "webcam";
  onSourceChange: (s: "stock" | "upload" | "webcam") => void;
  selectedStock: string | null;
  onSelectStock: (id: string) => void;
  uploadedImage: string | null;
  onUploadClick: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
  onUploadChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  // Pull real avatars from the catalog (was: hardcoded stock photos).
  // The placeholder filter inside useAvatarTemplatesQuery drops rows
  // whose face_image_url is null / data: URI / placehold.co.
  const { templates: avatars } = useAvatarTemplatesQuery();
  const grouped = useMemo(() => groupAvatarsAsCharacters(avatars), [avatars]);
  const archetypeOrder: CharacterArchetype[] = ["executive", "trainer", "creator", "presenter", "educator"];

  return (
    <section>
      <header className="mb-6">
        <h2 className="text-[clamp(1.6rem,3.5vw,2.4rem)] font-display italic font-light leading-tight">
          <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/60 bg-clip-text text-transparent">
            Who is on camera?
          </span>
        </h2>
        <p className="mt-2 text-[13px] text-foreground/55">Pick a stock presenter, upload your own, or capture with your webcam.</p>
      </header>

      <div className="mb-5">
        <IconFilterRow title="Source">
          {([
            ["stock", "Stock", UserIcon],
            ["upload", "Upload", Upload],
            ["webcam", "Webcam", Camera],
          ] as const).map(([s, label, Icon]) => (
            <IconFilterTile
              key={s}
              active={source === s}
              onClick={() => (s === "webcam" ? toast.info("Webcam capture coming soon") : onSourceChange(s))}
              Icon={Icon}
              label={label}
            />
          ))}
        </IconFilterRow>
      </div>

      {source === "stock" && (
        <div className="space-y-8">
          {archetypeOrder.map(arch => (
            <CharacterRail
              key={arch}
              archetype={arch}
              characters={grouped[arch]}
              selected={selectedStock}
              onSelect={onSelectStock}
            />
          ))}
        </div>
      )}

      {source === "upload" && (
        <div className="rounded-2xl ring-1 ring-inset ring-white/[0.08] bg-white/[0.02] backdrop-blur p-6">
          <input ref={inputRef} type="file" accept="image/*" onChange={onUploadChange} className="hidden" />
          {uploadedImage ? (
            <div className="flex items-center gap-5">
              <img src={uploadedImage} alt="Uploaded presenter" className="w-28 h-28 rounded-full object-cover ring-1 ring-inset ring-white/[0.15]" />
              <div className="flex-1">
                <h4 className="text-[14px] font-medium text-foreground/95 mb-1">Your presenter</h4>
                <p className="text-[11px] text-foreground/55 mb-3">Upload a different photo if you want to retake.</p>
                <Button size="sm" variant="outline" onClick={onUploadClick} className="rounded-full border-white/[0.10] bg-white/[0.02]">
                  <Upload className="w-3.5 h-3.5 mr-1.5" />Replace photo
                </Button>
              </div>
            </div>
          ) : (
            <button onClick={onUploadClick} className="w-full p-8 rounded-xl ring-1 ring-dashed ring-white/[0.12] hover:ring-white/[0.25] hover:bg-white/[0.02] transition-all text-center">
              <Upload className="w-7 h-7 mx-auto mb-3 text-foreground/55" />
              <div className="text-[14px] font-medium text-foreground/85 mb-1">Upload presenter photo</div>
              <div className="text-[11px] text-foreground/45">JPG / PNG · max 10MB · front-facing for best results</div>
            </button>
          )}
        </div>
      )}

      {source === "webcam" && (
        <div className="rounded-2xl ring-1 ring-inset ring-white/[0.08] bg-white/[0.02] backdrop-blur p-8 text-center">
          <Camera className="w-7 h-7 mx-auto mb-3 text-foreground/55" />
          <h4 className="text-[14px] font-medium text-foreground/95 mb-1">Webcam capture coming soon</h4>
          <p className="text-[11px] text-foreground/55">In the meantime, use Upload to provide your photo.</p>
        </div>
      )}
    </section>
  );
}

function CharacterRail({
  archetype, characters, selected, onSelect,
}: {
  archetype: CharacterArchetype;
  characters: CharacterBlueprint[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const scrollBy = (delta: number) => railRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  if (characters.length === 0) return null;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <h3 className="text-[clamp(1.1rem,2.2vw,1.4rem)] font-display italic font-light leading-tight">
          <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/60 bg-clip-text text-transparent">
            {CHARACTER_ARCHETYPE_LABELS[archetype]}
          </span>
          <span className="ml-3 font-mono text-[10px] font-normal not-italic uppercase tracking-[0.22em] text-foreground/40 tabular-nums">
            {characters.length}
          </span>
        </h3>
        <div className="flex items-center gap-1">
          <button onClick={() => scrollBy(-440)} className="hidden sm:inline-flex h-8 w-8 items-center justify-center rounded-full ring-1 ring-inset ring-white/[0.06] hover:ring-white/[0.16] bg-white/[0.015] hover:bg-white/[0.04] text-foreground/55 hover:text-foreground/85">‹</button>
          <button onClick={() => scrollBy(440)} className="hidden sm:inline-flex h-8 w-8 items-center justify-center rounded-full ring-1 ring-inset ring-white/[0.06] hover:ring-white/[0.16] bg-white/[0.015] hover:bg-white/[0.04] text-foreground/55 hover:text-foreground/85">›</button>
        </div>
      </div>
      <div className="relative -mx-1">
        <div aria-hidden className="pointer-events-none absolute top-0 bottom-0 left-0 w-12 z-10" style={{ background: "linear-gradient(90deg, hsl(220 30% 3% / 0.85), transparent)" }} />
        <div aria-hidden className="pointer-events-none absolute top-0 bottom-0 right-0 w-12 z-10" style={{ background: "linear-gradient(270deg, hsl(220 30% 3% / 0.85), transparent)" }} />
        <div
          ref={railRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2 px-1"
          style={{ scrollbarWidth: "none" }}
        >
          {characters.map(c => (
            <button key={c.id} onClick={() => onSelect(c.id)}
              className="snap-start flex-shrink-0 w-[200px] text-left group"
            >
              <div className={cn(
                "relative aspect-[3/4] rounded-2xl overflow-hidden ring-1 ring-inset transition-all",
                selected === c.id ? "ring-amber-300/45 shadow-[0_15px_45px_-12px_hsla(45,95%,60%,0.35)]" : "ring-white/[0.06] group-hover:ring-white/[0.18]",
              )}>
                <img src={c.image} alt={c.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[hsl(220_30%_2%)]/85 via-transparent to-transparent" />
                {selected === c.id && (
                  <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-amber-300 text-background ring-2 ring-[hsl(220_30%_3%)] inline-flex items-center justify-center">
                    <Check className="w-3 h-3" strokeWidth={2.5} />
                  </div>
                )}
                <div className="absolute bottom-3 left-3 right-3">
                  <h4 className="text-[14px] font-display italic font-medium text-foreground leading-tight">{c.name}</h4>
                  <p className="mt-0.5 text-[10.5px] text-foreground/65 italic line-clamp-2">{c.persona}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4 — Scene (6 rails by world)
// ─────────────────────────────────────────────────────────────────────────────
const SCENE_ORDER: SceneWorld[] = ["studio", "corporate", "education", "lifestyle", "nature", "scifi"];

// Halo color used by the hero AutoGallery to tint its ambient glow as the
// active scene cycles — gives each world its own visual signature.
function sceneWorldGlow(world: SceneWorld): string {
  const map: Record<SceneWorld, string> = {
    studio:    "hsl(45 95% 65% / 0.50)",
    corporate: "hsl(215 100% 70% / 0.45)",
    education: "hsl(155 70% 60% / 0.45)",
    lifestyle: "hsl(20 85% 65% / 0.50)",
    nature:    "hsl(125 65% 55% / 0.45)",
    scifi:     "hsl(285 90% 70% / 0.55)",
  };
  return map[world];
}

function SceneStep({
  selected, onSelect, activeVoice,
}: {
  selected: string;
  onSelect: (id: string) => void;
  activeVoice: VoiceBlueprint | undefined;
}) {
  const grouped = useMemo(() => {
    const g: Record<SceneWorld, TrainingSceneBlueprint[]> = {
      studio: [], corporate: [], education: [], lifestyle: [], nature: [], scifi: [],
    };
    for (const s of TRAINING_SCENE_BLUEPRINTS) g[s.world].push(s);
    return g;
  }, []);

  return (
    <section>
      <header className="mb-6">
        <h2 className="text-[clamp(1.6rem,3.5vw,2.4rem)] font-display italic font-light leading-tight">
          <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/60 bg-clip-text text-transparent">
            Where do they stand?
          </span>
        </h2>
        <p className="mt-2 text-[13px] text-foreground/55">
          52 scenes across 6 worlds. {activeVoice && (
            <span>
              Scenes that pair with <span className="text-foreground/85 font-medium">{activeVoice.name}</span> are highlighted.
            </span>
          )}
        </p>
      </header>

      <div className="space-y-10">
        {SCENE_ORDER.map(world => (
          <SceneRail
            key={world}
            world={world}
            scenes={grouped[world]}
            selected={selected}
            onSelect={onSelect}
            highlightPersona={activeVoice?.group}
          />
        ))}
      </div>
    </section>
  );
}

function SceneRail({
  world, scenes, selected, onSelect, highlightPersona,
}: {
  world: SceneWorld;
  scenes: TrainingSceneBlueprint[];
  selected: string;
  onSelect: (id: string) => void;
  highlightPersona?: VoicePersonaGroup;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const scrollBy = (delta: number) => railRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  if (scenes.length === 0) return null;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <h3 className="text-[clamp(1.2rem,2.4vw,1.6rem)] font-display italic font-light leading-tight truncate">
          <span className="bg-gradient-to-b from-foreground via-foreground/95 to-foreground/60 bg-clip-text text-transparent">
            {SCENE_WORLD_LABELS[world]}
          </span>
          <span className="ml-3 font-mono text-[11px] font-normal not-italic uppercase tracking-[0.22em] text-foreground/40 tabular-nums">
            {scenes.length}
          </span>
        </h3>
        <div className="flex items-center gap-1">
          <button onClick={() => scrollBy(-440)} className="hidden sm:inline-flex h-8 w-8 items-center justify-center rounded-full ring-1 ring-inset ring-white/[0.06] hover:ring-white/[0.16] bg-white/[0.015] hover:bg-white/[0.04] text-foreground/55 hover:text-foreground/85">‹</button>
          <button onClick={() => scrollBy(440)} className="hidden sm:inline-flex h-8 w-8 items-center justify-center rounded-full ring-1 ring-inset ring-white/[0.06] hover:ring-white/[0.16] bg-white/[0.015] hover:bg-white/[0.04] text-foreground/55 hover:text-foreground/85">›</button>
        </div>
      </div>
      <div className="relative -mx-1">
        <div aria-hidden className="pointer-events-none absolute top-0 bottom-0 left-0 w-12 z-10" style={{ background: "linear-gradient(90deg, hsl(220 30% 3% / 0.85), transparent)" }} />
        <div aria-hidden className="pointer-events-none absolute top-0 bottom-0 right-0 w-12 z-10" style={{ background: "linear-gradient(270deg, hsl(220 30% 3% / 0.85), transparent)" }} />
        <div
          ref={railRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2 px-1"
          style={{ scrollbarWidth: "none" }}
        >
          {scenes.map(s => (
            <button key={s.id} onClick={() => onSelect(s.id)}
              className="snap-start flex-shrink-0 w-[260px] text-left group"
            >
              <div className={cn(
                "relative aspect-[16/10] rounded-2xl overflow-hidden ring-1 ring-inset transition-all",
                selected === s.id ? "ring-amber-300/45 shadow-[0_15px_45px_-12px_hsla(45,95%,60%,0.35)]" : "ring-white/[0.06] group-hover:ring-white/[0.18]",
              )}>
                <img src={s.image} alt={s.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-[hsl(220_30%_2%)]/85 via-[hsl(220_30%_3%)]/15 to-transparent" />

                {/* Top badges */}
                <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                  {s.isFeatured && (
                    <span className="inline-flex items-center h-5 px-1.5 rounded-md bg-amber-500/85 text-foreground text-[9px] font-mono uppercase tracking-[0.18em]">Featured</span>
                  )}
                  {highlightPersona && s.voicePairings.includes(highlightPersona) && (
                    <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-md bg-emerald-500/25 ring-1 ring-inset ring-emerald-300/40 text-emerald-100 text-[9px] font-mono uppercase tracking-[0.18em] backdrop-blur">
                      <Star className="w-2.5 h-2.5" />Pairs
                    </span>
                  )}
                </div>
                {selected === s.id && (
                  <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-amber-300 text-background ring-2 ring-[hsl(220_30%_3%)] inline-flex items-center justify-center">
                    <Check className="w-3 h-3" strokeWidth={2.5} />
                  </div>
                )}

                <div className="absolute bottom-2 left-2 right-2">
                  <h4 className="text-[14px] font-display italic font-medium text-foreground leading-tight line-clamp-1">{s.name}</h4>
                  <p className="mt-0.5 text-[10.5px] text-foreground/65 italic line-clamp-1">{s.description}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1 text-[9px] font-mono uppercase tracking-[0.16em] text-foreground/55">
                    <span>{SCENE_LIGHTING_LABELS[s.lighting].split(" ·")[0]}</span>
                    <span>·</span>
                    <span>{PRODUCTION_TIER_LABELS[s.productionTier].split(" ·")[0]}</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Right-rail composite preview
// ─────────────────────────────────────────────────────────────────────────────
function CompositePreview({
  characterImage, sceneImage, aspectRatio,
}: {
  characterImage: string | null;
  sceneImage: string | null;
  aspectRatio: "16:9" | "9:16" | "1:1";
}) {
  const aspectClass = aspectRatio === "16:9" ? "aspect-video" : aspectRatio === "9:16" ? "aspect-[9/16]" : "aspect-square";
  return (
    <div className={cn("relative rounded-2xl overflow-hidden ring-1 ring-inset ring-white/[0.06] bg-[hsl(220_30%_5%)]", aspectClass)}>
      {sceneImage && (
        <img src={sceneImage} alt="Scene preview" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[hsl(220_30%_2%)]/40 to-transparent" />
      {characterImage ? (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5">
          <img src={characterImage} alt="Character preview" loading="lazy" className="h-24 w-24 rounded-full object-cover ring-2 ring-white/30 shadow-[0_15px_30px_rgba(0,0,0,0.55)]" />
          <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-foreground/75 px-2 py-0.5 rounded-full bg-black/55 backdrop-blur">Preview</span>
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-foreground/45 text-[12px]">
          Select a character to preview
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Misc helpers
// ─────────────────────────────────────────────────────────────────────────────
function FloatingStat({ label, value, hue }: { label: string; value: number; hue?: string; }) {
  return (
    <div className="inline-block">
      <div className={cn("text-[clamp(1.5rem,3vw,2rem)] font-display italic font-light leading-none tabular-nums", hue ?? "text-foreground/95")}>
        {value}
      </div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-foreground/40">{label}</div>
    </div>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/45">{label}</span>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Public page
// ─────────────────────────────────────────────────────────────────────────────
export function TrainingWorkbench() {
  const liveRenderTimecode = useLiveRenderTimecode();

  return (
    <div className="relative mx-auto w-full max-w-[1440px] px-4 pb-24 pt-10 sm:px-6 lg:px-10">
      <EditorialCanvas
        maxWidth="100%"
        chrome={{
          crumbs: ["Small Bridges", "training"],
          timecode: liveRenderTimecode ?? "TRAINING · LIVE",
        }}
      >
        <TrainingContent />
      </EditorialCanvas>
    </div>
  );
}

export default function TrainingVideo() {
  usePageMeta({
    title: "Training videos — Small Bridges",
    description: "Talking-head training videos. 27 voices, 52 scenes, 10 stock presenters. Script → Voice → Character → Scene → Generate.",
  });

  return (
    <ErrorBoundary>
      <FoundationShell>
        <TrainingWorkbench />
      </FoundationShell>
    </ErrorBoundary>
  );
}
