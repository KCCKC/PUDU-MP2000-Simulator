@echo off
title MP2000 Pallet Verifier
echo ========================================================
echo   Starting MP2000 Pallet Verifier Local Server...
echo ========================================================
start "" powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0server.ps1"
timeout /t 1 /nobreak >nul
start http://localhost:8080/index.html
echo Server running at http://localhost:8080/
echo You can close this window when done.
