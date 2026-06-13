# 发布 workflow 去除 Actions 提交执行方案

状态：已完成并归档（2026-06-13）  
创建日期：2026-06-13  
目标：让 GitHub Actions 发布流程只负责校验、构建、发 Release 和上传更新产物，不再生成版本提交。  
关联文件：`.github/workflows/prepare-release.yml`、`scripts/release.ts`、`tests/releasePolicy.test.ts`、`docs/versioning-and-release-policy.md`

## 执行结果

- [x] `.github/workflows/prepare-release.yml` 已移除自动 `sync-version`、`git commit`、`git push origin HEAD` 和硬编码 commit author。
- [x] `workflow_dispatch` 已收口为只补跑已有 `vX.Y.Z` tag；目标 tag 不存在时会失败并提示先推送 tag。
- [x] workflow 会 checkout 到 release tag，并验证 `HEAD` 与 tag commit 一致。
- [x] workflow 发布前新增 `validate-version-files`，防止 tag 版本与版本文件不一致。
- [x] `scripts/release.ts` 已新增版本文件一致性校验命令和可测试纯函数。
- [x] `tests/releasePolicy.test.ts` 已覆盖版本文件、Tauri 配置、Cargo、版本规范和 changelog 版本节校验。
- [x] `package.json` 已新增 `release:validate-version-files`。
- [x] `docs/versioning-and-release-policy.md` 已回写新的长期发布流程。
- [x] `CHANGELOG.md` 已在 `Unreleased / Internal` 记录发布 workflow 收口。
- [x] 已完成静态搜索，确认 workflow 中没有 Actions 写提交路径残留。
- [x] 已完成验证：`npm run test:release`、`npm run release:validate-version-files -- 1.6.0`、`npm run release:validate-changelog -- 1.6.0`、`npm run check:full`。
- [x] 初次 `npm run check:full` 在 sandbox 内因 `spawn EPERM` 被拦截；已按权限规则提升后重跑并通过。
- [x] 本执行方案已归档到 `docs/archive/`。

## 0. 文档定位

这是一份一次性可勾选执行方案，用于修正当前 `Publish Release` workflow 中由 GitHub Actions 自动修改版本文件、提交 commit、创建 tag 的发布路径。

执行完成时已完成：

- 长期规则已回写到 `docs/versioning-and-release-policy.md`。
- 本执行方案已移入 `docs/archive/`。

本文不是长期发布规范。长期规则仍以 `docs/versioning-and-release-policy.md` 为准。

## 1. 背景与问题

当前 `.github/workflows/prepare-release.yml` 支持两种触发方式：

- `push` 到 `vX.Y.Z` 或 `vX.Y.Z-prerelease` tag。
- 手动 `workflow_dispatch` 输入版本号。

当前 workflow 在目标 tag 不存在时会执行：

- `node --experimental-strip-types scripts/release.ts sync-version <version>`
- `git config user.name "Zoe"`
- `git config user.email "1815842281@qq.com"`
- `git commit -m "release: v$version"`
- `git tag "v$version"`
- `git push origin HEAD:${{ github.ref_name }}`
- `git push origin "v$version"`

这带来几个问题：

- [ ] Actions 会生成真实代码 commit，污染发布历史。
- [ ] 提交作者信息硬编码个人邮箱，不适合作为长期 workflow 配置。
- [ ] 如果改为 `github-actions[bot]` 提交，contributors 可能出现 Actions 作者。
- [ ] workflow 同时承担“准备版本文件”和“正式发布”两个职责，边界不清。
- [ ] 手动触发时，存在用输入版本生成 release commit 的路径，容易绕过本地发布准备审查。
- [ ] `docs/versioning-and-release-policy.md` 已经要求本地准备版本文件和 changelog，再推 tag 触发发布；workflow 行为与长期规则存在漂移。

## 2. 最终策略

默认采用“tag 驱动发布 + 手动触发只发布已有 tag”的收口策略。

长期职责划分：

- [ ] 本地或人工协作负责版本判断、版本文件同步、changelog 整理、长期发布文档更新和发布准备提交。
- [ ] Git tag 负责标记“这个 commit 就是发布版本”。
- [ ] GitHub Actions 负责从 tag 对应 commit 校验、构建、签名、生成 release notes、发布 GitHub Release、上传 updater 产物和同步 R2。
- [ ] GitHub Actions 不再修改仓库文件。
- [ ] GitHub Actions 不再创建代码提交。
- [ ] GitHub Actions 不再配置 commit author。
- [ ] GitHub Actions 不再推送 `HEAD` 到分支。

