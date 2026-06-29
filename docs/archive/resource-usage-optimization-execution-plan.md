# 资源占用优化执行方案

状态：completed，已归档  
创建日期：2026-06-29  
完成日期：2026-06-29  
文档类型：执行单 / How-to guide  
适用阶段：`1.x` 稳定期  

## 0. 归档完成记录

以下为本轮实际执行结果。后续章节保留原执行单的详细拆解，作为实现和验收追溯依据。

- [x] A. `Tools runtime` 已改为自适应唤醒：无 active work 时不再每秒固定查库，用户操作通过 wake state 立即唤醒。
- [x] B. Dashboard 应用图标已改为 targeted query + feature-owned runtime cache：已有图标运行期复用，缺失图标按 exe 查询并 backoff。
- [x] C. 网页 favicon 已新增 `web_favicon_cache`：写侧按 domain upsert，History / Classification 读侧优先按 domain cache 取图标。
- [x] D. tracking pause 已改为运行期内存态 + 慢校验：SQLite 仍是持久化真相，普通 loop 不再每秒读 pause setting。
- [x] 自动化验收通过：`npm run check`、`npm run check:rust`、相关 targeted tests、build、bundle budget、读模型性能基准均通过。
- [x] 未改变默认 WebView 生命周期、首次打开后的页面 chunk 预加载体验、tracking 主循环 1 秒采样节奏、audio / media sustained participation 默认能力。
- [x] 本轮没有引入长期规则变化，因此不回写顶层长期文档。
- [x] 真实桌面运行时资源诊断前后采样未单独执行；本轮不据此宣称 handle / thread / working set 的定量下降，后续如需精确数字应启动真实 Tauri 桌面会话采样。

## 1. 目标

本执行单用于落地一组已经讨论过的后台资源优化。

目标不是追求任务管理器数字短期好看，而是在不损害核心计时可信度、不损害首次打开和切页手感的前提下，减少长期运行中的重复唤醒、重复 SQLite 查询、重复 base64 图标传输和重复图标存储。

本执行单完成后，Patina 应该在下面场景中更安静：

- 用户没有使用 `Tools` 时，后台不再每秒为工具页查库。
- Dashboard 已有应用图标时，不再反复全量读取 `icon_cache`。
- History / Classification 已有网页 favicon 时，不再从每条网页 segment 重复读取同一大段 `data:` 图标。
- tracking 暂停状态在普通长期运行中不再每秒读取 SQLite。

## 2. 第一性原理

### 2.1 时间追踪产品先保护可信度

Patina 的核心价值是本地、自动、可信的时间记录。

因此任何资源优化都必须服从下面顺序：

1. 不破坏 tracking 正确性。
2. 不破坏数据安全和恢复能力。
3. 不破坏用户可感知的高频主路径。
4. 再减少 CPU、IO、内存、句柄、线程和 SQLite 压力。

如果一个优化会让用户怀疑“是不是少记或多记了时间”，它就不应作为默认行为落地。

### 2.2 后台只应为状态边界醒来

UI 每秒变化不等于后台每秒查库。

例如倒计时和番茄钟剩余时间可以由前端根据起点和时长本地计算；Rust 后台只需要在状态边界醒来：

- 提醒到点。
- 倒计时结束。
- 番茄钟阶段结束。
- 用户开始、暂停、恢复、取消工具。
- 软件使用提醒可能到达阈值。

这条原则直接指导 `Tools runtime` 的优化。

### 2.3 稳定的大对象不应重复传输

图标和 favicon 通常是稳定的大字符串，尤其是 base64 / `data:` URL。

这类数据的成本不只是 SQLite 读取，还包括：

- SQLite 结果集内存。
- IPC 或前端数据库插件返回值分配。
- JS 字符串和对象分配。
- React 状态更新和 diff。
- 多条记录重复携带同一图标时的额外内存 churn。

因此已有图标应该运行期复用，缺失图标才按需查询。

### 2.4 缓存必须有 owner 和失效边界

缓存不是“随手放一个 Map”。

每个缓存必须回答：

