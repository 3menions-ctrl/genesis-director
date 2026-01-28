import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import StudioBackground from '@/components/studio/StudioBackground';
import { CreationHub } from '@/components/studio/CreationHub';
import { useAuth } from '@/contexts/AuthContext';
import { VideoGenerationMode, VideoStylePreset } from '@/types/video-modes';
import { supabase } from '@/integrations/supabase/client';

export default function Create() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isCreating, setIsCreating] = useState(false);

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

    // Specialized modes (avatar, motion-transfer, video-to-video) 
    // use direct API call to mode-router - no script generation needed
    const isSpecializedMode = ['avatar', 'motion-transfer', 'video-to-video'].includes(config.mode);
    
    if (isSpecializedMode) {
      setIsCreating(true);
      try {
        // Direct call to mode-router for specialized modes
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

        if (error) throw error;

        toast.success(`${config.mode.replace(/-/g, ' ')} creation started!`);
        
        // Navigate to production page to monitor progress
        if (data?.projectId) {
          navigate(`/production/${data.projectId}`);
        } else {
          navigate('/projects');
        }
      } catch (error) {
        console.error('Creation error:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to start creation');
      } finally {
        setIsCreating(false);
      }
      return;
    }

    // Standard modes (text-to-video, image-to-video, b-roll) 
    // Call mode-router to create project and start pipeline directly
    setIsCreating(true);
    try {
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

      if (error) throw error;

      toast.success(`${config.mode.replace(/-/g, ' ')} creation started!`);
      
      // Navigate to production page to monitor progress
      if (data?.projectId) {
        navigate(`/production/${data.projectId}`);
      } else {
        navigate('/projects');
      }
    } catch (error) {
      console.error('Creation error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to start creation');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-black">
      <StudioBackground />
      
      <CreationHub 
        onStartCreation={handleStartCreation}
      />
      
      {/* Loading overlay for specialized modes */}
      {isCreating && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto" />
            <p className="text-white/70 text-lg">Starting creation...</p>
            <p className="text-white/40 text-sm">This may take a moment</p>
          </div>
        </div>
      )}
    </div>
  );
}
