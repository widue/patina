# 架构与工程质量 9+ 可勾选执行文档

> 状态：已完成并归档  
> 文档类型：How-to / execution plan  
> 目标读者：后续维护者、仓库协作者、仓库感知代理  
> 创建日期：2026-05-16  
> 位置：`docs/archive/architecture-engineering-quality-9-plus-execution-plan-2026-05-16.md`  
> 基线评分：综合 `8.2 / 10`  
> 目标评分：综合 `9.0+ / 10`

本文是一次性执行计划，不是长期规则文档。执行完成后，应把仍然有效的长期规则回写到对应顶层文档，再将本文移入 `docs/archive/`。

## 执行完成记录

- 完成时间：2026-05-16
- SQLite 升级可信度：已补旧库预修复，缺少 `continuity_group_start_time` 的历史 `sessions` 表会在 migration history 归一化前自动补列并回填；相关 Rust 局部测试通过。
- 架构门禁：已扩展 `check:architecture`、`check:naming`，新增 `check:rust-boundaries` 并接入 `npm run check:rust` / `npm run check:full`。
- tracking domain：已拆分 `process_filters.rs`、`sustained_identity.rs`、`status_resolution.rs`，`tracking.rs` 保留为薄聚合出口。
- 发布与文档事实：已更新 `src-tauri/Cargo.toml` 元数据、README 备份恢复事实、CHANGELOG、`docs/engineering-quality.md` 与 `docs/architecture.md`。
- 完整验证：`npm run check:full` 通过；三个性能预算脚本均在预算内；`npm run release:validate-changelog -- 0.6.7` 通过。
- 最终评分：综合 `9.1 / 10`。数据安全与升级可信度 `9.1`，可靠性与验证 `9.2`，架构边界 `9.1`，可维护性 `8.9`，性能治理 `8.6`。

---

## 1. 执行前提

- [ ] 已阅读并以以下顶层文档为准：
  - [ ] `docs/product-principles-and-scope.md`
  - [ ] `docs/roadmap-and-prioritization.md`
  - [ ] `docs/engineering-quality.md`
  - [ ] `docs/architecture.md`
  - [ ] `docs/quiet-pro-component-guidelines.md`
  - [ ] `docs/issue-fix-boundary-guardrails.md`
  - [ ] `docs/versioning-and-release-policy.md`
- [ ] 已确认本文只用于本轮执行，不作为新的长期母文档。
- [ ] 已确认本轮目标不是新增产品功能，而是提升可信度、边界防线、可维护性和验证证据。
- [ ] 已确认不做一次性全仓库重构。
- [ ] 已确认不把 `docs/archive/*` 当作默认执行依据；历史计划只作为背景，不覆盖当前顶层文档。
- [ ] 已记录执行前 `git status --short`，避免误改或误回滚既有工作区变更。

### 1.1 当前真实基线

本轮基线来自 2026-05-16 的架构与工程质量审查。

- [ ] 综合评分基线：`8.2 / 10`
- [ ] 架构边界基线：`8.3 / 10`
- [ ] 验证与可靠性工程基线：`8.6 / 10`
- [ ] 数据安全 / 升级可信度基线：`7.6 / 10`
- [ ] 可维护性基线：`8.1 / 10`
- [ ] 性能治理基线：`8.5 / 10`

### 1.2 当前正面证据

- [ ] `npm run check:full` 已在 2026-05-16 通过。
- [ ] 前端命名边界检查已通过。
- [ ] 前端架构边界检查已通过。
- [ ] 全部前端测试、UI smoke、浏览器 smoke 已通过。
- [ ] 生产构建与 bundle 预算已通过。
- [ ] Rust `cargo check` 已通过。
- [ ] Rust 测试已通过：`120 passed`。
- [ ] Rust `cargo clippy -- -D warnings` 已通过。
- [ ] 性能脚本均在预算内：
  - [ ] `perf:history-read-model` 当前完整读模型约 `71.05ms`，预算 `170ms`。
  - [ ] `perf:dashboard-read-model` 当前约 `19.31ms`，预算 `25ms`。
  - [ ] `perf:startup-bootstrap` 当前约 `0.003ms`，预算 `1.5ms`。

### 1.3 当前主要扣分项

