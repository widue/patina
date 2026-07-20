# 分类默认映射职责迁移与删除执行方案

## 0. 文档信息

- 文档类型：一次性执行单（How-to）
- 目标读者：Patina 维护者与执行本次重构的开发者
- 当前状态：已完成并归档
- 真实 owner：`src/shared/classification/*`
- 主要风险面：应用身份归一、系统进程过滤、Classification、Dashboard、History、Data、软件提醒候选与用户覆盖配置
- 文档归宿：`docs/archive/classification-default-mappings-removal-plan.md`

> 本执行单只处理前端分类语义层中 `defaultMappings.ts` 的混合职责。QQ 浏览器 Web Sync 支持属于独立的 Rust 小修，不纳入本重构，也不应为了本执行单延迟或扩大该小修。

---

## 1. 最终目标

完成后应同时满足以下结果：

- [x] 新出现的软件无须加入任何静态软件名单，也能被发现、追踪、显示和进入分类页。
- [x] 是否追踪某个进程只由明确的追踪策略和用户设置决定，不由“是否存在默认显示名称”决定。
- [x] 应用身份只由可解释的可执行文件归一规则和经过确认的别名规则决定，不由显示名称相同与否决定。
- [x] 应用显示名称遵循“用户覆盖 > 运行时事实 > 可执行文件名回退”的顺序。
- [x] 所有系统进程和生命周期进程拦截规则只有一个 owner，不再与显示名称表重复维护。
- [x] `src/shared/classification/defaultMappings.ts` 被删除。
- [x] `DEFAULT_APP_MAPPINGS`、`DefaultAppMapping`、`resolveCanonicalDisplayName` 以及 `source: "default"` 不再存在。
- [x] 已有用户重命名、分类、颜色、追踪开关和标题记录开关继续生效。
- [x] Dashboard、History、Data、Classification、Widget、Tools 的应用身份和过滤结果通过回归验证。

---

## 2. 第一性原理

### 2.1 事实、策略、身份和展示必须分开

分类链路里存在四种不同性质的信息：

1. **事实**：Windows 当前报告的可执行文件名、产品名称、窗口标题和进程路径。
2. **身份**：多个观测记录是否应聚合为同一个应用。
3. **策略**：某个进程是否应进入用户的时间统计。
4. **展示**：最终向用户显示什么名称、分类和颜色。

这四者不能互相反推：

- 显示名相同，不证明两个可执行文件属于同一应用。
- 没有预置显示名，不代表软件不可追踪。
- 被识别为同一应用，不代表其中所有辅助进程都应追踪。
- 系统进程是否拦截，不应取决于它是否恰好存在于展示映射表。

### 2.2 追踪系统必须对未知软件开放

Patina 的核心能力是自动记录 Windows 桌面活动。未来出现的软件无法提前枚举，因此：

- 未知软件是正常输入，不是异常情况。
- 静态名单不能成为普通软件的准入条件。
- 默认行为应是记录可解释的普通前台应用。
- 只有明确的系统噪声、生命周期工具、临时进程或用户关闭项才应被排除。

### 2.3 身份关系必须显式且可审计

身份合并会影响历史统计、分类覆盖、删除记录、图标缓存和聚合结果。一旦误合并，用户很难从界面看出原因。因此：

- 不允许通过两个条目的显示名相同来推断身份等价。
- 不允许仅因某个基础名称出现在展示表里，就推断 `helper/widget/tray` 进程属于它。
- 每条跨可执行文件身份关系必须能回答“证据是什么、影响哪些记录、怎样回归验证”。
- 无法确认的关系保持分离，宁可让用户看到两个候选，也不静默串记。

### 2.4 用户覆盖是用户意图，优先级最高

分类页保存的 `displayName`、`category`、`color`、`track` 和 `captureTitle` 是用户明确表达的意图。重构不得：

- 覆盖已有用户设置；
- 把用户设置写回源码默认值；
- 为了维持旧硬编码名称，批量制造新的用户覆盖；
- 因别名规则变化而静默丢失原有设置键。

### 2.5 读模型必须可重复

同一批原始 session 在 Dashboard、History 和 Data 中应得到一致的应用身份和过滤结果。显示名称可以来自用户覆盖或记录事实，但不能因为页面不同而采用不同的隐藏名单。

---

## 3. 当前实现事实

### 3.1 当前表规模

`src/shared/classification/defaultMappings.ts` 当前包含：

- 125 个映射条目；
- 其中 32 个带 `category: "system"`；
- 其余 93 个主要只提供普通软件显示名称。

新软件不在这 125 个条目中时，仍可通过运行时 `appName` 或格式化后的 exe 名称进入追踪和分类页。这证明该表不是追踪白名单。

