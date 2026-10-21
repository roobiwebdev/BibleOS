# Setup guide

This guide takes you from a fresh machine to a running app. Pick one database path: **A. Docker** (fastest, fully local) or **B. Neon** (hosted Postgres, the same as production).

## 1. Prerequisites

| Tool                  | Version     | Check           | Install                                                                              |
| --------------------- | ----------- | --------------- | ------------------------------------------------------------------------------------ |
| Node.js               | 22 or newer | `node -v`       | nodejs.org, or `nvm install 22`                                                      |
| pnpm                  | 11          | `pnpm -v`       | `corepack enable` (uses the version pinned in `package.json`), or `npm i -g pnpm@11` |
| Git                   | any         | `git --version` |                                                                                      |
| Docker (path A)       | any recent  | `docker info`   | Docker Desktop, OrbStack or Colima                                                   |
| Neon account (path B) |             |                 | neon.tech                                                                            |

`openssl` is handy for generating secrets by hand, but `pnpm bootstrap` generates them for you.

## 2. Install

```bash
git clone <your repo url> my-product
cd my-product
pnpm install
```

`pnpm install` also runs `pnpm env:generate`, which creates the typed env files from the `.env.schema` files.

## 3A. Database with Docker

Make sure Docker is running, then:

```bash
pnpm bootstrap --yes --docker
```

This:

1. Starts a container named `project-starter-pg` (Postgres 17) on `127.0.0.1:54329`, or restarts it if it already exists.
2. Writes `apps/web/.env` with `DATABASE_URL=postgresql://postgres:postgres@localhost:54329/project_starter`, a new `BETTER_AUTH_SECRET`, a new `APP_ENCRYPTION_KEY` and `BETTER_AUTH_URL=http://localhost:3001`.
3. Runs `pnpm env:generate`, `pnpm db:migrate` and `pnpm db:seed`.

Want an admin account created for you? Run the interactive version instead and answer the prompts:

```bash
pnpm bootstrap
# Start a local Postgres in Docker? (y/n) [y]:  y
# Admin email to create (blank = first sign-up becomes admin):  you@example.com
# Admin password (min 8 chars):  ********
```

## 3B. Database with Neon

1. Create a project at neon.tech. Optionally create a `dev` branch so you never touch production data.
2. Click **Connect**. Copy the connection string with **connection pooling on** (the host contains `-pooler`).
3. Run the interactive setup and paste it:

   ```bash
   pnpm bootstrap
   # Start a local Postgres in Docker? (y/n) [y]:  n
   # Postgres connection string (Neon pooled URL or local):  postgresql://...-pooler.../neondb?sslmode=require
   # Admin email to create (blank = first sign-up becomes admin):
   ```

