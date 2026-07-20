# 应用与网页域名“排除统计”统一语义执行方案

> 文档类型：How-to / 可勾选执行单
> 当前状态：已完成并归档
> 目标读者：Patina 维护者、实现者与后续仓库协作者
> 产品 owner：Classification 语义层
> 主要实现 owner：应用统计读模型、History 网页活动读模型与读取缓存生命周期
> 创建日期：2026-07-20
> 文档退出条件：实现、自动化验证、人工验收与 Project 协作完成后，勾选全部完成项并移入 `docs/archive/`

## 1. 文档目的与执行规则

本文把“排除统计”的产品语义从“停止后续记录”补完整为一条统一、可逆、跨页面一致的规则：

> 当应用或网页域名处于排除状态时，Patina 不再记录它，也不在常规统计与回看中显示它的既有历史；恢复统计后，既有历史重新显示，但排除期间不会补记。

这是一项既有功能的语义增强，不是新增第二个开关，也不是删除数据功能。

执行者必须按阶段推进。每完成一项，将对应的 `- [x]` 改为 `- [x]`。如果某项无法完成，应保持未勾选，并在该项下面记录：

- 阻塞条件
- 已获得的证据
- 已尝试的安全替代方案
- 解除阻塞所需的明确输入

本文是一次性执行依据，不替代顶层长期文档，也不自动授权：

- 创建、编辑或重排 GitHub Project item
- 修改 GitHub Issue 状态
- 提交、推送或发布代码
- 删除任何 session、标题样本或网页活动 segment
- 新增独立的“隐藏历史”开关
- 引入排除时间段历史、审计日志或数据库 schema

归档勾选说明：本文中的条件项以“已实际执行”“由现有或新增自动化证据覆盖”或“经边界审查确认不适用”三种方式关闭。第 10 节人工脚本由真实浏览器 fixture、读模型测试和既有采集生命周期测试进行等价验收，未为了验收而写入、排除或删除维护者的真实追踪数据。

## 2. 第一性原理

### 2.1 从用户动作推导语义

用户点击的动作叫“排除统计”，不是“只停止从现在开始记录”。在用户心智中，动作对象是“这个应用或网页域名是否属于我的统计范围”。

因此用户表达的是：

> 我不希望在 Patina 的统计结果中看到这个对象。

如果排除后旧时间仍出现在当日分布、应用排行、历史时间线或趋势中，系统虽然停止了新写入，却没有完成用户对“统计范围”的控制。

由此得到第一条不变量：

> 排除状态必须同时约束数据产生资格与统计可见资格。

### 2.2 记录、统计与删除是三个不同概念

三者不能混为一谈：

| 概念 | 回答的问题 | 排除状态下的行为 |
| --- | --- | --- |
| 记录 | 是否产生新的时间数据 | 不产生新 session / segment |
| 统计 | 已有数据是否参与常规回看与计算 | 不参与、不显示 |
| 删除 | 底层历史是否永久移除 | 不删除 |

因此：

- 只停止写入，不足以兑现“排除统计”。
- 通过删除历史实现隐藏，会破坏可逆性与本地数据控制。
- 新增第二个显示开关，会把一个清晰动作拆成两个互相冲突的状态。

### 2.3 当前状态必须追溯作用于全部历史

现有模型只持久化当前 override：

- 应用：`track: false`
- 网页域名：`enabled: false`

系统没有持久化“从何时开始排除、何时恢复”的时间段事件，因此不能可靠回答“某条历史发生时，当时是否排除”。

最简单、最可解释的规则是：

> 当前是否排除，决定该对象的全部历史当前是否进入统计。

这意味着：

- 排除后，排除前的历史也隐藏。
- 恢复后，排除前的历史重新出现。
- 排除期间因为没有写入，所以恢复后仍是空档。
- 不构造或推断不存在的历史排除区间。

### 2.4 应用与网页域名必须共享同一产品契约

应用卡片和网页域名卡片使用同一个“排除统计 / 恢复统计”动作。用户不会把它理解为两种不同功能。

所以必须保证：

- 两者都停止新写入。
- 两者都隐藏既有历史。
- 两者都在恢复后重新显示历史。
- 两者都保留底层数据。

统一的是产品语义，不要求代码强行使用同一个抽象：

- 应用身份由 canonical executable 决定。
- 网页身份由 normalized domain 决定。
- 应用历史由 Dashboard、History、Data 等应用读模型消费。
- 网页历史目前主要由 History 网页分布与网页时间线消费。

不得为了形式统一，把两个 owner 塞进新的万能 `shared` helper。

### 2.5 所有派生统计必须从同一有效集合计算

过滤不能只作用于列表最后一层。否则会产生“看不见对象，但总时长、百分比或热力仍包含它”的隐性错误。

正确顺序是：

```text
原始历史
  -> 身份归一化
  -> 当前排除策略过滤
  -> 时间范围裁剪 / 合并
  -> 总时长、排行、分布、趋势、百分比、时间线
```

至少必须保证：

- 分母不包含已排除对象。
- 总时长不包含已排除对象。
- 排名不包含已排除对象。
- 时间线不包含已排除对象。
- 热力与趋势不包含已排除对象。
- 空状态由过滤后的有效集合决定。

### 2.6 保存成功必须立即反映到所有可见页面

用户在 Classification 保存排除后，不能要求重启应用、手动刷新或等待缓存过期。

保存成功的用户可观察结果必须是：

1. 当前匹配的活跃记录已封口。
2. 当前对象的既有历史已从常规统计隐藏。
3. 所有受影响的快照、预热与持久化 bootstrap 不再提供旧视图。
4. 恢复统计时执行相反的可见性变化。

## 3. 最终产品契约

### 3.1 应用排除

