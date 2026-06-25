# 数据和资源前置Mod — V2 需求规格书

> 日期：2026-06-03 | 状态：MVP 已完成，文档同步更新  
> 本文档经研究笔记研读 + 多轮需求对齐 + MVP 开发验证，作为后续迭代依据。

---

## 1. 总体架构

### 1.1 三层分离原则

```text
ModLoader V4.1.x
  └─ 管理 .js 插件的开关、排序、参数（不碰 data / 资源）

前置 Mod A — ModDataLoader（数据前置）
  └─ 提供数据合并 API：字段级 merge / 整条 replace / 新增条目 / 地图数据 / 智能 ID 迁移

前置 Mod B — ModResourceLoader（资源前置）
  └─ 提供资源能力：manifest 声明式替换 / API 替换 / 新资源加载 / 加密绕过

功能 Mod
  └─ @base 声明依赖前置，调用 API
```

### 1.2 部署方式

- 两个前置 Mod 均作为 `_localmods/` 下的独立包，各自带 `modloader.json`
- 功能 Mod 在 JS 插件头用 `@base ModDataLoader` 或 `@base ModResourceLoader` 声明依赖
- ModLoader 按 `mod_config.json` 的 order 加载，前置 Mod 的 order 应最小

### 1.3 通用性设计

- 核心合并逻辑通用，不绑定特定游戏
- 游戏专属兼容（sorajm 加密、YEP null 槽）放在 **GameAdapters 可插拔层**
- 换游戏时只需增删 GameAdapters 模块

---

## 2. 数据前置 Mod — ModDataLoader

### 2.1 功能范围（MVP）

| 功能 | 说明 |
|------|------|
| **字段级 merge** | 修改某 id 的某几个字段，保留其余字段 |
| **整条 replace** | 完全替换某 id 的整条数据 |
| **新增条目** | 在 $dataXxx 末尾追加新条目（id 收紧到 length） |
| **删除条目** | `_delete: true` 将对应 id 设为 null |
| **地图数据合并** | event 级别浅合并（按 id merge/replace/add），不深入 pages 内部 |
| **对象表 merge** | 对 `$dataSystem` 等对象类型数据做字段级深合并 |
| **manifest 声明式 patch** | 读 `modloader.json` 的 `data.patches`，支持字段级 patch |
| **冲突日志 + UI** | 生成冲突报告，通过 API 注册到 ModLoader，游戏窗口右下角可查 |
| **智能 ID 迁移** | stableKey 稳定标识 + 读档后自动迁移存档引用 |

### 2.2 明确不做

| 不做 | 原因 |
|------|------|
| 自定义数据库文件（registerDatabaseFile） | 不是前置该管的，作者自行处理 |
| idPolicy 硬限制（minId / allowOverwriteVanilla） | 本游戏 YEP 不允许高空洞，硬限制不适用 |
| 从网络 URL 加载数据 | 安全风险，只读本地 |
| 地图事件 pages 深合并 | 复杂度过高，用 replace 整条替换即可 |

### 2.3 API 设计

#### 兼容保留（微调后）

```javascript
// 注册数据库条目修改
ModDataLoader.registerData(dataType, entries, mode)
// dataType: 'Items' | 'Skills' | 'System' | 'Actors' 等
// entries: [{ id, ...fields }] 数组，可选 stableKey 字段
// mode: 'merge'（默认）| 'replace' | 'add'
// 【变更】去掉 priority 参数，改用 mod_config order

// 注册地图数据修改
ModDataLoader.registerMapData(mapId, mapData, mode)
// 【变更】去掉 priority 参数

// 重新应用注册表（调试用）
ModDataLoader.reapplyData(dataType)

// 查询注册表
ModDataLoader.getDataRegistry()
ModDataLoader.getData(dataType)
```

#### 新增

