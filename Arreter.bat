@echo off
chcp 65001 >nul
title ARRET - Kobo Automation Suite

echo.
echo  Arrêt forcé en cours...
echo.

:: 1. Tuer les processus serveurs
taskkill /F /IM node.exe /T >nul 2>&1
taskkill /F /IM python.exe /T >nul 2>&1
taskkill /F /IM uvicorn.exe /T >nul 2>&1

:: 2. Fermer le navigateur (Kobo) et les fenêtres System32 résiduelles
powershell -Command "Get-Process | Where-Object {$_.MainWindowTitle -like '*Kobo*'} | Stop-Process -Force" >nul 2>&1
powershell -Command "Get-Process | Where-Object {$_.MainWindowTitle -like '*System32\cmd.exe*'} | Stop-Process -Force" >nul 2>&1

:: 3. Fermer toutes les fenêtres de commande liées au dossier du projet
echo  Fermeture des terminaux du projet...
powershell -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'cmd.exe' -and $_.CommandLine -like '*Automatisation Kobo*' } | ForEach-Object { Stop-Process $_.ProcessId -Force }" >nul 2>&1
taskkill /F /IM cmd.exe >nul 2>&1
