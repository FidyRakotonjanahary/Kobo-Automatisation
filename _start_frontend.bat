@echo off
chcp 65001 >nul
title Kobo - Frontend (Vite)
color 0E
set "FRONTEND=%~dp0frontend"
echo Demarrage du Frontend Vite sur http://localhost:3001
echo.
pushd "%FRONTEND%"
call npm run dev
popd
exit
