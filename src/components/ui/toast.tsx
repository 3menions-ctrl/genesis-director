import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";
import { X, CheckCircle2, XCircle, AlertTriangle, Info, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

const ToastProvider = ToastPrimitives.Provider;

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed bottom-0 left-1/2 -translate-x-1/2 z-[100] flex max-h-screen w-full flex-col p-4 sm:max-w-[420px]",
      className,
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between gap-4 overflow-hidden rounded-2xl p-5 pr-12 backdrop-blur-2xl border transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-bottom-full",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-br from-slate-900/95 via-slate-800/90 to-slate-950/95 border-white/10 text-white shadow-[0_0_30px_rgba(148,163,184,0.15),0_25px_50px_-12px_rgba(0,0,0,0.7)]",
        destructive: "bg-gradient-to-br from-rose-950/95 via-rose-900/90 to-slate-950/95 border-rose-500/30 text-rose-50 shadow-[0_0_40px_rgba(244,63,94,0.25),0_25px_50px_-12px_rgba(0,0,0,0.7)]",
        success: "bg-gradient-to-br from-emerald-950/95 via-emerald-900/90 to-slate-950/95 border-emerald-500/30 text-emerald-50 shadow-[0_0_40px_rgba(16,185,129,0.25),0_25px_50px_-12px_rgba(0,0,0,0.7)]",
        warning: "bg-gradient-to-br from-amber-950/95 via-amber-900/90 to-slate-950/95 border-amber-500/30 text-amber-50 shadow-[0_0_40px_rgba(245,158,11,0.25),0_25px_50px_-12px_rgba(0,0,0,0.7)]",
        info: "bg-gradient-to-br from-blue-950/95 via-blue-900/90 to-slate-950/95 border-blue-500/30 text-blue-50 shadow-[0_0_40px_rgba(59,130,246,0.25),0_25px_50px_-12px_rgba(0,0,0,0.7)]",
        epic: "bg-gradient-to-br from-violet-950/95 via-fuchsia-900/90 to-slate-950/95 border-violet-500/40 text-violet-50 shadow-[0_0_50px_rgba(139,92,246,0.35),0_25px_50px_-12px_rgba(0,0,0,0.7)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const variantIcons: Record<string, React.ReactNode> = {
  default: <Info className="h-5 w-5 text-white/70" />,
  destructive: <XCircle className="h-5 w-5 text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]" />,
  success: <CheckCircle2 className="h-5 w-5 text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]" />,
  warning: <AlertTriangle className="h-5 w-5 text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]" />,
  info: <Info className="h-5 w-5 text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]" />,
  epic: <Sparkles className="h-5 w-5 text-violet-400 drop-shadow-[0_0_8px_rgba(139,92,246,0.6)]" />,
};

const variantGlows: Record<string, string> = {
  default: "rgba(148, 163, 184, 0.1)",
  destructive: "rgba(244, 63, 94, 0.15)",
  success: "rgba(16, 185, 129, 0.15)",
  warning: "rgba(245, 158, 11, 0.15)",
  info: "rgba(59, 130, 246, 0.15)",
  epic: "rgba(139, 92, 246, 0.2)",
};

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> & VariantProps<typeof toastVariants>
>(({ className, variant = "default", children, ...props }, ref) => {
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    >
      {/* Animated glow overlay */}
      <motion.div 
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{ 
          background: `radial-gradient(ellipse at top left, ${variantGlows[variant || 'default']}, transparent 60%)` 
        }}
        animate={{ 
          opacity: [0.5, 0.8, 0.5]
        }}
        transition={{ 
          duration: 3, 
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      
      {/* Shine effect */}
      <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] via-transparent to-transparent" />
      </div>

      {/* Icon */}
      <motion.div 
        className="flex-shrink-0 relative z-10"
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 20, delay: 0.1 }}
      >
        {variantIcons[variant || 'default']}
      </motion.div>

      {/* Content */}
      <div className="relative z-10 flex-1">
        {children}
      </div>
    </ToastPrimitives.Root>
  );
});
Toast.displayName = ToastPrimitives.Root.displayName;

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-xl px-4 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:pointer-events-none disabled:opacity-50",
      "bg-white/10 text-white/90 hover:bg-white/20 border border-white/15 hover:border-white/25 hover:scale-[1.02]",
      className,
    )}
    {...props}
  />
));
ToastAction.displayName = ToastPrimitives.Action.displayName;

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-4 top-4 rounded-lg p-1.5 opacity-60 transition-all duration-200 hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-white/20",
      "text-white/60 hover:text-white hover:bg-white/10",
      className,
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title ref={ref} className={cn("text-sm font-semibold tracking-tight", className)} {...props} />
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description ref={ref} className={cn("text-sm opacity-70 mt-1", className)} {...props} />
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>;

type ToastActionElement = React.ReactElement<typeof ToastAction>;

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
};