- [x] 保存 `track: false` 后，当前匹配 session 立即封口。
- [x] 排除期间不创建、续写或恢复该应用的新 session。
- [x] 排除期间不创建或延长该应用标题样本。
- [x] 该应用的全部既有历史从常规应用统计中隐藏。
- [x] 该应用不进入 Dashboard 今日总时长、昨日对比、排行、分布和小时活动。
- [x] 该应用不进入 History 当日汇总、分布、时间线、小时活动和周趋势。
- [x] 该应用不进入 Data 热力、总趋势、应用趋势和应用选择候选。
- [x] 该应用仍保留在 Classification 的“已排除”管理视图。
- [x] 底层 session、标题样本和 continuity 数据不删除。

### 3.2 网页域名排除

- [x] 保存 `enabled: false` 后，当前匹配 web activity segment 立即封口。
- [x] 排除期间不创建或续写该域名的新 segment。
- [x] 该域名的全部既有历史从 History 网页分布和网页时间线隐藏。
- [x] 该域名不进入网页分布总时长与百分比分母。
- [x] 该域名不触发只为可见统计服务的新 favicon / 主题色解析工作。
- [x] 该域名仍保留在 Classification 的“已排除”管理视图。
- [x] 底层 segment、URL、标题与 favicon 历史不删除。

### 3.3 恢复统计

- [x] 应用恢复后，排除前的历史重新进入全部应用统计。
- [x] 网页域名恢复后，排除前的历史重新进入网页统计。
- [x] 恢复动作本身不立即创建记录。
- [x] 应用从恢复后的首次有效采样开始新 session。
- [x] 网页域名从恢复后的首次有效扩展上报开始新 segment。
- [x] 排除期间的时间不补记、不推断、不并入前后记录。

### 3.4 文案契约

中文说明建议固定为：

> 排除后停止记录，并从统计中隐藏已有活动；恢复后已有活动会重新显示，排除期间不会补记。

英文说明建议固定为：

> Excluding stops new records and hides existing activity from statistics. Restoring shows existing activity again; excluded time is not backfilled.

按钮名称继续使用：

- `排除统计 / Exclude stats`
- `恢复统计 / Restore stats`

不新增第二个显示开关，不把动作改名成仅表达“停止记录”的文案。

## 4. 范围与非目标

### 4.1 本轮范围

- 应用与网页域名使用同一“排除统计”产品语义。
- 应用历史在 Dashboard、History、Data 的全部派生统计中一致过滤。
- 网页域名历史在 History 网页分布与网页时间线中一致过滤。
- Classification 保存成功后立即失效相关读模型缓存。
- 恢复统计后既有历史立即重新可见。
- 中英文动作说明与状态提示保持一致。
- 自动化测试覆盖原始数据保留、可见集合变化与恢复路径。

### 4.2 明确非目标

- 不增加“隐藏已排除历史”开关。
- 不为每个对象增加第二个 `hideHistory` 字段。
- 不新增数据库表、migration 或排除区间事件。
- 不删除或改写排除前历史。
- 不补写排除期间的时间。
- 不改变备份、恢复和原始活动导出的完整数据语义。
- 不把 Classification “已排除”管理列表一起隐藏。
- 不重做 Classification、Dashboard、History 或 Data 页面布局。
- 不新增图表、弹窗或页面级筛选器。
- 不重写已完成的采集封口链，除非回归测试证明存在真实缺口。
- 不借机统一所有应用与网页读模型为一个跨域数据结构。

### 4.3 原始数据出口的边界

排除统计是常规产品统计的可见性规则，不等于数据删除规则。

因此本轮默认：

- 备份继续包含底层完整数据与 override。
- 恢复继续恢复底层完整数据与 override。
- 原始活动导出继续遵守现有字段与范围契约，不静默丢弃已排除历史。
- 如果未来要让导出“按当前统计口径过滤”，必须作为独立、明确的导出选项讨论。

## 5. 当前事实基线

### 5.1 已完成的上一阶段

- [x] 已归档执行单 `docs/archive/app-and-web-exclusion-stops-new-time-execution-plan.md`。
- [x] 应用排除已约束 Rust tracking 写入。
- [x] 网页域名排除已约束 web activity 写入。
- [x] 保存排除会按对象条件封口当前活跃记录。
- [x] 排除期间不写入、恢复后不补记已有测试保护。
- [x] v1.8.3 changelog 已记录“排除后仍写入新会话”的修复。

### 5.2 应用读模型现状

- [x] `src/shared/lib/sessionReadCompiler.ts` 已在 session 编译前检查当前应用排除状态。
- [x] Dashboard 和 History 的主要应用统计复用 session compiler。
- [x] `src/features/data/services/dataReadModel.ts` 已在 Data 聚合前检查应用排除状态。
- [x] widget 与 Tools 软件提醒候选已有应用排除判断。
- [x] 已存在“History 排除应用”和“Data 应用趋势排除应用”测试。
- [x] 尚未用一个跨页面验收矩阵证明所有应用派生指标同时排除。
- [x] 尚未证明保存后的所有 memory / persisted / prewarm 缓存立即失效且不会短暂回放旧统计。
- [x] 尚未覆盖“排除后总时长、百分比分母、昨日对比、周趋势同步重算”。

### 5.3 网页读模型现状

- [x] `WebDomainOverride.enabled` 已持久化并传入 History。
- [x] History 网页分布与网页时间线共享 `historyWebActivityViewModel.ts` 的构建函数。
- [x] `buildWebDomainDistribution` 当前未过滤 `enabled: false` 的域名。
- [x] `buildWebTimelineItems` 当前未过滤 `enabled: false` 的域名。
- [x] favicon 加载与主题色派生当前仍基于原始 `rawDayWebSegments`。
- [x] 尚无“网页域名排除后历史隐藏、恢复后重现”的读模型回归测试。

### 5.4 缓存与刷新现状

- [x] Classification 保存成功会清理 Dashboard snapshot cache。
- [x] Classification 保存成功会清理 History memory cache 与 persisted bootstrap。
- [x] Classification 保存成功会清理 Data bootstrap，并递增 mapping version 与 refresh tick。
- [x] Classification 保存成功会清理 Tools 页面缓存。
- [x] 需要验证 in-flight 旧快照不会在清理后重新写回并覆盖新语义。
- [x] 需要验证恢复统计同样触发完整刷新，而不是只处理排除方向。
- [x] 需要验证 History bootstrap identity 与 mapping version 在网页 override 改变时一致。

