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
exit /b %errorlevel%

:failed
echo Installation failed. Check the messages above.
pause
exit /b 1
