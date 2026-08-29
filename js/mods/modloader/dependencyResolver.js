/**
 * ModLoader 依赖判定（纯逻辑，无 DOM）
 * @base / @orderAfter 解析与五态检测
 */
'use strict';

/**
 * @param {object} deps
 * @param {import('fs')} deps.fs
 * @param {Function} deps.log
 * @param {Function} deps.t
 * @param {string} deps.pluginsPath
 */
function createDependencyResolver(deps) {
    const { fs, log, t, pluginsPath } = deps;

    const DEP_STATUS = {
        PASS: 'pass',
        NOT_FOUND: 'not_found',
        GAME_DISABLED: 'game_disabled',
        MOD_DISABLED: 'mod_disabled',
        WRONG_ORDER: 'wrong_order'
    };

    /**
     * 解析 @base / @orderAfter 标签中的依赖插件列表
     * @param {string} rawStr
     * @returns {string[]}
     */
    function parseDependencyList(rawStr) {
        if (!rawStr || typeof rawStr !== 'string') return [];
        const trimmed = rawStr.trim();
        if (!trimmed) return [];

        const result = [];
        const tokens = trimmed.split(/\s+/);

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            if (!token) continue;

            const jsIndex = token.indexOf('.js');
            if (jsIndex !== -1) {
                let pluginName = token.substring(0, jsIndex + 3).slice(0, -3);
                if (pluginName) result.push(pluginName);
            } else {
                result.push(token);
            }
        }

        return [...new Set(result)];
    }

    /**
     * 从 plugins.js 读取游戏原生插件及其开启状态
     * @returns {Map<string, {enabled: boolean}>}
     */
    function getGamePluginInfo() {
        const gamePlugins = new Map();
        try {
            const content = fs.readFileSync(pluginsPath, 'utf-8');
            const lines = content.split('\n');
            for (const line of lines) {
                const objMatch = line.match(/^\s*(\{.*\})\s*,?\s*$/);
                if (objMatch) {
                    try {
                        const obj = JSON.parse(objMatch[1]);
                        if (obj.name) {
                            let name = obj.name;
                            if (name.startsWith('../mods/') || obj.__isMod) continue;
                            if (name.endsWith('.js')) name = name.slice(0, -3);
                            const baseName = name.includes('/') ? name.split('/').pop() : name;
                            const enabled = obj.status !== false;
                            gamePlugins.set(baseName, { enabled });
                            if (baseName !== name) {
                                gamePlugins.set(name, { enabled });
                            }
                        }
                    } catch (jsonErr) { /* 忽略解析失败的行 */ }
                }
            }
        } catch (e) {
            log(1, '读取游戏插件列表失败', e);
        }
        return gamePlugins;
    }

    /**
     * @param {Array} modList
     * @returns {Object<string, {mod: object, index: number, status: boolean}>}
     */
    function buildModLookup(modList) {
        const modLookup = {};
        modList.forEach((mod, index) => {
            const modName = mod.id.replace('../mods/', '');
            modLookup[modName] = { mod, index, status: mod.status };
            if (mod.fileName) {
                const fileNameNoExt = mod.fileName.replace(/\.js$/, '');
                modLookup[fileNameNoExt] = { mod, index, status: mod.status };
            }
            if (mod.id.startsWith('ws:')) {
                const parts = mod.id.split(':');
                if (parts.length >= 3) {
                    modLookup[parts[2]] = { mod, index, status: mod.status };
                }
            }
            if (mod.id.startsWith('local:')) {
                const parts = mod.id.split(':');
                if (parts.length >= 3) {
                    modLookup[parts[2]] = { mod, index, status: mod.status };
                }
            }
        });
        return modLookup;
    }

    /**
     * @param {string} depName
     * @param {number} currentIndex
     * @param {Map<string, {enabled: boolean}>} gamePlugins
     * @param {Object} modLookup
     * @returns {{ status: string, message: string }}
     */
    function checkSingleDep(depName, currentIndex, gamePlugins, modLookup) {
        const gameInfo = gamePlugins.get(depName);
        if (gameInfo) {
            if (gameInfo.enabled) {
                return { status: DEP_STATUS.PASS, message: '' };
            }
            return {
                status: DEP_STATUS.GAME_DISABLED,
                message: t('dep.gameDisabled').replace('{name}', depName)
            };
        }

        const modEntry = modLookup[depName];
        if (!modEntry) {
            return {
                status: DEP_STATUS.NOT_FOUND,
                message: t('dep.notFound').replace('{name}', depName)
            };
        }

        if (!modEntry.status) {
            return {
                status: DEP_STATUS.MOD_DISABLED,
                message: t('dep.modDisabled').replace('{name}', depName)
            };
        }

        if (modEntry.index < currentIndex) {
            return { status: DEP_STATUS.PASS, message: '' };
        }

        return {
            status: DEP_STATUS.WRONG_ORDER,
            message: t('dep.wrongOrder').replace('{name}', depName)
        };
    }

    /**
     * @param {Array} modList
     * @returns {Object}
     */
    function checkModDependencies(modList) {
        const result = {};
        const gamePlugins = getGamePluginInfo();
        const modLookup = buildModLookup(modList);

        modList.forEach((mod, index) => {
            const modId = mod.id;
            const depInfo = {
                baseDetails: [],
                orderAfterDetails: [],
                baseWarning: false,
                orderAfterWarning: false
            };

            if (mod.baseList && mod.baseList.length > 0) {
                for (const depName of mod.baseList) {
                    const check = checkSingleDep(depName, index, gamePlugins, modLookup);
                    depInfo.baseDetails.push({
                        name: depName,
                        status: check.status,
                        message: check.message
                    });
                    if (check.status !== DEP_STATUS.PASS) {
                        depInfo.baseWarning = true;
                    }
                }
            }

            if (mod.orderAfterList && mod.orderAfterList.length > 0) {
                for (const depName of mod.orderAfterList) {
                    const check = checkSingleDep(depName, index, gamePlugins, modLookup);
                    depInfo.orderAfterDetails.push({
                        name: depName,
                        status: check.status,
                        message: check.message
                    });
                    if (check.status !== DEP_STATUS.PASS) {
                        depInfo.orderAfterWarning = true;
                    }
                }
            }

            result[modId] = depInfo;
        });

        return result;
    }

    /**
     * 运行时 @base 加载守卫：依赖已加载或在本批待加载队列中
     * @param {string[]} baseList
     * @param {string[]} loadedScripts
     * @param {string[]} pendingModNames
     * @returns {{ satisfied: boolean, missingBase: string|null }}
     */
    function isBaseLoadGuardSatisfied(baseList, loadedScripts, pendingModNames) {
        if (!baseList || baseList.length === 0) {
            return { satisfied: true, missingBase: null };
        }
        const loadedSet = new Set(loadedScripts || []);
        const pendingSet = new Set(pendingModNames || []);
        for (let i = 0; i < baseList.length; i++) {
            const baseName = baseList[i];
            if (!loadedSet.has(baseName) && !pendingSet.has(baseName)) {
                return { satisfied: false, missingBase: baseName };
            }
        }
        return { satisfied: true, missingBase: null };
    }

    return {
        DEP_STATUS,
        parseDependencyList,
        getGamePluginInfo,
        buildModLookup,
        checkSingleDep,
        checkModDependencies,
        isBaseLoadGuardSatisfied
    };
}

module.exports = createDependencyResolver;
