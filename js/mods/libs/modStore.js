/**
 * ModLoader libs 扩展 · 小型 Mod 商店（Phase 1）
 *
 * 存在即生效，删除即关闭。通过 registerLogEntry 挂载设置面板入口。
 * 多源订阅 catalog → 比对本地 _localmods → HTTPS 下载 zip → sha256 → 安全解压。
 */
(function () {
    'use strict';

    var ML = typeof window !== 'undefined' ? window.ModLoader : null;
    if (!ML || typeof ML.registerLogEntry !== 'function') {
        console.warn('[modStore] ModLoader.registerLogEntry 不可用，扩展未挂载');
        return;
    }

    var fs = require('fs');
    var pathMod = require('path');
    var https = require('https');
    var http = require('http');
    var crypto = require('crypto');
    var zlib = require('zlib');
    var urlMod = require('url');

    var MODS_DIR = pathMod.join(process.cwd(), 'js', 'mods');
    var LOCALMODS_DIR = pathMod.join(MODS_DIR, '_localmods');
    var CONFIG_PATH = pathMod.join(MODS_DIR, 'config', 'mod_store.json');
    var TMP_ROOT = pathMod.join(MODS_DIR, 'config', '.modstore-tmp');

    var DEFAULT_MAX_BYTES = 104857600;
    var DOWNLOAD_CONCURRENCY = 2;
    var REQUEST_TIMEOUT_MS = 60000;
    var USER_AGENT = 'ModLoader-ModStore/1.0';
    var RESUME_THRESHOLD_BYTES = 50 * 1024 * 1024; // >50MB 才断点续传
    var PROGRESS_UI_THROTTLE_MS = 200;

    function isLocalHttpsHost(hostname) {
        var h = String(hostname || '').toLowerCase();
        return h === '127.0.0.1' || h === 'localhost' || h === '::1';
    }

    function httpsTlsOptions(hostname) {
        return isLocalHttpsHost(hostname) ? { rejectUnauthorized: false } : {};
    }

    // ---- 运行时状态 ----
    var _config = null;
    var _catalogBySource = {}; // sourceId -> { ok, error?, catalog?, fetchedAt }
    var _activeTab = 'all';
    var _activeStatusFilter = 'all'; // all | update | new | missing
    var _statusFilterPinnedByUser = false;
    var _viewMode = 'list'; // list | sources
    var _panelRoot = null;
    var _listScrollTop = 0;
    var _jobState = {}; // key: sourceId::modId -> { status, progress, error }
    var _queue = [];
    var _activeJobs = 0;
    var _multiSourceIds = {}; // packageName -> true when appears in >1 enabled sources

    // ================================================================
    // 工具
    // ================================================================

    function logWarn() {
        var args = Array.prototype.slice.call(arguments);
        args.unshift('[modStore]');
        console.warn.apply(console, args);
    }

    function escHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function ensureDir(dir) {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }

    function removePathSafe(targetPath) {
        if (!fs.existsSync(targetPath)) return;
        try {
            var stat = fs.lstatSync(targetPath);
            if (stat.isDirectory()) {
                fs.rmSync(targetPath, { recursive: true, force: true });
            } else {
                fs.unlinkSync(targetPath);
            }
        } catch (e) {
            logWarn('移除路径失败:', targetPath, e && e.message ? e.message : e);
        }
    }

    function copyDirRecursive(src, dest) {
        ensureDir(dest);
        var entries = fs.readdirSync(src, { withFileTypes: true });
        for (var i = 0; i < entries.length; i++) {
            var ent = entries[i];
            var from = pathMod.join(src, ent.name);
            var to = pathMod.join(dest, ent.name);
            if (ent.isDirectory()) {
                copyDirRecursive(from, to);
            } else if (ent.isFile()) {
                fs.copyFileSync(from, to);
            }
        }
    }

    function jobKey(sourceId, modId) {
        return String(sourceId) + '::' + String(modId);
    }

    function isSafePackageName(name) {
        if (!name || typeof name !== 'string') return false;
        if (name !== name.trim()) return false;
        if (!name.length || name.length > 120) return false;
        if (/[\\/]/.test(name) || name.indexOf('..') !== -1) return false;
        if (name === '.' || name === '..') return false;
        return true;
    }

    /** 体积展示：B → KB → MB → GB（满 1024 进位） */
    function formatBytes(n) {
        n = Number(n);
        if (!isFinite(n) || n < 0) return '—';
        if (n < 1024) return Math.round(n) + ' B';
        var kb = n / 1024;
        if (kb < 1024) {
            return (kb < 10 ? kb.toFixed(1) : String(Math.round(kb))) + ' KB';
        }
        var mb = kb / 1024;
        if (mb < 1024) {
            return (mb < 10 ? mb.toFixed(1) : String(Math.round(mb))) + ' MB';
        }
        var gb = mb / 1024;
        return (gb < 10 ? gb.toFixed(2) : String(Math.round(gb))) + ' GB';
    }

    function formatSpeed(bytesPerSec) {
        if (!isFinite(bytesPerSec) || bytesPerSec <= 0) return '—';
        return formatBytes(bytesPerSec) + '/s';
    }

    function formatEta(seconds) {
        if (!isFinite(seconds) || seconds < 0) return '—';
        seconds = Math.ceil(seconds);
        if (seconds < 60) return seconds + 's';
        var m = Math.floor(seconds / 60);
        var s = seconds % 60;
        if (m < 60) return m + 'm' + (s < 10 ? '0' : '') + s + 's';
        var h = Math.floor(m / 60);
        m = m % 60;
        return h + 'h' + m + 'm';
    }

    // ================================================================
    // 配置
    // ================================================================

    function defaultConfig() {
        return {
            maxDownloadBytes: DEFAULT_MAX_BYTES,
            sources: [],
            suppressInstallHint: false,
            seenMods: {}
        };
    }

    function normalizeSeenMods(raw) {
        var seen = {};
        if (!raw) return seen;
        if (Array.isArray(raw)) {
            for (var i = 0; i < raw.length; i++) {
                var pkg = String(raw[i] || '').trim();
                if (isSafePackageName(pkg)) seen[pkg] = true;
            }
            return seen;
        }
        if (typeof raw === 'object') {
            for (var key in raw) {
                if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
                if (!raw[key]) continue;
                var name = String(key).trim();
                if (isSafePackageName(name)) seen[name] = true;
            }
        }
        return seen;
    }

    function normalizeConfig(raw) {
        var cfg = defaultConfig();
        if (!raw || typeof raw !== 'object') return cfg;
        var max = Number(raw.maxDownloadBytes);
        if (isFinite(max) && max > 0) cfg.maxDownloadBytes = Math.floor(max);
        cfg.suppressInstallHint = !!raw.suppressInstallHint;
        cfg.seenMods = normalizeSeenMods(raw.seenMods);
        cfg.sources = [];
        if (Array.isArray(raw.sources)) {
            for (var i = 0; i < raw.sources.length; i++) {
                var s = raw.sources[i];
                if (!s || typeof s !== 'object') continue;
                var id = String(s.id || '').trim();
                var name = String(s.name || '').trim();
                var catalogUrl = String(s.catalogUrl || '').trim();
                if (!id || !catalogUrl) continue;
                cfg.sources.push({
                    id: id,
                    name: name || id,
                    catalogUrl: catalogUrl,
                    enabled: s.enabled !== false
                });
            }
        }
        return cfg;
    }

    function loadConfig() {
        try {
            if (!fs.existsSync(CONFIG_PATH)) {
                _config = defaultConfig();
                saveConfig(_config);
                return _config;
            }
            var raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
            _config = normalizeConfig(raw);
            return _config;
        } catch (e) {
            logWarn('加载 mod_store.json 失败，使用默认:', e && e.message ? e.message : e);
            _config = defaultConfig();
            return _config;
        }
    }

    function saveConfig(cfg) {
        _config = normalizeConfig(cfg || _config || defaultConfig());
        ensureDir(pathMod.dirname(CONFIG_PATH));
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(_config, null, 2), 'utf-8');
        return _config;
    }

    function getConfig() {
        return _config || loadConfig();
    }

    function isPackageSeen(packageName) {
        var cfg = getConfig();
        return !!(cfg.seenMods && cfg.seenMods[packageName]);
    }

    function isModNew(packageName) {
        return !isPackageSeen(packageName);
    }

    function markPackageSeen(packageName) {
        if (!isSafePackageName(packageName)) return false;
        var cfg = getConfig();
        if (cfg.seenMods[packageName]) return false;
        cfg.seenMods[packageName] = true;
        saveConfig(cfg);
        if (typeof ML.refreshConflictLog === 'function') {
            ML.refreshConflictLog();
        }
        return true;
    }

    function forEachDedupedPackage(callback) {
        var rows = dedupePackageRows(collectStoreRows('all'));
        rebuildMultiSourceMap(rows);
        var seenPkg = {};
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            if (seenPkg[row.packageName]) continue;
            seenPkg[row.packageName] = true;
            callback(enrichRow(row), row);
        }
    }

    function makeSourceId(name, catalogUrl) {
        var base = String(name || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
            .replace(/^-+|-+$/g, '');
        if (!base) {
            base = crypto.createHash('sha1').update(String(catalogUrl || '')).digest('hex').slice(0, 8);
        }
        var cfg = getConfig();
        var id = base;
        var n = 2;
        while (cfg.sources.some(function (s) { return s.id === id; })) {
            id = base + '-' + n;
            n++;
        }
        return id;
    }

    // ================================================================
    // 版本比对
    // ================================================================

    function normalizeVersion(raw) {
        if (raw == null) return null;
        var s = String(raw).trim();
        if (!s) return null;
        s = s.replace(/^[vV]/, '');
        var m = s.match(/(\d+(?:\.\d+)*)/);
        if (!m) return null;
        return m[1].split('.').map(function (p) {
            var n = parseInt(p, 10);
            return isFinite(n) ? n : 0;
        });
    }

    /**
     * @returns {number} -1 local<store · 0 equal/unknown-comparable · 1 local>store
     *          null if either side unknown
     */
    function compareVersions(localRaw, storeRaw) {
        var a = normalizeVersion(localRaw);
        var b = normalizeVersion(storeRaw);
        if (!a || !b) return null;
        var len = Math.max(a.length, b.length);
        for (var i = 0; i < len; i++) {
            var x = a[i] || 0;
            var y = b[i] || 0;
            if (x < y) return -1;
            if (x > y) return 1;
        }
        return 0;
    }

    function resolvePackageEntryFileName(entry) {
        var raw = String(entry).trim();
        if (!raw) return null;
        if (/[\\/]/.test(raw) || raw.indexOf('..') !== -1) return null;
        var fileName = pathMod.basename(raw);
        if (!/\.js$/i.test(fileName) || fileName === 'ModLoader.js') return null;
        return fileName;
    }

    function listRootJsFiles(packageRoot) {
        try {
            return fs.readdirSync(packageRoot).filter(function (f) {
                return /\.js$/i.test(f) && f !== 'ModLoader.js' &&
                    fs.statSync(pathMod.join(packageRoot, f)).isFile();
            });
        } catch (e) {
            return [];
        }
    }

    function discoverPackageScripts(packageRoot) {
        var scripts = [];
        var manifestPath = pathMod.join(packageRoot, 'modloader.json');
        var manifest = null;
        if (fs.existsSync(manifestPath)) {
            try {
                manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
            } catch (e) { /* ignore */ }
        }
        if (manifest && Array.isArray(manifest.entries) && manifest.entries.length > 0) {
            for (var i = 0; i < manifest.entries.length; i++) {
                var fileName = resolvePackageEntryFileName(manifest.entries[i]);
                if (!fileName) continue;
                if (fs.existsSync(pathMod.join(packageRoot, fileName))) scripts.push(fileName);
            }
            return scripts;
        }
        return listRootJsFiles(packageRoot);
    }

    function readLocalPackageVersion(packageName) {
        if (!isSafePackageName(packageName)) return { exists: false, version: null };
        var root = pathMod.join(LOCALMODS_DIR, packageName);
        if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
            return { exists: false, version: null };
        }

        var scripts = discoverPackageScripts(root);
        var isMultiScript = scripts.length > 1;
        var manifest = null;
        var manifestPath = pathMod.join(root, 'modloader.json');
        if (fs.existsSync(manifestPath)) {
            try {
                manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
            } catch (e) { /* fall through */ }
        }
        if (manifest && manifest.version != null && String(manifest.version).trim()) {
            return { exists: true, version: String(manifest.version).trim() };
        }
        if (isMultiScript) {
            return { exists: true, version: null };
        }

        try {
            for (var i = 0; i < scripts.length; i++) {
                var content = fs.readFileSync(pathMod.join(root, scripts[i]), 'utf-8');
                var block = content.match(/\/\*:[\s\S]*?\*\//);
                if (!block) continue;
                var vm = block[0].match(/@version\s+(.+?)$/m);
                if (vm && vm[1].trim()) {
                    return { exists: true, version: vm[1].trim() };
                }
            }
        } catch (e2) { /* ignore */ }

        return { exists: true, version: null };
    }

    function resolveEntryStatus(localInfo, storeVersion) {
        if (!localInfo.exists) return 'missing';
        var cmp = compareVersions(localInfo.version, storeVersion);
        if (cmp === null) return 'unknown';
        if (cmp < 0) return 'update';
        return 'latest';
    }

    // ================================================================
    // HTTP(S)
    // ================================================================

    function parseHttpsUrl(raw) {
        var u;
        try {
            u = new urlMod.URL(String(raw || ''));
        } catch (e) {
            throw new Error('URL 无效');
        }
        if (u.protocol !== 'https:') {
            throw new Error('仅允许 https');
        }
        return u;
    }

    function requestBuffer(rawUrl, options) {
        options = options || {};
        var maxBytes = options.maxBytes != null ? options.maxBytes : DEFAULT_MAX_BYTES;
        var onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
        var redirectLeft = options.redirectLeft != null ? options.redirectLeft : 5;
        var rangeStart = options.rangeStart != null ? options.rangeStart : 0;
        var u = parseHttpsUrl(rawUrl);

        return new Promise(function (resolve, reject) {
            var chunks = [];
            var received = 0;
            var settled = false;

            function fail(err) {
                if (settled) return;
                settled = true;
                reject(err instanceof Error ? err : new Error(String(err)));
            }

            function done(result) {
                if (settled) return;
                settled = true;
                resolve(result);
            }

            var headers = {
                'User-Agent': USER_AGENT,
                'Accept': '*/*'
            };
            if (rangeStart > 0) {
                headers['Range'] = 'bytes=' + rangeStart + '-';
            }

            var req = https.request(Object.assign({
                protocol: u.protocol,
                hostname: u.hostname,
                port: u.port || 443,
                path: u.pathname + u.search,
                method: 'GET',
                headers: headers,
                timeout: REQUEST_TIMEOUT_MS
            }, httpsTlsOptions(u.hostname)), function (res) {
                var code = res.statusCode || 0;
                if (code >= 300 && code < 400 && res.headers.location) {
                    res.resume();
                    if (redirectLeft <= 0) {
                        fail(new Error('重定向过多'));
                        return;
                    }
                    var next = res.headers.location;
                    try {
                        next = new urlMod.URL(next, u).href;
                    } catch (e) {
                        fail(new Error('重定向 URL 无效'));
                        return;
                    }
                    requestBuffer(next, {
                        maxBytes: maxBytes,
                        onProgress: onProgress,
                        redirectLeft: redirectLeft - 1,
                        rangeStart: rangeStart
                    }).then(done, fail);
                    return;
                }

                // 206 = 续传；若请求了 Range 却返回 200，由调用方决定是否整包重下
                if (code !== 200 && code !== 206) {
                    res.resume();
                    fail(new Error('HTTP ' + code));
                    return;
                }

                var contentLength = parseInt(res.headers['content-length'], 10);
                var total = null;
                if (code === 206) {
                    var cr = String(res.headers['content-range'] || '');
                    var m = cr.match(/\/(\d+)\s*$/);
                    if (m) total = parseInt(m[1], 10);
                    else if (isFinite(contentLength)) total = rangeStart + contentLength;
                } else if (isFinite(contentLength)) {
                    total = contentLength;
                }

                if (isFinite(total) && total > maxBytes) {
                    res.destroy();
                    fail(new Error('超过体积上限'));
                    return;
                }

                res.on('data', function (chunk) {
                    received += chunk.length;
                    var absolute = rangeStart + received;
                    if (absolute > maxBytes) {
                        res.destroy();
                        fail(new Error('超过体积上限'));
                        return;
                    }
                    chunks.push(chunk);
                    if (onProgress) {
                        var pct = isFinite(total) && total > 0
                            ? Math.min(99, Math.floor(absolute / total * 100))
                            : null;
                        onProgress({
                            received: absolute,
                            total: isFinite(total) ? total : null,
                            percent: pct,
                            statusCode: code
                        });
                    }
                });
                res.on('end', function () {
                    done({
                        buffer: Buffer.concat(chunks),
                        statusCode: code,
                        total: isFinite(total) ? total : null,
                        rangeStart: rangeStart
                    });
                });
                res.on('error', fail);
            });

            req.on('timeout', function () {
                req.destroy();
                fail(new Error('请求超时'));
            });
            req.on('error', fail);
            req.end();
        });
    }

    /**
     * 流式下载到文件；expectedSize > 50MB 时支持 Range 断点续传。
     * @returns {Promise<{ path: string, sha256: string, bytes: number }>}
     */
    function downloadToFile(rawUrl, destPath, options) {
        options = options || {};
        var maxBytes = options.maxBytes != null ? options.maxBytes : DEFAULT_MAX_BYTES;
        var expectedSize = options.expectedSize != null ? Number(options.expectedSize) : null;
        var onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
        var allowResume = expectedSize != null && expectedSize > RESUME_THRESHOLD_BYTES;

        ensureDir(pathMod.dirname(destPath));

        var existing = 0;
        if (fs.existsSync(destPath)) {
            existing = fs.statSync(destPath).size;
            if (expectedSize != null && existing >= expectedSize && expectedSize > 0) {
                // 已完整，直接校验哈希
                return hashFile(destPath).then(function (sha) {
                    if (onProgress) {
                        onProgress({
                            received: expectedSize,
                            total: expectedSize,
                            percent: 100,
                            speed: 0,
                            eta: 0
                        });
                    }
                    return { path: destPath, sha256: sha, bytes: expectedSize };
                });
            }
            if (!allowResume || existing <= 0) {
                removePathSafe(destPath);
                existing = 0;
            }
        }

        var startedAt = Date.now();
        var baselineExisting = existing;
        var lastUiAt = 0;

        function emitProgress(received, total) {
            if (!onProgress) return;
            var now = Date.now();
            if (now - lastUiAt < PROGRESS_UI_THROTTLE_MS && received !== total) return;
            lastUiAt = now;
            var elapsedSec = Math.max(0.001, (now - startedAt) / 1000);
            var delta = Math.max(0, received - baselineExisting);
            var speed = delta / elapsedSec;
            var pct = isFinite(total) && total > 0
                ? Math.min(99, Math.floor(received / total * 100))
                : null;
            var eta = (isFinite(total) && total > received && speed > 0)
                ? (total - received) / speed
                : null;
            onProgress({
                received: received,
                total: isFinite(total) ? total : null,
                percent: pct,
                speed: speed,
                eta: eta
            });
        }

        function openWriteStream(append) {
            return fs.createWriteStream(destPath, { flags: append ? 'a' : 'w' });
        }

        function pipeResponse(url, rangeStart, redirectLeft) {
            redirectLeft = redirectLeft != null ? redirectLeft : 5;
            var u = parseHttpsUrl(url);
            return new Promise(function (resolve, reject) {
                var headers = {
                    'User-Agent': USER_AGENT,
                    'Accept': '*/*'
                };
                if (rangeStart > 0) headers['Range'] = 'bytes=' + rangeStart + '-';

                var req = https.request(Object.assign({
                    protocol: u.protocol,
                    hostname: u.hostname,
                    port: u.port || 443,
                    path: u.pathname + u.search,
                    method: 'GET',
                    headers: headers,
                    timeout: allowResume ? 0 : REQUEST_TIMEOUT_MS
                }, httpsTlsOptions(u.hostname)), function (res) {
                    var code = res.statusCode || 0;
                    if (code >= 300 && code < 400 && res.headers.location) {
                        res.resume();
                        if (redirectLeft <= 0) {
                            reject(new Error('重定向过多'));
                            return;
                        }
                        var next = res.headers.location;
                        try {
                            next = new urlMod.URL(next, u).href;
                        } catch (e) {
                            reject(new Error('重定向 URL 无效'));
                            return;
                        }
                        pipeResponse(next, rangeStart, redirectLeft - 1).then(resolve, reject);
                        return;
                    }

                    if (rangeStart > 0 && code === 200) {
                        // 服务器不支持 Range：整包重下
                        res.resume();
                        removePathSafe(destPath);
                        baselineExisting = 0;
                        startedAt = Date.now();
                        pipeResponse(url, 0, redirectLeft).then(resolve, reject);
                        return;
                    }

                    if (code !== 200 && code !== 206) {
                        res.resume();
                        reject(new Error('HTTP ' + code));
                        return;
                    }

                    var contentLength = parseInt(res.headers['content-length'], 10);
                    var total = null;
                    if (code === 206) {
                        var cr = String(res.headers['content-range'] || '');
                        var m = cr.match(/\/(\d+)\s*$/);
                        if (m) total = parseInt(m[1], 10);
                        else if (isFinite(contentLength)) total = rangeStart + contentLength;
                    } else if (isFinite(contentLength)) {
                        total = contentLength;
                    }
                    if (expectedSize != null && isFinite(expectedSize)) {
                        total = expectedSize;
                    }

                    if (isFinite(total) && total > maxBytes) {
                        res.destroy();
                        reject(new Error('超过体积上限'));
                        return;
                    }

                    var received = rangeStart;
                    var ws = openWriteStream(rangeStart > 0);
                    var settled = false;

                    function fail(err) {
                        if (settled) return;
                        settled = true;
                        try { ws.destroy(); } catch (e1) { /* ignore */ }
                        try { res.destroy(); } catch (e2) { /* ignore */ }
                        reject(err instanceof Error ? err : new Error(String(err)));
                    }

                    ws.on('error', fail);
                    res.on('error', fail);
                    res.on('data', function (chunk) {
                        received += chunk.length;
                        if (received > maxBytes) {
                            fail(new Error('超过体积上限'));
                            return;
                        }
                        if (!ws.write(chunk)) {
                            res.pause();
                            ws.once('drain', function () { res.resume(); });
                        }
                        emitProgress(received, total);
                    });
                    res.on('end', function () {
                        ws.end(function () {
                            if (settled) return;
                            settled = true;
                            emitProgress(received, isFinite(total) ? total : received);
                            resolve({ bytes: received, total: total });
                        });
                    });
                });

                req.on('timeout', function () {
                    req.destroy();
                    reject(new Error('请求超时'));
                });
                req.on('error', reject);
                req.end();
            });
        }

        return pipeResponse(rawUrl, existing, 5).then(function () {
            return hashFile(destPath).then(function (sha) {
                var st = fs.statSync(destPath);
                return { path: destPath, sha256: sha, bytes: st.size };
            });
        });
    }

    function hashFile(filePath) {
        return new Promise(function (resolve, reject) {
            var hash = crypto.createHash('sha256');
            var stream = fs.createReadStream(filePath);
            stream.on('data', function (chunk) { hash.update(chunk); });
            stream.on('error', reject);
            stream.on('end', function () { resolve(hash.digest('hex')); });
        });
    }

    // 避免 http 未使用告警（仅 https）；保留引用便于日后扩展
    void http;

    // ================================================================
    // ZIP（内嵌 zlib，标准一层包目录）
    // ================================================================

    function isUnsafeZipEntryName(name) {
        if (!name) return true;
        var n = String(name).replace(/\\/g, '/');
        if (n.charAt(0) === '/' || n.charAt(0) === '\\') return true;
        if (/^[a-zA-Z]:/.test(n)) return true;
        var parts = n.split('/');
        for (var i = 0; i < parts.length; i++) {
            if (parts[i] === '..') return true;
        }
        return false;
    }

    /**
     * 解析 ZIP 中央目录，返回条目列表（含解压后的 Buffer）
     */
    function readZipEntries(buf) {
        if (!Buffer.isBuffer(buf) || buf.length < 22) {
            throw new Error('无效的 ZIP 文件');
        }
        var eocdPos = -1;
        var scanStart = Math.max(0, buf.length - 65557);
        for (var i = buf.length - 22; i >= scanStart; i--) {
            if (buf.readUInt32LE(i) === 0x06054b50) {
                eocdPos = i;
                break;
            }
        }
        if (eocdPos < 0) throw new Error('无效的 ZIP 文件（找不到 EOCD）');

        var totalEntries = buf.readUInt16LE(eocdPos + 10);
        var centralSize = buf.readUInt32LE(eocdPos + 12);
        var centralOffset = buf.readUInt32LE(eocdPos + 16);
        if (centralOffset + 4 > buf.length) throw new Error('无效的 ZIP 中央目录');

        var entries = [];
        var pos = centralOffset;
        var end = centralOffset + centralSize;

        for (var idx = 0; idx < totalEntries; idx++) {
            if (pos + 46 > buf.length) break;
            if (buf.readUInt32LE(pos) !== 0x02014b50) break;
            var gpFlag = buf.readUInt16LE(pos + 8);
            var method = buf.readUInt16LE(pos + 10);
            var compSize = buf.readUInt32LE(pos + 20);
            var uncompSize = buf.readUInt32LE(pos + 24);
            var nameLen = buf.readUInt16LE(pos + 28);
            var extraLen = buf.readUInt16LE(pos + 30);
            var commentLen = buf.readUInt16LE(pos + 32);
            var localOffset = buf.readUInt32LE(pos + 42);
            var nameBuf = buf.subarray(pos + 46, pos + 46 + nameLen);
            var name = nameBuf.toString((gpFlag & 0x800) ? 'utf8' : 'utf8');
            name = name.replace(/\\/g, '/');

            if (isUnsafeZipEntryName(name)) {
                throw new Error('ZIP 含不安全路径');
            }

            if (localOffset + 30 > buf.length) {
                throw new Error('无效的 ZIP 本地头');
            }
            if (buf.readUInt32LE(localOffset) !== 0x04034b50) {
                throw new Error('无效的 ZIP 本地头签名');
            }
            var lNameLen = buf.readUInt16LE(localOffset + 26);
            var lExtraLen = buf.readUInt16LE(localOffset + 28);
            var dataStart = localOffset + 30 + lNameLen + lExtraLen;
            if (dataStart + compSize > buf.length) {
                throw new Error('ZIP 数据越界');
            }
            var compData = buf.subarray(dataStart, dataStart + compSize);
            var outData = null;
            var isDir = /\/$/.test(name);
            if (!isDir) {
                if (method === 0) {
                    outData = Buffer.from(compData);
                } else if (method === 8) {
                    outData = zlib.inflateRawSync(compData);
                } else {
                    throw new Error('不支持的 ZIP 压缩方法: ' + method);
                }
                if (uncompSize > 0 && outData.length !== uncompSize) {
                    // 部分工具 uncompSize 不可靠，仅警告级跳过严格校验
                }
            }

            entries.push({
                name: name,
                isDir: isDir,
                data: outData
            });
            pos += 46 + nameLen + extraLen + commentLen;
            if (pos > end + 4) break;
        }
        return entries;
    }

    /**
     * 校验标准一层包目录，并解压到 destRoot/<packageName>/
     */
    function extractStandardPackage(zipBuf, packageName, destRoot) {
        if (!isSafePackageName(packageName)) {
            throw new Error('packageName 非法');
        }
        var entries = readZipEntries(zipBuf);
        if (!entries.length) throw new Error('格式不正确');

        var topNames = {};
        var hasRootFile = false;
        for (var i = 0; i < entries.length; i++) {
            var n = entries[i].name.replace(/^\/+/, '');
            if (!n || n === '/') continue;
            var parts = n.split('/');
            var top = parts[0];
            if (!top) continue;
            topNames[top] = true;
            if (parts.length === 1 && !entries[i].isDir) {
                hasRootFile = true;
            }
        }

        var tops = Object.keys(topNames);
        if (hasRootFile || tops.length !== 1 || tops[0] !== packageName) {
            throw new Error('格式不正确');
        }

        var prefix = packageName + '/';
        var outPkg = pathMod.join(destRoot, packageName);
        removePathSafe(outPkg);
        ensureDir(outPkg);

        var wroteFile = false;
        var hasJs = false;
        var hasManifest = false;

        for (var j = 0; j < entries.length; j++) {
            var ent = entries[j];
            var rel = ent.name.replace(/^\/+/, '');
            if (!rel || rel === packageName || rel === prefix) continue;
            if (rel.indexOf(prefix) !== 0) {
                throw new Error('格式不正确');
            }
            var inner = rel.slice(prefix.length);
            if (!inner || inner === '/') continue;
            if (isUnsafeZipEntryName(inner)) {
                throw new Error('ZIP 含不安全路径');
            }

            var outPath = pathMod.join(outPkg, inner);
            var resolved = pathMod.resolve(outPath);
            if (resolved !== outPkg && resolved.indexOf(outPkg + pathMod.sep) !== 0) {
                throw new Error('ZIP 含不安全路径');
            }

            if (ent.isDir || /\/$/.test(inner)) {
                ensureDir(outPath);
                continue;
            }
            ensureDir(pathMod.dirname(outPath));
            fs.writeFileSync(outPath, ent.data);
            wroteFile = true;
            if (/\.js$/i.test(inner) && inner.indexOf('/') === -1) hasJs = true;
            if (inner === 'modloader.json') hasManifest = true;
        }

        if (!wroteFile) throw new Error('格式不正确');

        if (hasManifest) {
            try {
                JSON.parse(fs.readFileSync(pathMod.join(outPkg, 'modloader.json'), 'utf-8'));
            } catch (e) {
                throw new Error('格式不正确');
            }
        } else if (!hasJs) {
            // 允许仅有子目录 js？计划：至少一个 .js 或合法 modloader.json
            // 再扫一遍包内任意 .js
            var anyJs = false;
            (function walk(dir) {
                var list = fs.readdirSync(dir, { withFileTypes: true });
                for (var k = 0; k < list.length; k++) {
                    if (list[k].isDirectory()) walk(pathMod.join(dir, list[k].name));
                    else if (/\.js$/i.test(list[k].name)) anyJs = true;
                }
            })(outPkg);
            if (!anyJs) throw new Error('格式不正确');
        }

        return outPkg;
    }

    function sha256Hex(buf) {
        return crypto.createHash('sha256').update(buf).digest('hex');
    }

    function assertDownloadHost(entry, downloadUrl) {
        var u = parseHttpsUrl(downloadUrl);
        var host = u.hostname.toLowerCase();
        var allowed = null;
        if (Array.isArray(entry.hosts) && entry.hosts.length) {
            allowed = entry.hosts.map(function (h) { return String(h).toLowerCase(); });
        } else {
            allowed = [host];
        }
        if (allowed.indexOf(host) === -1) {
            throw new Error('下载域名不在白名单');
        }
    }

    // ================================================================
    // Catalog / 列表模型
    // ================================================================

    function validateCatalog(raw, source) {
        if (!raw || typeof raw !== 'object') throw new Error('catalog 无效');
        var mods = Array.isArray(raw.mods) ? raw.mods : [];
        var list = [];
        for (var i = 0; i < mods.length; i++) {
            var m = mods[i];
            if (!m || typeof m !== 'object') continue;
            var id = String(m.id || '').trim();
            var packageName = String(m.packageName || '').trim();
            var version = String(m.version || '').trim();
            var downloadUrl = String(m.downloadUrl || '').trim();
            var sha256 = String(m.sha256 || '').trim().toLowerCase();
            if (!packageName || !version || !downloadUrl || !sha256) continue;
            if (!isSafePackageName(packageName)) continue;
            id = packageName;
            if (!/^[a-f0-9]{64}$/.test(sha256)) continue;
            try {
                parseHttpsUrl(downloadUrl);
            } catch (e) {
                continue;
            }
            list.push({
                id: id,
                packageName: packageName,
                title: String(m.title || packageName).trim() || packageName,
                version: version,
                downloadUrl: downloadUrl,
                sha256: sha256,
                size: (function () {
                    var n = Number(m.size);
                    return isFinite(n) && n > 0 ? Math.floor(n) : null;
                })(),
                summary: String(m.summary || '').trim(),
                hosts: Array.isArray(m.hosts) ? m.hosts.slice() : null,
                sourceId: source.id,
                sourceName: source.name
            });
        }
        return {
            schema: raw.schema,
            sourceId: raw.sourceId || source.id,
            sourceName: raw.sourceName || source.name,
            updatedAt: raw.updatedAt || '',
            mods: list
        };
    }

    function fetchOneCatalog(source) {
        return requestBuffer(source.catalogUrl, {
            maxBytes: Math.min(getConfig().maxDownloadBytes, 2 * 1024 * 1024)
        }).then(function (result) {
            var buf = Buffer.isBuffer(result) ? result : result.buffer;
            var text = buf.toString('utf-8');
            var json = JSON.parse(text);
            return validateCatalog(json, source);
        });
    }

    function rebuildMultiSourceMap(rows) {
        var counts = {};
        for (var i = 0; i < rows.length; i++) {
            var pkg = rows[i].packageName;
            if (!pkg) continue;
            counts[pkg] = (counts[pkg] || 0) + 1;
        }
        _multiSourceIds = {};
        Object.keys(counts).forEach(function (pkg) {
            if (counts[pkg] > 1) _multiSourceIds[pkg] = true;
        });
    }

    function dedupePackageRows(rows) {
        var map = {};
        var out = [];
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            var key = row.sourceId + '::' + row.packageName;
            if (!map[key]) {
                map[key] = row;
                out.push(row);
                continue;
            }
            var prev = map[key];
            if (row.id === row.packageName && prev.id !== prev.packageName) {
                var idx = out.indexOf(prev);
                out[idx] = row;
                map[key] = row;
            }
        }
        return out;
    }

    function collectStoreRows(filterSourceId) {
        var rows = [];
        var cfg = getConfig();
        for (var i = 0; i < cfg.sources.length; i++) {
            var src = cfg.sources[i];
            if (!src.enabled) continue;
            if (filterSourceId && filterSourceId !== 'all' && src.id !== filterSourceId) continue;
            var cached = _catalogBySource[src.id];
            if (!cached || !cached.ok || !cached.catalog) continue;
            var mods = cached.catalog.mods || [];
            for (var j = 0; j < mods.length; j++) {
                rows.push(mods[j]);
            }
        }
        return rows;
    }

    function enrichRow(row) {
        var local = readLocalPackageVersion(row.packageName);
        var status = resolveEntryStatus(local, row.version);
        var key = jobKey(row.sourceId, row.packageName);
        var job = _jobState[key] || null;
        return {
            row: row,
            local: local,
            status: status,
            isNew: isModNew(row.packageName),
            multiSource: !!_multiSourceIds[row.packageName],
            job: job
        };
    }

    function countUpdatable() {
        var n = 0;
        forEachDedupedPackage(function (info) {
            if (info.status === 'update') n++;
        });
        return n;
    }

    function countNew() {
        var n = 0;
        forEachDedupedPackage(function (info) {
            if (info.isNew) n++;
        });
        return n;
    }

    /** 齿轮角标：可更新 + 未查看的新增 Mod（按 packageName 去重） */
    function countBadgeNotices() {
        var n = 0;
        forEachDedupedPackage(function (info) {
            if (info.status === 'update' || info.isNew) n++;
        });
        return n;
    }

    /** 一键更新可自动处理的条目（跳过多源，须玩家手动选来源） */
    function countAutoUpdatable() {
        var rows = dedupePackageRows(collectStoreRows('all'));
        rebuildMultiSourceMap(rows);
        var seenPkg = {};
        var n = 0;
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            var info = enrichRow(row);
            if (info.status !== 'update') continue;
            if (_multiSourceIds[row.packageName]) continue;
            if (seenPkg[row.packageName]) continue;
            seenPkg[row.packageName] = true;
            n++;
        }
        return n;
    }

    function countMultiSourceUpdatable() {
        var rows = dedupePackageRows(collectStoreRows('all'));
        rebuildMultiSourceMap(rows);
        var pkgs = {};
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            var info = enrichRow(row);
            if (info.status === 'update' && _multiSourceIds[row.packageName]) pkgs[row.packageName] = true;
        }
        return Object.keys(pkgs).length;
    }

    function refreshAllCatalogs() {
        var cfg = getConfig();
        var enabled = cfg.sources.filter(function (s) { return s.enabled; });
        var tasks = enabled.map(function (src) {
            return fetchOneCatalog(src).then(function (catalog) {
                _catalogBySource[src.id] = {
                    ok: true,
                    catalog: catalog,
                    error: null,
                    fetchedAt: Date.now()
                };
            }, function (err) {
                _catalogBySource[src.id] = {
                    ok: false,
                    catalog: null,
                    error: err && err.message ? err.message : String(err),
                    fetchedAt: Date.now()
                };
            });
        });
        return Promise.all(tasks).then(function () {
            rebuildMultiSourceMap(dedupePackageRows(collectStoreRows('all')));
            if (typeof ML.refreshConflictLog === 'function') {
                ML.refreshConflictLog();
            }
        });
    }

    // ================================================================
    // 下载队列 / 安装
    // ================================================================

    function setJob(sourceId, modId, patch) {
        var key = jobKey(sourceId, modId);
        var cur = _jobState[key] || {
            status: 'idle',
            progress: 0,
            received: 0,
            total: null,
            speed: 0,
            eta: null,
            error: ''
        };
        for (var k in patch) {
            if (Object.prototype.hasOwnProperty.call(patch, k)) cur[k] = patch[k];
        }
        _jobState[key] = cur;
        if (_viewMode === 'list') {
            refreshListView();
        } else {
            rerenderListOnly();
        }
    }

    function installFromEntry(entry) {
        var cfg = getConfig();
        var maxBytes = cfg.maxDownloadBytes || DEFAULT_MAX_BYTES;
        var tmpId = 'dl-' + Date.now() + '-' + Math.random().toString(16).slice(2);
        var tmpDir = pathMod.join(TMP_ROOT, tmpId);
        var extractRoot = pathMod.join(tmpDir, 'extract');
        // 大包续传：按 sha256 固定 partial，失败重试可接着下
        var resumeDir = pathMod.join(TMP_ROOT, 'resume');
        var partialPath = pathMod.join(resumeDir, entry.sha256 + '.partial');
        var zipPath = pathMod.join(tmpDir, 'pack.zip');

        ensureDir(tmpDir);
        ensureDir(extractRoot);
        ensureDir(resumeDir);

        setJob(entry.sourceId, entry.packageName, {
            status: 'downloading',
            progress: 0,
            received: 0,
            total: entry.size || null,
            speed: 0,
            eta: null,
            error: ''
        });

        return Promise.resolve()
            .then(function () {
                assertDownloadHost(entry, entry.downloadUrl);
                return downloadToFile(entry.downloadUrl, partialPath, {
                    maxBytes: maxBytes,
                    expectedSize: entry.size,
                    onProgress: function (p) {
                        setJob(entry.sourceId, entry.packageName, {
                            status: 'downloading',
                            progress: p.percent != null ? p.percent : 0,
                            received: p.received || 0,
                            total: p.total != null ? p.total : (entry.size || null),
                            speed: p.speed || 0,
                            eta: p.eta,
                            error: ''
                        });
                    }
                });
            })
            .then(function (dl) {
                setJob(entry.sourceId, entry.packageName, {
                    status: 'verifying',
                    progress: 100,
                    received: dl.bytes,
                    total: dl.bytes,
                    speed: 0,
                    eta: 0,
                    error: ''
                });
                if (dl.sha256 !== entry.sha256.toLowerCase()) {
                    removePathSafe(partialPath);
                    throw new Error('sha256 校验失败');
                }
                fs.copyFileSync(partialPath, zipPath);
                setJob(entry.sourceId, entry.packageName, {
                    status: 'extracting',
                    progress: 100,
                    received: dl.bytes,
                    total: dl.bytes,
                    error: ''
                });
                var buf = fs.readFileSync(partialPath);
                var extractedPkg = extractStandardPackage(buf, entry.packageName, extractRoot);
                ensureDir(LOCALMODS_DIR);
                var finalPkg = pathMod.join(LOCALMODS_DIR, entry.packageName);
                var backup = finalPkg + '.bak-' + Date.now();
                var hadOld = fs.existsSync(finalPkg);
                if (hadOld) {
                    removePathSafe(backup);
                    fs.renameSync(finalPkg, backup);
                }
                try {
                    copyDirRecursive(extractedPkg, finalPkg);
                    if (hadOld) removePathSafe(backup);
                } catch (e) {
                    removePathSafe(finalPkg);
                    if (hadOld && fs.existsSync(backup)) {
                        try { fs.renameSync(backup, finalPkg); } catch (e2) { /* ignore */ }
                    }
                    throw e;
                }
                removePathSafe(partialPath);
                setJob(entry.sourceId, entry.packageName, {
                    status: 'done',
                    progress: 100,
                    received: dl.bytes,
                    total: dl.bytes,
                    error: ''
                });
                return true;
            })
            .catch(function (err) {
                setJob(entry.sourceId, entry.packageName, {
                    status: 'error',
                    progress: 0,
                    error: err && err.message ? err.message : String(err)
                });
                throw err;
            })
            .then(function (ok) {
                removePathSafe(tmpDir);
                return ok;
            }, function (err) {
                removePathSafe(tmpDir);
                throw err;
            });
    }

    function enqueueInstall(entry) {
        var key = jobKey(entry.sourceId, entry.packageName);
        var cur = _jobState[key];
        if (cur && (cur.status === 'queued' || cur.status === 'downloading' ||
            cur.status === 'verifying' || cur.status === 'extracting')) {
            return false;
        }
        setJob(entry.sourceId, entry.packageName, {
            status: 'queued',
            progress: 0,
            received: 0,
            total: entry.size || null,
            speed: 0,
            eta: null,
            error: ''
        });
        _queue.push(entry);
        pumpQueue();
        return true;
    }

    /** 一键更新：可自动处理的条目；多源 Mod 须玩家逐条选择来源 */
    function enqueueAllUpdates() {
        var rows = dedupePackageRows(collectStoreRows('all'));
        rebuildMultiSourceMap(rows);
        var seenPkg = {};
        var skippedMultiPkgs = {};
        var queued = 0;
        var skippedMulti = 0;
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            var info = enrichRow(row);
            if (info.status !== 'update') continue;
            if (_multiSourceIds[row.packageName]) {
                if (!skippedMultiPkgs[row.packageName]) {
                    skippedMultiPkgs[row.packageName] = true;
                    skippedMulti++;
                }
                continue;
            }
            if (seenPkg[row.packageName]) continue;
            seenPkg[row.packageName] = true;
            if (enqueueInstall(row)) queued++;
        }
        return { queued: queued, skippedMulti: skippedMulti };
    }

    function pumpQueue() {
        while (_activeJobs < DOWNLOAD_CONCURRENCY && _queue.length > 0) {
            var entry = _queue.shift();
            _activeJobs++;
            installFromEntry(entry).then(function () {
                _activeJobs--;
                pumpQueue();
                showInstallHint();
                if (_panelRoot) refreshListView();
            }, function () {
                _activeJobs--;
                pumpQueue();
                if (_panelRoot) refreshListView();
            });
        }
    }

    function showInstallHint() {
        var cfg = getConfig();
        if (cfg.suppressInstallHint) return;
        ensureStyles();
        if (document.getElementById('ml-store-hint-overlay')) return;

        var overlay = document.createElement('div');
        overlay.id = 'ml-store-hint-overlay';
        overlay.className = 'ml-store-hint-overlay';
        overlay.innerHTML =
            '<div class="ml-store-hint-modal" role="dialog">' +
            '<div class="ml-store-hint-header">安装完成</div>' +
            '<div class="ml-store-hint-body">' +
            '<p>Mod 已写入本地目录。请关闭商店面板，在主界面点击「刷新列表」，即可识别新包或更新。</p>' +
            '<label class="ml-store-hint-check">' +
            '<input type="checkbox" id="ml-store-hint-suppress"> 不再提示' +
            '</label>' +
            '</div>' +
            '<div class="ml-store-hint-footer">' +
            '<button type="button" class="ml-btn ml-btn-primary" id="ml-store-hint-ok">知道了</button>' +
            '</div>' +
            '</div>';

        function closeHint() {
            var box = document.getElementById('ml-store-hint-suppress');
            if (box && box.checked) {
                var next = getConfig();
                next.suppressInstallHint = true;
                saveConfig(next);
            }
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        }

        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) closeHint();
        });
        document.body.appendChild(overlay);
        var okBtn = document.getElementById('ml-store-hint-ok');
        if (okBtn) okBtn.addEventListener('click', closeHint);
    }

    // ================================================================
    // UI
    // ================================================================

    function ensureStyles() {
        if (document.getElementById('ml-store-styles')) return;
        var style = document.createElement('style');
        style.id = 'ml-store-styles';
        style.textContent = [
            '.ml-store{display:flex;flex-direction:column;height:100%;min-height:0;padding:0 0 8px;box-sizing:border-box;font-size:13px;color:var(--ml-text-primary,#e8e8ec);}',
            '.ml-store-toolbar{display:flex;gap:8px;align-items:center;padding:4px 16px 10px;flex-shrink:0;flex-wrap:wrap;}',
            '.ml-store-toolbar .ml-btn{font-size:12px;padding:6px 12px;}',
            '.ml-store-hint{padding:0 16px 8px;color:var(--ml-text-muted,#666680);font-size:12px;line-height:1.5;}',
            '.ml-store-tabs{display:flex;gap:6px;padding:0 16px 10px;flex-wrap:wrap;flex-shrink:0;align-items:center;}',
            '.ml-store-tabs-label{font-size:11px;color:var(--ml-text-muted,#666680);margin-right:2px;flex-shrink:0;}',
            '.ml-store-status-tabs{padding-top:0;margin-top:-4px;}',
            '.ml-store-tab{border:1px solid var(--ml-border,rgba(255,255,255,.08));background:transparent;color:var(--ml-text-secondary,#9a9ab0);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:12px;}',
            '.ml-store-tab.is-active{background:var(--ml-bg-active,rgba(74,158,255,.12));border-color:var(--ml-accent,#4a9eff);color:var(--ml-accent,#4a9eff);}',
            '.ml-store-list{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:0 8px;}',
            '.ml-store-sources-scroll{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;}',
            '.ml-store-empty{padding:28px 16px;text-align:center;color:var(--ml-text-muted,#666680);font-size:13px;line-height:1.6;}',
            '.ml-store-item{margin:0 8px 8px;padding:10px 12px;border:1px solid var(--ml-border,rgba(255,255,255,.08));border-radius:8px;background:var(--ml-bg-secondary,rgba(28,28,48,.95));cursor:default;}',
            '.ml-store-item-title{font-weight:600;font-size:13px;margin-bottom:4px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;}',
            '.ml-store-badge{font-size:10px;padding:1px 6px;border-radius:4px;background:var(--ml-warning-bg,rgba(255,167,38,.15));color:var(--ml-warning,#ffa726);font-weight:600;}',
            '.ml-store-badge-new{background:rgba(76,175,80,.2);color:var(--ml-success,#66bb6a);cursor:pointer;}',
            '.ml-store-item-has-new{cursor:pointer;}',
            '.ml-store-meta{font-size:12px;color:var(--ml-text-secondary,#9a9ab0);line-height:1.6;margin-bottom:8px;}',
            '.ml-store-summary{font-size:12px;color:var(--ml-text-muted,#666680);margin-bottom:8px;}',
            '.ml-store-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}',
            '.ml-store-actions .ml-btn:disabled{opacity:.5;cursor:not-allowed;}',
            '.ml-store-progress,.ml-store-error{font-size:12px;color:var(--ml-text-secondary,#9a9ab0);line-height:1.5;max-width:100%;}',
            '.ml-store-update-all:disabled{opacity:.5;cursor:not-allowed;}',
            '.ml-store-error{color:var(--ml-danger,#ef5350);}',
            '.ml-store-src-err{margin:0 16px 8px;padding:8px 10px;border-radius:6px;background:var(--ml-danger-bg,rgba(239,83,80,.15));color:var(--ml-danger,#ef5350);font-size:12px;}',
            '.ml-store-sources{padding:0 16px 12px;}',
            '.ml-store-settings-block{padding:10px 12px;margin-bottom:10px;border:1px solid var(--ml-border,rgba(255,255,255,.08));border-radius:8px;}',
            '.ml-store-settings-title{font-size:13px;font-weight:600;margin-bottom:8px;}',
            '.ml-store-settings-hint{font-size:11px;color:var(--ml-text-muted,#666680);margin:6px 0 8px;line-height:1.5;}',
            '.ml-store-max-label input{max-width:120px;}',
            '.ml-store-src-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:8px 0;border-bottom:1px solid var(--ml-border,rgba(255,255,255,.08));}',
            '.ml-store-src-row:last-child{border-bottom:none;}',
            '.ml-store-src-name{font-weight:600;min-width:80px;}',
            '.ml-store-src-url{flex:1;min-width:140px;font-size:11px;color:var(--ml-text-muted,#666680);word-break:break-all;}',
            '.ml-store-form{display:flex;flex-direction:column;gap:8px;padding:12px;margin-top:8px;border:1px dashed var(--ml-border-light,rgba(255,255,255,.15));border-radius:8px;}',
            '.ml-store-form label{font-size:12px;color:var(--ml-text-secondary,#9a9ab0);display:flex;flex-direction:column;gap:4px;}',
            '.ml-store-form input{padding:6px 8px;border-radius:6px;border:1px solid var(--ml-border,rgba(255,255,255,.08));background:var(--ml-bg-tertiary,rgba(38,38,58,.9));color:var(--ml-text-primary,#e8e8ec);font-size:12px;}',
            '.ml-store-form-actions{display:flex;gap:8px;}',
            '.ml-store-hint-overlay{position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;}',
            '.ml-store-hint-modal{width:min(420px,100%);background:var(--ml-bg-primary,#fff8f0);border:1px solid var(--ml-border-light,rgba(160,120,80,.3));border-radius:var(--ml-radius-lg,14px);box-shadow:var(--ml-shadow-lg,0 20px 60px rgba(0,0,0,.35));overflow:hidden;color:var(--ml-text-primary,#3d2b1a);}',
            '.ml-store-hint-header{padding:14px 16px 10px;font-size:14px;font-weight:600;border-bottom:1px solid var(--ml-border,rgba(160,120,80,.2));background:var(--ml-bg-secondary,rgba(245,235,220,.95));}',
            '.ml-store-hint-body{padding:14px 16px;font-size:13px;line-height:1.6;}',
            '.ml-store-hint-body p{margin:0 0 12px;}',
            '.ml-store-hint-check{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--ml-text-secondary,#6b5a4a);cursor:pointer;user-select:none;}',
            '.ml-store-hint-footer{padding:10px 16px 14px;display:flex;justify-content:flex-end;border-top:1px solid var(--ml-border,rgba(160,120,80,.2));}'
        ].join('');
        document.head.appendChild(style);
    }

    function statusButtonLabel(status) {
        if (status === 'missing') return '下载';
        if (status === 'update') return '更新';
        if (status === 'latest') return '已是最新';
        if (status === 'unknown') return '下载覆盖';
        return '下载';
    }

    function statusButtonDisabled(status, job) {
        if (job && (job.status === 'queued' || job.status === 'downloading' ||
            job.status === 'verifying' || job.status === 'extracting')) return true;
        return status === 'latest';
    }

    function jobStatusText(job) {
        if (!job) return '';
        if (job.status === 'queued') return '排队中…';
        if (job.status === 'downloading') {
            var recv = formatBytes(job.received || 0);
            var totalPart = job.total != null ? formatBytes(job.total) : '？';
            var pct = (job.progress != null && job.total) ? (job.progress + '%') : '…';
            var speed = formatSpeed(job.speed || 0);
            var eta = formatEta(job.eta);
            return '下载中 ' + recv + ' / ' + totalPart + '（' + pct + '）· ' + speed + ' · 剩余 ' + eta;
        }
        if (job.status === 'verifying') return '校验中…';
        if (job.status === 'extracting') return '解压中…';
        if (job.status === 'done') return '完成';
        if (job.status === 'error') return job.error || '失败';
        return '';
    }

    function getListScrollEl() {
        if (!_panelRoot) return null;
        if (_viewMode === 'sources') {
            return _panelRoot.querySelector('.ml-store-sources-scroll');
        }
        return _panelRoot.querySelector('.ml-store-list');
    }

    function saveListScroll() {
        var el = getListScrollEl();
        _listScrollTop = el ? el.scrollTop : 0;
    }

    function restoreListScroll() {
        var el = getListScrollEl();
        if (el) el.scrollTop = _listScrollTop;
    }

    function updateToolbar() {
        if (!_panelRoot || _viewMode !== 'list') return;
        var btn = _panelRoot.querySelector('.ml-store-update-all');
        if (!btn) return;
        var n = countAutoUpdatable();
        var multi = countMultiSourceUpdatable();
        btn.disabled = n <= 0;
        btn.textContent = '更新已安装（' + n + '）';
        btn.title = multi > 0 ? '多源 Mod 需逐条选择来源，不会纳入一键更新' : '';
    }

    function countMissing() {
        var rows = dedupePackageRows(collectStoreRows('all'));
        var n = 0;
        for (var i = 0; i < rows.length; i++) {
            if (enrichRow(rows[i]).status === 'missing') n++;
        }
        return n;
    }

    function applyDefaultStatusFilter() {
        if (countUpdatable() > 0) {
            _activeStatusFilter = 'update';
        } else if (countNew() > 0) {
            _activeStatusFilter = 'new';
        } else if (countMissing() > 0) {
            _activeStatusFilter = 'missing';
        } else {
            _activeStatusFilter = 'all';
        }
    }

    function rowMatchesStatusFilter(info) {
        if (_activeStatusFilter === 'update') return info.status === 'update';
        if (_activeStatusFilter === 'new') return info.isNew;
        if (_activeStatusFilter === 'missing') return info.status === 'missing';
        return true;
    }

    function buildStatusTabsHtml() {
        var upd = countUpdatable();
        var newest = countNew();
        var miss = countMissing();
        var html = '<span class="ml-store-tabs-label">状态</span>';
        html += buildStatusTabBtn('all', '全部');
        html += buildStatusTabBtn('update', '可更新' + (upd > 0 ? '（' + upd + '）' : ''));
        html += buildStatusTabBtn('new', '新增' + (newest > 0 ? '（' + newest + '）' : ''));
        html += buildStatusTabBtn('missing', '未下载' + (miss > 0 ? '（' + miss + '）' : ''));
        return html;
    }

    function buildStatusTabBtn(id, label) {
        return '<button type="button" class="ml-store-tab ml-store-status-tab' +
            (_activeStatusFilter === id ? ' is-active' : '') +
            '" data-status="' + escHtml(id) + '">' + escHtml(label) + '</button>';
    }

    function bindStatusTabEvents(root) {
        var tabs = root.querySelectorAll('.ml-store-status-tab');
        for (var i = 0; i < tabs.length; i++) {
            tabs[i].addEventListener('click', function (e) {
                _statusFilterPinnedByUser = true;
                _activeStatusFilter = e.currentTarget.getAttribute('data-status') || 'all';
                _listScrollTop = 0;
                refreshListView();
            });
        }
    }

    function syncStatusTabsUi() {
        if (!_panelRoot || _viewMode !== 'list') return;
        var wrap = _panelRoot.querySelector('.ml-store-status-tabs');
        if (!wrap) return;
        wrap.innerHTML = buildStatusTabsHtml();
        bindStatusTabEvents(wrap);
    }

    function refreshListView() {
        if (!_panelRoot || _viewMode !== 'list') return;
        saveListScroll();
        updateToolbar();
        syncStatusTabsUi();
        rerenderListOnly();
        restoreListScroll();
    }

    function rerenderListOnly() {
        if (!_panelRoot || _viewMode !== 'list') return;
        var list = _panelRoot.querySelector('.ml-store-list');
        if (!list) return;
        list.innerHTML = buildListHtml();
        bindListEvents(list);
    }

    function buildListHtml() {
        var cfg = getConfig();
        var enabled = cfg.sources.filter(function (s) { return s.enabled; });
        if (!enabled.length) {
            return '<div class="ml-store-empty">尚未订阅任何来源。<br>点击「订阅管理」添加 catalog URL。</div>';
        }

        var errHtml = '';
        for (var i = 0; i < enabled.length; i++) {
            var c = _catalogBySource[enabled[i].id];
            if (c && !c.ok) {
                errHtml += '<div class="ml-store-src-err">来源「' + escHtml(enabled[i].name) +
                    '」加载失败：' + escHtml(c.error || '未知错误') + '</div>';
            }
        }

        var filter = _activeTab === 'all' ? 'all' : _activeTab;
        var rows = dedupePackageRows(collectStoreRows(filter));
        rebuildMultiSourceMap(dedupePackageRows(collectStoreRows('all')));

        if (!rows.length) {
            var anyOk = enabled.some(function (s) {
                return _catalogBySource[s.id] && _catalogBySource[s.id].ok;
            });
            var anyFetched = enabled.some(function (s) {
                return !!_catalogBySource[s.id];
            });
            if (!anyFetched) {
                return errHtml + '<div class="ml-store-empty">点击「刷新」拉取订阅目录。</div>';
            }
            if (!anyOk) {
                return errHtml + '<div class="ml-store-empty">所有已启用来源均加载失败。</div>';
            }
            return errHtml + '<div class="ml-store-empty">当前来源没有可显示的 Mod。</div>';
        }

        var html = errHtml;
        var shown = 0;
        for (var j = 0; j < rows.length; j++) {
            var info = enrichRow(rows[j]);
            if (!rowMatchesStatusFilter(info)) continue;
            shown++;
            var r = info.row;
            var localText = !info.local.exists
                ? '未下载'
                : (info.local.version || '未知');
            var disabled = statusButtonDisabled(info.status, info.job);
            var label = statusButtonLabel(info.status);
            var jobText = jobStatusText(info.job);
            var jobClass = info.job && info.job.status === 'error' ? 'ml-store-error' : 'ml-store-progress';

            html += '<div class="ml-store-item' + (info.isNew ? ' ml-store-item-has-new' : '') +
                '" data-source="' + escHtml(r.sourceId) +
                '" data-mod="' + escHtml(r.packageName) + '">';
            html += '<div class="ml-store-item-title">' + escHtml(r.packageName);
            if (info.isNew) {
                html += '<span class="ml-store-badge ml-store-badge-new" title="点击查看">New</span>';
            }
            if (info.multiSource) {
                html += '<span class="ml-store-badge">多源</span>';
            }
            html += '</div>';
            if (r.summary) {
                html += '<div class="ml-store-summary">' + escHtml(r.summary) + '</div>';
            }
            html += '<div class="ml-store-meta">本地: ' + escHtml(localText) +
                '　商店: ' + escHtml(r.version) +
                '　大小: ' + escHtml(r.size != null ? formatBytes(r.size) : '未知') +
                '　来源: ' + escHtml(r.sourceName) + '</div>';
            html += '<div class="ml-store-actions">';
            html += '<button type="button" class="ml-btn ml-btn-primary ml-store-action-btn"' +
                (disabled ? ' disabled' : '') + '>' + escHtml(label) + '</button>';
            if (jobText) {
                html += '<span class="' + jobClass + '">' + escHtml(jobText) + '</span>';
            }
            html += '</div></div>';
        }
        if (!shown) {
            var filterLabel = _activeStatusFilter === 'update' ? '可更新'
                : (_activeStatusFilter === 'new' ? '新增'
                    : (_activeStatusFilter === 'missing' ? '未下载' : ''));
            var msg = filterLabel
                ? '当前来源下没有「' + filterLabel + '」的 Mod。'
                : '当前来源没有可显示的 Mod。';
            return errHtml + '<div class="ml-store-empty">' + escHtml(msg) + '</div>';
        }
        return html;
    }

    function bindListEvents(listEl) {
        var items = listEl.querySelectorAll('.ml-store-item');
        for (var i = 0; i < items.length; i++) {
            items[i].addEventListener('click', function (e) {
                var item = e.currentTarget;
                var modId = item.getAttribute('data-mod');
                if (modId && isModNew(modId)) {
                    markPackageSeen(modId);
                    syncStatusTabsUi();
                    updateToolbar();
                    rerenderListOnly();
                }
            });
        }
        var btns = listEl.querySelectorAll('.ml-store-action-btn');
        for (var j = 0; j < btns.length; j++) {
            btns[j].addEventListener('click', function (e) {
                e.stopPropagation();
                var item = e.currentTarget.closest('.ml-store-item');
                if (!item) return;
                var sourceId = item.getAttribute('data-source');
                var modId = item.getAttribute('data-mod');
                var rows = dedupePackageRows(collectStoreRows('all'));
                var entry = null;
                for (var k = 0; k < rows.length; k++) {
                    if (rows[k].sourceId === sourceId && rows[k].packageName === modId) {
                        entry = rows[k];
                        break;
                    }
                }
                if (entry) enqueueInstall(entry);
            });
        }
    }

    function buildTabsHtml() {
        var cfg = getConfig();
        var html = '<button type="button" class="ml-store-tab' +
            (_activeTab === 'all' ? ' is-active' : '') + '" data-tab="all">全部</button>';
        for (var i = 0; i < cfg.sources.length; i++) {
            var s = cfg.sources[i];
            if (!s.enabled) continue;
            html += '<button type="button" class="ml-store-tab' +
                (_activeTab === s.id ? ' is-active' : '') +
                '" data-tab="' + escHtml(s.id) + '">' + escHtml(s.name) + '</button>';
        }
        return html;
    }

    function applyMaxDownloadMbInput(root) {
        var el = root.querySelector('.ml-store-max-mb');
        if (!el) return;
        var mb = parseInt(el.value, 10);
        if (!isFinite(mb) || mb < 1) {
            alertStore('请输入 1～2048 之间的整数（MB）');
            return false;
        }
        if (mb > 2048) mb = 2048;
        var cfg = getConfig();
        cfg.maxDownloadBytes = mb * 1024 * 1024;
        saveConfig(cfg);
        el.value = String(mb);
        return true;
    }

    function buildSourcesHtml() {
        var cfg = getConfig();
        var maxMb = Math.round(cfg.maxDownloadBytes / (1024 * 1024));
        var html = '<div class="ml-store-sources">';
        html += '<div class="ml-store-settings-block">';
        html += '<div class="ml-store-settings-title">下载设置</div>';
        html += '<label class="ml-store-max-label">单包体积上限（MB）';
        html += '<input type="number" class="ml-store-max-mb" min="1" max="2048" step="1" value="' + maxMb + '">';
        html += '</label>';
        html += '<div class="ml-store-settings-hint">默认 100MB。超过此大小的 Mod 将中止下载（可调低做拦截测试）。</div>';
        html += '<button type="button" class="ml-btn ml-btn-secondary ml-store-save-max-btn">保存上限</button>';
        html += '</div>';
        if (!cfg.sources.length) {
            html += '<div class="ml-store-empty" style="padding:12px 0;">暂无订阅来源。</div>';
        }
        for (var i = 0; i < cfg.sources.length; i++) {
            var s = cfg.sources[i];
            html += '<div class="ml-store-src-row" data-id="' + escHtml(s.id) + '">';
            html += '<span class="ml-store-src-name">' + escHtml(s.name) + '</span>';
            html += '<span class="ml-store-src-url">' + escHtml(s.catalogUrl) + '</span>';
            html += '<label style="font-size:12px;display:flex;align-items:center;gap:4px;">' +
                '<input type="checkbox" class="ml-store-src-enable"' +
                (s.enabled ? ' checked' : '') + '>启用</label>';
            html += '<button type="button" class="ml-btn ml-btn-danger ml-store-src-del">删除</button>';
            html += '</div>';
        }
        html += '<div class="ml-store-form">';
        html += '<label>显示名<input type="text" class="ml-store-add-name" placeholder="例如：作者 Foo"></label>';
        html += '<label>Catalog URL（https）<input type="text" class="ml-store-add-url" placeholder="https://example.com/mods/catalog.json"></label>';
        html += '<div class="ml-store-form-actions">';
        html += '<button type="button" class="ml-btn ml-btn-primary ml-store-add-btn">添加来源</button>';
        html += '<button type="button" class="ml-btn ml-btn-secondary ml-store-back-btn">返回商店</button>';
        html += '</div></div></div>';
        return html;
    }

    function bindSourcesEvents(root) {
        var saveMaxBtn = root.querySelector('.ml-store-save-max-btn');
        if (saveMaxBtn) {
            saveMaxBtn.addEventListener('click', function () {
                if (applyMaxDownloadMbInput(root)) {
                    alertStore('已保存下载体积上限');
                }
            });
        }
        var maxMbEl = root.querySelector('.ml-store-max-mb');
        if (maxMbEl) {
            maxMbEl.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (applyMaxDownloadMbInput(root)) {
                        alertStore('已保存下载体积上限');
                    }
                }
            });
        }
        var enables = root.querySelectorAll('.ml-store-src-enable');
        for (var i = 0; i < enables.length; i++) {
            enables[i].addEventListener('change', function (e) {
                var row = e.currentTarget.closest('.ml-store-src-row');
                var id = row && row.getAttribute('data-id');
                var cfg = getConfig();
                for (var j = 0; j < cfg.sources.length; j++) {
                    if (cfg.sources[j].id === id) {
                        cfg.sources[j].enabled = !!e.currentTarget.checked;
                        break;
                    }
                }
                saveConfig(cfg);
            });
        }
        var dels = root.querySelectorAll('.ml-store-src-del');
        for (var d = 0; d < dels.length; d++) {
            dels[d].addEventListener('click', function (e) {
                var row = e.currentTarget.closest('.ml-store-src-row');
                var id = row && row.getAttribute('data-id');
                var cfg = getConfig();
                cfg.sources = cfg.sources.filter(function (s) { return s.id !== id; });
                saveConfig(cfg);
                delete _catalogBySource[id];
                if (_activeTab === id) _activeTab = 'all';
                renderPanel(_panelRoot);
            });
        }
        var addBtn = root.querySelector('.ml-store-add-btn');
        if (addBtn) {
            addBtn.addEventListener('click', function () {
                var nameEl = root.querySelector('.ml-store-add-name');
                var urlEl = root.querySelector('.ml-store-add-url');
                var name = nameEl ? nameEl.value.trim() : '';
                var catalogUrl = urlEl ? urlEl.value.trim() : '';
                if (!catalogUrl) {
                    alertStore('请填写 Catalog URL');
                    return;
                }
                try {
                    parseHttpsUrl(catalogUrl);
                } catch (err) {
                    alertStore(err.message || '仅允许 https Catalog URL');
                    return;
                }
                if (!name) name = '未命名来源';
                var cfg = getConfig();
                var id = makeSourceId(name, catalogUrl);
                cfg.sources.push({
                    id: id,
                    name: name,
                    catalogUrl: catalogUrl,
                    enabled: true
                });
                saveConfig(cfg);
                _viewMode = 'list';
                _activeTab = 'all';
                renderPanel(_panelRoot);
                doRefresh();
            });
        }
        var backBtn = root.querySelector('.ml-store-back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', function () {
                _viewMode = 'list';
                renderPanel(_panelRoot);
            });
        }
    }

    function alertStore(msg) {
        if (typeof ML.showConfirmDialog === 'function') {
            ML.showConfirmDialog('提示', String(msg), [{
                text: '知道了',
                class: 'ml-btn-primary',
                action: function () {
                    if (typeof ML.hideConfirmDialog === 'function') ML.hideConfirmDialog();
                }
            }]);
        } else {
            window.alert(String(msg));
        }
    }

    function doRefresh() {
        var btn = _panelRoot && _panelRoot.querySelector('.ml-store-refresh-btn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = '刷新中…';
        }
        refreshAllCatalogs().then(function () {
            if (!_statusFilterPinnedByUser) applyDefaultStatusFilter();
            if (_panelRoot) renderPanel(_panelRoot, { preserveScroll: true });
        }, function () {
            if (_panelRoot) renderPanel(_panelRoot, { preserveScroll: true });
        });
    }

    function renderPanel(container, options) {
        if (!container) return;
        options = options || {};
        if (options.preserveScroll && _panelRoot === container) {
            saveListScroll();
        }
        ensureStyles();
        _panelRoot = container;
        container.classList.add('ml-store-panel-root');
        getConfig();

        if (_viewMode === 'sources') {
            container.innerHTML =
                '<div class="ml-store">' +
                '<div class="ml-store-toolbar">' +
                '<button type="button" class="ml-btn ml-btn-secondary ml-store-back-btn">← 返回</button>' +
                '<span style="color:var(--ml-text-secondary,#9a9ab0);font-size:12px;">订阅管理</span>' +
                '</div>' +
                '<div class="ml-store-sources-scroll ml-list-scroll">' +
                buildSourcesHtml() +
                '</div></div>';
            bindSourcesEvents(container);
            var back = container.querySelector('.ml-store-toolbar .ml-store-back-btn');
            if (back) {
                back.addEventListener('click', function () {
                    _viewMode = 'list';
                    renderPanel(container);
                });
            }
            return;
        }

        container.innerHTML =
            '<div class="ml-store">' +
            '<div class="ml-store-toolbar">' +
            '<button type="button" class="ml-btn ml-btn-secondary ml-store-sources-btn">订阅管理</button>' +
            '<button type="button" class="ml-btn ml-btn-primary ml-store-refresh-btn">刷新</button>' +
            '<button type="button" class="ml-btn ml-btn-primary ml-store-update-all"' +
            (countAutoUpdatable() > 0 ? '' : ' disabled') +
            (countMultiSourceUpdatable() > 0 ? ' title="多源 Mod 需逐条选择来源，不会纳入一键更新"' : '') +
            '>更新已安装（' + countAutoUpdatable() + '）</button>' +
            '</div>' +
            '<div class="ml-store-hint">仅管理本地 _localmods；创意工坊 Mod 不在此更新。装完后请在主界面点「刷新列表」。</div>' +
            '<div class="ml-store-tabs">' + buildTabsHtml() + '</div>' +
            '<div class="ml-store-tabs ml-store-status-tabs">' + buildStatusTabsHtml() + '</div>' +
            '<div class="ml-store-list ml-list-scroll">' + buildListHtml() + '</div>' +
            '</div>';

        var srcBtn = container.querySelector('.ml-store-sources-btn');
        if (srcBtn) {
            srcBtn.addEventListener('click', function () {
                _viewMode = 'sources';
                renderPanel(container);
            });
        }
        var refreshBtn = container.querySelector('.ml-store-refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', function () { doRefresh(); });
        }
        var updateAllBtn = container.querySelector('.ml-store-update-all');
        if (updateAllBtn) {
            updateAllBtn.addEventListener('click', function () {
                saveListScroll();
                var result = enqueueAllUpdates();
                if (!result.queued) {
                    if (result.skippedMulti > 0) {
                        alertStore('存在多源可更新 Mod，请逐条选择要使用的来源');
                    } else {
                        alertStore('当前没有可一键更新的已安装 Mod');
                    }
                    restoreListScroll();
                    return;
                }
                if (result.skippedMulti > 0) {
                    alertStore('已加入 ' + result.queued + ' 项；另有 ' + result.skippedMulti +
                        ' 个多源 Mod 请手动选择来源');
                }
                refreshListView();
            });
        }
        var tabs = container.querySelectorAll('.ml-store-tab:not(.ml-store-status-tab)');
        for (var t = 0; t < tabs.length; t++) {
            tabs[t].addEventListener('click', function (e) {
                _activeTab = e.currentTarget.getAttribute('data-tab') || 'all';
                _listScrollTop = 0;
                renderPanel(container, { preserveScroll: false });
            });
        }
        bindStatusTabEvents(container.querySelector('.ml-store-status-tabs'));
        bindListEvents(container.querySelector('.ml-store-list'));
        if (options.preserveScroll) {
            requestAnimationFrame(restoreListScroll);
        }
    }

    // ================================================================
    // 注册
    // ================================================================

    function register() {
        loadConfig();
        ML.registerLogEntry({
            id: 'modStore',
            label: 'Mod 商店',
            getUpdateCount: function () {
                try {
                    return countBadgeNotices();
                } catch (e) {
                    return 0;
                }
            },
            render: function (container) {
                _viewMode = 'list';
                _activeTab = 'all';
                _statusFilterPinnedByUser = false;
                applyDefaultStatusFilter();
                renderPanel(container);
                var cfg = getConfig();
                var enabled = cfg.sources.filter(function (s) { return s.enabled; });
                if (enabled.length) {
                    var needFetch = enabled.some(function (s) { return !_catalogBySource[s.id]; });
                    if (needFetch) doRefresh();
                }
            }
        });
        console.info('[modStore] 已挂载 Mod 商店入口');
        var cfg = getConfig();
        var enabled = cfg.sources.filter(function (s) { return s.enabled; });
        if (enabled.length) {
            refreshAllCatalogs().catch(function () { /* 后台预拉 catalog，供齿轮角标统计 */ });
        }
    }

    register();
})();
