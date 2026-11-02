import { verseIdFromCode } from "@starter/bible-core/verse-id";
import { createHashHistory, createRootRoute, createRoute, createRouter, redirect } from "@tanstack/react-router";
import { z } from "zod";

import { AppShell } from "./app/app-shell";
import { ProgressPage } from "./features/progress/progress-page";
import { ReaderPage } from "./features/reader/reader-page";
import { SettingsPage } from "./features/settings/settings-page";
import { StudyPage } from "./features/study/study-page";
import { TodayPage } from "./features/today/today-page";

/**
 * SOURCE OF TRUTH KEYWORDS: router, routes, readSearch, studySearch, navigation, hash history
 * WHAT:  The app's screens and their URL state (open chapter, focused verse, study tab).
 * WHY:   URL state makes back/forward work like a browser and lets any screen deep-link into
 *        the reader. Hash history works both in the browser preview and inside the app bundle.
 * WHERE: main.tsx; links and navigate() calls across features.
 */
const rootRoute = createRootRoute({ component: AppShell });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/today" });
  },
});

const todayRoute = createRoute({ getParentRoute: () => rootRoute, path: "/today", component: TodayPage });

export const readSearch = z.object({
  c: z.number().int().optional().catch(undefined),
  v: z.number().int().optional().catch(undefined),
});

export const readRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/read",
  validateSearch: readSearch,
  component: ReaderPage,
});

export const studySearch = z.object({
  tab: z.enum(["notes", "highlights", "collections", "journal"]).optional().catch(undefined),
  note: z.string().optional().catch(undefined),
});

export const studyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/study",
  validateSearch: studySearch,
  component: StudyPage,
});

const progressRoute = createRoute({ getParentRoute: () => rootRoute, path: "/progress", component: ProgressPage });
const settingsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/settings", component: SettingsPage });

const routeTree = rootRoute.addChildren([indexRoute, todayRoute, readRoute, studyRoute, progressRoute, settingsRoute]);

export const router = createRouter({ routeTree, history: createHashHistory() });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export const DEFAULT_CHAPTER = verseIdFromCode("JHN", 3) ?? 43_003_000;
