# 前台探测自恢复执行归档

## 文档状态

- [x] 状态：已执行并归档
- [x] Owner：Rust tracking runtime + Windows platform boundary
- [x] 关联问题：Refs #13、#15
- [x] 当前基线：`main` 已包含 PR #16 的 `spawn_blocking` in-flight guard 止血修复
- [x] 本文已从 `docs/working/` 移入 `docs/archive/`
- [x] UI 决策遵循 Quiet Pro：短异常静默恢复，长期 hard degraded 复用现有红色状态灯

## 执行结论

- [x] 已在 PR #16 基线之上实现 in-process 有界恢复。
- [x] 已补齐 runtime probe 诊断字段，并通过 Tauri command、本地 API、前端 DTO 映射到 model。
- [x] 已保持短暂 `timeout-fallback` / `backing-off-fallback` 静默，不新增 toast、横幅或页面诊断区。
- [x] 已在 `hard-degraded-*` 时复用 widget 现有 `statusTone: "error"` 与红色状态灯。
- [x] 已验证 fallback / recovery / hard degraded 不算 successful sample，因此不会在未知前台期间写入新的 session transition。
- [x] 本轮未引入 sidecar/helper；旧 helper 风险不复活。

## 已完成改动

### Rust runtime

- [x] `src-tauri/src/engine/tracking/runtime/window_polling.rs`
  - [x] 将简单 in-flight bool 扩展为 generation-based probe state。
  - [x] 记录 `last_successful_sample_at_ms`、`fallback_started_at_ms`、fallback 计数、连续 fallback 计数、恢复尝试计数、最近恢复尝试时间。
  - [x] 保留 cached fallback / inactive fallback 行为。
  - [x] 连续 fallback 超过 10 秒后才尝试 recovery。
  - [x] recovery 尝试之间至少间隔 30 秒。
  - [x] 同一进程最多允许 2 个 detached stuck probe。
  - [x] 超过 detached 上限或 fallback 超过 60 秒进入 hard degraded。
  - [x] old generation late completion 不能清掉新 generation 的 active marker。
  - [x] recovery 成功会刷新 last successful window 并重置连续 fallback / detached 状态。

- [x] `src-tauri/src/engine/tracking/runtime_snapshot.rs`
  - [x] 新增 `TrackingRuntimeProbeDiagnostics`。
  - [x] 新增 `recovery-attempted-*` 与 `hard-degraded-*` probe status。
  - [x] runtime snapshot 输出 probe diagnostics。

- [x] `src-tauri/src/engine/tracking/runtime.rs`
  - [x] 将 `WindowPollOutcome` 的 probe diagnostics 写入 `TrackingRuntimeSnapshotState`。

- [x] `src-tauri/src/commands/tracking.rs`
  - [x] `get_current_tracking_snapshot` 返回 probe diagnostics。

- [x] `src-tauri/src/app/local_api.rs`
  - [x] local API snapshot 返回 probe diagnostics。
  - [x] local API 仍只读 runtime snapshot，不触发额外 foreground probe。

### Frontend runtime/model

- [x] `src/shared/types/tracking.ts`
  - [x] 扩展 `TrackingRuntimeProbeStatus`。
  - [x] 新增 `TrackingRuntimeProbeDiagnostics` model。
  - [x] 更新 `isCurrentTrackingSnapshot` guard，缺失新字段时保持兼容。

- [x] `src/platform/runtime/trackingRawDtos.ts`
  - [x] 扩展 raw DTO。
  - [x] 更新 raw guard。
  - [x] 映射 `snake_case` diagnostics 到 `camelCase` model。

- [x] `src/app/services/appRuntimeBootstrapService.ts`
  - [x] bootstrap snapshot 返回 `trackingRuntimeProbeStatus`。

- [x] `src/app/hooks/useWindowTracking.ts`
  - [x] 统一维护 `trackingRuntimeProbeStatus`。
  - [x] bootstrap、active-window sync、tracking-data-changed refresh 均同步 probe status。

- [x] `src/app/hooks/trackingDataChangedRuntime.ts`
  - [x] full tracking snapshot refresh 时同步 probe status。

### Widget UI

- [x] `src/app/widget/widgetViewModel.ts`
  - [x] `timeout-fallback` / `backing-off-fallback` / `recovery-attempted-*` 不切换到 error。
  - [x] `hard-degraded-fallback` / `hard-degraded-inactive` 切换到既有 error view model。
  - [x] 复用现有 `异常` 与 `追踪状态暂时未同步` 文案。

