# Auth and permissions

Authentication is Better Auth 1.7.7 with the Drizzle adapter. Everything lives in `packages/auth`.

| File                                      | What it holds                                                                                 |
| ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| `packages/auth/src/index.ts`              | `buildAuth()`, `createAuthProvider()`, and the `Auth`, `Session`, `AuthUser`, `GetAuth` types |
| `packages/auth/src/permissions.ts`        | access-control statements, the `admin` and `user` roles, `PermissionCheck`                    |
| `packages/auth/src/schema-compat.test.ts` | checks the Drizzle schema has everything Better Auth expects (`pnpm auth:check`)              |

Better Auth is mounted at `/api/auth/*` by `apps/web/src/app/api/auth/[...all]/route.ts`. The web client is in `apps/web/src/lib/auth-client.ts`. The Expo client is in `apps/native/lib/auth-client.ts`.

## The factory, and rebuilding on settings changes

Better Auth reads its config once, when the instance is created. But several auth options come from admin settings: the app name, session length, whether email verification is required, and the Google and GitHub keys. Batman read these once at boot, so keys saved in Admin > API Keys never took effect until a restart.

Here, `createAuthProvider(deps)` returns a `getAuth()` function:

1. It reads the settings row and the integration keys (through the settings cache).
2. It builds a fingerprint from the values that shape auth: `appName`, `sessionTimeout`, `emailVerificationEnabled` and the four OAuth values.
3. If the fingerprint changed since the last call, it builds a new instance with `buildAuth()`. Otherwise it returns the cached one.

Because the settings cache lasts 10 seconds per server process, a change in the admin panel reaches auth within about 10 seconds on each instance. No redeploy is needed.

Always call `await getServices().getAuth()` (or use the helpers in `apps/web/src/server/session.ts`). Never keep your own auth instance.

Some toggles are read live on each request instead of at build time: `signupsEnabled`, `maxUsersEnabled` / `maxUsers`, `defaultUserRole`, `forgotPasswordEnabled`, `organizationsEnabled` and `invitesEnabled`.

## What `buildAuth` configures

| Area               | Behaviour                                                                                                                                                      |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Email and password | On. Minimum password length 8. Verification is required only when `emailVerificationEnabled` is on.                                                            |
| Password reset     | Sends a reset email. Refused when `forgotPasswordEnabled` is off.                                                                                              |
| Verification email | Sent on sign-up and sign-in while verification is on. The link returns the user to `/onboarding`.                                                              |
| Social login       | Google and GitHub are added only when both the client ID and secret are present (Admin > API Keys, or `.env`).                                                 |
| Session length     | `sessionTimeout` days (1 to 365, default 30).                                                                                                                  |
| User fields        | `bio` (editable) and `onboardingCompleted` (server-set) in addition to Better Auth's fields. Users can delete their account. Changing email is off.            |
| Plugins            | `expo()`, `admin` (roles, ban, impersonation), `organization`, `nextCookies()`                                                                                 |
| Trusted origins    | `CORS_ORIGIN` plus `project-starter://` (the Expo scheme). In development also `exp://` and `http://localhost:8081`. Set in `apps/web/src/server/services.ts`. |

All emails use `emailTemplate()` from `@starter/core/email`, and every user-supplied value is passed through `escapeHtml()`.

## Sign-up rules and the first admin

A database hook runs before each user is created:

- If sign-ups are off, the request fails with "Signups are currently disabled."
- If the user cap is on and reached, it fails with "Registration is closed."
- Users created by an admin skip both checks.

After a user is created:

- **The first user in the database becomes `admin`.** Everyone else gets `defaultUserRole` (normally `user`).
- The new user gets a welcome notification. Admins get a "New user signed up" notification (except for the first user).

There is a second way to get an admin: set `SEED_ADMIN_EMAIL` (and `SEED_ADMIN_PASSWORD` to create a new account) and run `pnpm db:seed`. The seed creates or promotes that account and marks it verified.

A password change sends the user a "Password changed" security notification.

## Roles and permissions

There are two kinds of role:

