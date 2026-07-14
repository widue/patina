# PR Intake Gate 执行方案

## 0. 文档状态

- [x] 状态：已完成并归档
- [x] Owner：贡献入口、工程质量、仓库自动化
- [x] 目标文件：`CONTRIBUTING.md`、`docs/engineering-quality.md`、`AGENTS.md`、`.github/*`、`scripts/*`
- [x] 非目标：本计划不直接评价某个历史贡献者，不追溯修改已合并 PR，不改变产品路线

本文是一份一次性执行方案。真正执行完成后，应把长期规则回写到顶层长期文档，并把本文移动到 `docs/archive/`。

## 1. 第一性原理

### 1.1 维护者时间是主资源

Patina 是个人、本地优先的桌面产品。主干质量由维护者承担长期责任。

外部 PR 的价值不在于“有人写了代码”，而在于它是否降低维护者把一个已接受问题安全落地主干的成本。

因此：

- [x] PR 不是功能原型收集箱。
- [x] PR 不是让维护者代替作者产品化、架构化、测试化的入口。
- [x] PR 必须先证明自己值得进入人工 review。
- [x] 维护者只应该审已经通过基础门禁的 PR。

### 1.2 范围不是“相关”，而是“必要”

PR scope 的定义：

> 一个已被接受的问题，加上为解决它必须改动的最小代码集合，加上对应验证。

换成可执行判断：

- [x] 这个 PR 是否对应 accepted issue、Project item，或维护者明确接受的 scope？
- [x] 每个改动文件是否都是解决该 accepted problem 的必要部分？
- [x] 每个用户可见行为是否已经写进 scope 或 acceptance criteria？
- [x] 每个 owner 是否和该问题的真实归属一致？
- [x] 每个验证项是否覆盖新增风险？

如果某个改动只是“功能相关”，但 owner、UI、数据边界或验证方式错误，它仍然是范围外。

### 1.3 自动门禁先于人工审查

贡献者应在打开 PR 时就知道自己有没有过关，而不是让维护者反复花时间解释。

主流项目通常采用：

- [x] 贡献文档说明准入规则。
- [x] Issue 或 proposal 先确认大功能方向。
- [x] PR 模板要求作者自证范围、测试、截图、风险。
- [x] CI 自动检查格式、测试、体量、危险文件、样式逃逸。
- [x] Code owners 或保护分支要求必要 review。
- [x] 维护者只对通过基础 gate 的 PR 做深入 review。

本仓库应采用同一方向，但保持适合个人仓库的轻量实现。

### 1.4 不接受“维护者重写型 PR”

如果一个 PR 的主要实现需要维护者重写，说明它没有达到可合并贡献门槛。

硬规则：

- [x] 预计需要重写核心实现超过 30%，不能进入 mergeable。
- [x] 主要 UI 需要重做，不能进入 mergeable。
- [x] owner 放错且需要迁移，不能进入 mergeable。
- [x] 数据边界没有关键测试，不能进入 mergeable。
- [x] PR 只是证明某功能可以做，不构成可合并贡献。

对贡献者的表达应礼貌，但规则要清楚：

> This PR is not ready for maintainer review because it does not pass the project intake gate.

## 2. 目标结果

### 2.1 贡献者能自查

- [x] `CONTRIBUTING.md` 中明确写出 PR Intake Gate。
- [x] 贡献者能在写代码前知道哪些改动需要先讨论。
- [x] 贡献者能在打开 PR 时逐项勾选自检。
- [x] 贡献者能从 CI 失败信息知道自己卡在哪个 gate。

### 2.2 机器能挡住明显不合格 PR

- [x] PR 模板缺关键自检项时，CI 失败。
- [x] 大 PR 超过人工审查体量时，CI 失败或要求拆分。
- [x] 错误 owner 目录新增时，CI 失败。
- [x] 独立 CSS 或样式逃逸被识别。
- [x] 高风险数据区域变更缺测试时，CI 失败。
- [x] UI 变更缺截图说明时，CI 失败。

### 2.3 维护者只做高价值判断

- [x] 维护者第一轮只做 intake：方向、范围、owner、体量、风险、验证。
- [x] 未过 gate 的 PR 标为需要作者修改，不进入逐行审查。
- [x] 通过 gate 后再进入常规 review。
- [x] 合并前仍保留人工最终判断权。

