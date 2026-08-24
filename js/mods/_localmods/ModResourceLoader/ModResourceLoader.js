/*:
 * @target MZ
 * @plugindesc V2.0.1 资源替换前置Mod —— 为功能Mod提供图片/音频替换API与加密绕过
 * @author joker创意
 *
 * @help
 * ┌────────────────────────────┐
 * │  ModResourceLoader V2.0.1  │
 * │  资源替换前置Mod            │
 * └────────────────────────────┘
 *
 * ■ 资源替换（manifest 声明，零代码）
 *
 * 在 modloader.json 中声明 resources 字段即可：
 * {
 *     "name": "MyMod",
 *     "modId": "MyMod",
 *     "entries": ["MyMod.js"],
 *     "resources": {
 *         "img/菜单/现实时间图标": "img/clock.png"
 *     }
 * }
 *
 * modId：Mod 作者自定义的稳定标识（必填），
 *        创意工坊上传后包名变成工坊 ID，但 modId 不变。
 *
 * ■ 资源新增（一行 API）
 *
 * ModResourceLoader.loadBitmap(modName, relativePath) → Bitmap
 *
 * // modName = modloader.json 中的 modId（或包名）
 * const bmp = ModResourceLoader.loadBitmap('MyMod', 'img/myIcon');
 *
 * ■ Legacy API
 *
 * ModResourceLoader.registerImage(folder, filename, modUrl)
 * ModResourceLoader.registerAudio(folder, filename, modUrl)
 * ModResourceLoader.getResourceRegistry()
 * ModResourceLoader.getConflictReport()
 *
 * @param debugLevel
 * @text 调试等级
 * @type select
 * @option 关闭
 * @value 0
 * @option 基本
 * @value 1
 * @option 详细
 * @value 2
 * @default 0
 *
 * @param enableResourceReplacement
 * @text 启用资源替换
 * @type boolean
 * @default true
 *
 * @param enableEncryptionBypass
 * @text 启用加密绕过
 * @type boolean
 * @default true
 *
 * @param enableResourceInjection
 * @text 启用资源注入
 * @desc 兼容旧参数名
 * @type boolean
 * @default true
 */

