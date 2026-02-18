/**
 * Holographic Bubbles Progress Animation
 * 
 * Iridescent soap bubbles with prismatic reflections that float and pop
 * as pipeline stages progress. Each bubble carries a stage update text.
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BubbleMessage {
  id: string;
  text: string;
  emoji: string;
  size: 'sm' | 'md' | 'lg';
  x: number; // % from left
  delay: number;
  popped: boolean;
  color: [string, string, string]; // prismatic hue triplet (HSL)
}

interface HolographicBubblesProgressProps {
  currentStage: string;
  progress: number;
  completedClips: number;
  clipCount: number;
  elapsedTime: number;
  statusText: string;
  isRunning: boolean;
}

const STAGE_CONFIGS: Record<string, { emoji: string; text: string; color: [string, string, string] }> = {
  preproduction:   { emoji: '🎬', text: 'Preparing production',    color: ['263 70% 65%', '195 90% 55%', '280 60% 70%'] },
  awaiting_approval:{ emoji: '📋', text: 'Script ready',           color: ['48 100% 60%', '35 100% 55%', '55 90% 65%'] },
  qualitygate:     { emoji: '🔍', text: 'Quality check',           color: ['195 90% 55%', '220 80% 60%', '170 70% 50%'] },
  assets:          { emoji: '🎨', text: 'Creating assets',         color: ['300 70% 65%', '280 60% 70%', '320 80% 60%'] },
  production:      { emoji: '🎥', text: 'Rendering clips',         color: ['263 70% 65%', '280 60% 70%', '240 80% 65%'] },
  postproduction:  { emoji: '✨', text: 'Finalizing video',         color: ['48 100% 60%', '263 70% 65%', '195 90% 55%'] },
  complete:        { emoji: '✅', text: 'Complete!',                color: ['160 84% 45%', '140 70% 50%', '180 80% 50%'] },
  error:           { emoji: '❌', text: 'Error occurred',           color: ['0 84% 60%', '15 90% 55%', '350 80% 60%'] },
};

const generateId = () => Math.random().toString(36).slice(2);

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

// Prismatic shimmer colors for bubbles
const PRISM_COLORS = [
  ['263 70% 65%', '195 90% 55%', '280 60% 70%'],
  ['195 90% 55%', '160 84% 45%', '220 80% 60%'],
  ['300 70% 65%', '263 70% 65%', '320 80% 60%'],
  ['48 100% 60%', '35 100% 55%', '263 70% 65%'],
] as [string, string, string][];

export function HolographicBubblesProgress({
  currentStage,
  progress,
  completedClips,
  clipCount,
  elapsedTime,
  statusText,
  isRunning,
}: HolographicBubblesProgressProps) {
  const [bubbles, setBubbles] = useState<BubbleMessage[]>([]);
  const [poppingIds, setPoppingIds] = useState<Set<string>>(new Set());
  const [ambientBubbles, setAmbientBubbles] = useState<{ id: string; x: number; size: number; delay: number; duration: number; color: string }[]>([]);
  const prevStageRef = useRef<string>('');
  const popTimerRef = useRef<NodeJS.Timeout[]>([]);

  // Generate ambient background micro-bubbles
  useEffect(() => {
    if (!isRunning) return;
    const ambient = Array.from({ length: 12 }, (_, i) => ({
      id: `ambient-${i}`,
      x: Math.random() * 100,
      size: 4 + Math.random() * 12,
      delay: Math.random() * 4,
      duration: 5 + Math.random() * 8,
      color: `hsl(${200 + Math.random() * 120} 80% 70%)`,
    }));
    setAmbientBubbles(ambient);
  }, [isRunning]);

  // Pop old bubbles and spawn new one on stage change
  useEffect(() => {
    if (!isRunning || !currentStage || currentStage === 'idle') return;
    if (prevStageRef.current === currentStage) return;

    prevStageRef.current = currentStage;
    const stageConf = STAGE_CONFIGS[currentStage];

    // Pop all existing bubbles sequentially
    setBubbles(prev => {
      const ids = prev.map(b => b.id);
      if (ids.length > 0) {
        setPoppingIds(new Set(ids));
        const timer = setTimeout(() => {
          setBubbles([]);
          setPoppingIds(new Set());
        }, 600);
        popTimerRef.current.push(timer);
      }
      return prev;
    });

    // Spawn new stage bubble with a delay
    const spawnTimer = setTimeout(() => {
      const sizes: BubbleMessage['size'][] = ['sm', 'md', 'lg'];
      const colorSet = stageConf?.color ?? PRISM_COLORS[Math.floor(Math.random() * PRISM_COLORS.length)];

      const newBubble: BubbleMessage = {
        id: generateId(),
        text: stageConf?.text ?? statusText,
        emoji: stageConf?.emoji ?? '⚡',
        size: 'lg',
        x: 35 + Math.random() * 30,
        delay: 0,
        popped: false,
        color: colorSet,
      };

      // Spawn 2-3 smaller satellite bubbles
      const satellites: BubbleMessage[] = Array.from({ length: 2 }, (_, i) => ({
        id: generateId(),
        text: i === 0 ? `${Math.round(progress)}%` : formatTime(elapsedTime),
        emoji: i === 0 ? '📊' : '⏱',
        size: sizes[i] as BubbleMessage['size'],
        x: 15 + Math.random() * 70,
        delay: 0.2 + i * 0.15,
        popped: false,
        color: PRISM_COLORS[i % PRISM_COLORS.length],
      }));

      setBubbles([newBubble, ...satellites]);
    }, 700);

    popTimerRef.current.push(spawnTimer);

    return () => {
      popTimerRef.current.forEach(t => clearTimeout(t));
      popTimerRef.current = [];
    };
  }, [currentStage, isRunning]);

  // Update satellite bubbles content live
  useEffect(() => {
    setBubbles(prev => prev.map((b, i) => {
      if (i === 1) return { ...b, text: `${Math.round(progress)}%` };
      if (i === 2) return { ...b, text: formatTime(elapsedTime) };
      return b;
    }));
  }, [progress, elapsedTime]);

  const sizeMap = { sm: 64, md: 80, lg: 110 };

  return (
    <div className="relative w-full overflow-hidden" style={{ height: 160 }}>
      {/* Ambient background micro-bubbles */}
      {isRunning && ambientBubbles.map(ab => (
        <motion.div
          key={ab.id}
          className="absolute rounded-full pointer-events-none"
          style={{
            width: ab.size,
            height: ab.size,
            left: `${ab.x}%`,
            bottom: 0,
            background: `radial-gradient(circle at 35% 35%, ${ab.color}44, transparent 70%)`,
            border: `1px solid ${ab.color}33`,
          }}
          animate={{
            y: [-0, -200],
            opacity: [0, 0.6, 0.4, 0],
            scale: [0.6, 1, 0.9, 0.7],
          }}
          transition={{
            duration: ab.duration,
            delay: ab.delay,
            repeat: Infinity,
            ease: 'easeOut',
          }}
        />
      ))}

      {/* Main stage bubbles */}
      <AnimatePresence>
        {bubbles.map((bubble, idx) => {
          const size = sizeMap[bubble.size];
          const isPopping = poppingIds.has(bubble.id);
          const isMain = idx === 0;
          const [c1, c2, c3] = bubble.color;

          return (
            <motion.div
              key={bubble.id}
              className="absolute flex items-center justify-center cursor-default"
              style={{
                width: size,
                height: size,
                left: `${bubble.x}%`,
                bottom: isMain ? 16 : 8 + idx * 10,
                marginLeft: -size / 2,
              }}
              initial={{ scale: 0, opacity: 0, y: 40 }}
              animate={isPopping ? {
                scale: [1, 1.3, 0],
                opacity: [1, 0.8, 0],
              } : {
                scale: [0, 1.08, 0.97, 1],
                opacity: 1,
                y: [20, 0],
              }}
              exit={{ scale: 0, opacity: 0 }}
              transition={isPopping ? {
                duration: 0.5,
                ease: 'easeOut',
              } : {
                duration: 0.6,
                delay: bubble.delay,
                ease: [0.34, 1.56, 0.64, 1],
              }}
            >
              {/* Pop particle burst */}
              {isPopping && (
                <>
                  {Array.from({ length: 8 }).map((_, pi) => (
                    <motion.div
                      key={pi}
                      className="absolute w-1.5 h-1.5 rounded-full"
                      style={{
                        background: `hsl(${c1})`,
                        boxShadow: `0 0 6px hsl(${c1} / 0.8)`,
                      }}
                      initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                      animate={{
                        x: Math.cos((pi / 8) * Math.PI * 2) * (size / 1.5),
                        y: Math.sin((pi / 8) * Math.PI * 2) * (size / 1.5),
                        opacity: 0,
                        scale: 0,
                      }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  ))}
                </>
              )}

              {/* Bubble body */}
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: `
                    radial-gradient(ellipse at 30% 30%, hsl(${c1} / 0.35) 0%, transparent 60%),
                    radial-gradient(ellipse at 70% 70%, hsl(${c2} / 0.2) 0%, transparent 50%),
                    radial-gradient(ellipse at 50% 50%, hsl(${c3} / 0.1) 0%, transparent 80%)
                  `,
                  border: `1.5px solid hsl(${c1} / 0.5)`,
                  boxShadow: `
                    0 0 ${size * 0.3}px hsl(${c1} / 0.2),
                    0 0 ${size * 0.6}px hsl(${c2} / 0.1),
                    inset 0 0 ${size * 0.2}px hsl(${c1} / 0.15)
                  `,
                  backdropFilter: 'blur(8px)',
                }}
              />

              {/* Prismatic shimmer layer - rotating gradient */}
              <motion.div
                className="absolute inset-0 rounded-full overflow-hidden"
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                style={{ opacity: 0.5 }}
              >
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: `conic-gradient(
                      from 0deg,
                      hsl(${c1} / 0.3),
                      hsl(${c2} / 0.2),
                      hsl(${c3} / 0.3),
                      transparent,
                      hsl(${c1} / 0.2)
                    )`,
                  }}
                />
              </motion.div>

              {/* Highlight glare */}
              <div
                className="absolute rounded-full"
                style={{
                  width: size * 0.35,
                  height: size * 0.2,
                  top: '18%',
                  left: '22%',
                  background: 'radial-gradient(ellipse, rgba(255,255,255,0.7) 0%, transparent 70%)',
                  filter: 'blur(1px)',
                  transform: 'rotate(-30deg)',
                }}
              />

              {/* Secondary tiny glare */}
              <div
                className="absolute rounded-full"
                style={{
                  width: size * 0.1,
                  height: size * 0.1,
                  bottom: '25%',
                  right: '22%',
                  background: 'radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 70%)',
                }}
              />

              {/* Bubble pulse ring */}
              {isMain && !isPopping && (
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{
                    border: `1px solid hsl(${c1} / 0.4)`,
                  }}
                  animate={{
                    scale: [1, 1.5],
                    opacity: [0.5, 0],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeOut',
                  }}
                />
              )}

              {/* Content inside bubble */}
              <div className="relative z-10 flex flex-col items-center justify-center text-center px-2">
                {isMain ? (
                  <>
                    <motion.span
                      className="text-xl mb-0.5"
                      animate={{ scale: [1, 1.15, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      {bubble.emoji}
                    </motion.span>
                    <span
                      className="text-[9px] font-semibold leading-tight"
                      style={{
                        color: `hsl(${c1})`,
                        textShadow: `0 0 8px hsl(${c1} / 0.6)`,
                        maxWidth: size - 20,
                      }}
                    >
                      {bubble.text}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-sm">{bubble.emoji}</span>
                    <span
                      className="text-[8px] font-bold tabular-nums"
                      style={{
                        color: `hsl(${c1})`,
                        textShadow: `0 0 6px hsl(${c1} / 0.6)`,
                      }}
                    >
                      {bubble.text}
                    </span>
                  </>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Production clip count floating label */}
      {currentStage === 'production' && clipCount > 0 && (
        <motion.div
          className="absolute bottom-2 right-4 flex items-center gap-1.5"
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex gap-1">
            {Array.from({ length: Math.min(clipCount, 8) }).map((_, i) => (
              <motion.div
                key={i}
                className="rounded-sm"
                style={{
                  width: 6,
                  height: i < completedClips ? 18 : 10,
                  background: i < completedClips
                    ? `hsl(160 84% 45%)`
                    : `hsl(263 70% 65% / 0.3)`,
                  boxShadow: i < completedClips ? '0 0 6px hsl(160 84% 45% / 0.5)' : 'none',
                  transition: 'all 0.5s ease',
                }}
                animate={i < completedClips ? {
                  scaleY: [1, 1.2, 1],
                } : {}}
                transition={{ duration: 0.3, delay: i * 0.05 }}
              />
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground font-medium">
            {completedClips}/{clipCount}
          </span>
        </motion.div>
      )}
    </div>
  );
}
