# Settings and integrations

## The `app_settings` row

Admins change the product at runtime, without a redeploy. All of that configuration lives in one database row: table `app_settings`, `id = "default"` (`APP_SETTINGS_ID`). The table is defined in `packages/db/src/schema/app.ts`.

| Group                     | Columns (examples)                                                                                                                       | Edited in             |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| General, branding, SEO    | `appName`, `appDescription`, `appUrl`, `metaTitle`, `metaDescription`, `ogImage`, `appTheme`, `supportEmail`                             | Admin > General       |
| Legal                     | `privacyContent`, `termsContent`                                                                                                         | Admin > General       |
| Sign-up and session rules | `signupsEnabled`, `defaultUserRole`, `maxUsersEnabled`, `maxUsers`, `sessionTimeout`                                                     | Admin > General       |
| Maintenance               | `maintenanceMode`, `maintenanceMessage`                                                                                                  | Admin > General       |
| Feature toggles           | `onboardingEnabled`, `emailVerificationEnabled`, `forgotPasswordEnabled`, `socialLoginEnabled`, `organizationsEnabled`, `invitesEnabled` | Admin > Features      |
| Waitlist                  | `waitlistMode`, `waitlistTitle`, `waitlistHeadline`, ..., `waitlistShowName`, `waitlistShowCompany`                                      | Admin > Site Settings |
| Countdown                 | `countdownMode`, `countdownTarget`, `countdownTitle`, ..., `countdownEndMessage`                                                         | Admin > Site Settings |
| Integrations              | R2, Resend, Google, GitHub, Polar columns, `polarSandboxMode`                                                                            | Admin > API Keys      |

The admin pages are being ported from Batman, so a field may move between pages. The column list in `packages/db/src/schema/app.ts` and `settingsUpdateInput` in `packages/api/src/routers/settings.ts` are the source of truth.

Defaults on a new database: onboarding on, forgot password on, sign-ups on; email verification, social login, organizations, invitations and all site modes off.

The row is created automatically the first time anything reads it. `pnpm db:seed` also makes sure it exists.

## The settings service

`createSettingsService(db, env)` in `packages/core/src/settings.ts` is the only code that reads or writes the row. You reach it as `ctx.services.settings` in procedures, or `getServices().settings` elsewhere.

| Method                                 | Use                                                                                          |
| -------------------------------------- | -------------------------------------------------------------------------------------------- |
| `get()`                                | The row. Throws if the database is unreachable.                                              |
| `getSafe()`                            | The row, or `null` on error. For layouts and metadata that must render without a database.   |
| `update(patch, executor?)`             | Writes non-integration columns. Pass `ctx.db` inside a mutation so it joins the transaction. |
| `getIntegrationKeys()`                 | Decrypted keys merged with env fallbacks. Server-only.                                       |
| `setIntegrationKeys(input, executor?)` | Encrypts secrets and saves keys. Empty string clears a key; `undefined` leaves it alone.     |
| `invalidate()`                         | Drops the cache. `update` and `setIntegrationKeys` call it for you.                          |

### The cache

Reads are cached in memory for 10 seconds per server process. `update` and `setIntegrationKeys` clear the cache in the process that made the change. Other processes (other serverless instances) see the change within 10 seconds. Keep this in mind when you test a toggle on a deployed app.

### What the browser can see

`packages/api/src/routers/settings.ts` controls exposure:

| Procedure             | Who    | Returns                                                                                             |
| --------------------- | ------ | --------------------------------------------------------------------------------------------------- |
| `settings.public`     | anyone | a curated list: name, description, URL, theme, support email, toggles, maintenance flag and message |
| `settings.authConfig` | anyone | which auth options to show (including whether Google or GitHub is configured)                       |
| `settings.legal`      | anyone | privacy or terms content                                                                            |
| `settings.siteModes`  | anyone | countdown and waitlist content, or `null` when off                                                  |
| `settings.adminGet`   | admin  | every column except the secret ones                                                                 |
| `settings.apiKeys`    | admin  | integration keys, with secrets masked (`abcd••••••••wxyz`)                                          |

Never add an integration column to `toPublicSettings`.

### Adding a setting

1. Add the column to `packages/db/src/schema/app.ts` with a default.
2. `pnpm db:generate`, review the SQL, `pnpm db:migrate`.
3. Add the field to `settingsUpdateInput` in `packages/api/src/routers/settings.ts`.
4. If visitors need it, add it to `toPublicSettings`.
5. Add the control to the admin page.

## Encrypted secrets

Third-party secrets saved in Admin > API Keys are encrypted at rest with AES-256-GCM (`packages/core/src/secrets.ts`). The key is derived (SHA-256) from `APP_ENCRYPTION_KEY`. Stored values look like `v1:<iv>:<tag>:<data>`.

Encrypted columns are listed in `SECRET_KEYS` in `packages/core/src/types.ts`:

`storageAccessKeyId`, `storageSecretAccessKey`, `resendApiKey`, `googleClientSecret`, `githubClientSecret`, `polarAccessToken`, `polarWebhookSecret`.

