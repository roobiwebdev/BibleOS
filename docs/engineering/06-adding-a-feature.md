# Adding a feature: a worked example

This walks through a small but complete feature: **projects**. A signed-in user can create, list, rename and delete their own projects. Every layer is touched once, in order:

1. Plan
2. Schema and migration
3. Permission
4. Service
5. Input schemas and router, mounted in the root router
6. Server actions
7. Page and form
8. Module registry and navigation
9. Tests
10. Verify

The code below follows the real conventions of this repository. Copy it as a template. It is an example: the `project` table and router do not exist in the starter.

## 1. Plan first

Before code, use the `architect-feature` skill (see [CLAUDE.md](../../CLAUDE.md) section 0). Write down:

- **Goal.** Users keep a private list of projects.
- **What exists.** Grep first: `grep -rn "SOURCE OF TRUTH KEYWORDS" packages | grep -i project`. You find that `packages/auth/src/permissions.ts` already declares a `project` resource. Reuse it.
- **Security pass.** Signed-in only. A user may only see and change their own rows. Mutations are audited.
- **Build order.** Schema, permission, service, router, actions, page, nav, tests.

Get approval, then build.

## 2. Schema and migration

Create `packages/db/src/schema/project.ts`:

```ts
/**
 * SOURCE OF TRUTH KEYWORDS: project, projects table, Project, project owner, userId
 * WHAT:  Projects owned by a single user.
 * WHY:   Example module from docs/engineering/06-adding-a-feature.md.
 * WHERE: packages/api/src/services/projects.ts, packages/api/src/routers/projects.ts.
 */
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

export const project = pgTable(
  "project",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").default("").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("project_user_idx").on(t.userId)],
);
```

Export it from `packages/db/src/schema/index.ts`:

```ts
export * from "./project";
```

Add relations in `packages/db/src/relations.ts` (inside `defineRelations`):

```ts
user: {
  // ...existing relations
  projects: r.many.project({ from: r.user.id, to: r.project.userId }),
},
project: { owner: r.one.user({ from: r.project.userId, to: r.user.id }) },
```

Generate and apply the migration:

```bash
pnpm db:generate     # writes packages/db/migrations/<timestamp>_<name>/migration.sql
# read the SQL: one CREATE TABLE "project", one index, one foreign key
pnpm db:migrate
```

Commit the migration folder together with the schema change.

## 3. Permission

`permissions.ts` already has `project: ["create", "read", "update", "delete"]`, but the `user` role only has `create` and `read`. Users must be able to rename and delete their own projects, so grant those verbs in `packages/auth/src/permissions.ts`:

```ts
export const userRole = ac.newRole({
  project: ["create", "read", "update", "delete"],
  file: ["upload", "read"],
  settings: ["read"],
});
```

The permission says what a role may do in general. **Ownership** ("only your own projects") is a business rule, so it goes in the router.

## 4. Service

Create `packages/api/src/services/projects.ts`. Queries only: no auth, no rules.

```ts
/**
 * SOURCE OF TRUTH KEYWORDS: projectsService, listProjectsForUser, findOwnedProject, project queries
 * WHAT:  Reusable database queries for projects (no auth, no business rules).
 * WHERE: packages/api/src/routers/projects.ts.
 */
import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { schema, type DbExecutor } from "@starter/db";

const p = schema.project;

export function listProjectsForUser(db: DbExecutor, userId: string) {
  return db.select().from(p).where(eq(p.userId, userId)).orderBy(desc(p.createdAt));
}

export async function findOwnedProject(db: DbExecutor, id: string, userId: string) {
  const [row] = await db
    .select()
    .from(p)
    .where(and(eq(p.id, id), eq(p.userId, userId)))
    .limit(1);
  return row ?? null;
}
```

## 5. Input schemas and router

The form in the browser and the router on the server validate with the same Zod schemas. Put them in a file with no server-only imports, so a client component can import it safely. Create `packages/api/src/schemas/projects.ts`:

```ts
/**
 * SOURCE OF TRUTH KEYWORDS: projectCreateInput, projectUpdateInput, project form schema
 * WHAT:  Zod input schemas for the projects router, shared with client forms.
 * WHY:   Kept apart from the router because the router imports server-only services.
 * WHERE: packages/api/src/routers/projects.ts, app/dashboard/projects form.
 */
import { z } from "zod";

export const projectCreateInput = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
});

export const projectUpdateInput = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).optional(),
});
```

Create `packages/api/src/routers/projects.ts`:

