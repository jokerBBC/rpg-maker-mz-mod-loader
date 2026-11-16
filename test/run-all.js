/**
 * modloader 全量单元测试 + ModLoader.js 语法检查
 * 用法：在仓库根目录执行  node test/run-all.js
 */
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TEST_DIR = __dirname;
const NODE = process.execPath;

function run(label, args, cwd) {
    console.log('\n==> ' + label);
    const result = spawnSync(NODE, args, { cwd, stdio: 'inherit', encoding: 'utf8' });
    const ok = result.status === 0;
    if (!ok) {
        console.error('==> FAILED: ' + label + ' (exit ' + (result.status ?? 1) + ')');
    }
    return { label, ok };
}

const testFiles = fs.readdirSync(TEST_DIR)
    .filter((name) => name.endsWith('.test.js'))
    .sort();

if (testFiles.length === 0) {
    console.error('No *.test.js files found in ' + TEST_DIR);
    process.exit(1);
}

const results = [];

for (const file of testFiles) {
    results.push(run(file, [path.join('test', file)], ROOT));
}

results.push(run('ModLoader.js syntax', ['--check', path.join('js', 'mods', 'ModLoader.js')], ROOT));

console.log('\n--- summary ---');
for (const r of results) {
    console.log((r.ok ? '  ok  ' : ' FAIL ') + r.label);
}

const failed = results.filter((r) => !r.ok);
if (failed.length > 0) {
    console.error('\n' + failed.length + ' check(s) failed.');
    process.exit(1);
}

console.log('\nAll ' + results.length + ' checks passed.');
