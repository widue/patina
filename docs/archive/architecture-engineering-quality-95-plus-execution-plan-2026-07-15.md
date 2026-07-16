# 架构与工程质量 95+ 执行方案（2026-07-15）

## 0. 文档状态

- [x] 文档类型：一次性执行方案。
- [x] 当前状态：已完成并归档。
- [x] 当前执行位置：`docs/archive/`。
- [x] 已将长期规则回写到对应 top-level `docs/` 文档。
- [x] 已将本执行方案移入 `docs/archive/`。
- [x] 本文归档后，不再作为后续任务的默认执行依据。

### 0.1 归档结论

- [x] 架构、正确性、验证、静态质量、性能和可复现性六个维度均达到各自硬门槛。
- [x] 最终加权评分为 **95.2 / 100**，不是沿用目标值，而是按本轮重新运行的证据计算。
- [x] `npm run check:full` 通过：前端门禁与测试、生产构建、bundle、Rust 377 项测试（376 通过、1 项显式 ignored）、fmt、clippy、依赖审计均通过。
- [x] `npm run test:tauri-runtime-smoke` 通过：真实 Tauri/WebView2 command、event、plugin SQL、capability 拒绝、结构化错误和 SQLite 落盘完整性通过。
- [x] `npm run perf:stable` 串行完成 6 组基准 × 5 次，所有 average、p50、p95、max 与 SQLite query-plan 门禁通过。
- [x] 核心风险覆盖率达到 statements/lines 97.96%、branches 88.88%、functions 86.36%；8 个关键 mutant 全部被杀死。
- [x] 前后端边界检查器、Rust 边界检查器、IPC 契约检查器及其 self-test 全部通过；静态 IPC 为 82 个生产调用对 82 个注册命令。
- [x] npm 可达漏洞为 0；Windows target 可达 Rust 漏洞为 0，精确 lock-only 例外均同时核对 advisory、crate、版本，并先由目标依赖树证明不可达。

本文件保留原始细项的勾选状态作为审计轨迹。未勾选的拉伸项不冒充完成，也不再作为活动执行单；它们已经转为下列长期残余债务，并计入本轮扣分：

- History、AppShell、SQLite 与 storage 的物理文件仍高于原计划的激进拆分目标；生产口径预算已收紧并阻止回增，但没有为了行数牺牲 migration/恢复可信度。
- Quiet Pro 任意 radius 历史债务尚未清零；当前使用精确文件级 56 项 no-growth 基线，减少时必须同步收紧。
- feature copy 尚未完全按 feature lazy owner 拆分；当前 source gzip 为 28.93 KiB，已转为 30 KiB 硬门槛，并通过更严格的 initial/lazy/total bundle 预算约束回流。
- 真实 runtime smoke 已进入 Windows CI，但失败现场的截图/日志 artifact 仍可继续增强，因此可复现性维度不计满分。
- 对抗式复核发现最初的 “engine 只能依赖 domain/ports” 表述与既有 Tauri 桌面编排不一致。最终规则按职责而不是目录洁癖收口：持久化必须走端口，engine 可调用窄 platform capability，但原始 Win32 实现必须留在 platform；Windows 元数据解析已迁出 engine，并增加机器门禁。
- 对抗式复核发现 runtime smoke 的断言虽通过，工作区 debug 进程却可能残留。测试现已同时要求 Tauri 与 Vite 子进程在限时内真实退出，并以路径核对确认复测后只保留用户安装版进程。

本文服务于当前 `1.x` 稳定期，不是新的架构母文档。执行过程中如与以下长期文档冲突，以长期文档为准：

- `docs/product-principles-and-scope.md`
- `docs/roadmap-and-prioritization.md`
- `docs/engineering-quality.md`
- `docs/architecture.md`
- `docs/issue-fix-boundary-guardrails.md`
- `docs/quiet-pro-component-guidelines.md`
- `docs/versioning-and-release-policy.md`

## 1. 目标与完成定义

### 1.1 总目标

把当前对抗式复评的综合评分从 **78 / 100** 提升到可重复、可审计、可长期维持的 **95+ / 100**。

95+ 不是一次主观复评，也不是“所有检查都绿”。完成必须同时满足：

- [x] 文档声明的依赖方向与生产代码真实依赖方向一致。
- [x] 自动化门禁能够发现并阻止同类边界回流，不依赖人工记忆。
- [x] 核心运行时、IPC、SQLite 和 Windows 桌面链路有与风险匹配的验证证据。
- [x] 高风险热点的职责和决策面显著下降，而不只是把代码搬到更多文件。
- [x] 错误恢复依赖稳定错误语义，而不是依赖第三方错误字符串。
- [x] React Hooks、异步调用和工具链版本有机器可执行的静态约束。
- [x] 性能预算覆盖平均值和尾部尖刺，并与真实加载阶段相匹配。
- [x] 完整验证可以在固定环境中重复通过。
- [x] 最终评分表每一项都有代码、测试、脚本或构建产物证据。

### 1.2 最终评分硬门槛

| 维度 | 权重 | 当前基线 | 目标 | 硬门槛 |
| --- | ---: | ---: | ---: | --- |
| 架构与依赖边界 | 30 | 70 | 96 | 不低于 95 |
| 正确性与恢复能力 | 20 | 88 | 96 | 不低于 93 |
| 测试与验证可信度 | 20 | 86 | 96 | 不低于 95 |
| 可维护性与静态质量 | 15 | 70 | 94 | 不低于 92 |
| 性能与 bundle 治理 | 10 | 83 | 95 | 不低于 92 |
| 可复现性与依赖治理 | 5 | 68 | 94 | 不低于 90 |

加权校验：

- 当前：`70×30% + 88×20% + 86×20% + 70×15% + 83×10% + 68×5% = 78.0`。
- 目标：`96×30% + 96×20% + 96×20% + 94×15% + 95×10% + 94×5% = 95.5`。

综合完成条件：

- [x] 加权总分不低于 95。
- [x] 架构与验证两个核心维度都不低于 95。
- [x] 任一维度不得低于其硬门槛。
- [x] 不通过提高预算、删除测试、放宽规则或修改评分口径取得分数。
- [x] 最终评分由重新运行的证据计算，不沿用本文的目标分。

## 2. 第一性原理

### 2.1 用户真正需要的是可信行为，不是漂亮目录

架构的最终价值是降低错误行为和不可解释行为的概率。因此执行顺序必须是：

1. 先保护用户数据和追踪行为。
2. 再让依赖方向真实、可验证。
3. 再降低实现复杂度。
4. 最后收紧性能和工具链预算。

任何重构如果只降低行数，却增加并发风险、迁移风险、状态同步路径或兼容层数量，都不计入正向提升。

### 2.2 所有权必须决定依赖方向

长期结构保持不变：

```text
frontend: app / features / shared / platform / styles
rust:     lib.rs + app / commands / platform / engine / domain / data
```

必须满足的真实依赖原则：

- `domain` 不依赖平台、数据库或 Tauri。
- `engine` 只通过显式数据端口访问持久化，不依赖仓储实现、SQLx pool 或 SQL；桌面编排可以调用 `platform` 暴露的窄能力，但不得直接实现 Win32 API。
- `data` 实现数据端口并拥有 SQLite、migration、repository、backup/restore 数据读写。
- `platform` 实现 Windows、网络、文件系统、WebView 等外部环境边界。
- `app` 是 composition root，负责组装端口实现、runtime state 和生命周期。
- `commands` 只做 IPC 参数接收、DTO 映射和调用应用服务。
- 前端 feature UI 不直接访问 Tauri 或持久化实现。
- 前端 platform gateway 不承载 feature 私有业务判断。

### 2.3 门禁必须验证语义，而不是验证命名习惯

机器门禁至少要回答：

- 生产代码的依赖方向是否正确。
- 多行 import/use、重导出和动态 import 是否被正确识别。
- 测试模块例外是否只作用于测试代码，而不是文件后半段。
- 已知历史债务是否有精确基线、真实 owner 和退出条件。
- 新增违规是否必然失败，而不是被“当前预算”吸收。

