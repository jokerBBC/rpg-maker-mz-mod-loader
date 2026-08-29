# RMMZ ModLoader

[![License: MIT](https://img.shields.io/github/license/jokerBBC/rpg-maker-mz-mod-loader)](https://github.com/jokerBBC/rpg-maker-mz-mod-loader/blob/main/LICENSE)
[![GitHub release](https://img.shields.io/github/v/release/jokerBBC/rpg-maker-mz-mod-loader)](https://github.com/jokerBBC/rpg-maker-mz-mod-loader/releases/latest)
[![GitHub downloads](https://img.shields.io/github/downloads/jokerBBC/rpg-maker-mz-mod-loader/total)](https://github.com/jokerBBC/rpg-maker-mz-mod-loader/releases)

> **[English README](README-en.md)**

游戏内模组管理器 **V4.4.6**

一款功能强大的 RPG Maker MZ 模组管理器，支持在游戏内管理 **本地 Mod** 与 **Steam 创意工坊 Mod** 的开启/关闭、参数编辑、排序与依赖检测。**现已支持多语言界面**（简体中文 / 繁體中文 / English）。

> **运行环境**：RPG Maker MZ（NW.js）  
> **Mod 配置**：保存在 `mod_config.json`，游戏更新后 Mod 开关与参数也不会丢失  
> **创意工坊**：需 Steam 正版安装路径才能解析工坊目录  

***

## ✨ 实际运用案例

- 使用 RMMZ ModLoader V4.1.2 做 Mod 的游戏「挂机升级打怪兽」攻略站（含 Mod 管理器使用教程 · [飞书链接](https://qcnhq5e2tphh.feishu.cn/wiki/XH1jwdX5uil2ookoEF8cpN1AnJf)）
- 基于 RMMZ ModLoader V4 的「绯月仙行录」游戏微调版运用实例（[百度贴吧 1](https://tieba.baidu.com/p/10810499585?fr=personpage) · [百度贴吧 2](https://tieba.baidu.com/p/10813947286?fr=personpage)）

## ✨ 功能特性

| 功能 | 描述 |
| --- | --- |
| 🎮 **游戏内管理** | 无需额外程序，直接在游戏中管理 Mod 开关、参数与排序 |
| 🛒 **Steam 创意工坊** | 扫描 `workshop/content/<AppID>/`（AppID 可配置）；筛选、刷新列表；本地与工坊统一包结构 |
| 🏪 **Mod 商店拓展** | `libs/modStore.js`：多源 HTTPS catalog 订阅、下载/更新整包到 `_localmods`、断点续传（>50MB）；**UI 多语言**（简中 / 繁中 / English）；列表「更新日志」按钮 |
| 🔄 **管理器在线更新** | `libs/modLoaderUpdater.js`：设置内手动检查/更新 ModLoader 本体（catalog + raw 单文件）；与 Mod 商店分离；禁用开关；绿色角标加算 |
| 💾 **配置预设** | `libs/modConfigPresets.js`：设置内保存当前 Mod 开关/参数/顺序为具名预设，预览差异后一键应用（可仅预览或立刻保存）；文件在 `config/mod_presets/` |
| 📦 **统一包结构** | 本地 `_localmods/<包名>/` 与工坊订阅包根目录布局一致（V4.1）；包根 `CHANGELOG.md` 为 Mod 更新日志唯一位置（V4.2） |
| 📋 **Mod 更新日志** | 管理器详情版本旁「更新日志」；头部「(日志)」为管理器自身日志；商店 / 详情 / 管理器共用 Markdown 弹窗 |
| ⚙️ **参数编辑** | 数值、开关、文本、单选、颜色、长文本、数据库引用、struct、table |
| 🔀 **排序与依赖** | 拖拽/序号排序；`@base` / `@orderAfter` 依赖检测；缺失 `@base` 时自动跳过加载（依赖守卫） |
| ⚠️ **脚本同名冲突** | 与游戏插件或多 Mod 脚本基名重复时列表/详情提示；开启无效项时确认（V4.4.2） |
| ⚠️ **冲突日志面板** | 设置齿轮菜单底部入口 + 管理器内空壳面板（内容由前置 Mod `render`）；有冲突时齿轮旁红叹号 |
| 📥 **拖放 / 浏览安装** | 拖放或浏览 `.js`；拖放 / 浏览整个 `mods` 文件夹（仅本地 Mod；V4.4.1 统一管线） |
| 🖼️ **预览图** | 包根 `preview.png`；详情缩略 + 点击弹窗大图 |
| 🛡️ **配置兼容** | V4.1.1 读取 V3.x `../mods/` 旧键；保存一次自动升级为新键 |
| 🌐 **多语言** | 简体中文 / 繁體中文 / English |
| 🎨 **双主题** | 暗黑 / 暖色 |

***

## ✨ UI 截图（暗黑/暖色双主题）

<div align="center">

主界面-创意工坊

![软件主界面](img/主界面-创意工坊.png)

</div>

<div align="center">

主界面

![软件主界面](img/主界面.png)

</div>

<div align="center">

参数编辑界面

![软件主界面](img/参数界面-一般.png)

</div>

<div align="center">

参数编辑界面-多层套娃

![软件主界面](img/参数界面-多级套娃.png)

</div>

<div align="center">

参数编辑界面-表格

![软件主界面](img/参数界面-表格.png)

</div>

<div align="center">

安装界面

![软件主界面](img/安装.png)

</div>

<div align="center">

删除模式和排序模式

![软件主界面](img/排序与删除.png)

</div>

***

## 📥 安装方式

### 模式 1：注入模式（推荐）

修改 `index.html`，在 `main.js` 之前注入 ModLoader：

```html
<body style="background-color: black">
<script type="text/javascript" src="js/libs/pixi.js"></script>
<script type="text/javascript" src="js/mods/ModLoader.js"></script>
<script type="text/javascript" src="js/main.js"></script>
</body>
```

### 模式 2：插件模式

在 RMMZ 插件管理器中将 `ModLoader.js` 添加到插件列表。

> ⚠️ 修改 Mod 开关、参数或排序后，需要 **F5 刷新** 才能生效。  
> ⚠️ 创意工坊 Mod 请在 **Steam 客户端** 订阅/取消订阅。

***

## 📁 项目结构（V4.4）

```
js/mods/
├── ModLoader.js                    # 主入口：启动、界面、编排、对外 API
├── mod_config.json                 # Mod 开关 / 参数 / 顺序（运行时生成）
├── config/
│   ├── modloader.css
│   ├── modloader_config.json       # 管理器偏好（语言、主题、工坊等）
│   ├── mod_store.json              # Mod 商店订阅（有 modStore.js 时）
│   ├── modloader_updater.json      # 管理器更新偏好（有 modLoaderUpdater.js 时）
│   ├── mod_presets/                # 配置预设（有 modConfigPresets.js 时）
│   └── language/                   # 管理器 UI 多语言（zh_CN / zh_TW / en）
├── modloader/                      # 管理器纯逻辑（配置、扫描、安装、参数、依赖等）
├── _localmods/                     # 本地 Mod 包
│   ├── ModDataLoader/              # 数据前置（merge/replace/add）
│   ├── ModResourceLoader/          # 资源前置（替换/新增）
│   └── <包名>/
│       ├── <脚本>.js
│       ├── CHANGELOG.md            # 可选；Mod 更新日志
│       ├── preview.png             # 可选
│       └── modloader.json          # 可选（多脚本必填 version）
├── _workshop/<fileId>/             # 工坊 junction（自动生成）
├── docs/
│   ├── README.md / README-en.md
│   ├── 使用手册.md
│   ├── ModLoader_模块结构.md
│   ├── modloader_CHANGELOG.md
│   ├── mod商店拓展.md
│   └── 前置Mod相关文档/
│       └── 调用规范.md
├── libs/                           # 依赖库 + 可选扩展（存在即生效，删除即关闭）
│   ├── marked.min.js               # Markdown 渲染
│   ├── modStore.js                 # Mod 商店
│   ├── modLoaderUpdater.js         # 管理器在线更新
│   ├── modConfigPresets.js         # 配置预设
│   └── piracyGate.js               # 盗版检测闸门
└── tools/
    └── modstore/
        └── gui/                    # 作者打包 GUI（见 gui/README.md）
```

Steam 工坊订阅包（与 `_localmods` 同布局，脚本在包根）：

```
<Steam库>/steamapps/workshop/content/<AppID>/<publishedFileId>/
  modloader.json
  preview.png
  YourMod.js
```

***

## 📖 开发资源

### 前置 Mod

ModLoader 仅管理 `.js` 插件的开关、排序与参数；**数据库与游戏资源的替换 / 新增**由独立前置 Mod 承担。功能 Mod 通过 `@base ModDataLoader` / `@base ModResourceLoader` 声明依赖；换游戏时主要增删 **GameAdapter** 兼容层，核心 API 保持通用。

| 前置 Mod | 能力概要 |
| --- | --- |
| **ModDataLoader** | 字段级 merge、整条 replace、新增条目、地图 event 级浅合并；`modloader.json` 的 `data.records` / `data.patches` 零代码注入；stableKey 智能 ID 迁移；冲突报告对接 ModLoader 日志面板 |
| **ModResourceLoader** | `modloader.json` 的 `resources` 声明式替换；`loadBitmap(modId, path)` 加载 Mod 自带图片；modId 别名（本地 / 工坊包名变化时仍可用）；可选加密绕过 |

示例包：`_localmods/TestMDL-V2`（数据）、`_localmods/TestMRL-V2`（资源）。

**更新日志**：ModDataLoader、ModResourceLoader 与各功能 Mod 相同，维护于包根 `CHANGELOG.md`（如 `_localmods/ModDataLoader/CHANGELOG.md`），便于管理器详情展示与 Mod 商店在线更新。

| 资源 | 说明 |
| --- | --- |
| [使用手册.md](使用手册.md) | 游戏制作者 / 玩家 / Mod 作者完整指南 |
| [ModLoader_模块结构.md](ModLoader_模块结构.md) | 维护地图：改动归属、怎么测、管理器边界 |
| [调用规范.md](前置Mod相关文档/调用规范.md) | 前置 Mod 调用规范（数据 + 资源） |
| [modloader_CHANGELOG.md](modloader_CHANGELOG.md) | ModLoader 更新日志 |
| [mod商店拓展.md](mod商店拓展.md) | Mod 商店设计与测试 |
| [tools/modstore/gui/README.md](../tools/modstore/gui/README.md) | 作者打包 GUI 与 catalog 发布 |

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
| `actor` | 数据库引用 · 角色 | `@default 1` |
| `class` | 数据库引用 · 职业 | `@default 1` |
| `skill` | 数据库引用 · 技能 | `@default 1` |
| `item` | 数据库引用 · 物品 | `@default 1` |
| `weapon` | 数据库引用 · 武器 | `@default 1` |
| `armor` | 数据库引用 · 防具 | `@default 1` |
| `enemy` | 数据库引用 · 敌人 | `@default 1` |
| `troop` | 数据库引用 · 敌群 | `@default 1` |
| `state` | 数据库引用 · 状态 | `@default 1` |
| `animation` | 数据库引用 · 动画 | `@default 1` |
| `common_event` | 数据库引用 · 公共事件 | `@default 1` |
| `switch` | 数据库引用 · 开关 | `@default 1` |
| `variable` | 数据库引用 · 变量 | `@default 1` |
| `struct` | 结构体 | `@schema SchemaName` |
| `table` | 表格列表 | `@schema SchemaName` |

### 常用元数据标签

| 标签 | 说明 |
| --- | --- |
| `@text` | 参数界面显示名 |
| `@base` | 前置依赖 |
| `@orderAfter` | 应排在某插件之后 |
| `@orderBefore` | 应排在某插件之前 |
| `@define-schema` / `@schema` | struct/table 模板 |

详细规范与示例 Mod 见 [使用手册 · Mod 作者](使用手册.md#三mod-作者)。

### 功能详解（struct / @text）

#### 一、`@text` 参数别名

```javascript
@param damageMultiplier
@text 伤害倍率
@type number
@default 2
```

#### 二、Schema 模板 + struct/table

```javascript
@define-schema MonsterDropSchema
[{"name":"enemyId","text":"目标怪物","type":"enemy","default":"1"}, ...]

@param dropList
@type table
@schema MonsterDropSchema
```

读取时需 `JSON.parse()`，可参考 `TestSchemaMod.js`、`mydrop.js`。

***

## 📜 开源协议

MIT License — 详见 [LICENSE](LICENSE)

***

**版本**: V4.4.6 | **更新日期**: 2026-08-29
