@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server-status.ps1"
echo.
pause
