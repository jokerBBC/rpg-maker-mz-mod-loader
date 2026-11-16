/**
 * dependencyResolver 单元测试（解析 / 五态 / 加载守卫）
 * 用法：在 js/mods 下执行  node test/dependencyResolver.test.js
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const createDependencyResolver = require(path.join(__dirname, '../js/mods/modloader/dependencyResolver'));

const FIXTURES = path.join(__dirname, 'fixtures');

function test(name, fn) {
    try {
        fn();
        console.log('  ok  ' + name);
    } catch (e) {
        console.error(' FAIL ' + name);
        throw e;
    }
}

console.log('dependencyResolver.test.js');

const resolver = createDependencyResolver({
    fs,
    log: () => {},
    t: (key) => key,
    pluginsPath: path.join(FIXTURES, 'dependencyResolver-plugins-fixture.js')
});

const {
    DEP_STATUS,
    parseDependencyList,
    getGamePluginInfo,
    buildModLookup,
    checkSingleDep,
    checkModDependencies,
    isBaseLoadGuardSatisfied
} = resolver;

const PARSE_CASES = [
    ['', []],
    ['   ', []],
    ['PluginOne.js', ['PluginOne']],
    ['界面UI', ['界面UI']],
    ['PluginOne.js（确保放在它后面）', ['PluginOne']],
    ['PluginOne.js（说明） OtherMod', ['PluginOne', 'OtherMod']],
    ['A.js B C.js D', ['A', 'B', 'C', 'D']],
    ['Dup.js Dup.js', ['Dup']],
    [null, []]
];

PARSE_CASES.forEach(([input, expected]) => {
    test('parseDependencyList: ' + JSON.stringify(input), () => {
        assert.deepStrictEqual(parseDependencyList(input), expected);
    });
});

test('getGamePluginInfo reads fixture plugins.js', () => {
    const info = getGamePluginInfo();
    assert.strictEqual(info.get('CorePlugin').enabled, true);
    assert.strictEqual(info.get('DisabledPlugin').enabled, false);
    assert.strictEqual(info.get('PathPlugin').enabled, true);
});

test('checkSingleDep game plugin pass', () => {
    const gamePlugins = new Map([['CorePlugin', { enabled: true }]]);
    const modLookup = {};
    const result = checkSingleDep('CorePlugin', 1, gamePlugins, modLookup);
    assert.strictEqual(result.status, DEP_STATUS.PASS);
});

test('checkSingleDep game plugin disabled', () => {
    const gamePlugins = new Map([['DisabledPlugin', { enabled: false }]]);
    const result = checkSingleDep('DisabledPlugin', 0, gamePlugins, {});
    assert.strictEqual(result.status, DEP_STATUS.GAME_DISABLED);
    assert.ok(result.message.includes('dep.gameDisabled'));
});

test('checkSingleDep mod not found', () => {
    const result = checkSingleDep('Ghost', 0, new Map(), {});
    assert.strictEqual(result.status, DEP_STATUS.NOT_FOUND);
});

test('checkSingleDep mod disabled', () => {
    const modList = [{
        id: 'local:p:Off',
        fileName: 'Off.js',
        status: false,
        baseList: [],
        orderAfterList: []
    }];
    const modLookup = buildModLookup(modList);
    const result = checkSingleDep('Off', 1, new Map(), modLookup);
    assert.strictEqual(result.status, DEP_STATUS.MOD_DISABLED);
});

test('checkSingleDep wrong order', () => {
    const modList = [
        { id: 'local:p:A', fileName: 'A.js', status: true },
        { id: 'local:p:B', fileName: 'B.js', status: true }
    ];
    const modLookup = buildModLookup(modList);
    const result = checkSingleDep('B', 0, new Map(), modLookup);
    assert.strictEqual(result.status, DEP_STATUS.WRONG_ORDER);
});

test('checkModDependencies five-state matrix from fixture mod list', () => {
    const modList = JSON.parse(
        fs.readFileSync(path.join(FIXTURES, 'dependencyResolver-mod-list.json'), 'utf-8')
    );
    const results = checkModDependencies(modList);

    const baseMod = results['local:pkg:BaseMod'];
    assert.strictEqual(baseMod.baseWarning, false);
    assert.strictEqual(baseMod.baseDetails[0].status, DEP_STATUS.PASS);

    const childMod = results['local:pkg:ChildMod'];
    assert.strictEqual(childMod.baseWarning, false);
    assert.strictEqual(childMod.orderAfterWarning, false);

    const needsDisabled = results['local:pkg:NeedsDisabled'];
    assert.strictEqual(needsDisabled.baseWarning, true);
    assert.strictEqual(needsDisabled.baseDetails[0].status, DEP_STATUS.MOD_DISABLED);

    const wrongOrder = results['local:pkg:WrongOrder'];
    assert.strictEqual(wrongOrder.orderAfterWarning, true);
    assert.strictEqual(wrongOrder.orderAfterDetails[0].status, DEP_STATUS.WRONG_ORDER);

    const missingBase = results['local:pkg:MissingBase'];
    assert.strictEqual(missingBase.baseWarning, true);
    assert.strictEqual(missingBase.baseDetails[0].status, DEP_STATUS.NOT_FOUND);

    const gameDisabled = results['local:pkg:GameDisabled'];
    assert.strictEqual(gameDisabled.baseWarning, true);
    assert.strictEqual(gameDisabled.baseDetails[0].status, DEP_STATUS.GAME_DISABLED);
});

test('isBaseLoadGuardSatisfied loaded script', () => {
    const guard = isBaseLoadGuardSatisfied(['CorePlugin'], ['CorePlugin'], []);
    assert.strictEqual(guard.satisfied, true);
    assert.strictEqual(guard.missingBase, null);
});

test('isBaseLoadGuardSatisfied pending queue', () => {
    const guard = isBaseLoadGuardSatisfied(['BaseMod'], [], ['BaseMod', 'ChildMod']);
    assert.strictEqual(guard.satisfied, true);
});

test('isBaseLoadGuardSatisfied missing base', () => {
    const guard = isBaseLoadGuardSatisfied(['Missing'], [], ['OtherMod']);
    assert.strictEqual(guard.satisfied, false);
    assert.strictEqual(guard.missingBase, 'Missing');
});

console.log('All dependencyResolver tests passed.');
