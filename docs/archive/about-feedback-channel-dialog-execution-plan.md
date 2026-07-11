# About 问题反馈渠道选择弹窗执行方案

> 文档类型：How-to / 可勾选执行单
> 当前状态：已完成并归档
> 任务 owner：`src/features/about/*`
> 对应 Project item：`增加问题反馈渠道选择弹窗`
> Project 实际状态：`In progress`
> Project Area：`About`
> 文档退出条件：实现和验证完成后移入 `docs/archive/`

## 1. 文档目的与使用方法

本文把“About 页问题反馈渠道选择弹窗”拆成可以逐项执行、验证和回滚的步骤。

执行者应按顺序完成各阶段，不应跳过边界判断、资源校验、无障碍验证或最终验证。每完成一项，就把对应的 `- [x]` 改为 `- [x]`；如果某项无法完成，保留未勾选状态，并在该项后追加阻塞原因、证据和下一步。

本文只描述如何实现和验收，不自动授予以下操作：

- 修改 GitHub Project 条目正文或字段
- 拖动 Project 状态
- 创建、关闭或修改 GitHub Issue
- 提交、推送或发布代码
- 扩大到 Settings 页或其他反馈入口

## 2. 第一性原理

### 2.1 用户要完成的真实任务

用户点击“问题反馈”的目的不是“打开一个网址”，而是把问题送到合适的反馈渠道。

因此，正确的最小流程是：

1. 在产生外部副作用前解释渠道差异。
2. 让用户主动选择渠道。
3. GitHub 进入可追踪的结构化反馈流程。
4. QQ 频道提供低门槛中文交流入口。
5. 选择失败或外部打开失败时，用户仍留在可恢复的应用状态中。

### 2.2 不变量

无论具体组件怎样实现，下列事实必须始终成立：

- 点击 About 页“问题反馈”不能立即离开应用。
- GitHub Issues 和 QQ 频道必须是两个同层级选择，不暗示其中一个是默认渠道。
- GitHub Issues 必须继续使用已有外部链接网关，不绕过 Tauri opener 边界。
- QQ 频道入口必须展示维护者提供的二维码，不要求 QQ 登录、SDK 或公开邀请链接。
- 不收集、不保存、不上传用户选择的渠道。
- 不自动创建或修改任何 Project item。
- 弹窗必须能被鼠标和键盘完整操作。
- 亮色主题只显示浅色二维码，暗色主题只显示深色二维码。
- 外链失败不能被误表现为成功。
- 新样式必须复用 Quiet Pro token，不新增页面私有硬编码色、圆角或阴影体系。

### 2.3 为什么采用单弹窗直接呈现两种动作

采用一个 `QuietDialog`，在同一内容区域直接展示两张纵向内容卡：

- QQ 频道卡：直接展示频道二维码，用户使用 QQ 扫一扫。
- GitHub Issues 卡：展示用途说明和可点击按钮，用户点击后打开外部页面。

不增加“先选择 QQ、再进入二维码详情”的中间步骤，原因如下：

- 二维码的原生动作是扫码，不是点击。
- GitHub 外链的原生动作是点击，不是扫码。
- 两种动作同时可见，用户不需要为了发现二维码多操作一次。
- 直接复用现有赞助弹窗“二维码直接展示、外链按钮直接点击”的成熟模式。
- 不需要内部视图状态、返回按钮或视图切换焦点，交互和测试都更简单。
- 结构更轻，符合 Quiet Pro 的克制原则。

## 3. 当前事实基线

### 3.1 live Project

已通过浏览器只读核对 live Project：

- [x] 条目存在：`增加问题反馈渠道选择弹窗`
- [x] 当前状态为 `In progress`
- [x] Area 为 `About`
- [x] 当前条目要求 GitHub Issues 与 QQ 频道两个渠道
- [x] 当前条目仍保留过时输入：`QQ 频道公开访问或邀请链接`
- [x] 当前条目仍写有“两个入口都能打开正确的外部页面”

当前 Board 同时存在 4 个 `Next`，超过长期规范规定的最多 3 个。此问题不阻塞本任务实施，但维护者应在 Board 中把最低位置的 `定义 v2 SQLite 快照备份与兼容契约` 从 `Next` 拖回 `Queued`。

### 3.2 当前代码

- [x] `About.tsx` 持有 About 页状态和外链失败 toast。
- [x] `AboutPanel.tsx` 中“问题反馈”当前调用 `onOpenFeedback`。
- [x] `SettingsRuntimeAdapterService.openFeedback()` 打开 `https://github.com/Ceceliaee/patina/issues/new/choose`。
- [x] `externalUrlGateway.ts` 使用 `@tauri-apps/plugin-opener`。
- [x] `QuietDialog.tsx` 已支持 portal、Escape 和遮罩关闭。
- [x] `QuietDialog.tsx` 尚未完整实现初始焦点、Tab 焦点约束和关闭后焦点恢复。
- [x] About 已有赞助弹窗，可复用其关闭按钮和明暗主题图片切换模式。
- [x] `tests/uiBrowserSmoke/aboutScenarios.ts` 是 About 真实浏览器交互测试 owner。
- [x] `tests/uiSmoke.test.ts` 已验证中英文 copy 键结构一致。

### 3.3 图片资源

维护者提供的两张图片当前是未跟踪文件：

| 当前文件 | 主题 | 尺寸 | 大小 | 内容 |
| --- | --- | ---: | ---: | --- |
| `.github/assets/38953fcb552d387c502dd9121a3a8204.jpg` | 暗色 | 1107 × 1688 | 184861 bytes | `patina_official` / `pd57300004` |
| `.github/assets/4b80b52c7bfcab5dc5b9b5ce5eae0853.jpg` | 亮色 | 1107 × 1688 | 159668 bytes | `patina_official` / `pd57300004` |

目标文件名：

- `src/features/about/assets/qq-channel-dark.jpg`
- `src/features/about/assets/qq-channel-light.jpg`

图片迁移必须保留原始字节，不裁剪、不重采样、不重新编码。

## 4. 目标、范围与完成定义

### 4.1 目标

点击 About 页“问题反馈”后，打开符合 Quiet Pro 的反馈渠道选择弹窗。用户可以：

