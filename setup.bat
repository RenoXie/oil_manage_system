@echo off
setlocal enabledelayedexpansion
title OilMS - Setup

echo.
echo ================================================
echo    Oil Management System - Setup
echo ================================================
echo.

set "ROOT=%~dp0"

:: ============================================
:: 1. Check Node.js
:: ============================================
echo [1/8] Checking Node.js...

where node >nul 2>&1
if !errorlevel! neq 0 (
    echo [ERROR] Node.js not found. Please install Node.js v18+ first.
    echo         Download: https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do echo        Version: %%i
echo.

:: ============================================
:: 2. Configure database
:: ============================================
echo [2/8] Configuring database connection...

cd /d "%ROOT%server"

:: Read current config
for /f "tokens=2 delims==" %%a in ('findstr "DB_HOST" .env') do set "DB_HOST=%%a"
for /f "tokens=2 delims==" %%a in ('findstr "DB_PORT" .env') do set "DB_PORT=%%a"
for /f "tokens=2 delims==" %%a in ('findstr "DB_USER" .env') do set "DB_USER=%%a"
for /f "tokens=2 delims==" %%a in ('findstr "DB_PASSWORD" .env') do set "DB_PASSWORD=%%a"
for /f "tokens=2 delims==" %%a in ('findstr "DB_NAME" .env') do set "DB_NAME=%%a"

echo.
echo   Current config:
echo     Host     : !DB_HOST!
echo     Port     : !DB_PORT!
echo     User     : !DB_USER!
echo     Password : !DB_PASSWORD!
echo     Database : !DB_NAME!
echo.

set /p "CONFIRM=   Use this config? (Y/N, default Y): "
if /i "!CONFIRM!"=="N" (
    set /p "DB_HOST=   Host [127.0.0.1]: "
    if "!DB_HOST!"=="" set "DB_HOST=127.0.0.1"
    set /p "DB_PORT=   Port [3306]: "
    if "!DB_PORT!"=="" set "DB_PORT=3306"
    set /p "DB_USER=   User: "
    set /p "DB_PASSWORD=   Password: "
    set /p "DB_NAME=   Database [oilms]: "
    if "!DB_NAME!"=="" set "DB_NAME=oilms"

    :: Generate random JWT secret
    for /f %%k in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set "JWT_KEY=%%k"

    :: Write new .env
    (
        echo DB_HOST=!DB_HOST!
        echo DB_PORT=!DB_PORT!
        echo DB_USER=!DB_USER!
        echo DB_PASSWORD=!DB_PASSWORD!
        echo DB_NAME=!DB_NAME!
        echo JWT_SECRET=!JWT_KEY!
        echo JWT_EXPIRES_IN=7d
        echo ALLOWED_ORIGINS=http://localhost:5173
        echo PORT=3000
    ) > .env
    echo        Config saved.
)
echo.

:: ============================================
:: 3. Test MySQL connection
:: ============================================
echo [3/8] Testing MySQL connection...

node -e "var m=require('mysql2/promise');m.createConnection({host:process.env.DB_HOST,port:process.env.DB_PORT,user:process.env.DB_USER,password:process.env.DB_PASSWORD}).then(function(c){c.end();process.exit(0)}).catch(function(e){console.error(e.message);process.exit(1)})"
if !errorlevel! neq 0 (
    echo [ERROR] Cannot connect to MySQL.
    echo         Please check your credentials and ensure MySQL is running.
    pause
    exit /b 1
)
echo        MySQL connection OK.
echo.

:: ============================================
:: 4. Install server dependencies
:: ============================================
echo [4/8] Installing server dependencies...
cd /d "%ROOT%server"
if not exist "node_modules\" (
    call npm install --registry=https://registry.npmmirror.com
    if !errorlevel! neq 0 (
        echo [ERROR] Server dependency install failed.
        pause
        exit /b 1
    )
) else (
    echo        Already installed.
)
echo.

:: ============================================
:: 5. Install client dependencies
:: ============================================
echo [5/8] Installing client dependencies...
cd /d "%ROOT%client"
if not exist "node_modules\" (
    call npm install --registry=https://registry.npmmirror.com
    if !errorlevel! neq 0 (
        echo [ERROR] Client dependency install failed.
        pause
        exit /b 1
    )
) else (
    echo        Already installed.
)
echo.

