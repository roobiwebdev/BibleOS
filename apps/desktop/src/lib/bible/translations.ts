import type { Locale, Testament } from "@starter/bible-core/books";
import { TRANSLATIONS, type TranslationSource } from "@starter/bible-data/manifest";
import { DEFAULT_TRANSLATIONS } from "@starter/local-api/schemas";

const LANGUAGE_ORDER: readonly Locale[] = ["am", "en"];

const rank = (t: TranslationSource) =>
  LANGUAGE_ORDER.indexOf(t.language) * 2 + (DEFAULT_TRANSLATIONS[t.language] === t.id ? 0 : 1);

/**
 * SOURCE OF TRUTH KEYWORDS: ORDERED_TRANSLATIONS, translation order, featured first, Amharic first, 2005 first
 * WHAT:  Every bundled translation in the order the app lists them: Amharic, then English, with
 *        each language's featured text (DEFAULT_TRANSLATIONS) first and the rest in manifest order.
 * WHY:   Pickers, the Licences list and fallbacks should all lead with the text most readers
 *        want, without depending on where the data pipeline happens to list it.
 * WHERE: TranslationMenu, TranslationSelect, Settings → Translations and licences, pickTranslation.
 */
export const ORDERED_TRANSLATIONS: readonly TranslationSource[] = TRANSLATIONS.toSorted((a, b) => rank(a) - rank(b));

export const findTranslation = (id: string | undefined): TranslationSource | undefined =>
  TRANSLATIONS.find((t) => t.id === id);

/** A translation has text for a testament unless it is New Testament only. */
export const covers = (t: TranslationSource, testament: Testament | undefined): boolean =>
  testament === undefined ? t.scope === "bible" : t.scope === "bible" || testament === "NT";

/**
 * SOURCE OF TRUTH KEYWORDS: pickTranslation, translation for a language, preferred translation, fallback translation
 * WHAT:  The translation to show in one language: the first of `prefer` (the reader's own choices)
 *        in that language that has the testament, else the featured one, else any that has it.
 *        Without a testament, the reader's choices count whatever their scope, and only
 *        whole-Bible texts are offered after them.
 * WHY:   The verse of the day, search's "search in Amharic" offer and the reader's fallback for a
 *        New Testament only text all answer the same question the same way.
 * WHERE: Today (verse of the day), search page, loadChapterWithFallback.
 */
export function pickTranslation(
  language: Locale,
  options: { testament?: Testament; prefer?: readonly string[]; exclude?: string } = {},
): TranslationSource | undefined {
  const usable = (t: TranslationSource | undefined): t is TranslationSource =>
    t !== undefined && t.language === language && t.id !== options.exclude;
  const own = (options.prefer ?? [])
    .map(findTranslation)
    .find((t) => usable(t) && (options.testament === undefined || covers(t, options.testament)));
  return own ?? ORDERED_TRANSLATIONS.find((t) => usable(t) && covers(t, options.testament));
}
