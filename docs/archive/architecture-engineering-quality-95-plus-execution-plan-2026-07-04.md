# 架构与工程质量 9.5+ 执行方案

## 0. 文档状态

- [x] 本执行单已完成，不再是当前执行依据。
- [x] 本执行单完成后，已将长期规则回写到对应 top-level `docs/` 文档。
- [x] 本执行单完成后，已移入 `docs/archive/`。

本文是一次性执行方案，不是长期母文档。执行期间它可以放在 `docs/working/`；完成后应归档。

目标不是把仓库“看起来整理过”，而是把真实架构与工程质量从当前复评的 **8.4 / 10** 推到可辩护的 **9.5+ / 10**。

完成摘要：

- [x] 前端 `src/app/**` 直连 Tauri API 的漏网点已修复，并由 `check:architecture` 覆盖。
- [x] Rust `app/tray.rs`、`app/desktop_behavior.rs`、`app/web_activity.rs`、`app/web_activity_bridge.rs` 直连 data repository / SQLite pool 的漏网点已迁出，并由 `check:rust-boundaries` 覆盖。
- [x] 前端生产 SQL 写入已迁往 typed Rust command；main window active capability 已移除 `sql:allow-execute`。
- [x] `tests/**/*.ts` 与 `scripts/**/*.ts` 已纳入 `check:types`。
- [x] 最高风险热点已建立 `check:hotspots` 增长预算门禁。
- [x] 长期规则已回写到 `docs/architecture.md` 与 `docs/engineering-quality.md`。
- [x] 最终验证已通过：`npm run check:full`、`npm run release:check`、全部现有 perf 脚本均通过预算。
- [x] 最终真实复评为 **9.6 / 10**。

最终复评摘要：

| 维度 | 执行前 | 执行后 | 主要证据 |
| --- | ---: | ---: | --- |
| 架构边界 | 8.3 | 9.6 | `src/app/**` 禁止直连 Tauri API；Rust `app/**` 禁止直连 data repository / SQLite pool；同类问题有自动化 guard |
| 工程质量 | 8.5 | 9.5 | tests/scripts 纳入 typecheck；热点增长预算门禁接入 `npm run check`；Rust clippy `-D warnings` 通过 |
| 可靠性与验证 | 9.1 | 9.7 | `check:full`、`release:check`、前端测试、browser smoke、Rust 304 个测试、clippy 全部通过 |
| 数据/权限边界 | 8.0 | 9.6 | 前端生产 SQL 写入迁到 typed Rust command；main capability 移除 `sql:allow-execute` |
| 长期可维护性 | 8.1 | 9.5 | 高吸力层漏网点迁出；长期规则回写；热点文件设增长失败门禁 |

综合评分：**9.6 / 10**。仍保留 0.4 分扣分，因为若干历史热点文件仍然偏大，只是已经被 owner 判断与增长门禁控制，尚未全部完成结构性拆分。

---

## 1. 第一性原理

### 1.1 产品信任是最高约束

`Patina` 是本地优先、Windows 桌面时间追踪工具。用户信任来自三件事：

1. 记录可信。
2. 数据安全。
3. 行为可解释。

因此工程质量优先级必须保持：

1. 可靠性与验证
2. 代码质量
3. 性能

任何让代码更整齐但削弱 tracking、SQLite、备份、恢复、升级或发布可信度的改动，都不计入正向质量提升。

### 1.2 架构质量的核心不是目录，而是所有权

长期结构已经定义为：

```text
frontend: app / features / shared / platform / styles
rust:     lib.rs + app / commands / platform / engine / data / domain
```

真正要守住的是：

- 页面组件不直接碰平台和 SQLite。
- `app/*` 只做壳层、启动、跨 feature 编排。
- `shared/*` 只放稳定共享能力。
- `platform/*` 只放外部环境边界。
- Rust `commands/*` 只做 IPC 边界。
- Rust `app/*` 只做 Tauri app 生命周期与协调。
- Rust `data/*` 拥有 SQLite 与仓储。
- Rust `engine/*` 拥有核心行为流程。
- Rust `domain/*` 拥有领域语义和稳定契约。

目录看起来正确但高吸力层继续吸收业务逻辑，不算架构健康。

### 1.3 9.5+ 的含义

9.5+ 不是“没有任何大文件”，也不是“所有事情都抽象完”。它要求：

- 已发现的高风险边界漂移被修复。
- 对应门禁能防止同类问题复发。
- 完整质量门槛稳定通过。
- 核心路径验证覆盖实际风险，而不是只覆盖类型通过。
- 高复杂度热点有明确 owner、拆解路线或增长约束。
- 数据写权限和平台权限的风险被显式收口。
- 文档与脚本反映真实现状。

---

## 2. 当前基线

### 2.1 当前评分

- [x] 执行前重新确认当前评分基线。

当前复评结论：

| 维度 | 当前分 | 主要扣分 |
| --- | ---: | --- |
| 架构边界 | 8.3 | `app/*` 与平台/数据边界存在门禁盲区 |
| 工程质量 | 8.5 | 热点文件偏大，前端测试/脚本类型门槛不足 |
| 可靠性与验证 | 9.1 | `check:full` 很强，但局部盲区未被 guard 捕获 |
| 数据/权限边界 | 8.0 | main window 仍有 `sql:allow-execute` |
| 长期可维护性 | 8.1 | 高复杂度路径仍容易在小修中继续变厚 |

