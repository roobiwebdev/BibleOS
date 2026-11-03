import * as z from "zod/mini";

import { PLATFORMS, REPO, type PlatformId } from "../config";

const releaseSchema = z.object({
  tag_name: z.string(),
  html_url: z.url(),
  draft: z.optional(z.boolean()),
  prerelease: z.optional(z.boolean()),
  assets: z.array(z.object({ name: z.string(), browser_download_url: z.url(), size: z.number() })),
});

export interface DownloadLink {
  id: string;
  format: string;
  url: string;
  /** Bytes; undefined when we only have the release page to link to. */
  size?: number;
  recommended: boolean;
}

/**
 * SOURCE OF TRUTH KEYWORDS: ReleaseState, fetchLatestRelease, downloadsFor, release fallback, GitHub API
 * WHAT:  The latest published release as the site needs it: a version and, per platform, the
 *        installer links found among its files.
 * WHY:   The site is static and the release appears later, so it asks GitHub in the browser. The
 *        response is validated with Zod; a 404 (no release yet), a rate limit or any surprise
 *        becomes "fallback", and every button then points at the releases page instead.
 * WHERE: lib/use-release.ts; the hero and download sections.
 */
export type ReleaseState =
  | { status: "loading" }
  | { status: "fallback" }
  | { status: "ready"; version: string; pageUrl: string; links: Record<PlatformId, DownloadLink[]> };

export async function fetchLatestRelease(signal?: AbortSignal): Promise<ReleaseState> {
  try {
    const response = await fetch(REPO.latestReleaseApi, {
      signal,
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!response.ok) return { status: "fallback" };
    const parsed = releaseSchema.safeParse(await response.json());
    if (!parsed.success || parsed.data.draft) return { status: "fallback" };
    const { tag_name, html_url, assets } = parsed.data;

    const links: Record<PlatformId, DownloadLink[]> = { mac: [], windows: [], linux: [] };
    for (const platform of PLATFORMS) {
      for (const kind of platform.assets) {
        const asset = assets.find((a) => kind.pattern.test(a.name));
        if (asset) {
          links[platform.id].push({
            id: kind.id,
            format: kind.format,
            url: asset.browser_download_url,
            size: asset.size,
            recommended: kind.recommended ?? false,
          });
        }
      }
    }
    return { status: "ready", version: tag_name.replace(/^v/i, ""), pageUrl: html_url, links };
  } catch {
    return { status: "fallback" };
  }
}

/** The links for one platform, or a single link to the releases page when the release has none. */
export function downloadsFor(state: ReleaseState, platform: PlatformId): DownloadLink[] {
  const info = PLATFORMS.find((p) => p.id === platform);
  const found = state.status === "ready" ? state.links[platform] : [];
  if (found.length > 0) return found;
  const primary = info?.assets.find((a) => a.recommended) ?? info?.assets[0];
  return [{ id: "page", format: primary?.format ?? "", url: REPO.releasesUrl, recommended: true }];
}

export function formatSize(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(bytes < 10_000_000 ? 1 : 0)} MB`;
}
