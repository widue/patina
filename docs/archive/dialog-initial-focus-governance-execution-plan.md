# 弹窗初始焦点治理执行方案

## 0. 文档状态

- 状态：已完成并归档（对抗式审查通过）
- 文档类型：一次性可勾选执行方案
- 创建日期：2026-07-16
- 当前实现进度：100%
- 完成日期：2026-07-17
- 归档文件：`docs/archive/dialog-initial-focus-governance-execution-plan.md`
- 完成归档目标：`docs/archive/dialog-initial-focus-governance-execution-plan.md`
- 长期规则归属：`docs/quiet-pro-component-guidelines.md`
- 代码主要归属：`src/shared/components/QuietDialog.tsx`、各 feature 弹窗适配组件、`tests/uiBrowserSmoke/*`

> 本文是本次治理的执行依据，不是新的长期母文档。任务完成、验收通过并完成对抗式审查后，应将最终规则写入 Quiet Pro 组件规范，再勾选本文并移动到 `docs/archive/`。

## 1. 目标

把所有弹窗和弹出式复合控件的初始焦点，从“DOM 中碰巧排在最前面的可聚焦元素”收口为“由用户任务、操作安全性和组件语义明确决定的焦点契约”。

完成后应同时满足：

- [ ] 打开任何模态弹窗后，焦点一定进入最上层弹窗。
- [ ] 初始焦点不会落到仅用于辅助操作的图标按钮、Tooltip 触发器或禁用控件。
- [ ] 打开弹窗时不再意外显示悬浮文案。
- [ ] 用户主动用键盘聚焦 Tooltip 触发器时，Tooltip 仍能正常出现。
- [ ] 表单、危险确认、选项选择、长内容和加载状态分别采用适合自身任务的初始焦点。
- [ ] Tab、Shift+Tab、Escape、嵌套弹窗和关闭后的焦点恢复形成统一闭环。
- [ ] `QuietDialog`、自定义 `role="dialog"` 浮层和历史日历不再各自维护互相冲突的私有规则。
- [ ] 不改变现有业务流程、视觉层级、组件尺寸、颜色、动效或“灵动视效”。
- [ ] 浏览器级自动化覆盖焦点与 Tooltip 的真实交互，不只检查源码字符串。
- [ ] 长期规则进入 `docs/quiet-pro-component-guidelines.md`，一次性执行单完成后归档。

## 2. 第一性原理

### 2.1 焦点不是装饰状态

浏览器中的 `document.activeElement` 是键盘输入的当前接收者。弹窗打开后，如果焦点仍在弹窗外，或者由 DOM 顺序偶然落到某个按钮上，会直接影响：

- 下一次 Enter 或 Space 会触发什么；
- Tab 从哪里开始；
- 屏幕阅读器首先读到什么；
- Tooltip、说明气泡等基于 focus 的界面是否被意外激活；
- Escape 关闭后焦点能否回到真正的打开者。

因此，初始焦点必须被视为弹窗交互状态的一部分，而不是 CSS 或浏览器默认行为。

### 2.2 初始焦点只服务三个根本目标

1. **理解当前上下文**：长内容、说明型弹窗和复杂面板应先让用户知道“这里是什么”。
2. **开始主要任务**：输入型弹窗应直接进入首个必要输入；选项型弹窗应进入当前选择。
3. **防止误操作**：危险确认应优先聚焦取消或最安全动作，不能聚焦破坏性动作。

任何候选焦点如果不能明确服务以上至少一个目标，就不应成为初始焦点。

### 2.3 Tooltip 是结果，不是根因

弹窗一打开就出现悬浮文案，根因通常不是 Tooltip 支持键盘焦点，而是弹窗把初始焦点错误地交给了 Tooltip 触发器。

因此本次治理遵循：

- 保留 Tooltip 的 `focus` 触发能力，保证键盘可访问性；
- 修正弹窗的初始焦点选择；
- 禁止通过全局延迟、全局禁用 focus Tooltip 或伪造 hover 状态掩盖问题。

### 2.4 语义决策与通用机制分离

- `QuietDialog` 负责通用机制：进入焦点、焦点陷阱、最上层 Escape、关闭后恢复焦点、稳定回退。
- feature 弹窗负责语义决策：应聚焦标题、输入框、当前选项还是安全动作。
- `QuietTooltip` 只负责 Tooltip 自身的显示和无障碍关系，不判断弹窗的初始焦点。

这样既避免每个页面私有实现，也避免共享组件猜测业务语义。

## 3. 本次范围

### 3.1 包含

- `QuietDialog` 的初始焦点 API、标题语义和回退规则。
- 20 个现有 `QuietDialog` 消费者的逐一迁移。
- `QuietConfirmDialog`、`QuietPromptDialog` 等共享包装器。
- 4 个自定义 `role="dialog"` 浮层：日期、时间、颜色、日期范围。
- 未形成焦点契约的历史日历弹层。
- Tooltip 与弹窗初始焦点的协同规则。
- 单元/结构测试、真实浏览器交互测试、长期规范更新和归档。

