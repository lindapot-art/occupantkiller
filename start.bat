@echo off
setlocal EnableExtensions
cd /d "%~dp0"
chcp 65001 >nul 2>&1
title OccupantKiller - Local Dev Launcher
echo ============================================
echo   OCCUPANTKILLER - Full Local Launcher
echo ============================================
echo.

:: Kill anything already on frontend/backend ports
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo Killing existing process on port 3000 [PID %%a]...
    taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3001" ^| findstr "LISTENING"') do (
    echo Killing existing process on port 3001 [PID %%a]...
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

echo Starting API backend on http://localhost:3001
if exist backend\index.js (
    start "OccupantKiller API" /D "%~dp0backend" cmd /k node index.js
) else (
    echo WARNING: backend\index.js not found, API service skipped.
)

echo Starting game server on http://localhost:3000
start "OccupantKiller Game" /D "%~dp0" cmd /k node server.js

set _tries=0
:wait_game_ready
set /a _tries+=1
powershell -NoProfile -Command "try { $r = Invoke-WebRequest 'http://localhost:3000/healthz' -UseBasicParsing -TimeoutSec 1; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 goto game_ready
if %_tries% GEQ 15 goto game_not_ready
timeout /t 1 /nobreak >nul
goto wait_game_ready

:game_ready
echo Game server is healthy.
goto open_browser

:game_not_ready
echo WARNING: Game server health check did not return 200 in time. Opening browser anyway.

:open_browser
echo Opening game in browser...
start "" "http://localhost:3000"

echo.
echo Frontend and backend launch commands were started in separate windows.
echo Close those windows or press Ctrl+C in each window to stop services.
echo.
pause >nul
