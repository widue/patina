<div align="center">

<img src="src-tauri/icons/128x128.png" width="72" height="72" alt="Patina icon">

# Patina

Local-first time tracking for Windows desktop work.

English · [简体中文](README.zh-CN.md)

![Platform](https://img.shields.io/badge/platform-Windows-4f6f8f)
![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%20v2-4f7f8f)
![Local first](https://img.shields.io/badge/data-local--first-5f7f68)
[![Downloads](https://img.shields.io/github/downloads/Ceceliaee/patina/total?label=downloads&color=b07a3a)](https://github.com/Ceceliaee/patina/releases)
[![Latest downloads](https://img.shields.io/github/downloads/Ceceliaee/patina/latest/total?label=latest&color=8f6f4f)](https://github.com/Ceceliaee/patina/releases/latest)
[![License](https://img.shields.io/badge/license-MIT-6f647a)](LICENSE)

</div>


<p align="center">
Patina records foreground apps and organizes them into today's overview, a timeline, and long-term trends.<br>
Focused on quiet and trustworthy personal desktop time records.
</p>

![Patina dashboard](.github/assets/readme/dashboard.png)

## Download

Prebuilt versions are published on GitHub Releases:

- [Latest release page](https://github.com/Ceceliaee/patina/releases/latest)

If you just want to use the app, open the latest release page and download the `.exe` installer.

## Why Patina

- Automatic foreground app tracking without manually maintaining the main time record.
- AFK, lock, sleep, and crash recovery boundaries designed to keep records trustworthy.
- Local SQLite storage by default, with no account, cloud sync, or server dependency.
- App-level controls for names, categories, colors, stats exclusions, and title capture.
- Lightweight local tools for reminders, timers, and Pomodoro.
- A restrained, low-interruption desktop interface for long-term daily use.

## Core Features

### Automatic Tracking

- Detects the active foreground window and application.
- Prevents idle time from silently counting as effective activity.
- Seals sessions across lock, sleep, long-away, and abnormal-exit boundaries.
- Uses media and audio signals to reduce missed time in low-interaction scenarios such as videos, meetings, courses, and livestreams.

### Review And Analysis

- Review today's effective activity, app ranking, category distribution, and live tracking status.
- Browse the daily timeline and inspect title details under the same app.
- Explore trends, heatmaps, and app-level curves across longer time ranges.

### Management And Control

- Rename apps and adjust categories or colors.
- Exclude apps from statistics or disable title capture for specific apps.
- Export local backups, restore backups, and clean up historical records.

### Lightweight Tools

- Create one-off reminders and app usage limit reminders.
- Use stopwatch, countdown, and Pomodoro for active focus tasks.
- Tool state stays local and does not replace automatic tracking records.

## Interface Preview

| Today | History |
| :---: | :---: |
| ![Today page](.github/assets/readme/dashboard.png) | ![History page](.github/assets/readme/history.png) |
| Data | Apps |
| ![Data page](.github/assets/readme/data.png) | ![Apps page](.github/assets/readme/mapping.png) |
| Settings | About |
| ![Settings page](.github/assets/readme/settings.png) | ![About page](.github/assets/readme/about.png) |

## Reliability And Privacy

Time tracking has long-term value only when the records are trustworthy. Patina focuses on these boundaries:

- **Native window tracking**: identifies the foreground window through Rust and the Windows API.
- **AFK-aware timing**: idle time does not continue counting as effective activity.
- **Lifecycle boundaries**: handles lock, sleep, resume, and abnormal-exit session sealing.
- **Noise filtering**: filters installers, updaters, temporary system windows, and similar processes that should not enter statistics.
- **Real-duration stats**: rankings, distributions, and totals use effective activity time, not just visual spans.
- **Title capture control**: window title capture can be disabled per app to reduce unnecessary sensitive information retention.
- **Local data control**: core data stays local, and backups or restores are initiated by the user.

## Current Scope

Patina intentionally keeps its scope focused:

- **Windows 10/11 first**
- **Personal use first**
- **Local-first data storage and control**
- **Quiet, professional, long-term desktop experience**
- **Lightweight local tools such as reminders, timers, and Pomodoro**

Team collaboration, account systems, cloud sync, mobile apps, broad multi-platform parity, task management platforms, gamified productivity tools, and heavy AI insights are not the current main direction.

## Build From Source

### Requirements

- [Rust](https://www.rust-lang.org/tools/install)
- [Node.js](https://nodejs.org/) 18+

### Install Dependencies

```bash
git clone https://github.com/Ceceliaee/patina.git
cd patina
npm install
```

### Run In Development

```bash
npm run tauri dev
```

### Build Installer

```bash
npm run tauri build
```

Installers are generated under:

```text
src-tauri/target/release/bundle/
```

## Tech Stack

- Desktop shell: Tauri v2
- Backend: Rust
- Frontend: React + Vite + TypeScript
- Styling: Tailwind CSS
- Animation: Framer Motion
- Charts: Recharts
- Database: SQLite via `@tauri-apps/plugin-sql`
- Windows integration: `windows` crate

## Project Docs

If you want to contribute, understand the product direction, or review architecture boundaries, start with [`CONTRIBUTING.md`](CONTRIBUTING.md#english).

## Support

Patina is a personal, local-first open-source project. If it has been useful in your daily life or work, you can support ongoing maintenance in whichever way is convenient:

<div align="center">
  <a href="https://ko-fi.com/ceceliaee"><img src="https://storage.ko-fi.com/cdn/kofi2.png?v=3" height="36" alt="Buy me a coffee"></a>
  <br><br>
  <img src=".github/assets/support/wechat-reward.png" width="200" alt="WeChat reward code">
</div>

Sponsorship helps sustain maintenance, but it does not affect feature priority, issue handling, the roadmap, or the product direction.

## Feedback

- Releases: <https://github.com/Ceceliaee/patina/releases>
- Issues: <https://github.com/Ceceliaee/patina/issues/new/choose>

## License

[MIT](LICENSE)
