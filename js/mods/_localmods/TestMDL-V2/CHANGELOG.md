# TestMDL-V2 更新日志

## V2.0.0 (2026-06-03)

### 初始版本

- **新增**：ModDataLoader V2 功能验证 Mod
- **测试 1**：JS API merge 模式修改物品名称与价格
- **测试 2**：JS API 新增条目（带 stableKey）验证智能 ID 迁移
- **测试 3**：manifest `data.records` 从 `data/TestItems.json` 自动加载
- **测试 4**：manifest `data.patches` 字段级补丁（与 JS API 产生冲突 → 验证冲突日志）
- **依赖**：需同时启用 ModDataLoader
