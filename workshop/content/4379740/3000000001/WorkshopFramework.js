/*:
 * @target MZ
 * @plugindesc 工坊框架 Mod（V4 正式目录自测）— 供其他工坊 Mod 声明依赖
 * @author Joker创意 / Trae SOLO
 * @version V1.0.0
 *
 * @param 框架标识
 * @type string
 * @default WS_FRAMEWORK_OK
 * @desc 加载后写入 window 的全局标记
 *
 * @param 启用日志
 * @type boolean
 * @default true
 * @desc 是否在控制台输出加载日志
 *
 * @help
 * 【功能及使用方式】
 * 模拟 Steam 工坊「框架型」Mod。其他工坊 Mod 可通过 @base WorkshopFramework 声明依赖。
 *
 * 【更新日志】
 * V1.0.0
 * - 初始版本
 *
 * 【铁律合规性自检】
 * [✓] 本补丁已通过铁律合规检查：无顶层 $dataXxx 依赖 / 所有 Alias 均已做前置存在性检查 / 所有使用的参数均已配置 @default。
 */

(() => {
    'use strict';

    const ModName = 'WorkshopFramework';
    const VERSION = 'V1.0.0';
    const DEBUG_LEVEL = 3;

    const log = (level, ...args) => {
        if (DEBUG_LEVEL < level) return;
        const prefix = `[${ModName} v${VERSION}]`;
        if (level === 1) console.error(prefix, '[ERROR]', ...args);
        else if (level === 2) console.warn(prefix, '[WARN]', ...args);
        else if (level === 3) console.log(prefix, '[INFO]', ...args);
    };

    const params = PluginManager.parameters('WorkshopFramework') || {};
    const marker = String(params['框架标识'] || 'WS_FRAMEWORK_OK');
    const enableLog = String(params['启用日志'] || 'true') === 'true';

    window.WorkshopFramework = {
        version: VERSION,
        marker: marker,
        ready: true
    };

    if (enableLog) {
        log(3, '工坊框架 Mod 已加载，标记:', marker);
    }
})();
