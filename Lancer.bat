@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title Kobo Automation Suite - Demarrage...
color 0A

echo.
echo  ============================================================
echo       KOBO AUTOMATION SUITE - Demarrage
echo  ============================================================
echo.

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "BACKEND=!ROOT!\backend"
set "FRONTEND=!ROOT!\frontend"
set "VENV=!BACKEND!\venv"
set "VENV_PY=!VENV!\Scripts\python.exe"
set "VENV_PIP=!VENV!\Scripts\pip.exe"
set "VENV_UV=!VENV!\Scripts\uvicorn.exe"

echo Dossier projet : !ROOT!
echo.

echo [1/5] Verification de Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo  ERREUR : Python n'est pas installe ou pas dans le PATH.
    echo.
    echo  Veuillez installer Python 3.11+ depuis https://www.python.org/downloads/
    echo  et cocher "Add Python to PATH" lors de l'installation.
    pause
    exit /b 1
)
echo  OK : Python detecte.

echo [2/5] Verification de Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo  ERREUR : Node.js n'est pas installe ou pas dans le PATH.
    echo.
    echo  Veuillez installer Node.js depuis https://nodejs.org/
    pause
    exit /b 1
)
echo  OK : Node.js detecte.

echo [3/5] Verification de l'environnement Python (venv)...
if not exist "!VENV_PY!" (
    echo  Creation du venv, patientez...
    python -m venv "!VENV!"
    if errorlevel 1 (
        echo  ERREUR : Impossible de creer le venv.
        pause
        exit /b 1
    )
    echo  OK : venv cree.
    echo  Installation des dependances Python...
    "!VENV_PIP!" install -r "!BACKEND!\requirements.txt" --quiet
    if errorlevel 1 (
        echo  ERREUR : Installation des dependances Python echouee.
        pause
        exit /b 1
    )
    echo  OK : Dependances Python installees.
) else (
    echo  OK : venv deja present.
)

echo [4/5] Verification des modules Node.js...
if not exist "!FRONTEND!\node_modules" (
    echo  Installation des dependances Node.js, patientez...
    pushd "!FRONTEND!"
    call npm install --silent
    if errorlevel 1 (
        echo  ERREUR : npm install a echoue.
        popd
        pause
        exit /b 1
    )
    popd
    echo  OK : Dependances Node.js installees.
) else (
    echo  OK : node_modules deja present.
)

echo [5/5] Demarrage des serveurs...
echo.
echo  Backend  : http://localhost:8000
echo  Frontend : http://localhost:3001
echo.

start "Kobo - Backend (FastAPI)" "!ROOT!\_start_backend.bat"

ping -n 4 127.0.0.1 >nul 2>&1

start "Kobo - Frontend (Vite)" "!ROOT!\_start_frontend.bat"

ping -n 5 127.0.0.1 >nul 2>&1

echo  Ouverture du navigateur...
start "" "http://localhost:3001"

echo.
echo  ============================================================
echo   Application lancee avec succes !
echo.
echo   Pour arreter : double-cliquer sur Arreter.bat
echo   ou fermer les fenetres Backend et Frontend.
echo  ============================================================
echo.
endlocal
ping -n 6 127.0.0.1 >nul 2>&1
exit
