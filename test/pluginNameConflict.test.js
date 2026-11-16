/**
 * pluginNameConflict 单元测试
 * 用法：node test/pluginNameConflict.test.js
 */
'use strict';

const assert = require('assert');
const {
    extractPluginBaseName,
    resolvePluginNameConflicts,
    wouldModBeEffectiveIfEnabled
} = require('../js/mods/modloader/pluginNameConflict');

function test(name, fn) {
    try {
        fn();
        console.log('  ok  ' + name);
    } catch (e) {
        console.error(' FAIL ' + name);
        throw e;
    }
}

console.log('pluginNameConflict.test.js');

test('extractPluginBaseName from fileName', () => {
    assert.strictEqual(extractPluginBaseName({ fileName: 'Foo.js' }), 'Foo');
});

test('no conflict when unique names', () => {
    const mods = [
        { id: 'local:a:One', fileName: 'One.js', order: 1, status: true, installState: 'ready' },
        { id: 'local:b:Two', fileName: 'Two.js', order: 2, status: true, installState: 'ready' }
    ];
    const out = resolvePluginNameConflicts(mods, new Map());
    assert.deepStrictEqual(out, {});
});

test('game enabled wins over mod', () => {
    const mods = [
        { id: 'local:a:Core', fileName: 'Core.js', order: 1, status: true, installState: 'ready' }
    ];
    const game = new Map([['Core', { enabled: true }]]);
    const out = resolvePluginNameConflicts(mods, game);
    assert.strictEqual(out['local:a:Core'].hasConflict, true);
    assert.strictEqual(out['local:a:Core'].isEffective, false);
    assert.strictEqual(out['local:a:Core'].winnerIsGame, true);
});

test('two mods same base: lower order effective when both on', () => {
    const mods = [
        { id: 'local:a:Shared', fileName: 'Shared.js', order: 21, status: true, installState: 'ready' },
        { id: 'local:b:Shared', fileName: 'Shared.js', order: 42, status: true, installState: 'ready' }
    ];
    const out = resolvePluginNameConflicts(mods, new Map());
    assert.strictEqual(out['local:a:Shared'].isEffective, true);
    assert.strictEqual(out['local:b:Shared'].isEffective, false);
    assert.deepStrictEqual(out['local:a:Shared'].otherModOrders, [42]);
    assert.deepStrictEqual(out['local:b:Shared'].otherModOrders, [21]);
    assert.strictEqual(out['local:b:Shared'].winnerModOrder, 21);
});

test('both off: neither marked effective', () => {
    const mods = [
        { id: 'local:a:Shared', fileName: 'Shared.js', order: 21, status: false, installState: 'ready' },
        { id: 'local:b:Shared', fileName: 'Shared.js', order: 42, status: false, installState: 'ready' }
    ];
    const out = resolvePluginNameConflicts(mods, new Map());
    assert.strictEqual(out['local:a:Shared'].isEffective, false);
    assert.strictEqual(out['local:b:Shared'].isEffective, false);
});

test('only higher order on: that one effective alone', () => {
    const mods = [
        { id: 'local:a:Shared', fileName: 'Shared.js', order: 21, status: false, installState: 'ready' },
        { id: 'local:b:Shared', fileName: 'Shared.js', order: 42, status: true, installState: 'ready' }
    ];
    const out = resolvePluginNameConflicts(mods, new Map());
    assert.strictEqual(out['local:a:Shared'].isEffective, false);
    assert.strictEqual(out['local:b:Shared'].isEffective, true);
});

test('wouldModBeEffectiveIfEnabled: enable 21 while 42 on → 21 wins', () => {
    const mods = [
        { id: 'local:a:Shared', fileName: 'Shared.js', order: 21, status: false, installState: 'ready' },
        { id: 'local:b:Shared', fileName: 'Shared.js', order: 42, status: true, installState: 'ready' }
    ];
    const mod21 = mods[0];
    assert.strictEqual(wouldModBeEffectiveIfEnabled(mod21, mods, new Map()), true);
});

test('wouldModBeEffectiveIfEnabled: enable 42 while 21 on → 42 loses', () => {
    const mods = [
        { id: 'local:a:Shared', fileName: 'Shared.js', order: 21, status: true, installState: 'ready' },
        { id: 'local:b:Shared', fileName: 'Shared.js', order: 42, status: false, installState: 'ready' }
    ];
    const mod42 = mods[1];
    assert.strictEqual(wouldModBeEffectiveIfEnabled(mod42, mods, new Map()), false);
});

test('wouldModBeEffectiveIfEnabled: enable only one when both off → that one wins', () => {
    const mods = [
        { id: 'local:a:Shared', fileName: 'Shared.js', order: 21, status: false, installState: 'ready' },
        { id: 'local:b:Shared', fileName: 'Shared.js', order: 42, status: false, installState: 'ready' }
    ];
    assert.strictEqual(wouldModBeEffectiveIfEnabled(mods[0], mods, new Map()), true);
    assert.strictEqual(wouldModBeEffectiveIfEnabled(mods[1], mods, new Map()), true);
});

test('game disabled: mod can be effective despite game entry', () => {
    const mods = [
        { id: 'local:a:Core', fileName: 'Core.js', order: 1, status: true, installState: 'ready' }
    ];
    const game = new Map([['Core', { enabled: false }]]);
    const out = resolvePluginNameConflicts(mods, game);
    assert.strictEqual(out['local:a:Core'].isEffective, true);
    assert.strictEqual(out['local:a:Core'].winnerIsGame, false);
});

console.log('All pluginNameConflict tests passed.');
