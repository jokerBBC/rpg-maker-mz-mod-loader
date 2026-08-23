# 小型 Mod 商店 · 拓展计划

> 状态：**Phase 1 + 1.5 已完成 · §11 测试清单全部通过**（2026-08-22，含 Gitee + 本地 HTTPS E2E）  
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

### 做（Phase 1 / MVP）

- 多源订阅（增删、启用/禁用）
- 来源 Tab + **状态 Tab** 浏览、列表比对
- 整包 zip 下载 → sha256 校验 → 安全解压到 `_localmods/<packageName>/`
- 设置齿轮入口（`registerLogEntry`）
- 协议通用；**订阅管理 UI 可调** `maxDownloadBytes`（默认 100MB）
- 内嵌纯 Node `zlib` 解压（不新增 npm 依赖）
- **>50MB** 断点续传（Range + `config/.modstore-tmp/resume/<sha256>.partial`）
- 一键更新已安装（**跳过多源** Mod，须玩家逐条选来源）
- 齿轮左侧**绿色数字角标**（可更新数）；冲突仍为右侧红色 `!`

### 不做（MVP）

- 差分补丁、评分评论、账号体系
- 静默自动安装新 Mod（只做发现 + 玩家确认安装）
- 改工坊订阅 / 扫描逻辑
- 原生主列表角标、详情页「一键更新」（二期；需额外 API）
- Phase 1 **不**给 ModLoader 增加 `refreshMods`：装完后点主界面「**刷新列表**」即可
- Phase 1 玩家/作者长文档已补入 [`使用手册.md`](使用手册.md)，作者打包见 [`tools/modstore/gui/README.md`](../../tools/modstore/gui/README.md)
- 自动剥除 zip 根目录、扁平 zip 兼容（**只认标准一层包目录**，见 §7.1）

---

## 3. 架构落点

| 层 | 位置 | 职责 |
|----|------|------|
| 商店客户端 | `js/mods/libs/modStore.js` | 订阅、拉目录、比对、下载、解压、面板 UI |
| 本地配置 | `js/mods/config/mod_store.json` | 已订阅源、`maxDownloadBytes`、`suppressInstallHint` 等 |
| 远程协议 | 各源 `catalog.json` + 各包 zip | 作者 / 发行方自托管 |
| 发布工具 | Phase 1.5 | `tools/modstore/gui/` + `modStorePublishCore.js` |
| 开发测试 | 可选 | 本地 HTTPS 双源/续传/错误场景（非框架仓库分发） |
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

**catalog 约定**：`id` 与 `packageName` 相同（客户端加载时会规范化）；zip 名为 `<packageName>-<version去V前缀>.zip`（如 `V1.0.0` → `ExampleMod-1.0.0.zip`）。`summary` 为列表简介；`title` 可省略（UI 展示包目录名）。

| 字段 | 必填 | 说明 |
|------|------|------|
| `packageName` | ✓ | `_localmods` 目录名 |
| `version` | ✓ | 推荐 `VX.Y.Z` |
| `downloadUrl` | ✓ | `https` 直链 |
| `sha256` | ✓ | 64 位小写 hex |
| `size` | 建议 | 大包断点续传需准确值 |
| `summary` | 建议 | 来自 `modloader.json` `description` |
| `hosts` | 建议 | 下载域名白名单 |

---

## 6. UI 规格（已实现）

