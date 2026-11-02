/**
 * SOURCE OF TRUTH KEYWORDS: TRANSLATIONS, TranslationSource, bundled translations, licence, copyright notice, pinned sha256, sources manifest
 * WHAT:  Every Bible text the app bundles: where it comes from, the exact archive (pinned by
 *        SHA-256), its licence, and the notice that must ship with it.
 * WHY:   Licensing is part of the data, not a footnote. Pinning hashes means a changed upstream
 *        file fails the build instead of silently changing scripture. Notices are verbatim
 *        because the 1962 Amharic text requires the full statement in every non-commercial use.
 * WHERE: build.ts (download + verify), translation meta table, desktop Licences page.
 */
export interface TranslationSource {
  id: string;
  language: "am" | "en";
  name: string;
  /** Short label for the translation switcher. */
  abbreviation: string;
  scope: "bible" | "nt";
  licence: { name: string; url: string; commercial: boolean; shareAlike: boolean };
  /** Shown verbatim on the Licences page and in exports. */
  notice: string;
  sourceUrl: string;
  archive: { url: string; sha256: string };
  /** "catalogue" replaces the edition's own book titles when they carry errors. */
  bookNames: "source" | "catalogue";
}

export const TRANSLATIONS: readonly TranslationSource[] = [
  {
    id: "am-ulb",
    language: "am",
    name: "አማርኛ ቀጥተኛ ትርጉም (Amharic Unlocked Literal Bible)",
    abbreviation: "ULB",
    scope: "bible",
    licence: {
      name: "CC BY-SA 4.0",
      url: "https://creativecommons.org/licenses/by-sa/4.0/",
      commercial: true,
      shareAlike: true,
    },
    notice:
      "Amharic Unlocked Literal Bible by the Door43 World Missions Community, licensed under CC BY-SA 4.0 " +
      "(https://creativecommons.org/licenses/by-sa/4.0/). Source: https://git.door43.org/Door43-Catalog/am_ulb. " +
      "Converted to the BibleOS reading format without changes to the text; the converted file is shared under the same licence.",
    sourceUrl: "https://git.door43.org/Door43-Catalog/am_ulb",
    // Its headings contain typos ("1ኛ ዬሐንስ") and mixed ordinal styles; use the reviewed catalogue names.
    bookNames: "catalogue",
    archive: {
      url: "https://git.door43.org/Door43-Catalog/am_ulb/archive/ed66a69a5a0ef5ae70a0962cfc1f351fd9b8a733.zip",
      sha256: "78046cc337c77ef50a9319c621a4875a19efaf7c728ee0ec8a57b62ac355db00",
    },
  },
  {
    id: "am-1962-nt",
    language: "am",
    name: "መጽሐፍ ቅዱስ 1962 (አዲስ ኪዳን)",
    abbreviation: "1962",
    scope: "nt",
    licence: {
      name: "Non-commercial use with full notice",
      url: "https://ebible.org/Scriptures/details.php?id=amh",
      commercial: false,
      shareAlike: false,
    },
    notice: [
      "The New Testament in the Amharic language of Ethiopia",
      "copyright © 1962, 2003 United Bible Societies",
      "Revised Amharic Bible in XML (2003).",
      "Printed version by United Bible Societies (C)1962.",
      "E-Text in transliterated ASCII format by Lapsley/Brooks Foundation 1994.",
      "Unicode UTF-8 transformation and XML-tagging by Dirk Röckmann 2003 (www.nt-text.net).",
      "With kind permission of the Bible Society of Ethiopia.",
      "Every non-commercial work using this data in any form must fully include this copyright statement!",
      "Every commercial use of parts or the complete data in any form needs written permission of the Bible Society of Ethiopia!",
    ].join("\n"),
    sourceUrl: "https://ebible.org/Scriptures/details.php?id=amh",
    bookNames: "source",
    archive: {
      url: "https://ebible.org/Scriptures/amh_usfm.zip",
      sha256: "a8963cbbbba209a57496559c737916765c93c929a91dba5bad0ecd2ada42f5f6",
    },
  },
  {
    id: "en-kjv",
    language: "en",
    name: "King James Version",
    abbreviation: "KJV",
    scope: "bible",
    licence: { name: "Public domain", url: "https://ebible.org/eng-kjv2006/", commercial: true, shareAlike: false },
    notice: "King James Version (1769 standardized text), public domain. Source: eBible.org.",
    sourceUrl: "https://ebible.org/eng-kjv2006/",
    bookNames: "source",
    archive: {
      url: "https://ebible.org/Scriptures/eng-kjv2006_usfm.zip",
      sha256: "ce1f526c64c2376f407308c2c23cb2d2fb58efaf5296327d2d8e408c3700650d",
    },
  },
  {
    id: "en-web",
    language: "en",
    name: "World English Bible",
    abbreviation: "WEB",
    scope: "bible",
    licence: { name: "Public domain", url: "https://ebible.org/engwebp/", commercial: true, shareAlike: false },
    notice:
      'The World English Bible is in the public domain. "World English Bible" is a trademark of eBible.org; ' +
      "the text is shown unchanged. Source: eBible.org.",
    sourceUrl: "https://ebible.org/engwebp/",
    bookNames: "source",
    archive: {
      url: "https://ebible.org/Scriptures/engwebp_usfm.zip",
      sha256: "a93df5571009fed56f77e3ac1d3ce71c9a3a3df1486f7570cc7a8f823192fdba",
    },
  },
  {
    id: "en-bsb",
    language: "en",
    name: "Berean Standard Bible",
    abbreviation: "BSB",
    scope: "bible",
    licence: { name: "Public domain", url: "https://ebible.org/engbsb/", commercial: true, shareAlike: false },
    notice: "The Holy Bible, Berean Standard Bible, public domain. Source: eBible.org.",
    sourceUrl: "https://ebible.org/engbsb/",
    bookNames: "source",
    archive: {
      url: "https://ebible.org/Scriptures/engbsb_usfm.zip",
      sha256: "75ca91d5a5c69ca4cbdeabdb03ea1a458db20cf3966abe15d86df086acf7fbc4",
    },
  },
];
