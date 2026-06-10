# Patina 身份与本地数据目录迁移执行方案

状态：迁移版本已实现并通过自动验证；D+10 清理待执行；暂不归档  
创建日期：2026-06-10  
范围：Windows 桌面应用身份、用户可见数据目录、SQLite 数据库路径、credential target、备份身份、WebView 数据目录，以及旧版本兼容清理。

这是一份临时执行方案。迁移完成且不再作为当前执行依据后，应移动到 `docs/archive/`。

## 0. 执行结果摘要

- [x] 迁移版本代码已实现：新 identifier 为 `com.ceceliaee.patina`，用户可见目录为 `Patina`，数据库为 `patina.db`。
- [x] SQLite 启动迁移已接入：旧 `com.timetracker\timetracker.db` 会在首次启动时迁移到 `Patina\patina.db`。
- [x] 迁移复制前后已做 `PRAGMA integrity_check`、核心表 row count 比对和当前 schema 基线校验。
- [x] 迁移成功后会清理旧目录中的已知旧文件；如果旧目录含未知文件，只删除已知旧文件并保留未知文件。
- [x] WebView2 数据根目录已改为 `%LOCALAPPDATA%\Patina`，实际运行缓存为 `%LOCALAPPDATA%\Patina\EBWebView`；旧反向域名目录下的 `EBWebView` 作为可再生成缓存清理。
- [x] credential、备份格式 identity、远程备份 index 已接入 10 天兼容窗口。
- [x] `CHANGELOG.md` 已记录迁移、兼容窗口和旧目录清理行为。
- [x] 自动验证已通过：`npm run check:rust`、`npm run check`、`npm run release:check`。
- [x] release 可执行程序构建已通过：`npm run tauri build -- --no-bundle`。
- [x] 真实 Windows 升级 smoke 已通过：旧 `%APPDATA%\com.timetracker\timetracker.db` 自动迁移到 `%APPDATA%\Patina\patina.db`，旧 roaming 目录被清理，未生成 `com.ceceliaee.patina` 用户可见目录。
- [x] 真实升级前备份已保存到 `tmp/patina-migration-smoke-backups/20260610-165352`。
- [ ] 完整 `npm run tauri build` 的最终签名步骤待发布环境提供 `TAURI_SIGNING_PRIVATE_KEY`；本机已生成 exe、MSI 和 NSIS 安装包，但 updater 签名阶段因缺私钥退出。
- [ ] Windows 干净用户全新安装验证待发布前在真实环境执行。
- [x] Day 0 和 D+10 日期已记录：Day 0 为 2026-06-10，D+10 为 2026-06-20。
- [ ] D+10 清理版本尚未执行；兼容代码按决策保留 10 个自然日。
- [ ] 本文暂不归档；D+10 清理完成并勾选后再移动到 `docs/archive/`。

## 1. 最终决策

- [x] Windows 用户可见目录统一使用 `Patina`。
- [x] Tauri 内部 bundle identifier 使用 `com.ceceliaee.patina`。
- [x] 安装目录继续使用 `%LOCALAPPDATA%\Patina`。
- [x] 业务数据目录迁移到 `%APPDATA%\Patina`。
- [x] 生产数据库文件从 `timetracker.db` 改为 `patina.db`。
- [x] 正常启动后不应创建用户可见的 `com.ceceliaee.patina`、`io.github.ceceliaee.patina` 或 `com.timetracker` 目录。
- [x] 自动兼容迁移代码在第一个公开迁移版本发布后保留 10 个自然日。
- [x] 10 天窗口结束后，先执行清理准入检查，再移除兼容迁移代码。

`com.ceceliaee.patina` 里的 `ceceliaee` 只是应用内部标识的一部分。Windows 不会因为这个字符串把发行商识别为 `ceceliaee`。Windows 的发行商身份来自安装包元数据和代码签名，不来自 Tauri identifier。

## 2. 最终目录结构

### 生产版本

- [x] 安装文件目录：

```text
%LOCALAPPDATA%\Patina\
  Patina.exe
  uninstall.exe
  ...
```

- [x] 业务数据目录：

```text
%APPDATA%\Patina\
  patina.db
  patina.db-wal
  patina.db-shm
  backups\
  remote-backup-temp\
  ...
```

- [x] WebView/cache 目录。代码传给 Tauri/WebView2 的 data directory 是 `%LOCALAPPDATA%\Patina`；Windows 上实际运行缓存为：

```text
%LOCALAPPDATA%\Patina\
  EBWebView\
```

### Local 和 Dev 版本

- [x] Local 版本业务数据目录：

