# 小型 Mod 商店

> 状态：**已全面落地**（Phase 0～1.5 · §11 测试清单全部通过，2026-08-22 含 Gitee + 本地 HTTPS E2E · V4.2.0 管理器详情更新日志 + 公用弹窗）  
> 目标：为未开通 Steam 创意工坊的发行场景，提供本地 `_localmods` 的发现、下载与更新。  
> 创意工坊 Mod 仍由 Steam 更新，本商店不介入。

相关：[`ModLoader_模块结构.md`](ModLoader_模块结构.md)（libs 扩展边界）· [`使用手册.md`](使用手册.md)（libs 有无即开关）

---

## 1. 背景与目标

- 游戏未开创意工坊时，Mod 作者不必依赖社区帖反复发文件，玩家也不必天天刷更新。
- 一款游戏可有多名 Mod 作者；商店支持**订阅多个来源**。
- 做成通用 libs 框架：托管不绑定某一平台（Gitee / 自建 HTTPS 均可；框架不预填真实订阅）。
- 作者若已开创意工坊：继续走 Steam，不必用本商店。

### 产品形态

进入 **设置 → Mod 商店** 后：

- **来源 Tab**：`全部` + 各已订阅来源
- **状态 Tab**：`全部` | `可更新` | `新增` | `未下载`（与来源 Tab 交集筛选）
- 列表展示各来源的 Mod；显示本地/商店版本、包大小
- 按钮：未下载为「下载」，已装且商店更新为「更新」；进行中显示进度/速度/ETA

---

## 2. 范围与非目标

### 已实现能力

- 多源订阅（增删、启用/禁用）
- 来源 Tab + **状态 Tab** 浏览、列表比对
- 整包 zip 下载 → sha256 校验 → 安全解压到 `_localmods/<packageName>/`
- 设置齿轮入口（`registerLogEntry`）
- 协议通用；**订阅管理 UI 可调** `maxDownloadBytes`（默认 100MB）
- 内嵌纯 Node `zlib` 解压（不新增 npm 依赖）
- **>50MB** 断点续传（Range + `config/.modstore-tmp/resume/<sha256>.partial`）
- 一键更新已安装（**跳过多源** Mod，须玩家逐条选来源）
- 齿轮左侧**绿色数字角标**（可更新数）；冲突仍为右侧红色 `!`
- **UI 多语言**（2026-08-24）：简中 / 繁中 / English，内嵌 `STORE_I18N_PACKS`，跟随管理器 `ml_language`（详见 §13）
- **Mod 更新日志**（2026-08-24）：`changelogUrl`、商店按钮、管理器详情、公用 MD 弹窗（详见 §5.1）

### 非目标（不做）

- 差分补丁、评分评论、账号体系
- 静默自动安装新 Mod（只做发现 + 玩家确认安装）
- 改工坊订阅 / 扫描逻辑
- 原生主列表角标、详情页「一键更新」（需额外 API）
- 装完后同步主列表：管理器主界面已有「**刷新列表**」，无需额外 `refreshMods` API
- 玩家/作者长文档见 [`使用手册.md`](使用手册.md)，作者打包见 [`tools/modstore/gui/README.md`](../../tools/modstore/gui/README.md)
- 自动剥除 zip 根目录、扁平 zip 兼容（**只认标准一层包目录**，见 §7.1）

---

## 3. 架构落点

| 层 | 位置 | 职责 |
|----|------|------|
| 商店客户端 | `js/mods/libs/modStore.js` | 订阅、拉目录、比对、下载、解压、面板 UI |
| 本地配置 | `js/mods/config/mod_store.json` | 已订阅源、`maxDownloadBytes`、`suppressInstallHint` 等 |
| 远程协议 | 各源 `catalog.json` + 各包 zip | 作者 / 发行方自托管 |
| 发布工具 | `tools/modstore/modStorePublish.js` 等 | 打包、sha256、catalog 更新 |
| 本地测试服 | `tools/modstore/test/modStoreLocalHttps.js` | 开发用 HTTPS 双源/续传/错误场景（非运行时依赖） |
| 管理器本体 | 小改 | `registerLogEntry` 增加可选 `getUpdateCount`；主列表按钮文案「刷新列表」 |

### 入口

- `window.ModLoader.registerLogEntry({ id, label, getUpdateCount?, render })`
- **绿色角标**：各 entry 的 `getUpdateCount()` 之和（Mod 商店统计可更新条目）
- **红色 `!`**：各 entry 的 `getConflictCount()` 之和（前置 Mod 冲突等）
- 打开管理器后后台预拉已启用源的 catalog（供角标与默认状态 Tab）

存在即生效，删除 `libs/modStore.js` 即关闭。

---

