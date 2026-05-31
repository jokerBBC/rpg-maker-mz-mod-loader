# ModLoader V4.0.0 实现说明（已完成）

> **状态**：V4.0.0 工坊 MVP 已落地（2026-05-28）。本文档供维护者与 Agent 查阅，**以当前代码为准**。
>
> **已移除**：`workshop_sim`、`useDevSim`、`workshop_subscriptions.json`（RMMZ 无法直接加载游戏目录外路径，须经 `js/mods/_workshop/` junction）。

---

## 基线与游戏信息

| 项 | 值 |
|----|-----|
| 基线版本 | `V3.17.1` |
| 当前版本 | `V4.0.0` |
| 主文件 | `js/mods/ModLoader.js` |
| Steam AppID（联调示例） | **`4379740`** — 发行游戏须改为自己的 AppID |
| Steam 集成 | `OrangeGreenworks`（成就/正版），**无 UGC/Workshop API** |
| V4 策略 | 磁盘扫描 `workshop/content/<AppID>/` + `_workshop` junction；订阅在 **Steam 客户端** |

---

## 架构原则

- ModLoader：仅管理 **`.js` 插件型 Mod**（`js/mods/` + 工坊目录），参数/排序/依赖，`mod_config.json` 唯一配置源
- **不写** `plugins.js`，**不碰** `data/`
- 玩家：Steam 订阅 → 文件落盘 → 游戏内 ModLoader 扫描、开关、**F5** 生效
- **注入模式**与**官方插件模式**均支持；插件模式经 `bootstrapModLoaderReady` / `deferLoadEnabledModsRuntime` 处理时序

```
Steam 订阅 → workshop/content/<AppID>/<FileId>/
           → js/mods/_workshop/<FileId>/（junction，扫描时建立）
本地       → js/mods/*.js
                    ↓
              scanAllMods() → mod_config → loadEnabledModsRuntime(loadPath)
```

---

## 1. 目录约定

### 正式工坊

```
<steamLibrary>/steamapps/workshop/content/<AppID>/<publishedFileId>/
  modloader.json          # 可选
  js/mods/*.js            # 推荐
```

### 运行时桥接（自动生成，勿手改）

```
js/mods/_workshop/<publishedFileId>/   → junction 指向上述工坊包内 js/mods 或逐文件联接
```

### 运行时 loadPath

```
../mods/_workshop/<fileId>/<scriptBaseName>
```

（相对 `js/plugins/`，供 `PluginManager.loadScript`）

### 可选 modloader.json

```json
{ "title": "显示名", "entries": ["ModA.js", "ModB.js"] }
```

无 manifest：扫描 `js/mods/*.js`。`entries` 仅接受文件名（禁止路径），固定解析为 `js/mods/<文件名>`。包根目录 `.js` 不再扫描。预览图：包根 `preview.png`。

---

## 2. 配置

### modloader_config.json

```json
{
  "ml_theme": "dark",
  "ml_language": "zh_CN",
  "workshop": {
    "enabled": true,
    "steamAppId": "4379740",
    "steamLibraryPath": ""
  }
}
```

| 字段 | 说明 |
|------|------|
| `enabled` | `false`：不扫描工坊目录，创意工坊筛选提示「游戏未开启创意工坊功能」，隐藏「刷新工坊」；`true`：扫描并桥接 |
| `steamAppId` | 与 `steam_appid.txt`、Steamworks 工坊后台一致；**发行必改** |
| `steamLibraryPath` | 空则从 `process.cwd()` 上溯找 `steamapps`；多库或非默认盘可填库根 |

- 启动时 `ensureModLoaderConfigFile()` 生成/补全 `workshop` 段
- 游戏作者通过**随包推送**的 `modloader_config.json` 控制玩家侧是否开启工坊；源码内 `DEFAULT_WORKSHOP_CONFIG` 仅供联调默认

### mod_config.json 键名

- 本地：`../mods/<文件名>`
- 工坊：`ws:<publishedFileId>:<scriptBaseName>`

---

## 3. Mod 对象扩展