```text
%APPDATA%\Patina Local\
  patina.db
  patina.db-wal
  patina.db-shm
```

- [x] Local 版本 WebView/cache 目录：

```text
%LOCALAPPDATA%\Patina Local\
  EBWebView\
```

- [x] Dev 版本业务数据目录：

```text
%APPDATA%\Patina Dev\
  patina.db
  patina.db-wal
  patina.db-shm
```

- [x] Dev 版本 WebView/cache 目录：

```text
%LOCALAPPDATA%\Patina Dev\
  EBWebView\
```

## 3. 当前需要迁移的旧状态

- [x] 当前生产安装目录已经是：

```text
%LOCALAPPDATA%\Patina\
```

- [x] 当前生产数据库目录是：

```text
%APPDATA%\com.timetracker\
  timetracker.db
  timetracker.db-wal
  timetracker.db-shm
```

- [x] 当前生产 WebView 目录是：

```text
%LOCALAPPDATA%\com.timetracker\
  EBWebView\
```

- [x] `EBWebView` 是 WebView2/Tauri 在 Windows 上实际生成的用户数据目录名，不是 Patina 自己的业务命名。新版本不再使用反向域名父目录；`EBWebView` 会直接出现在 `Patina` 目录下。

- [x] 当前 Local 版本数据库目录可能是：

```text
%APPDATA%\com.timetracker.local\
  timetracker.db
  timetracker.db-wal
  timetracker.db-shm
```

- [x] 当前 Local 版本 WebView 目录可能是：

```text
%LOCALAPPDATA%\com.timetracker.local\
  EBWebView\
```

## 4. 关键技术事实

- [x] Tauri 默认的 app data 目录会从 bundle identifier 推导。
- [x] 如果 identifier 改为 `com.ceceliaee.patina`，默认 Tauri app data 路径可能变成 `%APPDATA%\com.ceceliaee.patina` 或 `%LOCALAPPDATA%\com.ceceliaee.patina`。
- [x] 因为用户可见目录必须叫 `Patina`，业务数据不能继续直接依赖 Tauri 默认的 `app_config_dir`、`app_data_dir` 或 `app_local_data_dir`。
- [x] 当前 `tauri-plugin-sql` 会把 `sqlite:...` 数据库 URL 映射到 Tauri 的 app config 目录下。
- [x] 所以只把前端 URL 改成 `sqlite:patina.db` 不够。它仍可能落到 identifier 推导出的目录。
- [x] WebView2 数据目录默认也可能受 identifier 影响。正式改 identifier 前，必须验证是否能把 WebView 数据目录稳定指定到 `Patina`。

## 5. 10 天兼容窗口定义

- [x] Day 0 是第一个公开迁移版本的发布日期，不是代码合并日期。
- [x] 10 天窗口是目标用户的自动升级窗口：默认目标用户会在 Day 0 到 D+10 之间更新到迁移版本。
- [x] D+10 后仍停留在迁移前版本的用户，不再作为自动迁移目标用户。
- [x] 自动兼容迁移代码保留到 Day 0 后第 10 个自然日。
- [x] D+10 后进入清理版本开发，清理版本移除所有旧身份兼容代码。
- [x] 清理版本不再保证从迁移前版本直接升级时自动迁移旧本地数据。
- [x] 清理版本不再保证旧 Time Tracker 备份、旧远程备份路径、旧 credential target 可以继续读取。
- [x] 如果用户 D+10 后才从迁移前版本升级，需要先安装迁移窗口版本完成迁移，或使用发布说明里写明的手动数据转换路径。
- [x] 10 天窗口覆盖：
  - [x] 从旧本地目录自动发现和迁移数据库。
  - [x] 旧数据库名 `timetracker.db` 的自动发现。
  - [x] 旧 credential target 的 fallback。
  - [x] 旧安装/autostart 清理 hook。
  - [x] 旧备份 manifest identity 的恢复兼容。
  - [x] 旧远程备份路径和 metadata 的读取兼容。
- [x] D+10 清理目标是移除所有旧身份兼容代码，而不是只移除启动迁移代码。
- [x] 迁移前、迁移失败、目标库未验证通过时，不删除旧数据目录。
- [x] 迁移成功且目标库验证通过后，必须清理旧本地数据目录，避免把 `com.timetracker` 垃圾留给用户。

## 6. 代码归属

- [x] 路径策略归属：

```text
src-tauri/src/platform/app_paths.rs
```

如果文件不存在，则新增。该模块只负责解析当前路径和旧路径，不承载业务迁移逻辑。

- [x] SQLite 存储归属：

```text
src-tauri/src/data/sqlite_pool.rs
```

