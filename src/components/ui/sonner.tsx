import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";
import { CheckCircle2, XCircle, AlertTriangle, Info, Loader2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

type ToasterProps = React.ComponentProps<typeof Sonner>;

// Animated icon wrapper
const AnimatedIcon = ({ children, color }: { children: React.ReactNode; color: string }) => (
  <motion.div
    initial={{ scale: 0, rotate: -180 }}
    animate={{ scale: 1, rotate: 0 }}
    transition={{ type: "spring", stiffness: 500, damping: 20 }}
    className="relative"
  >
    {/* Pulse effect */}
    <motion.div
      className="absolute inset-0 rounded-full"
      style={{ backgroundColor: color }}
      animate={{ 
        scale: [1, 1.6, 1.6],
        opacity: [0.4, 0, 0]
      }}
      transition={{ 
        duration: 1.2,
        repeat: Infinity,
        ease: "easeOut"
      }}
    />
    {children}
  </motion.div>
);

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-center"
      gap={12}
      toastOptions={{
        duration: 5000,
        classNames: {
          toast:
            "group toast group-[.toaster]:rounded-2xl group-[.toaster]:shadow-2xl group-[.toaster]:px-5 group-[.toaster]:py-4 group-[.toaster]:gap-4 group-[.toaster]:animate-in group-[.toaster]:slide-in-from-bottom-5 group-[.toaster]:fade-in-0 group-[.toaster]:duration-300 group-[.toaster]:backdrop-blur-2xl group-[.toaster]:border",
          description: "group-[.toast]:text-white/60 group-[.toast]:text-sm",
          actionButton: "group-[.toast]:bg-white/10 group-[.toast]:text-white group-[.toast]:rounded-xl group-[.toast]:font-medium group-[.toast]:border group-[.toast]:border-white/10 group-[.toast]:hover:bg-white/20 group-[.toast]:transition-all group-[.toast]:duration-200 group-[.toast]:hover:scale-[1.02]",
          cancelButton: "group-[.toast]:bg-white/5 group-[.toast]:text-white/70 group-[.toast]:rounded-xl group-[.toast]:hover:bg-white/10 group-[.toast]:transition-all group-[.toast]:duration-200",
          success: "group-[.toaster]:bg-gradient-to-br group-[.toaster]:from-emerald-950/95 group-[.toaster]:via-emerald-900/90 group-[.toaster]:to-slate-950/95 group-[.toaster]:border-emerald-500/30 group-[.toaster]:shadow-[0_0_40px_rgba(16,185,129,0.3),0_0_80px_rgba(16,185,129,0.15),0_25px_50px_-12px_rgba(0,0,0,0.8)] group-[.toaster]:text-emerald-50",
          error: "group-[.toaster]:bg-gradient-to-br group-[.toaster]:from-rose-950/95 group-[.toaster]:via-rose-900/90 group-[.toaster]:to-slate-950/95 group-[.toaster]:border-rose-500/30 group-[.toaster]:shadow-[0_0_40px_rgba(244,63,94,0.3),0_0_80px_rgba(244,63,94,0.15),0_25px_50px_-12px_rgba(0,0,0,0.8)] group-[.toaster]:text-rose-50",
          warning: "group-[.toaster]:bg-gradient-to-br group-[.toaster]:from-amber-950/95 group-[.toaster]:via-amber-900/90 group-[.toaster]:to-slate-950/95 group-[.toaster]:border-amber-500/30 group-[.toaster]:shadow-[0_0_40px_rgba(245,158,11,0.3),0_0_80px_rgba(245,158,11,0.15),0_25px_50px_-12px_rgba(0,0,0,0.8)] group-[.toaster]:text-amber-50",
          info: "group-[.toaster]:bg-gradient-to-br group-[.toaster]:from-blue-950/95 group-[.toaster]:via-blue-900/90 group-[.toaster]:to-slate-950/95 group-[.toaster]:border-blue-500/30 group-[.toaster]:shadow-[0_0_40px_rgba(59,130,246,0.3),0_0_80px_rgba(59,130,246,0.15),0_25px_50px_-12px_rgba(0,0,0,0.8)] group-[.toaster]:text-blue-50",
          loading: "group-[.toaster]:bg-gradient-to-br group-[.toaster]:from-slate-900/95 group-[.toaster]:via-slate-800/90 group-[.toaster]:to-slate-950/95 group-[.toaster]:border-white/10 group-[.toaster]:shadow-[0_0_40px_rgba(148,163,184,0.2),0_25px_50px_-12px_rgba(0,0,0,0.8)] group-[.toaster]:text-white",
          title: "group-[.toast]:text-white group-[.toast]:font-semibold group-[.toast]:tracking-tight group-[.toast]:text-sm",
          icon: "group-[.toast]:[&>svg]:h-5 group-[.toast]:[&>svg]:w-5",
          closeButton: "group-[.toast]:bg-white/5 group-[.toast]:border-white/10 group-[.toast]:text-white/50 group-[.toast]:hover:bg-white/10 group-[.toast]:hover:text-white/80 group-[.toast]:transition-all group-[.toast]:rounded-lg",
        },
      }}
      icons={{
        success: (
          <AnimatedIcon color="rgba(16, 185, 129, 0.4)">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
          </AnimatedIcon>
        ),
        error: (
          <AnimatedIcon color="rgba(244, 63, 94, 0.4)">
            <XCircle className="h-5 w-5 text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
          </AnimatedIcon>
        ),
        warning: (
          <AnimatedIcon color="rgba(245, 158, 11, 0.4)">
            <AlertTriangle className="h-5 w-5 text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
          </AnimatedIcon>
        ),
        info: (
          <AnimatedIcon color="rgba(59, 130, 246, 0.4)">
            <Info className="h-5 w-5 text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
          </AnimatedIcon>
        ),
        loading: (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <Loader2 className="h-5 w-5 text-white/60" />
          </motion.div>
        ),
      }}
      {...props}
    />
  );
};

