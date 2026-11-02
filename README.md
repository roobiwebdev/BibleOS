# BibleOS

BibleOS is a local-first macOS Bible study app in `apps/desktop` (Tauri 2, Vite, React 19, local SQLite). It offers Amharic and English parallel reading, study notes and a reading-habit tracker. Everything stays on the user's Mac. See [docs/engineering/desktop.md](docs/engineering/desktop.md) and the [Desktop app](#desktop-app) commands below.

It is built on Project Starter. The web and SaaS code described in the rest of this README stays in the repo but is not part of the desktop build.

## Project Starter

Project Starter is a production-ready monorepo for building a SaaS product. It ships the parts every product needs (sign-in, an admin panel, organizations, notifications, a blog, billing, launch modes and feedback), so you can start on the parts that make your product different. It combines three sources: the Batman Next.js boilerplate (the features), the Guardrail engineering rules (how code is written and secured), and the tarikcrafts-platform stack (Drizzle on Neon Postgres, tRPC, Better Auth, Varlock, Nx).

> **Status.** Every Batman feature is ported and verified from a clean clone: install, `pnpm bootstrap`, `pnpm check` (lint, format, types, unit and database tests), production build and the Playwright smoke tests all pass. Real OAuth logins, Resend delivery, Polar checkout and R2 uploads need your own keys, so they are covered by unit tests but not yet verified against the live services. See [Known gaps](#known-gaps).

## Install

Copy and paste this to start a new project (needs Node 22+, pnpm 11, and Docker or a Neon database):

```bash
git clone https://github.com/roobiwebdev/Projects-Starter my-app
cd my-app && pnpm install && pnpm bootstrap
pnpm dev
```

Then open http://localhost:3001. Replace `my-app` with your project's name. To give the new project its own git history (so it never pushes to the starter repo), run `rm -rf .git && git init` inside it. The steps after this are in [Start a new project from this starter](#start-a-new-project-from-this-starter).

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
| `pnpm rea <command>`                                     | REA reverse-engineering CLI (see [Reverse engineering with REA](#reverse-engineering-with-rea))                                            |

## Desktop app

The desktop app needs Rust (install with `rustup`) for the Tauri commands; the browser preview does not.

| Command                                          | What it does                                                                                                                        |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter desktop bibles`                   | Build the translation databases into `src-tauri/resources/bibles` and the preview JSON into `public/preview-bible`. Run once first. |
| `pnpm --filter desktop dev:vite`                 | Desktop UI in the browser preview on http://localhost:1420                                                                          |
| `pnpm --filter desktop dev`                      | Desktop app in Tauri                                                                                                                |
| `pnpm --filter desktop build`                    | Production build (`.app` and DMG)                                                                                                   |
| `pnpm --filter @starter/bible-data build:bibles` | Translation databases only                                                                                                          |

Builds are unsigned (no Apple Developer Program). The first time someone opens the app, they allow it once in System Settings → Privacy & Security → Open Anyway.

## Project structure

```
Project-Starter/
├── apps/
│   ├── desktop/             BibleOS: Tauri 2 shell (src-tauri) + Vite React SPA (src)
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
│   ├── bible-core/          pure TS: books, verse ids, references, normalize, calendar, habits
│   ├── bible-data/          pinned USFM sources → one read-only SQLite per translation
│   ├── api/                 tRPC: procedure builder (trpc.ts), routers/, services/, lib/
│   ├── auth/                Better Auth factory, roles and permissions
│   ├── config/              module registry, branding, themes, option lists, base tsconfig
│   ├── core/                settings, secrets, email, storage, payments, notify, logger
│   ├── db/                  Drizzle schema, relations, migrations
│   └── ui/                  shadcn/ui primitives and theme tokens (globals.css)
├── scripts/                 bootstrap.ts, sync-vercel-env.ts
├── .github/workflows/ci.yml lint, format, types, migrate, tests, web build on every push and PR
├── docs/                    engineering guides, setup, environment reference
├── .agents/skills/          agent skills (linked from .claude/skills/, pinned in skills-lock.json)
└── CLAUDE.md                rules for AI coding agents (AGENTS.md points here)
```

## Start a new project from this starter

1. **Clone the repo** with the [Install](#install) command, then give it a new name in the root `package.json`.
2. **Rename the package scope (optional).** Packages are named `@starter/*`. To rename, change every `package.json` name and dependency, every import, and `transpilePackages` in `apps/web/next.config.ts`. Then run `pnpm install` and `pnpm check-types`.
3. **Branding.** Edit `packages/config/src/branding.ts`. The live app name, description and SEO come from Admin > General (stored in the database), so set them there too after the first sign-in. The database default for the app name is in `packages/db/src/schema/app.ts`.
4. **Theme.** Pick a preset in Admin > General, or add your own (see [customizing.md](docs/engineering/customizing.md)).
5. **Modules.** Set `enabled: false` in `packages/config/src/modules.ts` for anything you don't need (see [modules.md](docs/engineering/modules.md)).
6. **Native app.** In `apps/native/app.json` change `name`, `slug`, `scheme`, `ios.bundleIdentifier` and `android.package`. If you change `scheme`, also change the `project-starter://` trusted origin in `apps/web/src/server/services.ts`.
7. **New database.** Create a new Neon project (or use Docker locally). Never reuse another product's database.
8. **New secrets.** Delete `apps/web/.env` and run `pnpm bootstrap` to generate a fresh `BETTER_AUTH_SECRET` and `APP_ENCRYPTION_KEY`. Never copy these between projects.
9. **Integrations.** Add R2, Resend, OAuth and Polar keys in Admin > API Keys.
10. **Docs site.** Update `appName` and `gitConfig` in `apps/docs/src/lib/shared.ts`.

## Agent skills

Claude Code loads these skills on demand when a task matches (or type `/<skill-name>`). They live in `.agents/skills/` and are linked from `.claude/skills/`. Skills from public repos are pinned in `skills-lock.json`; run `npx skills update` to refresh them. How they fit together is in [CLAUDE.md](CLAUDE.md), section 10.

| Area       | Skills                                                                                                                                                                                                                                        |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Planning   | `architect-feature`: plan a feature with source-of-truth reuse and a security pass before writing code                                                                                                                                        |
| Workflow   | `new-feature`: one git worktree and branch per task · `evidence-driven-testing`: record proof that changed behavior works · `before-and-after`: before/after screenshot tables · `unslop`: strip AI-sounding prose from commits, PRs and docs |
| Web and UI | `shadcn`, `web-design-guidelines`, `vercel-react-best-practices`, `vercel-composition-patterns`                                                                                                                                               |
| Auth       | `better-auth-best-practices`, `better-auth-security-best-practices`, `email-and-password-best-practices`                                                                                                                                      |
| Database   | `neon-postgres`                                                                                                                                                                                                                               |
| Mobile     | `expo-overview`, `expo-router`, `expo-native-ui`, `expo-data-fetching`, `expo-dev-client`, `eas-workflows`, `eas-app-stores`, `heroui-native`, `vercel-react-native-skills`                                                                   |
| Deploy     | `deploy-to-vercel`                                                                                                                                                                                                                            |
| Research   | `reverse-engineer-anything` (see below)                                                                                                                                                                                                       |

Workflow skills come from [michaelshimeles/skills](https://github.com/michaelshimeles/skills). `before-and-after` is vendored from vercel-labs under PolyForm Shield 1.0.0 and `unslop` from cursor/plugins under MIT; both licences sit in their folders. Starter-specific rules (worktrees in `.worktrees/`, evidence in `.artifacts/`, screenshots stay local unless you ask for an upload) are in `CLAUDE.md` so the skills themselves stay untouched and updatable. `evidence-driven-testing` needs Python 3 and an ffmpeg built with libass (on macOS the default Homebrew `ffmpeg` lacks it: run `brew install ffmpeg-full` and put `$(brew --prefix ffmpeg-full)/bin` first on your `PATH`; check with `python3 .agents/skills/evidence-driven-testing/scripts/evidence.py doctor`); `before-and-after` runs `npx @vercel/before-and-after`.

## Reverse engineering with REA

The repo ships with [REA (Reverse Engineer Anything)](https://github.com/morluto/rea) wired into Claude Code, so an agent can study how a feature works in an existing app (a native binary, an Electron or JavaScript bundle, a .NET assembly or a live website) and then build your own version here.

- **MCP server:** `.mcp.json` registers `rea` (`npx -y rea-agents@6.7.0 mcp`, compact schemas). Claude Code asks you to approve the project's MCP servers the first time you open the repo. Nothing is installed globally.
- **Skill:** `.agents/skills/reverse-engineer-anything` (linked from `.claude/skills/`) tells the agent when and how to use REA. It matches REA 6.7.0 and keeps REA's MIT licence.
- **Ask your agent:** "Understand how search works in the Notes app, show me the evidence, and build a similar feature for this project."
- **Terminal:** `pnpm rea --help`, or for example `pnpm rea analyze-javascript-application /absolute/path/to/app --json`.
- **Native binaries** need Hopper, Ghidra or IDA installed. JavaScript, Electron and website analysis need nothing extra. Run `pnpm rea doctor --client claude_code --json` to see what is available.
- **Update:** change `6.7.0` in `.mcp.json` and the `rea` script in `package.json`, then refresh the skill from the new `rea-agents` package (`npm pack rea-agents@<version>` and copy `package/skills/reverse-engineer-anything`).

Only analyse software you are allowed to inspect, and rebuild features in your own code rather than copying someone else's.

## Documentation

- [docs/SETUP.md](docs/SETUP.md): from zero to a running app, with troubleshooting
- [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md): every environment variable
- [docs/engineering/00-start-here.md](docs/engineering/00-start-here.md): how the code is organised and why (read order)
- [docs/engineering/desktop.md](docs/engineering/desktop.md): the BibleOS desktop app and why it is built this way
- [docs/engineering/deployment.md](docs/engineering/deployment.md): deploying to Vercel
- [docs/engineering/security.md](docs/engineering/security.md): what the starter enforces
- [CLAUDE.md](CLAUDE.md): the rules every AI coding agent follows

## Known gaps

These were true when this README was written. Remove each line when it is fixed.

- Integrations that need your own accounts are not verified live: Google/GitHub OAuth, Resend delivery, Polar checkout and webhooks, R2 uploads. Their surrounding logic (validation, signatures, masking, limits) is tested, and Admin > API Keys shows a "configured" badge for each.
- The Expo app type-checks and is wired to the same API and auth, but it has not been run on a device or simulator. It has sign-in/sign-up and a status screen only; Batman had no mobile screens.
- No deployment to Vercel has been run yet. Follow [docs/engineering/deployment.md](docs/engineering/deployment.md).
- Better Auth only creates a session after email verification when verification is on, so users land on `/verify-email` first. This is expected.
