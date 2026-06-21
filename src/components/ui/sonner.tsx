import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";
import { CheckCircle2, XCircle, AlertTriangle, Info, Loader2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { forwardRef } from "react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

interface AnimatedIconProps {
  children: React.ReactNode;
  glowColor: string;
}

// Refined luminous icon — single soft pulse, no rotation jitter.
const AnimatedIcon = forwardRef<HTMLDivElement, AnimatedIconProps>(({ children, glowColor }, ref) => (
  <motion.div
    ref={ref}
    initial={{ scale: 0.6, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={{ type: "spring", stiffness: 380, damping: 22 }}
    className="relative flex items-center justify-center w-8 h-8 rounded-full"
    style={{ background: `radial-gradient(circle at center, ${glowColor} 0%, transparent 70%)` }}
  >
    <motion.span
      aria-hidden
      className="absolute inset-0 rounded-full"
      style={{ boxShadow: `0 0 0 1px ${glowColor}` }}
      animate={{ scale: [1, 1.6], opacity: [0.55, 0] }}
      transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
    />
    {children}
  </motion.div>
));

AnimatedIcon.displayName = "AnimatedIcon";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  // Canonical Pro-Dark surface — locked tier-shared design (no purple).
  //
  // Tailwind's arbitrary-value parser rejects commas inside hsl(...)
  // — `bg-[hsl(220,14%,3%)/0.94]` silently fails and the toast
  // falls back to its default white background. Use underscores
  // (Tailwind's space syntax) so `hsl(220 14% 3% / 0.94)` is read
  // as the complete CSS color.
  //
  // Same fix applied to the per-tier glow shells below.
  // World-class glassmorphic toast shell.
  // — Heavier backdrop blur (40px) for true depth-of-field separation
  //   from the page behind.
  // — Glass plate built from a top-down translucent gradient so the
  //   surface reads as a refracted slab, not a flat block.
  // — Generous border-radius (24px = rounded-3xl) keeps the chip
  //   feeling premium at desktop sizes.
  // — Per-tier override below adds a 3px accent stripe on the left
  //   edge that bleeds into a soft inner glow of the same hue.
  const SHELL =
    "group toast pointer-events-auto relative overflow-hidden " +
    "group-[.toaster]:rounded-3xl group-[.toaster]:px-6 group-[.toaster]:py-5 group-[.toaster]:gap-4 " +
    "group-[.toaster]:backdrop-blur-[40px] " +
    "group-[.toaster]:bg-[linear-gradient(135deg,hsl(220_30%_8%/0.88)_0%,hsl(220_30%_4%/0.92)_100%)] " +
    "group-[.toaster]:border group-[.toaster]:border-white/[0.10] " +
    "group-[.toaster]:min-w-[400px] group-[.toaster]:max-w-[560px] " +
    "group-[.toaster]:text-white " +
    "group-[.toaster]:shadow-[0_40px_100px_-24px_rgba(0,0,0,0.92),0_0_0_1px_rgba(255,255,255,0.03),inset_0_1px_0_rgba(255,255,255,0.07),inset_0_-1px_0_rgba(255,255,255,0.02)]";

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group font-display"
      // Bottom-center anchors the toast to the user's read-out
      // direction (eye returns to the bottom after acting on a
      // control). offset doubled vs the old top-mount so the stack
      // sits a clean 56px above the viewport edge regardless of safe
      // areas — generous enough to clear browser chrome on Safari
      // iOS, tight enough not to feel "halfway up the screen."
      position="bottom-center"
      gap={14}
      offset={56}
      // One at a time, two seconds. Stacked toasts read as "the app is
      // yelling at me"; the user explicitly asked for less.
      visibleToasts={1}
      toastOptions={{
        duration: 2000,
        classNames: {
          toast: SHELL,
          title:
            "group-[.toast]:font-display group-[.toast]:text-white group-[.toast]:font-medium " +
            "group-[.toast]:tracking-[-0.015em] group-[.toast]:text-[16px] group-[.toast]:leading-snug",
          description:
            "group-[.toast]:text-white/60 group-[.toast]:text-[13px] group-[.toast]:leading-relaxed group-[.toast]:mt-1",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-white group-[.toast]:rounded-full " +
            "group-[.toast]:font-medium group-[.toast]:px-4 group-[.toast]:py-1.5 group-[.toast]:text-[12px] " +
            "group-[.toast]:tracking-wide group-[.toast]:hover:bg-primary/90 " +
            "group-[.toast]:transition-all group-[.toast]:duration-200 " +
            "group-[.toast]:shadow-[0_0_24px_rgba(10,132,255,0.35)]",
          cancelButton:
            "group-[.toast]:bg-glass-hover group-[.toast]:text-white/70 group-[.toast]:rounded-full " +
            "group-[.toast]:border group-[.toast]:border-white/[0.08] group-[.toast]:hover:bg-white/10 " +
            "group-[.toast]:transition-all group-[.toast]:duration-200",
          closeButton:
            "group-[.toast]:bg-transparent group-[.toast]:border-0 " +
            "group-[.toast]:text-white/30 group-[.toast]:hover:text-white/80 group-[.toast]:transition-colors",
          icon: "group-[.toast]:[&>div]:h-8 group-[.toast]:[&>div]:w-8",
          success:
            SHELL + " group-[.toaster]:!border-emerald-400/35 " +
            "group-[.toaster]:bg-[linear-gradient(135deg,hsl(155_45%_8%/0.92)_0%,hsl(220_30%_4%/0.94)_55%)] " +
            "group-[.toaster]:before:absolute group-[.toaster]:before:inset-y-0 group-[.toaster]:before:left-0 group-[.toaster]:before:w-[3px] " +
            "group-[.toaster]:before:bg-gradient-to-b group-[.toaster]:before:from-emerald-300 group-[.toaster]:before:via-emerald-400 group-[.toaster]:before:to-emerald-500/60 " +
            "group-[.toaster]:shadow-[0_0_80px_rgba(16,185,129,0.28),0_0_160px_rgba(16,185,129,0.10),0_40px_100px_-24px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(16,185,129,0.18)]",
          error:
            SHELL + " group-[.toaster]:!border-rose-400/35 " +
            "group-[.toaster]:bg-[linear-gradient(135deg,hsl(0_55%_10%/0.92)_0%,hsl(220_30%_4%/0.94)_55%)] " +
            "group-[.toaster]:before:absolute group-[.toaster]:before:inset-y-0 group-[.toaster]:before:left-0 group-[.toaster]:before:w-[3px] " +
            "group-[.toaster]:before:bg-gradient-to-b group-[.toaster]:before:from-rose-300 group-[.toaster]:before:via-rose-400 group-[.toaster]:before:to-rose-500/60 " +
            "group-[.toaster]:shadow-[0_0_80px_rgba(244,63,94,0.28),0_0_160px_rgba(244,63,94,0.10),0_40px_100px_-24px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(244,63,94,0.18)]",
          warning:
            SHELL + " group-[.toaster]:!border-amber-400/35 " +
            "group-[.toaster]:bg-[linear-gradient(135deg,hsl(35_55%_10%/0.92)_0%,hsl(220_30%_4%/0.94)_55%)] " +
            "group-[.toaster]:before:absolute group-[.toaster]:before:inset-y-0 group-[.toaster]:before:left-0 group-[.toaster]:before:w-[3px] " +
            "group-[.toaster]:before:bg-gradient-to-b group-[.toaster]:before:from-amber-300 group-[.toaster]:before:via-amber-400 group-[.toaster]:before:to-amber-500/60 " +
            "group-[.toaster]:shadow-[0_0_80px_rgba(245,158,11,0.28),0_0_160px_rgba(245,158,11,0.10),0_40px_100px_-24px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(245,158,11,0.18)]",
          info:
            SHELL + " group-[.toaster]:!border-primary/40 " +
            "group-[.toaster]:bg-[linear-gradient(135deg,hsl(215_55%_12%/0.92)_0%,hsl(220_30%_4%/0.94)_55%)] " +
            "group-[.toaster]:before:absolute group-[.toaster]:before:inset-y-0 group-[.toaster]:before:left-0 group-[.toaster]:before:w-[3px] " +
            "group-[.toaster]:before:bg-gradient-to-b group-[.toaster]:before:from-sky-300 group-[.toaster]:before:via-primary group-[.toaster]:before:to-primary/60 " +
            "group-[.toaster]:shadow-[0_0_80px_rgba(10,132,255,0.28),0_0_160px_rgba(10,132,255,0.10),0_40px_100px_-24px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(10,132,255,0.18)]",
          loading: SHELL +
            " group-[.toaster]:before:absolute group-[.toaster]:before:inset-y-0 group-[.toaster]:before:left-0 group-[.toaster]:before:w-[3px] " +
            "group-[.toaster]:before:bg-gradient-to-b group-[.toaster]:before:from-white/50 group-[.toaster]:before:via-white/30 group-[.toaster]:before:to-white/10",
        },
      }}
      icons={{
        success: (
          <AnimatedIcon glowColor="rgba(16, 185, 129, 0.45)">
            <CheckCircle2 className="h-[18px] w-[18px] text-emerald-300" style={{ filter: "drop-shadow(0 0 10px rgba(16,185,129,0.55))" }} />
          </AnimatedIcon>
        ),
        error: (
          <AnimatedIcon glowColor="rgba(244, 63, 94, 0.45)">
            <XCircle className="h-[18px] w-[18px] text-rose-300" style={{ filter: "drop-shadow(0 0 10px rgba(244,63,94,0.55))" }} />
          </AnimatedIcon>
        ),
        warning: (
          <AnimatedIcon glowColor="rgba(245, 158, 11, 0.45)">
            <AlertTriangle className="h-[18px] w-[18px] text-amber-300" style={{ filter: "drop-shadow(0 0 10px rgba(245,158,11,0.55))" }} />
          </AnimatedIcon>
        ),
        info: (
          <AnimatedIcon glowColor="rgba(10, 132, 255, 0.45)">
            <Info className="h-[18px] w-[18px] text-primary/85" style={{ filter: "drop-shadow(0 0 10px rgba(10,132,255,0.55))" }} />
          </AnimatedIcon>
        ),
        loading: (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="flex items-center justify-center w-8 h-8"
          >
            <Loader2 className="h-[18px] w-[18px] text-primary/85" style={{ filter: "drop-shadow(0 0 8px rgba(10,132,255,0.45))" }} />
          </motion.div>
        ),
      }}
      {...props}
    />
  );
};

// Premium toast helper — Pro-Dark + blue accent (matches locked design).
const premiumToast = {
  success: (message: string, options?: Parameters<typeof toast.success>[1]) =>
    toast.success(message, { ...options }),
  error: (message: string, options?: Parameters<typeof toast.error>[1]) =>
    toast.error(message, { ...options }),
  warning: (message: string, options?: Parameters<typeof toast.warning>[1]) =>
    toast.warning(message, { ...options }),
  info: (message: string, options?: Parameters<typeof toast.info>[1]) =>
    toast.info(message, { ...options }),
  loading: (message: string, options?: Parameters<typeof toast.loading>[1]) =>
    toast.loading(message, { ...options }),
  epic: (message: string, description?: string) =>
    toast(message, {
      description,
      duration: 6500,
      icon: (
        <motion.div
          animate={{ rotate: [0, 12, -12, 0], scale: [1, 1.12, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          className="flex items-center justify-center w-8 h-8 rounded-full"
          style={{ background: "radial-gradient(circle at center, rgba(10,132,255,0.45) 0%, transparent 70%)" }}
        >
          <Sparkles className="h-[18px] w-[18px] text-primary/85" style={{ filter: "drop-shadow(0 0 12px rgba(10,132,255,0.7))" }} />
        </motion.div>
      ),
      className:
        "font-display backdrop-blur-2xl bg-[hsl(220_14%_3%/0.94)] border border-primary/30 text-white " +
        "shadow-[0_0_80px_rgba(10,132,255,0.22),0_0_160px_rgba(10,132,255,0.08),0_30px_80px_-20px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(10,132,255,0.14)]",
    }),
  promise: toast.promise,
  dismiss: toast.dismiss,
  custom: toast.custom,
};

export { Toaster, toast, premiumToast };
