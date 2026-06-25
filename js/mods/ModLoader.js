/*:
 * @target MZ
 * @plugindesc 游戏内模组管理器（DOM化UI & 现代交互 & 拖放添加Mod & 滑动条/长文本/数据库引用）
 * @author joker创意 / GLM核心代码
 * @version V4.1.2
 *
 * @help
 * 【功能及使用方式】
 * 1. 管理游戏内 Mod 的开启与关闭，采用现代 DOM 化 UI 界面。
 * 2. 支持带有 @default 的参数修改（数值、开关、文本、单选下拉、颜色、长文本、数据库引用）。
 * 3. 严苛规则：若 Mod 存在任何未设置 @default 的参数，则该 Mod 所有参数禁止修改！(兼容适配偷懒倒逼：mod作者规范写参数，提升整体Mod质量)
 * 4. 在Mod管理器中点击带有[⚙]标志的Mod名称旁的齿轮图标可唤起参数编辑面板。修改参数后，需保存后实装修改。
 * 5. 布尔开关参数与RMMZ官方对齐，存储为 "true"/"false"。
 * 6. 支持恢复该插件所有参数为默认值(不保存)。
 * 7. 支持 @type color 标签：@color[#ff0000]红色文字@/color、@color[24]RMMZ色号@/color、@color[red]CSS颜色@/color
 * 8. F5刷新游戏后，游戏才能读取新的mod开关状态及参数值。
 * 9. 支持导入Mod、删除Mod、排序Mod
 * 10. Mod 运行时加载，不再写入 plugins.js（仅 mod_config.json 为配置源）
 * 11.支持一键全关Mod
 * 12.标签读取支持：@version @base @orderAfter @orderBefore @author @help
 * 13.依赖检测：自动检测@base/@orderAfter前置插件是否满足，UI颜色警告提示
 * 
 * 【前置必要操作 - 两种模式】
 * 
 * 【模式1：注入模式 】
 * 玩家需对游戏的index.html注入代码。modloader.js文件直接放入 /js/mods 目录即可。
 * 
 * index.html注入结构参考：
 *     <body style="background-color: black">
 *     <script type="text/javascript" src="js/libs/pixi.js"></script>
 *     <!-- 只要注入下面这一行，把控制权完全交给插件内部 -->
 *     <script type="text/javascript" src="js/mods/ModLoader.js"></script>
 *     <script type="text/javascript" src="js/main.js"></script>
 *     </body>
 * 
 * 【模式2：插件模式 】
 * 游戏作者可以直接通过 RMMZ 官方插件管理器启用 ModLoader，不需要修改 index.html！
 * - 在插件管理器中将 ModLoader.js 添加到列表中
 * - 修改 Mod 开关或排序后，需要 F5 刷新才能生效！
 * 
 * 【铁律合规性自检】
 * [✓] 本补丁已通过铁律合规检查：无顶层 $dataXxx 依赖 / 所有 Alias 均已做前置存在性检查 / 所有使用的参数均已配置 @default。
 *
 * 【开源协议】
 * ============================================================================
 * MIT License (MIT 许可证)
 * ============================================================================
 * 版权所有 (c) 2026 joker
 *
 * 特此免费授予任何获得本软件及相关文档文件（下称"软件"）副本的人
 * 不受限制地处置本软件的权利，包括但不限于使用、复制、修改、合并、
 * 出版、分发、再许可及/或销售本软件副本的权利，并允许被提供本软件
 * 的人士如此行事，但须符合以下条件：
 *
 * 上述版权声明和本许可声明应包含在本软件的所有副本或实质部分中。
 *
 * 本软件按"原样"提供，不作任何明示或暗示的保证，包括但不限于对
 * 适销性、特定用途的适用性及不侵权的保证。在任何情况下，作者或版
 * 权持有人均不对因本软件或本软件中的使用或其他交易而产生或与之相
 * 关的任何索赔、损害或其他责任负责，无论是合同、侵权还是其他行为。
 *
 * ====================== 英文原版======================
 *
 * Copyright (c) 2026 joker
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 * ============================================================================
 * 
 * 【更新日志】请查看 docs/modloader_CHANGELOG.md 文件
 */

