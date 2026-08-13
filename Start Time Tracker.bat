@echo off
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo =======================================
    echo   Weekly Time Tracker
    echo =======================================
    echo.
    echo This app needs Node.js installed first - it's free, and only takes a couple of minutes.
    echo.
    echo Opening the download page for you...
    start "" "https://nodejs.org/en/download"
    echo.
    echo After installing it:
    echo   1. Close this window
    echo   2. Double-click this file again
    echo.
    pause
    exit /b 1
)

node scripts\setup.mjs
echo.
pause