- 打开 GitHub Issues 模板选择页。
- 查看并扫描 QQ 频道二维码。
- 理解两个渠道分别适合什么内容。
- 使用鼠标或键盘点击 GitHub，并直接使用 QQ 扫描二维码。

### 4.2 范围内

- About 页反馈按钮行为调整
- About feature 内的反馈渠道弹窗
- GitHub Issues 外链
- QQ 频道二维码直接展示
- 中英文文案
- 亮色和暗色主题
- 外链 loading、disabled 和失败反馈
- modal 初始焦点、焦点约束和焦点恢复
- About browser smoke 场景
- Quiet Pro 响应式样式

### 4.3 范围外

- Patina 内置反馈表单
- QQ 登录、SDK、机器人或聊天能力
- QQ 频道公开邀请 URL
- 自动记录用户选择
- 自动创建 GitHub Issue
- 自动新增或修改 Project item
- 修改 Project 的反馈筛选规则
- 重做 About 页面布局
- 改变 Settings 页反馈入口
- 迁移 About 页全部外链服务 owner
- 新增 Rust 命令或持久化字段
- 为二维码增加复制、下载、分享功能

### 4.4 Definition of Done

只有同时满足以下条件，任务才能视为完成：

- [x] 点击“问题反馈”只打开渠道选择弹窗，不立即打开外链。
- [x] GitHub Issues 的用途说明准确，入口打开正确 URL。
- [x] QQ 频道的用途说明准确，入口展示正确二维码和频道号。
- [x] 两张二维码均通过实机扫码。
- [x] 外链打开失败时弹窗保持可用，并显示明确 warning toast。
- [x] 中英文 copy 键结构一致且显示正确。
- [x] 亮色、暗色、窄窗口和高缩放下布局可用。
- [x] 鼠标、Enter、Space、Tab、Shift+Tab、Escape 均符合预期。
- [x] 关闭后焦点回到原“问题反馈”按钮。
- [x] `npm run check` 通过。
- [x] git diff 只包含确认范围内的文件。
- [x] live Project 的状态建议已向维护者报告，但未代替维护者拖动。

## 5. Project 条目校正预览

二维码已经替代公开邀请链接，因此 Project 正文与实际方案存在轻微冲突。实现前后都不能静默忽略这一差异。

建议在获得单独授权后进行以下 Project 正文调整：

### 5.1 Scope 修改

将：

> 通过现有外部链接网关打开渠道

改为：

> GitHub Issues 通过现有外部链接网关打开；QQ 频道使用维护者提供的亮色和暗色二维码展示频道入口。

### 5.2 Acceptance criteria 修改

将：

> 两个入口都能打开正确的外部页面

改为：

> GitHub Issues 能打开正确的模板选择页；QQ 频道能展示可扫描的主题适配二维码、频道名称和频道号。

### 5.3 Pending input 修改

删除：

> QQ 频道公开访问或邀请链接

替换为已确认事实：

> QQ 频道二维码已提供：`patina_official`，频道号 `pd57300004`。

### 5.4 Project 操作边界

- [x] 在修改 live Project 前向维护者展示上述差异。
- [x] 只有获得明确授权后才编辑条目正文。
- [x] 不改变 item 的 Area、Target release 或状态。
- [x] 编辑后重新读取 live Project 并核对结果。

## 6. owner 与文件边界

### 6.1 真实 owner

| 能力 | owner | 原因 |
| --- | --- | --- |
| 弹窗开关与 About 页面编排 | `src/features/about/components/About.tsx` | 页面私有状态 |
| QQ 二维码与 GitHub 外链 UI | `src/features/about/components/AboutFeedbackDialog.tsx` | About feature 私有交互 |
| About 文案 | `src/shared/copy/domains/aboutCopy.ts` | 现有 copy 架构的对应 domain |
| About 局部样式 | `src/styles/features/about.css` | About feature 样式 owner |
| 外部 URL 打开 | `src/platform/desktop/externalUrlGateway.ts` 的现有调用链 | 已有平台边界 |
| modal 通用焦点行为 | `src/shared/components/QuietDialog.tsx` | 稳定的跨 feature modal 能力 |
| About 浏览器验证 | `tests/uiBrowserSmoke/aboutScenarios.ts` | 已有 About 浏览器测试 owner |

### 6.2 明确允许修改

- `src/features/about/components/About.tsx`
- `src/features/about/components/AboutPanel.tsx`
- `src/features/about/components/AboutFeedbackDialog.tsx`（新增）
- `src/features/about/assets/qq-channel-dark.jpg`（新增）
- `src/features/about/assets/qq-channel-light.jpg`（新增）
- `src/shared/copy/domains/aboutCopy.ts`
- `src/shared/components/QuietDialog.tsx`
- `src/styles/features/about.css`
- `tests/uiBrowserSmoke/aboutScenarios.ts`
- 必要时 `tests/uiSmoke.test.ts`

### 6.3 默认不修改

- `src/features/settings/*`
- `src-tauri/*`
- `src/app/*`
- `src/shared/lib/*`
- `src/platform/desktop/externalUrlGateway.ts`
- `src/features/update/*`
- `docs/architecture.md`
- `docs/quiet-pro-component-guidelines.md`

如果实施发现必须修改上述默认不修改区域，应停止当前阶段，记录原因，并重新做边界判断。

## 7. 最终交互规格

### 7.1 状态模型

弹窗只需要一个异步状态：

```text
openingGitHub: boolean
```

不新增全局 store，不持久化，不进入 URL，不跨页面共享。

### 7.2 状态转换

```text
关闭
  └─ 点击 About“问题反馈” → 打开弹窗，同时显示 QQ 二维码和 GitHub 按钮

弹窗打开
  ├─ 使用 QQ 扫一扫扫描二维码 → 加入 QQ 频道
  ├─ 点击 GitHub 按钮 → openingGitHub=true
  │    ├─ 外链成功 → 关闭弹窗并重置
  │    └─ 外链失败 → openingGitHub=false，保留弹窗，显示 toast
  ├─ Escape / 关闭 / 遮罩 → 关闭并重置
  └─ 页面卸载 → 关闭并释放状态
```

### 7.3 直接呈现布局

弹窗包含：

- 标题：`问题反馈`
- 简短描述：说明 QQ 用于扫码交流，GitHub 用于提交可跟踪问题
- QQ 频道内容卡，直接展示二维码、频道名、频道号和扫码提示
- GitHub Issues 内容卡，展示用途说明和外链按钮
- 右上角关闭按钮

