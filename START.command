#!/bin/zsh
set -e

cd "${0:A:h}"

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Помилка: спочатку встановіть Node.js LTS з https://nodejs.org/"
  read -r "?Натисніть Enter, щоб закрити..."
  exit 1
fi

if [[ ! -d node_modules || ! -d server/node_modules ]]; then
  echo "Перший запуск: встановлюю необхідні компоненти..."
  npm install
  npm --prefix server install
fi

npm run start:user