```ts
/**
 * SOURCE OF TRUTH KEYWORDS: projectsRouter, projects.list, projects.create, projects.update, projects.delete
 * WHAT:  CRUD for a user's own projects.
 * WHY:   Permission checks come from the procedure builder; ownership is checked here, so a
 *        user can never read or change another user's project.
 * WHERE: apps/web/src/lib/actions/projects.ts.
 */
import { TRPCError } from "@trpc/server";
import { schema } from "@starter/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { projectCreateInput, projectUpdateInput } from "../schemas/projects";
import * as projectsService from "../services/projects";
import { protectedProcedure, router } from "../trpc";

const notFound = () => new TRPCError({ code: "NOT_FOUND", message: "Project not found" });

export const projectsRouter = router({
  list: protectedProcedure({ permission: { project: ["read"] } }).query(({ ctx }) =>
    projectsService.listProjectsForUser(ctx.db, ctx.session.user.id),
  ),

  create: protectedProcedure({ permission: { project: ["create"] } })
    .input(projectCreateInput)
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(schema.project)
        .values({ name: input.name, description: input.description ?? "", userId: ctx.session.user.id })
        .returning();
      if (!created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not create project" });
      return created; // has `id`, so the audit row gets entityId automatically
    }),

  update: protectedProcedure({ permission: { project: ["update"] } })
    .input(projectUpdateInput)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      if (!(await projectsService.findOwnedProject(ctx.db, id, ctx.session.user.id))) throw notFound();
      const [updated] = await ctx.db.update(schema.project).set(data).where(eq(schema.project.id, id)).returning();
      if (!updated) throw notFound();
      return updated;
    }),

  delete: protectedProcedure({ permission: { project: ["delete"] } })
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (!(await projectsService.findOwnedProject(ctx.db, input.id, ctx.session.user.id))) throw notFound();
      await ctx.db.delete(schema.project).where(eq(schema.project.id, input.id));
      return { id: input.id };
    }),
});
```

What you did **not** write, because the builder does it: the sign-in check, the permission check, rate limiting, the transaction, and the audit rows (`entity = "projects"`, `action = "create" | "update" | "delete"`).

Return "not found" rather than "forbidden" for other users' rows, so the API does not reveal which IDs exist.

Mount it in `packages/api/src/root.ts`:

```ts
import { projectsRouter } from "./routers/projects";

export const appRouter = router({
  // ...
  projects: projectsRouter,
});
```

## 6. Server actions

Create `apps/web/src/lib/actions/projects.ts`. Adapters only:

```ts
"use server";
/**
 * SOURCE OF TRUTH KEYWORDS: projects actions, listProjects, createProject, updateProject, deleteProject
 * WHAT:  Server-action adapters over the projects router (no logic here).
 * WHERE: app/dashboard/projects.
 */
import type { RouterInputs } from "@starter/api";

import { api } from "@/server/trpc";

export async function listProjects() {
  return (await api()).projects.list();
}

export async function createProject(input: RouterInputs["projects"]["create"]) {
  return (await api()).projects.create(input);
}

export async function updateProject(input: RouterInputs["projects"]["update"]) {
  return (await api()).projects.update(input);
}

export async function deleteProject(id: string) {
  return (await api()).projects.delete({ id });
}
```

## 7. Page and form

The page is a Server Component. It reads data with `api()` directly. `apps/web/src/app/dashboard/projects/page.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@starter/ui/components/card";

import { api } from "@/server/trpc";

import { CreateProjectForm } from "./_components/create-project-form";

export default async function ProjectsPage() {
  const projects = await (await api()).projects.list();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Projects</h1>
      <CreateProjectForm />
      {projects.length === 0 ? (
        <p className="text-muted-foreground">No projects yet.</p>
      ) : (
        projects.map((project) => (
          <Card key={project.id}>
            <CardHeader>
              <CardTitle>{project.name}</CardTitle>
            </CardHeader>
            {project.description ? (
              <CardContent className="text-muted-foreground">{project.description}</CardContent>
            ) : null}
          </Card>
        ))
      )}
    </div>
  );
}
```

The dashboard layout already requires a session, so the page does not check it again.

The form is used by this route only, so it lives in `_components`. It uses TanStack Form with the router's Zod schema. `apps/web/src/app/dashboard/projects/_components/create-project-form.tsx`:

