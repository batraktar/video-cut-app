# Telegram Downloader

## Запуск одним кліком

- macOS: двічі натиснути `START_TELEGRAM.command` у корені проєкту.
- Windows: двічі натиснути `START_TELEGRAM_WINDOWS.bat` у корені проєкту.

На Windows після закриття застосунку вікно запуску залишиться відкритим, щоб можна було прочитати помилку, якщо вона виникла.

Під час першого запуску залежності встановляться автоматично. За замовчуванням авторизуйтеся QR-кодом (**Telegram → Налаштування → Пристрої → Підключити пристрій**); у вікні QR є кнопка входу за номером телефону, якщо сканування не спрацьовує. Для входу телефоном потрібен код із Telegram і, за наявності, пароль 2FA.

API_ID/API_HASH та Telegram-сесія зберігаються локально в `tools/telegram-downloader/telegram_api.json` і `tools/telegram-downloader/telegram_session.session`. Не видаляйте ці файли, якщо хочете залишатися авторизованими. Вони ігноруються Git-ом; не надсилайте їх іншим людям — сесія дає доступ до вашого Telegram.

GitHub Actions builds a Windows `.exe` from `telegram_batch_downloader.py`.

## Where to download

After workflow `Build Telegram Downloader` completes, open run artifacts and download:

`TelegramBatchDownloader-windows`

Inside artifact:

`TelegramBatchDownloader.exe`

## Local run

```bash
python tools/telegram-downloader/telegram_batch_downloader_qr.py
```

## Build triggers

- Push to `main` with changes in `tools/telegram-downloader/**`
- Manual run via `workflow_dispatch`