(() => {
    'use strict';

    // ═══════════════════════════════════════════════════════════
    //  Constants
    // ═══════════════════════════════════════════════════════════

    const MOD_NAME = 'ModResourceLoader';
    const VERSION = 'V2.0.1';

    // ═══════════════════════════════════════════════════════════
    //  Logging
    // ═══════════════════════════════════════════════════════════

    let _debugLevel = 0;

    function log(level, ...args) {
        if (level <= _debugLevel) console.log(`[${MOD_NAME}]`, ...args);
    }
    function warn(...args) {
        console.warn(`[${MOD_NAME}]`, ...args);
    }
    function error(...args) {
        console.error(`[${MOD_NAME}]`, ...args);
    }

    // ═══════════════════════════════════════════════════════════
    //  Plugin Parameters
    // ═══════════════════════════════════════════════════════════

    function readPluginParameters() {
        const merged = {};
        const keys = [
            MOD_NAME,
            `../mods/_localmods/${MOD_NAME}/${MOD_NAME}`,
            `../mods/${MOD_NAME}`
        ];
        for (const key of keys) {
            Object.assign(merged, PluginManager.parameters(key) || {});
        }
        return merged;
    }

    const _rawParams = readPluginParameters();
    const Params = {
        debugLevel: Number(_rawParams.debugLevel || 0),
        enableResourceReplacement: _rawParams.enableResourceReplacement !== 'false'
            && _rawParams.enableResourceInjection !== 'false',
        enableEncryptionBypass: _rawParams.enableEncryptionBypass !== 'false'
    };
    _debugLevel = Params.debugLevel;
    log(1, `Initialized ${VERSION}`, Params);

    // ═══════════════════════════════════════════════════════════
    //  Internal Registries
    // ═══════════════════════════════════════════════════════════

    /**
     * 资源注册表
     * Map<resourceKey, {url, modName, order, source}>
     * key 格式: 'img:folder:filename' 或 'audio:folder:filename'
     */
    const _resourceRegistry = new Map();

    /**
     * 冲突日志
     * Map<resourceKey, { type, folder, filename, touches: [{modName, order, url, regSource}] }>
     */
    const _conflictLog = new Map();

    /** Mod 资源 URL 集合（用于加密绕过检测） */
    const _modResourceUrls = new Set();

    /** Hook 安装标志 */
    let _hooksInstalled = false;

    // ═══════════════════════════════════════════════════════════
    //  Utilities
    // ═══════════════════════════════════════════════════════════

    function makeResourceKey(type, folder, filename) {
        return `${type}:${folder}:${filename}`;
    }

    function isPathSafe(path) {
        if (!path || typeof path !== 'string') return false;
        if (path.includes('..')) return false;
        if (/^[a-zA-Z]:/.test(path)) return false;
        if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('//')) return false;
        return true;
    }

    function getCallerInfo() {
        try {
            const stack = new Error().stack;
            if (stack) {
                const lines = stack.split('\n');
                for (let i = 3; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (line && !line.includes(MOD_NAME)) return line.substring(0, 100);
                }
            }
        } catch (e) { /* ignore */ }
        return 'unknown';
    }

    /**
     * 将 Mod 资源 URL 解析为 folder + filename
     */
    function folderFilenameFromModUrl(modUrl) {
        if (!modUrl || typeof modUrl !== 'string') return null;
        const normalized = modUrl.replace(/\\/g, '/');
        const slash = normalized.lastIndexOf('/');
        if (slash < 0) return null;
        const folder = normalized.slice(0, slash + 1);
        let base = normalized.slice(slash + 1);
        const dot = base.lastIndexOf('.');
        if (dot > 0) base = base.slice(0, dot);
        if (!base) return null;
        return { folder, filename: base };
    }

    // ═══════════════════════════════════════════════════════════
    //  Path Resolution & Manifest Scanning
    // ═══════════════════════════════════════════════════════════

    let _modsBasePath = null;

    /** Mod 基础路径注册表：modName → baseDir (含尾部斜杠) */
    const _modPaths = {};

    function resolveModsBasePath() {
        if (_modsBasePath) return _modsBasePath;
        let scriptSrc = '';
        if (document.currentScript && document.currentScript.src) {
            scriptSrc = document.currentScript.src;
        } else {
            const scripts = document.querySelectorAll('script[src*="ModResourceLoader"]');
            if (scripts.length) scriptSrc = scripts[scripts.length - 1].src;
        }
        if (scriptSrc) {
            // chrome-extension://xxx/js/mods/_localmods/ModResourceLoader/ModResourceLoader.js
            // → chrome-extension://xxx/js/mods/  或相对路径 js/mods/
            let base = scriptSrc;
            const idx = base.indexOf('_localmods/');
            if (idx > 0) {
                base = base.substring(0, idx);
            } else {
                const slash = base.lastIndexOf('/');
                if (slash >= 0) base = base.substring(0, slash + 1);
            }
            // 如果是 chrome-extension:// URL，转为相对路径
            if (base.startsWith('chrome-extension://')) {
                const urlObj = new URL(base);
                base = urlObj.pathname.substring(1); // 去掉前导 /
            }
            _modsBasePath = base;
        } else {
            _modsBasePath = 'js/mods/';
        }
        log(1, 'Mods base path:', _modsBasePath);
        return _modsBasePath;
    }

    function readJsonFile(filePath) {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', filePath, false);
        xhr.overrideMimeType('application/json');
        try {
            xhr.send();
        } catch (e) {
            return null; // chrome-extension:// 协议下文件不存在会抛异常
        }
        if (xhr.status === 200 || xhr.status === 0) {
            try { return JSON.parse(xhr.responseText); }
            catch (e) { return null; }
        }
        return null;
    }

    /**
     * 扫描所有启用 Mod 的 modloader.json，处理 resources 声明
     * 替换走声明（零代码），ModResourceLoader 自己知道每个 mod 的目录
     * 按 mod_config.order 升序处理，后写覆盖先写（order 大者生效）
     */
    function _scanResourceManifests() {
        const basePath = resolveModsBasePath();
        const configData = readJsonFile(basePath + 'mod_config.json');
        if (!configData) return;

        const enabledMods = [];
        for (const configKey of Object.keys(configData)) {
            const config = configData[configKey];
            if (!config || config.status !== true) continue;

            const parts = configKey.split(':');
            if (parts.length < 3) continue;
            const [source, packageName] = parts;

            let modDir;
            if (source === 'local') {
                modDir = basePath + '_localmods/' + packageName + '/';
            } else if (source === 'ws') {
                modDir = basePath + '_workshop/' + packageName + '/';
            } else {
                continue;
            }

            enabledMods.push({
                configKey,
                packageName,
                modDir,
                order: typeof config.order === 'number' ? config.order : 999
            });
        }

        enabledMods.sort((a, b) => a.order - b.order);

        for (const mod of enabledMods) {
            const { packageName, modDir, order } = mod;

            // 记录 mod 基础路径（供 loadBitmap API 使用）
            _modPaths[packageName] = modDir;

            // 读取 modloader.json
            const manifest = readJsonFile(modDir + 'modloader.json');
            if (!manifest) continue;

            // modId 别名：mod 作者自定义稳定标识 → 实际包名（工坊 ID）
            if (manifest.modId) {
                _modPaths[manifest.modId] = modDir;
                log(1, `modId alias: ${manifest.modId} → ${packageName}`);
            }

            if (!manifest.resources) continue;

            // 处理 resources 声明
            for (const [originalPath, replacementPath] of Object.entries(manifest.resources)) {
                if (!isPathSafe(replacementPath)) {
                    warn(`Unsafe resource path in ${packageName}: ${replacementPath}`);
                    continue;
                }
                const fullUrl = modDir + replacementPath;

                // 解析 originalPath → folder + filename
                // 例如 "img/菜单/现实时间图标" → folder="img/菜单/", filename="现实时间图标"
                const lastSlash = originalPath.lastIndexOf('/');
                if (lastSlash < 0) {
                    warn(`Invalid resource key in ${packageName}: ${originalPath}`);
                    continue;
                }
                const folder = originalPath.substring(0, lastSlash + 1);
                const filename = originalPath.substring(lastSlash + 1);

                // 判断类型
                const type = folder.startsWith('audio/') ? 'audio' : 'img';
                _setResourceEntry(type, folder, filename, fullUrl, packageName, order, 'manifest');

                log(1, `Manifest resource: ${packageName} → ${folder}${filename} ⇒ ${fullUrl}`);
            }
        }
        log(1, 'Resource manifest scan complete');
    }

    // ═══════════════════════════════════════════════════════════
    //  New Resource Loading API
    // ═══════════════════════════════════════════════════════════

    /**
     * 加载 Mod 自带的图片资源（返回 Bitmap，带缓存）
     * @param {string} modName      - Mod 包名（manifest 中的 packageName）
     * @param {string} relativePath - 相对于 mod 根目录的路径（不含 .png），如 'img/indicator'
     * @returns {Bitmap}
     */
    function loadBitmap(modName, relativePath) {
        if (!isPathSafe(relativePath)) {
            error(`loadBitmap: unsafe path '${relativePath}'`);
            return ImageManager.loadBitmap('', '');
        }
        const basePath = _modPaths[modName];
        if (!basePath) {
            error(`loadBitmap: unknown mod "${modName}"，请确认 mod 已在 mod_config.json 中启用`);
            return ImageManager.loadBitmap('', '');
        }
        const url = basePath + relativePath + '.png';
        _modResourceUrls.add(url);
        log(1, `loadBitmap: ${modName} → ${url}`);
        return ImageManager.loadBitmapFromUrl(url);
    }

    // ═══════════════════════════════════════════════════════════
    //  Resource Registration & Conflict Tracking
    // ═══════════════════════════════════════════════════════════

    function _trackResourceTouch(type, folder, filename, url, modName, order, regSource) {
        const key = makeResourceKey(type, folder, filename);
        if (!_conflictLog.has(key)) {
            _conflictLog.set(key, { type, folder, filename, touches: [] });
        }
        _conflictLog.get(key).touches.push({
            modName: modName || '未知Mod',
            order: typeof order === 'number' ? order : 999,
            url: url || '',
            regSource: regSource || 'api'
        });
    }

    function _setResourceEntry(type, folder, filename, url, modName, order, regSource) {
        const key = makeResourceKey(type, folder, filename);
        _trackResourceTouch(type, folder, filename, url, modName, order, regSource);
        _resourceRegistry.set(key, {
            url,
            modName: modName || 'unknown',
            order: typeof order === 'number' ? order : 999,
            source: regSource || 'api'
        });
        _modResourceUrls.add(url);
    }

    function _getConflictReport() {
        const report = [];
        const typeNames = { img: '图片', audio: '音频' };

        for (const [, entry] of _conflictLog) {
            if (entry.touches.length < 2) continue;

            // 按 modName:regSource 去重：同 mod 不同来源视为独立条目
            const modMap = new Map();
            for (const touch of entry.touches) {
                const name = `${touch.modName || '未知Mod'} (${touch.regSource || 'api'})`;
                const existing = modMap.get(name);
                if (!existing || touch.order >= existing.order) {
                    modMap.set(name, touch);
                }
            }

            const uniqueMods = Array.from(modMap.values());
            if (uniqueMods.length < 2) continue;

            // 检查是否有实际冲突（不同 URL）
            const urls = uniqueMods.map(t => String(t.url || ''));
            if (new Set(urls).size <= 1) continue;

            const sorted = uniqueMods.slice().sort((a, b) => a.order - b.order);
            const winner = sorted[sorted.length - 1];
            const losers = sorted.slice(0, -1);
            const path = (entry.folder || '') + (entry.filename || '');
            const _srcLabel = (t) => `${t.modName || '未知Mod'} (${t.regSource || 'api'})`;

            report.push({
                resourceKey: makeResourceKey(entry.type, entry.folder, entry.filename),
                type: entry.type,
                typeName: typeNames[entry.type] || entry.type || '?',
                folder: entry.folder,
                filename: entry.filename,
                path,
                winnerName: _srcLabel(winner),
                winnerUrl: winner.url,
                winnerValue: winner.url,
                losers: losers.map(l => ({
                    name: _srcLabel(l),
                    url: l.url,
                    value: l.url
                })),
                mods: sorted.map(t => ({
                    name: _srcLabel(t),
                    modName: t.modName,
                    order: t.order,
                    url: t.url,
                    regSource: t.regSource
                })),
                winner: winner.modName
            });
        }
        return report;
    }

    function registerImage(folder, filename, modUrl) {
        registerResource('img', folder, filename, modUrl);
    }

    function registerAudio(folder, filename, modUrl) {
        registerResource('audio', folder, filename, modUrl);
    }

    function registerResource(type, folder, filename, modUrl) {
        if (!Params.enableResourceReplacement) {
            warn('Resource replacement disabled'); return;
        }
        if (!['img', 'audio'].includes(type)) {
            error(`registerResource: invalid type '${type}'`); return;
        }
        if (!folder || typeof folder !== 'string') {
            error('registerResource: folder must be a non-empty string'); return;
        }
        if (!filename || typeof filename !== 'string') {
            error('registerResource: filename must be a non-empty string'); return;
        }
        if (!modUrl || typeof modUrl !== 'string') {
            error('registerResource: modUrl must be a non-empty string'); return;
        }
        if (!isPathSafe(modUrl)) {
            error(`registerResource: unsafe URL '${modUrl}'`); return;
        }

        _setResourceEntry(type, folder, filename, modUrl, 'unknown', 999, 'api');
        log(1, `Registered ${type}: ${folder}${filename} → ${modUrl} (${getCallerInfo()})`);
    }

    function _getModResourceUrl(type, folder, filename) {
        const key = makeResourceKey(type, folder, filename);
        const entry = _resourceRegistry.get(key);
        return entry ? entry.url : null;
    }

    function _isModResource(url) {
        return url && _modResourceUrls.has(url);
    }

    // ═══════════════════════════════════════════════════════════
    //  Hook Installation
    // ═══════════════════════════════════════════════════════════

    function installHooks() {
        if (_hooksInstalled) return;
        _hooksInstalled = true;

        if (!Params.enableResourceReplacement) {
            log(1, 'Resource replacement disabled, skipping hooks');
            return;
        }

        _installImageHooks();
        _installAudioHooks();

        if (Params.enableEncryptionBypass) {
            _installEncryptionBypassHooks();
        }

        log(1, 'All resource hooks installed');
    }

    // ─── Image Hooks ──────────────────────────────────────

    function _installImageHooks() {
        // Hook: ImageManager.loadBitmap
        const _orig_loadBitmap = ImageManager.loadBitmap;
        ImageManager.loadBitmap = function(folder, filename) {
            const modUrl = _getModResourceUrl('img', folder, filename);
            if (modUrl) {
                log(2, `Image redirect: ${folder}${filename} → ${modUrl}`);
                return ImageManager.loadBitmapFromUrl(modUrl);
            }
            return _orig_loadBitmap.call(this, folder, filename);
        };

        // Hook: ImageManager.loadNormalBitmap（RMMZ 1.4+）
        if (ImageManager.loadNormalBitmap) {
            const _orig_loadNormalBitmap = ImageManager.loadNormalBitmap;
            ImageManager.loadNormalBitmap = function(folder, filename) {
                const modUrl = _getModResourceUrl('img', folder, filename);
                if (modUrl) {
                    log(2, `Image redirect: ${folder}${filename} → ${modUrl}`);
                    return ImageManager.loadBitmapFromUrl(modUrl);
                }
                return _orig_loadNormalBitmap.call(this, folder, filename);
            };
        }

        log(1, 'Image hooks installed');
    }

    // ─── Audio Hooks ──────────────────────────────────────

    function _installAudioHooks() {
        // Hook: AudioManager.createBuffer
        const _orig_createBuffer = AudioManager.createBuffer;
        AudioManager.createBuffer = function(folder, name) {
            const modUrl = _getModResourceUrl('audio', folder, name);
            if (modUrl) {
                log(2, `Audio redirect: ${folder}${name} → ${modUrl}`);
                const buffer = new WebAudio(modUrl);
                buffer.name = name;
                buffer.frameCount = Graphics.frameCount;
                return buffer;
            }
            return _orig_createBuffer.call(this, folder, name);
        };

        log(1, 'Audio hooks installed');
    }

    // ─── Encryption Bypass ────────────────────────────────

    function _installEncryptionBypassHooks() {
        // Hook: Bitmap._startLoading — 跳过图片解密
        if (Bitmap.prototype._startLoading) {
            const _orig_startLoading = Bitmap.prototype._startLoading;
            Bitmap.prototype._startLoading = function() {
                if (_isModResource(this._url)) {
                    log(2, `Bypassing encryption for mod image: ${this._url}`);
                    this._image = new Image();
                    this._image.onload = this._onLoad.bind(this);
                    this._image.onerror = this._onError.bind(this);
                    this._destroyCanvas();
                    this._loadingState = 'loading';
                    this._image.src = this._url;
                    return;
                }
                _orig_startLoading.call(this);
            };
        }

        // Hook: WebAudio._realUrl — 跳过音频 URL 后缀处理
        if (WebAudio.prototype._realUrl) {
            const _orig_realUrl = Object.getOwnPropertyDescriptor(
                WebAudio.prototype, '_realUrl'
            );
            if (_orig_realUrl && _orig_realUrl.get) {
                Object.defineProperty(WebAudio.prototype, '_realUrl', {
                    get: function() {
                        if (_isModResource(this._url)) {
                            log(2, `Bypassing encryption URL for mod audio: ${this._url}`);
                            return this._url;
                        }
                        return _orig_realUrl.get.call(this);
                    },
                    configurable: true
                });
            }
        }

        // Hook: WebAudio._readableBuffer — 跳过音频解密
        if (WebAudio.prototype._readableBuffer) {
            const _orig_readableBuffer = Object.getOwnPropertyDescriptor(
                WebAudio.prototype, '_readableBuffer'
            );
            if (_orig_readableBuffer && _orig_readableBuffer.get) {
                Object.defineProperty(WebAudio.prototype, '_readableBuffer', {
                    get: function() {
                        if (_isModResource(this._url)) {
                            log(2, `Bypassing decryption for mod audio: ${this._url}`);
                            return this._data ? this._data.buffer : null;
                        }
                        return _orig_readableBuffer.get.call(this);
                    },
                    configurable: true
                });
            }
        }

        log(1, 'Encryption bypass hooks installed');
    }

    // ═══════════════════════════════════════════════════════════
    //  Public API & Initialization
    // ═══════════════════════════════════════════════════════════

    const API = {
        version: VERSION,

        // 新增资源加载（mod 用相对路径加载自己的图片）
        loadBitmap,

        // Legacy API
        registerImage,
        registerAudio,
        registerResource,

        getResourceRegistry() {
            const result = {};
            for (const [key, entry] of _resourceRegistry) {
                result[key] = {
                    url: entry.url,
                    modName: entry.modName,
                    order: entry.order,
                    source: entry.source
                };
            }
            return result;
        },

        getConflictReport: _getConflictReport
    };

    // 导出全局 API
    window.ModResourceLoader = API;

    // 扫描 manifest 声明式资源替换（零代码）
    _scanResourceManifests();

    // 安装 Hook
    installHooks();

    // ── 冲突日志面板内容（由 ModLoader 空壳托管，本前置负责渲染） ──
    function _escHtml(str) {
        const d = document.createElement('span');
        d.textContent = str == null ? '' : String(str);
        return d.innerHTML;
    }

    function _truncateStr(str, max) {
        str = str == null ? '' : String(str);
        return str.length > max ? str.substring(0, max) + '…' : str;
    }

    function _ensureConflictStyles() {
        if (document.getElementById('mrl-conflict-styles')) return;
        const style = document.createElement('style');
        style.id = 'mrl-conflict-styles';
        style.textContent =
            '.mrl-cl-empty{padding:24px 16px;text-align:center;color:var(--ml-text-muted,#666680);font-size:13px;}' +
            '.mrl-cl-summary{padding:10px 16px 8px;margin:4px 12px 8px;border-radius:8px;background:rgba(255,167,38,0.10);border:1px solid rgba(255,167,38,0.20);font-size:12px;line-height:1.6;color:#ffa726;}' +
            '.mrl-cl-summary b{color:#ffb74d;font-size:14px;}' +
            '.mrl-cl-item{padding:10px 16px;border-bottom:1px solid rgba(255,255,255,0.06);}' +
            '.mrl-cl-item:last-child{border-bottom:none;}' +
            '.mrl-cl-item-head{display:flex;gap:6px;align-items:center;margin-bottom:6px;flex-wrap:wrap;}' +
            '.mrl-cl-tag{font-size:11px;padding:2px 7px;border-radius:4px;font-weight:600;line-height:1.5;}' +
            '.mrl-cl-tag-type{background:rgba(74,158,255,0.15);color:#5cb0ff;}' +
            '.mrl-cl-tag-path{background:rgba(255,167,38,0.15);color:#ffa726;}' +
            '.mrl-cl-result{display:flex;align-items:center;gap:8px;padding:4px 0;margin-bottom:4px;}' +
            '.mrl-cl-winner-name{color:#4caf50;font-weight:600;font-size:12px;white-space:nowrap;}' +
            '.mrl-cl-winner-val{color:var(--ml-text-primary,#e8e8ec);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
            '.mrl-cl-overridden{border-left:2px solid rgba(255,255,255,0.08);margin-left:4px;padding-left:8px;}' +
            '.mrl-cl-mod-row{display:flex;align-items:center;gap:6px;font-size:11px;padding:2px 0;}' +
            '.mrl-cl-override-icon{color:#666680;font-size:12px;}' +
            '.mrl-cl-mod-name{color:#9a9ab0;font-weight:500;}' +
            '.mrl-cl-mod-val{color:#666680;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:220px;}' +
            '.mrl-cl-overridden-tag{color:#ef5350;font-size:10px;font-weight:600;margin-left:auto;padding:1px 4px;border-radius:3px;background:rgba(239,83,80,0.10);}';
        document.head.appendChild(style);
    }

    function _renderConflictPanel(container) {
        if (!container) return;
        _ensureConflictStyles();
        const items = _getConflictReport();
        if (!items.length) {
            container.innerHTML = '<div class="mrl-cl-empty">✅ 无冲突，所有 Mod 资源替换正常</div>';
            return;
        }

        let html = '<div class="mrl-cl-summary">';
        html += '⚠ 发现 <b>' + items.length + '</b> 处资源冲突<br>';
        html += '多个 Mod 替换了同一资源，已自动按排序决定生效项';
        html += '</div>';

        for (let k = 0; k < items.length; k++) {
            const item = items[k];
            const typeName = item.typeName || item.type || '?';
            const path = item.path || ((item.folder || '') + (item.filename || ''));
            const winnerName = item.winnerName || item.winner || '未知';
            const winnerUrl = item.winnerUrl != null ? String(item.winnerUrl) : '';

            html += '<div class="mrl-cl-item">';
            html += '<div class="mrl-cl-item-head">';
            html += '<span class="mrl-cl-tag mrl-cl-tag-type">' + _escHtml(typeName) + '</span>';
            html += '<span class="mrl-cl-tag mrl-cl-tag-path">' + _escHtml(path) + '</span>';
            html += '</div>';

            html += '<div class="mrl-cl-result">';
            html += '<span class="mrl-cl-winner-name">✓ ' + _escHtml(winnerName) + '</span>';
            html += '<span class="mrl-cl-winner-val">' + _escHtml(_truncateStr(winnerUrl, 60)) + '</span>';
            html += '</div>';

            if (Array.isArray(item.losers) && item.losers.length > 0) {
                html += '<div class="mrl-cl-overridden">';
                for (let m = 0; m < item.losers.length; m++) {
                    const loser = item.losers[m];
                    const loserUrl = loser.url != null ? String(loser.url) : '';
                    html += '<div class="mrl-cl-mod-row">';
                    html += '<span class="mrl-cl-override-icon">↳</span>';
                    html += '<span class="mrl-cl-mod-name">' + _escHtml(loser.name) + '</span>';
                    html += '<span class="mrl-cl-mod-val">' + _escHtml(_truncateStr(loserUrl, 50)) + '</span>';
                    html += '<span class="mrl-cl-overridden-tag">已被覆盖</span>';
                    html += '</div>';
                }
                html += '</div>';
            }

            html += '</div>';
        }
        container.innerHTML = html;
    }

    function _registerConflictLogEntry() {
        if (!window.ModLoader || typeof window.ModLoader.registerLogEntry !== 'function') return false;
        window.ModLoader.registerLogEntry({
            id: 'ModResourceLoader',
            label: '资源冲突日志',
            getConflictCount: function() {
                return _getConflictReport().length;
            },
            render: _renderConflictPanel
        });
        return true;
    }

    if (_registerConflictLogEntry()) {
        log(1, 'Registered conflict log entry with ModLoader');
    } else {
        window.addEventListener('load', () => {
            if (_registerConflictLogEntry()) {
                log(1, 'Registered conflict log entry with ModLoader (deferred)');
            }
        });
    }

    log(1, `${MOD_NAME} ${VERSION} loaded successfully`);

})();
