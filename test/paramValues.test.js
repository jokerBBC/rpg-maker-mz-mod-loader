/**
 * paramValues 单元测试（buildModFinalParameters / 编辑器保存路径一致）
 * 用法：在 js/mods 下执行  node test/paramValues.test.js
 */
'use strict';

const assert = require('assert');
const path = require('path');

const paramTypeKit = require(path.join(__dirname, '../js/mods/modloader/paramTypeKit'));
const createParamValues = require(path.join(__dirname, '../js/mods/modloader/paramValues'));

function test(name, fn) {
    try {
        fn();
        console.log('  ok  ' + name);
    } catch (e) {
        console.error(' FAIL ' + name);
        throw e;
    }
}

console.log('paramValues.test.js');

function normalizeNoteNewlines(text) {
    if (text == null || typeof text !== 'string') return text;
    return text.replace(/\\n/g, '\n');
}

function normalizeNoteFieldsInStructParam(value, schemaFields) {
    if (value == null || value === '') return value;
    const wasString = typeof value === 'string';
    let obj;
    try {
        obj = wasString ? JSON.parse(value) : value;
    } catch (e) {
        return value;
    }
    if (!obj || typeof obj !== 'object') return value;
    if (Array.isArray(schemaFields)) {
        schemaFields.forEach((field) => {
            if (field && field.name && (field.type === 'note' || field.type === 'multiline_string')) {
                if (Object.prototype.hasOwnProperty.call(obj, field.name)) {
                    obj[field.name] = normalizeNoteNewlines(String(obj[field.name]));
                }
            }
        });
    }
    return wasString ? JSON.stringify(obj) : obj;
}

const pv = createParamValues({
    paramTypeKit,
    normalizeNoteNewlines,
    normalizeNoteFieldsInStructParam
});

const sampleParams = [
    { name: 'count', type: 'number', default: '10', min: 0, max: 100 },
    { name: 'tint', type: 'color', default: '#ff0000' },
    { name: 'memo', type: 'note', default: '默认' },
    { name: 'actorId', type: 'actor', default: '1' },
    {
        name: 'pos',
        type: 'struct',
        default: '{"x":"0","y":"0"}',
        schemaFields: [
            { name: 'x', type: 'number', default: '0' },
            { name: 'note', type: 'note', default: 'a\\nb' }
        ]
    },
    { name: 'rows', type: 'table', default: '[]' },
    { name: 'label', type: 'string', default: 'ok' }
];

test('buildModFinalParameters number clamp', () => {
    const mod = {
        params: [sampleParams[0]],
        currentParams: { count: '999' }
    };
    assert.strictEqual(pv.buildModFinalParameters(mod).count, '100');
});

test('buildModFinalParameters invalid number uses default', () => {
    const mod = {
        params: [sampleParams[0]],
        currentParams: { count: 'abc' }
    };
    assert.strictEqual(pv.buildModFinalParameters(mod).count, '10');
});

test('buildModFinalParameters color validation', () => {
    const mod = {
        params: [sampleParams[1]],
        currentParams: { tint: 'not-a-color' }
    };
    assert.strictEqual(pv.buildModFinalParameters(mod).tint, '#ff0000');
    mod.currentParams.tint = '#00ff00';
    assert.strictEqual(pv.buildModFinalParameters(mod).tint, '#00ff00');
});

test('buildModFinalParameters note \\n and sanitize', () => {
    const mod = {
        params: [sampleParams[2]],
        currentParams: { memo: '行1\\n<script>x</script>行2' }
    };
    const out = pv.buildModFinalParameters(mod).memo;
    assert.strictEqual(out, '行1\n行2');
    assert.ok(!out.includes('<script>'));
});

test('buildModFinalParameters database type stringifies', () => {
    const mod = {
        params: [sampleParams[3]],
        currentParams: { actorId: 5 }
    };
    assert.strictEqual(pv.buildModFinalParameters(mod).actorId, '5');
});

test('buildModFinalParameters struct note normalization', () => {
    const mod = {
        params: [sampleParams[4]],
        currentParams: { pos: '{"x":"1","note":"a\\nb"}' }
    };
    const parsed = JSON.parse(pv.buildModFinalParameters(mod).pos);
    assert.strictEqual(parsed.x, '1');
    assert.strictEqual(parsed.note, 'a\nb');
});

test('buildModFinalParameters empty uses default', () => {
    const mod = {
        params: [sampleParams[0]],
        currentParams: { count: '' }
    };
    assert.strictEqual(pv.buildModFinalParameters(mod).count, '10');
});

test('buildFinalParametersFromValues matches runtime path for note', () => {
    const edit = { memo: 'a\\nb' };
    const fromEdit = pv.buildFinalParametersFromValues([sampleParams[2]], edit);
    const fromRuntime = pv.buildModFinalParameters({
        params: [sampleParams[2]],
        currentParams: edit
    });
    assert.strictEqual(fromEdit.memo, fromRuntime.memo);
    assert.strictEqual(fromEdit.memo, 'a\nb');
});

test('buildFinalParametersFromValues struct/table passthrough', () => {
    const values = {
        pos: '{"x":"2","note":"z"}',
        rows: '[{"id":"1"}]'
    };
    const out = pv.buildFinalParametersFromValues(
        [sampleParams[4], sampleParams[5]],
        values
    );
    assert.strictEqual(out.pos, values.pos);
    assert.strictEqual(out.rows, values.rows);
});

test('buildFinalParametersFromValues text sanitize', () => {
    const out = pv.buildFinalParametersFromValues(
        [sampleParams[6]],
        { label: 'hello<script>x</script>' }
    );
    assert.strictEqual(out.label, 'hello');
});

test('normalizeNumberField matches number param pipe', () => {
    assert.strictEqual(pv.normalizeNumberField('999', { min: 0, max: 100, fallback: '10' }), '100');
    assert.strictEqual(pv.normalizeNumberField('abc', { fallback: '10' }), '10');
    assert.strictEqual(pv.normalizeNumberField('', { fallback: '10' }), '10');
});

test('normalizeColorField rejects invalid', () => {
    assert.strictEqual(pv.normalizeColorField('bad', '#ff0000'), '#ff0000');
    assert.strictEqual(pv.normalizeColorField('#00ff00', '#ff0000'), '#00ff00');
});

test('normalizeTextField sanitizes', () => {
    assert.strictEqual(pv.normalizeTextField('a<script>x</script>b', ''), 'ab');
});

console.log('All paramValues tests passed.');
