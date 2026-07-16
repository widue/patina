# Quiet Pro 组件资产与审计清单

> 盘点日期：2026-07-16  
> 作用：为组件体系规范化执行提供一次性事实证据  
> 归档规则：随执行方案一并归档，不作为长期母规则

## 1. 盘点口径

- 扫描范围：`src/app/**/*.tsx`、`src/features/**/*.tsx`、`src/shared/components/*.tsx`、`src/styles/**/*.css`。
- `button/input/select/textarea` 只计数，不直接视为债务。
- 组件 owner 按 `app / feature / shared` 判断，不按视觉相似度判断。
- 风险分级：R1 纯展示；R2 简单交互；R3 焦点、键盘、portal 或复合输入；R4 危险操作或跨运行时副作用。
- 测试证据区分源码结构断言、SSR smoke、真实浏览器和 Tauri runtime，不互相替代。

## 2. 共享组件逐项结论

| 组件 | 原型与真实消费者 | 状态、焦点与外部资源 | 风险 | 当前测试证据 | 最终结论 |
| --- | --- | --- | ---: | --- | --- |
| `QuietActionRow` | Settings 的稳定行容器；3 个页面内消费者 | 纯结构，无 copy、listener 或 portal | R1 | Settings browser smoke 间接覆盖 | 保留 Shared composition；属于稳定 `panel/control` 原型 |
| `QuietBadge` | Classification 的应用与域名状态 | tone + class；无交互 | R1 | Classification browser smoke | 保留 Shared primitive；只表达真实状态 |
| `QuietButton` | Classification、Settings、Tools、Update 与 shared Dialog 的普通文本 action | tone、disabled、busy、原生 button 属性 | R2/R4 | 多页 browser smoke + 类型/Lint/包体门禁 | 新增 Shared primitive；不接管品牌入口、图标操作或复合控件内部按钮 |
| `QuietChartTooltip` | Dashboard/Data 图表 tooltip | Recharts 状态；无自建全局 listener | R2 | Dashboard/Data browser smoke | 保留 Shared composition；图表专用，不与普通 Tooltip 合并 |
| `QuietColorField` | Classification 的分类、应用、域名颜色 | portal、pointer drag、scroll/resize、格式输入、EyeDropper | R3 | Classification smoke + 本轮契约补强 | 保留 Shared complex control；不按行数拆分 |
| `QuietConfirmDialog` | `useQuietDialogs` 的稳定确认组合 | 继承 Dialog 焦点；loading/disabled | R4 | Dialog browser smoke 间接覆盖 | 保留 Shared composition |
| `QuietDangerAction` | Settings 数据安全危险入口 | danger 语义、Tooltip、disabled | R4 | Settings smoke 间接覆盖 | 保留 Shared primitive；与实心 danger button 语义不同 |
| `QuietDatePicker` | Tools reminder 日期输入 | portal、outside click、Escape、日期边界 | R3 | 本轮补充真实浏览器契约 | 保留 Shared complex control；History 日历不与其合并 |
| `QuietDateRangePicker` | Data 趋势与 Settings 导出 | portal、范围草稿、日期解析、视口定位 | R3 | Data/Settings browser smoke | 保留 Shared complex control；两个独立 feature 已复用 |
| `QuietDialog` | About、Update、Classification、History、Settings、Tools | portal、初始焦点、焦点陷阱、Escape、焦点恢复 | R3/R4 | About dialog 真实键盘测试 | 保留 Shared composition；补 topmost dialog 契约 |
| `QuietIconAction` | app widget、Dashboard、History、Classification、Settings | aria-label、pressed、disabled、Tooltip | R2 | 多页 smoke 间接覆盖 | 保留 Shared primitive；专用极小图标按钮可合理例外 |
| `QuietInlineAction` | Classification 卡片行内操作 | tone、disabled、可选 Tooltip | R2 | Classification browser smoke | 保留 Shared primitive |
| `QuietPageHeader` | 七个主页面 | 纯结构、页级 h1、right slot | R1 | UI smoke + browser navigation | 保留 Shared composition |
| `QuietPromptDialog` | `useQuietDialogs` 的输入组合 | Dialog + text input + Enter 提交 | R3 | SSR/调用链间接覆盖 | 保留 Shared composition |
| `QuietRangeControl` | Data 与 Settings 范围导航 | 三按钮、expanded、forwardRef | R2 | Data/Settings browser smoke | 保留 Shared control |
| `QuietSegmentedFilter` | Data、History、Settings、Tools、Classification | selected/disabled、可选 Tooltip | R2 | 多页 browser smoke | 保留 Shared primitive；`aria-pressed` 按钮组契约成立 |
| `QuietSelect` | Classification 应用与域名映射 | portal、listbox、键盘、滚动、视口翻转 | R3 | Classification browser smoke；本轮补键盘恢复断言 | 保留 Shared complex control |
| `QuietStepperSlider` | Settings 与 History zoom | range、step、min/max、增减按钮 | R2 | UI smoke + History/Settings 路径 | 保留 Shared control；专用 History 小按钮不强行合并 |
| `QuietSubpanel` | Settings 服务与数据安全分组 | tone + class；无交互 | R1 | Settings browser smoke | 保留 Shared composition；稳定 `panel` 原型 |
| `QuietSwitch` | Settings 多个开关 | role=switch、checked、disabled、tone | R2 | Settings browser smoke | 保留 Shared primitive |
| `QuietTimePicker` | Tools reminder 时间输入 | portal、outside click、Escape、双 listbox | R3 | 本轮补真实浏览器契约 | 保留 Shared complex control；补 roving focus |
| `QuietToast` | AppShell 消息反馈 | tone、message | R2 | UI smoke 间接覆盖 | 保留 Shared status；补 live-region 语义 |
| `QuietToastStack` | AppShell 全局消息层 | portal、列表 | R2 | AppShell smoke | 保留 Shared composition |
| `QuietTooltip` | 跨 feature 图标与说明 | portal、hover/focus、scroll/resize、pointer suppression | R3 | Settings/Data browser smoke | 保留 Shared primitive；Tooltip 不得是唯一可访问名称 |

