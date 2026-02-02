import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/90 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  variant?: "default" | "fullscreen" | "sheet";
  hideCloseButton?: boolean;
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, variant = "default", hideCloseButton = false, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay className={variant === "fullscreen" ? "bg-black backdrop-blur-none" : undefined} />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // Fullscreen variant
        variant === "fullscreen" &&
          "fixed left-0 top-0 right-0 bottom-0 z-50 w-[100vw] h-[100dvh] min-h-[100vh] max-w-none max-h-none bg-black border-none p-0 m-0 rounded-none overflow-hidden duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        // Sheet variant (mobile bottom sheet)
        variant === "sheet" &&
          "fixed inset-x-0 bottom-0 z-50 w-full max-h-[90vh] rounded-t-2xl border-t border-white/[0.08] bg-black/95 backdrop-blur-2xl p-0 duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom overflow-hidden",
        // Default variant
        variant === "default" &&
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 p-6 duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-2xl bg-black/95 border border-white/[0.08] backdrop-blur-2xl",
        className,
      )}
      style={variant === "fullscreen" ? { width: '100vw', height: '100dvh', minHeight: '100vh' } : 
             variant === "sheet" ? {} : {
        boxShadow: '0 0 60px rgba(255, 255, 255, 0.05), 0 25px 50px -12px rgba(0, 0, 0, 0.9), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
      }}
      {...props}
    >
      {/* Top shine line */}
      {variant !== "fullscreen" && (
        <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent pointer-events-none" />
      )}
      {/* Sheet drag handle */}
      {variant === "sheet" && (
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-12 h-1 rounded-full bg-white/20" />
        </div>
      )}
      {children}
      {!hideCloseButton && (
        <DialogPrimitive.Close 
          className="absolute right-4 top-4 rounded-full p-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:pointer-events-none group text-white/40 hover:text-white hover:bg-white/[0.06]"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

// Layout components - NO forwardRef needed (pure styling, never used with asChild)
function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />;
}

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />;
}

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-medium leading-none tracking-tight text-white", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-white/50", className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
