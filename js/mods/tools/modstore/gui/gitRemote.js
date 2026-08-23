'use strict';

var fs = require('fs');
var path = require('path');
var { execSync } = require('child_process');
var core = require('../modStorePublishCore');

function parseRepoUrl(repoUrl) {
    var u = String(repoUrl || '').trim().replace(/\.git$/, '');
    var m = u.match(/^(https?:\/\/)(?:[^@]+@)?(gitee\.com|github\.com)\/([^/]+)\/([^/]+)/i);
    if (!m) throw new Error('仅支持 Gitee / GitHub HTTPS 仓库地址');
    return {
        host: m[2].toLowerCase(),
        owner: m[3],
        repo: m[4],
        httpsBase: m[1] + m[2] + '/' + m[3] + '/' + m[4]
    };
}

function getRepoWorkDir(workBase, remote) {
    var info = parseRepoUrl(remote.repoUrl);
    return path.join(workBase, info.owner + '_' + info.repo);
}

function resolveRepoDir(local, workDirBase, remote) {
    if (local && local.outputPath) return local.outputPath;
    return getRepoWorkDir(workDirBase, remote);
}

function buildAuthUrl(repoUrl, token) {
    var info = parseRepoUrl(repoUrl);
    var user = info.host === 'github.com' ? 'x-access-token' : 'oauth2';
    return 'https://' + user + ':' + encodeURIComponent(token) + '@' + info.host + '/' + info.owner + '/' + info.repo + '.git';
}

function buildRawPackageUrl(remote, zipName) {
    var info = parseRepoUrl(remote.repoUrl);
    var branch = remote.branch || 'master';
    var sub = (remote.packagesSubdir || 'packages').replace(/^\/+|\/+$/g, '');
    if (remote.staticCdnUrlTemplate) {
        return applyDownloadUrlTemplate(remote.staticCdnUrlTemplate, info, remote, zipName, sub);
    }
    if (remote.rawUrlTemplate) {
        return applyDownloadUrlTemplate(remote.rawUrlTemplate, info, remote, zipName, sub);
    }
    if (info.host === 'gitee.com') {
        return 'https://gitee.com/' + info.owner + '/' + info.repo + '/raw/' + branch + '/' + sub + '/' + zipName;
    }
    return 'https://raw.githubusercontent.com/' + info.owner + '/' + info.repo + '/' + branch + '/' + sub + '/' + zipName;
}

function buildCatalogPublicUrl(remote) {
    if (!remote || !remote.repoUrl) return null;
    var info = parseRepoUrl(remote.repoUrl);
    var branch = remote.branch || 'master';
    var catRel = String(remote.catalogPathInRepo || 'catalog.json').replace(/^\/+/, '');
    if (info.host === 'gitee.com') {
        return 'https://gitee.com/' + info.owner + '/' + info.repo + '/raw/' + branch + '/' + catRel;
    }
    return 'https://raw.githubusercontent.com/' + info.owner + '/' + info.repo + '/' + branch + '/' + catRel;
}

function applyDownloadUrlTemplate(template, info, remote, zipName, sub) {
    var branch = remote.branch || 'master';
    if (!sub) sub = (remote.packagesSubdir || 'packages').replace(/^\/+|\/+$/g, '');
    return String(template)
        .replace(/\{host\}/g, info.host)
        .replace(/\{owner\}/g, info.owner)
        .replace(/\{repo\}/g, info.repo)
        .replace(/\{branch\}/g, branch)
        .replace(/\{subdir\}/g, sub)
        .replace(/\{file\}/g, zipName);
}

function runGit(cwd, cmd, env) {
    var gitCmd = String(cmd || '').replace(/^git\s+/, '');
    execSync('git -c credential.helper= -c credential.useHttpPath=false ' + gitCmd, {
        cwd: cwd,
        stdio: 'pipe',
        encoding: 'utf8',
        shell: true,
        env: Object.assign({}, process.env, {
            GIT_CONFIG_NOSYSTEM: '1'
        }, env || {})
    });
}

function tryRunGit(cwd, cmd) {
    try {
        runGit(cwd, cmd);
        return true;
    } catch (e) {
        return false;
    }
}

function listDirEntries(dir) {
    try {
        return fs.readdirSync(dir).filter(function (e) { return e !== '.git'; });
    } catch (e) {
        return [];
    }
}

function initRepoFromRemote(remote, workDir) {
    var authUrl = buildAuthUrl(remote.repoUrl, remote.token);
    var branch = remote.branch || 'master';
    runGit(workDir, 'git init');
    if (!tryRunGit(workDir, 'git remote add origin "' + authUrl + '"')) {
        runGit(workDir, 'git remote set-url origin "' + authUrl + '"');
    }
    if (tryRunGit(workDir, 'git fetch --depth 1 origin ' + branch)) {
        if (!tryRunGit(workDir, 'git checkout -B ' + branch + ' FETCH_HEAD')) {
            runGit(workDir, 'git checkout -b ' + branch);
        }
    } else {
        runGit(workDir, 'git checkout -b ' + branch);
    }
}

