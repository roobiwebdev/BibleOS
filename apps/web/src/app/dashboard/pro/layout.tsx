import { redirect } from "next/navigation";

import { requireSession } from "@/server/session";
import { api } from "@/server/trpc";

/** Subscription gate: signed-in users without an active subscription are sent to /subscribe. */
export default async function ProLayout({ children }: { children: React.ReactNode }) {
  await requireSession();

  let isSubscribed = false;
  try {
    ({ isSubscribed } = await (await api()).billing.subscriptionStatus());
  } catch {
    isSubscribed = false;
  }
  // redirect() throws, so it must stay outside the try block.
  if (!isSubscribed) redirect("/subscribe" as never);

  return <>{children}</>;
}