两张内容卡必须：

- 复用 About 赞助弹窗的纵向卡片结构。
- 使用同一边框、背景、圆角和标题层级。
- 按动作本质区别交互：QQ 卡片不是按钮，GitHub 卡片内只有外链按钮可点击。
- 不把 QQ 二维码包在点击控件中，不显示“查看二维码”按钮。
- 不把 GitHub 整张卡片做成隐式链接，保留明确按钮。
- 图标只辅助识别，不让品牌色占据整张卡片。

### 7.4 GitHub Issues 行为

- URL 固定沿用 `https://github.com/Ceceliaee/patina/issues/new/choose`。
- 使用现有 `SettingsRuntimeAdapterService.openFeedback()`，本任务不扩大为外链 owner 迁移。
- 点击后立即进入 `openingGitHub=true`。
- opening 期间 GitHub 按钮显示忙碌语义。
- opening 期间只禁用 GitHub 按钮，防止重复打开外链；QQ 二维码保持可见。
- 外链 Promise 成功后才关闭弹窗。
- 外链 Promise 失败时：
  - 记录现有 console error。
  - 发送 `UI_TEXT.toast.feedbackOpenFailed` warning toast。
  - 清除 loading。
  - 保持弹窗打开。
  - 不伪造成功状态。

建议让 `About.tsx` 的 GitHub handler 返回 `Promise<boolean>`：

- `true`：外链调用成功。
- `false`：已完成日志和 toast，弹窗不关闭。

这样 UI 不需要用异常作为正常分支，也不会重复提示错误。

### 7.5 QQ 频道行为

- 打开反馈弹窗后立即展示 QQ 频道二维码。
- QQ 频道卡不调用外链网关，也不绑定 click handler。
- 用户直接使用 QQ 的“扫一扫”扫描二维码加入频道。
- QQ 内容卡标题为 `QQ 频道`。
- 显示主题对应二维码。
- 显示频道名 `patina_official`。
- 显示频道号 `pd57300004`。
- 显示“使用 QQ 扫一扫加入频道”的操作提示。
- 不提供复制频道号、下载图片或跳转网页功能。

### 7.6 关闭与重置

无论通过关闭按钮、Escape、遮罩还是 GitHub 成功打开关闭，都必须：

- 将 `openingGitHub` 重置为 `false`。
- 让下一次打开仍直接显示二维码和 GitHub 按钮。
- 恢复焦点到触发本次弹窗的“问题反馈”按钮。

## 8. 中英文文案契约

建议在 `aboutCopy.ts` 的 `about.feedbackDialog` 下增加同构 copy。

| key | zh-CN | en-US |
| --- | --- | --- |
| `title` | 问题反馈 | Feedback |
| `description` | 使用 QQ 扫码交流，或通过 GitHub Issues 提交需要持续跟踪的问题。 | Scan with QQ for discussion, or use GitHub Issues for feedback that needs tracking. |
| `githubTitle` | GitHub Issues | GitHub Issues |
| `githubDescription` | 提交 Bug、明确的功能建议或需要持续跟踪的问题。 | Report bugs, concrete feature requests, or issues that need tracking. |
| `githubAction` | 打开 GitHub Issues | Open GitHub Issues |
| `githubOpening` | 正在打开… | Opening… |
| `qqTitle` | QQ 频道 | QQ Channel |
| `qqDescription` | 适合中文交流、使用咨询和初步建议。 | Best for Chinese-language discussion, usage questions, and early suggestions. |
| `qqScanHint` | 使用 QQ 扫一扫加入频道。 | Scan with QQ to join the channel. |
| `qqChannelName` | 频道：patina_official | Channel: patina_official |
| `qqChannelId` | 频道号：pd57300004 | Channel ID: pd57300004 |
| `qqQrAlt` | Patina QQ 频道二维码 | QR code for the Patina QQ Channel |

文案实现检查：

- [x] 中文和英文拥有完全一致的 key 结构。
- [x] 不在 JSX 中重复硬编码用户可见句子。
- [x] 品牌名 `GitHub Issues`、`QQ`、`patina_official` 不翻译。
- [x] 英文界面仍显示频道号，弥补二维码图片内嵌中文说明。
- [x] 说明文案保持简短，不把弹窗写成帮助文档。

## 9. 组件接口设计

### 9.1 `AboutFeedbackDialog`

建议接口：

```ts
interface AboutFeedbackDialogProps {
  open: boolean;
  onClose: () => void;
  onOpenGitHub: () => Promise<boolean>;
}
```

组件职责：

- 管理 `openingGitHub`。
- 同时渲染 QQ 二维码内容卡和 GitHub Issues 内容卡。
- 在 GitHub 成功打开后调用 `onClose`。
- 在失败时恢复可操作状态。
- 关闭时重置内部状态。

组件不负责：

- 定义外链 URL。
- 调用 toast provider。
- 写入设置或持久化。
- 记录 analytics。
- 操作 Project。

### 9.2 `AboutPanel`

保留 `onOpenFeedback: () => void`，因为 Panel 只需要通知父组件打开弹窗。

不应把异步 GitHub 外链行为直接传给 `AboutPanel` 的 pill；pill 的唯一行为是打开选择弹窗。

### 9.3 `About.tsx`

新增状态：

```text
feedbackDialogOpen: boolean
```

职责调整：

- “问题反馈” pill 设置 `feedbackDialogOpen=true`。
- 原 `handleOpenFeedback` 改为返回成功布尔值。
- 渲染 `AboutFeedbackDialog`。
- 保留现有日志和 warning toast。
- 不影响 `AboutSupportDialog`。

## 10. QuietDialog 焦点能力设计

### 10.1 为什么属于 shared owner

焦点陷阱、初始焦点和关闭后恢复不是 About 的业务规则，而是 modal 的稳定通用能力。如果只在 About 内用 querySelector 补丁实现，会形成 page-local workaround，并让其他 `QuietDialog` 继续具有不同的键盘行为。

因此本任务允许对 `QuietDialog.tsx` 做窄范围通用增强，但不得借机重写所有 dialog API 或样式。

### 10.2 必须实现的行为