## 4. 远程协议（通用）

（§4.1～4.4 同原稿；补充实测结论如下。）

### 托管实测备忘（Gitee）

| 方式 | 结论 |
|------|------|
| 仓库 **raw** 小 zip（几 MB） | 可用 |
| 仓库 **raw** >50MB | **HTTP 403**（社区版 Git 单文件 50MB 上限） |
| **Release 附件** ~64MB | 可下载（~2MB/s 量级）；**不支持 Range**，游戏内断点续传测不到 |
| 大包分发建议 | Release / CDN / 对象存储；catalog 只改 `downloadUrl` |

`127.0.0.1` / `localhost` 自签 HTTPS：客户端允许（仅本地测试）。

---

## 5. 本地状态与比对

**粒度**：商店列表、下载、更新均以 **`packageName`（`_localmods` 包目录名）** 为单位，与 Mod 管理器「整包安装/删除」一致；装完后管理器内仍可按包内每个 `.js` 单独开关。

| 状态 | 条件 | 主按钮 |
|------|------|--------|
| 未下载 | `_localmods` 无对应包 | **下载** |
| 已最新 | 本地 version ≥ 商店 | 禁用「已是最新」 |
| 可更新 | 本地 version < 商店 | **更新** |
| 未知 | 本地无可靠 version | 「下载覆盖」 |

**版本读取**（与打包工具一致）：

| 包类型 | 本地版本来源 |
|--------|----------------|
| 单脚本 | `modloader.json` → 插件头 `@version` |
| 多脚本 | **仅** `modloader.json` 的 `version`（包版本）；不回退读某个 js |

**catalog 约定**：`id` 与 `packageName` 相同（客户端加载时会规范化）；zip 名为 `<packageName>-<version去V前缀>.zip`（如 `V1.0.0` → `ExampleMod-1.0.0.zip`）。`summary` 为列表简介。列表标题一律用 **`packageName`**（包目录名），**勿写 `title`**（历史字段，已废弃；旧 catalog 中残留项由发布工具写入时自动剔除）。

| 字段 | 必填 | 说明 |
|------|------|------|
| `packageName` | ✓ | `_localmods` 目录名；商店列表标题 |
| `version` | ✓ | 推荐 `VX.Y.Z` |
| `downloadUrl` | ✓ | `https` 直链 |
| `sha256` | ✓ | 64 位小写 hex |
| `size` | 建议 | 大包断点续传需准确值 |
| `summary` | 建议 | 来自 `modloader.json` `description` |
| `changelogUrl` | 可选 | 包根有 `CHANGELOG.md` 时由打包工具写入；指向仓库 `changelog/<packageName>.md` 的 https raw；旧客户端忽略 |
| `hosts` | 建议 | 下载 / changelog 域名白名单（zip 与日志不同域时须都列入） |
| ~~`title`~~ | — | **已废弃**（2026-08-23 起发布工具不再写入；客户端 UI 不读） |

### 5.1 Mod 更新日志（changelog）

**目标**：玩家下载/更新前可预览本 Mod 的 Markdown 更新说明；无日志的包零负担。

| 项 | 约定 |
|----|------|
| 包内文件 | 根目录 **`CHANGELOG.md`**（唯一合法名；其它文件名不认） |
| 进 zip | 有则随包打进 zip（与其它文件同一套 `collectFiles`）；**无则不写** `changelogUrl` |
| 仓库布局 | 打包时复制到 **`changelog/<packageName>.md`**，生成 raw `changelogUrl` |
| catalog 字段 | 可选 **`changelogUrl`**（与 `downloadUrl` 对称） |
| 安全 | https + 条目 `hosts` 校验；拉取体积上限 **≤ 512KB** |
| CDN ≠ Git raw | zip 走 CDN、日志走 Gitee/GitHub raw 时，`hosts` 须同时包含两边域名 |
| 失败提示 | 弹窗内明确文案（如「无法加载更新日志」/「链接错误，未拉取到更新日志」），不静默 |
| 兼容 | 旧管理器 / 无该字段的 catalog → 无按钮、行为不变 |

**按钮是否出现**：catalog 条目有非空 `changelogUrl` → 显示「更新日志」；否则不显示。

**管理器详情是否出现**：包元数据有版本号（优先 `modloader.json.version`，单脚本可回退 `@version`；多脚本不回退）且包根存在 `CHANGELOG.md` → 版本旁显示「更新日志」。多脚本包共用包根一份日志。**功能 Mod 与前置 Mod（ModDataLoader / ModResourceLoader）规则相同。**

**点按钮后读哪里**（列表刷新**不**预拉日志）：

