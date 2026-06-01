# Data 趋势时间范围选择器执行计划

## 1. 文档定位

本文是一份临时执行计划，用于实现 GitHub issue `#6` 第一项中与 `数据` 页有关的时间范围筛选能力：

> 保留当前 `近 7 天 / 近 30 天 / 近 1 年` 的简洁入口，同时允许用户点击中间标签，在日历中选择自然周、自然月、自然年或任意自定义时间段。

本文只作为本轮实施依据。功能完成并验证后，应将本文移入 `docs/archive/`，不应长期留在 `docs/working/` 或 top-level `docs/` 中。

## 2. 背景

当前 `数据` 页有三类时间范围控件：

- `活动趋势`：支持 `近 7 天 / 近 30 天 / 近 1 年`。
- `应用趋势`：支持 `近 7 天 / 近 30 天 / 近 1 年`。
- `活动热力图`：支持 `近一年 / 指定年份`。

其中，`活动趋势` 与 `应用趋势` 的左右箭头只能在固定的滚动范围之间切换。用户无法查看：

- 过去某一个自然周。
- 过去某一个自然月。
- 过去某一个自然年。
- 任意起始日期到终止日期组成的自定义区间。

本轮目标不是重做 `数据` 页，也不是把所有范围控件合并成全局筛选器。目标是在保持当前 Quiet Pro 密度和默认操作路径的前提下，为两个趋势面板增加可发现但低噪音的自由范围选择能力。

## 3. 已确认的产品决策

### 3.1 页面范围

- [x] 本轮只改 `数据` 页。
- [x] `历史` 页继续以按天回看为主，本轮不改造其时间范围。
- [x] `活动热力图` 继续保持独立的 `近一年 / 指定年份` 语义，本轮不并入趋势范围选择器。
- [x] `活动趋势` 与 `应用趋势` 保持各自独立的范围状态，不新增页面级全局范围控件。

### 3.2 收起状态

- [x] 默认视觉保持当前设计，不增加常驻按钮、分段控件或额外说明。
- [x] 两个趋势面板继续显示：

```text
‹   近 7 天   ›
```

- [x] 收起状态下，左右箭头继续在原有快捷范围中切换：

```text
近 7 天 -> 近 30 天 -> 近 1 年
```

- [x] 中间标签从不可点击状态改为可点击状态。
- [x] 点击中间标签后，打开时间范围选择弹层。

### 3.3 特殊范围应用后的收起标签

- [x] 自定义范围显示包含首尾日期在内的天数，例如：

```text
17天
```

- [x] 自然周显示周序号，例如：

```text
34周
```

- [x] 自然月只显示月份，不显示年份，例如：

```text
5月
```

- [x] 自然年显示年份，例如：

```text
2026年
```

- [x] 完整日期范围不挤进收起标签；完整范围在弹层内展示，例如：

```text
2026-05-01 - 2026-05-31
```

### 3.4 特殊范围应用后的左右箭头

- [x] 特殊范围与 `近 7 天 / 近 30 天 / 近 1 年` 没有天然顺序。
- [x] 当收起标签处于 `17天 / 34周 / 5月 / 2026年` 等特殊范围时，点击任意一侧箭头都恢复为：

```text
近 7 天
```

- [x] 恢复 `近 7 天` 后，左右箭头重新按原有快捷范围链路工作。
- [x] 特殊范围状态下，两个箭头的无障碍说明应表达“恢复近 7 天”，不伪装成“上一段 / 下一段”。

### 3.5 弹层模式

- [x] 弹层顶部保留一组与当前控件一致的左右箭头。
- [x] 顶部箭头用于切换选择模式，不用于翻动日历月份。
- [x] 模式顺序为：

```text
自定义 -> 一周 -> 一月 -> 一年
```

- [x] 日历自身使用单独的月份导航箭头。
- [x] 弹层底部提供 `取消` 与 `应用`。

### 3.6 日历选择规则

- [x] `自定义` 模式点击两次日期，组成起始日期与终止日期。
- [x] 自定义模式第二次点击早于第一次点击时，自动交换起止日期。
- [x] 自定义模式第二次点击可以与第一次点击为同一天。
- [x] 自定义范围完成后，顶部 `自定义` 标签变为包含首尾日期的天数，例如 `17天`。
- [x] 自定义范围不足 7 天时，显示非阻断提示，但仍允许应用。
- [x] `一周` 模式点击一次日期，自动得到该日期所在自然周。
- [x] `一月` 模式点击一次日期，自动得到该日期所在自然月。
- [x] `一年` 模式点击一次日期，自动得到该日期所在自然年。
- [x] 自然周固定采用周一到周日。
- [x] 当前自然周、当前自然月、当前自然年遇到未来日期时，终止日期截断为今天。
- [x] 未来日期不可点击。
- [x] 取消、按 `Escape` 或点击弹层外部区域时，不提交草稿范围。

## 4. 范围

### 4.1 本次包含

- [x] 将 `活动趋势` 的中间标签改为可点击入口。
- [x] 将 `应用趋势` 的中间标签改为可点击入口。
- [x] 为两个趋势面板复用同一个 Data feature 私有范围控件。
- [x] 新增 Data feature 私有时间范围弹层。
- [x] 支持 `自定义 / 一周 / 一月 / 一年` 四种弹层模式。
- [x] 支持日历两次单击式自定义区间选择。
- [x] 支持自然周、自然月、自然年单击式自动区间选择。
- [x] 支持特殊范围的收起标签与恢复 `近 7 天` 行为。
- [x] 支持任意合法历史区间的数据查询、聚合、缓存和刷新。
- [x] 保留 Data 到 History 的按日双击下钻能力。
- [x] 补齐中文与英文文案。
- [x] 补齐服务层单测、交互测试和浏览器 smoke。

### 4.2 本次不包含

