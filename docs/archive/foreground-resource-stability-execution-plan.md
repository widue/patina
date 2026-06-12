# 前台长期资源稳定性执行归档

创建日期：2026-06-12

归档日期：2026-06-12

状态：completed / archived

文档类型：How-to 执行计划归档 / 可勾选执行记录

关联问题：Refs #15, #19

归档路径：`docs/archive/foreground-resource-stability-execution-plan.md`

## 0. 归档规则

- [x] 本文是一次性执行计划归档，不是长期 source of truth。
- [x] 已按执行结果勾选完成项。
- [x] 跳过项同样勾选，并在执行记录中写明原因。
- [x] 本轮不新增用户或开发者诊断导出能力；该能力后续单独设计隐私边界。
- [x] 本轮不主动请求 #15 / #19 用户补充数据。
- [x] 本轮不专门到 #15 / #19 下回复。
- [x] 本轮只用 `Refs #15, #19` 关联问题，不使用关闭类关键词。

## 1. 输入判断

- [x] #15 已提供：版本 `1.4.1` / `1.4.3` 中线程持续增长已有改善，但前台长时间打开时 Private Bytes、Working Set、Handle Count 和 CPU 仍可能失控。
- [x] #15 已提供：开启低耗后台后，只要主界面不长时间前台打开，资源占用能保持较低。
- [x] #19 已提供：版本 `1.5.1` 中电脑放置一天后打开不久 CPU 飙升并伴随卡顿。
- [x] 当前判断：#15 和 #19 作为同一条“长时间前台资源增长 / 失控”线索处理。
- [x] 当前判断：低耗后台缓解隐藏后的 UI WebView 常驻成本，不等价于解决前台常驻路径。
- [x] 当前判断：今天历史页时间轴可能增加 History 前台渲染压力，但不是当前最像主放大器的路径。
- [x] 当前优先处理：前台 tracker health polling 的叠加风险，以及每秒经由 WebView SQLite plugin 读取 heartbeat 的放大风险。

## 2. 执行边界

- [x] 不降低 Rust tracking runtime 的 1 秒前台窗口采样频率。
- [x] 不在主窗口前台可见时销毁主 WebView。
- [x] 不把低耗后台改成默认开启。
- [x] 不新增常驻诊断 UI、toast 或警告条。
- [x] 不新增资源诊断导出入口。
- [x] 不让页面组件直接访问 SQLite、Tauri `invoke` 或 Rust command。
- [x] 不让 Rust `commands/*`、`lib.rs` 或 `app/*` 承接厚业务逻辑。
- [x] 不把临时性能逻辑塞进 `shared/*`。

## 3. 执行前工作区

- [x] 执行前读取 `git status --short`。
- [x] 已识别并保护用户已有改动。
- [x] 已先将无关历史页 / 数据页改动单独提交并推送。
- [x] 已推送提交：`dd9b9bf Improve history preferences and bundle guardrails`。
- [x] 推送后本轮剩余工作区只保留资源稳定任务相关文件和执行计划文档。

执行前已有改动：

- `scripts/check-bundle-budget.ts`
- `src/features/data/components/Data.tsx`
- `src/features/history/components/History.tsx`
- `tests/historyTimelineViewModel.test.ts`
- `src/features/history/services/historyLayoutPreferenceStorage.ts`
- `docs/working/foreground-resource-stability-execution-plan.md`

## 4. 阶段 0：基线和证据整理

- [x] 整理 #15 / #19 已有问题证据。
- [x] 不向用户追加采样请求。
- [x] 不等待 issue 用户新增回复。
- [x] 明确系统级采样字段：Patina 主进程、WebView2 子进程树、timestamp、pid、parent pid、Private Bytes、Working Set、CPU、Handle Count、Thread Count。
- [x] 明确用户协助复现时默认不请求个人窗口标题、敏感路径、command line 或 WebView2 user data dir。
- [x] 记录现有内部 diagnostics 仅作为事实，不在本轮扩展导出。
- [x] 本轮 agent 会话未启动可见桌面窗口做人工资源短测，原因是避免擅自打扰当前桌面环境。
- [x] 人工资源短测保留为发版前验证或维护者空闲机器验证项，不阻塞本轮小修闭环。

