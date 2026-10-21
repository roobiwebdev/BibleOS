# Deployment (Vercel + Neon)

The web app (`apps/web`) deploys to Vercel. The database is Neon. File storage is R2. The docs site and native app deploy separately and are not covered here.

> Not verified end to end. These steps follow the code and config in this repository, but no production deployment has been run from it yet. Tick off the post-deploy checklist on your first deploy.

## 1. Prepare the database

1. Create a Neon project for this product. Use the `main` branch for production.
2. Copy two connection strings from **Connect**: the **pooled** one (host contains `-pooler`) and the **direct** one.
3. Apply migrations to production from your machine, passing the URLs inline so your local `.env` is not used:

   ```bash
   DATABASE_URL="<pooled url>" DATABASE_URL_DIRECT="<direct url>" pnpm db:migrate
   ```

   Double-check both URLs before you run it.
   Never use `db:push` or `db:reset` against production.

4. Create your admin before the site is public (see [Security of the first sign-up](#security-of-the-first-sign-up)):

   ```bash
   DATABASE_URL="<pooled url>" SEED_ADMIN_EMAIL="you@example.com" SEED_ADMIN_PASSWORD="<strong password>" pnpm db:seed
   ```

   The seed also needs the production `BETTER_AUTH_SECRET`, `APP_ENCRYPTION_KEY` and `BETTER_AUTH_URL` to validate env. Pass them inline the same way (use the same values you will set in Vercel in step 3).

Run `pnpm db:migrate` against production on every deploy that adds a migration, **before** the new code goes live. Migrations should be backwards compatible (add columns first, remove them in a later deploy).

## 2. Create the Vercel project

1. Import the Git repository in Vercel.
2. Set **Root Directory** to `apps/web`. Vercel detects Next.js and installs the whole pnpm workspace from the repository root automatically. Keep "Include files outside the root directory in the Build Step" on, because the app imports `packages/*`.
3. Leave the build and output settings at their Next.js defaults. There is no `vercel.json`.
4. Keep **Automatically expose System Environment Variables** on. The env schema uses `VERCEL_ENV`, `VERCEL_URL` and `VERCEL_PROJECT_PRODUCTION_URL` to work out the app URL.

From the CLI, `pnpm deploy:setup` links the folder to a Vercel project, `pnpm deploy` makes a preview deployment, `pnpm deploy:prod` deploys to production and `pnpm deploy:check` is a dry run.

## 3. Environment variables

Every variable is declared in `apps/web/.env.schema`. Varlock validates them during the build, so **a missing required variable fails the build**. The full list is in [../ENVIRONMENT.md](../ENVIRONMENT.md).

Set these in Vercel (Project > Settings > Environment Variables) for Production, and separately for Preview:

| Variable              | Production value                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`        | Neon pooled URL                                                                                                                      |
| `DATABASE_URL_DIRECT` | Neon direct URL (optional on Vercel; only migrations use it)                                                                         |
| `BETTER_AUTH_SECRET`  | a new value from `openssl rand -base64 32`. Never reuse the local one.                                                               |
| `APP_ENCRYPTION_KEY`  | a new value from `openssl rand -base64 32`. Keep a copy in your password manager: losing it makes saved API keys unreadable.         |
| `BETTER_AUTH_URL`     | your public URL, e.g. `https://app.example.com`. If unset, it falls back to the Vercel URL. **Set it when you use a custom domain.** |
| `CORS_ORIGIN`         | defaults to `BETTER_AUTH_URL`. Set it only if they differ.                                                                           |

`NODE_ENV` is set by Vercel. Integration keys (R2, Resend, OAuth, Polar) are optional here: you can enter them in Admin > API Keys after the first deploy instead.

To copy values from a file instead of typing them, put them in a git-ignored file such as `apps/web/.env.production.local` and run:

```bash
pnpm env:production apps/web/.env.production.local
pnpm env:preview apps/web/.env.preview.local
```

The script only syncs keys declared in `.env.schema`, skips empty values, and warns about values that look local (`localhost`, `127.0.0.1`). Note that `apps/web/.env.production` (without `.local`) is **not** git-ignored.

Use a separate Neon branch, and separate secrets, for Preview.

## 4. Integrations

### OAuth callback URLs

Register these with each provider, using your production `BETTER_AUTH_URL`:

| Provider | Where                                                                                 | Callback URL                                     |
| -------- | ------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Google   | Google Cloud Console > APIs & Services > Credentials > OAuth client (Web application) | `https://<your domain>/api/auth/callback/google` |
| GitHub   | GitHub > Settings > Developer settings > OAuth Apps                                   | `https://<your domain>/api/auth/callback/github` |

Then save the client ID and secret in Admin > API Keys and turn on Social login in Admin > Features.

Preview deployments have changing URLs, so OAuth usually only works on production and on a fixed preview domain.

### Polar webhook

1. In Polar, create a webhook endpoint: `https://<your domain>/api/webhooks/polar`.
2. Subscribe to the `subscription.*` events (other events are acknowledged and ignored).
3. Copy the signing secret into Admin > API Keys (Polar webhook secret), with the access token and organization ID.
4. Turn **off** sandbox mode in Admin > API Keys for live payments. Use Polar's sandbox (and sandbox keys) on Preview.

The webhook returns 401 when the signature is wrong and 500 when no secret is configured.

### R2 public URL

1. In Cloudflare, create an R2 bucket and an API token with object read and write for that bucket.
2. Make the bucket readable: enable the `r2.dev` public URL, or (better for production) connect a custom domain such as `files.example.com`.
3. In Admin > API Keys, enter the account ID, access key ID, secret access key, bucket name and the public base URL (no trailing slash needed). Click **test connection**.

Uploads go through the server, so the bucket needs no CORS rules. `next.config.ts` allows images from any HTTPS host.

### Resend

Verify your sending domain in Resend, then save the API key and a from address on that domain in Admin > API Keys. Without a key, production emails are **not sent** (they are only logged as errors), so verification, password reset and invitations will not work.

## Security of the first sign-up

The first account created in an empty database becomes admin. If you deploy to a public URL before creating your account, a stranger could become admin. Either seed your admin first (step 1.4), or sign up yourself immediately after the first deploy and check Admin > Users.

## Post-deploy checklist

- [ ] The build passed env validation (no missing variable errors in the build log).
- [ ] `https://<your domain>/api/trpc/health` returns `ok: true`.
- [ ] You can sign in as the admin and open `/admin`.
- [ ] Admin > General: app name, description, URL, SEO and theme are set.
- [ ] Admin > API Keys: R2 test connection succeeds; an avatar upload works.
- [ ] A test sign-up receives the verification email (if verification is on).
- [ ] Password reset email arrives.
- [ ] Google and GitHub sign-in work (if enabled).
- [ ] A Polar checkout completes and the user sees the Pro area; the webhook delivery shows 200 in Polar.
- [ ] Maintenance mode shows the maintenance page to a non-admin and not to you.
- [ ] Disabled modules return 404.
- [ ] `audit_log` has rows for your admin changes.
- [ ] `APP_ENCRYPTION_KEY` and `BETTER_AUTH_SECRET` are saved in a password manager.