| 情况 | 优先 | 回退 |
|------|------|------|
| 已最新（本地版本 = 商店版本） | `_localmods/<包名>/CHANGELOG.md` | 无本地文件或空 → 拉 `changelogUrl` |
| 可更新 / 本地无版本 / 未下载 | 拉 `changelogUrl` | — |
| 远程有 URL 但拉取失败或空内容 | — | 弹窗提示链接错误 / 未拉取到更新日志 |

要点：内容只来自**已安装包根**或 **catalog 链接**；不从 zip 外其它本地路径读。已最新先本地再远程，兼顾省流量与「旧安装包尚无该文件」的回退。

**UI 行布局**：

```
[下载/更新]  [更新日志]  进度/提示文案……
              ↑ 仅有 changelogUrl 时
```

进度文案固定在最右侧，避免下载时按钮左右跳动。

**弹窗**：商店与管理器详情共用 `ModLoader.showChangelogModal(title, body, { mode })`（`.ml-changelog-*` + `marked`）。管理器头部「(日志)」走 `showChangelog()` → 该公用弹窗；详情「更新日志」读包根 `CHANGELOG.md`。标题示例：`随身传送 V1.2.1 更新日志`。

**发布工具**：检测包根 `CHANGELOG.md` → 有则复制到仓库 `changelog/` 并写 `changelogUrl` + 合并 `hosts`；无则跳过且清理 catalog 中旧 `changelogUrl`（避免残留）。

---

## 6. UI 规格

```
[ 订阅管理 ]  [ 刷新 ]  [ 更新已安装(N) ]

来源 Tab:  全部 | 来源A | 来源B | ...
状态 Tab:  全部 | 可更新(N) | 新增(N) | 未下载(N)

列表行:
  标题（多源时「多源」标记）
  本地 / 商店 / 大小 / 来源
  [下载/更新]  [更新日志?]  进度 已下/总大小 % 速度 ETA
```

**进入商店时状态 Tab 默认**（来源始终「全部」）：

1. 有可更新 → **可更新**
2. 否则有未下载 → **未下载**
3. 否则 → **全部**

用户手动切换状态 Tab 后，本次会话内点「刷新 catalog」不覆盖其选择；再次进入商店重算默认。

**订阅管理**：可编辑单包体积上限（MB）；装完提示可勾选「不再提示」，引导主界面「刷新列表」。

列表滚动条复用管理器 `ml-list-scroll` 细圆角样式；下载/更新进度刷新时**保持滚动位置**。

---

## 7. 下载与安装管线（安全）

（§7.1 标准 zip 结构同原稿。）

断点续传：catalog 提供准确 `size` 且 **>50MB** 时启用；中断后可续传（含关闭游戏再开）；服务器须支持 **HTTP Range（206）**。

---

## 8. 管理器 API

- 商店在 libs；`registerLogEntry` 扩展 **`getUpdateCount`**（与 `getConflictCount` 分离）
- 装包后玩家点主界面「**刷新列表**」即可同步 `_localmods`，无需 `ModLoader.refreshMods()` 等额外 API

---

## 9. 交付分期

### Phase 0 · 协议与模板 ✅

### Phase 1 · libs MVP ✅

### Phase 1.5 · 发布工具 ✅

| 文件 | 说明 |
|------|------|
| `tools/modstore/modStorePublish.js` | 打包标准 zip、sha256、可选更新 catalog |
| `tools/modstore/modstore-catalog.template.json` | catalog 模板 |
| `tools/modstore/dist/` | 默认输出（gitignore） |
| `tools/modstore/test/_modStore_selftest.js` | zip 结构 / 版本比对自检 |
| `tools/modstore/test/modStoreLocalHttps.js` | 本地 HTTPS 测试服（setup / run / reset；**仅开发用，测完应停服**） |

**本地 HTTPS 测试服**（`node tools/modstore/test/modStoreLocalHttps.js`）：

| 端口 | 场景 |
|------|------|
| 18443 | 双源 B（元素瓶 V1.0.2）、断点续传大包（~56MB、100KB/s、20MB 断线） |
| 18444 | catalog sha256 故意错误 |
| 18445 | 下载 URL 404 |

产物目录 `tools/modstore/test/local-test/`（gitignore）。测完后关闭终端或结束 node 进程；正常游玩勿保留 `127.0.0.1` 测试订阅。

示例远程源（作者自管）：`tools/gitee-catalog-seed/`（独立 git，主仓 gitignore）

---

## 10. 已确认决策摘要

