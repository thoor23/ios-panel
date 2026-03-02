import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="bottom-right"
      expand={false}
      richColors={false}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background/60 group-[.toaster]:backdrop-blur-2xl group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:border-border/20 group-[.toaster]:shadow-2xl group-[.toaster]:shadow-black/5 group-[.toaster]:rounded-2xl group-[.toaster]:px-5 group-[.toaster]:py-3.5",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-xs",
          title: "group-[.toast]:text-[13px] group-[.toast]:font-semibold group-[.toast]:tracking-tight",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-xl group-[.toast]:text-xs group-[.toast]:font-medium",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-xl group-[.toast]:text-xs",
          success: "group-[.toaster]:!bg-background/70 group-[.toaster]:!backdrop-blur-2xl group-[.toaster]:!border-success/15 group-[.toaster]:!text-foreground group-[.toaster]:![&>svg]:text-success",
          error: "group-[.toaster]:!bg-background/70 group-[.toaster]:!backdrop-blur-2xl group-[.toaster]:!border-destructive/15 group-[.toaster]:!text-foreground group-[.toaster]:![&>svg]:text-destructive",
          info: "group-[.toaster]:!bg-background/70 group-[.toaster]:!backdrop-blur-2xl group-[.toaster]:!border-primary/15 group-[.toaster]:!text-foreground group-[.toaster]:![&>svg]:text-primary",
          warning: "group-[.toaster]:!bg-background/70 group-[.toaster]:!backdrop-blur-2xl group-[.toaster]:!border-warning/15 group-[.toaster]:!text-foreground group-[.toaster]:![&>svg]:text-warning",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
