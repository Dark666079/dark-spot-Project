@echo off
setlocal
cd /d "%~dp0"
title Dark Spot Server Control

echo ========================================
echo       DARK SPOT - SERVER CONTROL
echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed or is not in PATH.
  echo Install Node.js 22 or newer, then run this file again.
  pause
  exit /b 1
)

for /f "tokens=1 delims=." %%V in ('node -p "process.versions.node"') do set NODE_MAJOR=%%V
if %NODE_MAJOR% LSS 22 (
  echo Node.js 22 or newer is required. Detected version:
  node --version
  pause
  exit /b 1
)

if not exist ".env" (
  echo The .env settings file is missing.
  echo Create the .env file in this folder before starting the server.
  pause
  exit /b 1
)

if not exist "node_modules\express\package.json" (
  echo Installing the required packages. Please wait...
  call npm install
  if errorlevel 1 (
    echo Package installation failed.
    pause
    exit /b 1
  )
)

echo Opening the local control page...
start "" cmd /c "timeout /t 2 /nobreak ^>nul ^& start http://127.0.0.1:4317"
call npm run launcher

echo.
echo Dark Spot control has closed.
pause
