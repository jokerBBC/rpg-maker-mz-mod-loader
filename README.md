# RMMZ ModLoader

> **[English README](README-en.md)**

游戏内模组管理器 **V4.1.2**

一款功能强大的 RPG Maker MZ 模组管理器，支持在游戏内管理 **本地 Mod** 与 **Steam 创意工坊 Mod** 的开启/关闭、参数编辑、排序与依赖检测。**现已支持多语言界面**（简体中文 / 繁體中文 / English）。

> **运行环境**：Mod 配置保存在 `mod_config.json`  
> **不再写入**： `plugins.js`，游戏更新官方插件后 Mod 开关与参数不会丢失。  
> **创意工坊**：需 Steam 正版安装路径才能解析工坊目录（毕竟盗版都没法订阅），本地mod正常使用。  
> **盗版环境检测**：默认关闭，游戏作者可在 `modloader_config.json` 中按需开启。  

---

## ✨ 实际运用案例

- 使用 RMMZ ModLoader V4.1.2 做 Mod 的游戏「挂机升级打怪兽」攻略站（含 Mod 管理器使用教程 · [飞书链接](https://qcnhq5e2tphh.feishu.cn/wiki/XH1jwdX5uil2ookoEF8cpN1AnJf)）
- 基于 RMMZ ModLoader V4 的「绯月仙行录」游戏微调版运用实例（[百度贴吧 1](https://tieba.baidu.com/p/10810499585?fr=personpage) · [百度贴吧 2](https://tieba.baidu.com/p/10813947286?fr=personpage)）

## ✨ 功能特性


| 功能                | 描述                                              |
| ----------------- | ----------------------------------------------- |
| 🎮 **游戏内管理**      | 无需额外程序，直接在游戏中管理 Mod 开关、参数与排序                    |
| 🛒 **Steam 创意工坊** | 扫描 `workshop/content/<AppID>/`（AppID 可配置）；筛选、刷新；本地与工坊统一包结构 |
| 📦 **统一包结构**      | 本地 `_localmods/<包名>/` 与工坊订阅包根目录布局一致（V4.1）       |
| ⚙️ **参数编辑**       | 数值、开关、文本、单选、颜色、长文本、数据库引用、struct、table           |
| 🔀 **排序与依赖**      | 拖拽/序号排序；`@base` / `@orderAfter` 依赖检测            |
| 📥 **拖放安装**       | 拖放 `.js` 或整个 `mods` 文件夹（仅本地 Mod）                |
| 🖼️ **预览图**       | 包根 `preview.png`；详情缩略 + 点击弹窗大图                  |
| 🛡️ **配置兼容**      | V4.1.1 读取 V3.x `../mods/` 旧键；保存一次自动升级为新键         |
| 🌐 **多语言**        | 简体中文 / 繁體中文 / English                           |
| 🎨 **双主题**        | 暗黑 / 暖色                                         |


---

## ✨ UI 截图（暗黑/暖色双主题）

<div align="center">

主界面-创意工坊

![软件主界面](js/mods/docs/img/主界面-创意工坊.png)

</div>

<div align="center">

主界面

![软件主界面](js/mods/docs/img/主界面.png)

</div>

<div align="center">

参数编辑界面

![软件主界面](js/mods/docs/img/参数界面-一般.png)

</div>



---

## 📖 完整文档

完整说明、安装步骤、项目结构、参数类型与开发资源见 **`js/mods/docs/`**（与游戏内目录一致，链接在下方文档页内可正常跳转）：


| 文档                                                         | 说明                    |
| ---------------------------------------------------------- | --------------------- |
| **[README 完整版](js/mods/docs/README.md)**                   | 完整中文说明（游戏内副本）         |
| **[使用手册](js/mods/docs/使用手册.md)**                           | 游戏制作者 / 玩家 / Mod 作者指南 |
| [RMMZ_ModLoader_开发规范](js/mods/docs/RMMZ_ModLoader_开发规范.md) | ModLoader 开发规范        |
| [modloader_CHANGELOG](js/mods/docs/modloader_CHANGELOG.md) | 更新日志                  |


---

## 📥 快速安装

在 `index.html` 中于 `main.js` **之前**注入：

```html
<script type="text/javascript" src="js/mods/ModLoader.js"></script>
```

修改 Mod 开关、参数或排序后需 **F5 刷新**；创意工坊 Mod 请在 **Steam 客户端** 订阅/取消订阅。

---

## 📜 开源协议

MIT License — 详见 [LICENSE](LICENSE)

**版本**: V4.1.2 | **更新日期**: 2026-06-25