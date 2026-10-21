# Security

## What the starter enforces

| Area                              | Protection                                                                                                                                   | Where                                                                  |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| API access                        | Every procedure passes one checkpoint: rate limit, sign-in, ban check, role / permission check                                               | `packages/api/src/trpc.ts`                                             |
| Data integrity                    | Mutations run in a transaction; the audit row commits or rolls back with the change                                                          | `packages/api/src/trpc.ts`, `packages/api/src/lib/audit.ts`            |
| Input                             | Zod on every procedure input and route-handler body                                                                                          | routers, `apps/web/src/app/api/*`                                      |
| Error leaks                       | In production, internal error messages and stack traces are hidden from clients                                                              | `errorFormatter` in `packages/api/src/trpc.ts`                         |
| Secrets at rest                   | Third-party keys encrypted with AES-256-GCM using `APP_ENCRYPTION_KEY`                                                                       | `packages/core/src/secrets.ts`, `settings.ts`                          |
| Secrets in transit to the browser | Public settings are a curated allow-list; the admin API returns secrets masked                                                               | `packages/api/src/routers/settings.ts`                                 |
| Server-only code                  | `import "server-only"` in env, services, settings, secrets, storage, email, payments and procedure files, so a client import fails the build | those files                                                            |
| Env                               | Validated at startup and build by Varlock; values marked sensitive by default                                                                | `apps/web/.env.schema`                                                 |
| Auth abuse                        | Better Auth rate limits on sign-in, sign-up, reset and verification emails                                                                   | `packages/auth/src/index.ts`                                           |
| Form and API abuse                | Database-backed rate limits that work across serverless instances                                                                            | `packages/api/src/lib/rate-limit.ts`                                   |
| Sign-up control                   | Sign-ups toggle, user cap, default role                                                                                                      | `packages/auth/src/index.ts`                                           |
| Uploads                           | Signed-in only, rate limited, per-folder size and type allow-list, admin-only folder, keys namespaced by user ID, delete only your own files | `apps/web/src/app/api/upload/route.ts`, `packages/core/src/storage.ts` |
| Webhooks                          | Polar signature verified before any write                                                                                                    | `packages/core/src/payments.ts`                                        |
| Email                             | User-supplied text escaped with `escapeHtml()` in every template                                                                             | `packages/core/src/email.ts`, `packages/auth/src/index.ts`             |
| Stored rich text                  | Blog HTML and legal markdown sanitized on the server before rendering                                                                        | `apps/web/src/lib/safe-html.ts`                                        |
| HTTP headers                      | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` on every response                        | `apps/web/next.config.ts`                                              |
| Logging                           | Structured logger; rule: never log secrets, tokens or request bodies                                                                         | `packages/core/src/logger.ts`                                          |
| Setup                             | First-run setup is a local CLI (`pnpm bootstrap`), not a web page                                                                            | `scripts/bootstrap.ts`                                                 |
| Local database                    | The Docker Postgres from `pnpm bootstrap` listens on `127.0.0.1:54329` only                                                                  | `scripts/bootstrap.ts`                                                 |
| Destructive scripts               | `pnpm db:reset` refuses to run when `NODE_ENV=production`                                                                                    | `packages/db/src/reset.ts`                                             |

## Batman vulnerabilities fixed in the port

Batman, the boilerplate these features came from, had the following issues. They were fixed, not copied.

### 1. Open setup wizard that wrote `.env` and ran shell commands (critical)

**Batman:** a `saveSetup` server action with no auth check, rendered from the home page. It rewrote `.env` and ran `pnpm db:push` through `execSync`. On a deployed site anyone could overwrite the app's secrets and database URL.

**Now:** there is no setup page. `scripts/bootstrap.ts` (`pnpm bootstrap`) runs only on a developer's machine and is never part of the web bundle. It writes `apps/web/.env` with mode `600`.

### 2. Unauthenticated `getAppSettings` leaked every secret (critical)

**Batman:** a server action returned the whole `app_settings` row, including OAuth secrets, the Resend key, Polar tokens and the Supabase service key, to any caller.

**Now:** `settings.public` returns a fixed list of non-secret fields (`toPublicSettings`). `settings.adminGet` is admin-only and strips every secret column. `settings.apiKeys` is admin-only and returns secrets masked. Integration keys are only readable on the server through `settings.getIntegrationKeys()`.

### 3. Secrets stored in plain text (high)

**Batman:** third-party keys were stored as plain text in the database. A database leak or backup leak exposed live credentials.

**Now:** every column in `SECRET_KEYS` is encrypted with AES-256-GCM before it is written. The key comes from `APP_ENCRYPTION_KEY`, which lives only in env.

### 4. Uploads with no limits, and deletion of any file (IDOR) (medium to high)

**Batman:** the upload route accepted any size and any file type. The delete route removed whatever path it was given, so any signed-in user could delete any other user's files.

**Now:** each folder has a size limit and a type allow-list. `attachments` is admin-only. Object keys are `<folder>/<userId>/<timestamp>-<name>`, and the delete route refuses keys whose user ID is not the caller's (admins excepted). Uploads are rate limited (30 per 10 minutes per user).

### 5. No rate limiting (medium)

**Batman:** no limits on sign-in, sign-up, password reset, or public forms (waitlist, feedback).

**Now:** Better Auth's limiter covers auth endpoints. The procedure builder limits every API call (120 per minute by default), with tighter presets for public forms (5 per 10 minutes) and sensitive actions.

### 6. HTML injection in emails (medium)

**Batman:** the inviter's name and the organization name were placed directly into the invitation email HTML. A crafted name could inject links or markup into emails sent from your domain.

**Now:** every user-supplied value in an email body goes through `escapeHtml()`. `emailTemplate()` escapes the heading, button label and URL itself.

### 7. Unsanitized blog HTML (medium)

**Batman:** post HTML from the rich-text editor was rendered as-is. Anyone with blog access (or a stolen admin session) could store a script that runs for every reader.

**Now:** the blog router stores the editor's HTML as-is, and the web app sanitizes it on the server at render time with `sanitizeHtml()` (DOMPurify via `isomorphic-dompurify`; scripts, event handlers, `javascript:` URLs, `style`, and form elements are removed). Legal pages, written in markdown, go through `markdownToSafeHtml()`. Both helpers are in `apps/web/src/lib/safe-html.ts`. Sanitizing at render time also protects rows saved before the fix.

Any new place that renders stored HTML must use these helpers.

### Also changed

- **Admins promoted by hand.** Batman needed a database edit or a hard-coded ID list to make an admin. Now the first user becomes admin, or the seed promotes `SEED_ADMIN_EMAIL`.
- **Auth settings read once at boot.** Keys saved in the admin panel did not take effect until restart. Now the auth instance rebuilds when they change, which also means disabling a provider takes effect without a redeploy.

## Your responsibilities

- **Create your admin before going public.** The first sign-up in an empty database becomes admin.
- **Keep `APP_ENCRYPTION_KEY` and `BETTER_AUTH_SECRET` secret and backed up.** Use different values per environment. Rotating `BETTER_AUTH_SECRET` signs everyone out. Rotating `APP_ENCRYPTION_KEY` means re-entering every key in Admin > API Keys.
- **Check ownership in routers.** Permissions say what a role may do. They do not say which rows. Filter by `ctx.session.user.id` (see [06-adding-a-feature.md](06-adding-a-feature.md)).
- **Never widen `toPublicSettings`** with integration columns.
- **Escape and sanitize.** `escapeHtml()` for email, server-side sanitizing for any stored HTML.
- **Mind the IP headers.** Anonymous rate limits key on `x-forwarded-for` / `x-real-ip`. On a host other than Vercel, make sure your proxy sets them and that clients cannot spoof them.
- **Keep dependencies updated.** Drizzle is a release candidate (`1.0.0-rc.4`); watch its changelog.

## Reporting

If you find a security issue in a product built from this starter, fix it at the root (the shared function or the procedure builder) so every caller benefits, and add a test.