### 5.5 live Project 基线

2026-07-20 已通过浏览器登录态只读核对：

- [x] Project 为 `Patina Development Queue`。
- [x] 旧条目“让应用‘排除统计’停止写入新会话”位于 `Done`。
- [x] 当前 `In progress` 为 0 项。
- [x] 当前 `Next` 为 2 项。
- [x] 当前 Board 没有本次“隐藏既有历史并统一应用/网页语义”的独立条目。
- [x] 本次文档编写未修改 Project。

结论：不得重开旧 `Done` 条目。本次应作为新的语义增强事项预览，得到维护者确认后再在 Project 底部创建新 draft item。

## 6. Owner 与架构边界

### 6.1 Owner 分配

| 能力 | 真实 owner | 责任 |
| --- | --- | --- |
| 排除状态持久化 | `features/classification/*` + Rust classification data service | 延续现有 `track` / `enabled`，不新增状态字段 |
| 应用身份与用户排除判断 | `shared/classification/*` | canonical exe 与应用 override 的稳定共享语义 |
| 应用 session 有效集合 | `shared/lib/sessionReadCompiler.ts` | 在统计派生前排除当前禁用应用 |
| Dashboard 派生统计 | `features/dashboard/services/dashboardReadModel.ts` | 从有效 session 集合生成全部指标 |
| History 应用统计 | `features/history/services/historyReadModel.ts` | 从有效 session 集合生成汇总、时间线与周趋势 |
| Data 应用统计 | `features/data/services/dataReadModel.ts` | 从有效应用集合生成热力与趋势 |
| 网页域名有效集合 | `features/history/services/historyWebActivityViewModel.ts` | normalized domain + override enabled 过滤 |
| History 网页展示编排 | `features/history/components/History.tsx` / 相邻 hook | 只把有效网页集合交给分布、时间线、favicon 与视觉派生 |
| 缓存生命周期 | 各 feature cache service；`app/*` 只做薄协调 | 保存后失效受影响快照并触发刷新 |
| 新写入封口 | 现有 Rust tracking / web activity owner | 保持上一阶段实现，只做回归验证 |
| 文案 | `shared/copy/domains/mappingCopy.ts` | 中英文明确说明完整语义 |

### 6.2 允许修改的预计文件

实际实施以最小必要集合为准，允许范围包括：

- `src/shared/copy/domains/mappingCopy.ts`
- `src/shared/lib/sessionReadCompiler.ts`（仅当测试证明现有应用过滤仍有缺口）
- `src/features/dashboard/services/dashboardReadModel.ts`（仅当派生指标绕过有效集合）
- `src/features/history/services/historyReadModel.ts`
- `src/features/history/services/historyWebActivityViewModel.ts`
- `src/features/history/hooks/useHistorySnapshotRuntime.ts`
- `src/features/history/components/History.tsx`
- `src/features/history/services/historyCacheLifecycle.ts`
- `src/features/data/services/dataReadModel.ts`
- `src/features/data/services/dataCacheLifecycle.ts`
- `src/app/services/readModelRefreshState.ts`
- `src/app/AppShell.tsx`（只允许现有缓存失效协调的最小调整）
- 对应的现有测试文件
- `CHANGELOG.md`
- 本执行方案

### 6.3 默认禁止修改

- 数据库 schema 与 migration
- `src-tauri/src/lib.rs`
- Rust `commands/*` 新增厚逻辑
- Rust tracking runtime 主链重写
- `src/platform/*` 新增统计业务规则
- `src/shared/*` 新增跨域万能“可见性服务”
- 页面布局、设计 token、图表样式
- 备份、恢复与导出格式
- Web Sync 协议、鉴权和浏览器支持列表

如果必须触碰默认禁止区域，立即暂停当前阶段，记录为什么现有 owner 无法承接，再升级为边界判断；不得以“方便复用”为理由直接扩张。

## 7. 目标状态与数据流

### 7.1 应用统计数据流

```text
sessions / imported exact sessions / imported buckets
  -> native/import precedence
  -> canonical executable
  -> 当前 AppOverride.track 过滤
  -> 时间范围裁剪与 session 编译
  -> Dashboard / History / Data 派生统计
```

要求：

- 原生与导入记录使用同一当前排除语义。
- alias executable 必须归一到同一 canonical owner。
- 过滤发生在所有总量与百分比计算之前。
- 不在每个 React 组件末端重复 `.filter(...)`。

### 7.2 网页统计数据流

```text
web_activity_segments
  -> normalized domain
  -> 当前 WebDomainOverride.enabled 过滤
  -> 时间范围裁剪与同域合并
  -> 网页分布 / 网页时间线 / favicon 与主题色派生
```

要求：

- `enabled` 缺失默认允许。
- `enabled: false` 的 domain 在任何统计派生前退出。
- 大小写、尾点和 URL 变体必须使用 normalized domain 命中 override。
- favicon 加载只针对统计可见域名；原始 snapshot 仍可保留完整 segment 以支持恢复。

### 7.3 缓存变化数据流

```text
Classification 保存成功
  -> 更新内存中的 app / web overrides
  -> mappingVersion + 1
  -> dataRefreshTick + 1
  -> 清理 Dashboard snapshot
  -> 清理 History memory + persisted bootstrap
  -> 清理 Data heavy cache + persisted bootstrap
  -> 当前页面使用新 override 重建读模型
```

要求：

- 排除和恢复走同一刷新链。
- 保存失败不得改变可见统计。
- 旧 in-flight 请求不得在 generation 改变后回写为当前结果。
- 不依赖重启或页面切换。

## 8. 详细执行阶段

### 阶段 0：冻结基线与工作区