### 3.2 当前混合职责

该表目前同时承担：

- 普通软件默认显示名称；
- 个别本地化显示名称；
- `system` 分类和第二层追踪拦截；
- `helper/widget/tray` 派生进程的基础候选集合；
- 生命周期元数据中“显示名相同即身份等价”的隐式依据；
- History 和 Data 中的规范显示名称来源。

这些职责的变化频率、风险和 owner 不同，不应继续放在同一数据结构中。

### 3.3 当前系统拦截重复

系统和噪声进程当前至少由以下机制共同过滤：

- `processNormalization.ts` 中的 `NON_TRACKABLE_EXE_NAMES`；
- `processNormalization.ts` 中的 `READ_MODEL_BLOCKED_EXE_NAMES`；
- 临时文件、安装器、更新器和上下文元数据规则；
- `defaultMappings.ts` 中的 `category: "system"`；
- `ProcessMapper.shouldTrack()` 对映射分类是否为 `system` 的最终判断；
- 用户覆盖中的 `track: false`。

其中部分 exe 重复存在于多个位置；`taskmgr.exe`、`regedit.exe`、`mmc.exe`、`control.exe`、`shellhost.exe` 等行为又主要依赖 `category: "system"`。这造成修改一份名单时可能漏掉另一条读路径。

### 3.4 当前身份推断并非显式别名

当前没有真正的“别名关系表”。实际行为来自两个启发式规则：

- `areKnownEquivalentAppStems()`：两个 exe 在默认映射中具有相同 `name`，便在紧凑生命周期元数据判断中视为等价。
- `resolveDerivedAliasExecutable()`：当进程名符合 `helper/widget/tray` 后缀，并且推导出的基础 exe 存在于默认映射中，就把它归一为该基础 exe。

因此 `name` 和“是否存在条目”被当成身份信号。它们只能说明展示配置存在，不能证明进程身份。

### 3.5 当前显示名称优先级

现有多个读路径大体采用：

```text
用户 displayName 覆盖
  > DEFAULT_APP_MAPPINGS 固定名称
  > session.appName
  > 格式化后的 canonical exe
```

目标顺序应改为：

```text
用户 displayName 覆盖
  > 已记录的可信 runtime appName
  > 格式化后的 canonical exe
```

对于已明确归属的辅助进程，不应优先采用诸如 `Steam Client WebHelper` 这类辅助进程名称；应优先使用同一 canonical identity 下的主进程名称，否则回退到 canonical exe。

---

## 4. 目标责任模型

### 4.1 `processNormalization.ts`：追踪政策与规范化入口

继续负责：

- exe 字符串基础规范化；
- 临时进程、生命周期进程和上下文噪声识别；
- 明确的无条件拦截集合；
- 调用显式身份规则得到 canonical exe；
- 对外提供 `shouldTrackProcess()` 和 `resolveCanonicalExecutable()`。

不再负责：

- 查询展示名称表；
- 返回 canonical 显示名称；
- 根据显示名判断身份等价。

### 4.2 显式身份规则：只描述身份，不描述展示

在 `src/shared/classification/` 内为经过确认的身份关系建立窄数据结构。实现时可根据最终规模选择同文件常量或独立的 `processIdentityRules.ts`，但必须满足：

- key 和 value 都是规范化 exe 或 stem；
- 每条规则具有测试；
- 不含显示名称、分类、颜色或本地化文本；
- 不提供通用软件目录；
- 不允许页面层直接修改；
- 未确认关系不得加入。

建议最小结构：

```ts
const EXACT_EXECUTABLE_ALIASES: Readonly<Record<string, string>> = {
  // "confirmed-component.exe": "confirmed-owner.exe",
};

const DERIVED_COMPONENT_OWNER_EXES: ReadonlySet<string> = new Set([
  // 只允许已经验证 helper/widget/tray 命名规律的 owner。
]);
```

若某个产品的规则无法用通用结构准确表达，应使用产品级显式规则或保持分离，不扩大通用正则。

### 4.3 `processMapper.ts`：展示投影与用户覆盖

继续负责：

- 用户分类覆盖；
- 用户显示名称覆盖；
- 用户颜色、追踪和标题记录设置；
- 将 runtime `appName` 和 canonical exe 投影成 UI 所需 `AppInfo`。

新的基础映射规则：

```text
name     = override.displayName || normalizedRuntimeAppName || formattedCanonicalExe
category = override.category || "other"
color    = override.color || categoryColor
```

`ProcessMapper.shouldTrack()` 应只组合：

```text
shouldTrackProcess(canonicalExe)
  && override.track !== false
```

它不再通过映射后的 `category === "system"` 决定追踪行为。

