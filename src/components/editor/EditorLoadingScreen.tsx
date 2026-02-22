import { motion } from "framer-motion";
import { Film } from "lucide-react";
import { Logo } from "@/components/ui/Logo";

export function EditorLoadingScreen() {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#08080c] gap-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px]" />
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 flex flex-col items-center gap-5"
      >
        <Logo size="lg" />
        <p className="text-sm font-medium text-foreground/70 font-display">Loading Apex Studio…</p>
        <div className="w-48 h-0.5 bg-border/30 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-primary/60 via-primary to-primary/60 rounded-full animate-loader-progress" />
        </div>
      </motion.div>
    </div>
  );
}
