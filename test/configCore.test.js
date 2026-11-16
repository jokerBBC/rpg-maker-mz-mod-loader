/**
 * configCore 单元测试（mod_config 键 / meta 键 / workshop 合并 / 序列化）
 * 用法：在 js/mods 下执行  node test/configCore.test.js
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const createConfigCore = require(path.join(__dirname, '../js/mods/modloader/configCore'));

const FIXTURES = path.join(__dirname, 'fixtures');
const logs = [];

const cc = createConfigCore({
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

function loadFixture(name) {
    return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), 'utf-8'));
}

console.log('configCore.test.js');

test('resolveModConfigEntry: new key wins over legacy', () => {
    const config = loadFixture('configCore-new-key-priority.json');
    const entry = cc.resolveModConfigEntry(config, 'local:MyPkg:DupScript', 'DupScript');
    assert.strictEqual(entry.status, true);
    assert.deepStrictEqual(entry.params, { flag: 'yes' });
    assert.strictEqual(entry.order, 9);
    assert.strictEqual(logs.length, 0);
});

test('resolveModConfigEntry: legacy fallback when new key absent', () => {
    const config = loadFixture('configCore-legacy-key.json');
    const entry = cc.resolveModConfigEntry(config, 'local:Pkg:OldScript', 'OldScript');
    assert.strictEqual(entry.status, true);
    assert.deepStrictEqual(entry.params, { speed: '5' });
    assert.ok(logs.some((row) => String(row[2]).includes('../mods/OldScript')));
});

test('resolveModConfigEntry: undefined when no matching key', () => {
    const config = { 'local:Pkg:Other': { status: false, params: {}, order: 1 } };
    assert.strictEqual(cc.resolveModConfigEntry(config, 'local:Pkg:Missing', 'Missing'), undefined);
    assert.strictEqual(cc.resolveModConfigEntry(null, 'local:Pkg:Missing', 'Missing'), undefined);
});

const metaKeyCases = [
    ['plugins', true],
    ['local:Pkg:Script', false],
    ['../mods/Script', false],
    ['ws:123:Script', false]
];

metaKeyCases.forEach(([key, expected]) => {
    test('isModConfigMetaKey: ' + key + ' → ' + expected, () => {
        assert.strictEqual(cc.isModConfigMetaKey(key), expected);
    });
});

test('getDefaultModLoaderConfig: includes workshop defaults', () => {
    const defaults = cc.getDefaultModLoaderConfig();
    assert.strictEqual(defaults.ml_theme, 'dark');
    assert.strictEqual(defaults.ml_ui_scale, '100');
    assert.strictEqual(defaults.ml_language, 'zh_CN');
    assert.deepStrictEqual(defaults.workshop, cc.DEFAULT_WORKSHOP_CONFIG);
});

test('mergeWorkshopConfigSection: missing workshop section', () => {
    const result = cc.mergeWorkshopConfigSection(undefined);
    assert.strictEqual(result.changed, true);
    assert.deepStrictEqual(result.merged, cc.DEFAULT_WORKSHOP_CONFIG);
});

test('mergeWorkshopConfigSection: empty workshop object', () => {
    const result = cc.mergeWorkshopConfigSection({});
    assert.strictEqual(result.changed, false);
    assert.deepStrictEqual(result.merged, cc.DEFAULT_WORKSHOP_CONFIG);
});

test('mergeWorkshopConfigSection: fills missing keys without overwriting existing', () => {
    const partial = loadFixture('configCore-workshop-partial.json').workshop;
    const result = cc.mergeWorkshopConfigSection(partial);
    assert.strictEqual(result.merged.enabled, false);
    assert.strictEqual(result.merged.steamAppId, '9999999');
    assert.strictEqual(result.merged.steamLibraryPath, '');
});

test('mergeWorkshopConfigSection: sparse workshop gets remaining defaults', () => {
    const result = cc.mergeWorkshopConfigSection({ enabled: false });
    assert.strictEqual(result.merged.enabled, false);
    assert.strictEqual(result.merged.steamAppId, cc.DEFAULT_WORKSHOP_CONFIG.steamAppId);
    assert.strictEqual(result.merged.steamLibraryPath, '');
});

test('buildModConfigEntry: status / params / order shape', () => {
    const entry = cc.buildModConfigEntry({
        id: 'local:Pkg:Alpha',
        status: true,
        currentParams: { n: '1' },
        order: 3
    });
    assert.deepStrictEqual(entry, {
        status: true,
        params: { n: '1' },
        order: 3
    });
    assert.strictEqual(Object.prototype.hasOwnProperty.call(entry, 'id'), false);
});

test('serializeModListToConfig: full list, no meta keys', () => {
    const config = cc.serializeModListToConfig([
        { id: 'local:A:One', status: true, currentParams: { x: '1' }, order: 1 },
        { id: 'ws:42:Two', status: false, currentParams: {}, order: 2 }
    ]);
    assert.deepStrictEqual(Object.keys(config).sort(), ['local:A:One', 'ws:42:Two']);
    assert.strictEqual(cc.isModConfigMetaKey('plugins'), true);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(config, 'plugins'), false);
    assert.deepStrictEqual(config['local:A:One'], {
        status: true,
        params: { x: '1' },
        order: 1
    });
});

console.log('all passed');
