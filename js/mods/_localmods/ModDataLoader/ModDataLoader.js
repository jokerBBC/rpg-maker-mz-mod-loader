/*:
 * @target MZ
 * @plugindesc V2.0.0 数据合并前置Mod —— 为功能Mod提供数据库合并、地图修改、冲突检测与智能ID迁移API
 * @author joker创意
 *
 * @help
 * ┌────────────────────────────┐
 * │  ModDataLoader V2.0.0      │
 * │  数据合并前置Mod            │
 * └────────────────────────────┘
 *
 * ■ API 一览
 *
 * ── 数据注入 ──────────────────────────────────────────────
 * ModDataLoader.registerData(dataType, entries, mode)
 * ModDataLoader.registerMapData(mapId, mapData, mode)
 * ModDataLoader.registerDataFromFile(dataType, filePath, mode)
 * ModDataLoader.registerMapDataFromFile(mapId, filePath, mode)
 *
 * ── 智能ID迁移 ──────────────────────────────────────────────
 * ModDataLoader.registerStableEntry(dataType, entry)
 * ModDataLoader.findIdByStableKey(dataType, stableKey)
 * ModDataLoader.migrateSaveData()
 * ModDataLoader.getMigrationLog()
 *
 * ── 查询 ──────────────────────────────────────────────
 * ModDataLoader.getDataRegistry()
 * ModDataLoader.getData(dataType)
 * ModDataLoader.getConflictReport()
 * ModDataLoader.reapplyData(dataType)
 * ModDataLoader.isReady()
 * ModDataLoader.onReady(callback)
 *
 * @param debugLevel
 * @text 调试等级
 * @type select
 * @option 关闭
 * @value 0
 * @option 基本
 * @value 1
 * @option 详细
 * @value 2
 * @default 0
 *
 * @param enableDataInjection
 * @text 启用数据注入
 * @type boolean
 * @default true
 *
 * @param enableMigration
 * @text 启用智能ID迁移
 * @type boolean
 * @default true
 */