function isLocalRepoInitialized(workDir) {
    return fs.existsSync(path.join(workDir, '.git'));
}

/** 推送前：要求本地已是 git 仓库（须先「从远程拉取」初始化） */
function openRepoForPush(remote, workDir) {
    if (!remote || !remote.repoUrl) {
        throw new Error('请先在设置中填写远程仓库 HTTPS 地址');
    }
    if (!remote.token) throw new Error('请先在设置中填写访问令牌');
    fs.mkdirSync(workDir, { recursive: true });
    if (!isLocalRepoInitialized(workDir)) {
        throw new Error('本地仓库尚未初始化，请先点击「从远程拉取到本地」');
    }
    var authUrl = buildAuthUrl(remote.repoUrl, remote.token);
    var branch = remote.branch || 'master';
    runGit(workDir, 'git remote set-url origin "' + authUrl + '"');
    tryRunGit(workDir, 'git checkout ' + branch);
    return workDir;
}

function ensureRepo(remote, workDir, opts) {
    opts = opts || {};
    var pull = opts.pull !== false;
    if (!remote.token) throw new Error('远程操作需要填写访问令牌');
    fs.mkdirSync(workDir, { recursive: true });
    var gitDir = path.join(workDir, '.git');
    var authUrl = buildAuthUrl(remote.repoUrl, remote.token);
    var branch = remote.branch || 'master';

    if (!fs.existsSync(gitDir)) {
        if (listDirEntries(workDir).length === 0) {
            runGit(workDir, 'git clone --depth 1 -b "' + branch + '" "' + authUrl + '" .');
        } else {
            initRepoFromRemote(remote, workDir);
        }
        return workDir;
    }

    runGit(workDir, 'git remote set-url origin "' + authUrl + '"');
    tryRunGit(workDir, 'git checkout ' + branch);
    if (pull && tryRunGit(workDir, 'git fetch origin ' + branch)) {
        tryRunGit(workDir, 'git pull origin ' + branch);
    }
    return workDir;
}

function packagesSubdir(remote) {
    return String(remote.packagesSubdir || 'packages').replace(/^[/\\]+|[/\\]+$/g, '');
}

function resolveLocalPackagesDir(outputPath, remote) {
    if (!outputPath) return null;
    var sub = packagesSubdir(remote);
    var nested = path.join(outputPath, sub);
    if (fs.existsSync(nested) && fs.statSync(nested).isDirectory()) return nested;
    return outputPath;
}

function countZipsInDir(dir) {
    if (!dir || !fs.existsSync(dir)) return 0;
    var n = 0;
    var files = fs.readdirSync(dir);
    for (var i = 0; i < files.length; i++) {
        if (/\.zip$/i.test(files[i])) n++;
    }
    return n;
}

function copyZipsFromDir(srcDir, destPkgDir) {
    fs.mkdirSync(destPkgDir, { recursive: true });
    var copied = 0;
    var files = fs.readdirSync(srcDir);
    for (var i = 0; i < files.length; i++) {
        if (!/\.zip$/i.test(files[i])) continue;
        fs.copyFileSync(path.join(srcDir, files[i]), path.join(destPkgDir, files[i]));
        copied++;
    }
    return copied;
}

function ensureRepoLayout(repoDir, remote, catalogMeta) {
    var pkgDir = path.join(repoDir, packagesSubdir(remote));
    fs.mkdirSync(pkgDir, { recursive: true });
    var catRel = remote.catalogPathInRepo || 'catalog.json';
    var catPath = path.join(repoDir, catRel);
    if (!fs.existsSync(catPath)) {
        var catalog = core.loadOrCreateCatalog(catPath, catalogMeta || {});
        fs.mkdirSync(path.dirname(catPath), { recursive: true });
        fs.writeFileSync(catPath, JSON.stringify(catalog, null, 2) + '\n', 'utf-8');
    }
    return { packagesDir: pkgDir, catalogPath: catPath };
}

function copyPublishResults(repoDir, remote, results) {
    var pkgDir = path.join(repoDir, packagesSubdir(remote));
    fs.mkdirSync(pkgDir, { recursive: true });
    for (var i = 0; i < results.length; i++) {
        var r = results[i];
        fs.copyFileSync(r.zipPath, path.join(pkgDir, r.zipName));
    }
}

