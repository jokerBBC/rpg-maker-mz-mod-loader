# -*- coding: utf-8 -*-
"""生成 GBK 编码的 Mod管理器注入工具.bat，避免中文乱码。

bat 内容游戏通用（js/mods/ModLoader.js 注入/移除契约），无游戏特定内容。
输出到本脚本所在目录（js/mods/tools/modpack/Mod管理器注入工具.bat），
任意 cwd 下运行均可。改动注入/移除逻辑后重新运行本脚本即可。
"""
import base64
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "Mod管理器注入工具.bat"


def enc(ps: str) -> str:
    return base64.b64encode(ps.encode("utf-16-le")).decode("ascii")


inject_ps = "\n".join(
    [
        "$p = 'index.html'",
        "if (-not (Test-Path -LiteralPath $p)) { exit 1 }",
        "$full = (Resolve-Path -LiteralPath $p).Path",
        "$t = [IO.File]::ReadAllText($full)",
        "if ($t -match 'js/mods/ModLoader\\.js') { exit 2 }",
        '$nl = if ($t -match "`r`n") { "`r`n" } else { "`n" }',
        "$comment = '    <!-- ModLoader \u5fc5\u987b\u5728 main.js \u4e4b\u524d\u52a0\u8f7d -->'",
        '$script = \'    <script type="text/javascript" src="js/mods/ModLoader.js"></script>\'',
        "$ins = $comment + $nl + $script + $nl",
        "$m = [regex]::Match($t, '(?m)^[ \\t]*<script[^>]*js/main\\.js[^>]*>\\s*</script>')",
        "if (-not $m.Success) { exit 3 }",
        "$t = $t.Substring(0, $m.Index) + $ins + $t.Substring($m.Index)",
        "[IO.File]::WriteAllText($full, $t, [Text.UTF8Encoding]::new($false))",
        "exit 0",
        "",
    ]
)

remove_ps = "\n".join(
    [
        "$p = 'index.html'",
        "if (-not (Test-Path -LiteralPath $p)) { exit 1 }",
        "$full = (Resolve-Path -LiteralPath $p).Path",
        "$t = [IO.File]::ReadAllText($full)",
        "if ($t -notmatch 'js/mods/ModLoader\\.js') { exit 2 }",
        r"$t = [regex]::Replace($t, '(?m)^[ \t]*<!--.*ModLoader.*-->[ \t]*\r?\n', '')",
        r"$t = [regex]::Replace($t, '(?m)^[ \t]*<script[^>]*js/mods/ModLoader\.js[^>]*>\s*</script>[ \t]*\r?\n', '')",
        "[IO.File]::WriteAllText($full, $t, [Text.UTF8Encoding]::new($false))",
        "exit 0",
        "",
    ]
)

inj_b64 = enc(inject_ps)
rem_b64 = enc(remove_ps)
title = "Mod\u7ba1\u7406\u5668\u6ce8\u5165\u5de5\u5177"

lines = [
    "@echo off",
    "chcp 936 >nul",
    f"title {title}",
    'cd /d "%~dp0"',
    "",
    'if not exist "index.html" (',
    "  echo [!] \u672a\u627e\u5230 index.html\uff0c\u8bf7\u628a\u672c\u5de5\u5177\u653e\u5728\u6e38\u620f\u76ee\u5f55\u4e0b\u8fd0\u884c\u3002",
    "  pause",
    "  exit /b 1",
    ")",
    "",
    ":menu",
    "cls",
    "echo ========================================",
    f"echo   {title}",
    "echo ========================================",
    "echo.",
    "echo   1. \u6ce8\u5165\u7ba1\u7406\u5668",
    "echo   2. \u53d6\u6d88\u6ce8\u5165",
    "echo   3. \u9000\u51fa",
    "echo.",
    'set "choice="',
    "set /p choice=\u8bf7\u9009\u62e9 [1/2/3]: ",
    'if "%choice%"=="1" goto inject',
    'if "%choice%"=="2" goto remove',
    'if "%choice%"=="3" exit /b 0',
    "echo \u65e0\u6548\u9009\u62e9\uff0c\u8bf7\u91cd\u8bd5\u3002",
    "pause",
    "goto menu",
    "",
    ":inject",
    f"powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand {inj_b64}",
    'set "rc=%errorlevel%"',
    'if "%rc%"=="0" (',
    "  echo [OK] \u6ce8\u5165\u5b8c\u6210\u3002\u82e5\u6e38\u620f\u5df2\u6253\u5f00\uff0c\u8bf7\u91cd\u542f\u6e38\u620f\u3002",
    ') else if "%rc%"=="2" (',
    "  echo [i] \u7ba1\u7406\u5668\u5df2\u6ce8\u5165\uff0c\u65e0\u9700\u91cd\u590d\u64cd\u4f5c\u3002",
    ') else if "%rc%"=="3" (',
    "  echo [!] \u672a\u627e\u5230 main.js \u811a\u672c\u6807\u7b7e\uff0c\u6ce8\u5165\u5931\u8d25\u3002",
    ") else (",
    "  echo [!] \u6ce8\u5165\u5931\u8d25\uff0c\u8bf7\u786e\u8ba1 index.html \u5b58\u5728\u4e14\u53ef\u5199\u3002",
    ")",
    "pause",
    "goto menu",
    "",
    ":remove",
    f"powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand {rem_b64}",
    'set "rc=%errorlevel%"',
    'if "%rc%"=="0" (',
    "  echo [OK] \u5df2\u53d6\u6d88\u6ce8\u5165\uff0c\u6062\u590d\u7eaf\u51c1\u6e38\u620f\u3002",
    ') else if "%rc%"=="2" (',
    "  echo [i] \u5f53\u524d\u672a\u6ce8\u5165\u7ba1\u7406\u5668\u3002",
    ") else (",
    "  echo [!] \u53d6\u6d88\u6ce8\u5165\u5931\u8d25\uff0c\u8bf7\u786e\u8ba1 index.html \u5b58\u5728\u4e14\u53ef\u5199\u3002",
    ")",
    "pause",
    "goto menu",
    "",
]

text = "\r\n".join(lines) + "\r\n"
OUT.write_bytes(text.encode("gbk"))
raw = OUT.read_bytes()
decoded = raw.decode("gbk")
assert "注入管理器" in decoded
assert "取消注入" in decoded
assert "退出" in decoded
assert "EncodedCommand" in decoded
print("OK", OUT, "bytes", len(raw))
print("inject_cmd_len", len(inj_b64))
print("remove_cmd_len", len(rem_b64))
print("--- bat preview ---")
print(decoded)
