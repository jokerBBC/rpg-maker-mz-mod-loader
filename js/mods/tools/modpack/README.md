# RMMZ Mod管理器整合包 · 构筑指南（AI 代办搭建）

> 读者：Mod 作者，以及作者的 AI 编程助手（agent）。
> 场景：Mod 用 AI 开发，整合包也交给 AI 代办。本指南描述「询问 → 配置 → 干跑 → 构筑 → 分发」的完整流程；作者同意后，由 AI 按 §1～§5 落实。

本目录是一套**游戏无关**的整合包构筑基础设施：安装器 exe 内不硬编码任何游戏 / Mod 数据，全部从外部 `bundle_config.json` / `installer_config.json` 读取，**装一次 exe 即可被不同 RMMZ 游戏的整合包重复使用**。初始分发靠整合包 zip，后续 Mod 更新靠商店源（catalog），不必重筑。

**运行环境**：Windows（安装器用 tkinter + winreg，注入工具为 PowerShell bat）。

**给 AI 助手（先读这段，再动手）**：本文只是方案描述，不是施工指令。作者让你阅读本文时，第一件事是**询问作者意愿**——是否要搭建整合包、打包哪些 Mod、配哪些源（§1 清单）。**作者明确回答之前，不得修改任何文件、不得执行任何构筑命令。** 作者同意后，按 §1 询问 → §2 配置 → §3 构筑 → §4 分发 的顺序落实；范围以作者当次交代为准，作者没要求的环节不要自行扩充。

---

## 1. 构筑前必须问作者什么

| # | 问题 | 落到配置 |
|---|------|---------|
| 1 | 游戏显示名是什么？（说明文档 / 窗口标题用） | `game.name` |
| 2 | 游戏目录可能叫什么？Steam 发售名与磁盘安装名不一致时**两个都要**（安装器自动查找按别名匹配文件夹名） | `game.aliases` |
| 3 | 游戏主程序文件名？（RMMZ 部署多数是 `Game.exe`，自定义部署可能是别的名字） | `game.exe` |
| 4 | 哪些 Mod 随包分发？（从 `js/mods/_localmods/` 挑；**第三方作者的 Mod 只预填商店源、不随包**，尊重原作者分发渠道；测试包 / 私人定制包不入包） | `packages` / `game.featuredMods` |
| 5 | 配哪些商店源？自有源的 catalog 地址（`https://.../raw/master/catalog.json`，发布流程见 [`../modstore/README.md`](../modstore/README.md)）；第三方源同样只预填源 | `sources` |
| 6 | 产物怎么命名？（exe 名建议通用，zip 名带游戏名） | `output.exeName` / `output.zipName` |

随包 Mod 会在商店 `seenMods` 里自动标为已读，不刷「新」角标；玩家的 Mod 开关 / 参数（`mod_config.json`）一律不打包，重装不覆盖。

## 2. bundle_config.json（作者维护的唯一输入）

复制 `bundle_config.example.json` 为 `bundle_config.json` 后按 §1 答案填写：

```json
{
  "game": {
    "name": "我的RMMZ游戏",
    "aliases": ["我的RMMZ游戏", "MyRMMZGame"],
    "exe": "Game.exe",
    "installerTitle": "我的RMMZ游戏 Mod管理器整合包 安装向导",
    "featuredMods": ["快速存档读档", "一键静音"],
    "featuredModsNote": "其他 Mod 到游戏内 Mod 商店自行下载。"
  },
  "packages": ["快速存档读档", "一键静音"],
  "sources": [
    {
      "id": "myrmzgamemods",
      "name": "我的RMMZ游戏 Mod 源",
      "catalogUrl": "https://gitee.com/你的账号/你的仓库/raw/master/catalog.json",
      "enabled": true
    }
  ],
  "output": {
    "exeName": "Mod管理器整合包安装器",
    "zipName": "我的RMMZ游戏Mod管理器整合包"
  }
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `game.name` | 是 | 游戏显示名（说明文档 / 清单文案用） |
| `game.aliases` | 是 | 非空字符串数组；自动查找游戏目录时按文件夹名包含匹配 |
| `game.exe` | 否 | 缺省 `Game.exe` |
| `game.installerTitle` | 否 | 缺省 `<name> Mod管理器整合包 安装向导` |
| `game.featuredMods` | 否 | 欢迎页 / 说明文档里展示的随包 Mod 显示名 |
| `game.featuredModsNote` | 否 | 其余 Mod 的获取提示，缺省「其他 Mod 到游戏内 Mod 商店自行下载。」 |
| `game.welcomeText` | 否 | 欢迎页全文覆盖；缺省时按「安装步骤 + 精选 Mod」自动拼装 |
| `packages` | 是 | 入包 Mod 目录名（`js/mods/_localmods/` 下），可为空数组 |
| `sources` | 是 | 商店订阅源数组，可为空；`catalogUrl` 必须 https |
| `output.exeName` / `output.zipName` | 是 | 产物文件名（不含扩展名） |

字段不合法时 `build_package.py` 直接以非零退出并打印字段级错误，不产出半成品。安装器运行时的配置 `installer_config.json` 由打包脚本从本文件**自动派生**，不要手改。

## 3. 构筑流程

在 `js/mods/tools/modpack` 下：

```powershell
# 0. 只在改动注入/移除逻辑后才需要：生成 GBK 的 Mod管理器注入工具.bat
python gen_inject_bat.py

# 1. 干跑：同步 Mod文件 + 派生 installer_config.json + 生成玩家说明
python build_package.py