### 2.1 新增共享组件准入结论

`QuietButton` 满足共享准入：

- Update、Classification、Tools、Settings 和 shared Dialog 均有真实文本 action；
- `primary / secondary / danger` 三种语义已经由长期 CSS 原型定义；
- 所有消费者都需要一致的 `type=button`、disabled、busy 与 tone 行为；
- 尺寸仍由消费者通过 `className` 决定，避免形成万能尺寸矩阵；
- 不支持 `asChild` 或多态渲染；链接仍使用语义正确的 `<a>`。

结论：新增 `QuietButton`，先迁移 Dialog 与跨 feature 文本 action；图标按钮、格式 radio、日期格、时间选项和工具专用图标操作保持原生或既有专用组件。

## 3. App-shell 资产

| Owner | 资产 | 分类 | 结论 |
| --- | --- | --- | --- |
| `app/components` | `AppSidebar.tsx`、`AppTitleBar.tsx` | App-shell component | 导航、窗口控制属于壳层；原生按钮合理，不进入 shared |
| `app/widget` | `WidgetShell.tsx` 及 widget 局部组件 | App-shell component | 跨窗口生命周期与 widget 状态专用；仅复用 `QuietIconAction` |
| `app/AppShell.tsx` | 页面编排、ToastStack、全局 Dialog | App-shell composition | 保持薄；不承接新的组件实现 |

## 4. Feature 资产

下列 TSX 资产已全部分类。它们默认由所在 feature 持有；只有表中明确指出的通用交互才进入 shared。

### 4.1 About

- `About.tsx`：页面 composition。
- `AboutPanel.tsx`：About 专用展示和品牌入口。
- `AboutFeedbackDialog.tsx`：基于 `QuietDialog` 的品牌反馈组合。
- `AboutSupportDialog.tsx`：基于 `QuietDialog` 的支持渠道组合。

结论：品牌图片按钮、外链和渠道入口的视觉/行为契约均为 feature 专用，本轮不迁移；这也是对“原生 button 不必清零”的明确例外。

### 4.2 Classification

- `AppMapping.tsx`：页面 composition。
- `AppMappingCandidateCard.tsx`、`WebDomainMappingCard.tsx`：业务卡片与映射表单。
- `CategoryColorControls.tsx`：分类颜色业务组合。

结论：候选选择、颜色、badge、inline/icon action 已正确复用 shared；格式 radio、业务 checkbox 保持原生；页面保存/取消和 dialog action 迁移 `QuietButton`。

### 4.3 Dashboard

- `Dashboard.tsx`：页面与面板 composition。

结论：图表、排行和进度条均为 Dashboard 读模型展示；不拆成无 owner 的通用卡片。唯一图标操作继续使用 `QuietIconAction`。

### 4.4 Data

- `Data.tsx`：页面 composition。
- `DataTrendPanel.tsx`、`DataAppTrendPanel.tsx`、`DataHeatmapPanel.tsx`：数据图表面板。
- `DataTrendRangeControl.tsx`、`DataTrendRangePicker.tsx`：Data 对 shared 范围控件的 feature 组合。
- `DataHeatmapTooltip.tsx`：Data 专用 delegated tooltip。

结论：图表 tooltip 与 delegated heatmap tooltip 的状态机不同，不合并；搜索 input 保持原生；日期范围继续复用 shared。

