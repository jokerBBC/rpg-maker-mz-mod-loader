# ModLoader V4 创意工坊 Mod 作者规范

> 订阅在 Steam 客户端完成，游戏内仅扫描、开关与加载。  
> 文档中的 **`4379740`** 为本仓库联调用的 Steam AppID 示例；**发行游戏须改为你自己的 AppID**（与 `steam_appid.txt`、Steamworks 工坊后台一致）。

---

## 游戏作者：开启创意工坊（推送给玩家）

编辑 `js/mods/config/modloader_config.json` 中的 `workshop` 段：

```json
{
  "workshop": {
    "enabled": true,
    "steamAppId": "你的游戏AppID",
    "steamLibraryPath": ""
  }
}
```

| 字段 | 说明 |
|------|------|
| `enabled` | `false`：玩家侧「创意工坊」筛选仍可见，列表提示「游戏未开启创意工坊功能」，不扫描工坊目录；`true`：启用扫描与加载 |
| `steamAppId` | **必改**为你的游戏 Steam AppID（勿沿用示例 `4379740`） |
| `steamLibraryPath` | 一般留空 `""`，从游戏安装路径自动找 `steamapps`；Steam 装在非默认盘或多库时填**库根**，如 `D:/SteamLibrary` |

**上线流程建议**：

1. Steamworks 开通 Workshop，确认 AppID 与 `steam_appid.txt` 一致  
2. 开发/内测阶段可设 `"enabled": false`，避免玩家看到空工坊列表  
3. 工坊就绪后，将 `"enabled": true` 且 `steamAppId` 改为正式 ID，**随游戏更新推送** `modloader_config.json`（或整包更新）  
4. 玩家更新后重启游戏，Mod 管理器即可扫描 `steamapps/workshop/content/<你的AppID>/` 下的订阅内容  

---

## 包结构（推荐）

```
<publishedFileId>/
  modloader.json          # 可选
  js/mods/
    YourMod.js
    AnotherMod.js
```

### modloader.json（可选）

```json
{
  "title": "显示名（可选，用于列表展示）",
  "entries": ["js/mods/YourMod.js", "js/mods/AnotherMod.js"]
}
```

- 无 `modloader.json`：自动扫描 `js/mods/*.js`
- 仍无脚本：扫描包根目录一层 `.js`（跳过 `ModLoader.js`）

### 同一订阅下多个 `.js` 时，管理器如何显示

**一个工坊包 = 多个列表行**（不是一行里嵌套多个 Mod）：

| 列表 | 配置键 | 说明 |
|------|--------|------|
| `WorkshopMultiCore` | `ws:3000000004:WorkshopMultiCore` | 独立开关、序号、⚙ 参数 |
| `WorkshopMultiFeatA` | `ws:3000000004:WorkshopMultiFeatA` | 可有 `@base` 指向同包或本地脚本名 |
| `WorkshopMultiFeatB` | `ws:3000000004:WorkshopMultiFeatB` | 可有 `@orderAfter`，依赖灯按行检测 |

- 每行角标仍为 **工坊**；详情 **工坊订阅** 显示为 `工坊ID & modloader.json 的 title`（如 `3000000004 & 多脚本工坊包（V4 自测）`），同包脚本 ID 相同
- `modloader.json` 的 `title` 仅作包说明，**不会**把多行合并成一个显示名（列表名 = 各脚本文件名）
- 自测包：`3000000004`（核心 + 功能A + 功能B）

### 文件存在性与启动

- **列表**：只扫描磁盘上**实际存在**的 `.js`；本地/工坊文件被手动删掉后，该行不再出现
- **启动**：`loadEnabledModsRuntime` 只加载「扫描到且 `status: true` 且 `installState === ready`」的项，**不会**仅凭 `mod_config.json` 里残留键去加载已删文件，故删文件后游戏仍可启动
- **`installState: missing`**：目前主要在「整个工坊包目录无有效脚本」或桥接失败时出现；**不会**为 `mod_config` 里单独残留、磁盘已删的某一条目保留幽灵行（保存配置后会清掉无效键）

---

## loadPath 约定

ModLoader 从 `js/plugins/` 相对路径加载脚本：

| 来源 | loadPath 示例 |
|------|----------------|
| 正式工坊（运行时） | `../mods/_workshop/<fileId>/<脚本名>`（junction 桥接到 `steamapps/workshop/content/<AppID>/...`，非复制） |

**不要**把工坊包复制到 `js/mods/`；玩家通过 Steam 订阅后文件自动落盘。  
**不支持** `js/mods/workshop_sim/` 开发模拟（无法被 `PluginManager` 加载，已移除）。

---

## mod_config.json 键名

工坊 Mod 使用：

```
ws:<publishedFileId>:<scriptBaseName>
```

示例：

```json
{
  "ws:3000000003:WorkshopDemo": {
    "status": true,
    "order": 10,
    "params": { "测试消息": "自定义" }
  }
}
```

本地 Mod 仍为 `../mods/<文件名>`（不变）。

---

## 开发自测

在 Steam 库下创建（将 `<你的AppID>` 换为实际 AppID；本仓库联调示例为 `4379740`）：

```
steamapps/workshop/content/<你的AppID>/
  3000000001/   # 框架 Mod → WorkshopFramework.js
  3000000002/   # @base WorkshopFramework → WorkshopNeedsFramework.js
  3000000003/   # 独立演示 → WorkshopDemo.js
  3000000004/   # 多脚本包 → WorkshopMultiCore / FeatA / FeatB
```

游戏内 **刷新工坊** 即可扫描；运行时经 `js/mods/_workshop/<fileId>/` junction 加载。

---

## 作者须知

- 工坊 Mod 在游戏内**只读**：不可删除、不可拖放覆盖
- 扫描时会在 `js/mods/_workshop/<fileId>/` 建立目录联接（junction），因 RMMZ `PluginManager.loadScript` **无法加载游戏目录外的脚本**
- 参数须遵守 Mod 开发铁律：每个 `@param` 必须有 `@default`
- `@base` / `@orderAfter` 依赖可引用本地 Mod 或其他工坊 Mod 的脚本基名

---

## 安全与信任

- 工坊 Mod 与本地 Mod 一样，启用后执行 **JavaScript**，ModLoader **不提供杀毒或沙箱**
- 恶意代码防护依赖 **Steam 工坊审核/举报** 与玩家只订阅信任作者；游戏说明中可写明「Mod 等同用户自行安装插件」

---

## V4 明确不支持

- 游戏内浏览/订阅 Workshop（无 UGC API）
- 自动复制工坊包到 `js/mods/`
- 写入 `plugins.js` 或合并 `data/`
- Mod 脚本病毒扫描 / 沙箱执行
