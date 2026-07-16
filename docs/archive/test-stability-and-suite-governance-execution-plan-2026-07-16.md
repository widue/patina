# 测试稳定性与测试套件治理执行方案（2026-07-16）

## 0. 文档状态

- [x] 文档类型：一次性执行方案（How-to / maintainer runbook）。
- [x] 目标读者：Patina 维护者与获得仓库修改授权的协作者。
- [x] 用户目标：在不削弱 tracking、SQLite、恢复、UI 和真实桌面运行时保护的前提下，删除无效测试、合并语义重复测试、消除重复执行，并建立可长期维持的测试稳定性规则。
- [x] 当前状态：已完成并归档。
- [x] 当前执行位置：`docs/archive/`。
- [x] 实施完成后，将长期规则回写到 `docs/engineering-quality.md`。
- [x] 实施完成后，将本文状态改为“已完成并归档”。
- [x] 实施完成后，将本文移动到 `docs/archive/`。
- [x] 归档后，`docs/working/` 不保留活动副本。

本文是一次专项治理的执行依据，不是长期母文档。完成后，长期稳定规则以 `docs/engineering-quality.md` 为准。

### 0.1 完成摘要

- 基线 commit：`8c144e9d42679b5260e10b15139707d1f100d48b`；工作分支 `main`，执行前相对 `origin/main` ahead 13。
- 工具链：Windows `10.0.26100`、PowerShell `7.6.3`、Node `22.23.1`、npm `10.9.8`、Rust/Cargo `1.94.1`、Chrome `150.0.7871.124`。
- 资产结果：32 个顶层 TypeScript 测试入口全部有唯一叶子脚本 owner；30 个快速确定性入口由 `npm test` 恰好执行一次；browser 与 desktop runtime 保持独立层级。
- 治理结果：默认 `check` 中普通确定性测试重复入口由至少 7 个降为 0；删除 1 个无法证明其名称所声称行为的恒真断言，未删除任何独有风险保护。
- 稳定性结果：快速测试连续 5/5、browser smoke 连续 3/3、最终 runtime smoke 连续 3/3；失败轮次均保留在本节记录，没有以重跑掩盖失败。
- 保护结果：Coverage statements/lines `97.96%`、branches `88.88%`、functions `86.36%`；Mutation `8/8`；Rust `377 passed / 1 exact-allowlisted ignored`；依赖审计通过。
- 最终门禁：`npm run check`、`npm run check:rust`、`npm run check:dependencies`、`npm run check:full`、`npm run test:tauri-runtime-smoke` 全部通过。
- 长期规则已经回写 `docs/engineering-quality.md`；架构文档中的本地最小验证入口同步改为真实的全部快速测试语义。

勾选说明：本文归档时，所有执行项均标记为完成；停止条件与升级处理项的勾选表示“已逐项审查且未触发”，不表示曾执行回滚。

---

## 1. 问题定义

当前问题不是“测试数量太多”，而是测试增长后逐渐出现了以下风险：

- 默认验证链中，同一批确定性测试可能被重复执行。
- `npm test` 的名字与实际覆盖范围不一致，容易造成“以为全部跑过”的错误认知。
- 一部分测试可能只验证导入存在、源码文本或实现细节，却不能捕获独有的真实回归。
- unit、integration、SSR/source smoke、browser smoke、Tauri runtime smoke 和 performance test 的职责边界不够显式。
- 固定等待、轮询、进程退出、临时目录和真实浏览器生命周期可能成为 flaky test 来源。
- ignored、mutation、coverage 和专项性能测试如果没有明确例外规则，容易被误判为重复或被滥用为跳过失败的出口。
- 测试新增入口依赖人工修改 `package.json` 长命令，长期存在漏接、重复接入和顺序漂移风险。

本专项要解决的是“验证信号质量与维护成本”的问题，而不是追求更少的测试文件。

---

## 2. 第一性原理

### 2.1 测试的价值来自独有失败信号

一个测试的价值可以近似理解为：

```text
测试净价值
= 捕获独有回归的概率 × 回归损失
- 执行成本
- 维护成本
- 假阳性与不稳定成本
```

因此：

- 测试多不等于保护强。
- 断言多不等于信号质量高。
- 同一行为在同一层重复验证，通常只增加成本。
- 同一用户路径在不同真实层验证，可能是必要的纵深防御。
- 删除测试前必须证明它没有独有失败模式，不能只因为它慢或看起来重复。

### 2.2 默认门禁必须给出确定结论

默认门禁的职责是回答：当前提交是否可以继续进入主干或发布链。

因此默认门禁必须满足：

- 同一确定性套件在一次门禁中只执行一次。
- 失败即失败，不通过自动重跑把偶发失败伪装成通过。
- 时间、时区、语言、随机数、文件系统和进程生命周期可控制。
- 测试失败能定位到 owner 和失败层级。
- 超时只作为安全上限，不作为正常同步手段。

### 2.3 不同层必须保护不同风险

允许同一功能出现在多层测试中，但每一层必须证明不同事实：

| 层级 | 应证明的事实 | 不应承担的事实 |
| --- | --- | --- |
| Unit / Model | 纯函数、状态机、读模型和边界输入的确定行为 | 浏览器布局、真实 IPC、真实 SQLite 生命周期 |
| Integration / Contract | 模块组合、事务、缓存、序列化、协议和恢复语义 | 像素布局、真实桌面进程行为 |
| Structural / SSR Smoke | 模块可装配、SSR 可渲染、静态 owner 约束和无 runtime 首屏 | 真实点击、WebView2、SQLite plugin |
| Browser Smoke | 真实浏览器中的交互、焦点、布局、导航和控制台错误 | 真实 Tauri command 和 capability |
| Desktop Runtime | Tauri、WebView2、command、event、plugin、进程和落盘 | 大量纯函数排列组合 |
| Performance / Release | 平均值、P95、最大值、query plan、bundle 和发布产物 | 普通功能正确性的唯一证据 |

### 2.4 测试代码也属于生产级维护资产

测试可以使用 fixture 和 harness，但不能接受：

- 不可解释的固定 sleep。
- 无界重试。
- 靠执行顺序共享可变状态。
- 未清理的进程、端口、数据库和临时目录。
- 只检查内部函数名、源码片段或实现顺序，却声称保护用户行为。
- 为让门禁通过而降低覆盖率、mutation 分数或放宽预算。

### 2.5 治理的目标是更高信噪比，不是更短命令

如果一项高风险测试确实独有且稳定，即使执行较慢也应保留。优化顺序固定为：

