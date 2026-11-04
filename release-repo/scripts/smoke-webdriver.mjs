// Checks that a built BibleOS window actually rendered, through tauri-driver (WebDriver).
//
// Usage: node smoke-webdriver.mjs <path to the app binary> <screenshot.png>
// Expects tauri-driver to be listening on 127.0.0.1:4444 (Windows and Linux only; macOS has no
// WebDriver for its webview). Uses only Node's built-in fetch, so it needs no npm install.
//
// It passes when, within a minute of launch:
// - the sidebar shows "Today" (the React app mounted),
// - the verse of the day is shown in English and Amharic (the bundled Bible databases open),
// - the Ethiopic font in use is the bundled one, not a system font,
// and the window is still answering 20 seconds later.
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const [app, screenshotPath = "smoke.png"] = process.argv.slice(2);
if (!app) {
  console.error("usage: node smoke-webdriver.mjs <app binary> [screenshot.png]");
  process.exit(2);
}

const DRIVER = "http://127.0.0.1:4444";
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function wd(method, path, body) {
  const init =
    body === undefined
      ? { method }
      : { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
  const response = await fetch(`${DRIVER}${path}`, init);
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${JSON.stringify(json.value ?? json)}`);
  return json.value;
}

async function waitForDriver() {
  for (let i = 0; i < 60; i++) {
    try {
      await wd("GET", "/status");
      return;
    } catch {
      await sleep(1000);
    }
  }
  throw new Error("tauri-driver did not start on port 4444");
}

// Runs in the app window; returns what the checks need.
const PROBE = `
  const text = (selector) => document.querySelector(selector)?.textContent?.trim() ?? "";
  const ethiopicFonts = [...document.fonts].filter((f) => /Noto (Serif|Sans) Ethiopic/.test(f.family));
  return {
    title: document.title,
    nav: text("aside nav"),
    english: text('blockquote[lang="en"]'),
    amharic: text('blockquote[lang="am"]'),
    ethiopicFontLoaded: ethiopicFonts.some((f) => f.status === "loaded"),
  };
`;

function problems(state) {
  const found = [];
  if (!state.nav.includes("Today")) found.push('sidebar has no "Today"');
  if (!state.english) found.push("English verse of the day is empty");
  if (!/[ሀ-፿]/.test(state.amharic)) found.push("Amharic verse of the day has no Ethiopic text");
  if (!state.ethiopicFontLoaded) found.push("bundled Noto Ethiopic font did not load");
  return found;
}

await waitForDriver();
const session = await wd("POST", "/session", {
  capabilities: { alwaysMatch: { browserName: "wry", "tauri:options": { application: resolve(app) } } },
});
const id = session.sessionId;
let failed = [];
try {
  let state;
  for (let i = 0; i < 60; i++) {
    state = await wd("POST", `/session/${id}/execute/sync`, { script: PROBE, args: [] });
    failed = problems(state);
    if (failed.length === 0) break;
    await sleep(1000);
  }
  console.log("first check:", JSON.stringify(state, null, 2));

  const png = await wd("GET", `/session/${id}/screenshot`);
  await writeFile(screenshotPath, Buffer.from(png, "base64"));
  console.log(`screenshot saved to ${screenshotPath}`);

  if (failed.length === 0) {
    await sleep(20_000);
    const later = await wd("POST", `/session/${id}/execute/sync`, { script: PROBE, args: [] });
    failed = problems(later);
    console.log("still running after 20 s:", failed.length === 0);
  }
} finally {
  await wd("DELETE", `/session/${id}`).catch(() => undefined);
}

if (failed.length > 0) {
  console.error(`smoke test failed: ${failed.join("; ")}`);
  process.exit(1);
}
console.log("smoke test passed");
