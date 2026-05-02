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

where git >nul 2>&1
if !errorlevel! equ 0 (
    cd /d "%ROOT%"
    git pull
    if !errorlevel! neq 0 (
        echo [WARN] git pull failed. If you copied files manually, ignore this.
    ) else (
        echo        Code updated via git.
    )
) else (
    echo        Git not found - assuming files were copied manually.
    echo        If you haven't copied the latest files yet, press Ctrl+C now and extract them first.
    timeout /t 5 /nobreak >nul
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
:: 5. Start services
:: ============================================
echo [5/5] Starting services...

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
