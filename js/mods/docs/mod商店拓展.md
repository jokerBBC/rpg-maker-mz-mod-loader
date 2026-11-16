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
状态 Tab:  全部(N) | 可更新(N) | 新增(N) | 未下载(N)

列表行:
  标题（多源时「多源」标记）
  本地 / 商店 / 大小 / 来源
  [下载/更新]  [更新日志?]  进度 已下/总大小 % 速度 ETA
```

四个状态 Tab 均常显数字计数（含 0，0 用弱化样式）。数字按**当前来源 Tab**统计，口径与列表一致（按 `sourceId + packageName` 去重）：`全部` = 当前来源下条目总数，其余为对应状态的行数，即点开该 Tab 后列表显示的条数。切换来源 Tab、刷新 catalog、消除新增通知、下载/更新完成后都会重算。

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

## 14. Gitee raw 走 CDN 后被 SNI 阻断（2026-11-14）

### 现象

- 商店所有源同时失败，报 `Error: read ECONNRESET`，面板提示「所有已启用来源均加载失败」；刷新、重开游戏都无效
- 同一时刻 `gitee.com` 主站、仓库页面、API 全部正常，只有 raw 取源与 zip 下载失败
- 「Mod 源发现」的远程清单同样失败（退回内置快照）

### 根因

- Gitee 的 `/raw/` 会 `302` 跳到 `https://raw.giteeusercontent.com/<owner>/<repo>/raw/<ref>/<path>?signature=…`，任意仓库（含公共大库）行为一致——**不是仓库被限制，也不是商店链接写错**；这是平台既有设计（见 §15.3 官方帮助文档），并非 2026-11-14 才变更
- 该 CDN 域名在部分运营商线路上被按 **SNI 精确小写字符串** 匹配后直接 RST（TLS 握手中断），Node 侧表现为 `ECONNRESET`

### 判据（三条互证，2026-11-14 实测）

1. 同一 IP **不带 SNI**、只发 `Host: raw.giteeusercontent.com` → `200`，内容与 `sha256` 正确（说明服务器与内容都没问题）
2. SNI 换成全大写 `RAW.GITEEUSERCONTENT.COM` → 握手成功、`200`
3. 境外 SSL Labs 对同一 IP 做完整握手 → `READY`（B 级）
4. 反证：手机连同一 WiFi 打开同一签名 URL → `ERR_CONNECTION_RESET`；电脑换手机热点 → 正常

> **切分责任**：Gitee 服务端正常、证书正常、DNS 正常；故障在「本机 → Gitee」链路上的中间设备。
> 换 IP、换 DNS 均无效（多个承载同一证书的 CDN IP 表现一致）。

### 改动

- `libs/modStore.js`
  - 新增 `SNI_RETRY_HOST_RE = /(^|\.)giteeusercontent\.com$/i`、`isSniRetryableHost()`、`isConnResetError()`
  - `httpsTlsOptions(hostname, sniAttempt)`：`sniAttempt` 为真时把 `servername` 改为 `hostname.toUpperCase()`
  - `requestBuffer()`（catalog / changelog）与 `pipeResponse()`（zip 下载）在 `req.on('error')` 里判断：非超时、非续传失败、首次尝试、命中域名且错误为连接重置 → 以 `sniAttempt=1` 重跑一次
  - 重定向后 `sniAttempt` 归零（每跳各一次额度，避免签名 URL 被反复重放）
  - `libs/modLoaderUpdater.js`：`requestBuffer()` 同规则——管理器在线更新的 `channel.json` / `catalog.json` / 各更新文件下载都经此函数，Gitee 分支 302 后的 CDN 请求同样命中；第一跳 `gitee.com` 不设 `servername`，重定向后 `sniAttempt` 归零；双镜像切换与 sha256 校验流程不变
- `_localmods/Mod源发现/Mod源发现.js`：`httpsGetJson(rawUrl, redirectLeft, sniAttempt)` 同规则

### 注意

- **curl 不能用来验证尾点方案**：libcurl 会规范化 hostname 尾点，`curl https://raw.giteeusercontent.com./…` 仍走原 SNI、看起来「方案失效」。验证请用 Node（`https.request` + `servername`）
- 大小写重试依赖「匹配方逐字节比对」这一前提；若对方改为大小写不敏感匹配，本方案立即失效，届时只能走缓存 / 镜像。属链路博弈，不是协议层修复
- 决策（2026-11-14）：暂以该取巧方案过渡，不引入代理 / 第三方镜像；若匹配方升级或出现新屏蔽形态，再评估缓存 / 多 CDN / Releases 附件等长期方案
- 超时不重试（避免 60s × 2 的翻倍等待）；仅在握手级错误上重试

