/**
 * Studio — /studio
 *
 * The single workshop. Replaces three legacy surfaces:
 *   - /studio (marketing landing page)
 *   - /create (the actual workshop, in the old AppShell)
 *   - /director (alternate director cockpit)
 *
 * Built on FoundationShell + SpineBackdrop and laid out with the same
 * borderless, cover-overlap arrangement as the Profile page — open
 * containers, generous spacing, a big serif identity, centered tabs.
 *
 * Anatomy:
 *   - Full-bleed aurora cover band (no border)
 *   - Hero pulled up to overlap: avatar · identity · actions
 *   - Centered glass segmented tabs: Create · Image · Scenes · Photo
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
import { IS_MOBILE_SHELL } from "@/lib/native";
import {
  Film,
  Image as ImageIcon,
  Wand2,
  Sparkles,
  Compass,
  Library as LibraryIcon,
  Theater as TheaterIcon,
  ArrowLeft,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { FoundationShell } from "@/components/foundation/FoundationShell";
import { PageShell } from "@/components/shell";
import { CreationHub } from "@/components/studio/CreationHub";
import { CreationStudio } from "@/components/studio/CreationStudio";
import { ProjectBackdrop } from "@/pages/Editor/components/ProjectBackdrop";
import { PhotoEditorHub } from "@/components/photo-editor/PhotoEditorHub";
import { ImageStudioHub } from "@/components/studio/ImageStudioHub";
import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/contexts/CreditsContext";
import { useEffectiveCredits } from "@/hooks/useEffectiveCredits";
import { useCinemaGuard } from "@/hooks/useCinemaEntitlement";
import { useLiveRenderTimecode } from "@/hooks/useLiveRenderTimecode";
import { VideoGenerationMode, VideoStylePreset } from "@/types/video-modes";
import { supabase } from "@/integrations/supabase/client";
import {
  handleEdgeFunctionError,
  showUserFriendlyError,
} from "@/lib/userFriendlyErrors";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { CenterLine } from "@/components/ui/CenterLine";
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
import { ENGINES, renderSurchargeCredits, type EngineId } from "@/lib/video/engines";
import { getAuthoritativeCreditState } from "@/lib/credits/authoritativeCreditState";
import { usePageMeta } from "@/hooks/usePageMeta";
import { usePageTone, TONE_PRESETS } from "@/lib/page-tone";
import { EASE_PREMIUM, TYPE_META } from "@/lib/design-system";
import { useModuleLink, useModuleBase, isMappedInModule } from "@/components/foundation/moduleBase";

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
      className="relative inline-flex flex-wrap items-center gap-1 rounded-full p-1 bg-white/[0.03] backdrop-blur-xl shadow-[0_24px_60px_-24px_rgba(0,0,0,0.7)]"
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
            {active && <CenterLine />}
            <Icon
              className={cn(
                "h-3.5 w-3.5 shrink-0",
                active ? "text-white" : "opacity-60",
              )}
              strokeWidth={1.5}
              style={active ? { filter: "drop-shadow(0 0 6px rgba(255,255,255,0.4))" } : undefined}
            />
            <span className={cn("font-light", active && "text-white")}>{tab.label}</span>
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
  const moduleLink = useModuleLink();
  const inModule = !!useModuleBase();
  const { user, profile } = useAuth();
  const credits = useCredits();
  // Org-aware wallet (org pool for business workspaces, personal otherwise).
  // Drives the header balance + the pre-flight gate so the studio reads the
  // SAME wallet the server will actually debit.
  const effective = useEffectiveCredits();
  // First name for the personalized hero greeting (Profile-page
  // language). Falls back to the email local-part, then "Director".
  const studioName = (() => {
    const dn = (profile?.display_name ?? "").trim();
    if (dn) return dn.split(/\s+/)[0];
    const local = (user?.email ?? "").split("@")[0];
    if (local) return local.charAt(0).toUpperCase() + local.slice(1);
    return "Director";
  })();
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

  const [searchParams] = useSearchParams();
  const initialPrompt =
    searchParams.get("prompt") ??
    (typeof window !== "undefined" ? window.sessionStorage.getItem("smallbridges.tour_prompt") ?? undefined : undefined);

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
      videoEngine?: "wan" | "kling" | "veo" | "seedance" | "sora";
      qualityOptions?: { upscale4k?: boolean; fps60?: boolean };
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
        // Org workspaces spend the org pool (the server debits it for org
        // projects), so gate on the org wallet — not the member's personal
        // balance — otherwise a member with 0 personal credits but a funded
        // org pool would be wrongly blocked. Personal projects keep the
        // authoritative (hold-aware) personal state.
        const creditState = effective.isOrg
          ? await effective.refresh()
          : (await getAuthoritativeCreditState()) ?? (await credits.reconcile());
        // Keep the personal display in sync; the org branch already refreshed.
        if (!effective.isOrg) void credits.refresh();
        const durations = config.clipDurations?.length
          ? config.clipDurations
          : Array.from(
              { length: config.clipCount },
              () => config.clipDuration,
            );
        const baseCredits = calculateCreditsForDurations(
          durations,
          (config.videoEngine || "kling") as VideoEngine,
        );
        // Quality cores (4K / 60fps) are charged ONCE on the final film
        // (charge-on-delivery at the finalizer). Include them in the gate so
        // the user holds enough for the surcharge they'll be billed.
        const BACKEND_TO_ENGINE_ID: Record<string, EngineId> = {
          wan: "wan-25", kling: "kling-v3", seedance: "seedance-2",
          veo: "veo-3", runway: "runway-gen4", sora: "sora-2",
        };
        const qualitySpec = ENGINES[BACKEND_TO_ENGINE_ID[config.videoEngine || "kling"] ?? "kling-v3"];
        const qualitySurcharge = qualitySpec
          ? renderSurchargeCredits(qualitySpec, config.qualityOptions ?? {})
          : 0;
        const requiredCredits = baseCredits + qualitySurcharge;
        if (creditState.available < requiredCredits) {
          toast.error(
            `Insufficient credits. Need ${requiredCredits}, available ${creditState.available}.`,
          );
          navigate("/credits");
          return;
        }

        safeSetState(setCreationStatus, "Creating project…");

        // Cinematic modes write a script first — pause for the user to approve
        // it (Production page shows the ScriptApproval gate) before any clip is
        // rendered. Avatar / video-to-video / motion-transfer have no script
        // step, and breakouts are forced onto seedance-pipeline (which doesn't
        // honor approval), so those keep running straight through.
        const usesScriptApproval =
          !config.isBreakout &&
          config.mode !== "avatar" &&
          config.mode !== "video-to-video" &&
          config.mode !== "motion-transfer";

        const requestBody: Record<string, unknown> = {
          mode: config.mode,
          userId: user.id,
          requireApproval: usesScriptApproval,
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
          qualityOptions: config.qualityOptions,
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
    <>
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

      {/* Borderless, cover-overlap arrangement — mirrors the Profile
          page: a full-bleed aurora cover band, content pulled up to
          overlap it, an open three-column hero (avatar · identity ·
          actions) with no card chrome, then centered tabs. The creation
          pipeline below is untouched — this is shell only. */}
      <div
        className="relative min-h-screen flex flex-col"
        style={{
          opacity: gatekeeper.isLoading ? 0 : 1,
          transition: "opacity 0.3s ease-out",
        }}
      >
        {/* Same atmospheric backdrop the Editor uses — a deep, subtly-hued
            dark wash + grain. Fixed wrapper so it covers the viewport. */}
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
          <ProjectBackdrop thumbnailUrl={null} projectId="studio-create" mood={null} />
        </div>
        <motion.section
          style={{ position: "relative", zIndex: 1 }}
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="relative w-full"
        >
          <PageShell width="gallery" pad>
            {/* Slim, editor-style top bar — a back arrow to the lobby on the
                left (replaces the foundation left-rail), credits + the other
                doors on the right. No cover band, no profile puck.
                Hidden in the native app: navigation is the bottom tab bar and
                this web-style nav must not bleed in. */}
            {!IS_MOBILE_SHELL && (
            <div className="flex items-center justify-between gap-3 pt-6 pb-5">
              <Link
                to={moduleLink("/lobby")}
                aria-label="Back to lobby"
                className="group inline-flex items-center gap-2 rounded-full shadow-[0_12px_32px_-16px_rgba(0,0,0,0.75)] bg-[hsl(220_30%_8%/0.5)] backdrop-blur-md px-4 h-9 transition-colors hover:bg-[hsl(var(--accent)/0.07)]"
              >
                <ArrowLeft className="h-4 w-4 text-white/70 group-hover:text-accent" strokeWidth={1.7} />
                <span className="text-[13px] text-white/85 group-hover:text-white">Lobby</span>
              </Link>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <div className="inline-flex items-center gap-2.5 rounded-full shadow-[0_12px_32px_-16px_rgba(0,0,0,0.75)] bg-[hsl(220_30%_8%/0.6)] backdrop-blur-xl px-4 h-9">
                  <Sparkles className="h-3.5 w-3.5 text-accent" strokeWidth={1.6} />
                  <span className="text-[13px] font-medium text-white/90 tabular-nums">
                    {effective.available.toLocaleString()}
                  </span>
                  <span className={cn(TYPE_META, "text-white/40")}>credits</span>
                </div>
                {STUDIO_EXITS.filter(({ to }) => to !== "/lobby" && (!inModule || isMappedInModule(to))).map(({ to, label, Icon }) => (
                  <Link
                    key={to}
                    to={moduleLink(to)}
                    className={cn(
                      "group hidden sm:inline-flex items-center gap-2 rounded-full shadow-[0_10px_26px_-16px_rgba(0,0,0,0.65)] bg-[hsl(220_30%_8%/0.45)] backdrop-blur-md px-3.5 h-9",
                      "transition-colors hover:bg-[hsl(var(--accent)/0.07)]",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 text-white/60 group-hover:text-accent" strokeWidth={1.5} />
                    <span className="text-[12.5px] text-white/85 group-hover:text-white">{label}</span>
                  </Link>
                ))}
              </div>
            </div>
            )}

            {/* The Runway/Canva-style creation studio — left rail of modules,
                a live canvas, and a persistent composition bar. Replaces the
                old tabbed CreationHub / ImageStudioHub / Scenes / Photo layout. */}
            <CreationStudio
              onStartCreation={handleStartCreation}
              onReady={handleHubReady}
              initialPrompt={initialPrompt}
            />
          </PageShell>
        </motion.section>
      </div>

      {isCreating && <LoadingOverlay status={creationStatus} />}
    </>
  );
}

const StudioContent = withSafePageRef(StudioContentInner, "StudioContent");

// Shell-agnostic workbench — the Studio content with no FoundationShell, for
// embedding inside another shell (e.g. BusinessShell).
export const StudioWorkbench = StudioContent;

export default function Studio() {
  usePageMeta({
    title: "Studio — Small Bridges",
    description:
      "Compose cinematic scenes, avatars, and environments in one studio.",
  });
  usePageTone(TONE_PRESETS.studio);

  return (
    <ErrorBoundary>
      <FoundationShell bare>
        <StudioContent />
      </FoundationShell>
    </ErrorBoundary>
  );
}
