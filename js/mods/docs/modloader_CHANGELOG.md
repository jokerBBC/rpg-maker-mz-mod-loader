# ModLoader 更新日志

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
- **文档**：`docs/V4.1_unified_package_plan.md`、[`使用手册.md`](使用手册.md)

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