综合：**8.4 / 10**。

### 2.2 已通过验证

- [x] `npm run check:architecture` 通过。
- [x] `npm run check:naming` 通过。
- [x] `npm run check:rust-boundaries` 通过。
- [x] `cargo fmt --manifest-path src-tauri/Cargo.toml --check` 通过。
- [x] `npm run check:full` 在提升权限后通过。

备注：普通 sandbox 下 `test:ui-browser-smoke` 会在 Vite/esbuild 子进程处遇到 `spawn EPERM`。这属于环境权限问题，不是代码失败。执行过程中如再次遇到同样问题，按仓库权限规则申请提升权限重跑同一命令。

### 2.3 关键现状事实

- [ ] 重新运行 `npm run quality:hotspots` 并保存本轮热点列表。
- [ ] 重新确认 `git status --short` 为空或仅包含本轮执行单改动。
- [ ] 重新确认没有 `src/lib/` 与 `src/types/`。
- [ ] 重新确认 CI 仍跑 `npm run check:full`。

已知事实：

- 前端根层当前为 `app / features / platform / shared / styles`。
- Rust 根层当前为 `app / commands / data / domain / engine / platform`，另有空的 `src-tauri/src/bin/`。
- 前端 SQL 基本收口在 `src/platform/persistence/*`。
- Rust `commands/*` 大多是薄 DTO/转发层。
- `src-tauri/capabilities/widget.json` 没有 `sql:allow-execute`。
- `src-tauri/capabilities/default.json` 仍给 main window 开了 `sql:allow-execute`。

---

## 3. 目标与非目标

### 3.1 目标

- [x] 已发现的两个边界漏网点修复完成。
- [x] 自动化门禁能拦住同类边界漏网点。
- [x] main window SQLite 写权限有明确收口路径，优先移除 `sql:allow-execute`。
- [x] 前端测试和脚本不再只依赖 `node --experimental-strip-types` 作为类型保护。
- [x] 至少 5 个最高风险热点文件有具体 owner 判断、拆解步骤或增长门禁。
- [x] `npm run check:full` 通过。
- [x] `npm run release:check` 通过。
- [x] 至少关键 perf 脚本通过，并能解释是否代表真实性能收益。
- [x] 最终复评达到 9.5+，且每个加分项都有代码、门禁或验证证据。

### 3.2 非目标

- [ ] 不做产品方向扩张。
- [ ] 不引入团队 SaaS、云优先、移动优先或游戏化方向。
- [ ] 不为了行数好看做全仓大搬迁。
- [ ] 不删除数据库 migration、legacy schema repair 或已安装版本直升保护。
- [ ] 不把 `docs/archive/*` 当默认执行依据。
- [ ] 不创建分支、PR、关闭 issue 或推送远端，除非用户另行明确要求。

---

## 4. 总体执行顺序

按风险从高到低推进：

1. 先加 guard，确保新问题不会继续进来。
2. 再修复 guard 暴露出的已知漏网点。
3. 再收 SQLite 写权限和 IPC/平台权限面。
4. 再补 TypeScript 静态质量门槛。
5. 再拆解热点文件，避免在未设门禁时做大重构。
6. 最后补文档、跑完整验证、复评打分。

每个阶段必须遵守：

- [ ] 先判断 owner。
- [ ] 先定义允许修改层。
- [ ] 先定义禁止扩散层。
- [ ] 每阶段完成后运行该阶段最小验证。
- [ ] 不把临时兼容层写成新主路径。

---

## 5. 阶段 A - 基线冻结与风险登记

### A1. 冻结执行前事实

- [ ] 运行 `git status --short`。
- [ ] 运行 `npm run quality:hotspots`。
- [ ] 运行 `npm run check:architecture`。
- [ ] 运行 `npm run check:naming`。
- [ ] 运行 `npm run check:rust-boundaries`。
- [ ] 运行 `cargo fmt --manifest-path src-tauri/Cargo.toml --check`。
- [ ] 如环境允许，运行 `npm run check:full`。

验收：

- [ ] 当前工作区没有无关改动。
- [ ] 当前轻量边界检查通过。
- [ ] 如果 `check:full` 失败，原因已分类为代码失败或 sandbox 环境失败。

### A2. 建立问题登记表

在本执行单后续执行记录中维护以下表格：

| ID | 问题 | owner | 风险 | 状态 | 验证 |
| --- | --- | --- | --- | --- | --- |
| Q95-01 | `app/widget` 直接 import Tauri `invoke` | frontend platform/desktop | app 层平台细节泄漏 | 未开始 | 待补 |
| Q95-02 | Rust `app/tray.rs` 直接持有 SQL pool 和 data repo | rust data + app/tray | app 层数据细节泄漏 | 未开始 | 待补 |
| Q95-03 | main window `sql:allow-execute` 权限面偏大 | platform/persistence + Tauri capability | 数据写权限面过大 | 未开始 | 待补 |
| Q95-04 | tests/scripts 未纳入统一 TypeScript typecheck | scripts/tests infra | 静态保护不足 | 未开始 | 待补 |
| Q95-05 | 高风险热点文件偏厚 | 各真实 owner | 小修回流概率高 | 未开始 | 待补 |

