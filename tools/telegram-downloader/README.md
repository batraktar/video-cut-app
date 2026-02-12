# Telegram Downloader (Standalone build)

GitHub Actions builds a Windows `.exe` from `telegram_batch_downloader.py`.

## Where to download

After workflow `Build Telegram Downloader` completes, open run artifacts and download:

`TelegramBatchDownloader-windows`

Inside artifact:

`TelegramBatchDownloader.exe`

## Local run

```bash
python tools/telegram-downloader/telegram_batch_downloader.py
```

## Build triggers

- Push to `main` with changes in `tools/telegram-downloader/**`
- Manual run via `workflow_dispatch`
