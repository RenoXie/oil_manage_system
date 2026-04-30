@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title OilMS-Prod - Startup

echo.
echo ================================================
echo   Oil Management System [PRODUCTION] - Startup
echo ================================================
echo.

set "ROOT=%~dp0"

:: ============================================
:: Set production database
:: ============================================
set DB_NAME=oilms_prod
echo        Database: %DB_NAME%
echo.

:: ============================================
:: 1. Check Node.js
:: ============================================
echo [1/7] Checking Node.js...

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Please install Node.js first.
    echo         Download: https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo        Version: !NODE_VERSION!

for /f "tokens=2 delims=v." %%m in ("!NODE_VERSION!") do set NODE_MAJOR=%%m
if !NODE_MAJOR! geq 18 (
    set "NODE_CMD=node --watch src/app.js"
) else (
    set "NODE_CMD=node src/app.js"
    echo        [WARN] --watch requires Node.js ^>= 18. Auto-reload disabled.
)
echo.

:: ============================================
:: 2. Check and start MySQL
:: ============================================
echo [2/7] Checking MySQL...

set MYSQL_SERVICE=
for /f "tokens=2" %%s in ('sc query state^= all ^| findstr /i "SERVICE_NAME.*mysql"') do (
    set "MYSQL_SERVICE=%%s"
    goto :mysql_found
)

echo [ERROR] No MySQL service found.
echo        Please install MySQL and ensure a Windows service is registered.
echo        Common names: MySQL80, MySQL57, MySQL, MariaDB
pause
exit /b 1

:mysql_found
echo        Service: !MYSQL_SERVICE!

sc query "!MYSQL_SERVICE!" | findstr "RUNNING" >nul
if !errorlevel! neq 0 (
    echo        Starting MySQL...
    sc start "!MYSQL_SERVICE!" >nul 2>&1
    if !errorlevel! neq 0 (
        net start "!MYSQL_SERVICE!" >nul 2>&1
        if !errorlevel! neq 0 (
            echo [ERROR] Failed to start MySQL. Try running as Administrator.
            pause
            exit /b 1
        )
    )
    timeout /t 3 /nobreak >nul
    echo        MySQL started.
) else (
    echo        MySQL is running.
)
echo.

:: ============================================
:: 3. Install dependencies
:: ============================================
echo [3/7] Installing dependencies...

cd /d "%ROOT%"

if not exist "server\node_modules\" (
    echo        Installing server dependencies...
    cd server
    call npm install --registry=https://registry.npmmirror.com
    if !errorlevel! neq 0 (
        echo [ERROR] Server dependency install failed.
        cd ..
        pause
        exit /b 1
    )
    cd ..
)

if not exist "client\node_modules\" (
    echo        Installing client dependencies...
    cd client
    call npm install --registry=https://registry.npmmirror.com
    if !errorlevel! neq 0 (
        echo [ERROR] Client dependency install failed.
        cd ..
        pause
        exit /b 1
    )
    cd ..
)

echo        Dependencies OK.
echo.

:: ============================================
:: 4. Initialize database
:: ============================================
echo [4/7] Initializing database...

cd /d "%ROOT%server"

echo        Creating database oilms_prod...
node setup-db.js
if !errorlevel! neq 0 (
    echo [ERROR] Database creation failed.
    echo        Check MySQL credentials in server\.env.prod
    cd ..
    pause
    exit /b 1
)

echo        Running migrations...
call npx knex migrate:latest
if !errorlevel! neq 0 (
    echo [ERROR] Migration failed.
    cd ..
    pause
    exit /b 1
)

echo        Running seeds...
call npx knex seed:run
if !errorlevel! neq 0 (
    echo [ERROR] Seed failed.
    cd ..
    pause
    exit /b 1
)

cd ..
echo        Database is ready.
echo.

:: ============================================
:: 5. Start backend (port 3000)
:: ============================================
echo [5/7] Starting backend on port 3000...
cd /d "%ROOT%server"
start "OilMS-Prod-Backend" /d "%ROOT%server" cmd /c "title OilMS-Prod - Backend && !NODE_CMD!"
cd ..
timeout /t 3 /nobreak >nul
echo        Backend started.
echo.

:: ============================================
:: 6. Start frontend (port 5173)
:: ============================================
echo [6/7] Starting frontend on port 5173...
start "OilMS-Prod-Frontend" /d "%ROOT%client" cmd /c "title OilMS-Prod - Frontend && npx vite --host"
timeout /t 3 /nobreak >nul
echo        Frontend started.
echo.

:: ============================================
:: 7. Open browser
:: ============================================
echo [7/7] Opening browser...
timeout /t 2 /nobreak >nul
start http://localhost:5173

echo.
echo ================================================
echo   [PROD] Startup complete!
echo.
echo   Frontend : http://localhost:5173
echo   Backend  : http://localhost:3000
echo   Database : oilms_prod
echo   Login    : admin / admin123
echo.
echo   Run stop.bat to stop all services.
echo ================================================
echo.

pause
endlocal
