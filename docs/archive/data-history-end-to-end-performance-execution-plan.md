# Data / History 端到端重数据性能执行方案

本文是一次性 How-to 执行方案。完成本轮执行、验证和总结后，应移入 `docs/archive/`。

创建日期：2026-06-30

归档日期：2026-06-30

## 0.1 归档状态

- [x] 阶段 0 已完成：确认当前执行在上一轮未提交改动集上继续，`docs/working/` 仅保留本执行单。
- [x] 阶段 1 已完成：新增 `npm run perf:data-history-browser`，输出 Data / History browser navigation/render JSON，包含 `p50`、`p95`、`max` 与 console error 计数。
- [x] 阶段 2 已完成：新增 `npm run perf:sqlite-query-plan`，通过 ignored Rust/SQLx 诊断测试生成 SQLite `EXPLAIN QUERY PLAN` JSON，不修改用户数据库和产品 migration。
- [x] 阶段 3 已完成：Data 同 range 共享 aggregate context，Data 页面和首屏 prewarm 都复用同一中间结果；旧 `buildDataTrendViewModel` / `buildDataAppTrendViewModel` 公开函数保持兼容。
- [x] 阶段 3 追加完成：`compileDataSessions` 从多次数组遍历收敛为单次遍历，减少 365 天大范围路径分配和重复分类成本。
- [x] 阶段 4 已评估后暂缓：本轮 trace / perf 没有证明存在 `1s` 到 `3s` 内非必要同 key 重复刷新；不引入短 TTL，避免改变“缓存先显示、后台刷新最新数据”的语义。
- [x] 阶段 5 已评估后暂缓：合成 48,000 session 大库中，当前 `COALESCE(end_time, now)` range query 已使用 `idx_sessions_date`，拆 closed / active baseline 没有赢。
- [x] 阶段 6 已评估后暂缓：临时候选 partial index 只在合成库诊断中创建，未显示足够稳定收益；不进入产品 migration。
- [x] 阶段 7 已完成上一轮落地并在本轮复核：History weekly 使用轻量 loader，不读取 title samples；day timeline title details 保持完整。
- [x] 阶段 8 已评估后暂缓：summary table 的进入条件未满足，继续作为最后手段，不在本轮实现。
- [x] 本轮未改变 Data / History 页面切换语义、统计口径、SQLite product schema 或 migration。
- [x] `npm run check:full` 已通过。
- [x] 本文归档到 `docs/archive/` 后，不再作为 active 执行依据。

## 0.2 本轮实测结论

Data 纯 read model 最终参考结果：

- [x] `data-trend-365d`：平均约 `277.11ms`，`p95` 约 `293.86ms`。
- [x] `data-app-trend-365d`：平均约 `308.26ms`，`p95` 约 `320.75ms`。
- [x] `data-combined-trends-365d`：平均约 `299.48ms`，`p95` 约 `305.62ms`；这代表 Data 页同 range 下 overview + app trend 共享一次 aggregate 的组合成本。
- [x] `data-selected-app-derive-365d`：平均约 `14.16ms`，`p95` 约 `15.02ms`；selected app 切换可从既有 aggregate 派生，不需要重算 overview。
- [x] `data-heatmap-recent`：平均约 `38.63ms`，`p95` 约 `86.66ms`。

Data / History browser perf 最终参考结果：

- [x] 2026-06-30 追加切换响应优化后，`browser-dashboard-to-data-active`：平均约 `31.41ms`，`p50` 约 `32.40ms`，`p95` 约 `33.50ms`；这代表点击后侧栏选中反馈已经先于 Data 内容刷新落屏。
- [x] `browser-dashboard-to-data`：平均约 `449.97ms`，`p50` 约 `394.46ms`，`p95` 约 `670.23ms`，console error 为 `0`。
- [x] `browser-dashboard-to-history`：平均约 `280.56ms`，`p50` 约 `282.86ms`，`p95` 约 `284.17ms`，console error 为 `0`。
- [x] `browser-data-7d-to-365d`：平均约 `566.74ms`，`p50` 约 `563.28ms`，`p95` 约 `687.61ms`。
- [x] `browser-data-365d-to-7d`：平均约 `625.49ms`，`p50` 约 `583.19ms`，`p95` 约 `887.71ms`。
- [x] browser range 场景使用 stub Tauri 数据，只测导航与 React 渲染路径，不代表真实 SQLite I/O。当前最重要的体感变化是：Data 导航反馈先落屏，内容区不再用应用级 loading 抢屏；Data 范围切换已从 `2s+` 降到约 `0.6s`。

SQLite query plan 最终参考结果：

- [x] `sessions-current-coalesce`：48,000 session 合成库返回约 `47,782` 行，约 `95.86ms`，计划为 `SEARCH sessions USING INDEX idx_sessions_date (start_time<?)`，无 table scan。
- [x] `sessions-split-closed-active-baseline`：约 `98.64ms`，同样使用 `idx_sessions_date`，未优于当前查询。
- [x] `sessions-split-closed-active-candidate-indexes`：约 `107.85ms`，active 查询可用候选 partial index，但整体未优于当前查询。
- [x] `session-title-samples-current`：约 `0.36ms`，使用 `idx_session_title_samples_session_time`。
- [x] `web-activity-current-coalesce`：约 `49.49ms`，使用 `idx_web_activity_segments_time`，但因 `ORDER BY start_time ASC, id ASC` 出现 temp sort；这是后续若优化 web activity read path 时更值得观察的点。