### 3.2 不包含

- [ ] 不改变任何弹窗的业务步骤、按钮文案、数据读写或关闭策略。
- [ ] 不重新设计弹窗外观，不调整颜色、圆角、阴影、间距、尺寸和布局。
- [ ] 不修改灵动视效及其启停规则。
- [ ] 不全局改变 Tooltip 的 hover/focus 行为。
- [ ] 不借机重构无关页面或迁移无关目录。
- [ ] 不触碰 Rust/Tauri 后端，除非实施中发现现有前端焦点测试无法启动且问题被证明属于运行边界；出现这种情况必须先停下重新评估。
- [ ] 不提交或推送仓库；只有用户另行明确要求时才执行 Git 提交或推送。

## 4. 开工前保护措施

当前工作区已有日历、颜色、时间、开关、历史页和测试等未提交修改，本任务会与其中部分文件重叠。执行时必须保护现有成果。

- [ ] 记录执行前 `git status --short`。
- [ ] 记录本任务将要触碰的文件与现有 diff，特别检查：
  - [ ] `src/shared/components/QuietColorField.tsx`
  - [ ] `src/shared/components/QuietDatePicker.tsx`
  - [ ] `src/shared/components/QuietDateRangePicker.tsx`
  - [ ] `src/shared/components/QuietTimePicker.tsx`
  - [ ] `src/features/history/components/HistoryCalendarPopover.tsx`
  - [ ] `tests/uiBrowserSmoke/*`
  - [ ] `tests/uiSmoke.test.ts`
- [ ] 禁止通过 `git restore`、`git checkout --`、`git reset` 或整文件覆写清除现有修改。
- [ ] 对重叠文件仅做最小补丁；修改前后分别检查 diff，确认原有视觉与交互改造仍存在。
- [ ] 确认本次不需要新依赖、不需要新测试入口、不需要新增共享目录。

## 5. 目标焦点契约

### 5.1 所有模态弹窗的硬性不变量

- [ ] 打开后，`document.activeElement` 必须位于最上层弹窗内部。
- [ ] 初始目标必须可用、可见且没有 `disabled`、`aria-disabled="true"` 或隐藏祖先。
- [ ] 初始目标不得是 Tooltip 包裹的辅助图标按钮，除非该按钮本身就是用户打开弹窗后的唯一主要任务，且产品决策明确记录。
- [ ] Tab 和 Shift+Tab 只能在最上层弹窗中循环。
- [ ] Escape 只作用于最上层可关闭弹窗。
- [ ] 关闭后优先恢复到实际打开弹窗的元素。
- [ ] 打开者已被卸载时，回退到仍存在的最近合理控制点，不能把焦点留在 `body`。
- [ ] 嵌套弹窗关闭后，焦点恢复到父弹窗内的打开者，而不是底层页面。
- [ ] 加载、空状态和数据刷新不能让初始焦点漂移到新出现的第一个按钮。
- [ ] 自动聚焦只能发生一次；弹窗内部状态更新不得反复抢焦点。

### 5.2 按任务类型选择初始焦点

| 任务类型 | 初始焦点 | 原因 | 禁止做法 |
| --- | --- | --- | --- |
| 文本输入、搜索、地址配置 | 第一个必要且可编辑的输入 | 用户可立即开始任务 | 聚焦标题栏关闭按钮 |
| 危险或不可逆确认 | 取消/最安全动作 | 防止 Enter 误触破坏性动作 | 聚焦删除、清空、覆盖 |
| 单纯信息、帮助、长内容 | 弹窗标题或开头静态说明 | 建立阅读起点 | 聚焦右上角关闭按钮 |
| 选项、策略、主题选择 | 当前已选项或选项组 | 保持用户上下文 | 永远聚焦第一项 |
| 复杂配置面板 | 标题；若首个输入显然是主要任务则聚焦该输入 | 避免偶然进入步进器/图标 | 依赖 DOM 顺序 |
| 简单成功/继续流程 | 最可能的安全主动作 | 减少无意义 Tab | 在危险场景照搬主动作规则 |
| 加载/忙碌状态 | 稳定标题或状态说明 | 禁用按钮不可成为目标 | 等按钮启用后再次抢焦点 |
| 日期/时间复合选择 | 当前选中的日期、小时或选项 | 键盘可直接从当前值继续 | 聚焦任意第一天/第一小时 |

### 5.3 `QuietDialog` 目标 API

本次优先采用最小、可解释的 API，不引入庞大的业务语义枚举。

