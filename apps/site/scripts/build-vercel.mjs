// Assembles a Vercel prebuilt deployment (Build Output API v3) in apps/site/.vercel/output:
//   static/                    the landing page exactly as `pnpm --filter site build` writes dist/
//   functions/api/bible.func/  the Bible API relay, bundled by vite.relay.config.ts
//   config.json                version 3 only: Vercel serves the files, then the function
// Deploy it with `vercel deploy --prebuilt --prod` from apps/site (see docs/engineering/releasing.md).
import { cp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const output = `${root}.vercel/output`;
const fn = `${output}/functions/api/bible.func`;

await stat(`${root}dist/index.html`).catch(() => {
  throw new Error("dist/index.html is missing: run `pnpm --filter site build` first");
});
await stat(`${fn}/index.mjs`).catch(() => {
  throw new Error("The relay bundle is missing: run `vite build --config vite.relay.config.ts` first");
});

await rm(`${output}/static`, { recursive: true, force: true });
// dist/.vercel is the old static-only project link; it is not part of the site.
await cp(`${root}dist`, `${output}/static`, { recursive: true, filter: (src) => !src.includes("/dist/.vercel") });

await writeFile(
  `${fn}/.vc-config.json`,
  `${JSON.stringify(
    {
      runtime: "nodejs22.x",
      handler: "index.mjs",
      launcherType: "Nodejs",
      shouldAddHelpers: false,
      maxDuration: 15,
    },
    null,
    2,
  )}\n`,
);
await writeFile(`${fn}/package.json`, `${JSON.stringify({ type: "module" })}\n`);
await writeFile(`${output}/config.json`, `${JSON.stringify({ version: 3 }, null, 2)}\n`);

const bundle = await readFile(`${fn}/index.mjs`, "utf8");
console.log(`Vercel output ready in ${output} (relay bundle ${Math.round(bundle.length / 1024)} KB)`);
