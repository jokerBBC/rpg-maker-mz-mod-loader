/**
 * modPresets 单元测试
 * 用法：在 js/mods 下执行  node test/modPresets.test.js
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const createModPresets = require(path.join(__dirname, '../js/mods/modloader/modPresets'));

const logs = [];
let tmpRoot;
let presetsDir;
let mp;

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

function setup() {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ml-presets-'));
    presetsDir = path.join(tmpRoot, 'mod_presets');
    mp = createModPresets({
        fs: fs,
        pathMod: path,
        log: function() { logs.push(Array.prototype.slice.call(arguments)); },
        presetsDir: presetsDir,
        resolvePackageVersion: function(mod) {
            return mod && mod.version != null ? mod.version : null;
        },
        getPackageDisplayName: function(mod) {
            return mod.displayName || mod.id;
        }
    });
}

function teardown() {
    try {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch (e) { /* ignore */ }
}

console.log('modPresets.test.js');
setup();

test('sanitizePresetFileBase rejects empty and path chars', () => {
    assert.strictEqual(mp.sanitizePresetFileBase(''), null);
    assert.strictEqual(mp.sanitizePresetFileBase('  '), null);
    assert.strictEqual(mp.sanitizePresetFileBase('../x'), 'x');
    assert.ok(mp.sanitizePresetFileBase('刷本周本'));
});

test('savePreset + listPresets + loadPreset roundtrip', () => {
    const list = [
        { id: 'local:A:A', status: true, order: 1, currentParams: { x: '1' }, version: '1.0.0', displayName: 'A' },
        { id: 'local:B:B', status: false, order: 2, currentParams: {}, version: null, displayName: 'B' }
    ];
    const saved = mp.savePreset('周本', list);
    assert.strictEqual(saved.ok, true);
    const listed = mp.listPresets();
    assert.strictEqual(listed.length, 1);
    assert.strictEqual(listed[0].name, '周本');
    assert.strictEqual(listed[0].enabledCount, 1);
    assert.ok(listed[0].savedAt);
    const loaded = mp.loadPreset(saved.fileBase);
    assert.strictEqual(loaded.mods['local:A:A'].status, true);
    assert.strictEqual(loaded.mods['local:A:A'].version, '1.0.0');
    assert.strictEqual(loaded.mods['local:B:B'].version, null);
});

test('listPresets sorts by savedAt newest first', () => {
    const list = [{ id: 'local:A:A', status: true, order: 1, currentParams: {}, version: '1', displayName: 'A' }];
    const older = mp.savePreset('older', list);
    assert.strictEqual(older.ok, true);
    const olderPath = path.join(presetsDir, older.fileBase + '.json');
    const olderDoc = JSON.parse(fs.readFileSync(olderPath, 'utf-8'));
    olderDoc.savedAt = '2020-01-01T00:00:00.000Z';
    fs.writeFileSync(olderPath, JSON.stringify(olderDoc, null, 2), 'utf-8');

    const newer = mp.savePreset('newer', list);
    assert.strictEqual(newer.ok, true);
    const newerPath = path.join(presetsDir, newer.fileBase + '.json');
    const newerDoc = JSON.parse(fs.readFileSync(newerPath, 'utf-8'));
    newerDoc.savedAt = '2025-06-15T12:00:00.000Z';
    fs.writeFileSync(newerPath, JSON.stringify(newerDoc, null, 2), 'utf-8');

    const listed = mp.listPresets().filter(function (p) {
        return p.fileBase === 'older' || p.fileBase === 'newer';
    });
    assert.strictEqual(listed.length, 2);
    assert.strictEqual(listed[0].fileBase, 'newer');
    assert.strictEqual(listed[1].fileBase, 'older');
});

test('buildPresetDiff: willEnable missing + willClose notInPreset/inPresetOff', () => {
    const preset = {
        name: 't',
        mods: {
            'local:A:A': { status: true, order: 40, params: {}, version: '1.0.0' },
            'local:B:B': { status: true, order: 41, params: {}, version: '2.0' },
            'local:Gone:G': { status: true, order: 42, params: {}, version: '9' },
            'local:E:E': { status: false, order: 1, params: {}, version: '1' }
        }
    };
    const current = [
        { id: 'local:X:X', status: true, order: 1, version: '1', displayName: 'X' },
        { id: 'local:E:E', status: true, order: 2, version: '1', displayName: 'E' },
        { id: 'local:A:A', status: false, order: 3, version: '1.1.0', displayName: 'A' },
        { id: 'local:B:B', status: true, order: 4, version: '2.0', displayName: 'B' }
    ];
    const diff = mp.buildPresetDiff(preset, current, { unknownVersion: '未知版本' });

    assert.strictEqual(diff.willEnableCount, 3);
    assert.strictEqual(diff.missingCount, 1);
    assert.strictEqual(diff.willEnable[0].id, 'local:A:A');
    assert.strictEqual(diff.willEnable[1].id, 'local:B:B');
    assert.strictEqual(diff.willEnable[2].missing, true);
    assert.strictEqual(diff.willEnable[0].versionChanged, true);

    assert.strictEqual(diff.willCloseCount, 2);
    const closeE = diff.willClose.find(function(r) { return r.id === 'local:E:E'; });
    const closeX = diff.willClose.find(function(r) { return r.id === 'local:X:X'; });
    assert.ok(closeE);
    assert.strictEqual(closeE.notInPreset, false);
    assert.ok(closeX);
    assert.strictEqual(closeX.notInPreset, true);
});

