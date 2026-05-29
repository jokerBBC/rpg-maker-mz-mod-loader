/*:
 * @target MZ
 * @plugindesc 全能参数测试仪 - 验证 ModLoader 的数值/开关/选择/文本/颜色/长文本/数据库引用修改功能
 * @author joker创意 / DeepSeek
 * @version V1.2.0
 * @base 自动发钱（虚构1） 自动打钱（虚构2）
 * @orderAfter 自动偷钱（虚构3） 自动没钱（虚构4）
 * @orderBefore 上面的前置Mod是假的，用于测试前置检测。要使用每日签到，可开启。
 *
 * @help
 * 本 Mod 用于测试游戏内模组管理器的参数编辑功能。
 * 想自己做可调参数Mod，可以参考此测试Mod，若无必要不要打开。
 * 除了每日签到发银币外功能都是做做样子，并不会影响游戏运行。
 * 启动游戏后，打开控制台（F12）可看到所有参数的当前值。（需修改package.json中的代码，删除禁用调试日志的配置）
 * 修改参数并保存后，需重启游戏才会应用新值。
 *
 * 支持的标签类型
 * 1.@author
 * 2.@version
 * 3.@base
 * 4.@orderAfter
 * 5.@orderBefore
 * 6.@help
 * 
 * 支持的基础参数类型：
 * 1. 数值（同时带上下限@min、@max时显示为滑动条&支持小数步长@step）
 * 2. 数值（整数滑动条）
 * 3. 开关（布尔）
 * 4. 选择（下拉选项）
 * 5. 文本
 * 6. 颜色（取色器）
 * 7. 长文本（note，多行文本）
 * 8. 长文本（multiline_string，多行文本）
 * 9. 数据库引用 - 角色（actor）
 * 10. 数据库引用 - 技能（skill）
 * 11. 数据库引用 - 物品（item）
 * 12. 数据库引用 - 武器（weapon）
 * 13. 数据库引用 - 防具（armor）
 * 14. 数据库引用 - 敌人（enemy）
 * 15. 数据库引用 - 状态（state）
 *
 * === 边界测试 ===
 * 这是一段普通文本，用于测试帮助信息中的@符号不会被误解析为元数据标签。
 * 
 * 版本历史：
 *  - 版本号格式示例：@version V1.0.0 初始版本
 *  - 版本号格式示例：@version V1.1.0 添加新功能  
 *  - 版本号格式示例：@version V1.2.0 完善测试用例
 * 
 * 开发者信息：
 *  - 作者标识示例：@author Joker
 *  - 作者标识示例：@author DeepSeek AI
 * 
 * 参数说明示例：
 *  - 参数定义示例：@param 示例参数
 *  - 参数类型示例：@type string
 *  - 参数默认示例：@default 示例值
 * 
 * 注意：以上所有 @version、@author、@param、@type、@default 都应作为纯文本显示，不应被解析为元数据标签。
 *
 * @param 伤害倍率
 * @desc 攻击力放大系数（0.1~5.0）（伪）
 * @type number
 * @min 0.1
 * @max 5.0
 * @step 0.1
 * @default 1
 *
 * @param 每日签到奖励银币
 * @desc 奖励银币数量（1~77777）
 * @type number
 * @min 1
 * @max 77777
 * @default 7777
 *
 * @param 启用调试日志
 * @desc 是否在控制台输出额外调试信息
 * @type boolean
 * @default false
 *
 * @param 自动保存
 * @desc 是否在每次切换地图后自动存档（伪）
 * @type boolean
 * @default false
 *
 * @param 主题风格
 * @desc 游戏界面主题（伪）
 * @type select
 * @option 经典
 * @option 未来
 * @option 复古
 * @default 经典
 *
 * @param 难度
 * @desc 游戏难度等级（伪）
 * @type select
 * @option 简单
 * @option 普通
 * @option 困难
 * @default 普通
 *
 * @param 浮现文字
 * @desc 进入存档后屏幕上浮现的文字内容（会在画面中显示）
 * @type string
 * @default 欢迎回来，主人，我打工挣到钱钱啦~请查收~
 *
 * @param 浮现文字颜色
 * @desc 浮现文字的颜色（可在管理器中用取色器修改）
 * @type color
 * @default #0062ff
 *
 * @param 签到祝福
 * @desc 每日签到时显示的祝福语（多行文本）
 * @type note
 * @default 祝您今天愉快！\n愿您的冒险充满惊喜！
 *
 * @param 角色介绍
 * @desc 主角的背景故事（多行文本）
 * @type multiline_string
 * @default 一位勇敢的冒险者，\n踏上了拯救世界的旅程。\n\n他/她拥有坚定的信念和无畏的勇气！
 *
 * @param 测试角色
 * @desc 选择一个角色进行测试
 * @type actor
 * @default 1
 *
 * @param 测试技能
 * @desc 选择一个技能进行测试
 * @type skill
 * @default 1
 *
 * @param 测试物品
 * @desc 选择一个物品进行测试
 * @type item
 * @default 1
 *
 * @param 测试武器
 * @desc 选择一个武器进行测试
 * @type weapon
 * @default 1
 *
 * @param 测试防具
 * @desc 选择一个防具进行测试
 * @type armor
 * @default 1
 *
 * @param 测试敌人
 * @desc 选择一个敌人进行测试
 * @type enemy
 * @default 1
 *
 * @param 测试状态
 * @desc 选择一个状态进行测试
 * @type state
 * @default 1
 */

