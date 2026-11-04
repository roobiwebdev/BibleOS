import { useEffect, useRef, type ReactNode } from "react";

/**
 * SOURCE OF TRUTH KEYWORDS: Reveal, scroll reveal, fade in, IntersectionObserver, data-reveal
 * WHAT:  Fades its content up the first time it scrolls into view.
 * WHY:   Gives the long page some gentle motion. Content renders visible on the server and is
 *        only hidden once script confirms it is below the fold, so nothing is lost without
 *        JavaScript; reduced motion turns the effect off in CSS.
 * WHERE: sections below the hero.
 */
export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || node.getBoundingClientRect().top < window.innerHeight) return;
    node.dataset.reveal = "";
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        node.dataset.shown = "";
        observer.disconnect();
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      node.dataset.shown = "";
    };
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
