/**
 * installClassifier 单元测试
 * 用法：在 js/mods 下执行  node test/installClassifier.test.js
 */
'use strict';

const assert = require('assert');
const path = require('path');

const createInstallClassifier = require(path.join(__dirname, '../js/mods/modloader/installClassifier'));

const ic = createInstallClassifier({ pathMod: path });

function test(name, fn) {
    try {
        fn();
        console.log('  ok  ' + name);
    } catch (e) {
        console.error(' FAIL ' + name);
        throw e;
    }
}

function mockFile(name, opts) {
    return {
        name,
        path: opts && opts.path,
        webkitRelativePath: opts && opts.webkitRelativePath
    };
}

console.log('installClassifier.test.js');

test('analyze: empty → reject empty', () => {
    const r = ic.analyzeInstallItems([]);
    assert.strictEqual(r.action, 'reject');
    assert.strictEqual(r.reason, 'empty');
});

test('analyze: single mods directory → mods-folder', () => {
    const r = ic.analyzeInstallItems([{ kind: 'directory', name: 'mods' }]);
    assert.strictEqual(r.action, 'mods-folder');
});

test('analyze: single non-mods directory → not-mods-folder', () => {
    const r = ic.analyzeInstallItems([{ kind: 'directory', name: 'MyModPack' }]);
    assert.strictEqual(r.action, 'reject');
    assert.strictEqual(r.reason, 'not-mods-folder');
    assert.strictEqual(r.folderName, 'MyModPack');
});

test('analyze: js + png → js-files with ignored', () => {
    const items = [
        { kind: 'file', name: 'a.js', file: mockFile('a.js') },
        { kind: 'file', name: 'pic.png', file: mockFile('pic.png') }
    ];
    const r = ic.analyzeInstallItems(items);
    assert.strictEqual(r.action, 'js-files');
    assert.strictEqual(r.jsItems.length, 1);
    assert.deepStrictEqual(r.ignored.files, ['pic.png']);
});

test('analyze: only png → reject no-js with ignored', () => {
    const r = ic.analyzeInstallItems([
        { kind: 'file', name: 'pic.png', file: mockFile('pic.png') }
    ]);
    assert.strictEqual(r.action, 'reject');
    assert.strictEqual(r.reason, 'no-js');
    assert.deepStrictEqual(r.ignored.files, ['pic.png']);
});

test('analyze: js + non-mods folder → js-files, folder ignored', () => {
    const r = ic.analyzeInstallItems([
        { kind: 'file', name: 'a.js', file: mockFile('a.js') },
        { kind: 'directory', name: 'Other' }
    ]);
    assert.strictEqual(r.action, 'js-files');
    assert.deepStrictEqual(r.ignored.folders, ['Other']);
});

test('normalizeDrag: flat js files from fallback', () => {
    const items = ic.normalizeDragItems([], [
        mockFile('a.js', { path: 'C:\\Desktop\\a.js' }),
        mockFile('b.js', { path: 'C:\\Desktop\\b.js' })
    ]);
    assert.strictEqual(items.length, 2);
    assert.strictEqual(items[0].kind, 'file');
});

test('normalizeDrag: single folder drag via webkitRelativePath', () => {
    const items = ic.normalizeDragItems([], [
        mockFile('a.js', { webkitRelativePath: 'MyMod\\a.js' })
    ]);
    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].kind, 'directory');
    assert.strictEqual(items[0].name, 'MyMod');
});

test('normalizeDrag: mods folder via path marker', () => {
    const items = ic.normalizeDragItems([], [
        mockFile('a.js', { path: 'D:\\game\\mods\\a.js' })
    ]);
    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].kind, 'mods-folder');
});

test('resolveModsFolderSrcDir: from srcDir', () => {
    assert.strictEqual(
        ic.resolveModsFolderSrcDir({ srcDir: 'C:\\mods' }),
        'C:\\mods'
    );
});

test('normalizeDrag: directory item enriched from dataTransferFiles', () => {
    const fakeItems = [{
        getAsEntry: () => ({ isDirectory: true, name: 'mods' }),
        kind: 'file'
    }];
    const dtFiles = [mockFile('a.js', { path: 'D:\\game\\mods\\a.js' })];
    const normalized = ic.normalizeDragItems(fakeItems, dtFiles);
    assert.strictEqual(normalized.length, 1);
    assert.strictEqual(normalized[0].kind, 'mods-folder');
    assert.ok(normalized[0].files && normalized[0].files.length === 1);
    const decision = ic.analyzeInstallItems(normalized);
    assert.strictEqual(decision.action, 'mods-folder');
    assert.strictEqual(ic.resolveModsFolderSrcDir(decision.folder), 'D:\\game\\mods');
});

console.log('all passed');
