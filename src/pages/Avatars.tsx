import { useState, useCallback, useEffect, useMemo, useRef, memo, forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAvatarTemplates } from '@/hooks/useAvatarTemplates';
import { useAvatarVoices } from '@/hooks/useAvatarVoices';
import { AvatarTemplate, AvatarType } from '@/types/avatar-templates';
import { AvatarPreviewModal } from '@/components/avatars/AvatarPreviewModal';
import { PremiumAvatarGallery } from '@/components/avatars/PremiumAvatarGallery';
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

// Separated content for error boundary isolation
const AvatarsContent = memo(forwardRef<HTMLDivElement, Record<string, never>>(function AvatarsContent(_, ref) {
  const navigate = useNavigate();
  const { user, profile, isSessionVerified, loading: authLoading } = useAuth();
  const { maxClips } = useTierLimits();
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  // Avatar selection state - ALL HOOKS MUST BE CALLED BEFORE ANY RETURNS
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState('all');
  const [styleFilter, setStyleFilter] = useState('all');
  const [avatarTypeFilter, setAvatarTypeFilter] = useState<AvatarType | 'all'>('all');
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarTemplate | null>(null);
  const [previewAvatar, setPreviewAvatar] = useState<AvatarTemplate | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  // Voice management with smart caching and preloading
  const {
    playVoicePreview,
    preloadVoices,
    isVoiceReady,
    previewingVoice,
    stopPlayback,
  } = useAvatarVoices();

  // Project configuration state
  const [prompt, setPrompt] = useState('');
  const [sceneDescription, setSceneDescription] = useState(''); // NEW: Scene/background description
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [clipCount, setClipCount] = useState(3);
  const [clipDuration, setClipDuration] = useState(5);
  const [enableMusic, setEnableMusic] = useState(true);

  // Generation state
  const [isCreating, setIsCreating] = useState(false);
  const [creationStatus, setCreationStatus] = useState('');

  // Memoize filter config to prevent unnecessary re-renders
  const filterConfig = useMemo(() => ({
    gender: genderFilter,
    style: styleFilter,
    search: searchQuery,
    avatarType: avatarTypeFilter,
  }), [genderFilter, styleFilter, searchQuery, avatarTypeFilter]);

  const { templates, isLoading, error } = useAvatarTemplates(filterConfig);

  // Memoize computed values
  const userCredits = useMemo(() => profile?.credits_balance ?? 0, [profile?.credits_balance]);
  const estimatedCredits = useMemo(() => clipCount * 10, [clipCount]);
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

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopPlayback();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [stopPlayback]);

  // Preload voices for visible avatars when templates load
  useEffect(() => {
    if (templates.length > 0 && !isLoading) {
      // Preload first 5 visible avatars' voices in background
      const visibleAvatars = templates.slice(0, 5);
      preloadVoices(visibleAvatars);
    }
  }, [templates, isLoading, preloadVoices]);

  // Voice preview handler - uses smart caching
  const handleVoicePreview = useCallback(async (avatar: AvatarTemplate) => {
    const success = await playVoicePreview(avatar);
    if (!success) {
      toast.error('Failed to preview voice');
    }
  }, [playVoicePreview]);

  // Handle avatar card click - open preview modal
  const handleAvatarClick = useCallback((avatar: AvatarTemplate) => {
    setPreviewAvatar(avatar);
    setPreviewModalOpen(true);
  }, []);

  // Handle avatar selection from modal
  const handleSelectAvatar = useCallback((avatar: AvatarTemplate) => {
    setSelectedAvatar(avatar);
    toast.success(`Selected ${avatar.name}`);
  }, []);

  // Build character bible for production consistency
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

  // Handle project creation with abort support
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

    // Abort any previous request
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
          sceneDescription: sceneDescription.trim() || undefined, // Pass scene description to backend
        },
      });

      // Check if component is still mounted
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
      // Ignore abort errors
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

  // Memoize modal handlers
  const handleClosePreviewModal = useCallback(() => {
    setPreviewModalOpen(false);
  }, []);

  const handleOpenPreviewModal = useCallback((avatar: AvatarTemplate) => {
    setPreviewAvatar(avatar);
    setPreviewModalOpen(true);
  }, []);

  const handleClearAvatar = useCallback(() => {
    setSelectedAvatar(null);
  }, []);

  // NOTE: ProtectedRoute already handles auth loading state, so we don't need
  // to block here. Just proceed with rendering - profile may still be loading
  // but that's okay since we use fallbacks for profile data.

  return (
    <div className="relative min-h-screen flex flex-col bg-black overflow-x-hidden" style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <SafeComponent name="AvatarsBackground" silent>
        <AvatarsBackground />
      </SafeComponent>
      <SafeComponent name="AppHeader" fallback={<div className="h-16" />}>
        <AppHeader />
      </SafeComponent>
      
      <div className="relative z-10 flex-1 pb-48 md:pb-56">
        {/* Hero Section - isolated */}
        <SafeComponent name="AvatarsHero" fallback={<div className="pt-24 pb-8" />}>
          <AvatarsHero />
        </SafeComponent>

        {/* Filters - isolated */}
        <SafeComponent name="AvatarsFilters" fallback={<div className="mb-6 h-12" />}>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-6"
          >
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
          </motion.div>
        </SafeComponent>

        {/* Category Tabs - isolated */}
        <SafeComponent name="AvatarsCategoryTabs" fallback={<div className="mb-8 h-12" />}>
          <div className="mb-8">
            <AvatarsCategoryTabs
              activeType={avatarTypeFilter}
              onTypeChange={setAvatarTypeFilter}
              totalCount={templates.length}
            />
          </div>
        </SafeComponent>

        {/* Premium Horizontal Gallery - isolated with error display */}
        <SafeComponent name="PremiumAvatarGallery">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mb-8"
          >
            {error ? (
              <div className="text-center py-12 text-red-400 max-w-7xl mx-auto px-6">
                <p>{error}</p>
              </div>
            ) : (
              <PremiumAvatarGallery
                avatars={templates}
                selectedAvatar={selectedAvatar}
                onAvatarClick={handleAvatarClick}
                onVoicePreview={handleVoicePreview}
                previewingVoice={previewingVoice}
                isLoading={isLoading}
                isVoiceReady={isVoiceReady}
              />
            )}
          </motion.div>
        </SafeComponent>
      </div>

      {/* Sticky Configuration Panel - isolated */}
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

      {/* Avatar Preview Modal with 3D Viewer - isolated */}
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

      {/* Loading Overlay */}
      {isCreating && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-6"
          >
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 rounded-full border-2 border-violet-500/30 animate-ping" />
              <div className="absolute inset-2 rounded-full border-2 border-violet-500/50 animate-pulse" />
              <div className="absolute inset-4 rounded-full bg-violet-500/20 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              </div>
            </div>
            <div>
              <p className="text-white text-lg font-medium">{creationStatus || 'Starting creation...'}</p>
              <p className="text-white/40 text-sm mt-2">Building character consistency profile...</p>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}));

// Wrapper with error boundary for fault isolation
export default function Avatars() {
  return (
    <ErrorBoundary>
      <AvatarsContent />
    </ErrorBoundary>
  );
}