### 4.5 History

- `History.tsx`：页面 composition。
- `HistoryDateNavigator.tsx`、`HistoryCalendarPopover.tsx`：History 专用日期导航。
- `HistoryDayDistributionPanel.tsx`、`HistoryDaySummaryPanel.tsx`、`HistoryHourlyActivityPanel.tsx`：业务面板。
- `HistoryHorizontalTimeline.tsx`、`HistoryTimelineLaneList.tsx`、`HistoryTimelineLists.tsx`：时间线专用展示与交互。
- `HistoryTimelineDetailsPopover.tsx`：时间线详情弹层。
- `HistoryTimelineDialogDateControls.tsx`、`HistoryTimelineZoomDialog.tsx`：时间线 Dialog 组合。

结论：History 日历具有页面导航语义，不与表单 DatePicker 合并；时间线折叠、缩放和小尺寸按钮保留 feature 专用；Dialog/Stepper/Tooltip 继续复用 shared。

### 4.6 Settings

- `Settings.tsx`：页面 composition。
- `SettingsAppearancePanel.tsx`、`SettingsTrackingPanel.tsx`、`SettingsResidentPanel.tsx`、`SettingsInterfacePanel.tsx`、`SettingsDataSafetyPanel.tsx`：设置面板。
- `SettingsRemoteBackupPanel.tsx`：远端备份 feature 组合。
- `SettingsDataExportDialog.tsx`、`SettingsDataExportFieldConfigDialog.tsx`：导出 R4 Dialog 流程。

结论：五个重复面板头抽成 Settings-owned `SettingsPanelHeader`，保持现有视觉；R4 数据操作不移动业务逻辑；文本 action 迁移 `QuietButton`；格式与字段选择保留原生 radio/checkbox。

### 4.7 Tools

- `Tools.tsx`：页面 composition。
- `PomodoroToolPanel.tsx`、`TimerToolPanel.tsx`、`ReminderToolPanel.tsx`：工具状态与输入组合。
- `ToolAlertDialog.tsx`、`ToolDurationInput.tsx`、`ToolsSidebarStatusEntry.tsx`、`ToolsStatusChip.tsx`：工具专用组件。

结论：计时状态、分钟草稿和工具 icon action 留在 feature；普通文字 action 可复用 `QuietButton`；DatePicker/TimePicker 保持 shared control。

### 4.8 Update

- `UpdateConfirmDialog.tsx`、`UpdateStatusPanel.tsx`、`UpdateProgressBar.tsx`。

结论：更新状态模型留在 feature；普通 primary/secondary action 迁移 `QuietButton`；进度条是稳定 status 展示，但当前仅 Update 使用，保留 feature owner。

## 5. 原生控件基线与结论

| Owner | 基线数量 | 主要语义 | 结论 |
| --- | ---: | --- | --- |
| Settings | 55 | 数据操作、radio/checkbox、WebDAV 输入、dialog action | 迁移普通文本 action；保留语义输入与 R4 业务组合 |
| Tools | 28 | 计时输入、工具 action、规则行 icon action | 保留业务输入和专用 icon action；普通文本 action可复用 |
| History | 13 | 日期导航、时间线折叠、缩放 | 保留 feature 专用 |
| Classification | 8 | checkbox、页面 action、分类 dialog | 页面/dialog 文本 action迁移；输入保留 |
| Update | 8 | 更新 action 与状态 | 文本 action迁移；状态逻辑保留 |
| App | 6 | 标题栏、侧栏、widget | App-shell justified |
| About | 5 | 品牌外链、dialog action | 品牌入口保留；普通 action迁移 |
| Data | 2 | 搜索与筛选 | Native justified |

目标不是降低到零。迁移完成后，剩余原生控件均应能落入 `Native justified`、`Feature component` 或 `App-shell component`。

## 6. 样式资产

- `tokens.css`：主题、语义颜色、圆角、边框、阴影、排版和全局 focus owner。
- `quiet-pro.css`：`panel / control / chip / status` 及 Dialog、Select、日期时间原型。
- `app-shell.css`：壳层及当前跨页面 Quiet action、badge、toast、颜色控件样式。
- `styles/features/*.css`：只保留 feature 专用图表、时间线、设置表单和工具状态样式。

审计结论：

- `.qp-button-primary / secondary / danger` 已形成长期语义，但缺少 React 行为 owner；由 `QuietButton` 补齐。
- 不移动现有大段 CSS 文件，避免纯目录整理。
- 不新增颜色、圆角、阴影或视觉档位。
- 最终 `kill-ai-slop` 扫描 274 个文件、21 个原始命中；逐项复核后均为功能性形状、既有 Quiet Pro 决策或扫描误报，不形成整改项。