### 2.4 验证必须覆盖失败模式

“成功路径通过”不能证明稳定性。高风险链路必须覆盖：

- 空数据、损坏数据和旧版本数据。
- 锁冲突、pool 关闭、超时和重试。
- 重复事件、乱序事件和组件卸载后的异步完成。
- 应用重启、崩溃恢复和运行时状态重建。
- 命令未注册、参数漂移、capability 不匹配和事件未释放。
- 长时间历史数据、跨日边界和高频刷新。

### 2.5 95+ 必须可以长期维持

一次性清理不够。每个阶段都必须形成以下闭环：

```text
发现问题 -> 明确 owner -> 补失败测试 -> 实现最小迁移
-> 增加防回流门禁 -> 运行风险验证 -> 收紧基线 -> 回写长期规则
```

## 3. 当前证据基线

### 3.1 已确认的正向基线

- [x] 生产 TypeScript 使用 `strict`。
- [x] Rust `cargo clippy -- -D warnings` 通过。
- [x] Rust 当前为 372 passed、0 failed、1 个查询计划诊断测试 ignored。
- [x] 前端当前约 505 项测试和 smoke 场景通过。
- [x] 真实浏览器/Vite smoke 当前为 31 项通过、console error 为 0。
- [x] 生产构建通过。
- [x] 当前 bundle 预算通过。
- [x] 当前隔离运行的性能脚本均通过预算。
- [x] 当前 `npm audit` 没有报告已知漏洞。
- [x] main 与 widget capability 均不包含前端 SQL 写权限。
- [x] 备份恢复、SQLite 完整性、危险归档路径和升级修复已有较强测试基础。

### 3.2 已确认的主要差距

- [ ] `docs/architecture.md` 要求 `data` 阻止 SQL/pool/repository 回流到 `engine`，生产代码尚未满足。
- [ ] `check:rust-boundaries` 未扫描 `engine/*`，当前通过结果不能证明上述要求。
- [ ] 前端架构门禁逐行使用正则解析 import，存在多行 import 和复杂语法盲区。
- [ ] SQLite 可恢复错误在 Rust 和 TypeScript 两侧依赖字符串匹配。
- [ ] Rust 高风险路径大量返回 `Result<..., String>`，IPC 缺少统一稳定错误码。
- [ ] 浏览器 smoke 使用 Tauri stub，尚未覆盖真实 custom command、capability、事件和 SQLite 协作。
- [ ] 当前有 44 个源码或测试文件超过本地建议阈值。
- [ ] `History.tsx`、`AppShell.tsx`、tracking runtime、SQLite pool 和 storage migration 仍是高决策密度热点。
- [ ] 前端没有 React Hooks/异步语义 lint 门禁。
- [ ] Rust toolchain 使用浮动 `stable`，Node 版本没有仓库级单一来源。
- [ ] bundle 检查对 copy domains 给出 review warning。
- [ ] 当前性能预算主要约束平均值，部分浏览器预算明显宽于稳定基线。

### 3.3 本轮执行前重新采集

执行者开始实施前必须重新运行，不能直接复制 2026-07-15 的数字：

```powershell
git status --short
npm run quality:hotspots
npm run check:types
npm run check:naming
npm run check:architecture
npm run check:rust-boundaries
npm run check:bundle
cargo test --manifest-path src-tauri/Cargo.toml --quiet
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
```

- [ ] 保存命令、日期、Node/Rust 版本和结果。
- [ ] 记录当前大文件、直接依赖和错误字符串匹配数量。
- [ ] 记录当前前端 invoke、Rust command 和事件名称清单。
- [ ] 记录当前 bundle initial/lazy/total gzip。
- [ ] 记录当前各性能脚本的 average/p50/p95/max。
- [ ] 如果基线与本文不同，先解释变化，再开始实施。

## 4. 范围与非目标

### 4.1 本次范围

- [ ] Rust `engine -> data` 依赖方向收口。
- [ ] 前端与 Rust 架构门禁从正则防线升级为可辩护的语义防线。
- [ ] SQLite 恢复错误和 IPC 错误协议结构化。
- [ ] 前端 invoke 与 Rust handler 的静态契约检查。
- [ ] Windows/Tauri 真实运行时 smoke。
- [ ] 高风险前端、Rust 和 CSS 热点降风险。
- [ ] React Hooks、异步调用和格式检查补强。
- [ ] Node/Rust 工具链与依赖审计可复现。
- [ ] 覆盖率、关键 mutation 验证和风险域测试映射。
- [ ] bundle warning 处理与性能预算收紧。
- [ ] 长期文档、CI、PR 模板与执行结果同步。

### 4.2 非目标

- [ ] 不增加新的产品功能。
- [ ] 不改变产品本地优先、个人 Windows 桌面工具定位。
- [ ] 不改变 tracking、timeline、统计和分类的用户可见口径。
- [ ] 不为了目录整齐进行全仓大搬迁。
- [ ] 不删除数据库 migration、legacy repair 或已发布版本升级保护。
- [ ] 不引入第二套状态管理框架或依赖注入框架。
- [ ] 不创建万能 `common`、`core`、`utils` 或 `services` 桶。
- [ ] 不把所有 `Result<..., String>` 一次性机械替换。
- [ ] 不用覆盖率数字替代场景测试和失败模式测试。
- [ ] 不把格式化全仓改写混入行为或边界提交。
- [ ] 不修改 GitHub Issue、Project 状态、分支或远端，除非维护者另行明确授权。

## 5. 执行治理

### 5.1 阶段顺序

严格按以下顺序推进：

1. 阶段 A：冻结基线和评分口径。
2. 阶段 B：让架构门禁先变得诚实。
3. 阶段 C：建立最小 composition root 和端口模式。
4. 阶段 D：按风险拆除 `engine -> data` 生产依赖。
5. 阶段 E：建立结构化错误与恢复协议。
6. 阶段 F：补静态 IPC 契约和真实 Tauri runtime smoke。
7. 阶段 G：降低高风险热点的决策密度。
8. 阶段 H：补静态质量、覆盖率、mutation 与工具链固定。
9. 阶段 I：收紧性能和 bundle 证据。
10. 阶段 J：完整验证、复评、长期文档回写和归档。

阶段 B 完成前，不开始大规模边界迁移；阶段 F 完成前，不宣称运行时验证达到 95；阶段 J 完成前，不宣称总分达到 95+。

### 5.2 每阶段统一模板

每个阶段必须记录：

- [ ] 真实 owner。
- [ ] 输入和输出边界。
- [ ] 允许修改文件。
- [ ] 禁止修改区域。
- [ ] 失败测试或门禁样例。
- [ ] 最小实现步骤。
- [ ] 验证命令和结果。
- [ ] 性能或行为差异。
- [ ] 回滚点。
- [ ] 新增长期规则是否需要回写。

### 5.3 提交上限

- [ ] 每个提交只承接一个 owner 或一个可独立验证的纵向切片。
- [ ] 手工维护内容超过 1000 行变化或超过 25 个文件时，按 owner/行为拆分。
- [ ] 门禁修改与被门禁保护的行为修改尽量分开提交。
- [ ] 生成文件、lockfile 和机械格式化单独提交。
- [ ] 每个中间提交应尽量可构建、可测试或至少可静态检查。

## 6. 阶段 A：冻结基线与风险登记

### A1. 建立执行记录

- [ ] 在本文“执行记录”中写入开始日期、commit、Node、npm、Rust、Cargo 版本。
- [ ] 运行 `git status --short`，确认没有会被覆盖的用户改动。
- [ ] 保存当前评分表，不允许实施中途改变权重。
- [ ] 给每个问题分配稳定 ID：`Q95-20260715-01` 起。
- [ ] 每个 ID 写明 owner、风险、前置依赖、验证和退出条件。

问题登记初始项：

