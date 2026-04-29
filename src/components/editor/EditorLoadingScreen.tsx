import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

export function EditorLoadingScreen() {
  return (
    <div
      className="h-screen w-screen flex flex-col items-center justify-center gap-10 relative overflow-hidden"
      style={{
        background:
          'radial-gradient(1200px 700px at 50% 30%, hsla(215, 95%, 26%, 0.28), transparent 65%), radial-gradient(800px 560px at 50% 105%, hsla(210, 85%, 16%, 0.14), transparent 60%), radial-gradient(600px 500px at 0% 0%, hsla(220, 70%, 14%, 0.18), transparent 65%), radial-gradient(600px 500px at 100% 100%, hsla(220, 70%, 14%, 0.16), transparent 65%), linear-gradient(180deg, hsl(220, 16%, 3.4%) 0%, hsl(220, 14%, 2%) 100%)',
      }}
    >
      {/* Aurora light wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(50% 35% at 18% 12%, hsla(210,100%,55%,0.07), transparent 70%), radial-gradient(45% 30% at 82% 88%, hsla(220,100%,55%,0.06), transparent 70%)',
          mixBlendMode: 'screen',
        }}
      />

      {/* Slow conic aurora sweep */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -inset-[20%] opacity-[0.18]"
        style={{
          background:
            'conic-gradient(from 0deg at 50% 50%, transparent 0deg, hsla(215,100%,60%,0.28) 60deg, transparent 120deg, transparent 240deg, hsla(200,100%,65%,0.22) 300deg, transparent 360deg)',
          filter: 'blur(60px)',
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
      />

      {/* Film-grain veil */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.5 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />

      {/* Faint precision grid */}
      <div
        className="absolute inset-0 opacity-[0.022] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(hsla(215, 100%, 60%, 0.5) 1px, transparent 1px), linear-gradient(90deg, hsla(215, 100%, 60%, 0.5) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
        }}
      />

      {/* Edge vignette */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(120% 90% at 50% 50%, transparent 50%, hsla(220, 30%, 0%, 0.65) 100%)',
        }}
      />

      {/* Top hairline */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[hsla(215,100%,55%,0.55)] to-transparent" />
      <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-transparent via-[hsla(215,100%,55%,0.18)] to-transparent blur-sm" />
      {/* Bottom hairline */}
      <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[hsla(215,100%,55%,0.35)] to-transparent" />

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col items-center gap-9"
      >
        {/* Wordmark mark — concentric halo system */}
        <div className="relative flex items-center justify-center">
          {/* Outer slow rotating ring */}
          <motion.div
            aria-hidden
            className="absolute w-32 h-32 rounded-full"
            style={{
              border: '1px solid hsla(215,100%,60%,0.12)',
              boxShadow: '0 0 40px hsla(215,100%,55%,0.08) inset',
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
          >
            <span
              className="absolute -top-[3px] left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
              style={{
                background: 'hsl(200, 100%, 75%)',
                boxShadow: '0 0 10px hsla(200,100%,70%,0.9)',
              }}
            />
          </motion.div>
          {/* Mid counter-rotating arc */}
          <motion.div
            aria-hidden
            className="absolute w-24 h-24 rounded-full"
            style={{
              border: '1px dashed hsla(215,100%,60%,0.18)',
            }}
            animate={{ rotate: -360 }}
            transition={{ duration: 16, repeat: Infinity, ease: 'linear' }}
          />
          {/* Pulsing inner aura */}
          <motion.div
            aria-hidden
            className="absolute w-20 h-20 rounded-full"
            animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              background:
                'radial-gradient(circle, hsla(215,100%,55%,0.35) 0%, transparent 70%)',
              filter: 'blur(8px)',
            }}
          />
          <motion.div
            animate={{
              boxShadow: [
                '0 0 40px hsla(215, 100%, 55%, 0.20)',
                '0 0 100px hsla(215, 100%, 55%, 0.45)',
                '0 0 40px hsla(215, 100%, 55%, 0.20)',
              ],
            }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
            className="w-16 h-16 rounded-2xl flex items-center justify-center relative z-10"
            style={{
              background:
                'linear-gradient(135deg, hsl(215,100%,55%) 0%, hsl(200,100%,42%) 100%)',
              boxShadow:
                '0 0 0 1px hsla(215,100%,80%,0.45) inset, 0 1px 0 hsla(0,0%,100%,0.35) inset, 0 -1px 0 hsla(0,0%,0%,0.3) inset, 0 20px 60px -10px hsla(215,100%,50%,0.65)',
            }}
          >
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
            >
              <Sparkles className="w-7 h-7 text-white drop-shadow-[0_0_12px_hsla(0,0%,100%,0.85)]" />
            </motion.div>
          </motion.div>
        </div>

        {/* Wordmark */}
        <div className="flex flex-col items-center gap-3 mt-2">
          <div className="flex items-baseline gap-2.5">
            <span className="font-display text-[22px] font-semibold tracking-[0.32em] uppercase text-foreground/90">
              Apex
            </span>
            <span className="font-display text-[14px] font-light tracking-[0.5em] uppercase text-muted-foreground/40">
              Studio
            </span>
            <span
              className="text-[9px] font-bold tracking-[0.28em] uppercase px-1.5 py-[3px] rounded-[4px] translate-y-[-3px]"
              style={{
                background:
                  'linear-gradient(180deg, hsla(215,100%,55%,0.22), hsla(215,100%,40%,0.08))',
                color: 'hsl(200, 100%, 82%)',
                border: '1px solid hsla(215,100%,55%,0.3)',
              }}
            >
              Pro
            </span>
          </div>
          <motion.p
            animate={{ opacity: [0.35, 0.7, 0.35] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            className="text-[10px] tracking-[0.45em] uppercase text-muted-foreground/50 font-medium"
          >
            Calibrating timeline · WebCodecs engine
          </motion.p>
        </div>

        {/* Refined progress bar with end caps */}
        <div className="flex items-center gap-3">
          <span className="w-1 h-1 rounded-full bg-[hsla(215,100%,60%,0.5)]" />
          <div
            className="w-72 h-[2px] rounded-full overflow-hidden relative"
            style={{
              background: 'hsla(0,0%,100%,0.05)',
              boxShadow:
                'inset 0 0 0 1px hsla(215,100%,60%,0.06), 0 0 20px hsla(215,100%,55%,0.08)',
            }}
          >
            <motion.div
              className="absolute inset-y-0 w-1/3 rounded-full"
              style={{
                background:
                  'linear-gradient(90deg, transparent, hsl(215, 100%, 60%) 40%, hsl(195, 100%, 78%) 60%, transparent)',
                boxShadow: '0 0 18px hsla(215,100%,55%,0.7)',
              }}
              animate={{ x: ['-110%', '320%'] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
          <span className="w-1 h-1 rounded-full bg-[hsla(215,100%,60%,0.5)]" />
        </div>

        {/* Diagnostic ticker */}
        <div className="flex items-center gap-4 text-[8.5px] tracking-[0.32em] uppercase text-muted-foreground/30 font-mono">
          <span className="flex items-center gap-1.5">
            <motion.span
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.4, repeat: Infinity }}
              className="w-1 h-1 rounded-full bg-emerald-400/70"
            />
            Engine
          </span>
          <span className="w-px h-2.5 bg-white/10" />
          <span className="flex items-center gap-1.5">
            <motion.span
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.4, repeat: Infinity, delay: 0.4 }}
              className="w-1 h-1 rounded-full bg-[hsl(215,100%,65%)]"
            />
            Codecs
          </span>
          <span className="w-px h-2.5 bg-white/10" />
          <span className="flex items-center gap-1.5">
            <motion.span
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.4, repeat: Infinity, delay: 0.8 }}
              className="w-1 h-1 rounded-full bg-[hsl(200,100%,75%)]"
            />
            Timeline
          </span>
        </div>
      </motion.div>

      {/* Bottom signature */}
      <div className="absolute bottom-6 inset-x-0 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <span className="w-6 h-px bg-gradient-to-r from-transparent to-[hsla(215,100%,60%,0.3)]" />
          <span className="text-[8.5px] tracking-[0.5em] uppercase text-muted-foreground/40 font-medium">
            Cinema · Engineered
          </span>
          <span className="w-6 h-px bg-gradient-to-l from-transparent to-[hsla(215,100%,60%,0.3)]" />
        </div>
      </div>
    </div>
  );
}
