import { motion } from "framer-motion";
import { Logo } from "@/components/ui/Logo";
import { Film, Layers, Sparkles } from "lucide-react";

export function EditorLoadingScreen() {
  return (
    <div
      className="h-screen w-screen flex flex-col items-center justify-center gap-8 relative overflow-hidden"
      style={{ background: "hsl(220, 14%, 4%)" }}
    >
      {/* Ambient glow — blue accent only */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[140px]" style={{ background: "hsla(215, 100%, 50%, 0.04)" }} />
        <div className="absolute top-1/3 right-1/3 w-[250px] h-[250px] rounded-full blur-[100px]" style={{ background: "hsla(215, 100%, 60%, 0.03)" }} />
      </div>

      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.012] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(hsla(215, 100%, 50%, 0.4) 1px, transparent 1px), linear-gradient(90deg, hsla(215, 100%, 50%, 0.4) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col items-center gap-8"
      >
        {/* Icon cluster */}
        <div className="relative">
          <motion.div
            animate={{
              boxShadow: [
                "0 0 30px hsla(215, 100%, 50%, 0)",
                "0 0 60px hsla(215, 100%, 50%, 0.08)",
                "0 0 30px hsla(215, 100%, 50%, 0)",
              ],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="w-20 h-20 rounded-2xl flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, hsla(215, 100%, 50%, 0.1), hsla(215, 100%, 50%, 0.03))",
              border: "1px solid hsla(215, 100%, 50%, 0.12)",
            }}
          >
            <Film className="w-9 h-9 text-[hsla(215,100%,60%,0.5)]" />
          </motion.div>

          {/* Orbiting elements */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0"
          >
            <Sparkles className="w-3 h-3 text-[hsla(215,100%,60%,0.4)] absolute -top-1 left-1/2 -translate-x-1/2" />
          </motion.div>
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0"
          >
            <Layers className="w-2.5 h-2.5 text-[hsla(215,100%,60%,0.3)] absolute -right-2 top-1/2 -translate-y-1/2" />
          </motion.div>
        </div>

        {/* Text */}
        <div className="flex flex-col items-center gap-2">
          <p className="text-[14px] font-semibold text-[hsla(0,0%,100%,0.6)] tracking-wide">
            LOADING STUDIO
          </p>
          <p className="text-[11px] text-[hsla(0,0%,100%,0.25)]">
            Initializing editor modules & WebCodecs engine…
          </p>
        </div>

        {/* Loading bar — blue gradient */}
        <div className="w-48 h-[3px] rounded-full overflow-hidden relative" style={{ background: "hsla(0,0%,100%,0.06)" }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg, hsl(215, 100%, 50%), hsl(215, 100%, 65%))" }}
            animate={{ x: ["-100%", "0%", "100%"] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            initial={{ width: "40%" }}
          />
        </div>

        {/* Progress percentage */}
        <motion.p
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-[10px] font-mono text-[hsla(215,100%,60%,0.4)]"
        >
          39%
        </motion.p>
      </motion.div>
    </div>
  );
}
