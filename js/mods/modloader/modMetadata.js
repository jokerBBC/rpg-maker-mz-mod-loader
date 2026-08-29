/**
 * ModLoader Mod 元数据与 Schema 解析（纯逻辑，无 DOM）
 * 插件头解析、schema、note 换行、配置回填
 * @define-schema 仅在本文件插件头内有效（每次 parseModInfo 使用局部字典）
 */
'use strict';

/**
 * @param {object} deps
 * @param {import('fs')} deps.fs
 * @param {import('path')} deps.pathMod
 * @param {object} deps.paramTypeKit - 与 paramValues 一致，由调用方注入
 * @param {Function} deps.log
 * @param {Function} deps.t
 * @param {Function} deps.parseDependencyList
 * @param {Function} deps.resolveModConfigEntry
 * @param {Function} deps.normalizeSingleParamValue - 来自 paramValues（调用时读取，避免循环依赖）
 */
function createModMetadata(deps) {
    const { fs, pathMod, log, t, parseDependencyList, resolveModConfigEntry, paramTypeKit } = deps;
    const { isNoteType } = paramTypeKit;

    function normalizeNoteNewlines(text) {
        if (text == null || typeof text !== 'string') return text;
        return text.replace(/\\n/g, '\n');
    }

    function cloneSchemaFields(fields) {
        if (!fields || !Array.isArray(fields)) return [];
        return fields.map((field) => {
            const copy = Object.assign({}, field);
            if (Array.isArray(field.options)) {
                copy.options = field.options.slice();
            }
            if (field.schemaFields) {
                copy.schemaFields = cloneSchemaFields(field.schemaFields);
            }
            return copy;
        });
    }

    function mapSchemaDefinitionItems(schemaObj) {
        return schemaObj.map((item) => ({
            name: item.name || item.param || '',
            type: (item.type || 'string').toLowerCase(),
            text: item.text || item.name || item.param || '',
            desc: item.desc || '',
            default: item.default !== undefined
                ? (isNoteType((item.type || 'string').toLowerCase())
                    ? normalizeNoteNewlines(String(item.default))
                    : String(item.default))
                : undefined,
            min: item.min !== undefined ? Number(item.min) : undefined,
            max: item.max !== undefined ? Number(item.max) : undefined,
            step: item.step !== undefined ? Number(item.step) : undefined,
            options: item.options || [],
            schema: item.schema || undefined
        }));
    }

    function linkNestedSchemaFields(localSchemas) {
        for (const schemaName of Object.keys(localSchemas)) {
            const fields = localSchemas[schemaName];
            for (let i = 0; i < fields.length; i++) {
                const field = fields[i];
                if ((field.type === 'struct' || field.type === 'table') && field.schema) {
                    const nested = localSchemas[field.schema];
                    field.schemaFields = nested ? cloneSchemaFields(nested) : [];
                }
            }
        }
    }

    function parseSchemaDefinitions(metaContent, localSchemas) {
        const schemaRegex = /@define-schema\s+(\w+)\s*\n\s*(.+)/g;
        let match;
        while ((match = schemaRegex.exec(metaContent)) !== null) {
            const schemaName = match[1];
            const jsonStr = match[2].trim();
            try {
                const schemaObj = JSON.parse(jsonStr);
                if (Array.isArray(schemaObj)) {
                    localSchemas[schemaName] = mapSchemaDefinitionItems(schemaObj);
                    log(3, `[Schema] 注册模板: ${schemaName}, 字段数: ${localSchemas[schemaName].length}`);
                } else {
                    log(2, `[Schema] 模板 ${schemaName} 的 JSON 不是数组格式，已跳过`);
                }
            } catch (e) {
                log(1, `[Schema] 解析模板 ${schemaName} 失败:`, jsonStr, e);
            }
        }
    }

    function normalizeNoteFieldsInStructObject(obj, schemaFields) {
        if (!obj || typeof obj !== 'object' || !Array.isArray(schemaFields)) return obj;
        for (let i = 0; i < schemaFields.length; i++) {
            const field = schemaFields[i];
            if (!field || !field.name || !Object.prototype.hasOwnProperty.call(obj, field.name)) continue;
            const key = field.name;
            if (isNoteType(field.type)) {
                obj[key] = normalizeNoteNewlines(String(obj[key] == null ? '' : obj[key]));
            } else if (field.type === 'struct') {
                const raw = obj[key];
                const wasString = typeof raw === 'string';
                let nested = raw;
                if (wasString) {
                    try { nested = JSON.parse(raw); } catch (e) { continue; }
                }
                if (!nested || typeof nested !== 'object') continue;
                normalizeNoteFieldsInStructObject(nested, field.schemaFields || []);
                obj[key] = wasString ? JSON.stringify(nested) : nested;
            }
        }
        return obj;
    }

    function normalizeNoteFieldsInStructParam(value, schemaFields) {
        if (value == null || value === '') return value;
        const wasString = typeof value === 'string';
        let obj;
        try {
            obj = wasString ? JSON.parse(value) : value;
        } catch (e) {
            return value;
        }
        if (!obj || typeof obj !== 'object') return value;
        normalizeNoteFieldsInStructObject(obj, schemaFields || []);
        return wasString ? JSON.stringify(obj) : obj;
    }

    function standardizeDefault(val, type) {
        if (type === 'boolean') {
            const lowerVal = String(val).toLowerCase();
            if (lowerVal === 'true' || lowerVal === '1' || lowerVal === 'on') return 'true';
            return 'false';
        }
        if (isNoteType(type)) {
            return normalizeNoteNewlines(String(val));
        }
        return val;
    }

    function generateDefaultFromSchema(schemaFields) {
        const obj = {};
        for (const field of schemaFields) {
            if (field.type === 'struct') {
                if (field.schemaFields && field.schemaFields.length > 0) {
                    obj[field.name] = JSON.stringify(generateDefaultFromSchema(field.schemaFields));
                } else {
                    obj[field.name] = '{}';
                }
            } else if (field.type === 'table' && field.schema) {
                obj[field.name] = '[]';
            } else if (field.default !== undefined) {
                obj[field.name] = field.default;
            } else {
                if (field.type === 'number') obj[field.name] = '0';
                else if (field.type === 'boolean') obj[field.name] = 'false';
                else if (field.type === 'color') obj[field.name] = '#ffffff';
                else obj[field.name] = '';
            }
        }
        return obj;
    }

    function parseModInfo(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const metaBlockMatch = content.match(/\/\*:[\s\S]*?\*\//);
            if (!metaBlockMatch) {
                return {
                    author: t('detail.labelUnknown'), help: '', params: [], version: undefined,
                    base: undefined, orderAfter: undefined, orderBefore: undefined
                };
            }
            let metaContent = metaBlockMatch[0];

            const lines = metaContent.split(/\r?\n/);
            const cleanedLines = [];
            for (let line of lines) {
                line = line.trim();
                if (line.startsWith('/*:')) {
                    cleanedLines.push('/*:');
                } else if (line === '*/') {
                    cleanedLines.push('*/');
                } else if (line.startsWith('*')) {
                    cleanedLines.push(line.substring(1).replace(/^\s*/, ''));
                } else {
                    cleanedLines.push(line);
                }
            }
            metaContent = cleanedLines.join('\n');

            const localSchemas = {};
            parseSchemaDefinitions(metaContent, localSchemas);
            linkNestedSchemaFields(localSchemas);

            const helpBlockMatch = metaContent.match(/@help\s*\n([\s\S]*?)(?=\n@|\n\*\/|$)/);
            const helpContent = helpBlockMatch ? helpBlockMatch[1].trim() : '';
            const helpBlock = helpBlockMatch ? helpBlockMatch[0] : '';

            const contentWithoutHelp = metaContent.replace(helpBlock, '');

            const authorMatch = contentWithoutHelp.match(/@author\s+(.+?)$/m);
            const versionMatch = contentWithoutHelp.match(/@version\s+(.+?)$/m);
            const baseMatch = contentWithoutHelp.match(/@base\s+(.+?)$/m);
            const orderAfterMatch = contentWithoutHelp.match(/@orderAfter\s+(.+?)$/m);
            const orderBeforeMatch = contentWithoutHelp.match(/@orderBefore\s+(.+?)$/m);

            const paramBlocks = [];
            let currentParam = null;

            const contentLines = contentWithoutHelp.split('\n');
            for (const line of contentLines) {
                if (line === '/*:' || line === '*/') continue;

                if (/^@define-schema\s/.test(line)) continue;

                const paramMatch = line.match(/@param\s+(.+)$/);
                if (paramMatch) {
                    if (currentParam) paramBlocks.push(currentParam);
                    let rawName = paramMatch[1].trim();
                    rawName = rawName.replace(/\{.*?\}\s*/, '');
                    const dashIndex = rawName.indexOf(' - ');
                    if (dashIndex > 0) rawName = rawName.substring(0, dashIndex).trim();
                    currentParam = {
                        name: rawName, type: 'string', text: rawName, desc: '', default: undefined,
                        min: undefined, max: undefined, step: undefined, options: [], schema: undefined
                    };
                    continue;
                }
                if (currentParam) {
                    const typeMatch = line.match(/@type\s+(.+)$/);
                    const descMatch = line.match(/@desc\s+(.+)$/);
                    const defaultMatch = line.match(/@default\s+(.+)$/);
                    const minMatch = line.match(/@min\s+(.+)$/);
                    const maxMatch = line.match(/@max\s+(.+)$/);
                    const stepMatch = line.match(/@step\s+(.+)$/);
                    const optionMatch = line.match(/@option\s+(.+)$/);
                    const textMatch = line.match(/@text\s+(.+)$/);
                    const schemaMatch = line.match(/@schema\s+(.+)$/);

                    if (typeMatch) currentParam.type = typeMatch[1].trim().toLowerCase();
                    else if (textMatch) currentParam.text = textMatch[1].trim();
                    else if (schemaMatch) currentParam.schema = schemaMatch[1].trim();
                    else if (descMatch) currentParam.desc = descMatch[1].trim();
                    else if (defaultMatch) currentParam.default = standardizeDefault(defaultMatch[1].trim(), currentParam.type);
                    else if (minMatch && currentParam.type === 'number') currentParam.min = Number(minMatch[1].trim());
                    else if (maxMatch && currentParam.type === 'number') currentParam.max = Number(maxMatch[1].trim());
                    else if (stepMatch && currentParam.type === 'number') currentParam.step = Number(stepMatch[1].trim());
                    else if (optionMatch && currentParam.type === 'select') currentParam.options.push(optionMatch[1].trim());
                }
            }
            if (currentParam) paramBlocks.push(currentParam);

            for (let p of paramBlocks) {
                if ((p.type === 'struct' || p.type === 'table') && p.schema) {
                    const schemaFields = localSchemas[p.schema];
                    if (schemaFields) {
                        p.schemaFields = cloneSchemaFields(schemaFields);
                        log(3, `[Schema] 参数 "${p.name}" 引用模板 "${p.schema}", 子字段数: ${p.schemaFields.length}`);
                    } else {
                        log(2, `[Schema] 参数 "${p.name}" 引用的模板 "${p.schema}" 不存在！`);
                        p.schemaFields = [];
                    }
                    if (p.default === undefined) {
                        if (p.type === 'struct') {
                            const defaultObj = generateDefaultFromSchema(p.schemaFields);
                            p.default = JSON.stringify(defaultObj);
                        } else {
                            p.default = '[]';
                        }
                        log(3, `[Schema] 参数 "${p.name}" 自动生成默认值: ${p.default}`);
                    }
                }
            }

            for (let p of paramBlocks) {
                if (isNoteType(p.type) && typeof p.default === 'string') {
                    p.default = normalizeNoteNewlines(p.default);
                }
                if (p.schemaFields) {
                    p.schemaFields.forEach(f => {
                        if (isNoteType(f.type) && typeof f.default === 'string') {
                            f.default = normalizeNoteNewlines(f.default);
                        }
                    });
                }
            }

            let isStrictLocked = false;
            for (let p of paramBlocks) {
                if (p.default === undefined) {
                    log(2, `参数严苛校验失败：Mod [${pathMod.basename(filePath)}] 的参数 [${p.name}] 缺少 @default，该Mod参数编辑功能已被锁定。`);
                    isStrictLocked = true;
                    break;
                }
            }

            const baseRaw = baseMatch ? baseMatch[1].trim() : undefined;
            const orderAfterRaw = orderAfterMatch ? orderAfterMatch[1].trim() : undefined;
            const baseList = parseDependencyList(baseRaw);
            const orderAfterList = parseDependencyList(orderAfterRaw);

            return {
                author: authorMatch ? authorMatch[1].trim() : t('detail.labelUnknown'),
                help: helpContent || t('detail.noHelp'),
                version: versionMatch ? versionMatch[1].trim() : undefined,
                base: baseRaw,
                orderAfter: orderAfterRaw,
                baseList: baseList,
                orderAfterList: orderAfterList,
                orderBefore: orderBeforeMatch ? orderBeforeMatch[1].trim() : undefined,
                params: isStrictLocked ? [] : paramBlocks
            };
        } catch (e) {
            log(1, '解析Mod信息异常', e);
            return {
                author: t('detail.labelUnknown'), help: '', params: [], version: undefined,
                base: undefined, orderAfter: undefined, baseList: [], orderAfterList: [], orderBefore: undefined
            };
        }
    }

    function applyModConfigToEntry(modId, filePath, fileName, displayName, config, defaultOrder, scriptBaseName) {
        const info = parseModInfo(filePath);
        const modConfig = resolveModConfigEntry(config, modId, scriptBaseName);
        let status = false;
        const currentParams = {};
        let order = defaultOrder;

        if (typeof modConfig === 'boolean') {
            status = modConfig;
        } else if (modConfig && typeof modConfig === 'object') {
            status = modConfig.status || false;
            if (modConfig.order !== undefined) {
                order = modConfig.order;
            }
            const rawParams = modConfig.params || {};
            const normalize = deps.normalizeSingleParamValue;
            if (typeof normalize !== 'function') {
                throw new Error('modMetadata.applyModConfigToEntry requires deps.normalizeSingleParamValue');
            }
            info.params.forEach(p => {
                const value = Object.prototype.hasOwnProperty.call(rawParams, p.name)
                    ? rawParams[p.name]
                    : undefined;
                currentParams[p.name] = normalize(p, value);
            });
        }

        return {
            id: modId,
            fileName: fileName,
            displayName: displayName || pathMod.parse(fileName).name,
            status: status,
            params: info.params,
            currentParams: currentParams,
            author: info.author,
            help: info.help,
            version: info.version,
            base: info.base,
            orderAfter: info.orderAfter,
            orderBefore: info.orderBefore,
            baseList: info.baseList,
            orderAfterList: info.orderAfterList,
            order: order
        };
    }

    return {
        normalizeNoteNewlines,
        normalizeNoteFieldsInStructObject,
        normalizeNoteFieldsInStructParam,
        standardizeDefault,
        generateDefaultFromSchema,
        parseModInfo,
        applyModConfigToEntry
    };
}

module.exports = createModMetadata;
