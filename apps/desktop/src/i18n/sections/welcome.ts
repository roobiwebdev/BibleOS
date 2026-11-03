/**
 * SOURCE OF TRUTH KEYWORDS: welcomeMessages, Welcome strings, welcome copy
 * WHAT:  English and Amharic interface text for the Welcome feature.
 * WHY:   Each feature owns its section so features can be built in parallel; messages.ts
 *        composes them, and the `am` object must match the `en` shape.
 * WHERE: messages.ts (as `t.welcome`).
 */
const en = {
  title: "Welcome to BibleOS",
};

const am: typeof en = {
  title: "እንኳን ወደ BibleOS በደህና መጡ",
};

export const welcomeMessages = { en, am };
