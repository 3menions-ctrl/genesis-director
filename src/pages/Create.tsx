import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import StudioBackground from '@/components/studio/StudioBackground';
import { CreationHub } from '@/components/studio/CreationHub';
import { useAuth } from '@/contexts/AuthContext';
import { VideoGenerationMode, VideoStylePreset } from '@/types/video-modes';
import { supabase } from '@/integrations/supabase/client';

export default function Create() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const handleStartCreation = async (config: {
    mode: VideoGenerationMode;
    prompt: string;
    style?: VideoStylePreset;
    voiceId?: string;
    imageUrl?: string;
    videoUrl?: string;
  }) => {
    if (!user) {
      toast.error('Please sign in to create videos');
      navigate('/auth');
      return;
    }

    // Store creation config in session for the studio to pick up
    sessionStorage.setItem('pendingCreation', JSON.stringify({
      ...config,
      timestamp: Date.now(),
    }));

    // Navigate to studio with mode context
    toast.success(`Starting ${config.mode} creation...`);
    navigate('/studio');
  };

  return (
    <div className="relative min-h-screen bg-black">
      <StudioBackground />
      
      <CreationHub 
        onStartCreation={handleStartCreation}
      />
    </div>
  );
}