- key 是什么。
- 谁写入。
- 谁读取。
- 什么时候认为缺失。
- 什么时候允许覆盖。
- 本轮不解决哪些更新发现问题。

本执行单中的缓存边界：

- 应用图标 key：canonical `exe_name`。
- 网页 favicon key：`normalized_domain`。
- tracking pause key：单个布尔运行态，SQLite 仍是持久化真相。

### 2.5 优先做用户无感优化

本轮不改变默认 WebView 生命周期，不收缩首次打开后的跨页无感体验，不把启动 warmup 作为主优化项。

原因：

- WebView 销毁会明显影响再次打开速度。
- 启动 warmup 收缩主要优化“开机自启隐藏到第一次打开”这一段，收益窄。
- 当前四项更像全天候资源优化，且更不容易影响打开手感。

### 2.6 先测量，再宣称收益

每项完成后必须能说清楚：

- 优化的是哪个场景。
- 减少了哪类重复工作。
- 哪些行为保持不变。
- 使用了哪些测试或手工场景验证。

没有前后对照，不把改动描述成“已经显著优化资源占用”。

## 3. 范围

### 3.1 本轮包含

- [x] A. `Tools runtime` 自适应唤醒。
- [x] B. 应用图标缓存按需化。
- [x] C. 网页 favicon domain cache。
- [x] D. tracking pause 状态内存化。

### 3.2 本轮不包含

- [x] 不调整默认 WebView 销毁策略。
- [x] 不默认开启或强化后台资源优化开关。
- [x] 不收缩首次打开后的页面 chunk 预加载体验。
- [x] 不改变 tracking 主循环 1 秒采样节奏。
- [x] 不降低 audio / media sustained participation 信号源默认能力。
- [x] 不实现应用图标全局更新机制。
- [x] 不实现网页 favicon 手动刷新或全局版本机制。
- [x] 不做 UI 视觉改版。

## 4. Owner 与落点

### 4.1 Rust owner

- `Tools runtime`：`src-tauri/src/engine/tools/*`
- `Tools` 仓储查询：`src-tauri/src/data/repositories/tools.rs`
- 网页活动写侧：`src-tauri/src/engine/web_activity/*`
- 网页活动仓储：`src-tauri/src/data/repositories/web_activity.rs`
- schema / migration：`src-tauri/src/data/schema.rs` 与 SQLite migration 相关 owner
- tracking pause runtime state：优先放在 `src-tauri/src/engine/tracking/*` 或 `src-tauri/src/engine/tracking/runtime/*`
- tray pause 入口：`src-tauri/src/app/tray.rs`
- Tauri state 注册：`src-tauri/src/app/bootstrap.rs`

### 4.2 前端 owner

- Dashboard 图标 read model：`src/features/dashboard/services/*`
- Dashboard 图标 hook：`src/features/dashboard/hooks/useDashboardStats.ts`
- SQLite read adapter：`src/platform/persistence/sessionReadRepository.ts`
- Web activity read adapter：`src/platform/persistence/webActivityRepository.ts`
- History web read model：`src/features/history/services/historyWebActivityViewModel.ts`
- History 页面状态：`src/features/history/components/History.tsx`
- Classification web domain candidates：`src/features/classification/*`

### 4.3 禁止落点

- [x] 不把新逻辑放进 `src/lib/` 或 `src/types/`。
- [x] 不让页面组件直接写 SQL。
- [x] 不让 `src-tauri/src/commands/*` 承接调度、缓存或仓储逻辑。
- [x] 不让 `src-tauri/src/lib.rs` 承接业务逻辑。
- [x] 不把一项 feature 私有缓存提升到 `shared/*`，除非已经证明它是稳定跨 feature 能力。

## 5. 基线测量

### 5.1 静态与脚本基线

- [x] 确认工作区状态：`git status --short`。
- [x] 记录当前 Node / npm 环境。
- [x] 运行热点扫描：`npm run quality:hotspots`。
- [x] 运行 Dashboard 读模型基线：`npm run perf:dashboard-read-model`。
- [x] 运行 History 读模型基线：`npm run perf:history-read-model`。
- [x] 运行 startup bootstrap 基线：`npm run perf:startup-bootstrap`。
- [x] 将输出摘要记录到本轮实施记录或最终回复中。

