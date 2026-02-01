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

// Animated icon wrapper with pulse effect - forwardRef to prevent Sonner ref warnings
const AnimatedIcon = forwardRef<HTMLDivElement, AnimatedIconProps>(({ children, glowColor }, ref) => (
  <motion.div
    ref={ref}
    initial={{ scale: 0, rotate: -180 }}
    animate={{ scale: 1, rotate: 0 }}
    transition={{ type: "spring", stiffness: 500, damping: 20 }}
    className="relative"
  >
    {/* Pulse ring */}
    <motion.div
      className="absolute inset-0 rounded-full"
      style={{ backgroundColor: glowColor }}
      animate={{ 
        scale: [1, 1.8, 1.8],
        opacity: [0.5, 0, 0]
      }}
      transition={{ 
        duration: 1.5,
        repeat: Infinity,
        ease: "easeOut"
      }}
    />
    {children}
  </motion.div>
));

AnimatedIcon.displayName = 'AnimatedIcon';

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
            "group toast group-[.toaster]:rounded-2xl group-[.toaster]:px-5 group-[.toaster]:py-4 group-[.toaster]:gap-4 group-[.toaster]:animate-in group-[.toaster]:slide-in-from-bottom-5 group-[.toaster]:fade-in-0 group-[.toaster]:duration-300 group-[.toaster]:backdrop-blur-2xl group-[.toaster]:border group-[.toaster]:bg-black/95 group-[.toaster]:border-white/[0.08]",
          description: "group-[.toast]:text-white/50 group-[.toast]:text-sm",
          actionButton: "group-[.toast]:bg-white group-[.toast]:text-black group-[.toast]:rounded-full group-[.toast]:font-medium group-[.toast]:px-4 group-[.toast]:hover:bg-white/90 group-[.toast]:transition-all group-[.toast]:duration-200",
          cancelButton: "group-[.toast]:bg-white/[0.06] group-[.toast]:text-white/70 group-[.toast]:rounded-full group-[.toast]:border group-[.toast]:border-white/[0.08] group-[.toast]:hover:bg-white/10 group-[.toast]:transition-all group-[.toast]:duration-200",
          success: "group-[.toaster]:bg-black/95 group-[.toaster]:border-emerald-500/20 group-[.toaster]:shadow-[0_0_50px_rgba(16,185,129,0.15),0_0_100px_rgba(16,185,129,0.05),0_25px_50px_-12px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.05)] group-[.toaster]:text-white",
          error: "group-[.toaster]:bg-black/95 group-[.toaster]:border-red-500/20 group-[.toaster]:shadow-[0_0_50px_rgba(239,68,68,0.15),0_0_100px_rgba(239,68,68,0.05),0_25px_50px_-12px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.05)] group-[.toaster]:text-white",
          warning: "group-[.toaster]:bg-black/95 group-[.toaster]:border-amber-500/20 group-[.toaster]:shadow-[0_0_50px_rgba(245,158,11,0.15),0_0_100px_rgba(245,158,11,0.05),0_25px_50px_-12px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.05)] group-[.toaster]:text-white",
          info: "group-[.toaster]:bg-black/95 group-[.toaster]:border-white/[0.08] group-[.toaster]:shadow-[0_0_50px_rgba(255,255,255,0.05),0_25px_50px_-12px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.05)] group-[.toaster]:text-white",
          loading: "group-[.toaster]:bg-black/95 group-[.toaster]:border-white/[0.08] group-[.toaster]:shadow-[0_0_50px_rgba(255,255,255,0.05),0_25px_50px_-12px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.05)] group-[.toaster]:text-white",
          title: "group-[.toast]:text-white group-[.toast]:font-medium group-[.toast]:tracking-tight group-[.toast]:text-sm",
          icon: "group-[.toast]:[&>svg]:h-5 group-[.toast]:[&>svg]:w-5",
          closeButton: "group-[.toast]:bg-white/[0.03] group-[.toast]:border-white/[0.06] group-[.toast]:text-white/40 group-[.toast]:hover:bg-white/[0.08] group-[.toast]:hover:text-white/70 group-[.toast]:transition-all group-[.toast]:rounded-full",
        },
      }}
      icons={{
        success: (
          <AnimatedIcon glowColor="rgba(16, 185, 129, 0.3)">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" style={{ filter: 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.5))' }} />
          </AnimatedIcon>
        ),
        error: (
          <AnimatedIcon glowColor="rgba(239, 68, 68, 0.3)">
            <XCircle className="h-5 w-5 text-red-400" style={{ filter: 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.5))' }} />
          </AnimatedIcon>
        ),
        warning: (
          <AnimatedIcon glowColor="rgba(245, 158, 11, 0.3)">
            <AlertTriangle className="h-5 w-5 text-amber-400" style={{ filter: 'drop-shadow(0 0 8px rgba(245, 158, 11, 0.5))' }} />
          </AnimatedIcon>
        ),
        info: (
          <AnimatedIcon glowColor="rgba(255, 255, 255, 0.2)">
            <Info className="h-5 w-5 text-white/70" style={{ filter: 'drop-shadow(0 0 6px rgba(255, 255, 255, 0.3))' }} />
          </AnimatedIcon>
        ),
        loading: (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <Loader2 className="h-5 w-5 text-white/50" />
          </motion.div>
        ),
      }}
      {...props}
    />
  );
};

// Premium toast helper matching landing page aesthetic
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
      duration: 7000,
      icon: (
        <motion.div
          animate={{ 
            rotate: [0, 15, -15, 0],
            scale: [1, 1.15, 1]
          }}
          transition={{ 
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          <Sparkles className="h-5 w-5 text-white" style={{ filter: 'drop-shadow(0 0 8px rgba(255, 255, 255, 0.5))' }} />
        </motion.div>
      ),
      className: "bg-black/95 border-white/[0.12] shadow-[0_0_60px_rgba(255,255,255,0.1),0_25px_50px_-12px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08)] text-white",
    }),
  promise: toast.promise,
  dismiss: toast.dismiss,
  custom: toast.custom,
};

export { Toaster, toast, premiumToast };
