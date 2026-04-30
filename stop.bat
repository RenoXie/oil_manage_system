@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title OilMS - Stopping

echo.
echo ================================================
echo       Stopping Oil Management System...
echo ================================================
echo.

set FOUND=

:: Stop backend (port 3000)
echo Stopping backend...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3000.*LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
    echo        Backend stopped (PID: %%a)
    set FOUND=1
)
if not defined FOUND echo        No backend process found on port 3000.

set FOUND=

:: Stop frontend (port 5173)
echo Stopping frontend...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":5173.*LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
    echo        Frontend stopped (PID: %%a)
    set FOUND=1
)
if not defined FOUND echo        No frontend process found on port 5173.

echo.
echo All services stopped.
echo.

pause
endlocal