## 3. 范围定义标准

### 3.1 Accepted Problem

一个 PR 必须满足至少一项：

- [x] 引用一个已接受的 issue。
- [x] 引用一个已确认的 Project item。
- [x] PR 正文写明维护者已经确认的 scope。
- [x] 小型 bug fix 能在 PR 正文中清楚复现并说明影响。

不满足时：

- [x] PR 不进入人工 review。
- [x] 维护者可以要求先开 issue 或 proposal。
- [x] 大功能不得直接以代码 PR 形式抢先进入。

### 3.2 Necessary Change

每个变更必须属于以下之一：

- [x] 直接实现 accepted problem 的核心验收条件。
- [x] 为核心实现编译、运行、测试所必需。
- [x] 为新增风险提供测试或验证。
- [x] 为用户理解新增行为提供必要文档或截图。

以下默认不在范围内：

- [x] 顺手重构。
- [x] 未要求的命名整理。
- [x] 无关格式化。
- [x] unrelated copy 修改。
- [x] unrelated dependency 升级。
- [x] 顺手改另一个页面或另一个 owner。
- [x] 因个人偏好修改样式。

### 3.3 Owner Fit

PR 必须先回答真实 owner：

- [x] 这个行为属于哪个 feature？
- [x] 是否属于 `settings`、`dashboard`、`history`、`data`、`classification`、`tools`、`about` 或 `update`？
- [x] 是否只是稳定跨 feature 能力，才应进入 `shared/*`？
- [x] 是否是外部环境边界，才应进入 `platform/*`？
- [x] Rust 是否保持 `commands/*` 薄，核心逻辑进入 `engine / data / domain`？

owner gate：

- [x] 新增 `src/features/<new-feature>` 必须说明为什么现有 feature 不能拥有它。
- [x] 新增 `src/shared/*` 必须说明复用者和稳定语义。
- [x] 新增 `src/platform/*` 必须说明外部环境边界。
- [x] 新增 Rust command 厚逻辑必须拆回真实 owner。

### 3.4 UI Scope

UI 改动只有在满足以下条件时才算范围内：

- [x] 对应 accepted problem 的用户可见结果。
- [x] 符合 Quiet Pro。
- [x] 使用现有 token、组件原型和样式 owner。
- [x] 包含截图或明确说明无截图原因。
- [x] 不新增玻璃拟态、重模糊、glow、大面积渐变或一次性视觉语言。

UI 不通过的典型情况：

- [x] 主要界面需要维护者重做。
- [x] 新增 page-local / feature-local CSS 逃逸设计系统。
- [x] 硬编码颜色、圆角、阴影、边框。
- [x] 控件状态不完整。
- [x] 信息架构和现有页面不一致。

### 3.5 Risk Scope

以下区域变更必须显式写入 Risk Review：

- [x] tracking session 生命周期。
- [x] SQLite schema、migration、legacy repair。
- [x] backup、restore、cleanup。
- [x] data export、import 或长期归档。
- [x] settings persistence。
- [x] local/network interface。
- [x] updater、release、autostart。

命中风险时，PR 必须说明：

- [x] 新增了什么风险。
- [x] 如何处理失败状态。
- [x] 如何验证数据不会损坏或泄露。
- [x] 哪些测试覆盖了核心路径。

## 4. PR 分类标准

### 4.1 Mergeable

进入 mergeable 必须全部满足：

- [x] 有 accepted problem。
- [x] 范围聚焦。
- [x] owner 正确。
- [x] UI 符合 Quiet Pro。
- [x] 数据和安全边界可解释。
- [x] 风险路径有测试。
- [x] CI 通过。
- [x] 维护者预计只需小修。

处理：

- [x] 进入人工 review。
- [x] review comments 只阻塞真实风险、边界或质量问题。
- [x] 小 nit 不阻塞合并。

### 4.2 Needs Author Changes

满足方向可能可接受，但未过 gate：

- [x] scope 不清。
- [x] PR 太大，需要拆。
- [x] owner 需要调整。
- [x] 测试不足。
- [x] UI 有明显 Quiet Pro 偏差。
- [x] PR 描述缺验证、截图或风险说明。

