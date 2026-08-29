# ModLoader 更新日志

## V4.4.6 (2026-08-29)

### 配置预设 polish

- **滚动条**：预设列表 / 预览区沿用管理器 `ml-list-scroll` 样式（与商店同修法）
- **排序**：按 `savedAt` 新→旧；列表副文案为「启用 n  YYYY.MM.DD  HH:MM:SS」
- **结构**：纯逻辑并入 `libs/modConfigPresets.js`；`modloader/modPresets.js` 保留薄 re-export 供单测

### 文档清理（方案稿已落地，可从 git 历史回溯）

- **删除**（能力已进代码 / ADR / 常驻文档，无需再维护长方案稿）：
  - `docs/ModLoader_配置预设方案.md` → 见本 CHANGELOG + `libs/modConfigPresets.js` / `modloader/modPresets.js`
  - `docs/ModLoader_第5波拆分方案.md` → 见 `adr/0002-modloader-wave5-scan-install-seams.md`
  - `docs/ModLoader_技术债调查.md` → 已知取舍并入 `ModLoader_模块结构.md` §8
  - `docs/管理器在线更新plan.md` → 见 `tools/manager-release/README.md`、使用手册 §2.8、测试文档 Q
- **外链**：开发规范 / 使用手册 / 测试文档 / Skill / `pathRules` / updater 排除列表已改指上述常驻位置

## V4.4.5 (2026-08-29)

### 配置预设迁入 libs 扩展

- **迁出**：预设面板 UI / 接线从主文件改为 `libs/modConfigPresets.js`（存在即生效，删除即关闭）
- **一体 UI**：与 Mod 商店 / 管理器更新相同，填满 `#ml-log-panel`（`ml-presets-panel-root`），去掉壳套壳卡片与外层滚轮抖动
- **主文件**：仅保留薄 API（`t` / `getManagedModList` / `afterManagedPresetApplied` / `resolvePackageVersion` 等）；纯逻辑仍在 `modloader/modPresets.js`
- **扩展**：`registerLogEntry` 支持可选 `getLabel`，语言切换时菜单文案可刷新

## V4.4.4 (2026-08-29)

### 界面缩放（DOM）

- **新增**：设置卡「界面缩放」五档（70 / 85 / 100 / 115 / 130），写入 `ml_ui_scale`；主界面与安装页经 `.ml-scale-root` 缩放
- **配置**：`configCore` / `modloader_config.json` 默认 `ml_ui_scale: "100"`；清理遗留 `ml_ui_font`

### 配置预设（DOM + 设置日志壳）

- **新增**：`modloader/modPresets.js` — 预设目录读写、diff、应用到当前列表（不改 `mod_config` schema）
- **UI**：⚙ 设置 →「配置预设」走现有 `#ml-log-panel`（`registerLogEntry`），非顶栏独立遮罩
- **能力**：保存当前为预设、预览将开启/将关闭与版本提示、删除、应用并预览 / 应用并保存
- **存储**：`config/mod_presets/<name>.json`（一预设一文件）
- **文档**：`docs/ModLoader_配置预设方案.md`（发版 sync 排除）
- **测试**：`modPresets.test.js` 纳入 `run-all`

## V4.4.3 (2026-08-27)

### ModLoader 架构（`modloader/` 第 5 波）

- **新增**：`modloader/modCatalog.js` — Mod ID/loadPath、包版本与 CHANGELOG 判定、`mod_config` order 分配
- **新增**：`modloader/workshopBridge.js` — Steam 路径解析（自模块 2 迁出）、`_workshop` junction/逐文件桥接、`removePathSafe`
- **新增**：`modloader/scanPipeline.js` — 本地/工坊扫描与 merge；主文件 `scanAllMods` 改为薄壳编排
- **新增**：`modloader/installIo.js` — 安装复制 I/O（`copyFolderRecursive` / `copyFileToLocalMod`）；确认框与刷新仍留主文件
- **加深**：`paramValues` 新增 `normalizeNumberField` / `normalizeColorField` / `normalizeTextField`；参数编辑器 blur 与运行时/配置加载共用同一管道
- **测试**：新增 `modCatalog`、`workshopBridge`、`scanPipeline`、`installIo` 四套单测；`run-all.js` 现为 12 套 `*.test.js` + 语法检查
- **文档**：`ModLoader_第5波拆分方案.md`、`adr/0002-modloader-wave5-scan-install-seams.md`；`ModLoader_模块结构.md` / 技术债调查同步
- **发版排除**：`pathRules` / updater 内嵌排除增加 `docs/ModLoader_技术债调查.md`、`docs/ModLoader_第5波拆分方案.md`（仅留开发仓 git，不 sync / 不进 catalog）
- **说明**：玩家行为与 V4.4.2 一致；`ModLoader.js` 约 5763 → 5435 行，属内部可维护性升 patch；模块 6 UI 仍留主文件（Vue / 机械拆 UI 试验不在本版）

## V4.4.2 (2026-08-27)

- **新增**：`modloader/test/run-all.js` — 全量跑 `*.test.js` + `ModLoader.js` 语法检查（`run-all.bat` 供 Windows 双击）

- **修复**：`paramTypeKit` 改由 `createModMetadata(deps)` 注入，与 `paramValues` 工厂 DI 一致

### 配置写入统一

- **修复**：`mod_config` 写入统一为 `persistModListToConfig`（全量 `serializeModListToConfig(_modData)`）；移除 `appendNewModsToConfig` merge 路径
- **修复**：参数编辑器保存改走 `saveAllChanges()`，避免丢弃其他 Mod 未保存的开关/顺序；任意写盘即迁移 legacy 键

### Schema 隔离

- **修复**：`@define-schema` 改为每次 `parseModInfo` 局部字典，不再跨 Mod 累积；参数挂载克隆后的 `schemaFields`；嵌套 struct 在文件内链接；`renderStructField` 不再 fallback 全局字典
- **测试**：`modMetadata.test.js` 新增同名 schema 两 Mod 隔离用例（`modMetadata-schema-mod-b.js`）

### 脚本基名同名冲突

- **新增**：`modloader/pluginNameConflict.js` — 检测游戏 `plugins.js` 插件与 Mod 列表脚本基名重复；管理器内多 Mod 同名时按运行时规则标出「无效」项（已启用游戏插件优先；否则 **order 编号最小** 的 Mod 优先生效）
- **UI**：列表 Mod 名旁红字提示「与游戏插件 / 编号 N 的 Mod 同名」；详情区「同名冲突」段落；开启无效 Mod 时确认框
- **说明**：与 `@base` 依赖检测独立；`@base` 仍只能写脚本名，冲突由玩家自行取舍

