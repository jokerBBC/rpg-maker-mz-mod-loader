/**
 * ModLoader libs 扩展 · 配置预设（纯逻辑 + 日志壳一体 UI）
 *
 * 存在即生效，删除即关闭。纯逻辑 createModPresets 同文件导出供单测 require。
 * 版本历史仅存预设文件；当前版本由调用方注入的 resolvePackageVersion 现算。
 */
'use strict';

const PRESET_NAME_MAX = 64;
const PRESET_FILE_EXT = '.json';

/**
 * @param {object} deps
 * @param {import('fs')} deps.fs
 * @param {import('path')} deps.pathMod
 * @param {Function} deps.log
 * @param {string} deps.presetsDir
 * @param {Function} deps.resolvePackageVersion
 * @param {Function} [deps.getPackageDisplayName]
 */
function createModPresets(deps) {
    const {
        fs,
        pathMod,
        log,
        presetsDir,
        resolvePackageVersion,
        getPackageDisplayName
    } = deps;

    function ensurePresetsDir() {
        if (!fs.existsSync(presetsDir)) {
            fs.mkdirSync(presetsDir, { recursive: true });
        }
    }

    /**
     * 自定义名 → 安全文件名基名（无扩展名）
     * @returns {string|null}
     */
    function sanitizePresetFileBase(name) {
        if (name == null) return null;
        let s = String(name).trim();
        if (!s) return null;
        s = s.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/\s+/g, ' ').trim();
        s = s.replace(/^\.+/, '').replace(/\.+$/, '').trim();
        if (!s || s === '.' || s === '..') return null;
        if (s.length > PRESET_NAME_MAX) s = s.slice(0, PRESET_NAME_MAX).trim();
        return s || null;
    }

    function presetPathForBase(fileBase) {
        return pathMod.join(presetsDir, fileBase + PRESET_FILE_EXT);
    }

    function displayNameOf(mod) {
        if (typeof getPackageDisplayName === 'function') {
            try {
                const n = getPackageDisplayName(mod);
                if (n) return n;
            } catch (e) { /* fall through */ }
        }
        return (mod && (mod.displayName || mod.name || mod.id)) || '';
    }

    function snapshotModEntry(mod) {
        const ver = resolvePackageVersion(mod);
        return {
            status: !!mod.status,
            order: mod.order != null ? Number(mod.order) : 0,
            params: mod.currentParams && typeof mod.currentParams === 'object'
                ? JSON.parse(JSON.stringify(mod.currentParams))
                : {},
            version: ver != null && String(ver).trim() ? String(ver).trim() : null
        };
    }

    function buildPresetDocument(name, modList) {
        const mods = {};
        (modList || []).forEach(function(mod) {
            if (!mod || !mod.id) return;
            mods[mod.id] = snapshotModEntry(mod);
        });
        return {
            name: name,
            savedAt: new Date().toISOString(),
            mods: mods
        };
    }

    function listPresets() {
        ensurePresetsDir();
        let names = [];
        try {
            names = fs.readdirSync(presetsDir);
        } catch (e) {
            log(1, '读取预设目录失败: ' + e.message);
            return [];
        }
        const list = [];
        names.forEach(function(f) {
            if (!f.toLowerCase().endsWith(PRESET_FILE_EXT)) return;
            const base = f.slice(0, -PRESET_FILE_EXT.length);
            if (!base) return;
            const full = pathMod.join(presetsDir, f);
            let savedAt = null;
            let name = base;
            let enabledCount = 0;
            try {
                const raw = JSON.parse(fs.readFileSync(full, 'utf-8'));
                if (raw && typeof raw === 'object') {
                    if (raw.name) name = String(raw.name);
                    if (raw.savedAt) savedAt = String(raw.savedAt);
                    if (raw.mods && typeof raw.mods === 'object') {
                        Object.keys(raw.mods).forEach(function(id) {
                            if (raw.mods[id] && raw.mods[id].status) enabledCount++;
                        });
                    }
                }
            } catch (e) {
                log(2, '预设文件损坏，仍列入: ' + f);
            }
            list.push({
                fileBase: base,
                name: name,
                savedAt: savedAt,
                enabledCount: enabledCount
            });
        });
        list.sort(function(a, b) {
            const ta = a.savedAt ? Date.parse(a.savedAt) : 0;
            const tb = b.savedAt ? Date.parse(b.savedAt) : 0;
            const na = Number.isFinite(ta) ? ta : 0;
            const nb = Number.isFinite(tb) ? tb : 0;
            if (nb !== na) return nb - na;
            return String(a.name).localeCompare(String(b.name), 'zh');
        });
        return list;
    }

    function loadPreset(fileBase) {
        const base = sanitizePresetFileBase(fileBase);
        if (!base) return null;
        const full = presetPathForBase(base);
        if (!fs.existsSync(full)) return null;
        try {
            const raw = JSON.parse(fs.readFileSync(full, 'utf-8'));
            if (!raw || typeof raw !== 'object') return null;
            return {
                fileBase: base,
                name: raw.name ? String(raw.name) : base,
                savedAt: raw.savedAt ? String(raw.savedAt) : null,
                mods: raw.mods && typeof raw.mods === 'object' ? raw.mods : {}
            };
        } catch (e) {
            log(1, '读取预设失败: ' + e.message);
            return null;
        }
    }

    /**
     * @returns {{ ok: boolean, fileBase?: string, error?: string }}
     */
    function savePreset(name, modList) {
        const base = sanitizePresetFileBase(name);
        if (!base) return { ok: false, error: 'invalid-name' };
        ensurePresetsDir();
        const full = presetPathForBase(base);
        const doc = buildPresetDocument(name.trim(), modList);
        doc.name = name.trim();
        try {
            fs.writeFileSync(full, JSON.stringify(doc, null, 2), 'utf-8');
            return { ok: true, fileBase: base };
        } catch (e) {
            log(1, '写入预设失败: ' + e.message);
            return { ok: false, error: 'write-failed' };
        }
    }

    function deletePreset(fileBase) {
        const base = sanitizePresetFileBase(fileBase);
        if (!base) return false;
        const full = presetPathForBase(base);
        if (!fs.existsSync(full)) return false;
        try {
            fs.unlinkSync(full);
            return true;
        } catch (e) {
            log(1, '删除预设失败: ' + e.message);
            return false;
        }
    }

    function formatVersionLabel(version, unknownLabel) {
        if (version != null && String(version).trim()) return String(version).trim();
        return unknownLabel || '未知版本';
    }

    /**
     * @param {object} preset loadPreset 结果
     * @param {Array} modList 当前扫描列表
     * @param {{ unknownVersion?: string }} [opts]
     */
    function buildPresetDiff(preset, modList, opts) {
        const unknown = (opts && opts.unknownVersion) || '未知版本';
        const byId = {};
        (modList || []).forEach(function(m) {
            if (m && m.id) byId[m.id] = m;
        });

        const willEnable = [];
        const willClose = [];
        const mods = (preset && preset.mods) || {};

        Object.keys(mods).forEach(function(id) {
            const entry = mods[id];
            if (!entry || !entry.status) return;

            const presetVersion = entry.version != null && String(entry.version).trim()
                ? String(entry.version).trim()
                : null;
            const order = entry.order != null ? Number(entry.order) || 0 : 0;
            const current = byId[id];

            if (!current) {
                willEnable.push({
                    id: id,
                    name: id,
                    order: order,
                    missing: true,
                    presetVersion: presetVersion,
                    presetVersionLabel: formatVersionLabel(presetVersion, unknown),
                    currentVersion: null,
                    currentVersionLabel: formatVersionLabel(null, unknown),
                    versionChanged: true
                });
                return;
            }

            const currentVersion = resolvePackageVersion(current);
            const currentNorm = currentVersion != null && String(currentVersion).trim()
                ? String(currentVersion).trim()
                : null;

            willEnable.push({
                id: id,
                name: displayNameOf(current),
                order: order,
                missing: false,
                presetVersion: presetVersion,
                presetVersionLabel: formatVersionLabel(presetVersion, unknown),
                currentVersion: currentNorm,
                currentVersionLabel: formatVersionLabel(currentNorm, unknown),
                versionChanged: presetVersion !== currentNorm
            });
        });

        (modList || []).forEach(function(m) {
            if (!m || !m.id || !m.status) return;
            const entry = mods[m.id];
            if (entry && entry.status) return;
            willClose.push({
                id: m.id,
                name: displayNameOf(m),
                notInPreset: !entry,
                reason: entry ? 'inPresetOff' : 'notInPreset'
            });
        });

        willEnable.sort(function(a, b) {
            if (a.order !== b.order) return a.order - b.order;
            return String(a.id).localeCompare(String(b.id));
        });
        willClose.sort(function(a, b) {
            if (a.notInPreset !== b.notInPreset) return a.notInPreset ? 1 : -1;
            return String(a.name).localeCompare(String(b.name), 'zh');
        });

        const missing = willEnable.filter(function(r) { return r.missing; });
        const enabledPresent = willEnable.filter(function(r) { return !r.missing; });

        return {
            willEnable: willEnable,
            willClose: willClose,
            enabled: enabledPresent,
            missing: missing,
            missingCount: missing.length,
            enabledCount: enabledPresent.length,
            willEnableCount: willEnable.length,
            willCloseCount: willClose.length,
            versionChangedCount: enabledPresent.filter(function(r) { return r.versionChanged; }).length
        };
    }

    /**
     * 将预设应用到 modList（就地修改并按预设 order 重排数组）
     * - 预设内条目：写 status / params / order
     * - 当前列表有、预设无：关闭（status=false）
     * - 然后按预设 order 排序（不在预设的排后面），再写成连续 1…n
     * @returns {{ applied: number, skippedMissing: number, closedNotInPreset: number }}
     */
    function applyPresetToModList(preset, modList) {
        const mods = (preset && preset.mods) || {};
        if (!Array.isArray(modList)) {
            return { applied: 0, skippedMissing: 0, closedNotInPreset: 0 };
        }

        const byId = {};
        modList.forEach(function(m) {
            if (m && m.id) byId[m.id] = m;
        });

        let applied = 0;
        let skippedMissing = 0;
        let closedNotInPreset = 0;

        Object.keys(mods).forEach(function(id) {
            const entry = mods[id];
            if (!entry || typeof entry !== 'object') return;
            const mod = byId[id];
            if (!mod) {
                skippedMissing++;
                return;
            }
            mod.status = !!entry.status;
            if (entry.order != null) mod.order = Number(entry.order) || 0;
            if (entry.params && typeof entry.params === 'object') {
                mod.currentParams = JSON.parse(JSON.stringify(entry.params));
            }
            applied++;
        });

        modList.forEach(function(mod) {
            if (!mod || !mod.id) return;
            if (Object.prototype.hasOwnProperty.call(mods, mod.id)) return;
            if (mod.status) closedNotInPreset++;
            mod.status = false;
        });

        modList.sort(function(a, b) {
            const ea = mods[a.id];
            const eb = mods[b.id];
            const inA = !!ea;
            const inB = !!eb;
            if (inA && inB) {
                const oa = ea.order != null ? Number(ea.order) || 0 : 0;
                const ob = eb.order != null ? Number(eb.order) || 0 : 0;
                if (oa !== ob) return oa - ob;
                return String(a.id).localeCompare(String(b.id));
            }
            if (inA && !inB) return -1;
            if (!inA && inB) return 1;
            return String(a.id).localeCompare(String(b.id));
        });

        modList.forEach(function(mod, index) {
            mod.order = index + 1;
        });

        return {
            applied: applied,
            skippedMissing: skippedMissing,
            closedNotInPreset: closedNotInPreset
        };
    }

    return {
        PRESET_NAME_MAX,
        ensurePresetsDir,
        sanitizePresetFileBase,
        listPresets,
        loadPreset,
        savePreset,
        deletePreset,
        buildPresetDocument,
        buildPresetDiff,
        applyPresetToModList,
        formatVersionLabel
    };
}