- [x] 不改造 `历史` 页。
- [x] 不给 `历史` 页增加周、月、年或自定义时间线。
- [x] 不把两个趋势面板合并成一个全局筛选器。
- [x] 不改变热力图的 `近一年 / 指定年份` 控件。
- [x] 不把热力图绑定到趋势面板的范围状态。
- [x] 不修改 Rust tracking 主链、IPC 契约或 SQLite schema。
- [x] 不引入账号、云端状态或跨设备同步。
- [x] 不新增页面级状态库。
- [x] 不在弹层中加入复杂快捷卡片墙。
- [x] 不在本轮新增小时粒度趋势图；一天或少于一周的范围仍按日聚合。

## 5. 当前实现基线

### 5.1 当前趋势状态

当前 `src/features/data/components/Data.tsx` 中：

- `TREND_RANGE_OPTIONS` 固定为 `[7, 30, 365]`。
- `selectedTrendRange` 控制 `活动趋势`。
- `selectedAppTrendRange` 控制 `应用趋势`。
- 两个趋势面板保持独立状态。
- 两个中间标签当前使用禁用按钮展示，不能打开弹层。
- 两个趋势面板当前都借用 `HistorySnapshot.weeklySessions` 获取范围数据。

### 5.2 当前读模型限制

当前 `src/features/data/services/dataReadModel.ts` 中：

- `DataTrendRange` 固定为 `7 | 30 | 365`。
- `buildDataTrendViewModel` 使用 `getRollingDayRanges(range, nowMs)`。
- `buildDataAppTrendViewModel` 使用 `getRollingDayRanges(range, nowMs)`。
- `365` 天趋势按月聚合。
- `7` 天和 `30` 天趋势按日聚合。

这套模型适合“截至今天的滚动范围”，但不适合表达过去某个自然月或任意自定义区间。

### 5.3 当前查询能力

当前 `src/platform/persistence/sessionReadRepository.ts` 已有：

```ts
getSessionsInRange(startMs, endMs)
```

底层 SQL 已支持任意起止时间查询，不需要修改 schema。

但是，该查询会继续加载 `session_title_samples`。`数据` 页趋势和热力图只需要聚合字段，不需要标题详情。扩大可选范围后，应提供 Data 适用的轻量查询出口，避免读取不必要的标题采样。

### 5.4 当前未提交样式修复

当前工作区已有一项独立的小修：

```css
.data-heatmap-cell-future {
  opacity: 0.36;
}
```

它用于恢复指定年份热力图中未来日期的弱化边框。实施本计划时：

- [x] 保留该修复。
- [x] 不将未来日期重新改成透明。
- [x] 不把这项热力图修复混入趋势范围弹层的职责判断。

## 6. Owner 判断

### 6.1 真实 owner

- `features/data/services/dataTrendRange.ts`：拥有 Data 趋势范围语义、日期计算、标签计算和草稿选择规则。
- `features/data/services/dataTrendSnapshot.ts`：拥有 Data 趋势区间查询、缓存 key 和快照缓存。
- `features/data/hooks/useDataTrendSnapshot.ts`：拥有 Data 趋势快照加载、缓存复用、刷新和 loading 状态。
- `features/data/components/DataTrendRangeControl.tsx`：拥有收起状态范围控件。
- `features/data/components/DataTrendRangePicker.tsx`：拥有弹层 UI 与局部草稿交互。
- `features/data/services/dataReadModel.ts`：拥有趋势聚合、应用聚合和图表粒度。
- `platform/persistence/sessionReadRepository.ts`：拥有 SQLite 轻量 session summary 查询出口。
- `app/services/readModelRuntimeService.ts`：如需保留 process mapper runtime ready 保护，只承担薄协调。

### 6.2 不应吸收逻辑的层

- 不把 Data 范围语义塞进 `features/history/*`。
- 不让 `Data.tsx` 自己堆积日期算法。
- 不把 feature 私有范围类型放进 `shared/*`。
- 不让 `app/*` 承担日期计算、日历状态或标签格式化。
- 不让 `platform/*` 承担产品语义，只提供明确的数据读取出口。
- 不修改 `src-tauri/*`。

### 6.3 为什么不继续复用 HistorySnapshot

`HistorySnapshot` 的核心语义是：

- 某一天的 `daySessions`。
- 截至当前时间的滚动 `weeklySessions`。

Data 的新需求是：

- 任意历史区间。
- 自然周、自然月、自然年。
- 自定义起止日期。

因此：

- [x] 不扩张 `HistorySnapshot(date, rollingDayCount)` 让它同时承接 Data 任意区间。
- [x] 为 Data 新增自己的趋势快照。
- [x] 保持 History 的单日 owner 清晰。

## 7. 目标数据模型

### 7.1 快捷范围

保留快捷范围类型：

```ts
export type DataRollingTrendRange = 7 | 30 | 365;
```

### 7.2 特殊范围模式

新增：

```ts
export type DataTrendPickerMode = "custom" | "week" | "month" | "year";
```

### 7.3 已应用范围

推荐使用可辨识联合类型：

```ts
export type DataTrendRangeSelection =
  | { kind: "rolling"; days: DataRollingTrendRange }
  | { kind: "custom"; startDateKey: string; endDateKey: string }
  | { kind: "week"; anchorDateKey: string }
  | { kind: "month"; anchorDateKey: string }
  | { kind: "year"; anchorDateKey: string };
```

说明：

- `rolling` 保存滚动天数，继续表达 `近 7 天 / 近 30 天 / 近 1 年`。
- `custom` 保存明确起止日期。
- `week / month / year` 保存锚点日期，通过 helper 重新计算自然周期。
- 不在组件内重复拼装 `Date`。

### 7.4 已解析范围

新增纯计算结果：

