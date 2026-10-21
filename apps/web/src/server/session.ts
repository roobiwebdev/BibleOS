/**
 * SOURCE OF TRUTH KEYWORDS: getSession, requireSession, requireAdmin, getAuth, server session
 * WHAT:  Session helpers for Server Components, layouts and route handlers.
 * WHERE: app layouts (redirect guards), route handlers (upload, webhooks).
 */
import "server-only";
import type { Session } from "@starter/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { getServices } from "./services";

export const getSession = cache(async (): Promise<Session | null> => {
  const auth = await getServices().getAuth();
  return auth.api.getSession({ headers: await headers() });
});

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireAdmin(): Promise<Session> {
  const session = await requireSession();
  if (session.user.role !== "admin") redirect("/dashboard");
  return session;
}

export function isAdmin(session: Session | null): boolean {
  return session?.user.role === "admin";
}
