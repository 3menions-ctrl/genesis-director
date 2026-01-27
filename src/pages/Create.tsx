import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import StudioBackground from '@/components/studio/StudioBackground';
import { CreationHub } from '@/components/studio/CreationHub';
import { useAuth } from '@/contexts/AuthContext';
import { VideoGenerationMode, VideoStylePreset } from '@/types/video-modes';

export default function Create() {
  const navigate = useNavigate();
  const { user } = useAuth();

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
  }) => {
    if (!user) {
      toast.error('Please sign in to create videos');
      navigate('/auth');
      return;
    }

    // Store complete creation config in session for the studio to pick up
    sessionStorage.setItem('pendingCreation', JSON.stringify({
      // Core content
      concept: config.prompt,
      mode: config.mode,
      
      // Video format
      aspectRatio: config.aspectRatio,
      clipCount: config.clipCount,
      clipDuration: config.clipDuration,
      
      // Audio settings
      includeVoice: config.enableNarration,
      includeMusic: config.enableMusic,
      
      // Mode-specific settings
      style: config.style,
      voiceId: config.voiceId,
      imageUrl: config.imageUrl,
      videoUrl: config.videoUrl,
      
      // Metadata
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
