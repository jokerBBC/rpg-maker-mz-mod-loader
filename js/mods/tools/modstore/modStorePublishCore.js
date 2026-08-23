/**
 * Mod 商店发布核心（CLI / GUI 共用）
 */
'use strict';

var fs = require('fs');
var path = require('path');
var zlib = require('zlib');
var crypto = require('crypto');

function isSafePackageName(name) {
    if (!name || typeof name !== 'string') return false;
    if (name !== name.trim()) return false;
    if (!name.length || name.length > 120) return false;
    if (/[\\/]/.test(name) || name.indexOf('..') !== -1) return false;
    if (name === '.' || name === '..') return false;
    return true;
}

function readManifest(packageRoot) {
    var p = path.join(packageRoot, 'modloader.json');
    if (!fs.existsSync(p)) return null;
    try {
        return JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch (e) {
        throw new Error('modloader.json 解析失败: ' + (e.message || e));
    }
}

function readVersionFromScripts(packageRoot) {
    var files = fs.readdirSync(packageRoot).filter(function (f) {
        return f.endsWith('.js') && f !== 'ModLoader.js';
    });
    for (var i = 0; i < files.length; i++) {
        var content = fs.readFileSync(path.join(packageRoot, files[i]), 'utf-8');
        var block = content.match(/\/\*:[\s\S]*?\*\//);
        if (!block) continue;
        var vm = block[0].match(/@version\s+(.+?)$/m);
        if (vm && vm[1].trim()) return vm[1].trim();
    }
    return null;
}

function collectFiles(dir, baseDir, out) {
    var entries = fs.readdirSync(dir, { withFileTypes: true });
    for (var i = 0; i < entries.length; i++) {
        var ent = entries[i];
        var abs = path.join(dir, ent.name);
        if (ent.name === '.git' || ent.name === 'node_modules' || ent.name === '.DS_Store') continue;
        if (ent.isDirectory()) {
            collectFiles(abs, baseDir, out);
        } else if (ent.isFile()) {
            var rel = path.relative(baseDir, abs).split(path.sep).join('/');
            out.push({ rel: rel, abs: abs, data: fs.readFileSync(abs) });
        }
    }
}

function validatePackage(packageRoot) {
    var hasJs = false;
    var hasManifest = fs.existsSync(path.join(packageRoot, 'modloader.json'));
    (function walk(d) {
        var list = fs.readdirSync(d, { withFileTypes: true });
        for (var i = 0; i < list.length; i++) {
            if (list[i].isDirectory()) {
                if (list[i].name === '.git' || list[i].name === 'node_modules') continue;
                walk(path.join(d, list[i].name));
            } else if (/\.js$/i.test(list[i].name) && list[i].name !== 'ModLoader.js') {
                hasJs = true;
            }
        }
    })(packageRoot);
    if (!hasJs && !hasManifest) {
        throw new Error('包内需至少有一个 .js 或合法 modloader.json');
    }
    if (hasManifest) readManifest(packageRoot);
}

function resolvePackageEntryFileName(entry) {
    var raw = String(entry).trim();
    if (!raw) return null;
    if (/[\\/]/.test(raw) || raw.indexOf('..') !== -1) return null;
    var fileName = path.basename(raw);
    if (!/\.js$/i.test(fileName) || fileName === 'ModLoader.js') return null;
    return fileName;
}

/**
 * 发现包内脚本（与 ModLoader discoverPackageScripts 一致：entries 优先，否则根目录全部 .js）
 */
function discoverPackageScripts(packageRoot) {
    var scripts = [];
    var manifest = readManifest(packageRoot);
    if (manifest && Array.isArray(manifest.entries) && manifest.entries.length > 0) {
        for (var i = 0; i < manifest.entries.length; i++) {
            var fileName = resolvePackageEntryFileName(manifest.entries[i]);
            if (!fileName) continue;
            var absPath = path.join(packageRoot, fileName);
            if (fs.existsSync(absPath)) scripts.push(fileName);
        }
        return scripts;
    }
    return listRootJsFiles(packageRoot);
}

function resolvePackageMeta(packageName, packageRoot, opts) {
    opts = opts || {};
    var manifest = readManifest(packageRoot);
    var scripts = discoverPackageScripts(packageRoot);
    var isMultiScript = scripts.length > 1;
    var version;
    if (isMultiScript) {
        if (!manifest || manifest.version == null || !String(manifest.version).trim()) {
            throw new Error('多脚本包须在 modloader.json 填写 version（包版本号）');
        }
        version = opts.version || String(manifest.version).trim();
    } else {
        version = opts.version
            || (manifest && manifest.version)
            || readVersionFromScripts(packageRoot);
        if (!version) {
            throw new Error('无法确定版本：请在 modloader.json 或插件头 @version 中填写');
        }
    }
    var summary = opts.summary
        || (manifest && (manifest.summary || manifest.description))
        || '';
    return {
        version: String(version).trim(),
        title: packageName,
        summary: String(summary).trim(),
        manifest: manifest
    };
}

function listRootJsFiles(packageRoot) {
    return fs.readdirSync(packageRoot).filter(function (f) {
        if (!/\.js$/i.test(f) || f === 'ModLoader.js') return false;
        try {
            return fs.statSync(path.join(packageRoot, f)).isFile();
        } catch (e) {
            return false;
        }
    });
}

/**
 * 主插件 js 文件名（不含扩展名），优先 包名.js，否则取根目录首个 .js
 */
function getMainJsBaseName(packageRoot, packageName) {
    var files = listRootJsFiles(packageRoot);
    if (!files.length) {
        throw new Error('包根目录缺少 .js 文件');
    }
    var preferred = packageName + '.js';
    for (var i = 0; i < files.length; i++) {
        if (files[i] === preferred) {
            return packageName;
        }
    }
    for (var j = 0; j < files.length; j++) {
        var base = files[j].replace(/\.js$/i, '');
        if (base === packageName) return base;
    }
    files.sort(function (a, b) { return a.localeCompare(b, 'zh-CN'); });
    return files[0].replace(/\.js$/i, '');
}

function safeFileBaseName(name) {
    var s = String(name || '').trim();
    s = s.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
    s = s.replace(/[\s.]+$/g, '');
    if (!s) throw new Error('主插件文件名无效');
    return s;
}

function resolveArtifactBase(packageRoot, packageName) {
    return safeFileBaseName(getMainJsBaseName(packageRoot, packageName));
}

/**
 * catalog 条目 id：默认与包目录名一致；仅 modloader.json storeId 可覆盖
 */
function resolveModId(packageName, packageRoot) {
    try {
        var manifest = readManifest(packageRoot);
        if (manifest && manifest.storeId && String(manifest.storeId).trim()) {
            return String(manifest.storeId).trim();
        }
    } catch (e) { /* ignore */ }
    return packageName;
}

function buildZipName(packageRoot, packageName, version, opts) {
    opts = opts || {};
    var base = opts.zipBaseName
        ? safeFileBaseName(opts.zipBaseName)
        : safeFileBaseName(packageName);
    return base + '-' + versionForFileName(version) + '.zip';
}

/** 删除同包旧版本 zip（保留 keepZipName） */
function removeStalePackageZips(outDir, packageName, keepZipName) {
    var prefix = safeFileBaseName(packageName) + '-';
    var removed = [];
    var files;
    try { files = fs.readdirSync(outDir); } catch (e) { return removed; }
    for (var i = 0; i < files.length; i++) {
        var f = files[i];
        if (!/\.zip$/i.test(f) || f === keepZipName) continue;
        if (f.indexOf(prefix) !== 0) continue;
        fs.unlinkSync(path.join(outDir, f));
        removed.push(f);
    }
    return removed;
}

function zipNameFromDownloadUrl(url) {
    if (!url) return '';
    var s = String(url).split('?')[0].split('#')[0];
    var parts = s.split('/');
    try { return decodeURIComponent(parts[parts.length - 1] || ''); } catch (e) {
        return parts[parts.length - 1] || '';
    }
}

/** 按 catalog 清理 packages 中未被引用的 zip */
function pruneOrphanPackageZips(pkgDir, catalog) {
    if (!pkgDir || !catalog || !fs.existsSync(pkgDir)) return [];
    var expected = {};
    var mods = catalog.mods || [];
    for (var i = 0; i < mods.length; i++) {
        var name = zipNameFromDownloadUrl(mods[i].downloadUrl);
        if (name) expected[name] = true;
    }
    var removed = [];
    var files = fs.readdirSync(pkgDir);
    for (var j = 0; j < files.length; j++) {
        var f = files[j];
        if (!/\.zip$/i.test(f) || expected[f]) continue;
        fs.unlinkSync(path.join(pkgDir, f));
        removed.push(f);
    }
    return removed;
}

function versionForFileName(version) {
    return String(version).trim().replace(/^[vV]/, '').replace(/[^\w.\-]+/g, '_');
}

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

function crc32(buf) {
    var c = ~0;
    for (var i = 0; i < buf.length; i++) {
        c ^= buf[i];
        for (var k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return (~c) >>> 0;
}

function writeUInt16LE(buf, value, offset) {
    buf.writeUInt16LE(value >>> 0, offset);
}
function writeUInt32LE(buf, value, offset) {
    buf.writeUInt32LE(value >>> 0, offset);
}

function buildStandardZip(packageName, files) {
    var localChunks = [];
    var centralChunks = [];
    var offset = 0;
    var entries = [];
    entries.push({ name: packageName + '/', data: Buffer.alloc(0), isDir: true });
    for (var i = 0; i < files.length; i++) {
        entries.push({
            name: packageName + '/' + files[i].rel,
            data: files[i].data,
            isDir: false
        });
    }
    for (var e = 0; e < entries.length; e++) {
        var ent = entries[e];
        var nameBuf = Buffer.from(ent.name, 'utf8');
        var data = ent.data || Buffer.alloc(0);
        var method = 0;
        var comp = data;
        if (!ent.isDir && data.length > 0) {
            try {
                var deflated = zlib.deflateRawSync(data);
                if (deflated.length < data.length) {
                    comp = deflated;
                    method = 8;
                }
            } catch (err) {
                comp = data;
                method = 0;
            }
        }
        var crc = ent.isDir ? 0 : crc32(data);
        var gpFlag = 0x800;
        var localHeader = Buffer.alloc(30);
        writeUInt32LE(localHeader, 0x04034b50, 0);
        writeUInt16LE(localHeader, 20, 4);
        writeUInt16LE(localHeader, gpFlag, 6);
        writeUInt16LE(localHeader, method, 8);
        writeUInt16LE(localHeader, 0, 10);
        writeUInt16LE(localHeader, 0x21, 12);
        writeUInt32LE(localHeader, crc, 14);
        writeUInt32LE(localHeader, comp.length, 18);
        writeUInt32LE(localHeader, data.length, 22);
        writeUInt16LE(localHeader, nameBuf.length, 26);
        writeUInt16LE(localHeader, 0, 28);
        localChunks.push(localHeader, nameBuf);
        if (!ent.isDir) localChunks.push(comp);
        var central = Buffer.alloc(46);
        writeUInt32LE(central, 0x02014b50, 0);
        writeUInt16LE(central, 20, 4);
        writeUInt16LE(central, 20, 6);
        writeUInt16LE(central, gpFlag, 8);
        writeUInt16LE(central, method, 10);
        writeUInt16LE(central, 0, 12);
        writeUInt16LE(central, 0x21, 14);
        writeUInt32LE(central, crc, 16);
        writeUInt32LE(central, comp.length, 20);
        writeUInt32LE(central, data.length, 24);
        writeUInt16LE(central, nameBuf.length, 28);
        writeUInt16LE(central, 0, 30);
        writeUInt16LE(central, 0, 32);
        writeUInt16LE(central, 0, 34);
        writeUInt16LE(central, 0, 36);
        writeUInt32LE(central, ent.isDir ? 0x10 : 0, 38);
        writeUInt32LE(central, offset, 42);
        centralChunks.push(central, nameBuf);
        offset += localHeader.length + nameBuf.length + (ent.isDir ? 0 : comp.length);
    }
    var localBuffer = Buffer.concat(localChunks);
    var centralBuffer = Buffer.concat(centralChunks);
    var eocd = Buffer.alloc(22);
    writeUInt32LE(eocd, 0x06054b50, 0);
    writeUInt16LE(eocd, 0, 4);
    writeUInt16LE(eocd, 0, 6);
    writeUInt16LE(eocd, entries.length, 8);
    writeUInt16LE(eocd, entries.length, 10);
    writeUInt32LE(eocd, centralBuffer.length, 12);
    writeUInt32LE(eocd, localBuffer.length, 16);
    writeUInt16LE(eocd, 0, 20);
    return Buffer.concat([localBuffer, centralBuffer, eocd]);
}

function sha256Hex(buf) {
    return crypto.createHash('sha256').update(buf).digest('hex');
}

function todayStr() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
}

function loadCatalog(catalogPath) {
    if (!catalogPath || !fs.existsSync(catalogPath)) return null;
    try {
        var raw = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
        if (!raw || typeof raw !== 'object') return null;
        if (!Array.isArray(raw.mods)) raw.mods = [];
        return raw;
    } catch (e) {
        return null;
    }
}

function loadOrCreateCatalog(catalogPath, opts) {
    opts = opts || {};
    var existing = loadCatalog(catalogPath);
    if (existing) return existing;
    return {
        schema: 1,
        sourceId: opts.sourceId || 'my-source',
        sourceName: opts.sourceName || '我的 Mod 源',
        updatedAt: todayStr(),
        mods: []
    };
}

function upsertCatalogEntry(catalog, entry) {
    var idx = -1;
    for (var i = 0; i < catalog.mods.length; i++) {
        var m = catalog.mods[i];
        if (entry.id && m.id === entry.id) { idx = i; break; }
        if (m.packageName === entry.packageName) { idx = i; break; }
    }
    if (idx >= 0) {
        var prev = catalog.mods[idx];
        catalog.mods[idx] = Object.assign({}, prev, entry);
        if (!entry.hosts && prev.hosts) catalog.mods[idx].hosts = prev.hosts;
        if (!entry.summary && prev.summary) catalog.mods[idx].summary = prev.summary;
        if (!entry.title && prev.title) catalog.mods[idx].title = prev.title;
    } else {
        catalog.mods.push(entry);
    }
    catalog.updatedAt = todayStr();
    if (catalog.schema == null) catalog.schema = 1;
    return catalog;
}

function assertHttpsUrl(url) {
    var u;
    try { u = new URL(url); } catch (e) { throw new Error('download-url 无效'); }
    if (u.protocol !== 'https:') throw new Error('download-url 仅允许 https');
    return u;
}

function loadPublishState(statePath) {
    if (!statePath || !fs.existsSync(statePath)) return {};
    try {
        return JSON.parse(fs.readFileSync(statePath, 'utf-8')) || {};
    } catch (e) {
        return {};
    }
}

function savePublishState(statePath, state) {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n', 'utf-8');
}

function getPublishedVersion(packageName, opts) {
    opts = opts || {};
    if (opts.catalogPath) {
        var cat = loadCatalog(opts.catalogPath);
        if (cat && cat.mods) {
            for (var i = 0; i < cat.mods.length; i++) {
                var m = cat.mods[i];
                if (m.packageName === packageName) return m.version || null;
            }
        }
    }
    if (opts.statePath) {
        var st = loadPublishState(opts.statePath);
        if (st[packageName] && st[packageName].version) return st[packageName].version;
    }
    return null;
}

function resolvePublishStatus(localVersion, publishedVersion) {
    if (!publishedVersion) return 'new';
    var cmp = compareVersions(localVersion, publishedVersion);
    if (cmp === null) return 'unknown';
    if (cmp > 0) return 'updated';
    if (cmp === 0) return 'same';
    return 'older';
}

function scanLocalMods(localmodsDir, opts) {
    opts = opts || {};
    if (!localmodsDir || !fs.existsSync(localmodsDir)) {
        throw new Error('找不到 _localmods 目录: ' + localmodsDir);
    }
    var statePath = opts.statePath || null;
    var catalogPath = opts.catalogPath || null;
    var list = fs.readdirSync(localmodsDir, { withFileTypes: true })
        .filter(function (d) { return d.isDirectory(); })
        .map(function (d) { return d.name; })
        .filter(isSafePackageName)
        .sort(function (a, b) { return a.localeCompare(b, 'zh-CN'); });

    return list.map(function (packageName) {
        var root = path.join(localmodsDir, packageName);
        var item = {
            packageName: packageName,
            scriptCount: 0,
            modId: null,
            version: null,
            title: packageName,
            summary: '',
            publishedVersion: null,
            status: 'error',
            error: null
        };
        try {
            validatePackage(root);
            item.scriptCount = discoverPackageScripts(root).length;
            item.modId = resolveModId(packageName, root);
            var meta = resolvePackageMeta(packageName, root, {});
            item.version = meta.version;
            item.summary = meta.summary;
            item.publishedVersion = getPublishedVersion(packageName, {
                catalogPath: catalogPath,
                statePath: statePath
            });
            item.status = resolvePublishStatus(meta.version, item.publishedVersion);
        } catch (e) {
            item.error = e.message || String(e);
            item.status = 'error';
        }
        return item;
    });
}

/**
 * @param {object} opts
 * @param {string} opts.localmodsDir
 * @param {string} opts.packageName
 * @param {string} opts.outDir
 * @param {boolean} [opts.dryRun]
 * @param {string} [opts.modId]
 * @param {string} [opts.catalogPath]
 * @param {string} [opts.downloadUrl]
 * @param {string} [opts.statePath] 记录上次发布版本（无 catalog 时）
 */
function publishPackage(opts) {
    var packageName = opts.packageName;
    if (!isSafePackageName(packageName)) throw new Error('packageName 非法');
    var localmodsDir = opts.localmodsDir;
    var packageRoot = path.join(localmodsDir, packageName);
    if (!fs.existsSync(packageRoot) || !fs.statSync(packageRoot).isDirectory()) {
        throw new Error('找不到包目录: ' + packageRoot);
    }

    validatePackage(packageRoot);
    var meta = resolvePackageMeta(packageName, packageRoot, opts);
    var files = [];
    collectFiles(packageRoot, packageRoot, files);
    if (!files.length) throw new Error('包目录为空');

    var zipBuf = buildStandardZip(packageName, files);
    var hash = sha256Hex(zipBuf);
    var modId = opts.modId || resolveModId(packageName, packageRoot);
    var zipName = buildZipName(packageRoot, packageName, meta.version, opts);
    var outDir = opts.outDir;
    var zipPath = path.join(outDir, zipName);

    var result = {
        packageName: packageName,
        modId: modId,
        version: meta.version,
        title: meta.title,
        summary: meta.summary,
        fileCount: files.length,
        size: zipBuf.length,
        sha256: hash,
        zipName: zipName,
        zipPath: zipPath
    };

    if (!opts.dryRun) {
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(zipPath, zipBuf);
        result.removedZips = removeStalePackageZips(outDir, packageName, zipName);
    }

    if (opts.catalogPath && opts.downloadUrl) {
        var urlObj = assertHttpsUrl(opts.downloadUrl);
        var entry = {
            id: modId,
            packageName: packageName,
            title: meta.title,
            version: meta.version,
            downloadUrl: opts.downloadUrl,
            sha256: hash,
            size: zipBuf.length,
            summary: meta.summary,
            hosts: opts.hosts && opts.hosts.length ? opts.hosts : [urlObj.hostname]
        };
        var catalog = loadOrCreateCatalog(opts.catalogPath, opts);
        if (opts.sourceId) catalog.sourceId = opts.sourceId;
        if (opts.sourceName) catalog.sourceName = opts.sourceName;
        upsertCatalogEntry(catalog, entry);
        result.catalogEntry = entry;
        if (!opts.dryRun) {
            fs.mkdirSync(path.dirname(opts.catalogPath), { recursive: true });
            fs.writeFileSync(opts.catalogPath, JSON.stringify(catalog, null, 2) + '\n', 'utf-8');
        }
    }

    if (!opts.dryRun && opts.statePath) {
        var state = loadPublishState(opts.statePath);
        state[packageName] = {
            version: meta.version,
            modId: modId,
            zipName: zipName,
            publishedAt: new Date().toISOString()
        };
        savePublishState(opts.statePath, state);
    }

    return result;
}

module.exports = {
    isSafePackageName: isSafePackageName,
    discoverPackageScripts: discoverPackageScripts,
    resolveModId: resolveModId,
    getMainJsBaseName: getMainJsBaseName,
    resolveArtifactBase: resolveArtifactBase,
    buildZipName: buildZipName,
    removeStalePackageZips: removeStalePackageZips,
    pruneOrphanPackageZips: pruneOrphanPackageZips,
    zipNameFromDownloadUrl: zipNameFromDownloadUrl,
    versionForFileName: versionForFileName,
    normalizeVersion: normalizeVersion,
    compareVersions: compareVersions,
    resolvePublishStatus: resolvePublishStatus,
    scanLocalMods: scanLocalMods,
    publishPackage: publishPackage,
    loadCatalog: loadCatalog,
    loadOrCreateCatalog: loadOrCreateCatalog,
    upsertCatalogEntry: upsertCatalogEntry,
    buildStandardZip: buildStandardZip,
    sha256Hex: sha256Hex,
    todayStr: todayStr,
    assertHttpsUrl: assertHttpsUrl
};