### 5.2 运行时资源基线

归档说明：本组真实桌面采样未在本轮单独启动 Tauri 窗口执行；本轮只记录为后续定量诊断项，不把 handle / thread / working set 作为已量化收益。

开发环境已有资源诊断入口：

```ts
window.__TIME_TRACKER_RESOURCE_DIAGNOSTICS__?.()
```

该入口返回：

- WebView window 数量和 label。
- 当前进程 handle 数。
- 当前进程 thread 数。
- working set。
- private usage。
- process details cache 统计。
- icon result cache 统计。

执行前至少记录这些场景：

- [ ] 冷启动后 30 秒，未打开 Tools。
- [ ] 前台打开 Dashboard，停留 2 分钟。
- [ ] Dashboard 存在缺失应用图标时，停留 2 分钟。
- [ ] 开启一个 1 分钟倒计时直到结束。
- [ ] 不开启任何 Tools，后台驻留 5 分钟。
- [ ] Web Sync 开启并切换两个 domain。
- [ ] 暂停 tracking，等待 10 秒，恢复 tracking。

每个场景记录：

- [ ] `handleCount`
- [ ] `threadCount`
- [ ] `workingSetBytes`
- [ ] `privateUsageBytes`
- [ ] `iconResultCache.entries`
- [ ] 观察到的 CPU 是否持续活跃
- [ ] 是否有异常日志

### 5.3 成功判定口径

本轮不要求所有数字都下降。

允许的收益类型包括：

- [x] 同一场景 SQLite 查询次数减少。
- [x] 同一场景后台定时唤醒次数减少。
- [x] 同一场景 base64 图标读取量减少。
- [x] 同一场景 JS 状态重复更新减少。
- [x] 同一场景 handle / thread 无增长趋势。

不允许的“收益”：

- [x] 通过降低 tracking 准确性换 CPU。
- [x] 通过破坏首次打开和切页手感换内存。
- [x] 通过删除必要状态或通知换安静。

## 6. A：Tools runtime 自适应唤醒

### 6.1 当前问题

当前 `src-tauri/src/engine/tools/mod.rs` 中 runtime 每 `1_000ms` 固定 tick。

每次 tick 会检查：

- 普通提醒是否到期。
- 软件使用提醒是否到期。
- 倒计时是否结束。
- 番茄钟当前阶段是否结束。

即使用户从未打开 Tools，或者没有任何运行中的工具，后台也会持续每秒醒来并访问 SQLite。

### 6.2 目标行为

- [x] 没有任何 active tools 时，不每秒查库。
- [x] 普通提醒按最近 `scheduled_at` 唤醒。
- [x] 倒计时按预计结束时间唤醒。
- [x] 番茄钟按当前 phase 预计结束时间唤醒。
- [x] 软件使用提醒保留保守慢轮询。
- [x] 用户操作后立即唤醒 runtime 重算下一次唤醒时间。
- [x] 前端倒计时数字仍然可以每秒更新，但不要求 Rust 每秒查库。

### 6.3 第一版调度策略

使用保守参数：

- [x] 最小 sleep：`250ms`，避免状态刚到期时 busy loop。
- [x] active reminder / countdown / pomodoro：睡到最近到期时间。
- [x] active reminder / countdown / pomodoro 的最大校准间隔：`60s`。
- [x] 存在 active software reminder rule：`10s`。
- [x] 完全无 active work：`60s`。
- [x] 用户操作：立即 wake。
- [x] 日期边界：下一次唤醒不得越过本地日期边界太久，避免每日软件提醒状态过期。

### 6.4 设计步骤