(() => {
    'use strict';

    // ================================================================
    // 1. 基础配置与日志系统
    // ================================================================
    const ModName = "ModLoader";
    const VERSION = "V4.1.2";
    const DEBUG_LEVEL = 0;

    const log = (level, ...args) => {
        if (DEBUG_LEVEL < level) return;
        const prefix = `[${ModName} v${VERSION}]`;
        if (level === 1) console.error(prefix, '[ERROR]', ...args);
        else if (level === 2) console.warn(prefix, '[WARN]', ...args);
        else if (level === 3) console.log(prefix, '[INFO]', ...args);
    };

    // 模组管理按钮位置（直接改此处数值即可）
    const BUTTON_X = 20;
    const BUTTON_Y = 20;

    // ================================================================
    // 3. Node.js 模块与路径
    // ================================================================
    const fs = require('fs');
    const pathMod = require('path');
    const MODS_DIR = pathMod.join(process.cwd(), 'js', 'mods');
    const LOCALMODS_DIR = pathMod.join(MODS_DIR, '_localmods');
    const WORKSHOP_BRIDGE_DIR = pathMod.join(MODS_DIR, '_workshop');
    const CONFIG_PATH = pathMod.join(MODS_DIR, 'mod_config.json');
    const PLUGINS_PATH = pathMod.join(process.cwd(), 'js', 'plugins.js');
    const MODLOADER_CONFIG_PATH = pathMod.join(MODS_DIR, 'config', 'modloader_config.json');
    // 工坊默认项：loadWorkshopConfig 内存合并用；ensureModLoaderConfigFile 写入 modloader_config.json 时用
    const DEFAULT_WORKSHOP_CONFIG = {
        enabled: true,
        // 发行游戏的 Steam AppID（须与 steam_appid.txt、Steamworks 工坊后台一致）；4379740 仅为本仓库联调示例，游戏作者请改为自己的 AppID
        steamAppId: '4379740',
        // Steam 库根目录：留空则从游戏安装路径向上自动查找 steamapps；多库盘符或非默认库时填库根，如 "D:/SteamLibrary" 或 "E:/Games/Steam"
        steamLibraryPath: ''
    };
    // 盗版环境检测：默认关闭；游戏作者发布更新时在 modloader_config.json 设 enabled: true 即可开启
    const DEFAULT_PIRACY_DETECTION_CONFIG = {
        enabled: false
    };
    const LANGUAGE_DIR = pathMod.join(MODS_DIR, 'config', 'language');
    let _currentLanguage = 'zh_CN';
    let _languageConfigs = {};
    // ================================================================
    // 3.5 盗版环境检测（路径结构 + 文件指纹双重检测）
    // ================================================================
    let _piracyCacheResult = null;

    function detectPiracy() {
        if (_piracyCacheResult !== null) return _piracyCacheResult;
        try {
            const cwd = process.cwd();
            const checks = [];
            const norm = sep => cwd.replace(/\\/g, sep).toLowerCase();

            // ---- 主检测：Steam 安装路径结构 ----
            // 正版 Steam 必然安装在 <任意位置>/steamapps/common/<游戏名>/
            // 盗版解压后通常放在 下载/桌面/游戏合集 等位置，路径不含 steamapps\common
            // 即使盗版用户刻意伪造目录结构，也需要额外建 2 层文件夹，增加成本
            const forward = norm('/');
            const steamPathPattern = /[/\\]steamapps[/\\]common[/\\][^/\\]+$/;
            if (!steamPathPattern.test(forward)) {
                checks.push({
                    name: 'NonSteamPath',
                    reason: '当前路径不是 Steam 安装目录'
                });
            }

            // ---- 辅助检测：已知盗版工具残留文件 ----
            const libDir = pathMod.join(cwd, 'lib');
            if (fs.existsSync(libDir)) {
                const libFiles = fs.readdirSync(libDir).map(f => f.toLowerCase());
                const libSet = new Set(libFiles);
                if (libSet.has('steamclient_loader_x64.exe'))
                    checks.push({ name: 'GSE-Loader', reason: 'lib/ 下存在 GSE 加载器' });
                if (fs.existsSync(pathMod.join(libDir, 'steamclient.dll')) && !libSet.has('steam_api.dll.bak'))
                    checks.push({ name: 'GSE-Client32', reason: 'lib/ 下存在 GSE steamclient' });
                if (fs.existsSync(pathMod.join(libDir, 'steamclient64.dll')) && !libSet.has('steam_api64.dll.bak'))
                    checks.push({ name: 'GSE-Client64', reason: 'lib/ 下存在 GSE steamclient64' });
                if (fs.existsSync(pathMod.join(libDir, 'steam_settings')))
                    checks.push({ name: 'Goldberg', reason: 'lib/ 下存在 Goldberg 配置目录' });
                if (libSet.has('steam_api.dll.bak') || libSet.has('steam_api64.dll.bak'))
                    checks.push({ name: 'Goldberg-Bak', reason: 'lib/ 下存在 DLL 备份（Goldberg 替换痕迹）' });
            }
            // 根目录也可能直接丢 GSE 文件（截图确认的情况）
            const rootFiles = fs.readdirSync(cwd).map(f => f.toLowerCase());
            const rootSet = new Set(rootFiles);
            if (rootSet.has('steamclient_loader_x64.exe'))
                checks.push({ name: 'GSE-RootLoader', reason: '根目录存在 GSE 加载器' });
            if (rootSet.has('steamclient.dll') || rootSet.has('steamclient64.dll'))
                checks.push({ name: 'GSE-RootClient', reason: '根目录存在 GSE steamclient' });

            _piracyCacheResult = checks.length > 0 ? { detected: true, details: checks } : { detected: false, details: [] };
            if (_piracyCacheResult.detected) {
                log(1, "检测到非正版环境:", _piracyCacheResult.details.map(d => d.name + '(' + d.reason + ')').join(' | '));
            }
            return _piracyCacheResult;
        } catch (e) {
            log(2, "环境检测异常（默认放行）:", e.message);
            _piracyCacheResult = { detected: false, details: [] };
            return _piracyCacheResult;
        }
    }

    function showPiracyWarning() {
        const mlConfig = loadModLoaderConfig();
        if (!mlConfig.piracyDetection || !mlConfig.piracyDetection.enabled) return false;
        const result = detectPiracy();
        if (!result.detected) return false;
        showConfirmDialog(
            '⚠️ 提示',
            '检测到当前为非 Steam 正版环境，ModLoader 最新版无法使用。\n\n盗版环境请使用旧版管理器，但该版本已停止更新，出现 Bug 请自行解决，不再接受反馈。\n\n感谢理解。',
            [{ text: '我知道了', class: 'ml-btn-primary', action: () => hideConfirmDialog() }]
        );
        return true;
    }

    // ================================================================
    // 4. 配置与文件操作（纯逻辑，无UI依赖）
    // ================================================================
    function ensureDir(dir) {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }

    function loadConfig() {
        if (!fs.existsSync(CONFIG_PATH)) return {};
        try {
            const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
            return config && typeof config === 'object' ? config : {};
        } catch (e) {
            log(1, "加载配置失败", e);
            return {};
        }
    }

    /**
     * V3.x 本地 Mod 配置键：../mods/<脚本基名>
     * V4.1+ 本地 Mod 配置键：local:<包名>:<脚本基名>
     * 读取时兼容旧键；保存时仅写入新键（saveAllChanges / persistModListToConfig）
     */
    function resolveModConfigEntry(config, modId, scriptBaseName) {
        if (!config) return undefined;
        if (Object.prototype.hasOwnProperty.call(config, modId)) {
            return config[modId];
        }
        if (scriptBaseName) {
            const legacyKey = '../mods/' + scriptBaseName;
            if (Object.prototype.hasOwnProperty.call(config, legacyKey)) {
                log(3, 'mod_config 兼容旧键:', legacyKey, '→', modId);
                return config[legacyKey];
            }
        }
        return undefined;
    }

    function isModConfigMetaKey(key) {
        return key === 'plugins';
    }

    // ================================================================
    // 语言包系统
    // ================================================================
    function loadLanguageConfigs() {
        _languageConfigs = {};
        try {
            if (fs.existsSync(LANGUAGE_DIR)) {
                var files = fs.readdirSync(LANGUAGE_DIR);
                files.forEach(function(f) {
                    if (f.endsWith('.json')) {
                        try {
                            var raw = fs.readFileSync(pathMod.join(LANGUAGE_DIR, f), 'utf-8');
                            var data = JSON.parse(raw);
                            var langCode = data._langCode || f.replace('.json', '');
                            _languageConfigs[langCode] = data;
                            log(3, '语言包加载成功: ' + langCode);
                        } catch (e2) {
                            log(1, '语言包解析失败: ' + f + ' - ' + e2.message);
                        }
                    }
                });
            }
        } catch (e) {
            log(1, '扫描语言包目录失败: ' + e.message);
        }
    }

    function getAvailableLanguages() {
        var langs = Object.keys(_languageConfigs);
        var order = ['zh_CN', 'zh_TW', 'en'];
        langs.sort(function(a, b) {
            var ia = order.indexOf(a);
            var ib = order.indexOf(b);
            if (ia === -1) ia = 999;
            if (ib === -1) ib = 999;
            if (ia !== ib) return ia - ib;
            return a.localeCompare(b);
        });
        return langs;
    }

    function getLanguageDisplayName(langCode) {
        if (_languageConfigs[langCode] && _languageConfigs[langCode]._langName) {
            return _languageConfigs[langCode]._langName;
        }
        var map = { 'zh_CN': '简体中文', 'zh_TW': '繁體中文', 'en': 'English' };
        return map[langCode] || langCode;
    }

    function t(key) {
        if (_languageConfigs[_currentLanguage] && _languageConfigs[_currentLanguage][key] !== undefined) {
            return _languageConfigs[_currentLanguage][key];
        }
        if (_currentLanguage !== 'zh_CN' && _languageConfigs['zh_CN'] && _languageConfigs['zh_CN'][key] !== undefined) {
            return _languageConfigs['zh_CN'][key];
        }
        return key;
    }

    function setLanguage(langCode) {
        if (!_languageConfigs[langCode]) return;
        _currentLanguage = langCode;
        saveModLoaderConfig({ ml_theme: _currentTheme, ml_language: langCode });
        log(3, '语言切换为: ' + langCode);
    }

    function getCurrentLanguage() {
        return _currentLanguage;
    }

    let _workshopConfigCache = null;

    function invalidateWorkshopConfigCache() {
        _workshopConfigCache = null;
    }

    function getDefaultModLoaderConfig() {
        return {
            ml_theme: 'dark',
            ml_language: 'zh_CN',
            workshop: Object.assign({}, DEFAULT_WORKSHOP_CONFIG),
            piracyDetection: Object.assign({}, DEFAULT_PIRACY_DETECTION_CONFIG)
        };
    }

    function mergeWorkshopConfigSection(existingWorkshop) {
        const merged = Object.assign({}, DEFAULT_WORKSHOP_CONFIG, existingWorkshop || {});
        const defaults = getDefaultModLoaderConfig().workshop;
        let changed = false;
        for (const key of Object.keys(defaults)) {
            if (existingWorkshop && existingWorkshop[key] !== undefined) continue;
            if (merged[key] !== defaults[key]) {
                merged[key] = defaults[key];
                changed = true;
            }
        }
        return { merged, changed: changed || !existingWorkshop };
    }

    function mergePiracyDetectionConfigSection(existingPiracyDetection) {
        const merged = Object.assign({}, DEFAULT_PIRACY_DETECTION_CONFIG, existingPiracyDetection || {});
        const defaults = getDefaultModLoaderConfig().piracyDetection;
        let changed = false;
        for (const key of Object.keys(defaults)) {
            if (existingPiracyDetection && existingPiracyDetection[key] !== undefined) continue;
            if (merged[key] !== defaults[key]) {
                merged[key] = defaults[key];
                changed = true;
            }
        }
        return { merged, changed: changed || !existingPiracyDetection };
    }

    /**
     * 首次启动或旧版配置缺少 workshop / piracyDetection 段时，补全并写入 modloader_config.json
     */
    function ensureModLoaderConfigFile() {
        try {
            const dir = pathMod.dirname(MODLOADER_CONFIG_PATH);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            if (!fs.existsSync(MODLOADER_CONFIG_PATH)) {
                fs.writeFileSync(
                    MODLOADER_CONFIG_PATH,
                    JSON.stringify(getDefaultModLoaderConfig(), null, 2),
                    'utf-8'
                );
                invalidateWorkshopConfigCache();
                log(3, '已生成默认 modloader_config.json');
                return;
            }
            const raw = JSON.parse(fs.readFileSync(MODLOADER_CONFIG_PATH, 'utf-8'));
            const workshopMerge = mergeWorkshopConfigSection(raw.workshop);
            const piracyMerge = mergePiracyDetectionConfigSection(raw.piracyDetection);
            if (workshopMerge.changed || piracyMerge.changed) {
                raw.workshop = workshopMerge.merged;
                raw.piracyDetection = piracyMerge.merged;
                fs.writeFileSync(MODLOADER_CONFIG_PATH, JSON.stringify(raw, null, 2), 'utf-8');
                invalidateWorkshopConfigCache();
                log(3, '已为 modloader_config.json 补全缺失配置段');
            }
        } catch (e) {
            log(2, '确保 modloader_config.json 失败: ' + e.message);
        }
    }

    function loadModLoaderConfig() {
        ensureModLoaderConfigFile();
        invalidateWorkshopConfigCache();
        try {
            if (fs.existsSync(MODLOADER_CONFIG_PATH)) {
                var raw = fs.readFileSync(MODLOADER_CONFIG_PATH, 'utf-8');
                var parsed = JSON.parse(raw);
                var defaults = getDefaultModLoaderConfig();
                return {
                    ml_theme: parsed.ml_theme !== undefined ? parsed.ml_theme : defaults.ml_theme,
                    ml_language: parsed.ml_language !== undefined ? parsed.ml_language : defaults.ml_language,
                    workshop: Object.assign({}, defaults.workshop, parsed.workshop || {}),
                    piracyDetection: Object.assign({}, defaults.piracyDetection, parsed.piracyDetection || {})
                };
            }
        } catch (e) {
            log(1, '读取 ModLoader 配置失败: ' + e.message);
        }
        return getDefaultModLoaderConfig();
    }

    function saveModLoaderConfig(config) {
        try {
            ensureModLoaderConfigFile();
            var existingConfig = loadModLoaderConfig();
            var mergedConfig = {
                ml_theme: config.ml_theme !== undefined ? config.ml_theme : existingConfig.ml_theme,
                ml_language: config.ml_language !== undefined ? config.ml_language : existingConfig.ml_language,
                workshop: Object.assign({}, existingConfig.workshop, config.workshop || {}),
                piracyDetection: Object.assign({}, existingConfig.piracyDetection, config.piracyDetection || {})
            };
            fs.writeFileSync(MODLOADER_CONFIG_PATH, JSON.stringify(mergedConfig, null, 2), 'utf-8');
            invalidateWorkshopConfigCache();
        } catch (e) {
            log(1, '保存 ModLoader 配置失败: ' + e.message);
        }
    }

    function loadWorkshopConfig() {
        const mlConfig = loadModLoaderConfig();
        return Object.assign({}, DEFAULT_WORKSHOP_CONFIG, mlConfig.workshop || {});
    }

    ensureModLoaderConfigFile();

    function resolveSteamPaths() {
        const wsCfg = loadWorkshopConfig();
        const steamAppId = String(wsCfg.steamAppId || DEFAULT_WORKSHOP_CONFIG.steamAppId);
        let steamRoot = null;

        if (wsCfg.steamLibraryPath) {
            // 非空：显式指定 Steam 库根（含 steamapps 的上一级或 steamapps 目录本身），用于多库/自定义安装路径
            const libPath = String(wsCfg.steamLibraryPath);
            steamRoot = fs.existsSync(pathMod.join(libPath, 'steamapps'))
                ? pathMod.join(libPath, 'steamapps')
                : libPath;
        } else {
            // 空字符串：从 process.cwd()（游戏根目录）向上逐级查找 steamapps
            let dir = process.cwd();
            const root = pathMod.parse(dir).root;
            while (dir && dir !== root) {
                const candidate = pathMod.join(dir, 'steamapps');
                if (fs.existsSync(candidate)) {
                    steamRoot = candidate;
                    break;
                }
                dir = pathMod.dirname(dir);
            }
        }

        const workshopDir = steamRoot
            ? pathMod.join(steamRoot, 'workshop', 'content', steamAppId)
            : null;
        return { steamRoot, workshopDir, steamAppId };
    }

    // ================================================================
    // 拖放添加 Mod 功能
    // ================================================================

    /**
     * 递归复制文件夹
     */
    function copyDirRecursive(src, dest) {
        ensureDir(dest);
        const entries = fs.readdirSync(src, { withFileTypes: true });
        for (const entry of entries) {
            const srcPath = pathMod.join(src, entry.name);
            const destPath = pathMod.join(dest, entry.name);
            if (entry.isDirectory()) {
                copyDirRecursive(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }

    /**
     * 收集拖放内容中的所有文件（递归文件夹）
     */
    function collectFiles(items, eDataTransferFiles) {
        log(3, "=== collectFiles 开始 ===");
        log(3, "传入的 items 数量:", items ? items.length : 'undefined');
        log(3, "传入的 eDataTransferFiles:", eDataTransferFiles ? eDataTransferFiles.length : 'undefined');
        
        const files = [];
        
        // 优先尝试 items
        if (items && items.length > 0) {
            log(3, "使用 items 方式收集...");
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                log(3, `  Item[${i}]: kind=${item.kind}, type=${item.type}`);
                
                // 尝试获取 entry（NW.js 可能用 getAsEntry 也可能是 webkitGetAsEntry
                let entry;
                if (item.getAsEntry) entry = item.getAsEntry();
                else if (item.webkitGetAsEntry) entry = item.webkitGetAsEntry();
                
                log(3, `    entry: ${entry ? '存在' : '不存在'}`);
                if (entry) {
                    log(3, `    entry.isDirectory: ${entry.isDirectory}, entry.name: ${entry.name}`);
                }
                
                // 多种方式判断是否是目录
                let isDirectory = false;
                let directoryName = null;
                
                if (entry && entry.isDirectory) {
                    isDirectory = true;
                    directoryName = entry.name;
                } else if (item.kind === 'directory') {
                    isDirectory = true;
                    directoryName = item.name;
                }
                
                if (isDirectory) {
                    log(3, `    📂 检测到是目录！名称: ${directoryName}`);
                    
                    // 检查是否是 mods 文件夹（不区分大小写）
                    if (directoryName && directoryName.toLowerCase() === 'mods') {
                        log(3, "    ✅ 是 mods 文件夹！加入列表！");
                        files.push({
                            type: 'mods-folder',
                            name: directoryName,
                            entry: entry || item
                        });
                    } else {
                        log(3, `    ❌ 不是 mods 文件夹，跳过...`);
                    }
                } else if (item.kind === 'file') {
                    const file = item.getAsFile();
                    if (file) {
                        log(3, `    📄 检测到是文件: ${file.name}`);
                        files.push({
                            type: 'file',
                            file: file,
                            name: file.name
                        });
                    }
                }
            }
        }
        
        // 如果 items 没收集到，尝试 files（NW.js 常见情况）
        if (files.length === 0 && eDataTransferFiles && eDataTransferFiles.length > 0) {
            log(3, "items 没收集到，尝试使用 dataTransfer.files 方式...");
            
            // 检查是否是从 mods 文件夹拖来的（通过完整路径识别）
            let allFromModsFolder = true;
            for (let i = 0; i < eDataTransferFiles.length; i++) {
                const file = eDataTransferFiles[i];
                if (file.path) {
                    log(3, `  File[${i}]: name=${file.name}, path=${file.path}`);
                    if (!file.path.includes(pathMod.sep + 'mods' + pathMod.sep)) {
                        allFromModsFolder = false;
                    }
                } else {
                    allFromModsFolder = false;
                }
            }
            
            if (eDataTransferFiles.length > 0 && allFromModsFolder) {
                log(3, "✅ 通过路径识别：这些文件都在 mods 文件夹里！");
                // 直接标记为 mods 文件夹拖放
                files.push({
                    type: 'mods-folder',
                    name: 'mods',
                    files: Array.from(eDataTransferFiles) // 直接保存所有文件
                });
            } else {
                // 正常处理单个文件
                for (let i = 0; i < eDataTransferFiles.length; i++) {
                    const file = eDataTransferFiles[i];
                    log(3, `  File[${i}]: name=${file.name}`);
                    if (file.name.endsWith('.js')) {
                        files.push({
                            type: 'file',
                            file: file,
                            name: file.name
                        });
                        log(3, "    是 .js 文件！加入列表。");
                    }
                }
            }
        }
        
        log(3, "collectFiles 完成，共收集:", files.length, "个文件/文件夹");
        return files;
    }

    /**
     * 处理拖放事件
     */
    function handleDropEvent(e) {
        log(3, "=== handleDropEvent 开始 ===");
        
        e.preventDefault();
        e.stopPropagation();

        log(3, "检查 dataTransfer...");
        log(3, "dataTransfer.files:", e.dataTransfer.files);
        log(3, "dataTransfer.items:", e.dataTransfer.items);

        const items = e.dataTransfer.items;
        if (!items) {
            log(1, "items 不存在！使用 dataTransfer 只有 files，没有 items！");
            showConfirmDialog(
                t('dialog.title'),
                t('install.browserNoFolder'),
                [{ text: t('dialog.ok'), class: "ml-btn-primary", action: hideConfirmDialog }]
            );
            return;
        }

        log(3, "开始 collectFiles...");
        const collectedFiles = collectFiles(Array.from(items), e.dataTransfer.files);
        log(3, "collectFiles 返回结果:", collectedFiles);

        if (collectedFiles.length === 0) {
            log(2, "没有有效的文件/文件夹！");
            showConfirmDialog(
                t('dialog.title'),
                t('install.dragJsFile'),
                [{ text: t('dialog.ok'), class: "ml-btn-primary", action: hideConfirmDialog }]
            );
            return;
        }

        // 检查是否有 mods 文件夹
        log(3, "检查是否有 mods 文件夹...");
        const modsFolder = collectedFiles.find(f => f.type === 'mods-folder');
        if (modsFolder) {
            log(3, "发现 mods 文件夹，调用 handleModsFolderDrop");
            // 如果 entry 方式识别到的，但没有 files 属性，就强制用 dataTransfer.files
            if (!modsFolder.files && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                log(3, "entry 方式识别到，但没有 files 属性，改用 dataTransfer.files...");
                modsFolder.files = Array.from(e.dataTransfer.files);
            }
            handleModsFolderDrop(modsFolder);
            return;
        }

        // 检查是否有单个 .js 文件
        log(3, "检查是否有单个 .js 文件...");
        const jsFiles = collectedFiles.filter(f => f.type === 'file' && f.name.endsWith('.js'));
        log(3, "找到的 .js 文件数:", jsFiles.length);
        jsFiles.forEach((f, i) => log(3, `  [${i}] ${f.name}`));
        if (jsFiles.length > 0) {
            log(3, "调用 handleJsFilesDrop");
            handleJsFilesDrop(jsFiles);
            return;
        }

        if (jsFiles.length === 0) {
            showConfirmDialog(
                t('dialog.title'),
                t('install.dragJsFile'),
                [{ text: t('dialog.ok'), class: "ml-btn-primary", action: hideConfirmDialog }]
            );
        }
    }

    /**
     * 递归复制文件夹
     */
    function copyFolderRecursive(srcDir, destDir) {
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }
        
        const entries = fs.readdirSync(srcDir, { withFileTypes: true });
        let copiedCount = 0;
        
        for (const entry of entries) {
            const srcPath = pathMod.join(srcDir, entry.name);
            const destPath = pathMod.join(destDir, entry.name);
            
            if (entry.isDirectory()) {
                copiedCount += copyFolderRecursive(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
                log(3, "复制文件:", destPath);
                copiedCount++;
            }
        }
        
        return copiedCount;
    }

    /**
     * 处理 mods 文件夹拖放
     */
    function handleModsFolderDrop(folder) {
        log(3, "=== handleModsFolderDrop 开始 ===");
        log(3, "folder 对象属性:", Object.keys(folder));
        
        // 先找到源mods目录
        let srcModsDir = null;
        if (folder.files && folder.files.length > 0) {
            for (const file of folder.files) {
                if (file.path) {
                    log(3, "检查文件路径:", file.path);
                    const sep = pathMod.sep;
                    const pathLower = file.path.toLowerCase();
                    
                    let idx = pathLower.lastIndexOf(sep + 'mods' + sep);
                    if (idx !== -1) {
                        srcModsDir = file.path.substring(0, idx + 5 + 1);
                        log(3, "找到源mods目录:", srcModsDir);
                        break;
                    }
                    
                    if (pathLower.endsWith(sep + 'mods')) {
                        srcModsDir = file.path;
                        log(3, "找到源mods目录:", srcModsDir);
                        break;
                    }
                    
                    let parentDir = pathMod.dirname(file.path);
                    for (let i = 0; i < 5; i++) {
                        if (pathMod.basename(parentDir).toLowerCase() === 'mods') {
                            srcModsDir = parentDir;
                            log(3, "找到源mods目录:", srcModsDir);
                            break;
                        }
                        const nextParent = pathMod.dirname(parentDir);
                        if (nextParent === parentDir) break;
                        parentDir = nextParent;
                    }
                    if (srcModsDir) break;
                }
            }
        }
        
        if (!srcModsDir || !fs.existsSync(srcModsDir)) {
            showConfirmDialog(
                t('dialog.title'),
                t('install.dragCorrect'),
                [{ text: t('dialog.ok'), class: "ml-btn-primary", action: hideConfirmDialog }]
            );
            return;
        }
        
        // 分析源目录里的js文件
        const newFiles = [];
        const updateFiles = [];
        try {
            const entries = fs.readdirSync(srcModsDir);
            for (const entry of entries) {
                if (entry.toLowerCase().endsWith('.js')) {
                    const destPath = pathMod.join(MODS_DIR, entry);
                    if (fs.existsSync(destPath)) {
                        updateFiles.push(entry);
                    } else {
                        newFiles.push(entry);
                    }
                }
            }
        } catch (e) {
            log(1, "分析mods文件夹失败", e);
        }
        
        // 构建清单
        let listText = t('info.format.detectedModsFolderImport') + '\n\n';
        if (newFiles.length > 0) {
            listText += '✨ ' + t('info.format.新增mod') + '（' + newFiles.length + '个）:\n';
            listText += newFiles.map(f => '  - ' + f).join('\n');
            listText += '\n\n';
        }
        if (updateFiles.length > 0) {
            listText += '🔄 ' + t('info.format.更新mod') + '（' + updateFiles.length + '个）:\n';
            listText += updateFiles.map(f => '  - ' + f).join('\n');
            listText += '\n\n';
        }
        listText += t('info.format.会覆盖整个mods文件夹');
        
        const hasUpdates = updateFiles.length > 0;
        
        showConfirmDialog(
            t('install.importList'),
            listText,
            [
                { text: t('button.cancel'), class: "ml-btn-secondary", action: hideConfirmDialog },
                {
                    text: hasUpdates ? t('button.importOverwrite') : t('button.import'),
                    class: "ml-btn-primary",
                    action: async () => {
                        hideConfirmDialog();
                        try {
                            log(3, "开始复制文件夹:", srcModsDir, "->", MODS_DIR);
                            const count = copyFolderRecursive(srcModsDir, MODS_DIR);
                            log(3, `✅ 成功复制 ${count} 个文件/文件夹！`);
                            
                            // 刷新并排序新mod
                            _modData = scanAllMods();
                            const config = loadConfig();
                            let currentMaxOrder = 0;
                            
                            for (const modId in config) {
                                if (isModConfigMetaKey(modId)) continue;
                                if (config[modId] && typeof config[modId] === 'object' && config[modId].order !== undefined) {
                                    if (config[modId].order > currentMaxOrder) {
                                        currentMaxOrder = config[modId].order;
                                    }
                                }
                            }
                            
                            for (const mod of _modData) {
                                const modId = mod.id;
                                const scriptBaseName = mod.fileName ? pathMod.parse(mod.fileName).name : null;
                                const existing = resolveModConfigEntry(config, modId, scriptBaseName);
                                if (existing === undefined) {
                                    currentMaxOrder++;
                                    config[modId] = { status: false, order: currentMaxOrder, params: {} };
                                } else if (typeof existing === 'boolean') {
                                    currentMaxOrder++;
                                    config[modId] = { status: existing, order: currentMaxOrder, params: {} };
                                }
                            }
                            
                            saveConfig(config);
                            _modData = scanAllMods();
                            // 【V3.15.0 新增】安装后刷新依赖检测
                            refreshDependencyCheck();
                            renderModList();
                            updateCounts();
                            
                            showConfirmDialog(
                                t('dialog.success'),
                                t('install.copySuccess').replace('{count}', count),
                                [{ text: t('dialog.ok'), class: "ml-btn-primary", action: hideConfirmDialog }]
                            );
                        } catch (e) {
                            log(1, "处理 mods 文件夹失败", e);
                            showConfirmDialog(
                                t('dialog.error'),
                                t('install.copyFailed'),
                                [{ text: t('dialog.ok'), class: "ml-btn-primary", action: hideConfirmDialog }]
                            );
                        }
                    }
                }
            ]
        );
    }

    /**
     * 处理单个 .js 文件拖放
     */
    function handleJsFilesDrop(files) {
        log(3, "=== handleJsFilesDrop 开始 ===");
        log(3, "总文件数:", files.length);

        // 第一步：分析所有文件
        const jsFiles = [];
        const nonJsFiles = [];
        const newFiles = [];
        const updateFiles = [];

        for (const fileItem of files) {
            const file = fileItem.file;
            if (file.name.toLowerCase().endsWith('.js')) {
                jsFiles.push(file);
                const destPath = getLocalModInstallPath(file.name);
                if (fs.existsSync(destPath)) {
                    updateFiles.push(file);
                } else {
                    newFiles.push(file);
                }
            } else {
                nonJsFiles.push(file.name);
            }
        }

        log(3, "分析结果: js文件=", jsFiles.length, "非js文件=", nonJsFiles.length);
        log(3, "新增文件:", newFiles.map(f => f.name));
        log(3, "更新文件:", updateFiles.map(f => f.name));

        // 构建清单文本
        let listText = '';
        if (nonJsFiles.length > 0) {
            listText += '❌ ' + t('info.format.已排除非js文件') + '：' + nonJsFiles.join('、') + '\n\n';
        }
        if (newFiles.length > 0) {
            listText += '✨ ' + t('info.format.新增mod') + '：\n' + newFiles.map(f => '  - ' + f.name).join('\n') + '\n';
        }
        if (updateFiles.length > 0) {
            listText += '🔄 ' + t('info.format.更新mod') + '：\n' + updateFiles.map(f => '  - ' + f.name).join('\n') + '\n';
        }

        // 确定按钮逻辑
        const hasUpdates = updateFiles.length > 0;
        const hasJsFiles = jsFiles.length > 0;
        const onlyNonJs = !hasJsFiles && nonJsFiles.length > 0;

        if (onlyNonJs) {
            // 只有非js文件：只有取消按钮
            showConfirmDialog(
                t('install.importList'),
                listText || t('install.noValidFiles'),
                [
                    { text: t('button.cancel'), class: "ml-btn-primary", action: hideConfirmDialog }
                ]
            );
            return;
        }

        if (!hasJsFiles) {
            // 没有任何文件
            showConfirmDialog(
                t('dialog.title'),
                t('install.noFiles'),
                [
                    { text: t('dialog.ok'), class: "ml-btn-primary", action: hideConfirmDialog }
                ]
            );
            return;
        }

        // 构建按钮
        const buttons = [];
        buttons.push({
            text: t('button.cancel'),
            class: "ml-btn-secondary",
            action: hideConfirmDialog
        });
        buttons.push({
            text: hasUpdates ? t('button.importOverwrite') : t('button.import'),
            class: "ml-btn-primary",
            action: async () => {
                hideConfirmDialog();
                await importFiles(jsFiles);
            }
        });

        showConfirmDialog(
            t('install.importList'),
            listText,
            buttons
        );
    }

    async function importFiles(files) {
        log(3, "=== importFiles ===");
        let successCount = 0;

        for (const file of files) {
            const destPath = getLocalModInstallPath(file.name);
            try {
                ensureDir(pathMod.dirname(destPath));
                await copyFileFromDataTransfer(file, destPath);
                successCount++;
                log(3, "成功导入:", file.name);
            } catch (err) {
                log(1, "导入失败:", file.name, err);
            }
        }

        // 刷新mod数据
        _modData = scanAllMods();
        
        // 将新mod排到最后并保存
        const config = loadConfig();
        let currentMaxOrder = 0;
        
        // 先找出已存在mod的最大order
        for (const modId in config) {
            if (isModConfigMetaKey(modId)) continue;
            if (config[modId] && typeof config[modId] === 'object' && config[modId].order !== undefined) {
                if (config[modId].order > currentMaxOrder) {
                    currentMaxOrder = config[modId].order;
                }
            }
        }
        
        // 给新mod分配order
        for (const mod of _modData) {
            const modId = mod.id;
            const scriptBaseName = mod.fileName ? pathMod.parse(mod.fileName).name : null;
            const existing = resolveModConfigEntry(config, modId, scriptBaseName);
            if (existing === undefined) {
                currentMaxOrder++;
                config[modId] = { status: false, order: currentMaxOrder, params: {} };
            } else if (typeof existing === 'boolean') {
                currentMaxOrder++;
                config[modId] = { status: existing, order: currentMaxOrder, params: {} };
            }
        }
        
        saveConfig(config);
        
        // 重新扫描并渲染
        _modData = scanAllMods();
        // 【V3.15.0 新增】安装后刷新依赖检测
        refreshDependencyCheck();
        renderModList();
        updateCounts();

        // 显示成功提示
        showConfirmDialog(
            t('install.success'),
            t('install.importSuccess').replace('{count}', successCount),
            [
                { text: t('dialog.ok'), class: "ml-btn-primary", action: () => { hideConfirmDialog(); hideInstallOverlay(); } }
            ]
        );
    }

    /**
     * 从 DataTransfer 复制文件
     */
    function copyFileFromDataTransfer(file, destPath) {
        log(3, "=== copyFileFromDataTransfer 开始 ===");
        log(3, "源文件名:", file.name);
        log(3, "目标路径:", destPath);
        
        return new Promise((resolve, reject) => {
            log(3, "创建 FileReader...");
            const reader = new FileReader();
            
            reader.onload = (e) => {
                log(3, "FileReader onload 触发");
                try {
                    log(3, "转换为 Buffer...");
                    const buffer = Buffer.from(e.target.result);
                    log(3, "Buffer 大小:", buffer.length, "字节");
                    
                    log(3, "写入文件到:", destPath);
                    fs.writeFileSync(destPath, buffer);
                    log(3, "✅ 成功写入！");
                    
                    log(3, "验证文件是否存在:", fs.existsSync(destPath));
                    if (fs.existsSync(destPath)) {
                        const stats = fs.statSync(destPath);
                        log(3, "文件大小:", stats.size, "字节");
                    }
                    
                    resolve();
                } catch (err) {
                    log(1, "❌ 复制文件失败:", file.name, err);
                    reject(err);
                }
            };
            
            reader.onerror = () => {
                log(1, "❌ FileReader 出错:", reader.error);
                reject(reader.error);
            };
            
            log(3, "开始 readAsArrayBuffer...");
            reader.readAsArrayBuffer(file);
        });
    }

    function saveConfig(config) {
        ensureDir(MODS_DIR);
        try {
            fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
            log(3, "配置已保存", CONFIG_PATH);
        } catch (e) {
            log(1, "保存配置失败", e);
        }
    }

    function standardizeDefault(val, type) {
        if (type === 'boolean') {
            const lowerVal = String(val).toLowerCase();
            if (lowerVal === 'true' || lowerVal === '1' || lowerVal === 'on') return 'true';
            return 'false';
        }
        return val;
    }

    /**
     * 递归生成 struct/table 的默认值
     * 根据 Schema 模板中子参数的 default 递归拼装成嵌套 JSON 对象
     * param {Array} schemaFields - Schema 模板的子参数数组
     * returns {object} - 拼装好的默认值对象
     */
    function generateDefaultFromSchema(schemaFields) {
        const obj = {};
        for (const field of schemaFields) {
            if (field.type === 'struct' && field.schema) {
                // 递归生成嵌套 struct 的默认值
                const subSchema = _schemaDictionary[field.schema];
                if (subSchema) {
                    obj[field.name] = JSON.stringify(generateDefaultFromSchema(subSchema));
                } else {
                    obj[field.name] = '{}';
                }
            } else if (field.type === 'table' && field.schema) {
                // table 默认为空数组
                obj[field.name] = '[]';
            } else if (field.default !== undefined) {
                obj[field.name] = field.default;
            } else {
                // 无默认值时按类型推断
                if (field.type === 'number') obj[field.name] = '0';
                else if (field.type === 'boolean') obj[field.name] = 'false';
                else if (field.type === 'color') obj[field.name] = '#ffffff';
                else obj[field.name] = '';
            }
        }
        return obj;
    }

    /**
     * 解析 define-schema 块，将模板存入全局 _schemaDictionary
     * 格式: define-schema 模板名 \n JSON字符串
     * param {string} metaContent - 清洗后的元数据内容
     */
    function parseSchemaDefinitions(metaContent) {
        // 匹配 @define-schema 模板名，下一行为 JSON 定义
        const schemaRegex = /@define-schema\s+(\w+)\s*\n\s*(.+)/g;
        let match;
        while ((match = schemaRegex.exec(metaContent)) !== null) {
            const schemaName = match[1];
            const jsonStr = match[2].trim();
            try {
                const schemaObj = JSON.parse(jsonStr);
                if (Array.isArray(schemaObj)) {
                    // 数组格式：每个元素是 { name, type, ... }
                    _schemaDictionary[schemaName] = schemaObj.map(item => ({
                        name: item.name || item.param || '',
                        type: (item.type || 'string').toLowerCase(),
                        text: item.text || item.name || item.param || '',
                        desc: item.desc || '',
                        default: item.default !== undefined ? String(item.default) : undefined,
                        min: item.min !== undefined ? Number(item.min) : undefined,
                        max: item.max !== undefined ? Number(item.max) : undefined,
                        step: item.step !== undefined ? Number(item.step) : undefined,
                        options: item.options || [],
                        schema: item.schema || undefined
                    }));
                    log(3, `[Schema字典] 注册模板: ${schemaName}, 字段数: ${_schemaDictionary[schemaName].length}`);
                } else {
                    log(2, `[Schema字典] 模板 ${schemaName} 的 JSON 不是数组格式，已跳过`);
                }
            } catch (e) {
                log(1, `[Schema字典] 解析模板 ${schemaName} 失败:`, jsonStr, e);
            }
        }
    }

    function parseModInfo(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const metaBlockMatch = content.match(/\/\*:[\s\S]*?\*\//);
            if (!metaBlockMatch) return { author: t('detail.labelUnknown'), help: "", params: [], version: undefined, base: undefined, orderAfter: undefined, orderBefore: undefined };
            let metaContent = metaBlockMatch[0];

            const lines = metaContent.split(/\r?\n/);
            let cleanedLines = [];
            for (let line of lines) {
                line = line.trim();
                if (line.startsWith('/*:')) {
                    cleanedLines.push('/*:');
                } else if (line === '*/') {
                    cleanedLines.push('*/');
                } else if (line.startsWith('*')) {
                    cleanedLines.push(line.substring(1).replace(/^\s*/, ''));
                } else {
                    cleanedLines.push(line);
                }
            }
            metaContent = cleanedLines.join('\n');

            // ---- 阶段2新增：先扫描 @define-schema 定义，存入全局字典 ----
            parseSchemaDefinitions(metaContent);
            // ---- 阶段2新增结束 ----

            const helpBlockMatch = metaContent.match(/@help\s*\n([\s\S]*?)(?=\n@|\n\*\/|$)/);
            const helpContent = helpBlockMatch ? helpBlockMatch[1].trim() : "";
            const helpBlock = helpBlockMatch ? helpBlockMatch[0] : "";

            const contentWithoutHelp = metaContent.replace(helpBlock, '');

            const authorMatch = contentWithoutHelp.match(/@author\s+(.+?)$/m);
            const versionMatch = contentWithoutHelp.match(/@version\s+(.+?)$/m);
            const baseMatch = contentWithoutHelp.match(/@base\s+(.+?)$/m);
            const orderAfterMatch = contentWithoutHelp.match(/@orderAfter\s+(.+?)$/m);
            const orderBeforeMatch = contentWithoutHelp.match(/@orderBefore\s+(.+?)$/m);

            const paramBlocks = [];
            let currentParam = null;

            const contentLines = contentWithoutHelp.split('\n');
            for (const line of contentLines) {
                if (line === '/*:' || line === '*/') continue;
                
                // 跳过 @define-schema 行（已在 parseSchemaDefinitions 中处理）
                if (/^@define-schema\s/.test(line)) continue;

                const paramMatch = line.match(/@param\s+(.+)$/);
                if (paramMatch) {
                    if (currentParam) paramBlocks.push(currentParam);
                    let rawName = paramMatch[1].trim();
                    rawName = rawName.replace(/\{.*?\}\s*/, '');
                    const dashIndex = rawName.indexOf(' - ');
                    if (dashIndex > 0) rawName = rawName.substring(0, dashIndex).trim();
                    // 阶段2新增：text 字段默认等于 name（后续 @text 可覆盖）
                    currentParam = { name: rawName, type: "string", text: rawName, desc: "", default: undefined, min: undefined, max: undefined, step: undefined, options: [], schema: undefined };
                    continue;
                }
                if (currentParam) {
                    const typeMatch = line.match(/@type\s+(.+)$/);
                    const descMatch = line.match(/@desc\s+(.+)$/);
                    const defaultMatch = line.match(/@default\s+(.+)$/);
                    const minMatch = line.match(/@min\s+(.+)$/);
                    const maxMatch = line.match(/@max\s+(.+)$/);
                    const stepMatch = line.match(/@step\s+(.+)$/);
                    const optionMatch = line.match(/@option\s+(.+)$/);
                    // ---- 阶段2新增：@text 标签解析 ----
                    const textMatch = line.match(/@text\s+(.+)$/);
                    // ---- 阶段2新增：@schema 标签解析 ----
                    const schemaMatch = line.match(/@schema\s+(.+)$/);

                    if (typeMatch) currentParam.type = typeMatch[1].trim().toLowerCase();
                    else if (textMatch) currentParam.text = textMatch[1].trim();
                    else if (schemaMatch) currentParam.schema = schemaMatch[1].trim();
                    else if (descMatch) currentParam.desc = descMatch[1].trim();
                    else if (defaultMatch) currentParam.default = standardizeDefault(defaultMatch[1].trim(), currentParam.type);
                    else if (minMatch && currentParam.type === 'number') currentParam.min = Number(minMatch[1].trim());
                    else if (maxMatch && currentParam.type === 'number') currentParam.max = Number(maxMatch[1].trim());
                    else if (stepMatch && currentParam.type === 'number') currentParam.step = Number(stepMatch[1].trim());
                    else if (optionMatch && currentParam.type === 'select') currentParam.options.push(optionMatch[1].trim());
                }
            }
            if (currentParam) paramBlocks.push(currentParam);

            // ---- 阶段2新增：为 struct/table 类型解析 schema 子参数并自动生成默认值 ----
            for (let p of paramBlocks) {
                if ((p.type === 'struct' || p.type === 'table') && p.schema) {
                    const schemaFields = _schemaDictionary[p.schema];
                    if (schemaFields) {
                        // 将 schema 子参数列表挂载到参数上，供渲染器使用
                        p.schemaFields = schemaFields;
                        log(3, `[Schema] 参数 "${p.name}" 引用模板 "${p.schema}", 子字段数: ${schemaFields.length}`);
                    } else {
                        log(2, `[Schema] 参数 "${p.name}" 引用的模板 "${p.schema}" 不存在！`);
                        p.schemaFields = [];
                    }
                    // 自动生成默认值：若缺少 @default，则递归拼装
                    if (p.default === undefined) {
                        if (p.type === 'struct') {
                            const defaultObj = generateDefaultFromSchema(p.schemaFields);
                            p.default = JSON.stringify(defaultObj);
                        } else {
                            // table 默认为空数组的双重转义
                            p.default = '[]';
                        }
                        log(3, `[Schema] 参数 "${p.name}" 自动生成默认值: ${p.default}`);
                    }
                }
            }
            // ---- 阶段2新增结束 ----

            let isStrictLocked = false;
            for (let p of paramBlocks) {
                if (p.default === undefined) {
                    log(2, `参数严苛校验失败：Mod [${pathMod.basename(filePath)}] 的参数 [${p.name}] 缺少 @default，该Mod参数编辑功能已被锁定。`);
                    isStrictLocked = true;
                    break;
                }
            }

            // 【V3.15.0 修改】解析 base 和 orderAfter 的依赖插件列表
            const baseRaw = baseMatch ? baseMatch[1].trim() : undefined;
            const orderAfterRaw = orderAfterMatch ? orderAfterMatch[1].trim() : undefined;
            const baseList = parseDependencyList(baseRaw);
            const orderAfterList = parseDependencyList(orderAfterRaw);

            return {
                author: authorMatch ? authorMatch[1].trim() : t('detail.labelUnknown'),
                help: helpContent || t('detail.noHelp'),
                version: versionMatch ? versionMatch[1].trim() : undefined,
                base: baseRaw,           // 保留原始字符串，用于详情显示
                orderAfter: orderAfterRaw, // 保留原始字符串，用于详情显示
                baseList: baseList,           // 【V3.15.0 新增】解析后的依赖列表
                orderAfterList: orderAfterList, // 【V3.15.0 新增】解析后的依赖列表
                orderBefore: orderBeforeMatch ? orderBeforeMatch[1].trim() : undefined,
                params: isStrictLocked ? [] : paramBlocks
            };
        } catch (e) {
            log(1, "解析Mod信息异常", e);
            return { author: t('detail.labelUnknown'), help: "", params: [], version: undefined, base: undefined, orderAfter: undefined, baseList: [], orderAfterList: [], orderBefore: undefined };
        }
    }

    /**
     * 从 mod_config 读取 status/params/order 并构建 Mod 条目公共字段
     */
    function applyModConfigToEntry(modId, filePath, fileName, displayName, config, defaultOrder, scriptBaseName) {
        const info = parseModInfo(filePath);
        let modConfig = resolveModConfigEntry(config, modId, scriptBaseName);
        let status = false;
        let currentParams = {};
        let order = defaultOrder;

        if (typeof modConfig === 'boolean') {
            status = modConfig;
        } else if (modConfig && typeof modConfig === 'object') {
            status = modConfig.status || false;
            if (modConfig.order !== undefined) {
                order = modConfig.order;
            }
            const rawParams = modConfig.params || {};
            info.params.forEach(p => {
                let value = rawParams.hasOwnProperty(p.name) ? rawParams[p.name] : undefined;
                if (value === '' || value === undefined || value === null) {
                    currentParams[p.name] = p.default;
                } else if (p.type === 'number') {
                    const numValue = Number(value);
                    if (isNaN(numValue)) {
                        currentParams[p.name] = p.default;
                    } else {
                        let finalValue = numValue;
                        if (p.min !== undefined && finalValue < p.min) finalValue = p.min;
                        if (p.max !== undefined && finalValue > p.max) finalValue = p.max;
                        currentParams[p.name] = String(finalValue);
                    }
                } else if (p.type === 'color') {
                    currentParams[p.name] = isValidColor(value) ? value : p.default;
                } else if (isNoteType(p.type)) {
                    currentParams[p.name] = value;
                } else if (isDatabaseType(p.type)) {
                    currentParams[p.name] = String(value);
                } else {
                    currentParams[p.name] = value;
                }
            });
        }

        return {
            id: modId,
            fileName: fileName,
            displayName: displayName || pathMod.parse(fileName).name,
            status: status,
            params: info.params,
            currentParams: currentParams,
            author: info.author,
            help: info.help,
            version: info.version,
            base: info.base,
            orderAfter: info.orderAfter,
            orderBefore: info.orderBefore,
            baseList: info.baseList,
            orderAfterList: info.orderAfterList,
            order: order
        };
    }

    function readWorkshopManifest(root) {
        const manifestPath = pathMod.join(root, 'modloader.json');
        try {
            if (fs.existsSync(manifestPath)) {
                return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
            }
        } catch (e) {
            log(2, '解析 modloader.json 失败: ' + root, e.message);
        }
        return null;
    }

    /**
     * modloader.json entries 仅允许包根下的 .js 文件名（禁止路径，防目录穿越）
     */
    function resolvePackageEntryFileName(entry) {
        const raw = String(entry).trim();
        if (!raw) return null;
        if (/[\\/]/.test(raw) || raw.indexOf('..') !== -1) {
            log(2, '包 entries 忽略非法路径项（仅允许文件名）: ' + raw);
            return null;
        }
        const fileName = pathMod.basename(raw);
        if (!fileName.toLowerCase().endsWith('.js') || fileName === 'ModLoader.js') {
            log(2, '包 entries 忽略无效项（须为 .js 文件名）: ' + raw);
            return null;
        }
        return fileName;
    }

    /**
     * 发现 Mod 包内脚本（modloader.json entries → 包根 *.js；不递归子目录）
     */
    function discoverPackageScripts(packageRoot) {
        const scripts = [];
        const manifest = readWorkshopManifest(packageRoot);

        if (manifest && Array.isArray(manifest.entries) && manifest.entries.length > 0) {
            for (const entry of manifest.entries) {
                const fileName = resolvePackageEntryFileName(entry);
                if (!fileName) continue;
                const absPath = pathMod.join(packageRoot, fileName);
                if (fs.existsSync(absPath)) {
                    scripts.push({
                        relPath: fileName,
                        absPath: absPath,
                        title: null
                    });
                } else {
                    log(2, '包 entries 文件不存在: ' + fileName);
                }
            }
            return scripts;
        }

        try {
            const files = fs.readdirSync(packageRoot).filter(file => file.endsWith('.js') && file !== 'ModLoader.js');
            for (const file of files) {
                scripts.push({
                    relPath: file,
                    absPath: pathMod.join(packageRoot, file),
                    title: null
                });
            }
        } catch (e) {
            log(2, '扫描包目录失败: ' + packageRoot, e.message);
        }
        return scripts;
    }

    function discoverWorkshopScripts(root) {
        return discoverPackageScripts(root);
    }

    function buildLocalModId(packageName, scriptBaseName) {
        return 'local:' + packageName + ':' + scriptBaseName;
    }

    function buildLocalLoadPath(packageName, scriptBaseName) {
        return '../mods/_localmods/' + packageName + '/' + scriptBaseName;
    }

    function getLocalModInstallPath(scriptFileName) {
        const baseName = pathMod.parse(scriptFileName).name;
        const packageDir = pathMod.join(LOCALMODS_DIR, baseName);
        return pathMod.join(packageDir, scriptFileName);
    }

    /** 包根 preview.png */
    function getPackagePreviewPath(packageRoot) {
        if (!packageRoot) return null;
        const previewPath = pathMod.join(packageRoot, 'preview.png');
        return fs.existsSync(previewPath) ? previewPath : null;
    }

    function readPngDimensions(absPath) {
        try {
            const buf = fs.readFileSync(absPath);
            if (buf.length < 24 || buf[0] !== 0x89) return null;
            const width = buf.readUInt32BE(16);
            const height = buf.readUInt32BE(20);
            if (width > 0 && height > 0 && width <= 50000 && height <= 50000) {
                return { width: width, height: height };
            }
        } catch (e) {
            log(2, '读取 PNG 尺寸失败: ' + absPath, e.message);
        }
        return null;
    }

    function pathToFileUrl(absPath) {
        const normalized = pathMod.resolve(absPath).replace(/\\/g, '/');
        return 'file:///' + encodeURI(normalized).replace(/^\/+/, '');
    }

    /** 点击缩略图：NW.js 新窗口打开原图 */
    function openPackagePreviewImage(packageRoot) {
        const previewPath = getPackagePreviewPath(packageRoot);
        if (!previewPath) return;
        if (typeof nw !== 'object') {
            log(2, '非 NW.js 环境，无法弹窗预览图片');
            return;
        }
        try {
            const gui = require('nw.gui');
            const fileUrl = pathToFileUrl(previewPath);
            const dims = readPngDimensions(previewPath);
            const maxW = Math.min((window.screen && window.screen.availWidth) || 1280, 1280) - 40;
            const maxH = Math.min((window.screen && window.screen.availHeight) || 720, 900) - 40;
            let w = dims ? dims.width : 800;
            let h = dims ? dims.height : 600;
            const scale = Math.min(1, maxW / w, maxH / h);
            w = Math.max(320, Math.round(w * scale));
            h = Math.max(240, Math.round(h * scale));
            gui.Window.open(fileUrl, {
                position: 'center',
                width: w,
                height: h,
                resizable: true,
                frame: true,
                show: true,
                focus: true
            }, function(newWin) {
                if (newWin) newWin.focus();
            });
            log(3, '预览图弹窗:', previewPath);
        } catch (e) {
            log(2, '打开预览图失败: ' + previewPath, e.message);
        }
    }

    function readPackagePreviewDataUrl(packageRoot) {
        const previewPath = getPackagePreviewPath(packageRoot);
        if (!previewPath) return null;
        try {
            return 'data:image/png;base64,' + fs.readFileSync(previewPath).toString('base64');
        } catch (e) {
            log(2, '读取 preview.png 失败: ' + previewPath, e.message);
            return null;
        }
    }

    function getModPackageRoot(mod) {
        if (!mod) return null;
        return mod.packageRoot || mod.workshopRoot || null;
    }

    function buildModPreviewHtml(mod) {
        if (mod.source !== 'workshop' && mod.source !== 'local') return '';
        const packageRoot = getModPackageRoot(mod);
        const dataUrl = readPackagePreviewDataUrl(packageRoot);
        let inner;
        let extraClass = '';
        let titleAttr = '';
        if (dataUrl) {
            inner = '<img src="' + dataUrl + '" alt="" class="ml-workshop-preview-img">';
            extraClass = ' ml-workshop-preview-clickable';
            titleAttr = ' title="' + escapeHtml(t('workshop.previewClick')) + '"';
        } else {
            inner = '<div class="ml-workshop-preview-empty">' + escapeHtml(t('workshop.noPreview')) + '</div>';
        }
        return '<div class="ml-workshop-preview' + extraClass + '"' + titleAttr + '>' + inner + '</div>';
    }

    function getConfigMaxOrder(config) {
        let max = 0;
        Object.keys(config).forEach(key => {
            if (isModConfigMetaKey(key)) return;
            const entry = config[key];
            if (entry && typeof entry === 'object' && entry.order !== undefined) {
                max = Math.max(max, Number(entry.order) || 0);
            }
        });
        return max;
    }

    function allocDefaultOrderForMod(config, orderState, modId, scriptBaseName) {
        const entry = resolveModConfigEntry(config, modId, scriptBaseName);
        if (entry && typeof entry === 'object' && entry.order !== undefined) {
            return entry.order;
        }
        return orderState.next++;
    }

  /**
     * 移除路径（目录联接 / 符号链接 / 普通文件）
     */
    function removePathSafe(targetPath) {
        if (!fs.existsSync(targetPath)) return;
        try {
            const stat = fs.lstatSync(targetPath);
            if (stat.isDirectory()) {
                fs.rmSync(targetPath, { recursive: true, force: true });
            } else {
                fs.unlinkSync(targetPath);
            }
        } catch (e) {
            log(2, '移除路径失败: ' + targetPath, e.message);
        }
    }

    /**
     * 正式工坊：在 js/mods/_workshop/<fileId>/ 建立联接，供 PluginManager 加载。
     * RMMZ 的 loadScript 只能解析游戏目录内路径，不能直接加载 steamapps/workshop/ 下的文件。
     */
    function syncWorkshopBridge(fileId, root, scripts) {
        if (!scripts || scripts.length === 0) return false;

        ensureDir(WORKSHOP_BRIDGE_DIR);
        const bridgeDir = pathMod.join(WORKSHOP_BRIDGE_DIR, String(fileId));
        removePathSafe(bridgeDir);

        try {
            fs.symlinkSync(root, bridgeDir, 'junction');
            return true;
        } catch (e) {
            log(2, '工坊包根 junction 失败，改用逐文件桥接: ' + fileId, e.message);
            removePathSafe(bridgeDir);
        }

        ensureDir(bridgeDir);
        for (const script of scripts) {
            const fileName = pathMod.basename(script.relPath);
            const linkPath = pathMod.join(bridgeDir, fileName);
            removePathSafe(linkPath);
            try {
                fs.symlinkSync(script.absPath, linkPath, 'file');
            } catch (e1) {
                try {
                    fs.linkSync(script.absPath, linkPath);
                } catch (e2) {
                    log(1, '工坊桥接失败: ' + script.absPath, e1.message, e2.message);
                    return false;
                }
            }
        }
        return true;
    }

    function buildWorkshopBridgeLoadPath(fileId, relPath) {
        const baseName = pathMod.parse(relPath).name;
        return '../mods/_workshop/' + String(fileId) + '/' + baseName;
    }

    function scanLocalMods(config, orderState) {
        ensureDir(LOCALMODS_DIR);
        const mods = [];
        try {
            const packageDirs = fs.readdirSync(LOCALMODS_DIR, { withFileTypes: true })
                .filter(entry => entry.isDirectory())
                .map(entry => entry.name);

            for (const packageName of packageDirs) {
                const packageRoot = pathMod.join(LOCALMODS_DIR, packageName);
                const scripts = discoverPackageScripts(packageRoot);
                if (scripts.length === 0) continue;

                const manifest = readWorkshopManifest(packageRoot);
                const packageTitle = manifest && manifest.title ? manifest.title : null;

                for (const script of scripts) {
                    const scriptBaseName = pathMod.parse(script.relPath).name;
                    const modId = buildLocalModId(packageName, scriptBaseName);
                    const loadPath = buildLocalLoadPath(packageName, scriptBaseName);
                    const displayName = script.title || scriptBaseName;
                    const entry = applyModConfigToEntry(
                        modId,
                        script.absPath,
                        pathMod.basename(script.relPath),
                        displayName,
                        config,
                        allocDefaultOrderForMod(config, orderState, modId, scriptBaseName),
                        scriptBaseName
                    );
                    mods.push(Object.assign(entry, {
                        loadPath: loadPath,
                        source: 'local',
                        workshopId: null,
                        workshopRoot: null,
                        localPackageName: packageName,
                        localPackageTitle: packageTitle || '',
                        packageRoot: packageRoot,
                        subscribed: true,
                        readOnly: false,
                        installState: 'ready'
                    }));
                }
            }
        } catch (e) {
            log(1, '扫描本地 Mod 包目录失败', e);
        }
        return mods;
    }

    function scanWorkshopMods(config, orderState) {
        const wsCfg = loadWorkshopConfig();
        if (!wsCfg.enabled) {
            if (fs.existsSync(WORKSHOP_BRIDGE_DIR)) {
                removePathSafe(WORKSHOP_BRIDGE_DIR);
            }
            return [];
        }

        const { workshopDir, steamAppId } = resolveSteamPaths();
        const mods = [];
        const seenLoadPaths = new Set();

        function addWorkshopPackage(root, fileId) {
            const fileIdStr = String(fileId);
            const scripts = discoverWorkshopScripts(root);
            if (scripts.length === 0) {
                return;
            }

            const manifest = readWorkshopManifest(root);
            const packageTitle = manifest && manifest.title ? manifest.title : null;
            let installState = 'ready';
            const bridged = syncWorkshopBridge(fileIdStr, root, scripts);
            if (!bridged) {
                installState = 'missing';
            }

            scripts.forEach(script => {
                const scriptBaseName = pathMod.parse(script.relPath).name;
                const modId = 'ws:' + fileIdStr + ':' + scriptBaseName;
                const loadPath = buildWorkshopBridgeLoadPath(fileIdStr, script.relPath);
                if (seenLoadPaths.has(loadPath)) return;
                seenLoadPaths.add(loadPath);

                const displayName = script.title || scriptBaseName;
                const entry = applyModConfigToEntry(
                    modId,
                    script.absPath,
                    pathMod.basename(script.relPath),
                    displayName,
                    config,
                    allocDefaultOrderForMod(config, orderState, modId, scriptBaseName),
                    scriptBaseName
                );
                mods.push(Object.assign(entry, {
                    loadPath: loadPath,
                    source: 'workshop',
                    workshopId: fileIdStr,
                    workshopPackageTitle: packageTitle || '',
                    workshopRoot: root,
                    packageRoot: root,
                    subscribed: true,
                    readOnly: true,
                    installState: installState
                }));
            });
        }

        if (steamAppId && workshopDir && fs.existsSync(workshopDir)) {
            try {
                fs.readdirSync(workshopDir, { withFileTypes: true })
                    .filter(entry => entry.isDirectory())
                    .forEach(entry => addWorkshopPackage(pathMod.join(workshopDir, entry.name), entry.name));
            } catch (e) {
                log(2, '扫描工坊目录失败: ' + workshopDir, e.message);
            }
        }

        return mods;
    }

    function scanAllMods() {
        ensureModLoaderConfigFile();
        invalidateWorkshopConfigCache();
        _schemaDictionary = {};
        const config = loadConfig();
        const orderState = { next: getConfigMaxOrder(config) + 1 };
        const localMods = scanLocalMods(config, orderState);
        const workshopMods = scanWorkshopMods(config, orderState);
        const seenLoadPaths = new Set();
        const mods = [];

        for (const mod of localMods.concat(workshopMods)) {
            if (seenLoadPaths.has(mod.loadPath)) {
                log(2, '跳过重复 loadPath:', mod.loadPath);
                continue;
            }
            seenLoadPaths.add(mod.loadPath);
            mods.push(mod);
        }

        mods.sort((a, b) => a.order - b.order);
        reassignOrders(mods);
        return mods;
    }

    function scanMods() {
        return scanAllMods();
    }

    /**
     * 重新分配模组的连续顺序号
     */
    function reassignOrders(modList) {
        if (!modList) modList = _modData;
        modList.forEach((mod, index) => {
            mod.order = index + 1;
        });
    }

    // ================================================================
    // 【V3.15.0 新增】依赖解析与检测系统
    // ================================================================

    /**
     * 解析base / orderAfter 标签中的依赖插件列表
     * 
     * 支持格式：
     *   情况① base 插件1.js        → 标准带.js后缀
     *   情况② base 插件1            → 标准不带.js后缀（含中文插件名如"界面UI"）
     *   情况③ base 插件1.js（确保放在它后面） → 非标准：.js后紧跟中文说明无空格，丢弃说明文本
     *   情况④ base 插件1.js（确保放在它后面） 插件2 → 非标准：识别到插件2
     *   多插件：base 插件1.js 插件2 插件3.js → 空格分隔
     *
     * 核心思路：以 .js 作为插件名与说明文字的分界标记
     *   - 含 .js → 提取到 .js 为止的部分作为插件名，.js 后面的文本视为说明丢弃
     *   - 不含 .js → 整个 token 就是插件名（支持中文插件名）
     *
     * param {string} rawStr - base 或 orderAfter 后的原始字符串
     * returns {string[]} 解析出的插件名列表（统一不含.js后缀）
     */
    function parseDependencyList(rawStr) {
        if (!rawStr || typeof rawStr !== 'string') return [];
        const trimmed = rawStr.trim();
        if (!trimmed) return [];

        const result = [];
        // 按空格分割原始字符串
        const tokens = trimmed.split(/\s+/);

        for (let i = 0; i < tokens.length; i++) {
            let token = tokens[i];
            if (!token) continue;

            // 检查 token 中是否包含 .js
            // .js 是插件名与说明文字的分界标记：
            //   - "插件1.js" → 插件名 "插件1"
            //   - "插件1.js（说明）" → 插件名 "插件1"，丢弃 "（说明）"
            //   - "界面UI"（无.js）→ 整个就是插件名 "界面UI"
            const jsIndex = token.indexOf('.js');
            if (jsIndex !== -1) {
                // 情况①③：token 含 .js
                // 提取从开头到 .js 结束的部分（含.js），丢弃 .js 后面的说明文字
                let pluginName = token.substring(0, jsIndex + 3); // 包含 ".js"
                // 去掉 .js 后缀，统一格式
                pluginName = pluginName.slice(0, -3);
                if (pluginName) {
                    result.push(pluginName);
                }
            } else {
                // 情况②：token 不含 .js，整个 token 就是插件名
                // 支持中文插件名如 "界面UI"、"分解界面UI"、"主菜单UI"
                result.push(token);
            }
        }

        // 去重
        return [...new Set(result)];
    }

    /**
     * 获取游戏原生插件信息（非mod插件）
     * 从 plugins.js 中读取已注册的原生游戏插件及其开启状态
     * 【V3.15.1 修改】返回 Map<插件名, {enabled: boolean}> 替代 Set，支持检测"存在但未开启"
     * returns {Map<string, {enabled: boolean}>} 原生插件名→启用状态映射（不含.js后缀）
     */
    function getGamePluginInfo() {
        const gamePlugins = new Map();
        try {
            const content = fs.readFileSync(PLUGINS_PATH, 'utf-8');
            const lines = content.split('\n');
            for (const line of lines) {
                const objMatch = line.match(/^\s*(\{.*\})\s*,?\s*$/);
                if (objMatch) {
                    try {
                        let obj = JSON.parse(objMatch[1]);
                        if (obj.name) {
                            let name = obj.name;
                            // 跳过旧版写入 plugins.js 的 mod 路径条目
                            if (name.startsWith('../mods/') || obj.__isMod) continue;
                            // 去掉.js后缀，统一格式
                            if (name.endsWith('.js')) name = name.slice(0, -3);
                            // 只取文件名部分（去掉目录路径）
                            const baseName = name.includes('/') ? name.split('/').pop() : name;
                            const enabled = obj.status !== false;
                            // 同时存储文件名和完整路径名
                            gamePlugins.set(baseName, { enabled });
                            if (baseName !== name) {
                                gamePlugins.set(name, { enabled });
                            }
                        }
                    } catch (jsonErr) { /* 忽略解析失败的行 */ }
                }
            }
        } catch (e) {
            log(1, "读取游戏插件列表失败", e);
        }
        return gamePlugins;
    }

    /**
     * 检测所有mod的依赖状态
     * 
     * 【V3.15.1 重写】5种状态判定逻辑：
     * 
     * 判定流程（对每个依赖插件名逐一检测）：
     *   Step 1: 在游戏原生插件中查找
     *     ├─ 找到且已开启 → PASS（游戏插件始终在mod之前加载，顺序天然满足）
     *     ├─ 找到但未开启 → GAME_DISABLED（"游戏中的前置插件：XXX未开启"）
     *     └─ 未找到 → Step 2
     *   Step 2: 在mod列表中查找
     *     ├─ 未找到 → NOT_FOUND（"缺少前置插件：XXX"）
     *     ├─ 找到但未开启 → MOD_DISABLED（"前置Mod插件：XXX未开启"）
     *     └─ 找到且已开启 → Step 3
     *   Step 3: 检查排序（仅mod间需要，游戏插件天然在最前）
     *     ├─ 依赖mod在当前mod之前 → PASS
     *     └─ 依赖mod在当前mod之后（含同位） → WRONG_ORDER（"应放置于前置Mod插件：XXX下方"）
     * 
     *  param {Array} modList - 模组数据列表，默认使用_modData
     *  returns {Object} 每个mod的依赖检测结果
     *   { modId: {
     *       baseDetails: [{ name, status, message }],
     *       orderAfterDetails: [{ name, status, message }],
     *       baseWarning: boolean,
     *       orderAfterWarning: boolean
     *   } }
     */
    function checkModDependencies(modList) {
        if (!modList) modList = _modData;
        const result = {};

        // 获取游戏原生插件信息 Map<插件名, {enabled}>
        const gamePlugins = getGamePluginInfo();

        // 构建当前mod列表的查找表：{ 插件名(不含.js): { mod, index, status } }
        const modLookup = {};
        modList.forEach((mod, index) => {
            const modName = mod.id.replace('../mods/', '');
            modLookup[modName] = { mod, index, status: mod.status };
            if (mod.fileName) {
                const fileNameNoExt = mod.fileName.replace(/\.js$/, '');
                modLookup[fileNameNoExt] = { mod, index, status: mod.status };
            }
            if (mod.id.startsWith('ws:')) {
                const parts = mod.id.split(':');
                if (parts.length >= 3) {
                    modLookup[parts[2]] = { mod, index, status: mod.status };
                }
            }
            if (mod.id.startsWith('local:')) {
                const parts = mod.id.split(':');
                if (parts.length >= 3) {
                    modLookup[parts[2]] = { mod, index, status: mod.status };
                }
            }
        });

        /**
         * 检测单个依赖插件的状态
         * @param {string} depName - 依赖插件名
         * @param {number} currentIndex - 当前mod在列表中的索引
         * @returns {{ status: string, message: string }}
         *   status: "pass" | "not_found" | "game_disabled" | "mod_disabled" | "wrong_order"
         */
        function checkSingleDep(depName, currentIndex) {
            // Step 1: 在游戏原生插件中查找
            const gameInfo = gamePlugins.get(depName);
            if (gameInfo) {
                if (gameInfo.enabled) {
                    // 游戏插件已开启，且游戏插件始终在mod之前加载 → 顺序天然满足
                    return { status: 'pass', message: '' };
                } else {
                    // 游戏插件存在但未开启
                    return { status: 'game_disabled', message: t('dep.gameDisabled').replace('{name}', depName) };
                }
            }

            // Step 2: 在mod列表中查找
            const modEntry = modLookup[depName];
            if (!modEntry) {
                // 游戏插件和mod列表中都找不到
                return { status: 'not_found', message: t('dep.notFound').replace('{name}', depName) };
            }

            if (!modEntry.status) {
                // mod存在但未开启
                return { status: 'mod_disabled', message: t('dep.modDisabled').replace('{name}', depName) };
            }

            // Step 3: mod已开启，检查排序
            if (modEntry.index < currentIndex) {
                // 依赖mod在当前mod之前 → 顺序正确
                return { status: 'pass', message: '' };
            } else {
                // 依赖mod在当前mod之后或同位 → 顺序错误
                return { status: 'wrong_order', message: t('dep.wrongOrder').replace('{name}', depName) };
            }
        }

        modList.forEach((mod, index) => {
            const modId = mod.id;
            const depInfo = {
                baseDetails: [],
                orderAfterDetails: [],
                baseWarning: false,
                orderAfterWarning: false
            };

            // ---- 检测 @base 依赖 ----
            if (mod.baseList && mod.baseList.length > 0) {
                for (const depName of mod.baseList) {
                    const check = checkSingleDep(depName, index);
                    depInfo.baseDetails.push({
                        name: depName,
                        status: check.status,
                        message: check.message
                    });
                    if (check.status !== 'pass') {
                        depInfo.baseWarning = true;
                    }
                }
            }

            // ---- 检测 @orderAfter 依赖 ----
            if (mod.orderAfterList && mod.orderAfterList.length > 0) {
                for (const depName of mod.orderAfterList) {
                    const check = checkSingleDep(depName, index);
                    depInfo.orderAfterDetails.push({
                        name: depName,
                        status: check.status,
                        message: check.message
                    });
                    if (check.status !== 'pass') {
                        depInfo.orderAfterWarning = true;
                    }
                }
            }

            result[modId] = depInfo;
        });

        return result;
    }

    /**
     * 缓存的依赖检测结果
     */
    let _dependencyCache = {};

    /**
     * 刷新依赖检测缓存并更新UI
     * 在进入管理器、排序变动、开关变动时调用
     */
    function refreshDependencyCheck() {
        _dependencyCache = checkModDependencies(_modData);
        log(3, "依赖检测完成，结果:", JSON.stringify(_dependencyCache));
    }

    /**
     * 获取指定mod的依赖状态
     * 【V3.15.1 修改】返回类型更新为含 baseDetails/orderAfterDetails
     * @param {Object} mod - 模组对象
     * @returns {Object} { baseDetails, orderAfterDetails, baseWarning, orderAfterWarning }
     */
    function getModDepStatus(mod) {
        if (!mod || !mod.id) return { baseDetails: [], orderAfterDetails: [], baseWarning: false, orderAfterWarning: false };
        return _dependencyCache[mod.id] || { baseDetails: [], orderAfterDetails: [], baseWarning: false, orderAfterWarning: false };
    }

    /**
     * 为运行时加载组装 Mod 的 PluginManager 参数字典
     * @param {Object} mod - scanMods() 返回的模组对象
     * @returns {Object} parameters 对象
     */
    function buildModFinalParameters(mod) {
        const finalParams = {};
        if (!mod.params) return finalParams;
        mod.params.forEach(p => {
            let value = mod.currentParams.hasOwnProperty(p.name)
                ? mod.currentParams[p.name]
                : p.default;

            if (value === '' || value === undefined || value === null) {
                finalParams[p.name] = p.default;
            } else if (p.type === 'number') {
                const numValue = Number(value);
                if (isNaN(numValue)) {
                    finalParams[p.name] = p.default;
                } else {
                    let finalValue = numValue;
                    if (p.min !== undefined && finalValue < p.min) finalValue = p.min;
                    if (p.max !== undefined && finalValue > p.max) finalValue = p.max;
                    finalParams[p.name] = String(finalValue);
                }
            } else if (p.type === 'color') {
                finalParams[p.name] = isValidColor(value) ? value : p.default;
            } else if (isNoteType(p.type)) {
                finalParams[p.name] = sanitizeText(value);
            } else if (isDatabaseType(p.type)) {
                finalParams[p.name] = String(value);
            } else if (p.type === 'struct' || p.type === 'table') {
                finalParams[p.name] = value || p.default;
            } else {
                finalParams[p.name] = sanitizeText(value);
            }
        });
        return finalParams;
    }

    /**
     * 运行时通过 PluginManager 加载已启用的 Mod（不修改 plugins.js）
     * @param {Array} [mods] - 模组列表，默认 scanAllMods()
     */
    function loadEnabledModsRuntime(mods) {
        if (typeof PluginManager === 'undefined') return;
        if (PluginManager._modLoaderModsLoaded) return;

        ensureModLoaderConfigFile();
        invalidateWorkshopConfigCache();
        if (!mods) mods = scanAllMods();
        const enabled = mods
            .filter(m => m.status && m.installState === 'ready')
            .sort((a, b) => (a.order || 0) - (b.order || 0));

        const loadedPaths = new Set();
        for (const mod of enabled) {
            const loadPath = mod.loadPath || mod.id;
            if (loadedPaths.has(loadPath)) {
                log(2, 'Mod loadPath 重复，跳过:', loadPath);
                continue;
            }
            loadedPaths.add(loadPath);

            const pluginName = typeof Utils !== 'undefined'
                ? Utils.extractFileName(loadPath)
                : mod.displayName;
            if (PluginManager._scripts.includes(pluginName)) {
                log(2, 'Mod 已加载，跳过:', pluginName);
                continue;
            }
            PluginManager.setParameters(pluginName, buildModFinalParameters(mod));
            PluginManager.loadScript(loadPath);
            PluginManager._scripts.push(pluginName);
            log(3, '运行时加载 Mod:', pluginName, 'loadPath:', loadPath);
        }
        PluginManager._modLoaderModsLoaded = true;
        log(3, '运行时 Mod 加载完成，共', enabled.length, '个');
    }

    /**
     * 插件模式：ModLoader 在 PluginManager.setup 异步加载链中才执行，首轮 setup 可能已结束；
     * 延迟到当前宏任务/短延时后再加载 Mod，并补装 Hook。
     */
    function deferLoadEnabledModsRuntime() {
        if (typeof PluginManager === 'undefined') return;
        if (PluginManager._modLoaderModsLoaded) return;
        const run = () => {
            if (!PluginManager._modLoaderModsLoaded) {
                loadEnabledModsRuntime();
            }
        };
        setTimeout(run, 0);
        setTimeout(run, 100);
    }

    function bootstrapModLoaderReady() {
        ensureModLoaderConfigFile();
        invalidateWorkshopConfigCache();
        if (typeof PluginManager === 'undefined') return;
        installPluginManagerHook();
        if (document.readyState === 'complete') {
            deferLoadEnabledModsRuntime();
        }
    }

    /**
     * 安装 PluginManager.setup Hook，在官方插件之后加载 Mod
     */
    function installPluginManagerHook() {
        if (typeof PluginManager === 'undefined') return false;
        if (PluginManager._modLoaderHooked) return true;

        const _setup = PluginManager.setup;
        PluginManager.setup = function (plugins) {
            _setup.call(this, plugins);
            deferLoadEnabledModsRuntime();
        };
        PluginManager._modLoaderHooked = true;
        log(3, "PluginManager.setup Hook 已安装");

        // 插件模式：Hook 安装时首轮 setup 可能已在进行或刚结束
        if (PluginManager._scripts && PluginManager._scripts.length > 0) {
            deferLoadEnabledModsRuntime();
        }
        return true;
    }

    /**
     * 等待 PluginManager 可用后安装 Hook（注入模式 / 插件模式均适用）
     */
    function installBootstrapHooks() {
        if (installPluginManagerHook()) return;

        const timer = setInterval(() => {
            if (installPluginManagerHook()) clearInterval(timer);
        }, 10);
        setTimeout(() => clearInterval(timer), 60000);
    }

    /**
     * 插件模式兜底：window.load 时补载 Mod（首轮 setup 时 ModLoader 可能尚未安装 Hook）
     */
    function installWindowLoadFallback() {
        const onReady = () => bootstrapModLoaderReady();
        window.addEventListener('load', onReady);
        if (document.readyState === 'complete') {
            onReady();
        }
    }

    /**
     * 迁移：从 plugins.js 移除旧版写入的 Mod 条目（__isMod 或 ../mods/ 路径）
     */
    function cleanupLegacyModEntriesFromPluginsJs() {
        try {
            if (!fs.existsSync(PLUGINS_PATH)) return;
            const content = fs.readFileSync(PLUGINS_PATH, 'utf-8');
            const lines = content.split('\n');
            const kept = [];
            let removed = 0;

            for (const line of lines) {
                const objMatch = line.match(/^\s*(\{.*\})\s*,?\s*$/);
                if (objMatch) {
                    try {
                        const obj = JSON.parse(objMatch[1]);
                        const isLegacyMod = obj.__isMod || (obj.name && String(obj.name).startsWith('../mods/'));
                        if (isLegacyMod) {
                            removed++;
                            continue;
                        }
                    } catch (jsonErr) { /* 保留无法解析的行 */ }
                }
                kept.push(line);
            }

            if (removed > 0) {
                fs.writeFileSync(PLUGINS_PATH, kept.join('\n'), 'utf-8');
                log(3, `已从 plugins.js 清理 ${removed} 条旧版 Mod 注册`);
            }
        } catch (e) {
            log(1, "清理 plugins.js 旧 Mod 条目失败", e);
        }
    }

    // ================================================================
    // 5. 工具函数
    // ================================================================


    // 滚动修复：为特定容器绑定 wheel 事件，防止被 RMMZ 或其他插件拦截
    // =========滚动修复开始============================================
    let _wheelListeners = []; // 存储需要移除的监听器

    /**
     * 为滚动容器绑定 wheel 事件（阻止冒泡但不阻止默认滚动行为）
     * @param {HTMLElement} container - 需要滚动的 DOM 元素
     */
    function bindWheelToContainer(container) {
        if (!container || container._wheelBound) return;
        const handler = (e) => {
            // 只阻止事件冒泡到外层，不调用 preventDefault() 以保证滚动正常
            e.stopPropagation();
        };
        container.addEventListener('wheel', handler);
        container._wheelBound = true;
        _wheelListeners.push({ container, handler });
    }

    /**
     * 解绑所有 wheel 监听器
     */
    function unbindAllWheelListeners() {
        _wheelListeners.forEach(({ container, handler }) => {
            container.removeEventListener('wheel', handler);
            container._wheelBound = false;
        });
        _wheelListeners = [];
    }

    /**
     * 绑定所有 ModLoader 相关的滚动容器
     */
    function bindModLoaderScrollContainers() {
        // 主界面滚动区域
        const listScroll = document.getElementById('ml-list-scroll');
        const detailPanel = document.getElementById('ml-detail-panel');
        if (listScroll) bindWheelToContainer(listScroll);
        if (detailPanel) bindWheelToContainer(detailPanel);
        
        // 参数模态框中的滚动区域（如果存在）
        const modalBody = document.querySelector('.ml-modal-body');
        if (modalBody) bindWheelToContainer(modalBody);
    }
    // =========滚动修复结束======================================
    
    /**
     * cssEscape 兼容性 polyfill
     * 用于将参数名转为合法 CSS ID
     */
    function cssEscape(str) {
        if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(str);
        // 简易 fallback：替换非字母数字字符
        return str.replace(/[^a-zA-Z0-9_-]/g, '_');
    }
    
    /**
     * 验证颜色格式是否有效
     * 支持：#RRGGBB, #RGB, rgb/rgba, hsl/hsla, 或有效的颜色名
     */
    function isValidColor(color) {
        if (!color || color === '') return false;
        
        // 检查 #RRGGBB 或 #RGB
        if (/^#([0-9A-Fa-f]{3}){1,2}$/.test(color)) return true;
        
        // 检查 rgb/rgba
        if (/^rgba?\s*\(\s*\d+\s*,\s*\d+\s*,\s*\d+(\s*,\s*(0|1|0?\.\d+))?\s*\)$/i.test(color)) return true;
        
        // 检查 hsl/hsla
        if (/^hsla?\s*\(\s*\d+\s*,\s*\d+%?\s*,\s*\d+%?(\s*,\s*(0|1|0?\.\d+))?\s*\)$/i.test(color)) return true;
        
        // 检查常见颜色名（简化版）
        const colorNames = ['black', 'white', 'red', 'green', 'blue', 'yellow', 'cyan', 'magenta', 
                            'gray', 'grey', 'orange', 'purple', 'pink', 'brown', 'lightgray', 
                            'darkgray', 'lightgrey', 'darkgrey', 'transparent', 'aqua', 
                            'lime', 'maroon', 'navy', 'olive', 'silver', 'teal', 'violet'];
        if (colorNames.includes(color.toLowerCase())) return true;
        
        return false;
    }

    // ====================================================================
    // 通用输入验证与安全函数（顶层 / struct / table 共用）
    // ====================================================================

    /**
     * 验证并修正数值输入框的值
     * - NaN → 回退到 fallback
     * - 超出 [min, max] → clamp 到边界
     * - 空值 → 回退到 fallback
     * @param {HTMLInputElement} inputEl - 数值输入框元素
     * @param {object} opts - 选项 { min, max, fallback }
     * @returns {string} 修正后的合法值（字符串形式）
     */
    function validateNumberInput(inputEl, opts) {
        const raw = inputEl.value.trim();
        const { min, max, fallback } = opts;
        const defaultVal = fallback !== undefined ? fallback : '0';

        if (raw === '' || raw === undefined || raw === null) {
            inputEl.value = defaultVal;
            log(3, `[validateNumber] 空值，回退到: ${defaultVal}`);
            return defaultVal;
        }

        let num = Number(raw);
        if (isNaN(num)) {
            inputEl.value = defaultVal;
            log(3, `[validateNumber] 非法数字 "${raw}"，回退到: ${defaultVal}`);
            return defaultVal;
        }

        // clamp 到范围
        if (min !== undefined && num < min) { num = min; }
        if (max !== undefined && num > max) { num = max; }
        const result = String(num);
        inputEl.value = result;
        return result;
    }

    /**
     * 验证并修正颜色输入框的值
     * - 非法颜色 → 回退到 fallback
     * @param {HTMLInputElement} textInputEl - 颜色文本输入框元素
     * @param {HTMLInputElement} [colorInputEl] - 颜色选择器元素（可选，用于同步）
     * @param {string} fallback - 回退默认值
     * @returns {string} 修正后的合法颜色值
     */
    function validateColorInput(textInputEl, colorInputEl, fallback) {
        const raw = textInputEl.value.trim();
        const defaultVal = fallback || '#ffffff';

        if (!raw || !isValidColor(raw)) {
            textInputEl.value = defaultVal;
            if (colorInputEl) {
                colorInputEl.value = defaultVal.startsWith('#') ? defaultVal : '#ffffff';
            }
            log(3, `[validateColor] 非法颜色 "${raw}"，回退到: ${defaultVal}`);
            return defaultVal;
        }

        // 合法颜色，同步到颜色选择器
        if (colorInputEl && raw.startsWith('#')) {
            colorInputEl.value = raw;
        }
        return raw;
    }

    /**
     * 验证并修正文本输入框的值（含 XSS 防护）
     * - 空值 → 回退到 fallback
     * - 含危险字符 → sanitize
     * @param {HTMLInputElement} inputEl - 文本输入框元素
     * @param {string} fallback - 回退默认值
     * @returns {string} 修正后的安全文本值
     */
    function validateTextInput(inputEl, fallback) {
        let raw = inputEl.value;
        const defaultVal = fallback !== undefined ? fallback : '';

        if (raw === '' || raw === undefined || raw === null) {
            inputEl.value = defaultVal;
            return defaultVal;
        }

        // XSS 防护：移除危险内容
        const sanitized = sanitizeText(raw);
        if (sanitized !== raw) {
            inputEl.value = sanitized;
            log(3, `[validateText] 文本已净化，移除了潜在危险内容`);
        }
        return sanitized;
    }

    /**
     * 文本 XSS 净化函数
     * 移除/转义可能被用于注入攻击的内容：
     * - <script> 标签
     * - javascript: 协议
     * - 事件处理器属性 (onxxx=)
     * - <iframe>, <embed>, <object> 等危险标签
     * - data: 协议中的 HTML
     * 
     * 注意：此函数用于净化"存储到配置文件"的文本值，
     * 防止恶意 Mod 作者通过参数值注入脚本攻击玩家。
     * 渲染时仍使用 escapeHtml() 进行二次防护。
     * 
     * @param {string} text - 原始文本
     * @returns {string} 净化后的安全文本
     */
    function sanitizeText(text) {
        if (!text || typeof text !== 'string') return text;

        let result = text;

        // 1. 移除 <script> 标签及其内容
        result = result.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

        // 2. 移除危险 HTML 标签（iframe, embed, object, applet, form, base, link, meta）
        result = result.replace(/<\/?(iframe|embed|object|applet|form|base|link|meta)\b[^>]*>/gi, '');

        // 3. 移除事件处理器属性 (onclick, onerror, onload, etc.)
        result = result.replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '');

        // 4. 移除 javascript: 协议
        result = result.replace(/javascript\s*:/gi, '');

        // 5. 移除 data:text/html 协议
        result = result.replace(/data\s*:\s*text\/html/gi, '');

        // 6. 移除 vbscript: 协议
        result = result.replace(/vbscript\s*:/gi, '');

        return result;
    }

    /**
     * 为数值输入框绑定通用 blur 验证事件
     * @param {HTMLInputElement} inputEl - 数值输入框元素
     * @param {object} opts - 选项 { min, max, fallback, onChange? }
     */
    function bindNumberValidation(inputEl, opts) {
        if (!inputEl) return;
        inputEl.addEventListener('blur', () => {
            const val = validateNumberInput(inputEl, opts);
            if (opts.onChange) opts.onChange(val);
        });
        // input 事件实时更新（不验证，仅传递值）
        inputEl.addEventListener('input', () => {
            if (opts.onChange) opts.onChange(inputEl.value);
        });
    }

    /**
     * 为颜色输入框组（文本框 + 颜色选择器）绑定通用验证事件
     * @param {HTMLInputElement} textInputEl - 颜色文本输入框
     * @param {HTMLInputElement} colorInputEl - 颜色选择器
     * @param {string} fallback - 回退默认值
     * @param {object} opts - 选项 { onChange? }
     */
    function bindColorValidation(textInputEl, colorInputEl, fallback, opts) {
        if (!textInputEl) return;

        // 文本框 blur 验证
        textInputEl.addEventListener('blur', () => {
            const val = validateColorInput(textInputEl, colorInputEl, fallback);
            if (opts && opts.onChange) opts.onChange(val);
        });

        // 文本框 input 实时同步到颜色选择器
        textInputEl.addEventListener('input', () => {
            const val = textInputEl.value.trim();
            if (isValidColor(val) && val.startsWith('#') && colorInputEl) {
                colorInputEl.value = val;
            }
            if (opts && opts.onChange) opts.onChange(val);
        });

        // 颜色选择器 input 实时同步到文本框
        if (colorInputEl) {
            colorInputEl.addEventListener('input', () => {
                textInputEl.value = colorInputEl.value;
                if (opts && opts.onChange) opts.onChange(colorInputEl.value);
            });
        }
    }

    /**
     * 为文本输入框绑定通用 blur 验证事件（含 XSS 防护）
     * @param {HTMLInputElement} inputEl - 文本输入框元素
     * @param {string} fallback - 回退默认值
     * @param {object} opts - 选项 { onChange? }
     */
    function bindTextValidation(inputEl, fallback, opts) {
        if (!inputEl) return;
        inputEl.addEventListener('blur', () => {
            const val = validateTextInput(inputEl, fallback);
            if (opts && opts.onChange) opts.onChange(val);
        });
        inputEl.addEventListener('input', () => {
            if (opts && opts.onChange) opts.onChange(inputEl.value);
        });
    }

    /**
     * 数据库引用类型映射表
     * 将 @type actor/skill/item/weapon/armor/enemy/state 映射到 RMMZ 全局变量和中文名
     */
    const DB_TYPE_MAP = {
        actor:  { global: '$dataActors',  label: '角色' },
        skill:  { global: '$dataSkills',  label: '技能' },
        item:   { global: '$dataItems',   label: '物品' },
        weapon: { global: '$dataWeapons', label: '武器' },
        armor:  { global: '$dataArmors',  label: '防具' },
        enemy:  { global: '$dataEnemies', label: '敌人' },
        state:  { global: '$dataStates',  label: '状态' }
    };

    /**
     * 判断参数类型是否为数据库引用类型
     */
    function isDatabaseType(type) {
        return DB_TYPE_MAP.hasOwnProperty(type);
    }

    function getDbLabel(type) {
        var key = 'db.' + type;
        var translated = t(key);
        if (translated !== key) return translated;
        var mapping = DB_TYPE_MAP[type];
        return mapping ? mapping.label : type;
    }

    /**
     * 获取数据库引用类型对应的 RMMZ 数据数组
     * 返回 null 表示数据库未加载
     */
    function getDatabaseArray(type) {
        const mapping = DB_TYPE_MAP[type];
        if (!mapping) return null;
        try {
            const data = window[mapping.global];
            if (data && Array.isArray(data)) return data;
        } catch (e) { /* 忽略 */ }
        return null;
    }

    /**
     * 判断参数类型是否为长文本类型
     */
    function isNoteType(type) {
        return type === 'note' || type === 'multiline_string';
    }

    /**
     * 计算数值参数的合适步长
     * 优先使用 @step 标签，否则根据 min/max 自动计算
     */
    function calculateStep(param) {
        // 优先使用自定义 step
        if (param.step !== undefined && !isNaN(param.step) && param.step > 0) {
            return param.step;
        }

        // 如果没有 min/max，默认步长 1
        if (param.min === undefined || param.max === undefined) {
            return 1;
        }

        const min = param.min;
        const max = param.max;
        const range = max - min;

        // 计算小数位数
        function getDecimalPlaces(num) {
            const str = num.toString();
            const dotIndex = str.indexOf('.');
            return dotIndex === -1 ? 0 : str.length - dotIndex - 1;
        }

        const minDecimals = getDecimalPlaces(min);
        const maxDecimals = getDecimalPlaces(max);
        const maxDecimalPlaces = Math.max(minDecimals, maxDecimals);

        // 根据范围和小数位数计算合适的步长
        if (maxDecimalPlaces > 0) {
            // 有小数的情况
            if (range <= 1) {
                return 0.1;
            } else if (range <= 10) {
                return 0.5;
            } else {
                // 范围较大时，根据小数位数确定步长
                return Math.pow(10, -maxDecimalPlaces);
            }
        }

        // 整数的情况
        return 1;
    }

    // ================================================================
    // 6. @color 标签解析器
    // ================================================================
    /**
     * 解析 @color 标签并转换为 HTML <span> 标签
     * 支持格式：
     *   @color[#ff0000]红色文字@/color       → <span style="color:#ff0000">红色文字</span>
     *   @color[24]RMMZ色号文字@/color        → <span style="color:rgb(r,g,b)">RMMZ色号文字</span>
     *   @color[red]CSS颜色名文字@/color      → <span style="color:red">CSS颜色名文字</span>
     *   @color[#ff0,bold]复合样式@/color      → <span style="color:#ff0;font-weight:bold">复合样式</span>
     * 同时兼容 RMMZ 标准 \c[n] 格式
     */
    function parseColorTags(text) {
        if (!text) return '';
        let result = text;

        // 解析 @color[value]...@/color 格式
        result = result.replace(/@color\[([^\]]+)\]([\s\S]*?)@\/color/g, (match, colorVal, content) => {
            let cssColor = colorVal;
            let extraStyle = '';

            // 如果是纯数字，使用 RMMZ ColorManager 色号映射
            if (/^\d+$/.test(colorVal.trim())) {
                const idx = parseInt(colorVal.trim());
                try {
                    if (typeof ColorManager !== 'undefined' && ColorManager.textColor) {
                        cssColor = ColorManager.textColor(idx);
                    }
                } catch (e) {
                    log(2, "ColorManager.textColor 调用失败，使用原始值", idx, e);
                    cssColor = String(idx);
                }
            }

            return `<span style="color:${cssColor}${extraStyle}">${content}</span>`;
        });

        // 兼容 RMMZ 标准 \c[n] 格式（简单映射为 span）
        result = result.replace(/\\c\[(\d+)\]/g, (match, idxStr) => {
            const idx = parseInt(idxStr);
            let cssColor = '';
            try {
                if (typeof ColorManager !== 'undefined' && ColorManager.textColor) {
                    cssColor = ColorManager.textColor(idx);
                }
            } catch (e) {
                cssColor = '';
            }
            if (cssColor) {
                return `</span><span style="color:${cssColor}">`;
            }
            return '</span><span>';
        });

        return result;
    }

    /**
     * HTML 转义，防止 XSS
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 安全渲染文本：先转义 HTML 实体，再解析 @color 标签
     */
    function renderSafeText(text) {
        if (!text) return '';
        // 先转义所有 HTML 特殊字符，防止注入
        let safe = escapeHtml(text);
        // 然后解析 @color 标签（@color 标签本身是自定义格式，需要还原）
        // 由于 escapeHtml 会把 < > & 转义，但 @color 不含这些字符，所以直接解析即可
        // 但 @color 解析后会生成 <span>，所以我们需要在转义之前解析 @color
        // 重新设计：先解析 @color 生成 HTML，对非 @color 部分转义
        return parseColorTagsFromRaw(text);
    }

    /**
     * 从原始文本中解析 @color 标签，非标签部分进行 HTML 转义
     */
    function parseColorTagsFromRaw(text) {
        if (!text) return '';
        let result = '';
        let remaining = text;

        // 匹配 @color[value]...@/color
        const colorRegex = /@color\[([^\]]+)\]([\s\S]*?)@\/color/g;
        let lastIndex = 0;
        let match;

        while ((match = colorRegex.exec(text)) !== null) {
            // 转义标签之前的普通文本
            result += escapeHtml(text.substring(lastIndex, match.index));

            let colorVal = match[1];
            let content = match[2];
            let cssColor = colorVal;

            // RMMZ 色号映射
            if (/^\d+$/.test(colorVal.trim())) {
                const idx = parseInt(colorVal.trim());
                try {
                    if (typeof ColorManager !== 'undefined' && ColorManager.textColor) {
                        cssColor = ColorManager.textColor(idx);
                    }
                } catch (e) {
                    log(2, "ColorManager.textColor 调用失败", idx, e);
                }
            }

            // 标签内容也需要转义（但保留内部嵌套的 @color）
            result += `<span style="color:${cssColor}">${escapeHtml(content)}</span>`;
            lastIndex = match.index + match[0].length;
        }

        // 转义剩余的普通文本
        result += escapeHtml(text.substring(lastIndex));

        // 兼容 \c[n] 格式
        result = result.replace(/\\c\[(\d+)\]/g, (m, idxStr) => {
            const idx = parseInt(idxStr);
            let cssColor = '';
            try {
                if (typeof ColorManager !== 'undefined' && ColorManager.textColor) {
                    cssColor = ColorManager.textColor(idx);
                }
            } catch (e) { /* 忽略 */ }
            return cssColor ? `</span><span style="color:${cssColor}">` : '';
        });

        return result;
    }

    // ================================================================
    // 6. CSS 样式注入
    // ================================================================
    function injectStyles() {
            var mlConfig = loadModLoaderConfig();
            _currentTheme = mlConfig.ml_theme || 'dark';
            document.documentElement.setAttribute('data-ml-theme', _currentTheme);

            if (document.getElementById('ml-styles')) {
                log(3, 'CSS 样式已存在，已同步主题配置: ' + _currentTheme);
                return;
            }

            var styleEl = document.createElement('style');
            styleEl.id = 'ml-styles';

            var cssPath = pathMod.join(MODS_DIR, 'config', 'modloader.css');
            var cssContent = null;
            try {
                if (fs.existsSync(cssPath)) {
                    cssContent = fs.readFileSync(cssPath, 'utf-8');
                }
            } catch (e) {
                log(1, '读取外部 CSS 文件失败: ' + e.message);
            }

            if (!cssContent) {
                log(1, 'CSS 文件缺失，使用内置降级样式');
                cssContent = getFallbackCSS_ml();
            }

            styleEl.textContent = cssContent;
            document.head.appendChild(styleEl);

            log(3, 'CSS 样式注入完成，当前主题: ' + _currentTheme);
        }
    
        function getFallbackCSS_ml() {
            return 'html[data-ml-theme="dark"]{' +
                '--ml-bg-overlay:rgba(8,8,18,0.88);--ml-bg-primary:rgba(18,18,32,1);' +
                '--ml-bg-secondary:rgba(28,28,48,0.95);--ml-bg-tertiary:rgba(38,38,58,0.90);' +
                '--ml-bg-hover:rgba(255,255,255,0.06);--ml-bg-active:rgba(74,158,255,0.12);' +
                '--ml-bg-selected:rgba(74,158,255,0.18);--ml-border:rgba(255,255,255,0.08);' +
                '--ml-border-light:rgba(255,255,255,0.15);--ml-text-primary:#e8e8ec;' +
                '--ml-text-secondary:#9a9ab0;--ml-text-muted:#666680;--ml-accent:#4a9eff;' +
                '--ml-accent-hover:#5cb0ff;--ml-success:#4caf50;--ml-success-bg:rgba(76,175,80,0.15);' +
                '--ml-danger:#ef5350;--ml-danger-bg:rgba(239,83,80,0.15);--ml-warning:#ffa726;' +
                '--ml-warning-bg:rgba(255,167,38,0.15);--ml-radius-sm:6px;--ml-radius:10px;' +
                '--ml-radius-lg:14px;--ml-shadow:0 8px 32px rgba(0,0,0,0.4);' +
                '--ml-shadow-lg:0 20px 60px rgba(0,0,0,0.6);--ml-transition:0.2s ease;' +
                '--ml-font:"Microsoft YaHei","PingFang SC","Noto Sans SC","WenQuanYi Micro Hei",sans-serif;}' +
                '.ml-overlay{position:fixed;top:0;left:0;width:100%;height:100%;z-index:10000;' +
                'background:var(--ml-bg-overlay);display:flex;align-items:center;justify-content:center;' +
                'font-family:var(--ml-font);color:var(--ml-text-primary);user-select:none;}' +
                '.ml-container{background:var(--ml-bg-primary);border-radius:var(--ml-radius-lg);' +
                'border:1px solid var(--ml-border-light);box-shadow:var(--ml-shadow-lg);width:900px;' +
                'max-width:94vw;max-height:88vh;display:flex;flex-direction:column;overflow:hidden;}' +
                '.ml-header{padding:18px 24px;background:var(--ml-bg-secondary);' +
                'border-bottom:1px solid var(--ml-border);display:flex;align-items:center;' +
                'justify-content:space-between;flex-shrink:0;}' +
                '.ml-header h2{margin:0;font-size:20px;font-weight:700;color:var(--ml-text-primary);}' +
                '.ml-header-info{display:flex;gap:10px;align-items:center;}' +
                '.ml-badge{font-size:12px;padding:3px 10px;border-radius:var(--ml-radius-sm);font-weight:600;}' +
                '.ml-badge-success{background:var(--ml-success-bg);color:var(--ml-success);}' +
                '.ml-badge-warning{background:var(--ml-warning-bg);color:var(--ml-warning);}' +
                '.ml-content{flex:1;display:flex;overflow:hidden;min-height:0;}' +
                '.ml-list-panel{width:320px;border-right:1px solid var(--ml-border);display:flex;' +
                'flex-direction:column;flex-shrink:0;}' +
                '.ml-list-header{font-size:13px;font-weight:600;padding:12px 16px;' +
                'background:var(--ml-bg-tertiary);border-bottom:1px solid var(--ml-border);' +
                'display:flex;justify-content:space-between;align-items:center;color:var(--ml-text-secondary);}' +
                '.ml-list-scroll{flex:1;overflow-y:auto;overflow-x:hidden;padding:6px 8px;}' +
                '.ml-mod-item{display:flex;align-items:center;gap:10px;padding:8px 10px;margin:2px 0;' +
                'border-radius:var(--ml-radius-sm);cursor:pointer;transition:background var(--ml-transition);' +
                'border:1px solid transparent;}' +
                '.ml-mod-item:hover{background:var(--ml-bg-hover);}' +
                '.ml-mod-item.selected{background:var(--ml-bg-selected);border-color:var(--ml-accent);}' +
                '.ml-workshop-unsubscribed{opacity:0.55;}' +
                '.ml-workshop-warn .ml-mod-name{color:var(--ml-warning,#f59e0b);}' +
                '.ml-filter-btn.active{background:var(--ml-accent);color:#fff;}' +
                '.ml-btn-sort-blocked{opacity:0.65;pointer-events:auto;}' +
                '.ml-toggle{position:relative;display:inline-block;width:38px;height:20px;flex-shrink:0;}' +
                '.ml-toggle input{display:none;}' +
                '.ml-toggle-track{position:absolute;top:0;left:0;right:0;bottom:0;background:var(--ml-danger-bg);' +
                'border-radius:10px;cursor:pointer;transition:background var(--ml-transition);border:1px solid var(--ml-border);}' +
                '.ml-toggle input:checked+.ml-toggle-track{background:var(--ml-accent);border-color:var(--ml-accent);}' +
                '.ml-toggle-thumb{position:absolute;top:2px;left:2px;width:14px;height:14px;background:#fff;' +
                'border-radius:50%;transition:transform var(--ml-transition);box-shadow:0 1px 3px rgba(0,0,0,0.3);}' +
                '.ml-toggle input:checked+.ml-toggle-track .ml-toggle-thumb{transform:translateX(18px);}' +
                '.ml-mod-name{flex:1;font-size:14px;font-weight:500;color:var(--ml-text-primary);' +
                'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;}' +
                '.ml-btn{padding:8px 18px;border-radius:var(--ml-radius-sm);font-size:14px;font-weight:500;' +
                'cursor:pointer;border:1px solid transparent;transition:all var(--ml-transition);font-family:var(--ml-font);}' +
                '.ml-btn-primary{background:var(--ml-accent);color:#fff;border-color:var(--ml-accent);}' +
                '.ml-btn-primary:hover{background:var(--ml-accent-hover);}' +
                '.ml-btn-secondary{background:var(--ml-bg-tertiary);color:var(--ml-text-primary);border-color:var(--ml-border);}' +
                '.ml-btn-secondary:hover{background:var(--ml-bg-hover);border-color:var(--ml-border-light);}' +
                '.ml-footer{padding:14px 24px;background:var(--ml-bg-secondary);border-top:1px solid var(--ml-border);' +
                'display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}' +
                '.ml-footer-actions{display:flex;gap:8px;}' +
                '.ml-modal-overlay{position:fixed;top:0;left:0;width:100%;height:100%;z-index:10001;' +
                'background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;' +
                'font-family:var(--ml-font);color:var(--ml-text-primary);user-select:none;}' +
                '.ml-modal{background:var(--ml-bg-primary);border-radius:var(--ml-radius-lg);' +
                'border:1px solid var(--ml-border-light);box-shadow:var(--ml-shadow-lg);width:520px;' +
                'max-width:92vw;max-height:80vh;display:flex;flex-direction:column;overflow:hidden;}' +
                '.ml-modal-header{padding:18px 24px;background:var(--ml-bg-secondary);' +
                'border-bottom:1px solid var(--ml-border);display:flex;align-items:center;justify-content:space-between;}' +
                '.ml-modal-header h3{margin:0;font-size:16px;font-weight:600;color:var(--ml-text-primary);}' +
                '.ml-modal-close{background:none;border:none;font-size:20px;color:var(--ml-text-muted);cursor:pointer;padding:4px;}' +
                '.ml-modal-close:hover{color:var(--ml-text-primary);}' +
                '.ml-modal-body{flex:1;overflow-y:auto;padding:20px 24px;}' +
                '.ml-modal-footer{padding:14px 24px;background:var(--ml-bg-secondary);' +
                'border-top:1px solid var(--ml-border);display:flex;gap:8px;}' +
                '.ml-detail-panel{flex:1;display:flex;flex-direction:column;overflow-y:auto;padding:20px 24px;min-width:0;}' +
                '.ml-changelog-link{color:var(--ml-accent);cursor:pointer;text-decoration:underline;font-size:11px;margin-left:2px;}' +
                '.ml-theme-toggle{cursor:pointer;text-decoration:none;font-size:13px;margin-left:4px;display:inline-block;}' +
                '@keyframes mlFadeIn{from{opacity:0}to{opacity:1}}' +
                '@keyframes mlSlideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}' +
                /* 【V3.15.0 新增】依赖检测警告内联样式 */
                '.ml-toggle-thumb.ml-dep-base-warning{background:#ef4444!important;box-shadow:0 0 6px rgba(239,68,68,0.6),0 1px 3px rgba(0,0,0,0.3);}' +
                '.ml-toggle-thumb.ml-dep-order-warning{background:#f59e0b!important;box-shadow:0 0 6px rgba(245,158,11,0.6),0 1px 3px rgba(0,0,0,0.3);}' +
                '.ml-dep-list{display:flex;flex-direction:column;gap:4px;line-height:1.6;}' +
                '.ml-dep-item{display:flex;align-items:baseline;gap:4px;padding:2px 0;flex-wrap:wrap;}' +
                '.ml-dep-reason{font-size:12px;opacity:0.85;margin-left:4px;font-weight:400;}' +
                '.ml-dep-text-base-missing{color:#ef4444;font-weight:600;padding:1px 4px;border-radius:3px;background:rgba(239,68,68,0.1);}' +
                '.ml-dep-text-order-missing{color:#f59e0b;font-weight:600;padding:1px 4px;border-radius:3px;background:rgba(245,158,11,0.1);}' +
                '.ml-dep-text-pass{color:#22c55e;padding:1px 4px;border-radius:3px;background:rgba(34,197,94,0.1);}' +
                '.ml-dep-label-base-missing{color:#ef4444!important;font-weight:700;}' +
                '.ml-dep-label-order-missing{color:#f59e0b!important;font-weight:700;}';
        }

    // ================================================================
    // 7. DOM UI 系统
    // ================================================================
    let _overlay = null;       // 主遮罩层
    let _modalOverlay = null;  // 参数编辑模态遮罩
    let _modData = [];         // 当前模组数据
    let _selectedIndex = -1;   // 当前选中索引
    let _needsRestart = false; // 是否需要重启提示
    let _titleBtn = null;     // 标题画面按钮
    let _hasUnsavedChanges = false; // 是否有未保存的修改
    let _draggedIndex = null;  // 当前拖拽的索引
    let _confirmModal = null;  // 确认对话框
    let _changelogModal = null; // 更新日志弹窗
    let _dragEnabled = false;  // 拖拽功能是否启用（默认关闭）
    let _dropPosition = null;  // 拖放位置：'before' 或 'after'
    let _keyboardCaptureActive = false;  // 是否开启了通用键盘捕获
    let _deleteMode = false;   // 删除模式是否启用
    let _listFilter = 'all';   // 列表筛选：all | local | workshop
    let _installOverlay = null; // 安装mod的全屏拖放遮罩
    let _currentTheme = 'dark';  // 当前主题
    
    // RMMZ 输入拦截备份
    let _originalInputUpdate = null;
    let _originalTouchInputUpdate = null;

    // 跟踪当前是否有输入框获得焦点
    let _isInputFocused = false;

    // Schema 字典：存储 @define-schema 定义的模板，供 @schema 引用
    // 格式: { 模板名: [ { name, type, text, default, min, max, step, options, schema, ... }, ... ] }
    let _schemaDictionary = {};
    
    /**
     * 检查是否有输入框获得焦点
     */
    function checkInputFocus() {
        const activeElement = document.activeElement;
        return activeElement && 
            (activeElement.tagName === 'INPUT' || 
             activeElement.tagName === 'TEXTAREA' || 
             activeElement.tagName === 'SELECT');
    }
    
    /**
     * 拦截 RMMZ 输入（防止穿透）
     */
    function blockRMMZInput() {
        // 备份原始函数
        if (typeof Input !== 'undefined' && !_originalInputUpdate) {
            _originalInputUpdate = Input.update;
            Input.update = function() {
                // 检查是否有输入框获得焦点
                _isInputFocused = checkInputFocus();
                
                // 如果有输入框获得焦点，完全不拦截 - 让浏览器处理所有输入
                if (_isInputFocused) {
                    return; // 直接返回，不做任何处理
                }
                
                // 没有输入框焦点时才拦截
                if (typeof Input !== 'undefined') Input.clear();
            };
        }
        if (typeof TouchInput !== 'undefined' && !_originalTouchInputUpdate) {
            _originalTouchInputUpdate = TouchInput.update;
            TouchInput.update = function() {
                // 检查是否有输入框获得焦点
                _isInputFocused = checkInputFocus();
                
                // 如果有输入框获得焦点，完全不拦截
                if (_isInputFocused) {
                    return;
                }
                
                // 没有输入框焦点时才拦截
                if (typeof TouchInput !== 'undefined') TouchInput.clear();
            };
        }
        
        // 清除当前状态
        if (typeof Input !== 'undefined') Input.clear();
        if (typeof TouchInput !== 'undefined') TouchInput.clear();
    }

    /**
     * 恢复 RMMZ 输入
     */
    function restoreRMMZInput() {
        // 恢复原始函数
        if (_originalInputUpdate && typeof Input !== 'undefined') {
            Input.update = _originalInputUpdate;
            _originalInputUpdate = null;
        }
        if (_originalTouchInputUpdate && typeof TouchInput !== 'undefined') {
            TouchInput.update = _originalTouchInputUpdate;
            _originalTouchInputUpdate = null;
        }
        
        // 清除状态
        if (typeof Input !== 'undefined') Input.clear();
        if (typeof TouchInput !== 'undefined') TouchInput.clear();
    }

    /**
     * 创建主遮罩层与容器
     */
    function createOverlay() {
        if (_overlay) return _overlay;

        _overlay = document.createElement('div');
        _overlay.className = 'ml-overlay';
        _overlay.id = 'ml-overlay';
        _overlay.style.display = 'none';

        _overlay.innerHTML = `
            <div class="ml-container">
                <div class="ml-header">
            <div style="display: flex; align-items: center; gap: 8px; position: relative;">
                <span class="ml-settings-gear" id="ml-settings-gear" title="${t('settings')}">⚙</span>
                <h2 style="margin: 0;">${t('title')}</h2>
                <span class="ml-list-header" style="font-size: 12px; color: var(--ml-text-muted); text-transform: uppercase; letter-spacing: 1px; background: none; padding: 0;">
                    ${t('author')} ${VERSION} <a class="ml-changelog-link" id="ml-changelog-link">${t('changelog')}</a>
                </span>
                <div class="ml-settings-card" id="ml-settings-card" style="display:none;">
                    <div class="ml-settings-item">
                        <label class="ml-settings-label">${t('language.label')}</label>
                        <select class="ml-form-select ml-settings-select" id="ml-language-select"></select>
                    </div>
                    <div class="ml-settings-item">
                        <label class="ml-settings-label">${t('settings.theme')}</label>
                        <div class="ml-settings-theme-btns">
                            <button class="ml-settings-theme-btn" id="ml-theme-btn-dark" data-theme="dark">${t('theme.dark')}</button>
                            <button class="ml-settings-theme-btn" id="ml-theme-btn-warm" data-theme="warm">${t('theme.warm')}</button>
                        </div>
                    </div>
                </div>
            </div>
                    <div class="ml-header-info" style="gap: 8px; align-items: center;">
                        <button class="ml-btn ml-btn-secondary" id="ml-btn-disable-all" style="font-size: 13px; padding: 4px 12px;">${t('button.disableAll')}</button>
                        <button class="ml-btn ml-btn-secondary" id="ml-btn-install" style="font-size: 13px; padding: 4px 12px;">${t('button.installMod')}</button>
                        <button class="ml-btn ml-btn-secondary" id="ml-btn-delete" style="font-size: 13px; padding: 4px 12px;">${t('button.deleteMod')}</button>
                        <button class="ml-btn ml-btn-secondary" id="ml-btn-sort" style="font-size: 13px; padding: 4px 12px;">${t('button.sortMod')}</button>
                        <span class="ml-badge ml-badge-success" id="ml-enabled-count">${t('count.enabled')}: 0</span>
                        <span class="ml-badge ml-badge-warning" id="ml-total-count">${t('count.total')}: 0</span>
                    </div>
                </div>
                <div class="ml-content">
                    <div class="ml-list-panel">
                        <div class="ml-list-toolbar" id="ml-list-toolbar" style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;border-bottom:1px solid var(--ml-border);">
                            <div class="ml-filter-tabs" id="ml-filter-tabs" style="display:flex;gap:6px;">
                                <button class="ml-btn ml-btn-secondary ml-filter-btn active" data-filter="all" style="font-size:12px;padding:2px 10px;">${t('tab.all')}</button>
                                <button class="ml-btn ml-btn-secondary ml-filter-btn" data-filter="local" style="font-size:12px;padding:2px 10px;">${t('tab.local')}</button>
                                <button class="ml-btn ml-btn-secondary ml-filter-btn" data-filter="workshop" style="font-size:12px;padding:2px 10px;">${t('tab.workshop')}</button>
                            </div>
                            <button class="ml-btn ml-btn-secondary" id="ml-btn-refresh-workshop" style="font-size:12px;padding:2px 10px;">${t('workshop.refresh')}</button>
                        </div>
                        <div class="ml-list-header">
                            <span style="font-size:13px;opacity:0.9">${t('list.headerOrder')}</span>
                            <span>${t('list.headerModList')}</span>
                            <span style="font-size:13px;opacity:0.9">${t('list.headerClickGear')}</span>
                        </div>
                        <div class="ml-list-scroll" id="ml-list-scroll"></div>
                    </div>
                    <div class="ml-detail-panel" id="ml-detail-panel">
                        <div class="ml-detail-empty">${t('detail.empty')}</div>
                    </div>
                </div>
                <div class="ml-footer">
                    <div style="display:flex;flex-direction:column;gap:4px;">
                        <div class="ml-restart-hint hidden" id="ml-restart-hint">
                            &#9888; ${t('footer.restartHint')}
                        </div>
                        <div class="ml-unsaved-indicator hidden" id="ml-unsaved-indicator">
                            &#8226; ${t('footer.unsaved')}
                        </div>
                    </div>
                    <div class="ml-footer-actions">
                        <button class="ml-btn ml-btn-primary" id="ml-btn-save">${t('button.save')}</button>
                        <button class="ml-btn ml-btn-secondary" id="ml-btn-close">${t('button.close')}</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(_overlay);

        // 绑定保存和关闭按钮
        document.getElementById('ml-btn-save').addEventListener('click', saveAllChanges);
        document.getElementById('ml-btn-close').addEventListener('click', tryCloseModManager);
        
        // 绑定安装、删除、排序按钮
        document.getElementById('ml-btn-disable-all').addEventListener('click', disableAllMods);
        document.getElementById('ml-btn-install').addEventListener('click', showInstallOverlay);
        document.getElementById('ml-btn-delete').addEventListener('click', toggleDeleteMode);
        document.getElementById('ml-btn-sort').addEventListener('click', toggleDrag);

        var filterTabs = document.getElementById('ml-filter-tabs');
        if (filterTabs) {
            filterTabs.addEventListener('click', function(e) {
                var btn = e.target.closest('[data-filter]');
                if (!btn) return;
                _listFilter = btn.dataset.filter || 'all';
                filterTabs.querySelectorAll('.ml-filter-btn').forEach(function(b) {
                    b.classList.toggle('active', b === btn);
                    b.style.backgroundColor = b === btn ? 'var(--ml-accent)' : '';
                    b.style.color = b === btn ? '#fff' : '';
                });
                onListFilterChanged();
            });
        }

        var refreshWorkshopBtn = document.getElementById('ml-btn-refresh-workshop');
        if (refreshWorkshopBtn) {
            refreshWorkshopBtn.addEventListener('click', refreshWorkshopMods);
        }
        
        // 绑定更新日志链接
        var changelogLink = document.getElementById('ml-changelog-link');
        if (changelogLink) {
            changelogLink.addEventListener('click', function(e) {
                e.stopPropagation();
                showChangelog();
            });
        }
        
        // 绑定系统设置齿轮
        var settingsGear = document.getElementById('ml-settings-gear');
        var settingsCard = document.getElementById('ml-settings-card');
        if (settingsGear && settingsCard) {
            settingsGear.addEventListener('click', function(e) {
                e.stopPropagation();
                if (settingsCard.style.display === 'none') {
                    settingsCard.style.display = 'block';
                    populateLanguageSelect();
                    updateThemeButtons();
                } else {
                    settingsCard.style.display = 'none';
                }
            });
        }
        
        // 点击设置卡片外部关闭
        document.addEventListener('click', function(e) {
            if (settingsCard && settingsGear && settingsCard.style.display === 'block') {
                if (!settingsCard.contains(e.target) && e.target !== settingsGear) {
                    settingsCard.style.display = 'none';
                }
            }
        });
        
        // 绑定语言下拉
        var langSelect = document.getElementById('ml-language-select');
        if (langSelect) {
            langSelect.addEventListener('change', function() {
                setLanguage(this.value);
                refreshAllUIText();
                updateThemeButtons();
                document.getElementById('ml-settings-gear').title = t('settings');
                if (settingsCard) settingsCard.style.display = 'none';
            });
        }
        
        // 绑定主题按钮
        var themeBtnDark = document.getElementById('ml-theme-btn-dark');
        var themeBtnWarm = document.getElementById('ml-theme-btn-warm');
        if (themeBtnDark) {
            themeBtnDark.addEventListener('click', function(e) {
                e.stopPropagation();
                setTheme('dark');
                updateThemeButtons();
            });
        }
        if (themeBtnWarm) {
            themeBtnWarm.addEventListener('click', function(e) {
                e.stopPropagation();
                setTheme('warm');
                updateThemeButtons();
            });
        }
        
        // 初始化按钮状态
        updateButtonStates();
        updateWorkshopToolbarState();

        // ESC 关闭
        _overlay.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (_modalOverlay) {
                    hideParamEditor();
                } else {
                    tryCloseModManager();
                }
            }
        });

        // 阻止事件穿透到底层（但不影响我们自己的界面）
        const blockToBelow = function(e) {
            // 只有点击的是 _overlay 本身时才阻止（不包括子元素）
            if (e.target === _overlay) {
                e.preventDefault();
                e.stopPropagation();
            }
        };
        _overlay.addEventListener('mousedown', blockToBelow);
        _overlay.addEventListener('mouseup', blockToBelow);
        _overlay.addEventListener('click', blockToBelow);
        _overlay.addEventListener('touchstart', blockToBelow);
        _overlay.addEventListener('touchend', blockToBelow);

        log(3, "DOM 遮罩层创建完成");
        // 绑定滚动容器
        bindModLoaderScrollContainers();
        return _overlay;
    }

    /**
     * 显示模组管理器
     */
    function showModManager() {
        ensureModLoaderConfigFile();
        const config = loadConfig();
        var mlConfig = loadModLoaderConfig();
        invalidateWorkshopConfigCache();
        loadLanguageConfigs();
        _currentLanguage = mlConfig.ml_language || 'zh_CN';
        if (!_languageConfigs[_currentLanguage]) {
            _currentLanguage = 'zh_CN';
        }
        applyTheme(mlConfig.ml_theme || 'dark');
        const overlay = createOverlay();
        _modData = scanAllMods();
        _selectedIndex = -1;
        _listFilter = 'all';
        _needsRestart = false;
        _hasUnsavedChanges = false;

        renderModList();
        renderDetail(null);
        updateCounts();
        updateRestartHint();
        updateSaveButton();
        updateButtonStates();
        updateWorkshopToolbarState();

        // 【V3.15.0 新增】进入管理器时检测依赖
        refreshDependencyCheck();
        // 依赖检测完成后重新渲染列表以显示警告颜色
        renderModList();

        overlay.style.display = 'flex';
        var filterTabs = document.getElementById('ml-filter-tabs');
        if (filterTabs) {
            filterTabs.querySelectorAll('.ml-filter-btn').forEach(function(b) {
                var isAll = b.dataset.filter === 'all';
                b.classList.toggle('active', isAll);
                b.style.backgroundColor = isAll ? 'var(--ml-accent)' : '';
                b.style.color = isAll ? '#fff' : '';
            });
        }
        bindModLoaderScrollContainers();   //  添加这一行修复进出管理器后的列表滚动失效
        overlay.focus();

        // 拦截 RMMZ 输入，防止穿透
        blockRMMZInput();
        
        // 开启通用键盘事件捕获，修复输入框方向键、删除键等问题
        if (!_keyboardCaptureActive) {
            document.addEventListener('keydown', keyboardCaptureHandler, true);
            document.addEventListener('keyup', keyboardCaptureHandler, true);
            document.addEventListener('keypress', keyboardCaptureHandler, true);
            _keyboardCaptureActive = true;
        }

        log(3, "模组管理器已打开，共", _modData.length, "个模组");
    }



    /**
     * 隐藏模组管理器
     */
    function hideModManager() {
        log(3, "=== hideModManager 开始 ===");
        
        if (_overlay) {
            _overlay.style.display = 'none';
        }
        
        unbindAllWheelListeners();//滚轮修复
        // 恢复 RMMZ 输入
        restoreRMMZInput();
        
        // 移除通用键盘事件捕获
        if (_keyboardCaptureActive) {
            document.removeEventListener('keydown', keyboardCaptureHandler, true);
            document.removeEventListener('keyup', keyboardCaptureHandler, true);
            document.removeEventListener('keypress', keyboardCaptureHandler, true);
            _keyboardCaptureActive = false;
        }
        
        log(3, "模组管理器已关闭");
    }

    /**
     * 刷新工坊 Mod 列表（重新扫描磁盘）
     */
    function refreshWorkshopMods() {
        invalidateWorkshopConfigCache();
        const prevId = _selectedIndex >= 0 && _modData[_selectedIndex] ? _modData[_selectedIndex].id : null;
        _modData = scanAllMods();
        refreshDependencyCheck();
        if (prevId) {
            const newIdx = _modData.findIndex(m => m.id === prevId);
            _selectedIndex = newIdx >= 0 ? newIdx : -1;
        } else {
            _selectedIndex = -1;
        }
        renderModList();
        updateCounts();
        if (_selectedIndex >= 0) {
            renderDetail(_modData[_selectedIndex]);
        } else {
            renderDetail(null);
        }
        log(3, '工坊 Mod 已刷新');
    }

    function isWorkshopFeatureEnabled() {
        return !!loadWorkshopConfig().enabled;
    }

    function updateWorkshopToolbarState() {
        const refreshBtn = document.getElementById('ml-btn-refresh-workshop');
        if (refreshBtn) {
            refreshBtn.style.display = isWorkshopFeatureEnabled() ? '' : 'none';
        }
    }

    function getModListEmptyMessage() {
        if (_listFilter === 'workshop' && !isWorkshopFeatureEnabled()) {
            return t('workshop.disabledHint');
        }
        return t('detail.noModFound');
    }

    function modMatchesListFilter(mod) {
        if (_listFilter === 'local') return mod.source === 'local';
        if (_listFilter === 'workshop') return mod.source === 'workshop';
        return true;
    }

    function isListFilterRestrictingSort() {
        return _listFilter !== 'all';
    }

    function onListFilterChanged() {
        if (isListFilterRestrictingSort() && _dragEnabled) {
            _dragEnabled = false;
        }
        updateButtonStates();
        renderModList();
    }

    /**
     * 渲染模组列表
     */
    function renderModList() {
        const container = document.getElementById('ml-list-scroll');
        if (!container) return;

        container.innerHTML = '';

        const visibleMods = _modData
            .map((mod, index) => ({ mod, index }))
            .filter(item => modMatchesListFilter(item.mod));

        if (visibleMods.length > 0) {
            visibleMods.forEach(({ mod, index }) => {
                const item = document.createElement('div');
                let itemClass = 'ml-mod-item' + (index === _selectedIndex ? ' selected' : '');
                if (mod.source === 'workshop' && mod.installState !== 'ready') {
                    itemClass += ' ml-workshop-warn';
                }
                if (mod.source === 'workshop' && !mod.subscribed) {
                    itemClass += ' ml-workshop-unsubscribed';
                }
                item.className = itemClass;
                item.dataset.index = index;
                item.draggable = _dragEnabled;

                const hasParams = mod.params && mod.params.length > 0;
                
                let orderHtml;
                if (_dragEnabled) {
                    orderHtml = `<input type="number" class="ml-order-input" value="${mod.order}" min="1" max="${_modData.length}" data-index="${index}">`;
                } else {
                    orderHtml = `<div class="ml-order-text" data-index="${index}">${mod.order}</div>`;
                }

                let deleteHtml = '';
                if (_deleteMode && !mod.readOnly) {
                    deleteHtml = `<div class="ml-delete-btn" data-action="delete" data-index="${index}" style="margin-left: 8px; background: #dc2626; color: white; padding: 2px 8px; border-radius: 4px; cursor: pointer; font-size: 14px; line-height: 1;">🗑️</div>`;
                }

                const depStatus = getModDepStatus(mod);
                let thumbClass = 'ml-toggle-thumb';
                if (depStatus.baseWarning) {
                    thumbClass += ' ml-dep-base-warning';
                } else if (depStatus.orderAfterWarning) {
                    thumbClass += ' ml-dep-order-warning';
                }

                let workshopBadge = '';
                if (mod.source === 'workshop') {
                    workshopBadge = `<span class="ml-badge ml-badge-warning" style="font-size:10px;margin-left:4px;" title="${escapeHtml(t('workshop.badge'))}">${t('workshop.badge')}</span>`;
                }

                let installWarn = '';
                if (mod.installState === 'missing') {
                    installWarn = `<span title="${escapeHtml(t('workshop.missing'))}" style="margin-left:4px;">⚠</span>`;
                } else if (mod.installState === 'unsubscribed') {
                    installWarn = `<span title="${escapeHtml(t('workshop.unsubscribed'))}" style="margin-left:4px;">○</span>`;
                }

                item.innerHTML = `
                    ${orderHtml}
                    <div class="ml-toggle ${mod.status ? 'on' : ''}" data-action="toggle" data-index="${index}">
                        <div class="${thumbClass}"></div>
                    </div>
                    <div class="ml-mod-name" data-action="select" data-index="${index}">
                        ${parseColorTagsFromRaw(mod.displayName)}${workshopBadge}${installWarn}
                    </div>
                    ${hasParams ? `<div class="ml-gear" data-action="params" data-index="${index}" title="${t('param.title')}">&#9881;</div>` : ''}
                    ${deleteHtml}
                `;

                container.appendChild(item);
            });
        }

        if (visibleMods.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'ml-empty-state';
            emptyState.style.paddingBottom = '0';
            emptyState.innerHTML = `
                <div class="ml-empty-state-icon">&#128230;</div>
                <div class="ml-empty-state-text">
                    ${escapeHtml(getModListEmptyMessage())}
                </div>
            `;
            container.insertBefore(emptyState, container.firstChild);
        }

        // 事件委托（仅绑定一次）
        if (!container._mlListenerAdded) {
            container.addEventListener('click', handleListClick);
            // 序号输入事件
            container.addEventListener('input', handleOrderInput);
            container.addEventListener('blur', handleOrderBlur, true);
            container.addEventListener('keydown', handleOrderKeydown, true);
            // 拖拽事件
            container.addEventListener('dragstart', handleDragStart);
            container.addEventListener('dragover', handleDragOver);
            container.addEventListener('dragleave', handleDragLeave);
            container.addEventListener('drop', handleDrop);
            container.addEventListener('dragend', handleDragEnd);
            container._mlListenerAdded = true;
        }
    }

    /**
     * 列表点击事件处理（事件委托）
     */
    function handleListClick(e) {
        const target = e.target.closest('[data-action]');
        if (!target) {
            // 点击了行但没点到具体控件，视为选中
            const item = e.target.closest('.ml-mod-item');
            if (item) {
                selectMod(parseInt(item.dataset.index));
            }
            return;
        }

        const action = target.dataset.action;
        const index = parseInt(target.dataset.index);

        e.stopPropagation();

        switch (action) {
            case 'toggle':
                toggleMod(index);
                break;
            case 'select':
                selectMod(index);
                break;
            case 'params':
                selectMod(index);
                const mod = _modData[index];
                if (mod && mod.params && mod.params.length > 0) {
                    showParamEditor(mod);
                }
                break;
            case 'delete':
                deleteMod(index);
                break;
        }
    }

    /**
     * 选中模组
     */
    function selectMod(index) {
        if (index < 0 || index >= _modData.length) return;
        _selectedIndex = index;

        // 更新选中样式
        const items = document.querySelectorAll('.ml-mod-item');
        items.forEach((item, i) => {
            item.classList.toggle('selected', i === index);
        });

        // 渲染详情
        renderDetail(_modData[index]);
        log(3, "选中模组:", _modData[index].displayName);
    }

    /**
     * 切换模组开关
     */
    function toggleMod(index) {
        if (index < 0 || index >= _modData.length) return;
        const mod = _modData[index];
        const newStatus = !mod.status;

        // 【V3.15.1 修改】开启时检测依赖，按具体原因弹框确认
        if (newStatus) {
            const depStatus = getModDepStatus(mod);
            if (depStatus.baseWarning || depStatus.orderAfterWarning) {
                let warningMsg = '';

                // @base 依赖问题（红色级别：容易崩溃）
                if (depStatus.baseWarning) {
                    const baseProblems = depStatus.baseDetails
                        .filter(d => d.status !== 'pass')
                        .map(d => `  • ${d.message}`)
                        .join('\n');
                    warningMsg += `⚠️ @base 依赖问题（可能导致游戏崩溃）：\n${baseProblems}\n\n`;
                }

                // @orderAfter 依赖问题（黄色级别：容易失效）
                if (depStatus.orderAfterWarning) {
                    const orderProblems = depStatus.orderAfterDetails
                        .filter(d => d.status !== 'pass')
                        .map(d => `  • ${d.message}`)
                        .join('\n');
                    warningMsg += `⚠️ @orderAfter 依赖问题（可能导致插件失效）：\n${orderProblems}\n\n`;
                }

                warningMsg += t('confirm.stillEnableMod');

                showConfirmDialog(t('confirm.depWarning'), warningMsg, [
                    { text: t('button.cancel'), class: "ml-btn-secondary", action: () => { hideConfirmDialog(); log(3, "用户取消开启模组:", mod.displayName); } },
                    { text: t('button.stillEnable'), class: "ml-btn-primary", action: () => { hideConfirmDialog(); doToggleMod(index, mod, newStatus); } }
                ]);
                return;
            }
        }

        doToggleMod(index, mod, newStatus);
    }

    /**
     * 【V3.15.0 新增】实际执行模组开关切换
     */
    function doToggleMod(index, mod, newStatus) {
        mod.status = newStatus;
        _hasUnsavedChanges = true;
        updateSaveButton();

        // 更新 UI
        const toggleEl = document.querySelector(`.ml-toggle[data-index="${index}"]`);
        if (toggleEl) {
            toggleEl.classList.toggle('on', mod.status);
        }

        // 【V3.15.0 新增】开关变化后刷新依赖检测（因为其他mod可能依赖此mod）
        refreshDependencyCheck();
        // 重新渲染列表以更新所有toggle-thumb的警告颜色
        renderModList();

        updateCounts();

        // 如果当前选中的就是这个模组，刷新详情
        if (_selectedIndex === index) {
            renderDetail(mod);
        }

        // 播放音效
        try {
            if (typeof SoundManager !== 'undefined') {
                SoundManager.playOk();
            }
        } catch (e) { /* 忽略 */ }

        log(3, "模组切换:", mod.displayName, mod.status ? "ON" : "OFF");
    }

    /**
     * 一键全关所有模组
     */
    function disableAllMods() {
        if (_modData.length === 0) return;

        let anyChanged = false;
        _modData.forEach((mod, index) => {
            if (mod.status) {
                mod.status = false;
                anyChanged = true;
                // 更新 UI
                const toggleEl = document.querySelector(`.ml-toggle[data-index="${index}"]`);
                if (toggleEl) {
                    toggleEl.classList.remove('on');
                }
                // 如果当前选中的就是这个模组，刷新详情
                if (_selectedIndex === index) {
                    renderDetail(mod);
                }
                log(3, "模组关闭:", mod.displayName);
            }
        });

        if (anyChanged) {
            _hasUnsavedChanges = true;
            updateSaveButton();
            updateCounts();
            // 【V3.15.0 新增】全关后刷新依赖检测
            refreshDependencyCheck();
            renderModList();
        }

        // 播放音效
        try {
            if (typeof SoundManager !== 'undefined') {
                SoundManager.playOk();
            }
        } catch (e) { /* 忽略 */ }

        log(3, "一键全关完成");
    }

    /**
     * 渲染详情面板
     */
    function renderDetail(mod) {
        const panel = document.getElementById('ml-detail-panel');
        if (!panel) return;

        var DT = {
            labelParams: t('detail.labelParams'),
            labelVersion: t('detail.labelVersion'),
            labelAuthor: t('detail.labelAuthor'),
            labelHelp: t('detail.labelHelp'),
            labelBaseDep: t('detail.labelBaseDep'),
            labelOrderAfter: t('detail.labelOrderAfter'),
            labelOrderBefore: t('detail.labelOrderBefore'),
            labelModName: t('detail.labelModName'),
            labelStatus: t('detail.labelStatus'),
            labelUnknown: t('detail.labelUnknown'),
            statusEnabled: t('detail.statusEnabled'),
            statusDisabled: t('detail.statusDisabled'),
            noHelp: t('detail.noHelp'),
            typeText: t('param.typeText'),
            typeBoolean: t('param.typeBoolean'),
            typeNumber: t('param.typeNumber'),
            typeSelect: t('param.typeSelect'),
            typeColor: t('param.typeColor'),
            typeNote: t('param.typeNote'),
            typeStruct: t('param.typeStruct'),
            typeTable: t('param.typeTable'),
            on: t('param.on'),
            off: t('param.off'),
            rowsData: t('param.rowsData')
        };

        if (!mod) {
            panel.innerHTML = '<div class="ml-detail-empty">' + t('detail.empty') + '</div>';
            return;
        }

        const hasParams = mod.params && mod.params.length > 0;

        let paramsHtml = '';
        if (hasParams) {
            paramsHtml = `
                <div class="ml-detail-section">
                    <div class="ml-detail-label">${DT.labelParams}</div>
                    <div class="ml-detail-params">
                        ${mod.params.map(p => {
                            const curVal = mod.currentParams.hasOwnProperty(p.name) ? mod.currentParams[p.name] : p.default;
                            let displayVal = curVal;
                            let typeLabel = DT.typeText;
                            if (p.type === 'boolean') {
                                displayVal = curVal === 'true' ? DT.on : DT.off;
                                typeLabel = DT.typeBoolean;
                            } else if (p.type === 'number') {
                                typeLabel = DT.typeNumber;
                            } else if (p.type === 'select') {
                                typeLabel = DT.typeSelect;
                            } else if (p.type === 'color') {
                                typeLabel = DT.typeColor;
                            } else if (isNoteType(p.type)) {
                                typeLabel = DT.typeNote;
                                // 截断显示过长的值
                                if (String(displayVal).length > 40) {
                                    displayVal = String(displayVal).substring(0, 40) + '...';
                                }
                            } else if (isDatabaseType(p.type)) {
                                typeLabel = getDbLabel(p.type);
                                // 尝试显示名称而非 ID
                                const dbArray = getDatabaseArray(p.type);
                                if (dbArray) {
                                    const id = Number(curVal);
                                    if (id > 0 && id < dbArray.length && dbArray[id] && dbArray[id].name) {
                                        displayVal = `${curVal}: ${dbArray[id].name}`;
                                    }
                                }
                            } else if (p.type === 'struct') {
                                // 阶段2新增：struct 类型在详情页显示为摘要
                                typeLabel = DT.typeStruct;
                                try {
                                    const obj = typeof curVal === 'string' ? JSON.parse(curVal) : curVal;
                                    const keys = Object.keys(obj || {});
                                    displayVal = `{${keys.length}字段: ${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}}`;
                                } catch (e) {
                                    displayVal = String(curVal).substring(0, 40);
                                }
                            } else if (p.type === 'table') {
                                // 阶段2新增：table 类型在详情页显示为行数摘要
                                typeLabel = DT.typeTable;
                                try {
                                    const arr = typeof curVal === 'string' ? JSON.parse(curVal) : curVal;
                                    displayVal = Array.isArray(arr) ? arr.length + ' ' + DT.rowsData : String(curVal).substring(0, 40);
                                } catch (e) {
                                    displayVal = String(curVal).substring(0, 40);
                                }
                            }
                            const isModified = curVal !== p.default;
                            return `
                                <div class="ml-detail-param-row">
                                    <span class="ml-detail-param-name">${escapeHtml(p.text || p.name)}</span>
                                    <span class="ml-detail-param-value${isModified ? ' modified' : ''}">${escapeHtml(String(displayVal))}</span>
                                    <span class="ml-detail-param-type">${typeLabel}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }

        let metaHtml = '';
        if (mod.version) {
            metaHtml += `
                <div class="ml-detail-section">
                    <div class="ml-detail-label">${DT.labelVersion}</div>
                    <div class="ml-detail-value">${escapeHtml(mod.version)}</div>
                </div>
            `;
        }
        // 【V3.15.1 修改】@base 依赖显示 - 5种状态判定，带具体原因文本
        if (mod.base) {
            const depStatus = getModDepStatus(mod);
            const baseItems = (depStatus.baseDetails || []).map(detail => {
                const isPass = detail.status === 'pass';
                // 根据状态选择图标和颜色
                let icon, colorClass;
                if (isPass) {
                    icon = '<span style="color:#22c55e;">✔</span>';
                    colorClass = 'ml-dep-text-pass';
                } else {
                    // 所有非pass状态统一用红色❌（@base缺失=崩溃级别）
                    icon = '<span style="color:#ef4444;">❌</span>';
                    colorClass = 'ml-dep-text-base-missing';
                }
                // 显示插件名 + 原因说明（pass不显示原因）
                const reasonText = isPass ? '' : `<span class="ml-dep-reason">${escapeHtml(detail.message)}</span>`;
                return `<div class="ml-dep-item ${colorClass}">${icon} ${escapeHtml(detail.name)} ${reasonText}</div>`;
            }).join('');
            const labelClass = depStatus.baseWarning ? 'ml-dep-label-base-missing' : '';
            metaHtml += `
                <div class="ml-detail-section">
                    <div class="ml-detail-label ${labelClass}">${DT.labelBaseDep}</div>
                    <div class="ml-detail-value ml-dep-list">${baseItems || escapeHtml(mod.base)}</div>
                </div>
            `;
        }
        // 【V3.15.1 修改】@orderAfter 依赖显示 - 5种状态判定，带具体原因文本
        if (mod.orderAfter) {
            const depStatus = getModDepStatus(mod);
            const orderAfterItems = (depStatus.orderAfterDetails || []).map(detail => {
                const isPass = detail.status === 'pass';
                let icon, colorClass;
                if (isPass) {
                    icon = '<span style="color:#22c55e;">✔</span>';
                    colorClass = 'ml-dep-text-pass';
                } else {
                    // @orderAfter缺失=失效级别，用黄色❌
                    icon = '<span style="color:#ef4444;">❌</span>';
                    colorClass = 'ml-dep-text-order-missing';
                }
                const reasonText = isPass ? '' : `<span class="ml-dep-reason">${escapeHtml(detail.message)}</span>`;
                return `<div class="ml-dep-item ${colorClass}">${icon} ${escapeHtml(detail.name)} ${reasonText}</div>`;
            }).join('');
            const labelClass = depStatus.orderAfterWarning ? 'ml-dep-label-order-missing' : '';
            metaHtml += `
                <div class="ml-detail-section">
                    <div class="ml-detail-label ${labelClass}">${DT.labelOrderAfter}</div>
                    <div class="ml-detail-value ml-dep-list">${orderAfterItems || escapeHtml(mod.orderAfter)}</div>
                </div>
            `;
        }
        if (mod.orderBefore) {
            metaHtml += `
                <div class="ml-detail-section">
                    <div class="ml-detail-label">${DT.labelOrderBefore}</div>
                    <div class="ml-detail-value">${escapeHtml(mod.orderBefore)}</div>
                </div>
            `;
        }

        let workshopHtml = '';
        if (mod.source === 'workshop') {
            const sourceLabel = t('detail.labelSource');
            const workshopSubLabel = t('detail.labelWorkshopSub');
            const workshopRootLabel = t('detail.labelWorkshopRoot');
            const installLabel = t('detail.labelInstallState');
            const pkgTitle = (mod.workshopPackageTitle || '').trim();
            const subDisplay = mod.workshopId
                ? (mod.workshopId + ' & ' + (pkgTitle || t('workshop.unnamedPackage')))
                : (pkgTitle || t('workshop.unnamedPackage'));
            let installText = t('detail.installReady');
            if (mod.installState === 'missing') installText = t('workshop.missing');
            else if (mod.installState === 'unsubscribed') installText = t('workshop.unsubscribed');
            workshopHtml = `
                <div class="ml-detail-section">
                    <div class="ml-detail-label">${escapeHtml(sourceLabel)}</div>
                    <div class="ml-detail-value">
                        <div>${escapeHtml(t('detail.sourceWorkshop'))}</div>
                        <div style="font-size:12px;color:var(--ml-text-muted);margin-top:4px;line-height:1.5;">${escapeHtml(t('workshop.sourceHintManage'))}</div>
                        <div style="font-size:12px;color:var(--ml-text-muted);margin-top:2px;line-height:1.5;">${escapeHtml(t('workshop.sourceHintSubscribe'))}</div>
                    </div>
                </div>
                <div class="ml-detail-section">
                    <div class="ml-detail-label">${escapeHtml(workshopSubLabel)}</div>
                    <div class="ml-detail-value">${escapeHtml(subDisplay)}</div>
                </div>
                <div class="ml-detail-section">
                    <div class="ml-detail-label">${escapeHtml(workshopRootLabel)}</div>
                    <div class="ml-detail-value" style="word-break:break-all;font-size:12px;">${escapeHtml(mod.workshopRoot || '')}</div>
                </div>
                <div class="ml-detail-section">
                    <div class="ml-detail-label">${escapeHtml(installLabel)}</div>
                    <div class="ml-detail-value">${escapeHtml(installText)}</div>
                </div>
            `;
        } else if (mod.source === 'local') {
            workshopHtml = `
                <div class="ml-detail-section">
                    <div class="ml-detail-label">${escapeHtml(t('detail.labelSource'))}</div>
                    <div class="ml-detail-value">${escapeHtml(t('detail.sourceLocal'))}</div>
                </div>
            `;
        }
        if (mod.loadPath) {
            workshopHtml += `
                <div class="ml-detail-section">
                    <div class="ml-detail-label">${escapeHtml(t('detail.labelFile'))}</div>
                    <div class="ml-detail-value" style="word-break:break-all;font-size:12px;">${escapeHtml(mod.loadPath)}</div>
                </div>
            `;
        }

        const workshopPreviewHtml = buildModPreviewHtml(mod);
        const detailHeaderRowClass = workshopPreviewHtml ? ' ml-detail-header-row' : '';

        panel.innerHTML = `
            <div class="ml-detail-section${detailHeaderRowClass}">
                <div class="ml-detail-header-info">
                    <div class="ml-detail-label">${DT.labelModName}</div>
                    <div class="ml-detail-value">${parseColorTagsFromRaw(mod.displayName)}</div>
                </div>
                ${workshopPreviewHtml}
            </div>
            ${workshopHtml}
            <div class="ml-detail-section">
                <div class="ml-detail-label">${DT.labelAuthor}</div>
                <div class="ml-detail-value">${escapeHtml(mod.author || DT.labelUnknown)}</div>
            </div>
            ${metaHtml}
            <div class="ml-detail-section">
                <div class="ml-detail-label">${DT.labelStatus}</div>
                <div class="ml-detail-value">
                    <span class="ml-badge ${mod.status ? 'ml-badge-success' : 'ml-badge-danger'}" style="${mod.status ? '' : 'background:var(--ml-danger-bg);color:var(--ml-danger);'}">
                        ${mod.status ? DT.statusEnabled : DT.statusDisabled}
                    </span>
                </div>
            </div>
            ${paramsHtml}
            <div class="ml-detail-section">
                <div class="ml-detail-label">${DT.labelHelp}</div>
                <div class="ml-detail-help">${parseColorTagsFromRaw(mod.help || DT.noHelp)}</div>
            </div>
        `;
        
        const previewEl = panel.querySelector('.ml-workshop-preview-clickable');
        if (previewEl) {
            const packageRoot = getModPackageRoot(mod);
            if (packageRoot) {
                previewEl.addEventListener('click', function(e) {
                    e.stopPropagation();
                    openPackagePreviewImage(packageRoot);
                });
            }
        }

        // 切换时滚动条重置到最顶部
        panel.scrollTop = 0;
    }

    /**
     * 更新计数
     */
    function updateCounts() {
        const enabledEl = document.getElementById('ml-enabled-count');
        const totalEl = document.getElementById('ml-total-count');
        if (enabledEl) {
            const count = _modData.filter(m => m.status).length;
            enabledEl.textContent = t('count.enabled') + ': ' + count;
        }
        if (totalEl) {
            totalEl.textContent = t('count.total') + ': ' + _modData.length;
        }
    }

    /**
     * 更新重启提示
     */
    function updateRestartHint() {
        const hint = document.getElementById('ml-restart-hint');
        if (hint) {
            hint.classList.toggle('hidden', !_needsRestart);
        }
    }

    /**
     * 更新保存按钮状态和未保存提示
     */
    function updateSaveButton() {
        const saveBtn = document.getElementById('ml-btn-save');
        const unsavedHint = document.getElementById('ml-unsaved-indicator');
        if (saveBtn) {
            saveBtn.disabled = !_hasUnsavedChanges;
        }
        if (unsavedHint) {
            unsavedHint.classList.toggle('hidden', !_hasUnsavedChanges);
        }
    }

    /**
     * 将当前 _modData 全量写入 mod_config（含连续 order）
     */
    function persistModListToConfig() {
        const config = {};
        _modData.forEach(mod => {
            config[mod.id] = {
                status: mod.status,
                params: mod.currentParams,
                order: mod.order
            };
        });
        saveConfig(config);
    }

    function getLocalModsInPackage(packageName) {
        if (!packageName) return [];
        return _modData.filter(m => m.source === 'local' && m.localPackageName === packageName);
    }

    /**
     * 保存所有修改
     * 【V3.15.1 修改】全量重写配置文件，防止僵尸mod信息残留
     * 旧逻辑：读取已有config → 更新mod条目 → 保存（会保留已删除mod的残留条目）
     * 新逻辑：从当前_modData重新构建config → 保存（只包含当前存在的mod）
     */
    function saveAllChanges() {
        // 【V3.15.1】直接构建全新config，不读取旧配置，防止僵尸数据
        const config = {};
        _modData.forEach(mod => {
            config[mod.id] = {
                status: mod.status,
                params: mod.currentParams,
                order: mod.order
            };
        });
        saveConfig(config);
        _needsRestart = true;
        _hasUnsavedChanges = false;
        updateRestartHint();
        updateSaveButton();
        log(3, "所有修改已保存（全量重写配置）");
        try {
            if (typeof SoundManager !== 'undefined') SoundManager.playOk();
        } catch (e) { /* 忽略 */ }
    }

    /**
     * 尝试关闭管理器（检查未保存）
     */
    function tryCloseModManager() {
        if (_hasUnsavedChanges) {
            showConfirmDialog(
                t('confirm.title'),
                t('confirm.unsavedChanges'),
                [
                    { text: t('button.cancel'), class: "ml-btn-secondary", action: hideConfirmDialog },
                    { text: t('button.closeNoSave'), class: "ml-btn-danger", action: () => { hideConfirmDialog(); hideModManager(); } }
                ]
            );
        } else {
            hideModManager();
        }
    }

    /**
     * 显示确认对话框
     */
    function showConfirmDialog(title, message, buttons) {
        if (_confirmModal) return;
        
        _confirmModal = document.createElement('div');
        _confirmModal.className = 'ml-modal-overlay';
        _confirmModal.innerHTML = `
            <div class="ml-modal" style="width: 420px;">
                <div class="ml-modal-header">
                    <h3>${escapeHtml(title)}</h3>
                </div>
                <div class="ml-modal-body">
                    <p style="white-space: pre-line; margin: 0;">${escapeHtml(message)}</p>
                </div>
                <div class="ml-modal-footer" style="justify-content: flex-end;">
                    ${buttons.map((btn, idx) => `
                        <button class="ml-btn ${btn.class || 'ml-btn-secondary'}" data-action="${idx}">
                            ${escapeHtml(btn.text)}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
        
        _confirmModal.addEventListener('click', (e) => {
            const actionBtn = e.target.closest('[data-action]');
            if (actionBtn) {
                const idx = parseInt(actionBtn.dataset.action);
                if (buttons[idx] && buttons[idx].action) {
                    buttons[idx].action();
                }
            }
        });
        
        document.body.appendChild(_confirmModal);
    }

    /**
     * 隐藏确认对话框
     */
    function hideConfirmDialog() {
        if (_confirmModal) {
            _confirmModal.remove();
            _confirmModal = null;
        }
    }

    function getCurrentTheme() {
        return _currentTheme;
    }

    function applyTheme(theme) {
        if (theme !== 'dark' && theme !== 'warm') return;
        _currentTheme = theme;
        document.documentElement.setAttribute('data-ml-theme', theme);
    }

    function setTheme(theme) {
        applyTheme(theme);
        saveModLoaderConfig({ ml_theme: theme });
    }

    function toggleTheme() {
        var newTheme = _currentTheme === 'dark' ? 'warm' : 'dark';
        setTheme(newTheme);
        updateThemeButtons();
    }

    function updateThemeButtons() {
        var btnDark = document.getElementById('ml-theme-btn-dark');
        var btnWarm = document.getElementById('ml-theme-btn-warm');
        if (btnDark) {
            btnDark.textContent = t('theme.dark');
            if (_currentTheme === 'dark') {
                btnDark.classList.add('active');
            } else {
                btnDark.classList.remove('active');
            }
        }
        if (btnWarm) {
            btnWarm.textContent = t('theme.warm');
            if (_currentTheme === 'warm') {
                btnWarm.classList.add('active');
            } else {
                btnWarm.classList.remove('active');
            }
        }
    }

    /**
     * 简易 Markdown 转 HTML 解析器
     */
    function parseMarkdownToHtml(md) {
        var lines = md.split('\n');
        var html = '';
        var inList = false;
        var inParagraph = false;
        var i = 0;

        function processInline(text) {
            return escapeHtml(text)
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/`(.+?)`/g, '<code>$1</code>');
        }

        function closeList() {
            if (inList) { html += '</ul>'; inList = false; }
        }

        function closeParagraph() {
            if (inParagraph) { html += '</p>'; inParagraph = false; }
        }

        while (i < lines.length) {
            var line = lines[i];

            if (/^#### (.+)/.test(line)) {
                closeList(); closeParagraph();
                html += '<h4 class="ml-changelog-h4">' + processInline(RegExp.$1) + '</h4>';
            } else if (/^### (.+)/.test(line)) {
                closeList(); closeParagraph();
                html += '<h3 class="ml-changelog-h3">' + processInline(RegExp.$1) + '</h3>';
            } else if (/^## (.+)/.test(line)) {
                closeList(); closeParagraph();
                html += '<h2 class="ml-changelog-h2">' + processInline(RegExp.$1) + '</h2>';
            } else if (/^# (.+)/.test(line)) {
                closeList(); closeParagraph();
                html += '<h1 class="ml-changelog-h1">' + processInline(RegExp.$1) + '</h1>';
            } else if (/^---/.test(line)) {
                closeList(); closeParagraph();
                html += '<hr class="ml-changelog-hr">';
            } else if (/^- (.+)/.test(line)) {
                closeParagraph();
                if (!inList) { html += '<ul class="ml-changelog-ul">'; inList = true; }
                html += '<li>' + processInline(RegExp.$1) + '</li>';
            } else if (line.trim() === '') {
                closeList(); closeParagraph();
            } else {
                closeList();
                if (!inParagraph) { html += '<p class="ml-changelog-p">'; inParagraph = true; }
                html += processInline(line) + '<br>';
            }
            i++;
        }

        closeList(); closeParagraph();
        return html;
    }

    /**
     * 显示更新日志弹窗
     */
    function showChangelog() {
        if (_changelogModal) return;

        var changelogPath = pathMod.join(MODS_DIR, 'docs', 'modloader_CHANGELOG.md');
        var mdContent;
        try {
            mdContent = fs.readFileSync(changelogPath, 'utf-8');
        } catch (e) {
            log(1, '无法读取更新日志文件:', e.message);
            return;
        }

        var htmlContent = parseMarkdownToHtml(mdContent);

        _changelogModal = document.createElement('div');
        _changelogModal.className = 'ml-modal-overlay ml-changelog-overlay';
        _changelogModal.innerHTML = '<div class="ml-modal ml-changelog-modal">'
            + '<div class="ml-modal-header">'
            + '<h3>ModLoader ' + escapeHtml(VERSION) + ' ' + t('changelog.title') + '</h3>'
            + '<button class="ml-modal-close" id="ml-changelog-close">&times;</button>'
            + '</div>'
            + '<div class="ml-modal-body ml-changelog-body">'
            + htmlContent
            + '</div>'
            + '<div class="ml-modal-footer">'
            + '<button class="ml-btn ml-btn-primary" id="ml-changelog-btn-close">' + t('button.close') + '</button>'
            + '</div>'
            + '</div>';

        _changelogModal.addEventListener('click', function(e) {
            if (e.target.id === 'ml-changelog-close' || e.target.id === 'ml-changelog-btn-close') {
                hideChangelog();
            }
            if (e.target === _changelogModal) {
                hideChangelog();
            }
        });

        _changelogModal.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                hideChangelog();
            }
        });

        document.body.appendChild(_changelogModal);
    }

    /**
     * 隐藏更新日志弹窗
     */
    function hideChangelog() {
        if (_changelogModal) {
            _changelogModal.remove();
            _changelogModal = null;
        }
    }

    function populateLanguageSelect() {
        var select = document.getElementById('ml-language-select');
        if (!select) return;
        select.innerHTML = '';
        var langs = getAvailableLanguages();
        langs.forEach(function(lang) {
            var option = document.createElement('option');
            option.value = lang;
            option.textContent = getLanguageDisplayName(lang);
            if (lang === _currentLanguage) {
                option.selected = true;
            }
            select.appendChild(option);
        });
        var langLabel = document.querySelector('.ml-settings-card .ml-settings-item:first-child .ml-settings-label');
        if (langLabel) langLabel.textContent = t('language.label');
        var themeLabel = document.querySelector('.ml-settings-card .ml-settings-item:last-child .ml-settings-label');
        if (themeLabel) themeLabel.textContent = t('settings.theme');
    }

    function refreshAllUIText() {
        var titleEl = document.querySelector('.ml-header h2');
        if (titleEl) titleEl.textContent = t('title');
        
        var gear = document.getElementById('ml-settings-gear');
        if (gear) gear.title = t('settings');
        
        var saveBtn = document.getElementById('ml-btn-save');
        if (saveBtn) saveBtn.textContent = t('button.save');
        
        var closeBtn = document.getElementById('ml-btn-close');
        if (closeBtn) closeBtn.textContent = t('button.close');
        
        var disableAllBtn = document.getElementById('ml-btn-disable-all');
        if (disableAllBtn) disableAllBtn.textContent = t('button.disableAll');
        
        var installBtn = document.getElementById('ml-btn-install');
        if (installBtn) installBtn.textContent = t('button.installMod');
        
        var deleteBtn = document.getElementById('ml-btn-delete');
        if (deleteBtn) {
            deleteBtn.textContent = _deleteMode ? t('sort.deleteEnabled') : t('sort.deleteDisabled');
        }
        
        var sortBtn = document.getElementById('ml-btn-sort');
        if (sortBtn) {
            sortBtn.textContent = _dragEnabled ? t('sort.enabled') : t('sort.disabled');
            sortBtn.title = isListFilterRestrictingSort() ? t('sort.filterBlockedHint') : '';
        }

        var refreshWorkshopBtn = document.getElementById('ml-btn-refresh-workshop');
        if (refreshWorkshopBtn) refreshWorkshopBtn.textContent = t('workshop.refresh');
        updateWorkshopToolbarState();

        var filterTabs = document.getElementById('ml-filter-tabs');
        if (filterTabs) {
            filterTabs.querySelectorAll('[data-filter]').forEach(function(btn) {
                var filter = btn.dataset.filter;
                if (filter === 'all') btn.textContent = t('tab.all');
                else if (filter === 'local') btn.textContent = t('tab.local');
                else if (filter === 'workshop') btn.textContent = t('tab.workshop');
            });
        }
        
        updateCounts();
        
        var restartHint = document.getElementById('ml-restart-hint');
        if (restartHint && !restartHint.classList.contains('hidden')) {
            restartHint.innerHTML = '&#9888; ' + t('footer.restartHint');
        }
        
        var unsavedHint = document.getElementById('ml-unsaved-indicator');
        if (unsavedHint && !unsavedHint.classList.contains('hidden')) {
            unsavedHint.innerHTML = '&#8226; ' + t('footer.unsaved');
        }
        
        var listOrderEl = document.querySelector('.ml-list-header span:first-child');
        if (listOrderEl) listOrderEl.textContent = t('list.headerOrder');
        var listModEl = document.querySelector('.ml-list-header span:nth-child(2)');
        if (listModEl) listModEl.textContent = t('list.headerModList');
        var listGearEl = document.querySelector('.ml-list-header span:last-child');
        if (listGearEl) listGearEl.textContent = t('list.headerClickGear');
        
        renderModList();
        if (_selectedIndex >= 0 && _selectedIndex < _modData.length) {
            renderDetail(_modData[_selectedIndex]);
        } else {
            var panel = document.getElementById('ml-detail-panel');
            if (panel && _modData.length === 0) {
                panel.innerHTML = '<div class="ml-detail-empty">' + t('detail.empty') + '</div>';
            } else if (panel) {
                panel.innerHTML = '<div class="ml-detail-empty">' + t('detail.empty') + '</div>';
            }
        }
        
        var changelogLink = document.getElementById('ml-changelog-link');
        if (changelogLink) changelogLink.textContent = t('changelog');

        if (_titleBtn) _titleBtn.textContent = t('title');
        
        updateThemeButtons();
    }
    
    /**
     * 切换拖拽功能
     */
    function updateButtonStates() {
        const btnSort = document.getElementById('ml-btn-sort');
        const btnDelete = document.getElementById('ml-btn-delete');
        const sortBlocked = isListFilterRestrictingSort();

        if (btnSort) {
            btnSort.textContent = _dragEnabled ? t('sort.enabled') : t('sort.disabled');
            btnSort.classList.remove('ml-btn-secondary', 'ml-btn-sort-blocked');
            btnSort.title = sortBlocked ? t('sort.filterBlockedHint') : '';
            if (sortBlocked) {
                btnSort.classList.add('ml-btn-secondary', 'ml-btn-sort-blocked');
                btnSort.style.backgroundColor = '';
                btnSort.style.color = '';
                btnSort.style.cursor = 'not-allowed';
            } else if (_dragEnabled) {
                btnSort.style.backgroundColor = 'var(--ml-success)';
                btnSort.style.color = 'white';
                btnSort.style.cursor = '';
            } else {
                btnSort.classList.add('ml-btn-secondary');
                btnSort.style.backgroundColor = '';
                btnSort.style.color = '';
                btnSort.style.cursor = '';
            }
        }
        
        if (btnDelete) {
            btnDelete.textContent = _deleteMode ? t('sort.deleteEnabled') : t('sort.deleteDisabled');
            btnDelete.classList.remove('ml-btn-secondary');
            if (_deleteMode) {
                btnDelete.style.backgroundColor = 'var(--ml-danger)';
                btnDelete.style.color = 'white';
            } else {
                btnDelete.classList.add('ml-btn-secondary');
                btnDelete.style.backgroundColor = '';
                btnDelete.style.color = '';
            }
        }
    }

    function toggleDrag() {
        if (isListFilterRestrictingSort()) {
            return;
        }
        _dragEnabled = !_dragEnabled;
        updateButtonStates();
        renderModList();
        log(3, '拖拽功能', _dragEnabled ? '已启用' : '已禁用');
    }

    // ========== 拖拽排序功能 ==========
    
    /**
     * 开始拖拽
     */
    function handleDragStart(e) {
        // 检查拖拽是否启用
        if (!_dragEnabled) {
            e.preventDefault();
            return;
        }
        const item = e.target.closest('.ml-mod-item');
        if (!item) return;
        const dragIndex = parseInt(item.dataset.index);
        _draggedIndex = dragIndex;
        _dropPosition = null;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    }

    /**
     * 拖拽经过
     */
    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        if (!_dragEnabled) return;
        
        const item = e.target.closest('.ml-mod-item');
        if (!item) return;
        
        const index = parseInt(item.dataset.index);
        if (index === _draggedIndex) {
            // 拖拽到自己，清除所有样式
            document.querySelectorAll('.ml-mod-item.drag-over, .ml-mod-item.drag-over-top, .ml-mod-item.drag-over-bottom').forEach(el => {
                el.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
            });
            _dropPosition = null;
            return;
        }
        
        // 计算鼠标在目标元素的 Y 位置，判断是上半部分还是下半部分
        const rect = item.getBoundingClientRect();
        const mouseY = e.clientY;
        const midY = rect.top + rect.height / 2;
        
        // 清除其他元素的样式
        document.querySelectorAll('.ml-mod-item.drag-over, .ml-mod-item.drag-over-top, .ml-mod-item.drag-over-bottom').forEach(el => {
            el.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
        });
        
        // 设置对应的位置和样式
        if (mouseY < midY) {
            _dropPosition = 'before';
            item.classList.add('drag-over-top');
        } else {
            _dropPosition = 'after';
            item.classList.add('drag-over-bottom');
        }
    }

    /**
     * 拖拽离开
     */
    function handleDragLeave(e) {
        const item = e.target.closest('.ml-mod-item');
        if (item) {
            item.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
        }
    }

    /**
     * 放下
     */
    function handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        
        if (!_dragEnabled) return;
        
        const item = e.target.closest('.ml-mod-item');
        if (!item || _draggedIndex === null || _dropPosition === null) return;
        
        const dropIndex = parseInt(item.dataset.index);
        if (dropIndex === _draggedIndex) return;
        
        // 根据位置确定插入点
        let insertIndex = _dropPosition === 'before' ? dropIndex : dropIndex + 1;
        // 如果被拖拽的元素在插入位置前面，索引要减一
        if (_draggedIndex < insertIndex) {
            insertIndex--;
        }
        
        // 移动元素
        const draggedMod = _modData[_draggedIndex];
        _modData.splice(_draggedIndex, 1);
        _modData.splice(insertIndex, 0, draggedMod);
        
        // 重新分配序号
        reassignOrders();
        _hasUnsavedChanges = true;
        updateSaveButton();
        
        // 【V3.15.0 新增】排序变动后刷新依赖检测
        refreshDependencyCheck();
        
        // 重新渲染
        renderModList();
        renderDetail(_modData[insertIndex]);
        _selectedIndex = insertIndex;
        
        log(3, "排序已更新");
    }

    /**
     * 拖拽结束
     */
    function handleDragEnd(e) {
        _draggedIndex = null;
        _dropPosition = null;
        document.querySelectorAll('.ml-mod-item.dragging, .ml-mod-item.drag-over, .ml-mod-item.drag-over-top, .ml-mod-item.drag-over-bottom').forEach(el => {
            el.classList.remove('dragging', 'drag-over', 'drag-over-top', 'drag-over-bottom');
        });
    }

    // ========== 序号编辑功能 ==========
    
    /**
     * 序号输入事件
     */
    function handleOrderInput(e) {
        if (!e.target.classList.contains('ml-order-input')) return;
        // 只记录输入，不立即处理
    }

    /**
     * 序号失焦事件
     */
    function handleOrderBlur(e) {
        if (!e.target.classList.contains('ml-order-input')) return;
        processOrderInput(e.target);
    }

    /**
     * 序号键盘事件
     */
    function handleOrderKeydown(e) {
        if (!e.target.classList.contains('ml-order-input')) return;
        
        if (e.key === 'Enter') {
            e.preventDefault();
            processOrderInput(e.target);
            e.target.blur();
        } else if (e.key === 'Escape') {
            e.target.blur();
        }
    }

    /**
     * 处理序号输入
     */
    function processOrderInput(inputEl) {
        const index = parseInt(inputEl.dataset.index);
        let newOrder = parseInt(inputEl.value);
        
        // 验证输入
        if (isNaN(newOrder) || newOrder < 1 || newOrder > _modData.length) {
            // 恢复原值
            inputEl.value = _modData[index].order;
            return;
        }
        
        const currentMod = _modData[index];
        if (currentMod.order === newOrder) return;
        
        // 移除当前元素
        _modData.splice(index, 1);
        // 插入到新位置
        _modData.splice(newOrder - 1, 0, currentMod);
        
        // 重新分配序号
        reassignOrders();
        _hasUnsavedChanges = true;
        updateSaveButton();
        
        // 【V3.15.0 新增】序号变动后刷新依赖检测
        refreshDependencyCheck();
        
        // 重新渲染
        renderModList();
        renderDetail(_modData[newOrder - 1]);
        _selectedIndex = newOrder - 1;
        
        log(3, "序号已更新:", currentMod.displayName, "→", newOrder);
    }

    // ================================================================
    // 8. DOM 参数编辑器
    // ================================================================

    /**
     * 键盘事件捕获监听器 - 在捕获阶段阻止事件传播到 RMMZ
     */
    function keyboardCaptureHandler(e) {
        const activeElement = document.activeElement;
        const isInputFocused = activeElement && 
            (activeElement.tagName === 'INPUT' || 
             activeElement.tagName === 'TEXTAREA' || 
             activeElement.tagName === 'SELECT');
        
        if (isInputFocused) {
            // 有输入框获得焦点时，阻止事件传播，让浏览器正常处理
            e.stopPropagation();
            e.stopImmediatePropagation();
            // 注意：不调用 preventDefault()，让输入框能正常工作
        }
    }

    // ====================================================================
    // 阶段2新增：struct 递归渲染函数
    // ====================================================================

    /**
     * 递归渲染 struct 的子字段
     * @param {object} field - Schema 子字段定义 { name, type, text, default, min, max, step, options, schema, schemaFields }
     * @param {string|any} curVal - 当前值
     * @param {number} depth - 嵌套深度（1=顶层, 2=一级嵌套, ...）
     * @param {string} parentPath - 父级参数路径，用于 data 属性定位
     * @returns {HTMLElement} - 渲染好的 DOM 元素
     */
    function renderStructField(field, curVal, depth, parentPath) {
        const group = document.createElement('div');
        group.className = 'ml-form-group ml-struct-field';
        group.setAttribute('data-field-name', field.name);
        group.setAttribute('data-field-type', field.type);
        group.setAttribute('data-field-path', parentPath + '.' + field.name);

        const fieldLabel = field.text || field.name;

        if (field.type === 'struct' && field.schema) {
            // ---- 嵌套 struct：递归渲染 ----
            const subSchemaFields = _schemaDictionary[field.schema] || field.schemaFields || [];
            let structObj = {};
            try {
                structObj = typeof curVal === 'string' ? JSON.parse(curVal) : (curVal || {});
            } catch (e) {
                try { structObj = JSON.parse(field.default || '{}'); } catch (e2) { structObj = {}; }
            }

            const clampedDepth = Math.min(depth, 3); // CSS class 最多到 depth-3
            const details = document.createElement('details');
            details.open = true;
            details.className = `ml-struct-details ml-struct-depth-${clampedDepth}`;
            details.setAttribute('data-param-name', field.name);
            details.setAttribute('data-param-type', 'struct');
            details.setAttribute('data-field-path', parentPath + '.' + field.name);

            const summary = document.createElement('summary');
            summary.className = 'ml-struct-summary';
            summary.textContent = fieldLabel;
            details.appendChild(summary);

            const structBody = document.createElement('div');
            structBody.className = 'ml-struct-body';
            structBody.setAttribute('data-struct-param', field.name);

            subSchemaFields.forEach(subField => {
                const subVal = structObj[subField.name] !== undefined ? structObj[subField.name] : (subField.default !== undefined ? subField.default : '');
                const subGroup = renderStructField(subField, subVal, depth + 1, parentPath + '.' + field.name);
                structBody.appendChild(subGroup);
            });

            details.appendChild(structBody);
            group.appendChild(details);

            log(3, `[struct] 递归渲染嵌套字段 "${field.name}", 深度: ${depth}, 子字段数: ${subSchemaFields.length}`);

        } else if (field.type === 'boolean') {
            // ---- 布尔类型：拨动开关 ----
            const isOn = curVal === 'true' || curVal === true;
            group.innerHTML = `
                <div class="ml-form-label">
                    ${escapeHtml(fieldLabel)}
                    <span class="ml-form-label-type">${t('param.typeBoolean')}</span>
                </div>
                <label class="ml-form-switch">
                    <input type="checkbox" data-field-name="${escapeHtml(field.name)}" data-field-path="${escapeHtml(parentPath + '.' + field.name)}" ${isOn ? 'checked' : ''}>
                    <span class="ml-form-switch-slider"></span>
                </label>
            `;

        } else if (field.type === 'number') {
            // ---- 数值类型：短输入框（struct 内禁用滑动条） ----
            group.innerHTML = `
                <div class="ml-form-label">
                    ${escapeHtml(fieldLabel)}
                    <span class="ml-form-label-type">${t('param.typeNumber')}</span>
                </div>
                <input type="number" class="ml-form-input ml-struct-input"
                       data-field-name="${escapeHtml(field.name)}"
                       data-field-path="${escapeHtml(parentPath + '.' + field.name)}"
                       value="${escapeHtml(String(curVal !== undefined && curVal !== '' ? curVal : (field.default || '0')))}"
                       ${field.min !== undefined ? `min="${field.min}"` : ''}
                       ${field.max !== undefined ? `max="${field.max}"` : ''}
                       step="${field.step || 1}">
            `;
            // ---- 通用验证绑定 ----
            setTimeout(() => {
                const numInput = group.querySelector('input[type="number"]');
                if (numInput) {
                    bindNumberValidation(numInput, {
                        min: field.min,
                        max: field.max,
                        fallback: field.default || '0'
                    });
                    log(3, `[struct-validate] 已为数值字段 "${field.name}" 绑定 blur 验证`);
                }
            }, 0);

        } else if (field.type === 'color') {
            // ---- 颜色类型 ----
            const colorVal = String(curVal || field.default || '#ffffff');
            group.innerHTML = `
                <div class="ml-form-label">
                    ${escapeHtml(fieldLabel)}
                    <span class="ml-form-label-type">${t('param.typeColor')}</span>
                </div>
                <div style="display:flex;gap:6px;align-items:center;">
                    <input type="color" data-field-name="${escapeHtml(field.name)}" data-field-path="${escapeHtml(parentPath + '.' + field.name)}"
                           value="${colorVal.startsWith('#') ? colorVal : '#ffffff'}"
                           style="width:36px;height:28px;border:none;cursor:pointer;padding:0;">
                    <input type="text" class="ml-form-input ml-struct-input"
                           data-field-name="${escapeHtml(field.name)}" data-field-path="${escapeHtml(parentPath + '.' + field.name)}"
                           value="${escapeHtml(colorVal)}" style="flex:1;" placeholder="#RRGGBB">
                </div>
            `;
            // ---- 通用验证绑定 ----
            setTimeout(() => {
                const colorPicker = group.querySelector('input[type="color"]');
                const textInput = group.querySelector('input[type="text"]');
                if (textInput) {
                    bindColorValidation(textInput, colorPicker, field.default || '#ffffff');
                    log(3, `[struct-validate] 已为颜色字段 "${field.name}" 绑定 blur 验证`);
                }
            }, 0);

        } else if (field.type === 'select') {
            // ---- 下拉选择类型 ----
            let optionsHtml = '';
            if (field.options && field.options.length > 0) {
                field.options.forEach(opt => {
                    const selected = String(opt) === String(curVal) ? ' selected' : '';
                    optionsHtml += `<option value="${escapeHtml(opt)}"${selected}>${escapeHtml(opt)}</option>`;
                });
            }
            group.innerHTML = `
                <div class="ml-form-label">
                    ${escapeHtml(fieldLabel)}
                    <span class="ml-form-label-type">${t('param.typeChoice')}</span>
                </div>
                <select class="ml-form-select ml-struct-select"
                        data-field-name="${escapeHtml(field.name)}"
                        data-field-path="${escapeHtml(parentPath + '.' + field.name)}">
                    ${optionsHtml}
                </select>
            `;

        } else if (isDatabaseType(field.type)) {
            // ---- 数据库引用类型 ----
            const dbArray = getDatabaseArray(field.type);
            const dbLabel = getDbLabel(field.type);

            if (dbArray) {
                let optionsHtml = '<option value="" style="color:var(--ml-text-muted);">' + t('param.none') + '</option>';
                for (let i = 1; i < dbArray.length; i++) {
                    const entry = dbArray[i];
                    if (entry && entry.name && entry.name.trim() !== '') {
                        const selected = String(i) === String(curVal) ? ' selected' : '';
                        optionsHtml += `<option value="${i}"${selected}>${i}: ${escapeHtml(entry.name)}</option>`;
                    }
                }
                group.innerHTML = `
                    <div class="ml-form-label">
                        ${escapeHtml(fieldLabel)}
                        <span class="ml-form-label-type">${dbLabel}</span>
                    </div>
                    <select class="ml-form-select ml-struct-select"
                            data-field-name="${escapeHtml(field.name)}"
                            data-field-path="${escapeHtml(parentPath + '.' + field.name)}">
                        ${optionsHtml}
                    </select>
                `;
            } else {
                // 降级为文本输入
                group.innerHTML = `
                    <div class="ml-form-label">
                        ${escapeHtml(fieldLabel)}
                        <span class="ml-form-label-type">${dbLabel} ${t('param.dbFallbackHint')}</span>
                    </div>
                    <input type="text" class="ml-form-input ml-struct-input"
                           data-field-name="${escapeHtml(field.name)}"
                           data-field-path="${escapeHtml(parentPath + '.' + field.name)}"
                           value="${escapeHtml(String(curVal || field.default || ''))}"
                           placeholder="${t('param.dbInputPlaceholder').replace('{label}', dbLabel)}">
                `;
                // ---- 通用文本验证绑定（含 XSS 防护） ----
                setTimeout(() => {
                    const textInput = group.querySelector('input[type="text"]');
                    if (textInput) {
                        bindTextValidation(textInput, field.default || '');
                        log(3, `[struct-validate] 已为数据库降级文本字段 "${field.name}" 绑定 blur 验证`);
                    }
                }, 0);
            }

        } else {
            // ---- 默认：文本输入 ----
            group.innerHTML = `
                <div class="ml-form-label">
                    ${escapeHtml(fieldLabel)}
                    <span class="ml-form-label-type">${t('param.typeText')}</span>
                </div>
                <input type="text" class="ml-form-input ml-struct-input"
                       data-field-name="${escapeHtml(field.name)}"
                       data-field-path="${escapeHtml(parentPath + '.' + field.name)}"
                       value="${escapeHtml(String(curVal !== undefined && curVal !== '' ? curVal : (field.default || '')))}">
            `;
            // ---- 通用文本验证绑定（含 XSS 防护） ----
            setTimeout(() => {
                const textInput = group.querySelector('input[type="text"]');
                if (textInput) {
                    bindTextValidation(textInput, field.default || '');
                    log(3, `[struct-validate] 已为文本字段 "${field.name}" 绑定 blur 验证`);
                }
            }, 0);
        }

        if (field.desc) {
            const descDiv = document.createElement('div');
            descDiv.className = 'ml-form-desc';
            descDiv.textContent = field.desc;
            group.appendChild(descDiv);
        }

        return group;
    }

    // ====================================================================
    // 阶段2新增：table 行创建函数
    // ====================================================================

    /**
     * 创建表格的一行（<tr>）
     * @param {HTMLTableSectionElement} tbody - 表体元素，用于行移动操作
     * @param {Array} schemaFields - Schema 子字段定义
     * @param {object} rowData - 当前行数据
     * @param {string} paramName - 所属参数名
     * @returns {HTMLTableRowElement} - 渲染好的 <tr> 元素
     */
    function createTableRow(tbody, schemaFields, rowData, paramName) {
        const tr = document.createElement('tr');
        tr.className = 'ml-table-row';
        tr.setAttribute('data-table-param', paramName);

        // 收集需要延迟绑定验证的元素
        const pendingValidations = [];

        schemaFields.forEach(field => {
            const td = document.createElement('td');
            td.className = 'ml-table-cell';
            td.setAttribute('data-field-name', field.name);
            td.setAttribute('data-field-type', field.type);

            const cellValue = rowData[field.name] !== undefined ? rowData[field.name] : (field.default !== undefined ? field.default : '');

            // ---- 严禁在 table 的 schema 中嵌套 struct 或 note ----
            if (field.type === 'struct' || field.type === 'note' || field.type === 'multiline_string') {
                // 降级为只读文本提示
                td.innerHTML = `<span class="ml-table-readonly" title="表格内不支持嵌套结构体/长文本">${escapeHtml(String(cellValue))}</span>`;
                log(2, `[table] 字段 "${field.name}" 类型为 ${field.type}，在表格中降级为只读`);
            } else if (field.type === 'boolean') {
                // 微型拨动开关
                const isOn = cellValue === 'true' || cellValue === true;
                td.innerHTML = `
                    <label class="ml-form-switch ml-table-switch">
                        <input type="checkbox" data-field-name="${escapeHtml(field.name)}" ${isOn ? 'checked' : ''}>
                        <span class="ml-form-switch-slider"></span>
                    </label>
                `;
            } else if (field.type === 'number') {
                // 微型数值输入框（禁用滑动条）
                td.innerHTML = `
                    <input type="number" class="ml-table-input ml-table-number"
                           data-field-name="${escapeHtml(field.name)}"
                           value="${escapeHtml(String(cellValue || '0'))}"
                           ${field.min !== undefined ? `min="${field.min}"` : ''}
                           ${field.max !== undefined ? `max="${field.max}"` : ''}
                           step="${field.step || 1}">
                `;
                // ---- 延迟绑定数值验证 ----
                pendingValidations.push({ type: 'number', td, field });

            } else if (field.type === 'color') {
                // 微型色块（表格内仅用 color picker，不配文本框）
                const colorVal = String(cellValue || field.default || '#ffffff');
                td.innerHTML = `
                    <input type="color" class="ml-table-color"
                           data-field-name="${escapeHtml(field.name)}"
                           value="${colorVal.startsWith('#') ? colorVal : '#ffffff'}">
                `;
                // 表格内颜色选择器自带浏览器验证，无需额外 blur 验证

            } else if (field.type === 'select') {
                // 微型下拉框
                let optionsHtml = '';
                if (field.options && field.options.length > 0) {
                    field.options.forEach(opt => {
                        const selected = String(opt) === String(cellValue) ? ' selected' : '';
                        optionsHtml += `<option value="${escapeHtml(opt)}"${selected}>${escapeHtml(opt)}</option>`;
                    });
                }
                td.innerHTML = `
                    <select class="ml-table-select" data-field-name="${escapeHtml(field.name)}">
                        ${optionsHtml}
                    </select>
                `;
            } else if (isDatabaseType(field.type)) {
                // 微型数据库下拉框
                const dbArray = getDatabaseArray(field.type);
                if (dbArray) {
                    let optionsHtml = '<option value="">--</option>';
                    for (let i = 1; i < dbArray.length; i++) {
                        const entry = dbArray[i];
                        if (entry && entry.name && entry.name.trim() !== '') {
                            const selected = String(i) === String(cellValue) ? ' selected' : '';
                            optionsHtml += `<option value="${i}"${selected}>${i}:${escapeHtml(entry.name)}</option>`;
                        }
                    }
                    td.innerHTML = `
                        <select class="ml-table-select" data-field-name="${escapeHtml(field.name)}">
                            ${optionsHtml}
                        </select>
                    `;
                } else {
                    td.innerHTML = `
                        <input type="text" class="ml-table-input"
                               data-field-name="${escapeHtml(field.name)}"
                               value="${escapeHtml(String(cellValue))}">
                    `;
                    // ---- 延迟绑定文本验证（含 XSS 防护） ----
                    pendingValidations.push({ type: 'text', td, field });
                }
            } else {
                // 默认：短文本输入框
                td.innerHTML = `
                    <input type="text" class="ml-table-input"
                           data-field-name="${escapeHtml(field.name)}"
                           value="${escapeHtml(String(cellValue))}">
                `;
                // ---- 延迟绑定文本验证（含 XSS 防护） ----
                pendingValidations.push({ type: 'text', td, field });
            }

            tr.appendChild(td);
        });

        // 操作列：上移、下移、删除
        const actionTd = document.createElement('td');
        actionTd.className = 'ml-table-cell ml-table-action-cell';

        const moveUpBtn = document.createElement('button');
        moveUpBtn.className = 'ml-table-action-btn';
        moveUpBtn.textContent = '▲';
        moveUpBtn.title = t('sort.moveUp');
        moveUpBtn.addEventListener('click', () => {
            const prev = tr.previousElementSibling;
            if (prev) {
                tbody.insertBefore(tr, prev);
                log(3, `[table] 行上移`);
            }
        });

        const moveDownBtn = document.createElement('button');
        moveDownBtn.className = 'ml-table-action-btn';
        moveDownBtn.textContent = '▼';
        moveDownBtn.title = t('sort.moveDown');
        moveDownBtn.addEventListener('click', () => {
            const next = tr.nextElementSibling;
            if (next) {
                tbody.insertBefore(next, tr);
                log(3, `[table] 行下移`);
            }
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'ml-table-action-btn ml-table-delete-btn';
        deleteBtn.textContent = '✕';
        deleteBtn.title = t('delete.actionTitle');
        deleteBtn.addEventListener('click', () => {
            tr.remove();
            log(3, `[table] 行删除`);
        });

        actionTd.appendChild(moveUpBtn);
        actionTd.appendChild(moveDownBtn);
        actionTd.appendChild(deleteBtn);
        tr.appendChild(actionTd);

        // ---- 延迟绑定验证事件（确保 DOM 已插入） ----
        setTimeout(() => {
            for (const pv of pendingValidations) {
                if (pv.type === 'number') {
                    const numInput = pv.td.querySelector('input[type="number"]');
                    if (numInput) {
                        bindNumberValidation(numInput, {
                            min: pv.field.min,
                            max: pv.field.max,
                            fallback: pv.field.default || '0'
                        });
                        log(3, `[table-validate] 已为数值单元格 "${pv.field.name}" 绑定 blur 验证`);
                    }
                } else if (pv.type === 'text') {
                    const textInput = pv.td.querySelector('input[type="text"]');
                    if (textInput) {
                        bindTextValidation(textInput, pv.field.default || '');
                        log(3, `[table-validate] 已为文本单元格 "${pv.field.name}" 绑定 blur 验证`);
                    }
                }
            }
        }, 0);

        return tr;
    }

    // ====================================================================
    // 阶段2新增：struct 数据收集函数
    // ====================================================================

    /**
     * 从 struct 的 DOM 容器中收集子字段值，返回 JS 对象
     * @param {HTMLElement} structBody - struct-body 容器元素
     * @returns {object} - 收集到的对象
     */
    function collectStructData(structBody) {
        const obj = {};
        const fieldGroups = structBody.querySelectorAll(':scope > .ml-struct-field');
        fieldGroups.forEach(fg => {
            const fieldName = fg.getAttribute('data-field-name');
            const fieldType = fg.getAttribute('data-field-type');

            if (fieldType === 'struct') {
                // 递归收集嵌套 struct
                const subDetails = fg.querySelector(':scope > .ml-struct-details');
                if (subDetails) {
                    const subBody = subDetails.querySelector(':scope > .ml-struct-body');
                    if (subBody) {
                        obj[fieldName] = JSON.stringify(collectStructData(subBody));
                    }
                }
            } else if (fieldType === 'boolean') {
                const checkbox = fg.querySelector('input[type="checkbox"]');
                obj[fieldName] = checkbox ? String(checkbox.checked) : 'false';
            } else if (fieldType === 'number') {
                const input = fg.querySelector('input[type="number"]');
                obj[fieldName] = input ? input.value : '0';
            } else if (fieldType === 'color') {
                const colorInput = fg.querySelector('input[type="color"]');
                const textInput = fg.querySelector('input[type="text"]');
                obj[fieldName] = textInput ? textInput.value : (colorInput ? colorInput.value : '#ffffff');
            } else if (fieldType === 'select' || isDatabaseType(fieldType)) {
                const select = fg.querySelector('select');
                obj[fieldName] = select ? select.value : '';
            } else {
                // 文本等默认类型 —— 收集时进行 XSS 净化
                const input = fg.querySelector('input[type="text"]');
                const rawVal = input ? input.value : '';
                obj[fieldName] = sanitizeText(rawVal);
            }
        });
        return obj;
    }

    // ====================================================================
    // 阶段2新增：table 数据收集函数
    // ====================================================================

    /**
     * 从 table 的 tbody 中收集所有行数据
     * 返回双重转义 JSON 数组：JSON.stringify([JSON.stringify(row1), JSON.stringify(row2), ...])
     * @param {HTMLTableSectionElement} tbody - 表体元素
     * @param {Array} schemaFields - Schema 子字段定义
     * @returns {string} - 双重转义的 JSON 字符串
     */
    function collectTableData(tbody, schemaFields) {
        const rows = tbody.querySelectorAll(':scope > tr.ml-table-row');
        const arr = [];
        rows.forEach(tr => {
            const rowObj = {};
            schemaFields.forEach(field => {
                const td = tr.querySelector(`td[data-field-name="${field.name}"]`);
                if (!td) return;

                if (field.type === 'struct' || field.type === 'note' || field.type === 'multiline_string') {
                    // 只读字段，跳过或使用原始值
                    const span = td.querySelector('.ml-table-readonly');
                    rowObj[field.name] = span ? span.textContent : '';
                } else if (field.type === 'boolean') {
                    const checkbox = td.querySelector('input[type="checkbox"]');
                    rowObj[field.name] = checkbox ? String(checkbox.checked) : 'false';
                } else if (field.type === 'number') {
                    const input = td.querySelector('input[type="number"]');
                    rowObj[field.name] = input ? input.value : '0';
                } else if (field.type === 'color') {
                    const colorInput = td.querySelector('input[type="color"]');
                    rowObj[field.name] = colorInput ? colorInput.value : '#ffffff';
                } else if (field.type === 'select' || isDatabaseType(field.type)) {
                    const select = td.querySelector('select');
                    rowObj[field.name] = select ? select.value : '';
                } else {
                    const input = td.querySelector('input[type="text"]');
                    // 收集时进行 XSS 净化
                    const rawVal = input ? input.value : '';
                    rowObj[field.name] = sanitizeText(rawVal);
                }
            });
            // 每行对象 JSON.stringify 后放入数组
            arr.push(JSON.stringify(rowObj));
        });
        // 最终返回 JSON.stringify(数组)
        return JSON.stringify(arr);
    }

    /**
     * 显示参数编辑模态框
     */
    function showParamEditor(mod) {
        if (_modalOverlay) hideParamEditor(); // 防止重复
        
        unbindAllWheelListeners(); // 解绑所有，之后重新绑定主界面的即可
        // 重新绑定主界面滚动容器（因为模态框关闭后可能被清空）
        bindModLoaderScrollContainers();

        // 键盘事件捕获已经在打开管理器时由通用代码处理了，这里不需要再重复添加

        // 创建编辑用的参数副本（取消时不影响原数据）
        const editParams = {};
        mod.params.forEach(p => {
            editParams[p.name] = mod.currentParams.hasOwnProperty(p.name)
                ? mod.currentParams[p.name]
                : p.default;
        });

        _modalOverlay = document.createElement('div');
        _modalOverlay.className = 'ml-modal-overlay';
        _modalOverlay.tabIndex = -1; // 允许获得焦点

        const modal = document.createElement('div');
        modal.className = 'ml-modal';
        modal.tabIndex = -1;

        // 头部
        const header = document.createElement('div');
        header.className = 'ml-modal-header';
        header.innerHTML = `
            <h3>${t('param.title')} - ${escapeHtml(mod.displayName)}</h3>
            <button class="ml-modal-close" id="ml-modal-close">&times;</button>
        `;

        // 主体
        const body = document.createElement('div');
        body.className = 'ml-modal-body';

        mod.params.forEach(p => {
            const group = document.createElement('div');
            group.className = 'ml-form-group';

            const curVal = editParams[p.name];

            if (p.type === 'boolean') {
                const isOn = curVal === 'true';
                group.innerHTML = `
                    <div class="ml-form-label">
                        ${escapeHtml(p.text || p.name)}
                        <span class="ml-form-label-type">${t('param.typeBoolean')}</span>
                    </div>
                    <div class="ml-form-toggle-row">
                        <div class="ml-toggle ${isOn ? 'on' : ''}" id="ml-param-${cssEscape(p.name)}">
                            <div class="ml-toggle-thumb"></div>
                        </div>
                        <span class="ml-form-toggle-status ${isOn ? 'on' : 'off'}" id="ml-param-status-${cssEscape(p.name)}">
                            ${isOn ? t('param.on') : t('param.off')}
                        </span>
                    </div>
                    ${p.desc ? `<div class="ml-form-desc">${escapeHtml(p.desc)}</div>` : ''}
                `;
                // 绑定切换事件
                setTimeout(() => {
                    const toggleEl = document.getElementById(`ml-param-${cssEscape(p.name)}`);
                    const statusEl = document.getElementById(`ml-param-status-${cssEscape(p.name)}`);
                    if (toggleEl) {
                        toggleEl.addEventListener('click', () => {
                            const currentVal = editParams[p.name];
                            const newVal = currentVal === 'true' ? 'false' : 'true';
                            editParams[p.name] = newVal;
                            toggleEl.classList.toggle('on', newVal === 'true');
                            if (statusEl) {
                                statusEl.textContent = newVal === 'true' ? t('param.on') : t('param.off');
                                statusEl.className = `ml-form-toggle-status ${newVal === 'true' ? 'on' : 'off'}`;
                            }
                        });
                    }
                }, 0);
            } else if (p.type === 'select') {
                group.innerHTML = `
                    <div class="ml-form-label">
                        ${escapeHtml(p.text || p.name)}
                        <span class="ml-form-label-type">${t('param.typeSelect')} (${p.options.length})</span>
                    </div>
                    <select class="ml-form-select" id="ml-param-${cssEscape(p.name)}">
                        ${p.options.map(opt =>
                            `<option value="${escapeHtml(opt)}" ${opt === curVal ? 'selected' : ''}>${escapeHtml(opt)}</option>`
                        ).join('')}
                    </select>
                    ${p.desc ? `<div class="ml-form-desc">${escapeHtml(p.desc)}</div>` : ''}
                `;
                setTimeout(() => {
                    const selEl = document.getElementById(`ml-param-${cssEscape(p.name)}`);
                    if (selEl) {
                        selEl.addEventListener('change', () => {
                            editParams[p.name] = selEl.value;
                        });
                    }
                }, 0);
            } else if (p.type === 'number') {
                const min = p.min !== undefined ? p.min : '';
                const max = p.max !== undefined ? p.max : '';
                const hasMin = p.min !== undefined;
                const hasMax = p.max !== undefined;
                const hasSlider = hasMin && hasMax; // 同时存在 min 和 max 时启用滑动条
                const step = hasSlider ? calculateStep(p) : 1;

                if (hasSlider) {
                    // 升级 UI：滑动条 + 数值显示
                    const sliderVal = Math.min(Math.max(Number(curVal) || 0, p.min), p.max);
                    group.innerHTML = `
                        <div class="ml-form-label">
                            ${escapeHtml(p.text || p.name)}
                            <span class="ml-form-label-type">${t('param.typeNumber')} (${p.min}~${p.max})</span>
                        </div>
                        <div class="ml-form-slider-row">
                            <div class="ml-form-slider-header">
                                <span class="ml-form-slider-value" id="ml-param-display-${cssEscape(p.name)}">${sliderVal}</span>
                            </div>
                            <input type="range" class="ml-form-slider-range"
                                   id="ml-param-slider-${cssEscape(p.name)}"
                                   value="${sliderVal}"
                                   min="${p.min}"
                                   max="${p.max}"
                                   step="${step}">
                            <div class="ml-form-slider-bounds">
                                <span>${p.min}</span>
                                <span>${p.max}</span>
                            </div>
                        </div>
                        <input type="hidden" id="ml-param-${cssEscape(p.name)}" value="${sliderVal}">
                        ${p.desc ? `<div class="ml-form-desc">${escapeHtml(p.desc)}</div>` : ''}
                    `;
                    setTimeout(() => {
                        const sliderEl = document.getElementById(`ml-param-slider-${cssEscape(p.name)}`);
                        const displayEl = document.getElementById(`ml-param-display-${cssEscape(p.name)}`);
                        const hiddenEl = document.getElementById(`ml-param-${cssEscape(p.name)}`);

                        if (sliderEl && displayEl && hiddenEl) {
                            // 滑动条滑动时实时更新文本
                            sliderEl.addEventListener('input', () => {
                                const val = sliderEl.value;
                                displayEl.textContent = val;
                                hiddenEl.value = val;
                                editParams[p.name] = String(val);
                            });

                            // 点击文本，原地替换为 input[type=number]
                            displayEl.addEventListener('click', () => {
                                const currentVal = Number(hiddenEl.value) || 0;
                                const numInput = document.createElement('input');
                                numInput.type = 'number';
                                numInput.className = 'ml-form-slider-number-input';
                                numInput.value = currentVal;
                                numInput.min = p.min;
                                numInput.max = p.max;
                                numInput.step = step;

                                displayEl.style.display = 'none';
                                displayEl.parentNode.insertBefore(numInput, displayEl.nextSibling);
                                numInput.focus();
                                numInput.select();

                                _isInputFocused = true;

                                const finishEdit = () => {
                                    _isInputFocused = false;
                                    // ---- 通用数值验证 ----
                                    const val = validateNumberInput(numInput, {
                                        min: p.min,
                                        max: p.max,
                                        fallback: String(Number(p.default) || p.min)
                                    });
                                    displayEl.textContent = val;
                                    hiddenEl.value = val;
                                    sliderEl.value = val;
                                    editParams[p.name] = val;
                                    numInput.remove();
                                    displayEl.style.display = '';
                                };

                                numInput.addEventListener('blur', finishEdit);
                                numInput.addEventListener('keydown', (e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        numInput.blur();
                                    } else if (e.key === 'Escape') {
                                        e.preventDefault();
                                        numInput.value = currentVal;
                                        numInput.blur();
                                    }
                                });
                            });
                        }
                    }, 0);
                } else {
                    // 原有渲染逻辑：无滑动条，保持不变
                    group.innerHTML = `
                        <div class="ml-form-label">
                            ${escapeHtml(p.text || p.name)}
                            <span class="ml-form-label-type">${t('param.typeNumber')}${hasMin || hasMax ? ` (${hasMin ? p.min : '...'}~${hasMax ? p.max : '...'})` : ''}</span>
                        </div>
                        <div class="ml-form-number-row">
                            <button class="ml-form-number-btn ml-form-min-btn ${!hasMin ? 'disabled' : ''}"
                                    data-action="min"
                                    data-param="${escapeHtml(p.name)}"
                                    ${!hasMin ? 'disabled' : ''}>
                                ${hasMin ? `Min (${p.min})` : 'Min'}
                            </button>

                            <input type="number" class="ml-form-input ml-form-number-input"
                                   id="ml-param-${cssEscape(p.name)}"
                                   value="${escapeHtml(String(curVal))}"
                                   ${hasMin ? `min="${p.min}"` : ''}
                                   ${hasMax ? `max="${p.max}"` : ''}
                                   step="1">

                            <button class="ml-form-number-btn ml-form-max-btn ${!hasMax ? 'disabled' : ''}"
                                    data-action="max"
                                    data-param="${escapeHtml(p.name)}"
                                    ${!hasMax ? 'disabled' : ''}>
                                ${hasMax ? `Max (${p.max})` : 'Max'}
                            </button>
                        </div>
                        ${p.desc ? `<div class="ml-form-desc">${escapeHtml(p.desc)}</div>` : ''}
                    `;
                    setTimeout(() => {
                        const inputEl = document.getElementById(`ml-param-${cssEscape(p.name)}`);
                        if (inputEl) {
                            inputEl.addEventListener('focus', () => {
                                _isInputFocused = true;
                            });
                            inputEl.addEventListener('blur', () => {
                                _isInputFocused = false;
                                // ---- 通用数值验证 ----
                                const val = validateNumberInput(inputEl, {
                                    min: hasMin ? p.min : undefined,
                                    max: hasMax ? p.max : undefined,
                                    fallback: p.default
                                });
                                editParams[p.name] = val;
                            });

                            inputEl.addEventListener('input', () => {
                                let num = Number(inputEl.value);
                                if (!isNaN(num)) {
                                    if (hasMin && num < p.min) num = p.min;
                                    if (hasMax && num > p.max) num = p.max;
                                    editParams[p.name] = String(num);
                                }
                            });
                        }
                        const minBtn = group.querySelector('[data-action="min"]');
                        const maxBtn = group.querySelector('[data-action="max"]');
                        if (minBtn) {
                            minBtn.addEventListener('click', () => {
                                if (hasMin) {
                                    editParams[p.name] = String(p.min);
                                    if (inputEl) inputEl.value = p.min;
                                }
                            });
                        }
                        if (maxBtn) {
                            maxBtn.addEventListener('click', () => {
                                if (hasMax) {
                                    editParams[p.name] = String(p.max);
                                    if (inputEl) inputEl.value = p.max;
                                }
                            });
                        }
                    }, 0);
                }
            } else if (p.type === 'color') {
                // 颜色类型
                group.innerHTML = `
                    <div class="ml-form-label">
                        ${escapeHtml(p.text || p.name)}
                        <span class="ml-form-label-type">${t('param.typeColor')}</span>
                    </div>
                    <div style="display:flex;gap:8px;align-items:center;">
                        <input type="color" 
                               id="ml-param-${cssEscape(p.name)}-color"
                               value="${escapeHtml(String(curVal)).startsWith('#') ? escapeHtml(String(curVal)) : '#ffffff'}"
                               style="width:50px;height:36px;border:none;cursor:pointer;padding:0;">
                        <input type="text" class="ml-form-input"
                               id="ml-param-${cssEscape(p.name)}"
                               value="${escapeHtml(String(curVal))}"
                               style="flex:1;"
                               placeholder="#RRGGBB 或颜色名">
                    </div>
                    ${p.desc ? `<div class="ml-form-desc">${escapeHtml(p.desc)}</div>` : ''}
                `;
                setTimeout(() => {
                    const textInput = document.getElementById(`ml-param-${cssEscape(p.name)}`);
                    const colorInput = document.getElementById(`ml-param-${cssEscape(p.name)}-color`);
                    if (textInput) {
                        // 添加焦点事件监听
                        textInput.addEventListener('focus', () => {
                            _isInputFocused = true;
                        });
                        textInput.addEventListener('blur', () => {
                            _isInputFocused = false;
                            // ---- 通用颜色验证 ----
                            const val = validateColorInput(textInput, colorInput, p.default);
                            editParams[p.name] = val;
                        });
                        
                        textInput.addEventListener('input', () => {
                            const value = textInput.value;
                            // 只有有效的颜色格式才同步到调色板
                            if (isValidColor(value)) {
                                editParams[p.name] = value;
                                // 如果是 #RRGGBB 或 #RGB 格式，同步到调色板
                                if (colorInput && (value.startsWith('#'))) {
                                    // 将 #RGB 转换为 #RRGGBB
                                    let colorValue = value;
                                    if (/^#[0-9A-Fa-f]{3}$/.test(value)) {
                                        colorValue = '#' + value[1] + value[1] + value[2] + value[2] + value[3] + value[3];
                                    }
                                    if (/^#[0-9A-Fa-f]{6}$/.test(colorValue)) {
                                        colorInput.value = colorValue;
                                    }
                                }
                            } else {
                                // 无效格式，只更新 editParams，但不更新调色板
                                editParams[p.name] = value;
                            }
                        });
                    }
                    if (colorInput) {
                        colorInput.addEventListener('input', () => {
                            editParams[p.name] = colorInput.value;
                            if (textInput) {
                                textInput.value = colorInput.value;
                            }
                        });
                    }
                }, 0);
            } else if (isNoteType(p.type)) {
                // 长文本类型 (note / multiline_string)
                group.innerHTML = `
                    <div class="ml-form-label">
                        ${escapeHtml(p.text || p.name)}
                        <span class="ml-form-label-type">${t('param.typeNote')}</span>
                    </div>
                    <textarea class="ml-form-textarea"
                              id="ml-param-${cssEscape(p.name)}"
                              placeholder="${escapeHtml(p.desc || '')}">${escapeHtml(String(curVal))}</textarea>
                    ${p.desc ? `<div class="ml-form-desc">${escapeHtml(p.desc)}</div>` : ''}
                `;
                setTimeout(() => {
                    const textareaEl = document.getElementById(`ml-param-${cssEscape(p.name)}`);
                    if (textareaEl) {
                        textareaEl.addEventListener('focus', () => {
                            _isInputFocused = true;
                        });
                        textareaEl.addEventListener('blur', () => {
                            _isInputFocused = false;
                            // 失焦时保存值，处理换行符转义 + XSS 防护
                            let value = textareaEl.value;
                            if (value === '' || value === undefined || value === null) {
                                textareaEl.value = p.default;
                                editParams[p.name] = p.default;
                            } else {
                                // XSS 净化
                                const sanitized = sanitizeText(value);
                                if (sanitized !== value) {
                                    textareaEl.value = sanitized;
                                    log(3, `[note-validate] 长文本已净化，移除了潜在危险内容`);
                                }
                                editParams[p.name] = sanitized;
                            }
                        });
                        textareaEl.addEventListener('input', () => {
                            editParams[p.name] = textareaEl.value;
                        });
                    }
                }, 0);
            } else if (isDatabaseType(p.type)) {
                // 数据库引用类型 (actor/skill/item/weapon/armor/enemy/state)
                const dbLabel = getDbLabel(p.type);
                const dbArray = getDatabaseArray(p.type);

                if (dbArray) {
                    // 数据库已加载：渲染 select 下拉框
                    let optionsHtml = '<option value="" style="color:var(--ml-text-muted);">' + t('param.none') + '</option>';
                    for (let i = 1; i < dbArray.length; i++) {
                        const entry = dbArray[i];
                        if (entry && entry.name && entry.name.trim() !== '') {
                            const selected = String(i) === String(curVal) ? ' selected' : '';
                            optionsHtml += `<option value="${i}"${selected}>${i}: ${escapeHtml(entry.name)}</option>`;
                        } else if (entry) {
                            // 空位：显示但禁用选中
                            const selected = String(i) === String(curVal) ? ' selected' : '';
                            optionsHtml += `<option value="${i}"${selected} disabled style="color:var(--ml-text-muted);">${i}: (空)</option>`;
                        }
                        // entry 为 null 的直接跳过
                    }
                    group.innerHTML = `
                        <div class="ml-form-label">
                            ${escapeHtml(p.text || p.name)}
                            <span class="ml-form-label-type">${dbLabel}</span>
                        </div>
                        <select class="ml-form-select" id="ml-param-${cssEscape(p.name)}">
                            ${optionsHtml}
                        </select>
                        ${p.desc ? `<div class="ml-form-desc">${escapeHtml(p.desc)}</div>` : ''}
                    `;
                    setTimeout(() => {
                        const selectEl = document.getElementById(`ml-param-${cssEscape(p.name)}`);
                        if (selectEl) {
                            selectEl.addEventListener('focus', () => {
                                _isInputFocused = true;
                            });
                            selectEl.addEventListener('blur', () => {
                                _isInputFocused = false;
                            });
                            selectEl.addEventListener('change', () => {
                                editParams[p.name] = selectEl.value;
                            });
                        }
                    }, 0);
                } else {
                    // 降级容错：数据库未加载，渲染为普通文本输入
                    group.innerHTML = `
                        <div class="ml-form-label">
                            ${escapeHtml(p.text || p.name)}
                            <span class="ml-form-label-type">${dbLabel} ${t('param.dbFallbackHint')}</span>
                        </div>
                        <input type="text" class="ml-form-input"
                               id="ml-param-${cssEscape(p.name)}"
                               value="${escapeHtml(String(curVal))}"
                               placeholder="${t('param.dbInputPlaceholder').replace('{label}', dbLabel)}">
                        <div class="ml-form-db-hint">${t('param.dbNotLoaded').replace('{label}', dbLabel)}</div>
                        ${p.desc ? `<div class="ml-form-desc">${escapeHtml(p.desc)}</div>` : ''}
                    `;
                    setTimeout(() => {
                        const inputEl = document.getElementById(`ml-param-${cssEscape(p.name)}`);
                        if (inputEl) {
                            inputEl.addEventListener('focus', () => {
                                _isInputFocused = true;
                            });
                            inputEl.addEventListener('blur', () => {
                                _isInputFocused = false;
                                // ---- 通用文本验证（含 XSS 防护） ----
                                const val = validateTextInput(inputEl, p.default);
                                editParams[p.name] = val;
                            });
                            inputEl.addEventListener('input', () => {
                                editParams[p.name] = inputEl.value;
                            });
                        }
                    }, 0);
                }
            } else if (p.type === 'struct') {
                // ---- 阶段2新增：struct 折叠面板渲染 ----
                const schemaFields = p.schemaFields || [];
                // 解析当前值（struct 保存为转义 JSON 对象）
                let structObj = {};
                try {
                    structObj = typeof curVal === 'string' ? JSON.parse(curVal) : (curVal || {});
                } catch (e) {
                    log(2, `[struct] 参数 "${p.name}" 的当前值解析失败，使用默认值`, e);
                    try { structObj = JSON.parse(p.default); } catch (e2) { structObj = {}; }
                }

                // 检测是否需要加宽模态框
                modal.classList.add('ml-modal-wide');

                const details = document.createElement('details');
                details.open = true;
                details.className = 'ml-struct-details ml-struct-depth-1';
                details.setAttribute('data-param-name', p.name);
                details.setAttribute('data-param-type', 'struct');

                const summary = document.createElement('summary');
                summary.className = 'ml-struct-summary';
                summary.textContent = p.text || p.name;
                details.appendChild(summary);

                // 递归渲染子参数
                const structContainer = document.createElement('div');
                structContainer.className = 'ml-struct-body';
                structContainer.setAttribute('data-struct-param', p.name);

                schemaFields.forEach(field => {
                    const fieldGroup = renderStructField(field, structObj[field.name] !== undefined ? structObj[field.name] : (field.default !== undefined ? field.default : ''), 2, p.name);
                    structContainer.appendChild(fieldGroup);
                });

                details.appendChild(structContainer);
                group.appendChild(details);

                if (p.desc) {
                    const descDiv = document.createElement('div');
                    descDiv.className = 'ml-form-desc';
                    descDiv.textContent = p.desc;
                    group.appendChild(descDiv);
                }

                log(3, `[struct] 渲染参数 "${p.name}", 子字段数: ${schemaFields.length}`);

            } else if (p.type === 'table') {
                // ---- 阶段2新增：table 表格化列表渲染 ----
                const schemaFields = p.schemaFields || [];
                // 解析当前值（table 保存为双重转义 JSON 数组）
                let tableRows = [];
                try {
                    const arr = typeof curVal === 'string' ? JSON.parse(curVal) : (curVal || []);
                    if (Array.isArray(arr)) {
                        tableRows = arr.map(row => {
                            try {
                                return typeof row === 'string' ? JSON.parse(row) : (row || {});
                            } catch (e) {
                                return {};
                            }
                        });
                    }
                } catch (e) {
                    log(2, `[table] 参数 "${p.name}" 的当前值解析失败，使用空数组`, e);
                    tableRows = [];
                }

                // 检测是否需要加宽模态框
                modal.classList.add('ml-modal-wide');

                const tableContainer = document.createElement('div');
                tableContainer.className = 'ml-table-container';
                tableContainer.setAttribute('data-table-param', p.name);

                // 标题行
                const titleLabel = document.createElement('div');
                titleLabel.className = 'ml-form-label';
                titleLabel.innerHTML = `${escapeHtml(p.text || p.name)} <span class="ml-form-label-type">${t('param.typeTable')}</span>`;
                tableContainer.appendChild(titleLabel);

                // 滚动包裹层 + 表格
                const scrollWrapper = document.createElement('div');
                scrollWrapper.className = 'ml-table-scroll-wrapper';

                const table = document.createElement('table');
                table.className = 'ml-table';

                // 表头
                const thead = document.createElement('thead');
                const headerRow = document.createElement('tr');
                schemaFields.forEach(field => {
                    const th = document.createElement('th');
                    th.textContent = field.text || field.name;
                    headerRow.appendChild(th);
                });
                // 操作列表头
                const actionTh = document.createElement('th');
                actionTh.className = 'ml-table-action-th';
                actionTh.textContent = t('sort.action');
                headerRow.appendChild(actionTh);
                thead.appendChild(headerRow);
                table.appendChild(thead);

                // 表体
                const tbody = document.createElement('tbody');
                tbody.setAttribute('data-table-body', p.name);

                // 渲染已有行
                tableRows.forEach((rowData, rowIndex) => {
                    const tr = createTableRow(tbody, schemaFields, rowData, p.name);
                    tbody.appendChild(tr);
                });

                table.appendChild(tbody);
                scrollWrapper.appendChild(table);
                tableContainer.appendChild(scrollWrapper);

                // 添加按钮
                const addBtnRow = document.createElement('div');
                addBtnRow.className = 'ml-table-add-row';
                const addBtn = document.createElement('button');
                addBtn.className = 'ml-btn ml-btn-primary ml-table-add-btn';
                addBtn.textContent = t('button.addRow');
                addBtn.addEventListener('click', () => {
                    // 新增一行，使用 schema 默认值
                    const newRowData = {};
                    schemaFields.forEach(field => {
                        newRowData[field.name] = field.default !== undefined ? field.default : '';
                    });
                    const tr = createTableRow(tbody, schemaFields, newRowData, p.name);
                    tbody.appendChild(tr);
                    log(3, `[table] 参数 "${p.name}" 新增行`);
                });
                addBtnRow.appendChild(addBtn);
                tableContainer.appendChild(addBtnRow);

                if (p.desc) {
                    const descDiv = document.createElement('div');
                    descDiv.className = 'ml-form-desc';
                    descDiv.textContent = p.desc;
                    tableContainer.appendChild(descDiv);
                }

                group.appendChild(tableContainer);
                log(3, `[table] 渲染参数 "${p.name}", 列数: ${schemaFields.length}, 行数: ${tableRows.length}`);

            } else {
                // 文本类型
                group.innerHTML = `
                    <div class="ml-form-label">
                        ${escapeHtml(p.text || p.name)}
                        <span class="ml-form-label-type">${t('param.typeText')}</span>
                    </div>
                    <input type="text" class="ml-form-input"
                           id="ml-param-${cssEscape(p.name)}"
                           value="${escapeHtml(String(curVal))}">
                    ${p.desc ? `<div class="ml-form-desc">${escapeHtml(p.desc)}</div>` : ''}
                `;
                setTimeout(() => {
                    const inputEl = document.getElementById(`ml-param-${cssEscape(p.name)}`);
                    if (inputEl) {
                        // 添加焦点事件监听
                        inputEl.addEventListener('focus', () => {
                            _isInputFocused = true;
                        });
                        inputEl.addEventListener('blur', () => {
                            _isInputFocused = false;
                            // ---- 通用文本验证（含 XSS 防护） ----
                            const val = validateTextInput(inputEl, p.default);
                            editParams[p.name] = val;
                        });
                        
                        inputEl.addEventListener('input', () => {
                            editParams[p.name] = inputEl.value;
                        });
                    }
                }, 0);
            }

            // 显示默认值（如果当前值与默认值不同）
            if (curVal !== p.default) {
                let defDisplay = p.default;
                if (p.type === 'boolean') defDisplay = p.default === 'true' ? t('param.on') : t('param.off');
                const defaultHint = document.createElement('div');
                defaultHint.className = 'ml-form-default';
                defaultHint.textContent = t('button.default') + ': ' + defDisplay;
                group.appendChild(defaultHint);
            }

            body.appendChild(group);
        });

        // 底部
        const footer = document.createElement('div');
        footer.className = 'ml-modal-footer';
        footer.innerHTML = `
            <button class="ml-btn ml-btn-warning" id="ml-modal-reset">${t('button.resetDefault')}</button>
            <button class="ml-btn ml-btn-secondary" id="ml-modal-cancel">${t('button.cancel')}</button>
            <button class="ml-btn ml-btn-primary" id="ml-modal-save">${t('button.save')}</button>
        `;

        modal.appendChild(header);
        modal.appendChild(body);
        modal.appendChild(footer);
        _modalOverlay.appendChild(modal);
        document.body.appendChild(_modalOverlay);
        // 绑定模态框内的滚动容器
        const modalBody = document.querySelector('.ml-modal-body');
        if (modalBody) bindWheelToContainer(modalBody);

        // 绑定事件
        document.getElementById('ml-modal-close').addEventListener('click', () => hideParamEditor());
        document.getElementById('ml-modal-cancel').addEventListener('click', () => hideParamEditor());
        document.getElementById('ml-modal-save').addEventListener('click', () => {
            // ---- 阶段2新增：在保存前收集 struct/table 类型的数据 ----
            mod.params.forEach(p => {
                if (p.type === 'struct') {
                    // 收集 struct 数据：遍历 DOM 收集成 JS 对象，返回 JSON.stringify(对象)
                    const detailsEl = modal.querySelector(`details[data-param-name="${cssEscape(p.name)}"][data-param-type="struct"]`);
                    if (detailsEl) {
                        const structBody = detailsEl.querySelector(':scope > .ml-struct-body');
                        if (structBody) {
                            const structObj = collectStructData(structBody);
                            editParams[p.name] = JSON.stringify(structObj);
                            log(3, `[struct] 收集参数 "${p.name}" 数据:`, editParams[p.name]);
                        }
                    }
                } else if (p.type === 'table') {
                    // 收集 table 数据：双重转义 JSON 数组
                    const tbody = modal.querySelector(`tbody[data-table-body="${cssEscape(p.name)}"]`);
                    if (tbody) {
                        const schemaFields = p.schemaFields || [];
                        editParams[p.name] = collectTableData(tbody, schemaFields);
                        log(3, `[table] 收集参数 "${p.name}" 数据:`, editParams[p.name]);
                    }
                }
            });
            // ---- 阶段2新增结束 ----

            // 保存参数前处理空值
            const finalParams = {};
            mod.params.forEach(p => {
                let value = editParams[p.name];
                // ---- 阶段2新增：struct/table 类型直接透传（已在上一步序列化） ----
                if (p.type === 'struct' || p.type === 'table') {
                    finalParams[p.name] = value || p.default;
                    log(3, `[${p.type}] 参数 "${p.name}" 保存值:`, finalParams[p.name]);
                    return; // 跳过后续验证
                }
                // ---- 阶段2新增结束 ----
                // 检查值是否为空
                if (value === '' || value === undefined || value === null) {
                    // 空值时使用默认值
                    finalParams[p.name] = p.default;
                    log(3, `参数 "${p.name}" 为空，使用默认值:`, p.default);
                } else if (p.type === 'number') {
                    // 数值类型额外验证
                    const numValue = Number(value);
                    if (isNaN(numValue)) {
                        finalParams[p.name] = p.default;
                        log(3, `参数 "${p.name}" 不是有效数字，使用默认值:`, p.default);
                    } else {
                        // 检查是否有最小/最大值限制
                        let finalValue = numValue;
                        if (p.min !== undefined && finalValue < p.min) finalValue = p.min;
                        if (p.max !== undefined && finalValue > p.max) finalValue = p.max;
                        finalParams[p.name] = String(finalValue);
                    }
                } else if (p.type === 'color') {
                    // 颜色类型额外验证
                    if (isValidColor(value)) {
                        finalParams[p.name] = value;
                    } else {
                        finalParams[p.name] = p.default;
                        log(3, `参数 "${p.name}" 颜色格式无效 (${value})，使用默认值:`, p.default);
                    }
                } else if (isNoteType(p.type)) {
                    // 长文本类型：保留换行符，进行 XSS 净化
                    finalParams[p.name] = sanitizeText(value);
                } else if (isDatabaseType(p.type)) {
                    // 数据库引用类型：值必须是字符串类型的 ID
                    finalParams[p.name] = String(value);
                } else {
                    // 文本等其他类型：进行 XSS 净化
                    finalParams[p.name] = sanitizeText(value);
                }
            });
            
            // 保存参数
            mod.currentParams = { ...finalParams };
            const config = loadConfig();
            config[mod.id] = {
                status: mod.status,
                params: mod.currentParams,
                order: mod.order
            };
            saveConfig(config);

            _needsRestart = true;
            updateRestartHint();
            _hasUnsavedChanges = false;
            updateSaveButton();

            // 刷新详情
            if (_selectedIndex >= 0 && _modData[_selectedIndex] === mod) {
                renderDetail(mod);
            }

            hideParamEditor();

            try {
                if (typeof SoundManager !== 'undefined') SoundManager.playOk();
            } catch (e) { /* 忽略 */ }

            log(3, "参数已保存:", mod.displayName, finalParams);
        });

        document.getElementById('ml-modal-reset').addEventListener('click', () => {
            // 恢复默认值
            mod.params.forEach(p => {
                editParams[p.name] = p.default;
                
                // ---- 阶段2修复：struct 和 table 的一键还原重绘 ----
                if (p.type === 'struct') {
                    const oldDetails = modal.querySelector(`details[data-param-name="${cssEscape(p.name)}"][data-param-type="struct"]`);
                    if (oldDetails) {
                        const group = oldDetails.closest('.ml-form-group');
                        group.innerHTML = ''; // 清空旧 DOM
                        // 重新按默认值渲染
                        let structObj = {};
                        try { structObj = JSON.parse(p.default); } catch(e) { structObj = {}; }
                        const details = document.createElement('details');
                        details.open = true;
                        details.className = 'ml-struct-details ml-struct-depth-1';
                        details.setAttribute('data-param-name', p.name);
                        details.setAttribute('data-param-type', 'struct');
                        const summary = document.createElement('summary');
                        summary.className = 'ml-struct-summary';
                        summary.textContent = p.text || p.name;
                        details.appendChild(summary);
                        const structContainer = document.createElement('div');
                        structContainer.className = 'ml-struct-body';
                        structContainer.setAttribute('data-struct-param', p.name);
                        p.schemaFields.forEach(field => {
                            const fieldGroup = renderStructField(field, structObj[field.name] !== undefined ? structObj[field.name] : (field.default !== undefined ? field.default : ''), 2, p.name);
                            structContainer.appendChild(fieldGroup);
                        });
                        details.appendChild(structContainer);
                        group.appendChild(details);
                    }
                    return; // 处理完毕，跳过后续基础类型逻辑
                } 
                else if (p.type === 'table') {
                    const oldContainer = modal.querySelector(`div[data-table-param="${cssEscape(p.name)}"]`);
                    if (oldContainer) {
                        const group = oldContainer.closest('.ml-form-group');
                        group.innerHTML = ''; // 清空旧 DOM
                        // 重新按默认值渲染
                        let tableRows = [];
                        try {
                            const arr = JSON.parse(p.default);
                            if (Array.isArray(arr)) {
                                tableRows = arr.map(row => {
                                    try { return typeof row === 'string' ? JSON.parse(row) : (row || {}); } catch (e) { return {}; }
                                });
                            }
                        } catch (e) { tableRows = []; }

                        const tableContainer = document.createElement('div');
                        tableContainer.className = 'ml-table-container';
                        tableContainer.setAttribute('data-table-param', p.name);
                        const titleLabel = document.createElement('div');
                        titleLabel.className = 'ml-form-label';
                        titleLabel.innerHTML = `${escapeHtml(p.text || p.name)} <span class="ml-form-label-type">${t('param.typeTable')}</span>`;
                        tableContainer.appendChild(titleLabel);
                        const scrollWrapper = document.createElement('div');
                        scrollWrapper.className = 'ml-table-scroll-wrapper';
                        const table = document.createElement('table');
                        table.className = 'ml-table';
                        const thead = document.createElement('thead');
                        const headerRow = document.createElement('tr');
                        p.schemaFields.forEach(field => {
                            const th = document.createElement('th');
                            th.textContent = field.text || field.name;
                            headerRow.appendChild(th);
                        });
                        const actionTh = document.createElement('th');
                        actionTh.className = 'ml-table-action-th';
                        actionTh.textContent = t('sort.action');
                        headerRow.appendChild(actionTh);
                        thead.appendChild(headerRow);
                        table.appendChild(thead);
                        const tbody = document.createElement('tbody');
                        tbody.setAttribute('data-table-body', p.name);
                        tableRows.forEach(rowData => {
                            const tr = createTableRow(tbody, p.schemaFields, rowData, p.name);
                            tbody.appendChild(tr);
                        });
                        table.appendChild(tbody);
                        scrollWrapper.appendChild(table);
                        tableContainer.appendChild(scrollWrapper);
                        const addBtnRow = document.createElement('div');
                        addBtnRow.className = 'ml-table-add-row';
                        const addBtn = document.createElement('button');
                        addBtn.className = 'ml-btn ml-btn-primary ml-table-add-btn';
                        addBtn.textContent = t('button.addRow');
                        addBtn.addEventListener('click', () => {
                            const newRowData = {};
                            p.schemaFields.forEach(field => { newRowData[field.name] = field.default !== undefined ? field.default : ''; });
                            const tr = createTableRow(tbody, p.schemaFields, newRowData, p.name);
                            tbody.appendChild(tr);
                        });
                        addBtnRow.appendChild(addBtn);
                        tableContainer.appendChild(addBtnRow);
                        group.appendChild(tableContainer);
                    }
                    return; // 处理完毕，跳过后续基础类型逻辑
                }
                // ---- 阶段2修复结束 ----

                // 更新UI中的输入元素
                const inputEl = document.getElementById(`ml-param-${cssEscape(p.name)}`);
                if (inputEl) {
                    if (p.type === 'boolean') {
                        // 布尔开关
                        const isOn = p.default === 'true';
                        inputEl.classList.toggle('on', isOn);
                        const statusEl = document.getElementById(`ml-param-status-${cssEscape(p.name)}`);
                        if (statusEl) {
                            statusEl.textContent = isOn ? t('param.on') : t('param.off');
                            statusEl.className = `ml-form-toggle-status ${isOn ? 'on' : 'off'}`;
                        }
                    } else if (p.type === 'select') {
                        // 下拉选择
                        inputEl.value = p.default;
                    } else if (p.type === 'color') {
                        // 颜色类型
                        inputEl.value = p.default;
                        const colorInput = document.getElementById(`ml-param-${cssEscape(p.name)}-color`);
                        if (colorInput) {
                            colorInput.value = String(p.default).startsWith('#') ? String(p.default) : '#ffffff';
                        }
                    } else if (p.type === 'number' && p.min !== undefined && p.max !== undefined) {
                        // 带滑动条的数值类型
                        inputEl.value = p.default;
                        const sliderEl = document.getElementById(`ml-param-slider-${cssEscape(p.name)}`);
                        const displayEl = document.getElementById(`ml-param-display-${cssEscape(p.name)}`);
                        if (sliderEl) sliderEl.value = p.default;
                        if (displayEl) displayEl.textContent = p.default;
                    } else if (isNoteType(p.type)) {
                        // 长文本类型
                        inputEl.value = p.default;
                    } else if (isDatabaseType(p.type)) {
                        // 数据库引用类型
                        inputEl.value = p.default;
                    } else {
                        // 文本或数值输入
                        inputEl.value = p.default;
                    }
                }
                
                // 更新默认值提示
                const group = inputEl?.closest('.ml-form-group');
                if (group) {
                    // 移除现有默认值提示
                    const existingHint = group.querySelector('.ml-form-default');
                    if (existingHint) existingHint.remove();
                }
            });
            
            log(3, "参数已恢复默认:", mod.displayName);
            try {
                if (typeof SoundManager !== 'undefined') SoundManager.playOk();
            } catch (e) { /* 忽略 */ }
        });

        // 移除点击遮罩关闭功能，用户必须点击确认或取消按钮

        // 设置初始焦点到第一个输入框
        setTimeout(() => {
            const firstInput = body.querySelector('input[type="text"], input[type="number"], input[type="color"], select');
            if (firstInput) {
                firstInput.focus();
            }
        }, 50);

        log(3, "参数编辑器已打开:", mod.displayName);
    }

    /**
     * 隐藏参数编辑模态框
     */
    function hideParamEditor() {
        if (_modalOverlay) {
            _modalOverlay.remove();
            _modalOverlay = null;
        }
        
        // 键盘事件捕获由管理器统一管理，这里不需要再处理
    }

    /**
     * 显示安装mod的全屏拖放界面
     */
    function showInstallOverlay() {
        // 检查是否有未保存的修改
        if (_hasUnsavedChanges) {
            showConfirmDialog(
                t('dialog.title'),
                t('dialog.saveFirst'),
                [
                    {
                        text: t('button.save'),
                        class: "ml-btn-primary",
                        action: () => {
                            hideConfirmDialog();
                            saveAllChanges();
                            openInstallOverlay();
                        }
                    },
                    {
                        text: t('button.cancel'),
                        class: "ml-btn-secondary",
                        action: hideConfirmDialog
                    }
                ]
            );
            return;
        }
        openInstallOverlay();
    }

    function openInstallOverlay() {
        if (_installOverlay) hideInstallOverlay();

        _installOverlay = document.createElement('div');
        _installOverlay.className = 'ml-overlay';
        _installOverlay.style.display = 'flex';
        _installOverlay.style.alignItems = 'center';
        _installOverlay.style.justifyContent = 'center';
        _installOverlay.style.flexDirection = 'column';
        _installOverlay.style.zIndex = '9999';

        _installOverlay.innerHTML = `
            <div style="text-align: center; background: var(--ml-bg-primary); padding: 40px; border-radius: var(--ml-radius-lg); min-width: 450px; border: 1px solid var(--ml-border-light);">
                <div id="ml-drop-zone" style="border: 2px dashed var(--ml-border-light); border-radius: var(--ml-radius); padding: 40px 20px; transition: all 0.3s ease;">
                    <div style="font-size: 64px; margin-bottom: 20px;">📁</div>
                    <div style="font-size: 20px; margin-bottom: 10px; color: var(--ml-text-primary);">${t('install.dragHint')}</div>
                </div>
                <div style="font-size: 14px; color: var(--ml-text-secondary); margin: 20px 0;">${t('install.orClickBrowse')}</div>
                <button class="ml-btn ml-btn-primary" id="ml-btn-browse" style="margin-bottom: 15px;">${t('button.browseFiles')}</button>
                <br>
                <button class="ml-btn ml-btn-secondary" id="ml-btn-exit-install">${t('button.exit')}</button>
            </div>
        `;

        document.body.appendChild(_installOverlay);

        const dropZone = document.getElementById('ml-drop-zone');

        // 绑定事件
        document.getElementById('ml-btn-browse').addEventListener('click', browseFiles);
        document.getElementById('ml-btn-exit-install').addEventListener('click', hideInstallOverlay);

        // 绑定拖放事件
        _installOverlay.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });

        _installOverlay.addEventListener('dragenter', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'var(--ml-accent)';
            dropZone.style.backgroundColor = 'rgba(var(--ml-accent-rgb), 0.1)';
        });

        _installOverlay.addEventListener('dragleave', (e) => {
            e.preventDefault();
            // 只有离开 overlay 时才重置
            if (!_installOverlay.contains(e.relatedTarget)) {
                dropZone.style.borderColor = 'var(--ml-border-light)';
                dropZone.style.backgroundColor = 'transparent';
            }
        });

        _installOverlay.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.style.borderColor = 'var(--ml-border-light)';
            dropZone.style.backgroundColor = 'transparent';
            handleInstallDrop(e);
        });

        // ESC 关闭
        _installOverlay.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') hideInstallOverlay();
        });

        log(3, "安装mod界面已打开");
    }

    /**
     * 隐藏安装mod界面
     */
    function hideInstallOverlay() {
        if (_installOverlay) {
            _installOverlay.remove();
            _installOverlay = null;
        }
    }

    /**
     * 浏览本地文件（通过 NW.js）
     */
    function browseFiles() {
        // NW.js 有打开文件对话框的API
        try {
            const nwGui = require('nw.gui');
            const win = nwGui.Window.get();
            if (DEBUG_LEVEL >= 3) {
                win.showDevTools(); // 仅调试级别3及以上
            }
            
            // 弹出文件选择对话框
            const dialog = document.createElement('input');
            dialog.type = 'file';
            dialog.accept = '.js';
            dialog.multiple = true;
            dialog.onchange = async (e) => {
                if (e.target.files && e.target.files.length > 0) {
                    const files = Array.from(e.target.files);
                    handleJsFilesDrop(files.map(f => ({ type: 'file', file: f, name: f.name })));
                }
            };
            dialog.click();
        } catch (err) {
            log(2, "无法打开文件浏览器：", err);
            showConfirmDialog(
                t('dialog.title'),
                t('install.dragDirectly'),
                [{ text: t('dialog.ok'), class: "ml-btn-primary", action: hideConfirmDialog }]
            );
        }
    }

    /**
     * 处理安装拖放
     */
    function handleInstallDrop(e) {
        log(3, "=== handleInstallDrop ===");
        
        const items = e.dataTransfer.items;
        const files = collectFiles(items ? Array.from(items) : [], e.dataTransfer.files);

        if (files.length === 0) {
            showConfirmDialog(
                t('dialog.title'),
                t('install.dragJsOrFolder'),
                [{ text: t('dialog.ok'), class: "ml-btn-primary", action: hideConfirmDialog }]
            );
            return;
        }

        const modsFolder = files.find(f => f.type === 'mods-folder');
        if (modsFolder) {
            // 如果 entry 方式识别，强制用 dataTransfer.files
            if (!modsFolder.files && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                modsFolder.files = Array.from(e.dataTransfer.files);
            }
            handleModsFolderDrop(modsFolder);
            return;
        }

        const jsFiles = files.filter(f => f.type === 'file' && f.name.toLowerCase().endsWith('.js'));
        if (jsFiles.length > 0) {
            handleJsFilesDrop(jsFiles);
        }
    }

    /**
     * 切换删除模式
     */
    function toggleDeleteMode() {
        _deleteMode = !_deleteMode;
        updateButtonStates();
        log(3, "删除模式:", _deleteMode ? "开启" : "关闭");

        // 重新渲染列表
        renderModList();
    }

    /**
     * 删除模组（本地：整包删除 _localmods/<包名>/）
     */
    function deleteMod(index) {
        const mod = _modData[index];
        if (!mod) return;

        const packageName = mod.localPackageName;
        const packageMods = getLocalModsInPackage(packageName);
        const packageRoot = mod.packageRoot;

        let msg = '';
        if (packageMods.length > 1) {
            msg += t('delete.packageWarning') + '\n';
            msg += packageMods.map(m => '  • ' + m.displayName).join('\n') + '\n\n';
        } else {
            msg += t('delete.folderWarning') + '\n\n';
        }
        msg += t('dialog.deleteConfirmMsg').replace('{name}', mod.displayName);

        let extraWarning = '';
        if (_hasUnsavedChanges) {
            extraWarning = '\n' + t('dialog.deleteWarning');
        }

        showConfirmDialog(
            t('dialog.confirmDelete'),
            msg + extraWarning,
            [
                { text: t('button.cancel'), class: "ml-btn-secondary", action: hideConfirmDialog },
                {
                    text: t('button.confirmDelete'),
                    class: "ml-btn-primary",
                    action: async () => {
                        hideConfirmDialog();
                        try {
                            if (_hasUnsavedChanges) {
                                saveAllChanges();
                            }

                            if (packageRoot && fs.existsSync(packageRoot)) {
                                log(3, '删除本地 Mod 包目录:', packageRoot);
                                removePathSafe(packageRoot);
                            }

                            _modData = scanAllMods();
                            reassignOrders();
                            persistModListToConfig();

                            refreshDependencyCheck();
                            renderModList();
                            updateCounts();

                            if (_selectedIndex >= _modData.length) {
                                _selectedIndex = _modData.length > 0 ? 0 : -1;
                            }
                            renderDetail(_selectedIndex >= 0 ? _modData[_selectedIndex] : null);

                            log(3, '本地 Mod 包已删除:', packageName || mod.displayName);
                            showConfirmDialog(
                                t('dialog.success'),
                                t('dialog.deletedMod').replace('{name}', mod.displayName),
                                [{ text: t('dialog.ok'), class: "ml-btn-primary", action: hideConfirmDialog }]
                            );
                        } catch (err) {
                            log(1, '删除模组失败:', err);
                            showConfirmDialog(
                                t('dialog.error'),
                                t('dialog.deleteFailed'),
                                [{ text: t('dialog.ok'), class: "ml-btn-primary", action: hideConfirmDialog }]
                            );
                        }
                    }
                }
            ]
        );
    }

    // ================================================================
    // 9. 标题画面按钮（DOM 化）
    // ================================================================
    function updateTitleButtonVisibility() {
        if (!_titleBtn) return;
        try {
            if (typeof SceneManager !== 'undefined' && SceneManager._scene) {
                const isTitle = SceneManager._scene.constructor.name === 'Scene_Title';
                _titleBtn.style.display = isTitle ? 'block' : 'none';
            } else {
                _titleBtn.style.display = 'none';
            }
        } catch (e) {
            _titleBtn.style.display = 'none';
        }
    }

    function setupTitleButton() {
        if (_titleBtn) return;

        _titleBtn = document.createElement('button');
        _titleBtn.className = 'ml-title-btn';
        _titleBtn.id = 'ml-title-btn';
        _titleBtn.textContent = t('title');
        _titleBtn.style.left = BUTTON_X + 'px';
        _titleBtn.style.top = BUTTON_Y + 'px';
        _titleBtn.style.display = 'none';
        document.body.appendChild(_titleBtn);

        _titleBtn.addEventListener('click', () => {
            if (showPiracyWarning()) return;
            showModManager();
            try {
                if (typeof SoundManager !== 'undefined') SoundManager.playOk();
            } catch (e) { /* 忽略 */ }
        });

        let lastSceneName = '';
        setInterval(() => {
            try {
                if (typeof SceneManager !== 'undefined' && SceneManager._scene) {
                    const currentName = SceneManager._scene.constructor.name;
                    if (currentName !== lastSceneName) {
                        lastSceneName = currentName;
                        updateTitleButtonVisibility();
                        log(3, "场景切换:", currentName);
                    }
                }
            } catch (e) {
                log(2, "场景检测异常", e);
            }
        }, 200);

        updateTitleButtonVisibility();
        log(3, "标题画面按钮已创建 (DOM)");
    }

    // ================================================================
    // 10. 键盘快捷键支持
    // ================================================================
    document.addEventListener('keydown', (e) => {
        if (!_overlay || _overlay.style.display === 'none') return;

        // 如果确认对话框打开，ESC关闭它
        if (_confirmModal) {
            if (e.key === 'Escape') {
                hideConfirmDialog();
                e.preventDefault();
            }
            return;
        }

        // 如果模态框打开了，让键盘捕获监听器处理
        if (_modalOverlay) {
            const isInputFocused = checkInputFocus();
            // 只有ESC键可以关闭模态框，而且只有输入框没有获得焦点时
            if (!isInputFocused && e.key === 'Escape') {
                hideParamEditor();
                e.preventDefault();
            }
            return;
        }

        // 检查是否有输入框获得焦点
        const isInputFocused = checkInputFocus();
        
        // 如果有输入框获得焦点，完全不处理 - 让浏览器正常处理所有键盘事件
        if (isInputFocused) {
            return;
        }

        switch (e.key) {
            case 'Escape':
                tryCloseModManager();
                break;
            case 'ArrowUp':
                e.preventDefault();
                if (_modData.length > 0) {
                    const newIdx = Math.max(0, _selectedIndex - 1);
                    selectMod(newIdx);
                    scrollToIndex(newIdx);
                }
                break;
            case 'ArrowDown':
                e.preventDefault();
                if (_modData.length > 0) {
                    const newIdx = Math.min(_modData.length - 1, _selectedIndex + 1);
                    selectMod(newIdx);
                    scrollToIndex(newIdx);
                }
                break;
            case 'Enter':
            case ' ':
                e.preventDefault();
                if (_selectedIndex >= 0) {
                    toggleMod(_selectedIndex);
                }
                break;
            case 'e':
            case 'E':
                if (_selectedIndex >= 0) {
                    const mod = _modData[_selectedIndex];
                    if (mod && mod.params && mod.params.length > 0) {
                        showParamEditor(mod);
                    }
                }
                break;
        }
    });

    /**
     * 滚动列表到指定索引
     */
    function scrollToIndex(index) {
        const container = document.getElementById('ml-list-scroll');
        const item = container?.children[index];
        if (item) {
            item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }

    // ================================================================
    // 11. 初始化
    // ================================================================
    injectStyles();
    ensureModLoaderConfigFile();
    loadLanguageConfigs();
    var initMlConfig = loadModLoaderConfig();
    _currentLanguage = initMlConfig.ml_language || 'zh_CN';
    if (!_languageConfigs[_currentLanguage]) {
        _currentLanguage = 'zh_CN';
    }
    cleanupLegacyModEntriesFromPluginsJs();
    installBootstrapHooks();
    installWindowLoadFallback();
    bootstrapModLoaderReady();
    window.addEventListener('load', () => {
        loadLanguageConfigs();
        var mlCfg = loadModLoaderConfig();
        _currentLanguage = mlCfg.ml_language || 'zh_CN';
        if (!_languageConfigs[_currentLanguage]) {
            _currentLanguage = 'zh_CN';
        }
        setupTitleButton();
    });
    log(3, `ModLoader ${VERSION} 初始化完成`);

})();