### 4.4 各读模型：共享身份和策略，保留各自聚合 owner

- History 和通用 session 编译继续由 `sessionReadCompiler.ts` 负责。
- Data 聚合继续由 `features/data/services/dataReadModel.ts` 负责。
- Classification 候选继续由 `features/classification/*` 负责。
- Widget、图标缓存和 Tools 候选继续消费统一 canonical exe。

本次不把这些 feature 私有读模型搬入 `shared/*`，只让它们消费同一身份和追踪政策。

---

## 5. 范围与非目标

### 5.1 本次范围

- [x] 统一系统和噪声进程拦截 owner。
- [x] 将身份推断从显示名称表中解耦。
- [x] 修改显示名称回退顺序。
- [x] 保持用户覆盖存储兼容。
- [x] 更新 Classification、History、Data 等消费者。
- [x] 删除默认映射表及失效 API。
- [x] 补齐行为、回归和性能验证。

### 5.2 明确非目标

- [x] 不修改 Rust tracking loop 的采样算法；对抗审查发现 canonical override 无法抵达 native settings lookup 后，将兼容修复扩大到 Rust domain/data 边界与即时 session seal。
- [x] 分类重构不修改 Web Sync 浏览器白名单；同一任务中独立的 QQ 浏览器小修按原授权加入 `qqbrowser.exe`。
- [x] 不新增数据库 schema migration。
- [x] 不重做分类页 UI。
- [x] 不改变用户可分配分类集合。
- [x] 不批量改写已有 session 的 `app_name` 或 `exe_name`。
- [x] 不根据猜测新增大量别名。
- [x] 不把分类逻辑移动到 `app/*`、页面组件或 Rust 层。
- [x] 不顺手清理与本问题无关的共享工具。

---

## 6. 执行前行为矩阵

实现前必须把以下行为写成测试或记录成可对比快照：

| 场景 | 目标 canonical identity | 目标追踪结果 | 目标显示名来源 |
| --- | --- | --- | --- |
| 未知普通软件 `NewEditor.exe`，有 runtime `appName` | `neweditor.exe` | 追踪 | runtime `appName` |
| 未知普通软件，无 runtime `appName` | 规范化 exe | 追踪 | 格式化 exe |
| 用户已重命名的软件 | 规范化或明确 canonical exe | 按用户 track 设置 | 用户 `displayName` |
| 明确系统进程 | 规范化 exe | 不追踪 | 不进入普通读模型 |
| 临时 `.tmp` 进程 | 不重要 | 不追踪 | 不进入普通读模型 |
| 明确安装器/更新器 | 可解析但不统计 | 不追踪 | 不进入普通读模型 |
| 未确认的同名 exe | 各自独立 | 分别判断 | 各自 runtime 名称 |
| 明确的辅助进程 | 已确认 owner exe | 按 owner 政策 | owner runtime 名称或 canonical fallback |
| `explorer.exe` | `explorer.exe` | 继续追踪 | runtime 名称或 fallback |
| Patina 历史身份变体 | 按现有确认行为 | 不擅自改变 | 用户覆盖、runtime 或 canonical fallback |

---

## 7. 分阶段执行步骤

### 阶段 0：隔离范围并建立基线

目标：确保后续每个行为变化都可归因、可比较、可回退。

- [x] 确认 QQ 浏览器 Rust 小修与本重构保持独立变更边界；维护者未要求提交，因此未人为拆分提交。
- [x] 记录 `git status --short` 和 `git diff --stat`。
- [x] 确认本次不编辑 `src-tauri/src/domain/web_activity.rs`。
- [x] 记录默认映射条目基线：总计 125、system 32、普通名称 93。
- [x] 用 `rg` 记录 `DEFAULT_APP_MAPPINGS` 的全部生产消费者和测试消费者。
- [x] 用 `rg` 记录 `resolveCanonicalDisplayName`、`mapDefaultApp`、`mapDefault` 的全部消费者。
- [x] 运行并保存以下基线结果：
  - [x] `npm run test:tracking`
  - [x] `npm run test:classification`
  - [x] `npm run test:history-timeline`
  - [x] `npm run test:data`
  - [x] `npm run test:widget`
  - [x] `npm run test:tools`
  - [x] `npm run perf:classification-app-catalog`
- [x] 若基线已有失败，先记录失败项和原因；不得把既有失败误算成本重构回归。

退出条件：已有行为和测试基线完整，QQ 小修没有混入重构修改范围。

### 阶段 1：先建立新行为契约

目标：在删除表之前，用测试定义未知软件、用户覆盖、系统拦截和身份分离的正确行为。

#### 1.1 未知软件契约