## 5. 阶段 1：tracker health polling 防重入

目标：避免前台每秒 health 读取在 IPC 或 SQLite 卡顿时叠加，减少长时间前台运行时的放大风险。

- [x] 在 `src/app/services/trackerHealthPollingService.ts` 中新增 `refreshInFlight` 局部状态。
- [x] `refreshTrackerHealth()` 开头检查上一次刷新是否仍在进行。
- [x] 如果上一次刷新仍在进行，当前 tick 直接跳过。
- [x] 跳过 tick 不打印 warning。
- [x] `deps.loadSnapshot()` 前设置 `refreshInFlight = true`。
- [x] `finally` 中恢复 `refreshInFlight = false`。
- [x] 保留 `disposed` 判断，stop 后 pending refresh 不再落到 UI。
- [x] 保留 interval cleanup。
- [x] 不改变 `TRACKER_HEARTBEAT_POLL_MS`。
- [x] 不改变 Rust tracking runtime 采样频率。

验证：

- [x] 新增测试：首次 immediate refresh 未完成时，interval tick 不发起第二次 load。
- [x] 新增测试：pending refresh resolve 后，下一个 interval tick 可恢复 load。
- [x] 新增测试：pending refresh reject 后，下一个 interval tick 可恢复 load。
- [x] 新增测试：in-flight skip 不触发 warning。
- [x] 保留已有测试：启动立即刷新、interval 刷新、stop 后 pending refresh 不落 UI、load 失败 warning 且 cleanup 正常。
- [x] `npm run test:tracker-health` 通过。
- [x] `npm run test:ui-smoke` 通过。

## 6. 阶段 2：tracker health 改为 Rust 内存态读取

目标：前台 UI health 主路径不再每秒经由 WebView SQLite plugin 读取 heartbeat，优先读取 Rust runtime 内存态。

### 6.1 Rust runtime

- [x] 在 `src-tauri/src/engine/tracking/watchdog.rs` 中新增 `RuntimeHealthSnapshot`。
- [x] 在 `RuntimeHealthState` 中新增 `snapshot()` 只读方法。
- [x] snapshot 包含 `last_heartbeat_ms`。
- [x] snapshot 包含 `last_successful_sample_ms`。
- [x] snapshot 包含 `last_watchdog_seal_sample_ms`。
- [x] snapshot 只读 atomic，不访问 SQLite。
- [x] Rust health 判定保持在前端纯模型路径，不塞进 command。
- [x] Rust 单测覆盖初始为空、heartbeat、successful sample、watchdog seal 分离。

### 6.2 Tauri command

- [x] 在 `src-tauri/src/commands/tracking.rs` 新增 thin command：`cmd_get_tracker_health_snapshot`。
- [x] command 入参为空。
- [x] command 从 `AppHandle` state 获取 `Arc<RuntimeHealthState>`。
- [x] command 返回 serializable DTO。
- [x] command 不访问 SQLite。
- [x] command 不触发 foreground probe。
- [x] command 不触发 session transition。
- [x] 在 `src-tauri/src/app/bootstrap.rs` 中注册 managed state。
- [x] 在 `src-tauri/src/app/bootstrap.rs` 中注册 invoke handler。

### 6.3 前端 gateway 和 bootstrap

- [x] 在 `src/shared/types/tracking.ts` 新增 `TrackerHealthRuntimeSnapshot`。
- [x] 在 `src/platform/runtime/trackingRawDtos.ts` 新增 raw DTO、guard、mapper、parser。
- [x] 将 Rust `snake_case` 字段映射为前端 `camelCase`。
- [x] 在 `src/platform/runtime/trackingRuntimeGateway.ts` 新增 `getTrackerHealthRuntimeSnapshot()`。
- [x] gateway command 失败时返回 `null`，不打断 runtime subscriptions。
- [x] `src/app/services/appRuntimeBootstrapService.ts` 优先使用 runtime snapshot 计算 tracker health。
- [x] 旧 SQLite heartbeat 读取仅保留为兼容 fallback。
- [x] fallback 最多 warning 一次。
- [x] `trackerHealthPollingService` 默认路径不再直接导入 persistence health timestamp。
- [x] `useWindowTracking.ts` 不直接访问 platform persistence。

