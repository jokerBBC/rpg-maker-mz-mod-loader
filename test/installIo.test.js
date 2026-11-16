/**
 * installIo 单元测试
 * 用法：node test/installIo.test.js
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const createInstallIo = require(path.join(__dirname, '../js/mods/modloader/installIo'));

function test(name, fn) {
    try {
        fn();
        console.log('  ok  ' + name);
    } catch (e) {
        console.error(' FAIL ' + name);
        throw e;
    }
}

console.log('installIo.test.js');

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ml-installio-'));
const io = createInstallIo({
    fs,
    pathMod: path,
    log: () => {},
    ensureDir: (dir) => {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }
});

test('copyFolderRecursive copies tree', () => {
    const src = path.join(tmpRoot, 'src-tree');
    const nested = path.join(src, 'sub');
    fs.mkdirSync(nested, { recursive: true });
    fs.writeFileSync(path.join(src, 'a.txt'), 'A', 'utf-8');
    fs.writeFileSync(path.join(nested, 'b.txt'), 'B', 'utf-8');

    const dest = path.join(tmpRoot, 'dest-tree');
    const count = io.copyFolderRecursive(src, dest);
    assert.strictEqual(count, 2);
    assert.strictEqual(fs.readFileSync(path.join(dest, 'a.txt'), 'utf-8'), 'A');
    assert.strictEqual(fs.readFileSync(path.join(dest, 'sub', 'b.txt'), 'utf-8'), 'B');
});

test('copyFileToLocalMod from file.path', async () => {
    const srcFile = path.join(tmpRoot, 'incoming.js');
    fs.writeFileSync(srcFile, 'console.log(1);', 'utf-8');
    const dest = path.join(tmpRoot, 'out', 'incoming.js');
    await io.copyFileToLocalMod({ name: 'incoming.js', path: srcFile }, dest);
    assert.strictEqual(fs.readFileSync(dest, 'utf-8'), 'console.log(1);');
});

console.log('All installIo tests passed.');
