# Data 聚合 Session DTO 收紧执行计划

## 1. 文档定位

本文是已完成并归档的一次性执行计划，用于收紧 `数据` 页趋势与热力图的聚合读取边界。

完成日期：

```text
2026-06-01
```

本轮没有修改 Rust tracking 主链、SQLite schema、History 或 Dashboard 行为。

## 2. 完成结论

- [x] Data 趋势快照不再携带 `HistorySession[]`。
- [x] Data 热力图缓存不再携带 `HistorySession[]`。
- [x] 新增最小聚合 DTO：

```ts
export interface AggregateSessionRecord {
  appName: string;
  exeName: string;
  startTime: number;
  endTime: number;
}
```

- [x] Data 聚合 DTO 不包含 `id`。
- [x] Data 聚合 DTO 不包含 `windowTitle`。
- [x] Data 聚合 DTO 不包含 `duration`。
- [x] Data 聚合 DTO 不包含 `continuityGroupStartTime`。
- [x] Data 聚合 DTO 不包含 `titleSampleDetails`。
- [x] active session 在 SQLite 边界归一化为明确的有效结束时间。
- [x] Data 趋势、应用趋势和热力图使用 Data 私有聚合链。
- [x] History 继续使用完整 session 与标题详情读取。
- [x] Dashboard 行为保持不变。

## 3. Owner 结果

### 3.1 SQLite 边界

`src/platform/persistence/sessionReadRepository.ts` 负责：

- [x] 查询聚合记录。
- [x] 将 active session 的 `end_time` 归一化为查询时刻。
- [x] 将 raw SQLite row 映射为最小 `AggregateSessionRecord`。
- [x] 在 repository 内部保留旧生命周期噪音过滤。

### 3.2 Data feature

`src/features/data/services/dataReadModel.ts` 负责：

- [x] 聚合记录裁剪。
- [x] 应用 key 归一化。
- [x] 用户排除规则。
- [x] 应用展示名解析。
- [x] 活动趋势聚合。
- [x] 应用趋势聚合。
- [x] 热力图累加。

### 3.3 未扩张的边界

- [x] 没有让 `Data.tsx` 处理 raw SQLite 字段。
- [x] 没有让 `app/services/*` 承担 Data 聚合规则。
- [x] 没有把 Data 私有 helper 放进 `shared/*`。
- [x] 没有修改 `src/shared/lib/sessionReadCompiler.ts`。
- [x] 没有修改 `src-tauri/*`。
- [x] 没有新增 migration。

## 4. SQL 投影结果

### 4.1 收紧前

聚合读取仍选择完整 History 基础字段：

```text
id
app_name
exe_name
window_title
start_time
end_time
duration
continuity_group_start_time
```

### 4.2 收紧后

聚合读取只选择：

```text
app_name
exe_name
window_title
start_time
effective_end_time
```

其中：

- [x] `window_title` 只停留在 repository 内部。
- [x] `window_title` 不再进入 Data DTO。
- [x] `effective_end_time` 使用 `COALESCE(end_time, ?)` 归一化 active session。
- [x] 查询继续使用参数化绑定。

### 4.3 严格删除 `window_title` 的决策

- [x] 已评估从 SQL 中删除 `window_title`。
- [x] 已补充仅靠标题识别的旧生命周期噪音 fixture。
- [x] fixture 证明 `window_title` 仍是历史兼容过滤依赖。
- [x] 本轮明确不从 SQL 删除 `window_title`。

保留原因：

```text
旧数据库或备份恢复数据可能包含只能结合标题识别的安装器、更新器记录。
如果 Data 单独删除 window_title，Data 与 History 的统计口径可能静默分叉。
```

## 5. 性能复核

### 5.1 已确认收益

- [x] 聚合 SQL 投影从 8 个字段收紧为 5 个字段。
- [x] Data DTO 收紧为 4 个字段。
- [x] Data 不再映射 History 标题详情。
- [x] Data 不再携带 History 时间线连续性字段。
- [x] Data 不再调用完整 History session 编译器。
- [x] 相同趋势日期范围继续复用快照。
- [x] 长区间查询继续避免读取 `session_title_samples`。

### 5.2 未引入的复杂度

- [x] 没有为少量字段收益新增第二条热力图 SQL。
- [x] 没有引入持久化日汇总表。
- [x] 没有引入 migration 或回填。

如果以后真实数据量下仍有明显卡顿，应单独建立持久化聚合层执行单，并基于真实数据库记录查询耗时。

## 6. 测试覆盖

- [x] 覆盖最小 DTO 字段形状。
- [x] 覆盖 active session 有效结束时间归一化。
- [x] 覆盖旧生命周期噪音标题过滤。
- [x] 覆盖跨日趋势裁剪。
- [x] 覆盖应用趋势聚合。
- [x] 覆盖重复应用展示项合并。
- [x] 覆盖用户排除规则。
- [x] 覆盖热力图缓存。
- [x] 覆盖趋势快照缓存。
- [x] 覆盖 startup warmup。

## 7. 验证结果

- [x] `npm run test:data-range`
- [x] `npm run test:data`
- [x] `npx tsc --noEmit`
- [x] `npm run check:naming`
- [x] `npm run check:architecture`
- [x] `npm run test:classification`
- [x] `npm run test:warmup`
- [x] `npm run build`
- [x] `npm run check`
- [x] `npm run release:validate-changelog`
- [x] `git diff --check`

`npm run check` 已覆盖：

- [x] tracking 生命周期测试。
- [x] replay 测试。
- [x] Data 范围与聚合测试。
- [x] UI smoke。
- [x] 浏览器 smoke。
- [x] 生产构建。
- [x] bundle 预算。

## 8. Changelog 与归档

- [x] 内部 DTO 收紧记录在 `CHANGELOG.md` 的 `Internal`。
- [x] 没有把 DTO、raw row 或 SQL 列名写成用户功能。
- [x] 没有使用 issue-closing 关键词。
- [x] 本文已从 `docs/working/` 移入 `docs/archive/`。

## 9. 最终完成标准

- [x] Data 页面进入时的聚合读取边界更轻。
- [x] 兼容旧数据库生命周期噪音过滤。
- [x] 不牺牲 History 与 Data 的统计一致性。
- [x] 默认验证门槛全部通过。
- [x] 一次性执行计划已勾选并归档。
