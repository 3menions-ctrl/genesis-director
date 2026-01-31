import { useState, useCallback, useEffect, useRef, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import PipelineBackground from '@/components/production/PipelineBackground';
import { CreationHub } from '@/components/studio/CreationHub';
import { AppHeader } from '@/components/layout/AppHeader';
import { useAuth } from '@/contexts/AuthContext';
import { VideoGenerationMode, VideoStylePreset } from '@/types/video-modes';
import { supabase } from '@/integrations/supabase/client';
import { handleError } from '@/lib/errorHandler';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { useStabilityGuard, isAbortError } from '@/hooks/useStabilityGuard';
import { usePageReady } from '@/contexts/NavigationLoadingContext';
import { BrandLoadingSpinner } from '@/components/ui/UnifiedLoadingPage';

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

// Main content component separated for error boundary
// REMOVED forwardRef - not needed and was causing potential crash in Dialog contexts
const CreateContent = memo(function CreateContent() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [creationStatus, setCreationStatus] = useState<string>('');
  const [isHubReady, setIsHubReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { markReady, disableAutoComplete } = usePageReady();
  
  // Disable auto-complete since CreationHub manages readiness via onReady callback
  // This prevents race condition where overlay dismisses before data is loaded
  useEffect(() => {
    disableAutoComplete();
  }, [disableAutoComplete]);
  
  // Use comprehensive stability guard for safe async operations
  const { isMounted, getAbortController, safeSetState } = useStabilityGuard();

  // Signal page is ready ONLY after CreationHub data dependencies are loaded
  // This prevents the GlobalLoadingOverlay from dismissing prematurely
  useEffect(() => {
    if (isHubReady) {
      markReady('create-page');
    }
  }, [isHubReady, markReady]);
  
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
      
      // All modes use mode-router now
      const { data, error } = await supabase.functions.invoke('mode-router', {
        body: {
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
        },
      });

      // Check if component is still mounted
      if (!isMounted()) return;

      if (error) {
        // Handle specific error types
        if (error.message?.includes('402') || error.message?.includes('credits')) {
          toast.error('Insufficient credits. Please purchase more credits to continue.');
          navigate('/settings?tab=billing');
          return;
        }
        throw error;
      }

      // Check for active project conflict (409 response)
      if (data?.error === 'active_project_exists') {
        toast.error(data.message, {
          duration: 8000,
          action: {
            label: 'View Project',
            onClick: () => navigate(`/production/${data.existingProjectId}`),
          },
        });
        return;
      }

      if (!data?.projectId) {
        throw new Error('Failed to create project - no project ID returned from server');
      }

      if (!isMounted()) return;
      safeSetState(setCreationStatus, 'Redirecting to production...');
      toast.success(`${config.mode.replace(/-/g, ' ')} creation started!`);
      
      // Navigate to production page to monitor progress
      navigate(`/production/${data.projectId}`);
    } catch (error) {
      // Ignore abort errors - expected during fast navigation
      if (isAbortError(error)) return;
      if (!isMounted()) return;
      
      console.error('Creation error:', error);
      handleError(error, 'Video creation', {
        showToast: true,
        onRetry: () => handleStartCreation(config),
      });
    } finally {
      if (isMounted()) {
        safeSetState(setIsCreating, false);
        safeSetState(setCreationStatus, '');
      }
    }
  }, [user, navigate, isMounted, getAbortController, safeSetState]);

  return (
    <div ref={containerRef} className="relative min-h-screen flex flex-col">
      <PipelineBackground />
      
      {/* Top Menu Bar */}
      <AppHeader />
      
      {/* Main Content */}
      <div className="relative z-10 flex-1">
        <CreationHub 
          onStartCreation={handleStartCreation}
          onReady={handleHubReady}
        />
      </div>
      
      {/* Loading overlay with status updates */}
      {isCreating && <LoadingOverlay status={creationStatus} />}
    </div>
  );
});

// Wrapper with error boundary for fault isolation
export default function Create() {
  return (
    <ErrorBoundary>
      <CreateContent />
    </ErrorBoundary>
  );
}
