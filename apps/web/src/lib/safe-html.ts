/**
 * SOURCE OF TRUTH KEYWORDS: sanitizeHtml, markdownToSafeHtml, safe html, DOMPurify, XSS, rich text rendering, blog content, legal content
 * WHAT:  Server-side sanitizers for admin-authored rich text before it reaches dangerouslySetInnerHTML.
 * WHY:   Blog posts (Tiptap HTML) and legal pages (markdown) are stored as raw strings. Batman
 *        rendered them unsanitized; a compromised admin account or a pasted payload could then run
 *        script for every visitor. Sanitizing at render time protects old rows too.
 * WHERE: app/blog/[slug]/page.tsx, app/legal/[slug]/page.tsx.
 */
import "server-only";
import DOMPurify from "isomorphic-dompurify";
import { marked } from "marked";

const PURIFY_CONFIG = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ["style", "form", "input", "button", "textarea", "select"],
  FORBID_ATTR: ["style"],
};

/** Sanitizes an HTML string (scripts, event handlers and javascript: URLs are removed). */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, PURIFY_CONFIG);
}

/** Renders GitHub-flavoured markdown (embedded HTML allowed) and sanitizes the result. */
export function markdownToSafeHtml(markdown: string): string {
  const html = marked.parse(markdown, { gfm: true, breaks: true, async: false });
  return sanitizeHtml(html);
}
