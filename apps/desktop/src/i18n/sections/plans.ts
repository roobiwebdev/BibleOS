/**
 * SOURCE OF TRUTH KEYWORDS: plansMessages, Plans strings, plans copy
 * WHAT:  English and Amharic interface text for the Plans feature.
 * WHY:   Each feature owns its section so features can be built in parallel; messages.ts
 *        composes them, and the `am` object must match the `en` shape.
 * WHERE: messages.ts (as `t.plans`).
 */
const en = {
  title: "Reading plans",
};

const am: typeof en = {
  title: "የንባብ ዕቅዶች",
};

export const plansMessages = { en, am };