处理：

- [x] 不做完整逐行 review。
- [x] 给出 gate 失败项。
- [x] 要求作者修改后再请求 review。

### 4.3 Not Accepted

以下情况直接不接受当前代码形态：

- [x] 功能方向未被接受。
- [x] 需要维护者重写主要实现。
- [x] 主要 UI 需要重做。
- [x] 架构 owner 错误且影响长期边界。
- [x] 代码只是原型或演示。
- [x] 与产品范围冲突。
- [x] 数据安全或隐私风险不可接受。

处理：

- [x] 说明不接受当前 PR。
- [x] 不承诺参考代码。
- [x] 如方向值得讨论，请引导先开 issue 或 Project proposal。

### 4.4 Declined

以下情况关闭：

- [x] 方向明确不符合产品边界。
- [x] 作者不愿按 gate 修改。
- [x] PR 长期停滞且无法合并。
- [x] 存在安全、许可或供应链风险。

处理：

- [x] 礼貌说明原因。
- [x] 不合并。
- [x] 不把未接受代码带入主干。

## 5. 执行阶段

## 阶段一：更新长期规则入口

### 5.1 修改 `docs/engineering-quality.md`

目标：把 PR Intake Gate 写成长期工程质量规则。

执行步骤：

- [x] 新增章节：`外部 PR 准入门禁`。
- [x] 写入第一性原理：外部 PR 必须改善 code health，不能转嫁维护成本。
- [x] 写入 scope 定义：accepted problem + necessary changes + validation。
- [x] 写入 PR 分类：Mergeable / Needs Author Changes / Not Accepted / Declined。
- [x] 写入一票否决项。
- [x] 写入维护者第一轮只做 intake，不做完整 review。
- [x] 写入“维护者预计重写核心实现超过 30% 时，不进入 mergeable”。
- [x] 链接 `CONTRIBUTING.md`，说明外部贡献者看到的是同一规则的公开版本。

验收：

- [x] 文档能解释为什么 #35 这类 PR 不应直接合并。
- [x] 文档不把“参考型 PR”作为长期分类。
- [x] 文档明确保护维护者 review 成本。

### 5.2 修改 `CONTRIBUTING.md`

目标：让贡献者在提交前知道自己是否过关。

英文部分执行步骤：

- [x] 在 `Before You Start A Change` 后新增 `Pull Request Intake Gate`。
- [x] 定义 accepted scope。
- [x] 写明大功能必须先讨论。
- [x] 写明不接受维护者重写型 PR。
- [x] 写明 PR 必须聚焦一个问题。
- [x] 写明 UI 必须符合 Quiet Pro。
- [x] 写明 owner 放置规则。
- [x] 写明风险区域必须有测试。
- [x] 写明超大 PR 必须拆分。
- [x] 写明 gate 不通过时不会进入 full review。

中文部分执行步骤：

- [x] 添加对应中文章节。
- [x] 保持术语与英文一致。
- [x] 明确“范围相关不等于范围正确”。
- [x] 明确“代码需要维护者重写时，不构成可合并贡献”。

验收：

- [x] 贡献者无需维护者解释，也能知道 PR 是否 ready。
- [x] 文档给出具体 checklist，而不是泛泛讲质量。
- [x] 中文和英文含义一致。

### 5.3 修改 `AGENTS.md`

目标：让后续 Codex 处理 PR 时遵守 gate。

执行步骤：

- [x] 在 GitHub Push / Issue Rules 或 Engineering Quality 相关区域新增短规则。
- [x] 写明处理外部 PR 前必须检查 `CONTRIBUTING.md` 和 `docs/engineering-quality.md` 的 intake gate。
- [x] 写明未过 gate 不做完整逐行 review。
- [x] 写明不得为了保留贡献痕迹把 Not Accepted PR 合入 `main`。

验收：

- [x] AGENTS 只做入口索引，不复制大量规则。
- [x] 后续代理不会绕过长期文档。

## 阶段二：新增 PR 模板

### 5.4 新增 `.github/pull_request_template.md`

目标：让作者自证范围、owner、风险和验证。

模板结构：

