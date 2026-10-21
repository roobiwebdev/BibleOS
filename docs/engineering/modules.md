# Modules

A module is a prebuilt feature that a new product may or may not need. The registry is `packages/config/src/modules.ts`. It is the single source of truth for which modules exist, which routes each owns and which navigation entries each adds.

## The registry

Each entry in `MODULES` has:

| Field                  | Meaning                                                                                        |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| `label`, `description` | Human-readable name and summary                                                                |
| `enabled`              | Build-time switch. `false` hides the module's nav and makes its routes return 404.             |
| `routes`               | Route prefixes the module owns. `apps/web/src/proxy.ts` blocks them when `enabled` is `false`. |
| `dashboardNav`         | Entries for the user dashboard sidebar                                                         |
| `adminNav`             | Entries for the admin sidebar                                                                  |

The file also exports:

- `DASHBOARD_NAV` and `ADMIN_NAV`: the nav entries of enabled modules. Admin entries are sorted by `ADMIN_NAV_ORDER`.
- `DISABLED_ROUTE_PREFIXES`: routes of disabled modules, read by `proxy.ts`.
- `isModuleEnabled(key)` and the `ModuleKey` type.

A nav entry may have `requiresSetting: "organizationsEnabled" | "invitesEnabled"`. It then shows only when that runtime toggle is on.

`packages/config/src/modules.test.ts` checks that there are no duplicate nav links, that every admin route of an enabled module has a nav entry, and that no routes are blocked while all modules are on.

### Build-time switch versus runtime toggle

|                | Build-time: `enabled` in `modules.ts`     | Runtime: toggles in `app_settings`                                    |
| -------------- | ----------------------------------------- | --------------------------------------------------------------------- |
| Who changes it | a developer, in code                      | an admin, in the admin panel                                          |
| Takes effect   | on the next deploy                        | within about 10 seconds                                               |
| Effect         | the module disappears: no nav, routes 404 | behaviour changes (for example sign-ups closed, organizations hidden) |
| Use for        | "this product will never have a blog"     | "pause sign-ups for a week"                                           |

## The eight modules

| Key             | Owns (routes)                                                                                                                                                     | Main code                                                                                                                        |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `core`          | Always on. Dashboard home and settings; admin Overview, Users, General, Features, API Keys, Audit Log, Deployment. `routes` is empty, so it can never be blocked. | `routers/settings.ts`, `routers/admin.ts`, `routers/user.ts`, `app/dashboard`, `app/admin`                                       |
| `notifications` | `/dashboard/notifications`, `/admin/notifications`                                                                                                                | `routers/notifications.ts`, `services/notifications.ts`, `@starter/core/notify`, tables `notification`, `notification_recipient` |
| `organizations` | `/dashboard/organizations`, `/dashboard/invitations`                                                                                                              | Better Auth organization plugin (`packages/auth`), tables `organization`, `member`, `invitation`                                 |
| `billing`       | `/pricing`, `/subscribe`, `/dashboard/pro`, `/admin/products`, `/api/webhooks/polar`                                                                              | `routers/billing.ts`, `@starter/core/payments`, table `subscription`                                                             |
| `blog`          | `/blog`, `/admin/blog`                                                                                                                                            | `routers/blog.ts`, `services/blog.ts`, table `post`, rich-text editor component                                                  |
| `feedback`      | `/admin/feedback`                                                                                                                                                 | `routers/feedback.ts`, feedback dialog component, table `feedback`, options in `packages/config/src/content.ts`                  |
| `analytics`     | `/admin/analytics`                                                                                                                                                | admin analytics procedures, `geoip-country` (server-only)                                                                        |
| `launch`        | `/admin/site-settings`                                                                                                                                            | waitlist and countdown pages, `routers/waitlist.ts`, table `waitlist_entry`, `settings.siteModes`                                |

Note: the waitlist and countdown landing modes are not separate URLs. The home page renders them when an admin turns them on. Disabling `launch` hides the admin page; also make sure `waitlistMode` and `countdownMode` stay off.

Maintenance mode is part of `core` (a toggle in Admin > General).

## Switching a module off

1. Open `packages/config/src/modules.ts`.
2. Set `enabled: false` on the module.
3. Run `pnpm test` (the registry test must still pass) and `pnpm dev`.
4. Check: the nav entries are gone, and every route listed in `routes` returns 404.

The module's code, tables and API procedures are still there. The procedures are still callable by signed-in users with the right role. If that matters, remove the module.

## Removing a module completely

Do this when you are sure the product will never need it. Work in a branch.

1. **Switch it off first** (above) and make sure the app still works.
2. **Pages.** Delete the module's folders under `apps/web/src/app/` (the ones in `routes`), plus any components used only by them.
3. **Server actions.** Delete its file in `apps/web/src/lib/actions/`.
4. **Router.** Remove its line from `packages/api/src/root.ts`, then delete `packages/api/src/routers/<name>.ts` and its files in `packages/api/src/services/`.
5. **Core service** (billing only). Remove `payments` from `apps/web/src/server/services.ts` and from `ApiServices` in `packages/api/src/context.ts`, then delete `packages/core/src/payments.ts`.
6. **Tables.** Delete the module's tables from `packages/db/src/schema/` and their entries in `relations.ts`. Run `pnpm db:generate`, review the `DROP TABLE` SQL, then `pnpm db:migrate`. This deletes data.
7. **Settings and keys.** Remove columns that only this module used (for example the Polar columns) from `schema/app.ts`, `SECRET_KEYS` / `PLAIN_INTEGRATION_KEYS`, `getIntegrationKeys()`, the settings router, `.env.schema` and `services.ts`. Skip this step if you might bring the module back.
8. **Registry.** Delete the entry from `MODULES` and its hrefs from `ADMIN_NAV_ORDER`.
9. **Type check.** Run `pnpm check-types`. Every leftover import shows up as an error. Fix them all.
10. **Prove it.** `pnpm check`, then click through the app.

Organizations are a Better Auth plugin. To remove them, also remove the `organization(...)` plugin in `packages/auth/src/index.ts` and `organizationClient()` in `apps/web/src/lib/auth-client.ts`, then run `pnpm auth:check` before deleting the tables.

## Adding a module

A module is:

- schema file(s) in `packages/db/src/schema/`
- a router mounted in `packages/api/src/root.ts`
- pages under `apps/web/src/app/...`
- an entry in `packages/config/src/modules.ts`

[06-adding-a-feature.md](06-adding-a-feature.md) builds one end to end.