1. 先消除重复执行。
2. 再删除无独有价值的断言。
3. 再改造不稳定同步方式。
4. 最后才考虑受控并行或更换框架。

---

## 3. 已确认的当前基线

### 3.1 TypeScript 测试资产

- [x] `tests/` 当前有 32 个顶层 `*.test.ts` 入口。
- [x] `tests/` 当前有 24 个 helper / scenario / grouped module。
- [x] TypeScript 测试相关文件合计 56 个。
- [x] 32 个顶层测试入口都能在 `package.json` 找到直接脚本入口；当前没有已确认的孤儿顶层测试。
- [x] `trackingLifecycle.test.ts`、`uiBrowserSmoke.test.ts` 是聚合入口，分别继续加载相邻子模块。

### 3.2 已确认的重复执行

当前 `npm run check` 的执行图为：

```text
check
├─ test:coverage
│  └─ test:risk-domains
│     ├─ test                  -> trackingLifecycle.test.ts
│     ├─ test:replay           -> trackingReplay.test.ts
│     ├─ test:history-timeline -> 4 个 History 测试入口
│     ├─ test:persistence      -> persistenceTransaction.test.ts
│     └─ dashboardSnapshotLoader.test.ts
└─ check:frontend
   ├─ test                     -> 再次执行
   ├─ test:replay              -> 再次执行
   ├─ test:history-timeline    -> 再次执行 4 个入口
   ├─ test:persistence         -> 再次执行
   └─ 其余前端测试、UI smoke、browser smoke、build、bundle
```

- [x] 已确认一次 `npm run check` 中至少有 7 个顶层测试入口完整执行两次。
- [x] 上述重复不包含 mutation 的有意变异验证；mutation 必须单独评估，不按普通重复执行处理。
- [x] 阶段 A 记录每个重复入口的实际执行次数和累计耗时。
- [x] 阶段 A 记录 `check`、`check:frontend`、`test:coverage` 的独立 wall-clock 基线。

### 3.3 已确认的命名问题

- [x] 当前 `npm test` 只执行 `tests/trackingLifecycle.test.ts`。
- [x] 当前 `npm test` 不代表全部快速确定性测试。
- [x] 实施后，`npm test` 必须成为“全部快速确定性 TypeScript 测试”的稳定入口。

### 3.4 已确认的低价值候选

`tests/trackingLifecycle.test.ts` 中的：

```text
tracking lifecycle entrypoint keeps grouped modules wired once
```

当前只断言已导入的 runner 是函数：

- 导入失败时，模块本身已经无法运行。
- 忘记调用某个 runner 时，这些 `typeof` 断言仍可能通过。
- 它不能证明名称所声称的“正确接线且只接一次”。

因此它是已确认的首个删除或重写候选，但仍需按阶段 C 的删除证据流程处理。

### 3.5 已确认的分层事实

- [x] `uiSmoke.test.ts` 主要承担源码/SSR/装配类检查。
- [x] `uiBrowserSmoke.test.ts` 使用真实浏览器和 Vite，但使用 Tauri stub。
- [x] `tauriRuntimeSmoke.test.ts` 使用真实 Tauri/WebView2、IPC、plugin SQL 和隔离数据目录。
- [x] 三者运行边界不同，不能仅因场景名称相似而整体合并。
- [x] 阶段 D 逐项清理三层之间重复的静态文案和结构断言。

### 3.6 Rust 与特殊测试

- [x] Rust 测试由 Cargo module tree 自动发现，当前没有独立 `src-tauri/tests/` 目录。
- [x] 当前已确认一个 `#[ignore]`：SQLite query-plan 诊断测试。
- [x] 该 ignored 测试带有明确原因，并指向 `npm run perf:sqlite-query-plan`。
- [x] 当前 mutation 脚本包含 8 个关键 mutant，并有独立 mutation 分数门槛。
- [x] 阶段 A 重新记录 Rust passed / ignored 数量，不沿用历史报告数字。
- [x] 阶段 E 审计所有 Rust 测试中的真实 sleep、线程 sleep 和超时同步。

---

## 4. 范围与非目标

### 4.1 本次范围

- [x] `package.json` 中所有 `test:*`、`check:*` 和测试可达链路。
- [x] `tests/**/*.test.ts` 及其 helper、scenario 和 harness。
- [x] `scripts/check-critical-mutations.ts`。
- [x] 新增或扩展测试治理机器门禁。
- [x] Rust 内联 `#[test]`、`#[tokio::test]` 和 `#[ignore]` 的治理规则。
- [x] SSR/source smoke、browser smoke 与 Tauri runtime smoke 的职责矩阵。
- [x] 固定 sleep、条件轮询、超时、进程、端口、临时目录和数据库清理。
- [x] `docs/engineering-quality.md` 的长期测试稳定性规则。
- [x] CI 中测试入口与本地入口的一致性。

### 4.2 非目标

- [x] 不为了减少测试数量修改产品行为。
- [x] 不借机重构 tracking、SQLite、History、Data 或 Tauri runtime 生产实现。
- [x] 不降低 coverage 阈值。
- [x] 不降低 mutation score 阈值。
- [x] 不放宽 bundle、性能、IPC、架构或 Rust 边界门禁。
- [x] 不通过自动重试掩盖 flaky test。
- [x] 不以“CI 太慢”为理由删除备份、恢复、migration、tracking、runtime 等独有高风险验证。
- [x] 不在没有收益证据时引入新的测试框架或大型依赖。
- [x] 不默认并行运行共享数据库、共享端口或真实桌面进程测试。
- [x] 不把 performance test 混入普通 unit test，并用机器性能波动决定功能正确性。

---

## 5. 完成定义与硬门槛

只有同时满足以下条件，专项才允许标记完成：

### 5.1 执行图

- [x] `npm test` 执行全部快速确定性 TypeScript 测试。
- [x] `npm run check` 中每个普通确定性顶层测试入口只执行一次。
- [x] coverage 包含的测试不再由后续 frontend 链重复执行。
- [x] mutation 的有意重复有明确独立入口，不被治理脚本误报。
- [x] browser smoke、Tauri runtime smoke、performance suite 的独立层级保持清晰。

### 5.2 测试资产

- [x] 所有顶层 `tests/*.test.ts` 都有且只有一个叶子脚本 owner。
- [x] 所有顶层测试都能从 `npm test`、追加风险门禁或显式专项入口之一到达。
- [x] 不存在只验证导入存在、常量等于自身或已由编译器必然保证的断言。
- [x] 每个保留的跨层重复场景都写清不同失败模式。
- [x] 删除的每项测试都有替代保护或“无独有失败模式”的证据。