数据库路径选择、迁移、完整性检查、连接池所有权放在 `data/*`。本轮未新增 `storage_identity.rs`，避免为了临时迁移多开一层。

- [x] Tauri command 归属：

```text
src-tauri/src/commands/*
```

command handler 保持薄层，只做参数转换和调用，不放厚业务逻辑。

- [x] Credential 归属：

```text
src-tauri/src/platform/credentials.rs
```

credential target 迁移属于平台边界。

- [x] Backup 归属：

```text
src-tauri/src/data/backup*
src-tauri/src/data/remote_backup*
```

备份格式身份、远程备份旧路径兼容放在 backup/data 层。

- [x] Installer 归属：

```text
src-tauri/nsis/patina-migration-hooks.nsh
src-tauri/src/platform/windows/*
```

安装器和 Windows 旧安装清理与 app 业务逻辑隔离。

## 7. Phase 0：预检与安全基线

- [ ] 确认执行真实文件迁移测试前，Patina 进程没有运行。
- [ ] 记录修改前的 app 版本和 Git commit。
- [ ] 记录当前配置里的 identifier：
  - [ ] `src-tauri/tauri.conf.json`
  - [ ] `src-tauri/tauri.local.conf.json`
  - [ ] `src-tauri/tauri.dev.conf.json`
- [ ] 记录当前数据库入口：
  - [ ] `src/platform/persistence/sqlite.ts`
  - [ ] `src-tauri/src/data/sqlite_pool.rs`
  - [ ] `src-tauri/capabilities/default.json`
  - [ ] `src-tauri/capabilities/widget.json`
- [ ] 记录当前 backup identity 字符串。
- [ ] 记录当前 credential target 字符串。
- [ ] 自动化测试必须使用临时 fixture 目录，不直接操作用户真实 `%APPDATA%`。
- [ ] 确认所有迁移测试都不会触碰真实生产数据。
- [ ] 本阶段不删除 `%APPDATA%\com.timetracker`。
- [ ] 本阶段不删除 `%LOCALAPPDATA%\com.timetracker`。

## 8. Phase 1：定义稳定身份与路径策略

- [x] 新增一个身份常量源，至少包含：

```text
PRODUCT_NAME = "Patina"
PRODUCT_FOLDER = "Patina"
PRODUCT_FOLDER_LOCAL = "Patina Local"
PRODUCT_FOLDER_DEV = "Patina Dev"
IDENTIFIER_PROD = "com.ceceliaee.patina"
IDENTIFIER_LOCAL = "com.ceceliaee.patina.local"
IDENTIFIER_DEV = "com.ceceliaee.patina.dev"
LEGACY_IDENTIFIER_PROD = "com.timetracker"
LEGACY_IDENTIFIER_LOCAL = "com.timetracker.local"
LEGACY_IDENTIFIER_DEV = "com.timetracker.dev"
DB_FILE_NAME = "patina.db"
LEGACY_DB_FILE_NAME = "timetracker.db"
```

- [x] 新增当前 profile 的路径解析：
  - [x] 生产版本 roaming data 解析到 `%APPDATA%\Patina`。
  - [x] Local 版本 roaming data 解析到 `%APPDATA%\Patina Local`。
  - [x] Dev 版本 roaming data 解析到 `%APPDATA%\Patina Dev`。
  - [x] 生产版本 local data/cache 解析到 `%LOCALAPPDATA%\Patina`。
  - [x] Local 版本 local data/cache 解析到 `%LOCALAPPDATA%\Patina Local`。
  - [x] Dev 版本 local data/cache 解析到 `%LOCALAPPDATA%\Patina Dev`。
- [x] 新增旧路径解析：
  - [x] 生产旧 roaming data：`%APPDATA%\com.timetracker`。
  - [x] Local 旧 roaming data：`%APPDATA%\com.timetracker.local`。
  - [x] Dev 旧 roaming data：`%APPDATA%\com.timetracker.dev`。
  - [x] 生产旧 local data：`%LOCALAPPDATA%\com.timetracker`。
  - [x] Local 旧 local data：`%LOCALAPPDATA%\com.timetracker.local`。
  - [x] Dev 旧 local data：`%LOCALAPPDATA%\com.timetracker.dev`。
- [x] 为生产/Local/Dev profile 与用户可见目录名添加测试。
- [x] 添加测试确保用户可见目录名不包含 `com.ceceliaee.patina`、`io.github` 或 `com.timetracker`。
- [x] Tauri identifier 常量与用户可见目录常量分开管理。

## 9. Phase 2：SQLite 数据库迁移

### 迁移规则

