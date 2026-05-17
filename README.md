# Time Tracker

English | [简体中文](README.zh-CN.md)

Time Tracker is a local-first Windows desktop time tracking app. It automatically records the foreground app you are actively using, then organizes that activity into today's overview, a historical timeline, long-term analytics, and manageable apps.

Its core goal is not to be a complex team timesheet system. It is designed as a trustworthy, quiet, long-term personal desktop time record.

Built with **Rust**, **Tauri v2**, **React**, and **TypeScript**.

## Product Positioning

Time Tracker is mainly designed for people who:

- Spend long periods working, studying, or creating on a Windows desktop
- Want to know which apps and categories take up most of each day
- Prefer automatic recording without manually starting, pausing, or stopping a timer
- Need to review history by day and observe longer-term activity trends
- Want data to stay local by default, with backup, restore, and cleanup under their control
- Care about window title capture, stats exclusions, and a low-interruption desktop experience

## Interface Preview

<!--
Recommended screenshot location and filenames:

- docs/assets/readme/dashboard.png
- docs/assets/readme/history.png
- docs/assets/readme/data.png
- docs/assets/readme/mapping.png
- docs/assets/readme/settings.png
- docs/assets/readme/about.png

After screenshots are ready, insert them under the matching section title:

![Today page](docs/assets/readme/dashboard.png)
-->

|  |  |
| --- | --- |
| **Today**<br><!-- ![Today page](docs/assets/readme/dashboard.png) --><br>Quickly review today's effective activity, app ranking, category distribution, hourly activity rhythm, and current tracking status. | **History**<br><!-- ![History page](docs/assets/readme/history.png) --><br>Review the timeline by date, inspect merged app activity segments, and view window title details under the same app. |
| **Data**<br><!-- ![Data page](docs/assets/readme/data.png) --><br>Observe activity trends across the last 7 days, last 30 days, and past year, review the long-term heatmap, and inspect usage curves by app. | **Apps**<br><!-- ![Apps page](docs/assets/readme/mapping.png) --><br>Rename apps, adjust categories and colors, exclude apps from stats, disable title capture, and delete historical sessions for a specific app. |
| **Settings**<br><!-- ![Settings page](docs/assets/readme/settings.png) --><br>Manage tracking rules, tray behavior, theme colors, interface language, local backup, restore, and history cleanup. | **About**<br><!-- ![About page](docs/assets/readme/about.png) --><br>View the current version, check for updates, download a new version, and use the manual download entry if updating fails. |

## Tracking Reliability

Time tracking has long-term value only when the results are trustworthy. Time Tracker currently protects record quality through these mechanisms:

- **Native window tracking**: identifies the foreground window through Rust and the Windows API.
- **AFK-aware timing**: idle time is not silently counted as effective activity.
- **Lock and sleep boundary handling**: prevents sessions from leaking across lock, sleep, or long-away periods.
- **Continued participation detection**: reduces missed time in low-interaction but real participation scenarios such as videos, meetings, courses, and livestreams by combining media and audio signals.
- **Crash-safe recovery**: after an abnormal exit, active sessions are sealed as close as possible to the last healthy heartbeat.
- **System noise filtering**: filters installers, updaters, temporary system windows, and similar noisy processes that should not enter statistics.
- **Real-duration stats**: totals are based on effective activity time, not just visual spans.
- **Title capture control**: window title capture can be disabled per app to reduce unnecessary sensitive information retention.

## Privacy And Data

- Core data is stored in a local **SQLite** database.
- Normal use does not require an account, cloud sync, or server dependency.
- Window title capture can be disabled per app.
- Backups currently include `sessions`, `settings`, and `icon_cache`.
- Restoring a backup can replace or merge with current data, depending on the selected restore strategy; if restore fails, it rolls back to avoid damaging existing data.

## Current Scope

The project intentionally keeps its scope focused:

- **Windows 10/11 first**
- **Personal use first**
- **Local-first data storage and control**
- **Quiet, professional, long-term desktop experience**

Team collaboration, account systems, cloud sync, mobile apps, broad multi-platform parity, and heavy AI insights are not the current main direction.

## Download

Prebuilt versions are published on GitHub Releases:

- [Latest release page](https://github.com/Ceceliaee/time-tracking/releases/latest)

If you just want to use the app, open the latest release page and download the `.exe` installer.

## Build From Source

### Requirements

- [Rust](https://www.rust-lang.org/tools/install)
- [Node.js](https://nodejs.org/) 18+

### Install Dependencies

```bash
git clone https://github.com/Ceceliaee/time-tracking.git
cd time-tracking
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

If you want to contribute, adjust product direction, or review architecture boundaries, start with:

- [`docs/product-principles-and-scope.md`](docs/product-principles-and-scope.md)
- [`docs/roadmap-and-prioritization.md`](docs/roadmap-and-prioritization.md)
- [`docs/engineering-quality.md`](docs/engineering-quality.md)
- [`docs/architecture.md`](docs/architecture.md)
- [`docs/quiet-pro-component-guidelines.md`](docs/quiet-pro-component-guidelines.md)
- [`docs/issue-fix-boundary-guardrails.md`](docs/issue-fix-boundary-guardrails.md)
- [`docs/versioning-and-release-policy.md`](docs/versioning-and-release-policy.md)

Historical execution plans and stage-specific documents are usually archived under `docs/archive/`; by default, they are not the current execution basis.

## Feedback

- Releases: <https://github.com/Ceceliaee/time-tracking/releases>
- Issues: <https://github.com/Ceceliaee/time-tracking/issues/new/choose>

## License

MIT