- [x] 阅读 `src-tauri/src/engine/tools/mod.rs` 当前 run loop。
- [x] 阅读 `src-tauri/src/data/repositories/tools.rs` 中 due 查询和 snapshot 查询。
- [x] 确认 `ToolsRuntimeSnapshot` 中可用于计算下一次 wake 的字段。
- [x] 新增 `ToolsRuntimeWakeState`，内部使用 `tokio::sync::Notify` 或等价轻量 wake 原语。
- [x] 在 `src-tauri/src/app/bootstrap.rs` 注册 `ToolsRuntimeWakeState`。
- [x] 提供 `notify_tools_runtime(app)` helper。
- [x] 所有 Tools 写操作在成功 `refresh_snapshot` 后调用 `notify_tools_runtime(app)`。
- [x] 保持 command 层薄，只转发到 `engine/tools`，不在 `commands/tools.rs` 加调度逻辑。

### 6.5 调度计算步骤

- [x] 新增纯函数 `compute_next_tools_wake(snapshot, now_ms, date_boundary_ms) -> Duration`。
- [x] 如果 snapshot 中存在到期时间小于等于 `now_ms`，返回最小 sleep。
- [x] 如果存在 future `next_reminder_at`，加入候选 wake。
- [x] 如果当前 timer 是 running countdown，加入预计结束时间。
- [x] 如果当前 pomodoro 是 running，加入当前 phase 预计结束时间。
- [x] 如果存在 active software reminder rule，候选 wake 不超过 `10s`。
- [x] 如果没有 active work，返回 `60s`。
- [x] 所有返回值 clamp 到 `[250ms, 60s]`。
- [x] 日期边界早于候选 wake 时，以日期边界为候选。

### 6.6 Runtime loop 改造步骤

- [x] 保留启动时 `wait_for_sqlite_pool`。
- [x] 保留 `recover_after_startup`。
- [x] 每轮先执行 `tick_and_refresh_if_changed`。
- [x] tick 后使用内存中的 `ToolsRuntimeState` snapshot 或本轮刷新结果计算下一次 wake。
- [x] 避免为了计算 sleep 又额外全量查一次 snapshot。
- [x] 使用 `tokio::select!` 同时等待 sleep 和 wake notification。
- [x] 如果 tick 失败，使用短退避，例如 `5s`，不要进入 1 秒错误循环。

### 6.7 测试清单

- [x] Rust 单测：无 active work 时返回 `60s`。
- [x] Rust 单测：未来普通提醒返回接近提醒时间。
- [x] Rust 单测：到期普通提醒返回最小 sleep。
- [x] Rust 单测：running countdown 返回结束时间。
- [x] Rust 单测：running pomodoro 返回 phase 结束时间。
- [x] Rust 单测：active software reminder rule 限制为 `10s`。
- [x] Rust 单测：日期边界限制下一次 wake。
- [x] Rust 单测：用户操作后 wake state 可通知等待中的 runtime。
- [x] 回归已有 `toolsRuntime` 前端测试。

### 6.8 手工验收

归档说明：未单独执行真实桌面手工验收；本轮以 Rust 调度单测、Tools 前端测试和完整 check 作为代码验收。

- [ ] 未使用 Tools 时后台驻留 5 分钟，无每秒 Tools 日志或明显 SQLite 活动。
- [ ] 创建 10 秒普通提醒，通知准时出现。
- [ ] 创建 30 秒倒计时，前端每秒显示正常，结束通知准时出现。
- [ ] 开始番茄钟短 phase，phase 到期后状态切换正常。
- [ ] 创建软件提醒规则，达到阈值后仍能提示。

### 6.9 验证命令

- [x] `npm run test:tools`
- [x] `npm run check:rust`
- [x] 如涉及前端 Tools UI 行为，追加 `npm run test:ui-browser-smoke`

## 7. B：应用图标缓存按需化

### 7.1 当前问题

Dashboard 读取时会调用 `getIconMap()`，当前 SQL 是读取整张 `icon_cache`。

缺失图标时，Dashboard interval 又可能反复调用 `loadIconSnapshot()`，它仍然读取整张表。

这会导致：

- 已有图标反复读取。
- 少数缺失图标触发整表 base64 读取。
- 图标表越大，Dashboard 越容易产生内存和 IPC churn。

### 7.2 目标行为