```javascript
// ── 文件加载 ──

// 读取 Mod 包内本地 JSON 文件并注册数据
ModDataLoader.registerDataFromFile(dataType, filePath, mode)
// filePath: 相对游戏目录的路径，限制在游戏目录内
// 自动校验路径安全（禁止 .. / 绝对路径 / 盘符）

// 读取地图 JSON 文件并注册
ModDataLoader.registerMapDataFromFile(mapId, filePath, mode)

// ── 冲突报告 ──

// 获取冲突报告
ModDataLoader.getConflictReport()
// 返回 [{ dataType, id, field, mods: [{name, order, value}], winner }]

// ── 智能 ID 迁移 ──

// 注册稳定标识条目（带迁移支持）
ModDataLoader.registerStableEntry(dataType, entry)
// entry 必须包含 stableKey 字段，如 'mymod:healing-potion-v1'
// 自动处理：compactId + 注册 stableKey + 标记需迁移

// 按 stableKey 查找当前 id
ModDataLoader.findIdByStableKey(dataType, stableKey)
// 扫描 $dataXxx，通过 note 中的 <MDL:stableKey> 标记定位当前 id

// 手动触发迁移（通常自动，此为调试用）
ModDataLoader.migrateSaveData()
```

#### 移除

```javascript
// 以下方法移除：
ModDataLoader.registerDatabaseFile()      // 不做自定义 DB
ModDataLoader.registerDataFromUrl()       // 不做网络 URL
ModDataLoader.registerMapDataFromUrl()    // 不做网络 URL
// priority 参数全部移除
```

### 2.4 数据源机制

**三通道，声明驱动：**

1. **JS API 通道**：功能 Mod 在脚本中硬编码数据，调用 `registerData()`
2. **文件扫描通道**：Mod 在 `modloader.json` 的 `data.records` 中声明文件，前置按声明读取
3. **manifest patch 通道**：Mod 在 `modloader.json` 的 `data.patches` 中声明字段级 patch

```json
// modloader.json 完整示例
{
  "schemaVersion": 1,
  "title": "修仙扩展包",
  "entries": ["FY_XY_Mod.js"],
  "data": {
    "enabled": true,
    "records": [
      { "file": "data/Items.json", "type": "items", "format": "array" },
      { "file": "data/FY_物品/Items.json", "type": "items", "format": "list" }
    ],
    "patches": [
      { "target": "System", "merge": { "advanced": { "gameId": 12345 } } },
      { "target": "Items", "index": 1, "merge": { "name": "改名药水", "price": 100 } }
    ]
  }
}
```

- 不写 `data` 段 → 不扫描不 patch，Mod 自己调 API
- 写了 `data.enabled: false` → 同上
- `data.enabled: true` 且 `mod_config` 中该包 `status: true` → 生效（双重门闩）
- 路径限制：相对包根，禁止 `..`、绝对路径、盘符

#### records 的 format 说明

| format | 结构 | 说明 |
|--------|------|------|
| `array`（默认）| `[null, {id:1,...}, {id:2,...}]` | RMMZ 导出格式，数组下标 = id |
| `list` | `{ "items": [{id:1,...}, ...] }` | 紧凑列表，需指定外层 key |
| `inline` | `[{id:1,...}]` | 根级就是条目数组 |

### 2.5 合并顺序与冲突

- **合并顺序**：完全由 `mod_config.json` 的 `order` 决定（升序，小 order 先加载）
- **冲突策略**：同 dataType 同 id 同字段 → **order 靠后者 wins** + 写冲突日志
- **冲突报告数据结构**：
  ```javascript
  [{
    dataType: 'Items',
    id: 621,
    field: 'name',           // 冲突字段
    mods: [
      { name: 'ModA', order: 5, value: '名字A' },
      { name: 'ModB', order: 8, value: '名字B' }  // winner
    ],
    winner: 'ModB'
  }]
  ```

### 2.6 ID 策略

- 保留 `compactNewEntryId`：id > $dataXxx.length 时收紧到 length（紧接追加）
- 不做 idPolicy 硬限制（minId / allowOverwriteVanilla 留作后续扩展）
- GameAdapters 层负责 YEP null 槽兼容（可插拔）

### 2.7 异步加载

- 保留异步加载能力（`fetch` 本地 JSON）
- **路径限制**：只允许游戏目录内的相对路径
- 禁止 `http://`、`https://`、`//` 开头
- 路径规范化后不得 escape 游戏根目录
- 保留 `isReady()` / `onReady(callback)` 机制

