// Captures the site's images from the real app and the site itself:
//   public/screenshots/<screen>-<theme>.webp   from the desktop browser preview
//   public/demo-poster.webp                    the hero demo's settled frame
//   public/og.png                              the Open Graph card
//
// Start both servers first, then run `pnpm --filter site capture`:
//   pnpm --filter desktop dev:vite      (APP_URL, default http://localhost:1420)
//   pnpm --filter site dev              (SITE_URL, default http://localhost:4310)
// Needs Playwright's Chromium (`pnpm exec playwright install chromium`) and `cwebp` on PATH.
import { execFileSync } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const APP = process.env.APP_URL ?? "http://localhost:1420";
const SITE = process.env.SITE_URL ?? "http://localhost:4310";
const root = fileURLToPath(new URL("..", import.meta.url));
const out = `${root}public/`;
const tmp = `${root}.capture/`;
await mkdir(`${out}screenshots`, { recursive: true });
await mkdir(tmp, { recursive: true });

const webp = (png, dest, quality = 82) => execFileSync("cwebp", ["-quiet", "-q", String(quality), png, "-o", dest]);

const browser = await chromium.launch();

// The app's browser preview keeps settings until reload, so navigate by hash after setting them.
const SCREENS = [
  { name: "reader", hash: "#/read?c=43003000&v=16", wait: 2500 },
  { name: "study", hash: "#/study", wait: 1500 },
  { name: "search", hash: `#/search?q=${encodeURIComponent("ፍቅር")}&t=am-ulb`, wait: 2500 },
  { name: "plans", hash: "#/plans", wait: 1500 },
  { name: "progress", hash: "#/progress", wait: 1500 },
];

for (const theme of ["Sepia", "Night"]) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5 });
  await page.goto(`${APP}/#/settings`);
  await page.waitForTimeout(2000);
  await page.getByRole("radio", { name: new RegExp(`${theme}$`) }).click();
  const parallel = page.locator("select").nth(1);
  await parallel.selectOption("am-ulb");
  for (const screen of SCREENS) {
    await page.evaluate((hash) => (window.location.hash = hash), screen.hash);
    await page.waitForTimeout(screen.wait);
    if (screen.name === "reader") {
      // Select John 3:16 so the screenshot shows its note and a highlight-ready verse.
      await page.getByText("For God so loved the world", { exact: false }).first().click();
      await page.waitForTimeout(500);
      await page.keyboard.press("Escape");
      await page.mouse.move(0, 0);
      await page.waitForTimeout(400);
    }
    const png = `${tmp}${screen.name}.png`;
    await page.screenshot({ path: png });
    webp(png, `${out}screenshots/${screen.name}-${theme.toLowerCase()}.webp`);
    console.log("captured", screen.name, theme);
  }
  await page.close();
}

// The demo poster: the settled frame (a highlighted verse with its note), Sepia page.
const site = await browser.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1.5 });
await site.addInitScript(() => localStorage.setItem("bibleos-site-theme", "sepia"));
await site.goto(`${SITE}/?demo=14800`);
await site.waitForTimeout(2500);
const posterPng = `${tmp}poster.png`;
await site.locator('[role="img"]').first().screenshot({ path: posterPng });
webp(posterPng, `${out}demo-poster.webp`, 80);
console.log("captured demo poster");

// Open Graph card: icon, name and headline beside the demo frame.
const og = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
const posterData = (await readFile(posterPng)).toString("base64");
const iconData = (await readFile(`${root}src/assets/icon-sepia-256.png`)).toString("base64");
await og.goto(`${SITE}/`);
await og.waitForTimeout(1000);
await og.evaluate(
  ({ poster, icon }) => {
    document.body.innerHTML = `
      <div style="position:fixed;inset:0;display:flex;align-items:center;gap:40px;padding:0 0 0 64px;background:var(--background);color:var(--foreground);overflow:hidden">
        <div style="width:430px;flex-shrink:0">
          <img src="data:image/png;base64,${icon}" style="width:88px;height:88px" />
          <p style="margin-top:22px;font:600 26px/1.2 var(--font-sans);letter-spacing:-0.01em">BibleOS</p>
          <p style="margin-top:10px;font:500 42px/1.12 var(--reading-font);letter-spacing:-0.015em">Read the Bible in Amharic and English, side by side.</p>
          <p style="margin-top:18px;font:400 19px/1.4 var(--font-sans);color:var(--muted-foreground)">Free for Mac, Windows and Linux</p>
        </div>
        <img src="data:image/png;base64,${poster}" style="height:520px;border-radius:18px;box-shadow:0 30px 60px -30px rgba(0,0,0,.45)" />
      </div>`;
  },
  { poster: posterData, icon: iconData },
);
await og.waitForTimeout(800);
await og.screenshot({ path: `${out}og.png` });
console.log("captured og.png");

await browser.close();
await rm(tmp, { recursive: true, force: true });