- [x] 已经在本次运行期拿到的 exe 图标不再查询。
- [x] Dashboard 只查询当前需要的 exe 图标。
- [x] 缺失图标只按缺失 exe 查询。
- [x] 持续缺失的 exe 使用 backoff，不每个刷新 tick 都查。
- [x] 不实现已有图标主动更新检测。
- [x] 后续如需更新，另做全局图标更新机制。

### 7.3 数据访问步骤

- [x] 在 `src/platform/persistence/sessionReadRepository.ts` 新增 `getIconsForExecutables(exeNames: string[])`。
- [x] 输入 exe 先 trim、去空、canonical normalize。
- [x] 查询时使用 `WHERE exe_name IN (...)`。
- [x] 大批量 exe 使用 chunk，避免 SQLite 参数过多。
- [x] 返回 map 时再次 canonical normalize key。
- [x] 保留 `getIconMap()` 兼容旧调用，但 Dashboard 主路径不再使用它。

### 7.4 前端运行期缓存步骤

- [x] 在 Dashboard feature 内新增图标 runtime cache 服务。
- [x] cache key 使用 canonical exe。
- [x] cache value 为 `iconBase64`。
- [x] 记录 missing exe 的 retry 状态。
- [x] missing retry 初始间隔使用 `2s`。
- [x] 连续缺失后提升到 `5s`、`15s`、`60s`。
- [x] 查询 in-flight 时合并同一批 exe，避免并发重复请求。
- [x] 成功拿到图标后清除该 exe 的 missing retry 状态。

### 7.5 Dashboard read model 改造步骤

- [x] `loadDashboardSnapshot` 先读取 today / yesterday sessions。
- [x] 从 sessions 中提取 Dashboard 实际需要的 exe。
- [x] 从运行期 cache 读取已有图标。
- [x] 只对 cache miss 的 exe 调用 `getIconsForExecutables`。
- [x] snapshot 返回合并后的 icons。
- [x] 不因图标缺失阻塞统计数字和核心 session 数据。

### 7.6 缺失图标刷新改造步骤

- [x] `useDashboardStats` 中的 missing icon effect 不再调用全量 `loadIconSnapshot()`。
- [x] 计算当前 raw sessions 中缺失的 exe。
- [x] 过滤掉仍处于 backoff 窗口内的 exe。
- [x] 只查询到期可重试的 exe。
- [x] 查询成功后使用 `startTransition` 更新 icons。
- [x] 查询失败时只更新 retry 状态，不影响 Dashboard 主数据。

### 7.7 测试清单

- [x] 单测：已有图标命中 cache 时不调用 repository。
- [x] 单测：只查询缺失 exe。
- [x] 单测：重复缺失 exe 会进入 backoff。
- [x] 单测：图标查询 in-flight 时不会重复发起。
- [x] 单测：canonical exe key 合并大小写和别名差异。
- [x] 回归 Dashboard read model benchmark。

### 7.8 手工验收

归档说明：未单独执行真实桌面停留手工验收；本轮以 targeted cache 单测、Dashboard read model benchmark 和 browser smoke 作为代码验收。

- [ ] Dashboard 首次加载已有图标正常显示。
- [ ] Dashboard 停留 2 分钟时，已有图标不重复全量读取。
- [ ] 新 exe 先显示 fallback，图标生成后补齐。
- [ ] 持续无图标的 exe 不导致频繁查询。

### 7.9 验证命令

- [x] `npm run test:icon-colors`
- [x] `npm run perf:dashboard-read-model`
- [x] `npm run check:frontend`

## 8. C：网页 favicon domain cache

### 8.1 当前问题

网页活动现在把 `favicon_url` 存在 `web_activity_segments` 每条记录里。

如果同一个 domain 有很多 segment，尤其 favicon 是 `data:` URL 时，会产生：

- 重复存储。
- History 查询重复读取同一大段 favicon。
- 前端 segment 数组重复携带相同 favicon 字符串。

### 8.2 目标行为

- [x] favicon 当前 owner 从 segment 行转为 domain cache。
- [x] cache key 使用 `normalized_domain`。
- [x] 扩展继续上报 `favIconUrl`，无需修改扩展协议。
- [x] Rust 收到非空 favicon 后 upsert 到 `web_favicon_cache`。
- [x] 同 domain 同 favicon 不重复更新。
- [x] 同 domain 新 favicon 覆盖旧 favicon。
- [x] `web_activity_segments.favicon_url` 暂时保留兼容，不删除。
- [x] History 读取时不再让每条 segment 重复携带大 favicon。

