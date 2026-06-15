@echo off
chcp 65001 >nul
title Kobo Automation Suite - Arrêt
color 0C

echo.
echo  Arrêt de Kobo Automation Suite...
echo.

:: Fermer les fenêtres de terminal du projet
taskkill /FI "WINDOWTITLE eq Kobo - Backend (FastAPI)*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Kobo - Frontend (Vite)*" /T /F >nul 2>&1

:: Tuer les processus uvicorn et node liés au projet
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8000 " ^| findstr "LISTENING"') do (
    taskkill /PID %%p /F >nul 2>&1
)
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3001 " ^| findstr "LISTENING"') do (
    taskkill /PID %%p /F >nul 2>&1
)

echo  ✓ Serveurs arrêtés.
echo.
timeout /t 2 /nobreak >nul
exit