function upsertResultsIntoCatalog(catalog, remote, results) {
    for (var i = 0; i < results.length; i++) {
        var r = results[i];
        var downloadUrl = buildRawPackageUrl(remote, r.zipName);
        var urlObj = core.assertHttpsUrl(downloadUrl);
        core.upsertCatalogEntry(catalog, {
            id: r.modId,
            packageName: r.packageName,
            title: r.title,
            version: r.version,
            downloadUrl: downloadUrl,
            sha256: r.sha256,
            size: r.size,
            summary: r.summary,
            hosts: [urlObj.hostname]
        });
    }
}

function writeCatalogFile(catalogPath, settings, results) {
    if (!catalogPath) throw new Error('请先设置 catalog.json 路径');
    if (!settings.remote || !settings.remote.repoUrl) {
        throw new Error('生成 catalog 需填写仓库 HTTPS 地址（无需令牌）');
    }
    var catalog = core.loadOrCreateCatalog(catalogPath, settings);
    upsertResultsIntoCatalog(catalog, settings.remote, results);
    fs.mkdirSync(path.dirname(catalogPath), { recursive: true });
    fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + '\n', 'utf-8');
    return catalogPath;
}

function updateRepoCatalog(repoDir, remote, results, catalogMeta) {
    var catRel = remote.catalogPathInRepo || 'catalog.json';
    var catPath = path.join(repoDir, catRel);
    var catalog = core.loadOrCreateCatalog(catPath, {
        sourceId: catalogMeta.sourceId,
        sourceName: catalogMeta.sourceName
    });
    upsertResultsIntoCatalog(catalog, remote, results);
    fs.mkdirSync(path.dirname(catPath), { recursive: true });
    fs.writeFileSync(catPath, JSON.stringify(catalog, null, 2) + '\n', 'utf-8');
    return catPath;
}

function syncLocalLayoutToRepo(repoDir, remote, local) {
    if (!local || !local.outputPath) {
        throw new Error('请先设置输出目录（仓库根目录）');
    }
    var pkgDest = path.join(repoDir, packagesSubdir(remote));
    var pkgSrc = resolveLocalPackagesDir(local.outputPath, remote);
    if (!pkgSrc || !fs.existsSync(pkgSrc)) {
        throw new Error('找不到本地 zip 目录: ' + (pkgSrc || local.outputPath));
    }
    var copied;
    if (path.resolve(pkgSrc) === path.resolve(pkgDest)) {
        copied = countZipsInDir(pkgDest);
    } else {
        copied = copyZipsFromDir(pkgSrc, pkgDest);
    }
    if (!copied) throw new Error('本地目录没有 zip 文件: ' + pkgSrc);

    var catalogPath = local.catalogPath;
    if (!catalogPath && local.outputPath) {
        catalogPath = path.join(local.outputPath, remote.catalogPathInRepo || 'catalog.json');
    }
    if (!catalogPath || !fs.existsSync(catalogPath)) {
        throw new Error('找不到 catalog.json，请先执行「打包并生成 catalog」');
    }
    var catRel = remote.catalogPathInRepo || 'catalog.json';
    var repoCat = path.join(repoDir, catRel);
    if (path.resolve(catalogPath) !== path.resolve(repoCat)) {
        fs.mkdirSync(path.dirname(repoCat), { recursive: true });
        fs.copyFileSync(catalogPath, repoCat);
    }
    return { copiedZips: copied, catalogPath: catalogPath };
}

function prunePackagesFromCatalog(repoDir, remote, catalogPath) {
    if (!catalogPath || !fs.existsSync(catalogPath)) return [];
    var catalog = core.loadCatalog(catalogPath);
    if (!catalog) return [];
    var pkgDir = path.join(repoDir, packagesSubdir(remote));
    return core.pruneOrphanPackageZips(pkgDir, catalog);
}

function gitRev(repoDir, ref) {
    try {
        return execSync('git rev-parse ' + ref, {
            cwd: repoDir,
            encoding: 'utf8',
            shell: true,
            stdio: 'pipe'
        }).trim();
    } catch (e) {
        return '';
    }
}

function isAheadOfRemote(repoDir) {
    var head = gitRev(repoDir, 'HEAD');
    var remoteHead = gitRev(repoDir, 'FETCH_HEAD');
    if (!head || !remoteHead || head === remoteHead) return false;
    return tryRunGit(repoDir, 'git merge-base --is-ancestor FETCH_HEAD HEAD');
}

