import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/Logo";

export function EditorErrorScreen({ error }: { error: string | null }) {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-background gap-5">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-4 p-8 rounded-2xl border border-border/20 bg-card/30 backdrop-blur-xl"
      >
        <Logo size="md" />
        <p className="text-sm text-foreground/80">Failed to load Apex Studio</p>
        <p className="text-xs text-muted-foreground/60 max-w-[300px] text-center">{error}</p>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </motion.div>
    </div>
  );
}
