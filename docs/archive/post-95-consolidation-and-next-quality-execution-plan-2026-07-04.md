# 9.5+ 后续固化与下一轮质量提升执行方案

## 0. 文档状态

- [x] 本执行单已完成，不再是当前执行依据。
- [x] 执行完成后，已确认无需新增回写 top-level `docs/`。
- [x] 执行完成后，已将本文移入 `docs/archive/`。

本文是一次性执行方案，不是长期母文档。它用于指导 **9.5+ 质量收口完成之后** 的下一步：把已经完成的架构与工程质量改动安全固化，并进入下一轮可验证的质量提升。

完成摘要：

- [x] 当前 9.6 分质量收口改动已拆成本地提交。
- [x] CI 与 PR 模板已确认和当前质量门槛一致，无需修改。
- [x] 热点候选已重新跑 `npm run quality:hotspots` 确认。
- [x] `tsconfig.quality.json` 后续 ratchet 路线已保留在本文。
- [x] 发布 dry run 已按当前任务判断：运行 `npm run release:check`，未准备版本号、changelog 或 tag。
- [x] `npm run check:full`、`npm run release:check` 与全部 perf 脚本已通过；`dashboard-read-model` 曾在并行测量中轻微超预算，串行复测通过。
- [x] 本文已归档。

Diataxis 定位：

- 文档类型：How-to / 执行指南。
- 目标读者：后续执行本仓库任务的维护者或代理。
- 用户目标：把当前 9.6 分质量收口从“工作区改动”固化为可追踪、可回滚、可验证的项目状态，并为下一轮热点拆解建立清晰路线。
- 范围：提交切分、CI 对齐、热点拆解准备、TypeScript 质量门槛收紧、发布前 dry run。
- 不在范围内：新增产品功能、UI 视觉方向调整、团队 SaaS/云优先扩张、一次性全仓重构。

---

## 1. 第一性原理

### 1.1 产品信任优先于工程洁癖

`Patina` 是本地优先的个人 Windows 桌面时间追踪工具。用户真正依赖的是：

1. 追踪记录可信。
2. 本地数据安全。
3. 行为可解释。
4. 发布与升级可重复验证。

因此下一轮工作不能为了“看起来更整齐”牺牲 tracking、SQLite、备份、恢复、清理、发布或更新链路的可信度。

### 1.2 质量提升必须能被重复执行

工程质量不是某次本地检查通过，而是后续每个人、每台机器、每次 CI 都能重复得到相同结论。

所以本轮固化必须优先处理：

- 工作区改动是否能被清楚拆分。
- CI 是否跑到与本地一致的质量门槛。
- 文档是否说的是当前真实规则。
- 失败时能不能快速定位是哪一类 gate 失败。

### 1.3 提交历史是维护能力的一部分

当前工作区包含架构 guard、Rust/前端边界迁移、SQL 写侧收口、typecheck、hotspot gate、文档归档等多类变化。

如果全部压成一个模糊提交，未来回看时会很难判断：

- 哪个提交引入了权限收口。
- 哪个提交改变了 IPC / Rust command 契约。
- 哪个提交只是测试和脚本质量门槛。
- 如果需要回滚，应该回滚哪一块。

因此提交切分不是“整理提交洁癖”，而是降低未来回归定位成本。

### 1.4 CI 是真实门禁，本地通过只是前置条件

本地 `npm run check:full` 和 `npm run release:check` 已通过，但真正长期有效的是：

- push / PR 时 CI 自动跑。
- CI 使用和本地一致的入口。
- PR 模板或贡献提示没有落后于真实 gate。

如果本地规则变强但 CI 不跑，质量门禁只是口头承诺。

### 1.5 热点拆解必须先锁行为，再移动代码

历史热点文件偏大，但不是所有大文件都应立刻拆。

尤其是：

- tracking runtime
- SQLite pool / migration
- History / Data read model
- Quiet Pro CSS
- backup / restore / cleanup

这些地方的第一目标是行为稳定。拆解前必须先知道：

- 当前行为由哪些测试保护。
- 哪些路径缺少 characterization tests。
- 哪些 helper 可以无行为改变地迁移。
- 哪些重构需要单独执行单。

### 1.6 TypeScript 严格性应按 ratchet 推进