### 2.8 GameAdapters 可插拔层

| 适配器 | 适用游戏 | 功能 |
|--------|----------|------|
| `installSorajmLoadPath` | 挂机升级打怪兽 | Hook `DataManager.onLoad`（sorajm .sora 只走 onLoad） |
| `installYepNotetagNullSlot` | 有 YEP 插件的游戏 | 包装 5 个 notetag 处理器，null 槽临时 stub |
| `compactNewEntryId` | 通用 | id > length 时收紧 |

- 默认全部启用，通过参数可逐个关闭
- 换游戏时增删适配器即可

---

## 3. 智能 ID 迁移

### 3.1 问题背景

Mod 用 `id: 621`（紧接官方末尾）新增物品。游戏更新后官方也加了物品占了 621。
旧存档 `$gameParty._items[621]` 指向的已不是 Mod 物品。merge 模式下 Mod 字段会叠进官方 621。

### 3.2 解决方案：stableKey + 自动迁移

**核心思路**：Mod 条目带一个不随 id 变化的稳定标识（stableKey），写在 note 里。每次读档后，前置扫描 `$dataXxx` 找到 stableKey 对应的当前 id，对比旧 id，自动迁移存档引用。

#### Mod 作者使用方式

```javascript
// 注册时带 stableKey
ModDataLoader.registerStableEntry('Items', {
  stableKey: 'mymod:healing-potion-v1',
  name: 'Mod治疗药水',
  iconIndex: 176,
  price: 100,
  // ... 其余字段
});

// 或 JS API 中手动注册
ModDataLoader.registerData('Items', [{
  id: $dataItems.length,
  stableKey: 'mymod:healing-potion-v1',
  name: 'Mod治疗药水',
  // ...
}], 'merge');
```

#### 前置内部流程

```text
1. registerStableEntry / registerData 时：
   - 在 entry.note 中自动追加 <MDL:stableKey:mymod:healing-potion-v1>
   - 记录 { dataType, stableKey, modName } 到迁移注册表

2. 数据库加载完成后（DataManager.onLoad 之后）：
   - 扫描所有 $dataXxx，建立 stableKey → currentId 映射
   - compactNewEntryId 确保 id 紧接追加

3. 读档后（extractSaveContents / Scene_Map.start）：
   - 对比 stableKey 的旧 id（存档中记录的）与新 id（当前扫描到的）
   - 如果 id 变了，迁移以下存档引用：
     * $gameParty._items[oldId] → _items[newId]
     * $gameParty._weapons[oldId] → _weapons[newId]
     * $gameParty._armors[oldId] → _armors[newId]
   - 日志记录迁移详情
```

#### 迁移覆盖范围（MVP）

| 存档位置 | 说明 |
|----------|------|
| `$gameParty._items` | 普通物品持有量 |
| `$gameParty._weapons` | 武器持有量 |
| `$gameParty._armors` | 防具持有量 |

#### 迁移不覆盖（Mod 作者自行处理）

| 不覆盖 | 原因 |
|--------|------|
| `$gameSystem.sora.仓库存入ID` | 本游戏特有，前置不应硬编码 |
| YEP 独立物品 `_independentItems` | 结构复杂，Mod 作者自己处理 |
| 事件/公共事件里写死的物品 id | 需作者手动改事件或做映射 |

### 3.3 迁移 API

```javascript
// 注册稳定标识条目（推荐方式）
ModDataLoader.registerStableEntry(dataType, entry)
// 自动：compactId + 追加 stableKey 到 note + 注册迁移

// 按 stableKey 查找当前 id（供 Mod 业务逻辑使用）
ModDataLoader.findIdByStableKey(dataType, stableKey)

// 手动触发迁移（调试用，正常由读档自动触发）
ModDataLoader.migrateSaveData()

// 获取迁移日志
ModDataLoader.getMigrationLog()
// [{ stableKey, oldId, newId, migrated: { _items: 3 } }]
```

### 3.4 注意事项