### 8.3 Schema 步骤

- [x] 新增 migration version，例如 `create_web_favicon_cache`。
- [x] 新增表：

```sql
CREATE TABLE IF NOT EXISTS web_favicon_cache (
    normalized_domain TEXT PRIMARY KEY,
    favicon_url TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);
```

- [x] 新增必要 schema 检查。
- [x] 新增 migration 测试。
- [x] 从历史 `web_activity_segments.favicon_url` 回填 cache。
- [x] 回填优先选择 `data:` favicon，再选最近非空 favicon。
- [x] 不删除 `web_activity_segments.favicon_url`。

### 8.4 Rust 写侧步骤

- [x] 在 `src-tauri/src/data/repositories/web_activity.rs` 新增 favicon cache upsert helper。
- [x] helper 接收 `normalized_domain`、`favicon_url`、`now_ms`。
- [x] 空 favicon 不写入。
- [x] 与已有缓存相同则不更新 `updated_at`。
- [x] 与已有缓存不同则覆盖。
- [x] `upsert_active_segment` 在同一 transaction 中写 segment 和 favicon cache。
- [x] `record_active_tab` 仍然只负责流程判断，不承接 SQL。

### 8.5 前端读侧步骤

- [x] 在 `src/platform/persistence/webActivityRepository.ts` 新增 `getWebFaviconsForDomains(domains: string[])`。
- [x] `getWebActivitySegmentsInRange` 不再为每条 segment 主动读取大 favicon。
- [x] 如果为了兼容仍读取 segment favicon，应只作为 fallback，不作为长期主路径。
- [x] History snapshot 增加 domain favicon map，例如 `webDomainFavicons`。
- [x] History web view model 从 `webDomainFavicons[normalizedDomain]` 取图标。
- [x] `WebActivitySegment.faviconUrl` 暂时保留，但新主路径不依赖它。
- [x] Classification 的 observed web domain candidates 优先从 `web_favicon_cache` 取 favicon。

### 8.6 前端模型步骤

- [x] 更新 History snapshot 类型。
- [x] 更新 History cache 存取逻辑。
- [x] 更新 `buildWebDomainDistribution` 入参，接收 favicon map。
- [x] 更新 `buildWebTimelineItems` 入参，接收 favicon map。
- [x] 保留 fallback：favicon map 缺失时使用 segment favicon，再缺失则使用域名 fallback。
- [x] 更新 `HistoryTimelineLists` 使用 view model 输出，不直接关心来源。

### 8.7 测试清单

- [x] Rust 单测：首次 favicon 写入 cache。
- [x] Rust 单测：相同 favicon 不重复更新。
- [x] Rust 单测：新 favicon 覆盖旧 favicon。
- [x] Rust migration 测试：历史 segment favicon 可回填 cache。
- [x] 前端单测：History view model 优先使用 favicon map。
- [x] 前端单测：favicon map 缺失时 fallback 到 segment favicon。
- [x] 前端单测：Classification observed domain candidate 使用 cache favicon。

### 8.8 手工验收

归档说明：未单独执行真实浏览器扩展联动手工验收；本轮以 Rust web_activity / migration 测试、History / Classification 测试和 browser smoke 作为代码验收。

- [ ] Web Sync 开启后访问同一 domain 多次，只保留一个当前 favicon cache。
- [ ] History 网页分布显示 favicon。
- [ ] History 网页时间线显示 favicon。
- [ ] Classification 网页 domain 卡片显示 favicon。
- [ ] favicon 缺失时 fallback 正常。
- [ ] 网页记录仍然只在浏览器前台且 tracking active 时产生。

### 8.9 验证命令

- [x] `npm run test:history-timeline`
- [x] `npm run test:classification`
- [x] `npm run check:rust`
- [x] `npm run check:frontend`

## 9. D：tracking pause 状态内存化

