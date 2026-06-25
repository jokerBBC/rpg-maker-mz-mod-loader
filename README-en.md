# RMMZ ModLoader

> **[中文版 README](README.md)**

In-game mod manager **V4.1.3**

A powerful RPG Maker MZ mod manager for **local mods** and **Steam Workshop mods** — toggles, parameters, load order, and dependency checks, all in-game. **Multilingual UI** (Simplified Chinese / Traditional Chinese / English).

> **V4.1.3 prerequisite mods**: **ModDataLoader** (data merge/replace/add) and **ModResourceLoader** (resource replace/add) use a ModLoader → prerequisite mod → feature mod layered design with pluggable **GameAdapter** modules per game. **Partially tested** — see the full docs prerequisite-mod section.

> **Runtime environment**: Mod configuration is saved in `mod_config.json` 
and is **no longer written** to `plugins.js`, so mod toggles and parameters survive official plugin updates.   
> **Steam Workshop** requires a legitimate Steam install path to resolve Workshop directories  
> **piracy detection** is off by default — game authors can enable it in `modloader_config.json` as needed.  

***

## ✨ Real-world examples

- Guide/wiki for the game *Idle Level Up & Fight Monsters* using RMMZ ModLoader V4.1.2 (includes mod manager tutorial · [Feishu link](https://qcnhq5e2tphh.feishu.cn/wiki/XH1jwdX5uil2ookoEF8cpN1AnJf))
- Fine-tuning examples for *Crimson Moon Immortal Journey* based on RMMZ ModLoader V4 ([Baidu Tieba post 1](https://tieba.baidu.com/p/10810499585?fr=personpage) · [Baidu Tieba post 2](https://tieba.baidu.com/p/10813947286?fr=personpage))

***

## ✨ Features

| Feature | Description |
| --- | --- |
| 🎮 **In-game management** | Manage mod toggles, parameters, and load order without external tools |
| 🛒 **Steam Workshop** | Scans `workshop/content/<AppID>/` (AppID configurable); filter, refresh; unified local/Workshop package layout |
| 📦 **Unified package layout** | Local `_localmods/<package>/` matches Workshop subscription root (V4.1) |
| ⚙️ **Parameter editor** | number, boolean, string, select, color, note, database refs, struct, table |
| 🔀 **Order & dependencies** | Drag/index reordering; `@base` / `@orderAfter` checks; skips loading when `@base` is missing |
| ⚠️ **Conflict log panel** | Floating ⚠ button while manager is open; mod data conflict summary |
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
| [Prerequisite mod V2 spec](js/mods/docs/前置Mod更新日志等/数据和资源前置Mod-V2-需求规格书.md) | Architecture and API spec |
| [Prerequisite mod test checklist](js/mods/docs/前置Mod更新日志等/前置Mod测试清单.md) | Test checklist (partially complete) |
| [ModLoader dev spec](js/mods/docs/RMMZ_ModLoader_开发规范.md) | Internal development spec |
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

**Version**: V4.1.3 | **Updated**: 2026-06-25
