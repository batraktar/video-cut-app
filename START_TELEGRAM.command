#!/bin/zsh
set -e

cd "${0:A:h}"

if ! command -v python3 >/dev/null 2>&1; then
  echo "Помилка: спочатку встановіть Python 3.12 з https://python.org/"
  read -r "?Натисніть Enter, щоб закрити..."
  exit 1
fi

if [[ ! -x .telegram-venv/bin/python ]]; then
  echo "Перший запуск: готую Telegram Downloader..."
  python3 -m venv .telegram-venv
  .telegram-venv/bin/python -m pip install --upgrade pip
  .telegram-venv/bin/python -m pip install -r tools/telegram-downloader/requirements.txt
fi

.telegram-venv/bin/python tools/telegram-downloader/telegram_batch_downloader_qr.py
