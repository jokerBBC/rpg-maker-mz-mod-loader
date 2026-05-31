/*:
 * @target MZ
 * @plugindesc 【多脚本包·核心】工坊包 3000000004 的基础模块
 * @author Joker创意 / Trae SOLO
 * @version V1.0.0
 *
 * @param 核心倍率
 * @type number
 * @min 1
 * @max 10
 * @default 2
 * @desc 写入 window 供同包其它脚本读取
 *
 * @param 启用日志
 * @type boolean
 * @default true
 * @desc 控制台输出
 *
 * @help
 * 同一工坊订阅（3000000004）下的第 1 个脚本。
 * ModLoader 列表中显示为独立一行：WorkshopMultiCore，可单独开关与改参。
 *
 * 【铁律合规性自检】
 * [✓] 本补丁已通过铁律合规检查。
 */

(() => {
    'use strict';

    const ModName = 'WorkshopMultiCore';
    const VERSION = 'V1.0.0';
    const DEBUG_LEVEL = 3;

    const log = (level, ...args) => {
        if (DEBUG_LEVEL < level) return;
        const prefix = `[${ModName} v${VERSION}]`;
        if (level === 3) console.log(prefix, '[INFO]', ...args);
    };

    const params = PluginManager.parameters('WorkshopMultiCore') || {};
    const mult = Number(params['核心倍率'] || 2) || 2;
    const enableLog = String(params['启用日志'] || 'true') === 'true';

    window.WorkshopMultiPack = {
        version: VERSION,
        multiplier: mult,
        ready: true
    };

    if (enableLog) {
        log(3, '多脚本包·核心已加载，倍率=', mult);
    }
})();
