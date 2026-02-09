import { useState, useCallback, memo } from 'react';
import { toast } from 'sonner';
import ClipsBackground from '@/components/clips/ClipsBackground';
import { CreationHub } from '@/components/studio/CreationHub';
import { AppHeader } from '@/components/layout/AppHeader';
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
  
  // Use comprehensive stability guard for safe async operations
  const { isMounted, getAbortController, safeSetState } = useStabilityGuard();
  
  // CENTRALIZED GATEKEEPER - replaces inline timeout logic
  const gatekeeper = useGatekeeperLoading({
    ...GATEKEEPER_PRESETS.create,
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
      <ClipsBackground />
      
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
      
      {/* Main Content - only render when ready or forced */}
      <div 
        className="relative z-10 flex-1"
        style={{ opacity: gatekeeper.isLoading ? 0 : 1, transition: 'opacity 0.3s ease-out' }}
      >
        <CreationHub 
          onStartCreation={handleStartCreation}
          onReady={handleHubReady}
        />
      </div>
      
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
