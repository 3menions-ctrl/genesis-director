/**
 * Hoppy Agent Trigger Button 🐰
 * 
 * Floating button with Hoppy's face to open the chat panel.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { AgentPanel } from "./AgentPanel";

export function AgentTrigger() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Hoppy face button */}
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
              "h-16 w-16 rounded-full",
              "overflow-hidden",
              "shadow-[0_0_30px_hsl(263_70%_58%/0.3)]",
              "transition-shadow hover:shadow-[0_0_50px_hsl(263_70%_58%/0.5)]",
              "border-2 border-primary/40"
            )}
            aria-label="Chat with Hoppy"
          >
            <video
              src="/hoppy-blink.mp4"
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover scale-[1.3] object-top"
            />
            
            {/* Pulse ring */}
            <span className="absolute inset-0 rounded-full animate-ping bg-primary/15 pointer-events-none" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Agent Panel */}
      <AgentPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