### 验证记录

- 线路自检：
  - `openssl s_client -connect raw.giteeusercontent.com:443 -servername raw.giteeusercontent.com -brief` → 连接被重置
  - `openssl s_client -connect raw.giteeusercontent.com:443 -servername RAW.GITEEUSERCONTENT.COM -brief` → `CONNECTION ESTABLISHED`
- 游戏内（同日，电信线路，`reload` 后）：Mod 商店 5 个源全部列出（可更新 3 / 未下载 14）；「Mod 源发现」显示 `已订阅 5 / 5`，枫叶源更新日期 `2026-11-13`（来自远程清单而非内置快照）
- **管理器更新（同日实机通过）**：
  - 真实链路对照（`Node vm` 抽取新旧两版 `requestBuffer`，请求同一 `channel.json`）：旧版 171 ms `read ECONNRESET`；新版 354 ms 成功取回 22 B / `tag=V4.5.2`
  - 游戏内「检查更新」日志：`使用镜像：Gitee` → `channel 指向 tag：V4.5.2` → `catalog V4.5.2，本地 V4.5.3` → `已是最新版本，无需更新`；**全程无 `Gitee 拉取失败：… 改试 GitHub`**，即 Gitee 分支直接绕过屏蔽、未触发镜像切换（本地版本高于远端时显示「已是最新」属正常，判据看网络日志）
  - 仓库侧另用 Node 沙箱桩覆盖 6 种请求场景（小写 SNI 被 RST → 大写成功 / 非目标域名不重试 / 非握手错误不重试 / 大写仍失败则交还镜像兜底 / `gitee.com` 302 → CDN 链路 / 超时后不重试）

### 失败文案映射（同版）

- `humanizeNetError(err, rawUrl)` / `sourceErrorText(errText, rawUrl)`：只在**展示层**翻译，`_catalogBySource` 与 `job.error` 里仍存原始错误，便于排查
- 分类：`ECONNRESET/EPIPE/ECONNABORTED` → `errNetResetHint`；`ENOTFOUND/EAI_AGAIN` → `errDnsHint`；`ECONNREFUSED` → `errRefusedHint`；`HTTP 403` → 安装用 `errHttp403Hint`、源用 `sourceForbiddenHint`；`HTTP 404` → 安装用 `errHttp404Hint`、源用 `sourceNotFoundHint`；`sha256` → `errSha256Hint`；超过体积上限 → `errSizeLimitHint`；超时 → `errTimeoutHint`
- 全源失败：`emptyAllSourcesFailedHint`，`{host}` 取第一个启用源的 `catalogUrl` 主机名
- 单源失败：`sourceLoadFailedHost` 短句；长指引只在空状态出现一次，避免同一段话重复 5 遍变噪音
- `{host}` 一律从实际 URL 取，不硬编码 —— 第三方源的下载域名各不相同
- 三语同步（zh_CN / zh_TW / en）；`emptyAllSourcesFailed` 旧键保留未删，当前无引用


## 15. 影响面与公开证据 · 同类实现对照（2026-11-15 调研）

> 目的：回答「这几天是不是只有我们遇到」「同类项目的在线更新有没有同等安全」。本节是公开可检索资料的当日快照，链接可能失效，结论以 2026-11-15 为准。

### 15.1 结论

- **完全相同的现象**（`raw.giteeusercontent.com` 小写 SNI 被 RST、大写 SNI 可通）在 2026-11-08 之后**没有找到公开报告**：GitHub issue 搜索 `"raw.giteeusercontent.com" created:>2026-11-08` = 0；Gitee 官方反馈仓 `oschina/git-osc` 11 月新建 30 条 issue，含「下载 / 重置」关键词的 6 条逐条核对均为仓库体积 GC、Releases API 403 限流、Gitee Go 额度、内容误判；本仓 GitHub / Gitee issues 均为空。
- **同一条 `gitee.com /raw/ → 302 → 签名 CDN` 链路并非孤例**，但别人是在 9–10 月、以「302 后下载失败 / 空文件」的症状踩到，而不是 SNI 层 RST。
- 11 月同期确有多起 Gitee `Connection reset by peer`，但都发生在 `gitee.com` 的 git push / Release API / 附件下载通道，成因不同，不能算同一现象。

