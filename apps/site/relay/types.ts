import type { RelayRequest } from "@starter/bible-data/online";

/** A relay request for text (a chapter, or verses inside one chapter). */
export type PassageRequest = Extract<RelayRequest, { kind: "chapter" | "verses" }>;
