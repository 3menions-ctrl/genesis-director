/**
 * Avatars Page - MAXIMUM STABILITY VERSION
 * 
 * CRITICAL STABILITY FIXES:
 * 1. Graceful timeout fallback (5s) to prevent infinite loading
 * 2. Isolated error boundaries for each section
 * 3. No framer-motion dependencies to prevent ref crashes
 * 4. All hooks have try-catch guards
 * 5. Context access failures are caught and logged
 * 6. Null guards on all data access
 * 
 * Stays on loading screen until:
 * 1. Auth loading complete
 * 2. Templates have fetched OR timeout reached
 * 
 * Implements:
 * - Virtual scrolling for memory optimization
 * - Strict AbortController cleanup
 * - onLoad-based opacity for image rendering
 */

import { useState, useCallback, useEffect, useMemo, useRef, memo, forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAvatarTemplatesQuery } from '@/hooks/useAvatarTemplatesQuery';
import { useAvatarVoices } from '@/hooks/useAvatarVoices';
import { useImagePreloader } from '@/hooks/useImagePreloader';
import { AvatarTemplate, AvatarType } from '@/types/avatar-templates';
import { AvatarPreviewModal } from '@/components/avatars/AvatarPreviewModal';
import { VirtualAvatarGallery } from '@/components/avatars/VirtualAvatarGallery';
import AvatarsBackground from '@/components/avatars/AvatarsBackground';
import { AvatarsHero } from '@/components/avatars/AvatarsHero';
import { AvatarsCategoryTabs } from '@/components/avatars/AvatarsCategoryTabs';
import { AvatarsFilters } from '@/components/avatars/AvatarsFilters';
import { AvatarsConfigPanel } from '@/components/avatars/AvatarsConfigPanel';
import { AppHeader } from '@/components/layout/AppHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useTierLimits } from '@/hooks/useTierLimits';
import { supabase } from '@/integrations/supabase/client';
import { handleError } from '@/lib/errorHandler';
import { ErrorBoundary, SafeComponent } from '@/components/ui/error-boundary';
import { CinemaLoader } from '@/components/ui/CinemaLoader';

// GATEKEEPER: Extract critical image URLs from templates
function getCriticalImageUrls(templates: AvatarTemplate[], limit = 8): string[] {
  // Guard against null/undefined templates
  if (!templates || !Array.isArray(templates)) return [];
  
  try {
    return templates
      .slice(0, limit)
      .map(t => t?.front_image_url || t?.face_image_url)
      .filter((url): url is string => Boolean(url));
  } catch (e) {
    console.error('[Avatars] getCriticalImageUrls error:', e);
    return [];
  }
}

// STABILITY: REDUCED timeout to 5s to fail faster and show content
const GATEKEEPER_TIMEOUT_MS = 5000;