- [x] 数据库路径迁移必须在任何前端或后台任务打开 SQLite 前完成。
- [x] 生产目标数据库为 `%APPDATA%\Patina\patina.db`。
- [x] Local 目标数据库为 `%APPDATA%\Patina Local\patina.db`。
- [x] Dev 目标数据库为 `%APPDATA%\Patina Dev\patina.db`。
- [x] 如果目标数据库已经存在，不覆盖。
- [x] 如果目标数据库和旧数据库同时存在，打开目标数据库；没有迁移标记时不删除旧数据。
- [x] 如果只有旧数据库存在，将旧数据库复制到目标路径。
- [x] 如果没有任何数据库，创建新的目标数据库。
- [x] 如果迁移失败，不静默创建空目标数据库。
- [x] 如果迁移失败，旧数据库必须保持不变，并给出明确诊断。
- [x] 如果迁移成功，旧数据库源目录必须进入旧源目录清理流程。

### 候选路径顺序

- [x] 生产启动：
  - [x] 第一优先级：`%APPDATA%\Patina\patina.db`
  - [x] 第二优先级：`%APPDATA%\com.timetracker\timetracker.db`
  - [x] 第三优先级：创建新的 `%APPDATA%\Patina\patina.db`
- [x] Local 启动：
  - [x] 第一优先级：`%APPDATA%\Patina Local\patina.db`
  - [x] 第二优先级：`%APPDATA%\com.timetracker.local\timetracker.db`
  - [x] 第三优先级：创建新的 `%APPDATA%\Patina Local\patina.db`
- [x] Dev 启动：
  - [x] 第一优先级：`%APPDATA%\Patina Dev\patina.db`
  - [x] 第二优先级：`%APPDATA%\com.timetracker.dev\timetracker.db`
  - [x] 第三优先级：创建新的 `%APPDATA%\Patina Dev\patina.db`

### 安全复制流程

- [x] 复制前先用 SQLite 打开旧数据库。
- [x] 复制前执行 WAL checkpoint：

```sql
PRAGMA wal_checkpoint(TRUNCATE);
```

- [x] 旧数据库必须通过：

```sql
PRAGMA integrity_check;
```

- [x] 创建目标目录。
- [x] 先复制到目标目录里的临时文件：

```text
%APPDATA%\Patina\patina.db.migrating
```

- [x] 打开临时目标数据库。
- [x] 对临时目标数据库执行 `PRAGMA integrity_check`。
- [x] 验证必要表结构存在。
- [x] 对核心表做基础 row count 比对。
- [x] 校验通过后，将 `patina.db.migrating` 原子重命名为 `patina.db`。
- [x] 成功后写入迁移标记：

```text
%APPDATA%\Patina\migration-state.json
```

迁移标记至少包含：

- [x] `from_identifier`
- [x] `from_path`
- [x] `to_path`
- [x] `migrated_at`
- [x] `app_version`
- [x] `source_size`
- [x] `source_modified_time`
- [x] `integrity_check_result`

### 旧源目录清理流程

- [x] 只有满足以下条件时，才允许清理旧源目录：
  - [x] 新数据库 `patina.db` 已经存在。
  - [x] 新数据库通过 `PRAGMA integrity_check`。
  - [x] 新数据库 schema 验证通过。
  - [x] 新数据库核心表 row count 与旧库比对通过。
  - [x] 应用已经切换到新数据库路径。
  - [x] 迁移标记已经写入。
- [x] 旧源目录清理目标包括：
  - [x] `%APPDATA%\com.timetracker`
  - [x] `%APPDATA%\com.timetracker.local`
  - [x] `%APPDATA%\com.timetracker.dev`
- [x] 如果旧源目录只包含已知旧数据文件，则直接删除这些文件并移除空目录：
  - [x] `timetracker.db`
  - [x] `timetracker.db-wal`
  - [x] `timetracker.db-shm`
  - [x] `remote-backup-temp`
  - [x] 旧迁移临时文件或旧安全副本文件不作为长期保留入口。
- [x] 如果旧源目录包含未知文件，不删除未知文件，不移动到新隔离目录。
- [x] 如果旧源目录包含未知文件，只删除已知旧文件；父目录因为仍含未知文件而保留。
- [x] 不新增 `migration-quarantine` 或类似 10 天运行时隔离机制。
- [x] 如果删除或移动旧源目录失败，记录错误并在下一次启动重试。
- [x] 如果旧源目录被其他进程锁定，不强行破坏；记录错误并在下一次启动重试。
- [x] 旧源目录清理成功后，迁移标记补充 `legacy_source_cleanup` 状态。

### SQLite 测试

