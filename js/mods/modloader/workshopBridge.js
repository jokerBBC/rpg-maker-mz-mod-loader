/**
 * Steam 工坊路径解析与 _workshop 桥接（fs，无 DOM）
 */
'use strict';

/**
 * @param {object} deps
 * @param {import('fs')} deps.fs
 * @param {import('path')} deps.pathMod
 * @param {Function} deps.log
 * @param {Function} deps.loadWorkshopConfig
 * @param {object} deps.DEFAULT_WORKSHOP_CONFIG
 * @param {Function} deps.ensureDir
 */
function createWorkshopBridge(deps) {
    const { fs, pathMod, log, loadWorkshopConfig, DEFAULT_WORKSHOP_CONFIG, ensureDir } = deps;

    function resolveSteamPaths() {
        const wsCfg = loadWorkshopConfig();
        const steamAppId = String(wsCfg.steamAppId || DEFAULT_WORKSHOP_CONFIG.steamAppId);
        let steamRoot = null;

        if (wsCfg.steamLibraryPath) {
            const libPath = String(wsCfg.steamLibraryPath);
            steamRoot = fs.existsSync(pathMod.join(libPath, 'steamapps'))
                ? pathMod.join(libPath, 'steamapps')
                : libPath;
        } else {
            let dir = process.cwd();
            const root = pathMod.parse(dir).root;
            while (dir && dir !== root) {
                const candidate = pathMod.join(dir, 'steamapps');
                if (fs.existsSync(candidate)) {
                    steamRoot = candidate;
                    break;
                }
                dir = pathMod.dirname(dir);
            }
        }

        const workshopDir = steamRoot
            ? pathMod.join(steamRoot, 'workshop', 'content', steamAppId)
            : null;
        return { steamRoot, workshopDir, steamAppId };
    }

    function removePathSafe(targetPath) {
        if (!fs.existsSync(targetPath)) return;
        try {
            const stat = fs.lstatSync(targetPath);
            if (stat.isDirectory()) {
                fs.rmSync(targetPath, { recursive: true, force: true });
            } else {
                fs.unlinkSync(targetPath);
            }
        } catch (e) {
            log(2, '移除路径失败: ' + targetPath, e.message);
        }
    }

    function buildWorkshopBridgeLoadPath(fileId, relPath) {
        const baseName = pathMod.parse(relPath).name;
        return '../mods/_workshop/' + String(fileId) + '/' + baseName;
    }

    /**
     * 在 js/mods/_workshop/<fileId>/ 建立联接，供 PluginManager 加载
     * @param {string} fileId
     * @param {string} root - 工坊包根目录
     * @param {Array<{relPath: string, absPath: string}>} scripts
     * @param {string} workshopBridgeDir
     * @returns {boolean}
     */
    function syncWorkshopBridge(fileId, root, scripts, workshopBridgeDir) {
        if (!scripts || scripts.length === 0) return false;

        ensureDir(workshopBridgeDir);
        const bridgeDir = pathMod.join(workshopBridgeDir, String(fileId));
        removePathSafe(bridgeDir);

        try {
            fs.symlinkSync(root, bridgeDir, 'junction');
            return true;
        } catch (e) {
            log(2, '工坊包根 junction 失败，改用逐文件桥接: ' + fileId, e.message);
            removePathSafe(bridgeDir);
        }

        ensureDir(bridgeDir);
        for (const script of scripts) {
            const fileName = pathMod.basename(script.relPath);
            const linkPath = pathMod.join(bridgeDir, fileName);
            removePathSafe(linkPath);
            try {
                fs.symlinkSync(script.absPath, linkPath, 'file');
            } catch (e1) {
                try {
                    fs.linkSync(script.absPath, linkPath);
                } catch (e2) {
                    log(1, '工坊桥接失败: ' + script.absPath, e1.message, e2.message);
                    return false;
                }
            }
        }
        return true;
    }

    return {
        resolveSteamPaths,
        removePathSafe,
        buildWorkshopBridgeLoadPath,
        syncWorkshopBridge
    };
}

module.exports = createWorkshopBridge;
