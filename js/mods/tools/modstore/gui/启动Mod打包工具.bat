@echo off
cd /d "%~dp0"

set "NODE_EXE="
if exist "%~dp0..\portable\node\node.exe" set "NODE_EXE=%~dp0..\portable\node\node.exe"

if "%NODE_EXE%"=="" (
    where node >nul 2>nul
    if not errorlevel 1 set "NODE_EXE=node"
)

if "%NODE_EXE%"=="" (
    echo.
    echo [ERROR] Node.js not found.
    echo Install Node.js 18+ from https://nodejs.org
    echo Or put portable node.exe in: tools\modstore\portable\node\node.exe
    echo.
    pause
    exit /b 1
)

echo Starting Mod Packager GUI...
echo URL: http://127.0.0.1:19280
echo Close this window to stop the server.
echo.

"%NODE_EXE%" "%~dp0server.js"
pause
