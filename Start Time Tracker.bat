@echo off
cd /d "%~dp0"

set REPO_DIR=time-tracker
set REPO_URL=https://github.com/arathianevasion/time-tracker.git

where git >nul 2>nul
if %errorlevel% neq 0 (
    echo =======================================
    echo   Weekly Time Tracker
    echo =======================================
    echo.
    echo This app needs Git installed first - it's free, and only takes a couple of minutes.
    echo.
    echo Opening the download page for you...
    start "" "https://git-scm.com/downloads/win"
    echo.
    echo After installing it:
    echo   1. Close this window
    echo   2. Double-click this file again
    echo.
    pause
    exit /b 1
)

if not exist "%REPO_DIR%\.git" (
    echo =======================================
    echo   Weekly Time Tracker
    echo =======================================
    echo.
    echo First time here - downloading the app...
    git clone --quiet %REPO_URL% %REPO_DIR%
    if errorlevel 1 (
        echo.
        echo Download failed. Check your internet connection, then double-click this file again.
        pause
        exit /b 1
    )
    echo.
)

cd %REPO_DIR%

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
