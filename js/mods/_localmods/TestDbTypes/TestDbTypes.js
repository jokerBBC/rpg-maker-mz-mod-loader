/*:
 * @target MZ
 * @plugindesc [测试] 数据库引用类型扩展 - 验证 class/troop/animation/switch/variable/common_event
 * @author ModLoader
 * @version V1.0.0
 *
 * @help
 * 用于验证 ModLoader V4.1.8+ 新增的数据库引用参数类型。
 * 在管理器中打开本 Mod 参数页，确认以下类型均出现「名称下拉」而非纯文本：
 *   class / troop / animation / switch / variable / common_event
 *
 * 启用「打印调试日志」后，F12 控制台会输出所选 ID 与解析到的名称。
 * 本 Mod 不修改任何游戏逻辑，可随时关闭。
 *
 * @param 启用调试日志
 * @text 打印调试日志
 * @desc 启动时在控制台输出各数据库引用参数的 ID 与名称
 * @type boolean
 * @default true
 *
 * @param 测试职业
 * @text 职业 (class)
 * @desc 应显示 $dataClasses 下拉
 * @type class
 * @default 1
 *
 * @param 测试敌群
 * @text 敌群 (troop)
 * @desc 应显示 $dataTroops 下拉（战斗敌群，非玩家队伍）
 * @type troop
 * @default 1
 *
 * @param 测试动画
 * @text 动画 (animation)
 * @desc 应显示 $dataAnimations 下拉
 * @type animation
 * @default 1
 *
 * @param 测试开关
 * @text 开关 (switch)
 * @desc 应显示 $dataSystem.switches 下拉
 * @type switch
 * @default 1
 *
 * @param 测试变量
 * @text 变量 (variable)
 * @desc 应显示 $dataSystem.variables 下拉
 * @type variable
 * @default 1
 *
 * @param 测试公共事件
 * @text 公共事件 (common_event)
 * @desc 应显示 $dataCommonEvents 下拉
 * @type common_event
 * @default 1
 */

(() => {
    'use strict';

    const MOD_NAME = 'TestDbTypes';
    const params = PluginManager.parameters(MOD_NAME);

    if (!params) {
        console.warn(`[${MOD_NAME}] 模组未启用或参数加载失败`);
        return;
    }

    if (params['启用调试日志'] !== 'true') {
        console.log(`[${MOD_NAME}] 调试日志已关闭`);
        return;
    }

    function resolveName(type, id) {
        const n = Number(id);
        if (!n || n < 1) return '(未选择)';
        try {
            if (type === 'switch') {
                const arr = $dataSystem && $dataSystem.switches;
                return (arr && arr[n]) ? arr[n] : `(无名 #${n})`;
            }
            if (type === 'variable') {
                const arr = $dataSystem && $dataSystem.variables;
                return (arr && arr[n]) ? arr[n] : `(无名 #${n})`;
            }
            const map = {
                class: '$dataClasses',
                troop: '$dataTroops',
                animation: '$dataAnimations',
                common_event: '$dataCommonEvents'
            };
            const arr = window[map[type]];
            if (arr && arr[n] && arr[n].name) return arr[n].name;
            return `(无名 #${n})`;
        } catch (e) {
            return '(数据库未就绪)';
        }
    }

    function logLine(label, type, key) {
        const id = params[key];
        console.log(`  ${label}: id=${id} → ${resolveName(type, id)}`);
    }

    // 数据库可能尚未全部 onLoad，延迟到 Scene_Boot 之后再打印
    const _Scene_Boot_start = Scene_Boot.prototype.start;
    Scene_Boot.prototype.start = function() {
        _Scene_Boot_start.call(this);
        console.log(`===== [${MOD_NAME} V1.0.0] 数据库引用解析 =====`);
        logLine('职业 class', 'class', '测试职业');
        logLine('敌群 troop', 'troop', '测试敌群');
        logLine('动画 animation', 'animation', '测试动画');
        logLine('开关 switch', 'switch', '测试开关');
        logLine('变量 variable', 'variable', '测试变量');
        logLine('公共事件 common_event', 'common_event', '测试公共事件');
        console.log('提示：在 ModLoader 参数页改值并保存后重启，再对照控制台名称');
        console.log('==========================================');
    };
})();
