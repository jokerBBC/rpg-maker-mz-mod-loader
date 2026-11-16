/**
 * paramTypeKit 单元测试
 * 用法：在 js/mods 下执行  node test/paramTypeKit.test.js
 */
'use strict';

const assert = require('assert');
const path = require('path');
const kit = require(path.join(__dirname, '../js/mods/modloader/paramTypeKit'));

function test(name, fn) {
    try {
        fn();
        console.log('  ok  ' + name);
    } catch (e) {
        console.error(' FAIL ' + name);
        throw e;
    }
}

console.log('paramTypeKit.test.js');

test('isNoteType', () => {
    assert.strictEqual(kit.isNoteType('note'), true);
    assert.strictEqual(kit.isNoteType('multiline_string'), true);
    assert.strictEqual(kit.isNoteType('string'), false);
});

test('isDatabaseType', () => {
    assert.strictEqual(kit.isDatabaseType('actor'), true);
    assert.strictEqual(kit.isDatabaseType('switch'), true);
    assert.strictEqual(kit.isDatabaseType('string'), false);
});

test('isValidColor', () => {
    assert.strictEqual(kit.isValidColor('#ff0000'), true);
    assert.strictEqual(kit.isValidColor('#f00'), true);
    assert.strictEqual(kit.isValidColor('rgb(1,2,3)'), true);
    assert.strictEqual(kit.isValidColor('not-a-color'), false);
    assert.strictEqual(kit.isValidColor(''), false);
});

test('sanitizeText removes script tags', () => {
    const raw = 'hello<script>alert(1)</script>world';
    assert.strictEqual(kit.sanitizeText(raw), 'helloworld');
});

test('sanitizeText removes javascript: protocol', () => {
    const raw = 'click javascript:alert(1)';
    assert.strictEqual(kit.sanitizeText(raw), 'click alert(1)');
});

test('normalizeDatabaseCollection from object keys', () => {
    const obj = { 1: { name: 'A' }, 3: { name: 'C' } };
    const arr = kit.normalizeDatabaseCollection(obj);
    assert.ok(Array.isArray(arr));
    assert.strictEqual(arr.length, 4);
    assert.deepStrictEqual(arr[1], { name: 'A' });
    assert.deepStrictEqual(arr[3], { name: 'C' });
});

test('getDatabaseArray with fake dataRoot', () => {
    const root = {
        $dataItems: [{ id: 0 }, { id: 1, name: 'Potion' }],
        $dataSystem: { switches: ['', 'Door Open'], variables: ['', 'Gold'] }
    };
    const items = kit.getDatabaseArray('item', root);
    assert.strictEqual(items[1].name, 'Potion');
    const switches = kit.getDatabaseArray('switch', root);
    assert.strictEqual(switches[1], 'Door Open');
});

test('getDatabaseArray falls back to RMMZ global when root lacks property', () => {
    global.$dataClasses = [{ id: 0 }, { id: 1, name: 'Warrior' }];
    try {
        const arr = kit.getDatabaseArray('class', {});
        assert.ok(arr);
        assert.strictEqual(arr[1].name, 'Warrior');
    } finally {
        delete global.$dataClasses;
    }
});

test('getDatabaseEntryName', () => {
    assert.strictEqual(kit.getDatabaseEntryName({ name: ' Hero ' }), 'Hero');
    assert.strictEqual(kit.getDatabaseEntryName(' Switch '), 'Switch');
});

test('getDbLabel fallback and t()', () => {
    assert.strictEqual(kit.getDbLabel('item'), '物品');
    assert.strictEqual(kit.getDbLabel('item', (k) => 'translated:' + k), 'translated:db.item');
});

test('calculateStep', () => {
    assert.strictEqual(kit.calculateStep({ step: 0.25, min: 0, max: 1 }), 0.25);
    assert.strictEqual(kit.calculateStep({ min: 0, max: 10 }), 1);
    assert.strictEqual(kit.calculateStep({ min: 0, max: 0.5 }), 0.1);
});

console.log('All paramTypeKit tests passed.');
