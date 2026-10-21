"use client";
/**
 * SOURCE OF TRUTH KEYWORDS: TRPCProvider, useTRPC, trpc client, react query, QueryClient, httpBatchLink
 * WHAT:  tRPC + TanStack Query provider for client components.
 * WHY:   New client features call the API with typed hooks: `const trpc = useTRPC();
 *        useQuery(trpc.notifications.unreadCount.queryOptions())`. Existing Batman screens call
 *        server actions in lib/actions, which use the same routers on the server.
 * WHERE: components/providers.tsx wraps the app; any client component may call useTRPC().
 */
import type { AppRouter } from "@starter/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import { useState } from "react";
import superjson from "superjson";

export const { TRPCProvider, useTRPC, useTRPCClient } = createTRPCContext<AppRouter>();

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } } });
}

export function TRPCReactProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        loggerLink({
          enabled: (op) =>
            process.env.NODE_ENV === "development" && op.direction === "down" && op.result instanceof Error,
        }),
        httpBatchLink({ url: "/api/trpc", transformer: superjson }),
      ],
    }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
