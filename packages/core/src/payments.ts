/**
 * SOURCE OF TRUTH KEYWORDS: createPaymentsService, PaymentsService, Polar, PolarProduct, checkout, webhook, subscription sync, parseProductDescription
 * WHAT:  Polar integration: product catalogue, checkout sessions, webhook verification and
 *        subscription syncing into the `subscription` table.
 * WHY:   Batman's payments module. Isolated here so a different provider (Stripe, Chapa, Paddle)
 *        can replace this file without touching routers or pages.
 * WHERE: api billing + products routers, apps/web/src/app/api/webhooks/polar/route.ts.
 */
import "server-only";
import { Polar } from "@polar-sh/sdk";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import { eq } from "drizzle-orm";
import { schema, type Database } from "@starter/db";

import { createLogger } from "./logger";
import type { SettingsService } from "./settings";

const log = createLogger("payments");

export type PolarPrice = { id: string; amountType: string; priceAmount: number | null; priceCurrency: string };
export type PolarProduct = {
  id: string;
  name: string;
  description: string | null;
  isRecurring: boolean;
  recurringInterval: string | null;
  isArchived: boolean;
  prices: PolarPrice[];
  createdAt: string;
};
export type ProductPlanType = "saas-monthly" | "saas-yearly" | "one-time";
export type CreateProductInput = {
  name: string;
  description?: string;
  type: ProductPlanType;
  priceAmountCents: number;
  priceCurrency?: "usd" | "eur" | "gbp";
};

const FEATURES_DELIMITER = "\n\n---\n";

