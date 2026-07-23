@echo off
cd /d "%~dp0"
title LayoutManager
echo.
echo  =============================================
echo   LayoutManager - Development Server
echo  =============================================
echo.

:: Check for node
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js is not installed or not in PATH.
    echo  Download it from https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: Install dependencies if needed
if not exist "node_modules\.bin\vite.cmd" (
    echo  Installing dependencies...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo  [ERROR] Failed to install dependencies.
        pause
        exit /b 1
    )
    echo.
)

if not exist "node_modules\.bin\vite.cmd" (
    echo  [ERROR] Vite not found. Try deleting the node_modules folder and running this again.
    pause
    exit /b 1
)

echo  Starting Layout Manager...
echo  Your browser will open automatically in a few seconds.
echo  Keep this window open while using the app.
echo  Close this window (or press Ctrl+C) to stop.
echo.
call node_modules\.bin\vite.cmd --open
pause
