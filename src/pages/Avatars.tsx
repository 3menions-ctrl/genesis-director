import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAvatarTemplates } from '@/hooks/useAvatarTemplates';
import { AvatarTemplate, AvatarType } from '@/types/avatar-templates';
import { AvatarPreviewModal } from '@/components/avatars/AvatarPreviewModal';
import { PremiumAvatarGallery } from '@/components/avatars/PremiumAvatarGallery';
import { AvatarsBackground } from '@/components/avatars/AvatarsBackground';
import { AvatarsHero } from '@/components/avatars/AvatarsHero';
import { AvatarsCategoryTabs } from '@/components/avatars/AvatarsCategoryTabs';
import { AvatarsFilters } from '@/components/avatars/AvatarsFilters';
import { AvatarsConfigPanel } from '@/components/avatars/AvatarsConfigPanel';
import { AppHeader } from '@/components/layout/AppHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useTierLimits } from '@/hooks/useTierLimits';
import { supabase } from '@/integrations/supabase/client';
import { handleError } from '@/lib/errorHandler';

export default function Avatars() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { maxClips } = useTierLimits();

  // Avatar selection state
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState('all');
  const [styleFilter, setStyleFilter] = useState('all');
  const [avatarTypeFilter, setAvatarTypeFilter] = useState<AvatarType | 'all'>('all');
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarTemplate | null>(null);
  const [previewAvatar, setPreviewAvatar] = useState<AvatarTemplate | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [voicePreviewCache, setVoicePreviewCache] = useState<Record<string, string>>({});

  // Project configuration state
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [clipCount, setClipCount] = useState(3);
  const [clipDuration, setClipDuration] = useState(5);
  const [enableMusic, setEnableMusic] = useState(true);

  // Generation state
  const [isCreating, setIsCreating] = useState(false);
  const [creationStatus, setCreationStatus] = useState('');

  const { templates, isLoading, error } = useAvatarTemplates({
    gender: genderFilter,
    style: styleFilter,
    search: searchQuery,
    avatarType: avatarTypeFilter,
  });

  const userCredits = profile?.credits_balance ?? 0;
  const estimatedCredits = clipCount * 10;
  const hasInsufficientCredits = userCredits < estimatedCredits;
  const estimatedDuration = clipCount * clipDuration;
  const hasActiveFilters = genderFilter !== 'all' || styleFilter !== 'all' || searchQuery.trim().length > 0;

  // Voice preview handler
  const handleVoicePreview = useCallback(async (avatar: AvatarTemplate) => {
    if (voicePreviewCache[avatar.id]) {
      const audio = new Audio(voicePreviewCache[avatar.id]);
      audio.play().catch(console.error);
      return;
    }
    
    setPreviewingVoice(avatar.id);
    
    try {
      const sampleText = `Hello, I'm ${avatar.name}. ${avatar.description || "I'm ready to help you create amazing videos."}`;
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-voice`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            text: sampleText,
            voiceId: avatar.voice_id,
          }),
        }
      );
      
      if (!response.ok) throw new Error('Voice generation failed');
      
      const data = await response.json();
      
      if (data.success && data.audioUrl) {
        setVoicePreviewCache(prev => ({ ...prev, [avatar.id]: data.audioUrl }));
        const audio = new Audio(data.audioUrl);
        audio.play().catch(console.error);
      }
    } catch (err) {
      console.error('Voice preview error:', err);
      toast.error('Failed to preview voice');
    } finally {
      setPreviewingVoice(null);
    }
  }, [voicePreviewCache]);

  // Handle avatar card click - open preview modal
  const handleAvatarClick = (avatar: AvatarTemplate) => {
    setPreviewAvatar(avatar);
    setPreviewModalOpen(true);
  };

  // Handle avatar selection from modal
  const handleSelectAvatar = (avatar: AvatarTemplate) => {
    setSelectedAvatar(avatar);
    toast.success(`Selected ${avatar.name}`);
  };

  // Build character bible for production consistency
  const buildCharacterBible = (avatar: AvatarTemplate) => {
    const bible = avatar.character_bible || {};
    
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
  };

  // Handle project creation
  const handleCreate = async () => {
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

    setIsCreating(true);
    setCreationStatus('Building character identity...');

    try {
      const characterBible = buildCharacterBible(selectedAvatar);
      
      setCreationStatus('Initializing avatar pipeline...');

      const { data, error } = await supabase.functions.invoke('mode-router', {
        body: {
          mode: 'avatar',
          userId: user.id,
          prompt: prompt,
          imageUrl: selectedAvatar.front_image_url || selectedAvatar.face_image_url,
          voiceId: selectedAvatar.voice_id,
          aspectRatio,
          clipCount,
          clipDuration,
          enableNarration: true,
          enableMusic,
          characterBible,
          avatarTemplateId: selectedAvatar.id,
        },
      });

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
      console.error('Creation error:', error);
      handleError(error, 'Avatar video creation', { showToast: true });
    } finally {
      setIsCreating(false);
      setCreationStatus('');
    }
  };

  const handleClearFilters = useCallback(() => {
    setGenderFilter('all');
    setStyleFilter('all');
    setSearchQuery('');
  }, []);

  const isReadyToCreate = selectedAvatar && prompt.trim() && !hasInsufficientCredits;

  return (
    <div className="relative min-h-screen flex flex-col bg-black overflow-hidden">
      <AvatarsBackground />
      <AppHeader />
      
      <div className="relative z-10 flex-1 pb-48 md:pb-56">
        {/* Hero Section */}
        <AvatarsHero />

        {/* Filters */}
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

        {/* Category Tabs */}
        <div className="mb-8">
          <AvatarsCategoryTabs
            activeType={avatarTypeFilter}
            onTypeChange={setAvatarTypeFilter}
            totalCount={templates.length}
          />
        </div>

        {/* Premium Horizontal Gallery */}
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
            />
          )}
        </motion.div>
      </div>

      {/* Sticky Configuration Panel */}
      <AvatarsConfigPanel
        selectedAvatar={selectedAvatar}
        prompt={prompt}
        onPromptChange={setPrompt}
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
        onClearAvatar={() => setSelectedAvatar(null)}
        onCreate={handleCreate}
      />

      {/* Avatar Preview Modal with 3D Viewer */}
      <AvatarPreviewModal
        avatar={previewAvatar}
        open={previewModalOpen}
        onOpenChange={setPreviewModalOpen}
        onSelect={handleSelectAvatar}
        onPreviewVoice={handleVoicePreview}
        isPreviewingVoice={previewingVoice === previewAvatar?.id}
      />

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
}