- [x] 在 classification 测试中加入不在任何静态名单中的 `NewEditor.exe`。
- [x] 断言 `shouldTrackProcess("NewEditor.exe") === true`。
- [x] 断言带 `{ appName: "New Editor" }` 时基础映射名称为 `New Editor`。
- [x] 断言没有 `appName` 时名称回退为 `NewEditor` 或当前约定的格式化结果。
- [x] 断言该候选进入 Classification catalog。
- [x] 断言该 session 进入 History 和 Data 聚合。

#### 1.2 用户覆盖契约

- [x] 断言自定义 `displayName` 高于 runtime `appName`。
- [x] 断言自定义 category 和 color 不受默认表删除影响。
- [x] 断言 `track: false` 在所有读模型中继续排除该应用。
- [x] 断言删除覆盖后回退到 runtime `appName`，而不是旧硬编码名称。
- [x] 断言旧的 `__app_override::<exe>` 键仍能加载、规范化和保存。

#### 1.3 系统拦截契约

- [x] 从当前 32 个 `category: "system"` 条目生成一次性审计清单。
- [x] 对清单逐项确认其目标行为确实是“不进入用户统计”，避免把“名称看起来像系统”误当政策。
- [x] 为当前仅依赖默认表拦截的 exe 增加测试，至少覆盖：
  - [x] `taskmgr.exe`
  - [x] `regedit.exe`
  - [x] `mmc.exe`
  - [x] `control.exe`
  - [x] `shellhost.exe`
- [x] 保留 `explorer.exe` 可追踪测试，防止扩大系统拦截范围。
- [x] 保留独立卸载器软件（例如 Geek Uninstaller）可追踪测试，防止通用关键词误杀。

#### 1.4 身份契约

- [x] 为两个恰好具有相同 runtime 显示名、但 exe 不同的软件增加负向测试，断言它们不自动合并。
- [x] 为当前确有产品证据的辅助进程关系增加正向测试。
- [x] 每个正向身份测试在测试名或邻近注释中说明依据，不能只写“known alias”。
- [x] 对无法确认的旧推断先标记为“保持分离”，不得为了让旧测试通过而复制猜测。

退出条件：新测试能够在旧实现上明确暴露“显示名驱动身份”和“系统政策重复”的问题，同时保住所有必须兼容的用户行为。

### 阶段 2：统一追踪政策 owner

目标：让 `shouldTrackProcess()` 成为系统和噪声进程政策的唯一源码 owner。

- [x] 在 `processNormalization.ts` 中按原因保留清晰集合，而不是建立另一个大杂烩表：
  - [x] 无条件不追踪的已知 exe；
  - [x] 读模型必须屏蔽的 Windows 系统进程；
  - [x] 独立的生命周期/临时/上下文规则。
- [x] 将审计确认后的 system 条目补入相应政策集合。
- [x] 补齐当前主要依赖 `category: "system"` 的条目。
- [x] 删除政策集合与 `defaultMappings.ts` 之间的重复查询关系。
- [x] 修改 `ProcessMapper.shouldTrack()`：
  - [x] 先调用统一的 `shouldTrackProcess()`；
  - [x] 再应用用户 `track: false`；
  - [x] 不再通过 `map(...).category !== "system"` 拦截。
- [x] 确认用户不能通过普通 category 覆盖重新启用明确系统进程。
- [x] 确认用户 `track: false` 仍可关闭普通应用。
- [x] 运行 tracking、classification、history、data 专项测试。

退出条件：临时删除所有 `category: "system"` 标记时，系统拦截测试仍全部通过。

### 阶段 3：用显式身份规则替代展示数据推断

目标：身份归一不再依赖 `DEFAULT_APP_MAPPINGS` 的名称或成员关系。

#### 3.1 审计现有推断

- [x] 列出所有当前测试覆盖的派生身份，例如：
  - [x] `Douyin_tray.exe -> douyin.exe`
  - [x] `Douyin_widget -> douyin.exe`
  - [x] `steamwebhelper.exe -> steam.exe`
  - [x] 生命周期名称的规范化案例
- [x] 区分“用于聚合的身份关系”和“最终会被过滤的安装/更新进程解析”。
- [x] 检查真实数据或可验证产品事实，确认每条需要保留的关系。
- [x] 删除仅由显示名称相同推导、但没有独立证据的关系。

#### 3.2 实现显式规则

