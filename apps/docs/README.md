# docs

The Project Starter documentation site, built with [Fumadocs](https://fumadocs.dev) on Next.js 16.

```bash
pnpm dev:docs        # from the repository root: http://localhost:4000
pnpm --filter docs build
```

## Where things are

| Path                                                            | What it is                                                                           |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `content/docs/*.mdx`                                            | Pages. Each needs `title` and `description` in its frontmatter.                      |
| `content/docs/meta.json`                                        | Sidebar title and page order (`pages`). Add new pages here.                          |
| `src/lib/source.ts`                                             | The content collection (`defineDocs` with `dir: "content/docs"`) and the page loader |
| `src/lib/shared.ts`                                             | Site name (`appName`), routes and `gitConfig` (set your repository here)             |
| `src/lib/layout.shared.tsx`                                     | Shared layout options (nav title, GitHub link)                                       |
| `src/app/(home)`                                                | Landing page                                                                         |
| `src/app/docs`                                                  | Docs layout and page renderer                                                        |
| `src/app/api/search/route.ts`                                   | Search endpoint                                                                      |
| `src/app/llms.txt`, `src/app/llms-full.txt`, `src/app/llms.mdx` | Plain-text versions of the docs for AI tools                                         |

MDX pages can use the default Fumadocs components, such as `<Cards>` and `<Card>` (see `src/components/mdx.tsx`).

## Relation to the repository docs

The detailed guides live in the repository's `docs/` folder and `README.md`. This site summarises them for readers who do not have the code open. When you change a guide, update the matching page here if it is affected.

## Before you publish it

- Set `appName` and `gitConfig` in `src/lib/shared.ts`. They are still the Fumadocs template defaults.
- Replace the "Hello World" landing page in `src/app/(home)/page.tsx`.