### 5.3 稳定性

- [x] 默认测试不存在失败后自动重跑。
- [x] 不使用固定 sleep 等待可观测状态变化；确需验证时间窗口的测试有明确理由和上限。
- [x] 浏览器测试使用条件等待，不使用固定等待作为正常同步。
- [x] 真实进程、端口、临时目录和数据库在成功、失败、超时三条路径都能清理。
- [x] 测试不依赖执行顺序和前一个测试留下的状态。
- [x] 时区、日期、语言、主题、localStorage 和随机输入具有明确 fixture 或恢复逻辑。

### 5.4 保护强度

- [x] 原有风险域 coverage 阈值不降低。
- [x] 8 个关键 mutant 仍全部被杀死，或新增更强 mutant；不得减少后宣称等价。
- [x] Rust 全量测试通过，ignored 只保留精确允许项。
- [x] SSR/source smoke、browser smoke、Tauri runtime smoke 全部通过。
- [x] `npm run check:full` 通过。
- [x] 追加执行 `npm run test:tauri-runtime-smoke` 通过。

### 5.5 成本

- [x] 记录治理前后 `npm test`、`npm run check`、`npm run check:full` 的 wall-clock。
- [x] 默认门禁重复入口数从当前至少 7 个降为 0。
- [x] 不预设必须达到某个百分比提速；最终只报告同机、同工具链、同负载下的真实结果。
- [x] 如果执行时间没有下降，必须解释新增了什么独有保护，不能只说“测试更多所以合理”。

---

## 6. 测试分类与保留判定规则

### 6.1 每个测试入口必须填写的审计字段

阶段 B 对每个顶层测试入口记录：

- [x] 文件路径。
- [x] 真实 owner。
- [x] 层级：unit/model、integration/contract、structural/SSR、browser、desktop runtime、performance/release。
- [x] 保护的真实失败模式。
- [x] 是否接触时间、文件系统、网络、端口、浏览器、数据库或子进程。
- [x] 当前入口脚本。
- [x] 在默认门禁中的执行次数。
- [x] 与其他测试的重叠点。
- [x] 建议：保留、重命名、拆分、合并、删除或升级层级。
- [x] 判定证据。

### 6.2 保留条件

满足任一项可以保留：

- [x] 能捕获其他测试无法捕获的高风险回归。
- [x] 在更低成本的层级验证了大量边界组合，替代更昂贵的上层排列组合。
- [x] 验证真实环境边界，例如 WebView2、Tauri IPC、SQLite plugin 或进程退出。
- [x] 验证数据不变量、恢复原子性、升级兼容或 tracking 时序。
- [x] 作为契约测试，防止前后端、Rust/TypeScript 或写入/读取协议漂移。

### 6.3 合并条件

同时满足以下条件时优先合并：

- [x] 相同层级。
- [x] 相同生产入口或相同状态转换。
- [x] fixture 高度重复。
- [x] 失败后给出的诊断信息等价。
- [x] 合并不会让单个测试同时验证多个无关 owner。

### 6.4 删除条件

满足任一项即可进入删除候选，但删除前仍需验证：

- [x] 断言由 TypeScript/Rust 编译器或模块加载必然保证。
- [x] 断言只复述实现，没有保护稳定行为或契约。
- [x] 删除目标后，另一项更低层、更稳定的测试能捕获相同 mutant。
- [x] 上层 smoke 只重复下层所有断言，没有增加真实环境事实。
- [x] 测试对应的产品行为已经正式移除，且不存在兼容窗口。
- [x] 测试长期无法失败，人工注入对应缺陷后仍通过。

### 6.5 禁止删除的理由

以下理由单独出现时不能删除测试：

- 测试文件很长。
- 测试执行较慢。
- 已经有很多测试。
- 当前实现看起来简单。
- 最近没有失败过。
- coverage 在删除后仍高于阈值。

---

## 7. 阶段 A：冻结基线与构建测试执行图

### A1. 冻结工作区与工具链

- [x] 记录当前 commit：`git rev-parse HEAD`。
- [x] 确认工作区没有混入无关产品改动。
- [x] 运行 `node --version`，必须匹配 `.node-version`。
- [x] 运行 `rustup show active-toolchain`，必须来自 `rust-toolchain.toml`。
- [x] 记录 Windows、PowerShell、Node、npm、Rust 和浏览器版本。
- [x] 关闭会显著干扰计时的额外开发服务；不得关闭 Patina 正式版或删除用户数据。

### A2. 生成 TypeScript 测试注册表

- [x] 枚举 `tests/*.test.ts`。
- [x] 枚举 `tests/**` 下的 helper 和 scenario 模块。
- [x] 解析 `package.json` 中直接引用测试入口的叶子脚本。
- [x] 标记未注册入口。
- [x] 标记被两个以上叶子脚本直接引用的入口。
- [x] 递归展开 `npm test`、`test:coverage`、`check:frontend`、`check`、`check:full`。
- [x] 为每个入口计算在每条门禁中的执行次数。
- [x] 区分普通重复、coverage 包装、mutation 和独立 runtime job。

### A3. 生成 Rust 测试注册表

- [x] 运行 `cargo test --manifest-path src-tauri/Cargo.toml --locked -- --list`。
- [x] 保存 passed candidate、ignored candidate 和 doctest 数量。
- [x] 搜索全部 `#[ignore]`，记录文件、测试名、原因和替代命令。
- [x] 搜索独立测试模块是否已经进入 crate module tree。
- [x] 确认不存在仅存放在未引用 `.rs` 文件中的测试。

### A4. 记录运行时间

每个命令至少冷、热各运行一次；稳定性对比使用热运行并串行执行：

- [x] `npm test`。
- [x] `npm run test:coverage`。
- [x] `npm run check:frontend`。
- [x] `npm run check`。
- [x] `npm run check:rust`。
- [x] `npm run check:full`。
- [x] `npm run test:tauri-runtime-smoke`。

记录字段：

- [x] wall-clock。
- [x] 测试入口执行次数。
- [x] 测试用例通过/失败/ignored 数量。
- [x] 子进程数量。
- [x] 失败时是否遗留进程、端口或临时目录。
- [x] 日志中是否存在被吞掉的 warning、unhandled rejection 或 cleanup error。

### A5. 阶段验收

- [x] 32 个顶层 TypeScript 入口均进入注册表。
- [x] Rust 测试数量来自本轮命令，不沿用旧文档。
- [x] 默认门禁重复执行图可视化完成。
- [x] 所有后续删除、合并和提速均能与该基线比较。
- [x] 本阶段不修改测试行为。

