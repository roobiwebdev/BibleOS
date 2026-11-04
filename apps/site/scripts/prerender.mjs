// Puts the server-rendered page into dist/index.html, then removes the server bundle.
import { readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const { render } = await import(`${root}.ssr/entry-server.js`);
const file = `${root}dist/index.html`;
const html = await readFile(file, "utf8");
if (!html.includes("<!--app-->")) throw new Error("dist/index.html has no <!--app--> placeholder");
// The server bundle writes asset URLs from the root; the site uses relative paths (base "./").
const app = render().replaceAll('"/assets/', '"./assets/');
await writeFile(file, html.replace("<!--app-->", app));
await rm(`${root}.ssr`, { recursive: true, force: true });
console.log("Prerendered dist/index.html");
