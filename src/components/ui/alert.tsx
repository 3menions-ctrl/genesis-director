import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { CheckCircle2, XCircle, AlertTriangle, Info, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-2xl border p-5 backdrop-blur-2xl overflow-hidden [&>svg~*]:pl-10 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-5 [&>svg]:top-5 bg-black/95",
  {
    variants: {
      variant: {
        default: "border-white/[0.08] text-white shadow-[0_0_50px_rgba(255,255,255,0.05),0_20px_40px_-12px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.05)] [&>svg]:text-white/60",
        destructive: "border-red-500/20 text-white shadow-[0_0_50px_rgba(239,68,68,0.12),0_20px_40px_-12px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.05)] [&>svg]:text-red-400",
        success: "border-emerald-500/20 text-white shadow-[0_0_50px_rgba(16,185,129,0.12),0_20px_40px_-12px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.05)] [&>svg]:text-emerald-400",
        warning: "border-amber-500/20 text-white shadow-[0_0_50px_rgba(245,158,11,0.12),0_20px_40px_-12px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.05)] [&>svg]:text-amber-400",
        info: "border-white/[0.08] text-white shadow-[0_0_50px_rgba(255,255,255,0.05),0_20px_40px_-12px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.05)] [&>svg]:text-white/60",
        epic: "border-white/[0.12] text-white shadow-[0_0_60px_rgba(255,255,255,0.08),0_20px_40px_-12px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.08)] [&>svg]:text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const variantIcons: Record<string, React.ReactNode> = {
  default: <Info className="h-5 w-5" style={{ filter: 'drop-shadow(0 0 6px rgba(255, 255, 255, 0.3))' }} />,
  destructive: <XCircle className="h-5 w-5" style={{ filter: 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.5))' }} />,
  success: <CheckCircle2 className="h-5 w-5" style={{ filter: 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.5))' }} />,
  warning: <AlertTriangle className="h-5 w-5" style={{ filter: 'drop-shadow(0 0 8px rgba(245, 158, 11, 0.5))' }} />,
  info: <Info className="h-5 w-5" style={{ filter: 'drop-shadow(0 0 6px rgba(255, 255, 255, 0.3))' }} />,
  epic: <Sparkles className="h-5 w-5" style={{ filter: 'drop-shadow(0 0 10px rgba(255, 255, 255, 0.6))' }} />,
};

const variantGlows: Record<string, string> = {
  default: "rgba(255, 255, 255, 0.02)",
  destructive: "rgba(239, 68, 68, 0.06)",
  success: "rgba(16, 185, 129, 0.06)",
  warning: "rgba(245, 158, 11, 0.06)",
  info: "rgba(255, 255, 255, 0.02)",
  epic: "rgba(255, 255, 255, 0.05)",
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
    {/* Subtle gradient overlay */}
    <div 
      className="absolute inset-0 rounded-2xl pointer-events-none"
      style={{ 
        background: `linear-gradient(135deg, ${variantGlows[variant || 'default']} 0%, transparent 50%)` 
      }}
    />
    
    {/* Top shine line */}
    <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent pointer-events-none" />
    
    {showIcon && variantIcons[variant || 'default']}
    <div className="relative z-10">{children}</div>
  </div>
));
Alert.displayName = "Alert";

// Layout components - NO forwardRef needed (pure styling, never used with asChild)
function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h5 className={cn("mb-1.5 font-medium leading-none tracking-tight text-white", className)} {...props} />;
}

function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <div className={cn("text-sm text-white/50 [&_p]:leading-relaxed", className)} {...props} />;
}

export { Alert, AlertTitle, AlertDescription };
