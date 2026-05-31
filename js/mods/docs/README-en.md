# RMMZ ModLoader

> **[中文版 README](README.md)**

> In-game mod manager **v4.0.0**

A powerful RPG Maker MZ mod manager that lets you enable/disable, edit parameters, reorder, and check dependencies for **local mods** and **Steam Workshop mods** — all from inside the game. **Multilingual UI** is now supported (Simplified Chinese / Traditional Chinese / English).

> **Runtime requirement**: Since V3.16.1, only **Steam legitimate** install paths are supported (preparing for Steam Workshop integration). Mod configuration is saved in `mod_config.json` and is **no longer written** to `plugins.js`, so mod toggles and parameters survive official plugin updates.

***

## ✨ Features

| Feature | Description |
| --- | --- |
| 🎮 **In-game management** | Manage mod toggles, parameters, and load order without external tools |
| 🛒 **Steam Workshop** | Scans `workshop/content/<AppID>/` (AppID configurable); filter, refresh (when enabled); shows “Workshop not enabled for this game” when disabled |
| ⚙️ **Parameter editor** | number, boolean, string, select, color, note, database refs, struct, table |
| 🔀 **Order & dependencies** | Drag/index reordering; `@base` / `@orderAfter` checks (native plugins first, then all mods in the manager) |
| 📦 **Drag-and-drop install** | Drop a `.js` file or entire `mods` folder ( **local mods only** ) |
| ⏸️ **Disable all** | Turn off every enabled mod at once |
| 🛡️ **Safety** | Unsaved-change prompts; full config persisted in `mod_config.json` |
| 🌐 **Multilingual** | Simplified Chinese / Traditional Chinese / English — language packs in `config/language/` |
| ⚙️ **Settings** | ⚙ gear icon: language + dark/warm theme |
| 🎨 **Dual themes** | Dark / warm — preference saved in `modloader_config.json` |
| 📊 **Metadata** | `@version`, `@author`, `@base`, `@orderAfter`, etc. |
| 🏷️ **@text aliases** | Localized parameter display names |
| 📋 **Schema templates** | `@define-schema` + struct/table |

***

## ✨ UI Screenshots (Dark / Warm themes)

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

## 📥 Installation

### Mode 1: Injection (recommended)

Edit `index.html` and inject ModLoader **before** `main.js`:

```html
<body style="background-color: black">
<script type="text/javascript" src="js/libs/pixi.js"></script>
<!-- Inject ModLoader -->
<script type="text/javascript" src="js/mods/ModLoader.js"></script>
<script type="text/javascript" src="js/main.js"></script>
</body>
```

### Mode 2: Plugin mode

Add `ModLoader.js` to the RMMZ Plugin Manager list.

> ⚠️ After changing mod toggles, parameters, or load order, press **F5** to reload the game.  
> ⚠️ Subscribe/unsubscribe Workshop mods in the **Steam client**; the manager only toggles, reorders, and edits parameters.

***

## 🎯 Usage

1. After entering the game, click the **Mod Manager** button in the top-left corner  
2. Filter the list with **All / Local / Workshop**; when Workshop is enabled, click **Refresh Workshop** after subscription changes  
3. Select a mod to view details on the right (source, Workshop subscription, dependencies, parameters, etc.)  
4. Toggle mods; edit parameters where ⚙ is shown; click **Save** when done  
5. Press **F5** to restart the game so toggles and parameters take effect  

**Workshop mods**: Each `.js` file is one row. When `workshop.enabled: false`, the Workshop filter still works but the list shows “Workshop not enabled for this game” and the refresh button is hidden.

### For game authors: Workshop config (`modloader_config.json`)

```json
"workshop": {
  "enabled": true,
  "steamAppId": "YourGameAppID",
  "steamLibraryPath": ""
}
```

- **`enabled`**: `true` scans and loads Workshop mods; `false` keeps the UI entry but does not scan  
- **`steamAppId`**: Must match `steam_appid.txt` and Steamworks (default `4379740` in this repo is a dev/test example only)  
- **`steamLibraryPath`**: Usually leave empty; set library root if Steam is on a non-default drive, e.g. `D:/SteamLibrary`  

After enabling Workshop, set `enabled` to `true` with the correct AppID and **ship it with game updates**. See `docs/V4_workshop_作者规范.md` for details.

***

## 📁 Project structure

```
js/mods/
├── ModLoader.js                    # Mod manager core
├── mod_config.json                 # Mod toggles / params / order (single source of truth)
├── config/
│   ├── modloader.css               # UI styles (dark / warm)
│   ├── modloader_config.json       # Manager config (theme, language, workshop)
│   └── language/                   # Language packs
│       ├── zh_CN.json
│       ├── zh_TW.json
│       └── en.json
├── _workshop/                      # Runtime junction bridge (auto-generated, do not edit)
│   └── <WorkshopFileId>/         # Points to steamapps/workshop/content/<AppID>/...
├── docs/
│   ├── guide/
│   │   ├── img/
│   │   └── README.md               # This guide (in-game copy)
│   ├── modloader_CHANGELOG.md
│   ├── V4_workshop_作者规范.md      # Workshop mod author guide
│   └── RMMZ_ModLoader_开发规范.md
└── [LocalMod].js
```

