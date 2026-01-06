import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-center"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-black/80 group-[.toaster]:backdrop-blur-2xl group-[.toaster]:border-white/10 group-[.toaster]:text-white group-[.toaster]:rounded-2xl group-[.toaster]:shadow-2xl group-[.toaster]:shadow-black/40 group-[.toaster]:px-5 group-[.toaster]:py-4",
          description: "group-[.toast]:text-white/60 group-[.toast]:text-sm",
          actionButton: "group-[.toast]:bg-white group-[.toast]:text-black group-[.toast]:rounded-xl group-[.toast]:font-semibold group-[.toast]:hover:bg-white/90",
          cancelButton: "group-[.toast]:bg-white/10 group-[.toast]:text-white/70 group-[.toast]:rounded-xl group-[.toast]:hover:bg-white/20",
          success: "group-[.toaster]:bg-black/80 group-[.toaster]:text-white group-[.toaster]:border-emerald-500/30 group-[.toaster]:[&>svg]:text-emerald-400",
          error: "group-[.toaster]:bg-black/80 group-[.toaster]:text-white group-[.toaster]:border-red-500/30 group-[.toaster]:[&>svg]:text-red-400",
          warning: "group-[.toaster]:bg-black/80 group-[.toaster]:text-white group-[.toaster]:border-amber-500/30 group-[.toaster]:[&>svg]:text-amber-400",
          info: "group-[.toaster]:bg-black/80 group-[.toaster]:text-white group-[.toaster]:border-blue-500/30 group-[.toaster]:[&>svg]:text-blue-400",
          title: "group-[.toast]:text-white group-[.toast]:font-medium",
          icon: "group-[.toast]:text-white/70",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
