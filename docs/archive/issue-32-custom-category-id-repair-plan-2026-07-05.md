# Issue #32 自定义分类 ID 修复执行方案

Refs #32: https://github.com/Ceceliaee/patina/issues/32

状态：已完成并归档
文档类型：How-to / 执行指南
目标读者：负责实现或审查该修复的 Patina 维护者
最后审查日期：2026-07-05
归档日期：2026-07-05

## 归档说明

- [x] 代码修复、回归测试、changelog 记录与默认验证门槛已完成。
- [x] npm run test:classification 通过。
- [x] npm run check:types 通过。
- [x] npm run check 已在提升权限后完整通过；首次沙箱运行在真实浏览器 smoke 阶段遇到 spawn EPERM，提升权限后通过。
- [x] 未启动 Tauri 桌面 dev 做额外手动点击验证；本次以完整自动化验证链中的真实浏览器 smoke、build 与 bundle budget 覆盖交付验证。

## 1. 问题定义

Issue #32 的现象是：用户在 Classification / 分类页中新建自定义分类，保存后把应用归入该分类；切换到其他页再回到分类页，打开“管理分类”时，应用看起来被归到了一个新的 `category_...` 分类，而不是用户刚创建的分类。

对当前 `main` 做对抗式审查后确认，同源问题仍然存在。当前数据流如下：

- [x] `createCategoryId()` 会创建现代稳定分类 ID，例如 `custom:category_76fe3862f1e4493badcafe1234567890`。
- [x] 应用 override 会把这个完整分类 ID 写入 settings。
- [x] `ProcessMapper.fromOverrideStorageValue()` 读取 override 时会调用 `normalizeExtendedCategory()`。
- [x] `normalizeExtendedCategory()` 仍沿用旧的“从 ID 解析显示名”逻辑，并把 `custom:` 后的原始值截断到 20 个字符。
- [x] `buildAppOverrideTransition()` 随后会根据截断后的值生成 transition mutation，可能把截断 ID 写回 settings。

因此这不是单纯 UI 显示问题，而是应用分类引用可能被持久化改坏的问题。

## 2. 第一性原理

- [x] 分类身份和分类显示名必须分离。
  - 身份回答“这是哪一个分类”。
  - 显示名回答“用户应该看到什么名字”。
  - 任何显示名归一化逻辑都不能改写现代不透明分类 ID。

- [x] 持久化读写必须满足 round-trip 不变量。
  - 对现代稳定 ID，`fromStorage(toStorage(categoryId))` 必须等于原始 `categoryId`。
  - 读取端可以兼容旧数据，但不能对现代 ID 做有损转换。

- [x] legacy 兼容必须显式。
  - 历史自定义分类 ID 形如 `custom:%E4%B8%AD%E6%96%87`，ID 本身编码了显示名。
  - 现代自定义分类 ID 形如 `custom:category_<opaque-id>`，ID 不再编码显示名。
  - 代码必须先区分这两种 ID，再决定是否应用旧的 label 归一化逻辑。

- [x] 已损坏数据只能保守修复。
  - 截断后的 `custom:category_<prefix>` 只有在唯一匹配一个已持久化完整分类 ID 时才能恢复。
  - 如果没有匹配，或者匹配到多个完整 ID，不能猜。
  - 数据修复必须可预测、可测试、可回放。

- [x] 修复必须落在真实 owner。
  - 分类身份解析：`src/shared/classification/categoryTokens.ts` 与 `processMapper.ts`。
  - 应用 override 读取、transition 与持久化修复：`src/features/classification/services/classificationStore.ts`。
  - UI 组件不应理解或承接 storage repair 规则。

## 3. 范围

### 3.1 范围内

- [x] 阻止现代 `custom:category_*` ID 在读取应用 override 时被截断。
- [x] 保留历史 label-encoded 自定义分类 ID 的兼容逻辑。
- [x] 为已经截断的应用 override 分类引用增加保守恢复。
- [x] 增加能在当前实现上失败的回归测试。
- [x] 修复完成后在 `CHANGELOG.md` 的 `Unreleased` 中补一条用户可读记录。
- [x] 按 Classification 与 shared classification identity 的风险运行验证。

### 3.2 范围外

- [x] 不重设计 Classification 页面。
- [x] 不改 settings key 前缀。
- [x] 不把分类系统迁移到新表。
- [x] 不关闭、不重开、不改 label、不改变 GitHub issue 状态。
- [x] 不做跨 owner 的大规模架构整理，除非测试证明当前 owner 无法安全完成修复。