### 参数管道

- **修复**：`applyModConfigToEntry` 统一走 `paramValues.normalizeSingleParamValue`（配置加载与运行时下发一致）；parity 测试见 `modMetadata.test.js`

### 整 mods 文件夹安装

- **清理**：移除 V3.x 平铺时代「根目录 .js 新增/更新清单」；确认框仅提示将覆盖 mods 下已有文件（整合包一次性更新）；成功后仍报告复制文件总数

## V4.4.1 (2026-08-26)

### 本地 Mod 安装管线

- **重构**：安装输入分类下沉至 `modloader/installClassifier.js`；拖放 / 浏览 `.js` / 浏览 mods 文件夹经 `dispatchInstallItems` 统一决策（单 mods 整包 → 顶层 `.js` → 拒绝并报告忽略项）
- **新增**：安装页「浏览 mods 文件夹」（NW.js `nwdirectory` input）
- **统一**：无效输入、非 mods 文件夹、混合拖放时忽略非 `.js` / 文件夹的提示文案（拖放与浏览一致）
- **修复**：拖入 mods 文件夹时 `dataTransfer.items` 仅识别目录项、未附带路径导致「无法定位 mods 文件夹」
- **清理**：移除废弃 `install.*` 翻译键（`noFiles`、`noValidFiles`、`dragCorrect`、`browseFolderFallback` 等）
- **改善**：`.js` 与 mods 整包导入成功后共用 `showInstallDoneDialog`，留在安装页继续操作

## V4.4.0 (2026-08-26)

### ModLoader 架构（`modloader/` 子模块）

- **重构**：第 1～3 波规则下沉完成——`paramTypeKit`、`modMetadata`、`dependencyResolver`、`paramValues`、`packageDiscovery`、`configCore`；`ModLoader.js` 保留编排、界面、配置 I/O 外壳与 `window.ModLoader` API
- **新增**：`modloader/test/` Node 自动测与 fixture（`modloader/test/` 不进 sync / 在线 catalog）
- **配置**：`configCore` 负责 `mod_config` 新/旧键解析、meta 键过滤、workshop 段默认合并、保存时全量序列化（旧键 `../mods/<脚本>` 读取兼容，保存仅写 `local:` / `ws:`）
- **包发现**：`packageDiscovery` 负责 `modloader.json` entries 安全校验与包根脚本扫描
- **说明**：玩家安装方式不变（整合包整包拷贝 `js`）；功能行为与 V4.3.x 一致，属内部可维护性升 minor

## V4.3.8 (2026-08-26)

### 管理器在线更新（`libs/modLoaderUpdater.js`）

- **改善**：「检查更新」阶段区分 `remove[]` 遗弃路径——本地仍存在者列入「更新后将清理」；本地已不存在者单独提示「更新时跳过」（与提交阶段「清理跳过（已不存在）」一致）

## V4.3.7 (2026-08-26)

### 标题画面入口角标

- **新增**：标题画面「模组管理器」入口按钮左上角显示绿色可更新角标，与设置齿轮汇总一致（Mod 商店可更新 + 未读新增 + 管理器在线更新）；复用 `ml-settings-update-badge` 样式；后台 catalog 预拉完成后自动刷新

### 管理器升级拓展插件
- **新增**：升级过程失败后流程终止时，文本提示该如何后续处理。

## V4.3.6 (2026-08-25)

### 管理器在线更新（`libs/modLoaderUpdater.js`）

- **改善**：「检查更新」列出需更新 / 与 catalog 一致文件数及路径清单（LF 归一 hash 比对）
- **改善**：版本号相同但文件 hash 不一致时仍可触发更新（修复同版本热修场景）
- **改善**：「复制升级过程日志」— 减少与 更新日志 的语义混淆
- **新增**：有可更新内容时显示「更新日志」— 弹窗展示远端 `(本地, 远端]` 区间 CHANGELOG（非仅当前 tag 一段）
- **修复**：Gitee / GitHub 镜像在 **hash 校验失败** 时也会切换下一源（此前仅网络失败切换）
- **发版**：`tools/manager-release/markCatalogTest.js` — 批量插入测试标记，便于全量在线更新测试

## V4.3.5 (2026-08-25)

### 管理器在线更新

- **改善**：sha256 校验失败时输出期望 / 实际 hash、size、下载 URL；并给出 LF 归一 hash 对比提示（排查 CRLF catalog 问题）

## V4.3.4 (2026-08-25)

### 发版 sync / catalog（`tools/manager-release/sync.js`）

- **修复**：Windows 下 catalog `sha256` / `size` 按 **Git LF 归一化** 计算，与 raw 下载字节一致（修复 CRLF 磁盘导致在线更新 hash 全失败）
- **改善**：`release.js verify` 使用同一 LF 规则校验 catalog 与磁盘

## V4.3.3 (2026-08-24)

### 发版工具（`tools/manager-release/`）

- **新增**：`release.js` 工作流 — sync、差异报告、`verify`、pack、Release 说明（`publish` / `all`）
- **新增**：`readmeRoot.js` — 从 `docs/README*.md` 自动生成发行仓根 README（徽章 / 链接改写）
- **改善**：`manager-release/README` 补充 verify、CRLF 注意、完整发版步骤

## V4.3.2 (2026-08-24)

### 发版路径规则（`tools/manager-release/pathRules.js` + updater 内嵌副本）

- **重构**：发行排除分为 **SYNC_EXCLUDE**（不进 Git / catalog）与 **CATALOG_ONLY_EXCLUDE**（进 Git、不进在线 catalog）
- **修复**：`libs/piracyGate.js`、`docs/ModLoader_模块结构.md` 等不再误入在线更新 catalog；updater 校验规则与 sync 对齐

## V4.3.1 (2026-08-24)

### 管理器在线更新

- **修复**：`libs/modLoaderUpdater.js` `validateCatalog()` 中多余 `continue`/`}` 导致脚本语法错误、设置入口不显示
- **新增**：「在线更新时不更新 Mod 商店作者工具」选项（`excludeAuthorTools`，**默认勾选**）— 仅跳过 `tools/modstore/` 下载，**不删除**本地 `tools/` 其它文件
- **发版**：根目录 `README.md` / `README-en.md` 改由 sync 从 `docs/README*.md` 自动生成（含徽章与链接改写）

## V4.3.0 (2026-08-24)

### 管理器在线更新（`libs/modLoaderUpdater.js`）