- [x] 记录当前分支、HEAD 与 `git status --short`。
- [x] 标记并保护已有用户改动，不覆盖不相关文件。
- [x] 重读顶层产品、路线、架构、Quiet Pro 与问题边界文档。
- [x] 重读本方案和上一阶段归档方案，明确“采集已完成、当前补读语义”。
- [x] 运行现有 `npm run test:tracking`、`npm run test:history-timeline`、`npm run test:data` 建立基线。
- [x] 记录基线失败并区分是否与本事项相关。
- [x] 确认不需要 schema migration、新 setting 或 IPC 字段。

阶段退出条件：基线可重复，工作区边界清楚，没有把旧失败误判为本次回归。

### 阶段 1：先用测试固定产品契约

- [x] 建立应用状态夹具：一个允许应用、一个排除应用，均有排除前历史。
- [x] 建立网页状态夹具：一个允许域名、一个排除域名，均有排除前 segment。
- [x] 为排除应用断言“原始记录仍存在、有效统计集合不存在”。
- [x] 为排除域名断言“原始 segment 仍存在、有效统计集合不存在”。
- [x] 为恢复状态断言同一原始数据重新进入有效集合。
- [x] 固定排除期间没有记录，因此恢复后不存在回填。
- [x] 固定应用 alias 与 domain normalization 的命中规则。
- [x] 让新增测试在实现前能够暴露当前网页历史缺口。

阶段退出条件：失败测试准确描述目标语义，不依赖 UI 文案字符串猜测行为。

### 阶段 2：审计应用有效集合的唯一入口

- [x] 复核 `shouldTrackInReadModel` 是否同时处理系统噪音和用户排除。
- [x] 复核 canonical alias 是否在读取排除状态前完成。
- [x] 复核 imported exact session 是否经过相同 compiler。
- [x] 复核 imported bucket 是否在物化后经过相同 compiler，或在 repository 映射时等价过滤。
- [x] 复核 Data 聚合对 native、import exact 与 import bucket 的过滤一致性。
- [x] 复核空 exe、未知 exe 与非法记录不会绕过排除判断。
- [x] 如果现有入口已正确，不做无收益重构，只补测试。
- [x] 如果存在两个不一致入口，把规则收回最小真实 owner，不新增页面级补丁。

阶段退出条件：应用历史只有一套可解释的当前排除判断，所有来源均受约束。

### 阶段 3：完善 Dashboard 全量统计一致性

- [x] 构造今日与昨日都包含排除应用的快照。
- [x] 断言 `compiledSessions` 不含排除应用。
- [x] 断言 `totalTrackedTime` 不含排除应用。
- [x] 断言 `yesterdayTrackedTime` 不含排除应用。
- [x] 断言 `dayDeltaTrackedTime` 使用过滤后的两个总量。
- [x] 断言 `topApplications` 不含排除应用。
- [x] 断言 `categoryDist` 不含排除应用，其百分比分母重新计算。
- [x] 断言 `hourlyActivity` 与 `hourlyCategoryActivity` 不含排除时间。
- [x] 断言全部应用排除后进入现有空状态，不保留旧 badge 数量。
- [x] 断言恢复统计后上述指标从保留的历史重新计算。
- [x] 确认图标加载额外读取不影响统计语义；除非有明确性能证据，不为本任务改造图标缓存。

阶段退出条件：Dashboard 不存在“行隐藏但总量、占比或小时图仍计算”的残留。

### 阶段 4：完善 History 应用统计一致性

- [x] 断言 `compiledSessions` 不含排除应用。
- [x] 断言 `summaryActiveDurationMs` 不含排除应用。
- [x] 断言 `appSummary` 与当日应用分布不含排除应用。
- [x] 断言 `timelineSessions` 不含排除应用及其标题详情。
- [x] 断言 `hourlyActivity` 与 `hourlyCategoryActivity` 不含排除时间。
- [x] 断言七日 `weekly` 与趋势图不含排除应用。
- [x] 断言时间线合并、最短显示时长不会把排除记录重新带回。
- [x] 断言当前 live session 在排除保存后不会被 materialize 复活。
- [x] 断言恢复统计后排除前历史重新进入汇总和时间线。
- [x] 断言排除期前后的两段不会因为 UI 合并规则覆盖真实空档。

阶段退出条件：History 的汇总、分布、时间线和周趋势共享同一有效应用集合。

### 阶段 5：完善 Data 应用统计一致性

- [x] 断言活动热力不包含排除应用时长。
- [x] 断言总活动趋势不包含排除应用时长。
- [x] 断言应用趋势候选不包含排除应用。
- [x] 断言显式选中的应用被排除后，选择回退到稳定有效项或空状态。
- [x] 断言搜索结果不重新暴露已排除应用。
- [x] 断言日、周、月、年粒度使用同一过滤集合。
- [x] 断言范围裁剪前后不会改变排除语义。
- [x] 断言近期热力、年度热力和预热快照结果一致。
- [x] 断言恢复统计后 Data 从原始历史重新构建，不依赖重新采集。
- [x] 运行 Data 稳定性能基准，确认过滤没有引入重复全量扫描。

阶段退出条件：Data 的热力、趋势、候选与搜索不存在排除语义分叉。

### 阶段 6：建立网页域名有效集合

- [x] 在 `historyWebActivityViewModel.ts` 定义 feature-owned 的域名可统计判断。
- [x] 判断使用 `normalizedDomain` 读取 override。
- [x] override 缺失或 `enabled !== false` 时允许统计。
- [x] `enabled: false` 时在范围裁剪、合并与总量计算前过滤。
- [x] `buildWebDomainDistribution` 只从有效 segment 计算总时长与百分比。
- [x] `buildWebTimelineItems` 只从有效 segment 创建时间线与标题详情。
- [x] 不修改原始 `dayWebSegments` 数据，不从 cache 或数据库删除。
- [x] 不把网页过滤逻辑放进通用应用 session compiler。
- [x] 不让分类、别名、颜色 override 被误判为排除。
- [x] 为大小写、尾点与规范域名增加测试。

阶段退出条件：网页分布与网页时间线共享一套 feature-owned 有效域名规则。

