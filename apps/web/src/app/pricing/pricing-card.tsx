"use client";

import { Button } from "@starter/ui/components/button";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { createCheckoutSession, type BillingProduct } from "@/lib/actions/billing";

function formatPrice(p: { priceAmount: number | null; priceCurrency: string; amountType: string }): string {
  if (p.amountType === "free") return "Free";
  if (p.priceAmount != null) {
    const amount = (p.priceAmount / 100).toFixed(2);
    const curr = p.priceCurrency.toUpperCase();
    return `${curr} ${amount}`;
  }
  return "—";
}

export function PricingCard({ product, isLoggedIn }: { product: BillingProduct; isLoggedIn: boolean }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const primaryPrice = product.prices[0];
  const priceStr = primaryPrice ? formatPrice(primaryPrice) : "—";
  const { summary: description, features } = product;

  async function handleSubscribe() {
    if (!isLoggedIn) {
      router.push("/login?callbackUrl=/pricing");
      return;
    }

    setLoading(true);
    try {
      const result = await createCheckoutSession(product.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.url) {
        window.location.href = result.url;
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-border/40 bg-card/30 rounded-sm p-5 flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold tracking-tight">{product.name}</h3>
        {description && <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">{description}</p>}
        {features.length > 0 && (
          <ul className="mt-2 space-y-1">
            {features.map((feature) => (
              <li key={feature} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                <span className="text-foreground/50 mt-0.5 shrink-0">•</span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex items-baseline gap-1">
          <span className="text-xl font-bold tracking-tight">{priceStr}</span>
          {product.isRecurring && (
            <span className="text-[10px] text-muted-foreground">
              /{product.recurringInterval === "month" ? "mo" : "yr"}
            </span>
          )}
        </div>

        {product.prices.length > 1 && (
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">{product.prices.length} price options</p>
        )}
      </div>

      <Button
        className="w-full h-8 text-xs bg-foreground text-background hover:bg-foreground/90"
        onClick={handleSubscribe}
        disabled={loading}
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : isLoggedIn ? "Subscribe" : "Sign in to subscribe"}
      </Button>
    </div>
  );
}
