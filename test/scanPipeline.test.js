/**
 * scanPipeline 单元测试
 * 用法：node test/scanPipeline.test.js
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const createScanPipeline = require(path.join(__dirname, '../js/mods/modloader/scanPipeline'));
const createModCatalog = require(path.join(__dirname, '../js/mods/modloader/modCatalog'));
const createWorkshopBridge = require(path.join(__dirname, '../js/mods/modloader/workshopBridge'));
const createConfigCore = require(path.join(__dirname, '../js/mods/modloader/configCore'));
const createPackageDiscovery = require(path.join(__dirname, '../js/mods/modloader/packageDiscovery'));

function test(name, fn) {
    try {
        fn();
        console.log('  ok  ' + name);
    } catch (e) {
        console.error(' FAIL ' + name);
        throw e;
    }
}

console.log('scanPipeline.test.js');

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ml-scan-'));
const localmodsDir = path.join(tmpRoot, '_localmods');
const workshopBridgeDir = path.join(tmpRoot, '_workshop');
fs.mkdirSync(localmodsDir, { recursive: true });

const pkgDir = path.join(localmodsDir, 'TestPkg');
fs.mkdirSync(pkgDir, { recursive: true });
fs.writeFileSync(path.join(pkgDir, 'Hello.js'), '/*:@help */\n', 'utf-8');

const cc = createConfigCore({ log: () => {} });
const pd = createPackageDiscovery({ fs, pathMod: path, log: () => {} });
const modCatalog = createModCatalog({
    fs,
    pathMod: path,
    log: () => {},
    readWorkshopManifest: pd.readWorkshopManifest,
    discoverPackageScripts: pd.discoverPackageScripts,
    resolveModConfigEntry: cc.resolveModConfigEntry,
    isModConfigMetaKey: cc.isModConfigMetaKey,
    localmodsDir
});

const workshopBridge = createWorkshopBridge({
    fs,
    pathMod: path,
    log: () => {},
    loadWorkshopConfig: () => ({ enabled: false }),
    DEFAULT_WORKSHOP_CONFIG: cc.DEFAULT_WORKSHOP_CONFIG,
    ensureDir: (d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }
});

function stubApplyModConfigToEntry(modId, absPath, fileName, displayName, config, order) {
    return {
        id: modId,
        fileName,
        displayName,
        status: false,
        currentParams: {},
        order,
        absPath
    };
}

const pipeline = createScanPipeline({
    fs,
    pathMod: path,
    log: () => {},
    ensureDir: (d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); },
    discoverPackageScripts: pd.discoverPackageScripts,
    applyModConfigToEntry: stubApplyModConfigToEntry,
    modCatalog,
    workshopBridge,
    loadWorkshopConfig: () => ({ enabled: false }),
    localmodsDir,
    workshopBridgeDir
});

test('scanLocalMods discovers package script', () => {
    const config = {};
    const orderState = { next: 1 };
    const mods = pipeline.scanLocalMods(config, orderState);
    assert.strictEqual(mods.length, 1);
    assert.strictEqual(mods[0].id, 'local:TestPkg:Hello');
    assert.strictEqual(mods[0].source, 'local');
    assert.strictEqual(mods[0].loadPath, '../mods/_localmods/TestPkg/Hello');
});

test('mergeScanResults dedupes loadPath and reassigns order', () => {
    const a = { loadPath: '../mods/_localmods/A/X', order: 5 };
    const b = { loadPath: '../mods/_localmods/B/Y', order: 2 };
    const dup = { loadPath: '../mods/_localmods/A/X', order: 9 };
    const merged = pipeline.mergeScanResults([a, b], [dup]);
    assert.strictEqual(merged.length, 2);
    assert.deepStrictEqual(merged.map((m) => m.order), [1, 2]);
});

test('scanWorkshopMods returns empty when disabled', () => {
    const mods = pipeline.scanWorkshopMods({}, { next: 1 });
    assert.deepStrictEqual(mods, []);
});

console.log('All scanPipeline tests passed.');
