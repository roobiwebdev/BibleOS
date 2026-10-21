"use client";

import { useEffect } from "react";
import { Button } from "@starter/ui/components/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-6 px-6">
        <div className="space-y-2">
          <h1 className="text-7xl font-bold tracking-tighter text-destructive/20">500</h1>
          <h2 className="text-xl font-semibold tracking-tight">Something went wrong</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            An unexpected error occurred. Our team has been notified.
          </p>
          {error.digest && <p className="text-[10px] text-muted-foreground/50 font-mono">Error ID: {error.digest}</p>}
        </div>
        <div className="flex items-center justify-center gap-3">
          <Button onClick={reset} size="sm">
            Try Again
          </Button>
          <Button variant="outline" size="sm" onClick={() => (window.location.href = "/")}>
            Go Home
          </Button>
        </div>
      </div>
    </div>
  );
}
