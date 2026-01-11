# Video Cut App

React + Vite застосунок для нарізки відео, роботи з сегментами/оверлеями, експорту через FFmpeg та інтеграції з локальним сервером (Express + SQLite + імпорт Google Sheets).

## Швидкий старт

```bash
npm install
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