```javascript
{
  loadPath: string,
  source: "local" | "workshop",
  workshopId: string | null,
  workshopRoot: string | null,
  workshopPackageTitle: string,
  subscribed: boolean,
  readOnly: boolean,       // workshop === true（仅禁删/拖放安装，可排序）
  installState: "ready" | "missing"
}
```

| 函数 | 说明 |
|------|------|
| `scanLocalMods()` | 本地 `js/mods/*.js` |
| `scanWorkshopMods()` | `enabled` 时扫工坊目录并 `syncWorkshopBridge`；`enabled: false` 时清理 `_workshop` |
| `scanAllMods()` | 合并去重 + `reassignOrders` |
| `loadEnabledModsRuntime()` | 使用 **`mod.loadPath`**，`installState === 'ready'` 且 `status` 为真 |

---

## 4. 扫描逻辑要点

### resolveSteamPaths()

- `workshopDir` = `{steamRoot}/workshop/content/{steamAppId}/`
- `steamLibraryPath` 非空时使用显式库根

### scanWorkshopMods()

1. `loadWorkshopConfig().enabled === false` → 返回 `[]`，删除 `js/mods/_workshop/`
2. 遍历 `workshopDir` 子目录（每目录 = FileId）
3. `discoverWorkshopScripts(root)` → 多脚本多列表行
4. `mod_config[ws:fileId:name]` 读 status/params/order

### 安全与信任

- Mod 为可执行 JavaScript；ModLoader **不做杀毒/沙箱**
- 恶意 `.js` 与本地 Mod 风险相同；订阅审核与举报依赖 **Steam** 与玩家自行甄别来源

---

## 5. UI（已实现）

- 筛选：**全部 | 本地 | 创意工坊**
- **刷新工坊**（仅 `enabled: true`）
- 工坊角标、`installState` 警告、详情（来源 / 工坊订阅 ID & 名称）
- 工坊项 **readOnly**：不可删、不可拖放安装；**可排序**（须在「全部」筛选）
- 筛选为本地/工坊时 **禁用排序**

---

## 6. 测试清单（V4 验收）

- [x] 仅本地 Mod：与 V3.17.1 一致
- [x] `workshop/content/4379740/` 自测包 3000000001~4：列表、开关、F5 加载
- [x] `enabled: false`：提示未开启，不扫工坊
- [x] 错误 `steamAppId`：工坊列表为空
- [x] 工坊不可删；本地可删
- [x] `ws:*` 与 `../mods/*` 不冲突
- [x] `@base` / `@orderAfter` 对工坊 Mod 有效
- [x] 注入模式 + 官方插件模式
- [x] `node --check ModLoader.js`

---

## 7. V4 明确不做

- 游戏内工坊浏览/订阅（UGC API）
- `workshop_sim` 开发模拟
- 自动复制工坊包到 `js/mods/`
- 写 `plugins.js`、合并 data
- Mod 脚本沙箱 / 病毒扫描

---

## 8. 关键代码位置（以函数名为准）

| 区域 | 说明 |
|------|------|
| `DEFAULT_WORKSHOP_CONFIG` | ~161 |
| `ensureModLoaderConfigFile` / `loadModLoaderConfig` | ~360 |
| `resolveSteamPaths` / `discoverWorkshopScripts` | ~430 / ~1377 |
| `syncWorkshopBridge` / `scanWorkshopMods` / `scanAllMods` | ~1464 / ~1542 / ~1612 |
| `loadEnabledModsRuntime` / `bootstrapModLoaderReady` | ~1953 / ~1993 |
| `showModManager` / `refreshWorkshopMods` | ~3046 / ~3133 |
| 初始化 | ~6291 |

---

## 9. 相关文档

| 文档 | 用途 |
|------|------|
| `docs/V4_workshop_作者规范.md` | 已迁移至 [使用手册.md](使用手册.md) |
| `docs/modloader_CHANGELOG.md` | 版本变更 |
| `docs/guide/README.md` | 玩家/整合包说明 |
| `docs/RMMZ_ModLoader_开发规范.md` | ModLoader 维护者架构 |
