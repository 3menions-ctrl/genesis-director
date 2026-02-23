import { motion } from "framer-motion";
import { Logo } from "@/components/ui/Logo";
import { Sparkles } from "lucide-react";

export function EditorLoadingScreen() {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-background gap-6 relative overflow-hidden">
      {/* Ambient background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 left-1/3 w-[300px] h-[300px] bg-violet-500/3 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/3 right-1/3 w-[200px] h-[200px] bg-primary/4 rounded-full blur-[80px]" />
      </div>

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.015] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(hsla(263, 84%, 58%, 0.3) 1px, transparent 1px), linear-gradient(90deg, hsla(263, 84%, 58%, 0.3) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col items-center gap-6 p-10 rounded-3xl border border-border/10 bg-card/30 backdrop-blur-xl"
      >
        {/* Glassmorphic glow ring */}
        <div className="absolute -inset-px rounded-3xl bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />

        <Logo size="lg" />

        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-primary/60" />
            <p className="text-sm font-semibold text-foreground/80 font-display tracking-tight">
              Initializing Apex Studio
            </p>
          </div>
          <p className="text-[11px] text-muted-foreground/40">
            Loading editor modules & WebCodecs engine…
          </p>
        </div>

        {/* Premium loading bar */}
        <div className="w-56 h-1 bg-border/20 rounded-full overflow-hidden relative">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary/60 via-primary to-violet-400"
            animate={{
              x: ["-100%", "0%", "100%"],
            }}
            transition={{
              duration: 1.8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            style={{ width: "40%" }}
          />
          {/* Shimmer overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
        </div>
      </motion.div>
    </div>
  );
}
