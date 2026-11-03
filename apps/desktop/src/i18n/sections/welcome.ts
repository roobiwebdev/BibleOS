/**
 * SOURCE OF TRUTH KEYWORDS: welcomeMessages, Welcome strings, welcome copy, first run, data export copy, backup copy
 * WHAT:  English and Amharic interface text for the first-run Welcome and for Settings → Your
 *        data (backups, import, Markdown export) under `data`.
 * WHY:   Each feature owns its section so features can be built in parallel; messages.ts
 *        composes them, and the `am` object must match the `en` shape.
 * WHERE: messages.ts (as `t.welcome`); Welcome sheet, settings page.
 */
const en = {
  title: "Welcome to BibleOS",
  intro: "A quiet place to read and study. Set up a few things now; you can change them any time in Settings.",
  step: (n: number, total: number) => `Step ${n} of ${total}`,
  steps: {
    language: { title: "Language and calendar", body: "Choose the language for menus and the calendar for dates." },
    theme: {
      title: "Choose a page",
      body: "Pick the colours that are easiest on your eyes. You'll see it straight away.",
    },
    translations: { title: "Translations", body: "Read one translation, or two side by side, verse by verse." },
    goal: {
      title: "A daily rhythm",
      body: "How long would you like to read each day? A missed day is fine; the rhythm allows for rest.",
    },
  },
  language: "Language",
  calendar: "Calendar",
  translation: "Translation",
  beside: "Beside it",
  sideBySide: "Read side by side",
  minutes: (n: number) => `${n} min`,
  sample: "In the beginning was the Word…",
  skip: "Skip",
  back: "Back",
  next: "Next",
  done: "Start reading",
  data: {
    autoHint: "A copy of your study data each day. The last 14 are kept.",
    lastBackup: (when: string) => `Last backup: ${when}`,
    noBackup: "No backup yet.",
    previewOnly: "Backups are made in the app, not in this preview.",
    exportJson: "Export backup (JSON)",
    exportJsonHint: "Notes, highlights, collections and reading history in one file.",
    importJson: "Import backup",
    importHint: "Merges a backup into this Mac. Where both changed, the newer edit is kept.",
    exportMarkdown: "Export notes as Markdown",
    exportMarkdownHint: "Your notes as a file any text editor can open.",
    exportButton: "Export…",
    importButton: "Import…",
    saved: "Saved.",
    noNotes: "There are no notes to export yet.",
    exportFailed: "Couldn't save the file.",
    imported: (n: number) => (n === 1 ? "Imported 1 change." : `Imported ${n} changes.`),
    importNothing: "Nothing new in that backup.",
    importFailed: "That file couldn't be imported.",
    tables: { notes: "notes", highlights: "highlights", collections: "collections", reading: "reading days" },
    markdown: { title: "BibleOS notes", passages: "Passages", tags: "Tags", updated: "Updated" },
  },
};

const am: typeof en = {
  title: "እንኳን ወደ BibleOS በደህና መጡ",
  intro: "ለማንበብና ለማጥናት ጸጥ ያለ ቦታ። ጥቂት ነገሮችን አሁን ያዘጋጁ፤ በኋላ በቅንብሮች ውስጥ በማንኛውም ጊዜ መቀየር ይችላሉ።",
  step: (n: number, total: number) => `ደረጃ ${n} ከ${total}`,
  steps: {
    language: { title: "ቋንቋና የቀን አቆጣጠር", body: "ለምናሌዎች ቋንቋ፣ ለቀናት ደግሞ የቀን አቆጣጠር ይምረጡ።" },
    theme: { title: "ገጽ ይምረጡ", body: "ለዓይንዎ የሚመቹ ቀለሞችን ይምረጡ። ወዲያውኑ ያዩታል።" },
    translations: { title: "ትርጉሞች", body: "አንድ ትርጉም ያንብቡ፣ ወይም ሁለቱን ጎን ለጎን ቁጥር በቁጥር።" },
    goal: {
      title: "የዕለት ምት",
      body: "በየቀኑ ለምን ያህል ጊዜ ማንበብ ይፈልጋሉ? አንድ ቀን ቢያልፍ ችግር የለውም፤ ምቱ ለዕረፍት ቦታ አለው።",
    },
  },
  language: "ቋንቋ",
  calendar: "የቀን አቆጣጠር",
  translation: "ትርጉም",
  beside: "ከጎኑ",
  sideBySide: "ጎን ለጎን ያንብቡ",
  minutes: (n: number) => `${n} ደቂቃ`,
  sample: "በመጀመሪያ ቃል ነበረ…",
  skip: "ዝለል",
  back: "ተመለስ",
  next: "ቀጥል",
  done: "ማንበብ ጀምር",
  data: {
    autoHint: "በየቀኑ የጥናት መረጃዎ ቅጂ ይቀመጣል። የመጨረሻዎቹ 14 ይጠበቃሉ።",
    lastBackup: (when: string) => `የመጨረሻ ምትኬ፦ ${when}`,
    noBackup: "እስካሁን ምትኬ የለም።",
    previewOnly: "ምትኬዎች የሚሠሩት በመተግበሪያው ውስጥ ነው፤ በዚህ ቅድመ እይታ አይደለም።",
    exportJson: "ምትኬ ወደ ውጭ ላክ (JSON)",
    exportJsonHint: "ማስታወሻዎች፣ ማድመቂያዎች፣ ስብስቦችና የንባብ ታሪክ በአንድ ፋይል።",
    importJson: "ምትኬ አስገባ",
    importHint: "ምትኬን ከዚህ ማክ ጋር ያዋህዳል። ሁለቱም ከተቀየሩ አዲሱ ለውጥ ይቀመጣል።",
    exportMarkdown: "ማስታወሻዎችን እንደ Markdown ላክ",
    exportMarkdownHint: "ማስታወሻዎችዎ በማንኛውም የጽሑፍ አርታዒ በሚከፈት ፋይል።",
    exportButton: "ላክ…",
    importButton: "አስገባ…",
    saved: "ተቀምጧል።",
    noNotes: "ለመላክ ገና ማስታወሻ የለም።",
    exportFailed: "ፋይሉን ማስቀመጥ አልተቻለም።",
    imported: (n: number) => `${n} ለውጦች ገብተዋል።`,
    importNothing: "በዚያ ምትኬ ውስጥ አዲስ ነገር የለም።",
    importFailed: "ያንን ፋይል ማስገባት አልተቻለም።",
    tables: { notes: "ማስታወሻዎች", highlights: "ማድመቂያዎች", collections: "ስብስቦች", reading: "የንባብ ቀናት" },
    markdown: { title: "የBibleOS ማስታወሻዎች", passages: "ክፍሎች", tags: "መለያዎች", updated: "የተሻሻለው" },
  },
};

export const welcomeMessages = { en, am };