`tsconfig.quality.json` 的第一步目标是把 `scripts/**/*.ts` 与 `tests/**/*.ts` 纳入类型检查，而不是一次性清完所有历史宽松类型。

下一步收紧应遵守：

- 先降低真实风险最高的 `any` / mock 漂移 / raw payload 漂移。
- 每次只打开一个可承受的规则或一个目录。
- 不把质量门槛升级变成大面积噪音清理。

### 1.7 发布 dry run 是产品承诺检查

发布不是构建一个安装包这么简单，而是验证：

- 版本文件一致。
- changelog 能解释用户可感知变化。
- updater / release workflow 仍能按规则工作。
- 扩展检查仍通过。

如果准备进入正式发布，必须按 `docs/versioning-and-release-policy.md` 做完整判断；如果只是质量收口，不应默认打 tag 或触发发布。

---

## 2. 当前事实基线

### 2.1 已完成事实

- [x] 上一轮架构与工程质量执行单已归档到 `docs/archive/`。
- [x] 上一轮真实复评分为 **9.6 / 10**。
- [x] `npm run check:full` 已通过。
- [x] `npm run release:check` 已通过。
- [x] 全部现有 perf 脚本已通过预算。
- [x] `git diff --check` 已通过。

### 2.2 当前工作区事实

- [x] 运行 `git status --short`，确认当前未提交改动均属于 9.5+ 质量收口范围。
- [x] 运行 `git diff --stat`，确认改动规模与提交切分计划一致。
- [x] 运行 `git diff --check`，确认没有 whitespace 或 patch 格式问题。
- [x] 若发现用户新增改动，先判断是否与本执行单相关；不相关则不得回滚。

当前预期的改动类别：

- 架构 guard：`scripts/check-architecture-boundaries.ts`、`scripts/check-rust-boundaries.ts`。
- 热点门禁：`scripts/check-quality-hotspot-baseline.ts`、`package.json`。
- TypeScript 质量门槛：`tsconfig.quality.json`、测试与脚本类型修复。
- 前端边界迁移：widget runtime gateway、persistence write gateway、SQLite write helper 移除。
- Rust 边界迁移：data services、persistence commands、app 层 data 直连迁出。
- 权限收口：Tauri capability 去除 main `sql:allow-execute`。
- 长期文档回写：`docs/architecture.md`、`docs/engineering-quality.md`。
- 执行单归档：`docs/archive/architecture-engineering-quality-95-plus-execution-plan-2026-07-04.md`。

### 2.3 CI 与协作事实

- [x] `.github/workflows/verify.yml` 当前在 `push main` 与 `pull_request` 上运行 `npm run check:full`。
- [x] `.github/pull_request_template.md` 当前要求勾选 `npm run check`、必要时 `npm run check:full`、发布相关时 `npm run release:check`。
- [x] 判断 PR 模板是否需要显式提到新增的 `check:types` / `check:hotspots`。
- [x] 若 `npm run check` 已包含新增 gate，默认不重复增加噪音项；只在模板表达不清时更新。

---

## 3. 目标与非目标

### 3.1 目标

- [x] 将当前 9.6 分质量收口改动拆成可审查、可回滚的提交范围。
- [x] 确认 CI 与本地质量门槛一致。
- [x] 明确下一轮热点拆解从哪里开始、怎么验证、何时停止。
- [x] 明确 `tsconfig.quality.json` 的下一步收紧路线。
- [x] 明确发布前 dry run 的触发条件与执行步骤。
- [x] 不降低当前 9.6 分质量状态。
- [x] 执行完成后归档本文。

### 3.2 非目标

- [ ] 不新增产品功能。
- [ ] 不改 Quiet Pro 视觉方向。
- [ ] 不做一次性全仓大重构。
- [ ] 不为了降低文件行数删除 migration、repair、升级保护或数据安全逻辑。
- [ ] 不默认创建分支、PR、tag 或 GitHub Release。
- [ ] 不默认 push 到远端，除非用户明确要求。
- [ ] 不使用 `Closes`、`Fixes`、`Resolves` 等 issue-closing 关键词。

---

## 4. 总体执行顺序

1. 冻结当前事实。
2. 检查并整理提交切分。
3. 确认 CI 与协作模板。
4. 为下一轮热点拆解建立 owner 和验证矩阵。
5. 规划 TypeScript 质量 ratchet。
6. 规划发布 dry run。
7. 运行必要验证。
8. 归档执行单。

