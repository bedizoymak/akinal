@echo off
title Akinal Insaat Deploy (Full Clean)
cd /d "%userprofile%\Documents\akinalinsaat.com"

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
echo === FTP FULL DEPLOY BASLIYOR (assets temizlenecek) ===
python scripts\deploy_ftp.py --full

if errorlevel 1 (
  echo.
  echo *** DEPLOY HATASI OLUSTU! ***
  echo Yukaridaki hata mesajlarini kontrol edin.
  pause
  exit /b 1
)

echo.
echo === ISLEM BASARIYLA TAMAMLANDI ===
pause