function integrateRemoteBeforePush(repoDir, remote) {
    var branch = remote.branch || 'master';
    var authUrl = buildAuthUrl(remote.repoUrl, remote.token);
    if (!tryRunGit(repoDir, 'git fetch "' + authUrl + '" ' + branch)) {
        return { integrated: false, mode: 'no-remote' };
    }
    var head = gitRev(repoDir, 'HEAD');
    var remoteHead = gitRev(repoDir, 'FETCH_HEAD');
    if (head === remoteHead) {
        return { integrated: true, mode: 'up-to-date' };
    }
    if (tryRunGit(repoDir, 'git merge-base --is-ancestor HEAD FETCH_HEAD')) {
        runGit(repoDir, 'git merge --ff-only FETCH_HEAD');
        return { integrated: true, mode: 'fast-forward' };
    }
    if (tryRunGit(repoDir, 'git merge-base --is-ancestor FETCH_HEAD HEAD')) {
        return { integrated: true, mode: 'ahead' };
    }
    if (!tryRunGit(repoDir, 'git rebase FETCH_HEAD')) {
        tryRunGit(repoDir, 'git rebase --abort');
        throw new Error('与远程历史冲突，无法自动合并。请到本地仓库目录手动处理后重试');
    }
    return { integrated: true, mode: 'rebase' };
}

function commitAndPush(repoDir, remote, message) {
    if (!remote.token) throw new Error('推送需要填写访问令牌');
    var branch = remote.branch || 'master';
    var authUrl = buildAuthUrl(remote.repoUrl, remote.token);

    runGit(repoDir, 'git add -A');
    var committed = false;
    try {
        runGit(repoDir, 'git diff --cached --quiet');
    } catch (e) {
        runGit(repoDir, 'commit -m "' + message.replace(/"/g, '\\"') + '"');
        committed = true;
    }

    var syncInfo = integrateRemoteBeforePush(repoDir, remote);
    var ahead = isAheadOfRemote(repoDir);

    if (!committed && !ahead) {
        if (syncInfo.mode === 'fast-forward') {
            return { pushed: false, message: '已拉取远程更新，本地与远程已一致', sync: syncInfo };
        }
        return { pushed: false, message: '本地与远程已一致，无需推送', sync: syncInfo };
    }

    runGit(repoDir, 'git push "' + authUrl + '" ' + branch);

    if (committed) {
        return { pushed: true, message: '已推送到远程仓库', sync: syncInfo };
    }
    if (syncInfo.mode === 'rebase') {
        return { pushed: true, message: '已与远程合并并推送', sync: syncInfo };
    }
    return { pushed: true, message: '已推送此前未同步的本地提交', sync: syncInfo };
}

/** 打包后立即推送（克隆远程 → 写入 zip/catalog → push） */
function pushToRemote(remote, results, catalogMeta, workDirBase) {
    var local = { outputPath: catalogMeta && catalogMeta.outputPath };
    var repoDir = ensureRepo(remote, resolveRepoDir(local, workDirBase, remote));
    copyPublishResults(repoDir, remote, results);
    updateRepoCatalog(repoDir, remote, results, catalogMeta || {});
    var msg = 'modstore: publish ' + results.map(function (r) { return r.modId + '@' + r.version; }).join(', ');
    return commitAndPush(repoDir, remote, msg);
}

/** 将本地已生成的 packages + catalog.json 同步到远程（不重新打包） */
function pushLocalLayout(remote, local, workDirBase) {
    var repoDir = openRepoForPush(remote, resolveRepoDir(local, workDirBase, remote));
    var syncInfo = syncLocalLayoutToRepo(repoDir, remote, local);
    var removed = prunePackagesFromCatalog(repoDir, remote, syncInfo.catalogPath);
    if (removed.length) syncInfo.removedZips = removed;
    var msg = 'modstore: sync local catalog and packages';
    var pushRes = commitAndPush(repoDir, remote, msg);
    return Object.assign(pushRes, syncInfo, { repoPath: repoDir });
}

/** 在输出目录初始化/更新 git 仓库，并拉取远程内容 */
function pullRemoteToLocal(remote, local, workDirBase, catalogMeta) {
    if (!local || !local.outputPath) {
        throw new Error('请先设置输出目录（仓库根目录）');
    }
    var repoDir = ensureRepo(remote, resolveRepoDir(local, workDirBase, remote));
    var layout = ensureRepoLayout(repoDir, remote, catalogMeta || {});
    var copied = countZipsInDir(layout.packagesDir);
    return {
        copiedZips: copied,
        catalogPath: layout.catalogPath,
        repoInitialized: true,
        repoPath: repoDir,
        message: copied
            ? '已初始化本地仓库并拉取 ' + copied + ' 个 zip'
            : '已初始化本地仓库（远程暂无 zip，已创建 packages/ 与 catalog 骨架）'
    };
}

module.exports = {
    parseRepoUrl: parseRepoUrl,
    buildRawPackageUrl: buildRawPackageUrl,
    buildCatalogPublicUrl: buildCatalogPublicUrl,
    getRepoWorkDir: getRepoWorkDir,
    isLocalRepoInitialized: isLocalRepoInitialized,
    resolveLocalPackagesDir: resolveLocalPackagesDir,
    writeCatalogFile: writeCatalogFile,
    pushToRemote: pushToRemote,
    pushLocalLayout: pushLocalLayout,
    pullRemoteToLocal: pullRemoteToLocal
};
