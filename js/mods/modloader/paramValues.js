/**
 * ModLoader 参数值规范化（纯逻辑，无 DOM）
 * 存档保存与运行时下发共用
 */
'use strict';

const path = require('path');
const defaultParamTypeKit = require(path.join(__dirname, 'paramTypeKit'));

/**
 * @param {object} deps
 * @param {object} [deps.paramTypeKit]
 * @param {Function} deps.normalizeNoteNewlines
 * @param {Function} deps.normalizeNoteFieldsInStructParam
 */
function createParamValues(deps) {
    const {
        paramTypeKit = defaultParamTypeKit,
        normalizeNoteNewlines,
        normalizeNoteFieldsInStructParam
    } = deps;

    const { isValidColor, sanitizeText, isNoteType, isDatabaseType } = paramTypeKit;

    /**
     * 编辑器 blur / 管道共用：数值 clamp（无 DOM）
     * @param {*} raw
     * @param {{ min?: number, max?: number, fallback?: string }} opts
     * @returns {string}
     */
    function normalizeNumberField(raw, opts) {
        const { min, max, fallback } = opts || {};
        const defaultVal = fallback !== undefined ? fallback : '0';

        if (raw === '' || raw === undefined || raw === null) {
            return defaultVal;
        }

        const trimmed = String(raw).trim();
        if (trimmed === '') {
            return defaultVal;
        }

        let num = Number(trimmed);
        if (isNaN(num)) {
            return defaultVal;
        }

        if (min !== undefined && num < min) num = min;
        if (max !== undefined && num > max) num = max;
        return String(num);
    }

    /**
     * 编辑器 blur / 管道共用：颜色校验（无 DOM）
     * @param {*} raw
     * @param {string} [fallback]
     * @returns {string}
     */
    function normalizeColorField(raw, fallback) {
        const defaultVal = fallback || '#ffffff';
        const trimmed = String(raw || '').trim();
        if (!trimmed || !isValidColor(trimmed)) {
            return defaultVal;
        }
        return trimmed;
    }

    /**
     * 编辑器 blur / 管道共用：文本净化（无 DOM）
     * @param {*} raw
     * @param {string} [fallback]
     * @returns {string}
     */
    function normalizeTextField(raw, fallback) {
        const defaultVal = fallback !== undefined ? fallback : '';
        if (raw === '' || raw === undefined || raw === null) {
            return defaultVal;
        }
        return sanitizeText(String(raw));
    }

    /**
     * 单参数值净化/归一（编辑器保存与运行时下发共用）
     * @param {object} p - 参数定义
     * @param {*} value - 原始值
     * @returns {*}
     */
    function normalizeSingleParamValue(p, value) {
        if (value === '' || value === undefined || value === null) {
            return p.default;
        }
        if (p.type === 'number') {
            return normalizeNumberField(value, {
                min: p.min,
                max: p.max,
                fallback: p.default
            });
        }
        if (p.type === 'color') {
            return normalizeColorField(value, p.default);
        }
        if (isNoteType(p.type)) {
            return normalizeNoteNewlines(sanitizeText(value));
        }
        if (isDatabaseType(p.type)) {
            return String(value);
        }
        if (p.type === 'struct') {
            return normalizeNoteFieldsInStructParam(value || p.default, p.schemaFields);
        }
        if (p.type === 'table') {
            return value || p.default;
        }
        return normalizeTextField(value, p.default);
    }

    /**
     * 为运行时加载组装 PluginManager 参数字典
     * @param {object} mod
     * @returns {Object}
     */
    function buildModFinalParameters(mod) {
        const finalParams = {};
        if (!mod.params) return finalParams;
        mod.params.forEach((p) => {
            const raw = Object.prototype.hasOwnProperty.call(mod.currentParams, p.name)
                ? mod.currentParams[p.name]
                : p.default;
            finalParams[p.name] = normalizeSingleParamValue(p, raw);
        });
        return finalParams;
    }

    /**
     * 参数编辑器保存路径（struct/table 已由 DOM collect 序列化）
     * @param {Array} params
     * @param {Object} values
     * @returns {Object}
     */
    function buildFinalParametersFromValues(params, values) {
        const finalParams = {};
        if (!params) return finalParams;
        params.forEach((p) => {
            const value = values[p.name];
            if (p.type === 'struct' || p.type === 'table') {
                finalParams[p.name] = value || p.default;
                return;
            }
            finalParams[p.name] = normalizeSingleParamValue(p, value);
        });
        return finalParams;
    }

    return {
        normalizeNumberField,
        normalizeColorField,
        normalizeTextField,
        normalizeSingleParamValue,
        buildModFinalParameters,
        buildFinalParametersFromValues
    };
}

module.exports = createParamValues;
