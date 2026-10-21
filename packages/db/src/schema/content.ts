/**
 * SOURCE OF TRUTH KEYWORDS: notification, notificationRecipient, post, blog, feedback, waitlistEntry, subscription, auditLog
 * WHAT:  App-level tables for the prebuilt modules: notifications, blog, feedback, waitlist,
 *        Polar subscriptions and the audit log.
 * WHY:   Each module owns one or two tables; deleting a module means deleting its tables here
 *        plus its router (see docs/engineering/modules.md).
 * WHERE: packages/api services/routers.
 */
import { boolean, index, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { user } from "./auth";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

// ── Notifications ─────────────────────────────────────────────
export const notification = pgTable(
  "notification",
  {
    id: id(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    tag: text("tag").default("general").notNull(),
    attachmentUrl: text("attachment_url"),
    attachmentName: text("attachment_name"),
    senderId: text("sender_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("notification_sender_idx").on(t.senderId), index("notification_created_idx").on(t.createdAt)],
);

export const notificationRecipient = pgTable(
  "notification_recipient",
  {
    id: id(),
    notificationId: text("notification_id")
      .notNull()
      .references(() => notification.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    read: boolean("read").default(false).notNull(),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("notification_recipient_uq").on(t.notificationId, t.userId),
    index("notification_recipient_user_read_idx").on(t.userId, t.read),
    index("notification_recipient_user_created_idx").on(t.userId, t.createdAt),
  ],
);

// ── Blog ──────────────────────────────────────────────────────
export const post = pgTable(
  "post",
  {
    id: id(),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    excerpt: text("excerpt").default("").notNull(),
    content: text("content").notNull(),
    metaTitle: text("meta_title"),
    metaDescription: text("meta_description"),
    ogImage: text("og_image"),
    published: boolean("published").default(false).notNull(),
    publishedAt: timestamp("published_at"),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("post_published_idx").on(t.published, t.publishedAt),
    index("post_author_idx").on(t.authorId),
    index("post_created_idx").on(t.createdAt),
  ],
);

// ── Feedback ──────────────────────────────────────────────────
export const feedback = pgTable(
  "feedback",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    message: text("message").notNull(),
    status: text("status").default("open").notNull(),
    adminNote: text("admin_note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("feedback_user_idx").on(t.userId),
    index("feedback_status_idx").on(t.status),
    index("feedback_created_idx").on(t.createdAt),
  ],
);

// ── Waitlist ──────────────────────────────────────────────────
export const waitlistEntry = pgTable(
  "waitlist_entry",
  {
    id: id(),
    email: text("email").notNull().unique(),
    name: text("name"),
    company: text("company"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("waitlist_created_idx").on(t.createdAt)],
);

// ── Payments (Polar) ──────────────────────────────────────────
export const subscription = pgTable(
  "subscription",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    polarSubscriptionId: text("polar_subscription_id").notNull().unique(),
    polarCustomerId: text("polar_customer_id").notNull(),
    productId: text("product_id"),
    status: text("status").notNull(),
    currentPeriodEnd: timestamp("current_period_end").notNull(),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("subscription_status_idx").on(t.status)],
);

// ── Audit log ─────────────────────────────────────────────────
export type AuditMetadata = Record<string, string | number | boolean | null>;

export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    description: text("description"),
    metadata: jsonb("metadata").$type<AuditMetadata>(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("audit_log_user_idx").on(t.userId),
    index("audit_log_entity_idx").on(t.entity, t.entityId),
    index("audit_log_created_idx").on(t.createdAt),
  ],
);
