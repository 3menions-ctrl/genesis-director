import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

export function EditorLoadingScreen() {
  return (
    <div
      className="h-screen w-screen flex flex-col items-center justify-center gap-10 relative overflow-hidden"
      style={{
        background:
          'radial-gradient(900px 600px at 50% 35%, hsla(215, 90%, 22%, 0.22), transparent 65%), radial-gradient(700px 500px at 50% 100%, hsla(215, 80%, 14%, 0.10), transparent 60%), hsl(220, 14%, 2.5%)',
      }}
    >
      {/* Film-grain veil */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.5 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />

      {/* Faint precision grid */}
      <div
        className="absolute inset-0 opacity-[0.018] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(hsla(215, 100%, 60%, 0.5) 1px, transparent 1px), linear-gradient(90deg, hsla(215, 100%, 60%, 0.5) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
        }}
      />

      {/* Top hairline */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[hsla(215,100%,55%,0.5)] to-transparent" />

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col items-center gap-9"
      >
        {/* Wordmark mark */}
        <div className="relative">
          <motion.div
            animate={{
              boxShadow: [
                '0 0 30px hsla(215, 100%, 55%, 0.15)',
                '0 0 80px hsla(215, 100%, 55%, 0.35)',
                '0 0 30px hsla(215, 100%, 55%, 0.15)',
              ],
            }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
            className="w-16 h-16 rounded-2xl flex items-center justify-center relative"
            style={{
              background:
                'linear-gradient(135deg, hsl(215,100%,55%) 0%, hsl(200,100%,42%) 100%)',
              boxShadow:
                '0 0 0 1px hsla(215,100%,75%,0.35) inset, 0 1px 0 hsla(0,0%,100%,0.25) inset, 0 20px 60px -10px hsla(215,100%,50%,0.55)',
            }}
          >
            <Sparkles className="w-7 h-7 text-white drop-shadow-[0_0_10px_hsla(0,0%,100%,0.7)]" />
          </motion.div>
        </div>

        {/* Wordmark */}
        <div className="flex flex-col items-center gap-3">
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
          <p className="text-[10px] tracking-[0.45em] uppercase text-muted-foreground/35 font-medium">
            Calibrating timeline · WebCodecs engine
          </p>
        </div>

        {/* Refined progress bar */}
        <div
          className="w-64 h-[2px] rounded-full overflow-hidden relative"
          style={{ background: 'hsla(0,0%,100%,0.05)' }}
        >
          <motion.div
            className="absolute inset-y-0 w-1/3 rounded-full"
            style={{
              background:
                'linear-gradient(90deg, transparent, hsl(215, 100%, 60%) 40%, hsl(195, 100%, 75%) 60%, transparent)',
              boxShadow: '0 0 16px hsla(215,100%,55%,0.6)',
            }}
            animate={{ x: ['-110%', '320%'] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      </motion.div>

      {/* Bottom signature */}
      <div className="absolute bottom-6 inset-x-0 flex items-center justify-center">
        <span className="text-[8.5px] tracking-[0.5em] uppercase text-muted-foreground/25 font-medium">
          Cinema · Engineered
        </span>
      </div>
    </div>
  );
}