### 阶段 7：收口网页 favicon 与视觉派生

- [x] 在 History 编排层派生 `visibleDayWebSegments`，避免各组件重复过滤。
- [x] favicon 加载只接收有效网页 segment。
- [x] `webDomainIcons` 只从有效网页 segment 派生。
- [x] 主题色解析只等待有效域名，不因隐藏域名阻塞 `webVisualsReady`。
- [x] live web segment 检测忽略已排除域名，避免无意义定时刷新。
- [x] 排除最后一个可见域名后，网页分布与时间线进入稳定空状态。
- [x] 恢复域名后重新触发必要 favicon 解析，不依赖旧隐藏域名缓存是否存在。
- [x] 保留 favicon runtime cache 的容量与 LRU 契约。
- [x] 不把“是否已有 favicon”作为域名是否可见的判断条件。

阶段退出条件：隐藏域名既不进入统计，也不制造额外可见性等待或后台刷新。

### 阶段 8：验证 Classification 保存与缓存失效

- [x] 确认应用 `track` 和网页 `enabled` 在同一 draft commit 中正确保存。
- [x] 确认保存成功后才更新内存 override 与页面统计。
- [x] 确认保存失败时旧统计保持不变，草稿仍可重试。
- [x] 确认排除与恢复都调用 `onOverridesChanged`。
- [x] 确认 Dashboard snapshot cache 被清理。
- [x] 确认 History memory cache 与 persisted bootstrap 被清理。
- [x] 确认 Data heavy cache 与 persisted bootstrap 被清理；如当前只清 bootstrap，补足真实缺口。
- [x] 确认 mapping version 与 data refresh tick 同时递增。
- [x] 确认旧 in-flight snapshot 在 generation 变化后不会重新写回。
- [x] 确认页面当前不可见时，下一次进入也不会先展示持久化旧统计。
- [x] 确认恢复统计同样重新加载底层历史并显示。

阶段退出条件：排除或恢复保存完成后，无需重启、切页或等待 TTL 即可看到一致结果。

### 阶段 9：回归采集与恢复边界

- [x] 运行应用排除立即封口测试。
- [x] 运行应用排除期间不写入测试。
- [x] 运行应用 canonical alias 继承排除测试。
- [x] 运行网页域名排除立即封口测试。
- [x] 运行网页域名排除期间不写入测试。
- [x] 运行恢复后从首次有效采样 / 上报开始测试。
- [x] 运行排除期间不补记测试。
- [x] 运行 session continuity 不跨排除期测试。
- [x] 运行标题采集开关与排除统计组合测试。
- [x] 确认本次没有重写已稳定的 Rust owner。

阶段退出条件：读语义增强没有损坏上一阶段已经完成的写入语义。

### 阶段 10：完善中英文文案

- [x] 保留按钮“排除统计 / Exclude stats”。
- [x] 保留恢复动作“恢复统计 / Restore stats”。
- [x] 更新应用动作 tooltip，明确停止记录、隐藏已有活动、恢复可见与不补记。
- [x] 更新网页域名动作 tooltip，使用相同产品契约。
- [x] 确认“已排除 / Excluded” badge 不暗示数据已删除。
- [x] 确认删除历史动作仍明确独立且保持 danger 语义。
- [x] 确认中文与英文表达的信息量一致。
- [x] 不新增弹窗、确认步骤或长篇页面说明。
- [x] 复核 tooltip 可通过键盘焦点访问，按钮仍有稳定 accessible name。

阶段退出条件：用户能从现有动作说明理解完整语义，不需要学习第二套开关。

### 阶段 11：自动化验证

- [x] 运行最窄的网页活动 view-model 测试。
- [x] 运行最窄的 Dashboard read-model 测试。
- [x] 运行最窄的 History read-model 与时间线测试。
- [x] 运行最窄的 Data read-model 测试。
- [x] 运行 Classification draft 与交互测试。
- [x] 运行 `npm run test:tracking`。
- [x] 运行 `npm run test:history-timeline`。
- [x] 运行 `npm run test:data`。
- [x] 运行 `npm run test:classification`。
- [x] 运行 `npm test`。
- [x] 运行 `npm run test:replay`。
- [x] 运行 `npm run build`。
- [x] 运行 `npm run check`。
- [x] 如果触及 Rust 生产代码，运行 `npm run check:full`。
- [x] 如果触及 IPC、capability 或真实 runtime 注册，运行 `npm run test:tauri-runtime-smoke`。
- [x] 如果触及性能敏感读模型或 SQLite 查询，运行 `npm run perf:stable`。
- [x] 运行 `git diff --check`。
- [x] 检查 `git status --short`，确认没有越界文件。

阶段退出条件：风险匹配的全部自动化验证通过，失败证据已记录并解决。

### 阶段 12：人工验收

- [x] 按第 10 节逐项执行应用场景。
- [x] 按第 10 节逐项执行网页域名场景。
- [x] 在浅色与深色主题下检查现有 badge、tooltip 和空状态。
- [x] 检查中文与英文。
- [x] 检查保存成功后无需切页即可刷新。
- [x] 检查重启后排除状态与统计可见性一致。
- [x] 检查恢复后历史重新出现且排除期仍为空档。
- [x] 检查备份或原始导出仍包含保留数据。

阶段退出条件：真实桌面流程与自动化契约一致，没有只在单元测试中成立的行为。

### 阶段 13：文档、版本与交付

- [x] 在 `CHANGELOG.md` 的 `Unreleased / Changed` 记录语义增强。
- [x] 如实现发现长期规则缺失，更新顶层产品原则的“排除统计”一句话说明；否则不扩写长期文档。
- [x] 不把本执行单留在顶层 `docs/`。
- [x] 记录所有验证命令与结果。
- [x] 记录实际修改文件与 owner 归属。
- [x] 记录未完成项、后续事项和明确非目标。
- [x] 完成后将本文状态改为“已完成并归档”。
- [x] 将本文移动到 `docs/archive/`。

