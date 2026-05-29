/*:
 * @target MZ
 * @plugindesc 怪物掉落物扩展（兼容Yanfly额外掉落）
 * @version 1.0.0
 * @author joker创意 / GLM
 *
 * @define-schema DropListSchema
 * [{"name":"enemyId","text":"目标怪物","type":"enemy","default":"3"},{"name":"itemId","text":"掉落物品","type":"item","default":"1"},{"name":"dropRate","text":"掉落概率1/n（100~1000）","type":"number","default":"100","min":100,"max":1000,"step":100}]
 *
 * @param dropList
 * @text 🎁 怪物额外掉落配置
 * @type table
 * @schema DropListSchema
 * @default ["{\"enemyId\":\"18\",\"itemId\":\"1\",\"dropRate\":\"1\"}","{\"enemyId\":\"19\",\"itemId\":\"2\",\"dropRate\":\"100\"}"]
 *
 * @help
 * mod管理器表格功能测试实例
 * 为指定怪物添加额外掉落物，完美兼容 Yanfly 额外掉落插件。
 * 掉落概率：填1为100%，填2为50%，填10为10%。
 */

(() => {
    'use strict';

    // ==========================================
    // 参数读取（直接使用纯净文件名，RMMZ原生标准用法）
    // ==========================================
    const parameters = PluginManager.parameters("mydrop");

    // ==========================================
    // 参数解析（兼容RMMZ自动JSON解析）
    // ==========================================
    let dropList = [];
    const rawDropList = parameters['dropList'];

    if (Array.isArray(rawDropList)) {
        // RMMZ 自动解析了外层数组
        dropList = rawDropList.map(item => {
            if (typeof item === 'string') {
                try { return JSON.parse(item); } catch(e) { return {}; }
            }
            return item;
        }).filter(item => item && item.enemyId);
    } else if (typeof rawDropList === 'string') {
        // 纯字符串格式
        try {
            const rawList = JSON.parse(rawDropList);
            dropList = rawList.map(itemStr => JSON.parse(itemStr)).filter(item => item && item.enemyId);
        } catch (e) {
            console.error("[额外掉落] 参数解析失败:", e);
        }
    }

    // ==========================================
    // 核心逻辑：动态注入掉落物
    // ==========================================
    const _Game_Enemy_makeDropItems = Game_Enemy.prototype.makeDropItems;
    Game_Enemy.prototype.makeDropItems = function() {
        let drops = _Game_Enemy_makeDropItems.call(this);
        
        for (const drop of dropList) {
            if (Number(drop.enemyId) === this._enemyId) {
                const itemId = Number(drop.itemId);
                const rate = Number(drop.dropRate) || 1;
                
                if (itemId > 0 && $dataItems[itemId] && (Math.random() * rate < 1)) {
                    drops.push($dataItems[itemId]);
                }
            }
        }
        
        return drops;
    };

})();
