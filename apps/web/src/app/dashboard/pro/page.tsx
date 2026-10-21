import { api } from "@/server/trpc";

export default async function ProDashboardPage() {
  // The pro layout already guarantees a signed-in, subscribed user.
  const { subscription } = await (await api()).billing.subscriptionStatus();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-base font-semibold tracking-tight">Pro</h1>
        <p className="text-[11px] text-muted-foreground mt-0.5">You have an active subscription.</p>
      </div>

      {subscription && (
        <div className="border border-border/40 bg-card/50 p-4">
          <p className="text-xs font-medium">Subscription</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Status: <span className="capitalize">{subscription.status}</span>
            {subscription.cancelAtPeriodEnd && <span className="ml-1">(ends at period end)</span>}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Current period ends: {subscription.currentPeriodEnd.toLocaleDateString()}
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        This is a subscription-protected area. Add your premium content here.
      </p>
    </div>
  );
}
