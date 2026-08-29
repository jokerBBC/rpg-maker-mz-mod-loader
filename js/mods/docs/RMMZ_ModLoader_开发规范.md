# RMMZ ModLoader 开发规范

> 写代码时遵守的约定与发版流程。  
> **改哪 / 怎么测 / 别往哪塞** → [`ModLoader_模块结构.md`](ModLoader_模块结构.md)

---

## 文档分工

| 文档 | 用途 |
| --- | --- |
| [`ModLoader_模块结构.md`](ModLoader_模块结构.md) | 维护地图：改动归属、测试粒度、管理器边界 |
| [`ModLoader_测试文档.md`](ModLoader_测试文档.md) | 发版前手工测试清单 |
| [`使用手册.md`](使用手册.md) | 玩家 / 作者 / 制作者：路径、工坊、Mod 商店、安装与配置 |
| [`modloader_CHANGELOG.md`](modloader_CHANGELOG.md) | 版本史（权威） |
| [`mod商店拓展.md`](mod商店拓展.md) | Mod 商店设计与测试 |
| [`管理器在线更新plan.md`](管理器在线更新plan.md) | 管理器在线更新（`libs/modLoaderUpdater.js`）设计与待办 |
| [`adr/CONTEXT.md`](adr/CONTEXT.md) | 名词；ADR 记架构决策 |
| [`ModLoader_技术债调查.md`](ModLoader_技术债调查.md) / [`ModLoader_第5波拆分方案.md`](ModLoader_第5波拆分方案.md) | **仅开发仓**；`pathRules` SYNC_EXCLUDE，不进发行仓 / catalog |

本文件不维护模块清单、行号对照或内部函数黄页。

---

## 代码约定

### 命名

| 类型 | 规则 | 示例 |
| --- | --- | --- |
| 常量 | 全大写，下划线分隔 | `MODS_DIR`, `CONFIG_PATH`, `DEBUG_LEVEL` |
| 函数 | 驼峰，动词开头 | `loadConfig()`, `parseModInfo()` |
| 变量 | 驼峰 | `currentParam`, `modConfig` |
| 私有变量 | 下划线前缀 | `_modData`, `_selectedIndex` |
| 全局常量 | 模块开头 | `const ModName = "ModLoader"` |

### 分区与落点

- 大块用 `// ================================================================` 分隔；子块用现有「模块 N / N.M」注释区。
- **新逻辑按 [`ModLoader_模块结构.md`](ModLoader_模块结构.md) 落区**；禁止为图省事塞进随机 UI 函数下面。
- 函数用 JSDoc；行内注释只解释非显而易见的逻辑。

### 风格

- 整文件 IIFE：`ModLoader.js` 用 `(() => { 'use strict'; ... })();`；`libs/` 扩展可用 `(function () { 'use strict'; ... })();`
- 始终分号；`if` / `else` / `for` / `while` 始终花括号
- 关键字、括号、运算符两侧留空格

### 变量声明（`let` / `const` / `var`）

**全项目禁止 `var`**（含 `ModLoader.js`、`libs/`、发版工具脚本等）。默认 `const`；需要重新赋值时用 `let`。

| 范围 | 规则 |
| --- | --- |
| **新写与改动代码** | 一律 `const` / `let`，不得新增 `var` |
| **`libs/`** | 已统一为 `let` / `const` |
| **`ModLoader.js`** | 已统一为 `let` / `const`；**不得新增 `var`** |
| **循环计数器等** | `for (let i = 0; …)`，不用 `for (var i = …)` |

常量配置、模块级路径、不会重绑的引用一律 `const`；仅状态、累加器、需二次赋值的用 `let`。

### 日志

`DEBUG_LEVEL`：`0` 静默 · `1` 错误 · `2` 警告 · `3` 详细。  
前缀统一为 `[ModLoader v${VERSION}]`，按级别走 `console.error` / `warn` / `log`。

---

## 对外 API

稳定面：`window.ModLoader`（含 `version`、`registerLogEntry`、`registerManagerGate` 等）。

- 改签名或语义前：确认前置 Mod / `libs` 依赖方，并在 CHANGELOG 写明。
- 内部函数不对外承诺；勿在文档里维护完整内部 API 表（以代码为准）。
- 扩展放 `libs/` 并走注册接口；业务与冲突详情等边界见模块结构「什么不该进管理器」。
- 已落地扩展（存在即生效、删除即关闭）：`libs/modStore.js`（Mod 商店）、`libs/modLoaderUpdater.js`（管理器在线更新）；均通过 `registerLogEntry` 挂设置入口，不往 `ModLoader.js` 塞 UI/下载管线。

---

## 版本与发版

### 版本号

语义化 `Vx.y.z`：

| 级别 | 含义 |
| --- | --- |
| **x** | 架构变化、核心能力新增、侵入点变更 |
| **y** | 非破坏性功能、UI 调整 |
| **z** | Bug 修复、文案/注释 |

版本号以 `ModLoader.js` 的 `VERSION` 与 [`modloader_CHANGELOG.md`](modloader_CHANGELOG.md) 为准。

### 更新日志

记入 `docs/modloader_CHANGELOG.md`，照现有条目风格，例如：

```markdown
## Vx.y.z (YYYY-MM-DD)

### 功能新增
- **新增**：…

### 优化改进
- **优化**：…

### Bug 修复
- **修复**：…
```

### 发版检查

1.  bump `VERSION`，写好 CHANGELOG  
2. 按需同步使用手册 / README  
3. 按 [`ModLoader_测试文档.md`](ModLoader_测试文档.md) 抽测相关章节（如新功能对应 §O / §P 等）  
4. 改到纯逻辑时，优先按模块结构补/跑自动测，再进游戏抽查 UI  
