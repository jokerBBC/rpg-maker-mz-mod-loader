'use strict';

var http = require('http');
var fs = require('fs');
var path = require('path');
var { execSync, spawn } = require('child_process');
var core = require('../modStorePublishCore');
var gitRemote = require('./gitRemote');
var folderDialog = require('./folderDialog');

var GUI_ROOT = __dirname;
var PUBLIC_DIR = path.join(GUI_ROOT, 'public');
var USER_DATA = path.join(GUI_ROOT, 'user-data');
var SETTINGS_PATH = path.join(USER_DATA, 'settings.json');
var REPO_WORK_DIR = path.join(USER_DATA, 'repo-cache');
var PORT = 19280;

var DEFAULT_OUTPUT_PATH = REPO_WORK_DIR;

var DEFAULT_SETTINGS = {
    localmodsPath: '',
    outputPath: '',
    sourceId: 'my-source',
    sourceName: '我的 Mod 源',
    remote: {
        enabled: false,
        platform: 'gitee',
        repoUrl: '',
        token: '',
        branch: 'master',
        packagesSubdir: 'packages',
        catalogPathInRepo: 'catalog.json',
        rawUrlTemplate: '',
        staticCdnUrlTemplate: ''
    }
};

function loadSettings() {
    try {
        if (fs.existsSync(SETTINGS_PATH)) {
            var raw = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
            return {
                localmodsPath: raw.localmodsPath || '',
                outputPath: raw.outputPath || '',
                sourceId: raw.sourceId || DEFAULT_SETTINGS.sourceId,
                sourceName: raw.sourceName || DEFAULT_SETTINGS.sourceName,
                remote: Object.assign({}, DEFAULT_SETTINGS.remote, raw.remote || {})
            };
        }
    } catch (e) { /* ignore */ }
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}

function saveSettings(data) {
    fs.mkdirSync(USER_DATA, { recursive: true });
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function statePathFor(settings) {
    return path.join(USER_DATA, 'publish-state.json');
}

function effectiveOutputPath(settings) {
    var p = (settings && settings.outputPath) ? String(settings.outputPath).trim() : '';
    return p || DEFAULT_OUTPUT_PATH;
}

function effectiveCatalogPath(settings) {
    var root = effectiveOutputPath(settings);
    var rel = (settings && settings.remote && settings.remote.catalogPathInRepo) || 'catalog.json';
    rel = String(rel).replace(/^[/\\]+/, '');
    return path.join(root, rel);
}

function withEffectivePaths(settings) {
    return Object.assign({}, settings, {
        outputPath: effectiveOutputPath(settings),
        catalogPath: effectiveCatalogPath(settings)
    });
}

function packagesOutDir(outputPath, remote, repoLayout) {
    if (!repoLayout) return outputPath;
    var sub = (remote && remote.packagesSubdir) || 'packages';
    return path.join(outputPath, sub.replace(/^[/\\]+|[/\\]+$/g, ''));
}

function publishPackages(settings, packages, outDir, statePath) {
    var results = [];
    var errors = [];
    for (var i = 0; i < packages.length; i++) {
        var pkg = packages[i];
        try {
            results.push(core.publishPackage({
                localmodsDir: settings.localmodsDir,
                packageName: pkg,
                outDir: outDir,
                statePath: statePath
            }));
        } catch (e) {
            errors.push({ packageName: pkg, error: e.message || String(e) });
        }
    }
    return { results: results, errors: errors };
}

function readBody(req) {
    return new Promise(function (resolve, reject) {
        var chunks = [];
        req.on('data', function (c) { chunks.push(c); });
        req.on('end', function () {
            try {
                var raw = Buffer.concat(chunks).toString('utf8');
                resolve(raw ? JSON.parse(raw) : {});
            } catch (e) { reject(e); }
        });
        req.on('error', reject);
    });
}

function sendJson(res, code, obj) {
    var body = JSON.stringify(obj);
    res.writeHead(code, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
    });
    res.end(body);
}

function sendText(res, code, text, type) {
    res.writeHead(code, { 'Content-Type': (type || 'text/plain') + '; charset=utf-8' });
    res.end(text);
}