- [x] `src/app/widget/WidgetShell.tsx`
  - [x] 传入 `trackingRuntimeProbeStatus`。
  - [x] 复用现有 `widget-status-lamp-error`，未新增样式。

## 已完成测试

- [x] Rust window polling 单测覆盖：
  - [x] timeout 后返回 cached fallback。
  - [x] timeout 且无缓存时返回 inactive fallback。
  - [x] in-flight 时不重复创建普通 probe。
  - [x] successful probe 更新 cache。
  - [x] 长时间 in-flight 后触发有界 recovery。
  - [x] detached stuck probe 到上限后进入 hard degraded。

- [x] Frontend/runtime 单测覆盖：
  - [x] raw payload guard 接受 `hard-degraded-*` 与 probe diagnostics。
  - [x] raw payload guard 拒绝未知 probe status。
  - [x] 缺失新字段时保持兼容。
  - [x] tracking-data-changed refresh 同步 probe status。

- [x] Widget view model 测试覆盖：
  - [x] healthy active tracking 显示正常记录。
  - [x] short fallback 保持静默，不切 error。
  - [x] tracker stale 继续使用现有 error 红灯。
  - [x] hard degraded 使用现有 error 红灯。
  - [x] hard degraded 不崩溃。

## 验证命令

- [x] `npm run check:rust`
  - [x] Rust boundary check passed。
  - [x] `cargo check` passed。
  - [x] 172 Rust tests passed。
  - [x] `cargo clippy -- -D warnings` passed。

- [x] `npm test`
  - [x] 90 tracking lifecycle tests passed。

- [x] `npm run test:replay`
  - [x] 14 tracking replay tests passed。

- [x] `npm run test:widget`
  - [x] 13 widget view model tests passed。

- [x] `npm run build`
  - [x] `tsc` passed。
  - [x] Vite production build passed。
  - [x] 首次沙箱内执行因 esbuild `spawn EPERM` 失败，已按权限规则在沙箱外重跑通过。

- [x] `npm run test:ui-smoke`
  - [x] 13 UI smoke tests passed。
  - [x] 首次沙箱内执行因 esbuild `spawn EPERM` 失败，已按权限规则在沙箱外重跑通过。

- [x] `npm run test:ui-browser-smoke`
  - [x] 19 browser UI smoke tests passed。
  - [x] 首次沙箱内执行因 Vite/esbuild `spawn EPERM` 失败，已按权限规则在沙箱外重跑通过。

- [x] `npm run check`
  - [x] naming boundary passed。
  - [x] architecture boundary passed。
  - [x] frontend aggregate check passed。
  - [x] 首次沙箱内执行因 esbuild `spawn EPERM` 失败，已按权限规则在沙箱外重跑通过。

- [x] `npm run check:full`
  - [x] `npm run check` passed。
  - [x] `npm run check:rust` passed。

## 未执行项

- [ ] 2 小时 / 8 小时 / 24 小时 PerfMon 长跑未在本轮执行。
  - 原因：当前任务在本轮内完成实现与自动化验证；真实长跑需要实际使用窗口和等待时间。
  - 建议：发布前用 #15 同类计数器追加一次 8-24 小时长跑。

- [ ] 本地安装包 smoke 未在本轮执行。
  - 原因：本次未改 Tauri sidecar、installer 或 updater 配置。
  - 建议：进入 release 前按现有发布流程执行。

- [ ] Sidecar/helper proof 未执行。
  - 原因：本轮采用 in-process 有界恢复，未引入 helper。
  - 保留条件：如果后续真实长跑仍证明 Windows API 可永久卡死并使 in-process 恢复不足，再单独开启窄 sidecar proof。

## 验收状态

- [x] 正常路径下前台计时准确性不低于 PR #16 基线。
- [x] probe timeout 不会无限创建后台任务。
- [x] probe hang 有 recovery 尝试上限，不会无限增长 detached blocking tasks。
- [x] probe hang 期间 fallback / recovery / hard degraded 不算 successful sample。
- [x] probe hang 后不会把后续未知时间错误记到旧 app 的新 transition。
- [x] probe 恢复后后续采样恢复正常。
- [x] hard degraded 时 UI 有最小可见信号，复用现有红色状态灯。
- [x] Dashboard / History stale live session 保护仍由 tracker health/read model 测试覆盖。
- [x] local API 不额外触发 foreground probe。

## 后续观察

- [ ] 发布前建议追加 8-24 小时 PerfMon 长跑。
- [ ] 如果真实长跑仍出现永久采样不可恢复，再开启窄 foreground probe sidecar proof。
- [ ] 不应把旧的宽泛 helper 实验直接复活。