- [x] 建立窄的 exact alias 和 derived component owner 数据结构。
- [x] 规则值只保存 canonical exe，不保存显示名。
- [x] 将 `resolveDerivedAliasExecutable()` 中的 `DEFAULT_APP_MAPPINGS[candidateExe]` 判断替换为显式 owner 集合。
- [x] 将 `areKnownEquivalentAppStems()` 改为比较显式 canonical identity。
- [x] 禁止使用 runtime 显示名或本地化名称作为等价依据。
- [x] 保持 `resolveCanonicalExecutable()` 的输出规范：trim、lowercase、统一 `.exe` 约定。
- [x] 确认 alias 规则不会把两个普通未知软件合并。
- [x] 确认 canonical identity 改动不会让已有覆盖键静默失效：
  - [x] `buildAppOverrideTransition()` 能迁移旧 key；或
  - [x] 对发生变化的 key 增加一次性兼容迁移；或
  - [x] 若没有实际 key 变化，写测试证明无需迁移。

#### 3.3 删除隐式机制

- [x] 删除基于 `leftMapping.name === rightMapping.name` 的等价判断。
- [x] 删除“基础 exe 只要在显示表中存在就允许派生”的条件。
- [x] 加入同名不同 exe 的负向回归测试。
- [x] 加入未授权 `helper/widget/tray` 名称不得归并的负向测试。

退出条件：`processNormalization.ts` 不再导入 `defaultMappings.ts`，且所有身份关系都能由规则名和测试解释。

### 阶段 4：移除硬编码显示名称依赖

目标：所有 UI 名称来自用户意图、运行时事实或稳定回退，不再依赖普通软件目录。

#### 4.1 修改 `processMapper.ts`

- [x] 删除 `DEFAULT_APP_MAPPINGS` 导入。
- [x] 删除 `resolveDefaultMappingName()`。
- [x] 将基础名称解析改为 `runtime appName || formatted canonical exe`。
- [x] 保持用户 `displayName` 为最高优先级。
- [x] 基础 category 固定回退为 `other`。
- [x] 删除 `AppInfo.source` 中的 `"default"` 分支。
- [x] 复核 `confidence` 是否仍有生产消费者：
  - [x] 若无消费者，作为本次耦合清理删除；
  - [x] 若仍有消费者，重新定义为基于用户覆盖/运行时事实，而不是基于名单命中。
- [x] 将 `mapDefault()` 重命名为语义准确的 `mapWithoutOverride()`，因为它表示“忽略用户覆盖”，不再表示“读取默认软件表”。

#### 4.2 修改 Classification 消费者

- [x] 将 `AppClassification.mapDefaultApp()` 重命名为 `mapAppWithoutOverride()`。
- [x] 更新 `useAppMappingDerivedState.ts` 中名称、分类、颜色和开关的基础值计算。
- [x] 确认编辑名称时使用 runtime `candidate.appName`。
- [x] 确认取消编辑恢复到保存前覆盖或 runtime 名称。
- [x] 确认保存改名仍写入 `__app_override::<canonicalExe>`。
- [x] 确认删除自定义名称后不会重新出现旧硬编码名称。

#### 4.3 修改 History 和 Data 名称解析

- [x] 删除 `resolveCanonicalDisplayName()` 调用。
- [x] History 名称顺序改为：用户覆盖 > session/runtime 名称 > canonical exe fallback。
- [x] Data 名称顺序与 History 保持一致。
- [x] 对 alias session：
  - [x] 不使用明显属于 helper/updater 的原始名称冒充 owner 名称；
  - [x] 优先使用同一 canonical identity 中可信的主进程名称；
  - [x] 没有可信主进程名称时使用格式化 canonical exe。
- [x] 使用现有 `pickPreferredAppName` 规则时，确认它不会让辅助进程名称压过用户覆盖或主进程名称。
- [x] 加入同一批 session 在 History 和 Data 中名称一致的测试。

#### 4.4 明确接受的显示变化

- [x] 记录移除硬编码名称后可能发生的合理变化，例如：
  - `Google Chrome` 可能采用系统记录的产品名称；
  - `抖音` 可能采用 runtime 名称，或在缺失时回退为 `Douyin`；
  - `文件资源管理器` 不再由静态本地化条目强制提供。
- [x] 不为维持全部旧文案而把 93 个默认名称复制到另一张新表。
- [x] 对产品确实要求固定名称的极少数例外，必须单独提出并说明为什么 runtime 信息和用户重命名都不足；不得在本执行单中默认保留。

退出条件：生产代码中的显示名称解析不再读取默认软件目录；未知软件和原有软件走同一套路径。

### 阶段 5：删除旧表和失效 API

目标：完成职责退出，不留下转发壳或“暂时仍有用”的兼容表。

