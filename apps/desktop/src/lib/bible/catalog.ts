import type { TranslationSource } from "@starter/bible-data/manifest";
import { ONLINE_TRANSLATIONS, type OnlineTranslation } from "@starter/bible-data/online";

import { ORDERED_TRANSLATIONS } from "./translations";

/**
 * SOURCE OF TRUTH KEYWORDS: ReaderTranslation, READER_TRANSLATIONS, findReaderTranslation, delivery, bundled or online, translation catalogue
 * WHAT:  Every translation the app can show: the bundled ones in display order (delivery
 *        "bundled", ORDERED_TRANSLATIONS, the 2005 first) followed by the online ones (delivery
 *        "online", ESV and NLT).
 * WHY:   Screens need one list to pick from and one lookup for a translation's name, language
 *        and notice, but online texts are not part of the bundle build, so they are not faked
 *        into TRANSLATIONS. `delivery` tells a screen when to show the online marker, the
 *        publisher's notice and link, and the "needs internet" state.
 * WHERE: TranslationMenu, TranslationSelect, reader, Today, study, search, history, Settings licences.
 */
export type BundledTranslation = TranslationSource & { delivery: "bundled" };
export type ReaderTranslation = BundledTranslation | OnlineTranslation;

export const READER_TRANSLATIONS: readonly ReaderTranslation[] = [
  ...ORDERED_TRANSLATIONS.map((t): BundledTranslation => ({ ...t, delivery: "bundled" })),
  ...ONLINE_TRANSLATIONS,
];

export const findReaderTranslation = (id: string | undefined): ReaderTranslation | undefined =>
  READER_TRANSLATIONS.find((t) => t.id === id);

export const isOnline = (t: ReaderTranslation | undefined): t is OnlineTranslation => t?.delivery === "online";