原则：

- [x] 每一阶段先判断 owner。
- [x] 每一阶段先定义允许修改范围。
- [x] 每一阶段先定义停止条件。
- [x] 不把 working 执行单写成长期母文档。
- [x] 只有长期规则变化才回写 top-level `docs/`。

---

## 5. 阶段 A - 冻结事实与风险盘点

### A1. 工作区事实确认

执行：

- [ ] 运行 `git status --short`。
- [ ] 运行 `git diff --stat`。
- [ ] 运行 `git diff --check`。
- [ ] 运行 `git diff --name-only`。
- [ ] 按文件归类：guard、frontend boundary、Rust boundary、typed commands、tests/types、docs、capability。

验收：

- [ ] 没有无法解释的改动。
- [ ] 没有与本执行单无关的用户改动被误纳入提交计划。
- [ ] 如果发现无关改动，记录为“保留，不触碰”。

### A2. 验证事实确认

执行：

- [ ] 确认最近一次 `npm run check:full` 通过。
- [ ] 确认最近一次 `npm run release:check` 通过。
- [ ] 确认最近一次全部 perf 脚本通过。
- [ ] 如距离上次验证后发生代码改动，按风险重跑对应命令。

最低重跑规则：

- 只改本文：运行 `git diff --check` 即可。
- 改 `package.json` / scripts / tests：运行 `npm run check:types` 与相关脚本。
- 改架构 guard：运行 `npm run check:architecture`、`npm run check:rust-boundaries`。
- 改 Rust command / data：运行 `npm run check:rust`。
- 改发布、版本、changelog：运行 `npm run release:check`。

验收：

- [ ] 验证命令与改动风险匹配。
- [ ] 未把 sandbox `EPERM` 误判为代码失败。
- [ ] 如 sandbox 阻塞 Vite/esbuild/cargo 子进程，使用提升权限重跑同一命令并记录。

---

## 6. 阶段 B - 提交切分计划

### B1. 切分原则

提交切分按“可理解的风险边界”而不是按文件数量。

每个提交应满足：

- [ ] 有单一明确目的。
- [ ] 可以通过局部 diff 理解。
- [ ] 失败时能独立定位。
- [ ] 不混入无关 cleanup。
- [ ] 提交信息不关闭 issue。

### B2. 推荐提交 1：架构边界 guard

范围：

- [ ] `scripts/check-architecture-boundaries.ts`
- [ ] `scripts/check-rust-boundaries.ts`

目的：

- [ ] 禁止 `src/app/**` 直连 Tauri API。
- [ ] 禁止前端生产代码重新使用 SQLite write helper。
- [ ] 禁止 main capability 重新包含 `sql:allow-execute`。
- [ ] 禁止 Rust `app/**` 直连 data repository / SQLite pool。

提交前验证：

```powershell
npm run check:architecture
npm run check:rust-boundaries
```

推荐提交信息：

```text
test: tighten architecture boundary guards
```

验收：

- [ ] Guard 自测覆盖新增失败样例。
- [ ] 输出错误信息能说明修复方向。
- [ ] 没有误伤测试 fixture 或允许的底层 owner。

### B3. 推荐提交 2：前端 runtime 与 persistence 边界迁移

范围：

- [ ] `src/platform/desktop/widgetRuntimeGateway.ts`
- [ ] `src/app/widget/widgetIconService.ts`
- [ ] `src/platform/persistence/persistenceWriteRuntimeGateway.ts`
- [ ] `src/platform/persistence/*.ts`
- [ ] 相关 tests 类型修复。

目的：

- [ ] app 层不直接 import Tauri API。
- [ ] 前端生产 SQL 写入不再经低层 execute helper。
- [ ] 写侧通过 typed Rust command gateway。

提交前验证：

```powershell
npm run check:types
npm run check:architecture
npm run test:persistence
```

推荐提交信息：

```text
refactor: route frontend runtime writes through platform gateways
```

验收：

- [ ] 前端 `src/app/**` 不含 direct `@tauri-apps/api` import。
- [ ] 前端生产路径不调用 `executeWrite` / `executeWriteBatch`。
- [ ] `sqlite.ts` 仅暴露读连接。