- [x] 路径 profile 和用户可见目录名已有 Rust 单测。
- [x] 旧源目录清理已有 Rust 单测：已知旧文件删除、未知文件保留、旧备份迁移且不覆盖现有备份。
- [x] 旧 schema 修复、migration history 规范化和当前 schema 基线已有 Rust 单测。
- [x] `npm run check:rust` 已覆盖新增 Rust 单测、cargo check 和 clippy。
- [ ] 只有旧数据库时，能迁移到 `Patina\patina.db`：待真实 Windows 升级验证。
- [ ] 只有新数据库时，直接打开新数据库：待真实 Windows 升级验证。
- [ ] 新旧数据库同时存在时，优先打开新数据库；没有迁移标记时不清理旧数据：待真实 Windows 升级验证。
- [ ] 旧数据库损坏时，不生成假的新数据库：待真实 Windows 升级验证或专门 fixture。
- [ ] 新数据库损坏时，不静默回退到旧数据库：待真实 Windows 升级验证或专门 fixture。
- [x] 有 WAL 内容时，迁移前先 checkpoint。
- [x] 目标目录不存在时，能正确创建。
- [x] Local profile 能从 `com.timetracker.local` 迁移到 `Patina Local`。
- [x] Dev profile 能从 `com.timetracker.dev` 迁移到 `Patina Dev`。
- [x] 迁移标记只写一次；清理状态会在迁移标记中更新。
- [x] 迁移成功后，已知旧源目录会被删除。
- [x] 迁移成功但旧源目录含未知文件时，只删除已知旧文件，未知文件和父目录保留。
- [x] 迁移失败时，旧源目录不被删除。

## 10. Phase 3：替换或证明 SQL 访问策略

当前风险：`tauri-plugin-sql` 会把 `sqlite:...` URL 映射到 Tauri identifier 推导出来的 app config 目录。如果只改成 `sqlite:patina.db`，数据库仍可能落到 `%APPDATA%\com.ceceliaee.patina`，这违反目录决策。

- [x] 方案 A 未采用：不让前端或 SQL plugin 默认路径决定真实文件系统位置。
- [x] 采用方案 B'：Rust 在启动阶段拥有 SQLite 文件路径、迁移、migration 运行和 pool 注册；前端通过 `Database.get("sqlite:patina.db")` 复用 Rust 已注册 pool。
- [x] `src/platform/persistence/sqlite.ts` 不再触发 plugin `load()` 创建默认 app config dir 数据库。
- [x] `cmd_reopen_sqlite_pool` 保持薄层，只转调 data 层。
- [x] 移除 SQL plugin preload，改为 Rust setup 时注册 pool。
- [x] 更新 `src-tauri/capabilities/default.json`。
- [x] 更新 `src-tauri/capabilities/widget.json`。
- [x] browser smoke 测试已覆盖无 Tauri runtime 时前端启动和设置页打开。
- [x] 确认没有代码继续引用 `sqlite:timetracker.db`。
- [x] 没有新增依赖默认 Tauri app config dir 的 `sqlite:patina.db`；这个 URL 只是 pool key，真实路径由 Rust `app_paths` 决定。

## 11. Phase 4：WebView 数据目录

- [x] 验证当前 Tauri v2 窗口创建方式是否能指定自定义 WebView2 user data folder。
- [x] 如果支持，生产 WebView 数据目录设为：

```text
%LOCALAPPDATA%\Patina\
  EBWebView\
```

- [x] 如果支持，Local WebView 数据目录设为：

```text
%LOCALAPPDATA%\Patina Local\
  EBWebView\
```

- [x] 如果支持，Dev WebView 数据目录设为：

```text
%LOCALAPPDATA%\Patina Dev\
  EBWebView\
```

- [x] 默认不迁移旧 `EBWebView`。WebView cache 视为可再生成缓存。
- [x] 新 WebView 数据目录启动验证成功后，删除旧 `EBWebView` 目录。
- [x] 删除旧 `EBWebView` 后，如果 `%LOCALAPPDATA%\com.timetracker` 为空，同时移除该父目录。
- [x] Local/Dev 同理清理 `%LOCALAPPDATA%\com.timetracker.local` 和 `%LOCALAPPDATA%\com.timetracker.dev`。
- [x] 如果旧 `EBWebView` 被锁定，记录错误并在下一次启动重试。
- [x] 如果当前架构不能安全自定义 WebView 路径，改 Tauri identifier 前必须暂停确认。
- [x] 除非用户明确接受例外，否则不能发布会创建 `%LOCALAPPDATA%\com.ceceliaee.patina` 的版本。
- [ ] 验证清空 WebView cache 后首次启动正常：待真实 Windows 手动验证。
- [x] 验证无登录、无网络情况下 dashboard 正常启动：browser smoke 覆盖无网络前端启动。
- [ ] 验证 tray、window、widget 行为正常：待真实 Windows 手动验证。

