/*:
 * @target MZ
 * @plugindesc 独立工坊演示 Mod（V4 正式目录自测，无前置）
 * @author Joker创意 / Trae SOLO
 * @version V1.0.0
 *
 * @param 演示消息
 * @type string
 * @default 正式工坊目录 Mod 加载成功
 * @desc 控制台输出内容
 *
 * @param 启用日志
 * @type boolean
 * @default true
 * @desc 是否在控制台输出加载日志
 *
 * @help
 * 【功能及使用方式】
 * 模拟 Steam 订阅后落在 workshop/content/4379740/ 下的普通工坊 Mod。
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

    const ModName = 'WorkshopDemo';
    const VERSION = 'V1.0.0';
    const DEBUG_LEVEL = 3;

    const log = (level, ...args) => {
        if (DEBUG_LEVEL < level) return;
        const prefix = `[${ModName} v${VERSION}]`;
        if (level === 1) console.error(prefix, '[ERROR]', ...args);
        else if (level === 2) console.warn(prefix, '[WARN]', ...args);
        else if (level === 3) console.log(prefix, '[INFO]', ...args);
    };

    const params = PluginManager.parameters('WorkshopDemo') || {};
    const message = String(params['演示消息'] || '正式工坊目录 Mod 加载成功');
    const enableLog = String(params['启用日志'] || 'true') === 'true';

    if (enableLog) {
        log(3, message, '（包 ID: 3000000003）');
    }
})();