(() => {
    'use strict';

    const modName = 'TestMod';
    const params = PluginManager.parameters(modName);

    if (!params) {
        console.warn('[TestMod] 模组未启用或参数加载失败，当前无有效配置。');
        return;
    }

    // 调试输出
    if (params['启用调试日志'] === 'true') {
        console.log('===== [TestMod V1.2.0] 当前参数 =====');
        console.log('【数值类型】');
        console.log('  伤害倍率:', params['伤害倍率'], '(类型:', typeof params['伤害倍率'], ')');
        console.log('  每日签到奖励银币:', params['每日签到奖励银币'], '(类型:', typeof params['每日签到奖励银币'], ')');
        
        console.log('【布尔类型】');
        console.log('  启用调试日志:', params['启用调试日志'], '(类型:', typeof params['启用调试日志'], ')');
        console.log('  自动保存:', params['自动保存'], '(类型:', typeof params['自动保存'], ')');
        
        console.log('【选择类型】');
        console.log('  主题风格:', params['主题风格']);
        console.log('  难度:', params['难度']);
        
        console.log('【文本类型】');
        console.log('  浮现文字:', params['浮现文字']);
        console.log('  浮现文字颜色:', params['浮现文字颜色']);
        
        console.log('【长文本类型】');
        console.log('  签到祝福:', '"' + params['签到祝福'] + '"');
        console.log('  角色介绍:', '"' + params['角色介绍'] + '"');
        
        console.log('【数据库引用】');
        console.log('  测试角色(actor):', params['测试角色']);
        console.log('  测试技能(skill):', params['测试技能']);
        console.log('  测试物品(item):', params['测试物品']);
        console.log('  测试武器(weapon):', params['测试武器']);
        console.log('  测试防具(armor):', params['测试防具']);
        console.log('  测试敌人(enemy):', params['测试敌人']);
        console.log('  测试状态(state):', params['测试状态']);
        
        console.log('【边界测试验证】');
        console.log('  ✓ @help 中的 @version/@author/@param 不应被解析为元数据标签');
        console.log('  ✓ 帮助文本应保持纯文本显示，不应出现 * 号前缀');
        console.log('===============================');
    } else {
        console.log('[TestMod] 调试日志已关闭，不打印参数。');
    }

    // ---- 配置文件路径与工具函数 ----
    const fs = require('fs');
    const path = require('path');
    const configDir = path.join(process.cwd(), 'js', 'mods', 'config');
    const configFile = path.join(configDir, 'test-config.json');

    function ensureConfigDir() {
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
    }

    function loadConfig() {
        try {
            if (fs.existsSync(configFile)) {
                const data = fs.readFileSync(configFile, 'utf8');
                return JSON.parse(data);
            }
        } catch (e) {
            console.warn('[TestMod] 读取签到配置文件失败，将使用默认值。', e);
        }
        return {};
    }

    function saveConfig(config) {
        ensureConfigDir();
        fs.writeFileSync(configFile, JSON.stringify(config), 'utf8');
    }

    function getTodayDateString() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    // 获取数据库对象名称
    function getDbObjectName(type, id) {
        const dataMap = {
            actor: $dataActors,
            skill: $dataSkills,
            item: $dataItems,
            weapon: $dataWeapons,
            armor: $dataArmors,
            enemy: $dataEnemies,
            state: $dataStates
        };
        const dataArray = dataMap[type];
        if (dataArray && dataArray[id]) {
            return dataArray[id].name || `ID:${id}`;
        }
        return `ID:${id}`;
    }

    // 解析多行文本（处理换行符）
    function parseMultilineText(text) {
        if (!text) return '';
        // 替换 \n 为实际换行
        return text.replace(/\\n/g, '\n');
    }

    // ---- 每日签到 + 文字显示（合并延迟） ----
    function tryDailySignIn(scene) {
        const config = loadConfig();
        const today = getTodayDateString();
        const reward = Number(params['每日签到奖励银币']) || 7777;

        if (config.lastSignDate === today) {
            if (params['启用调试日志'] === 'true') {
                console.log('[TestMod] 今日已签到，不显示欢迎信息也不发放银币。');
            }
            return;
        }

        // 延迟 1 秒后同时执行：发钱 + 记录日期 + 显示文字
        setTimeout(() => {
            // 确保仍在同一场景
            if (SceneManager._scene !== scene) return;

            // 发放银币
            if ($gameParty) {
                $gameParty.gainGold(reward);
            }

            // 更新签到日期并保存配置文件
            config.lastSignDate = today;
            saveConfig(config);

            if (params['启用调试日志'] === 'true') {
                console.log(`[TestMod] 每日签到成功！获得 ${reward} 银币。`);
            }

            // 获取数据库对象名称
            const testActorName = getDbObjectName('actor', Number(params['测试角色']) || 1);
            const testSkillName = getDbObjectName('skill', Number(params['测试技能']) || 1);
            const testItemName = getDbObjectName('item', Number(params['测试物品']) || 1);
            const testWeaponName = getDbObjectName('weapon', Number(params['测试武器']) || 1);
            const testArmorName = getDbObjectName('armor', Number(params['测试防具']) || 1);
            const testEnemyName = getDbObjectName('enemy', Number(params['测试敌人']) || 1);
            const testStateName = getDbObjectName('state', Number(params['测试状态']) || 1);

            // 解析多行文本
            const signBlessing = parseMultilineText(params['签到祝福']);
            const characterIntro = parseMultilineText(params['角色介绍']);

            // 显示文字
            const text1 = params['浮现文字'] || '欢迎回来，主人，我打工挣到钱钱啦~请查收~';
            const text2 = `共计银币：${reward}`;
            const text3 = `--- 签到祝福 ---`;
            const text4 = signBlessing || '祝您冒险愉快！';
            const text5 = `--- 测试数据 ---`;
            const text6 = `角色: ${testActorName} | 技能: ${testSkillName}`;
            const text7 = `物品: ${testItemName} | 武器: ${testWeaponName}`;
            const text8 = `防具: ${testArmorName} | 敌人: ${testEnemyName}`;
            const text9 = `状态: ${testStateName}`;
            const text10 = `--- 角色介绍 ---`;
            const text11 = characterIntro || '一位勇敢的冒险者。';

            const color1 = '#ffffff';
            const color2 = '#ffff00';
            const color3 = params['浮现文字颜色'] || '#ffffff';

            // 清理可能残留的旧文字精灵
            if (scene._testModTextSprites) {
                scene._testModTextSprites.forEach(sprite => scene.removeChild(sprite));
            }
            scene._testModTextSprites = [];

            const texts = [text1, text2, '', text3, text4, '', text5, text6, text7, text8, text9, '', text10, text11];
            const colors = [color1, color2, color3, color3, color3, color3, color3, color3, color3, color3, color3, color3, color3, color3];

            texts.forEach((text, index) => {
                if (text === '') return;
                const sprite = new Sprite(new Bitmap(600, 40));
                sprite.bitmap.fontSize = 24;
                sprite.bitmap.textColor = colors[index] || '#ffffff';
                sprite.bitmap.drawText(text, 0, 0, 600, 32, 'left');
                sprite.x = Graphics.width / 2 - 300;
                sprite.y = 50 + index * 35;
                sprite.opacity = 255;
                scene.addChild(sprite);
                scene._testModTextSprites.push(sprite);
            });

            // 8秒后开始渐隐消失
            setTimeout(() => {
                const sprites = scene._testModTextSprites || [];
                let opacity = 255;
                const fadeInterval = setInterval(() => {
                    opacity -= 3;
                    if (opacity <= 0) {
                        opacity = 0;
                        clearInterval(fadeInterval);
                        sprites.forEach(sprite => {
                            if (sprite.parent) {
                                scene.removeChild(sprite);
                            }
                        });
                        scene._testModTextSprites = [];
                    }
                    sprites.forEach(sprite => {
                        sprite.opacity = opacity;
                    });
                }, 20);
            }, 8000);
        }, 1000);
    }

    // ---- 挂钩到地图场景启动 ----
    const _Scene_Map_start = Scene_Map.prototype.start;
    Scene_Map.prototype.start = function() {
        _Scene_Map_start.apply(this, arguments);
        tryDailySignIn(this);
    };
})();