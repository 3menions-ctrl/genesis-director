import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:rounded-2xl group-[.toaster]:backdrop-blur-xl group-[.toaster]:shadow-xl group-[.toaster]:border",
          description: "group-[.toast]:text-sm group-[.toast]:opacity-80",
          actionButton: "group-[.toast]:bg-foreground group-[.toast]:text-background group-[.toast]:rounded-xl group-[.toast]:font-medium",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-xl",
          success: "group-[.toaster]:bg-[hsl(145_50%_97%/0.95)] group-[.toaster]:text-[hsl(145_55%_28%)] group-[.toaster]:border-[hsl(145_45%_75%/0.5)]",
          error: "group-[.toaster]:bg-[hsl(0_50%_97%/0.95)] group-[.toaster]:text-[hsl(0_55%_35%)] group-[.toaster]:border-[hsl(0_45%_80%/0.5)]",
          warning: "group-[.toaster]:bg-[hsl(38_60%_97%/0.95)] group-[.toaster]:text-[hsl(30_60%_32%)] group-[.toaster]:border-[hsl(38_50%_75%/0.5)]",
          info: "group-[.toaster]:bg-[hsl(210_50%_97%/0.95)] group-[.toaster]:text-[hsl(210_55%_35%)] group-[.toaster]:border-[hsl(210_45%_80%/0.5)]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
