import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Relative asset paths, so the same build works at a domain root (bibleos.roobi.dev) or
// under a sub-path such as a GitHub Pages project URL.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  server: { port: 4310, strictPort: true },
  preview: { port: 4311, strictPort: true },
  build: { target: "es2022", outDir: "dist" },
  // The prerender bundle includes everything, so it runs in plain Node without workspace TS.
  ssr: { noExternal: true },
});
