/**
 * 本地 Mod 安装落地 I/O（fs，无 DOM 确认框）
 */
'use strict';

/**
 * @param {object} deps
 * @param {import('fs')} deps.fs
 * @param {import('path')} deps.pathMod
 * @param {Function} deps.log
 * @param {Function} deps.ensureDir
 */
function createInstallIo(deps) {
    const { fs, pathMod, log, ensureDir } = deps;

    function copyFolderRecursive(srcDir, destDir) {
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }

        const entries = fs.readdirSync(srcDir, { withFileTypes: true });
        let copiedCount = 0;

        for (const entry of entries) {
            const srcPath = pathMod.join(srcDir, entry.name);
            const destPath = pathMod.join(destDir, entry.name);

            if (entry.isDirectory()) {
                copiedCount += copyFolderRecursive(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
                copiedCount++;
            }
        }

        return copiedCount;
    }

    function copyFileFromDataTransfer(file, destPath) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    fs.writeFileSync(destPath, Buffer.from(e.target.result));
                    resolve();
                } catch (err) {
                    log(1, '复制文件失败:', file.name, err);
                    reject(err);
                }
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(file);
        });
    }

    function copyFileToLocalMod(file, destPath) {
        ensureDir(pathMod.dirname(destPath));
        if (file.path && fs.existsSync(file.path)) {
            fs.copyFileSync(file.path, destPath);
            return Promise.resolve();
        }
        return copyFileFromDataTransfer(file, destPath);
    }

    return {
        copyFolderRecursive,
        copyFileToLocalMod
    };
}

module.exports = createInstallIo;
