/**
 * SOURCE OF TRUTH KEYWORDS: searchMessages, Search strings, search copy
 * WHAT:  English and Amharic interface text for the Search feature.
 * WHY:   Each feature owns its section so features can be built in parallel; messages.ts
 *        composes them, and the `am` object must match the `en` shape.
 * WHERE: messages.ts (as `t.search`).
 */
const en = {
  title: "Search the Bible",
};

const am: typeof en = {
  title: "መጽሐፍ ቅዱስን ፈልግ",
};

export const searchMessages = { en, am };
