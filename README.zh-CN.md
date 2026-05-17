# Time Tracker

[English](README.md) | 简体中文

Time Tracker 是一个本地优先的 Windows 桌面时间追踪应用。它会自动记录你当前正在使用的前台应用，并把这些活动整理成今天概览、历史时间线、长期数据分析和可管理的应用列表。

它的核心目标不是做一个复杂的团队工时系统，而是做一个可信、安静、可长期使用的个人桌面时间记录工具。

项目使用 **Rust**、**Tauri v2**、**React** 和 **TypeScript** 构建。

## 产品定位

Time Tracker 主要服务这类使用场景：

- 长时间在 Windows 桌面上工作、学习或创作
- 想知道每天的时间主要花在哪些应用和类别上
- 希望记录过程自动完成，不需要手动开始、暂停或停止计时器
- 需要按天回看历史，并观察更长周期的活动趋势
- 希望数据默认留在本地，并能自己备份、恢复和清理
- 在意窗口标题记录、统计排除和低打扰桌面体验

## 界面预览

<!--
截图建议放在 docs/assets/readme/ 下，并使用这些文件名：

- dashboard.png
- history.png
- data.png
- mapping.png
- settings.png
- about.png

截图准备好后，可以在对应小节标题下方插入：

![今天页面](docs/assets/readme/dashboard.png)
-->

|  |  |
| --- | --- |
| **今天**<br><!-- ![今天页面](docs/assets/readme/dashboard.png) --><br>快速查看今日有效活动、应用排行、分类分布、小时级活动节奏，以及当前追踪状态。 | **历史**<br><!-- ![历史页面](docs/assets/readme/history.png) --><br>按日期回看历史时间线，查看合并后的应用活动片段，以及同一应用下的窗口标题明细。 |
| **数据**<br><!-- ![数据页面](docs/assets/readme/data.png) --><br>观察近 7 天、近 30 天和近一年的活动趋势、长期热力图，并按应用查看使用曲线。 | **应用**<br><!-- ![应用页面](docs/assets/readme/mapping.png) --><br>重命名应用、调整分类和颜色、排除统计、关闭标题记录，并删除指定应用的历史会话。 |
| **设置**<br><!-- ![设置页面](docs/assets/readme/settings.png) --><br>管理追踪规则、驻留行为、主题配色、界面语言、本地备份、恢复和历史清理。 | **关于**<br><!-- ![关于页面](docs/assets/readme/about.png) --><br>查看当前版本、检查更新、下载新版本，并在更新失败时使用手动下载入口。 |

## 追踪可靠性

时间追踪只有在结果可信时才有长期价值。Time Tracker 目前通过这些机制保护记录质量：

- **原生窗口追踪**：通过 Rust 和 Windows API 识别前台窗口。
- **AFK 感知计时**：空闲时间不会被悄悄算作有效活动。
- **锁屏与睡眠边界处理**：避免会话跨越锁屏、睡眠或长时间离开后继续串记。
- **持续参与识别**：对视频、会议、课程、直播等低交互但真实参与的场景，结合媒体和音频信号减少漏记。
- **崩溃安全恢复**：异常退出后的活动会话会尽量封口到最后一次健康心跳附近。
- **系统噪音过滤**：过滤安装器、更新器、系统临时窗口等不适合进入统计的噪音进程。
- **真实时长统计**：统计基于有效活动时间，而不是单纯的视觉跨度。
- **标题记录控制**：可以按应用关闭窗口标题记录，降低不必要的敏感信息保留。

## 隐私与数据

- 核心数据存储在本地 **SQLite** 数据库中。
- 正常使用不需要账号、云同步或服务器依赖。
- 窗口标题记录可以按应用关闭。
- 备份当前包含 `sessions`、`settings` 和 `icon_cache`。
- 恢复备份可按所选策略覆盖或兼容合并当前数据；恢复失败时会回滚，避免破坏现有数据。

## 当前范围

当前项目有意保持范围克制：

- **Windows 10/11 优先**
- **个人使用优先**
- **本地优先的数据存储与控制**
- **安静、专业、可长期使用的桌面体验**

暂不把团队协作、账号体系、云同步、移动端、多平台同步铺开或重型 AI 洞察作为当前主线。

## 下载

预构建版本发布在 GitHub Releases：

- [最新版发布页面](https://github.com/Ceceliaee/time-tracking/releases/latest)

如果只是想使用应用，进入最新版页面后下载 `.exe` 安装包即可。

## 从源码运行

### 环境要求

- [Rust](https://www.rust-lang.org/tools/install)
- [Node.js](https://nodejs.org/) 18+

### 安装依赖

```bash
git clone https://github.com/Ceceliaee/time-tracking.git
cd time-tracking
npm install
```

### 开发运行

```bash
npm run tauri dev
```

### 构建安装包

```bash
npm run tauri build
```

安装包会生成在：

```text
src-tauri/target/release/bundle/
```

## 技术栈

- 桌面壳：Tauri v2
- 后端：Rust
- 前端：React + Vite + TypeScript
- 样式：Tailwind CSS
- 动效：Framer Motion
- 图表：Recharts
- 数据库：SQLite，通过 `@tauri-apps/plugin-sql`
- Windows 集成：`windows` crate

## 项目文档

如果你要参与贡献、调整产品方向或审查架构边界，建议先阅读：

- [`docs/product-principles-and-scope.md`](docs/product-principles-and-scope.md)
- [`docs/roadmap-and-prioritization.md`](docs/roadmap-and-prioritization.md)
- [`docs/engineering-quality.md`](docs/engineering-quality.md)
- [`docs/architecture.md`](docs/architecture.md)
- [`docs/quiet-pro-component-guidelines.md`](docs/quiet-pro-component-guidelines.md)
- [`docs/issue-fix-boundary-guardrails.md`](docs/issue-fix-boundary-guardrails.md)
- [`docs/versioning-and-release-policy.md`](docs/versioning-and-release-policy.md)

历史执行计划和阶段性文档通常会归档到 `docs/archive/`，默认不作为当前执行依据。

## 反馈

- Releases: <https://github.com/Ceceliaee/time-tracking/releases>
- Issues: <https://github.com/Ceceliaee/time-tracking/issues/new/choose>

## 许可证

MIT
