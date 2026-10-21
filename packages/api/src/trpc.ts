/**
 * SOURCE OF TRUTH KEYWORDS: t, router, publicProcedure, protectedProcedure, adminProcedure, ProcedureOptions, procedure builder, security checkpoint, requirePermission, rateLimit, audit, transaction
 * WHAT:  The single security checkpoint every API call passes through (Guardrail "protected
 *        procedure", lean version). In order: rate limit -> authentication -> role/permission ->
 *        (mutations) open a transaction -> your handler -> audit row -> commit.
 * WHY:   Security is written once, not per endpoint. Handlers contain only business logic and
 *        receive `ctx.db` already bound to the transaction. A thrown error rolls back the change
 *        and its audit row together.
 * WHERE: every router in ./routers. Never call initTRPC anywhere else.
 */
import "server-only";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z, ZodError } from "zod";

import type { PermissionCheck } from "@starter/auth";
import type { DbExecutor } from "@starter/db";
import type { Context } from "./context";
import { pickEntityId, writeAudit } from "./lib/audit";
import { consumeRateLimit, RATE_LIMITS, type RateLimitRule } from "./lib/rate-limit";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    const internal = error.code === "INTERNAL_SERVER_ERROR";
    return {
      ...shape,
      // Never leak stack traces or driver messages to clients in production.
      message: internal && process.env.NODE_ENV === "production" ? "Something went wrong" : shape.message,
      data: {
        ...shape.data,
        stack: process.env.NODE_ENV === "production" ? undefined : shape.data.stack,
        zodError: error.cause instanceof ZodError ? z.flattenError(error.cause) : null,
      },
    };
  },
});

export const router = t.router;
export const mergeRouters = t.mergeRouters;
export const createCallerFactory = t.createCallerFactory;

export type AuditOption =
  | false
  | {
      entity?: string;
      action?: string;
      /** Static description stored on the audit row. */
      describe?: string;
    };

export type ProcedureOptions = {
  /** Global role required (admin plugin role). */
  role?: "admin";
  /** Fine-grained permission from packages/auth/src/permissions.ts. */
  permission?: PermissionCheck;
  /** Override the default per-user rate limit. */
  rateLimit?: RateLimitRule;
  /** Mutations are audited automatically as `<router>.<procedure>`; pass false to skip. */
  audit?: AuditOption;
};

const rateLimited = (rule: RateLimitRule) =>
  t.middleware(async ({ ctx, path, next }) => {
    const who = ctx.session?.user.id ?? ctx.request.ipAddress ?? "anonymous";
    const allowed = await consumeRateLimit(ctx.services.db, `${path}:${who}`, rule);
    if (!allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many requests. Please slow down." });
    return next();
  });

const authenticated = t.middleware(({ ctx, next }) => {
  if (!ctx.session) throw new TRPCError({ code: "UNAUTHORIZED", message: "Please sign in." });
  if (ctx.session.user.banned) throw new TRPCError({ code: "FORBIDDEN", message: "Your account is suspended." });
  return next({ ctx: { ...ctx, session: ctx.session } });
});

function authorized(opts: ProcedureOptions) {
  return t.middleware(async ({ ctx, next }) => {
    const session = ctx.session;
    if (!session) throw new TRPCError({ code: "UNAUTHORIZED" });
    if (opts.role && session.user.role !== opts.role) {
      throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to this." });
    }
    if (opts.permission) {
      const auth = await ctx.services.getAuth();
      const result = await auth.api.userHasPermission({
        body: { userId: session.user.id, permissions: opts.permission },
      });
      if (!result.success) throw new TRPCError({ code: "FORBIDDEN", message: "Missing permission." });
    }
    return next();
  });
}

function transactionalAudit(audit: AuditOption | undefined) {
  return t.middleware(async ({ ctx, next, type, path, getRawInput }) => {
    if (type !== "mutation") return next();
    return ctx.services.db.transaction(async (tx) => {
      const db: DbExecutor = tx;
      const result = await next({ ctx: { ...ctx, db } });
      if (!result.ok) throw result.error; // roll back
      if (audit !== false) {
        const [entity = path, ...rest] = path.split(".");
        const action = rest.join(".") || "mutate";
        const input = await getRawInput();
        await writeAudit(
          tx,
          {
            userId: ctx.session?.user.id ?? null,
            entity: audit?.entity ?? entity,
            action: audit?.action ?? action,
            entityId: pickEntityId(result.data) ?? pickEntityId(input),
            description: audit?.describe ?? null,
          },
          ctx.request,
        );
      }
      return result;
    });
  });
}

/** Anyone may call. Rate limited by IP. Use for public reads and public forms. */
export function publicProcedure(opts: Pick<ProcedureOptions, "rateLimit" | "audit"> = {}) {
  return t.procedure
    .use(rateLimited(opts.rateLimit ?? RATE_LIMITS.default))
    .use(transactionalAudit(opts.audit ?? false));
}

/** Signed-in users only. Add `role` or `permission` to narrow further. */
export function protectedProcedure(opts: ProcedureOptions = {}) {
  return t.procedure
    .use(rateLimited(opts.rateLimit ?? RATE_LIMITS.default))
    .use(authenticated)
    .use(authorized(opts))
    .use(transactionalAudit(opts.audit));
}

/** Shorthand for admin-only endpoints. */
export function adminProcedure(opts: Omit<ProcedureOptions, "role"> = {}) {
  return protectedProcedure({ ...opts, role: "admin" });
}
