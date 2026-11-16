/**
 * modMetadata 单元测试（插件头 / schema / note 换行）
 * 用法：在 js/mods 下执行  node test/modMetadata.test.js
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const paramTypeKit = require(path.join(__dirname, '../js/mods/modloader/paramTypeKit'));
const createModMetadata = require(path.join(__dirname, '../js/mods/modloader/modMetadata'));
const createParamValues = require(path.join(__dirname, '../js/mods/modloader/paramValues'));
const createDependencyResolver = require(path.join(__dirname, '../js/mods/modloader/dependencyResolver'));

const FIXTURES = path.join(__dirname, 'fixtures');
const logs = [];

const { parseDependencyList } = createDependencyResolver({
    fs,
    log: () => {},
    t: (key) => key,
    pluginsPath: path.join(FIXTURES, 'dependencyResolver-plugins-fixture.js')
});

const modMetadataDeps = {
    fs,
    pathMod: path,
    paramTypeKit,
    log: (...args) => logs.push(args),
    t: (key) => key,
    parseDependencyList,
    resolveModConfigEntry: (config, modId) => config[modId],
    normalizeSingleParamValue: null
};
const meta = createModMetadata(modMetadataDeps);
const paramValues = createParamValues({
    paramTypeKit,
    normalizeNoteNewlines: (...args) => meta.normalizeNoteNewlines(...args),
    normalizeNoteFieldsInStructParam: (...args) => meta.normalizeNoteFieldsInStructParam(...args)
});
modMetadataDeps.normalizeSingleParamValue = paramValues.normalizeSingleParamValue;

function test(name, fn) {
    try {
        fn();
        console.log('  ok  ' + name);
    } catch (e) {
        console.error(' FAIL ' + name);
        throw e;
    }
}

console.log('modMetadata.test.js');

test('parseModInfo basic param types', () => {
    const info = meta.parseModInfo(path.join(FIXTURES, 'modMetadata-basic-params.js'));
    assert.strictEqual(info.version, 'V1.0.0');
    assert.strictEqual(info.params.length, 6);

    const flag = info.params.find((p) => p.name === 'flag');
    assert.strictEqual(flag.type, 'boolean');
    assert.strictEqual(flag.default, 'true');

    const count = info.params.find((p) => p.name === 'count');
    assert.strictEqual(count.min, 0);
    assert.strictEqual(count.max, 100);
    assert.strictEqual(count.step, 5);

    const memo = info.params.find((p) => p.name === 'memo');
    assert.strictEqual(memo.default, '第一行\n第二行');
});

test('parseModInfo schema struct/table defaults', () => {
    const info = meta.parseModInfo(path.join(FIXTURES, 'modMetadata-schema-mod.js'));
    const pos = info.params.find((p) => p.name === 'pos');
    assert.strictEqual(pos.type, 'struct');
    assert.ok(Array.isArray(pos.schemaFields));
    assert.strictEqual(pos.schemaFields.length, 2);
    assert.strictEqual(pos.schemaFields[0].name, 'x');
    assert.strictEqual(pos.schemaFields[1].name, 'y');

    const parsedDefault = JSON.parse(pos.default);
    assert.strictEqual(parsedDefault.x, '0');
    assert.strictEqual(parsedDefault.y, '0');

    const rows = info.params.find((p) => p.name === 'rows');
    assert.strictEqual(rows.type, 'table');
    assert.strictEqual(rows.default, '[]');
    assert.ok(Array.isArray(rows.schemaFields));
    assert.strictEqual(rows.schemaFields.length, 2);
    assert.strictEqual(rows.schemaFields[1].type, 'note');
    assert.strictEqual(rows.schemaFields[1].default, '行1\n行2');
});

test('parseModInfo schema isolation per file', () => {
    const pathA = path.join(FIXTURES, 'modMetadata-schema-mod.js');
    const pathB = path.join(FIXTURES, 'modMetadata-schema-mod-b.js');

    const infoB = meta.parseModInfo(pathB);
    const posB = infoB.params.find((p) => p.name === 'pos');
    assert.strictEqual(posB.schemaFields.length, 1);
    assert.strictEqual(posB.schemaFields[0].name, 'z');
    assert.strictEqual(JSON.parse(posB.default).z, '99');

    const infoA = meta.parseModInfo(pathA);
    const posA = infoA.params.find((p) => p.name === 'pos');
    assert.strictEqual(posA.schemaFields.length, 2);
    assert.strictEqual(posA.schemaFields[0].name, 'x');
    assert.strictEqual(posA.schemaFields[1].name, 'y');
});

test('parseModInfo strict lock without @default', () => {
    const info = meta.parseModInfo(path.join(FIXTURES, 'modMetadata-missing-default.js'));
    assert.strictEqual(info.params.length, 0);
});

test('parseModInfo dependency lists', () => {
    const info = meta.parseModInfo(path.join(FIXTURES, 'modMetadata-dependencies.js'));
    assert.deepStrictEqual(info.baseList, ['CorePlugin', 'OtherMod']);
    assert.deepStrictEqual(info.orderAfterList, ['First', 'Second']);
    assert.strictEqual(info.orderBefore, 'LaterMod');
});

test('normalizeNoteNewlines', () => {
    assert.strictEqual(meta.normalizeNoteNewlines('a\\nb'), 'a\nb');
    assert.strictEqual(meta.normalizeNoteNewlines('already\nreal'), 'already\nreal');
});

test('applyModConfigToEntry clamps number and note', () => {
    const filePath = path.join(FIXTURES, 'modMetadata-basic-params.js');
    const entry = meta.applyModConfigToEntry(
        'local:test:basic',
        filePath,
        'basic-params.js',
        'Basic',
        {
            'local:test:basic': {
                status: true,
                params: {
                    count: '999',
                    memo: 'saved\\nline'
                }
            }
        },
        1,
        'basic'
    );
    assert.strictEqual(entry.status, true);
    assert.strictEqual(entry.currentParams.count, '100');
    assert.strictEqual(entry.currentParams.memo, 'saved\nline');
});

test('applyModConfigToEntry matches buildModFinalParameters (config load vs runtime)', () => {
    const filePath = path.join(FIXTURES, 'modMetadata-basic-params.js');
    const rawParams = {
        count: '999',
        memo: '行1\\n<script>x</script>行2',
        mode: 'hello<script>x</script>'
    };
    const entry = meta.applyModConfigToEntry(
        'local:test:basic',
        filePath,
        'basic-params.js',
        'Basic',
        { 'local:test:basic': { status: true, params: rawParams } },
        1,
        'basic'
    );
    const fromRuntimePath = paramValues.buildModFinalParameters({
        params: entry.params,
        currentParams: rawParams
    });
    assert.deepStrictEqual(entry.currentParams, fromRuntimePath);
    assert.strictEqual(entry.currentParams.memo, '行1\n行2');
    assert.strictEqual(entry.currentParams.mode, 'hello');
});

console.log('All modMetadata tests passed.');
