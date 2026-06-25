# ModResourceLoader 更新日志

## V2.0.0 (2026-06-03)

### 全新重写

- 基于社区版 V1 反馈重写，新增 manifest 声明式替换和 modId 别名系统
- 文档：`_localmods/ModDataLoader/调用规范.md`（第 7 节资源系统）

### 资源替换（manifest 声明，零 JS 代码）

- Mod 作者在 `modloader.json` 的 `resources` 字段声明替换映射即可
- ModResourceLoader 启动时自动扫描所有启用 Mod 的 manifest，注册替换
- Hook `ImageManager.loadBitmap` / `loadNormalBitmap` / `AudioManager.createBuffer` 做拦截重定向
- Mod 作者不需要知道自己的安装路径，本地和创意工坊通用

### modId 别名系统

- `modloader.json` 中声明 `"modId": "MyMod"` → 建立稳定标识到实际包名的映射
- 创意工坊上传后包名变成工坊 ID，但 `modId` 不变，`loadBitmap` 调用无需修改

### 资源新增 API

- **loadBitmap(modName, relativePath)**：加载 Mod 自带图片，返回 Bitmap（带缓存）
- `modName` 参数接受 `modId`（推荐）或实际包名

### 加密绕过

- Hook `Bitmap._startLoading`：Mod 资源跳过图片解密
- Hook `WebAudio._realUrl` / `_readableBuffer`：Mod 音频跳过解密
- 可通过 `enableEncryptionBypass` 参数开关

### Legacy API（向后兼容）

- `registerImage(folder, filename, modUrl)`
- `registerAudio(folder, filename, modUrl)`
- `registerResource(type, folder, filename, modUrl)`
- `getResourceRegistry()`

### 插件参数

- `debugLevel`：调试等级（关闭/基本/详细）
- `enableResourceReplacement`：启用资源替换
- `enableEncryptionBypass`：启用加密绕过

### 依赖

- 无前置依赖，作为 `@base` 被其他 Mod 引用

---

## V1.0 (社区版)

- 初始版本
- 提供基础资源替换 API，V2 新增 manifest 声明和 modId 系统
