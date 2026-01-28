import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import PipelineBackground from '@/components/production/PipelineBackground';
import { CreationHub } from '@/components/studio/CreationHub';
import { AppHeader } from '@/components/layout/AppHeader';
import { useAuth } from '@/contexts/AuthContext';
import { VideoGenerationMode, VideoStylePreset } from '@/types/video-modes';
import { supabase } from '@/integrations/supabase/client';
import { handleError } from '@/lib/errorHandler';
export default function Create() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [creationStatus, setCreationStatus] = useState<string>('');

  const handleStartCreation = async (config: {
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

    setIsCreating(true);
    setCreationStatus('Initializing pipeline...');

    try {
      setCreationStatus('Creating project...');
      
      // All modes use mode-router now
      const { data, error } = await supabase.functions.invoke('mode-router', {
        body: {
          mode: config.mode,
          userId: user.id,
          prompt: config.prompt,
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

      setCreationStatus('Redirecting to production...');
      toast.success(`${config.mode.replace(/-/g, ' ')} creation started!`);
      
      // Navigate to production page to monitor progress
      navigate(`/production/${data.projectId}`);
    } catch (error) {
      console.error('Creation error:', error);
      handleError(error, 'Video creation', {
        showToast: true,
        onRetry: () => handleStartCreation(config),
      });
    } finally {
      setIsCreating(false);
      setCreationStatus('');
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col">
      <PipelineBackground />
      
      {/* Top Menu Bar */}
      <AppHeader />
      
      {/* Main Content */}
      <div className="relative z-10 flex-1">
        <CreationHub 
          onStartCreation={handleStartCreation}
        />
      </div>
      
      {/* Loading overlay with status updates */}
      {isCreating && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto" />
            <p className="text-white/70 text-lg">{creationStatus || 'Starting creation...'}</p>
            <p className="text-white/40 text-sm">This may take a moment</p>
          </div>
        </div>
      )}
    </div>
  );
}