验证：

- [x] Frontend 单测覆盖 raw payload 映射。
- [x] Frontend 单测覆盖错误类型拒绝。
- [x] Frontend 单测覆盖 runtime health 优先于 stored heartbeat。
- [x] Frontend 单测覆盖 runtime 不可用时 fallback 到 stored heartbeat。
- [x] Source-level smoke 覆盖 polling service 不再直接导入 persistence。
- [x] Source-level smoke 覆盖 bootstrap 同时保留 runtime 主路径和 fallback。
- [x] `npm run test:tracker-health` 通过。
- [x] `npm run test:ui-smoke` 通过。
- [x] `npm run check:rust` 通过。
- [x] `npm run check:naming` 通过。
- [x] `npm run check:architecture` 通过。

## 7. 阶段 3：可见但未聚焦降频

- [x] 本阶段未实施。
- [x] 跳过原因：已有 issue 证据足以支持阶段 1 / 2 的低风险修复，但不足以安全改变“窗口可见但未聚焦”时的刷新体验。
- [x] 当前不改变 `isForegroundReady` 语义。
- [x] 当前不暂停可见窗口中的页面刷新。
- [x] 当前不新增 visible-idle 阈值。
- [x] 如果后续真实长跑仍显示 WebView2 renderer 在线性增长，再单独评估 visible-idle 降频。

## 8. 阶段 4：History / Data 前台渲染压力审计

- [x] 审计 `src/features/history/components/History.tsx` 中的 interval。
- [x] 确认 live duration interval 受 `refreshEnabled && hasLiveSession && trackerHealth.status === "healthy"` gate 约束。
- [x] 确认 live duration interval 有 cleanup。
- [x] 审计 History 中的 `window.addEventListener`。
- [x] 确认 calendar popover listener 只在 open 时存在并清理。
- [x] 确认 timeline details popover listener 只在 popover 存在时存在并清理。
- [x] 确认 `HistoryHorizontalTimeline` resize listener 已有 cleanup。
- [x] 未发现 History 中 unbounded listener 或 unbounded interval。
- [x] 审计 `src/features/data/components/Data.tsx` 的 `ResizeObserver` cleanup。
- [x] 确认 Data active chart date 走 ref-only 路径，避免 hover/mousemove 持续触发 render。
- [x] 确认 Data trend cache 和 heatmap session cache 有上限。
- [x] `npm run test:data` 通过。
- [x] 本阶段未做页面渲染小修，原因是未发现明显无界增长点。

未执行项：

- [x] 未做 100 / 500 / 1000 segments 的真实 render perf，原因是本轮主修复点已收敛到 tracker health 主路径，且未新增 History 渲染逻辑。
- [x] 未做 30 次真实页面切换的 WebView handle/thread 采样，原因是未启动可见桌面窗口；保留为发版前人工验证项。

## 9. 阶段 5：WebView / Tauri 生命周期实验

- [x] 本阶段未进入。
- [x] 跳过原因：阶段 1 / 2 已完成主路径修复，阶段 4 未发现明显页面泄漏，当前没有新的真实长跑数据证明仍需体验敏感的 WebView 生命周期实验。
- [x] 未在前台可见时销毁主 WebView。
- [x] 未默认关闭透明窗口。
- [x] 未默认禁用 GPU。
- [x] 未默认重建主窗口。
- [x] 未新增用户可见的“重载界面”入口。

## 10. 自动化验证记录

- [x] `cargo fmt --manifest-path src-tauri/Cargo.toml` 通过。
- [x] `npm run test:tracker-health` 通过。
- [x] `npm run test:ui-smoke` 通过。
- [x] `npm run test:data` 通过。
- [x] `npm run check:rust` 通过；沙箱内因 target 写入权限失败后，非沙箱重跑通过。
- [x] `npm run check:naming` 通过。
- [x] `npm run check:architecture` 通过。
- [x] `npm run check` 通过；沙箱内因 browser smoke spawn 权限失败后，非沙箱重跑通过。
- [x] `npm run check:full` 通过。
- [x] `npm run tauri build` 完成前端 production build、Rust release build、MSI 和 NSIS 产物生成。
- [x] `npm run tauri build` 最终因缺少 `TAURI_SIGNING_PRIVATE_KEY` 退出 1；这是本机签名环境缺失，不是代码编译错误。