- stableKey 在 note 中以 `<MDL:stableKey:xxx>` 格式存储
- `findIdByStableKey` 遍历 `$dataXxx`，大量 stableKey 时有性能开销，建议缓存
- 迁移只处理「Mod 自己记账」的数量，不碰玩家从其他途径获得的同 id 物品
- 游戏大版本改表后，Mod 作者可能需要更新 stableKey 版本（v1→v2）并写升级路径

---

## 4. 资源前置 Mod — ModResourceLoader

### 4.1 功能范围（MVP）

| 功能 | 说明 |
|------|------|
| **manifest 声明式资源替换** | Mod 在 `modloader.json` 的 `resources` 字段声明替换映射，零 JS 代码即可替换游戏原图 |
| **图片替换（API）** | Hook `ImageManager.loadBitmap`，将游戏原图请求重定向到 Mod 图片 |
| **音频替换（API）** | Hook `AudioManager.createBuffer`，将游戏原音频重定向到 Mod 音频 |
| **加密绕过** | 识别 Mod 资源 URL，跳过游戏的解密流程（默认开启，参数可关） |
| **modId 别名系统** | Mod 在 manifest 中定义稳定标识符，ModResourceLoader 自动映射到实际包名（解决创意工坊 ID 不确定问题） |
| **新增资源 API** | `loadBitmap(modName, relativePath)` — Mod 通过 modId 引用自己包内的新图片，无需知道工坊 ID |
| **冲突检测** | 多 Mod 替换同一资源时记录冲突，注册到 ModLoader 冲突日志 UI |

### 4.2 明确不做

| 不做 | 原因 |
|------|------|
| Effekseer 特效替换 | 优先级低，归入「将来可扩展升级」 |
| 资源文件写盘 / 持久化 | 运行时重定向，不改游戏文件 |
| 视频资源替换 | 当前游戏无此需求 |

### 4.3 manifest 声明式资源替换（推荐方式）

Mod 在 `modloader.json` 中声明 `resources` 字段，ModResourceLoader 启动时自动扫描所有已启用 Mod 的 manifest，零 JS 代码完成替换：

```json
{
  "modId": "MyMod",
  "title": "我的 Mod",
  "entries": ["MyMod.js"],
  "resources": {
    "img/菜单/现实时间图标": "img/clock.png"
  }
}
```

| 字段 | 说明 |
|------|------|
| `modId` | Mod 的稳定标识符（推荐填写）。创意工坊 Mod 上传前不知道工坊 ID，用此别名在代码中引用自身资源 |
| `resources` | 键 = 原游戏资源路径（不含扩展名），值 = 替换文件路径（相对 Mod 包根，含扩展名） |

- ModResourceLoader 独立扫描 manifest（读 `mod_config.json` + 各 Mod 的 `modloader.json`），不依赖 ModLoader 提供路径
- `modId` 自动注册为包名别名，`loadBitmap` 可通过 modId 或实际包名访问

### 4.4 API 设计

#### 新增资源 API

```javascript
// 加载 Mod 包内的新图片（非替换，游戏原本不存在的图片）
ModResourceLoader.loadBitmap(modName, relativePath)
// modName: modId 别名或实际包名
// relativePath: 相对 Mod 包根的路径（不含扩展名，自动追加 .png）
// 返回: Bitmap 对象（走 ImageManager 缓存）
```

#### 兼容保留（注册式替换）

```javascript
// 注册图片替换
ModResourceLoader.registerImage(folder, filename, modUrl)

// 注册音频替换
ModResourceLoader.registerAudio(folder, filename, modUrl)

// 通用注册
ModResourceLoader.registerResource(type, folder, filename, modUrl)
// type: 'img' | 'audio'
```

- **无 priority 参数**，冲突时 mod_config order 靠后者 wins
- 推荐优先使用 manifest 声明式替换（4.3），API 方式保留作为动态场景的备选

### 4.5 加密绕过

- 默认开启，通过插件参数可关闭
- 对不加密的游戏无害（Mod 资源 URL 不在加密检测集合里时自动走正常流程）

---

## 5. ModLoader V4.1.x 侧改动

### 5.1 冲突日志 API（MVP）

