/**
 * SOURCE OF TRUTH KEYWORDS: polar webhook, POST /api/webhooks/polar, subscription sync, signature verification
 * WHAT:  Receives Polar subscription events, verifies the signature and syncs the subscription row.
 * WHERE: Configure in Polar: <app url>/api/webhooks/polar with the secret from Admin > API Keys.
 */
import { createLogger } from "@starter/core/logger";
import { NextResponse, type NextRequest } from "next/server";

import { getServices } from "@/server/services";

const log = createLogger("polar-webhook");

export async function POST(req: NextRequest) {
  const body = await req.text();
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  try {
    const result = await getServices().payments.handleWebhook(body, headers);
    return NextResponse.json({ message: result.message }, { status: result.status });
  } catch (err) {
    log.error("webhook processing failed", undefined, err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