- **新增**：设置 → **管理器更新** 独立入口（与 Mod 商店分离）；手动检查 / 更新 ModLoader 本体及白名单发行文件
- **协议**：`main/manager/channel.json` 指针 → 同 tag 的 `manager/catalog.json` + raw 单文件；本地 sha256 相同则跳过下载
- **安全**：全量下到 `config/.ml-updater-tmp/` → 备份 → 替换 → 成功后再 `remove[]`；失败从 backup 还原且不执行 remove
- **偏好**：`config/modloader_updater.json`（含 `updatesDisabled`；永不被更新覆盖）
- **角标**：有更新且未禁用时 `getUpdateCount` 返回 `1`，与商店角标加算；禁用时不预拉、无角标
- **镜像**：写死 GitHub + Gitee；`zh_CN` / `zh_TW` 默认 Gitee，其它默认 GitHub；失败自动试另一源
- **发版工具**：`tools/manager-release/sync.js` 同步白名单 + 演示 `_localmods` 到发行仓并生成 channel / catalog
- **说明**：不做自动更新、不做版本回退；完成后须 **F5**；更新器自身可出现在 catalog 中（当次内存旧脚本，F5 后生效）

## V4.2.0 (2026-08-24)

> 自 V4.1.14 以来以补丁、修 bug、UI 改善与历史遗留清理为主；本版统一升 minor，并同步维护 README / 使用手册 / Skill / 模块结构等文档。

### Mod 更新日志（管理器详情 + 公用弹窗）

- **重构**：抽出公用 `showChangelogModal(title, body, options)`；头部「(日志)」仍展示 `docs/modloader_CHANGELOG.md`
- **新增**：详情面板版本旁「更新日志」链接——仅当包元数据有版本号（`modloader.json.version`，单脚本可回退 `@version`）且包根存在 `CHANGELOG.md` 时显示
- **约定**：多脚本包共用包根一份 `CHANGELOG.md`；Mod 商店弹窗改为调用同一公用 API
- **导出**：`window.ModLoader.showChangelogModal` / `hideChangelogModal` / `isChangelogModalOpen`
- **修复**：更新日志链接主题配色；弹窗 Markdown 渲染

### Mod 包更新日志规范

- **统一**：所有 Mod 包（含功能 Mod 与前置 Mod，如 ModDataLoader / ModResourceLoader）更新日志迁至包根 **`CHANGELOG.md`**（唯一合法名）；不再使用 `docs/功能Mod更新日志/[ModName]_CHANGELOG.md` 或 `docs/前置Mod相关文档/*_CHANGELOG.md`
- **插件头**：`@help` 中【更新日志】改为指向包根 `CHANGELOG.md`
- **商店**：catalog `changelogUrl` + 商店列表按钮；已最新时优先读本地包根文件（§5.1）

### Mod 商店 UI 多语言（`libs/modStore.js`）

- **新增**：商店面板 UI 多语言（简体中文 / 繁體中文 / English），内嵌 `STORE_I18N_PACKS`，跟随 `modloader_config.json` → `ml_language`
- **约定**：词条不写入 `config/language/`，与管理器语言包分离；查找链为当前语言 → `zh_CN` 回退 → 键名原文
- **说明**：打开商店面板时按当前语言渲染；切换语言后须重新进入 Mod 商店（或重开管理器）才刷新商店文案

### Mod 商店与历史遗留清理

- **修复**：移除商店面板多余「返回商店」按钮
- **修复**：同名多源 Mod 禁止并发下载，避免覆盖竞态
- **清理**：移除 `modloader.json` 废弃 `title` 字段相关遗留；`manifest.title` 扫描死代码（V4.1.14 已删，本版文档对齐）
- **重构**：`modStore.js` 内部分 `var` 改为 `let`/`const`；删除僵尸代码

### 文档

- **维护**：`docs/README.md` / `README-en.md` / `使用手册.md` / `ModLoader_模块结构.md` / `.trae/skills/*` / `ModLoader_测试文档.md` 同步 V4.2.0 与包根 `CHANGELOG.md` 约定；测试文档去掉版本号前缀

## V4.1.14 (2026-08-22)

### Mod 商店拓展适配（`libs/modStore.js`）

- **新增**：`registerLogEntry` 支持可选 `getUpdateCount()`；设置齿轮左侧显示可更新 Mod 数量角标（`ml-settings-update-badge`）
- **变更**：冲突角标刷新扩展为 `_refreshSettingsBadges`，汇总各日志入口的 `getConflictCount` / `getUpdateCount`；`refreshConflictLog` 仍指向同一刷新函数
- **变更**：工具栏「刷新工坊」文案改为「刷新列表」（`workshop.refresh`），**始终显示**；点击后 `scanAllMods` 全量重扫本地 + 工坊，日志为「Mod 列表已刷新」
- **样式**：`modloader.css` 补充商店列表/来源 Tab 滚动条、`.ml-store-panel-root` 全屏布局、可更新角标样式
- **修复**：设置齿轮下拉卡片中「Mod 商店」「数据/资源冲突日志」等入口文本后方同步显示绿色可更新角标与红色冲突角标（与齿轮汇总角标语义一致）；展开设置卡片时刷新各入口角标
- **新增**：Mod 商店「新增」提醒——`mod_store.json` 落盘 `seenMods` 记录玩家已查看的包名；齿轮角标统计可更新 + 未查看新增（去重）；状态 Tab 增加「新增」；列表项显示 `New` 标识，点击条目后标记已读并移除

### modloader.json 字段约定

- **移除**：扫描本地 Mod 时读取 `manifest.title` 写入 `localPackageTitle`（已无 UI 消费，死代码）
- **约定**：`name` = 包目录名；`description` = 简介；`version` = 包版本（多脚本包必填）。废弃 `title` 字段
- **同步**：测试包 / 工坊自测包 `modloader.json` 与 Mod 商店打包工具改为上述约定

## V4.1.13 (2026-07-29)

### 长文本换行

- **修复**：`note` / `multiline_string` 的 `@default` 与旧配置中字面量 `\n` 在编辑器中显示为真换行（Enter 可继续换行）
- **约定**：存档与下发 PluginManager 均为真换行字符串，不做官方 note 的 JSON 包装；`sanitizeText` 保留换行

## V4.1.12 (2026-07-29)

### struct 控件与顶层对齐

- **重构**：抽出 `appendNumberControl` / `appendNoteControl` / `buildDbOptionsHtml`，顶层参数与 struct 子字段共用同一套 DOM/CSS（无平行复制）
- **新增**：struct 的 `number` 在双侧 `min`/`max` 时用滑动条；仅一侧或无上下限时用 Min/Max 按钮行
- **新增**：struct 支持 `note` / `multiline_string` 多行 textarea
- **对齐**：struct 数据库下拉对无名空位同样显示禁用「(空)」（与顶层一致）

