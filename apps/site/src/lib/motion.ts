import { useEffect, useState, type RefObject } from "react";

/**
 * SOURCE OF TRUTH KEYWORDS: usePrefersReducedMotion, useInView, reduced motion, visibility, IntersectionObserver
 * WHAT:  Two small hooks: whether the visitor asked for less motion, and whether an element is
 *        on screen in a visible tab.
 * WHY:   The hero demo only runs while it can be seen, and holds a still frame for visitors who
 *        prefer reduced motion.
 * WHERE: demo/use-clock.ts, sections that reveal on scroll.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

export function useInView(ref: RefObject<Element | null>, threshold = 0.3): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let intersecting = false;
    const update = () => setVisible(intersecting && !document.hidden);
    const observer = new IntersectionObserver(
      ([entry]) => {
        intersecting = entry?.isIntersecting ?? false;
        update();
      },
      { threshold },
    );
    observer.observe(node);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, [ref, threshold]);
  return visible;
}
