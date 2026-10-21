/**
 * SOURCE OF TRUTH KEYWORDS: ac, accessControl, statement, adminRole, userRole, permissions, roles, PERMISSION
 * WHAT:  Global access-control statements and the two global roles (admin, user) for the
 *        Better Auth admin plugin.
 * WHY:   One list of resources and verbs. Add a resource here, then grant verbs to roles; the
 *        api `requirePermission` option and `authClient.admin.hasPermission` both read it.
 * WHERE: createAuth() admin plugin, apps/web auth client, packages/api procedures.
 */
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

export const statement = {
  ...defaultStatements,
  project: ["create", "read", "update", "delete"],
  file: ["upload", "read", "delete"],
  settings: ["read", "update"],
} as const;

export const ac = createAccessControl(statement);

export const userRole = ac.newRole({
  project: ["create", "read"],
  file: ["upload", "read"],
  settings: ["read"],
});

export const adminRole = ac.newRole({
  project: ["create", "read", "update", "delete"],
  file: ["upload", "read", "delete"],
  settings: ["read", "update"],
  ...adminAc.statements,
});

export const roles = { admin: adminRole, user: userRole } as const;
export type GlobalRole = keyof typeof roles;
export type Statement = typeof statement;
export type PermissionCheck = { [K in keyof Statement]?: Array<Statement[K][number]> };
