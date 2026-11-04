import iconNight from "../assets/icon-night-256.png";
import iconSepia from "../assets/icon-sepia-256.png";

/**
 * SOURCE OF TRUTH KEYWORDS: AppIcon, logo, app icon, theme icon, brand mark
 * WHAT:  The BibleOS app icon, in its Sepia or Night version to match the page theme.
 * WHY:   The app's Dock icon follows its theme; the site does the same with CSS so the right
 *        icon shows on first paint, before any script runs.
 * WHERE: sections/nav.tsx, sections/hero.tsx, sections/footer.tsx.
 */
export function AppIcon({ size, className = "" }: { size: number; className?: string }) {
  return (
    <span className={`relative inline-block shrink-0 ${className}`} style={{ width: size, height: size }}>
      <img src={iconSepia} alt="" width={size} height={size} className="absolute inset-0 night:hidden" />
      <img src={iconNight} alt="" width={size} height={size} className="absolute inset-0 hidden night:block" />
    </span>
  );
}
