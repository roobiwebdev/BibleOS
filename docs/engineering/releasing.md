# Releasing BibleOS

BibleOS ships for macOS (one universal app for Apple Silicon and Intel), Windows and Linux from GitHub Releases on this repo. Installed copies check the latest release when they open and offer to update.

## What a release contains

| Platform      | Files                                                                                        | Notes                                                                    |
| ------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| macOS 12+     | `BibleOS_<v>_universal.dmg`, `BibleOS_universal.app.tar.gz` (+ `.sig`)                       | The `.tar.gz` is the update file, not for people to open                 |
| Windows 10/11 | `BibleOS_<v>_x64-setup.exe` (recommended), `BibleOS_<v>_x64_en-US.msi` (+ `.sig`)            | The setup `.exe` is also the update file                                 |
| Linux x64     | `BibleOS_<v>_amd64.AppImage` (+ `.sig`), `BibleOS_<v>_amd64.deb`, `BibleOS-<v>-1.x86_64.rpm` | The AppImage updates itself; `.deb`/`.rpm` update through a new download |
| All           | `latest.json`                                                                                | The update feed installed apps read                                      |

The landing page and the README link to `releases/latest`, so they always point at the newest published release.

## Cutting a release

1. On a task branch, set the version and describe the changes:
   ```bash
   pnpm --filter desktop release:version 0.2.0
   ```
   This writes `apps/desktop/package.json` (which `tauri.conf.json` reads) and `src-tauri/Cargo.toml`. Open a PR and merge it.
2. Tag `main` and push the tag:
   ```bash
   git checkout main && git pull
   git tag v0.2.0 && git push origin v0.2.0
   ```
   You can also run the **Release** workflow by hand from the Actions tab; it tags the version in `package.json`.
3. `.github/workflows/release.yml` builds the three platforms in parallel (about 15–25 minutes) and uploads everything to a **draft** release named "BibleOS 0.2.0".
4. Download the installers from the draft and try them (open the app, read a chapter, check Settings → Updates shows the new version).
5. Edit the draft's notes if you like, then **Publish release**. Installed apps see the update the next time they open. Nothing reaches users until you publish.

To pull a bad release, delete it (or mark it as a pre-release) and publish a fixed version with a higher number. Apps never move to a lower version.

## The updater signing key

Updates are verified with BibleOS's own key pair (Tauri's updater signature, unrelated to Apple or Microsoft code signing). The public key is in `apps/desktop/src-tauri/tauri.conf.json` under `plugins.updater.pubkey`; installed apps reject any update not signed by the matching private key.

| Where                                 | What                                                              |
| ------------------------------------- | ----------------------------------------------------------------- |
| `~/.tauri/bibleos-updater.key`        | Private key (password-protected). Never commit it.                |
| `~/.tauri/bibleos-updater.password`   | Its password                                                      |
| GitHub → Settings → Secrets → Actions | `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` |

**Back both files up somewhere safe (a password manager).** If the private key is lost, existing installs can never be updated again; everyone would have to download a new copy by hand. If it leaks, generate a new pair, ship one last update signed with the old key that carries the new public key, and rotate the secrets.

To set the secrets again (for example on a new repo):

```bash
gh secret set TAURI_SIGNING_PRIVATE_KEY < ~/.tauri/bibleos-updater.key
gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD < ~/.tauri/bibleos-updater.password
```

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
