@echo off
chcp 65001 >nul
title Mo Tuong Lua Windows cho May Chu So Suc Khoe (Port 8080)
cd /d "%~dp0"

echo ==============================================================
echo   DANG MO CONG 8080 TREN TUONG LUA WINDOWS DE DIEN THOAI TRUY CAP
echo ==============================================================
echo.

netsh advfirewall firewall delete rule name="Family Health Manager (Port 8080)" >nul 2>&1
netsh advfirewall firewall add rule name="Family Health Manager (Port 8080)" dir=in action=allow protocol=TCP localport=8080

if %errorlevel% equ 0 (
    echo [THANH CONG] Da mo cong 8080 tren Tuong lua Windows!
    echo Cac thiet bi khac (dien thoai, may tinh bang) trong cung mang Wi-Fi
    echo gio day da co the ket noi vao server HP nay thoai mai.
) else (
    echo [LUU Y] Ban can nhap chuot phai vao file nay va chon "Run as administrator" de cap quyen!
)

echo.
pause