- [x] 删除 `src/shared/classification/defaultMappings.ts`。
- [x] 删除 `DefaultAppMapping` 类型。
- [x] 删除 `DEFAULT_APP_MAPPINGS` 导出。
- [x] 删除 `resolveCanonicalDisplayName()`。
- [x] 删除 `AppClassification.resolveCanonicalDisplayName()`。
- [x] 删除 `source: "default"` 类型分支和测试断言。
- [x] 更新所有 `mapDefault`/`mapDefaultApp` 调用名称。
- [x] 删除只验证固定软件名称目录的测试，例如逐个断言某浏览器硬编码名称。
- [x] 用未知软件、runtime 名称和用户覆盖测试替代上述测试。
- [x] 运行以下零引用检查：
  - [x] `rg "DEFAULT_APP_MAPPINGS|DefaultAppMapping" src tests`
  - [x] `rg "defaultMappings" src tests`
  - [x] `rg "resolveCanonicalDisplayName" src tests`
  - [x] `rg 'source: "default"|=== "default"' src tests`
- [x] 确认零引用后不保留空文件、转发导出或 deprecated facade。

退出条件：旧表和所有以它为语义前提的 API 从生产代码与测试中完全退出。

### 阶段 6：跨页面回归和性能验证

目标：证明这不是“测试改绿了”，而是核心读模型在真实边界上仍一致。

#### 6.1 专项验证

- [x] `npm run test:tracking`
- [x] `npm run test:replay`
- [x] `npm run test:classification`
- [x] `npm run test:history-timeline`
- [x] `npm run test:data`
- [x] `npm run test:widget`
- [x] `npm run test:tools`
- [x] 检查以下关键行为：
  - [x] 新软件第一次出现后可见；
  - [x] 新软件不需要源码映射即可追踪；
  - [x] 分类页改名立即生效，重启后仍保留；
  - [x] 删除改名后回退到 runtime 名称；
  - [x] track 关闭项不进入 Dashboard、History 和 Data；
  - [x] 系统和生命周期噪声不重新出现；
  - [x] 未确认同名软件保持分离；
  - [x] 明确辅助进程仍正确归属或过滤。

#### 6.2 性能验证

- [x] `npm run perf:classification-app-catalog`
- [x] `npm run perf:history-read-model`
- [x] `npm run perf:data-read-model`
- [x] `npm run perf:stable`
- [x] 与阶段 0 基线比较，不接受由线性重复扫描或每 session 重建规则集合造成的明显回退。
- [x] 显式规则集合必须在模块级构建，不得在热路径函数内重复创建。

#### 6.3 完整质量门槛

- [x] `npm test`
- [x] `npm run build`
- [x] `npm run check:full`
- [x] `git diff --check`
- [x] 检查 `git diff --stat`：分类重构无无关 UI、数据库或发布改动；Rust 仅包含同一任务中独立的 QQ 浏览器 Web Sync 小修。

本次不涉及 IPC 注册、capability、plugin SQL 或真实 Tauri runtime 变化，因此默认不要求 `npm run test:tauri-runtime-smoke`。如果执行中实际触及这些边界，必须升级验证范围并补跑该命令。

退出条件：专项、性能和完整验证全部通过，或每个环境性例外都有可复现证据与维护者确认。

### 阶段 7：交付与文档收尾

- [x] 提交拆分不适用：维护者未要求 commit 或 push；如后续提交，仍按下列行为边界拆分：
  - [x] 测试契约与政策统一；
  - [x] 显式身份规则迁移；
  - [x] 显示名称链路迁移与旧表删除。
- [x] 不适用：本次未创建提交，因此没有 staged scope；工作区 diff 已检查。
- [x] 不适用：本次未创建提交，也未变更 Issue 状态。
- [x] 在交付说明中列出用户可见的名称回退变化。
- [x] 确认 QQ 浏览器 Rust 小修仍是独立、清晰的变更。
- [x] 完成并稳定验证后，将本文件移动至 `docs/archive/`。
- [x] 若执行中形成长期规则，只更新对应顶层长期文档，不把本执行单长期留在 `docs/working/`。

---

## 8. 预计文件变更

### 必改文件

- `src/shared/classification/defaultMappings.ts`：最终删除。
- `src/shared/classification/processNormalization.ts`：统一政策 owner，移除展示表依赖，消费显式身份规则。
- `src/shared/classification/processMapper.ts`：改为用户覆盖 + runtime 事实 + exe fallback。
- `src/shared/classification/appClassification.ts`：删除 canonical display API，重命名无覆盖映射 API。
- `src/shared/lib/sessionReadCompiler.ts`：移除固定 canonical display name 优先级。
- `src/features/data/services/dataReadModel.ts`：与 History 对齐名称优先级。
- `src/features/classification/hooks/useAppMappingDerivedState.ts`：消费新的无覆盖映射 API。

### 可能新增文件

- `src/shared/classification/processIdentityRules.ts`：仅当确认的 identity 规则足以形成稳定、窄 owner 时新增。