### B4. 推荐提交 3：Rust app/data 边界迁移与 typed commands

范围：

- [ ] `src-tauri/src/app/*.rs`
- [ ] `src-tauri/src/commands/persistence.rs`
- [ ] `src-tauri/src/data/*.rs`
- [ ] `src-tauri/src/engine/web_activity/mod.rs`
- [ ] `src-tauri/src/app/bootstrap.rs`

目的：

- [ ] app 层不直连 repository / SQLite pool。
- [ ] data 层拥有 settings payload、tracking pause、user data maintenance。
- [ ] command 层保持 DTO / 转发，不承接厚业务。

提交前验证：

```powershell
cargo fmt --manifest-path src-tauri/Cargo.toml --check
npm run check:rust-boundaries
npm run check:rust
```

推荐提交信息：

```text
refactor: move persistence writes to data-owned rust commands
```

验收：

- [ ] `src-tauri/src/app/**` 生产代码不 import `data::repositories::*`。
- [ ] `src-tauri/src/app/**` 生产代码不调用 `wait_for_sqlite_pool`。
- [ ] Rust commands 只做参数接收、DTO 映射和转发。
- [ ] Rust tests 通过。
- [ ] clippy `-D warnings` 通过。

### B5. 推荐提交 4：权限收口

范围：

- [ ] `src-tauri/capabilities/default.json`
- [ ] `src-tauri/gen/schemas/capabilities.json`

目的：

- [ ] main window active capability 移除 `sql:allow-execute`。
- [ ] capability schema 与真实权限同步。

提交前验证：

```powershell
npm run check:architecture
npm run check:full
```

推荐提交信息：

```text
security: remove main window sql execute capability
```

验收：

- [ ] `default.json` 不含 `sql:allow-execute`。
- [ ] `widget.json` 仍不含 write SQL 权限。
- [ ] 应用写侧仍通过 typed command 可用。

### B6. 推荐提交 5：TypeScript 与热点质量门槛

范围：

- [ ] `tsconfig.quality.json`
- [ ] `package.json`
- [ ] `package-lock.json`
- [ ] `scripts/check-quality-hotspot-baseline.ts`
- [ ] tests / scripts 类型修复。

目的：

- [ ] `tests/**/*.ts` 与 `scripts/**/*.ts` 进入 typecheck。
- [ ] `check:hotspots` 接入 `npm run check`。
- [ ] 当前高风险热点行数有增长预算。

提交前验证：

```powershell
npm run check:types
npm run check:hotspots
npm run check
```

推荐提交信息：

```text
test: add quality typecheck and hotspot gates
```

验收：

- [ ] `check:types` 同时运行主 tsconfig 与 quality tsconfig。
- [ ] `check:hotspots` 超预算时会失败。
- [ ] tests/scripts 不再只靠运行时 strip-types 暴露错误。

### B7. 推荐提交 6：长期文档与归档

范围：

- [ ] `docs/architecture.md`
- [ ] `docs/engineering-quality.md`
- [ ] `docs/archive/architecture-engineering-quality-95-plus-execution-plan-2026-07-04.md`
- [ ] 本文完成后进入 `docs/archive/`

目的：

- [ ] 长期规则只写进 top-level 母文档。
- [ ] 一次性执行记录归档。
- [ ] working 目录不残留已完成执行单。

提交前验证：

```powershell
git diff --check
```

推荐提交信息：

```text
docs: record quality gates and archive execution plan
```

验收：

- [ ] top-level docs 只写长期规则，不写流水账。
- [ ] archive 文档标明已完成，不再作为当前执行依据。
- [ ] `docs/working/` 不保留完成文档。

### B8. 如果用户要求直接提交

执行：

- [ ] 逐个用 `git add <files>` 暂存对应提交范围。
- [ ] 每次提交前运行该提交的最小验证。
- [ ] 使用推荐提交信息或同等清晰信息。
- [ ] 每次提交后运行 `git status --short`，确认只剩后续范围改动。

禁止：

- [ ] 不使用 `git reset --hard`。
- [ ] 不使用 issue-closing 关键词。
- [ ] 不把所有改动无解释压成一个提交。
- [ ] 不提交用户无关改动。

---

## 7. 阶段 C - CI 与协作模板对齐