// Enhanced toast helper with consistent styling
const premiumToast = {
  success: (message: string, options?: Parameters<typeof toast.success>[1]) => 
    toast.success(message, { 
      ...options,
      className: "premium-toast-success",
    }),
  error: (message: string, options?: Parameters<typeof toast.error>[1]) => 
    toast.error(message, { 
      ...options,
      className: "premium-toast-error",
    }),
  warning: (message: string, options?: Parameters<typeof toast.warning>[1]) => 
    toast.warning(message, { 
      ...options,
      className: "premium-toast-warning",
    }),
  info: (message: string, options?: Parameters<typeof toast.info>[1]) => 
    toast.info(message, { 
      ...options,
      className: "premium-toast-info",
    }),
  loading: (message: string, options?: Parameters<typeof toast.loading>[1]) => 
    toast.loading(message, { 
      ...options,
      className: "premium-toast-loading",
    }),
  epic: (message: string, description?: string) => 
    toast(message, {
      description,
      duration: 7000,
      icon: (
        <motion.div
          animate={{ 
            rotate: [0, 15, -15, 0],
            scale: [1, 1.2, 1]
          }}
          transition={{ 
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          <Sparkles className="h-5 w-5 text-violet-400 drop-shadow-[0_0_8px_rgba(139,92,246,0.6)]" />
        </motion.div>
      ),
      className: "premium-toast-epic bg-gradient-to-br from-violet-950/95 via-fuchsia-900/90 to-slate-950/95 border-violet-500/30 shadow-[0_0_40px_rgba(139,92,246,0.3),0_0_80px_rgba(139,92,246,0.15),0_25px_50px_-12px_rgba(0,0,0,0.8)] text-violet-50",
    }),
  promise: toast.promise,
  dismiss: toast.dismiss,
  custom: toast.custom,
};

export { Toaster, toast, premiumToast };