ModLoader 暴露一个 API 供前置 Mod 注册日志入口：

```javascript
// 前置 Mod 调用
ModLoader.registerLogEntry({
  icon: '⚠',               // 角落图标文字
  label: '数据冲突',         // 悬停提示
  getReport: function() { ... }  // 返回冲突报告数据
});
```

### 5.2 冲突日志 UI

- **位置**：紧贴游戏窗口**右下角**（不在管理器 UI 模态窗口内）
- **外观**：圆角矩形按钮，配合 ModLoader 管理器 UI 风格
- **交互**：点击弹出冲突列表面板
- **面板设计**：仿照 ModLoader 管理器风格，展示冲突详情
- **展示内容**：
  - dataType（Items / Skills / System 等）
  - id 号
  - 冲突字段名
  - 涉及的 Mod 名称 + 注册来源（api / manifest）+ order
  - 哪个 Mod 的改动生效了
  - 同一 Mod 通过不同来源（API + manifest）注册同一条目时，按 `modName:regSource` 去重
- 数据前置和资源前置各自注册自己的日志入口
- **常态隐藏**：⚠ 按钮仅在管理器打开时显示，关闭管理器时隐藏

### 5.3 @base 依赖守卫

ModLoader 在加载 Mod 时检查 `@base` 声明：如果依赖的前置 Mod 未启用，自动跳过该 Mod 并记录日志，避免游戏崩溃。

- 检查范围：已加载的脚本列表 + 当前启用队列中的其他 Mod
- 跳过行为：`continue` 跳过当前 Mod，不影响后续 Mod 加载
- 双重保护：Mod 自身也应做 `if (!window.ModDataLoader) return` 前置检查

---

## 6. modloader.json 扩展

### 6.1 数据前置读取的字段

```json
{
  "schemaVersion": 1,
  "data": {
    "enabled": true,
    "records": [
      { "file": "data/Items.json", "type": "items", "format": "array" }
    ],
    "patches": [
      { "target": "System", "merge": { "advanced": { "gameId": 12345 } } },
      { "target": "Items", "index": 1, "merge": { "name": "改名", "price": 100 } }
    ]
  }
}
```

| 字段 | 说明 |
|------|------|
| `data.enabled` | 是否启用本包的数据合并（需与 mod_config status 同时为 true） |
| `data.records[]` | 整 record 文件声明，file 相对包根 |
| `data.patches[]` | 字段级 patch 声明，target 为逻辑表名 |

### 6.2 patches schema

| 子字段 | 必填 | 说明 |
|--------|------|------|
| `target` | 是 | 逻辑表名：`System` / `Items` / `Skills` 等 |
| `merge` | 是 | 要合并的对象片段 |
| `index` | 条件必填 | **数组表**（Items 等）必填，指定 record 下标；**对象表**（System）不写 |

### 6.3 资源前置读取的字段

```json
{
  "modId": "MyMod",
  "title": "我的 Mod",
  "entries": ["MyMod.js"],
  "resources": {
    "img/菜单/现实时间图标": "img/clock.png"
  }
}
```

| 字段 | 说明 |
|------|------|
| `modId` | Mod 的稳定标识符。ModResourceLoader 自动注册为包名别名，解决创意工坊 ID 不确定问题 |
| `resources` | 声明式资源替换映射。键 = 原游戏资源路径（不含扩展名），值 = 替换文件路径（相对包根，含扩展名） |

- `resources` 中的路径自动校验安全性（禁止 `..`、绝对路径、盘符）
- `modId` 可选，但强烈建议填写（尤其创意工坊 Mod）

### 6.4 type / target 映射表

| type/target | 全局变量 | 数据形态 |
|-------------|----------|----------|
| `Actors` | `$dataActors` | 数组 |
| `Classes` | `$dataClasses` | 数组 |
| `Skills` | `$dataSkills` | 数组 |
| `Items` | `$dataItems` | 数组 |
| `Weapons` | `$dataWeapons` | 数组 |
| `Armors` | `$dataArmors` | 数组 |
| `Enemies` | `$dataEnemies` | 数组 |
| `States` | `$dataStates` | 数组 |
| `Troops` | `$dataTroops` | 数组 |
| `Animations` | `$dataAnimations` | 数组 |
| `Tilesets` | `$dataTilesets` | 数组 |
| `CommonEvents` | `$dataCommonEvents` | 数组 |
| `System` | `$dataSystem` | **对象** |

