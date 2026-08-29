/**
 * ModLoader libs 扩展 · 管理器在线更新（MVP）
 *
 * 存在即生效，删除即关闭。通过 registerLogEntry 挂载「设置 → 管理器更新」。
 * 与 Mod 商店分离：只更新管理器白名单文件，不碰玩家 _localmods。
 *
 * 管线：channel(main) → tag catalog → 哈希跳过 → 全量临时下载 → 备份替换 → remove；失败还原。
 */
(function () {
    'use strict';

    const ML = typeof window !== 'undefined' ? window.ModLoader : null;
    if (!ML || typeof ML.registerLogEntry !== 'function') {
        console.warn('[modLoaderUpdater] ModLoader.registerLogEntry 不可用，扩展未挂载');
        return;
    }

    const fs = require('fs');
    const pathMod = require('path');
    const https = require('https');
    const crypto = require('crypto');
    const urlMod = require('url');

    const MODS_DIR = pathMod.join(process.cwd(), 'js', 'mods');
    const CONFIG_PATH = pathMod.join(MODS_DIR, 'config', 'modloader_updater.json');
    const TMP_ROOT = pathMod.join(MODS_DIR, 'config', '.ml-updater-tmp');
    const MODLOADER_CONFIG_PATH = pathMod.join(MODS_DIR, 'config', 'modloader_config.json');

    const REQUEST_TIMEOUT_MS = 60000;
    const USER_AGENT = 'ModLoader-Updater/1.0';
    // 管理器仓作者自控，不设体积上限（用大数兜底防失控）
    const MAX_BYTES = Number.MAX_SAFE_INTEGER;

    const MIRRORS = {
        github: {
            id: 'github',
            label: 'GitHub',
            rawBase: function (ref) {
                return 'https://raw.githubusercontent.com/jokerBBC/rpg-maker-mz-mod-loader/' +
                    encodeURIComponent(ref).replace(/%2F/gi, '/') + '/';
            }
        },
        gitee: {
            id: 'gitee',
            label: 'Gitee',
            rawBase: function (ref) {
                return 'https://gitee.com/Jokerbbc/rpg-maker-mz-mod-loader/raw/' +
                    encodeURIComponent(ref).replace(/%2F/gi, '/') + '/';
            }
        }
    };

    // ================================================================
    // 内嵌 i18n（跟随 ml_language；对齐商店模式）
    // ================================================================
    const I18N_FALLBACK = 'zh_CN';
    const I18N_PACKS = {
        zh_CN: {
            entryLabel: '管理器更新',
            localVersion: '本地 {v}',
            remoteVersion: '远端 {v}',
            remoteLatest: '已是最新',
            remoteUnknown: '未检查',
            remoteCheckFailed: '检查失败',
            btnCheck: '检查更新',
            btnUpdate: '更新',
            btnCopyLog: '复制升级过程日志',
            btnChangelog: '更新日志',
            btnChecking: '检查中…',
            btnUpdating: '更新中…',
            disableUpdates: '禁用管理器更新',
            excludeAuthorTools: '在线更新时不更新 Mod 商店作者工具（打包 GUI、catalog 发布等 · tools/modstore/）',
            logTitle: '升级过程',
            logEmpty: '点击「检查更新」开始。',
            logDisabled: '已禁用管理器更新。',
            logMirror: '使用镜像：{name}',
            logChannel: 'channel 指向 tag：{tag}',
            logCatalog: 'catalog {remote}，本地 {local}',
            logDiffSummary: '文件差异：需更新 {need} · 与 catalog 一致 {match}',
            logDiffNeedTitle: '需更新文件：',
            logDiffAllMatch: 'catalog 所列文件与本地一致',
            logDiffRemove: '更新后将清理 {count} 个遗弃路径：',
            logDiffRemoveGone: '以下 {count} 个遗弃路径本地已不存在（更新时跳过）：',
            logMirrorTryFail: '{mirror} 拉取失败：{error}，改试 {next}',
            logMirrorShaRetry: '{mirror} hash 未通过，改试 {next}',
            logMirrorFallbackOk: '已改用 {mirror}：{path}',
            logAlreadyLatest: '已是最新版本，无需更新。',
            logSkip: '跳过未改：{path}',
            logSkipAuthorTool: '跳过 Mod 商店作者工具：{path}',
            logDownload: '下载 {path} …',
            logDownloadOk: '下载 {path} … OK',
            logSha256Mismatch: 'sha256 不匹配：{path}（{mirror}）期望 {expectedSha} / {expectedSize} B · 下载 {actualSha} / {actualSize} B · LF归一 {lfSha} / {lfSize} B',
            logSha256Url: '  URL：{url}',
            logSha256LfHint: '  提示：LF 归一 hash 与 catalog 一致 → catalog 可能按 CRLF 磁盘生成，需重新 sync 并打 tag',
            logBackup: '备份将改文件…',
            logCommit: '写入新文件…',
            logRemove: '清理遗弃文件：{path}',
            logRemoveSkip: '清理跳过（已不存在）：{path}',
            logDone: '完成。请按 F5 刷新游戏。',
            logFail: '失败：{error}',
            logFailSummary: '更新失败，已终止。请从 GitHub / Gitee Release 下载整包覆盖安装，或点击「复制升级过程日志」向作者反馈。',
            logRollback: '已从备份还原。',
            logMinVersion: '本地版本过旧（建议 ≥ {min}），若更新异常请整包重装。',
            logTagMissing: '无法拉取 tag「{tag}」下的 catalog。请确认作者已打同名 tag（勿静默用 main）。',
            logRejected: 'catalog 含非法路径，已中止：{detail}',
            copyOk: '日志已复制到剪贴板',
            copyFail: '复制失败',
            errHttpsOnly: '仅允许 https',
            errUrlInvalid: 'URL 无效',
            errTimeout: '请求超时',
            errHttp: 'HTTP {code}',
            errRedirectTooMany: '重定向过多',
            errChannelInvalid: 'channel.json 无效',
            errCatalogInvalid: 'catalog.json 无效',
            errSha256: 'sha256 校验失败：{path}',
            errBusy: '正在进行检查或更新，请稍候',
            alertDisabled: '已禁用管理器更新'
        },
        zh_TW: {
            entryLabel: '管理器更新',
            localVersion: '本機 {v}',
            remoteVersion: '遠端 {v}',
            remoteLatest: '已是最新',
            remoteUnknown: '未檢查',
            remoteCheckFailed: '檢查失敗',
            btnCheck: '檢查更新',
            btnUpdate: '更新',
            btnCopyLog: '複製升級過程日誌',
            btnChangelog: '更新日誌',
            btnChecking: '檢查中…',
            btnUpdating: '更新中…',
            disableUpdates: '停用管理器更新',
            excludeAuthorTools: '線上更新時不更新 Mod 商店作者工具（打包 GUI、catalog 發布等 · tools/modstore/）',
            logTitle: '升級過程',
            logEmpty: '點擊「檢查更新」開始。',
            logDisabled: '已停用管理器更新。',
            logMirror: '使用鏡像：{name}',
            logChannel: 'channel 指向 tag：{tag}',
            logCatalog: 'catalog {remote}，本機 {local}',
            logDiffSummary: '檔案差異：需更新 {need} · 與 catalog 一致 {match}',
            logDiffNeedTitle: '需更新檔案：',
            logDiffAllMatch: 'catalog 所列檔案與本機一致',
            logDiffRemove: '更新後將清理 {count} 個遺棄路徑：',
            logDiffRemoveGone: '以下 {count} 個遺棄路徑本機已不存在（更新時跳過）：',
            logMirrorTryFail: '{mirror} 拉取失敗：{error}，改試 {next}',
            logMirrorShaRetry: '{mirror} hash 未通過，改試 {next}',
            logMirrorFallbackOk: '已改用 {mirror}：{path}',
            logAlreadyLatest: '已是最新版本，無需更新。',
            logSkip: '跳過未改：{path}',
            logSkipAuthorTool: '跳過 Mod 商店作者工具：{path}',
            logDownload: '下載 {path} …',
            logDownloadOk: '下載 {path} … OK',
            logSha256Mismatch: 'sha256 不符：{path}（{mirror}）期望 {expectedSha} / {expectedSize} B · 下載 {actualSha} / {actualSize} B · LF歸一 {lfSha} / {lfSize} B',
            logSha256Url: '  URL：{url}',
            logSha256LfHint: '  提示：LF 歸一 hash 與 catalog 一致 → catalog 可能按 CRLF 磁碟生成，需重新 sync 並打 tag',
            logBackup: '備份將改檔案…',
            logCommit: '寫入新檔案…',
            logRemove: '清理遺棄檔案：{path}',
            logRemoveSkip: '清理跳過（已不存在）：{path}',
            logDone: '完成。請按 F5 重新整理遊戲。',
            logFail: '失敗：{error}',
            logFailSummary: '更新失敗，已終止。請從 GitHub / Gitee Release 下載整包覆蓋安裝，或點擊「複製升級過程日誌」向作者回報。',
            logRollback: '已從備份還原。',
            logMinVersion: '本機版本過舊（建議 ≥ {min}），若更新異常請整包重裝。',
            logTagMissing: '無法拉取 tag「{tag}」下的 catalog。請確認作者已打同名 tag（勿靜默用 main）。',
            logRejected: 'catalog 含非法路徑，已中止：{detail}',
            copyOk: '日誌已複製到剪貼板',
            copyFail: '複製失敗',
            errHttpsOnly: '僅允許 https',
            errUrlInvalid: 'URL 無效',
            errTimeout: '請求逾時',
            errHttp: 'HTTP {code}',
            errRedirectTooMany: '重定向過多',
            errChannelInvalid: 'channel.json 無效',
            errCatalogInvalid: 'catalog.json 無效',
            errSha256: 'sha256 校驗失敗：{path}',
            errBusy: '正在進行檢查或更新，請稍候',
            alertDisabled: '已停用管理器更新'
        },
        en: {
            entryLabel: 'Manager Update',
            localVersion: 'Local {v}',
            remoteVersion: 'Remote {v}',
            remoteLatest: 'Up to date',
            remoteUnknown: 'Not checked',
            remoteCheckFailed: 'Check failed',
            btnCheck: 'Check for updates',
            btnUpdate: 'Update',
            btnCopyLog: 'Copy update log',
            btnChangelog: 'Changelog',
            btnChecking: 'Checking…',
            btnUpdating: 'Updating…',
            disableUpdates: 'Disable manager updates',
            excludeAuthorTools: 'Skip Mod store author tools in online updates (pack GUI, catalog publish — tools/modstore/)',
            logTitle: 'Update log',
            logEmpty: 'Click “Check for updates” to start.',
            logDisabled: 'Manager updates are disabled.',
            logMirror: 'Mirror: {name}',
            logChannel: 'channel points to tag: {tag}',
            logCatalog: 'catalog {remote}, local {local}',
            logDiffSummary: 'File diff: to update {need} · match catalog {match}',
            logDiffNeedTitle: 'Files to update:',
            logDiffAllMatch: 'All catalog files match local',
            logDiffRemove: 'Will remove {count} obsolete path(s):',
            logDiffRemoveGone: '{count} obsolete path(s) already missing (will skip on update):',
            logMirrorTryFail: '{mirror} failed: {error}, trying {next}',
            logMirrorShaRetry: '{mirror} hash mismatch, trying {next}',
            logMirrorFallbackOk: 'Using {mirror}: {path}',
            logAlreadyLatest: 'Already up to date.',
            logSkip: 'Skip unchanged: {path}',
            logSkipAuthorTool: 'Skip Mod store author tool: {path}',
            logDownload: 'Download {path} …',
            logDownloadOk: 'Download {path} … OK',
            logSha256Mismatch: 'SHA256 mismatch: {path} ({mirror}) expected {expectedSha} / {expectedSize} B · got {actualSha} / {actualSize} B · LF-norm {lfSha} / {lfSize} B',
            logSha256Url: '  URL: {url}',
            logSha256LfHint: '  Hint: LF-normalized hash matches catalog — catalog may use CRLF disk digests; re-sync and re-tag',
            logBackup: 'Backing up files to replace…',
            logCommit: 'Writing new files…',
            logRemove: 'Remove obsolete: {path}',
            logRemoveSkip: 'Remove skipped (missing): {path}',
            logDone: 'Done. Press F5 to reload the game.',
            logFail: 'Failed: {error}',
            logFailSummary: 'Update failed and has been aborted. Download the full release from GitHub / Gitee, or click “Copy update log” to report to the author.',
            logRollback: 'Restored from backup.',
            logMinVersion: 'Local version is old (recommended ≥ {min}). Reinstall the full package if update fails.',
            logTagMissing: 'Cannot fetch catalog for tag “{tag}”. Author must create a matching tag (do not fall back to main).',
            logRejected: 'Catalog has illegal paths; aborted: {detail}',
            copyOk: 'Log copied to clipboard',
            copyFail: 'Copy failed',
            errHttpsOnly: 'HTTPS only',
            errUrlInvalid: 'Invalid URL',
            errTimeout: 'Request timed out',
            errHttp: 'HTTP {code}',
            errRedirectTooMany: 'Too many redirects',
            errChannelInvalid: 'Invalid channel.json',
            errCatalogInvalid: 'Invalid catalog.json',
            errSha256: 'SHA256 mismatch: {path}',
            errBusy: 'Check/update already in progress',
            alertDisabled: 'Manager updates are disabled'
        }
    };

    function readManagerLanguage() {
        try {
            if (fs.existsSync(MODLOADER_CONFIG_PATH)) {
                const raw = JSON.parse(fs.readFileSync(MODLOADER_CONFIG_PATH, 'utf8'));
                const lang = String(raw.ml_language || '').trim();
                if (lang && I18N_PACKS[lang]) return lang;
            }
        } catch (e) { /* ignore */ }
        return I18N_FALLBACK;
    }

    function t(key, params) {
        const lang = readManagerLanguage();
        const pack = I18N_PACKS[lang] || I18N_PACKS[I18N_FALLBACK] || {};
        const fb = I18N_PACKS[I18N_FALLBACK] || {};
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

    // ================================================================
    // 路径规则（与 tools/manager-release/pathRules.js 同语义）
    // ================================================================

    function normalizeRelPath(raw) {
        if (raw == null) return '';
        return String(raw).replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
    }

    function isHardRejectedPath(relPath) {
        const p = normalizeRelPath(relPath);
        if (!p) return true;
        if (p.indexOf('\\') !== -1) return true;
        if (p.indexOf('..') !== -1) return true;
        if (/^[a-zA-Z]:/.test(p) || p.charAt(0) === '/') return true;
        const lower = p.toLowerCase();
        const hardExact = {
            'mod_config.json': true,
            'config/modloader_config.json': true,
            'config/mod_store.json': true,
            'config/modloader_updater.json': true
        };
        if (hardExact[lower]) return true;
        if (lower === 'config/.modstore-tmp' || lower.indexOf('config/.modstore-tmp/') === 0) return true;
        if (lower === 'config/.ml-updater-tmp' || lower.indexOf('config/.ml-updater-tmp/') === 0) return true;
        if (lower === '_localmods' || lower.indexOf('_localmods/') === 0) return true;
        if (lower === '_workshop' || lower.indexOf('_workshop/') === 0) return true;
        if (/\/user-data(\/|$)/i.test(p) || /^tools\/.+\/user-data(\/|$)/i.test(p)) return true;
        return false;
    }

    function isWhitelistedPath(relPath) {
        const p = normalizeRelPath(relPath);
        if (!p || isHardRejectedPath(p)) return false;
        if (p === 'ModLoader.js') return true;
        if (p === 'config/modloader.css') return true;
        if (p.indexOf('libs/') === 0 && p.length > 5) return true;
        if (p.indexOf('docs/') === 0 && p.length > 5) return true;
        if (p.indexOf('config/language/') === 0 && p.length > 'config/language/'.length) return true;
        if (p.indexOf('modloader/') === 0 && p.length > 'modloader/'.length) return true;
        if (p.indexOf('tools/') === 0 && p.length > 6) {
            if (/\/user-data(\/|$)/i.test(p)) return false;
            return true;
        }
        return false;
    }

    // 与 pathRules.js catalog 排除同语义（SYNC_EXCLUDE + CATALOG_ONLY_EXCLUDE）
    function isPublishExcludedPath(relPath) {
        const p = normalizeRelPath(relPath);
        if (!p) return false;
        const exact = {
            'tools/cdkey.txt': true,
            'tools/check-i18n-zombies.js': true,
            'tools/modstore/batchPublishGitee.js': true,
            'tools/modstore/modStorePublish.js': true,
            'tools/modstore/syncModManifests.js': true,
            'docs/ModLoader_模块结构.md': true,
            'libs/piracyGate.js': true
        };
        if (exact[p]) return true;
        const prefixes = [
            'tools/manager-release/',
            'tools/.sora文件解包工具/',
            'tools/sorajm.js解密工具/',
            'tools/modstore/test/',
            'modloader/test/',
            'docs/adr/',
            'docs/功能Mod更新日志/'
        ];
        for (let i = 0; i < prefixes.length; i++) {
            const prefix = prefixes[i];
            const dir = prefix.replace(/\/$/, '');
            if (p === dir || p.indexOf(prefix) === 0) return true;
        }
        return false;
    }

    function isCatalogEligiblePath(relPath) {
        return isWhitelistedPath(relPath) && !isPublishExcludedPath(relPath);
    }

    function validateCatalog(catalog) {
        const errors = [];
        if (!catalog || typeof catalog !== 'object') {
            return { ok: false, errors: [t('errCatalogInvalid')], files: [], remove: [] };
        }
        if (Number(catalog.schema) !== 1) {
            errors.push('schema');
        }
        const version = String(catalog.version || '').trim();
        if (!version) errors.push('version');

        const fileSet = {};
        const files = [];
        if (!Array.isArray(catalog.files)) {
            errors.push('files');
        } else {
            for (let i = 0; i < catalog.files.length; i++) {
                const item = catalog.files[i];
                if (!item || typeof item !== 'object') {
                    errors.push('files[' + i + ']');
                    continue;
                }
                const p = normalizeRelPath(item.path);
                if (!p || p.indexOf('\\') !== -1 || isHardRejectedPath(p) || !isCatalogEligiblePath(p)) {
                    errors.push('illegal file path: ' + String(item.path));
                    continue;
                }
                if (fileSet[p]) {
                    errors.push('duplicate: ' + p);
                    continue;
                }
                const sha = String(item.sha256 || '').trim().toLowerCase();
                const size = Number(item.size);
                if (!/^[a-f0-9]{64}$/.test(sha) || !isFinite(size) || size < 0) {
                    errors.push('bad hash/size: ' + p);
                    continue;
                }
                fileSet[p] = true;
                files.push({ path: p, sha256: sha, size: Math.floor(size) });
            }
        }

        const remove = [];
        const removeSet = {};
        if (catalog.remove != null && !Array.isArray(catalog.remove)) {
            errors.push('remove');
        } else if (Array.isArray(catalog.remove)) {
            for (let j = 0; j < catalog.remove.length; j++) {
                const p = normalizeRelPath(catalog.remove[j]);
                if (!p || p.indexOf('\\') !== -1 || isHardRejectedPath(p)) {
                    errors.push('illegal remove path: ' + String(catalog.remove[j]));
                    continue;
                }
                if (!isWhitelistedPath(p) && p !== 'ModLoader.js') {
                    errors.push('illegal remove path: ' + String(catalog.remove[j]));
                    continue;
                }
                if (fileSet[p]) {
                    errors.push('remove∩files: ' + p);
                    continue;
                }
                if (removeSet[p]) continue;
                removeSet[p] = true;
                remove.push(p);
            }
        }

        return {
            ok: errors.length === 0 && files.length > 0,
            errors: errors,
            version: version,
            minVersion: catalog.minVersion ? String(catalog.minVersion).trim() : '',
            changelogPath: catalog.changelogPath ? normalizeRelPath(catalog.changelogPath) : '',
            files: files,
            remove: remove
        };
    }

    // ================================================================
    // 工具
    // ================================================================

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
            const st = fs.lstatSync(targetPath);
            if (st.isDirectory()) fs.rmSync(targetPath, { recursive: true, force: true });
            else fs.unlinkSync(targetPath);
        } catch (e) { /* ignore */ }
    }

    function absModsPath(relPath) {
        return pathMod.join(MODS_DIR, ...normalizeRelPath(relPath).split('/'));
    }

    function hashFileSync(filePath) {
        const hash = crypto.createHash('sha256');
        hash.update(fs.readFileSync(filePath));
        return hash.digest('hex');
    }

    const CATALOG_BINARY_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico']);

    /** 与发版 sync catalog 一致：文本按 LF 归一化后算 sha256/size */
    function catalogDigestBuffer(buf, relPath) {
        const rel = normalizeRelPath(relPath || '');
        const ext = pathMod.extname(rel).toLowerCase();
        const normalized = CATALOG_BINARY_EXT.has(ext)
            ? buf
            : Buffer.from(buf.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
        return {
            sha256: crypto.createHash('sha256').update(normalized).digest('hex'),
            size: normalized.length
        };
    }

    function getLocalFileDigest(relPath) {
        const abs = absModsPath(relPath);
        if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return null;
        try {
            return catalogDigestBuffer(fs.readFileSync(abs), relPath);
        } catch (e) {
            return null;
        }
    }

    function computeCatalogFileDiff(catalog) {
        const applied = catalogForApply(catalog);
        const need = [];
        const match = [];
        for (let i = 0; i < applied.files.length; i++) {
            const f = applied.files[i];
            const local = getLocalFileDigest(f.path);
            if (!local || local.sha256 !== f.sha256 || local.size !== f.size) {
                need.push(f.path);
            } else {
                match.push(f.path);
            }
        }
        const removePresent = [];
        const removeMissing = [];
        for (let r = 0; r < applied.remove.length; r++) {
            const rem = applied.remove[r];
            if (fs.existsSync(absModsPath(rem))) removePresent.push(rem);
            else removeMissing.push(rem);
        }
        return {
            need: need,
            match: match,
            remove: applied.remove.slice(),
            removePresent: removePresent,
            removeMissing: removeMissing
        };
    }

    function logCatalogFileDiff(diff) {
        appendLog(t('logDiffSummary', {
            need: diff.need.length,
            match: diff.match.length
        }));
        if (diff.need.length) {
            appendLog(t('logDiffNeedTitle'));
            diff.need.forEach(function (p) { appendLog('  - ' + p); });
        } else {
            appendLog(t('logDiffAllMatch'));
        }
        const present = diff.removePresent || [];
        const missing = diff.removeMissing || [];
        if (present.length) {
            appendLog(t('logDiffRemove', { count: present.length }));
            present.forEach(function (p) { appendLog('  - ' + p); });
        }
        if (missing.length) {
            appendLog(t('logDiffRemoveGone', { count: missing.length }));
            missing.forEach(function (p) { appendLog('  - ' + p); });
        }
    }

    /**
     * 截取 CHANGELOG 中 (localVersion, remoteVersion] 的所有 ## 版本段落（含标题）。
     * 文档通常新→旧排列；同版本或无法解析时回退为仅 remote 一段。
     */
    function extractChangelogRange(changelogText, localVersion, remoteVersion) {
        const text = String(changelogText || '');
        if (!text.trim()) return null;

        const headingRe = /^##\s+(V?\d+(?:\.\d+)*)(?:\s*\([^)]+\))?\s*$/gm;
        const headings = [];
        let m;
        while ((m = headingRe.exec(text)) !== null) {
            headings.push({
                version: m[1],
                start: m.index,
                header: m[0]
            });
        }
        if (!headings.length) return null;

        for (let i = 0; i < headings.length; i++) {
            const end = i + 1 < headings.length ? headings[i + 1].start : text.length;
            headings[i].block = text.slice(headings[i].start, end).trim();
        }

        const local = String(localVersion || '').trim();
        const remote = String(remoteVersion || '').trim();
        let selected = [];

        if (remote) {
            for (let j = 0; j < headings.length; j++) {
                const ver = headings[j].version;
                const cmpRemote = compareVersions(ver, remote);
                // ver <= remote
                if (cmpRemote === 1) continue;
                if (local) {
                    const cmpLocal = compareVersions(local, ver);
                    // 只要 local < ver（不含本地当前版段落）
                    if (cmpLocal !== -1) continue;
                }
                selected.push(headings[j].block);
            }
        }

        // 同版本文件差异 / 区间为空：至少展示远端版本段落
        if (!selected.length && remote) {
            for (let k = 0; k < headings.length; k++) {
                if (compareVersions(headings[k].version, remote) === 0) {
                    selected.push(headings[k].block);
                    break;
                }
            }
        }

        return selected.length ? selected.join('\n\n') : null;
    }

    function buildMirrorOrder(preferredMirror) {
        const order = [];
        if (preferredMirror) order.push(preferredMirror);
        const defaults = mirrorOrder();
        for (let i = 0; i < defaults.length; i++) {
            if (!preferredMirror || defaults[i].id !== preferredMirror.id) {
                order.push(defaults[i]);
            }
        }
        return order;
    }

    function logSha256Mismatch(file, res, actualSha) {
        const lf = catalogDigestBuffer(res.buffer, file.path);
        appendLog(t('logSha256Mismatch', {
            path: file.path,
            mirror: res.mirror.label,
            expectedSha: file.sha256,
            expectedSize: String(file.size),
            actualSha: actualSha,
            actualSize: String(res.buffer.length),
            lfSha: lf.sha256,
            lfSize: String(lf.size)
        }));
        if (res.url) appendLog(t('logSha256Url', { url: res.url }));
        if (lf.sha256 === file.sha256) appendLog(t('logSha256LfHint', { path: file.path }));
    }

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

    /** -1 local<remote · 0 equal · 1 local>remote · null unknown */
    function compareVersions(localRaw, remoteRaw) {
        const a = normalizeVersion(localRaw);
        const b = normalizeVersion(remoteRaw);
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

    function localVersion() {
        return (ML && ML.version) ? String(ML.version) : '';
    }

    function formatTime(d) {
        const pad = function (n) { return n < 10 ? '0' + n : String(n); };
        return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    }

    // ================================================================
    // 配置
    // ================================================================

    function defaultConfig() {
        return {
            updatesDisabled: false,
            excludeAuthorTools: true,
            lastCheckedAt: null,
            lastRemoteVersion: null,
            lastError: null
        };
    }

    let _config = null;

    function loadConfig() {
        const cfg = defaultConfig();
        try {
            if (fs.existsSync(CONFIG_PATH)) {
                const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
                if (raw && typeof raw === 'object') {
                    cfg.updatesDisabled = !!raw.updatesDisabled;
                    cfg.excludeAuthorTools = raw.excludeAuthorTools === undefined
                        ? true
                        : !!raw.excludeAuthorTools;
                    cfg.lastCheckedAt = raw.lastCheckedAt || null;
                    cfg.lastRemoteVersion = raw.lastRemoteVersion || null;
                    cfg.lastError = raw.lastError || null;
                }
            }
        } catch (e) { /* ignore */ }
        _config = cfg;
        return cfg;
    }

    function saveConfig() {
        if (!_config) loadConfig();
        ensureDir(pathMod.dirname(CONFIG_PATH));
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(_config, null, 2) + '\n', 'utf8');
    }

    function getConfig() {
        if (!_config) return loadConfig();
        return _config;
    }

    // ================================================================
    // HTTPS
    // ================================================================

    function parseHttpsUrl(raw) {
        let u;
        try {
            u = new urlMod.URL(String(raw || ''));
        } catch (e) {
            throw new Error(t('errUrlInvalid'));
        }
        if (u.protocol !== 'https:') throw new Error(t('errHttpsOnly'));
        return u;
    }

    function requestBuffer(rawUrl, options) {
        options = options || {};
        const maxBytes = options.maxBytes != null ? options.maxBytes : MAX_BYTES;
        const redirectLeft = options.redirectLeft != null ? options.redirectLeft : 5;
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

            function done(buf) {
                if (settled) return;
                settled = true;
                resolve(buf);
            }

            const req = https.request({
                protocol: u.protocol,
                hostname: u.hostname,
                port: u.port || 443,
                path: u.pathname + u.search,
                method: 'GET',
                headers: {
                    'User-Agent': USER_AGENT,
                    'Accept': '*/*'
                },
                timeout: REQUEST_TIMEOUT_MS
            }, function (res) {
                const code = res.statusCode || 0;
                if (code >= 300 && code < 400 && res.headers.location) {
                    res.resume();
                    if (redirectLeft <= 0) {
                        fail(new Error(t('errRedirectTooMany')));
                        return;
                    }
                    let next = res.headers.location;
                    try {
                        next = new urlMod.URL(next, u).href;
                    } catch (e) {
                        fail(new Error(t('errUrlInvalid')));
                        return;
                    }
                    requestBuffer(next, {
                        maxBytes: maxBytes,
                        redirectLeft: redirectLeft - 1
                    }).then(done, fail);
                    return;
                }
                if (code !== 200) {
                    res.resume();
                    fail(new Error(t('errHttp', { code: code })));
                    return;
                }
                res.on('data', function (chunk) {
                    received += chunk.length;
                    if (received > maxBytes) {
                        res.destroy();
                        fail(new Error(t('errHttp', { code: 'size' })));
                        return;
                    }
                    chunks.push(chunk);
                });
                res.on('end', function () { done(Buffer.concat(chunks)); });
                res.on('error', fail);
            });
            req.on('timeout', function () {
                req.destroy();
                fail(new Error(t('errTimeout')));
            });
            req.on('error', fail);
            req.end();
        });
    }

    function mirrorOrder() {
        const lang = readManagerLanguage();
        if (lang === 'zh_CN' || lang === 'zh_TW') {
            return [MIRRORS.gitee, MIRRORS.github];
        }
        return [MIRRORS.github, MIRRORS.gitee];
    }

    function buildRawUrl(mirror, ref, repoRelPath) {
        return mirror.rawBase(ref) + String(repoRelPath).replace(/^\/+/, '');
    }

    /**
     * 按镜像顺序尝试；网络失败或 hash 未通过时可切换下一镜像。
     * @param {Function|null} logFn appendLog 等
     */
    function fetchBufferWithMirrors(repoRelPath, ref, preferredMirror, logFn) {
        const order = buildMirrorOrder(preferredMirror);
        let lastErr = null;

        function tryAt(idx) {
            if (idx >= order.length) {
                return Promise.reject(lastErr || new Error(t('errHttp', { code: '?' })));
            }
            const m = order[idx];
            const url = buildRawUrl(m, ref, repoRelPath);
            return requestBuffer(url).then(function (buf) {
                if (logFn && idx > 0) {
                    logFn(t('logMirrorFallbackOk', { mirror: m.label, path: repoRelPath }));
                }
                return { buffer: buf, mirror: m, url: url };
            }, function (err) {
                lastErr = err;
                if (logFn && idx + 1 < order.length) {
                    logFn(t('logMirrorTryFail', {
                        mirror: m.label,
                        error: err && err.message ? err.message : String(err),
                        next: order[idx + 1].label
                    }));
                }
                return tryAt(idx + 1);
            });
        }
        return tryAt(0);
    }

    /** 下载并校验 sha256；hash 失败时尝试下一镜像（与网络失败同样切换）。 */
    function fetchCatalogFileWithMirrors(repoRelPath, ref, preferredMirror, file, logFn) {
        const order = buildMirrorOrder(preferredMirror);
        let lastShaErr = null;

        function tryAt(idx) {
            if (idx >= order.length) {
                return Promise.reject(lastShaErr || new Error(t('errSha256', { path: file.path })));
            }
            const m = order[idx];
            const url = buildRawUrl(m, ref, repoRelPath);
            return requestBuffer(url).then(function (buf) {
                const sha = crypto.createHash('sha256').update(buf).digest('hex');
                if (sha !== file.sha256) {
                    const res = { buffer: buf, mirror: m, url: url };
                    if (logFn) logSha256Mismatch(file, res, sha);
                    if (idx + 1 < order.length && logFn) {
                        logFn(t('logMirrorShaRetry', {
                            mirror: m.label,
                            next: order[idx + 1].label
                        }));
                    }
                    if (idx + 1 < order.length) return tryAt(idx + 1);
                    lastShaErr = new Error(t('errSha256', { path: file.path }));
                    throw lastShaErr;
                }
                if (logFn && idx > 0) {
                    logFn(t('logMirrorFallbackOk', { mirror: m.label, path: repoRelPath }));
                }
                return { buffer: buf, mirror: m, url: url };
            }, function (err) {
                if (logFn && idx + 1 < order.length) {
                    logFn(t('logMirrorTryFail', {
                        mirror: m.label,
                        error: err && err.message ? err.message : String(err),
                        next: order[idx + 1].label
                    }));
                }
                if (idx + 1 < order.length) return tryAt(idx + 1);
                throw err;
            });
        }
        return tryAt(0);
    }

    function fetchJsonWithMirrors(repoRelPath, ref, preferredMirror, logFn) {
        return fetchBufferWithMirrors(repoRelPath, ref, preferredMirror, logFn).then(function (res) {
            let data;
            try {
                data = JSON.parse(res.buffer.toString('utf8'));
            } catch (e) {
                throw new Error(repoRelPath.indexOf('channel') >= 0 ? t('errChannelInvalid') : t('errCatalogInvalid'));
            }
            return { data: data, mirror: res.mirror };
        });
    }

    // ================================================================
    // 状态 / 日志
    // ================================================================

    let _panelRoot = null;
    let _busy = false;
    let _logLines = [];
    let _remoteMeta = {
        version: null,
        tag: null,
        hasUpdate: false,
        checkError: null,
        catalog: null,
        mirror: null,
        fileDiff: null
    };

    function appendLog(msg) {
        const line = formatTime(new Date()) + '  ' + msg;
        _logLines.push(line);
        if (_logLines.length > 2000) _logLines = _logLines.slice(-1500);
        refreshLogView();
    }

    function clearLog() {
        _logLines = [];
        refreshLogView();
    }

    function refreshLogView() {
        if (!_panelRoot) return;
        const pre = _panelRoot.querySelector('.ml-updater-log');
        if (!pre) return;
        pre.textContent = _logLines.length ? _logLines.join('\n') : t('logEmpty');
        pre.scrollTop = pre.scrollHeight;
    }

    function setBusy(v) {
        _busy = !!v;
        refreshChrome();
    }

    /** Mod 商店作者侧工具（打包 GUI / catalog 发布）；不含 tools/ 下其它目录 */
    function isModStorePublishToolPath(relPath) {
        const p = normalizeRelPath(relPath);
        return p.indexOf('tools/modstore/') === 0;
    }

    /** 玩家勾选剔除 Mod 商店作者工具时，过滤 catalog 应用范围（仅跳过下载，不删本地文件） */
    function catalogForApply(catalog) {
        if (!catalog) return { files: [], remove: [] };
        const cfg = getConfig();
        if (!cfg.excludeAuthorTools) {
            return { files: catalog.files.slice(), remove: (catalog.remove || []).slice() };
        }
        const files = [];
        for (let i = 0; i < catalog.files.length; i++) {
            const f = catalog.files[i];
            if (!isModStorePublishToolPath(f.path)) files.push(f);
        }
        const remove = [];
        const remList = catalog.remove || [];
        for (let j = 0; j < remList.length; j++) {
            const p = remList[j];
            if (!isModStorePublishToolPath(p)) remove.push(p);
        }
        return { files: files, remove: remove };
    }

    function notifyBadges() {
        try {
            if (typeof ML.refreshConflictLog === 'function') ML.refreshConflictLog();
        } catch (e) { /* ignore */ }
    }

    function hasUpdateAvailable() {
        const cfg = getConfig();
        if (cfg.updatesDisabled) return false;
        return !!_remoteMeta.hasUpdate;
    }

    // ================================================================
    // 核心管线
    // ================================================================

    function parseChannel(data) {
        if (!data || typeof data !== 'object') throw new Error(t('errChannelInvalid'));
        const tag = String(data.tag || '').trim();
        if (!tag || tag.indexOf('..') !== -1 || /[\\/]/.test(tag)) {
            throw new Error(t('errChannelInvalid'));
        }
        return tag;
    }

    function applyRemoteMetaFromCatalog(validated, tag, mirror) {
        const local = localVersion();
        const cmp = compareVersions(local, validated.version);
        const diff = computeCatalogFileDiff(validated);
        const versionBehind = cmp === -1;
        const filesDiffer = diff.need.length > 0;
        _remoteMeta = {
            version: validated.version,
            tag: tag,
            hasUpdate: versionBehind || (cmp === 0 && filesDiffer),
            checkError: null,
            catalog: validated,
            mirror: mirror,
            fileDiff: diff
        };
        const cfg = getConfig();
        cfg.lastCheckedAt = new Date().toISOString();
        cfg.lastRemoteVersion = validated.version;
        cfg.lastError = null;
        saveConfig();
        notifyBadges();
    }

    /**
     * 拉取 channel + catalog 并更新 _remoteMeta（不管理 busy）。
     * @param {{ log?: boolean }} options
     */
    function fetchRemoteCatalog(options) {
        options = options || {};
        const doLog = !!options.log;
        const logFn = doLog ? appendLog : null;
        return fetchJsonWithMirrors('manager/channel.json', 'main', null, logFn)
            .then(function (ch) {
                const tag = parseChannel(ch.data);
                if (doLog) {
                    appendLog(t('logMirror', { name: ch.mirror.label }));
                    appendLog(t('logChannel', { tag: tag }));
                }
                return fetchJsonWithMirrors('manager/catalog.json', tag, ch.mirror, logFn)
                    .then(function (catRes) {
                        return { tag: tag, channelMirror: ch.mirror, catalogRes: catRes };
                    }, function (err) {
                        const msg = t('logTagMissing', { tag: tag });
                        throw new Error(msg + ' (' + (err && err.message ? err.message : err) + ')');
                    });
            })
            .then(function (pack) {
                const validated = validateCatalog(pack.catalogRes.data);
                if (!validated.ok) {
                    throw new Error(t('logRejected', { detail: validated.errors.join('; ') }));
                }
                applyRemoteMetaFromCatalog(validated, pack.tag, pack.catalogRes.mirror || pack.channelMirror);
                if (doLog) {
                    appendLog(t('logCatalog', {
                        remote: validated.version,
                        local: localVersion() || '?'
                    }));
                    if (validated.minVersion) {
                        const cmpMin = compareVersions(localVersion(), validated.minVersion);
                        if (cmpMin === -1) {
                            appendLog(t('logMinVersion', { min: validated.minVersion }));
                        }
                    }
                    logCatalogFileDiff(_remoteMeta.fileDiff || diff);
                    if (!_remoteMeta.hasUpdate) {
                        appendLog(t('logAlreadyLatest'));
                    }
                }
                refreshChrome();
                return {
                    hasUpdate: _remoteMeta.hasUpdate,
                    version: validated.version,
                    catalog: validated,
                    mirror: _remoteMeta.mirror,
                    tag: pack.tag
                };
            })
            .catch(function (err) {
                const msg = err && err.message ? err.message : String(err);
                _remoteMeta.checkError = msg;
                _remoteMeta.hasUpdate = false;
                const cfg2 = getConfig();
                cfg2.lastError = msg;
                cfg2.lastCheckedAt = new Date().toISOString();
                saveConfig();
                if (doLog) appendLog(t('logFail', { error: msg }));
                notifyBadges();
                refreshChrome();
                throw err;
            });
    }

    function checkForUpdates(options) {
        options = options || {};
        const silent = !!options.silent;
        const cfg = getConfig();
        if (cfg.updatesDisabled) {
            if (!silent) {
                clearLog();
                appendLog(t('logDisabled'));
            }
            _remoteMeta.hasUpdate = false;
            notifyBadges();
            refreshChrome();
            return Promise.resolve({ hasUpdate: false, disabled: true });
        }
        if (_busy) {
            if (!silent) appendLog(t('errBusy'));
            return Promise.reject(new Error(t('errBusy')));
        }
        if (!silent) {
            setBusy(true);
            clearLog();
        }
        return fetchRemoteCatalog({ log: !silent })
            .then(function (result) {
                if (!silent) setBusy(false);
                return result;
            }, function (err) {
                if (!silent) setBusy(false);
                throw err;
            });
    }

    function atomicWriteFile(destAbs, srcAbs) {
        ensureDir(pathMod.dirname(destAbs));
        const tmp = destAbs + '.ml-upd-tmp';
        fs.copyFileSync(srcAbs, tmp);
        try {
            if (fs.existsSync(destAbs)) fs.unlinkSync(destAbs);
        } catch (e) { /* ignore */ }
        fs.renameSync(tmp, destAbs);
    }

    function runUpdate() {
        const cfg = getConfig();
        if (cfg.updatesDisabled) {
            appendLog(t('logDisabled'));
            return Promise.resolve();
        }
        if (_busy) {
            appendLog(t('errBusy'));
            return Promise.reject(new Error(t('errBusy')));
        }
        setBusy(true);
        clearLog();

        const sessionId = 's' + Date.now();
        const sessionDir = pathMod.join(TMP_ROOT, sessionId);
        const downloadDir = pathMod.join(sessionDir, 'download');
        const backupDir = pathMod.join(sessionDir, 'backup');
        const backedUp = [];

        function cleanupSession(keepOnFail) {
            if (keepOnFail) return;
            try { removePathSafe(sessionDir); } catch (e) { /* ignore */ }
        }

        function rollback() {
            appendLog(t('logRollback'));
            for (let i = 0; i < backedUp.length; i++) {
                const rel = backedUp[i];
                const bak = pathMod.join(backupDir, ...rel.split('/'));
                const dest = absModsPath(rel);
                try {
                    if (fs.existsSync(bak)) {
                        atomicWriteFile(dest, bak);
                    }
                } catch (e) {
                    appendLog(t('logFail', { error: rel + ': ' + (e.message || e) }));
                }
            }
        }

        return fetchRemoteCatalog({ log: true })
            .then(function (check) {
                if (!check.hasUpdate) {
                    cleanupSession(false);
                    return null;
                }
                const applied = catalogForApply(check.catalog);
                const catalog = {
                    files: applied.files,
                    remove: applied.remove,
                    version: check.catalog.version
                };
                const tag = check.tag;
                let mirror = check.mirror;
                const toReplace = [];

                ensureDir(downloadDir);

                // 串行下载需替换文件
                let chain = Promise.resolve();
                catalog.files.forEach(function (file) {
                    chain = chain.then(function () {
                        const local = getLocalFileDigest(file.path);
                        if (local && local.sha256 === file.sha256) {
                            appendLog(t('logSkip', { path: file.path }));
                            return;
                        }
                        appendLog(t('logDownload', { path: file.path }));
                        const destTmp = pathMod.join(downloadDir, ...file.path.split('/'));
                        const repoRel = 'js/mods/' + file.path;
                        return fetchCatalogFileWithMirrors(repoRel, tag, mirror, file, appendLog).then(function (res) {
                            ensureDir(pathMod.dirname(destTmp));
                            fs.writeFileSync(destTmp, res.buffer);
                            if (res.mirror && res.mirror.id !== mirror.id) {
                                mirror = res.mirror;
                            }
                            toReplace.push({ path: file.path, tmp: destTmp });
                            appendLog(t('logDownloadOk', { path: file.path }));
                        });
                    });
                });

                return chain.then(function () {
                    if (!toReplace.length && !catalog.remove.length) {
                        appendLog(t('logAlreadyLatest'));
                        cleanupSession(false);
                        return null;
                    }

                    // 提交：先备份再写入
                    appendLog(t('logBackup'));
                    ensureDir(backupDir);
                    for (let i = 0; i < toReplace.length; i++) {
                        const rel = toReplace[i].path;
                        const localAbs = absModsPath(rel);
                        if (fs.existsSync(localAbs) && fs.statSync(localAbs).isFile()) {
                            const bakAbs = pathMod.join(backupDir, ...rel.split('/'));
                            ensureDir(pathMod.dirname(bakAbs));
                            fs.copyFileSync(localAbs, bakAbs);
                            backedUp.push(rel);
                        }
                    }

                    appendLog(t('logCommit'));
                    for (let j = 0; j < toReplace.length; j++) {
                        atomicWriteFile(absModsPath(toReplace[j].path), toReplace[j].tmp);
                    }

                    // 成功后 remove
                    for (let k = 0; k < catalog.remove.length; k++) {
                        const rem = catalog.remove[k];
                        const remAbs = absModsPath(rem);
                        if (!fs.existsSync(remAbs)) {
                            appendLog(t('logRemoveSkip', { path: rem }));
                            continue;
                        }
                        appendLog(t('logRemove', { path: rem }));
                        removePathSafe(remAbs);
                    }

                    _remoteMeta.hasUpdate = false;
                    notifyBadges();
                    appendLog(t('logDone'));
                    cleanupSession(false);
                    return true;
                });
            })
            .then(function () {
                setBusy(false);
                refreshChrome();
            })
            .catch(function (err) {
                const msg = err && err.message ? err.message : String(err);
                appendLog(t('logFail', { error: msg }));
                if (backedUp.length) rollback();
                appendLog(t('logFailSummary'));
                cleanupSession(true);
                setBusy(false);
                refreshChrome();
            });
    }

    // ================================================================
    // UI
    // ================================================================

    function ensureStyles() {
        if (document.getElementById('ml-updater-styles')) return;
        const style = document.createElement('style');
        style.id = 'ml-updater-styles';
        style.textContent = [
            '.ml-updater{display:flex;flex-direction:column;height:100%;min-height:0;padding:0 0 8px;box-sizing:border-box;font-size:13px;color:var(--ml-text-primary,#e8e8ec);}',
            '.ml-updater-meta{display:flex;gap:12px;flex-wrap:wrap;align-items:center;padding:4px 16px 8px;color:var(--ml-text-secondary,#9a9ab0);font-size:12px;}',
            '.ml-updater-meta .ml-changelog-link{font-size:12px;}',
            '.ml-updater-meta strong{color:var(--ml-text-primary,#e8e8ec);font-weight:600;}',
            '.ml-updater-toolbar{display:flex;gap:8px;align-items:center;padding:0 16px 8px;flex-wrap:wrap;flex-shrink:0;}',
            '.ml-updater-toolbar .ml-btn{font-size:12px;padding:6px 12px;}',
            '.ml-updater-toolbar .ml-btn:disabled{opacity:.5;cursor:not-allowed;}',
            '.ml-updater-disable{padding:0 16px 10px;display:flex;flex-direction:column;align-items:flex-start;gap:8px;font-size:12px;color:var(--ml-text-secondary,#9a9ab0);flex-shrink:0;}',
            '.ml-updater-disable label{display:flex;align-items:center;gap:8px;cursor:pointer;}',
            '.ml-updater-disable input{margin:0;}',
            '.ml-updater-log-title{padding:0 16px 6px;font-size:12px;color:var(--ml-text-muted,#666680);flex-shrink:0;}',
            '.ml-updater-log{flex:1;min-height:0;margin:0 12px;padding:10px 12px;overflow:auto;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;line-height:1.55;white-space:pre-wrap;word-break:break-word;border:1px solid var(--ml-border,rgba(255,255,255,.08));border-radius:8px;background:var(--ml-bg-secondary,rgba(28,28,48,.95));color:var(--ml-text-secondary,#9a9ab0);}'
        ].join('\n');
        document.head.appendChild(style);
    }

    function remoteStatusText() {
        if (getConfig().updatesDisabled) return t('logDisabled');
        if (_remoteMeta.checkError) return t('remoteCheckFailed');
        if (_remoteMeta.version) {
            if (_remoteMeta.hasUpdate) return t('remoteVersion', { v: _remoteMeta.version });
            return t('remoteLatest') + ' (' + _remoteMeta.version + ')';
        }
        return t('remoteUnknown');
    }

    function refreshChrome() {
        if (!_panelRoot) return;
        const localEl = _panelRoot.querySelector('.ml-updater-local');
        const remoteEl = _panelRoot.querySelector('.ml-updater-remote');
        if (localEl) localEl.innerHTML = '<strong>' + escHtml(t('localVersion', { v: localVersion() || '?' })) + '</strong>';
        if (remoteEl) remoteEl.textContent = remoteStatusText();

        const disabled = getConfig().updatesDisabled;
        const checkBtn = _panelRoot.querySelector('.ml-updater-check');
        const updateBtn = _panelRoot.querySelector('.ml-updater-update');
        const copyBtn = _panelRoot.querySelector('.ml-updater-copy');
        if (checkBtn) {
            checkBtn.disabled = _busy || disabled;
            checkBtn.textContent = _busy ? t('btnChecking') : t('btnCheck');
            checkBtn.style.display = disabled ? 'none' : '';
        }
        if (updateBtn) {
            const showUpdate = !disabled && hasUpdateAvailable();
            updateBtn.style.display = showUpdate ? '' : 'none';
            updateBtn.disabled = _busy || !showUpdate;
            updateBtn.textContent = _busy ? t('btnUpdating') : t('btnUpdate');
        }
        if (copyBtn) copyBtn.disabled = false;

        const changelogLink = _panelRoot.querySelector('.ml-updater-changelog');
        if (changelogLink) {
            changelogLink.style.display = (!disabled && hasUpdateAvailable()) ? '' : 'none';
        }

        const cb = _panelRoot.querySelector('.ml-updater-disable-input');
        if (cb) cb.checked = disabled;
        const toolsCb = _panelRoot.querySelector('.ml-updater-exclude-tools-input');
        if (toolsCb) toolsCb.checked = !!getConfig().excludeAuthorTools;
    }

    function showRemoteChangelog() {
        if (!hasUpdateAvailable() || !_remoteMeta.catalog || !_remoteMeta.tag) return;
        const catalog = _remoteMeta.catalog;
        const changelogRel = catalog.changelogPath || 'docs/modloader_CHANGELOG.md';
        const repoRel = 'js/mods/' + changelogRel;
        if (_busy) return;
        setBusy(true);
        fetchBufferWithMirrors(repoRel, _remoteMeta.tag, _remoteMeta.mirror, appendLog)
            .then(function (res) {
                const md = res.buffer.toString('utf8');
                const local = localVersion() || '';
                const remote = catalog.version || '';
                const section = extractChangelogRange(md, local, remote);
                const body = section || md;
                let title;
                if (local && remote && compareVersions(local, remote) === -1) {
                    title = 'ModLoader ' + local + ' → ' + remote + ' ' + t('btnChangelog');
                } else {
                    title = 'ModLoader ' + (remote || '?') + ' ' + t('btnChangelog');
                }
                if (typeof ML.showChangelogModal === 'function') {
                    ML.showChangelogModal(title, body);
                }
            })
            .catch(function (err) {
                appendLog(t('logFail', { error: err && err.message ? err.message : String(err) }));
            })
            .then(function () {
                setBusy(false);
            });
    }

    function copyLog() {
        const text = _logLines.length ? _logLines.join('\n') : t('logEmpty');
        function fallback() {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            let ok = false;
            try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
            document.body.removeChild(ta);
            return ok;
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function () {
                appendLog(t('copyOk'));
            }, function () {
                appendLog(fallback() ? t('copyOk') : t('copyFail'));
            });
        } else {
            appendLog(fallback() ? t('copyOk') : t('copyFail'));
        }
    }

    function renderPanel(container) {
        ensureStyles();
        _panelRoot = container;
        container.classList.add('ml-store-panel-root');
        container.classList.add('ml-updater-panel-root');

        container.innerHTML =
            '<div class="ml-updater">' +
            '<div class="ml-updater-meta">' +
            '<span class="ml-updater-local"></span>' +
            '<span class="ml-updater-remote"></span>' +
            '<a class="ml-changelog-link ml-updater-changelog" style="display:none" role="button" tabindex="0">' +
            escHtml(t('btnChangelog')) + '</a>' +
            '</div>' +
            '<div class="ml-updater-toolbar">' +
            '<button type="button" class="ml-btn ml-btn-primary ml-updater-check">' + escHtml(t('btnCheck')) + '</button>' +
            '<button type="button" class="ml-btn ml-btn-primary ml-updater-update" style="display:none">' + escHtml(t('btnUpdate')) + '</button>' +
            '<button type="button" class="ml-btn ml-btn-secondary ml-updater-copy">' + escHtml(t('btnCopyLog')) + '</button>' +
            '</div>' +
            '<div class="ml-updater-disable">' +
            '<label><input type="checkbox" class="ml-updater-disable-input" />' +
            '<span>' + escHtml(t('disableUpdates')) + '</span></label>' +
            '<label><input type="checkbox" class="ml-updater-exclude-tools-input" />' +
            '<span>' + escHtml(t('excludeAuthorTools')) + '</span></label>' +
            '</div>' +
            '<div class="ml-updater-log-title">' + escHtml(t('logTitle')) + '</div>' +
            '<pre class="ml-updater-log ml-list-scroll"></pre>' +
            '</div>';

        refreshLogView();
        refreshChrome();

        const checkBtn = container.querySelector('.ml-updater-check');
        if (checkBtn) {
            checkBtn.addEventListener('click', function () {
                checkForUpdates({ silent: false }).catch(function () { /* logged */ });
            });
        }
        const updateBtn = container.querySelector('.ml-updater-update');
        if (updateBtn) {
            updateBtn.addEventListener('click', function () {
                runUpdate().catch(function () { /* logged */ });
            });
        }
        const copyBtn = container.querySelector('.ml-updater-copy');
        if (copyBtn) {
            copyBtn.addEventListener('click', function () { copyLog(); });
        }
        const changelogLink = container.querySelector('.ml-updater-changelog');
        if (changelogLink) {
            changelogLink.addEventListener('click', function (e) {
                e.preventDefault();
                showRemoteChangelog();
            });
        }
        const cb = container.querySelector('.ml-updater-disable-input');
        if (cb) {
            cb.addEventListener('change', function () {
                const cfg = getConfig();
                cfg.updatesDisabled = !!cb.checked;
                saveConfig();
                if (cfg.updatesDisabled) {
                    _remoteMeta.hasUpdate = false;
                    _remoteMeta.checkError = null;
                    clearLog();
                    appendLog(t('logDisabled'));
                }
                notifyBadges();
                refreshChrome();
            });
        }
        const toolsCb = container.querySelector('.ml-updater-exclude-tools-input');
        if (toolsCb) {
            toolsCb.addEventListener('change', function () {
                const cfg = getConfig();
                cfg.excludeAuthorTools = !!toolsCb.checked;
                saveConfig();
                refreshChrome();
            });
        }
    }

    // ================================================================
    // 注册
    // ================================================================

    function registerUpdaterEntry() {
        ML.registerLogEntry({
            id: 'modLoaderUpdater',
            label: t('entryLabel'),
            getUpdateCount: function () {
                try {
                    return hasUpdateAvailable() ? 1 : 0;
                } catch (e) {
                    return 0;
                }
            },
            render: function (container) {
                renderPanel(container);
            }
        });
    }

    function register() {
        loadConfig();
        registerUpdaterEntry();
        console.info('[modLoaderUpdater] manager updater entry registered');
        if (!getConfig().updatesDisabled) {
            checkForUpdates({ silent: true }).catch(function () {
                /* 后台预检失败 → 角标当无更新 */
            });
        }
    }

    register();
})();
