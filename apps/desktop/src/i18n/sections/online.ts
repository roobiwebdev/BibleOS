/**
 * SOURCE OF TRUTH KEYWORDS: onlineMessages, online translation strings, needs internet copy, ESV NLT copy
 * WHAT:  English and Amharic interface text for online translations (ESV, NLT): the menu
 *        marker, the attribution line, "needs internet" messages and online search notes.
 * WHY:   Each feature owns its section; messages.ts composes them, and `am` must match `en`.
 * WHERE: messages.ts (as `t.online`); TranslationMenu, OnlineAttribution, OnlineUnavailable,
 *        reader, Today, study, search, Settings licences.
 */
const en = {
  online: "Online",
  readOnline: (publisher: string) => `read online from ${publisher}`,
  needsInternet: (abbreviation: string) => `${abbreviation} needs the internet`,
  unavailable: (abbreviation: string) => `${abbreviation} cannot be shown right now`,
  offline: (abbreviation: string) => `${abbreviation} is read online. Connect to the internet, then try again.`,
  notConfigured: (abbreviation: string) => `${abbreviation} is not available yet. Choose another translation for now.`,
  rateLimited: "Too many requests for now. Please try again in a minute.",
  failed: (abbreviation: string) => `${abbreviation} could not be loaded right now.`,
  retry: "Try again",
  windowLimit: "The publisher allows only part of a book on screen at once. Use the chapter arrows to keep reading.",
  searchOnline: (abbreviation: string) => `Online search in the ${abbreviation}, through the publisher's API`,
  searchReceived: (received: number, total: number) =>
    `Searched the first ${received} of ${total.toLocaleString("en")} verses the publisher found`,
  licenceOnline: "Read online through the publisher's API. At most 500 verses are kept on this computer at a time.",
  visit: (site: string) => `Visit ${site}`,
  notInText: (abbreviation: string) =>
    `The ${abbreviation} has no text for this verse (some translations keep it only in a footnote).`,
};

const am: typeof en = {
  online: "በኢንተርኔት",
  readOnline: (publisher: string) => `ከ${publisher} በኢንተርኔት የሚነበብ`,
  needsInternet: (abbreviation: string) => `${abbreviation} ኢንተርኔት ያስፈልገዋል`,
  unavailable: (abbreviation: string) => `${abbreviation} አሁን ሊታይ አይችልም`,
  offline: (abbreviation: string) => `${abbreviation} የሚነበበው በኢንተርኔት ነው። ከኢንተርኔት ጋር ይገናኙና እንደገና ይሞክሩ።`,
  notConfigured: (abbreviation: string) => `${abbreviation} ገና አልተዘጋጀም። ለጊዜው ሌላ ትርጉም ይምረጡ።`,
  rateLimited: "ለጊዜው ብዙ ጥያቄዎች ቀርበዋል። እባክዎ ከአንድ ደቂቃ በኋላ እንደገና ይሞክሩ።",
  failed: (abbreviation: string) => `${abbreviation} አሁን ሊጫን አልቻለም።`,
  retry: "እንደገና ይሞክሩ",
  windowLimit: "አሳታሚው በአንድ ጊዜ የሚፈቅደው የመጽሐፉን ከፊል ብቻ ነው። ማንበብ ለመቀጠል የምዕራፍ ቀስቶቹን ይጠቀሙ።",
  searchOnline: (abbreviation: string) => `በ${abbreviation} ውስጥ በአሳታሚው በኩል በኢንተርኔት የሚደረግ ፍለጋ`,
  searchReceived: (received: number, total: number) =>
    `አሳታሚው ካገኛቸው ${total.toLocaleString("en")} ጥቅሶች የመጀመሪያዎቹ ${received} ብቻ ተፈልገዋል`,
  licenceOnline: "በአሳታሚው በኩል በኢንተርኔት የሚነበብ። በዚህ ኮምፒውተር ላይ በአንድ ጊዜ ከ500 ጥቅሶች በላይ አይቀመጥም።",
  visit: (site: string) => `${site}ን ይጎብኙ`,
  notInText: (abbreviation: string) => `${abbreviation} ለዚህ ጥቅስ ጽሑፍ የለውም (አንዳንድ ትርጉሞች በግርጌ ማስታወሻ ብቻ ያስቀምጡታል)።`,
};

export const onlineMessages = { en, am };
