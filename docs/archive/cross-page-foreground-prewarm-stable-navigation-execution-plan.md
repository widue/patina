# 跨页面前台预热、稳定首屏与后台资源节制执行方案

状态：已完成，已归档  
创建日期：2026-06-05  
文档类型：How-to 执行计划 / 可勾选执行单  
目标读者：后续实现者、代码审查者、回归验证者  
关联背景：延续 Data 页面前台预热与无可见 loading 规则；Refs #13  
存放位置：`docs/working/`。完成后应移动到 `docs/archive/`。

## 1. 最终目标与成功定义

最终目标不是“把所有 loading 都删掉”，也不是“给每个页面都复制一套 Data 实现”。

最终目标是：

- [ ] 核心页面打开和切换时始终即时，不因为数据读取、预热或后台刷新而阻塞导航。
- [ ] 浏览型页面在常规路径保持稳定可读，不闪白、不闪空、不用 loading/skeleton 撑场。
- [ ] 真实数据优先；真实数据未返回时，使用最近内容、轻量快照或 Quiet Pro 静态结构过渡。
- [ ] 旧内容不能误导用户，尤其不能把旧日期、旧 mapping、旧 settings 当成当前数据。
- [ ] 操作型页面保留明确反馈，保存、恢复、下载、删除、安装、测试连接等用户主动操作不能静默。
- [ ] 后台运行时不持续重算不可见页面，降低长期 CPU、内存、线程和句柄累计风险。
- [ ] 热 cache 用于短时间返回体验，但必须有上限、失效规则和释放出口。
- [ ] 实现落在真实 owner 内，`AppShell` 只做薄编排，`shared/*` 和 `platform/*` 不承接页面私有逻辑。
- [ ] 形成可测试、可回归、可维护的页面生命周期口径。

成功定义：

- [ ] `Dashboard / History / Data` 作为浏览型主路径，常规导航和刷新不出现可见等待态。
- [ ] `Classification / Settings / Update / Remote Backup` 作为操作型主路径，初始打开尽量稳定，但操作中的 busy/progress/error 反馈完整保留。
- [ ] 后台不可见时不重算不可见页面的大 read model。
- [ ] 后台超过延迟后释放浏览型页面大 cache。
- [ ] `npm run check` 通过；如触及 Rust/schema/release，再按本文追加验证。

## 2. 本轮目标

- [ ] 将 Data 页面沉淀出的“立即导航、稳定首屏、前台温和预热、后台节制刷新、后台延迟释放、有界缓存”规则推广到其他页面。
- [ ] 优先覆盖浏览型高频页面：`Dashboard` 与 `History`。
- [ ] 谨慎覆盖操作型页面：`Classification / App Mapping`、`Settings`、`Update`、`Remote Backup`，只套用适合的部分规则。
- [ ] 将 `About` 拆成静态信息区和 Update 操作区判断：静态信息区可按浏览型处理，Update 操作区按操作型处理。
- [ ] 点击主导航必须立即切页，不因为页面数据加载、缓存读取、预热或后台刷新而阻塞。
- [ ] 浏览型页面常规路径尽量不出现整页 loading、局部 loading、skeleton、spinner、shimmer 或“加载中”文案。
- [ ] 操作型页面必须保留用户主动操作期间的明确忙碌反馈，例如保存、备份、恢复、下载、安装、测试连接、删除历史。
- [ ] 前台窗口打开后温和准备高频页面内容；后台冷启动不执行重型页面查询。
- [ ] tracking data changed、settings changed、mapping changed 等事件只刷新当前需要的页面，不默认重算所有页面。
- [ ] 后台短时间保留热 cache；后台较长时间后释放页面大 cache，但保留必要的小 bootstrap/cache。
- [ ] 所有新增缓存必须有 owner、上限、失效规则、清理出口和测试覆盖。
- [ ] 不把页面私有预热、快照、view model 计算塞进 `AppShell.tsx`、`shared/*` 或 `platform/*`。
- [ ] 验证链覆盖“立即切页”“浏览型页面常规路径无可见 loading”“操作型页面保留操作反馈”“后台不重算不可见页面”“后台释放大 cache”“缓存上限有效”。

## 3. 适用范围判断

### 3.1 可以完整套用的页面类型

- [ ] 浏览型页面。
- [ ] 页面主要职责是展示已有数据、统计、图表、列表或状态。
- [ ] 页面可以接受先显示最近内容或轻量快照，再由真实数据静默替换。
- [ ] 页面没有用户正在编辑的未保存草稿。
- [ ] 页面没有正在执行的危险操作或长耗时操作。

当前优先候选：

- [ ] `Dashboard`
- [ ] `History`
- [ ] `About` 的静态版本信息区域，不包含更新检查、下载或安装操作。

### 3.2 只能部分套用的页面类型

- [ ] 操作型页面。
- [ ] 页面包含保存、删除、恢复、下载、上传、安装、测试连接、清理历史等用户主动操作。
- [ ] 页面存在未保存草稿或确认流程。
- [ ] 页面展示旧快照可能误导用户以为当前操作已经完成。

当前谨慎候选：

- [ ] `Classification / App Mapping`
- [ ] `Settings`
- [ ] `Update` 操作区
- [ ] `Remote Backup`

### 3.3 明确不套用“无可见 loading”的场景

- [ ] 设置保存中。
- [ ] App Mapping 保存中。
- [ ] 分类候选删除中。
- [ ] 本地备份导出中。
- [ ] 备份恢复预览、确认、恢复中。
- [ ] WebDAV 配置加载、连接测试、上传、下载、恢复中。
- [ ] 更新检查、下载、安装中。
- [ ] 清理历史记录中。
- [ ] 首次安装且真实数据确认为空之后的正常空态。
- [ ] 错误、重试、权限失败、网络失败等需要明确解释的状态。

这些场景的 loading 是操作反馈，不是导航等待态。不能为了“无 loading”把用户主动操作变成无反馈。

## 4. 统一体验规则

### 4.1 立即导航

