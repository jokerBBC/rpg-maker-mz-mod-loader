/**
 * 本地 Mod 安装输入分类（纯逻辑，无 fs / DOM）
 * 拖放与浏览统一：单文件夹 → mods 整包；否则顶层 .js 导入并报告忽略项
 */
'use strict';

/**
 * @param {object} deps
 * @param {import('path')} deps.pathMod
 */
function createInstallClassifier(deps) {
    const { pathMod } = deps;

    /**
     * 文件夹拖放时 webkitRelativePath 的首段（如 "MyPkg/foo.js" → MyPkg）
     * @param {Array<{ webkitRelativePath?: string }>} files
     * @returns {string|null}
     */
    function inferSingleFolderDragRoot(files) {
        if (!files || files.length === 0) return null;
        const roots = new Set();
        for (const file of files) {
            const rel = file.webkitRelativePath;
            if (!rel) continue;
            const first = rel.split(/[/\\]/)[0];
            if (first) roots.add(first);
        }
        if (roots.size !== 1) return null;
        return roots.values().next().value;
    }

    function allPathsUnderModsFolder(files) {
        if (!files || files.length === 0) return false;
        const marker = pathMod.sep + 'mods' + pathMod.sep;
        for (const file of files) {
            if (!file.path || !file.path.includes(marker)) return false;
        }
        return true;
    }

    function enrichFolderItemsFromDragFiles(items, dataTransferFiles) {
        if (!items || items.length === 0) return;
        if (!dataTransferFiles || dataTransferFiles.length === 0) return;
        const files = Array.from(dataTransferFiles);
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.kind !== 'directory' && item.kind !== 'mods-folder') continue;
            if (item.srcDir) continue;
            if (item.files && item.files.length > 0) continue;
            item.files = files;
            if ((item.name || '').toLowerCase() === 'mods') {
                item.kind = 'mods-folder';
            }
        }
    }

    /**
     * 拖放入口：DataTransfer items + files fallback
     * @returns {Array<{ kind: string, name: string, file?: object, path?: string, entry?: object, files?: object[], srcDir?: string }>}
     */
    function normalizeDragItems(items, dataTransferFiles) {
        const result = [];

        if (items && items.length > 0) {
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                let entry;
                if (item.getAsEntry) entry = item.getAsEntry();
                else if (item.webkitGetAsEntry) entry = item.webkitGetAsEntry();

                let isDirectory = false;
                let directoryName = null;
                if (entry && entry.isDirectory) {
                    isDirectory = true;
                    directoryName = entry.name;
                } else if (item.kind === 'directory') {
                    isDirectory = true;
                    directoryName = item.name;
                }

                if (isDirectory) {
                    result.push({ kind: 'directory', name: directoryName, entry: entry || item });
                } else if (item.kind === 'file') {
                    const file = item.getAsFile();
                    if (file) {
                        result.push({
                            kind: 'file',
                            name: file.name,
                            file,
                            path: file.path
                        });
                    }
                }
            }
        }

        if (result.length > 0) {
            enrichFolderItemsFromDragFiles(result, dataTransferFiles);
            return result;
        }

        if (!dataTransferFiles || dataTransferFiles.length === 0) {
            return result;
        }

        const files = Array.from(dataTransferFiles);

        if (allPathsUnderModsFolder(files)) {
            return [{ kind: 'mods-folder', name: 'mods', files }];
        }

        const folderRoot = inferSingleFolderDragRoot(files);
        if (folderRoot) {
            if (folderRoot.toLowerCase() === 'mods') {
                return [{ kind: 'mods-folder', name: 'mods', files }];
            }
            return [{ kind: 'directory', name: folderRoot, files }];
        }

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            result.push({
                kind: 'file',
                name: file.name,
                file,
                path: file.path
            });
        }
        return result;
    }

    /**
     * 浏览 .js 入口：FileList → 顶层 file 项（不递归目录）
     */
    function normalizeBrowseJsFiles(fileList) {
        if (!fileList || fileList.length === 0) return [];
        return Array.from(fileList).map((file) => ({
            kind: 'file',
            name: file.name,
            file,
            path: file.path
        }));
    }

    /**
     * 浏览 mods 文件夹入口
     */
    function normalizeBrowseModsFolder(srcDir) {
        if (!srcDir) return [];
        return [{
            kind: 'directory',
            name: pathMod.basename(srcDir),
            srcDir
        }];
    }

    /**
     * ① 仅一项且为目录 → mods 整包或「非 mods 文件夹」拒绝
     * ② 否则顶层 .js 导入，忽略其它文件与目录（不递归进文件夹）
     */
    function analyzeInstallItems(installItems) {
        const ignored = { files: [], folders: [] };

        if (!installItems || installItems.length === 0) {
            return { action: 'reject', reason: 'empty', ignored };
        }

        if (installItems.length === 1) {
            const only = installItems[0];
            if (only.kind === 'mods-folder' || only.kind === 'directory') {
                const folderName = (only.name || '').toLowerCase();
                if (folderName === 'mods') {
                    return { action: 'mods-folder', folder: only, ignored };
                }
                return {
                    action: 'reject',
                    reason: 'not-mods-folder',
                    folderName: only.name || '?',
                    ignored
                };
            }
        }

        const jsItems = [];
        for (let i = 0; i < installItems.length; i++) {
            const item = installItems[i];
            if (item.kind === 'mods-folder' || item.kind === 'directory') {
                ignored.folders.push(item.name || 'mods');
            } else if (item.kind === 'file') {
                if (item.name.toLowerCase().endsWith('.js')) {
                    jsItems.push(item);
                } else {
                    ignored.files.push(item.name);
                }
            }
        }

        if (jsItems.length > 0) {
            return { action: 'js-files', jsItems, ignored };
        }

        return { action: 'reject', reason: 'no-js', ignored };
    }

    function resolveModsFolderSrcDir(folder) {
        if (folder.srcDir && typeof folder.srcDir === 'string') {
            return folder.srcDir;
        }
        if (!folder.files || folder.files.length === 0) return null;

        for (let i = 0; i < folder.files.length; i++) {
            const file = folder.files[i];
            if (!file.path) continue;
            const sep = pathMod.sep;
            const pathLower = file.path.toLowerCase();

            const idx = pathLower.lastIndexOf(sep + 'mods' + sep);
            if (idx !== -1) {
                return file.path.substring(0, idx + sep.length + 4);
            }
            if (pathLower.endsWith(sep + 'mods')) {
                return file.path;
            }

            let parentDir = pathMod.dirname(file.path);
            for (let depth = 0; depth < 5; depth++) {
                if (pathMod.basename(parentDir).toLowerCase() === 'mods') {
                    return parentDir;
                }
                const nextParent = pathMod.dirname(parentDir);
                if (nextParent === parentDir) break;
                parentDir = nextParent;
            }
        }
        return null;
    }

    return {
        normalizeDragItems,
        normalizeBrowseJsFiles,
        normalizeBrowseModsFolder,
        analyzeInstallItems,
        resolveModsFolderSrcDir,
        inferSingleFolderDragRoot,
        allPathsUnderModsFolder
    };
}

module.exports = createInstallClassifier;