- [ ] 数据升级链存在直升风险：`0.6.7` 当前压缩为当前 schema 基线，但旧 schema 缺 `continuity_group_start_time` 时不会被归一化。
- [ ] 架构自动化门禁覆盖弱于长期文档要求：当前 `check:architecture` 主要扫描 `src/features` 与 `src/shared`，未充分覆盖前端 `app/*`、`platform/*` 方向性和 Rust 高吸力层。
- [ ] `src-tauri/src/domain/tracking.rs` 仍是下一个语义聚集点，承担过多 tracking domain 决策。
- [ ] 发布元数据仍有模板痕迹：`src-tauri/Cargo.toml` 中 `description = "A Tauri App"`、`authors = ["you"]`。

---

## 2. 9+ 验收定义

本轮不得只凭“代码更顺眼”宣布 9+。必须同时满足以下硬条件。

### 2.1 必须完成

- [ ] 数据升级链达到 9+ 要求：
  - [ ] 新安装仍可走当前压缩基线。
  - [ ] 已安装旧版本数据库可安全升级到当前版本。
  - [ ] 旧 schema 数据不会因为缺列、迁移历史变化或基线压缩而启动失败。
  - [ ] 相关行为有 Rust 自动化测试覆盖。
- [ ] 架构门禁达到 9+ 要求：
  - [ ] 前端边界检查覆盖 `app / features / shared / platform` 的关键方向规则。
  - [ ] Rust 高吸力层有轻量门禁或等价自动化检查，防止 SQL、平台细节、厚业务回流到 `commands/*`、`app/*`、`lib.rs`。
  - [ ] 所有新增门禁有 self-test 或专门测试样例。
- [ ] tracking domain 可维护性达到 9+ 要求：
  - [ ] `domain/tracking.rs` 不再承接全部 tracking 语义。
  - [ ] 进程过滤、持续参与身份、状态解析等 owner 清楚。
  - [ ] 现有对外 API 尽量稳定，调用方不被无收益扰动。
- [ ] 默认完整验证通过：
  - [ ] `npm run check:full`
  - [ ] `npm run perf:history-read-model`
  - [ ] `npm run perf:dashboard-read-model`
  - [ ] `npm run perf:startup-bootstrap`

### 2.2 不得发生

- [ ] 不恢复根层 `src/lib/*`。
- [ ] 不恢复根层 `src/types/*`。
- [ ] 不让 `shared/*` 承接新的平台、persistence 或 runtime 适配。
- [ ] 不让 `platform/*` 变成无 owner 的万能目录。
- [ ] 不让 Rust `commands/*` 或 `lib.rs` 承接厚业务逻辑。
- [ ] 不为了门禁好写而降低真实产品可靠性。
- [ ] 不为了压缩迁移而破坏用户本地数据安全。
- [ ] 不跳过失败的验证命令后仍宣布 9+。

---

## 3. 阶段 0：执行护栏与范围锁定

目标：先锁边界，避免本轮变成散漫重构。

- [ ] 运行并记录当前工作区状态：

```bash
git status --short
```

- [ ] 确认已有未提交变更的 owner：
  - [ ] `docs/working/compatibility-simplification-plan.md` 删除与 `docs/archive/compatibility-simplification-plan.md` 新增属于既有归档工作。
  - [ ] `src-tauri/src/data/schema.rs` 与 `src-tauri/src/data/migrations.rs` 替换属于既有 schema 压缩工作。
  - [ ] `src-tauri/src/app/*`、`src-tauri/src/data/*`、`src-tauri/src/engine/tracking/*` 的当前变更需要在本轮继续保护，不得误回滚。
- [ ] 确认本轮只允许触及以下范围：
  - [ ] `src-tauri/src/data/*`
  - [ ] `src-tauri/src/domain/tracking.rs`
  - [ ] `src-tauri/src/domain/tracking/*`
  - [ ] `src-tauri/src/engine/tracking/*` 的测试或必要调用适配
  - [ ] `scripts/check-*.ts`
  - [ ] `package.json`
  - [ ] `.github/workflows/*`，仅当新增门禁需要进入 CI
  - [ ] `src-tauri/Cargo.toml`
  - [ ] 必要的顶层长期文档回写
- [ ] 明确非目标：
  - [ ] 不调整 UI 视觉方向。
  - [ ] 不新增团队、云同步、账号或 AI 功能。
  - [ ] 不做大规模目录重排。
  - [ ] 不把历史 archive 计划重新搬回顶层 docs。