---

## 8. 阶段 B：逐入口建立风险 owner 与独有失败模式

### B1. 快速 unit / model 测试

- [x] 审计 tracking lifecycle 与 replay 的边界差异。
- [x] 审计 `trackingLifecycle/historyReadModel.ts` 与独立 `historyReadModel.test.ts` 是否保护不同 owner。
- [x] 审计 History timeline、web activity、formatting 和 snapshot cache 是否存在重复 fixture 或重复边界组合。
- [x] 审计 Data read model、range、chart interaction、search 和 first-paint scheduler 的 owner 是否清楚。
- [x] 审计 classification、settings、widget、update、tools、preload 和 tracker health 测试。
- [x] 将只验证 localStorage key、copy key、常量枚举的测试标为 contract 或低价值候选，不能混称用户行为测试。

### B2. 跨 feature integration 测试

- [x] 逐项审计 `interactionFlows.test.ts`。
- [x] 将其中每个场景与 classification/settings/widget/history 专项测试对照。
- [x] integration 场景只保留跨 owner 协作结果，不重复专项模块的全部输入排列。
- [x] 如果 integration 仅直接调用单个 owner 的纯函数，将场景下沉或删除。

### B3. Persistence 与协议测试

- [x] 审计 `persistenceTransaction.test.ts` 与 mutation 脚本的重叠。
- [x] 普通测试负责行为契约，mutation 负责证明关键错误能被杀死；两者不互相替代。
- [x] 审计 `exportFieldContract.test.ts` 与 Rust export 默认字段测试是否分别保护跨语言契约和 Rust 内部行为。
- [x] 审计 IPC contract gate 与 runtime smoke：静态注册一致性和真实调用成功必须分别保留。

### B4. UI 三层矩阵

对每个 UI 场景建立矩阵：

- [x] structural/SSR 是否只验证装配或静态政策。
- [x] browser 是否验证真实 DOM、交互、焦点、布局或控制台。
- [x] runtime 是否验证 Tauri、IPC、plugin、capability 或进程。
- [x] 同一文案或 selector 不在三层重复作为核心断言。
- [x] source-string 断言如果已有 AST gate 或行为测试，进入删除候选。
- [x] browser 场景不重复 unit 层的所有状态排列。
- [x] runtime smoke 不重复 browser 的全部视觉场景。

优先审计：

- [x] 主导航与七个页面装配。
- [x] History/Data 首次进入和热切换。
- [x] Settings dialog。
- [x] History timeline list/zoom dialog。
- [x] 数据导出字段与格式说明。
- [x] Tools runtime 状态入口。
- [x] update dialog 与 release notes。

### B5. 阶段验收

- [x] 32 个顶层 TypeScript 入口均有 layer、owner、failure mode 和建议结论。
- [x] 所有跨层重复都有保留理由或删除候选。
- [x] 不以文件名相似直接判定重复。
- [x] 高风险测试没有因为执行时间长被直接降级。

### B6. 32 个顶层 TypeScript 入口最终审计表

| 顶层入口 | 层级 | 风险 owner | 独有失败模式 | 结论 |
| --- | --- | --- | --- | --- |
| `backgroundReturnHomePolicy.test.ts` | unit / policy | app 后台返回策略 | 长后台错误重置当前页面或把缓存预算当导航策略 | 保留 |
| `classificationDraftState.test.ts` | unit / model | classification 草稿状态 | 冷启动升级、未知设置或手工分类草稿丢失 | 保留 |
| `dashboardIconRuntimeCache.test.ts` | integration | Dashboard 图标运行时缓存 | alias 扩展、miss 退避或缓存上界失效 | 保留 |
| `dashboardSnapshotLoader.test.ts` | integration | Dashboard snapshot loader | mapper 初始化顺序、缓存复用或加载结果漂移 | 保留 |
| `dataAppSearch.test.ts` | unit / model | Data 应用搜索 | 去重、过滤和选中项恢复错误 | 保留 |
| `dataChartInteraction.test.ts` | unit / adapter | Data 图表交互 | Recharts 不同 payload 形态解析出错误日期 | 保留 |
| `dataFirstPaintScheduler.test.ts` | unit / scheduler | Data 首帧调度 | 重任务早于首帧、取消失效或 idle 顺序漂移 | 保留 |
| `dataReadModel.test.ts` | unit + integration | Data 读模型与缓存 | 跨日切分、范围裁剪、聚合、缓存或 bootstrap 错误 | 保留 |
| `dataTrendRange.test.ts` | unit / model | Data 趋势范围 | 自然周期、ISO 跨年、自定义选择或粒度错误 | 保留 |
| `exportFieldContract.test.ts` | cross-language contract | 导出字段协议 | 前端默认字段与 Rust 允许字段漂移 | 保留 |
| `exportRange.test.ts` | unit / model | 导出范围与偏好 | 包含日边界、反向范围、格式/字段偏好错误 | 保留 |
| `historyFormatting.test.ts` | unit / formatting | History 时间格式 | 英文环境退回 12 小时制或午夜/时长格式错误 | 保留 |
| `historyReadModel.test.ts` | integration | History snapshot/cache | 可选 Web 读取失败拖垮应用历史或缓存串日期 | 保留 |
| `historyTimelineViewModel.test.ts` | unit / model | History 时间线 | 缩放、裁剪、dominant minute、合并或 lane 错误 | 保留 |
| `historyWebActivityViewModel.test.ts` | unit / model | History Web 时间线 | domain、favicon、标题明细、范围裁剪或合并错误 | 保留 |
| `iconThemeColors.test.ts` | unit / algorithm | 图标主题色 | 背景色压过主体、透明边缘或 fallback 不稳定 | 保留 |
| `interactionFlows.test.ts` | integration | 跨 feature 交互 | settings/classification/widget/history owner 协作语义漂移 | 保留 |
| `persistenceTransaction.test.ts` | integration / contract | SQLite 写入事务适配 | 写入乱序、失败后继续、错误规范化或队列串行化失效 | 保留 |
| `prIntakeGate.test.ts` | policy contract | 外部 PR intake | scope、owner、diff、风险覆盖门禁被绕过 | 保留 |
| `releasePolicy.test.ts` | policy contract | 版本与发布策略 | 版本、changelog、tag、资产规则漂移 | 保留 |
| `settingsPageState.test.ts` | unit + integration | Settings 页面状态 | 先同步后持久化、部分成功丢失或外部同步覆盖错误 | 保留 |
| `startupWarmupService.test.ts` | integration | 启动预热服务 | 任务顺序、失败隔离、hidden autostart 或缓存上界错误 | 保留 |
| `tauriRuntimeSmoke.test.ts` | desktop runtime | Tauri/WebView2/IPC/SQLite | 静态测试无法发现的真实 command、event、plugin、capability、落盘失败 | 保留且独立运行 |
| `toolsRuntime.test.ts` | unit + integration | Tools 运行时 | DTO 映射、候选缓存、状态 store、gateway/listener 生命周期错误 | 保留 |
| `trackerHealthPollingService.test.ts` | unit + integration | tracker health | pending 轮询重入、停止后发布、失败后不恢复或 fallback 错误 | 保留 |
| `trackingLifecycle.test.ts` | unit + integration | tracking 生命周期 | session 切换、AFK、cleanup、stale tracker、映射、运行时刷新错误 | 保留；删除 1 个恒真接线断言 |
| `trackingReplay.test.ts` | replay / integration | tracking 历史回放 | 真实序列组合下 alias、cleanup、stale live、小时聚合不一致 | 保留 |
| `uiBrowserSmoke.test.ts` | browser | 真实 DOM/交互/布局 | 导航、焦点、弹窗、控制台、响应宽度和页面交互回归 | 保留且条件等待 |
| `uiSmoke.test.ts` | structural / SSR | App 装配与静态政策 | 页面/监听器/owner 装配缺失、SSR 无 runtime 崩溃 | 保留，不冒充浏览器行为 |
| `updateViewModel.test.ts` | unit / model | 更新视图模型 | 下载/安装状态、fallback、release note、进度语义错误 | 保留 |
| `viewChunkPreloadService.test.ts` | unit + integration | 页面 chunk 预加载 | 顺序、取消、失败隔离、pending 复用或重试错误 | 保留 |
| `widgetViewModel.test.ts` | unit / model | Widget 视图模型 | 展开、拖动、吸附、竞态收尾或持久化错误 | 保留 |

