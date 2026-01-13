import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";
import { CheckCircle2, XCircle, AlertTriangle, Info, Loader2 } from "lucide-react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-center"
      gap={12}
      toastOptions={{
        duration: 4000,
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-black/90 group-[.toaster]:backdrop-blur-2xl group-[.toaster]:border-white/10 group-[.toaster]:text-white group-[.toaster]:rounded-2xl group-[.toaster]:shadow-2xl group-[.toaster]:shadow-black/50 group-[.toaster]:px-5 group-[.toaster]:py-4 group-[.toaster]:gap-3 group-[.toaster]:animate-in group-[.toaster]:slide-in-from-bottom-5 group-[.toaster]:fade-in-0 group-[.toaster]:duration-300",
          description: "group-[.toast]:text-white/60 group-[.toast]:text-sm",
          actionButton: "group-[.toast]:bg-white group-[.toast]:text-black group-[.toast]:rounded-xl group-[.toast]:font-semibold group-[.toast]:hover:bg-white/90 group-[.toast]:transition-all group-[.toast]:duration-200 group-[.toast]:hover:scale-[1.02]",
          cancelButton: "group-[.toast]:bg-white/10 group-[.toast]:text-white/70 group-[.toast]:rounded-xl group-[.toast]:hover:bg-white/20 group-[.toast]:transition-all group-[.toast]:duration-200",
          success: "group-[.toaster]:border-emerald-500/30 group-[.toaster]:[&>svg]:text-emerald-400 group-[.toaster]:bg-gradient-to-r group-[.toaster]:from-black/90 group-[.toaster]:to-emerald-950/30",
          error: "group-[.toaster]:border-red-500/30 group-[.toaster]:[&>svg]:text-red-400 group-[.toaster]:bg-gradient-to-r group-[.toaster]:from-black/90 group-[.toaster]:to-red-950/30",
          warning: "group-[.toaster]:border-amber-500/30 group-[.toaster]:[&>svg]:text-amber-400 group-[.toaster]:bg-gradient-to-r group-[.toaster]:from-black/90 group-[.toaster]:to-amber-950/30",
          info: "group-[.toaster]:border-blue-500/30 group-[.toaster]:[&>svg]:text-blue-400 group-[.toaster]:bg-gradient-to-r group-[.toaster]:from-black/90 group-[.toaster]:to-blue-950/30",
          loading: "group-[.toaster]:border-white/20 group-[.toaster]:[&>svg]:text-white/60",
          title: "group-[.toast]:text-white group-[.toast]:font-semibold group-[.toast]:tracking-tight",
          icon: "group-[.toast]:text-white/70 group-[.toast]:[&>svg]:h-5 group-[.toast]:[&>svg]:w-5",
          closeButton: "group-[.toast]:bg-white/5 group-[.toast]:border-white/10 group-[.toast]:text-white/50 group-[.toast]:hover:bg-white/10 group-[.toast]:hover:text-white/80 group-[.toast]:transition-all",
        },
      }}
      icons={{
        success: <CheckCircle2 className="h-5 w-5 text-emerald-400" />,
        error: <XCircle className="h-5 w-5 text-red-400" />,
        warning: <AlertTriangle className="h-5 w-5 text-amber-400" />,
        info: <Info className="h-5 w-5 text-blue-400" />,
        loading: <Loader2 className="h-5 w-5 text-white/60 animate-spin" />,
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
  promise: toast.promise,
  dismiss: toast.dismiss,
  custom: toast.custom,
};

export { Toaster, toast, premiumToast };
