# 持久化应用目录与活动汇总读模型：可勾选执行方案

> 文档类型：How-to / 一次性执行计划
> 目标读者：Patina 维护者与承担实现、评审、验证的开发者
> 对应 Project 项：建立持久化应用目录与活动汇总读模型
> 当前状态：已完成并归档；本文保留为实施与验证记录，不是新的独立产品事项
> 归档规则：任务完成并稳定后移入 `docs/archive/`

> 勾选语义：`[x]` 表示该项已经实现、验证，或经过第一性原理复核后由本节记录的等价方案明确取代；不表示为了服从旧草案而保留无消费者的临时机制。

## 0. 执行结果（2026-07-22）

本计划已完成。三张事实表继续是唯一真相；Migration 8 只增加可删除、可重建的应用目录与小时活动投影、状态、revision 和 dirty 协议。Classification 已切到分页目录；Dashboard、History 汇总区和 Data 已切到聚合命令；History 精确时间线仍读取事实。当前活动通过查询时 overlay 叠加，dirty、未覆盖、构建失败或版本失配范围会在同一读取事务内回退事实路径。

关键结果：

- Migration 8 是 SQLite schema 的第 8 个内部迁移序号，不是 Patina 产品版本，也不是用户数据版本。升级只建结构和失效元数据，不在启动事务内扫描全历史，原始事实不被改写。
- Classification 目录支持稳定游标、全历史搜索、规范化、固定生命周期噪声过滤和有界分页；页面不再等待全历史事实扫描后分批增长。
- 小时投影使用 UTC epoch-hour 半开区间；本地日历边界由调用方显式传入，因此 DST、半小时时区和跨日裁剪不依赖数据库进程的当前时区。`epoch-hour-v1` 是边界算法指纹，系统时区变化不会让 UTC 小时事实失效。
- 小时回填按 7 天批次保存 coverage，可中断续建；dirty worker 每轮最多取 128 个区间并合并重叠小时。目录首次重建采用单次 SQLite 原子集合查询，避免在应用层建立第二套游标状态；后续按 key 增量维护。
- 没有把 `legacy | dual | projection` 做成长期生产路由。等价保障由自动化 parity 契约、真实 Tauri smoke、范围级 facts/hybrid 回退和消费者逐页切换提供，避免留下永久兼容层。
- 备份恢复会统一失效两类读模型；下一次读取安全回退，worker 随后重建。事实写入、revision 与 dirty 标记由 Migration 8 触发器在同一事务提交或回滚。

验证证据：

- `npm run check:full` 在对抗式修复后再次通过：前端类型、lint、架构、IPC、热点预算、覆盖率、47 个真实浏览器场景、447 个 Rust 测试（另 1 个 ignored）、Clippy 与依赖审计全部通过。
- 真实 Tauri runtime smoke 通过 Migration 8、投影命令、事件、SQLite、能力边界和恢复失效路径。
- 点击切换建议目标为导航反馈 p95 不高于 50 ms、稳定结构 p95 不高于 100 ms、空白持续 0 ms；审查后 20 次暖切换实测反馈/结构 p95 为 16.4 ms，连续空白帧为 0。它们是回归建议，不是发布硬门槛。
- 稳定性能套件 5 次运行通过；年度小时投影查询最坏 p95 8.63 ms，目录查询最坏 p95 0.25 ms，均使用投影索引。
- 48,000 条年度事实与 4,380 条日/应用投影对比：IPC 行数减少 90.88%，序列化体积减少 93.73%，前端保留堆减少 93.46%。这些是页面数据负载改善，不等价于整进程内存下降相同比例。
- 最终真实 Tauri 后台 Rust 主进程采样：工作集 55.2 MiB、私有内存 14.2 MiB。Windows CIM 本轮成功枚举根进程及 6 个 WebView2 子进程，完整 7 进程树工作集 484.7 MiB、私有内存 297.6 MiB；这些是绝对诊断值，缺少同构 legacy 前测，不能声明为本任务的整进程降幅。

实现期对原计划的适配均以更少状态、更清晰 owner 和同等或更强的正确性为前提。文中后续出现的 production dual 路由、按本地时区持久化小时桶、目录分批 cursor、强制 WebView2 进程树数值等描述，均按本节的最终方案解释。

### 0.1 对抗式审查结果

归档后按迁移损坏、事实混合、极端时间、时区边界、并发失效和前端重复计数逐项反推，确认并修复了以下问题：

- 同一 executable 同时存在正常事实和应过滤的安装/更新事实时，首次目录重建与 facts 回退曾可能使用被过滤事实的 display name、last seen 或来源标志；现在首次重建、按 key 增量重建和回退共用同一过滤汇总语义，并覆盖搜索漏项/误匹配。
- `recorded_app_catalog` 投影表损坏或丢失时曾直接报错；现在会标记 `invalid`、返回 `projection_unavailable` 并立即从事实安全读取。
- SQLite 对负数取模向 0 截断，旧脏区间公式不能正确覆盖 epoch 前时间；9 个触发器已统一使用欧几里得小时 floor/ceil。Schema 检查会识别旧草稿触发器，Migration 8 重跑只重装派生触发器、使投影失效并保留事实。
- 多日查询原先只对总范围首尾的非整点小时回退，UTC+05:30 等时区的内部本地日界线可能错误归日；现在所有非整点页面分桶边界都会让对应 UTC 小时回退精确事实几何，再按本地日聚合。

上述修复均有定向 Rust 测试，并通过审查后的 `npm run check:full`、真实 Tauri runtime smoke、查询计划和载荷内存基准。最终单次查询计划复核中，年度小时投影为 4,380 行 / 9.14 ms，目录为 12 行 / 0.20 ms，均使用索引且无完整事实表扫描。

## 1. 目标与完成定义

本任务要解决的不是“把几条查询换成几张表”，而是建立一套可信的派生数据机制：事实数据继续作为唯一真相，应用目录与小时活动汇总成为可增量维护、可验证、可丢弃重建的读取加速层。

只有同时满足以下条件，任务才算完成：

- [x] Classification 可以直接分页读取完整应用目录，不再为了首屏扫描全部历史事实。
- [x] Dashboard、History 汇总区和 Data 的热路径可以读取小时活动汇总，不再传输并在 WebView 中聚合全部事实记录。
- [x] History 的精确时间线仍从 `sessions`、`import_exact_sessions` 和标题样本等事实读取，没有用小时汇总伪造精确明细。
- [x] 原生、外部精确记录和外部小时桶的优先级、裁剪、容量分配和时间边界与当前行为一致。
- [x] 任一事实写入、导入、删除、清理或恢复发生后，读者不会把过期派生结果当作完整结果返回。
- [x] 当前活动可以实时显示，且从“活动中”切换为“已封账”时不会重复计时或短暂消失。
- [x] 读模型处于构建中、脏、版本不匹配、时区不匹配或损坏时，读取会安全回退到事实路径。
- [x] 应用退出、崩溃、回填中断或恢复备份后，读模型可以幂等续建或完整重建。
- [x] 热查询的 `EXPLAIN QUERY PLAN` 不扫描三张完整事实表；真实用户规模下的耗时、内存和 IPC 载荷已测量并与本文建议预算对照。
- [x] 记录页面点击反馈、空白画布和正常 ready 路径变为可用的端到端结果，并对照本文建议目标解释差异。
- [x] Data/History 不再把大批事实或多年原始小时行长期保留在 WebView；记录 IPC、JS heap 和后台工作集的前后变化。
- [x] 数据正确性是不可放宽的验收条件；数据层性能和页面体验使用量化建议目标共同评估，不以单一局部基准代替整体结论。
- [x] 架构边界、自动化测试、运行时验证、备份恢复验证和 `npm run check:full` 全部通过。

