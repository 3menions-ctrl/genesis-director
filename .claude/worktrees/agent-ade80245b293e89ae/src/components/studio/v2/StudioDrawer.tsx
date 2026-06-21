import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  width?: "md" | "lg" | "xl";
  children: React.ReactNode;
}

export function StudioDrawer({ open, onClose, title, subtitle, width = "lg", children }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const widthClass = width === "xl" ? "max-w-[860px]" : width === "lg" ? "max-w-[640px]" : "max-w-[460px]";

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-md"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 240 }}
            className={cn(
              "fixed top-0 right-0 bottom-0 z-[81] w-full",
              widthClass,
              "bg-background border-l border-border",
              "flex flex-col"
            )}
          >
            {/* Blue rail */}
            <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-transparent via-accent to-transparent opacity-60" />
            {/* Header */}
            <header className="flex items-start justify-between gap-4 px-7 py-6 border-b border-border">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-accent/80 mb-1">Studio</div>
                <h2 className="font-display text-2xl text-foreground leading-tight">{title}</h2>
                {subtitle && <p className="text-[13px] text-muted-foreground mt-1">{subtitle}</p>}
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-2 text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}