| 项 | 结论 |
|----|------|
| 同包名多源 | UI 提示；最后安装有效；**一键更新跳过**多源 |
| 体积上限 | 默认 100MB；订阅管理可调 |
| sha256 | **强制** |
| 装完同步主列表 | 点「**刷新列表**」（非重启游戏） |
| zip 包根 | 只认唯一顶层目录 = `packageName` |
| 大包 | Release/CDN；raw 不适合 >50MB |
| 状态筛选 | 来源 Tab × 状态 Tab；智能默认见 §6 |
| 角标 | 绿色=可更新 + 未读新增（按 packageName 去重）；红色!=冲突 |
| catalog `title` | **已废弃**（2026-08-23）；列表用 `packageName`；发布工具 `stripDeprecatedCatalogFields` 写入时剔除 |
| catalog `changelogUrl` | 可选；包根 `CHANGELOG.md` 才写入；读策略与 UI 见 **§5.1** |

---

## 11. 测试清单

- [x] 单源：未下载 → 下载 → 可更新 → 已最新
- [x] 双源：全部 Tab 合并；单源 Tab 过滤正确
- [x] 同 id 多源：均可见；须手动选来源更新；一键更新跳过
- [x] 错误：HTTP 404、hash 错 → 正确报错（本地 HTTPS 18444/18445）
- [x] 错误：超过 `maxDownloadBytes`（订阅管理调 1MB 测）
- [x] 错误：扁平 zip / 路径穿越等 → `tools/modstore/test/_modStore_selftest.js` 覆盖
- [x] 合法标准 zip → `_localmods` + 主列表「刷新列表」可识别
- [x] 单源 catalog 失败不影响其他源（设计支持；本地/ Gitee 抽测）
- [x] 空源可开商店；手动订阅 Gitee catalog 全流程
- [x] 下载进度：大小、已下/总%、速度、ETA
- [x] **>50MB 断点续传**：本地服 100KB/s + 20MB 断线；`Error: aborted` 后续传 OK；关游戏再开仍可续
- [x] Gitee 小 zip raw 下载；Release 大包下载（无 Range）
- [x] 订阅：禁用/删除源
- [x] 绿色可更新角标 / 状态 Tab 默认与筛选
- [x] 第二处非 Gitee 静态 HTTPS（`tools/modstore/test/modStoreLocalHttps.js` 18443/18444/18445；双源、续传、hash 错、404、体积上限）

**E2E 验收摘要（2026-08-22）**：Gitee 小 zip raw + Release 大包；本地 HTTPS 覆盖错误路径、>50MB 断点续传（含关游戏再开）、双源手动选源、一键更新跳过多源、列表滚动/进度刷新不跳顶。本地测试服已停。

---

## 12. 发行与文档

### 运行时交付

- `libs/modStore.js`、`config/mod_store.json`（空源模板）
- 发布工具与自检脚本（§9）
- 不预置真实 `catalogUrl`

### 文档

- [`使用手册.md`](使用手册.md) 商店章节（制作者 / 玩家 / 作者）
- 作者打包：[`tools/modstore/gui/README.md`](../../tools/modstore/gui/README.md)
- [`README.md`](README.md) / [`README-en.md`](README-en.md) 功能与结构树
- [`ModLoader_测试文档.md`](ModLoader_测试文档.md) §O Mod 商店

### catalog 字段清理（2026-08-23）

- 废弃 catalog 条目 `title`：商店 UI、打包 GUI 均只展示 `packageName`
- 发布核心 `modStorePublishCore.js`：`upsertCatalogEntry` 不再保留 `title`；`stripDeprecatedCatalogFields` 写入前剔除
- 作者远程 catalog（Gitee）已全量去掉 `title`；增量发布不会带回该字段
- 运行时 `modStore.js` 解析 catalog 时不再读取 `title`（兼容旧远程 catalog 亦忽略）

### Mod 商店 UI 多语言（2026-08-24）

- `libs/modStore.js` 内嵌 `STORE_I18N_PACKS`（zh_CN / zh_TW / en），跟随管理器 `ml_language`；详见 §13

### 作者托管说明

- Gitee raw / Release 体积与断点续传限制见 §4「托管实测备忘」；[`使用手册.md`](使用手册.md) 商店章节亦有摘要

---

## 13. Mod 商店多语言

### 方案

- **不**写入 `config/language/` 管理器语言包，**不**另建独立语言文件
- 词条内嵌于 `libs/modStore.js` 顶部 `STORE_I18N_PACKS`（可追加语言码块扩展）
- 语言读取：`modloader_config.json` → `ml_language`（与管理器设置一致）
- **无热刷新**：打开商店面板时 `registerStoreEntry()` + `renderPanel()` 按当前语言渲染；设置菜单入口 `label` 同步更新
- 扩展新语言时，贡献者须**同时为管理器** `config/language/` 提供对应语言包，否则管理器无法切换到该语言（符合预期）

### 查找链

当前 `ml_language` → `STORE_I18N_PACKS[lang]` → `zh_CN` 回退 → 键名原文

---