- [ ] 发现新问题时追加到表格。
- [ ] 每个问题必须有 owner，不允许写“全局”或“公共”。

---

## 6. 阶段 B - 补强自动化边界门禁

### B1. 前端 guard：禁止 `src/app/**` 直连 Tauri API

第一性判断：

- `@tauri-apps/api` 是外部运行时边界。
- 外部运行时边界属于 `src/platform/*`。
- `src/app/*` 可以编排 platform gateway，但不能自己实现 gateway。

允许修改：

- [ ] `scripts/check-architecture-boundaries.ts`
- [ ] 相关 self-test fixture
- [ ] 必要时新增少量允许例外注释机制，但默认不建议

禁止修改：

- [ ] 不在 `src/app/*` 新增平台 gateway。
- [ ] 不把 gateway 放入 `shared/*`。
- [ ] 不因为 guard 新增而大范围搬迁 feature 代码。

具体步骤：

- [ ] 在 `check-architecture-boundaries.ts` 中新增 `app-no-tauri-api` 规则。
- [ ] 扫描 `src/app/**` 中 `.ts` / `.tsx` 文件。
- [ ] 若非 `src/app` 的测试 fixture，出现 `@tauri-apps/api` import 即报错。
- [ ] 新增 self-test：`src/app/widget/badGateway.ts` import `@tauri-apps/api/core` 应失败。
- [ ] 新增 self-test：`src/platform/desktop/goodGateway.ts` import `@tauri-apps/api/core` 应通过。
- [ ] 保留现有 feature UI direct Tauri guard。
- [ ] 保留现有 app shell persistence guard。

最小验证：

```powershell
node --experimental-strip-types scripts/check-architecture-boundaries.ts --self-test
npm run check:architecture
```

验收：

- [ ] `src/app/widget/widgetIconService.ts` 在修复前能被新 guard 抓住。
- [ ] 修复后 `npm run check:architecture` 通过。

### B2. Rust guard：禁止 `app/*` 直接依赖 data repo 和 SQL pool

第一性判断：

- `app/*` 是 Tauri app 生命周期与协调层。
- SQLite pool 和 repository 是 `data/*` 所有。
- `app/*` 可以调用一个薄 data/engine service，但不应持有 pool 或 repository 细节。

允许修改：

- [ ] `scripts/check-rust-boundaries.ts`
- [ ] 相关 self-test fixture

禁止修改：

- [ ] 不把 data repo 调用搬到 `commands/*`。
- [ ] 不让 `platform/*` 依赖 `data/*`。
- [ ] 不让 `domain/*` 依赖 `data/*` 或 `platform/*`。

具体步骤：

- [ ] 新增 `app-no-data-repository-import` 规则，阻止 `src-tauri/src/app/**` 生产代码 import `crate::data::repositories`.
- [ ] 新增 `app-no-sqlite-pool-type` 规则，阻止 `src-tauri/src/app/**` 生产代码使用 `Pool<Sqlite>`、`SqlitePool` 或 `sqlx::Pool<sqlx::Sqlite>`.
- [ ] 新增 `app-no-sqlite-pool-wait` 规则，阻止 `src-tauri/src/app/**` 生产代码调用 `wait_for_sqlite_pool`.
- [ ] 测试模块可以例外，但例外必须只在 `#[cfg(test)] mod tests` 内。
- [ ] 更新 self-test：app 文件 import repo、pool type、wait_for_sqlite_pool 应失败。
- [ ] 更新 self-test：data 文件使用 pool 应通过。
- [ ] 更新 self-test：app 测试模块中 `SqlitePool` 可通过。

最小验证：

```powershell
node --experimental-strip-types scripts/check-rust-boundaries.ts --self-test
npm run check:rust-boundaries
```

验收：

- [ ] `src-tauri/src/app/tray.rs` 在修复前能被新 guard 抓住。
- [ ] 修复后 `npm run check:rust-boundaries` 通过。

### B3. Capability guard：阻止 widget 权限回流，并登记 main write 权限状态

第一性判断：

- Tauri capability 是运行时权限边界。
- 权限边界不应只靠人工记忆。
- Widget 已经是较小权限面，应防回流。
- Main window 的 `sql:allow-execute` 是已知风险，若暂时保留，必须被显式登记为待收口状态。

允许修改：

- [ ] `scripts/check-architecture-boundaries.ts` 或新增专门 capability check
- [ ] `package.json` 脚本接线
- [ ] capability self-test

具体步骤：

- [ ] 保留现有 widget 不允许 `sql:allow-execute` 的检查。
- [ ] 新增 main capability 状态检查：如果 main 仍包含 `sql:allow-execute`，输出明确 warning 或 failure。
- [ ] 推荐目标：先以 failure 接入独立命令 `check:capabilities:strict`，待阶段 D 完成后接入 `check:architecture`。
- [ ] 如果短期无法移除 main `sql:allow-execute`，必须在执行记录中写明具体剩余 frontend write callsites。

验收：

- [ ] Widget 权限回流会失败。
- [ ] Main write 权限不是隐形事实。

---

## 7. 阶段 C - 修复已知边界漏网点

### C1. 收口 `app/widget` 的 Tauri icon invoke

当前问题：

```text
src/app/widget/widgetIconService.ts
  import { invoke } from "@tauri-apps/api/core";
```

owner 判断：

