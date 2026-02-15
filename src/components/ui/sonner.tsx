import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";
import { CheckCircle2, XCircle, AlertTriangle, Info, Loader2, Sparkles, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { forwardRef } from "react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

interface AnimatedIconProps {
  children: React.ReactNode;
  glowColor: string;
}

// Animated icon wrapper with pulse effect
const AnimatedIcon = forwardRef<HTMLDivElement, AnimatedIconProps>(({ children, glowColor }, ref) => (
  <motion.div
    ref={ref}
    initial={{ scale: 0, rotate: -180 }}
    animate={{ scale: 1, rotate: 0 }}
    transition={{ type: "spring", stiffness: 500, damping: 20 }}
    className="relative"
  >
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
            "group toast group-[.toaster]:rounded-2xl group-[.toaster]:px-5 group-[.toaster]:py-4 group-[.toaster]:gap-4 group-[.toaster]:animate-in group-[.toaster]:slide-in-from-bottom-5 group-[.toaster]:fade-in-0 group-[.toaster]:duration-300 group-[.toaster]:backdrop-blur-2xl group-[.toaster]:border group-[.toaster]:bg-[hsl(250,15%,6%)/0.97] group-[.toaster]:border-white/[0.08] group-[.toaster]:min-w-[360px] group-[.toaster]:max-w-[480px]",
          description: "group-[.toast]:text-white/50 group-[.toast]:text-sm group-[.toast]:leading-relaxed",
          actionButton: "group-[.toast]:bg-[hsl(263,70%,58%)] group-[.toast]:text-white group-[.toast]:rounded-full group-[.toast]:font-medium group-[.toast]:px-5 group-[.toast]:py-2 group-[.toast]:text-xs group-[.toast]:tracking-wide group-[.toast]:uppercase group-[.toast]:hover:bg-[hsl(263,70%,65%)] group-[.toast]:transition-all group-[.toast]:duration-200 group-[.toast]:shadow-[0_0_20px_rgba(124,58,237,0.3)]",
          cancelButton: "group-[.toast]:bg-white/[0.06] group-[.toast]:text-white/70 group-[.toast]:rounded-full group-[.toast]:border group-[.toast]:border-white/[0.08] group-[.toast]:hover:bg-white/10 group-[.toast]:transition-all group-[.toast]:duration-200",
          success: "group-[.toaster]:bg-[hsl(250,15%,6%)/0.97] group-[.toaster]:border-emerald-500/25 group-[.toaster]:shadow-[0_0_40px_rgba(16,185,129,0.12),0_0_80px_rgba(16,185,129,0.04),0_20px_40px_-12px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(16,185,129,0.1)] group-[.toaster]:text-white",
          error: "group-[.toaster]:bg-[hsl(250,15%,6%)/0.97] group-[.toaster]:border-red-500/25 group-[.toaster]:shadow-[0_0_40px_rgba(239,68,68,0.12),0_0_80px_rgba(239,68,68,0.04),0_20px_40px_-12px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(239,68,68,0.1)] group-[.toaster]:text-white",
          warning: "group-[.toaster]:bg-[hsl(250,15%,6%)/0.97] group-[.toaster]:border-amber-500/25 group-[.toaster]:shadow-[0_0_40px_rgba(245,158,11,0.12),0_0_80px_rgba(245,158,11,0.04),0_20px_40px_-12px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(245,158,11,0.1)] group-[.toaster]:text-white",
          info: "group-[.toaster]:bg-[hsl(250,15%,6%)/0.97] group-[.toaster]:border-[hsl(263,70%,58%)]/20 group-[.toaster]:shadow-[0_0_40px_rgba(124,58,237,0.08),0_20px_40px_-12px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(124,58,237,0.08)] group-[.toaster]:text-white",
          loading: "group-[.toaster]:bg-[hsl(250,15%,6%)/0.97] group-[.toaster]:border-white/[0.08] group-[.toaster]:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.05)] group-[.toaster]:text-white",
          title: "group-[.toast]:text-white group-[.toast]:font-semibold group-[.toast]:tracking-tight group-[.toast]:text-[14px]",
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
          <AnimatedIcon glowColor="rgba(124, 58, 237, 0.3)">
            <Info className="h-5 w-5 text-[hsl(263,70%,68%)]" style={{ filter: 'drop-shadow(0 0 6px rgba(124, 58, 237, 0.4))' }} />
          </AnimatedIcon>
        ),
        loading: (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <Loader2 className="h-5 w-5 text-[hsl(263,70%,58%)]" style={{ filter: 'drop-shadow(0 0 4px rgba(124, 58, 237, 0.3))' }} />
          </motion.div>
        ),
      }}
      {...props}
    />
  );
};

// Premium toast helper matching Studio Dark aesthetic
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
          <Sparkles className="h-5 w-5 text-[hsl(263,70%,68%)]" style={{ filter: 'drop-shadow(0 0 10px rgba(124, 58, 237, 0.6))' }} />
        </motion.div>
      ),
      className: "bg-[hsl(250,15%,6%)/0.97] border-[hsl(263,70%,58%)]/30 shadow-[0_0_60px_rgba(124,58,237,0.15),0_0_120px_rgba(124,58,237,0.05),0_20px_40px_-12px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(124,58,237,0.12)] text-white",
    }),
  promise: toast.promise,
  dismiss: toast.dismiss,
  custom: toast.custom,
};

export { Toaster, toast, premiumToast };
