# Releasing BibleOS

BibleOS ships for macOS (one universal app for Apple Silicon and Intel), Windows and Linux. This source repo stays private; everything public lives in **[roobiwebdev/BibleOS-releases](https://github.com/roobiwebdev/BibleOS-releases)**:

- its Releases hold the installers and `latest.json`, the update feed installed apps check when they open
- its GitHub Pages serve the landing page at https://roobiwebdev.github.io/BibleOS-releases/
- its workflows (`release.yml`, `site.yml`) do the builds; public repos get free macOS build machines

The canonical copies of that repo's files are in `release-repo/` here. Change them here first, then copy them over (see "Updating the releases repo" below). The builds read this repo with a **read-only deploy key** (Settings → Deploy keys → "BibleOS-releases builds"), so they never get write access to the source.

## What a release contains

| Platform      | Files                                                                                        | Notes                                                                    |
| ------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| macOS 12+     | `BibleOS_<v>_universal.dmg`, `BibleOS_universal.app.tar.gz` (+ `.sig`)                       | The `.tar.gz` is the update file, not for people to open                 |
| Windows 10/11 | `BibleOS_<v>_x64-setup.exe` (recommended), `BibleOS_<v>_x64_en-US.msi` (+ `.sig`)            | The setup `.exe` is also the update file                                 |
| Linux x64     | `BibleOS_<v>_amd64.AppImage` (+ `.sig`), `BibleOS_<v>_amd64.deb`, `BibleOS-<v>-1.x86_64.rpm` | The AppImage updates itself; `.deb`/`.rpm` update through a new download |
| All           | `latest.json`                                                                                | The update feed installed apps read                                      |

The landing page and the READMEs link to `BibleOS-releases/releases/latest`, so they always point at the newest published release.

## Cutting a release

1. On a task branch, set the version and describe the changes:
   ```bash
   pnpm --filter desktop release:version 0.2.0
   ```
   This writes `apps/desktop/package.json` (which `tauri.conf.json` reads) and `src-tauri/Cargo.toml`. Open a PR and merge it.
2. Start the build from `main`:
   ```bash
   gh workflow run release.yml -R roobiwebdev/BibleOS-releases -f ref=main
   ```
   (or Actions → Release → Run workflow in the releases repo).
3. The workflow builds the three platforms in parallel (about 15–25 minutes) and uploads everything to a **draft** release named "BibleOS 0.2.0" in the releases repo, tagged `v0.2.0`.
4. Download the installers from the draft and try them (open the app, read a chapter, check Settings → Updates shows the new version).
5. Edit the draft's notes if you like, then **Publish release**. Installed apps see the update the next time they open. Nothing reaches users until you publish.

To pull a bad release, delete it (or mark it as a pre-release) and publish a fixed version with a higher number. Apps never move to a lower version.

## The updater signing key

Updates are verified with BibleOS's own key pair (Tauri's updater signature, unrelated to Apple or Microsoft code signing). The public key is in `apps/desktop/src-tauri/tauri.conf.json` under `plugins.updater.pubkey`; installed apps reject any update not signed by the matching private key.

| Where                                           | What                                                                                   |
| ----------------------------------------------- | -------------------------------------------------------------------------------------- |
| `~/.tauri/bibleos-updater.key`                  | Private key (password-protected). Never commit it.                                     |
| `~/.tauri/bibleos-updater.password`             | Its password                                                                           |
| BibleOS-releases → Settings → Secrets → Actions | `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, `SOURCE_DEPLOY_KEY` |
| `~/.tauri/bibleos-source-deploy`                | Private half of the read-only deploy key (the `SOURCE_DEPLOY_KEY` secret)              |

**Back both files up somewhere safe (a password manager).** If the private key is lost, existing installs can never be updated again; everyone would have to download a new copy by hand. If it leaks, generate a new pair, ship one last update signed with the old key that carries the new public key, and rotate the secrets.

To set the secrets again (for example on a new repo):

```bash
R=roobiwebdev/BibleOS-releases
gh secret set TAURI_SIGNING_PRIVATE_KEY -R $R < ~/.tauri/bibleos-updater.key
gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD -R $R < ~/.tauri/bibleos-updater.password
gh secret set SOURCE_DEPLOY_KEY -R $R < ~/.tauri/bibleos-source-deploy
```

The deploy key can be replaced at any time: generate a new one with `ssh-keygen -t ed25519 -N "" -f ~/.tauri/bibleos-source-deploy`, add the `.pub` half as a read-only deploy key on this repo, and update the secret. Unlike the updater key, losing it breaks nothing for users.

## Updating the releases repo

Edit `release-repo/` here, merge, then copy the files into a clone of `roobiwebdev/BibleOS-releases` and push. Redeploy the landing page after site changes with `gh workflow run site.yml -R roobiwebdev/BibleOS-releases -f ref=main`.

## Building locally

```bash
pnpm --filter desktop bibles          # once: builds the bundled translations
pnpm --filter desktop build           # this computer only
# Mac release build (universal), the same as CI:
CI=true TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/bibleos-updater.key)" \
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$(cat ~/.tauri/bibleos-updater.password)" \
  pnpm --filter desktop tauri build --target universal-apple-darwin
```

`CI=true` makes the DMG step skip its Finder window styling, which otherwise times out when run from a terminal without Finder automation permission. Without the signing variables the build still works but stops at the update files, because `createUpdaterArtifacts` is on.

## Unsigned installers

There is no Apple Developer ID or Windows code-signing certificate, so first-time installs show a warning:

- **macOS:** "Apple could not verify BibleOS…". Open System Settings → Privacy & Security → **Open Anyway** (older macOS: right-click the app → Open). Updates installed from inside the app afterwards open normally.
- **Windows:** SmartScreen "Windows protected your PC". Click **More info → Run anyway**.
- **Linux:** no warning. Make the AppImage executable (`chmod +x`).

Adding certificates later needs no code changes: set the Apple (`APPLE_CERTIFICATE`, `APPLE_ID`, …) or Windows signing variables in the release workflow, as described in the Tauri distribution guides.