```ts
export interface ResolvedDataTrendRange {
  selection: DataTrendRangeSelection;
  startDateKey: string;
  endDateKey: string;
  startMs: number;
  endMs: number;
  dayCount: number;
  label: string;
  granularity: "day" | "month";
  cacheKey: string;
}
```

规则：

- `startMs` 为本地起始日期 `00:00:00.000`。
- `endMs` 为终止日期下一天本地 `00:00:00.000` 的排他边界。
- 如果终止日期为今天，`endMs` 截断到 `nowMs`。
- `dayCount` 按本地日历天数计算并包含首尾日期，不直接使用毫秒除以 `86400000`，避免 DST 等本地日期边界问题。
- `cacheKey` 使用稳定的本地日期 key，例如：

```text
2026-05-01:2026-05-31
```

### 7.5 草稿状态

弹层内部使用独立草稿，不直接修改已应用范围：

```ts
export interface DataTrendRangeDraft {
  mode: DataTrendPickerMode;
  firstDateKey: string | null;
  range: ResolvedDataTrendRange | null;
}
```

规则：

- 打开弹层时，默认进入 `custom` 模式。
- 打开弹层时，不自动覆盖当前已应用范围。
- 切换模式时，清空未提交草稿，避免残留范围与新模式标签不一致。
- 点击 `取消`、按 `Escape` 或点击外部时，丢弃草稿。
- 只有点击 `应用` 后，才更新面板已应用范围并触发查询。

## 8. 标签与文案规则

### 8.1 中文

- 快捷范围：`近 7 天`、`近 30 天`、`近 1 年`。
- 模式标签：`自定义`、`一周`、`一月`、`一年`。
- 自定义应用后：`17天`。
- 自然周应用后：`34周`。
- 自然月应用后：`5月`。
- 自然年应用后：`2026年`。
- 不足一周提示：`当前范围不足 7 天。`
- 操作：`取消`、`应用`。

### 8.2 英文

- 快捷范围：保留现有 `Last 7 days`、`Last 30 days`、`Past year`。
- 模式标签：`Custom`、`Week`、`Month`、`Year`。
- 自定义应用后：`17 days`。
- 自然周应用后：`Week 34`。
- 自然月应用后：使用现有本地化月份，例如 `May`。
- 自然年应用后：`2026`。
- 不足一周提示：`The current range is shorter than 7 days.`
- 操作：使用现有 `Cancel`、`Apply` 或新增对应 Data 文案。

### 8.3 周序号

- [x] 使用 ISO 周序号。
- [x] 周一作为一周开始。
- [x] 跨年周按 ISO week-year 计算，不能简单使用自然年内天数除以 7。
- [x] 单测覆盖跨年边界，例如 `2025-12-29` 所在周。

## 9. 图表聚合规则

### 9.1 活动趋势

- [x] `近 7 天`：按日聚合。
- [x] `近 30 天`：按日聚合。
- [x] `近 1 年`：按月聚合。
- [x] 自然周：按日聚合。
- [x] 自然月：按日聚合。
- [x] 自然年：按月聚合。
- [x] 自定义范围 `<= 62` 天：按日聚合。
- [x] 自定义范围 `> 62` 天：按月聚合。

### 9.2 应用趋势

- [x] 与活动趋势使用相同的已解析范围和聚合粒度。
- [x] 应用列表、总时长、平均值、活跃天数、峰值日都基于当前范围。
- [x] 按日粒度时保留每日明细。
- [x] 按月粒度时图表使用月汇总。
- [x] 平均值文案根据粒度显示 `日均` 或 `月均`。

### 9.3 Data 到 History 下钻

- [x] 日粒度图表继续允许双击某一天打开 History。
- [x] 月粒度图表继续保持不可按日下钻。
- [x] 热力图到 History 的双击下钻保持不变。
- [x] 不因引入新范围而把月粒度点伪装成某一天。

## 10. 详细执行步骤

### 10.1 准备与基线确认

目标：

- 明确本轮改动范围。
- 避免覆盖工作区已有修改。

步骤：

- [x] 阅读并遵守：
  - [x] `docs/product-principles-and-scope.md`
  - [x] `docs/roadmap-and-prioritization.md`
  - [x] `docs/engineering-quality.md`
  - [x] `docs/quiet-pro-component-guidelines.md`
  - [x] `docs/architecture.md`
  - [x] `docs/issue-fix-boundary-guardrails.md`
  - [x] `docs/versioning-and-release-policy.md`
- [x] 运行 `git status --short`。
- [x] 确认 `src/styles/quiet-pro.css` 中已有热力图未来日期弱化修复。
- [x] 不回退与本任务无关的未提交改动。
- [x] 记录实现前 `npm run test:data` 结果。
- [x] 记录实现前 `npm run build` 结果。

验收标准：

- [x] 本轮改动边界清晰。
- [x] 已知未提交修改得到保留。
- [x] 已记录实现前基线。

### 10.2 建立 Data 范围纯函数

新增文件：

- `src/features/data/services/dataTrendRange.ts`

目标：

- 将日期计算、标签计算和草稿选择规则留在 Data feature 内。
- 让 React 组件只负责交互编排。

步骤：

- [x] 定义 `DataRollingTrendRange`。
- [x] 定义 `DataTrendPickerMode`。
- [x] 定义 `DataTrendRangeSelection`。
- [x] 定义 `ResolvedDataTrendRange`。
- [x] 定义 `DataTrendRangeDraft`。
- [x] 增加本地日期 helper：
  - [x] `parseLocalDateKey(dateKey)`。
  - [x] `toLocalDateKey(date)`。
  - [x] `startOfLocalDay(date)`。
  - [x] `addLocalDays(date, delta)`。
  - [x] `countInclusiveLocalDays(startDateKey, endDateKey)`。