4. Recommended: copy the **direct** connection string (pooling off) too, and add it to `apps/web/.env`:

   ```
   DATABASE_URL_DIRECT=postgresql://...(no -pooler).../neondb?sslmode=require
   ```

   Migrations then use the direct connection. See [engineering/database.md](engineering/database.md#neon-pooled-and-direct-urls).

## 4. Run the app

```bash
pnpm dev
```

Open http://localhost:3001.

## 5. Create your admin

- **If you set an admin email in bootstrap,** sign in with it.
- **Otherwise,** sign up. The first account in the database becomes admin.
- **Later,** you can add `SEED_ADMIN_EMAIL` (and `SEED_ADMIN_PASSWORD` for a new account) to `apps/web/.env` and run `pnpm db:seed`. It promotes an existing account or creates a new one.

Open http://localhost:3001/admin.

## 6. First things to configure

| Where            | What                                                                                      |
| ---------------- | ----------------------------------------------------------------------------------------- |
| Admin > General  | App name, description, SEO, theme, support email, legal pages                             |
| Admin > Features | Onboarding, email verification, forgot password, social login, organizations, invitations |
| Admin > API Keys | R2 (uploads), Resend (email), Google / GitHub (login), Polar (payments)                   |

None of the keys are needed to start. Without a Resend key, **emails print to the terminal running `pnpm dev`**. Copy verification and reset links from there.

Every variable and where to get it: [ENVIRONMENT.md](ENVIRONMENT.md).

## 7. Check everything works

```bash
pnpm check     # lint, format check, type check, unit tests
```

Optional, database tests (Docker path):

```bash
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:54329/project_starter pnpm test:integration
```

## Other apps

| App           | Command           | Notes                                                                                                                                         |
| ------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Docs site     | `pnpm dev:docs`   | http://localhost:4000                                                                                                                         |
| Native (Expo) | `pnpm dev:native` | Needs the web app running. On a physical phone, set `EXPO_PUBLIC_SERVER_URL` in `apps/native/.env` to `http://<your computer's LAN IP>:3001`. |

## Everyday commands

| Task                             | Command                                                                           |
| -------------------------------- | --------------------------------------------------------------------------------- |
| Start the web app                | `pnpm dev`                                                                        |
| Change the schema                | edit `packages/db/src/schema/*.ts`, then `pnpm db:generate` and `pnpm db:migrate` |
| Browse data                      | `pnpm db:studio`                                                                  |
| Start the local database over    | `pnpm db:reset`                                                                   |
| Stop / start the Docker database | `docker stop project-starter-pg` / `docker start project-starter-pg`              |

## Troubleshooting

### Port 3001 is already in use

```bash
lsof -i :3001          # find the process
kill <pid>
```

Or run on another port: `pnpm --filter web exec next dev --port 3002`, and set `BETTER_AUTH_URL=http://localhost:3002` in `apps/web/.env` (auth checks the origin).

### Port 54329 is already in use

Another container or Postgres is using it. Check with `docker ps` and `lsof -i :54329`. Stop the other one, or run your own Postgres on another port and put its URL in `DATABASE_URL`.

### "Cannot connect to the Docker daemon" or "docker: command not found"

Start Docker Desktop (or OrbStack / Colima) and wait until `docker info` works, then run `pnpm bootstrap --yes --docker` again. Or use the Neon path.

### "Postgres container did not become ready"

The container started but Postgres did not answer within 30 seconds. Check `docker logs project-starter-pg`. If the container is broken, remove it and start again (this deletes local data):

```bash
docker rm -f project-starter-pg
pnpm bootstrap --yes --docker
```

### The app stops with an env validation error

Varlock lists the variable that is missing or invalid. Common causes:

- `apps/web/.env` does not exist. Run `pnpm bootstrap`.
- `BETTER_AUTH_SECRET` or `APP_ENCRYPTION_KEY` is shorter than 32 characters. Generate a new one with `openssl rand -base64 32`.
- `DATABASE_URL` does not start with `postgres`.
- You edited `.env.schema`. Run `pnpm env:generate`.

`pnpm bootstrap` never overwrites values already in `apps/web/.env`. To start over, delete the file and run it again. Note: a new `APP_ENCRYPTION_KEY` makes keys saved in Admin > API Keys unreadable.

### `pnpm db:migrate` fails

- **Connection refused:** the database is not running (`docker start project-starter-pg`) or the URL is wrong.
- **SSL errors with Neon:** keep `?sslmode=require` on the URL.
- **Timeouts or lock errors on Neon:** set `DATABASE_URL_DIRECT` to the direct (non-pooled) URL.
- **"relation already exists":** the database was created with `db:push` or by hand. For a local database, run `pnpm db:reset`. Never reset a shared database.

### "relation ... does not exist" when the app runs

Migrations have not been applied to this database. Run `pnpm db:migrate`, then `pnpm db:seed`.

### I signed up but I am not admin

Someone else signed up first. Set `SEED_ADMIN_EMAIL` to your email in `apps/web/.env` and run `pnpm db:seed`; it promotes your account.

### No verification or reset email

Without a Resend key, emails are printed in the `pnpm dev` terminal, not sent. Look for `DEV OUTBOX`. With a key, check the Resend dashboard, and that `RESEND_FROM_EMAIL` uses a verified domain.

### Uploads fail with "File storage is not configured"

Add all five R2 values in Admin > API Keys and click **test connection**.
