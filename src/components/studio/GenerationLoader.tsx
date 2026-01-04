import { Sparkles, Film, Mic, Video, Layers, Zap, Stars, Wand2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';

interface GenerationLoaderProps {
  step: 'idle' | 'voice' | 'video' | 'polling';
  percent: number;
  estimatedSecondsRemaining: number | null;
  currentClip?: number;
  totalClips?: number;
  onCancel?: () => void;
}

const PRODUCTION_FACTS = [
  { icon: '🎬', text: 'Hollywood blockbusters take 18+ months to produce. We do it in minutes.' },
  { icon: '🧠', text: 'Our AI processes billions of visual patterns to create your scenes.' },
  { icon: '🎭', text: 'Each character voice is unique, never to be replicated exactly again.' },
  { icon: '✨', text: 'Every frame is individually crafted with cinematic precision.' },
  { icon: '🚀', text: "You're using the same tech that's reshaping Hollywood." },
  { icon: '🎥', text: 'AI analyzes thousands of films to understand perfect composition.' },
  { icon: '🌟', text: 'Your video is being rendered in stunning 4K resolution.' },
  { icon: '🎨', text: 'Color grading is applied automatically for cinematic feel.' },
];

const STEP_CONFIG = {
  idle: { icon: Sparkles, label: 'Preparing', color: 'from-primary to-accent' },
  voice: { icon: Mic, label: 'Generating Voice', color: 'from-violet-500 to-purple-600' },
  video: { icon: Video, label: 'Creating Visuals', color: 'from-primary to-pink-500' },
  polling: { icon: Layers, label: 'Rendering Video', color: 'from-accent to-primary' },
};

// Floating particle component
const Particle = ({ delay, size, x, y }: { delay: number; size: number; x: number; y: number }) => (
  <div
    className="absolute rounded-full bg-gradient-to-br from-primary/40 to-accent/40 animate-particle-float"
    style={{
      width: size,
      height: size,
      left: `${x}%`,
      top: `${y}%`,
      animationDelay: `${delay}s`,
      animationDuration: `${3 + Math.random() * 2}s`,
    }}
  />
);

// Audio wave visualization
const AudioWave = ({ isActive }: { isActive: boolean }) => (
  <div className="flex items-center gap-1 h-12">
    {[...Array(12)].map((_, i) => (
      <div
        key={i}
        className={cn(
          "w-1 rounded-full bg-gradient-to-t from-primary to-accent transition-all",
          isActive ? "animate-wave" : "h-2"
        )}
        style={{
          animationDelay: `${i * 0.08}s`,
          height: isActive ? `${20 + Math.random() * 30}px` : '8px',
        }}
      />
    ))}
  </div>
);

// Orbiting element
const OrbitingElement = ({ 
  icon: Icon, 
  radius, 
  duration, 
  reverse = false,
  color 
}: { 
  icon: typeof Sparkles; 
  radius: number; 
  duration: number; 
  reverse?: boolean;
  color: string;
}) => (
  <div 
    className={cn("absolute inset-0 flex items-center justify-center", reverse ? "animate-spin-slow" : "")}
    style={{ 
      animation: `${reverse ? 'spin-slow' : 'spin-slow'} ${duration}s linear infinite`,
      animationDirection: reverse ? 'reverse' : 'normal'
    }}
  >
    <div 
      className={cn("w-8 h-8 rounded-lg flex items-center justify-center shadow-lg", color)}
      style={{ transform: `translateX(${radius}px)` }}
    >
      <Icon className="w-4 h-4 text-white" />
    </div>
  </div>
);

export function GenerationLoader({ 
  step, 
  percent, 
  estimatedSecondsRemaining, 
  currentClip, 
  totalClips,
  onCancel
}: GenerationLoaderProps) {
  const [factIndex, setFactIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Generate stable particles on mount
  const particles = useMemo(() => 
    [...Array(30)].map((_, i) => ({
      id: i,
      delay: Math.random() * 4,
      size: 2 + Math.random() * 4,
      x: Math.random() * 100,
      y: Math.random() * 100,
    })), []
  );

  // Cycle through facts with fade transition
  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setFactIndex(i => (i + 1) % PRODUCTION_FACTS.length);
        setIsTransitioning(false);
      }, 300);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const config = STEP_CONFIG[step];
  const StepIcon = config.icon;

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Animated gradient background */}
      <div 
        className="absolute inset-0 animate-gradient-shift"
        style={{
          background: 'linear-gradient(135deg, hsl(262 35% 8%) 0%, hsl(280 40% 6%) 25%, hsl(262 45% 10%) 50%, hsl(250 35% 8%) 75%, hsl(262 35% 8%) 100%)',
          backgroundSize: '400% 400%',
        }}
      />

      {/* Mesh gradient overlay */}
      <div 
        className="absolute inset-0 opacity-50"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 20% 40%, hsl(262 83% 58% / 0.15) 0%, transparent 50%),
            radial-gradient(ellipse 60% 40% at 80% 60%, hsl(280 70% 50% / 0.1) 0%, transparent 50%),
            radial-gradient(ellipse 50% 30% at 50% 80%, hsl(262 83% 58% / 0.08) 0%, transparent 50%)
          `,
        }}
      />

      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none">
        {particles.map(p => (
          <Particle key={p.id} {...p} />
        ))}
      </div>

      {/* Radial glow behind center */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full animate-glow-pulse"
        style={{
          background: 'radial-gradient(circle, hsl(262 83% 58% / 0.2) 0%, transparent 70%)',
        }}
      />

      {/* Main content */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center px-8">
        
        {/* Orbital animation system */}
        <div className="relative w-48 h-48 md:w-56 md:h-56 mb-8">
          {/* Outer ring with gradient */}
          <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-spin-slow" style={{ animationDuration: '30s' }} />
          
          {/* Middle pulsing ring */}
          <div className="absolute inset-4 rounded-full border border-accent/30">
            <div className="absolute inset-0 rounded-full border border-accent/20 animate-ripple" />
          </div>
          
          {/* Inner spinning ring */}
          <div className="absolute inset-8 rounded-full border-2 border-dashed border-primary/30 animate-spin-slow" style={{ animationDuration: '15s', animationDirection: 'reverse' }} />

          {/* Orbiting icons */}
          <OrbitingElement icon={Film} radius={90} duration={12} color="bg-gradient-to-br from-violet-500 to-purple-600" />
          <OrbitingElement icon={Wand2} radius={70} duration={8} reverse color="bg-gradient-to-br from-primary to-accent" />
          <OrbitingElement icon={Stars} radius={50} duration={10} color="bg-gradient-to-br from-pink-500 to-rose-500" />

          {/* Center icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={cn(
              "w-20 h-20 md:w-24 md:h-24 rounded-2xl flex items-center justify-center shadow-2xl animate-bounce-subtle",
              "bg-gradient-to-br",
              config.color
            )}>
              <StepIcon className="w-10 h-10 md:w-12 md:h-12 text-white" />
            </div>
          </div>
        </div>

        {/* Audio wave visualization for voice step */}
        {step === 'voice' && (
          <div className="mb-6">
            <AudioWave isActive={true} />
          </div>
        )}

        {/* Step info */}
        <div className="text-center space-y-3 mb-8">
          <h3 className="text-2xl md:text-3xl font-display font-bold text-white animate-text-shimmer bg-gradient-to-r from-white via-primary-foreground to-white bg-clip-text">
            {config.label}
          </h3>
          {currentClip && totalClips && (
            <div className="flex items-center justify-center gap-3">
              <div className="flex gap-1">
                {[...Array(totalClips)].map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-2 h-2 rounded-full transition-all duration-500",
                      i < currentClip 
                        ? "bg-emerald-400 shadow-[0_0_8px_hsl(142_71%_45%/0.5)]" 
                        : i === currentClip - 1 
                          ? "bg-primary animate-pulse shadow-[0_0_8px_hsl(262_83%_58%/0.5)]" 
                          : "bg-white/20"
                    )}
                  />
                ))}
              </div>
              <span className="text-white/70 text-sm font-medium">
                Clip {currentClip} of {totalClips}
              </span>
            </div>
          )}
        </div>

        {/* Progress section */}
        <div className="w-full max-w-md space-y-4">
          {/* Progress bar with glow */}
          <div className="relative">
            <div className="h-3 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm border border-white/5">
              <div 
                className={cn(
                  "h-full rounded-full transition-all duration-700 animate-progress-glow",
                  "bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_100%] animate-shimmer"
                )}
                style={{ width: `${percent}%` }}
              />
            </div>
            {/* Progress glow effect */}
            <div 
              className="absolute top-0 h-3 rounded-full blur-sm bg-primary/50 transition-all duration-700"
              style={{ width: `${percent}%` }}
            />
          </div>

          {/* Stats row */}
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary animate-pulse" />
              <span className="font-mono text-white font-medium">{percent}%</span>
            </div>
            <span className="text-white/50 font-mono">
              {estimatedSecondsRemaining !== null 
                ? estimatedSecondsRemaining > 60 
                  ? `~${Math.ceil(estimatedSecondsRemaining / 60)} min remaining`
                  : `~${Math.ceil(estimatedSecondsRemaining)}s remaining`
                : 'Calculating...'}
            </span>
          </div>
        </div>

        {/* Fun fact card */}
        <div className={cn(
          "mt-10 max-w-lg mx-auto p-5 rounded-2xl transition-all duration-300",
          "bg-white/5 backdrop-blur-md border border-white/10",
          isTransitioning ? "opacity-0 transform translate-y-2" : "opacity-100 transform translate-y-0"
        )}>
          <div className="flex items-start gap-4">
            <span className="text-3xl">{PRODUCTION_FACTS[factIndex].icon}</span>
            <div className="space-y-1">
              <p className="text-sm text-white/60 uppercase tracking-wider font-medium">Did you know?</p>
              <p className="text-white/90 leading-relaxed">
                {PRODUCTION_FACTS[factIndex].text}
              </p>
            </div>
          </div>
        </div>

        {/* Cancel button */}
        {onCancel && (
          <div className="mt-8">
            <Button 
              variant="ghost" 
              onClick={onCancel}
              className="text-white/60 hover:text-white hover:bg-white/10 gap-2"
            >
              <X className="w-4 h-4" />
              Cancel Generation
            </Button>
          </div>
        )}

        {/* Bottom decorative elements */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce-subtle"
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}