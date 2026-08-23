# Mod 商店打包工具 · GUI 版

面向 Mod 作者的图形界面打包工具，无需命令行。需本机已安装 **Node.js 18+**。

双击 **`启动Mod打包工具.bat`** 启动，浏览器自动打开 `http://127.0.0.1:19280`。

## 快速开始

1. **设置本地 Mod 目录** — 在「设置」填写 `_localmods` 路径（输出目录可留空，默认 `gui/user-data/repo-cache/`）
2. **设置 Git 远程仓库** — 填写仓库 HTTPS 地址（Gitee、GitHub 等，按地址自动识别）、`sourceId` / `sourceName`
3. **设置令牌** — 填写 Gitee 私人令牌或 GitHub PAT（推送 / 拉取需要；生成 catalog **不需要**）
4. **初始化本地仓库** — 点击「**从远程拉取到本地**」（首次必做，建立本地 `.git`）
5. **创建 Mod 压缩包和 catalog** — 扫描 Mod → 勾选 →「**打包并生成 catalog**」
6. **推送到远程 Git 仓库** — 点击「**推送到远程仓库**」；成功时日志会打印：
   ```text
   Catalog URL (https): https://gitee.com/用户/仓库/raw/master/catalog.json
   ```
7. **分发给玩家** — 见下文「玩家整合包默认配置」

> 未初始化的本地目录不能直接推送，会提示「请先点击从远程拉取到本地」。

## 玩家整合包默认配置

第一版发给玩家的整合包若已含 **ModLoader** 与 **Mod 商店拓展**，可在默认配置里预填你的 catalog 源，玩家打开游戏即可在商店订阅。

编辑游戏目录下 **`js/mods/config/mod_store.json`**：

```json
{
  "maxDownloadBytes": 104857600,
  "sources": [
    {
      "id": "my-source",
      "name": "我的 Mod 源",
      "catalogUrl": "https://gitee.com/用户名/仓库名/raw/master/catalog.json",
      "enabled": true
    }
  ]
}
```

| 字段 | 说明 |
|------|------|
| `id` | 来源唯一标识，建议与打包工具里 `sourceId` 一致 |
| `name` | 商店里显示的来源名称，建议与 `sourceName` 一致 |
| `catalogUrl` | 推送成功后日志中的 **Catalog URL (https)**，须为 `https` |
| `enabled` | `true` 表示默认启用该源 |

玩家也可在游戏内商店 → **订阅管理** 中手动添加同一 Catalog URL。

## 打包页按钮

| 按钮 | 需令牌 | 说明 |
|------|--------|------|
| **打包选中 Mod** | 否 | 仅生成 zip（写到输出目录根，适合自行分发） |
| **打包并生成 catalog** | 否 | zip → `packages/`，更新 `catalog.json` 中的 `downloadUrl` |
| **从远程拉取到本地** | 是 | 初始化 / 同步本地 git 仓库 |
| **推送到远程仓库** | 是 | 提交并推送 `packages/` + `catalog.json`（可不勾选 Mod） |

## 设置项摘要

- **输出目录**（可选）：留空则用 `gui/user-data/repo-cache/`；`catalog.json` 自动放在其下
- **其他 Git 平台 raw 地址**（折叠）：GitLab、Codeberg 等非 Gitee/GitHub 时自定义 `downloadUrl` 模板
- **静态分发渠道**（独立卡片）：CDN / 对象存储直链；填写后 catalog `downloadUrl` **优先**使用此模板（zip 需自行上传）

占位符：`{file}`、`{owner}`、`{repo}`、`{branch}`、`{subdir}`、`{host}`

## 版本比对

扫描列表中的 **未发布 / 有更新 / 已发布** 依据：

1. 本地 `catalog.json` 已有条目
2. `user-data/publish-state.json`（上次打包记录）

## 本地数据 `user-data/`

| 文件/目录 | 内容 |
|-----------|------|
| `settings.json` | 路径、令牌等 |
| `publish-state.json` | 上次打包版本 |
| `repo-cache/` | 默认输出目录与 git 工作区 |

关闭工具后可删除整个 `user-data/` 文件夹，数据与工具同目录，不在 C 盘用户目录留残留。

## 打包核心

- 核心逻辑：`../modStorePublishCore.js`（GUI 与发布流程共用）
- 版本读取规则：**`modloader.json` 优先**，单脚本包可读 js `@version`

## 命名与 catalog 字段

| 字段 | 必填 | 说明 |
|------|------|------|
| `packageName` | 是 | 与 `_localmods` 包目录名一致；商店列表标题、安装目标均以此为准 |
| `version` | 是 | 推荐 `VX.Y.Z`（与 `modloader.json` / `@version` 一致） |
| `downloadUrl` | 是 | 须 `https`；指向标准 zip |
| `sha256` | 是 | zip 的 64 位小写十六进制 |
| `size` | 建议 | zip 字节数；**>50MB** 断点续传依赖准确 `size` |
| `summary` | 建议 | 列表简介（来自 `modloader.json` 的 `description`） |
| `hosts` | 建议 | 下载域名白名单，如 `["gitee.com"]` |
| `id` | 与 `packageName` 相同 | 运行时规范化后等同 `packageName`；勿与目录名不一致 |
| `title` | 可省略 | 历史字段；列表 UI 展示 `packageName`，非 `title` |

- **zip 文件名**：`<packageName>-<version去V前缀>.zip`（例：`ExampleMod-1.0.0.zip`）
- **多脚本包**：须在 `modloader.json` 写 `version`（包版本）
- 模板见：`../modstore-catalog.template.json`