- [x] 增加范围解析：
  - [x] `resolveRollingRange(days, nowMs)`。
  - [x] `resolveCustomRange(startDateKey, endDateKey, nowMs)`。
  - [x] `resolveNaturalWeekRange(anchorDateKey, nowMs)`。
  - [x] `resolveNaturalMonthRange(anchorDateKey, nowMs)`。
  - [x] `resolveNaturalYearRange(anchorDateKey, nowMs)`。
  - [x] `resolveDataTrendRange(selection, nowMs)`。
- [x] 增加标签计算：
  - [x] 快捷范围复用现有文案。
  - [x] 自定义范围输出包含首尾日期的天数。
  - [x] 自然周输出 ISO 周序号。
  - [x] 自然月只输出月份，不输出年份。
  - [x] 自然年输出年份。
- [x] 增加草稿交互 helper：
  - [x] 切换模式时清空草稿。
  - [x] 自定义第一次点击只设置起点。
  - [x] 自定义第二次点击生成完整范围。
  - [x] 自定义第二次日期较早时自动交换。
  - [x] 自定义完整后再次点击时重新开始选择。
  - [x] 周、月、年模式点击一次即生成完整范围。
- [x] 增加 `isShortCustomRange` 或等价 helper，仅用于 `< 7 天` 的非阻断提示。

验收标准：

- [x] 所有日期算法都可脱离 React 单测。
- [x] 所有范围都使用本地日期语义。
- [x] 所有未来边界都截断到今天或 `nowMs`。
- [x] 组件中不出现重复的周、月、年日期算法。

### 10.3 补充 Data 轻量 SQLite 读取出口

目标文件：

- `src/platform/persistence/sessionReadRepository.ts`

目标：

- 支持较长自定义范围而不读取无关标题采样。

步骤：

- [x] 新增明确命名的轻量读取函数，例如：

```ts
getSessionSummariesInRange(startMs: number, endMs: number)
```

- [x] 复用现有 sessions 基础查询字段。
- [x] 不查询 `session_title_samples`。
- [x] 映射出的 `HistorySession.titleSampleDetails` 使用空数组。
- [x] 保持现有 `getSessionsInRange` 行为不变，History 继续获得标题详情。
- [x] 将 Data 热力图默认依赖切换到轻量读取出口。
- [x] 将新的 Data 趋势快照读取切换到轻量读取出口。
- [x] 不修改 SQLite schema。
- [x] 不修改 Rust。

验收标准：

- [x] History 标题详情行为不变。
- [x] Data 趋势与热力图不再为聚合页面加载标题采样。
- [x] 数据范围扩大后，查询成本保持可解释。

### 10.4 新增 Data 趋势快照与缓存

新增文件：

- `src/features/data/services/dataTrendSnapshot.ts`

目标：

- 让 Data 拥有自己的任意区间快照，不再借用 HistorySnapshot。

步骤：

- [x] 定义：

```ts
export interface DataTrendSnapshot {
  fetchedAtMs: number;
  range: ResolvedDataTrendRange;
  sessions: HistorySession[];
}
```

- [x] 增加依赖接口，便于测试注入：

```ts
export interface DataTrendSnapshotDependencies {
  getSessionSummariesInRange: (
    startMs: number,
    endMs: number,
  ) => Promise<HistorySession[]>;
}
```

- [x] 增加按 `ResolvedDataTrendRange.cacheKey` 缓存的 Map。
- [x] 增加：
  - [x] `getCachedDataTrendSnapshot(range)`。
  - [x] `setDataTrendSnapshotCache(snapshot)`。
  - [x] `clearDataTrendSnapshotCache()`。
  - [x] `loadDataTrendSnapshot(range, deps?)`。
  - [x] `prewarmDefaultDataTrendSnapshot(nowMs, deps?)`。
- [x] 保证相同范围可被 `活动趋势` 与 `应用趋势` 复用。
- [x] 保证 refresh 时可重新查询，不把缓存误当成永久数据。

验收标准：

- [x] Data 任意区间不再依赖 `HistorySnapshot.weeklySessions`。
- [x] 两个趋势面板选择相同范围时可以复用同一份 session 快照。
- [x] cache key 不受显示标签影响。

### 10.5 保留 runtime ready 薄协调

目标文件：

- `src/app/services/readModelRuntimeService.ts`
- `src/app/services/startupWarmupService.ts`
- `tests/trackingLifecycle/readModelRuntime.ts`
- `tests/startupWarmupService.test.ts`

目标：

- 保留当前 Data 趋势读取前的 process mapper runtime ready 保护。
- 保留默认 `近 7 天` 的后台预热体验。

步骤：

- [x] 在 `readModelRuntimeService.ts` 增加薄包装：

```ts
loadDataTrendRuntimeSnapshot(selection, nowMs?)
```

- [x] 包装层只做：
  - [x] 等待 `ensureProcessMapperRuntimeReady()`。
  - [x] 调用 Data feature 的 `loadDataTrendSnapshot()`。
  - [x] 返回 Data feature 快照。
- [x] 不在 `app/*` 中增加范围算法或缓存规则。
- [x] 将 startup warmup 的默认 Data 预热调整为：
  - [x] 默认 `近 7 天`趋势快照。
  - [x] 默认 `近一年`热力图快照。
- [x] 保持现有 History 当天快照预热。
- [x] 更新 runtime service 与 warmup 测试。

验收标准：

- [x] `app/*` 仍然是薄协调层。
- [x] Data 首次进入时默认趋势加载体验不退化。
- [x] History 预热行为不退化。

### 10.6 泛化 Data 读模型

目标文件：

- `src/features/data/services/dataReadModel.ts`
- `tests/dataReadModel.test.ts`

目标：

- 让两个趋势读模型消费任意已解析范围。

步骤：

