@echo off
setlocal
cd /d "%~dp0"

where py >nul 2>nul
if errorlevel 1 (
  echo Error: install Python 3.12 from https://python.org/
  pause
  exit /b 1
)

if not exist ".telegram-venv\Scripts\python.exe" (
  echo First launch: preparing Telegram Downloader...
  py -3 -m venv .telegram-venv
  if errorlevel 1 goto :failed
  .telegram-venv\Scripts\python.exe -m pip install --upgrade pip
  if errorlevel 1 goto :failed
  .telegram-venv\Scripts\python.exe -m pip install -r tools\telegram-downloader\requirements.txt
  if errorlevel 1 goto :failed
)

.telegram-venv\Scripts\python.exe tools\telegram-downloader\telegram_batch_downloader_qr.py
set "APP_EXIT_CODE=%ERRORLEVEL%"
if not "%APP_EXIT_CODE%"=="0" echo Telegram Downloader exited with code %APP_EXIT_CODE%.
echo.
echo Press any key to close this window.
pause >nul
exit /b %APP_EXIT_CODE%

:failed
echo Installation failed. Check the messages above.
pause
exit /b 1