function mime(p) {
    if (p.endsWith('.html')) return 'text/html; charset=utf-8';
    if (p.endsWith('.css')) return 'text/css; charset=utf-8';
    if (p.endsWith('.js')) return 'application/javascript; charset=utf-8';
    if (p.endsWith('.png')) return 'image/png';
    return 'application/octet-stream';
}

function serveStatic(req, res) {
    var urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    if (urlPath === '/') urlPath = '/index.html';
    var file = path.normalize(path.join(PUBLIC_DIR, urlPath.replace(/^\//, '')));
    if (!file.startsWith(PUBLIC_DIR)) {
        sendText(res, 403, 'Forbidden');
        return;
    }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        sendText(res, 404, 'Not Found');
        return;
    }
    res.writeHead(200, { 'Content-Type': mime(file) });
    fs.createReadStream(file).pipe(res);
}

async function handleApi(req, res) {
    var url = new URL(req.url, 'http://127.0.0.1');
    var pathname = url.pathname;

    if (req.method === 'GET' && pathname === '/api/settings') {
        var s = loadSettings();
        var out = JSON.parse(JSON.stringify(s));
        if (out.remote && out.remote.token) out.remote.token = '***';
        out.dataDir = USER_DATA;
        out.defaultOutputPath = DEFAULT_OUTPUT_PATH;
        out.effectiveOutputPath = effectiveOutputPath(s);
        out.effectiveCatalogPath = effectiveCatalogPath(s);
        return sendJson(res, 200, out);
    }

    if (req.method === 'POST' && pathname === '/api/settings') {
        var body = await readBody(req);
        var cur = loadSettings();
        if (body.remote && body.remote.token === '***') {
            body.remote.token = cur.remote.token;
        }
        var merged = Object.assign({}, cur, body, {
            remote: Object.assign({}, cur.remote, body.remote || {})
        });
        saveSettings(merged);
        return sendJson(res, 200, { ok: true });
    }

    if (req.method === 'POST' && pathname === '/api/browse-folder') {
        try {
            var b1 = await readBody(req);
            var picked = folderDialog.pickFolder(b1.title || 'Select folder');
            return sendJson(res, 200, { path: picked });
        } catch (eBrowse) {
            return sendJson(res, 500, { error: eBrowse.message || String(eBrowse) });
        }
    }

    if (req.method === 'POST' && pathname === '/api/scan') {
        var settings = withEffectivePaths(loadSettings());
        var b2 = await readBody(req);
        var localmods = b2.localmodsPath || settings.localmodsPath;
        if (!localmods) return sendJson(res, 400, { error: '请先在设置中填写 _localmods 路径' });
        try {
            var mods = core.scanLocalMods(localmods, {
                catalogPath: settings.catalogPath,
                statePath: statePathFor(settings)
            });
            return sendJson(res, 200, { mods: mods });
        } catch (e) {
            return sendJson(res, 400, { error: e.message || String(e) });
        }
    }

    if (req.method === 'POST' && pathname === '/api/publish') {
        var s2 = withEffectivePaths(loadSettings());
        var b3 = await readBody(req);
        var packages = Array.isArray(b3.packages) ? b3.packages : [];
        if (!packages.length) return sendJson(res, 400, { error: '请至少选择一个 Mod' });
        var localmodsDir = s2.localmodsPath;
        if (!localmodsDir) return sendJson(res, 400, { error: '请先在设置中填写 _localmods 路径' });
        fs.mkdirSync(s2.outputPath, { recursive: true });

        var pub = publishPackages({
            localmodsDir: localmodsDir,
            localmodsPath: localmodsDir
        }, packages, s2.outputPath, statePathFor(s2));
        return sendJson(res, 200, pub);
    }

    if (req.method === 'POST' && pathname === '/api/publish-catalog') {
        var sCat = withEffectivePaths(loadSettings());
        var bCat = await readBody(req);
        var pkgsCat = Array.isArray(bCat.packages) ? bCat.packages : [];
        if (!pkgsCat.length) return sendJson(res, 400, { error: '请至少选择一个 Mod' });
        if (!sCat.localmodsPath) return sendJson(res, 400, { error: '请先在设置中填写 _localmods 路径' });
        if (!sCat.remote || !sCat.remote.repoUrl) {
            return sendJson(res, 400, { error: '生成 catalog 需填写仓库 HTTPS 地址（无需令牌）' });
        }

        fs.mkdirSync(sCat.outputPath, { recursive: true });
        var outPkg = packagesOutDir(sCat.outputPath, sCat.remote, true);
        fs.mkdirSync(outPkg, { recursive: true });
        var pubCat = publishPackages({
            localmodsDir: sCat.localmodsPath,
            localmodsPath: sCat.localmodsPath
        }, pkgsCat, outPkg, statePathFor(sCat));

        if (pubCat.results.length) {
            try {
                gitRemote.writeCatalogFile(sCat.catalogPath, sCat, pubCat.results);
                pubCat.catalogPath = sCat.catalogPath;
                pubCat.prunedZips = core.pruneOrphanPackageZips(outPkg, core.loadCatalog(sCat.catalogPath));
            } catch (eCat) {
                pubCat.errors.push({ packageName: '(catalog)', error: eCat.message || String(eCat) });
            }
        }
        return sendJson(res, 200, pubCat);
    }

    if (req.method === 'POST' && pathname === '/api/pull-remote') {
        var sPull = withEffectivePaths(loadSettings());
        if (!sPull.remote || !sPull.remote.repoUrl) {
            return sendJson(res, 400, { error: '请先在设置中填写远程仓库地址' });
        }
        if (!sPull.remote.token) return sendJson(res, 400, { error: '拉取远程需填写访问令牌' });
        fs.mkdirSync(sPull.outputPath, { recursive: true });
        try {
            var pullRes = gitRemote.pullRemoteToLocal(sPull.remote, {
                outputPath: sPull.outputPath,
                catalogPath: sPull.catalogPath
            }, REPO_WORK_DIR, {
                sourceId: sPull.sourceId,
                sourceName: sPull.sourceName
            });
            return sendJson(res, 200, pullRes);
        } catch (ePull) {
            return sendJson(res, 500, { error: ePull.message || String(ePull) });
        }
    }

    if (req.method === 'POST' && pathname === '/api/push-remote') {
        var s3 = withEffectivePaths(loadSettings());
        if (!s3.remote || !s3.remote.repoUrl) {
            return sendJson(res, 400, { error: '请先在设置中填写远程仓库 HTTPS 地址' });
        }
        if (!s3.remote.token) {
            return sendJson(res, 400, { error: '请先在设置中填写访问令牌' });
        }

        try {
            var pushRes = gitRemote.pushLocalLayout(s3.remote, {
                outputPath: s3.outputPath,
                catalogPath: s3.catalogPath
            }, REPO_WORK_DIR);
            return sendJson(res, 200, {
                push: pushRes,
                catalogPath: s3.catalogPath,
                catalogPublicUrl: gitRemote.buildCatalogPublicUrl(s3.remote),
                repoPath: pushRes.repoPath
            });
        } catch (e4) {
            return sendJson(res, 500, { error: e4.message || String(e4) });
        }
    }

    sendJson(res, 404, { error: 'Not Found' });
}

var server = http.createServer(function (req, res) {
    if ((req.url || '').indexOf('/api/') === 0) {
        handleApi(req, res).catch(function (e) {
            sendJson(res, 500, { error: e.message || String(e) });
        });
        return;
    }
    serveStatic(req, res);
});

server.listen(PORT, '127.0.0.1', function () {
    var url = 'http://127.0.0.1:' + PORT;
    console.log('Mod Packager GUI: ' + url);
    console.log('Data dir: ' + USER_DATA);
    console.log('Close this window to stop.');
    try {
        if (process.platform === 'win32') {
            spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
        } else {
            spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
        }
    } catch (e) { /* user can open manually */ }
});

process.on('SIGINT', function () { process.exit(0); });