## V4.1.11 (2026-07-29)

### 工坊详情信息密度

- **压缩**：详情去掉管理/订阅说明两行，改为列表悬停 `title` 提示
- **删除**：工坊详情不再显示「工坊ID&订阅名」「安装状态」「文件」（桥接路径）；保留来源 + 工坊目录
- **说明**：`installState` 仅 `ready`/`missing`（桥接失败），无下载中检测；异常仍靠列表 ⚠，详情「就绪」属冗余
- **清理**：移除 `detail.labelWorkshopSub` / `labelInstallState` / `installReady` / `workshop.unnamedPackage` 与 `.ml-detail-subhint`

## V4.1.10 (2026-07-29)

### 详情区布局

- **修复**：预览图与 Mod 名同处 flex 行时，正方形预览把整块撑高，名字与「来源」之间大块留白
- **变更**：预览改为右浮动；名字/来源/作者等紧挨排列并与预览并排；参数与帮助 `clear` 后占满整行

## V4.1.9 (2026-07-29)

### YEP 独立装备数据源兼容

- **修复**：`getDatabaseArray` 兼容 YEP_ItemCore 将 `$dataWeapons` / `$dataArmors` 转为数字键对象后，参数页误判「数据库未加载」
- **新增**：`normalizeDatabaseCollection()`——数组原样返回，数字键对象归一化为可下标遍历数组

## V4.1.8 (2026-07-29)

### 数据库引用类型补全

- **新增**：参数 `@type` 支持 `class` / `troop` / `animation` / `common_event` / `switch` / `variable`（仍不解析 `tileset`）
- **适配**：`switch` / `variable` 从 `$dataSystem.switches` / `.variables` 取名称字符串；其余走 `$dataXxx` 对象数组
- **新增**：`getDatabaseEntryName()`，统一对象 `.name` 与开关/变量字符串的显示名
- **测试**：`_localmods/TestDbTypes/TestDbTypes.js` 覆盖上述 6 种下拉与控制台名称解析

## V4.1.7 (2026-07-29)

### UI 样式外置收尾

- **补洞**：`modloader.css` 补齐工坊态、筛选 Tab active、排序禁用、`ml-badge-danger`、`ml-form-switch` 基样式等原先仅存在于 JS/降级串的规则
- **迁移**：工具栏、头部小按钮、删除按钮、安装拖放页、颜色选择行、确认弹窗、详情路径/提示等静态内联样式改为 class
- **优化**：筛选 Tab / 排序 / 删除开态改为 class 切换，不再写 `el.style.backgroundColor`
- **移除**：删除 `getFallbackCSS_ml()`；`injectStyles()` 只读 `config/modloader.css`，缺失时打日志并跳过注入（避免再维护双份 CSS）

## V4.1.6 (2026-07-29)

### libs 扩展宿主

- **新增**：`js/mods/libs/` 扩展加载——扫描并执行其中 `.js`（跳过依赖库如 `marked.min.js`）；脚本需调用 `window.ModLoader` 注册接口才生效，不调用等于未装
- **新增**：`registerManagerGate(handler)`——打开管理器前依次执行闸门，任一返回 `false` 则阻止进入；扩展自管检测/弹窗，管理器本体无功能特判接线
- **新增**：公共 API 附带 `showConfirmDialog` / `hideConfirmDialog`，供 libs 扩展复用管理器对话框
- **变更**：更新日志 Markdown 改用 `libs/marked.min.js`，移除内置简易 `parseMarkdownToHtml` 实现
- **修复**：libs 扩展改用 `<script>` 注入加载（勿用 Node `require`），避免 NW.js 模块作用域读不到 `window.ModLoader` 导致扩展静默不挂载

### 盗版检测外置

- **变更**：反盗版逻辑整体迁至 `libs/piracyGate.js`（`registerManagerGate`）；**文件存在即开启，删除即关闭**
- **移除**：`modloader_config.json` 的 `piracyDetection` 段及本体入口按钮特判；旧配置残留字段可忽略
- **说明**：发行包随推 `piracyGate.js` 即可启用；开源/社区分发删除该文件即可

## V4.1.5 (2026-07-29)

### 冲突日志迁入设置菜单

- **变更**：拆除右下角浮动 ⚠ 按钮、独立冲突面板及 2 秒 DOM 持久化轮询
- **变更**：冲突日志入口改到管理器左上角设置齿轮菜单底部；未注册源时不显示菜单项
- **变更**：`registerLogEntry` API 改为 `{ id, label, getConflictCount, render }`——管理器只提供空壳面板，内容由前置 Mod 的 `render(container)` 注入
- **新增**：有冲突时设置齿轮旁显示红色「!」提醒；`refreshConflictLog()` 刷新徽标
- **说明**：本次仅打通数据前置（ModDataLoader）；资源前置后续再接

## V4.1.4 (2026-07-29)

### 排序拖拽体验（Steam 风格）

- **优化**：列表排序改为自定义按住拖动（不再使用 HTML5 DnD），手感接近 Steam 创意工坊排序
- **新增**：提起后主题色光圈 + 略提亮；X 轴锁定；原地留空，空位随插入点丝滑让位（约 100ms）
- **新增**：拖行上/下边越过其他行垂直中线后，对方整行滑动让位；快扫时多行可一起滑动
- **新增**：拖拽中可用鼠标滚轮滚动列表；松手后先对齐空位再消光圈（约 280ms），动画结束后再写入 order
- **调整**：动画时长集中在 `SORT_ANIM`（`thresholdPx` / `slideMs` / `releaseMs`）便于手调
- **保留**：序号输入、上移/下移；序号框内按下不起拖；拖拽中不改详情选中

## V4.1.3 (2026-06-03)

### 冲突日志面板

- **新增**：右下角浮动 ⚠ 按钮 + 可展开冲突日志面板，显示 Mod 数据冲突摘要（胜者/已被覆盖方 + 中文字段名翻译）
- **新增**：`window.ModLoader.registerLogEntry()` 公共 API，供前置 Mod 注册冲突日志源
- **新增**：面板仅在模组管理器打开时可见，关闭管理器后自动隐藏
- **修复**：`setInterval` 持久化检查——RMMZ canvas 覆盖或场景切换后自动重建按钮/面板

### @base 依赖守卫