- Widget UI 与缓存策略可以留在 `src/app/widget`.
- Tauri command 调用属于 `src/platform/desktop` 或 `src/platform/runtime`.
- `cmd_get_widget_icon` 表达桌面窗口/icon 运行时能力，更适合 `src/platform/desktop`.

推荐落点：

- [ ] 新增或扩展 `src/platform/desktop/widgetRuntimeGateway.ts`
- [ ] 暴露 `loadWidgetIconFromRuntime(exeName: string): Promise<string | null>`
- [ ] `src/app/widget/widgetIconService.ts` 只依赖该 gateway 或注入 deps

具体步骤：

- [ ] 在 platform gateway 中新增 `getWidgetIcon` 函数。
- [ ] 从 `widgetIconService.ts` 删除 `@tauri-apps/api/core` import。
- [ ] 保持 `WidgetIconServiceDeps` 注入接口，避免测试绑定真实 runtime。
- [ ] 更新 `tests/widgetViewModel.test.ts` 或相关测试，确认缓存、失败重试、容量限制不变。
- [ ] 运行新前端 guard，确认 app 直连 Tauri 被拦。

最小验证：

```powershell
npm run test:widget
npm run check:architecture
```

验收：

- [ ] `rg -n '@tauri-apps/api|invoke\\(' src/app -g '*.ts' -g '*.tsx'` 无生产命中。
- [ ] Widget 图标缓存行为不变。
- [ ] `npm run test:widget` 通过。

### C2. 收口 `app/tray.rs` 的 tracking pause 持久化

当前问题：

```text
src-tauri/src/app/tray.rs
  use crate::data::repositories::tracker_settings;
  use crate::data::sqlite_pool::wait_for_sqlite_pool;
  use sqlx::{Pool, Sqlite};
```

owner 判断：

- Tray 菜单与窗口 close 行为属于 `app/tray.rs`。
- Tracking pause setting 的 SQLite 读写属于 `data/*`。
- Pause runtime state 同步和 tracking data changed event 属于 app/engine 协调。
- `app/tray.rs` 不应知道 SQL pool 或 repository。

推荐落点：

- [ ] 优先新增 `src-tauri/src/data/tracking_pause_service.rs`，或扩展现有合适 data service。
- [ ] 该 service 暴露：

```rust
pub struct TrackingPauseSettingChange {
    pub tracking_paused: bool,
    pub reason: &'static str,
}

pub async fn toggle_tracking_pause_setting<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<TrackingPauseSettingChange, String>

pub async fn load_tracking_pause_setting<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<bool, String>
```

注意：实际签名可按仓库现有泛型风格调整，但 `app/tray.rs` 不应持有 pool。

具体步骤：

- [ ] 在 data owner 中封装 `wait_for_sqlite_pool + tracker_settings`。
- [ ] 将 `toggle_tracking_paused_in_pool` 从 `app/tray.rs` 移出或改为 data 层私有/测试用函数。
- [ ] `app/tray.rs::toggle_tracking_paused` 只调用 data service，拿到 `TrackingPauseSettingChange` 后更新 runtime state、菜单 label、emit event。
- [ ] `app/tray.rs::setup_tray` 只调用 data service load 函数。
- [ ] 将原 tray 单测迁到 data service 测试，或保留 tray 行为测试但不暴露 pool helper。
- [ ] 保持 `tracking_pause_event_reason` 语义不变，除非 owner 判断后迁入 domain/engine 更合理。

最小验证：

```powershell
npm run check:rust-boundaries
cargo test --manifest-path src-tauri/Cargo.toml --quiet tray
cargo test --manifest-path src-tauri/Cargo.toml --quiet tracker_settings
```

验收：

- [ ] `rg -n 'wait_for_sqlite_pool|tracker_settings|Pool<Sqlite>|SqlitePool|crate::data::repositories' src-tauri/src/app -g '*.rs'` 无生产违规命中。
- [ ] Tray pause/resume 文案与 event reason 不变。
- [ ] Existing Rust tests 通过。

### C3. 检查 `commands/storage.rs` 的平台细节

当前观察：

- `commands/storage.rs` 包含 `install_dir()` 与 `open_directory()`。
- 这不是最高风险，但 command 层含平台细节。

owner 判断：

- 文件选择器 command 可以作为 IPC 入口。
- 打开目录属于 platform/desktop 或 platform/storage 边界。
- 解析安装目录属于 platform app paths/storage paths。

执行原则：

- [ ] 如果本阶段没有触碰 storage command，不强行拆。
- [ ] 如果后续改 storage command，应把 `open_directory` 和 `install_dir` 收到 platform owner。
- [ ] 不在 command 层新增更多平台实现。

验收：

- [ ] 新增 guard 或 review checklist 覆盖 command 层平台细节增长。

---

## 8. 阶段 D - 收口 SQLite 写权限面

### D1. 列出所有前端写路径

第一性判断：

- 当前架构允许前端受控 SQLite 通道。
- 但 Tauri capability 层的 `sql:allow-execute` 是宽权限。
- 若要 9.5+，写权限必须从“宽 capability + 代码约束”推进到“命令化写侧 + capability 最小化”，或至少具备严格 allowlist 和自动门禁。

具体步骤：

- [ ] 运行：

