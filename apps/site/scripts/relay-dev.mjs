// Local test harness for the Bible API relay: runs the bundled Vercel function
// (.vercel/output/functions/api/bible.func/index.mjs) on http://localhost:4320/api/bible.
//   pnpm --filter site relay:dev                       uses ESV_API_KEY / NLT_API_KEY from the shell
//   RELAY_FIXTURES=1 pnpm --filter site relay:dev      answers from relay/fixtures (no keys, no network)
// Vercel is not involved, so no project link is needed.
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const bundle = await import(`${root}.vercel/output/functions/api/bible.func/index.mjs`);
const port = Number(process.env.PORT ?? 4320);

const file = (name) => readFile(`${root}relay/fixtures/${name}`, "utf8");

/** Recorded publisher answers, picked by what the relay asks for. */
async function fixtureFetch(input) {
  const url = new URL(String(input));
  if (url.hostname === "api.nlt.to") {
    if (url.pathname.endsWith("/search")) return new Response(await file("nlt-search-living-water.html"));
    const ref = url.searchParams.get("ref") ?? "";
    const name = ref.startsWith("Psalms 23")
      ? "nlt-psalm-23.html"
      : ref.startsWith("Matthew 17")
        ? "nlt-matthew-17.html"
        : ref.startsWith("John 3")
          ? "nlt-john-3.html"
          : undefined;
    return name ? new Response(await file(name)) : new Response("<html><body></body></html>");
  }
  if (url.hostname === "api.esv.org") {
    if (url.pathname.includes("/search/")) return new Response(await file("esv-docs-search-rabble.json"));
    const q = url.searchParams.get("q") ?? "";
    const name = q.startsWith("Matthew 17") ? "esv-synthetic-matthew-17.json" : "esv-docs-john-11-35.json";
    return new Response(await file(name), { headers: { "content-type": "application/json" } });
  }
  return new Response("not found", { status: 404 });
}

const handler = process.env.RELAY_FIXTURES
  ? bundle.toNodeHandler(
      bundle.createRelay({
        env: { ESV_API_KEY: "fixture", NLT_API_KEY: "fixture" },
        fetch: fixtureFetch,
        now: Date.now,
      }),
    )
  : bundle.default;

createServer((req, res) => {
  if (!req.url?.startsWith("/api/bible")) {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }
  void handler(req, res);
}).listen(port, () => {
  console.log(`Relay on http://localhost:${port}/api/bible${process.env.RELAY_FIXTURES ? " (recorded answers)" : ""}`);
});