验证记录：

- [x] `npm run test:data`
- [x] `npm run test:data-range`
- [x] `npm run test:data-chart`
- [x] `npm run test:history-timeline`
- [x] `npm run test:warmup`
- [x] `npm run test:background-return`
- [x] `npm run test:persistence`
- [x] `npm run perf:data-read-model`
- [x] `npm run perf:history-read-model`
- [x] `npm run perf:dashboard-read-model`
- [x] `npm run perf:sqlite-query-plan`
- [x] `npm run perf:data-history-browser`
- [x] `npm run check:full`

后续建议：

- [x] 不建议直接做 SQLite split / index migration；本轮证据不足。
- [x] 不建议直接做持久化 summary table；复杂度和可信风险仍高于收益。
- [x] 若继续追 Data range 切换体感，应另起渲染/交互专项，重点看 Recharts render、range control 操作批处理、长范围图表降采样或 worker 化，而不是继续先砍 SQLite。

## 0. 文档定位

- [ ] 文档类型：How-to 执行方案。
- [ ] 目标读者：准备继续优化 Data / History 重数据体感性能的工程协作者。
- [ ] 用户目标：解释并解决“纯 read model benchmark 有改善，但真实体感仍然不够轻”的问题。
- [ ] 核心任务：建立端到端测量闭环，定位瓶颈，再按证据削减 SQLite 查询、前端计算、React 渲染和重复刷新成本。
- [ ] 当前阶段：上一轮 Data / History 读模型第一刀已完成并归档，本轮进入更深的端到端性能阶段。
- [ ] 文档归宿：实施期间保留在 `docs/working/`，完成后归档到 `docs/archive/`。

## 1. 第一性原理

时间追踪产品的性能优化不能只回答“某个函数平均值有没有下降”，而要回答用户真正感受到的三个问题：

1. [ ] 页面能不能马上显示可信内容。
2. [ ] 后台刷新会不会把主线程拖住。
3. [ ] 数据越积越多后，打开 Data / History 的体感会不会持续变差。

因此，本轮从下面这些基本事实出发。

- [ ] `低于预算` 不等于 `体感足够轻`。预算只是防止明显退化，不是体验目标。
- [ ] 用户感知的是端到端路径：导航切换、缓存命中、SQLite 读取、DTO 映射、分类过滤、读模型聚合、React 渲染、图表布局、图标加载。
- [ ] 只优化纯 TypeScript 读模型，无法证明 SQLite、Tauri SQL plugin、图表渲染或页面刷新策略已经足够轻。
- [ ] 平均值不足以代表体感。需要至少区分 p50、p95、最大值，以及冷启动、热缓存、同范围切回、tracking refresh 四种场景。
- [ ] 重数据成本通常不是一个点，而是多个乘法项叠加：`session rows * day buckets * app buckets * chart nodes * render passes`。
- [ ] 缓存只负责先显示，不负责让最新数据永远不刷新。任何短 TTL 或缓存跳过策略都必须保持这个语义。
- [ ] 统计可信度优先于速度。不能为了快而改变分类、排除、跨天裁剪、live session、title sample 或 web activity 口径。
- [ ] 持久化 summary table 是最后手段。它会引入重建、失效、备份恢复、分类变化、跨版本迁移等复杂度。
- [ ] SQLite 查询优化必须先用 `EXPLAIN QUERY PLAN` 和真实或合成大库证明瓶颈，再进入索引或查询拆分。
- [ ] 新增诊断能力要有明确 owner，不能把临时调试逻辑塞进页面组件、`shared/*` 临时桶或 Rust `commands/*` 厚逻辑。

## 2. 为什么上一轮“不够”

上一轮已经完成：

- [x] Data heatmap 同范围 in-flight 去重。
- [x] History snapshot 同日期、同 rolling range in-flight 去重。
- [x] History weekly 轻量读取，不再为 weekly 范围加载 title samples。
- [x] Data trend / app trend 改为编译后落桶复用，减少长周期 `ranges * sessions` 扫描。
- [x] 新增 `npm run perf:data-read-model`。

但这仍然不等于真实体感足够好。

当前参考结果：

- [ ] `data-app-trend-365d`：约 `373.28ms` -> `301.24ms`。
- [ ] `data-trend-365d`：约 `276.31ms` -> `268.47ms`。
- [ ] `data-heatmap-recent`：约 `31.59ms` -> `29.34ms`。
- [ ] `History full read model`：约 `52.33ms`，低于 `170ms` 预算。

这些数字说明：

- [ ] Data 365 天 App trend 有明确改善，但 `301ms` 仍然是用户可能感知到的主线程成本。
- [ ] Data overview trend 改善很小，说明它的瓶颈可能不主要在已消除的重复扫描上。
- [ ] benchmark 只测纯函数或 synthetic read model，不包含真实 SQLite I/O 和图表渲染。
- [ ] 预算偏宽，适合防退化，不适合作为“体感够轻”的验收线。
- [ ] 如果真实 Data 页同时构建 overview、app trend、heatmap、图标和图表，单项平均值不能代表整体打开体验。