```powershell
rg -n 'executeWrite|executeWriteBatch|\\.execute\\(|INSERT |UPDATE |DELETE |CREATE |DROP |ALTER ' src/platform src/app src/features src/shared -g '*.ts' -g '*.tsx'
```

- [ ] 将所有写路径分类：

| 写路径 | 当前文件 | 真实 owner | 是否已有 Rust command | 目标 |
| --- | --- | --- | --- | --- |
| app settings commit | `platform/persistence/appSettingsStore.ts` | Rust data/app settings | 有 | 移除 direct SQL fallback |
| classification settings commit | `platform/persistence/classificationSettingsGateway.ts` | Rust data/classification | 有 | 移除 direct SQL fallback |
| cleanup sessions/titles/web activity | `settingsPersistence.ts` | Rust data cleanup | 待确认 | command 化 |
| classification session deletion | `classificationPersistence.ts` | Rust data/classification/session cleanup | 待确认 | command 化 |
| data bootstrap snapshot | `dataBootstrapSnapshotStore.ts` | 前端 cache persistence | 待判断 | 可保留或 command 化 |
| remote backup settings | `remoteBackupSettingsStore.ts` | settings persistence | 待确认 | command 化或 allowlist |

- [ ] 对每个写路径判断：是否影响用户数据、是否需要事务、是否属于设置、是否属于清理/删除。

### D2. 优先迁移高风险写路径到 Rust command

优先级：

1. 删除或清理数据的写路径。
2. settings/classification 批量 commit。
3. remote backup 配置。
4. 低风险缓存类写入。

具体步骤：

- [ ] 对 cleanup/delete 类写路径新增 Rust command，写侧进入 `data/*`。
- [ ] 前端 platform gateway 调用 command，不直接拼 SQL。
- [ ] 保持 feature components/hooks 不直接访问 command。
- [ ] 为每个 command 增加 Rust 单元测试或前端服务测试。
- [ ] 对失败恢复路径保留用户可解释错误。

验收：

- [ ] 用户数据删除类操作不再依赖 frontend `sql:allow-execute`。
- [ ] settings/classification commit 不再需要 direct SQL fallback。
- [ ] `test:persistence` 覆盖 fallback 逻辑调整后的新契约。

### D3. 移除或隔离 main `sql:allow-execute`

目标优先级：

1. 最佳目标：从 `src-tauri/capabilities/default.json` 移除 `sql:allow-execute`。
2. 次优目标：只保留 read-only SQL capability，所有 writes 通过 Rust commands。
3. 临时目标：若仍有必要保留 execute，必须有 allowlist guard 和剩余 callsite 解释，不能声称 9.5+。

具体步骤：

- [ ] 确认 `src/platform/persistence/sqlite.ts::executeWrite` 无生产调用，或只被明确 allowlist 调用。
- [ ] 移除 `default.json` 的 `sql:allow-execute`。
- [ ] 运行真实浏览器 smoke，确认 main UI 可启动。
- [ ] 运行 settings、classification、data、persistence、interaction 测试。
- [ ] 更新 architecture/capability guard，让 main execute 回流失败。

最小验证：

```powershell
npm run test:persistence
npm run test:settings
npm run test:classification
npm run test:interaction
npm run test:ui-browser-smoke
npm run check:architecture
```

验收：

- [ ] `src-tauri/capabilities/default.json` 不包含 `sql:allow-execute`。
- [ ] `npm run check:architecture` 会阻止 main execute 回流。
- [ ] 所有用户可触发写路径仍能通过测试。

---

## 9. 阶段 E - 补足 TypeScript 静态质量门槛

### E1. 明确当前缺口

当前：

- `tsconfig.json` 只 include `src`。
- `tsconfig.node.json` 只 include `vite.config.ts`。
- `tests/*.ts` 和 `scripts/**/*.ts` 主要通过 `node --experimental-strip-types` 运行。

风险：

- 运行到的测试有保障。
- 未运行的测试/脚本类型错误可能被漏掉。
- 脚本 API 漂移可能要到执行时才爆。

### E2. 新增脚本/测试 typecheck 配置

允许修改：

- [ ] `tsconfig.scripts.json`
- [ ] `tsconfig.tests.json`
- [ ] `package.json`
- [ ] 必要的测试/脚本类型修复

禁止修改：

- [ ] 不为通过 typecheck 大范围改业务逻辑。
- [ ] 不引入无关格式化 churn。

具体步骤：

- [ ] 评估是否需要新增 `@types/node`。如果需要，作为 devDependency 明确加入。
- [ ] 新增 `tsconfig.scripts.json`，include `scripts/**/*.ts`。
- [ ] 新增 `tsconfig.tests.json`，include `tests/**/*.ts`。
- [ ] 使用 `noEmit: true`。
- [ ] 尽量开启与 `tsconfig.json` 一致的 strict 规则。
- [ ] 如果测试依赖运行时 stub，优先补类型声明，不把类型改成 `any`。
- [ ] 在 `package.json` 新增 `check:types`。
- [ ] 将 `check:types` 接入 `npm run check`，位置建议在边界检查之后、测试之前。

推荐命令：

```json
"check:types": "tsc -p tsconfig.json --noEmit && tsc -p tsconfig.node.json --noEmit && tsc -p tsconfig.scripts.json --noEmit && tsc -p tsconfig.tests.json --noEmit"
```

验收：

