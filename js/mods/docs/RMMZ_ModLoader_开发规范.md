# RMMZ ModLoader 开发规范

> 本文件记录 ModLoader 管理器自身的开发规范和架构设计

***

## 📋 目录

1. [架构设计](#-架构设计)
2. [代码规范](#-代码规范)
3. [API 设计](#-api设计)
4. [版本管理](#-版本管理)
5. [测试规范](#-测试规范)

***

## 🏗️ 架构设计

### 整体架构

ModLoader 采用模块化架构，代码组织为多个功能块，每个块使用 `// ================================================================` 分隔。

```
┌─────────────────────────────────────────────────────────────────┐
│                    ModLoader.js 主文件                         │
├─────────────────────────────────────────────────────────────────┤
│  1. 基础配置与日志系统                                         │
│  2. 插件参数读取                                               │
│  3. 配置管理（mod_config.json + modloader_config.json）       │
│  4. 拖放安装功能                                               │
│  5. Schema 模板解析（parseSchemaDefinitions）                  │
│  6. 元数据解析（parseModInfo）                                  │
│  7. Mod扫描与管理（scanLocalMods / scanWorkshopMods / scanAllMods）│
│  8. 依赖检测系统（parseDependencyList / checkModDependencies）  │
│  9. 多语言系统（loadLanguageConfigs / t / setLanguage）        │
│ 10. 工具函数库                                                 │
│ 11. 外部 CSS 样式注入                                         │
│ 12. DOM元素创建与事件绑定                                       │
│ 13. struct 折叠面板渲染（renderStructSubFields）               │
│ 14. table 表格渲染（createTableRow）                           │
│ 15. 数据收集（collectStructData / collectTableData）           │
│ 16. 参数编辑面板                                               │
│ 17. 更新日志查看器（Markdown 解析 + 弹窗）                     │
│ 18. 系统设置面板（语言切换 + 主题切换）                        │
└─────────────────────────────────────────────────────────────────┘
```

### 核心模块

| 模块            | 行号范围      | 功能说明                                                    |
| ------------- | --------- | ------------------------------------------------------- |
| **基础配置**      | 109-126   | 日志系统、调试级别控制                                             |
| **插件参数**      | 130-149   | 读取 ModLoader 自身参数                                       |
| **配置管理**      | 159-248   | 配置文件读写（mod\_config + modloader\_config） |
| **运行时加载**     | \~1655+   | PluginManager.setup Hook、从 mod\_config 加载 Mod |
| **拖放功能**      | 250-867   | 拖放安装、文件复制、导入清单                                          |
| **元数据解析**     | 868-1058   | 解析 Mod 元数据（@param/@help 等）                              |
| **Mod 管理**    | \~1190+  | 扫描本地/工坊 Mod、`scanAllMods`、运行时 `loadPath` 加载 |
| **依赖检测系统**    | \~1186+   | 前置插件依赖解析、检测、缓存、UI 警告提示                                  |
| **多语言系统**     | \~160+    | 语言包加载、`t(key)` 翻译函数、语言切换、界面文本刷新                          |
| **工具函数**      | 1526-2036 | 颜色验证、HTML转义、文本解析、Markdown 解析等                           |
| **外部 CSS 注入** | 2039+     | 读取 config/modloader.css 并注入                             |
| **更新日志查看器**   | \~2380    | 弹窗显示 docs/modloader\_CHANGELOG.md                       |
| **系统设置面板**    | \~2520    | ⚙ 齿轮入口、下拉卡片（语言选择 + 主题切换按钮组）                          |

### 数据流程

```
用户操作 → UI层 → 业务逻辑层 → 数据持久化层
     │          │              │
     │          ↓              ↓
     │      状态更新       config.json
     │          │              │
     ↓          ↓              ↓
   界面渲染 ←── 更新通知 ←───                               mod_config.json
                              （F5 后由 PluginManager Hook 按 loadPath 加载）
```

### V4 创意工坊（磁盘扫描）

```
Steam 订阅 → workshop/content/4379740/<fileId>/
           → js/mods/_workshop/<fileId>/（junction 桥接，供 loadScript）
本地       → js/mods/*.js
                    ↓
              scanAllMods() → mod_config → loadEnabledModsRuntime(loadPath)
```

| 配置 | 路径 |
|------|------|
| 工坊设置 | `config/modloader_config.json` → `workshop` 段（`enabled`、`steamAppId`、`steamLibraryPath`） |
| 工坊 Mod 键 | `ws:<fileId>:<scriptBaseName>` |
| 运行时桥接 | `js/mods/_workshop/<fileId>/`（junction，gitignore） |

启动时 `ensureModLoaderConfigFile()` 补全 `workshop` 段；插件模式见 `bootstrapModLoaderReady()` / `deferLoadEnabledModsRuntime()`。

详见 `docs/V4_workshop_作者规范.md`、`docs/V4_IMPLEMENTATION_PLAN.md`（V4 已实现说明）。

***

## 📝 代码规范

### 命名约定

| 类型   | 规则        | 示例                                       |
| ---- | --------- | ---------------------------------------- |
| 常量   | 全大写，下划线分隔 | `MODS_DIR`, `CONFIG_PATH`, `DEBUG_LEVEL` |
| 函数   | 驼峰命名，动词开头 | `loadConfig()`, `parseModInfo()`         |
| 变量   | 驼峰命名      | `currentParam`, `modConfig`              |
| 私有变量 | 下划线前缀     | `_modData`, `_selectedIndex`             |
| 全局常量 | 模块开头定义    | `const ModName = "ModLoader"`            |

### 注释规范

- **模块分隔**：使用 `// ================================================================` 分隔大模块
- **函数注释**：使用 JSDoc 风格注释
- **行内注释**：解释复杂逻辑或特殊处理

### 风格指南

- **IIFE 封装**：整个文件包裹在 `(() => { 'use strict'; ... })();` 中
- **分号使用**：始终使用分号结尾
- **空格规则**：关键字后、括号前后、运算符前后留空格
- **代码块**：`if/else/for/while` 等语句块始终使用花括号

### 日志规范

```javascript
const DEBUG_LEVEL = 0;  // 0=静默, 1=错误, 2=警告, 3=详细

const log = (level, ...args) => {
    if (DEBUG_LEVEL < level) return;
    const prefix = `[${ModName} v${VERSION}]`;
    if (level === 1) console.error(prefix, '[ERROR]', ...args);
    else if (level === 2) console.warn(prefix, '[WARN]', ...args);
    else if (level === 3) console.log(prefix, '[INFO]', ...args);
};
```

***

## 🔌 API 设计

### 公共 API（供其他 Mod 调用）

目前 ModLoader 主要作为独立运行的管理器，对外暴露的 API 较少。

### 内部接口

#### 配置管理

| 函数                   | 功能     | 参数             | 返回值           |
| -------------------- | ------ | -------------- | ------------- |
| `loadConfig()`       | 加载配置文件 | 无              | `Object` 配置对象 |
| `saveConfig(config)` | 保存配置文件 | `config`: 配置对象 | `void`        |
| `ensureDir(dir)`     | 确保目录存在 | `dir`: 目录路径    | `void`        |

#### 元数据解析

| 函数                              | 功能         | 参数                   | 返回值                                      |
| ------------------------------- | ---------- | -------------------- | ---------------------------------------- |
| `parseModInfo(filePath)`        | 解析 Mod 元数据 | `filePath`: 文件路径     | `Object` 包含 author/help/params/version 等 |
| `standardizeDefault(val, type)` | 标准化参数默认值   | `val`: 值, `type`: 类型 | 标准化后的值                                   |

#### Mod 管理

| 函数                        | 功能            | 参数                | 返回值                |
| ------------------------- | ------------- | ----------------- | ------------------ |
| `scanMods()`              | 扫描 mods 目录    | 无                 | 无（更新全局 `_modData`） |
| `buildModFinalParameters(mod)` | 组装运行时参数 | `mod`: Mod 对象 | `Object` 参数字典 |
| `loadEnabledModsRuntime(mods)` | 运行时加载已启用 Mod | `mods`: 可选列表 | `void` |
| `installPluginManagerHook()` | 安装 setup Hook | 无 | `boolean` |
| `cleanupLegacyModEntriesFromPluginsJs()` | 清理旧版 plugins.js Mod 条目 | 无 | `void` |
| `reassignOrders(modList)` | 重新分配排序号       | `modList`: Mod 列表 | 重新排序后的列表           |

#### 依赖检测

| 函数                              | 功能                              | 参数                | 返回值                                       |
| ------------------------------- | ------------------------------- | ----------------- | ----------------------------------------- |
| `parseDependencyList(rawStr)`   | 解析 `@base` / `@orderAfter` 依赖列表 | `rawStr`: 原始依赖字符串 | `Array<string>` 解析后的插件名列表（去重）             |
| `getGamePluginInfo()`           | 获取游戏原生插件信息                      | 无                 | `Map<string, {enabled}>` 插件名到状态的映射        |
| `checkModDependencies(modList)` | 检测所有 Mod 的依赖状态                  | `modList`: Mod 列表 | `Object` 每个 Mod 的依赖详情                     |
| `refreshDependencyCheck()`      | 刷新全局依赖检测缓存                      | 无                 | `void`                                    |
| `getModDepStatus(mod)`          | 获取单个 Mod 的依赖状态                  | `mod`: Mod 对象     | `{baseDetails, orderAfterDetails}` 依赖详情对象 |
| `doToggleMod(index)`            | 实际执行 Mod 开关（含依赖刷新）              | `index`: Mod 索引   | `void`                                    |

#### 多语言系统

| 函数                              | 功能                              | 参数                | 返回值                                       |
| ------------------------------- | ------------------------------- | ----------------- | ----------------------------------------- |
| `loadLanguageConfigs()`         | 扫描 `config/language/` 加载所有语言包    | 无                 | `void`（更新全局 `_languageConfigs`）            |
| `getAvailableLanguages()`       | 返回已安装语言代码列表（已排序）               | 无                 | `Array<string>` 语言代码数组                   |
| `getLanguageDisplayName(code)`  | 获取语言在自身语言中的显示名称                | `code`: 语言代码     | `string` 显示名称（如 "English"）               |
| `t(key)`                        | 翻译函数，三重兜底链                      | `key`: 翻译键       | `string` 翻译文本                            |
| `setLanguage(langCode)`         | 切换当前语言并持久化到配置文件                | `langCode`: 语言代码 | `void`                                    |
| `getCurrentLanguage()`          | 获取当前语言代码                        | 无                 | `string` 语言代码                            |
| `getDbLabel(type)`              | 获取数据库引用类型的翻译标签                  | `type`: 数据库类型   | `string` 翻译标签                            |
| `populateLanguageSelect()`      | 填充语言下拉选择框                        | 无                 | `void`                                    |
| `refreshAllUIText()`            | 统一刷新界面所有文字翻译                    | 无                 | `void`                                    |

#### 工具函数

| 函数                     | 功能        | 参数             | 返回值       |
| ---------------------- | --------- | -------------- | --------- |
| `isValidColor(color)`  | 验证颜色值     | `color`: 颜色字符串 | `boolean` |
| `isDatabaseType(type)` | 判断是否数据库类型 | `type`: 参数类型   | `boolean` |
| `isNoteType(type)`     | 判断是否长文本类型 | `type`: 参数类型   | `boolean` |
| `escapeHtml(text)`     | HTML 转义   | `text`: 文本     | 转义后的文本    |
| `parseColorTags(text)` | 解析颜色标签    | `text`: 文本     | 带样式的 HTML |

***

## 🔄 版本管理

### 版本号规则

采用语义化版本号 `Vx.y.z`：

| 级别         | 含义                | 示例     |
| ---------- | ----------------- | ------ |
| **x**（主版本） | 架构变化、核心功能新增、侵入点变更 | V4.0.0 |
| **y**（次版本） | 非破坏性小功能追加、UI 调整   | V3.9.0 |
| **z**（修订版） | Bug 修复、文本修正、注释更新  | V3.9.1 |

### 更新日志规范

更新日志统一记录在 `docs/modloader_CHANGELOG.md`，格式如下：

```markdown
## Vx.y.z (YYYY-MM-DD)

### 功能新增
- **新增**：描述新增功能

### 优化改进
- **优化**：描述优化内容

### Bug 修复
- **修复**：描述修复内容
```

***

## ✅ 测试规范

### 测试用例

#### 1. 元数据解析测试

| 测试场景        | 描述                   | 预期结果                            | 已测试版本   |
| ----------- | -------------------- | ------------------------------- | ------- |
| 正常解析        | 解析包含完整标签的 Mod 文件     | 正确提取 author、version、params、help | V3.13.0 |
| 缺少 @default | 参数缺少 @default 标签     | 该 Mod 参数编辑功能被锁定                 | V3.13.0 |
| @help 中含 @  | 帮助文本中包含 @version 等文本 | 不被误解析为元数据标签                     | V3.13.0 |
| 去除 \* 号     | @help 内容每行有 `*` 前缀   | 正确去除前缀，纯文本显示                    | V3.13.0 |

#### 2. 配置管理测试

| 测试场景  | 描述              | 预期结果             | 已测试版本   |
| ----- | --------------- | ---------------- | ------- |
| 文件不存在 | config.json 不存在 | 返回空对象，不报错        | V3.13.0 |
| 文件损坏  | JSON 格式错误       | 返回空对象，记录错误日志     | V3.13.0 |
| 配置保存  | 修改 Mod 状态后保存    | config.json 正确更新 | V3.13.0 |
| 旧格式兼容 | 配置是布尔值（旧格式）     | 正确解析为状态          | V3.13.0 |

#### 3. 拖放安装测试

| 测试场景     | 描述            | 预期结果          | 已测试版本   |
| -------- | ------------- | ------------- | ------- |
| 单个 JS 文件 | 拖放单个 .js 文件   | 文件复制到 mods 目录 | V3.13.0 |
| mods 文件夹 | 拖放整个 mods 文件夹 | 正确识别并复制所有文件   | V3.13.0 |
| 非 JS 文件  | 拖放其他类型文件      | 过滤掉，不复制       | V3.13.0 |
| 重复文件     | 拖放已存在的文件      | 提示覆盖确认        | V3.13.0 |

#### 4. Mod 管理测试

| 测试场景   | 描述          | 预期结果              | 已测试版本   |
| ------ | ----------- | ----------------- | ------- |
| 扫描 Mod | 扫描 mods 目录  | 正确识别所有 .js 文件     | V3.13.0 |
| 排序调整   | 修改 Mod 加载顺序 | mod_config.json order 正确保存，F5 后按序加载 | V3.13.0 |
| 状态切换   | 点击开关切换状态    | 状态正确切换，界面更新       | V3.13.0 |
| 一键全关   | 点击一键全关按钮    | 所有 Mod 变为关闭状态     | V3.13.0 |

#### 5. 参数编辑测试

| 测试场景  | 描述      | 预期结果               | 已测试版本   |
| ----- | ------- | ------------------ | ------- |
| 数值参数  | 修改数值参数  | 正确保存，在 min/max 范围内 | V3.13.0 |
| 布尔参数  | 切换布尔参数  | 保存为 "true"/"false" | V3.13.0 |
| 颜色参数  | 修改颜色值   | 正确解析颜色格式           | V3.13.0 |
| 数据库引用 | 选择数据库对象 | 正确保存 ID 值          | V3.13.0 |

#### 6. UI 交互测试

| 测试场景   | 描述          | 预期结果     | 已测试版本   |
| ------ | ----------- | -------- | ------- |
| 打开管理器  | 点击 Mod 管理按钮 | 界面正确显示   | V3.13.0 |
| 选择 Mod | 点击左侧列表项     | 右侧详情面板更新 | V3.13.0 |
| 参数面板   | 点击齿轮图标      | 参数编辑面板弹出 | V3.13.0 |
| 未保存提示  | 有修改时关闭      | 弹出确认对话框  | V3.13.0 |

#### 7. 多语言测试

| 测试场景         | 描述                         | 预期结果                    | 已测试版本   |
| -------------- | -------------------------- | ----------------------- | ------- |
| 语言包加载         | 扫描 `config/language/` 目录   | 正确加载所有 .json 语言包        | V3.16.0 |
| 语言包缺失         | `config/language/` 目录不存在   | `_languageConfigs` 为空，不报错 | V3.16.0 |
| 翻译查找链         | 当前语言包缺少某 key              | 回退到 zh_CN → 兜底表         | V3.16.0 |
| 翻译键完全缺失       | 所有语言包和兜底表都缺少某 key        | 返回 key 原始值，不崩溃          | V3.16.0 |
| 语言切换          | 下拉选择切换到繁体中文              | 界面文字即时刷新为繁体中文           | V3.16.0 |
| 语言配置持久化       | 切换语言后关闭再打开管理器            | 语言设置保持不变                | V3.16.0 |
| 配置语言代码回退      | 配置文件中语言代码为不存在的语言          | 自动回退到 'zh_CN'           | V3.16.0 |
| 动态添加语言包       | 运行时放入新 .json 文件后刷新管理器     | 下拉列表自动出现新语言选项           | V3.16.0 |
| 语言切换不触发未保存    | 切换语言后检查 `_hasUnsavedChanges` | 不触发"有未保存的修改"提示          | V3.16.0 |

### 测试流程

1. **单元测试**：核心函数单独测试
2. **集成测试**：功能模块联合测试
3. **回归测试**：修改后验证不影响现有功能

***

## 📅 待办事项

- [x] 暂无


***

## 📊 依赖检测5状态说明

| 状态                    | 含义       | 描述                    |
| --------------------- | -------- | --------------------- |
| ✅ **PASS**            | 通过       | 依赖插件存在、已开启且排序正确       |
| 🔴 **GAME\_DISABLED** | 游戏插件未开启  | 游戏原生前置插件存在但未开启        |
| 🔴 **NOT\_FOUND**     | 插件缺失     | 前置插件不存在               |
| 🔴 **MOD\_DISABLED**  | Mod插件未开启 | 前置Mod插件存在但未开启         |
| 🔴 **WRONG\_ORDER**   | 排序错误     | 前置Mod插件已开启但排序在当前Mod之后 |

### 依赖检测流程图

```
开始检测
  ↓
Step 1: 在游戏原生插件中查找
  ├─ 找到且已开启 → ✅ PASS
  ├─ 找到但未开启 → 🔴 GAME_DISABLED
  └─ 未找到 → Step 2
         ↓
Step 2: 在 Mod 列表中查找
  ├─ 未找到 → 🔴 NOT_FOUND
  ├─ 找到但未开启 → 🔴 MOD_DISABLED
  └─ 找到且已开启 → Step 3
         ↓
Step 3: 检查排序
  ├─ 依赖 Mod 在当前 Mod 之前 → ✅ PASS
  └─ 依赖 Mod 在当前 Mod 之后或同位 → 🔴 WRONG_ORDER
```

***

**最后更新**: 2026-05-19\
**对应代码版本**: V3.16.0
