# modloader 模块测试

位于仓库根 `test/`，**在 `js/mods` 之外**：在线更新 catalog 只扫描 `js/mods`，本目录永不下发。

本目录**随主仓开源**（GitHub / Gitee 均可查看），并**打进每个 Release 的 zip**（`rpg-maker-mz-mod-loader<版本>.zip` 内与 `js/` 并列）。玩家解压后不需要可整个删掉；Mod 作者 / 游戏作者魔改管理器时，解压到游戏根目录后执行 `node test/run-all.js` 即可跑全套回归（路径全部相对，无需仓库环境）。测试引用源码走 `../js/mods/modloader/<模块>`。

## 命名约定

拆出多个子模块后，测试资产以**模块名为前缀**，避免 fixture 对不上模块：

| 类型 | 格式 | 示例 |
|------|------|------|
| 自动测脚本 | `{模块名}.test.js` | `paramTypeKit.test.js`、`installClassifier.test.js` |
| 插件头 fixture | `{模块名}-{场景}.js` | `modMetadata-basic-params.js` |

新增模块（如第 2 波 `dependencyResolver`）时，在同目录追加 `dependencyResolver.test.js` 与 `dependencyResolver-*.js` fixture 即可。

## Node 自动测

在仓库根目录执行：

```bash
node test/paramTypeKit.test.js
node test/modMetadata.test.js
node test/dependencyResolver.test.js
node test/paramValues.test.js
node test/packageDiscovery.test.js
node test/configCore.test.js
node test/installClassifier.test.js
node test/pluginNameConflict.test.js
node test/modCatalog.test.js
node test/workshopBridge.test.js
node test/scanPipeline.test.js
node test/installIo.test.js
node test/run-all.js
```

## fixtures/（插件头假数据）

| 文件 | 模块 | 用途 |
|------|------|------|
| `modMetadata-basic-params.js` | modMetadata | 基础 @type / note `\n` |
| `modMetadata-schema-mod.js` | modMetadata | @define-schema / struct / table |
| `modMetadata-missing-default.js` | modMetadata | 严苛锁（缺 @default） |
| `modMetadata-dependencies.js` | modMetadata | @base / @orderAfter 解析 |
| `dependencyResolver-plugins-fixture.js` | dependencyResolver | 假 plugins.js |
| `dependencyResolver-mod-list.json` | dependencyResolver | 五态组合 mod 列表 |
| `packageDiscovery-entries-valid/` | packageDiscovery | 合法 manifest entries |
| `packageDiscovery-malicious-entries/` | packageDiscovery | 路径穿越 / 非法 entry |
| `packageDiscovery-fallback/` | packageDiscovery | 无 manifest，扫包根 .js |
| `configCore-legacy-key.json` | configCore | 旧键 `../mods/<脚本>` fallback |
| `configCore-new-key-priority.json` | configCore | 新键优先于旧键 |
| `configCore-workshop-partial.json` | configCore | workshop 段缺字段合并 |

## 游戏内手工测 Mod（`_localmods/`，与 Node 测分离）

| 包名 | 用途 |
|------|------|
| `TestDbTypes` | 数据库引用下拉 |
| `TestSchemaMod` | struct / table 参数 UI |
| `TestStrictLock` | 严苛锁（无齿轮 / params 空） |