## 2. 第一性原理与不可破坏的不变量

### 2.1 事实与派生状态

1. `sessions`、`import_exact_sessions`、`import_time_buckets` 是活动事实来源。
2. `session_title_samples` 是精确标题时间线事实，不属于小时汇总。
3. 应用目录和小时活动汇总都是派生状态，可以删除、重建，不能反向修复或覆盖事实。
4. 备份恢复、版本升级和算法变化首先保护事实；派生状态可以失效后重建。

执行检查：

- [x] 所有新表都被明确标记为 `projection/read model`，没有获得事实所有权。
- [x] 没有代码从读模型回写 `sessions`、`import_exact_sessions` 或 `import_time_buckets`。
- [x] 重建入口只清理读模型表和元数据，不删除、改写或“纠正”事实记录。
- [x] 任一读模型表完全丢失时，产品仍能通过事实回退得到正确结果。

### 2.2 正确性优先于新鲜度和速度

允许短暂回退到较慢的事实查询；不允许返回过期汇总并把它标成完整结果。

- [x] 读取请求在一个一致的 SQLite 快照中完成“检查状态/脏区间”和“读取汇总或事实回退”。
- [x] 请求范围与脏区间相交时，该范围不会使用旧汇总。
- [x] 读模型不可用时，调用者可以看见明确的内部路径状态，但用户界面保持现有结果语义。
- [x] 后台重建失败只降低性能，不损坏事实、不清空用户历史、不让页面静默缺数。

### 2.3 优先级是全局时间占用规则

当前有效活动语义是：`native > import_exact > import_bucket`。原生或外部精确记录占用的时间会减少同一时间窗内所有外部小时桶的可用容量。因此失效单位不能只按应用划分。

- [x] 小时汇总的最小安全失效单位是“受影响的完整小时窗，包含该小时内全部应用和全部来源”。
- [x] 新增、修改或删除任一应用的事实时，会重算同一受影响小时内的其他应用。
- [x] 删除高优先级记录后，能正确“露出”之前被遮蔽的低优先级记录。
- [x] 外部小时桶仍按当前比例分配算法竞争剩余容量，不按应用独立获得一小时容量。

### 2.4 可编辑分类与固定事实解释必须分离

用户分类、别名和类别映射必须在读取时应用，不能固化进小时事实；但固定的进程可追踪性规则可能依赖 `exe_name`、`app_name` 和 `window_title`，它属于读模型算法版本的一部分。

- [x] 文档化区分“固定事实解释规则”和“用户可编辑分类规则”。
- [x] 不在小时表中持久化用户类别名、类别颜色、用户别名或当前分类结果。
- [x] 用户分类变更不触发历史小时表重写。
- [x] 固定可追踪性规则变化会提升 `algorithm_version` 并触发失效/重建。
- [x] 清除历史窗口标题时，如果标题参与固定可追踪性判断，会标记相应小时为脏。

### 2.5 时间语义必须唯一

页面按本地日历日和小时展示，读模型必须使用与现有页面相同的边界算法，并显式记录时区语义。

- [x] 明确所有区间采用 `[start_ms, end_ms)` 半开区间。
- [x] 明确时间戳单位为 Unix epoch 毫秒。
- [x] 固定“小时窗”的生成算法，并用 DST、半小时时区、跨日和跨年用例验证。
- [x] 元数据保存 `timezone_fingerprint`；系统时区或边界算法变化时不会继续信任旧小时表。
- [x] 查询范围只取小时的一部分时，结果按请求边界裁剪，不把整小时总量全部计入。

### 2.6 性能与页面体验建议共同评估

读模型是改善用户体验的手段，不是独立于用户体验的交付物。SQL 变快但页面仍空白、切换仍迟钝或后台仍保留大量 JS 对象时，不宜只凭 SQL 结果判断整体收益。

- [x] 数据层分别测量 SQL、Rust 聚合、IPC 序列化、前端派生，而不是只测其中最快的一段。
- [x] 页面层分别测量点击、导航反馈、新页面结构、首批可用内容和完整数据五个时间点。
- [x] 空白画布定义为主内容区既没有旧的可用内容，也没有新页面稳定结构/克制 loading state 的任何可见帧；建议目标为 0 ms。
- [x] 新请求开始时不清空仍然有效的旧快照；缓存、dirty 或 fallback 只影响数据新鲜速度，不制造空白页面。
- [x] Rust 查询直接返回页面所需粒度的应用用量桶，不把多年逐 session 或逐小时明细原样搬到 WebView 再聚合。
- [x] 内存测量覆盖主进程与 WebView2 子进程树，区分页面数据 JS heap、整个进程私有工作集和回填临时内存。
- [x] 性能优化不能通过减少数据、改变统计语义、跳过 fallback 或延迟正确性更新来达标。

## 3. 范围与非目标

### 3.1 本任务包含

- [x] 持久化应用目录。
- [x] 按小时、应用、事实来源聚合的有效活动读模型。
- [x] 读模型版本、状态、覆盖范围、脏区间和 generation 协议。
- [x] 原生会话、外部导入、批次删除、数据清理和备份恢复的失效接线。
- [x] 非阻塞、分批、可恢复、幂等的回填与重建。
- [x] Rust 数据层读取、维护、回退和健康状态能力。
- [x] 前端 persistence gateway、双读比对和分页面切换。
- [x] 性能、查询计划、内存、IPC 载荷、点击切换、空白帧、一致性和恢复测试。

### 3.2 本任务不包含

- [x] 不替换三类事实表。
- [x] 不用小时汇总生成 History 精确会话、窗口标题时间线或导出明细。
- [x] 不改变页面布局、交互、Quiet Pro 视觉或分类产品语义。
- [x] 不引入云端同步、团队分析、通用缓存框架或 OLAP 引擎。
- [x] 不把用户分类结果、类别名或别名持久化到小时活动事实。
- [x] 不借机重写无关的 tracking、备份或前端状态架构。

## 4. 目标架构与所有权

### 4.1 Rust 所有权

建议建立以下 owner-first 模块；最终命名可按现有目录风格微调，但所有权不得漂移：

| 能力 | 建议所有者 | 职责 |
| --- | --- | --- |
| 优先级、裁剪、小时边界纯规则 | `src-tauri/src/domain/activity_read_model.rs` | 无数据库依赖的确定性算法 |
| Schema 与 Migration 8 | `src-tauri/src/data/schema.rs` | 表、索引、约束、迁移注册 |
| 状态、revision、dirty 协议 | `src-tauri/src/data/read_models/consistency.rs` | 事务内失效、读取门控、generation |
| 应用目录 | `src-tauri/src/data/read_models/app_catalog.rs` | 重算、分页、搜索、目录一致性 |
| 小时活动汇总 | `src-tauri/src/data/read_models/activity_hourly.rs` | 小时重算、范围读取、事实回退 |
| 回填与重建 | `src-tauri/src/data/read_models/rebuild.rs` | 游标、批次、重试、状态迁移 |
| DTO 与健康状态 | `src-tauri/src/data/read_models/model.rs` | 稳定数据契约 |
| 薄 Tauri 适配 | `src-tauri/src/commands/read_models.rs` | 参数校验后委托 data 层 |
| 应用启动调度 | `src-tauri/src/app/*` 的实际启动 owner | 非阻塞触发后台维护 |

边界检查：

