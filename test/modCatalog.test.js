/**
 * modCatalog 单元测试
 * 用法：node test/modCatalog.test.js
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const createModCatalog = require(path.join(__dirname, '../js/mods/modloader/modCatalog'));
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

console.log('modCatalog.test.js');

const cc = createConfigCore({ log: () => {} });
const pd = createPackageDiscovery({ fs, pathMod: path, log: () => {} });
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ml-modcatalog-'));

const catalog = createModCatalog({
    fs,
    pathMod: path,
    log: () => {},
    readWorkshopManifest: pd.readWorkshopManifest,
    discoverPackageScripts: pd.discoverPackageScripts,
    resolveModConfigEntry: cc.resolveModConfigEntry,
    isModConfigMetaKey: cc.isModConfigMetaKey,
    localmodsDir: path.join(tmpRoot, '_localmods')
});

test('buildLocalModId / buildLocalLoadPath', () => {
    assert.strictEqual(catalog.buildLocalModId('MyPkg', 'Foo'), 'local:MyPkg:Foo');
    assert.strictEqual(catalog.buildLocalLoadPath('MyPkg', 'Foo'), '../mods/_localmods/MyPkg/Foo');
});

test('getLocalModInstallPath uses package dir named after script base', () => {
    const p = catalog.getLocalModInstallPath('DemoMod.js');
    assert.ok(p.endsWith(path.join('_localmods', 'DemoMod', 'DemoMod.js')));
});

test('getConfigMaxOrder skips meta keys', () => {
    const max = catalog.getConfigMaxOrder({
        plugins: {},
        'local:A:One': { order: 3 },
        'local:B:Two': { order: 7 }
    });
    assert.strictEqual(max, 7);
});

test('allocDefaultOrderForMod reuses config order', () => {
    const config = { 'local:P:S': { order: 5, status: true, params: {} } };
    const state = { next: 10 };
    assert.strictEqual(catalog.allocDefaultOrderForMod(config, state, 'local:P:S', 'S'), 5);
    assert.strictEqual(state.next, 10);
});

test('allocDefaultOrderForMod allocates from orderState', () => {
    const state = { next: 4 };
    assert.strictEqual(catalog.allocDefaultOrderForMod({}, state, 'local:X:Y', 'Y'), 4);
    assert.strictEqual(state.next, 5);
});

test('reassignOrders contiguous from 1', () => {
    const list = [{ order: 99 }, { order: 2 }];
    catalog.reassignOrders(list);
    assert.deepStrictEqual(list.map((m) => m.order), [1, 2]);
});

test('resolvePackageVersion from modloader.json', () => {
    const pkgDir = path.join(tmpRoot, 'pkg-version');
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(
        path.join(pkgDir, 'modloader.json'),
        JSON.stringify({ version: ' 1.2.3 ', entries: ['Only.js'] }),
        'utf-8'
    );
    fs.writeFileSync(path.join(pkgDir, 'Only.js'), '/* stub */', 'utf-8');
    const mod = { packageRoot: pkgDir, version: '9.9.9' };
    assert.strictEqual(catalog.resolvePackageVersion(mod), '1.2.3');
});

test('canShowModChangelog requires version and file', () => {
    const pkgDir = path.join(tmpRoot, 'pkg-cl');
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(
        path.join(pkgDir, 'modloader.json'),
        JSON.stringify({ version: '1.0.0', entries: ['A.js'] }),
        'utf-8'
    );
    fs.writeFileSync(path.join(pkgDir, 'A.js'), '/* stub */', 'utf-8');
    fs.writeFileSync(path.join(pkgDir, 'CHANGELOG.md'), '# log', 'utf-8');
    const mod = { packageRoot: pkgDir, localPackageName: 'pkg-cl' };
    assert.strictEqual(catalog.canShowModChangelog(mod), true);
});

console.log('All modCatalog tests passed.');
