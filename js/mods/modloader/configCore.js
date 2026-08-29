/**
 * ModLoader 配置读写核心（纯逻辑，无 fs / DOM）
 * mod_config 键解析、meta 键过滤、modloader_config workshop 段合并、mod 列表序列化
 */
'use strict';

/** 工坊默认项：loadWorkshopConfig 内存合并用；ensureModLoaderConfigFile 写入 modloader_config.json 时用 */
const DEFAULT_WORKSHOP_CONFIG = {
    enabled: true,
    // 发行游戏的 Steam AppID（须与 steam_appid.txt、Steamworks 工坊后台一致）；4379740 仅为本仓库联调示例，游戏作者请改为自己的 AppID
    steamAppId: '4379740',
    // Steam 库根目录：留空则从游戏安装路径向上自动查找 steamapps；多库盘符或非默认库时填库根，如 "D:/SteamLibrary" 或 "E:/Games/Steam"
    steamLibraryPath: ''
};

/**
 * @param {object} deps
 * @param {Function} deps.log
 */
function createConfigCore(deps) {
    const { log } = deps;

    /**
     * V3.x 本地 Mod 配置键：../mods/<脚本基名>
     * V4.1+ 本地 Mod 配置键：local:<包名>:<脚本基名>
     * 读取时兼容旧键；写入统一经 persistModListToConfig（全量 serializeModListToConfig）
     */
    function resolveModConfigEntry(config, modId, scriptBaseName) {
        if (!config) return undefined;
        if (Object.prototype.hasOwnProperty.call(config, modId)) {
            return config[modId];
        }
        if (scriptBaseName) {
            const legacyKey = '../mods/' + scriptBaseName;
            if (Object.prototype.hasOwnProperty.call(config, legacyKey)) {
                log(3, 'mod_config 兼容旧键:', legacyKey, '→', modId);
                return config[legacyKey];
            }
        }
        return undefined;
    }

    function isModConfigMetaKey(key) {
        return key === 'plugins';
    }

    function getDefaultModLoaderConfig() {
        return {
            ml_theme: 'dark',
            ml_language: 'zh_CN',
            workshop: Object.assign({}, DEFAULT_WORKSHOP_CONFIG)
        };
    }

    function mergeWorkshopConfigSection(existingWorkshop) {
        const merged = Object.assign({}, DEFAULT_WORKSHOP_CONFIG, existingWorkshop || {});
        const defaults = getDefaultModLoaderConfig().workshop;
        let changed = false;
        for (const key of Object.keys(defaults)) {
            if (existingWorkshop && existingWorkshop[key] !== undefined) continue;
            if (merged[key] !== defaults[key]) {
                merged[key] = defaults[key];
                changed = true;
            }
        }
        return { merged, changed: changed || !existingWorkshop };
    }

    /**
     * 单条 mod_config 写入形状（status / params / order）
     * @param {{ id: string, status: boolean, currentParams: object, order: number }} mod
     */
    function buildModConfigEntry(mod) {
        return {
            status: mod.status,
            params: mod.currentParams,
            order: mod.order
        };
    }

    /**
     * 从 mod 列表生成 mod_config 对象（不含 meta 键；全量重写，无 ghost 条目）
     * @param {Array<{ id: string, status: boolean, currentParams: object, order: number }>} modList
     */
    function serializeModListToConfig(modList) {
        const config = {};
        modList.forEach(mod => {
            config[mod.id] = buildModConfigEntry(mod);
        });
        return config;
    }

    return {
        DEFAULT_WORKSHOP_CONFIG,
        resolveModConfigEntry,
        isModConfigMetaKey,
        getDefaultModLoaderConfig,
        mergeWorkshopConfigSection,
        buildModConfigEntry,
        serializeModListToConfig
    };
}

module.exports = createConfigCore;