### 阶段 0 验收

- [ ] 执行范围清楚。
- [ ] 未提交变更归属清楚。
- [ ] 没有开始写代码前就扩大产品方向。

---

## 4. 阶段 1：补强 SQLite 升级可信度

目标：解决本轮最大扣分项，让数据升级链可以支撑 9+。

当前风险不是新安装，而是旧数据库直升当前版本时的兼容性。当前 `CURRENT_BASELINE_SCHEMA_SQL` 通过 `CREATE TABLE IF NOT EXISTS sessions (...)` 描述当前基线，但如果用户已有旧 `sessions` 表且缺少 `continuity_group_start_time`，`CREATE TABLE IF NOT EXISTS` 不会补列。后续查询或写入该列时可能失败。

### 4.1 明确升级策略

- [ ] 判断是否允许用户从 `0.6.4 / 0.6.5 / 0.6.6` 直接升级到当前版本。
- [ ] 如果允许直接升级，采用推荐策略 A。
- [ ] 如果不允许直接升级，必须有明确发布与 updater 策略证明用户不会直升；否则不得评为 9+。

推荐策略 A：

- [ ] 保留当前 schema 压缩基线，用于新安装。
- [ ] 在 Tauri SQL plugin migrations 运行前，加入独立的“旧数据库预修复”步骤。
- [ ] 预修复只做向前兼容的幂等操作：
  - [ ] 如果 `sessions` 表存在但缺 `continuity_group_start_time`，执行 `ALTER TABLE sessions ADD COLUMN continuity_group_start_time INTEGER`。
  - [ ] 将缺失的 `continuity_group_start_time` 回填为 `start_time`。
  - [ ] 保留或创建必要索引。
  - [ ] 保留旧 sessions/settings/icon_cache 数据。
  - [ ] 对多 active session 的异常状态继续执行既有封口或归一化策略。
  - [ ] 仅当 schema 已达到当前基线后，才归一化 `_sqlx_migrations`。

### 4.2 实现建议

- [ ] 在 `src-tauri/src/data/sqlite_pool.rs` 中拆出明确函数：
  - [ ] `repair_legacy_schema_before_baseline_normalization`
  - [ ] `sessions_has_column`
  - [ ] `ensure_sessions_continuity_group_start_time`
  - [ ] `ensure_current_indexes`
- [ ] 保持 `normalize_current_baseline_migration_history` 的职责变薄：
  - [ ] 先打开旧数据库。
  - [ ] 先执行预修复。
  - [ ] 再判断 `has_current_baseline_schema`。
  - [ ] 最后归一化 migration history。
- [ ] 不把旧版本兼容逻辑塞进 `lib.rs`。
- [ ] `lib.rs` 仍只调用一个 data owner 暴露的入口。
- [ ] 错误文案必须说明失败的是 schema repair 还是 migration history normalization。

### 4.3 必补测试

在 Rust 测试中补齐以下用例。

- [ ] 旧 schema 缺 `continuity_group_start_time` 时会被补列。
- [ ] 补列后旧 session 数据仍保留。
- [ ] 补列后 `continuity_group_start_time` 回填为 `start_time`。
- [ ] 旧 schema 修复后 `_sqlx_migrations` 可归一化到当前单基线。
- [ ] 多个 active session 的旧异常数据仍只保留一个 active session，其余封口。
- [ ] 已经是当前 schema 时，预修复幂等，不重复破坏 migration history。
- [ ] 空数据库或不存在数据库时，不做多余操作。
- [ ] 不完整数据库缺关键表时，不错误写入当前 baseline migration history。

建议测试名：

- [ ] `legacy_schema_without_continuity_column_is_repaired`
- [ ] `legacy_schema_repair_preserves_existing_sessions`
- [ ] `legacy_schema_repair_backfills_continuity_group_start_time`
- [ ] `legacy_schema_repair_then_normalizes_migration_history`
- [ ] `legacy_schema_repair_dedupes_active_sessions`
- [ ] `current_schema_repair_is_idempotent`
- [ ] `missing_database_skips_legacy_repair`
- [ ] `incomplete_schema_is_not_marked_as_current_baseline`

### 4.4 发布与文档对齐

