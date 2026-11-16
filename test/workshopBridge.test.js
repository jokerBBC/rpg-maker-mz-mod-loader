/**
 * workshopBridge 单元测试
 * 用法：node test/workshopBridge.test.js
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const createWorkshopBridge = require(path.join(__dirname, '../js/mods/modloader/workshopBridge'));
const { DEFAULT_WORKSHOP_CONFIG } = require(path.join(__dirname, '../js/mods/modloader/configCore'));

function test(name, fn) {
    try {
        fn();
        console.log('  ok  ' + name);
    } catch (e) {
        console.error(' FAIL ' + name);
        throw e;
    }
}

console.log('workshopBridge.test.js');

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ml-wsbridge-'));
const steamapps = path.join(tmpRoot, 'steamapps');
const workshopContent = path.join(steamapps, 'workshop', 'content', '9999999');
fs.mkdirSync(workshopContent, { recursive: true });

const origCwd = process.cwd();
process.chdir(tmpRoot);

const bridge = createWorkshopBridge({
    fs,
    pathMod: path,
    log: () => {},
    loadWorkshopConfig: () => ({
        enabled: true,
        steamAppId: '9999999',
        steamLibraryPath: tmpRoot
    }),
    DEFAULT_WORKSHOP_CONFIG,
    ensureDir: (dir) => {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }
});

test('resolveSteamPaths with explicit library path', () => {
    const { workshopDir, steamAppId } = bridge.resolveSteamPaths();
    assert.strictEqual(steamAppId, '9999999');
    assert.strictEqual(workshopDir, workshopContent);
});

test('buildWorkshopBridgeLoadPath', () => {
    assert.strictEqual(
        bridge.buildWorkshopBridgeLoadPath('42', 'Alpha.js'),
        '../mods/_workshop/42/Alpha'
    );
});

test('removePathSafe deletes file', () => {
    const f = path.join(tmpRoot, 'to-delete.txt');
    fs.writeFileSync(f, 'x', 'utf-8');
    bridge.removePathSafe(f);
    assert.ok(!fs.existsSync(f));
});

test('syncWorkshopBridge copies via file symlinks when junction fails', () => {
    const pkgRoot = path.join(tmpRoot, 'ws-pkg');
    const bridgeDir = path.join(tmpRoot, '_workshop');
    fs.mkdirSync(pkgRoot, { recursive: true });
    const scriptPath = path.join(pkgRoot, 'Mod.js');
    fs.writeFileSync(scriptPath, '/* mod */', 'utf-8');

    const realSymlink = fs.symlinkSync;
    let junctionAttempts = 0;
    fs.symlinkSync = function (target, linkPath, type) {
        if (type === 'junction') {
            junctionAttempts++;
            throw new Error('junction blocked in test');
        }
        return realSymlink.call(fs, target, linkPath, type);
    };

    try {
        const scripts = [{ relPath: 'Mod.js', absPath: scriptPath }];
        const ok = bridge.syncWorkshopBridge('1001', pkgRoot, scripts, bridgeDir);
        assert.strictEqual(ok, true);
        assert.ok(junctionAttempts >= 1);
        assert.ok(fs.existsSync(path.join(bridgeDir, '1001', 'Mod.js')));
    } finally {
        fs.symlinkSync = realSymlink;
    }
});

process.chdir(origCwd);

console.log('All workshopBridge tests passed.');
