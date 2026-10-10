#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
RMMZ Mod管理器整合包 打包脚本（配置驱动）

从本仓库 js/mods 同步生成整合包 Mod文件，派生安装器配置 installer_config.json，
生成玩家说明文档，并可选编译安装器 exe / 打分发 zip。
打哪些 Mod 包、配哪些商店源、产物命名，全部由外部 bundle_config.json 决定——
本脚本不含任何指定游戏 / Mod 内容的硬编码。

用法（在 js/mods/tools/modpack 下）：
  python build_package.py                # 同步 Mod文件 + 派生配置 + 生成说明
  python build_package.py --zip          # 再打分发 zip
  python build_package.py --zip --exe    # 先用 PyInstaller 编译安装器再打 zip
  python build_package.py --only-zip     # 跳过同步，仅用现有 Mod文件 打 zip

输出：
  js/mods/tools/modpack/Mod文件/          给安装器复制的载荷
  js/mods/tools/modpack/installer_config.json  安装器运行时读取（随 zip 放 exe 旁）
  js/mods/tools/modpack/使用说明、修复工具等/  玩家说明（config 渲染）
  js/mods/tools/modpack/dist/*.zip        社区分发压缩包（不入 git）
分发时直接改 zip 文件名即可，代码里不写版本号。
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent          # js/mods/tools/modpack
MODS_ROOT = HERE.parents[1]                     # js/mods
LOCALMODS = MODS_ROOT / "_localmods"
MOD_FILES = HERE / "Mod文件"
DIST = HERE / "dist"
BUILD = HERE / "build"
DOCS_OUT = HERE / "使用说明、修复工具等"
CONFIG_FILE = HERE / "bundle_config.json"
INSTALLER_CONFIG = HERE / "installer_config.json"
INJECT_BAT = HERE / "Mod管理器注入工具.bat"
INSTALLER_PY = HERE / "install_builder.py"

MAX_DOWNLOAD_BYTES = 104857600  # 100MB，商店单包下载上限（与 modStore.js 约定一致）


def fail(msg: str) -> None:
    raise SystemExit(f"[bundle_config 错误] {msg}")


def load_bundle_config() -> dict:
    """读取并校验 bundle_config.json；任何问题以非零退出并给出字段级提示。"""
    if not CONFIG_FILE.is_file():
        fail(f"未找到 {CONFIG_FILE.name}。请复制 bundle_config.example.json 为 "
             f"bundle_config.json 后填写。")

    try:
        # utf-8-sig：容忍 Notepad / PowerShell 5.1 写出的带 BOM UTF-8
        data = json.loads(CONFIG_FILE.read_text(encoding="utf-8-sig"))
    except Exception as e:
        fail(f"读取 {CONFIG_FILE.name} 失败：{e}")

    if not isinstance(data, dict):
        fail("顶层必须是 JSON 对象。")

    game = data.get("game")
    if not isinstance(game, dict):
        fail("缺少「game」对象。")
    if not isinstance(game.get("name"), str) or not game["name"].strip():
        fail("game.name 必填（游戏显示名）。")
    aliases = game.get("aliases")
    if (not isinstance(aliases, list) or not aliases
            or not all(isinstance(x, str) and x.strip() for x in aliases)):
        fail("game.aliases 必填：非空字符串数组（自动查找游戏目录用的目录别名，"
             "Steam 发售名与磁盘安装名不一致时都列上）。")
    if game.get("exe") is not None and not isinstance(game.get("exe"), str):
        fail("game.exe 必须是字符串（缺省 Game.exe）。")
    for key in ("installerTitle", "featuredModsNote", "welcomeText"):
        if game.get(key) is not None and not isinstance(game.get(key), str):
            fail(f"game.{key} 必须是字符串。")
    featured = game.get("featuredMods", [])
    if not isinstance(featured, list) or not all(isinstance(x, str) for x in featured):
        fail("game.featuredMods 必须是字符串数组。")

    packages = data.get("packages")
    if not isinstance(packages, list) or not all(isinstance(x, str) for x in packages):
        fail("packages 必须是字符串数组（js/mods/_localmods/ 下要入包的包目录名，"
             "可为空数组）。")

    sources = data.get("sources")
    if not isinstance(sources, list):
        fail("sources 必须是数组（商店订阅源，可为空数组）。")
    for i, s in enumerate(sources):
        if not isinstance(s, dict):
            fail(f"sources[{i}] 必须是对象。")
        for key in ("id", "name", "catalogUrl"):
            if not isinstance(s.get(key), str) or not s[key].strip():
                fail(f"sources[{i}] 缺少字符串字段「{key}」。")
        if not s["catalogUrl"].startswith("https://"):
            fail(f"sources[{i}] 的 catalogUrl 必须是 https：{s['catalogUrl']}")
        if not isinstance(s.get("enabled", True), bool):
            fail(f"sources[{i}] 的 enabled 必须是布尔值。")

    output = data.get("output")
    if not isinstance(output, dict):
        fail("缺少「output」对象。")
    for key in ("exeName", "zipName"):
        if not isinstance(output.get(key), str) or not output[key].strip():
            fail(f"output.{key} 必填（产物文件名，不含扩展名）。")

    return data


def rmtree(path: Path) -> None:
    if not path.exists():
        return
    if path.is_dir():
        shutil.rmtree(path)
    else:
        path.unlink()


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def copy_file(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)


def copy_tree_filtered(src: Path, dst: Path, skip_names=None, skip_suffixes=None) -> int:
    skip_names = set(skip_names or [])
    skip_suffixes = tuple(skip_suffixes or ())
    count = 0
    for item in src.rglob("*"):
        if not item.is_file():
            continue
        rel = item.relative_to(src)
        if any(part in skip_names for part in rel.parts):
            continue
        if item.name in skip_names:
            continue
        if item.suffix in skip_suffixes:
            continue
        target = dst / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(item, target)
        count += 1
    return count


def read_package_description(name: str) -> str:
    """读 _localmods/<name>/modloader.json 的 description，用于 Mod清单.txt。"""
    meta = LOCALMODS / name / "modloader.json"
    if not meta.is_file():
        return ""
    try:
        data = json.loads(meta.read_text(encoding="utf-8-sig"))
        desc = data.get("description", "")
        return desc if isinstance(desc, str) else ""
    except Exception:
        return ""


def build_mod_files(cfg: dict) -> None:
    print("同步 Mod文件 ...")
    rmtree(MOD_FILES)
    MOD_FILES.mkdir(parents=True, exist_ok=True)

    # 不再打包 index.html：安装器对游戏已有文件注入 ModLoader 引用，
    # 避免覆盖游戏作者写在 index.html 的版本号等信息。

    # 1. 注入工具（游戏更新覆盖 index.html 后，玩家可重新注入/还原）
    if INJECT_BAT.is_file():
        copy_file(INJECT_BAT, MOD_FILES / INJECT_BAT.name)
        print(f"  {INJECT_BAT.name}")
    else:
        print(f"  警告：缺少 {INJECT_BAT.name}，请先运行 gen_inject_bat.py")

    mods_dst = MOD_FILES / "js" / "mods"
    mods_dst.mkdir(parents=True, exist_ok=True)

    # 2. 管理器本体
    copy_file(MODS_ROOT / "ModLoader.js", mods_dst / "ModLoader.js")
    n = copy_tree_filtered(
        MODS_ROOT / "modloader",
        mods_dst / "modloader",
        skip_names={".DS_Store", "test"},
    )
    print(f"  modloader/ ×{n}")

    # 3. libs（去掉备份文件）
    n = copy_tree_filtered(
        MODS_ROOT / "libs",
        mods_dst / "libs",
        skip_names={".DS_Store", "marked.min.js.v15.bak"},
        skip_suffixes={".bak"},
    )
    print(f"  libs/ ×{n}")

    # 4. config：语言 / CSS / 管理器配置。
    #    modloader_config.json 作为「种子」入包：构筑机（通常是你游戏目录里的
    #    js/mods）里的偏好会成为首装玩家的默认值（如工坊 AppID、语言）；
    #    安装器对玩家已有配置保留不动，见 install_builder.py 重装保护。
    #    mod_store.json 在步骤 7 生成，安装器与玩家版按源 id 合并。
    cfg_src = MODS_ROOT / "config"
    for rel in ["language", "modloader.css", "modloader_config.json"]:
        src = cfg_src / rel
        if src.is_file():
            copy_file(src, mods_dst / "config" / rel)
        elif src.is_dir():
            n = copy_tree_filtered(src, mods_dst / "config" / rel, skip_names={".DS_Store"})
            print(f"  config/{rel} ×{n}")

    # 5. 仅打包配置选定的入包 Mod；其余（含第三方）玩家到商店自行下载
    packaged = []
    for name in cfg["packages"]:
        src = LOCALMODS / name
        if not src.is_dir():
            print(f"  警告：缺少包 {name}，跳过")
            continue
        n = copy_tree_filtered(
            src,
            mods_dst / "_localmods" / name,
            skip_names={".DS_Store"},
        )
        packaged.append(name)
        print(f"  _localmods/{name} ×{n}")

    # 6. 不打包 mod_config.json：开关/参数一律玩家自选，重装不覆盖。

    # 7. 商店订阅源（只预填源，不打包第三方 Mod；玩家到商店自行下载）。
    #    玩家端已有时由安装器按源 id 合并（保留玩家订阅与已读状态，不整文件覆盖）。
    #    seenMods 只标实际入包的 Mod，未入包的不标。
    sources = [dict(s) for s in cfg["sources"]]
    for s in sources:
        s.setdefault("enabled", True)
    write_json(
        mods_dst / "config" / "mod_store.json",
        {
            "maxDownloadBytes": MAX_DOWNLOAD_BYTES,
            "sources": sources,
            "suppressInstallHint": False,
            "seenMods": {name: True for name in packaged},
        },
    )
    print(f"  config/mod_store.json（商店源 ×{len(sources)}）")
    for s in sources:
        print(f"    {s['name']}  {s['catalogUrl']}")

    # 8. 文档仅保留管理器更新日志：游戏内「(日志)」按钮读取它；
    #    使用手册等玩家文档不打包，想要的玩家自行从仓库下载。
    changelog = MODS_ROOT / "docs" / "modloader_CHANGELOG.md"
    if changelog.is_file():
        copy_file(changelog, mods_dst / "docs" / "modloader_CHANGELOG.md")
        print("  docs/modloader_CHANGELOG.md")
    else:
        print("  警告：缺少 docs/modloader_CHANGELOG.md，游戏内「(日志)」按钮将无内容")

    print(f"Mod文件 就绪：{MOD_FILES}")


def write_installer_config(cfg: dict) -> None:
    """从 bundle_config.json 派生安装器运行时配置 installer_config.json。

    与 exe/脚本同级；随 zip 分发时放 exe 旁。安装器缺失它即报错退出，
    因此换游戏只需换这个文件，exe 构筑一次可重复使用。
    """
    game = cfg["game"]
    exe = game.get("exe") or "Game.exe"
    installer_cfg = {
        "appTitle": game.get("installerTitle")
        or f"{game['name']} Mod管理器整合包 安装向导",
        "gameAliases": list(game["aliases"]),
        "gameExe": exe,
        "featuredMods": list(game.get("featuredMods", [])),
        "featuredModsNote": game.get("featuredModsNote")
        or "其他 Mod 到游戏内 Mod 商店自行下载。",
        "dirHint": f"选到有 {exe} 的那个文件夹就对了",
    }
    if isinstance(game.get("welcomeText"), str) and game["welcomeText"].strip():
        installer_cfg["welcomeText"] = game["welcomeText"]
    write_json(INSTALLER_CONFIG, installer_cfg)
    print(f"installer_config.json 就绪：{INSTALLER_CONFIG}")


def build_docs(cfg: dict) -> None:
    """生成玩家说明（游戏名/别名/exe/精选 Mod/商店源均由 config 渲染）。"""
    game = cfg["game"]
    exe = game.get("exe") or "Game.exe"
    featured = list(game.get("featuredMods", []))
    sources = [dict(s) for s in cfg["sources"]]
    for s in sources:
        s.setdefault("enabled", True)
    DOCS_OUT.mkdir(parents=True, exist_ok=True)

    aliases_text = " / ".join(game["aliases"])
    featured_text = " · ".join(featured) if featured else "（无）"
    source_lines = []
    for i, s in enumerate(sources, 1):
        source_lines.append(f"  {i}. {s['name']}")
        source_lines.append(f"     catalog: {s['catalogUrl']}")
    sources_text = "\n".join(source_lines) if source_lines else "  （无）"

    usage = f"""{game['name']} · Mod管理器整合包

一、这是什么
本整合包把 Mod 管理器 + 精选常用 Mod 一次装进游戏目录。
安装后可在游戏内「Mod 管理器 / 商店」里下载更多 Mod、检查更新。
安装器向游戏已有的 index.html 注入管理器入口，不会整文件覆盖，
游戏作者写在 index.html 里的版本号等信息会保留。
你已有的 Mod 开关和参数也不会被重装冲掉。

二、怎么装
1. 解压本压缩包到任意目录
2. 双击「{cfg['output']['exeName']}.exe」
3. 按向导选择游戏目录（一般能自动找到）
   - 自动查找按目录别名匹配：{aliases_text}
   - 选到有 {exe} 的文件夹就对了
4. 建议勾选「备份 save」（会存 zip 到游戏目录\\存档备份\\）
5. 安装完成后可勾选启动游戏

三、装完后启动游戏
- 标题界面左上角 → Mod 管理器
- 随包精选 Mod 已在列表里，自己勾选要用的
- 商店里已配好 {len(sources)} 个源，不用手动填网址：
{sources_text}
- 更多 Mod（含第三方作者的）到商店自己挑、自己下载
- 更新：商店里检查更新即可

四、游戏更新后管理器不见了？
游戏更新可能覆盖 index.html，入口会消失。
双击游戏目录下的「Mod管理器注入工具.bat」：
  1. 注入管理器 — 重新写入入口
  2. 取消注入 — 恢复纯净游戏
  3. 退出

五、建议
- 隔几天备份一次游戏目录下的 save
- 不确定的 Mod 先关掉再玩
- 出问题可到社区反馈

六、精选入包 Mod（需自己在管理器勾选开启）
{featured_text}

其他 Mod 可在游戏内商店自行下载。
快捷键与参数可在 Mod 管理器里改；重装会保留你的设置。
"""
    (DOCS_OUT / "使用说明.txt").write_text(usage, encoding="utf-8")

    # Mod清单列实际入包的包目录名（description 取自各包 modloader.json）；
    # featuredMods 是显示名，用于欢迎页/使用说明，不一定等于包目录名。
    if cfg["packages"]:
        rows = ["Mod名字\t主要功能", "-" * 70]
        for name in cfg["packages"]:
            rows.append(f"{name}\t{read_package_description(name)}")
        mod_list = "\n".join(rows)
    else:
        mod_list = "（无）"
    manifest = f"""{game['name']} · Mod管理器整合包 Mod清单

{mod_list}

说明：
- 上列为精选入包 Mod，安装后需自己在 Mod 管理器勾选开启。
- 未列出的（含第三方作者 Mod）请到游戏内 Mod 商店自行下载。
- 安装器向游戏已有 index.html 注入管理器入口，不整文件覆盖（版本号等信息保留）。
- 不打包 mod_config.json：开关/参数一律玩家自选，重装不会覆盖。
- 预置商店源（第三方只预填源，不随包分发 Mod）：
{sources_text}
"""
    (DOCS_OUT / "Mod清单.txt").write_text(manifest, encoding="utf-8")

    fix_tool = """Mod管理器注入工具说明

安装后位于游戏目录下，文件名：Mod管理器注入工具.bat

用途：
- 游戏更新把 index.html 覆盖后，Mod 管理器入口会消失。
  双击本工具，选「1. 注入管理器」即可重新写回入口。
- 选「2. 取消注入」可删除管理器入口，恢复纯净游戏。

双击运行，按菜单选 1 / 2 / 3 即可。
"""
    (DOCS_OUT / "修复工具说明.txt").write_text(fix_tool, encoding="utf-8")
    print(f"玩家说明就绪：{DOCS_OUT}")


def build_exe(cfg: dict) -> Path:
    print("编译安装器 ...")
    BUILD.mkdir(parents=True, exist_ok=True)
    DIST.mkdir(parents=True, exist_ok=True)
    exe_name = cfg["output"]["exeName"]
    cmd = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--onefile",
        "--noconsole",
        "--name",
        exe_name,
        "--distpath",
        str(DIST),
        "--workpath",
        str(BUILD / "pyi"),
        "--specpath",
        str(BUILD),
        "--clean",
        str(INSTALLER_PY),
    ]
    try:
        subprocess.run(cmd, check=True)
    except subprocess.CalledProcessError as e:
        raise SystemExit(
            f"PyInstaller 编译失败（exit {e.returncode}）。\n命令：{' '.join(cmd)}")
    except FileNotFoundError:
        raise SystemExit("未找到 PyInstaller，请先安装：python -m pip install pyinstaller")
    exe = DIST / f"{exe_name}.exe"
    if not exe.is_file():
        raise SystemExit(f"未找到编译产物: {exe}")
    print(f"  exe: {exe}")
    return exe


def build_zip(cfg: dict) -> Path:
    """把安装器 + Mod文件 + 说明 + installer_config.json 打成一个分发 zip"""
    print("打包分发 zip ...")
    DIST.mkdir(parents=True, exist_ok=True)

    stage = DIST / "_stage"
    rmtree(stage)
    stage.mkdir(parents=True, exist_ok=True)

    exe_src = DIST / f"{cfg['output']['exeName']}.exe"
    if exe_src.is_file():
        copy_file(exe_src, stage / exe_src.name)
    else:
        print("  警告：无 exe，将放入 install_builder.py（玩家需自备 Python 或你再编译）")
        copy_file(INSTALLER_PY, stage / INSTALLER_PY.name)

    # installer_config.json 必须与 exe 同级，否则安装器启动即报错
    if INSTALLER_CONFIG.is_file():
        copy_file(INSTALLER_CONFIG, stage / INSTALLER_CONFIG.name)
    else:
        print("  警告：缺少 installer_config.json，安装器将无法启动")

    # Mod文件 与 说明
    if MOD_FILES.is_dir():
        shutil.copytree(MOD_FILES, stage / "Mod文件")
    if DOCS_OUT.is_dir():
        shutil.copytree(DOCS_OUT, stage / DOCS_OUT.name)

    # 固定名，不带版本；分发时自己改文件名
    zip_path = DIST / f"{cfg['output']['zipName']}.zip"
    if zip_path.exists():
        zip_path.unlink()

    # 压缩阶段根目录为 stage 内容
    import zipfile

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in stage.rglob("*"):
            if f.is_file():
                zf.write(f, f.relative_to(stage).as_posix())

    rmtree(stage)
    size_mb = zip_path.stat().st_size / (1024 * 1024)
    print(f"  zip: {zip_path} ({size_mb:.1f} MB)")
    return zip_path


def main() -> None:
    parser = argparse.ArgumentParser(description="构建 RMMZ Mod管理器整合包（配置驱动）")
    parser.add_argument("--exe", action="store_true", help="用 PyInstaller 编译安装器")
    parser.add_argument("--zip", action="store_true", help="生成社区分发 zip")
    parser.add_argument("--only-zip", action="store_true", help="跳过同步，仅用现有 Mod文件 打 zip")
    args = parser.parse_args()

    cfg = load_bundle_config()

    if args.only_zip:
        args.zip = True  # --only-zip 语义即「跳过同步，仅用现有 Mod文件 打 zip」

    if not args.only_zip:
        build_mod_files(cfg)

    write_installer_config(cfg)
    build_docs(cfg)

    if args.exe:
        build_exe(cfg)

    if args.zip:
        build_zip(cfg)

    if not (args.exe or args.zip):
        print("\n下一步示例：")
        print("  python build_package.py --zip --exe")


if __name__ == "__main__":
    main()