- [x] 将 `buildDataTrendViewModel` 入参从固定数字范围改为 `ResolvedDataTrendRange`。
- [x] 将 `buildDataAppTrendViewModel` 入参从固定数字范围改为 `ResolvedDataTrendRange`。
- [x] 增加按明确起止日期生成本地日范围的 helper。
- [x] 增加按明确起止日期生成月范围的 helper。
- [x] 保持 session clipping 逻辑，避免跨日 session 被重复或漏算。
- [x] 根据 `resolvedRange.granularity` 选择日聚合或月聚合。
- [x] 保持活动趋势 `date` 字段规则：
  - [x] 日粒度点保留 `YYYY-MM-DD`。
  - [x] 月粒度点使用 `null`，避免误下钻。
- [x] 保持应用趋势图点的日期字段与下钻规则一致。
- [x] 将 metric 文案改为动态范围文案。
- [x] 将应用趋势 `日均 / 月均` 判断从 `range === 365` 改为 `granularity`。
- [x] 保持应用列表去重、百分比、活跃天数和峰值日语义。
- [x] 保持 Data 到 History 双击逻辑。

验收标准：

- [x] 现有 `7 / 30 / 365` 统计结果不变。
- [x] 自然周、自然月、自然年结果正确。
- [x] 自定义范围结果正确。
- [x] 跨日 session 被正确裁剪。
- [x] 月粒度点不会误触发 History 下钻。

### 10.7 新增范围快照 hook

新增文件：

- `src/features/data/hooks/useDataTrendSnapshot.ts`

目标：

- 避免 `Data.tsx` 为两个趋势面板继续维护两份越来越复杂的加载 effect。

步骤：

- [x] 接收：
  - [x] 当前 `DataTrendRangeSelection`。
  - [x] `refreshKey`。
  - [x] runtime snapshot loader。
- [x] 内部解析当前范围。
- [x] 优先读取 Data feature 快照缓存。
- [x] 维护：
  - [x] `snapshot`。
  - [x] `resolvedRange`。
  - [x] `loading`。
  - [x] `hasFetchedOnce`。
- [x] 对相同范围复用正在进行的 Promise，避免两个趋势面板重复查询。
- [x] refreshKey 变化时重新查询。
- [x] 组件卸载或范围变化后忽略旧 Promise 结果。
- [x] 不把平台读取或 SQLite 细节暴露给组件。

验收标准：

- [x] `Data.tsx` 不再保留两份重复加载逻辑。
- [x] 两个趋势面板仍可独立切换范围。
- [x] 相同范围不会产生无意义的重复查询。

### 10.8 新增 Data 范围控件

新增文件：

- `src/features/data/components/DataTrendRangeControl.tsx`

目标：

- 保持收起状态与当前设计一致。

步骤：

- [x] 接收当前已应用 `DataTrendRangeSelection`。
- [x] 接收当前显示标签。
- [x] 接收范围变更回调。
- [x] 接收打开弹层回调或内部管理 picker。
- [x] 左侧箭头：
  - [x] 快捷范围状态下，切换到更短的快捷范围。
  - [x] 特殊范围状态下，恢复 `近 7 天`。
- [x] 中间标签：
  - [x] 使用真实 `<button type="button">`。
  - [x] 不再使用 `disabled`。
  - [x] 点击后打开弹层。
  - [x] 设置 `aria-expanded`。
  - [x] 设置合适的 `aria-haspopup`。
- [x] 右侧箭头：
  - [x] 快捷范围状态下，切换到更长的快捷范围。
  - [x] 特殊范围状态下，恢复 `近 7 天`。
- [x] 快捷范围边界保持当前禁用规则：
  - [x] `近 7 天` 左箭头禁用。
  - [x] `近 1 年` 右箭头禁用。
- [x] 特殊范围状态下两个箭头均可用。
- [x] 特殊范围状态下两个箭头 aria-label 均表达“恢复近 7 天”。

验收标准：

- [x] 默认外观与当前设计基本一致。
- [x] 中间标签可发现为可点击控件。
- [x] hover、active、focus、disabled 状态完整。
- [x] 特殊范围恢复行为一致，不依赖箭头方向。

### 10.9 新增 Data 范围弹层

新增文件：

- `src/features/data/components/DataTrendRangePicker.tsx`

目标：

- 提供低噪音但完整的范围选择能力。

推荐结构：

```text
选择统计范围

‹              自定义              ›
请选择开始日期

‹            2026 年 5 月           ›
一   二   三   四   五   六   日
               日历

当前范围不足 7 天。

                         取消   应用
```

步骤：

- [x] 使用 anchor popover，而不是全屏 modal。
- [x] 使用 portal 渲染，避免被 Data 页面滚动容器裁切。
- [x] 计算弹层位置，优先显示在中间标签下方。
- [x] 视口空间不足时向上或横向收敛。
- [x] 顶部增加模式导航：
  - [x] 左箭头切换到前一个模式。
  - [x] 中间显示当前模式或已选范围短标签。
  - [x] 右箭头切换到后一个模式。
  - [x] `custom` 左箭头禁用。
  - [x] `year` 右箭头禁用。
- [x] 增加草稿摘要：
  - [x] 自定义尚未选择时显示 `请选择开始日期`。
  - [x] 自定义只选一次时显示 `请选择结束日期`。
  - [x] 完整范围时显示 `YYYY-MM-DD - YYYY-MM-DD`。
- [x] 增加日历月份导航：
  - [x] 使用独立左右箭头。
  - [x] 中间显示 `YYYY 年 M 月`。
  - [x] 禁止翻到完全位于未来的月份。
- [x] 增加星期标题。
- [x] 增加 6 行日期网格。
- [x] 日期 cell 状态：
  - [x] default。
  - [x] hover。
  - [x] active。
  - [x] focus-visible。
  - [x] disabled future。
  - [x] outside-month muted。
  - [x] selected start。
  - [x] selected end。
  - [x] selected in-range。
- [x] 自定义模式：
  - [x] 两次点击完成范围。
  - [x] 完成后顶部短标签变为 `N天`。
  - [x] 再点击日期时重新开始选择。
