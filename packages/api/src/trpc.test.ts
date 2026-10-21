/**
 * Integration test for the procedure builder (security checkpoint).
 * Needs a migrated Postgres: run `TEST_DATABASE_URL=<url> pnpm test:integration`.
 * Skipped automatically when no database is configured.
 */
import { TRPCError } from "@trpc/server";
import type { Session } from "@starter/auth";
import { createDb, schema } from "@starter/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import type { ApiServices, Context } from "./context";
import { adminProcedure, createCallerFactory, protectedProcedure, publicProcedure, router } from "./trpc";

const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

const marker = `test-${Date.now()}`;

const testRouter = router({
  ping: publicProcedure({ rateLimit: { max: 2, windowSec: 60 } }).query(() => "pong"),
  me: protectedProcedure().query(({ ctx }) => ctx.session.user.id),
  adminOnly: adminProcedure().query(() => "secret"),
  write: protectedProcedure()
    .input(z.object({ fail: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .insert(schema.waitlistEntry)
        .values({ email: `${marker}-${input.fail ? "fail" : "ok"}@example.com` });
      if (input.fail) throw new TRPCError({ code: "BAD_REQUEST", message: "boom" });
      return { id: marker };
    }),
});

function makeSession(role: "admin" | "user", userId: string): Session {
  const now = new Date();
  return {
    session: {
      id: `s-${userId}`,
      token: `t-${userId}`,
      userId,
      expiresAt: new Date(now.getTime() + 60_000),
      createdAt: now,
      updatedAt: now,
      ipAddress: null,
      userAgent: null,
      impersonatedBy: null,
      activeOrganizationId: null,
    },
    user: {
      id: userId,
      name: "Test",
      email: `${userId}@example.com`,
      emailVerified: true,
      image: null,
      createdAt: now,
      updatedAt: now,
      role,
      banned: false,
      banReason: null,
      banExpires: null,
      bio: null,
      onboardingCompleted: true,
    },
  };
}

run("procedure builder", () => {
  const db = createDb({ DATABASE_URL: url ?? "" });
  const services: ApiServices = {
    db,
    getAuth: () => Promise.reject(new Error("not used")),
    // Test doubles: these services are never called by the test router.
    settings: {} as never,
    email: {} as never,
    storage: {} as never,
    payments: {} as never,
    appUrl: "http://localhost",
  };
  const userId = `${marker}-user`;
  const createCaller = createCallerFactory(testRouter);
  const ctxFor = (session: Session | null, ip = "127.0.0.1"): Context => ({
    db,
    session,
    headers: new Headers(),
    request: { ipAddress: `${ip}-${marker}`, userAgent: "vitest", country: null },
    services,
  });

  beforeAll(async () => {
    await db.insert(schema.user).values({ id: userId, name: "Test", email: `${userId}@example.com` });
  });

  afterAll(async () => {
    await db.delete(schema.auditLog).where(eq(schema.auditLog.userId, userId));
    await db.delete(schema.user).where(eq(schema.user.id, userId));
    await db.$client.end();
  });

  it("rejects anonymous calls to protected procedures", async () => {
    await expect(createCaller(ctxFor(null)).me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("blocks non-admins from admin procedures", async () => {
    await expect(createCaller(ctxFor(makeSession("user", userId))).adminOnly()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(createCaller(ctxFor(makeSession("admin", userId))).adminOnly()).resolves.toBe("secret");
  });

  it("commits the change and its audit row together", async () => {
    await createCaller(ctxFor(makeSession("user", userId))).write({ fail: false });
    const rows = await db
      .select()
      .from(schema.waitlistEntry)
      .where(eq(schema.waitlistEntry.email, `${marker}-ok@example.com`));
    const audit = await db.select().from(schema.auditLog).where(eq(schema.auditLog.userId, userId));
    expect(rows).toHaveLength(1);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ entity: "write", action: "mutate", entityId: marker, userAgent: "vitest" });
    await db.delete(schema.waitlistEntry).where(eq(schema.waitlistEntry.email, `${marker}-ok@example.com`));
  });

  it("rolls back the change and the audit row when the handler throws", async () => {
    await expect(createCaller(ctxFor(makeSession("user", userId))).write({ fail: true })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    const rows = await db
      .select()
      .from(schema.waitlistEntry)
      .where(eq(schema.waitlistEntry.email, `${marker}-fail@example.com`));
    const audit = await db.select().from(schema.auditLog).where(eq(schema.auditLog.userId, userId));
    expect(rows).toHaveLength(0);
    expect(audit).toHaveLength(1); // only the earlier successful write
  });

  it("rate limits per caller", async () => {
    const caller = createCaller(ctxFor(null, "10.0.0.9"));
    await expect(caller.ping()).resolves.toBe("pong");
    await expect(caller.ping()).resolves.toBe("pong");
    await expect(caller.ping()).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });
});