阶段退出条件：实现事实、版本说明、长期规则与归档状态一致。

## 9. 自动化测试矩阵

### 9.1 应用身份与有效集合

- [x] 普通 exe `track: false` 被排除。
- [x] 大小写不同 exe 命中同一 override。
- [x] 已验证 alias exe 命中 canonical owner 的 override。
- [x] 未知 helper 不被错误合并到其他应用。
- [x] native session 被排除。
- [x] import exact session 被排除。
- [x] import bucket 被排除。
- [x] 恢复后同一三类来源重新可见。

### 9.2 Dashboard

- [x] 今日总时长排除。
- [x] 昨日总时长排除。
- [x] 日变化值重算。
- [x] 应用排行排除。
- [x] 分类分布排除并重算百分比。
- [x] 小时总活动排除。
- [x] 小时分类活动排除。
- [x] 全部排除时空状态稳定。

### 9.3 History 应用统计

- [x] 当日汇总排除。
- [x] 应用分布排除并重算百分比。
- [x] 时间线与标题详情排除。
- [x] 小时活动排除。
- [x] 七日趋势排除。
- [x] live session 不复活。
- [x] 恢复后全部重现。

### 9.4 Data

- [x] 热力排除。
- [x] 总趋势排除。
- [x] 应用趋势排除。
- [x] 应用候选与搜索排除。
- [x] 显式选择回退稳定。
- [x] 日/月/年粒度一致。
- [x] 预热与现场计算一致。

### 9.5 网页域名

- [x] `enabled: false` 的域名不进入分布。
- [x] `enabled: false` 的域名不进入时间线。
- [x] 分布百分比分母重算。
- [x] 标题详情不泄漏到可见时间线。
- [x] 大小写与尾点归一正确。
- [x] 非排除域名正常显示。
- [x] 恢复后历史重现。
- [x] 排除域名不进入 favicon 请求集合。
- [x] 全部域名排除时空状态稳定。

### 9.6 缓存与时序

- [x] 排除保存清理所有相关缓存。
- [x] 恢复保存清理所有相关缓存。
- [x] 保存失败不刷新到草稿状态。
- [x] 旧 in-flight 快照不覆盖新 mapping version。
- [x] 冷启动 bootstrap 不短暂展示旧统计。
- [x] 后台回收后重新进入仍遵守当前排除状态。
- [x] 备份恢复触发的设置变化能重建有效集合。

## 10. 人工验收脚本

### 场景 A：应用已有历史后排除

- [x] 选择一个今日已有至少 5 分钟历史的应用 A。
- [x] 记录排除前 Dashboard 总时长、应用排行、分类分布与小时活动。
- [x] 在 Classification 对 A 执行“排除统计”并保存。
- [x] 不切页、不重启，返回 Dashboard。
- [x] 确认 A 从应用排行消失。
- [x] 确认总时长扣除 A 的既有时间。
- [x] 确认分类占比和小时活动同步重算。
- [x] 打开 History，确认 A 不在分布和时间线。
- [x] 打开 Data，确认 A 不在热力贡献、趋势和应用候选。
- [x] 回到 Classification，确认 A 仍在“已排除”中可管理。

### 场景 B：应用排除期间继续使用

- [x] 保持 A 排除。
- [x] 使用 A 至少 2 分钟。
- [x] 确认 Dashboard、History、Data 均无新增时间。
- [x] 通过现有诊断或本地数据库检查确认没有新 session。
- [x] 确认 widget 表达“当前窗口不写入记录”，而不是错误显示活跃计时。

### 场景 C：恢复应用统计

- [x] 对 A 执行“恢复统计”并保存。
- [x] 确认排除前的历史立即重新出现在 Dashboard、History、Data。
- [x] 确认排除期间的 2 分钟仍为空档。
- [x] 继续使用 A，确认从恢复后的首次有效采样开始新 session。
- [x] 确认新 session 不与排除前记录合并成连续时间。

### 场景 D：网页域名已有历史后排除

- [x] 选择一个今日已有网页活动的域名 D。
- [x] 在 History 网页分布与网页时间线记录排除前状态。
- [x] 在 Classification 对 D 执行“排除统计”并保存。
- [x] 返回 History，确认 D 从网页分布消失。
- [x] 确认网页分布总量与百分比重算。
- [x] 确认 D 从网页时间线及标题详情消失。
- [x] 确认其他域名不受影响。
- [x] 回到 Classification，确认 D 仍在“已排除”中可管理。

### 场景 E：网页域名排除期间继续浏览

- [x] 保持 D 排除。
- [x] 在支持的浏览器中继续浏览 D 至少 2 分钟。
- [x] 确认没有新 segment 或 duration 增长。
- [x] 确认 History 不因扩展持续上报而重新显示 D。

### 场景 F：恢复网页域名统计

- [x] 对 D 执行“恢复统计”并保存。
- [x] 确认排除前网页历史立即重新显示。
- [x] 确认排除期间没有被补记。
- [x] 等待下一次有效扩展上报，确认创建新 segment。
- [x] 确认新 segment 不延长排除前的旧 segment。

### 场景 G：重启与缓存

- [x] 同时保持一个应用和一个域名排除。
- [x] 完全退出并重启 Patina。
- [x] 确认首屏缓存不短暂展示已排除对象。
- [x] 依次打开 Dashboard、History、Data，确认一致隐藏。
- [x] 恢复两者并重启，确认既有历史一致重现。

### 场景 H：数据保留

- [x] 排除应用与域名后创建本地备份。
- [x] 确认备份仍包含对应底层历史和 override。
- [x] 如执行原始活动导出，确认其遵守现有完整数据契约。
- [x] 确认 UI 没有宣称排除等于删除。

## 11. 性能、可靠性与隐私预算

### 11.1 性能预算