- [ ] 更新 `CHANGELOG.md` 的 `Unreleased`，说明升级链修复结果。
- [ ] 如果此行为成为长期规则，更新 `docs/engineering-quality.md` 或 `docs/versioning-and-release-policy.md`，明确压缩迁移基线时必须保留旧版本直升保护。
- [ ] 不把本执行计划内容整段复制进长期文档，只回写长期规则。

### 阶段 1 验收

- [ ] Rust 数据升级测试通过。
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml sqlite_pool -- --nocapture` 或等价局部测试通过。
- [ ] `npm run check:rust` 通过。
- [ ] 能清楚解释从旧数据库到当前 schema 的路径。
- [ ] 数据安全 / 升级可信度可从 `7.6` 提升到至少 `8.8`。

---

## 5. 阶段 2：扩展架构边界门禁

目标：让自动化检查覆盖文档中定义的高吸力区域，而不只覆盖最容易检查的目录。

当前 `check:architecture` 的价值是正向的，但它还不够支撑 9+。长期文档要求持续防守：

- 前端 `app/*`
- 前端 `shared/*`
- 前端 `platform/*`
- Rust `lib.rs`
- Rust `app/*`
- Rust `commands/*`

### 5.1 前端边界检查增强

- [ ] 先盘点当前 import 方向，不直接上重规则。

```bash
rg -n "from .*\\.\\./|platform/|features/|shared/|@tauri-apps|invoke\\(" src
```

- [ ] 扩展 `scripts/check-architecture-boundaries.ts` 的扫描根：
  - [ ] `src/app`
  - [ ] `src/features`
  - [ ] `src/shared`
  - [ ] `src/platform`
- [ ] 新增方向性规则：
  - [ ] `src/shared/**` 不得 import `src/app/**`。
  - [ ] `src/shared/**` 不得 import `src/features/**`。
  - [ ] `src/shared/**` 不得 import `src/platform/**`。
  - [ ] `src/features/*/components/**` 不得 import `src/platform/**`。
  - [ ] `src/features/*/hooks/**` 不得 import `src/platform/**`。
  - [ ] `src/features/*/components/**` 不得直接 import `@tauri-apps/*`。
  - [ ] `src/features/*/hooks/**` 不得直接 import `@tauri-apps/*`。
  - [ ] `src/app/components/**` 与 `src/app/hooks/**` 不得直接 import `platform/persistence/**`。
  - [ ] `src/platform/**` 不得 import `src/app/**`。
  - [ ] `src/platform/**` 不得 import `src/features/**`。
- [ ] 保留合理例外：
  - [ ] `src/features/*/services/**` 可以通过 feature-owned service 访问 `platform/persistence` 或 runtime gateway。
  - [ ] `src/app/services/**` 可以做应用级薄协调。
  - [ ] `src/platform/**` 可以访问 `@tauri-apps/*`。
- [ ] 每条新增规则必须有 self-test。
- [ ] self-test 应覆盖“应该失败”和“应该允许”的样例。

### 5.2 命名边界检查增强

- [ ] 复查 `RAW_FIELD_NAMES` 是否包含当前所有 IPC、SQLite、backup preview、update snapshot、widget placement 的 raw 字段。
- [ ] 增加 `src/app/services` 与 `src/features/*/services/*ViewModel.ts` 的 raw DTO 扩散检查。
- [ ] 保持允许路径只限明确 read model 或 platform raw DTO。
- [ ] 对 `RawXxx` 类型命名新增检查或文档规则：
  - [ ] `Raw` 类型只能出现在 `src/platform/**`、`src-tauri/**`、测试 fixture 或明确 read model 内部。

### 5.3 Rust 边界检查

新增轻量脚本，建议命名为：

- [ ] `scripts/check-rust-boundaries.ts`

建议规则：

- [ ] `src-tauri/src/commands/**` 不得出现 `sqlx::query`、`sqlx::query_scalar`、`Pool<Sqlite>`。
- [ ] `src-tauri/src/app/**` 不得出现 `sqlx::query`、`sqlx::query_scalar`，测试除外。
- [ ] `src-tauri/src/lib.rs` 不得出现 `sqlx::query`、`sqlx::query_scalar`。
- [ ] `src-tauri/src/commands/**` 不得直接调用 `crate::platform::windows::*`，除非是明确薄 command 且记录例外。
- [ ] `src-tauri/src/data/**` 可以使用 SQL。
- [ ] `src-tauri/src/engine/**` 尽量通过 data store/repository 边界，不直接 SQL；测试代码可例外。
- [ ] `src-tauri/src/platform/**` 不得 import `crate::data::*`。
- [ ] `src-tauri/src/domain/**` 不得 import `crate::data::*` 或 `crate::platform::*`。

### 5.4 接入质量门槛

- [ ] 在 `package.json` 中新增：
  - [ ] `check:rust-boundaries`
- [ ] 将 `check:rust-boundaries` 接入 `npm run check` 或 `npm run check:rust` 前置链。
- [ ] 确认 `.github/workflows/verify.yml` 通过 `npm run check:full` 自动覆盖新增门禁。
- [ ] 更新 `docs/engineering-quality.md` 中门禁说明。
- [ ] 更新 `docs/architecture.md` 中“健康落地”或“最低验证门槛”描述。

### 阶段 2 验收

- [ ] 新增门禁脚本 self-test 通过。
- [ ] `npm run check:naming` 通过。
- [ ] `npm run check:architecture` 通过。
- [ ] `npm run check:rust-boundaries` 通过。
- [ ] `npm run check` 通过。
- [ ] 架构边界评分可从 `8.3` 提升到至少 `8.9`。

---

## 6. 阶段 3：拆薄 tracking domain 语义聚集点

目标：让 tracking domain 的 owner 更细，降低后续修 tracking 可信度问题的认知成本。

当前 `src-tauri/src/domain/tracking.rs` 已有 `contracts.rs` 和 `session_identity.rs` 子模块，但主文件仍承接多个独立语义簇。本阶段不追求目录表面整齐，只拆已经稳定、边界清楚的部分。

### 6.1 拆分目标

- [ ] 创建或补齐以下真实 owner：
  - [ ] `src-tauri/src/domain/tracking/process_filters.rs`
  - [ ] `src-tauri/src/domain/tracking/sustained_identity.rs`
  - [ ] `src-tauri/src/domain/tracking/status_resolution.rs`
- [ ] 保留现有 `tracking.rs` 作为领域聚合出口。
- [ ] 保留对外 `pub use`，尽量不改调用方。
- [ ] 不把 runtime 编排移进 domain。
- [ ] 不把 Windows API 细节移进 domain。

### 6.2 process filters 拆分

移动或收口以下职责：

- [ ] `should_track`
- [ ] `is_trackable_window`
- [ ] `is_trackable_explorer_window`
- [ ] `is_desktop_shell_window`
- [ ] `is_lifecycle_utility_process`
- [ ] `is_temporary_executable_process`
- [ ] `is_standalone_uninstaller_app_stem`
- [ ] `is_lifecycle_utility_window`
- [ ] `is_lifecycle_metadata_candidate_executable`
- [ ] `is_version_like_token`
- [ ] `has_lifecycle_metadata_signal`
- [ ] `is_likely_system_process`

测试迁移：

- [ ] 系统进程过滤测试跟随 owner。
- [ ] 安装/卸载/更新类窗口过滤测试跟随 owner。
- [ ] Explorer / Desktop shell 区分测试跟随 owner。

### 6.3 sustained identity 拆分

移动或收口以下职责：

- [ ] `sustained_participation_app_identity`
- [ ] `source_app_id_identity`
- [ ] `signal_origin_matches_window`
- [ ] `signal_explicitly_stopped_for_window`
- [ ] `signal_matches_window`
- [ ] `resolve_sustained_participation_kind`
- [ ] `evaluate_sustained_participation_signal`
- [ ] `resolve_sustained_participation_identity_key`
- [ ] `normalize_process_value`
- [ ] `normalize_process_file_name`
- [ ] `normalize_source_identifier`
- [ ] `source_app_id_matches_window`

测试迁移：

- [ ] 音频/媒体 signal identity 测试跟随 owner。
- [ ] Chrome/Edge/Firefox/Brave/Zoom/Teams/VLC/哔哩哔哩/抖音/腾讯会议身份测试跟随 owner。
- [ ] unknown app fallback 测试跟随 owner。

### 6.4 status resolution 拆分

移动或收口以下职责：

- [ ] `TrackingStatusResolutionInput`
- [ ] `resolve_tracking_status`

测试迁移：

- [ ] sustained participation active/candidate/inactive 状态测试跟随 owner。
- [ ] AFK/continuity window 与 signal 组合测试跟随 owner。
- [ ] tracking paused 状态测试跟随 owner。

### 6.5 文件大小与可维护性目标

- [ ] `src-tauri/src/domain/tracking.rs` 目标降至约 `250-450` 行。
- [ ] 任一新 domain 子模块不超过约 `450` 行；超过则先判断是否继续拆 owner。
- [ ] 测试不强行集中到一个超长 test module。
- [ ] 保留少量 owner ledger 注释，说明 `tracking.rs` 只做聚合出口。

### 阶段 3 验收

- [ ] `cargo test --manifest-path src-tauri/Cargo.toml tracking -- --nocapture` 或等价局部测试通过。
- [ ] `npm run check:rust` 通过。
- [ ] 没有新增跨层依赖。
- [ ] tracking domain 可维护性评分可从 `8.1` 提升到至少 `8.8`。

---

## 7. 阶段 4：补齐发布元数据与文档事实

目标：消除成熟发布线中的模板痕迹，保证文档与仓库现实一致。

### 7.1 发布元数据

- [ ] 更新 `src-tauri/Cargo.toml`：
  - [ ] `description` 改为真实产品描述。
  - [ ] `authors` 改为真实维护者或项目名。
  - [ ] 如项目已有 license 口径，补齐 `license = "MIT"`。
- [ ] 确认 `package.json` version 与 `src-tauri/Cargo.toml` version 一致。
- [ ] 确认 `src-tauri/tauri.conf.json` version 一致。
- [ ] 确认 `docs/versioning-and-release-policy.md` 当前版本字段一致。

### 7.2 README 与当前事实

- [ ] 确认 README 的技术栈描述与当前实现一致。
- [ ] 确认 README 的备份恢复描述与当前只支持结构化 `.zip` 的策略一致。
- [ ] 如果补回旧数据库直升保护，README 不需要展开技术细节，但 changelog 应记录用户可理解结果。
- [ ] 若文档中仍说“恢复备份替换当前数据”，但 UI 已支持 merge 策略，应同步修正。

### 7.3 长期文档回写

仅在规则变成长期事实时回写。

- [ ] 如阶段 1 增加了迁移压缩规则，回写 `docs/engineering-quality.md`。
- [ ] 如阶段 2 增加了长期门禁，回写 `docs/architecture.md` 与 `docs/engineering-quality.md`。
- [ ] 如发布流程无变化，不更新 `docs/versioning-and-release-policy.md`。
- [ ] 不把本文 checklist 整段复制到顶层 docs。

### 阶段 4 验收

- [ ] 文档无明显事实漂移。
- [ ] 发布元数据无模板痕迹。
- [ ] 只回写长期规则，不扩写临时执行细节。

---

## 8. 阶段 5：验证链与性能复核

目标：用可重复命令证明 9+，而不是靠主观印象。

### 8.1 局部验证顺序

- [ ] 数据升级链改动后运行：

```bash
cargo test --manifest-path src-tauri/Cargo.toml sqlite_pool
```

- [ ] tracking domain 拆分后运行：

```bash
cargo test --manifest-path src-tauri/Cargo.toml tracking
```

- [ ] 前端门禁改动后运行：

```bash
npm run check:naming
npm run check:architecture
```

- [ ] Rust 门禁新增后运行：

```bash
npm run check:rust-boundaries
```

### 8.2 完整验证

- [ ] 运行默认完整质量门槛：

```bash
npm run check:full
```

- [ ] 运行性能预算：

```bash
npm run perf:history-read-model
npm run perf:dashboard-read-model
npm run perf:startup-bootstrap
```

- [ ] 如果 changelog 或 release 相关文件改动，运行：

```bash
npm run release:validate-changelog -- 0.6.7
```

- [ ] 如果准备发布，运行：

```bash
npm run release:check
```

### 8.3 结果记录

- [ ] 在本文第 11 节记录每条命令结果。
- [ ] 如果任何命令失败，记录失败原因、修复方式和复跑结果。
- [ ] 不用“本地环境问题”跳过关键门槛；除非有明确证据和替代验证。

---

## 9. 阶段 6：重新评分

目标：用同一把尺子重新评分。

### 9.1 评分口径

建议权重：

- [ ] 数据安全与升级可信度：`25%`
- [ ] 可靠性与验证：`25%`
- [ ] 架构边界：`25%`
- [ ] 可维护性：`15%`
- [ ] 性能治理：`10%`

### 9.2 不得评为 9+ 的情况

- [ ] 旧数据库直升当前版本仍无自动化测试覆盖。
- [ ] `npm run check:full` 未通过。
- [ ] 新增门禁没有接入默认质量链。
- [ ] `domain/tracking.rs` 只是移动代码但 owner 更模糊。
- [ ] 文档与仓库现实存在明显冲突。
- [ ] 性能脚本超过预算且无解释。

### 9.3 可评为 9+ 的最低标准

- [ ] 数据安全与升级可信度达到 `9.0+`。
- [ ] 可靠性与验证达到 `9.0+`。
- [ ] 架构边界达到 `9.0+`。
- [ ] 可维护性达到 `8.8+`。
- [ ] 性能治理达到 `8.5+` 且预算全绿。
- [ ] 综合评分达到 `9.0+`。

### 9.4 评分记录

- [ ] 最终数据安全与升级可信度评分：`待定`
- [ ] 最终可靠性与验证评分：`待定`
- [ ] 最终架构边界评分：`待定`
- [ ] 最终可维护性评分：`待定`
- [ ] 最终性能治理评分：`待定`
- [ ] 最终综合评分：`待定`
- [ ] 评分理由：`待填写`

---

## 10. 推荐执行顺序

按优先级执行，不建议跳跃。

- [ ] 阶段 0：执行护栏与范围锁定。
- [ ] 阶段 1：补强 SQLite 升级可信度。
- [ ] 阶段 2：扩展架构边界门禁。
- [ ] 阶段 3：拆薄 tracking domain 语义聚集点。
- [ ] 阶段 4：补齐发布元数据与文档事实。
- [ ] 阶段 5：验证链与性能复核。
- [ ] 阶段 6：重新评分。
- [ ] 完成后将本文移入 `docs/archive/`。

如果时间有限，最小 9+ 路径是：

- [ ] 完成阶段 1。
- [ ] 完成阶段 2 中的前端与 Rust 高吸力层门禁。
- [ ] 完成阶段 5 的 `check:full` 与性能复核。
- [ ] 至少完成阶段 3 的 owner 拆分设计，若暂不执行，必须证明它不是阻塞当前 9+ 的真实风险。

---

## 11. 执行证据区

执行过程中逐项填写。

### 11.1 代码变更摘要

- [ ] 数据升级链变更：
  - 待填写。
- [ ] 架构门禁变更：
  - 待填写。
- [ ] tracking domain 拆分：
  - 待填写。
- [ ] 发布元数据 / 文档变更：
  - 待填写。

### 11.2 验证命令结果

- [ ] `cargo test --manifest-path src-tauri/Cargo.toml sqlite_pool`
  - 结果：待填写。
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml tracking`
  - 结果：待填写。
- [ ] `npm run check:naming`
  - 结果：待填写。
- [ ] `npm run check:architecture`
  - 结果：待填写。
- [ ] `npm run check:rust-boundaries`
  - 结果：待填写。
- [ ] `npm run check:full`
  - 结果：待填写。
- [ ] `npm run perf:history-read-model`
  - 结果：待填写。
- [ ] `npm run perf:dashboard-read-model`
  - 结果：待填写。
- [ ] `npm run perf:startup-bootstrap`
  - 结果：待填写。
- [ ] `npm run release:validate-changelog -- 0.6.7`
  - 结果：待填写。

### 11.3 未完成项

- [ ] 未完成项 1：
  - owner：待填写。
  - 风险：待填写。
  - 是否阻塞 9+：待填写。
- [ ] 未完成项 2：
  - owner：待填写。
  - 风险：待填写。
  - 是否阻塞 9+：待填写。

---

## 12. 完成与归档

- [ ] 所有必须完成项已完成。
- [ ] 所有验证命令已记录。
- [ ] 最终评分已记录。
- [ ] 需要长期保留的规则已回写顶层 docs。
- [ ] 本文不再是 active execution basis。
- [ ] 将本文移动到：

```text
docs/archive/architecture-engineering-quality-9-plus-execution-plan-2026-05-16.md
```

- [ ] 确认 `docs/working/` 不残留已完成计划。
