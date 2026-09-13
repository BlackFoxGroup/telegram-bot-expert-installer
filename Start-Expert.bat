@echo off
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js نصب نیست. از https://nodejs.org نسخه LTS را نصب کنید.
  pause
  exit /b 1
)

if not exist "node_modules" call npm install
if not exist "apps\server\dist\index.js" call npm run build
if not exist "apps\web\dist\index.html" call npm run build

netstat -ano | findstr ":4780" | findstr "LISTENING" >nul
if not errorlevel 1 (
  start "" "http://127.0.0.1:4780/"
  echo برنامه روشن است. مرورگر باید باز شود.
  echo اگر صفحه نیامد، همین آدرس را در مرورگر بگذارید:
  echo http://127.0.0.1:4780/
  pause
  exit /b 0
)

echo برنامه در مرورگر باز می‌شود. این پنجره را نبندید.
start "" "http://127.0.0.1:4780/"
node "apps\server\dist\index.js"
if errorlevel 1 (
  echo برنامه بالا نیامد.
  pause
)
