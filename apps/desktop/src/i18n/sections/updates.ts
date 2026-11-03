/**
 * SOURCE OF TRUTH KEYWORDS: updatesMessages, Updates strings, update copy, new version, install and restart
 * WHAT:  English and Amharic interface text for app updates (the launch notice and the Updates
 *        group in Settings).
 * WHY:   Each feature owns its section; messages.ts composes them, and the `am` object must
 *        match the `en` shape.
 * WHERE: messages.ts (as `t.updates`).
 */
const en = {
  title: "Updates",
  version: (v: string) => `BibleOS ${v}`,
  checkOnOpen: "Check for updates when BibleOS opens",
  checkOnOpenHint: "Nothing is installed until you choose to. Updates are signed and checked before they install.",
  checkNow: "Check now",
  checking: "Checking…",
  current: "You have the latest version.",
  available: (v: string) => `BibleOS ${v} is available.`,
  install: "Install and restart",
  later: "Later",
  downloading: (percent: number | undefined) => (percent === undefined ? "Downloading…" : `Downloading… ${percent}%`),
  restarting: "Restarting…",
  failed: "Couldn't check for updates. Check your internet connection and try again.",
  previewOnly: "Updates are available in the installed app.",
  whatsNew: "What's new",
};

const am: typeof en = {
  title: "ዝማኔዎች",
  version: (v: string) => `BibleOS ${v}`,
  checkOnOpen: "BibleOS ሲከፈት ዝማኔ ፈልግ",
  checkOnOpenHint: "እርስዎ እስኪመርጡ ድረስ ምንም አይጫንም። ዝማኔዎች ተፈርመው ከመጫናቸው በፊት ይረጋገጣሉ።",
  checkNow: "አሁን ፈልግ",
  checking: "በመፈለግ ላይ…",
  current: "የቅርብ ጊዜውን ስሪት እየተጠቀሙ ነው።",
  available: (v: string) => `BibleOS ${v} ተለቋል።`,
  install: "ጫን እና እንደገና ክፈት",
  later: "በኋላ",
  downloading: (percent: number | undefined) => (percent === undefined ? "በማውረድ ላይ…" : `በማውረድ ላይ… ${percent}%`),
  restarting: "እንደገና በመክፈት ላይ…",
  failed: "ዝማኔ መፈለግ አልተቻለም። የኢንተርኔት ግንኙነትዎን አረጋግጠው እንደገና ይሞክሩ።",
  previewOnly: "ዝማኔዎች በተጫነው መተግበሪያ ውስጥ ይገኛሉ።",
  whatsNew: "አዲስ ነገሮች",
};

export const updatesMessages = { en, am };