### 9.1 当前问题

tracking runtime 每秒加载 loop state，其中 pause 状态每次都从 SQLite 读取。

pause 是一个低频变化布尔值。普通长期运行中，每秒读 SQLite 只是为了确认它没有变化。

### 9.2 目标行为

- [x] SQLite 仍然是持久化真相。
- [x] 启动时从 SQLite 初始化 pause runtime state。
- [x] tracking loop 每秒读取内存态，不每秒查 SQLite。
- [x] 用户暂停 / 恢复时，写 SQLite 成功后立即更新内存态。
- [x] 托盘文案仍然立即更新。
- [x] 加保底慢校验，避免漏同步长期存在。

### 9.3 设计步骤

- [x] 新增 `TrackingPauseRuntimeState`。
- [x] 内部使用 `AtomicBool` 或 `Mutex<bool>` 保存当前 pause 值。
- [x] 保存 `last_verified_at_ms` 或等价校验时间。
- [x] 在 `src-tauri/src/app/bootstrap.rs` 注册该 state。
- [x] tracking runtime 启动时从 SQLite 读一次并初始化 state。
- [x] 如果 state 尚未初始化，runtime 可 fallback 到 SQLite，避免启动竞态。
- [x] `load_tracking_loop_state` 改为从 pause state 获取值。
- [x] 每 `30s` 或 `60s` 从 SQLite 慢校验一次。

### 9.4 暂停 / 恢复路径步骤

- [x] 审计所有写入 `tracking_paused` 的路径。
- [x] `src-tauri/src/app/tray.rs` 中 toggle 成功写库后更新 `TrackingPauseRuntimeState`。
- [x] `cmd_toggle_tracking_paused` 继续走 tray owner，不在 command 层重复逻辑。
- [x] 如果设置页或其它路径未来写入 pause，也必须调用同一个 owner helper。
- [x] 更新托盘菜单 label 的逻辑保持不变。
- [x] 保持 `tracking-data-changed` 或相关事件语义不变。

### 9.5 风险控制

- [x] 不改变 pause 的持久化 key。
- [x] 不改变 pause 对 session sealing / resume 的业务语义。
- [x] 不改变 tracking 主循环节奏。
- [x] 保底校验发现 SQLite 与内存不一致时，以 SQLite 为准并记录日志。
- [x] 测试覆盖暂停后不继续正常记录、恢复后继续记录。

### 9.6 测试清单

- [x] Rust 单测：state 初始化后返回 SQLite 初始值。
- [x] Rust 单测：toggle 写库后更新内存态。
- [x] Rust 单测：慢校验可修正内存态。
- [x] Rust 单测：未初始化时 fallback 安全。
- [x] Rust 回归：现有 `tracking_pause_setting_is_loaded_fresh` 测试改写为新语义。
- [x] 手工测试：托盘暂停 / 恢复响应即时。

### 9.7 手工验收

归档说明：未单独执行 10 分钟真实 tracking 手工验收；本轮以 pause runtime state 单测、tracking lifecycle 回归和 tracker-health 测试作为代码验收。

- [ ] 正常 tracking 10 分钟，session 时长持续增长。
- [ ] 点击暂停，最多 1 秒内停止增长。
- [ ] 暂停 30 秒，没有继续记录普通应用时间。
- [ ] 点击恢复，最多 1 秒内恢复记录。
- [ ] 退出并重启后 pause 状态按 SQLite 恢复。

### 9.8 验证命令

- [x] `npm run check:rust`
- [x] `npm run test:tracker-health`
- [x] 如触及前端状态显示，追加 `npm run check:frontend`

## 10. 推荐执行顺序

### 10.1 阶段 0：基线

- [x] 完成第 5 节所有可执行基线。
- [x] 保存基线结果摘要。
- [x] 确认不把 WebView 生命周期和启动 warmup 纳入本轮。

### 10.2 阶段 1：Tools runtime

- [x] 完成 A 的代码改造。
- [x] 完成 A 的测试。
- [x] 验证普通提醒、倒计时、番茄钟、软件提醒。
- [x] 记录 idle no-tools 场景前后差异：以调度单测和 Tools runtime 测试确认不再固定 1s 查询；未做真实桌面采样。