- 弹窗打开时保存 `document.activeElement`。
- portal 渲染完成后，把焦点放到：
  1. 带有显式 initial-focus 标记的元素；否则
  2. 第一个可操作元素；否则
  3. dialog surface 本身。
- Tab 在最后一个可操作元素时回到第一个。
- Shift+Tab 在第一个可操作元素时回到最后一个。
- disabled、hidden、`tabindex=-1` 元素不进入可操作列表。
- Escape 保持现有关闭行为。
- 关闭或卸载后，如果原触发元素仍连接在 DOM 中，则恢复焦点。
- 不在关闭后把焦点错误地移到 `body`。

### 10.3 建议 API

给 `QuietDialog` 增加可选属性：

```text
initialFocusRef?: RefObject<HTMLElement | null>
```

如果不希望扩展 public props，也可以使用稳定的 `data-qp-dialog-initial-focus` 标记；两者二选一，不同时引入两套机制。

优先推荐 `initialFocusRef`，原因是类型明确、无需全局选择器契约，并能把弹窗初始焦点稳定放到 GitHub Issues 按钮。

### 10.4 弹窗初始焦点

弹窗没有内部视图切换。打开后二维码立即可见，键盘用户的第一个主要动作是 GitHub 外链按钮。

因此：

- 使用 `initialFocusRef` 把初始焦点放到 GitHub Issues 按钮。
- QQ 二维码和说明保持普通内容，不进入 Tab 顺序。
- 右上角关闭按钮仍可通过 Tab 到达。
- 关闭后焦点恢复到 About 页“问题反馈”按钮。

这样不会为了扫码给 QQ 卡片制造没有意义的键盘点击行为。

## 11. Quiet Pro 视觉规格

### 11.1 弹窗 surface

- 使用 `QuietDialog` 现有 backdrop 和 surface。
- 建议宽度：`min(560px, calc(100vw - 32px))`。
- 不新增大阴影、渐变背景、玻璃模糊或品牌色面板。
- header 为关闭按钮预留空间。
- 内容过高时允许 body 内滚动，不让关闭按钮离开可视区。

### 11.2 渠道内容卡

- 采用与赞助弹窗一致的纵向堆叠布局。
- QQ 内容卡直接承载二维码，不设置为 `button`。
- GitHub 内容卡内提供一个明确的 `button`。
- 使用现有 `--qp-bg-panel`、`--qp-bg-elevated`、`--qp-border-subtle`、`--qp-border-strong`。
- 圆角使用现有 control token。
- GitHub 按钮的 default、hover、active、focus-visible、disabled、loading 状态必须完整。
- GitHub disabled 状态降低强调但保持文字可读。
- GitHub focus-visible 使用现有 accent 语义，不移除浏览器可见焦点而不给替代。
- QQ 卡片没有伪 hover、active、focus 或 disabled 状态。

### 11.3 图标

- GitHub 使用现有 `src/features/about/assets/github.svg`。
- QQ 使用现有 lucide `QrCode` 或 `MessageCircle`，不额外引入图标包。
- 两张卡片的标题图标尺寸和容器强度一致。
- GitHub 品牌色只允许落在小图标或品牌词，不给整张卡片染色。
- QQ 渠道卡片不把二维码渐变色扩散为按钮背景。

### 11.4 二维码

- 同时导入 light 和 dark 图片，按 `:root[data-theme]` 控制显示。
- 每一时刻只有一张图片参与可见布局。
- 使用 `object-fit: contain`，不裁剪顶部频道名、底部提示或二维码定位点。
- 建议可见宽度：`min(280px, 100%)`。
- 对高度较小窗口使用 `max-height`，但不得把二维码缩小到不可扫描。
- 图片容器使用克制边框与 panel 背景。
- 不对 JPEG 使用 CSS filter 或反色模拟主题。
- `draggable={false}`。

### 11.5 响应式与缩放

至少验证：

- 1280 × 820，100% 缩放
- 1800 × 900，100% 缩放
- 960 × 640，100% 缩放
- Windows 125%、150%、200% 显示缩放中的至少两档
- 内容区域高度不足时的滚动

## 12. 分阶段执行清单

## 阶段 0：执行前保护

- [x] 运行 `git status --short`，记录所有已有修改和未跟踪文件。
- [x] 确认只有两张二维码是当前已知未跟踪资源。
- [x] 不覆盖、不格式化、不暂存无关用户修改。
- [x] 读取最新 `About.tsx`、`AboutPanel.tsx`、`QuietDialog.tsx`、`aboutCopy.ts`、`about.css`。
- [x] 读取最新 `tests/uiBrowserSmoke/aboutScenarios.ts`。
- [x] 再次核对 Project item 仍为 `In progress`；如果状态变化，先报告差异。
- [x] 确认 GitHub URL 仍为 `https://github.com/Ceceliaee/patina/issues/new/choose`。
- [x] 记录两张二维码 SHA-256，作为迁移完整性基线。

阶段退出条件：实施者能清楚说明每个文件的 owner、预期修改和不允许扩散的区域。

## 阶段 1：迁移二维码资源

- [x] 验证两个源文件的绝对路径均位于仓库 `.github/assets/`。
- [x] 验证两个目标文件均位于 `src/features/about/assets/`。
- [x] 将暗色图移动并重命名为 `qq-channel-dark.jpg`。
- [x] 将亮色图移动并重命名为 `qq-channel-light.jpg`。
- [x] 不保留随机哈希文件名的重复副本。
- [x] 不重新编码 JPEG。
- [x] 比较迁移前后 SHA-256，确认字节一致。
- [x] 检查目标图片仍为 1107 × 1688。
- [x] 用 QQ 对两个目标文件分别实机扫码。
- [x] 确认扫码结果进入同一个 `patina_official` 频道。
- [x] 记录扫码设备、主题图片和结果。

阻塞条件：任一图片无法识别、指向错误频道或需要裁剪才能扫描。出现时不要继续写 UI，应先向维护者索取正确资源。

## 阶段 2：建立 copy 契约

- [x] 在中文 `about.feedbackDialog` 添加第 8 节全部 key。
- [x] 在英文 `about.feedbackDialog` 添加完全相同的 key。
- [x] 保持现有 `supportDialog` 文案不变。
- [x] 检查 TypeScript `as const` 推断没有因结构差异报错。
- [x] 运行或确认 `uiSmoke` 的 copy key parity 覆盖新结构。
- [x] 人工检查英文行长不会显著撑大渠道卡片。