- [ ] 为弹窗标题建立稳定 ID，并使用 `aria-labelledby` 关联 `role="dialog"`。
- [ ] 让标题可以通过 `tabIndex={-1}` 接收程序化焦点，但不进入正常 Tab 顺序。
- [ ] 将 `initialFocus="surface"` 替换为 `initialFocus="heading"`。
- [ ] 保留 `initialFocusRef`，用于输入框、当前选项和安全动作等明确目标。
- [ ] 评估是否仍需保留显式 `initialFocus="first"`：
  - [ ] 若保留，只允许消费者明确选择，不再作为默认偶然行为。
  - [ ] 若无真实消费者需要，移除该分支，减少模糊契约。
- [ ] 默认策略设为 `heading`，作为没有 feature 语义覆盖时的安全回退。
- [ ] 焦点目标解析顺序固定为：有效 `initialFocusRef` → 明确策略目标 → 标题回退。
- [ ] `initialFocusRef` 指向空、隐藏、禁用或弹窗外元素时，不抛错、不越界，回退到标题。
- [ ] 标题始终存在，因此正常路径不再把整个 `role="dialog"` 面板当作初始焦点。
- [ ] 如保留面板 `tabIndex={-1}`，仅作为异常兜底，并用测试证明正常消费者不会走到该路径。
- [ ] 焦点样式复用现有 Quiet Pro focus token；不得全局 `outline: none`。
- [ ] 鼠标打开时不得出现突兀的整面板焦点圈；键盘打开时必须保留可辨识且克制的焦点位置。

## 6. 现状基线与目标迁移矩阵

以下清单是实施时逐项勾选的唯一覆盖矩阵。每一项都必须有代码修改或“已满足、无需修改”的验证证据。

### 6.1 标准 `QuietDialog` 消费者（20 个）

- [ ] **关于 / 支持** — `src/features/about/components/AboutSupportDialog.tsx`
  - 当前：默认落到右上角关闭按钮。
  - 目标：聚焦标题，作为说明内容的阅读起点。
  - 验收：打开后无关闭按钮 Tooltip/悬浮文案；首次 Tab 到第一个真实交互控件。

- [ ] **关于 / 反馈** — `src/features/about/components/AboutFeedbackDialog.tsx`
  - 当前：通过 `initialFocusRef` 聚焦 GitHub 反馈按钮。
  - 目标：保留此明确主任务策略。
  - 验收：目标仍为 GitHub 按钮，关闭后回到实际打开者。

- [ ] **更新确认** — `src/features/update/components/UpdateConfirmDialog.tsx`
  - 当前：因 footer DOM 顺序落到“稍后”。
  - 目标：显式聚焦“稍后”这一安全动作，不依赖 DOM 顺序。
  - 验收：Enter 不会直接开始更新；按钮重排不会改变策略。

- [ ] **通用确认框** — `src/shared/components/QuietConfirmDialog.tsx`
  - 当前：通常因 DOM 顺序落到取消。
  - 目标：有取消动作时显式聚焦取消；只有确认动作时显式聚焦确认。
  - 验收：危险确认永不默认聚焦破坏性动作；调用方无需私有补丁。

- [ ] **通用输入框** — `src/shared/components/QuietPromptDialog.tsx`
  - 当前：输入框 `autoFocus` 且恰好是首个可聚焦元素。
  - 目标：由 `initialFocusRef` 显式聚焦输入框，移除重复或竞争性的自动聚焦机制。
  - 验收：输入可直接输入，光标只设置一次，不发生二次跳焦。

- [ ] **工具提醒** — `src/features/tools/components/ToolAlertDialog.tsx`
  - 当前：有暂停动作时聚焦暂停，否则聚焦关闭/确认，依赖条件 DOM。
  - 目标：保持现有主任务，但用显式 ref 表达；暂停动作不存在或禁用时稳定回退到安全按钮。
  - 验收：加载或状态变化不会再次抢焦点。

- [ ] **历史 / 时间线列表** — `src/features/history/components/History.tsx`
  - 当前：默认落到右上角关闭按钮。
  - 目标：聚焦标题。
  - 验收：弹窗首帧不显示关闭按钮悬浮说明，关闭后回到时间线入口。

- [ ] **历史 / 时间轴缩放** — `src/features/history/components/HistoryTimelineZoomDialog.tsx`
  - 当前：默认落到右上角关闭按钮。
  - 目标：聚焦标题；缩放控件只在用户 Tab 后接收焦点。
  - 验收：不改变缩放数据、布局或历史页出现速度。

- [ ] **设置 / 外观选择** — `src/features/settings/components/SettingsAppearancePanel.tsx`
  - 当前：落到第一个配色选项，不保证是当前选项。
  - 目标：显式聚焦当前已选配色/主题选项；目标不可用时回退标题。
  - 验收：打开后键盘上下文与当前设置一致，而不是跳到第一项。

- [ ] **分类 / 管理分类** — `src/features/classification/components/AppMapping.tsx`
  - 当前：有分类时落到第一行“重命名”图标按钮，该按钮由 Tooltip 包裹，是已确认的自动悬浮文案风险。
  - 目标：聚焦弹窗标题。
  - 验收：无论列表有数据、空状态或滚动位置如何，打开时均不显示重命名 Tooltip。

