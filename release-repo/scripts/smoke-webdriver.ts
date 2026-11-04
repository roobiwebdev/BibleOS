// Checks that a built BibleOS window actually rendered, through tauri-driver (WebDriver).
//
// Usage: node smoke-webdriver.ts <path to the app binary> <screenshot.png>
// Node 24 runs this TypeScript directly (type stripping), so it needs no build step or npm
// install. Expects tauri-driver to be listening on 127.0.0.1:4444 (Windows and Linux only;
// macOS has no WebDriver for its webview).
//
// It passes when, within a minute of launch:
// - the sidebar shows "Today" (the React app mounted),
// - the verse of the day is shown in English and Amharic (the bundled Bible databases open),
// - the Ethiopic font in use is the bundled one, not a system font,
// and the window is still answering 20 seconds later.
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

interface WindowState {
  title: string;
  nav: string;
  english: string;
  amharic: string;
  ethiopicFontLoaded: boolean;
}

const [app, screenshotPath = "smoke.png"] = process.argv.slice(2);
if (!app) {
  console.error("usage: node smoke-webdriver.ts <app binary> [screenshot.png]");
  process.exit(2);
}

const DRIVER = "http://127.0.0.1:4444";
const sleep = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// WebDriver wraps every answer as { value: ... }.
async function wd(method: string, path: string, body?: unknown): Promise<unknown> {
  const init: RequestInit =
    body === undefined
      ? { method }
      : { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
  const response = await fetch(`${DRIVER}${path}`, init);
  const json: unknown = await response.json().catch(() => ({}));
  const value = isRecord(json) && "value" in json ? json.value : json;
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${JSON.stringify(value)}`);
  return value;
}

function toState(value: unknown): WindowState {
  const field = (key: string) => (isRecord(value) && typeof value[key] === "string" ? value[key] : "");
  return {
    title: field("title"),
    nav: field("nav"),
    english: field("english"),
    amharic: field("amharic"),
    ethiopicFontLoaded: isRecord(value) && value.ethiopicFontLoaded === true,
  };
}

async function waitForDriver(): Promise<void> {
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

function problems(state: WindowState): string[] {
  const found: string[] = [];
  if (!state.nav.includes("Today")) found.push('sidebar has no "Today"');
  if (!state.english) found.push("English verse of the day is empty");
  if (!/[ሀ-፿]/.test(state.amharic)) found.push("Amharic verse of the day has no Ethiopic text");
  if (!state.ethiopicFontLoaded) found.push("bundled Noto Ethiopic font did not load");
  return found;
}

const probe = async (id: string) =>
  toState(await wd("POST", `/session/${id}/execute/sync`, { script: PROBE, args: [] }));

await waitForDriver();
const session = await wd("POST", "/session", {
  capabilities: { alwaysMatch: { browserName: "wry", "tauri:options": { application: resolve(app) } } },
});
const id = isRecord(session) && typeof session.sessionId === "string" ? session.sessionId : "";
if (!id) throw new Error(`no session id in ${JSON.stringify(session)}`);

let failed: string[] = [];
try {
  let state: WindowState | undefined;
  for (let i = 0; i < 60; i++) {
    state = await probe(id);
    failed = problems(state);
    if (failed.length === 0) break;
    await sleep(1000);
  }
  console.log("first check:", JSON.stringify(state, null, 2));

  const png = await wd("GET", `/session/${id}/screenshot`);
  if (typeof png === "string") {
    await writeFile(screenshotPath, Buffer.from(png, "base64"));
    console.log(`screenshot saved to ${screenshotPath}`);
  }

  if (failed.length === 0) {
    await sleep(20_000);
    failed = problems(await probe(id));
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