Steam Workshop package layout (replace `<AppID>` with your game ID; `4379740` in this repo is a dev example):

```
<SteamLibrary>/steamapps/workshop/content/<AppID>/<publishedFileId>/js/mods/*.js
```

***

## 📖 Developer resources

| Resource | Description |
| --- | --- |
| `docs/RMMZ_Mod开发规范.md` | Local mod plugin development guide |
| `docs/V4_workshop_作者规范.md` | **Workshop mod** package layout, config keys, `modloader.json` |
| `docs/RMMZ_ModLoader_开发规范.md` | ModLoader internal development guide |
| `docs/modloader_CHANGELOG.md` | Full changelog |

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
| `@base` | Prerequisite (checks load order and enabled state within the manager) |
| `@orderAfter` | Must load after a given plugin |
| `@define-schema` / `@schema` | struct/table template |

***

## 🆕 Version highlights

### V4.0.0 — Steam Workshop (2026-05-28)

- Scans `steamapps/workshop/content/4379740/<FileId>/`, loads via `js/mods/_workshop/` **directory junction** (no copy, no `plugins.js` writes)
- Config keys: `ws:<FileId>:<scriptName>`; supports multiple `.js` per subscription, each with its own params and dependency checks
- UI: All/Local/Workshop filters, Refresh Workshop, Workshop badge and details (subscription ID & name, source info)
- Workshop mods are read-only: cannot delete or drag-install, **but can be reordered** (under the “All” filter)
- Security: mods are executable scripts — subscribe only from trusted sources; moderation relies on Steam; ModLoader does not provide antivirus/sandboxing

### V3.17.1 — Multilingual & entry button (2026-05-28)

- Removed hardcoded Simplified Chinese fallback table; language packs + `zh_CN` fallback only
- Fixed title-screen entry button flash and related issues

### V3.17.0 — Runtime loading architecture (2026-05-28)

- **No longer writes to `plugins.js`**: toggles/params/order live only in `mod_config.json`
- Hooks `PluginManager.setup` to load mods after official plugins by `order`
- When RMMZ resets `plugins.js` on game update, **mod config is preserved** — no “restore all” needed
- Cleans legacy mod entries from `plugins.js` on startup

### V3.16.1 — Legitimate Steam environment (2026-05-23)

- Added **Steam install path** detection for Workshop integration
- Non-Steam environments show a prompt directing users to Steam or legacy bundle V3.1 (discontinued)
- Workshop and later versions are maintained for Steam legitimate installs only

### V3.16.0 — Multilingual & settings (2026-05-19)

- Multilingual: `config/language/*.json`, ⚙ panel for language and theme
- Lookup chain: current language → `zh_CN` → raw key

<details>
<summary>V3.16.0 multilingual details (expand)</summary>

#### Language pack location

```
js/mods/config/language/
├── zh_CN.json
├── zh_TW.json
└── en.json
```

#### Adding a new language

1. Create a JSON file in `config/language/` (e.g. `ja.json`)
2. Include `_langCode`, `_langName`, and all translation keys
3. Reopen the manager — the new language appears in the dropdown automatically

#### System settings

Click ⚙: language dropdown + dark/warm theme buttons; click outside to close without triggering “unsaved changes” prompts.

</details>

***

## 🆕 V3.13.0 deep dive (struct / @text)

### 1. `@text` parameter alias

```javascript
@param damageMultiplier
@text 伤害倍率
@type number
@default 2
```

In code, still use the English name after `@param`: `params['damageMultiplier']`.

### 2. Schema templates + struct/table

**Define a template** (before `@help`):

```javascript
@define-schema MonsterDropSchema
[{"name":"enemyId","text":"目标怪物","type":"enemy","default":"1"}, ...]
```

**Reference it**:

```javascript
@param dropList
@type table
@schema MonsterDropSchema
```

Values require `JSON.parse()` — see `TestSchemaMod.js` and `mydrop.js`.

***

### 📂 Example mods

| Example | Description |
| --- | --- |
| `TestMod.js` | Basic parameter type tests |
| `TestSchemaMod.js` | struct/table, nesting, @text |
| `mydrop.js` | table-based monster drop config |

Workshop self-test packages: `steamapps/workshop/content/4379740/` (3000000001–4). Author guide: `docs/V4_workshop_作者规范.md`.

***

## 📜 License

MIT License — see `docs/LICENSE`

***

## 📞 Contact

Questions or suggestions? Please open an Issue in this repository.

***

**Version**: v4.0.0 | **Updated**: 2026-05-28