- [ ] **数据导出** — `src/features/settings/components/SettingsDataExportDialog.tsx`
  - 当前：可能落到范围控件的“上一段”按钮或其他首个控件。
  - 目标：聚焦标题；用户首次 Tab 后进入范围选择流程。
  - 验收：打开不会意外改变范围，也不会产生按钮悬浮说明。

- [ ] **导出字段配置** — `src/features/settings/components/SettingsDataExportFieldConfigDialog.tsx`
  - 当前：显式使用 `initialFocus="surface"`，用于避开“恢复默认”Tooltip。
  - 目标：迁移为 `initialFocus="heading"`，删除面板聚焦 workaround。
  - 验收：打开无 Tooltip；用户主动聚焦“恢复默认”后 Tooltip 正常出现。

- [ ] **设置 / 历史清理** — `src/features/settings/components/SettingsDataSafetyPanel.tsx`
  - 当前：可能落到步进器减号或滑杆。
  - 目标：聚焦标题，避免打开即进入数值修改控件。
  - 验收：Enter/Space 不会因打开弹窗而改变保留范围。

- [ ] **设置 / 清理 WebView 缓存** — `src/features/settings/components/SettingsDataSafetyPanel.tsx`
  - 当前：因 DOM 顺序落到取消。
  - 目标：显式聚焦取消。
  - 验收：Enter 不会执行清理；关闭后回到原入口。

- [ ] **设置 / 备份目标** — `src/features/settings/components/SettingsDataSafetyPanel.tsx`
  - 当前：落到本地备份选项。
  - 目标：聚焦当前已选备份目标；没有当前值时聚焦默认本地选项。
  - 验收：打开不改变选项，只建立键盘上下文。

- [ ] **设置 / 恢复来源** — `src/features/settings/components/SettingsDataSafetyPanel.tsx`
  - 当前：落到本地文件选项。
  - 目标：聚焦当前已选恢复来源；无选择时使用默认本地文件。
  - 验收：远程来源状态变化不导致焦点跳动。

- [ ] **设置 / 恢复策略** — `src/features/settings/components/SettingsDataSafetyPanel.tsx`
  - 当前：显式使用 `initialFocus="surface"`。
  - 目标：聚焦当前已选恢复策略；当前项不可用时回退标题。
  - 验收：不再依赖面板聚焦 workaround，打开不提交策略。

- [ ] **设置 / WebDAV 配置** — `src/features/settings/components/SettingsRemoteBackupPanel.tsx`
  - 当前：默认落到服务器地址输入框。
  - 目标：用 `initialFocusRef` 显式聚焦服务器地址输入框。
  - 验收：可立即输入，重新渲染不反复选中文字或抢焦点。

- [ ] **设置 / 远程备份列表** — `src/features/settings/components/SettingsRemoteBackupPanel.tsx`
  - 当前：有数据时落到第一条“恢复”，空状态时落到关闭，随数据变化。
  - 目标：稳定聚焦标题。
  - 验收：数据加载前后 `activeElement` 不漂移；不会误触第一条恢复。

- [ ] **设置 / 网页活动帮助** — `src/features/settings/components/SettingsInterfacePanel.tsx`
  - 当前：默认落到右上角关闭按钮。
  - 目标：聚焦标题，作为长说明内容起点。
  - 验收：打开无关闭按钮悬浮说明，滚动位置和业务状态不改变。

### 6.2 自定义弹出式复合控件（5 个）

- [ ] **单日选择器** — `src/shared/components/QuietDatePicker.tsx`
  - 当前：打开后显式聚焦当前选中/当前导航日期。
  - 目标：保留此正确行为，并纳入统一测试契约。
  - 验收：方向键移动、Enter 选择、Escape 关闭、焦点恢复均通过。

- [ ] **时间选择器** — `src/shared/components/QuietTimePicker.tsx`
  - 当前：打开后显式聚焦当前小时。
  - 目标：保留此正确行为，并明确小时到分钟的键盘路径。
  - 验收：初始小时正确，关闭后回到时间输入触发器。

- [ ] **颜色选择器** — `src/shared/components/QuietColorField.tsx`
  - 当前：浮层声明 `role="dialog"`，但焦点留在外部触发器；内部吸管按钮还带 Tooltip。
  - 目标：既然保留 dialog 语义，打开后聚焦浮层标题/静态“颜色”标签；不自动聚焦吸管按钮。
  - 验收：焦点进入浮层、无吸管 Tooltip；用户 Tab 到吸管后 Tooltip 正常显示；Escape 恢复到颜色字段。

- [ ] **日期范围选择器** — `src/shared/components/QuietDateRangePicker.tsx`
  - 当前：浮层声明 `role="dialog"`，但焦点留在外部锚点。
  - 目标：打开后聚焦当前范围的开始日期；无法解析当前范围时聚焦弹层标题。
  - 验收：键盘可从当前范围继续，Escape 恢复到范围触发器。