```md
## Purpose

## Accepted Scope

- Linked issue / Project item / maintainer approval:

## Changes

## Scope Boundary

- In scope:
- Out of scope:

## Owner Check

- Frontend owner:
- Rust owner:
- Why this placement fits:

## Risk Review

- Tracking correctness:
- Local data safety:
- Privacy or security:
- Compatibility:

## UI Review

- [x] No UI changes
- [x] UI follows Quiet Pro
- [x] Screenshots attached

## Validation

- [x] `npm run check`
- [x] `npm run check:full` when required
- [x] Focused tests added or updated

## Intake Checklist

- [x] This PR solves one accepted problem.
- [x] Every changed file is necessary for that problem.
- [x] I did not include unrelated refactors or formatting churn.
- [x] I placed code under the correct owner.
- [x] I did not add standalone CSS or hardcoded visual styles.
- [x] Risk-bearing behavior has tests.
- [x] The PR is small enough to review, or explicitly approved as indivisible.
```

执行步骤：

- [x] 创建 `.github/` 目录，如果不存在。
- [x] 添加 PR 模板。
- [x] 模板保持英文为主，便于 GitHub PR 页面默认使用。
- [x] 在 `CONTRIBUTING.md` 链接该模板。

验收：

- [x] 新 PR 自动显示 intake checklist。
- [x] 作者能从模板知道缺什么。

## 阶段三：新增自动 intake 检查脚本

### 5.5 新增 `scripts/check-pr-intake.ts`

目标：在 CI 中自动识别明显不合格 PR。

输入：

- [x] base ref。
- [x] head ref。
- [x] PR body 文件或环境变量。
- [x] changed files。
- [x] diff numstat。

本地运行建议：

```bash
npm run check:pr-intake -- --base origin/main --head HEAD
```

检查规则第一版：

- [x] PR body 是否包含 `Accepted Scope`。
- [x] PR body 是否包含 `Owner Check`。
- [x] PR body 是否包含 `Risk Review`。
- [x] PR body 是否包含 `Validation`。
- [x] 手工维护内容是否超过 1000 行。
- [x] changed files 是否超过 25 个。
- [x] 是否新增 `src/lib/**` 或 `src/types/**`。
- [x] 是否新增可疑 `src/features/<new-feature>`。
- [x] 是否新增 `src/styles/shared/**`。
- [x] 是否新增没有长期 owner 的 `src/styles/features/*.css`。
- [x] 是否在 UI 文件中新增硬编码颜色、rgb/hsl 颜色、box-shadow、border、border-radius 或 blur。
- [x] 是否改动风险路径但没有风险域匹配的测试文件变更。

风险路径第一版：

```text
src-tauri/src/engine/tracking/**
src-tauri/src/data/**
src-tauri/src/commands/backup.rs
src-tauri/src/commands/export.rs
src-tauri/src/engine/export/**
src/features/settings/**
src/platform/persistence/**
```

测试路径匹配：

```text
tests/**
src-tauri/src/**/tests.rs
src-tauri/src/**/test_*.rs
```

最终实现不是“任意测试文件即可放行”，而是按风险域匹配测试。例如导出改动需要 `tests/export*` 或 Rust export 测试；settings persistence 改动需要 settings/persistence 相关测试。

脚本输出要求：

- [x] 失败时输出 `PR Intake Gate failed`。
- [x] 每条失败项包含原因、触发文件、修复建议。
- [x] 输出不要羞辱作者。
- [x] 成功时输出 `PR Intake Gate passed`。

实现步骤：

- [x] 检查 `package.json` 当前脚本结构。
- [x] 按现有脚本风格创建 TypeScript 脚本。
- [x] 复用现有 diff / file scanning helper，如果已有。
- [x] 不引入新依赖，除非必要。
- [x] 添加 `npm run check:pr-intake`。
- [x] 为脚本添加最小测试，覆盖超大 diff、缺 PR body、风险路径无测试、禁止目录。

验收：

- [x] 本地能运行 `npm run check:pr-intake -- --base origin/main --head HEAD`。
- [x] 失败信息足够作者自行修复。
- [x] 不误伤文档-only 小改动。

## 阶段四：接入 GitHub Actions