结论：

- [ ] 下一轮不能继续只看 `perf:data-read-model` 平均值。
- [ ] 必须先拆出端到端时间线，再判断下一刀砍哪里。

## 3. 本轮目标

### 3.1 必做目标

- [ ] 建立 Data / History 端到端性能 trace。
- [ ] 区分 SQLite 查询、前端 DTO 映射、读模型计算、React 渲染、图表布局和图标加载成本。
- [ ] 建立真实或合成大库的 SQLite 查询计划检查。
- [ ] 明确 Data 页打开慢时，瓶颈是在数据库、计算、渲染还是刷新策略。
- [ ] 在证据支持下执行至少一组可逆优化。
- [ ] 用 p50 / p95 / max 或等价分布指标记录前后变化。
- [ ] 保留现有 Data / History 切换体验：先显示可用快照，后台刷新最新数据。
- [ ] 完成后勾选本方案并归档。

### 3.2 候选优化目标

以下目标只有在测量证明对应瓶颈存在时才执行。

- [ ] Data 同 range 下共享 aggregate，避免 overview 和 app trend 各自重复编译/落桶。
- [ ] Data / History 增加极短 freshness gate，跳过同 tick 或刚完成的重复刷新。
- [ ] SQLite range query 拆成 closed sessions 与 active sessions，避免 `COALESCE(end_time, now)` 让查询计划变钝。
- [ ] 评估并新增 overlap-friendly index，例如 `end_time`、`(end_time, start_time)` 或 partial index。
- [ ] 优化 title sample 查询，确保只在需要 title details 的路径读取。
- [ ] 如仍不足，再设计可重建的派生 summary table。

### 3.3 非目标

- [ ] 本轮不改变 Data / History 页面布局。
- [ ] 本轮不改变导航、placeholder、loading、live ticking 语义。
- [ ] 本轮不改变统计口径。
- [ ] 本轮不把 Data / History 读模型业务逻辑迁到 Rust command。
- [ ] 本轮不默认新增持久化 summary table。
- [ ] 本轮不默认改变 SQLite migration baseline。
- [ ] 本轮不为了追数字牺牲 tracking 可信度、备份恢复可信度或升级可信度。

## 4. 体验目标与性能目标

本轮要区分三类目标。

### 4.1 体验目标

- [ ] 从 Dashboard 切到 Data，首屏不出现可见 loading 或空白闪烁。
- [ ] 从 Dashboard 切到 History，首屏不出现可见 loading 文案。
- [ ] 命中缓存时，用户先看到旧快照，再由后台刷新。
- [ ] 后台刷新不能造成明显输入卡顿、滚动卡顿或图表迟滞。
- [ ] 切换 Data 7 天、30 天、最近一年时，控件响应要先于重计算完成。
- [ ] 切换 History 日期时，当前 UI 不应被旧请求覆盖。

### 4.2 测量目标

- [ ] Data 页面记录 `navigation-start -> first-stable-content`。
- [ ] Data 页面记录 `refresh-start -> fresh-view-model-ready`。
- [ ] Data 页面记录 overview trend、app trend、heatmap 各自构建耗时。
- [ ] History 页面记录 `navigation-start -> first-stable-content`。
- [ ] History 页面记录 day sessions、weekly sessions、web segments、view model build 分段耗时。
- [ ] SQLite 查询记录 SQL 名称、范围天数、返回行数、耗时。
- [ ] React/browser 记录至少一次真实 browser smoke 场景的导航耗时。
- [ ] 所有性能脚本输出 JSON，包含 `benchmark`、`measuredAt`、`measurements`、`metadata`。

### 4.3 初始验收目标

初始目标不是硬编码永久规则，而是本轮优化的判断线。

- [ ] Data 365 天 app trend 纯计算目标：从约 `301ms` 继续降到 `220ms` 以下，或证明主要瓶颈不在该函数。
- [ ] Data 365 天 overview trend 纯计算目标：从约 `268ms` 继续降到 `220ms` 以下，或证明拆 SQL / shared aggregate 更值得。
- [ ] Data 端到端打开目标：相同机器、相同数据下 p95 至少下降 `30%`，或下降到用户不可明显感知的范围。
- [ ] History 端到端打开目标：确认 weekly 轻量路径在真实查询中确实减少 I/O 或 title sample 读取时间。
- [ ] 如果测量显示瓶颈在 Recharts / render，而不是 DB 或 read model，则停止 SQL 优化，转向渲染策略执行单。

## 5. 不变量

所有阶段都必须保持这些不变量。

- [ ] `AppClassification.shouldTrackProcess` 与 `shouldTrackApp` 过滤结果不变。
- [ ] app alias 合并结果不变。
- [ ] display name override 结果不变。
- [ ] excluded app 不进入统计。
- [ ] 跨天 session 仍按本地日期切分。
- [ ] 跨月 session 仍按本地月份切分。
- [ ] live session 仍以可信 now / heartbeat 口径处理。
- [ ] History day timeline title details 不丢失。
- [ ] History weekly chart 不需要 title details 时不读取 title samples。
- [ ] Data heatmap future / outside-year intensity 规则不变。
- [ ] tracking data changed 后，当前页面仍能刷新。
- [ ] long background return home 策略不变。
- [ ] heavy cache cleanup 策略不变。
- [ ] 所有 SQL 继续参数化。
- [ ] 动态 SQL 只能使用白名单，不允许拼接用户输入。

## 6. Owner 与落点

### 6.1 Data

- [ ] Data read model 计算继续归 `src/features/data/services/*`。
- [ ] Data 页面组件只组合 view model，不承接聚合算法。
- [ ] Data hook 只负责加载状态，不承接 SQLite 或聚合细节。
- [ ] Data 性能脚本归 `scripts/perf/*`。
- [ ] 如果新增 Data 私有 perf helper，优先放在 `src/features/data/services/*`，并避免组件依赖。

### 6.2 History

- [ ] History read model 计算继续归 `src/features/history/services/*`。
- [ ] History snapshot cache 继续归 `historySnapshotCache.ts`。
- [ ] History 页面组件不直接碰 SQLite。
- [ ] History 性能脚本归 `scripts/perf/*`。

### 6.3 SQLite 前端边界

- [ ] 前端 SQLite read repository 继续归 `src/platform/persistence/*`。
- [ ] session 相关 SQL 继续归 `sessionReadRepository.ts`。
- [ ] web activity SQL 继续归对应 web persistence owner。
- [ ] Raw row 类型只留在 `platform/persistence` 内部。
- [ ] `EXPLAIN QUERY PLAN` 诊断脚本不改变产品运行路径。

### 6.4 Rust

- [ ] 第一阶段不改 Rust。
- [ ] 如果需要新增 SQLite index 或 migration，owner 是 `src-tauri/src/data/*`。
- [ ] Rust `commands/*` 不承接查询优化业务逻辑。
- [ ] 如触及 schema / migration，必须追加 `npm run check:rust` 或 `npm run check:full`。

## 7. 阶段 0：冻结当前状态

目标：避免在未确认当前代码状态时写新计划或新优化。

- [ ] 运行 `git status --short`。
- [ ] 确认上一轮改动是否已经提交。
- [ ] 如果上一轮未提交，先决定本轮是在同一改动集继续，还是先提交上一轮。
- [ ] 确认 `docs/working/` 只保留当前 active 执行单。
- [ ] 确认 `docs/archive/data-history-read-model-lightening-plan.md` 已归档。
- [ ] 确认 `docs/engineering-quality.md` 已包含 `npm run perf:data-read-model`。

验收：

- [ ] 当前执行单成为 `docs/working/` 下唯一 Data / History 性能 active 文档。
- [ ] 未误改长期产品方向文档。

## 8. 阶段 1：建立端到端性能 trace

目标：先拆出真实时间线，再决定优化点。

### 8.1 定义 trace 事件模型

- [ ] 定义 trace event 字段：
  - [ ] `name`
  - [ ] `startedAtMs`
  - [ ] `durationMs`
  - [ ] `rangeDays`
  - [ ] `rowCount`
  - [ ] `sessionCount`
  - [ ] `titleSampleCount`
  - [ ] `cacheHit`
  - [ ] `source`
- [ ] trace event 只用于开发、测试或 perf 脚本。
- [ ] 不在用户 UI 中展示 trace。
- [ ] 不把 trace 写入长期本地数据库。
- [ ] 不记录窗口标题、域名、文件名等敏感内容。
- [ ] 不记录原始 SQL 参数以外的私人数据。

推荐落点：

- [ ] 如果只服务 perf 脚本，放在 `scripts/perf/*`。
- [ ] 如果需要 app runtime 协调，放在 `src/app/services/*` 的薄诊断 helper。
- [ ] 不放进 `shared/*`，除非后续证明它是稳定跨 feature 能力。

### 8.2 Data trace 点

- [ ] 记录 `Data navigation start`。
- [ ] 记录 `overview snapshot requested`。
- [ ] 记录 `overview snapshot resolved`。
- [ ] 记录 `app snapshot requested`。
- [ ] 记录 `app snapshot resolved`。
- [ ] 记录 `heatmap snapshot requested`。
- [ ] 记录 `heatmap snapshot resolved`。
- [ ] 记录 `buildDataTrendViewModel` duration。
- [ ] 记录 `buildDataAppTrendViewModel` duration。
- [ ] 记录 `buildActivityHeatmap` duration。
- [ ] 记录 `visible view model selected`，区分 bootstrap、last ref、fresh snapshot。
- [ ] 记录 `first stable content`。

### 8.3 History trace 点

- [ ] 记录 `History navigation start`。
- [ ] 记录 cache 命中情况。
- [ ] 记录 `getHistoryByDate` duration 和 session count。
- [ ] 记录 `getWeeklySessionsInRange` duration 和 session count。
- [ ] 记录 web activity 读取 duration 和 segment count。
- [ ] 记录 favicon cache 读取 duration。
- [ ] 记录 `buildHistoryReadModel` duration。
- [ ] 记录 timeline build duration。
- [ ] 记录 `first stable content`。

### 8.4 Browser 端到端 harness

- [ ] 复用现有 `tests/uiBrowserSmoke/*` 的 browser harness。
- [ ] 新增 perf 专用 browser 场景，不混入常规 smoke。
- [ ] 场景覆盖：
  - [ ] Dashboard -> Data。
  - [ ] Data 7 天 -> 最近一年。
  - [ ] Data 最近一年 -> 7 天。
  - [ ] Dashboard -> History。
  - [ ] History 前一天 / 后一天切换。
  - [ ] 长后台返回 Data。
- [ ] 输出每个场景 p50、p95、max。
- [ ] 输出 console error 计数。
- [ ] 如果 browser harness 只能使用 stub data，明确标注它测的是 render / navigation，不是 SQLite I/O。

验收：

- [ ] 新增端到端 perf 脚本可以独立运行。
- [ ] 输出 JSON。
- [ ] 不进入默认 `npm run check`。
- [ ] 结果能区分 cache-first 与 fresh-refresh。

## 9. 阶段 2：建立 SQLite 查询计划检查

目标：确认真实瓶颈是否在 SQLite range query，而不是凭感觉加索引。

### 9.1 列出重路径 SQL

- [ ] 列出 `getSessionsInRange` SQL。
- [ ] 列出 `getSessionsInRangeWithoutTitleSamples` SQL。
- [ ] 列出 `getSessionSummariesInRange` SQL。
- [ ] 列出 `getHistoryByDate` 实际调用范围。
- [ ] 列出 `session_title_samples` 查询 SQL。
- [ ] 列出 web activity range query。
- [ ] 标注每条 SQL 是否读取 title samples。
- [ ] 标注每条 SQL 是否使用 `COALESCE(end_time, ?)`。
- [ ] 标注每条 SQL 返回列是否超过当前 view model 需要。

### 9.2 准备查询计划工具

优先顺序：

1. [ ] 如果本机可用 `sqlite3` CLI，先用 CLI 对真实或复制数据库执行 `EXPLAIN QUERY PLAN`。
2. [ ] 如果没有 CLI，优先写 Rust-side 临时 perf test 或 diagnostic helper，因为仓库已有 Rust SQLite 能力。
3. [ ] 如果必须从前端 Tauri SQL plugin 执行，确保只在 perf/dev 场景调用，不进入用户路径。

要求：

- [ ] 所有 query plan 使用参数化参数。
- [ ] 动态 SQL 名称只能来自白名单。
- [ ] 不输出用户窗口标题、域名、文件名等敏感数据。
- [ ] 不修改数据库。
- [ ] 不在 production UI 暴露。
- [ ] 如果读取真实数据库，先复制到临时路径再分析。

### 9.3 数据规模

至少准备三组数据。

- [ ] 小库：7 天、几百 sessions。
- [ ] 中库：90 天、数千 sessions。
- [ ] 大库：365 天、4 万到 10 万 sessions。

大库构造要求：

- [ ] 包含 closed sessions。
- [ ] 包含 active session。
- [ ] 包含跨天 session。
- [ ] 包含跨月 session。
- [ ] 包含 title samples。
- [ ] 包含 excluded apps。
- [ ] 包含 alias executable。
- [ ] 包含 web activity segments，如果启用 web 功能。

### 9.4 EXPLAIN 检查项

对每条重路径 SQL 记录：

- [ ] 是否 `SCAN sessions`。
- [ ] 是否使用 `idx_sessions_date`。
- [ ] 是否能利用 `start_time` 条件。
- [ ] 是否能利用 `end_time` 条件。
- [ ] `COALESCE(end_time, ?)` 是否导致计划不可用。
- [ ] `ORDER BY start_time ASC` 是否额外排序。
- [ ] title samples 查询是否使用 `idx_session_title_samples_session_time`。
- [ ] title samples 查询是否使用 `idx_session_title_samples_time`。
- [ ] web activity 查询是否使用对应时间索引。

验收：

- [ ] 得到每条 SQL 的 query plan。
- [ ] 得到每条 SQL 的实际耗时和返回行数。
- [ ] 明确排序：SQLite、前端计算、渲染三者谁是主瓶颈。

## 10. 阶段 3：Data 同范围共享 aggregate

目标：如果 trace 证明 Data 同一批 sessions 被 overview 和 app trend 重复编译/落桶，则共享一次中间结果。

### 10.1 判断条件

只有满足以下条件才执行。

- [ ] Data trace 显示 overview 和 app trend 使用同一个 `range.cacheKey`。
- [ ] 两者使用同一批 sessions。
- [ ] `buildDataTrendViewModel + buildDataAppTrendViewModel` 合计耗时仍明显。
- [ ] 共享 aggregate 不会改变现有函数公开签名，或可以通过新增内部 helper 兼容。

### 10.2 设计

- [ ] 新增内部 helper，例如 `buildDataTrendViewModelsFromAggregate`。
- [ ] 输入：
  - [ ] sessions。
  - [ ] resolved range。
  - [ ] nowMs。
  - [ ] selectedAppKey。
- [ ] 输出：
  - [ ] overview trend view model。
  - [ ] app trend view model。
- [ ] 保留 `buildDataTrendViewModel`。
- [ ] 保留 `buildDataAppTrendViewModel`。
- [ ] 旧函数内部可以复用新 helper，但不要求组件立刻改签名。
- [ ] 如果 overview range 和 app range 不同，仍独立计算。
- [ ] 如果 mappingVersion 或 uiLanguage 改变，aggregate cache 必须失效。

### 10.3 Data 组件接入

- [ ] 在 `Data.tsx` 中检测 overview/app snapshot 是否同 range。
- [ ] 同 range 时用共享 helper 一次构建两个 view model。
- [ ] 不同 range 时保持现有独立构建。
- [ ] selected app 改变时，只重建 app view model 或从已有 aggregate 派生。
- [ ] 不改变 visible bootstrap / last ref fallback 顺序。
- [ ] 不改变搜索和默认 selected app 语义。

测试：

- [ ] 增加同 range 下 overview/app 结果与旧函数一致的测试。
- [ ] 增加不同 range 下不共享的测试。
- [ ] 增加 selected app 改变不影响 overview 的测试。
- [ ] 增加 mapping override 后结果更新的测试。
- [ ] `npm run test:data`。
- [ ] `npm run test:data-range`。
- [ ] `npm run test:ui-smoke`。

验收：

- [ ] Data 365 天 overview + app trend 合计耗时下降。
- [ ] Data 7 天路径不退化。
- [ ] Browser Data navigation 场景无可见行为变化。

## 11. 阶段 4：Data / History 短 freshness gate

目标：如果 trace 显示刚完成的同范围 snapshot 被同 tick 或短时间内重复刷新，增加极短 freshness gate。

### 11.1 判断条件

只有满足以下条件才执行。

- [ ] trace 显示同一 range 在 `1s` 到 `3s` 内重复读取。
- [ ] 重复读取不是由 tracking data changed 造成的必要刷新。
- [ ] 重复读取没有产生用户可见的新数据。
- [ ] in-flight 去重已经不足以消除该重复。

### 11.2 规则

- [ ] TTL 初始值不超过 `3s`。
- [ ] TTL 只跳过刚完成的完全相同 key。
- [ ] key 必须包含 date/range/selection。
- [ ] tracking data changed 可以绕过 TTL。
- [ ] 用户手动刷新或范围切换可以绕过 TTL。
- [ ] TTL 不做用户可见设置。
- [ ] TTL 不改变 bootstrap snapshot 语义。
- [ ] TTL 不阻止后台刷新长期发生。

### 11.3 Data 接入

- [ ] 在 Data trend snapshot cache 层记录 `fetchedAtMs`。
- [ ] `useDataTrendSnapshot` 命中非常新的同 key snapshot 时可跳过重复 load。
- [ ] Data heatmap recent 同 key 刚完成时可跳过重复 load。
- [ ] 仍保留 in-flight 去重。

### 11.4 History 接入

- [ ] 在 History snapshot cache 层记录或复用 `nowMs`。
- [ ] 同日期同 rollingDayCount 刚完成时可跳过重复 load。
- [ ] 日期切换不复用旧日期。
- [ ] tracking data changed 不被 TTL 吞掉。

测试：

- [ ] Data 同 key 刚完成后跳过重复 load。
- [ ] Data tracking refresh 绕过 TTL。
- [ ] History 同日期刚完成后跳过重复 load。
- [ ] History 不同日期不复用。
- [ ] TTL 过期后重新 load。
- [ ] `npm run test:data`。
- [ ] `npm run test:history-timeline`。
- [ ] `npm run test:warmup`。
- [ ] `npm run test:background-return`。

验收：

- [ ] 重复 refresh 次数下降。
- [ ] first content 语义不变。
- [ ] 最新数据不会被长期卡住。

## 12. 阶段 5：SQLite range query 拆分

目标：如果 query plan 证明 `COALESCE(end_time, ?)` 让 sessions range query 计划变差，则拆成 closed sessions 与 active sessions。

### 12.1 判断条件

只有满足以下条件才执行。

- [ ] query plan 显示当前 SQL 不能有效利用索引。
- [ ] 大库真实耗时显示 SQLite 是主要瓶颈。
- [ ] 拆查询能保持返回结果完全一致。
- [ ] 拆查询不会让代码复杂度超过收益。

### 12.2 查询形态

当前形态示意：

```sql
WHERE start_time < ? AND COALESCE(end_time, ?) > ?
```

候选拆分形态：

```sql
WHERE start_time < ? AND end_time IS NOT NULL AND end_time > ?
```

```sql
WHERE start_time < ? AND end_time IS NULL
```

执行要求：

- [ ] 两条 SQL 都使用参数化参数。
- [ ] active session 查询必须继续用 current now 计算 duration。
- [ ] closed sessions 和 active sessions 合并后按 `start_time ASC` 排序。
- [ ] 合并结果与旧 SQL 在同一数据集上逐行等价。
- [ ] `getSessionsInRange`、`getSessionsInRangeWithoutTitleSamples`、`getSessionSummariesInRange` 分别评估是否拆分。
- [ ] 不改变 `mapRawHistorySession` 和 `mapRawAggregateSessionCandidates` 的前端模型字段。

### 12.3 测试

- [ ] 构造 active session。
- [ ] 构造 closed session。
- [ ] 构造跨范围开始但范围内结束的 session。
- [ ] 构造范围内开始但范围外结束的 session。
- [ ] 构造完全在范围外的 session。
- [ ] 旧查询与新查询结果等价。
- [ ] duration 计算等价。
- [ ] 排序等价。
- [ ] `npm run test:data`。
- [ ] `npm run test:history-timeline`。
- [ ] `npm run test:persistence`。

验收：

- [ ] EXPLAIN 显示索引使用更清楚。
- [ ] 大库 range query 耗时下降。
- [ ] Data / History view model 输出不变。

## 13. 阶段 6：SQLite index 评估与 migration

目标：只有拆查询仍不足，或 query plan 明确缺索引时，才新增索引。

### 13.1 候选索引

需要通过 EXPLAIN 和数据规模验证，不预设必加。

- [ ] `sessions(end_time)`。
- [ ] `sessions(end_time, start_time)`。
- [ ] `sessions(start_time, end_time)`。
- [ ] partial index：`sessions(end_time, start_time) WHERE end_time IS NOT NULL`。
- [ ] partial index：`sessions(start_time) WHERE end_time IS NULL`。
- [ ] title samples 覆盖索引是否需要调整。
- [ ] web activity 时间索引是否需要调整。

### 13.2 评估维度

- [ ] 读性能收益。
- [ ] 写入成本。
- [ ] 数据库文件增长。
- [ ] migration 风险。
- [ ] 老版本升级安全。
- [ ] backup / restore 是否受影响。
- [ ] cleanup 删除是否受影响。

### 13.3 migration 要求

如果新增索引：

- [ ] Rust owner 放在 `src-tauri/src/data/*`。
- [ ] 使用 `CREATE INDEX IF NOT EXISTS`。
- [ ] legacy schema repair 同步考虑。
- [ ] 旧数据库直升测试覆盖。
- [ ] 新安装基线 schema 覆盖。
- [ ] 不改表结构，除非另起执行单。
- [ ] 不压缩 migration baseline。

验证：