- [ ] `npm run check:types` 通过。
- [ ] `npm run check` 包含 `check:types`。
- [ ] 没有为了过类型检查引入宽泛 `any` 债。

### E3. 评估前端 lint/format

当前仓库没有通用 ESLint/Prettier/Biome gate。9.5+ 不一定必须引入完整 lint，但必须有明确判断。

执行步骤：

- [ ] 评估引入 Biome 或 ESLint 的收益与 churn。
- [ ] 如果引入会造成大规模无关 diff，先不接入格式化。
- [ ] 至少补一个低噪声 lint gate，覆盖明显风险规则：
  - 禁止未处理 promise 或明确 `void`
  - 禁止 `@ts-ignore`
  - 限制 `any`
  - 禁止 direct Tauri/API/SQL 越界
- [ ] 如果不引入通用 lint，必须在最终复评中说明替代保护是什么。

验收：

- [ ] 前端静态质量门槛比当前更强。
- [ ] 没有制造格式化噪音。

---

## 10. 阶段 F - 热点文件降风险

原则：

- 不追求一次性消灭所有大文件。
- 先处理高频、高风险、owner 清晰的热点。
- 每个热点只做“真实风险降低”的拆解。
- 拆解必须附带测试或现有测试覆盖证明。

### F1. 建立热点优先级

当前热点候选：

| 文件 | 风险类型 | 推荐处理 |
| --- | --- | --- |
| `src/features/history/components/History.tsx` | UI 编排厚，容易混入 view model | 抽出 feature hook / controller，不动 read model |
| `src/features/data/services/dataReadModel.ts` | 读模型复杂，统计正确性敏感 | 拆纯函数与 cache/aggregation 边界 |
| `src/features/classification/hooks/useAppMappingState.ts` | 状态机厚，保存/dirty/edit 易回归 | 拆 interaction reducer 或 service helpers |
| `src-tauri/src/data/sqlite_pool.rs` | migration/repair/初始化混杂，升级链敏感 | 只拆测试辅助或 schema repair 子模块，不删 repair |
| `src-tauri/src/data/storage_migration.rs` | 数据迁移高风险 | 先补测试和命名边界，谨慎拆 |
| `src-tauri/src/engine/tracking/runtime.rs` | tracking 主链核心 | 不大拆，优先守 runtime 子模块边界 |
| `src-tauri/src/engine/tools/mod.rs` | tools runtime 编排偏厚 | 抽 wake/alert/tick 小 owner |

- [ ] 重新运行 `npm run quality:hotspots`。
- [ ] 选出第一轮最多 5 个热点。
- [ ] 每个热点写明 owner、风险、非目标。

### F2. `History.tsx` 降风险

目标：

- 页面保留渲染和事件接线。
- 日期、加载、refresh、timeline dialog 状态进入 feature-owned hook/service。

步骤：

- [ ] 标记 `History.tsx` 中的状态种类：date、loading、timeline dialog、chart mode、refresh。
- [ ] 判断哪些是纯 UI state，哪些是 feature workflow。
- [ ] 新增 `features/history/hooks/useHistoryPageState.ts` 或扩展现有 owner。
- [ ] 每次只迁出一种状态。
- [ ] 迁出后运行 history 相关测试。

验证：

```powershell
npm run test:history-timeline
npm run test:ui-smoke
npm run test:ui-browser-smoke
```

验收：

- [ ] `History.tsx` 行数和认知复杂度下降。
- [ ] History navigation、timeline dialog、title details、hourly chart smoke 仍通过。

### F3. `dataReadModel.ts` 降风险

目标：

- 保留 Data read model owner。
- 把纯 aggregation、cache、range mapping 拆成同 feature service。
- 不把 Data 私有逻辑塞进 `shared/*`。

步骤：

- [ ] 列出文件中的纯函数和副作用函数。
- [ ] 将纯 aggregation 移到 `features/data/services/*`。
- [ ] 保持 public API 稳定，避免 AppShell 和 tests 大改。
- [ ] 对每次迁移运行 data tests。

验证：

```powershell
npm run test:data
npm run test:data-range
npm run test:data-chart
```

验收：

- [ ] Data 统计结果测试全部通过。
- [ ] 没有新增 `shared/*` 临时桶。

### F4. `useAppMappingState.ts` 降风险

目标：

- 保存、dirty、edit、delete flow 更可测。
- UI hook 不承载过多业务规则。

步骤：

- [ ] 标记 hook 中的 derived state、mutation flow、persistence flow。
- [ ] 将纯状态转换移入 `classificationDraftState.ts` 或现有 interaction helper。
- [ ] 将 persistence workflow 保持在 feature services，不下沉到 shared。
- [ ] 保持现有 `classificationDraftState` 测试扩展。

验证：

```powershell
npm run test:classification
npm run test:interaction
```

验收：

- [ ] App Mapping 保存/取消/删除行为不变。
- [ ] Dirty state 测试覆盖迁出逻辑。

### F5. Rust migration/pool 热点降风险

原则：

- 不删除 legacy schema repair。
- 不压缩 migration 除非有专门升级测试。
- 优先拆测试辅助、schema probe、repair helpers。

步骤：

- [ ] 在 `sqlite_pool.rs` 中标记：pool 初始化、schema repair、migration baseline、tests。
- [ ] 找出可以移入 `data/schema.rs` 或 `data/sqlite_pool/*` 子模块的纯 helper。
- [ ] 如果新增子模块，保持 `data/*` owner，不跨到 `app/*`。
- [ ] 每次迁移运行 targeted Rust tests。

