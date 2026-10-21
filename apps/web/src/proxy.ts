/**
 * SOURCE OF TRUTH KEYWORDS: proxy, route guard, disabled modules, 404, Next 16 proxy
 * WHAT:  Edge of every request. Returns 404 for routes owned by modules switched off in
 *        packages/config/src/modules.ts.
 * WHY:   Removing a module from a new project is one flag. Auth, maintenance mode and onboarding
 *        redirects live in layouts (they need the session and settings), not here.
 * WHERE: Next.js runs this automatically. Never create middleware.ts (Next 16 uses proxy.ts).
 */
import { DISABLED_ROUTE_PREFIXES } from "@starter/config/modules";
import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (DISABLED_ROUTE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return new NextResponse("Not found", { status: 404 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
