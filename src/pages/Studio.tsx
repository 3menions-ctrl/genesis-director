/**
 * Studio — /studio
 *
 * The single workshop. Replaces three legacy surfaces:
 *   - /studio (marketing landing page)
 *   - /create (the actual workshop, in the old AppShell)
 *   - /director (alternate director cockpit)
 *
 * Built on the canonical Foundation: FoundationShell + EditorialCanvas
 * + SpineBackdrop, sharing the same room as Library, Account, and Reel.
 *
 * Anatomy:
 *   - FoundationShell header — Cmd+K command center + credits + account
 *   - Editorial chrome — breadcrumb, live timecode, credit pulse
 *   - Big serif headline + subhead
 *   - Glass segmented tabs: Create · Image · Scenes · Photo
 *   - Sub-hub region — embeds the existing CreationHub / ImageStudioHub /
 *     PhotoEditorHub / ScenesHub primitives without modification.
 *
 * Creation pipeline (handleStartCreation, credit gating, gatekeeper
 * loading, draft persistence) is preserved verbatim from the legacy
 * Create.tsx so behavior is unchanged — only the shell is rebuilt.
 */
import { memo, useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import {
  Film,
  Image as ImageIcon,
  Wand2,
  Sparkles,
  Compass,
  Library as LibraryIcon,
  Theater as TheaterIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { FoundationShell } from "@/components/foundation/FoundationShell";
import {
  EditorialCanvas,
  EditorialEyebrow,
  EditorialHeadline,
} from "@/components/foundation/EditorialCanvas";
import { CreationHub } from "@/components/studio/CreationHub";
import { ScenesHub } from "@/components/scenes/ScenesHub";
import { PhotoEditorHub } from "@/components/photo-editor/PhotoEditorHub";
import { ImageStudioHub } from "@/components/studio/ImageStudioHub";
import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/contexts/CreditsContext";
import { useCinemaGuard } from "@/hooks/useCinemaEntitlement";
import { useLiveRenderTimecode } from "@/hooks/useLiveRenderTimecode";
import { VideoGenerationMode, VideoStylePreset } from "@/types/video-modes";
import { supabase } from "@/integrations/supabase/client";
import {
  handleEdgeFunctionError,
  showUserFriendlyError,
} from "@/lib/userFriendlyErrors";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import {
  useStabilityGuard,
  useSafeNavigation,
  useRouteCleanup,
  isAbortError,
} from "@/lib/navigation";
import { BrandLoadingSpinner } from "@/components/ui/UnifiedLoadingPage";
import { CinemaLoader } from "@/components/ui/CinemaLoader";
import { withSafePageRef } from "@/lib/withSafeRef";
import {
  useGatekeeperLoading,
  GATEKEEPER_PRESETS,
  getGatekeeperMessage,
} from "@/hooks/useGatekeeperLoading";
import { loadDraft, clearDraft } from "@/lib/sessionPersistence";
import {
  calculateCreditsForDurations,
  type VideoEngine,
} from "@/lib/creditSystem";
import { getAuthoritativeCreditState } from "@/lib/credits/authoritativeCreditState";
import { usePageMeta } from "@/hooks/usePageMeta";
import { EASE_PREMIUM, TYPE_META } from "@/lib/design-system";

// ─────────────────────────────────────────────────────────────────────────────
// Tab model — same four modes as the legacy workshop, restated in
// Foundation vocabulary (mono labels, single-line sublabels).
// ─────────────────────────────────────────────────────────────────────────────
type StudioTab = "create" | "image" | "scenes" | "photo";

const STUDIO_TABS: ReadonlyArray<{
  key: StudioTab;
  label: string;
  sub: string;
  Icon: typeof Film;
}> = [
  { key: "create", label: "Create",       sub: "Cinematic generation", Icon: Film },
  { key: "image",  label: "Image Studio", sub: "Text-to-image · remix", Icon: Wand2 },
  { key: "scenes", label: "Scenes",       sub: "Build your world",      Icon: Sparkles },
  { key: "photo",  label: "Photo Editor", sub: "Refine every frame",    Icon: ImageIcon },
];

// ─────────────────────────────────────────────────────────────────────────────
// Foundation-styled glass segmented tabs. Uses motion's layoutId to
// slide the active indicator instead of fading colors. Matches the
// vocabulary of Library's mode toggle.
// ─────────────────────────────────────────────────────────────────────────────
function StudioTabs({
  value,
  onChange,
}: {
  value: StudioTab;
  onChange: (v: StudioTab) => void;
}) {
  return (
    <div
      role="tablist"
      className="relative inline-flex flex-wrap items-center gap-1 rounded-full p-1 border border-border/30 bg-[hsl(var(--foreground)/0.02)] backdrop-blur-xl"
    >
      {STUDIO_TABS.map((tab) => {
        const active = value === tab.key;
        const Icon = tab.Icon;
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.key)}
            className={cn(
              "relative z-10 inline-flex items-center gap-2 px-4 h-9 rounded-full text-[12.5px] tracking-tight transition-colors",
              active
                ? "text-foreground"
                : "text-muted-foreground/70 hover:text-foreground/90",
            )}
          >
            {active && (
              <motion.span
                layoutId="studio-tab-active"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
                className="absolute inset-0 -z-10 rounded-full bg-[hsl(var(--accent)/0.10)] ring-1 ring-inset ring-[hsl(var(--accent)/0.30)]"
              />
            )}
            <Icon
              className={cn(
                "h-3.5 w-3.5 shrink-0",
                active ? "text-accent" : "opacity-60",
              )}
              strokeWidth={1.5}
            />
            <span className="font-light">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Quick exits — three named doors out of the workshop. The Cmd+K
// Command Center is always available, but newcomers don't yet know the
// shortcut, so we surface the three highest-traffic destinations
// explicitly. Kept inline (no separate component) — three rows of CSS.
// ─────────────────────────────────────────────────────────────────────────────
const STUDIO_EXITS: ReadonlyArray<{
  to: string;
  label: string;
  sub: string;
  Icon: typeof Film;
}> = [
  { to: "/editor",               label: "Editor",  sub: "Cutting room",     Icon: Film },
  { to: "/library",              label: "Library", sub: "Your films",       Icon: LibraryIcon },
  { to: "/library?mode=theater", label: "Theater", sub: "Premiere a film",  Icon: TheaterIcon },
  { to: "/lobby",                label: "Lobby",   sub: "Daily sketch",     Icon: Compass },
];

// ─────────────────────────────────────────────────────────────────────────────
// Loading overlay — single brand spinner, no background-blur sleight
// of hand. Matches the Cinema-loader vocabulary used on the spine.
// ─────────────────────────────────────────────────────────────────────────────
const LoadingOverlay = memo(function LoadingOverlay({
  status,
}: {
  status: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[hsl(220_30%_2%/0.85)] backdrop-blur-sm">
      <div className="text-center space-y-6">
        <BrandLoadingSpinner size="lg" />
        <p className="text-foreground text-lg font-light">
          {status || "Starting creation…"}
        </p>
        <p className={cn(TYPE_META, "text-muted-foreground/60")}>
          This may take a moment
        </p>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Inner workshop — wrapped by withSafePageRef so library-injected refs
// land safely. All creation logic mirrors the legacy Create.tsx so the
// shell swap is behavior-preserving.
// ─────────────────────────────────────────────────────────────────────────────
function StudioContentInner() {
  const { navigate, emergencyNavigate } = useSafeNavigation();
  const { user } = useAuth();
  const credits = useCredits();
  const cinemaGuard = useCinemaGuard();
  const liveRenderTimecode = useLiveRenderTimecode();
  const reducedMotion = useReducedMotion();

  const [isCreating, setIsCreating] = useState(false);
  const [creationStatus, setCreationStatus] = useState<string>("");
  const [isHubReady, setIsHubReady] = useState(false);

  // Restore the active tab from URL > localStorage > default. We keep
  // the legacy storage key (`sb_create_active_tab`) so users returning
  // from the old /create route land on the same tab they left.
  const [activeTab, setActiveTab] = useState<StudioTab>(() => {
    try {
      const url = new URLSearchParams(window.location.search);
      const t = url.get("tab");
      if (t === "create" || t === "image" || t === "scenes" || t === "photo")
        return t;
    } catch {}
    try {
      const saved = localStorage.getItem("sb_create_active_tab");
      if (
        saved === "create" ||
        saved === "image" ||
        saved === "scenes" ||
        saved === "photo"
      )
        return saved;
    } catch {}
    return "create";
  });

  useEffect(() => {
    try {
      localStorage.setItem("sb_create_active_tab", activeTab);
    } catch {}
  }, [activeTab]);

  // Restore in-progress draft if the user is returning after navigating away.
  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      toast.info("Draft restored — pick up where you left off", {
        duration: 3000,
      });
    }
  }, []);

  const { isMounted, getAbortController, safeSetState } = useStabilityGuard();

  const authLoading = !user;
  const gatekeeper = useGatekeeperLoading({
    ...GATEKEEPER_PRESETS.create,
    authLoading,
    dataLoading: !isHubReady,
    dataSuccess: isHubReady,
  });

  useRouteCleanup(() => {
    if (isCreating) {
      // eslint-disable-next-line no-console
      console.debug("[Studio] Cleanup: cancelling pending creation");
    }
  }, [isCreating]);

  const handleHubReady = useCallback(() => {
    setIsHubReady(true);
  }, []);

  const handleStartCreation = useCallback(
    async (config: {
      mode: VideoGenerationMode;
      prompt: string;
      style?: VideoStylePreset;
      voiceId?: string;
      imageUrl?: string;
      videoUrl?: string;
      aspectRatio: string;
      clipCount: number;
      clipDuration: number;
      clipDurations?: number[];
      enableNarration: boolean;
      enableMusic: boolean;
      genre?: string;
      mood?: string;
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
      videoEngine?: "kling" | "veo" | "seedance" | "sora";
    }) => {
      if (!user) {
        toast.error("Please sign in to create videos");
        navigate("/auth");
        return;
      }

      const requiredSeconds =
        config.clipDurations?.reduce((a, b) => a + b, 0) ??
        (config.clipCount ?? 0) * (config.clipDuration ?? 0);
      if (requiredSeconds > 0) {
        const guard = cinemaGuard.check(requiredSeconds, {
          onUpgrade: () => navigate("/credits"),
        });
        if (!guard.allowed) return;
      }

      getAbortController();
      safeSetState(setIsCreating, true);
      safeSetState(setCreationStatus, "Initializing pipeline…");

      try {
        if (!isMounted()) return;
        safeSetState(setCreationStatus, "Verifying credits…");
        const creditState =
          (await getAuthoritativeCreditState()) ?? (await credits.reconcile());
        void credits.refresh();
        const durations = config.clipDurations?.length
          ? config.clipDurations
          : Array.from(
              { length: config.clipCount },
              () => config.clipDuration,
            );
        const requiredCredits = calculateCreditsForDurations(
          durations,
          (config.videoEngine || "kling") as VideoEngine,
        );
        if (creditState.available < requiredCredits) {
          toast.error(
            `Insufficient credits. Need ${requiredCredits}, available ${creditState.available}.`,
          );
          navigate("/credits");
          return;
        }

        safeSetState(setCreationStatus, "Creating project…");

        const requestBody: Record<string, unknown> = {
          mode: config.mode,
          userId: user.id,
          prompt: config.prompt?.trim(),
          imageUrl: config.imageUrl,
          videoUrl: config.videoUrl,
          stylePreset: config.style,
          voiceId: config.voiceId,
          aspectRatio: config.aspectRatio,
          clipCount: config.clipCount,
          clipDuration: config.clipDuration,
          clipDurations: config.clipDurations,
          enableNarration: config.enableNarration,
          enableMusic: config.enableMusic,
          genre: config.genre,
          mood: config.mood,
          videoEngine: config.videoEngine,
          isBreakout: config.isBreakout,
          breakoutStartImageUrl: config.breakoutStartImageUrl,
          breakoutPlatform: config.breakoutPlatform,
          useTemplateShots: config.useTemplateShots,
          templateShotSequence: config.templateShotSequence,
          templateName: config.templateName,
          templateStyleAnchor: config.templateStyleAnchor,
          templateCharacters: config.templateCharacters,
          templateEnvironmentLock: config.templateEnvironmentLock,
        };

        if (config.isBreakout && config.avatarImageUrl) {
          requestBody.avatarImageUrl = config.avatarImageUrl;
          requestBody.voiceId = config.avatarVoiceId;
          requestBody.avatarTemplateId = config.avatarTemplateId;
          requestBody.avatarName = config.avatarName;
          requestBody.identityBible = config.identityBible;
          requestBody.characterLock = config.characterLock;
          requestBody.referenceImageUrl = config.avatarImageUrl;
          requestBody.breakoutDialogue = config.prompt?.trim();
          requestBody.imageUrl = config.avatarImageUrl;
        }

        const { data, error } = await supabase.functions.invoke(
          "mode-router",
          { body: requestBody },
        );

        if (error || data?.error) {
          const { handled } = await handleEdgeFunctionError(
            error,
            data,
            (path) => navigate(path),
          );
          if (handled) return;
          if (error) throw error;
        }

        if (!data?.projectId) {
          throw new Error(
            "Failed to create project — no project ID returned from server",
          );
        }

        safeSetState(setIsCreating, false);
        safeSetState(setCreationStatus, "");
        clearDraft();
        toast.success(`${config.mode.replace(/-/g, " ")} creation started!`);
        emergencyNavigate(`/production/${data.projectId}`);
      } catch (error) {
        if (isAbortError(error)) return;
        // eslint-disable-next-line no-console
        console.error("Creation error:", error);
        if (isMounted()) {
          showUserFriendlyError(error, { navigate });
        }
      } finally {
        if (isMounted()) {
          safeSetState(setIsCreating, false);
          safeSetState(setCreationStatus, "");
        }
      }
    },
    [
      user,
      navigate,
      emergencyNavigate,
      isMounted,
      getAbortController,
      safeSetState,
      cinemaGuard,
      credits,
    ],
  );

  const activeMeta = STUDIO_TABS.find((t) => t.key === activeTab);

  return (
    <FoundationShell>
      {gatekeeper.isLoading && (
        <CinemaLoader
          isVisible={true}
          message={getGatekeeperMessage(
            gatekeeper.phase,
            GATEKEEPER_PRESETS.create.messages,
          )}
          variant="fullscreen"
        />
      )}

      <div
        className="relative mx-auto w-full max-w-[1440px] px-4 pb-24 pt-10 sm:px-6 lg:px-10"
        style={{
          opacity: gatekeeper.isLoading ? 0 : 1,
          transition: "opacity 0.3s ease-out",
        }}
      >
        <EditorialCanvas
          maxWidth="100%"
          chrome={{
            crumbs: ["Small Bridges", "studio"],
            timecode:
              liveRenderTimecode ??
              `${activeMeta?.label.toUpperCase() ?? "STUDIO"} · LIVE`,
          }}
        >
          {/* ── Headline row ─────────────────────────────────────── */}
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0 max-w-2xl">
              <EditorialEyebrow>Studio</EditorialEyebrow>
              <EditorialHeadline className="mt-5">
                Create cinema.
              </EditorialHeadline>
              <p className="mt-5 max-w-xl text-[14px] font-light leading-relaxed text-muted-foreground/70">
                Compose a film, sculpt a scene, refine a still. Every workflow
                lives in one workshop — pick a mode and start directing.
              </p>
            </div>

            {/* Quick exits — three doors back to the rest of the app. */}
            <div className="flex flex-wrap gap-2">
              {STUDIO_EXITS.map(({ to, label, sub, Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    "group inline-flex items-center gap-2.5 rounded-full border border-border/40 bg-[hsl(var(--foreground)/0.02)] pl-3 pr-4 h-9",
                    "transition-colors hover:border-accent/40 hover:bg-[hsl(var(--accent)/0.05)]",
                  )}
                >
                  <Icon
                    className="h-3.5 w-3.5 text-muted-foreground/70 group-hover:text-accent"
                    strokeWidth={1.5}
                  />
                  <div className="flex items-baseline gap-2 leading-none">
                    <span className="text-[12.5px] text-foreground/90">
                      {label}
                    </span>
                    <span
                      className={cn(TYPE_META, "text-muted-foreground/40")}
                    >
                      {sub}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* ── Hairline rule + tabs ─────────────────────────────── */}
          <div className="mt-10 h-px bg-gradient-to-r from-transparent via-border/60 to-transparent" />

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <StudioTabs value={activeTab} onChange={setActiveTab} />
            <div
              className={cn(TYPE_META, "text-muted-foreground/50")}
            >
              {activeMeta?.sub}
            </div>
          </div>

          {/* ── Sub-hub content ──────────────────────────────────── */}
          <div className="mt-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={
                  reducedMotion
                    ? { opacity: 1 }
                    : { opacity: 0, y: 16, filter: "blur(6px)" }
                }
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={
                  reducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, y: -8, filter: "blur(4px)" }
                }
                transition={{ duration: 0.45, ease: EASE_PREMIUM }}
              >
                {activeTab === "create" ? (
                  <CreationHub
                    onStartCreation={handleStartCreation}
                    onReady={handleHubReady}
                  />
                ) : activeTab === "image" ? (
                  <ImageStudioHub />
                ) : activeTab === "photo" ? (
                  <PhotoEditorHub />
                ) : (
                  <ScenesHub />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </EditorialCanvas>
      </div>

      {isCreating && <LoadingOverlay status={creationStatus} />}
    </FoundationShell>
  );
}

const StudioContent = withSafePageRef(StudioContentInner, "StudioContent");

export default function Studio() {
  usePageMeta({
    title: "Studio — Small Bridges",
    description:
      "Compose cinematic scenes, avatars, and environments in one studio.",
  });

  return (
    <ErrorBoundary>
      <StudioContent />
    </ErrorBoundary>
  );
}