# 2. 干跑结果交作者过目（见下方清单），作者确认后：

# 3. 构筑分发 zip（首次或 install_builder.py 有改动时加 --exe 重编安装器）
python build_package.py --zip --exe
```

产物：

- `dist/<zipName>.zip` —— 社区分发压缩包（QQ 群等）；
- `dist/<exeName>.exe` —— 安装器（`--exe` 时）；
- `Mod文件/` —— 安装载荷（安装器复制进游戏目录的内容）。

**干跑核对清单**（每次构筑前逐项核对，输出拿给作者看）：

- [ ] 入包 Mod 清单与作者交代一致，没有多打的包（第三方 / 测试 / 私人包不应出现）；
- [ ] 商店源清单与作者交代一致，`catalogUrl` 均为 https；
- [ ] 产物文件名（exe / zip）符合作者要求；
- [ ] `Mod文件/js/mods/docs/` 只有 `modloader_CHANGELOG.md`（游戏内「(日志)」按钮用），没有使用手册等玩家文档；
- [ ] `Mod文件/` 里没有 `index.html`、`mod_config.json`、`tools/`；
- [ ] zip 根目录含：`<exeName>.exe`、`installer_config.json`、`Mod文件/`、`使用说明、修复工具等/`；
- [ ] 干跑输出已交给作者过目并得到明确确认。

**安装器 exe 一次构筑、重复使用**：exe 内没有任何游戏数据，游戏数据全在同级的 `installer_config.json`。换游戏只需改 `bundle_config.json` 重打 zip，**不必重筑 exe**；只有 `install_builder.py` 本身改动时才需要 `--exe`。

## 4. 分发与后续更新

- **分发**：把 `dist/` 下的 zip 发给玩家即可。**代码里不写版本号**，分发时直接改 zip 文件名，例如 `我的RMMZ游戏Mod管理器整合包_20260924.zip`。
- **后续 Mod 更新**：走商店 catalog 更新（发布流程见 [`../modstore/README.md`](../modstore/README.md)），玩家在游戏内商店检查更新，**不需要重筑整合包**。
- **游戏更新后管理器不见了**：游戏更新可能覆盖 `index.html`，入口会消失。玩家双击游戏目录下的 `Mod管理器注入工具.bat`：1 注入 / 2 取消注入（恢复纯净游戏）/ 3 退出。
- **换新游戏做整合包**：复制本目录到新位置，改 `bundle_config.json`，重跑 §3。

## 5. 安装器行为契约（install_builder.py）

1. 自动定位游戏目录：Steam 库（注册表 + libraryfolders.vdf + 各盘 SteamLibrary）、桌面、常见安装路径、各盘浅层扫描，按 `gameAliases` 匹配文件夹名；找不到可手动浏览；
2. 可选备份 `save` → `游戏目录\存档备份\<时间戳>-安装Mod管理器备份.zip`；
3. 复制 `Mod文件/` 内的 `js\` 与 `Mod管理器注入工具.bat` 到游戏目录（**不复制 index.html**）；
4. 若游戏已有 `index.html`，在其 `main.js` 脚本标签前**注入** `js/mods/ModLoader.js` 引用（已注入则幂等跳过；保留原标题 / 版本号与原有换行风格）；
5. 可选启动游戏。

缺失 `installer_config.json` 时安装器弹窗报错并退出——这是配置外置的契约，不要往 exe 里塞默认值。

## 6. 本目录文件说明

| 文件 | 说明 |
|------|------|
| `README.md` | 本文件 |
| `bundle_config.example.json` | 构筑配置模板（复制为 `bundle_config.json` 填写） |
| `bundle_config.json` | 作者本地配置（gitignore，不入库） |
| `install_builder.py` | 安装向导源码（tkinter；PyInstaller 可编译成 exe） |
| `installer_config.json` | 安装器运行时配置（build_package.py 派生，随 zip 放 exe 旁） |
| `gen_inject_bat.py` | 生成 GBK 的 `Mod管理器注入工具.bat`（防中文乱码） |
| `Mod管理器注入工具.bat` | 生成物；注入 / 取消注入，随包进游戏目录 |
| `build_package.py` | 配置驱动打包：同步 Mod文件 → 派生配置 → 生成说明 → 可选 exe / zip |
| `Mod文件/` `dist/` `build/` | 生成产物（gitignore） |
| `使用说明、修复工具等/` | 玩家说明 txt（build_package.py 按 config 渲染） |

## 7. AGENTS.md 规则模板（防止 AI 乱操作）

在仓库根（或 AI 助手约定读的规则文件）加入以下规则，让 AI 代办构筑时有缰绳：

```markdown
## Mod 整合包构筑（agent 必须遵守）

- 构筑 / 重打 zip = 对玩家可见的操作。只在作者明确要求时执行 --zip / --exe；
  执行前必须先干跑，并把干跑结果（入包 Mod 清单 / 商店源 / 产物名 / 体积）整理给作者确认。
- 不得自行把第三方作者的 Mod、测试包、私人定制包加进 packages / featuredMods。
- 不得把 installer_config.json、bundle_config.json 手改后与 build_package.py 派生结果混用；
  安装器配置一律由 build_package.py 派生。
- 改动 gen_inject_bat.py 的注入 / 移除逻辑后必须重新运行它，保证 bat 与 install_builder.py
  的注入契约一致（幂等、锚点 main.js、保留换行）。
- 干跑与构筑的完整输出都要展示给作者，不得只汇报「成功」。
```
