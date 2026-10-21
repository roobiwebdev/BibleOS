# Environment variables

Every variable for the web app is declared in **`apps/web/.env.schema`**. That file is the source of truth. It is committed. Real values go in `apps/web/.env` (git-ignored) locally, and in Vercel's settings in production.

The schema is read by [Varlock](https://varlock.dev):

- It validates values when Next.js starts or builds, and when a script runs with `varlock run`. A missing required value stops the app with a clear error.
- It generates the typed `ENV` object in `apps/web/src/env.ts` (`pnpm env:generate`, which also runs after `pnpm install`).
- Values are treated as sensitive unless marked otherwise, so they are not exposed to the browser.

Only `apps/web/src/server/services.ts` reads these values (through `apps/web/src/server/env.ts`). See [engineering/01-architecture.md](engineering/01-architecture.md).

`pnpm bootstrap` writes a working `apps/web/.env` for local development. You only need to add the optional ones.

## The rule: Admin > API Keys overrides env

For every integration (R2, Resend, Google, GitHub, Polar), a value saved in **Admin > API Keys** wins. The `.env` variable is used only when the admin value is empty.

- Admin values are stored encrypted in the database, and take effect without a redeploy.
- `.env` values are handy for local development, CI, or when you prefer to manage keys in your host.
- Clearing a field in Admin > API Keys makes the app fall back to `.env` again.

## Core variables

| Variable              | Required | Default                                      | Purpose                                                                                                                      | How to get it                                                                                                                             |
| --------------------- | -------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`            | yes      | `development`                                | `development`, `production` or `test`. Production hides error details, disables the dev email outbox, and blocks `db:reset`. | Set by Next.js and Vercel. `pnpm bootstrap` writes `development`.                                                                         |
| `BETTER_AUTH_URL`     | yes      | the Vercel URL, else `http://localhost:3001` | Public URL of the app. Used for auth callbacks, links in emails and checkout redirects.                                      | Your domain, e.g. `https://app.example.com`. Set it explicitly with a custom domain.                                                      |
| `CORS_ORIGIN`         | yes      | same as `BETTER_AUTH_URL`                    | Browser origin allowed to call auth.                                                                                         | Usually leave it unset so it follows `BETTER_AUTH_URL`.                                                                                   |
| `BETTER_AUTH_SECRET`  | yes      | none                                         | Signs sessions. At least 32 characters. Changing it signs everyone out.                                                      | `openssl rand -base64 32`. Different per environment.                                                                                     |
| `APP_ENCRYPTION_KEY`  | yes      | none                                         | Encrypts keys saved in Admin > API Keys. At least 32 characters. Changing it makes saved keys unreadable (re-enter them).    | `openssl rand -base64 32`. Different per environment. Back it up.                                                                         |
| `DATABASE_URL`        | yes      | none                                         | Postgres connection string used by the app and the seed. Must start with `postgres`.                                         | Neon: the **pooled** connection string. Docker: `pnpm bootstrap` writes `postgresql://postgres:postgres@localhost:54329/project_starter`. |
| `DATABASE_URL_DIRECT` | no       | none                                         | Direct (non-pooled) connection used by migrations and `db:reset`. Falls back to `DATABASE_URL`.                              | Neon: the connection string with pooling **off**. Not needed for Docker.                                                                  |

## Set automatically on Vercel

You do not set these. They are read only to work out the default `BETTER_AUTH_URL`.

| Variable                        | Purpose                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| `VERCEL_ENV`                    | `production`, `preview` or `development`                                             |
| `VERCEL_URL`                    | this deployment's URL                                                                |
| `VERCEL_PROJECT_PRODUCTION_URL` | the project's production domain                                                      |
| `VERCEL_ORIGIN`                 | computed in the schema: the production domain on production, else the deployment URL |

## Integration fallbacks (all optional)

All of these can be set in Admin > API Keys instead.

### Cloudflare R2 (file uploads)

Uploads work only when all five are set (here or in the admin panel).

| Variable               | Secret | Purpose                                                                                             | How to get it                                                              |
| ---------------------- | ------ | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `R2_ACCOUNT_ID`        | no     | Cloudflare account ID. A full `https://...` S3 endpoint also works, for other S3-compatible stores. | Cloudflare dashboard > R2 > Overview (Account ID)                          |
| `R2_ACCESS_KEY_ID`     | yes    | API token access key                                                                                | R2 > Manage API tokens > Create token (Object Read & Write for the bucket) |
| `R2_SECRET_ACCESS_KEY` | yes    | API token secret                                                                                    | shown once when you create the token                                       |
| `R2_BUCKET`            | no     | bucket name                                                                                         | R2 > Create bucket                                                         |
| `R2_PUBLIC_URL`        | no     | public base URL for files                                                                           | bucket > Settings > Public access: the `r2.dev` URL or your custom domain  |

### Resend (email)

| Variable            | Secret | Purpose                                                                                                                                            | How to get it                                       |
| ------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `RESEND_API_KEY`    | yes    | Sends email. Without it, development prints emails to the server console; production does not send them.                                           | resend.com > API Keys                               |
| `RESEND_FROM_EMAIL` | no     | Sender, e.g. `Acme <hello@acme.com>`. Empty: `<app name> <onboarding@resend.dev>` (Resend's test sender, which only delivers to your own address). | an address on a domain verified in Resend > Domains |

### OAuth providers

Callback URL: `<BETTER_AUTH_URL>/api/auth/callback/google` or `/github`. Social login must also be switched on in Admin > Features.

| Variable               | Secret | How to get it                                                                                   |
| ---------------------- | ------ | ----------------------------------------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`     | no     | Google Cloud Console > APIs & Services > Credentials > Create OAuth client ID (Web application) |
| `GOOGLE_CLIENT_SECRET` | yes    | same screen                                                                                     |
| `GITHUB_CLIENT_ID`     | no     | GitHub > Settings > Developer settings > OAuth Apps > New OAuth App                             |
| `GITHUB_CLIENT_SECRET` | yes    | same app > Generate a new client secret                                                         |

### Polar (payments)

Webhook URL: `<BETTER_AUTH_URL>/api/webhooks/polar`. Sandbox mode is switched in Admin > API Keys (on by default); there is no env variable for it.

| Variable                | Secret | How to get it                                                                                                               |
| ----------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------- |
| `POLAR_ACCESS_TOKEN`    | yes    | an organization access token from your Polar organization settings (create it on sandbox.polar.sh while sandbox mode is on) |
| `POLAR_ORGANIZATION_ID` | no     | your Polar organization settings                                                                                            |
| `POLAR_WEBHOOK_SECRET`  | yes    | the signing secret shown when you add the webhook endpoint in your Polar organization settings                              |

## Seed variables (optional)

Used only by `pnpm db:seed` (and `pnpm bootstrap`, `pnpm db:reset`, which call it).

| Variable              | Default | Purpose                                                                                    |
| --------------------- | ------- | ------------------------------------------------------------------------------------------ |
| `SEED_ADMIN_EMAIL`    | empty   | Create or promote this account to admin. Empty: skip, and the first sign-up becomes admin. |
| `SEED_ADMIN_PASSWORD` | empty   | Password for a new admin (at least 8 characters). Not needed to promote an existing user.  |
| `SEED_ADMIN_NAME`     | `Admin` | Display name for a new admin.                                                              |

## Other apps and packages

| File                      | Variables                                                                                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/db/.env.schema` | Imports `NODE_ENV`, `DATABASE_URL` and `DATABASE_URL_DIRECT` from `apps/web/.env.schema`, so migrations use the app's database. Nothing to set.                                       |
| `apps/native/.env.schema` | `EXPO_PUBLIC_SERVER_URL` (default `http://localhost:3001`): the web app's URL, where the Expo app calls `/api/auth` and `/api/trpc`. Use your computer's LAN IP on a physical device. |

Tests and CI also use `TEST_DATABASE_URL` (not in any schema). When it is set, database tests in `packages/api` run against it.

## Adding a variable

1. Declare it in `apps/web/.env.schema` with a comment and decorators (`@required=false`, `@sensitive=false`, `@type=...`).
2. Run `pnpm env:generate` to update `apps/web/src/env.ts`.
3. Read it in `apps/web/src/server/services.ts` and pass it to the package that needs it.
4. If it is an integration key, also add an admin field and an encrypted column (see [engineering/04-settings-and-integrations.md](engineering/04-settings-and-integrations.md#adding-a-new-third-party-secret)).
5. Add it to this page.