保留手动触发入口，但改变语义：

- [ ] `workflow_dispatch` 输入版本后，只允许发布已经存在的 `vX.Y.Z` tag。
- [ ] 如果对应 tag 不存在，workflow 直接失败，并提示先在本地完成发布准备提交并推送 tag。
- [ ] 如果 tag 已存在，workflow checkout 到该 tag 对应 commit，再执行后续发布步骤。

这样可以保留 GitHub UI 重新发布或补跑发布流程的能力，同时避免 Actions 生成 commit。

## 3. 成功标准

- [ ] `.github/workflows/prepare-release.yml` 中不再出现 `git config user.name`。
- [ ] `.github/workflows/prepare-release.yml` 中不再出现 `git config user.email`。
- [ ] `.github/workflows/prepare-release.yml` 中不再出现 `git commit`。
- [ ] `.github/workflows/prepare-release.yml` 中不再出现 `git push origin HEAD`。
- [ ] `.github/workflows/prepare-release.yml` 中不再在发布流程里执行 `sync-version`。
- [ ] workflow 不会生成新的代码提交。
- [ ] workflow 对不存在的手动输入 tag 明确失败。
- [ ] workflow 对已有 tag 可以 checkout 到 tag 对应 commit 并发布。
- [ ] workflow 发布前会校验版本文件、changelog、长期版本文档与 tag 版本一致。
- [ ] `scripts/release.ts` 提供可复用的版本文件一致性校验命令。
- [ ] `tests/releasePolicy.test.ts` 覆盖版本文件一致性校验的核心逻辑。
- [ ] `docs/versioning-and-release-policy.md` 同步更新为新的长期流程。
- [ ] `CHANGELOG.md` 记录本次发布流程收口，但不写成用户功能。
- [ ] 本执行方案完成后归档。

## 4. 非目标

- [ ] 不改变安装包命名规则。
- [ ] 不改变 GitHub Release 标题规则。
- [ ] 不改变 R2 作为备用 updater 镜像的策略。
- [ ] 不改变 Tauri updater 签名方式。
- [ ] 不改产品 UI。
- [ ] 不关闭 GitHub Release 自动发布。
- [ ] 不引入第三方 release action 替代现有 `softprops/action-gh-release`，除非验证发现现有 action 无法满足要求。
- [ ] 不通过 issue-closing keywords 关闭任何 GitHub issue。
- [ ] 不在本轮执行真实发布、推送 tag 或强推 tag。

## 5. 决策记录

### 5.1 采用严格 tag 发布

- [ ] 正式发布以 `vX.Y.Z` tag 为边界。
- [ ] tag 指向的 commit 必须已经包含对应版本文件和 changelog。
- [ ] workflow 只读 tag 对应代码，不写回仓库。

理由：

- tag 是已发布版本的不可变边界。
- contributors 只受 commit author 影响；workflow 不提交就不会让 Actions 成为代码贡献者。
- 版本文件和 changelog 应由发布准备 commit 承担审查责任。

### 5.2 手动触发只允许已有 tag

- [ ] 保留 `workflow_dispatch`。
- [ ] 手动输入版本时检查远端是否存在 `refs/tags/v<version>`。
- [ ] 不存在则失败。
- [ ] 存在则 checkout tag 后发布。

理由：

- 保留 GitHub UI 补跑能力。
- 避免手动输入版本时让 workflow 自动改变仓库历史。
- 避免“点按钮发布”绕过本地发布准备和版本文件校验。

### 5.3 不采用 Actions 自动创建 tag

本轮默认不让 Actions 创建 tag。

原因：

- 创建 tag 虽然通常不会污染 contributors，但仍属于改变远端 Git 状态。
- 当前仓库发布规范已经要求“只有用户明确进入发布动作时才推 tag”。
- 本轮目标是先把发布边界收紧，而不是继续扩大 workflow 权限。

如未来确实想恢复“手动按钮创建 tag”，应单独写方案，并至少满足：

- [ ] workflow 仍不 commit。
- [ ] workflow 只给当前已验证 commit 创建 tag。
- [ ] workflow 明确校验版本文件一致。
- [ ] workflow 日志清楚说明 tag 指向哪个 commit。
- [ ] 长期发布规范同步说明该路径。

## 6. Owner 与落点

