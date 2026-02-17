/**
 * WelcomeVideoModal - Shows studio storytelling journey video to new users
 * 
 * Displays on first login after onboarding is complete, tracks view state in profile
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Play, Sparkles, ArrowRight, Volume2, VolumeX } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/ui/Logo';

// The Studio Storytelling Journey video URL
const WELCOME_VIDEO_URL = 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/avatar-videos/fc34967d-0fcc-4863-829e-29d2dee5e514/avatar_fc34967d-0fcc-4863-829e-29d2dee5e514_clip1_lipsync_1770421330974.mp4';

export function WelcomeVideoModal() {
  const { user, profile, refreshProfile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasMarkedSeen, setHasMarkedSeen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Mark the video as seen in the database
  const markVideoAsSeen = useCallback(async () => {
    if (!user || hasMarkedSeen) return;
    
    setHasMarkedSeen(true);
    
    try {
      await supabase
        .from('profiles')
        .update({ has_seen_welcome_video: true })
        .eq('id', user.id);
      
      await refreshProfile();
    } catch (err) {
      console.error('[WelcomeVideoModal] Failed to mark video as seen:', err);
    }
  }, [user, hasMarkedSeen, refreshProfile]);

  // Check if we should show the modal — only for genuinely new signups
  useEffect(() => {
    if (
      user && 
      profile && 
      profile.onboarding_completed && 
      profile.has_seen_welcome_video === false
    ) {
      // Only show if the account was created within the last 2 hours (new signup)
      const createdAt = new Date(user.created_at);
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      if (createdAt < twoHoursAgo) {
        // Existing user — silently mark as seen without showing
        markVideoAsSeen();
        return;
      }

      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [user, profile, markVideoAsSeen]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    markVideoAsSeen();
  }, [markVideoAsSeen]);

  const handleVideoEnded = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    videoRef.current?.play().catch(console.error);
  }, []);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      const pct = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(isNaN(pct) ? 0 : pct);
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  // Don't render if conditions aren't met
  if (!user || !profile || !profile.onboarding_completed || profile.has_seen_welcome_video !== false) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent 
        className="!fixed !left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2 !transform max-w-4xl w-[94vw] p-0 border-0 overflow-hidden bg-transparent shadow-none"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        {/* Outer glow */}
        <div className="absolute -inset-px rounded-3xl bg-gradient-to-b from-white/[0.15] to-white/[0.03] p-px">
          <div className="w-full h-full rounded-3xl bg-[hsl(240,10%,5%)]/95 backdrop-blur-2xl" />
        </div>

        <div className="relative">
          {/* Ambient glows */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
            <div className="absolute -top-20 -left-20 w-60 h-60 rounded-full bg-primary/15 blur-[100px]" />
            <div className="absolute -bottom-20 -right-20 w-60 h-60 rounded-full bg-accent/10 blur-[100px]" />
          </div>

          {/* Close button */}
          <button
            className="absolute top-4 right-4 z-50 w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.1] transition-all duration-300"
            onClick={handleClose}
          >
            <X className="h-4 w-4" />
          </button>

          {/* Header */}
          <div className="relative p-8 pb-5 text-center">
            <div className="flex justify-center mb-5">
              <Logo size="lg" />
            </div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-5">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-medium text-primary tracking-wide">Welcome to the Studio</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-white mb-3 tracking-tight">
              Your Storytelling Journey
              <span className="block bg-gradient-to-r from-white/60 to-white/30 bg-clip-text text-transparent">
                Begins Now
              </span>
            </h2>
            <p className="text-white/40 text-sm max-w-lg mx-auto leading-relaxed">
              Discover how to bring your stories to life with AI-powered cinema creation.
            </p>
          </div>

          {/* Video container */}
          <div className="relative mx-5 mb-2 rounded-2xl overflow-hidden group">
            {/* Video border glow */}
            <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-white/[0.10] to-white/[0.03] p-px pointer-events-none z-10">
              <div className="w-full h-full rounded-2xl bg-transparent" />
            </div>

            <div className="relative aspect-video bg-[hsl(240,10%,3%)] rounded-2xl overflow-hidden">
              <video
                ref={videoRef}
                src={WELCOME_VIDEO_URL}
                className="w-full h-full object-contain"
                playsInline
                onEnded={handleVideoEnded}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={handleTimeUpdate}
                controls={isPlaying}
              />
              
              {/* Play overlay */}
              {!isPlaying && (
                <div 
                  className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer transition-all duration-500 bg-gradient-to-t from-black/60 via-black/20 to-black/40"
                  onClick={handlePlay}
                >
                  {/* Ripple rings */}
                  <div className="relative">
                    <div className="absolute inset-0 w-24 h-24 -m-2 rounded-full bg-white/5 animate-[pulse_2s_ease-in-out_infinite]" />
                    <div className="absolute inset-0 w-20 h-20 rounded-full bg-white/5 animate-[pulse_2s_ease-in-out_0.5s_infinite]" />
                    <button className="relative w-20 h-20 rounded-2xl bg-white/15 backdrop-blur-xl border border-white/25 flex items-center justify-center shadow-2xl shadow-black/50 hover:scale-110 hover:bg-white/25 transition-all duration-300">
                      <Play className="w-8 h-8 text-white ml-1" fill="currentColor" />
                    </button>
                  </div>
                  <p className="mt-5 text-sm text-white/60 font-medium tracking-wide">Tap to play</p>
                </div>
              )}
            </div>

            {/* Custom progress bar */}
            {isPlaying && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/[0.06] z-20">
                <div 
                  className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-[width] duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>

          {/* Mute toggle (when playing) */}
          {isPlaying && (
            <div className="flex justify-end px-6 py-1">
              <button
                onClick={toggleMute}
                className="flex items-center gap-1.5 text-[11px] text-white/30 hover:text-white/60 transition-colors"
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                {isMuted ? 'Unmute' : 'Mute'}
              </button>
            </div>
          )}

          {/* Footer actions */}
          <div className="relative p-6 pt-4 flex items-center justify-center gap-3">
            <Button
              variant="ghost"
              className="h-11 px-6 text-white/40 hover:text-white hover:bg-white/[0.05] rounded-xl text-sm"
              onClick={handleClose}
            >
              Skip for now
            </Button>
            <Button
              className="h-11 px-7 bg-white text-black hover:bg-white/90 rounded-xl font-semibold text-sm gap-2 shadow-lg shadow-white/5 hover:scale-[1.02] active:scale-[0.98] transition-all"
              onClick={handleClose}
            >
              <Sparkles className="w-4 h-4" />
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
