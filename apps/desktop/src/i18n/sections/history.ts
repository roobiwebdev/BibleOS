/**
 * SOURCE OF TRUTH KEYWORDS: historyMessages, History strings, history copy, bookmarks copy, Bookmarks tab
 * WHAT:  English and Amharic interface text for the History screen and for bookmarks (the
 *        reader's bookmark button and the Study → Bookmarks tab).
 * WHY:   Each feature owns its section so features can be built in parallel; messages.ts
 *        composes them, and the `am` object must match the `en` shape.
 * WHERE: messages.ts (as `t.history`).
 */
const en = {
  title: "History",
  subtitle: "Where your reading has taken you",
  resumeTitle: "Continue where you left off",
  resumeAction: "Continue reading",
  lastRead: (when: string) => `Last read ${when}`,
  today: "Today",
  yesterday: "Yesterday",
  minutes: (n: number) => (n < 1 ? "Under a minute" : n === 1 ? "1 min" : `${n} min`),
  chapters: (n: number) => (n === 1 ? "1 chapter" : `${n} chapters`),
  timeline: "Reading days",
  recent: "Recently read chapters",
  readTimes: (n: number) => (n === 1 ? "Read once" : `Read ${n} times`),
  loadMore: "Show earlier days",
  loadMoreChapters: "Show more chapters",
  loading: "Loading…",
  loadFailed: "Your history couldn't be loaded. Try again in a moment.",
  emptyTitle: "Your reading history will gather here",
  emptyBody:
    "Open any chapter in the reader. Each day you read, the chapters you spent time with appear here, so finding your way back is one click.",
  startReading: "Open the reader",
  openInReader: "Open in reader",
  bookmarks: {
    tab: "Bookmarks",
    add: "Bookmark this passage",
    remove: "Remove bookmark",
    added: (passage: string) => `Bookmarked ${passage}`,
    removed: "Bookmark removed",
    empty: "Bookmark a chapter or a verse from the reader to keep your place.",
    rename: "Rename",
    nameLabel: "Bookmark name",
    namePlaceholder: "Add a name",
    save: "Save",
    savedOn: (when: string) => `Saved ${when}`,
  },
};

const am: typeof en = {
  title: "ታሪክ",
  subtitle: "የንባብ ጉዞዎ",
  resumeTitle: "ካቆሙበት ይቀጥሉ",
  resumeAction: "ንባብዎን ይቀጥሉ",
  lastRead: (when: string) => `ለመጨረሻ ጊዜ ያነበቡት፦ ${when}`,
  today: "ዛሬ",
  yesterday: "ትናንት",
  minutes: (n: number) => (n < 1 ? "ከአንድ ደቂቃ በታች" : `${n} ደቂቃ`),
  chapters: (n: number) => (n === 1 ? "1 ምዕራፍ" : `${n} ምዕራፎች`),
  timeline: "ያነበቡባቸው ቀናት",
  recent: "በቅርቡ ያነበቧቸው ምዕራፎች",
  readTimes: (n: number) => (n === 1 ? "አንድ ጊዜ ተነቧል" : `${n} ጊዜ ተነቧል`),
  loadMore: "ቀደም ያሉትን ቀናት አሳይ",
  loadMoreChapters: "ተጨማሪ ምዕራፎችን አሳይ",
  loading: "በመጫን ላይ…",
  loadFailed: "ታሪክዎን መጫን አልተቻለም። እባክዎ ትንሽ ቆይተው እንደገና ይሞክሩ።",
  emptyTitle: "የንባብ ታሪክዎ እዚህ ይሰበሰባል",
  emptyBody: "በአንባቢው ውስጥ ማንኛውንም ምዕራፍ ይክፈቱ። ባነበቡበት ቀን ሁሉ ያነበቧቸው ምዕራፎች እዚህ ይታያሉ፤ ወደ ነበሩበት ለመመለስም አንድ ጠቅታ ብቻ ይበቃል።",
  startReading: "አንባቢውን ይክፈቱ",
  openInReader: "በአንባቢው ይክፈቱ",
  bookmarks: {
    tab: "ዕልባቶች",
    add: "ይህን ክፍል ዕልባት ያድርጉ",
    remove: "ዕልባቱን ያስወግዱ",
    added: (passage: string) => `${passage} ዕልባት ተደርጓል`,
    removed: "ዕልባቱ ተወግዷል",
    empty: "ቦታዎን ለመያዝ በአንባቢው ውስጥ ምዕራፍ ወይም ቁጥር ዕልባት ያድርጉ።",
    rename: "ስም ይቀይሩ",
    nameLabel: "የዕልባቱ ስም",
    namePlaceholder: "ስም ያክሉ",
    save: "አስቀምጥ",
    savedOn: (when: string) => `የተቀመጠው፦ ${when}`,
  },
};

export const historyMessages = { en, am };