### 6.1 GitHub Actions owner

涉及文件：

- `.github/workflows/prepare-release.yml`

职责：

- 解析 release version。
- 对手动触发校验 tag 是否存在。
- checkout 到 release tag。
- 安装依赖。
- 校验版本文件一致。
- 校验 changelog。
- 生成 release notes。
- 执行发布质量门槛。
- 构建和签名安装包。
- 生成 GitHub 版 `latest.json`。
- 发布 GitHub Release。
- 同步 R2 备用 updater 镜像。

不再负责：

- 修改版本文件。
- 修改 changelog。
- 创建 release commit。
- 推送 `HEAD` 到 `main`。
- 配置提交作者。

### 6.2 发布脚本 owner

涉及文件：

- `scripts/release.ts`

职责：

- 继续提供 `sync-version`，供本地发布准备使用。
- 继续校验 changelog。
- 继续生成 release notes。
- 继续生成 updater `latest.json`。
- 新增版本文件一致性校验命令，供本地和 CI 共用。

### 6.3 Release policy 测试 owner

涉及文件：

- `tests/releasePolicy.test.ts`

职责：

- 覆盖新增版本一致性校验的纯函数逻辑。
- 防止以后 workflow 又只能校验 changelog 而漏掉版本文件。

### 6.4 长期发布规范 owner

涉及文件：

- `docs/versioning-and-release-policy.md`

职责：

- 明确发布准备由本地提交完成。
- 明确 workflow 不再生成 commit。
- 明确手动触发只发布已有 tag。
- 明确准备提交与正式 tag 发布的区别。

### 6.5 Changelog owner

涉及文件：

- `CHANGELOG.md`

职责：

- 在 `Unreleased` 的 `Internal` 记录发布 workflow 收口。
- 不把这次内部发布流程调整写成用户功能。

## 7. 实现切片 A：新增版本文件一致性校验

目标：

- 发布前明确验证 tag 版本与仓库版本文件一致。
- 避免 workflow 不再 `sync-version` 后，用 `v1.6.1` tag 构建出 `1.6.0` 包。

### 7.1 设计校验范围

校验目标版本来自：

- [ ] `workflow_dispatch` 输入版本。
- [ ] tag push 的 `github.ref_name` 去掉 `v` 前缀。
- [ ] 本地命令参数。

必须校验下列文件：

- [ ] `package.json` 的 `version`。
- [ ] `package-lock.json` 顶层 `version`。
- [ ] `package-lock.json` 的 `packages[""].version`。
- [ ] `src-tauri/tauri.conf.json` 的 `version`。
- [ ] `src-tauri/tauri.dev.conf.json` 的 `version`。
- [ ] `src-tauri/tauri.local.conf.json` 的 `version`。
- [ ] `src-tauri/Cargo.toml` 中 `[package].version`。
- [ ] `src-tauri/Cargo.lock` 中根包 `patina` 的 `version`，如果该条目存在。
- [ ] `docs/versioning-and-release-policy.md` 第 3 节当前代码版本。
- [ ] `CHANGELOG.md` 中存在 `## [<version>] - YYYY-MM-DD` 正式版本节。

注意：

- changelog 的 `Release:` 和 `App note:` 仍由现有 `validate-changelog` 负责。
- 新校验只负责“版本号一致”和“版本节存在”。

### 7.2 调整 `scripts/release.ts`

新增或拆分纯函数：

- [ ] `readPackageLockVersions(content)`：返回顶层版本和 root package 版本。
- [ ] `readTauriConfigVersion(content)`：返回 Tauri 配置版本。
- [ ] `readCargoTomlPackageVersion(content)`：返回 `[package].version`。
- [ ] `readCargoLockRootPackageVersion(content, packageName)`：返回 root package 版本；如果 lock 中没有 root package 条目，返回 `null`。
- [ ] `validateReleaseVersionFilesText(snapshot, version)`：返回错误数组，不直接退出。
- [ ] `validateReleaseVersionFiles(version)`：读取真实文件，错误时 `fail(...)`。

建议错误文案包含具体文件：

```text
release: package.json version is 1.6.0, expected 1.6.1
release: src-tauri/tauri.conf.json version is 1.6.0, expected 1.6.1
release: CHANGELOG.md is missing "## [1.6.1] - YYYY-MM-DD"
```

新增 CLI 命令：

```text
node --experimental-strip-types scripts/release.ts validate-version-files <version>
```

