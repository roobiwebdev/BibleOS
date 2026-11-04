import { ExternalLink } from "lucide-react";

import type { PlatformId } from "../config";
import { COPY } from "../copy";
import { InstallVisualPicture } from "./install-visuals";

/**
 * SOURCE OF TRUTH KEYWORDS: InstallSteps, numbered install steps, install pictures, terminal commands
 * WHAT:  The numbered install steps for one platform, each with its picture, shortcut link or
 *        terminal command.
 * WHY:   The install guide section and the dialog shown after a download must give the same
 *        steps; both render this, from COPY.install.
 * WHERE: sections/install.tsx and components/next-steps-dialog.tsx.
 */
export function InstallSteps({ platform, compact = false }: { platform: PlatformId; compact?: boolean }) {
  const guide = COPY.install.platforms[platform];
  return (
    <ol className={`flex flex-col ${compact ? "gap-4" : "gap-6"}`}>
      {guide.steps.map((step, i) => (
        <li key={step.text} className="flex gap-4">
          <span className="tabular grid size-7 shrink-0 place-items-center rounded-full bg-accent text-[13px] font-semibold text-accent-foreground">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-[15.5px] leading-relaxed">{step.text}</p>
            {"visual" in step && step.visual && <InstallVisualPicture visual={step.visual} />}
            {"action" in step && step.action && (
              <a
                href={step.action.href}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full border bg-card px-3.5 py-1.5 text-[13.5px] font-medium transition-colors hover:bg-muted"
              >
                {step.action.label}
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            )}
            {"command" in step && step.command && (
              <pre className="mt-2 overflow-x-auto rounded-lg bg-muted px-3.5 py-2.5 font-mono text-[13px] leading-relaxed">
                <code>{step.command}</code>
              </pre>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
