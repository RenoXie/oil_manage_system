@echo off
setlocal enabledelayedexpansion
title OilMS - Update

echo.
echo ================================================
echo    Oil Management System - Update
echo ================================================
echo.

set "ROOT=%~dp0"

:: ============================================
:: 1. Stop services
:: ============================================
echo [1/5] Stopping services...

:: Stop backend (port 3000)
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3000.*LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
    echo        Backend stopped.
)

:: Stop frontend (port 5173)
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":5173.*LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
    echo        Frontend stopped.
)

timeout /t 2 /nobreak >nul
echo.

:: ============================================
:: 2. Pull latest code
:: ============================================
echo [2/5] Updating code...

set "GIT_BIN=D:\dev\Git\bin"
if not exist "%GIT_BIN%\git.exe" (
    echo        Git 未安装。如果你已手动复制最新文件，请忽略此提示。
    echo        如尚未复制，请按 Ctrl+C 停止，复制文件后再重新运行。
    timeout /t 5 /nobreak >nul
) else (
    cd /d "%ROOT%"
    "%GIT_BIN%\git.exe" pull
    if !errorlevel! neq 0 (
        echo [WARN] git pull failed. If you copied files manually, ignore this.
    ) else (
        echo        Code updated via git.
    )
)
echo.

:: ============================================
:: 3. Install new dependencies
:: ============================================
echo [3/5] Checking dependencies...

cd /d "%ROOT%server"
if exist "package.json" (
    call npm install --registry=https://registry.npmmirror.com
    if !errorlevel! neq 0 (
        echo [WARN] Server dependency install had issues.
    ) else (
        echo        Server dependencies OK.
    )
)

cd /d "%ROOT%client"
if exist "package.json" (
    call npm install --registry=https://registry.npmmirror.com
    if !errorlevel! neq 0 (
        echo [WARN] Client dependency install had issues.
    ) else (
        echo        Client dependencies OK.
    )
)
echo.

:: ============================================
:: 4. Run any pending migrations
:: ============================================
echo [4/5] Running database migrations...

cd /d "%ROOT%server"
call npx knex migrate:latest
if !errorlevel! neq 0 (
    echo [WARN] Migration may have issues. Check server\.env config.
) else (
    echo        Database is up to date.
)
echo.

:: ============================================
:: 5. Check .env & start services
:: ============================================
echo [5/5] Checking config and starting services...

cd /d "%ROOT%server"
findstr /c:"JWT_SECRET" .env >nul 2>&1
if !errorlevel! neq 0 (
    echo        JWT_SECRET not found. Adding one to .env ...
    for /f "tokens=*" %%k in ('powershell -NoProfile -Command "[guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')"') do set "GEN_KEY=%%k"
    echo JWT_SECRET=!GEN_KEY!>> .env
    echo JWT_EXPIRES_IN=24h>> .env
    echo        Generated new JWT_SECRET.
    timeout /t 1 /nobreak >nul
) else (
    echo        JWT_SECRET is configured.
)
echo.

for /f "tokens=2 delims=v." %%m in ('node -v') do set NODE_MAJOR=%%m
if !NODE_MAJOR! geq 18 (
    set "NODE_CMD=node --watch src/app.js"
) else (
    set "NODE_CMD=node src/app.js"
)

cd /d "%ROOT%server"
start "OilMS-Backend" /d "%ROOT%server" cmd /c "title OilMS - Backend && !NODE_CMD!"
timeout /t 3 /nobreak >nul

cd /d "%ROOT%client"
start "OilMS-Frontend" /d "%ROOT%client" cmd /c "title OilMS - Frontend && npx vite --host"
timeout /t 3 /nobreak >nul

start http://localhost:5173

echo.
echo ================================================
echo   Update complete!
echo.
echo   Frontend : http://localhost:5173
echo   Backend  : http://localhost:3000
echo.
echo   Run stop.bat to stop all services.
echo ================================================
echo.

pause
endlocal
