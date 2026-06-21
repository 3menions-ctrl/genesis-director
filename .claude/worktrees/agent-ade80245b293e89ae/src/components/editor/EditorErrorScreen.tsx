import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, ArrowLeft, LifeBuoy } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function EditorErrorScreen({ error }: { error: string | null }) {
  const navigate = useNavigate();

  return (
    <div
      className="h-screen w-screen flex flex-col items-center justify-center gap-10 relative overflow-hidden"
      style={{
        background:
          'radial-gradient(1200px 700px at 50% 30%, hsla(215, 95%, 26%, 0.22), transparent 65%), radial-gradient(800px 560px at 50% 105%, hsla(0, 70%, 18%, 0.12), transparent 60%), radial-gradient(600px 500px at 0% 0%, hsla(220, 70%, 14%, 0.18), transparent 65%), linear-gradient(180deg, hsl(220, 16%, 3.4%) 0%, hsl(220, 14%, 2%) 100%)',
      }}
    >
      {/* Conic aurora sweep */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -inset-[20%] opacity-[0.16]"
        style={{
          background:
            'conic-gradient(from 0deg at 50% 50%, transparent 0deg, hsla(215,100%,60%,0.24) 60deg, transparent 120deg, transparent 240deg, hsla(0,90%,55%,0.16) 300deg, transparent 360deg)',
          filter: 'blur(70px)',
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
      />

      {/* Film grain */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.045] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.5 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />

      {/* Precision grid */}
      <div
        aria-hidden
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
            'radial-gradient(120% 90% at 50% 50%, transparent 50%, hsla(220, 30%, 0%, 0.7) 100%)',
        }}
      />

      {/* Hairlines */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[hsla(0,80%,55%,0.45)] to-transparent" />
      <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-transparent via-[hsla(0,80%,55%,0.16)] to-transparent blur-sm" />
      <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[hsla(215,100%,55%,0.3)] to-transparent" />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col items-center gap-8 max-w-xl px-8"
      >
        {/* Halo emblem */}
        <div className="relative flex items-center justify-center">
          <motion.div
            aria-hidden
            className="absolute w-32 h-32 rounded-full"
            style={{
              border: '1px solid hsla(0,80%,55%,0.18)',
              boxShadow: '0 0 40px hsla(0,80%,55%,0.12) inset',
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
          >
            <span
              className="absolute -top-[3px] left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
              style={{
                background: 'hsl(0, 100%, 75%)',
                boxShadow: '0 0 10px hsla(0,100%,70%,0.9)',
              }}
            />
          </motion.div>
          <motion.div
            aria-hidden
            className="absolute w-24 h-24 rounded-full"
            style={{ border: '1px dashed hsla(0,80%,55%,0.2)' }}
            animate={{ rotate: -360 }}
            transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
          />
          <motion.div
            aria-hidden
            className="absolute w-20 h-20 rounded-full"
            animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.85, 0.4] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              background:
                'radial-gradient(circle, hsla(0,90%,55%,0.35) 0%, transparent 70%)',
              filter: 'blur(8px)',
            }}
          />
          <motion.div
            animate={{
              boxShadow: [
                '0 0 40px hsla(0, 90%, 55%, 0.25)',
                '0 0 100px hsla(0, 90%, 55%, 0.5)',
                '0 0 40px hsla(0, 90%, 55%, 0.25)',
              ],
            }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
            className="w-16 h-16 rounded-2xl flex items-center justify-center relative z-10"
            style={{
              background:
                'linear-gradient(135deg, hsl(0,85%,55%) 0%, hsl(15,90%,42%) 100%)',
              boxShadow:
                '0 0 0 1px hsla(0,90%,80%,0.45) inset, 0 1px 0 hsla(0,0%,100%,0.35) inset, 0 -1px 0 hsla(0,0%,0%,0.3) inset, 0 20px 60px -10px hsla(0,90%,50%,0.55)',
            }}
          >
            <AlertTriangle className="w-7 h-7 text-white drop-shadow-[0_0_12px_hsla(0,0%,100%,0.85)]" />
          </motion.div>
        </div>

        {/* Wordmark */}
        <div className="flex flex-col items-center gap-3 text-center">
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
                  'linear-gradient(180deg, hsla(0,85%,55%,0.22), hsla(0,85%,40%,0.08))',
                color: 'hsl(0, 100%, 82%)',
                border: '1px solid hsla(0,85%,55%,0.3)',
              }}
            >
              Halt
            </span>
          </div>
          <p className="text-[10px] tracking-[0.45em] uppercase text-muted-foreground/55 font-medium">
            Engine failed to initialize
          </p>
        </div>

        {/* Glass diagnostic plate */}
        <div
          className="relative w-full rounded-2xl px-7 py-6 backdrop-blur-2xl overflow-hidden"
          style={{
            background: 'hsla(220,14%,4%,0.6)',
            border: '1px solid hsla(0,80%,55%,0.18)',
            boxShadow:
              '0 30px 100px -40px hsla(0,80%,40%,0.45), inset 0 1px 0 hsla(0,0%,100%,0.04)',
          }}
        >
          {/* Corner ticks */}
          <span className="absolute top-2 left-2 w-3 h-px bg-[hsla(0,80%,60%,0.4)]" />
          <span className="absolute top-2 left-2 w-px h-3 bg-[hsla(0,80%,60%,0.4)]" />
          <span className="absolute top-2 right-2 w-3 h-px bg-[hsla(0,80%,60%,0.4)]" />
          <span className="absolute top-2 right-2 w-px h-3 bg-[hsla(0,80%,60%,0.4)]" />
          <span className="absolute bottom-2 left-2 w-3 h-px bg-[hsla(0,80%,60%,0.4)]" />
          <span className="absolute bottom-2 left-2 w-px h-3 bg-[hsla(0,80%,60%,0.4)]" />
          <span className="absolute bottom-2 right-2 w-3 h-px bg-[hsla(0,80%,60%,0.4)]" />
          <span className="absolute bottom-2 right-2 w-px h-3 bg-[hsla(0,80%,60%,0.4)]" />

          <div className="flex items-center gap-2 mb-3 text-[9.5px] tracking-[0.42em] uppercase font-mono text-[hsl(0,90%,72%)]/85">
            <span className="w-1.5 h-1.5 rounded-full bg-[hsl(0,90%,65%)] shadow-[0_0_8px_hsla(0,90%,60%,0.9)]" />
            Diagnostic · 0x{(Math.abs((error || 'init').split('').reduce((a, c) => a + c.charCodeAt(0), 0)).toString(16).padStart(4, '0')).slice(0, 4).toUpperCase()}
          </div>
          <p className="text-sm text-white/80 leading-relaxed font-medium">
            {error || "An unexpected error occurred while loading the editor modules."}
          </p>
          <p className="mt-3 text-[10px] text-white/40 leading-relaxed">
            The WebCodecs engine and timeline runtime could not be calibrated. Reloading usually restores the session — your project state is safe.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button
            onClick={() => window.location.reload()}
            className="gap-2 rounded-xl px-5 h-10 text-xs font-semibold tracking-[0.18em] uppercase border border-[hsla(215,100%,60%,0.45)] bg-gradient-to-b from-[hsl(215,100%,55%)] to-[hsl(210,100%,42%)] text-white shadow-[0_18px_50px_-15px_hsla(215,100%,55%,0.7)] hover:shadow-[0_22px_60px_-15px_hsla(215,100%,55%,0.9)] transition-shadow"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Recalibrate
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/projects')}
            className="gap-2 rounded-xl px-5 h-10 text-xs font-semibold tracking-[0.18em] uppercase bg-[hsla(220,14%,5%,0.5)] border border-white/10 text-white/85 hover:bg-[hsla(220,14%,7%,0.7)] hover:border-white/20"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Projects
          </Button>
        </div>

        {/* Diagnostic ticker */}
        <div className="flex items-center gap-4 text-[8.5px] tracking-[0.32em] uppercase text-muted-foreground/35 font-mono pt-2">
          <span className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-[hsl(0,90%,65%)]" />
            Engine · Halt
          </span>
          <span className="w-px h-2.5 bg-white/10" />
          <span className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-[hsl(45,100%,65%)]" />
            Codecs · Idle
          </span>
          <span className="w-px h-2.5 bg-white/10" />
          <span className="flex items-center gap-1.5">
            <LifeBuoy className="w-2.5 h-2.5 text-[hsl(215,100%,72%)]" />
            Recovery · Ready
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