:: ============================================
:: 6. Install root dependencies (exceljs)
:: ============================================
echo [6/8] Installing root dependencies...
cd /d "%ROOT%"
if not exist "node_modules\" (
    call npm install --registry=https://registry.npmmirror.com
    if !errorlevel! neq 0 (
        echo [ERROR] Root dependency install failed.
        pause
        exit /b 1
    )
) else (
    echo        Already installed.
)
echo.

:: ============================================
:: 7. Initialize database
:: ============================================
echo [7/8] Initializing database...
cd /d "%ROOT%server"

echo        Creating databases...
node setup-db.js
if !errorlevel! neq 0 (
    echo [ERROR] Database creation failed.
    pause
    exit /b 1
)

:: --- oilms (dev) ---
echo        [oilms] Running migrations...
call npx knex migrate:latest
if !errorlevel! neq 0 (
    echo [ERROR] oilms migration failed.
    pause
    exit /b 1
)

echo        [oilms] Running seeds...
call npx knex seed:run
if !errorlevel! neq 0 (
    echo [ERROR] oilms seed failed.
    pause
    exit /b 1
)

:: --- oilms_prod ---
echo        [oilms_prod] Switching database...
set "SAVED_DB_NAME=!DB_NAME!"
set "ENV_FILE=%ROOT%server\.env"

:: Write temp powershell script to switch DB
set "PS_FILE=%ROOT%server\_switch_db.ps1"
echo $env_content = Get-Content '%ENV_FILE%' -Encoding UTF8 > "!PS_FILE!"
echo $env_content = $env_content -replace '^DB_NAME=.*', 'DB_NAME=oilms_prod' >> "!PS_FILE!"
echo $env_content ^| Set-Content '%ENV_FILE%' -Encoding UTF8 >> "!PS_FILE!"
powershell -ExecutionPolicy Bypass -File "!PS_FILE!"
del "!PS_FILE!"

echo        [oilms_prod] Running migrations...
call npx knex migrate:latest
if !errorlevel! neq 0 (
    echo [ERROR] oilms_prod migration failed.
    pause
    exit /b 1
)

echo        [oilms_prod] Running seeds...
call npx knex seed:run
if !errorlevel! neq 0 (
    echo [ERROR] oilms_prod seed failed.
    pause
    exit /b 1
)

:: Restore original DB_NAME
echo $env_content = Get-Content '%ENV_FILE%' -Encoding UTF8 > "!PS_FILE!"
echo $env_content = $env_content -replace '^DB_NAME=.*', 'DB_NAME=!SAVED_DB_NAME!' >> "!PS_FILE!"
echo $env_content ^| Set-Content '%ENV_FILE%' -Encoding UTF8 >> "!PS_FILE!"
powershell -ExecutionPolicy Bypass -File "!PS_FILE!"
del "!PS_FILE!"

echo        Both databases are ready.
cd /d "%ROOT%"
echo.

:: ============================================
:: 8. Start application
:: ============================================
echo [8/8] Starting application...

set "NODE_CMD=node src/app.js"
node -e "process.exit(parseInt(process.versions.node.split('.')[0])>=18?0:1)"
if !errorlevel! equ 0 set "NODE_CMD=node --watch src/app.js"

cd /d "%ROOT%server"
start "OilMS-Backend" cmd /c "title OilMS - Backend && !NODE_CMD!"
timeout /t 3 /nobreak >nul

cd /d "%ROOT%client"
start "OilMS-Frontend" cmd /c "title OilMS - Frontend && npx vite --host"
timeout /t 3 /nobreak >nul

cd /d "%ROOT%"
timeout /t 2 /nobreak >nul
start http://localhost:5173

echo.
echo ================================================
echo   Deploy complete!
echo.
echo   Frontend : http://localhost:5173
echo   Backend  : http://localhost:3000
echo   Login    : admin / admin123
echo.
echo   Run stop.bat to stop all services.
echo ================================================
echo.

pause
endlocal