验证：

```powershell
cargo test --manifest-path src-tauri/Cargo.toml --quiet sqlite_pool
cargo test --manifest-path src-tauri/Cargo.toml --quiet storage_migration
npm run check:rust
```

验收：

- [ ] 旧版本数据库直升保护测试仍通过。
- [ ] `_sqlx_migrations` 归一化行为不变。

### F6. Tracking runtime 热点降风险

原则：

- Tracking runtime 是最高可信度路径，不做为了行数的重构。
- 只在现有 owner 子模块附近移动明确细节。

步骤：

- [ ] 标记 `runtime.rs` 中仍可迁入 `runtime/loop_state.rs`、`power_lifecycle.rs`、`window_polling.rs`、`support.rs` 的逻辑。
- [ ] 一次只迁移一个纯 helper 或一个明确流程片段。
- [ ] 每次迁移运行 tracking lifecycle/replay/Rust tracking tests。

验证：

```powershell
npm test
npm run test:replay
cargo test --manifest-path src-tauri/Cargo.toml --quiet tracking
npm run check:rust
```

验收：

- [ ] 会话切分、AFK、startup sealing、power lifecycle 行为不变。
- [ ] Runtime 主循环仍是编排，不回流成超厚入口。

---

## 11. 阶段 G - 性能和 bundle 证据

### G1. 运行现有性能脚本

第一性判断：

- 性能优化必须有场景和可比较依据。
- 不用平均值掩盖 p95/max 尖刺。
- 不为降低资源数字牺牲 tracking 可信度或 UI 手感。

执行：

- [x] `npm run perf:history-read-model`
- [x] `npm run perf:dashboard-read-model`
- [x] `npm run perf:data-read-model`
- [x] `npm run perf:data-history-browser`
- [x] `npm run perf:sqlite-query-plan`
- [x] `npm run perf:startup-bootstrap`
- [x] `npm run check:bundle`

验收：

- [x] 所有性能脚本通过预算。
- [x] 如失败，先判断是数据形状、预算漂移还是真实性能回归。
- [x] 不把 `perf:data-history-browser` 误写成真实 SQLite I/O 证据。

### G2. Bundle 预算复核

执行：

- [ ] 检查 `check:bundle` 输出的 initial、lazy、total gzip。
- [ ] 如果新增依赖导致 chunk 变大，解释收益和替代方案。
- [ ] 不为小工具引入重依赖。

验收：

- [ ] `npm run check:bundle` 通过。
- [ ] 关键 chunk 没有无解释增长。

---

## 12. 阶段 H - 文档与长期规则回写

### H1. 回写自动化门禁规则

如果阶段 B/D/E 引入了长期规则，回写：

- [ ] `docs/architecture.md`
- [ ] `docs/engineering-quality.md`
- [ ] 必要时 `docs/issue-fix-boundary-guardrails.md`

回写内容必须是长期规则，不是执行流水账。

### H2. 更新文档卫生

- [ ] 本执行单完成后移入 `docs/archive/`。
- [ ] 不把完成记录继续留在 top-level `docs/`。
- [ ] 不从 archive 反向重建当前长期文档。

### H3. 更新 PR/协作提示

如新增 gate：

- [ ] 更新 `.github/pull_request_template.md` 的 validation checklist。
- [ ] 必要时更新 `CONTRIBUTING.md`。

验收：

- [ ] 文档规则与实际脚本一致。
- [ ] CI gate 与本地推荐命令一致。

---

## 13. 最终验证门槛

必须通过：

```powershell
npm run check:architecture
npm run check:naming
npm run check:rust-boundaries
npm run check:types
npm run check
npm run check:rust
npm run check:full
npm run release:check
cargo fmt --manifest-path src-tauri/Cargo.toml --check
```

性能复核：

```powershell
npm run perf:history-read-model
npm run perf:dashboard-read-model
npm run perf:data-read-model
npm run perf:data-history-browser
npm run perf:sqlite-query-plan
npm run perf:startup-bootstrap
```

如 `npm run check:full` 或 `release:check` 在 sandbox 下因 Vite/esbuild/browser spawn 出现 `EPERM`：

- [x] 记录 sandbox 失败。
- [x] 使用提升权限重跑同一命令。
- [x] 最终结果以提升权限重跑结果为准。

---

## 14. 9.5+ 验收评分表

最终复评时逐项打分：

| 维度 | 目标分 | 必须证据 |
| --- | ---: | --- |
| 架构边界 | 9.5+ | 已知漏网点修复；新 guard 能复现并阻止同类问题 |
| 工程质量 | 9.4+ | TS scripts/tests typecheck；热点降风险；无格式债 |
| 可靠性与验证 | 9.6+ | `check:full`、`release:check`、Rust tests、browser smoke 通过 |
| 数据/权限边界 | 9.3+ | main `sql:allow-execute` 移除，或剩余风险被严格 allowlist 且说明为什么暂不扣到 9.5 以下 |
| 长期可维护性 | 9.4+ | 高吸力层没有新增厚逻辑；热点有 owner 和 guard |

综合 9.5+ 的最低条件：