test('applyPresetToModList: close not-in-preset + reorder by preset order', () => {
    const preset = {
        mods: {
            'local:A:A': { status: true, order: 40, params: { k: 'a' }, version: '1' },
            'local:B:B': { status: true, order: 41, params: { k: 'b' }, version: '1' },
            'local:E:E': { status: false, order: 1, params: {}, version: '1' },
            'local:Missing:M': { status: true, order: 99, params: {}, version: null }
        }
    };
    const list = [
        { id: 'local:X:X', status: true, order: 1, currentParams: {}, displayName: 'X' },
        { id: 'local:E:E', status: true, order: 2, currentParams: {}, displayName: 'E' },
        { id: 'local:A:A', status: false, order: 3, currentParams: {}, displayName: 'A' },
        { id: 'local:B:B', status: true, order: 4, currentParams: {}, displayName: 'B' },
        { id: 'local:Y:Y', status: false, order: 5, currentParams: {}, displayName: 'Y' }
    ];
    const result = mp.applyPresetToModList(preset, list);
    assert.strictEqual(result.applied, 3);
    assert.strictEqual(result.skippedMissing, 1);
    assert.strictEqual(result.closedNotInPreset, 1);

    assert.strictEqual(list[0].id, 'local:E:E');
    assert.strictEqual(list[0].status, false);
    assert.strictEqual(list[0].order, 1);

    assert.strictEqual(list[1].id, 'local:A:A');
    assert.strictEqual(list[1].status, true);
    assert.strictEqual(list[1].order, 2);
    assert.strictEqual(list[1].currentParams.k, 'a');

    assert.strictEqual(list[2].id, 'local:B:B');
    assert.strictEqual(list[2].status, true);
    assert.strictEqual(list[2].order, 3);

    const x = list.find(function(m) { return m.id === 'local:X:X'; });
    assert.strictEqual(x.status, false);
    assert.ok(x.order > 3);

    const enabledOrders = list.filter(function(m) { return m.status; }).map(function(m) { return m.order; });
    assert.deepStrictEqual(enabledOrders, [2, 3]);
});

test('apply A→B style: enabled keep high order slots after full-list sort', () => {
    const mods = {};
    const list = [];
    for (let i = 1; i <= 39; i++) {
        const id = 'local:Filler' + i + ':F';
        mods[id] = { status: false, order: i, params: {}, version: null };
        list.push({ id: id, status: true, order: i, currentParams: {}, displayName: 'F' + i });
    }
    mods['local:TargetA:A'] = { status: true, order: 40, params: {}, version: '1' };
    mods['local:TargetB:B'] = { status: true, order: 41, params: {}, version: '1' };
    list.push(
        { id: 'local:TargetA:A', status: false, order: 5, currentParams: {}, displayName: 'A' },
        { id: 'local:TargetB:B', status: false, order: 6, currentParams: {}, displayName: 'B' }
    );

    mp.applyPresetToModList({ mods: mods }, list);

    assert.strictEqual(list[39].id, 'local:TargetA:A');
    assert.strictEqual(list[40].id, 'local:TargetB:B');
    assert.strictEqual(list[39].status, true);
    assert.strictEqual(list[40].status, true);
    assert.strictEqual(list[39].order, 40);
    assert.strictEqual(list[40].order, 41);
    assert.strictEqual(list.filter(function(m) { return m.status; }).length, 2);
    assert.strictEqual(list[0].status, false);
});

/**
 * 完整对照：乱序当前列表 × 预设 A/B
 * - 预设启用 / 关闭
 * - 游戏中不存在（预设有、列表无）
 * - 预设中不存在（列表新增已开）
 * - 版本变更文案
 * - A→B→A 双向应用后启用集与相对顺序正确
 */