- **新增**：`loadEnabledModsRuntime` 加载循环中自动检查 `@base` 依赖，缺失时跳过加载并打日志 `[依赖守卫]`，防止玩家关闭前置 Mod 后游戏崩溃
- **检查逻辑**：同时检查 `PluginManager._scripts`（已加载）和待加载队列，确保同批次加载的依赖链正确

### 其他

- **修复**：冲突报告去重逻辑——同一 Mod 不同来源（JS API vs manifest）视为独立条目，不再误合并
- **修复**：冲突报告 UI 文案「已覆盖」→「已被覆盖」

## V4.1.2 (2026-05-31)

### 配置调整

- **变更**：盗版环境检测改为 `modloader_config.json` → `piracyDetection.enabled` 控制，**默认关闭**；游戏作者发布更新时设为 `true` 即可开启
- **变更**：检测开启时的提示文案改为源码内明文中文（`showPiracyWarning()`），便于游戏作者自行修改
- **移除**：插件参数 `Mod Button X/Y`（RMMZ 插件管理器无法读取，懒得修了）；标题入口按钮位置改在 `ModLoader.js` 内 `BUTTON_X` / `BUTTON_Y` 常量硬编码

## V4.1.1 (2026-05-31)

### mod_config 旧键兼容

- **新增**：读取时兼容 V3.x 本地键 `../mods/<脚本基名>`（含 V1 布尔值 `true`/`false` 条目），映射到 `local:<包名>:<脚本基名>`
- **行为**：保存/删除后全量重写 config，旧键自动清除，玩家无需跑 `migrate-mod-config-keys.js`
- **文案**：mods 文件夹导入提示改为「检测到导入 mods 文件夹」；无效拖放提示改为「拖放安装仅支持：.js 文件或 mods 文件夹！」
- **清理**：移除工坊 Mod 删除时永不触发的只读弹窗死代码（删除模式下本就不显示垃圾箱）

## V4.1.0 (2026-05-30)

### 统一包结构（破坏性变更）

- **本地**：Mod 脚本迁至 `js/mods/_localmods/<包名>/` 包根；配置键 `local:<包名>:<脚本基名>`
- **工坊**：取消 `js/mods/` 子目录，脚本与 `preview.png`、`modloader.json` 均在订阅包根
- **共用**：`discoverPackageScripts` 扫描包根一层 `.js`；本地/工坊均支持 preview 缩略 + 点击弹窗
- **安装**：拖/选单个 `.js` → `_localmods/<基名>/<基名>.js`；整 mods 文件夹仍复制到 `js/mods/` 根
- **删除**：本地 Mod **整包删除** `_localmods/<包名>/`；多脚本包确认框列出全部脚本；删除后重排 order 并写回 config
- **迁移**：`tools/migrate-local-mods-to-localmods.js`、`tools/migrate-mod-config-keys.js`（不内置管理器）
- **文档**：`docs/V4.1_unified_package_plan.md`、`docs/使用手册.md`

## V4.0.1 (2026-05-30)

### 工坊规范收紧

- **变更**：工坊脚本**必须**位于 `js/mods/`；不再扫描包根目录 `.js`
- **安全**：`modloader.json` 的 `entries` 仅接受文件名（如 `YourMod.js`），带路径的项忽略，固定解析为 `js/mods/<文件名>`
- **新增**：工坊包 `preview.png`（与 `modloader.json` 同目录）；详情区右上角展示，缺失显示「无预览图」
- **文档**：`V4_workshop_作者规范.md` 同步包结构与安全说明

## V4.0.0 (2026-05-28)

### 后续改进

- **修复**：插件模式时序——`injectStyles` 在样式已存在时仍同步配置；`deferLoadEnabledModsRuntime` 延迟加载；`window.load` 已触发时立即 bootstrap；工坊关闭时清理 `_workshop` 桥接
- **修复**：启动时 `ensureModLoaderConfigFile` 生成/补全 `modloader_config.json` 的 `workshop` 段（此前仅切换主题时才写入文件）
- **移除**：`workshop_sim` / `useDevSim` / `workshop_subscriptions.json` 开发模拟（RMMZ 无法加载游戏目录外工坊路径，自测请用 `steamapps/workshop/content/4379740/`）
- **UX**：工坊详情显示「工坊订阅」为 `ID & modloader.json 名称`；来源区三行说明（Steam创意工坊 / 管理器限制 / Steam 订阅）
- **自测**：工坊包 `3000000004` 多脚本（核心 + @base + @orderAfter）演示
- **修复**：多脚本包列表名使用各脚本文件名，不再共用 `modloader.json` 的 `title`
- **修复**：工坊 Mod 可正常排序（`readOnly` 仅限制删除/拖放安装）
- **修复**：依赖检测 modLookup 恢复 V3.17 逻辑，工坊 Mod 仅额外按 `ws:<id>:<脚本名>` 中的脚本名注册
- **修复**：`mod_config` 无记录的工坊/本地新 Mod 排在已有 Mod 之后（按配置最大 order 递增）
- **UX**：筛选为「本地」或「创意工坊」时禁用排序，悬停排序按钮显示提示
- **自测**：`workshop/content/4379740/` 测试包 3000000001~4
- **文档**：`V4_IMPLEMENTATION_PLAN.md` 同步为已实现说明；作者规范补充安全与信任说明

### Steam 创意工坊（磁盘扫描）

- **新增**：`workshop` 配置段（`steamAppId=4379740`、`steamLibraryPath`）
- **新增**：`scanLocalMods` / `scanWorkshopMods` / `scanAllMods`，工坊 Mod 使用 `ws:<fileId>:<name>` 配置键
- **新增**：Mod 对象扩展 `loadPath`、`source`、`workshopId`、`workshopRoot`、`subscribed`、`readOnly`、`installState`
- **变更**：`loadEnabledModsRuntime` 使用 `mod.loadPath` 加载（非 `mod.id`）
- **新增**：UI 筛选（全部/本地/创意工坊）、刷新工坊按钮、工坊角标与只读删除保护

## V3.17.1 (2026-05-28)

### 多语言与标题按钮

- **移除**：`initLangFallback()` 硬编码简中兜底表（仅保留语言包 + zh_CN 回退）
- **清理**：删除 V3.17.0 已废弃的 plugins 重置相关翻译键
- **修复**：确认对话框误用 `button.ok`（语言包仅有 `dialog.ok`）导致按钮显示为 key
- **修复**：标题入口按钮改为 `window.load` 后创建，并内联 `display:none` 避免闪现

## V3.17.0 (2026-05-28)

### 运行时加载（不再写入 plugins.js，其更新后mod不再失效，不需要一键恢复了。）

