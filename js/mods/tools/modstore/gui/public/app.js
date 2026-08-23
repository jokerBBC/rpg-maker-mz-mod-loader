(function () {
    'use strict';

    var mods = [];
    var defaultOutputPath = '';
    var saveFeedbackTimer = null;
    var $ = function (id) { return document.getElementById(id); };

    function log(msg) {
        var el = $('log');
        var line = '[' + new Date().toLocaleTimeString() + '] ' + msg;
        el.textContent = (el.textContent ? el.textContent + '\n' : '') + line;
        el.scrollTop = el.scrollHeight;
    }

    function api(path, opts) {
        opts = opts || {};
        return fetch(path, {
            method: opts.method || 'GET',
            headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
            body: opts.body ? JSON.stringify(opts.body) : undefined
        }).then(function (r) {
            return r.json().then(function (j) {
                if (!r.ok) throw new Error(j.error || r.statusText);
                return j;
            });
        });
    }

    function statusLabel(s) {
        if (s === 'new') return { text: '未发布', cls: 'badge-new' };
        if (s === 'updated') return { text: '有更新', cls: 'badge-updated' };
        if (s === 'same') return { text: '已发布', cls: 'badge-same' };
        if (s === 'error') return { text: '错误', cls: 'badge-error' };
        return { text: '未知', cls: 'badge-unknown' };
    }

    function renderList() {
        var list = $('modList');
        var filter = $('filterUpdated').checked;
        var visible = mods.filter(function (m) {
            if (!filter) return true;
            return m.status === 'new' || m.status === 'updated';
        });
        $('modCount').textContent = visible.length + ' / ' + mods.length + ' 个 Mod';
        if (!visible.length) {
            list.className = 'mod-list empty';
            list.innerHTML = filter ? '没有需要更新的 Mod' : '无 Mod';
            return;
        }
        list.className = 'mod-list';
        list.innerHTML = visible.map(function (m) {
            var st = statusLabel(m.status);
            var pub = m.publishedVersion ? ('已发布 ' + m.publishedVersion) : '尚未发布';
            var ver = m.version ? ('本地 ' + m.version) : '无版本';
            var err = m.error ? (' · ' + m.error) : '';
            var zipHint = m.version
                ? (' · ' + esc(m.packageName) + '-' + esc(m.version).replace(/^[vV]/, '') + '.zip')
                : (' · ' + esc(m.packageName) + '-&lt;版本&gt;.zip');
            if (m.scriptCount > 1) {
                zipHint += ' · ' + m.scriptCount + ' 个脚本';
            }
            return '<label class="mod-item">' +
                '<input type="checkbox" class="mod-check" data-pkg="' + esc(m.packageName) + '"' +
                (m.status === 'error' ? ' disabled' : '') + '>' +
                '<span class="badge ' + st.cls + '">' + st.text + '</span>' +
                '<div class="mod-meta">' +
                '<div class="mod-title">' + esc(m.packageName) + '</div>' +
                '<div class="mod-sub">' + esc(ver) + ' · ' + esc(pub) + zipHint + esc(err) + '</div>' +
                '</div></label>';
        }).join('');
    }

    function esc(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    }

    function selectedPackages() {
        return Array.prototype.map.call(
            document.querySelectorAll('.mod-check:checked'),
            function (el) { return el.getAttribute('data-pkg'); }
        );
    }

    function updateEffectiveHint(s) {
        var el = $('effectiveOutputHint');
        if (!el) return;
        var out = s.effectiveOutputPath || defaultOutputPath;
        var cat = s.effectiveCatalogPath || (out + '\\catalog.json');
        el.textContent = out + ' （catalog: ' + cat + '）';
    }

    function showSaveFeedback() {
        var el = $('saveFeedback');
        if (!el) return;
        el.textContent = '已保存';
        el.classList.remove('hide');
        el.classList.add('show');
        clearTimeout(saveFeedbackTimer);
        saveFeedbackTimer = setTimeout(function () {
            el.classList.add('hide');
            saveFeedbackTimer = setTimeout(function () {
                el.classList.remove('show', 'hide');
                el.textContent = '';
            }, 280);
        }, 1800);
    }

    function savePathsToSettings() {
        return api('/api/settings', {
            method: 'POST',
            body: {
                localmodsPath: $('localmodsPath').value.trim(),
                outputPath: $('outputPath').value.trim(),
                sourceId: $('sourceId').value.trim(),
                sourceName: $('sourceName').value.trim(),
                remote: {
                    repoUrl: $('repoUrl').value.trim(),
                    token: $('repoToken').value.trim() || '***',
                    branch: $('repoBranch').value.trim() || 'master',
                    packagesSubdir: $('packagesSubdir').value.trim() || 'packages',
                    catalogPathInRepo: $('catalogPathInRepo').value.trim() || 'catalog.json',
                    rawUrlTemplate: $('gitRawUrlTemplate').value.trim(),
                    staticCdnUrlTemplate: $('staticCdnUrlTemplate').value.trim()
                }
            }
        }).then(function () {
            return api('/api/settings');
        }).then(function (s) {
            updateEffectiveHint(s);
            return s;
        });
    }

    function loadSettings() {
        return api('/api/settings').then(function (s) {
            $('localmodsPath').value = s.localmodsPath || '';
            $('outputPath').value = s.outputPath || '';
            defaultOutputPath = s.defaultOutputPath || '';
            $('outputPath').placeholder = defaultOutputPath || 'gui/user-data/repo-cache';
            $('sourceId').value = s.sourceId || '';
            $('sourceName').value = s.sourceName || '';
            if (s.remote) {
                $('repoUrl').value = s.remote.repoUrl || '';
                $('repoToken').value = '';
                $('repoBranch').value = s.remote.branch || 'master';
                $('packagesSubdir').value = s.remote.packagesSubdir || 'packages';
                $('catalogPathInRepo').value = s.remote.catalogPathInRepo || 'catalog.json';
                $('gitRawUrlTemplate').value = s.remote.rawUrlTemplate || '';
                $('staticCdnUrlTemplate').value = s.remote.staticCdnUrlTemplate || '';
            }
            if (s.dataDir && $('dataDirHint')) {
                $('dataDirHint').textContent = s.dataDir;
            }
            updateEffectiveHint(s);
        });
    }

    function scan() {
        savePathsToSettings().then(function () {
            return api('/api/scan', { method: 'POST', body: {} });
        }).then(function (r) {
            mods = r.mods || [];
            renderList();
            log('扫描完成，共 ' + mods.length + ' 个 Mod');
        }).catch(function (e) { log('扫描失败: ' + e.message); });
    }

    function logPublishResult(r) {
        (r.results || []).forEach(function (x) {
            log('OK ' + x.packageName + ' → ' + x.zipName + ' (' + x.size + ' B)');
        });
        (r.errors || []).forEach(function (x) {
            log('FAIL ' + x.packageName + ': ' + x.error);
        });
        if (r.catalogPath) log('catalog → ' + r.catalogPath);
        (r.prunedZips || []).forEach(function (z) { log('清理旧 zip: ' + z); });
        (r.results || []).forEach(function (x) {
            (x.removedZips || []).forEach(function (z) { log('清理旧 zip: ' + z); });
        });
    }

    function publishOnly() {
        var pkgs = selectedPackages();
        if (!pkgs.length) { log('请先勾选 Mod'); return; }
        var btn = $('btnPublish');
        btn.disabled = true;
        savePathsToSettings().then(function () {
            return api('/api/publish', { method: 'POST', body: { packages: pkgs } });
        }).then(function (r) {
            logPublishResult(r);
            scan();
        }).catch(function (e) { log('打包失败: ' + e.message); })
            .finally(function () { btn.disabled = false; });
    }

    function publishCatalog() {
        var pkgs = selectedPackages();
        if (!pkgs.length) { log('请先勾选 Mod'); return; }
        var btn = $('btnPublishCatalog');
        btn.disabled = true;
        savePathsToSettings().then(function () {
            return api('/api/publish-catalog', { method: 'POST', body: { packages: pkgs } });
        }).then(function (r) {
            logPublishResult(r);
            scan();
        }).catch(function (e) { log('打包/catalog 失败: ' + e.message); })
            .finally(function () { btn.disabled = false; });
    }

    function pushRemote() {
        var btn = $('btnPushRemote');
        btn.disabled = true;
        savePathsToSettings().then(function () {
            return api('/api/push-remote', { method: 'POST', body: {} });
        }).then(function (r) {
            var p = r.push || {};
            log(p.message || (p.pushed ? '已推送' : '无需推送'));
            if (p.copiedZips) log('同步 zip: ' + p.copiedZips + ' 个');
            if (p.removedZips && p.removedZips.length) {
                p.removedZips.forEach(function (z) { log('清理旧 zip: ' + z); });
            }
            if (p.sync && p.sync.mode === 'rebase') log('已与远程历史变基合并');
            if (p.pushed && r.catalogPublicUrl) log('Catalog URL (https): ' + r.catalogPublicUrl);
            if (r.repoPath) log('本地仓库: ' + r.repoPath);
            if (r.catalogPath) log('catalog: ' + r.catalogPath);
        }).catch(function (e) { log('推送失败: ' + e.message); })
            .finally(function () { btn.disabled = false; });
    }

    function pullRemote() {
        var btn = $('btnPullRemote');
        btn.disabled = true;
        savePathsToSettings().then(function () {
            return api('/api/pull-remote', { method: 'POST', body: {} });
        }).then(function (r) {
            log(r.message || ('拉取完成: zip ' + (r.copiedZips || 0) + ' 个'));
            if (r.repoPath) log('本地仓库: ' + r.repoPath);
            if (r.catalogPath) log('catalog → ' + r.catalogPath);
            scan();
        }).catch(function (e) { log('拉取失败: ' + e.message); })
            .finally(function () { btn.disabled = false; });
    }

    document.querySelectorAll('.tab').forEach(function (tab) {
        tab.addEventListener('click', function () {
            document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
            document.querySelectorAll('.panel').forEach(function (p) { p.classList.remove('active'); });
            tab.classList.add('active');
            $('panel-' + tab.getAttribute('data-tab')).classList.add('active');
        });
    });

    $('btnScan').addEventListener('click', scan);
    $('btnPublish').addEventListener('click', publishOnly);
    $('btnPublishCatalog').addEventListener('click', publishCatalog);
    $('btnPushRemote').addEventListener('click', pushRemote);
    $('btnPullRemote').addEventListener('click', pullRemote);
    $('filterUpdated').addEventListener('change', renderList);
    $('checkAll').addEventListener('change', function () {
        var on = $('checkAll').checked;
        document.querySelectorAll('.mod-check:not(:disabled)').forEach(function (el) {
            el.checked = on;
        });
    });
    $('btnSaveSettings').addEventListener('click', function () {
        savePathsToSettings().then(function () { showSaveFeedback(); })
            .catch(function (e) { log('保存失败: ' + e.message); });
    });
    $('catalogPathInRepo').addEventListener('change', function () {
        api('/api/settings').then(updateEffectiveHint).catch(function () {});
    });

    document.querySelectorAll('[data-browse]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var field = btn.getAttribute('data-browse');
            api('/api/browse-folder', { method: 'POST', body: { title: 'Select folder' } })
                .then(function (r) {
                    if (r.path) {
                        $(field).value = r.path;
                        log('已选择: ' + r.path);
                        savePathsToSettings().catch(function () {});
                    }
                })
                .catch(function (e) { log('浏览失败: ' + e.message); });
        });
    });

    loadSettings().catch(function () { /* first run */ });
})();