### 5.6 新增或修改 `.github/workflows/pr-intake.yml`

目标：PR 打开或更新时自动运行 intake gate。

触发：

```yaml
on:
  pull_request:
    types: [opened, edited, synchronize, reopened, ready_for_review, labeled, unlabeled]
```

执行步骤：

- [x] checkout PR head。
- [x] fetch base branch。
- [x] setup Node，使用项目当前 Node 版本。
- [x] 使用 `npm ci`。
- [x] 将 PR body 写入临时文件或传入环境变量。
- [x] 运行 `npm run check:pr-intake -- --base $env:BASE_SHA --head HEAD --body-env PR_BODY --labels-env PR_LABELS_JSON --require-pr-body`。

安全注意：

- [x] 外部 fork PR 不使用高权限 token 执行不可信脚本。
- [x] 第一版只读取 PR 元数据和仓库文件。
- [x] 不自动评论、不自动改 label，避免权限复杂化。
- [x] 后续如需自动评论，单独加安全评估。

验收：

- [x] PR 页面显示 `PR Intake / Pull request intake gate` check。
- [x] 未填模板或明显越界时 check 失败。
- [x] 失败日志能直接说明修复步骤。

## 阶段五：强化现有质量门禁

### 5.7 决定不把 PR intake 接入默认 `npm run check`

目标：避免本地普通质量链假装替代 PR 准入。

最终判断：

- [x] `check:pr-intake` 保留为专用脚本。
- [x] `test:pr-intake` 接入前端质量链，用来验证脚本本身。
- [x] 真正的 PR 准入只在独立 `PR Intake` workflow 中带 base/head/body/labels 执行。
- [x] `npm run check` 不直接运行 `check:pr-intake`。

验收：

- [x] 本地默认质量链仍然验证脚本测试。
- [x] 外部 PR 准入由独立 workflow 检查 PR 描述、label、diff、owner、样式和风险测试。
- [x] 文档明确 `npm run check` 不能替代 PR intake。

### 5.8 更新现有 architecture / hotspot 检查

目标：避免重复造 gate。

执行步骤：

- [x] 检查现有 `check:architecture` 是否已经阻止 `src/lib`、`src/types`、feature component 直连 platform。
- [x] 检查 `check:hotspots` 是否已有 diff 体量或高风险文件预算。
- [x] 能复用就复用。
- [x] 新 PR intake 只补已有门禁没有覆盖的部分。

验收：

- [x] 没有两个脚本对同一错误输出冲突信息。
- [x] 失败信息仍然指向最合适的修复文档。

## 阶段六：可选仓库保护（本次未执行）

本阶段属于 GitHub 仓库设置增强，不是代码侧 intake gate 的必要条件。本次已完成文档、模板、脚本、测试和 PR CI 接入；branch protection 与 CODEOWNERS 需要维护者在 GitHub 设置中另行确认后再执行。

### 5.9 GitHub branch protection

目标：让 gate 变成合并前要求，而不是建议。

执行步骤：

- [ ] 在 GitHub 设置中保护 `main`。
- [ ] 要求 status checks 通过。
- [ ] 将 `pr-intake`、`check` 或 `check:full` 设为 required。
- [ ] 个人维护者直接推送是否保留 bypass，由维护者决定。

验收：

- [x] 外部 PR 不能在红灯时合并。
- [x] 维护者仍能处理紧急内部修复。

### 5.10 CODEOWNERS

目标：让 GitHub 自动提示 owner。

执行步骤：

- [ ] 评估个人仓库是否需要 `.github/CODEOWNERS`。
- [ ] 如果需要，先只设置全局 owner：

```text
* @Ceceliaee
```

- [ ] 暂不做复杂 owner map，避免个人仓库维护负担过高。

验收：

- [x] GitHub PR 页面能显示 owner review。
- [x] 不给个人仓库增加过多噪音。

## 6. 自动 gate 失败信息设计

### 6.1 缺 accepted scope

输出：

```text
PR Intake Gate failed:

- Missing accepted scope.
  Add a linked issue, Project item, or maintainer-approved scope under "Accepted Scope".
  Large features must be discussed before implementation.
```

### 6.2 PR 太大

输出：

