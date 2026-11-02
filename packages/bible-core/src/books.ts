/**
 * SOURCE OF TRUTH KEYWORDS: BOOKS, BookCode, BookInfo, bookByCode, book catalogue, canon, testament, Amharic book names
 * WHAT:  The canonical book list: USFM code, canonical order, testament, chapter count, and
 *        English + Amharic names and abbreviations.
 * WHY:   Every feature that names or orders a book (reader, picker, ⌘K parser, headings,
 *        export, verse ids) must agree. Order numbers feed VerseId, so they never change;
 *        books outside the 66 (deuterocanon, Ethiopian canon) get new numbers from 67 up.
 *        Amharic names follow the 1962 Bible Society of Ethiopia NT and cleaned Door43 OT
 *        headings; each translation still shows its own headings from its data file.
 * WHERE: reference parser, verse-id, bible-data build, desktop reader and navigation.
 */

export type Testament = "OT" | "NT";

export interface BookInfo {
  /** USFM 3 book code, e.g. "GEN", "1JN". */
  code: string;
  /** Canonical order. Part of every VerseId, so it must never be renumbered. */
  ord: number;
  testament: Testament;
  chapters: number;
  en: { name: string; short: string; aliases: readonly string[] };
  am: { name: string; short: string; aliases: readonly string[] };
}

type Row = [
  code: string,
  chapters: number,
  enName: string,
  enAliases: string,
  amName: string,
  amShort: string,
  amAliases: string,
];