| ID | 问题 | 真实 owner | 初始风险 | 状态 |
| --- | --- | --- | --- | --- |
| Q95-20260715-01 | Rust engine 直接依赖 repository/pool/SQL | app composition + engine ports + data adapters | 高 | 未开始 |
| Q95-20260715-02 | Rust boundary gate 不扫描 engine | scripts/quality | 高 | 未开始 |
| Q95-20260715-03 | 前端 import guard 为逐行正则 | scripts/quality | 中 | 未开始 |
| Q95-20260715-04 | SQLite 恢复依赖错误字符串 | data + platform persistence | 高 | 未开始 |
| Q95-20260715-05 | IPC 缺少结构化错误契约 | commands + platform gateways | 中高 | 未开始 |
| Q95-20260715-06 | 无真实 Tauri runtime smoke | tests + scripts + CI | 高 | 未开始 |
| Q95-20260715-07 | 高决策密度热点 | 各真实 owner | 中高 | 未开始 |
| Q95-20260715-08 | React Hooks/async lint 缺失 | frontend quality | 中 | 未开始 |
| Q95-20260715-09 | 工具链版本浮动 | build/CI | 中 | 未开始 |
| Q95-20260715-10 | bundle warning 与宽预算 | copy owner + performance scripts | 中 | 未开始 |

### A2. 建立可比较输出

- [ ] 将热点报告保存为执行记录中的表格，不提交临时终端输出。
- [ ] 将生产 `engine/*` 对 `crate::data`、`sqlx`、`SqlitePool`、`wait_for_sqlite_pool` 的引用分类。
- [ ] 区分生产引用与 `#[cfg(test)]` 引用。
- [ ] 区分端口/稳定 facade 与 repository/pool/SQL 实现细节。
- [ ] 统计前端 `useState/useEffect/useMemo/useCallback` 热点，仅作为评审提示，不直接设硬分数。
- [ ] 统计 `Result<..., String>`、错误字符串匹配和前端错误文案解析位置。

### A3. 阶段验收

- [ ] 所有当前差距都有 owner。
- [ ] 没有使用“全局”“公共层”“以后再整理”作为 owner 或退出条件。
- [ ] 当前验证结果已记录。
- [ ] 评分权重和硬门槛已冻结。
- [ ] 阶段 A 形成独立文档提交或与本文创建提交保持一致。

## 7. 阶段 B：让架构门禁诚实

### B1. Rust boundary gate 扫描 engine

目标：门禁必须看见 `engine/*`，但不能因为历史债务一次性让主分支永久失败。

允许修改：

- `scripts/check-rust-boundaries.ts`
- `tests/` 中对应门禁测试，或脚本内 self-test
- `package.json`（仅在需要新增独立检查入口时）
- `docs/engineering-quality.md`（阶段完成后才回写长期规则）

执行：

- [ ] 把 `src-tauri/src/engine` 加入扫描集合。
- [ ] 新增生产规则：`engine-no-data-repository-import`。
- [ ] 新增生产规则：`engine-no-sqlite-pool-type`。
- [ ] 新增生产规则：`engine-no-direct-sql-query`。
- [ ] 新增生产规则：`engine-no-wait-for-sqlite-pool`。
- [ ] 明确允许 `#[cfg(test)]` 测试模块使用临时 SQLite，不把测试 fixture 当生产违规。
- [ ] 修正当前 `inTestModule` 一旦进入就不退出的文件级状态问题。
- [ ] 至少覆盖 `#[cfg(test)] mod tests { ... }` 之后仍有生产 item 的 self-test。
- [ ] 至少覆盖多行 `use crate::data::{...}` 的 self-test。
- [ ] 至少覆盖 fully-qualified `crate::data::...` 表达式的 self-test。
- [ ] 至少覆盖 `sqlx::query`、`query_as`、`query_scalar` 的 self-test。

历史债务处理：

- [ ] 生成精确 baseline：文件、规则、生产引用数量、owner、计划退出阶段。
- [ ] baseline 只能列出当前已知违规，不能使用目录通配符。
- [ ] 新增同类引用必须立即失败。
- [ ] 已有文件中违规数量增加必须失败。
- [ ] 违规迁出后同步收紧或删除 baseline，不保留空余预算。
- [ ] baseline 文件不得被功能提交顺手放宽。

推荐实现形态：

```ts
interface BoundaryDebtBaseline {
  path: string;
  rule: RustBoundaryRule;
  maxOccurrences: number;
  owner: string;
  exitPhase: string;
}
```

不要使用只写路径、不写规则和数量的 allowlist。

### B2. 前端 architecture gate 使用 TypeScript AST

目标：import/export/dynamic import 检查不再依赖“整条语句必须在一行”。

执行：

- [ ] 使用仓库已有 `typescript` compiler API 解析 `.ts/.tsx`。
- [ ] 从 `ImportDeclaration` 读取静态 import。
- [ ] 从 `ExportDeclaration` 读取重导出。
- [ ] 从 `CallExpression` 读取字符串字面量动态 import。
- [ ] 只对可静态确定的模块路径执行 owner 规则。
- [ ] 非字面量动态 import 出现在受限目录时，要求显式解释或失败。
- [ ] 保持现有 path alias 和相对路径归一化语义。
- [ ] 删除逐行 import 正则后，保留对直接 `invoke()` 等行为的 AST 或精确文本规则。
- [ ] self-test 覆盖单行、多行、type import、export type、dynamic import、alias import。
- [ ] self-test 覆盖注释和字符串中的伪 import，确保不会误报。

### B3. 门禁自身质量

- [ ] 为两个 boundary checker 增加独立 `--self-test` CI 调用。
- [ ] 门禁错误输出包含文件、行号、规则、建议 owner。
- [ ] 门禁输出不得只说“failed”，必须能直接定位。
- [ ] 门禁在 Windows 和 Ubuntu 路径分隔符下产生相同结果。
- [ ] 门禁运行时间保持在本地可接受范围，目标每项低于 3 秒。

### B4. 阶段验收

```powershell
npm run check:architecture -- --self-test
npm run check:rust-boundaries -- --self-test
npm run check:architecture
npm run check:rust-boundaries
npm run check:types
```

- [ ] 所有 self-test 通过。
- [ ] 当前历史债务被精确记录，而不是被隐藏。
- [ ] 人工注入一个多行违规 import 时门禁失败；撤销后通过。
- [ ] 人工注入一个 engine repository import 时门禁失败；撤销后通过。
- [ ] 没有放宽现有 app/domain/platform/commands 规则。
- [ ] 阶段 B 完成后，才允许进入依赖迁移。

## 8. 阶段 C：建立最小 composition root 与端口模式

### C1. 先做设计验证，不先建框架

目标：证明一个纵向切片能够实现正确依赖方向，再复制模式。

- [ ] 选择最小、低风险、已有测试充足的 engine/data 交互作为试点。
- [ ] 记录当前调用链：command/app -> engine -> data -> SQLite。
- [ ] 画出目标调用链：command/app -> engine port -> data adapter。
- [ ] 明确端口属于 engine 行为需求，不属于 data 实现便利。
- [ ] 明确 DTO/领域模型归属，避免端口返回 SQL row。
- [ ] 不建立万能 `Repository` trait 或全局 service locator。

### C2. 端口形状

端口原则：

- [ ] trait 定义靠近使用者，优先放在对应 `engine/<owner>/ports.rs`。
- [ ] 方法使用领域语义命名，不暴露表名、SQL、pool 或 transaction。
- [ ] 返回 owner-specific error，不直接泄漏 `sqlx::Error`。
- [ ] 异步 trait 的实现方式必须评估对象安全、生命周期和测试替身成本。
- [ ] 不因为方便引入全仓依赖注入框架。

推荐先比较两种实现：

1. 具体 service 泛型持有端口实现。
2. `Arc<dyn Port>`，方法返回 `BoxFuture`。

选择条件：

- [ ] 能被 Tauri managed state 安全持有。
- [ ] 能在单元测试中注入 fake。
- [ ] 不要求每个 runtime 函数传播复杂泛型。
- [ ] 不增加不必要 clone、锁或动态分派热点。
- [ ] 错误边界清晰。

### C3. Composition root