审计结论：32/32 均有明确 owner 和独有失败模式；没有文件级测试入口满足删除条件。唯一删除项是 `trackingLifecycle.test.ts` 内部的恒真 `typeof runner` 断言，因为移除真实 runner 调用时它仍可通过，不能保护“正确接线且只接一次”。

---

## 9. 阶段 C：验证并处理无效、重复与过度耦合测试

### C1. 首个低价值候选

- [x] 对 `tracking lifecycle entrypoint keeps grouped modules wired once` 人工移除一个 runner 调用，确认当前断言是否仍通过。
- [x] 如果仍通过，记录它无法保护名称所声称行为的证据。
- [x] 选择删除，或改成真实 runner 调用计数/结果汇总契约。
- [x] 优先删除；只有确实存在重复注册风险时才引入真实接线测试。
- [x] 删除后运行完整 tracking lifecycle 与 replay。

### C2. 候选删除的统一验证

每个候选按以下步骤执行：

- [x] 写出它声称捕获的具体缺陷。
- [x] 确认另一测试或机器门禁是否覆盖同一缺陷。
- [x] 在临时工作区人工注入该缺陷或构造等价 mutant。
- [x] 记录哪些测试失败。
- [x] 如果只有候选测试失败，默认保留。
- [x] 如果更稳定、更低层测试已经失败，候选可删除或收窄。
- [x] 撤销人工缺陷。
- [x] 运行删除后的专项测试和默认门禁。

### C3. 重复 fixture 与 helper

- [x] 只合并稳定领域 fixture，不建立跨 feature 万能 test helper。
- [x] 测试数据构造器继续由最小 owner 持有。
- [x] 不为了减少代码行把不相关测试耦合到共享可变 fixture。
- [x] helper 必须无隐式全局状态，或提供明确 reset。
- [x] browser selector helper 与业务 fixture 分离。

### C4. 测试命名

- [x] 测试名描述前置条件、动作和可观察结果。
- [x] 删除“works”“handles correctly”“keeps wired”等无法说明失败模式的宽泛名称。
- [x] smoke 测试名明确运行环境：SSR、browser stub、desktop runtime。
- [x] contract 测试名明确双方：frontend/Rust、caller/command、writer/reader。

### C5. 阶段验收

- [x] 所有删除项都有证据记录。
- [x] 没有通过删除断言来让 coverage 或 mutation 更容易通过。
- [x] tracking、SQLite、backup/restore、migration 和 runtime 独有保护未减少。
- [x] 测试总数变化如实报告，不把“减少数量”当完成指标。

---

## 10. 阶段 D：重构测试命令执行图

### D1. 目标命令语义

目标入口建议如下，实施前根据阶段 A 数据确认最终命名：

```text
npm test
└─ test:fast
   ├─ test:fast:covered
   └─ test:fast:remaining

test:coverage
└─ c8 test:fast:covered

check:tests
├─ test:coverage
├─ test:fast:remaining
├─ test:mutation
├─ test:ui-smoke
└─ test:ui-browser-smoke

check
├─ static gates
├─ check:tests
├─ build
└─ bundle

check:full
├─ check
├─ check:rust
└─ check:dependencies
```

原则：

- `npm test` 是开发者快速确定性入口。
- coverage 覆盖的入口不在同一次 `check` 中再次执行。
- `test:fast:covered` 与 `test:fast:remaining` 互斥且并集等于全部快速测试。
- browser/runtime/performance 不冒充快速 unit test。
- 保留 feature 专项命令，方便局部开发；专项命令是否被聚合由唯一组合入口负责。

### D2. 具体步骤

- [x] 列出全部快速测试叶子脚本。
- [x] 将 coverage 风险域入口放入 `test:fast:covered`。
- [x] 将其余快速入口放入 `test:fast:remaining`。
- [x] 验证两个集合没有交集。
- [x] 验证两个集合覆盖全部快速入口。
- [x] 将 `npm test` 改为运行两组集合。
- [x] 新增或调整 `check:tests`。
- [x] 从 `check:frontend` 删除已经由 `check:tests` 执行的普通测试。
- [x] 保留 `check:frontend` 的 UI browser、build 和 bundle 职责，或按最终命名拆成更清晰的 `check:ui-build`。
- [x] 调整 `check`，确保每个入口只到达一次。
- [x] 调整 `docs/engineering-quality.md` 中默认门禁清单。
- [x] 调整 CI，仅调用稳定聚合入口，不复制内部测试列表。

### D3. Coverage 验证

- [x] 证明 c8 能覆盖嵌套 npm 子进程。
- [x] 对比治理前后的 json-summary。
- [x] statements、branches、functions、lines 均不得下降到阈值以下。
- [x] 覆盖文件 include 列表继续按风险 owner 管理。
- [x] 不用运行无关低风险测试稀释覆盖率。