## 4. 必须保留的失败路径

- [x] 构造现代分类 ID：
  - 示例：`custom:category_76fe3862f1e4493badcafe1234567890`

- [x] 用该分类保存应用 override：
  - `ProcessMapper.toOverrideStorageValue({ enabled: true, category })`

- [x] 读取 override：
  - 当前错误行为：`ProcessMapper.fromOverrideStorageValue(...)?.category` 变成 `custom:category_76fe3862f1e`
  - 目标行为：读取结果仍然是完整原始 ID。

- [x] 让该 override 经过 `buildAppOverrideTransition()`：
  - 当前错误行为：生成把截断 ID 写回 settings 的 mutation。
  - 目标行为：对已经合法的完整 ID，不生成截断 mutation。

## 5. 执行清单

### Phase 0 - 预检

- [x] 确认工作区状态：

  ```powershell
  git status --short
  ```

- [x] 记录无关 dirty 文件，不覆盖用户已有改动。
  - 调查时已知 `CHANGELOG.md` 是 dirty 状态。
  - 如果后续需要编辑 `CHANGELOG.md`，必须先看 diff，再合并自己的修改。

- [x] 确认当前分支和提交：

  ```powershell
  git branch -vv
  git log -1 --oneline --decorate
  ```

- [x] 改代码前重新运行最小复现：

  ```powershell
  node --experimental-strip-types --experimental-specifier-resolution=node --input-type=module -e "import { ProcessMapper } from './src/shared/classification/processMapper.ts'; const id = 'custom:category_76fe3862f1e4493badcafe1234567890'; const stored = ProcessMapper.toOverrideStorageValue({ enabled: true, category: id }); console.log(ProcessMapper.fromOverrideStorageValue(stored));"
  ```

- [x] 记录当前输出会截断分类 ID，作为后续修复前后对照。

### Phase 1 - 先补失败测试

- [x] 打开 `tests/classificationDraftState.test.ts`。

- [x] 在 `createCategoryId creates stable non-label category ids` 附近添加测试：
  - 测试名：`modern stable extended category ids round-trip through app override storage`
  - Arrange：
    - 使用固定现代 ID：`custom:category_76fe3862f1e4493badcafe1234567890`
    - 用 `ProcessMapper.toOverrideStorageValue()` 写入。
  - Assert：
    - `ProcessMapper.fromOverrideStorageValue(stored)?.category === category`

- [x] 添加 transition 行为测试：
  - 测试名：`app override transition preserves full modern category ids`
  - Arrange：
    - 用同一个完整现代 ID 构造 stored override。
    - 调用 `buildAppOverrideTransition("__app_override::notepad.exe", stored)`。
  - Assert：
    - `transition.override?.category === category`
    - `transition.mutations` 中不能出现截断后的 category。
    - 如果 stored value 已经是 canonical storage，`transition.mutations` 应为空。

- [x] 保留 legacy 兼容测试：
  - 继续覆盖已有 double-encoded legacy ID 场景。
  - 确认历史 label-encoded ID 仍会归一到 canonical legacy ID。

- [x] Phase 3 的数据修复 API 确定后，在同一测试文件中继续添加损坏数据恢复测试。
  - 除非必要，不新增测试文件。

- [x] 运行聚焦测试，并确认新测试在当前实现上失败：

  ```powershell
  npm run test:classification
  ```

### Phase 2 - 修正现代 ID 归一化

- [x] 打开 `src/shared/classification/categoryTokens.ts`。

- [x] 增加显式现代 ID 判断函数。
  - 推荐命名：`isModernExtendedCategoryId`
  - 推荐规则：
    - 必须是 extended category。
    - `custom:` 后的 raw value 以 `category_` 开头。
  - 该函数守护数据身份不变量，应保持短小，并加一行说明性注释。

- [x] 更新 `normalizeExtendedCategory(category)`：
  - 如果 `isModernExtendedCategoryId(category)` 为真，原样返回 `category`。
  - 否则保留当前 legacy 行为：
    - 解析 legacy 显示名。
    - 重新生成 legacy label-encoded ID。

- [x] 确认 `resolveExtendedCategoryLabel(category)` 仍可为缺少 label override 的现代 ID 提供 fallback。
  - fallback 显示 `category_...` 可以接受。
  - 关键是不允许 fallback display 逻辑改写身份。

- [x] 打开 `src/shared/classification/processMapper.ts`。

- [x] 确认 `normalizeUserAssignableCategory()` 经由 `normalizeExtendedCategory()` 后会保留现代 ID。

