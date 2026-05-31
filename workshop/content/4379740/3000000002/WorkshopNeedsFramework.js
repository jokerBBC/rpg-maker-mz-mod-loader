/*:
 * @target MZ
 * @plugindesc 依赖 WorkshopFramework 的工坊 Mod（V4 依赖自测）
 * @author Joker创意 / Trae SOLO
 * @version V1.0.0
 * @base WorkshopFramework
 *
 * @param 问候语
 * @type string
 * @default 框架依赖检测通过
 * @desc 加载成功后在控制台输出的消息
 *
 * @param 启用日志
 * @type boolean
 * @default true
 * @desc 是否在控制台输出加载日志
 *
 * @help
 * 【功能及使用方式】
 * 需先开启工坊包 3000000001 中的 WorkshopFramework，再开启本 Mod。
 * ModLoader 依赖检测应识别 @base WorkshopFramework。
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

    const ModName = 'WorkshopNeedsFramework';
    const VERSION = 'V1.0.0';
    const DEBUG_LEVEL = 3;

    const log = (level, ...args) => {
        if (DEBUG_LEVEL < level) return;
        const prefix = `[${ModName} v${VERSION}]`;
        if (level === 1) console.error(prefix, '[ERROR]', ...args);
        else if (level === 2) console.warn(prefix, '[WARN]', ...args);
        else if (level === 3) console.log(prefix, '[INFO]', ...args);
    };

    const params = PluginManager.parameters('WorkshopNeedsFramework') || {};
    const greeting = String(params['问候语'] || '框架依赖检测通过');
    const enableLog = String(params['启用日志'] || 'true') === 'true';

    const fw = window.WorkshopFramework;
    if (!fw || !fw.ready) {
        log(2, 'WorkshopFramework 未就绪，请先在 ModLoader 中启用工坊框架 Mod');
    } else if (enableLog) {
        log(3, greeting, '框架标记:', fw.marker);
    }
})();