### C1. CI 检查

执行：

- [ ] 打开 `.github/workflows/verify.yml`。
- [ ] 确认 `push main` 会触发。
- [ ] 确认 `pull_request` 会触发。
- [ ] 确认安装依赖使用 `npm ci`。
- [ ] 确认质量入口为 `npm run check:full`。

当前判断：

- [x] `verify.yml` 已运行 `npm run check:full`。
- [x] 因为 `check:full` 包含 `npm run check`，而 `check` 已包含 `check:types` 与 `check:hotspots`，CI 已覆盖新增 gate。

验收：

- [ ] 如果 `verify.yml` 仍为 `npm run check:full`，默认无需改动 CI。
- [ ] 如果未来发现 CI 漂移，优先恢复 `npm run check:full`。

### C2. PR 模板检查

执行：

- [ ] 打开 `.github/pull_request_template.md`。
- [ ] 确认 validation checklist 包含 `npm run check`。
- [ ] 确认架构/Rust/SQLite/runtime 变化要求 `npm run check:full`。
- [ ] 确认 release 变化要求 `npm run release:check`。
- [ ] 判断是否需要在说明中提到 `check:types` / `check:hotspots` 已包含在 `npm run check` 中。

更新条件：

- [ ] 如果模板已经足够清晰，不修改。
- [ ] 如果协作者可能误以为 `check:types` / `check:hotspots` 是额外可选项，补一句说明。

验收：

- [ ] 模板不重复堆命令。
- [ ] 模板表达的最低验证与 `docs/engineering-quality.md` 一致。
- [ ] 不引入与个人仓库默认 push 规则冲突的流程。

---

## 8. 阶段 D - 下一轮热点拆解准备

### D1. 热点候选重新确认

执行：

- [ ] 运行 `npm run quality:hotspots`。
- [ ] 对照 `scripts/check-quality-hotspot-baseline.ts`。
- [ ] 记录前 10 个热点文件、行数、owner、风险类型。

候选表：

| 文件 | 预期 owner | 风险类型 | 下一步模式 |
| --- | --- | --- | --- |
| `src/styles/quiet-pro.css` | Quiet Pro styles | 样式资产体积与主题边界 | 边界判断或执行单 |
| `src/styles/tokens.css` | Quiet Pro tokens | token 规模与语义角色 | 边界判断 |
| `src-tauri/src/data/sqlite_pool.rs` | Rust data/sqlite | pool、repair、migration 交织 | 执行单 |
| `src-tauri/src/data/storage_migration.rs` | Rust data/migration | 升级可信链路 | 执行单 |
| `src/features/history/components/History.tsx` | history feature UI | 页面组件厚度 | 边界判断 |
| `src-tauri/src/engine/tracking/runtime.rs` | engine/tracking | tracking 主链可信度 | 执行单 |
| `src-tauri/src/data/backup.rs` | data/backup | 备份恢复安全 | 执行单 |
| `src-tauri/src/data/repositories/tools.rs` | data/tools repository | repository 体积 | 小步重构 |
| `src/features/data/services/dataReadModel.ts` | data feature read model | 读模型复杂度 | 边界判断 |
| `src/app/AppShell.tsx` | app shell | app 层高吸力 | 小步减厚 |

验收：

- [ ] 每个热点都有 owner。
- [ ] 每个热点都有风险类型。
- [ ] 没有把“文件大”直接等同于“必须马上拆”。

### D2. 选择第一轮热点目标

优先级判断：

1. 是否影响可信记录或数据安全。
2. 是否反复制造回归。
3. 是否已有足够测试保护。
4. 是否能小步移动而不改变行为。
5. 是否会触及发布或升级风险。

推荐第一轮候选：

- [ ] 若目标是降低 app 高吸力风险：从 `src/app/AppShell.tsx` 开始。
- [ ] 若目标是降低页面维护成本：从 `src/features/history/components/History.tsx` 开始。
- [ ] 若目标是提升数据安全结构：为 `sqlite_pool.rs` / `storage_migration.rs` 另写专项执行单。
- [ ] 若目标是 tracking 长期可信：为 `tracking/runtime.rs` 另写专项执行单，并先补 characterization tests。

默认推荐：

