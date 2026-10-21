/**
 * SOURCE OF TRUTH KEYWORDS: Loader, spinner, loading state, page loader
 * WHAT:  Centered spinner for full-area loading states.
 * WHERE: onboarding page and other client screens waiting on data.
 */
import { Loader2 } from "lucide-react";

export default function Loader() {
  return (
    <div className="flex h-full items-center justify-center pt-8">
      <Loader2 className="animate-spin" />
    </div>
  );
}
