# Customizing

## Branding

There are two layers.

| Layer               | Where                                          | Changed by  | Used for                                                                                       |
| ------------------- | ---------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------- |
| Build-time defaults | `packages/config/src/branding.ts` (`BRANDING`) | a developer | fallbacks when the database cannot be read; the default theme id                               |
| Runtime values      | `app_settings` (Admin > General)               | an admin    | the live app name, description, URL, SEO title and description, OG image, theme, support email |

How the root layout (`apps/web/src/app/layout.tsx`) picks values:

- **Page title:** `metaTitle`, else `appName` from settings, else `BRANDING.appName`.
- **Description:** `metaDescription`, else `appDescription`, else `BRANDING.description`.
- **Theme:** `appTheme` from settings, else `BRANDING.defaultTheme`.

A new database starts with `appName = "Project Starter"` and `appTheme = "default"` (column defaults in `packages/db/src/schema/app.ts`). So, for a new product:

1. Edit `BRANDING` (`appName`, `tagline`, `description`, `logoPath`, `supportEmail`, `defaultTheme`).
2. After the first sign-in, set the name, description and SEO fields in **Admin > General**.
3. Optional: change the column defaults in `schema/app.ts` and generate a migration, so every new environment starts with your name.

Other brand assets:

- Favicon: `apps/web/src/app/favicon.ico`.
- Images in `apps/web/public/` (the starter ships `bat.jpeg` and `founder.png` from Batman; replace or delete them). `BRANDING.logoPath` points to `/logo.svg`, which you need to add.
- OG image: upload in Admin > General, or set an absolute URL.
- Fonts: Geist and Geist Mono, loaded in `apps/web/src/app/layout.tsx` with `next/font/google`.
- Email footer and subject lines use the live app name.
- Native app name and icons: `apps/native/app.json` and `apps/native/assets/images/`.
- Docs site name: `appName` in `apps/docs/src/lib/shared.ts`.

## Theme presets

Five brand colour presets are defined in `packages/config/src/themes.ts`:

| id        | Label   |
| --------- | ------- |
| `default` | Neutral |
| `blue`    | Blue    |
| `green`   | Green   |
| `violet`  | Violet  |
| `orange`  | Orange  |

The root layout writes the chosen id to `<html data-app-theme="...">`. Each preset is a `[data-app-theme="<id>"]` block near the end of `packages/ui/src/styles/globals.css`. Presets only change brand tokens (`--primary`, `--primary-foreground`, `--ring`, `--sidebar-primary`), with a matching dark-mode block. Everything else comes from the base tokens in `:root` and `.dark` at the top of the same file.

Light, dark and system mode are separate from presets. Users switch them (next-themes) in Settings > Appearance or with the mode toggle.

### Adding a preset

1. Add an entry to `APP_THEMES` in `packages/config/src/themes.ts`, for example `{ id: "rose", label: "Rose" }`. `APP_THEME_IDS` and the settings validation update automatically.
2. Add two blocks to `packages/ui/src/styles/globals.css`, copying an existing preset:

   ```css
   [data-app-theme="rose"] {
     --primary: oklch(...);
     --primary-foreground: oklch(...);
     --ring: oklch(...);
     --sidebar-primary: oklch(...);
   }
   .dark[data-app-theme="rose"],
   [data-app-theme="rose"] .dark {
     --primary: oklch(...);
     --primary-foreground: oklch(...);
     --sidebar-primary: oklch(...);
   }
   ```

3. Select it in Admin > General. (If the theme picker is not on that page yet, call `settings.update` with `{ appTheme: "rose" }`, or set `app_settings.app_theme` in `pnpm db:studio`.)

### Changing the whole palette

Edit the `:root` (light) and `.dark` token values at the top of `packages/ui/src/styles/globals.css`. Components use tokens only (`bg-background`, `text-foreground`, `bg-primary`, `border`, ...), so the whole app follows. Never hard-code colours in components.

## Navigation

Sidebar entries come from the module registry, `packages/config/src/modules.ts`:

- `dashboardNav` entries go to the user dashboard. Order follows the order of `MODULES`, then the order within each list.
- `adminNav` entries go to the admin sidebar, sorted by `ADMIN_NAV_ORDER`. Add new admin hrefs there.
- `icon` is a `NavIcon` name. The admin sidebar maps names to `lucide-react` icons in `NAV_ICONS` (`apps/web/src/app/admin/admin-sidebar.tsx`). To add an icon, extend `NavIcon` and the map.
- `requiresSetting` hides an entry unless an `app_settings` toggle is on.

See [modules.md](modules.md).

## Copy and content

| What                                    | Where                                                                                                                      |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Landing page                            | `apps/web/src/app/page.tsx` and the components it renders                                                                  |
| Pricing page text                       | `apps/web/src/app/pricing/`. Plans and prices come from Polar products (Admin > Products).                                 |
| Waitlist and countdown text             | Admin > Site Settings                                                                                                      |
| Maintenance message                     | Admin > General                                                                                                            |
| Privacy and terms                       | Admin > General (rendered at `/legal/privacy` and `/legal/terms`)                                                          |
| Auth email text (verify, reset, invite) | `packages/auth/src/index.ts`                                                                                               |
| Email layout                            | `emailTemplate()` in `packages/core/src/email.ts`                                                                          |
| Automatic notification text             | `packages/auth/src/index.ts` (sign-up, password change), `apps/web/src/app/api/upload/route.ts` (uploads), and the routers |
| Feedback categories and statuses        | `packages/config/src/content.ts`                                                                                           |
| Notification tags                       | `NOTIFICATION_TAGS` in `packages/core/src/types.ts`                                                                        |

When you import a shadcn block, rewrite its placeholder copy and branding to match your product.
