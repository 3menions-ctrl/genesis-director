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
  "group pointer-events-auto relative flex w-full items-center justify-between gap-4 overflow-hidden rounded-2xl p-5 pr-12 backdrop-blur-2xl border transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-bottom-full bg-black/95",
  {
    variants: {
      variant: {
        default: "border-white/[0.08] text-white shadow-[0_0_50px_rgba(255,255,255,0.05),0_25px_50px_-12px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.05)]",
        destructive: "border-red-500/20 text-white shadow-[0_0_50px_rgba(239,68,68,0.15),0_0_100px_rgba(239,68,68,0.05),0_25px_50px_-12px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.05)]",
        success: "border-emerald-500/20 text-white shadow-[0_0_50px_rgba(16,185,129,0.15),0_0_100px_rgba(16,185,129,0.05),0_25px_50px_-12px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.05)]",
        warning: "border-amber-500/20 text-white shadow-[0_0_50px_rgba(245,158,11,0.15),0_0_100px_rgba(245,158,11,0.05),0_25px_50px_-12px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.05)]",
        info: "border-white/[0.08] text-white shadow-[0_0_50px_rgba(255,255,255,0.05),0_25px_50px_-12px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.05)]",
        epic: "border-white/[0.12] text-white shadow-[0_0_60px_rgba(255,255,255,0.1),0_25px_50px_-12px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const variantIcons: Record<string, React.ReactNode> = {
  default: <Info className="h-5 w-5 text-white/60" style={{ filter: 'drop-shadow(0 0 6px rgba(255, 255, 255, 0.3))' }} />,
  destructive: <XCircle className="h-5 w-5 text-red-400" style={{ filter: 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.5))' }} />,
  success: <CheckCircle2 className="h-5 w-5 text-emerald-400" style={{ filter: 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.5))' }} />,
  warning: <AlertTriangle className="h-5 w-5 text-amber-400" style={{ filter: 'drop-shadow(0 0 8px rgba(245, 158, 11, 0.5))' }} />,
  info: <Info className="h-5 w-5 text-white/60" style={{ filter: 'drop-shadow(0 0 6px rgba(255, 255, 255, 0.3))' }} />,
  epic: <Sparkles className="h-5 w-5 text-white" style={{ filter: 'drop-shadow(0 0 10px rgba(255, 255, 255, 0.6))' }} />,
};

const variantGlows: Record<string, string> = {
  default: "rgba(255, 255, 255, 0.03)",
  destructive: "rgba(239, 68, 68, 0.08)",
  success: "rgba(16, 185, 129, 0.08)",
  warning: "rgba(245, 158, 11, 0.08)",
  info: "rgba(255, 255, 255, 0.03)",
  epic: "rgba(255, 255, 255, 0.06)",
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
      {/* Subtle gradient overlay */}
      <div 
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{ 
          background: `linear-gradient(135deg, ${variantGlows[variant || 'default']} 0%, transparent 50%)` 
        }}
      />
      
      {/* Top shine line */}
      <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />

      {/* Icon with animation */}
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
      "inline-flex h-8 shrink-0 items-center justify-center rounded-full px-4 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:pointer-events-none disabled:opacity-50",
      "bg-white text-black hover:bg-white/90",
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
      "absolute right-4 top-4 rounded-full p-1.5 opacity-50 transition-all duration-200 hover:opacity-100 focus:opacity-100 focus:outline-none",
      "text-white/50 hover:text-white hover:bg-white/[0.06]",
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
  <ToastPrimitives.Title ref={ref} className={cn("text-sm font-medium tracking-tight text-white", className)} {...props} />
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description ref={ref} className={cn("text-sm text-white/50 mt-1", className)} {...props} />
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