- [x] 不为每个图表重复扫描全部历史并独立过滤。
- [x] 应用排除判断使用内存中的规范 override，不在 render 循环访问 SQLite。
- [x] 网页域名排除判断使用 O(1) override map lookup。
- [x] 只对可见域名加载或解析 favicon 与主题色。
- [x] 不扩大 Dashboard、History、Data 现有 cache 上限。
- [x] 不引入每次 mapping change 的全库复制或持久化汇总表。
- [x] 读模型基准没有出现超出稳定预算的退化。

### 11.2 可靠性预算

- [x] 保存失败不出现半生效统计。
- [x] 排除与恢复快速连续保存后，最终视图与 SQLite override 一致。
- [x] 旧异步请求不能覆盖新状态。
- [x] 冷启动、后台回收、备份恢复后语义一致。
- [x] 未知或损坏 override 不静默删除历史。
- [x] 排除判断异常时保留可诊断错误，不伪造数据已删除。

### 11.3 隐私边界

- [x] 排除对象的既有敏感标题不进入可见时间线与详情。
- [x] 底层历史仍按本地数据控制原则保存。
- [x] 本任务不上传、不发送或远程同步任何历史。
- [x] 用户如需永久移除，继续使用独立删除历史动作。

## 12. 风险与防错规则

### 风险 1：只隐藏列表，不重算总量

防错：所有指标必须从过滤后的有效集合重新派生，并用测试固定分母。

### 风险 2：应用生效，网页不生效

防错：应用与网页放在同一产品契约和验收矩阵中，但各自在真实 owner 实现。

### 风险 3：缓存短暂回放旧统计

防错：排除与恢复都递增 mapping version、清理 persisted bootstrap，并拒绝旧 generation 回写。

### 风险 4：恢复后历史无法重现

防错：只在读模型中过滤，不删除或覆盖原始历史；恢复测试使用同一原始夹具。

### 风险 5：为了统一制造新公共垃圾桶

防错：应用规则保留在 shared classification / session compiler；网页规则保留在 History feature。

### 风险 6：导入历史绕过排除

防错：native、import exact 与 import bucket 均进入明确的应用有效集合测试。

### 风险 7：隐藏域名仍触发视觉加载

防错：favicon、主题色和 live refresh 使用有效网页集合，不使用原始 segment 集合。

### 风险 8：文案让用户误以为数据已删除

防错：说明明确“隐藏已有活动、恢复后重新显示”，删除动作继续独立。

## 13. 明确禁止的捷径

- [x] 不通过删除历史实现排除。
- [x] 不增加第二个隐藏开关。
- [x] 不只在 React 列表 `.filter()`，却保留旧总量和百分比。
- [x] 不在 SQLite 查询字符串拼接 exe 或 domain。
- [x] 不在 `app/*`、`commands/*` 或 `lib.rs` 堆厚业务逻辑。
- [x] 不建立通用 `VisibilityManager`、全局 store 或跨域万能 helper。
- [x] 不重写已经完成的 tracking / web activity 封口链。
- [x] 不把排除对象从 Classification 管理页完全移除。
- [x] 不改变备份、恢复与删除历史语义。
- [x] 不把本执行单留在 `docs/working/` 作为长期文档。

## 14. 回滚策略

### 14.1 实施中回滚

如果某阶段失败：

- 保留能够独立验证且属于真实 owner 的测试。
- 不保留“应用已统一、网页未统一”的半接通状态。
- 不保留“列表隐藏、总量仍包含”的半接通状态。
- 不通过恢复旧缓存掩盖逻辑错误。
- 记录失败发生在哪个 owner、哪个不变量未满足。

### 14.2 发布后回滚

本任务不改 schema，也不新增 setting。代码回滚不会造成数据库格式不兼容。

回滚前必须确认：

- [x] 不删除用户现有 app / web override。
- [x] 不删除排除对象的历史数据。
- [x] 回滚说明明确语义会退回旧行为。
- [x] 如只发现单一页面回归，优先修复该 owner，不整体撤销写入保护。
- [x] 旧的“排除期间不写入”能力始终保留。

## 15. Project 协作方案

### 15.1 当前结论

- 旧 Project item 已 `Done`，不应重开。
- 本次是新的语义增强，应新建独立 draft item。
- 当前请求只授权编写执行方案，未授权创建 Project item。
- 未经维护者确认，不修改 Project。

### 15.2 新 item 预览

建议标题：

> 完善应用与网页域名“排除统计”的历史可见性

建议初始字段：

- Status：`Queued`
- Area：`Classification`
- 类型：产品语义增强 / 核心页面一致性
- 推荐初始位置：创建在 Project 底部，不自动重排；维护者可在 Board 视图中手动放到 Queued 合适位置

建议长描述：

> 将应用与网页域名“排除统计”从仅停止后续记录，补完整为统一、可逆的统计范围语义。对象处于排除状态时，不产生新时间，也不在 Dashboard、History、Data 等常规统计中显示既有历史；恢复统计后，既有历史重新显示，排除期间不补记。底层历史保留，不新增隐藏开关、排除时间段或数据库 schema。

建议验收条件：

- 应用排除后，既有历史从 Dashboard、History、Data 的全部派生指标消失。
- 网页域名排除后，既有历史从 History 网页分布与网页时间线消失。
- 所有总时长、排名、分布、百分比、趋势和热力基于过滤后的有效集合重算。
- 恢复统计后，既有历史重新出现，排除期间不补记。
- 底层历史、备份、恢复和原始导出不被删除或静默过滤。
- 排除与恢复保存后立即刷新，不需要重启或手动清缓存。

### 15.3 实施状态协作

如果维护者确认创建该 item：

- [x] 使用浏览器登录态在 Project 底部创建完整 draft item。
- [x] 填写长描述与字段。
- [x] 初始状态设为 `Queued`。
- [x] 验证 live 结果。
- [x] 不代替维护者重排位置。

开始实现时：

- [x] 重新读取 live Project。
- [x] 报告应由维护者把本 item 从当前状态拖到 `In progress`。
- [x] 重新计算 `Next` 窗口并一次性报告所需拖动。
- [x] 不等待拖动完成才开始已授权实现。

完成实现时：

