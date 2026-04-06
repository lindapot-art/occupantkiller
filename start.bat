@echo off
cd /d "%~dp0"
chcp 65001 >nul 2>&1
title OccupantKiller - Local Dev Server
echo ============================================
echo   OCCUPANTKILLER - Local Development Server
echo ============================================
echo.

:: Kill anything already on port 3000
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo Killing existing process on port 3000 [PID %%a]...
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 1 /nobreak >nul

:: Check node is available
where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Download from https://nodejs.org/
    pause
    exit /b 1
)

:: Check server.js exists
if not exist server.js (
    echo ERROR: server.js not found in %cd%
    pause
    exit /b 1
)

echo Starting server on http://localhost:3000
echo Press Ctrl+C to stop.
echo.
node server.js

echo.
echo Server stopped. Press any key to close...
pause >nul
