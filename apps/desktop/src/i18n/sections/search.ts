/**
 * SOURCE OF TRUTH KEYWORDS: searchMessages, Search strings, search copy
 * WHAT:  English and Amharic interface text for the Search feature.
 * WHY:   Each feature owns its section so features can be built in parallel; messages.ts
 *        composes them, and the `am` object must match the `en` shape.
 * WHERE: messages.ts (as `t.search`); search page and the ⌘K palette's search option.
 */
const en = {
  title: "Search the Bible",
  placeholder: "Words, “a phrase”, or -a word to leave out",
  label: "Search words",
  clear: "Clear search",
  translation: "Translation",
  scope: "Search in",
  wholeBible: "Whole Bible",
  oldTestament: "Old Testament",
  newTestament: "New Testament",
  chooseBook: "One book…",
  wholeWords: "Whole words only",
  tips: "Every word must appear. Put a phrase in quotes; put a minus sign before a word to leave it out.",
  results: "Results",
  searching: "Searching…",
  count: (n: number) => (n === 1 ? "1 verse" : `${n.toLocaleString("en")} verses`),
  showing: (shown: number, total: number) => `Showing the first ${shown} of ${total.toLocaleString("en")} verses`,
  elapsed: (ms: number) => `${ms} ms`,
  showMore: "Show more",
  byBook: "Matches by book",
  noResults: (q: string) => `No verses match “${q}”`,
  didYouMean: "Did you mean",
  openBook: (name: string) => `Open ${name}`,
  goTo: (ref: string) => `Go to ${ref}`,
  ntOnly: "This translation has only the New Testament.",
  failed: "Search failed. Please try again.",
  paletteSearch: (q: string) => `Search the Bible for “${q}”`,
};

const am: typeof en = {
  title: "መጽሐፍ ቅዱስን ይፈልጉ",
  placeholder: "ቃላት፣ «ሐረግ» ወይም እንዳይካተት -ቃል",
  label: "የሚፈለጉ ቃላት",
  clear: "ፍለጋውን ያጽዱ",
  translation: "ትርጉም",
  scope: "የሚፈለግበት",
  wholeBible: "መላው መጽሐፍ ቅዱስ",
  oldTestament: "ብሉይ ኪዳን",
  newTestament: "አዲስ ኪዳን",
  chooseBook: "አንድ መጽሐፍ…",
  wholeWords: "ሙሉ ቃል ብቻ",
  tips: "እያንዳንዱ ቃል በጥቅሱ ውስጥ መገኘት አለበት። ሐረግን በትምህርተ ጥቅስ ውስጥ ይጻፉ፤ አንድ ቃል እንዳይካተት ከፊቱ የመቀነስ ምልክት (-) ያድርጉ።",
  results: "ውጤቶች",
  searching: "በመፈለግ ላይ…",
  count: (n: number) => `${n.toLocaleString("en")} ጥቅሶች`,
  showing: (shown: number, total: number) => `ከ${total.toLocaleString("en")} ጥቅሶች የመጀመሪያዎቹ ${shown}`,
  elapsed: (ms: number) => `${ms} ሚሊሰከንድ`,
  showMore: "ተጨማሪ ይመልከቱ",
  byBook: "ውጤቶች በየመጽሐፉ",
  noResults: (q: string) => `«${q}» የሚል ጥቅስ አልተገኘም`,
  didYouMean: "ይህን ማለትዎ ነው?",
  openBook: (name: string) => `${name} ይክፈቱ`,
  goTo: (ref: string) => `ወደ ${ref} ይሂዱ`,
  ntOnly: "ይህ ትርጉም አዲስ ኪዳንን ብቻ ይዟል።",
  failed: "ፍለጋው አልተሳካም። እባክዎ እንደገና ይሞክሩ።",
  paletteSearch: (q: string) => `መጽሐፍ ቅዱስን «${q}» በሚል ቃል ይፈልጉ`,
};

export const searchMessages = { en, am };
