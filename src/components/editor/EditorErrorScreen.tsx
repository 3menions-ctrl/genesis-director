import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/Logo";
import { AlertTriangle, RefreshCw } from "lucide-react";

export function EditorErrorScreen({ error }: { error: string | null }) {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-background gap-5 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-destructive/5 rounded-full blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col items-center gap-5 p-10 rounded-3xl border border-border/15 bg-card/30 backdrop-blur-xl max-w-md"
      >
        <div className="absolute -inset-px rounded-3xl bg-gradient-to-b from-destructive/5 to-transparent pointer-events-none" />

        <Logo size="md" />

        <div className="flex items-center gap-2 text-destructive/80">
          <AlertTriangle className="w-4 h-4" />
          <p className="text-sm font-semibold">Failed to load Apex Studio</p>
        </div>

        <p className="text-xs text-muted-foreground/50 text-center leading-relaxed max-w-[300px]">
          {error || "An unexpected error occurred while loading the editor modules."}
        </p>

        <Button
          variant="outline"
          size="sm"
          onClick={() => window.location.reload()}
          className="gap-2 rounded-lg border-border/20 hover:border-primary/30"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Try Again
        </Button>
      </motion.div>
    </div>
  );
}
