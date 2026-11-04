/**
 * SOURCE OF TRUTH KEYWORDS: demo scripture, JOHN_3, SEARCH_RESULTS, VERSE_OF_DAY, BSB, ULB
 * WHAT:  The few verses the hero demo shows, copied unchanged from the app's bundled texts:
 *        Berean Standard Bible (public domain) and the Amharic Unlocked Literal Bible
 *        (Door43, CC BY-SA 4.0, credited in the footer).
 * WHY:   The demo should show real scripture as BibleOS displays it, without loading a whole
 *        translation into a landing page.
 * WHERE: demo/scene.tsx, sections/amharic.tsx.
 */
export interface ParallelVerse {
  n: number;
  en: string;
  am: string;
}

export const JOHN_3: readonly ParallelVerse[] = [
  {
    n: 14,
    en: "Just as Moses lifted up the snake in the wilderness, so the Son of Man must be lifted up,",
    am: "ሙሴ እባብን በምድረ በዳ እንደ ሰቀለ፣ እንዲሁ የሰው ልጅ ሊሰቀል ይገባዋል።",
  },
  {
    n: 15,
    en: "that everyone who believes in Him may have eternal life.",
    am: "ይህም በእርሱ የሚያምን ሁሉ የዘላለም ሕይወት እንዲኖረው ነው።",
  },
  {
    n: 16,
    en: "For God so loved the world that He gave His one and only Son, that everyone who believes in Him shall not perish but have eternal life.",
    am: "በእርሱ የሚያምን ሁሉ የዘላለም ሕይወት እንዲኖረው እንጂ እንዳይጠፋ እግዚአብሔር አንድያ ልጁን እስከ መስጠት ድረስ ዓለሙን እንዲሁ ወዶአልና፤",
  },
  {
    n: 17,
    en: "For God did not send His Son into the world to condemn the world, but to save the world through Him.",
    am: "እግዚአብሔር ልጁን ወደ ዓለም የላከው በዓለም ላይ ለመፍረድ ሳይሆን፣ ዓለምን በእርሱ ለማዳን ነው።",
  },
  {
    n: 18,
    en: "Whoever believes in Him is not condemned, but whoever does not believe has already been condemned, because he has not believed in the name of God’s one and only Son.",
    am: "በእርሱ የሚያምን ሁሉ አይፈረድበትም፤ በእርሱ የማያምን ግን በእግዚአብሔር ልጅ ስም ስላላመነ፣ አሁኑኑ ተፈርዶበታል።",
  },
];

export const VERSE_OF_DAY = {
  ref: "Psalm 23:1",
  en: "The LORD is my shepherd; I shall not want.",
  am: "ያህዌ እረኛዬ ነው፤ ምንም አላጣም፡፡",
} as const;

export const SEARCH_QUERY = "ፍቅር";

/** Amharic ULB verses containing the query; the reference is shown in the interface language. */
export const SEARCH_RESULTS: readonly { book: string; ref: string; text: string }[] = [
  { book: "John", ref: "John 15:13", text: "ስለ ወዳጁ ሲል ሕይወቱን አሳልፎ እንዲሰጥ ግድ ከሚል የሚበልጥ ፍቅር ማንም ሰው የለውም።" },
  {
    book: "Romans",
    ref: "Romans 5:8",
    text: "ነገር ግን ገና ኃጢአተኞች እያለን ክርስቶስ ስለ እኛ መሞቱ እግዚአብሔር ለእኛ ያለውን የራሱን ፍቅር ያረጋግጣል።",
  },
  {
    book: "Romans",
    ref: "Romans 8:35",
    text: "ከክርስቶስ ፍቅር ማን ይለየናል? መከራ ወይስ ጭንቀት ወይስ ስደት ወይስ ራብ ወይስ ራቁትነት ወይስ አደጋ ወይስ ሰይፍ ይለየናልን?",
  },
  { book: "1 Corinthians", ref: "1 Corinthians 13:4", text: "ፍቅር ታጋሽና ደግ ነው። ፍቅር አይመቀኝም ደግሞም አይመካም። አይታበይም" },
  {
    book: "1 Corinthians",
    ref: "1 Corinthians 13:13",
    text: "ነገር ግን እምነት፣ ተስፋ፣ፍቅር እነዚህ ሦስቱ ግን ጸንተው ይኖራሉ። ከእነዚህ የሚበልጠው ፍቅር ነው።",
  },
  { book: "1 John", ref: "1 John 4:8", text: "ፍቅር የሌለው እግዚአብሔርን አያውቅም፣እግዚአብሔር ፍቅር ነውና፡፡" },
];

/** Verses containing the query in the Amharic ULB, as the search screen reports it. */
export const SEARCH_TOTAL = 164;
