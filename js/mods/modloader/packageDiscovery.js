/**
 * ModLoader Mod 包发现（纯逻辑 + fs，无 DOM）
 * modloader.json entries 安全规则与包根脚本扫描
 */
'use strict';

const MANIFEST_FILENAME = 'modloader.json';
const MODLOADER_SCRIPT_NAME = 'ModLoader.js';

/**
 * @param {object} deps
 * @param {import('fs')} deps.fs
 * @param {import('path')} deps.pathMod
 * @param {Function} deps.log
 */
function createPackageDiscovery(deps) {
    const { fs, pathMod, log } = deps;

    /**
     * @param {string} root - 包根目录
     * @returns {object|null}
     */
    function readWorkshopManifest(root) {
        const manifestPath = pathMod.join(root, MANIFEST_FILENAME);
        try {
            if (fs.existsSync(manifestPath)) {
                return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
            }
        } catch (e) {
            log(2, '解析 modloader.json 失败: ' + root, e.message);
        }
        return null;
    }

    /**
     * modloader.json entries 仅允许包根下的 .js 文件名（禁止路径，防目录穿越）
     * @param {*} entry
     * @returns {string|null}
     */
    function resolvePackageEntryFileName(entry) {
        const raw = String(entry).trim();
        if (!raw) return null;
        if (/[\\/]/.test(raw) || raw.indexOf('..') !== -1) {
            log(2, '包 entries 忽略非法路径项（仅允许文件名）: ' + raw);
            return null;
        }
        const fileName = pathMod.basename(raw);
        if (!fileName.toLowerCase().endsWith('.js') || fileName === MODLOADER_SCRIPT_NAME) {
            log(2, '包 entries 忽略无效项（须为 .js 文件名）: ' + raw);
            return null;
        }
        return fileName;
    }

    /**
     * 发现 Mod 包内脚本（modloader.json entries → 包根 *.js；不递归子目录）
     * @param {string} packageRoot
     * @returns {Array<{relPath: string, absPath: string}>}
     */
    function discoverPackageScripts(packageRoot) {
        const scripts = [];
        const manifest = readWorkshopManifest(packageRoot);

        if (manifest && Array.isArray(manifest.entries) && manifest.entries.length > 0) {
            for (const entry of manifest.entries) {
                const fileName = resolvePackageEntryFileName(entry);
                if (!fileName) continue;
                const absPath = pathMod.join(packageRoot, fileName);
                if (fs.existsSync(absPath)) {
                    scripts.push({
                        relPath: fileName,
                        absPath: absPath
                    });
                } else {
                    log(2, '包 entries 文件不存在: ' + fileName);
                }
            }
            return scripts;
        }

        try {
            const files = fs.readdirSync(packageRoot).filter(
                (file) => file.endsWith('.js') && file !== MODLOADER_SCRIPT_NAME
            );
            for (const file of files) {
                scripts.push({
                    relPath: file,
                    absPath: pathMod.join(packageRoot, file)
                });
            }
        } catch (e) {
            log(2, '扫描包目录失败: ' + packageRoot, e.message);
        }
        return scripts;
    }

    return {
        MANIFEST_FILENAME,
        MODLOADER_SCRIPT_NAME,
        readWorkshopManifest,
        resolvePackageEntryFileName,
        discoverPackageScripts
    };
}

module.exports = createPackageDiscovery;
