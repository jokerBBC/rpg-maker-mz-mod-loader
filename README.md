# RMMZ ModLoader

[![License: MIT](https://img.shields.io/github/license/jokerBBC/rpg-maker-mz-mod-loader)](https://github.com/jokerBBC/rpg-maker-mz-mod-loader/blob/main/LICENSE)
[![GitHub release](https://img.shields.io/github/v/release/jokerBBC/rpg-maker-mz-mod-loader)](https://github.com/jokerBBC/rpg-maker-mz-mod-loader/releases/latest)
[![GitHub downloads](https://img.shields.io/github/downloads/jokerBBC/rpg-maker-mz-mod-loader/total)](https://github.com/jokerBBC/rpg-maker-mz-mod-loader/releases)

> **[English README](README-en.md)**

游戏内模组管理器 **V4.3.0**

一款功能强大的 RPG Maker MZ 模组管理器，支持在游戏内管理 **本地 Mod** 与 **Steam 创意工坊 Mod** 的开启/关闭、参数编辑、排序与依赖检测。**现已支持多语言界面**（简体中文 / 繁體中文 / English）。

> **V4.3.0 管理器在线更新**：`libs/modLoaderUpdater.js` — 设置 → **管理器更新** 内手动检查/更新 ModLoader 白名单文件（catalog + raw）；与 Mod 商店分离；sha256 相同跳过下载；备份失败自动回滚；GitHub / Gitee 双镜像。详见 [使用手册 · 管理器更新](js/mods/docs/使用手册.md#28-管理器更新)。

> **V4.1.3 前置 Mod**：新增 **ModDataLoader**（数据库 merge / replace / add、manifest 声明式注入）与 **ModResourceLoader**（资源替换 / 新增、modId 别名），采用 **ModLoader → 前置 Mod → 功能 Mod** 三层架构；游戏专属兼容（加密、YEP 等）通过可插拔 **GameAdapter** 适配。**部分测试已完成** — 详见完整文档中的前置 Mod 章节。

> **运行环境**：Mod 配置保存在 `mod_config.json`  
> **不再写入**： `plugins.js`，游戏更新官方插件后 Mod 开关与参数不会丢失。  
> **创意工坊**：需 Steam 正版安装路径才能解析工坊目录（毕竟盗版都没法订阅），本地 Mod 正常使用。  
> **libs 扩展**：`js/mods/libs/` 可放管理器扩展（如 `modStore.js`、`modLoaderUpdater.js`）；调用 `ModLoader` API 才生效。Mod 商店：有 `modStore.js` 即开启，删除即关闭。管理器在线更新：有 `modLoaderUpdater.js` 即开启，删除即关闭。盗版检测：游戏作者**自行**从源码拷贝 `piracyGate.js` 即开启（**默认发行包不含**），删除即关闭。  

---

## ✨ 实际运用案例

- 使用 RMMZ ModLoader V4.1.2 做 Mod 的游戏「挂机升级打怪兽」攻略站（含 Mod 管理器使用教程 · [飞书链接](https://qcnhq5e2tphh.feishu.cn/wiki/XH1jwdX5uil2ookoEF8cpN1AnJf)）
- 基于 RMMZ ModLoader V4 的「绯月仙行录」游戏微调版运用实例（[百度贴吧 1](https://tieba.baidu.com/p/10810499585?fr=personpage) · [百度贴吧 2](https://tieba.baidu.com/p/10813947286?fr=personpage)）

## ✨ 功能特性


| 功能                | 描述                                              |
| ----------------- | ----------------------------------------------- |
| 🎮 **游戏内管理**      | 无需额外程序，直接在游戏中管理 Mod 开关、参数与排序                    |
| 🛒 **Steam 创意工坊** | 扫描 `workshop/content/<AppID>/`（AppID 可配置）；筛选、刷新列表；本地与工坊统一包结构 |
| 🏪 **Mod 商店拓展** | `libs/modStore.js`：多源 HTTPS catalog 订阅、下载/更新整包到 `_localmods`、断点续传（>50MB）；**UI 多语言**；列表「更新日志」按钮；可与工坊并存 |
| 🔄 **管理器在线更新** | `libs/modLoaderUpdater.js`：设置内手动检查/更新 ModLoader 本体（catalog + raw）；与 Mod 商店分离；禁用开关；绿色角标加算 |
| 📦 **统一包结构**      | 本地 `_localmods/<包名>/` 与工坊订阅包根目录布局一致（V4.1）；包根 `CHANGELOG.md` 为 Mod 更新日志唯一位置（V4.2） |
| 📋 **Mod 更新日志**   | 管理器详情版本旁「更新日志」；头部「(日志)」为管理器自身日志；商店 / 详情 / 管理器共用 Markdown 弹窗 |
| ⚙️ **参数编辑**       | 数值、开关、文本、单选、颜色、长文本、数据库引用、struct、table           |
| 🔀 **排序与依赖**      | 拖拽/序号排序；`@base` / `@orderAfter` 依赖检测；缺失 `@base` 时自动跳过加载（依赖守卫） |
| ⚠️ **冲突日志面板**     | 设置齿轮菜单底部入口 + 管理器内空壳面板（内容由前置 Mod `render`）；有冲突时齿轮旁红叹号 |
| 📦 **前置 Mod**       | ModDataLoader（数据）+ ModResourceLoader（资源）；三层架构，GameAdapter 适配不同游戏（部分测试完成） |
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
| **[README 完整版](js/mods/docs/README.md)**                   | 完整中文说明（含前置 Mod 章节） |
| **[README 完整版 (English)](js/mods/docs/README-en.md)**        | Complete English guide |
| **[使用手册](js/mods/docs/使用手册.md)**                           | 游戏制作者 / 玩家 / Mod 作者指南 |
| **[调用规范](js/mods/docs/前置Mod更新日志等/调用规范.md)**              | 前置 Mod 调用规范（Mod 作者） |
| [数据和资源前置Mod-V2-需求规格书](js/mods/docs/前置Mod更新日志等/数据和资源前置Mod-V2-需求规格书.md) | 前置 Mod 架构与 API 规格 |
| [前置Mod测试清单](js/mods/docs/前置Mod更新日志等/前置Mod测试清单.md) | 前置 Mod 测试清单（部分已完成） |
| [RMMZ_ModLoader_开发规范](js/mods/docs/RMMZ_ModLoader_开发规范.md) | ModLoader 开发规范        |
| [mod商店拓展 plan](js/mods/docs/mod商店拓展plan.md) | Mod 商店协议与拓展设计（进阶阅读） |
| [modloader_CHANGELOG](js/mods/docs/modloader_CHANGELOG.md) | ModLoader 更新日志                  |


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

**版本**: V4.3.0 | **更新日期**: 2026-08-24
