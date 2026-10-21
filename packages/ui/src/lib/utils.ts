/**
 * SOURCE OF TRUTH KEYWORDS: cn, classNames, tailwind merge
 * WHAT:  Merges Tailwind class lists, later classes win.
 * WHERE: every component in packages/ui and apps/*.
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