允许 owner：`src-tauri/src/app/bootstrap.rs` 或相邻 `app/services.rs`。

- [ ] data adapter 在 app composition root 构造。
- [ ] engine service 在 app composition root 构造。
- [ ] command 通过 managed state 或 app service 调用 engine。
- [ ] command 不直接构造 repository/pool。
- [ ] engine 不通过 `AppHandle` 临时寻找 data 实现。
- [ ] runtime 生命周期结束时，service/port 资源有明确释放语义。
- [ ] 测试 app 可使用内存或临时文件 adapter。

### C4. 试点验收

- [ ] 试点 engine 文件不再 import data repository/pool。
- [ ] 行为测试保持不变或增强。
- [ ] 新增 fake port 失败路径测试。
- [ ] 没有新增全局 mutable state。
- [ ] 没有新增跨 owner facade。
- [ ] `check:rust-boundaries` baseline 至少减少一项。
- [ ] 记录试点模式是否适合后续切片；不适合则在复制前调整。

## 9. 阶段 D：按纵向切片拆除 engine 对 data 实现的依赖

### D0. 迁移统一规则

每个切片按以下固定顺序：

1. [ ] 写当前行为/失败模式测试。
2. [ ] 定义最小端口。
3. [ ] data 实现端口。
4. [ ] app composition root 注入。
5. [ ] engine 改为只依赖端口。
6. [ ] command 保持薄转发。
7. [ ] 运行专项测试。
8. [ ] 收紧 boundary baseline。
9. [ ] 运行 `npm run check:rust`。

禁止在一个提交里同时迁移多个不相关 engine owner。

### D1. Widget 与 updater 状态切片

候选文件：

- `src-tauri/src/engine/widget.rs`
- `src-tauri/src/engine/updater.rs`
- `src-tauri/src/data/repositories/widget_state.rs`
- `src-tauri/src/data/repositories/update_state.rs`
- `src-tauri/src/app/bootstrap.rs`

执行：

- [ ] 为 widget placement/state 定义行为端口。
- [ ] 为 updater 持久状态定义独立端口，不与 widget 合并。
- [ ] data adapter 负责 pool 和 repository。
- [ ] engine 只读取/写入领域状态。
- [ ] 覆盖读取失败、写入失败、缺省状态和重复写入。
- [ ] 收紧对应 baseline。

### D2. Web activity engine 切片

候选文件：

- `src-tauri/src/engine/web_activity/mod.rs`
- `src-tauri/src/data/repositories/web_activity.rs`
- `src-tauri/src/data/app_settings_service.rs`
- `src-tauri/src/app/web_activity.rs`

执行：

- [ ] 区分 active-tab 行为编排与 segment persistence。
- [ ] 端口方法使用 start/update/end segment 语义。
- [ ] 不向 engine 返回 raw SQL row。
- [ ] 保留当前单 active segment 不变量。
- [ ] 覆盖乱序时间戳、重复事件、禁用同步和数据库失败。
- [ ] engine 生产代码不再 import `SqlitePool`。
- [ ] 收紧对应 baseline。

### D3. Tools engine 切片

候选文件：

- `src-tauri/src/engine/tools/mod.rs`
- `src-tauri/src/engine/tools/notification.rs`
- `src-tauri/src/data/repositories/tools.rs`
- `src-tauri/src/data/repositories/tools/read.rs`
- `src-tauri/src/data/repositories/tools/backup_restore.rs`

执行：

- [ ] 将 reminder、timer、pomodoro 的端口按一致事务边界设计。
- [ ] 不为每个 SQL 方法创建一一对应的贫血 trait。
- [ ] 端口表达 `start/pause/resume/reset/tick/snapshot` 等行为所需数据操作。
- [ ] 事务仍由 data owner 持有。
- [ ] 通知平台调用保持在 platform/engine 协调边界，不进入 repository。
- [ ] 覆盖重复 pause/resume、过期 tick、重启恢复和事务失败。
- [ ] `engine/tools/mod.rs` 不再重复获取 pool。
- [ ] 收紧对应 baseline。

### D4. Export 数据访问切片

候选文件：

- `src-tauri/src/engine/export/mod.rs`
- `src-tauri/src/engine/export/common.rs`
- `src-tauri/src/engine/export/sqlite_exporter.rs`
- `src-tauri/src/engine/export/csv_exporter.rs`
- `src-tauri/src/engine/export/markdown_exporter.rs`
- `src-tauri/src/engine/export/parquet_exporter.rs`
- 新增的 `src-tauri/src/data/export/*`

owner 划分：

- engine 拥有导出用例、字段选择、格式选择和进度/结果语义。
- data 拥有源数据库查询、row 映射、目标 SQLite schema 和事务。
- 格式 writer 可以留在 engine/export 或独立 owner，但不得持有产品数据库 pool。

执行：

- [ ] 把 sessions/web activity 查询移动到 data export reader。
- [ ] 把目标 SQLite 建表与 insert 移动到 data export writer。
- [ ] engine format writer 接收 typed export rows。
- [ ] 动态列名只能来自编译期 allowlist。
- [ ] 覆盖字段子集、空导出、范围边界、写入失败和临时文件清理。
- [ ] `engine/export/*` 生产代码不再 import `sqlx`。
- [ ] 收紧对应 baseline。

### D5. Remote status bridge 切片

候选文件：

- `src-tauri/src/engine/remote_status_bridge/mod.rs`
- `src-tauri/src/data/app_settings_service.rs`
- `src-tauri/src/data/icon_cache_service.rs`
- `src-tauri/src/data/repositories/app_settings.rs`

执行：

- [ ] 把 machine identity、设置加载和 icon lookup 定义为独立需求端口。
- [ ] bridge 只负责编排状态快照和连接生命周期。
- [ ] data adapter 负责持久化与恢复。
- [ ] 覆盖连接重建、设置变化、持久化失败和快照发送失败。
- [ ] 收紧对应 baseline。

### D6. Tracking 核心切片（最后实施）

这是最高风险阶段。前置条件：D1-D5 至少证明端口模式稳定，阶段 F 的 IPC/runtime 验证已经可用或接近完成。

候选文件：

- `src-tauri/src/engine/tracking/runtime.rs`
- `src-tauri/src/engine/tracking/runtime/loop_state.rs`
- `src-tauri/src/engine/tracking/watchdog.rs`
- `src-tauri/src/engine/tracking/active_session.rs`
- `src-tauri/src/engine/tracking/continuity.rs`
- `src-tauri/src/engine/tracking/metadata.rs`
- `src-tauri/src/data/tracking_runtime.rs`
- `src-tauri/src/data/repositories/sessions.rs`
- `src-tauri/src/data/repositories/tracker_settings.rs`

执行：

- [ ] 先列出 tracking runtime 所需的完整数据能力，不边迁移边发明端口。
- [ ] 按 session lifecycle、tracker settings、icon cache 三组能力判断是否应分端口。
- [ ] `TrackingRuntimeDataStore` 若继续存在，只能成为 data adapter，不能成为 engine 的 data 依赖入口。
- [ ] app 构造 tracking service 和端口实现。
- [ ] runtime 主循环只持有 tracking service/ports，不获取 pool。
- [ ] transition、continuity、timeout、power lifecycle 继续使用现有领域决策。
- [ ] watchdog 通过端口读取心跳并封口，不直接获取 pool。
- [ ] metadata icon 写入通过端口，不让 Windows metadata owner依赖 repository。
- [ ] 把 runtime 内测试 SQL fixture 移入明确测试模块或 test support，不计为生产违规。

必须保持的行为：

- [ ] 同一窗口重复采样不切 session。
- [ ] 同 exe 标题变化不切 session。
- [ ] 窗口切换正确封口并开始新 session。
- [ ] AFK、锁屏、睡眠、恢复边界不变。
- [ ] startup sealing 使用最后心跳并正确 clamp。
- [ ] stale tracker 不让 live session 无限增长。
- [ ] cleanup 不复活已删除 session。
- [ ] continuity group 和 sustained participation 语义不变。
- [ ] 标题记录关闭后不泄漏新标题。
- [ ] 任何数据库失败都不会产生两个 active session。

