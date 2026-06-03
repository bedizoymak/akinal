@echo off
title Akinal Insaat Deploy
cd /d C:\Users\Bediz\Documents\akinalinsaat.com

echo.
echo === BUILD BASLIYOR ===
call npm run build

if errorlevel 1 (
  echo.
  echo BUILD HATASI OLUSTU.
  pause
  exit /b 1
)

echo.
echo === FTP DEPLOY BASLIYOR ===
python scripts\deploy_ftp.py

echo.
echo === ISLEM BITTI ===
pause