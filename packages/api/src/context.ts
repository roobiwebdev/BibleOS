/**
 * SOURCE OF TRUTH KEYWORDS: Context, createContext, ApiServices, RequestInfo, ctx.db, ctx.session, ctx.services
 * WHAT:  Per-request tRPC context: database, session, client info and the app's services.
 * WHY:   Routers never import env or create clients; everything arrives through ctx, so the same
 *        routers run in Next.js route handlers, server actions (createCaller) and tests.
 * WHERE: apps/web/src/server/trpc.ts builds it; every procedure reads it.
 */
import type { GetAuth, Session } from "@starter/auth";
import type { EmailService } from "@starter/core/email";
import type { PaymentsService } from "@starter/core/payments";
import type { SettingsService } from "@starter/core/settings";
import type { StorageService } from "@starter/core/storage";
import type { Database, DbExecutor } from "@starter/db";

export type ApiServices = {
  db: Database;
  getAuth: GetAuth;
  settings: SettingsService;
  email: EmailService;
  storage: StorageService;
  payments: PaymentsService;
  appUrl: string;
};

export type RequestInfo = { ipAddress: string | null; userAgent: string | null; country: string | null };

export type Context = {
  /** Root client, or the open transaction inside a mutation. */
  db: DbExecutor;
  session: Session | null;
  headers: Headers;
  request: RequestInfo;
  services: ApiServices;
};

export function readRequestInfo(headers: Headers): RequestInfo {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ipAddress: forwarded || headers.get("x-real-ip") || null,
    userAgent: headers.get("user-agent"),
    country: headers.get("x-vercel-ip-country") || headers.get("cf-ipcountry") || null,
  };
}

export async function createContext(opts: { headers: Headers; services: ApiServices }): Promise<Context> {
  const auth = await opts.services.getAuth();
  const session = await auth.api.getSession({ headers: opts.headers });
  return {
    db: opts.services.db,
    session,
    headers: opts.headers,
    request: readRequestInfo(opts.headers),
    services: opts.services,
  };
}
