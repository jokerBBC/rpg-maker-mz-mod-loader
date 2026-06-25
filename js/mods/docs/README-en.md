# RMMZ ModLoader

> **[中文版 README](README.md)**

In-game mod manager **V4.1.2**

A powerful RPG Maker MZ mod manager that lets you enable/disable, edit parameters, reorder, and check dependencies for **local mods** and **Steam Workshop mods** — all from inside the game. **Multilingual UI** is supported (Simplified Chinese / Traditional Chinese / English).

> **Runtime requirement**: Since V3.16.1, only **Steam legitimate** install paths are supported (preparing for Steam Workshop integration). Mod configuration is saved in `mod_config.json` and is **no longer written** to `plugins.js`, so mod toggles and parameters survive official plugin updates.

***

## ✨ Features

| Feature | Description |
| --- | --- |
| 🎮 **In-game management** | Manage mod toggles, parameters, and load order without external tools |
| 🛒 **Steam Workshop** | Scans `workshop/content/<AppID>/` (AppID configurable); filter, refresh; unified package layout for local and Workshop mods |
| 📦 **Unified package layout** | Local `_localmods/<package>/` matches Workshop subscription root layout (V4.1) |
| ⚙️ **Parameter editor** | number, boolean, string, select, color, note, database refs, struct, table |
| 🔀 **Order & dependencies** | Drag/index reordering; `@base` / `@orderAfter` checks |
| 📥 **Drag-and-drop install** | Drop a `.js` file or entire `mods` folder (local mods only) |
| 🖼️ **Preview images** | `preview.png` at package root; thumbnail in details + click for full-size popup |
| 🛡️ **Config compatibility** | V4.1.1 reads legacy V3.x `../mods/` keys; saving once auto-migrates to new keys |
| 🌐 **Multilingual** | Simplified Chinese / Traditional Chinese / English |
| 🎨 **Dual themes** | Dark / warm |

***

## ✨ UI Screenshots (Dark / Warm themes)

<div align="center">

Main screen — Workshop

![Main UI — Workshop](img/主界面-创意工坊.png)

</div>

<div align="center">

Main screen

![Main UI](img/主界面.png)

</div>

<div align="center">

Parameter editor

![Parameter editor](img/参数界面-一般.png)

</div>

<div align="center">

Parameter editor — nested struct

![Nested struct editor](img/参数界面-多级套娃.png)

</div>

<div align="center">

Parameter editor — table

![Table editor](img/参数界面-表格.png)

</div>

<div align="center">

Install screen

![Install screen](img/安装.png)

</div>

<div align="center">

Delete mode & sort mode

![Delete and sort modes](img/排序与删除.png)

</div>

***

## User manual

[使用手册.md](使用手册.md) (Chinese — full guide for players, game authors, and mod authors)

***

## 📥 Installation

### Mode 1: Injection (recommended)

Edit `index.html` and inject ModLoader **before** `main.js`:

```html
<body style="background-color: black">
<script type="text/javascript" src="js/libs/pixi.js"></script>
<script type="text/javascript" src="js/mods/ModLoader.js"></script>
<script type="text/javascript" src="js/main.js"></script>
</body>
```

### Mode 2: Plugin mode

Add `ModLoader.js` to the RMMZ Plugin Manager list.

> ⚠️ After changing mod toggles, parameters, or load order, press **F5** to reload the game.  
> ⚠️ Subscribe/unsubscribe Workshop mods in the **Steam client**.

***

## 📁 Project structure (V4.1)

```
js/mods/
├── ModLoader.js
├── mod_config.json
├── config/
│   ├── modloader.css
│   ├── modloader_config.json
│   └── language/
├── _localmods/                     # Local mod packages
│   └── <package>/
│       ├── <script>.js
│       ├── preview.png             # optional
│       └── modloader.json          # optional (multi-script)
├── _workshop/<fileId>/             # Workshop junction (auto-generated)
├── docs/
│   ├── README.md                   # This guide
│   ├── 使用手册.md
│   ├── V4.1_测试文档.md
│   └── modloader_CHANGELOG.md
└── config/ docs/ libs/ tools/ …    # Shared assets, not scanned as mods
```

Steam Workshop subscription package (same layout as `_localmods`, scripts at package root):

```
<SteamLibrary>/steamapps/workshop/content/<AppID>/<publishedFileId>/
  modloader.json
  preview.png
  YourMod.js
```

***

## 📖 Developer resources

| Resource | Description |
| --- | --- |
| [使用手册.md](使用手册.md) | Full guide for game authors / players / mod authors |
| [RMMZ_ModLoader_开发规范.md](RMMZ_ModLoader_开发规范.md) | ModLoader internal development spec |
| [V4.1_测试文档.md](V4.1_测试文档.md) | V4.1 feature test checklist |
| [V4.1_unified_package_plan.md](V4.1_unified_package_plan.md) | V4.1 implementation plan |
| [modloader_CHANGELOG.md](modloader_CHANGELOG.md) | Full changelog |

***

## 📝 Supported parameter types

| Type | Description | Example |
| --- | --- | --- |
| `number` | Numeric (slider supported) | `@min 0 @max 100 @step 1` |
| `boolean` | Toggle | `@default true` |
| `string` | Text | `@default Hello` |
| `select` | Single-select dropdown | `@option A @option B` |
| `color` | Color | `@default #ff0000` |
| `note` / `multiline_string` | Long text | Multi-line editor |
| `actor/skill/item/...` | Database reference | Dropdown picker |
| `struct` | Struct | `@schema SchemaName` |
| `table` | Table list | `@schema SchemaName` |

### Common metadata tags

| Tag | Description |
| --- | --- |
| `@text` | Display name in the parameter UI |
| `@base` | Prerequisite dependency |
| `@orderAfter` | Must load after a given plugin |
| `@define-schema` / `@schema` | struct/table template |

See [User manual · Mod authors](使用手册.md#三mod-作者) for full spec and example mods.

### Feature details (struct / @text)

#### 1. `@text` parameter alias

```javascript
@param damageMultiplier
@text 伤害倍率
@type number
@default 2
```

#### 2. Schema templates + struct/table

```javascript
@define-schema MonsterDropSchema
[{"name":"enemyId","text":"目标怪物","type":"enemy","default":"1"}, ...]

@param dropList
@type table
@schema MonsterDropSchema
```

Values require `JSON.parse()` — see `TestSchemaMod.js` and `mydrop.js`.

***

## 📜 License

MIT License — see [LICENSE](LICENSE)

***

**Version**: V4.1.2 | **Updated**: 2026-06-25
