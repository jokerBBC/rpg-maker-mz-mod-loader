'use strict';

var path = require('path');
var fs = require('fs');
var crypto = require('crypto');
var { spawnSync } = require('child_process');

var PS1 = path.join(__dirname, 'pick-folder.ps1');
var TMP_DIR = path.join(__dirname, 'user-data', 'tmp');

function pickFolder(title) {
    if (process.platform !== 'win32') {
        throw new Error('Folder browse is only supported on Windows');
    }
    if (!fs.existsSync(PS1)) {
        throw new Error('Missing pick-folder.ps1');
    }

    fs.mkdirSync(TMP_DIR, { recursive: true });
    var outFile = path.join(TMP_DIR, 'pick-' + crypto.randomBytes(8).toString('hex') + '.txt');
    try {
        var r = spawnSync('powershell', [
            '-NoProfile',
            '-STA',
            '-ExecutionPolicy', 'Bypass',
            '-File', PS1,
            '-Title', String(title || 'Select folder'),
            '-OutFile', outFile
        ], {
            encoding: 'utf8',
            windowsHide: false,
            timeout: 600000
        });
        if (r.error) {
            throw new Error(r.error.message || String(r.error));
        }
        if (r.status !== 0 && r.status !== null) {
            var errText = (r.stderr || r.stdout || '').trim();
            throw new Error(errText || ('PowerShell exit ' + r.status));
        }
        if (!fs.existsSync(outFile)) {
            return null;
        }
        var picked = fs.readFileSync(outFile, 'utf8').replace(/^\uFEFF/, '').trim();
        return picked || null;
    } finally {
        try { if (fs.existsSync(outFile)) fs.unlinkSync(outFile); } catch (e) { /* ignore */ }
    }
}

module.exports = { pickFolder: pickFolder };