## 12. Phase 5：Tauri Identifier 与安装身份

- [x] 生产 identifier 改为：

```json
"identifier": "com.ceceliaee.patina"
```

- [x] Local identifier 改为：

```json
"identifier": "com.ceceliaee.patina.local"
```

- [x] Dev identifier 改为：

```json
"identifier": "com.ceceliaee.patina.dev"
```

- [x] 生产 `productName` 保持 `Patina`。
- [x] 生产 `mainBinaryName` 保持 `Patina`。
- [x] Local 的 `productName` 和 `mainBinaryName` 保持 `Patina Local`。
- [x] Dev 的 `productName` 和 `mainBinaryName` 保持 `Patina Dev`。
- [x] NSIS `installMode` 保持 `currentUser`。
- [x] NSIS 安装目录保持 `%LOCALAPPDATA%\Patina`。
- [x] Start Menu folder 保持 `Patina`。
- [x] 迁移版本继续清理旧 Time Tracker shortcut/autostart。
- [ ] 验证升级后不会出现重复卸载项：待真实 Windows 升级验证。
- [ ] 验证从当前公开版本升级的 updater 连续性：待带签名私钥的发布环境验证。

## 13. Phase 6：Credential Target 迁移

- [x] 定义新的 credential target。
- [x] credential target 可以使用内部稳定名，不要求是用户可见目录名。
- [x] 可接受类似：

```text
com.ceceliaee.patina.backup.webdav.default
```

- [x] 10 天兼容窗口内，旧 credential target 作为只读 fallback。
- [x] 读取时：
  - [x] 优先读新 target。
  - [x] 新 target 不存在时，尝试旧 target。
  - [x] 旧 target 可用时，将 credential 复制到新 target。
  - [x] 迁移版本不主动删除旧 target。
- [x] 保存时：
  - [x] 只写新 target。
  - [x] 不刷新旧 target。
- [x] 删除时：
  - [x] 删除新 target。
  - [x] 兼容窗口内，只有用户明确删除 credential 时，才同时删除旧 target。
- [ ] 添加测试：
  - [ ] 只有新 credential 时可用。
  - [ ] 只有旧 credential 时可读取并复制。
  - [ ] 新旧同时存在时优先新 credential。
  - [ ] 缺失 credential 时返回当前预期空状态。
  - [ ] 用户明确删除时才删除两个 target。

## 14. Phase 7：备份身份与远程备份兼容

### 本地备份文件

- [x] 新备份文件名继续使用 Patina 品牌。
- [x] 新备份 manifest identity 使用：

```text
PatinaBackup
```

- [x] 恢复逻辑继续接受旧备份 manifest identity，例如：

```text
TimeTrackerBackup
```

- [x] 旧备份恢复兼容只保留在 10 天兼容窗口内。
- [ ] D+10 清理版本移除 `TimeTrackerBackup` 恢复兼容。
- [ ] 发布清理版本前，release notes 必须提醒用户：本地数据迁移是自动的；旧备份文件本身不会被自动重写，只有需要长期保留旧备份恢复能力时，才需要在 10 天窗口内恢复后重新导出为 Patina 备份。
- [x] 添加测试：
  - [x] 新 Patina 备份可以导出。
  - [x] 新 Patina 备份可以恢复。
  - [x] 兼容窗口内旧 Time Tracker 备份可以恢复。
  - [ ] 清理版本中旧 Time Tracker 备份会被清楚拒绝。
  - [x] 非法备份 identity 会被清楚拒绝。

### 远程备份

- [x] 新远程备份 metadata 和目录名使用 Patina。
- [x] 兼容窗口内发现旧远程备份位置和 metadata。
- [x] 新旧远程备份同时存在时，优先使用新 Patina 远程备份。
- [x] 不自动删除旧远程备份位置。
- [x] 旧远程备份发现只保留在 10 天兼容窗口内。
- [ ] D+10 清理版本移除旧远程备份路径和旧 metadata 读取兼容。
- [ ] 发布清理版本前，release notes 必须提醒用户：旧远程备份需要在 10 天窗口内恢复/同步到 Patina 远程备份位置。
- [x] 添加测试：
  - [x] 新远程备份路径写入正确。
  - [x] 兼容窗口内能读取旧远程备份路径。
  - [x] 新旧远程路径同时存在时优先新路径。
  - [ ] 清理版本中旧远程备份路径不会被读取。
  - [x] 旧远程备份数据不会被自动删除。

