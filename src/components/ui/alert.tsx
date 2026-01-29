import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { CheckCircle2, XCircle, AlertTriangle, Info, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-2xl border p-5 backdrop-blur-2xl overflow-hidden [&>svg~*]:pl-10 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-5 [&>svg]:top-5",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-br from-slate-900/95 via-slate-800/90 to-slate-950/95 text-white border-white/10 shadow-[0_0_30px_rgba(148,163,184,0.1),0_20px_40px_-12px_rgba(0,0,0,0.6)] [&>svg]:text-white/70",
        destructive: "bg-gradient-to-br from-rose-950/95 via-rose-900/90 to-slate-950/95 text-rose-50 border-rose-500/30 shadow-[0_0_40px_rgba(244,63,94,0.2),0_20px_40px_-12px_rgba(0,0,0,0.6)] [&>svg]:text-rose-400 [&>svg]:drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]",
        success: "bg-gradient-to-br from-emerald-950/95 via-emerald-900/90 to-slate-950/95 text-emerald-50 border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.2),0_20px_40px_-12px_rgba(0,0,0,0.6)] [&>svg]:text-emerald-400 [&>svg]:drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]",
        warning: "bg-gradient-to-br from-amber-950/95 via-amber-900/90 to-slate-950/95 text-amber-50 border-amber-500/30 shadow-[0_0_40px_rgba(245,158,11,0.2),0_20px_40px_-12px_rgba(0,0,0,0.6)] [&>svg]:text-amber-400 [&>svg]:drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]",
        info: "bg-gradient-to-br from-blue-950/95 via-blue-900/90 to-slate-950/95 text-blue-50 border-blue-500/30 shadow-[0_0_40px_rgba(59,130,246,0.2),0_20px_40px_-12px_rgba(0,0,0,0.6)] [&>svg]:text-blue-400 [&>svg]:drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]",
        epic: "bg-gradient-to-br from-violet-950/95 via-fuchsia-900/90 to-slate-950/95 text-violet-50 border-violet-500/40 shadow-[0_0_50px_rgba(139,92,246,0.3),0_20px_40px_-12px_rgba(0,0,0,0.6)] [&>svg]:text-violet-400 [&>svg]:drop-shadow-[0_0_12px_rgba(139,92,246,0.6)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const variantIcons: Record<string, React.ReactNode> = {
  default: <Info className="h-5 w-5" />,
  destructive: <XCircle className="h-5 w-5" />,
  success: <CheckCircle2 className="h-5 w-5" />,
  warning: <AlertTriangle className="h-5 w-5" />,
  info: <Info className="h-5 w-5" />,
  epic: <Sparkles className="h-5 w-5" />,
};

const variantGlows: Record<string, string> = {
  default: "rgba(148, 163, 184, 0.15)",
  destructive: "rgba(244, 63, 94, 0.2)",
  success: "rgba(16, 185, 129, 0.2)",
  warning: "rgba(245, 158, 11, 0.2)",
  info: "rgba(59, 130, 246, 0.2)",
  epic: "rgba(139, 92, 246, 0.3)",
};

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants> & { showIcon?: boolean }
>(({ className, variant = "default", showIcon = true, children, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  >
    {/* Animated glow overlay */}
    <div 
      className="absolute inset-0 rounded-2xl pointer-events-none animate-pulse"
      style={{ 
        background: `radial-gradient(ellipse at top left, ${variantGlows[variant || 'default']}, transparent 60%)` 
      }}
    />
    
    {/* Shine effect */}
    <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] via-transparent to-transparent" />
    </div>
    
    {showIcon && variantIcons[variant || 'default']}
    <div className="relative z-10">{children}</div>
  </div>
));
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5 ref={ref} className={cn("mb-1.5 font-semibold leading-none tracking-tight", className)} {...props} />
  ),
);
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm opacity-80 [&_p]:leading-relaxed", className)} {...props} />
  ),
);
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };
