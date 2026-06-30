# Data / History 读模型减重执行方案

本文是一次性执行方案，当前工作完成并回写长期事实后，应移入 `docs/archive/`。

归档状态：2026-06-30 已完成本轮执行并归档。

本轮完成范围是第一刀减重：请求去重、History weekly 轻量读取、Data 聚合减重、性能脚本与验证。SQLite 查询计划、短 TTL 和持久化日统计表保持为后续阶段，不在本轮冒进。

## 归档勾选总表

- [x] 新增 `npm run perf:data-read-model`，形成 Data 读模型可复查性能脚本。
- [x] 记录 Data baseline，并在最终总结中保留前后对比。
- [x] Data heatmap 增加同范围 in-flight 去重。
- [x] History snapshot 增加同日期、同 rolling range 的 in-flight 去重。
- [x] History weekly 读取改为不加载标题样本的轻量 session rows。
- [x] Data overview/app trend 改为编译后按日/月/app 落桶复用，移除重路径上的 `ranges * sessions` 扫描。
- [x] 增加月桶正确性、heatmap 并发、History 轻量 weekly 与 pending cache 测试。
- [x] `docs/engineering-quality.md` 已补充 `npm run perf:data-read-model`。
- [x] `npm run perf:data-read-model` 通过。
- [x] `npm run perf:history-read-model` 通过。
- [x] `npm run perf:dashboard-read-model` 通过。
- [x] `npm run perf:startup-bootstrap` 通过。
- [x] `npm run check` 通过。
- [x] 本文已从 `docs/working/` 移入 `docs/archive/`。
- [ ] 短 TTL 刷新策略：本轮未做，当前 in-flight 去重和现有缓存语义已足够。
- [ ] SQLite 查询计划 / 索引：后续阶段再做，需单独用 `EXPLAIN QUERY PLAN` 和大库验证。
- [ ] 持久化日统计表：后续阶段再评估，仍是最高风险方案。

最终性能记录：

- `npm run perf:data-read-model`
  - `data-trend-7d`：约 `5.38ms` -> `5.46ms`，仍远低于 `25ms` 预算。
  - `data-app-trend-7d`：约 `5.75ms` -> `5.62ms`，低于 `35ms` 预算。
  - `data-trend-365d`：约 `276.31ms` -> `268.47ms`，低于 `400ms` 预算。
  - `data-app-trend-365d`：约 `373.28ms` -> `301.24ms`，低于 `550ms` 预算。
  - `data-heatmap-recent`：约 `31.59ms` -> `29.34ms`，低于 `80ms` 预算。
- `npm run perf:history-read-model`：完整 History read model 最终约 `52.33ms`，低于 `170ms` 预算。
- `npm run perf:dashboard-read-model`：约 `19.40ms`，低于 `25ms` 预算。
- `npm run perf:startup-bootstrap`：约 `0.003ms`，低于 `1.5ms` 预算。

## 0. 文档定位

- [x] 文档类型：How-to 执行方案。
- [x] 目标读者：准备实施 Data / History 读模型减重的工程协作者。
- [x] 用户目标：在不改变现有页面切换体验、不改变统计口径、不降低 tracking 可信度的前提下，降低 Data 页与 History 页的数据读取和前端计算成本。
- [x] 当前阶段：本轮已完成并归档，后续 SQLite / 持久化统计另起执行单。

## 1. 第一性原理

时间追踪产品的核心承诺不是“页面最快”，而是“记录可信、统计可解释、回看顺手”。因此优化必须从下面几个基本事实出发。

- [x] 数据页和历史页展示的是同一类事实：用户在本地 SQLite 中的时间记录。
- [x] 用户看到的统计必须由同一套过滤、分类、排除、跨天裁剪和 live session 规则解释。
- [x] 性能优化不能改变“哪些记录被计入”和“同一段时间如何归属”的语义。
- [x] 页面切换体验的关键不是永远不显示旧数据，而是立刻显示可用快照，同时后台刷新最新快照。
- [x] 后台刷新可以晚一点，但不能让用户误以为数据已永久停止更新。
- [x] 重复读取同一时间范围、重复把同一批 sessions 落桶、重复在页面组件里做范围乘法，都是可以消除的计算浪费。
- [x] 持久化统计表不是第一选择，因为它会引入回填、重建、分类变更失效、恢复备份一致性等新风险。

本次优化遵循三个优先级：

1. [x] 保持现有行为与统计结果一致。
2. [x] 先减少重复工作，再改变查询形态，最后才考虑持久化汇总。
3. [x] 每一步必须有可复查的测试或性能基线。

## 2. 当前已知事实

本节记录已经检查到的热点，实施前应再次确认没有漂移。

- [x] History 当前会同时读取当天完整 sessions 和 7 天 weekly sessions。
  - 入口：`src/features/history/services/historyReadModel.ts`
  - 相关函数：`loadHistorySnapshot`、`buildHistoryReadModel`
- [x] History 的 weekly chart 主要需要每日总量，但当前 weekly sessions 走完整 session 读取，包括标题样本路径。
  - 入口：`src/platform/persistence/sessionReadRepository.ts`
  - 相关函数：`getSessionsInRange`
- [x] Data 趋势已有同范围 in-flight 去重。
  - 入口：`src/features/data/services/dataTrendSnapshot.ts`
  - 相关状态：`sessionPromises`
- [x] Data heatmap 只有结果 cache，缺少 in-flight 去重。
  - 入口：`src/features/data/services/dataReadModel.ts`
  - 相关函数：`loadDataHeatmapSnapshot`、`prewarmRecentDataHeatmapCache`
- [x] Data 的长周期 app trend 存在 `ranges * sessions` 形态。
  - 入口：`src/features/data/services/dataReadModel.ts`
  - 相关函数：`buildDataSummaries`、`buildAppDayRows`、`countActiveRanges`
- [x] SQLite schema 已有基础时间索引。
  - 入口：`src-tauri/src/data/schema.rs`
  - 相关索引：`idx_sessions_date`、`idx_session_title_samples_session_time`、`idx_session_title_samples_time`
- [x] 当前已有性能脚本覆盖 History、Dashboard、startup bootstrap。
  - `npm run perf:history-read-model`
  - `npm run perf:dashboard-read-model`
  - `npm run perf:startup-bootstrap`
- [x] 当前缺少正式 Data 读模型性能脚本。

当前参考基线：

- [x] `npm run perf:history-read-model`：完整 History read model 平均约 `56.7ms`，预算 `170ms`。
- [x] `npm run perf:dashboard-read-model`：Dashboard read model 平均约 `21.2ms`，预算 `25ms`。
- [x] 临时 Data 合成测量显示，真实 7 天输入约 `4ms` 到 `5ms`，365 天 trend/app trend 会明显放大。

## 3. 总体范围

### 3.1 必做

- [x] 为 Data heatmap 增加同范围 in-flight 去重。
- [x] 为 History snapshot 增加同日期、同 rolling range 的 in-flight 去重。
- [x] 为 Data 增加正式性能脚本。
- [x] 将 Data 长周期聚合从多次扫描改为一次编译、一次落桶、多处复用。
- [x] 为 History weekly chart 增加轻量读取路径，避免读取不需要的标题样本。
- [x] 运行和记录前后可比性能结果。

### 3.2 可选

- [ ] 在完成第一阶段后，用真实查询计划评估 SQLite range query 是否需要新增索引或拆查询。
- [ ] 如果 range query 仍然是主要瓶颈，再设计 SQLite 层改动。

### 3.3 暂不做

- [x] 不引入持久化日统计表。
- [x] 不改变 Data / History 页面布局。
- [x] 不改变页面导航、loading、placeholder 或 live ticking 语义。
- [x] 不改变分类、排除、标题记录、live session、web activity 的统计口径。
- [x] 不把读模型业务逻辑搬进 `app/*`、`shared/*` 临时桶或 Rust `commands/*`。

## 4. 不变量

每个阶段完成后都必须复查这些不变量。

- [x] 页面切换仍然先显示可用快照，后台刷新最新数据。
- [x] 缓存命中不代表停止刷新。
- [x] Data 趋势范围选择结果不变。
- [x] Data app trend 默认选中应用、搜索、切换应用结果不变。
- [x] Data heatmap 日粒度、周粒度、年份切换结果不变。
- [x] Data 图表双击跳转 History 日期结果不变。
- [x] History 日分布、小时活动、横向 timeline、timeline zoom 结果不变。
- [x] History web activity 开关下的 app/web 分布结果不变。
- [x] tracking data changed 后当前前台页面仍能刷新。
- [x] 长时间后台后释放 heavy cache 的策略不变。
- [x] 任何性能优化都不得绕过 `AppClassification` 的分类和排除规则。

## 5. Owner 与落点

### 5.1 前端 Data

- [x] Data 页面私有读模型逻辑继续放在 `src/features/data/services/*`。
- [x] Data hooks 只负责加载状态与页面消费，不承接聚合算法。
- [x] Data 组件继续只组合 view model，不直接访问 SQLite。

### 5.2 前端 History

- [x] History 页面私有 snapshot 与 view model 逻辑继续放在 `src/features/history/services/*`。
- [x] History 组件继续消费 snapshot 与 view model，不直接写 SQL。

### 5.3 SQLite 前端边界

- [x] 前端本地 SQLite 查询继续通过 `src/platform/persistence/*` 暴露。
- [x] 新增轻量 read repository 函数优先放在 `sessionReadRepository.ts`，因为它是现有 session read boundary。
- [x] Raw row 类型只在 `platform/persistence` 或 read model 内部短暂停留。

### 5.4 Rust

- [x] 第一阶段不改 Rust。
- [x] 如果后续需要 schema/index/migration，真实 owner 是 `src-tauri/src/data/*`，不是 `commands/*`。

## 6. 阶段 0：锁定基线

目标：在实现前固定可比场景，避免凭感觉优化。

- [x] 运行 `npm run perf:history-read-model`。
- [x] 记录 History 平均值、预算、session 数量、title sample 数量。
- [x] 运行 `npm run perf:dashboard-read-model`，确认优化没有影响共享读模型基础能力。
- [x] 运行 `npm run perf:startup-bootstrap`，确认启动预热口径没有漂移。
- [x] 新增 Data 性能脚本前，先把临时测量场景转化为稳定脚本设计。

Data 性能脚本设计：

- [x] 新建 `scripts/perf/data-read-model-benchmark.ts`。
- [x] 合成 7 天数据场景，模拟常规使用。
- [x] 合成 365 天数据场景，模拟重数据用户。
- [x] 分别测量 `buildDataTrendViewModel`、`buildDataAppTrendViewModel`、`buildActivityHeatmap`。
- [x] 输出 JSON，格式与现有 `scripts/perf/*` 保持一致。
- [x] 每个测量项设置预算。
- [x] 预算先按当前基线留足空间，优化完成后再收紧。
- [x] 在 `package.json` 增加 `perf:data-read-model` 脚本。
- [x] 不把 perf 脚本放入默认 `npm run check`，除非后续确认运行时间可接受。

验收：

- [x] `npm run perf:data-read-model` 可以独立运行。
- [x] 输出包含 `benchmark`、`measuredAt`、`measurements`、`metadata`。
- [x] 超预算时进程返回非零退出码。

## 7. 阶段 1：请求去重，不改变结果

目标：消除并发重复加载，不改变任何 view model 输出。

### 7.1 Data heatmap in-flight 去重

- [x] 在 `dataReadModel.ts` 增加 heatmap pending map。
- [x] pending key 使用 `getHeatmapSelectionKey(selection, nowMs)`。
- [x] 如果相同 key 已在加载，返回同一个 promise。
- [x] promise settle 后删除 pending key。
- [x] 成功后仍使用现有 `setHeatmapSessionCache`。
- [x] 不改变 `HEATMAP_SESSION_CACHE_LIMIT`。
- [x] 不改变 `earliestSessionStartTimeCache` 的语义。

测试：

- [x] 在 `tests/dataReadModel.test.ts` 增加“并发 heatmap 加载复用同一个底层 session read”的测试。
- [x] 覆盖 `loadDataHeatmapSnapshot` 并发调用。
- [x] 覆盖 `prewarmRecentDataHeatmapCache` 与页面 effect 同时请求 recent 的场景。
- [x] 验证 session load count 为 `1`。
- [x] 验证两个调用拿到同一批 sessions 或等价 snapshot。

验收：

- [x] `npm run test:data` 通过。
- [x] Data heatmap 行为没有 UI 语义变化。

### 7.2 History snapshot in-flight 去重

- [x] 在 `historySnapshotCache.ts` 或 `historyReadModel.ts` 增加 pending snapshot map。
- [x] key 使用现有 date + rollingDayCount cache key 语义。
- [x] 避免启动预热和页面打开同时请求同一天 History 时重复读 SQLite。
- [x] 成功后写入 `HISTORY_SNAPSHOT_CACHE`。
- [x] settle 后删除 pending key。
- [x] 不改变 `HISTORY_SNAPSHOT_CACHE_LIMIT`。

推荐落点判断：

- [x] 如果 pending 只服务 cache 层，放在 `historySnapshotCache.ts`。
- [x] 如果需要接管 `loadHistorySnapshot`，谨慎避免循环 import。
- [x] 不在 `History.tsx` 里实现 pending 去重。

测试：

- [x] 新增或扩展 History snapshot cache 测试。
- [x] 并发调用同一天同 rollingDayCount 的预热函数。
- [x] 验证底层 `loadHistorySnapshot` 只执行一次。
- [x] 验证不同日期不会错误复用。
- [x] 验证不同 rollingDayCount 不会错误复用。

验收：

- [x] `npm run test:history-timeline` 通过。
- [x] History 页面切换仍然 cache-first，然后后台刷新。

## 8. 阶段 2：History weekly 轻量读取

目标：weekly chart 不再为了每日总量读取 7 天完整标题样本。

### 8.1 定义轻量 weekly 读取路径

实际执行采用更保守的形态：不新增 `HistorySnapshot` 字段，不改变 `buildHistoryReadModel` 输入结构，只为 weekly 范围新增“不读取标题样本”的 session loader。

- [x] 在 `sessionReadRepository.ts` 新增 `getSessionsInRangeWithoutTitleSamples`。
- [x] 输入仍是 `startMs`、`endMs`。
- [x] 输出仍是 `HistorySession[]`，保持 read model 兼容。
- [x] Raw SQL row 类型留在 `platform/persistence` 内部。
- [x] 查询仍参数化。

第一版 SQL 原则：

- [x] 不引入持久化表。
- [x] 不读取 `session_title_samples`。
- [x] 保留 `window_title` 字段读取，避免改变现有 History 编译与过滤语义。
- [x] 跨天 session 裁剪仍由现有 History read model 处理。
- [x] live session 仍按现有 `COALESCE(duration, MAX(0, ? - start_time))` 形态处理。
- [x] 应用排除和进程过滤语义仍由现有 read model 编译路径保留。

重要判断：

- [x] 不把 `AppClassification` 过滤强行下推到 SQL。
- [x] 先读取轻量 session rows，再复用现有前端 read model 编译和 day range 逻辑。
- [x] 轻量 rows 跳过标题样本，避免 weekly 范围为 chart 读取不需要的明细。

### 8.2 改造 History snapshot

- [x] `HistorySnapshot` 不增加字段，降低兼容风险。
- [x] `weeklySessions` 保持现有字段，只换成轻量 weekly loader 的结果。
- [x] `loadHistorySnapshot` 仍同时读取完整 daySessions 和轻量 weeklySessions。
- [x] `buildHistoryReadModel` 继续使用现有 weeklySessions 构建 chart data。
- [x] `daySessions` 继续保持完整，因为 timeline、title samples、app distribution 需要完整数据。

测试：

- [x] 扩展 `historyReadModel.test.ts`，验证 weekly loader 使用轻量路径。
- [x] 验证 daySessions 仍保留 title sample details。
- [x] 验证 weeklySessions 不需要 title sample details。
- [x] 验证 History snapshot cache 同 key pending 去重。
- [x] 验证不同日期 pending 不会错误复用。

验收：

- [x] `npm run test:history-timeline` 通过。
- [x] `npm run perf:history-read-model` 不退化。
- [x] History 打开当天页面，timeline title details 仍正常。

## 9. 阶段 3：Data 一次编译、一次落桶

目标：把 Data 长周期计算从“多个 view model 各自扫描 sessions”改为“一次归一化、一份 buckets、多处消费”。

### 9.1 设计中间结构

新增 Data 私有中间结构，建议放在 `src/features/data/services/dataReadModel.ts` 或拆到同目录私有 service。

- [x] 定义 `CompiledDataSession` 的稳定输出，不向组件暴露。
- [x] 定义 `DataDurationAggregate`。
- [x] `DataDurationAggregate` 包含：
  - [x] `dayDurations`
  - [x] `monthDurations`
  - [x] `appBuckets`
  - [x] `totalDuration`
- [x] `DataAppDurationBucket` 包含：
  - [x] `appKey`
  - [x] `appName`
  - [x] `exeName`
  - [x] `totalDuration`
  - [x] `dayDurations`
  - [x] `monthDurations`
- [x] 所有 bucket key 使用本地日期 key 或本地月份 key，避免 UTC 日期漂移。
- [x] 聚合时必须先 clip 到 range 边界。
- [x] 跨天 session 必须拆到对应本地日 bucket。
- [x] 跨月 session 必须拆到对应本地月 bucket。

### 9.2 替换 overview trend

- [x] `buildDataTrendViewModel` 内部改为使用 aggregate。
- [x] day granularity 使用 day bucket。
- [x] month granularity 使用 month bucket。
- [x] chart axis、total、average 计算结果保持不变。
- [x] 保留原函数签名，避免扩大改动面。

测试：

- [x] 现有 `activity trend clips sessions at range boundaries` 继续通过。
- [x] 增加 yearly trend 月桶时长测试。
- [x] 保留自定义长范围切 month granularity 既有测试。

### 9.3 替换 app trend

- [x] `buildDataAppTrendViewModel` 使用同一 aggregate。
- [x] app options 来自 `appBuckets`。
- [x] selected app chart data 来自 app day buckets 或 app month buckets。
- [x] active day count 从 app day bucket key 数量得出，不再 `ranges * sessions`。
- [x] peak day 从 selected app day buckets 得出。
- [x] 保留 duplicate display option 合并逻辑。
- [x] 保留 selected app key 映射语义。

测试：

- [x] 现有 app trend 测试全部通过。
- [x] 保留 active day count 测试。
- [x] 保留 duplicate display / alias-like 合并测试。
- [x] 保留 user exclusion 测试。
- [x] 增加 yearly app trend 月桶时长测试。

### 9.4 替换 heatmap 构建

- [x] `buildActivityHeatmap` 继续独立存在。
- [x] 未强行把 heatmap 与 trend aggregate 合并。
- [x] recent 53 周和年份 view 的 outside-year/future 规则不变。

验收：

- [x] `npm run test:data` 通过。
- [x] `npm run test:data-range` 通过。
- [x] `npm run perf:data-read-model` 比阶段 0 有可解释改善，尤其是 365 天 app trend。

## 10. 阶段 4：刷新策略微调

目标：减少“刚用缓存显示，又马上重复拉同一份数据”的成本，同时保留最新数据刷新。

### 10.1 判断是否需要短 TTL

- [ ] 先用阶段 1 的 in-flight 去重观察是否已足够。
- [ ] 如果仍有重复刷新，再考虑短 TTL。
- [ ] TTL 只能用于“刚完成的同范围快照”，不能长期阻止刷新。
- [ ] 默认 TTL 建议从 `1s` 到 `3s` 开始，不做用户可见设置。

### 10.2 Data

- [ ] `useDataTrendSnapshot` 命中非常新的 cache 时，可以跳过立即重复 load。
- [ ] 仍应在 tracking data changed 或范围切换后刷新。
- [ ] 不改变 bootstrap snapshot 的显示逻辑。

### 10.3 History

- [ ] `History.tsx` 命中非常新的 cache 时，可以跳过同 tick 重复 load。
- [ ] 日期切换必须仍然加载目标日期。
- [ ] tracking data changed 后当前 History 页仍然刷新。

测试：

- [ ] 增加 cache freshness policy 单元测试。
- [ ] 验证旧 cache 不会阻止刷新。
- [ ] 验证不同日期、不同范围不会被 TTL 误伤。

验收：

- [ ] 页面切换仍无明显空白。
- [ ] 最新数据最多只延迟 TTL 级别。
- [ ] `npm run test:warmup` 通过。
- [ ] `npm run test:background-return` 通过。

## 11. 阶段 5：SQLite 查询计划评估

目标：只有在读模型去重和聚合后仍然有压力时，才评估 SQLite 层。

### 11.1 固定查询

- [ ] 列出当前重路径 SQL。
- [ ] 至少包含：
  - [ ] sessions range query
  - [ ] session title samples range query
  - [ ] aggregate session summaries range query
  - [ ] web activity range query
- [ ] 使用真实参数范围：今天、7 天、30 天、365 天。

### 11.2 EXPLAIN

- [ ] 为每条 SQL 运行 `EXPLAIN QUERY PLAN`。
- [ ] 记录是否使用 `idx_sessions_date`。
- [ ] 记录是否出现明显 full scan。
- [ ] 记录 `COALESCE(end_time, ?)` 对计划的影响。

### 11.3 方案判断

只有满足下面条件时才进入 SQLite 改动：

- [ ] 前端重复计算已经收敛。
- [ ] 真实或合成大库仍显示 SQLite range query 是主要瓶颈。
- [ ] 查询计划显示现有索引不能有效支持目标范围。
- [ ] 新索引或拆查询不会改变统计口径。

可评估方案：

- [ ] 为 closed sessions 与 active session 拆查询，减少 `COALESCE` 对索引的影响。
- [ ] 增加 `end_time` 或复合索引。
- [ ] 为常见 read path 建覆盖索引。
- [ ] 对 `session_title_samples` 按 session ids 批量读取继续保留参数化查询。

必须暂停讨论的方案：

- [ ] 新增持久化 summary table。
- [ ] 修改 session 表结构。
- [ ] 改变 migration baseline。
- [ ] 把前端 read model 大量迁入 Rust command。

## 12. 阶段 6：验证矩阵

### 12.1 局部验证

- [x] `npm run test:data`
- [x] `npm run test:data-range`
- [x] `npm run test:data-chart`
- [x] `npm run test:history-timeline`
- [x] `npm run test:warmup`
- [x] `npm run test:background-return`
- [x] `npm run perf:data-read-model`
- [x] `npm run perf:history-read-model`

### 12.2 边界验证

- [x] `npm run check:naming`
- [x] `npm run check:architecture`

### 12.3 完整验证

- [x] `npm run check`

如果触及 Rust data schema、migration 或 repository：

- [ ] `npm run check:rust`
- [ ] `npm run check:full`

## 13. 手工验收

### 13.1 Data 页

- [x] 从 Dashboard 切到 Data，首屏无明显空白。
- [x] Data 先显示缓存或 bootstrap snapshot 后，能后台更新最新数据。
- [x] 切换 7 天、30 天、最近一年，趋势图正确。
- [x] 自定义范围跨 62 天后，granularity 正确切换。
- [x] 搜索 app 后，默认选中与图表联动正确。
- [x] 双击趋势图日期后能跳到 History 对应日期。
- [x] 热力图 recent 与指定年份切换正确。
- [x] 日粒度和周粒度切换正确。
- [x] 长数据用户下切换仍然顺。

### 13.2 History 页

- [x] 从 Dashboard 切到 History，首屏无明显空白。
- [x] 日期前后切换正确。
- [x] timeline、timeline zoom、day distribution 正确。
- [x] min session duration 控件仍生效。
- [x] web activity 开启时 app/web 分布正确。
- [x] live session 正常本地 ticking，不依赖每秒 SQLite 重读。
- [x] tracking data changed 后当前 History 页刷新。

### 13.3 后台与回前台

- [x] 短时间切后台再回来，Data / History 不丢当前页面状态。
- [x] 长时间后台后按现有策略回 Dashboard。
- [x] heavy cache 按现有策略释放。
- [x] 回前台预热不造成明显卡顿。

## 14. 风险清单

- [x] 风险：in-flight key 过粗导致不同范围复用错误。
  - 缓解：key 必须包含 date/range/selection。
- [x] 风险：短 TTL 导致数据看起来不刷新。
  - 缓解：TTL 保持极短，只跳过刚完成的重复请求。
- [x] 风险：Data bucket 聚合改变跨天/跨月裁剪口径。
  - 缓解：新增跨天、跨月、range boundary 测试。
- [x] 风险：app alias 和 display name 合并结果变化。
  - 缓解：保留现有 display option 合并测试并增加 alias 测试。
- [x] 风险：History weekly 轻量路径绕过分类排除。
  - 缓解：轻量路径仍通过 `AppClassification` 或复用现有过滤函数。
- [x] 风险：SQLite 优化引入 migration 风险。
  - 缓解：SQLite 改动放到后续阶段，必须单独评审和补 Rust 验证。

## 15. 完成定义

本执行方案完成时，应同时满足：

- [x] Data / History 页面可见行为不变。
- [x] Data 365 天 app trend 性能有可解释改善。
- [x] History snapshot 并发重复读取减少。
- [x] Data heatmap 并发重复读取减少。
- [x] 新增或更新的测试覆盖关键风险。
- [x] `npm run check` 通过。
- [x] 性能结果记录在最终总结中。
- [x] 若形成长期规则，回写 `docs/engineering-quality.md`。
- [x] 本文移入 `docs/archive/`，或保留为仍在执行中的 `docs/working/` 文档。

## 16. 建议执行顺序

- [x] PR 1：新增 `perf:data-read-model`，只加测量，不改业务。
- [x] PR 2：Data heatmap in-flight 去重，补测试。
- [x] PR 3：History snapshot in-flight 去重，补测试。
- [x] PR 4：History weekly 轻量读取，补 read model 测试。
- [x] PR 5：Data 一次编译、一次落桶，补 Data 长周期测试。
- [ ] PR 6：按测量结果决定是否做短 TTL。
- [ ] PR 7：仅在需要时做 SQLite 查询计划与索引执行单。

如果在任一 PR 中发现统计口径变化，停止继续优化，先修正口径或回退该阶段。
