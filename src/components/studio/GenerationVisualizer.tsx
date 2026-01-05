import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Mic, Video, Layers, Sparkles, Film, Wand2 } from 'lucide-react';

interface GenerationVisualizerProps {
  step: 'idle' | 'voice' | 'video' | 'polling';
  percent: number;
  currentClip?: number;
  totalClips?: number;
}

export function GenerationVisualizer({ step, percent, currentClip, totalClips }: GenerationVisualizerProps) {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; delay: number }>>([]);
  const [waveformBars] = useState(() => Array.from({ length: 24 }, (_, i) => ({ id: i, height: 20 + Math.random() * 60 })));

  useEffect(() => {
    // Generate floating particles
    const newParticles = Array.from({ length: 12 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 2,
    }));
    setParticles(newParticles);
  }, [step]);

  return (
    <div className="relative w-full h-48 rounded-2xl bg-gradient-to-br from-primary/5 via-background to-accent/5 overflow-hidden border border-border/30">
      {/* Animated background gradient */}
      <div className="absolute inset-0 opacity-30">
        <div 
          className="absolute inset-0 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20"
          style={{ 
            backgroundSize: '200% 100%',
            animation: 'shimmer 2s linear infinite',
          }}
        />
      </div>

      {/* Floating particles */}
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute w-1.5 h-1.5 rounded-full bg-primary/40 animate-float"
          style={{
            left: `${particle.x}%`,
            bottom: '-10%',
            animationDelay: `${particle.delay}s`,
            animationDuration: `${3 + Math.random() * 2}s`,
          }}
        />
      ))}

      {/* Central visualization */}
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Voice Generation - Waveform Animation */}
        {step === 'voice' && (
          <div className="flex items-center gap-1 h-20">
            {waveformBars.map((bar, i) => (
              <div
                key={bar.id}
                className="w-1.5 bg-gradient-to-t from-primary to-primary/50 rounded-full transition-all"
                style={{
                  height: `${bar.height}%`,
                  animation: `waveform 0.8s ease-in-out infinite`,
                  animationDelay: `${i * 0.05}s`,
                }}
              />
            ))}
          </div>
        )}

        {/* Video Generation - Clip Grid Animation */}
        {step === 'video' && totalClips && (
          <div className="grid grid-cols-4 gap-2 p-4">
            {Array.from({ length: totalClips }).map((_, i) => {
              const isComplete = currentClip ? i < currentClip - 1 : false;
              const isActive = currentClip ? i === currentClip - 1 : false;
              const isPending = currentClip ? i >= currentClip : true;

              return (
                <div
                  key={i}
                  className={cn(
                    "relative w-12 h-8 rounded-lg overflow-hidden transition-all duration-500",
                    isComplete && "bg-primary shadow-lg shadow-primary/30",
                    isActive && "bg-gradient-to-br from-primary to-accent animate-pulse shadow-xl shadow-primary/40 scale-110",
                    isPending && "bg-muted/50 border border-border/50"
                  )}
                >
                  {isComplete && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Film className="w-4 h-4 text-primary-foreground" />
                    </div>
                  )}
                  {isActive && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-primary-foreground animate-spin-slow" />
                    </div>
                  )}
                  {isPending && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-3 h-3 rounded border border-border/50" />
                    </div>
                  )}
                  
                  {/* Shimmer effect for active clip */}
                  {isActive && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Polling/Rendering - Orbital Animation */}
        {step === 'polling' && (
          <div className="relative w-32 h-32">
            {/* Center icon */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-2xl shadow-primary/30">
                <Layers className="w-8 h-8 text-primary-foreground" />
              </div>
            </div>
            
            {/* Orbiting elements */}
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="absolute inset-0 animate-spin"
                style={{
                  animationDuration: `${3 + i}s`,
                  animationDirection: i % 2 === 0 ? 'normal' : 'reverse',
                }}
              >
                <div
                  className={cn(
                    "absolute w-3 h-3 rounded-full",
                    i === 0 && "top-0 left-1/2 -translate-x-1/2 bg-primary",
                    i === 1 && "bottom-0 left-1/2 -translate-x-1/2 bg-accent",
                    i === 2 && "left-0 top-1/2 -translate-y-1/2 bg-primary/70",
                  )}
                />
              </div>
            ))}
            
            {/* Pulsing rings */}
            <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" style={{ animationDuration: '2s' }} />
            <div className="absolute inset-2 rounded-full border border-accent/20 animate-ping" style={{ animationDuration: '2.5s' }} />
          </div>
        )}

        {/* Idle state */}
        {step === 'idle' && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-muted/50 flex items-center justify-center">
              <Wand2 className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Ready to generate</p>
          </div>
        )}
      </div>

      {/* Step indicator icons */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-6">
        <StepIcon icon={Mic} active={step === 'voice'} complete={step === 'video' || step === 'polling'} />
        <div className={cn("w-8 h-0.5 transition-all", step !== 'idle' && step !== 'voice' ? "bg-primary" : "bg-border")} />
        <StepIcon icon={Video} active={step === 'video'} complete={step === 'polling'} />
        <div className={cn("w-8 h-0.5 transition-all", step === 'polling' ? "bg-primary" : "bg-border")} />
        <StepIcon icon={Layers} active={step === 'polling'} complete={false} />
      </div>

      {/* Progress percentage overlay */}
      {step !== 'idle' && (
        <div className="absolute top-4 right-4 px-3 py-1.5 rounded-full bg-background/80 backdrop-blur border border-border/50">
          <span className="text-sm font-mono font-medium text-primary">{percent}%</span>
        </div>
      )}
    </div>
  );
}

function StepIcon({ icon: Icon, active, complete }: { icon: typeof Mic; active: boolean; complete: boolean }) {
  return (
    <div
      className={cn(
        "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300",
        complete && "bg-primary text-primary-foreground shadow-lg shadow-primary/25",
        active && "bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg shadow-primary/30 scale-110 animate-pulse",
        !active && !complete && "bg-muted text-muted-foreground"
      )}
    >
      <Icon className="w-5 h-5" />
    </div>
  );
}
