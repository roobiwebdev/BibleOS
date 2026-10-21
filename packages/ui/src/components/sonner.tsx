import type { ToasterProps } from "sonner";

import {
  CheckmarkCircle02Icon as CircleCheckIcon,
  InformationCircleIcon as InfoIcon,
  Loading03Icon as Loader2Icon,
  AlertCircleIcon as OctagonXIcon,
  Alert02Icon as TriangleAlertIcon,
} from "@hugeicons/react";
import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-3.5" />,
        info: <InfoIcon className="size-3.5" />,
        warning: <TriangleAlertIcon className="size-3.5" />,
        error: <OctagonXIcon className="size-3.5" />,
        loading: <Loader2Icon className="size-3.5 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast: "!bg-card !text-card-foreground !border-border !rounded-none !shadow-sm !font-sans",
          title: "!text-xs !font-semibold !tracking-tight",
          description: "!text-[10px] !text-muted-foreground",
          icon: "!text-foreground",
          actionButton: "!bg-foreground !text-background !rounded-none !text-[10px] !font-semibold !h-7 !px-2.5",
          cancelButton:
            "!bg-transparent !text-muted-foreground !border !border-border !rounded-none !text-[10px] !font-semibold !h-7 !px-2.5",
          closeButton: "!bg-transparent !text-muted-foreground !border-border !rounded-none",
          success: "!border-foreground/20",
          error: "!border-foreground/20",
          warning: "!border-foreground/20",
          info: "!border-foreground/20",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
