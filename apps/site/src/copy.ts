import type { PlatformId } from "./config";

/**
 * SOURCE OF TRUTH KEYWORDS: copy, site text, headlines, FAQ, install steps, feature descriptions
 * WHAT:  Every sentence on the landing page, in one place.
 * WHY:   Components stay free of copy so wording can be reviewed (and later translated) in one
 *        file. Claims here must match the app: check apps/desktop before adding a feature.
 * WHERE: every section in src/sections.
 */
export const COPY = {
  nav: {
    features: "Features",
    amharic: "Amharic",
    privacy: "Privacy",
    download: "Download",
    install: "Install",
    faq: "FAQ",
    github: "GitHub",
    toNight: "Switch to Night theme",
    toSepia: "Switch to Sepia theme",
    skip: "Skip to content",
  },

  hero: {
    eyebrow: "Free for Mac, Windows and Linux",
    title: "Read the Bible in Amharic and English, side by side.",
    lead: "BibleOS is a quiet Bible study app that keeps everything on your computer. Read, highlight, write notes, follow a plan and search every verse, with no account and no internet connection needed.",
    downloadFor: (name: string) => `Download for ${name}`,
    downloadAny: "Download BibleOS",
    otherPlatforms: "Other platforms",
    version: (v: string) => `Version ${v}`,
    checking: "Checking for the latest version…",
    allOnGitHub: "Downloads are on GitHub",
    demoLabel:
      "Demo of BibleOS: the Today screen fills in this week's reading; the command palette jumps to John 3:16, shown in English and Amharic side by side; the verse is highlighted and a note is written beside it; a search for ፍቅር lists verses in Amharic; the theme changes from Sepia to Night to Paper.",
  },

  features: {
    eyebrow: "What's inside",
    title: "Everything for reading and study, nothing in the way.",
    rows: [
      {
        id: "reader",
        title: "A reader that stays out of the way",
        body: "Chapters run into each other as you scroll, so you can keep reading without page breaks. Turn on parallel reading to keep a second translation next to the first, verse by verse. Focus mode hides the sidebar so only the text is left.",
        image: "reader",
        alt: "The BibleOS reader showing John 3 in parallel: each verse in the Berean Standard Bible with the Amharic Unlocked Literal Bible beneath it, verse 16 highlighted, and a note about it in the side panel.",
      },
      {
        id: "study",
        title: "Highlights, notes and collections",
        body: "Mark verses in five colours that each mean something: promise, command, prayer, insight and question. Write notes with tags, link passages by typing [[John 3:16]], and see every note that mentions a verse. Keep favourite passages in collections and bookmarks.",
        image: "study",
        alt: "The Study screen listing notes with tags, and one note open with the passage it is about and its linked verses.",
      },
      {
        id: "search",
        title: "Search that understands Amharic",
        body: "Search the whole Bible, or narrow it to one testament or one book. Amharic letters that sound the same are matched together, so ሀ, ሐ and ኀ find the same word, while the text you read stays exactly as printed.",
        image: "search",
        alt: "Search results for the Amharic word ፍቅር (love): 164 verses, grouped by book, with every match marked.",
      },
      {
        id: "plans",
        title: "Reading plans that wait for you",
        body: "Seven plans come with the app, or you can make your own. Fall behind and the plan simply picks up where you left off.",
        image: "plans",
        alt: "The Gospel of John reading plan, showing days read and today's catch-up reading.",
      },
      {
        id: "habits",
        title: "A rhythm, not a streak to lose",
        body: "Set a daily goal in minutes. BibleOS keeps a week of dots, a year-long heatmap and how much of the Bible you have read. Grace days and rest days, such as the Sabbath, keep one missed day from undoing the week.",
        image: "progress",
        alt: "The Progress screen: current rhythm, days read this year, a reading heatmap and Bible coverage by book.",
      },
    ],
    plansHeading: "Plans included",
    days: (n: number) => `${n} days`,
    extras: [
      { title: "Command palette", body: "Press ⌘K (Ctrl+K) and type John 3:16 or ዮሐ 3፥16 to go straight there." },
      { title: "Today", body: "A verse of the day in both languages, today's plan reading, and where you stopped." },
      {
        title: "Reading history",
        body: "Every chapter you open is kept, so you can go back to what you read last week.",
      },
      {
        title: "Three themes",
        body: "Paper, Sepia and Night, with six accent colours. On a Mac the app icon changes too.",
      },
      {
        title: "Backups",
        body: "Export everything to one file and import it on another computer, or export your notes as Markdown. A daily backup is on by default.",
      },
      {
        title: "Comfortable text",
        body: "Adjust text size, line spacing and line width until it reads the way you like.",
      },
    ],
  },

  amharic: {
    eyebrow: "ዐማርኛ · Amharic",
    title: "Made for Amharic readers.",
    body: "Read an Amharic translation beside an English one, verse by verse. Switch the whole app to Amharic, and show dates in the Ethiopian calendar.",
    points: [
      "Two Amharic texts: the Amharic Unlocked Literal Bible and the 1962 New Testament",
      "The interface in Amharic or English, chosen separately from the Bible translation",
      "Ethiopian calendar dates on Today, in your history and on the progress heatmap",
      "Type references the Amharic way: ዮሐ 3፥16 works as well as John 3:16",
    ],
    today: "Today in the Ethiopian calendar",
    navSample: ["ዛሬ", "ንባብ", "ዕቅዶች", "ጥናት", "ታሪክ", "እድገት"],
    navSampleLabel: "The app's menu in Amharic",
  },

  privacy: {
    eyebrow: "Local first",
    title: "Your notes stay on your computer.",
    body: "There is no account to create and nothing to sign in to. Your highlights, notes, plans and reading history are saved in a file on your computer, and the Bibles come with the app, so it works offline.",
    points: [
      { title: "No account", body: "Open it and start reading. Nobody else holds a copy of your notes." },
      {
        title: "Works offline",
        body: "Every bundled translation is on your disk. Reading and search never need a connection.",
      },
      { title: "Yours to keep", body: "Export a backup at any time, and BibleOS keeps a daily one for you." },
    ],
  },

  download: {
    eyebrow: "Download",
    title: "Free, for the computer you have.",
    body: "BibleOS is free. Pick your system below; the install guide explains the one-time security prompt.",
    recommended: "Recommended",
    yourSystem: "Your system",
    allReleases: "All releases and release notes on GitHub",
    notYet: "The first release is on its way. The button opens the GitHub releases page, where it will appear.",
    alsoAs: "Also available as",
  },

  install: {
    eyebrow: "Install guide",
    title: "Installing BibleOS",
    why: {
      title: "Why does my computer warn me?",
      body: "BibleOS is a free, independent app. Apple and Microsoft charge for the certificates that make their warnings go away, so the installers aren't signed by them yet and your computer asks you to confirm once. The download comes straight from the project's GitHub releases, and updates installed from inside the app are checked against the project's signing key before they install.",
    },
    platforms: {
      mac: {
        requirement: "macOS 12 Monterey or later, on Apple Silicon or Intel.",
        steps: [
          "Open the downloaded .dmg file.",
          "Drag BibleOS into the Applications folder.",
          "Open BibleOS from Applications. macOS says it “could not verify” the app; click Done.",
          "Open System Settings → Privacy & Security, scroll down and click Open Anyway next to the BibleOS message, then confirm.",
          "From then on BibleOS opens normally, and new versions install from inside the app.",
        ],
        tip: "On macOS 14 and earlier you can instead right-click (or Control-click) BibleOS in Applications, choose Open, and confirm.",
      },
      windows: {
        requirement: "Windows 10 or 11, 64-bit.",
        steps: [
          "Run the downloaded BibleOS setup .exe.",
          "If Windows shows “Windows protected your PC”, click More info, then Run anyway.",
          "Follow the installer. If your PC doesn't have Microsoft Edge WebView2, the installer downloads it.",
          "Open BibleOS from the Start menu.",
        ],
        tip: "Prefer an .msi? It installs the same app and suits managed or shared computers.",
      },
      linux: {
        requirement: "64-bit Linux (x86_64). Pick the format that fits your distribution.",
        steps: [
          "AppImage, for any distribution: make it executable, then run it.",
          "Debian or Ubuntu: install the .deb with apt.",
          "Fedora, RHEL or openSUSE: install the .rpm with dnf (or zypper).",
        ],
        commands: [
          "chmod +x BibleOS_*_amd64.AppImage\n./BibleOS_*_amd64.AppImage",
          "sudo apt install ./BibleOS_*_amd64.deb",
          "sudo dnf install ./BibleOS-*.x86_64.rpm",
        ],
        tip: "Run the commands from the folder you downloaded to. The * fills in the version number.",
      },
    } satisfies Record<PlatformId, { requirement: string; steps: string[]; tip: string; commands?: string[] }>,
  },

  faq: {
    eyebrow: "Questions",
    title: "Frequently asked",
    items: [
      {
        q: "Is BibleOS really free?",
        a: "Yes. There is no price, no subscription and no account.",
      },
      {
        q: "Which Bibles are included?",
        a: "Two Amharic texts (the Amharic Unlocked Literal Bible and the 1962 New Testament) and three English ones (King James Version, World English Bible and Berean Standard Bible). They are bundled with the app, so no download is needed after installing. Their licences are listed at the bottom of this page.",
      },
      {
        q: "Does it need the internet?",
        a: "No. Reading, search, notes and plans all work offline. BibleOS only goes online to check for a new version of the app.",
      },
      {
        q: "Where are my notes stored? Can I move them to another computer?",
        a: "In a file on your own computer. Settings → Your data exports everything to one backup file, which you can import on another computer. BibleOS also makes a backup every day.",
      },
      {
        q: "Can I use it in Amharic?",
        a: "Yes. The app's interface can be in Amharic or English, separately from which Bible you read, and dates can follow the Ethiopian calendar.",
      },
      {
        q: "Is there a phone version?",
        a: "Not yet. BibleOS runs on Mac, Windows and Linux computers.",
      },
      {
        q: "Why does macOS or Windows say the app can't be verified?",
        a: "The installers aren't signed with a paid Apple or Microsoft certificate. You confirm once, as the install guide shows, and after that the app opens like any other.",
      },
    ],
  },

  footer: {
    tagline: "A local-first Bible study app for Amharic and English readers.",
    texts: "Bible texts",
    textsIntro: "BibleOS bundles these translations. Each is shown unchanged, under its own licence:",
    notice: "Full notice",
    source: "Source",
    licence: "Licence",
    notices: "Open-source notices",
    github: "BibleOS on GitHub",
    releases: "Releases",
    made: "BibleOS is free software for reading and studying Scripture.",
  },
} as const;
