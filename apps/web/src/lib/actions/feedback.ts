"use server";
/**
 * SOURCE OF TRUTH KEYWORDS: feedback actions, submitFeedback, getUserFeedback, getAdminFeedback, updateFeedbackStatus, getAdminFeedbackStats
 * WHAT:  Server-action adapters over the feedback router (no logic here). Names match Batman.
 * WHERE: FeedbackDialog, admin feedback page.
 */
import type { RouterInputs } from "@starter/api";

import { api } from "@/server/trpc";

type UpdateStatusInput = RouterInputs["feedback"]["updateStatus"];

export async function submitFeedback(input: RouterInputs["feedback"]["submit"]) {
  return (await api()).feedback.submit(input);
}

export async function getUserFeedback() {
  return (await api()).feedback.mine();
}

export async function getAdminFeedback(input?: RouterInputs["feedback"]["adminList"]) {
  return (await api()).feedback.adminList(input);
}

export async function updateFeedbackStatus(id: string, status: UpdateStatusInput["status"], adminNote?: string) {
  return (await api()).feedback.updateStatus({ id, status, adminNote });
}

export async function getAdminFeedbackStats() {
  return (await api()).feedback.stats();
}