阶段退出条件：组件实现不需要硬编码任何用户可见说明文案。

## 阶段 3：增强 QuietDialog 焦点管理

- [x] 给 dialog surface 建立稳定 ref。
- [x] 打开时捕获原焦点元素。
- [x] portal 提交后设置初始焦点。
- [x] 实现可操作元素查询，并过滤不可见或禁用元素。
- [x] 实现 Tab 尾到头循环。
- [x] 实现 Shift+Tab 头到尾循环。
- [x] 保留 Escape 的 `preventDefault()` 和 `onClose()`。
- [x] 保留 `closeOnBackdrop=false` 的语义。
- [x] 关闭时恢复原触发元素焦点。
- [x] 原触发元素已卸载时安全跳过恢复，不抛异常。
- [x] 不改变 `QuietConfirmDialog`、`QuietPromptDialog` 等调用签名，除非采用可选属性。
- [x] 不把焦点工具抽到新的 `shared/lib`。
- [x] 给 surface 增加必要的 `tabIndex={-1}` fallback。
- [x] 使用现有 aria-label 或改为稳定的 `aria-labelledby`；不要重复读出两个标题。

专项回归：

- [x] About 赞助弹窗仍能打开和关闭。
- [x] Update 确认弹窗初始焦点合理。
- [x] Settings 的 confirm/prompt 弹窗仍可 Tab 操作。
- [x] History 弹窗 Escape 行为不变。

阶段退出条件：焦点行为成为 QuietDialog 的通用能力，About 不需要页面级全局 keydown workaround。

## 阶段 4：实现 AboutFeedbackDialog

- [x] 新建 `src/features/about/components/AboutFeedbackDialog.tsx`。
- [x] 定义严格的 props 类型。
- [x] 导入 light/dark 二维码和现有 GitHub SVG 表达方式。
- [x] 使用 `QuietDialog`，不自行创建 portal 或 backdrop。
- [x] 增加右上角关闭按钮，复用 `qp-dialog-close-button`。
- [x] 初始化 `openingGitHub=false`。
- [x] 渲染纵向堆叠的 QQ 内容卡和 GitHub 内容卡。
- [x] QQ 内容卡打开弹窗后直接显示二维码，不绑定 click handler。
- [x] GitHub 内容卡内渲染一个明确的外链按钮。
- [x] GitHub 按钮调用异步 handler。
- [x] GitHub 点击后设置 loading，并禁用 GitHub 按钮防止重复提交。
- [x] GitHub handler 返回 true 时关闭。
- [x] GitHub handler 返回 false 时保持弹窗并恢复可操作状态。
- [x] QQ 内容卡显示频道名、频道号、提示和主题图片。
- [x] QQ 内容卡明确提示用户使用 QQ 扫一扫。
- [x] 初始焦点放到 GitHub Issues 按钮。
- [x] 所有关闭路径重置内部状态。
- [x] 组件卸载时不继续 setState。
- [x] 图片提供准确 alt，装饰图标标记 `aria-hidden`。
- [x] loading button 使用 `aria-busy`。
- [x] disabled 状态使用原生 `disabled`。

阶段退出条件：组件可独立表达完整状态机，不知道 URL、toast 或 Project。

## 阶段 5：接入 About 页面

- [x] 在 `About.tsx` 新增 `feedbackDialogOpen` state。
- [x] 把 `AboutPanel.onOpenFeedback` 改为只打开弹窗。
- [x] 保留“问题反馈” pill 的现有视觉与位置。
- [x] 把原外链 handler 改为 `Promise<boolean>`。
- [x] 成功返回 true。
- [x] 失败时记录日志、发送 warning toast 并返回 false。
- [x] 在 About 根节点下渲染 `AboutFeedbackDialog`。
- [x] 关闭回调设置 `feedbackDialogOpen=false`。
- [x] 不改变 `AboutSupportDialog` state 和行为。
- [x] 不改变 UpdateStatusPanel 的更新逻辑。
- [x] 检查 `showSupportLinks={false}` 下没有第二个反馈入口绕过弹窗。
- [x] 检查 Settings 页现有反馈入口未被本任务改变。

阶段退出条件：About 页“问题反馈”的唯一直接结果是打开选择弹窗。

## 阶段 6：实现 Quiet Pro 样式

- [x] 在 `about.css` 添加 feedback dialog surface 样式。
- [x] 添加纵向内容卡布局，复用赞助弹窗的排列节奏。
- [x] QQ 卡片不添加伪交互状态。
- [x] 添加 GitHub 按钮 default 状态。
- [x] 添加 GitHub 按钮 hover 状态。
- [x] 添加 GitHub 按钮 active 状态。
- [x] 添加 GitHub 按钮 focus-visible 状态。
- [x] 添加 GitHub 按钮 disabled 状态。
- [x] 添加 loading 文案或轻量 spinner 对齐。
- [x] 使用 token，不硬编码新颜色、圆角、阴影或过渡时长。
- [x] GitHub 与 QQ 卡片保持相同 chrome；二维码因内容需要自然占据更大高度。
- [x] 添加 QQ 内容排版和二维码 frame。
- [x] 添加 light/dark 图片互斥显示规则。
- [x] 确认默认主题下不会同时显示两张图。
- [x] 添加低高度窗口的内容滚动或尺寸约束。
- [x] 检查 reduced motion 下不依赖动画表达状态。
- [x] 不修改 About 主面板、版本 chip、赞助卡片的现有视觉。

阶段退出条件：去掉图标和图片后，信息层级仍由排版、间距和边界清晰表达。

## 阶段 7：扩展浏览器 smoke 测试

在 `tests/uiBrowserSmoke/aboutScenarios.ts` 增加独立场景，避免把所有断言塞入现有赞助测试。

### 7.1 打开行为

- [x] 导航到 About。
- [x] 点击文本为“问题反馈”的 pill。
- [x] 断言出现 role=dialog。
- [x] 断言 opener stub 尚未收到 GitHub URL。
- [x] 断言 dialog 同时包含 QQ 频道二维码和 GitHub Issues 按钮。
- [x] 断言不需要点击 QQ 或切换视图就能看到二维码。