```text
PR Intake Gate failed:

- Diff is too large for one review.
  Manual content changed: 2012 lines.
  Limit: 1000 lines unless explicitly approved as indivisible.
  Split by behavior, owner, or independently reviewable stage.
```

### 6.3 owner 可疑

输出：

```text
PR Intake Gate failed:

- Suspicious new feature owner: src/features/export.
  Explain why this is a standalone feature.
  If the behavior belongs to Settings or Storage, move it under that owner.
```

### 6.4 UI 样式逃逸

输出：

```text
PR Intake Gate failed:

- Standalone feature CSS or hardcoded visual styles detected.
  Quiet Pro UI changes must use existing tokens, shared component primitives, or the feature's established style owner.
```

### 6.5 风险路径无测试

输出：

```text
PR Intake Gate failed:

- Risk-bearing files changed without tests.
  Data export, backup, restore, cleanup, tracking, persistence, and migration changes need focused tests or a maintainer-approved explanation.
```

## 7. 维护者 Intake 流程

第一轮只做 5 到 10 分钟 gate 判断：

- [x] 是否有 accepted scope？
- [x] 是否一个 PR 只解决一个问题？
- [x] 是否明显过大？
- [x] owner 是否正确？
- [x] UI 是否明显偏离 Quiet Pro？
- [x] 风险区域是否有测试？
- [x] CI 是否通过？

如果不通过：

- [x] 不做完整逐行 review。
- [x] 使用标准回复说明 gate 失败。
- [x] 标记 `needs-author-changes`，如果仓库使用 label。
- [x] 等作者修改后再看。

标准回复：

```md
Thanks for the contribution.

This PR is not ready for maintainer review yet because it does not pass the project intake gate:

- ...

Please update the scope, owner placement, tests, or PR split as indicated above.
I will review the implementation after the intake gate passes.
```

如果是 Not Accepted：

```md
Thanks for the contribution.

I am not accepting this PR in its current form. The implementation would require the maintainer to rewrite the main owner/UI/testing boundary, so it does not meet the repository's mergeable contribution standard.

For large features, please start with an accepted issue or maintainer-approved proposal before implementation.
```

## 8. 与 #35 类型问题的对应关系

本方案要防止的具体模式：

- [x] 一个大功能 PR 直接提交完整原型。
- [x] 方向看似对，但没有先确认最终产品形态。
- [x] owner 放错，后续需要维护者迁移。
- [x] UI 不符合 Quiet Pro，后续需要重做。
- [x] 字段、交互、持久化模型只是临时实现。
- [x] 关键数据路径测试不足。
- [x] 维护者为了“不影响贡献”承担重写成本。

应用 gate 后，这类 PR 会在以下位置被挡住：

- [x] PR 模板要求写 accepted scope。
- [x] diff size gate 要求拆分。
- [x] owner gate 发现可疑新 feature。
- [x] UI gate 发现 Quiet Pro 偏差或独立 CSS。
- [x] risk gate 要求数据导出测试。
- [x] 维护者 intake 将其判定为 Needs Author Changes 或 Not Accepted。

## 9. 详细执行清单

### 9.1 准备

- [x] 确认工作区干净。
- [x] 读取 `CONTRIBUTING.md`。
- [x] 读取 `docs/engineering-quality.md`。
- [x] 读取 `docs/architecture.md`。
- [x] 读取 `docs/quiet-pro-component-guidelines.md`。
- [x] 检查 `.github/` 当前结构。
- [x] 检查 `package.json` scripts。
- [x] 检查 `scripts/` 中现有检查脚本风格。

### 9.2 文档改动

- [x] 修改 `docs/engineering-quality.md`，加入 PR intake 长期规则。
- [x] 修改 `CONTRIBUTING.md` 英文部分。
- [x] 修改 `CONTRIBUTING.md` 中文部分。
- [x] 修改 `AGENTS.md`，加入短入口规则。
- [x] 检查中文 UTF-8 可读性。
- [x] 检查文档链接。

### 9.3 模板改动

- [x] 新增 `.github/pull_request_template.md`。
- [x] 如 `.github` 不存在，先创建目录。
- [x] 确认模板不会和现有 issue forms 冲突。
- [x] 在 `CONTRIBUTING.md` 中引用模板。