- **Global roles** (`admin`, `user`) from the Better Auth admin plugin. Stored in `user.role`. Defined in `packages/auth/src/permissions.ts`.
- **Organization roles** (`owner`, `admin`, `member`) from the organization plugin. Stored in `member.role`. These use Better Auth's defaults.

`permissions.ts` declares resources and verbs, then grants them to roles:

```ts
export const statement = {
  ...defaultStatements, // admin plugin: user, session
  project: ["create", "read", "update", "delete"],
  file: ["upload", "read", "delete"],
  settings: ["read", "update"],
} as const;

export const userRole = ac.newRole({ project: ["create", "read"], file: ["upload", "read"], settings: ["read"] });
export const adminRole = ac.newRole({
  project: [...all],
  file: [...all],
  settings: ["read", "update"],
  ...adminAc.statements,
});
```

### Adding a permission

1. Add the resource and its verbs to `statement`.
2. Grant verbs to `userRole` and `adminRole`.
3. Require it on a procedure:

   ```ts
   protectedProcedure({ permission: { project: ["update"] } });
   ```

   The builder calls Better Auth's `userHasPermission` and throws `FORBIDDEN` if it fails.

Use `role: "admin"` (or `adminProcedure`) for admin-panel endpoints. Use `permission` when a non-admin role may do some of the work.

Permission checks are global. They do not check that a row belongs to the caller. Ownership checks (for example "only the author may edit this") belong in the router, by filtering on `ctx.session.user.id`.

## Organizations

The organization plugin gives teams with `owner`, `admin` and `member` roles, and email invitations.

- Creating an organization is allowed only when `organizationsEnabled` is on (Admin > Features). It is off by default.
- Invitations are sent only when `invitesEnabled` is on. The email links to `/dashboard/invitations?id=<invitation id>`.
- The dashboard pages are `/dashboard/organizations` and `/dashboard/invitations`. Their nav entries appear only when the matching toggle is on.

There is no per-organization data scoping in the API yet. If your product needs tenant-scoped rows, add an `organizationId` column and filter by `ctx.session.session.activeOrganizationId` in the router.

## Rate limits on auth endpoints

Better Auth's own rate limiter is on and stores counters in the `rate_limit` table (shared with the API limiter, under different keys):

| Endpoint                                      | Limit              |
| --------------------------------------------- | ------------------ |
| everything under `/api/auth`                  | 100 per 60 seconds |
| `/sign-in/email`                              | 10 per 60 seconds  |
| `/sign-up/email`                              | 5 per 60 seconds   |
| `/forget-password`, `/request-password-reset` | 5 per 5 minutes    |
| `/send-verification-email`                    | 5 per 5 minutes    |

## Social providers

Add Google or GitHub keys in **Admin > API Keys** (or as `GOOGLE_*` / `GITHUB_*` env fallbacks). Then turn on **Social login** in **Admin > Features**. The login page shows a provider button only when the toggle is on and both of that provider's values are set (`settings.authConfig`).

Callback URLs to register with the provider:

```
<BETTER_AUTH_URL>/api/auth/callback/google
<BETTER_AUTH_URL>/api/auth/callback/github
```

## Using the session

| Where                      | How                                                                                                                              |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Server Component or layout | `getSession()`, `requireSession()` (redirects to `/login`), `requireAdmin()` (redirects to `/dashboard`) from `@/server/session` |
| tRPC procedure             | `ctx.session` (non-null inside `protectedProcedure`)                                                                             |
| Route handler              | `getSession()` and `isAdmin(session)` from `@/server/session`                                                                    |
| Client component           | `authClient.useSession()` from `@/lib/auth-client`                                                                               |

Types: `Session` and `AuthUser` from `@starter/auth`. They are inferred from the Better Auth config, so they change automatically when you add plugins or fields.

## Changing auth tables

After changing plugins or `additionalFields`, run `pnpm auth:check`. It fails and lists every table or column Better Auth expects that `packages/db/src/schema` does not have. Add them, then generate a migration. See [database.md](database.md).
