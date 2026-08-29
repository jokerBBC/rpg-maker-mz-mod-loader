/**
 * ModLoader 参数类型工具（纯逻辑，无 DOM）
 * 类型判定 / 清洗 / 数据库集合归一
 */
'use strict';

const DB_TYPE_MAP = {
    actor:        { global: '$dataActors',       label: '角色' },
    class:        { global: '$dataClasses',      label: '职业' },
    skill:        { global: '$dataSkills',       label: '技能' },
    item:         { global: '$dataItems',        label: '物品' },
    weapon:       { global: '$dataWeapons',      label: '武器' },
    armor:        { global: '$dataArmors',       label: '防具' },
    enemy:        { global: '$dataEnemies',      label: '敌人' },
    troop:        { global: '$dataTroops',       label: '敌群' },
    state:        { global: '$dataStates',       label: '状态' },
    animation:    { global: '$dataAnimations',   label: '动画' },
    common_event: { global: '$dataCommonEvents', label: '公共事件' },
    switch:       { systemKey: 'switches',       label: '开关' },
    variable:     { systemKey: 'variables',      label: '变量' }
};

function isValidColor(color) {
    if (!color || color === '') return false;

    if (/^#([0-9A-Fa-f]{3}){1,2}$/.test(color)) return true;

    if (/^rgba?\s*\(\s*\d+\s*,\s*\d+\s*,\s*\d+(\s*,\s*(0|1|0?\.\d+))?\s*\)$/i.test(color)) return true;

    if (/^hsla?\s*\(\s*\d+\s*,\s*\d+%?\s*,\s*\d+%?(\s*,\s*(0|1|0?\.\d+))?\s*\)$/i.test(color)) return true;

    const colorNames = ['black', 'white', 'red', 'green', 'blue', 'yellow', 'cyan', 'magenta',
        'gray', 'grey', 'orange', 'purple', 'pink', 'brown', 'lightgray',
        'darkgray', 'lightgrey', 'darkgrey', 'transparent', 'aqua',
        'lime', 'maroon', 'navy', 'olive', 'silver', 'teal', 'violet'];
    if (colorNames.includes(color.toLowerCase())) return true;

    return false;
}

function sanitizeText(text) {
    if (!text || typeof text !== 'string') return text;

    let result = text;

    result = result.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    result = result.replace(/<\/?(iframe|embed|object|applet|form|base|link|meta)\b[^>]*>/gi, '');
    result = result.replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '');
    result = result.replace(/javascript\s*:/gi, '');
    result = result.replace(/data\s*:\s*text\/html/gi, '');
    result = result.replace(/vbscript\s*:/gi, '');

    return result;
}

function isDatabaseType(type) {
    return Object.prototype.hasOwnProperty.call(DB_TYPE_MAP, type);
}

function getDbLabel(type, t) {
    if (typeof t === 'function') {
        const key = 'db.' + type;
        const translated = t(key);
        if (translated !== key) return translated;
    }
    const mapping = DB_TYPE_MAP[type];
    return mapping ? mapping.label : type;
}

function normalizeDatabaseCollection(data) {
    if (!data) return null;
    if (Array.isArray(data)) return data;
    if (typeof data !== 'object') return null;
    const keys = Object.keys(data)
        .map(Number)
        .filter(function(n) { return Number.isInteger(n) && n >= 0; });
    if (keys.length === 0) return null;
    let max = 0;
    for (let i = 0; i < keys.length; i++) {
        if (keys[i] > max) max = keys[i];
    }
    const arr = new Array(max + 1);
    for (let i = 0; i < keys.length; i++) {
        arr[keys[i]] = data[keys[i]];
    }
    return arr;
}

function resolveDataRoot(dataRoot) {
    if (dataRoot != null) return dataRoot;
    if (typeof window !== 'undefined') return window;
    if (typeof globalThis !== 'undefined') return globalThis;
    return null;
}

/** 从 RMMZ 全局读取 $dataXxx（require 模块作用域下 window 可能拿不到） */
function readRmmzGlobal(root, globalName) {
    if (root && root[globalName] != null) return root[globalName];
    try {
        return Function('return typeof ' + globalName + ' !== "undefined" ? ' + globalName + ' : null')();
    } catch (e) { /* ignore */ }
    return null;
}

function getDatabaseArray(type, dataRoot) {
    const mapping = DB_TYPE_MAP[type];
    if (!mapping) return null;
    const root = resolveDataRoot(dataRoot);
    try {
        if (mapping.systemKey) {
            const system = (root && root.$dataSystem) || readRmmzGlobal(root, '$dataSystem');
            if (system && Array.isArray(system[mapping.systemKey])) {
                return system[mapping.systemKey];
            }
            return null;
        }
        const data = (root && root[mapping.global]) || readRmmzGlobal(root, mapping.global);
        return normalizeDatabaseCollection(data);
    } catch (e) { /* 忽略 */ }
    return null;
}

function getDatabaseEntryName(entry) {
    if (entry == null) return '';
    if (typeof entry === 'string') return entry.trim();
    if (typeof entry === 'object' && entry.name != null) return String(entry.name).trim();
    return '';
}

function isNoteType(type) {
    return type === 'note' || type === 'multiline_string';
}

function calculateStep(param) {
    if (param.step !== undefined && !isNaN(param.step) && param.step > 0) {
        return param.step;
    }

    if (param.min === undefined || param.max === undefined) {
        return 1;
    }

    const min = param.min;
    const max = param.max;
    const range = max - min;

    function getDecimalPlaces(num) {
        const str = num.toString();
        const dotIndex = str.indexOf('.');
        return dotIndex === -1 ? 0 : str.length - dotIndex - 1;
    }

    const minDecimals = getDecimalPlaces(min);
    const maxDecimals = getDecimalPlaces(max);
    const maxDecimalPlaces = Math.max(minDecimals, maxDecimals);

    if (maxDecimalPlaces > 0) {
        if (range <= 1) {
            return 0.1;
        } else if (range <= 10) {
            return 0.5;
        } else {
            return Math.pow(10, -maxDecimalPlaces);
        }
    }

    return 1;
}

module.exports = {
    DB_TYPE_MAP,
    isValidColor,
    sanitizeText,
    isDatabaseType,
    getDbLabel,
    normalizeDatabaseCollection,
    getDatabaseArray,
    getDatabaseEntryName,
    isNoteType,
    calculateStep
};
