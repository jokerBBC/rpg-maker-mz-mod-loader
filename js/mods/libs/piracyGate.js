/**
 * ModLoader libs 扩展 · 盗版环境检测闸门
 *
 * 存在即生效，删除即关闭。通过 registerManagerGate 挂载，无需改管理器本体。
 * 打开管理器前检测 Steam 安装路径与已知破解工具残留；命中则弹窗并阻止进入。
 */
(function () {
    'use strict';

    var ML = typeof window !== 'undefined' ? window.ModLoader : null;
    if (!ML || typeof ML.registerManagerGate !== 'function') {
        console.warn('[piracyGate] ModLoader.registerManagerGate 不可用，扩展未挂载');
        return;
    }

    var fs = require('fs');
    var pathMod = require('path');
    var _piracyCacheResult = null;

    function detectPiracy() {
        if (_piracyCacheResult !== null) return _piracyCacheResult;
        try {
            var cwd = process.cwd();
            var checks = [];
            var forward = cwd.replace(/\\/g, '/').toLowerCase();

            // 正版 Steam：…/steamapps/common/<游戏名>/
            var steamPathPattern = /[/\\]steamapps[/\\]common[/\\][^/\\]+$/;
            if (!steamPathPattern.test(forward)) {
                checks.push({
                    name: 'NonSteamPath',
                    reason: '当前路径不是 Steam 安装目录'
                });
            }

            var libDir = pathMod.join(cwd, 'lib');
            if (fs.existsSync(libDir)) {
                var libFiles = fs.readdirSync(libDir).map(function (f) {
                    return f.toLowerCase();
                });
                var libSet = {};
                for (var i = 0; i < libFiles.length; i++) libSet[libFiles[i]] = true;

                if (libSet['steamclient_loader_x64.exe'])
                    checks.push({ name: 'GSE-Loader', reason: 'lib/ 下存在 GSE 加载器' });
                if (fs.existsSync(pathMod.join(libDir, 'steamclient.dll')) && !libSet['steam_api.dll.bak'])
                    checks.push({ name: 'GSE-Client32', reason: 'lib/ 下存在 GSE steamclient' });
                if (fs.existsSync(pathMod.join(libDir, 'steamclient64.dll')) && !libSet['steam_api64.dll.bak'])
                    checks.push({ name: 'GSE-Client64', reason: 'lib/ 下存在 GSE steamclient64' });
                if (fs.existsSync(pathMod.join(libDir, 'steam_settings')))
                    checks.push({ name: 'Goldberg', reason: 'lib/ 下存在 Goldberg 配置目录' });
                if (libSet['steam_api.dll.bak'] || libSet['steam_api64.dll.bak'])
                    checks.push({ name: 'Goldberg-Bak', reason: 'lib/ 下存在 DLL 备份（Goldberg 替换痕迹）' });
            }

            var rootFiles = fs.readdirSync(cwd).map(function (f) {
                return f.toLowerCase();
            });
            var rootSet = {};
            for (var j = 0; j < rootFiles.length; j++) rootSet[rootFiles[j]] = true;
            if (rootSet['steamclient_loader_x64.exe'])
                checks.push({ name: 'GSE-RootLoader', reason: '根目录存在 GSE 加载器' });
            if (rootSet['steamclient.dll'] || rootSet['steamclient64.dll'])
                checks.push({ name: 'GSE-RootClient', reason: '根目录存在 GSE steamclient' });

            _piracyCacheResult = checks.length > 0
                ? { detected: true, details: checks }
                : { detected: false, details: [] };

            if (_piracyCacheResult.detected) {
                console.warn(
                    '[piracyGate] 检测到非正版环境:',
                    _piracyCacheResult.details.map(function (d) {
                        return d.name + '(' + d.reason + ')';
                    }).join(' | ')
                );
            }
            return _piracyCacheResult;
        } catch (e) {
            console.warn('[piracyGate] 环境检测异常（默认放行）:', e && e.message ? e.message : e);
            _piracyCacheResult = { detected: false, details: [] };
            return _piracyCacheResult;
        }
    }

    ML.registerManagerGate(function () {
        var result = detectPiracy();
        if (!result.detected) return true;

        if (typeof ML.showConfirmDialog === 'function') {
            ML.showConfirmDialog(
                '⚠️ 提示',
                '检测到当前为非 Steam 正版环境，ModLoader 最新版无法使用。\n\n盗版环境请使用旧版管理器，但该版本已停止更新，出现 Bug 请自行解决，不再接受反馈。\n\n感谢理解。',
                [{
                    text: '我知道了',
                    class: 'ml-btn-primary',
                    action: function () {
                        if (typeof ML.hideConfirmDialog === 'function') {
                            ML.hideConfirmDialog();
                        }
                    }
                }]
            );
        }
        return false;
    });

    console.info('[piracyGate] 已挂载管理器闸门');
})();
