"use server";
/**
 * SOURCE OF TRUTH KEYWORDS: notification actions, sendNotification, sendNotificationToAll, getUserNotifications, markNotificationRead, markAllNotificationsRead, getUnreadCount, getAdminNotificationHistory, getAllUsers, searchUsers
 * WHAT:  Server-action adapters over the notifications router (no logic here). Names match Batman.
 * WHERE: dashboard notifications page, admin notifications page.
 */
import type { RouterInputs } from "@starter/api";

import { api } from "@/server/trpc";

export async function sendNotification(input: RouterInputs["notifications"]["send"]) {
  return (await api()).notifications.send(input);
}

export async function sendNotificationToAll(input: RouterInputs["notifications"]["sendToAll"]) {
  return (await api()).notifications.sendToAll(input);
}

export async function getUserNotifications(input?: RouterInputs["notifications"]["list"]) {
  return (await api()).notifications.list(input);
}

export async function markNotificationRead(recipientId: string) {
  return (await api()).notifications.markRead({ id: recipientId });
}

export async function markAllNotificationsRead() {
  return (await api()).notifications.markAllRead();
}

export async function getUnreadCount() {
  return (await api()).notifications.unreadCount();
}

export async function getAdminNotificationHistory(input?: RouterInputs["notifications"]["history"]) {
  return (await api()).notifications.history(input);
}

export async function getAllUsers() {
  return (await api()).notifications.users();
}

export async function searchUsers(query: string, limit = 20) {
  return (await api()).notifications.searchUsers({ query, limit });
}