(function bootstrapModConfigPresets() {
    'use strict';

    const ML = typeof window !== 'undefined' ? window.ModLoader : null;
    if (!ML || typeof ML.registerLogEntry !== 'function') {
        return;
    }
    if (typeof ML.getManagedModList !== 'function' || typeof ML.afterManagedPresetApplied !== 'function') {
        if (typeof console !== 'undefined' && console.warn) {
            console.warn('[modConfigPresets] ModLoader 预设 API 不可用，扩展未挂载');
        }
        return;
    }

    const fs = require('fs');
    const pathMod = require('path');
    const MODS_DIR = pathMod.join(process.cwd(), 'js', 'mods');
    const PRESETS_DIR = pathMod.join(MODS_DIR, 'config', 'mod_presets');

    function mlT(key) {
        if (typeof ML.t === 'function') return ML.t(key);
        return key;
    }

    function logFn(level, msg) {
        if (level <= 1) console.error('[modConfigPresets]', msg);
        else if (level === 2) console.warn('[modConfigPresets]', msg);
        else console.log('[modConfigPresets]', msg);
    }

    const modPresets = createModPresets({
        fs: fs,
        pathMod: pathMod,
        log: logFn,
        presetsDir: PRESETS_DIR,
        resolvePackageVersion: function (mod) {
            return typeof ML.resolvePackageVersion === 'function'
                ? ML.resolvePackageVersion(mod)
                : null;
        },
        getPackageDisplayName: function (mod) {
            return typeof ML.getPackageDisplayName === 'function'
                ? ML.getPackageDisplayName(mod)
                : (mod && (mod.displayName || mod.name || mod.id)) || '';
        }
    });

    const {
        listPresets,
        loadPreset,
        savePreset,
        deletePreset,
        buildPresetDiff,
        applyPresetToModList
    } = modPresets;

    function escHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatSavedAtDisplay(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        function p(n) { return n < 10 ? '0' + n : String(n); }
        return d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate()) +
            '  ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
    }

    function formatListMetaHtml(p) {
        const count = escHtml(mlT('preset.enabledCount').replace('{n}', String(p.enabledCount)));
        const time = formatSavedAtDisplay(p.savedAt);
        let html = '<span class="ml-presets-list-meta">';
        html += '<span class="ml-presets-list-count">' + count + '</span>';
        if (time) {
            html += '<span class="ml-presets-list-time">' + escHtml(time) + '</span>';
        }
        html += '</span>';
        return html;
    }

    function ensureStyles() {
        if (document.getElementById('ml-presets-styles')) return;
        const style = document.createElement('style');
        style.id = 'ml-presets-styles';
        style.textContent = [
            '.ml-presets{display:flex;flex-direction:column;height:100%;min-height:0;box-sizing:border-box;font-size:13px;color:var(--ml-text-primary,#e8e8ec);}',
            '.ml-presets-body{flex:1;min-height:0;display:flex;overflow:hidden;}',
            '.ml-presets-list-col{width:280px;flex-shrink:0;border-right:1px solid var(--ml-border,rgba(255,255,255,.08));padding:12px 16px;display:flex;flex-direction:column;gap:10px;min-height:0;box-sizing:border-box;}',
            '.ml-presets-save-btn{width:100%;}',
            '.ml-presets-save-form{display:flex;flex-direction:column;gap:8px;flex-shrink:0;}',
            '.ml-presets-save-actions{display:flex;gap:8px;}',
            '.ml-presets-list{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;gap:6px;}',
            '.ml-presets-list-item{display:flex;flex-direction:column;align-items:stretch;gap:2px;width:100%;text-align:left;padding:8px 10px;border:1px solid var(--ml-border,rgba(255,255,255,.08));border-radius:6px;background:transparent;color:var(--ml-text-primary,#e8e8ec);cursor:pointer;box-sizing:border-box;}',
            '.ml-presets-list-item:hover{background:var(--ml-bg-active,rgba(74,158,255,.08));}',
            '.ml-presets-list-item.is-active{border-color:var(--ml-accent,#4a9eff);background:var(--ml-bg-active,rgba(74,158,255,.12));}',
            '.ml-presets-list-name{font-weight:600;font-size:13px;}',
            '.ml-presets-list-meta{display:flex;justify-content:space-between;align-items:baseline;gap:8px;width:100%;font-size:11px;color:var(--ml-text-secondary,#9a9ab0);}',
            '.ml-presets-list-count{flex-shrink:0;}',
            '.ml-presets-list-time{flex-shrink:0;margin-left:auto;text-align:right;font-variant-numeric:tabular-nums;}',
            '.ml-presets-preview-col{flex:1;min-width:0;min-height:0;padding:12px 16px;display:flex;flex-direction:column;gap:10px;overflow-y:auto;overflow-x:hidden;box-sizing:border-box;}',
            '.ml-presets-preview-title{font-size:15px;font-weight:600;flex-shrink:0;}',
            '.ml-presets-section{display:flex;flex-direction:column;gap:6px;}',
            '.ml-presets-section-label{font-size:12px;color:var(--ml-text-secondary,#9a9ab0);font-weight:600;}',
            '.ml-presets-hint{font-size:11px;color:var(--ml-warning,#ffa726);line-height:1.45;}',
            '.ml-presets-row{display:flex;justify-content:space-between;gap:12px;align-items:baseline;padding:4px 0;border-bottom:1px solid var(--ml-border,rgba(255,255,255,.06));font-size:12px;}',
            '.ml-presets-row-missing{opacity:.75;}',
            '.ml-presets-row-changed .ml-presets-row-ver{color:var(--ml-warning,#ffa726);}',
            '.ml-presets-row-close{opacity:.85;}',
            '.ml-presets-row-name{flex:1;min-width:0;word-break:break-word;}',
            '.ml-presets-row-ver{flex-shrink:0;color:var(--ml-text-muted,#666680);font-size:11px;}',
            '.ml-presets-actions{display:flex;gap:8px;flex-wrap:wrap;padding-top:8px;margin-top:auto;flex-shrink:0;}',
            '.ml-presets-empty{padding:16px 4px;color:var(--ml-text-muted,#666680);font-size:12px;line-height:1.5;}',
            '.ml-presets-error{padding:8px 16px;color:var(--ml-danger,#ef5350);font-size:12px;flex-shrink:0;}'
        ].join('\n');
        document.head.appendChild(style);
    }

    function confirmAction(title, message, onOk) {
        if (typeof ML.showConfirmDialog !== 'function') {
            if (window.confirm(message) && typeof onOk === 'function') onOk();
            return;
        }
        ML.showConfirmDialog(title, message, [
            {
                text: mlT('button.cancel'),
                class: 'ml-btn-secondary',
                action: function () {
                    if (typeof ML.hideConfirmDialog === 'function') ML.hideConfirmDialog();
                }
            },
            {
                text: mlT('dialog.ok'),
                class: 'ml-btn-primary',
                action: function () {
                    if (typeof ML.hideConfirmDialog === 'function') ML.hideConfirmDialog();
                    if (typeof onOk === 'function') onOk();
                }
            }
        ]);
    }

    function getModList() {
        const list = ML.getManagedModList();
        return Array.isArray(list) ? list : [];
    }

    function applyFromPanel(preset, andSave) {
        applyPresetToModList(preset, getModList());
        ML.afterManagedPresetApplied({ save: !!andSave });
        console.info('[modConfigPresets]', andSave ? '预设已应用并保存' : '预设已应用（未保存）');
    }

    function renderPanel(container) {
        ensureStyles();
        if (!container) return;
        container.classList.add('ml-presets-panel-root');

        let selectedBase = null;
        let diff = null;
        let presetName = '';
        let showSaveForm = false;
        let errorMsg = '';

        function setError(msg) {
            errorMsg = msg || '';
            const el = container.querySelector('.ml-presets-error');
            if (!el) return;
            if (errorMsg) {
                el.textContent = errorMsg;
                el.style.display = '';
            } else {
                el.textContent = '';
                el.style.display = 'none';
            }
        }

        function selectPreset(fileBase) {
            setError('');
            selectedBase = fileBase;
            const preset = loadPreset(fileBase);
            if (!preset) {
                diff = null;
                presetName = '';
                setError(mlT('preset.errorLoad'));
                paint();
                return;
            }
            presetName = preset.name;
            diff = buildPresetDiff(preset, getModList(), {
                unknownVersion: mlT('preset.unknownVersion')
            });
            paint();
        }

        function doSave() {
            setError('');
            const input = container.querySelector('#ml-presets-new-name');
            const newName = input ? input.value : '';
            const result = savePreset(newName, getModList());
            if (!result || !result.ok) {
                setError(mlT('preset.errorSave'));
                return;
            }
            showSaveForm = false;
            selectedBase = result.fileBase;
            const still = (listPresets() || []).some(function (p) { return p.fileBase === selectedBase; });
            if (still) selectPreset(selectedBase);
            else paint();
        }

        function doDelete() {
            if (!selectedBase) return;
            const base = selectedBase;
            const name = presetName || base;
            confirmAction(
                mlT('confirm.title'),
                mlT('preset.confirmDelete').replace('{name}', name),
                function () {
                    deletePreset(base);
                    selectedBase = null;
                    diff = null;
                    presetName = '';
                    paint();
                }
            );
        }

        function requestApply(mode) {
            if (!selectedBase) return;
            const preset = loadPreset(selectedBase);
            if (!preset) {
                setError(mlT('preset.errorLoad'));
                return;
            }
            const d = diff || buildPresetDiff(preset, getModList(), {
                unknownVersion: mlT('preset.unknownVersion')
            });
            const run = function () {
                applyFromPanel(preset, mode === 'save');
            };
            if (d.missingCount > 0) {
                confirmAction(
                    mlT('confirm.title'),
                    mlT('preset.confirmSkipMissing').replace('{n}', String(d.missingCount)),
                    run
                );
            } else {
                run();
            }
        }

        function paint() {
            const presets = listPresets() || [];
            let listHtml = '';
            if (!presets.length) {
                listHtml = '<div class="ml-presets-empty">' + escHtml(mlT('preset.emptyList')) + '</div>';
            } else {
                listHtml = presets.map(function (p) {
                    const active = selectedBase === p.fileBase ? ' is-active' : '';
                    return (
                        '<button type="button" class="ml-presets-list-item' + active + '" data-preset-base="' + escHtml(p.fileBase) + '">' +
                        '<span class="ml-presets-list-name">' + escHtml(p.name) + '</span>' +
                        formatListMetaHtml(p) + '</button>'
                    );
                }).join('');
            }

            let saveFormHtml = '';
            if (showSaveForm) {
                saveFormHtml =
                    '<div class="ml-presets-save-form">' +
                    '<input class="ml-form-input" id="ml-presets-new-name" placeholder="' + escHtml(mlT('preset.namePlaceholder')) + '">' +
                    '<div class="ml-presets-save-actions">' +
                    '<button type="button" class="ml-btn ml-btn-primary ml-btn-sm" id="ml-presets-save-ok">' + escHtml(mlT('button.save')) + '</button>' +
                    '<button type="button" class="ml-btn ml-btn-secondary ml-btn-sm" id="ml-presets-save-cancel">' + escHtml(mlT('button.cancel')) + '</button>' +
                    '</div></div>';
            }

            let previewHtml = '';
            if (!selectedBase) {
                previewHtml = '<div class="ml-presets-empty">' + escHtml(mlT('preset.emptyPreview')) + '</div>';
            } else {
                const willEnable = (diff && diff.willEnable) || [];
                const willClose = (diff && diff.willClose) || [];
                const enableCount = diff ? diff.willEnableCount : 0;
                const closeCount = diff ? diff.willCloseCount : 0;
                const versionWarn = diff && diff.versionChangedCount
                    ? '<div class="ml-presets-hint">' + escHtml(mlT('preset.versionWarn')) + '</div>'
                    : '';

                let enableRows = willEnable.map(function (row) {
                    let cls = 'ml-presets-row';
                    if (row.missing) cls += ' ml-presets-row-missing';
                    else if (row.versionChanged) cls += ' ml-presets-row-changed';
                    const ver = row.missing
                        ? escHtml(mlT('preset.notInGame'))
                        : escHtml(row.presetVersionLabel) + ' → ' + escHtml(row.currentVersionLabel);
                    return (
                        '<div class="' + cls + '">' +
                        '<span class="ml-presets-row-name">' + escHtml(row.name) + '</span>' +
                        '<span class="ml-presets-row-ver">' + ver + '</span></div>'
                    );
                }).join('');
                if (!enableCount) {
                    enableRows = '<div class="ml-presets-empty">' + escHtml(mlT('preset.noEnabled')) + '</div>';
                }

                let closeSection = '';
                if (closeCount) {
                    const closeRows = willClose.map(function (row) {
                        const ver = row.notInPreset
                            ? '<span class="ml-presets-row-ver">' + escHtml(mlT('preset.notInPreset')) + '</span>'
                            : '';
                        return (
                            '<div class="ml-presets-row ml-presets-row-close">' +
                            '<span class="ml-presets-row-name">' + escHtml(row.name) + '</span>' +
                            ver + '</div>'
                        );
                    }).join('');
                    closeSection =
                        '<div class="ml-presets-section">' +
                        '<div class="ml-presets-section-label">' +
                        escHtml(mlT('preset.willClose').replace('{n}', String(closeCount))) +
                        '</div>' + closeRows + '</div>';
                }

                previewHtml =
                    '<div class="ml-presets-preview-title">' + escHtml(presetName) + '</div>' +
                    '<div class="ml-presets-section">' +
                    '<div class="ml-presets-section-label">' +
                    escHtml(mlT('preset.willEnable').replace('{n}', String(enableCount))) +
                    '</div>' + versionWarn + enableRows + '</div>' +
                    closeSection +
                    '<div class="ml-presets-actions">' +
                    '<button type="button" class="ml-btn ml-btn-secondary" id="ml-presets-delete">' + escHtml(mlT('preset.delete')) + '</button>' +
                    '<button type="button" class="ml-btn ml-btn-secondary" id="ml-presets-apply-preview">' + escHtml(mlT('preset.applyPreview')) + '</button>' +
                    '<button type="button" class="ml-btn ml-btn-primary" id="ml-presets-apply-save">' + escHtml(mlT('preset.applySave')) + '</button>' +
                    '</div>';
            }

            container.innerHTML =
                '<div class="ml-presets">' +
                '<div class="ml-presets-body">' +
                '<div class="ml-presets-list-col">' +
                '<button type="button" class="ml-btn ml-btn-secondary ml-btn-sm ml-presets-save-btn" id="ml-presets-open-save">' +
                escHtml(mlT('preset.saveCurrent')) + '</button>' +
                saveFormHtml +
                '<div class="ml-presets-list ml-list-scroll">' + listHtml + '</div>' +
                '</div>' +
                '<div class="ml-presets-preview-col ml-list-scroll">' + previewHtml + '</div>' +
                '</div>' +
                '<div class="ml-presets-error" style="' + (errorMsg ? '' : 'display:none;') + '">' + escHtml(errorMsg) + '</div>' +
                '</div>';

            const openSave = container.querySelector('#ml-presets-open-save');
            if (openSave) {
                openSave.addEventListener('click', function (e) {
                    e.stopPropagation();
                    showSaveForm = true;
                    paint();
                    const inp = container.querySelector('#ml-presets-new-name');
                    if (inp) inp.focus();
                });
            }
            const saveOk = container.querySelector('#ml-presets-save-ok');
            if (saveOk) {
                saveOk.addEventListener('click', function (e) {
                    e.stopPropagation();
                    doSave();
                });
            }
            const saveCancel = container.querySelector('#ml-presets-save-cancel');
            if (saveCancel) {
                saveCancel.addEventListener('click', function (e) {
                    e.stopPropagation();
                    showSaveForm = false;
                    paint();
                });
            }
            const nameInput = container.querySelector('#ml-presets-new-name');
            if (nameInput) {
                nameInput.addEventListener('keydown', function (e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        doSave();
                    }
                });
            }
            container.querySelectorAll('[data-preset-base]').forEach(function (btn) {
                btn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    selectPreset(btn.getAttribute('data-preset-base'));
                });
            });
            const delBtn = container.querySelector('#ml-presets-delete');
            if (delBtn) {
                delBtn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    doDelete();
                });
            }
            const applyPrev = container.querySelector('#ml-presets-apply-preview');
            if (applyPrev) {
                applyPrev.addEventListener('click', function (e) {
                    e.stopPropagation();
                    requestApply('preview');
                });
            }
            const applySaveBtn = container.querySelector('#ml-presets-apply-save');
            if (applySaveBtn) {
                applySaveBtn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    requestApply('save');
                });
            }
        }

        paint();
    }

    function entryLabel() {
        return mlT('preset.title');
    }

    ML.registerLogEntry({
        id: 'mod-presets',
        label: entryLabel(),
        getLabel: entryLabel,
        render: function (container) {
            renderPanel(container);
        }
    });

    console.info('[modConfigPresets] config presets entry registered');
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = createModPresets;
}
