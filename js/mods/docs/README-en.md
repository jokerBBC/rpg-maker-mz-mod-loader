# RMMZ ModLoader

> **[中文版 README](README.md)**

In-game mod manager **V4.1.3**

A powerful RPG Maker MZ mod manager that lets you enable/disable, edit parameters, reorder, and check dependencies for **local mods** and **Steam Workshop mods** — all from inside the game. **Multilingual UI** is supported (Simplified Chinese / Traditional Chinese / English).

> **V4.1.3 prerequisite mods**: **ModDataLoader** (database merge / replace / add, manifest-driven injection) and **ModResourceLoader** (resource replace / add, modId aliases) follow a **ModLoader → prerequisite mod → feature mod** layered design. Game-specific compatibility (encryption, YEP, etc.) is handled via pluggable **GameAdapter** modules so each title can adapt plugins independently. **Partially tested** — see [Developer resources · Prerequisite mods](#prerequisite-mods-v413--partially-tested) below.

> **Runtime environment**: Mod configuration is saved in `mod_config.json` ,
and is **no longer written** to `plugins.js`, so mod toggles and parameters survive official plugin updates.   
> **Steam Workshop** requires a legitimate Steam install path to resolve Workshop directories.  
> **piracy detection** is off by default — game authors can enable it in `modloader_config.json` as needed.  

***

## ✨ Real-world examples

- Guide/wiki for the game *Idle Level Up & Fight Monsters* using RMMZ ModLoader V4.1.3 (includes mod manager tutorial · [Feishu link](https://qcnhq5e2tphh.feishu.cn/wiki/XH1jwdX5uil2ookoEF8cpN1AnJf))
- Fine-tuning examples for *Crimson Moon Immortal Journey* based on RMMZ ModLoader V4 ([Baidu Tieba post 1](https://tieba.baidu.com/p/10810499585?fr=personpage) · [Baidu Tieba post 2](https://tieba.baidu.com/p/10813947286?fr=personpage))

***

## ✨ Features

| Feature | Description |
| --- | --- |
| 🎮 **In-game management** | Manage mod toggles, parameters, and load order without external tools |
| 🛒 **Steam Workshop** | Scans `workshop/content/<AppID>/` (AppID configurable); filter, refresh; unified package layout for local and Workshop mods |
| 📦 **Unified package layout** | Local `_localmods/<package>/` matches Workshop subscription root layout (V4.1) |
| ⚙️ **Parameter editor** | number, boolean, string, select, color, note, database refs, struct, table |
| 🔀 **Order & dependencies** | Drag/index reordering; `@base` / `@orderAfter` checks; skips loading when `@base` is missing (dependency guard) |
| ⚠️ **Conflict log panel** | Floating ⚠ button (visible while manager is open) + expandable panel showing mod data conflict summary (winner / overridden + localized field names) |
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
│   ├── ModDataLoader/              # Data prerequisite (merge/replace/add)
│   ├── ModResourceLoader/          # Resource prerequisite (replace/add)
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

### Prerequisite mods (V4.1.3 · partially tested)

ModLoader manages only `.js` plugin toggles, load order, and parameters. **Database and asset replace/add** are provided by separate prerequisite mods. Feature mods declare `@base ModDataLoader` / `@base ModResourceLoader`; when porting to another game, you mainly add or remove **GameAdapter** compatibility layers while keeping the core APIs shared.

| Prerequisite mod | Capabilities |
| --- | --- |
| **ModDataLoader** | Field-level merge, full replace, new entries, map event-level shallow merge; zero-code injection via `modloader.json` `data.records` / `data.patches`; stableKey smart ID migration; conflict reports integrated with ModLoader log panel |
| **ModResourceLoader** | Declarative replace via `modloader.json` `resources`; `loadBitmap(modId, path)` for mod-owned images; modId aliases (stable across local / Workshop package names); optional encryption bypass |

Sample packages: `_localmods/TestMDL-V2` (data), `_localmods/TestMRL-V2` (resources).

| Resource | Description |
| --- | --- |
| [使用手册.md](使用手册.md) | Full guide for game authors / players / mod authors |
| [RMMZ_ModLoader_开发规范.md](RMMZ_ModLoader_开发规范.md) | ModLoader internal development spec |
| [调用规范.md](前置Mod更新日志等/调用规范.md) | Prerequisite mod usage spec (data + resources; required for mod authors) |
| [数据和资源前置Mod-V2-需求规格书.md](前置Mod更新日志等/数据和资源前置Mod-V2-需求规格书.md) | Prerequisite mod V2 architecture, API, and MVP spec |
| [ModDataLoader_CHANGELOG.md](前置Mod更新日志等/ModDataLoader_CHANGELOG.md) | ModDataLoader changelog |
| [ModResourceLoader_CHANGELOG.md](前置Mod更新日志等/ModResourceLoader_CHANGELOG.md) | ModResourceLoader changelog |
| [前置Mod测试清单.md](前置Mod更新日志等/前置Mod测试清单.md) | Prerequisite mod test checklist (some cases passed) |
| [V4.1_测试文档.md](V4.1_测试文档.md) | ModLoader V4.1 feature test checklist |
| [V4.1_unified_package_plan.md](V4.1_unified_package_plan.md) | V4.1 implementation plan |
| [modloader_CHANGELOG.md](modloader_CHANGELOG.md) | ModLoader full changelog |

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

**Version**: V4.1.3 | **Updated**: 2026-06-25
