/**
 * SOURCE OF TRUTH KEYWORDS: bootstrap, pnpm bootstrap, setup, first run, env bootstrap, setup wizard replacement
 * WHAT:  Local first-run setup. Writes apps/web/.env (keeping any values already there),
 *        generates secrets, optionally starts a Docker Postgres, then migrates and seeds.
 * WHY:   Replaces Batman's browser setup wizard, which let anyone on the internet rewrite .env and
 *        run shell commands. This runs only on the developer's machine and never ships.
 * WHERE: `pnpm bootstrap` (interactive) or `pnpm bootstrap --yes [--docker]` (defaults, CI-friendly).
 */
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { parseEnv } from "node:util";

const ROOT = new URL("..", import.meta.url).pathname;
const ENV_PATH = join(ROOT, "apps/web/.env");
const DOCKER_NAME = "project-starter-pg";
const DOCKER_PORT = 54329;
const DOCKER_URL = `postgresql://postgres:postgres@localhost:${DOCKER_PORT}/project_starter`;

const args = new Set(process.argv.slice(2));
const useDefaults = args.has("--yes") || args.has("-y");
const wantDocker = args.has("--docker");

const rl = createInterface({ input: process.stdin, output: process.stdout });
async function ask(question: string, fallback: string): Promise<string> {
  if (useDefaults) return fallback;
  const answer = (await rl.question(`${question}${fallback ? ` [${fallback}]` : ""}: `)).trim();
  return answer || fallback;
}

function run(command: string) {
  console.log(`\n$ ${command}`);
  execSync(command, { cwd: ROOT, stdio: "inherit" });
}

function secret() {
  return randomBytes(32).toString("base64");
}

function startDocker() {
  try {
    execSync(`docker inspect ${DOCKER_NAME}`, { stdio: "ignore" });
    execSync(`docker start ${DOCKER_NAME}`, { stdio: "ignore" });
  } catch {
    run(
      `docker run -d --name ${DOCKER_NAME} -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=project_starter -p 127.0.0.1:${DOCKER_PORT}:5432 postgres:17-alpine`,
    );
  }
  for (let i = 0; i < 30; i++) {
    try {
      execSync(`docker exec ${DOCKER_NAME} pg_isready -U postgres`, { stdio: "ignore" });
      return;
    } catch {
      execSync("sleep 1");
    }
  }
  throw new Error("Postgres container did not become ready");
}

console.log("Project Starter setup\n");
const existing: Record<string, string> = existsSync(ENV_PATH) ? { ...parseEnv(readFileSync(ENV_PATH, "utf8")) } : {};
if (existsSync(ENV_PATH)) console.log("Found apps/web/.env; existing values are kept.\n");

let databaseUrl = existing.DATABASE_URL ?? "";
if (!databaseUrl) {
  const useDocker =
    wantDocker ||
    (await ask("Start a local Postgres in Docker? (y/n)", useDefaults ? "y" : "y")).toLowerCase().startsWith("y");
  if (useDocker) {
    startDocker();
    databaseUrl = DOCKER_URL;
  } else {
    databaseUrl = await ask("Postgres connection string (Neon pooled URL or local)", "");
    if (!databaseUrl) throw new Error("A DATABASE_URL is required.");
  }
}

const values: Record<string, string> = {
  ...existing,
  NODE_ENV: existing.NODE_ENV ?? "development",
  DATABASE_URL: databaseUrl,
  BETTER_AUTH_SECRET: existing.BETTER_AUTH_SECRET ?? secret(),
  APP_ENCRYPTION_KEY: existing.APP_ENCRYPTION_KEY ?? secret(),
  BETTER_AUTH_URL: existing.BETTER_AUTH_URL ?? "http://localhost:3001",
};
if (!existing.SEED_ADMIN_EMAIL) {
  const email = await ask("Admin email to create (blank = first sign-up becomes admin)", "");
  if (email) {
    values.SEED_ADMIN_EMAIL = email;
    values.SEED_ADMIN_PASSWORD = await ask("Admin password (min 8 chars)", "");
  }
}
rl.close();

const body = Object.entries(values)
  .filter(([, v]) => v !== "")
  .map(([k, v]) => `${k}=${/[\s#"']/.test(v) ? JSON.stringify(v) : v}`)
  .join("\n");
writeFileSync(
  ENV_PATH,
  `# Written by pnpm bootstrap. Git-ignored. See apps/web/.env.schema for every option.\n${body}\n`,
  { mode: 0o600 },
);
console.log(`\n✓ wrote ${ENV_PATH}`);

run("pnpm env:generate");
run("pnpm db:migrate");
run("pnpm db:seed");
console.log("\n✓ Setup complete. Start the app with: pnpm dev  →  http://localhost:3001");