- [ ] 第一轮实际动手从 `History.tsx` 或 `AppShell.tsx` 开始，因为风险低于 SQLite migration 与 tracking runtime。
- [ ] SQLite migration 与 tracking runtime 先写专项执行单，不直接重构。

验收：

- [ ] 已选一个主目标。
- [ ] 已明确本轮不碰的高风险热点。
- [ ] 已明确验证命令。

### D3. History 页面拆解准备

适用条件：

- 选择 `src/features/history/components/History.tsx` 作为第一轮热点。

步骤：

- [ ] 阅读 `History.tsx`，按 UI 区域标注职责：filter、timeline、dialog、web activity、empty/loading/error。
- [ ] 查找已有 history 测试：`tests/historyTimelineViewModel.test.ts`、`tests/historyWebActivityViewModel.test.ts`、`tests/historyReadModel.test.ts`、`tests/historyFormatting.test.ts`。
- [ ] 判断哪些逻辑已经在 view model / read model 层，哪些仍留在组件内。
- [ ] 只抽出纯展示子组件或明确 owner 的局部 hook。
- [ ] 不改 read model 输出结构。
- [ ] 不改用户可见交互。
- [ ] 每次抽离后运行 history 相关测试。

验证：

```powershell
npm run test:history-timeline
npm run check:types
npm run check:architecture
```

完成验收：

- [ ] `History.tsx` 行数下降或复杂度下降。
- [ ] 新组件仍在 `features/history/components/` 内。
- [ ] 没有新增 `shared/*` 临时公共组件。
- [ ] History 相关测试通过。

### D4. AppShell 拆解准备

适用条件：

- 选择 `src/app/AppShell.tsx` 作为第一轮热点。

步骤：

- [ ] 阅读 `AppShell.tsx`，标注 shell navigation、global dialogs、runtime sync、layout 状态。
- [ ] 判断哪些逻辑已经属于 `app/services/*`，哪些只是壳层渲染。
- [ ] 只抽出 app owner 内部的薄子组件或 service 调用组合。
- [ ] 不把 feature 私有逻辑搬进 app。
- [ ] 不让 app 直接访问 platform/persistence。
- [ ] 不改导航语义。

验证：

```powershell
npm run test:ui-smoke
npm run test:ui-browser-smoke
npm run check:architecture
```

完成验收：

- [ ] `AppShell.tsx` 没有新增业务规则。
- [ ] app 层仍只做壳层与跨 feature 编排。
- [ ] UI smoke 与 browser smoke 通过。

### D5. SQLite / migration 专项准备

适用条件：

- 准备动 `sqlite_pool.rs` 或 `storage_migration.rs`。

必须先写新的专项执行单，且至少包含：

- [ ] 当前 schema repair / migration baseline / pool 初始化职责图。
- [ ] 已发布版本数据库升级链路说明。
- [ ] 不可删除代码清单。
- [ ] 可移动 helper 清单。
- [ ] 旧版本数据库直升保护测试矩阵。

最低验证：

```powershell
cargo test --manifest-path src-tauri/Cargo.toml --quiet sqlite
cargo test --manifest-path src-tauri/Cargo.toml --quiet migration
npm run check:rust
npm run check:full
```

停止条件：

- [ ] 需要删除 migration / repair 才能让文件变短。
- [ ] 无法解释旧版本数据库如何升级到当前版本。
- [ ] 测试不能覆盖历史 schema。

### D6. Tracking runtime 专项准备

适用条件：

- 准备动 `src-tauri/src/engine/tracking/runtime.rs`。

必须先写新的专项执行单，且至少包含：

- [ ] session 生命周期状态机图。
- [ ] AFK / 锁屏 / 睡眠 / crash recovery 行为矩阵。
- [ ] 当前 replay / lifecycle 测试覆盖表。
- [ ] 可移动 helper 与不可移动主循环职责区分。
- [ ] 每一步迁移后的回滚策略。

最低验证：

```powershell
npm test
npm run test:replay
cargo test --manifest-path src-tauri/Cargo.toml --quiet tracking
npm run check:rust
npm run check:full
```

停止条件：

- [ ] 无法证明会话切分行为不变。
- [ ] 无法解释 power lifecycle / AFK 影响。
- [ ] 为了拆文件改变 tracking 语义。

---

## 9. 阶段 E - TypeScript 质量 ratchet

