import { defineConfig } from "vite";

// Bundles the Bible API relay (relay/vercel.ts) and everything it imports, workspace
// TypeScript packages and zod included, into one ES module that plain Node runs.
// scripts/build-vercel.mjs then adds the static site and the Vercel config around it.
export default defineConfig({
  // The site's public files belong to the static output, not the function.
  publicDir: false,
  build: {
    ssr: "relay/vercel.ts",
    outDir: ".vercel/output/functions/api/bible.func",
    emptyOutDir: true,
    target: "node22",
    minify: false,
    rollupOptions: { output: { entryFileNames: "index.mjs", format: "es" } },
  },
  ssr: { noExternal: true, target: "node" },
});
