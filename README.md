# RMMZ ModLoader

> **[English README](README-en.md)**

> 游戏内模组管理器 **v4.0.0**

一款功能强大的 RPG Maker MZ 模组管理器，支持在游戏内管理 **本地 Mod** 与 **Steam 创意工坊 Mod** 的开启/关闭、参数编辑、排序与依赖检测。**现已支持多语言界面**（简体中文 / 繁體中文 / English）。

> **运行环境**：V3.16.1 起仅支持 **Steam 正版** 安装路径（为接入创意工坊做准备）。Mod 配置保存在 `mod_config.json`，**不再写入** `plugins.js`，游戏更新官方插件后 Mod 开关与参数不会丢失。

***

## ✨ 功能特性

| 功能 | 描述 |
| --- | --- |
| 🎮 **游戏内管理** | 无需额外程序，直接在游戏中管理 Mod 开关、参数与排序 |
| 🛒 **Steam 创意工坊** | 扫描 `workshop/content/<AppID>/`（AppID 可配置）；筛选、刷新（仅开启时）；未开启时提示「游戏未开启创意工坊功能」 |
| ⚙️ **参数编辑** | 数值、开关、文本、单选、颜色、长文本、数据库引用、struct、table |
| 🔀 **排序与依赖** | 拖拽/序号排序；`@base` / `@orderAfter` 依赖检测（先查游戏原生插件，再查管理器内全部 Mod） |
| 📦 **拖放安装** | 拖放 `.js` 或整个 `mods` 文件夹（仅**本地** Mod） |
| ⏸️ **一键全关** | 一次性关闭所有已开启 Mod |
| 🛡️ **安全保护** | 未保存修改提示；配置全量写入 `mod_config.json` |
| 🌐 **多语言** | 简体中文 / 繁體中文 / English，语言包位于 `config/language/` |
| ⚙️ **系统设置** | ⚙ 齿轮：语言 + 暗黑/暖色主题 |
| 🎨 **双主题** | 暗黑 / 暖色，偏好写入 `modloader_config.json` |
| 📊 **元数据** | `@version`、`@author`、`@base`、`@orderAfter` 等 |
| 🏷️ **@text 别名** | 参数中文显示名 |
| 📋 **Schema 模板** | `@define-schema` + struct/table |

***

## ✨ UI截图（暗黑/暖暖双主题色）

<div align="center">

主界面

![软件主界面](js/mods/docs/img/主界面.png)

</div>

<div align="center">

参数编辑界面

![软件主界面](js/mods/docs/img/参数界面-一般.png)

</div>

<div align="center">

参数编辑界面-多层套娃

![软件主界面](js/mods/docs/img/参数界面-多级套娃.png)

</div>

<div align="center">

参数编辑界面-表格

![软件主界面](js/mods/docs/img/参数界面-表格.png)

</div>

<div align="center">

安装界面

![软件主界面](js/mods/docs/img/安装.png)

</div>

<div align="center">

删除模式和排序模式

![软件主界面](img/排序与删除.png)

</div>

***

## 📥 安装方式

### 模式1：注入模式（推荐）

修改 `index.html`，在 `main.js` 之前注入 ModLoader：

```html
<body style="background-color: black">
<script type="text/javascript" src="js/libs/pixi.js"></script>
<!-- 注入 ModLoader -->
<script type="text/javascript" src="js/mods/ModLoader.js"></script>
<script type="text/javascript" src="js/main.js"></script>
</body>
```

### 模式2：插件模式

在 RMMZ 插件管理器中将 `ModLoader.js` 添加到插件列表。

> ⚠️ 两种使用模式，修改 Mod 开关、参数或排序后，都需要 **F5 刷新** 才能生效。  （RMMZ原生特性）
> ⚠️ 创意工坊 Mod 请在 **Steam 客户端** 订阅/取消订阅；管理器内仅开关、排序与改参。

***

## 🎯 使用说明

