/**
 * SOURCE OF TRUTH KEYWORDS: SITE, REPO, releases URL, download assets, PLATFORMS, asset patterns, GitHub
 * WHAT:  Where BibleOS lives on the web (the public releases repository, release page, release API,
 *        site URL) and how each platform's installer is recognised among a release's files.
 * WHY:   The release workflow (tauri-action) names files by a fixed pattern. Keeping the owner,
 *        repo and patterns here means a rename touches one file, and every link falls back to the
 *        same release page when the API has nothing to offer.
 * WHERE: lib/releases.ts, sections (hero, download, install, footer), index.html meta (by hand).
 */
const OWNER = "roobiwebdev";
// The public repo that holds installers, the update feed and this site. The source stays private.
const NAME = "BibleOS-releases";

export const REPO = {
  owner: OWNER,
  name: NAME,
  url: `https://github.com/${OWNER}/${NAME}`,
  /** Always works, even before the first release: GitHub shows the latest or an empty list. */
  releasesUrl: `https://github.com/${OWNER}/${NAME}/releases/latest`,
  latestReleaseApi: `https://api.github.com/repos/${OWNER}/${NAME}/releases/latest`,
} as const;

/** Who makes BibleOS; shown as "Built by" in the footer. */
export const AUTHOR = {
  name: "Roobi",
  url: "https://roobi.dev",
} as const;

export const SITE = {
  name: "BibleOS",
  /** Canonical address used for Open Graph (Vercel project bibleos-site). */
  url: "https://bible.roobi.dev/",
} as const;

export type PlatformId = "mac" | "windows" | "linux";

export interface AssetKind {
  id: string;
  /** File type shown on the button, e.g. ".dmg". */
  format: string;
  /** Matches the release file name. */
  pattern: RegExp;
  recommended?: boolean;
}

export interface PlatformInfo {
  id: PlatformId;
  name: string;
  requirement: string;
  assets: readonly AssetKind[];
}

export const PLATFORMS: readonly PlatformInfo[] = [
  {
    id: "mac",
    name: "macOS",
    requirement: "macOS 12 or later · Apple Silicon and Intel",
    assets: [{ id: "dmg", format: ".dmg", pattern: /_universal\.dmg$/i, recommended: true }],
  },
  {
    id: "windows",
    name: "Windows",
    requirement: "Windows 10 or 11 · 64-bit",
    assets: [
      { id: "exe", format: "Installer (.exe)", pattern: /_x64-setup\.exe$/i, recommended: true },
      { id: "msi", format: ".msi", pattern: /_x64_en-US\.msi$/i },
    ],
  },
  {
    id: "linux",
    name: "Linux",
    requirement: "64-bit (x86_64)",
    assets: [
      { id: "appimage", format: ".AppImage", pattern: /_amd64\.AppImage$/i, recommended: true },
      { id: "deb", format: ".deb", pattern: /_amd64\.deb$/i },
      { id: "rpm", format: ".rpm", pattern: /\.x86_64\.rpm$/i },
    ],
  },
];