- **重构**：Mod 开关/参数/排序仅保存至 `mod_config.json`，不再调用 `updatePluginsJs` 改写 `plugins.js`
- **新增**：`PluginManager.setup` Hook，在官方插件加载完毕后按 `order` 调用 `loadEnabledModsRuntime` 加载 Mod
- **新增**：`buildModFinalParameters`、`installBootstrapHooks`、`installWindowLoadFallback`（插件模式首轮兜底）
- **新增**：`cleanupLegacyModEntriesFromPluginsJs`，启动时自动清理旧版 `__isMod` / `../mods/` 注册条目
- **移除**：`updatePluginsJs`、`checkPluginsReset` 及「plugins.js 被重置」恢复对话框

## V3.16.1 (2026-05-23)

### 环境兼容性调整

- **新增**：非 Steam 正版环境使用提示，引导用户前往正确环境或使用旧版整合包
- **说明**：为保障维护效率，后续版本将仅支持 Steam 正版环境运行。非正版用户可继续使用 V3.1 旧版整合包（已停止更新）

## V3.16.0 (2026-05-19)

### 多语言支持 + 系统设置面板

#### 多语言系统

- **新增**：多语言支持体系，采用 `config/language/` 文件夹 + 独立语言包 JSON 文件方案
- **新增**：内置 3 种语言包
  - 简体中文（`zh_CN.json`）—— 同时也是翻译兜底语言
  - 繁体中文（`zh_TW.json`）
  - English（`en.json`）
- **新增**：自动扫描发现机制 —— 扫描 `config/language/` 目录下所有 `.json` 文件，下拉列表自动拓展
- **新增**：`initLangFallback()` 硬编码简中兜底表 —— 即使语言包文件缺失，界面也不会崩溃
- **新增**：`t(key)` 翻译函数 —— 三重兜底链：当前语言包 → zh_CN 语言包 → 代码硬编码兜底表 → key 原始值
- **新增**：`loadLanguageConfigs()` 扫描加载所有语言包文件
- **新增**：`getAvailableLanguages()` 获取已安装语言列表，排序：简体中文 → 繁体中文 → English → 其余按字母
- **新增**：`getLanguageDisplayName()` 获取语言自身文字显示名称
- **新增**：`setLanguage()` 切换语言并自动保存到 `modloader_config.json`
- **新增**：`refreshAllUIText()` 统一刷新界面所有文字
- **新增**：语言设置在切换时即时生效，不触发"有未保存的修改"判定

#### 系统设置面板

- **新增**：⚙ 齿轮图标（系统设置入口），位于模组管理器标题左侧
- **新增**：`ml-settings-gear` 点击展开下拉卡片，hover 旋转动画
- **新增**：`ml-settings-card` 下拉卡片面板，包含语言下拉框和主题切换按钮
- **新增**：点击卡片外部自动关闭，非模态弹窗交互
- **重构**：主题切换从头部 ☀️/🌙 emoji 移入设置卡片，改为"暗黑主题/暖色主题"两个按钮
- **新增**：主题设置也通过 `ml_theme` 保存到 `modloader_config.json`，合并写入不丢失现有配置
- **优化**：齿轮图标根据主题自动适应配色

#### 国际化改造

- **重构**：Mod 管理器全部界面文字替换为 `t('key')` 翻译调用，约 50+ 个翻译标识符
  - 覆盖范围：标题、按钮、详情面板、参数编辑、安装/删除/排序模式、确认对话框、错误提示等
- **新增**：`getDbLabel()` 数据库类型标签翻译函数
- **新增**：依赖检测报错消息（`dep.*`）、数据库标签（`db.*`）、降级提示（`param.db*`）等翻译支持
- **修复**：`t('title')` 在语言系统初始化前被调用导致显示 key 名的问题
- **修复**：多处翻译 key 缺失导致的界面显示原始 key 名问题
- **修复**：安装界面拖放提示文字被误改写的问题

## V3.15.2 (2026-05-18)

### 依赖检测5状态判定 + 配置全量重写

#### 依赖检测5状态判定
- **重构**：依赖检测算法完全重写，从简单"缺失/通过"二元判断升级为5种状态精准判定
  - ✅ **PASS**：依赖插件存在且已开启且排序正确
  - 🔴 **GAME_DISABLED**：游戏原生前置插件未开启
  - 🔴 **NOT_FOUND**：缺少前置插件
  - 🔴 **MOD_DISABLED**：前置Mod插件未开启
  - 🔴 **WRONG_ORDER**：前置Mod插件已开启但排序错误
- **重构**：`getGamePluginInfo()` 替代原 `getGamePluginNames()`，返回 `Map<name, {enabled}>` 支持检测"存在但未开启"的原生插件
- **重构**：`checkModDependencies()` 内部新增 `checkSingleDep()` 函数实现3步检测流程
- **重构**：`getModDepStatus()` 返回值从 `{baseMissing, orderAfterMissing}` 改为 `{baseDetails, orderAfterDetails}`，包含详细原因说明
- **优化**：`toggleMod()` 弹框消息从笼统"缺失"改为逐条列出具体原因
- **优化**：`renderDetail()` 每个依赖项显示插件名 + 原因说明文本，纵向排列
- **新增**：CSS `.ml-dep-item` 和 `.ml-dep-reason` 样式，依赖项行容器和原因说明文本

#### 配置全量重写
- **重构**：`saveAllChanges()` 函数改为全量重写配置，解决手动删除mod后的僵尸信息残留
  - 旧逻辑：读取已有配置 → 增量更新 → 保存
  - 新逻辑：新建空对象 → 只写入当前mod → 保存
- **优化**：玩家手动删除 `js/mods/` 下的 .js 文件后，该mod的配置条目会在下次保存时自动清除

## V3.15.1 (2026-05-18)

### 中文插件名依赖检测修复

- **修复**：中文插件名（如"分解界面UI"）依赖检测失效的Bug
- **重构**：`parseDependencyList()` 算法改进，不再以"是否含中文字符"作为区分标准，统一以 `.js` 后缀作为唯一分界标记
  - 含 `.js` 的 token：提取到 `.js` 为止，去后缀
  - 不含 `.js` 的 token：直接作为插件名
- **测试**：12个测试用例全部通过，覆盖纯英文、纯中文、中英文混合等各种场景

## V3.15.0 (2026-05-18)

### 前置插件依赖检测功能

#### 核心依赖检测系统
- **新增**：`parseDependencyList(rawStr)` 函数，支持4种格式的 `@base` / `@orderAfter` 解析
  - 标准带/不带 `.js` 格式
  - 非标准混中文无空格/有空格格式
  - 自动丢弃中文说明文本
  - 自动去重处理