- [ ] 主导航点击后，`currentView` 立即更新。
- [ ] Lazy chunk 未加载时可以显示 app 级别极短 fallback，但不得等待数据查询完成才切页。
- [ ] 已预载的主页面不应在常规路径出现 app 级整页 loading。
- [ ] 页面数据加载只能影响页面内部内容，不能影响导航 active 状态。
- [ ] 浏览器 smoke 必须覆盖至少 Dashboard、History、Data、Classification、Settings 的导航即时性。

### 4.2 浏览型页面可见内容优先级

浏览型页面常规路径按以下顺序选择可见内容：

1. [ ] 当前真实数据。
2. [ ] 当前页面最近一次可见内容。
3. [ ] 当前页面 feature-owned cache 或 bootstrap snapshot。
4. [ ] Quiet Pro 低噪声静态结构。
5. [ ] 确认真实无数据后的正常空态。
6. [ ] 查询失败后的低噪声错误 / 重试状态。

约束：

- [ ] 不把空数组构建出的图表当成“加载期间默认首屏”。
- [ ] 不在真实刷新开始时清空旧图表、旧列表或旧统计。
- [ ] 不用 skeleton、spinner、shimmer 伪装数据准备过程。
- [ ] 真实数据回来后必须替换旧快照或最近可见内容。
- [ ] 旧快照必须通过时间、日期、语言、mappingVersion、settingsVersion 或等价 key 判断是否适合展示。

### 4.3 操作型页面反馈规则

- [ ] 页面初次打开可使用 bootstrap cache 避免整页 loading。
- [ ] 保存、删除、恢复、下载、上传、安装、清理等操作必须保留按钮 disabled、进度、状态文本或对话框反馈。
- [ ] 未保存草稿不能被后台刷新覆盖。
- [ ] 正在编辑的字段不能因为预热或 refresh 被重置。
- [ ] 后台真实数据刷新只能更新非草稿、非进行中操作的区域。
- [ ] 如果旧 bootstrap 与最新持久化设置冲突，应优先保护用户草稿，再提示或静默同步非编辑区域。

### 4.4 后台节制

- [ ] 应用后台冷启动但主窗口不可见时，不触发页面重型读模型预热。
- [ ] 窗口进入前台后，延迟触发温和预热。
- [ ] 窗口隐藏、最小化到托盘或文档不可见时，不继续触发浏览型页面重查询。
- [ ] 后台短时间内不清 cache，避免用户立刻返回时体验退化。
- [ ] 后台超过延迟后释放大 cache，只保留小 bootstrap、必要设置 cache 和已加载代码。
- [ ] 恢复前台时取消 pending cleanup，并安排温和预热。

### 4.5 缓存与兼容规则

- [ ] 缓存是性能辅助，不是用户数据。
- [ ] 不为缓存设计 V1/V2/V3 迁移路线。
- [ ] 结构变化时通过字段校验、key 变化或缓存清理让旧缓存失效并重建。
- [ ] 所有缓存必须限制体积或数量。
- [ ] 所有缓存必须有清理出口。
- [ ] 所有缓存必须留在真实 owner 内，不放进 `shared/*` 临时公共桶。

## 5. 非目标

- [ ] 不新增通用“大一统页面生命周期框架”，除非后续阶段证明重复复杂度真实存在。
- [ ] 不把所有页面都改成 Data 的实现方式。
- [ ] 不取消用户主动操作期间的 loading 或进度反馈。
- [ ] 不改变 tracking runtime、SQLite schema、migration 或 Rust command。
- [ ] 不新增聚合表或新的跨页面数据仓库。
- [ ] 不把 page read model 计算塞进 `AppShell.tsx`。
- [ ] 不把 feature 私有 cache 挪进 `shared/*`。
- [ ] 不为了隐藏 loading 展示错误、过期到误导用户的数据。
- [ ] 不让 README、release、changelog 或开源维护文档混入本轮功能实现范围。
- [ ] 不把本执行单升级为产品新方向；它只是核心页面体验打磨。

## 6. 当前代码事实

### 6.1 已有可复用基础

- [x] `src/app/services/startupWarmupService.ts` 已有启动 warmup 编排。
- [x] `src/app/services/viewChunkPreloadService.ts` 已有主页面 chunk preload。
- [x] `src/platform/desktop/windowControlGateway.ts` 已能读取/监听窗口 visible 与 focus。
- [x] `src/app/AppShell.tsx` 已能基于 document visible 与 window foreground-like 控制 Data prewarm 与后台 cleanup。
- [x] `Dashboard` 已有 `dashboardSnapshotCache.ts`。
- [x] `History` 已有 `historySnapshotCache.ts`。
- [x] `Data` 已有 `dataBootstrapSnapshot.ts`、`dataFirstScreenPrewarm.ts`、`dataCacheLifecycle.ts`。
- [x] `Settings` 已有 `settingsBootstrapCache.ts` 与 `settingsBootstrapService.ts`。
- [x] `Classification` 已有 `classificationBootstrapCache.ts` 与 bootstrap prewarm。
- [x] `About` 当前复用 settings bootstrap 获取版本信息。

### 6.2 已知待处理现象

- [ ] `History` 初始无 cache 时仍会渲染 `UI_TEXT.history.loading`。
- [ ] `History` 切换日期或慢查询期间可能在局部区域显示 loading 文案。
- [ ] `Dashboard` 依赖 hook 初次加载，需确认是否存在可见空白或指标闪动。
- [ ] `Classification / App Mapping` 初始无 bootstrap 时显示 `UI_TEXT.mapping.loading`。
- [ ] `Settings` 初始无 bootstrap 时显示 `UI_TEXT.settings.loading`。
- [ ] `About` 初始无版本 bootstrap 时显示 `UI_TEXT.settings.loading`。
- [ ] `Remote Backup` 与 `Update` 存在合理的操作 loading，不能直接移除。
- [ ] Dashboard/History cache 当前需要复查是否有上限和后台释放出口。

## 7. Owner 判断

### 7.1 App 层 owner