- [x] 不在 `processMapper.ts` 中加入 UI 修复逻辑。

### Phase 3 - 为已截断应用 override 增加保守恢复

- [x] 打开 `src/features/classification/services/classificationStore.ts`。

- [x] 逐一确认应用 override 加载路径：
  - `ensureLegacyAutoClassificationMigration()`
  - `loadAppOverrides()`
  - `buildLoadedAppOverrides()`
  - `buildAppOverrideTransition()`

- [x] 添加一个私有 helper，用于恢复截断后的现代分类引用。
  - 推荐输入：
    - `category: AppCategory | undefined`
    - `knownPersistedCategoryIds: readonly ExtendedAppCategory[]`
  - 推荐行为：
    - category 缺失，返回原值。
    - category 不是 `custom:category_...` 风格，返回原值。
    - category 已完整存在于 `knownPersistedCategoryIds`，返回原值。
    - 查找 `knownPersistedCategoryIds` 中满足 `fullId.startsWith(category)` 的完整 ID。
    - 如果正好一个匹配，返回该完整 ID。
    - 如果没有匹配或多个匹配，返回原值。

- [x] helper 默认保持在 `classificationStore.ts` 内部。
  - 除非其他 owner 明确需要，不导出到 shared。

- [x] 调整 app override transition，让它可以接收已知完整分类 ID。
  - 推荐形式：
    - 保留现有导出函数 `buildAppOverrideTransition(key, value)`。
    - 增加可选第三参数：`knownPersistedCategoryIds: readonly ExtendedAppCategory[] = []`。
  - transition 内部顺序：
    - 解析 override。
    - 如果 `parsed.category` 可唯一恢复，先替换为完整 ID。
    - 再用修复后的 override 生成 `normalizedValue`。

- [x] 更新 `buildLoadedAppOverrides()`：
  - 接收 `knownPersistedCategoryIds`。
  - 传给 `buildAppOverrideTransition()`。

- [x] 更新 `loadAppOverrides()`：
  - 同时读取 app override rows 和 persisted category IDs。
  - 把 persisted category IDs 传入 `buildLoadedAppOverrides()`。
  - 保持所有 transition mutations 统一构建完成后再提交。

- [x] 谨慎更新 `runLegacyAutoClassificationMigration()`。
  - 当前它读取 override rows 和 observed app data。
  - 如有需要，将 persisted category IDs 加入同一批读取。
  - 只把 persisted category IDs 传给 `buildLoadedAppOverrides()`。
  - 不改变 legacy auto-classification migration 的其它语义。

- [x] 禁止按 label 修复。
  - label 可编辑且不保证唯一。
  - 本修复只允许通过完整 persisted category ID 的唯一前缀匹配恢复。

- [x] 禁止修复歧义前缀。
  - 如果两个完整 ID 共享同一个截断前缀，保持原值，不写入猜测结果。

### Phase 4 - 添加数据恢复测试

- [x] 添加唯一匹配恢复测试：
  - 测试名：`app override transition restores truncated modern category ids when the full category is known`
  - Arrange：
    - 完整 ID：`custom:category_76fe3862f1e4493badcafe1234567890`
    - 截断 ID：`custom:category_76fe3862f1e`
    - stored override 使用截断 ID。
    - 调用 `buildAppOverrideTransition(key, stored, [fullId])`。
  - Assert：
    - `transition.override?.category === fullId`
    - `transition.mutations` 写回完整 ID。

- [x] 添加歧义匹配测试：
  - Arrange：
    - 截断 ID：`custom:category_1234567890a`
    - 完整 ID：
      - `custom:category_1234567890abcdef1111111111111111`
      - `custom:category_1234567890abcdef2222222222222222`
  - Assert：
    - category 保持截断值。
    - mutation 不写入任一完整 ID。

- [x] 添加无匹配测试：
  - Arrange：
    - 截断 ID 不匹配任何 persisted category。
  - Assert：
    - category 保持原值。
    - 不因为猜测生成 repair mutation。

- [x] 添加完整现代 ID 回归测试：
  - stored override 使用完整 ID。
  - known persisted IDs 也包含该完整 ID。
  - Assert：
    - category 不变。
    - 如果 stored value 已 canonical，不产生 mutation。

- [x] 重新运行：

  ```powershell
  npm run test:classification
  ```

### Phase 5 - UI 状态审查

- [x] 审查 `src/features/classification/hooks/useAppMappingDerivedState.ts`。