### D4. 阶段验收

- [x] `npm test` 语义与名称一致。
- [x] `npm run check` 普通测试入口重复数为 0。
- [x] 所有 feature 专项测试仍可独立运行。
- [x] `npm run check` 与 CI 使用同一聚合入口。
- [x] package script 不再依赖一条不可审计的超长重复列表。

---

## 11. 阶段 E：消除 flaky test 来源

### E1. 时间控制

- [x] 搜索 TypeScript 测试中的 `setTimeout`、固定毫秒等待和真实 `Date.now()`。
- [x] 搜索 Rust 测试中的 `sleep`、`thread::sleep`、`tokio::time::sleep`。
- [x] 区分三类用途：模拟业务时间、等待状态、外层超时保护。
- [x] 模拟业务时间改用注入时钟或显式 timestamp。
- [x] 等待状态改用条件轮询、channel、barrier、latch 或可观察事件。
- [x] 外层超时只负责防止无限挂起，不参与正常通过条件。

已知优先审计点：

- [x] `uiBrowserSmoke/historyScenarios.ts` 中的 350ms 固定等待。
- [x] `uiBrowserSmoke/settingsScenarios.ts` 中的 50ms 固定等待。
- [x] `check-critical-mutations.ts` 中的 20ms 顺序模拟和 200ms 外层超时。
- [x] Rust tracking `window_polling` 测试中的线程 sleep。
- [x] 真实 runtime smoke 的启动、CDP、退出和数据库释放等待。

### E2. Retry 与轮询规则

- [x] 禁止“测试失败后重新执行整个测试直至通过”。
- [x] 允许为进程启动、CDP 连接、DOM 状态和文件释放做有界条件轮询。
- [x] 条件轮询必须记录目标条件、总超时和最后一次观测值。
- [x] `retryDelay` 只能是轮询间隔，不能吞掉最终失败。
- [x] 不允许 `catch {}` 后继续把测试记为通过。
- [x] mutation 中预期的 rejected promise 必须只在精确作用域处理，不扩大成全局吞错惯例。

### E3. 隔离与清理

- [x] 每个真实数据库测试使用独立临时目录或独立数据库。
- [x] 文件名包含唯一运行标识，避免并发冲突。
- [x] 成功、断言失败和超时都执行 cleanup。
- [x] Tauri runtime smoke 核对启动路径，只终止本测试创建的进程。
- [x] Vite、Tauri、WebView2/CDP 子进程退出有上限并验证真实消失。
- [x] 临时目录删除前验证绝对路径属于预期测试根目录。
- [x] 测试后数据库可重新打开并通过完整性检查。
- [x] 端口采用隔离或动态分配，不依赖固定端口碰巧空闲。

### E4. 环境确定性

- [x] 日期测试显式使用本地日期 helper 或固定时区假设。
- [x] 跨 DST、跨年、周起始日测试显式构造日期，不依赖运行当天。
- [x] 中英文测试显式设置 locale，并在结束后恢复。
- [x] 主题、localStorage、sessionStorage、缓存和 mapping override 在每项测试前后重置。
- [x] 随机数据使用固定 seed；不需要随机的测试使用固定 fixture。
- [x] 文件系统路径比较按 Windows 语义处理，但不污染跨平台纯逻辑测试。

### E5. 阶段验收

- [x] 无解释固定 sleep 数量为 0。
- [x] 默认门禁无自动重跑。
- [x] 连续运行关键测试至少 5 次，结果一致。
- [x] runtime smoke 连续运行至少 3 次，无残留进程和临时目录。
- [x] 任何保留的真实等待都有注释、独有目的和明确上限。

---

## 12. 阶段 F：ignored、skip、mutation 与例外治理

### F1. ignored / skip 规则

- [x] `#[ignore]` 不能用于隐藏 flaky test。
- [x] ignored 测试必须写明原因。
- [x] ignored 测试必须有可执行的显式入口。
- [x] ignored 测试必须属于 performance、manual environment 或破坏性诊断之一。
- [x] 普通正确性测试不得长期 ignored。
- [x] TypeScript 不允许 `.only`、未登记 `.skip` 或注释掉的测试调用。

### F2. 当前 query-plan ignored

- [x] 验证其替代入口确实执行对应测试，而不是只运行另一份脚本。
- [x] 验证性能脚本失败时退出码非零。
- [x] 保留精确 allowlist，不允许目录级 ignore。

### F3. Mutation

- [x] 8 个 mutant 每个都修改真实生产模块。
- [x] 每个 mutant 的 search 文本失效时必须失败，不能静默跳过。
- [x] mutation baseline 先通过，再执行 mutant。
- [x] mutation 产生的预期 rejected promise 不得掩盖基线错误。
- [x] mutation 临时目录始终清理。
- [x] mutation 分数不低于当前门槛；关键 mutant 不得为了提速删除。

### F4. 阶段验收

- [x] ignored/skip/only 清单可机器验证。
- [x] 唯一允许的 ignored 项与专项入口一致。
- [x] mutation 结果稳定、可解释且不依赖普通测试重复执行。

---

## 13. 阶段 G：建立测试治理机器门禁

### G1. 新门禁职责

建议新增 `scripts/check-test-suite-governance.ts`，至少检查：

- [x] 枚举所有顶层 `tests/*.test.ts`。
- [x] 每个入口由且仅由一个叶子测试脚本直接拥有。
- [x] 每个入口能从快速、browser、runtime、performance/release 之一到达。
- [x] 展开 `npm run check` 后，普通确定性入口执行次数不超过 1。
- [x] coverage/mutation/runtime 的允许重复使用精确语义规则，不用通配豁免。
- [x] 检查 `.only`、未允许 `.skip` 和未说明 `#[ignore]`。
- [x] 检查测试入口引用不存在的文件。
- [x] 检查存在但未注册的顶层测试入口。

### G2. 门禁自测

门禁必须提供 `--self-test`，至少注入：

- [x] 一个未注册测试文件。
- [x] 一个被两个叶子脚本引用的测试。
- [x] 一个在 `check` 中递归执行两次的入口。
- [x] 一个不存在的测试路径。
- [x] 一个 `.only`。
- [x] 一个无原因 ignored。
- [x] 一个合法的 performance ignored 例外。
- [x] 一个合法的 mutation/coverage 包装场景。

### G3. 接入

