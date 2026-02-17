/**
 * Hoppy Agent Face — Immersive Animated Avatar 🐰
 * 
 * State-reactive visual effects around Hoppy's video face:
 * - Orbital rings that change speed/color by state
 * - Glowing aura pulse  
 * - Particle sparkles when speaking
 */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AgentFaceProps {
  state: "idle" | "thinking" | "speaking" | "listening";
  className?: string;
  size?: number;
}

const stateConfig = {
  idle: {
    auraColor: "hsl(280 60% 50% / 0.15)",
    ringSpeed: 20,
    pulseScale: 1.02,
  },
  thinking: {
    auraColor: "hsl(45 90% 55% / 0.2)",
    ringSpeed: 8,
    pulseScale: 1.04,
  },
  speaking: {
    auraColor: "hsl(280 70% 60% / 0.25)",
    ringSpeed: 12,
    pulseScale: 1.06,
  },
  listening: {
    auraColor: "hsl(190 80% 50% / 0.2)",
    ringSpeed: 15,
    pulseScale: 1.03,
  },
};

export function AgentFace({ state, className, size = 160 }: AgentFaceProps) {
  const config = stateConfig[state];
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; delay: number }>>([]);

  // Generate particles when speaking
  useEffect(() => {
    if (state === "speaking") {
      const newParticles = Array.from({ length: 6 }, (_, i) => ({
        id: Date.now() + i,
        x: Math.random() * 360,
        y: Math.random() * 100,
        delay: Math.random() * 0.5,
      }));
      setParticles(newParticles);
    } else {
      setParticles([]);
    }
  }, [state]);

  return (
    <div
      className={cn("relative flex items-center justify-center", className)}
      style={{ width: size + 40, height: size + 40 }}
    >
      {/* Outer glow aura */}
      <motion.div
        className="absolute rounded-full"
        animate={{
          scale: [1, config.pulseScale, 1],
          opacity: [0.4, 0.7, 0.4],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        style={{
          width: size + 32,
          height: size + 32,
          background: `radial-gradient(circle, ${config.auraColor} 0%, transparent 70%)`,
        }}
      />

      {/* Orbital ring 1 */}
      <motion.div
        className="absolute rounded-full border pointer-events-none"
        animate={{ rotate: 360 }}
        transition={{ duration: config.ringSpeed, repeat: Infinity, ease: "linear" }}
        style={{
          width: size + 24,
          height: size + 24,
          borderColor: state === "thinking"
            ? "hsl(45 80% 60% / 0.25)"
            : "hsl(280 50% 60% / 0.15)",
          borderStyle: "dashed",
        }}
      />

      {/* Orbital ring 2 (counter-rotate) */}
      <motion.div
        className="absolute rounded-full border pointer-events-none"
        animate={{ rotate: -360 }}
        transition={{ duration: config.ringSpeed * 1.6, repeat: Infinity, ease: "linear" }}
        style={{
          width: size + 36,
          height: size + 36,
          borderColor: "hsl(280 40% 50% / 0.08)",
          borderWidth: "1px",
        }}
      />

      {/* Speaking particles */}
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute w-1.5 h-1.5 rounded-full"
          initial={{
            opacity: 0,
            scale: 0,
            rotate: p.x,
            x: 0,
            y: 0,
          }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0, 1, 0.5],
            x: [0, Math.cos(p.x * Math.PI / 180) * (size / 2 + 20)],
            y: [0, Math.sin(p.x * Math.PI / 180) * (size / 2 + 20)],
          }}
          transition={{
            duration: 1.5,
            delay: p.delay,
            repeat: Infinity,
            repeatDelay: 1,
          }}
          style={{ background: "hsl(280 70% 70%)" }}
        />
      ))}

      {/* Face container with glass border */}
      <div
        className="relative rounded-full overflow-hidden z-10"
        style={{
          width: size,
          height: size,
          border: "2px solid hsl(280 40% 40% / 0.4)",
          boxShadow: `
            0 0 20px ${config.auraColor},
            inset 0 0 20px hsl(280 30% 10% / 0.3)
          `,
        }}
      >
        <video
          src="/hoppy-blink.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover scale-[1.3] object-top"
        />

        {/* State-reactive overlay */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          animate={{
            opacity: state === "thinking" ? [0, 0.15, 0] : 0,
          }}
          transition={{ duration: 1.5, repeat: Infinity }}
          style={{
            background: "linear-gradient(180deg, transparent 0%, hsl(45 90% 55% / 0.15) 50%, transparent 100%)",
          }}
        />
      </div>

      {/* Status indicator dot */}
      <motion.div
        className="absolute bottom-2 right-2 z-20 h-3 w-3 rounded-full border-2"
        animate={{
          scale: state === "idle" ? 1 : [1, 1.3, 1],
        }}
        transition={{ duration: 1, repeat: state === "idle" ? 0 : Infinity }}
        style={{
          background: state === "thinking"
            ? "hsl(45 90% 55%)"
            : state === "speaking"
            ? "hsl(280 70% 60%)"
            : state === "listening"
            ? "hsl(190 80% 50%)"
            : "hsl(140 60% 50%)",
          borderColor: "hsl(0 0% 8%)",
        }}
      />
    </div>
  );
}