- [ ] `src/app/AppShell.tsx`
  - [ ] 只负责读取窗口/文档前台状态。
  - [ ] 只负责按页面可见性触发 feature-owned prewarm。
  - [ ] 只负责按后台延迟调用 feature-owned cleanup。
  - [ ] 不构建 Dashboard、History、Data、Classification、Settings 的 view model。
  - [ ] 不直接读写 feature cache。

- [ ] `src/app/services/startupWarmupService.ts`
  - [ ] 负责启动 warmup、runtime-ready 后 warmup、tracking refresh 编排。
  - [ ] 默认只预热高频且可解释的轻量页面数据。
  - [ ] 如果新增 `includeHistory`、`includeDashboard`、`includeClassification` 等选项，必须保持薄编排。
  - [ ] 不承接页面私有缓存规则。

### 7.2 Feature owner

- [ ] `src/features/dashboard/*`
  - [ ] 拥有 Dashboard snapshot cache、read model、可见 fallback、cache cleanup。

- [ ] `src/features/history/*`
  - [ ] 拥有 History snapshot cache、日期切换 fallback、timeline 可见状态、cache cleanup。

- [ ] `src/features/data/*`
  - [ ] 继续保持 Data 现有规则，不回退。

- [ ] `src/features/classification/*`
  - [ ] 拥有 App Mapping bootstrap、草稿保护、候选列表 refresh、保存操作 loading。

- [ ] `src/features/settings/*`
  - [ ] 拥有 Settings bootstrap、草稿保护、保存/备份/恢复/清理/WebDAV 操作 loading。

- [ ] `src/features/about/*`
  - [ ] 拥有 About 静态版本区域 fallback；Update 操作状态由 update owner 保持明确反馈。

### 7.3 Platform owner

- [ ] `src/platform/desktop/*`
  - [ ] 只封装窗口状态、Tauri window API 等平台事实。
  - [ ] 不引用任何 feature。

- [ ] `src/platform/persistence/*`
  - [ ] 只封装持久化 settings / SQLite key-value / repository 边界。
  - [ ] 不构建页面 view model。

## 8. 阶段 0：盘点与分类

目标：先确认每个页面属于浏览型还是操作型，记录当前 loading、cache、refresh、cleanup 状态。

### 8.1 文件盘点

- [ ] 搜索所有用户可见 loading 文案：
  - [ ] `UI_TEXT.history.loading`
  - [ ] `UI_TEXT.settings.loading`
  - [ ] `UI_TEXT.mapping.loading`
  - [ ] `uiText.app.loadingView`
  - [ ] `loading`
  - [ ] `skeleton`
  - [ ] `spinner`
  - [ ] `aria-busy`

- [ ] 盘点页面组件：
  - [ ] `src/features/dashboard/components/Dashboard.tsx`
  - [ ] `src/features/history/components/History.tsx`
  - [ ] `src/features/data/components/Data.tsx`
  - [ ] `src/features/classification/components/AppMapping.tsx`
  - [ ] `src/features/settings/components/Settings.tsx`
  - [ ] `src/features/about/components/About.tsx`
  - [ ] `src/features/update/*`

- [ ] 盘点页面 hook：
  - [ ] `src/features/dashboard/hooks/useDashboardStats.ts`
  - [ ] `src/features/history/components/History.tsx` 内部加载 effect
  - [ ] `src/features/classification/hooks/useAppMappingState.ts`
  - [ ] `src/features/settings/hooks/useSettingsPageState.ts`
  - [ ] `src/features/settings/hooks/useRemoteBackupState.ts`

- [ ] 盘点 cache 和 prewarm：
  - [ ] `dashboardSnapshotCache.ts`
  - [ ] `historySnapshotCache.ts`
  - [ ] `dataBootstrapSnapshot.ts`
  - [ ] `dataFirstScreenPrewarm.ts`
  - [ ] `settingsBootstrapCache.ts`
  - [ ] `classificationBootstrapCache.ts`
  - [ ] `startupWarmupService.ts`

### 8.2 结果记录

- [ ] 在本文 `20. 执行记录` 中记录每个页面：
  - [ ] 页面类型。
  - [ ] 是否允许常规路径无 visible loading。
  - [ ] 当前已有 cache。
  - [ ] 是否需要新增 cache 上限。
  - [ ] 是否需要新增 cleanup。
  - [ ] 哪些 loading 必须保留。
  - [ ] 最小可行改动。

### 8.3 阶段 0 验收

- [ ] 页面分类完成。
- [ ] 不再笼统写“其他页面都套 Data 规则”。
- [ ] 每个页面有明确适用规则和禁止规则。
- [ ] 没有开始实现代码改动。

## 9. 阶段 1：沉淀跨页面决策口径

目标：先把规则变成实现判断口径，而不是马上抽象公共框架。

### 9.1 新增或更新测试辅助口径

- [ ] 在 UI smoke 中新增静态断言辅助函数，例如：
  - [ ] 检查浏览型页面组件是否仍直接渲染 forbidden loading 文案。
  - [ ] 检查操作型页面仍保留保存/恢复/下载等 busy 文案。
  - [ ] 检查 `AppShell.tsx` 没有新增 read model 计算。

- [ ] 不新增 production 级通用 lifecycle registry。
- [ ] 不新增跨 feature 的 `shared/pageLifecycle`。
- [ ] 如确实需要共享测试 helper，放在 `tests/*` 内。

### 9.2 规则落点

- [ ] 本轮执行期间，规则先保留在本文。
- [ ] 如果执行后确认成为长期规则，再回写到：
  - [ ] `docs/engineering-quality.md` 的性能/验证规则。
  - [ ] `docs/quiet-pro-component-guidelines.md` 的 loading/empty/busy 规则。
  - [ ] 或 `docs/issue-fix-boundary-guardrails.md` 的稳定期 UI 修复规则。

### 9.3 阶段 1 验收

- [ ] 后续阶段有明确检查口径。
- [ ] 没有提前制造跨页面生产抽象。
- [ ] 文档中已区分导航 loading、浏览 loading、操作 loading、错误/空态。

## 10. 阶段 2：AppShell 与 warmup 编排收口

目标：让 App 层只做前台/后台编排，不做页面业务计算。

### 10.1 前台状态复用

