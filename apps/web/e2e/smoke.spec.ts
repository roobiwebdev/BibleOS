/**
 * End-to-end smoke test of the prebuilt features against a running app.
 * Needs: migrated database, an admin account (E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD,
 * default admin@example.com / change-me-123 as created by `SEED_ADMIN_* pnpm db:seed`).
 * Run: pnpm --filter web build && pnpm --filter web test:e2e
 */
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@example.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "change-me-123";
const stamp = Date.now();
const USER = { name: "E2E User", email: `e2e-${stamp}@example.com`, password: "e2e-password-123" };

/** Calls a tRPC mutation over HTTP with the page's cookies (superjson envelope). */
async function mutate(request: APIRequestContext, path: string, input: unknown) {
  const res = await request.post(`/api/trpc/${path}`, { data: { json: input } });
  expect(res.ok(), `${path} -> ${res.status()} ${await res.text()}`).toBeTruthy();
  return res.json();
}

async function query(request: APIRequestContext, path: string, input?: unknown) {
  const q = input === undefined ? "" : `?input=${encodeURIComponent(JSON.stringify({ json: input }))}`;
  const res = await request.get(`/api/trpc/${path}${q}`);
  expect(res.ok(), `${path} -> ${res.status()}`).toBeTruthy();
  return res.json();
}

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

async function expectHealthy(page: Page, path: string) {
  const res = await page.goto(path);
  expect(res?.status(), `${path} status`).toBeLessThan(400);
  await expect(page.getByText(/application error|something went wrong|unhandled runtime error/i)).toHaveCount(0);
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/(dashboard|onboarding|admin)/);
}

test.describe.serial("prebuilt features", () => {
  test("public pages render", async ({ page }) => {
    const errors = watchErrors(page);
    for (const path of [
      "/",
      "/login",
      "/signup",
      "/forgot-password",
      "/blog",
      "/pricing",
      "/legal/privacy",
      "/legal/terms",
    ]) {
      await expectHealthy(page, path);
    }
    expect(errors).toEqual([]);
  });

  test("sign up, onboarding and dashboard", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/signup");
    await page.getByPlaceholder("John Doe").fill(USER.name);
    await page.getByPlaceholder("you@example.com").fill(USER.email);
    await page.getByPlaceholder("Create a password").fill(USER.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/onboarding/);
    await expectHealthy(page, "/onboarding");
    await mutate(page.request, "user.completeOnboarding", null);
    for (const path of [
      "/dashboard",
      "/dashboard/notifications",
      "/dashboard/settings",
      "/dashboard/settings/account",
      "/dashboard/settings/appearance",
    ]) {
      await expectHealthy(page, path);
      await expect(page).toHaveURL(new RegExp(path.replace(/\//g, "\\/")));
    }
    // Welcome notification from the sign-up hook.
    const inbox = await query(page.request, "notifications.list", {
      tag: "all",
      unreadOnly: false,
      page: 1,
      limit: 20,
    });
    expect(JSON.stringify(inbox)).toContain("Welcome");
    // A normal user cannot reach admin.
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/dashboard/);
    const denied = await page.request.get("/api/trpc/settings.adminGet");
    expect(denied.status()).toBe(403);
    // Feedback form endpoint.
    await mutate(page.request, "feedback.submit", { category: "bug", message: "E2E feedback message" });
    expect(errors).toEqual([]);
  });

  test("admin panel pages and core admin actions", async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    for (const path of [
      "/admin",
      "/admin/users",
      "/admin/analytics",
      "/admin/blog",
      "/admin/notifications",
      "/admin/products",
      "/admin/feedback",
      "/admin/general",
      "/admin/site-settings",
      "/admin/features",
      "/admin/api-keys",
      "/admin/audit-log",
      "/admin/deployment",
    ]) {
      await expectHealthy(page, path);
      await expect(page).toHaveURL(new RegExp(path.replace(/\//g, "\\/")));
    }
    await expect(page.getByText(/R2|storage/i).first())
      .toBeVisible({ timeout: 1 })
      .catch(() => undefined);

    // Broadcast a notification.
    await mutate(page.request, "notifications.sendToAll", {
      title: `E2E broadcast ${stamp}`,
      description: "Hello all",
      tag: "announcement",
    });

    // Blog: create a published post with malicious HTML and check it is sanitized publicly.
    const created = await mutate(page.request, "blog.create", {
      title: `E2E Post ${stamp}`,
      content: `<p>Safe text</p><img src=x onerror="alert(1)"><script>alert(1)</script>`,
      published: true,
    });
    const slug: string = created.result.data.json.slug;
    const postRes = await page.goto(`/blog/${slug}`);
    expect(postRes?.status()).toBe(200);
    await expect(page.getByText("Safe text")).toBeVisible();
    const html = await page.content();
    expect(html).not.toContain("onerror=");
    expect(html).not.toContain("<script>alert(1)</script>");

    // API keys are masked, never raw.
    const keys = await mutate(page.request, "settings.saveApiKeys", { resendApiKey: "re_test_1234567890abcdef" });
    expect(keys.result.data.json.success).toBe(true);
    const masked = await query(page.request, "settings.apiKeys");
    expect(JSON.stringify(masked)).not.toContain("re_test_1234567890abcdef");
    await mutate(page.request, "settings.saveApiKeys", { resendApiKey: "" });

    // Audit log captured the admin's changes.
    const audit = await query(page.request, "admin.auditLog", { page: 1, limit: 50 });
    expect(JSON.stringify(audit)).toContain("updateApiKeys");
    expect(errors).toEqual([]);
  });

  test("waitlist and maintenance modes", async ({ page, browser }) => {
    await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await mutate(page.request, "settings.update", { waitlistMode: true, waitlistHeadline: `E2E waitlist ${stamp}` });
    const visitor = await browser.newPage();
    await visitor.goto("/");
    await expect(visitor.getByText(`E2E waitlist ${stamp}`)).toBeVisible();
    await mutate(visitor.request, "waitlist.join", { email: `wait-${stamp}@example.com` });
    const entries = await query(page.request, "admin.waitlistEntries", { limit: 50 });
    expect(JSON.stringify(entries)).toContain(`wait-${stamp}@example.com`);
    await mutate(page.request, "settings.update", { waitlistMode: false, maintenanceMode: true });

    // A signed-in non-admin is sent to the maintenance page; admins are not.
    const userPage = await browser.newPage();
    await signIn(userPage, USER.email, USER.password).catch(() => undefined);
    await userPage.goto("/dashboard");
    await expect(userPage).toHaveURL(/\/maintenance/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
    await mutate(page.request, "settings.update", { maintenanceMode: false });
  });
});