// Aliases are space-separated; multi-word aliases use "_" for the space.
const ROWS: readonly Row[] = [
  ["GEN", 50, "Genesis", "gen ge gn", "ኦሪት ዘፍጥረት", "ዘፍጥረት", "ዘፍ"],
  ["EXO", 40, "Exodus", "exod exo ex", "ኦሪት ዘጸአት", "ዘጸአት", "ዘጸ"],
  ["LEV", 27, "Leviticus", "lev le lv", "ኦሪት ዘሌዋውያን", "ዘሌዋውያን", "ዘሌ"],
  ["NUM", 36, "Numbers", "num nu nm nb", "ኦሪት ዘኍልቍ", "ዘኍልቍ", "ዘኍ ዘኁ ዘኁልቁ"],
  ["DEU", 34, "Deuteronomy", "deut deu dt", "ኦሪት ዘዳግም", "ዘዳግም", "ዘዳ"],
  ["JOS", 24, "Joshua", "josh jos jsh", "መጽሐፈ ኢያሱ", "ኢያሱ", "ኢያ"],
  ["JDG", 21, "Judges", "judg jdg jg jdgs", "መጽሐፈ መሳፍንት", "መሳፍንት", "መሳ"],
  ["RUT", 4, "Ruth", "rth ru", "መጽሐፈ ሩት", "ሩት", ""],
  ["1SA", 31, "1 Samuel", "1sam 1sa 1sm", "1ኛ ሳሙኤል", "1ኛ ሳሙኤል", "1ሳሙ"],
  ["2SA", 24, "2 Samuel", "2sam 2sa 2sm", "2ኛ ሳሙኤል", "2ኛ ሳሙኤል", "2ሳሙ"],
  ["1KI", 22, "1 Kings", "1kgs 1ki 1kg", "1ኛ ነገሥት", "1ኛ ነገሥት", "1ነገ"],
  ["2KI", 25, "2 Kings", "2kgs 2ki 2kg", "2ኛ ነገሥት", "2ኛ ነገሥት", "2ነገ"],
  ["1CH", 29, "1 Chronicles", "1chr 1ch 1chron", "1ኛ ዜና መዋዕል", "1ኛ ዜና", "1ዜና"],
  ["2CH", 36, "2 Chronicles", "2chr 2ch 2chron", "2ኛ ዜና መዋዕል", "2ኛ ዜና", "2ዜና"],
  ["EZR", 10, "Ezra", "ezr", "መጽሐፈ ዕዝራ", "ዕዝራ", "ዕዝ"],
  ["NEH", 13, "Nehemiah", "neh ne", "መጽሐፈ ነህምያ", "ነህምያ", "ነህ"],
  ["EST", 10, "Esther", "esth est es", "መጽሐፈ አስቴር", "አስቴር", "አስ"],
  ["JOB", 42, "Job", "jb", "መጽሐፈ ኢዮብ", "ኢዮብ", "ኢዮ"],
  ["PSA", 150, "Psalms", "ps psa psalm pss", "መዝሙረ ዳዊት", "መዝሙር", "መዝ መጽሐፈ_መዝሙር"],
  ["PRO", 31, "Proverbs", "prov pro prv pr", "መጽሐፈ ምሳሌ", "ምሳሌ", "ምሳ"],
  ["ECC", 12, "Ecclesiastes", "eccl ecc qoh", "መጽሐፈ መክብብ", "መክብብ", "መክ"],
  ["SNG", 8, "Song of Songs", "song sng sos song_of_solomon canticles", "መኃልየ መኃልይ", "መኃልይ", "መኃ"],
  ["ISA", 66, "Isaiah", "isa is", "ትንቢተ ኢሳይያስ", "ኢሳይያስ", "ኢሳ"],
  ["JER", 52, "Jeremiah", "jer je jr", "ትንቢተ ኤርምያስ", "ኤርምያስ", "ኤር ኤርሚያስ"],
  ["LAM", 5, "Lamentations", "lam la", "ሰቆቃወ ኤርምያስ", "ሰቆቃወ", "ሰቆ"],
  ["EZK", 48, "Ezekiel", "ezek ezk eze", "ትንቢተ ሕዝቅኤል", "ሕዝቅኤል", "ሕዝ"],
  ["DAN", 12, "Daniel", "dan da dn", "ትንቢተ ዳንኤል", "ዳንኤል", "ዳን"],
  ["HOS", 14, "Hosea", "hos ho", "ትንቢተ ሆሴዕ", "ሆሴዕ", "ሆሴ"],
  ["JOL", 3, "Joel", "jl jol", "ትንቢተ ኢዩኤል", "ኢዩኤል", "ኢዩ"],
  ["AMO", 9, "Amos", "am amo", "ትንቢተ አሞጽ", "አሞጽ", "አሞ"],
  ["OBA", 1, "Obadiah", "obad oba ob", "ትንቢተ አብድዩ", "አብድዩ", "አብ"],
  ["JON", 4, "Jonah", "jon jnh", "ትንቢተ ዮናስ", "ዮናስ", "ዮና"],
  ["MIC", 7, "Micah", "mic mc", "ትንቢተ ሚክያስ", "ሚክያስ", "ሚክ"],
  ["NAM", 3, "Nahum", "nah nam na", "ትንቢተ ናሆም", "ናሆም", "ናሆ"],
  ["HAB", 3, "Habakkuk", "hab hb", "ትንቢተ ዕንባቆም", "ዕንባቆም", "ዕን"],
  ["ZEP", 3, "Zephaniah", "zeph zep zp", "ትንቢተ ሶፎንያስ", "ሶፎንያስ", "ሶፎ"],
  ["HAG", 2, "Haggai", "hag hg", "ትንቢተ ሐጌ", "ሐጌ", ""],
  ["ZEC", 14, "Zechariah", "zech zec zc", "ትንቢተ ዘካርያስ", "ዘካርያስ", "ዘካ"],
  ["MAL", 4, "Malachi", "mal ml", "ትንቢተ ሚልክያስ", "ሚልክያስ", "ሚል"],
  ["MAT", 28, "Matthew", "matt mat mt", "የማቴዎስ ወንጌል", "ማቴዎስ", "ማቴ"],
  ["MRK", 16, "Mark", "mrk mk mr", "የማርቆስ ወንጌል", "ማርቆስ", "ማር"],
  ["LUK", 24, "Luke", "luk lk", "የሉቃስ ወንጌል", "ሉቃስ", "ሉቃ"],
  ["JHN", 21, "John", "jn jhn joh", "የዮሐንስ ወንጌል", "ዮሐንስ", "ዮሐ"],
  ["ACT", 28, "Acts", "act ac", "የሐዋርያት ሥራ", "ሐዋርያት", "ሐዋ"],
  ["ROM", 16, "Romans", "rom ro rm", "ወደ ሮሜ ሰዎች", "ሮሜ", ""],
  ["1CO", 16, "1 Corinthians", "1cor 1co", "1ኛ ወደ ቆሮንቶስ ሰዎች", "1ኛ ቆሮንቶስ", "1ቆሮ"],
  ["2CO", 13, "2 Corinthians", "2cor 2co", "2ኛ ወደ ቆሮንቶስ ሰዎች", "2ኛ ቆሮንቶስ", "2ቆሮ"],
  ["GAL", 6, "Galatians", "gal ga", "ወደ ገላትያ ሰዎች", "ገላትያ", "ገላ"],
  ["EPH", 6, "Ephesians", "eph ephes", "ወደ ኤፌሶን ሰዎች", "ኤፌሶን", "ኤፌ"],
  ["PHP", 4, "Philippians", "phil php pp", "ወደ ፊልጵስዩስ ሰዎች", "ፊልጵስዩስ", "ፊል ፊልጵ"],
  ["COL", 4, "Colossians", "col", "ወደ ቆላስይስ ሰዎች", "ቆላስይስ", "ቆላ"],
  ["1TH", 5, "1 Thessalonians", "1thess 1th 1thes", "1ኛ ወደ ተሰሎንቄ ሰዎች", "1ኛ ተሰሎንቄ", "1ተሰ"],
  ["2TH", 3, "2 Thessalonians", "2thess 2th 2thes", "2ኛ ወደ ተሰሎንቄ ሰዎች", "2ኛ ተሰሎንቄ", "2ተሰ"],
  ["1TI", 6, "1 Timothy", "1tim 1ti 1tm", "1ኛ ወደ ጢሞቴዎስ", "1ኛ ጢሞቴዎስ", "1ጢሞ"],
  ["2TI", 4, "2 Timothy", "2tim 2ti 2tm", "2ኛ ወደ ጢሞቴዎስ", "2ኛ ጢሞቴዎስ", "2ጢሞ"],
  ["TIT", 3, "Titus", "tit ti", "ወደ ቲቶ", "ቲቶ", ""],
  ["PHM", 1, "Philemon", "phlm phm pm", "ወደ ፊልሞና", "ፊልሞና", "ፊልሞ"],
  ["HEB", 13, "Hebrews", "heb", "ወደ ዕብራውያን", "ዕብራውያን", "ዕብ"],
  ["JAS", 5, "James", "jas jm", "የያዕቆብ መልእክት", "ያዕቆብ", "ያዕ"],
  ["1PE", 5, "1 Peter", "1pet 1pe 1pt", "1ኛ የጴጥሮስ መልእክት", "1ኛ ጴጥሮስ", "1ጴጥ"],
  ["2PE", 3, "2 Peter", "2pet 2pe 2pt", "2ኛ የጴጥሮስ መልእክት", "2ኛ ጴጥሮስ", "2ጴጥ"],
  ["1JN", 5, "1 John", "1jn 1jhn 1joh", "1ኛ የዮሐንስ መልእክት", "1ኛ ዮሐንስ", "1ዮሐ"],
  ["2JN", 1, "2 John", "2jn 2jhn 2joh", "2ኛ የዮሐንስ መልእክት", "2ኛ ዮሐንስ", "2ዮሐ"],
  ["3JN", 1, "3 John", "3jn 3jhn 3joh", "3ኛ የዮሐንስ መልእክት", "3ኛ ዮሐንስ", "3ዮሐ"],
  ["JUD", 1, "Jude", "jud jd", "የይሁዳ መልእክት", "ይሁዳ", "ይሁ"],
  ["REV", 22, "Revelation", "rev re rv apocalypse", "የዮሐንስ ራእይ", "ራእይ", "ራእ"],
];