- [x] 新增 `check:test-governance`。
- [x] 新增 `check:test-governance:self-test`。
- [x] 两者进入 `npm run check` 的静态门禁阶段。
- [x] CI 只调用 `npm run check` / `check:full`，不复制新门禁命令。
- [x] `docs/engineering-quality.md` 解释门禁保护什么，不复制易漂移的完整测试文件清单。

### G4. 阶段验收

- [x] 人工创建孤儿测试时门禁失败，撤销后通过。
- [x] 人工重复接入同一入口时门禁失败，撤销后通过。
- [x] 合法 coverage 和 mutation 不误报。
- [x] 门禁自身执行时间保持轻量，不运行实际测试。

---

## 14. 阶段 H：完整验证与对抗式复核

### H1. 功能与静态验证

- [x] `npm run check:types`。
- [x] `npm run check:lint`。
- [x] `npm run check:test-governance:self-test`。
- [x] `npm run check:test-governance`。
- [x] `npm test`。
- [x] `npm run test:coverage`。
- [x] `npm run test:mutation`。
- [x] `npm run test:ui-smoke`。
- [x] `npm run test:ui-browser-smoke`。
- [x] `npm run check`。
- [x] `npm run check:rust`。
- [x] `npm run check:dependencies`。
- [x] `npm run check:full`。
- [x] `npm run test:tauri-runtime-smoke`。

### H2. 连续稳定性验证

- [x] 快速测试连续 5 次通过。
- [x] browser smoke 连续 3 次通过。
- [x] Tauri runtime smoke 连续 3 次通过。
- [x] 每次运行后检查 node、Patina 测试进程、端口和临时目录。
- [x] 不允许把失败轮次删除后只报告最后一次通过。

### H3. 对抗式问题

- [x] 删除某个测试后，是否真的有另一证据捕获其失败模式？
- [x] coverage 是否因为执行了更多无关测试而看起来更高？
- [x] mutation 是否只是验证 mutation 脚本自己，而没有变异真实模块？
- [x] browser 测试是否仍有固定 sleep 掩盖竞态？
- [x] runtime smoke 是否可能误杀用户安装版进程？
- [x] ignored 是否成为性能之外的失败逃生口？
- [x] `npm test` 是否真的覆盖所有快速入口？
- [x] `npm run check` 是否仍通过嵌套脚本间接重复执行？
- [x] 新治理脚本是否变成难维护的第二份 package script 清单？
- [x] 是否为了让工作流更漂亮而弱化了关键恢复、tracking 或数据测试？

### H4. 性能对比

- [x] 使用阶段 A 同一机器和同一口径重测。
- [x] 对比 `npm test`。
- [x] 对比 `npm run check`。
- [x] 对比 `npm run check:full`。
- [x] 报告绝对时间、变化比例、入口数量和重复次数。
- [x] 分开报告首次冷运行与依赖已热的运行。
- [x] 不把受缓存影响的单次最优值当最终结果。

### H5. 阶段验收

- [x] 所有硬门槛通过。
- [x] 无残留工作进程和诊断目录。
- [x] 删除、合并、保留清单完整。
- [x] 新增长期规则与实际机器门禁一致。
- [x] 对抗式复核未发现通过放宽口径取得的“优化”。

---

## 15. 长期规范回写

完成后，只把稳定规则写入 `docs/engineering-quality.md`：

- [x] 测试按 unit/model、integration/contract、structural/SSR、browser、desktop runtime、performance/release 分层。
- [x] 默认门禁中的普通确定性测试只执行一次。
- [x] `npm test` 是全部快速确定性测试入口。
- [x] 新测试必须说明 owner、层级和独有失败模式。
- [x] 删除测试必须提供替代保护或无独有价值证据。
- [x] 禁止自动重跑掩盖 flaky test。
- [x] 固定 sleep 只允许验证时间语义或作为外层超时，不用于等待状态。
- [x] ignored/skip 必须精确、可执行、不可用于隐藏失败。
- [x] 真实进程、数据库、端口和临时目录必须在失败路径清理。
- [x] 测试治理门禁与自测属于默认 `npm run check`。

不回写以下一次性内容：

- [x] 当前具体重复文件数量。
- [x] 本轮删除的测试名单。
- [x] 本轮执行耗时。
- [x] 阶段流水账。

这些内容只保留在归档后的本文中，作为审计历史。

---

## 16. 停止条件与升级处理

出现以下任一情况，立即停止当前删除/合并动作：

- [x] 无法说明候选测试的真实 owner。
- [x] 删除后 tracking、SQLite、backup/restore、migration 或 runtime 风险失去唯一保护。
- [x] 必须修改生产行为才能让测试结构变整齐。
- [x] coverage 或 mutation 下降且无法证明是统计口径错误。
- [x] browser/runtime flaky 原因指向真实产品竞态，而不是测试同步问题。
- [x] 需要引入全局 test facade、跨 feature 万能 fixture 或新共享桶。
- [x] runtime smoke 清理逻辑可能触碰用户正式版进程或数据目录。
- [x] 命令图重构导致 CI 与本地使用不同测试集合。

停止后处理：

1. [x] 恢复到最近一个可验证提交。
2. [x] 记录阻断证据。
3. [x] 判断是测试治理问题，还是暴露了生产竞态/owner 错误。
4. [x] 如果涉及生产行为或跨层 owner，另开执行单，不扩张本专项。

---

## 17. 推荐提交切分

### 提交 1：冻结测试图谱与治理门禁骨架

- [x] 测试注册/重复执行检查器。
- [x] self-test。
- [x] 不修改现有测试行为。

建议提交信息：

```text
test: add suite governance audit
```

### 提交 2：重构快速测试与 coverage 执行图

- [x] `package.json` 测试入口。
- [x] 消除默认门禁重复执行。
- [x] 保持 coverage 阈值。

建议提交信息：

```text
test: remove duplicate suite execution
```

### 提交 3：删除或合并已证实低价值测试

- [x] 只包含有证据的删除/合并。
- [x] 不混入 flaky 修复。

建议提交信息：

```text
test: retire redundant assertions
```

### 提交 4：稳定 browser/runtime 同步与清理

- [x] 条件等待。
- [x] 进程/端口/临时目录 cleanup。
- [x] 连续运行证据。

建议提交信息：

```text
test: harden browser and runtime stability
```

### 提交 5：回写长期规范并归档

- [x] `docs/engineering-quality.md`。
- [x] 本文完成记录与归档移动。

建议提交信息：

```text
docs: codify test stability governance
```

每个提交在创建前必须检查：

- [x] `git diff --cached --stat`。
- [x] `git diff --cached --numstat`。
- [x] 不超过仓库规定的手工维护内容和文件数量上限。
- [x] 不混入无关产品改动。

