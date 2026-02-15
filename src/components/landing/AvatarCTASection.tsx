import { memo, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Sparkles, Volume2, VolumeX } from 'lucide-react';

// Pre-generated avatar video for CTA cameo
const AVATAR_CTA_VIDEO = 'https://ahlikyhgcqvrdvbtkghh.supabase.co/storage/v1/object/public/video-clips/avatar-videos/fc34967d-0fcc-4863-829e-29d2dee5e514/avatar_fc34967d-0fcc-4863-829e-29d2dee5e514_clip1_lipsync_1770421330974.mp4';

// Subtitle text matching the avatar speech
const SUBTITLE_TEXT = "You've scrolled this far — clearly you're curious. Why not see what you can create?";

interface AvatarCTASectionProps {
  onNavigate: (path: string) => void;
}

export const AvatarCTASection = memo(function AvatarCTASection({ onNavigate }: AvatarCTASectionProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showSubtitle, setShowSubtitle] = useState(false);

  const handlePlayToggle = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      setIsPlaying(true);
      setShowSubtitle(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  const handleMuteToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setMuted((prev) => !prev);
  }, []);

  return (
    <section className="relative z-10 py-32 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16"
        >
          {/* Avatar Video */}
          <div className="relative shrink-0 w-64 h-64 lg:w-72 lg:h-72">
            {/* Glow ring */}
            <div className="absolute -inset-3 rounded-full bg-gradient-to-br from-primary/20 via-violet-500/10 to-cyan-500/10 blur-xl animate-pulse" style={{ animationDuration: '3s' }} />
            
            <div 
              className="relative w-full h-full rounded-full overflow-hidden border-2 border-white/10 cursor-pointer group"
              onClick={handlePlayToggle}
            >
              <video
                ref={videoRef}
                src={AVATAR_CTA_VIDEO}
                muted={muted}
                playsInline
                preload="none"
                loop
                onPlay={() => { setIsPlaying(true); setShowSubtitle(true); }}
                onPause={() => setIsPlaying(false)}
                className="w-full h-full object-cover scale-[1.15]"
              />

              {/* Play overlay */}
              {!isPlaying && (
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/20 transition-colors">
                  <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20">
                    <svg className="w-6 h-6 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              )}

              {/* Mute toggle */}
              {isPlaying && (
                <button
                  onClick={handleMuteToggle}
                  className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white transition-colors z-10"
                >
                  {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
              )}
            </div>

            {/* Subtitle bubble */}
            {showSubtitle && (
              <motion.div
                initial={{ opacity: 0, y: 5, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-64 text-center"
              >
                <p className="text-xs text-white/50 italic leading-relaxed bg-black/40 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/[0.06]">
                  "{SUBTITLE_TEXT}"
                </p>
              </motion.div>
            )}
          </div>

          {/* CTA content */}
          <div className="text-center lg:text-left flex-1 mt-8 lg:mt-0">
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-4">
              Ready to create?
            </h2>
            <p className="text-lg text-white/40 mb-8 max-w-md">
              Join thousands of creators making videos with AI.
              Credit packs start at just $9.
            </p>
            <Button
              onClick={() => onNavigate('/auth?mode=signup')}
              size="lg"
              className="h-14 px-10 text-base font-medium rounded-full bg-white text-black hover:bg-white/90"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Get Started Free
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
});
