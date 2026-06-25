/*:
 * @target MZ
 * @plugindesc [测试] ModDataLoader V2 功能验证
 * @author joker创意
 * @version V2.0.0
 * @base ModDataLoader
 *
 * @param testItemId
 * @text 测试物品ID
 * @type number
 * @min 1
 * @max 1199
 * @default 1
 *
 * @param showMapMessage
 * @text 进图提示
 * @type boolean
 * @default true
 *
 * @help
 * 【测试说明】
 * 需同时启用 ModDataLoader + 本 Mod，F5 后进游戏。
 *
 * 验证项目：
 * 1. JS API merge 模式：修改物品1的名称和价格
 * 2. JS API 新增条目（带 stableKey）：验证智能 ID 迁移
 * 3. manifest records：从 data/TestItems.json 自动加载
 * 4. manifest patches：修改物品1的名称（与 JS API 产生冲突 → 验证冲突日志）
 * 5. F12 控制台查看日志
 * 6. 右下角 ⚠ 按钮查看冲突报告
 *
 * F12 诊断命令：
 *   ModDataLoader.getDataRegistry()
 *   ModDataLoader.getConflictReport()
 *   ModDataLoader.getMigrationLog()
 */

(() => {
    'use strict';

    const PLUGIN = 'TestMDL-V2';

    // ══════════════════════════════════════════════════════════
    //  前置依赖检查 —— 缺失时静默退出，不安装任何 hook
    // ══════════════════════════════════════════════════════════
    if (!window.ModDataLoader) {
        console.warn(`[${PLUGIN}] ⚠ ModDataLoader 未启用，本 Mod 已自动跳过所有功能`);
        console.warn(`[${PLUGIN}] 请在模组管理器中启用 ModDataLoader 后 F5 刷新`);
        return;
    }

    const params = Object.assign(
        {},
        PluginManager.parameters(PLUGIN),
        PluginManager.parameters(`../mods/_localmods/${PLUGIN}/${PLUGIN}`)
    );

    function numParam(name, fallback) {
        const v = Number(params[name]);
        return Number.isFinite(v) ? v : fallback;
    }

    function boolParam(name, fallback) {
        if (params[name] == null) return fallback;
        return String(params[name]).toLowerCase() === 'true';
    }

    const TEST_ID = numParam('testItemId', 1);
    const SHOW_MSG = boolParam('showMapMessage', true);

    // ── 等待 ModDataLoader 就绪 ──

    function ensureMDL() {
        if (!window.ModDataLoader || typeof ModDataLoader.registerData !== 'function') {
            console.warn(`[${PLUGIN}] ModDataLoader 未检测到，请启用后 F5`);
            return false;
        }
        return true;
    }

    // ── 测试 1：merge 模式修改已有物品 ──

    function testMerge() {
        if (!ensureMDL()) return;

        ModDataLoader.registerData('Items', [
            {
                id: TEST_ID,
                name: `[MDL-V2]JS-API改名`,
                price: 9999,
                description: '由 registerData merge 模式修改'
            }
        ], 'merge');

        console.log(`[${PLUGIN}] ✓ 测试1: merge 模式 → 物品${TEST_ID} 改名+改价`);
    }

    // ── 测试 2：新增条目（带 stableKey，验证智能迁移） ──

    function testStableEntry() {
        if (!ensureMDL()) return;
        if (!$dataItems) return;

        ModDataLoader.registerStableEntry('Items', {
            id: $dataItems.length,
            stableKey: 'testmdl-v2:healing-potion',
            name: '[MDL-V2]稳定标识测试药水',
            iconIndex: 176,
            description: '带 stableKey 的新增物品，用于验证智能 ID 迁移',
            itypeId: 1,
            price: 1,
            consumable: false,
            occasion: 0,
            animationId: 0,
            hitType: 0,
            damage: { type: 0, elementId: 0, formula: '0', variance: 0, critical: false },
            effects: [],
            params: [0, 0, 0, 0, 0, 0, 0, 0],
            repeats: 1,
            scope: 0,
            speed: 0,
            successRate: 100,
            tpGain: 0,
            note: '<Not Independent Item>\n<颜色:0>\n<类型:物品>'
        });

        console.log(`[${PLUGIN}] ✓ 测试2: stableKey 新增条目 → ID=${$dataItems.length}`);
    }

    // ── 测试 3：冲突制造（与 manifest patches 冲突） ──

    function testConflict() {
        if (!ensureMDL()) return;

        // manifest 里已经 patch 了物品1的 name → "[MDL-V2]manifest改名"
        // 这里 JS API 也 patch 同一个字段 → 产生冲突
        // 由于 manifest 的 order 和本 JS 的 order 相同（同一个包），
        // 最后执行的那个 wins
        ModDataLoader.registerData('Items', [
            {
                id: TEST_ID,
                name: `[MDL-V2]JS-API冲突改名`,
                description: '此行与 manifest patches 产生冲突，用于测试冲突日志'
            }
        ], 'merge');

        console.log(`[${PLUGIN}] ✓ 测试3: 冲突制造 → 物品${TEST_ID}.name 有两处修改`);
    }

    // ── 执行测试 ──

    function runAllTests() {
        if (!ensureMDL()) return;
        console.log(`[${PLUGIN}] ===== ModDataLoader V2 测试开始 =====`);
        testMerge();
        testStableEntry();
        testConflict();
        console.log(`[${PLUGIN}] ===== 测试注册完成，等数据库加载后自动 apply =====`);
        console.log(`[${PLUGIN}] F12 命令: ModDataLoader.getConflictReport()`);
    }

    // 脚本顶层执行
    runAllTests();

    // 数据库加载后再次执行（确保 $dataItems 可用）
    if (typeof DataManager !== 'undefined') {
        const _orig_onLoad = DataManager.onLoad;
        DataManager.onLoad = function(object) {
            _orig_onLoad.call(this, object);
            if (object === $dataItems) {
                testStableEntry();
                console.log(`[${PLUGIN}] $dataItems 已加载，length=${$dataItems.length}`);
                console.log(`[${PLUGIN}] 冲突报告:`, ModDataLoader.getConflictReport());
            }
        };
    }

    // 进地图时发放测试物品 + 显示提示
    const _Scene_Map_start = Scene_Map.prototype.start;
    Scene_Map.prototype.start = function() {
        _Scene_Map_start.call(this);

        // 发放 stableKey 测试物品
        if ($dataItems && $gameParty) {
            const skId = ModDataLoader.findIdByStableKey('Items', 'testmdl-v2:healing-potion');
            if (skId > 0 && $dataItems[skId] && $gameParty.numItems($dataItems[skId]) < 1) {
                $gameParty.gainItem($dataItems[skId], 1);
                console.log(`[${PLUGIN}] 已发放 stableKey 测试物品 x1 (ID=${skId})`);
            }
        }

        // 提示信息
        if (!SHOW_MSG || $gameTemp._mdlV2MsgShown) return;
        $gameTemp._mdlV2MsgShown = true;
        if (!$gameMessage) return;
        $gameMessage.add('\\C[14]ModDataLoader V2 测试');
        $gameMessage.add(`物品${TEST_ID} → merge改名 / manifest patch / 冲突`);
        $gameMessage.add('右下角 ⚠ 按钮 → 查看冲突报告');
        $gameMessage.add('F12 → ModDataLoader.getConflictReport()');
    };

    console.log(`[${PLUGIN}] loaded`);
})();
