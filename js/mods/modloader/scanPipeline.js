/**
 * Mod 扫描编排（本地包 + 工坊包 + merge）
 */
'use strict';

/**
 * @param {object} deps
 * @param {import('fs')} deps.fs
 * @param {import('path')} deps.pathMod
 * @param {Function} deps.log
 * @param {Function} deps.ensureDir
 * @param {Function} deps.discoverPackageScripts
 * @param {Function} deps.applyModConfigToEntry
 * @param {object} deps.modCatalog
 * @param {object} deps.workshopBridge
 * @param {Function} deps.loadWorkshopConfig
 * @param {string} deps.localmodsDir
 * @param {string} deps.workshopBridgeDir
 */
function createScanPipeline(deps) {
    const {
        fs,
        pathMod,
        log,
        ensureDir,
        discoverPackageScripts,
        applyModConfigToEntry,
        modCatalog,
        workshopBridge,
        loadWorkshopConfig,
        localmodsDir,
        workshopBridgeDir
    } = deps;

    const {
        buildLocalModId,
        buildLocalLoadPath,
        allocDefaultOrderForMod,
        reassignOrders
    } = modCatalog;

    const {
        resolveSteamPaths,
        removePathSafe,
        buildWorkshopBridgeLoadPath,
        syncWorkshopBridge
    } = workshopBridge;

    function scanLocalMods(config, orderState) {
        ensureDir(localmodsDir);
        const mods = [];
        try {
            const packageDirs = fs.readdirSync(localmodsDir, { withFileTypes: true })
                .filter((entry) => entry.isDirectory())
                .map((entry) => entry.name);

            for (const packageName of packageDirs) {
                const packageRoot = pathMod.join(localmodsDir, packageName);
                const scripts = discoverPackageScripts(packageRoot);
                if (scripts.length === 0) continue;

                for (const script of scripts) {
                    const scriptBaseName = pathMod.parse(script.relPath).name;
                    const modId = buildLocalModId(packageName, scriptBaseName);
                    const loadPath = buildLocalLoadPath(packageName, scriptBaseName);
                    const displayName = scriptBaseName;
                    const entry = applyModConfigToEntry(
                        modId,
                        script.absPath,
                        pathMod.basename(script.relPath),
                        displayName,
                        config,
                        allocDefaultOrderForMod(config, orderState, modId, scriptBaseName),
                        scriptBaseName
                    );
                    mods.push(Object.assign(entry, {
                        loadPath: loadPath,
                        source: 'local',
                        workshopId: null,
                        workshopRoot: null,
                        localPackageName: packageName,
                        packageRoot: packageRoot,
                        subscribed: true,
                        readOnly: false,
                        installState: 'ready'
                    }));
                }
            }
        } catch (e) {
            log(1, '扫描本地 Mod 包目录失败', e);
        }
        return mods;
    }

    function scanWorkshopMods(config, orderState) {
        const wsCfg = loadWorkshopConfig();
        if (!wsCfg.enabled) {
            if (fs.existsSync(workshopBridgeDir)) {
                removePathSafe(workshopBridgeDir);
            }
            return [];
        }

        const { workshopDir, steamAppId } = resolveSteamPaths();
        const mods = [];
        const seenLoadPaths = new Set();

        function addWorkshopPackage(root, fileId) {
            const fileIdStr = String(fileId);
            const scripts = discoverPackageScripts(root);
            if (scripts.length === 0) {
                return;
            }

            let installState = 'ready';
            const bridged = syncWorkshopBridge(fileIdStr, root, scripts, workshopBridgeDir);
            if (!bridged) {
                installState = 'missing';
            }

            scripts.forEach((script) => {
                const scriptBaseName = pathMod.parse(script.relPath).name;
                const modId = 'ws:' + fileIdStr + ':' + scriptBaseName;
                const loadPath = buildWorkshopBridgeLoadPath(fileIdStr, script.relPath);
                if (seenLoadPaths.has(loadPath)) return;
                seenLoadPaths.add(loadPath);

                const displayName = scriptBaseName;
                const entry = applyModConfigToEntry(
                    modId,
                    script.absPath,
                    pathMod.basename(script.relPath),
                    displayName,
                    config,
                    allocDefaultOrderForMod(config, orderState, modId, scriptBaseName),
                    scriptBaseName
                );
                mods.push(Object.assign(entry, {
                    loadPath: loadPath,
                    source: 'workshop',
                    workshopId: fileIdStr,
                    workshopRoot: root,
                    packageRoot: root,
                    subscribed: true,
                    readOnly: true,
                    installState: installState
                }));
            });
        }

        if (steamAppId && workshopDir && fs.existsSync(workshopDir)) {
            try {
                fs.readdirSync(workshopDir, { withFileTypes: true })
                    .filter((entry) => entry.isDirectory())
                    .forEach((entry) => addWorkshopPackage(pathMod.join(workshopDir, entry.name), entry.name));
            } catch (e) {
                log(2, '扫描工坊目录失败: ' + workshopDir, e.message);
            }
        }

        return mods;
    }

    function mergeScanResults(localMods, workshopMods) {
        const seenLoadPaths = new Set();
        const mods = [];

        for (const mod of localMods.concat(workshopMods)) {
            if (seenLoadPaths.has(mod.loadPath)) {
                log(2, '跳过重复 loadPath:', mod.loadPath);
                continue;
            }
            seenLoadPaths.add(mod.loadPath);
            mods.push(mod);
        }

        mods.sort((a, b) => a.order - b.order);
        reassignOrders(mods);
        return mods;
    }

    return {
        scanLocalMods,
        scanWorkshopMods,
        mergeScanResults
    };
}

module.exports = createScanPipeline;
