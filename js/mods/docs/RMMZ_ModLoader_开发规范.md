# RMMZ ModLoader 开发规范

> 本文件记录 ModLoader 管理器自身的开发规范和架构设计

---

## 📋 目录

1. [架构设计](#-架构设计)
2. [代码规范](#-代码规范)
3. [API 设计](#-api设计)
4. [版本管理](#-版本管理)
5. [测试规范](#-测试规范)

---

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


| 模块            | 行号范围      | 功能说明                                        |
| ------------- | --------- | ------------------------------------------- |
| **基础配置**      | 109-126   | 日志系统、调试级别控制                                 |
| **插件参数**      | 130-149   | 读取 ModLoader 自身参数                           |
| **配置管理**      | 159-248   | 配置文件读写（modconfig + modloaderconfig）         |
| **运行时加载**     | 1655+     | PluginManager.setup Hook、从 modconfig 加载 Mod |
| **拖放功能**      | 250-867   | 拖放安装、文件复制、导入清单                              |
| **元数据解析**     | 868-1058  | 解析 Mod 元数据（@param/@help 等）                  |
| **Mod 管理**    | 1190+     | 扫描本地/工坊 Mod、`scanAllMods`、运行时 `loadPath` 加载 |
| **依赖检测系统**    | 1186+     | 前置插件依赖解析、检测、缓存、UI 警告提示                      |
| **多语言系统**     | 160+      | 语言包加载、`t(key)` 翻译函数、语言切换、界面文本刷新             |
| **工具函数**      | 1526-2036 | 颜色验证、HTML转义、文本解析、Markdown 解析等               |
| **外部 CSS 注入** | 2039+     | 读取 config/modloader.css 并注入                 |
| **更新日志查看器**   | 2380      | 弹窗显示 docs/modloaderCHANGELOG.md             |
| **系统设置面板**    | 2520      | ⚙ 齿轮入口、下拉卡片（语言选择 + 主题切换按钮组）                 |


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

### V4 创意工坊（V4.1 统一包结构）

```
Steam 订阅 → workshop/content/<AppID>/<fileId>/（包根 .js）
           → js/mods/_workshop/<fileId>/（junction 桥接）
本地       → js/mods/_localmods/<包名>/（包根 .js）
                    ↓
              scanAllMods() → mod_config → loadEnabledModsRuntime(loadPath)
```


| 配置       | 路径                                                |
| -------- | ------------------------------------------------- |
| 工坊设置     | `config/modloader_config.json` → `workshop` 段     |
| 盗版检测     | `config/modloader_config.json` → `piracyDetection.enabled`（默认 `false`） |
| 本地 Mod 键 | `local:<包名>:<脚本基名>`                               |
| 工坊 Mod 键 | `ws:<fileId>:<脚本基名>`                              |
| 运行时桥接    | `js/mods/_workshop/<fileId>/`（junction，gitignore） |


详见 [使用手册.md](使用手册.md)、[V4.1_unified_package_plan.md](V4.1_unified_package_plan.md)。

---

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

---

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


| 函数                                       | 功能                     | 参数                | 返回值                |
| ---------------------------------------- | ---------------------- | ----------------- | ------------------ |
| `scanMods()`                             | 扫描 mods 目录             | 无                 | 无（更新全局 `_modData`） |
| `buildModFinalParameters(mod)`           | 组装运行时参数                | `mod`: Mod 对象     | `Object` 参数字典      |
| `loadEnabledModsRuntime(mods)`           | 运行时加载已启用 Mod           | `mods`: 可选列表      | `void`             |
| `installPluginManagerHook()`             | 安装 setup Hook          | 无                 | `boolean`          |
| `cleanupLegacyModEntriesFromPluginsJs()` | 清理旧版 plugins.js Mod 条目 | 无                 | `void`             |
| `reassignOrders(modList)`                | 重新分配排序号                | `modList`: Mod 列表 | 重新排序后的列表           |


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


| 函数                             | 功能                            | 参数               | 返回值                             |
| ------------------------------ | ----------------------------- | ---------------- | ------------------------------- |
| `loadLanguageConfigs()`        | 扫描 `config/language/` 加载所有语言包 | 无                | `void`（更新全局 `_languageConfigs`） |
| `getAvailableLanguages()`      | 返回已安装语言代码列表（已排序）              | 无                | `Array<string>` 语言代码数组          |
| `getLanguageDisplayName(code)` | 获取语言在自身语言中的显示名称               | `code`: 语言代码     | `string` 显示名称（如 "English"）      |
| `t(key)`                       | 翻译函数，三重兜底链                    | `key`: 翻译键       | `string` 翻译文本                   |
| `setLanguage(langCode)`        | 切换当前语言并持久化到配置文件               | `langCode`: 语言代码 | `void`                          |
| `getCurrentLanguage()`         | 获取当前语言代码                      | 无                | `string` 语言代码                   |
| `getDbLabel(type)`             | 获取数据库引用类型的翻译标签                | `type`: 数据库类型    | `string` 翻译标签                   |
| `populateLanguageSelect()`     | 填充语言下拉选择框                     | 无                | `void`                          |
| `refreshAllUIText()`           | 统一刷新界面所有文字翻译                  | 无                | `void`                          |


#### 工具函数


| 函数                     | 功能        | 参数             | 返回值       |
| ---------------------- | --------- | -------------- | --------- |
| `isValidColor(color)`  | 验证颜色值     | `color`: 颜色字符串 | `boolean` |
| `isDatabaseType(type)` | 判断是否数据库类型 | `type`: 参数类型   | `boolean` |
| `isNoteType(type)`     | 判断是否长文本类型 | `type`: 参数类型   | `boolean` |
| `escapeHtml(text)`     | HTML 转义   | `text`: 文本     | 转义后的文本    |
| `parseColorTags(text)` | 解析颜色标签    | `text`: 文本     | 带样式的 HTML |


---

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

---

## ✅ 测试规范

### 测试用例

V4.1 起，完整手工测试清单见 **[V4.1_测试文档.md](V4.1_测试文档.md)**（含启动扫描、工坊、本地安装/删除、配置兼容、回归等）。

V3.13~V3.16 阶段的单元级测试项（元数据解析、拖放、多语言等）已并入上述文档或随架构变更失效；发版前以 V4.1 测试文档为准。

### 测试流程

1. **功能测试**：按 [V4.1_测试文档.md](V4.1_测试文档.md) 逐项执行
2. **回归测试**：修改核心模块后重跑相关章节
3. **发版检查**：版本号、`modloader_CHANGELOG.md`、使用手册与测试文档同步

---

## 📅 待办事项

- 暂无

---

**最后更新**: 2026-05-31  
**对应代码版本**: V4.1.1