- [x] 周模式：
  - [x] 单击日期完成范围。
  - [x] 高亮该日期所在自然周。
  - [x] 顶部短标签变为 `N周`。
- [x] 月模式：
  - [x] 单击日期完成范围。
  - [x] 高亮该日期所在自然月。
  - [x] 顶部短标签变为 `M月`。
- [x] 年模式：
  - [x] 单击日期完成范围。
  - [x] 当前月份日历中高亮可见的年内日期。
  - [x] 顶部短标签变为 `YYYY年`。
- [x] 自定义范围不足 7 天时显示非阻断提示。
- [x] 没有完整草稿范围时禁用 `应用`。
- [x] 点击 `取消` 时关闭弹层并丢弃草稿。
- [x] 点击 `应用` 时提交草稿并关闭弹层。
- [x] 点击外部区域时关闭弹层并丢弃草稿。
- [x] 按 `Escape` 时关闭弹层并丢弃草稿。
- [x] 处理窗口 resize 与滚动时的定位更新或关闭策略。

验收标准：

- [x] 日历不是纯展示，完整承载四种选择模式。
- [x] 模式箭头和月份箭头职责清楚。
- [x] 用户可以在不理解内部数据模型的情况下完成选择。
- [x] 弹层没有卡片墙、强阴影或视觉噪音。

### 10.10 接入 Data 页面

目标文件：

- `src/features/data/components/Data.tsx`
- `src/app/AppShell.tsx`

步骤：

- [x] 将 Data props 中的 History snapshot loader 替换为 Data trend runtime snapshot loader。
- [x] 保留 History 自己使用的 History snapshot loader。
- [x] 将 `selectedTrendRange` 替换为 `DataTrendRangeSelection`，默认值：

```ts
{ kind: "rolling", days: 7 }
```

- [x] 将 `selectedAppTrendRange` 替换为 `DataTrendRangeSelection`，默认值：

```ts
{ kind: "rolling", days: 7 }
```

- [x] 使用 `useDataTrendSnapshot` 分别加载活动趋势和应用趋势。
- [x] 两者范围状态独立，但共享底层 snapshot cache。
- [x] 用 `DataTrendRangeControl` 替换活动趋势现有范围控件。
- [x] 用 `DataTrendRangeControl` 替换应用趋势现有范围控件。
- [x] 保持热力图控件原样。
- [x] 保持 Data 到 History 双击下钻原样。
- [x] 保持应用搜索、应用选择与图表 tooltip 原样。

验收标准：

- [x] 默认打开 Data 页面时，视觉与行为仍是 `近 7 天`。
- [x] 活动趋势切换范围不会强制改变应用趋势。
- [x] 应用趋势切换范围不会强制改变活动趋势。
- [x] 热力图范围不会受两个趋势控件影响。

### 10.11 文案接入

目标文件：

- `src/shared/copy/uiText.ts`

步骤：

- [x] 增加 Data picker 中文文案。
- [x] 增加 Data picker 英文文案。
- [x] 增加标签 helper 或 copy 函数：
  - [x] 自定义天数。
  - [x] 周序号。
  - [x] 年份。
  - [x] 完整范围。
- [x] 月份继续复用 `UI_TEXT.date.monthLabel`。
- [x] 年月标题继续复用 `UI_TEXT.date.yearMonthLabel`。
- [x] 星期继续复用 `UI_TEXT.date.weekdaysShort`。
- [x] 增加 aria-label：
  - [x] 打开范围选择。
  - [x] 恢复近 7 天。
  - [x] 切换选择模式。
  - [x] 上一个月。
  - [x] 下一个月。
  - [x] 应用范围。
  - [x] 取消范围编辑。
- [x] 运行或扩展 copy key 对齐测试。

验收标准：

- [x] 中英文 key 结构一致。
- [x] 中文标签符合确认口径：`17天 / 34周 / 5月 / 2026年`。
- [x] 月份标签不额外拼接年份。

### 10.12 样式接入

新增文件：

- `src/styles/features/data.css`

修改文件：

- `src/App.css`

目标：

- 新增 Data feature 私有样式，不继续扩大通用 Quiet Pro 样式文件。

步骤：

- [x] 在 `src/App.css` 中导入 `./styles/features/data.css`。
- [x] 新增范围控件中间按钮可点击状态。
- [x] 新增 popover 容器样式。
- [x] 新增模式导航样式。
- [x] 新增草稿摘要样式。
- [x] 新增日历标题与月份导航样式。
- [x] 新增星期与日期网格样式。
- [x] 新增范围首尾与区间高亮样式。
- [x] 新增短范围提示样式。
- [x] 新增 footer 操作样式。
- [x] 所有颜色、边框、圆角、背景和阴影复用现有 token。
- [x] 不新增玻璃拟态、模糊面板、霓虹或大渐变。
- [x] 不顺手迁移现有 Data 样式，避免扩大本轮范围。
- [x] 保留 `src/styles/quiet-pro.css` 中热力图未来日期弱化修复。

验收标准：

- [x] 默认控件仍然安静、紧凑。
- [x] popover 与 History 日历、Quiet Pro 控件气质一致。
- [x] 新样式 owner 清楚。
- [x] 现有页面布局没有明显跳动。

### 10.13 服务层测试

目标文件：

- `tests/dataTrendRange.test.ts`
- `tests/dataReadModel.test.ts`
- `package.json`

步骤：

- [x] 新增 `tests/dataTrendRange.test.ts`。
- [x] 新增 `npm run test:data-range`。
- [x] 将 `test:data-range` 接入 `check:frontend`，或让 `test:data` 串联执行。
- [x] 覆盖快捷范围：
  - [x] `近 7 天`。
  - [x] `近 30 天`。
  - [x] `近 1 年`。