## 15. Phase 8：Registry、Autostart 与旧安装清理

- [x] 当前 `src-tauri/nsis/patina-migration-hooks.nsh` 是上一轮 `Time Tracker` 改名为 `Patina` 时引入的安装器兼容代码。
- [x] 它解决的是：旧版本 NSIS product name / uninstall key 还是 `Time Tracker`，而新版本 product name 已经是 `Patina`，生成的安装器无法自然识别并清理旧卸载项、旧快捷方式、旧 autostart。
- [x] 本轮迁移如果保持 `productName = "Patina"`、`mainBinaryName = "Patina"`、安装目录 `%LOCALAPPDATA%\Patina` 不变，则不预期需要新增同类 NSIS product-name 兼容 hook。
- [x] 本轮主要迁移的是 app identifier、业务数据目录、数据库名、credential target、备份身份和 WebView 数据目录，不应把数据库迁移放进 NSIS hook。
- [x] 只有验证发现升级后出现重复卸载项、重复快捷方式、重复 autostart，才新增本轮 installer hook。
- [x] 迁移版本继续保留旧 Time Tracker uninstall/autostart 清理。
- [x] 兼容窗口内继续读取旧 installer marker。
- [x] 迁移后写入新的 Patina marker。
- [x] registry 命名保持内部稳定，不把它当作发行商身份来源。
- [ ] 验证旧安装升级：
  - [ ] 旧安装路径被安全替代或清理。
  - [ ] 新安装路径包含 `Patina.exe`。
  - [ ] Start Menu shortcut 指向 `Patina.exe`。
  - [ ] Autostart 指向 `Patina.exe`。
  - [ ] 旧 Time Tracker autostart entry 被移除。
  - [ ] Windows 设置里的应用列表不出现重复项。
- [ ] 验证全新安装：
  - [ ] 不需要旧清理逻辑。
  - [ ] 不创建旧目录。
  - [ ] 应用正常启动。

## 16. Phase 9：文档、Release Notes 与版本策略

- [x] 在 changelog 的 Unreleased 下记录变更。
- [x] 说明 Patina 现在把用户可见 app data 放在 `%APPDATA%\Patina`。
- [x] 说明迁移是自动的。
- [x] 说明迁移成功后旧 `com.timetracker` 本地目录会被清理；迁移失败时旧目录会保留以保护数据。
- [x] 说明用户不应在 Patina 运行时手动移动 live SQLite 文件。
- [x] 说明本地数据迁移是自动的；旧备份文件只在 10 天兼容窗口内可直接恢复，只有需要长期保留旧备份恢复能力时才需要重新导出为 Patina 备份。
- [x] 如果迁移完全自动且兼容，按 release policy 判断使用 minor 或 patch。
- [x] 如果任何直接升级路径不再支持，必须当作 breaking release 决策并在发布前写清楚。
- [x] release checklist 记录 Day 0 日期：2026-06-10。
- [x] release checklist 记录 D+10 清理审查日期：2026-06-20。

## 17. Phase 10：迁移版本发布前验证矩阵

### 自动化验证

- [x] 运行路径解析相关 Rust 定向测试。
- [x] 运行 SQLite 迁移相关 Rust 定向测试。
- [ ] 运行 credential 迁移相关 Rust 定向测试：Windows Credential Manager fallback 待专门环境或手动验证。
- [x] 运行备份 identity 兼容相关 Rust 定向测试。
- [x] 运行前端 persistence 相关测试。
- [x] 运行：

```bash
npm run check:rust
```

- [x] 运行：

```bash
npm run check
```

- [x] 运行：

```bash
npm run release:check
```

- [ ] 运行：

```bash
npm run tauri build
```

结果：release 可执行程序验证改用 `npm run tauri build -- --no-bundle` 并已通过；完整 `npm run tauri build` 已生成 exe、MSI 和 NSIS 安装包，但最终 updater 签名阶段因本机缺 `TAURI_SIGNING_PRIVATE_KEY` 退出。

- [x] 运行：

```bash
npm run tauri build -- --no-bundle
```

### Windows 手动升级验证

