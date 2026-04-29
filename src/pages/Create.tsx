import { useState, useCallback, useEffect, memo } from 'react';
import { toast } from 'sonner';
import { Film, Sparkles, Image as ImageIcon, Wand2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreationHub } from '@/components/studio/CreationHub';
import { ScenesHub } from '@/components/scenes/ScenesHub';
import { PhotoEditorHub } from '@/components/photo-editor/PhotoEditorHub';
import { AppHeader } from '@/components/layout/AppHeader';
import { PageShell } from '@/components/shell';
import { useAuth } from '@/contexts/AuthContext';
import { VideoGenerationMode, VideoStylePreset } from '@/types/video-modes';
import { supabase } from '@/integrations/supabase/client';
import { handleError } from '@/lib/errorHandler';
import { handleEdgeFunctionError, showUserFriendlyError } from '@/lib/userFriendlyErrors';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { useStabilityGuard, useSafeNavigation, useRouteCleanup, isAbortError } from '@/lib/navigation';
import { BrandLoadingSpinner } from '@/components/ui/UnifiedLoadingPage';
import { CinemaLoader } from '@/components/ui/CinemaLoader';
import { withSafePageRef } from '@/lib/withSafeRef';
import { useGatekeeperLoading, GATEKEEPER_PRESETS, getGatekeeperMessage } from '@/hooks/useGatekeeperLoading';
import { cn } from '@/lib/utils';
import { saveDraft, loadDraft, clearDraft } from '@/lib/sessionPersistence';

// Premium tab definition for the Create studio
const STUDIO_TABS = [
  { key: 'create' as const, label: 'Create Video', sub: 'Cinematic generation', icon: Film },
  { key: 'scenes' as const, label: 'Scenes',       sub: 'Build your world',     icon: Sparkles },
  { key: 'photo'  as const, label: 'Photo Editor', sub: 'Refine every frame',   icon: ImageIcon },
];

// Ambient aurora background — fixed behind page, GPU-light
const StudioAurora = memo(function StudioAurora() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* deep base */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(220_14%_6%)_0%,hsl(220_14%_2%)_60%)]" />
      {/* primary aurora */}
      <div
        className="absolute -top-1/3 left-1/2 h-[60vmax] w-[60vmax] -translate-x-1/2 rounded-full opacity-[0.35] blur-3xl animate-[pulse_12s_ease-in-out_infinite]"
        style={{ background: 'radial-gradient(circle, hsl(212 100% 50% / 0.55) 0%, transparent 60%)' }}
      />
      {/* cool counter-glow */}
      <div
        className="absolute -bottom-1/3 -right-1/4 h-[55vmax] w-[55vmax] rounded-full opacity-25 blur-3xl"
        style={{ background: 'radial-gradient(circle, hsl(190 100% 55% / 0.35) 0%, transparent 65%)' }}
      />
      {/* film grain */}
      <div
        className="absolute inset-0 opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
      {/* top hairline highlight */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
});