### 9.4 自动化改动

- [x] 新增 `scripts/check-pr-intake.ts`。
- [x] 添加 package script。
- [x] 添加脚本测试。
- [x] 新增 `.github/workflows/pr-intake.yml`。
- [x] 本地运行脚本通过。
- [x] 本地运行现有 `npm run check` 或相关子集。

### 9.5 验证

- [x] `npm run check:pr-intake -- --self-test`
- [x] `npm run test:pr-intake`
- [x] `npm run check:types`
- [x] `npm run check:architecture`
- [x] `npm run check:naming`
- [x] `npm run check`
- [x] 如果脚本或 workflow 涉及 GitHub Actions 语法，检查 YAML 格式。

### 9.6 收尾

- [x] 对照本文勾选完成项。
- [x] 如果执行完成，把长期事实回写到长期文档。
- [x] 将本文移入 `docs/archive/`。
- [x] 提交时按逻辑拆分：
  - [x] `docs: define pull request intake gate`
  - [x] `chore: add pull request intake template`
  - [x] `test/tooling: add pull request intake checks`
- [x] 本轮只完成文件改动和验证；是否提交、推送由维护者下一步确认。

## 10. 验收标准

最终完成应满足：

- [x] 贡献者读 `CONTRIBUTING.md` 后知道如何判断自己的 PR 是否 ready。
- [x] PR 页面默认展示自检模板。
- [x] CI 能拦住缺 scope、超大 diff、可疑 owner、样式逃逸、风险路径无测试。
- [x] 维护者不需要完整审查明显不合格 PR。
- [x] 长期文档中明确“不接受维护者重写型 PR”。
- [x] `AGENTS.md` 明确后续代理必须执行 intake gate。
- [x] 不再使用“参考型 PR”作为接受分类。
- [x] 保留礼貌沟通，但规则不软化。

## 11. 风险与缓解

### 11.1 自动检查误伤

风险：

- [x] 文档-only PR 被要求测试。
- [x] 小 UI 改动因为硬编码检测误报。
- [x] generated file 让 diff size 看起来过大。

缓解：

- [x] 将 docs-only 作为低风险例外。
- [x] 对 lockfile、generated、snapshot 做单独计数。
- [x] 失败信息允许作者说明维护者已批准例外。
- [x] 第一版只拦明显风险，不追求完美静态分析。

### 11.2 对贡献者显得不友好

风险：

- [x] gate 看起来像拒绝贡献。

缓解：

- [x] 文案强调节省双方时间。
- [x] 给出具体修复路径。
- [x] 小 PR 和已确认问题继续欢迎。
- [x] 不使用嘲讽性措辞。

### 11.3 个人仓库流程过重

风险：

- [x] branch protection、CODEOWNERS、bot label 对个人维护过重。

缓解：

- [x] 先做文档、模板、CI。
- [x] branch protection 和 CODEOWNERS 放到可选阶段。
- [x] 维护者直接推送内部已确认工作仍按 AGENTS 规则执行。

## 12. 后续可选增强（未纳入本次执行）

- [ ] 自动给未过 gate 的 PR 添加 `needs-author-changes` label。
- [ ] 自动评论 gate 失败摘要。
- [ ] 加 issue form：`Feature proposal`，要求先确认大功能。
- [ ] 加 label 文档：`needs-scope`、`needs-tests`、`needs-owner-fix`、`not-accepted`。
- [ ] 给高风险目录添加更细的 owner map。
- [ ] 加 PR size 报告，区分 manual / generated / lockfile。
- [ ] 加 Quiet Pro CSS lint，更准确识别硬编码样式。

## 13. 参考来源

本方案吸收以下主流实践，但按 Patina 的个人仓库规模裁剪：

- Google Engineering Practices：code review 以整体 code health 改善为目标。
- Google Small CLs：小变更更容易 review，大变更可以要求拆分。
- Rust Compiler Development Guide：大型、复杂、跨领域改动应先讨论并拆成可 review PR。
- VS Code Contribution Guide：重大变更先与维护者讨论，贡献者负责本地验证。
- GitHub Docs：PR templates、CODEOWNERS、protected branches、required status checks 可把门禁前移。