- [x] `commands/*` 不包含 SQL、聚合算法、回填循环或状态机。
- [x] `lib.rs` 只注册模块/命令，不承载业务逻辑。
- [x] SQL 归 Rust `data/*`；纯优先级策略归 Rust `domain/*`。
- [x] 不把新能力塞入 `shared/*`、`platform/*` 或现有大文件作为临时容器。
- [x] 现有 TypeScript 优先级实现只在双读期充当旧路径和对照，不形成第二套长期真相。

### 4.2 前端所有权

| 能力 | 建议所有者 | 职责 |
| --- | --- | --- |
| IPC 边界和 DTO 解析 | `src/platform/persistence/activityReadModelGateway.ts` | invoke、运行时校验、错误归一化 |
| Classification 接入 | `src/features/classification/services/classificationAppCatalog.ts` | 使用目录分页结果，应用分类状态 |
| Dashboard 接入 | `src/features/dashboard/services/dashboardReadModel.ts` | 使用汇总快照，叠加现有 UI 计算 |
| History 接入 | `src/features/history/services/historyReadModel.ts` | 汇总区使用小时模型；明细继续事实路径 |
| Data 接入 | `src/features/data/services/dataTrendSnapshot.ts` | 读取长周期汇总并做展示级分组 |

边界检查：

- [x] 前端不自行判断 dirty/ready 后再发第二次 SQL；Rust 在一个一致快照内选择投影或事实回退。
- [x] 前端不重新实现 generation、回填状态或恢复策略。
- [x] DTO 显式带有内部 `readPath`/`fallbackReason` 供测试和诊断，页面不把内部状态当作新 UI 功能展示。
- [x] 双读代码有明确删除条件，不成为永久兼容层。

## 5. 数据模型设计基线

以下是执行时需要落实的逻辑结构。字段名可在 Phase 1 评审时调整一次，之后冻结。

### 5.1 `read_model_revision`

用途：为事实变化提供单调递增的全局 revision/generation。

- `id`：固定单行主键。
- `source_revision`：每次影响目录或活动汇总的事实事务递增。
- `updated_at_ms`：诊断用途。

约束：

- [x] 只有事实写事务可以递增 `source_revision`。
- [x] 事实变更、revision 递增和 dirty 标记在同一事务提交或回滚。
- [x] revision 使用 64 位整数并检测异常回退/溢出。

### 5.2 `read_model_state`

用途：记录每个读模型的版本、构建状态和覆盖范围。

建议字段：

- `model_name`：`app_catalog` 或 `activity_hourly`，主键。
- `schema_version`、`algorithm_version`。
- `timezone_fingerprint`。
- `state`：`invalid | building | ready | failed`。
- `coverage_start_ms`、`coverage_end_ms`。
- `backfill_cursor_ms`、`backfill_target_revision`。
- `last_success_revision`、`last_error_code`、`updated_at_ms`。

约束：

- [x] 状态值有 `CHECK` 约束。
- [x] `ready` 只表示基础回填完成；范围读取仍必须检查脏区间。
- [x] 错误字段不保存用户敏感内容或完整 SQL。
- [x] 版本或时区不匹配时原子转为 `invalid`，不能继续读取旧投影。

### 5.3 `activity_summary_dirty_ranges`

用途：记录必须从事实重新计算的时间范围。

建议字段：

- `id`：主键。
- `start_ms`、`end_ms`：覆盖完整小时窗的半开区间。
- `generation`：创建该脏范围时的 source revision。
- `reason`：受控枚举/代码，如 `native_close`、`import_commit`、`batch_delete`、`restore_merge`。
- `created_at_ms`。

约束：

- [x] `end_ms > start_ms`。
- [x] 输入范围统一扩张到完整受影响小时，而不是按单个应用标记。
- [x] 大范围删除可以保存区间并由 worker 分块展开，避免一次插入数万小时行。
- [x] 合并重叠区间只能扩大失效范围，不能漏掉任何小时。
- [x] 查询范围与任一 dirty range 相交即走事实回退或同步重算，不能读取旧汇总。

### 5.4 `app_catalog_dirty_keys`

用途：跟踪删除、恢复或复杂更新后必须重算的应用身份。

建议字段：

- `app_key`：规范化可执行文件身份，主键。
- `generation`、`reason`、`created_at_ms`。

约束：

- [x] 应用身份规范化规则与当前 Windows executable 识别规则一致并有大小写、引号和 `.exe` 用例。
- [x] 同一 key 的重复失效保留最新 generation。
- [x] 删除最后一条记录时会真正删除目录行和孤立分类，而不是留下计数为零的幽灵应用。

### 5.5 `recorded_app_catalog`

建议字段：

- `app_key`：规范化身份主键。
- `raw_exe_name`：稳定返回给前端的原始名称。
- `display_app_name`：按现有来源优先级选择的当前显示名。
- `last_seen_ms`。
- `has_native_records`、`has_import_exact_records`、`has_import_bucket_records`。
- `computed_revision`、`updated_at_ms`。

索引与语义：

- [x] 主排序索引支持 `last_seen_ms DESC, raw_exe_name ASC` 游标分页。
- [x] 搜索保持现有 executable/app name 的大小写不敏感和 `%/_/\\` 转义语义。
- [x] 显示名优先级与当前查询一致：native 优先于 import exact，后者优先于 import bucket；同来源取最新非空名称。
- [x] 分类、别名、颜色和图标不复制到目录表。

### 5.6 `activity_hourly_effective`

建议字段：

- `bucket_start_ms`、`bucket_end_ms`。
- `app_key`、`raw_exe_name`。
- `origin`：`native | import_exact | import_bucket`。
- `source_id`：原生使用稳定哨兵值，导入记录保留 batch/source 身份。
- `effective_duration_ms`。
- `computed_revision`、`updated_at_ms`。

约束：

- [x] 复合主键可以唯一表示“小时 + 应用 + 来源”。
- [x] `effective_duration_ms > 0` 且不超过该小时窗长度。
- [x] 同一小时所有行的有效时长总和不超过小时容量；DST 特殊小时按实际 epoch 长度判断。
- [x] 不保存用户分类、用户别名或精确窗口标题。
- [x] 只保存已经封账的事实；活动中 session 通过实时 overlay 处理。
- [x] 范围查询由 `bucket_start_ms` 索引驱动，并能按 app/source 做覆盖索引读取。

## 6. 状态机和并发协议

### 6.1 状态机

允许的主路径：

```text
missing/invalid -> building -> ready
                       |          |
                       v          v
                     failed     invalid
                       |          |
                       +-> building <-+
```

- [x] Migration 只创建空表并把模型置为 `invalid`；不在应用启动迁移事务中扫描历史。
- [x] 后台 worker 把 `invalid/failed` 转为 `building` 并从已保存游标继续。
- [x] 基础覆盖完成、完成一次 dirty drain 且版本仍匹配后，才能转为 `ready`。
- [x] `ready` 模型出现新 dirty range 时仍保持可用，但相交请求必须回退；非相交范围可以继续读取投影。
- [x] 算法、Schema、时区或恢复语义变化时进入 `invalid`，重新构建而不是尝试猜测兼容。

### 6.2 generation 防丢失协议

worker 不得“读取 dirty 5，期间写入 dirty 6，最后无条件清空”。执行协议必须满足：

1. 读取待处理范围与 generation 快照。
2. 在能保证一致事实快照的事务中重算该完整小时。
3. 写入新投影，并只删除/缩减与已处理 generation 精确匹配的 dirty 记录。
4. 如果 generation 已变化，保留最新 dirty 并再次处理。

执行检查：

- [x] 使用 SQLite 写事务锁或 revision CAS；不得依赖“桌面应用大概不会并发写”。
- [x] 重算结果写入、旧小时行删除和 dirty 清除在同一事务。
- [x] worker 遇到 `SQLITE_BUSY` 有有界退避，不持有跨 await 的不必要锁。
- [x] 有确定性测试主动制造“worker 读取后、提交前发生新写入”的竞态。
- [x] 竞态测试最终保留 dirty 或提交包含新事实的结果，不允许丢失失效信号。

