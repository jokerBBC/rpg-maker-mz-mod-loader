# RMMZ ModLoader

[![License: MIT](https://img.shields.io/github/license/jokerBBC/rpg-maker-mz-mod-loader)](https://github.com/jokerBBC/rpg-maker-mz-mod-loader/blob/main/LICENSE)
[![GitHub release](https://img.shields.io/github/v/release/jokerBBC/rpg-maker-mz-mod-loader)](https://github.com/jokerBBC/rpg-maker-mz-mod-loader/releases/latest)
[![GitHub downloads](https://img.shields.io/github/downloads/jokerBBC/rpg-maker-mz-mod-loader/total)](https://github.com/jokerBBC/rpg-maker-mz-mod-loader/releases)

> **[中文版 README](README.md)**

In-game mod manager **V4.3.0**

A powerful RPG Maker MZ mod manager for **local mods** and **Steam Workshop mods** — toggles, parameters, load order, and dependency checks, all in-game. **Multilingual UI** (Simplified Chinese / Traditional Chinese / English).

> **V4.3.0 manager self-update**: `libs/modLoaderUpdater.js` — manual check/update for ModLoader whitelist files (catalog + raw) under **Settings → Manager update**; separate from Mod store; skip download when sha256 matches; backup with rollback on failure; GitHub / Gitee mirrors. See [User manual · Manager update](js/mods/docs/使用手册.md#28-管理器更新).

> **V4.1.3 prerequisite mods**: **ModDataLoader** (database merge / replace / add, manifest-driven injection) and **ModResourceLoader** (resource replace / add, modId aliases) follow a **ModLoader → prerequisite mod → feature mod** layered design. Game-specific compatibility (encryption, YEP, etc.) is handled via pluggable **GameAdapter** modules. **Partially tested** — see the full docs prerequisite-mod section.

> **Runtime environment**: Mod configuration is saved in `mod_config.json`  
> and is **no longer written** to `plugins.js`, so mod toggles and parameters survive official plugin updates.  
> **Steam Workshop** requires a legitimate Steam install path to resolve Workshop directories (pirated installs cannot subscribe); local mods work normally.  
> **libs extensions**: scripts under `js/mods/libs/` take effect only when they call ModLoader APIs. Piracy detection: ship `piracyGate.js` to enable; delete to disable. Mod store: ship `modStore.js` to enable; delete to disable. Manager self-update: ship `modLoaderUpdater.js` to enable; delete to disable.  

***

## ✨ Real-world examples

- Guide/wiki for the game *Idle Level Up & Fight Monsters* using RMMZ ModLoader V4.1.2 (includes mod manager tutorial · [Feishu link](https://qcnhq5e2tphh.feishu.cn/wiki/XH1jwdX5uil2ookoEF8cpN1AnJf))
- Fine-tuning examples for *Crimson Moon Immortal Journey* based on RMMZ ModLoader V4 ([Baidu Tieba post 1](https://tieba.baidu.com/p/10810499585?fr=personpage) · [Baidu Tieba post 2](https://tieba.baidu.com/p/10813947286?fr=personpage))

***

## ✨ Features

| Feature | Description |
| --- | --- |
| 🎮 **In-game management** | Manage mod toggles, parameters, and load order without external tools |
| 🛒 **Steam Workshop** | Scans `workshop/content/<AppID>/` (AppID configurable); filter, refresh list; unified package layout for local and Workshop mods |
| 🏪 **Mod store extension** | `libs/modStore.js`: multi-source HTTPS catalog subscribe, download/update packages to `_localmods`, resume for large files (>50MB); **multilingual UI**; list **Changelog** button; coexists with Workshop |
| 🔄 **Manager self-update** | `libs/modLoaderUpdater.js`: manual check/update for ModLoader itself (catalog + raw); separate from Mod store; disable toggle; green badge additive |
| 📦 **Unified package layout** | Local `_localmods/<package>/` matches Workshop subscription root (V4.1); package-root `CHANGELOG.md` is the only mod changelog location (V4.2) |
| 📋 **Mod changelogs** | Detail panel link next to version; header **(Changelog)** for ModLoader itself; shared Markdown modal for store / detail / manager |
| ⚙️ **Parameter editor** | number, boolean, string, select, color, note, database refs, struct, table |
| 🔀 **Order & dependencies** | Drag/index reordering; `@base` / `@orderAfter` checks; skips loading when `@base` is missing (dependency guard) |
| ⚠️ **Conflict log panel** | Settings gear menu entry + empty shell panel (content from prerequisite mod `render`); red bang beside gear when conflicts exist |
| 📦 **Prerequisite mods** | ModDataLoader (data) + ModResourceLoader (resources); layered design with GameAdapter per game (partially tested) |
| 📥 **Drag-and-drop install** | Drop `.js` or a `mods/` folder (local mods only) |
| 🖼️ **Preview images** | `preview.png` at package root; thumbnail + full-size popup |
| 🛡️ **Config compatibility** | V4.1.1 reads legacy V3.x `../mods/` keys; one save migrates to new keys |
| 🌐 **Multilingual** | Simplified Chinese / Traditional Chinese / English |
| 🎨 **Dual themes** | Dark / warm |

***

## ✨ UI Screenshots (Dark / Warm themes)

<div align="center">

Main screen — Workshop

![Main UI — Workshop](js/mods/docs/img/主界面-创意工坊.png)

</div>

<div align="center">

Main screen

![Main UI](js/mods/docs/img/主界面.png)

</div>

<div align="center">

Parameter editor

![Parameter editor](js/mods/docs/img/参数界面-一般.png)

</div>

***

## 📖 Full documentation

Complete guides live under **`js/mods/docs/`** (same layout as in-game; relative links work inside those pages):

| Document | Description |
| --- | --- |
| [**Full README (Chinese)**](js/mods/docs/README.md) | Complete Chinese guide (includes prerequisite mods) |
| [**Full README (English)**](js/mods/docs/README-en.md) | Complete English guide |
| [User manual (Chinese)](js/mods/docs/使用手册.md) | Guide for authors, players, mod authors |
| [Prerequisite mod usage spec](js/mods/docs/前置Mod更新日志等/调用规范.md) | Data + resource API for mod authors |
| [ModLoader module map](js/mods/docs/ModLoader_模块结构.md) | Maintainer map: where changes go, how to test, manager boundaries |
| [Prerequisite mod V2 spec](js/mods/docs/前置Mod更新日志等/数据和资源前置Mod-V2-需求规格书.md) | Architecture and API spec |
| [Prerequisite mod test checklist](js/mods/docs/前置Mod更新日志等/前置Mod测试清单.md) | Test checklist (partially complete) |
| [ModLoader dev spec](js/mods/docs/RMMZ_ModLoader_开发规范.md) | Internal development spec |
| [Mod store extension plan](js/mods/docs/mod商店拓展plan.md) | Mod store protocol & design (advanced) |
| [Changelog](js/mods/docs/modloader_CHANGELOG.md) | ModLoader release history |

***

## 📥 Quick install

Inject **before** `main.js` in `index.html`:

```html
<script type="text/javascript" src="js/mods/ModLoader.js"></script>
```

Press **F5** after changing toggles, parameters, or load order. Subscribe/unsubscribe Workshop mods in the **Steam client**.

***

## 📜 License

MIT License — see [LICENSE](LICENSE)

**Version**: V4.3.0 | **Updated**: 2026-08-24