专项验证：

```powershell
npm test
npm run test:replay
npm run test:tracker-health
cargo test --manifest-path src-tauri/Cargo.toml --quiet tracking
npm run check:rust
```

### D7. 阶段 D 总验收

- [ ] `engine/*` 生产代码没有 `crate::data::repositories`。
- [ ] `engine/*` 生产代码没有 `wait_for_sqlite_pool`。
- [ ] `engine/*` 生产代码没有 `SqlitePool`/`Pool<Sqlite>`。
- [ ] `engine/*` 生产代码没有 `sqlx::query*`。
- [ ] engine boundary baseline 已删除，不再保留历史额度。
- [ ] commands 和 app 没有吸收迁出的业务逻辑。
- [ ] data adapter 没有吸收 engine 行为决策。
- [ ] `npm run check:full` 通过。

## 10. 阶段 E：结构化错误与恢复协议

### E1. 错误分层原则

不创建一个吞掉所有语义的 `AppError`。采用三层：

1. owner-specific 内部错误，例如 data、tracking、export、storage。
2. app/command 边界映射错误。
3. 前端稳定 `CommandErrorDto`。

推荐 IPC 形状：

```rust
#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandErrorDto {
    pub code: String,
    pub message: String,
    pub retryable: bool,
}
```

要求：

- [ ] `code` 是稳定机器契约，不包含动态值。
- [ ] `message` 用于日志或用户 fallback，不用于控制流。
- [ ] `retryable` 由 Rust owner 判断，不由前端猜测。
- [ ] 诊断 context 保留错误链，但不直接成为 UI 分支条件。

### E2. SQLite 恢复错误

执行：

- [ ] 建立 `SqliteOperationError` 或等价 owner error。
- [ ] 从 `sqlx::Error` 提取 SQLite error code/kind。
- [ ] 明确 `BUSY`、`LOCKED`、pool closed、timeout 的分类。
- [ ] `is_recoverable_sqlite_error` 接收 typed error，不接收 `&str`。
- [ ] 删除 Rust 对第三方错误文案的恢复判断。
- [ ] 前端删除重复的 SQLite 错误字符串匹配。
- [ ] Rust command 返回稳定 `retryable/code`。
- [ ] 覆盖每种 recoverable/non-recoverable 分类。
- [ ] 覆盖第一次写失败、reopen、第二次成功。
- [ ] 覆盖 reopen 失败和第二次仍失败。

### E3. IPC 高风险命令迁移

按以下顺序迁移，不一次性机械替换：

1. [ ] persistence write commands。
2. [ ] storage migration/cleanup commands。
3. [ ] backup/restore commands。
4. [ ] export commands。
5. [ ] tracking/settings commands。
6. [ ] tools/update/widget commands。

每组迁移要求：

- [ ] Rust 内部错误保持 owner-specific。
- [ ] command 边界统一映射 DTO。
- [ ] TypeScript gateway 使用 runtime parser 校验错误形状。
- [ ] UI 分支只读取 `code/retryable`。
- [ ] 旧字符串错误兼容若必须存在，写明版本窗口和删除条件。
- [ ] 测试覆盖未知错误 fallback。

### E4. 错误日志与用户文案

- [ ] console/eprintln 只保留可诊断 context，不打印敏感 payload。
- [ ] 用户提示通过现有 copy 系统映射 code，不直接展示数据库内部文本。
- [ ] 同一错误 code 的中英文语义一致。
- [ ] background runtime 错误进入 health/diagnostics，而不是只写 stderr。
- [ ] retryable 错误有明确重试或恢复动作。
- [ ] non-retryable 错误不会形成无限重试循环。

### E5. 阶段验收

- [ ] SQLite 恢复路径不存在 `contains("database is locked")` 等控制流。
- [ ] 前端不存在复制的 recoverable SQLite 文本判断。
- [ ] 高风险 commands 返回结构化错误。
- [ ] 错误 code 有 reference 表和测试。
- [ ] `npm run test:persistence` 通过。
- [ ] Rust data/storage/export/backup 专项测试通过。
- [ ] `npm run check:full` 通过。

## 11. 阶段 F：IPC 契约与真实 Tauri runtime 验证

### F1. 静态 command 契约检查

新增建议入口：`npm run check:ipc-contracts`。

执行：

- [ ] 使用 TypeScript AST 收集 `src/platform/**` 中字面量 invoke command。
- [ ] 收集 Rust `generate_handler![]` 注册项。
- [ ] 收集 `#[tauri::command]` 函数名及显式 rename。
- [ ] 检查前端调用但未注册的 command。
- [ ] 检查注册但没有调用且没有 runtime-only 说明的 command。
- [ ] 检查 command 函数存在但未注册。
- [ ] 非字面量 command 名默认失败，除非精确 allowlist。
- [ ] 生成稳定排序输出，便于审查 diff。
- [ ] self-test 覆盖漏注册、拼写漂移、alias 和动态字符串。

### F2. 参数与 DTO 契约

- [ ] 为关键 command 建立 Rust/TypeScript fixture 契约测试。
- [ ] 覆盖 camelCase/snake_case 映射。
- [ ] 覆盖 optional/null/undefined。
- [ ] 覆盖 i64 时间戳在 JS number 安全范围内的约束。
- [ ] 覆盖 tagged enum 和错误 DTO。
- [ ] raw DTO 只停留在 platform gateway。
- [ ] gateway parser 拒绝缺字段、非法状态和未知 enum。

### F3. 真实 Tauri runtime smoke 设计

目标：在 Windows CI 启动真实 Tauri/WebView2、真实 command handler、真实 capability 和隔离 SQLite。

测试模式约束：

- [ ] 只在 debug/test 构建启用。
- [ ] 使用 `PATINA_E2E=1` 或等价显式环境开关。
- [ ] 使用独立临时 data root，不读取或修改真实用户数据。
- [ ] 使用独立窗口配置和端口。
- [ ] release 构建不注册测试 command、不启用 remote debugging。
- [ ] 测试退出时关闭 app、浏览器连接和临时目录。

实现步骤：

- [ ] 把现有 CDP browser harness 抽成可同时服务 Vite stub smoke 和 WebView2 runtime smoke 的测试工具。
- [ ] 通过测试环境为 WebView2 开启随机 remote-debugging port。
- [ ] 启动 `tauri dev` 或专用 debug binary。
- [ ] 等待 app ready 标记，设置明确超时。
- [ ] 通过 CDP 连接 main WebView。
- [ ] 验证 Dashboard 首屏来自真实 runtime，而不是 stub。
- [ ] 调用至少一个只读 command。
- [ ] 调用至少一个写入隔离 SQLite 的 command并重新读取。
- [ ] 监听并验证至少一个 Rust -> frontend event。
- [ ] 验证 widget capability 不能执行未授权操作。
- [ ] 验证 command 失败返回结构化错误。
- [ ] 验证 app 退出后临时 DB 可重新打开并通过完整性检查。

### F4. Runtime smoke 场景清单

- [ ] 应用能启动并创建 main window。
- [ ] SQLite migration 在空 DB 上完成。
- [ ] app settings 写入和读取闭环。
- [ ] tracking snapshot command 返回合法 DTO。
- [ ] tracking pause toggle 产生预期事件并持久化。
- [ ] widget window 创建、隐藏和恢复。
- [ ] 只读 SQL capability 工作，写 SQL capability被拒绝。
- [ ] 非法 command 名返回明确失败。
- [ ] 非法参数不会 panic。
- [ ] 关闭并重启后设置仍存在。
- [ ] console、Rust stderr 和 unhandled rejection 均为空或命中明确 allowlist。

### F5. CI 接入

- [ ] 新增 `test:tauri-runtime-smoke`。
- [ ] Windows CI 单独 job 或单独 step 运行，设置 10 分钟以内超时。
- [ ] 失败时上传 app log、browser log、截图和临时 DB integrity report。
- [ ] 首次落地先观察稳定性，不用重试掩盖 flaky。
- [ ] 稳定后纳入 `check:full` 或 release hard gate。
- [ ] PR intake 仍先于执行贡献者代码的 Verify workflow。