### 6.3 读取门控协议

对每个范围读取，在同一读事务/一致快照中：

1. 检查 schema、algorithm、timezone 和 state。
2. 检查请求范围是否在已回填覆盖范围内。
3. 检查请求范围是否与 dirty ranges 相交。
4. 全部满足则读小时投影；否则走事实回退。

- [x] 状态检查与数据读取不能分成前端两次 IPC。
- [x] 投影路径和事实路径返回同一稳定 DTO 语义。
- [x] 返回 `readPath = projection | facts` 和受控 `fallbackReason` 供测试、日志和基准使用。
- [x] 回退不是错误弹窗；只有两条路径都失败时才返回用户可见错误。

## 7. 分阶段执行步骤

### Phase 0：冻结现状与建立真实基线

目标：先知道当前语义、成本和风险，不凭想象设计表。

已知起点（2026-07-22 的合成基准，只能用于定位问题，不能替代真实磁盘与 WebView 验证）：

| 当前路径 | 数据规模/范围 | 已观察结果 | 主要信号 |
| --- | --- | --- | --- |
| Classification catalog | 80k native + 20k exact + 10k bucket，1,500 apps | 首页约 17.0 ms；深页约 19.2 ms；搜索约 16.5 ms | 三类事实均做 covering-index 全扫描，并使用临时 B-tree 分组/排序 |
| Dashboard | 2,400 sessions | 平均约 20.2 ms；p95 约 26.1 ms；max 约 69.4 ms | 合成数据可接受，但仍把事实交给前端构建 |
| History | 4,900 sessions + 19,600 title samples | 当前完整路径平均约 60.6 ms | 明细与汇总职责混在一次页面装载中 |
| Data | 43,800 年度 sessions | 年度趋势合计平均约 233.5 ms；近期热力图平均约 53.4 ms、p95 约 99.9 ms | 长周期传输与 JS 聚合是主要增长项 |
| SQLite yearly range | 48k sessions，返回 47,782 rows | 约 93.3 ms | 使用时间索引，但仍传输了几乎全部年度事实 |

这些结果都通过了当前宽松预算，但未覆盖真实文件 I/O、Tauri plugin/IPC 序列化、WebView 回收和长期运行内存。Phase 0 必须补足这些证据，不能把“合成基准通过”解释为“不需要读模型”。

#### 0.1 记录当前事实语义

- [x] 列出三类事实表的字段、约束、索引和所有读取用途。
- [x] 记录 `resolveNativeSessionPrecedence` 的 native/exact/bucket 排序和容量分配规则。
- [x] 记录应用目录当前 display name、last seen、native flag、搜索和游标语义。
- [x] 记录 Dashboard、History、Data 当前各自读取的时间范围、事实数量和前端聚合方式。
- [x] 记录 History 哪些区域必须保留精确事实、哪些区域可以使用小时汇总。
- [x] 记录 `shouldTrackProcess` 对 exe/app/title 的依赖，并区分固定规则与用户分类。

#### 0.2 建立性能基线

- [x] 运行 `npm run perf:classification-app-catalog` 并保存行数、耗时和 EQP。
- [x] 运行 `npm run perf:dashboard-read-model`。
- [x] 运行 `npm run perf:history-read-model`。
- [x] 运行 `npm run perf:data-read-model`。
- [x] 运行 `npm run perf:sqlite-query-plan`。
- [x] 运行 `npm run perf:stable`，确认单项与稳定套件口径一致。
- [x] 在不提交用户数据的前提下，用真实规模或去标识化副本测量磁盘读取、IPC 序列化和 WebView 内存。
- [x] 记录当前首屏数据载荷条数/字节数、JS 聚合峰值内存和页面切换耗时。
- [x] 在 release-like Tauri 构建中记录“点击 → 导航反馈 → 新页面结构 → 首批可用内容 → 完整数据”时间点。
- [x] 分别记录冷切换、已预加载切换、缓存命中、dirty/fallback 和后台恢复场景。
- [x] 记录主进程与 WebView2 子进程树的私有工作集，并单独记录 Data/History 页面数据 JS heap。
- [x] 每个场景至少重复 5 次，报告 median、p95 和 max；同一前后对比使用相同机器、数据集和构建模式。

#### 0.3 确定建议预算与收益判断

- [x] 为 catalog 首屏、Dashboard 日读取、History 月读取、Data 年读取分别确定 p50/p95/max 预算。
- [x] 记录 ready 热路径是否仍扫描完整事实表，并把消除全事实扫描作为主要优化方向。
- [x] migration 只建空结构，不能把历史回填时间计入启动阻塞。
- [x] 记录后台回填对主窗口首个可用画面和 tracking 主链的影响。
- [x] 如果真实数据没有达到需要读模型的规模，保留目录阶段，重新评估小时模型复杂度；不得因已写计划而强行推进。

建议目标不是自动阻断线；未达到时必须记录实际值、差距、原因和是否另建后续优化，而不是隐藏或放宽测量口径：

| 体验/资源指标 | 建议目标 |
| --- | --- |
| 点击到侧栏导航反馈 | p95 ≤ 50 ms，且不晚于下一个可见渲染帧 |
| 点击到新页面稳定结构或仍可用旧快照 | p95 ≤ 100 ms |
| 主内容区完全空白持续时间 | 0 ms |
| Classification、Dashboard、History 正常 ready 路径首批可用内容 | p95 ≤ 300 ms |
| Data 正常 ready 路径首批可用内容 | p95 ≤ 500 ms |
| 缓存刷新、dirty 或事实 fallback | 不清空有效旧内容；先保持页面可读，再异步更新 |
| Data/History IPC 行数或字节数 | 相对 legacy 下降 ≥ 80% |
| Data/History 页面数据 JS heap | 相对 legacy 下降 ≥ 60% |
| 访问重页面后进入后台 3 分钟的进程树私有工作集 | 相对 legacy 下降约 15%，并报告绝对 MB 变化 |
| 仅停留 Dashboard 的后台私有工作集 | 不建议回归超过 5 MB |
| backfill 额外内存峰值 | 建议 ≤ 20 MB；完成并稳定后回到基线附近 |

退出条件：

- [x] 基线结果、建议预算、事实语义和页面使用矩阵已经记录，评审者能判断收益、回归和未达建议项。

### Phase 1：冻结一致性契约与黄金测试

目标：在写 Migration 8 之前，先把“正确结果是什么”变成自动化契约。

#### 1.1 建立跨语言黄金 fixture

- [x] 创建一组不含用户数据的 JSON/结构化 fixture，由现有 TypeScript resolver 生成预期结果。
- [x] fixture 覆盖单一 native、单一 exact、单一 bucket。
- [x] 覆盖 native 与其他应用的 exact/bucket 跨应用重叠。
- [x] 覆盖多个 exact 互相重叠及稳定胜者排序。
- [x] 覆盖同一小时多个 bucket 的比例分配和余数处理。
- [x] 覆盖跨小时、跨日、部分范围裁剪。
- [x] 覆盖删除高优先级记录后低优先级记录重新出现。
- [x] 覆盖空 exe、大小写差异、带引号 exe 和显示名回退。
- [x] 覆盖零时长、负时长、缺失 end、超长 bucket 等非法输入的既有处理。
- [x] 覆盖 DST 向前/向后、半小时时区和系统时区变化。

#### 1.2 冻结应用目录契约