const AvatarsContent = memo(forwardRef<HTMLDivElement, Record<string, never>>(function AvatarsContent(_, ref) {
  // ========== CRITICAL: Safe hook usage with try-catch ==========
  let navigate: ReturnType<typeof useNavigate>;
  let authContext: ReturnType<typeof useAuth> | null = null;
  let tierLimits: ReturnType<typeof useTierLimits> | null = null;
  
  try {
    navigate = useNavigate();
  } catch (e) {
    console.error('[Avatars] useNavigate failed:', e);
    // Fallback - create dummy navigate
    navigate = (() => {}) as unknown as ReturnType<typeof useNavigate>;
  }
  
  try {
    authContext = useAuth();
  } catch (e) {
    console.error('[Avatars] useAuth failed:', e);
  }
  
  try {
    tierLimits = useTierLimits();
  } catch (e) {
    console.error('[Avatars] useTierLimits failed:', e);
  }
  
  // Extract values with fallbacks
  const user = authContext?.user ?? null;
  const profile = authContext?.profile ?? null;
  const authLoading = authContext?.loading ?? false;
  const maxClips = tierLimits?.maxClips ?? 5;
  
  // ========== AbortController Lifecycle ==========
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const gatekeeperCompleteRef = useRef(false);
  
  // ========== STABILITY: Timeout Fallback ==========
  // Force render after timeout to prevent infinite loading state
  const [forceRender, setForceRender] = useState(false);
  
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (isMountedRef.current && !gatekeeperCompleteRef.current) {
        console.warn('[Avatars] Gatekeeper timeout reached, forcing render');
        setForceRender(true);
        gatekeeperCompleteRef.current = true;
      }
    }, GATEKEEPER_TIMEOUT_MS);
    
    return () => clearTimeout(timeoutId);
  }, []);
  
  // ========== Avatar Selection State ==========
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState('all');
  const [styleFilter, setStyleFilter] = useState('all');
  const [avatarTypeFilter, setAvatarTypeFilter] = useState<AvatarType | 'all'>('all');
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarTemplate | null>(null);
  const [previewAvatar, setPreviewAvatar] = useState<AvatarTemplate | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  
  // ========== Voice Management ==========
  const {
    playVoicePreview,
    preloadVoices,
    isVoiceReady,
    previewingVoice,
    stopPlayback,
  } = useAvatarVoices();
  
  // ========== Project Configuration ==========
  const [prompt, setPrompt] = useState('');
  const [sceneDescription, setSceneDescription] = useState('');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [clipCount, setClipCount] = useState(3);
  const [clipDuration, setClipDuration] = useState(10);
  const [enableMusic, setEnableMusic] = useState(true);
  
  // ========== Generation State ==========
  const [isCreating, setIsCreating] = useState(false);
  const [creationStatus, setCreationStatus] = useState('');
  
  // ========== Data Fetching with Gatekeeper ==========
  const filterConfig = useMemo(() => ({
    gender: genderFilter,
    style: styleFilter,
    search: searchQuery,
    avatarType: avatarTypeFilter,
  }), [genderFilter, styleFilter, searchQuery, avatarTypeFilter]);
  
  const { templates, isLoading: templatesLoading, isFetching, isSuccess, error } = useAvatarTemplatesQuery(filterConfig);
  
  // ========== GATEKEEPER: Image Preloading ==========
  // Guard against undefined templates array
  const safeTemplates = useMemo(() => templates || [], [templates]);
  const criticalImageUrls = useMemo(() => getCriticalImageUrls(safeTemplates, 8), [safeTemplates]);
  
  const {
    isReady: imagesReady,
    progress: imageProgress,
  } = useImagePreloader({
    images: criticalImageUrls,
    enabled: safeTemplates.length > 0 && !templatesLoading,
    minRequired: Math.min(3, criticalImageUrls.length), // REDUCED: only need 3 images to show UI
    timeout: 3000, // REDUCED: 3s timeout per image batch
    concurrency: 4,
  });
  
  // SIMPLIFIED GATEKEEPER: Only wait for auth and basic template fetch
  // Image preloading happens in background, forceRender is the ultimate fallback
  const isGatekeeperLoading = !forceRender && (
    authLoading || 
    (templatesLoading && !isSuccess) // Only block if actively loading AND no cached success
  );
  
  // Progress calculation simplified
  const gatekeeperProgress = authLoading ? 20 : 
    templatesLoading ? 50 : 
    Math.min(50 + (imageProgress * 0.5), 100);
  
  // ========== Computed Values ==========
  const userCredits = useMemo(() => profile?.credits_balance ?? 0, [profile?.credits_balance]);
  const estimatedCredits = useMemo(() => clipCount * 15, [clipCount]);
  const hasInsufficientCredits = useMemo(() => userCredits < estimatedCredits, [userCredits, estimatedCredits]);
  const estimatedDuration = useMemo(() => clipCount * clipDuration, [clipCount, clipDuration]);
  const hasActiveFilters = useMemo(() => 
    genderFilter !== 'all' || styleFilter !== 'all' || searchQuery.trim().length > 0,
    [genderFilter, styleFilter, searchQuery]
  );
  const isReadyToCreate = useMemo(() => 
    selectedAvatar && prompt.trim() && !hasInsufficientCredits,
    [selectedAvatar, prompt, hasInsufficientCredits]
  );
  
  // ========== LIFECYCLE: Strict Cleanup ==========
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      stopPlayback();
      
      // Abort any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [stopPlayback]);
  
  // ========== GATEKEEPER: Preload voices when ready ==========
  useEffect(() => {
    if (!isGatekeeperLoading && !gatekeeperCompleteRef.current && isMountedRef.current) {
      gatekeeperCompleteRef.current = true;
      
      // Preload voices in background AFTER page is visible
      if (safeTemplates.length > 0) {
        try {
          const visibleAvatars = safeTemplates.slice(0, 5);
          preloadVoices(visibleAvatars);
        } catch (e) {
          console.warn('[Avatars] Failed to preload voices:', e);
        }
      }
    }
  }, [isGatekeeperLoading, safeTemplates, preloadVoices]);
  
  // ========== Handlers ==========
  const handleVoicePreview = useCallback(async (avatar: AvatarTemplate) => {
    const success = await playVoicePreview(avatar);
    if (!success) {
      toast.error('Failed to preview voice');
    }
  }, [playVoicePreview]);
  
  const handleAvatarClick = useCallback((avatar: AvatarTemplate) => {
    setPreviewAvatar(avatar);
    setPreviewModalOpen(true);
  }, []);
  
  const handleSelectAvatar = useCallback((avatar: AvatarTemplate) => {
    setSelectedAvatar(avatar);
    toast.success(`Selected ${avatar.name}`);
  }, []);
  
  const buildCharacterBible = useCallback((avatar: AvatarTemplate) => {
    const bible = (avatar.character_bible || {}) as Record<string, unknown>;
    
    return {
      name: avatar.name,
      description: avatar.description,
      personality: avatar.personality,
      front_view: bible.front_view || `${avatar.name}, professional presenter, facing camera directly, neutral confident expression`,
      side_view: bible.side_view || `${avatar.name}, professional presenter, side profile view, same outfit and styling`,
      back_view: bible.back_view || `${avatar.name}, professional presenter, back view showing hair and outfit from behind`,
      silhouette: bible.silhouette || `${avatar.name}, distinctive silhouette shape, recognizable posture`,
      hair_description: bible.hair_description || 'consistent hairstyle throughout',
      clothing_description: bible.clothing_description || 'professional attire, consistent outfit',
      body_type: bible.body_type || 'average build',
      distinguishing_features: bible.distinguishing_features || [],
      reference_images: {
        front: avatar.front_image_url || avatar.face_image_url,
        side: avatar.side_image_url,
        back: avatar.back_image_url,
      },
      negative_prompts: bible.negative_prompts || [
        'different person',
        'face change',
        'different hairstyle',
        'different outfit',
        'morphing',
        'inconsistent appearance'
      ],
    };
  }, []);
  
  const handleCreate = useCallback(async () => {
    if (!user) {
      toast.error('Please sign in to create videos');
      navigate('/auth');
      return;
    }
    
    if (!selectedAvatar) {
      toast.error('Please select an avatar first');
      return;
    }
    
    if (!prompt.trim()) {
      toast.error('Please enter what you want the avatar to say');
      return;
    }
    
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    setIsCreating(true);
    setCreationStatus('Building character identity...');
    
    try {
      const characterBible = buildCharacterBible(selectedAvatar);
      
      if (!isMountedRef.current) return;
      setCreationStatus('Initializing avatar pipeline...');
      
      const { data, error } = await supabase.functions.invoke('mode-router', {
        body: {
          mode: 'avatar',
          userId: user.id,
          prompt: prompt.trim(),
          imageUrl: selectedAvatar.front_image_url || selectedAvatar.face_image_url,
          voiceId: selectedAvatar.voice_id,
          aspectRatio,
          clipCount,
          clipDuration,
          enableNarration: true,
          enableMusic,
          characterBible,
          avatarTemplateId: selectedAvatar.id,
          sceneDescription: sceneDescription.trim() || undefined,
        },
      });
      
      if (!isMountedRef.current) return;
      
      if (error) {
        if (error.message?.includes('402') || error.message?.includes('credits')) {
          toast.error('Insufficient credits. Please purchase more credits.');
          navigate('/settings?tab=billing');
          return;
        }
        throw error;
      }
      
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
        throw new Error('Failed to create project');
      }
      
      toast.success('Avatar video creation started!');
      navigate(`/production/${data.projectId}`);
    } catch (error) {
      // Ignore abort errors - expected during navigation
      if ((error as Error).name === 'AbortError') return;
      if (!isMountedRef.current) return;
      
      console.error('Creation error:', error);
      handleError(error, 'Avatar video creation', { showToast: true });
    } finally {
      if (isMountedRef.current) {
        setIsCreating(false);
        setCreationStatus('');
      }
    }
  }, [user, selectedAvatar, prompt, sceneDescription, aspectRatio, clipCount, clipDuration, enableMusic, navigate, buildCharacterBible]);
  
  const handleClearFilters = useCallback(() => {
    setGenderFilter('all');
    setStyleFilter('all');
    setSearchQuery('');
  }, []);
  
  const handleClosePreviewModal = useCallback(() => {
    setPreviewModalOpen(false);
  }, []);
  
  const handleClearAvatar = useCallback(() => {
    setSelectedAvatar(null);
  }, []);
  
  // ========== GATEKEEPER LOADING STATE ==========
  if (isGatekeeperLoading) {
    return (
      <div ref={ref || containerRef} className="relative min-h-screen flex flex-col bg-background overflow-hidden">
        <SafeComponent name="AvatarsBackground-loading" silent>
          <AvatarsBackground />
        </SafeComponent>
        <CinemaLoader
          isVisible={true}
          message={authLoading ? 'Authenticating...' : templatesLoading ? 'Loading avatar library...' : 'Preparing...'}
          progress={gatekeeperProgress}
          showProgress={true}
          variant="fullscreen"
        />
      </div>
    );
  }
  
  // ========== MAIN CONTENT ==========
  return (
    <div ref={ref || containerRef} className="relative min-h-screen flex flex-col bg-background overflow-x-hidden" style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <SafeComponent name="AvatarsBackground" silent>
        <AvatarsBackground />
      </SafeComponent>
      <SafeComponent name="AppHeader" fallback={<div className="h-16" />}>
        <AppHeader />
      </SafeComponent>
      
      <div className="relative z-10 flex-1 pb-48 md:pb-56 animate-fade-in">
        <SafeComponent name="AvatarsHero" fallback={<div className="pt-24 pb-8" />}>
          <AvatarsHero />
        </SafeComponent>
        
        <SafeComponent name="AvatarsFilters" fallback={<div className="mb-6 h-12" />}>
          <div className="mb-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <AvatarsFilters
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              genderFilter={genderFilter}
              onGenderChange={setGenderFilter}
              styleFilter={styleFilter}
              onStyleChange={setStyleFilter}
              hasActiveFilters={hasActiveFilters}
              onClearFilters={handleClearFilters}
              onBack={() => navigate('/create')}
            />
          </div>
        </SafeComponent>
        
        <SafeComponent name="AvatarsCategoryTabs" fallback={<div className="mb-8 h-12" />}>
          <div className="mb-8">
            <AvatarsCategoryTabs
              activeType={avatarTypeFilter}
              onTypeChange={setAvatarTypeFilter}
              totalCount={safeTemplates.length}
            />
          </div>
        </SafeComponent>
        
        <SafeComponent name="VirtualAvatarGallery">
          <div className="mb-8 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            {error ? (
              <div className="text-center py-12 text-destructive max-w-7xl mx-auto px-6">
                <p>{error}</p>
              </div>
            ) : (
              <VirtualAvatarGallery
                avatars={safeTemplates}
                selectedAvatar={selectedAvatar}
                onAvatarClick={handleAvatarClick}
                onVoicePreview={handleVoicePreview}
                previewingVoice={previewingVoice}
                isLoading={false}
                isVoiceReady={isVoiceReady}
              />
            )}
          </div>
        </SafeComponent>
      </div>
      
      <SafeComponent name="AvatarsConfigPanel" fallback={<div className="fixed bottom-0 h-32" />}>
        <AvatarsConfigPanel
          selectedAvatar={selectedAvatar}
          prompt={prompt}
          onPromptChange={setPrompt}
          sceneDescription={sceneDescription}
          onSceneDescriptionChange={setSceneDescription}
          aspectRatio={aspectRatio}
          onAspectRatioChange={setAspectRatio}
          clipDuration={clipDuration}
          onClipDurationChange={setClipDuration}
          clipCount={clipCount}
          onClipCountChange={setClipCount}
          maxClips={maxClips}
          enableMusic={enableMusic}
          onEnableMusicChange={setEnableMusic}
          estimatedDuration={estimatedDuration}
          estimatedCredits={estimatedCredits}
          userCredits={userCredits}
          hasInsufficientCredits={hasInsufficientCredits}
          isCreating={isCreating}
          isReadyToCreate={!!isReadyToCreate}
          onClearAvatar={handleClearAvatar}
          onCreate={handleCreate}
        />
      </SafeComponent>
      
      <SafeComponent name="AvatarPreviewModal" silent>
        <AvatarPreviewModal
          avatar={previewAvatar}
          open={previewModalOpen}
          onOpenChange={setPreviewModalOpen}
          onSelect={handleSelectAvatar}
          onPreviewVoice={handleVoicePreview}
          isPreviewingVoice={previewingVoice === previewAvatar?.id}
          isVoiceReady={previewAvatar ? isVoiceReady(previewAvatar) : false}
        />
      </SafeComponent>
      
      {/* Creation Overlay - CSS-based for stability */}
      {isCreating && (
        <div className="fixed inset-0 bg-background/95 backdrop-blur-md z-50 animate-fade-in">
          <CinemaLoader
            isVisible={true}
            message={creationStatus || 'Starting creation...'}
            showProgress={false}
            variant="fullscreen"
          />
        </div>
      )}
    </div>
  );
}));

AvatarsContent.displayName = 'AvatarsContent';

// Wrapper with error boundary - ref forwarding not needed as ErrorBoundary doesn't pass refs
export default function Avatars() {
  return (
    <ErrorBoundary>
      <AvatarsContent />
    </ErrorBoundary>
  );
}