1. 进入游戏后，点击屏幕左上角的 **模组管理器** 按钮  
2. 使用 **全部 / 本地 / 创意工坊** 筛选列表；工坊已开启时，订阅变更后可点 **刷新工坊**  
3. 选中 Mod，右侧查看详情（来源、工坊订阅、依赖、参数等）  
4. 开关 Mod；有 ⚙ 的可编辑参数；改完点 **保存**  
5. **F5** 重启游戏使开关与参数生效  

**工坊 Mod 说明**：列表中每个 `.js` 占一行；`workshop.enabled: false` 时「创意工坊」筛选仍可用，列表提示「游戏未开启创意工坊功能」，且不显示刷新按钮。

### 游戏作者：工坊配置（`modloader_config.json`）

```json
"workshop": {
  "enabled": true,
  "steamAppId": "你的游戏AppID",
  "steamLibraryPath": ""
}
```

- **`enabled`**：`true` 扫描并加载工坊 Mod；`false` 仅保留 UI 入口，不扫描  
- **`steamAppId`**：须与 `steam_appid.txt`、Steamworks 一致（代码默认 `4379740` 仅为本仓库联调示例）  
- **`steamLibraryPath`**：一般留空；Steam 非默认库盘时填库根，如 `D:/SteamLibrary`  

工坊开通后，将 `enabled` 设为 `true` 并填入正确 AppID，**随游戏更新推送**给玩家即可。详见 `docs/V4_workshop_作者规范.md`。

***

## 📁 项目结构

```
js/mods/
├── ModLoader.js                    # Mod 管理器主文件
├── mod_config.json                 # Mod 开关 / 参数 / 排序（唯一配置源）
├── config/
│   ├── modloader.css               # UI 样式（暗黑/暖色）
│   ├── modloader_config.json       # 管理器配置（主题、语言、workshop）
│   └── language/                   # 多语言包
│       ├── zh_CN.json
│       ├── zh_TW.json
│       └── en.json
├── _workshop/                      # 运行时 junction 桥接（自动生成，勿手改）
│   └── <工坊FileId>/             # 指向 steamapps/workshop/content/<AppID>/...
├── docs/
│   ├── guide/
│   │   ├── img/
│   │   └── README.md               # 本说明
│   ├── modloader_CHANGELOG.md
│   ├── V4_workshop_作者规范.md      # 工坊 Mod 作者规范
│   └── RMMZ_ModLoader_开发规范.md
└── [本地Mod].js
```

Steam 工坊包目录（`<AppID>` 换为你的游戏 ID；本仓库联调示例为 `4379740`）：

```
<Steam库>/steamapps/workshop/content/<AppID>/<publishedFileId>/js/mods/*.js
```

***

## 📖 开发资源

| 资源 | 说明 |
| --- | --- |
| `docs/RMMZ_Mod开发规范.md` | 本地 Mod 插件开发规范 |
| `docs/V4_workshop_作者规范.md` | **创意工坊 Mod** 包结构、配置键、`modloader.json` |
| `docs/RMMZ_ModLoader_开发规范.md` | ModLoader 自身开发规范 |
| `docs/modloader_CHANGELOG.md` | 完整更新日志 |

***

## 📝 支持的参数类型

| 类型 | 说明 | 示例 |
| --- | --- | --- |
| `number` | 数值（支持滑动条） | `@min 0 @max 100 @step 1` |
| `boolean` | 开关 | `@default true` |
| `string` | 文本 | `@default Hello` |
| `select` | 单选下拉 | `@option A @option B` |
| `color` | 颜色 | `@default #ff0000` |
| `note` / `multiline_string` | 长文本 | 多行编辑 |
| `actor/skill/item/...` | 数据库引用 | 下拉选择 |
| `struct` | 结构体 | `@schema SchemaName` |
| `table` | 表格列表 | `@schema SchemaName` |

### 常用元数据标签

| 标签 | 说明 |
| --- | --- |
| `@text` | 参数界面显示名 |
| `@base` | 前置依赖（管理器内检测顺序与是否开启） |
| `@orderAfter` | 应排在某插件之后 |
| `@define-schema` / `@schema` | struct/table 模板 |

