import * as React from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const AlertDialog = AlertDialogPrimitive.Root;

const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

const AlertDialogPortal = AlertDialogPrimitive.Portal;

const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/90 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
    ref={ref}
  />
));
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content
      ref={ref}
      className={cn(
        // Centred via auto-margins so the zoom animation can't clobber the
        // centring transform. Compact, premium confirm — not a wide bar.
        "fixed inset-0 z-50 m-auto grid h-fit w-[calc(100vw-2rem)] max-w-[400px] gap-4 overflow-hidden p-6 duration-300",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        "rounded-[26px] border border-white/[0.07] bg-[#0a0b10]/95 backdrop-blur-2xl",
        className,
      )}
      style={{
        boxShadow:
          '0 0 0 1px rgba(255,255,255,0.03) inset, 0 1px 0 rgba(255,255,255,0.06) inset, 0 40px 120px -30px rgba(0,0,0,0.95)',
      }}
      {...props}
    >
      {/* Ambient top glow — cinematic, subtle. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 left-1/2 h-44 w-44 -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, hsl(var(--accent) / 0.16), transparent 70%)' }}
      />
      {/* Top accent line. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      {children}
    </AlertDialogPrimitive.Content>
  </AlertDialogPortal>
));
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;

/**
 * Premium icon badge — a glowing rounded mark that sits above the title.
 * `tone="destructive"` shifts the glow to the destructive hue.
 */
function AlertDialogIcon({
  children,
  tone = 'default',
  className,
}: {
  children: React.ReactNode;
  tone?: 'default' | 'destructive';
  className?: string;
}) {
  const glow = tone === 'destructive' ? 'hsl(var(--destructive) / 0.7)' : 'hsl(var(--accent) / 0.6)';
  return (
    <div
      className={cn(
        'relative mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.05] ring-1 ring-inset ring-white/10',
        tone === 'destructive' && 'text-destructive-foreground',
        className,
      )}
    >
      <span aria-hidden className="absolute inset-0 rounded-xl" style={{ boxShadow: `0 0 32px -10px ${glow}` }} />
      <span className={cn('relative flex items-center justify-center', tone === 'destructive' ? 'text-rose-300' : 'text-white')}>
        {children}
      </span>
    </div>
  );
}

// Layout components - NO forwardRef needed (pure styling, never used with asChild)
function AlertDialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-1.5 text-center", className)} {...props} />;
}

function AlertDialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("grid grid-cols-1 gap-2.5 sm:grid-cols-2", className)} {...props} />;
}

const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title ref={ref} className={cn("font-display text-[18px] font-semibold leading-tight tracking-[-0.01em] text-white", className)} {...props} />
));
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;

const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description ref={ref} className={cn("mx-auto max-w-[20rem] text-[13.5px] leading-relaxed text-white/55", className)} {...props} />
));
AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName;

const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Action
    ref={ref}
    className={cn(
      "inline-flex h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-[13.5px] font-semibold transition-all duration-200",
      "bg-white text-[#0a0b10] hover:-translate-y-0.5 hover:bg-white/90",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
      "disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60",
      className
    )}
    {...props}
  />
));
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName;

const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel
    ref={ref}
    className={cn(
      "inline-flex h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-[13.5px] font-medium transition-all duration-200",
      "border-0 bg-white/[0.05] text-white/80 hover:bg-white/[0.1] hover:text-white",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
      "disabled:cursor-not-allowed disabled:opacity-60",
      className
    )}
    {...props}
  />
));
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName;

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogIcon,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