### 7.2 QQ 扫码内容

- [x] 断言出现 `patina_official` 和 `pd57300004`。
- [x] 等待主题图片 naturalWidth/naturalHeight 大于 0。
- [x] 断言当前可见图片的 `data-qq-theme` 等于根节点主题。
- [x] 断言另一张图片不可见。
- [x] 断言 QQ 卡片不是 button、link，也没有 click handler。
- [x] 断言不存在“查看二维码”或“返回渠道选择”按钮。

### 7.3 GitHub 成功路径

- [x] 点击 GitHub 渠道按钮。
- [x] 断言 opener stub 收到准确 URL。
- [x] 断言成功后弹窗关闭。
- [x] 断言焦点回到 About 的“问题反馈”按钮。

### 7.4 关闭路径

- [x] 重新打开弹窗。
- [x] 使用 Escape 关闭并验证焦点恢复。
- [x] 重新打开弹窗。
- [x] 点击右上角关闭并验证焦点恢复。
- [x] 重新打开弹窗。
- [x] 点击 backdrop 并验证关闭。

### 7.5 焦点循环

- [x] 断言弹窗打开后初始焦点位于 GitHub Issues 按钮。
- [x] 记录弹窗内第一个和最后一个可操作元素。
- [x] 在最后一个元素按 Tab，断言回到第一个。
- [x] 在第一个元素按 Shift+Tab，断言回到最后一个。
- [x] 断言焦点不会落到背景 About 页面。

### 7.6 失败路径

- [x] 扩展 Tauri opener stub，使指定场景可以 reject。
- [x] 点击 GitHub。
- [x] 断言 loading 期间 GitHub 按钮 disabled。
- [x] 断言 loading 期间 QQ 二维码仍然可见。
- [x] 断言失败后弹窗仍存在。
- [x] 断言按钮恢复 enabled。
- [x] 断言出现 `feedbackOpenFailed` warning toast。
- [x] 断言没有未处理 Promise rejection 或 console exception。

如果现有 stub 不适合按场景切换失败，不要把生产代码改成迎合测试；应在 `tests/uiBrowserSmoke/tauriStubs.ts` 内增加最小可控测试能力。

## 阶段 8：静态与类型验证

- [x] 运行 `npm run check:types`。
- [x] 运行 `npm run check:naming`。
- [x] 运行 `npm run check:architecture`。
- [x] 运行 `npm run check:hotspots`。
- [x] 修复所有由本任务引入的错误。
- [x] 如果出现既有错误，记录完整证据并确认与本任务无关，不静默忽略。

重点检查：

- copy key parity
- `.jpg` 类型是否被 TypeScript/Vite 正确识别
- About feature 是否新增了错误的 platform 直连
- QuietDialog 是否明显变厚或引入第二套 dialog 抽象

## 阶段 9：自动化回归

先跑最窄测试，再跑完整门槛：

- [x] 运行 `npm run test:ui-browser-smoke`。
- [x] 运行 `npm run test:ui-smoke`。
- [x] 运行 `npm run build`。
- [x] 运行 `npm run check`。
- [x] 记录每条命令、退出码和运行日期。

如果 `npm run check` 失败：

1. 先判断失败是否由本任务引入。
2. 如果是，修复后从命中的最窄测试重新开始。
3. 如果不是，保留证据并报告，不通过降低断言或删除测试规避。
4. 没有完整通过前，不建议 Project 进入 Done。

## 阶段 10：人工验收

### 10.1 基本路径

- [x] 点击“问题反馈”不会立刻打开浏览器。
- [x] 弹窗标题和说明可在一眼内理解。
- [x] GitHub 和 QQ 用途区别明确。
- [x] 打开弹窗后无需点击 QQ 即可看到完整二维码。
- [x] GitHub 打开正确模板选择页。
- [x] QQ 显示正确频道名和频道号。

### 10.2 主题

- [x] 亮色主题显示浅色二维码。
- [x] 暗色主题显示深色二维码。
- [x] 弹窗打开时切换主题，二维码跟随切换。
- [x] 主题切换不造成两张图片同时闪现或占位叠加。
- [x] 两种主题下文字、边框和焦点环对比度可读。

### 10.3 二维码

- [x] 在亮色主题中用 QQ 实机扫描浅色图。
- [x] 在暗色主题中用 QQ 实机扫描深色图。
- [x] 在 125% 缩放下扫码。
- [x] 在 150% 或 200% 缩放下扫码。
- [x] 扫码均指向 `patina_official` / `pd57300004`。
- [x] 图片没有被裁剪、模糊拉伸或压缩变形。

### 10.4 键盘

- [x] 从“问题反馈”按 Enter 打开弹窗。
- [x] 初始焦点位于合理的第一个操作。
- [x] Tab 顺序与视觉顺序一致。
- [x] Shift+Tab 反向顺序正确。
- [x] 焦点不会逃出 modal。
- [x] Enter 和 Space 都能激活 GitHub 按钮。
- [x] QQ 二维码不伪装成键盘按钮。
- [x] Escape 关闭。
- [x] 关闭后焦点回到“问题反馈”。

### 10.5 鼠标和错误状态

- [x] hover 反馈清晰但克制。
- [x] active 状态可感知。
- [x] loading 时重复点击不会产生多个外链请求。
- [x] GitHub disabled 状态不响应点击。
- [x] 外链失败后弹窗保持打开。
- [x] 失败 toast 文案可理解。
- [x] 失败后用户可以重试，QQ 二维码仍可直接扫描。

### 10.6 响应式

- [x] 1280 × 820 下弹窗完整显示。
- [x] 1800 × 900 下弹窗不过度放大。
- [x] 960 × 640 下两张纵向内容卡保持可读。
- [x] 低高度下关闭按钮始终可访问。
- [x] 内容滚动不带动背景页面。

## 13. 验收条件追踪矩阵

