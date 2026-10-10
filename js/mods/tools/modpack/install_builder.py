#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
RMMZ Mod管理器整合包 安装器（通用）

游戏相关数据（目录别名、exe 名、窗口文案、精选 Mod 列表）一律从同级目录的
installer_config.json 读取，不硬编码：本 exe 构筑一次，即可被不同 RMMZ 游戏的
整合包重复使用（每个游戏随包带自己的 installer_config.json）。

编译（在 js/mods/tools/modpack 下）：
  pyinstaller --onefile --noconsole --name "Mod管理器整合包安装器" install_builder.py
产物命名也可由打包配置 output.exeName 决定，见 build_package.py。
注意：窗口标题等界面文案不写版本号；分发时直接改压缩包文件名即可。
"""

import os
import re
import sys
import json
import shutil
import zipfile
import threading
import subprocess
import string
import winreg
from datetime import datetime
import tkinter as tk
from tkinter import ttk, filedialog, messagebox

# ==================== 基础设施契约（所有 RMMZ 游戏一致，不随游戏变化） ====================
CONFIG_NAME = "installer_config.json"  # 外部配置：与 exe/脚本同级
MOD_FILES_DIR = "Mod文件"              # 安装载荷目录名（build_package.py 生成）
INSTALL_ITEMS = ["js", "Mod管理器注入工具.bat"]
INJECT_BAT_NAME = "Mod管理器注入工具.bat"
# 不打包/不覆盖 index.html：安装时对游戏已有文件注入 ModLoader 引用，
# 保住游戏作者写在 index.html 的版本号等信息。

# 玩家自有状态文件（重装保护）：
# - mod_config.json：Mod 开关/参数/顺序，载荷从不含它；若异常含则跳过不覆盖
# - config/modloader_config.json：管理器偏好（语言/主题/工坊），玩家已有则跳过
# - config/mod_store.json：商店订阅与已读状态，玩家已有则按源 id 合并（保留玩家订阅）
PLAYER_STATE_SKIP = {
    "js/mods/mod_config.json",
    "js/mods/config/modloader_config.json",
}
PLAYER_STATE_MERGE = {"js/mods/config/mod_store.json"}
# ==================== 契约结束 ====================


class ConfigError(Exception):
    """installer_config.json 缺失或字段不合法。"""


def get_app_dir():
    """获取安装器自身所在目录"""
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


def load_installer_config():
    """从 exe/脚本同级目录读取 installer_config.json 并校验。

    必填：appTitle、gameAliases（非空字符串数组）、gameExe。
    可选：welcomeText（欢迎页全文，缺省时按步骤+精选 Mod 自动拼装）、
          featuredMods、featuredModsNote、dirHint。
    返回归一化后的 dict。任何问题都抛 ConfigError（由调用方弹窗退出）。
    """
    path = os.path.join(get_app_dir(), CONFIG_NAME)
    if not os.path.isfile(path):
        raise ConfigError(
            f"未找到配置文件 {CONFIG_NAME}。\n"
            f"请把它放到本程序同一目录下再运行。"
        )

    try:
        # utf-8-sig：容忍 Notepad / PowerShell 5.1 写出的带 BOM UTF-8
        with open(path, "r", encoding="utf-8-sig") as f:
            data = json.load(f)
    except Exception as e:
        raise ConfigError(f"读取 {CONFIG_NAME} 失败：{e}")

    if not isinstance(data, dict):
        raise ConfigError(f"{CONFIG_NAME} 顶层必须是 JSON 对象。")

    def need_str(key):
        val = data.get(key)
        if not isinstance(val, str) or not val.strip():
            raise ConfigError(f"{CONFIG_NAME} 缺少必填字符串字段「{key}」。")
        return val

    def need_str_list(key):
        val = data.get(key)
        if (not isinstance(val, list) or not val
                or not all(isinstance(x, str) and x.strip() for x in val)):
            raise ConfigError(
                f"{CONFIG_NAME} 字段「{key}」必须是非空字符串数组（游戏目录别名）。")
        return list(val)

    cfg = {
        "appTitle": need_str("appTitle"),
        "gameAliases": need_str_list("gameAliases"),
        "gameExe": need_str("gameExe"),
    }

    featured = data.get("featuredMods", [])
    if not isinstance(featured, list) or not all(isinstance(x, str) for x in featured):
        raise ConfigError(f"{CONFIG_NAME} 字段「featuredMods」必须是字符串数组。")
    cfg["featuredMods"] = list(featured)

    for key in ("welcomeText", "featuredModsNote", "dirHint"):
        val = data.get(key)
        if val is not None and not isinstance(val, str):
            raise ConfigError(f"{CONFIG_NAME} 字段「{key}」必须是字符串。")
        cfg[key] = val

    return cfg


def default_welcome_text(cfg):
    """欢迎页正文：安装步骤 + 随包精选 Mod + 其余 Mod 提示。"""
    text = (
        "安装步骤（懒得看就一路「下一步」）：\n"
        "  1. 自动找到游戏目录（找不到就手动选）\n"
        "  2. 备份 save（默认勾选）\n"
        "  3. 复制 Mod 文件到游戏目录\n"
        "  4. 把管理器入口接进游戏的 index.html\n"
        "  5. 装完进管理器自己勾选要用的 Mod\n\n"
    )
    if cfg["featuredMods"]:
        text += "随包精选 Mod：\n  " + " · ".join(cfg["featuredMods"]) + "\n"
    text += (cfg.get("featuredModsNote")
             or "其他 Mod 到游戏内 Mod 商店自行下载。") + "\n"
    return text


def default_dir_hint(cfg):
    return cfg.get("dirHint") or f"选到有 {cfg['gameExe']} 的那个文件夹就对了"


def folder_matches_game(folder_name, aliases):
    """文件夹名是否像本作安装目录（发售名/安装名不一致时按别名匹配）"""
    return any(alias in folder_name for alias in aliases)


def is_game_dir(path, game_exe):
    return bool(path) and os.path.isfile(os.path.join(path, game_exe))


def get_steam_install():
    """通过注册表查找 Steam 安装路径"""
    reg_paths = [
        (winreg.HKEY_CURRENT_USER, r"Software\Valve\Steam", "SteamPath"),
        (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Valve\Steam", "InstallPath"),
        (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Valve\Steam", "InstallPath"),
    ]
    for hive, subkey, valname in reg_paths:
        try:
            key = winreg.OpenKey(hive, subkey)
            val, _ = winreg.QueryValueEx(key, valname)
            winreg.CloseKey(key)
            val = val.replace("/", "\\")
            if os.path.isdir(val):
                return val
        except (OSError, FileNotFoundError):
            continue
    return None


def get_steam_libraries():
    """读取 libraryfolders.vdf 获取所有 Steam 库路径"""
    steam = get_steam_install()
    libraries = []

    if steam:
        common = os.path.join(steam, "steamapps", "common")
        if os.path.isdir(common):
            libraries.append(common)

        vdf_path = os.path.join(steam, "steamapps", "libraryfolders.vdf")
        if os.path.isfile(vdf_path):
            try:
                with open(vdf_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                paths = re.findall(r'"path"\s+"([^"]+)"', content)
                for p in paths:
                    p = p.replace("\\\\", "\\").replace("/", "\\")
                    common = os.path.join(p, "steamapps", "common")
                    if os.path.isdir(common) and common not in libraries:
                        libraries.append(common)
            except Exception:
                pass

    drives = [f"{d}:\\" for d in string.ascii_uppercase if os.path.exists(f"{d}:\\")]
    for d in drives:
        common = os.path.join(d, "SteamLibrary", "steamapps", "common")
        if os.path.isdir(common) and common not in libraries:
            libraries.append(common)

    for p in [
        r"C:\Program Files (x86)\Steam\steamapps\common",
        r"C:\Program Files\Steam\steamapps\common",
    ]:
        if os.path.isdir(p) and p not in libraries:
            libraries.append(p)

    return libraries


def find_game_directory(cfg):
    """自动查找游戏目录（按配置的别名匹配文件夹名）"""
    aliases = cfg["gameAliases"]
    game_exe = cfg["gameExe"]
    seen = set()

    for common in get_steam_libraries():
        if not os.path.isdir(common):
            continue
        try:
            for folder in os.listdir(common):
                if not folder_matches_game(folder, aliases):
                    continue
                full = os.path.join(common, folder)
                if full not in seen and is_game_dir(full, game_exe):
                    seen.add(full)
                    return full
        except PermissionError:
            continue

    desktop = os.path.join(os.path.expanduser("~"), "Desktop")
    for extra in [desktop, r"C:\Program Files", r"C:\Program Files (x86)"]:
        if not os.path.isdir(extra):
            continue
        try:
            for folder in os.listdir(extra):
                if not folder_matches_game(folder, aliases):
                    continue
                full = os.path.join(extra, folder)
                if full not in seen and is_game_dir(full, game_exe):
                    seen.add(full)
                    return full
        except PermissionError:
            continue

    drives = [f"{d}:\\" for d in string.ascii_uppercase if os.path.exists(f"{d}:\\")]
    for d in drives:
        try:
            for item in os.listdir(d):
                full = os.path.join(d, item)
                if not os.path.isdir(full):
                    continue
                if folder_matches_game(item, aliases) and is_game_dir(full, game_exe):
                    return full
                try:
                    for sub in os.listdir(full):
                        sub_full = os.path.join(full, sub)
                        if folder_matches_game(sub, aliases) and is_game_dir(sub_full, game_exe):
                            return sub_full
                except PermissionError:
                    continue
        except PermissionError:
            continue

    return None


def get_install_file_list(mod_dir):
    """获取待安装文件列表"""
    files = []
    for item in INSTALL_ITEMS:
        src = os.path.join(mod_dir, item)
        if not os.path.exists(src):
            continue
        if os.path.isfile(src):
            files.append((src, item))
        elif os.path.isdir(src):
            for root, dirs, filenames in os.walk(src):
                for f in filenames:
                    full = os.path.join(root, f)
                    rel = os.path.relpath(full, mod_dir)
                    files.append((full, rel))
    return files


def do_backup(game_dir, status_callback):
    """备份 save 文件夹到 存档备份 目录"""
    save_dir = os.path.join(game_dir, "save")
    if not os.path.isdir(save_dir):
        status_callback("未找到 save 文件夹，跳过备份")
        return None

    backup_dir = os.path.join(game_dir, "存档备份")
    os.makedirs(backup_dir, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d-%H-%M-%S")
    zip_name = f"{timestamp}-安装Mod管理器备份.zip"
    zip_path = os.path.join(backup_dir, zip_name)

    status_callback(f"正在备份存档 → {zip_name} ...")

    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(save_dir):
            for f in files:
                full = os.path.join(root, f)
                rel = os.path.relpath(full, os.path.dirname(save_dir))
                zf.write(full, rel)

    return zip_path


def merge_store_json(game_path, bundle_path):
    """玩家已有 mod_store.json 时按源 id 合并：保留玩家订阅与已读状态，补入包内新源。

    返回 (ok, message)。任一侧结构异常时保留玩家原文件不动（fail-safe）。
    """
    def load(p):
        try:
            with open(p, "r", encoding="utf-8-sig") as f:
                return json.load(f)
        except Exception:
            return None

    player = load(game_path)
    if not isinstance(player, dict):
        return False, "你的 mod_store.json 损坏，已保留原文件"
    bundle = load(bundle_path)
    if not isinstance(bundle, dict):
        return False, "包内 mod_store.json 异常，已保留你的文件"
    p_sources = player.get("sources")
    b_sources = bundle.get("sources")
    if not isinstance(p_sources, list) or not isinstance(b_sources, list):
        return False, "mod_store.json 结构异常，已保留你的文件"

    by_id = {}
    for s in p_sources:
        if isinstance(s, dict) and s.get("id"):
            by_id[str(s["id"])] = s
    added = 0
    for s in b_sources:
        if not isinstance(s, dict) or not s.get("id"):
            continue
        sid = str(s["id"])
        if sid not in by_id:
            by_id[sid] = dict(s)
            added += 1
    player["sources"] = list(by_id.values())

    # seenMods 并集：玩家已读状态保留，包内精选 Mod 补标已读
    b_seen = bundle.get("seenMods")
    if isinstance(b_seen, dict):
        p_seen = player.get("seenMods")
        if not isinstance(p_seen, dict):
            p_seen = {}
        for k, v in b_seen.items():
            if k not in p_seen:
                p_seen[k] = v
        player["seenMods"] = p_seen

    # 标量设置玩家值优先，缺失才用包内值补
    for key in ("maxDownloadBytes", "suppressInstallHint"):
        if key not in player and key in bundle:
            player[key] = bundle[key]

    try:
        with open(game_path, "w", encoding="utf-8") as f:
            json.dump(player, f, ensure_ascii=False, indent=2)
            f.write("\n")
    except Exception as e:
        return False, f"写入 mod_store.json 失败：{e}"
    return True, f"已合并商店源（新增 {added} 个，你的订阅与已读状态保留）"


def install_one_file(src, dst, key):
    """按玩家状态保护规则安装单个载荷文件，返回界面提示文案（默认复制返回 None）。

    key 为载荷内相对路径（posix）。玩家已有 mod_config.json /
    modloader_config.json 时跳过不覆盖；已有 mod_store.json 时按源 id 合并。
    """
    if key in PLAYER_STATE_SKIP and os.path.exists(dst):
        return f"已保留你的现有文件：{key}"
    if key in PLAYER_STATE_MERGE and os.path.exists(dst):
        _ok, msg = merge_store_json(dst, src)
        return msg
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy2(src, dst)
    return None


def inject_modloader(game_dir):
    """对游戏已有 index.html 注入 js/mods/ModLoader.js 引用（不整文件替换）。

    返回 (ok: bool, message: str)。与 Mod管理器注入工具.bat 契约一致：
    - 已含 js/mods/ModLoader.js → 幂等跳过
    - 在 main.js script 标签之前插入
    - 找不到 main.js 锚点 → 失败，不写文件
    """
    index_path = os.path.join(game_dir, "index.html")
    if not os.path.isfile(index_path):
        return False, "未找到 index.html，跳过注入"

    try:
        # newline="" 保留原始 CRLF/LF，与注入工具 bat 契约一致
        with open(index_path, "r", encoding="utf-8", newline="") as f:
            text = f.read()
    except Exception as e:
        return False, f"读取 index.html 失败：{e}"

    if "js/mods/ModLoader.js" in text:
        return True, "index.html 已注入 ModLoader 引用"

    match = re.search(
        r"(?m)^[ \t]*<script[^>]*js/main\.js[^>]*>\s*</script>", text
    )
    if not match:
        return False, "index.html 中未找到 main.js 脚本标签，无法注入"

    newline = "\r\n" if "\r\n" in text else "\n"
    insert = (
        "    <!-- ModLoader 必须在 main.js 之前加载 -->"
        + newline
        + '    <script type="text/javascript" src="js/mods/ModLoader.js"></script>'
        + newline
    )
    new_text = text[: match.start()] + insert + text[match.start() :]

    try:
        with open(index_path, "w", encoding="utf-8", newline="") as f:
            f.write(new_text)
    except Exception as e:
        return False, f"写入 index.html 失败：{e}"

    return True, "已注入 ModLoader 引用"


class InstallerWizard(tk.Tk):
    WIDTH = 540
    HEIGHT = 460

    def __init__(self, cfg):
        super().__init__()
        self.cfg = cfg
        self.title(cfg["appTitle"])
        self.geometry(f"{self.WIDTH}x{self.HEIGHT}")
        self.resizable(False, False)
        self.minsize(self.WIDTH, self.HEIGHT)

        try:
            self.style = ttk.Style(self)
            self.style.theme_use("vista")
        except Exception:
            pass

        self.game_dir = tk.StringVar()
        self.do_backup_var = tk.BooleanVar(value=True)
        self.launch_game = tk.BooleanVar(value=True)
        self.install_running = False
        self.install_cancelled = False
        self.inject_message = ""

        self.container = ttk.Frame(self, padding=24)
        self.container.pack(fill="both", expand=True)

        self.pages = {}
        self.current_page = None
        self.create_pages()
        self.show_page("welcome")

        self.protocol("WM_DELETE_WINDOW", self.on_close)

    def create_pages(self):
        for name in ("welcome", "directory", "backup", "installing", "complete"):
            frame = ttk.Frame(self.container)
            self.pages[name] = frame

    def show_page(self, name):
        if self.current_page:
            self.current_page.pack_forget()
        self.current_page = self.pages[name]
        self.current_page.pack(fill="both", expand=True)
        getattr(self, f"build_{name}")()

    def make_button_bar(self, page):
        """统一底部按钮条：各页按钮同一 Y（贴底），主动作放右侧。"""
        bar = ttk.Frame(page)
        bar.pack(side="bottom", fill="x", pady=(0, 20))
        return bar

    def build_welcome(self):
        for w in self.pages["welcome"].winfo_children():
            w.destroy()

        ttk.Label(self.pages["welcome"],
                  text="欢迎使用 Mod管理器整合包 安装向导",
                  font=("微软雅黑", 18, "bold")).pack(pady=(30, 8))

        ttk.Label(self.pages["welcome"],
                  text="本向导将帮助您将 Mod 文件安装到游戏目录中。",
                  font=("微软雅黑", 10)).pack(pady=4)

        desc_frame = ttk.Frame(self.pages["welcome"])
        desc_frame.pack(pady=(12, 8), fill="both", expand=True)
        desc_text = self.cfg.get("welcomeText") or default_welcome_text(self.cfg)
        ttk.Label(desc_frame, text=desc_text,
                  font=("微软雅黑", 10), foreground="#333",
                  justify="left", wraplength=480).pack(padx=10, anchor="w")

        bar = self.make_button_bar(self.pages["welcome"])
        ttk.Button(bar, text="下一步 →",
                   command=lambda: self.show_page("directory")).pack(side="right")

    def build_directory(self):
        for w in self.pages["directory"].winfo_children():
            w.destroy()

        ttk.Label(self.pages["directory"],
                  text="选择游戏目录",
                  font=("微软雅黑", 16, "bold")).pack(pady=(24, 16))

        found = find_game_directory(self.cfg)
        if found:
            self.game_dir.set(found)
            status_text = "已自动找到游戏目录（可改）："
        else:
            self.game_dir.set("")
            status_text = "没自动找到，请点「浏览...」选游戏文件夹："

        ttk.Label(self.pages["directory"], text=status_text,
                  font=("微软雅黑", 10)).pack(anchor="w", padx=4)

        entry_frame = ttk.Frame(self.pages["directory"])
        entry_frame.pack(fill="x", pady=(8, 4))
        entry = ttk.Entry(entry_frame, textvariable=self.game_dir,
                          font=("微软雅黑", 10), width=50)
        entry.pack(side="left", fill="x", expand=True, padx=(0, 8))
        ttk.Button(entry_frame, text="浏览...",
                   command=self.browse_folder).pack(side="right")

        hint = ttk.Label(self.pages["directory"],
                         text=default_dir_hint(self.cfg),
                         font=("微软雅黑", 9), foreground="#888",
                         wraplength=480, justify="left")
        hint.pack(anchor="w", padx=4, pady=(0, 20))

        self.dir_valid_label = ttk.Label(self.pages["directory"],
                                         text="", font=("微软雅黑", 9))
        self.dir_valid_label.pack(anchor="w", padx=4, pady=(0, 8))

        self.game_dir.trace_add("write", self.validate_dir)

        bar = self.make_button_bar(self.pages["directory"])
        ttk.Button(bar, text="← 上一步",
                   command=lambda: self.show_page("welcome")).pack(side="left")
        self.next_btn = ttk.Button(bar, text="下一步 →",
                                   command=self.on_directory_next)
        self.next_btn.pack(side="right")
        self.next_btn.state(["disabled"])

        self.validate_dir()

    def browse_folder(self):
        path = filedialog.askdirectory(title="选择游戏目录")
        if path:
            self.game_dir.set(path)

    def validate_dir(self, *_):
        path = self.game_dir.get()
        if is_game_dir(path, self.cfg["gameExe"]):
            self.dir_valid_label.config(
                text=f"√ 目录有效（找到 {self.cfg['gameExe']}）",
                foreground="#0a8f4b")
            self.next_btn.state(["!disabled"])
        elif path:
            self.dir_valid_label.config(
                text=f"× 这个文件夹里没有 {self.cfg['gameExe']}，换一个",
                foreground="#d63e3e")
            self.next_btn.state(["disabled"])
        else:
            self.dir_valid_label.config(text="")
            self.next_btn.state(["disabled"])

    def on_directory_next(self):
        path = self.game_dir.get()
        if not is_game_dir(path, self.cfg["gameExe"]):
            messagebox.showwarning(
                "目录无效",
                f"请选择包含 {self.cfg['gameExe']} 的有效游戏目录。")
            return
        self.show_page("backup")

    def build_backup(self):
        for w in self.pages["backup"].winfo_children():
            w.destroy()

        ttk.Label(self.pages["backup"],
                  text="存档备份与安装",
                  font=("微软雅黑", 16, "bold")).pack(pady=(24, 16))

        info_frame = ttk.Frame(self.pages["backup"])
        info_frame.pack(fill="x", pady=(4, 12))
        info_text = (
            "准备装到这里：\n"
            f"  {self.game_dir.get()}\n\n"
            "会复制 Mod 文件，并把管理器入口接到 index.html。\n"
            "你已有的 Mod 开关 / 参数会保留。"
        )
        ttk.Label(info_frame, text=info_text,
                  font=("微软雅黑", 10), foreground="#333",
                  justify="left").pack(padx=4)

        chk_frame = ttk.Frame(self.pages["backup"])
        chk_frame.pack(fill="x", pady=(16, 4))
        self.backup_chk = ttk.Checkbutton(chk_frame,
                                          text="备份 save 文件夹（强烈建议勾选）",
                                          variable=self.do_backup_var)
        self.backup_chk.pack(anchor="w")

        backup_hint = ttk.Label(self.pages["backup"],
                                text="会存成 zip 放到：游戏目录\\存档备份\\，出问题能还原",
                                font=("微软雅黑", 9), foreground="#888",
                                wraplength=480, justify="left")
        backup_hint.pack(anchor="w", padx=24, pady=(0, 8))

        self.do_backup_var.trace_add("write", self.update_backup_btn_text)

        bar = self.make_button_bar(self.pages["backup"])
        ttk.Button(bar, text="← 上一步",
                   command=lambda: self.show_page("directory")).pack(side="left")
        self.install_btn = ttk.Button(bar, text="备份并安装",
                                      command=self.on_backup_next)
        self.install_btn.pack(side="right")

    def update_backup_btn_text(self, *_):
        if self.do_backup_var.get():
            self.install_btn.config(text="备份并安装")
        else:
            self.install_btn.config(text="安装")

    def on_backup_next(self):
        self.show_page("installing")
        self.start_install(self.game_dir.get(), self.do_backup_var.get())

    def build_installing(self):
        for w in self.pages["installing"].winfo_children():
            w.destroy()

        ttk.Label(self.pages["installing"],
                  text="正在安装...",
                  font=("微软雅黑", 16, "bold")).pack(pady=(24, 8))

        self.install_status = ttk.Label(self.pages["installing"],
                                        text="准备中...",
                                        font=("微软雅黑", 10))
        self.install_status.pack(pady=8)

        self.progress_bar = ttk.Progressbar(self.pages["installing"],
                                            mode="determinate",
                                            length=460)
        self.progress_bar.pack(pady=12)

        self.install_file_label = ttk.Label(self.pages["installing"],
                                            text="",
                                            font=("微软雅黑", 9), foreground="#888")
        self.install_file_label.pack(pady=4)

        bar = self.make_button_bar(self.pages["installing"])
        self.cancel_btn = ttk.Button(bar, text="取消",
                                     command=self.on_cancel_install)
        self.cancel_btn.pack(side="right")

    def start_install(self, game_dir, do_backup_flag):
        self.install_running = True
        self.install_cancelled = False
        mod_dir = os.path.join(get_app_dir(), MOD_FILES_DIR)
        if not os.path.isdir(mod_dir):
            self.install_status.config(text="未找到 Mod 文件目录！")
            self.cancel_btn.config(text="退出")
            self.install_running = False
            return

        thread = threading.Thread(target=self._do_install,
                                  args=(mod_dir, game_dir, do_backup_flag),
                                  daemon=True)
        thread.start()

    def _do_install(self, mod_dir, game_dir, do_backup_flag):
        try:
            if do_backup_flag:
                self.after(0, lambda: self.install_status.config(text="正在备份存档..."))
                zip_path = do_backup(game_dir, lambda msg: self.after(
                    0, lambda: self.install_file_label.config(text=msg)))
                if zip_path:
                    self.after(0, lambda: self.install_file_label.config(
                        text=f"备份完成：{os.path.basename(zip_path)}\n3秒后自动安装"))
                else:
                    self.after(0, lambda: self.install_file_label.config(text="跳过备份"))
                import time
                time.sleep(3.0)

            file_list = get_install_file_list(mod_dir)
            total = len(file_list)
            if total == 0:
                self.after(0, lambda: self._install_done(False, "没有需要安装的文件。"))
                return

            self.after(0, lambda: self.install_status.config(text="正在复制文件..."))

            for i, (src, rel) in enumerate(file_list):
                if self.install_cancelled:
                    return
                dst = os.path.join(game_dir, rel)
                note = install_one_file(src, dst, rel.replace("\\", "/")) or rel
                pct = int((i + 1) / total * 100)
                self.after(0, lambda p=pct, f=note, c=i+1, t=total:
                           self._update_progress(p, f, c, t))

            self.after(0, lambda: self.install_status.config(text="正在注入 ModLoader 入口..."))
            inj_ok, inj_msg = inject_modloader(game_dir)
            self.inject_message = inj_msg
            self.after(0, lambda: self.install_file_label.config(text=inj_msg))

            if not inj_ok and "跳过" not in inj_msg:
                self.after(0, lambda: self._install_done(
                    False, f"文件已复制，但 index.html 注入失败：\n{inj_msg}"))
                return

            self.after(0, lambda: self._install_done(True, None))
        except Exception as e:
            self.after(0, lambda: self._install_done(False, str(e)))

    def _update_progress(self, pct, filename, current, total):
        self.progress_bar["value"] = pct
        self.install_status.config(text=f"正在复制文件... ({current}/{total})")
        self.install_file_label.config(text=filename)

    def _install_done(self, success, error):
        self.install_running = False
        if success:
            self.show_page("complete")
        else:
            messagebox.showerror("安装失败", f"安装过程中出现错误：\n{error}")
            self.cancel_btn.config(text="退出", command=self.destroy)

    def on_cancel_install(self):
        if self.install_running:
            if messagebox.askyesno("确认取消", "确定要取消安装吗？"):
                self.install_cancelled = True
                self.install_status.config(text="已取消")
                self.cancel_btn.config(text="退出", command=self.destroy)
        else:
            self.destroy()

    def build_complete(self):
        for w in self.pages["complete"].winfo_children():
            w.destroy()

        ttk.Label(self.pages["complete"],
                  text="安装完成",
                  font=("微软雅黑", 18, "bold"),
                  foreground="#0a8f4b").pack(pady=(30, 8))

        ttk.Label(self.pages["complete"],
                  text="装好了！启动游戏 → 标题左上角进 Mod 管理器，自己勾选要用的 Mod。",
                  font=("微软雅黑", 10)).pack(pady=2)

        inject_text = self.inject_message or "未执行 index.html 注入"
        ttk.Label(self.pages["complete"],
                  text=f"index.html：{inject_text}",
                  font=("微软雅黑", 9), foreground="#888",
                  wraplength=480, justify="left").pack(pady=2)

        ttk.Label(self.pages["complete"],
                  text=f"目标目录：{self.game_dir.get()}",
                  font=("微软雅黑", 9), foreground="#888").pack(pady=2)

        ttk.Label(self.pages["complete"],
                  text=f"以后游戏更新把管理器入口冲掉了？双击游戏目录下「{INJECT_BAT_NAME}」再点 1 注入即可。",
                  font=("微软雅黑", 9), foreground="#888", wraplength=480,
                  justify="center").pack(pady=4)

        chk = ttk.Checkbutton(self.pages["complete"],
                              text="启动游戏（标题界面左上角进入Mod管理器）",
                              variable=self.launch_game)
        chk.pack(pady=(20, 4))

        bar = self.make_button_bar(self.pages["complete"])
        ttk.Button(bar, text="退出",
                   command=self.on_complete_exit).pack(side="right")

    def on_complete_exit(self):
        if self.launch_game.get():
            game_exe = os.path.join(self.game_dir.get(), self.cfg["gameExe"])
            if os.path.isfile(game_exe):
                subprocess.Popen([game_exe], cwd=self.game_dir.get())
        self.destroy()

    def on_close(self):
        if self.install_running:
            if messagebox.askyesno("确认退出", "安装正在进行中，确定要退出吗？"):
                self.install_cancelled = True
                self.destroy()
        else:
            self.destroy()


if __name__ == "__main__":
    try:
        _cfg = load_installer_config()
    except ConfigError as e:
        messagebox.showerror("配置错误", str(e))
        sys.exit(1)
    app = InstallerWizard(_cfg)
    app.mainloop()