- [ ] `npm run check:rust-boundaries`。
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml --quiet`。
- [ ] `npm run check:rust`。
- [ ] 前端相关测试。
- [ ] `npm run check:full`。

## 14. 阶段 7：title samples 与 History 明细读取

目标：确保只有需要标题明细的路径读取 `session_title_samples`。

### 14.1 检查项

- [ ] History selected day timeline 需要 title samples。
- [ ] History weekly chart 不需要 title samples。
- [ ] Data trend 不需要 title samples。
- [ ] Data app trend 不需要 title samples。
- [ ] Dashboard 不需要 title samples，除非某个诊断明确需要。
- [ ] backup / restore 不属于页面 read model，不混入本轮优化。

### 14.2 优化候选

- [ ] selected day 只读取当天 session ids 对应 title samples。
- [ ] title samples 查询继续按 session ids 分批。
- [ ] 批大小不超过 SQLite 参数限制。
- [ ] 如果 query plan 显示 title sample 时间索引更有效，再评估按时间范围过滤。
- [ ] 保持 title sample details 的排序和合并语义。

测试：

- [ ] History title details 仍完整。
- [ ] weekly sessions 不含 title sample details。
- [ ] title sample 查询次数不随 session 数 N 变成 N+1。
- [ ] `npm run test:history-timeline`。
- [ ] `npm run test:ui-browser-smoke`。

## 15. 阶段 8：持久化 summary table 评估

目标：只有前面阶段仍不能达到体感目标时，才设计派生 summary table。

### 15.1 进入条件

必须全部满足：

- [ ] 端到端 trace 证明瓶颈仍在历史大范围读或聚合。
- [ ] SQLite 查询拆分和索引已经评估。
- [ ] Data shared aggregate 已评估。
- [ ] TTL / in-flight / cache 策略已评估。
- [ ] 用户体感仍然不够。
- [ ] 有足够测试覆盖重建、失效、备份恢复和分类变更。

### 15.2 设计原则

- [ ] summary table 只能是可重建派生数据，不是 source of truth。
- [ ] source of truth 仍是 `sessions` 和相关原始表。
- [ ] summary table 必须有 `summary_version` 或等价逻辑版本。
- [ ] summary table 失效后可以后台重建。
- [ ] summary table 不应存储用户不可恢复的唯一信息。
- [ ] 分类、display name、颜色这类可变语义尽量不要固化到 summary table。
- [ ] 如果存 raw executable/day duration，读取时再应用当前 classification。
- [ ] 如果存 category/day duration，必须处理分类变化后的失效和重建。
- [ ] 跨天、跨月切分必须和当前 read model 完全一致。
- [ ] live session 不应永久写入 summary，或必须有明确修正机制。

### 15.3 风险清单

- [ ] 分类变更导致历史 summary 过期。
- [ ] app alias 规则变化导致 summary appKey 过期。
- [ ] 排除统计变化导致 summary 过期。
- [ ] title capture / title filter 变化导致 summary 过期。
- [ ] 跨天切分 bug 会长期污染 summary。
- [ ] backup restore 后 summary 与 source 不一致。
- [ ] cleanup 删除 source 后 summary 未同步删除。
- [ ] migration 中断留下半成品 summary。
- [ ] 大库首次重建造成启动或切页卡顿。

### 15.4 验证

- [ ] 空库。
- [ ] 小库。
- [ ] 365 天大库。
- [ ] 分类变更。
- [ ] app exclusion 变更。
- [ ] alias 规则变更。
- [ ] cleanup。
- [ ] backup restore。
- [ ] 版本升级。
- [ ] 重建中断后恢复。
- [ ] `npm run check:full`。

## 16. 阶段 9：验证矩阵

### 16.1 每阶段局部验证

- [ ] `npm run test:data`。
- [ ] `npm run test:data-range`。
- [ ] `npm run test:data-chart`。
- [ ] `npm run test:history-timeline`。
- [ ] `npm run test:warmup`。
- [ ] `npm run test:background-return`。
- [ ] `npm run test:persistence`。
- [ ] `npm run perf:data-read-model`。
- [ ] `npm run perf:history-read-model`。

### 16.2 端到端验证

- [ ] 新增 Data / History browser perf 脚本。
- [ ] `npm run test:ui-smoke`。
- [ ] `npm run test:ui-browser-smoke`。
- [ ] 如启动本地 dev server，使用 browser harness 验证无 console error。

### 16.3 边界验证

- [ ] `npm run check:naming`。
- [ ] `npm run check:architecture`。
- [ ] 如果触及 Rust：`npm run check:rust-boundaries`。

### 16.4 完整验证

- [ ] 不触及 Rust schema 时：`npm run check`。
- [ ] 触及 Rust schema / migration / repository 时：`npm run check:full`。

## 17. 手工验收

### 17.1 Data

- [ ] 从 Dashboard 切到 Data，立即看到可用内容。
- [ ] 7 天、30 天、最近一年切换响应不迟钝。
- [ ] 自定义长范围仍正确切到 month granularity。
- [ ] app 搜索不迟钝。
- [ ] selected app 切换不重新计算 overview。
- [ ] 双击 Data chart 日期仍能打开 History。
- [ ] heatmap recent / year 切换正确。
- [ ] heatmap daily / weekly 切换正确。
- [ ] 长数据下滚动和图表 hover 不明显卡顿。

### 17.2 History

- [ ] 从 Dashboard 切到 History，立即看到可用内容。
- [ ] 日期切换不被旧请求覆盖。
- [ ] timeline zoom 正常。
- [ ] title details 正常。
- [ ] day distribution 正常。
- [ ] web activity 开关下 app/web 统计正常。
- [ ] live session ticking 正常。
- [ ] tracking data changed 后当前日期刷新。

### 17.3 后台与刷新

- [ ] 短后台返回不丢当前页面。
- [ ] 长后台返回 Dashboard 策略不变。
- [ ] heavy cache cleanup 不改变。
- [ ] foreground prewarm 不造成明显卡顿。

## 18. 回滚策略

每个优化阶段都必须可单独回滚。

- [ ] trace / perf 脚本可以单独删除，不影响产品。
- [ ] shared aggregate helper 可以回退到旧函数独立构建。
- [ ] freshness gate 可以通过常量关闭。
- [ ] query split 可以保留旧 SQL fallback。
- [ ] 新 index 可以停止使用，但 migration 已发布后不能假装不存在。
- [ ] summary table 若进入实施，必须支持清空和重建。

## 19. 完成定义

本执行方案完成时，应满足：

- [ ] 已有端到端性能 trace。
- [ ] 已定位 Data / History 重数据体感瓶颈。
- [ ] 至少一组证据驱动优化完成。
- [ ] Data 365 天重路径有明显体感或 p95 改善。
- [ ] History 重路径没有退化。
- [ ] SQLite 查询计划有记录。
- [ ] 未改变统计口径。
- [ ] 未改变页面切换语义。
- [ ] 所有命中的测试和 perf 脚本通过。
- [ ] 如果形成长期规则，回写 `docs/engineering-quality.md`。
- [ ] 本文勾选完成并移入 `docs/archive/`。

## 20. 建议执行顺序

- [ ] PR 1：新增端到端 trace 和 browser perf harness，只测量，不改业务。
- [ ] PR 2：新增 SQLite query plan 检查，只测量，不改业务。
- [ ] PR 3：按 trace 结果做 Data 同范围 shared aggregate。
- [ ] PR 4：按 trace 结果做极短 freshness gate。
- [ ] PR 5：按 EXPLAIN 结果拆 sessions closed / active 查询。
- [ ] PR 6：按 EXPLAIN 结果新增 index 或 partial index。
- [ ] PR 7：只有仍不够时，另起 summary table 设计执行单。

如果任一阶段发现统计结果变化，停止后续优化，先修正口径或回滚该阶段。