---

## 7. 明确不做（MVP 及后续均不做）

| 不做 | 原因 |
|------|------|
| 自定义数据库文件（registerDatabaseFile） | 不是前置该管的 |
| RPGModder 外置管理器集成 | 架构互斥，只借鉴算法 |
| Nexus / nxm:// 协议 | 不适用 |
| 写盘 / Rebuild | 运行时内存合并，不改游戏文件 |
| 网络 URL 加载 | 安全风险 |
| 地图事件 pages 深合并 | 复杂度过高 |

---

## 8. 将来可扩展升级（当前 MVP 不做）

以下功能架构上可扩展，但当前 MVP 阶段不实现，视后续需求优先级决定。

| 功能 | 说明 | 备注 |
|------|------|------|
| Auto-Packer 作者工具 | Mod 打包 / 发布辅助工具 | 单独做，不进前置 Mod |
| Effekseer 特效替换 | Hook Effekseer 资源加载，支持 Mod 替换特效 | 优先级低，当前游戏无此需求 |

---

## 9. 文件结构预期

```text
_localmods/
  ModDataLoader/
    modloader.json        # { "title": "数据前置", "entries": ["ModDataLoader.js"] }
    ModDataLoader.js      # 数据前置核心
    调用规范.md            # Mod 作者调用指南

  ModResourceLoader/
    modloader.json        # { "title": "资源前置", "entries": ["ModResourceLoader.js"] }
    ModResourceLoader.js  # 资源前置核心

  某功能Mod/
    modloader.json        # { "modId": "某功能Mod", "entries": ["某功能.js"],
                          #   "data": { ... }, "resources": { ... } }
    某功能.js             # @base ModDataLoader / @base ModResourceLoader
    data/
      Items.json          # 大量数据走文件
    img/
      custom.png          # 新增资源走 loadBitmap API
```

---

## 10. 所有已确认决策汇总

| 决策项 | 结论 |
|--------|------|
| 版本定位 | Phase A + B（含字段级 patch） |
| API 兼容性 | 兼容 V1.0.5 核心签名，可微调（去 priority，加新函数） |
| 数据源 | JS API + manifest records 声明扫描 + manifest patches |
| 通用性 | 通用核心 + GameAdapters 可插拔层 |
| 资源前置 | 独立前置 Mod，本次 MVP 一起做 |
| 地图数据 | MVP 包含，event 级浅合并 |
| 自定义 DB | 不做（MVP + 后续均不做） |
| manifest 支持 | MVP 支持 records + patches（数据前置）+ resources + modId（资源前置） |
| 冲突处理 | last wins + 冲突日志 + UI（右下角圆角按钮） |
| 优先级 | 只用 mod_config order，无 API priority 参数 |
| ID 策略 | compactNewEntryId 收紧，无硬限制 |
| 部署方式 | _localmods 下独立包 + @base 声明 |
| 加密绕过 | 资源前置内置，默认开启可参数关闭 |
| 异步加载 | 保留，路径限制在游戏目录内 |
| 智能 ID 迁移 | 前置内置 stableKey + 自动迁移 |
| 冲突 UI 位置 | 游戏窗口右下角（非管理器模态内），圆角按钮 |
| patches index | 数组表必填 index，对象表不写 |
| 地图事件合并 | 浅合并（event 级），不深入 pages |
| modId 别名 | 资源前置支持，Mod 定义稳定标识符，自动映射到实际包名 |
| 资源替换方式 | manifest 声明式优先（零代码），API 方式作为动态场景备选 |
| 新增资源 | `loadBitmap(modName, relativePath)` 单 API，通过 modId 引用 |
| @base 依赖守卫 | ModLoader 加载时自动检查，缺失依赖则跳过该 Mod |
| regSource 去重 | 冲突报告按 `modName:regSource` 去重，区分 api 和 manifest 来源 |