如果最终只有极少量规则，可将常量保留在 `processNormalization.ts`，避免为了目录整齐制造薄抽象。无论采用哪种形式，都不能再使用展示名称表承担身份职责。

### 重点测试文件

- `tests/trackingLifecycle/processMapper.ts`
- `tests/trackingLifecycle/compilerAndAggregation.ts`
- `tests/classificationDraftState.test.ts`
- `tests/classificationAppCatalog.test.ts`
- `tests/dataReadModel.test.ts`
- `tests/widgetViewModel.test.ts`
- Tools 软件候选相关测试

---

## 9. 风险、停止条件与回滚策略

### 9.1 高风险点

- 历史 session 的显示名称发生变化。
- 旧 alias 规则变化导致历史聚合拆分或覆盖 key 改变。
- 系统进程从过滤名单中漏出。
- 错误扩大的通用后缀规则把两个普通软件合并。
- Classification、History 和 Data 对同一 exe 得出不同结果。
- 为了保持旧名称又引入一张等价的新表，使重构失去意义。

### 9.2 必须停止并重新判断的情况

- [x] 未触发：无需修改数据库 schema 即可保持用户覆盖。
- [x] 未触发：页面组件未直接接管 identity 或 tracking policy。
- [x] 未触发：分类规则仍由 `shared/classification` owner 持有。
- [x] 未触发：仅保留测试与既有行为证据支持的窄 alias 规则。
- [x] 未触发：未新增兼容壳或转发层。
- [x] 未触发：History 与 Data 复用同一身份与政策入口。
- [x] 未触发：最终完整验证无 tracking 正确性失败。

出现任一情况时，不继续扩大实现；先补证据、缩小范围或更新本执行单并让维护者确认。

### 9.3 分阶段回滚

- 政策统一阶段失败：恢复 `ProcessMapper.shouldTrack()` 的旧分支，但保留新增测试用于定位差异。
- identity 阶段失败：只回滚显式规则切换，不回滚已经验证独立的政策统一。
- 显示名称阶段失败：恢复读模型名称优先级，但不得恢复用显示名推断 identity 的逻辑。
- 删除阶段失败：先查清剩余消费者；不以空转发文件掩盖未完成迁移。

回滚应按提交边界进行，不使用破坏性工作区重置，不覆盖维护者的其他未提交修改。

---

## 10. 最终验收清单

### 10.1 架构验收

- [x] 追踪政策只有一个 owner。
- [x] identity 规则只描述身份。
- [x] display name 不参与 identity 或 tracking policy 判断。
- [x] feature 私有读模型仍留在各自 feature。
- [x] `shared/*` 没有新增无 owner 的万能工具。
- [x] 不存在为了兼容而长期保留的空壳映射表。

### 10.2 功能验收

- [x] 未知软件可追踪。
- [x] 未知软件可进入分类页。
- [x] 用户改名和分类设置持久化正常。
- [x] 用户关闭追踪正常。
- [x] 系统进程不进入统计。
- [x] 生命周期噪声不进入统计。
- [x] 未确认同名软件不合并。
- [x] 已确认辅助进程规则符合测试证据。
- [x] Dashboard、History、Data 对应用身份和过滤结果一致。

### 10.3 删除验收

- [x] `defaultMappings.ts` 已删除。
- [x] `DEFAULT_APP_MAPPINGS` 零引用。
- [x] `resolveCanonicalDisplayName` 零引用。
- [x] `source: "default"` 零引用。
- [x] 不存在替换名字但职责相同的新大表。

### 10.4 质量验收

- [x] 专项测试通过。
- [x] 性能基线无明显回退。
- [x] `npm test` 通过。
- [x] `npm run build` 通过。
- [x] `npm run check:full` 通过。
- [x] `git diff --check` 通过。
- [x] 范围不含无关 UI、数据库 schema 或发布修改；Rust diff 包含独立 QQ 浏览器识别，以及对抗审查证明必需的 canonical override native 兼容修复。

---

## 11. 执行结果