更新 `help()`：

- [ ] 加入 `validate-version-files <version>`。
- [ ] 保留 `sync-version <version>`，供本地准备使用。

更新 `main()`：

- [ ] 增加 `case "validate-version-files"`。
- [ ] 在命令中调用 `validateReleaseVersionFiles(args[0])`。

### 7.3 更新 package scripts

涉及文件：

- `package.json`

新增脚本：

```json
"release:validate-version-files": "node --experimental-strip-types scripts/release.ts validate-version-files"
```

可选调整：

- [ ] `release:check` 继续保留 `npm run check:full && npm run release:validate-changelog`。
- [ ] 本轮不强行把 `release:check` 改成必须带版本参数，避免破坏现有本地习惯。
- [ ] workflow 中直接调用 `scripts/release.ts validate-version-files <version>`，确保 CI 总是使用 tag 版本。

如果决定增强 `release:check`：

- [ ] 先确认当前 npm 参数传递方式。
- [ ] 避免导致 `npm run release:check -- 1.6.1` 无法正确传给两个子命令。
- [ ] 必要时另开一个专用脚本，例如 `release:check-version`。

## 8. 实现切片 B：补充 release policy 测试

目标：

- 给版本一致性校验留自动化保护。
- 防止以后新增版本文件时忘记校验。

涉及文件：

- `tests/releasePolicy.test.ts`

步骤：

- [ ] 从 `scripts/release.ts` 导出新增纯函数。
- [ ] 构造一个版本一致的 `snapshot` fixture。
- [ ] 测试所有版本一致时返回空错误数组。
- [ ] 测试 `package.json` 版本不一致时返回文件级错误。
- [ ] 测试 `package-lock.json` root package 版本不一致时返回文件级错误。
- [ ] 测试 `tauri.conf.json` 版本不一致时返回文件级错误。
- [ ] 测试 `tauri.dev.conf.json` 版本不一致时返回文件级错误。
- [ ] 测试 `tauri.local.conf.json` 版本不一致时返回文件级错误。
- [ ] 测试 `Cargo.toml` 版本不一致时返回文件级错误。
- [ ] 测试 `Cargo.lock` root package 版本不一致时返回文件级错误。
- [ ] 测试 version policy 当前代码版本不一致时返回现有错误。
- [ ] 测试 changelog 缺少目标版本节时返回错误。

运行：

```powershell
npm run test:release
```

验收：

- [ ] `test:release` 通过。
- [ ] 测试输出数量更新，例如 `Passed 8 release policy tests` 或更高。

## 9. 实现切片 C：收口 workflow 触发与 checkout

目标：

- tag push 正常发布。
- 手动触发只从已有 tag 发布。
- workflow 不再创建 commit 或 tag。

涉及文件：

- `.github/workflows/prepare-release.yml`

### 9.1 保留触发配置

保留：

```yaml
on:
  workflow_dispatch:
    inputs:
      version:
        description: "Version to release, for example 1.6.1"
        required: true
        type: string
  push:
    tags:
      - "v[0-9]*.[0-9]*.[0-9]*"
      - "v[0-9]*.[0-9]*.[0-9]*-*"
```

调整：

- [ ] 将示例版本从旧 `0.1.1` 改成当前稳定线示例，例如 `1.6.1`。
- [ ] 不新增 branch push 触发。
- [ ] 不新增 pull_request 发布触发。

### 9.2 Resolve release version

保留现有 SemVer 解析，但新增输出：

- [ ] `version=<version>`。
- [ ] `tag=v<version>`。

确保：

- [ ] tag push 时必须从 `github.ref_name` 解析版本。
- [ ] 手动触发时必须校验输入版本是合法 SemVer。
- [ ] 预发布版本仍支持 `1.6.1-rc.1`。

### 9.3 替换 `Check tag`

当前 `Check tag` 用于决定是否创建 tag。需要改成“确认发布 tag”。

新逻辑：

- [ ] 如果是 `workflow_dispatch`：
  - [ ] 执行 `git ls-remote --exit-code --tags origin "refs/tags/v$version"`。
  - [ ] 不存在时 `throw "Tag v$version does not exist. Prepare the release commit and push the tag first."`
  - [ ] 存在时写日志：`Tag v$version exists. The workflow will publish from that tag.`
- [ ] 如果是 `push`：
  - [ ] 不需要检查远端 tag 是否存在，因为触发事件本身就是 tag push。
  - [ ] 可以写日志：`Release was triggered by pushed tag v$version.`

