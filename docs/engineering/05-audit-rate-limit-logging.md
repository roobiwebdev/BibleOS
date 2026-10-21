# Audit log, rate limits and logging

## Audit log

Every successful mutation made through `protectedProcedure` or `adminProcedure` writes one row to `audit_log`. It is written in the same transaction as the change, so you never get a change without its audit row, or an audit row for a change that rolled back.

### The table

Defined in `packages/db/src/schema/content.ts`:

| Column                   | Holds                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| `userId`                 | who did it (`null` for anonymous public mutations; set to `null` if the user is deleted) |
| `entity`                 | what kind of thing, e.g. `blog`                                                          |
| `action`                 | what happened, e.g. `create`                                                             |
| `entityId`               | the row's ID, when the handler returns or receives an `id`                               |
| `description`            | optional static text from the `audit.describe` option                                    |
| `metadata`               | optional flat JSON map of strings, numbers, booleans and nulls (`AuditMetadata`)         |
| `ipAddress`, `userAgent` | from the request                                                                         |
| `createdAt`              | timestamp                                                                                |

Indexes exist on `userId`, `(entity, entityId)` and `createdAt`.

### How it is written

`transactionalAudit` in `packages/api/src/trpc.ts` does the work. It calls `writeAudit()` from `packages/api/src/lib/audit.ts`. The naming rule is in [02-procedures-and-routers.md](02-procedures-and-routers.md#naming-and-the-audit-convention): entity is the router name, action is the procedure name, unless you override them.

| You want                    | Do this                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------- |
| Default audit               | nothing (protected and admin mutations)                                                     |
| Custom names                | `audit: { entity: "settings", action: "updateApiKeys" }`                                    |
| A fixed description         | `audit: { describe: "Changed the theme" }`                                                  |
| No audit (noisy, low value) | `audit: false`                                                                              |
| Audit a public form         | `publicProcedure({ audit: { entity: "waitlist", action: "join" } })`                        |
| An extra row with metadata  | call `writeAudit(ctx.db, { userId, entity, action, metadata }, ctx.request)` in the handler |

Rules:

- Keep metadata small and flat. No nested objects. No secrets, tokens or personal data beyond IDs.
- Do not audit reads.

Admins read the log at **Admin > Audit Log** (`/admin/audit-log`), served by the `admin.auditLog` procedure. You can also query the table with `pnpm db:studio`.

## Rate limits

There are two limiters. Both store counters in the `rate_limit` table, so they work across serverless instances without Redis.

### API limiter

`consumeRateLimit(db, key, rule)` in `packages/api/src/lib/rate-limit.ts` is a fixed-window counter. Keys are prefixed `api:` so they never collide with Better Auth's keys. It returns `true` when the request is allowed.

Presets (`RATE_LIMITS`):

| Preset       | Limit         | Used for                                |
| ------------ | ------------- | --------------------------------------- |
| `default`    | 120 per 60 s  | every procedure unless overridden       |
| `publicForm` | 5 per 10 min  | anonymous forms such as `waitlist.join` |
| `upload`     | 30 per 10 min | `POST /api/upload`                      |
| `sensitive`  | 10 per 60 s   | actions like `billing.createCheckout`   |

Every procedure is limited automatically. The key is `<procedure path>:<user id>` for signed-in callers and `<procedure path>:<ip>` for anonymous ones. Override per procedure:

```ts
publicProcedure({ rateLimit: RATE_LIMITS.publicForm });
protectedProcedure({ rateLimit: { max: 3, windowSec: 60 } });
```

Route handlers that are not procedures call `consumeRateLimit` themselves (see `/api/upload`).

**IP address source.** The client IP is read from `x-forwarded-for` (first entry), then `x-real-ip`. On Vercel these headers are set by the platform. If you host behind another proxy, make sure it sets them, or anonymous callers will share one bucket.

Add new presets to `RATE_LIMITS`. Do not scatter numbers through routers.

### Better Auth limiter

Better Auth limits its own endpoints (sign-in, sign-up, password reset, verification). See [03-auth-and-permissions.md](03-auth-and-permissions.md#rate-limits-on-auth-endpoints).

## Logging

Use `createLogger(scope)` from `@starter/core/logger`:

```ts
import { createLogger } from "@starter/core/logger";
const log = createLogger("billing");

log.info("checkout created", { productId });
log.error("webhook failed", { type: event.type }, err);
```

- In development it prints readable lines: `[billing] checkout created {"productId":"..."}`.
- In production it prints one JSON object per line (`level`, `scope`, `message`, fields, `error`, `time`), which Vercel and most log drains parse.
- `debug` lines are dropped in production.
- Fields are flat: strings, numbers, booleans, `null`.

Rules:

- Never log secrets, tokens, passwords, full request bodies or full email contents.
- Log the error object as the third argument; only its message is printed.
- To send logs to Axiom, Better Stack or Sentry, change `write()` in `packages/core/src/logger.ts`. Callers do not change.

`console.log` is allowed by the linter, but use the logger in server code. The dev outbox in `email.ts` is the one place that prints email bodies, and only outside production.
