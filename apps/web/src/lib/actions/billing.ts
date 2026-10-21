"use server";
/**
 * SOURCE OF TRUTH KEYWORDS: billing actions, listPolarProducts, createPolarProduct, updatePolarProduct, archivePolarProduct, listProductsForPricing, createCheckoutSession, getSubscriptionStatus, BillingProduct
 * WHAT:  Server-action adapters over the billing router, keeping Batman's polar.ts names and
 *        `{ ..., error }` result shapes so the pages stay unchanged.
 * WHERE: app/admin/products, app/pricing (pricing card), app/dashboard/pro.
 */
import type { RouterInputs, RouterOutputs } from "@starter/api";

import { api } from "@/server/trpc";

export type BillingProduct = RouterOutputs["billing"]["pricingProducts"]["products"][number];

const messageOf = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

export async function listPolarProducts(input: RouterInputs["billing"]["listProducts"] = { includeArchived: false }) {
  return (await api()).billing.listProducts(input);
}

export async function createPolarProduct(
  input: RouterInputs["billing"]["createProduct"],
): Promise<{ product?: BillingProduct; error?: string }> {
  try {
    return { product: await (await api()).billing.createProduct(input) };
  } catch (e) {
    return { error: messageOf(e, "Failed to create product") };
  }
}

export async function updatePolarProduct(
  input: RouterInputs["billing"]["updateProduct"],
): Promise<{ product?: BillingProduct; error?: string }> {
  try {
    return { product: await (await api()).billing.updateProduct(input) };
  } catch (e) {
    return { error: messageOf(e, "Failed to update product") };
  }
}

export async function archivePolarProduct(id: string): Promise<{ error?: string }> {
  try {
    await (await api()).billing.archiveProduct({ id });
    return {};
  } catch (e) {
    return { error: messageOf(e, "Failed to archive product") };
  }
}

export async function listProductsForPricing() {
  return (await api()).billing.pricingProducts();
}

/** Return URLs come from the server's app URL; the client never chooses them. */
export async function createCheckoutSession(productId: string): Promise<{ url?: string; error?: string }> {
  try {
    return await (await api()).billing.createCheckout({ productId });
  } catch (e) {
    return { error: messageOf(e, "Failed to create checkout") };
  }
}

export async function getSubscriptionStatus() {
  return (await api()).billing.subscriptionStatus();
}
