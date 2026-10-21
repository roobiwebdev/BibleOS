/**
 * SOURCE OF TRUTH KEYWORDS: NOTIFICATION_TAG_STYLES, notificationTagClass, toNotificationTag, tag badge colors
 * WHAT:  Badge classes per notification tag (theme tokens only) and a string -> tag narrower.
 * WHY:   Batman hard-coded zinc/blue/green palettes in two pages; tokens keep every theme readable.
 * WHERE: dashboard notifications page, admin notifications page.
 */
import { NOTIFICATION_TAGS, type NotificationTag } from "@starter/core/types";

export const NOTIFICATION_TAG_STYLES: Record<NotificationTag, string> = {
  general: "bg-muted text-muted-foreground",
  announcement: "bg-primary/10 text-primary",
  update: "bg-secondary text-secondary-foreground",
  maintenance: "bg-accent text-accent-foreground",
  security: "bg-destructive/10 text-destructive",
  billing: "bg-primary/15 text-foreground",
  feature: "bg-foreground/10 text-foreground",
  urgent: "bg-destructive text-background",
};

export function toNotificationTag(value: string): NotificationTag | null {
  return NOTIFICATION_TAGS.find((t) => t === value) ?? null;
}

export function notificationTagClass(tag: string): string {
  const known = toNotificationTag(tag);
  return known ? NOTIFICATION_TAG_STYLES[known] : NOTIFICATION_TAG_STYLES.general;
}
