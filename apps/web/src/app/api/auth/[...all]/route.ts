import { getServices } from "@/server/services";

async function handler(request: Request) {
  const auth = await getServices().getAuth();
  return auth.handler(request);
}

export { handler as GET, handler as POST };