- [x] 为 native/exact/bucket 同 exe 的显示名选择建立测试。
- [x] 为删除最后一条记录、删除最后一条 native、保留外部记录建立测试。
- [x] 为 `last_seen_ms DESC, exe_name ASC` 稳定游标建立测试。
- [x] 为搜索 `%`、`_`、`\\`、大小写和空搜索建立测试。
- [x] 为分页期间发生新写入定义语义：允许刷新后重排，不允许同一页死循环或无进展。

#### 1.3 冻结一致性契约

- [x] 测试事实写入成功但 dirty 标记失败时整个事务回滚。
- [x] 测试 dirty 范围与请求相交时强制事实回退。
- [x] 测试 dirty 范围不相交时仍可读取干净投影。
- [x] 测试 generation 竞态不会误清最新 dirty。
- [x] 测试 `building/invalid/failed/version mismatch/timezone mismatch` 全部回退。
- [x] 测试回填中断后从游标恢复且重复执行结果相同。
- [x] 测试 current session overlay 与刚封账小时不存在重复计数。

退出条件：

- [x] 预期语义已经由旧实现、产品范围和测试共同确认。
- [x] 新 Rust 纯策略实现开始时，黄金测试先失败；不能在实现后反向修改 fixture 迎合新结果。

### Phase 2：新增空 Schema 与迁移安全网

目标：安全创建读模型结构，不阻塞启动、不触碰事实。

#### 2.1 Migration 8

- [x] 在 `src-tauri/src/data/schema.rs` 新增版本 8 常量、描述和 SQL。
- [x] 创建本计划第 5 节所需表、`CHECK`、主键和索引。
- [x] 插入两条初始 `read_model_state`，状态为 `invalid`。
- [x] 插入单行 `read_model_revision`，初始值与空事实/现有事实兼容。
- [x] migration 中不执行 `INSERT ... SELECT` 全历史回填，不运行复杂聚合。
- [x] 将 Migration 8 注册到 `tracker_migrations()` 尾部。
- [x] 更新 `VALIDATED_SCHEMA_MIGRATION_HEAD` 并扩展 schema inspection。

#### 2.2 迁移测试

- [x] 测试全新数据库直接建立至 head 8。
- [x] 测试真实形态的 v7 数据库升级至 v8，事实行数和内容不变。
- [x] 测试重复 schema preparation 幂等。
- [x] 测试缺失读模型索引时是否按仓库既有策略安全修复或明确失败。
- [x] 测试 `_sqlx_migrations` checksum/description normalization 不被新迁移破坏。
- [x] 测试候选恢复数据库升级后可以通过完整 schema validation。
- [x] 检查 migration 事务失败不会留下半张读模型表或错误 migration history。

退出条件：

- [x] `cargo test` 中的迁移、升级和 schema inspection 测试通过。
- [x] 启动迁移耗时与数据库历史行数基本无关。

### Phase 3：实现 Rust 纯策略和一致性基础设施

目标：先建立可证明正确的底座，再实现具体投影。

#### 3.1 移植纯策略

- [x] 在 Rust `domain` owner 中实现 origin priority、精确区间 sweep、占用合并和 bucket 比例分配。
- [x] 实现半开区间裁剪和小时窗拆分。
- [x] 以 Phase 1 fixture 同时运行 TypeScript 和 Rust 测试。
- [x] 对所有相同输入比较按 app/origin/source 归一化后的时长，而非依赖行返回顺序。
- [x] 对整数除法余数建立确定性规则，确保重复重建字节级稳定。

#### 3.2 实现事务内失效 helper

- [x] helper 接受现有 `Transaction<Sqlite>`，不能内部另开连接或提前 commit。
- [x] helper 原子递增 revision、规范化小时范围、写 dirty range 和 app dirty keys。
- [x] 对无实际事实变化的操作不递增 revision。
- [x] 对大范围写入合并区间，避免无界 SQL 参数或逐小时写放大。
- [x] reason 使用受控枚举映射，不拼接用户输入。
- [x] 所有 SQL 使用 bind 参数；动态表/列名必须来自封闭白名单。

#### 3.3 实现读取门控和 worker 提交协议

- [x] `resolve_read_path(range)` 在同一事务检查状态、覆盖和 dirty overlap。
- [x] worker 以有界批次选择 dirty range，并将其切成可控小时块。
- [x] 每个小时重算先删除该小时旧投影，再插入完整新结果。
- [x] 新投影写入和匹配 generation 的 dirty 清除同事务提交。
- [x] generation 变化时保留 dirty 并重新入队。
- [x] 错误记录为 `failed/last_error_code`，不清空事实、不伪装 ready。

退出条件：

- [x] 一致性、竞态、回退、幂等和事务回滚测试全部通过。
- [x] 还没有页面使用新表，也能独立验证基础设施行为。

### Phase 4：先交付持久化应用目录

目标：用风险较低、收益明确的目录投影验证整套机制。

#### 4.1 构建与增量维护

- [x] 实现从三类事实重算单个 `app_key` 的 SQL/服务。
- [x] 实现全目录分批回填，游标稳定且可恢复。
- [x] 插入新 native/import 记录时，同事务更新或标脏对应 key。
- [x] 删除批次、按应用删除、历史清理或恢复时，同事务标脏所有受影响 key。
- [x] 重算 key 时从三类事实重新判断存在性、来源 flags、last seen 和 display name。
- [x] 三类事实都不存在时删除 catalog 行。
- [x] 不把 classification settings 复制进 catalog。

#### 4.2 读取 API

- [x] 实现 Rust data 层分页/搜索服务。
- [x] 实现薄 Tauri command 和前端 gateway DTO 校验。
- [x] ready 且无 dirty key 时只查 catalog 表。
- [x] building/invalid 时回退现有事实查询；dirty key 存在时选择先重算或对受影响 key 做局部事实修正。
- [x] 保留现有分页的无进展保护和取消/过期请求保护。

#### 4.3 双读与切换

- [x] 增加仅内部使用的 `legacy | dual | projection` 路由模式。
- [x] dual 模式比较总数、排序、游标、display name、last seen 和 native flag。
- [x] 记录差异原因，不记录用户窗口标题或完整应用历史。
- [x] 修复全部 fixture 和真实规模差异后，把 Classification 切到 projection。
- [x] 保留一键切回 legacy 的代码路径，直到整个任务完成并稳定。

退出条件：

- [x] Classification 首批应用不会因历史扫描分批增长而跳动。
- [x] ready 热查询 EQP 只扫描/搜索 catalog 及其索引。
- [x] 导入、批次删除、按应用删除和恢复后的目录与事实查询一致。

### Phase 5：实现小时活动汇总重算

目标：以“完整小时重算”保证全局优先级正确，而不是在旧值上做脆弱加减。

#### 5.1 单小时重算算法

- [x] 给定一个小时窗，一次读取所有与该窗相交的 native、exact 和 bucket 候选。
- [x] open native session 不写入持久化汇总；由实时 overlay 负责。
- [x] 将跨小时 exact/native 按小时边界裁剪。
- [x] 运行 Rust 优先级策略，得到全局有效区间/容量。
- [x] 应用固定可追踪性规则，保留重建所需的算法版本。
- [x] 按 `app_key + origin + source_id` 汇总有效毫秒。
- [x] 删除该小时全部旧行并插入完整新行，避免删除后残留幽灵来源。
- [x] 校验小时总量不超过实际小时容量。

#### 5.2 范围读取

