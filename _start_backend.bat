@echo off
chcp 65001 >nul
title Kobo - Backend (FastAPI)
color 0B
set "BACKEND=%~dp0backend"
set "VENV=%BACKEND%\venv"
echo Demarrage du Backend FastAPI sur http://localhost:8000
echo.
"%VENV%\Scripts\uvicorn.exe" app.main:app --reload --host 0.0.0.0 --port 8000
pause
