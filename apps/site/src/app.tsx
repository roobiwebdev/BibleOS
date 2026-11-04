import { NextStepsDialog } from "./components/next-steps-dialog";
import { NextStepsProvider } from "./lib/next-steps";
import { ReleaseProvider } from "./lib/release-context";
import { Amharic } from "./sections/amharic";
import { DownloadSection } from "./sections/download";
import { Faq } from "./sections/faq";
import { Features } from "./sections/features";
import { SiteFooter } from "./sections/footer";
import { Hero } from "./sections/hero";
import { InstallGuide } from "./sections/install";
import { SiteNav } from "./sections/nav";
import { Privacy } from "./sections/privacy";

/**
 * SOURCE OF TRUTH KEYWORDS: App, landing page, section order, site root
 * WHAT:  The whole landing page, top to bottom.
 * WHY:   One page: see the app, learn what it does, download, install, get answers.
 * WHERE: main.tsx (browser) and entry-server.tsx (prerender at build time).
 */
export function App() {
  return (
    <ReleaseProvider>
      <NextStepsProvider>
        <SiteNav />
        <main id="main">
          <Hero />
          <Features />
          <Amharic />
          <Privacy />
          <DownloadSection />
          <InstallGuide />
          <Faq />
        </main>
        <SiteFooter />
        <NextStepsDialog />
      </NextStepsProvider>
    </ReleaseProvider>
  );
}