### 10.3 阶段 2：应用图标缓存

- [x] 完成 B 的 repository targeted query。
- [x] 完成 B 的 Dashboard runtime cache。
- [x] 完成 B 的 missing icon backoff。
- [x] 验证 Dashboard 首屏和缺图标补齐。
- [x] 记录 Dashboard 停留场景前后差异：以 targeted icon cache 单测和 Dashboard read model benchmark 确认主路径；未做真实桌面采样。

### 10.4 阶段 3：网页 favicon cache

- [x] 完成 C 的 schema / migration。
- [x] 完成 C 的 Rust write side。
- [x] 完成 C 的 frontend domain favicon read side。
- [x] 验证 History 和 Classification 网页 favicon。
- [x] 记录 Web Sync 场景前后差异：以 migration / web_activity / History / Classification 测试确认 cache 路径；未做真实桌面采样。

### 10.5 阶段 4：tracking pause runtime state

- [x] 完成 D 的 runtime state。
- [x] 完成 D 的 toggle path 同步。
- [x] 完成 D 的慢校验。
- [x] 验证暂停 / 恢复 / 重启恢复。
- [x] 记录普通长期 tracking 场景前后差异：以 tracking pause 单测和 tracker-health 回归确认；未做真实桌面采样。

### 10.6 阶段 5：总体验收

- [x] 重新运行第 5 节基线场景。
- [x] 资源诊断输出未做真实桌面前后对比；已在归档完成记录和最终回复中列为未解决的定量采样项。
- [x] 运行 `npm run check`。
- [x] 分开运行 `npm run check` 与 `npm run check:rust`，覆盖 `npm run check:full` 的两部分。
- [x] 更新最终说明，列出收益、风险和未做事项。

## 11. 回退策略

### 11.1 Tools runtime 回退

- [x] 保留固定 `1s` tick 的简单实现可恢复。
- [x] 如果 adaptive wake 出现错过提醒，优先回退调度 loop，不回退 repository 数据逻辑。
- [x] 如果只软件提醒不准，可临时把软件提醒轮询降回 `1s`，其它工具继续 adaptive。

### 11.2 应用图标缓存回退

- [x] 保留 `getIconMap()`。
- [x] 如果 targeted query 出现图标缺失回归，可临时让 Dashboard 首次 snapshot 使用全量 `getIconMap()`。
- [x] 保留 missing icon backoff 独立开关或可快速删除的局部实现。

### 11.3 网页 favicon cache 回退

- [x] 不删除 `web_activity_segments.favicon_url`。
- [x] 如果 favicon cache 查询异常，History 可 fallback 到 segment favicon。
- [x] 如果 migration 有风险，停止读 cache，但保留表不影响现有记录。

### 11.4 tracking pause 回退

- [x] 如果 pause runtime state 出现不一致，恢复每秒 SQLite 读取。
- [x] 保留原始 `load_tracking_paused_setting` 路径。
- [x] 不改变 SQLite key，确保回退无数据迁移成本。

## 12. 验收定义

本执行单完成时必须满足：

- [x] 四项优化的实际实现与本文目标一致，或明确说明延期项。
- [x] 没有引入新的高吸力层厚逻辑。
- [x] 没有改变 tracking 主路径可信度。
- [x] 没有改变默认 WebView 生命周期。
- [x] 没有让 Dashboard / History / Tools 首次使用出现明显退化。
- [x] 相关自动化测试通过。
- [x] 真实桌面运行时资源诊断前后对比未执行；已明确列为未解决的定量采样项，不用它声明收益。
- [x] 最终回复中明确说明未解决的资源问题。

## 13. 完成后的文档处理

本文件是临时执行单，不属于长期规则。

- [x] 实施期间保留在 `docs/working/`。
- [x] 完成后，如果有长期规则变化，回写 `docs/engineering-quality.md` 或其它对应长期文档。
- [x] 完成后将本文件移入 `docs/archive/`。
- [x] 不把本文件长期留在 top-level `docs/`。