/** Product descriptions store "description\n\n---\nfeature 1\nfeature 2" (Batman convention). */
export function parseProductDescription(desc: string | null): { description: string; features: string[] } {
  if (!desc?.trim()) return { description: "", features: [] };
  const idx = desc.indexOf(FEATURES_DELIMITER);
  if (idx === -1) return { description: desc.trim(), features: [] };
  return {
    description: desc.slice(0, idx).trim(),
    features: desc
      .slice(idx + FEATURES_DELIMITER.length)
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

export function buildProductDescription(description: string, features: readonly string[]): string {
  const clean = features.map((f) => f.trim()).filter(Boolean);
  return clean.length ? `${description.trim()}${FEATURES_DELIMITER}${clean.join("\n")}` : description.trim();
}

type SdkPrice = { id: string; amountType: string; priceAmount?: number | null; priceCurrency?: string | null };
type SdkProduct = {
  id: string;
  name: string;
  description: string | null;
  isRecurring: boolean;
  recurringInterval: string | null;
  isArchived: boolean;
  prices: SdkPrice[];
  createdAt: Date;
};

function mapProduct(p: SdkProduct): PolarProduct {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    isRecurring: p.isRecurring,
    recurringInterval: p.recurringInterval,
    isArchived: p.isArchived,
    prices: p.prices.map((pr) => ({
      id: pr.id,
      amountType: pr.amountType,
      priceAmount: pr.priceAmount ?? null,
      priceCurrency: pr.priceCurrency ?? "usd",
    })),
    createdAt: p.createdAt.toISOString(),
  };
}

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

export function createPaymentsService(db: Database, settings: SettingsService) {
  async function client(): Promise<Polar | null> {
    const keys = await settings.getIntegrationKeys();
    if (!keys.polarAccessToken) return null;
    return new Polar({
      accessToken: keys.polarAccessToken,
      ...(keys.polarSandboxMode ? { server: "sandbox" as const } : {}),
    });
  }

  async function requireClient(): Promise<Polar> {
    const polar = await client();
    if (!polar) throw new Error("Payments are not configured. Add your Polar access token in Admin > API Keys.");
    return polar;
  }

  async function listProducts(opts: { includeArchived?: boolean } = {}): Promise<PolarProduct[]> {
    const polar = await client();
    if (!polar) return [];
    const pages = await polar.products.list({ ...(opts.includeArchived ? {} : { isArchived: false }), limit: 100 });
    for await (const page of pages) {
      return page.result.items.map(mapProduct);
    }
    return [];
  }

  async function createProduct(input: CreateProductInput): Promise<PolarProduct> {
    const polar = await requireClient();
    const price = {
      amountType: "fixed" as const,
      priceCurrency: input.priceCurrency ?? "usd",
      priceAmount: Math.max(50, input.priceAmountCents),
    };
    const product =
      input.type === "one-time"
        ? await polar.products.create({
            name: input.name,
            description: input.description ?? null,
            recurringInterval: null,
            prices: [price],
          })
        : await polar.products.create({
            name: input.name,
            description: input.description ?? null,
            recurringInterval: input.type === "saas-monthly" ? "month" : "year",
            prices: [price],
          });
    return mapProduct(product);
  }

  async function updateProduct(
    id: string,
    data: { name?: string; description?: string | null },
  ): Promise<PolarProduct> {
    const polar = await requireClient();
    return mapProduct(await polar.products.update({ id, productUpdate: data }));
  }

  async function archiveProduct(id: string): Promise<void> {
    const polar = await requireClient();
    await polar.products.update({ id, productUpdate: { isArchived: true } });
  }

  async function createCheckout(opts: {
    productId: string;
    user: { id: string; email: string; name: string };
    successUrl: string;
    returnUrl: string;
  }): Promise<string> {
    const polar = await requireClient();
    const checkout = await polar.checkouts.create({
      products: [opts.productId],
      customerEmail: opts.user.email,
      customerName: opts.user.name,
      externalCustomerId: opts.user.id,
      successUrl: opts.successUrl,
      returnUrl: opts.returnUrl,
    });
    return checkout.url;
  }

  async function getSubscriptionStatus(userId: string) {
    const [sub] = await db.select().from(schema.subscription).where(eq(schema.subscription.userId, userId)).limit(1);
    if (!sub) return { isSubscribed: false, subscription: null };
    const isSubscribed = ACTIVE_STATUSES.has(sub.status) && sub.currentPeriodEnd > new Date();
    return { isSubscribed, subscription: sub };
  }

  /**
   * Verifies a Polar webhook and upserts the user's subscription.
   * Returns an HTTP status for the route handler.
   */
  async function handleWebhook(
    body: string,
    headers: Record<string, string>,
  ): Promise<{ status: number; message: string }> {
    const keys = await settings.getIntegrationKeys();
    if (!keys.polarWebhookSecret) return { status: 500, message: "Webhook secret not configured" };

    let event: ReturnType<typeof validateEvent>;
    try {
      event = validateEvent(body, headers, keys.polarWebhookSecret);
    } catch (err) {
      if (err instanceof WebhookVerificationError) return { status: 401, message: "Invalid signature" };
      throw err;
    }

    if (!event.type.startsWith("subscription.")) return { status: 200, message: "ignored" };
    if (!("customer" in event.data) || !("currentPeriodEnd" in event.data)) return { status: 200, message: "ignored" };
    const sub = event.data;

    // Prefer the external id we set at checkout; fall back to email for subscriptions made elsewhere.
    const externalId = sub.customer.externalId;
    const email = sub.customer.email.toLowerCase().trim();
    const [found] = externalId
      ? await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.id, externalId)).limit(1)
      : await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.email, email)).limit(1);
    if (!found) {
      log.warn("webhook for unknown customer", { type: event.type });
      return { status: 200, message: "unknown customer" };
    }

    const values = {
      polarSubscriptionId: sub.id,
      polarCustomerId: sub.customerId,
      productId: sub.productId,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd ?? new Date(0),
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    };
    await db
      .insert(schema.subscription)
      .values({ userId: found.id, ...values })
      .onConflictDoUpdate({ target: schema.subscription.userId, set: values });
    return { status: 200, message: "synced" };
  }

  return {
    isConfigured: async () => (await client()) !== null,
    listProducts,
    createProduct,
    updateProduct,
    archiveProduct,
    createCheckout,
    getSubscriptionStatus,
    handleWebhook,
  };
}

export type PaymentsService = ReturnType<typeof createPaymentsService>;
