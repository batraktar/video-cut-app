# Video Cut App

React + Vite застосунок для нарізки відео, роботи з сегментами/оверлеями, експорту через FFmpeg та інтеграції з локальним сервером (Express + SQLite + імпорт Google Sheets).

## Швидкий старт

### Для користувача без технічного досвіду

- **macOS:** двічі натиснути `START.command`.
- **Windows:** двічі натиснути `START_WINDOWS.bat`.

Під час першого запуску скрипт сам встановить залежності. Потім він запустить локальний сервер і відкриє редактор у браузері за адресою http://localhost:5173. Вікно запуску треба залишити відкритим до завершення роботи.

Telegram Downloader запускається окремо:

- **macOS:** `START_TELEGRAM.command`.
- **Windows:** `START_TELEGRAM_WINDOWS.bat`.

Перший запуск сам створить ізольоване Python-середовище та встановить потрібні пакети. Вхід у Telegram відбувається через QR-код у GUI; вебредактор для цього не потрібен.

### Для розробника

```bash
npm install
npm --prefix server install
npm run dev        # фронт (Vite)
npm run server     # бек (server/), порт 7071 за замовчуванням
```

- Веб інтерфейс: http://localhost:5173
- Сервер: http://localhost:7071 (можна змінити в UI адмінки)
- Запуск обох одночасно: `npm run dev:all`

## Скрипти

- `npm run dev` — фронт
- `npm run server` — локальний сервер (Express + SQLite)
- `npm run dev:all` — фронт і сервер паралельно (concurrently)
- `npm run build` — збірка фронту
- `npm run lint` — ESLint

## Використані інструменти

- **Фронт**: React 19, Vite, Tailwind, lucide-react іконки.
- **Стан**: custom hooks (`usePlaylist`, `useAdmin`), кеш у LocalStorage + IndexedDB (edits, файли).
- **Бек**: Express + SQLite, Google APIs (Sheets), PapaParse для CSV.
- **FFmpeg**: формується клієнтом на основі сегментів/оверлеїв/trim/crop; батч-режим; опція автозавантаження.
- **Drag/Overlay**: прямий DOM-прев’ю, throttle, канали оверлеїв (digital/analog/thermal).

## Як формується FFmpeg команда

- Береться активне відео (та його варіанти каналів) і поточний edit (trim/crop/елементи/сегменти).
- Сегменти: `trim` або набір сегментів для активного `segmentMode`; кілька сегментів збираються через `concat`.
- Crop: `crop=W:H:X:Y` на основі відсоткових значень та реальної ширини/висоти.
- Оверлеї: `drawbox` (для прямокутників/кіл) з кольором/товщиною, `enable='between(t,start,end)'`.
- Багатоканальність: елементи рендеряться лише для відповідного `segmentMode`; окремі варіанти каналів отримують свій граф.
- Фінальна команда виглядає як `ffmpeg -i input -filter_complex "<graph>" -map "[vout]" -an -c:v libx264 -crf 18 -preset slow -movflags +faststart output.mp4` (опція overwrite/-n залежно від налаштувань).
- Для багатьох сегментів: кожен відрізається (`trim+setpts`), потім `concat`. Якщо без фільтрів — використовує `-ss/-to -c copy`.

## Як запускати обробку

- У UI натиснути “Експорт/FFmpeg”: клієнт згенерує скрипт/команду і покаже її (можна скопіювати).
- Батч-режим: `Queue` / `Batch` — послідовно обробляє обрані відео, авто-завантажує результати.
- Локальний сервер може виконувати rename/move після успіху (для файлів із каталогу).

## Структура

- `src/` — React UI, редактор, хуки
- `server/` — локальний бекенд (Express, SQLite, імпорт шита)
- `public/` — статика

## Зберігання

- Редагування кешуються у `localStorage` та IndexedDB (резерв під ключами `id`/`fileKey`).
- Кеш файлів у IndexedDB (`videos` store).
- Логи та `server/metadata.sqlite` ігноруються в git.

## Ліцензія

MIT — див. `LICENSE`.
