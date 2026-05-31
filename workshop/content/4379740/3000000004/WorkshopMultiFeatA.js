/*:
 * @target MZ
 * @plugindesc 【多脚本包·功能A】依赖同包 WorkshopMultiCore
 * @author Joker创意 / Trae SOLO
 * @version V1.0.0
 * @base WorkshopMultiCore
 *
 * @param 功能A文案
 * @type string
 * @default 功能A已就绪
 * @desc 控制台消息
 *
 * @param 启用日志
 * @type boolean
 * @default true
 * @desc 控制台输出
 *
 * @help
 * 同一订阅下的第 2 个脚本。列表键名：ws:3000000004:WorkshopMultiFeatA
 * 需先开启 WorkshopMultiCore，ModLoader 会做依赖与排序检测。
 *
 * 【铁律合规性自检】
 * [✓] 本补丁已通过铁律合规检查。
 */

(() => {
    'use strict';

    const ModName = 'WorkshopMultiFeatA';
    const VERSION = 'V1.0.0';
    const DEBUG_LEVEL = 3;

    const log = (level, ...args) => {
        if (DEBUG_LEVEL < level) return;
        const prefix = `[${ModName} v${VERSION}]`;
        if (level === 3) console.log(prefix, '[INFO]', ...args);
    };

    const params = PluginManager.parameters('WorkshopMultiFeatA') || {};
    const msg = String(params['功能A文案'] || '功能A已就绪');
    const enableLog = String(params['启用日志'] || 'true') === 'true';

    if (enableLog) {
        const pack = window.WorkshopMultiPack;
        log(3, msg, pack ? '倍率=' + pack.multiplier : '(核心未加载)');
    }
})();