- [ ] 复用现有 `isDocumentVisible`。
- [ ] 复用现有 `isWindowForegroundLike`。
- [ ] 所有前台预热条件统一使用：
  - [ ] `classificationReady`
  - [ ] `isDocumentVisible`
  - [ ] `isWindowForegroundLike`

- [ ] 前台预热延迟继续保持温和，不抢 Dashboard 首屏。
- [ ] 如果新增跨页面 prewarm timer，必须：
  - [ ] 可取消。
  - [ ] unmount 时清理。
  - [ ] 前后台切换时不累积。
  - [ ] pending 去重。

### 10.2 warmup 任务边界

- [ ] `startupWarmupService.ts` 默认 warmup 保持轻量。
- [ ] 不恢复启动时重型 Data warmup。
- [ ] Dashboard/History 已在默认 warmup 中存在时，复查是否仍合理：
  - [ ] Dashboard 今天 snapshot 可保留。
  - [ ] History 今天/近 7 天 snapshot 可保留。
  - [ ] 不新增历史全范围预热。
  - [ ] 不新增 Dashboard 多日重算。

- [ ] `scheduleStartupWarmupRefresh()` 只刷新可见或明确请求的页面：
  - [ ] 默认刷新 Dashboard 与 History 的现有高频路径是否仍必要。
  - [ ] Data 继续只在 `includeData: true` 时刷新。
  - [ ] 如新增选项，命名必须表达语义，例如 `includeDashboard`, `includeHistory`。

### 10.3 后台 cleanup 编排

- [ ] 现有 Data 后台 10 min cleanup 保持。
- [ ] 评估是否新增 `clearDashboardHeavyCaches()`。
- [ ] 评估是否新增 `clearHistoryHeavyCaches()`。
- [ ] AppShell 只能调用 feature cleanup 出口。
- [ ] cleanup 执行前再次检查窗口仍非前台。
- [ ] 恢复前台取消 pending cleanup。

### 10.4 阶段 2 验收

- [ ] AppShell 仍是薄编排。
- [ ] 没有页面 view model 构建进入 AppShell。
- [ ] 前台预热不会在后台冷启动触发。
- [ ] 后台 cleanup 不会清除用户草稿或操作状态。
- [ ] `tests/startupWarmupService.test.ts` 覆盖新增 warmup/refresh 选项。
- [ ] `tests/uiSmoke.test.ts` 覆盖 AppShell owner 边界。

## 11. 阶段 3：Dashboard 套用规则

目标：Dashboard 保持首页可信与稳定，不因刷新显示等待态或闪空。

### 11.1 现状复核

- [ ] 阅读 `src/features/dashboard/hooks/useDashboardStats.ts`。
- [ ] 阅读 `src/features/dashboard/components/Dashboard.tsx`。
- [ ] 阅读 `src/features/dashboard/services/dashboardSnapshotCache.ts`。
- [ ] 确认初次无 snapshot 时 Dashboard 当前显示什么。
- [ ] 确认 refreshKey 更新时是否会清空已有 stats。
- [ ] 确认 tracker stale/error 是否会被旧 snapshot 掩盖。

### 11.2 可见内容规则

- [ ] Dashboard 常规路径优先显示当前真实 snapshot。
- [ ] 刷新期间保留最近一次可见 snapshot。
- [ ] 有 cache 时初始显示 cache。
- [ ] 无 cache 且无真实数据时显示 Quiet Pro 静态结构或真实空态，不显示醒目 loading。
- [ ] tracker stale/error 相关状态不得被旧 snapshot 隐藏。
- [ ] 今日日期变化时，旧日期 snapshot 只能短暂作为视觉稳定兜底，真实刷新回来后必须替换。

### 11.3 cache 上限与清理

- [ ] 为 `dashboardSnapshotCache.ts` 增加明确上限。
- [ ] 建议初始上限：`2` 到 `3` 个 date key。
- [ ] 访问 cache 时 touch LRU。
- [ ] 写入 cache 时淘汰最旧 key。
- [ ] 新增 `clearDashboardSnapshotCache()`。
- [ ] 如 Dashboard cache 包含大 sessions 数组，新增 `clearDashboardHeavyCaches()` 或等价 feature cleanup 出口。
- [ ] 后台延迟 cleanup 可以清 Dashboard 大 cache，但不清 settings/classification bootstrap。

### 11.4 预热策略

- [ ] 前台打开后可预热 Dashboard 今天 snapshot。
- [ ] 如果 Dashboard 是默认首屏，启动 warmup 已覆盖时不重复预热。
- [ ] tracking data changed 时，如果当前 view 是 Dashboard 且窗口前台，允许刷新 Dashboard。
- [ ] 当前 view 不是 Dashboard 时，不为了 Dashboard 单独重算重型 read model，除非已有 startup warmup 策略明确允许。

### 11.5 测试

- [ ] 新增或复用现有测试文件覆盖 Dashboard cache 上限。
- [ ] `tests/uiSmoke.test.ts` 静态确认 Dashboard 没有新增 forbidden loading。
- [ ] `tests/uiBrowserSmoke.test.ts` 覆盖 Dashboard 首屏没有整页 loading。
- [ ] `tests/uiBrowserSmoke.test.ts` 覆盖从其他页面回 Dashboard active nav 立即更新。

### 11.6 阶段 3 验收

- [ ] Dashboard 导航即时。
- [ ] Dashboard 常规刷新不闪空。
- [ ] Dashboard cache 有上限。
- [ ] Dashboard 后台 cleanup 有 feature-owned 出口或明确说明无需新增。
- [ ] Dashboard 不掩盖 tracker stale/error。

## 12. 阶段 4：History 套用规则

目标：History 打开和切换日期时保持稳定内容，不用 loading 文案作为常规等待态。

### 12.1 现状复核

- [ ] 阅读 `src/features/history/components/History.tsx`。
- [ ] 阅读 `src/features/history/services/historySnapshotCache.ts`。
- [ ] 阅读 `src/features/history/services/historyReadModel.ts`。
- [ ] 标记当前所有 `UI_TEXT.history.loading` 渲染点。
- [ ] 确认初始无 cache 时页面显示内容。
- [ ] 确认切换日期时是否清空旧 timeline / chart / summary。
- [ ] 确认当前 `refreshIntervalSecs` 定时器是否会在后台持续触发 UI 重算。