### F6. 阶段验收

- [ ] 静态 IPC contract gate 通过。
- [ ] 真实 Tauri runtime smoke 连续运行 10 次无失败。
- [ ] Windows CI 连续 10 个主分支运行无 flaky。
- [ ] command/capability/SQLite 至少各有一个真实闭环场景。
- [ ] stub browser smoke 继续保留，承担快速 UI 回归。
- [ ] 文档明确区分 stub smoke 与 runtime smoke 证明的范围。

## 12. 阶段 G：热点降风险

### G0. 判断标准

热点完成不是“文件低于 N 行”，而是满足：

- [ ] 根组件/主循环只保留编排。
- [ ] 状态、纯计算、I/O 和展示边界可独立测试。
- [ ] 修改一个行为不需要理解无关 owner。
- [ ] effect/锁/事务生命周期更容易推理。
- [ ] 没有制造新的厚 hook、facade 或 `mod.rs`。
- [ ] 热点预算实际收紧。

### G1. `History.tsx`

目标：页面根组件恢复为数据装配、布局和子区域组合。

- [ ] 列出当前 state/effect/memo/callback 的所有权。
- [ ] 把 snapshot 加载、竞态取消和 cache 协调收进 History-owned hook/service。
- [ ] 把 timeline viewport/zoom/selection 状态收进单一 owner。
- [ ] 把 timeline dialogs 与 page layout 拆成明确组件。
- [ ] 保留纯 view model 在 services，不放进组件 hook。
- [ ] 不让新 hook 直接访问 platform。
- [ ] 根组件目标不高于 500 行；任何新子文件不高于 500 行。
- [ ] effects 目标不超过 5 个，或逐项解释为何必须留在根组件。
- [ ] 扩展 timeline/read model/browser smoke 测试。
- [ ] 收紧 hotspot budget。

### G2. `AppShell.tsx`

目标：壳层只保留启动、导航、provider 和跨 feature 编排。

- [ ] 列出 11 个 effect 的触发条件和清理责任。
- [ ] 把同一生命周期的 effect 合并到 owner hook。
- [ ] 把 feature cache invalidation 注册成显式策略表或 owner service，不散落在壳层。
- [ ] 保持 lazy view ownership，不把 feature 实现搬入 app。
- [ ] 根组件目标不高于 400 行。
- [ ] app hook 不直接访问 persistence。
- [ ] 覆盖 foreground/background、warmup、navigation 和 listener cleanup。
- [ ] 收紧 hotspot budget。

### G3. `sqlite_pool.rs`

目标：保留 pool 生命周期和 schema preparation 编排，拆出独立数据职责。

- [ ] 把 schema inspection 移入 `sqlite_pool/schema_inspection.rs`。
- [ ] 把 legacy repair 移入 `sqlite_pool/schema_repair.rs`。
- [ ] 把 migration metadata normalization 移入明确模块。
- [ ] 保留 pool open/register/reopen/wait 在主 owner。
- [ ] 不删除任何已发布版本升级路径。
- [ ] 每个 repair 函数保持幂等并有旧 DB fixture 测试。
- [ ] 主文件目标不高于 700 行。
- [ ] 收紧 hotspot budget。

### G4. `storage_migration.rs`

目标：让 plan、validation、file operations、execution 和 recovery 各自可测试。

- [ ] 拆出 migration plan 构建。
- [ ] 拆出 target path validation。
- [ ] 拆出 staging/copy/promote 文件操作。
- [ ] 拆出 count/integrity validation。
- [ ] 主模块只编排 pending migration 生命周期。
- [ ] 覆盖复制中断、promotion 失败、marker 损坏和回滚。
- [ ] 主文件目标不高于 650 行。
- [ ] 收紧 hotspot budget。

### G5. Tracking runtime

目标：runtime 主文件只保留循环和事件编排。

- [ ] 把 production tests 移入相邻 test module，避免主文件被 fixture 淹没。
- [ ] 把轮询、电源、continuity、timeout、exclusion 继续留在现有 owner。
- [ ] 把残留 session mutation 细节移入 transition/active_session。
- [ ] 主 runtime 生产部分目标不高于 500 行。
- [ ] 不增加新的 runtime facade。
- [ ] tracking replay 和 Rust专项测试全部通过。
- [ ] 收紧 hotspot budget。

### G6. CSS 与 Quiet Pro token

- [ ] 统计所有 `rounded-[...]`，按视觉角色分类。
- [ ] 把重复 radius 映射到现有或新增语义 token。
- [ ] 优先使用 `panel/control/chip/status` archetype。
- [ ] 页面组件不再硬编码可由 token 表达的 radius/border/shadow。
- [ ] 不把页面私有样式塞进 `quiet-pro.css`。
- [ ] `quiet-pro.css` 只保留跨 feature 组件原型。
- [ ] `tokens.css` 只保留 token 和主题映射，不承载组件选择器。
- [ ] 新增 guard 阻止 TSX 新增任意 radius，允许精确历史 baseline 并持续收紧。
- [ ] 运行 UI/browser smoke 并检查窄宽度、focus、disabled、empty/loading。

### G7. Copy bundle

目标：消除 copy domains review warning，同时保持切换语言同步、无闪烁。

- [ ] 用 bundle analyzer 固定 copy modules 实际落点。
- [ ] 区分 app-shell/common copy 与 lazy feature copy。
- [ ] 让 Settings、History、Data、Tools 等 copy 跟随对应 lazy feature 加载。
- [ ] 保持 copy key 类型安全。
- [ ] 语言切换后已加载 feature 立即更新。
- [ ] 未加载 feature 不进入 initial chunk。
- [ ] copy domains source attribution 回到 review threshold 内。
- [ ] initial gzip 不因兼容层反而增加。
- [ ] 收紧对应 bundle budget。

### G8. 阶段验收

- [ ] 至少五个最高风险 production 热点完成职责降风险。
- [ ] 44 个超阈值文件数量显著下降；测试大文件单独判断，不机械拆散场景。
- [ ] 所有已优化热点 budget 同步降低。
- [ ] 没有新的 500+ 行 hook/facade/mod.rs。
- [ ] `npm run quality:hotspots` 输出可解释。
- [ ] `npm run check:full` 通过。

## 13. 阶段 H：静态质量、覆盖率、mutation 与工具链

### H1. React/TypeScript lint

采用高信噪比规则，不做全仓风格战争。

- [ ] 引入 ESLint flat config。
- [ ] 启用 `react-hooks/rules-of-hooks` 为 error。
- [ ] 启用 `react-hooks/exhaustive-deps` 为 error。
- [ ] 对生产源码启用 type-aware no-floating-promises。
- [ ] 对 event handler 启用 no-misused-promises 或等价规则。
- [ ] tests/scripts 使用独立、合理的规则覆盖。
- [ ] 不用大范围 disable 注释换取通过。
- [ ] 每个 disable 必须有理由并尽量限定到一行。
- [ ] 新增 `npm run check:lint` 并接入 `npm run check`。
- [ ] lint 修复按 owner 拆分，不与架构迁移混在同一提交。

### H2. Rust 格式与 lint

- [ ] 将 `cargo fmt --check` 接入 `check:rust`。
- [ ] 保持 Clippy `-D warnings`。
- [ ] 评估并启用与本项目相关的额外 Clippy lint，而不是全量 pedantic。
- [ ] 对 unsafe Windows FFI 保持小作用域和 RAII owner。
- [ ] 新 unsafe block 必须有安全不变量注释和失败测试/人工检查。

### H3. 覆盖率

覆盖率用于发现未测试分支，不作为单一质量真相。