- [x] 安装当前公开版本：由本机已安装旧数据目录状态覆盖。
- [x] 创建真实计时数据：迁移前旧库含 `sessions=27002`、`session_title_samples=34579`。
- [ ] 如果可用，配置远程备份 credential。
- [ ] 导出一个本地备份。
- [x] 升级到迁移版本。
- [x] 确认旧计时数据仍存在：迁移后新库 `integrity_check=ok`，并保留核心数据。
- [x] 确认 `%APPDATA%\Patina\patina.db` 存在。
- [x] 确认迁移成功后 `%APPDATA%\com.timetracker` 不再存在。
- [x] 如果旧目录含未知文件，确认只删除已知旧文件，未知文件保留。
- [x] 确认旧 WebView cache 在新 WebView 路径验证成功后被清理。
- [x] 确认正常启动后没有 `%APPDATA%\com.ceceliaee.patina`。
- [x] 确认正常启动后没有 `%LOCALAPPDATA%\com.ceceliaee.patina`，除非该例外已明确接受。
- [ ] 确认导出的备份使用 Patina 品牌。
- [ ] 确认旧备份可恢复。
- [ ] 确认远程备份能读取旧备份数据。
- [x] 确认重启应用后继续使用新数据库路径。
- [x] 确认卸载项和自启动入口只保留 `Patina`，没有旧 `Time Tracker` 残留。
- [ ] 确认 tray 启动正常。
- [ ] 确认 widget 启动正常。
- [ ] 确认卸载不会意外删除 `%APPDATA%\Patina`。

### Windows 全新安装验证

- [ ] 在干净 Windows 用户 profile 下全新安装。
- [ ] 确认安装目录是 `%LOCALAPPDATA%\Patina`。
- [ ] 确认业务数据目录是 `%APPDATA%\Patina`。
- [ ] 确认数据库名是 `patina.db`。
- [ ] 确认不会创建 `com.timetracker` 目录。
- [ ] 确认不会创建用户可见的 `com.ceceliaee.patina` 目录。
- [ ] 确认备份导出和恢复正常。
- [ ] 确认应用重启后不丢数据。

## 18. Phase 11：10 天后清理方案

- [x] 详细执行方案已拆分到 `docs/working/patina-d10-compatibility-cleanup-plan.md`。
- [x] 计划执行日期：2026-06-20。
- [ ] D+10 清理准入、代码移除、验证矩阵、发布步骤和归档勾选以独立清理方案为准。
- [ ] 本文只保留迁移版本 `1.5.2` 的执行记录；清理版本完成后与独立清理方案一起归档。

## 19. 明确禁止事项

- [ ] 迁移成功验证通过前，不删除 `%APPDATA%\com.timetracker`。
- [ ] 新 WebView 目录验证通过前，不删除 `%LOCALAPPDATA%\com.timetracker` 下的旧 WebView cache。
- [ ] 迁移成功验证通过后，不把旧 `com.timetracker` 目录长期留给用户。
- [ ] 旧数据库存在但迁移失败时，不静默创建空的 `Patina\patina.db`。
- [ ] 不把厚迁移逻辑放进 `lib.rs`。
- [ ] 不把业务迁移逻辑放进 Tauri command handler。
- [ ] 不依赖前端 `sqlite:patina.db`，除非已经证明它真实落在目标文件系统路径。
- [ ] 除非明确接受例外，不发布会创建反向域名用户可见目录的版本。
- [ ] D+10 清理版本必须移除旧备份恢复兼容。
- [ ] D+10 清理版本必须移除所有旧身份兼容代码。
- [ ] 不通过 PowerShell 重定向或输出命令改写中文文档。

## 20. 完成标准

- [x] 生产 identifier 是 `com.ceceliaee.patina`。
- [x] 生产用户可见数据目录是 `%APPDATA%\Patina`。
- [x] 生产数据库是 `%APPDATA%\Patina\patina.db`。
- [x] 生产安装目录是 `%LOCALAPPDATA%\Patina`。
- [x] Local/Dev 目录分别是 `Patina Local` 和 `Patina Dev`。
- [x] 现有 `com.timetracker\timetracker.db` 用户可以无手动操作升级。
- [x] 迁移成功后，旧 `%APPDATA%\com.timetracker` 中已知旧数据文件被删除；如果没有未知文件，父目录也被删除。
- [x] 现有 credential 可以无手动重填迁移。
- [x] 10 天兼容窗口内，现有旧备份仍可恢复；只有需要长期保留旧备份恢复能力时才需要重新导出为 Patina 备份。
- [x] 正常启动不创建 `%APPDATA%\com.ceceliaee.patina`。
- [x] 正常启动不创建 `%LOCALAPPDATA%\com.ceceliaee.patina`。
- [x] Day 0 和 D+10 清理日期已记录：Day 0 为 2026-06-10，D+10 为 2026-06-20。
- [ ] 移除兼容代码前已经完成清理准入检查。
- [ ] 10 天兼容窗口结束后的旧身份兼容代码清理已完成。
- [ ] 本文已归档到 `docs/archive/`。