### 12.2 可见内容规则

- [ ] History 当前日期有真实 snapshot 时显示真实数据。
- [ ] 切换日期时先查目标日期 cache。
- [ ] 目标日期 cache 存在时立即显示目标日期 cache。
- [ ] 目标日期 cache 不存在时：
  - [ ] 导航和日期选择立即生效。
  - [ ] 不显示整页 loading。
  - [ ] 不显示 `UI_TEXT.history.loading` 常规等待文案。
  - [ ] 可显示低噪声静态结构，或保留最近可见内容并清楚区分正在查看的日期状态。

- [ ] 真实查询确认目标日期无数据后，显示正常空态。
- [ ] 查询失败后，显示低噪声错误/重试状态。
- [ ] 旧日期内容不能长期伪装成目标日期内容。

### 12.3 近期内容与快照策略

- [ ] 保留最近一次可见 History view model。
- [ ] 最近可见内容必须带 date key。
- [ ] 只有 date key 匹配时，才能作为目标日期内容直接显示。
- [ ] date key 不匹配时，不能把旧 timeline 当作新日期数据。
- [ ] 可以显示稳定空结构，但必须避免误导用户。
- [ ] `historySnapshotCache.ts` 增加 LRU 上限。
- [ ] 建议初始上限：`7` 到 `14` 个日期/rolling key。
- [ ] 新增 `getHistorySnapshotCacheSizeForTests()`。

### 12.4 后台刷新节制

- [ ] History 的 `refreshIntervalSecs` 定时器在窗口后台时不触发重型刷新。
- [ ] tracker stale 状态仍可更新必要状态，但不应重算不可见 timeline。
- [ ] tracking data changed 时，只有当前 view 是 History 且前台时刷新 History。
- [ ] backup restore、session deletion、mapping changed 必须清理或刷新 History cache。
- [ ] 清理历史记录后必须清 History cache。

### 12.5 UI 调整

- [ ] 移除 History 常规路径中的 `UI_TEXT.history.loading` 等待文案。
- [ ] 保留真实空态文案。
- [ ] 保留错误/重试文案。
- [ ] 不新增 skeleton、spinner、shimmer。
- [ ] 保持 Quiet Pro 密度和信息层级。
- [ ] 日期切换期间控件不能跳动。

### 12.6 测试

- [ ] `tests/uiSmoke.test.ts` 静态确认 History 常规等待路径没有 `UI_TEXT.history.loading`。
- [ ] `tests/uiBrowserSmoke.test.ts` 覆盖点击 History 后 active nav 立即更新。
- [ ] `tests/uiBrowserSmoke.test.ts` 覆盖 History 初始常规路径没有整页 loading。
- [ ] 新增 History cache LRU 单元测试。
- [ ] 新增后台隐藏时 History 不触发重型 refresh 的测试或静态边界检查。
- [ ] 保留现有 history replay 测试，确认统计不变。

### 12.7 阶段 4 验收

- [ ] History 导航即时。
- [ ] History 常规路径不显示 loading 文案。
- [ ] History 切换日期不会用旧日期数据误导用户。
- [ ] History cache 有上限。
- [ ] History 后台不持续重型刷新。
- [ ] History replay 全部通过。

## 13. 阶段 5：Classification / App Mapping 部分套用

目标：App Mapping 打开更稳定，但保留草稿和保存操作反馈。

### 13.1 现状复核

- [ ] 阅读 `src/features/classification/hooks/useAppMappingState.ts`。
- [ ] 阅读 `src/features/classification/components/AppMapping.tsx`。
- [ ] 阅读 `src/features/classification/services/classificationService.ts`。
- [ ] 阅读 `src/features/classification/services/classificationBootstrapCache.ts`。
- [ ] 确认 `initialBootstrap` 是否已经能避免大多数初始 loading。
- [ ] 确认保存、删除候选、刷新 candidates 的 loading/disabled 状态。

### 13.2 初始显示规则

- [ ] 有 classification bootstrap 时，App Mapping 首屏立即显示。
- [ ] 无 bootstrap 时，可以显示稳定低噪声结构或现有 loading；是否移除需单独判断。
- [ ] 如果移除初始 loading，必须保证：
  - [ ] 不展示错误候选列表。
  - [ ] 不展示可编辑但未加载真实草稿的数据。
  - [ ] 不允许用户在基础数据未加载时保存空草稿。

### 13.3 草稿保护

- [ ] 后台 refresh 不覆盖 dirty draft。
- [ ] 保存成功后再更新 saved state 与 bootstrap cache。
- [ ] 保存失败时保留 draft。
- [ ] 删除候选后刷新 candidates 不能清空未保存编辑。
- [ ] App Mapping 前台预热只准备 bootstrap，不自动修改当前草稿。

### 13.4 必须保留的反馈

- [ ] 保存中的按钮 disabled / busy 状态。
- [ ] 删除候选中的确认与 busy 状态。
- [ ] 加载失败后的错误提示或重试入口。
- [ ] 未保存变更提示。

### 13.5 测试

- [ ] `tests/classificationDraftState.test.ts` 覆盖 bootstrap clone 不污染原始数据。
- [ ] `tests/interactionFlows.test.ts` 覆盖编辑、取消、保存、删除流程仍正确。
- [ ] `tests/uiSmoke.test.ts` 静态确认没有把保存 busy 文案误删。
- [ ] `tests/uiBrowserSmoke.test.ts` 覆盖 App Mapping 导航即时。

### 13.6 阶段 5 验收

- [ ] App Mapping 导航即时。
- [ ] 有 bootstrap 时不显示整页等待。
- [ ] 无 bootstrap 时不允许误操作保存空状态。
- [ ] 保存/删除反馈完整。
- [ ] 草稿不被后台 refresh 覆盖。

## 14. 阶段 6：Settings / About / Update 部分套用

