/**
 * APEX Agent Trigger Button
 * 
 * Floating button to open the AI agent panel.
 * Appears on all authenticated pages.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { AgentPanel } from "./AgentPanel";

export function AgentTrigger() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating trigger button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className={cn(
              "fixed bottom-6 right-6 z-40",
              "h-14 w-14 rounded-2xl",
              "bg-primary text-primary-foreground",
              "flex items-center justify-center",
              "shadow-[var(--shadow-glow)]",
              "transition-shadow hover:shadow-[0_0_60px_hsl(263_70%_58%/0.4)]",
              "border border-primary/30"
            )}
            aria-label="Open APEX Agent"
          >
            <Sparkles className="h-6 w-6" />
            
            {/* Pulse ring */}
            <span className="absolute inset-0 rounded-2xl animate-ping bg-primary/20 pointer-events-none" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Agent Panel */}
      <AgentPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