***

## 🆕 版本更新摘要

### V4.0.0 — Steam 创意工坊（2026-05-28）

- 扫描 `steamapps/workshop/content/4379740/<FileId>/`，经 `js/mods/_workshop/` **目录联接** 供游戏加载（不复制、不写 `plugins.js`）
- 配置键：`ws:<FileId>:<脚本名>`；支持同订阅多 `.js`、各自参数与依赖检测
- UI：全部/本地/创意工坊筛选、刷新工坊、工坊角标与详情（订阅 ID & 名称、来源说明）
- 工坊 Mod 只读：不可删除、不可拖放安装，**可排序**（需在「全部」筛选下）
- 安全：Mod 为可执行脚本，请只订阅信任来源；审核与举报依赖 Steam，ModLoader 不提供杀毒/沙箱

### V3.17.1 — 多语言与入口（2026-05-28）

- 移除硬编码简中兜底表，仅语言包 + `zh_CN` 回退
- 修复标题入口按钮闪现等问题

### V3.17.0 — 运行时加载架构（2026-05-28）

- **不再写入 `plugins.js`**：开关/参数/排序仅存 `mod_config.json`
- 通过 `PluginManager.setup` Hook 在官方插件之后按 `order` 加载 Mod
- 游戏更新导致 `plugins.js` 被 RMMZ 重置时，**Mod 配置不再失效**，无需再进管理器「一键恢复」
- 启动时自动清理旧版写入 `plugins.js` 的 Mod 条目

### V3.16.1 — 正版环境（2026-05-23）

- 为接入 Steam 创意工坊，增加 **Steam 安装路径** 检测
- 非正版环境启动时提示，引导使用 Steam 正版或旧版整合包（V3.1，已停更）
- 后续版本（含工坊）仅在 Steam 正版环境下维护

### V3.16.0 — 多语言与系统设置（2026-05-19）

- 多语言：`config/language/*.json`，⚙ 设置面板切换语言与主题
- 语言查找链：当前语言 → `zh_CN` → key 原文

<details>
<summary>V3.16.0 多语言详细说明（展开）</summary>

#### 语言包位置

```
js/mods/config/language/
├── zh_CN.json
├── zh_TW.json
└── en.json
```

#### 添加新语言

1. 在 `config/language/` 新建 JSON（如 `ja.json`）
2. 包含 `_langCode`、`_langName` 及全部翻译键
3. 重开管理器，下拉列表自动出现

#### 系统设置

点击 ⚙：语言下拉 + 暗黑/暖色主题按钮；点击外部关闭，不触发「未保存」提示。

</details>

***

## 🆕 V3.13.0 新功能详解（struct / @text）

### 一、`@text` 参数别名

```javascript
@param damageMultiplier
@text 伤害倍率
@type number
@default 2
```

代码中仍用 `@param` 后的英文名：`params['damageMultiplier']`。

### 二、Schema 模板 + struct/table

**定义模板**（写在 `@help` 之前）：

```javascript
@define-schema MonsterDropSchema
[{"name":"enemyId","text":"目标怪物","type":"enemy","default":"1"}, ...]
```

**引用**：

```javascript
@param dropList
@type table
@schema MonsterDropSchema
```

读取时需 `JSON.parse()`，可参考 `TestSchemaMod.js`、`mydrop.js`。

***

### 📂 参考示例 Mod

| 示例 | 说明 |
| --- | --- |
| `TestMod.js` | 基础参数类型测试 |
| `TestSchemaMod.js` | struct/table、嵌套、@text |
| `mydrop.js` | table 配置怪物掉落 |

工坊自测包见 `steamapps/workshop/content/4379740/`（3000000001~4），规范见 `docs/V4_workshop_作者规范.md`。

***

## 📜 开源协议

MIT License — 详见 `docs/LICENSE`

***

## 📞 联系方式

如有问题或建议，请在项目中提交 Issue。

***

**版本**: v4.0.0 | **更新日期**: 2026-05-28