不要再写：

- [ ] `TAG_EXISTS=true`
- [ ] `TAG_EXISTS=false`

除非后续还有纯日志用途。新的流程不应再分支到“创建 tag”路径。

### 9.4 Checkout release tag

新增或调整步骤：

- [ ] 对 `workflow_dispatch` 执行 checkout tag：

```powershell
git fetch --force origin "refs/tags/v${{ steps.release.outputs.version }}:refs/tags/v${{ steps.release.outputs.version }}"
git checkout "v${{ steps.release.outputs.version }}"
```

- [ ] 对 `push` tag 触发，`actions/checkout` 默认已经 checkout 到事件 ref；可增加验证步骤而不是再次 checkout。

建议新增统一验证步骤：

```powershell
$version = "${{ steps.release.outputs.version }}"
$tag = "v$version"
$tagCommit = git rev-list -n 1 $tag
$headCommit = git rev-parse HEAD
if ($tagCommit -ne $headCommit) {
  throw "HEAD ($headCommit) does not match $tag ($tagCommit)."
}
Write-Host "Publishing $tag from $headCommit"
```

注意：

- [ ] 如果 tag 是 annotated tag，`git rev-list -n 1` 可解析到 tag 指向的 commit。
- [ ] 使用 `git rev-parse HEAD` 验证当前 checkout。

## 10. 实现切片 D：删除 Actions 写仓库路径

目标：

- workflow 不再修改或提交仓库代码。

涉及文件：

- `.github/workflows/prepare-release.yml`

删除步骤：

- [ ] 删除 `Sync version files` 步骤。
- [ ] 删除 `Commit version changes and tag` 步骤。

确认删除以下命令：

- [ ] `node --experimental-strip-types scripts/release.ts sync-version ...`
- [ ] `git config user.name ...`
- [ ] `git config user.email ...`
- [ ] `git add ...`
- [ ] `git diff --cached --quiet`
- [ ] `git commit -m ...`
- [ ] `git tag "v$version"`
- [ ] `git push origin HEAD:${{ github.ref_name }}`
- [ ] `git push origin "v$version"`

保留：

- [ ] `permissions: contents: write`，因为发布 GitHub Release 和上传 assets 仍需要 contents write。
- [ ] `actions/checkout` 的 `fetch-depth: 0`，因为需要读取 tag 和 release history。

## 11. 实现切片 E：加入发布前校验步骤

目标：

- 从 tag 对应 commit 读取并校验所有版本文件。

在 `Install dependencies` 之后加入：

```yaml
- name: Validate version files
  run: node --experimental-strip-types scripts/release.ts validate-version-files ${{ steps.release.outputs.version }}
```

调整现有校验顺序为：

- [ ] `Install dependencies`
- [ ] `Validate version files`
- [ ] `Validate changelog`
- [ ] `Verify release notes generation`
- [ ] `Run release quality gate`

`Run release quality gate` 调整：

- [ ] 移除 `if: env.TAG_EXISTS != 'true' || github.event_name == 'push'`。
- [ ] 改为每次发布都执行 `npm run check:full`。

原因：

- 既然 workflow 已经只从发布 tag 构建，就每次发布都应跑完整质量门槛。
- 手动补跑 release 也应验证 tag 对应代码仍能通过发布质量门槛。

## 12. 实现切片 F：确认构建和发布资产步骤不依赖旧变量

涉及文件：

- `.github/workflows/prepare-release.yml`

检查以下步骤仍然使用 `steps.release.outputs.version`：

- [ ] `Ensure updater signing key exists`
- [ ] `Build Tauri bundle`
- [ ] `Prepare release assets`
- [ ] `Publish GitHub Release`
- [ ] `Generate R2 updater manifest`
- [ ] `Upload R2 updater mirror`
- [ ] `Clean old R2 updater mirrors`

确保：

- [ ] 删除 `TAG_EXISTS` 后没有残留引用。
- [ ] `dist-release/release-notes.md` 仍在 build 前生成。
- [ ] `dist-release/latest.json` 仍由 `release:prepare-assets` 生成。
- [ ] GitHub Release 的 tag name 仍是 `v${{ steps.release.outputs.version }}`。
- [ ] GitHub Release 标题仍是 `Patina v${{ steps.release.outputs.version }}`。
- [ ] 预发布判断仍是 `contains(steps.release.outputs.version, '-')`。