- [x] 覆盖自定义范围：
  - [x] 正向两次选择。
  - [x] 反向两次选择后自动交换。
  - [x] 同一天选择。
  - [x] 完成后重新开始。
  - [x] `< 7 天`提示。
  - [x] `>= 7 天`无提示。
- [x] 覆盖自然周：
  - [x] 周一到周日。
  - [x] 当前周截断到今天。
  - [x] ISO 跨年周序号。
- [x] 覆盖自然月：
  - [x] 过去月份完整范围。
  - [x] 当前月份截断到今天。
  - [x] 闰年二月。
- [x] 覆盖自然年：
  - [x] 过去年份完整范围。
  - [x] 当前年份截断到今天。
- [x] 覆盖标签：
  - [x] `17天`。
  - [x] `34周`。
  - [x] `5月`。
  - [x] `2026年`。
- [x] 覆盖图表聚合：
  - [x] 自然周按日。
  - [x] 自然月按日。
  - [x] 自然年按月。
  - [x] 自定义 `62` 天按日。
  - [x] 自定义 `63` 天按月。
- [x] 覆盖 Data snapshot cache：
  - [x] 相同起止日期复用缓存。
  - [x] 不同起止日期不混用缓存。
  - [x] 活动趋势与应用趋势可复用同一快照。
- [x] 运行：

```text
npm run test:data-range
npm run test:data
npm run test:data-chart
```

验收标准：

- [x] 日期算法、标签和聚合粒度都有自动化保护。
- [x] 不依赖浏览器才能验证核心语义。

### 10.14 组件与浏览器交互测试

目标文件：

- `tests/uiBrowserSmoke.test.ts`

目标：

- 覆盖用户真实操作路径。

步骤：

- [x] 导航到 `数据` 页。
- [x] 确认活动趋势初始标签为 `近 7 天`。
- [x] 点击活动趋势中间标签。
- [x] 确认弹层打开且默认模式为 `自定义`。
- [x] 在日历中选择两个日期。
- [x] 确认顶部标签变成 `N天`。
- [x] 确认完整范围摘要正确。
- [x] 确认 `< 7 天` 时出现非阻断提示。
- [x] 点击 `应用`。
- [x] 确认活动趋势收起标签变成 `N天`。
- [x] 点击任意外侧箭头。
- [x] 确认活动趋势恢复 `近 7 天`。
- [x] 再次打开弹层并切换到 `一周`。
- [x] 点击一个日期。
- [x] 确认只需一次点击即生成自然周范围。
- [x] 依次抽查 `一月` 与 `一年`。
- [x] 确认月标签只显示 `5月`，不显示 `2026 年 5 月`。
- [x] 确认点击 `取消` 不更新已应用范围。
- [x] 确认按 `Escape` 不更新已应用范围。
- [x] 对应用趋势重复至少一条应用路径。
- [x] 确认热力图 `近一年 / 指定年份` 控件仍独立工作。
- [x] 确认热力图指定年份未来日期仍保留弱化边框。
- [x] 确认没有 console error。
- [x] 确认没有明显横向溢出。

验收标准：

- [x] 默认路径、自由范围路径和恢复默认路径都可工作。
- [x] 两个趋势控件独立。
- [x] 热力图无回归。

### 10.15 性能复核

目标：

- 验证扩大区间后不会静默引入明显性能问题。

步骤：

- [x] 使用轻量 session summary 查询。
- [x] 测试 `近 7 天`首次查询。
- [x] 测试 `近 1 年`首次查询。
- [x] 测试一个跨两年的自定义范围。
- [x] 记录查询耗时和 session 数量。
- [x] 确认 Data 不加载 `session_title_samples`。
- [x] 确认两个趋势面板相同范围复用快照。
- [x] 如果大范围仍不可接受：
  - [x] 先记录测量结果。
  - [x] 再决定是否引入明确的最大范围限制。
  - [x] 不静默裁剪用户选择。

验收标准：

- [x] 默认范围体验不退化。
- [x] 长范围成本可解释。
- [x] 没有为暂时假设提前引入复杂持久化汇总表。

### 10.16 局部验证

按风险从小到大执行：

- [x] `npm run test:data-range`
- [x] `npm run test:data`
- [x] `npm run test:data-chart`
- [x] `npm run test:warmup`
- [x] `npm run test:ui-smoke`
- [x] `npm run test:ui-browser-smoke`
- [x] `npm run build`

如果其中任一步失败：

- [x] 先确认是否由本次修改造成。
- [x] 如果是，修复后重跑失败项。
- [x] 如果不是，记录现有失败和影响范围，不隐藏风险。

### 10.17 完整验证

本次触及 Data 读模型、SQLite 读取出口、startup warmup 和用户可见交互，交付前执行：

- [x] `npm run check`

如果实施过程中意外触及 Rust、IPC、schema 或发布链路，则追加：

- [x] `npm run check:full`

### 10.18 Changelog 与文档归档

目标文件：

- `CHANGELOG.md`
- `docs/working/data-trend-range-picker-execution-plan.md`

步骤：

- [x] 在 `CHANGELOG.md` 的 `Unreleased` 中记录用户可感知变化。
- [x] 使用 issue 引用，例如：

```md
[#6](https://github.com/Ceceliaee/time-tracking/issues/6)
```

- [x] 不使用 `Closes`、`Fixes` 或 `Resolves`。
- [x] 完成验收后，将本文移入：

```text
docs/archive/data-trend-range-picker-execution-plan.md
```

- [x] 不修改 top-level 长期规则文档，除非实施过程中真的发现长期规则变化。

验收标准：

- [x] Changelog 面向用户描述结果。
- [x] issue 状态不被自动改变。
- [x] 一次性执行单完成后归档。

## 11. 推荐实施顺序