## 7. 高风险行为缺口

| 缺口 | 证据 | 处理 |
| --- | --- | --- |
| 多个 `QuietDialog` 同时打开时所有实例都监听 Escape/Tab | Settings 导出 Dialog 可再打开字段配置 Dialog | 仅 topmost Dialog 响应键盘 |
| TimePicker 的 84 个 option 均进入 Tab 顺序 | 两列 option 均为默认可聚焦 button | 使用 roving focus 与方向键 |
| ColorField tablist 缺少 tab/selected 语义，数值输入缺少名称 | `role=tablist` 下为普通 button | 补 ARIA，不改视觉 |
| Toast 没有 live-region 语义 | `.qp-toast` 仅普通 div | 补 `role=status` 与 polite live |
| Select 的 Escape 焦点恢复测试不完整 | 现有 smoke 只确认关闭 | 增加键盘打开、关闭和焦点恢复断言 |
| browser smoke 清理偶发 Windows `EPERM` | 31 个场景通过后删除 user-data-dir 失败 | 改为限定目录的有界条件重试 |

## 8. 执行与验收证据

- `npm run check`：通过；类型、Lint、命名、架构、IPC、hotspot、Quiet Pro 样式债务、测试治理、覆盖率、mutation、浏览器、构建和包体均为 0 失败。
- 真实浏览器：31/31 场景通过；七个页面可进入，控制台 error 为 0，无新增横向溢出。
- 浏览器测试清理：修复 Windows user-data-dir 的 `EPERM` 后，31/31 场景通过且目录清理成功。
- 包体：initial 285.81 KiB gzip、lazy 77.74 KiB、total 363.54 KiB、lazy support 6.11 KiB，全部在既有预算内；没有扩预算或 allowlist。
- 直接相关浏览器性能共执行三轮、History/Data 各 24 个热路径样本：三轮全部在预算内；History 冷首帧 144.1–170.7ms，热首帧平均 51.0–54.9ms、最差 P95 75.7ms，完整进入平均 110.5–129.2ms；控制台 error 为 0。
- `perf:stable` 读模型套件在错误 Node 24 + 遗留 `tauri dev` 高 CPU 环境中出现 Data 超预算；清理后按仓库 Node 22 复测时 History 5/5 通过，但 Dashboard 首轮平均 27.38ms 略超 25ms（P95 与 max 通过）。本轮未改 History/Dashboard/Data 读模型，因此不调预算、不将环境噪声伪报为通过；用直接覆盖组件导航与渲染路径的浏览器性能门禁作为本任务结论。该既有验证稳定性债务归 `scripts/perf/stable-benchmark-suite.ts` 与仓库 Node 版本执行纪律所有，不归组件层。
- 当前未发现需要改变七个页面视觉设计的组件问题；新增组件沿用现有类名、token、尺寸和层级。

## 9. 最终候选决策

- `合并`：跨 feature 普通文本按钮 → `QuietButton`。
- `合并`：Settings 五个同构面板头 → feature-owned `SettingsPanelHeader`。
- `修复`：Dialog topmost 键盘契约、TimePicker roving focus、ColorField ARIA、Toast live region、浏览器测试清理。
- `保留`：History 日历、时间线控件、Data delegated tooltip、Tools 计时输入、壳层按钮。
- `删除`：无；未发现无消费者的共享组件。
- `延后`：复杂共享组件按文件拆分；没有行为或 owner 证据，不应仅因行数执行。

## 10. 对抗式审查结论

- 抽象攻击：`QuietButton` 有 13 个 feature 文件和 shared Dialog 的真实消费者，仅暴露 `tone / busy` 与原生属性；`SettingsPanelHeader` 保持 Settings owner；未发现 shared 读取 feature、platform、runtime 或持久化。
- 过度统一攻击：History 日期/时间线、Data delegated tooltip、About 品牌入口、Tools 专用图标操作均保持原 owner；原生 `<button>` 仍有 82 处且均按语义继续允许。
- 行为攻击：嵌套 Dialog 的两次 Escape、焦点回退，Select、DatePicker、TimePicker、ColorField 的键盘路径，以及 Tooltip 描述关系均有真实浏览器断言。
- 视觉攻击：没有新增颜色、圆角、阴影、渐变或视觉档位；`kill-ai-slop` 21 个线索全部人工判定为非整改项。
- 性能攻击：曾尝试把更多 compound-control 按钮迁入共享原型，因 lazy support chunk 越过 6.25 KiB 预算而撤回；最终为 6.11 KiB，未用预算扩张换取抽象统一。
- 最终阻断问题：P0 0、P1 0、由本任务引入且未修复的 P2 0。