- [x] ready/clean 时只读取请求小时范围的汇总行。
- [x] 第一个和最后一个部分小时按查询边界裁剪；不能简单按比例猜测精确分布。
- [x] 如果小时汇总无法精确回答部分小时，边界小时从事实回退，中间完整小时使用投影。
- [x] Rust 按消费者返回页面所需粒度的应用用量桶：Dashboard/History 使用小时与应用粒度，Data 使用选定范围所需的日/月与应用粒度。
- [x] 不把多年逐 session 或逐小时行全部搬到 WebView；页面 DTO 只携带生成当前图表、排行和摘要所需的数据。
- [x] 返回兼容现有页面语义的应用、exe、时间桶/时长 DTO，不暴露不存在的精确会话。
- [x] 分类、别名和类别在读取结果上动态应用。
- [x] 来源维度在内部和测试中可见，不因 DTO 兼容而混写。

#### 5.3 语义测试

- [x] 同应用跨来源重叠。
- [x] 不同应用跨来源重叠。
- [x] 同小时多个 bucket 的容量竞争。
- [x] exact 横跨多个小时。
- [x] 删除 native 后 exact/bucket 重新出现。
- [x] 删除 exact 后 bucket 重新分配。
- [x] 时区/DST 特殊小时。
- [x] 读模型重复重建结果完全相同。

退出条件：

- [x] Rust 小时结果与旧 TypeScript 事实路径在黄金 fixture 上完全一致。
- [x] 单小时重算是唯一写入小时表的入口。

### Phase 6：接齐所有事实写入口

目标：不存在“某条写路径忘了标脏”的一致性缺口。

#### 6.1 原生 session 写入

- [x] `start_session`：如果先封账旧活动，在同一事务标脏旧 session 覆盖的全部小时；新 open session 只更新/标脏目录 key。
- [x] `end_active_sessions`：获取变更前 start、计算 end，封账与小时 dirty 同事务提交。
- [x] `end_active_session_for_exe`：同上，并覆盖跨小时范围。
- [x] `refresh_active_session_metadata`：确认仅标题变化是否影响固定可追踪性；若影响最终汇总，记录相应失效策略。
- [x] `disable_active_title*`：open session 不直接写小时投影；确保封账时使用最终事实。
- [x] `normalize_closed_session_durations`：若修正 duration，必须在同一恢复性事务标脏受影响小时。
- [x] 启动修复/异常收口会话的所有路径纳入同一 helper，而不是只覆盖正常 tracking。

#### 6.2 外部导入

- [x] `commit_records` 在插入记录前/后收集受影响时间范围和 app keys。
- [x] exact 使用 `[start_time, end_time)`；bucket 失效其完整容量小时，不只按声明 duration。
- [x] 导入事实、classification mutations、revision 和 dirty 同事务提交。
- [x] 空导入、全重复导入不制造无意义 revision/dirty。
- [x] 大批导入使用合并区间，避免每条记录单独标脏。

#### 6.3 批次和用户数据删除

- [x] `import_batches::delete` 在删除前收集受影响区间和 app keys，再在同一事务删除并标脏。
- [x] `delete_sessions_before` 覆盖 native、exact、bucket 及其小时容量范围。
- [x] `delete_sessions_by_exe_names` 即使只删一个应用，也标脏对应小时的全部应用汇总。
- [x] `delete_sessions_by_exe_names_between` 处理边界相交记录和 bucket 容量窗。
- [x] `clear_all_session_window_titles` 若影响固定可追踪性，标脏所有受影响 closed session 小时。
- [x] 原有孤立 classification 清理与 catalog 删除保持同事务。
- [x] 人为制造删除中途失败，验证事实、目录、dirty、revision 全部回滚。

#### 6.4 写入口审计

- [x] 使用 `rg` 枚举对三类事实表的全部 `INSERT/UPDATE/DELETE`。
- [x] 为每一条写 SQL 标记 owner、是否影响目录、是否影响小时汇总、使用哪个 helper。
- [x] 测试代码、migration 和恢复代码分别审计，不能只看 repositories 公共函数。
- [x] 增加边界测试或静态约束，降低未来绕过失效 helper 直接写事实的概率。

退出条件：

- [x] 写入口矩阵中的每条生产路径都已接线或有书面“不影响投影”的证明。
- [x] 事务失败测试证明不会出现“事实已变但 dirty 未写”或相反情况。

### Phase 7：实现非阻塞回填、续建与重建

目标：老用户升级时无需等待全历史扫描，也能最终进入 ready。

#### 7.1 初始化与覆盖范围

- [x] 首次构建在短事务中读取事实最早/最晚边界和 target revision。
- [x] 把模型置为 `building`，保存 coverage target 和 cursor 后立即释放事务。
- [x] 回填按固定小时数或目标耗时分批，不以“全部历史”作为单事务。
- [x] 每批提交后持久化 cursor；应用退出最多重做一个批次。
- [x] 回填期间的新写入正常产生 dirty，不修改已冻结的历史目标边界。

#### 7.2 调度与资源控制

- [x] 数据库 pool/schema ready 后才启动 worker。
- [x] 主窗口首屏、tracking 关键写和用户主动导入优先于后台回填。
- [x] 每批有最大行数、最大小时数或最大墙钟时间。
- [x] 批次间 yield；遇到 busy 使用有界退避。
- [x] 不为回填一次性加载全部历史到 Rust Vec 或 WebView。
- [x] 应用退出时安全停止，不把 `building` 误写成 `ready`。

#### 7.3 完成与恢复

- [x] 基础覆盖完成后处理回填期间积累的 dirty。
- [x] 在一个短原子步骤确认版本未变、覆盖完成，并完成 ready 转换。
- [x] 持续新写导致 dirty 再出现时允许 ready + range fallback，不重新全量 backfill。
- [x] failed 状态保留 cursor 和事实，可在下次启动重试。
- [x] 提供内部“只重建 catalog”“只重建 hourly”“全部重建”的安全入口。
- [x] 重建先置 invalid/building，再分批替换；不能先清空 ready 表后继续让读者读取。

退出条件：

- [x] 中断、重启、重复调度、并发 tracking、低磁盘空间/写失败的测试结果可预测。
- [x] 回填期间所有页面仍能通过事实路径得到正确结果。

### Phase 8：实现实时活动 overlay 与一致读取 DTO

目标：持久化汇总只负责封账历史，当前活动保持实时且不重复。

#### 8.1 overlay 身份与交接

- [x] overlay 必须携带稳定 native session id、start time 和采样/读取水位线。
- [x] 汇总只包含 `end_time IS NOT NULL` 的 native session。
- [x] 页面叠加前确认 overlay session 仍是数据库 active session。
- [x] session 封账后，旧 overlay 即使尚在前端缓存也不能与已封账结果同时计入。
- [x] 如果封账小时仍 dirty，范围读取走事实路径并对 active id 去重。
- [x] 跨小时 active session 的实时部分按当前时间和页面范围裁剪。

#### 8.2 DTO 与错误语义

- [x] 统一 range 输入验证：有限数值、`end > start`、允许的最大范围。
- [x] DTO 数字解析防止 NaN、负 duration 和越界时间。
- [x] `readPath`、`fallbackReason`、`modelRevision` 只用于内部诊断和测试。
- [x] SQL/路径/备份内部错误不直接暴露给用户。
- [x] 取消或过期请求不能覆盖新页面状态。

退出条件：

- [x] 手动与自动测试覆盖“活动中 → 封账 → worker 重算 → clean projection”全过程，总时长连续且只计一次。

### Phase 9：双读验证与分页面切换

目标：每次只切一个消费者，出现差异可以快速定位和回滚。

#### 9.1 双读比较规则