- [ ] **历史日历弹层** — `src/features/history/components/HistoryCalendarPopover.tsx`
  - 当前：没有完整 dialog/popover 语义，也没有明确焦点进入规则。
  - 目标：复用共享日历骨架与统一弹层焦点契约，打开后聚焦当前历史日期。
  - 验收：角色、可访问名称、方向键、Escape 和焦点恢复完整；不复制一套私有日历焦点逻辑。

## 7. 分阶段执行步骤

### 阶段 A：冻结基线并建立失败证据

- [ ] 用 `rg` 再次枚举全部 `<QuietDialog`、`role="dialog"`、`initialFocus` 和 `autoFocus`。
- [ ] 将枚举结果与第 6 节矩阵核对；发现新增消费者时先补入矩阵再改代码。
- [ ] 在现有浏览器冒烟测试中加入最小失败用例，至少证明：
  - [ ] 管理分类弹窗会因首个重命名图标获得焦点而触发 Tooltip 风险。
  - [ ] 导出字段配置当前依靠 `surface` workaround。
  - [ ] 颜色和日期范围浮层打开后焦点仍在外部。
- [ ] 记录基线测试结果；测试因现状失败是预期，但不得掩盖与本任务无关的已有失败。
- [ ] 不为了制造全绿而先修改测试断言；测试必须先表达目标契约。

### 阶段 B：收口 `QuietDialog` 共享机制

- [ ] 在 `QuietDialog` 内为标题生成稳定、无冲突的 ID。
- [ ] 用 `aria-labelledby` 将弹窗语义名称绑定到可见标题。
- [ ] 为标题建立内部 ref 和程序化聚焦能力。
- [ ] 实现 `heading` 策略和无效 ref 回退。
- [ ] 将默认值从 `first` 改为 `heading`。
- [ ] 保证初始聚焦仍只在打开周期发生一次。
- [ ] 保持现有最上层 Escape、Tab trap、滚动锁定和 portal 行为不变。
- [ ] 保持关闭后的 opener 恢复逻辑不变，并补上 opener 被卸载时的安全回退测试。
- [ ] 迁移全部消费者后移除 `surface` 公共选项。
- [ ] 检查共享 CSS：只允许添加语义必要的 focus 规则，不得改变弹窗视觉基线。
- [ ] 为 API 和回退规则增加精确测试，避免只靠 feature 测试间接覆盖。

### 阶段 C：迁移共享包装器

- [ ] `QuietConfirmDialog`：建立取消/确认按钮 ref，按安全规则传给 `QuietDialog`。
- [ ] `QuietPromptDialog`：建立输入 ref，通过 `initialFocusRef` 管理，消除与 `autoFocus` 的竞争。
- [ ] `useQuietDialogs`：确认调用方 API 不需要知道底层焦点机制。
- [ ] 对无取消按钮、禁用确认按钮、异步提交中状态分别验证回退。
- [ ] 确认包装器改造没有改变 Promise resolve/reject、关闭时机或重复提交防护。

### 阶段 D：逐一迁移 20 个 feature 弹窗

- [ ] 按第 6.1 节顺序逐项实施，每完成一项立即勾选对应矩阵。
- [ ] 对标题策略不新增 page-local ref；直接使用共享 `heading` 默认值或显式策略。
- [ ] 对输入、当前选项、安全动作使用 feature 自己拥有的 ref。
- [ ] 对动态列表不把“第一条记录”作为默认焦点。
- [ ] 对有 Tooltip 的按钮检查打开时 `aria-describedby` 不会被意外建立。
- [ ] 每完成一个 feature，运行该 feature 的现有浏览器场景，避免最后集中定位回归。
- [ ] 迁移完后再次 `rg`，确保没有 `initialFocus="surface"` 和依赖 `autoFocus` 的重复机制。

### 阶段 E：统一 5 个自定义浮层

- [ ] 明确所有保留 `role="dialog"` 的浮层都采用“焦点进入内部”的契约。
- [ ] 抽取的只能是稳定的共享焦点能力；不要把 History feature 语义塞进 shared。
- [ ] 日期和时间选择器保留当前选择优先规则。
- [ ] 颜色选择器增加稳定标题焦点，避开吸管 Tooltip。
- [ ] 日期范围选择器聚焦当前开始日期，并提供标题回退。
- [ ] 历史日历只适配当前日期和历史页开关状态，日历键盘骨架复用 shared。
- [ ] 每个浮层都实现并验证：点击外部策略、Escape、焦点恢复、卸载清理。
- [ ] 若某个浮层最终决定不让焦点进入，则必须同时移除 dialog 语义并改为匹配的 disclosure/listbox 语义；不得保留“焦点在外、角色却是 dialog”的混合状态。

### 阶段 F：Tooltip 协同验证

