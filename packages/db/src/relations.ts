/**
 * SOURCE OF TRUTH KEYWORDS: relations, defineRelations, db.query, with
 * WHAT:  Drizzle v2 relation map used by `db.query.<table>.findMany({ with })`.
 * WHERE: createDb() below; any relational query in packages/api services.
 */
import { defineRelations } from "drizzle-orm";

import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
  user: {
    sessions: r.many.session({ from: r.user.id, to: r.session.userId }),
    accounts: r.many.account({ from: r.user.id, to: r.account.userId }),
    members: r.many.member({ from: r.user.id, to: r.member.userId }),
    posts: r.many.post({ from: r.user.id, to: r.post.authorId }),
    subscription: r.one.subscription({ from: r.user.id, to: r.subscription.userId }),
  },
  session: { user: r.one.user({ from: r.session.userId, to: r.user.id }) },
  account: { user: r.one.user({ from: r.account.userId, to: r.user.id }) },
  organization: {
    members: r.many.member({ from: r.organization.id, to: r.member.organizationId }),
    invitations: r.many.invitation({ from: r.organization.id, to: r.invitation.organizationId }),
  },
  member: {
    organization: r.one.organization({ from: r.member.organizationId, to: r.organization.id }),
    user: r.one.user({ from: r.member.userId, to: r.user.id }),
  },
  invitation: {
    organization: r.one.organization({ from: r.invitation.organizationId, to: r.organization.id }),
    inviter: r.one.user({ from: r.invitation.inviterId, to: r.user.id }),
  },
  notification: {
    recipients: r.many.notificationRecipient({
      from: r.notification.id,
      to: r.notificationRecipient.notificationId,
    }),
  },
  notificationRecipient: {
    notification: r.one.notification({
      from: r.notificationRecipient.notificationId,
      to: r.notification.id,
    }),
    user: r.one.user({ from: r.notificationRecipient.userId, to: r.user.id }),
  },
  post: { author: r.one.user({ from: r.post.authorId, to: r.user.id }) },
  feedback: { user: r.one.user({ from: r.feedback.userId, to: r.user.id }) },
  subscription: { user: r.one.user({ from: r.subscription.userId, to: r.user.id }) },
  auditLog: { user: r.one.user({ from: r.auditLog.userId, to: r.user.id }) },
}));
