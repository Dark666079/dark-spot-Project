@echo off
setlocal EnableExtensions
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

for /f "tokens=1 delims=." %%V in ('node -p "process.versions.node"') do set "NODE_MAJOR=%%V"
if not defined NODE_MAJOR (
  echo Could not detect the Node.js version.
  pause
  exit /b 1
)
if %NODE_MAJOR% LSS 22 (
  echo Node.js 22 or newer is required. Detected:
  node --version
  pause
  exit /b 1
)

if not exist ".env" (
  echo Creating private local settings...
  node -e "const c=require('crypto'),f=require('fs');f.writeFileSync('.env','SESSION_SECRET='+c.randomBytes(48).toString('hex')+'\r\nOWNER_SETUP_TOKEN='+c.randomBytes(48).toString('hex')+'\r\n',{flag:'wx'});"
  if errorlevel 1 (
    echo Could not create .env. Check folder permissions.
    pause
    exit /b 1
  )
  echo Private settings created. Keep .env secret and never upload it.
)

node -e "for(const p of ['express','express-session','socket.io','bcryptjs','helmet','express-rate-limit','better-sqlite3'])require.resolve(p)" >nul 2>nul
if errorlevel 1 (
  echo Installing missing project packages. Please wait...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo Package installation failed.
    pause
    exit /b 1
  )
)

echo Checking project files...
call npm run check
if errorlevel 1 (
  echo.
  echo A project syntax check failed. The server was not started.
  pause
  exit /b 1
)

echo.
echo Opening the local control page...
start "" cmd /c "ping 127.0.0.1 -n 3 >nul & start http://127.0.0.1:4317"
call npm run launcher

echo.
echo Dark Spot control has closed.
pause
