@echo off
cd /d "%~dp0.."
node test\run-all.js
exit /b %ERRORLEVEL%
