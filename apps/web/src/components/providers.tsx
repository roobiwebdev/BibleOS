"use client";

import { Toaster } from "@starter/ui/components/sonner";

import { TRPCReactProvider } from "@/lib/trpc/client";

import { ThemeProvider } from "./theme-provider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TRPCReactProvider>
        {children}
        <Toaster />
      </TRPCReactProvider>
    </ThemeProvider>
  );
}
