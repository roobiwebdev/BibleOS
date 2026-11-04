import { StrictMode } from "react";
import { renderToString } from "react-dom/server";

import { App } from "./app";

/**
 * SOURCE OF TRUTH KEYWORDS: render, prerender, static HTML, SEO, entry-server
 * WHAT:  Renders the page to HTML at build time (scripts/prerender.mjs).
 * WHY:   Search engines, link previews and visitors without JavaScript get the full text; the
 *        browser then hydrates it. The demo is lazy, so its still poster is what gets rendered.
 * WHERE: scripts/prerender.mjs.
 */
export function render(): string {
  return renderToString(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