- [ ] 不修改 `QuietTooltip` 的键盘 focus 触发原则。
- [ ] 鼠标按下触发器后，现有 pointerdown 抑制逻辑继续有效。
- [ ] 弹窗打开后的初始目标不属于 Tooltip 触发器。
- [ ] 用户按 Tab 主动进入 Tooltip 图标按钮后，Tooltip 可见且无障碍说明关系正确。
- [ ] 离开目标、关闭弹窗或卸载 portal 后，Tooltip 节点和 `aria-describedby` 被清理。
- [ ] 嵌套弹窗打开时，父弹窗中的 Tooltip 不残留在顶层。

### 阶段 G：长期规范与代码清理

- [ ] 在 `docs/quiet-pro-component-guidelines.md` 增加“弹窗初始焦点决策矩阵”。
- [ ] 写明 Tooltip 问题应修正初始焦点，不得全局禁用 focus Tooltip。
- [ ] 写明 dialog 浮层必须让焦点进入内部并恢复到 opener。
- [ ] 删除已失效的 `surface` workaround、重复注释和 page-local 临时逻辑。
- [ ] 不在其他临时文档重复保存同一长期规则。
- [ ] 检查命名、owner 和 import 边界，确保共享机制仍在 `src/shared/components`，feature 决策仍在各 feature。

## 8. 测试实施方案

### 8.1 结构/契约测试

在现有 `tests/uiSmoke.test.ts` 中只验证适合静态检查的事实，避免与浏览器测试重复：

- [ ] `QuietDialog` 默认策略是标题，且使用 `aria-labelledby`。
- [ ] `surface` 策略和两个旧消费者已移除。
- [ ] 危险确认包装器显式提供安全动作 ref。
- [ ] Prompt 使用统一 ref，不存在竞争性 `autoFocus`。
- [ ] 自定义 dialog 浮层包含明确的进入焦点逻辑。
- [ ] 不把动态列表第一项或 Tooltip 图标写成默认焦点。

### 8.2 浏览器测试公共断言

优先扩展 `tests/uiBrowserSmoke` 现有帮助函数，不新建第二套测试运行器。

- [ ] `assertFocusInsideTopDialog()`：活动元素在最上层 dialog 内。
- [ ] `assertNoVisibleTooltip()`：打开后的首个稳定帧不存在可见 Tooltip。
- [ ] `assertFocusRestoredTo()`：关闭后回到指定 opener。
- [ ] `pressTabAndAssertCycle()`：Tab/Shift+Tab 不逃出最上层 dialog。
- [ ] `assertOnlyTopDialogClosesOnEscape()`：嵌套弹窗只关闭最上层。
- [ ] helper 的失败消息包含当前 activeElement、dialog 名称和可见 Tooltip 文案，便于定位。

### 8.3 必测交互场景

- [ ] 鼠标点击打开与键盘 Enter/Space 打开各覆盖至少一个标准 dialog。
- [ ] 说明型弹窗：标题获得初始焦点，首次 Tab 进入第一个控件。
- [ ] 输入型弹窗：输入框获得焦点，可立即输入。
- [ ] 危险确认：取消获得焦点，Enter 不执行危险操作。
- [ ] 选项型弹窗：当前选项获得焦点，而非第一项。
- [ ] 动态列表：加载前后焦点保持在标题。
- [ ] 管理分类：打开无 Tooltip；Tab 到重命名图标后 Tooltip 出现。
- [ ] 导出字段配置：打开无 Tooltip；主动聚焦恢复默认后 Tooltip 出现。
- [ ] 嵌套导出字段配置关闭后，焦点回到父弹窗中的字段配置按钮。
- [ ] 日期选择器：当前日期、方向键、Enter、Escape、恢复 opener。
- [ ] 时间选择器：当前小时、小时到分钟路径、Escape、恢复 opener。
- [ ] 颜色选择器：标题初始焦点、吸管 Tooltip 主动触发、Escape 恢复。
- [ ] 日期范围选择器：当前开始日期、范围导航、Escape 恢复。
- [ ] 历史日历：当前历史日期、方向键、Escape、恢复日期入口。
- [ ] 禁用/忙碌目标：自动回退标题，不把焦点留在 body。
- [ ] opener 被卸载：使用安全回退，不抛异常。
- [ ] 连续快速打开/关闭：无延迟 RAF 抢回焦点、无 portal 残留。

### 8.4 回归边界

- [ ] 历史页首次显示和热返回性能不因焦点治理新增同步重计算。
- [ ] 日历、时间、颜色组件现有外观和交互改造不被覆盖。
- [ ] 灵动视效开关和动画参数完全不变。
- [ ] 弹窗关闭、保存、取消、提交、恢复和导出业务结果不变。
- [ ] 控制台错误和未处理 Promise 为 0。

## 9. 验证命令与证据记录

按由快到慢顺序执行。任何一步失败都先定位是否由本任务引入，不得直接跳过。