- **新增**：`getGamePluginNames()` 函数，读取 `plugins.js` 获取已开启的游戏原生插件集合
- **新增**：`checkModDependencies(modList)` 核心检测函数
  - `@base` 检测：前置插件必须存在且已开启
  - `@orderAfter` 检测：前置插件必须存在且已开启且排序在当前mod之前
- **新增**：`refreshDependencyCheck()` / `getModDepStatus(mod)` 全局缓存系统，避免重复计算

#### UI 警告提示
- **优化**：`renderModList()` 中 toggle-thumb 显示警告色
  - `@base` 缺失 → 红色警告
  - `@orderAfter` 缺失 → 黄色警告
- **优化**：`toggleMod()` 开启mod时检测依赖状态，弹框确认后才执行
  - `@base` 缺失提示"可能导致游戏崩溃"
  - `@orderAfter` 缺失提示"可能导致插件失效"
- **新增**：`doToggleMod()` 函数，从原 `toggleMod` 拆分出的实际执行开关逻辑
- **优化**：`renderDetail()` 依赖文本颜色和图标
  - 缺失 → 红色/黄色文本 + ❌ 图标
  - 通过 → 绿色文本 + ✔ 图标
- **优化**：进入管理器、排序变动、安装/删除mod、全部关闭等操作后自动刷新依赖检测

#### CSS 样式
- **新增**：`modloader.css` 新增依赖警告样式类
  - `.ml-dep-base-warning`：toggle-thumb 红色警告
  - `.ml-dep-order-warning`：toggle-thumb 黄色警告
  - `.ml-dep-list`：依赖列表容器
  - 多种文本/标签颜色类
- **优化**：`injectStyles()` 内联降级CSS同步添加所有依赖警告样式

## V3.14.0 (2026-05-17)

### CSS 分离 + 暗黑/暖色双主题系统

#### CSS 外部化

- **重构**：将约 1337 行 CSS 从 ModLoader.js 内联模板字符串提取到外部文件 `js/mods/config/modloader.css`
- **重构**：`injectStyles()` 改为运行时通过 `fs.readFileSync()` 读取外部 CSS 文件
- **新增**：`getFallbackCSS_ml()` 降级函数 —— CSS 文件缺失时使用内置紧凑版 CSS（约 80 行），确保 UI 不崩溃
- **优化**：ModLoader.js 从约 6100 行缩减至约 4900 行（减少约 20%）

#### 暗黑/暖色双主题

- **新增**：使用 `html[data-ml-theme]` 属性控制主题，支持 `"dark"`（暗黑）和 `"warm"`（暖色）两套配色
- **新增**：暖色主题配色方案 —— 米白/浅驼背景 + 深棕文字 + 珊瑚橙强调色
- **新增**：主题切换按钮（☀️/🌙），位于模组管理器头部 `(日志)` 链接旁
- **新增**：主题自动保存到独立配置文件 `js/mods/config/modloader_config.json`，与 Mod 配置完全解耦
- **修复**：大量硬编码颜色替换为 CSS 变量引用（43 处），暖色主题下 UI 元素颜色完整覆盖
- **修复**：struct/table 区域 14 处幽灵变量引用（`--ml-text`→`--ml-text-primary`, `--ml-primary`→`--ml-accent`）
- **修复**：安装 Mod 界面（拖放区、文字、按钮背景）改用 CSS 变量，跟随主题切换
- **修复**：输入框聚焦光晕、滑动条滑轨、下拉框选项背景等组件色系完整适配暖色主题
- **修复**：拨动开关关闭态改为"已禁用"徽章背景色（`--ml-danger-bg`），消除暖色下与背景融为一体的问题
- **修复**：主题切换不再触发"有未保存的修改"提示

#### 新增 RGB 分量变量

- **新增**：`--ml-accent-rgb`、`--ml-danger-rgb`、`--ml-warning-rgb` 变量，支持跨主题的 `rgba(var(...), alpha)` 用法

## V3.13.1 (2026-05-17)

### 更新日志查看器

- **新增**：版本号后 `(日志)` 链接，点击可查看 `docs/modloader_CHANGELOG.md` 更新日志
- **新增**：`parseMarkdownToHtml()` 简易 Markdown→HTML 解析器（零依赖，~65 行）
  - 支持 `#`/`##`/`###`/`####` 标题、`- ` 列表、`**粗体**`、`` `代码` ``、`---` 分割线
- **新增**：`showChangelog()` / `hideChangelog()` 弹窗函数
- **新增**：更新日志弹窗 CSS 样式（宽版模态弹窗，支持 ESC/遮罩/按钮关闭）

## V3.13.0 (2026-05-16)

### 参数支持阶段2：Schema 模板系统 + struct/table 参数类型

#### 新增标签

- **新增**：`@text` 标签支持，可为参数指定中文显示名称，覆盖原始参数名
- **新增**：`@define-schema` 标签，定义可复用的 struct/table 字段模板（JSON 数组格式）
- **新增**：`@schema` 标签，在 struct/table 参数中引用已定义的 Schema 模板

#### 新增参数类型

- **新增**：`struct` 类型 —— 折叠式结构体编辑器，支持无限层级嵌套
  - 子字段支持所有已有参数类型（number/boolean/string/select/color/actor/item 等）
  - 递归渲染，支持 struct 内嵌套 struct（深度标识 CSS 类 `ml-struct-depth-N`）
  - 数据存储格式：`JSON.stringify(内部对象)`
  - 详情面板显示摘要：`{3字段: x, y, z}`
- **新增**：`table` 类型 —— 可增删行的表格列表编辑器
  - 支持添加行、删除行、上移/下移行操作
  - 每行是按照 Schema 模板渲染的完整表单项
  - 数据存储格式：`JSON.stringify(["JSON(行1)", "JSON(行2)", ...])`（双重转义）
  - 详情面板显示摘要：`3 行数据`

#### Schema 模板系统

- **新增**：`parseSchemaDefinitions()` 函数 —— 扫描 `@define-schema` 并存入全局 `_schemaDictionary`
- **新增**：Schema 模板支持 JSON 数组格式定义，自动解析每个字段的 name/type/text/default/min/max/step/options/schema
- **新增**：`generateDefaultFromSchema()` 函数 —— struct/table 类型省略 `@default` 时自动生成 JSON 默认值
- **新增**：struct/table 参数自动挂载 `schemaFields` 子参数列表给渲染器使用

#### 数据收集与保存