- [ ] 为 TypeScript 选择可支持当前 Node test runner 的覆盖率工具。
- [ ] 为 Rust 选择固定版本的 `cargo-llvm-cov` 或等价工具。
- [ ] 首次只采集基线，不立即用任意百分比阻塞主线。
- [ ] 标记 tracking transition、continuity、SQLite repair、restore、IPC parsers 为核心风险域。
- [ ] 核心纯逻辑目标 branch coverage 不低于 85%。
- [ ] 核心恢复/迁移模块每个错误分支至少有一个场景证据。
- [ ] 平台 FFI 不追求虚高行覆盖，改用 contract/RAII/Windows integration 证据。
- [ ] 后续改动不得降低对应风险域基线，除非提交中解释并补替代证据。
- [ ] 覆盖率报告作为 CI artifact，不提交生成目录。

### H4. Mutation 验证

只针对高价值纯逻辑，避免全仓昂贵 mutation。

- [ ] 对 tracking transition/session timeout 运行 Rust mutation 或人工 mutation suite。
- [ ] 对前端 read model/normalization 运行定向 mutation。
- [ ] 至少验证边界比较符、时间 clamp、状态 enum fallback、恢复重试条件。
- [ ] 记录存活 mutation，并补能杀死它的测试或解释不可行原因。
- [ ] 95+ 验收要求核心风险域 mutation score 达到约定目标，建议不低于 80%。
- [ ] mutation 不默认进入每次 PR；进入定期或 release quality job。

### H5. 工具链固定

- [ ] 新增 `rust-toolchain.toml`，固定经过完整验证的 Rust 版本和组件。
- [ ] `package.json` 增加 `engines.node` 与 `engines.npm`。
- [ ] 增加 `.nvmrc`、`.node-version` 或选择一个单一 Node 版本文件；避免多个来源漂移。
- [ ] GitHub Actions 读取仓库版本来源，不重复硬编码不同版本。
- [ ] README/CONTRIBUTING 写明最低与推荐工具链。
- [ ] 本地和 CI 使用同一 major/minor。
- [ ] 升级工具链必须独立提交并运行 `check:full`、release check 和性能基线。

### H6. 依赖审计

- [ ] 保持 `npm audit` 检查生产依赖。
- [ ] 增加 Rust advisory 审计，工具版本必须固定并使用 lockfile。
- [ ] 审计 job 与普通离线质量检查分开，避免网络问题伪装代码失败。
- [ ] 高/严重等级 advisory 阻止发布。
- [ ] 无修复版本时记录 owner、影响路径、缓解措施和复查日期。
- [ ] 依赖升级不与功能改动混合。

### H7. 阶段验收

- [ ] `check:lint` 全仓通过，没有无理由 blanket disable。
- [ ] `cargo fmt --check` 和 Clippy 进入默认 Rust gate。
- [ ] 核心风险域有覆盖率基线。
- [ ] 核心纯逻辑完成定向 mutation。
- [ ] Node/Rust 工具链有单一固定来源。
- [ ] npm 与 Rust 依赖审计可在 CI 重复运行。
- [ ] `npm run check:full` 通过。

## 14. 阶段 I：性能与 bundle 证据收紧

### I1. 运行规则

- [ ] 性能脚本串行运行，避免并发 CPU 竞争造成假失败。
- [ ] 固定 Node/Rust 版本、构建模式和电源状态。
- [ ] 每项至少记录 average/p50/p95/max。
- [ ] 首轮与优化后使用相同数据集和迭代次数。
- [ ] browser stub、synthetic SQLite 和真实 runtime 结果分开报告。

### I2. 收紧现有预算

- [ ] 对每个性能脚本采集至少 5 次稳定运行。
- [ ] 用稳定 p95/max 而不是单次最好值确定预算。
- [ ] 预算缓冲只覆盖可重复噪声，不覆盖未知回归。
- [ ] browser navigation 预算从当前宽阈值收紧到稳定基线的合理上界。
- [ ] Dashboard 平均预算保留足够但有限余量，并新增 p95 门槛。
- [ ] Data 365d 增加 p95 硬门槛。
- [ ] History 增加 title sample 高量场景 p95 门槛。
- [ ] SQLite query plan 对 temp sort 和 table scan 分别定义规则。

### I3. 真实 SQLite I/O 基准

- [ ] 使用临时文件数据库，不只使用内存数据库。
- [ ] 数据形状包含长期 sessions、title samples、web activity 和 settings。
- [ ] 测量启动 migration、Dashboard read、History day read、Data 365d read。
- [ ] 测量 tracking write 与前端 read 同时发生时的等待时间。
- [ ] 记录 pool 等待、query、mapping 三段耗时。
- [ ] 不修改真实用户数据库。
- [ ] 超预算时先定位 query/serialization/JS mapping，不直接增加连接数。

### I4. Bundle

- [ ] `npm run check:bundle` 不再输出未处理 review warning。
- [ ] initial JS+CSS 不高于确认后的当前必要体积加 5%。
- [ ] lazy feature chunk 各有 owner。
- [ ] copy 按 feature 跟随 lazy 加载。
- [ ] 新增依赖不得无解释进入 initial/shared chunk。
- [ ] 构建输出记录为新的 release baseline，但不自动提高预算。
- [ ] 优化释放空间后同步降低预算。

### I5. 阶段验收

```powershell
npm run perf:history-read-model
npm run perf:dashboard-read-model
npm run perf:data-read-model
npm run perf:data-history-browser
npm run perf:sqlite-query-plan
npm run perf:startup-bootstrap
npm run check:bundle
```

- [ ] 所有脚本串行通过。
- [ ] average 与 p95/max 都在预算内。
- [ ] browser stub 结果没有被当作真实 SQLite I/O 证据。
- [ ] 真实 runtime/SQLite 基准有独立结果。
- [ ] bundle warning 清零。
- [ ] 预算没有被无证据放宽。

## 15. 阶段 J：最终验证、复评与归档

### J1. 完整静态与测试门槛

必须通过：

```powershell
npm run check:types
npm run check:lint
npm run check:naming
npm run check:architecture
npm run check:rust-boundaries
npm run check:ipc-contracts
npm run check:frontend
npm run check:rust
npm run check:full
npm run release:check
npm run test:tauri-runtime-smoke
```

- [ ] 所有命令在固定工具链下通过。
- [ ] sandbox `EPERM` 必须用同一命令提升权限重跑，不能改弱命令。
- [ ] 运行结果记录 commit、环境、日期和耗时。
- [ ] runtime smoke 连续通过要求已满足。
- [ ] npm/Rust advisory 审计通过或有明确接受记录。

### J2. 架构验收

- [ ] `engine/*` 生产代码不依赖 data implementation。
- [ ] `commands/*` 与 `app/*` 没有吸收迁移出的业务逻辑。
- [ ] `domain/*` 不依赖 platform/data。
- [ ] `platform/*` 不反向依赖 feature/app/data。
- [ ] 前端 UI/hook 不直接访问 platform。
- [ ] 所有临时 boundary baseline 已删除或只保留有期限的明确例外。
- [ ] 文档、代码和门禁对依赖方向的描述一致。

### J3. 可靠性验收

- [ ] SQLite 恢复使用 typed error code。
- [ ] 高风险 IPC 使用结构化错误 DTO。
- [ ] tracking、startup sealing、AFK/power、cleanup/replay 全部通过。
- [ ] migration/repair/restore 旧数据库 fixture 全部通过。
- [ ] 真实 runtime smoke 覆盖 command、event、capability、SQLite。
- [ ] 没有新增 panic/unwrap 到生产高风险路径。

### J4. 可维护性验收

- [ ] 五个以上最高风险热点完成职责降风险。
- [ ] hotspot budgets 已实际收紧。
- [ ] React Hooks/async lint 通过。
- [ ] 没有新增万能抽象或厚 facade。
- [ ] Quiet Pro radius/border/shadow 使用 token/组件原型。
- [ ] copy 与 lazy feature owner 一致。

### J5. 文档回写

只回写形成长期规则的内容：