---

## 18. 最终执行记录

### 18.1 测试资产变化

- [x] 治理前顶层 TypeScript 入口：`32`。
- [x] 治理后顶层 TypeScript 入口：`32`。
- [x] 删除：`1 个低价值恒真断言；0 个顶层入口`。
- [x] 合并：`0 个入口；通过命令图分区消除重复执行`。
- [x] 新增：`0 个顶层入口；新增 1 个测试治理机器门禁及 8 个对抗式自测案例`。
- [x] Rust passed / ignored：`377 passed / 1 ignored（378 total）`。

### 18.2 执行图变化

- [x] 治理前默认门禁重复入口：`至少 7 个顶层入口在 check 中完整执行两次`。
- [x] 治理后默认门禁重复入口：`0`。
- [x] `npm test` 最终语义：`30 个快速确定性顶层入口、477 个测试用例，每个入口恰好一次`。
- [x] runtime/performance 独立入口：`Tauri runtime 保持独立 CI job；性能/query-plan 保持显式 perf:* 命令`。

### 18.3 时间变化

| 命令 | 治理前 | 治理后 | 变化 | 口径 |
| --- | ---: | ---: | ---: | --- |
| `npm test` | `0.445s`，仅 1 个 tracking 聚合入口 / 91 cases | `10.644–11.202s`，30 个入口 / 477 cases，连续 5 次 | 不计算百分比 | 语义扩大，不能把旧时间伪装成同口径提速 |
| `npm run check` | `18.17s` 后被既存 History Hook lint 阻断，无完整基线 | `77.9s` 通过 | 不可比 | 最终完整门禁，包含 browser/build |
| `npm run check:full` | 因 `check` 失败无有效完整基线 | `94.5s` 通过 | 不可比 | 对抗式修复后最终同机热运行，含 Rust 与依赖审计 |
| `npm run test:tauri-runtime-smoke` | 旧基线无效：可能复用用户已运行的 `1420` Vite 服务 | `21.9–22.7s`，加固后最终连续 3 次 | 不可比 | 动态端口、独立 Cargo target、隔离数据与 WebView profile |

补充冷运行证据：首次启用独立 Cargo target 的实际 Rust 编译约 `2m01s`；该探索轮因旧 CDP target 过滤条件等待到超时而失败，未计为通过。修复过滤和隔离后，后续有效运行全部通过。旧 runtime smoke 复用固定 `1420` 服务的问题意味着治理前的“通过”不能作为可信性能或正确性基线。

### 18.4 保护强度

- [x] Coverage：`statements 97.96%、lines 97.96%、branches 88.88%、functions 86.36%；阈值未放宽`。
- [x] Mutation：`8/8 killed，100%；变异真实 persistence 模块，未吞全局 rejection`。
- [x] Browser smoke：`31 cases，最终连续 3/3；清理失败现在会令测试失败，临时目录 0`。
- [x] Runtime smoke：`最终连续 3/3；真实 command/event/plugin SQL/capability/落盘，动态端口和独立 target`。
- [x] Rust：`378 total，377 passed，1 ignored；ignore 白名单精确到 path::test_name，并精确匹配 reason`。
- [x] 依赖审计：`npm 0 vulnerabilities；Rust 0 Windows-reachable vulnerabilities，3 个 exact lock-only advisories 已验证不可达`。

### 18.5 最终对抗式结论

- [x] 是否存在为提速删除独有风险保护：`否；32 个入口全部保留，仅删除 1 个无法捕获所声称缺陷的恒真断言`。
- [x] 是否存在 flaky 重跑或 ignored 掩盖：`否；无自动 retry；所有失败轮次记录；唯一 ignored 精确白名单且有替代 perf 命令`。
- [x] 是否存在重复执行回流：`否；治理门禁递归展开脚本并验证 quick/check 执行计数`。
- [x] 是否满足全部硬门槛：`是；check、check:rust、dependencies、check:full、runtime smoke 全通过`。
- [x] 是否允许归档：`是`。

### 18.6 对抗式审查发现与处置

1. 旧 runtime smoke 使用固定 Vite `1420`，在用户开发服务已经存在时可能连接到用户服务而不是测试自己启动的服务，形成假阳性。现改为程序化 Vite 动态端口、动态 Tauri devUrl、URL 身份断言和独立 Cargo target。
2. browser smoke 曾在 31 个场景全部通过后因浏览器进程树未完全退出而清理失败。这证明“用例通过”不等于测试通过；现对 client、进程、profile、server 清理错误聚合并令总测试失败。
3. CDP command 原来没有自己的超时，WebSocket 断开后 pending promise 可永久悬挂。现每条命令有外层超时，socket error/close 会拒绝全部 pending command。
4. Rust ignored 白名单原来只精确到文件与原因，同文件复制第二个相同 reason 的 ignored test 可绕过。现精确到 `path::test_name` 与 reason，并有对应对抗式自测。
5. mutation harness 原来会全局吞掉预期 rejection，可能连基线错误也一起掩盖；现只捕获当前 mutant 的 rejection，始终解除 listener 并清理诊断目录。
6. 固定 sleep 审计后，普通状态同步改为明确 gate、条件轮询或 animation frame；仅保留作为被测超时输入或明确性能预算组成的等待。
7. runtime 内部启动上限由 10 分钟收紧至 5 分钟，为独立 10 分钟 CI job 留出清理与诊断时间。
8. 浏览器启动原先在 DevTools 端口建立前失败时无法把进程/profile 句柄交给调用方。现由 `launchBrowser` 自身承担启动失败清理，并把原始错误与清理错误聚合返回。
9. CDP command 虽已有命令超时，但 WebSocket open 阶段仍可能悬挂；现握手也有明确超时，runtime 的本地 CDP/Vite fetch 同样使用短 AbortSignal。

最终结论：本轮发现的高风险问题主要在测试基础设施本身，而非产品功能。全部已修复并由自测、连续运行和组合总门禁反证；未通过降低 coverage、mutation、bundle、Rust lint 或忽略范围换取绿色结果。

---

## 19. 归档结论

1. [x] 阶段 A 至 H 已全部完成。
2. [x] 32 个入口审计、执行图、稳定性修复和机器门禁已落地。
3. [x] 长期规则已进入 `docs/engineering-quality.md`，本文不再作为活动执行依据。
4. [x] 本文移动到 `docs/archive/` 后，`docs/working/` 不保留副本。
5. [x] 后续新增或调整测试直接遵循长期母文档与 `check:test-governance`。