目标：设置与关于页打开更稳定，但所有真实操作必须保留明确反馈。

### 14.1 Settings 初始显示

- [ ] 阅读 `src/features/settings/hooks/useSettingsPageState.ts`。
- [ ] 阅读 `src/features/settings/components/Settings.tsx`。
- [ ] 阅读 `src/features/settings/services/settingsBootstrapService.ts`。
- [ ] 有 settings bootstrap 时，Settings 首屏立即显示。
- [ ] 无 bootstrap 时，评估是否保留现有 `UI_TEXT.settings.loading`。
- [ ] 如果移除初始 loading，必须保证：
  - [ ] 不展示可保存的空默认表单。
  - [ ] 不允许用户在真实 settings 未加载时提交错误设置。
  - [ ] 不清空本地 API token、备份配置或用户偏好。

### 14.2 Settings 草稿保护

- [ ] 后台 settings changed 事件不覆盖 dirty draft。
- [ ] 保存成功后更新 saved settings、draft settings 和 bootstrap cache。
- [ ] 保存失败时保留 draft 并提示。
- [ ] 语言切换、主题切换等设置变更不制造跨页面闪动。

### 14.3 Remote Backup 与数据安全操作

- [ ] WebDAV 配置加载可以使用稳定初始结构。
- [ ] 测试连接、上传、下载、恢复必须保留 busy 状态。
- [ ] 备份恢复必须保留预览、确认、恢复进度或状态。
- [ ] 清理历史必须保留确认与执行反馈。
- [ ] 这些 loading 不属于要移除的 waiting UI。

### 14.4 About 与 Update

- [ ] About 页面版本信息可使用 settings bootstrap 或 update snapshot 立即显示。
- [ ] About 初始无版本信息时，优先显示静态结构和 `-`，而不是整页 loading。
- [ ] Update 检查、下载、安装必须保留明确状态。
- [ ] 下载进度可见时不得隐藏。
- [ ] install error / download error 必须保留重试和 fallback 链路。

### 14.5 测试

- [ ] `tests/settingsPageState.test.ts` 保持通过。
- [ ] `tests/updateViewModel.test.ts` 保持通过。
- [ ] `tests/uiSmoke.test.ts` 静态确认 Settings 操作 busy 状态仍存在。
- [ ] `tests/uiBrowserSmoke.test.ts` 覆盖 Settings 导航即时与主题弹窗。
- [ ] `tests/uiBrowserSmoke.test.ts` 保留 WebDAV 配置弹窗覆盖。

### 14.6 阶段 6 验收

- [ ] Settings 导航即时。
- [ ] About 导航即时。
- [ ] 初始 bootstrap 可用时不出现整页等待。
- [ ] 操作 loading、进度和错误反馈完整。
- [ ] 用户草稿不被后台 refresh 覆盖。

## 15. 阶段 7：缓存生命周期与后台释放统一收口

目标：各 feature 有自己的 cleanup 出口，App 层只调用出口。

### 15.1 Feature cleanup 出口

- [ ] Dashboard 如存在大 cache，新增：
  - [ ] `clearDashboardHeavyCaches()`
  - [ ] 或 `clearDashboardSnapshotCache()`，取决于真实 cache 结构。

- [ ] History 如存在大 cache，新增：
  - [ ] `clearHistoryHeavyCaches()`
  - [ ] 或复用现有 `clearHistorySnapshotCache()`，但需要明确是否会影响体验。

- [ ] Data 保持：
  - [ ] `clearDataHeavyCaches()`
  - [ ] `clearDataBootstrapCache()`

- [ ] Classification / Settings bootstrap 默认不作为后台大 cache 清理对象，除非测量证明它们变大。

### 15.2 后台释放策略

- [ ] 短后台窗口：保留热 cache。
- [ ] 长后台窗口：释放浏览型页面大 cache。
- [ ] 保留小 bootstrap：
  - [ ] settings bootstrap
  - [ ] classification bootstrap
  - [ ] Data bootstrap snapshot
  - [ ] 必要的 update snapshot

- [ ] 不清用户草稿。
- [ ] 不清正在进行的操作状态。
- [ ] 不清 runtime tracking 状态。

### 15.3 失效事件

- [ ] mapping override 保存后：
  - [ ] 清 Dashboard cache。
  - [ ] 清 History cache。
  - [ ] 清 Data bootstrap/cache。

- [ ] sessions deleted 后：
  - [ ] 清 Dashboard cache。
  - [ ] 清 History cache。
  - [ ] 清 Data heavy cache 和 bootstrap。

- [ ] backup restored 后：
  - [ ] 清 Dashboard cache。
  - [ ] 清 History cache。
  - [ ] 清 Data bootstrap/cache。
  - [ ] 清 settings/classification bootstrap，或重新加载。

- [ ] language changed 后：
  - [ ] 旧语言 view model 不长期展示。
  - [ ] 可以先显示结构，再后台刷新。

- [ ] 跨天后：
  - [ ] Dashboard/History 当前日期 cache 必须刷新。
  - [ ] 旧日期 cache 按 LRU 自然淘汰。

### 15.4 测试

- [ ] 新增 Dashboard cache cleanup 测试。
- [ ] 新增 History cache cleanup 测试。
- [ ] 更新 AppShell / startup warmup smoke，确认调用 feature cleanup 出口。
- [ ] 确认 backup restore / sessions deleted 事件清理相关 cache。

### 15.5 阶段 7 验收

- [ ] 每个大 cache 有明确 owner。
- [ ] 每个大 cache 有上限。
- [ ] 每个大 cache 有清理出口。
- [ ] AppShell 不直接操作内部 Map。
- [ ] 后台释放不会破坏用户操作态。

## 16. 阶段 8：验证与回归覆盖

### 16.1 单元测试

- [ ] `tests/startupWarmupService.test.ts`
  - [ ] 默认 warmup 顺序稳定。
  - [ ] 前台 refresh 只包含允许页面。
  - [ ] 新增 include options 时覆盖 true/false。
  - [ ] hidden/background 不触发不该触发的重型 prewarm。