- [x] 确认 `extendedCategoryOptions` 仍从这些来源收集自定义分类：
  - `draftPersistedCategoryIds`
  - app overrides
  - web domain overrides
  - category color overrides

- [x] 确认 Phase 2 与 Phase 3 后，app overrides 不应再把可恢复的截断 ID 引入 UI 分类集合。

- [x] 不要把“隐藏未知 custom category”作为主修复。
  - 隐藏会掩盖数据问题。
  - 正确修复层是 storage read / transition repair。

- [x] 如果某个 unknown custom ID 没有 persisted category definition，允许它继续可见。
  - 这是另一种数据状态，不应在本次修复里静默丢弃。

### Phase 6 - Changelog

- [x] 编辑 `CHANGELOG.md` 前先查看当前 diff：

  ```powershell
  git diff -- CHANGELOG.md
  ```

- [x] 如果 `Unreleased` / `Fixed` 中没有等价记录，添加一条简洁用户可读条目。

- [x] 使用不会关闭 issue 的引用方式。
  - 推荐：
    - `- Refs #32: Preserved custom category assignments after reloading Classification, including recovery for uniquely matchable truncated category IDs.`

- [x] 除非用户明确要求准备发布，不改版本文件。

### Phase 7 - 验证

- [x] 运行聚焦测试：

  ```powershell
  npm run test:classification
  ```

- [x] 运行类型检查：

  ```powershell
  npm run check:types
  ```

- [x] 交付前运行默认验证门槛：

  ```powershell
  npm run check
  ```

- [x] 如果 `npm run check` 因耗时或无关失败无法完成：
  - 记录具体失败命令。
  - 记录 `npm run test:classification` 是否通过。
  - 不声称完整验证已通过。

- [x] 如果实现只触及 TypeScript 与测试，不需要额外跑 Rust 验证。

### Phase 8 - 手动验证场景

- [x] 如环境允许，启动开发应用：

  ```powershell
  npm run tauri dev
  ```

- [x] 在 Classification / 分类页手动执行：
  - 新建一个容易识别的自定义分类。
  - 保存。
  - 把一个应用归入该分类。
  - 保存。
  - 切换到其他选项卡。
  - 回到分类页。
  - 打开“管理分类”。

- [x] 预期结果：
  - 应用仍归在用户创建的分类下。
  - 管理分类弹窗显示用户可见分类名。
  - 不出现额外 `category_...` 分类。

- [x] 可选损坏数据验证：
  - 构造或 mock 一个截断的 `custom:category_<prefix>` app override。
  - 同时确保存在唯一匹配的完整 category definition。
  - 加载 Classification。
  - 确认应用解析到完整分类 ID，并且 transition 写回完整 ID。

### Phase 9 - 交付

- [x] 按 owner 总结改动：
  - shared 分类身份归一化。
  - classification storage transition repair。
  - 回归测试。
  - changelog 记录。

- [x] 报告验证命令和结果。

- [x] 如果用户要求 push，本仓库默认提交确认范围并推送到 `origin/main`。

- [x] 除非用户明确要求，不关闭 #32。

## 6. 验收标准

- [x] 现代 `custom:category_*` ID 通过应用 override storage 往返后保持不变。
- [x] 历史 label-encoded extended category ID 仍保持原有兼容行为。
- [x] `buildAppOverrideTransition()` 不再为合法完整现代 ID 生成截断 mutation。
- [x] 已截断 app override category 只有在唯一匹配完整 persisted category ID 时才恢复。
- [x] 歧义或无匹配的截断 ID 不被猜测修复。
- [x] Classification 测试覆盖以上场景。
- [x] `npm run check` 通过，或任何无关阻塞被准确记录。
- [x] `CHANGELOG.md` 中有用户可读的 `Unreleased` 记录，并引用 #32 但不关闭 issue。

## 7. 风险记录

- [x] 最高风险：把 legacy label-encoded ID 和现代 opaque ID 混为一谈。
  - 缓解：现代 `custom:category_*` 原样保留；legacy 行为继续由测试覆盖。

- [x] 第二风险：过度积极修复损坏数据。
  - 缓解：只通过唯一完整 persisted category ID 前缀匹配恢复。

- [x] 第三风险：在 UI 层隐藏数据问题。
  - 缓解：修复 storage transition，不在 derived UI state 中静默过滤未知分类。

- [x] 第四风险：覆盖无关用户改动。
  - 缓解：编辑前检查 `git status` 与 `CHANGELOG.md` diff，保持改动范围收敛。