test('full matrix: scrambled list, missing, new, A↔B roundtrip + diff labels', () => {
    const unknown = '未知版本';

    const presetA = {
        name: '测试A',
        mods: {
            'local:Core:C': { status: true, order: 1, params: { mode: 'a' }, version: '1.0.0' },
            'local:Farm:F': { status: true, order: 2, params: { n: '1' }, version: '2.0.0' },
            'local:OldGone:G': { status: true, order: 3, params: {}, version: '0.9' },
            'local:Idle:I': { status: false, order: 4, params: {}, version: '1.0' },
            'local:Shared:S': { status: true, order: 5, params: { s: 'a' }, version: '3.0' }
        }
    };

    const presetB = {
        name: '测试B',
        mods: {
            'local:Idle:I': { status: false, order: 1, params: {}, version: '1.0' },
            'local:Shared:S': { status: true, order: 2, params: { s: 'b' }, version: '3.1' },
            'local:Boss:B': { status: true, order: 3, params: { hard: '1' }, version: null },
            'local:Core:C': { status: false, order: 4, params: { mode: 'b' }, version: '1.0.0' },
            'local:Farm:F': { status: true, order: 5, params: { n: '9' }, version: '2.0.0' },
            'local:LegacyOnly:L': { status: true, order: 6, params: {}, version: '1.0' }
        }
    };

    // 当前游戏列表：顺序全乱；含新增 NewOn/NewOff；缺 OldGone 与 LegacyOnly
    function makeScrambledCurrent() {
        return [
            { id: 'local:NewOn:N', status: true, order: 99, currentParams: {}, version: '1', displayName: 'NewOn' },
            { id: 'local:Farm:F', status: false, order: 7, currentParams: { n: '0' }, version: '2.1.0', displayName: 'Farm' },
            { id: 'local:Shared:S', status: true, order: 3, currentParams: { s: 'now' }, version: '3.0', displayName: 'Shared' },
            { id: 'local:Boss:B', status: false, order: 1, currentParams: {}, version: 'V1.0.0', displayName: 'Boss' },
            { id: 'local:Idle:I', status: true, order: 50, currentParams: {}, version: '1.0', displayName: 'Idle' },
            { id: 'local:NewOff:Z', status: false, order: 8, currentParams: {}, version: null, displayName: 'NewOff' },
            { id: 'local:Core:C', status: true, order: 2, currentParams: { mode: 'cur' }, version: '1.0.0', displayName: 'Core' }
        ];
    }

    // --- diff vs 预设 A ---
    const diffA = mp.buildPresetDiff(presetA, makeScrambledCurrent(), { unknownVersion: unknown });
    assert.strictEqual(diffA.willEnableCount, 4); // Core, Farm, OldGone, Shared
    assert.strictEqual(diffA.missingCount, 1);
    assert.strictEqual(diffA.willEnable.map(function(r) { return r.id; }).join(','),
        'local:Core:C,local:Farm:F,local:OldGone:G,local:Shared:S');
    const gone = diffA.willEnable.find(function(r) { return r.id === 'local:OldGone:G'; });
    assert.strictEqual(gone.missing, true);
    assert.strictEqual(gone.presetVersionLabel, '0.9');

    const farmA = diffA.willEnable.find(function(r) { return r.id === 'local:Farm:F'; });
    assert.strictEqual(farmA.versionChanged, true);
    assert.strictEqual(farmA.presetVersionLabel, '2.0.0');
    assert.strictEqual(farmA.currentVersionLabel, '2.1.0');

    // 将关闭：Idle(预设关)、NewOn(预设中不存在)；Core/Shared 仍开不进关闭
    assert.strictEqual(diffA.willCloseCount, 2);
    const closeIdle = diffA.willClose.find(function(r) { return r.id === 'local:Idle:I'; });
    const closeNew = diffA.willClose.find(function(r) { return r.id === 'local:NewOn:N'; });
    assert.ok(closeIdle && closeIdle.notInPreset === false);
    assert.ok(closeNew && closeNew.notInPreset === true);

    // --- diff vs 预设 B ---
    const diffB = mp.buildPresetDiff(presetB, makeScrambledCurrent(), { unknownVersion: unknown });
    assert.strictEqual(diffB.willEnableCount, 4); // Shared, Boss, Farm, LegacyOnly
    assert.strictEqual(diffB.missingCount, 1);
    assert.strictEqual(diffB.willEnable[0].id, 'local:Shared:S');
    assert.strictEqual(diffB.willEnable[1].id, 'local:Boss:B');
    assert.strictEqual(diffB.willEnable[2].id, 'local:Farm:F');
    assert.strictEqual(diffB.willEnable[3].missing, true);
    assert.strictEqual(diffB.willEnable[3].id, 'local:LegacyOnly:L');

    const boss = diffB.willEnable.find(function(r) { return r.id === 'local:Boss:B'; });
    assert.strictEqual(boss.presetVersionLabel, unknown);
    assert.strictEqual(boss.currentVersionLabel, 'V1.0.0');

    // 将关闭：Core(预设关)、Idle(预设关)、NewOn(不在预设)
    assert.strictEqual(diffB.willCloseCount, 3);
    assert.ok(diffB.willClose.some(function(r) { return r.id === 'local:Core:C' && !r.notInPreset; }));
    assert.ok(diffB.willClose.some(function(r) { return r.id === 'local:Idle:I' && !r.notInPreset; }));
    assert.ok(diffB.willClose.some(function(r) { return r.id === 'local:NewOn:N' && r.notInPreset; }));

    // --- 应用 B ---
    const listB = makeScrambledCurrent();
    const appliedB = mp.applyPresetToModList(presetB, listB);
    assert.strictEqual(appliedB.skippedMissing, 1); // LegacyOnly
    assert.strictEqual(appliedB.closedNotInPreset, 1); // NewOn (NewOff already off)

    const byIdB = {};
    listB.forEach(function(m) { byIdB[m.id] = m; });
    assert.strictEqual(byIdB['local:Shared:S'].status, true);
    assert.strictEqual(byIdB['local:Shared:S'].currentParams.s, 'b');
    assert.strictEqual(byIdB['local:Boss:B'].status, true);
    assert.strictEqual(byIdB['local:Farm:F'].status, true);
    assert.strictEqual(byIdB['local:Farm:F'].currentParams.n, '9');
    assert.strictEqual(byIdB['local:Core:C'].status, false);
    assert.strictEqual(byIdB['local:Core:C'].currentParams.mode, 'b');
    assert.strictEqual(byIdB['local:Idle:I'].status, false);
    assert.strictEqual(byIdB['local:NewOn:N'].status, false);
    assert.strictEqual(byIdB['local:NewOff:Z'].status, false);

    // 顺序：预设内按 order，不在预设的垫后
    assert.strictEqual(listB[0].id, 'local:Idle:I');
    assert.strictEqual(listB[1].id, 'local:Shared:S');
    assert.strictEqual(listB[2].id, 'local:Boss:B');
    assert.strictEqual(listB[3].id, 'local:Core:C');
    assert.strictEqual(listB[4].id, 'local:Farm:F');
    assert.strictEqual(listB[1].order, 2);
    assert.strictEqual(listB[2].order, 3);
    assert.strictEqual(listB[4].order, 5);
    const enabledB = listB.filter(function(m) { return m.status; }).map(function(m) { return m.id; });
    assert.deepStrictEqual(enabledB, ['local:Shared:S', 'local:Boss:B', 'local:Farm:F']);

    // --- 再应用 A（B→A）---
    const appliedA = mp.applyPresetToModList(presetA, listB);
    assert.strictEqual(appliedA.skippedMissing, 1); // OldGone
    const byIdA = {};
    listB.forEach(function(m) { byIdA[m.id] = m; });
    assert.strictEqual(byIdA['local:Core:C'].status, true);
    assert.strictEqual(byIdA['local:Core:C'].currentParams.mode, 'a');
    assert.strictEqual(byIdA['local:Farm:F'].status, true);
    assert.strictEqual(byIdA['local:Shared:S'].status, true);
    assert.strictEqual(byIdA['local:Shared:S'].currentParams.s, 'a');
    assert.strictEqual(byIdA['local:Idle:I'].status, false);
    assert.strictEqual(byIdA['local:Boss:B'].status, false); // 不在 A → 关闭
    assert.strictEqual(byIdA['local:NewOn:N'].status, false);

    assert.strictEqual(listB[0].id, 'local:Core:C');
    assert.strictEqual(listB[1].id, 'local:Farm:F');
    assert.strictEqual(listB[2].id, 'local:Idle:I');
    assert.strictEqual(listB[3].id, 'local:Shared:S');
    const enabledA = listB.filter(function(m) { return m.status; }).map(function(m) { return m.id; });
    assert.deepStrictEqual(enabledA, ['local:Core:C', 'local:Farm:F', 'local:Shared:S']);
});

test('deletePreset removes file', () => {
    const saved = mp.savePreset('临时', []);
    assert.strictEqual(mp.deletePreset(saved.fileBase), true);
    assert.strictEqual(mp.loadPreset(saved.fileBase), null);
});

teardown();
console.log('All modPresets tests passed.');
