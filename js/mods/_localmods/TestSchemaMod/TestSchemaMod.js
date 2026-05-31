/*:
 * @plugindesc 测试Mod - 验证 struct 折叠收纳与 table 表格列表功能
 * @author 测试开发者
 * @version 1.0.0
 *
 * @define-schema PositionSchema
 * [{"name":"x","type":"number","text":"X坐标","default":"0","min":-9999,"max":9999,"step":1},{"name":"y","type":"number","text":"Y坐标","default":"0","min":-9999,"max":9999,"step":1}]
 *
 * @define-schema EnemySchema
 * [{"name":"enemyId","type":"enemy","text":"敌人类型","default":"1"},{"name":"level","type":"number","text":"等级","default":"1","min":1,"max":99,"step":1},{"name":"isBoss","type":"boolean","text":"是否Boss","default":"false"},{"name":"dropItem","type":"item","text":"掉落物品","default":""}]
 *
 * @define-schema ColorEffectSchema
 * [{"name":"effectName","type":"string","text":"效果名称","default":"默认效果"},{"name":"color","type":"color","text":"效果颜色","default":"#ff6600"},{"name":"intensity","type":"number","text":"强度","default":"50","min":0,"max":100,"step":5},{"name":"blendMode","type":"select","text":"混合模式","default":"正常","options":["正常","叠加","正片叠底","滤色"]}]
 *
 * @define-schema NestedStructSchema
 * [{"name":"label","type":"string","text":"标签","default":"组1"},{"name":"position","type":"struct","text":"位置信息","schema":"PositionSchema"},{"name":"enabled","type":"boolean","text":"是否启用","default":"true"}]
 *
 * @help
 * 这是一个用于测试 struct 和 table 功能的 Mod。
 * 想自己做可调参数Mod（多级折叠选单、表格化），可以参考此测试Mod，若无必要不要打开。
 *
 * 测试内容：
 * 1. struct 折叠面板（含多层套娃嵌套）
 * 2. table 表格化列表（含多种字段类型）
 * 3. @text 标签显示中文描述
 * 4. 默认值自动生成
 *
 * 保存格式：
 * - struct: JSON.stringify(内部对象)
 * - table: JSON.stringify([JSON.stringify(行1), JSON.stringify(行2), ...])
 *
 * @param playerName
 * @text 玩家名称
 * @type string
 * @default 勇者
 * @desc 玩家的显示名称
 *
 * @param playerPosition
 * @text 玩家初始位置
 * @type struct
 * @schema PositionSchema
 * @desc 玩家在地图上的初始坐标
 *
 * @param playerColor
 * @text 玩家颜色效果
 * @type struct
 * @schema ColorEffectSchema
 * @desc 玩家的颜色渲染效果配置
 *
 * @param nestedConfig
 * @text 嵌套结构体配置
 * @type struct
 * @schema NestedStructSchema
 * @desc 测试多层套娃：struct 内嵌套 struct
 *
 * @param enemyList
 * @text 敌人列表
 * @type table
 * @schema EnemySchema
 * @desc 配置场景中出现的敌人列表
 *
 * @param effectList
 * @text 效果列表
 * @type table
 * @schema ColorEffectSchema
 * @desc 配置可用的颜色效果列表
 *
 * @param enableDebug
 * @text 启用调试模式
 * @type boolean
 * @default false
 * @desc 是否输出调试日志
 *
 * @param difficulty
 * @text 难度等级
 * @type select
 * @default 普通
 * @option 简单
 * @option 普通
 * @option 困难
 * @option 地狱
 * @desc 游戏难度选择
 */

(function() {
    // 获取插件参数
    const parameters = PluginManager.parameters('TestSchemaMod');

    // 解析 struct 类型参数
    function parseStructParam(paramName) {
        try {
            return JSON.parse(parameters[paramName] || '{}');
        } catch (e) {
            console.warn(`[TestSchemaMod] 解析参数 ${paramName} 失败:`, e);
            return {};
        }
    }

    // 解析 table 类型参数（双重转义）
    function parseTableParam(paramName) {
        try {
            const arr = JSON.parse(parameters[paramName] || '[]');
            return arr.map(row => {
                try {
                    return JSON.parse(row);
                } catch (e) {
                    return {};
                }
            });
        } catch (e) {
            console.warn(`[TestSchemaMod] 解析表格参数 ${paramName} 失败:`, e);
            return [];
        }
    }

    // 读取参数
    const playerName = parameters['playerName'] || '勇者';
    const playerPosition = parseStructParam('playerPosition');
    const playerColor = parseStructParam('playerColor');
    const nestedConfig = parseStructParam('nestedConfig');
    const enemyList = parseTableParam('enemyList');
    const effectList = parseTableParam('effectList');
    const enableDebug = parameters['enableDebug'] === 'true';
    const difficulty = parameters['difficulty'] || '普通';

    // 调试输出
    if (enableDebug) {
        console.log('=== TestSchemaMod 参数 ===');
        console.log('玩家名称:', playerName);
        console.log('玩家位置:', playerPosition);
        console.log('玩家颜色效果:', playerColor);
        console.log('嵌套配置:', nestedConfig);
        console.log('敌人列表:', enemyList);
        console.log('效果列表:', effectList);
        console.log('难度:', difficulty);
    }

    // 在游戏启动时打印参数摘要
    const _Scene_Boot_start = Scene_Boot.prototype.start;
    Scene_Boot.prototype.start = function() {
        _Scene_Boot_start.call(this);
        console.log(`[TestSchemaMod] 已加载 - 玩家: ${playerName}, 难度: ${difficulty}`);
        console.log(`[TestSchemaMod] 敌人数量: ${enemyList.length}, 效果数量: ${effectList.length}`);
        if (nestedConfig.position) {
            console.log(`[TestSchemaMod] 嵌套位置: X=${nestedConfig.position.x}, Y=${nestedConfig.position.y}`);
        }
    };
})();
