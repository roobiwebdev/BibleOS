/**
 * SOURCE OF TRUTH KEYWORDS: billingRouter, billing.listProducts, billing.createProduct, billing.updateProduct, billing.archiveProduct, billing.pricingProducts, billing.createCheckout, billing.subscriptionStatus, Polar, checkout, subscription
 * WHAT:  Polar products (admin catalogue), the public pricing list, checkout sessions and the
 *        signed-in user's subscription status.
 * WHY:   Port of Batman's lib/actions/polar.ts on top of ctx.services.payments. Read endpoints return
 *        `{ products, error }` (Batman's shape) so admin and pricing screens can show the
 *        "configure Polar" hint instead of crashing; mutations throw so a failed call writes no
 *        audit row (the web actions map errors back to `{ error }`). Checkout URLs are built from the server's app
 *        URL, never from a client-supplied origin.
 * WHERE: apps/web/src/lib/actions/billing.ts, app/admin/products, app/pricing, app/dashboard/pro.
 */
import { TRPCError } from "@trpc/server";
import { buildProductDescription, parseProductDescription, type PolarProduct } from "@starter/core/payments";
import { z } from "zod";

import { RATE_LIMITS } from "../lib/rate-limit";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "../trpc";

const errorMessage = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

/** Runs a Polar call; provider failures become a BAD_GATEWAY with Polar's message (rolls back the audit row). */
async function providerCall<T>(fn: () => Promise<T>, fallback: string): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof TRPCError) throw e;
    throw new TRPCError({ code: "BAD_GATEWAY", message: errorMessage(e, fallback), cause: e });
  }
}

export const billingCreateProductInput = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  features: z.array(z.string().trim().max(200)).max(50).optional(),
  type: z.enum(["saas-monthly", "saas-yearly", "one-time"]),
  priceAmountCents: z.number().int().min(0).max(100_000_000),
  priceCurrency: z.enum(["usd", "eur", "gbp"]).optional(),
});

export const billingUpdateProductInput = z.object({
  id: z.string().min(1).max(200),
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(5000).optional(),
  features: z.array(z.string().trim().max(200)).max(50).optional(),
});

/** Adds the parsed summary + feature bullets so client components never parse descriptions. */
function withFeatures(p: PolarProduct) {
  const { description, features } = parseProductDescription(p.description);
  return { ...p, summary: description, features };
}
export type BillingProduct = ReturnType<typeof withFeatures>;

const productId = z.object({ id: z.string().min(1).max(200) });

export const billingRouter = router({
  /** Admin catalogue. `error` is set when Polar is not configured or the API call fails. */
  listProducts: adminProcedure()
    .input(z.object({ includeArchived: z.boolean().default(false) }).default({ includeArchived: false }))
    .query(async ({ ctx, input }): Promise<{ products: BillingProduct[]; error?: string }> => {
      try {
        if (!(await ctx.services.payments.isConfigured())) {
          return { products: [], error: "Polar is not configured. Add your access token in Admin → API Keys." };
        }
        const products = await ctx.services.payments.listProducts({ includeArchived: input.includeArchived });
        return { products: products.map(withFeatures) };
      } catch (e) {
        return { products: [], error: errorMessage(e, "Failed to list products") };
      }
    }),

  createProduct: adminProcedure()
    .input(billingCreateProductInput)
    .mutation(async ({ ctx, input }) => {
      const { features, description, ...rest } = input;
      const full = buildProductDescription(description ?? "", features ?? []);
      const product = await providerCall(
        () => ctx.services.payments.createProduct({ ...rest, description: full || undefined }),
        "Failed to create product",
      );
      return withFeatures(product);
    }),

  updateProduct: adminProcedure()
    .input(billingUpdateProductInput)
    .mutation(async ({ ctx, input }) => {
      const { id, name, description, features } = input;
      // Only rewrite the description when the caller sent description or features.
      const full =
        description === undefined && features === undefined
          ? undefined
          : buildProductDescription(description ?? "", features ?? []) || null;
      const product = await providerCall(
        () => ctx.services.payments.updateProduct(id, { name, ...(full === undefined ? {} : { description: full }) }),
        "Failed to update product",
      );
      return withFeatures(product);
    }),

  archiveProduct: adminProcedure()
    .input(productId)
    .mutation(async ({ ctx, input }) => {
      await providerCall(() => ctx.services.payments.archiveProduct(input.id), "Failed to archive product");
      return { id: input.id };
    }),

  /** Public pricing page. Empty list when payments are not configured. */
  pricingProducts: publicProcedure().query(async ({ ctx }): Promise<{ products: BillingProduct[]; error?: string }> => {
    try {
      return { products: (await ctx.services.payments.listProducts()).map(withFeatures) };
    } catch (e) {
      return { products: [], error: errorMessage(e, "Failed to list products") };
    }
  }),

  /** Starts a Polar checkout for the signed-in user and returns its URL. */
  createCheckout: protectedProcedure({ rateLimit: RATE_LIMITS.sensitive })
    .input(z.object({ productId: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      if (!(await ctx.services.payments.isConfigured())) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Payments are not configured" });
      }
      const root = ctx.services.appUrl.replace(/\/$/, "");
      const user = ctx.session.user;
      const url = await providerCall(
        () =>
          ctx.services.payments.createCheckout({
            productId: input.productId,
            user: { id: user.id, email: user.email, name: user.name },
            successUrl: `${root}/dashboard/pro?checkout=success`,
            returnUrl: `${root}/pricing`,
          }),
        "Failed to create checkout",
      );
      if (!url) throw new TRPCError({ code: "BAD_GATEWAY", message: "No checkout URL returned" });
      return { url };
    }),

  /** Current user's subscription (active/trialing and not past period end = subscribed). */
  subscriptionStatus: protectedProcedure().query(({ ctx }) =>
    ctx.services.payments.getSubscriptionStatus(ctx.session.user.id),
  ),
});