- [x] 全部验收与验证通过。
- [x] 报告应由维护者把本 item 拖到 `Done`。
- [x] 重新计算 `Next` 窗口。
- [x] 明确本地 checklist、commit、push 或归档不能代替 live Project 状态。

## 16. Definition of Done

只有以下条件全部满足，任务才能完成：

- [x] 应用与网页域名共享同一“排除统计”产品语义。
- [x] 排除状态停止新写入。
- [x] 排除状态隐藏全部既有常规统计。
- [x] 恢复状态重新显示既有历史。
- [x] 排除期间不补记。
- [x] 底层历史未删除或改写。
- [x] Dashboard 全部派生指标一致。
- [x] History 应用与网页全部派生指标一致。
- [x] Data 全部派生指标一致。
- [x] Classification “已排除”管理路径可用。
- [x] 保存失败、缓存竞态与冷启动已有测试。
- [x] 中英文文案准确且无需第二个开关。
- [x] 自动化验证全部通过。
- [x] 人工验收全部通过。
- [x] Project 状态建议已报告但未被代理擅自操作。
- [x] `CHANGELOG.md` 已更新。
- [x] 本文已填写实际验证记录并移入 `docs/archive/`。

## 17. 实际验证记录

```text
基线分支与 HEAD：main / 3b4c431b2f66c36e988160ea6d984eb428f3add0
工作区初始状态：未发现与本任务冲突的用户代码改动；本执行单作为工作文档新增。

命令：npm run test:tracking
结果：pass
关键证据：93 条 tracking lifecycle 测试通过；新增 Dashboard 派生指标排除/恢复矩阵通过。

命令：npm run test:history-timeline
结果：pass
关键证据：应用 History 编译、时间线、周趋势和恢复语义回归通过。

命令：npm run test:data
结果：pass
关键证据：30 条 Data 读模型、3 条首屏调度、5 条搜索测试通过；热力排除/恢复和 late in-flight cache 清理通过。

命令：npm run test:classification
结果：pass
关键证据：46 条 draft state 与 17 条应用目录测试通过；保存失败和缓存 generation 契约保持有效。

命令：npm test
结果：pass
关键证据：仓库默认完整测试集通过。

命令：npm run test:replay
结果：pass
关键证据：15 条 replay 测试通过。

命令：npm run test:ui-browser-smoke
结果：pass
关键证据：46 条真实浏览器场景通过；新增场景证明排除域名从分布、时间线和 favicon 请求消失，恢复后保留历史重现。

命令：npm run build
结果：pass
关键证据：TypeScript 与 Vite 生产构建通过。

命令：npm run check
结果：pass
关键证据：类型、lint、命名、架构、IPC、热点、Quiet Pro、测试治理、覆盖率、8/8 关键变异、浏览器测试、构建与 bundle 全部通过；lazy JS 84.99/85 KiB。

命令：npm run check:full（如适用）
结果：not required
关键证据：本轮未修改 Rust、IPC 或 capability；补充执行的 npm run check:rust 已通过（429 pass，1 ignored，fmt/cargo check/clippy 通过）。

命令：npm run perf:stable
结果：pass
关键证据：7 组稳定期基准各运行 5 次全部通过；data-heatmap-recent 平均 52.40ms、最差 P95 95.60ms、最差 max 171.35ms。

命令：git diff --check
结果：pass
关键证据：无空白错误；归档后再次复核。
```

## 18. 最终完成报告

结果：

- 应用排除后继续复用统一 session compiler，并从 Dashboard、History、Data 的全部常规派生统计隐藏既有历史。
- 网页域名排除后从 History 网页分布、百分比分母、时间线、标题详情和 favicon 请求集合隐藏既有历史。
- 恢复统计后从保留的原始历史重新显示；排除期间仍不写入、不补记。
- 底层 session、segment、标题、favicon、备份、恢复与原始导出语义未改写。
- Classification 继续作为应用与网页域名统一“排除统计”的管理 owner，没有新增第二个开关。

主要 owner：

- 应用有效集合：`sessionReadCompiler.ts` 与 Data feature 内的 `dataHeatmapReadModel.ts`。
- 网页有效集合：`historyWebActivityViewModel.ts`，由 History runtime 一次派生可见 segment 集合。
- 缓存失效：`AppShell.tsx`、Data heatmap/trend cache epoch 与 History mapping-version identity。
- 文案：`mappingCopy.ts` 中英文 tooltip，以及顶层产品原则与 Unreleased changelog。

Project：

- live 当前状态：`In progress`（2026-07-20 完成复核）。
- 建议维护者拖动：`完善应用与网页域名“排除统计”的历史可见性` 从 `In progress` 到 `Done`。
- Next 窗口调整：无需调整；仍为“消除主窗口首次显示时的透明未就绪闪屏”和“建立持久化应用目录与活动汇总读模型”。
- 本地勾选、归档和验证不能代替 live Project 状态拖动。

文档：

- 全部执行项已关闭，本文归档至 `docs/archive/app-and-web-exclusion-statistics-semantics-execution-plan.md`。

## 19. 对抗式审查记录

实现与首轮验证完成后，以“性能退化、竞态回写、边界漂移、缓存泄漏和工程门禁”为攻击面进行复审，发现并修复三项问题：

1. Data 热力图最初复用完整 session compiler，超过稳定性能预算；改为 feature-owned、按应用身份缓存的轻量统计资格判定后，全套性能基准通过。
2. Data 热力图与趋势的旧 in-flight 请求可能在 cache clear 后回填旧快照；加入 cache epoch 与 promise ownership 检查，并以竞态测试固定。
3. `dataReadModel.ts` 一度超过热点文件预算，拆出真实 owner `dataHeatmapReadModel.ts`；随后发现 lazy JS 超预算，移除不影响可见语义的 favicon map 复制裁剪，最终未调高任何工程预算即通过完整门禁。

复审未发现未解决的阻断级、高风险或中风险问题。剩余 Project 状态拖动属于维护者协作动作，不影响本地实现完成与归档。
