@echo off
chcp 65001 >nul
title May Chu So Suc Khoe Gia Dinh - HPG2Z4
cd /d "%~dp0"

echo Dang khoi dong May Chu So Suc Khoe Gia Dinh...
start "" http://localhost:8080
node server.js
pause