- [x] `src/app/**` 没有 direct Tauri API import。
- [x] `src-tauri/src/app/**` 生产代码没有 direct repository/pool/wait_for_sqlite_pool。
- [x] `src-tauri/capabilities/widget.json` 不含 write SQL 权限。
- [x] `src-tauri/capabilities/default.json` 不含 `sql:allow-execute`。
- [x] `npm run check:full` 通过。
- [x] `npm run release:check` 通过。
- [x] Rust `cargo fmt --check` 通过。
- [x] 新增 guard 的 self-test 通过。
- [x] 前端 tests/scripts 已有 typecheck gate。
- [x] 至少 3 个最高风险热点完成降风险，或已建立增长失败门禁。

如果 main `sql:allow-execute` 仍保留，默认最高综合分为 **9.2**，除非有更强的细粒度运行时 allowlist 或 capability 等价控制。

---

## 15. 停止条件

出现以下情况，停止当前小步实施并重新做边界判断：

- [ ] 需要新增 `shared/*`，但说不清稳定共享语义。
- [ ] 需要让页面组件直接访问 platform、SQLite 或 Tauri。
- [ ] 需要让 `commands/*`、`app/*`、`lib.rs` 承接新业务流程。
- [ ] 需要删除 migration、repair、升级保护来换取文件变短。
- [ ] 某个 guard 修改导致大量误报，且误报无法用 owner 解释。
- [ ] `check:full` 失败且不是 sandbox 环境问题。
- [ ] 性能优化要求牺牲 tracking 可信度或用户可解释性。

---

## 16. 推荐提交切分

推荐按可验证边界切分提交：

1. `test: tighten architecture boundary guards`
2. `refactor: move widget icon runtime access behind platform gateway`
3. `refactor: move tray tracking pause persistence to data owner`
4. `refactor: route frontend sqlite writes through rust commands`
5. `test: add typescript checks for scripts and tests`
6. `refactor: reduce high-risk read model and page hotspots`
7. `docs: update engineering quality gates`

提交说明不要使用 `Closes`、`Fixes`、`Resolves`，除非用户明确要求关闭 issue。

---

## 17. 执行记录

### 2026-07-04

- [x] 创建本执行单。
- [x] 阶段 A 完成：确认执行前真实评分基线为 **8.4 / 10**，并运行初始架构、命名、Rust boundary、格式与热点检查。
- [x] 阶段 B 完成：`check:architecture` 新增 `src/app/**` direct Tauri API 禁止规则、前端生产 SQL write 禁止规则、main capability `sql:allow-execute` 禁止规则；`check:rust-boundaries` 新增 Rust `app/**` data repository / SQLite pool 禁止规则。
- [x] 阶段 C 完成：`widgetIconService` 改经 `platform/desktop/widgetRuntimeGateway` 访问 Tauri runtime；Rust tray pause persistence 迁入 data owner。
- [x] 阶段 D 完成：前端生产 SQL 写入迁入 typed Rust persistence commands；`default.json` 移除 `sql:allow-execute`；生成 capability schema 同步。
- [x] 阶段 E 完成：新增 `tsconfig.quality.json`；`check:types` 覆盖 `scripts/**/*.ts` 与 `tests/**/*.ts`；`npm run check` 接入 typecheck、architecture、hotspots、frontend 全链路。
- [x] 阶段 F 完成：建立最高风险热点增长预算门禁 `check:hotspots`，防止已知大文件继续无意识变厚。
- [x] 阶段 G 完成：全部现有 perf 脚本通过预算；其中 `perf:data-history-browser` 仅作为浏览器渲染/导航路径证据，不当作真实 SQLite I/O 证据。
- [x] 阶段 H 完成：长期规则回写到 `docs/architecture.md` 与 `docs/engineering-quality.md`；本执行单移入 `docs/archive/`。

最终验证：

- [x] `npm run check:architecture` passed。
- [x] `npm run check:naming` passed。
- [x] `npm run check:rust-boundaries` passed。
- [x] `cargo fmt --manifest-path src-tauri/Cargo.toml --check` passed。
- [x] `npm run check:types` passed。
- [x] `npm run test:persistence` passed。
- [x] `cargo check --manifest-path src-tauri/Cargo.toml --quiet` passed。
- [x] `npm run check:rust` passed：Rust tests 为 304 passed / 1 ignored，clippy `-D warnings` passed。
- [x] `npm run check:full` passed。
- [x] `npm run release:check` passed。

性能验证：

- [x] `perf:history-read-model` passed：current history read model average 61.82 ms / budget 170 ms。
- [x] `perf:dashboard-read-model` passed：average 24.28 ms / budget 25 ms。
- [x] `perf:data-read-model` passed：所有 7d / 365d / heatmap 测量均在预算内。
- [x] `perf:data-history-browser` passed：所有浏览器导航/渲染测量均在预算内，console error 为 0。
- [x] `perf:sqlite-query-plan` passed：核心 sessions 与 title samples 查询走索引；web activity 当前基线有临时排序点但无 table scan。
- [x] `perf:startup-bootstrap` passed：average 0.004 ms / budget 1.5 ms。

最终结论：

- [x] 目标 **9.5+** 已达成，最终真实评分 **9.6 / 10**。
- [x] 本执行单已归档，后续长期规则以 top-level `docs/architecture.md` 与 `docs/engineering-quality.md` 为准。