### 15.2 时间线（公开证据）

| 日期 | 项目 / 链接 | 现象与处理 |
| --- | --- | --- |
| 2026-09-12 | PicGo 系同日 4 个 issue：[PicGo-Core#202](https://github.com/PicGo/PicGo-Core/issues/202)、[flutter-picgo#62](https://github.com/PicGo/flutter-picgo/issues/62)、[picgo-plugin-gitee#16](https://github.com/zhanghuid/picgo-plugin-gitee/issues/16)、[gitee-uploader#22](https://github.com/lizhuangs/picgo-plugin-gitee-uploader/issues/22) | 「Gitee 现在有 `raw.giteeusercontent.com` 域名了」，图床插件改默认链接以避开 302 → 独立域名约在此时被社区集中感知（推断） |
| 2026-10-09 | [taksssss/tv#9](https://github.com/taksssss/tv/issues/9) | 「十一期间某天起 Gitee EPG 下载出问题」：浏览器能下（要等跳转），Linux `wget` 拿到空文件；日志含完整 `302 → …?metadata=…&signature=…` |
| 2026-10-27 | [haoranzheng/xingli#8](https://github.com/haoranzheng/xingli/pull/8) | PR「allow signed Gitee CDN」：v2.4.2 下载器 reject Gitee 的正常 302；原文「国内下载被拒 + GitHub raw 慢/被墙时，玩家看得到更新却下不动」，与本仓场景几乎一致 |
| 2026-10-29 | [Air-0000/CheckMarkScanner#10](https://github.com/Air-0000/CheckMarkScanner/pull/10) | 把 Gitee raw 的 `version.json` 加为最后兜底更新源；注明 302 由 Java `HttpURLConnection` 自动跟随 |
| 2026-11-08 ~ 11-14 | WotbTools#925 / nowen-note#919 / fm1-8p#173 / OpenLearn-Next-V2#516 / [Gitee Feedback IKVA6V](https://gitee.com/oschina/git-osc/issues/IKVA6V) | 同期 Gitee 连接重置或 Releases API 403 限流，属 git/API 通道，与 raw CDN SNI 无关 |
| 2026-11-14 | 本仓 V4.5.3 | 大写 SNI 重试，游戏内实测绕过（§14 验证记录） |

### 15.3 因果修正（重要）

- Gitee 帮助文档[《获取文件原始数据》](https://help.gitee.com/repository/file-operate/raw)明确：`gitee.com` 访问公开仓库原始文件会被**强制重定向**到独立域名 `raw.giteeusercontent.com`，服务端缓存 60~300 秒，>10MB 需认证。这是**既有平台设计，不是 2026-11-14 才变更**——§14 早期「现在 Gitee 把 /raw/ 全站改成 302」的表述按此理解。
- 更合理的因果链：既有的强制 302 → 2026-09 起独立域名 / 签名 CDN 被社区广泛感知与适配 → 各地中间设备的 SNI 规则陆续识别新域名、实现不一致（部分按小写字节精确匹配）→ 11 月在特定宽带线路上触发。
- 因此这是**线路级局部故障**，不是 Gitee 平台故障，也不是集中爆发。

### 15.4 为什么公开检索不到「这几天」的同现象

- 同 WiFi 手机也 RST、换手机热点即恢复（§14 判据 4），影响面局限在个别线路；
- 浏览器 / curl 自动跟随 302，用户只感知「图片不显示 / 下载空文件」，不会归因为 SNI；
- 只有自行处理重定向、并把 `ECONNRESET` 直接暴露出来的客户端（本仓 `requestBuffer` / 各类 Node 下载器）才会显形；
- 中文玩家 / Mod 社区反馈多在 QQ 群、微信群、B 站评论，不进公开索引。

### 15.5 同类项目的在线更新机制与安全性对照

| 项目 | 版本发现 | 完整性校验 | 写入 / 回滚 | 来源约束 |
| --- | --- | --- | --- | --- |
| **本仓 V4.5.3+** | `channel.json`（固定 ref=`main`）→ `catalog.json`（固定 tag），每文件 `sha256` + `size` | 逐文件校验，不符切镜像；另有 CRLF/LF 归一诊断 | 硬拒 `..` / 盘符 / 绝对路径 / 玩家配置 / `_localmods/` / `_workshop/`；`atomicWriteFile` + 会话全量备份 + 失败 `rollback()`；不覆盖玩家数据 | 仅 `https:`；双镜像 GitHub/Gitee + SNI 重试；**无 catalog 签名**；**重定向目标未做主机/路径白名单** |
| **xingli v2.4.3**（Python，MO2 排序包） | 双 `sort/latest.json` 比 `published_at` 取较新，平手优先 Gitee | manifest 校验 size 为整数且不超上限、sha256 为 64 位 hex；下载后逐包 `len` + `sha256`，失败换镜像 | 备份目录 exclusive create，从不覆写当前文件 / 其他备份；`os.replace` 原子写 | URL 主机白名单；**只允许 `gitee.com → raw.giteeusercontent.com` 且同路径的 302**，其它跳转 fail-closed；4 个重定向回归测试 |
| **CheckMarkScanner**（Android APK） | 多源 `version.json`（custom → LAN → frp → Funnel → Gitee），超时 / grace 择源 | `version.json` 带 `sha256`，下载时用 `MessageDigest` 校验（**字段为空则不校验**）；另有 Android 系统 APK 签名校验 | 系统安装器接管，无自定义回滚 | 允许自定义源、设置 hint 含明文 `http://`；302 由 `HttpURLConnection` 自动跟随、不校验目标；`apkUrl` 与 `sha256` 同源自证 |
| PicGo 系 / taksssss/tv | 不是在线更新器：只生成 raw 链接 / `wget` 拉 EPG 数据 | 无 | — | — |
| 11 月那批 CI 镜像同步 PR | 发布侧重试，不是客户端更新 | — | — | — |

**共同短板**：三方都**没有非对称签名（公钥验签）**。`sha256` 只证明「下载内容与清单一致」，而清单与文件同源于一个信任根；若该源被整体替换，哈希无法识别。缓解方式各异：本仓靠固定 ref/tag + 双镜像交叉，xingli 靠双清单比时间戳，CheckMarkScanner 靠 Android 系统签名兜底。

**可借鉴**：xingli 的「重定向目标主机白名单 + 同路径校验 + GitHub 不得跳到 Gitee CDN」是本仓目前没有的一层——`requestBuffer` / `pipeResponse` 现在只检查 `https:`，不限制 `Location` 目标。内容 hash 会兜住篡改，但主动 fail-closed 更干净，可列为后续加固项。

### 15.6 链路状态补记

- 2026-11-14 13:47：小写 SNI `ECONNRESET`、大写 SNI 握手成功；Gitee `/raw/` 第一跳 302 到 CDN。
- 2026-11-15 14:29（V4.5.4 发版验证）：Gitee raw 在 curl 层仍被 RST → **屏蔽并未消失**，玩家无感是修复 + 双镜像兜底在起作用。
- 2026-11-15 17:1x：两种 SNI 均超时；本机电信 DNS 把该域名解析为 `1.1.1.1` + `180.76.199.86`（hosts 无条目），Node 取首条致超时，`gitee.com` 正常 200。注意**大写 SNI 重试不能解决 DNS 异常解析**；玩家若报「全超时」而非「连接被重置」，属另一类问题。

---

## 16. Gitee raw 的 DNS 污染与 API 兜底（2026-11-16）

### 现象

- §14 同链路的新故障形态：商店所有源**间歇性**一起失败，报错形如 `Error: connect ETIMEDOUT 1.1.1.1:443`，时好时坏、刷新几次能蒙对一次；「Mod 源发现」远程清单同样间歇性失败（退回内置快照）

### 根因（三层独立发生，逐层实测）

| 层 | 表现 | 实测方式与结果（游戏仓排查记录，2026-11-16） | 处理 |
|---|---|---|---|
| DNS 污染 | `raw.giteeusercontent.com` 被解析到 `1.1.1.1` | `nslookup` 连查 12 次：5 次返回 `1.1.1.1`（约 40%），其余返回真实 CDN IP `180.76.199.86`；`1.1.1.1:443` 本机直连 8s 超时 | 走 Gitee 官方 API 兜底 |
| SNI 按字节拦截 | 小写 SNI 被 RST | 游戏运行时内直连该域名 6/6 次 `ECONNRESET` | 大写 SNI 重试（§14 已有） |
| raw 缓存 | push 后远程清单不立刻生效 | push 后约 1 分钟 raw 仍返回旧文件；`?t=` 随机参数绕不过（缓存按文件路径键控） | 工具对账改用 API contents 端点 |

结论：不是网络波动，是线路层拦截 + DNS 污染的组合，两者独立发生，所以表现为间歇性。

### 兜底通道（Gitee API）

- 映射：`https://gitee.com/<owner>/<repo>/raw/<ref>/<path>` → `https://gitee.com/api/v5/repos/<owner>/<repo>/contents/<path>?ref=<ref>`——同一站点、不受影响，返回 base64 正文
- 仅当**重定向目标**失败时启用；原始 URL 自身的 403/404 不兜底，避免掩盖仓库被封的真实原因
- contents 接口只对 1MB 以内的文件返回正文，超限时用同一个 blob sha 走 `git/blobs/<sha>` 取完整正文
- base64 约膨胀 1.37 倍：兜底请求上限 = `min(1.5×maxBytes + 1MB, 48MB)`，再大的包不走兜底（不在内存里堆几十 MB base64）
- 续传请求（`rangeStart > 0`）不兜底——API 无 Range，整包重下才对
- 非 Gitee 域名（AtomGit / GitHub）不映射，行为不变

### 改动

- `libs/modStore.js`
  - 新增 `giteeApiFallbackUrl()` / `giteeApiBlobUrl()` / `giteeApiFetchFileBytes()` / `giteeApiFetchBuffer()` / `downloadViaGiteeApi()`
  - `requestBuffer()`（catalog / changelog）重定向分支：`fbUrl = options.apiFallbackUrl || giteeApiFallbackUrl(rawUrl)`，随重定向逐跳透传；子请求失败先试 `giteeApiFetchBuffer()`，成功即 `done`
  - `pipeResponse()`（zip 下载）新增 `apiFallbackUrl` 形参：重定向失败走 `downloadViaGiteeApi()` 整包落盘，`emitProgress` 后 resolve；401 整包重下与 SNI 重试均透传该参数
  - `sourceErrorText()` 升级：提取报错里的 IP，`1.1.1.1 / 0.0.0.0 / 8.8.8.8 / 8.8.4.4` 等黑洞地址 →「DNS 被劫持到了 {ip}，不是源挂了」；补 `ETIMEDOUT/EHOSTUNREACH/ENETUNREACH/ENETDOWN/ECONNREFUSED` 与 connect/socket 通用分支，系统原文不再原样甩给玩家（i18n 新增 `sourceLoadFailedTimeout` / `sourceLoadFailedDnsHijack`，三语）
- `libs/modLoaderUpdater.js`：同款 `giteeApiFallbackUrl()` / `giteeApiBlobUrl()` / `giteeApiFetchBytes()`（直接返回 Buffer 的变体）；`requestBuffer()` 重定向分支与 SNI 重试透传 `apiFallbackUrl`——`channel.json` / `catalog.json` / 各更新文件都经此函数，Gitee 分支 302 后的 CDN 请求同样命中
- 与 AtomGit 三源链（`6fd4135`）叠加：AtomGit 的 raw 本身就是 API 路径、无 302、不经过被污染域名，无需兜底；三源顺序不变

### 注意

- 兜底只在「302 之后的目标域名失败」时触发；`gitee.com` 第一跳本身被污染时仍走镜像切换（更新器）或人话报错（商店）——第一跳与 API 同站点，实测未见第一跳被污染
- 48MB 封顶意味着 ≈35MB 以上的安装包不走兜底，交还镜像 / 重试
- 决策延续 §14：仍属链路博弈式缓解，不是协议层修复；若匹配方升级屏蔽形态需重新评估。§15.5 列出的「重定向目标主机白名单」仍是待办加固项

### 验证记录

- 游戏仓实机（2026-11-16，污染线路）：API 通道取回 851,600 字节安装包，sha256 与本地文件完全一致；商店的源清单 / 安装包 / 更新日志与管理器在线更新四链路覆盖（见 CHANGELOG V4.5.5 条目）
- 本仓合并（2026-11-16）：`modStore.js` 与游戏仓实机版本逐字节一致；`modLoaderUpdater.js` 差异仅剩 AtomGit 三源链（发布仓已有、游戏仓没有），API 兜底部分一致
- 发版后的实机回归待随 V4.5.5 进行
