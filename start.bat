@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title 油品管理系统 - 启动中...

echo.
echo ════════════════════════════════════════════
echo       油品进出库管理系统 - 一键启动
echo ════════════════════════════════════════════
echo.

:: ============================================
:: 1. 检测 Node.js
:: ============================================
echo [1/5] 检测 Node.js 环境...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 Node.js，请先安装 Node.js
    echo 下载地址：https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do echo        Node.js 版本: %%i
echo.

:: ============================================
:: 2. 检测并启动 MySQL
:: ============================================
echo [2/5] 检测 MySQL 服务...

set MYSQL_SERVICE=
for /f "tokens=2" %%s in ('sc query state^= all ^| findstr /i "SERVICE_NAME.*mysql"') do (
    set "MYSQL_SERVICE=%%s"
    goto :mysql_found
)

echo [错误] 未找到 MySQL 服务，请确认 MySQL 已安装
echo 常见服务名: MySQL80, MySQL57, MySQL, MySQL80-localtest
pause
exit /b 1

:mysql_found
echo        MySQL 服务: !MYSQL_SERVICE!

sc query "!MYSQL_SERVICE!" | findstr "RUNNING" >nul
if !errorlevel! neq 0 (
    echo        MySQL 未运行，正在启动...
    sc start "!MYSQL_SERVICE!" >nul 2>&1
    if !errorlevel! neq 0 (
        net start "!MYSQL_SERVICE!" >nul 2>&1
    )
    :: 等待 MySQL 启动
    timeout /t 3 /nobreak >nul
    echo        MySQL 已启动
) else (
    echo        MySQL 已运行
)
echo.

:: ============================================
:: 3. 安装依赖
:: ============================================
echo [3/5] 检查项目依赖...

cd /d "%~dp0"

if not exist "server\node_modules\" (
    echo        安装后端依赖（首次运行需要，请稍候）...
    cd server
    call npm install --registry=https://registry.npmmirror.com
    cd ..
)

if not exist "client\node_modules\" (
    echo        安装前端依赖（首次运行需要，请稍候）...
    cd client
    call npm install --registry=https://registry.npmmirror.com
    cd ..
)

echo        依赖检查完毕
echo.

:: ============================================
:: 4. 启动服务
:: ============================================
echo [4/5] 启动服务...

:: 启动后端 (新窗口)
echo        启动后端服务 (端口 3000)...
start "油品管理-后端服务" cmd /c "cd /d "%~dp0server" && node --watch src/app.js"

:: 等待后端启动
timeout /t 4 /nobreak >nul

:: 启动前端 (新窗口)
echo        启动前端服务 (端口 5173)...
start "油品管理-前端服务" cmd /c "cd /d "%~dp0client" && npx vite --host"

echo.

:: ============================================
:: 5. 打开浏览器
:: ============================================
echo [5/5] 打开浏览器...
timeout /t 3 /nobreak >nul
start http://localhost:5173

echo.
echo ════════════════════════════════════════════
echo   启动完成！
echo.
echo   前端地址: http://localhost:5173
echo   后端地址: http://localhost:3000
echo   默认账号: admin
echo   默认密码: admin123
echo.
echo   关闭此窗口不会影响服务运行
echo   如需停止服务，请关闭"油品管理"窗口
echo   或运行 stop.bat
echo ════════════════════════════════════════════
echo.

pause
endlocal