- [x] 第一步：确认基线与未提交改动。
- [x] 第二步：新增 `dataTrendRange.ts` 和纯函数测试。
- [x] 第三步：新增轻量 session summary 读取出口。
- [x] 第四步：新增 `dataTrendSnapshot.ts` 与缓存测试。
- [x] 第五步：补 runtime ready 薄包装与 startup warmup。
- [x] 第六步：泛化 `dataReadModel.ts`。
- [x] 第七步：新增 `useDataTrendSnapshot.ts`，收口加载状态。
- [x] 第八步：新增 `DataTrendRangeControl.tsx`。
- [x] 第九步：新增 `DataTrendRangePicker.tsx`。
- [x] 第十步：接入活动趋势。
- [x] 第十一步：接入应用趋势。
- [x] 第十二步：接入中英文 copy 与 Data feature CSS。
- [x] 第十三步：补服务层测试。
- [x] 第十四步：补浏览器交互 smoke。
- [x] 第十五步：执行性能复核。
- [x] 第十六步：执行 `npm run check`。
- [x] 第十七步：更新 changelog 并归档本文。

## 12. 预计文件清单

### 12.1 新增

- [x] `src/features/data/services/dataTrendRange.ts`
- [x] `src/features/data/services/dataTrendSnapshot.ts`
- [x] `src/features/data/hooks/useDataTrendSnapshot.ts`
- [x] `src/features/data/components/DataTrendRangeControl.tsx`
- [x] `src/features/data/components/DataTrendRangePicker.tsx`
- [x] `src/styles/features/data.css`
- [x] `tests/dataTrendRange.test.ts`

### 12.2 修改

- [x] `src/App.css`
- [x] `src/features/data/components/Data.tsx`
- [x] `src/features/data/services/dataReadModel.ts`
- [x] `src/platform/persistence/sessionReadRepository.ts`
- [x] `src/app/services/readModelRuntimeService.ts`
- [x] `src/app/services/startupWarmupService.ts`
- [x] `src/app/AppShell.tsx`
- [x] `src/shared/copy/uiText.ts`
- [x] `tests/dataReadModel.test.ts`
- [x] `tests/trackingLifecycle/readModelRuntime.ts`
- [x] `tests/startupWarmupService.test.ts`
- [x] `tests/uiBrowserSmoke.test.ts`
- [x] `package.json`
- [x] `CHANGELOG.md`

### 12.3 不应修改

- [x] `src/features/history/**`
- [x] `src-tauri/**`
- [x] SQLite migrations
- [x] `docs/archive/**`，归档本文时除外
- [x] top-level 长期规则文档，除非长期规则确实变化

## 13. 风险与处理

### 13.1 Data 范围语义倒灌 History

风险：

- 为了复用现有 loader，把 HistorySnapshot 继续扩成万能范围查询。

处理：

- [x] Data 新增自己的 snapshot。
- [x] History 保持单日 owner。

### 13.2 Data.tsx 继续膨胀

风险：

- 直接在页面组件中增加日期算法、日历状态、定位和缓存。

处理：

- [x] 日期算法进入 `dataTrendRange.ts`。
- [x] 加载状态进入 `useDataTrendSnapshot.ts`。
- [x] 弹层进入独立组件。

### 13.3 长范围查询成本过高

风险：

- 聚合页面继续读取标题采样。
- 自定义范围跨多年后加载变慢。

处理：

- [x] 新增轻量 session summary 查询。
- [x] 长范围改为按月聚合。
- [x] 先测量，再决定是否需要明确上限。
- [x] 不静默截断范围。

### 13.4 日期边界错误

风险：

- UTC 解析导致日期偏移。
- DST 导致天数错误。
- 当前周期包含未来日期。

处理：

- [x] 使用本地构造函数 `new Date(year, monthIndex, day)`。
- [x] 使用日历日期迭代计算天数。
- [x] 当前周期截断到今天和 `nowMs`。
- [x] 单测覆盖闰年和跨年。

### 13.5 弹层交互职责混乱

风险：

- 顶部箭头既切模式又翻月份。
- 主页面特殊范围箭头被误解为上一周期或下一周期。

处理：

- [x] 模式箭头与日历月份箭头分开。
- [x] 特殊范围外侧箭头统一恢复 `近 7 天`。
- [x] 补 aria-label 与浏览器 smoke。

### 13.6 热力图回归

风险：

- 趋势范围改造时误碰热力图独立状态。
- 再次隐藏指定年份未来日期边框。

处理：

- [x] 热力图范围状态保持独立。
- [x] 保留未来日期 `opacity: 0.36`。
- [x] 浏览器 smoke 覆盖指定年份网格。

## 14. 最终完成标准

- [x] `活动趋势` 默认仍显示 `近 7 天`。
- [x] `应用趋势` 默认仍显示 `近 7 天`。
- [x] 两个趋势中间标签均可点击。
- [x] 弹层支持 `自定义 / 一周 / 一月 / 一年`。
- [x] 自定义范围支持两次点击完成选择。
- [x] 周、月、年范围支持一次点击完成选择。
- [x] 自定义 `< 7 天` 时有非阻断提示。
- [x] 应用后收起标签符合约定：
  - [x] `17天`
  - [x] `34周`
  - [x] `5月`
  - [x] `2026年`
- [x] 特殊范围状态下任一外侧箭头都恢复 `近 7 天`。
- [x] 两个趋势范围保持独立。
- [x] 热力图范围保持独立。
- [x] 热力图指定年份未来日期轮廓保持可见。
- [x] History 保持按天回看，不被本轮扩张。
- [x] Data 不再借用 HistorySnapshot 承担任意范围。
- [x] Data 聚合查询不再加载标题采样。
- [x] Data 到 History 日粒度双击下钻保持可用。
- [x] 中英文文案完整。
- [x] Quiet Pro 风格一致。
- [x] `npm run check` 通过，或清楚记录无法通过的外部原因。