## 13. 实现切片 G：更新长期发布规范

涉及文件：

- `docs/versioning-and-release-policy.md`

需要更新的位置：

### 13.1 第 3 节当前仓库现实

调整手动触发表述：

- [ ] 从“必要时也可手动触发该工作流”改成“必要时可手动触发已有 tag 的发布流程”。
- [ ] 明确手动触发不会同步版本文件、不会创建提交、不会创建 tag。

### 13.2 第 10 节发布前最低验证门槛

补充：

- [ ] workflow 会执行 `validate-version-files`。
- [ ] 本地准备发布时应先运行 `release:sync-version` 或手动同步版本文件，再运行 `release:validate-changelog`。

### 13.3 第 11 节默认发布流程

调整流程：

- [ ] 本地同步版本文件。
- [ ] 本地整理 changelog。
- [ ] 本地运行发布验证。
- [ ] 提交准备发布改动，提交信息推荐 `chore: prepare vX.Y.Z release`。
- [ ] 推送准备提交到 `origin/main`。
- [ ] 用户明确发布时，本地创建并推送 `vX.Y.Z` tag。
- [ ] tag push 触发 workflow。
- [ ] workflow 只校验、构建、发布，不提交。
- [ ] 手动触发只用于已有 tag 的补跑或重发 release assets。

### 13.4 第 13 节默认约束

补充：

- [ ] GitHub Actions 不应生成 release commit。
- [ ] GitHub Actions 不应配置 commit author。
- [ ] GitHub Actions 不应推送 `HEAD` 到分支。
- [ ] workflow_dispatch 不应绕过已有 tag 边界。

## 14. 实现切片 H：更新 changelog

涉及文件：

- `CHANGELOG.md`

在 `Unreleased` 的 `Internal` 下加入一条：

```md
- 收口 GitHub Actions 发布 workflow：版本文件和 changelog 由发布准备提交承担，Actions 只从已有 tag 校验、构建和发布，避免自动生成 release commit。
```

注意：

- [ ] 如果 `Internal` 当前只有 `暂无。`，先删除 `暂无。`。
- [ ] 不把这条写入 `Fixed`，除非已有公开发布造成用户可感知问题。
- [ ] 不使用 `Closes`、`Fixes`、`Resolves`。
- [ ] 不暴露具体个人邮箱。

## 15. 静态检查清单

改完后执行搜索：

```powershell
rg -n "git config user|git commit|git push origin HEAD|sync-version|TAG_EXISTS" .github/workflows/prepare-release.yml
```

预期：

- [ ] 不出现 `git config user`。
- [ ] 不出现 `git commit`。
- [ ] 不出现 `git push origin HEAD`。
- [ ] 不出现发布 workflow 中的 `sync-version`。
- [ ] 不出现 `TAG_EXISTS`。

允许：

- [ ] `git push origin "v$version"` 不应出现，因为本轮不让 Actions 创建 tag。
- [ ] `sync-version` 可以继续出现在 `scripts/release.ts`、`package.json`、长期文档或历史 archive 文档中。

检查 workflow 权限：

- [ ] `permissions: contents: write` 仍存在。
- [ ] 不新增无关权限。
- [ ] 不新增 PAT secret。
- [ ] 不新增个人 token。

检查 workflow 顺序：

- [ ] checkout 在最前。
- [ ] resolve version 在安装依赖前。
- [ ] workflow_dispatch 的 tag checkout 在安装依赖前完成。
- [ ] version files 校验在 changelog 校验前后均可，但必须在 build 前。
- [ ] `check:full` 在 Tauri build 前完成。
- [ ] R2 同步仍在 GitHub Release 发布后执行。

## 16. 本地验证计划

### 16.1 最小验证

适用于只完成脚本、测试、workflow、文档改动后：

```powershell
npm run test:release
```

```powershell
node --experimental-strip-types scripts/release.ts validate-version-files 1.6.0
```

```powershell
node --experimental-strip-types scripts/release.ts validate-changelog 1.6.0
```

验收：

- [ ] release policy tests 通过。
- [ ] 当前仓库版本文件对 `1.6.0` 校验通过。
- [ ] 当前 changelog 对 `1.6.0` 校验通过。

### 16.2 推荐验证

因为本轮改动触及发布链，推荐运行：

```powershell
npm run check
```

验收：

