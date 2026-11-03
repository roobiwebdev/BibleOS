/**
 * SOURCE OF TRUTH KEYWORDS: historyMessages, History strings, history copy
 * WHAT:  English and Amharic interface text for the History feature.
 * WHY:   Each feature owns its section so features can be built in parallel; messages.ts
 *        composes them, and the `am` object must match the `en` shape.
 * WHERE: messages.ts (as `t.history`).
 */
const en = {
  title: "History",
};

const am: typeof en = {
  title: "ታሪክ",
};

export const historyMessages = { en, am };
