@echo off
chcp 65001 >NUL
title Роббо Банк (локально)
cd /d "%~dp0"

where node >NUL 2>&1
if errorlevel 1 (
  echo [ОШИБКА] Node.js не найден.
  echo Скачайте Node LTS с https://nodejs.org и установите, затем запустите снова.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Устанавливаю зависимости (первый запуск, 1-3 минуты)...
  call npm i
  if errorlevel 1 (
    echo [ОШИБКА] npm i не удался. Проверьте интернет и запустите снова.
    pause
    exit /b 1
  )
)

echo Запускаю Роббо Банк...
start "" "http://localhost:1420"
call npm run dev -- --port 1420
pause
