/**
 * SOURCE OF TRUTH KEYWORDS: createEmailService, EmailService, sendEmail, emailTemplate, escapeHtml, Resend, dev outbox
 * WHAT:  Sends transactional email through Resend using keys from Admin > API Keys (or .env).
 * WHY:   One mail path for auth emails, invitations and app notices. In development with no key,
 *        emails are printed to the server console instead (a "dev outbox") so sign-up,
 *        verification and password-reset flows can be tested without a Resend account.
 * WHERE: packages/auth (verification, reset, invitations), packages/api routers.
 */
import "server-only";
import { Resend } from "resend";

import { createLogger } from "./logger";
import type { SettingsService } from "./settings";
import type { CoreEnv } from "./types";

const log = createLogger("email");
const FALLBACK_FROM_ADDRESS = "onboarding@resend.dev";

export type EmailMessage = { to: string; subject: string; html: string; text?: string };

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Shared layout so every email looks consistent. Inputs must already be escaped. */
export function emailTemplate(opts: {
  appName: string;
  heading: string;
  body: string;
  actionUrl?: string;
  actionLabel?: string;
}) {
  const button = opts.actionUrl
    ? `<p style="margin:24px 0"><a href="${escapeHtml(opts.actionUrl)}" style="background:#111;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">${escapeHtml(opts.actionLabel ?? "Open")}</a></p><p style="color:#666;font-size:12px">Or paste this link into your browser: ${escapeHtml(opts.actionUrl)}</p>`
    : "";
  return `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111"><h2 style="margin:0 0 16px">${escapeHtml(opts.heading)}</h2>${opts.body}${button}<p style="color:#999;font-size:12px;margin-top:32px">${escapeHtml(opts.appName)}</p></div>`;
}

export function createEmailService(settings: SettingsService, env: CoreEnv) {
  async function send(message: EmailMessage): Promise<boolean> {
    const keys = await settings.getIntegrationKeys();
    const s = await settings.getSafe();
    const appName = s?.appName ?? "Project Starter";

    if (!keys.resendApiKey) {
      if (env.NODE_ENV !== "production") {
        log.info("DEV OUTBOX (no Resend key set, email printed instead of sent)", {
          to: message.to,
          subject: message.subject,
        });
        console.log(
          message.text ??
            message.html
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .trim(),
        );
        return true;
      }
      log.error("email not sent: no Resend API key configured", { subject: message.subject });
      return false;
    }

    const configured = keys.resendFromEmail?.trim();
    const from =
      configured && !configured.includes("yourdomain.com") ? configured : `${appName} <${FALLBACK_FROM_ADDRESS}>`;
    try {
      const { error } = await new Resend(keys.resendApiKey).emails.send({ from, ...message });
      if (error) {
        log.error("resend rejected the email", { subject: message.subject, reason: error.message });
        return false;
      }
      return true;
    } catch (err) {
      log.error("email send failed", { subject: message.subject }, err);
      return false;
    }
  }

  return { send };
}

export type EmailService = ReturnType<typeof createEmailService>;
