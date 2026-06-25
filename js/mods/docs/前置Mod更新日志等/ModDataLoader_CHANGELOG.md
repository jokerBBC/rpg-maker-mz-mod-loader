# ModDataLoader 更新日志

## V2.0.0 (2026-06-03)

### 全新重写

- 基于社区版 V1.0.5 测试反馈，从零重写架构
- 文档：`_localmods/ModDataLoader/调用规范.md`

### 数据注入

- **registerData(dataType, entries, mode)**：合并/替换/新增数据库条目
- **registerMapData(mapId, mapData, mode)**：地图数据修改，event 级浅合并（不深入 pages）
- **registerDataFromFile / registerMapDataFromFile**：从外部 JSON 文件注册
- **manifest 自动扫描**：`modloader.json` 中 `data.records` 和 `data.patches` 声明式数据注入，零 JS 代码
- 支持 `merge`（字段级合并）、`replace`（整条替换）、`add`（仅新增）三种模式

### 智能 ID 迁移

- **registerStableEntry(dataType, entry)**：带稳定标识的新增条目，自动收紧 ID 防空洞数组
- **stableKey** 格式：`<MDL:sk:key>` 标记在 `note` 字段，存档加载时自动迁移
- **findIdByStableKey** / **migrateSaveData** / **getMigrationLog**：查询与迁移 API

### 冲突检测与报告

- 字段级冲突追踪（`_conflictLog`），记录每个字段的每次修改来源
- **getConflictReport()**：返回去重后的冲突列表（同 Mod 不同来源视为独立条目）
- 与 ModLoader 冲突日志面板集成（`registerLogEntry`）
- 中文字段名翻译（name→名称, price→价格 等常见字段）

### GameAdapter 插件架构

- **sorajm 加密兼容**：Hook `DataManager.onLoad` 适配 `.sora` 加密数据文件
- **YEP null-slot 兼容**：包装 5 个 `DataManager` 处理器，防止空洞数组崩溃
- **compactNewEntryId**：新增条目 ID 强制收紧，避免稀疏数组

### 插件参数

- `debugLevel`：调试等级（关闭/基本/详细）
- `enableDataInjection`：启用数据注入
- `enableMigration`：启用智能 ID 迁移

### 依赖

- 无前置依赖，作为 `@base` 被其他 Mod 引用

---

## V1.0.5 (社区版)

- 初始版本，由社区开发维护
- 提供基础数据合并 API，V2 在此基础上重写了架构和稳定性