- [ ] Dashboard 相关测试
  - [ ] snapshot cache 命中。
  - [ ] snapshot cache LRU 上限。
  - [ ] cleanup 清理大 cache。
  - [ ] refresh 期间保留最近可见内容。

- [ ] History 相关测试
  - [ ] snapshot cache 命中。
  - [ ] snapshot cache LRU 上限。
  - [ ] 切换日期时不把旧日期数据标成新日期。
  - [ ] cleanup 清理大 cache。

- [ ] Classification 测试
  - [ ] bootstrap clone。
  - [ ] dirty draft 不被 refresh 覆盖。
  - [ ] 保存失败保留 draft。

- [ ] Settings / Update 测试
  - [ ] settings bootstrap 正常加载。
  - [ ] 保存 busy 保留。
  - [ ] backup / restore busy 保留。
  - [ ] update download/install 状态保留。

### 16.2 静态 UI smoke

- [ ] 浏览型页面常规路径不渲染 forbidden loading。
- [ ] 操作型页面操作 busy 文案仍存在。
- [ ] AppShell 不新增页面 read model 计算。
- [ ] feature cleanup 出口由 AppShell 调用。
- [ ] `shared/*` 没有新增页面私有 cache。
- [ ] `platform/*` 没有引用 feature。

### 16.3 浏览器 smoke

- [ ] Dashboard 导航即时。
- [ ] History 导航即时。
- [ ] Data 仍保持导航即时且无 visible loading 回退。
- [ ] App Mapping 导航即时。
- [ ] Settings 导航即时。
- [ ] About 导航即时。
- [ ] History 切换日期时不出现整页 loading。
- [ ] Settings 保存/备份/恢复仍有操作反馈。
- [ ] Update 检查/下载/安装状态模型仍可见或可由 view model 测试覆盖。

### 16.4 手工观察

- [ ] 后台启动应用，不打开主窗口，不触发浏览型页面重型预热。
- [ ] 打开主窗口停留 Dashboard，温和预热高频浏览页面。
- [ ] 点击 History，切页立即发生。
- [ ] 点击 Data，仍保持昨天规则。
- [ ] 最小化到托盘后，短时间返回页面仍顺滑。
- [ ] 后台超过延迟后返回页面，使用 cache/bootstrap/静态结构过渡，不出现整页 loading。
- [ ] Settings 保存、WebDAV 下载、备份恢复仍有明确进行中反馈。

## 17. 验证命令

### 17.1 阶段性验证

- [ ] Dashboard/History 阶段后运行：
  - [ ] `npm test`
  - [ ] `npm run test:replay`
  - [ ] `npm run test:data`
  - [ ] `npm run test:data-range`
  - [ ] `npm run test:warmup`
  - [ ] `npm run test:ui-smoke`
  - [ ] `npm run test:ui-browser-smoke`
  - [ ] `npm run build`

- [ ] Classification 阶段后运行：
  - [ ] `npm run test:classification`
  - [ ] `npm run test:interaction`
  - [ ] `npm run test:ui-smoke`
  - [ ] `npm run test:ui-browser-smoke`

- [ ] Settings/About/Update 阶段后运行：
  - [ ] `npm run test:settings`
  - [ ] `npm run test:update`
  - [ ] `npm run test:persistence`
  - [ ] `npm run test:ui-smoke`
  - [ ] `npm run test:ui-browser-smoke`

### 17.2 最终验证

- [ ] `npm run check`
- [ ] 如果触及 Rust、schema、migration、commands 或 tracking runtime，追加：
  - [ ] `npm run check:rust`
- [ ] 如果准备发布，追加：
  - [ ] `npm run release:check`

## 18. 回滚规则

### 18.1 回滚 Dashboard 规则

- [ ] 恢复 Dashboard 初始 loading 或旧刷新策略。
- [ ] 保留 cache 上限，除非上限本身引入问题。
- [ ] 保留 AppShell owner 边界。

### 18.2 回滚 History 规则

- [ ] 恢复 History 局部 loading 文案。
- [ ] 保留 cache 上限和清理出口，除非它们是问题来源。
- [ ] 不恢复后台不可见时的重型刷新。

### 18.3 回滚 Classification / Settings 初始显示规则

- [ ] 可恢复初始 bootstrap loading。
- [ ] 不移除保存、删除、恢复、下载等操作反馈。
- [ ] 不回滚草稿保护。

### 18.4 回滚后台 cleanup

- [ ] 移除 AppShell 中新增的对应 cleanup 调用。
- [ ] 保留 feature cleanup 函数，除非函数本身有问题。
- [ ] 保留 cache 上限。

### 18.5 回滚前台预热

- [ ] 移除新增前台 prewarm effect 或 options。
- [ ] 保留立即导航规则。
- [ ] 保留操作 loading 规则。

## 19. 风险与注意事项

- [ ] 最大风险：为了无 loading 展示错误或误导性旧数据。
- [ ] 最大边界风险：把多个页面的预热逻辑抽成过早的共享框架。
- [ ] 最大体验风险：误删保存、下载、恢复等操作反馈。
- [ ] 最大资源风险：新增 prewarm timer、listener 或 pending promise 后未释放。
- [ ] 最大测试风险：只做静态检查，没有真实浏览器导航覆盖。
- [ ] 最大产品风险：让页面看起来“已经准备好”，但实际数据仍是旧日期或旧 mapping。

防守规则：

- [ ] 任何旧快照展示都必须带 key 判断。
- [ ] 任何用户操作都必须有反馈。
- [ ] 任何新增 timer/listener 都必须有 cleanup。
- [ ] 任何新增 cache 都必须有上限。
- [ ] 任何 AppShell 新增逻辑都必须保持薄编排。

## 20. 执行记录

### 20.1 阶段 0 记录

- [x] 页面分类结果：
  - [x] Dashboard：浏览型，常规路径应保持即时导航和稳定首屏。
  - [x] History：浏览型，常规路径不应渲染 loading 文案；日期切换不能用旧日期数据误导用户。
  - [x] Data：浏览型，本轮保持既有前台预热、bootstrap 和后台释放规则。
  - [x] Classification / App Mapping：操作型，只做导航/预热边界保护，保留保存和删除反馈。
  - [x] Settings：操作型，保留保存、备份、恢复、WebDAV 等操作反馈。
  - [x] About：静态信息区按稳定首屏处理；更新操作按操作型处理。
  - [x] Update：操作型，保留检查、下载、安装、错误和进度反馈。

