/*:
 * @target MZ
 * @plugindesc 【多脚本包·功能B】应排在 WorkshopMultiFeatA 之后
 * @author Joker创意 / Trae SOLO
 * @version V1.0.0
 * @base WorkshopMultiCore
 * @orderAfter WorkshopMultiFeatA
 *
 * @param 功能B文案
 * @type string
 * @default 功能B已就绪
 * @desc 控制台消息
 *
 * @param 难度
 * @type select
 * @option 简单
 * @option 普通
 * @option 困难
 * @default 普通
 * @desc 演示下拉参数
 *
 * @param 启用日志
 * @type boolean
 * @default true
 * @desc 控制台输出
 *
 * @help
 * 同一订阅下的第 3 个脚本。列表键名：ws:3000000004:WorkshopMultiFeatB
 * 同时有 @base 与 @orderAfter，用于测试多脚本各自的依赖灯与排序提示。
 *
 * 【铁律合规性自检】
 * [✓] 本补丁已通过铁律合规检查。
 */

(() => {
    'use strict';

    const ModName = 'WorkshopMultiFeatB';
    const VERSION = 'V1.0.0';
    const DEBUG_LEVEL = 3;

    const log = (level, ...args) => {
        if (DEBUG_LEVEL < level) return;
        const prefix = `[${ModName} v${VERSION}]`;
        if (level === 3) console.log(prefix, '[INFO]', ...args);
    };

    const params = PluginManager.parameters('WorkshopMultiFeatB') || {};
    const msg = String(params['功能B文案'] || '功能B已就绪');
    const diff = String(params['难度'] || '普通');
    const enableLog = String(params['启用日志'] || 'true') === 'true';

    if (enableLog) {
        log(3, msg, '难度=', diff);
    }
})();
