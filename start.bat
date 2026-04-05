@echo off
title OccupantKiller — Local Dev Server
echo ============================================
echo   OCCUPANTKILLER — Local Development Server
echo ============================================
echo.
echo Starting server on http://localhost:8080
echo Press Ctrl+C to stop.
echo.
npx --yes serve -l 8080 .