- [x] 删除 125 项混合职责静态表（32 项 system、93 项普通软件名称），未建立等价替代表。
- [x] 系统与生命周期过滤集中到明确政策集合；普通未知软件默认可追踪。
- [x] 身份合并只依赖显式 canonical/alias 规则，显示名称不再参与身份推断。
- [x] 显示名称按“用户覆盖 > 运行时事实 > canonical exe 回退”解析。
- [x] 用户 displayName、category、color、track、captureTitle 覆盖键保持兼容，无数据库迁移。
- [x] QQ 浏览器 Web Sync 白名单加入规范化进程名 `qqbrowser.exe`，并覆盖大小写与空白输入测试。
- [x] 聚焦验证：Classification 63 项、Tracking 92 项、Import 27 项、Data 36 项、Tools 24 项及 Widget 回归均通过。
- [x] 性能验证：最终 `npm run perf:stable` 的 7 组基准、每组 5 次采样全部通过；History 当前读模型平均约 61.85ms，Dashboard 平均约 19.07ms。
- [x] 完整验证：`npm test`、`npm run build`、`npm run check:full`、`git diff --check` 全部通过。
- [x] 浏览器与后端：45 项真实浏览器 smoke 通过；Rust 429 项通过、1 项忽略；Clippy 与依赖审计通过。
- [x] 体积预算：lazy JS 84.90 KiB gzip，通过既定预算。
- [x] 旧符号零引用：`DEFAULT_APP_MAPPINGS`、`defaultMappings`、`resolveCanonicalDisplayName`、`mapDefaultApp`、`mapDefault(`、`source: "default"`。
- [x] 未创建 commit、未 push、未变更 GitHub Issue 或 Project 状态；这些操作不在本次授权范围。
- [x] 实现阶段结案后启动独立对抗式审查；审查结论与修复记录追加到本归档文档。

---

## 12. 对抗式审查记录

本任务在首次实现与归档后启动三路只读对抗式审查，分别攻击行为正确性、架构/性能边界、测试与文档真实性。每轮发现均由主执行者复核、修复并补回归；第三轮最终结果为三路 `no findings`。

### 12.1 第一轮发现与修复

- [x] 修复 Classification 30 天 bootstrap 把已保存 `displayName` 混入 runtime candidate fact 的问题；候选构建改用无用户覆盖映射。
- [x] 为候选名称增加来源等级，确保“用户覆盖 > canonical 主进程 runtime > exe fallback > alias fallback”；覆盖 Classification 单批/跨批、Tools、History 与 Data。
- [x] 修复 native tracking 按 raw alias 查询设置、无法读取 canonical `track:false` / `captureTitle:false` 的隐私缺口。
- [x] Rust canonical override 契约覆盖 Steam/Douyin derived component 与可追踪的 Alma/Cursor/Notion/Obsidian version/build alias。

### 12.2 第二轮发现与修复

- [x] 修复 History 5 秒 direct merge 先吞掉 alias 名称来源、使后续统计无法升级主进程名称的问题。
- [x] 修复持久层把缺失 `app_name` 提前替换为 exe、伪装成 runtime fact 的问题；SQLite catalog 与 observed stats 均保留空事实，格式化只在投影层发生。
- [x] 统一 Rust/TypeScript lifecycle alias grammar 的正反 fixture，覆盖 `setup-notion-beta.exe` 与 `beta-setup-notion.exe`。
- [x] 修复关闭 canonical 应用时不能立即结束活动 raw alias session/标题 sample 的问题；提交阶段与下一轮 tracking loop 均使用同一 Rust canonical resolver。

### 12.3 第三轮收敛与边界

- [x] 补充 `session_title_samples.end_time` 精确断言，排除标题关闭测试被随后 tracking seal 假绿。
- [x] 未授权 `unknownhelper.exe` 等保持独立 identity，不会被 owner override 误关闭。
- [x] Data read model 最终保持 902 行，未提高 903 行热点预算。
- [x] 三位审查员最终复核均为 `no findings`。

### 12.4 审查触发的 Rust 边界变更

- [x] `src-tauri/src/domain/tracking/session_identity.rs`：持久化 app override canonical identity 规则与正反测试。
- [x] `src-tauri/src/data/repositories/tracker_settings.rs`：canonical key 的 track/title settings lookup。
- [x] `src-tauri/src/data/repositories/sessions.rs`：活动 raw alias session 与 title 的即时 canonical 比较。
- [x] `src-tauri/src/data/classification_service.rs`：即时应用策略的端到端回归。
- [x] `src-tauri/src/engine/tracking/runtime/loop_state.rs`：下一轮 native loop 应用 canonical override 的回归测试；生产采样算法未改变。

---

## 13. 完成定义

只有同时满足以下条件，本执行单才可标记完成：

1. 旧表已从源码删除，而不是改名或变成转发壳。
2. 未知软件的追踪路径不依赖静态名单。
3. 系统拦截、identity 和 display 三种职责在代码中可清楚区分。
4. 不再存在“显示名相同即应用相同”的推断。
5. 已有用户覆盖无需人工迁移且继续生效。
6. 核心读模型和分类页通过完整回归。
7. 执行结果符合稳定期 owner 边界，没有制造新的共享垃圾桶。
8. 本文档已从 `docs/working/` 迁出，不再冒充长期事实来源。