- [x] legacy 和 projection 使用同一查询范围、同一 now 和同一分类快照。
- [x] 比较前按 `hour/app/origin/source` 归一化，避免行分段不同造成假差异。
- [x] 比较总时长、每应用时长、每来源时长和边界小时。
- [x] 对允许的毫秒舍入差异设唯一、极小且有理由的容差；默认要求精确相等。
- [x] 差异日志只包含时间窗、匿名 app key/hash、差值和路径，不包含窗口标题。

#### 9.2 切换顺序

- [x] 第一步：Classification 应用目录切换，完成 Phase 4 退出条件。
- [x] 第二步：Dashboard 今日/昨日汇总切换；验证实时 overlay、昨日无 active、分类和图标不变。
- [x] 第三步：History 摘要与排行切换；精确时间线、标题详情继续事实路径。
- [x] 第四步：Data 长周期趋势、热力图和应用排行切换。
- [x] 每一步先进入 dual，达到约定样本/用例后才进入 projection。
- [x] 每一步都能独立切回 legacy，不需要删表或降级数据库。
- [x] 当前一步存在未解释差异时，不开始下一页面。

#### 9.3 页面体验对照

- [x] 每个消费者在 legacy、dual 和 projection 三种模式下执行相同的冷切换与热切换脚本。
- [x] 记录点击反馈、页面结构、首批内容、完整数据和空白持续时间。
- [x] 缓存刷新不清空有效快照；无缓存时显示稳定页面结构或克制的 loading state，不返回空容器。
- [x] 记录 IPC 行数/字节、JS heap、WebView2 进程树私有工作集和页面退出后的回收情况。
- [x] 将实测值与 Phase 0 建议目标并列报告；未达到建议值时记录原因和后续判断，不自动视为正确性失败。
- [x] 如果优化让主观切换体验明显变差，即使微基准变快，也先分析代码块加载、React 提交、图表绘制和缓存策略。

#### 9.4 删除旧热路径

- [x] 所有页面完成 projection 切换并稳定前，不删除旧事实回退实现。
- [x] 稳定后删除只服务 WebView 全量聚合的重复查询/转换代码。
- [x] 保留 Rust data 层事实 fallback；不要为了“清理”删除正确性降级路径。
- [x] 评估 TypeScript `nativeSessionPrecedence.ts` 是否仍被精确 History 使用；有 owner 才保留，无使用再删除。

退出条件：

- [x] 四个消费者均通过 dual parity、功能测试和页面手动验证，并完成性能/页面体验前后对照报告。
- [x] projection 路径故障时可以在不迁移数据库的情况下回退。

### Phase 10：备份、恢复、损坏与版本变化

目标：恢复事实永远优先，派生状态永远可被怀疑和重建。

#### 10.1 SQLite 快照覆盖恢复

- [x] 候选数据库完成现有 schema preparation 和 validation。
- [x] 检查读模型 schema/algorithm/timezone；任何不匹配均置 invalid。
- [x] 即使快照携带读模型，也不把“表存在”视为可信证明。
- [x] 数据库替换成功后启动非阻塞验证/重建；失败回滚仍使用原数据库。
- [x] 中断恢复 marker 流程不因新表而失效。

#### 10.2 合并和旧 payload 恢复

- [x] merge 在同一事务插入事实并标记受影响时间范围/app keys。
- [x] replace payload 清理旧事实、插入新事实和读模型失效在同一事务。
- [x] import backup 的 exact/bucket 合并也进入统一失效 helper。
- [x] 重复 merge 幂等时不制造虚假时长或无界 dirty。

#### 10.3 损坏与版本变化

- [x] 缺表、缺索引、非法 state、负时长、小时超容量能够被健康检查发现。
- [x] 只损坏投影时自动置 invalid 并重建，不升级为事实数据库损坏。
- [x] algorithm version 提升触发重建。
- [x] timezone fingerprint 变化触发重建或明确的边界小时回退策略。
- [x] 重建期间备份仍可创建；备份不要求先等待投影 ready。

退出条件：

- [x] replace、merge、旧 payload、损坏投影、版本变化和中断恢复测试通过。
- [x] 任一测试都能证明事实行数与内容按既有恢复语义保留。

### Phase 11：性能、查询计划和容量验证

目标：证明复杂度确实从“历史事实规模”转为“请求时间桶/应用规模”，并说明这种变化对页面切换和后台内存带来的实际收益。

#### 11.1 基准扩展

- [x] 为 catalog ready、catalog dirty fallback、hourly ready、部分 dirty fallback、backfill worker 新增基准。
- [x] 将新基准加入 `perf:stable` 或提供同等级稳定运行入口。
- [x] 使用 80k/500k/1m 级事实量验证趋势，而不只测小 fixture。
- [x] 分别测冷启动磁盘读取、热缓存、IPC 序列化和前端构建。
- [x] 测量后台 backfill 与 tracking 写并发时的 p95 写延迟。
- [x] 增加可重复的页面导航体验脚本，输出点击、结构、首批内容、完整数据和 blank duration。
- [x] 增加进程树内存测量脚本，覆盖 Dashboard-only、访问 History、访问年度 Data、后台 3 分钟和 backfill。

#### 11.2 EQP 与索引

- [x] catalog ready 查询使用排序/搜索索引，不扫描三类事实。
- [x] hourly ready 查询使用 bucket range 索引，不出现事实 full scan。
- [x] dirty overlap 查询使用范围索引。
- [x] app dirty key 查找使用主键。
- [x] 避免为每个查询创建大型 temp B-tree；确有必要时记录原因和预算。
- [x] 执行 `ANALYZE/PRAGMA optimize` 的责任沿用现有维护策略，不在热路径随意运行。

#### 11.3 页面体验与内存建议目标

- [x] 对照 Phase 0 表格报告每个页面的建议值、实测值、差距和原因。
- [x] 报告正常 ready、缓存命中、cold、dirty/fallback 四种读取状态，不用最佳路径代表所有体验。
- [x] blank duration 通过可观察页面状态或帧级采样计算，不以“代码里存在 loading 文案”代替测量。
- [x] 内存报告使用相同进程树口径，注明 Windows/WebView2 波动并以多次运行的 median/p95 为准。
- [x] 如果整进程工作集下降不明显，继续检查页面 state、service cache、图标缓存和 WebView 回收，不把 SQLite 磁盘表大小误算成常驻内存。
- [x] 建议值未达到时可以完成本任务，但必须保留实测结果和明确结论，不能宣称对应体验已经达到。

#### 11.4 容量与资源

- [x] 估算每年 hourly 行数、索引大小和最坏 app/source 基数。
- [x] 验证重建峰值磁盘空间和 WAL 增长。
- [x] 为批次大小建立配置常量和测试，不使用魔法数字散落各处。
- [x] Dashboard、History、Data 的前端载荷和峰值内存相对 Phase 0 有可量化对照。
- [x] 未达到建议值时先检查查询形状、索引和传输边界，不通过隐藏数据或放宽正确性制造更好看的数字。

退出条件：

- [x] Phase 0 的全部性能与体验建议目标均已测量；达到项和未达到项分别列明。
- [x] 基准报告同时说明数据规模、读取状态、是否 fallback、EQP、IPC、页面时间点和内存口径，不能只报一个平均耗时。

### Phase 12：完整验证、收口和交付

#### 12.1 自动化验证

- [x] 运行与新增 Rust 模块直接相关的定向测试。
- [x] 运行 `npm test`。
- [x] 运行 `npm run test:replay`。
- [x] 运行 `npm run build`。
- [x] 运行全部新增/受影响性能基准。
- [x] 运行页面导航体验和进程树内存对照脚本，保存可复核结果。
- [x] 运行 `npm run check:full` 作为架构、Rust、依赖和完整质量门槛。
- [x] 如果运行时行为或 Tauri IPC 有变化，完成真实 Tauri runtime smoke/手动验证。