- [x] 当前 loading 盘点：
  - [x] Dashboard：未发现需要保留的浏览型等待文案；刷新期间保留已可见 snapshot。
  - [x] History：移除常规路径 `UI_TEXT.history.loading` 渲染，改为无文案 Quiet Pro 占位结构。
  - [x] Classification / App Mapping：保留 `UI_TEXT.mapping.loading` 及保存/删除相关反馈。
  - [x] Settings：保留 `UI_TEXT.settings.loading` 及保存、备份、恢复、WebDAV 操作反馈。
  - [x] About：未在本轮引入新等待态。
  - [x] Update：保留 `UpdateProgressBar`、`UI_TEXT.update.processing`、错误和重试链路。

- [x] 当前 cache 盘点：
  - [x] Dashboard：`dashboardSnapshotCache.ts` 增加 LRU 上限 3、touch、clear 出口和测试查询出口。
  - [x] History：`historySnapshotCache.ts` 增加 LRU 上限 14、touch、clear 出口和测试查询出口。
  - [x] Data：保持 `clearDataHeavyCaches()` 与 bootstrap 生命周期出口。
  - [x] Classification：保持 bootstrap cache，不作为后台大 cache 清理对象。
  - [x] Settings：保持 bootstrap cache，不作为后台大 cache 清理对象。
  - [x] About：复用现有 settings/update 信息路径，本轮无新增私有 cache。

### 20.2 实施记录

- [x] 阶段 1：在 UI smoke 中补充浏览型 forbidden loading、操作型 busy 保留、AppShell owner 边界和 feature cleanup 出口断言；未新增生产级通用 lifecycle 框架。
- [x] 阶段 2：`AppShell.tsx` 统一使用前台 readiness，按当前 view 传递 `includeDashboard`、`includeHistory`、`includeData`；后台延迟释放只调用 feature-owned cleanup 出口。
- [x] 阶段 3：Dashboard refresh 受当前页和前台状态控制；snapshot cache 增加 LRU 上限、touch、clear 和测试覆盖。
- [x] 阶段 4：History refresh 受当前页和前台状态控制；常规等待路径不再渲染 loading 文案；目标日期无 cache 时显示安静结构，不把旧日期内容标成目标日期数据；snapshot cache 增加 LRU 上限和测试覆盖。
- [x] 阶段 5：Classification 保持操作型边界，未移除保存/删除 busy 反馈；mapping override 变更时清 Dashboard、History、Data 相关 cache。
- [x] 阶段 6：Settings/About/Update 保持操作型反馈边界，未移除保存、备份、恢复、WebDAV、下载、安装等反馈。
- [x] 阶段 7：Dashboard、History、Data 大 cache 均有 feature-owned cleanup 出口；backup restored、mapping changed、sessions deleted 事件清理相关浏览型 cache。
- [x] 阶段 8：补充并通过完整前端验证链，包含静态 UI smoke、真浏览器 smoke、build 和 bundle budget。

### 20.3 验证记录

- [x] `npm test`：通过，已由 `npm run check` 覆盖。
- [x] `npm run test:replay`：通过，已由 `npm run check` 覆盖。
- [x] `npm run test:warmup`：通过，9 项；覆盖 refresh include options 与 Dashboard/History cache LRU。
- [x] `npm run test:classification`：通过，已由 `npm run check` 覆盖。
- [x] `npm run test:settings`：通过，已由 `npm run check` 覆盖。
- [x] `npm run test:update`：通过，已由 `npm run check` 覆盖。
- [x] `npm run test:interaction`：通过，已由 `npm run check` 覆盖。
- [x] `npm run test:data`：通过，已由 `npm run check` 覆盖。
- [x] `npm run test:data-range`：通过，已由 `npm run check` 覆盖。
- [x] `npm run test:ui-smoke`：通过，11 项；覆盖 History 无 loading 文案、操作反馈保留、AppShell 边界。
- [x] `npm run test:ui-browser-smoke`：通过，17 项；覆盖 History 导航即时且无 visible loading copy。
- [x] `npm run build`：通过。
- [x] `npm run check`：通过；包含 naming、architecture、完整 frontend、browser smoke、build、bundle budget。
- [x] `npm run check:rust` 是否需要：不需要。本轮未触及 Rust、schema、migration、commands 或 tracking runtime。

### 20.4 遗留风险

- [x] 是否仍有浏览型页面常规路径 loading：静态 UI smoke 与浏览器 smoke 未发现 Dashboard/Data/History 主路径回退；History 常规路径已移除 `UI_TEXT.history.loading` 渲染。
- [x] 是否有操作 loading 被误删：静态 UI smoke 确认 Settings、App Mapping、Data Safety、Update 关键操作反馈仍存在。
- [x] 是否有 cache 未设上限：本轮新增/调整的 Dashboard 与 History snapshot cache 均有上限；Data 既有 cache lifecycle 保持。
- [x] 是否有后台 timer/listener 未释放风险：AppShell 新增逻辑复用 effect cleanup，前台恢复会取消 pending cleanup；`npm run check` 通过。
- [x] 是否需要回写长期文档：暂不需要。本轮规则仍作为已归档执行记录保存，未形成新的顶层长期规则变更。

## 21. 勾选和归档规则

- [ ] 执行前只勾选已完成的事实，不预先勾选计划项。
- [x] 每完成一个阶段，补充 `20. 执行记录`。
- [ ] 如果发现需要新增 Rust/schema/migration，先更新本文范围和验证命令，再实施。
- [ ] 如果发现需要长期规则，回写对应顶层长期文档。
- [x] 完成后将本文移动到 `docs/archive/cross-page-foreground-prewarm-stable-navigation-execution-plan.md`。
- [x] 归档前确认 `docs/working/` 不保留已完成的一次性执行单。
