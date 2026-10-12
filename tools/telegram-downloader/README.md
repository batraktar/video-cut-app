# Telegram Downloader

## Запуск одним кліком

- macOS: двічі натиснути `START_TELEGRAM.command` у корені проєкту.
- Windows: двічі натиснути `START_TELEGRAM_WINDOWS.bat` у корені проєкту.

Під час першого запуску залежності встановляться автоматично. Авторизація відбувається через QR-код у застосунку Telegram: **Налаштування → Пристрої → Підключити пристрій**.

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