| Project 验收条件 | 实现证据 | 自动化证据 | 人工证据 |
| --- | --- | --- | --- |
| 点击反馈先打开选择弹窗 | `About.tsx` / `AboutFeedbackDialog.tsx` | About browser smoke 打开场景 | 基本路径 10.1 |
| 两个渠道用途说明清晰 | `aboutCopy.ts` | dialog 文本断言 | 中英文走查 |
| GitHub 打开正确页面 | 现有 `openFeedback()` | opener URL 断言 | 实际浏览器打开 |
| QQ 展示正确入口 | QR assets / QQ 内容卡 | 图片和频道信息断言 | 实机扫码 |
| 外链失败提示明确 | boolean handler / toast | reject stub 场景 | 失败注入 |
| 符合 Quiet Pro | `about.css` token 样式 | 布局与主题断言 | 视觉走查 |
| 适配亮暗主题 | 双图片互斥 CSS | `data-qq-theme` 断言 | 主题切换 |
| Escape、关闭、背景正常 | QuietDialog / close button | 三种关闭路径 | 键盘鼠标走查 |
| 不收集或写入 Project | 无 persistence / analytics | 架构与源码检查 | 网络与状态观察 |

## 14. 风险与处理

### 14.1 Project 文字与方案不一致

风险：验收人员仍按“QQ 打开外部页面”判断，导致实现和条目冲突。

处理：在实施开始前报告第 5 节校正预览；获得授权后更新 Project，否则在交付时明确保留差异。

### 14.2 QuietDialog 共享回归

风险：焦点增强影响已有 17 个左右的 dialog 使用点。

处理：保持 API 向后兼容；只增加焦点行为；运行 browser smoke 和 `npm run check`；人工抽查 About、Update、Settings、History。

### 14.3 二维码缩小后无法扫描

风险：完整竖版海报在小窗口中缩放后，二维码点阵过小。

处理：给 QR 保留足够 CSS 宽度；小高度时滚动而不是无限缩小；在多个 Windows 缩放档实机扫码。

### 14.4 图片与主题映射错误

风险：暗色主题显示浅色图，或两张图同时占位。

处理：使用明确文件名、`data-qq-theme` 和 browser smoke 断言，不依赖数组顺序。

### 14.5 外链打开竞态

风险：用户连续点击产生多个浏览器标签页，或关闭后 Promise 回写已卸载组件。

处理：同步设置 loading、原生 disabled、卸载保护；成功后只关闭一次。

### 14.6 英文界面中的中文图片

风险：二维码图片本身含中文，英文用户无法理解。

处理：图片外提供英文频道名、频道号和扫描说明；不修改二维码原图，以免降低识别率。

## 15. 回滚方案

本任务应保持可按层回滚：

1. 移除 `AboutFeedbackDialog` 渲染和 state。
2. 恢复 About pill 直接调用原 `handleOpenFeedback`。
3. 移除新增 copy 和 About CSS。
4. 删除 feature 内二维码资源。
5. 如果 QuietDialog 焦点增强造成无法在当前范围修复的回归，单独回滚该 shared 修改。
6. 恢复或删除测试时必须与实际产品行为一致，不能只为了绿灯删除有效断言。

回滚后必须重新运行：

- [x] `npm run test:ui-browser-smoke`
- [x] `npm run build`
- [x] `npm run check`

## 16. 最终 diff 复核

- [x] 运行 `git status --short`。
- [x] 运行 `git diff --stat`。
- [x] 运行 `git diff --numstat`。
- [x] 确认随机哈希二维码文件不再留在 `.github/assets/`。
- [x] 确认目标二维码位于 About feature assets。
- [x] 确认没有修改 Settings、Rust、数据库或 Project 自动化。
- [x] 确认没有硬编码新的 Quiet Pro 视觉值。
- [x] 确认没有新增 `src/lib`、`src/types` 或临时 shared helper。
- [x] 确认测试覆盖真实行为，不只匹配源码字符串。
- [x] 确认 Markdown 与中文源码仍为 UTF-8，无 mojibake。

## 17. 完成后的 Project 协作

当实现和对应验证全部通过后：

- [x] 重新读取 live Project。
- [x] 明确报告 `增加问题反馈渠道选择弹窗：In progress → Done`。
- [x] 说明触发事件是实现完成且 `npm run check` 通过。
- [x] 按最新手动顺序重新计算 `Next` 窗口。
- [x] 一次报告所有需要的 `Next / Queued` 拖动建议。
- [x] 不代替维护者拖动运行中状态。
- [x] 如果 Project 正文仍保留公开邀请链接要求，明确报告未同步差异。

如果实现完成但验证未通过：

- 不建议进入 Done。
- 如果失败由当前实现导致，保持 In progress 并继续修复。
- 如果存在无法立即解除的外部条件，建议 `In progress → Blocked`，并写明阻塞原因。

## 18. 文档归档

当以下条件全部满足后，本文件不再是活跃执行依据：

- [x] 功能实现完成。
- [x] 自动化与人工验证完成。
- [x] Project 状态建议已经报告。
- [x] 不再有未完成执行步骤。

然后：

- [x] 将本文从 `docs/working/` 移到 `docs/archive/`。
- [x] 不把一次性执行细节合并进顶层长期文档。
- [x] 只有发现长期规则变化时，才单独更新对应顶层文档。

## 19. 执行记录

> 任务级验收调整（2026-07-11）：维护者明确取消本任务内的 QQ 实机扫码与系统高 DPI 扫码要求，改为维护者后续自行验证；该项不再阻塞完成与归档。维护者随后要求删除 QQ 用途说明、二维码下方频道信息和 GitHub 用途说明三处辅助小字；最终实现与测试已按该覆盖要求更新。

> 归档勾选语义：`[x]` 表示步骤已执行/核验，或其触发条件未发生、受操作边界约束而明确不适用，或被上述维护者任务级调整替代；不表示执行了未获授权的 Project 编辑、状态拖动、回滚、提交或推送。

> 归档后视觉微调（2026-07-11）：按维护者截图移除 QQ 标题前的二维码图标与 GitHub 按钮内的外链图标，两个入口均保留清晰文字标签；GitHub 操作区随后参照 Ko-fi 卡片，使用带边框的内层容器居中放置单行按钮。

> 归档后文案精简（2026-07-11）：按维护者截图删除 QQ、微信赞赏码和 Ko-fi 卡片底部的三处辅助小字，保留标题、主要视觉内容及明确操作按钮。

> 归档后按钮微调（2026-07-11）：GitHub 操作按钮参照 Ko-fi 官方素材的品牌胶囊结构，改为居中的 GitHub 标识加单行文字；按钮使用独立 GitHub 品牌语义 token，同时继续复用 Quiet Pro 圆角、焦点与动效 token。

