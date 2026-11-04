/**
 * SOURCE OF TRUTH KEYWORDS: Screenshot, app screenshot, window frame, sepia and night images
 * WHAT:  A real screenshot of the app in a window frame, in Sepia or Night to match the page.
 * WHY:   Screenshots are captured from the app's browser preview (scripts/capture.mjs) in both
 *        themes. Hidden lazy images are not fetched, so only the visible theme downloads.
 * WHERE: sections/features.tsx.
 */
export function Screenshot({ name, alt }: { name: string; alt: string }) {
  const common = "block h-auto w-full";
  return (
    <figure className="lift overflow-hidden rounded-xl border bg-card">
      <img
        src={`./screenshots/${name}-sepia.webp`}
        alt={alt}
        width={1920}
        height={1200}
        loading="lazy"
        decoding="async"
        className={`${common} night:hidden`}
      />
      <img
        src={`./screenshots/${name}-night.webp`}
        alt={alt}
        width={1920}
        height={1200}
        loading="lazy"
        decoding="async"
        className={`${common} hidden night:block`}
      />
    </figure>
  );
}