### E1. 当前定位

`tsconfig.quality.json` 目前用于：

- [x] 检查 `scripts/**/*.ts`。
- [x] 检查 `tests/**/*.ts`。
- [x] 检查 `vite.config.ts`。
- [x] 不生成产物。
- [x] 不改变 Vite/Tauri 构建行为。

当前保守项：

- `strict: false`
- `noUnusedLocals: false`
- `noUnusedParameters: false`

### E2. 下一步收紧顺序

不要一次性打开所有严格选项。推荐顺序：

1. [ ] 先清理 tests/scripts 中明显不必要的 `any`。
2. [ ] 为常见 Tauri invoke/listen mocks 补共享测试类型。
3. [ ] 为 browser smoke evaluate payload 补明确返回类型。
4. [ ] 评估是否开启 `noImplicitReturns`。
5. [ ] 评估是否按目录开启更严格子 tsconfig。
6. [ ] 最后再考虑 `strict: true`。

### E3. 每一步执行模板

执行：

- [ ] 选择一个规则或一个目录。
- [ ] 运行 `npm run check:types`，记录当前失败数量。
- [ ] 修复真实契约问题，避免只用 cast 压掉错误。
- [ ] 如果确需 cast，写明边界原因。
- [ ] 运行 `npm run check:types`。
- [ ] 如果触及测试运行路径，运行对应测试。

验收：

- [ ] 类型门槛变强。
- [ ] 失败数量归零。
- [ ] 没有把测试 fixture 改得脱离真实运行时契约。
- [ ] 没有为了类型通过降低测试价值。

---

## 10. 阶段 F - 发布 dry run

### F1. 触发条件

只有满足以下任一条件才进入发布 dry run：

- [ ] 用户明确准备发布。
- [ ] 改动涉及版本、changelog、updater、release workflow、扩展包。
- [ ] 需要确认当前 main 已具备发布前最低条件。

如果只是质量收口，不默认打 tag、不默认发布。

### F2. 发布前范围判断

执行：

- [ ] 确认最近一个已发布 tag。
- [ ] 运行 `git log vX.Y.Z..HEAD`。
- [ ] 运行 `git diff --stat vX.Y.Z..HEAD`。
- [ ] 判断版本号应为 PATCH、MINOR 还是 MAJOR。
- [ ] 判断 changelog 应写用户可感知变化还是 Internal。

验收：

- [ ] 版本号不是按最后一个提交拍脑袋决定。
- [ ] changelog 覆盖上一个已发布版本之后的完整范围。
- [ ] 内部工程收口不被误写成用户功能。

### F3. Dry run 命令

执行：

```powershell
npm run release:validate-version-files -- <version>
npm run release:validate-changelog -- <version>
npm run release:check
```

如果只是确认当前未准备发布状态：

```powershell
npm run release:check
```

验收：

- [ ] version files 一致。
- [ ] changelog 合法。
- [ ] extension checks 通过。
- [ ] full quality gate 通过。

禁止：

- [ ] 不默认运行 `git tag`。
- [ ] 不默认 push tag。
- [ ] 不默认本地生成正式安装包。
- [ ] 不默认触发 GitHub Release。

---

## 11. 阶段 G - 最终验证

### G1. 固化改动后验证

提交前或提交后必须通过：

```powershell
git diff --check
npm run check:full
```

如果本轮触及发布相关文件，追加：

```powershell
npm run release:check
```

如果本轮触及热点性能路径，追加对应 perf：

```powershell
npm run perf:history-read-model
npm run perf:dashboard-read-model
npm run perf:data-read-model
npm run perf:data-history-browser
npm run perf:sqlite-query-plan
npm run perf:startup-bootstrap
```

验收：

- [ ] `git diff --check` 通过。
- [ ] `npm run check:full` 通过。
- [ ] 条件触发的 release/perf 检查通过。
- [ ] 如 sandbox 阻塞，提升权限重跑同一命令并记录。

### G2. CI 结果确认

如果执行了 push：

- [ ] 确认 GitHub Actions `Verify` workflow 已触发。
- [ ] 确认 `Run full quality gate` 通过。
- [ ] 如果失败，先看是否为环境依赖、Node/Rust 版本、Windows runner 问题，还是代码失败。
- [ ] 代码失败必须在本地复现并修复。