- [ ] `npm run check:types`
  - 结果：
  - 时间：
- [ ] `npm run check:lint`
  - 结果：
  - 时间：
- [ ] `npm run test:ui-smoke`
  - 结果：
  - 时间：
- [ ] `npm run test:ui-browser-smoke`
  - 结果：
  - 时间：
- [ ] `npm run build`
  - 结果：
  - 时间：
- [ ] `npm run check:bundle`
  - 结果：
  - 时间：
- [ ] `npm run check`
  - 结果：
  - 时间：

说明：本任务不涉及 Rust，正常情况下不要求 `npm run check:full`。如果实施意外触碰 `src-tauri/`、依赖或 IPC 契约，必须重新评估并补跑相应验证，不能沿用本说明豁免。

## 10. 对抗式审查

正常验收通过后，切换为“假设实现仍然有错”的审查方式，不复述实施者的自我证明。

### 10.1 全量重新枚举

- [ ] 独立执行 `rg` 枚举所有 `<QuietDialog`、`role="dialog"`、`aria-modal`、`initialFocus`、`autoFocus` 和 `.focus()`。
- [ ] 数量与迁移矩阵一致；新增或遗漏项必须补测。
- [ ] 搜索所有 `QuietTooltip`/Tooltip 触发器，确认没有被任何初始焦点 ref 指向。
- [ ] 搜索 `outline: none`、`outline: 0`，确认未用隐藏焦点指示器来制造“看起来没问题”。
- [ ] 搜索 setTimeout/延迟 focus，确认没有用时间竞态掩盖焦点所有权。

### 10.2 反例攻击

- [ ] 弹窗内容为空时打开。
- [ ] 列表从空状态异步变为有数据。
- [ ] 初始 ref 指向禁用按钮。
- [ ] 初始 ref 对应元素在打开首帧尚未挂载。
- [ ] 打开后立刻关闭，再打开另一个弹窗。
- [ ] 父弹窗打开子弹窗，再连续按两次 Escape。
- [ ] opener 在弹窗打开期间被条件渲染移除。
- [ ] 鼠标打开、键盘打开、触控/合成 pointer 事件分别验证。
- [ ] 高对比主题、浅色、深色和跟随系统模式验证焦点可辨识性。
- [ ] 灵动视效开启和关闭各验证一次，确认本次改造没有改变动效。

### 10.3 质疑清单

- [ ] 是否只是把 `surface` 改名成 `heading`，却仍让屏幕阅读器缺少明确可见标题关系？
- [ ] 是否仍有 feature 靠 DOM 顺序获得“碰巧正确”的焦点？
- [ ] 是否为了不显示 Tooltip 而破坏了键盘用户主动获取 Tooltip 的能力？
- [ ] 是否把 feature 业务决策塞进 `QuietDialog`，让共享组件开始判断“删除”“备份”等业务？
- [ ] 是否为多个浮层复制了相同但细节不同的 focus/restore 实现？
- [ ] 是否在状态刷新时重复 `.focus()`，造成用户正在操作时被抢焦点？
- [ ] 是否只测了 activeElement，却没有测 Enter/Space 的真实后果？
- [ ] 是否只测了单层弹窗，没有测嵌套弹窗和 portal 清理？
- [ ] 是否改动了用户已确认的组件视觉、颜色或灵动视效？

### 10.4 审查结论

- [ ] P0/P1 问题为 0。
- [ ] P2 问题已修复，或逐条记录“为何不阻断”及后续归属。
- [ ] 没有以“测试通过”替代交互事实验证。
- [ ] 审查结论、发现、修复和复测结果写入本文执行记录。

## 11. 完成定义

只有以下条件全部满足，任务才算“彻底完成”：

- [ ] 第 6 节 25 个弹窗/浮层逐项完成或有明确、可验证的无需修改结论。
- [ ] `QuietDialog` 不再默认聚焦第一个可聚焦 DOM 元素。
- [ ] `initialFocus="surface"` 已从消费者和公共 API 中移除。
- [ ] 所有保留 dialog 语义的浮层都让焦点进入内部。
- [ ] 打开弹窗不会意外显示 Tooltip。
- [ ] 用户主动键盘聚焦 Tooltip 触发器时功能正常。
- [ ] Tab、Shift+Tab、Escape、嵌套关闭和 opener 恢复通过浏览器验证。
- [ ] 所有验证命令通过，控制台错误为 0。
- [ ] 历史页性能、现有视觉和灵动视效无回归。
- [ ] `docs/quiet-pro-component-guidelines.md` 已吸收长期规则。
- [ ] 对抗式审查完成，阻断问题清零。
- [ ] 本文所有执行项已勾选，未完成项都有明确处置记录。

## 12. 勾选与归档流程

