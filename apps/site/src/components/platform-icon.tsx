import { Apple, Grid2x2, Terminal, type LucideProps } from "lucide-react";

import type { PlatformId } from "../config";

const ICONS = { mac: Apple, windows: Grid2x2, linux: Terminal } as const;

/**
 * SOURCE OF TRUTH KEYWORDS: PlatformIcon, macOS icon, Windows icon, Linux icon, download icon
 * WHAT:  A neutral icon per desktop platform.
 * WHY:   lucide only; no trademarked logos on download buttons.
 * WHERE: hero, download and install sections.
 */
export function PlatformIcon({ platform, ...props }: { platform: PlatformId } & LucideProps) {
  const Icon = ICONS[platform];
  return <Icon aria-hidden {...props} />;
}