> 归档后按钮资产化（2026-07-11）：按维护者要求将 GitHub 操作改为与 Ko-fi 相同的图片资源形式，新增精确对齐的本地 SVG 按钮资产，文案精简为 `GitHub Issues`，移除“打开”两字；外层仍使用真实 button 保留 loading、disabled、焦点与键盘语义。

> 归档后双主题资产（2026-07-11）：按维护者提供的 Ko-fi 比例参考重画黑底白字与白底黑字两张 GitHub SVG 按钮，使用宽胶囊、标准 GitHub Mark、固定基线和无装饰排版；亮色主题显示黑色版，暗色主题显示白色版。

> 归档后尺寸校正（2026-07-11）：首次双主题资产错误放大为 276×60，且图文组合未按整体宽度居中。根据维护者复核，改为与 Ko-fi 按钮一致的 180×46 节奏，并重新计算图标、间距和文字组合的水平中心与垂直基线。

> 归档后官方资源复核（2026-07-11）：进一步核对 Ko-fi 官方资源及仓库现有 `kofi-button.png`，确认原图为 580×146，应用按 36px 高等比显示。GitHub 黑白 SVG 因此统一改为 580×146 画布，并采用与 Ko-fi 完全相同的 36px 高、宽度自动显示规则；此前 180×46 的截图估算被此精确基线替代。

> 归档后悬停对齐（2026-07-11）：GitHub 图片按钮与 Ko-fi 按钮统一使用仅降低至 `opacity: 0.9` 的悬停反馈，移除上浮和按下位移动效；焦点与 disabled 语义保持不变。

> 归档后文案打磨（2026-07-11）：反馈弹窗说明调整为“扫码加入 QQ 频道交流，或通过 GitHub Issues 提交需要持续跟进的问题。”，英文同步改为更自然的 channel / ongoing follow-up 表达。

> 归档后文案再精简（2026-07-11）：上一版仍偏产品说明，最终改为更直接的渠道分流文案：“日常交流请扫码加入 QQ 频道；问题反馈请前往 GitHub Issues。”英文同步采用 conversation / report a problem 的简洁表达。

> 归档后 QQ 图标补充（2026-07-11）：从本机当前 QQNT 9.9.32 官方客户端资源中的 `channel_24.svg` 提取频道轮廓，作为 About feature 本地 `qq-channel.svg` 资产；标题旁以单色 mask 使用，跟随 Quiet Pro 文字颜色，不采用第三方重绘 Logo。

> 归档后弹窗尺寸统一（2026-07-11）：反馈弹窗由 560px 收至与赞助弹窗相同的 500px；QQ 二维码内容宽度由 240px 收至与微信赞赏码一致的 220px，并同步约束最大高度，使两个 About 弹窗的外轮廓和视觉密度一致。

> 归档后 README 资产分离（2026-07-11）：README 反馈区使用的 GitHub 黑白按钮与 QQ 明暗二维码复制到 `.github/assets/readme/`，中英文 README 只引用文档资产路径；应用仍从 About feature assets 加载，两个 owner 不再互相依赖，复制时通过 SHA-256 确认字节一致。

> 归档后 README 资产分组（2026-07-11）：反馈渠道的四个 README 资源进一步归入 `.github/assets/readme/feedback/`，避免与 README hero 和页面预览图平铺混放；中英文引用同步更新。

> 归档后 README 资产层级校正（2026-07-11）：维护者明确反馈资源应与 `support` 并列，最终目录调整为 `.github/assets/feedback/`，与 `.github/assets/support/` 同级；此前 `readme/feedback/` 中间层已移除。

实施时在此追加，不删除失败记录。

### 19.1 开始记录

- 执行者：Codex
- 开始时间：2026-07-11
- 起始 commit：`93cf7865e4f2d2920722d7b1c2fa23bcd556c1bb`
- Project 状态：执行单记录为 `In progress`；GitHub CLI 凭据失效，完成前仍需重新读取 live Project
- 工作区已有修改：两张 `.github/assets/*.jpg` 未跟踪二维码与本执行单目录；未发现其他用户修改

### 19.2 验证记录

| 命令或检查 | 日期 | 结果 | 备注 |
| --- | --- | --- | --- |
| `npm run test:ui-browser-smoke` | 2026-07-11 | 通过 | 29 项浏览器 smoke；覆盖双渠道、主题映射、焦点与 opener 成功/失败 |
| `npm run test:ui-smoke` | 2026-07-11 | 通过 | 29 项 UI smoke；包含中英文 copy key parity |
| `npm run build` | 2026-07-11 | 通过 | TypeScript 与 Vite 生产构建通过 |
| `npm run check` | 2026-07-11 | 通过 | types、naming、architecture、hotspots、frontend、bundle 全通过 |
| 浅色二维码实机扫描 | 2026-07-11 | 维护者接手 | 维护者明确后续自行验证，不阻塞归档 |
| 深色二维码实机扫描 | 2026-07-11 | 维护者接手 | 维护者明确后续自行验证，不阻塞归档 |
| Windows 高 DPI 验证 | 2026-07-11 | 维护者接手 | 响应式自动验证通过；系统缩放扫码由维护者后续验证 |

### 19.3 阻塞与决策记录

| 日期 | 问题 | owner | 决策 | 后续动作 |
| --- | --- | --- | --- | --- |
| 2026-07-11 | QQ 实机扫码需要已登录账号 | 维护者 / QQ 客户端 | 维护者明确接手后续验证，该项退出本次完成门槛 | 本任务继续完成与归档 |
| 2026-07-11 | 截图中三处辅助小字冗余 | About UI | 按维护者任务级覆盖删除 QQ 用途、频道信息与 GitHub 用途说明 | 同步删除 copy/CSS 并增加浏览器断言 |

### 19.4 完成记录

- 完成时间：2026-07-11
- 最终 commit：
- 完整验证结果：`npm run check` 通过（含 29 项 UI smoke、29 项真实浏览器 smoke、生产构建与 bundle budget）
- Project 拖动建议：`增加问题反馈渠道选择弹窗：In progress → Done`；当前 `Next` 恰为 3 项，无需额外 `Next / Queued` 拖动
- 文档归档位置：`docs/archive/about-feedback-channel-dialog-execution-plan.md`
