# Project Starter

Project Starter is a production-ready monorepo for building a SaaS product. It ships the parts every product needs (sign-in, an admin panel, organizations, notifications, a blog, billing, launch modes and feedback), so you can start on the parts that make your product different. It combines three sources: the Batman Next.js boilerplate (the features), the Guardrail engineering rules (how code is written and secured), and the tarikcrafts-platform stack (Drizzle on Neon Postgres, tRPC, Better Auth, Varlock, Nx).

> **Status.** Every Batman feature is ported and verified from a clean clone: install, `pnpm bootstrap`, `pnpm check` (lint, format, types, unit and database tests), production build and the Playwright smoke tests all pass. Real OAuth logins, Resend delivery, Polar checkout and R2 uploads need your own keys, so they are covered by unit tests but not yet verified against the live services. See [Known gaps](#known-gaps).

## Features

**Authentication** (Better Auth 1.7)

- Email and password sign-up and login
- Email verification and forgot / reset password (each can be switched on or off by an admin)
- Google and GitHub login, configured from Admin > API Keys
- The first user to sign up becomes admin; or create an admin with `pnpm db:seed`
- Global roles (`admin`, `user`) and fine-grained permissions, ban / unban (impersonation is available through the admin plugin API but has no UI, as in Batman)
- Sign-ups on/off, maximum user cap, default role and session length, all from the admin panel
- Rate limits on sign-in, sign-up, password reset and verification emails

**Admin panel** (`/admin`)

- Overview, Users, Analytics (charts and a world map), Blog, Notifications, Products (Polar), Feedback
- General (app name, SEO, OG image, theme), Site Settings (waitlist and countdown), Features (toggles)
- API Keys (encrypted third-party keys), Audit Log, Deployment checklist

**User area** (`/dashboard`)

- Dashboard home and onboarding wizard (toggleable)
- Organizations with owner / admin / member roles, and email invitations (toggleable)
- Notifications inbox with tags, read / unread and filters
- Settings: profile (name, bio, avatar), account (password, sessions, delete account), appearance (light / dark / system)
- A "Pro" area for users with an active Polar subscription
- In-app feedback dialog

**Public site**

- Landing, pricing and subscribe pages
- Blog list and post pages (rich-text editor for admins)
- Privacy and terms pages, edited from the admin panel
- Waitlist mode, countdown (launch) mode and maintenance mode (admins bypass maintenance)
- Custom 404 and error pages

**Billing**

- Polar products, checkout and a signed webhook that keeps the `subscription` table in sync
- Sandbox mode switch in Admin > API Keys

**Platform and security**

- One security checkpoint for every API call: rate limit, authentication, role / permission check, transaction and audit row
- Every admin and user mutation is written to `audit_log` in the same transaction as the change
- Third-party secrets are encrypted at rest (AES-256-GCM) and only shown masked
- File uploads go through the server with per-folder size and type limits, and users can only delete their own files
- Module registry: switch off a whole module (routes and navigation) with one flag
- Five brand colour presets, plus dark mode
- Dev outbox: without a Resend key, emails print to the server console in development
- Expo native app and a Fumadocs documentation site share the same workspace

## Stack

| Layer     | Choice                                                                               |
| --------- | ------------------------------------------------------------------------------------ |
| Web app   | Next.js 16 (App Router, React 19, React Compiler, typed routes)                      |
| API       | tRPC 11 in `packages/api`, served at `/api/trpc`                                     |
| Database  | Postgres (Neon recommended, Docker for local), Drizzle ORM `1.0.0-rc.4`, `pg` driver |
| Auth      | Better Auth 1.7.7 with the Drizzle adapter, admin and organization plugins           |
| Env       | Varlock (`.env.schema` per app, typed `ENV`)                                         |
| UI        | Shared `packages/ui` (shadcn/ui, Tailwind CSS 4), `lucide-react` icons               |
| Forms     | TanStack Form + Zod                                                                  |
| Email     | Resend                                                                               |
| Payments  | Polar                                                                                |
| Files     | Cloudflare R2 (any S3-compatible store)                                              |
| Tooling   | pnpm 11, Nx 23, TypeScript 6, Oxlint + Oxfmt, Vitest                                 |
| Native    | Expo (in `apps/native`)                                                              |
| Docs site | Fumadocs (in `apps/docs`)                                                            |
| Deploy    | Vercel                                                                               |

## Quick start

**You need:** Node 22 or newer, pnpm 11, and either Docker (for a local Postgres) or a Neon database.

```bash
pnpm install
pnpm bootstrap                 # interactive: asks Docker or a connection string, optional admin account
# or, non-interactive with a local Docker Postgres:
pnpm bootstrap --yes --docker
pnpm dev
```

Open http://localhost:3001.

`pnpm bootstrap` writes `apps/web/.env` (keeping values already there), generates `BETTER_AUTH_SECRET` and `APP_ENCRYPTION_KEY`, starts Postgres in Docker if you chose it, then runs `pnpm env:generate`, `pnpm db:migrate` and `pnpm db:seed`.

**Your first admin.** The first account that signs up becomes admin. Or set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in `apps/web/.env` and run `pnpm db:seed`.

The full from-zero guide, with troubleshooting, is in [docs/SETUP.md](docs/SETUP.md).

## Commands

All commands run from the repository root.

| Command                                                  | What it does                                                                                                                               |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm bootstrap`                                         | First-run setup: writes `apps/web/.env`, optional Docker Postgres, migrate, seed. Add `--yes` for defaults and `--docker` to force Docker. |
| `pnpm dev` / `pnpm dev:web`                              | Web app on http://localhost:3001                                                                                                           |
| `pnpm dev:docs`                                          | Documentation site on http://localhost:4000                                                                                                |
| `pnpm dev:native`                                        | Expo dev server for the native app                                                                                                         |
| `pnpm dev:all`                                           | Every app's `dev` task                                                                                                                     |
| `pnpm build`                                             | Production build of web and docs                                                                                                           |
| `pnpm check-types`                                       | Type check every project                                                                                                                   |
| `pnpm test`                                              | Tests (Vitest) in every project. Database tests run only when `TEST_DATABASE_URL` is set.                                                  |
| `pnpm test:integration`                                  | API tests, including the procedure-builder tests that run only when `TEST_DATABASE_URL` is set                                             |
| `pnpm lint`                                              | Oxlint                                                                                                                                     |
| `pnpm format` / `pnpm format:check`                      | Oxfmt write / check                                                                                                                        |
| `pnpm check`                                             | lint + format check + type check + tests                                                                                                   |
| `pnpm db:generate`                                       | Create a SQL migration from schema changes                                                                                                 |
| `pnpm db:migrate`                                        | Apply migrations                                                                                                                           |
| `pnpm db:push`                                           | Push the schema without a migration (throwaway databases only)                                                                             |
| `pnpm db:studio`                                         | Drizzle Studio                                                                                                                             |
| `pnpm db:seed`                                           | Idempotent seed: settings row and optional admin                                                                                           |
| `pnpm db:reset`                                          | Drop everything, re-migrate and re-seed (refuses when `NODE_ENV=production`)                                                               |
| `pnpm auth:check`                                        | Check that `packages/db/src/schema` has every table and column Better Auth expects (see [database.md](docs/engineering/database.md))       |
| `pnpm env:generate`                                      | Regenerate typed env files from the `.env.schema` files (runs after install)                                                               |
| `pnpm deploy:setup`                                      | Link the repo to a Vercel project                                                                                                          |
| `pnpm env:preview` / `pnpm env:production`               | Copy env values from an env file to Vercel                                                                                                 |
| `pnpm deploy` / `pnpm deploy:prod` / `pnpm deploy:check` | Preview deploy / production deploy / dry run                                                                                               |

## Project structure

```
Project-Starter/
├── apps/
│   ├── web/                 Next.js app: pages, layouts, route handlers, server actions
│   │   ├── .env.schema      every environment variable (Varlock)
│   │   ├── scripts/seed.ts  idempotent seed
│   │   └── src/
│   │       ├── app/         routes: (auth), dashboard, admin, blog, pricing, api/...
│   │       ├── components/  shared app components
│   │       ├── lib/actions/ server actions (thin adapters over tRPC)
│   │       ├── lib/trpc/    useTRPC() client
│   │       ├── server/      services.ts (composition root), trpc.ts, session.ts, env.ts
│   │       └── proxy.ts     returns 404 for disabled modules (Next 16; no middleware.ts)
│   ├── native/              Expo app using the same auth and tRPC API
│   └── docs/                Fumadocs site
├── packages/
│   ├── api/                 tRPC: procedure builder (trpc.ts), routers/, services/, lib/
│   ├── auth/                Better Auth factory, roles and permissions
│   ├── config/              module registry, branding, themes, option lists, base tsconfig
│   ├── core/                settings, secrets, email, storage, payments, notify, logger
│   ├── db/                  Drizzle schema, relations, migrations
│   └── ui/                  shadcn/ui primitives and theme tokens (globals.css)
├── scripts/                 bootstrap.ts, sync-vercel-env.ts
├── .github/workflows/ci.yml lint, format, types, migrate, tests, web build on every push and PR
├── docs/                    engineering guides, setup, environment reference
└── CLAUDE.md                rules for AI coding agents (AGENTS.md points here)
```

## Start a new project from this starter

1. **Copy the repo** and give it a new name in the root `package.json`.
2. **Rename the package scope (optional).** Packages are named `@starter/*`. To rename, change every `package.json` name and dependency, every import, and `transpilePackages` in `apps/web/next.config.ts`. Then run `pnpm install` and `pnpm check-types`.
3. **Branding.** Edit `packages/config/src/branding.ts`. The live app name, description and SEO come from Admin > General (stored in the database), so set them there too after the first sign-in. The database default for the app name is in `packages/db/src/schema/app.ts`.
4. **Theme.** Pick a preset in Admin > General, or add your own (see [customizing.md](docs/engineering/customizing.md)).
5. **Modules.** Set `enabled: false` in `packages/config/src/modules.ts` for anything you don't need (see [modules.md](docs/engineering/modules.md)).
6. **Native app.** In `apps/native/app.json` change `name`, `slug`, `scheme`, `ios.bundleIdentifier` and `android.package`. If you change `scheme`, also change the `project-starter://` trusted origin in `apps/web/src/server/services.ts`.
7. **New database.** Create a new Neon project (or use Docker locally). Never reuse another product's database.
8. **New secrets.** Delete `apps/web/.env` and run `pnpm bootstrap` to generate a fresh `BETTER_AUTH_SECRET` and `APP_ENCRYPTION_KEY`. Never copy these between projects.
9. **Integrations.** Add R2, Resend, OAuth and Polar keys in Admin > API Keys.
10. **Docs site.** Update `appName` and `gitConfig` in `apps/docs/src/lib/shared.ts`.

## Documentation

- [docs/SETUP.md](docs/SETUP.md): from zero to a running app, with troubleshooting
- [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md): every environment variable
- [docs/engineering/00-start-here.md](docs/engineering/00-start-here.md): how the code is organised and why (read order)
- [docs/engineering/deployment.md](docs/engineering/deployment.md): deploying to Vercel
- [docs/engineering/security.md](docs/engineering/security.md): what the starter enforces
- [CLAUDE.md](CLAUDE.md): the rules every AI coding agent follows

## Known gaps

These were true when this README was written. Remove each line when it is fixed.

- Integrations that need your own accounts are not verified live: Google/GitHub OAuth, Resend delivery, Polar checkout and webhooks, R2 uploads. Their surrounding logic (validation, signatures, masking, limits) is tested, and Admin > API Keys shows a "configured" badge for each.
- The Expo app type-checks and is wired to the same API and auth, but it has not been run on a device or simulator. It has sign-in/sign-up and a status screen only; Batman had no mobile screens.
- No deployment to Vercel has been run yet. Follow [docs/engineering/deployment.md](docs/engineering/deployment.md).
- Better Auth only creates a session after email verification when verification is on, so users land on `/verify-email` first. This is expected.
