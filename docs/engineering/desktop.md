# The desktop app

BibleOS is a desktop Bible study app for macOS, Windows and Linux in `apps/desktop`. This page explains why the desktop rules in [CLAUDE.md](../../CLAUDE.md) look the way they do. The approved plan behind it is the BibleOS engineering plan (Phase Six); items marked **planned** below are approved but not built yet.

## Local-first

Everything a reader creates (highlights, notes, collections, reading time) stays on their Mac. There is no account, no server and no telemetry in v1. The one network feature is optional: the ESV and NLT are read online (see [Online translations](#online-translations-esv-and-nlt)), and only when the reader picks one.

- **Privacy.** Study notes and prayer journals are personal. Keeping them on disk in the user's macOS account means there is nothing to breach and nothing to sign in to.
- **Offline.** Scripture and study data are both local, so the app works on a plane or in a church with no signal.
- **Speed.** A chapter switch is a local SQLite read. There is no network round trip to hide.
- **Sync later, without a rewrite.** Every study row has the columns sync needs (see [Command layer and change_log](#command-layer-and-change_log)). The web stack in this repo (`packages/api`, `auth`, `db`) is kept because a future sync server could reuse it.

## Why Tauri

| Need                          | How Tauri 2 meets it                                                                          |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| Small download                | Uses the system WebView (WKWebView) instead of bundling Chromium                              |
| Reuse the React design system | The UI is a Vite + React 19 SPA; `packages/ui` has no Next.js dependency                      |
| Local SQLite                  | A small Rust bridge (`src-tauri/src/db.rs`, rusqlite with bundled SQLite)                     |
| Tight permissions             | Capabilities (`src-tauri/capabilities/default.json`) allow only the plugins and calls we name |
| Updates                       | `tauri-plugin-updater` with its own signing key (see [releasing.md](releasing.md))            |
| Windows and tablets later     | The same app builds for Windows, and Tauri 2 has an iOS target                                |

Rust is kept to plugin wiring (`src-tauri/src/lib.rs`). Business logic lives in TypeScript packages so it can be unit tested in Node and reused on other platforms.

The SPA uses TanStack Router with **hash history** (`src/router.tsx`). Hash URLs work the same in the browser preview and inside the app bundle, where there is no server to rewrite paths. URL state (open chapter, focused verse, study tab) makes back and forward work like a browser and lets any screen link into the reader.

### No `.env`

A desktop app has no deployment environment to read from. Build-time config (window, CSP, bundle id, resources) lives in `src-tauri/tauri.conf.json`. OS permissions live in `src-tauri/capabilities/`. Anything the user can change belongs in Settings, validated by `preferencesSchema` in `local-api`. The app holds no secrets. The online translations' API keys live only on the relay (see [Online translations](#online-translations-esv-and-nlt)), so there is nothing to put in the Keychain.

## Data model

### Canonical VerseId

`packages/bible-core/src/verse-id.ts` names every verse with one integer: `book ord × 1,000,000 + chapter × 1,000 + verse` (chapter ids use verse 0). The canonical order is KJV-style, with room for book codes beyond the 66 so the Ethiopian canon fits later.

- Integers sort in reading order and index cheaply in SQLite.
- Highlights, notes, collections, reading progress and parallel view all key on the same id, so they do not depend on which translation is open.

### Annotations are keyed by verse, not translation

A highlight made while reading the Amharic ULB shows up when the reader switches to the KJV, because both translations store John 3:16 under the same `VerseId`. Partial-verse highlights (planned) will store character offsets and fall back to the whole verse in another translation. Ranges (`VerseRange` in `bible-core/src/range.ts`) are inclusive pairs of verse ids, and every feature uses the same overlap and subtraction code.

### Versification and merged verses

Editions merge and split verses differently. The 1962 Amharic NT prints John 3:14-16 as one verse. A merged verse is stored once, at its first verse id, with `span_end` and a `label` such as `14-16` (`packages/bible-data/src/schema.ts`). `alignParallel` in `bible-core/src/parallel.ts` grows each parallel row until no column overlaps it, so the merged verse sits beside its parts.

The build compares each translation's verse coverage with the KJV grid and reports gaps. A per-translation `verse_map` for editions whose numbering differs from the canonical scheme is planned; study data never needs to change when it lands, because it only ever stores canonical ids.

### Two kinds of database

| Database               | Written by                                   | Opened by the app | Changes by                     |
| ---------------------- | -------------------------------------------- | ----------------- | ------------------------------ |
| `<translation>.sqlite` | `bible-data` build, one file per translation | read-only         | rebuilding from pinned sources |
| `study.sqlite`         | `local-api` commands                         | read-write        | Drizzle migrations             |

Keeping scripture separate means a translation can be replaced or added without touching user data, and a bad migration can never damage scripture. The study database will live in `~/Library/Application Support/app.bibleos.desktop/`, with daily backups that keep the newest 14 copies.

## Translation pipeline and licensing

`packages/bible-data` turns upstream USFM into the read-only databases:

1. `src/manifest.ts` lists every bundled translation: archive URL, **pinned SHA-256**, licence, verbatim notice, scope (whole Bible or NT) and language.
2. `src/build.ts` downloads each archive (cached in `.cache/`), verifies the hash, parses every book with `src/usfm.ts`, and writes one SQLite file per translation with `text_norm` precomputed for search. It also writes `catalog.json`.
3. `src/export-preview.ts` writes per-book JSON for the browser preview.

`pnpm --filter desktop bibles` runs both steps into `apps/desktop/src-tauri/resources/bibles/` and `apps/desktop/public/preview-bible/`. Both folders are gitignored; the Tauri bundle copies the first into the app.

Why the discipline:

- **A hash mismatch stops the build.** If an upstream file changes, the new text is reviewed before it ships. Scripture never changes silently.
- **Never edit scripture by hand.** Fixes go upstream or into the pipeline, so the bundled text can always be reproduced from a named source.
- **Licences are data.** The Door43 Amharic ULB is CC BY-SA 4.0, so the derived translation database is shared under the same licence (this applies to the text file, not the app code). The 1962 Amharic NT allows non-commercial use with its full notice, which fits a free app. Public-domain English texts still carry a source credit. The Licences page and exports read notices from the manifest, never from copy elsewhere.
- **Book names can come from our catalogue.** When an edition's own book titles carry errors, the manifest sets `bookNames: "catalogue"` and the reviewed names in `bible-core/src/books.ts` are used.

Screens read scripture only through `BibleSource` (`apps/desktop/src/lib/bible/source.ts`). Inside Tauri it loads the SQLite translation store; in a browser it loads the preview JSON and validates each file with Zod. Screens do not know which one they got, so the UI can be designed and tested in a browser and the native store changes no screen code.

## Online translations (ESV and NLT)

The ESV (Crossway) and NLT (Tyndale) may not be bundled. Their publishers let free, non-commercial apps fetch the text from their APIs, with limits. BibleOS reads them online, and every other screen treats them like bundled text.

```
reader / Today / study / search
  → BibleSource (src/lib/bible/source.ts): online ids go to the online source
  → online source (src/lib/bible/online-source.ts): one chapter, a verse range or a search; cache ≤ 500 verses
  → https://bible.roobi.dev/api/bible  (the relay, a Vercel function next to the landing page)
  → api.esv.org / api.nlt.to with the key from the relay's environment
```

- **One source of truth.** `packages/bible-data/src/online.ts` holds `ONLINE_TRANSLATIONS` (names, publisher, verbatim notices with their source URL, the required link), `ONLINE_LIMITS`, `ONLINE_RELAY` and the Zod schemas for relay requests and responses. The app builds requests with the same schema the relay checks, and checks every response. `apps/desktop/src/lib/bible/catalog.ts` joins the bundled and online lists for the menus (`READER_TRANSLATIONS`, `delivery: "bundled" | "online"`).
- **Keys never ship.** `ESV_API_KEY` and `NLT_API_KEY` are Vercel environment variables on the relay. `apps/site/relay/vercel.ts` is the only file that reads them. The NLT key travels in the publisher URL, so the relay never logs URLs or bodies.
- **The relay stores nothing.** Each request is checked with Zod (one chapter, a verse range inside one chapter, or a search of 2 to 100 characters), passed to the publisher, normalised into one JSON shape (verses by `VerseId` with paragraph style, headings, search hits) and returned with `Cache-Control: no-store`. Without a key it answers `503 not-configured`. Rate limits are best effort and per instance: 30 requests a minute per IP, plus each publisher's caps (ESV 60 a minute, 1,000 an hour, 5,000 a day; NLT 5,000 a day). CORS allows only `tauri://localhost` (macOS, Linux), `http://tauri.localhost` (Windows) and `http://localhost:1420` (browser preview); other browser origins get 403.
- **Licence limits in the app.** The ESV terms (https://api.esv.org/) allow at most 500 verses or half a book per query, stored locally and shown on one page. The NLT key tier (https://api.nlt.to/) allows 500 verses a request and 5,000 requests a day and says nothing about caching, so the app applies the ESV rule to both. The online source keeps at most 500 verses per translation in memory (least recently used out first, nothing on disk). The continuous reader keeps each online translation within 500 verses and half a book on screen, and says so when it stops loading more chapters.
- **Attribution.** Every chapter, passage and search result in an online translation shows the abbreviation, the publisher and the publisher's link (`OnlineAttribution`); the ESV terms ask for a link to www.esv.org on every page. Settings → Translations and licences shows each verbatim notice. The links are allowed in `src-tauri/capabilities/default.json`.
- **No internet is a normal state.** Online calls reject with `OnlineTextError` (`offline`, `not-configured`, `rate-limited`, `failed`) and never hang (15 s timeout). Screens show `OnlineUnavailable` with a retry, in English and Amharic; in parallel view the side that loaded is read alone. Bundled translations keep working.
- **Omitted verses.** The ESV and NLT move some verses to footnotes (Matthew 17:21). The relay leaves them out, the reader skips the number (the parallel column shows "—"), and study lists say the translation has no text for that verse. Notes, highlights and bookmarks stay keyed by `VerseId`, so they carry over between translations.
- **CSP.** `connect-src` in `tauri.conf.json` allows exactly `https://bible.roobi.dev`, the origin in `ONLINE_RELAY`.
- **Defaults are unchanged.** New installs still open the bundled BSB and 1962; the ESV and NLT appear only when picked.

Testing: `apps/site/relay/relay.test.ts` runs the parsers against recorded publisher answers in `apps/site/relay/fixtures/` (the ESV documentation examples and a synthetic Matthew 17; NLT pages), and `apps/desktop/src/lib/bible/online-source.test.ts` covers the cache cap, errors and search. `pnpm --filter site relay:dev` runs the bundled relay on http://localhost:4320/api/bible with the keys from your shell, or with `RELAY_FIXTURES=1` from the fixtures.

## Amharic and Ethiopic text

- **`lang` attributes everywhere.** Scripture and UI text carry `lang="am"` or `lang="en"`. CSS uses `:lang(am)` for Ethiopic size and line height, and screen readers pick the right voice.
- **Bundled fonts.** Literata, Inter, Noto Serif Ethiopic and Noto Sans Ethiopic are bundled through Fontsource, so Ethiopic renders the same offline and the CSP needs no remote font source.
- **Never fold displayed scripture.** Amharic letters that sound alike can carry different meanings (ድህነት "poverty", ድኅነት "salvation"). `normalizeForSearch` in `bible-core/src/normalize.ts` folds homophone families and Ethiopic punctuation for the search copy only.
- **Interface language is separate from Bible language.** All UI strings live in `apps/desktop/src/i18n/messages.ts`. The Amharic catalogue must match the English shape, so a missing string fails type checking. The file moves to a shared package once a second app needs it.
- **Ethiopian calendar.** `bible-core/src/calendar.ts` converts and formats dates so the heatmap and Today can show Ethiopian months.

## Command layer and change_log

**Planned** in `packages/local-db` and `packages/local-api`, being built now. Until they land, `src/lib/state/*` keeps preferences and study data in memory with the same shapes.

The web app's checkpoint is the tRPC procedure builder. Its checks change meaning for a single local user:

| Check          | Web             | Desktop                                                                    |
| -------------- | --------------- | -------------------------------------------------------------------------- |
| Authentication | Session         | Not applicable: one user, data in their macOS account                      |
| Permissions    | Roles           | Not applicable in code. Tauri capabilities limit what the WebView may call |
| Plan / tier    | Billing         | Not applicable: free app                                                   |
| Limits         | Rate limit      | Size limits: Zod caps on note length, tag counts and import size           |
| Audit          | `audit_log` row | `change_log` row                                                           |

`defineCommand({ input, kind: "query" | "mutation", entity, run })` is the one checkpoint for study data. It validates input with Zod, opens a transaction for mutations, writes a `change_log` row (`entity`, `entity_id`, `action`, `at`), maps errors to typed results, and logs through a scoped logger that never logs note contents. Commands hold the business logic; services hold reusable queries, the same split as routers and services on the web.

Why `change_log` now: it is the audit trail today and the **sync outbox** later. Study rows also use UUIDv7 ids, `created_at`/`updated_at`, and soft deletes (`deleted_at`) for the same reason. A future sync can replay the log without a schema rewrite.

### The SQLite executor

Drizzle's `sqlite-proxy` driver takes a small executor (`run`, `all`, `get`, `batch`). `local-db` defines that interface and ships two adapters:

- **The Rust bridge** inside the app: one connection to `study.sqlite` (transactions are separate `BEGIN`/`COMMIT` statements and must not split across a connection pool, which is why `tauri-plugin-sql` was dropped), and read-only connections to the bundled translations, chosen by translation id so the web layer can never open another path. Rows keep their column order because Drizzle's proxy maps columns by position.
- **sql.js** (SQLite in WebAssembly, in memory) in the browser preview, seeded with sample data through the same commands.
- **`node:sqlite`** for Vitest and Node tools.

Later platforms add their own (expo-sqlite on a tablet, wa-sqlite or sql.js in a browser). One schema and one set of commands then work everywhere.

The UI must never import the executor or a driver. If it did, a component could write without validation, a transaction or a `change_log` row. A lint rule to enforce this is planned. There is no SQL plugin: the capability file grants only core APIs plus the updater and relaunch, and SQLite is reached through the app's own `db.rs` commands.

Drizzle is pinned exactly because the `sqlite-proxy` driver changed between release candidates. Upgrade it on purpose, with the command tests as the gate.

## Migrations

- `drizzle-kit generate` (SQLite dialect) writes SQL migrations from `packages/local-db`. Review and commit them with the schema change, as on the web.
- The app runs them when it opens `study.sqlite`. How they are embedded in the Tauri build is confirmed in the Phase 1 spike.
- A backup is taken before each migration (planned).
- Translation databases are never migrated. A format change bumps `TRANSLATION_DB_VERSION` in `bible-data/src/schema.ts` and the files are rebuilt.

## Testing

| Layer              | How                                                                                                                                      |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `bible-core`       | Vitest table tests: books, references (English, Amharic, typos, ranges), normalization, Ethiopian calendar, habit math, parallel, ranges |
| `bible-data`       | Vitest for the USFM parser; the build itself verifies hashes and verse coverage                                                          |
| `local-api`        | Vitest on real SQLite through the `node:sqlite` executor, using the same schema and migrations as the app                                |
| UI flows (planned) | Playwright against the Vite preview (`dev:vite`)                                                                                         |
| The real app       | Manual checks before each release with the `evidence-driven-testing` skill; evidence goes in `.artifacts/`                               |

Real SQLite in tests catches what a mock would hide: constraint errors, transaction behavior and migration mistakes. Playwright runs against the preview because `tauri-driver` (Tauri's WebDriver) has no macOS support. That leaves the native shell (menus, file dialogs, plugin wiring) to manual checks.

On Windows and Linux, where `tauri-driver` does work, the `smoke.yml` workflow in the releases repo starts the built app and checks the first screen rendered (see [releasing.md](releasing.md#smoke-test-on-windows-and-linux)).

**Per-system differences** go through `src/lib/platform.ts` (one user-agent check, no OS plugin). The window uses macOS's overlay title bar, so only on a Mac do screens reserve the draggable top strip (`TitleBarStrip`) for the window buttons; Windows and Linux keep their native title bar. Shortcut labels come from `shortcutLabel` (⌘K on a Mac, Ctrl+K elsewhere).

`pnpm check-types`, `pnpm lint` and `pnpm test` cover the desktop packages like any other workspace project.

## Packaging and distribution

- **Universal binary.** `tauri build --target universal-apple-darwin` produces one `.app` for Apple Silicon and Intel, plus a DMG. Bundle id `app.bibleos.desktop`, category Reference, minimum macOS 12 (see `tauri.conf.json`). `pnpm --filter desktop build` builds for the host architecture; the release workflow builds the universal Mac app plus Windows (NSIS `.exe`, `.msi`) and Linux (`.AppImage`, `.deb`, `.rpm`).
- **Unsigned builds.** There is no Apple Developer Program membership, so the app ships ad-hoc signed and not notarized. The first time someone opens it, macOS blocks it; they allow it once in System Settings → Privacy & Security → Open Anyway. Developer ID signing and notarization can be added later with no code changes.
- **Updates.** `tauri-plugin-updater` checks `latest.json` on the latest GitHub Release when the app opens (Settings → Updates can turn this off) and installs only after the reader agrees. Updates are signed with BibleOS's own updater key pair, separate from Apple or Windows code signing, and the public key is embedded in `tauri.conf.json`. The private key never enters the repo. See [releasing.md](releasing.md).
- **Hardening.** A strict CSP with no remote scripts, styles or fonts (`tauri.conf.json`). No `shell` plugin. Note Markdown is sanitized before rendering and imported JSON is validated with Zod before any write (planned with notes and import).

## Future platforms

| Platform    | Path                                                                                                                                                                                     |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows     | The same Tauri app on WebView2 with an NSIS/MSI installer. Code signing needs its own certificate. Ethiopic rendering needs a check, though the bundled fonts reduce the risk.           |
| iPad/tablet | Tauri 2 mobile reusing all packages and the UI with a touch layout, or Expo (`apps/native`) reusing `bible-core`, the `local-db` schema and the strings through an expo-sqlite executor. |
| Sync        | `change_log` becomes the outbox. A sync server could reuse `packages/api`, `auth` and Postgres.                                                                                          |

The pure TypeScript packages (`bible-core`, `bible-data`, and the `local-db` schema) have no Tauri dependency. That is what keeps these options open.