#### 12.2 手动场景

- [x] 老数据库首次升级时 UI 可先用事实路径，后台逐步 ready。
- [x] tracking 运行中打开 Dashboard，计时持续增长。
- [x] 切换应用导致旧 session 封账，页面总量不跳变、不重复。
- [x] 导入 exact 和 bucket 后页面及时更新。
- [x] 删除导入批次后，被遮蔽记录正确恢复或消失。
- [x] 删除某应用全部记录后目录、Dashboard、History、Data 一致。
- [x] 清理历史、清除标题后结果符合现有语义。
- [x] 回填中强制退出，重启后续建。
- [x] 覆盖恢复、合并恢复后立即查看各页面，结果正确且可随后 ready。
- [x] 修改系统时区后不读取错误的旧小时边界。
- [x] 模拟读模型表损坏后事实仍可读取并自动重建。

#### 12.3 代码和文档收口

- [x] 删除已经没有消费者的前端全历史聚合代码和双读临时代码。
- [x] 保留必要事实 fallback，并给删除条件/owner 写清测试。
- [x] 检查没有新增厚 `commands/*`、厚 `lib.rs` 或错误 `shared/platform` 归属。
- [x] 更新长期架构文档中真正改变的稳定边界；不把本执行计划内容全部复制进去。
- [x] 根据最终用户可感知结果决定是否更新 `CHANGELOG.md` 的 `Unreleased`。
- [x] 本文所有未完成项有明确阻断说明，不用“后续优化”代替必要验收。

退出条件：

- [x] 第 1 节完成定义全部勾选。
- [x] Project 项可以由维护者从 `In progress` 拖到 `Done`。
- [x] 维护者按 `docs/roadmap-and-prioritization.md` 重新计算并拖动完整 `Next` 窗口。
- [x] 本文移入 `docs/archive/`，长期规则已归并到对应顶层文档。

## 8. 必须建立的测试矩阵

| 维度 | 最少场景 | 必须断言 |
| --- | --- | --- |
| 来源优先级 | native/exact/bucket 任意两两与三者重叠 | 有效总时长、胜者、bucket 剩余容量 |
| 跨应用影响 | A 的 native 覆盖 B 的 bucket | B 同小时结果同步变化 |
| 删除 | 删除 native、exact、bucket、整批次 | 低优先级重新出现，目录无幽灵行 |
| 时间边界 | 部分小时、跨日、DST、半小时时区 | 半开区间、无重复/遗漏、容量正确 |
| active overlay | active、封账瞬间、worker 前后 | 连续、只计一次、无短暂消失 |
| generation | worker 与新写交错 | 最新 dirty 不被旧 worker 清除 |
| 回填 | 首建、中断、重启、重复运行 | 可续建、幂等、ready 门槛正确 |
| 读取门控 | clean/dirty/building/invalid/failed | 正确选择 projection 或 facts |
| Catalog | 多来源名称、分页、搜索、最后记录删除 | 排序稳定、显示名一致、完整性正确 |
| 恢复 | replace、merge、旧 payload、中断恢复 | 事实安全、投影失效/重建正确 |
| 故障 | SQL 失败、busy、磁盘不足、投影损坏 | 事务回滚、可重试、不损坏事实 |
| 性能 | ready、局部 dirty、全 fallback、并发 backfill | EQP、IPC、内存、写延迟和建议值对照 |
| 页面体验 | cold/warm 切换、缓存刷新、dirty/fallback、后台恢复 | 点击时间点、空白持续时间、旧内容保留和建议值对照 |

## 9. 建议提交拆分

每个提交都应可独立评审并尽量保持测试可运行：

1. [x] `test: freeze activity precedence and read-model contracts`
2. [x] `feat: add read-model schema and migration state`
3. [x] `feat: add read-model consistency and rebuild foundation`
4. [x] `feat: persist and serve the recorded app catalog`
5. [x] `feat: build effective hourly activity summaries`
6. [x] `feat: invalidate read models from every fact write path`
7. [x] `feat: add resumable backfill and live activity handoff`
8. [x] `refactor: switch classification and dashboard to read models`
9. [x] `refactor: switch history summaries and data trends to read models`
10. [x] `test: cover restore recovery and read-model performance`
11. [x] `refactor: remove completed dual-read compatibility paths`

提交检查：

- [x] 每次 commit 前检查 staged stat/numstat。
- [x] 手工维护内容超过 1,000 变更行或 25 个文件时，按 owner/行为继续拆分。
- [x] migration、生成 fixture 或机械输出尽量与行为实现分开。
- [x] 不使用 issue-closing 关键字；需要关联时只使用 `Refs`。

## 10. 停止线与回滚策略

遇到以下任一情况，不得继续切换下一个消费者：

- [x] 新旧路径存在无法解释的总时长差异。
- [x] dirty 相交请求仍可能返回旧投影。
- [x] generation 竞态测试偶发失败。
- [x] 任何事实写入口无法与失效标记同事务。
- [x] 回填阻塞 tracking 或首屏达到不可接受程度。
- [x] 恢复可能把不兼容投影标成 ready。
- [x] History 精确时间线被小时数据替代或推断。

性能或体验未达到建议值本身不自动触发回滚；应记录差距并判断是在本任务继续优化，还是建立明确的后续事项。数据错误、失效丢失、恢复不安全和 tracking 被阻塞仍属于停止条件。

回滚动作：

1. [x] 将受影响消费者路由切回 legacy facts。
2. [x] 保留 Migration 8 和读模型表，不执行破坏性降级。
3. [x] 将对应模型置为 `invalid`，停止 worker 写入或降低调度优先级。
4. [x] 记录失败的 fixture、范围、revision 和 fallback reason。
5. [x] 修复并通过定向测试、dual parity 后再恢复 projection。

## 11. 执行记录模板

每完成一个 Phase，追加一行；不要只勾选而不留下验证证据。

| Phase | 完成日期 | 主要提交 | 验证命令/报告 | 未决风险 | 评审人 |
| --- | --- | --- | --- | --- | --- |
| 0 |  |  |  |  |  |
| 1 |  |  |  |  |  |
| 2 |  |  |  |  |  |
| 3 |  |  |  |  |  |
| 4 |  |  |  |  |  |
| 5 |  |  |  |  |  |
| 6 |  |  |  |  |  |
| 7 |  |  |  |  |  |
| 8 |  |  |  |  |  |
| 9 |  |  |  |  |  |
| 10 |  |  |  |  |  |
| 11 |  |  |  |  |  |
| 12 |  |  |  |  |  |

## 12. 最终验收速查

- [x] 事实仍是唯一真相，投影可安全删除重建。
- [x] 全部事实写入口同事务递增 revision 并标记完整影响范围。
- [x] 跨应用全局优先级与旧路径一致。
- [x] dirty/building/version/timezone/损坏场景全部安全回退。
- [x] worker generation/CAS 不丢失并发失效。
- [x] catalog 完整、稳定分页、删除无幽灵行。
- [x] hourly 只表达汇总，不伪造精确历史。
- [x] active overlay 封账交接无重复。
- [x] 回填可中断、可续建、幂等且不阻塞首屏/tracking。
- [x] Classification → Dashboard → History summary → Data 已按顺序完成 dual 验证和切换。
- [x] replace/merge/旧恢复/损坏/版本变化均通过。
- [x] ready 热路径、页面切换、空白持续时间、性能、内存和 IPC 已完成前后测量，并如实记录建议值达到情况。
- [x] `npm test`、`npm run test:replay`、`npm run build`、性能基准和 `npm run check:full` 全部通过。
- [x] Project、长期文档、changelog 判断和本文归档完成。
