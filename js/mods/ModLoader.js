/*:
 * @target MZ
 * @plugindesc 游戏内模组管理器（DOM化UI & 现代交互 & 拖放添加Mod & 滑动条/长文本/数据库引用）
 * @author joker创意 / GLM核心代码
 * @version V4.4.3
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
 * 12.标签读取支持：@version @base @orderAfter @orderBefore（仅供玩家参考）@author @help
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
    // 模块 1 · 运行时基础（常量 / 日志 / Node.js 模块 / 路径 / 默认配置）
    // ----------------------------------------------------------------
    // 含：1.1 常量与日志 · 1.2 Node 模块 / 路径 / 默认配置（含 libs 目录）
    // ================================================================

    // ---- 1.1 常量、版本与日志 ----
    const ModName = "ModLoader";
    const VERSION = "V4.4.3";
    const DEBUG_LEVEL = 3;

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

    // ---- 1.2 Node.js 模块、路径与默认配置 ----
    const fs = require('fs');
    const pathMod = require('path');
    const MODS_DIR = pathMod.join(process.cwd(), 'js', 'mods');
    // NW.js 下 ModLoader 经 <script> 注入时，相对 require 以 cwd（游戏根）为基准，须用绝对路径
    const paramTypeKit = require(pathMod.join(MODS_DIR, 'modloader', 'paramTypeKit'));
    const createModMetadata = require(pathMod.join(MODS_DIR, 'modloader', 'modMetadata'));
    const createDependencyResolver = require(pathMod.join(MODS_DIR, 'modloader', 'dependencyResolver'));
    const createParamValues = require(pathMod.join(MODS_DIR, 'modloader', 'paramValues'));
    const createPackageDiscovery = require(pathMod.join(MODS_DIR, 'modloader', 'packageDiscovery'));
    const createConfigCore = require(pathMod.join(MODS_DIR, 'modloader', 'configCore'));
    const createInstallClassifier = require(pathMod.join(MODS_DIR, 'modloader', 'installClassifier'));
    const pluginNameConflict = require(pathMod.join(MODS_DIR, 'modloader', 'pluginNameConflict'));
    const createModCatalog = require(pathMod.join(MODS_DIR, 'modloader', 'modCatalog'));
    const createWorkshopBridge = require(pathMod.join(MODS_DIR, 'modloader', 'workshopBridge'));
    const createScanPipeline = require(pathMod.join(MODS_DIR, 'modloader', 'scanPipeline'));
    const createInstallIo = require(pathMod.join(MODS_DIR, 'modloader', 'installIo'));

    const packageDiscovery = createPackageDiscovery({ fs, pathMod, log });
    const {
        readWorkshopManifest,
        discoverPackageScripts
    } = packageDiscovery;

    const configCore = createConfigCore({ log });
    const installClassifier = createInstallClassifier({ pathMod });
    const {
        normalizeDragItems,
        normalizeBrowseJsFiles,
        normalizeBrowseModsFolder,
        analyzeInstallItems,
        resolveModsFolderSrcDir
    } = installClassifier;

    const {
        DEFAULT_WORKSHOP_CONFIG,
        resolveModConfigEntry,
        isModConfigMetaKey,
        getDefaultModLoaderConfig,
        mergeWorkshopConfigSection,
        serializeModListToConfig
    } = configCore;

    const LOCALMODS_DIR = pathMod.join(MODS_DIR, '_localmods');
    const WORKSHOP_BRIDGE_DIR = pathMod.join(MODS_DIR, '_workshop');
    const LIBS_DIR = pathMod.join(MODS_DIR, 'libs');
    // 依赖库：由管理器点名加载，不作为扩展脚本执行
    const LIBS_VENDOR_FILES = {
        'marked.min.js': true
    };
    const CONFIG_PATH = pathMod.join(MODS_DIR, 'mod_config.json');
    const PLUGINS_PATH = pathMod.join(process.cwd(), 'js', 'plugins.js');
    const MODLOADER_CONFIG_PATH = pathMod.join(MODS_DIR, 'config', 'modloader_config.json');
    const LANGUAGE_DIR = pathMod.join(MODS_DIR, 'config', 'language');
    let _currentLanguage = 'zh_CN';
    let _languageConfigs = {};

    // ================================================================
    // 模块 2 · 配置与文件操作（I/O 外壳 + i18n；规则核心 → modloader/configCore.js）
    // ----------------------------------------------------------------
    // 含：2.1 mod_config 读写 · 2.2 语言包系统 · 2.3 modloader_config 与工坊配置
    // ================================================================

    // ---- 2.1 mod_config.json 读写（loadConfig 只读；写入见 persistModListToConfig） ----
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

    function saveConfig(config) {
        ensureDir(MODS_DIR);
        try {
            fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
            log(3, "配置已保存", CONFIG_PATH);
        } catch (e) {
            log(1, "保存配置失败", e);
        }
    }

    // ---- 2.2 语言包系统（i18n：loadLanguageConfigs / t / setLanguage） ----
    function loadLanguageConfigs() {
        _languageConfigs = {};
        try {
            if (fs.existsSync(LANGUAGE_DIR)) {
                const files = fs.readdirSync(LANGUAGE_DIR);
                files.forEach(function(f) {
                    if (f.endsWith('.json')) {
                        try {
                            const raw = fs.readFileSync(pathMod.join(LANGUAGE_DIR, f), 'utf-8');
                            const data = JSON.parse(raw);
                            const langCode = data._langCode || f.replace('.json', '');
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
        const langs = Object.keys(_languageConfigs);
        const order = ['zh_CN', 'zh_TW', 'en'];
        langs.sort(function(a, b) {
            let ia = order.indexOf(a);
            let ib = order.indexOf(b);
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
        const map = { 'zh_CN': '简体中文', 'zh_TW': '繁體中文', 'en': 'English' };
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

    // ---- 2.3 modloader_config.json 与工坊配置（含 Steam 路径解析） ----
    let _workshopConfigCache = null;

    function invalidateWorkshopConfigCache() {
        _workshopConfigCache = null;
    }

    /**
     * 首次启动或旧版配置缺少 workshop 段时，补全并写入 modloader_config.json
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
            if (workshopMerge.changed) {
                raw.workshop = workshopMerge.merged;
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
                const raw = fs.readFileSync(MODLOADER_CONFIG_PATH, 'utf-8');
                const parsed = JSON.parse(raw);
                const defaults = getDefaultModLoaderConfig();
                return {
                    ml_theme: parsed.ml_theme !== undefined ? parsed.ml_theme : defaults.ml_theme,
                    ml_language: parsed.ml_language !== undefined ? parsed.ml_language : defaults.ml_language,
                    workshop: Object.assign({}, defaults.workshop, parsed.workshop || {})
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
            const existingConfig = loadModLoaderConfig();
            const mergedConfig = {
                ml_theme: config.ml_theme !== undefined ? config.ml_theme : existingConfig.ml_theme,
                ml_language: config.ml_language !== undefined ? config.ml_language : existingConfig.ml_language,
                workshop: Object.assign({}, existingConfig.workshop, config.workshop || {})
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

    const modCatalog = createModCatalog({
        fs,
        pathMod,
        log,
        readWorkshopManifest,
        discoverPackageScripts,
        resolveModConfigEntry,
        isModConfigMetaKey,
        localmodsDir: LOCALMODS_DIR
    });

    const workshopBridge = createWorkshopBridge({
        fs,
        pathMod,
        log,
        loadWorkshopConfig,
        DEFAULT_WORKSHOP_CONFIG,
        ensureDir
    });

    const {
        resolveSteamPaths,
        removePathSafe,
        buildWorkshopBridgeLoadPath,
        syncWorkshopBridge
    } = workshopBridge;

    const {
        buildLocalModId,
        buildLocalLoadPath,
        getLocalModInstallPath,
        getModPackageRoot,
        getPackageDisplayName,
        resolvePackageVersion,
        getPackageChangelogPath,
        packageHasChangelog,
        canShowModChangelog,
        getConfigMaxOrder,
        allocDefaultOrderForMod
    } = modCatalog;

    ensureModLoaderConfigFile();

    // ================================================================
    // 模块 3 · 本地 Mod 安装管线（拖放 / 浏览 → 复制 → 写配置）
    // ----------------------------------------------------------------
    // 含：3.1 收集与分发 · 3.2 落地复制 · 3.3 写回配置并刷新 UI
    // 安装页 UI（遮罩 / 浏览按钮）在模块 6；拖放与浏览均汇入 dispatchInstallItems。
    // 分类规则 → modloader/installClassifier.js · 复制 I/O → modloader/installIo.js
    // ================================================================

    const installIo = createInstallIo({ fs, pathMod, log, ensureDir });
    const { copyFolderRecursive, copyFileToLocalMod } = installIo;

    function installLog(...args) {
        log(3, '[install]', ...args);
    }

    /** 统一忽略项文案（拖放 / 浏览共用） */
    function formatInstallIgnoredSection(ignored) {
        if (!ignored) return '';
        let text = '';
        if (ignored.files && ignored.files.length > 0) {
            text += '❌ ' + t('info.format.已排除非js文件') + '：' + ignored.files.join('、') + '\n\n';
        }
        if (ignored.folders && ignored.folders.length > 0) {
            text += '❌ ' + t('info.format.已排除文件夹') + '：' + ignored.folders.join('、') + '\n\n';
        }
        return text;
    }

    function showInstallRejectDialog(reason, ignored, folderName) {
        let body = '';
        if (reason === 'not-mods-folder') {
            body = t('install.notModsFolder').replace('{name}', folderName || '?');
        } else if (reason === 'no-js') {
            body = formatInstallIgnoredSection(ignored) + t('install.noJsAfterIgnore');
        } else {
            body = t('install.dragJsOrFolder');
        }
        showConfirmDialog(
            t('dialog.title'),
            body,
            [{ text: t('dialog.ok'), class: 'ml-btn-primary', action: hideConfirmDialog }]
        );
    }

    /** 拖放 / 浏览统一入口 → installClassifier.analyzeInstallItems */
    function dispatchInstallItems(installItems) {
        installLog('dispatchInstallItems →', installItems.length, '项');
        const decision = analyzeInstallItems(installItems);

        if (decision.action === 'mods-folder') {
            const folder = decision.folder;
            if (folder.srcDir) {
                beginModsFolderInstall(folder.srcDir);
            } else {
                const srcModsDir = resolveModsFolderSrcDir(folder);
                beginModsFolderInstall(srcModsDir);
            }
            return;
        }

        if (decision.action === 'js-files') {
            handleJsFilesDrop(decision.jsItems, decision.ignored);
            return;
        }

        showInstallRejectDialog(decision.reason, decision.ignored, decision.folderName);
    }

    /** 拖放入口 */
    function dispatchCollectedInstall(items, dataTransferFiles) {
        dispatchInstallItems(normalizeDragItems(items, dataTransferFiles));
    }

    /** 浏览 .js 入口 */
    function dispatchBrowseJsFiles(fileList) {
        dispatchInstallItems(normalizeBrowseJsFiles(fileList));
    }

    /** 浏览 mods 文件夹入口（已选目录路径） */
    function dispatchBrowseModsFolder(srcDir) {
        dispatchInstallItems(normalizeBrowseModsFolder(srcDir));
    }

    function finalizeInstallAndRefresh() {
        _modData = scanAllMods();
        persistModListToConfig();
        refreshDependencyCheck();
        renderModList();
        updateCounts();
    }

    // ---- 3.2 落地复制（copyFolderRecursive / mods 整包 / 单 .js → modloader/installIo.js） ----
    function showInstallDoneDialog(message) {
        showConfirmDialog(
            t('install.success'),
            message,
            [{ text: t('dialog.ok'), class: 'ml-btn-primary', action: hideConfirmDialog }]
        );
    }

    function beginModsFolderInstall(srcModsDir) {
        if (!srcModsDir || !fs.existsSync(srcModsDir)) {
            showConfirmDialog(
                t('dialog.title'),
                t('install.modsFolderNotFound'),
                [{ text: t('dialog.ok'), class: 'ml-btn-primary', action: hideConfirmDialog }]
            );
            return;
        }

        const listText = t('info.format.detectedModsFolderImport') + '\n\n' + t('install.modsFolderOverwrite');

        showConfirmDialog(
            t('install.importList'),
            listText,
            [
                { text: t('button.cancel'), class: 'ml-btn-secondary', action: hideConfirmDialog },
                {
                    text: t('button.importOverwrite'),
                    class: 'ml-btn-primary',
                    action: async () => {
                        hideConfirmDialog();
                        try {
                            installLog('复制 mods 文件夹', srcModsDir, '->', MODS_DIR);
                            const count = copyFolderRecursive(srcModsDir, MODS_DIR);
                            finalizeInstallAndRefresh();
                            showInstallDoneDialog(t('install.copySuccess').replace('{count}', count));
                        } catch (e) {
                            log(1, '处理 mods 文件夹失败', e);
                            showConfirmDialog(
                                t('dialog.error'),
                                t('install.copyFailed'),
                                [{ text: t('dialog.ok'), class: 'ml-btn-primary', action: hideConfirmDialog }]
                            );
                        }
                    }
                }
            ]
        );
    }

    function handleJsFilesDrop(jsItems, ignored) {
        const jsFiles = [];
        const newFiles = [];
        const updateFiles = [];

        for (const fileItem of jsItems) {
            const file = fileItem.file;
            if (!file || !file.name) continue;
            jsFiles.push(file);
            const destPath = getLocalModInstallPath(file.name);
            if (fs.existsSync(destPath)) {
                updateFiles.push(file);
            } else {
                newFiles.push(file);
            }
        }

        let listText = formatInstallIgnoredSection(ignored);
        if (newFiles.length > 0) {
            listText += '✨ ' + t('info.format.新增mod') + '：\n' + newFiles.map(f => '  - ' + f.name).join('\n') + '\n';
        }
        if (updateFiles.length > 0) {
            listText += '🔄 ' + t('info.format.更新mod') + '：\n' + updateFiles.map(f => '  - ' + f.name).join('\n') + '\n';
        }

        const hasUpdates = updateFiles.length > 0;

        if (jsFiles.length === 0) {
            showInstallRejectDialog('no-js', ignored);
            return;
        }

        showConfirmDialog(
            t('install.importList'),
            listText,
            [
                { text: t('button.cancel'), class: 'ml-btn-secondary', action: hideConfirmDialog },
                {
                    text: hasUpdates ? t('button.importOverwrite') : t('button.import'),
                    class: 'ml-btn-primary',
                    action: async () => {
                        hideConfirmDialog();
                        await importFiles(jsFiles);
                    }
                }
            ]
        );
    }

    // ---- 3.3 写回配置并刷新 UI（importFiles） ----
    async function importFiles(files) {
        let successCount = 0;

        for (const file of files) {
            const destPath = getLocalModInstallPath(file.name);
            try {
                await copyFileToLocalMod(file, destPath);
                successCount++;
                installLog('已导入', file.name);
            } catch (err) {
                log(1, '导入失败:', file.name, err);
            }
        }

        finalizeInstallAndRefresh();
        showInstallDoneDialog(t('install.importSuccess').replace('{count}', successCount));
    }

    // ================================================================
    // 模块 4 · Mod 元数据与 Schema 解析 → modloader/modMetadata.js
    // ----------------------------------------------------------------
    // 含：4.1 note 换行归一 · 4.2 Schema 默认值 · 4.3 头部标签解析 ·
    //     4.4 配置回填（applyModConfigToEntry）
    // 依赖：模块 1/2、modloader/paramTypeKit、modloader/dependencyResolver
    // ================================================================

    const dependencyResolver = createDependencyResolver({
        fs,
        log,
        t,
        pluginsPath: PLUGINS_PATH
    });

    const {
        parseDependencyList,
        getGamePluginInfo,
        checkModDependencies,
        isBaseLoadGuardSatisfied
    } = dependencyResolver;

    const modMetadataDeps = {
        fs,
        pathMod,
        paramTypeKit,
        log,
        t,
        parseDependencyList,
        resolveModConfigEntry,
        normalizeSingleParamValue: null
    };
    const modMetadata = createModMetadata(modMetadataDeps);

    const {
        normalizeNoteNewlines,
        normalizeNoteFieldsInStructParam,
        parseModInfo,
        applyModConfigToEntry
    } = modMetadata;

    const {
        isValidColor,
        sanitizeText,
        isDatabaseType,
        isNoteType,
        calculateStep,
        getDbLabel: getDbLabelRaw,
        getDatabaseEntryName,
        normalizeDatabaseCollection
    } = paramTypeKit;

    function getDbLabel(type) {
        return getDbLabelRaw(type, t);
    }

    const paramValues = createParamValues({
        paramTypeKit,
        normalizeNoteNewlines,
        normalizeNoteFieldsInStructParam
    });
    modMetadataDeps.normalizeSingleParamValue = paramValues.normalizeSingleParamValue;

    const {
        normalizeColorField,
        normalizeTextField,
        normalizeSingleParamValue,
        buildModFinalParameters,
        buildFinalParametersFromValues
    } = paramValues;

    /** 参数 UI 在浏览器上下文；子模块 require 作用域须显式传入 window */
    function getDatabaseArray(type) {
        const root = typeof window !== 'undefined' ? window : globalThis;
        return paramTypeKit.getDatabaseArray(type, root);
    }

    const scanPipeline = createScanPipeline({
        fs,
        pathMod,
        log,
        ensureDir,
        discoverPackageScripts,
        applyModConfigToEntry,
        modCatalog,
        workshopBridge,
        loadWorkshopConfig,
        localmodsDir: LOCALMODS_DIR,
        workshopBridgeDir: WORKSHOP_BRIDGE_DIR
    });

    const { scanLocalMods, scanWorkshopMods, mergeScanResults } = scanPipeline;

    // ================================================================
    // 模块 5 · 扫描 / 依赖 / 运行时加载
    // ----------------------------------------------------------------
    // 含：5.1 工坊桥接（→ modloader/workshopBridge.js + scanPipeline.js） ·
    //     5.2 本地 Mod 预览（路径/版本 → modloader/modCatalog.js） ·
    //     5.3 扫描主流程（→ modloader/scanPipeline.js） ·
    //     5.4 依赖检测 · 5.5 运行时加载与启动钩子
    // 依赖：模块 1（路径）、模块 2（配置）、模块 4（元数据）；
    //       buildModFinalParameters → modloader/paramValues.js
    // ================================================================

    // ---- 5.2 本地 Mod 预览（路径/ID/排序/缩略图；规则 → modloader/modCatalog.js） ----
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

    // ---- 5.3 扫描主流程（→ modloader/scanPipeline.js） ----
    function scanAllMods() {
        ensureModLoaderConfigFile();
        invalidateWorkshopConfigCache();
        const config = loadConfig();
        const orderState = { next: getConfigMaxOrder(config) + 1 };
        return mergeScanResults(
            scanLocalMods(config, orderState),
            scanWorkshopMods(config, orderState)
        );
    }

    /**
     * 重新分配模组的连续顺序号（无参时使用当前 _modData）
     */
    function reassignOrders(modList) {
        if (!modList) modList = _modData;
        modCatalog.reassignOrders(modList);
    }

    // ---- 5.4 依赖检测 + 脚本基名冲突（规则子模块；缓存与 UI 留主文件） ----

    /**
     * 缓存的依赖检测结果
     */
    let _dependencyCache = {};

    /** 脚本基名冲突（与 @base 依赖检测独立） */
    let _pluginNameConflictCache = {};

    const { resolvePluginNameConflicts, wouldModBeEffectiveIfEnabled } = pluginNameConflict;

    /**
     * 刷新依赖检测与脚本基名冲突缓存并更新 UI
     */
    function refreshDependencyCheck() {
        _dependencyCache = checkModDependencies(_modData);
        _pluginNameConflictCache = resolvePluginNameConflicts(_modData, getGamePluginInfo());
        log(3, '依赖检测完成，结果:', JSON.stringify(_dependencyCache));
    }

    function getModDepStatus(mod) {
        if (!mod || !mod.id) return { baseDetails: [], orderAfterDetails: [], baseWarning: false, orderAfterWarning: false };
        return _dependencyCache[mod.id] || { baseDetails: [], orderAfterDetails: [], baseWarning: false, orderAfterWarning: false };
    }

    function getModPluginNameConflict(mod) {
        if (!mod || !mod.id) return null;
        return _pluginNameConflictCache[mod.id] || null;
    }

    /** 列表/详情：同名冲突说明（红字） */
    function formatPluginNameConflictLabel(conflict) {
        if (!conflict || !conflict.hasConflict) return '';
        const parts = [];
        if (conflict.gameName) {
            if (conflict.gameEnabled) {
                parts.push(t('conflict.withGameEnabled').replace('{name}', conflict.gameName));
            } else {
                parts.push(t('conflict.withGameDisabled').replace('{name}', conflict.gameName));
            }
        }
        if (conflict.otherModOrders && conflict.otherModOrders.length > 0) {
            const ordersText = conflict.otherModOrders.map((o) => String(o)).join(t('conflict.separator'));
            parts.push(t('conflict.withModOrders').replace('{orders}', ordersText));
        }
        return parts.join(t('conflict.separator'));
    }

    function formatPluginNameConflictRule(conflict) {
        if (!conflict || !conflict.hasConflict) return '';
        if (conflict.gameEnabled) {
            return t('conflict.ruleGameWins').replace('{name}', conflict.gameName || conflict.pluginBaseName);
        }
        return t('conflict.ruleModLowestOrder');
    }

    /** 列表状态：未开启 / 生效 / 不生效 */
    function getModPluginNameConflictListStatus(mod, conflict) {
        if (!conflict || !conflict.hasConflict) return null;
        if (!mod.status) return 'off';
        if (conflict.gameEnabled) return 'ineffective';
        return conflict.isEffective ? 'effective' : 'ineffective';
    }

    function formatPluginNameConflictListStatus(mod, conflict) {
        const status = getModPluginNameConflictListStatus(mod, conflict);
        if (status === 'off') return t('conflict.statusOff');
        if (status === 'effective') return t('conflict.statusEffective');
        if (status === 'ineffective') return t('conflict.statusIneffective');
        return '';
    }

    // buildModFinalParameters → modloader/paramValues.js（模块 4 已注入）

    // ---- 5.5 运行时加载与启动钩子（loadEnabledModsRuntime / bootstrapModLoaderReady / installBootstrapHooks / cleanupLegacyModEntriesFromPluginsJs） ----

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

            // @base 依赖守卫：如果 @base 声明的依赖未启用，跳过加载以防崩溃
            if (mod.baseList && mod.baseList.length > 0) {
                const pendingModNames = enabled.map(function(e) {
                    return typeof Utils !== 'undefined'
                        ? Utils.extractFileName(e.loadPath || e.id)
                        : e.displayName;
                });
                const guard = isBaseLoadGuardSatisfied(
                    mod.baseList,
                    PluginManager._scripts,
                    pendingModNames
                );
                if (!guard.satisfied) {
                    const skipName = typeof Utils !== 'undefined'
                        ? Utils.extractFileName(loadPath)
                        : mod.displayName;
                    log(1, `[依赖守卫] 跳过 ${skipName}：@base 依赖 "${guard.missingBase}" 未启用`);
                    continue;
                }
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
    // 模块 6 · UI / 渲染 / 启动 / 扩展宿主
    // ----------------------------------------------------------------
    // 含：6.1 共享工具（6.1.1 wheel · 6.1.2 校验/bind* 留主文件；类型/DB 工具 → modloader/paramTypeKit.js） ·
    //     6.2 CSS 样式 · 6.3 DOM UI 主面板 · 6.4 参数编辑器 · 6.5 标题按钮 ·
    //     6.6 键盘快捷键 · 6.7 初始化 · 6.8 扩展 API（冲突日志 / ManagerGate / libs）
    // 体积最大；拆文件时注意 6.1 被模块 4/5 共用，不可当作纯 UI 搬走。
    // ================================================================

    // ---- 6.1 共享工具（DOM 校验/滚动 + 类型工具 re-export 自 modloader/paramTypeKit） ----

    // ---- 6.1.1 滚动容器 wheel 绑定（防止被 RMMZ 拦截冒泡） ----
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

    /**
     * cssEscape 兼容性 polyfill
     * 用于将参数名转为合法 CSS ID
     */
    function cssEscape(str) {
        if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(str);
        // 简易 fallback：替换非字母数字字符
        return str.replace(/[^a-zA-Z0-9_-]/g, '_');
    }
    
    // ---- 6.1.2 通用输入验证与安全（顶层 / struct / table 共用；依赖 paramTypeKit.isValidColor / sanitizeText） ----

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
        const result = normalizeNumberField(inputEl.value, opts);
        if (result !== inputEl.value.trim()) {
            log(3, `[validateNumber] 修正为: ${result}`);
        }
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
        const result = normalizeColorField(textInputEl.value, fallback);
        if (result !== textInputEl.value.trim()) {
            log(3, `[validateColor] 修正为: ${result}`);
        }
        textInputEl.value = result;
        if (colorInputEl) {
            colorInputEl.value = result.startsWith('#') ? result : '#ffffff';
        }
        return result;
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
        const result = normalizeTextField(inputEl.value, fallback);
        if (result !== inputEl.value) {
            log(3, `[validateText] 文本已净化，移除了潜在危险内容`);
        }
        inputEl.value = result;
        return result;
    }

    // isValidColor / sanitizeText → modloader/paramTypeKit.js（模块 4 已 re-export）

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

    // isValidColor / sanitizeText / 类型与数据库工具 → modloader/paramTypeKit.js（模块 4 已 re-export）

    /**
     * HTML 转义，防止 XSS
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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

    // ---- 6.2 CSS 样式注入（主题/布局） ----
    // 样式唯一来源：config/modloader.css（无内置 fallback，缺失时仅打日志）
    function injectStyles() {
            const mlConfig = loadModLoaderConfig();
            _currentTheme = mlConfig.ml_theme || 'dark';
            document.documentElement.setAttribute('data-ml-theme', _currentTheme);

            if (document.getElementById('ml-styles')) {
                log(3, 'CSS 样式已存在，已同步主题配置: ' + _currentTheme);
                return;
            }

            const cssPath = pathMod.join(MODS_DIR, 'config', 'modloader.css');
            let cssContent = null;
            try {
                if (fs.existsSync(cssPath)) {
                    cssContent = fs.readFileSync(cssPath, 'utf-8');
                }
            } catch (e) {
                log(1, '读取外部 CSS 文件失败: ' + e.message);
            }

            if (!cssContent) {
                log(1, 'CSS 文件缺失或为空，跳过样式注入（请检查 config/modloader.css）: ' + cssPath);
                return;
            }

            const styleEl = document.createElement('style');
            styleEl.id = 'ml-styles';
            styleEl.textContent = cssContent;
            document.head.appendChild(styleEl);

            log(3, 'CSS 样式注入完成，当前主题: ' + _currentTheme);
        }

    // ---- 6.3 DOM UI 系统（主面板：列表/详情/工具栏/主题/更新日志/语言） ----
    let _overlay = null;       // 主遮罩层
    let _modalOverlay = null;  // 参数编辑模态遮罩
    let _modData = [];         // 当前模组数据
    let _selectedIndex = -1;   // 当前选中索引
    let _needsRestart = false; // 是否需要重启提示
    let _titleBtnWrap = null; // 标题画面按钮容器（含角标）
    let _titleBtn = null;     // 标题画面按钮
    let _hasUnsavedChanges = false; // 是否有未保存的修改
    let _confirmModal = null;  // 确认对话框
    let _changelogModal = null; // 更新日志弹窗
    let _dragEnabled = false;  // 拖拽功能是否启用（默认关闭）
    // 排序拖拽动画时长（可调：改这里即可手感微调）
    const SORT_ANIM = {
        thresholdPx: 5,   // 按下后移动超过该像素才提起
        slideMs: 100,     // 其他行让位过渡
        releaseMs: 280    // 松手后对齐空位 + 消光圈（建议 ≤300）
    };
    let _sortDrag = null;         // 自定义排序拖拽状态
    let _suppressListClick = false; // 拖拽后抑制一次列表 click
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
            <div class="ml-header-left">
                <span class="ml-settings-gear-wrap">
                    <span class="ml-settings-update-badge" id="ml-settings-update-badge" style="display:none;"></span>
                    <span class="ml-settings-gear" id="ml-settings-gear" title="${t('settings')}">⚙</span>
                    <span class="ml-settings-conflict-badge" id="ml-settings-conflict-badge" style="display:none;">!</span>
                </span>
                <h2>${t('title')}</h2>
                <span class="ml-header-meta">
                    ${t('author')} ${VERSION} <a class="ml-changelog-link" id="ml-changelog-link">${t('changelog')}</a>
                </span>
                <div class="ml-settings-card" id="ml-settings-card" style="display:none;">
                    <div class="ml-settings-item" id="ml-settings-lang-item">
                        <label class="ml-settings-label">${t('language.label')}</label>
                        <select class="ml-form-select ml-settings-select" id="ml-language-select"></select>
                    </div>
                    <div class="ml-settings-item" id="ml-settings-theme-item">
                        <label class="ml-settings-label">${t('settings.theme')}</label>
                        <div class="ml-settings-theme-btns">
                            <button class="ml-settings-theme-btn" id="ml-theme-btn-dark" data-theme="dark">${t('theme.dark')}</button>
                            <button class="ml-settings-theme-btn" id="ml-theme-btn-warm" data-theme="warm">${t('theme.warm')}</button>
                        </div>
                    </div>
                    <div class="ml-settings-log-entries" id="ml-settings-log-entries"></div>
                </div>
            </div>
                    <div class="ml-header-info">
                        <button class="ml-btn ml-btn-secondary ml-btn-header" id="ml-btn-disable-all">${t('button.disableAll')}</button>
                        <button class="ml-btn ml-btn-secondary ml-btn-header" id="ml-btn-install">${t('button.installMod')}</button>
                        <button class="ml-btn ml-btn-secondary ml-btn-header" id="ml-btn-delete">${t('button.deleteMod')}</button>
                        <button class="ml-btn ml-btn-secondary ml-btn-header" id="ml-btn-sort">${t('button.sortMod')}</button>
                        <span class="ml-badge ml-badge-success" id="ml-enabled-count">${t('count.enabled')}: 0</span>
                        <span class="ml-badge ml-badge-warning" id="ml-total-count">${t('count.total')}: 0</span>
                    </div>
                </div>
                <div class="ml-content">
                    <div class="ml-list-panel">
                        <div class="ml-list-toolbar" id="ml-list-toolbar">
                            <div class="ml-filter-tabs" id="ml-filter-tabs">
                                <button class="ml-btn ml-btn-secondary ml-btn-sm ml-filter-btn active" data-filter="all">${t('tab.all')}</button>
                                <button class="ml-btn ml-btn-secondary ml-btn-sm ml-filter-btn" data-filter="local">${t('tab.local')}</button>
                                <button class="ml-btn ml-btn-secondary ml-btn-sm ml-filter-btn" data-filter="workshop">${t('tab.workshop')}</button>
                            </div>
                            <button class="ml-btn ml-btn-secondary ml-btn-sm" id="ml-btn-refresh-workshop">${t('workshop.refresh')}</button>
                        </div>
                        <div class="ml-list-header">
                            <span class="ml-list-header-side">${t('list.headerOrder')}</span>
                            <span>${t('list.headerModList')}</span>
                            <span class="ml-list-header-side">${t('list.headerClickGear')}</span>
                        </div>
                        <div class="ml-list-scroll" id="ml-list-scroll"></div>
                    </div>
                    <div class="ml-detail-panel" id="ml-detail-panel">
                        <div class="ml-detail-empty">${t('detail.empty')}</div>
                    </div>
                </div>
                <div class="ml-footer">
                    <div class="ml-footer-hints">
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
                <div class="ml-log-panel" id="ml-log-panel" style="display:none;">
                    <div class="ml-log-panel-header">
                        <h3 id="ml-log-panel-title"></h3>
                        <button type="button" class="ml-log-panel-close" id="ml-log-panel-close" title="关闭">&times;</button>
                    </div>
                    <div class="ml-log-panel-body" id="ml-log-panel-body"></div>
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

        const logPanelClose = document.getElementById('ml-log-panel-close');
        if (logPanelClose) {
            logPanelClose.addEventListener('click', function(e) {
                e.stopPropagation();
                _closeLogPanel();
            });
        }

        const filterTabs = document.getElementById('ml-filter-tabs');
        if (filterTabs) {
            filterTabs.addEventListener('click', function(e) {
                const btn = e.target.closest('[data-filter]');
                if (!btn) return;
                _listFilter = btn.dataset.filter || 'all';
                filterTabs.querySelectorAll('.ml-filter-btn').forEach(function(b) {
                    b.classList.toggle('active', b === btn);
                });
                onListFilterChanged();
            });
        }

        const refreshWorkshopBtn = document.getElementById('ml-btn-refresh-workshop');
        if (refreshWorkshopBtn) {
            refreshWorkshopBtn.addEventListener('click', refreshWorkshopMods);
        }
        
        // 绑定更新日志链接
        const changelogLink = document.getElementById('ml-changelog-link');
        if (changelogLink) {
            changelogLink.addEventListener('click', function(e) {
                e.stopPropagation();
                showChangelog();
            });
        }
        
        // 绑定系统设置齿轮
        const settingsGear = document.getElementById('ml-settings-gear');
        const settingsCard = document.getElementById('ml-settings-card');
        if (settingsGear && settingsCard) {
            settingsGear.addEventListener('click', function(e) {
                e.stopPropagation();
                if (settingsCard.style.display === 'none') {
                    _refreshSettingsBadges();
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
        const langSelect = document.getElementById('ml-language-select');
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
        const themeBtnDark = document.getElementById('ml-theme-btn-dark');
        const themeBtnWarm = document.getElementById('ml-theme-btn-warm');
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
        if (!runManagerGates()) return;

        ensureModLoaderConfigFile();
        const mlConfig = loadModLoaderConfig();
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

        // 进入管理器时检测依赖
        refreshDependencyCheck();
        // 依赖检测完成后重新渲染列表以显示警告颜色
        renderModList();

        overlay.style.display = 'flex';
        const filterTabs = document.getElementById('ml-filter-tabs');
        if (filterTabs) {
            filterTabs.querySelectorAll('.ml-filter-btn').forEach(function(b) {
                b.classList.toggle('active', b.dataset.filter === 'all');
            });
        }
        bindModLoaderScrollContainers();
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

        _refreshSettingsLogMenu();
        _refreshConflictBadge();
    }



    /**
     * 隐藏模组管理器
     */
    function hideModManager() {
        log(3, "=== hideModManager 开始 ===");
        cancelSortDrag();
        
        if (_overlay) {
            _overlay.style.display = 'none';
        }

        _closeLogPanel();
        
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
     * 刷新 Mod 列表（scanAllMods：本地 + 工坊全量重扫）
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
        log(3, 'Mod 列表已刷新');
    }

    function isWorkshopFeatureEnabled() {
        return !!loadWorkshopConfig().enabled;
    }

    function updateWorkshopToolbarState() {
        // 「刷新列表」对本地/工坊均有效，始终显示
        const refreshBtn = document.getElementById('ml-btn-refresh-workshop');
        if (refreshBtn) {
            refreshBtn.style.display = '';
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
            cancelSortDrag();
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
                if (mod.source === 'workshop') {
                    item.title = t('workshop.sourceHintManage') + '\n' + t('workshop.sourceHintSubscribe');
                }

                const hasParams = mod.params && mod.params.length > 0;
                
                let orderHtml;
                if (_dragEnabled) {
                    orderHtml = `<input type="number" class="ml-order-input" value="${mod.order}" min="1" max="${_modData.length}" data-index="${index}">`;
                } else {
                    orderHtml = `<div class="ml-order-text" data-index="${index}">${mod.order}</div>`;
                }

                let deleteHtml = '';
                if (_deleteMode && !mod.readOnly) {
                    deleteHtml = `<div class="ml-delete-btn" data-action="delete" data-index="${index}">🗑️</div>`;
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
                    workshopBadge = `<span class="ml-badge ml-badge-warning ml-badge-sm" title="${escapeHtml(t('workshop.badge'))}">${t('workshop.badge')}</span>`;
                }

                let installWarn = '';
                if (mod.installState === 'missing') {
                    installWarn = `<span class="ml-install-warn" title="${escapeHtml(t('workshop.missing'))}">⚠</span>`;
                } else if (mod.installState === 'unsubscribed') {
                    installWarn = `<span class="ml-install-warn" title="${escapeHtml(t('workshop.unsubscribed'))}">○</span>`;
                }

                const nameConflict = getModPluginNameConflict(mod);
                let nameConflictHtml = '';
                if (nameConflict && nameConflict.hasConflict) {
                    const conflictLabel = formatPluginNameConflictLabel(nameConflict);
                    const conflictRule = formatPluginNameConflictRule(nameConflict);
                    const statusText = formatPluginNameConflictListStatus(mod, nameConflict);
                    const listStatus = getModPluginNameConflictListStatus(mod, nameConflict);
                    const title = conflictLabel + '\n' + conflictRule;
                    nameConflictHtml = `<span class="ml-name-conflict" title="${escapeHtml(title)}">${escapeHtml(conflictLabel)}</span>`;
                    if (statusText) {
                        nameConflictHtml += `<span class="ml-name-conflict-status ml-name-conflict-status-${listStatus}">${escapeHtml(statusText)}</span>`;
                    }
                    if (listStatus === 'ineffective') {
                        itemClass += ' ml-plugin-ineffective';
                    }
                }

                item.innerHTML = `
                    ${orderHtml}
                    <div class="ml-toggle ${mod.status ? 'on' : ''}" data-action="toggle" data-index="${index}">
                        <div class="${thumbClass}"></div>
                    </div>
                    <div class="ml-mod-name" data-action="select" data-index="${index}">
                        ${parseColorTagsFromRaw(mod.displayName)}${workshopBadge}${installWarn}${nameConflictHtml}
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

        container.classList.toggle('ml-sort-enabled', _dragEnabled);

        // 事件委托（仅绑定一次）
        if (!container._mlListenerAdded) {
            container.addEventListener('click', handleListClick);
            // 序号输入事件
            container.addEventListener('input', handleOrderInput);
            container.addEventListener('blur', handleOrderBlur, true);
            container.addEventListener('keydown', handleOrderKeydown, true);
            // 排序拖拽（实现见 6.3.1）
            container.addEventListener('mousedown', handleSortMouseDown);
            container._mlListenerAdded = true;
        }
    }

    /**
     * 列表点击事件处理（事件委托）
     */
    function handleListClick(e) {
        if (_suppressListClick || (_sortDrag && _sortDrag.phase !== 'pending')) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
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

        // 开启时检测依赖与同名冲突，按具体原因弹框确认
        if (newStatus) {
            let warningMsg = '';
            const depStatus = getModDepStatus(mod);
            const nameConflict = getModPluginNameConflict(mod);

            if (nameConflict && nameConflict.hasConflict) {
                warningMsg += `⚠️ ${t('conflict.detailTitle')}：\n`;
                warningMsg += `  • ${formatPluginNameConflictLabel(nameConflict)}\n`;
                warningMsg += `  • ${formatPluginNameConflictRule(nameConflict)}\n`;
                if (!wouldModBeEffectiveIfEnabled(mod, _modData, getGamePluginInfo())) {
                    warningMsg += `  • ${t('conflict.enableWillNotWin')}\n`;
                }
                warningMsg += '\n';
            }

            if (depStatus.baseWarning || depStatus.orderAfterWarning) {
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
            }

            if (warningMsg) {
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
     * 实际执行模组开关切换
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

        // 开关变化后刷新依赖检测（其他 Mod 可能依赖此 Mod）
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
            // 全关后刷新依赖检测
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

        const DT = {
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
                <div class="ml-detail-section ml-detail-section-clear">
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
                                    if (id > 0 && id < dbArray.length && dbArray[id] != null) {
                                        const entryName = getDatabaseEntryName(dbArray[id]);
                                        if (entryName) displayVal = `${curVal}: ${entryName}`;
                                    }
                                }
                            } else if (p.type === 'struct') {
                                // struct：详情页显示字段摘要
                                typeLabel = DT.typeStruct;
                                try {
                                    const obj = typeof curVal === 'string' ? JSON.parse(curVal) : curVal;
                                    const keys = Object.keys(obj || {});
                                    displayVal = `{${keys.length}字段: ${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}}`;
                                } catch (e) {
                                    displayVal = String(curVal).substring(0, 40);
                                }
                            } else if (p.type === 'table') {
                                // table：详情页显示行数摘要
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
        const packageVersion = resolvePackageVersion(mod);
        const showModChangelogLink = canShowModChangelog(mod);
        if (packageVersion) {
            const changelogLinkHtml = showModChangelogLink
                ? ' <a class="ml-changelog-link" id="ml-mod-changelog-link">' + escapeHtml(t('detail.changelog')) + '</a>'
                : '';
            metaHtml += `
                <div class="ml-detail-section">
                    <div class="ml-detail-label">${DT.labelVersion}</div>
                    <div class="ml-detail-value">${escapeHtml(packageVersion)}${changelogLinkHtml}</div>
                </div>
            `;
        }
        // @base 依赖显示（5 种状态，带原因文本）
        if (mod.base) {
            const depStatus = getModDepStatus(mod);
            const baseItems = (depStatus.baseDetails || []).map(detail => {
                const isPass = detail.status === 'pass';
                // 根据状态选择图标和颜色
                let icon, colorClass;
                if (isPass) {
                    icon = '<span class="ml-icon-pass">✔</span>';
                    colorClass = 'ml-dep-text-pass';
                } else {
                    // 所有非pass状态统一用红色❌（@base缺失=崩溃级别）
                    icon = '<span class="ml-icon-fail">❌</span>';
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
        // @orderAfter 依赖显示（5 种状态，带原因文本）
        if (mod.orderAfter) {
            const depStatus = getModDepStatus(mod);
            const orderAfterItems = (depStatus.orderAfterDetails || []).map(detail => {
                const isPass = detail.status === 'pass';
                let icon, colorClass;
                if (isPass) {
                    icon = '<span class="ml-icon-pass">✔</span>';
                    colorClass = 'ml-dep-text-pass';
                } else {
                    // @orderAfter缺失=失效级别，用黄色❌
                    icon = '<span class="ml-icon-fail">❌</span>';
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
            // F-1 注：@orderBefore 仅作为玩家参考展示，不做强制校验。
            // 实际加载顺序的硬性保护由 @base / @orderAfter 的前置 mod 依赖检测承担（行业通用做法）。
            metaHtml += `
                <div class="ml-detail-section">
                    <div class="ml-detail-label">${DT.labelOrderBefore}</div>
                    <div class="ml-detail-value">${escapeHtml(mod.orderBefore)}<span class="ml-detail-hint">（仅供玩家参考）</span></div>
                </div>
            `;
        }

        const nameConflict = getModPluginNameConflict(mod);
        if (nameConflict && nameConflict.hasConflict) {
            const conflictLabel = formatPluginNameConflictLabel(nameConflict);
            const conflictRule = formatPluginNameConflictRule(nameConflict);
            const statusText = formatPluginNameConflictListStatus(mod, nameConflict);
            let conflictValue = escapeHtml(conflictLabel);
            if (statusText) {
                conflictValue += ' <span class="ml-name-conflict-status">' + escapeHtml(statusText) + '</span>';
            }
            conflictValue += '<div class="ml-conflict-reason">' + escapeHtml(conflictRule) + '</div>';
            metaHtml += `
                <div class="ml-detail-section">
                    <div class="ml-detail-label ml-conflict-label">${escapeHtml(t('conflict.detailTitle'))}</div>
                    <div class="ml-detail-value ml-conflict-value">${conflictValue}</div>
                </div>
            `;
        }

        let workshopHtml = '';
        if (mod.source === 'workshop') {
            workshopHtml = `
                <div class="ml-detail-section">
                    <div class="ml-detail-label">${escapeHtml(t('detail.labelSource'))}</div>
                    <div class="ml-detail-value">${escapeHtml(t('detail.sourceWorkshop'))}</div>
                </div>
                <div class="ml-detail-section">
                    <div class="ml-detail-label">${escapeHtml(t('detail.labelWorkshopRoot'))}</div>
                    <div class="ml-detail-value ml-detail-value-path">${escapeHtml(mod.workshopRoot || '')}</div>
                </div>
            `;
        } else if (mod.source === 'local') {
            workshopHtml = `
                <div class="ml-detail-section">
                    <div class="ml-detail-label">${escapeHtml(t('detail.labelSource'))}</div>
                    <div class="ml-detail-value">${escapeHtml(t('detail.sourceLocal'))}</div>
                </div>
            `;
            if (mod.loadPath) {
                workshopHtml += `
                    <div class="ml-detail-section">
                        <div class="ml-detail-label">${escapeHtml(t('detail.labelFile'))}</div>
                        <div class="ml-detail-value ml-detail-value-path">${escapeHtml(mod.loadPath)}</div>
                    </div>
                `;
            }
        }

        const workshopPreviewHtml = buildModPreviewHtml(mod);

        // 预览图右浮动（见 CSS），名字与来源等字段紧挨排列，不再与预览同高留白
        panel.innerHTML = `
            ${workshopPreviewHtml}
            <div class="ml-detail-section">
                <div class="ml-detail-label">${DT.labelModName}</div>
                <div class="ml-detail-value">${parseColorTagsFromRaw(mod.displayName)}</div>
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
                    <span class="ml-badge ${mod.status ? 'ml-badge-success' : 'ml-badge-danger'}">
                        ${mod.status ? DT.statusEnabled : DT.statusDisabled}
                    </span>
                </div>
            </div>
            ${paramsHtml}
            <div class="ml-detail-section ml-detail-section-clear">
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

        const modChangelogLink = panel.querySelector('#ml-mod-changelog-link');
        if (modChangelogLink) {
            modChangelogLink.addEventListener('click', function(e) {
                e.stopPropagation();
                showModChangelog(mod);
            });
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
     * mod_config 唯一写入路径：从当前 _modData 全量重写（无 merge、无 legacy 键残留）
     */
    function persistModListToConfig() {
        saveConfig(serializeModListToConfig(_modData));
    }

    function getLocalModsInPackage(packageName) {
        if (!packageName) return [];
        return _modData.filter(m => m.source === 'local' && m.localPackageName === packageName);
    }

    /**
     * 保存所有修改（UI 入口；内部走 persistModListToConfig）
     */
    function saveAllChanges() {
        persistModListToConfig();
        _needsRestart = true;
        _hasUnsavedChanges = false;
        updateRestartHint();
        updateSaveButton();
        log(3, "所有修改已保存");
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
            <div class="ml-modal ml-modal-confirm">
                <div class="ml-modal-header">
                    <h3>${escapeHtml(title)}</h3>
                </div>
                <div class="ml-modal-body">
                    <p class="ml-confirm-message">${escapeHtml(message)}</p>
                </div>
                <div class="ml-modal-footer">
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
        const newTheme = _currentTheme === 'dark' ? 'warm' : 'dark';
        setTheme(newTheme);
        updateThemeButtons();
    }

    function updateThemeButtons() {
        const btnDark = document.getElementById('ml-theme-btn-dark');
        const btnWarm = document.getElementById('ml-theme-btn-warm');
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
     * 加载 libs/marked.min.js（依赖库，非扩展脚本）
     */
    let _markedLoaded = false;
    function loadMarkedLibrary() {
        if (_markedLoaded && typeof marked !== 'undefined') return true;
        if (typeof marked !== 'undefined') {
            _markedLoaded = true;
            return true;
        }
        try {
            const libPath = pathMod.join(LIBS_DIR, 'marked.min.js');
            if (!fs.existsSync(libPath)) {
                log(1, 'marked.min.js 不存在: ' + libPath);
                return false;
            }
            const code = fs.readFileSync(libPath, 'utf-8');
            const script = document.createElement('script');
            script.textContent = code;
            document.head.appendChild(script);
            _markedLoaded = typeof marked !== 'undefined';
            if (_markedLoaded) log(3, 'marked.js 加载成功');
            else log(1, 'marked.js 注入后全局 marked 仍不可用');
            return _markedLoaded;
        } catch (e) {
            log(1, '加载 marked.js 失败:', e.message);
            return false;
        }
    }

    /**
     * Markdown → HTML（优先 libs/marked.min.js；缺失时纯文本回退）
     */
    function parseMarkdownToHtml(md) {
        if (!md) return '';
        if (!loadMarkedLibrary()) {
            return '<pre class="ml-changelog-fallback">' + escapeHtml(md) + '</pre>';
        }
        try {
            marked.setOptions({
                gfm: true,
                breaks: false,
                pedantic: false
            });
            return marked.parse(md);
        } catch (e) {
            log(1, 'marked 解析失败:', e.message);
            return '<pre class="ml-changelog-fallback">' + escapeHtml(md) + '</pre>';
        }
    }

    /**
     * 公用更新日志弹窗（管理器自身 / Mod 详情 / 商店均可复用）
     * @param {string} title
     * @param {string} body  markdown 或纯文本
     * @param {{mode?: 'md'|'text'}} [options]  mode 默认 'md'
     */
    function showChangelogModal(title, body, options) {
        options = options || {};
        const mode = options.mode === 'text' ? 'text' : 'md';
        hideChangelogModal();

        const htmlContent = mode === 'text'
            ? '<p>' + escapeHtml(body || '') + '</p>'
            : parseMarkdownToHtml(body);

        _changelogModal = document.createElement('div');
        _changelogModal.className = 'ml-modal-overlay ml-changelog-overlay';
        _changelogModal.innerHTML = '<div class="ml-modal ml-changelog-modal">'
            + '<div class="ml-modal-header">'
            + '<h3>' + escapeHtml(title || '') + '</h3>'
            + '<button type="button" class="ml-modal-close" id="ml-changelog-close">&times;</button>'
            + '</div>'
            + '<div class="ml-modal-body ml-changelog-body">'
            + htmlContent
            + '</div>'
            + '<div class="ml-modal-footer">'
            + '<button type="button" class="ml-btn ml-btn-primary" id="ml-changelog-btn-close">' + t('button.close') + '</button>'
            + '</div>'
            + '</div>';

        _changelogModal.addEventListener('click', function(e) {
            if (e.target.id === 'ml-changelog-close'
                || e.target.id === 'ml-changelog-btn-close'
                || e.target === _changelogModal) {
                hideChangelogModal();
            }
        });

        _changelogModal.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                hideChangelogModal();
            }
        });

        document.body.appendChild(_changelogModal);
    }

    function hideChangelogModal() {
        if (_changelogModal) {
            _changelogModal.remove();
            _changelogModal = null;
        }
    }

    /** 显示管理器自身更新日志 */
    function showChangelog() {
        const changelogPath = pathMod.join(MODS_DIR, 'docs', 'modloader_CHANGELOG.md');
        let mdContent;
        try {
            mdContent = fs.readFileSync(changelogPath, 'utf-8');
        } catch (e) {
            log(1, '无法读取更新日志文件:', e.message);
            return;
        }
        showChangelogModal('ModLoader ' + VERSION + ' ' + t('changelog.title'), mdContent);
    }

    /** 显示当前选中 Mod 包的更新日志（包级 CHANGELOG.md，多脚本共用） */
    function showModChangelog(mod) {
        if (!canShowModChangelog(mod)) return;
        const changelogPath = getPackageChangelogPath(mod);
        const version = resolvePackageVersion(mod);
        const name = getPackageDisplayName(mod);
        let mdContent;
        try {
            mdContent = fs.readFileSync(changelogPath, 'utf-8');
        } catch (e) {
            log(1, '无法读取 Mod 更新日志:', e.message);
            return;
        }
        const title = t('detail.changelogTitle')
            .replace('{name}', name)
            .replace('{version}', version || '');
        showChangelogModal(title, mdContent);
    }

    function populateLanguageSelect() {
        const select = document.getElementById('ml-language-select');
        if (!select) return;
        select.innerHTML = '';
        const langs = getAvailableLanguages();
        langs.forEach(function(lang) {
            const option = document.createElement('option');
            option.value = lang;
            option.textContent = getLanguageDisplayName(lang);
            if (lang === _currentLanguage) {
                option.selected = true;
            }
            select.appendChild(option);
        });
        const langLabel = document.querySelector('#ml-settings-lang-item .ml-settings-label');
        if (langLabel) langLabel.textContent = t('language.label');
        const themeLabel = document.querySelector('#ml-settings-theme-item .ml-settings-label');
        if (themeLabel) themeLabel.textContent = t('settings.theme');
    }

    function refreshAllUIText() {
        const titleEl = document.querySelector('.ml-header h2');
        if (titleEl) titleEl.textContent = t('title');
        
        const gear = document.getElementById('ml-settings-gear');
        if (gear) gear.title = t('settings');
        
        const saveBtn = document.getElementById('ml-btn-save');
        if (saveBtn) saveBtn.textContent = t('button.save');
        
        const closeBtn = document.getElementById('ml-btn-close');
        if (closeBtn) closeBtn.textContent = t('button.close');
        
        const disableAllBtn = document.getElementById('ml-btn-disable-all');
        if (disableAllBtn) disableAllBtn.textContent = t('button.disableAll');
        
        const installBtn = document.getElementById('ml-btn-install');
        if (installBtn) installBtn.textContent = t('button.installMod');
        
        const deleteBtn = document.getElementById('ml-btn-delete');
        if (deleteBtn) {
            deleteBtn.textContent = _deleteMode ? t('sort.deleteEnabled') : t('sort.deleteDisabled');
        }
        
        const sortBtn = document.getElementById('ml-btn-sort');
        if (sortBtn) {
            sortBtn.textContent = _dragEnabled ? t('sort.enabled') : t('sort.disabled');
            sortBtn.title = isListFilterRestrictingSort() ? t('sort.filterBlockedHint') : '';
        }

        const refreshWorkshopBtn = document.getElementById('ml-btn-refresh-workshop');
        if (refreshWorkshopBtn) refreshWorkshopBtn.textContent = t('workshop.refresh');
        updateWorkshopToolbarState();

        const filterTabs = document.getElementById('ml-filter-tabs');
        if (filterTabs) {
            filterTabs.querySelectorAll('[data-filter]').forEach(function(btn) {
                const filter = btn.dataset.filter;
                if (filter === 'all') btn.textContent = t('tab.all');
                else if (filter === 'local') btn.textContent = t('tab.local');
                else if (filter === 'workshop') btn.textContent = t('tab.workshop');
            });
        }
        
        updateCounts();
        
        const restartHint = document.getElementById('ml-restart-hint');
        if (restartHint && !restartHint.classList.contains('hidden')) {
            restartHint.innerHTML = '&#9888; ' + t('footer.restartHint');
        }
        
        const unsavedHint = document.getElementById('ml-unsaved-indicator');
        if (unsavedHint && !unsavedHint.classList.contains('hidden')) {
            unsavedHint.innerHTML = '&#8226; ' + t('footer.unsaved');
        }
        
        const listOrderEl = document.querySelector('.ml-list-header span:first-child');
        if (listOrderEl) listOrderEl.textContent = t('list.headerOrder');
        const listModEl = document.querySelector('.ml-list-header span:nth-child(2)');
        if (listModEl) listModEl.textContent = t('list.headerModList');
        const listGearEl = document.querySelector('.ml-list-header span:last-child');
        if (listGearEl) listGearEl.textContent = t('list.headerClickGear');
        
        renderModList();
        if (_selectedIndex >= 0 && _selectedIndex < _modData.length) {
            renderDetail(_modData[_selectedIndex]);
        } else {
            const panel = document.getElementById('ml-detail-panel');
            if (panel && _modData.length === 0) {
                panel.innerHTML = '<div class="ml-detail-empty">' + t('detail.empty') + '</div>';
            } else if (panel) {
                panel.innerHTML = '<div class="ml-detail-empty">' + t('detail.empty') + '</div>';
            }
        }
        
        const changelogLink = document.getElementById('ml-changelog-link');
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
            btnSort.classList.remove('ml-btn-secondary', 'ml-btn-sort-blocked', 'ml-btn-sort-active');
            btnSort.title = sortBlocked ? t('sort.filterBlockedHint') : '';
            if (sortBlocked) {
                btnSort.classList.add('ml-btn-secondary', 'ml-btn-sort-blocked');
            } else if (_dragEnabled) {
                btnSort.classList.add('ml-btn-sort-active');
            } else {
                btnSort.classList.add('ml-btn-secondary');
            }
        }
        
        if (btnDelete) {
            btnDelete.textContent = _deleteMode ? t('sort.deleteEnabled') : t('sort.deleteDisabled');
            btnDelete.classList.remove('ml-btn-secondary', 'ml-btn-delete-active');
            if (_deleteMode) {
                btnDelete.classList.add('ml-btn-delete-active');
            } else {
                btnDelete.classList.add('ml-btn-secondary');
            }
        }
    }

    function toggleDrag() {
        if (isListFilterRestrictingSort()) {
            return;
        }
        _dragEnabled = !_dragEnabled;
        if (!_dragEnabled) {
            cancelSortDrag();
        }
        updateButtonStates();
        renderModList();
        log(3, '拖拽功能', _dragEnabled ? '已启用' : '已禁用');
    }

    // ---- 6.3.1 列表排序拖拽（自定义 pointer，非 HTML5 DnD） ----

    function getSortItemTranslateY(el) {
        const t = el.style.transform || '';
        const m = t.match(/translateY\((-?\d+(?:\.\d+)?)px\)/);
        return m ? parseFloat(m[1]) : 0;
    }

    /** 布局中线（去掉 transform，避免让位动画干扰判定） */
    function getSortLayoutMidY(el) {
        const r = el.getBoundingClientRect();
        return r.top - getSortItemTranslateY(el) + r.height / 2;
    }

    function getSortListItems(container) {
        return Array.prototype.slice.call(container.querySelectorAll('.ml-mod-item'));
    }

    /**
     * 用提起块上/下边相对各行中线，计算插入下标
     */
    function computeSortInsertIndex(floatRect, dragIndex, items) {
        let beforeCount = 0;
        for (let i = 0; i < items.length; i++) {
            if (i === dragIndex) continue;
            const mid = getSortLayoutMidY(items[i]);
            if (i < dragIndex) {
                if (!(floatRect.top < mid)) beforeCount++;
            } else if (floatRect.bottom > mid) {
                beforeCount++;
            }
        }
        return beforeCount;
    }

    function applySortSlideTransforms(dragIndex, insertIndex, itemHeight, items) {
        for (let i = 0; i < items.length; i++) {
            if (i === dragIndex) {
                items[i].style.transform = '';
                continue;
            }
            let ty = 0;
            if (insertIndex > dragIndex) {
                if (i > dragIndex && i <= insertIndex) ty = -itemHeight;
            } else if (insertIndex < dragIndex) {
                if (i >= insertIndex && i < dragIndex) ty = itemHeight;
            }
            items[i].style.transform = ty ? ('translateY(' + ty + 'px)') : '';
        }
    }

    function getSortVisualGapTop(dragIndex, insertIndex, itemHeight, items) {
        if (insertIndex === dragIndex) {
            return items[dragIndex].getBoundingClientRect().top;
        }
        if (insertIndex < dragIndex) {
            return items[insertIndex].getBoundingClientRect().top - itemHeight;
        }
        return items[insertIndex].getBoundingClientRect().top + itemHeight;
    }

    function mapSelectedIndexAfterReorder(selected, from, to) {
        if (selected < 0) return selected;
        if (selected === from) return to;
        if (from < to) {
            if (selected > from && selected <= to) return selected - 1;
        } else if (from > to) {
            if (selected >= to && selected < from) return selected + 1;
        }
        return selected;
    }

    function unbindSortDragDocListeners() {
        document.removeEventListener('mousemove', handleSortMouseMove);
        document.removeEventListener('mouseup', handleSortMouseUp);
    }

    function suppressNextListClick() {
        _suppressListClick = true;
        let cleared = false;
        const clear = function(e) {
            if (cleared) return;
            cleared = true;
            if (e) {
                e.stopPropagation();
                e.preventDefault();
            }
            document.removeEventListener('click', clear, true);
            _suppressListClick = false;
        };
        document.addEventListener('click', clear, true);
        setTimeout(function() { clear(null); }, 500);
    }

    function handleSortMouseDown(e) {
        if (!_dragEnabled || e.button !== 0) return;
        if (e.target.closest('.ml-order-input')) return;

        const container = document.getElementById('ml-list-scroll');
        if (!container) return;
        const item = e.target.closest('.ml-mod-item');
        if (!item || !container.contains(item)) return;

        const items = getSortListItems(container);
        const dragIndex = items.indexOf(item);
        if (dragIndex < 0) return;

        _sortDrag = {
            phase: 'pending',
            startX: e.clientX,
            startY: e.clientY,
            dragIndex: dragIndex,
            itemEl: item,
            container: container,
            grabOffsetY: 0,
            insertIndex: dragIndex,
            itemHeight: 0,
            floatEl: null,
            floatLeft: 0,
            _lastClientY: e.clientY,
            _onScroll: null,
            _releaseTimer: null,
            _committed: false
        };

        document.addEventListener('mousemove', handleSortMouseMove);
        document.addEventListener('mouseup', handleSortMouseUp);
    }

    function handleSortMouseMove(e) {
        if (!_sortDrag) return;

        if (_sortDrag.phase === 'pending') {
            const dy = e.clientY - _sortDrag.startY;
            const dx = e.clientX - _sortDrag.startX;
            if (Math.abs(dy) < SORT_ANIM.thresholdPx && Math.abs(dx) < SORT_ANIM.thresholdPx) {
                return;
            }
            beginSortDrag(e);
        }

        if (_sortDrag && _sortDrag.phase === 'dragging') {
            e.preventDefault();
            updateSortDragPosition(e.clientY);
        }
    }

    function beginSortDrag(e) {
        const sd = _sortDrag;
        if (!sd || sd.phase !== 'pending') return;

        const item = sd.itemEl;
        const rect = item.getBoundingClientRect();
        sd.phase = 'dragging';
        sd.itemHeight = rect.height;
        sd.grabOffsetY = e.clientY - rect.top;
        sd.floatLeft = rect.left;
        sd.insertIndex = sd.dragIndex;
        sd._lastClientY = e.clientY;

        suppressNextListClick();

        sd.container.style.setProperty('--ml-sort-slide-ms', SORT_ANIM.slideMs + 'ms');
        sd.container.style.setProperty('--ml-sort-release-ms', SORT_ANIM.releaseMs + 'ms');

        const floatEl = item.cloneNode(true);
        floatEl.classList.remove('selected');
        floatEl.classList.add('ml-sort-float');
        floatEl.style.left = rect.left + 'px';
        floatEl.style.top = rect.top + 'px';
        floatEl.style.width = rect.width + 'px';
        floatEl.style.height = rect.height + 'px';
        floatEl.style.boxSizing = 'border-box';
        document.body.appendChild(floatEl);
        sd.floatEl = floatEl;

        item.classList.add('ml-sort-placeholder');

        const items = getSortListItems(sd.container);
        for (let i = 0; i < items.length; i++) {
            if (items[i] !== item) {
                items[i].classList.add('ml-sort-sliding');
            }
        }
        sd.container.classList.add('ml-sort-dragging');

        sd._onScroll = function() {
            updateSortDragPosition(sd._lastClientY);
        };
        sd.container.addEventListener('scroll', sd._onScroll);

        updateSortDragPosition(e.clientY);
    }

    function updateSortDragPosition(clientY) {
        const sd = _sortDrag;
        if (!sd || sd.phase !== 'dragging' || !sd.floatEl) return;
        sd._lastClientY = clientY;

        const cRect = sd.container.getBoundingClientRect();
        let top = clientY - sd.grabOffsetY;
        const minTop = cRect.top;
        const maxTop = Math.max(minTop, cRect.bottom - sd.itemHeight);
        if (top < minTop) top = minTop;
        if (top > maxTop) top = maxTop;

        sd.floatEl.style.top = top + 'px';
        sd.floatEl.style.left = sd.floatLeft + 'px';

        const floatRect = { top: top, bottom: top + sd.itemHeight };
        const items = getSortListItems(sd.container);
        const newInsert = computeSortInsertIndex(floatRect, sd.dragIndex, items);
        if (newInsert !== sd.insertIndex) {
            sd.insertIndex = newInsert;
            applySortSlideTransforms(sd.dragIndex, sd.insertIndex, sd.itemHeight, items);
        }
    }

    function handleSortMouseUp() {
        unbindSortDragDocListeners();
        if (!_sortDrag) return;

        if (_sortDrag.phase === 'pending') {
            _sortDrag = null;
            return;
        }
        if (_sortDrag.phase === 'dragging') {
            finishSortDragRelease();
        }
    }

    function finishSortDragRelease() {
        const sd = _sortDrag;
        if (!sd || sd.phase !== 'dragging') return;
        sd.phase = 'releasing';

        if (sd._onScroll) {
            sd.container.removeEventListener('scroll', sd._onScroll);
            sd._onScroll = null;
        }

        const items = getSortListItems(sd.container);
        const gapTop = getSortVisualGapTop(sd.dragIndex, sd.insertIndex, sd.itemHeight, items);
        const floatEl = sd.floatEl;

        floatEl.classList.add('ml-sort-releasing');
        void floatEl.offsetHeight;
        floatEl.style.top = gapTop + 'px';
        floatEl.classList.add('ml-sort-release-end');

        const done = function() {
            if (sd._committed) return;
            sd._committed = true;
            floatEl.removeEventListener('transitionend', onEnd);
            if (sd._releaseTimer) {
                clearTimeout(sd._releaseTimer);
                sd._releaseTimer = null;
            }
            commitSortDrag(sd);
        };
        const onEnd = function(ev) {
            if (ev.target !== floatEl) return;
            if (ev.propertyName && ev.propertyName !== 'top' && ev.propertyName !== 'box-shadow' && ev.propertyName !== 'filter') {
                return;
            }
            done();
        };
        floatEl.addEventListener('transitionend', onEnd);
        sd._releaseTimer = setTimeout(done, SORT_ANIM.releaseMs + 60);
    }

    function commitSortDrag(sd) {
        const from = sd.dragIndex;
        const to = sd.insertIndex;

        if (sd.floatEl && sd.floatEl.parentNode) {
            sd.floatEl.parentNode.removeChild(sd.floatEl);
        }
        if (sd.container) {
            sd.container.classList.remove('ml-sort-dragging');
        }
        _sortDrag = null;

        if (from !== to) {
            const draggedMod = _modData[from];
            _modData.splice(from, 1);
            _modData.splice(to, 0, draggedMod);
            reassignOrders();
            _hasUnsavedChanges = true;
            updateSaveButton();
            refreshDependencyCheck();
            _selectedIndex = mapSelectedIndexAfterReorder(_selectedIndex, from, to);
            log(3, '排序已更新');
        }

        renderModList();
        if (_selectedIndex >= 0 && _modData[_selectedIndex]) {
            renderDetail(_modData[_selectedIndex]);
        }
    }

    /** 中断拖拽（关排序 / 关面板），不写入顺序 */
    function cancelSortDrag() {
        unbindSortDragDocListeners();
        const sd = _sortDrag;
        if (!sd) return;

        if (sd._releaseTimer) {
            clearTimeout(sd._releaseTimer);
            sd._releaseTimer = null;
        }
        if (sd._onScroll && sd.container) {
            sd.container.removeEventListener('scroll', sd._onScroll);
        }
        if (sd.floatEl && sd.floatEl.parentNode) {
            sd.floatEl.parentNode.removeChild(sd.floatEl);
        }
        if (sd.container) {
            sd.container.classList.remove('ml-sort-dragging');
            const items = getSortListItems(sd.container);
            for (let i = 0; i < items.length; i++) {
                items[i].style.transform = '';
                items[i].classList.remove('ml-sort-placeholder', 'ml-sort-sliding');
            }
        }
        _sortDrag = null;
        _suppressListClick = false;
    }

    // ---- 6.3.2 序号编辑 ----
    
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
        
        // 序号变动后刷新依赖检测
        refreshDependencyCheck();
        
        // 重新渲染
        renderModList();
        renderDetail(_modData[newOrder - 1]);
        _selectedIndex = newOrder - 1;
        
        log(3, "序号已更新:", currentMod.displayName, "→", newOrder);
    }

    // ---- 6.4 DOM 参数编辑器（struct/table 渲染、数值/颜色/文本校验、收集保存） ----

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

    // ---- 6.4.1 参数控件共用渲染（顶层与 struct 子字段同一套 DOM/CSS） ----

    function numberTypeLabelText(field) {
        const hasMin = field.min !== undefined;
        const hasMax = field.max !== undefined;
        if (hasMin && hasMax) return `${t('param.typeNumber')} (${field.min}~${field.max})`;
        if (hasMin || hasMax) return `${t('param.typeNumber')} (${hasMin ? field.min : '...'}~${hasMax ? field.max : '...'})`;
        return t('param.typeNumber');
    }

    function buildCollectAttrString(opts) {
        const parts = [];
        if (opts.idKey != null) parts.push(`id="ml-param-${cssEscape(opts.idKey)}"`);
        if (opts.dataName != null) parts.push(`data-field-name="${escapeHtml(opts.dataName)}"`);
        if (opts.dataPath != null) parts.push(`data-field-path="${escapeHtml(opts.dataPath)}"`);
        return parts.join(' ');
    }

    /** 数据库下拉选项（含无名空位：显示禁用「(空)」） */
    function buildDbOptionsHtml(dbArray, curVal) {
        let optionsHtml = '<option value="" class="ml-option-muted">' + t('param.none') + '</option>';
        for (let i = 1; i < dbArray.length; i++) {
            const entry = dbArray[i];
            if (entry == null) continue;
            const entryName = getDatabaseEntryName(entry);
            const selected = String(i) === String(curVal) ? ' selected' : '';
            if (entryName) {
                optionsHtml += `<option value="${i}"${selected}>${i}: ${escapeHtml(entryName)}</option>`;
            } else {
                optionsHtml += `<option value="${i}"${selected} disabled class="ml-option-muted">${i}: (空)</option>`;
            }
        }
        return optionsHtml;
    }

    /**
     * 追加数值控件（有 min+max → 滑动条；否则 Min/Max 按钮行）。样式类与顶层共用。
     * @param {object} [opts] idKey / dataName / dataPath / onChange / inputClass
     */
    function appendNumberControl(group, field, curVal, opts = {}) {
        const hasMin = field.min !== undefined;
        const hasMax = field.max !== undefined;
        const hasSlider = hasMin && hasMax;
        const raw = curVal !== undefined && curVal !== '' ? curVal : (field.default || '0');
        const onChange = typeof opts.onChange === 'function' ? opts.onChange : null;
        const collectAttrs = buildCollectAttrString(opts);
        const extraClass = opts.inputClass ? ` ${opts.inputClass}` : '';
        const idKey = opts.idKey;

        if (hasSlider) {
            const step = calculateStep(field);
            const sliderVal = Math.min(Math.max(Number(raw) || 0, field.min), field.max);
            const displayId = idKey != null ? ` id="ml-param-display-${cssEscape(idKey)}"` : '';
            const sliderId = idKey != null ? ` id="ml-param-slider-${cssEscape(idKey)}"` : '';
            group.insertAdjacentHTML('beforeend', `
                <div class="ml-form-slider-row">
                    <div class="ml-form-slider-header">
                        <span class="ml-form-slider-value"${displayId}>${sliderVal}</span>
                    </div>
                    <input type="range" class="ml-form-slider-range"${sliderId}
                           value="${sliderVal}" min="${field.min}" max="${field.max}" step="${step}">
                    <div class="ml-form-slider-bounds">
                        <span>${field.min}</span>
                        <span>${field.max}</span>
                    </div>
                </div>
                <input type="hidden" class="ml-number-value" ${collectAttrs} value="${sliderVal}">
            `);

            const sliderEl = group.querySelector('.ml-form-slider-range');
            const displayEl = group.querySelector('.ml-form-slider-value');
            const hiddenEl = group.querySelector('input.ml-number-value');
            if (!sliderEl || !displayEl || !hiddenEl) return;

            sliderEl.addEventListener('input', () => {
                const val = sliderEl.value;
                displayEl.textContent = val;
                hiddenEl.value = val;
                if (onChange) onChange(String(val));
            });

            displayEl.addEventListener('click', () => {
                const currentVal = Number(hiddenEl.value) || 0;
                const numInput = document.createElement('input');
                numInput.type = 'number';
                numInput.className = 'ml-form-slider-number-input';
                numInput.value = currentVal;
                numInput.min = field.min;
                numInput.max = field.max;
                numInput.step = step;

                displayEl.style.display = 'none';
                displayEl.parentNode.insertBefore(numInput, displayEl.nextSibling);
                numInput.focus();
                numInput.select();
                _isInputFocused = true;

                const finishEdit = () => {
                    _isInputFocused = false;
                    const val = validateNumberInput(numInput, {
                        min: field.min,
                        max: field.max,
                        fallback: String(Number(field.default) || field.min)
                    });
                    displayEl.textContent = val;
                    hiddenEl.value = val;
                    sliderEl.value = val;
                    if (onChange) onChange(val);
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
        } else {
            group.insertAdjacentHTML('beforeend', `
                <div class="ml-form-number-row">
                    <button type="button" class="ml-form-number-btn ml-form-min-btn ${!hasMin ? 'disabled' : ''}"
                            data-action="min" ${!hasMin ? 'disabled' : ''}>
                        ${hasMin ? `Min (${field.min})` : 'Min'}
                    </button>
                    <input type="number" class="ml-form-input ml-form-number-input ml-number-value${extraClass}"
                           ${collectAttrs}
                           value="${escapeHtml(String(raw))}"
                           ${hasMin ? `min="${field.min}"` : ''}
                           ${hasMax ? `max="${field.max}"` : ''}
                           step="${field.step || 1}">
                    <button type="button" class="ml-form-number-btn ml-form-max-btn ${!hasMax ? 'disabled' : ''}"
                            data-action="max" ${!hasMax ? 'disabled' : ''}>
                        ${hasMax ? `Max (${field.max})` : 'Max'}
                    </button>
                </div>
            `);

            const inputEl = group.querySelector('input.ml-number-value');
            if (!inputEl) return;

            inputEl.addEventListener('focus', () => { _isInputFocused = true; });
            inputEl.addEventListener('blur', () => {
                _isInputFocused = false;
                const val = validateNumberInput(inputEl, {
                    min: hasMin ? field.min : undefined,
                    max: hasMax ? field.max : undefined,
                    fallback: field.default || '0'
                });
                if (onChange) onChange(val);
            });
            inputEl.addEventListener('input', () => {
                let num = Number(inputEl.value);
                if (!isNaN(num)) {
                    if (hasMin && num < field.min) num = field.min;
                    if (hasMax && num > field.max) num = field.max;
                    if (onChange) onChange(String(num));
                }
            });

            const minBtn = group.querySelector('[data-action="min"]');
            const maxBtn = group.querySelector('[data-action="max"]');
            if (minBtn && hasMin) {
                minBtn.addEventListener('click', () => {
                    inputEl.value = field.min;
                    if (onChange) onChange(String(field.min));
                });
            }
            if (maxBtn && hasMax) {
                maxBtn.addEventListener('click', () => {
                    inputEl.value = field.max;
                    if (onChange) onChange(String(field.max));
                });
            }
        }
    }

    /**
     * 追加长文本 textarea（note / multiline_string），样式与顶层共用。
     */
    function appendNoteControl(group, field, curVal, opts = {}) {
        const source = curVal !== undefined && curVal !== null ? curVal : (field.default || '');
        const raw = normalizeNoteNewlines(String(source));
        const onChange = typeof opts.onChange === 'function' ? opts.onChange : null;
        const collectAttrs = buildCollectAttrString(opts);
        const extraClass = opts.inputClass ? ` ${opts.inputClass}` : '';

        group.insertAdjacentHTML('beforeend', `
            <textarea class="ml-form-textarea${extraClass}" ${collectAttrs}
                      placeholder="${escapeHtml(field.desc || '')}">${escapeHtml(raw)}</textarea>
        `);

        const textareaEl = group.querySelector('textarea.ml-form-textarea');
        if (!textareaEl) return;

        textareaEl.addEventListener('focus', () => { _isInputFocused = true; });
        textareaEl.addEventListener('blur', () => {
            _isInputFocused = false;
            let value = textareaEl.value;
            if (value === '' || value === undefined || value === null) {
                textareaEl.value = field.default || '';
                if (onChange) onChange(field.default || '');
            } else {
                const sanitized = sanitizeText(value);
                if (sanitized !== value) {
                    textareaEl.value = sanitized;
                    log(3, `[note-validate] 长文本已净化，移除了潜在危险内容`);
                }
                if (onChange) onChange(sanitized);
            }
        });
        textareaEl.addEventListener('input', () => {
            if (onChange) onChange(textareaEl.value);
        });
    }

    // ---- 6.4.2 struct 递归渲染 ----

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
        const fieldPath = parentPath + '.' + field.name;
        const collectOpts = { dataName: field.name, dataPath: fieldPath, inputClass: 'ml-struct-input' };

        if (field.type === 'struct' && field.schema) {
            // ---- 嵌套 struct：递归渲染 ----
            const subSchemaFields = field.schemaFields || [];
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
            details.setAttribute('data-field-path', fieldPath);

            const summary = document.createElement('summary');
            summary.className = 'ml-struct-summary';
            summary.textContent = fieldLabel;
            details.appendChild(summary);

            const structBody = document.createElement('div');
            structBody.className = 'ml-struct-body';
            structBody.setAttribute('data-struct-param', field.name);

            subSchemaFields.forEach(subField => {
                const subVal = structObj[subField.name] !== undefined ? structObj[subField.name] : (subField.default !== undefined ? subField.default : '');
                const subGroup = renderStructField(subField, subVal, depth + 1, fieldPath);
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
                    <input type="checkbox" data-field-name="${escapeHtml(field.name)}" data-field-path="${escapeHtml(fieldPath)}" ${isOn ? 'checked' : ''}>
                    <span class="ml-form-switch-slider"></span>
                </label>
            `;

        } else if (field.type === 'number') {
            group.insertAdjacentHTML('beforeend', `
                <div class="ml-form-label">
                    ${escapeHtml(fieldLabel)}
                    <span class="ml-form-label-type">${numberTypeLabelText(field)}</span>
                </div>
            `);
            appendNumberControl(group, field, curVal, collectOpts);

        } else if (isNoteType(field.type)) {
            group.insertAdjacentHTML('beforeend', `
                <div class="ml-form-label">
                    ${escapeHtml(fieldLabel)}
                    <span class="ml-form-label-type">${t('param.typeNote')}</span>
                </div>
            `);
            appendNoteControl(group, field, curVal, collectOpts);

        } else if (field.type === 'color') {
            // ---- 颜色类型 ----
            const colorVal = String(curVal || field.default || '#ffffff');
            group.innerHTML = `
                <div class="ml-form-label">
                    ${escapeHtml(fieldLabel)}
                    <span class="ml-form-label-type">${t('param.typeColor')}</span>
                </div>
                <div class="ml-color-row ml-color-row-compact">
                    <input type="color" data-field-name="${escapeHtml(field.name)}" data-field-path="${escapeHtml(fieldPath)}"
                           value="${colorVal.startsWith('#') ? colorVal : '#ffffff'}"
                           class="ml-color-swatch">
                    <input type="text" class="ml-form-input ml-struct-input ml-color-text"
                           data-field-name="${escapeHtml(field.name)}" data-field-path="${escapeHtml(fieldPath)}"
                           value="${escapeHtml(colorVal)}" placeholder="#RRGGBB">
                </div>
            `;
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
                        data-field-path="${escapeHtml(fieldPath)}">
                    ${optionsHtml}
                </select>
            `;

        } else if (isDatabaseType(field.type)) {
            // ---- 数据库引用类型 ----
            const dbArray = getDatabaseArray(field.type);
            const dbLabel = getDbLabel(field.type);

            if (dbArray) {
                group.innerHTML = `
                    <div class="ml-form-label">
                        ${escapeHtml(fieldLabel)}
                        <span class="ml-form-label-type">${dbLabel}</span>
                    </div>
                    <select class="ml-form-select ml-struct-select"
                            data-field-name="${escapeHtml(field.name)}"
                            data-field-path="${escapeHtml(fieldPath)}">
                        ${buildDbOptionsHtml(dbArray, curVal)}
                    </select>
                `;
            } else {
                group.innerHTML = `
                    <div class="ml-form-label">
                        ${escapeHtml(fieldLabel)}
                        <span class="ml-form-label-type">${dbLabel} ${t('param.dbFallbackHint')}</span>
                    </div>
                    <input type="text" class="ml-form-input ml-struct-input"
                           data-field-name="${escapeHtml(field.name)}"
                           data-field-path="${escapeHtml(fieldPath)}"
                           value="${escapeHtml(String(curVal || field.default || ''))}"
                           placeholder="${t('param.dbInputPlaceholder').replace('{label}', dbLabel)}">
                `;
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
                       data-field-path="${escapeHtml(fieldPath)}"
                       value="${escapeHtml(String(curVal !== undefined && curVal !== '' ? curVal : (field.default || '')))}">
            `;
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

    // ---- 6.4.3 table 行创建 ----

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
                        if (entry == null) continue;
                        const entryName = getDatabaseEntryName(entry);
                        if (entryName) {
                            const selected = String(i) === String(cellValue) ? ' selected' : '';
                            optionsHtml += `<option value="${i}"${selected}>${i}:${escapeHtml(entryName)}</option>`;
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

    // ---- 6.4.4 struct 数据收集 ----

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
                const holder = fg.querySelector('input.ml-number-value');
                obj[fieldName] = holder ? holder.value : '0';
            } else if (isNoteType(fieldType)) {
                const ta = fg.querySelector('textarea.ml-form-textarea');
                obj[fieldName] = ta
                    ? normalizeNoteNewlines(sanitizeText(ta.value))
                    : '';
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

    // ---- 6.4.5 table 数据收集 ----

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
                group.innerHTML = `
                    <div class="ml-form-label">
                        ${escapeHtml(p.text || p.name)}
                        <span class="ml-form-label-type">${numberTypeLabelText(p)}</span>
                    </div>
                `;
                appendNumberControl(group, p, curVal, {
                    idKey: p.name,
                    onChange: (v) => { editParams[p.name] = v; }
                });
                if (p.desc) {
                    group.insertAdjacentHTML('beforeend', `<div class="ml-form-desc">${escapeHtml(p.desc)}</div>`);
                }
            } else if (p.type === 'color') {
                // 颜色类型
                group.innerHTML = `
                    <div class="ml-form-label">
                        ${escapeHtml(p.text || p.name)}
                        <span class="ml-form-label-type">${t('param.typeColor')}</span>
                    </div>
                    <div class="ml-color-row">
                        <input type="color" 
                               id="ml-param-${cssEscape(p.name)}-color"
                               value="${escapeHtml(String(curVal)).startsWith('#') ? escapeHtml(String(curVal)) : '#ffffff'}"
                               class="ml-color-swatch">
                        <input type="text" class="ml-form-input ml-color-text"
                               id="ml-param-${cssEscape(p.name)}"
                               value="${escapeHtml(String(curVal))}"
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
                group.innerHTML = `
                    <div class="ml-form-label">
                        ${escapeHtml(p.text || p.name)}
                        <span class="ml-form-label-type">${t('param.typeNote')}</span>
                    </div>
                `;
                appendNoteControl(group, p, curVal, {
                    idKey: p.name,
                    onChange: (v) => { editParams[p.name] = v; }
                });
                if (p.desc) {
                    group.insertAdjacentHTML('beforeend', `<div class="ml-form-desc">${escapeHtml(p.desc)}</div>`);
                }
            } else if (isDatabaseType(p.type)) {
                // 数据库引用类型 (actor/class/skill/.../switch/variable)
                const dbLabel = getDbLabel(p.type);
                const dbArray = getDatabaseArray(p.type);

                if (dbArray) {
                    group.innerHTML = `
                        <div class="ml-form-label">
                            ${escapeHtml(p.text || p.name)}
                            <span class="ml-form-label-type">${dbLabel}</span>
                        </div>
                        <select class="ml-form-select" id="ml-param-${cssEscape(p.name)}">
                            ${buildDbOptionsHtml(dbArray, curVal)}
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
                // struct 折叠面板
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
                // table 表格化列表
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
            // 保存前收集 struct/table 数据
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

            const finalParams = buildFinalParametersFromValues(mod.params, editParams);
            mod.params.forEach(p => {
                if (p.type === 'struct' || p.type === 'table') {
                    log(3, `[${p.type}] 参数 "${p.name}" 保存值:`, finalParams[p.name]);
                }
            });
            
            mod.currentParams = { ...finalParams };
            saveAllChanges();

            if (_selectedIndex >= 0 && _modData[_selectedIndex] === mod) {
                renderDetail(mod);
            }

            hideParamEditor();

            log(3, "参数已保存:", mod.displayName, finalParams);
        });

        document.getElementById('ml-modal-reset').addEventListener('click', () => {
            // 恢复默认值
            mod.params.forEach(p => {
                editParams[p.name] = p.default;
                
                // struct / table：一键还原时重绘控件
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

                // 更新 UI 中的输入元素
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
        _installOverlay.className = 'ml-overlay ml-install-overlay';
        _installOverlay.style.display = 'flex';

        _installOverlay.innerHTML = `
            <div class="ml-install-card">
                <div id="ml-drop-zone" class="ml-drop-zone ml-install-drop-zone">
                    <div class="ml-drop-zone-icon">📁</div>
                    <div class="ml-drop-zone-text">${t('install.dragHint')}</div>
                </div>
                <div class="ml-install-or">${t('install.orClickBrowse')}</div>
                <button class="ml-btn ml-btn-primary ml-install-browse" id="ml-btn-browse-js">${t('button.browseFiles')}</button>
                <button class="ml-btn ml-btn-primary ml-install-browse" id="ml-btn-browse-folder">${t('button.browseModsFolder')}</button>
                <br>
                <button class="ml-btn ml-btn-secondary" id="ml-btn-exit-install">${t('button.exit')}</button>
            </div>
        `;

        document.body.appendChild(_installOverlay);

        const dropZone = document.getElementById('ml-drop-zone');

        // 绑定事件
        document.getElementById('ml-btn-browse-js').addEventListener('click', browseJsFiles);
        document.getElementById('ml-btn-browse-folder').addEventListener('click', browseModsFolder);
        document.getElementById('ml-btn-exit-install').addEventListener('click', hideInstallOverlay);

        // 绑定拖放事件
        _installOverlay.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });

        _installOverlay.addEventListener('dragenter', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });

        _installOverlay.addEventListener('dragleave', (e) => {
            e.preventDefault();
            // 只有离开 overlay 时才重置
            if (!_installOverlay.contains(e.relatedTarget)) {
                dropZone.classList.remove('drag-over');
            }
        });

        _installOverlay.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('drag-over');
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
     * 浏览本地 .js（NW.js input；部分运行时无 showOpenDialog）
     */
    function browseJsFiles() {
        const dialog = document.createElement('input');
        dialog.type = 'file';
        dialog.accept = '.js';
        dialog.multiple = true;
        dialog.style.display = 'none';
        document.body.appendChild(dialog);
        dialog.onchange = (e) => {
            if (e.target.files && e.target.files.length > 0) {
                dispatchBrowseJsFiles(e.target.files);
            }
            dialog.remove();
        };
        dialog.click();
    }

    /**
     * 浏览本地 mods 文件夹（NW.js nwdirectory input）
     */
    function browseModsFolder() {
        const dialog = document.createElement('input');
        dialog.type = 'file';
        dialog.setAttribute('nwdirectory', '');
        dialog.setAttribute('nwdirectorydesc', t('install.browseSelectModsFolder'));
        dialog.style.display = 'none';
        document.body.appendChild(dialog);
        dialog.onchange = () => {
            const rawPath = dialog.value;
            dialog.remove();
            if (!rawPath) return;
            dispatchBrowseModsFolder(rawPath);
        };
        dialog.click();
    }

    /** 安装页拖放 → 模块 3 dispatchCollectedInstall */
    function handleInstallDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        const items = e.dataTransfer.items;
        dispatchCollectedInstall(
            items ? Array.from(items) : [],
            e.dataTransfer.files
        );
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

    // ---- 6.5 标题画面按钮（DOM 化）----
    function updateTitleButtonVisibility() {
        if (!_titleBtnWrap) return;
        try {
            if (typeof SceneManager !== 'undefined' && SceneManager._scene) {
                const isTitle = SceneManager._scene.constructor.name === 'Scene_Title';
                _titleBtnWrap.style.display = isTitle ? 'block' : 'none';
                if (isTitle) {
                    _refreshConflictBadge();
                }
            } else {
                _titleBtnWrap.style.display = 'none';
            }
        } catch (e) {
            _titleBtnWrap.style.display = 'none';
        }
    }

    function setupTitleButton() {
        if (_titleBtnWrap) return;

        _titleBtnWrap = document.createElement('div');
        _titleBtnWrap.className = 'ml-title-btn-wrap';
        _titleBtnWrap.id = 'ml-title-btn-wrap';
        _titleBtnWrap.style.left = BUTTON_X + 'px';
        _titleBtnWrap.style.top = BUTTON_Y + 'px';
        _titleBtnWrap.style.display = 'none';

        const titleUpdateBadge = document.createElement('span');
        titleUpdateBadge.className = 'ml-settings-update-badge';
        titleUpdateBadge.id = 'ml-title-update-badge';
        titleUpdateBadge.style.display = 'none';

        _titleBtn = document.createElement('button');
        _titleBtn.className = 'ml-title-btn';
        _titleBtn.id = 'ml-title-btn';
        _titleBtn.textContent = t('title');

        _titleBtnWrap.appendChild(titleUpdateBadge);
        _titleBtnWrap.appendChild(_titleBtn);
        document.body.appendChild(_titleBtnWrap);

        _titleBtn.addEventListener('click', () => {
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
        _refreshConflictBadge();
        log(3, "标题画面按钮已创建 (DOM)");
    }

    // ---- 6.6 键盘快捷键支持（F5 重载、Esc 关闭等） ----
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

    // ---- 6.7 初始化（样式注入 / 语言加载 / 启动钩子） ----
    // 注意：此处会 defer 加载 Mod；window.ModLoader 在 6.8 赋值。
    // 依赖 setTimeout 推迟 loadEnabledModsRuntime，保证同步跑完 6.8 导出后再让 Mod 注册 API。
    injectStyles();
    ensureModLoaderConfigFile();
    loadLanguageConfigs();
    const initMlConfig = loadModLoaderConfig();
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
        const mlCfg = loadModLoaderConfig();
        _currentLanguage = mlCfg.ml_language || 'zh_CN';
        if (!_languageConfigs[_currentLanguage]) {
            _currentLanguage = 'zh_CN';
        }
        setupTitleButton();
    });

    // ---- 6.8 扩展 API（冲突日志 / ManagerGate / libs；导出 window.ModLoader）----
    // 须在 loadLibsExtensions 与任何同步加载的 Mod 注册之前完成赋值。
    // 当前安全顺序：6.7 只 defer 加载 → 本小节先导出 → 再扫 libs → 事件循环后再跑 Mod。

    const _logEntries = [];  // { id, label, getConflictCount, getUpdateCount, render }
    const _managerGates = [];

    /**
     * 供前置 Mod 注册冲突日志入口（设置菜单项 + 面板内容渲染）
     * @param {{ id: string, label: string, getConflictCount?: Function, getUpdateCount?: Function, render: Function }} entry
     */
    function registerLogEntry(entry) {
        if (!entry || !entry.id || typeof entry.render !== 'function') {
            log(1, 'registerLogEntry: invalid entry (need id + render)');
            return;
        }
        const normalized = {
            id: String(entry.id),
            label: entry.label || '日志',
            getConflictCount: typeof entry.getConflictCount === 'function'
                ? entry.getConflictCount
                : function() { return 0; },
            getUpdateCount: typeof entry.getUpdateCount === 'function'
                ? entry.getUpdateCount
                : function() { return 0; },
            render: entry.render
        };
        let found = -1;
        for (let i = 0; i < _logEntries.length; i++) {
            if (_logEntries[i].id === normalized.id) {
                found = i;
                break;
            }
        }
        if (found >= 0) {
            _logEntries[found] = normalized;
        } else {
            _logEntries.push(normalized);
        }
        log(2, 'Registered log entry:', normalized.id, normalized.label);
        _refreshSettingsLogMenu();
        _refreshConflictBadge();
    }

    /**
     * 注册管理器打开闸门。任一 gate 返回 false 则阻止打开管理器。
     * libs 扩展 / 游戏作者脚本通过此接口挂载，无需改管理器本体接线。
     * @param {function(): boolean} handler
     */
    function registerManagerGate(handler) {
        if (typeof handler !== 'function') {
            log(1, 'registerManagerGate: handler must be a function');
            return;
        }
        _managerGates.push(handler);
        log(3, 'Registered manager gate, total:', _managerGates.length);
    }

    function runManagerGates() {
        for (let i = 0; i < _managerGates.length; i++) {
            try {
                if (_managerGates[i]() === false) return false;
            } catch (e) {
                log(1, 'manager gate error:', e && e.message ? e.message : e);
            }
        }
        return true;
    }

    /**
     * 扫描并执行 libs/ 下的扩展脚本（跳过依赖库如 marked.min.js）。
     * 脚本需自行调用 window.ModLoader 注册接口才会生效；不调用等于未装。
     * 使用 <script> 注入（与 marked 一致），确保浏览器全局 window.ModLoader 可见；
     * Node require() 在 NW.js 模块作用域下可能读不到 window，会导致扩展静默失效。
     */
    function loadLibsExtensions() {
        if (!fs.existsSync(LIBS_DIR)) {
            log(3, 'libs 目录不存在，跳过扩展加载');
            return;
        }
        let files;
        try {
            files = fs.readdirSync(LIBS_DIR);
        } catch (e) {
            console.error('[ModLoader] 读取 libs 目录失败:', e && e.message ? e.message : e);
            return;
        }
        files = files.filter(function(f) {
            return /\.js$/i.test(f) && !LIBS_VENDOR_FILES[f];
        }).sort();
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fullPath = pathMod.join(LIBS_DIR, file);
            try {
                const code = fs.readFileSync(fullPath, 'utf-8');
                const script = document.createElement('script');
                script.setAttribute('data-ml-lib', file);
                script.textContent = code;
                (document.head || document.documentElement).appendChild(script);
                log(3, '已加载 libs 扩展:', file);
            } catch (e) {
                console.error('[ModLoader] 加载 libs 扩展失败 [' + file + ']:', e && e.message ? e.message : e);
            }
        }
    }

    function _applyUpdateBadgeEl(badgeEl, updateCount) {
        if (!badgeEl) return;
        if (updateCount > 0) {
            badgeEl.style.display = 'flex';
            badgeEl.textContent = updateCount > 99 ? '99+' : String(updateCount);
        } else {
            badgeEl.style.display = 'none';
            badgeEl.textContent = '';
        }
    }

    function _applyLogItemBadges(entry, updateBadge, conflictBadge) {
        let conflictCount = 0;
        let updateCount = 0;
        try {
            const c = entry.getConflictCount();
            if (typeof c === 'number' && c > 0) conflictCount = c;
            const u = entry.getUpdateCount();
            if (typeof u === 'number' && u > 0) updateCount = u;
        } catch (e) { /* ignore */ }
        if (conflictBadge) {
            if (conflictCount > 0) {
                conflictBadge.style.display = 'flex';
                conflictBadge.textContent = conflictCount > 99 ? '99+' : String(conflictCount);
            } else {
                conflictBadge.style.display = 'none';
                conflictBadge.textContent = '';
            }
        }
        _applyUpdateBadgeEl(updateBadge, updateCount);
    }

    function _refreshSettingsLogMenu() {
        const container = document.getElementById('ml-settings-log-entries');
        if (!container) return;
        container.innerHTML = '';
        if (_logEntries.length === 0) return;

        const sep = document.createElement('div');
        sep.className = 'ml-settings-log-sep';
        container.appendChild(sep);

        for (let i = 0; i < _logEntries.length; i++) {
            (function(entry) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'ml-settings-log-item';
                btn.setAttribute('data-log-entry-id', entry.id);

                const label = document.createElement('span');
                label.className = 'ml-settings-log-item-label';
                label.textContent = entry.label;

                const badgesWrap = document.createElement('span');
                badgesWrap.className = 'ml-settings-log-item-badges';

                const updateBadge = document.createElement('span');
                updateBadge.className = 'ml-settings-log-item-update-badge';
                updateBadge.style.display = 'none';

                const conflictBadge = document.createElement('span');
                conflictBadge.className = 'ml-settings-log-item-conflict-badge';
                conflictBadge.style.display = 'none';

                badgesWrap.appendChild(updateBadge);
                badgesWrap.appendChild(conflictBadge);
                _applyLogItemBadges(entry, updateBadge, conflictBadge);

                btn.appendChild(label);
                btn.appendChild(badgesWrap);
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const settingsCard = document.getElementById('ml-settings-card');
                    if (settingsCard) settingsCard.style.display = 'none';
                    _openLogPanel(entry);
                });
                container.appendChild(btn);
            })(_logEntries[i]);
        }
    }

    function _openLogPanel(entry) {
        const panel = document.getElementById('ml-log-panel');
        const title = document.getElementById('ml-log-panel-title');
        const body = document.getElementById('ml-log-panel-body');
        if (!panel || !body) return;
        if (title) title.textContent = entry.label || '';
        body.innerHTML = '';
        try {
            entry.render(body);
        } catch (err) {
            body.innerHTML = '<div class="ml-log-panel-empty">渲染失败</div>';
            log(1, 'log entry render error:', err && err.message ? err.message : err);
        }
        panel.style.display = 'flex';
        _refreshConflictBadge();
    }

    function _closeLogPanel() {
        const panel = document.getElementById('ml-log-panel');
        if (panel) panel.style.display = 'none';
        const body = document.getElementById('ml-log-panel-body');
        if (body) body.innerHTML = '';
    }

    function _refreshSettingsBadges() {
        const conflictBadge = document.getElementById('ml-settings-conflict-badge');
        const updateBadge = document.getElementById('ml-settings-update-badge');
        let conflictTotal = 0;
        let updateTotal = 0;
        for (let i = 0; i < _logEntries.length; i++) {
            try {
                const entry = _logEntries[i];
                const c = entry.getConflictCount();
                if (typeof c === 'number' && c > 0) conflictTotal += c;
                const u = entry.getUpdateCount();
                if (typeof u === 'number' && u > 0) updateTotal += u;

                const menuItem = document.querySelector(
                    '.ml-settings-log-item[data-log-entry-id="' + entry.id + '"]'
                );
                if (menuItem) {
                    _applyLogItemBadges(
                        entry,
                        menuItem.querySelector('.ml-settings-log-item-update-badge'),
                        menuItem.querySelector('.ml-settings-log-item-conflict-badge')
                    );
                }
            } catch (e) { /* ignore */ }
        }
        if (conflictBadge) {
            if (conflictTotal > 0) {
                conflictBadge.style.display = 'flex';
                conflictBadge.textContent = '!';
            } else {
                conflictBadge.style.display = 'none';
            }
        }
        _applyUpdateBadgeEl(updateBadge, updateTotal);
        _applyUpdateBadgeEl(document.getElementById('ml-title-update-badge'), updateTotal);
    }

    const _refreshConflictBadge = _refreshSettingsBadges;

    // 导出公共 API（libs / 前置 Mod 依赖此对象；必须在 loadLibsExtensions 之前赋值）
    window.ModLoader = {
        version: VERSION,
        registerLogEntry: registerLogEntry,
        registerManagerGate: registerManagerGate,
        refreshConflictLog: _refreshConflictBadge,
        showConfirmDialog: showConfirmDialog,
        hideConfirmDialog: hideConfirmDialog,
        showChangelogModal: showChangelogModal,
        hideChangelogModal: hideChangelogModal,
        isChangelogModalOpen: function () { return !!_changelogModal; }
    };

    loadLibsExtensions();

    log(3, `ModLoader ${VERSION} 初始化完成`);

})();