(() => {
    'use strict';

    // ═══════════════════════════════════════════════════════════
    //  1. Constants & Version
    // ═══════════════════════════════════════════════════════════

    const MOD_NAME = 'ModDataLoader';
    const VERSION = 'V2.0.0';
    const STABLE_KEY_PREFIX = 'MDL:sk:';
    const STABLE_KEY_REGEX = /<MDL:sk:([^>]+)>/;

    // ═══════════════════════════════════════════════════════════
    //  2. Logging
    // ═══════════════════════════════════════════════════════════

    let _debugLevel = 0;

    function log(level, ...args) {
        if (level <= _debugLevel) console.log(`[${MOD_NAME}]`, ...args);
    }
    function warn(...args) {
        console.warn(`[${MOD_NAME}]`, ...args);
    }
    function error(...args) {
        console.error(`[${MOD_NAME}]`, ...args);
    }

    // ═══════════════════════════════════════════════════════════
    //  3. Plugin Parameters
    // ═══════════════════════════════════════════════════════════

    function readPluginParameters() {
        const merged = {};
        const keys = [
            MOD_NAME,
            `../mods/_localmods/${MOD_NAME}/${MOD_NAME}`,
            `../mods/${MOD_NAME}`
        ];
        for (const key of keys) {
            Object.assign(merged, PluginManager.parameters(key) || {});
        }
        return merged;
    }

    const _rawParams = readPluginParameters();
    const Params = {
        debugLevel: Number(_rawParams.debugLevel || 0),
        enableDataInjection: _rawParams.enableDataInjection !== 'false',
        enableMigration: _rawParams.enableMigration !== 'false'
    };
    _debugLevel = Params.debugLevel;
    log(1, `Initialized ${VERSION}`, Params);

    // ═══════════════════════════════════════════════════════════
    //  4. Internal Registries
    // ═══════════════════════════════════════════════════════════

    /** 数据注册表 Map<dataType, Array<{entries, mode, source, modName, order}>> */
    const _dataRegistry = new Map();

    /** 地图注册表 Map<mapId, Array<{data, mode, source, modName, order}>> */
    const _mapRegistry = new Map();

    /** 资源注册表（占位，由 ModResourceLoader 实际管理） */
    const _resourceRegistry = new Map();

    /**
     * 冲突日志
     * Map<"dataType:id:field", {dataType, id, field, touches: [{modName, order, value}]}>
     */
    const _conflictLog = new Map();

    /** stableKey 注册表 Map<stableKey, {dataType, currentId, originalId, modName}> */
    const _stableKeyRegistry = new Map();

    /** 迁移日志 Array<{stableKey, oldId, newId, migrated}> */
    const _migrationLog = [];

    /** 异步加载 Promise 集合 */
    const _pendingAsync = new Set();

    /** onReady 回调队列 */
    const _readyCallbacks = [];

    /** 当前地图 ID */
    let _currentMapId = 0;

    /** Hook 安装标志 */
    let _hooksInstalled = false;

    /** manifest 已扫描标志 */
    let _manifestScanned = false;

    /** Mod 目录基础路径 */
    let _modsBasePath = '';

    /** 当前调用者的 Mod 信息（manifest 扫描时由 _pushCallerMod / _popCallerMod 压栈） */
    let _currentModName = 'unknown';
    let _currentModOrder = 999;
    const _callerContextStack = [];

    // ═══════════════════════════════════════════════════════════
    //  5. Utilities
    // ═══════════════════════════════════════════════════════════

    /**
     * 深度合并。数组作为原子值直接替换。
     */
    function deepMerge(target, source) {
        if (!target || typeof target !== 'object') return source;
        if (!source || typeof source !== 'object') return target;
        for (const key of Object.keys(source)) {
            if (key === '_delete' || key === 'stableKey') continue;
            if (Array.isArray(source[key])) {
                target[key] = source[key];
            } else if (
                source[key] !== null && typeof source[key] === 'object' &&
                target[key] !== null && typeof target[key] === 'object' &&
                !Array.isArray(target[key])
            ) {
                deepMerge(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        }
        return target;
    }

    /**
     * 路径安全校验：禁止路径穿越、绝对路径、盘符
     */
    function isPathSafe(path) {
        if (!path || typeof path !== 'string') return false;
        if (path.includes('..')) return false;
        if (/^[a-zA-Z]:/.test(path)) return false;
        if (path.startsWith('/') || path.startsWith('\\')) return false;
        if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('//')) return false;
        return true;
    }

    /**
     * 规范化路径：统一正斜杠
     */
    function normalizePath(path) {
        return path.replace(/\\/g, '/');
    }

    /**
     * 确保数组可扩展到指定下标，中间用 null 填洞（RMMZ 删除约定）
     */
    function ensureArrayIndex(data, id) {
        if (id < 0 || !Array.isArray(data)) return;
        if (id >= data.length) {
            const oldLen = data.length;
            data.length = id + 1;
            for (let i = oldLen; i < id; i++) {
                if (data[i] === undefined) data[i] = null;
            }
        }
    }

    /**
     * 同步读取本地 JSON 文件
     */
    function readJsonFile(filePath) {
        const normalized = normalizePath(filePath);
        const xhr = new XMLHttpRequest();
        xhr.open('GET', normalized, false);
        xhr.overrideMimeType('application/json');
        try {
            xhr.send();
        } catch (e) {
            // chrome-extension:// 协议下文件不存在会抛异常
            return null;
        }
        if (xhr.status === 200 || xhr.status === 0) {
            try {
                return JSON.parse(xhr.responseText);
            } catch (e) {
                error(`JSON parse error: ${normalized}`, e.message);
                return null;
            }
        }
        warn(`File not found or error (${xhr.status}): ${normalized}`);
        return null;
    }

    /**
     * 从脚本路径推断 mods 基础目录
     */
    function resolveModsBasePath() {
        if (_modsBasePath) return _modsBasePath;

        let scriptSrc = '';
        if (document.currentScript && document.currentScript.src) {
            scriptSrc = document.currentScript.src;
        } else {
            const scripts = document.querySelectorAll('script[src*="ModDataLoader"]');
            if (scripts.length) scriptSrc = scripts[scripts.length - 1].src;
        }

        if (scriptSrc) {
            // e.g. file:///.../js/mods/_localmods/ModDataLoader/ModDataLoader.js
            // → 去掉文件名后连退三级: ModDataLoader → _localmods → mods
            let dir = scriptSrc.substring(0, scriptSrc.lastIndexOf('/'));
            dir = dir.substring(0, dir.lastIndexOf('/')); // up from package dir
            dir = dir.substring(0, dir.lastIndexOf('/')); // up from _localmods/_workshop
            _modsBasePath = dir + '/';
        } else {
            _modsBasePath = 'js/mods/';
        }
        log(1, 'Mods base path:', _modsBasePath);
        return _modsBasePath;
    }

    /**
     * 获取调用者信息（调试用）
     */
    function getCallerInfo() {
        try {
            const stack = new Error().stack;
            if (stack) {
                const lines = stack.split('\n');
                for (let i = 3; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (line && !line.includes(MOD_NAME)) return line.substring(0, 100);
                }
            }
        } catch (e) { /* ignore */ }
        return 'unknown';
    }

    /**
     * 从调用栈中提取 Mod 脚本名（用于冲突报告）
     * 例: chrome-extension://xxx/js/mods/_localmods/TestMDL-V2/TestMDL-V2.js:42:5
     *   → TestMDL-V2
     */
    function _extractModNameFromStack() {
        try {
            const stack = new Error().stack;
            if (!stack) return 'unknown';
            const lines = stack.split('\n');
            for (let i = 3; i < lines.length; i++) {
                const line = lines[i];
                // 跳过前置 Mod 自身的帧
                if (line.includes(MOD_NAME) || line.includes('ModResourceLoader')) continue;
                // 匹配 .js 文件名
                const match = line.match(/\/([^/]+)\.js(?::\d+|$)/);
                if (match) {
                    const name = match[1];
                    // 跳过引擎和管理器
                    if (name === 'ModLoader' || name === 'main' || name === 'rmmz_core'
                        || name === 'rmmz_managers' || name === 'rmmz_scenes'
                        || name === 'rmmz_sprites' || name === 'rmmz_windows') continue;
                    return name;
                }
            }
        } catch (e) { /* ignore */ }
        return 'unknown';
    }

    function _syncCallerFromStack() {
        const top = _callerContextStack[_callerContextStack.length - 1];
        if (top) {
            _currentModName = top.modName;
            _currentModOrder = top.order;
        } else {
            _currentModName = 'unknown';
            _currentModOrder = 999;
        }
    }

    function _pushCallerMod(modName, order) {
        _callerContextStack.push({ modName, order: order ?? 999 });
        _syncCallerFromStack();
    }

    function _popCallerMod() {
        _callerContextStack.pop();
        _syncCallerFromStack();
    }

    /**
     * 解析注册 API 的调用者：manifest 扫描上下文优先，否则从调用栈推断
     */
    function _resolveCallerContext() {
        if (_currentModName !== 'unknown') {
            return { modName: _currentModName, order: _currentModOrder, regSource: 'manifest' };
        }
        return { modName: _extractModNameFromStack(), order: 999, regSource: 'api' };
    }

    // ═══════════════════════════════════════════════════════════
    //  6. GameAdapters — 可插拔游戏适配层
    // ═══════════════════════════════════════════════════════════

    const GameAdapters = {

        /** 总开关：_installDataHooks 开头调用 */
        installAll() {
            this.installSorajmLoadPath();
            this.installYepNotetagNullSlot();
        },

        /**
         * 新增条目 id 收紧策略
         * id > data.length → 收紧到 data.length（紧接追加，避免稀疏数组）
         */
        compactNewEntryId(data, entry, dataType) {
            let id = entry.id;
            if (typeof id !== 'number' || id < 0) {
                id = data.length;
                entry.id = id;
            }
            if (id > data.length) {
                warn(`[GameAdapters] ${dataType} id ${id} compacted to ${data.length}`);
                entry.id = data.length;
                id = entry.id;
            }
            return id;
        },

        /**
         * 【挂机升级打怪兽 / sorajm.js】
         * Hook DataManager.onLoad，在每份数据库加载完成后应用注册表
         */
        installSorajmLoadPath() {
            if (DataManager._mdlAdapterSorajmOnLoad) return;
            const _orig_onLoad = DataManager.onLoad;
            DataManager.onLoad = function(object) {
                _orig_onLoad.call(this, object);
                _applyRegisteredModsForLoadedObject(object);
            };
            DataManager._mdlAdapterSorajmOnLoad = true;
            log(1, '[GameAdapters] sorajm/custom loadDataFile: hook DataManager.onLoad');
        },

        _databaseNullStub() {
            return {
                note: '', params: [0,0,0,0,0,0,0,0],
                learnings: [], effects: [], price: 0
            };
        },

        _wrapGroupProcessorNullSkip(fnName) {
            const flag = '_mdlWrap_' + fnName;
            if (DataManager[flag]) return false;
            const orig = DataManager[fnName];
            if (typeof orig !== 'function') return false;
            const stub = this._databaseNullStub.bind(this);

            DataManager[fnName] = function(group) {
                if (!group) return orig.call(this, group);
                const filled = [];
                for (let n = 1; n < group.length; n++) {
                    if (!group[n]) {
                        filled.push(n);
                        group[n] = stub();
                    }
                }
                try {
                    orig.call(this, group);
                } finally {
                    for (let i = 0; i < filled.length; i++) {
                        group[filled[i]] = null;
                    }
                }
            };
            DataManager[flag] = true;
            return true;
        },

        /**
         * 【挂机升级打怪兽 / YEP 插件栈】
         * 包装 notetag 处理器，对 null 槽临时 stub
         */
        installYepNotetagNullSlot() {
            if (DataManager._mdlAdapterYepNotetag) return;
            const targets = [
                'processCORENotetags1', 'processCORENotetags2',
                'processCORENotetags3', 'processCORENotetags4',
                'processItemCoreNotetags'
            ];
            let patched = 0;
            for (const fnName of targets) {
                if (this._wrapGroupProcessorNullSkip(fnName)) patched++;
            }
            DataManager._mdlAdapterYepNotetag = true;
            log(1, `[GameAdapters] YEP notetag null-slot compat: wrapped ${patched} processors`);
        }
    };

    // ═══════════════════════════════════════════════════════════
    //  7. Conflict Detection
    // ═══════════════════════════════════════════════════════════

    /**
     * 记录一次字段触碰
     */
    function _trackFieldTouch(dataType, id, field, value, modName, order, regSource) {
        const key = `${dataType}:${id}:${field}`;
        if (!_conflictLog.has(key)) {
            _conflictLog.set(key, { dataType, id, field, touches: [] });
        }
        _conflictLog.get(key).touches.push({ modName, order, value, regSource: regSource || 'api' });
    }

    /** 字段名中文翻译（玩家友好） */
    const _FIELD_NAMES = {
        name: '名称', description: '描述', price: '价格', iconIndex: '图标',
        note: '备注', itypeId: '物品类型', damage: '伤害', effects: '效果',
        params: '参数', animationId: '动画', hitType: '命中类型',
        speed: '速度', successRate: '成功率', tpGain: 'TP获取',
        screenWidth: '屏幕宽度', screenHeight: '屏幕高度',
        gameId: '游戏ID', title: '标题'
    };

    /** 数据类型中文翻译 */
    const _TYPE_NAMES = {
        Items: '物品', Skills: '技能', Weapons: '武器', Armors: '防具',
        Actors: '角色', Classes: '职业', Enemies: '敌人', States: '状态',
        System: '系统设置', Troops: '敌群', Animations: '动画',
        Tilesets: '图块集', CommonEvents: '公共事件'
    };

    /**
     * 生成冲突报告（去重 + 玩家友好格式）
     */
    function _getConflictReport() {
        const report = [];
        for (const [key, entry] of _conflictLog) {
            if (entry.touches.length < 2) continue;

            // 按 modName:regSource 去重：同 mod 不同来源视为独立条目
            const modMap = new Map();
            for (const touch of entry.touches) {
                const name = `${touch.modName || '未知Mod'} (${touch.regSource || 'api'})`;
                const existing = modMap.get(name);
                if (!existing || touch.order >= existing.order) {
                    modMap.set(name, touch);
                }
            }

            const uniqueMods = Array.from(modMap.values());
            if (uniqueMods.length < 2) continue; // 同 mod 自身不算冲突

            // 检查是否有实际冲突（不同值）
            const values = uniqueMods.map(t => JSON.stringify(t.value));
            const hasConflict = new Set(values).size > 1;
            if (!hasConflict) continue;

            // 按 order 排序
            const sorted = uniqueMods.slice().sort((a, b) => a.order - b.order);
            const winner = sorted[sorted.length - 1];
            const losers = sorted.slice(0, -1);

            const typeName = _TYPE_NAMES[entry.dataType] || entry.dataType;
            const fieldName = _FIELD_NAMES[entry.field] || entry.field;

            const _srcLabel = (t) => `${t.modName || '未知Mod'} (${t.regSource || 'api'})`;
            report.push({
                dataType: entry.dataType,
                id: entry.id,
                field: entry.field,
                typeName,
                fieldName,
                winnerName: _srcLabel(winner),
                winnerValue: winner.value,
                losers: losers.map(l => ({
                    name: _srcLabel(l),
                    value: l.value
                })),
                mods: sorted.map(t => ({
                    name: _srcLabel(t),
                    order: t.order,
                    value: t.value
                })),
                winner: winner.modName
            });
        }
        return report;
    }

    // ═══════════════════════════════════════════════════════════
    //  8. Data Injection System
    // ═══════════════════════════════════════════════════════════

    /**
     * 注册数据库条目修改
     */
    function registerData(dataType, entries, mode) {
        if (!Params.enableDataInjection) {
            warn('Data injection disabled by parameter');
            return;
        }
        if (!dataType || typeof dataType !== 'string') {
            error('registerData: dataType must be a non-empty string');
            return;
        }
        if (!Array.isArray(entries)) {
            if (entries && typeof entries === 'object') entries = [entries];
            else { error('registerData: entries must be an array or object'); return; }
        }
        mode = mode || 'merge';
        if (!['merge', 'replace', 'add'].includes(mode)) {
            error(`registerData: invalid mode '${mode}', using 'merge'`);
            mode = 'merge';
        }

        if (!_dataRegistry.has(dataType)) _dataRegistry.set(dataType, []);
        const caller = _resolveCallerContext();
        _dataRegistry.get(dataType).push({
            entries, mode,
            source: getCallerInfo(),
            modName: caller.modName,
            regSource: caller.regSource,
            order: caller.order
        });

        log(1, `Registered data: ${dataType} (${entries.length} entries, mode=${mode}, mod=${caller.modName})`);

        // 如果数据已加载（非 $dataMap），立即应用
        const globalName = '$data' + dataType;
        if (globalName !== '$dataMap' && window[globalName] !== undefined && window[globalName] !== null) {
            log(2, `${globalName} already loaded, applying immediately`);
            _applyDataModifications(globalName, dataType);
        }
    }

    /**
     * 注册地图数据修改
     */
    function registerMapData(mapId, mapData, mode) {
        if (!Params.enableDataInjection) { warn('Data injection disabled'); return; }
        if (typeof mapId !== 'number' || mapId <= 0) {
            error('registerMapData: mapId must be a positive number'); return;
        }
        if (!mapData || typeof mapData !== 'object') {
            error('registerMapData: mapData must be a non-null object'); return;
        }
        mode = mode || 'merge';

        if (!_mapRegistry.has(mapId)) _mapRegistry.set(mapId, []);
        const caller = _resolveCallerContext();
        _mapRegistry.get(mapId).push({
            data: mapData, mode,
            source: getCallerInfo(),
            modName: caller.modName,
            regSource: caller.regSource,
            order: caller.order
        });
        log(1, `Registered map data: Map${mapId} (mode=${mode}, mod=${caller.modName})`);
    }

    /**
     * 从本地 JSON 文件读取并注册数据
     */
    function registerDataFromFile(dataType, filePath, mode) {
        if (!isPathSafe(filePath)) {
            error(`registerDataFromFile: unsafe path '${filePath}'`); return;
        }
        const fullPath = resolveModsBasePath() + normalizePath(filePath);
        const json = readJsonFile(fullPath);
        if (!json) return;

        let entries;
        if (Array.isArray(json)) {
            entries = json;
        } else if (json && typeof json === 'object') {
            // 尝试找第一个数组类型的值
            for (const key of Object.keys(json)) {
                if (Array.isArray(json[key])) { entries = json[key]; break; }
            }
            if (!entries) entries = [json];
        } else {
            error(`registerDataFromFile: unexpected JSON format in ${filePath}`); return;
        }

        registerData(dataType, entries, mode);
    }

    /**
     * 从本地 JSON 文件读取并注册地图数据
     */
    function registerMapDataFromFile(mapId, filePath, mode) {
        if (!isPathSafe(filePath)) {
            error(`registerMapDataFromFile: unsafe path '${filePath}'`); return;
        }
        const fullPath = resolveModsBasePath() + normalizePath(filePath);
        const json = readJsonFile(fullPath);
        if (!json) return;
        registerMapData(mapId, json, mode);
    }

    /**
     * 注册带稳定标识的条目（用于智能 ID 迁移）
     */
    function registerStableEntry(dataType, entry) {
        if (!entry || !entry.stableKey) {
            error('registerStableEntry: entry must have a stableKey field'); return;
        }
        const sk = entry.stableKey;
        const caller = _resolveCallerContext();
        if (caller.modName === 'unknown') {
            warn(`registerStableEntry: cannot determine caller mod for stableKey=${sk}`);
        }

        // 在 note 中追加 stableKey 标记
        if (!entry.note) entry.note = '';
        if (!entry.note.includes(`<${STABLE_KEY_PREFIX}${sk}>`)) {
            entry.note += `\n<${STABLE_KEY_PREFIX}${sk}>`;
        }

        // 注册到 stableKey 表
        _stableKeyRegistry.set(sk, {
            dataType,
            originalId: entry.id || -1,
            currentId: -1,
            modName: caller.modName
        });

        // 委托给 registerData
        registerData(dataType, [entry], 'merge');
        log(1, `Registered stable entry: ${dataType} stableKey=${sk} mod=${caller.modName}`);
    }

    // ═══════════════════════════════════════════════════════════
    //  9. Apply Data Modifications
    // ═══════════════════════════════════════════════════════════

    /**
     * 对已加载的数据应用注册表
     */
    function _applyDataModifications(globalName, dataType) {
        const data = window[globalName];
        if (!data) return;
        if (Array.isArray(data)) {
            _applyArrayDataModifications(globalName, dataType, data);
        } else if (typeof data === 'object') {
            _applyObjectDataModifications(globalName, dataType, data);
        }
    }

    /**
     * onLoad 后自动匹配并应用
     */
    function _applyRegisteredModsForLoadedObject(object) {
        if (!object) return;

        for (const dataType of _dataRegistry.keys()) {
            const globalName = '$data' + dataType;
            if (globalName === '$dataMap') continue;
            if (window[globalName] === object) {
                _applyDataModifications(globalName, dataType);
            }
        }

        if (typeof $dataMap !== 'undefined' && object === $dataMap && _currentMapId > 0) {
            _applyMapModifications(_currentMapId, object);
        }
    }

    /**
     * 数组类型数据合并（Items, Skills, Actors 等）
     */
    function _applyArrayDataModifications(globalName, dataType, data) {
        const registrations = _dataRegistry.get(dataType);
        if (!registrations || !registrations.length) return;

        // 按 mod_config order 排序（升序，小 order 先执行）
        const sorted = registrations.slice().sort((a, b) => a.order - b.order);
        let modifiedCount = 0;

        for (const reg of sorted) {
            for (const entry of reg.entries) {
                if (!entry || typeof entry !== 'object') continue;

                // 处理 stableKey：尝试找到当前 id
                let id = entry.id;
                if (entry.stableKey) {
                    const existingId = _findCurrentIdByStableKey(dataType, entry.stableKey, data);
                    if (existingId >= 0) {
                        id = existingId;
                        entry.id = id;
                        // 更新 stableKey 注册表
                        const skEntry = _stableKeyRegistry.get(entry.stableKey);
                        if (skEntry) skEntry.currentId = id;
                    }
                }

                if (id === undefined || id === null) {
                    warn(`Skipping entry without id in ${dataType} from ${reg.modName}`);
                    continue;
                }

                // 删除
                if (entry._delete === true) {
                    if (id < data.length && data[id] !== null) {
                        _trackFieldTouch(dataType, id, '_delete', true, reg.modName, reg.order, reg.regSource);
                        data[id] = null;
                        modifiedCount++;
                    }
                    continue;
                }

                if (id < data.length && data[id] !== null && typeof data[id] === 'object') {
                    // 已有条目
                    if (reg.mode === 'merge') {
                        for (const field of Object.keys(entry)) {
                            if (field === 'id' || field === '_delete' || field === 'stableKey') continue;
                            _trackFieldTouch(dataType, id, field, entry[field], reg.modName, reg.order, reg.regSource);
                        }
                        deepMerge(data[id], entry);
                        modifiedCount++;
                    } else if (reg.mode === 'replace') {
                        _trackFieldTouch(dataType, id, '_whole', entry, reg.modName, reg.order, reg.regSource);
                        data[id] = entry;
                        modifiedCount++;
                    } else if (reg.mode === 'add') {
                        log(2, `Skipped ${dataType}[${id}] (exists, mode=add)`);
                    }
                } else {
                    // 新条目：收紧 id
                    const slotId = GameAdapters.compactNewEntryId(data, entry, dataType);
                    ensureArrayIndex(data, slotId);
                    entry.id = slotId;
                    data[slotId] = entry;
                    modifiedCount++;

                    // 更新 stableKey
                    if (entry.stableKey) {
                        const skEntry = _stableKeyRegistry.get(entry.stableKey);
                        if (skEntry) skEntry.currentId = slotId;
                    }
                }

                // 重新提取元数据
                const appliedId = entry.id;
                if (data[appliedId] && typeof data[appliedId] === 'object' && DataManager.extractMetadata) {
                    DataManager.extractMetadata(data[appliedId]);
                }
            }
        }

        if (modifiedCount > 0) {
            log(1, `Applied ${modifiedCount} modifications to ${globalName}`);
        }
    }

    /**
     * 对象类型数据合并（System 等）
     */
    function _applyObjectDataModifications(globalName, dataType, data) {
        const registrations = _dataRegistry.get(dataType);
        if (!registrations || !registrations.length) return;

        const sorted = registrations.slice().sort((a, b) => a.order - b.order);
        let modified = false;

        for (const reg of sorted) {
            for (const entry of reg.entries) {
                if (!entry || typeof entry !== 'object') continue;

                if (reg.mode === 'replace') {
                    for (const key of Object.keys(entry)) {
                        if (key === '_delete' || key === 'stableKey') continue;
                        _trackFieldTouch(dataType, 0, key, entry[key], reg.modName, reg.order, reg.regSource);
                        data[key] = entry[key];
                    }
                } else if (reg.mode === 'add') {
                    for (const key of Object.keys(entry)) {
                        if (key === '_delete' || key === 'stableKey') continue;
                        if (!(key in data)) {
                            _trackFieldTouch(dataType, 0, key, entry[key], reg.modName, reg.order, reg.regSource);
                            data[key] = entry[key];
                        }
                    }
                } else {
                    for (const key of Object.keys(entry)) {
                        if (key === '_delete' || key === 'stableKey') continue;
                        _trackFieldTouch(dataType, 0, key, entry[key], reg.modName, reg.order, reg.regSource);
                    }
                    deepMerge(data, entry);
                }
                modified = true;
            }
        }

        if (modified) log(1, `Applied modifications to ${globalName} (object)`);
    }

    // ═══════════════════════════════════════════════════════════
    //  10. Map Data System
    // ═══════════════════════════════════════════════════════════

    /**
     * 对地图数据应用修改（event 级浅合并）
     */
    function _applyMapModifications(mapId, mapData) {
        if (!mapData) return;
        const registrations = _mapRegistry.get(mapId);
        if (!registrations || !registrations.length) return;

        const sorted = registrations.slice().sort((a, b) => a.order - b.order);
        let modified = false;

        for (const reg of sorted) {
            if (reg.mode === 'replace') {
                Object.assign(mapData, reg.data);
                modified = true;
            } else {
                // merge：深度合并顶层字段
                const mergeData = Object.assign({}, reg.data);
                delete mergeData.events; // events 单独处理
                deepMerge(mapData, mergeData);
                modified = true;
            }

            // event 级浅合并
            if (reg.data.events && Array.isArray(reg.data.events)) {
                _mergeMapEvents(mapData, reg.data.events, reg.mode);
            }
        }

        if (modified) {
            log(1, `Applied map modifications to Map${mapId}`);
            // 重新提取事件元数据
            if (mapData.events && DataManager.extractMetadata) {
                for (const ev of mapData.events) {
                    if (ev) DataManager.extractMetadata(ev);
                }
            }
        }
    }

    /**
     * 地图事件浅合并（按 id merge/replace/add，不深入 pages）
     */
    function _mergeMapEvents(mapData, modEvents, mode) {
        if (!mapData.events) mapData.events = [];

        for (const event of modEvents) {
            if (!event || typeof event !== 'object') continue;
            const id = event.id;
            if (id === undefined || id === null) continue;

            if (event._delete === true) {
                if (id < mapData.events.length) mapData.events[id] = null;
                continue;
            }

            if (id < mapData.events.length && mapData.events[id] !== null) {
                if (mode === 'merge') {
                    // 浅合并：只合并顶层字段，pages 用替换
                    const mergeEvent = Object.assign({}, event);
                    if (event.pages) {
                        mergeEvent.pages = event.pages; // 整组替换 pages
                    }
                    deepMerge(mapData.events[id], mergeEvent);
                } else if (mode === 'replace') {
                    mapData.events[id] = event;
                }
            } else {
                ensureArrayIndex(mapData.events, id);
                mapData.events[id] = event;
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  11. Stable ID Migration
    // ═══════════════════════════════════════════════════════════

    /**
     * 按 stableKey 在 $dataXxx 中查找当前 id
     */
    function _findCurrentIdByStableKey(dataType, stableKey, data) {
        if (!data) {
            const globalName = '$data' + dataType;
            data = window[globalName];
        }
        if (!data || !Array.isArray(data)) return -1;

        const marker = `<${STABLE_KEY_PREFIX}${stableKey}>`;
        for (let i = 1; i < data.length; i++) {
            const item = data[i];
            if (!item || !item.note) continue;
            if (item.note.includes(marker)) return i;
        }
        return -1;
    }

    /**
     * 公开 API：按 stableKey 查找当前 id
     */
    function findIdByStableKey(dataType, stableKey) {
        return _findCurrentIdByStableKey(dataType, stableKey);
    }

    /**
     * 执行存档迁移
     */
    function migrateSaveData() {
        if (!Params.enableMigration) return;
        if (!$gameParty || !$gameSystem) return;

        // 初始化迁移状态
        $gameSystem._mdlMigration = $gameSystem._mdlMigration || {};

        for (const [stableKey, skEntry] of _stableKeyRegistry) {
            const dataType = skEntry.dataType;
            const globalName = '$data' + dataType;
            const data = window[globalName];
            if (!data) continue;

            // 查找当前 id
            const currentId = _findCurrentIdByStableKey(dataType, stableKey, data);
            if (currentId < 0) {
                log(2, `Migration: stableKey ${stableKey} not found in ${globalName}`);
                continue;
            }
            skEntry.currentId = currentId;

            // 读取存档中的旧 id
            const migrationKey = `${dataType}:${stableKey}`;
            const oldId = $gameSystem._mdlMigration[migrationKey];

            if (oldId !== undefined && oldId !== currentId) {
                // id 发生了变化，执行迁移
                const migrated = _migrateReferences(dataType, oldId, currentId);
                _migrationLog.push({
                    stableKey, oldId, newId: currentId, migrated
                });
                log(1, `Migration: ${stableKey} ${oldId} → ${currentId}`, migrated);
            }

            // 更新存档中的映射
            $gameSystem._mdlMigration[migrationKey] = currentId;
        }
    }

    /**
     * 迁移存档引用（MVP 范围：_items, _weapons, _armors）
     */
    function _migrateReferences(dataType, oldId, newId) {
        const migrated = {};

        // 映射 dataType → $gameParty 的持有字段
        const partyMap = {
            'Items': '_items',
            'Weapons': '_weapons',
            'Armors': '_armors'
        };

        const partyField = partyMap[dataType];
        if (partyField && $gameParty && $gameParty[partyField]) {
            const storage = $gameParty[partyField];
            if (storage[oldId] !== undefined && storage[oldId] > 0) {
                const qty = storage[oldId];
                storage[newId] = (storage[newId] || 0) + qty;
                delete storage[oldId];
                migrated[partyField] = qty;
            }
        }

        return migrated;
    }

    /**
     * 获取迁移日志
     */
    function getMigrationLog() {
        return _migrationLog.slice();
    }

    // ═══════════════════════════════════════════════════════════
    //  12. Manifest Reading
    // ═══════════════════════════════════════════════════════════

    /**
     * 扫描所有启用 Mod 的 modloader.json，处理 data 段
     */
    function _scanModManifests() {
        if (_manifestScanned) return;
        _manifestScanned = true;

        const basePath = resolveModsBasePath();

        // 读取 mod_config.json
        const configData = readJsonFile(basePath + 'mod_config.json');
        if (!configData) {
            log(1, 'mod_config.json not found, skipping manifest scan');
            return;
        }

        // 遍历每个 mod 条目
        for (const configKey of Object.keys(configData)) {
            const config = configData[configKey];
            if (!config || config.status !== true) continue;

            const parts = configKey.split(':');
            if (parts.length < 3) continue;
            const [source, packageName] = parts;

            // 确定 Mod 目录
            let modDir;
            if (source === 'local') {
                modDir = basePath + '_localmods/' + packageName + '/';
            } else if (source === 'ws') {
                modDir = basePath + '_workshop/' + packageName + '/';
            } else {
                continue;
            }

            // 读取 modloader.json
            const manifest = readJsonFile(modDir + 'modloader.json');
            if (!manifest || !manifest.data || !manifest.data.enabled) continue;

            _pushCallerMod(packageName, config.order || 999);
            try {
                const dataConfig = manifest.data;

                // 处理 records
                if (Array.isArray(dataConfig.records)) {
                    for (const rec of dataConfig.records) {
                        if (!rec.file || !rec.type) continue;
                        if (!isPathSafe(rec.file)) {
                            warn(`Unsafe record path in ${packageName}: ${rec.file}`);
                            continue;
                        }
                        const fullPath = modDir + normalizePath(rec.file);
                        const json = readJsonFile(fullPath);
                        if (!json) continue;

                        let entries;
                        const format = rec.format || 'array';
                        if (format === 'array') {
                            entries = Array.isArray(json) ? json : [json];
                        } else if (format === 'list') {
                            // { "items": [...] } 形式
                            for (const key of Object.keys(json)) {
                                if (Array.isArray(json[key])) { entries = json[key]; break; }
                            }
                            if (!entries) entries = [json];
                        } else if (format === 'inline') {
                            entries = Array.isArray(json) ? json : [json];
                        } else {
                            entries = Array.isArray(json) ? json : [json];
                        }

                        // 映射 type → dataType（首字母大写）
                        const dataType = rec.type.charAt(0).toUpperCase() + rec.type.slice(1);
                        registerData(dataType, entries, 'merge');
                        log(1, `Manifest record: ${packageName} → ${dataType} (${entries.length} entries)`);
                    }
                }

                // 处理 patches
                if (Array.isArray(dataConfig.patches)) {
                    for (const patch of dataConfig.patches) {
                        if (!patch.target || !patch.merge) continue;
                        const dataType = patch.target;

                        if (patch.index !== undefined) {
                            // 数组表 patch：{ target: "Items", index: 1, merge: {...} }
                            const entry = Object.assign({ id: patch.index }, patch.merge);
                            registerData(dataType, [entry], 'merge');
                        } else {
                            // 对象表 patch：{ target: "System", merge: {...} }
                            registerData(dataType, [patch.merge], 'merge');
                        }
                        log(1, `Manifest patch: ${packageName} → ${dataType}`);
                    }
                }
            } finally {
                _popCallerMod();
            }
        }

        log(1, 'Manifest scan complete');
    }

    // ═══════════════════════════════════════════════════════════
    //  13. Async Loading
    // ═══════════════════════════════════════════════════════════

    function _checkReady() {
        if (_pendingAsync.size === 0) {
            for (const cb of _readyCallbacks) {
                try { cb(); } catch (e) { error('onReady callback error:', e); }
            }
            _readyCallbacks.length = 0;
        }
    }

    function isReady() {
        return _pendingAsync.size === 0;
    }

    function onReady(callback) {
        if (typeof callback !== 'function') { error('onReady: callback must be a function'); return; }
        if (_pendingAsync.size === 0) { callback(); }
        else { _readyCallbacks.push(callback); }
    }

    // ═══════════════════════════════════════════════════════════
    //  14. Hook Installation
    // ═══════════════════════════════════════════════════════════

    function installHooks() {
        if (_hooksInstalled) return;
        _hooksInstalled = true;

        if (!Params.enableDataInjection) {
            log(1, 'Data injection disabled, skipping hooks');
            return;
        }

        GameAdapters.installAll();

        // Hook: DataManager.onXhrError — 为缺失文件提供 Mod 替换数据
        const _orig_onXhrError = DataManager.onXhrError;
        DataManager.onXhrError = function(name, src, url) {
            const replacementData = _getReplacementData(name, src);
            if (replacementData !== null) {
                window[name] = replacementData;
                this.onLoad(window[name]);
                log(1, `Provided mod data for missing file: ${src}`);
                return;
            }
            _orig_onXhrError.call(this, name, src, url);
        };

        // Hook: DataManager.loadMapData — 追踪当前地图 ID
        const _orig_loadMapData = DataManager.loadMapData;
        DataManager.loadMapData = function(mapId) {
            _currentMapId = mapId;
            _orig_loadMapData.call(this, mapId);
        };

        // Hook: DataManager.loadDatabase — 确保 manifest 已扫描
        const _orig_loadDatabase = DataManager.loadDatabase;
        DataManager.loadDatabase = function() {
            _scanModManifests();
            _orig_loadDatabase.call(this);
        };

        // Hook: DataManager.isDatabaseLoaded — 等待异步加载
        const _orig_isDatabaseLoaded = DataManager.isDatabaseLoaded;
        DataManager.isDatabaseLoaded = function() {
            if (!_orig_isDatabaseLoaded.call(this)) return false;
            if (_pendingAsync.size > 0) return false;
            return true;
        };

        // Hook: DataManager.createGameObjects — 新游戏时初始化迁移状态
        const _orig_createGameObjects = DataManager.createGameObjects;
        DataManager.createGameObjects = function() {
            _orig_createGameObjects.call(this);
            if (Params.enableMigration && $gameSystem) {
                $gameSystem._mdlMigration = $gameSystem._mdlMigration || {};
            }
        };

        // Hook: DataManager.extractSaveContents — 读档后执行迁移
        const _orig_extractSaveContents = DataManager.extractSaveContents;
        DataManager.extractSaveContents = function(contents) {
            const result = _orig_extractSaveContents.call(this, contents);
            // 延迟到下一帧确保 $gameSystem 已就绪
            setTimeout(() => { migrateSaveData(); }, 0);
            return result;
        };

        log(1, 'All hooks installed');
    }

    /**
     * 检查是否有替换数据（用于缺失文件）
     */
    function _getReplacementData(name, src) {
        // 检查地图注册表
        const mapMatch = src.match(/^Map(\d+)\.json$/);
        if (mapMatch) {
            const mapId = parseInt(mapMatch[1], 10);
            if (_mapRegistry.has(mapId)) {
                const regs = _mapRegistry.get(mapId).slice().sort((a, b) => a.order - b.order);
                let result = null;
                for (const reg of regs) {
                    if (reg.mode === 'replace') {
                        result = JSON.parse(JSON.stringify(reg.data));
                    } else if (result) {
                        deepMerge(result, reg.data);
                    } else {
                        result = JSON.parse(JSON.stringify(reg.data));
                    }
                }
                return result;
            }
        }
        return null;
    }

    // ═══════════════════════════════════════════════════════════
    //  15. Reapply
    // ═══════════════════════════════════════════════════════════

    function reapplyData(dataType) {
        if (!Params.enableDataInjection) { warn('Data injection disabled'); return false; }
        if (!dataType || typeof dataType !== 'string') {
            error('reapplyData: dataType must be a non-empty string'); return false;
        }
        const globalName = dataType.startsWith('$data') ? dataType : '$data' + dataType;
        const shortType = globalName.slice(5);
        if (!_dataRegistry.has(shortType)) {
            warn(`reapplyData: no registrations for ${shortType}`); return false;
        }
        if (window[globalName] === undefined || window[globalName] === null) {
            warn(`reapplyData: ${globalName} not loaded yet`); return false;
        }
        _applyDataModifications(globalName, shortType);
        return true;
    }

    // ═══════════════════════════════════════════════════════════
    //  16. Public API & Initialization
    // ═══════════════════════════════════════════════════════════

    const API = {
        version: VERSION,

        // ── 数据注入 ──
        registerData,
        registerMapData,
        registerDataFromFile,
        registerMapDataFromFile,
        registerStableEntry,

        // ── 智能 ID 迁移 ──
        findIdByStableKey,
        migrateSaveData,
        getMigrationLog,

        // ── 查询 ──
        getDataRegistry() {
            const result = {};
            for (const [dt, regs] of _dataRegistry) {
                result[dt] = regs.map(r => ({
                    entryCount: r.entries.length,
                    mode: r.mode,
                    modName: r.modName,
                    order: r.order,
                    source: r.source
                }));
            }
            return result;
        },

        getResourceRegistry() {
            return {};  // 由 ModResourceLoader 管理
        },

        getData(dataType) {
            const globalName = dataType.startsWith('$') ? dataType : '$data' + dataType;
            return window[globalName] || null;
        },

        getConflictReport: _getConflictReport,
        reapplyData,
        isReady,
        onReady
    };

    // 导出全局 API
    window.ModDataLoader = API;

    // 安装 Hook
    installHooks();

    // 向 ModLoader 注册冲突日志入口
    if (window.ModLoader && typeof window.ModLoader.registerLogEntry === 'function') {
        window.ModLoader.registerLogEntry({
            icon: '⚠',
            label: '数据冲突',
            getReport: _getConflictReport
        });
        log(1, 'Registered conflict log entry with ModLoader');
    } else {
        // ModLoader 可能尚未就绪，延迟注册
        const _origOnLoad = window.addEventListener;
        window.addEventListener('load', () => {
            if (window.ModLoader && typeof window.ModLoader.registerLogEntry === 'function') {
                window.ModLoader.registerLogEntry({
                    icon: '⚠',
                    label: '数据冲突',
                    getReport: _getConflictReport
                });
                log(1, 'Registered conflict log entry with ModLoader (deferred)');
            }
        });
    }

    log(1, `${MOD_NAME} ${VERSION} loaded successfully`);

})();