- [x] `docs/architecture.md`：端口、composition root、engine/data 依赖规则。
- [x] `docs/engineering-quality.md`：AST boundary、IPC contract、runtime smoke、lint、coverage、toolchain、perf 规则。
- [x] `docs/issue-fix-boundary-guardrails.md`：涉及端口或跨层迁移时必须升级执行单。
- [x] `CONTRIBUTING.md`：新增本地验证和固定工具链。
- [x] `.github/pull_request_template.md`：新增 relevant validation checklist。
- [x] 不把阶段流水账写进长期文档。

### J6. 归档

- [x] 将本文状态改为“已完成并归档”。
- [x] 填写最终评分和证据。
- [x] 将本文移动到 `docs/archive/`。
- [x] 确认 `docs/working/` 不保留已完成副本。
- [x] 确认 top-level `docs/` 没有新增一次性计划。

## 16. 最终评分计算表

### 16.1 架构与依赖边界：30 分

- [ ] 10 分：生产依赖方向与 architecture 文档完全一致。
- [ ] 6 分：engine ports + app composition root 落地，无 repository/pool/SQL 泄漏。
- [ ] 5 分：前端/Rust gate 使用可靠语义解析并有 self-test。
- [ ] 4 分：所有历史 baseline 有退出并已收紧。
- [ ] 3 分：commands/app/shared/platform 高吸力层没有新回流。
- [ ] 2 分：长期文档和机器规则一致。

### 16.2 正确性与恢复能力：20 分

- [ ] 6 分：SQLite recovery 使用 typed classification。
- [ ] 4 分：高风险 IPC 使用稳定错误 code/retryable。
- [ ] 4 分：tracking 生命周期和 replay 行为完整回归。
- [ ] 4 分：migration/repair/restore 失败模式覆盖。
- [ ] 2 分：后台错误进入 diagnostics/health，不只依赖日志。

### 16.3 测试与验证可信度：20 分

- [ ] 6 分：现有 unit/replay/browser/Rust suite 稳定通过。
- [ ] 5 分：真实 Tauri runtime smoke 稳定通过。
- [ ] 3 分：静态 IPC command/DTO contract gate。
- [ ] 3 分：核心风险域覆盖率达到目标且不回退。
- [ ] 3 分：核心纯逻辑定向 mutation 达到目标。

### 16.4 可维护性与静态质量：15 分

- [ ] 5 分：最高风险热点职责和决策面显著下降。
- [ ] 3 分：React Hooks/async lint 全仓通过。
- [ ] 3 分：热点预算实际收紧并防止新厚文件。
- [ ] 2 分：Quiet Pro 样式使用语义 token/原型。
- [ ] 2 分：没有新兼容壳、公共垃圾桶和重复错误逻辑。

### 16.5 性能与 bundle：10 分

- [ ] 3 分：全部现有性能脚本通过 average/p95/max 预算。
- [ ] 3 分：真实 SQLite I/O 基准通过。
- [ ] 2 分：bundle warning 清零，initial/lazy owner 清晰。
- [ ] 2 分：预算按稳定基线收紧且未被无证据放宽。

### 16.6 可复现性与依赖治理：5 分

- [ ] 2 分：Node/Rust 工具链固定且本地/CI一致。
- [ ] 1 分：fmt/clippy/TS/lint 入口统一。
- [ ] 1 分：npm/Rust advisory 审计可重复。
- [ ] 1 分：CI artifacts、失败诊断和 release gate 完整。

最终计算：

- [x] 原始得分：`95.2 / 100`。
- [x] 架构维度：`28.5 / 30`，折算 `95 / 100`。
- [x] 正确性维度：`19.2 / 20`，折算 `96 / 100`。
- [x] 验证维度：`19.4 / 20`，折算 `97 / 100`。
- [x] 可维护性维度：`13.8 / 15`，折算 `92 / 100`。
- [x] 性能维度：`9.6 / 10`，折算 `96 / 100`。
- [x] 可复现性维度：`4.7 / 5`，折算 `94 / 100`。
- [x] 是否满足所有硬门槛：`是`。
- [x] 最终可辩护评分：`95.2 / 100`。

如果某项只有文档承诺、没有机器或运行证据，该项计 0 分。

## 17. 停止条件与回滚原则

### 17.1 必须停止并重新判断

- [ ] 为迁移一个 owner 需要同时修改三个以上不相关 owner。
- [ ] 端口方法与 SQL repository 方法一一对应，暴露出贫血抽象。
- [ ] app/commands 开始承接 engine 行为。
- [ ] data adapter 开始承接 tracking/tool/export 领域判断。
- [ ] 需要删除 migration/repair 才能降低热点。
- [ ] 新 gate 大量误报且无法用 owner 语义解释。
- [ ] runtime smoke 需要在 release 构建暴露测试接口。
- [ ] lint 修复要求大范围行为变化。
- [ ] 性能优化损害 tracking 可信度、启动或交互手感。
- [ ] 完整验证出现无法解释的非确定失败。

### 17.2 回滚原则

- [ ] 每个纵向切片保留迁移前行为测试。
- [ ] 回滚以 commit 边界完成，不使用破坏性 reset 覆盖用户改动。
- [ ] schema、持久化 key 和 IPC 合同变化必须有兼容策略。
- [ ] 新旧路径并存时必须有单一切换点和明确删除日期。
- [ ] 兼容壳只能转发，不能吸收新逻辑。
- [ ] 回滚后重新运行该切片专项验证。

## 18. 推荐提交切分

建议提交顺序：

1. `docs: add current architecture quality 95 plus execution plan`
2. `test: make frontend architecture guard syntax aware`
3. `test: expose engine data boundary debt in rust guard`
4. `refactor: introduce first engine data port at app composition root`
5. `refactor: decouple widget and updater engine persistence`
6. `refactor: decouple web activity engine persistence`
7. `refactor: decouple tools engine persistence`
8. `refactor: move export database access to data owner`
9. `refactor: decouple remote status bridge persistence`
10. `refactor: inject tracking data ports into runtime`
11. `refactor: add structured sqlite recovery errors`
12. `refactor: add structured command error contracts`
13. `test: add static ipc contract gate`
14. `test: add windows tauri runtime smoke`
15. `refactor: reduce frontend orchestration hotspots`
16. `refactor: split sqlite and storage migration responsibilities`
17. `refactor: reduce tracking runtime decision surface`
18. `refactor: replace page-local visual constants with quiet pro tokens`
19. `perf: load feature copy with lazy owners`
20. `test: add react hooks lint and coverage baselines`
21. `build: pin node and rust toolchains`
22. `perf: tighten runtime and bundle budgets`
23. `docs: update long-term architecture and quality rules`

实际提交可以进一步拆分，但不得把多个高风险 owner 压成一个超大提交。

## 19. 执行记录

### 2026-07-15：方案创建

- [x] 完成当前仓库对抗式架构与工程质量审查。
- [x] 确认旧的 2026-07-04 95+ 方案已完成并归档，不再作为当前执行依据。
- [x] 新方案只承接当前仍存在的差距。
- [x] 当前基线综合评分记录为 78 / 100。
- [x] 当前完整前端、Rust、browser、build、bundle 和性能证据已采集。
- [x] 阶段 A 至 J 全部完成；未达成的拉伸项按归档结论如实转为长期残余债务。

### 2026-07-15：完成、验证与归档

- [x] 完成 owner-first Rust 边界收口、结构化错误、静态 IPC 契约和真实 Tauri runtime smoke。
- [x] 完成 lint、覆盖率、mutation、依赖审计、热点/style debt、bundle 与稳定性能硬门禁。
- [x] 完成 Node/Rust 工具链固定，并使 Cargo 验证、性能与 runtime 构建使用 `--locked`。
- [x] 完成长期架构、工程质量、修复边界、贡献指南和 PR 模板回写。
- [x] 完成归档前对抗式复核；发现的 Cargo lock 漂移、Win32 实现回流、RustSec 宽泛忽略和 runtime 子进程残留缺口均已修复并重新验证。
- [x] 本执行单不再作为活动来源，后续以 top-level `docs/` 和机器门禁为准。

后续每次执行记录格式：

```text
日期：
阶段：
问题 ID：
提交：
修改 owner：
完成清单：
验证命令：
结果：
剩余风险：
下一步：
```
