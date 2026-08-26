/**
 * ModLoader libs 扩展 · 小型 Mod 商店（Phase 1）
 *
 * 存在即生效，删除即关闭。通过 registerLogEntry 挂载设置面板入口。
 * 多源订阅 catalog → 比对本地 _localmods → HTTPS 下载 zip → sha256 → 安全解压。
 */
(function () {
    'use strict';

    const ML = typeof window !== 'undefined' ? window.ModLoader : null;
    if (!ML || typeof ML.registerLogEntry !== 'function') {
        console.warn('[modStore] ModLoader.registerLogEntry 不可用，扩展未挂载');
        return;
    }

    const fs = require('fs');
    const pathMod = require('path');
    const https = require('https');
    const crypto = require('crypto');
    const zlib = require('zlib');
    const urlMod = require('url');

    const MODS_DIR = pathMod.join(process.cwd(), 'js', 'mods');
    const LOCALMODS_DIR = pathMod.join(MODS_DIR, '_localmods');
    const CONFIG_PATH = pathMod.join(MODS_DIR, 'config', 'mod_store.json');
    const TMP_ROOT = pathMod.join(MODS_DIR, 'config', '.modstore-tmp');
    const MODLOADER_CONFIG_PATH = pathMod.join(MODS_DIR, 'config', 'modloader_config.json');

    // ================================================================
    // 内嵌 i18n（跟随 modloader_config.json 的 ml_language）
    // 打开商店面板时读取；无热刷新。扩展：在 STORE_I18N_PACKS 追加语言码与词条；
    // 新语言须同步为管理器 config/language/ 提供语言包，否则管理器无法切到该语言。
    // ================================================================
    const STORE_I18N_FALLBACK = 'zh_CN';
    const STORE_I18N_PACKS = {
        zh_CN: {
            entryLabel: 'Mod 商店',
            btnSubscribeManage: '订阅管理',
            btnRefresh: '刷新',
            btnRefreshing: '刷新中…',
            btnUpdateAll: '更新已安装（{n}）',
            btnBack: '← 返回',
            btnSaveMax: '保存上限',
            btnAddSource: '添加来源',
            btnDelete: '删除',
            btnOk: '知道了',
            btnEnabled: '启用',
            hintToolbar: '仅管理本地 _localmods；创意工坊 Mod 不在此更新。装完后请在主界面点「刷新列表」。',
            hintMultiSourceTitle: '多源 Mod 需逐条选择来源，不会纳入一键更新',
            statusLabel: '状态',
            statusAll: '全部',
            statusUpdatable: '可更新',
            statusNew: '新增',
            statusMissing: '未下载',
            tabAll: '全部',
            actionDownload: '下载',
            actionUpdate: '更新',
            actionLatest: '已是最新',
            actionDownloadOverwrite: '下载覆盖',
            btnChangelog: '更新日志',
            changelogTitle: '{name} {version} 更新日志',
            changelogLoading: '加载中…',
            changelogLoadFailed: '无法加载更新日志',
            changelogLinkEmpty: '链接错误，未拉取到更新日志',
            jobQueued: '排队中…',
            jobDownloading: '下载中 {recv} / {total}（{pct}）· {speed} · 剩余 {eta}',
            jobVerifying: '校验中…',
            jobExtracting: '解压中…',
            jobDone: '完成',
            jobFailed: '失败',
            localNotDownloaded: '未下载',
            localUnknown: '未知',
            metaLocal: '本地',
            metaStore: '商店',
            metaSize: '大小',
            metaSource: '来源',
            badgeMultiSource: '多源',
            badgeNewTitle: '点击查看',
            emptyNoSources: '尚未订阅任何来源。<br>点击「订阅管理」添加 catalog URL。',
            emptyClickRefresh: '点击「刷新」拉取订阅目录。',
            emptyAllSourcesFailed: '所有已启用来源均加载失败。',
            emptyNoMods: '当前来源没有可显示的 Mod。',
            emptyNoModsFiltered: '当前来源下没有「{filter}」的 Mod。',
            emptyNoSubscriptions: '暂无订阅来源。',
            sourceLoadFailed: '来源「{name}」加载失败：{error}',
            sourceUnknownError: '未知错误',
            settingsTitle: '下载设置',
            settingsMaxMbLabel: '单包体积上限（MB）',
            settingsMaxMbHint: '默认 100MB。超过此大小的 Mod 将中止下载（可调低做拦截测试）。',
            formDisplayName: '显示名',
            formDisplayNamePh: '例如：作者 Foo',
            formCatalogUrl: 'Catalog URL（https）',
            formCatalogUrlPh: 'https://example.com/mods/catalog.json',
            installDoneTitle: '安装完成',
            installDoneBody: 'Mod 已写入本地目录。请关闭商店面板，在主界面点击「刷新列表」，即可识别新包或更新。',
            installDoneSuppress: '不再提示',
            dialogNotice: '提示',
            unnamedSource: '未命名来源',
            alertMaxMbRange: '请输入 1～2048 之间的整数（MB）',
            alertMaxMbSaved: '已保存下载体积上限',
            alertCatalogRequired: '请填写 Catalog URL',
            alertCatalogHttps: '仅允许 https Catalog URL',
            alertMultiSourcePick: '存在多源可更新 Mod，请逐条选择要使用的来源',
            alertNoAutoUpdate: '当前没有可一键更新的已安装 Mod',
            alertQueuedSkipped: '已加入 {queued} 项；另有 {skipped} 个多源 Mod 请手动选择来源',
            unitEmDash: '—',
            unitQuestion: '？',
            errUrlInvalid: 'URL 无效',
            errHttpsOnly: '仅允许 https',
            errRedirectTooMany: '重定向过多',
            errRedirectInvalid: '重定向 URL 无效',
            errSizeLimit: '超过体积上限',
            errTimeout: '请求超时',
            errHttp: 'HTTP {code}',
            errInvalidZip: '无效的 ZIP 文件',
            errInvalidZipEocd: '无效的 ZIP 文件（找不到 EOCD）',
            errInvalidZipCentral: '无效的 ZIP 中央目录',
            errUnsafePath: 'ZIP 含不安全路径',
            errInvalidZipLocal: '无效的 ZIP 本地头',
            errInvalidZipSig: '无效的 ZIP 本地头签名',
            errZipOutOfBounds: 'ZIP 数据越界',
            errZipMethod: '不支持的 ZIP 压缩方法: {method}',
            errPackageNameInvalid: 'packageName 非法',
            errFormatInvalid: '格式不正确',
            errHostNotAllowed: '下载域名不在白名单',
            errCatalogInvalid: 'catalog 无效',
            errSha256Failed: 'sha256 校验失败'
        },
        zh_TW: {
            entryLabel: 'Mod 商店',
            btnSubscribeManage: '訂閱管理',
            btnRefresh: '重新整理',
            btnRefreshing: '重新整理中…',
            btnUpdateAll: '更新已安裝（{n}）',
            btnBack: '← 返回',
            btnSaveMax: '儲存上限',
            btnAddSource: '新增來源',
            btnDelete: '刪除',
            btnOk: '知道了',
            btnEnabled: '啟用',
            hintToolbar: '僅管理本機 _localmods；創意工坊 Mod 不在此更新。裝完後請在主介面點「重新整理列表」。',
            hintMultiSourceTitle: '多源 Mod 需逐條選擇來源，不會納入一鍵更新',
            statusLabel: '狀態',
            statusAll: '全部',
            statusUpdatable: '可更新',
            statusNew: '新增',
            statusMissing: '未下載',
            tabAll: '全部',
            actionDownload: '下載',
            actionUpdate: '更新',
            actionLatest: '已是最新',
            actionDownloadOverwrite: '下載覆蓋',
            btnChangelog: '更新日誌',
            changelogTitle: '{name} {version} 更新日誌',
            changelogLoading: '載入中…',
            changelogLoadFailed: '無法載入更新日誌',
            changelogLinkEmpty: '連結錯誤，未拉取到更新日誌',
            jobQueued: '排隊中…',
            jobDownloading: '下載中 {recv} / {total}（{pct}）· {speed} · 剩餘 {eta}',
            jobVerifying: '校驗中…',
            jobExtracting: '解壓中…',
            jobDone: '完成',
            jobFailed: '失敗',
            localNotDownloaded: '未下載',
            localUnknown: '未知',
            metaLocal: '本機',
            metaStore: '商店',
            metaSize: '大小',
            metaSource: '來源',
            badgeMultiSource: '多源',
            badgeNewTitle: '點擊查看',
            emptyNoSources: '尚未訂閱任何來源。<br>點擊「訂閱管理」新增 catalog URL。',
            emptyClickRefresh: '點擊「重新整理」拉取訂閱目錄。',
            emptyAllSourcesFailed: '所有已啟用來源均載入失敗。',
            emptyNoMods: '目前來源沒有可顯示的 Mod。',
            emptyNoModsFiltered: '目前來源下沒有「{filter}」的 Mod。',
            emptyNoSubscriptions: '暫無訂閱來源。',
            sourceLoadFailed: '來源「{name}」載入失敗：{error}',
            sourceUnknownError: '未知錯誤',
            settingsTitle: '下載設定',
            settingsMaxMbLabel: '單包體積上限（MB）',
            settingsMaxMbHint: '預設 100MB。超過此大小的 Mod 將中止下載（可調低做攔截測試）。',
            formDisplayName: '顯示名',
            formDisplayNamePh: '例如：作者 Foo',
            formCatalogUrl: 'Catalog URL（https）',
            formCatalogUrlPh: 'https://example.com/mods/catalog.json',
            installDoneTitle: '安裝完成',
            installDoneBody: 'Mod 已寫入本機目錄。請關閉商店面板，在主介面點擊「重新整理列表」，即可識別新包或更新。',
            installDoneSuppress: '不再提示',
            dialogNotice: '提示',
            unnamedSource: '未命名來源',
            alertMaxMbRange: '請輸入 1～2048 之間的整數（MB）',
            alertMaxMbSaved: '已儲存下載體積上限',
            alertCatalogRequired: '請填寫 Catalog URL',
            alertCatalogHttps: '僅允許 https Catalog URL',
            alertMultiSourcePick: '存在多源可更新 Mod，請逐條選擇要使用的來源',
            alertNoAutoUpdate: '目前沒有可一鍵更新的已安裝 Mod',
            alertQueuedSkipped: '已加入 {queued} 項；另有 {skipped} 個多源 Mod 請手動選擇來源',
            unitEmDash: '—',
            unitQuestion: '？',
            errUrlInvalid: 'URL 無效',
            errHttpsOnly: '僅允許 https',
            errRedirectTooMany: '重定向過多',
            errRedirectInvalid: '重定向 URL 無效',
            errSizeLimit: '超過體積上限',
            errTimeout: '請求逾時',
            errHttp: 'HTTP {code}',
            errInvalidZip: '無效的 ZIP 檔案',
            errInvalidZipEocd: '無效的 ZIP 檔案（找不到 EOCD）',
            errInvalidZipCentral: '無效的 ZIP 中央目錄',
            errUnsafePath: 'ZIP 含不安全路徑',
            errInvalidZipLocal: '無效的 ZIP 本機頭',
            errInvalidZipSig: '無效的 ZIP 本機頭簽名',
            errZipOutOfBounds: 'ZIP 資料越界',
            errZipMethod: '不支援的 ZIP 壓縮方法: {method}',
            errPackageNameInvalid: 'packageName 非法',
            errFormatInvalid: '格式不正確',
            errHostNotAllowed: '下載域名不在白名單',
            errCatalogInvalid: 'catalog 無效',
            errSha256Failed: 'sha256 校驗失敗'
        },
        en: {
            entryLabel: 'Mod Store',
            btnSubscribeManage: 'Subscriptions',
            btnRefresh: 'Refresh',
            btnRefreshing: 'Refreshing…',
            btnUpdateAll: 'Update installed ({n})',
            btnBack: '← Back',
            btnSaveMax: 'Save limit',
            btnAddSource: 'Add source',
            btnDelete: 'Delete',
            btnOk: 'OK',
            btnEnabled: 'Enabled',
            hintToolbar: 'Local _localmods only; Workshop mods are not updated here. After install, click Refresh list on the main screen.',
            hintMultiSourceTitle: 'Multi-source mods must be updated one source at a time; excluded from batch update',
            statusLabel: 'Status',
            statusAll: 'All',
            statusUpdatable: 'Updates',
            statusNew: 'New',
            statusMissing: 'Not installed',
            tabAll: 'All',
            actionDownload: 'Download',
            actionUpdate: 'Update',
            actionLatest: 'Up to date',
            actionDownloadOverwrite: 'Download (overwrite)',
            btnChangelog: 'Changelog',
            changelogTitle: '{name} {version} Changelog',
            changelogLoading: 'Loading…',
            changelogLoadFailed: 'Failed to load changelog',
            changelogLinkEmpty: 'Invalid link or empty changelog',
            jobQueued: 'Queued…',
            jobDownloading: 'Downloading {recv} / {total} ({pct}) · {speed} · ETA {eta}',
            jobVerifying: 'Verifying…',
            jobExtracting: 'Extracting…',
            jobDone: 'Done',
            jobFailed: 'Failed',
            localNotDownloaded: 'Not installed',
            localUnknown: 'Unknown',
            metaLocal: 'Local',
            metaStore: 'Store',
            metaSize: 'Size',
            metaSource: 'Source',
            badgeMultiSource: 'Multi',
            badgeNewTitle: 'Click to dismiss',
            emptyNoSources: 'No sources subscribed.<br>Open Subscriptions to add a catalog URL.',
            emptyClickRefresh: 'Click Refresh to fetch catalogs.',
            emptyAllSourcesFailed: 'All enabled sources failed to load.',
            emptyNoMods: 'No mods to show for this source.',
            emptyNoModsFiltered: 'No mods in「{filter}」for this source.',
            emptyNoSubscriptions: 'No subscribed sources.',
            sourceLoadFailed: 'Source「{name}」failed: {error}',
            sourceUnknownError: 'Unknown error',
            settingsTitle: 'Download settings',
            settingsMaxMbLabel: 'Max package size (MB)',
            settingsMaxMbHint: 'Default 100MB. Downloads above this size are aborted (lower for testing).',
            formDisplayName: 'Display name',
            formDisplayNamePh: 'e.g. Author Foo',
            formCatalogUrl: 'Catalog URL (https)',
            formCatalogUrlPh: 'https://example.com/mods/catalog.json',
            installDoneTitle: 'Install complete',
            installDoneBody: 'Mod saved locally. Close this panel and click Refresh list on the main screen to see the package.',
            installDoneSuppress: 'Do not show again',
            dialogNotice: 'Notice',
            unnamedSource: 'Unnamed source',
            alertMaxMbRange: 'Enter an integer between 1 and 2048 (MB)',
            alertMaxMbSaved: 'Download size limit saved',
            alertCatalogRequired: 'Please enter a Catalog URL',
            alertCatalogHttps: 'HTTPS Catalog URL only',
            alertMultiSourcePick: 'Multi-source updates available; pick a source for each mod',
            alertNoAutoUpdate: 'No installed mods can be batch-updated',
            alertQueuedSkipped: 'Queued {queued}; {skipped} multi-source mod(s) need manual source pick',
            unitEmDash: '—',
            unitQuestion: '?',
            errUrlInvalid: 'Invalid URL',
            errHttpsOnly: 'HTTPS only',
            errRedirectTooMany: 'Too many redirects',
            errRedirectInvalid: 'Invalid redirect URL',
            errSizeLimit: 'Size limit exceeded',
            errTimeout: 'Request timed out',
            errHttp: 'HTTP {code}',
            errInvalidZip: 'Invalid ZIP file',
            errInvalidZipEocd: 'Invalid ZIP (EOCD not found)',
            errInvalidZipCentral: 'Invalid ZIP central directory',
            errUnsafePath: 'Unsafe path in ZIP',
            errInvalidZipLocal: 'Invalid ZIP local header',
            errInvalidZipSig: 'Invalid ZIP local header signature',
            errZipOutOfBounds: 'ZIP data out of bounds',
            errZipMethod: 'Unsupported ZIP compression: {method}',
            errPackageNameInvalid: 'Invalid packageName',
            errFormatInvalid: 'Invalid package format',
            errHostNotAllowed: 'Download host not allowed',
            errCatalogInvalid: 'Invalid catalog',
            errSha256Failed: 'SHA256 verification failed'
        }
    };

    function readManagerLanguage() {
        try {
            if (fs.existsSync(MODLOADER_CONFIG_PATH)) {
                const raw = JSON.parse(fs.readFileSync(MODLOADER_CONFIG_PATH, 'utf8'));
                const lang = String(raw.ml_language || '').trim();
                if (lang && STORE_I18N_PACKS[lang]) return lang;
            }
        } catch (e) { /* ignore */ }
        return STORE_I18N_FALLBACK;
    }

    function storeT(key, params) {
        const lang = readManagerLanguage();
        const pack = STORE_I18N_PACKS[lang] || STORE_I18N_PACKS[STORE_I18N_FALLBACK] || {};
        const fb = STORE_I18N_PACKS[STORE_I18N_FALLBACK] || {};
        let text = pack[key];
        if (text == null) text = fb[key];
        if (text == null) text = key;
        if (params) {
            for (const pk in params) {
                if (Object.prototype.hasOwnProperty.call(params, pk)) {
                    text = String(text).replace(new RegExp('\\{' + pk + '\\}', 'g'), String(params[pk]));
                }
            }
        }
        return text;
    }

    const DEFAULT_MAX_BYTES = 104857600;
    const CHANGELOG_MAX_BYTES = 512 * 1024;
    const LOCAL_CHANGELOG_NAME = 'CHANGELOG.md';
    const DOWNLOAD_CONCURRENCY = 2;
    const REQUEST_TIMEOUT_MS = 60000;
    const USER_AGENT = 'ModLoader-ModStore/1.0';
    const RESUME_THRESHOLD_BYTES = 50 * 1024 * 1024; // >50MB 才断点续传
    const PROGRESS_UI_THROTTLE_MS = 200;

    function isLocalHttpsHost(hostname) {
        const h = String(hostname || '').toLowerCase();
        return h === '127.0.0.1' || h === 'localhost' || h === '::1';
    }

    function httpsTlsOptions(hostname) {
        return isLocalHttpsHost(hostname) ? { rejectUnauthorized: false } : {};
    }

    // ---- 运行时状态 ----
    let _config = null;
    const _catalogBySource = {}; // sourceId -> { ok, error?, catalog?, fetchedAt }
    let _activeTab = 'all';
    let _activeStatusFilter = 'all'; // all | update | new | missing
    let _statusFilterPinnedByUser = false;
    let _viewMode = 'list'; // list | sources
    let _panelRoot = null;
    let _listScrollTop = 0;
    const _jobState = {}; // key: sourceId::modId -> { status, progress, error }
    const _queue = [];
    let _activeJobs = 0;
    let _multiSourceIds = {}; // packageName -> true when appears in >1 enabled sources

    // ================================================================
    // 工具
    // ================================================================

    function logWarn() {
        const args = Array.prototype.slice.call(arguments);
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
            const stat = fs.lstatSync(targetPath);
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
        const entries = fs.readdirSync(src, { withFileTypes: true });
        for (let i = 0; i < entries.length; i++) {
            const ent = entries[i];
            const from = pathMod.join(src, ent.name);
            const to = pathMod.join(dest, ent.name);
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

    function isBusyJobStatus(status) {
        return status === 'queued' || status === 'downloading' ||
            status === 'verifying' || status === 'extracting';
    }

    /** 任一来源正在安装同名包时，其它来源按钮也应禁用（防并发写同一目录） */
    function isPackageInstallBusy(packageName) {
        if (!packageName) return false;
        for (const key in _jobState) {
            if (!Object.prototype.hasOwnProperty.call(_jobState, key)) continue;
            const sep = key.indexOf('::');
            if (sep < 0) continue;
            if (key.slice(sep + 2) !== packageName) continue;
            if (isBusyJobStatus(_jobState[key].status)) return true;
        }
        return false;
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
        if (!isFinite(n) || n < 0) return storeT('unitEmDash');
        if (n < 1024) return Math.round(n) + ' B';
        const kb = n / 1024;
        if (kb < 1024) {
            return (kb < 10 ? kb.toFixed(1) : String(Math.round(kb))) + ' KB';
        }
        const mb = kb / 1024;
        if (mb < 1024) {
            return (mb < 10 ? mb.toFixed(1) : String(Math.round(mb))) + ' MB';
        }
        const gb = mb / 1024;
        return (gb < 10 ? gb.toFixed(2) : String(Math.round(gb))) + ' GB';
    }

    function formatSpeed(bytesPerSec) {
        if (!isFinite(bytesPerSec) || bytesPerSec <= 0) return storeT('unitEmDash');
        return formatBytes(bytesPerSec) + '/s';
    }

    function formatEta(seconds) {
        if (!isFinite(seconds) || seconds < 0) return storeT('unitEmDash');
        seconds = Math.ceil(seconds);
        if (seconds < 60) return seconds + 's';
        let m = Math.floor(seconds / 60);
        const s = seconds % 60;
        if (m < 60) return m + 'm' + (s < 10 ? '0' : '') + s + 's';
        const h = Math.floor(m / 60);
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
        const seen = {};
        if (!raw) return seen;
        if (Array.isArray(raw)) {
            for (let i = 0; i < raw.length; i++) {
                const pkg = String(raw[i] || '').trim();
                if (isSafePackageName(pkg)) seen[pkg] = true;
            }
            return seen;
        }
        if (typeof raw === 'object') {
            for (const key in raw) {
                if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
                if (!raw[key]) continue;
                const name = String(key).trim();
                if (isSafePackageName(name)) seen[name] = true;
            }
        }
        return seen;
    }

    function normalizeConfig(raw) {
        const cfg = defaultConfig();
        if (!raw || typeof raw !== 'object') return cfg;
        const max = Number(raw.maxDownloadBytes);
        if (isFinite(max) && max > 0) cfg.maxDownloadBytes = Math.floor(max);
        cfg.suppressInstallHint = !!raw.suppressInstallHint;
        cfg.seenMods = normalizeSeenMods(raw.seenMods);
        cfg.sources = [];
        if (Array.isArray(raw.sources)) {
            for (let i = 0; i < raw.sources.length; i++) {
                const s = raw.sources[i];
                if (!s || typeof s !== 'object') continue;
                const id = String(s.id || '').trim();
                const name = String(s.name || '').trim();
                const catalogUrl = String(s.catalogUrl || '').trim();
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
            const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
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
        const cfg = getConfig();
        return !!(cfg.seenMods && cfg.seenMods[packageName]);
    }

    function isModNew(packageName) {
        return !isPackageSeen(packageName);
    }

    function markPackageSeen(packageName) {
        if (!isSafePackageName(packageName)) return false;
        const cfg = getConfig();
        if (cfg.seenMods[packageName]) return false;
        cfg.seenMods[packageName] = true;
        saveConfig(cfg);
        if (typeof ML.refreshConflictLog === 'function') {
            ML.refreshConflictLog();
        }
        return true;
    }

    function forEachDedupedPackage(callback) {
        const rows = dedupePackageRows(collectStoreRows('all'));
        rebuildMultiSourceMap(rows);
        const seenPkg = {};
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (seenPkg[row.packageName]) continue;
            seenPkg[row.packageName] = true;
            callback(enrichRow(row), row);
        }
    }

    function makeSourceId(name, catalogUrl) {
        let base = String(name || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
            .replace(/^-+|-+$/g, '');
        if (!base) {
            base = crypto.createHash('sha1').update(String(catalogUrl || '')).digest('hex').slice(0, 8);
        }
        const cfg = getConfig();
        let id = base;
        let n = 2;
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
        let s = String(raw).trim();
        if (!s) return null;
        s = s.replace(/^[vV]/, '');
        const m = s.match(/(\d+(?:\.\d+)*)/);
        if (!m) return null;
        return m[1].split('.').map(function (p) {
            const n = parseInt(p, 10);
            return isFinite(n) ? n : 0;
        });
    }

    /**
     * @returns {number} -1 local<store · 0 equal/unknown-comparable · 1 local>store
     *          null if either side unknown
     */
    function compareVersions(localRaw, storeRaw) {
        const a = normalizeVersion(localRaw);
        const b = normalizeVersion(storeRaw);
        if (!a || !b) return null;
        const len = Math.max(a.length, b.length);
        for (let i = 0; i < len; i++) {
            const x = a[i] || 0;
            const y = b[i] || 0;
            if (x < y) return -1;
            if (x > y) return 1;
        }
        return 0;
    }

    function resolvePackageEntryFileName(entry) {
        const raw = String(entry).trim();
        if (!raw) return null;
        if (/[\\/]/.test(raw) || raw.indexOf('..') !== -1) return null;
        const fileName = pathMod.basename(raw);
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
        const scripts = [];
        const manifestPath = pathMod.join(packageRoot, 'modloader.json');
        let manifest = null;
        if (fs.existsSync(manifestPath)) {
            try {
                manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
            } catch (e) { /* ignore */ }
        }
        if (manifest && Array.isArray(manifest.entries) && manifest.entries.length > 0) {
            for (let i = 0; i < manifest.entries.length; i++) {
                const fileName = resolvePackageEntryFileName(manifest.entries[i]);
                if (!fileName) continue;
                if (fs.existsSync(pathMod.join(packageRoot, fileName))) scripts.push(fileName);
            }
            return scripts;
        }
        return listRootJsFiles(packageRoot);
    }

    function readLocalPackageVersion(packageName) {
        if (!isSafePackageName(packageName)) return { exists: false, version: null };
        const root = pathMod.join(LOCALMODS_DIR, packageName);
        if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
            return { exists: false, version: null };
        }

        const scripts = discoverPackageScripts(root);
        const isMultiScript = scripts.length > 1;
        let manifest = null;
        const manifestPath = pathMod.join(root, 'modloader.json');
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
            for (let i = 0; i < scripts.length; i++) {
                const content = fs.readFileSync(pathMod.join(root, scripts[i]), 'utf-8');
                const block = content.match(/\/\*:[\s\S]*?\*\//);
                if (!block) continue;
                const vm = block[0].match(/@version\s+(.+?)$/m);
                if (vm && vm[1].trim()) {
                    return { exists: true, version: vm[1].trim() };
                }
            }
        } catch (e2) { /* ignore */ }

        return { exists: true, version: null };
    }

    function resolveEntryStatus(localInfo, storeVersion) {
        if (!localInfo.exists) return 'missing';
        const cmp = compareVersions(localInfo.version, storeVersion);
        if (cmp === null) return 'unknown';
        if (cmp < 0) return 'update';
        return 'latest';
    }

    // ================================================================
    // HTTP(S)
    // ================================================================

    function parseHttpsUrl(raw) {
        let u;
        try {
            u = new urlMod.URL(String(raw || ''));
        } catch (e) {
            throw new Error(storeT('errUrlInvalid'));
        }
        if (u.protocol !== 'https:') {
            throw new Error(storeT('errHttpsOnly'));
        }
        return u;
    }

    function requestBuffer(rawUrl, options) {
        options = options || {};
        const maxBytes = options.maxBytes != null ? options.maxBytes : DEFAULT_MAX_BYTES;
        const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
        const redirectLeft = options.redirectLeft != null ? options.redirectLeft : 5;
        const rangeStart = options.rangeStart != null ? options.rangeStart : 0;
        const u = parseHttpsUrl(rawUrl);

        return new Promise(function (resolve, reject) {
            const chunks = [];
            let received = 0;
            let settled = false;

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

            const headers = {
                'User-Agent': USER_AGENT,
                'Accept': '*/*'
            };
            if (rangeStart > 0) {
                headers['Range'] = 'bytes=' + rangeStart + '-';
            }

            const req = https.request(Object.assign({
                protocol: u.protocol,
                hostname: u.hostname,
                port: u.port || 443,
                path: u.pathname + u.search,
                method: 'GET',
                headers: headers,
                timeout: REQUEST_TIMEOUT_MS
            }, httpsTlsOptions(u.hostname)), function (res) {
                const code = res.statusCode || 0;
                if (code >= 300 && code < 400 && res.headers.location) {
                    res.resume();
                    if (redirectLeft <= 0) {
                        fail(new Error(storeT('errRedirectTooMany')));
                        return;
                    }
                    let next = res.headers.location;
                    try {
                        next = new urlMod.URL(next, u).href;
                    } catch (e) {
                        fail(new Error(storeT('errRedirectInvalid')));
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
                    fail(new Error(storeT('errHttp', { code: code })));
                    return;
                }

                const contentLength = parseInt(res.headers['content-length'], 10);
                let total = null;
                if (code === 206) {
                    const cr = String(res.headers['content-range'] || '');
                    const m = cr.match(/\/(\d+)\s*$/);
                    if (m) total = parseInt(m[1], 10);
                    else if (isFinite(contentLength)) total = rangeStart + contentLength;
                } else if (isFinite(contentLength)) {
                    total = contentLength;
                }

                if (isFinite(total) && total > maxBytes) {
                    res.destroy();
                    fail(new Error(storeT('errSizeLimit')));
                    return;
                }

                res.on('data', function (chunk) {
                    received += chunk.length;
                    const absolute = rangeStart + received;
                    if (absolute > maxBytes) {
                        res.destroy();
                        fail(new Error(storeT('errSizeLimit')));
                        return;
                    }
                    chunks.push(chunk);
                    if (onProgress) {
                        const pct = isFinite(total) && total > 0
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
                fail(new Error(storeT('errTimeout')));
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
        const maxBytes = options.maxBytes != null ? options.maxBytes : DEFAULT_MAX_BYTES;
        const expectedSize = options.expectedSize != null ? Number(options.expectedSize) : null;
        const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
        const allowResume = expectedSize != null && expectedSize > RESUME_THRESHOLD_BYTES;

        ensureDir(pathMod.dirname(destPath));

        let existing = 0;
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

        let startedAt = Date.now();
        let baselineExisting = existing;
        let lastUiAt = 0;

        function emitProgress(received, total) {
            if (!onProgress) return;
            const now = Date.now();
            if (now - lastUiAt < PROGRESS_UI_THROTTLE_MS && received !== total) return;
            lastUiAt = now;
            const elapsedSec = Math.max(0.001, (now - startedAt) / 1000);
            const delta = Math.max(0, received - baselineExisting);
            const speed = delta / elapsedSec;
            const pct = isFinite(total) && total > 0
                ? Math.min(99, Math.floor(received / total * 100))
                : null;
            const eta = (isFinite(total) && total > received && speed > 0)
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
            const u = parseHttpsUrl(url);
            return new Promise(function (resolve, reject) {
                const headers = {
                    'User-Agent': USER_AGENT,
                    'Accept': '*/*'
                };
                if (rangeStart > 0) headers['Range'] = 'bytes=' + rangeStart + '-';

                const req = https.request(Object.assign({
                    protocol: u.protocol,
                    hostname: u.hostname,
                    port: u.port || 443,
                    path: u.pathname + u.search,
                    method: 'GET',
                    headers: headers,
                    timeout: allowResume ? 0 : REQUEST_TIMEOUT_MS
                }, httpsTlsOptions(u.hostname)), function (res) {
                    const code = res.statusCode || 0;
                    if (code >= 300 && code < 400 && res.headers.location) {
                        res.resume();
                        if (redirectLeft <= 0) {
                            reject(new Error(storeT('errRedirectTooMany')));
                            return;
                        }
                        let next = res.headers.location;
                        try {
                            next = new urlMod.URL(next, u).href;
                        } catch (e) {
                            reject(new Error(storeT('errRedirectInvalid')));
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
                        reject(new Error(storeT('errHttp', { code: code })));
                        return;
                    }

                    const contentLength = parseInt(res.headers['content-length'], 10);
                    let total = null;
                    if (code === 206) {
                        const cr = String(res.headers['content-range'] || '');
                        const m = cr.match(/\/(\d+)\s*$/);
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
                        reject(new Error(storeT('errSizeLimit')));
                        return;
                    }

                    let received = rangeStart;
                    const ws = openWriteStream(rangeStart > 0);
                    let settled = false;

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
                            fail(new Error(storeT('errSizeLimit')));
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
                    reject(new Error(storeT('errTimeout')));
                });
                req.on('error', reject);
                req.end();
            });
        }

        return pipeResponse(rawUrl, existing, 5).then(function () {
            return hashFile(destPath).then(function (sha) {
                const st = fs.statSync(destPath);
                return { path: destPath, sha256: sha, bytes: st.size };
            });
        });
    }

    function hashFile(filePath) {
        return new Promise(function (resolve, reject) {
            const hash = crypto.createHash('sha256');
            const stream = fs.createReadStream(filePath);
            stream.on('data', function (chunk) { hash.update(chunk); });
            stream.on('error', reject);
            stream.on('end', function () { resolve(hash.digest('hex')); });
        });
    }

    // ================================================================
    // ZIP（内嵌 zlib，标准一层包目录）
    // ================================================================

    function isUnsafeZipEntryName(name) {
        if (!name) return true;
        const n = String(name).replace(/\\/g, '/');
        if (n.charAt(0) === '/' || n.charAt(0) === '\\') return true;
        if (/^[a-zA-Z]:/.test(n)) return true;
        const parts = n.split('/');
        for (let i = 0; i < parts.length; i++) {
            if (parts[i] === '..') return true;
        }
        return false;
    }

    /**
     * 解析 ZIP 中央目录，返回条目列表（含解压后的 Buffer）
     */
    function readZipEntries(buf) {
        if (!Buffer.isBuffer(buf) || buf.length < 22) {
            throw new Error(storeT('errInvalidZip'));
        }
        let eocdPos = -1;
        const scanStart = Math.max(0, buf.length - 65557);
        for (let i = buf.length - 22; i >= scanStart; i--) {
            if (buf.readUInt32LE(i) === 0x06054b50) {
                eocdPos = i;
                break;
            }
        }
        if (eocdPos < 0) throw new Error(storeT('errInvalidZipEocd'));

        const totalEntries = buf.readUInt16LE(eocdPos + 10);
        const centralSize = buf.readUInt32LE(eocdPos + 12);
        const centralOffset = buf.readUInt32LE(eocdPos + 16);
        if (centralOffset + 4 > buf.length) throw new Error(storeT('errInvalidZipCentral'));

        const entries = [];
        let pos = centralOffset;
        const end = centralOffset + centralSize;

        for (let idx = 0; idx < totalEntries; idx++) {
            if (pos + 46 > buf.length) break;
            if (buf.readUInt32LE(pos) !== 0x02014b50) break;
            const gpFlag = buf.readUInt16LE(pos + 8);
            const method = buf.readUInt16LE(pos + 10);
            const compSize = buf.readUInt32LE(pos + 20);
            const uncompSize = buf.readUInt32LE(pos + 24);
            const nameLen = buf.readUInt16LE(pos + 28);
            const extraLen = buf.readUInt16LE(pos + 30);
            const commentLen = buf.readUInt16LE(pos + 32);
            const localOffset = buf.readUInt32LE(pos + 42);
            const nameBuf = buf.subarray(pos + 46, pos + 46 + nameLen);
            let name = nameBuf.toString((gpFlag & 0x800) ? 'utf8' : 'utf8');
            name = name.replace(/\\/g, '/');

            if (isUnsafeZipEntryName(name)) {
                throw new Error(storeT('errUnsafePath'));
            }

            if (localOffset + 30 > buf.length) {
                throw new Error(storeT('errInvalidZipLocal'));
            }
            if (buf.readUInt32LE(localOffset) !== 0x04034b50) {
                throw new Error(storeT('errInvalidZipSig'));
            }
            const lNameLen = buf.readUInt16LE(localOffset + 26);
            const lExtraLen = buf.readUInt16LE(localOffset + 28);
            const dataStart = localOffset + 30 + lNameLen + lExtraLen;
            if (dataStart + compSize > buf.length) {
                throw new Error(storeT('errZipOutOfBounds'));
            }
            const compData = buf.subarray(dataStart, dataStart + compSize);
            let outData = null;
            const isDir = /\/$/.test(name);
            if (!isDir) {
                if (method === 0) {
                    outData = Buffer.from(compData);
                } else if (method === 8) {
                    outData = zlib.inflateRawSync(compData);
                } else {
                    throw new Error(storeT('errZipMethod', { method: method }));
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
            throw new Error(storeT('errPackageNameInvalid'));
        }
        const entries = readZipEntries(zipBuf);
        if (!entries.length) throw new Error(storeT('errFormatInvalid'));

        const topNames = {};
        let hasRootFile = false;
        for (let i = 0; i < entries.length; i++) {
            const n = entries[i].name.replace(/^\/+/, '');
            if (!n || n === '/') continue;
            const parts = n.split('/');
            const top = parts[0];
            if (!top) continue;
            topNames[top] = true;
            if (parts.length === 1 && !entries[i].isDir) {
                hasRootFile = true;
            }
        }

        const tops = Object.keys(topNames);
        if (hasRootFile || tops.length !== 1 || tops[0] !== packageName) {
            throw new Error(storeT('errFormatInvalid'));
        }

        const prefix = packageName + '/';
        const outPkg = pathMod.join(destRoot, packageName);
        removePathSafe(outPkg);
        ensureDir(outPkg);

        let wroteFile = false;
        let hasJs = false;
        let hasManifest = false;

        for (let j = 0; j < entries.length; j++) {
            const ent = entries[j];
            const rel = ent.name.replace(/^\/+/, '');
            if (!rel || rel === packageName || rel === prefix) continue;
            if (rel.indexOf(prefix) !== 0) {
                throw new Error(storeT('errFormatInvalid'));
            }
            const inner = rel.slice(prefix.length);
            if (!inner || inner === '/') continue;
            if (isUnsafeZipEntryName(inner)) {
                throw new Error(storeT('errUnsafePath'));
            }

            const outPath = pathMod.join(outPkg, inner);
            const resolved = pathMod.resolve(outPath);
            if (resolved !== outPkg && resolved.indexOf(outPkg + pathMod.sep) !== 0) {
                throw new Error(storeT('errUnsafePath'));
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

        if (!wroteFile) throw new Error(storeT('errFormatInvalid'));

        if (hasManifest) {
            try {
                JSON.parse(fs.readFileSync(pathMod.join(outPkg, 'modloader.json'), 'utf-8'));
            } catch (e) {
                throw new Error(storeT('errFormatInvalid'));
            }
        } else if (!hasJs) {
            // 允许仅有子目录 js？计划：至少一个 .js 或合法 modloader.json
            // 再扫一遍包内任意 .js
            let anyJs = false;
            (function walk(dir) {
                const list = fs.readdirSync(dir, { withFileTypes: true });
                for (let k = 0; k < list.length; k++) {
                    if (list[k].isDirectory()) walk(pathMod.join(dir, list[k].name));
                    else if (/\.js$/i.test(list[k].name)) anyJs = true;
                }
            })(outPkg);
            if (!anyJs) throw new Error(storeT('errFormatInvalid'));
        }

        return outPkg;
    }

    function assertDownloadHost(entry, downloadUrl) {
        const u = parseHttpsUrl(downloadUrl);
        const host = u.hostname.toLowerCase();
        let allowed = null;
        if (Array.isArray(entry.hosts) && entry.hosts.length) {
            allowed = entry.hosts.map(function (h) { return String(h).toLowerCase(); });
        } else {
            allowed = [host];
        }
        if (allowed.indexOf(host) === -1) {
            throw new Error(storeT('errHostNotAllowed'));
        }
    }

    // ================================================================
    // Catalog / 列表模型
    // ================================================================

    function validateCatalog(raw, source) {
        if (!raw || typeof raw !== 'object') throw new Error(storeT('errCatalogInvalid'));
        const mods = Array.isArray(raw.mods) ? raw.mods : [];
        const list = [];
        for (let i = 0; i < mods.length; i++) {
            const m = mods[i];
            if (!m || typeof m !== 'object') continue;
            let id = String(m.id || '').trim();
            const packageName = String(m.packageName || '').trim();
            const version = String(m.version || '').trim();
            const downloadUrl = String(m.downloadUrl || '').trim();
            const sha256 = String(m.sha256 || '').trim().toLowerCase();
            if (!packageName || !version || !downloadUrl || !sha256) continue;
            if (!isSafePackageName(packageName)) continue;
            id = packageName;
            if (!/^[a-f0-9]{64}$/.test(sha256)) continue;
            try {
                parseHttpsUrl(downloadUrl);
            } catch (e) {
                continue;
            }
            let changelogUrl = String(m.changelogUrl || '').trim();
            if (changelogUrl) {
                try {
                    parseHttpsUrl(changelogUrl);
                } catch (eCl) {
                    changelogUrl = '';
                }
            }
            list.push({
                id: id,
                packageName: packageName,
                version: version,
                downloadUrl: downloadUrl,
                sha256: sha256,
                size: (function () {
                    const n = Number(m.size);
                    return isFinite(n) && n > 0 ? Math.floor(n) : null;
                })(),
                summary: String(m.summary || '').trim(),
                changelogUrl: changelogUrl || null,
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
            const buf = Buffer.isBuffer(result) ? result : result.buffer;
            const text = buf.toString('utf-8');
            const json = JSON.parse(text);
            return validateCatalog(json, source);
        });
    }

    function rebuildMultiSourceMap(rows) {
        const counts = {};
        for (let i = 0; i < rows.length; i++) {
            const pkg = rows[i].packageName;
            if (!pkg) continue;
            counts[pkg] = (counts[pkg] || 0) + 1;
        }
        _multiSourceIds = {};
        Object.keys(counts).forEach(function (pkg) {
            if (counts[pkg] > 1) _multiSourceIds[pkg] = true;
        });
    }

    function dedupePackageRows(rows) {
        const map = {};
        const out = [];
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const key = row.sourceId + '::' + row.packageName;
            if (map[key]) continue;
            map[key] = row;
            out.push(row);
        }
        return out;
    }

    function collectStoreRows(filterSourceId) {
        const rows = [];
        const cfg = getConfig();
        for (let i = 0; i < cfg.sources.length; i++) {
            const src = cfg.sources[i];
            if (!src.enabled) continue;
            if (filterSourceId && filterSourceId !== 'all' && src.id !== filterSourceId) continue;
            const cached = _catalogBySource[src.id];
            if (!cached || !cached.ok || !cached.catalog) continue;
            const mods = cached.catalog.mods || [];
            for (let j = 0; j < mods.length; j++) {
                rows.push(mods[j]);
            }
        }
        return rows;
    }

    function enrichRow(row) {
        const local = readLocalPackageVersion(row.packageName);
        const status = resolveEntryStatus(local, row.version);
        const key = jobKey(row.sourceId, row.packageName);
        const job = _jobState[key] || null;
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
        let n = 0;
        forEachDedupedPackage(function (info) {
            if (info.status === 'update') n++;
        });
        return n;
    }

    function countNew() {
        let n = 0;
        forEachDedupedPackage(function (info) {
            if (info.isNew) n++;
        });
        return n;
    }

    /** 齿轮角标：可更新 + 未查看的新增 Mod（按 packageName 去重） */
    function countBadgeNotices() {
        let n = 0;
        forEachDedupedPackage(function (info) {
            if (info.status === 'update' || info.isNew) n++;
        });
        return n;
    }

    /** 一键更新可自动处理的条目（跳过多源，须玩家手动选来源） */
    function countAutoUpdatable() {
        const rows = dedupePackageRows(collectStoreRows('all'));
        rebuildMultiSourceMap(rows);
        const seenPkg = {};
        let n = 0;
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const info = enrichRow(row);
            if (info.status !== 'update') continue;
            if (_multiSourceIds[row.packageName]) continue;
            if (seenPkg[row.packageName]) continue;
            seenPkg[row.packageName] = true;
            n++;
        }
        return n;
    }

    function countMultiSourceUpdatable() {
        const rows = dedupePackageRows(collectStoreRows('all'));
        rebuildMultiSourceMap(rows);
        const pkgs = {};
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const info = enrichRow(row);
            if (info.status === 'update' && _multiSourceIds[row.packageName]) pkgs[row.packageName] = true;
        }
        return Object.keys(pkgs).length;
    }

    function refreshAllCatalogs() {
        const cfg = getConfig();
        const enabled = cfg.sources.filter(function (s) { return s.enabled; });
        const tasks = enabled.map(function (src) {
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
        const key = jobKey(sourceId, modId);
        const cur = _jobState[key] || {
            status: 'idle',
            progress: 0,
            received: 0,
            total: null,
            speed: 0,
            eta: null,
            error: ''
        };
        for (const k in patch) {
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
        const cfg = getConfig();
        const maxBytes = cfg.maxDownloadBytes || DEFAULT_MAX_BYTES;
        const tmpId = 'dl-' + Date.now() + '-' + Math.random().toString(16).slice(2);
        const tmpDir = pathMod.join(TMP_ROOT, tmpId);
        const extractRoot = pathMod.join(tmpDir, 'extract');
        // 大包续传：按 sha256 固定 partial，失败重试可接着下
        const resumeDir = pathMod.join(TMP_ROOT, 'resume');
        const partialPath = pathMod.join(resumeDir, entry.sha256 + '.partial');
        const zipPath = pathMod.join(tmpDir, 'pack.zip');

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
                    throw new Error(storeT('errSha256Failed'));
                }
                fs.copyFileSync(partialPath, zipPath);
                setJob(entry.sourceId, entry.packageName, {
                    status: 'extracting',
                    progress: 100,
                    received: dl.bytes,
                    total: dl.bytes,
                    error: ''
                });
                const buf = fs.readFileSync(partialPath);
                const extractedPkg = extractStandardPackage(buf, entry.packageName, extractRoot);
                ensureDir(LOCALMODS_DIR);
                const finalPkg = pathMod.join(LOCALMODS_DIR, entry.packageName);
                const backup = finalPkg + '.bak-' + Date.now();
                const hadOld = fs.existsSync(finalPkg);
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
        if (isPackageInstallBusy(entry.packageName)) return false;
        const key = jobKey(entry.sourceId, entry.packageName);
        const cur = _jobState[key];
        if (cur && isBusyJobStatus(cur.status)) return false;
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
        const rows = dedupePackageRows(collectStoreRows('all'));
        rebuildMultiSourceMap(rows);
        const seenPkg = {};
        const skippedMultiPkgs = {};
        let queued = 0;
        let skippedMulti = 0;
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const info = enrichRow(row);
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
            const entry = _queue.shift();
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
        const cfg = getConfig();
        if (cfg.suppressInstallHint) return;
        ensureStyles();
        if (document.getElementById('ml-store-hint-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'ml-store-hint-overlay';
        overlay.className = 'ml-store-hint-overlay';
        overlay.innerHTML =
            '<div class="ml-store-hint-modal" role="dialog">' +
            '<div class="ml-store-hint-header">' + escHtml(storeT('installDoneTitle')) + '</div>' +
            '<div class="ml-store-hint-body">' +
            '<p>' + escHtml(storeT('installDoneBody')) + '</p>' +
            '<label class="ml-store-hint-check">' +
            '<input type="checkbox" id="ml-store-hint-suppress"> ' + escHtml(storeT('installDoneSuppress')) +
            '</label>' +
            '</div>' +
            '<div class="ml-store-hint-footer">' +
            '<button type="button" class="ml-btn ml-btn-primary" id="ml-store-hint-ok">' + escHtml(storeT('btnOk')) + '</button>' +
            '</div>' +
            '</div>';

        function closeHint() {
            const box = document.getElementById('ml-store-hint-suppress');
            if (box && box.checked) {
                const next = getConfig();
                next.suppressInstallHint = true;
                saveConfig(next);
            }
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        }

        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) closeHint();
        });
        document.body.appendChild(overlay);
        const okBtn = document.getElementById('ml-store-hint-ok');
        if (okBtn) okBtn.addEventListener('click', closeHint);
    }

    // ================================================================
    // 更新日志（changelogUrl · 见 docs/mod商店拓展.md §5.1）
    // ================================================================

    function readLocalChangelog(packageName) {
        if (!isSafePackageName(packageName)) return null;
        const p = pathMod.join(LOCALMODS_DIR, packageName, LOCAL_CHANGELOG_NAME);
        if (!fs.existsSync(p) || !fs.statSync(p).isFile()) return null;
        try {
            const text = fs.readFileSync(p, 'utf-8');
            return String(text || '').trim() ? text : null;
        } catch (e) {
            return null;
        }
    }

    function fetchRemoteChangelog(entry) {
        assertDownloadHost(entry, entry.changelogUrl);
        return requestBuffer(entry.changelogUrl, { maxBytes: CHANGELOG_MAX_BYTES }).then(function (result) {
            const buf = Buffer.isBuffer(result) ? result : result.buffer;
            const text = buf.toString('utf-8');
            if (!String(text || '').trim()) {
                throw new Error(storeT('changelogLinkEmpty'));
            }
            return text;
        });
    }

    /** 已最新：本地优先，无则远程；可更新/未下载/无版本：远程 */
    function loadChangelogMarkdown(info) {
        const row = info.row;
        if (!row.changelogUrl) {
            return Promise.reject(new Error(storeT('changelogLoadFailed')));
        }
        const preferLocal = info.status === 'latest';
        if (preferLocal) {
            const local = readLocalChangelog(row.packageName);
            if (local) return Promise.resolve(local);
        }
        return fetchRemoteChangelog(row).catch(function (err) {
            const msg = err && err.message ? String(err.message) : '';
            if (msg === storeT('changelogLinkEmpty') || msg.indexOf(storeT('changelogLinkEmpty')) !== -1) {
                throw err;
            }
            throw new Error(storeT('changelogLoadFailed') + (msg ? '：' + msg : ''));
        });
    }

    function showStoreChangelog(title, body, mode) {
        const ML = window.ModLoader;
        if (!ML || typeof ML.showChangelogModal !== 'function') return;
        ML.showChangelogModal(title, body, { mode: mode === 'text' ? 'text' : 'md' });
    }

    function isStoreChangelogOpen() {
        const ML = window.ModLoader;
        return !!(ML && typeof ML.isChangelogModalOpen === 'function' && ML.isChangelogModalOpen());
    }

    function openStoreChangelog(info) {
        const row = info.row;
        const title = storeT('changelogTitle', {
            name: row.packageName,
            version: row.version || ''
        });
        showStoreChangelog(title, storeT('changelogLoading'), 'text');
        loadChangelogMarkdown(info).then(function (md) {
            if (!isStoreChangelogOpen()) return;
            showStoreChangelog(title, md, 'md');
        }).catch(function (err) {
            if (!isStoreChangelogOpen()) return;
            const msg = err && err.message ? String(err.message) : storeT('changelogLoadFailed');
            showStoreChangelog(title, msg, 'text');
        });
    }

    // ================================================================
    // UI
    // ================================================================

    function ensureStyles() {
        if (document.getElementById('ml-store-styles')) return;
        const style = document.createElement('style');
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
        if (status === 'missing') return storeT('actionDownload');
        if (status === 'update') return storeT('actionUpdate');
        if (status === 'latest') return storeT('actionLatest');
        if (status === 'unknown') return storeT('actionDownloadOverwrite');
        return storeT('actionDownload');
    }

    function statusButtonDisabled(status, job, packageName) {
        if (job && isBusyJobStatus(job.status)) return true;
        if (packageName && isPackageInstallBusy(packageName)) return true;
        return status === 'latest';
    }

    function jobStatusText(job) {
        if (!job) return '';
        if (job.status === 'queued') return storeT('jobQueued');
        if (job.status === 'downloading') {
            const recv = formatBytes(job.received || 0);
            const totalPart = job.total != null ? formatBytes(job.total) : storeT('unitQuestion');
            const pct = (job.progress != null && job.total) ? (job.progress + '%') : '…';
            const speed = formatSpeed(job.speed || 0);
            const eta = formatEta(job.eta);
            return storeT('jobDownloading', { recv: recv, total: totalPart, pct: pct, speed: speed, eta: eta });
        }
        if (job.status === 'verifying') return storeT('jobVerifying');
        if (job.status === 'extracting') return storeT('jobExtracting');
        if (job.status === 'done') return storeT('jobDone');
        if (job.status === 'error') return job.error || storeT('jobFailed');
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
        const el = getListScrollEl();
        _listScrollTop = el ? el.scrollTop : 0;
    }

    function restoreListScroll() {
        const el = getListScrollEl();
        if (el) el.scrollTop = _listScrollTop;
    }

    function updateToolbar() {
        if (!_panelRoot || _viewMode !== 'list') return;
        const btn = _panelRoot.querySelector('.ml-store-update-all');
        if (!btn) return;
        const n = countAutoUpdatable();
        const multi = countMultiSourceUpdatable();
        btn.disabled = n <= 0;
        btn.textContent = storeT('btnUpdateAll', { n: n });
        btn.title = multi > 0 ? storeT('hintMultiSourceTitle') : '';
    }

    function countMissing() {
        const rows = dedupePackageRows(collectStoreRows('all'));
        let n = 0;
        for (let i = 0; i < rows.length; i++) {
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
        const upd = countUpdatable();
        const newest = countNew();
        const miss = countMissing();
        let html = '<span class="ml-store-tabs-label">' + escHtml(storeT('statusLabel')) + '</span>';
        html += buildStatusTabBtn('all', storeT('statusAll'));
        html += buildStatusTabBtn('update', storeT('statusUpdatable') + (upd > 0 ? '（' + upd + '）' : ''));
        html += buildStatusTabBtn('new', storeT('statusNew') + (newest > 0 ? '（' + newest + '）' : ''));
        html += buildStatusTabBtn('missing', storeT('statusMissing') + (miss > 0 ? '（' + miss + '）' : ''));
        return html;
    }

    function buildStatusTabBtn(id, label) {
        return '<button type="button" class="ml-store-tab ml-store-status-tab' +
            (_activeStatusFilter === id ? ' is-active' : '') +
            '" data-status="' + escHtml(id) + '">' + escHtml(label) + '</button>';
    }

    function bindStatusTabEvents(root) {
        const tabs = root.querySelectorAll('.ml-store-status-tab');
        for (let i = 0; i < tabs.length; i++) {
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
        const wrap = _panelRoot.querySelector('.ml-store-status-tabs');
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
        const list = _panelRoot.querySelector('.ml-store-list');
        if (!list) return;
        list.innerHTML = buildListHtml();
        bindListEvents(list);
    }

    function buildListHtml() {
        const cfg = getConfig();
        const enabled = cfg.sources.filter(function (s) { return s.enabled; });
        if (!enabled.length) {
            return '<div class="ml-store-empty">' + storeT('emptyNoSources') + '</div>';
        }

        let errHtml = '';
        for (let i = 0; i < enabled.length; i++) {
            const c = _catalogBySource[enabled[i].id];
            if (c && !c.ok) {
                errHtml += '<div class="ml-store-src-err">' + escHtml(storeT('sourceLoadFailed', {
                    name: enabled[i].name,
                    error: c.error || storeT('sourceUnknownError')
                })) + '</div>';
            }
        }

        const filter = _activeTab === 'all' ? 'all' : _activeTab;
        const rows = dedupePackageRows(collectStoreRows(filter));
        rebuildMultiSourceMap(dedupePackageRows(collectStoreRows('all')));

        if (!rows.length) {
            const anyOk = enabled.some(function (s) {
                return _catalogBySource[s.id] && _catalogBySource[s.id].ok;
            });
            const anyFetched = enabled.some(function (s) {
                return !!_catalogBySource[s.id];
            });
            if (!anyFetched) {
                return errHtml + '<div class="ml-store-empty">' + escHtml(storeT('emptyClickRefresh')) + '</div>';
            }
            if (!anyOk) {
                return errHtml + '<div class="ml-store-empty">' + escHtml(storeT('emptyAllSourcesFailed')) + '</div>';
            }
            return errHtml + '<div class="ml-store-empty">' + escHtml(storeT('emptyNoMods')) + '</div>';
        }

        let html = errHtml;
        let shown = 0;
        for (let j = 0; j < rows.length; j++) {
            const info = enrichRow(rows[j]);
            if (!rowMatchesStatusFilter(info)) continue;
            shown++;
            const r = info.row;
            const localText = !info.local.exists
                ? storeT('localNotDownloaded')
                : (info.local.version || storeT('localUnknown'));
            const disabled = statusButtonDisabled(info.status, info.job, r.packageName);
            const label = statusButtonLabel(info.status);
            const jobText = jobStatusText(info.job);
            const jobClass = info.job && info.job.status === 'error' ? 'ml-store-error' : 'ml-store-progress';

            html += '<div class="ml-store-item' + (info.isNew ? ' ml-store-item-has-new' : '') +
                '" data-source="' + escHtml(r.sourceId) +
                '" data-mod="' + escHtml(r.packageName) + '">';
            html += '<div class="ml-store-item-title">' + escHtml(r.packageName);
            if (info.isNew) {
                html += '<span class="ml-store-badge ml-store-badge-new" title="' + escHtml(storeT('badgeNewTitle')) + '">New</span>';
            }
            if (info.multiSource) {
                html += '<span class="ml-store-badge">' + escHtml(storeT('badgeMultiSource')) + '</span>';
            }
            html += '</div>';
            if (r.summary) {
                html += '<div class="ml-store-summary">' + escHtml(r.summary) + '</div>';
            }
            html += '<div class="ml-store-meta">' + escHtml(storeT('metaLocal')) + ': ' + escHtml(localText) +
                '　' + escHtml(storeT('metaStore')) + ': ' + escHtml(r.version) +
                '　' + escHtml(storeT('metaSize')) + ': ' + escHtml(r.size != null ? formatBytes(r.size) : storeT('localUnknown')) +
                '　' + escHtml(storeT('metaSource')) + ': ' + escHtml(r.sourceName) + '</div>';
            html += '<div class="ml-store-actions">';
            html += '<button type="button" class="ml-btn ml-btn-primary ml-store-action-btn"' +
                (disabled ? ' disabled' : '') + '>' + escHtml(label) + '</button>';
            if (r.changelogUrl) {
                html += '<button type="button" class="ml-btn ml-btn-secondary ml-store-changelog-btn">' +
                    escHtml(storeT('btnChangelog')) + '</button>';
            }
            if (jobText) {
                html += '<span class="' + jobClass + '">' + escHtml(jobText) + '</span>';
            }
            html += '</div></div>';
        }
        if (!shown) {
            const filterLabel = _activeStatusFilter === 'update' ? storeT('statusUpdatable')
                : (_activeStatusFilter === 'new' ? storeT('statusNew')
                    : (_activeStatusFilter === 'missing' ? storeT('statusMissing') : ''));
            const msg = filterLabel
                ? storeT('emptyNoModsFiltered', { filter: filterLabel })
                : storeT('emptyNoMods');
            return errHtml + '<div class="ml-store-empty">' + escHtml(msg) + '</div>';
        }
        return html;
    }

    function bindListEvents(listEl) {
        const items = listEl.querySelectorAll('.ml-store-item');
        for (let i = 0; i < items.length; i++) {
            items[i].addEventListener('click', function (e) {
                const item = e.currentTarget;
                const modId = item.getAttribute('data-mod');
                if (modId && isModNew(modId)) {
                    markPackageSeen(modId);
                    syncStatusTabsUi();
                    updateToolbar();
                    rerenderListOnly();
                }
            });
        }
        const btns = listEl.querySelectorAll('.ml-store-action-btn');
        for (let j = 0; j < btns.length; j++) {
            btns[j].addEventListener('click', function (e) {
                e.stopPropagation();
                const item = e.currentTarget.closest('.ml-store-item');
                if (!item) return;
                const sourceId = item.getAttribute('data-source');
                const modId = item.getAttribute('data-mod');
                const rows = dedupePackageRows(collectStoreRows('all'));
                let entry = null;
                for (let k = 0; k < rows.length; k++) {
                    if (rows[k].sourceId === sourceId && rows[k].packageName === modId) {
                        entry = rows[k];
                        break;
                    }
                }
                if (entry) enqueueInstall(entry);
            });
        }
        const clBtns = listEl.querySelectorAll('.ml-store-changelog-btn');
        for (let c = 0; c < clBtns.length; c++) {
            clBtns[c].addEventListener('click', function (e) {
                e.stopPropagation();
                const item = e.currentTarget.closest('.ml-store-item');
                if (!item) return;
                const sourceId = item.getAttribute('data-source');
                const modId = item.getAttribute('data-mod');
                const rows = dedupePackageRows(collectStoreRows('all'));
                let entry = null;
                for (let k = 0; k < rows.length; k++) {
                    if (rows[k].sourceId === sourceId && rows[k].packageName === modId) {
                        entry = rows[k];
                        break;
                    }
                }
                if (entry) openStoreChangelog(enrichRow(entry));
            });
        }
    }

    function buildTabsHtml() {
        const cfg = getConfig();
        let html = '<button type="button" class="ml-store-tab' +
            (_activeTab === 'all' ? ' is-active' : '') + '" data-tab="all">' + escHtml(storeT('tabAll')) + '</button>';
        for (let i = 0; i < cfg.sources.length; i++) {
            const s = cfg.sources[i];
            if (!s.enabled) continue;
            html += '<button type="button" class="ml-store-tab' +
                (_activeTab === s.id ? ' is-active' : '') +
                '" data-tab="' + escHtml(s.id) + '">' + escHtml(s.name) + '</button>';
        }
        return html;
    }

    function applyMaxDownloadMbInput(root) {
        const el = root.querySelector('.ml-store-max-mb');
        if (!el) return;
        let mb = parseInt(el.value, 10);
        if (!isFinite(mb) || mb < 1) {
            alertStore(storeT('alertMaxMbRange'));
            return false;
        }
        if (mb > 2048) mb = 2048;
        const cfg = getConfig();
        cfg.maxDownloadBytes = mb * 1024 * 1024;
        saveConfig(cfg);
        el.value = String(mb);
        return true;
    }

    function buildSourcesHtml() {
        const cfg = getConfig();
        const maxMb = Math.round(cfg.maxDownloadBytes / (1024 * 1024));
        let html = '<div class="ml-store-sources">';
        html += '<div class="ml-store-settings-block">';
        html += '<div class="ml-store-settings-title">' + escHtml(storeT('settingsTitle')) + '</div>';
        html += '<label class="ml-store-max-label">' + escHtml(storeT('settingsMaxMbLabel'));
        html += '<input type="number" class="ml-store-max-mb" min="1" max="2048" step="1" value="' + maxMb + '">';
        html += '</label>';
        html += '<div class="ml-store-settings-hint">' + escHtml(storeT('settingsMaxMbHint')) + '</div>';
        html += '<button type="button" class="ml-btn ml-btn-secondary ml-store-save-max-btn">' + escHtml(storeT('btnSaveMax')) + '</button>';
        html += '</div>';
        if (!cfg.sources.length) {
            html += '<div class="ml-store-empty" style="padding:12px 0;">' + escHtml(storeT('emptyNoSubscriptions')) + '</div>';
        }
        for (let i = 0; i < cfg.sources.length; i++) {
            const s = cfg.sources[i];
            html += '<div class="ml-store-src-row" data-id="' + escHtml(s.id) + '">';
            html += '<span class="ml-store-src-name">' + escHtml(s.name) + '</span>';
            html += '<span class="ml-store-src-url">' + escHtml(s.catalogUrl) + '</span>';
            html += '<label style="font-size:12px;display:flex;align-items:center;gap:4px;">' +
                '<input type="checkbox" class="ml-store-src-enable"' +
                (s.enabled ? ' checked' : '') + '>' + escHtml(storeT('btnEnabled')) + '</label>';
            html += '<button type="button" class="ml-btn ml-btn-danger ml-store-src-del">' + escHtml(storeT('btnDelete')) + '</button>';
            html += '</div>';
        }
        html += '<div class="ml-store-form">';
        html += '<label>' + escHtml(storeT('formDisplayName')) + '<input type="text" class="ml-store-add-name" placeholder="' + escHtml(storeT('formDisplayNamePh')) + '"></label>';
        html += '<label>' + escHtml(storeT('formCatalogUrl')) + '<input type="text" class="ml-store-add-url" placeholder="' + escHtml(storeT('formCatalogUrlPh')) + '"></label>';
        html += '<div class="ml-store-form-actions">';
        html += '<button type="button" class="ml-btn ml-btn-primary ml-store-add-btn">' + escHtml(storeT('btnAddSource')) + '</button>';
        html += '</div></div></div>';
        return html;
    }

    function bindSourcesEvents(root) {
        const saveMaxBtn = root.querySelector('.ml-store-save-max-btn');
        if (saveMaxBtn) {
            saveMaxBtn.addEventListener('click', function () {
                if (applyMaxDownloadMbInput(root)) {
                    alertStore(storeT('alertMaxMbSaved'));
                }
            });
        }
        const maxMbEl = root.querySelector('.ml-store-max-mb');
        if (maxMbEl) {
            maxMbEl.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (applyMaxDownloadMbInput(root)) {
                        alertStore(storeT('alertMaxMbSaved'));
                    }
                }
            });
        }
        const enables = root.querySelectorAll('.ml-store-src-enable');
        for (let i = 0; i < enables.length; i++) {
            enables[i].addEventListener('change', function (e) {
                const row = e.currentTarget.closest('.ml-store-src-row');
                const id = row && row.getAttribute('data-id');
                const cfg = getConfig();
                for (let j = 0; j < cfg.sources.length; j++) {
                    if (cfg.sources[j].id === id) {
                        cfg.sources[j].enabled = !!e.currentTarget.checked;
                        break;
                    }
                }
                saveConfig(cfg);
            });
        }
        const dels = root.querySelectorAll('.ml-store-src-del');
        for (let d = 0; d < dels.length; d++) {
            dels[d].addEventListener('click', function (e) {
                const row = e.currentTarget.closest('.ml-store-src-row');
                const id = row && row.getAttribute('data-id');
                const cfg = getConfig();
                cfg.sources = cfg.sources.filter(function (s) { return s.id !== id; });
                saveConfig(cfg);
                delete _catalogBySource[id];
                if (_activeTab === id) _activeTab = 'all';
                renderPanel(_panelRoot);
            });
        }
        const addBtn = root.querySelector('.ml-store-add-btn');
        if (addBtn) {
            addBtn.addEventListener('click', function () {
                const nameEl = root.querySelector('.ml-store-add-name');
                const urlEl = root.querySelector('.ml-store-add-url');
                let name = nameEl ? nameEl.value.trim() : '';
                const catalogUrl = urlEl ? urlEl.value.trim() : '';
                if (!catalogUrl) {
                    alertStore(storeT('alertCatalogRequired'));
                    return;
                }
                try {
                    parseHttpsUrl(catalogUrl);
                } catch (err) {
                    alertStore(err.message || storeT('alertCatalogHttps'));
                    return;
                }
                if (!name) name = storeT('unnamedSource');
                const cfg = getConfig();
                const id = makeSourceId(name, catalogUrl);
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
    }

    function alertStore(msg) {
        if (typeof ML.showConfirmDialog === 'function') {
            ML.showConfirmDialog(storeT('dialogNotice'), String(msg), [{
                text: storeT('btnOk'),
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
        const btn = _panelRoot && _panelRoot.querySelector('.ml-store-refresh-btn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = storeT('btnRefreshing');
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
        registerStoreEntry();
        getConfig();

        if (_viewMode === 'sources') {
            container.innerHTML =
                '<div class="ml-store">' +
                '<div class="ml-store-toolbar">' +
                '<button type="button" class="ml-btn ml-btn-secondary ml-store-back-btn">' + escHtml(storeT('btnBack')) + '</button>' +
                '<span style="color:var(--ml-text-secondary,#9a9ab0);font-size:12px;">' + escHtml(storeT('btnSubscribeManage')) + '</span>' +
                '</div>' +
                '<div class="ml-store-sources-scroll ml-list-scroll">' +
                buildSourcesHtml() +
                '</div></div>';
            bindSourcesEvents(container);
            const back = container.querySelector('.ml-store-toolbar .ml-store-back-btn');
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
            '<button type="button" class="ml-btn ml-btn-secondary ml-store-sources-btn">' + escHtml(storeT('btnSubscribeManage')) + '</button>' +
            '<button type="button" class="ml-btn ml-btn-primary ml-store-refresh-btn">' + escHtml(storeT('btnRefresh')) + '</button>' +
            '<button type="button" class="ml-btn ml-btn-primary ml-store-update-all"' +
            (countAutoUpdatable() > 0 ? '' : ' disabled') +
            (countMultiSourceUpdatable() > 0 ? ' title="' + escHtml(storeT('hintMultiSourceTitle')) + '"' : '') +
            '>' + escHtml(storeT('btnUpdateAll', { n: countAutoUpdatable() })) + '</button>' +
            '</div>' +
            '<div class="ml-store-hint">' + escHtml(storeT('hintToolbar')) + '</div>' +
            '<div class="ml-store-tabs">' + buildTabsHtml() + '</div>' +
            '<div class="ml-store-tabs ml-store-status-tabs">' + buildStatusTabsHtml() + '</div>' +
            '<div class="ml-store-list ml-list-scroll">' + buildListHtml() + '</div>' +
            '</div>';

        const srcBtn = container.querySelector('.ml-store-sources-btn');
        if (srcBtn) {
            srcBtn.addEventListener('click', function () {
                _viewMode = 'sources';
                renderPanel(container);
            });
        }
        const refreshBtn = container.querySelector('.ml-store-refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', function () { doRefresh(); });
        }
        const updateAllBtn = container.querySelector('.ml-store-update-all');
        if (updateAllBtn) {
            updateAllBtn.addEventListener('click', function () {
                saveListScroll();
                const result = enqueueAllUpdates();
                if (!result.queued) {
                    if (result.skippedMulti > 0) {
                        alertStore(storeT('alertMultiSourcePick'));
                    } else {
                        alertStore(storeT('alertNoAutoUpdate'));
                    }
                    restoreListScroll();
                    return;
                }
                if (result.skippedMulti > 0) {
                    alertStore(storeT('alertQueuedSkipped', {
                        queued: result.queued,
                        skipped: result.skippedMulti
                    }));
                }
                refreshListView();
            });
        }
        const tabs = container.querySelectorAll('.ml-store-tab:not(.ml-store-status-tab)');
        for (let t = 0; t < tabs.length; t++) {
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

    function registerStoreEntry() {
        ML.registerLogEntry({
            id: 'modStore',
            label: storeT('entryLabel'),
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
                const cfg = getConfig();
                const enabled = cfg.sources.filter(function (s) { return s.enabled; });
                if (enabled.length) {
                    const needFetch = enabled.some(function (s) { return !_catalogBySource[s.id]; });
                    if (needFetch) doRefresh();
                }
            }
        });
    }

    function register() {
        loadConfig();
        registerStoreEntry();
        console.info('[modStore] Mod store entry registered');
        const cfg = getConfig();
        const enabled = cfg.sources.filter(function (s) { return s.enabled; });
        if (enabled.length) {
            refreshAllCatalogs().catch(function () { /* 后台预拉 catalog，供齿轮角标统计 */ });
        }
    }

    register();
})();