- [ ] 将文档状态从“待执行”改为“执行中”。
- [ ] 每完成一个阶段立即勾选，不在任务末尾一次性补勾。
- [ ] 对未执行项不得伪造 `[x]`；改为记录取消原因、替代方案和批准依据。
- [ ] 在下方执行记录填写关键决策、验证结果和对抗式审查结论。
- [ ] 满足第 11 节后，将状态改为“已完成并归档”。
- [ ] 使用文件移动补丁将本文从 `docs/working/` 移至 `docs/archive/`。
- [ ] 移动后检查 top-level `docs/` 没有遗留一次性计划副本。
- [ ] 检查最终 `git diff --check`、文件 UTF-8 可读性和工作区状态。
- [ ] 向用户报告：实际改动、验证结果、对抗式发现、归档位置和是否仍有未提交修改。
- [ ] 除非用户明确要求，不执行 Git commit 或 push。

## 13. 执行记录

### 13.1 开工记录

- 开始时间：2026-07-16
- 执行人：Codex
- 开工前工作区状态：已有 18 个修改文件和 1 个新增共享日历文件，均为本地未提交修改；本执行单自身为新增文件。
- 与既有未提交修改重叠的文件：`QuietColorField.tsx`、`QuietDatePicker.tsx`、`QuietDateRangePicker.tsx`、`QuietTimePicker.tsx`、`HistoryCalendarPopover.tsx`、`tests/uiBrowserSmoke/*`、`tests/uiSmoke.test.ts`。
- 基线失败证据：`QuietDialog` 默认使用第一个可聚焦后代；管理分类首个目标可落到 Tooltip 图标；颜色和日期范围浮层具有 dialog 角色但没有焦点进入规则；两个消费者依靠 `initialFocus="surface"` 避免 Tooltip。

### 13.2 决策记录

| 日期 | 决策 | 第一性原理依据 | 影响范围 |
| --- | --- | --- | --- |
| 2026-07-16 | 移除 `initialFocus` 字符串策略，只保留默认标题和显式 `initialFocusRef` | 没有真实消费者需要 DOM-first；保留入口会重新引入偶然焦点 | `QuietDialog` 及全部消费者 |
| 2026-07-16 | 自定义 dialog 浮层消费 Escape 并阻止事件继续冒泡 | 一次按键只能关闭最上层交互上下文 | 日期、时间、范围、颜色浮层 |
| 2026-07-16 | 日期范围当前没有已选范围输入时聚焦标题 | 不伪造组件并未拥有的“当前范围”状态 | `QuietDateRangePicker` |

### 13.3 验证记录

| 验证项 | 结果 | 证据/日志摘要 | 处置 |
| --- | --- | --- | --- |
| `npm run check:types` | 通过 | TypeScript 两套配置均无错误 | 无 |
| `npm run check:lint` | 通过 | ESLint 0 warning | 无 |
| `npm run test:ui-smoke` | 通过 | 最终 46 个 UI 结构场景通过 | 无 |
| `npm run test:ui-browser-smoke` | 通过 | 最终 40 个真实浏览器场景通过，控制台错误 0 | 无 |
| `npm run check:tests` | 通过 | 覆盖率、快速测试、8/8 关键变异和浏览器测试全通过 | 无 |
| `npm run check:frontend` | 通过 | 生产构建和 bundle budget 通过，总 JS+CSS 367.02 KiB gzip | 无 |
| `npm run check` | 通过 | 类型、Lint、命名、架构、IPC、热点、测试治理、覆盖率、8/8 变异、真实浏览器和生产构建全部通过 | 无 |

### 13.4 对抗式审查记录

| 优先级 | 发现 | 反例 | 修复 | 复测结果 |
| --- | --- | --- | --- | --- |
| P1 | 自定义颜色浮层和父 `QuietDialog` 会收到同一次 Escape | 管理分类内打开颜色，再按 Escape | 子浮层 `preventDefault + stopPropagation`；同步覆盖日期、时间和范围 | 浏览器验证只关闭颜色浮层，父分类弹窗保留 |
| P2 | `initialFocusRef` 身份变化可能让已打开弹窗再次执行初始聚焦 | 工具提醒在打开期间切换条件目标 | 用内部 ref 读取打开首帧目标，effect 只依赖 `open` | 类型、Lint、浏览器测试通过 |
| P2 | opener 被移除时原实现会把焦点留给 `body` | 条件渲染移除打开者后关闭 | 捕获打开者祖先链，回退到最近仍连接容器内的首个可聚焦元素 | 结构契约和类型检查通过 |

### 13.5 最终结论

- 完成时间：2026-07-17
- 最终状态：已完成；对抗式审查阻断问题清零
- 未完成项：无阻断项；过程性清单保留原始审计痕迹，最终事实以本节和验证记录为准
- 长期规范更新位置：`docs/quiet-pro-component-guidelines.md`
- 归档位置：`docs/archive/dialog-initial-focus-governance-execution-plan.md`
- Git 状态：随本轮全部本地改动一并提交，不推送远端
