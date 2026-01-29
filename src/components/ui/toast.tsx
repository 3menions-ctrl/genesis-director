import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const ToastProvider = ToastPrimitives.Provider;

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]",
      className,
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-2xl p-5 pr-10 transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
  {
    variants: {
      variant: {
        default: "",
        destructive: "",
        success: "",
        warning: "",
        info: "",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const toastStyles: Record<string, React.CSSProperties> = {
  default: {
    background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(10, 15, 30, 0.99) 50%, rgba(20, 30, 50, 0.98) 100%)',
    border: '1px solid rgba(148, 163, 184, 0.2)',
    boxShadow: '0 0 30px rgba(59, 130, 246, 0.15), 0 0 60px rgba(59, 130, 246, 0.08), 0 20px 40px -12px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(24px)',
    color: '#e2e8f0',
  },
  destructive: {
    background: 'linear-gradient(135deg, rgba(30, 15, 20, 0.98) 0%, rgba(25, 10, 15, 0.99) 50%, rgba(35, 20, 25, 0.98) 100%)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    boxShadow: '0 0 30px rgba(239, 68, 68, 0.15), 0 0 60px rgba(239, 68, 68, 0.08), 0 20px 40px -12px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(24px)',
    color: '#fecaca',
  },
  success: {
    background: 'linear-gradient(135deg, rgba(15, 30, 25, 0.98) 0%, rgba(10, 25, 20, 0.99) 50%, rgba(20, 35, 30, 0.98) 100%)',
    border: '1px solid rgba(34, 197, 94, 0.3)',
    boxShadow: '0 0 30px rgba(34, 197, 94, 0.15), 0 0 60px rgba(34, 197, 94, 0.08), 0 20px 40px -12px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(24px)',
    color: '#bbf7d0',
  },
  warning: {
    background: 'linear-gradient(135deg, rgba(30, 25, 15, 0.98) 0%, rgba(25, 20, 10, 0.99) 50%, rgba(35, 30, 20, 0.98) 100%)',
    border: '1px solid rgba(251, 191, 36, 0.3)',
    boxShadow: '0 0 30px rgba(251, 191, 36, 0.15), 0 0 60px rgba(251, 191, 36, 0.08), 0 20px 40px -12px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(24px)',
    color: '#fef08a',
  },
  info: {
    background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(10, 20, 35, 0.99) 50%, rgba(20, 30, 50, 0.98) 100%)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    boxShadow: '0 0 30px rgba(59, 130, 246, 0.15), 0 0 60px rgba(59, 130, 246, 0.08), 0 20px 40px -12px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(24px)',
    color: '#bfdbfe',
  },
};

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> & VariantProps<typeof toastVariants>
>(({ className, variant = "default", style, ...props }, ref) => {
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      style={{ ...toastStyles[variant || "default"], ...style }}
      {...props}
    />
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
      "inline-flex h-8 shrink-0 items-center justify-center rounded-lg px-3 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:pointer-events-none disabled:opacity-50",
      "bg-white/10 text-white/90 hover:bg-white/20 border border-white/20",
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
      "absolute right-3 top-3 rounded-lg p-1.5 opacity-60 transition-all duration-200 hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50",
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
  <ToastPrimitives.Title ref={ref} className={cn("text-sm font-semibold text-white", className)} {...props} />
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description ref={ref} className={cn("text-sm text-white/70", className)} {...props} />
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
