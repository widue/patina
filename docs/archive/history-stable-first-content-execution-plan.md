# History 稳定首屏与刷新解耦执行方案

状态：已完成并归档（对抗式审查通过）  
创建日期：2026-07-16  
完成日期：2026-07-16  
文档类型：稳定期结构性问题执行单

## 1. 问题与目标

History 在首次进入或长后台释放重缓存后，会在导航已经完成的情况下显示 0.5–1 秒空壳。过去通过等待数据再切页、重型启动预热或隐藏 loading 处理时，又分别引入点击延迟、资源上涨或无反馈空白。

本轮同时锁定三个目标：

- [x] 主导航不等待页面数据，点击反馈保持即时。
- [x] 常规首次进入、热返回和长后台返回优先显示同日期的可信快照，刷新不清屏。
- [x] 重型 History 原始数据仍可释放，保留数据有硬上限且不包含标题明细、favicon 或图标 payload。

## 2. Owner 与边界

- [x] `src/features/history/*` 拥有快照结构、校验、SWR 状态与页面消费规则。
- [x] `src/platform/persistence/*` 只提供参数化读取和 typed command 写入边界。
- [x] `src-tauri/src/data/*` 拥有 settings payload 写入与大小校验。
- [x] `src-tauri/src/commands/*` 只做薄命令转发。
- [x] `src/app/*` 只编排可见启动预热、数据变化失效与后台重缓存释放。
- [x] 不新增 shared 通用缓存框架，不修改产品 SQLite schema，不保留标题或网页隐私明细。

## 3. 状态契约

- [x] `bootstrap`：显示同日期、同 mapping/settings 身份的轻量快照，同时后台刷新。
- [x] `refreshing`：保留当前可信内容，不清空数组、不回退到空壳。
- [x] `ready`：显示本次新鲜查询结果。
- [x] `cold-loading`：没有任何可信快照时显示明确的 Quiet Pro 低噪声读取反馈，不显示假的 `0m`。
- [x] `empty`：只有成功查询确认无数据后才能进入。
- [x] `error`：有旧内容时保留旧内容；无内容时提供明确失败状态。
- [x] 不同日期的旧内容不得冒充目标日期。

## 4. 执行阶段

### 阶段 0：基线与失败防线

- [x] 记录当前工作区与相关性能基准事实。
- [x] 增加轻量快照校验、体积限制、隐私裁剪和失效测试。
- [x] 增加慢查询期间不清屏、冷态不伪装为空态的浏览器防线。
- [x] 修正 `perf:data-history-browser`，区分导航 active 与 History 有效内容状态。

### 阶段 1：轻量首屏快照

- [x] 新增 History bootstrap snapshot service，最多保留一个持久化槽位。
- [x] payload 上限 `256 KiB`，前端与 Rust 双侧校验。
- [x] 仅保存必要 session/web 时间字段；标题、title samples、URL、favicon 和图标全部裁剪。
- [x] 新增参数化 payload 读取、typed Rust 写入/清理命令并注册 IPC。
- [x] mapping、session 删除和其他相关数据失效事件清理该快照。

### 阶段 2：History SWR

- [x] 页面挂载优先读取内存、持久化 bootstrap 或同日 Dashboard 首屏数据。
- [x] 同日期 refresh 保留可见内容，使用 in-flight 合并与 generation 防旧请求覆盖。
- [x] 新鲜结果原位替换并异步保存裁剪后的 bootstrap。
- [x] 页面根节点暴露可测试的 content state/source。
- [x] 真冷态使用明确低噪声反馈，不再用空数组图表冒充稳定首屏。

### 阶段 3：首屏查询减负

- [x] Web Activity 关闭时完全跳过 Web segment、override 和 favicon 查询。
- [x] favicon 不再阻塞核心 History snapshot 完成。
- [x] weekly 路径继续不读取 title samples。
- [x] 标题详情改为核心首屏完成后的独立 enrichment，不改变详情正确性。

### 阶段 4：生命周期收口

- [x] 可见与隐藏启动只加载轻量 History bootstrap，不恢复重型 History 启动预热。
- [x] 长后台只清重型 snapshot/cache，轻量 bootstrap 保留。
- [x] 隐藏 autostart 不执行 History 重型 SQL。
- [x] 数据变化时同时失效重型与轻量快照。

### 阶段 5：验证与归档

- [x] 定向 TypeScript/Rust 测试通过。
- [x] `check:full` 全部组成门禁通过；最终复跑时沙箱内 Vite/Cargo 子进程曾出现 Windows `EPERM`，在沙箱外重跑对应门禁后通过。
- [x] `npm run perf:data-history-browser` 通过：History active p95 `87.1ms`，低于 `160ms` 预算；热有效内容 p95 `91.8ms`。
- [x] `npm run perf:stable` 的 History 读模型连续 `5/5` 通过；仓库级套件仅未改动的 Dashboard 最终 p95 `38.10–38.42ms` 略高于 `37.5ms` 预算，未改 Dashboard、未放宽预算并作为外部基准例外记录。
- [x] `npm run test:tauri-runtime-smoke` 通过。
- [x] 人为 `900ms` 慢查询下导航即时、有效内容不消失、正常同日入口不显示 loading；真冷态有明确反馈。
- [x] 浏览器回归 `35/35` 通过；前端生产构建、bundle、依赖审计通过；Rust `378` passed、`1` ignored。
- [x] 勾选全部完成项并移动到 `docs/archive/`。

### 阶段 6：对抗式审查

- [x] 从日期错配、午夜跨日、mapping/settings 失效、旧请求覆盖、payload 超限、持久化失败、Web disabled、长后台资源和 IPC 注册九个方向攻击实现。
- [x] 修复日期切换旧内容首帧、隐藏启动未预载轻快照、无 History 快照时未复用同日 Dashboard、迟到持久化读取、旧重查询复活缓存、未知网页字段隐私裁剪、save/clear 排序及保存元数据回写竞态。
- [x] 修复共享小时活动图先按 4 类绘制、绘制后测宽切到 6 类造成的局部闪烁，改为 paint 前完成响应式密度选择。
- [x] 重新运行受影响验证和最终门槛，无剩余确认问题。

## 5. 验收指标

- [x] 浏览器基准中导航 active p95 不高于现有 `160ms` 预算，实测 `87.1ms`。
- [x] 热缓存和长后台场景在慢查询期间持续处于 `bootstrap`、`refreshing` 或 `ready`，不进入空白占位。
- [x] 注入 `900ms` 查询延迟时，已有 History 内容不消失。
- [x] 无 History 快照但存在同日 Dashboard 数据时直接复用；完全无可信来源时首帧为 `cold-loading`，不显示正常空态或假 `0m`。
- [x] History bootstrap payload 不超过 `256 KiB`，且不含 title samples、窗口标题、URL、favicon 或图标数据。
- [x] 后台释放后重型 History cache 为 0，轻量 bootstrap 固定为最多 1 个槽位。
