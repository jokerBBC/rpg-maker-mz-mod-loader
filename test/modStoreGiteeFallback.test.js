/**
 * Gitee API 兜底 · 来源边界测试
 *
 * 证明：兜底只对 gitee.com/<owner>/<repo>/raw/<ref>/<path> 生效；
 * 自建静态页 / CDN / GitHub / AtomGit / 本地 HTTPS 等其它来源行为不变
 * （管理器在线更新与 Mod 商店两条链路都覆盖）。
 *
 * 测试对象是从被测文件原文抽取的真实函数（非副本），https / fs 全部打桩，无真实网络。
 * 用法：node test/modStoreGiteeFallback.test.js
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

const ROOT = path.join(__dirname, '..');
const MODSTORE_SRC = fs.readFileSync(path.join(ROOT, 'js/mods/libs/modStore.js'), 'utf8');
const UPDATER_SRC = fs.readFileSync(path.join(ROOT, 'js/mods/libs/modLoaderUpdater.js'), 'utf8');

function test(name, fn) {
    try {
        fn();
        console.log('  ok  ' + name);
    } catch (e) {
        console.error(' FAIL ' + name);
        throw e;
    }
}

// ---- 从被测文件原文抽取函数 / 常量（测的是仓库里的代码，不是副本）----

function extractFn(src, name) {
    const start = src.indexOf('function ' + name + '(');
    assert.ok(start >= 0, '函数未找到: ' + name);
    let i = src.indexOf('{', start);
    let depth = 0;
    for (; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
    }
    throw new Error('括号未配平: ' + name);
}

function extractConst(src, name) {
    const m = src.match(new RegExp('const ' + name + ' = [^;]+;'));
    assert.ok(m, '常量未找到: ' + name);
    return m[0];
}

// ---- https 桩：按 (host, pathname, servername) 路由，全程记录调用 ----

function createHttpsStub(router) {
    const calls = [];
    const https = {
        request(options, cb) {
            const host = options.hostname;
            const pathname = String(options.path || '').split('?')[0];
            const servername = options.servername || null;
            calls.push({ host: host, path: pathname, servername: servername });
            const route = router(host, pathname, servername);
            assert.ok(route, '未路由的请求: ' + host + pathname);
            const req = new EventEmitter();
            req.end = function () {};
            req.destroy = function () {};
            if (route.error) {
                const err = new Error(route.error.message || route.error.code);
                err.code = route.error.code;
                setImmediate(function () { req.emit('error', err); });
                return req;
            }
            setImmediate(function () {
                const res = new EventEmitter();
                res.statusCode = route.status;
                res.headers = route.location ? { location: route.location } : {};
                res.resume = function () {};
                res.destroy = function () {};
                cb(res);
                const body = Buffer.isBuffer(route.body) ? route.body : Buffer.from(route.body || '');
                if (body.length) res.emit('data', body);
                res.emit('end');
            });
            return req;
        }
    };
    return { https: https, calls: calls };
}

// ---- fs 桩：内存文件系统（下载落盘 + 哈希用）----

function createFsStub() {
    const files = new Map();
    return {
        files: files,
        fs: {
            existsSync: function (p) { return files.has(p); },
            mkdirSync: function () {},
            statSync: function (p) { return { size: (files.get(p) || Buffer.alloc(0)).length, isDirectory: function () { return false; } }; },
            lstatSync: function () { return { isDirectory: function () { return false; } }; },
            unlinkSync: function (p) { files.delete(p); },
            rmSync: function (p) { files.delete(p); },
            writeFileSync: function (p, buf) { files.set(p, Buffer.isBuffer(buf) ? buf : Buffer.from(buf)); },
            createWriteStream: function (p) {
                const chunks = [];
                const ws = new EventEmitter();
                ws.write = function (c) { chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)); return true; };
                ws.end = function (cb) {
                    files.set(p, Buffer.concat(chunks));
                    setImmediate(function () { if (cb) cb(); });
                };
                ws.once = ws.on;
                ws.destroy = function () {};
                return ws;
            },
            createReadStream: function (p) {
                const rs = new EventEmitter();
                const buf = files.get(p) || Buffer.alloc(0);
                setImmediate(function () { rs.emit('data', buf); rs.emit('end'); });
                return rs;
            }
        }
    };
}

// ---- 组装被测模块（商店 / 更新器各一份）----

const COMMON_PRELUDE = [
    'const USER_AGENT = "test-agent";',
    'const REQUEST_TIMEOUT_MS = 60000;',
    'const RESUME_THRESHOLD_BYTES = 50 * 1024 * 1024;',
    'const PROGRESS_UI_THROTTLE_MS = 200;',
    'const DEFAULT_MAX_BYTES = 104857600;',
    'const MAX_BYTES = Number.MAX_SAFE_INTEGER;',
    'function storeT(key) { return key; }',
    'function t(key) { return key; }',
    'const pathMod = { join: function () { return Array.prototype.join.call(arguments, "/"); },',
    '    dirname: function (p) { return p.slice(0, p.lastIndexOf("/")); } };'
].join('\n');

function buildModule(src, fnNames, constNames, deps) {
    const parts = [COMMON_PRELUDE];
    constNames.forEach(function (n) { parts.push(extractConst(src, n)); });
    fnNames.forEach(function (n) { parts.push(extractFn(src, n)); });
    parts.push('return { ' + fnNames.join(', ') + ' };');
    const factory = new Function('urlMod', 'https', 'fs', 'crypto', 'console', parts.join('\n\n'));
    return factory(deps.urlMod, deps.https, deps.fs, deps.crypto, console);
}

const MODSTORE_FNS = [
    'isSniRetryableHost', 'isConnResetError', 'isLocalHttpsHost', 'httpsTlsOptions',
    'parseHttpsUrl', 'giteeApiFallbackUrl', 'giteeApiBlobUrl', 'giteeApiFetchFileBytes',
    'giteeApiFetchBuffer', 'downloadViaGiteeApi', 'requestBuffer',
    'ensureDir', 'removePathSafe', 'hashFile', 'downloadToFile'
];
const UPDATER_FNS = [
    'isSniRetryableHost', 'isConnResetError', 'parseHttpsUrl', 'giteeApiFallbackUrl',
    'giteeApiBlobUrl', 'giteeApiFetchBytes', 'requestBuffer'
];

function buildStoreModule(router) {
    const stub = createHttpsStub(router);
    const fsStub = createFsStub();
    const mod = buildModule(MODSTORE_SRC, MODSTORE_FNS, ['SNI_RETRY_HOST_RE'], {
        urlMod: require('url'),
        https: stub.https,
        fs: fsStub.fs,
        crypto: require('crypto')
    });
    return { mod: mod, calls: stub.calls, files: fsStub.files };
}

function buildUpdaterModule(router) {
    const stub = createHttpsStub(router);
    const mod = buildModule(UPDATER_SRC, UPDATER_FNS, ['SNI_RETRY_HOST_RE'], {
        urlMod: require('url'),
        https: stub.https,
        fs: createFsStub().fs,
        crypto: require('crypto')
    });
    return { mod: mod, calls: stub.calls };
}

function apiCalls(calls) {
    return calls.filter(function (c) { return c.host === 'gitee.com' && c.path.indexOf('/api/') === 0; });
}

function rejectsWith(promise, codeOrMsg) {
    return promise.then(function () {
        throw new Error('本应拒绝却resolve了');
    }, function (err) {
        const text = String(err && (err.code || err.message) || err);
        assert.ok(text.indexOf(codeOrMsg) >= 0, '错误不含 ' + codeOrMsg + '，实际: ' + text);
    });
}

// =====================================================================
// 1. URL 映射矩阵：只有 gitee.com/<o>/<r>/raw/<ref>/<path> 才映射
// =====================================================================

console.log('modStoreGiteeFallback.test.js');

const URL_CASES = [
    // [输入, 期望的 API 兜底 URL（'' = 不兜底）]
    ['https://gitee.com/jokerBBC/rpg-maker-mz-mod-loader/raw/main/js/mods/libs/modStore.js',
        'https://gitee.com/api/v5/repos/jokerBBC/rpg-maker-mz-mod-loader/contents/js/mods/libs/modStore.js?ref=main'],
    ['https://gitee.com/o/r/raw/V4.5.4/manager/catalog.json',
        'https://gitee.com/api/v5/repos/o/r/contents/manager/catalog.json?ref=V4.5.4'],
    ['https://gitee.com/o/r/raw/main/deep/nested/path/pack.zip',
        'https://gitee.com/api/v5/repos/o/r/contents/deep/nested/path/pack.zip?ref=main'],
    // —— 以下一律不兜底 ——
    ['https://github.com/o/r/raw/main/x.json', ''],
    ['https://raw.githubusercontent.com/o/r/main/x.json', ''],
    ['https://api.atomgit.com/api/v5/repos/o/r/raw/x.json?ref=main', ''],
    ['https://cdn.jsdelivr.net/gh/o/r@main/x.json', ''],
    ['https://example.com/mods/catalog.json', ''],
    ['https://mods.example-cdn.com/pack.zip', ''],
    ['https://127.0.0.1:8443/mods/catalog.json', ''],
    ['https://localhost/mods/catalog.json', ''],
    ['https://gitee.com/o/r', ''],
    ['https://gitee.com/o/r/raw/main', ''],
    ['https://gitee.com/api/v5/repos/o/r/contents/x.json?ref=main', ''],
    // http:// 输入：映射函数本身不校验协议；真实链路中 parseHttpsUrl 会先拒绝非 https，
    // 该输入永远到不了这里，此处仅记录映射函数的实际行为
    ['http://gitee.com/o/r/raw/main/x.json',
        'https://gitee.com/api/v5/repos/o/r/contents/x.json?ref=main'],
    ['not-a-url', '']
];

test('URL 映射矩阵：仅 gitee raw 命中，其余来源全部不映射（商店）', function () {
    const built = buildStoreModule(function () { return { status: 200 }; });
    URL_CASES.forEach(function (c) {
        assert.strictEqual(built.mod.giteeApiFallbackUrl(c[0]), c[1], '输入: ' + c[0]);
    });
});

test('URL 映射矩阵：更新器与商店口径一致', function () {
    const store = buildStoreModule(function () { return { status: 200 }; });
    const updater = buildUpdaterModule(function () { return { status: 200 }; });
    URL_CASES.forEach(function (c) {
        assert.strictEqual(updater.mod.giteeApiFallbackUrl(c[0]), c[1], '输入: ' + c[0]);
        assert.strictEqual(updater.mod.giteeApiFallbackUrl(c[0]), store.mod.giteeApiFallbackUrl(c[0]));
    });
});

// =====================================================================
// 2. 商店链路（requestBuffer：catalog / changelog 取源）
// =====================================================================

test('自建静态页 200：正常取源，行为不变', function () {
    const built = buildStoreModule(function (host, pathname) {
        if (host === 'example.com') return { status: 200, body: '{"mods":[]}' };
        throw new Error('unexpected ' + host + pathname);
    });
    return built.mod.requestBuffer('https://example.com/mods/catalog.json').then(function (r) {
        assert.strictEqual(r.statusCode, 200);
        assert.strictEqual(r.buffer.toString(), '{"mods":[]}');
        assert.strictEqual(apiCalls(built.calls).length, 0);
    });
});

test('自建静态页 302 到 CDN 后被重置：原样报错，不触发任何 Gitee API 调用', function () {
    const built = buildStoreModule(function (host) {
        if (host === 'example.com') return { status: 302, location: 'https://cdn.example.com/mods/catalog.json' };
        if (host === 'cdn.example.com') return { error: { code: 'ECONNRESET', message: 'read ECONNRESET' } };
        throw new Error('unexpected ' + host);
    });
    return rejectsWith(built.mod.requestBuffer('https://example.com/mods/catalog.json'), 'ECONNRESET')
        .then(function () {
            assert.strictEqual(apiCalls(built.calls).length, 0, '不应调用 Gitee API');
        });
});

test('Gitee raw 302 后被 SNI 重置：大写 SNI 重试成功，不触发 API 兜底（V4.5.3 行为保持）', function () {
    const built = buildStoreModule(function (host, pathname, servername) {
        if (host === 'gitee.com') return { status: 302, location: 'https://raw.giteeusercontent.com/o/r/raw/main/x.json' };
        if (host === 'raw.giteeusercontent.com') {
            if (servername === 'RAW.GITEEUSERCONTENT.COM') return { status: 200, body: '{"ok":1}' };
            return { error: { code: 'ECONNRESET', message: 'read ECONNRESET' } };
        }
        throw new Error('unexpected ' + host + pathname);
    });
    return built.mod.requestBuffer('https://gitee.com/o/r/raw/main/x.json').then(function (r) {
        assert.strictEqual(r.buffer.toString(), '{"ok":1}');
        const upper = built.calls.filter(function (c) { return c.servername === 'RAW.GITEEUSERCONTENT.COM'; });
        assert.strictEqual(upper.length, 1, '应恰好一次大写 SNI 重试');
        assert.strictEqual(apiCalls(built.calls).length, 0, 'SNI 重试成功时不应走 API');
    });
});

test('Gitee raw 302 后被 DNS 污染（ETIMEDOUT）：改走 Gitee contents API 取回同一文件', function () {
    const payload = Buffer.from('{"catalog":"v1"}');
    const built = buildStoreModule(function (host, pathname) {
        if (host === 'gitee.com' && pathname === '/o/r/raw/main/x.json') {
            return { status: 302, location: 'https://raw.giteeusercontent.com/o/r/raw/main/x.json' };
        }
        if (host === 'raw.giteeusercontent.com') {
            return { error: { code: 'ETIMEDOUT', message: 'connect ETIMEDOUT 1.1.1.1:443' } };
        }
        if (host === 'gitee.com' && pathname === '/api/v5/repos/o/r/contents/x.json') {
            return { status: 200, body: JSON.stringify({ encoding: 'base64', content: payload.toString('base64') }) };
        }
        throw new Error('unexpected ' + host + pathname);
    });
    return built.mod.requestBuffer('https://gitee.com/o/r/raw/main/x.json').then(function (r) {
        assert.strictEqual(r.buffer.toString(), '{"catalog":"v1"}');
        const apis = apiCalls(built.calls);
        assert.strictEqual(apis.length, 1, '应恰好一次 contents API 调用');
        assert.strictEqual(apis[0].path, '/api/v5/repos/o/r/contents/x.json');
    });
});

test('Gitee contents 超 1MB 只回 sha：自动改走 git/blobs 取完整正文', function () {
    const payload = Buffer.from('BIG-FILE-CONTENT');
    const built = buildStoreModule(function (host, pathname) {
        if (host === 'gitee.com' && pathname === '/o/r/raw/main/big.zip') {
            return { status: 302, location: 'https://raw.giteeusercontent.com/o/r/raw/main/big.zip' };
        }
        if (host === 'raw.giteeusercontent.com') {
            return { error: { code: 'ETIMEDOUT', message: 'connect ETIMEDOUT 1.1.1.1:443' } };
        }
        if (host === 'gitee.com' && pathname === '/api/v5/repos/o/r/contents/big.zip') {
            return { status: 200, body: JSON.stringify({ encoding: 'base64', sha: 'deadbeef' }) };
        }
        if (host === 'gitee.com' && pathname === '/api/v5/repos/o/r/git/blobs/deadbeef') {
            return { status: 200, body: JSON.stringify({ encoding: 'base64', content: payload.toString('base64') }) };
        }
        throw new Error('unexpected ' + host + pathname);
    });
    return built.mod.requestBuffer('https://gitee.com/o/r/raw/main/big.zip').then(function (r) {
        assert.strictEqual(r.buffer.toString(), 'BIG-FILE-CONTENT');
        assert.strictEqual(apiCalls(built.calls).length, 2, 'contents + blob 各一次');
    });
});

test('GitHub raw 302 后被重置：原样报错，不触发任何 Gitee API 调用', function () {
    const built = buildStoreModule(function (host) {
        if (host === 'github.com') return { status: 302, location: 'https://raw.githubusercontent.com/o/r/main/x.json' };
        if (host === 'raw.githubusercontent.com') return { error: { code: 'ECONNRESET', message: 'read ECONNRESET' } };
        throw new Error('unexpected ' + host);
    });
    return rejectsWith(built.mod.requestBuffer('https://github.com/o/r/raw/main/x.json'), 'ECONNRESET')
        .then(function () {
            assert.strictEqual(apiCalls(built.calls).length, 0);
        });
});

test('Gitee raw 续传请求（rangeStart>0）失败：不走兜底（API 无 Range）', function () {
    const built = buildStoreModule(function (host) {
        if (host === 'gitee.com') return { status: 302, location: 'https://raw.giteeusercontent.com/o/r/raw/main/big.zip' };
        if (host === 'raw.giteeusercontent.com') return { error: { code: 'ETIMEDOUT', message: 'connect ETIMEDOUT' } };
        throw new Error('unexpected ' + host);
    });
    return rejectsWith(built.mod.requestBuffer('https://gitee.com/o/r/raw/main/big.zip', { rangeStart: 1024 }), 'ETIMEDOUT')
        .then(function () {
            assert.strictEqual(apiCalls(built.calls).length, 0, '续传不兜底');
        });
});

test('AtomGit API URL 第一跳就失败：不映射、不兜底（交给更新器三源链）', function () {
    const built = buildStoreModule(function (host) {
        if (host === 'api.atomgit.com') return { error: { code: 'ETIMEDOUT', message: 'connect ETIMEDOUT' } };
        throw new Error('unexpected ' + host);
    });
    return rejectsWith(
        built.mod.requestBuffer('https://api.atomgit.com/api/v5/repos/o/r/raw/x.json?ref=main'), 'ETIMEDOUT')
        .then(function () {
            assert.strictEqual(apiCalls(built.calls).length, 0);
        });
});

// =====================================================================
// 3. 商店链路（downloadToFile：安装包下载）
// =====================================================================

test('安装包 · 自建 CDN 302 后 200：正常落盘，行为不变', function () {
    const payload = Buffer.from('ZIPDATA-CDN');
    const built = buildStoreModule(function (host) {
        if (host === 'example.com') return { status: 302, location: 'https://cdn.example.com/pack.zip' };
        if (host === 'cdn.example.com') return { status: 200, body: payload };
        throw new Error('unexpected ' + host);
    });
    return built.mod.downloadToFile('https://example.com/pack.zip', '/tmp/modstore-t/pack.zip').then(function (r) {
        assert.strictEqual(r.bytes, payload.length);
        assert.ok(/^[0-9a-f]{64}$/.test(r.sha256), 'sha256 形态');
        assert.strictEqual(built.files.get('/tmp/modstore-t/pack.zip').toString(), 'ZIPDATA-CDN');
        assert.strictEqual(apiCalls(built.calls).length, 0);
    });
});

test('安装包 · Gitee raw 被 DNS 污染：API 兜底整包落盘并报进度', function () {
    const payload = Buffer.from('ZIPDATA-VIA-API');
    const progress = [];
    const built = buildStoreModule(function (host, pathname) {
        if (host === 'gitee.com' && pathname === '/o/r/raw/main/pack.zip') {
            return { status: 302, location: 'https://raw.giteeusercontent.com/o/r/raw/main/pack.zip' };
        }
        if (host === 'raw.giteeusercontent.com') {
            return { error: { code: 'ETIMEDOUT', message: 'connect ETIMEDOUT 1.1.1.1:443' } };
        }
        if (host === 'gitee.com' && pathname === '/api/v5/repos/o/r/contents/pack.zip') {
            return { status: 200, body: JSON.stringify({ encoding: 'base64', content: payload.toString('base64') }) };
        }
        throw new Error('unexpected ' + host + pathname);
    });
    return built.mod.downloadToFile('https://gitee.com/o/r/raw/main/pack.zip', '/tmp/modstore-t/pack2.zip', {
        onProgress: function (p) { progress.push(p); }
    }).then(function (r) {
        assert.strictEqual(r.bytes, payload.length);
        assert.strictEqual(built.files.get('/tmp/modstore-t/pack2.zip').toString(), 'ZIPDATA-VIA-API');
        assert.ok(progress.length > 0 && progress[progress.length - 1].received === payload.length, '兜底后应报进度');
        assert.strictEqual(apiCalls(built.calls).length, 1);
    });
});

test('安装包 · GitHub raw 被重置：原样报错，不触发任何 Gitee API 调用', function () {
    const built = buildStoreModule(function (host) {
        if (host === 'github.com') return { status: 302, location: 'https://raw.githubusercontent.com/o/r/main/pack.zip' };
        if (host === 'raw.githubusercontent.com') return { error: { code: 'ECONNRESET', message: 'read ECONNRESET' } };
        throw new Error('unexpected ' + host);
    });
    return rejectsWith(built.mod.downloadToFile('https://github.com/o/r/raw/main/pack.zip', '/tmp/modstore-t/pack3.zip'), 'ECONNRESET')
        .then(function () {
            assert.strictEqual(apiCalls(built.calls).length, 0);
            assert.strictEqual(built.files.has('/tmp/modstore-t/pack3.zip'), false, '失败不应留文件');
        });
});

// =====================================================================
// 4. 管理器在线更新链路（modLoaderUpdater.requestBuffer）
// =====================================================================

test('管理器更新 · Gitee catalog 被 DNS 污染：API 兜底取回（Buffer 直返）', function () {
    const payload = Buffer.from('{"channel":"main"}');
    const built = buildUpdaterModule(function (host, pathname) {
        if (host === 'gitee.com' && pathname === '/jokerBBC/rpg-maker-mz-mod-loader/raw/main/manager/catalog.json') {
            return { status: 302, location: 'https://raw.giteeusercontent.com/jokerBBC/rpg-maker-mz-mod-loader/raw/main/manager/catalog.json' };
        }
        if (host === 'raw.giteeusercontent.com') {
            return { error: { code: 'ETIMEDOUT', message: 'connect ETIMEDOUT 1.1.1.1:443' } };
        }
        if (host === 'gitee.com' && pathname === '/api/v5/repos/jokerBBC/rpg-maker-mz-mod-loader/contents/manager/catalog.json') {
            return { status: 200, body: JSON.stringify({ encoding: 'base64', content: payload.toString('base64') }) };
        }
        throw new Error('unexpected ' + host + pathname);
    });
    return built.mod.requestBuffer('https://gitee.com/jokerBBC/rpg-maker-mz-mod-loader/raw/main/manager/catalog.json')
        .then(function (buf) {
            assert.ok(Buffer.isBuffer(buf), '更新器 requestBuffer 直返 Buffer');
            assert.strictEqual(buf.toString(), '{"channel":"main"}');
            assert.strictEqual(apiCalls(built.calls).length, 1);
        });
});

test('管理器更新 · GitHub 镜像被重置：原样报错，不触发 Gitee API（交还三源链）', function () {
    const built = buildUpdaterModule(function (host) {
        if (host === 'github.com') return { status: 302, location: 'https://raw.githubusercontent.com/jokerBBC/rpg-maker-mz-mod-loader/main/manager/catalog.json' };
        if (host === 'raw.githubusercontent.com') return { error: { code: 'ECONNRESET', message: 'read ECONNRESET' } };
        throw new Error('unexpected ' + host);
    });
    return rejectsWith(
        built.mod.requestBuffer('https://github.com/jokerBBC/rpg-maker-mz-mod-loader/raw/main/manager/catalog.json'), 'ECONNRESET')
        .then(function () {
            assert.strictEqual(apiCalls(built.calls).length, 0);
        });
});

test('管理器更新 · AtomGit 第一跳失败：不映射、不兜底（由 mirrorOrder 切下一源）', function () {
    const built = buildUpdaterModule(function (host) {
        if (host === 'api.atomgit.com') return { error: { code: 'ETIMEDOUT', message: 'connect ETIMEDOUT' } };
        throw new Error('unexpected ' + host);
    });
    return rejectsWith(
        built.mod.requestBuffer('https://api.atomgit.com/api/v5/repos/jokerBBC/rpg-maker-mz-mod-loader/raw/manager/catalog.json?ref=main'), 'ETIMEDOUT')
        .then(function () {
            assert.strictEqual(apiCalls(built.calls).length, 0);
        });
});