// Premium glass segmented tabs with sliding indicator
function StudioTabs({
  value,
  onChange,
}: {
  value: 'create' | 'scenes' | 'photo';
  onChange: (v: 'create' | 'scenes' | 'photo') => void;
}) {
  return (
    <div
      role="tablist"
      className="relative inline-flex items-center gap-1 rounded-2xl p-1.5 border border-white/[0.07] bg-white/[0.02] backdrop-blur-2xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.04)]"
    >
      {STUDIO_TABS.map((tab) => {
        const Icon = tab.icon;
        const active = value === tab.key;
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.key)}
            className={cn(
              'relative z-10 flex items-center gap-2.5 px-4 sm:px-5 py-2.5 rounded-xl text-sm font-medium transition-colors duration-300',
              active ? 'text-white' : 'text-white/50 hover:text-white/80'
            )}
          >
            {active && (
              <motion.span
                layoutId="studio-tab-active"
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                className="absolute inset-0 -z-10 rounded-xl"
                style={{
                  background:
                    'linear-gradient(180deg, hsl(212 100% 56% / 0.22) 0%, hsl(212 100% 50% / 0.12) 100%)',
                  border: '1px solid hsl(212 100% 60% / 0.35)',
                  boxShadow:
                    '0 8px 30px -8px hsl(212 100% 50% / 0.45), inset 0 1px 0 hsl(212 100% 70% / 0.25)',
                }}
              />
            )}
            <Icon className={cn('w-4 h-4 transition-colors', active ? 'text-primary' : 'opacity-70')} />
            <span className="tracking-tight">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Loading overlay component for creation in progress - uses unified brand animation
const LoadingOverlay = memo(function LoadingOverlay({ status }: { status: string }) {
  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="text-center space-y-6">
        <BrandLoadingSpinner size="lg" />
        <p className="text-foreground text-lg font-medium">{status || 'Starting creation...'}</p>
        <p className="text-muted-foreground text-sm">This may take a moment</p>
      </div>
    </div>
  );
});

// Main content component - wrapped with withSafePageRef for bulletproof ref handling
function CreateContentInner() {
  // Unified navigation - safe navigation with locking
  // Use emergencyNavigate for post-creation redirect to bypass locks
  const { navigate, emergencyNavigate } = useSafeNavigation();
  
  // FIX: useAuth now returns safe fallback if context is missing
  // No try-catch needed - that violated React's hook rules
  const { user } = useAuth();
  
  const [isCreating, setIsCreating] = useState(false);
  const [creationStatus, setCreationStatus] = useState<string>('');
  const [isHubReady, setIsHubReady] = useState(false);
  
  // Restore active tab from session persistence
  const [activeTab, setActiveTab] = useState<'create' | 'scenes' | 'photo'>(() => {
    try {
      const saved = localStorage.getItem('apex_create_active_tab');
      if (saved === 'create' || saved === 'scenes' || saved === 'photo') return saved;
    } catch {}
    return 'create';
  });
  
  // Persist active tab changes
  useEffect(() => {
    try {
      localStorage.setItem('apex_create_active_tab', activeTab);
    } catch {}
  }, [activeTab]);
  
  // Restore draft on mount if returning to the page
  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      toast.info('Draft restored — pick up where you left off', { duration: 3000 });
    }
  }, []);
  
  // Use comprehensive stability guard for safe async operations
  const { isMounted, getAbortController, safeSetState } = useStabilityGuard();
  
  // CENTRALIZED GATEKEEPER - replaces inline timeout logic
  // Pass authLoading so gatekeeper tracks auth → data phases properly
  const authLoading = !user;
  const gatekeeper = useGatekeeperLoading({
    ...GATEKEEPER_PRESETS.create,
    authLoading,
    dataLoading: !isHubReady,
    dataSuccess: isHubReady,
  });
  
  // Register cleanup when leaving this page
  useRouteCleanup(() => {
    // Cancel any pending creation
    if (isCreating) {
      console.debug('[Create] Cleanup: cancelling pending creation');
    }
  }, [isCreating]);
  
  // Callback from CreationHub when its data is ready
  const handleHubReady = useCallback(() => {
    setIsHubReady(true);
  }, []);

  const handleStartCreation = useCallback(async (config: {
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
    // Breakout template parameters
    isBreakout?: boolean;
    breakoutStartImageUrl?: string;
    breakoutPlatform?: string;
    // Avatar parameters for breakout templates
    avatarImageUrl?: string;
    avatarVoiceId?: string;
    avatarTemplateId?: string;
    avatarName?: string;
    // Engine selection: 'veo' key = Runway (Gen-4.5 T2V / Gen-4 Turbo I2V), 'kling' = avatar
    videoEngine?: 'kling' | 'veo' | 'seedance';
  }) => {
    if (!user) {
      toast.error('Please sign in to create videos');
      navigate('/auth');
      return;
    }

    // Abort any previous request using navigation guard
    const controller = getAbortController();

    safeSetState(setIsCreating, true);
    safeSetState(setCreationStatus, 'Initializing pipeline...');

    try {
      if (!isMounted()) return;
      safeSetState(setCreationStatus, 'Creating project...');
      
      // Build the request body
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
        enableNarration: config.enableNarration,
        enableMusic: config.enableMusic,
        genre: config.genre,
        mood: config.mood,
        videoEngine: config.videoEngine, // 'veo' key = Runway (Gen-4.5 T2V / Gen-4 Turbo I2V), 'kling' = avatar
        // Breakout template parameters - for platform UI shattering effect
        isBreakout: config.isBreakout,
        breakoutStartImageUrl: config.breakoutStartImageUrl,
        breakoutPlatform: config.breakoutPlatform,
      };
      
      // Add avatar parameters if this is a breakout template with avatar
      if (config.isBreakout && config.avatarImageUrl) {
        requestBody.avatarImageUrl = config.avatarImageUrl;
        requestBody.voiceId = config.avatarVoiceId;
        requestBody.avatarTemplateId = config.avatarTemplateId;
        requestBody.avatarName = config.avatarName;
        // Use the avatar image as the reference for character consistency
        requestBody.imageUrl = config.avatarImageUrl;
      }
      
      // All modes use mode-router now
      const { data, error } = await supabase.functions.invoke('mode-router', {
        body: requestBody,
      });


      if (error || data?.error) {
        const { handled } = await handleEdgeFunctionError(
          error, 
          data, 
          (path) => navigate(path)
        );
        if (handled) return;
        if (error) throw error;
      }

      if (!data?.projectId) {
        throw new Error('Failed to create project - no project ID returned from server');
      }

      // Clear creating state BEFORE navigation to prevent stuck overlay
      safeSetState(setIsCreating, false);
      safeSetState(setCreationStatus, '');
      
      // Clear draft on successful creation
      clearDraft();
      
      toast.success(`${config.mode.replace(/-/g, ' ')} creation started!`);
      
      // Use emergencyNavigate to bypass any navigation locks after successful creation
      // CRITICAL: Always navigate even if component is unmounting - this ensures redirect happens
      emergencyNavigate(`/production/${data.projectId}`);
    } catch (error) {
      // Ignore abort errors - expected during fast navigation
      if (isAbortError(error)) return;
      
      console.error('Creation error:', error);
      if (isMounted()) {
        showUserFriendlyError(error, { navigate });
      }
    } finally {
      if (isMounted()) {
        safeSetState(setIsCreating, false);
        safeSetState(setCreationStatus, '');
      }
    }
  }, [user, navigate, emergencyNavigate, isMounted, getAbortController, safeSetState]);

  return (
    <div className="relative min-h-screen flex flex-col">
      <StudioAurora />
      {/* Gatekeeper loading screen */}
      {gatekeeper.isLoading && (
        <CinemaLoader
          isVisible={true}
          message={getGatekeeperMessage(gatekeeper.phase, GATEKEEPER_PRESETS.create.messages)}
          variant="fullscreen"
        />
      )}
      
      {/* Top Menu Bar */}
      <AppHeader />
      
      {/* Editorial Studio shell */}
      <PageShell width="wide" pad={false}>
        {/* Cinematic hero header */}
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mb-10 sm:mb-14"
        >
          <div className="flex items-center gap-2 mb-5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            <span className="text-[11px] uppercase tracking-[0.28em] text-white/50 font-medium">
              Apex Studio · Live
            </span>
          </div>

          <div className="flex items-end justify-between gap-8 flex-wrap">
            <div className="min-w-0 max-w-3xl">
              <h1 className="font-display text-[clamp(2.75rem,7vw,5.5rem)] leading-[0.95] tracking-[-0.035em] font-medium">
                <span className="text-white/95">Create</span>{' '}
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage:
                      'linear-gradient(120deg, hsl(212 100% 70%) 0%, hsl(190 100% 70%) 45%, hsl(212 100% 85%) 100%)',
                  }}
                >
                  cinema.
                </span>
              </h1>
              <p className="text-base sm:text-lg text-white/55 mt-5 leading-relaxed font-light max-w-xl">
                Compose a film, sculpt a scene, or refine a single still — every premium workflow lives in one studio.
              </p>
            </div>

            <div className="hidden md:flex items-center gap-3 text-[11px] uppercase tracking-[0.22em] text-white/40">
              <Wand2 className="w-3.5 h-3.5 text-primary/80" />
              <span>Director Mode</span>
            </div>
          </div>

          {/* hairline */}
          <div className="mt-10 h-px bg-gradient-to-r from-transparent via-white/[0.09] to-transparent" />

          {/* Premium tabs */}
          <div className="mt-6 flex items-center justify-between gap-4 flex-wrap">
            <StudioTabs value={activeTab} onChange={setActiveTab} />
            <div className="text-[11px] uppercase tracking-[0.22em] text-white/35">
              {STUDIO_TABS.find((t) => t.key === activeTab)?.sub}
            </div>
          </div>
        </motion.header>

        <div
          className="relative z-10"
          style={{ opacity: gatekeeper.isLoading ? 0 : 1, transition: 'opacity 0.3s ease-out' }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              {activeTab === 'create' ? (
                <CreationHub
                  onStartCreation={handleStartCreation}
                  onReady={handleHubReady}
                />
              ) : activeTab === 'photo' ? (
                <PhotoEditorHub />
              ) : (
                <ScenesHub />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </PageShell>
      
      {/* Loading overlay with status updates */}
      {isCreating && <LoadingOverlay status={creationStatus} />}
    </div>
  );
}

// Apply universal SafePageRef wrapper - absorbs refs injected by parent libraries
const CreateContent = withSafePageRef(CreateContentInner, 'CreateContent');

// Wrapper with error boundary
export default function Create() {
  return (
    <ErrorBoundary>
      <CreateContent />
    </ErrorBoundary>
  );
}
