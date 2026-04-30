@echo off
chcp 65001 >nul
title 停止油品管理系统...

echo.
echo ════════════════════════════════════════════
echo       正在停止油品管理系统...
echo ════════════════════════════════════════════
echo.

:: 停止后端（端口 3000）
echo 停止后端服务...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000.*LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
    echo       后端已停止 (PID: %%a)
)

:: 停止前端（端口 5173）
echo 停止前端服务...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173.*LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
    echo       前端已停止 (PID: %%a)
)

echo.
echo 所有服务已停止
echo.

pause
