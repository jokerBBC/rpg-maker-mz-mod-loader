/*:
 * @target MZ
 * @plugindesc [测试] ModResourceLoader V2 资源替换 & 新增功能验证
 * @author joker创意
 * @version V2.0.0
 * @base ModResourceLoader
 * @orderAfter ModResourceLoader
 *
 * @help
 * 【测试说明】
 * 需同时启用 ModResourceLoader + 本 Mod，F5 后进游戏。
 *
 * 验证项目：
 * 1. 图片替换（manifest 声明，零代码）：打开菜单 → 现实时间图标变成红色钟表
 *    → 替换声明在 modloader.json 的 resources 字段中
 * 2. 图片新增（loadBitmap API）：进入地图场景 → 左下角显示蓝色盾牌图标
 *
 * F12 诊断命令：
 *   ModResourceLoader.getResourceRegistry()
 */

(() => {
    'use strict';

    const PLUGIN = 'TestMRL-V2';

    // ══════════════════════════════════════════════════════════
    //  前置依赖检查
    // ══════════════════════════════════════════════════════════
    if (!window.ModResourceLoader) {
        console.warn(`[${PLUGIN}] ModResourceLoader 未启用，本 Mod 自动跳过`);
        return;
    }

    const MRL = window.ModResourceLoader;
    console.log(`[${PLUGIN}] ===== ModResourceLoader V2 资源测试开始 =====`);

    // ══════════════════════════════════════════════════════════
    //  测试 1：图片替换（manifest 声明，零 JS 代码）
    //  替换声明在 modloader.json 的 resources 字段：
    //    "img/菜单/现实时间图标": "img/clock.png"
    //  ModResourceLoader 扫描 manifest 时自动注册替换，本文件无需任何代码
    // ══════════════════════════════════════════════════════════
    console.log(`[${PLUGIN}] ✓ 测试1: 图片替换 → 由 modloader.json resources 声明（零代码）`);
    console.log(`[${PLUGIN}]   验证方法：打开菜单，查看时间图标是否变成红色钟表`);

    // ══════════════════════════════════════════════════════════
    //  测试 2：图片新增（loadBitmap API，一行代码）
    //  在地图场景（非战斗）左下角显示一个自定义图标
    // ══════════════════════════════════════════════════════════
    let _indicatorSprite = null;

    const _Scene_Map_createAllWindows = Scene_Map.prototype.createAllWindows;
    Scene_Map.prototype.createAllWindows = function() {
        _Scene_Map_createAllWindows.call(this);

        // 一行 API：加载 mod 自带图片，modName='TestMRL-V2'，相对路径='img/indicator'
        _indicatorSprite = new Sprite();
        _indicatorSprite.bitmap = MRL.loadBitmap(PLUGIN, 'img/indicator');
        _indicatorSprite.opacity = 200;
        _indicatorSprite.x = 16;
        _indicatorSprite.y = Graphics.height - 64;
        this.addChild(_indicatorSprite);

        console.log(`[${PLUGIN}] ✓ 测试2: 新增地图指示器 → MRL.loadBitmap('${PLUGIN}', 'img/indicator')`);
        console.log(`[${PLUGIN}]   验证方法：进入地图场景，左下角应显示蓝色盾牌图标`);
    };

    // 非战斗时显示
    const _Scene_Map_start = Scene_Map.prototype.start;
    Scene_Map.prototype.start = function() {
        _Scene_Map_start.call(this);
        if (_indicatorSprite) _indicatorSprite.visible = true;
    };

    // 战斗时隐藏
    const _Scene_Battle_start = Scene_Battle.prototype.start;
    Scene_Battle.prototype.start = function() {
        _Scene_Battle_start.call(this);
        if (_indicatorSprite) _indicatorSprite.visible = false;
    };

    console.log(`[${PLUGIN}] loaded`);
})();