Non-secret integration values (`PLAIN_INTEGRATION_KEYS`) are stored as plain text: `storagePublicUrl`, `storageBucket`, `storageAccountId`, `resendFromEmail`, `googleClientId`, `githubClientId`, `polarOrganizationId`.

**If you change `APP_ENCRYPTION_KEY`, saved secrets can no longer be decrypted.** The app logs "could not decrypt a stored secret" and treats the key as missing (falling back to env). Re-enter the keys in Admin > API Keys.

The admin form receives masked values. When it saves, any value that still contains the mask character `•` is ignored, so unchanged fields are never overwritten with the mask.

### Adding a new third-party secret

1. Add a nullable text column in `packages/db/src/schema/app.ts`, then generate and apply a migration.
2. Add its name to `SECRET_KEYS` (or `PLAIN_INTEGRATION_KEYS`) in `packages/core/src/types.ts`.
3. Add it to `getIntegrationKeys()` in `packages/core/src/settings.ts`.
4. Add an optional env fallback in `apps/web/.env.schema` and map it in `fallbacks` in `apps/web/src/server/services.ts`.
5. Add it to `apiKeysInput` and the `apiKeys` output in `packages/api/src/routers/settings.ts` (masked if secret).

## Admin keys override env

For every integration, the value saved in Admin > API Keys wins. The matching `.env` variable is used only when the database value is empty. So you can:

- run locally with keys in `.env`, and
- run in production with keys entered in the admin panel, with no redeploy to rotate them.

## File storage (Cloudflare R2)

`createStorageService(settings)` in `packages/core/src/storage.ts` talks to R2 through the S3 API (`@aws-sdk/client-s3`). Any S3-compatible store works: put a full endpoint URL in the account ID field.

Storage is configured only when all five values are set: account ID, access key ID, secret access key, bucket and public URL. Admin > API Keys has a **test connection** button (`settings.testStorage`).

Files live in one bucket, in three folders:

| Folder        | Max size | Allowed types                     | Who may upload     |
| ------------- | -------- | --------------------------------- | ------------------ |
| `avatars`     | 5 MB     | PNG, JPEG, WebP, GIF, AVIF        | any signed-in user |
| `uploads`     | 10 MB    | images, PDF, plain text, CSV, ZIP | any signed-in user |
| `attachments` | 20 MB    | images, PDF, plain text, CSV, ZIP | admins only        |

Object keys are `<folder>/<userId>/<timestamp>-<clean name>`. The upload route (`apps/web/src/app/api/upload/route.ts`):

- `POST`: requires a session, applies `RATE_LIMITS.upload` (30 per 10 minutes), checks folder, size and type, uploads, and returns `{ url }`.
- `DELETE`: requires a session, and only deletes a file whose key contains the caller's user ID (admins may delete any file).

Use `uploadFile(folder, file)` and `deleteFile(url)` from `apps/web/src/lib/upload.ts` in the browser. Clients never hold storage credentials.

## Email (Resend) and the dev outbox

`createEmailService(settings, env)` in `packages/core/src/email.ts` exposes `send({ to, subject, html, text? })`.

- With a Resend API key, it sends through Resend. The sender is `resendFromEmail`, or `<app name> <onboarding@resend.dev>` when that is empty (or still contains `yourdomain.com`).
- **Without a key, in development:** it prints the email to the server console (the "dev outbox") and reports success. Sign-up, verification, reset and invitation flows all work without a Resend account. Copy the link from the terminal.
- **Without a key, in production:** it logs an error and returns `false`.

Build HTML with `emailTemplate({ appName, heading, body, actionUrl?, actionLabel? })`. Escape every user-supplied value in `body` with `escapeHtml()`.

## Payments (Polar)

`createPaymentsService(db, settings)` in `packages/core/src/payments.ts` wraps the Polar SDK:

| Function                                                           | Use                                                                                    |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `listProducts`, `createProduct`, `updateProduct`, `archiveProduct` | Admin > Products                                                                       |
| `createCheckout({ productId, user, successUrl, returnUrl })`       | Pricing page. Sets `externalCustomerId` to the user's ID.                              |
| `getSubscriptionStatus(userId)`                                    | The Pro area. Active means status `active` or `trialing` and the period has not ended. |
| `handleWebhook(body, headers)`                                     | `POST /api/webhooks/polar`                                                             |

The webhook verifies the signature with the webhook secret (invalid: 401). For `subscription.*` events it finds the user by external ID (or by email as a fallback) and upserts the `subscription` row. Other events are acknowledged and ignored.

Product features are stored inside the Polar description after a `\n\n---\n` line (Batman's convention). `parseProductDescription` and `buildProductDescription` handle this.

**Sandbox mode** (Admin > API Keys) points the SDK at Polar's sandbox. It is on by default (`polarSandboxMode` defaults to `true`). Turn it off for live payments.

Payments are isolated in this one file. To switch to Stripe or another provider, re-implement the same functions.