```
[ 订阅管理 ]  [ 刷新 ]  [ 更新已安装(N) ]

来源 Tab:  全部 | 来源A | 来源B | ...
状态 Tab:  全部 | 可更新(N) | 新增(N) | 未下载(N)

列表行:
  标题（多源时「多源」标记）
  本地 / 商店 / 大小 / 来源
  [下载/更新]   进度 已下/总大小 % 速度 ETA
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

## 8. 管理器 API（分期）

### Phase 1（已落地）

- 商店在 libs；`registerLogEntry` 扩展 **`getUpdateCount`**（与 `getConflictCount` 分离）

### Phase 2（可选）

- `ModLoader.refreshMods()` 等

---

## 9. 实施分期

### Phase 0 · 协议与模板 ✅

### Phase 1 · libs MVP ✅

### Phase 1.5 · 发布工具 ✅

框架仓库随附 **GUI 打包工具** 与共用核心：

| 文件 | 说明 |
|------|------|
| `tools/modstore/modStorePublishCore.js` | 打包标准 zip、sha256、更新 catalog（GUI 共用） |
| `tools/modstore/gui/` | Mod 作者图形打包工具 |
| `tools/modstore/modstore-catalog.template.json` | catalog 模板 |
| `tools/modstore/gui/user-data/` | GUI 本地设置与输出（gitignore） |

> CLI 批量脚本、本地 HTTPS 测试服等开发/维护者工具不在框架仓库内分发。

示例远程源（作者自管）：独立 git 仓托管 `catalog.json` + `packages/`（主仓不追踪）

### Phase 2 · 管理器小 API（可选）

### Phase 3 · 体验（可选）

- 打开管理器时后台拉 catalog 更新角标（部分已有）
- changelog、失败重试、订阅导入/导出
- **Mod 商店 UI 多语言**：`modStore.js` 文案迁入 `config/language/`（见 §13）

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

---

## 11. 测试清单（Phase 1）

- [x] 单源：未下载 → 下载 → 可更新 → 已最新
- [x] 双源：全部 Tab 合并；单源 Tab 过滤正确
- [x] 同 id 多源：均可见；须手动选来源更新；一键更新跳过
- [x] 错误：HTTP 404、hash 错 → 正确报错（本地 HTTPS 18444/18445）
- [x] 错误：超过 `maxDownloadBytes`（订阅管理调 1MB 测）
- [x] 错误：扁平 zip / 路径穿越等 → 发布核心自检覆盖
- [x] 合法标准 zip → `_localmods` + 主列表「刷新列表」可识别
- [x] 单源 catalog 失败不影响其他源（设计支持；本地/ Gitee 抽测）
- [x] 空源可开商店；手动订阅 Gitee catalog 全流程
- [x] 下载进度：大小、已下/总%、速度、ETA
- [x] **>50MB 断点续传**：本地服 100KB/s + 20MB 断线；`Error: aborted` 后续传 OK；关游戏再开仍可续
- [x] Gitee 小 zip raw 下载；Release 大包下载（无 Range）
- [x] 订阅：禁用/删除源
- [x] 绿色可更新角标 / 状态 Tab 默认与筛选
- [x] 第二处非 Gitee 静态 HTTPS（双源、续传、hash 错、404、体积上限；开发环境抽测）

**E2E 验收摘要（2026-08-22）**：Gitee 小 zip raw + Release 大包；本地 HTTPS 覆盖错误路径、>50MB 断点续传（含关游戏再开）、双源手动选源、一键更新跳过多源、列表滚动/进度刷新不跳顶。本地测试服已停。

---

## 12. 发行与文档

### 随 Phase 1 交付 ✅

- `libs/modStore.js`、`config/mod_store.json`（空源模板）
- 发布工具与自检脚本（§9）
- 不预置真实 `catalogUrl`

### 文档（2026-08-23 已补）✅

- [`使用手册.md`](使用手册.md) 商店章节（制作者 / 玩家 / 作者）
- 作者打包：[`tools/modstore/gui/README.md`](../../tools/modstore/gui/README.md)
- [`README.md`](README.md) / [`README-en.md`](README-en.md) 功能与结构树
- [`V4.1_测试文档.md`](V4.1_测试文档.md) §O Mod 商店

### 暂缓

- 飞书整合包攻略（待 Mod 更新后再写商店玩法）
- Gitee raw/Release 配额与作者托管建议（§4 已有摘要）

---

## 13. 待开发 / 内部跟进

| 项 | 状态 | 说明 |
|----|------|------|
| Mod 商店 UI 多语言 | 待开发 | 当前 `modStore.js` 文案为硬编码中文；需迁入 `config/language/` 并与管理器语言切换联动 |
| catalog / 打包链路字段清理 | 待调查 | 商店拓展与打包工具 UI 已不再展示部分历史字段；待确认运行时与发布工具无依赖后，再安全移除死代码 |
