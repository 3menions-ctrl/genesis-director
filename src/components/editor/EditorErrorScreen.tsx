import { motion } from "framer-motion";
import { Film } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EditorErrorScreen({ error }: { error: string | null }) {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#08080c] gap-5">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-4 p-8 rounded-2xl border border-border/20 bg-card/30 backdrop-blur-xl"
      >
        <Film className="w-6 h-6 text-destructive" />
        <p className="text-sm text-foreground/80">Failed to load editor</p>
        <p className="text-xs text-muted-foreground/60">{error}</p>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </motion.div>
    </div>
  );
}
