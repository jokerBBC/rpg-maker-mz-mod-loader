/**
 * packageDiscovery 单元测试（entries 安全 / manifest / fallback 扫描）
 * 用法：在 js/mods 下执行  node test/packageDiscovery.test.js
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const createPackageDiscovery = require(path.join(__dirname, '../js/mods/modloader/packageDiscovery'));

const FIXTURES = path.join(__dirname, 'fixtures');
const logs = [];

const pd = createPackageDiscovery({
    fs,
    pathMod: path,
    log: (...args) => logs.push(args)
});

function test(name, fn) {
    logs.length = 0;
    try {
        fn();
        console.log('  ok  ' + name);
    } catch (e) {
        console.error(' FAIL ' + name);
        throw e;
    }
}

console.log('packageDiscovery.test.js');

test('resolvePackageEntryFileName accepts plain .js filename', () => {
    assert.strictEqual(pd.resolvePackageEntryFileName('Alpha.js'), 'Alpha.js');
    assert.strictEqual(pd.resolvePackageEntryFileName('  Beta.js  '), 'Beta.js');
});

test('resolvePackageEntryFileName rejects path traversal and paths', () => {
    assert.strictEqual(pd.resolvePackageEntryFileName('../evil.js'), null);
    assert.strictEqual(pd.resolvePackageEntryFileName('sub/Inner.js'), null);
    assert.strictEqual(pd.resolvePackageEntryFileName('..\\win.js'), null);
    assert.ok(logs.some((row) => String(row[1]).includes('非法路径项')));
});

test('resolvePackageEntryFileName rejects non-js and ModLoader.js', () => {
    assert.strictEqual(pd.resolvePackageEntryFileName('readme.txt'), null);
    assert.strictEqual(pd.resolvePackageEntryFileName('ModLoader.js'), null);
    assert.strictEqual(pd.resolvePackageEntryFileName(''), null);
});

test('readWorkshopManifest parses valid manifest', () => {
    const manifest = pd.readWorkshopManifest(
        path.join(FIXTURES, 'packageDiscovery-entries-valid')
    );
    assert.strictEqual(manifest.name, 'FixtureEntriesValid');
    assert.deepStrictEqual(manifest.entries, ['Alpha.js', 'Beta.js']);
});

test('discoverPackageScripts honors manifest entries order', () => {
    const root = path.join(FIXTURES, 'packageDiscovery-entries-valid');
    const scripts = pd.discoverPackageScripts(root);
    assert.deepStrictEqual(
        scripts.map((s) => s.relPath),
        ['Alpha.js', 'Beta.js']
    );
    scripts.forEach((s) => {
        assert.strictEqual(s.absPath, path.join(root, s.relPath));
    });
});

test('discoverPackageScripts filters malicious entries and skips missing files', () => {
    const root = path.join(FIXTURES, 'packageDiscovery-malicious-entries');
    const scripts = pd.discoverPackageScripts(root);
    assert.deepStrictEqual(scripts.map((s) => s.relPath), ['Valid.js']);
    assert.ok(logs.some((row) => String(row[1]).includes('Ghost.js') || String(row[0]) === 2));
});

test('discoverPackageScripts falls back to package root *.js without manifest', () => {
    const root = path.join(FIXTURES, 'packageDiscovery-fallback');
    const scripts = pd.discoverPackageScripts(root);
    const names = scripts.map((s) => s.relPath).sort();
    assert.deepStrictEqual(names, ['Only.js', 'Other.js']);
});

test('discoverPackageScripts empty entries falls back to root scan', () => {
    const tmpRoot = path.join(__dirname, '_tmp-packageDiscovery-empty-entries');
    fs.mkdirSync(tmpRoot, { recursive: true });
    fs.writeFileSync(path.join(tmpRoot, 'modloader.json'), JSON.stringify({ entries: [] }));
    fs.writeFileSync(path.join(tmpRoot, 'Fallback.js'), '// fb\n');
    try {
        const scripts = pd.discoverPackageScripts(tmpRoot);
        assert.deepStrictEqual(scripts.map((s) => s.relPath), ['Fallback.js']);
    } finally {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
});

console.log('All packageDiscovery tests passed.');
