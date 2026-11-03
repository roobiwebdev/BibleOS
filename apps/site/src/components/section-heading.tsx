import type { ReactNode } from "react";

/**
 * SOURCE OF TRUTH KEYWORDS: SectionHeading, eyebrow, section title, section intro
 * WHAT:  The eyebrow, title and intro at the top of each page section.
 * WHY:   Keeps type sizes and spacing the same in every section.
 * WHERE: every section below the hero.
 */
export function SectionHeading({
  id,
  eyebrow,
  title,
  children,
  align = "center",
}: {
  id: string;
  eyebrow: string;
  title: string;
  children?: ReactNode;
  align?: "center" | "left";
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-xl"}>
      <p className="eyebrow">{eyebrow}</p>
      <h2
        id={id}
        className="scripture mt-3 text-[2rem] leading-tight font-medium tracking-tight text-balance sm:text-[2.6rem]"
      >
        {title}
      </h2>
      {children && <div className="mt-4 text-[17px] leading-relaxed text-muted-foreground text-pretty">{children}</div>}
    </div>
  );
}
