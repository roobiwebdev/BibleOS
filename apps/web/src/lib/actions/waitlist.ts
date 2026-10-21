"use server";
/**
 * SOURCE OF TRUTH KEYWORDS: waitlist actions, joinWaitlist, JoinWaitlistResult, getWaitlistSettings
 * WHAT:  Server-action adapters over the waitlist router (Batman's names and result shape).
 * WHERE: app/waitlist-page.tsx, app/countdown-waitlist-page.tsx.
 */
import type { RouterInputs } from "@starter/api";

import { api } from "@/server/trpc";

export type JoinWaitlistResult = { success: true } | { success: false; error: string };

/** Waitlist UI settings, or null when waitlist mode is off. */
export async function getWaitlistSettings() {
  return (await (await api()).settings.siteModes()).waitlist;
}

const hasCode = (e: unknown, code: string) => typeof e === "object" && e !== null && "code" in e && e.code === code;

export async function joinWaitlist(input: RouterInputs["waitlist"]["join"]): Promise<JoinWaitlistResult> {
  try {
    return await (await api()).waitlist.join(input);
  } catch (e) {
    // Validation errors carry Zod details; show Batman's friendly message instead.
    if (hasCode(e, "BAD_REQUEST")) return { success: false, error: "Invalid email address" };
    return {
      success: false,
      error: e instanceof Error && e.message ? e.message : "Something went wrong. Please try again.",
    };
  }
}
