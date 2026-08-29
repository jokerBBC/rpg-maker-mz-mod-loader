/**
 * ModLoader Mod 目录规则（纯逻辑 + fs 读版本/Changelog）
 * ID/loadPath、包版本与 CHANGELOG 判定、mod_config order 分配
 */
'use strict';

/** 包根更新日志文件名（与商店打包约定一致） */
const PACKAGE_CHANGELOG_FILENAME = 'CHANGELOG.md';

/**
 * @param {object} deps
 * @param {import('fs')} deps.fs
 * @param {import('path')} deps.pathMod
 * @param {Function} deps.log
 * @param {Function} deps.readWorkshopManifest
 * @param {Function} deps.discoverPackageScripts
 * @param {Function} deps.resolveModConfigEntry
 * @param {Function} deps.isModConfigMetaKey
 * @param {string} deps.localmodsDir
 */
function createModCatalog(deps) {
    const {
        fs,
        pathMod,
        readWorkshopManifest,
        discoverPackageScripts,
        resolveModConfigEntry,
        isModConfigMetaKey,
        localmodsDir
    } = deps;

    function buildLocalModId(packageName, scriptBaseName) {
        return 'local:' + packageName + ':' + scriptBaseName;
    }

    function buildLocalLoadPath(packageName, scriptBaseName) {
        return '../mods/_localmods/' + packageName + '/' + scriptBaseName;
    }

    function getLocalModInstallPath(scriptFileName) {
        const baseName = pathMod.parse(scriptFileName).name;
        const packageDir = pathMod.join(localmodsDir, baseName);
        return pathMod.join(packageDir, scriptFileName);
    }

    function getModPackageRoot(mod) {
        if (!mod) return null;
        return mod.packageRoot || mod.workshopRoot || null;
    }

    function getPackageDisplayName(mod) {
        if (!mod) return '';
        if (mod.localPackageName) return mod.localPackageName;
        const packageRoot = getModPackageRoot(mod);
        if (packageRoot) return pathMod.basename(packageRoot);
        return mod.displayName || '';
    }

    /**
     * 解析包版本：优先 modloader.json.version；单脚本可回退 @version；多脚本无清单版本则无版本
     */
    function resolvePackageVersion(mod) {
        if (!mod) return null;
        const packageRoot = getModPackageRoot(mod);
        if (packageRoot) {
            const manifest = readWorkshopManifest(packageRoot);
            if (manifest && manifest.version != null && String(manifest.version).trim()) {
                return String(manifest.version).trim();
            }
            const scripts = discoverPackageScripts(packageRoot);
            if (scripts.length > 1) return null;
        }
        if (mod.version != null && String(mod.version).trim()) {
            return String(mod.version).trim();
        }
        return null;
    }

    function getPackageChangelogPath(mod) {
        const packageRoot = getModPackageRoot(mod);
        if (!packageRoot) return null;
        return pathMod.join(packageRoot, PACKAGE_CHANGELOG_FILENAME);
    }

    function packageHasChangelog(mod) {
        const changelogPath = getPackageChangelogPath(mod);
        if (!changelogPath || !fs.existsSync(changelogPath)) return false;
        try {
            return fs.statSync(changelogPath).isFile();
        } catch (e) {
            return false;
        }
    }

    function canShowModChangelog(mod) {
        return !!(resolvePackageVersion(mod) && packageHasChangelog(mod));
    }

    function getConfigMaxOrder(config) {
        let max = 0;
        Object.keys(config).forEach((key) => {
            if (isModConfigMetaKey(key)) return;
            const entry = config[key];
            if (entry && typeof entry === 'object' && entry.order !== undefined) {
                max = Math.max(max, Number(entry.order) || 0);
            }
        });
        return max;
    }

    function allocDefaultOrderForMod(config, orderState, modId, scriptBaseName) {
        const entry = resolveModConfigEntry(config, modId, scriptBaseName);
        if (entry && typeof entry === 'object' && entry.order !== undefined) {
            return entry.order;
        }
        return orderState.next++;
    }

    function reassignOrders(modList) {
        modList.forEach((mod, index) => {
            mod.order = index + 1;
        });
    }

    return {
        PACKAGE_CHANGELOG_FILENAME,
        buildLocalModId,
        buildLocalLoadPath,
        getLocalModInstallPath,
        getModPackageRoot,
        getPackageDisplayName,
        resolvePackageVersion,
        getPackageChangelogPath,
        packageHasChangelog,
        canShowModChangelog,
        getConfigMaxOrder,
        allocDefaultOrderForMod,
        reassignOrders
    };
}

module.exports = createModCatalog;