```tsx
"use client";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { projectCreateInput } from "@starter/api/schemas/projects";
import { Button } from "@starter/ui/components/button";
import { Input } from "@starter/ui/components/input";
import { Label } from "@starter/ui/components/label";

import { createProject } from "@/lib/actions/projects";

export function CreateProjectForm() {
  const router = useRouter();
  const form = useForm({
    defaultValues: { name: "", description: "" },
    validators: { onSubmit: projectCreateInput },
    onSubmit: async ({ value }) => {
      try {
        await createProject(value);
        form.reset();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not create project");
      }
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
      className="flex items-end gap-2"
    >
      <form.Field name="name">
        {(field) => (
          <div className="flex-1 space-y-1">
            <Label htmlFor={field.name}>Name</Label>
            <Input
              id={field.name}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
          </div>
        )}
      </form.Field>
      <Button type="submit">Create</Button>
    </form>
  );
}
```

The form imports the schema from `@starter/api/schemas/projects`, never from the router file, because the router pulls in `server-only` code.

## 8. Module registry and navigation

Add the module to `packages/config/src/modules.ts`:

```ts
projects: {
  label: "Projects",
  description: "Private project list for each user.",
  enabled: true,
  routes: ["/dashboard/projects"],
  dashboardNav: [{ label: "Projects", href: "/dashboard/projects", icon: "file" }],
},
```

- `routes` lets `proxy.ts` return 404 when someone sets `enabled: false`.
- `icon` must be one of the `NavIcon` names. To use a new icon, add it to the `NavIcon` union and to the icon map where nav is rendered (`NAV_ICONS` in `apps/web/src/app/admin/admin-sidebar.tsx` for admin entries).
- Admin entries also need their `href` in `ADMIN_NAV_ORDER`, or they sort to the top.

See [modules.md](modules.md) for the whole module lifecycle.

## 9. Tests

Pure logic goes in a separate file with a unit test next to it (see `packages/api/src/services/blog-utils.test.ts`). This feature has no pure logic worth testing alone, so test the router against a real database, the same way `packages/api/src/trpc.test.ts` does.

`packages/api/src/routers/projects.test.ts` (outline):

```ts
import { createAuthProvider, type Session } from "@starter/auth";
import { createEmailService } from "@starter/core/email";
import { createPaymentsService } from "@starter/core/payments";
import { createSettingsService } from "@starter/core/settings";
import { createStorageService } from "@starter/core/storage";
import type { CoreEnv } from "@starter/core/types";
import { createDb, schema } from "@starter/db";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ApiServices, Context } from "../context";
import { createCallerFactory } from "../trpc";
import { projectsRouter } from "./projects";

const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

run("projects router", () => {
  const db = createDb({ DATABASE_URL: url ?? "" });
  const coreEnv: CoreEnv = {
    NODE_ENV: "test",
    APP_ENCRYPTION_KEY: "x".repeat(32),
    APP_URL: "http://localhost:3001",
    fallbacks: {},
  };
  const settings = createSettingsService(db, coreEnv);
  const email = createEmailService(settings, coreEnv);
  const services: ApiServices = {
    db,
    settings,
    email,
    storage: createStorageService(settings),
    payments: createPaymentsService(db, settings),
    getAuth: createAuthProvider({
      env: {
        BETTER_AUTH_SECRET: "x".repeat(32),
        BETTER_AUTH_URL: "http://localhost:3001",
        CORS_ORIGIN: "http://localhost:3001",
      },
      db,
      settings,
      email,
    }),
    appUrl: "http://localhost:3001",
  };
  // makeSession(role, userId): copy the helper from packages/api/src/trpc.test.ts
  // ctxFor(session): { db, session, headers: new Headers(), request: {...}, services }

  it("creates a project and audits it", async () => {
    /* create, then expect an audit_log row with entity "projects", action "create" */
  });
  it("lists only the caller's projects", async () => {
    /* two users, each sees one */
  });
  it("returns NOT_FOUND when another user updates or deletes", async () => {
    /* rejects.toMatchObject({ code: "NOT_FOUND" }) */
  });
});
```

Insert the test users in `beforeAll` with `role: "user"` and delete them (and their audit rows) in `afterAll`. Run it:

```bash
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:54329/project_starter pnpm test:integration
```

## 10. Verify

```bash
pnpm check-types
pnpm lint
pnpm test
pnpm dev     # sign in, open /dashboard/projects, create a project
```

Then check:

- The project appears, and a second account cannot see it.
- `audit_log` has a `projects` / `create` row (`pnpm db:studio`).
- With `enabled: false` in `modules.ts`, the nav entry disappears and `/dashboard/projects` returns 404.

Report real results. If something is not finished, say so in your handover.
