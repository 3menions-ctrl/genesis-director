import { useEffect, useState, useCallback, memo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Rocket, Compass, ArrowRight } from 'lucide-react';

interface WelcomeBackDialogProps {
  isOpen: boolean;
  onChoice: (choice: 'create' | 'explore') => void;
  userName?: string;
}

// Floating particle
const FloatingOrb = memo(function FloatingOrb({ delay, index }: { delay: number; index: number }) {
  const size = 4 + Math.random() * 6;
  const x = Math.random() * 100;
  const duration = 6 + Math.random() * 8;

  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        width: size,
        height: size,
        left: `${x}%`,
        bottom: -20,
        background: `radial-gradient(circle, hsl(var(--primary) / 0.6), hsl(var(--primary) / 0.1))`,
        boxShadow: `0 0 ${size * 2}px hsl(var(--primary) / 0.3)`,
      }}
      initial={{ y: 0, opacity: 0 }}
      animate={{
        y: [0, -window.innerHeight - 40],
        opacity: [0, 0.8, 0.6, 0],
      }}
      transition={{
        duration,
        delay: delay + index * 0.3,
        ease: 'easeOut',
        repeat: Infinity,
        repeatDelay: Math.random() * 2,
      }}
    />
  );
});

export const WelcomeBackDialog = memo(function WelcomeBackDialog({
  isOpen,
  onChoice,
  userName,
}: WelcomeBackDialogProps) {
  const [phase, setPhase] = useState<'entrance' | 'greeting' | 'choices' | 'exit'>('entrance');
  const isTransitioningRef = useRef(false);

  const handleChoice = useCallback(
    (choice: 'create' | 'explore') => {
      if (isTransitioningRef.current) return;
      isTransitioningRef.current = true;
      setPhase('exit');
      setTimeout(() => onChoice(choice), 500);
    },
    [onChoice],
  );

  useEffect(() => {
    if (isOpen) {
      isTransitioningRef.current = false;
      setPhase('entrance');

      const greetTimer = setTimeout(() => setPhase('greeting'), 300);
      const choiceTimer = setTimeout(() => setPhase('choices'), 1400);

      return () => {
        clearTimeout(greetTimer);
        clearTimeout(choiceTimer);
      };
    }
  }, [isOpen]);

  const displayName = userName || 'Creator';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Deep backdrop */}
          <motion.div
            className="absolute inset-0 bg-background"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.97 }}
            exit={{ opacity: 0 }}
          />

          {/* Radial glow */}
          <motion.div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 60% 50% at 50% 45%, hsl(var(--primary) / 0.08) 0%, transparent 70%)',
            }}
            animate={{ opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Floating orbs */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {Array.from({ length: 12 }).map((_, i) => (
              <FloatingOrb key={i} delay={0.2} index={i} />
            ))}
          </div>

          {/* Main content */}
          <motion.div
            className="relative z-10 flex flex-col items-center text-center px-6 max-w-lg w-full"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{
              scale: phase === 'exit' ? 0.95 : 1,
              opacity: phase === 'exit' ? 0 : 1,
            }}
            transition={{ type: 'spring', stiffness: 180, damping: 22 }}
          >
            {/* Hoppy avatar */}
            <motion.div
              className="relative mb-6"
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 160, damping: 14, delay: 0.15 }}
            >
              {/* Glow behind avatar */}
              <motion.div
                className="absolute -inset-3 rounded-full"
                style={{
                  background: 'radial-gradient(circle, hsl(var(--primary) / 0.3), transparent 70%)',
                }}
                animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              />
              <div className="relative w-20 h-20 rounded-full overflow-hidden ring-2 ring-primary/30 shadow-[0_0_30px_hsl(var(--primary)/0.2)]">
                <video
                  src="/hoppy-blink.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover scale-[1.3] object-top"
                />
              </div>
              <motion.div
                className="absolute -top-1 -right-1"
                animate={{ rotate: [0, 12, -12, 0], scale: [1, 1.15, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Sparkles
                  className="w-5 h-5 text-amber-400"
                  style={{ filter: 'drop-shadow(0 0 6px rgba(250, 204, 21, 0.7))' }}
                />
              </motion.div>
            </motion.div>

            {/* Greeting phase */}
            <AnimatePresence mode="wait">
              {(phase === 'greeting' || phase === 'choices') && (
                <motion.div
                  key="greeting"
                  initial={{ y: 24, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.5 }}
                  className="mb-2"
                >
                  {/* Speech bubble tag */}
                  <motion.div
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-4"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                  >
                    <span className="text-xs font-medium text-primary">Hoppy 🐰</span>
                  </motion.div>

                  <motion.h1
                    className="text-3xl sm:text-4xl md:text-5xl font-display font-bold text-foreground mb-3 leading-tight"
                    style={{ textShadow: '0 0 40px hsl(var(--primary) / 0.15)' }}
                  >
                    Welcome back, {displayName}!
                  </motion.h1>

                  <motion.p
                    className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-sm mx-auto"
                    initial={{ y: 16, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.25, duration: 0.45 }}
                  >
                    I missed you! Your studio is warmed up and ready to go. What shall we do today? 💜
                  </motion.p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Choice cards */}
            <AnimatePresence>
              {phase === 'choices' && (
                <motion.div
                  className="flex flex-col sm:flex-row gap-3 mt-6 w-full max-w-md"
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.5 }}
                >
                  {/* Create */}
                  <motion.button
                    onClick={() => handleChoice('create')}
                    className="group relative flex-1 flex flex-col items-center gap-3 p-6 rounded-2xl border border-primary/20 bg-primary/5 hover:bg-primary/10 hover:border-primary/40 transition-all duration-300 cursor-pointer"
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center group-hover:bg-primary/25 transition-colors">
                      <Rocket className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-base">Start Creating</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Jump into the studio
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-primary/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100" />
                  </motion.button>

                  {/* Explore */}
                  <motion.button
                    onClick={() => handleChoice('explore')}
                    className="group relative flex-1 flex flex-col items-center gap-3 p-6 rounded-2xl border border-border/60 bg-card/40 hover:bg-card/70 hover:border-border transition-all duration-300 cursor-pointer"
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center group-hover:bg-muted transition-colors">
                      <Compass className="w-6 h-6 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-base">Explore</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Discover the community
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-foreground group-hover:translate-x-0.5 transition-all absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100" />
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Subtle hint */}
            <AnimatePresence>
              {phase === 'choices' && (
                <motion.p
                  className="text-[11px] text-muted-foreground/40 mt-5"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  Powered by Hoppy AI · Your personal creative companion
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Noise overlay */}
          <div
            className="absolute inset-0 opacity-[0.015] pointer-events-none mix-blend-overlay"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
});