## 11. 资源短测记录

| 场景 | 状态 | 结果 |
| --- | --- | --- |
| Dashboard 前台 3-5 分钟 | 未执行 | 未擅自启动可见桌面窗口；待发版前人工验证 |
| Dashboard / History / Data 连续切换各 3 次 | 未执行 | 未擅自启动可见桌面窗口；待发版前人工验证 |
| 托盘后台 3-5 分钟 | 未执行 | 未擅自启动可见桌面窗口；待发版前人工验证 |
| History 前台 5-10 分钟且当天有 live session | 未执行 | 依赖真实使用状态；待发版前或自然反馈 |
| 2 小时 / 8 小时长跑 | 未执行 | 可选长跑；不阻塞本轮小修完成 |

结论：

- [x] 本轮完成代码层面的主放大路径修复和自动化验证。
- [x] 本轮不宣称已完成真实长跑资源曲线验证。
- [x] 长跑和可见窗口短测保留为发版前验证或后续自然反馈输入。

## 12. 完成标准

- [x] 前台 tracker health polling 不再叠加未完成读取。
- [x] 前台 tracker health 主路径不再每秒经由 WebView SQLite plugin 读取 heartbeat。
- [x] History / Data 页面未发现 unbounded listener、interval、observer 或 cache。
- [x] 未实施可见未聚焦降频，因此无需验证重新聚焦恢复逻辑。
- [x] `npm run check` 通过。
- [x] `npm run check:full` 通过。
- [x] #15 / #19 只保留 `Refs #15, #19` 关联。
- [x] 未专门回复 issue。
- [x] 未新增用户数据请求。
- [x] 已记录未执行的人工资源短测和长跑风险。
- [x] 本文已归档。

## 13. 剩余风险

- [x] 尚未用当前构建执行真实桌面窗口的 3-5 分钟资源短测。
- [x] 尚未用当前构建执行 2 小时或 8 小时长跑。
- [x] 若后续仍出现 WebView2 renderer Private Bytes 持续线性增长，需要重新进入 visible-idle 降频或 WebView 生命周期实验评估。
- [x] 若后续主进程 Handle Count 或 Thread Count 仍持续增长，需要转向 Rust / Windows resource owner 排查。
- [x] 若后续 CPU 仍在无交互前台长期高占用，需要结合页面级 render perf 和 DevTools heap / detached DOM 观察。

## 14. 回滚策略

- [x] 若 polling 防重入导致 health 刷新异常，移除 `refreshInFlight` guard 并恢复对应测试预期。
- [x] 若 runtime health command 在旧环境中不可用，保留 SQLite fallback；当前已具备 fallback。
- [x] 若 runtime health command 本身有问题，可暂时让 bootstrap 只走旧 stored heartbeat 路径，同时保留 command 兼容。
- [x] 若后续实现 visible-idle 降频并造成体验退化，应只回滚降频，不回滚阶段 1 / 2。

## 15. 最终文件清单

- [x] `src/app/services/trackerHealthPollingService.ts`
- [x] `src/app/services/appRuntimeBootstrapService.ts`
- [x] `src/platform/runtime/trackingRuntimeGateway.ts`
- [x] `src/platform/runtime/trackingRawDtos.ts`
- [x] `src/shared/types/tracking.ts`
- [x] `src-tauri/src/engine/tracking/watchdog.rs`
- [x] `src-tauri/src/commands/tracking.rs`
- [x] `src-tauri/src/app/bootstrap.rs`
- [x] `tests/trackerHealthPollingService.test.ts`
- [x] `tests/uiSmoke.test.ts`
- [x] `docs/archive/foreground-resource-stability-execution-plan.md`
