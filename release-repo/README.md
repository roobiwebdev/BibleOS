# BibleOS

BibleOS is a free Bible study app for Mac, Windows and Linux. Read Amharic and English side by side, keep notes and highlights, follow reading plans and track your reading habit. Everything stays on your computer: there's no account, and it works offline.

**Website:** https://bibleos.roobi.dev/

This repository holds the installers and the update feed. Download from **[the latest release](https://github.com/roobiwebdev/BibleOS-releases/releases/latest)**.

| Computer                                | File                                                    |
| --------------------------------------- | ------------------------------------------------------- |
| Mac (Apple Silicon or Intel), macOS 12+ | `BibleOS_<version>_universal.dmg`                       |
| Windows 10 or 11                        | `BibleOS_<version>_x64-setup.exe`                       |
| Linux (x64)                             | `.AppImage`, `.deb` (Debian, Ubuntu) or `.rpm` (Fedora) |

Once installed, BibleOS checks for new versions when it opens and asks before installing one.

## Install

BibleOS is an independent free app, so its installers aren't signed with paid Apple or Microsoft certificates. Your computer will warn you the first time. Updates are signed with BibleOS's own key and checked before they install.

**Mac**

1. Open the `.dmg` and drag **BibleOS** into **Applications**.
2. Open BibleOS. macOS says it "could not verify" the app; click **Done**.
3. Open **System Settings → Privacy & Security**, scroll down and click **Open Anyway** next to BibleOS, then confirm. (On macOS 12–14 you can instead right-click the app and choose **Open**.)

**Windows**

1. Run `BibleOS_<version>_x64-setup.exe`.
2. If you see "Windows protected your PC", click **More info → Run anyway**.

**Linux**

- AppImage: `chmod +x BibleOS_*.AppImage && ./BibleOS_*.AppImage`
- Debian/Ubuntu: `sudo apt install ./BibleOS_*_amd64.deb`
- Fedora/openSUSE: `sudo dnf install ./BibleOS-*.x86_64.rpm`

## Bible translations

BibleOS bundles the Amharic ULB (CC BY-SA 4.0, Door43), the Amharic 1962 New Testament (non-commercial use with full notice, United Bible Societies / Bible Society of Ethiopia via eBible.org), the King James Version, the World English Bible and the Berean Standard Bible (public domain). The full notices are in the app under Settings → Licences and on the website.

Third-party code used by the website: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