- **新增**：`collectStructData()` 函数 —— 递归从 DOM 收集 struct 折叠面板的子字段值
- **新增**：`collectTableData()` 函数 —— 从 DOM 收集 table 所有行的数据并序列化为双重转义格式
- **新增**：保存按钮回调中在写入前自动收集 struct/table 类型的 DOM 数据

#### UI 渲染

- **新增**：`renderStructSubFields()` 函数 —— 递归渲染 struct 子字段，支持所有参数类型
- **新增**：`createTableRow()` 函数 —— 根据 Schema 模板创建表格数据行
- **新增**：struct 折叠面板 CSS 样式（`.ml-struct-details`、`.ml-struct-summary` 等）
- **新增**：table 表格 CSS 样式（`.ml-table-container`、`.ml-table-row` 等）
- **新增**：嵌套 struct 深度标识样式（`.ml-struct-depth-1` 到 `.ml-struct-depth-3`）

#### 详情面板摘要

- **新增**：struct 类型在详情面板显示字段数量摘要
- **新增**：table 类型在详情面板显示行数摘要

## V3.9.1 (2026-05-15)

### 元数据解析优化

- **新增**：添加 `@version` 标签支持，版本号显示更规范
- **修复**：`@help` 内容每行开头的 `*` 标记未去除导致显示异常的问题
- **修复**：帮助信息中的 `@version` 等文本被误解析为元数据标签的问题
- **优化**：解析流程与官方插件管理器保持一致，提升兼容性

## V3.9.0

### 参数编辑功能大升级

- **新增**：数值类型参数在有 min 和 max 时，显示滑动条，支持更直观的调整
- **新增**：滑动条支持自定义 step（@step 标签），自动计算合适的步长
- **新增**：点击滑动条数值可以原地编辑，更精准调整
- **新增**：支持长文本类型（note/multiline\_string），使用多行文本编辑框
- **新增**：支持数据库引用类型（actor/skill/item/weapon/armor/enemy/state），显示下拉选择
- **新增**：数据库引用类型在数据库未加载时降级为文本输入，并有红色提示
- **优化**：详情面板正确显示长文本和数据库引用类型的值
- **优化**：数据库引用类型在详情面板中尝试显示对象名称而不是 ID
- **修复**：滑动条步长固定为 1 导致小数参数无法正确调整的问题

## V3.8.0

### 元数据增强

- **新增**：详情面板显示 `@version`、`@base`、`@orderAfter`、`@orderBefore` 标签信息
- **优化**：这些信息只在有数据时才显示，避免空行
- **优化**：所有标签显示为中文，提升用户体验

## V3.7.0

### UI/功能完善

- **新增**：一键全关按钮，可以一次性关闭所有开启的 Mod
- **优化**：一键全关功能和手动点击关闭效果一致，不自动保存，需手动保存后生效

## V3.6.1

### 发布准备

- **优化**：默认日志级别设置为 0，减少控制台输出
- **优化**：浏览本地文件时打开控制台的功能仅在日志级别 >= 3 时启用
- **完善**：开源协议文本，包含完整的 MIT 许可证中英文版本

## V3.6.0

### UI/功能完善

- **新增**：安装按钮点击时检测未保存修改，提示保存后进入
- **新增**：浏览文件支持多选 js 文件，一次性导入清单
- **新增**：mods 文件夹导入也显示清单，区分新增/更新 mod
- **新增**：导入新 mod 自动排到最后，保存 order 配置
- **优化**：非 js 文件过滤逻辑完善，不显示在清单但正常复制
- **优化**：安装界面 UI 升级，白色虚线拖拽区域，拖入变蓝色特效
- **优化**：删除 mod 功能修复，正确删除配置和更新 plugins.js
- **修复**：新 mod 排序 order 从 19 开始的 bug

## V3.5.0

### UI/功能大更新

- **新增**：【安装 Mod】按钮，点击后弹出全屏拖放界面
- **新增**：在安装界面支持浏览本地文件选择 Mod（笨比友好）
- **新增**：【删除 Mod】按钮，开启删除模式后每个 Mod 尾部显示红底🗑️
- **新增**：删除前检测未保存修改，提示删除时会自动保存
- **优化**：拖放功能移到单独界面，完全不影响排序拖拽！
- **优化**：完整支持拖放整个 mods 文件夹（使用 Node.js fs API）
- **优化**：去掉列表里的拖放区域，界面更清爽

## V3.4.0

### 拖放添加 Mod 功能

- **新增**：支持直接拖放单个 `.js` 文件到 Mod 管理器添加 Mod
- **新增**：支持拖放整个 mods 文件夹（未来完整支持）
- **新增**：重复文件检测，提示用户选择覆盖、重命名或取消
- **优化**：无论是空状态还是有 Mod 的状态，都支持拖放
- **优化**：拖放区域有视觉反馈，体验更棒！

## V3.3.2

### 自动检测游戏更新功能

- **新增**：打开模组管理器时，自动检测 plugins.js 是否被游戏更新重置
- **新增**：如果检测到重置，弹出提示对话框，一键还原所有 Mod 配置
- **优化**：笨比友好，再也不用手动还原开关 Mod 了！

## V3.3.1

### 帮助文档优化

- **优化**：帮助文档更新，详细说明两种使用方式（注入模式/插件模式）
- **修正**：去掉不必要的模式切换参数

## V3.3.0

### 排序功能大更新

- **新增**：模组加载顺序排序功能，支持拖拽排序和手动输入序号
- **新增**：排序功能开关，默认关闭，开启时可拖拽，关闭时不可拖拽
- **新增**：手动保存功能，只有点击保存按钮才会保存修改
- **新增**：未保存修改提示，关闭时弹出确认
- **新增**：通用键盘事件修复方案，覆盖整个管理器界面（主界面+参数编辑）
- **优化**：详情面板去掉重复序号显示
- **优化**：切换不同模组时详情面板滚动条重置到顶部

## V3.2.0

### 参数设置优化

- **新增**：数值类型的参数一键最小（Min）、最大（Max）功能
- **修改**：部分 UI 显示优化，提升用户体验

## V3.0.0

### 原生 UI 交互重构

- **优化**：原生 UI 交互过于原始，操作反人类：用 DOM 重构了 UI 交互
- **新增**：参数修改新增支持颜色类型

## V2.0.0

### 参数编辑功能

- **新增**：参考了 sora 的自定义立绘功能，加入了修改参数的 UI 交互
- **支持**：数值、开关、文本、单选下拉类型参数

## V1.0.0

### 基础框架构建

- **新增**：支持游戏内开关 mod
- **新增**：通过注入技术，不再让玩家手改 plugins.js

