/**
 * WelcomeVideoModal - Shows studio storytelling journey video to new users
 * 
 * Displays on first login after onboarding is complete, tracks view state in profile
 */

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Play, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// The Studio Storytelling Journey video URL
const WELCOME_VIDEO_URL = 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/avatar-videos/fc34967d-0fcc-4863-829e-29d2dee5e514/avatar_fc34967d-0fcc-4863-829e-29d2dee5e514_clip1_lipsync_1770421330974.mp4';

export function WelcomeVideoModal() {
  const { user, profile, refreshProfile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasMarkedSeen, setHasMarkedSeen] = useState(false);

  // Check if we should show the modal
  useEffect(() => {
    if (
      user && 
      profile && 
      profile.onboarding_completed && 
      profile.has_seen_welcome_video === false
    ) {
      // Small delay to let the page settle after login
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [user, profile]);

  // Mark the video as seen in the database
  const markVideoAsSeen = useCallback(async () => {
    if (!user || hasMarkedSeen) return;
    
    setHasMarkedSeen(true);
    
    try {
      await supabase
        .from('profiles')
        .update({ has_seen_welcome_video: true })
        .eq('id', user.id);
      
      // Refresh profile to update local state
      await refreshProfile();
    } catch (err) {
      console.error('[WelcomeVideoModal] Failed to mark video as seen:', err);
    }
  }, [user, hasMarkedSeen, refreshProfile]);

  // Handle modal close
  const handleClose = useCallback(() => {
    setIsOpen(false);
    markVideoAsSeen();
  }, [markVideoAsSeen]);

  // Handle video end
  const handleVideoEnded = useCallback(() => {
    setIsPlaying(false);
  }, []);

  // Handle play button click
  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    const video = document.getElementById('welcome-video') as HTMLVideoElement;
    if (video) {
      video.play().catch(console.error);
    }
  }, []);

  // Don't render if conditions aren't met
  if (!user || !profile || !profile.onboarding_completed || profile.has_seen_welcome_video !== false) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent 
        className="!fixed !left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2 !transform max-w-3xl w-[92vw] p-0 bg-black/95 border-white/10 overflow-hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-3 right-3 z-50 h-8 w-8 rounded-full bg-black/50 text-white/80 hover:bg-black/70 hover:text-white"
          onClick={handleClose}
        >
          <X className="h-4 w-4" />
        </Button>

        {/* Header */}
        <div className="p-6 pb-4 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/20 text-primary text-sm font-medium mb-3">
            <Sparkles className="h-4 w-4" />
            Welcome to the Studio
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Your Storytelling Journey Begins
          </h2>
          <p className="text-white/60 text-sm max-w-md mx-auto">
            Watch this quick intro to discover how to bring your stories to life with AI-powered video creation.
          </p>
        </div>

        {/* Video container */}
        <div className="relative aspect-video bg-black mx-4 mb-4 rounded-xl overflow-hidden">
          <video
            id="welcome-video"
            src={WELCOME_VIDEO_URL}
            className="w-full h-full object-contain"
            playsInline
            onEnded={handleVideoEnded}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            controls={isPlaying}
          />
          
          {/* Play overlay */}
          {!isPlaying && (
            <div 
              className="absolute inset-0 flex items-center justify-center bg-black/40 cursor-pointer transition-opacity hover:bg-black/30"
              onClick={handlePlay}
            >
              <div className="w-20 h-20 rounded-full bg-primary/90 flex items-center justify-center shadow-lg shadow-primary/30 transition-transform hover:scale-110">
                <Play className="w-8 h-8 text-white ml-1" fill="currentColor" />
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 pt-0 flex justify-center gap-3">
          <Button
            variant="outline"
            className="border-white/20 text-white/80 hover:bg-white/10"
            onClick={handleClose}
          >
            Skip for now
          </Button>
          <Button
            className="bg-primary hover:bg-primary/90"
            onClick={handleClose}
          >
            Get Started
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
