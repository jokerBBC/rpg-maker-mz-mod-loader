/**
 * Mod 脚本基名冲突检测（纯逻辑，无 DOM）
 * 与 @base 依赖检测分离：同名时游戏已启用插件优先生效，管理器内按序号（order）最小者生效
 */
'use strict';

/**
 * @param {object} mod
 * @returns {string}
 */
function extractPluginBaseName(mod) {
    if (!mod) return '';
    if (mod.fileName) {
        return String(mod.fileName).replace(/\.js$/i, '');
    }
    if (mod.loadPath) {
        const seg = String(mod.loadPath).split('/').pop();
        if (seg) return seg;
    }
    if (mod.id && String(mod.id).includes(':')) {
        const parts = String(mod.id).split(':');
        if (parts.length >= 1) return parts[parts.length - 1];
    }
    return mod.displayName ? String(mod.displayName) : '';
}

/**
 * @param {Array} mods - 同名组内全部 Mod
 * @param {boolean} gameEnabled
 * @returns {string|null} 当前已开启且会占坑的 Mod id
 */
function getConflictGroupEffectiveModId(mods, gameEnabled) {
    if (gameEnabled) return null;
    const candidates = (mods || [])
        .filter((m) => m.status && m.installState === 'ready')
        .sort((a, b) => (a.order || 0) - (b.order || 0));
    return candidates.length > 0 ? candidates[0].id : null;
}

/**
 * @param {Array} modList
 * @param {Map<string, { enabled: boolean }>} gamePlugins
 * @returns {Object<string, object>}
 */
function resolvePluginNameConflicts(modList, gamePlugins) {
    const conflicts = {};
    const groups = new Map();

    (modList || []).forEach((mod) => {
        const baseName = extractPluginBaseName(mod);
        if (!baseName) return;
        if (!groups.has(baseName)) groups.set(baseName, []);
        groups.get(baseName).push(mod);
    });

    groups.forEach((mods, baseName) => {
        const gameInfo = gamePlugins && gamePlugins.get(baseName);
        const hasGame = gameInfo !== undefined;
        const gameEnabled = hasGame && gameInfo.enabled;
        const isMultiMod = mods.length > 1;

        if (!hasGame && !isMultiMod) return;

        const effectiveModId = getConflictGroupEffectiveModId(mods, gameEnabled);

        mods.forEach((mod) => {
            const otherModOrders = mods
                .filter((m) => m.id !== mod.id)
                .map((m) => m.order)
                .sort((a, b) => a - b);

            let isEffective = false;
            if (gameEnabled) {
                isEffective = false;
            } else if (isMultiMod) {
                isEffective = !!(mod.status && mod.installState === 'ready'
                    && effectiveModId && mod.id === effectiveModId);
            } else {
                isEffective = true;
            }

            let winnerModOrder = null;
            if (!gameEnabled && effectiveModId) {
                const winner = mods.find((m) => m.id === effectiveModId);
                if (winner) winnerModOrder = winner.order;
            }

            conflicts[mod.id] = {
                pluginBaseName: baseName,
                hasConflict: true,
                isEffective,
                gameName: hasGame ? baseName : null,
                gameEnabled: !!gameEnabled,
                winnerIsGame: !!gameEnabled,
                winnerModOrder,
                otherModOrders
            };
        });
    });

    return conflicts;
}

/**
 * 若将 targetMod 开启，运行时是否会占住脚本基名（与 resolve 规则一致）
 * @param {object} targetMod
 * @param {Array} modList
 * @param {Map<string, { enabled: boolean }>} gamePlugins
 * @returns {boolean}
 */
function wouldModBeEffectiveIfEnabled(targetMod, modList, gamePlugins) {
    const simulated = (modList || []).map((m) =>
        (m.id === targetMod.id ? Object.assign({}, m, { status: true }) : m)
    );
    const conflicts = resolvePluginNameConflicts(simulated, gamePlugins);
    const conflict = conflicts[targetMod.id];
    if (!conflict || !conflict.hasConflict) return true;
    if (conflict.gameEnabled) return false;
    const baseName = extractPluginBaseName(targetMod);
    const group = simulated.filter((m) => extractPluginBaseName(m) === baseName);
    const effectiveId = getConflictGroupEffectiveModId(group, false);
    return effectiveId === targetMod.id;
}

module.exports = {
    extractPluginBaseName,
    getConflictGroupEffectiveModId,
    resolvePluginNameConflicts,
    wouldModBeEffectiveIfEnabled
};