如果没有 push：

- [ ] 记录“未执行远端 CI，因用户未要求 push”。

---

## 12. 阶段 H - 文档归档

### H1. 判断是否需要回写长期文档

只有以下情况才更新 top-level docs：

- [ ] CI 规则发生变化。
- [ ] 新增长期质量 gate。
- [ ] TypeScript 质量 ratchet 成为长期默认。
- [ ] 发布流程发生长期变化。
- [ ] 架构 owner 规则发生变化。

不应回写：

- [ ] 某一次提交切分记录。
- [ ] 临时验证输出。
- [ ] 一次性风险判断。

### H2. 归档本文

执行：

- [x] 将本文顶部状态改为 completed。
- [x] 在执行记录中写明最终结果。
- [x] 使用 `apply_patch` 将本文移动到 `docs/archive/`。
- [x] 确认 `docs/working/` 没有已完成执行单。

验收：

- [x] 本文在 archive 中标明不再是当前执行依据。
- [x] 长期规则只存在于 top-level docs。
- [x] archive 只提供历史上下文。

---

## 13. 停止条件

出现以下任一情况，停止当前执行并重新判断：

- [ ] 发现未解释的用户改动与本执行单文件重叠。
- [ ] `npm run check:full` 出现真实代码失败。
- [ ] 需要改动 tracking runtime、SQLite migration 或 backup/restore，但没有专项执行单。
- [ ] 为了提交切分需要回滚用户改动。
- [ ] 为了降热点行数需要删除升级保护或数据安全逻辑。
- [ ] CI 与本地结果不一致且无法解释。
- [ ] 发布 dry run 暗示需要版本/changelog 改动，但用户并未要求准备发布。

---

## 14. 最终完成定义

本执行单只有在以下条件满足后才算完成：

- [x] 当前 9.6 分质量收口改动已被清晰固化，或已有明确未提交说明。
- [x] CI 与本地质量门槛关系已确认。
- [x] 下一轮热点拆解目标已选择，或已明确需要先写专项执行单。
- [x] `tsconfig.quality.json` 的下一步收紧策略已确认。
- [x] 发布 dry run 是否执行已有明确判断。
- [x] 必要验证已通过。
- [x] 本文已归档。

---

## 15. 执行记录

### 2026-07-04

- [x] 创建本执行单。
- [x] 阶段 A 完成：运行 `git status --short`、`git diff --stat`、`git diff --check` 与 `git diff --name-only`，确认当前改动均属于 9.5+ 后续固化范围。
- [x] 阶段 B 完成：将代码改动拆成本地提交 `ee9859b refactor: route persistence writes through rust commands` 与 `9e945a9 test: add quality typecheck and hotspot gates`。
- [x] 阶段 C 完成：确认 `.github/workflows/verify.yml` 在 push / pull_request 上运行 `npm run check:full`；确认 PR 模板现有 validation 足够表达 `check`、`check:full` 与 `release:check`，无需修改。
- [x] 阶段 D 完成：运行 `npm run quality:hotspots`，确认当前最大热点仍集中在 Quiet Pro CSS、SQLite pool/migration、History、tracking runtime、backup/tools/data read model 等区域；下一轮推荐先从 `History.tsx` 或 `AppShell.tsx` 开始，SQLite migration 与 tracking runtime 需先写专项执行单。
- [x] 阶段 E 完成：确认 `tsconfig.quality.json` 当前定位为 tests/scripts typecheck 入口；下一步 ratchet 顺序保留为减少真实 `any`、补共享测试 mock 类型、收紧 browser smoke payload，再评估更严格规则。
- [x] 阶段 F 完成：本轮不准备正式版本号、changelog 或 tag；已执行 `npm run release:check` 作为发布级 dry run。
- [x] 阶段 G 完成：`npm run check:full` 通过；`npm run release:check` 通过；全部 perf 脚本通过预算。`dashboard-read-model` 在并行跑 perf 时 average 25.14 ms / budget 25 ms，判断为并行测量噪声，串行复测 average 20.52 ms 通过。
- [x] 阶段 H 完成：本文勾选完成并归档到 `docs/archive/`。未 push，因此远端 CI 未触发；后续如用户要求 push，再确认 GitHub Actions `Verify` 结果。