const OT_COUNT = 39;

function aliasList(raw: string): string[] {
  return raw
    .split(" ")
    .filter((a) => a.length > 0)
    .map((a) => a.replaceAll("_", " "));
}

export const BOOKS: readonly BookInfo[] = ROWS.map(
  ([code, chapters, enName, enAliases, amName, amShort, amAliases], index) => ({
    code,
    ord: index + 1,
    testament: index < OT_COUNT ? "OT" : "NT",
    chapters,
    en: { name: enName, short: enName, aliases: aliasList(enAliases) },
    am: { name: amName, short: amShort, aliases: aliasList(amAliases) },
  }),
);

const BY_CODE = new Map(BOOKS.map((b) => [b.code, b]));
const BY_ORD = new Map(BOOKS.map((b) => [b.ord, b]));

/**
 * SOURCE OF TRUTH KEYWORDS: bookByCode, bookByOrd, getBook, book lookup
 * WHAT:  Look up a book by USFM code or canonical order number.
 * WHY:   One lookup path so callers never index BOOKS by position.
 * WHERE: verse-id, reference parser, bible-data build, reader.
 */
export function bookByCode(code: string): BookInfo | undefined {
  return BY_CODE.get(code.toUpperCase());
}

export function bookByOrd(ord: number): BookInfo | undefined {
  return BY_ORD.get(ord);
}

export type Locale = "en" | "am";

export function bookName(book: BookInfo, locale: Locale, form: "name" | "short" = "short"): string {
  return book[locale][form];
}
