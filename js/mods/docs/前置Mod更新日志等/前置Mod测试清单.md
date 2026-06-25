# 前置 Mod 功能测试清单

> 更新日期：2026-06-03
> 适用：ModDataLoader V2.0.0 / ModResourceLoader V2.0.0 / ModLoader V4.1.3

---

## ModDataLoader 数据合并前置

### 数据注入

| # | 测试项 | 测试方式 | 预期结果 | 状态 |
|---|--------|----------|----------|------|
| D1 | merge 模式修改已有条目 | TestMDL-V2 物品1改名+改价，进游戏查看物品 | 名称和价格被修改，其他字段保留原值 | ✅ 已测 |
| D2 | replace 模式整条替换 | 新测试用例：对某物品用 replace 模式，只传部分字段 | 原条目被完全替换，未传的字段丢失 | 未测 |
| D3 | add 模式仅新增字段 | 新测试用例：对已有物品用 add 模式修改 name | name 不变（已有字段跳过），新增字段写入 | 未测 |
| D4 | manifest records 自动加载 | TestMDL-V2 modloader.json data.records → 查看 $dataItems | data/TestItems.json 内容自动注入 | ✅ 已测 |
| D5 | manifest patches 字段级补丁 | TestMDL-V2 modloader.json data.patches → 物品1.name | 物品1名称被 patch 修改 | ✅ 已测 |
| D6 | manifest records 文件不存在 | 声明一个不存在的 data/*.json | readJsonFile 静默返回 null，游戏不崩溃 | 未测 |
| D7 | manifest patches 无 index（对象表） | 对 $dataSystem 等对象表做 patch（省略 index） | 字段被正确修改 | 未测 |

### 地图数据

| # | 测试项 | 测试方式 | 预期结果 | 状态 |
|---|--------|----------|----------|------|
| D8 | registerMapData event 级浅合并 | 对 Map001 注册事件修改（改 name） | 事件 name 被修改，pages 保持原样 | 未测 |
| D9 | registerMapData replace 模式 | 整张地图数据替换 | 地图数据完全替换 | 未测 |
| D10 | registerMapData merge + 新事件 | 注册一个新事件到地图 | 新事件出现在地图中 | 未测 |

### 智能 ID 迁移

| # | 测试项 | 测试方式 | 预期结果 | 状态 |
|---|--------|----------|----------|------|
| D11 | stableKey 新增条目 + ID 收紧 | TestMDL-V2 发放测试药水 | 条目被创建，ID 为紧凑值（非 9999） | ✅ 已测 |
| D12 | stableKey 存档迁移 | 存档 → 手动修改游戏数据使 ID 偏移 → 读档 | stableKey 对应的物品 ID 自动迁移 | 未测 |
| D13 | findIdByStableKey 查询 | F12: `ModDataLoader.findIdByStableKey('Items', 'testmdl-v2:healing-potion')` | 返回当前正确的 ID | 未测 |
| D14 | getMigrationLog 查询 | F12: `ModDataLoader.getMigrationLog()` | 显示迁移记录 | 未测 |

### 冲突检测

| # | 测试项 | 测试方式 | 预期结果 | 状态 |
|---|--------|----------|----------|------|
| D15 | 跨来源冲突检测 | TestMDL-V2 JS API vs manifest 修改同一字段 | 冲突报告显示两条记录 | ✅ 已测 |
| D16 | 中文字段名翻译 | 触发 name/price 等字段冲突 | 面板显示「名称」「价格」而非字段英文名 | ✅ 已测 |
| D17 | 同 Mod 同来源去重 | 同一 Mod 多次 registerData 同字段 | 不算冲突（去重为一条） | 未测 |
| D18 | 无冲突时面板显示 | 只有不冲突的修改 | 面板显示「暂无冲突记录」 | 未测 |

### 查询与回调

| # | 测试项 | 测试方式 | 预期结果 | 状态 |
|---|--------|----------|----------|------|
| D19 | isReady() | F12: `ModDataLoader.isReady()` | 数据加载后返回 true | 未测 |
| D20 | onReady(callback) | F12: `ModDataLoader.onReady(() => console.log('ready'))` | 数据就绪后执行回调 | 未测 |
| D21 | getData(dataType) | F12: `ModDataLoader.getData('Items')` | 返回 $dataItems 引用 | 未测 |
| D22 | getDataRegistry() | F12: `ModDataLoader.getDataRegistry()` | 返回所有注册信息 | 未测 |
| D23 | reapplyData(dataType) | F12: `ModDataLoader.reapplyData('Items')` | 数据重新注入 | 未测 |

### GameAdapter 兼容性

| # | 测试项 | 测试方式 | 预期结果 | 状态 |
|---|--------|----------|----------|------|
| D24 | sorajm 加密兼容 | 使用 .sora 加密数据文件的游戏环境 | 加密数据正常加载和解密 | 未测 |
| D25 | YEP null-slot 兼容 | 创建含 null 空洞的 $dataXxx 数组 | YEP 遍历不崩溃 | 未测 |
| D26 | compactNewEntryId | 新增条目 ID=9999 | 实际 ID 被收紧到数组末尾 | 未测 |

---

## ModResourceLoader 资源替换前置

### Manifest 声明式替换

| # | 测试项 | 测试方式 | 预期结果 | 状态 |
|---|--------|----------|----------|------|
| R1 | 本地图片替换 | TestMRL 打开菜单看时间图标 | 图标变成红色钟表 | ✅ 已测 |
| R2 | 工坊图片替换 | 复制到 workshop/3000000005 → 打开菜单 | 图标同样被替换 | ✅ 已测 |
| R3 | 音频替换 | 声明 audio 替换 → 对应 BGM/SE 播放 | 音频被替换为 mod 版本 | 未测 |
| R4 | 多个替换同时生效 | manifest 中声明 2+ 个资源替换 | 所有替换同时生效 | 未测 |
| R5 | 替换不存在的原资源 | 声明替换一个游戏不存在的图片路径 | 无报错，静默忽略 | 未测 |

### modId 别名

| # | 测试项 | 测试方式 | 预期结果 | 状态 |
|---|--------|----------|----------|------|
| R6 | 本地 loadBitmap + modId | TestMRL 本地环境 loadBitmap('TestMRL', ...) | 图片正常加载 | ✅ 已测 |
| R7 | 工坊 loadBitmap + modId | 工坊环境 loadBitmap('TestMRL', ...) | 图片正常加载（modId 映射到工坊 ID） | 未测 |
| R8 | modId 重复冲突 | 两个 Mod 使用相同 modId | 后加载的覆盖先加载的 | 未测 |

### 资源新增 API

| # | 测试项 | 测试方式 | 预期结果 | 状态 |
|---|--------|----------|----------|------|
| R9 | loadBitmap 新增图片 | TestMRL 进入地图看左下角 | 蓝色盾牌图标显示 | ✅ 已测 |
| R10 | loadAudio 新增音频 | 调用 loadAudio('bgm', 'test') → 播放 | 音频正常播放 | 未测 |
| R11 | loadBitmap 未知 modName | F12: `ModResourceLoader.loadBitmap('NotExist', 'img/x')` | 返回空 Bitmap + 控制台报错 | 未测 |

### Legacy API

| # | 测试项 | 测试方式 | 预期结果 | 状态 |
|---|--------|----------|----------|------|
| R12 | registerImage | JS 中用绝对路径调用 registerImage | 替换生效 | 未测 |
| R13 | registerAudio | JS 中用绝对路径调用 registerAudio | 替换生效 | 未测 |
| R14 | getResourceRegistry | F12: `ModResourceLoader.getResourceRegistry()` | 返回所有已注册资源 | 未测 |

### 加密绕过

| # | 测试项 | 测试方式 | 预期结果 | 状态 |
|---|--------|----------|----------|------|
| R15 | 图片加密绕过 | 替换加密游戏的原图 → 查看 mod 图片 | mod 图片不经过解密流程，正常显示 | 未测 |
| R16 | 音频加密绕过 | 替换加密游戏的原音频 | mod 音频不经过解密，正常播放 | 未测 |

### 参数开关

| # | 测试项 | 测试方式 | 预期结果 | 状态 |
|---|--------|----------|----------|------|
| R17 | enableResourceReplacement=false | 关闭参数 → 所有替换声明 | 替换不生效，原资源不变 | 未测 |
| R18 | enableEncryptionBypass=false | 关闭参数 → 加载 mod 资源 | mod 资源走正常解密流程 | 未测 |

### 安全

| # | 测试项 | 测试方式 | 预期结果 | 状态 |
|---|--------|----------|----------|------|
| R19 | 路径安全检查 | manifest 中写 `../../otherMod/img/x.png` | 被拒绝，控制台报 unsafe path | 未测 |

---

## ModLoader 联动

| # | 测试项 | 测试方式 | 预期结果 | 状态 |
|---|--------|----------|----------|------|
| L1 | 冲突日志面板注册 | 启用 ModDataLoader → 打开管理器 → 看右下角 ⚠ | 按钮出现，点击展开冲突面板 | ✅ 已测 |
| L2 | 冲突面板随管理器显隐 | 关闭管理器 → ⚠ 消失；打开 → ⚠ 重现 | 按钮跟随管理器状态 | ✅ 已测 |
| L3 | @base 依赖守卫（单层） | 关闭 ModDataLoader → 开 TestMDL-V2 → F5 | 游戏正常进入，日志显示 [依赖守卫] | ✅ 已测 |
| L4 | @base 依赖守卫（链式） | A 依赖 B，B 依赖 C，关闭 C | A 和 B 都被跳过 | 未测 |
| L5 | @base 守卫 + 工坊 mod | 工坊 mod 声明 @base → 关闭 base | 工坊 mod 被跳过 | 未测 |
| L6 | UI 依赖警告 + 守卫双重保护 | 管理器中显示红色 ❌ 依赖警告 → 确认游戏不崩溃 | 警告可见 + 守卫拦截加载 | 未测 |

---

## 统计

| 模块 | 总项数 | 已测 | 未测 | 完成率 |
|------|--------|------|------|--------|
| ModDataLoader | 26 | 7 | 19 | 27% |
| ModResourceLoader | 19 | 4 | 15 | 21% |
| ModLoader 联动 | 6 | 3 | 3 | 50% |
| **合计** | **51** | **14** | **37** | **27%** |
