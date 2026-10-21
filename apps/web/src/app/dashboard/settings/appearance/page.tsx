"use client";
/** Appearance settings: light / dark / system color scheme (stored by next-themes). */

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const noopSubscribe = () => () => {};

const themes = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
] as const;

export default function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  // false during SSR and hydration, true afterwards: avoids a highlighted-theme mismatch.
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  return (
    <div className="max-w-md">
      <div className="mb-3 pb-2 border-b border-border/30">
        <h3 className="text-xs font-semibold">Theme</h3>
        <p className="text-[10px] text-muted-foreground/50 mt-0.5">Select your preferred color scheme.</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {themes.map((t) => {
          const isActive = mounted && theme === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={cn(
                "flex flex-col items-center gap-2 border px-3 py-4 transition-colors cursor-pointer",
                isActive
                  ? "border-foreground/30 bg-foreground/5"
                  : "border-border/40 hover:border-border/70 hover:bg-muted/20",
              )}
            >
              <t.icon className={cn("h-4 w-4", isActive ? "text-foreground" : "text-muted-foreground/40")} />
              <span
                className={cn("text-[10px] font-medium", isActive ? "text-foreground" : "text-muted-foreground/50")}
              >
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