- [ ] 前端边界检查通过。
- [ ] 前端测试通过。
- [ ] UI smoke 通过。
- [ ] build 通过。
- [ ] bundle budget 通过。

### 16.3 完整验证

如果准备把这次 workflow 调整作为发布前改动一起推进，运行：

```powershell
npm run check:full
```

验收：

- [ ] `npm run check` 通过。
- [ ] Rust 边界检查通过。
- [ ] `cargo check` 通过。
- [ ] Rust tests 通过。
- [ ] clippy 通过。

### 16.4 workflow 静态验证

手动审查：

- [ ] YAML 缩进正确。
- [ ] PowerShell 变量引用正确。
- [ ] `${{ steps.release.outputs.version }}` 引用正确。
- [ ] `workflow_dispatch` tag 不存在时有清楚错误。
- [ ] `push` tag 路径不会误判为需要远端 tag 检查。
- [ ] `softprops/action-gh-release` 仍能获得 tag name、release name、body path 和 files。

## 17. 模拟场景验证

这些验证不要求全部在本地自动完成，但在合并前应逐项推演。

### 17.1 tag push 正常发布

前提：

- [ ] `main` 上已有准备提交。
- [ ] 准备提交中的版本文件都是 `1.6.1`。
- [ ] 准备提交中的 changelog 有 `## [1.6.1] - YYYY-MM-DD`。
- [ ] 推送 `v1.6.1` tag。

预期：

- [ ] workflow 从 tag 事件解析出 `1.6.1`。
- [ ] workflow 不执行 `sync-version`。
- [ ] workflow 不执行 `git commit`。
- [ ] workflow 校验版本文件通过。
- [ ] workflow 校验 changelog 通过。
- [ ] workflow 运行 `check:full`。
- [ ] workflow 构建安装包。
- [ ] workflow 发布 `Patina v1.6.1`。
- [ ] contributors 不新增 Actions 作者。

### 17.2 手动触发已有 tag

前提：

- [ ] 远端已有 `v1.6.1` tag。
- [ ] 手动触发 workflow，输入 `1.6.1`。

预期：

- [ ] workflow 检查到 tag 存在。
- [ ] workflow checkout 到 `v1.6.1`。
- [ ] workflow 校验 HEAD 与 tag commit 一致。
- [ ] workflow 不提交代码。
- [ ] workflow 重新构建并发布或更新同 tag 的 release assets。

### 17.3 手动触发不存在 tag

前提：

- [ ] 远端不存在 `v1.6.2` tag。
- [ ] 手动触发 workflow，输入 `1.6.2`。

预期：

- [ ] workflow 在 tag 校验阶段失败。
- [ ] 日志提示先准备 release commit 并推送 tag。
- [ ] workflow 不运行 `npm ci` 后续重步骤。
- [ ] workflow 不创建 tag。
- [ ] workflow 不创建 commit。

### 17.4 tag 版本与文件版本不一致

前提：

- [ ] `v1.6.2` tag 指向的 commit 中 `package.json` 仍是 `1.6.1`。

预期：

- [ ] workflow 解析 tag 版本为 `1.6.2`。
- [ ] `validate-version-files 1.6.2` 失败。
- [ ] 错误信息指出具体不一致文件。
- [ ] workflow 不构建安装包。
- [ ] workflow 不发布 GitHub Release。

### 17.5 changelog 缺少版本节

前提：

- [ ] `v1.6.2` tag 指向的 commit 中版本文件是 `1.6.2`。
- [ ] `CHANGELOG.md` 没有 `## [1.6.2] - YYYY-MM-DD`。

预期：

- [ ] `validate-version-files` 或 `validate-changelog` 失败。
- [ ] workflow 不构建安装包。
- [ ] workflow 不发布 GitHub Release。

## 18. 发布协作步骤

这部分描述以后真实发布时的人工流程。

### 18.1 准备发布提交

- [ ] 确认最近一个已发布版本。
- [ ] 查看完整范围：

```powershell
git log vX.Y.Z..HEAD
```

```powershell
git diff --stat vX.Y.Z..HEAD
```

- [ ] 判断目标版本号。
- [ ] 同步版本文件：

```powershell
npm run release:sync-version -- X.Y.Z
```

- [ ] 整理 `CHANGELOG.md`，把 `Unreleased` 变成 `## [X.Y.Z] - YYYY-MM-DD`。
- [ ] 更新 `docs/versioning-and-release-policy.md` 第 3 节当前代码版本，如果 `sync-version` 未自动处理则手动确认。
- [ ] 运行：

```powershell
npm run release:check
```

- [ ] 提交：

```text
chore: prepare vX.Y.Z release
```

- [ ] 推送到 `origin/main`。

### 18.2 执行正式发布

只有用户明确要求发布时执行：

- [ ] 创建 tag：

```powershell
git tag vX.Y.Z
```

- [ ] 推送 tag：

```powershell
git push origin vX.Y.Z
```

- [ ] 确认 `Publish Release` workflow 被 tag push 触发。
- [ ] 默认确认触发即可，不必等待完整构建，除非正在排查发布失败。

### 18.3 手动补跑发布

用于 release assets 上传失败、R2 同步失败或 GitHub Release 发布步骤需要重跑。

- [ ] 确认目标 tag 已存在。
- [ ] 打开 GitHub Actions。
- [ ] 选择 `Publish Release` workflow。
- [ ] 点击 `Run workflow`。
- [ ] 输入不带 `v` 的版本号，例如 `1.6.1`。
- [ ] 确认 workflow checkout 到既有 tag。
- [ ] 确认 workflow 不生成 commit。

## 19. 回滚方案

### 19.1 workflow 改动导致发布不能触发

- [ ] 不改已发布 tag。
- [ ] 修复 `.github/workflows/prepare-release.yml`。
- [ ] 提交修复到 `main`。
- [ ] 对已有 tag 使用手动触发补跑。
- [ ] 如果 GitHub Actions 只能使用默认分支上的 workflow 文件，确认修复已在默认分支生效后再补跑。

### 19.2 版本一致性校验误报

- [ ] 查看具体错误文件。
- [ ] 如果是脚本解析 bug，修复 `scripts/release.ts` 和测试。
- [ ] 如果是真实版本不一致，不改 tag，准备下一个版本或在尚未发布时按仓库规则处理。
- [ ] 不通过在 workflow 中恢复 `sync-version` 绕过校验。

### 19.3 GitHub Release 已发布但 R2 同步失败

- [ ] 保留 GitHub Release 主发布事实。
- [ ] 修复 R2 secrets、bucket 或 AWS CLI 步骤。
- [ ] 使用手动触发补跑已有 tag。
- [ ] 不创建新的 release commit。

### 19.4 需要紧急发布

- [ ] 不恢复 Actions 自动 commit。
- [ ] 本地准备 hotfix 版本提交。
- [ ] 推送 `vX.Y.Z+1` 或符合 SemVer 的下一个版本 tag。
- [ ] 让 workflow 从 tag 构建。

## 20. 完成记录

执行过程中逐项勾选：

- [x] 新增 `validate-version-files` 命令。
- [x] 新增版本一致性校验测试。
- [x] `npm run test:release` 通过。
- [x] workflow 删除 `Sync version files`。
- [x] workflow 删除 `Commit version changes and tag`。
- [x] workflow 删除硬编码 user name。
- [x] workflow 删除硬编码 user email。
- [x] workflow 删除 `git commit`。
- [x] workflow 删除 `git push origin HEAD`。
- [x] `workflow_dispatch` 改为只允许已有 tag。
- [x] workflow 增加 tag checkout / HEAD 验证。
- [x] workflow 增加 `Validate version files`。
- [x] workflow 每次发布都运行 `npm run check:full`。
- [x] `docs/versioning-and-release-policy.md` 已回写长期规则。
- [x] `CHANGELOG.md` 已记录内部发布流程收口。
- [x] 静态搜索确认 workflow 不再写提交。
- [x] 最小验证通过。
- [x] 推荐验证通过。
- [x] 本执行方案归档。

## 21. 暂停条件

出现以下情况时暂停，不继续硬改：

- [ ] 发现 GitHub Actions 对 `workflow_dispatch` 无法可靠 checkout tag。
- [ ] 发现 `softprops/action-gh-release` 对已有 release 的补跑行为不符合预期。
- [ ] 版本一致性校验需要重写大量 release 脚本，超出本轮边界。
- [ ] 工作流需要新增个人 token 或 PAT 才能满足需求。
- [ ] 用户决定仍希望 Actions 创建 tag。
- [ ] 用户决定保留 Actions 自动提交版本文件。

暂停后的默认处理：

- [ ] 保留现有 workflow，不做半截发布链改动。
- [ ] 记录阻塞原因。
- [ ] 回到方案讨论，不把临时判断写进长期发布规范。
